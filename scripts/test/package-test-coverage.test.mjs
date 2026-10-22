import assert from "node:assert/strict";
import test from "node:test";
import {
  hasAdmissibleNestedTestCoverage,
  packageTestCoverageStage,
  PACKAGE_TEST_COVERAGE_POLICY,
} from "../lib/package-test-coverage.mjs";

const top = "tests/top.R";
const descendant = "tests/helpers/nested.R";
const input = (overrides = {}) => ({
  entrypoints: [top],
  nestedRFiles: [],
  unsupportedInputs: [],
  executedEntrypoints: [top],
  ...overrides,
});

test("complete direct tests retain a passed coverage stage without mutating input", () => {
  const original = input({
    entrypoints: ["tests/z.r", top],
    executedEntrypoints: [top, "tests/z.r"],
  });
  const before = structuredClone(original);
  const stage = packageTestCoverageStage(original);
  assert.equal(stage.status, "passed");
  assert.equal(stage.id, "package-tests");
  assert.ok(stage.reason.startsWith(`${PACKAGE_TEST_COVERAGE_POLICY}:`));
  assert.deepEqual(stage.discovered, [top, "tests/z.r"]);
  assert.deepEqual(stage.executed, stage.discovered);
  assert.deepEqual(original, before);
});

for (const path of [descendant, "tests/testthat/owned.R", "tests/fixtures/deep/input.r"]) {
  test(`nested closure remains unverified for ${path}`, () => {
    const stage = packageTestCoverageStage(input({ nestedRFiles: [path] }));
    assert.equal(stage.status, "unexecuted");
    assert.match(stage.reason, /Nested execution closure is unverified/u);
    assert.deepEqual(stage.discovered, [top, path].sort());
    assert.deepEqual(stage.executed, [top]);
  });
}

for (const [name, values] of [
  ["no entrypoint", { entrypoints: [], executedEntrypoints: [], nestedRFiles: [descendant] }],
  ["empty tests", { entrypoints: [], executedEntrypoints: [] }],
  ["selected subset", { entrypoints: [top, "tests/other.R"] }],
  ["unsupported top input", { unsupportedInputs: ["tests/preprocess.Rin"] }],
  ["unsupported nested input", { unsupportedInputs: ["tests/helpers/preprocess.rin"] }],
]) {
  test(`${name} cannot acquire passed coverage`, () => {
    assert.equal(packageTestCoverageStage(input(values)).status, "unexecuted");
  });
}

for (const values of [
  { entrypoints: [top, top] },
  { nestedRFiles: [descendant, descendant] },
  { executedEntrypoints: [top, top] },
  { executedEntrypoints: ["tests/unobserved.R"] },
  { executedEntrypoints: [descendant], nestedRFiles: [descendant] },
  { nestedRFiles: [top] },
  { entrypoints: [descendant] },
  { nestedRFiles: ["tests/../outside.R"] },
  { nestedRFiles: ["tests/helpers//input.R"] },
  { nestedRFiles: ["tests/helpers/./input.R"] },
  { nestedRFiles: ["tests/helpers/owned\\input.R"] },
  { nestedRFiles: ["tests/helpers/input\n.R"] },
  { unsupportedInputs: ["tests/input.R"] },
  { entrypoints: null },
]) {
  test(`malformed or forged coverage rejects ${JSON.stringify(values)}`, () => {
    assert.throws(() => packageTestCoverageStage(input(values)), /[Cc]overage|[Cc]aptured/u);
  });
}

test("current nested admission accepts only unexecuted or failed coverage with unexecuted descendants", () => {
  const stage = packageTestCoverageStage(input({ nestedRFiles: [descendant] }));
  assert.equal(hasAdmissibleNestedTestCoverage([descendant], stage, false), true);
  assert.equal(
    hasAdmissibleNestedTestCoverage([descendant], { ...stage, status: "failed" }, false),
    true,
  );
  for (const status of ["passed", "inapplicable"]) {
    assert.equal(hasAdmissibleNestedTestCoverage([descendant], { ...stage, status }, false), false);
  }
  assert.equal(hasAdmissibleNestedTestCoverage([descendant], stage, true), false);
  assert.equal(
    hasAdmissibleNestedTestCoverage([descendant], { ...stage, discovered: [top] }, false),
    false,
  );
  assert.equal(
    hasAdmissibleNestedTestCoverage([descendant], { ...stage, executed: [top, descendant] }, false),
    false,
  );
  assert.equal(hasAdmissibleNestedTestCoverage([descendant], undefined, false), false);
  assert.equal(hasAdmissibleNestedTestCoverage(["tests/../outside.R"], stage, false), false);
  assert.equal(hasAdmissibleNestedTestCoverage([descendant, descendant], stage, false), false);
});
