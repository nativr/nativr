export const PACKAGE_TEST_COVERAGE_POLICY = "nested-execution-closure-v1";

const topLevel = /^tests\/[^/]+\.[Rr]$/u;
const nested = /^tests\/(?:[^/]+\/)+[^/]+\.[Rr]$/u;
const unsupported = /^tests\/.+\.Rin$/iu;
const safePath = (value) =>
  typeof value === "string" &&
  !/[\\:]/u.test(value) &&
  ![...value].some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  ) &&
  !value.split("/").some((part) => part === "" || part === "." || part === "..");

function inventory(values, pattern) {
  if (!Array.isArray(values) || values.some((value) => !safePath(value) || !pattern.test(value))) {
    throw new Error("Package-test coverage requires normalized paths in the expected inventory.");
  }
  if (new Set(values).size !== values.length) {
    throw new Error("Package-test coverage inventories must not contain duplicate paths.");
  }
  return [...values].sort();
}

/** Captures identify top-level scripts only; nested execution is not currently observed. */
export function packageTestCoverageStage({
  entrypoints,
  nestedRFiles,
  unsupportedInputs = [],
  executedEntrypoints,
}) {
  const top = inventory(entrypoints, topLevel);
  const descendants = inventory(nestedRFiles, nested);
  const unsupportedPaths = inventory(unsupportedInputs, unsupported);
  const executed = inventory(executedEntrypoints, topLevel);
  if (executed.some((file) => !top.includes(file))) {
    throw new Error("Captured package-test entrypoint is absent from the discovered inventory.");
  }
  const complete =
    top.length > 0 &&
    descendants.length === 0 &&
    unsupportedPaths.length === 0 &&
    top.every((file) => executed.includes(file));
  const reason =
    descendants.length > 0
      ? "Nested execution closure is unverified. Top-level completion and dependency availability do not prove nested execution."
      : complete
        ? "All top-level R entrypoints were captured unchanged; execution failures and other evidence gates are reconciled separately."
        : "A nonempty, fully captured top-level inventory without unsupported .Rin inputs is required.";
  return {
    id: "package-tests",
    status: complete ? "passed" : "unexecuted",
    reason: `${PACKAGE_TEST_COVERAGE_POLICY}: ${reason}`,
    discovered: [...top, ...descendants, ...unsupportedPaths].sort(),
    executed,
  };
}

/** Current raw evidence cannot claim coverage that the top-level observer never records. */
export function hasAdmissibleNestedTestCoverage(nestedRFiles, stage, p7Eligible) {
  try {
    const descendants = inventory(nestedRFiles, nested);
    if (descendants.length === 0) return true;
    return (
      p7Eligible === false &&
      ["unexecuted", "failed"].includes(stage?.status) &&
      Array.isArray(stage.discovered) &&
      Array.isArray(stage.executed) &&
      descendants.every((file) => stage.discovered.includes(file) && !stage.executed.includes(file))
    );
  } catch {
    return false;
  }
}
