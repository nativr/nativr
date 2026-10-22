import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequiredExampleProfileReport,
  RequiredExampleProfileError,
} from "../lib/required-example-profile.mjs";

const sourceSha256 = "a".repeat(64);
function fixture() {
  const sampleIds = ["required-001:1", "required-002:1", "required-002:2"];
  const expected = {
    sampleIds,
    semanticProfile: "0.391.0",
    sourceSha256,
    browser: "webkit",
    timeoutMs: 120_000,
    viewport: { width: 1280, height: 720 },
  };
  return {
    expected,
    input: {
      schemaVersion: 1,
      testPassed: true,
      inputsStable: true,
      servedAssetsVerified: true,
      readyObserved: true,
      browser: "webkit",
      browserVersion: "26.5",
      semanticProfile: "0.391.0",
      sourceSha256,
      timeoutMs: 120_000,
      viewport: { width: 1280, height: 720 },
      browserState: {
        rows: sampleIds.map((id, index) => ({
          id,
          generation: index + 1,
          activationAtMs: 100 + 30 * index,
          busyObservedAtMs: 101 + 30 * index,
          settledObservedAtMs: 110 + 30 * index,
          activationCount: 1,
          busyCount: 1,
          completionCount: 1,
          terminal: "ready",
          displayedEvaluatorElapsedMs: 0,
          visible: true,
        })),
        issues: [],
        overflow: false,
        pending: false,
      },
      actions: sampleIds.map((id) => ({
        id,
        armRpcMs: 2,
        actionCallMs: 40,
        actionSucceeded: true,
      })),
    },
  };
}
const rejected = (change, code) => {
  const f = fixture();
  change(f.input, f.expected);
  assert.throws(
    () => createRequiredExampleProfileReport(f.input, f.expected),
    (error) => error instanceof RequiredExampleProfileError && error.code === code,
  );
};

test("each ordered generation is preserved when results and rounded elapsed values repeat", () => {
  const { input, expected } = fixture();
  const result = createRequiredExampleProfileReport(input, expected);
  assert.deepEqual(
    result.samples.map((sample) => sample.id),
    expected.sampleIds,
  );
  assert.deepEqual(
    result.samples.map((sample) => sample.activationToUiCompleteMs),
    [10, 10, 10],
  );
  assert.deepEqual(
    result.samples.map((sample) => sample.displayedEvaluatorElapsedMs),
    [0, 0, 0],
  );
  assert.equal(result.samples[0].actionCallMs, 40);
  assert.ok(result.limitations.some((text) => text.includes("overlap")));
});

test("expected application error completes without claiming an evaluator measurement", () => {
  const { input, expected } = fixture();
  input.browserState.rows[1].terminal = "error";
  input.browserState.rows[1].displayedEvaluatorElapsedMs = null;
  const result = createRequiredExampleProfileReport(input, expected);
  assert.equal(result.samples[1].terminal, "error");
  assert.equal(result.samples[1].displayedEvaluatorElapsedMs, null);
});

