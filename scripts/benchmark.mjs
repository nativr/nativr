import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const { createR } = await import(
  pathToFileURL(path.join(root, "packages", "nativr", "dist", "index.js")).href
);
const assets = path.join(root, "packages", "nativr", "dist", "assets");
const runtime = await createR({
  execution: "inline",
  assets: {
    treeSitterRuntimeWasm: path.join(assets, "web-tree-sitter.wasm"),
    rGrammarWasm: path.join(assets, "tree-sitter-r.wasm"),
  },
});

await measure("parse + scalar evaluation", 100, async () => runtime.eval("1 + 1"));
await measure("100,000-element mean", 10, async () => {
  await runtime.assign("x", new Float64Array(100_000).fill(1.5));
  await runtime.eval("mean(x)");
});
await measure("typed-array assignment", 20, async () => {
  await runtime.assign("x", new Float64Array(100_000));
});
await measure("raw snapshot", 20, async () => {
  await runtime.evalRaw("x");
});
await runtime.dispose();

async function measure(label, iterations, operation) {
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) await operation();
  const elapsed = performance.now() - start;
  console.log(`${label}: ${(elapsed / iterations).toFixed(2)} ms/op (${iterations} iterations)`);
}
