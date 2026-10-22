import { createHash } from "node:crypto";
import { redactPackageCheck } from "./package-check-summary.mjs";
import { hasAdmissibleNestedTestCoverage } from "./package-test-coverage.mjs";

export const PACKAGE_NAMES = Object.freeze(["abind", "numDeriv"]);
export const STAGES = Object.freeze([
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
]);
export const SETTINGS = Object.freeze({
  rngSeed: 20261016,
  oracleRepeat: true,
  maxSteps: 300000000,
  maxCallDepth: 200,
  maxVectorLength: 50000000,
  maxOutputBytes: 32000000,
  maxPackageResourceBytes: 268435456,
  packageTimeoutMs: 1800000,
  maxReportBytes: 67108864,
  maxProcessOutputBytes: 33554432,
});
const STATUSES = ["passed", "failed", "unexecuted", "inapplicable"];
const CAPTURES = ["completed", "failed", "timed-out", "cancelled"];
const COMPARISONS = ["match", "mismatch", "no-expectation"];
const RUNNERS = [
  "completed",
  "partial",
  "failed",
  "no-tests",
  "no-entrypoint",
  "no-examples",
  "no-applicable",
];
const KINDS = ["Mersenne-Twister", "Inversion", "Rejection"];
const version = (x) => typeof x === "string" && /^\d+\.\d+\.\d+$/.test(x);
const packageVersion = (x) =>
  typeof x === "string" &&
  /^\d+(?:[.-]\d+)*$/.test(x) &&
  x.split(/[.-]/).every((component) => Number.isSafeInteger(Number(component)));
const nativePackageVersion = (x) =>
  x
    .split(/[.-]/)
    .map((component) => String(Number(component)))
    .join(".");
