import { lstat, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { x as extractTar } from "tar";

import type { PackagePackLimits } from "./types.js";

export interface PackageSourceFile {
  readonly path: string;
  readonly data: Uint8Array;
}

const IGNORED_DIRECTORY_NAMES = new Set([".git", ".svn", ".Rproj.user", "node_modules"]);

export async function readPackageSource(
  source: string | URL,
  limits: PackagePackLimits,
): Promise<readonly PackageSourceFile[]> {
  const sourcePath = path.resolve(source instanceof URL ? fileURLToPath(source) : source);
  const sourceStat = await stat(sourcePath);
  if (sourceStat.isDirectory()) return readPackageDirectory(sourcePath, limits);
  if (!sourceStat.isFile())
    throw new Error(`Package source '${sourcePath}' is not a file or directory.`);
  return readPackageArchive(sourcePath, limits);
}

async function readPackageArchive(
  archivePath: string,
  limits: PackagePackLimits,
): Promise<readonly PackageSourceFile[]> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-package-"));
  let totalBytes = 0;
  let fileCount = 0;
  const paths = new Set<string>();
  const portablePaths = new Set<string>();
  let archiveError: Error | undefined;
  try {
    await extractTar({
      file: archivePath,
      cwd: temporaryRoot,
      strict: true,
      preservePaths: false,
      filter: (entryPath, entry) => {
        if (archiveError !== undefined) return false;
        try {
          const normalized = validateArchivePath(entryPath, limits.maxPathDepth);
          if (!("type" in entry)) throw new Error(`Archive entry '${normalized}' lacks a type.`);
          if (entry.type === "Directory") return true;
          if (entry.type !== "File" && entry.type !== "OldFile") {
            throw new Error(`Archive entry '${normalized}' has unsupported type '${entry.type}'.`);
          }
          if (paths.has(normalized) || portablePaths.has(normalized.toLowerCase())) {
            throw new Error(`Archive repeats a case-insensitive path '${normalized}'.`);
          }
          if (entry.size > limits.maxFileBytes) {
            throw new Error(`Archive entry '${normalized}' exceeds the per-file byte limit.`);
          }
          fileCount += 1;
          totalBytes += entry.size;
          if (fileCount > limits.maxFiles || totalBytes > limits.maxTotalBytes) {
            throw new Error("Package archive exceeds configured file or byte limits.");
          }
          paths.add(normalized);
          portablePaths.add(normalized.toLowerCase());
          return true;
        } catch (error) {
          archiveError = error instanceof Error ? error : new Error(String(error));
          return false;
        }
      },
    });
    if (archiveError !== undefined) throw archiveError;
    const root = await locateExtractedPackageRoot(temporaryRoot);
    return await readPackageDirectory(root, limits);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function locateExtractedPackageRoot(temporaryRoot: string): Promise<string> {
  try {
    if ((await stat(path.join(temporaryRoot, "DESCRIPTION"))).isFile()) return temporaryRoot;
  } catch {
    // Continue with the normal single-wrapper-directory source archive shape.
  }
  const candidates: string[] = [];
  for (const entry of await readdir(temporaryRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(temporaryRoot, entry.name);
    try {
      if ((await stat(path.join(candidate, "DESCRIPTION"))).isFile()) candidates.push(candidate);
    } catch {
      // Not a package root.
    }
  }
  if (candidates.length !== 1) {
    throw new Error("Package archive must contain exactly one root with DESCRIPTION.");
  }
  return candidates[0] ?? temporaryRoot;
}

async function readPackageDirectory(
  root: string,
  limits: PackagePackLimits,
): Promise<readonly PackageSourceFile[]> {
  const files: PackageSourceFile[] = [];
  const portablePaths = new Set<string>();
  let totalBytes = 0;
  await visit(root, "");
  return files.sort((left, right) => left.path.localeCompare(right.path, "en"));

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new Error(
          `Package source contains symbolic link '${joinRelative(relativeDirectory, entry.name)}'.`,
        );
      }
      const relativePath = joinRelative(relativeDirectory, entry.name);
      const depth = relativePath.split("/").length;
      if (depth > limits.maxPathDepth)
        throw new Error(`Package path '${relativePath}' is too deep.`);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORY_NAMES.has(entry.name)) await visit(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) throw new Error(`Package path '${relativePath}' is not a regular file.`);
      const portablePath = relativePath.toLowerCase();
      if (portablePaths.has(portablePath)) {
        throw new Error(`Package repeats a case-insensitive path '${relativePath}'.`);
      }
      portablePaths.add(portablePath);
      const fileStat = await lstat(absolutePath);
      if (fileStat.size > limits.maxFileBytes) {
        throw new Error(`Package file '${relativePath}' exceeds the per-file byte limit.`);
      }
      totalBytes += fileStat.size;
      if (files.length + 1 > limits.maxFiles || totalBytes > limits.maxTotalBytes) {
        throw new Error("Package source exceeds configured file or byte limits.");
      }
      files.push({ path: relativePath, data: await readFile(absolutePath) });
    }
  }
}

function validateArchivePath(value: string, maxDepth: number): string {
  if (
    value.includes("\\") ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0)!;
      return codePoint <= 0x1f || codePoint === 0x7f;
    }) ||
    /^[A-Za-z]:/u.test(value) ||
    path.posix.isAbsolute(value)
  ) {
    throw new Error(`Unsafe archive path '${value}'.`);
  }
  const normalized = value.replace(/^\.\//u, "").replace(/\/$/u, "");
  const parts = normalized.split("/");
  if (
    normalized.length === 0 ||
    parts.length > maxDepth + 1 ||
    parts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe archive path '${value}'.`);
  }
  return normalized;
}

function joinRelative(directory: string, name: string): string {
  return directory.length === 0 ? name : `${directory}/${name}`;
}
