import { sha256 } from "../../../lib/assisted-test-runner/projection.mjs";
export const clone = (value) => structuredClone(value);
const digest = sha256("owned fixture");
export const metadata = {
  runner: {
    id: "nativr-cleanroom-test-runner",
    version: "0.1.0",
    sourceSha256: digest,
    bundleSha256: digest,
    behaviorContractSha256: digest,
    apiTarget: {
      package: "testthat",
      documentationVersion: "3.3.2",
      edition: 3,
      supportedApiManifestSha256: digest,
    },
  },
  input: {
    package: { name: "OwnedRunnerFixture", version: "0.1.0" },
    partition: "owned-fixture",
    sourceSha256: digest,
    artifactSha256: digest,
    dependencies: [
      {
        name: "nativrTest",
        version: "0.1.0",
        implementation: "clean-room-adapter",
        artifactSha256: digest,
        runnerId: "nativr-cleanroom-test-runner",
      },
    ],
    files: [{ path: "tests/test-owned.R", sha256: digest, role: "test", selection: "selected" }],
    discoveryPolicy: "explicit-files-v1",
    selectionComplete: true,
  },
  execution: {
    semanticProfile: "0.388.0",
    capabilitySha256: digest,
    mode: "inline",
    runtimeProfile: "package-test",
    effectiveLimits: {
      maxSteps: 10000000,
      maxCallDepth: 500,
      maxVectorLength: 1000000,
      maxOutputBytes: 1048576,
      maxPackageResourceBytes: 1048576,
    },
    reporterLimits: { maxEvents: 1000, maxRecordBytes: 65536 },
    configurationSha256: digest,
  },
};
export const path = "tests/test-owned.R";
export const event = (type, fields = {}) => ({ type, ...fields });
export function rawReport(events, outcome = "completed", eventsComplete = true) {
  return {
    kind: "nativr-test-core-events",
    schemaVersion: 1,
    runner: { id: "nativr-cleanroom-test-runner", package: "nativrTest", version: "0.1.0" },
    normativeTierCredit: false,
    originalDependencyClosureSatisfied: false,
    outcome,
    eventsComplete,
    events: events.map((e, sequence) => ({ sequence, ...e })),
  };
}
export const passEvents = [
  event("run-start"),
  event("file-start", { path }),
  event("test-start", { path, testId: 1, description: "owned PRIVATE description" }),
  event("expectation", {
    testId: 1,
    api: "expectation",
    outcome: "passed",
    message: "PRIVATE success",
  }),
  event("test-end", { testId: 1, outcome: "passed" }),
  event("file-end", { path }),
  event("run-end"),
];
// Independently authored mock transport encoder for pure validator tests, no runtime import.
export function transport(value, key = "") {
  if (value === null) return { raw: { version: 1, type: "null" }, value: null };
  if (Array.isArray(value)) {
    if (key === "classNames")
      return {
        raw: { version: 1, type: "character", values: [...value] },
        value: value.length === 1 ? value[0] : [...value],
      };
    const children = value.map((v) => transport(v));
    return {
      raw: { version: 1, type: "list", values: children.map((c) => c.raw) },
      value: children.map((c) => c.value),
    };
  }
  if (typeof value === "object") {
    const names = Object.keys(value),
      children = names.map((k) => transport(value[k], k));
    return {
      raw: { version: 1, type: "list", names, values: children.map((c) => c.raw) },
      value: children.map((c) => c.value),
    };
  }
  const type =
    typeof value === "boolean" ? "logical" : typeof value === "number" ? "double" : "character";
  const values =
    type === "logical"
      ? new Uint8Array([value ? 1 : 0])
      : type === "double"
        ? new Float64Array([value])
        : [value];
  return { raw: { version: 1, type, values }, value };
}
export function evaluation(raw = rawReport(passEvents)) {
  return {
    ...transport(raw),
    visible: true,
    topLevelErrors: [],
    warnings: [],
    output: [],
    dataViews: [],
    browseRequests: [],
    graphics: [],
    elapsedMs: 1,
    runtimeReset: false,
  };
}
