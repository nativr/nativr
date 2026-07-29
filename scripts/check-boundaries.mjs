import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const rules = new Map([
  ["ast", new Set()],
  ["parser", new Set(["@nativr/ast"])],
  ["runtime", new Set(["@nativr/ast"])],
  ["base", new Set(["@nativr/ast", "@nativr/runtime"])],
  ["protocol", new Set()],
  [
    "nativr",
    new Set([
      "@nativr/ast",
      "@nativr/parser",
      "@nativr/runtime",
      "@nativr/base",
      "@nativr/protocol",
    ]),
  ],
]);
const failures = [];

for (const [packageName, allowed] of rules) {
  const files = await sourceFiles(path.join(root, "packages", packageName, "src"));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*\()(["'])(@nativr\/[^"']+)\1/gu)) {
      const dependency = match[2];
      if (dependency !== undefined && !allowed.has(dependency)) {
        failures.push(`${path.relative(root, file)} imports prohibited dependency ${dependency}`);
      }
    }
    if (packageName !== "nativr" && /(?:from\s+|import\s*\()(["'])nativr\1/gu.test(source)) {
      failures.push(`${path.relative(root, file)} imports the public nativr package`);
    }
  }
}

const playgroundFiles = await sourceFiles(path.join(root, "apps", "playground", "src"));
for (const file of playgroundFiles) {
  const source = await readFile(file, "utf8");
  if (/@nativr\//u.test(source)) {
    failures.push(`${path.relative(root, file)} bypasses the public nativr package`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Package dependency boundaries: passed");
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(resolved)));
    else if (entry.isFile() && resolved.endsWith(".ts")) files.push(resolved);
  }
  return files;
}
