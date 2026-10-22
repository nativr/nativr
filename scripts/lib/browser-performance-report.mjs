/** Pure validation and allowlisted evidence for the offline browser performance runner. */
export const BROWSER_NAMES = Object.freeze(["chromium", "firefox", "webkit"]);
export const WORKLOAD_IDS = Object.freeze([
  "gradient-simple-quadratic-4",
  "jacobian-simple-polynomial-2",
  "hessian-richardson-quadratic-4",
  "hessian-complex-quadratic-4",
  "hessian-complex-quadratic-12",
]);
export const PERFORMANCE_LIMITATIONS = Object.freeze([
  "Local-loopback timings exclude browser process launch, internet delivery and OS cold-cache effects.",
  "HTTP no-store is used; independent fresh-context imports and one reused same-document import are separate measurements.",
  "Pending status is observable, but the public API has no Worker-execution-start acknowledgement.",
  "evaluatorElapsedMs is evaluator-only Date.now time: it excludes parsing, snapshots, serialization and transport and may be quantized to whole milliseconds.",
  "A zero duration means below the observed clock resolution, not instantaneous execution.",
  "Median and nearest-rank empirical p95 describe these small samples; they are not population estimates or release thresholds.",
  "Owned numerical workload success does not change corpus P6/P7 or normative platform evidence.",
]);
const STAGES = new Set([
  "preflight",
  "package-pack",
  "artifact-pin",
  "server",
  "browser-launch",
  "page-context",
  "startup",
  "owned-value",
  "unexpected-output",
  "loop-was-not-pending",
  "interrupt-evaluation",
  "interrupt-contract",
  "cancellation",
  "package-input-response",
  "package-workloads",
  "browser-phase",
  "cleanup",
  "dist-stability",
  "unclassified",
  ...WORKLOAD_IDS,
]);
export function performanceSettings(pilot = false) {
  return {
    pilot,
    startupFreshContextSamples: pilot ? 1 : 7,
    startupSameDocumentSamples: pilot ? 1 : 7,
    cancellationSamples: pilot ? 1 : 7,
    packageWarmups: pilot ? 0 : 2,
    packageSamples: pilot ? 1 : 9,
    phaseWatchdogMs: 180_000,
    navigationTimeoutMs: 30_000,
    evaluationTimeoutMs: 60_000,
    cancellationDelayMs: 100,
    headless: true,
  };
}
export function parsePerformanceArguments(args) {
  const options = { run: false, pilot: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (seen.has(argument)) throw new Error("Duplicate browser performance argument.");
    seen.add(argument);
    if (argument === "--run") options.run = true;
    else if (argument === "--pilot") options.pilot = true;
    else if (argument === "--archive" || argument === "--output") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error("Browser performance path is missing.");
      options[argument.slice(2)] = value;
    } else throw new Error("Unsupported browser performance argument.");
  }
  return options;
}
export function safePerformanceFailure(stage, error = {}) {
  return {
    stage: STAGES.has(stage) ? stage : "unclassified",
    code:
      typeof error?.code === "string" &&
      (/^[A-Z]{3}\d{4}$/.test(error.code) || error.code === "BENCHMARK_TIMEOUT")
        ? error.code
        : "unclassified",
    runtimeReset: error?.runtimeReset === true || error?.details?.runtimeReset === true,
    redacted: true,
  };
}
export function summarizeTimings(values) {
  if (!Array.isArray(values) || values.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error("Timing samples must be finite and nonnegative.");
  const sorted = [...values].sort((left, right) => left - right);
  const count = sorted.length;
  return {
    count,
    medianMs:
      count === 0
        ? null
        : count % 2
          ? sorted[(count - 1) / 2]
          : (sorted[count / 2 - 1] + sorted[count / 2]) / 2,
    empiricalP95Ms: count === 0 ? null : sorted[Math.ceil(count * 0.95) - 1],
    method: "nearest-rank",
    interpretation: "small-sample-descriptive-only",
  };
}
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const relativeAsset = (value) =>
  typeof value === "string" &&
  /^(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:js|wasm|json)$/.test(
    value,
  ) &&
  !value.split("/").includes("..");

/** Always return a redacted report; incomplete, malformed and stale evidence cannot pass. */
export function createBrowserPerformanceReport(input, expected) {
  input = object(input);
  const faults = new Set();
  const check = (condition, code) => {
    if (!condition) faults.add(code);
    return condition;
  };
  const number = (value, code) =>
    check(typeof value === "number" && Number.isFinite(value) && value >= 0, code) ? value : null;
  const integer = (value, code) =>
    check(Number.isSafeInteger(value) && value >= 0, code) ? value : null;
  const version = (value, code) =>
    check(typeof value === "string" && /^\d+(?:\.\d+){1,3}$/.test(value), code) ? value : null;
  const hash = (value, code) => (check(digest(value), code) ? value : null);
  const array = (value, count, code) => {
    check(Array.isArray(value) && value.length === count, code);
    return Array.isArray(value) ? value.slice(0, 64) : [];
  };
  const failure = (value) =>
    value ? safePerformanceFailure(object(value).stage, object(value)) : undefined;
  const settings = performanceSettings(expected.pilot === true);
  check(input.schemaVersion === 1 && input.kind === "exploratory-browser-performance", "schema");
  check(
    Object.keys(object(input.settings)).length === Object.keys(settings).length &&
      Object.entries(settings).every(([key, value]) => input.settings[key] === value),
    "settings",
  );
  check(input.semanticProfileVersion === expected.semanticProfileVersion, "profile");
  check(/^\d+\.\d+\.\d+$/.test(input.semanticProfileVersion ?? ""), "profile");
  const semanticProfileVersion = version(input.semanticProfileVersion, "profile");
  const packageInput = object(input.package);
  const pinned = expected.package;
  check(
    pinned?.name === "numDeriv" && ["development", "regression"].includes(pinned?.partition),
    "package-partition",
  );
  check(
    ["name", "version", "partition", "sourceSha256", "artifactSha256"].every(
      (key) => packageInput[key] === pinned?.[key],
    ),
    "package-pin",
  );
  const packageReport = {
    name: packageInput.name === "numDeriv" ? "numDeriv" : null,
    version:
      typeof packageInput.version === "string" && /^[\d.-]+$/.test(packageInput.version)
        ? packageInput.version
        : null,
    partition: ["development", "regression"].includes(packageInput.partition)
      ? packageInput.partition
      : null,
    sourceSha256: hash(packageInput.sourceSha256, "source-digest"),
    artifactSha256: hash(packageInput.artifactSha256, "artifact-digest"),
  };
  check(packageReport.version !== null, "package-version");
  check(input.archiveVerified === true && input.artifactVerified === true, "package-not-verified");
  const hashes = {};
  for (const key of ["runnerSha256", "harnessSha256", "reportHelperSha256"]) {
    hashes[key] = hash(input[key], "tool-digest");
    check(input[key] === expected[key], "tool-digest-mismatch");
  }
  const distDigests = (Array.isArray(input.distDigests) ? input.distDigests : [])
    .slice(0, 256)
    .map((file) => {
      file = object(file);
      return {
        path: check(relativeAsset(file.path), "asset-path") ? file.path : null,
        bytes: integer(file.bytes, "asset-bytes"),
        sha256: hash(file.sha256, "asset-digest"),
      };
    });
  check(
    distDigests.length > 0 &&
      new Set(distDigests.map((file) => file.path)).size === distDigests.length,
    "asset-list",
  );
  check(
    JSON.stringify(distDigests) === JSON.stringify(expected.distDigests),
    "asset-digest-mismatch",
  );
  check(
    ["index.js", "tree-sitter-r.wasm", "web-tree-sitter.wasm", "elementary.wasm"].every((name) =>
      distDigests.some((file) => file.path === name),
    ) && distDigests.some((file) => /^assets\/worker-entry-.*\.js$/.test(file.path ?? "")),
    "required-assets",
  );
  check(input.distStable === true, "dist-changed");
  check(input.toolingStable === true, "tooling-changed");
  const evaluation = (value) => {
    value = object(value);
    check(value.runtimeReset === false, "unexpected-reset");
    return {
      wallMs: number(value.wallMs, "evaluation-duration"),
      evaluatorElapsedMs: number(value.evaluatorElapsedMs, "evaluator-duration"),
      runtimeReset: value.runtimeReset === true,
    };
  };
  const startup = (value, fresh) => {
    value = object(value);
    check(value.ok === true && value.failure === undefined, "startup-failed");
    check(value.semanticProfileVersion === expected.semanticProfileVersion, "startup-profile");
    return {
      ok: value.ok === true,
      semanticProfileVersion: version(value.semanticProfileVersion, "startup-profile"),
      createRMs: number(value.createRMs, "startup-duration"),
      ...(fresh ? { moduleImportMs: number(value.moduleImportMs, "module-import-duration") } : {}),
      firstEvaluation: evaluation(value.firstEvaluation),
      ...(failure(value.failure) ? { failure: failure(value.failure) } : {}),
    };
  };
  const engines = array(input.engines, BROWSER_NAMES.length, "engine-count").map((raw) => {
    raw = object(raw);
    check(BROWSER_NAMES.includes(raw.name), "engine-name");
    const same = object(raw.sameDocument);
    const cancellation = object(raw.cancellation);
    const packageRun = object(raw.package);
    const freshContext = array(
      raw.freshContext,
      settings.startupFreshContextSamples,
      "fresh-count",
    ).map((value) => startup(value, true));
    const sameSamples = array(same.samples, settings.startupSameDocumentSamples, "same-count").map(
      (value) => startup(value, false),
    );
    check(cancellation.ok === true && cancellation.failure === undefined, "cancellation-failed");
    const cancellationSamples = array(
      cancellation.samples,
      settings.cancellationSamples,
      "cancellation-count",
    ).map((value) => {
      value = object(value);
      check(
        value.pendingAtInterrupt === true &&
          value.stateLossVerified === true &&
          value.interruptionCode === "NRL4005" &&
          value.runtimeReset === true,
        "cancellation-contract",
      );
      return {
        submissionToInterruptMs: number(value.submissionToInterruptMs, "cancellation-duration"),
        rejectionLatencyMs: number(value.rejectionLatencyMs, "cancellation-duration"),
        restartReadyMs: number(value.restartReadyMs, "cancellation-duration"),
        totalRecoveryMs: number(value.totalRecoveryMs, "cancellation-duration"),
        recovery: evaluation(value.recovery),
        pendingAtInterrupt: value.pendingAtInterrupt === true,
        stateLossVerified: value.stateLossVerified === true,
        interruptionCode: value.interruptionCode === "NRL4005" ? "NRL4005" : null,
        runtimeReset: value.runtimeReset === true,
      };
    });
    check(packageRun.ok === true && packageRun.failure === undefined, "package-failed");
    const workloads = array(packageRun.workloads, WORKLOAD_IDS.length, "workload-count").map(
      (value) => {
        value = object(value);
        check(WORKLOAD_IDS.includes(value.id), "workload-id");
        check(
          value.ok === true &&
            value.failure === undefined &&
            value.warmupsCompleted === settings.packageWarmups,
          "workload-failed",
        );
        const samples = array(value.samples, settings.packageSamples, "workload-sample-count").map(
          evaluation,
        );
        return {
          id: WORKLOAD_IDS.includes(value.id) ? value.id : null,
          ok: value.ok === true,
          warmupsCompleted: integer(value.warmupsCompleted, "warmup-count"),
          samples,
          wallSummary: summarizeTimings(
            samples.map((sample) => sample.wallMs).filter((value) => value !== null),
          ),
          evaluatorSummary: summarizeTimings(
            samples.map((sample) => sample.evaluatorElapsedMs).filter((value) => value !== null),
          ),
          ...(failure(value.failure) ? { failure: failure(value.failure) } : {}),
        };
      },
    );
    check(
      new Set(workloads.map((value) => value.id)).size === WORKLOAD_IDS.length,
      "workload-duplicates",
    );
    check(raw.externalRequestCount === 0 && raw.pageErrorCount === 0, "browser-errors");
    check(
      raw.clockResolutionMs === null ||
        (Number.isFinite(raw.clockResolutionMs) && raw.clockResolutionMs > 0),
      "clock-resolution",
    );
    check(raw.ok === true && raw.failure === undefined, "engine-failed");
    return {
      name: BROWSER_NAMES.includes(raw.name) ? raw.name : null,
      version: version(raw.version, "browser-version"),
      ok: raw.ok === true,
      clockResolutionMs:
        raw.clockResolutionMs === null ? null : number(raw.clockResolutionMs, "clock-resolution"),
      freshContext,
      sameDocument: {
        moduleImportMs: number(same.moduleImportMs, "module-import-duration"),
        samples: sameSamples,
      },
      cancellation: {
        ok: cancellation.ok === true,
        samples: cancellationSamples,
        ...(failure(cancellation.failure) ? { failure: failure(cancellation.failure) } : {}),
      },
      package: {
        ok: packageRun.ok === true,
        createRWithPackageMs: number(packageRun.createRWithPackageMs, "package-startup-duration"),
        namespaceLoad: evaluation(packageRun.namespaceLoad),
        workloads,
        ...(failure(packageRun.failure) ? { failure: failure(packageRun.failure) } : {}),
      },
      summaries: {
        freshCreateR: summarizeTimings(
          freshContext.map((sample) => sample.createRMs).filter((value) => value !== null),
        ),
        sameDocumentCreateR: summarizeTimings(
          sameSamples.map((sample) => sample.createRMs).filter((value) => value !== null),
        ),
        rejection: summarizeTimings(
          cancellationSamples
            .map((sample) => sample.rejectionLatencyMs)
            .filter((value) => value !== null),
        ),
        restartReady: summarizeTimings(
          cancellationSamples
            .map((sample) => sample.restartReadyMs)
            .filter((value) => value !== null),
        ),
        totalRecovery: summarizeTimings(
          cancellationSamples
            .map((sample) => sample.totalRecoveryMs)
            .filter((value) => value !== null),
        ),
      },
      externalRequestCount: integer(raw.externalRequestCount, "request-count"),
      pageErrorCount: integer(raw.pageErrorCount, "page-error-count"),
      ...(failure(raw.failure) ? { failure: failure(raw.failure) } : {}),
    };
  });
  check(
    new Set(engines.map((engine) => engine.name)).size === BROWSER_NAMES.length,
    "engine-duplicates",
  );
  const host = object(input.host);
  const hostOs = ["win32", "linux", "darwin", "freebsd", "openbsd", "aix", "sunos"].includes(
    host.os,
  )
    ? host.os
    : null;
  const hostArch = ["x64", "arm64", "ia32", "arm", "ppc64", "s390x", "riscv64"].includes(host.arch)
    ? host.arch
    : null;
  const hostRelease =
    typeof host.release === "string" && /^[0-9][A-Za-z0-9._-]{0,79}$/.test(host.release)
      ? host.release
      : null;
  const nodeVersion =
    typeof host.nodeVersion === "string" && /^v\d+\.\d+\.\d+$/.test(host.nodeVersion)
      ? host.nodeVersion
      : null;
  check(typeof input.head === "string" && /^[a-f0-9]{40,64}$/.test(input.head), "head");
  check(
    typeof input.recordedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.recordedAt) &&
      Number.isFinite(Date.parse(input.recordedAt)) &&
      new Date(input.recordedAt).toISOString() === input.recordedAt,
    "recorded-at",
  );
  const report = {
    schemaVersion: 1,
    kind: "exploratory-browser-performance",
    ok: false,
    recordedAt: faults.has("recorded-at") ? null : input.recordedAt,
    semanticProfileVersion,
    settings,
    package: packageReport,
    archiveVerified: input.archiveVerified === true,
    artifactVerified: input.artifactVerified === true,
    head: faults.has("head") ? null : input.head,
    playwrightVersion: version(input.playwrightVersion, "playwright-version"),
    host: {
      os: hostOs,
      release: hostRelease,
      arch: hostArch,
      nodeVersion,
      cpuModelSha256: hash(host.cpuModelSha256, "cpu-digest"),
      logicalCpuCount: integer(host.logicalCpuCount, "cpu-count"),
    },
    ...hashes,
    distDigests,
    distStable: input.distStable === true,
    toolingStable: input.toolingStable === true,
    engines,
    limitations: [...PERFORMANCE_LIMITATIONS],
    ...(failure(input.failure) ? { failure: failure(input.failure) } : {}),
  };
  check(
    Object.values(report.host).every((value) => value !== null),
    "host-metadata",
  );
  check(host.logicalCpuCount > 0, "cpu-count");
  check(input.failure === undefined, "run-failed");
  report.validationErrors = [...faults].sort();
  report.ok = faults.size === 0;
  return report;
}
