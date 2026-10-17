import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cases = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "foundation.json"), "utf8"),
);
const packageCases = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "package-loader.json"), "utf8"),
);
const modulePath = path.join(root, "packages", "nativr", "dist", "index.js");
const { createR, isNA } = await import(pathToFileURL(modulePath).href);
const assetRoot = path.join(root, "packages", "nativr", "dist", "assets");
const runtimeWasm = await readFile(path.join(assetRoot, "web-tree-sitter.wasm"));
const grammarWasm = await readFile(path.join(assetRoot, "tree-sitter-r.wasm"));
const bundledEntry = (await readFile(modulePath, "utf8")).includes("./chunks/");
const assets = {
  treeSitterRuntimeWasm: bundledEntry
    ? new URL(`data:application/wasm;base64,${runtimeWasm.toString("base64")}`)
    : pathToFileURL(path.join(assetRoot, "web-tree-sitter.wasm")),
  rGrammarWasm: bundledEntry
    ? new URL(`data:application/wasm;base64,${grammarWasm.toString("base64")}`)
    : pathToFileURL(path.join(assetRoot, "tree-sitter-r.wasm")),
};
const runtime = await createR({ execution: "inline", assets });
let failures = 0;

for (const testCase of cases) {
  await runtime.reset();
  try {
    const result = await runtime.evalDetailed(testCase.code);
    if (testCase.expectedError !== undefined) {
      failures += 1;
      console.error(
        `FAIL ${testCase.id}: expected ${testCase.expectedError.code}, evaluation completed`,
      );
    } else if (!checkValue(testCase, result)) failures += 1;
  } catch (error) {
    if (
      testCase.expectedError !== undefined &&
      error?.code === testCase.expectedError.code &&
      (testCase.expectedError.messageIncludes === undefined ||
        String(error.message).includes(testCase.expectedError.messageIncludes))
    )
      console.log(`PASS ${testCase.id}`);
    else {
      failures += 1;
      console.error(
        `FAIL ${testCase.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

await runtime.dispose();
for (const testCase of packageCases) {
  let isolated;
  let result;
  let evaluationError;
  let disposalError;
  try {
    isolated = await createR({ execution: "inline", assets, packages: testCase.packages });
    result = await isolated.evalDetailed(testCase.code);
  } catch (error) {
    evaluationError = error;
  } finally {
    try {
      await isolated?.dispose();
    } catch (error) {
      disposalError = error;
    }
  }

  if (disposalError !== undefined) {
    failures += 1;
    console.error(`FAIL ${testCase.id}: package session disposal failed: ${String(disposalError)}`);
    continue;
  }
  if (testCase.expectedError !== undefined) {
    const actualCode = evaluationError?.code;
    const actualMessage = evaluationError instanceof Error ? evaluationError.message : "";
    if (
      actualCode === testCase.expectedError.code &&
      (testCase.expectedError.messageIncludes === undefined ||
        actualMessage.includes(testCase.expectedError.messageIncludes))
    ) {
      console.log(`PASS ${testCase.id}`);
    } else {
      failures += 1;
      console.error(
        `FAIL ${testCase.id}: expected error ${JSON.stringify(testCase.expectedError)}, received ${evaluationError === undefined ? JSON.stringify(result?.value) : String(evaluationError)}`,
      );
    }
  } else if (evaluationError !== undefined) {
    failures += 1;
    console.error(`FAIL ${testCase.id}: ${String(evaluationError)}`);
  } else if (!checkValue(testCase, result)) {
    failures += 1;
  }
}

if (failures > 0) process.exitCode = 1;
else {
  const total = cases.length + packageCases.length;
  console.log(`Checked-in conformance: ${total}/${total} passed`);
}

function checkValue(testCase, result) {
  const actual = canonical(result.value, isNA);
  const expected = canonical(testCase.expected, isNA);
  const warningMatches =
    testCase.expectedWarning === undefined ||
    testCase.expectedWarning === result.warnings.length > 0;
  const output = result.output.map((event) => event.text).join("");
  const outputMatches = testCase.expectedOutput === undefined || testCase.expectedOutput === output;
  const visibilityMatches =
    testCase.expectedVisible === undefined || testCase.expectedVisible === result.visible;
  if (
    !deepEqual(actual, expected, testCase.tolerance) ||
    !warningMatches ||
    !outputMatches ||
    !visibilityMatches
  ) {
    console.error(
      `FAIL ${testCase.id}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}; output ${JSON.stringify(output)}; visible ${String(result.visible)}`,
    );
    return false;
  }
  console.log(`PASS ${testCase.id}`);
  return true;
}

function canonical(value, markerTest) {
  if (markerTest(value) || value?.__nativr__ === "NA") return "NA";
  if (typeof value === "number" && Number.isNaN(value)) return "NaN";
  if (Array.isArray(value)) return value.map((item) => canonical(item, markerTest));
  return value;
}

function deepEqual(left, right, tolerance = { absolute: 0, relative: 0 }) {
  if (typeof left === "number" && typeof right === "number") {
    if (Object.is(left, right)) return true;
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    return (
      Math.abs(left - right) <=
      tolerance.absolute + tolerance.relative * Math.max(Math.abs(left), Math.abs(right))
    );
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index], tolerance))
    );
  }
  return JSON.stringify(left) === JSON.stringify(right);
}
