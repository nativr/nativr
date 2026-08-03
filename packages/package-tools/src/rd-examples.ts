export const PACKAGE_EXAMPLES_RESOURCE_PATH = ".nativr/examples-v1.json";
export const PACKAGE_HELP_RESOURCE_PATH = ".nativr/help-v1.json";

export type PackageExampleBlockKind = "run" | "dontrun" | "donttest";

export interface PackageExampleBlock {
  readonly kind: PackageExampleBlockKind;
  readonly source: string;
}

export interface PackageExampleTopic {
  readonly name: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly blocks: readonly PackageExampleBlock[];
}

export interface PackageExamplesManifest {
  readonly format: "nativr-package-examples";
  readonly formatVersion: 1;
  readonly topics: readonly PackageExampleTopic[];
}

export interface PackageHelpSection {
  readonly name: string;
  readonly title: string;
  readonly text: string;
  readonly code: boolean;
}

export interface PackageHelpTopic {
  readonly name: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly sections: readonly PackageHelpSection[];
}

export interface PackageHelpManifest {
  readonly format: "nativr-package-help";
  readonly formatVersion: 1;
  readonly topics: readonly PackageHelpTopic[];
}

interface RdCommandBody {
  readonly body: string;
  readonly end: number;
}

/** Extract the documented Rd examples without invoking R or retaining an Rd parser at runtime. */
export function extractPackageExamples(
  files: readonly { readonly path: string; readonly source: string }[],
): PackageExamplesManifest | undefined {
  const topics = files
    .filter((file) => /^man\/(?:.*\/)?[^/]+\.Rd$/iu.test(file.path))
    .sort((left, right) => compareText(left.path, right.path))
    .flatMap((file) => extractRdTopic(file.source));
  if (topics.length === 0) return undefined;
  return Object.freeze({
    format: "nativr-package-examples",
    formatVersion: 1,
    topics: Object.freeze(topics),
  });
}

/** Index portable Rd topic metadata for runtime help discovery and browser-safe rendering. */
export function extractPackageHelp(
  files: readonly { readonly path: string; readonly source: string }[],
): PackageHelpManifest | undefined {
  const topics = files
    .filter((file) => /^man\/(?:.*\/)?[^/]+\.Rd$/iu.test(file.path))
    .sort((left, right) => compareText(left.path, right.path))
    .flatMap((file) => extractRdHelpTopic(file.source));
  if (topics.length === 0) return undefined;
  return Object.freeze({
    format: "nativr-package-help",
    formatVersion: 1,
    topics: Object.freeze(topics),
  });
}

const HELP_SECTIONS = Object.freeze([
  ["description", "Description", false],
  ["usage", "Usage", true],
  ["arguments", "Arguments", false],
  ["details", "Details", false],
  ["value", "Value", false],
  ["note", "Note", false],
  ["references", "References", false],
  ["seealso", "See also", false],
  ["examples", "Examples", true],
] as const);

function extractRdHelpTopic(source: string): readonly PackageHelpTopic[] {
  const metadata = rdTopicMetadata(source);
  if (metadata === undefined) return [];
  const sections = HELP_SECTIONS.flatMap(([name, title, code]) => {
    const text = rdCommandBodies(source, name)
      .map((entry) => normalizeHelpText(decodeRdText(entry.body), code))
      .filter((entry) => entry.length > 0)
      .join(code ? "\n\n" : "\n");
    return text.length === 0 ? [] : [{ name, title, text, code }];
  });
  return [
    Object.freeze({
      ...metadata,
      sections: Object.freeze(sections.map((section) => Object.freeze(section))),
    }),
  ];
}

function extractRdTopic(source: string): readonly PackageExampleTopic[] {
  const examples = rdCommandBodies(source, "examples");
  if (examples.length === 0) return [];
  const metadata = rdTopicMetadata(source);
  if (metadata === undefined) return [];
  const blocks = examples.flatMap((entry) => parseExampleBlocks(entry.body, "run"));
  return [
    Object.freeze({
      ...metadata,
      blocks: Object.freeze(mergeBlocks(blocks)),
    }),
  ];
}

function rdTopicMetadata(
  source: string,
): Pick<PackageHelpTopic, "name" | "title" | "aliases"> | undefined {
  const name = decodeRdText(rdCommandBodies(source, "name")[0]?.body ?? "").trim();
  if (name.length === 0) return undefined;
  const title = normalizeHelpText(
    decodeRdText(rdCommandBodies(source, "title")[0]?.body ?? ""),
    false,
  );
  const aliases = uniqueText([
    name,
    ...rdCommandBodies(source, "alias").map((entry) => decodeRdText(entry.body).trim()),
  ]).filter((alias) => alias.length > 0);
  return Object.freeze({ name, title, aliases: Object.freeze(aliases) });
}

