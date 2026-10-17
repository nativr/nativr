import { readFile } from "node:fs/promises";

import { expect, it } from "vitest";

import { PACKAGE_CHECK_STAGES } from "../src/index.js";

const root = new URL("../../../", import.meta.url);
const hashPattern = /^[a-f0-9]{64}$/u;
const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
const evidenceFiles = [
  "abind-1.4-8-0.302.0.json",
  "numDeriv-2016.8-1.1-0.302.0.json",
  "abind-1.4-8-0.303.0.json",
  "numDeriv-2016.8-1.1-0.303.0.json",
  "abind-1.4-8-0.304.0.json",
  "numDeriv-2016.8-1.1-0.304.0.json",
  "abind-1.4-8-0.305.0.json",
  "numDeriv-2016.8-1.1-0.305.0.json",
];

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Expected evidence object.");
  return value as Record<string, unknown>;
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("Expected evidence array.");
  return (value as unknown[]).map(record);
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !(value as unknown[]).every((item) => typeof item === "string"))
    throw new Error("Expected evidence string array.");
  return value as string[];
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  expect(Object.keys(value).sort()).toEqual([...keys].sort());
}

function validateDigest(value: unknown): void {
  expect(value).toMatch(hashPattern);
}

function validateTextDigest(value: unknown, difference = false): void {
  const text = record(value);
  exactKeys(text, ["sha256", "utf8Bytes", "utf16Length", ...(difference ? ["firstCodeUnit"] : [])]);
  validateDigest(text.sha256);
  expect(Number.isSafeInteger(text.utf8Bytes)).toBe(true);
  expect(Number.isSafeInteger(text.utf16Length)).toBe(true);
  expect(text.utf8Bytes).toBeGreaterThanOrEqual(0);
  expect(text.utf16Length).toBeGreaterThanOrEqual(0);
  if (difference) {
    expect(Number.isSafeInteger(text.firstCodeUnit)).toBe(true);
    expect(text.firstCodeUnit).toBeGreaterThanOrEqual(0);
    expect(text.firstCodeUnit).toBeLessThanOrEqual(65535);
  }
}

function validateDifference(value: unknown): void {
  if (value === null) return;
  const difference = record(value);
  exactKeys(difference, [
    "field",
    "index",
    "expected",
    "actual",
    ...(difference.numericTokens === undefined ? [] : ["numericTokens"]),
  ]);
  expect(["status", "stdout", "stderr", "conditions", "outputOrder"]).toContain(difference.field);
  expect(Number.isSafeInteger(difference.index)).toBe(true);
  expect(difference.index).toBeGreaterThanOrEqual(0);
  for (const side of [difference.expected, difference.actual])
    if (side !== null) validateTextDigest(side, true);
  if (difference.numericTokens !== undefined) {
    const tokens = record(difference.numericTokens);
    exactKeys(tokens, ["expected", "actual"]);
    expect(tokens.expected).toMatch(numericPattern);
    expect(tokens.actual).toMatch(numericPattern);
    expect(tokens.actual).not.toBe(tokens.expected);
  }
}

async function readEvidence(filename: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(
    await readFile(new URL(`compatibility/package-check-evidence/${filename}`, root), "utf8"),
  );
  return record(value);
}

