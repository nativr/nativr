// Node host adapter for the optional owned runner. Public reports contain no source.
import { createAdmission, projectEvaluation, ProjectionError, sha256 } from "./projection.mjs";
const plans = new WeakMap();
const fail = (code) => {
  throw new ProjectionError(code);
};
const MAX_SOURCE_BYTES = 262144,
  MAX_WRAPPER_BYTES = 1048576,
  MAX_RUNNER_BYTES = 262144;
function rejectOutcome(code) {
  return Object.freeze({
    kind: "nativr-assisted-attempt-rejection",
    schemaVersion: 1,
    normativeTierCredit: false,
    originalDependencyClosureSatisfied: false,
    code,
  });
}
export function prepareCapturedRun(
  metadata,
  sources,
  bundle,
  controls = { maxEvents: 1000, maxTextBytes: 8192 },
) {
  if (
    !Number.isSafeInteger(controls.maxEvents) ||
    controls.maxEvents < 2 ||
    controls.maxEvents > 10000 ||
    !Number.isSafeInteger(controls.maxTextBytes) ||
    controls.maxTextBytes < 1 ||
    controls.maxTextBytes > 65536
  )
    fail("invalid-core-capture-controls");
  // First validate metadata before reading source or constructing an executable wrapper.
  createAdmission(metadata);
  if (metadata.execution.reporterLimits.maxEvents !== controls.maxEvents)
    fail("reporter-limit-mismatch");
  if (!Array.isArray(sources) || sources.length > 1000) fail("invalid-source-list");
  const selected = metadata.input.files.filter((f) => f.selection === "selected");
  if (sources.length !== selected.length) fail("source-selection-mismatch");
  let totalSourceBytes = 0;
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (
      !source ||
      Object.keys(source).sort().join(",") !== "path,source" ||
      source.path !== selected[i].path ||
      typeof source.source !== "string" ||
      source.source.length > MAX_SOURCE_BYTES
    )
      fail("source-identity-mismatch");
    totalSourceBytes += Buffer.byteLength(source.source, "utf8");
    if (totalSourceBytes > MAX_SOURCE_BYTES) fail("aggregate-source-limit");
    if (sha256(source.source) !== selected[i].sha256) fail("source-identity-mismatch");
  }
  if (
    !bundle ||
    Object.keys(bundle).sort().join(",") !== "description,namespace,rSources" ||
    !Array.isArray(bundle.rSources) ||
    bundle.rSources.length !== 1 ||
    !bundle.rSources[0] ||
    Object.keys(bundle.rSources[0]).sort().join(",") !== "path,source" ||
    bundle.rSources[0].path !== "R/runner.R"
  )
    fail("runner-bundle-identity-mismatch");
  let runnerBytes = 0;
  for (const value of [bundle.description, bundle.namespace, bundle.rSources[0].source]) {
    if (typeof value !== "string" || value.length > MAX_RUNNER_BYTES)
      fail("runner-bundle-size-limit");
    runnerBytes += Buffer.byteLength(value, "utf8");
    if (runnerBytes > MAX_RUNNER_BYTES) fail("runner-bundle-size-limit");
  }
  if (
    sha256(bundle.rSources[0].source) !== metadata.runner.sourceSha256 ||
    sha256(JSON.stringify(bundle)) !== metadata.runner.bundleSha256
  )
    fail("runner-bundle-identity-mismatch");
  // JSON string literals use the supported R escapes here; no shell or JavaScript evaluation.
  const pieces = [];
  let wrapperBytes = 256;
  for (const { path, source } of sources) {
    const piece = `nativrTest::run_file(${JSON.stringify(path)}, { eval(parse(text=${JSON.stringify(source)}), envir=environment()) })`;
    wrapperBytes += Buffer.byteLength(piece, "utf8") + 1;
    if (wrapperBytes > MAX_WRAPPER_BYTES) fail("wrapper-byte-limit");
    pieces.push(piece);
  }
  const files = pieces.join("\n");
  const code = `nativrTest::run_tests({\n${files}\n}, max_events=${controls.maxEvents}L, max_text_bytes=${controls.maxTextBytes}L)`;
  const admitted = structuredClone(metadata);
  admitted.execution.configurationSha256 = sha256(
    JSON.stringify({
      wrapperSha256: sha256(code),
      controls,
      runtimeProfile: admitted.execution.runtimeProfile,
      effectiveLimits: admitted.execution.effectiveLimits,
      runnerBundleSha256: admitted.runner.bundleSha256,
      mode: admitted.execution.mode,
    }),
  );
  const admission = createAdmission(admitted),
    handle = Object.freeze({});
  plans.set(handle, { admission, metadata: admitted, bundle: structuredClone(bundle), code });
  return handle;
}
function transportIsSilent(result) {
  if (!result || result.runtimeReset !== false) fail("runtime-reset-or-missing-result");
  for (const key of [
    "output",
    "warnings",
    "topLevelErrors",
    "graphics",
    "dataViews",
    "browseRequests",
  ])
    if (!Array.isArray(result[key]) || result[key].length !== 0) fail("unaccounted-host-effects");
}
/** Return only admitted report metadata, never executable source or bundle contents. */
export function capturedRunMetadata(plan) {
  const selected = plans.get(plan);
  if (!selected) fail("unrecognized-host-plan");
  const snapshot = structuredClone(selected.metadata);
  const freeze = (value) => {
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
    return value;
  };
  return freeze(snapshot);
}

