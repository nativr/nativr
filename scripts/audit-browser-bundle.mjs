import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = path.join(root, "packages", "nativr", "dist");
const files = await javascriptFiles(dist);
const prohibited = [
  ['import("fs/promises")', "Node filesystem dynamic import"],
  ['import("module")', "Node module dynamic import"],
  ['from"node:', "Node built-in import"],
  ['from "node:', "Node built-in import"],
  ["eval(func)", "dynamic eval"],
  ["new Function(", "dynamic Function constructor"],
];
const failures = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const [needle, label] of prohibited) {
    if (source.includes(needle)) {
      failures.push(`${path.relative(root, file)} contains ${label}: ${needle}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Browser bundle audit: passed (${files.length} JavaScript files)`);
}

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await javascriptFiles(resolved)));
    else if (entry.isFile() && resolved.endsWith(".js")) files.push(resolved);
  }
  return files;
}
