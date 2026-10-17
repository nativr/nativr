import { expect, it } from "vitest";

import { comparePackageSavedOutput, type PackageTestScript } from "../src/index.js";

it("removes only source-matched Rout prompts and retains prompt-shaped user output", () => {
  const script: PackageTestScript = {
    path: "tests/probe.R",
    source: 'cat("> user\\n")\nx <- c(\n  1,\n  2\n)\n',
    expectedOutput: {
      path: "tests/probe.Rout.save",
      source: '> cat("> user\\n")\n> user\n> x <- c(\n+   1,\n+   2\n+ )\n[1] 3\n',
    },
  };
  const result = comparePackageSavedOutput(script, "> user\n[1] 3\n", {
    policyVersion: 1,
    expectedFormat: "rout-save-source-echo",
    comparison: "exact-text",
  });
  expect(result).toMatchObject({
    schemaVersion: 1,
    policyVersion: 1,
    outcome: "match",
    sourceEchoLinesRemoved: 5,
    firstDifference: null,
  });
});

it.each([
  { expected: "a\rb", actual: "a\rc", expectedCharacter: "b", actualCharacter: "c" },
  { expected: "a\r\nb", actual: "a\r\nc", expectedCharacter: "b", actualCharacter: "c" },
  { expected: "a\r\nb", actual: "a\rXb", expectedCharacter: "\n", actualCharacter: "X" },
])("locates the first difference after CR-only and CRLF boundaries", (entry) => {
  const script: PackageTestScript = {
    path: "tests/newline.R",
    source: "",
    expectedOutput: { path: "tests/newline.Rout.save", source: entry.expected },
  };
  expect(
    comparePackageSavedOutput(script, entry.actual, {
      policyVersion: 1,
      expectedFormat: "display-only",
      comparison: "exact-text",
    }),
  ).toMatchObject({
    outcome: "mismatch",
    firstDifference: {
      line: 2,
      column: 1,
      expected: entry.expectedCharacter,
      actual: entry.actualCharacter,
    },
  });
});

it("keeps exact text differences distinct from display-whitespace diagnostics", () => {
  const script: PackageTestScript = {
    path: "tests/spacing.R",
    source: "1:2\n",
    expectedOutput: {
      path: "tests/spacing.Rout.save",
      source: "> 1:2\r\n[1] 1  2\r\n\r\n",
    },
  };
  const exact = comparePackageSavedOutput(script, "[1] 1 2\n", {
    policyVersion: 1,
    expectedFormat: "rout-save-source-echo",
    comparison: "exact-text",
  });
  expect(exact).toMatchObject({
    outcome: "mismatch",
    sourceEchoLinesRemoved: 1,
    firstDifference: { line: 1, column: 7, expected: " ", actual: "2" },
  });
  const diagnostic = comparePackageSavedOutput(script, "[1] 1 2\n", {
    policyVersion: 1,
    expectedFormat: "rout-save-source-echo",
    comparison: "display-whitespace",
  });
  expect(diagnostic).toMatchObject({ outcome: "match", firstDifference: null });
});

it("keeps a bare user-output marker before the final Rout prompt", () => {
  const script: PackageTestScript = {
    path: "tests/marker.R",
    source: 'cat(">\\n")\n',
    expectedOutput: {
      path: "tests/marker.Rout.save",
      source: '> cat(">\\n")\r\n>\r\n>\r\n',
    },
  };
  expect(
    comparePackageSavedOutput(script, ">\r\n", {
      policyVersion: 1,
      expectedFormat: "rout-save-source-echo",
      comparison: "exact-text",
    }),
  ).toMatchObject({ outcome: "match", sourceEchoLinesRemoved: 2 });
});

it("preserves printed Unicode and non-horizontal control content during whitespace diagnostics", () => {
  for (const content of ["\u00a0", "\ufeff", "\u2028", "\v", "\f"]) {
    const script: PackageTestScript = {
      path: "tests/content.R",
      source: "",
      expectedOutput: { path: "tests/content.Rout.save", source: ` \t${content}\t \r\n` },
    };
    const options = {
      policyVersion: 1,
      expectedFormat: "display-only",
      comparison: "display-whitespace",
    } as const;
    expect(comparePackageSavedOutput(script, content, options)).toMatchObject({
      outcome: "match",
      firstDifference: null,
    });
    expect(comparePackageSavedOutput(script, "", options)).toMatchObject({
      outcome: "mismatch",
      firstDifference: { offset: 0, expected: content, actual: null },
    });
  }
});

it("requires an explicit saved format and distinguishes absent expectations", () => {
  const script: PackageTestScript = { path: "tests/none.R", source: 'cat("> visible\\n")' };
  expect(
    comparePackageSavedOutput(script, "> visible\n", {
      policyVersion: 1,
      expectedFormat: "display-only",
      comparison: "exact-text",
    }),
  ).toMatchObject({ outcome: "no-expectation", expectedPath: null });
  expect(() =>
    comparePackageSavedOutput(script, "", {
      policyVersion: 1,
      expectedFormat: "unknown" as never,
      comparison: "exact-text",
    }),
  ).toThrow("expectedFormat must be explicit");
  expect(() =>
    comparePackageSavedOutput(script, "", {
      policyVersion: 2 as never,
      expectedFormat: "display-only",
      comparison: "exact-text",
    }),
  ).toThrow("policyVersion must be 1");
});

it("bounds the number of comparison lines before splitting text", () => {
  expect(() =>
    comparePackageSavedOutput({ path: "tests/large.R", source: "\n".repeat(250_000) }, "", {
      policyVersion: 1,
      expectedFormat: "display-only",
      comparison: "exact-text",
    }),
  ).toThrow("250000-line limit");
});
