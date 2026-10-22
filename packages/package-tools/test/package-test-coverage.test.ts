import { describe, expect, it } from "vitest";
import { packageTestCoverageStage } from "../../../scripts/lib/package-test-coverage.mjs";
import { createPackageCheckReport, PACKAGE_CHECK_STAGES } from "../src/check.js";
import type { PackageCheckEvidence, PackageCheckObservation } from "../src/types.js";

const top = "tests/top.R";
const nested = "tests/helpers/nested.R";
function observation(status: "completed" | "failed" = "completed"): PackageCheckObservation {
  return {
    status,
    stdout: "",
    stderr: "",
    conditions: [],
    outputOrder: [],
    freshSession: true,
    outputComplete: true,
    conditionsComplete: true,
    repeatable: true,
  };
}
function evidence(
  descendants: string[],
  actualStatus: "completed" | "failed" = "completed",
  oracleStatus: "completed" | "failed" = "completed",
): PackageCheckEvidence {
  const coverage = packageTestCoverageStage({
    entrypoints: [top],
    nestedRFiles: descendants,
    executedEntrypoints: [top],
  });
  return {
    package: { name: "ownedNestedCoverage", version: "1.0.0" },
    provenance: {
      sourceSha256: "a".repeat(64),
      artifactSha256: "b".repeat(64),
      oracle: { implementation: "GNU R", version: "4.6.1" },
      semanticProfile: "0.393.0",
      capabilitySha256: "c".repeat(64),
      runtimeLimits: {
        maxSteps: 10000,
        maxCallDepth: 100,
        maxVectorLength: 1000,
        maxOutputBytes: 1000,
        maxPackageResourceBytes: 1000,
      },
    },
    comparison: { policyVersion: 1, adaptations: [] },
    stages: PACKAGE_CHECK_STAGES.map((id) => {
      if (id === "package-tests") return coverage;
      if (id === "examples")
        return {
          id,
          status: "inapplicable",
          reason: "No example blocks.",
          discovered: [],
          executed: [],
        };
      const key = ["test-output", "conditions", "output-order"].includes(id)
        ? `test:${top}`
        : `${id}:owned`;
      return {
        id,
        status: "passed",
        reason: "Independent owned stage fixture.",
        discovered: [key],
        executed: [key],
      };
    }),
    observations: [
      {
        kind: "test",
        path: top,
        actual: observation(actualStatus),
        expected: observation(oracleStatus),
      },
    ],
  };
}

describe("nested execution closure report reconciliation", () => {
  it("retains full eligibility for complete direct tests with no nested files", () => {
    const report = createPackageCheckReport(evidence([]));
    expect(report.p7Eligible).toBe(true);
    expect(report.firstBlocker).toBeNull();
  });

  it("keeps nested closure unexecuted without fabricated output observations", () => {
    const input = evidence([nested]);
    const report = createPackageCheckReport(input);
    expect(report.p7Eligible).toBe(false);
    expect(report.firstBlocker?.stage).toBe("package-tests");
    expect(report.stages.find((stage) => stage.id === "package-tests")).toMatchObject({
      status: "unexecuted",
      discovered: [nested, top],
      executed: [top],
    });
    expect(report.observations).toHaveLength(1);
    expect(report.stages.find((stage) => stage.id === "test-output")).toMatchObject({
      status: "passed",
      discovered: [`test:${top}`],
      executed: [`test:${top}`],
    });
  });

  it.each(["actual", "oracle"] as const)(
    "preserves a genuine %s failure over nested uncertainty",
    (side) => {
      const report = createPackageCheckReport(
        evidence(
          [nested],
          side === "actual" ? "failed" : "completed",
          side === "oracle" ? "failed" : "completed",
        ),
      );
      expect(report.p7Eligible).toBe(false);
      expect(report.firstBlocker).toMatchObject({
        stage: "package-tests",
        code: "execution-failed",
      });
      expect(report.stages.find((stage) => stage.id === "package-tests")?.status).toBe("failed");
    },
  );
});
