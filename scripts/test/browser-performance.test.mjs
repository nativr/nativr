import assert from "node:assert/strict";
import test from "node:test";

import {
  BROWSER_NAMES,
  WORKLOAD_IDS,
  createBrowserPerformanceReport,
  parsePerformanceArguments,
  performanceSettings,
  safePerformanceFailure,
  summarizeTimings,
} from "../lib/browser-performance-report.mjs";

const hash = "a".repeat(64);
const evaluation = () => ({ wallMs: 2.5, evaluatorElapsedMs: 1, runtimeReset: false });
function fixture(pilot = true) {
  const settings = performanceSettings(pilot);
  const expected = {
    pilot,
    semanticProfileVersion: "0.380.0",
    package: {
      name: "numDeriv",
      version: "2016.8-1.1",
      partition: "regression",
      sourceSha256: hash,
      artifactSha256: "b".repeat(64),
    },
    runnerSha256: hash,
    harnessSha256: hash,
    reportHelperSha256: hash,
    distDigests: [
      "assets/worker-entry-owned.js",
      "elementary.wasm",
      "index.js",
      "tree-sitter-r.wasm",
      "web-tree-sitter.wasm",
    ].map((path) => ({ path, bytes: 100, sha256: hash })),
  };
  const startup = (fresh) => ({
    ok: true,
    semanticProfileVersion: expected.semanticProfileVersion,
    createRMs: 12,
    ...(fresh ? { moduleImportMs: 5 } : {}),
    firstEvaluation: evaluation(),
  });
  const input = {
    schemaVersion: 1,
    kind: "exploratory-browser-performance",
    settings,
    recordedAt: "2026-10-22T12:34:56.000Z",
    semanticProfileVersion: expected.semanticProfileVersion,
    package: structuredClone(expected.package),
    archiveVerified: true,
    artifactVerified: true,
    head: "c".repeat(40),
    playwrightVersion: "1.62.0",
    host: {
      os: "win32",
      release: "10.0.1",
      arch: "x64",
      nodeVersion: "v24.19.0",
      cpuModelSha256: hash,
      logicalCpuCount: 8,
    },
    runnerSha256: hash,
    harnessSha256: hash,
    reportHelperSha256: hash,
    distDigests: structuredClone(expected.distDigests),
    distStable: true,
    toolingStable: true,
    engines: BROWSER_NAMES.map((name) => ({
      name,
      version: "1.2.3",
      ok: true,
      clockResolutionMs: 1,
      freshContext: Array.from({ length: settings.startupFreshContextSamples }, () =>
        startup(true),
      ),
      sameDocument: {
        moduleImportMs: 4,
        samples: Array.from({ length: settings.startupSameDocumentSamples }, () => startup(false)),
      },
      cancellation: {
        ok: true,
        samples: Array.from({ length: settings.cancellationSamples }, () => ({
          submissionToInterruptMs: 100,
          rejectionLatencyMs: 0,
          restartReadyMs: 20,
          totalRecoveryMs: 23,
          recovery: evaluation(),
          pendingAtInterrupt: true,
          stateLossVerified: true,
          interruptionCode: "NRL4005",
          runtimeReset: true,
        })),
      },
      package: {
        ok: true,
        createRWithPackageMs: 30,
        namespaceLoad: evaluation(),
        workloads: WORKLOAD_IDS.map((id) => ({
          id,
          ok: true,
          warmupsCompleted: settings.packageWarmups,
          samples: Array.from({ length: settings.packageSamples }, evaluation),
        })),
      },
      externalRequestCount: 0,
      pageErrorCount: 0,
    })),
  };
  return { input, expected };
}
function rejected(mutator, fault) {
  const { input, expected } = fixture();
  mutator(input, expected);
  const report = createBrowserPerformanceReport(input, expected);
  assert.equal(report.ok, false);
  assert.ok(report.validationErrors.includes(fault), JSON.stringify(report.validationErrors));
  return report;
}

test("pilot and full reports retain exact samples, bounded provenance and separate module imports", () => {
  for (const pilot of [true, false]) {
    const { input, expected } = fixture(pilot);
    const report = createBrowserPerformanceReport(input, expected);
    assert.equal(report.ok, true, JSON.stringify(report.validationErrors));
    assert.equal(report.engines.length, 3);
    assert.equal(report.engines[0].package.workloads.length, 5);
    assert.equal(report.engines[0].freshContext.length, pilot ? 1 : 7);
    assert.equal(report.engines[0].sameDocument.moduleImportMs, 4);
    assert.equal(Object.hasOwn(report.engines[0].sameDocument.samples[0], "moduleImportMs"), false);
    assert.equal(report.engines[0].package.workloads[0].samples.length, pilot ? 1 : 9);
    assert.equal(report.engines[0].cancellation.samples[0].rejectionLatencyMs, 0);
    assert.match(report.limitations.join(" "), /below the observed clock resolution/);
    assert.match(report.limitations.join(" "), /excludes parsing/);
  }
});

