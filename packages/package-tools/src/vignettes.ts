import type { PackageSourceFile } from "./source.js";

export const PACKAGE_VIGNETTES_RESOURCE_PATH = ".nativr/vignettes-v1.json";

export interface PackageVignetteEntry {
  readonly topic: string;
  readonly title: string;
  readonly file: string;
  readonly r: string;
  readonly output: string;
}

export interface PackageVignettesManifest {
  readonly format: "nativr-package-vignettes";
  readonly formatVersion: 1;
  readonly vignettes: readonly PackageVignetteEntry[];
}

const VIGNETTE_SOURCE_SUFFIXES = Object.freeze([
  ".pdf.asis",
  ".html.asis",
  ".Rmd",
  ".rmd",
  ".Rnw",
  ".rnw",
  ".Snw",
  ".snw",
  ".tex",
]);

/** Build the installed vignette index from source-package inst/doc files. */
export function extractPackageVignettes(
  files: readonly PackageSourceFile[],
  decode: (file: PackageSourceFile) => string,
): PackageVignettesManifest | undefined {
  const docs = files
    .filter((file) => /^inst\/doc\/[^/]+$/u.test(file.path))
    .sort((left, right) => compareCPath(left.path, right.path));
  const byName = new Map(docs.map((file) => [file.path.slice("inst/doc/".length), file]));
  const entries: PackageVignetteEntry[] = [];
  const seen = new Set<string>();
  for (const file of docs) {
    const name = file.path.slice("inst/doc/".length);
    const suffix = VIGNETTE_SOURCE_SUFFIXES.find((candidate) => name.endsWith(candidate));
    if (suffix === undefined) continue;
    const topic = name.slice(0, -suffix.length);
    if (topic.length === 0 || seen.has(topic)) continue;
    seen.add(topic);
    const source = decode(file);
    const r = byName.has(`${topic}.R`) ? `${topic}.R` : "";
    const output =
      [`${topic}.html`, `${topic}.pdf`].find((candidate) => byName.has(candidate)) ?? "";
    entries.push({
      topic,
      title: vignetteTitle(source, topic),
      file: name,
      r,
      output,
    });
  }
  if (entries.length === 0) return undefined;
  entries.sort((left, right) => {
    const title = compareCPath(left.title, right.title);
    return title === 0 ? compareCPath(left.topic, right.topic) : title;
  });
  return Object.freeze({
    format: "nativr-package-vignettes",
    formatVersion: 1,
    vignettes: Object.freeze(entries.map((entry) => Object.freeze(entry))),
  });
}

function vignetteTitle(source: string, fallback: string): string {
  const indexEntry = /\\VignetteIndexEntry\{([^}\r\n]+)\}/u.exec(source)?.[1]?.trim();
  if (indexEntry !== undefined && indexEntry.length > 0) return indexEntry;
  const yaml = yamlTitle(source);
  if (yaml !== undefined) return yaml;
  const html = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/iu.exec(source)?.[1];
  if (html !== undefined) {
    const title = decodeHtmlEntities(
      html
        .replace(/<[^>]*>/gu, " ")
        .replace(/\s+/gu, " ")
        .trim(),
    );
    if (title.length > 0) return title;
  }
  return fallback;
}

function yamlTitle(source: string): string | undefined {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  if (lines[0]?.trim() !== "---") return undefined;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "---" || line.trim() === "...") return undefined;
    const match = /^title\s*:\s*(.*)$/iu.exec(line);
    if (match === null) continue;
    const value = match[1]?.trim() ?? "";
    if (value === ">" || value === "|") {
      const pieces: string[] = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const continuation = lines[cursor] ?? "";
        if (!/^\s+/u.test(continuation)) break;
        pieces.push(continuation.trim());
      }
      const title = pieces.join(value === ">" ? " " : "\n").trim();
      return title.length === 0 ? undefined : title;
    }
    const title = stripYamlQuotes(value);
    return title.length === 0 ? undefined : title;
  }
  return undefined;
}

function stripYamlQuotes(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first !== '"' && first !== "'") || last !== first) return value;
  const body = value.slice(1, -1);
  return first === '"'
    ? body.replace(/\\([\\"nrt])/gu, (_match, escaped: string) => {
        if (escaped === "n") return "\n";
        if (escaped === "r") return "\r";
        if (escaped === "t") return "\t";
        return escaped;
      })
    : body.replaceAll("''", "'");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function compareCPath(left: string, right: string): number {
  return Buffer.from(left).compare(Buffer.from(right));
}
