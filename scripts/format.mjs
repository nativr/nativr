import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const mode = process.argv[2] === "--write" ? "--write" : "--check";
const extensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const ignoredDirectoryNames = new Set([
  ".git",
  ".pnpm-store",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const ignoredDirectories = new Set(
  ["apps/playground/public/assets", "packages/nativr/src/assets", "packages/parser/assets"].map(
    normalizeRelativePath,
  ),
);
const ignoredFiles = new Set(["pnpm-lock.yaml"]);
const sourceFiles = [];

await collectSourceFiles(root);
sourceFiles.sort();

const changedFiles = [];
for (const sourceFile of sourceFiles) {
  const absolutePath = path.join(root, sourceFile);
  const current = await readFile(absolutePath, "utf8");
  const formatted = await format(current, {
    ...prettierOptions,
    filepath: absolutePath,
  });
  if (formatted === current) continue;
  changedFiles.push(sourceFile);
  if (mode === "--write") await writeFile(absolutePath, formatted);
}

if (changedFiles.length > 0 && mode === "--check") {
  console.error(`Formatting differs in:\n${changedFiles.map((file) => `- ${file}`).join("\n")}`);
  process.exitCode = 1;
} else if (mode === "--write") {
  console.log(`Formatted ${changedFiles.length} of ${sourceFiles.length} source files.`);
} else {
  console.log(`Formatting check passed for ${sourceFiles.length} source files.`);
}

async function collectSourceFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolutePath = path.join(directory, entry.name);
    const relativePath = normalizeRelativePath(path.relative(root, absolutePath));
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name) || ignoredDirectories.has(relativePath)) {
        continue;
      }
      await collectSourceFiles(absolutePath);
      continue;
    }
    if (!ignoredFiles.has(relativePath) && extensions.has(path.extname(entry.name).toLowerCase())) {
      sourceFiles.push(relativePath);
    }
  }
}

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/");
}