const digest = (x) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const token = (x) => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(x);
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const safePath = (x) =>
  typeof x === "string" &&
  x.length > 0 &&
  x.length <= 500 &&
  /^[A-Za-z0-9_.+/-]+$/.test(x) &&
  !x.startsWith("/") &&
  !x.split("/").some((part) => part === ".." || part === "" || part === ".");
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export class EvidenceFault extends Error {
  constructor(code) {
    super(code);
    this.name = "EvidenceFault";
    this.code = code;
  }
}
const need = (condition, code) => {
  if (!condition) throw new EvidenceFault(code);
};
export function safeFailure(stage, error) {
  const allowedStages = [
    "arguments",
    "preflight",
    "capabilities",
    "oracle",
    "package",
    "summary",
    "stability",
    "output",
  ];
  return {
    stage: allowedStages.includes(stage) ? stage : "unclassified",
    code:
      error instanceof EvidenceFault && /^EVIDENCE_[A-Z_]{1,60}$/.test(error.code)
        ? error.code
        : "EVIDENCE_OPERATION_FAILED",
    redacted: true,
  };
}
export function parseEvidenceArguments(args) {
  const result = { run: false, packages: [...PACKAGE_NAMES] };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--") continue;
    need(!seen.has(flag), "EVIDENCE_DUPLICATE_ARGUMENT");
    seen.add(flag);
    if (flag === "--run") {
      result.run = true;
      continue;
    }
    need(
      ["--archive-dir", "--output", "--rscript", "--baseline-profile", "--packages"].includes(flag),
      "EVIDENCE_UNKNOWN_ARGUMENT",
    );
    const value = args[++i];
    need(
      typeof value === "string" && value.length > 0 && !value.startsWith("--"),
      "EVIDENCE_MISSING_ARGUMENT",
    );
    if (flag === "--packages") result.packages = value.split(",");
    else result[flag.slice(2)] = value;
  }
  for (const key of ["archive-dir", "output", "rscript", "baseline-profile"])
    need(typeof result[key] === "string", "EVIDENCE_MISSING_ARGUMENT");
  need(version(result["baseline-profile"]), "EVIDENCE_BASELINE_PROFILE");
  need(
    result.packages.length === 2 &&
      new Set(result.packages).size === 2 &&
      PACKAGE_NAMES.every((name) => result.packages.includes(name)),
    "EVIDENCE_PACKAGE_SELECTION",
  );
  return result;
}
export function selectPackages(corpus, names = PACKAGE_NAMES) {
  need(
    corpus?.schemaVersion === 2 && corpus.targetR === "4.6.1" && Array.isArray(corpus.packages),
    "EVIDENCE_CORPUS",
  );
  need(
    names.length === 2 &&
      new Set(names).size === 2 &&
      PACKAGE_NAMES.every((name) => names.includes(name)),
    "EVIDENCE_PACKAGE_SELECTION",
  );
  return PACKAGE_NAMES.map((name) => {
    const matches = corpus.packages.filter((entry) => entry.package === name);
    need(matches.length === 1, "EVIDENCE_PACKAGE_SELECTION");
    const p = matches[0];
    need(["development", "regression"].includes(p.partition), "EVIDENCE_HOLDOUT");
    need(
      token(p.version) &&
        packageVersion(p.version) &&
        digest(p.sourceSha256) &&
        digest(p.artifactSha256),
      "EVIDENCE_PACKAGE_PINS",
    );
    return {
      name,
      version: p.version,
      partition: p.partition,
      sourceSha256: p.sourceSha256,
      artifactSha256: p.artifactSha256,
    };
  });
}
export function validateManifest(manifest) {
  need(
    object(manifest) &&
      manifest.targetRVersion === "4.6.1" &&
      version(manifest.semanticProfileVersion) &&
      manifest.semanticProfileVersion === manifest.languageSubsetVersion,
    "EVIDENCE_MANIFEST",
  );
  return {
    semanticProfile: manifest.semanticProfileVersion,
    capabilitySha256: sha256(JSON.stringify(manifest)),
  };
}
export function verifyArchive(bytes, entry) {
  need(sha256(bytes) === entry.sourceSha256, "EVIDENCE_ARCHIVE_PIN");
}
function observationInventory(rows) {
  need(Array.isArray(rows), "EVIDENCE_OBSERVATION_INVENTORY");
  const keys = new Set();
  return rows
    .map((row) => {
      need(
        object(row) &&
          ["test", "example"].includes(row.kind) &&
          safePath(row.path) &&
          digest(row.inputSha256),
        "EVIDENCE_OBSERVATION_INVENTORY",
      );
      const key = row.kind + ":" + row.path;
      need(!keys.has(key), "EVIDENCE_DUPLICATE_OBSERVATION");
      keys.add(key);
      return { kind: row.kind, path: row.path, inputSha256: row.inputSha256 };
    })
    .sort((a, b) => (a.kind + ":" + a.path).localeCompare(b.kind + ":" + b.path, "en"));
}
export function validateBaseline(summary, entry, profile) {
  need(
    summary?.schemaVersion === 2 &&
      summary.kind === "nativr-package-check-summary" &&
      summary.package?.name === entry.name &&
      summary.package?.version === entry.version &&
      summary.provenance?.sourceSha256 === entry.sourceSha256 &&
      summary.provenance?.artifactSha256 === entry.artifactSha256 &&
      summary.provenance?.semanticProfile === profile &&
      summary.provenance?.oracle?.implementation === "GNU R" &&
      summary.provenance.oracle.version === "4.6.1",
    "EVIDENCE_BASELINE",
  );
  const observations = observationInventory(summary.observations);
  need(observations.length > 0, "EVIDENCE_OBSERVATION_INVENTORY");
  return observations;
}
export function validateSnapshot(rows) {
  need(Array.isArray(rows) && rows.length > 0, "EVIDENCE_SNAPSHOT");
  const names = new Set();
  const result = rows.map((row) => {
    need(
      object(row) &&
        safePath(row.path) &&
        digest(row.sha256) &&
        Number.isSafeInteger(row.bytes) &&
        row.bytes >= 0 &&
        !names.has(row.path),
      "EVIDENCE_SNAPSHOT",
    );
    names.add(row.path);
    return { path: row.path, bytes: row.bytes, sha256: row.sha256 };
  });
  return result.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
export function assertStable(before, after) {
  need(
    JSON.stringify(validateSnapshot(before)) === JSON.stringify(validateSnapshot(after)),
    "EVIDENCE_ARTIFACT_CHANGED",
  );
}
export function packageCheckArguments(root, entry, archive, rawOutput, rscript) {
  return [
    root + "/scripts/package-check.mjs",
    "--package",
    entry.name,
    "--source",
    archive,
    "--output",
    rawOutput,
    "--rscript",
    rscript,
    "--oracle-repeat",
    "--rng-seed",
    String(SETTINGS.rngSeed),
    "--max-steps",
    String(SETTINGS.maxSteps),
    "--max-vector-length",
    String(SETTINGS.maxVectorLength),
  ];
}

function rejectAssisted(report) {
  const forbidden = [
    "kind",
    "runner",
    "substitutions",
    "assisted",
    "runnerAssisted",
    "normativeTierCredit",
    "originalDependencyClosureSatisfied",
  ];
  need(
    forbidden.every((key) => !Object.hasOwn(report, key)) &&
      !Object.hasOwn(report.executionProfile ?? {}, "runner") &&
      !Object.hasOwn(report.executionProfile ?? {}, "substitutions"),
    "EVIDENCE_ASSISTED_REPORT",
  );
}

function originalEnvelope(report) {
  const keys = (value, allowed) =>
    need(
      object(value) && Object.keys(value).every((key) => allowed.includes(key)),
      "EVIDENCE_REPORT_SCHEMA",
    );
  // These keys come from the owned checker payload, not an arbitrary projection of another runner.
  keys(report, [
    "schemaVersion",
    "package",
    "provenance",
    "stages",
    "observations",
    "p7Eligible",
    "firstBlocker",
    "dependencyObservation",
    "descriptionAssessment",
    "declarationAssessment",
    "sourceDependencyAssessment",
    "sourceDependencyInputFailures",
    "licenseAssessment",
    "authorsObservation",
    "authorFieldsObservation",
    "authorMetadataAssessment",
    "lifecycleObservation",
    "cleanBaseObservation",
    "libraryPathObservation",
    "namespaceSourceAssessment",
    "documentationAssessment",
    "documentationObservation",
    "manualAssessment",
    "vignetteAssessment",
    "installation",
    "runners",
    "executionProfile",
    "inventory",
    "execution",
  ]);
  keys(report.package, ["name", "version", "license"]);
  keys(report.provenance, [
    "sourceSha256",
    "artifactSha256",
    "oracle",
    "semanticProfile",
    "capabilitySha256",
    "runtimeLimits",
  ]);
  keys(report.provenance.oracle, ["implementation", "version"]);
  keys(report.provenance.runtimeLimits, [
    "maxSteps",
    "maxCallDepth",
    "maxVectorLength",
    "maxOutputBytes",
    "maxPackageResourceBytes",
  ]);
  keys(report.executionProfile, [
    "conditionObservation",
    "execution",
    "runtimeProfile",
    "rng",
    "oracleRepeat",
    "sourcePlatform",
    "capture",
    "outputOrderCapture",
    "oracle",
    "limitations",
  ]);
  keys(report.executionProfile.oracle, [
    "version",
    "packageVersion",
    "newlineTransport",
    "installationExitCode",
    "installationSignal",
  ]);
  keys(report.executionProfile.rng, ["policy", "seed", "kinds"]);
}

/** Full original-entrypoint reports only. Compatibility failure is not infrastructure failure. */
export function validatePackageReport(raw, expected, exitCode) {
  need(
    raw instanceof Uint8Array && raw.byteLength > 0 && raw.byteLength <= SETTINGS.maxReportBytes,
    "EVIDENCE_REPORT_SIZE",
  );
  let report;
  try {
    report = JSON.parse(Buffer.from(raw).toString("utf8"));
  } catch {
    throw new EvidenceFault("EVIDENCE_REPORT_JSON");
  }
  need(object(report) && report.schemaVersion === 1, "EVIDENCE_REPORT_SCHEMA");
  rejectAssisted(report);
  originalEnvelope(report);
  need(
    report.package?.name === expected.entry.name &&
      report.package?.version === expected.entry.version,
    "EVIDENCE_REPORT_PACKAGE",
  );
  const p = report.provenance;
  need(
    object(p) &&
      p.sourceSha256 === expected.entry.sourceSha256 &&
      p.artifactSha256 === expected.entry.artifactSha256,
    "EVIDENCE_REPORT_PINS",
  );
  need(
    p.semanticProfile === expected.semanticProfile &&
      p.capabilitySha256 === expected.capabilitySha256,
    "EVIDENCE_REPORT_STALE",
  );
  need(
    p.oracle?.implementation === "GNU R" && p.oracle.version === "4.6.1",
    "EVIDENCE_ORACLE_VERSION",
  );
  for (const key of [
    "maxSteps",
    "maxCallDepth",
    "maxVectorLength",
    "maxOutputBytes",
    "maxPackageResourceBytes",
  ])
    need(p.runtimeLimits?.[key] === SETTINGS[key], "EVIDENCE_REPORT_SETTINGS");
  const profile = report.executionProfile;
  need(
    profile?.execution === "inline" &&
      profile.runtimeProfile === "package-test" &&
      profile.capture === "native-rscript-top-level-v1" &&
      profile.oracleRepeat === true &&
      profile.rng?.policy === "explicit-seed-v1" &&
      profile.rng.seed === SETTINGS.rngSeed &&
      JSON.stringify(profile.rng.kinds) === JSON.stringify(KINDS) &&
      profile.outputOrderCapture === "merged-handle-unique-alignment-v1",
    "EVIDENCE_REPORT_SETTINGS",
  );
  need(
    profile.oracle?.version === "4.6.1" &&
      profile.oracle.packageVersion === nativePackageVersion(expected.entry.version) &&
      profile.oracle.installationExitCode === 0 &&
      profile.oracle.installationSignal === null,
    "EVIDENCE_ORACLE_IDENTITY",
  );
  need(
    typeof report.p7Eligible === "boolean" &&
      [0, 1].includes(exitCode) &&
      exitCode === (report.p7Eligible ? 0 : 1),
    "EVIDENCE_CHILD_EXIT",
  );
  need(
    Array.isArray(report.stages) && report.stages.length === STAGES.length,
    "EVIDENCE_STAGE_INVENTORY",
  );
  const stages = new Set();
  for (const stage of report.stages) {
    need(
      STAGES.includes(stage.id) &&
        !stages.has(stage.id) &&
        STATUSES.includes(stage.status) &&
        typeof stage.reason === "string" &&
        Array.isArray(stage.discovered) &&
        Array.isArray(stage.executed),
      "EVIDENCE_STAGE_INVENTORY",
    );
    stages.add(stage.id);
  }
  if (report.p7Eligible)
    need(
      report.firstBlocker === null &&
        report.stages.every((s) => ["passed", "inapplicable"].includes(s.status)),
      "EVIDENCE_P7_INCONSISTENT",
    );
  else
    need(
      object(report.firstBlocker) &&
        ["provenance", ...STAGES].includes(report.firstBlocker.stage) &&
        token(report.firstBlocker.code),
      "EVIDENCE_BLOCKER",
    );
  if (report.p7Eligible)
    need(
      report.stages.every((stage) =>
        stage.status === "inapplicable"
          ? ![
              "archive-artifact",
              "metadata-dependencies",
              "installation-loading",
              "namespace-source",
            ].includes(stage.id) &&
            stage.discovered.length === 0 &&
            stage.executed.length === 0
          : stage.discovered.length > 0 &&
            stage.discovered.every(
              (item) => typeof item === "string" && stage.executed.includes(item),
            ) &&
            stage.executed.every(
              (item) => typeof item === "string" && stage.discovered.includes(item),
            ),
      ),
      "EVIDENCE_P7_INCONSISTENT",
    );
  if (!report.p7Eligible && report.firstBlocker.stage !== "provenance")
    need(
      report.stages.some(
        (stage) =>
          stage.id === report.firstBlocker.stage && ["failed", "unexecuted"].includes(stage.status),
      ),
      "EVIDENCE_BLOCKER",
    );
  need(
    Array.isArray(report.observations) && Array.isArray(report.execution),
    "EVIDENCE_OBSERVATION_INVENTORY",
  );
  const execution = observationInventory(
    report.execution.map((row) => ({ ...row, inputSha256: row.sourceSha256 })),
  );
  const observations = observationInventory(
    report.observations.map((row) => ({
      ...row,
      inputSha256: execution.find((e) => e.kind === row.kind && e.path === row.path)?.inputSha256,
    })),
  );
  const baseline = observationInventory(expected.observations);
  need(
    JSON.stringify(observations) === JSON.stringify(baseline) &&
      JSON.stringify(execution) === JSON.stringify(baseline),
    "EVIDENCE_OBSERVATION_INCOMPLETE",
  );
  for (const row of report.observations) {
    need(
      CAPTURES.includes(row.actual?.status) &&
        CAPTURES.includes(row.expected?.status) &&
        COMPARISONS.includes(row.comparison?.outcome) &&
        typeof row.expected?.repeatable === "boolean",
      "EVIDENCE_CAPTURE",
    );
  }
  if (report.p7Eligible)
    need(
      report.observations.every(
        (row) =>
          row.actual.status === "completed" &&
          row.expected.status === "completed" &&
          row.expected.repeatable === true &&
          row.actual.freshSession === true &&
          row.expected.freshSession === true &&
          row.actual.outputComplete === true &&
          row.expected.outputComplete === true &&
          row.actual.conditionsComplete === true &&
          row.expected.conditionsComplete === true &&
          Array.isArray(row.actual.outputOrder) &&
          Array.isArray(row.expected.outputOrder) &&
          row.comparison.outcome === "match" &&
          row.comparison.crossStreamOrder === "compared" &&
          row.comparison.outputEvidence === "complete" &&
          row.comparison.conditionEvidence === "complete",
      ),
      "EVIDENCE_P7_INCONSISTENT",
    );
  need(
    object(report.inventory) &&
      Array.isArray(report.inventory.paths) &&
      report.inventory.paths.every((file) => typeof file === "string") &&
      Array.isArray(report.inventory.nestedRFiles),
    "EVIDENCE_REPORT_INVENTORY",
  );
  const inventoriedNestedFiles = report.inventory.paths.filter((file) =>
    /^tests\/(?:[^/]+\/)+[^/]+\.[Rr]$/u.test(file),
  );
  need(
    new Set(inventoriedNestedFiles).size === inventoriedNestedFiles.length &&
      inventoriedNestedFiles.length === report.inventory.nestedRFiles.length &&
      inventoriedNestedFiles.every((file) => report.inventory.nestedRFiles.includes(file)),
    "EVIDENCE_NESTED_TEST_COVERAGE",
  );
  need(
    hasAdmissibleNestedTestCoverage(
      report.inventory.nestedRFiles,
      report.stages.find((stage) => stage.id === "package-tests"),
      report.p7Eligible,
    ),
    "EVIDENCE_NESTED_TEST_COVERAGE",
  );
  for (const name of ["tests", "examples"])
    need(
      object(report.runners?.[name]) && RUNNERS.includes(report.runners[name].outcome),
      "EVIDENCE_RUNNER",
    );
  let summary;
  try {
    summary = redactPackageCheck(raw);
  } catch {
    throw new EvidenceFault("EVIDENCE_REDACTION");
  }
  need(
    summary.redaction.rawOutputIncluded === false &&
      summary.redaction.rawConditionsIncluded === false &&
      summary.redaction.sourceIncluded === false,
    "EVIDENCE_REDACTION",
  );
  return summary;
}

/** Fixed pair completeness and stable provenance, without assigning or promoting corpus tiers. */
export function evidenceIndex({
  expected,
  results,
  before,
  after,
  host,
  head,
  recordedAt,
  failures = [],
}) {
  need(
    version(expected?.semanticProfile) &&
      version(expected?.baselineProfile) &&
      digest(expected?.capabilitySha256) &&
      Array.isArray(expected.packages) &&
      expected.packages.length === PACKAGE_NAMES.length &&
      PACKAGE_NAMES.every(
        (name) => expected.packages.filter((entry) => entry.name === name).length === 1,
      ),
    "EVIDENCE_INDEX_EXPECTATION",
  );
  const faults = [];
  try {
    assertStable(before, after);
  } catch (error) {
    faults.push(safeFailure("stability", error));
  }
  if (
    !Array.isArray(results) ||
    results.length !== PACKAGE_NAMES.length ||
    new Set(results.map((r) => r.name)).size !== PACKAGE_NAMES.length ||
    !PACKAGE_NAMES.every((name) =>
      results.some(
        (r) =>
          r.name === name &&
          r.validated === true &&
          typeof r.p7Eligible === "boolean" &&
          digest(r.summarySha256),
      ),
    )
  )
    faults.push({ stage: "summary", code: "EVIDENCE_PAIR_INCOMPLETE", redacted: true });
  need(/^[a-f0-9]{40,64}$/.test(head ?? ""), "EVIDENCE_HEAD");
  need(
    typeof recordedAt === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(recordedAt),
    "EVIDENCE_DATE",
  );
  need(
    Number.isFinite(Date.parse(recordedAt)) && new Date(recordedAt).toISOString() === recordedAt,
    "EVIDENCE_DATE",
  );
  need(
    ["win32", "darwin", "linux"].includes(host?.platform) &&
      ["x64", "arm64"].includes(host.arch) &&
      /^v24\.\d+\.\d+$/.test(host.nodeVersion ?? ""),
    "EVIDENCE_HOST",
  );
  for (const failure of failures) faults.push(safeFailure(failure.stage, failure.error));
  return {
    schemaVersion: 1,
    kind: "nativr-offline-original-package-evidence",
    ok: faults.length === 0,
    recordedAt,
    head,
    semanticProfile: expected.semanticProfile,
    capabilitySha256: expected.capabilitySha256,
    observationBaselineProfile: expected.baselineProfile,
    runner: "original-package-entrypoints",
    normativeTierCredit: false,
    oracle: {
      implementation: "GNU R",
      version: "4.6.1",
      platform: host.platform,
      classification: "advisory-local-not-rfc-0007-gate",
    },
    host: { platform: host.platform, arch: host.arch, nodeVersion: host.nodeVersion },
    settings: { ...SETTINGS },
    stableArtifacts: faults.every((f) => f.stage !== "stability"),
    provenance: validateSnapshot(before),
    packages: PACKAGE_NAMES.map((name) => {
      const result = Array.isArray(results) ? results.find((r) => r.name === name) : undefined;
      const entry = expected.packages.find((p) => p.name === name);
      need(
        entry &&
          token(entry.version) &&
          ["development", "regression"].includes(entry.partition) &&
          digest(entry.sourceSha256) &&
          digest(entry.artifactSha256),
        "EVIDENCE_PACKAGE_PINS",
      );
      return {
        name,
        version: entry.version,
        partition: entry.partition,
        sourceSha256: entry.sourceSha256,
        artifactSha256: entry.artifactSha256,
        outcome: result?.validated === true ? "reported" : "unreported",
        p7Eligible: result?.validated === true ? result.p7Eligible === true : null,
        summary: result?.validated === true ? name + ".json" : null,
        summarySha256:
          result?.validated === true && digest(result.summarySha256) ? result.summarySha256 : null,
      };
    }),
    failures: faults,
    limitations: [
      "Evidence-run success means both complete original-entrypoint reports were captured and validated; it does not mean both packages pass P7.",
      "No corpus tier, source archive, partition, compatibility policy or normative platform claim is modified.",
      "Raw reports and child diagnostics are quarantined separately and are not publishable artifacts.",
    ],
  };
}
