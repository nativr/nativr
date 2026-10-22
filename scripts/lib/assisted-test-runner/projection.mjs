// Pure validation and projection for optional assisted evidence; no runtime execution.
import { createHash } from "node:crypto";

const ID = "nativr-cleanroom-test-runner";
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export class ProjectionError extends Error {
  constructor(code) {
    super(code);
    this.name = "ProjectionError";
    this.code = code;
  }
}
function reject(code) {
  throw new ProjectionError(code);
}
export const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
function object(value, keys, code = "invalid-object") {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    reject(code);
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length ||
    actual.some(
      (key) =>
        typeof key !== "string" ||
        !keys.includes(key) ||
        !own(Object.getOwnPropertyDescriptor(value, key), "value"),
    )
  )
    reject(code);
  return value;
}
function array(value, max, code = "invalid-array") {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    Object.keys(value).length !== value.length ||
    Object.keys(value).some((k, i) => k !== String(i)) ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    reject(code);
  for (let i = 0; i < value.length; i++)
    if (!own(Object.getOwnPropertyDescriptor(value, String(i)), "value")) reject(code);
  return value;
}
function text(value, max = 65536, code = "invalid-text") {
  if (typeof value !== "string" || value.length > max || Buffer.byteLength(value, "utf8") > max)
    reject(code);
  return value;
}
function token(value) {
  if (!/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/.test(text(value, 128))) reject("invalid-token");
  return value;
}
function hash(value) {
  if (!/^[0-9a-f]{64}$/.test(text(value, 64))) reject("invalid-hash");
  return value;
}
function bool(value) {
  if (typeof value !== "boolean") reject("invalid-boolean");
  return value;
}
function integer(value, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) reject("invalid-integer");
  return value;
}
function choice(value, choices) {
  if (!choices.includes(value)) reject("invalid-enum");
  return value;
}
function literal(value, wanted) {
  if (value !== wanted) reject("invalid-literal");
  return value;
}
export function safePath(value) {
  text(value, 512);
  if (
    !/^[A-Za-z0-9_./-]+$/.test(value) ||
    value.split("/").some((p) => !p || p === "." || p === "..")
  )
    reject("unsafe-path");
  return value;
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const admissions = new WeakMap();

// Decode only the data types the core emits, preserving named-list keys from the lossless
// snapshot. The friendly public value intentionally drops list names, so reconcile it in
// parallel instead of incorrectly treating it as a report object.
function decodeCoreSnapshot(snapshot, friendly, metadata) {
  let nodes = 0,
    bytes = 0;
  const maximumNodes = 256 + metadata.execution.reporterLimits.maxEvents * 128;
  function visit(value, publicValue, depth, key = "") {
    if (++nodes > maximumNodes || depth > 12) reject("snapshot-complexity-limit");
    if (!value || typeof value !== "object") reject("invalid-snapshot");
    const td = Object.getOwnPropertyDescriptor(value, "type");
    if (!td || !own(td, "value")) reject("invalid-snapshot");
    const type = choice(td.value, ["null", "list", "logical", "integer", "double", "character"]);
    const keys =
      type === "null"
        ? ["version", "type"]
        : ["version", "type", "values", ...(own(value, "names") ? ["names"] : [])];
    object(value, keys, "invalid-snapshot-fields");
    literal(value.version, 1);
    if (type === "null") {
      literal(publicValue, null);
      return null;
    }
    if (type === "list") {
      const items = array(value.values, metadata.execution.reporterLimits.maxEvents + 64);
      array(publicValue, items.length);
      literal(publicValue.length, items.length);
      let names = null;
      if (own(value, "names")) {
        names = array(value.names, 64);
        literal(names.length, items.length);
        if (new Set(names).size !== names.length) reject("duplicate-snapshot-name");
        for (const name of names) {
          token(name);
          if (["__proto__", "prototype", "constructor"].includes(name))
            reject("unsafe-snapshot-name");
        }
      }
      const out = names ? Object.create(null) : [];
      for (let index = 0; index < items.length; index++)
        out[names ? names[index] : index] = visit(
          items[index],
          publicValue[index],
          depth + 1,
          names ? names[index] : "",
        );
      return out;
    }
    if (own(value, "names")) reject("unexpected-atomic-names");
    const ctor = type === "logical" ? Uint8Array : type === "integer" ? Int32Array : Float64Array;
    const values = type === "character" ? array(value.values, 64) : value.values;
    if (type !== "character" && (!(values instanceof ctor) || values.length > 64))
      reject("invalid-snapshot-storage");
    const decoded = [];
    for (const item of values) {
      if (type === "character") {
        text(item, metadata.execution.reporterLimits.maxRecordBytes);
        bytes += Buffer.byteLength(item, "utf8");
      } else if (type === "logical") {
        if (item !== 0 && item !== 1) reject("invalid-snapshot-logical");
      } else if (!Number.isFinite(item)) reject("invalid-snapshot-number");
      if (bytes > 16 * 1024 * 1024) reject("snapshot-text-budget");
      decoded.push(type === "logical" ? item === 1 : item);
    }
    if (decoded.length === 1) literal(publicValue, decoded[0]);
    else {
      array(publicValue, 64);
      literal(publicValue.length, decoded.length);
      for (let i = 0; i < decoded.length; i++) literal(publicValue[i], decoded[i]);
    }
    return decoded.length === 1 && key !== "classNames" ? decoded[0] : decoded;
  }
  return visit(snapshot, friendly, 0);
}

// Only the host constructs this handle. Metadata is validated and snapshotted before R execution.
export function createAdmission(metadata) {
  object(metadata, ["runner", "input", "execution"]);
  const { runner: r, input: i, execution: e } = metadata;
  object(r, [
    "id",
    "version",
    "sourceSha256",
    "bundleSha256",
    "behaviorContractSha256",
    "apiTarget",
  ]);
  literal(r.id, ID);
  literal(r.version, "0.1.0");
  hash(r.sourceSha256);
  hash(r.bundleSha256);
  hash(r.behaviorContractSha256);
  object(r.apiTarget, ["package", "documentationVersion", "edition", "supportedApiManifestSha256"]);
  literal(r.apiTarget.package, "testthat");
  literal(r.apiTarget.documentationVersion, "3.3.2");
  literal(r.apiTarget.edition, 3);
  hash(r.apiTarget.supportedApiManifestSha256);
  object(i, [
    "package",
    "partition",
    "sourceSha256",
    "artifactSha256",
    "dependencies",
    "files",
    "discoveryPolicy",
    "selectionComplete",
  ]);
  object(i.package, ["name", "version"]);
  token(i.package.name);
  text(i.package.version, 64);
  choice(i.partition, ["owned-fixture", "development", "regression"]);
  hash(i.sourceSha256);
  hash(i.artifactSha256);
  literal(i.discoveryPolicy, "explicit-files-v1");
  bool(i.selectionComplete);
  const names = new Set();
  let adapter = false;
  for (const d of array(i.dependencies, 64)) {
    object(d, ["name", "version", "implementation", "artifactSha256", "runnerId"]);
    token(d.name);
    text(d.version, 64);
    if (names.has(d.name)) reject("duplicate-dependency");
    names.add(d.name);
    choice(d.implementation, ["original-package", "runtime-namespace", "clean-room-adapter"]);
    if (d.artifactSha256 !== null) hash(d.artifactSha256);
    if (d.implementation === "clean-room-adapter") {
      literal(d.runnerId, ID);
      literal(d.name, "nativrTest");
      literal(d.version, r.version);
      literal(d.artifactSha256, r.bundleSha256);
      adapter = true;
    } else literal(d.runnerId, null);
  }
  if (!adapter) reject("missing-runner-dependency");
  if (i.dependencies.length !== 1) reject("unsupported-effective-dependency");
  const paths = new Set();
  for (const f of array(i.files, 1000)) {
    object(f, ["path", "sha256", "role", "selection"]);
    safePath(f.path);
    hash(f.sha256);
    choice(f.role, ["test", "helper", "setup", "cleanup", "fixture"]);
    choice(f.selection, ["selected", "unselected"]);
    if (paths.has(f.path)) reject("duplicate-path");
    paths.add(f.path);
    if (f.selection === "selected" && f.role !== "test") reject("unsupported-selected-file-role");
  }
  object(e, [
    "semanticProfile",
    "capabilitySha256",
    "mode",
    "runtimeProfile",
    "effectiveLimits",
    "reporterLimits",
    "configurationSha256",
  ]);
  if (!/^0\.\d+\.\d+$/.test(text(e.semanticProfile, 32))) reject("invalid-profile");
  hash(e.capabilitySha256);
  choice(e.mode, ["inline", "worker"]);
  literal(e.runtimeProfile, "package-test");
  hash(e.configurationSha256);
  object(e.effectiveLimits, [
    "maxSteps",
    "maxCallDepth",
    "maxVectorLength",
    "maxOutputBytes",
    "maxPackageResourceBytes",
  ]);
  for (const value of Object.values(e.effectiveLimits)) integer(value);
  object(e.reporterLimits, ["maxEvents", "maxRecordBytes"]);
  integer(e.reporterLimits.maxEvents, 2, 10000);
  integer(e.reporterLimits.maxRecordBytes, 128, 1048576);
  const handle = Object.freeze({});
  admissions.set(handle, freeze(clone(metadata)));
  return handle;
}

// These IDs identify the bounded API boundary without publishing source-bearing diagnostic text.
const unsupportedIds = new Map([
  ["expect_identical: waldo comparison", "expect-identical-waldo"],
  ["expect_equal: waldo comparison", "expect-equal-waldo"],
  ["expect_snapshot", "expect-snapshot"],
  ["diagnostic labels/info", "diagnostic-controls"],
  ["fail diagnostic controls", "fail-controls"],
  ["succeed info", "succeed-info"],
  ["condition ancestry controls", "condition-ancestry"],
  ["condition matching controls", "condition-controls"],
  ["regular-expression condition matching", "condition-regexp"],
  ["absence with class matching", "condition-absence-class"],
  ["warning/message absence form", "condition-absence"],
  ["chained condition ancestry", "condition-chain"],
  ["expect_warning all", "expect-warning-all"],
  ["expect_message all", "expect-message-all"],
  ["expectation outside test", "expectation-outside-test"],
  ["skip outside test", "skip-outside-test"],
  ["test_that outside run_file", "test-outside-file"],
  ["nested test_that", "nested-test"],
  ["custom expectation condition", "custom-expectation"],
  ["setup outside file scope", "setup-outside-file"],
  ["teardown outside file scope", "teardown-outside-file"],
  ["nested run_file", "nested-file"],
  ["nested run_tests", "nested-run"],
]);
const issueCodes = [
  "unsupported-api",
  "setup-failed",
  "cleanup-failed",
  "unexpected-error",
  "no-expectations",
];
const rawEventKeys = {
  "run-start": ["sequence", "type"],
  "run-end": ["sequence", "type"],
  "file-start": ["sequence", "type", "path"],
  "file-end": ["sequence", "type", "path"],
  "test-start": ["sequence", "type", "path", "testId", "description"],
  "test-end": ["sequence", "type", "testId", "outcome"],
  expectation: ["sequence", "type", "testId", "api", "outcome", "message"],
  skip: ["sequence", "type", "testId", "message"],
  condition: ["sequence", "type", "testId", "conditionKind", "classNames", "message", "handled"],
  lifecycle: ["sequence", "type", "path", "testId", "phase", "outcome"],
  issue: ["sequence", "type", "path", "testId", "code", "api", "message"],
};

function projectEvents(raw, metadata, deriveAggregate = false) {
  object(raw, [
    "kind",
    "schemaVersion",
    "runner",
    "normativeTierCredit",
    "originalDependencyClosureSatisfied",
    "outcome",
    "eventsComplete",
    "events",
  ]);
  literal(raw.kind, "nativr-test-core-events");
  literal(raw.schemaVersion, 1);
  object(raw.runner, ["id", "package", "version"]);
  literal(raw.runner.id, ID);
  literal(raw.runner.package, "nativrTest");
  literal(raw.runner.version, metadata.runner.version);
  literal(raw.normativeTierCredit, false);
  literal(raw.originalDependencyClosureSatisfied, false);
  choice(raw.outcome, ["completed", "partial", "failed", "aborted", "no-tests"]);
  bool(raw.eventsComplete);
  const rows = array(raw.events, metadata.execution.reporterLimits.maxEvents);
  if (rows.length === 0) reject("missing-run-start");
  const expectedFiles = metadata.input.files
    .filter((f) => f.selection === "selected")
    .map((f) => f.path);
  const seenFiles = [];
  let file = null,
    test = null,
    lifecycle = null,
    ended = false,
    nextTest = 1,
    failed = false,
    unsupported = false;
  const counts = {
    tests: 0,
    passed: 0,
    failed: 0,
    error: 0,
    skipped: 0,
    unsupported: 0,
    aborted: 0,
    expectations: 0,
    failedExpectations: 0,
  };
  let firstBlocker = null;
  const block = (code, sequence) => {
    if (firstBlocker === null) firstBlocker = { code, sequence };
  };
  const events = [];
  for (let index = 0; index < rows.length; index++) {
    const event = rows[index];
    if (!event || typeof event !== "object" || !own(event, "type")) reject("invalid-event");
    const descriptor = Object.getOwnPropertyDescriptor(event, "type");
    if (!descriptor || !own(descriptor, "value")) reject("invalid-event");
    const keys = rawEventKeys[event.type];
    if (!keys) reject("unknown-event-type");
    object(event, keys, "invalid-event-fields");
    literal(event.sequence, index);
    if (ended) reject("event-after-run-end");
    if (test?.pendingErrorIssue && (event.type !== "issue" || event.code !== "unexpected-error"))
      reject("error-condition-without-issue");
    // Bounded field validation precedes serialization or hashing.
    for (const value of Object.values(event)) {
      if (typeof value === "string") text(value, metadata.execution.reporterLimits.maxRecordBytes);
      else if (Array.isArray(value)) for (const item of array(value, 64)) text(item, 128);
      else if (value !== null && typeof value !== "boolean" && !Number.isSafeInteger(value))
        reject("invalid-event-value");
    }
    // Stored records substitute fixed 64-byte hashes for possibly empty original text.
    // Their synthetic raw representation needs only a bounded constant allowance.
    const recordLimit =
      metadata.execution.reporterLimits.maxRecordBytes + (deriveAggregate ? 256 : 0);
    if (Buffer.byteLength(JSON.stringify(event), "utf8") > recordLimit)
      reject("event-record-limit");
    const out = { sequence: index, type: event.type };
    const activeTest = () => {
      if (!test || event.testId !== test.id) reject("test-scope-mismatch");
    };
    if (index === 0 && event.type !== "run-start") reject("missing-run-start");
    switch (event.type) {
      case "run-start":
        if (index !== 0) reject("duplicate-run-start");
        break;
      case "run-end":
        if (file !== null || test !== null || lifecycle !== null) reject("unclosed-scope");
        ended = true;
        break;
      case "file-start":
        safePath(event.path);
        if (file !== null || test !== null || lifecycle !== null) reject("nested-file");
        if (event.path !== expectedFiles[seenFiles.length]) reject("file-selection-mismatch");
        file = event.path;
        seenFiles.push(file);
        out.path = file;
        break;
      case "file-end":
        if (file === null || event.path !== file || test !== null || lifecycle !== null)
          reject("file-scope-mismatch");
        out.path = file;
        file = null;
        break;
      case "test-start":
        if (file === null || event.path !== file || test !== null || lifecycle !== null)
          reject("test-scope-mismatch");
        literal(event.testId, nextTest++);
        test = {
          id: event.testId,
          expectations: 0,
          failures: 0,
          error: false,
          skip: false,
          empty: false,
          unsupported: false,
        };
        counts.tests++;
        out.path = file;
        out.testId = event.testId;
        out.descriptionSha256 = sha256(event.description);
        break;
      case "expectation":
        activeTest();
        literal(event.api, "expectation");
        choice(event.outcome, ["passed", "failed"]);
        if (test.skip || test.error || test.empty) reject("expectation-after-termination");
        test.expectations++;
        counts.expectations++;
        if (event.outcome === "failed") {
          test.failures++;
          counts.failedExpectations++;
          failed = true;
          block("failed-expectation", index);
        }
        Object.assign(out, {
          testId: test.id,
          api: "expectation",
          outcome: event.outcome,
          diagnosticSha256: sha256(event.message),
        });
        break;
      case "condition":
        activeTest();
        choice(event.conditionKind, ["warning", "message", "error"]);
        literal(event.handled, true);
        if (test.skip || test.error) reject("condition-after-termination");
        if (event.conditionKind === "error") {
          test.error = true;
          test.pendingErrorIssue = true;
          test.errorMessage = event.message;
          test.errorSequence = index;
          failed = true;
          block("unexpected-error", index);
        }
        for (const label of array(event.classNames, 64)) token(label);
        Object.assign(out, {
          testId: test.id,
          conditionKind: event.conditionKind,
          classNames: [...event.classNames],
          messageSha256: sha256(event.message),
          handled: true,
        });
        break;
      case "skip":
        activeTest();
        if (test.skip || test.error) reject("duplicate-termination");
        test.skip = true;
        block("skipped", index);
        Object.assign(out, { testId: test.id, messageSha256: sha256(event.message) });
        break;
      case "issue": {
        if (event.path !== file || event.testId !== (test?.id ?? null))
          reject("issue-scope-mismatch");
        choice(event.code, issueCodes);
        let api = null;
        if (event.code === "unsupported-api") {
          api = unsupportedIds.get(event.api);
          if (!api) reject("unknown-unsupported-api");
          unsupported = true;
          if (test) test.unsupported = true;
        } else literal(event.api, null);
        if (event.code === "no-expectations") {
          if (!test || test.expectations !== 0 || test.skip || test.error)
            reject("invalid-empty-test");
          test.empty = true;
        }
        if (event.code === "setup-failed" || event.code === "cleanup-failed") {
          if (!lifecycle || event.code !== `${lifecycle.phase}-failed`)
            reject("lifecycle-failure-without-start");
          lifecycle.failed = true;
          failed = true;
        }
        if (event.code === "unexpected-error") {
          if (
            test &&
            (!test.error || test.errorSequence !== index - 1 || test.errorMessage !== event.message)
          )
            reject("error-issue-without-condition");
          if (test) test.pendingErrorIssue = false;
          failed = true;
        }
        block(event.code, index);
        Object.assign(out, {
          path: file,
          testId: test?.id ?? null,
          code: event.code,
          api,
          diagnosticSha256: sha256(event.message),
        });
        break;
      }
      case "test-end": {
        activeTest();
        choice(event.outcome, ["passed", "failed", "error", "skipped", "unsupported", "aborted"]);
        const expected = test.error
          ? "error"
          : test.skip || test.empty
            ? "skipped"
            : test.failures > 0
              ? "failed"
              : "passed";
        if (event.outcome === "unsupported") {
          if (!test.unsupported) reject("unsupported-without-issue");
        } else if (event.outcome === "aborted") reject("aborted-test-with-complete-end");
        else if (
          event.outcome !== expected ||
          (event.outcome === "passed" && test.expectations === 0)
        )
          reject("forged-test-outcome");
        // A caught unsupported condition cannot make the affected scope supported.
        const projectedOutcome = test.unsupported ? "unsupported" : event.outcome;
        counts[projectedOutcome]++;
        Object.assign(out, { testId: test.id, outcome: projectedOutcome });
        test = null;
        break;
      }
      case "lifecycle":
        if (file === null || event.path !== file || test !== null || event.testId !== null)
          reject("lifecycle-scope-mismatch");
        choice(event.phase, ["setup", "cleanup"]);
        choice(event.outcome, ["started", "completed", "failed"]);
        if (event.outcome === "started") {
          if (lifecycle !== null) reject("nested-lifecycle");
          lifecycle = { phase: event.phase, failed: false };
        } else {
          if (lifecycle === null || lifecycle.phase !== event.phase)
            reject("lifecycle-end-without-start");
          if ((event.outcome === "failed") !== lifecycle.failed) reject("forged-lifecycle-outcome");
          lifecycle = null;
        }
        Object.assign(out, {
          path: file,
          testId: null,
          phase: event.phase,
          outcome: event.outcome,
          diagnosticSha256: null,
        });
        break;
    }
    events.push(out);
  }
  const complete = ended && file === null && test === null && lifecycle === null;
  if (raw.eventsComplete !== complete) reject("forged-capture-completeness");
  if (complete && seenFiles.length !== expectedFiles.length) reject("missing-selected-file");
  const derived = !complete
    ? "aborted"
    : unsupported
      ? "partial"
      : failed
        ? "failed"
        : counts.tests === 0
          ? "no-tests"
          : "completed";
  if (!deriveAggregate && raw.outcome !== derived) reject("forged-run-outcome");
  if (!complete) {
    if (test) counts.aborted++;
    block("capture-incomplete", events.length);
  }
  return { events, counts, firstBlocker, complete, outcome: derived };
}

// Public eval results are host transport, separate from user-mutable R event records.
// This first adapter refuses all outer effects because their interleaving is not established.
export function projectEvaluation(admission, evaluation) {
  const metadata = admissions.get(admission);
  if (!metadata) reject("unrecognized-host-admission");
  object(
    evaluation,
    [
      "value",
      "raw",
      "visible",
      "topLevelErrors",
      "warnings",
      "output",
      "dataViews",
      "browseRequests",
      "graphics",
      "elapsedMs",
      "runtimeReset",
    ],
    "invalid-host-result",
  );
  bool(evaluation.visible);
  literal(evaluation.runtimeReset, false);
  if (
    typeof evaluation.elapsedMs !== "number" ||
    !Number.isFinite(evaluation.elapsedMs) ||
    evaluation.elapsedMs < 0
  )
    reject("invalid-host-timing");
  for (const key of [
    "topLevelErrors",
    "warnings",
    "output",
    "dataViews",
    "browseRequests",
    "graphics",
  ])
    if (array(evaluation[key], 10000).length !== 0) reject("unaccounted-host-effects");
  const result = projectEvents(
    decodeCoreSnapshot(evaluation.raw, evaluation.value, metadata),
    metadata,
  );
  const outcome =
    result.outcome === "completed" && !metadata.input.selectionComplete
      ? "partial"
      : result.outcome;
  const report = {
    kind: "nativr-runner-assisted-report",
    schemaVersion: 1,
    normativeTierCredit: false,
    originalDependencyClosureSatisfied: false,
    runner: clone(metadata.runner),
    input: clone(metadata.input),
    execution: {
      ...clone(metadata.execution),
      capture: { eventsComplete: result.complete, outputComplete: true, conditionsComplete: true },
      outcome,
    },
    events: result.events,
  };
  return freeze({
    report,
    derived: {
      counts: result.counts,
      firstBlocker:
        !metadata.input.selectionComplete && result.firstBlocker === null
          ? { code: "selection-incomplete", sequence: null }
          : result.firstBlocker,
    },
  });
}

export function rejectNormativeTierCredit(value) {
  if (
    value &&
    typeof value === "object" &&
    (value.kind === "nativr-runner-assisted-report" ||
      own(value, "runner") ||
      own(value, "normativeTierCredit") ||
      own(value, "originalDependencyClosureSatisfied"))
  )
    reject("assisted-evidence-has-no-normative-tier-credit");
  reject("not-an-original-report-validator");
}

// Validate stored public artifacts without admitting raw diagnostic/source fields. This
// verifies consistency only; the caller still needs its trusted raw-artifact association.
export function validateAssistedReport(report) {
  object(report, [
    "kind",
    "schemaVersion",
    "normativeTierCredit",
    "originalDependencyClosureSatisfied",
    "runner",
    "input",
    "execution",
    "events",
  ]);
  literal(report.kind, "nativr-runner-assisted-report");
  literal(report.schemaVersion, 1);
  literal(report.normativeTierCredit, false);
  literal(report.originalDependencyClosureSatisfied, false);
  object(report.execution, [
    "semanticProfile",
    "capabilitySha256",
    "mode",
    "runtimeProfile",
    "effectiveLimits",
    "reporterLimits",
    "configurationSha256",
    "capture",
    "outcome",
  ]);
  object(report.execution.capture, ["eventsComplete", "outputComplete", "conditionsComplete"]);
  bool(report.execution.capture.eventsComplete);
  literal(report.execution.capture.outputComplete, true);
  literal(report.execution.capture.conditionsComplete, true);
  choice(report.execution.outcome, ["completed", "partial", "failed", "aborted", "no-tests"]);
  const execution = {};
  for (const key of [
    "semanticProfile",
    "capabilitySha256",
    "mode",
    "runtimeProfile",
    "effectiveLimits",
    "reporterLimits",
    "configurationSha256",
  ])
    execution[key] = report.execution[key];
  const metadata = { runner: report.runner, input: report.input, execution };
  createAdmission(metadata);
  const publicKeys = {
    ...rawEventKeys,
    "test-start": ["sequence", "type", "path", "testId", "descriptionSha256"],
    expectation: ["sequence", "type", "testId", "api", "outcome", "diagnosticSha256"],
    skip: ["sequence", "type", "testId", "messageSha256"],
    condition: [
      "sequence",
      "type",
      "testId",
      "conditionKind",
      "classNames",
      "messageSha256",
      "handled",
    ],
    lifecycle: ["sequence", "type", "path", "testId", "phase", "outcome", "diagnosticSha256"],
    issue: ["sequence", "type", "path", "testId", "code", "api", "diagnosticSha256"],
  };
  const inverse = new Map([...unsupportedIds].map(([raw, id]) => [id, raw]));
  const rows = [];
  for (const e of array(report.events, execution.reporterLimits.maxEvents)) {
    if (!e || typeof e !== "object") reject("invalid-public-event");
    const type = Object.getOwnPropertyDescriptor(e, "type");
    if (!type || !own(type, "value") || !publicKeys[type.value]) reject("invalid-public-event");
    object(e, publicKeys[type.value], "invalid-public-event-fields");
    const out = {};
    for (const key of rawEventKeys[type.value]) if (own(e, key)) out[key] = e[key];
    if (e.type === "test-start") out.description = hash(e.descriptionSha256);
    if (["expectation", "issue"].includes(e.type)) out.message = hash(e.diagnosticSha256);
    if (["skip", "condition"].includes(e.type)) out.message = hash(e.messageSha256);
    if (e.type === "lifecycle") literal(e.diagnosticSha256, null);
    if (e.type === "issue" && e.code === "unsupported-api") {
      out.api = inverse.get(e.api);
      if (!out.api) reject("unknown-unsupported-api");
    }
    rows.push(out);
  }
  const raw = {
    kind: "nativr-test-core-events",
    schemaVersion: 1,
    runner: { id: ID, package: "nativrTest", version: report.runner.version },
    normativeTierCredit: false,
    originalDependencyClosureSatisfied: false,
    outcome: report.execution.outcome,
    eventsComplete: report.execution.capture.eventsComplete,
    events: rows,
  };
  const projected = projectEvents(raw, metadata, true);
  for (let index = 0; index < report.events.length; index++)
    if (
      report.events[index].type === "test-end" &&
      report.events[index].outcome !== projected.events[index].outcome
    )
      reject("forged-public-test-outcome");
  const outcome =
    projected.outcome === "completed" && !metadata.input.selectionComplete
      ? "partial"
      : projected.outcome;
  if (outcome !== report.execution.outcome) reject("forged-public-outcome");
  return freeze({
    report: clone(report),
    derived: {
      counts: projected.counts,
      firstBlocker:
        !metadata.input.selectionComplete && projected.firstBlocker === null
          ? { code: "selection-incomplete", sequence: null }
          : projected.firstBlocker,
    },
  });
}

export function validateAssistedArtifactBytes(bytes, expectedSha256) {
  hash(expectedSha256);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > 16 * 1024 * 1024)
    reject("artifact-byte-limit");
  if (sha256(bytes) !== expectedSha256) reject("artifact-digest-mismatch");
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    reject("invalid-artifact-json");
  }
  return validateAssistedReport(parsed);
}
