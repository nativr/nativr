import {
  capturedRunMetadata,
  prepareCapturedRun,
  executeCapturedRun,
} from "../lib/assisted-test-runner/capture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createAdmission,
  projectEvaluation,
  rejectNormativeTierCredit,
  validateAssistedReport,
  validateAssistedArtifactBytes,
  sha256,
  ProjectionError,
} from "../lib/assisted-test-runner/projection.mjs";
import {
  clone,
  metadata,
  path,
  event,
  rawReport,
  passEvents,
  evaluation,
} from "./fixtures/assisted-test-runner/transport.mjs";
const project = (raw = rawReport(passEvents), meta = metadata) =>
  projectEvaluation(createAdmission(meta), evaluation(raw));
const rejects = (fn, code) =>
  assert.throws(fn, (error) => error instanceof ProjectionError && (!code || error.code === code));

test("all-pass assisted report is hashed, immutable and never qualified", () => {
  const result = project();
  assert.equal(result.report.execution.outcome, "completed");
  assert.equal(result.derived.counts.passed, 1);
  assert.equal(result.report.kind, "nativr-runner-assisted-report");
  assert.equal(result.report.normativeTierCredit, false);
  assert.equal(result.report.originalDependencyClosureSatisfied, false);
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  assert(Object.isFrozen(result.report.events[0]));
  rejects(
    () => rejectNormativeTierCredit(result.report),
    "assisted-evidence-has-no-normative-tier-credit",
  );
});
test("host metadata is snapshotted before caller mutation", () => {
  const m = clone(metadata),
    admission = createAdmission(m);
  m.input.package.name = "Forged";
  m.input.files[0].path = "other.R";
  assert.equal(
    projectEvaluation(admission, evaluation()).report.input.package.name,
    "OwnedRunnerFixture",
  );
  rejects(() => projectEvaluation({}, evaluation()), "unrecognized-host-admission");
});
test("unknown root fields and forged count aggregates reject", () => {
  for (const fields of [
    { p7Eligible: true },
    { counts: { passed: 7 } },
    { body: "private" },
    { normativeTierCredit: true },
  ])
    rejects(() => project({ ...rawReport(passEvents), ...fields }));
});
test("event sequence duplication and gaps reject", () => {
  for (const value of [0, 8]) {
    const raw = rawReport(passEvents);
    raw.events[3].sequence = value;
    rejects(() => project(raw));
  }
});
test("invalid report kind, runner identity and qualification flags reject", () => {
  for (const mutate of [
    (r) => (r.kind = "package-check"),
    (r) => (r.runner.package = "testthat"),
    (r) => (r.runner.version = "3.3.2"),
    (r) => (r.originalDependencyClosureSatisfied = true),
  ]) {
    const r = rawReport(passEvents);
    mutate(r);
    rejects(() => project(r));
  }
});
test("lossless raw snapshot is mandatory and reconciled against friendly value", () => {
  for (const mutate of [
    (e) => (e.raw = null),
    (e) => (e.value[0] = "forged"),
    (e) => (e.raw.names[1] = e.raw.names[0]),
    (e) => (e.raw.values[0] = { version: 1, type: "language", source: "private" }),
  ]) {
    const e = evaluation();
    mutate(e);
    rejects(() => projectEvaluation(createAdmission(metadata), e));
  }
});
test("accessor input is rejected without invoking getter", () => {
  const e = evaluation();
  let called = false;
  Object.defineProperty(e, "value", {
    get() {
      called = true;
      return null;
    },
    enumerable: true,
  });
  rejects(() => projectEvaluation(createAdmission(metadata), e));
  assert.equal(called, false);
});
test("duplicate named-list keys and unexpected atomic attributes reject", () => {
  const e = evaluation();
  e.raw.values[0].names = ["unexpected"];
  rejects(() => projectEvaluation(createAdmission(metadata), e));
  const m = clone(metadata);
  m.input.files.push(clone(m.input.files[0]));
  rejects(() => createAdmission(m), "duplicate-path");
});
test("selected file names, order and coverage are host bound", () => {
  const r = rawReport(passEvents);
  r.events[1].path = "tests/other.R";
  rejects(() => project(r), "file-selection-mismatch");
  const m = clone(metadata);
  m.input.files.push({ ...m.input.files[0], path: "tests/second.R" });
  rejects(() => project(rawReport(passEvents), m), "missing-selected-file");
});
test("holdout and unsafe paths reject before execution", () => {
  const m = clone(metadata);
  m.input.partition = "holdout";
  rejects(() => createAdmission(m));
  for (const path of ["../x.R", "/x.R", "C:/x.R", "tests\\x.R", "tests//x.R", "tests/./x.R"]) {
    const a = clone(metadata);
    a.input.files[0].path = path;
    rejects(() => createAdmission(a), "unsafe-path");
  }
});
test("selected helper discovery is explicitly unsupported", () => {
  const m = clone(metadata);
  m.input.files[0].role = "helper";
  rejects(() => createAdmission(m), "unsupported-selected-file-role");
});
test("incomplete selection cannot publish completed outcome", () => {
  const m = clone(metadata);
  m.input.selectionComplete = false;
  const p = project(rawReport(passEvents), m);
  assert.equal(p.report.execution.outcome, "partial");
  assert.equal(p.derived.firstBlocker.code, "selection-incomplete");
});
test("scope mismatches, post-end events and duplicate test IDs reject", () => {
  for (const mutate of [
    (r) => (r.events[3].testId = 2),
    (r) => (r.events[4].testId = 2),
    (r) => (r.events[2].testId = 2),
    (r) => r.events.push({ ...r.events[3], sequence: 7 }),
  ]) {
    const r = rawReport(passEvents);
    mutate(r);
    rejects(() => project(r));
  }
});
test("failed expectation cannot be hidden by passed test or run", () => {
  const r = rawReport(passEvents);
  r.events[3].outcome = "failed";
  rejects(() => project(r), "forged-test-outcome");
  r.events[4].outcome = "failed";
  rejects(() => project(r), "forged-run-outcome");
  r.outcome = "failed";
  const p = project(r);
  assert.equal(p.derived.counts.failed, 1);
  assert.equal(p.derived.counts.failedExpectations, 1);
});
test("skip retains failed assertions and cannot become pass", () => {
  const e = clone(passEvents);
  e[3].outcome = "failed";
  e.splice(4, 0, event("skip", { testId: 1, message: "PRIVATE skip" }));
  e[5].outcome = "skipped";
  const p = project(rawReport(e, "failed"));
  assert.equal(p.derived.counts.skipped, 1);
  assert.equal(p.derived.counts.failedExpectations, 1);
  assert.equal(p.report.execution.outcome, "failed");
  e[5].outcome = "passed";
  rejects(() => project(rawReport(e, "failed")), "forged-test-outcome");
});
test("caught unsupported API marks affected test unsupported despite private passed end", () => {
  const e = clone(passEvents);
  e.splice(
    3,
    0,
    event("issue", {
      path,
      testId: 1,
      code: "unsupported-api",
      api: "expect_identical: waldo comparison",
      message: "PRIVATE waldo",
    }),
  );
  const p = project(rawReport(e, "partial"));
  assert.equal(p.report.events.find((e) => e.type === "test-end").outcome, "unsupported");
  assert.equal(p.derived.counts.passed, 0);
  assert.equal(p.derived.counts.unsupported, 1);
  rejects(() => project(rawReport(e, "completed")), "forged-run-outcome");
});
test("unknown unsupported API identity rejects rather than sanitizing to support", () => {
  const e = clone(passEvents);
  e.splice(
    3,
    0,
    event("issue", {
      path,
      testId: 1,
      code: "unsupported-api",
      api: "arbitrary source()",
      message: "private",
    }),
  );
  rejects(() => project(rawReport(e, "partial")), "unknown-unsupported-api");
});
test("unexpected error issue cannot coexist with passing test outcome", () => {
  const e = clone(passEvents);
  e.splice(
    4,
    0,
    event("issue", {
      path,
      testId: 1,
      code: "unexpected-error",
      api: null,
      message: "owned error",
    }),
  );
  rejects(() => project(rawReport(e, "failed")), "error-issue-without-condition");
});
test("ordinary error pair is preserved and classified", () => {
  const e = clone(passEvents);
  e.splice(
    3,
    1,
    event("condition", {
      testId: 1,
      conditionKind: "error",
      classNames: ["error", "condition"],
      message: "PRIVATE error",
      handled: true,
    }),
    event("issue", {
      path,
      testId: 1,
      code: "unexpected-error",
      api: null,
      message: "PRIVATE error",
    }),
  );
  e[5].outcome = "error";
  const p = project(rawReport(e, "failed"));
  assert.equal(p.derived.counts.error, 1);
  assert.equal(p.report.events[3].messageSha256.length, 64);
});
test("condition class vector with one entry remains a vector", () => {
  const e = clone(passEvents);
  e.splice(
    3,
    0,
    event("condition", {
      testId: 1,
      conditionKind: "warning",
      classNames: ["warning"],
      message: "private",
      handled: true,
    }),
  );
  assert.deepEqual(project(rawReport(e)).report.events[3].classNames, ["warning"]);
});
test("nonvector classNames and condition calls cannot enter published records", () => {
  const e = clone(passEvents);
  e.splice(
    3,
    0,
    event("condition", {
      testId: 1,
      conditionKind: "warning",
      classNames: 7,
      message: "private",
      handled: true,
    }),
  );
  rejects(() => project(rawReport(e)));
  e[3].classNames = ["warning"];
  e[3].call = "private source()";
  rejects(() => project(rawReport(e)), "invalid-event-fields");
});
test("cleanup failure forces failed aggregate even with passing body", () => {
  const e = clone(passEvents);
  e.splice(
    5,
    0,
    event("lifecycle", { path, testId: null, phase: "cleanup", outcome: "started" }),
    event("issue", {
      path,
      testId: null,
      code: "cleanup-failed",
      api: null,
      message: "PRIVATE cleanup",
    }),
    event("lifecycle", { path, testId: null, phase: "cleanup", outcome: "failed" }),
  );
  const p = project(rawReport(e, "failed"));
  assert.equal(p.derived.counts.passed, 1);
  assert.equal(p.report.execution.outcome, "failed");
  rejects(() => project(rawReport(e)), "forged-run-outcome");
  e[7].outcome = "completed";
  rejects(() => project(rawReport(e, "failed")), "forged-lifecycle-outcome");
});
test("empty test needs explicit no-expectations issue and skipped outcome", () => {
  const e = clone(passEvents);
  e[3] = event("issue", { path, testId: 1, code: "no-expectations", api: null, message: "empty" });
  e[4].outcome = "skipped";
  assert.equal(project(rawReport(e)).derived.counts.skipped, 1);
  e.splice(3, 1);
  e[3].outcome = "passed";
  rejects(() => project(rawReport(e)), "forged-test-outcome");
});
test("incomplete core prefix is aborted, never completed", () => {
  const r = rawReport(passEvents.slice(0, 3), "aborted", false),
    p = project(r);
  assert.equal(p.report.execution.outcome, "aborted");
  assert.equal(p.report.execution.capture.eventsComplete, false);
  assert.equal(p.derived.counts.tests, 1);
  assert.equal(p.derived.counts.aborted, 1);
  r.eventsComplete = true;
  rejects(() => project(r), "forged-capture-completeness");
});
test("complete error condition requires the matching issue; an aborted prefix remains incomplete", () => {
  const e = clone(passEvents);
  e[3] = event("condition", {
    testId: 1,
    conditionKind: "error",
    classNames: ["error", "condition"],
    message: "private",
    handled: true,
  });
  e[4].outcome = "error";
  rejects(() => project(rawReport(e, "failed")), "error-condition-without-issue");
  const p = project(rawReport(e.slice(0, 4), "aborted", false));
  assert.equal(p.report.execution.outcome, "aborted");
  assert.equal(p.derived.counts.aborted, 1);
});
test("aborted finalization with closed file but missing run-end is retained", () => {
  const r = rawReport(passEvents.slice(0, -1), "aborted", false);
  assert.equal(project(r).report.execution.outcome, "aborted");
});
test("missing run start, repeated start, and incomplete falsely ended graph reject", () => {
  for (const e of [
    passEvents.slice(1),
    [passEvents[0], passEvents[0], ...passEvents.slice(1)],
    passEvents.slice(0, 3).concat(event("run-end")),
  ])
    rejects(() => project(rawReport(e)));
});
test("outer output, warnings, errors and effects fail closed without exposing text", () => {
  for (const key of [
    "output",
    "warnings",
    "topLevelErrors",
    "dataViews",
    "browseRequests",
    "graphics",
  ]) {
    const e = evaluation();
    e[key] = [{ text: "PRIVATE foreign output" }];
    rejects(() => projectEvaluation(createAdmission(metadata), e), "unaccounted-host-effects");
  }
});
test("runtime reset and invalid elapsed time reject", () => {
  const e = evaluation();
  e.runtimeReset = true;
  rejects(() => projectEvaluation(createAdmission(metadata), e));
  e.runtimeReset = false;
  e.elapsedMs = Infinity;
  rejects(() => projectEvaluation(createAdmission(metadata), e));
});
test("record and event limits are enforced before projection", () => {
  const m = clone(metadata);
  m.execution.reporterLimits.maxEvents = 2;
  rejects(() => project(rawReport(passEvents), m), "invalid-array");
  const n = clone(metadata);
  n.execution.reporterLimits.maxRecordBytes = 128;
  const e = clone(passEvents);
  e[2].description = "x".repeat(129);
  rejects(() => project(rawReport(e), n), "invalid-text");
});
test("all-pass assisted metadata cannot be relabeled into normative evidence", () => {
  const p = project().report;
  for (const renamed of [
    p,
    { ...p, kind: "package-check" },
    { ...p, kind: "package-check", schemaVersion: 2 },
  ])
    rejects(
      () => rejectNormativeTierCredit(renamed),
      "assisted-evidence-has-no-normative-tier-credit",
    );
});
test("stored public artifact validates with trusted byte digest and rejects mutations", () => {
  const report = project().report,
    bytes = new TextEncoder().encode(JSON.stringify(report));
  assert.equal(validateAssistedArtifactBytes(bytes, sha256(bytes)).derived.counts.passed, 1);
  rejects(() => validateAssistedArtifactBytes(bytes, sha256("wrong")), "artifact-digest-mismatch");
  const changed = clone(report);
  changed.events[3].message = "PRIVATE";
  rejects(() => validateAssistedReport(changed), "invalid-public-event-fields");
  const forged = clone(report);
  forged.events[3].outcome = "failed";
  rejects(() => validateAssistedReport(forged));
});
test("stored unsupported and incomplete-selection reports retain conservative outcomes", () => {
  const e = clone(passEvents);
  e.splice(
    3,
    0,
    event("issue", {
      path,
      testId: 1,
      code: "unsupported-api",
      api: "expect_identical: waldo comparison",
      message: "private",
    }),
  );
  const p = project(rawReport(e, "partial"));
  assert.equal(validateAssistedReport(p.report).derived.counts.unsupported, 1);
  const forged = clone(p.report);
  forged.events.find((e) => e.type === "test-end").outcome = "passed";
  rejects(() => validateAssistedReport(forged), "forged-public-test-outcome");
  const m = clone(metadata);
  m.input.selectionComplete = false;
  assert.equal(
    validateAssistedReport(project(rawReport(passEvents), m).report).report.execution.outcome,
    "partial",
  );
});
test("minimum raw record bound round-trips after short text becomes fixed hash", () => {
  const m = clone(metadata);
  m.execution.reporterLimits.maxRecordBytes = 128;
  const e = clone(passEvents);
  e[2].description = "t";
  e[3].message = "m";
  const p = project(rawReport(e), m);
  assert.equal(validateAssistedReport(p.report).report.execution.outcome, "completed");
});