it.each(evidenceFiles)(
  "keeps %s pinned, complete in inventory, and explicitly exploratory",
  async (filename) => {
    const evidence = await readEvidence(filename);
    exactKeys(evidence, [
      "schemaVersion",
      "kind",
      "classification",
      "rawReportSha256",
      "redaction",
      "package",
      "provenance",
      "executionProfile",
      "p7Eligible",
      "firstBlocker",
      "runners",
      "stages",
      "inventory",
      "summary",
      "observations",
    ]);
    expect(evidence.schemaVersion).toBe(1);
    expect(evidence.kind).toBe("nativr-package-check-diagnostic");
    expect(evidence.classification).toBe("exploratory");
    expect(evidence.p7Eligible).toBe(false);
    expect(evidence.firstBlocker).toMatchObject({
      stage: "metadata-dependencies",
      code: "stage-unexecuted",
    });
    validateDigest(evidence.rawReportSha256);
    const provenance = record(evidence.provenance);
    expect(provenance.semanticProfile).toBe(filename.match(/(0\.\d+\.0)\.json$/u)?.[1]);
    expect(provenance.oracle).toEqual({ implementation: "GNU R", version: "4.6.1" });
    for (const key of ["sourceSha256", "artifactSha256", "capabilitySha256"])
      validateDigest(provenance[key]);
    const limits = record(provenance.runtimeLimits);
    exactKeys(limits, [
      "maxSteps",
      "maxCallDepth",
      "maxVectorLength",
      "maxOutputBytes",
      "maxPackageResourceBytes",
    ]);
    for (const limit of Object.values(limits)) {
      expect(Number.isSafeInteger(limit)).toBe(true);
      expect(limit).toBeGreaterThan(0);
    }
    const corpusValue: unknown = JSON.parse(
      await readFile(new URL("compatibility/package-corpus.json", root), "utf8"),
    );
    const identity = record(evidence.package);
    const corpus = records(record(corpusValue).packages).find(
      (entry) => entry.package === identity.name,
    );
    expect(corpus).toMatchObject({
      version: identity.version,
      sourceSha256: provenance.sourceSha256,
      artifactSha256: provenance.artifactSha256,
    });
    expect(corpus?.partition).not.toBe("holdout");
    const stages = records(evidence.stages);
    expect(stages.map((stage) => stage.id)).toEqual(PACKAGE_CHECK_STAGES);
    for (const stage of stages) {
      expect(["passed", "failed", "unexecuted", "inapplicable"]).toContain(stage.status);
      expect(stage.reason).toBeTypeOf("string");
      const discovered = strings(stage.discovered),
        executed = strings(stage.executed);
      expect(new Set(discovered).size).toBe(discovered.length);
      expect(new Set(executed).size).toBe(executed.length);
      expect(executed.every((path) => discovered.includes(path))).toBe(true);
      if (stage.status === "passed") expect(new Set(executed)).toEqual(new Set(discovered));
      if (stage.status === "inapplicable") expect(discovered).toEqual([]);
    }
    const observations = records(evidence.observations);
    const observationKeys = observations.map((item) => `${String(item.kind)}:${String(item.path)}`);
    expect(new Set(observationKeys).size).toBe(observationKeys.length);
    const outputStage = stages.find((stage) => stage.id === "test-output");
    expect(new Set(strings(outputStage?.discovered))).toEqual(new Set(observationKeys));
    expect(new Set(strings(outputStage?.executed))).toEqual(new Set(observationKeys));
    const summary = record(evidence.summary);
    expect(summary.observed).toBe(observations.length);
    expect(summary.actualCompleted).toBe(
      observations.filter((item) => record(item.actual).status === "completed").length,
    );
    expect(summary.oracleCompleted).toBe(
      observations.filter((item) => record(item.expected).status === "completed").length,
    );
    expect(summary.matches).toBe(
      observations.filter((item) => record(item.comparison).outcome === "match").length,
    );
    expect(summary.mismatches).toBe(
      observations.filter((item) => record(item.comparison).outcome === "mismatch").length,
    );
  },
);

