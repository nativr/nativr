import type { PackageDependency, PackageDependencyKind } from "./types.js";

const PACKAGE_NAME = /^[A-Za-z](?:[A-Za-z0-9.]*[A-Za-z0-9])?$/u;
const VERSION = /^[0-9]+(?:[.-][0-9]+)*$/u;

export function parseDcf(source: string): ReadonlyMap<string, string> {
  const fields = new Map<string, string>();
  let current: string | undefined;
  for (const rawLine of source.replaceAll("\r\n", "\n").split("\n")) {
    if (/^[ \t]/u.test(rawLine)) {
      if (current === undefined) throw new Error("DESCRIPTION begins with a continuation line.");
      fields.set(current, `${fields.get(current) ?? ""} ${rawLine.trim()}`.trim());
      continue;
    }
    if (rawLine.trim().length === 0) continue;
    const separator = rawLine.indexOf(":");
    if (separator <= 0) throw new Error(`Malformed DESCRIPTION line '${rawLine}'.`);
    current = rawLine.slice(0, separator).trim();
    if (fields.has(current))
      throw new Error(`DESCRIPTION field '${current}' occurs more than once.`);
    fields.set(current, rawLine.slice(separator + 1).trim());
  }
  return fields;
}

export function parseDcfRecords(source: string): readonly ReadonlyMap<string, string>[] {
  const records: ReadonlyMap<string, string>[] = [];
  let lines: string[] = [];
  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    if (line.trim().length === 0 && lines.length > 0) {
      records.push(parseDcf(lines.join("\n")));
      lines = [];
    } else if (line.trim().length > 0 || lines.length > 0) {
      lines.push(line);
    }
  }
  if (lines.length > 0) records.push(parseDcf(lines.join("\n")));
  return records;
}

export function requiredDcfField(fields: ReadonlyMap<string, string>, name: string): string {
  const value = fields.get(name)?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`DESCRIPTION is missing '${name}'.`);
  }
  return value;
}

export function validatePackageIdentity(name: string, version: string): void {
  if (!PACKAGE_NAME.test(name)) throw new Error(`Invalid package name '${name}'.`);
  if (!VERSION.test(version)) throw new Error(`Invalid package version '${version}'.`);
}

export function parsePackageDependencies(fields: ReadonlyMap<string, string>): PackageDependency[] {
  const dependencies: PackageDependency[] = [];
  for (const kind of ["Depends", "Imports", "Suggests", "Enhances", "LinkingTo"] as const) {
    const value = fields.get(kind);
    if (value === undefined || value.trim().length === 0) continue;
    for (const entry of splitDependencyList(value)) dependencies.push(parseDependency(entry, kind));
  }
  return dependencies;
}

function splitDependencyList(value: string): readonly string[] {
  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      entries.push(value.slice(start, index).trim());
      start = index + 1;
    }
    if (depth < 0) throw new Error(`Malformed dependency field '${value}'.`);
  }
  if (depth !== 0) throw new Error(`Malformed dependency field '${value}'.`);
  entries.push(value.slice(start).trim());
  return entries.filter((entry) => entry.length > 0);
}

function parseDependency(entry: string, kind: PackageDependencyKind): PackageDependency {
  const match =
    /^([A-Za-z](?:[A-Za-z0-9.]*[A-Za-z0-9])?)(?:\s*\(\s*(>=|<=|==|>|<|!=)\s*([^\s)]+)\s*\))?$/u.exec(
      entry,
    );
  const name = match?.[1];
  if (name === undefined) throw new Error(`Malformed ${kind} dependency '${entry}'.`);
  const operator = match?.[2] as ">=" | "<=" | "==" | ">" | "<" | "!=" | undefined;
  const version = match?.[3];
  if (operator === undefined || version === undefined) return { name, kind };
  if (!VERSION.test(version)) throw new Error(`Malformed dependency version '${version}'.`);
  return { name, kind, constraint: { operator, version } };
}
