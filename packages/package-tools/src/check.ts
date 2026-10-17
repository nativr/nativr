import type {
  PackageCheckAppliedAdaptation,
  PackageCheckComparison,
  PackageCheckComparisonOptions,
  PackageCheckDifference,
  PackageCheckEvidence,
  PackageCheckObservation,
  PackageCheckReport,
  PackageCheckStage,
  PackageCheckStageId,
} from "./types.js";

/** Fixed coverage inventory; an omitted stage remains unexecuted. */
export const PACKAGE_CHECK_STAGES: readonly PackageCheckStageId[] = Object.freeze([
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

const REQUIRED_APPLICABLE = new Set<PackageCheckStageId>([
  "archive-artifact",
  "metadata-dependencies",
  "installation-loading",
  "namespace-source",
]);
const LIMIT_NAMES = [
  "maxSteps",
  "maxCallDepth",
  "maxVectorLength",
  "maxOutputBytes",
  "maxPackageResourceBytes",
] as const;
const TRANSPORT_PROBE_LITERAL_HEX = "610a620d0a630d640d0d0a65";
const TRANSPORT_PROBE_CRLF_HEX = "610d0a620d0d0a630d640d0d0d0a65";

/** Compare observations, keeping absent expectations and unavailable ordering explicit. */
export function comparePackageCheckObservation(
  actual: PackageCheckObservation,
  expected: PackageCheckObservation | undefined,
  options: PackageCheckComparisonOptions,
): PackageCheckComparison {
  validatePolicy(options);
  validateObservation(actual);
  if (expected !== undefined) validateObservation(expected);
  const crossStreamOrder =
    actual.outputOrder !== undefined && expected?.outputOrder !== undefined
      ? "compared"
      : "unobserved";
  const conditionEvidence =
    actual.conditionsComplete && expected?.conditionsComplete ? "complete" : "incomplete";
  const outputEvidence =
    actual.outputComplete && expected?.outputComplete ? "complete" : "incomplete";
  if (expected === undefined) {
    return {
      policyVersion: 1,
      outcome: "no-expectation",
      rawDifference: null,
      adaptedDifference: null,
      adaptations: [],
      crossStreamOrder,
      conditionEvidence,
      outputEvidence,
    };
  }
  const rawDifference = observationDifference(actual, expected);
  const adaptation = options.adaptations[0];
  const adaptations: PackageCheckAppliedAdaptation[] = [];
  let prepared = expected;
  if (adaptation !== undefined) {
    const stdout = reverseTextTransport(expected.stdout);
    const stderr = reverseTextTransport(expected.stderr);
    prepared = {
      ...expected,
      stdout: stdout.text,
      stderr: stderr.text,
      ...(expected.outputOrder === undefined
        ? {}
        : { outputOrder: reverseOrderedTextTransport(expected.outputOrder) }),
    };
    adaptations.push({
      ...adaptation,
      transformedPairs: { stdout: stdout.pairs, stderr: stderr.pairs },
    });
  }
  const adaptedDifference =
    adaptation === undefined ? rawDifference : observationDifference(actual, prepared);
  return {
    policyVersion: 1,
    outcome: adaptedDifference === null ? "match" : "mismatch",
    rawDifference,
    adaptedDifference,
    adaptations,
    crossStreamOrder,
    conditionEvidence,
    outputEvidence,
  };
}

/**
 * Aggregate independently captured evidence. This does not execute R CMD check or infer a
 * passed stage from a package's successful tests. Stage evidence remains caller supplied.
 */
export function createPackageCheckReport(input: PackageCheckEvidence): PackageCheckReport {
  validatePolicy(input.comparison);
  if (!nonempty(input.package.name) || !nonempty(input.package.version)) {
    throw new Error("Package-check package identity must be non-empty.");
  }
  const provided = new Map<PackageCheckStageId, PackageCheckStage>();
  for (const stage of input.stages) {
    validateStage(stage);
    if (provided.has(stage.id)) throw new Error(`Duplicate package-check stage '${stage.id}'.`);
    provided.set(stage.id, stage);
  }
  const stages: PackageCheckStage[] = PACKAGE_CHECK_STAGES.map((id) => {
    const stage = provided.get(id);
    return stage === undefined
      ? {
          id,
          status: "unexecuted",
          reason: "No stage evidence was supplied.",
          discovered: [],
          executed: [],
        }
      : { ...stage, discovered: [...stage.discovered], executed: [...stage.executed] };
  });
  const blockers = new Map<PackageCheckStageId, NonNullable<PackageCheckReport["firstBlocker"]>>();
  const record = (
    id: PackageCheckStageId,
    status: "unexecuted" | "failed",
    code: string,
    message: string,
    path?: string,
  ): void => {
    const index = stages.findIndex((stage) => stage.id === id);
    const previous = stages[index];
    if (previous === undefined || previous.status === "failed") return;
    const blocker = { stage: id, code, message, ...(path === undefined ? {} : { path }) };
    if (!blockers.has(id) || status === "failed") blockers.set(id, blocker);
    const reason =
      previous.status === "unexecuted" && !previous.reason.includes(message)
        ? `${previous.reason} ${message}`
        : message;
    stages[index] = { ...previous, status, reason };
  };
  for (const stage of stages) {
    const missing = stage.discovered.find((path) => !stage.executed.includes(path));
    const extra = stage.executed.find((path) => !stage.discovered.includes(path));
    if (extra !== undefined) {
      record(
        stage.id,
        "failed",
        "invalid-inventory",
        "Executed item is absent from the discovered inventory.",
        extra,
      );
    } else if (stage.status === "inapplicable") {
      if (
        REQUIRED_APPLICABLE.has(stage.id) ||
        stage.discovered.length > 0 ||
        stage.executed.length > 0
      ) {
        record(
          stage.id,
          "failed",
          "invalid-inapplicability",
          "This stage cannot be inapplicable with the supplied inventory.",
        );
      }
    } else if (
      stage.status === "passed" &&
      (missing !== undefined || stage.discovered.length === 0)
    ) {
      record(
        stage.id,
        "unexecuted",
        "incomplete-inventory",
        "A passed stage requires a non-empty, fully executed inventory.",
        missing,
      );
    }
  }
  const observations = input.observations.map((entry) => ({
    ...entry,
    comparison: comparePackageCheckObservation(entry.actual, entry.expected, input.comparison),
  }));
  const keys = new Set<string>();
  for (const entry of observations) {
    if ((entry.kind !== "test" && entry.kind !== "example") || !nonempty(entry.path)) {
      throw new Error("Package-check observations require a supported kind and non-empty path.");
    }
    const key = `${entry.kind}:${entry.path}`;
    if (keys.has(key)) throw new Error(`Duplicate package-check observation '${key}'.`);
    keys.add(key);
    const id = entry.kind === "test" ? "package-tests" : "examples";
    const stage = stages.find((candidate) => candidate.id === id);
    if (!stage?.discovered.includes(entry.path) || !stage.executed.includes(entry.path)) {
      record(
        id,
        "failed",
        "invalid-observation-inventory",
        "Observation is absent from its discovered or executed inventory.",
        entry.path,
      );
    }
    if (
      !entry.actual.freshSession ||
      (entry.expected !== undefined && !entry.expected.freshSession)
    ) {
      record(
        id,
        "unexecuted",
        "session-isolation-unverified",
        "Both observations must come from fresh sessions.",
        entry.path,
      );
    }
    if (
      entry.actual.status !== "completed" ||
      (entry.expected !== undefined && entry.expected.status !== "completed")
    ) {
      record(
        id,
        "failed",
        "execution-failed",
        "The NativR or oracle execution did not complete successfully.",
        entry.path,
      );
    }
    if (entry.expected?.repeatable === false) {
      // Neither a match nor a mismatch against one capture of a non-repeatable oracle is evidence.
      record(
        "test-output",
        "unexecuted",
        "oracle-nondeterministic",
        "The oracle produced different output when the same input ran twice, so an exact comparison cannot establish compatibility.",
        entry.path,
      );
    } else if (entry.comparison.outcome === "no-expectation") {
      record(
        "test-output",
        "unexecuted",
        "missing-expectation",
        "No normative oracle observation was supplied.",
        entry.path,
      );
    } else if (entry.comparison.outcome === "mismatch") {
      record(
        "test-output",
        "failed",
        "observation-mismatch",
        `Exact ${entry.comparison.adaptedDifference?.field ?? "observation"} comparison failed after declared transport adaptations.`,
        entry.path,
      );
    }
    if (entry.comparison.crossStreamOrder === "unobserved") {
      record(
        "output-order",
        "unexecuted",
        "output-order-unobserved",
        "Independent output streams do not establish cross-stream ordering.",
        entry.path,
      );
    } else if (entry.comparison.outputEvidence === "incomplete") {
      record(
        "output-order",
        "unexecuted",
        "output-order-incomplete",
        "Complete output ordering cannot be established from incomplete stream captures.",
        entry.path,
      );
    } else if (
      entry.actual.outputOrder !== undefined &&
      entry.expected?.outputOrder !== undefined
    ) {
      const expectedOrder =
        input.comparison.adaptations.length === 0
          ? entry.expected.outputOrder
          : reverseOrderedTextTransport(entry.expected.outputOrder);
      if (outputOrderDifference(entry.actual.outputOrder, expectedOrder) !== null) {
        record(
          "output-order",
          "failed",
          "output-order-mismatch",
          "Complete observed output event sequences differ after declared transport adaptations.",
          entry.path,
        );
      }
    }
    if (entry.comparison.conditionEvidence === "incomplete") {
      record(
        "conditions",
        "unexecuted",
        "conditions-incomplete",
        "Complete classes, calls, and condition ordering were not observed on both sides.",
        entry.path,
      );
    } else if (
      entry.expected !== undefined &&
      conditionDifference(entry.actual, entry.expected) !== null
    ) {
      record(
        "conditions",
        "failed",
        "condition-mismatch",
        "Complete observed condition classes, messages, calls, or ordering differ.",
        entry.path,
      );
    }
    if (entry.comparison.outputEvidence === "incomplete") {
      record(
        "test-output",
        "unexecuted",
        "output-incomplete",
        "Complete output was not captured on both sides.",
        entry.path,
      );
    }
  }
  for (const [id, kind] of [
    ["package-tests", "test"],
    ["examples", "example"],
  ] as const) {
    const stage = stages.find((candidate) => candidate.id === id);
    for (const path of stage?.executed ?? []) {
      if (!keys.has(`${kind}:${path}`)) {
        record(
          id,
          "unexecuted",
          "missing-observation",
          "Executed item has no captured observation.",
          path,
        );
        record(
          "test-output",
          "unexecuted",
          "missing-observation",
          "Executed item has no captured observation.",
          path,
        );
      }
    }
  }
  const outputPaths = observations.map((entry) => `${entry.kind}:${entry.path}`);
  for (const id of ["test-output", "output-order", "conditions"] as const) {
    const stage = stages.find((candidate) => candidate.id === id);
    if (stage === undefined) continue;
    const missing = outputPaths.find(
      (path) => !stage.discovered.includes(path) || !stage.executed.includes(path),
    );
    const extra = stage.discovered.find((path) => !outputPaths.includes(path));
    if (missing !== undefined || extra !== undefined) {
      record(
        id,
        "unexecuted",
        "incomplete-output-inventory",
        "Output inventories must contain exactly every captured example and test, using kind:path keys.",
        missing ?? extra,
      );
    }
    if (stage.status === "inapplicable" && outputPaths.length > 0) {
      record(
        id,
        "failed",
        "invalid-inapplicability",
        "Captured examples or tests require output comparison.",
      );
    }
  }
  let firstBlocker = provenanceBlocker(input);
  if (firstBlocker === null && observations.every((entry) => entry.expected === undefined)) {
    firstBlocker = {
      stage: "provenance",
      code: "missing-oracle-observation",
      message: "No normative oracle execution observation was supplied.",
    };
  }
  if (firstBlocker === null) {
    const stage = stages.find(
      (candidate) => candidate.status !== "passed" && candidate.status !== "inapplicable",
    );
    if (stage !== undefined) {
      firstBlocker = blockers.get(stage.id) ?? {
        stage: stage.id,
        code: `stage-${stage.status}`,
        message: stage.reason,
      };
    }
  }
  // Snapshot the submitted evidence so subsequent caller mutation cannot change an issued report.
  return structuredClone({
    schemaVersion: 1,
    package: input.package,
    provenance: input.provenance,
    stages,
    observations,
    p7Eligible: firstBlocker === null,
    firstBlocker,
  });
}

function provenanceBlocker(input: PackageCheckEvidence): PackageCheckReport["firstBlocker"] {
  const provenance = input.provenance;
  let message: string | undefined;
  if (
    !/^[a-f0-9]{64}$/u.test(provenance.sourceSha256) ||
    !/^[a-f0-9]{64}$/u.test(provenance.artifactSha256) ||
    !/^[a-f0-9]{64}$/u.test(provenance.capabilitySha256)
  ) {
    message = "Source, artifact, and capability provenance require lowercase SHA-256 digests.";
  } else if (
    provenance.oracle.implementation !== "GNU R" ||
    provenance.oracle.version !== "4.6.1"
  ) {
    message = "Normative package-check observations require GNU R 4.6.1.";
  } else if (!/^\d+\.\d+\.\d+$/u.test(provenance.semanticProfile)) {
    message = "A versioned semantic profile must identify the observed NativR build.";
  } else if (
    LIMIT_NAMES.some(
      (name) =>
        !Number.isSafeInteger(provenance.runtimeLimits[name]) ||
        provenance.runtimeLimits[name] <= 0,
    )
  ) {
    message = "Every effective runtime limit must be a finite positive safe integer.";
  }
  return message === undefined
    ? null
    : { stage: "provenance", code: "invalid-provenance", message };
}

function validatePolicy(options: PackageCheckComparisonOptions): void {
  if (
    options.policyVersion !== 1 ||
    !isArray(options.adaptations) ||
    options.adaptations.length > 1
  ) {
    throw new Error(
      "Package-check policy 1 requires an explicit adaptations array with at most one verified transport adaptation.",
    );
  }
  for (const adaptation of options.adaptations) {
    if (
      adaptation.id !== "oracle-text-crlf-v1" ||
      adaptation.probeLiteralHex !== TRANSPORT_PROBE_LITERAL_HEX ||
      adaptation.stdoutHex !== TRANSPORT_PROBE_CRLF_HEX ||
      adaptation.stderrHex !== TRANSPORT_PROBE_CRLF_HEX
    ) {
      throw new Error(
        "Only oracle-text-crlf-v1 with an exact, independently captured stdout and stderr transport probe is permitted.",
      );
    }
  }
}

function reverseTextTransport(text: string): { text: string; pairs: number } {
  let pairs = 0;
  const restored = text.replaceAll("\r\n", () => {
    pairs += 1;
    return "\n";
  });
  return { text: restored, pairs };
}

function reverseOrderedTextTransport(
  events: NonNullable<PackageCheckObservation["outputOrder"]>,
): NonNullable<PackageCheckObservation["outputOrder"]> {
  const restored = events.map((event) => ({ ...event }));
  // A transport CR and its LF can straddle capture chunks. Only the immediately preceding
  // character in the same stream participates; other stream events keep their positions.
  for (const stream of ["stdout", "stderr"] as const) {
    let previous: { stream: "stdout" | "stderr"; text: string } | undefined;
    for (const event of restored) {
      if (event.stream !== stream || event.text.length === 0) continue;
      if (event.text.startsWith("\n") && previous?.text.endsWith("\r")) {
        previous.text = previous.text.slice(0, -1);
      }
      previous = event;
    }
  }
  return restored.map((event) => ({ ...event, text: reverseTextTransport(event.text).text }));
}

function validateStage(stage: PackageCheckStage): void {
  if (
    !PACKAGE_CHECK_STAGES.includes(stage.id) ||
    !["passed", "failed", "unexecuted", "inapplicable"].includes(stage.status) ||
    !nonempty(stage.reason)
  ) {
    throw new Error("Package-check stages require a known id, status, and non-empty reason.");
  }
  for (const paths of [stage.discovered, stage.executed]) {
    if (
      !isArray(paths) ||
      paths.some((path) => !nonempty(path)) ||
      new Set(paths).size !== paths.length
    ) {
      throw new Error(`Stage '${stage.id}' requires unique, non-empty inventory entries.`);
    }
  }
}

function validateObservation(observation: PackageCheckObservation): void {
  if (
    !["completed", "failed", "timed-out", "cancelled"].includes(observation.status) ||
    typeof observation.freshSession !== "boolean" ||
    typeof observation.outputComplete !== "boolean" ||
    typeof observation.conditionsComplete !== "boolean" ||
    typeof observation.stdout !== "string" ||
    typeof observation.stderr !== "string" ||
    !isArray(observation.conditions) ||
    (observation.repeatable !== undefined && typeof observation.repeatable !== "boolean")
  ) {
    throw new Error("Invalid package-check execution observation.");
  }
  for (const condition of observation.conditions) {
    if (
      (condition.kind !== "warning" && condition.kind !== "error") ||
      !isArray(condition.classes) ||
      (observation.conditionsComplete &&
        (condition.classes.length === 0 || condition.call === undefined)) ||
      condition.classes.some((name) => !nonempty(name)) ||
      typeof condition.message !== "string" ||
      (condition.call !== undefined &&
        condition.call !== null &&
        typeof condition.call !== "string")
    ) {
      throw new Error("Invalid package-check condition observation.");
    }
  }
  if (observation.outputOrder !== undefined) {
    if (
      !isArray(observation.outputOrder) ||
      observation.outputOrder.some(
        (event) =>
          (event.stream !== "stdout" && event.stream !== "stderr") ||
          typeof event.text !== "string",
      )
    ) {
      throw new Error("Invalid package-check output ordering observation.");
    }
    for (const stream of ["stdout", "stderr"] as const) {
      if (
        observation.outputOrder
          .filter((event) => event.stream === stream)
          .map((event) => event.text)
          .join("") !== observation[stream]
      ) {
        throw new Error("Package-check output ordering must reproduce both exact streams.");
      }
    }
  }
}

function observationDifference(
  actual: PackageCheckObservation,
  expected: PackageCheckObservation,
): PackageCheckDifference | null {
  if (actual.status !== expected.status)
    return { field: "status", index: 0, expected: expected.status, actual: actual.status };
  for (const field of ["stdout", "stderr"] as const) {
    if (actual[field] === expected[field]) continue;
    let index = 0;
    while (actual[field][index] === expected[field][index]) index += 1;
    return {
      field,
      index,
      expected: expected[field].slice(index, index + 80) || null,
      actual: actual[field].slice(index, index + 80) || null,
    };
  }
  const conditions = conditionDifference(actual, expected);
  if (conditions !== null) return conditions;
  if (actual.outputOrder !== undefined && expected.outputOrder !== undefined) {
    return outputOrderDifference(actual.outputOrder, expected.outputOrder);
  }
  return null;
}

function outputOrderDifference(
  actual: NonNullable<PackageCheckObservation["outputOrder"]>,
  expected: NonNullable<PackageCheckObservation["outputOrder"]>,
): PackageCheckDifference | null {
  const actualOrder = coalesceOutput(actual);
  const expectedOrder = coalesceOutput(expected);
  for (let index = 0; index < Math.max(actualOrder.length, expectedOrder.length); index += 1) {
    const actualText = actualOrder[index] === undefined ? null : JSON.stringify(actualOrder[index]);
    const expectedText =
      expectedOrder[index] === undefined ? null : JSON.stringify(expectedOrder[index]);
    if (actualText !== expectedText)
      return { field: "outputOrder", index, expected: expectedText, actual: actualText };
  }
  return null;
}

function conditionDifference(
  actual: PackageCheckObservation,
  expected: PackageCheckObservation,
): PackageCheckDifference | null {
  for (
    let index = 0;
    index < Math.max(actual.conditions.length, expected.conditions.length);
    index += 1
  ) {
    const left = actual.conditions[index];
    const right = expected.conditions[index];
    const includeClasses = (left?.classes.length ?? 0) > 0 && (right?.classes.length ?? 0) > 0;
    const includeCall = left?.call !== undefined && right?.call !== undefined;
    const actualText = left === undefined ? null : conditionText(left, includeClasses, includeCall);
    const expectedText =
      right === undefined ? null : conditionText(right, includeClasses, includeCall);
    if (actualText !== expectedText)
      return { field: "conditions", index, expected: expectedText, actual: actualText };
  }
  return null;
}

function conditionText(
  condition: PackageCheckObservation["conditions"][number],
  includeClasses: boolean,
  includeCall: boolean,
): string {
  return JSON.stringify({
    kind: condition.kind,
    ...(includeClasses ? { classes: condition.classes } : {}),
    message: condition.message,
    ...(includeCall ? { call: condition.call } : {}),
  });
}

function coalesceOutput(
  events: NonNullable<PackageCheckObservation["outputOrder"]>,
): readonly { stream: "stdout" | "stderr"; text: string }[] {
  const result: { stream: "stdout" | "stderr"; text: string }[] = [];
  for (const event of events) {
    if (event.text.length === 0) continue;
    const previous = result[result.length - 1];
    if (previous?.stream === event.stream) previous.text += event.text;
    else result.push({ ...event });
  }
  return result;
}

function nonempty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isArray(value: unknown): boolean {
  return Array.isArray(value);
}
