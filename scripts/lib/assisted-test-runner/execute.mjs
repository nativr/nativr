import { readFile } from "node:fs/promises";
import { createR } from "../../../packages/nativr/dist/index.js";
import { readOwnedRunnerBundle, readOwnedRunnerSuite } from "./bundle.mjs";
import { executeCapturedRun, prepareCapturedRun } from "./capture.mjs";
import { fixtureMetadata } from "./suite.mjs";

// Private bounded child. Only an allowlisted repository-owned suite can be selected.
try {
  if (process.argv.length !== 3 || process.argv[2] !== "core") throw new Error();
  const { bundle, runner } = await readOwnedRunnerBundle();
  const suite = await readOwnedRunnerSuite(process.argv[2]);
  const capabilities = JSON.parse(
    await readFile(new URL("../../../docs/compatibility-manifest.json", import.meta.url), "utf8"),
  );
  const assets = {};
  for (const [key, file] of [
    ["treeSitterRuntimeWasm", "web-tree-sitter.wasm"],
    ["rGrammarWasm", "tree-sitter-r.wasm"],
    ["elementaryWasm", "elementary.wasm"],
  ]) {
    const bytes = await readFile(
      new URL(`../../../packages/nativr/dist/assets/${file}`, import.meta.url),
    );
    assets[key] = new URL(`data:application/wasm;base64,${bytes.toString("base64")}`);
  }
  const results = [];
  for (const fixture of suite.fixtures) {
    const plan = prepareCapturedRun(
      fixtureMetadata(fixture, runner, capabilities),
      [{ path: fixture.path, source: fixture.source }],
      bundle,
      fixture.controls,
    );
    const result = await executeCapturedRun(plan, createR, assets);
    results.push(
      result.kind === "nativr-assisted-attempt-complete"
        ? { id: fixture.id, report: result.report }
        : { id: fixture.id, rejectionCode: result.code },
    );
  }
  console.log(
    JSON.stringify({ kind: "nativr-owned-assisted-suite-result", schemaVersion: 1, results }),
  );
} catch {
  // No raw exception or stack is a child protocol value.
  process.stderr.write("ASSISTED_CHILD_FAILED\n");
  process.exitCode = 1;
}
