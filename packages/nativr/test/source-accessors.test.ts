import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../../../compatibility/platform-evidence/source-accessors-baseline-0.403.0.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { cases: { id: string; code: string }[] };
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession;
beforeAll(async () => {
  runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000000, maxCallDepth: 128, maxVectorLength: 10000, maxOutputBytes: 65536 },
  });
});
afterAll(async () => runtime.dispose());

// Independently authored native-TRUE inputs frozen before implementation on clean 0.403.
it.each(fixture.cases)("source accessor: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.visible).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.output).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
});
