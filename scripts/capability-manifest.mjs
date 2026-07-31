import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = path.join(root, "docs", "compatibility-manifest.json");
const distribution = path.join(root, "packages", "nativr", "dist");
const { createR } = await import(pathToFileURL(path.join(distribution, "index.js")).href);
const assetRoot = path.join(distribution, "assets");
const runtimeWasm = await readFile(path.join(assetRoot, "web-tree-sitter.wasm"));
const grammarWasm = await readFile(path.join(assetRoot, "tree-sitter-r.wasm"));
const bundledEntry = (await readFile(path.join(distribution, "index.js"), "utf8")).includes(
  "./chunks/",
);
const runtime = await createR({
  execution: "inline",
  assets: {
    treeSitterRuntimeWasm: bundledEntry
      ? new URL(`data:application/wasm;base64,${runtimeWasm.toString("base64")}`)
      : pathToFileURL(path.join(assetRoot, "web-tree-sitter.wasm")),
    rGrammarWasm: bundledEntry
      ? new URL(`data:application/wasm;base64,${grammarWasm.toString("base64")}`)
      : pathToFileURL(path.join(assetRoot, "tree-sitter-r.wasm")),
  },
});
const capabilities = await runtime.capabilities();
await runtime.dispose();
const expected = await format(JSON.stringify(capabilities), {
  ...prettierOptions,
  filepath: manifestPath,
});

if (process.argv.includes("--check")) {
  const actual = await readFile(manifestPath, "utf8");
  if (actual !== expected) {
    throw new Error('docs/compatibility-manifest.json is stale. Run "pnpm capabilities:render".');
  }
  console.log("Capability manifest matches the runtime capability source.");
} else {
  await writeFile(manifestPath, expected);
  console.log("Rendered docs/compatibility-manifest.json from the runtime capability source.");
}
