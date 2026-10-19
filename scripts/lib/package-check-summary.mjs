import { createHash } from "node:crypto";

const stageIds = [
  "archive-artifact",
  "metadata-dependencies",
  "installation-loading",
  "namespace-source",
  "documentation",
  "installed-documentation",
  "native-build-portability",
  "data",
  "examples",
  "package-tests",
  "test-output",
  "output-order",
  "conditions",
  "vignettes",
  "manual",
];
const statuses = ["passed", "failed", "unexecuted", "inapplicable"];
const outcomes = ["match", "mismatch", "no-expectation"];
const runnerOutcomes = [
  "completed",
  "partial",
  "failed",
  "no-tests",
  "no-entrypoint",
  "no-examples",
  "no-applicable",
];
const limitNames = [
  "maxSteps",
  "maxCallDepth",
  "maxVectorLength",
  "maxOutputBytes",
  "maxPackageResourceBytes",
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const digest = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
const textHash = (value) => (typeof value === "string" ? hash(value) : null);
const choice = (value, allowed) => (allowed.includes(value) ? value : "unknown");
const token = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/u.test(value) ? value : null;
const integer = (value) => (Number.isSafeInteger(value) ? value : null);
const safePath = (value) =>
  typeof value === "string" &&
  value.length <= 500 &&
  /^[a-zA-Z0-9_.+/-]+$/u.test(value) &&
  !value.startsWith("/") &&
  !value.split("/").includes("..")
    ? value
    : null;
const captureStatuses = ["completed", "failed", "timed-out", "cancelled"];

function blocker(value) {
  if (value === null || value === undefined) return null;
  // Diagnostics can embed entire function definitions. Keep only controlled identifiers and
  // hashes. A path is optional and must be a relative, source-position-free package path.
  return {
    ...(value.stage === undefined
      ? {}
      : { stage: choice(value.stage, ["provenance", ...stageIds]) }),
    code: token(value.code),
    path: safePath(value.path),
    messageSha256: textHash(value.message),
  };
}

function runner(value) {
  return value === null || value === undefined
    ? null
    : {
        outcome: choice(value.outcome, runnerOutcomes),
        firstBlocker: blocker(value.firstBlocker),
      };
}

function documentationMetadata(value, assessment) {
  if (value === null || value === undefined) return null;
  const capture = (item) => ({
    status: choice(item?.status, ["completed", "failed", "invalid-output"]),
    exportCount: Array.isArray(item?.exports) ? item.exports.length : null,
    signatures: Object.fromEntries(
      ["match", "mismatch", "unknown", "active", "missing", "noncallable"].map((state) => [
        state,
        Array.isArray(item?.states) ? item.states.filter((entry) => entry === state).length : null,
      ]),
    ),
  });
  return {
    policy: choice(value.policy, [
      "loaded-documentation-signatures-v1",
      "loaded-documentation-signatures-v2",
    ]),
    sourceSha256: digest(value.sourceSha256),
    exportsStatus: choice(value.exportsStatus, statuses),
    actual: capture(value.actual),
    expected: capture(value.expected),
    functions: Object.fromEntries(
      ["passed", "failed", "unexecuted"].map((status) => [
        status,
        Array.isArray(value.functions)
          ? value.functions.filter((entry) => entry.status === status).length
          : null,
      ]),
    ),
    usageOutcomes: Object.fromEntries(
      ["OK", "NOTE", "WARNING", "ERROR"].map((outcome) => [
        outcome,
        Array.isArray(assessment?.checks)
          ? assessment.checks.filter(
              (check) =>
                typeof check.id === "string" &&
                check.id.startsWith("rd:usage:") &&
                check.outcomeClass === outcome,
            ).length
          : null,
      ]),
    ),
  };
}

/** Strict allowlist: no diagnostic strings, output, source, or arbitrary nested objects. */
export function redactPackageCheck(raw) {
  const report = JSON.parse(Buffer.from(raw).toString("utf8"));
  const comparisons = {
    total: report.observations.length,
    outcomes: {},
    repeatability: { repeatable: 0, nonrepeatable: 0, unobserved: 0 },
  };
  for (const observation of report.observations) {
    const outcome = choice(observation.comparison?.outcome, outcomes);
    comparisons.outcomes[outcome] = (comparisons.outcomes[outcome] ?? 0) + 1;
    const repeated = observation.expected?.repeatable;
    comparisons.repeatability[
      repeated === true ? "repeatable" : repeated === false ? "nonrepeatable" : "unobserved"
    ] += 1;
  }
  const provenance = report.provenance;
  const profile = report.executionProfile;
  return {
    schemaVersion: 2,
    kind: "nativr-package-check-summary",
    rawReportSha256: hash(raw),
    redaction: {
      policy: "allowlisted-metadata-sha256-v2",
      rawOutputIncluded: false,
      rawConditionsIncluded: false,
      sourceIncluded: false,
    },
    package: { name: token(report.package.name), version: token(report.package.version) },
    provenance: {
      sourceSha256: digest(provenance.sourceSha256),
      artifactSha256: digest(provenance.artifactSha256),
      capabilitySha256: digest(provenance.capabilitySha256),
      semanticProfile: token(provenance.semanticProfile),
      oracle: {
        implementation: choice(provenance.oracle?.implementation, ["GNU R"]),
        version: token(provenance.oracle?.version),
      },
      runtimeLimits: Object.fromEntries(
        limitNames.map((name) => [name, integer(provenance.runtimeLimits?.[name])]),
      ),
    },
    executionProfile: {
      rng: {
        policy: choice(profile?.rng?.policy, ["explicit-seed-v1", "session-default"]),
        seed: integer(profile?.rng?.seed),
        kinds: (profile?.rng?.kinds ?? []).map((kind) =>
          choice(kind, ["Mersenne-Twister", "Inversion", "Rejection"]),
        ),
      },
      oracleRepeat: profile?.oracleRepeat === true,
      runtimeProfile: choice(profile?.runtimeProfile, ["browser", "package-test"]),
      capture: choice(profile?.capture, ["native-rscript-top-level-v1"]),
    },
    p7Eligible: report.p7Eligible === true,
    inventory: { nestedTestFiles: report.inventory?.nestedRFiles?.length ?? null },
    documentationMetadata: documentationMetadata(
      report.documentationObservation,
      report.documentationAssessment,
    ),
    dependencies: Object.entries(report.dependencyObservation?.actual?.versions ?? {})
      .filter(([name]) => token(name) !== null)
      .map(([name, version]) => ({
        name,
        actualVersion: token(version),
        oracleVersion: token(report.dependencyObservation?.expected?.versions?.[name]),
        actualObserved: report.dependencyObservation?.actual?.status === "completed",
        oracleObserved: report.dependencyObservation?.expected?.status === "completed",
      })),
    firstBlocker: blocker(report.firstBlocker),
    // Runner completion describes dispatch. Captured execution and reconciled stages below
    // determine success; a runner can finish dispatching scripts whose evaluations failed.
    runnerDispatch: {
      examples: runner(report.runners?.examples),
      tests: runner(report.runners?.tests),
    },
    observations: report.observations.map((observation) => ({
      kind: choice(observation.kind, ["test", "example"]),
      path: safePath(observation.path),
      inputSha256: digest(
        report.execution?.find(
          (entry) => entry.kind === observation.kind && entry.path === observation.path,
        )?.sourceSha256,
      ),
      actual: choice(observation.actual?.status, captureStatuses),
      expected: choice(observation.expected?.status, captureStatuses),
      comparison: choice(observation.comparison?.outcome, outcomes),
      repeatable:
        typeof observation.expected?.repeatable === "boolean"
          ? observation.expected.repeatable
          : null,
    })),
    stages: report.stages.map((stage) => ({
      id: choice(stage.id, stageIds),
      status: choice(stage.status, statuses),
      reasonSha256: textHash(stage.reason),
      discovered: stage.discovered.length,
      executed: stage.executed.length,
    })),
    comparisons,
  };
}
