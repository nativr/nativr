/** Pure, metadata-only attribution checks. No browser/runtime imports. */
export class RequiredExampleProfileError extends Error {
  constructor(code) {
    super(code);
    this.name = "RequiredExampleProfileError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new RequiredExampleProfileError(code);
};
const check = (value, code) => {
  if (!value) fail(code);
};
const record = (value, keys, code) => {
  check(value !== null && typeof value === "object" && !Array.isArray(value), code);
  check(
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)),
    code,
  );
};
const finite = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const sampleId = (value) => typeof value === "string" && /^required-\d{3}:\d{1,2}$/.test(value);

export function createRequiredExampleProfileReport(input, expected) {
  record(
    expected,
    ["sampleIds", "semanticProfile", "sourceSha256", "browser", "timeoutMs", "viewport"],
    "PROFILE_EXPECTATION",
  );
  check(
    Array.isArray(expected.sampleIds) &&
      expected.sampleIds.length > 0 &&
      expected.sampleIds.length <= 512 &&
      expected.sampleIds.every(sampleId) &&
      new Set(expected.sampleIds).size === expected.sampleIds.length,
    "PROFILE_EXPECTATION",
  );
  check(
    hash(expected.sourceSha256) && /^0\.\d+\.\d+$/.test(expected.semanticProfile),
    "PROFILE_EXPECTATION",
  );
  check(
    ["chromium", "firefox", "webkit"].includes(expected.browser) && expected.timeoutMs === 120_000,
    "PROFILE_EXPECTATION",
  );
  record(
    input,
    [
      "schemaVersion",
      "testPassed",
      "inputsStable",
      "servedAssetsVerified",
      "readyObserved",
      "browser",
      "browserVersion",
      "semanticProfile",
      "sourceSha256",
      "timeoutMs",
      "viewport",
      "browserState",
      "actions",
    ],
    "PROFILE_ENVELOPE",
  );
  check(input.schemaVersion === 1 && input.testPassed === true, "PROFILE_TEST_FAILED");
  check(input.inputsStable === true && input.servedAssetsVerified === true, "PROFILE_INPUTS");
  check(input.readyObserved === true, "PROFILE_NOT_READY");
  for (const key of ["browser", "semanticProfile", "sourceSha256", "timeoutMs"])
    check(input[key] === expected[key], "PROFILE_IDENTITY");
  check(
    typeof input.browserVersion === "string" && /^\d+(?:\.\d+){0,3}$/.test(input.browserVersion),
    "PROFILE_IDENTITY",
  );
  record(input.viewport, ["width", "height"], "PROFILE_VIEWPORT");
  record(expected.viewport, ["width", "height"], "PROFILE_VIEWPORT");
  check(
    Number.isInteger(input.viewport.width) &&
      input.viewport.width > 0 &&
      Number.isInteger(input.viewport.height) &&
      input.viewport.height > 0,
    "PROFILE_VIEWPORT",
  );
  check(
    input.viewport.width === expected.viewport.width &&
      input.viewport.height === expected.viewport.height,
    "PROFILE_VIEWPORT",
  );
  record(input.browserState, ["rows", "issues", "overflow", "pending"], "PROFILE_BROWSER_STATE");
  check(input.browserState.overflow === false, "PROFILE_TRUNCATED");
  check(
    Array.isArray(input.browserState.issues) && input.browserState.issues.length === 0,
    "PROFILE_OBSERVER",
  );
  check(input.browserState.pending === false, "PROFILE_INCOMPLETE");
  const rows = input.browserState.rows;
  check(
    Array.isArray(rows) &&
      rows.length === expected.sampleIds.length &&
      Array.isArray(input.actions) &&
      input.actions.length === rows.length,
    "PROFILE_COUNT",
  );
  let previousCompletion = -Infinity;
  const samples = rows.map((row, index) => {
    record(
      row,
      [
        "id",
        "generation",
        "activationAtMs",
        "busyObservedAtMs",
        "settledObservedAtMs",
        "activationCount",
        "busyCount",
        "completionCount",
        "terminal",
        "displayedEvaluatorElapsedMs",
        "visible",
      ],
      "PROFILE_ROW",
    );
    const action = input.actions[index];
    record(action, ["id", "armRpcMs", "actionCallMs", "actionSucceeded"], "PROFILE_ACTION");
    check(
      row.id === expected.sampleIds[index] && action.id === row.id && row.generation === index + 1,
      "PROFILE_ORDER",
    );
    check(
      row.activationCount === 1 &&
        row.busyCount === 1 &&
        row.completionCount === 1 &&
        row.visible === true,
      "PROFILE_GENERATION",
    );
    check(
      action.actionSucceeded === true && finite(action.armRpcMs) && finite(action.actionCallMs),
      "PROFILE_ACTION",
    );
    check(
      finite(row.activationAtMs) && finite(row.busyObservedAtMs) && finite(row.settledObservedAtMs),
      "PROFILE_CLOCK",
    );
    check(
      row.activationAtMs >= previousCompletion &&
        row.busyObservedAtMs >= row.activationAtMs &&
        row.settledObservedAtMs >= row.busyObservedAtMs,
      "PROFILE_CLOCK",
    );
    check(
      row.settledObservedAtMs - row.activationAtMs <= expected.timeoutMs &&
        action.actionCallMs <= expected.timeoutMs,
      "PROFILE_CLOCK",
    );
    check(row.terminal === "ready" || row.terminal === "error", "PROFILE_TERMINAL");
    check(
      row.terminal === "ready"
        ? finite(row.displayedEvaluatorElapsedMs)
        : row.displayedEvaluatorElapsedMs === null,
      "PROFILE_ELAPSED",
    );
    previousCompletion = row.settledObservedAtMs;
    return {
      id: row.id,
      generation: row.generation,
      armRpcMs: action.armRpcMs,
      actionCallMs: action.actionCallMs,
      activationToUiCompleteMs: row.settledObservedAtMs - row.activationAtMs,
      displayedEvaluatorElapsedMs: row.displayedEvaluatorElapsedMs,
      terminal: row.terminal,
    };
  });
  return {
    schemaVersion: 1,
    kind: "nativr-owned-required-example-profile",
    ok: true,
    semanticProfile: expected.semanticProfile,
    sourceSha256: expected.sourceSha256,
    sourceHashPolicy:
      "lf-normalized-utf8; raw source bytes are separately bound by input snapshots",
    browser: expected.browser,
    browserVersion: input.browserVersion,
    viewport: { ...input.viewport },
    timeoutMs: expected.timeoutMs,
    originalTestPassed: true,
    inputsStable: true,
    servedAssetsVerified: true,
    samples,
    limitations: [
      "Instrumented diagnostic; arming adds one browser round trip before each unchanged real click.",
      "Initial asset response bodies are copied and hashed by the test fixture; this can perturb loading and scheduling and is not a startup benchmark.",
      "Successful same-origin Blob responses are browser-created content, counted separately without served-asset credit or body verification; their resource type or preview ownership is not inferred. Unknown HTTP assets still invalidate capture.",
      "Action-call and activation-to-UI-completion durations overlap and are not additive or a wall-time partition.",
      "UI completion includes selected-example setup, parsing, evaluation, transport and rendering; it is not pure Worker execution time.",
      "Displayed evaluator time is the existing rounded evaluator-only Date.now measurement; zero can mean below clock resolution.",
      "Busy and completion timestamps are MutationObserver callback observations, not exact DOM assignment times.",
      "All original test assertions passed; the timing collector does not inspect source, result text, errors or package output.",
      "No release threshold, whole-suite causal comparison, corpus credit or normative platform completion is inferred.",
    ],
  };
}
