import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = path.join(root, "packages", "nativr", "dist");
const clientFiles = await staticModuleGraph(path.join(dist, "index.js"));
const clientGzip = await compressedTotal(clientFiles);
const assetFiles = await readdir(path.join(dist, "assets"));
const workerName = assetFiles.find((file) => /^worker-entry-[A-Za-z0-9_-]+\.js$/u.test(file));
if (workerName === undefined) throw new Error("Built Worker entry was not found.");
const workerFile = path.join(dist, "assets", workerName);
const workerGzip = gzipSync(await readFile(workerFile), { level: 9 }).length;
const wasmFiles = [
  path.join(dist, "assets", "web-tree-sitter.wasm"),
  path.join(dist, "assets", "tree-sitter-r.wasm"),
];
const wasmRaw = await rawTotal(wasmFiles);
const budgets = [
  ["statically loaded public client", clientGzip, 150 * 1024, "gzip"],
  ["Worker JavaScript", workerGzip, 734 * 1024, "gzip"],
  ["combined parser Wasm", wasmRaw, 1.5 * 1024 * 1024, "raw"],
];
let failed = false;

for (const [label, measured, budget, mode] of budgets) {
  const status = measured <= budget ? "PASS" : "FAIL";
  console.log(`${status} ${label}: ${format(measured)} / ${format(budget)} ${mode}`);
  if (measured > budget) failed = true;
}
console.log(
  `Client static modules: ${clientFiles.map((file) => path.relative(dist, file)).join(", ")}`,
);
if (failed) process.exitCode = 1;

async function staticModuleGraph(entry) {
  const seen = new Set();
  async function visit(file) {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    const source = await readFile(resolved, "utf8");
    const patterns = [/(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/gu];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        if (specifier?.startsWith("."))
          await visit(path.resolve(path.dirname(resolved), specifier));
      }
    }
  }
  await visit(entry);
  return [...seen];
}

async function compressedTotal(files) {
  let total = 0;
  for (const file of files) total += gzipSync(await readFile(file), { level: 9 }).length;
  return total;
}

async function rawTotal(files) {
  let total = 0;
  for (const file of files) total += (await stat(file)).size;
  return total;
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
