import type {
  PackageSavedOutputComparison,
  PackageSavedOutputComparisonOptions,
  PackageTestScript,
} from "./types.js";

const MAX_COMPARISON_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_COMPARISON_LINES = 250_000;

/**
 * Compare caller-captured display text with a package's unchanged saved test output.
 * Source echo is inferred from text, so output identical to the next echoed source line is
 * inherently ambiguous; this report is not byte-level R CMD check evidence.
 */
export function comparePackageSavedOutput(
  script: PackageTestScript,
  actual: string,
  options: PackageSavedOutputComparisonOptions,
): PackageSavedOutputComparison {
  if (options.policyVersion !== 1) {
    throw new Error("Saved-output policyVersion must be 1.");
  }
  if (
    options.expectedFormat !== "rout-save-source-echo" &&
    options.expectedFormat !== "display-only"
  ) {
    throw new Error("Saved-output expectedFormat must be explicit and supported.");
  }
  if (options.comparison !== "exact-text" && options.comparison !== "display-whitespace") {
    throw new Error("Saved-output comparison mode must be explicit and supported.");
  }
  const expectation = script.expectedOutput;
  const inputBytes =
    Buffer.byteLength(script.source) +
    Buffer.byteLength(actual) +
    (expectation === undefined ? 0 : Buffer.byteLength(expectation.source));
  if (inputBytes > MAX_COMPARISON_INPUT_BYTES) {
    throw new RangeError("Saved-output comparison input exceeds the 64 MiB limit.");
  }
  assertLineLimit(script.source);
  assertLineLimit(actual);
  if (expectation !== undefined) assertLineLimit(expectation.source);
  const base = {
    schemaVersion: 1,
    policyVersion: options.policyVersion,
    path: script.path,
    expectedPath: expectation?.path ?? null,
    expectedFormat: options.expectedFormat,
    comparison: options.comparison,
  } as const;
  if (expectation === undefined) {
    return {
      ...base,
      outcome: "no-expectation",
      sourceEchoLinesRemoved: 0,
      firstDifference: null,
    };
  }

  const prepared =
    options.expectedFormat === "rout-save-source-echo"
      ? stripSourceEcho(expectation.source, script.source)
      : { text: expectation.source, removed: 0 };
  const expected =
    options.comparison === "display-whitespace"
      ? normalizeDisplayWhitespace(prepared.text)
      : prepared.text;
  const observed =
    options.comparison === "display-whitespace" ? normalizeDisplayWhitespace(actual) : actual;
  const firstDifference = findFirstDifference(expected, observed);
  return {
    ...base,
    outcome: firstDifference === null ? "match" : "mismatch",
    sourceEchoLinesRemoved: prepared.removed,
    firstDifference,
  };
}

function assertLineLimit(text: string): void {
  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\r") {
      lines += 1;
      if (text[index + 1] === "\n") index += 1;
    } else if (text[index] === "\n") {
      lines += 1;
    }
    if (lines > MAX_COMPARISON_LINES) {
      throw new RangeError("Saved-output comparison input exceeds the 250000-line limit.");
    }
  }
}

function stripSourceEcho(
  savedOutput: string,
  source: string,
): { readonly text: string; readonly removed: number } {
  const sourceLines = source.split(/\r\n|\n|\r/u);
  let sourceIndex = 0;
  let removed = 0;
  const kept: string[] = [];
  const savedLines = linesWithTerminators(savedOutput);
  for (const [index, line] of savedLines.entries()) {
    const prompt =
      line.content.startsWith("> ") || line.content.startsWith("+ ")
        ? line.content.slice(2)
        : undefined;
    // A prompt-shaped output line stays intact unless it is the next exact source line.
    if (
      prompt !== undefined &&
      sourceIndex < sourceLines.length &&
      prompt === sourceLines[sourceIndex]
    ) {
      sourceIndex += 1;
      removed += 1;
      continue;
    }
    // In this declared Rout format, a final bare prompt marks the end of echoed input.
    if (index === savedLines.length - 1 && (line.content === ">" || line.content === "> ")) {
      removed += 1;
      continue;
    }
    kept.push(line.raw);
  }
  return { text: kept.join(""), removed };
}

function linesWithTerminators(text: string): readonly {
  readonly content: string;
  readonly raw: string;
}[] {
  const lines: { content: string; raw: string }[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n" && text[index] !== "\r") continue;
    const terminatorLength = text[index] === "\r" && text[index + 1] === "\n" ? 2 : 1;
    lines.push({
      content: text.slice(start, index),
      raw: text.slice(start, index + terminatorLength),
    });
    index += terminatorLength - 1;
    start = index + 1;
  }
  if (start < text.length) lines.push({ content: text.slice(start), raw: text.slice(start) });
  return lines;
}

function normalizeDisplayWhitespace(text: string): string {
  return text
    .replace(/\r\n|\r/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/^[ \t]+|[ \t]+$/gu, "").replace(/[ \t]+/gu, " "))
    .filter((line) => line.length > 0)
    .join("\n");
}

function findFirstDifference(
  expected: string,
  actual: string,
): PackageSavedOutputComparison["firstDifference"] {
  let offset = 0;
  while (
    offset < expected.length &&
    offset < actual.length &&
    expected[offset] === actual[offset]
  ) {
    offset += 1;
  }
  if (offset === expected.length && offset === actual.length) return null;
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (expected[index] === "\r") {
      line += 1;
      column = 1;
      if (index + 1 < offset && expected[index + 1] === "\n") index += 1;
    } else if (expected[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return {
    offset,
    line,
    column,
    expected: expected[offset] ?? null,
    actual: actual[offset] ?? null,
    expectedExcerpt: expected.slice(Math.max(0, offset - 24), offset + 24),
    actualExcerpt: actual.slice(Math.max(0, offset - 24), offset + 24),
  };
}