const capabilities = { semanticProfileVersion: "0.388.0", languageSubsetVersion: "0.388.0" };
const bundle = {
  description: "Package: nativrTest\nVersion: 0.1.0\n",
  namespace: "export(run_tests)",
  rSources: [{ path: "R/runner.R", source: "owned_runner <- TRUE" }],
};
const sources = [{ path, source: 'test_that("owned",pass())' }];
function fixture() {
  const m = clone(metadata);
  m.runner.sourceSha256 = sha256(bundle.rSources[0].source);
  m.runner.bundleSha256 = sha256(JSON.stringify(bundle));
  m.input.dependencies[0].artifactSha256 = m.runner.bundleSha256;
  m.input.files[0].sha256 = sha256(sources[0].source);
  m.execution.capabilitySha256 = sha256(JSON.stringify(capabilities));
  return { m, plan: prepareCapturedRun(m, sources, bundle) };
}
function sessionFactory({
  modify = () => {},
  error = false,
  disposeError = false,
  callback = false,
  capabilities_ = capabilities,
} = {}) {
  let calls = 0,
    disposed = 0,
    options;
  return {
    create: async (received) => {
      options = received;
      return {
        capabilities: async () => capabilities_,
        evalDetailed: async (code) => {
          calls++;
          if (error) throw Error("PRIVATE source");
          if (callback) received.onOutput({ text: "PRIVATE body" });
          const r = evaluation();
          modify(r, calls, code);
          return r;
        },
        dispose: async () => {
          disposed++;
          if (disposeError) throw Error("PRIVATE disposal");
        },
      };
    },
    stats: () => ({ calls, disposed, options }),
  };
}
test("host builds pinned source wrapper and controls fresh session options", async () => {
  const { plan } = fixture(),
    factory = sessionFactory();
  const result = await executeCapturedRun(plan, factory.create, {});
  assert.equal(result.kind, "nativr-assisted-attempt-complete");
  assert.equal(result.report.execution.outcome, "completed");
  assert.equal(factory.stats().calls, 2);
  assert.equal(factory.stats().disposed, 1);
  assert.equal(factory.stats().options.runtimeProfile, "package-test");
  assert.equal(result.normativeTierCredit, false);
  assert.equal(JSON.stringify(result).includes("test_that"), false);
});
test("source mutations, ordering and runner bundle mutations reject before session", () => {
  const { m } = fixture();
  for (const changed of [
    [{ path, source: "changed" }],
    [{ path: "else.R", source: sources[0].source }],
    [],
  ])
    assert.throws(() => prepareCapturedRun(m, changed, bundle), ProjectionError);
  assert.throws(
    () => prepareCapturedRun(m, sources, { ...bundle, namespace: "altered" }),
    ProjectionError,
  );
});
test("plan snapshots mutable metadata and source bundle", async () => {
  const { m } = fixture(),
    b = clone(bundle),
    s = clone(sources),
    plan = prepareCapturedRun(m, s, b);
  s[0].source = "PRIVATE mutation";
  b.rSources[0].source = "PRIVATE mutation";
  m.execution.mode = "worker";
  const factory = sessionFactory(),
    result = await executeCapturedRun(plan, factory.create, {});
  assert.equal(result.report.execution.mode, "inline");
  assert.equal(factory.stats().options.packages[0].rSources[0].source, bundle.rSources[0].source);
});
test("callback-only output causes rejection even if result omits it", async () => {
  const factory = sessionFactory({ callback: true }),
    result = await executeCapturedRun(fixture().plan, factory.create, {});
  assert.equal(result.kind, "nativr-assisted-attempt-rejection");
  assert.equal(result.code, "unaccounted-host-effects");
  assert.equal(factory.stats().disposed, 1);
  assert(!JSON.stringify(result).includes("PRIVATE"));
});
test("initialization output and profile mismatch fail closed", async () => {
  for (const factory of [
    sessionFactory({
      modify: (r, calls) => {
        if (calls === 1) r.output = [{ text: "PRIVATE" }];
      },
    }),
    sessionFactory({ capabilities_: { ...capabilities, semanticProfileVersion: "0.389.0" } }),
  ]) {
    const result = await executeCapturedRun(fixture().plan, factory.create, {});
    assert.equal(result.kind, "nativr-assisted-attempt-rejection");
    assert.equal(factory.stats().disposed, 1);
    assert(!JSON.stringify(result).includes("PRIVATE"));
  }
});
test("evaluation failure or cancellation never produces a partial success", async () => {
  const factory = sessionFactory({ error: true }),
    result = await executeCapturedRun(fixture().plan, factory.create, {});
  assert.equal(result.code, "evaluation-or-capture-failed");
  assert.equal(factory.stats().disposed, 1);
  assert(!JSON.stringify(result).includes("PRIVATE"));
});
test("host disposal failure blocks previously passing report", async () => {
  const result = await executeCapturedRun(
    fixture().plan,
    sessionFactory({ disposeError: true }).create,
    {},
  );
  assert.equal(result.code, "session-disposal-failed");
  assert.equal("report" in result, false);
});
test("forged plan handles and reporter controls reject", async () => {
  const result = await executeCapturedRun(
    {},
    () => {
      throw Error("must not run");
    },
    {},
  );
  assert.equal(result.code, "unrecognized-host-plan");
  const { m } = fixture();
  for (const controls of [
    { maxEvents: 1000, maxTextBytes: 0 },
    { maxEvents: 20000, maxTextBytes: 1 },
    { maxEvents: 3, maxTextBytes: 1 },
  ])
    assert.throws(() => prepareCapturedRun(m, sources, bundle, controls), ProjectionError);
});
test("aggregate input and runner bounds reject before wrapper construction", () => {
  const { m } = fixture();
  const source = "x".repeat(140000),
    s = [
      { path, source },
      { path: "tests/second.R", source },
    ];
  m.input.files = s.map((f) => ({
    path: f.path,
    sha256: sha256(f.source),
    role: "test",
    selection: "selected",
  }));
  assert.throws(
    () => prepareCapturedRun(m, s, bundle),
    (e) => e.code === "aggregate-source-limit",
  );
  const { m: n } = fixture();
  assert.throws(
    () => prepareCapturedRun(n, sources, { ...bundle, namespace: "x".repeat(262145) }),
    (e) => e.code === "runner-bundle-size-limit",
  );
});
test("uninstalled dependency provenance is not admitted", () => {
  const { m } = fixture();
  m.input.dependencies.push({
    name: "other",
    version: "1.0",
    implementation: "original-package",
    artifactSha256: sha256("other"),
    runnerId: null,
  });
  assert.throws(
    () => prepareCapturedRun(m, sources, bundle),
    (e) => e.code === "unsupported-effective-dependency",
  );
});

test("captured metadata is immutable, source-free and bound to the private plan", () => {
  const { plan } = fixture();
  const snapshot = capturedRunMetadata(plan);
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.input.files[0]));
  assert(Object.isFrozen(snapshot.execution.effectiveLimits));
  assert.throws(() => {
    snapshot.input.files[0].path = "other.R";
  }, TypeError);
  assert.deepEqual(capturedRunMetadata(plan), snapshot);
  assert.notEqual(capturedRunMetadata(plan), snapshot);
  assert.notEqual(snapshot.execution.configurationSha256, metadata.execution.configurationSha256);
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes("owned_runner"), false);
  assert.equal(serialized.includes("test_that"), false);
  assert.equal("bundle" in snapshot, false);
  assert.equal("code" in snapshot, false);
  assert.throws(
    () => capturedRunMetadata({}),
    (error) => error instanceof ProjectionError && error.code === "unrecognized-host-plan",
  );
});
