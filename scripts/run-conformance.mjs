import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cases = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "foundation.json"), "utf8"),
);
const modulePath = path.join(root, "packages", "nativr", "dist", "index.js");
const { createR, isNA } = await import(pathToFileURL(modulePath).href);
const assetRoot = path.join(root, "packages", "nativr", "dist", "assets");
const runtimeWasm = await readFile(path.join(assetRoot, "web-tree-sitter.wasm"));
const grammarWasm = await readFile(path.join(assetRoot, "tree-sitter-r.wasm"));
const bundledEntry = (await readFile(modulePath, "utf8")).includes("./chunks/");
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
let failures = 0;

for (const testCase of cases) {
  await runtime.reset();
  try {
    const result = await runtime.evalDetailed(testCase.code);
    const actual = canonical(result.value, isNA);
    const expected = canonical(testCase.expected, isNA);
    const warningMatches =
      testCase.expectedWarning === undefined ||
      testCase.expectedWarning === result.warnings.length > 0;
    const output = result.output.map((event) => event.text).join("");
    const outputMatches =
      testCase.expectedOutput === undefined || testCase.expectedOutput === output;
    const visibilityMatches =
      testCase.expectedVisible === undefined || testCase.expectedVisible === result.visible;
    if (!deepEqual(actual, expected) || !warningMatches || !outputMatches || !visibilityMatches) {
      failures += 1;
      console.error(
        `FAIL ${testCase.id}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}; output ${JSON.stringify(output)}; visible ${String(result.visible)}`,
      );
    } else {
      console.log(`PASS ${testCase.id}`);
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${testCase.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await runtime.dispose();
if (failures > 0) process.exitCode = 1;
else console.log(`Checked-in conformance: ${cases.length}/${cases.length} passed`);

function canonical(value, markerTest) {
  if (markerTest(value) || value?.__nativr__ === "NA") return "NA";
  if (typeof value === "number" && Number.isNaN(value)) return "NaN";
  if (Array.isArray(value)) return value.map((item) => canonical(item, markerTest));
  return value;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