test("descriptive timing summaries use a median and nearest-rank p95 without dropping outliers", () => {
  assert.deepEqual(summarizeTimings([100, 0, 2, 4]), {
    count: 4,
    medianMs: 3,
    empiricalP95Ms: 100,
    method: "nearest-rank",
    interpretation: "small-sample-descriptive-only",
  });
  assert.equal(summarizeTimings([3, 1, 2]).medianMs, 2);
  assert.equal(summarizeTimings([]).medianMs, null);
  for (const value of [NaN, Infinity, -1, "1"])
    assert.throws(() => summarizeTimings([value]), /finite and nonnegative/);
});

const failures = [
  [
    "contradictory workload success",
    (raw) => {
      raw.engines[0].package.workloads[0].failure = { stage: "package-workloads", code: "NRL4001" };
    },
    "workload-failed",
  ],
  [
    "wrong schema",
    (raw) => {
      raw.schemaVersion = 2;
    },
    "schema",
  ],
  ["missing engine", (raw) => raw.engines.pop(), "engine-count"],
  [
    "duplicate engine",
    (raw) => {
      raw.engines[1].name = raw.engines[0].name;
    },
    "engine-duplicates",
  ],
  ["missing startup", (raw) => raw.engines[0].freshContext.pop(), "fresh-count"],
  [
    "empty same-document samples",
    (raw) => {
      raw.engines[0].sameDocument.samples = [];
    },
    "same-count",
  ],
  [
    "missing cancellation",
    (raw) => raw.engines[0].cancellation.samples.pop(),
    "cancellation-count",
  ],
  ["missing workload", (raw) => raw.engines[0].package.workloads.pop(), "workload-count"],
  [
    "duplicate workload",
    (raw) => {
      raw.engines[0].package.workloads[1].id = WORKLOAD_IDS[0];
    },
    "workload-duplicates",
  ],
  [
    "missing workload timing",
    (raw) => raw.engines[0].package.workloads[0].samples.pop(),
    "workload-sample-count",
  ],
  [
    "unexpected warmup count",
    (raw) => {
      raw.engines[0].package.workloads[0].warmupsCompleted = 1;
    },
    "workload-failed",
  ],
  [
    "stale startup profile",
    (raw) => {
      raw.engines[0].freshContext[0].semanticProfileVersion = "0.379.0";
    },
    "startup-profile",
  ],
  [
    "stale report profile",
    (raw) => {
      raw.semanticProfileVersion = "0.379.0";
    },
    "profile",
  ],
  [
    "wrong source digest",
    (raw) => {
      raw.package.sourceSha256 = "d".repeat(64);
    },
    "package-pin",
  ],
  [
    "wrong artifact digest",
    (raw) => {
      raw.package.artifactSha256 = "d".repeat(64);
    },
    "package-pin",
  ],
  [
    "holdout input",
    (raw) => {
      raw.package.partition = "holdout";
    },
    "package-pin",
  ],
  [
    "unverified source",
    (raw) => {
      raw.archiveVerified = false;
    },
    "package-not-verified",
  ],
  [
    "unverified artifact",
    (raw) => {
      raw.artifactVerified = false;
    },
    "package-not-verified",
  ],
  [
    "changed distribution",
    (raw) => {
      raw.distStable = false;
    },
    "dist-changed",
  ],
  [
    "changed tooling",
    (raw) => {
      raw.toolingStable = false;
    },
    "tooling-changed",
  ],
  [
    "mismatched runner",
    (raw) => {
      raw.runnerSha256 = "d".repeat(64);
    },
    "tool-digest-mismatch",
  ],
  [
    "missing required asset",
    (raw) => {
      raw.distDigests = raw.distDigests.filter((file) => file.path !== "elementary.wasm");
    },
    "required-assets",
  ],
  [
    "external request",
    (raw) => {
      raw.engines[0].externalRequestCount = 1;
    },
    "browser-errors",
  ],
  [
    "page error",
    (raw) => {
      raw.engines[0].pageErrorCount = 1;
    },
    "browser-errors",
  ],
  [
    "unverified state loss",
    (raw) => {
      raw.engines[0].cancellation.samples[0].stateLossVerified = false;
    },
    "cancellation-contract",
  ],
  [
    "wrong interruption code",
    (raw) => {
      raw.engines[0].cancellation.samples[0].interruptionCode = "NRL4001";
    },
    "cancellation-contract",
  ],
  [
    "unexpected recovery reset",
    (raw) => {
      raw.engines[0].cancellation.samples[0].recovery.runtimeReset = true;
    },
    "unexpected-reset",
  ],
  [
    "negative duration",
    (raw) => {
      raw.engines[0].freshContext[0].createRMs = -1;
    },
    "startup-duration",
  ],
  [
    "nonfinite duration",
    (raw) => {
      raw.engines[0].package.workloads[0].samples[0].wallMs = Infinity;
    },
    "evaluation-duration",
  ],
  [
    "missing evaluator duration",
    (raw) => {
      delete raw.engines[0].package.workloads[0].samples[0].evaluatorElapsedMs;
    },
    "evaluator-duration",
  ],
  [
    "changed settings",
    (raw) => {
      raw.settings.packageSamples = 2;
    },
    "settings",
  ],
];
for (const [label, mutation, fault] of failures)
  test("rejects " + label, () => rejected(mutation, fault));

