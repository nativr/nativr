import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { redactPackageCheck } from "../../../scripts/lib/package-check-summary.mjs";

it.each([
  "0.356.0",
  "0.357.0",
  "0.358.0",
  "0.359.0",
  "0.360.0",
  "0.361.0",
  "0.362.0",
  "0.363.0",
  "0.364.0",
])("pins checkpoint %s without evaluating the holdout", async (profile) => {
  const read = async (path: string) =>
    JSON.parse(await readFile(new URL(`../../../${path}`, import.meta.url), "utf8")) as Record<
      string,
      unknown
    >;
  const corpus = (await read("compatibility/package-corpus.json")).packages as {
    package: string;
    version: string;
    partition: string;
    sourceSha256: string;
    artifactSha256: string | null;
  }[];
  const checkpoint = await read(`compatibility/package-check-evidence/corpus-${profile}.json`);
  const entries = checkpoint.packages as {
    package: string;
    version: string;
    partition: string;
    sourceSha256: string;
    artifactSha256: string;
    outcome: string;
    evidence: string | null;
    summarySha256: string | null;
    tier: string;
  }[];
  const expectedNames =
    profile === "0.360.0"
      ? ["pkgconfig", "abind", "inline", "withr", "evaluate", "rprojroot", "whisker"]
      : profile !== "0.357.0"
        ? corpus.filter((e) => e.partition !== "holdout").map((e) => e.package)
        : [
            "prettyunits",
            "rstudioapi",
            "inline",
            "evaluate",
            "rprojroot",
            "withr",
            "whisker",
            "pkgconfig",
            "abind",
          ];
  expect(entries.map((e) => e.package).sort()).toEqual(expectedNames.sort());
  expect(entries).toHaveLength(expectedNames.length);
  expect(entries.filter((e) => e.outcome === "aborted").map((e) => e.package)).toEqual(
    profile === "0.356.0" ? ["inline"] : [],
  );
  for (const entry of entries) {
    expect(corpus.find((e) => e.package === entry.package)).toMatchObject({
      version: entry.version,
      partition: entry.partition,
      sourceSha256: entry.sourceSha256,
      artifactSha256: entry.artifactSha256,
    });
    if (entry.evidence === null) continue;
    const bytes = await readFile(new URL(`../../../${entry.evidence}`, import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.summarySha256);
    const summary = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    expect(summary).toMatchObject({
      schemaVersion: 2,
      package: { name: entry.package, version: entry.version },
      redaction: {
        policy: "allowlisted-metadata-sha256-v2",
        sourceIncluded: false,
        rawOutputIncluded: false,
        rawConditionsIncluded: false,
      },
      provenance: {
        semanticProfile: profile,
        sourceSha256: entry.sourceSha256,
        artifactSha256: entry.artifactSha256,
      },
    });
    const stages = summary.stages as {
      id: string;
      status: string;
      discovered: number;
      executed: number;
    }[];
    if (["0.358.0", "0.359.0", "0.360.0", "0.361.0", "0.362.0"].includes(profile)) {
      const metadata = summary.documentationMetadata as {
        policy: string;
        sourceSha256: string;
        exportsStatus: string;
        actual: { status: string; exportCount: number | null };
        expected: { status: string; exportCount: number | null };
      };
      expect(metadata.policy).toBe(
        profile === "0.360.0" || profile === "0.361.0" || profile === "0.362.0"
          ? "loaded-documentation-signatures-v2"
          : "loaded-documentation-signatures-v1",
      );
      expect(metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/u);
      if (metadata.exportsStatus === "passed") {
        expect(metadata.actual.status).toBe("completed");
        expect(metadata.expected.status).toBe("completed");
        expect(metadata.actual.exportCount).toBe(metadata.expected.exportCount);
      }
    }
    expect(new Set(stages.map((s) => s.id)).size).toBe(15);
    if (profile === "0.359.0") {
      if (["evaluate", "rprojroot", "whisker"].includes(entry.package))
        expect(stages.find((s) => s.id === "documentation")?.status).toBe("passed");
      if (["crayon", "viridisLite"].includes(entry.package))
        expect(stages.find((s) => s.id === "manual")?.status).toBe("passed");
    }
    if (entry.tier === "P7") {
      expect(summary.p7Eligible).toBe(true);
      expect(stages.every((s) => s.status === "passed" || s.status === "inapplicable")).toBe(true);
    }
    if (entry.package === "rematch") {
      expect(entry.tier).toBe("P5");
      expect(summary.inventory).toMatchObject({ nestedTestFiles: 2 });
      expect(summary.dependencies).toContainEqual({
        name: "testthat",
        actualVersion: null,
        oracleVersion: null,
        actualObserved: true,
        oracleObserved: true,
      });
    }
  }
});

it("redacts source-shaped diagnostics and unexpected nested fields while retaining evidence identities", () => {
  const body = "function(secret) { independently_authored_body(secret) }";
  const sha = "a".repeat(64);
  const raw = Buffer.from(
    JSON.stringify({
      package: { name: "ownedfixture", version: "1.0", license: body, unexpected: body },
      provenance: {
        sourceSha256: sha,
        artifactSha256: sha,
        capabilitySha256: sha,
        semanticProfile: "0.356.0",
        oracle: { implementation: "GNU R", version: "4.6.1", body },
        runtimeLimits: { maxSteps: 100, body },
      },
      executionProfile: {
        rng: {
          policy: "explicit-seed-v1",
          seed: 42,
          kinds: ["Mersenne-Twister", "Inversion", "Rejection"],
          body,
        },
        oracleRepeat: true,
        runtimeProfile: "package-test",
        capture: "native-rscript-top-level-v1",
        body,
      },
      p7Eligible: false,
      documentationObservation: {
        policy: "loaded-documentation-signatures-v1",
        sourceSha256: sha,
        exportsStatus: "passed",
        actual: { status: "completed", exports: [body], states: ["match", "unknown", body], body },
        expected: { status: "completed", exports: [body], states: ["match", "unknown"] },
        functions: [
          { id: body, status: "passed" },
          { id: body, status: "unexecuted" },
        ],
        source: body,
      },
      documentationAssessment: {
        checks: [
          { id: "rd:usage:man/owned.Rd", outcomeClass: "NOTE", reason: body },
          { id: "rd:usage:man/other.Rd", outcomeClass: body, reason: body },
        ],
      },
      firstBlocker: {
        stage: "documentation",
        code: "stage-failed",
        path: "man/owned.Rd",
        message: body,
      },
      runners: {
        examples: {
          outcome: "failed",
          firstBlocker: { code: "example-error", path: "man/owned.Rd", message: body },
        },
      },
      stages: [
        {
          id: "documentation",
          status: "failed",
          reason: body,
          discovered: [body],
          executed: [body],
        },
      ],
      observations: [true, false, undefined].map((repeatable) => ({
        actual: { stdout: body, conditions: [body] },
        expected: { repeatable },
        comparison: { outcome: "mismatch", rawDifference: { expected: body } },
      })),
    }),
  );
  const summary = redactPackageCheck(raw);
  expect(JSON.stringify(summary)).not.toContain(body);
  expect(JSON.stringify(summary)).not.toContain("independently_authored_body");
  expect(summary).toMatchObject({
    schemaVersion: 2,
    documentationMetadata: {
      policy: "loaded-documentation-signatures-v1",
      sourceSha256: sha,
      exportsStatus: "passed",
      actual: { status: "completed", exportCount: 1, signatures: { match: 1, unknown: 1 } },
      functions: { passed: 1, failed: 0, unexecuted: 1 },
      usageOutcomes: { OK: 0, NOTE: 1, WARNING: 0, ERROR: 0 },
    },
    package: { name: "ownedfixture", version: "1.0" },
    rawReportSha256: createHash("sha256").update(raw).digest("hex"),
    provenance: { sourceSha256: sha, semanticProfile: "0.356.0" },
    firstBlocker: {
      stage: "documentation",
      path: "man/owned.Rd",
      messageSha256: createHash("sha256").update(body).digest("hex"),
    },
    stages: [{ id: "documentation", status: "failed", discovered: 1, executed: 1 }],
    comparisons: {
      total: 3,
      outcomes: { mismatch: 3 },
      repeatability: { repeatable: 1, nonrepeatable: 1, unobserved: 1 },
    },
  });
});

it("does not treat unexpected status text or malformed identifier fields as safe metadata", () => {
  const body = "function(x) { x + 1 }";
  const summary = redactPackageCheck(
    Buffer.from(
      JSON.stringify({
        package: { name: body, version: body },
        provenance: {
          oracle: { implementation: body, version: body },
          semanticProfile: body,
          sourceSha256: body,
          runtimeLimits: { maxSteps: body },
        },
        firstBlocker: { stage: body, code: body, path: body, message: body },
        stages: [{ id: body, status: body, reason: body, discovered: [], executed: [] }],
        observations: [{ comparison: { outcome: body } }],
      }),
    ),
  );
  expect(JSON.stringify(summary)).not.toContain(body);
  expect(summary).toMatchObject({
    package: { name: null, version: null },
    p7Eligible: false,
    firstBlocker: { stage: "unknown", code: null, path: null },
    comparisons: { outcomes: { unknown: 1 }, repeatability: { unobserved: 1 } },
  });
});