const failures = [
  [
    "failed original assertion",
    (x) => {
      x.testPassed = false;
    },
    "PROFILE_TEST_FAILED",
  ],
  [
    "changed inputs",
    (x) => {
      x.inputsStable = false;
    },
    "PROFILE_INPUTS",
  ],
  [
    "wrong server bytes",
    (x) => {
      x.servedAssetsVerified = false;
    },
    "PROFILE_INPUTS",
  ],
  [
    "missing runtime readiness",
    (x) => {
      x.readyObserved = false;
    },
    "PROFILE_NOT_READY",
  ],
  [
    "profile mismatch",
    (x) => {
      x.semanticProfile = "0.390.0";
    },
    "PROFILE_IDENTITY",
  ],
  [
    "source digest mismatch",
    (x) => {
      x.sourceSha256 = "b".repeat(64);
    },
    "PROFILE_IDENTITY",
  ],
  [
    "timeout inflation",
    (x) => {
      x.timeoutMs = 180_000;
    },
    "PROFILE_IDENTITY",
  ],
  [
    "incomplete last evaluation",
    (x) => {
      x.browserState.pending = true;
    },
    "PROFILE_INCOMPLETE",
  ],
  [
    "silent collector truncation",
    (x) => {
      x.browserState.overflow = true;
    },
    "PROFILE_TRUNCATED",
  ],
  [
    "same-task collapsed busy/completion batch",
    (x) => {
      x.browserState.issues = ["batched-transition"];
    },
    "PROFILE_OBSERVER",
  ],
  [
    "unarmed activation",
    (x) => {
      x.browserState.issues = ["unarmed-activation"];
    },
    "PROFILE_OBSERVER",
  ],
  [
    "missing row",
    (x) => {
      x.browserState.rows.pop();
    },
    "PROFILE_COUNT",
  ],
  [
    "missing action",
    (x) => {
      x.actions.pop();
    },
    "PROFILE_COUNT",
  ],
  [
    "duplicate expected ID",
    (_x, e) => {
      e.sampleIds[1] = e.sampleIds[0];
    },
    "PROFILE_EXPECTATION",
  ],
  [
    "duplicate observed ID",
    (x) => {
      x.browserState.rows[1].id = x.browserState.rows[0].id;
    },
    "PROFILE_ORDER",
  ],
  [
    "stale generation",
    (x) => {
      x.browserState.rows[1].generation = 1;
    },
    "PROFILE_ORDER",
  ],
  [
    "reordered action",
    (x) => {
      [x.actions[0], x.actions[1]] = [x.actions[1], x.actions[0]];
    },
    "PROFILE_ORDER",
  ],
  [
    "double activation",
    (x) => {
      x.browserState.rows[0].activationCount = 2;
    },
    "PROFILE_GENERATION",
  ],
  [
    "absent busy evidence",
    (x) => {
      x.browserState.rows[0].busyCount = 0;
    },
    "PROFILE_GENERATION",
  ],
  [
    "duplicate completion",
    (x) => {
      x.browserState.rows[0].completionCount = 2;
    },
    "PROFILE_GENERATION",
  ],
  [
    "hidden document",
    (x) => {
      x.browserState.rows[0].visible = false;
    },
    "PROFILE_GENERATION",
  ],
  [
    "failed real click",
    (x) => {
      x.actions[0].actionSucceeded = false;
    },
    "PROFILE_ACTION",
  ],
  [
    "negative action duration",
    (x) => {
      x.actions[0].actionCallMs = -1;
    },
    "PROFILE_ACTION",
  ],
  [
    "nonfinite arm duration",
    (x) => {
      x.actions[0].armRpcMs = Infinity;
    },
    "PROFILE_ACTION",
  ],
  [
    "missing busy timestamp",
    (x) => {
      x.browserState.rows[0].busyObservedAtMs = null;
    },
    "PROFILE_CLOCK",
  ],
  [
    "completion before busy",
    (x) => {
      x.browserState.rows[0].settledObservedAtMs = 100;
    },
    "PROFILE_CLOCK",
  ],
  [
    "overlapping generations",
    (x) => {
      x.browserState.rows[1].activationAtMs = 109;
    },
    "PROFILE_CLOCK",
  ],
  [
    "duration over unchanged timeout",
    (x) => {
      x.browserState.rows[2].settledObservedAtMs = 130_000;
    },
    "PROFILE_CLOCK",
  ],
  [
    "invalid terminal state",
    (x) => {
      x.browserState.rows[0].terminal = "running";
    },
    "PROFILE_TERMINAL",
  ],
  [
    "stale elapsed on error",
    (x) => {
      x.browserState.rows[0].terminal = "error";
    },
    "PROFILE_ELAPSED",
  ],
  [
    "no numeric elapsed on ready",
    (x) => {
      x.browserState.rows[0].displayedEvaluatorElapsedMs = null;
    },
    "PROFILE_ELAPSED",
  ],
  [
    "invalid numeric elapsed",
    (x) => {
      x.browserState.rows[0].displayedEvaluatorElapsedMs = NaN;
    },
    "PROFILE_ELAPSED",
  ],
  [
    "raw result field",
    (x) => {
      x.browserState.rows[0].result = "owned output must not leave the page";
    },
    "PROFILE_ROW",
  ],
  [
    "source text field",
    (x) => {
      x.source = "owned source must not be reported";
    },
    "PROFILE_ENVELOPE",
  ],
  [
    "raw error field",
    (x) => {
      x.actions[0].error = "private details";
    },
    "PROFILE_ACTION",
  ],
  [
    "invalid viewport",
    (x) => {
      x.viewport.height = 0;
    },
    "PROFILE_VIEWPORT",
  ],
  [
    "inflated viewport",
    (x) => {
      x.viewport.height = 1440;
    },
    "PROFILE_VIEWPORT",
  ],
];
for (const [name, change, code] of failures) test(`rejects ${name}`, () => rejected(change, code));

test("projection clones public samples and omits browser timestamps and source/output", () => {
  const { input, expected } = fixture();
  const output = createRequiredExampleProfileReport(input, expected);
  input.browserState.rows[0].id = "changed";
  input.viewport.width = 1;
  assert.equal(output.samples[0].id, "required-001:1");
  assert.equal(output.viewport.width, 1280);
  assert.deepEqual(Object.keys(output.samples[0]), [
    "id",
    "generation",
    "armRpcMs",
    "actionCallMs",
    "activationToUiCompleteMs",
    "displayedEvaluatorElapsedMs",
    "terminal",
  ]);
  assert.equal(JSON.stringify(output).includes("activationAtMs"), false);
});
