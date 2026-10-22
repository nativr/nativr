// Owned browser workloads; execution uses the packaged public Worker API.
const performance = globalThis.performance;
const moduleStartedAt = performance.now();
const { createR } = await import("/dist/index.js");
const moduleImportMs = performance.now() - moduleStartedAt;
const limits = { maxSteps: 50_000_000, maxCallDepth: 200, maxVectorLength: 2_000_000 };
const timeoutMs = 60_000;
const clockResolutionMs = (() => {
  const deadline = performance.now() + 10;
  let previous = performance.now();
  let minimum = Infinity;
  while (performance.now() < deadline) {
    const current = performance.now();
    if (current > previous) minimum = Math.min(minimum, current - previous);
    previous = current;
  }
  return Number.isFinite(minimum) ? minimum : null;
})();
const workloadSpecs = [
  {
    id: "gradient-simple-quadratic-4",
    code: 'local({x <- c(-1.5,0.25,2,3.5); y <- numDeriv::grad(function(z) sum(z^2), x, method="simple", method.args=list(eps=1e-6)); length(y)==4L && max(abs(y-(2*x+1e-6))) < 1e-6})',
  },
  {
    id: "jacobian-simple-polynomial-2",
    code: 'local({y <- numDeriv::jacobian(function(z) c(z[1]+z[2],z[1]*z[2]), c(2,3), method="simple", method.args=list(eps=1e-6)); identical(dim(y),c(2L,2L)) && max(abs(y-matrix(c(1,3,1,2),2))) < 1e-6})',
  },
  {
    id: "hessian-richardson-quadratic-4",
    code: 'local({y <- numDeriv::hessian(function(z) sum(z^2), c(-1.5,0.25,2,3.5), method="Richardson"); identical(dim(y),c(4L,4L)) && max(abs(y-2*diag(4))) < 1e-5})',
  },
  {
    id: "hessian-complex-quadratic-4",
    code: 'local({y <- numDeriv::hessian(function(z) sum(z^2), c(-1.5,0.25,2,3.5), method="complex"); identical(dim(y),c(4L,4L)) && max(abs(y-2*diag(4))) < 1e-5})',
  },
  {
    id: "hessian-complex-quadratic-12",
    code: 'local({y <- numDeriv::hessian(function(z) sum(z^2), seq_len(12)/4, method="complex"); identical(dim(y),c(12L,12L)) && max(abs(y-2*diag(12))) < 1e-5})',
  },
];
function failure(stage, error) {
  return {
    stage,
    code:
      typeof error?.code === "string" && /^[A-Z]{3}\d{4}$/.test(error.code)
        ? error.code
        : "unclassified",
    runtimeReset: error?.details?.runtimeReset === true,
  };
}
function expectOwned(condition, stage) {
  if (!condition)
    throw Object.assign(new Error("Owned benchmark assertion failed."), { benchmarkStage: stage });
}
async function timedEvaluation(runtime, code, expected) {
  const started = performance.now();
  const result = await runtime.evalDetailed(code, { timeoutMs });
  const wallMs = performance.now() - started;
  expectOwned(JSON.stringify(result.value) === JSON.stringify(expected), "owned-value");
  expectOwned(
    result.warnings.length === 0 &&
      result.output.length === 0 &&
      result.topLevelErrors.length === 0,
    "unexpected-output",
  );
  return { wallMs, evaluatorElapsedMs: result.elapsedMs, runtimeReset: result.runtimeReset };
}
globalThis.nativrPerformance = {
  metadata: { moduleImportMs, clockResolutionMs },
  async startup() {
    let runtime;
    try {
      const started = performance.now();
      runtime = await createR({
        execution: "worker",
        runtimeProfile: "package-test",
        limits,
        timeoutMs,
      });
      const createRMs = performance.now() - started;
      const firstEvaluation = await timedEvaluation(runtime, "1L+1L", 2);
      const capabilities = await runtime.capabilities();
      return {
        ok: true,
        createRMs,
        firstEvaluation,
        semanticProfileVersion: capabilities.semanticProfileVersion,
      };
    } catch (error) {
      return { ok: false, failure: failure(error.benchmarkStage ?? "startup", error) };
    } finally {
      await runtime?.dispose();
    }
  },
  async cancellation(iterations) {
    const samples = [];
    let runtime;
    try {
      runtime = await createR({
        execution: "worker",
        runtimeProfile: "package-test",
        limits: { ...limits, maxSteps: 1_000_000_000 },
        timeoutMs,
      });
      for (let sample = 0; sample < iterations; sample += 1) {
        await runtime.assign("ownedCancellationSentinel", 123);
        expectOwned((await runtime.get("ownedCancellationSentinel")) === 123, "interrupt-contract");
        await runtime.eval(`
          ownedCancellationGeneric <- function(x) {
            on.exit(return(9L))
            UseMethod("ownedCancellationGeneric")
            stop("generic continued")
          }
          ownedCancellationGeneric.default <- function(x) {
            on.exit(return(9L))
            repeat { 1L+1L }
          }
          invisible(NULL)
        `);
        let settled = false;
        const submissionAt = performance.now();
        const pending = runtime.evalDetailed("ownedCancellationGeneric(1L)", { timeoutMs }).then(
          () => {
            settled = true;
            return { ok: true, settledAt: performance.now() };
          },
          (error) => {
            settled = true;
            return {
              ok: false,
              settledAt: performance.now(),
              failure: failure("interrupt-evaluation", error),
            };
          },
        );
        await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
        expectOwned(!settled, "loop-was-not-pending");
        const interruptAt = performance.now();
        const restart = runtime.interrupt();
        const evaluation = await pending;
        await restart;
        const readyAt = performance.now();
        expectOwned(
          !evaluation.ok &&
            evaluation.failure.code === "NRL4005" &&
            evaluation.failure.runtimeReset,
          "interrupt-contract",
        );
        const recovery = await timedEvaluation(
          runtime,
          `
            g <- function(x) { UseMethod("g"); stop("generic continued") }
            g.default <- function(x) invisible(7L)
            c(1L+1L, as.integer(exists("ownedCancellationSentinel",inherits=FALSE)),
              as.integer(exists("ownedCancellationGeneric",inherits=FALSE)),
              sys.nframe() == 0L,
              identical(withVisible(g(1L)),list(value=7L,visible=FALSE)))
          `,
          [2, 0, 0, 1, 1],
        );
        samples.push({
          submissionToInterruptMs: interruptAt - submissionAt,
          rejectionLatencyMs: evaluation.settledAt - interruptAt,
          restartReadyMs: readyAt - interruptAt,
          recovery,
          totalRecoveryMs: performance.now() - interruptAt,
          pendingAtInterrupt: true,
          stateLossVerified: true,
          interruptionCode: evaluation.failure.code,
          runtimeReset: evaluation.failure.runtimeReset,
        });
      }
      return { ok: true, samples };
    } catch (error) {
      return {
        ok: false,
        samples,
        failure: failure(error.benchmarkStage ?? "cancellation", error),
      };
    } finally {
      await runtime?.dispose();
    }
  },
  async packageWorkloads(warmups, iterations) {
    let runtime;
    const workloads = [];
    try {
      const response = await globalThis.fetch("/numDeriv.bundle.json");
      expectOwned(response.ok, "package-input-response");
      const bundle = await response.json();
      const started = performance.now();
      runtime = await createR({
        execution: "worker",
        runtimeProfile: "package-test",
        limits,
        timeoutMs,
        packages: [bundle],
      });
      const createRWithPackageMs = performance.now() - started;
      const namespaceLoad = await timedEvaluation(
        runtime,
        'requireNamespace("numDeriv",quietly=TRUE)',
        true,
      );
      for (const spec of workloadSpecs) {
        const samples = [];
        let warmupsCompleted = 0;
        try {
          for (let index = 0; index < warmups; index += 1) {
            await timedEvaluation(runtime, spec.code, true);
            warmupsCompleted += 1;
          }
          for (let index = 0; index < iterations; index += 1)
            samples.push(await timedEvaluation(runtime, spec.code, true));
          workloads.push({ id: spec.id, ok: true, warmupsCompleted, samples });
        } catch (error) {
          workloads.push({
            id: spec.id,
            ok: false,
            warmupsCompleted,
            samples,
            failure: failure(error.benchmarkStage ?? spec.id, error),
          });
          break;
        }
      }
      return {
        ok: workloads.length === workloadSpecs.length && workloads.every((entry) => entry.ok),
        createRWithPackageMs,
        namespaceLoad,
        workloads,
      };
    } catch (error) {
      return {
        ok: false,
        workloads,
        failure: failure(error.benchmarkStage ?? "package-workloads", error),
      };
    } finally {
      await runtime?.dispose();
    }
  },
};
