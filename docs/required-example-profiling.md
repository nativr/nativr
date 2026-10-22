# Profiling the required browser examples

This diagnostic measures the existing playground test with its original examples, assertions, real
Run clicks, viewports and 120-second timeout. It changes no runtime or product behavior. Use the
existing Node 24 / pnpm 11 toolchain and cached Playwright browsers.

## Run a sample

Build serially before measurement. Keep other owned browser, runtime and native-oracle workloads
idle, and do not run builds or typechecks while a browser consumes the artifacts. The profiling
configuration refuses to reuse an existing preview server; do not terminate an unrelated server.

```powershell
pnpm build
pnpm benchmark:examples:check
pnpm benchmark:examples:test
$env:NATIVR_E2E_SKIP_BUILD = '1'
pnpm benchmark:examples --project=webkit
```

The configuration uses one worker, no retries and no screenshots, traces or video. It writes a
unique `nativr-required-example-profile` directory below the host temporary directory. The JSON
report contains an `owned-required-example-profile` attachment only when the original test and all
attribution checks pass. Keep raw Playwright reports local; canonical evidence should contain only
the validated metadata attachment and the relevant command, artifact and input digests.

Establish one valid sample before repeating it. Run Chromium and Firefox controls separately. An
unchanged test run with profiling disabled supplies a whole-test baseline. Host load and
instrumentation differ between runs, so a duration difference alone does not establish a cause.

## What the measurements mean

| Field                         | Measurement                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `armRpcMs`                    | Added browser round trip that arms the next owned sample ID                                     |
| `actionCallMs`                | Duration of the original Playwright click call, including actionability waits                   |
| `activationToUiCompleteMs`    | Browser activation to observed terminal UI state                                                |
| `displayedEvaluatorElapsedMs` | Existing rounded evaluator-only value shown by the playground; null for expected error outcomes |

Click and UI durations overlap. Do not add or subtract them to produce a time breakdown. UI
completion includes setup, parsing, evaluation, transport and rendering; it is not pure Worker
execution time. Evaluator time uses the existing `Date.now` clock and display precision. Zero may
mean below clock resolution. Observer timestamps record callback observations rather than exact DOM
assignment times.

Startup response-body copying and hashing, one arming round trip per Run, and the observer itself
add diagnostic overhead. This is not a startup benchmark or a release latency acceptance test. The
separate [Worker performance measurements](performance.md) retain their own scope.

## Attribution and reproducibility

Each generation needs exactly one activation, an observed busy transition, and a terminal
transition. Repeated identical result text is valid. Missing, duplicate, reordered, overlapping,
hidden or truncated observations fail validation. Busy and completion transitions collapsed into one
observer batch are rejected rather than assigned invented timestamps.

The fixture hashes its owned inputs and served playground artifacts before and after the run, checks
observed local responses against those artifact bytes, and requires startup readiness. Successful
browser-created local blob responses are counted separately; they receive no served-artifact
verification credit. Unknown HTTP responses still fail validation. The successful attachment
contains owned IDs, timings, fixed status values and repository-relative paths/digests. It contains
no R source, result/error text, package output, URLs or browser traces.

## When the example test changes

Keep each Run site wrapped in `profiledRun` with a unique owned ID. The manifest checker rejects
unprofiled Run calls and unsupported control flow. Its generated order includes explicit finite loop
occurrences. Review changes before refreshing the manifest:

```powershell
pnpm benchmark:examples:manifest
pnpm benchmark:examples:check
pnpm benchmark:examples:test
```

Manifest generation updates metadata only. It does not rewrite source or assertions. The normal
check includes manifest consistency and attribution tests. Prior sample hashes remain historical
evidence and must not be relabeled as measurements of changed source.
