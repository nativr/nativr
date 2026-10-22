# nativrTest 0.1.0 owned behavior contract

This independently authored interpreted R package is an optional testing tool for owned fixtures. It
uses the distinct namespace `nativrTest`. It does not replace `testthat`, install dependencies,
rewrite third-party test sources, satisfy an original dependency closure or establish P6/P7 credit.
The public documentation target is testthat 3.3.2, explicitly edition 3; per-API observations and
remaining gaps are recorded in `support-manifest.json`. API names alone are not compatibility
claims.

## Execution and assertions

`run_tests(run_file(path, code))` executes explicit files; there is no automatic file discovery.
`test_that` requires an active file and creates a local interpreted R closure with lexical access to
the file environment. Local bindings are isolated between tests; `on.exit` executes on success,
failure, skip and ordinary error. Nested runs, files and tests are unsupported.

`expect_true` and `expect_false` accept only the corresponding scalar logical value, disregarding
attributes for the assertion and returning the original actual invisibly. Under this runner, `fail`
records a failed expectation and execution continues; `pass` records success. Both return invisible
NULL. Legacy `succeed` returns its success condition invisibly. Failure messages are owned
diagnostics, not testthat rendering or source-label compatibility.

Plain errors, warnings and messages can be matched by class and/or a fixed string. The first
matching warning/message is captured; additional or unmatched warnings/messages reach the runner
handler. Error absence (`regexp=NA`) is supported as an owned contract. Negative error matching,
failure returns and captured condition identity/attributes have incomplete real-testthat parity.
Regex, chained conditions, warning/message absence, `all=TRUE` and custom diagnostic controls are
explicitly unsupported. Actual expressions and controls are evaluated at most once in the covered
fixture paths; complete argument-matching and forcing parity is not claimed.

`skip` terminates the current test. `skip_if` skips only for `isTRUE(condition)`; `skip_if_not`
skips otherwise. Earlier expectations are retained, and an earlier failure still fails the
aggregate. Empty tests are explicitly skipped. Ordinary errors terminate that test; later tests can
execute. Interactive standalone `test_that` is unsupported.

## Lifecycle and reporting

`setup` executes immediately in a clean child environment at file scope. `teardown` registers FIFO
file cleanup; later cleanups still execute after a cleanup failure. Setup/cleanup failures prevent a
completed aggregate. Their exact native-runner failure behavior remains unverified. There is no
arbitrary Reporter, withr lifecycle, snapshot or parallel-execution compatibility.

The private result kind is `nativr-test-core-events` version 1. It records ordered run/file/test,
expectation, condition, skip, lifecycle and issue events. Raw messages are private inputs to the
host projection. Unsupported use sets persistent state even if test code catches its condition. The
host projects an affected test to unsupported rather than accepting a private passed end.

Default reporter controls are 1,000 events and 8,192 UTF-8 bytes per text field; configuration
maxima are 10,000 events and 65,536 bytes. Limit failures preserve an aborted/incomplete result when
the runtime can complete finalization, including limits reached while recording an ordinary
top-level error. Runtime cancellation/resource failure can instead prevent a report; the host must
reject that attempt. R events and private state are not a hostile-code attestation.

The separate host tool binds source/runner/profile hashes, checks lossless snapshots and event
graphs, digests source-bearing text and rejects outer effects with unknown chronology. It emits
`nativr-runner-assisted-report` with `normativeTierCredit:false` and
`originalDependencyClosureSatisfied:false`. These flags cannot be changed by passing tests.

## Evidence and explicit gaps

`fixtures/core-contract-cases.json` contains 28 independently authored core checks. They passed
under GNU R 4.6.1 interpreting this owned implementation and under NativR 0.388.0 before promotion.
This is cross-interpreter evidence, not comparison against real testthat. Moved code requires fresh
maintained verification against its actual runtime profile.

`reference/` preserves separate black-box observations from installed testthat 3.3.2 edition 3: 27
direct observations, one forcing observation and five owned suite tests. No native/package
implementation bodies, foreign tests or implementation call traces were used. The successful
observations are deliberately narrower than complete API parity.

Waldo-backed `expect_identical` and `expect_equal`, and `expect_snapshot`, remain explicit
unsupported entrypoints. General condition identity/ancestry/regex behavior, exact diagnostic
rendering, interactive tests, nested tests, cleanup failure equivalence, helpers/discovery, package
admission and native dependency execution remain unfinished work.