function normalizeHelpText(source: string, code: boolean): string {
  const normalized = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  return code ? normalized : normalized.replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n");
}

function rdCommandBodies(source: string, command: string): readonly RdCommandBody[] {
  const results: RdCommandBody[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "\\" || source[index + 1] === "\\") continue;
    const parsed = parseCommandAt(source, index);
    if (parsed?.name === command && parsed.body !== undefined) results.push(parsed.body);
    if (parsed?.body !== undefined) index = parsed.body.end - 1;
  }
  return results;
}

function parseExampleBlocks(
  source: string,
  inheritedKind: PackageExampleBlockKind,
): readonly PackageExampleBlock[] {
  const blocks: PackageExampleBlock[] = [];
  let text = "";
  const flush = (): void => {
    if (text.length > 0) blocks.push({ kind: inheritedKind, source: text });
    text = "";
  };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (character !== "\\") {
      text += character;
      continue;
    }
    const escaped = rdEscape(source[index + 1]);
    if (escaped !== undefined) {
      text += escaped;
      index += 1;
      continue;
    }
    const parsed = parseCommandAt(source, index);
    if (parsed === undefined) {
      text += character;
      continue;
    }
    if (parsed.name === "dots" || parsed.name === "ldots") {
      text += "...";
      index = parsed.end - 1;
      continue;
    }
    if (parsed.body === undefined) {
      text += source.slice(index, parsed.end);
      index = parsed.end - 1;
      continue;
    }
    flush();
    if (parsed.name === "out" || parsed.name === "Sexpr") {
      blocks.push({ kind: inheritedKind, source: commentRdExampleOutput(parsed.body.body) });
      index = parsed.body.end - 1;
      continue;
    }
    const kind =
      parsed.name === "dontrun"
        ? "dontrun"
        : parsed.name === "donttest"
          ? "donttest"
          : inheritedKind;
    blocks.push(...parseExampleBlocks(parsed.body.body, kind));
    index = parsed.body.end - 1;
  }
  flush();
  return mergeBlocks(blocks);
}

function decodeRdText(source: string): string {
  let result = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (character !== "\\") {
      result += character;
      continue;
    }
    const escaped = rdEscape(source[index + 1]);
    if (escaped !== undefined) {
      result += escaped;
      index += 1;
      continue;
    }
    const parsed = parseCommandAt(source, index);
    if (parsed === undefined) {
      result += character;
      continue;
    }
    if (parsed.name === "dots" || parsed.name === "ldots") result += "...";
    else if (parsed.body !== undefined) result += decodeRdText(parsed.body.body);
    else result += source.slice(index, parsed.end);
    index = parsed.end - 1;
  }
  return result;
}

function parseCommandAt(
  source: string,
  start: number,
):
  | {
      readonly name: string;
      readonly body?: RdCommandBody;
      readonly end: number;
    }
  | undefined {
  if (source[start] !== "\\" || !/[A-Za-z]/u.test(source[start + 1] ?? "")) return undefined;
  let cursor = start + 1;
  while (/[A-Za-z.]/u.test(source[cursor] ?? "")) cursor += 1;
  const name = source.slice(start + 1, cursor);
  while (source[cursor] === " " || source[cursor] === "\t") cursor += 1;
  if (source[cursor] !== "{") return { name, end: cursor };
  const bodyStart = cursor + 1;
  let depth = 1;
  cursor = bodyStart;
  while (cursor < source.length) {
    if (source[cursor] === "\\" && rdEscape(source[cursor + 1]) !== undefined) {
      cursor += 2;
      continue;
    }
    if (source[cursor] === "{") depth += 1;
    else if (source[cursor] === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          name,
          body: { body: source.slice(bodyStart, cursor), end: cursor + 1 },
          end: cursor + 1,
        };
      }
    }
    cursor += 1;
  }
  return { name, end: cursor };
}

function rdEscape(character: string | undefined): string | undefined {
  if (character === "\\") return "\\";
  if (character === "{") return "{";
  if (character === "}") return "}";
  if (character === "%") return "%";
  return undefined;
}

function commentRdExampleOutput(source: string): string {
  return source
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => `# ${line}`)
    .join("\n");
}

function mergeBlocks(blocks: readonly PackageExampleBlock[]): PackageExampleBlock[] {
  const merged: PackageExampleBlock[] = [];
  for (const block of blocks) {
    if (block.source.length === 0) continue;
    const previous = merged.at(-1);
    if (previous?.kind === block.kind) {
      merged[merged.length - 1] = { kind: block.kind, source: previous.source + block.source };
    } else {
      merged.push({ kind: block.kind, source: block.source });
    }
  }
  return merged;
}

function uniqueText(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
