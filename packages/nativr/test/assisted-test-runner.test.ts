import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

import {
  readOwnedRunnerBundle,
  readOwnedRunnerSuite,
} from "../../../scripts/lib/assisted-test-runner/bundle.mjs";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
interface OwnedCoreCase {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}
interface OwnedCoreDocument {
  readonly kind: string;
  readonly schemaVersion: number;
  readonly ownedContractOnly: boolean;
  readonly normativeTierCredit: boolean;
  readonly cases: readonly OwnedCoreCase[];
}
const document = JSON.parse(
  await readFile(
    new URL(
      "../../../testing/nativr-test-runner/fixtures/core-contract-cases.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as OwnedCoreDocument;
const runner = await readOwnedRunnerBundle();

it("pins the distinct owned bundle and fixture inventory without native compatibility credit", async () => {
  expect(document.kind).toBe("nativr-owned-runner-contract-cases");
  expect(document.schemaVersion).toBe(1);
  expect(document.ownedContractOnly).toBe(true);
  expect(document.normativeTierCredit).toBe(false);
  expect(document.cases).toHaveLength(28);
  expect(new Set(document.cases.map((row) => row.id)).size).toBe(28);
  expect(runner.bundle.description).toContain("Package: nativrTest\nVersion: 0.1.0\n");
  expect(runner.supportManifest.hasCompleteNativeParity).toBe(false);
  expect(runner.supportManifest.normativeTierCredit).toBe(false);
  const suite = await readOwnedRunnerSuite("core");
  expect(suite.fixtures).toHaveLength(9);
  expect(suite.fixtures.every((fixture) => /^[0-9a-f]{64}$/.test(fixture.sha256))).toBe(true);
});

// These are owned runner-contract checks, not original testthat dependency execution.
it.each(document.cases)("owned assisted runner: $name", async ({ code }) => {
  const runtime = await createR({
    execution: "inline",
    assets,
    packages: [runner.bundle],
    runtimeProfile: "package-test",
  });
  try {
    await runtime.eval("library(nativrTest)");
    const result = await runtime.evalDetailed(code);
    expect(result.value).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.topLevelErrors).toEqual([]);
    expect(result.output).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});