it.each(evidenceFiles)(
  "retains hashes and bounded numeric evidence without source/output text in %s",
  async (filename) => {
    const evidence = await readEvidence(filename);
    expect(evidence.redaction).toMatchObject({
      policy: "sha256-no-output-v1",
      rawOutputIncluded: false,
      rawConditionsIncluded: false,
      sourceIncluded: false,
    });
    for (const observation of records(evidence.observations)) {
      exactKeys(observation, [
        "kind",
        "path",
        "inputSha256",
        "setupSha256",
        "completionSha256",
        "fixturePaths",
        "oracleExitCode",
        "oracleSignal",
        "oracleRuntimeSettings",
        "oracleLimitations",
        "actual",
        "expected",
        "comparison",
      ]);
      for (const key of ["inputSha256", "setupSha256", "completionSha256"])
        validateDigest(observation[key]);
      for (const side of [observation.actual, observation.expected]) {
        const capture = record(side);
        exactKeys(capture, [
          "status",
          "freshSession",
          "outputComplete",
          "conditionsComplete",
          "stdout",
          "stderr",
          "conditions",
          "outputOrderObserved",
        ]);
        validateTextDigest(capture.stdout);
        validateTextDigest(capture.stderr);
        const conditions = record(capture.conditions);
        exactKeys(conditions, ["sha256", "count", "warnings", "errors"]);
        validateDigest(conditions.sha256);
        expect(conditions.count).toBe(Number(conditions.warnings) + Number(conditions.errors));
      }
      const comparison = record(observation.comparison);
      exactKeys(comparison, [
        "policyVersion",
        "outcome",
        "rawDifference",
        "adaptedDifference",
        "adaptations",
        "crossStreamOrder",
        "conditionEvidence",
        "outputEvidence",
      ]);
      expect(comparison.policyVersion).toBe(1);
      expect(comparison.crossStreamOrder).toBe("unobserved");
      validateDifference(comparison.rawDifference);
      validateDifference(comparison.adaptedDifference);
      expect(comparison.outcome === "match").toBe(comparison.adaptedDifference === null);
      expect(records(comparison.adaptations)).toHaveLength(1);
      const adaptation = records(comparison.adaptations)[0];
      expect(adaptation).toMatchObject({
        id: "oracle-text-crlf-v1",
        probeLiteralHex: "610a620d0a630d640d0d0a65",
        stdoutHex: "610d0a620d0d0a630d640d0d0d0a65",
        stderrHex: "610d0a620d0d0a630d640d0d0d0a65",
      });
      for (const count of Object.values(record(adaptation?.transformedPairs))) {
        expect(Number.isSafeInteger(count)).toBe(true);
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  },
);

it("preserves unresolved numeric differences exactly while abind remains below P7", async () => {
  const numDeriv = await readEvidence("numDeriv-2016.8-1.1-0.302.0.json");
  const trig = records(numDeriv.observations).find((item) => item.path === "tests/trig01.R");
  expect(record(record(trig?.comparison).adaptedDifference).numericTokens).toEqual({
    expected: "7.08881205005",
    actual: "7.08881205004",
  });
  const grad = records(numDeriv.observations).find((item) => item.path === "tests/grad01.R");
  expect(record(record(grad?.comparison).adaptedDifference).numericTokens).toEqual({
    expected: "6.618484e-12",
    actual: "6.618483539000408e-12",
  });
  expect(numDeriv.summary).toMatchObject({
    observed: 11,
    actualCompleted: 11,
    oracleCompleted: 11,
    matches: 2,
    mismatches: 9,
  });
  const abind = await readEvidence("abind-1.4-8-0.302.0.json");
  expect(abind.summary).toMatchObject({
    observed: 10,
    matches: 10,
    mismatches: 0,
    conditionIncomplete: 2,
  });
  expect(abind.p7Eligible).toBe(false);
});

it("records later numeric differences after the shared formatting closure without promoting P7", async () => {
  const numDeriv = await readEvidence("numDeriv-2016.8-1.1-0.303.0.json");
  const grad = records(numDeriv.observations).find((item) => item.path === "tests/grad01.R");
  expect(record(record(grad?.comparison).adaptedDifference).numericTokens).toEqual({
    expected: "7.698508e-12",
    actual: "6.618817e-12",
  });
  expect(numDeriv.summary).toMatchObject({
    observed: 11,
    actualCompleted: 11,
    oracleCompleted: 11,
    matches: 2,
    mismatches: 9,
  });
  expect(numDeriv.p7Eligible).toBe(false);
  const abind = await readEvidence("abind-1.4-8-0.303.0.json");
  expect(abind.summary).toMatchObject({
    observed: 10,
    matches: 10,
    mismatches: 0,
    conditionIncomplete: 2,
  });
  expect(abind.p7Eligible).toBe(false);
});

it("retains the historically observed abind condition-call difference", async () => {
  const abind = await readEvidence("abind-1.4-8-0.304.0.json");
  expect(abind.summary).toMatchObject({
    observed: 10,
    matches: 9,
    mismatches: 1,
    conditionIncomplete: 0,
  });
  const afill = records(abind.observations).find((item) => item.path === "tests/afill.R");
  expect(record(afill?.comparison).conditionEvidence).toBe("complete");
  expect(record(record(afill?.comparison).adaptedDifference).field).toBe("conditions");
  expect(record(record(afill?.actual).conditions).count).toBe(1);
  expect(record(record(afill?.actual).conditions).sha256).not.toBe(
    record(record(afill?.expected).conditions).sha256,
  );
  const observer = record(record(abind.executionProfile).conditionObservation);
  expect(observer).toMatchObject({
    boundary: "globalCallingHandlers-after-source-handlers",
    completionPresenceCheck: true,
    maxRecords: 10000,
    maxBytes: 8388608,
  });
  validateDigest(observer.setupSha256);
  validateDigest(observer.readSha256);
  expect(abind.p7Eligible).toBe(false);
});

it("records closure of the abind attributed-call gap without promoting P7", async () => {
  const abind = await readEvidence("abind-1.4-8-0.305.0.json");
  expect(abind.summary).toMatchObject({
    observed: 10,
    matches: 10,
    mismatches: 0,
    conditionIncomplete: 0,
    outputIncomplete: 0,
  });
  for (const item of records(abind.observations)) {
    expect(record(item.comparison).conditionEvidence).toBe("complete");
    expect(record(record(item.actual).conditions).sha256).toBe(
      record(record(item.expected).conditions).sha256,
    );
  }
  expect(abind.p7Eligible).toBe(false);
});