export async function executeCapturedRun(plan, createSession, assets) {
  const selected = plans.get(plan);
  if (!selected) return rejectOutcome("unrecognized-host-plan");
  let session = null,
    result = null,
    rejection = null,
    callbackCount = 0;
  const effect = () => {
    callbackCount++;
  };
  try {
    session = await createSession({
      execution: selected.metadata.execution.mode,
      runtimeProfile: "package-test",
      limits: structuredClone(selected.metadata.execution.effectiveLimits),
      packages: [structuredClone(selected.bundle)],
      assets,
      onOutput: effect,
      onWarning: effect,
      onGraphics: effect,
      onDataView: effect,
      onBrowse: effect,
    });
    const capabilities = await session.capabilities();
    if (
      capabilities.semanticProfileVersion !== selected.metadata.execution.semanticProfile ||
      capabilities.languageSubsetVersion !== selected.metadata.execution.semanticProfile ||
      sha256(JSON.stringify(capabilities)) !== selected.metadata.execution.capabilitySha256
    )
      fail("runtime-capability-mismatch");
    if (callbackCount !== 0) fail("unaccounted-host-effects");
    transportIsSilent(
      await session.evalDetailed("library(nativrTest)", { printVisibleTopLevel: false }),
    );
    if (callbackCount !== 0) fail("unaccounted-host-effects");
    const evaluated = await session.evalDetailed(selected.code, { printVisibleTopLevel: false });
    if (callbackCount !== 0) fail("unaccounted-host-effects");
    result = projectEvaluation(selected.admission, evaluated);
  } catch (error) {
    // Unknown runtime/cancellation/resource error text can contain source. Never publish it.
    rejection = rejectOutcome(
      error instanceof ProjectionError ? error.code : "evaluation-or-capture-failed",
    );
  } finally {
    if (session)
      try {
        await session.dispose();
      } catch {
        rejection = rejectOutcome("session-disposal-failed");
      }
  }
  if (callbackCount !== 0 && !rejection) rejection = rejectOutcome("unaccounted-host-effects");
  return (
    rejection ??
    Object.freeze({
      kind: "nativr-assisted-attempt-complete",
      schemaVersion: 1,
      normativeTierCredit: false,
      originalDependencyClosureSatisfied: false,
      ...result,
    })
  );
}