test("failed reports preserve safe partial timing and owned timeout stages, discarding foreign text", () => {
  const secret = "function copied_body() { C:/private/location; secret foreign output; }";
  const { input, expected } = fixture();
  input.source = secret;
  input.absolutePath = "C:/private/location";
  input.cachedBrowsers = [{ executablePath: "C:/private/location" }];
  input.engines[0].package.bundle = { code: secret };
  input.engines[0].package.workloads[0].output = secret;
  input.engines[0].package.workloads[0].failure = {
    stage: WORKLOAD_IDS[0],
    code: "NRL4002",
    message: secret,
    stack: secret,
  };
  input.engines[0].package.workloads[0].ok = false;
  input.engines[1].failure = {
    stage: "page-context",
    code: "BENCHMARK_TIMEOUT",
    message: secret,
    trace: secret,
  };
  input.engines[1].ok = false;
  const report = createBrowserPerformanceReport(input, expected);
  assert.equal(report.ok, false);
  assert.equal(report.engines[0].package.workloads[0].samples.length, 1);
  assert.equal(report.engines[1].failure.code, "BENCHMARK_TIMEOUT");
  assert.equal(report.engines[1].failure.stage, "page-context");
  assert.doesNotMatch(
    JSON.stringify(report),
    /copied_body|private|foreign output|executablePath|message|stack/,
  );
});

test("invalid paths and arbitrary version/host/failure strings are redacted, never serialized", () => {
  const { input, expected } = fixture();
  const secret = "/private/foreign-source";
  input.distDigests[0].path = secret;
  input.host.release = secret;
  input.host.os = secret;
  input.engines[0].version = secret;
  input.failure = { stage: secret, code: secret, message: secret };
  const report = createBrowserPerformanceReport(input, expected);
  assert.equal(report.ok, false);
  assert.doesNotMatch(JSON.stringify(report), /private|foreign-source/);
  assert.equal(report.failure.stage, "unclassified");
  assert.equal(report.failure.code, "unclassified");
});

test("missing measurements yield an explicit failed report rather than vacuous success", () => {
  const { expected } = fixture();
  const report = createBrowserPerformanceReport({}, expected);
  assert.equal(report.ok, false);
  assert.ok(report.validationErrors.includes("engine-count"));
  assert.deepEqual(report.engines, []);
});

test("CLI defaults to preflight, takes explicit archive/output paths, and rejects ambiguous flags", () => {
  assert.deepEqual(parsePerformanceArguments([]), { run: false, pilot: false });
  assert.deepEqual(
    parsePerformanceArguments([
      "--run",
      "--pilot",
      "--archive",
      "cached file.tgz",
      "--output",
      "reports",
    ]),
    { run: true, pilot: true, archive: "cached file.tgz", output: "reports" },
  );
  for (const args of [["--download"], ["--archive"], ["--output", "--run"], ["--run", "--run"]])
    assert.throws(() => parsePerformanceArguments(args));
  assert.equal(
    safePerformanceFailure("page-context", { code: "BENCHMARK_TIMEOUT", stack: "private" }).code,
    "BENCHMARK_TIMEOUT",
  );
});
