import type { PackageCheckStage } from "../../packages/package-tools/src/types.js";

export const PACKAGE_TEST_COVERAGE_POLICY: "nested-execution-closure-v1";
export function packageTestCoverageStage(input: {
  readonly entrypoints: readonly string[];
  readonly nestedRFiles: readonly string[];
  readonly unsupportedInputs?: readonly string[];
  readonly executedEntrypoints: readonly string[];
}): PackageCheckStage;
export function hasAdmissibleNestedTestCoverage(
  nestedRFiles: unknown,
  stage: unknown,
  p7Eligible: unknown,
): boolean;
