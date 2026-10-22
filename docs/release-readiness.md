# Release readiness

Last assessed 2026-10-22 at verified semantic profile **0.393.0**. Canonical counts are generated in
[compatibility/status.json](../compatibility/status.json). The full compatibility target remains the
five completion criteria in [gnu-r-compatibility.md](gnu-r-compatibility.md).

## A. Limited developer preview

The supported scope is the Worker-first browser API and executable subset in
[compatibility-contract.md](compatibility-contract.md). Runtime code remains browser-first, ESM,
CSP-safe and network-free; host access requires explicit capabilities. No general package or GNU R
compatibility claim follows from this preview.

| Gate                               | Latest evidence                                                                                                                                                                                | Status              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Production check                   | Profile 0.393: 3,267 unit tests pass, 94 opt-in tests skipped; production/test/config types, build and bundle audit pass; final checker admission correction has separate focused verification | Passed              |
| Conformance                        | 1,480 checked-in, 1,407 live GNU R 4.6.1, 395 recursive cases; 169 bindings linked with causal controls                                                                                        | Passed              |
| Native metadata/signature fixtures | 71 owned Rd/S4 tests pass at 0.360, including native severity, signature and method fixtures                                                                                                   | Passed              |
| Browser e2e                        | Profile 0.393 on Windows: 12/12 pass across Chromium, Firefox and WebKit, including recursive unlist; required examples take 13.3 / 15.3 / 72.0 s under the unchanged 120 s budget             | Passed on this host |
| Packed consumer                    | Profile 0.388: offline strict declaration check, browser consumer build and package-tools CLI pass                                                                                             | Passed              |
| Fixed bundle limits                | Profile 0.393: client 17.6/150 KiB gzip; Worker 492.9/512 KiB gzip; parser 671.9/1,536 KiB raw; elementary module 311.2/384 KiB raw                                                            | Passed              |
| CI and publication                 | Local work only; no pushed CI result for this increment; publication/bootstrap remains a maintainer action                                                                                     | Open                |

**Readiness:** release verification is incomplete. Repeated Windows workload timings are recorded;
broader workload coverage, latency acceptance budgets, the declared OS matrix, CI and release
packaging remain open. The approved roadmap does not authorize push or publication.

## B. Full browser-admissible GNU R 4.6.1 compatibility

| Criterion                                        | Current evidence                                                                                                                                                                                                                                   | Status                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Domain evidence                                  | All **13** domains remain incomplete. Qualified inventory: 1,353 assigned, 1,200 pending; all 823 registered bindings assigned; 116 partial dimensions on 20 bindings; matrices need closure                                                       | Not met                 |
| Callable evidence/exclusions                     | 796/2,522 distinct names overlap; 169 bindings have specific recursive links. Name overlap is inventory, not a completion percentage                                                                                                               | Not met                 |
| Broad corpus evidence                            | Profile 0.393 refresh of all 24 development/regression packages: 1 P7, 1 P6, 10 P5, 11 P4, 1 P3; Formula remains the unevaluated P0 holdout. Explicit higher-tier blockers remain                                                                  | Not met                 |
| Platform verification                            | Correctly rounded elementary Wasm is shipped and used in sessions, including complex functions since 0.355. Windows oracle evidence remains advisory pending the separately authorized RFC-0007 Linux gate; browser/OS coverage remains incomplete | Not met                 |
| Agreement among ledger, capabilities and reports | Generated checks and this checkpoint agree. Future changes must regenerate capabilities, name coverage, callable inventory and status in order                                                                                                     | Met for this checkpoint |

There is no defensible completion date or percentage yet. Finishing requires semantic-domain
closure, broad package evidence and platform verification. See the maintained
[development continuation](development-continuation.md) for the ordered implementation queue.

## Verification environment

### Nested package-test coverage correction

The host checker now includes nested R files as unverified coverage obligations and rejects current
reports whose archive-path and nested-file inventories disagree. It does not infer nested execution
from a successful entrypoint or available dependency. Actual failures retain precedence; direct
tests without nested files retain their existing pass route. Runtime profile 0.393 is unchanged.

The
[verification record](../compatibility/platform-evidence/nested-test-coverage-windows-0.393.0.json)
distinguishes the complete 3,267-test production gate from the final admission correction's focused
checks: 65 evidence/process tests, 24 policy tests, five native fixtures, four reconciliation tests,
all-source types, lint and formatting pass. The native suite also counts its parent test separately.
No browser, conformance or packaging rerun is claimed for this host-only correction.

The
[three-package checkpoint](../compatibility/package-check-evidence/nested-test-closure-0.393.0/index.json)
preserves all 31 execution and comparison observations with stable inputs. pkgconfig's test stage is
now unexecuted with four nested files; abind remains P7-eligible; crayon retains its actual test
failure with twelve nested files. Qualified tiers remain P5, P7 and P4 respectively. The earlier
24-package refresh, its qualified distribution and all historical artifacts remain intact.

### Toolchain

Node 24.19.0, pnpm 11.17.0 and GNU R 4.6.1 on Windows x64, with C locale settings. Existing compiler
and Wasm caches were reused. Unit-test temporary files were moved outside Dropbox after EBUSY
cleanup failures. Native oracle runs used ordinary Windows permissions because sandbox ACL checks
made GNU R file.access reject readable fixtures. These are harness constraints, not accepted
deviations.

No Worker/protocol/playground interface changed in stabilization. E2e has now been refreshed at
profile 0.393 on Windows, including formatting recovery, UTC conversion, S3 class history, selector
forwarding, direct completion, loop/promise admission, generic-name validation and valid
helper/default recovery with ordered cleanup. The earlier fixture typing errors are repaired, and
`pnpm typecheck:all` checks production sources, tests and build configurations without emitting
files as part of `pnpm check`. The packed consumer now checks its public declarations strictly
before its browser build.

The [0.388 offline pack checkpoint](../compatibility/platform-evidence/pack-windows-0.388.0.json)
records both tarball digests and the smoke-script inputs. It reused the existing production build
and local dependency cache; strict consumer declaration checking, the browser consumer build and the
package-tools tarball CLI all passed. This does not establish registry or remote CI readiness.

### Current performance observations

The
[0.389 Windows performance checkpoint](../compatibility/platform-evidence/performance-windows-0.389.0.json)
passes all owned correctness and capture checks on Chromium, Firefox and WebKit. Each engine has
seven fresh-context startups, seven same-document startups, seven interruption/recovery samples, and
nine samples after two warmups for each of five fixed numDeriv workloads. Cached pins and stable
runtime/tool hashes are verified; external requests and page errors are zero.

| Median observation (milliseconds)          | Chromium | Firefox | WebKit |
| ------------------------------------------ | -------: | ------: | -----: |
| Fresh-context createR                      |     56.7 |     125 |     84 |
| Same-document createR                      |     59.8 |     116 |     76 |
| Interrupt to rejected evaluation           |      0.3 |       1 |      0 |
| Interrupt to completed recovery evaluation |     72.4 |     113 |     93 |
| Twelve-variable complex Hessian workload   |     75.5 |     618 |     68 |

Cancellation now submits an owned generic whose selected method loops, with method and generic
cleanup-return attempts. The existing explicit test budget and 100 ms pending check are unchanged.
Interruption rejects with NRL4005 and runtimeReset; fresh recovery verifies state loss, zero frames
and an invisible finite S3 result. There is no method-entry acknowledgement or cleanup-execution
claim. The recovery expression differs from 0.388, so total recovery timings are not directly
comparable. These descriptive samples do not establish latency acceptance or a speedup; zero
measurements reflect clock resolution. Broader OS coverage and agreed latency budgets remain open.

### Required-example profiling at profile 0.392

The
[diagnostic checkpoint](../compatibility/platform-evidence/required-examples-windows-0.392.0/index.json)
retains all 670 attributed executions from three isolated WebKit samples and one Chromium/Firefox
control each. All original assertions, real clicks, viewports and the 120-second limit remain.
WebKit takes 40.3–41.3 seconds, with median click-call time 209.9–214.3 ms and activation-to-UI time
10–11 ms. The measurements overlap; the exact actionability/scheduling cause remains unproven. One
prior uninstrumented baseline takes 44.8 seconds, which is insufficient for a speedup claim.
Seventy-seven pure tests cover attribution, source-manifest consistency and response classification.
Successful local Blob responses receive no served-asset credit; unknown HTTP assets still fail. This
adds diagnostic evidence without changing runtime semantics, bundle caps or release budgets.

## Bounded recursive unlist checkpoint (profile 0.393)

Recursive list/pairlist inputs now retain closures, builtins, environments and language values as
opaque list leaves. Mixed atomic cells retain storage and missingness while dropping scalar
attributes; hierarchical names and quoted expression leaves have bounded native evidence. Closure
capture and environment aliases are preserved. Ordinary atomic/factor and shallow routes retain
their existing behavior. Iterative traversal and cumulative name-byte preflight enforce existing
resource limits; five recovery guards are NativR-only evidence.

The [verification record](../compatibility/platform-evidence/unlist-recursive-windows-0.393.0.json)
keeps the original 43-case native pool and stable 0.392 baseline. The passing acceptance set
contains 41 unchanged assertions and one independently revalidated assertion isolating unlist from
an existing structure() attribute-order difference. That original row and named-expression metadata
remain explicit gaps. Four exact recursive groups add five environment-alias checks and eight strict
native causal controls. The inventory now has 116 partial dimensions on 20 bindings; all thirteen
domains remain incomplete.

After the full check, the corpus-checkpoint file passes 37 tests including the added 0.393 pin and
tier-qualification regression; the separate final all-source TypeScript check also passes.

The [browser checkpoint](../compatibility/platform-evidence/browser-windows-0.393.0.json) passes
12/12 tests, including three byte-exact native-backed Worker assertions. The
[24-package refresh](../compatibility/package-check-evidence/corpus-0.393.0.json) retains cached
pins, partitions, original entrypoints, repeatability and explicit blockers. No package-causality
claim follows solely from this increment. Repeated performance remains at 0.389, profiling at 0.392
and packed-consumer evidence at 0.388. Linux and Formula remain deferred; substitute-runner results
receive no original dependency-closure or P6/P7 credit.

The refresh corrects historical pkgconfig P7 credit: four nested test files are inventoried, but no
execution of those tests is demonstrated while testthat is unavailable. Its completed guarded
entrypoint and narrower checker p7Eligible flag are retained as observations, not full test-closure
proof. The maintained tier is P5 with an explicit P6 nested-tests-unverified blocker; examples are
inapplicable, not executed. This is an evidence-policy correction, not a new runtime regression. The
checker itself still needs an independently tested guard against that false eligibility.

The evaluate set_hooks example now completes where 0.389 failed, but its repeatable output still
differs from GNU R. Its P4 tier is unchanged. Browser timings above overlap native/corpus checks and
are advisory correctness-run durations, not isolated performance measurements.

## Bounded generic-name checkpoint (profile 0.392)

The 48 frozen native assertions close 33 reproduced mismatches and retain fifteen baseline guards.
UseMethod now accepts exactly one character element without coercion, including attributed/classed
scalars, NA as the name "NA" and the empty name. Literal missing generic actuals have their observed
diagnostic; forwarded missing expressions retain their originating formal's error. Invalid names are
rejected before existing loop/promise admission, and admission precedes selector forcing. Shared
scalar validation and internal/group dispatch entry points are unchanged.

All 48 focused source tests pass. Three foundation groups preserve 48 assertions and three exact
recursive groups preserve 48 raw observations with six strict group-level native causal controls.
Eleven links extend four existing UseMethod dimensions; totals stay at 109 partial dimensions on
nineteen bindings and 169 bindings with causal links. General no-method diagnostics, complete
argument matching, native-wrapper/library/evaluation and no-closure admission, condition origins and
full S3 behavior remain unfinished. No callable or semantic domain is complete.

The [browser checkpoint](../compatibility/platform-evidence/browser-windows-0.392.0.json) passes all
twelve tests. Four new assertions verify missing/invalid names leave selectors unforced, NA/empty
names find owned methods, invalid names precede context errors and valid NA reaches context
admission. The
[original-package pair](../compatibility/platform-evidence/offline-packages-windows-0.392.0/index.json)
preserves all 21 observation objects, both fifteen-stage arrays, repeatability and blockers against
the 0.389 full-corpus baseline and 0.391 pair. abind remains P7-eligible; numDeriv retains its
test-output blocker. The full 24-package corpus remains at 0.389, performance at 0.389 and
packed-consumer evidence at 0.388. Formula stays untouched; assisted-runner results grant no
original dependency-closure or P6/P7 credit.

## Bounded promise-origin checkpoint (profile 0.391)

The 22 frozen native assertions close ten reproduced defects and retain twelve baseline guards.
UseMethod now rejects a forced expression from another environment while an interpreted helper's own
function target is active. The generic name still evaluates first; rejection precedes selector and
original-promise forcing. Own defaults and ordinary inner generic calls remain admitted. Explicit
call origins and exact function targets keep native wrappers and library/evaluation contexts outside
this bounded correction.

All 23 focused tests pass. The additional NativR-only session guard proves failed-promise reset,
successful retry, caching, cleanup and zero-frame recovery; it supplies no native
interrupted-promise warning credit. Three foundation groups and three exact recursive groups retain
22 assertions, 21 raw components and six strict native causal controls. Six links extend four
existing partial UseMethod dimensions; totals remain 109 partial dimensions on nineteen bindings and
169 bindings with causal links. No domain or callable is complete.

The [browser checkpoint](../compatibility/platform-evidence/browser-windows-0.391.0.json) passes all
twelve tests, including four new Worker assertions for rejection, helper/generic cleanup, a valid
generic through a helper and an own default. The
[original-package pair](../compatibility/platform-evidence/offline-packages-windows-0.391.0/index.json)
preserves all 21 observation objects, both fifteen-stage arrays, repeatability and blockers against
the maintained 0.389 baseline and the 0.390 pair. abind remains P7-eligible; numDeriv retains its
test-output blocker. Both cached archives remain in regression with unchanged pins. The full
24-package corpus remains recorded at 0.389, performance at 0.389 and packed-consumer evidence at
0.388. Formula remains untouched; assisted-runner results grant no original dependency-closure or
P6/P7 credit.

## Bounded loop-context checkpoint (profile 0.390)

The 38 frozen native fixtures reproduce sixteen baseline defects and retain twenty-two guards. The
runtime now rejects direct same-closure active-loop UseMethod calls after generic evaluation and
before selector or original-promise forcing. For sequences, completed loops and inner generics
called from a caller's loop retain their bounded behavior. Cleanup and a same-session invisible
finite dispatch verify recovery. Broader evaluation/forced-argument contexts remain unfinished.

The [browser checkpoint](../compatibility/platform-evidence/browser-windows-0.390.0.json) passes all
twelve tests on this Windows host. Three foundation groups and three exact recursive groups extend
partial UseMethod evidence; its errors dimension brings the total to 109 partial dimensions on
nineteen bindings. No callable or domain is complete. Performance remains measured at 0.389, and
packed-consumer evidence at 0.388.

Only the
[abind/numDeriv pair](../compatibility/platform-evidence/offline-packages-windows-0.390.0/index.json)
is refreshed at 0.390. All 21 observation inputs, outcomes and repeatability flags, plus their
fifteen-stage statuses, match 0.389. abind retains ten matches and P7 eligibility; numDeriv retains
five matches, six mismatches, two nonrepeatable observations and test-output as its first blocker.
Both are regression partition archives, with unchanged pins. This advisory run adds no normative
tier credit. The full 24-package checkpoint remains at 0.389; Formula remains untouched.

## Cached package checkpoint

All 24 development/regression archives matched their pinned hashes and were rerun with the original
package entrypoints, explicit RNG initialization and native repeatability observations. The
[0.389 checkpoint](../compatibility/package-check-evidence/corpus-0.389.0.json) links all 24
redacted reports with no checker aborts. Summaries contain allowlisted metadata, digests, capture
statuses and counts; source, output and diagnostic strings are omitted. Formula was untouched.

All 178 script input hashes, execution/comparison outcomes and stage statuses match 0.388.
Repeatability flags match for 177 observations; withr with_timezone changes from true to false in
this run, while its NativR execution still fails. That single observation does not establish stable
native repeatability or compatibility improvement. Tiers remain unchanged. prettyunits retains P5:
all eight examples execute, seven match, and its original test stage is the first P6 blocker. The
time_ago mismatch and withr timezone execution failure remain explicit; native timezone
repeatability has varied across checkpoints. Original test entrypoints remain authoritative; no
substitute runner receives tier credit. The
[0.383 checkpoint](../compatibility/package-check-evidence/corpus-0.383.0.json) records the earlier
prettyunits P4-to-P5 advance from the bounded formatC implementation.

| Package group                                                                                         | Highest demonstrated tier | First remaining work                                                                            |
| ----------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| pkgconfig 2.0.3; abind 1.4-8                                                                          | P7                        | All specified stages pass or are inapplicable on this host; full platform gates remain separate |
| numDeriv 2016.8-1.1                                                                                   | P6                        | Output comparison: 5 matches, 6 differences; deferred numerical/platform verification           |
| generics; R6; labeling; praise; rprojroot; rstudioapi; rematch; ini; prettyunits                      | P5                        | Tests unavailable, failed or not demonstrated; see each pinned entry                            |
| withr; viridisLite; RColorBrewer; assertthat; crayon; evaluate; inline; whisker; zeallot; cpp11; otel | P4                        | Applicable examples or evidence collection remains blocked                                      |
| BH 1.90.0-1                                                                                           | P3                        | Representative workload/native build evidence unavailable; no oracle script observations        |
| Formula 1.2-6                                                                                         | P0                        | Holdout gate has not been authorized                                                            |

The inline checker abort from 0.356 was repaired at 0.357. Its current report is complete;
applicable examples remain blocked, so it retains P4. A dispatch result of completed does not prove
evaluation success: tiers use reconciled capture/stage results. In particular rematch receives no P6
credit merely because a guarded test entrypoint completes while testthat is unavailable and nested
tests are unverified. No substitute testing runner was used.

## Verification details and remaining defects

### Optional owned testing runner (0.1.0 on profile 0.389)

The [maintained runner](assisted-testing-runner.md) is an optional interpreted bundle with its own
namespace, contract and report format. The CLI accepts only pinned repository-owned fixtures;
admission binds hashes and explicit limits, strict capture rejects unknown chronology or incomplete
snapshots, and original-package evidence ingestion rejects assisted reports. Per-API support labels
retain native-parity gaps and explicit unsupported behavior.

All 29 source integration tests and 86 host/CLI tests pass. The nine built-runtime scenarios repeat
with seven identical report digests and two identical explicit rejections. The complete browser
suite passes 12/12 across the cached three engines; the added case checks optional bundle execution,
failure/unsupported outcomes, reporter abort and same-Worker recovery. It does not establish Worker
host-projection parity or real-testthat equivalence. The full check passes 3,105 tests with 94
opt-in skips and unchanged caps. Runtime semantics, capabilities, public API and profile remain
unchanged. Checked-in/live/recursive conformance is freshly verified at 1,467 / 1,394 / 382, with 55
NativR-only live skips. The
[owned checkpoint](../compatibility/assisted-testing-evidence/owned-core-windows-0.389.0/index.json)
and
[verification record](../compatibility/assisted-testing-evidence/owned-core-windows-0.389.0/verification.json)
retain the separate identities and results.

Original corpus tiers retain the 0.389 original-entrypoint checkpoint. This foundation cannot
satisfy the original testthat dependency closure, establish P6/P7, or close domain/callable
evidence. Broader testing APIs and package admission remain required work.

### Profile 0.388 verification (2026-10-22)

The omitted-selector baseline reproduced all nine proposed selection mismatches; twelve preservation
guards already passed. The bounded runtime fix selects NULL for a generic with no supplied actuals
and an empty-name symbol for a literal missing selected actual. Original actuals, method defaults,
missing flags, matched-first-formal priority, forcing and references remain intact. The existing
no-closure guard and forwarded-missing errors remain unchanged. All 21 focused tests and 681 related
regressions pass, including the prior explicit-selector and class-chain cases.

Four foundation groups and four exact recursive graphs extend evidence. Independent native
validation passes 38 checks, including eight strict causal controls and one reference invariant. Ten
links merge into five existing UseMethod dimensions: totals remain 107 partial dimensions on
nineteen bindings and 169 causal-linked bindings. Two neighboring native observations receive no
passing credit. Nonlocal return, visibility and the full S3 matrix remain unfinished; no domain or
callable is declared complete.

The full check passes 3,044 tests with 94 opt-in skips. Checked-in/live/recursive conformance passes
1,462 / 1,389 / 377, with 55 NativR-only live skips. The complete 24-package checkpoint retains all
178 input hashes, execution/comparison outcomes and stage statuses from 0.387, with unchanged tiers.
Repeatability flags match for 177 observations; withr with_timezone changes from false to true in
this run, but still fails in NativR. This single observation does not establish stable native
repeatability or a compatibility improvement. The
[Windows browser checkpoint](../compatibility/platform-evidence/browser-windows-0.388.0.json) passes
9/9, including NULL/literal-missing dispatch, method defaults and missing flags through the Worker
without evaluation network traffic. Required examples take 12.6 / 15.6 / 66.7 seconds within the
unchanged timeout; this is not release-performance acceptance. Worker gzip is 491.4/512 KiB, and all
caps pass. Subsequent local tooling checkpoints refresh performance and pack evidence to 0.388.
Public API/protocol, holdout, Linux, download and remote-action boundaries remain unchanged.

### Profile 0.387 verification (2026-10-22)

The explicit-selector baseline reproduced 18 mismatches in 21 independent native cases. The runtime
now retains the generic's original actual argument objects and uses its explicit selector only for
method selection. All 21 focused tests and 655 related regressions pass. The evidence covers
selected forcing order, lazy originals, named/positional rematching, owned call metadata,
zero-actual defaults/missing flags and NextMethod continuation with original or changed references.
Omitted selectors, nonlocal return, visibility and the complete S3 matrix remain unfinished.

Four foundation groups and five exact recursive graphs add evidence. Native validation passes 46
checks, including fourteen strict causal controls and two identity invariants. Seventeen new links
merge into nine existing UseMethod/NextMethod dimensions; the inventory retains 107 partial
dimensions on nineteen bindings, 169 causal-linked bindings and no completed callable or domain. Six
maintained neighboring observations receive no compatibility credit.

The full check passes 3,022 tests with 94 opt-in skips. Checked-in/live/recursive conformance passes
1,458 / 1,385 / 373; the live gate skips 55 NativR-only cases. All 24 cached package reports
preserve the 178 inputs, outcomes, stages and repeatability flags from 0.386. Tiers are unchanged.
The [Windows browser checkpoint](../compatibility/platform-evidence/browser-windows-0.387.0.json)
passes 9/9, including original-argument laziness and selector class history through the Worker with
no evaluation network traffic. Required examples take 12.5 / 15.7 / 66.5 seconds under the unchanged
timeout; this is not release-performance acceptance. Worker gzip remains 491.4/512 KiB and all fixed
caps pass. Performance and pack evidence remain at 0.380. Public API/protocol and existing download,
holdout, Linux and remote-action boundaries are unchanged.

### Profile 0.386 verification (2026-10-22)

The implicit S3 class-chain baseline reproduced 37 failures in 50 bounded native cases; three
primitive/group guard cases already passed. After the scoped correction, all 56 new tests pass (50
native cases, three native guard families and three resource/recovery cases). The combined
focused/regression run passes 628 tests across twelve files. Ordinary UseMethod and the modeled
units, units<- and as.POSIXct generics now retain the full integer/double/matrix/array search chain,
selected .Class suffix/history, lazy arguments and returned references. Public class labels and
primitive/group policies remain separate. Explicit selectors and broader S3 semantics remain open.

Seven foundation groups and eight exact recursive graphs add evidence; 98 independent native checks
include 28 strict causal controls and two reference invariants. All five associated callables
already had causal links, so the linked-binding count remains 169. Five matrices gain 21 partial
dimension links, merging four existing as.POSIXct dimensions: 107 partial dimensions across nineteen
bindings. The 21 maintained neighboring native observations confer no compatibility credit. No
domain or callable is complete.

The full check passes 3,000 tests with 94 opt-in skips. Checked-in/live/recursive conformance passes
1,454 / 1,381 / 368; the live gate skips 55 NativR-only cases. All 24 cached reports preserve the
178 input hashes, outcomes, stages and repeatability flags from 0.385. Package tiers are unchanged.
The [Windows browser checkpoint](../compatibility/platform-evidence/browser-windows-0.386.0.json)
passes 9/9, including S3 continuation, class history and unchanged public class/storage through the
Worker without evaluation network traffic. Required examples take 12.5 / 15.1 / 56.3 seconds under
the unchanged timeout; these timings do not establish performance acceptance. Worker gzip is
491.4/512 KiB, and all fixed bundle caps pass. Performance and pack evidence remain at 0.380. The
public NativR API and Worker protocol remain unchanged.

### Date/time inventory review (2026-10-22)

Public documentation titles and aliases classify 119 additional unregistered date/time and
time-series representation bindings in 26 families. The current inventory has 1,353 assigned and
1,200 pending bindings. All 823 runtime registrations, 169 causal links, 90 partial dimensions,
corpus tiers and profile 0.385 are unchanged. Every domain remains incomplete. The review preserves
all prior assignments and adds no executable evidence or platform exclusions.

### Profile 0.385 verification (2026-10-22)

The bounded UTC/GMT POSIXlt converter and three predicate methods pass 206 focused tests: 191
independently authored native fixtures, four strict POSIXct attribute-order regressions, eight
shared arithmetic cases and three range/resource/recovery cases. A further 144 existing related
regressions pass. Native fixtures cover exact epochs, integer/double storage, NA/NaN/infinities,
recycled components, year names, attributes, Gregorian boundaries, validation and warning order,
lazy dispatch, missing arguments, explicit/omitted timezone labels and reference identity. The
converter uses bounded Gregorian arithmetic beyond JavaScript Date's range; named zones/DST, broader
parsing/origins and full implicit S3 chains remain unfinished.

Twenty-one native foundation groups plus one explicit NativR range boundary and 23 recursive groups
extend executable evidence. The independently authored fixture validation passes 286 native checks,
including 54 strict causal controls. Separate arithmetic validation passes thirteen checks,
including two native shadow observations; arithmetic receives exact graph evidence without a
qualified callable link because operator shadowing is outside the current binding-evidence policy.
Seven additional attribute-order controls pass. Seven callable matrices gain 42 partial dimensions.
Twenty-two maintained native gap controls retain unsupported parsing/origin, implicit-class,
timezone and native-range behavior without compatibility credit. Three additional maintained gap
families record dimensional attribute ordering, array attribute precedence and complex coercion
attribute stripping.

The full check passes 2,943 tests with 94 opt-in skips, both TypeScript gates and all validators.
Checked-in/live/recursive conformance passes 1,447 / 1,374 / 360, with 169 causal-linked bindings;
55 NativR-only cases are excluded from the live native gate. The complete cached corpus preserves
all 178 input hashes, outcomes, stage statuses and repeatability flags. Tiers remain unchanged. All
thirteen domains remain incomplete; the inventory now records 823 registered, 1,234 classified and
1,319 pending bindings, with 90 partial dimensions across fifteen bindings.

The [Windows browser checkpoint](../compatibility/platform-evidence/browser-windows-0.385.0.json)
passes 9/9, including UTC conversion, finite/nonfinite predicates and wide-year fractional results
through the Worker without evaluation network traffic. Required examples take 12.5 / 16.1 / 53.7
seconds, inside the unchanged timeout. These functional timings do not replace performance
acceptance. The public API and protocol remain unchanged; performance and pack checkpoints remain at
0.380. Worker JavaScript is 491.1/512 KiB gzip and all fixed bundle limits pass.

### Distribution inventory review (2026-10-22)

Public documentation titles and aliases classify 65 additional unregistered stats distribution
bindings in 23 families. The inventory now has 1,228 assigned and 1,325 pending bindings. All 817
runtime registrations and 162 causal links are unchanged, as are the 48 partial dimensions, corpus
tiers and semantic profile. Every domain remains incomplete. Inventory validation and generated
status checks pass; this metadata-only review adds no runtime or compatibility claim.

### Profile 0.384 verification (2026-10-22)

The sprintf resource increment passes 200 focused tests: 37 pure exact-formatter tests, six resource
and recovery tests, 25 independently authored native parity fixtures and 132 formatC regressions.
Aggregate UTF-8 limits include intermediate formatted text and correctly account for surrogate pairs
formed across chunks within a row. Expansion is checked before unbounded padding, and deterministic
scanning and bounded decimal arithmetic preserve cancellation/resource controls. Six native groups
plus three NativR-only resource cases extend foundation evidence; six recursive groups add causal
sprintf evidence. Six maintained native gap probes retain unsupported grammar, Unicode byte-field
behavior, missing formats and warning gaps. Recursive list/language text construction can still
allocate before its final checks and remains unfinished.

The full check passes 2,736 tests with 94 opt-in skips, both TypeScript gates and all validators.
Checked-in/live/recursive conformance passes 1,425 / 1,353 / 337 with 162 causal-linked bindings; 54
NativR-only cases are excluded from the live native gate. All 24 cached package reports retain their
previous outcomes and input hashes. The inventory now records 48 partial dimensions on eight
bindings; every domain and the full compatibility goal remain incomplete.

The [Windows browser checkpoint](../compatibility/platform-evidence/browser-windows-0.384.0.json)
passes 9/9, including Worker intermediate-width/precision rejection and same-session recovery
without evaluation network traffic. Required examples take 12.0 / 15.4 / 59.5 seconds in
Chromium/Firefox/WebKit, within the unchanged 120-second timeout. These functional-run timings do
not replace representative performance measurements. Public API and protocol are unchanged;
performance and packed-consumer evidence remain at 0.380. Worker JavaScript is 489.0/512 KiB gzip
and all bundle budgets pass.

### Profile 0.383 verification (2026-10-22)

The bounded formatC implementation passes 132 focused tests: 128 native-backed fixtures, one
independent exact-rendering regression and three resource/deferred-behavior tests. Eleven new
foundation and eleven recursive groups cover conversions, precision/width/flags, nonfinite values,
lazy controls, metadata and reference identity. Seven new behavioral dimensions remain partial. Nine
native gap probes retain optional formatting and the independently confirmed Windows high-precision
discrepancy; normative Linux verification remains deferred.

The full check passes 2,666 unit tests with 94 opt-in skips, both TypeScript gates, 53 inventory
validators, 37 browser-report validators and six observer-decoder tests. Checked-in/live/recursive
conformance passes 1,416 / 1,347 / 331 with 161 causal-linked bindings. Bundle sizes remain inside
their unchanged budgets. prettyunits reaches P5 with eight executable examples, seven native matches
and repeatability; its test stage and time_ago output difference remain unfinished. The subsequently
extended saved-checkpoint integrity suite passes all 30 tests. Public API and Worker protocol are
unchanged. Browser, performance and packed-consumer evidence remains at 0.380. All thirteen domains
and the full five-criterion goal remain incomplete.

### Windows browser checkpoint (2026-10-22, profile 0.380)

The unchanged nine-test suite passes with one worker using the cached Playwright 1.62.0 browser
revisions. Chromium, Firefox and WebKit retain their configured desktop viewports, real clicks,
network assertions and timeouts. The required-example test passes in 10.4, 11.7 and 41.5 seconds; an
earlier isolated WebKit baseline with tracing also passes in 42.6 seconds. The
[redacted checkpoint](../compatibility/platform-evidence/browser-windows-0.380.0.json) records
source/runtime digests, browser revisions, commands and individual results.

A separate eight-activation WebKit diagnostic records roughly 16 ms initial frames, stable button
geometry after its first scroll, median real-click action time of 163.3 ms and supported-shortcut
time of 24.1 ms. The historical half-second stability waits do not reproduce on this run. No layout,
test-activation, viewport or timeout changes were needed. This does not establish the cause of the
historical timeout. The separate
[performance checkpoint](../compatibility/platform-evidence/performance-windows-0.380.0.json)
records repeated startup, cancellation and five fixed numDeriv workloads across all three engines.
All assertions pass; runtime and tooling hashes remain stable. See [performance](performance.md) for
sample counts, timings and limits. Additional OS coverage, broader workloads, latency acceptance
budgets and the separately authorized Linux gate remain open.

### Recursive observer verification at profile 0.382 (2026-10-22)

The observer now retains both component tokens before choosing whole-complex NA. Native preflights
pin 49 ordered component pairs plus whole NA; six pure decoder tests reject malformed untagged
complex payloads and preserve tagged graphs. All five focused inline/native observer tests pass. The
complete check passes 2,534 tests with 94 opt-in skips, and the corrected recursive gate passes all
320 existing cases with 160 causal-linked bindings. No case or control was removed or weakened.

All ten production JavaScript/Wasm artifact hashes are unchanged. No runtime profile, public API,
Worker protocol or package tier changed; the 0.382 corpus checkpoint remains applicable. This
improves observation fidelity and does not establish runtime mixed-component NA compatibility.

### Profile 0.382 verification (2026-10-22)

Shared is.finite/is.infinite/is.nan primitives now have 68 passing owned tests covering numeric
classification, ordinary complex components, attributes, eager argument forcing, visible S3
dispatch, NextMethod, reference identity and resource recovery. Nine new foundation groups and ten
recursive groups pass, including an independent is.nan case and a shared reference graph. All
declared causal controls pass. Mixed-component complex NA, POSIXlt methods, S4 and full S3
continuation remain open.

The full check passes 2,532 tests with 93 opt-in skips, plus the 53 inventory and 37 browser-report
validators. Checked-in/live/recursive conformance passes 1,405 / 1,336 / 320 with 160 causal-linked
bindings. The complete 24-package checkpoint refreshes existing tiers without changing pins,
partitions or Formula; all 29 saved-checkpoint integrity tests pass. Browser, performance and
packed-consumer evidence remains at 0.380; public API and Worker protocol are unchanged. The full
five-criterion goal remains unfinished.

### Profile 0.381 verification (2026-10-22)

Difftime units access and replacement now have 132 independently authored native parity fixtures and
a session-limit/recovery test. The bounded matrix covers all 25 concrete unit conversions,
attributes and identity, empty and complex storage, ratio-first arithmetic, argument matching,
visibility and lazy S3/NextMethod dispatch. Eleven maintained native gap probes preserve the
remaining classed/malformed unit metadata and implicit storage-class dispatch limitations.

The full check passes 2,463 tests with 93 opt-in skips, plus 53 inventory and 37 browser-report
validator tests. Checked-in/live/recursive conformance passes 1,396 / 1,327 / 310; 157 bindings have
causal controls. The subsequently saved partial corpus checkpoint passes all 28 integrity tests.
Both profile identifiers and generated reports agree. Public API and Worker protocol are unchanged;
browser, performance and packed-consumer evidence remains at 0.380. All thirteen domains remain
incomplete. Continue the shared numeric predicates and remaining roadmap; Linux and Formula remain
separately authorized boundaries.

### Profile 0.380 verification (2026-10-22)

First-class base dollar replacement now shares default member storage with assignment syntax. Owned
native probes establish arity/member validation order, positional default arguments, lazy S3
replacement values, visible results, original method tags/call syntax and NextMethod continuation.
Missing values retain symbols or environment bindings, and unchanged omitted method formals survive
NextMethod. alist now represents omitted actuals with missing symbols. Atomic coercion warnings,
ordinary list/pairlist/call operations, dimension rules, environment/reference identity and plain
expression append/no-op behavior have bounded evidence.

All 92 independently authored parity fixtures pass, with ten shared-storage unit tests and a
session-limit/recovery test. The full check passes 2,329 tests with 93 opt-in skips; both production
and all-source TypeScript gates pass. Checked-in/live/recursive conformance passes 1,384 / 1,315 /
297, with 153 causal-linked bindings. The subsequent checkpoint-integrity suite passes 27 tests.
Client and Worker bundles are 17.6/150 and 485.1/512 KiB gzip; parser and elementary Wasm remain
671.9/1,536 and 311.2/384 KiB raw. Public API and Worker protocol are unchanged.

The [0.380 checkpoint](../compatibility/package-check-evidence/corpus-0.380.0.json) records all 24
digest-pinned cached development/regression packages, original entrypoints and native repeatability.
All 178 input hashes, execution/comparison outcomes and repeatability flags match 0.379; stages and
tiers are unchanged. pkgconfig and abind remain P7, numDeriv P6, eight packages P5, twelve P4 and BH
P3. The withr timezone case retains its native repeatability failure and mismatch. Formula and all
partition/archive/artifact pins are unchanged. No substitute testing runner receives P6/P7 credit.

The inventory now classifies 583 of 2,553 qualified bindings; 1,970 remain pending. It records 35
partial dimension declarations across six bindings. All thirteen domains and every callable remain
incomplete. Distinct-name overlap is 783/2,522 and does not measure completion. Attributed/named
expression and language behavior, final attributed-pairlist deletion, active-binding callbacks,
nested extraction, complete data-frame replacement and general NextMethod/condition origins remain
open. Owned gap probes are retained under conformance/probes. Browser, packed-consumer and platform
measurements were not refreshed by this semantic increment. Linux remains deferred. No downloads,
pushes or publication occurred; no GNU R implementation bodies were used.

### Callable/domain inventory v1 (2026-10-22, profile 0.379 unchanged)

The [inventory](callable-domain-inventory.md) records 2,553 qualified bindings, including 2,525
reference exports and 28 registrations absent from the export snapshot. All 151 causal-linked
bindings have reviewed domain assignments; 2,402 remain classification-pending. All thirteen domains
and every callable remain incomplete. No behavioral-matrix completion or platform exclusion is
inferred. The full check passes 2,222 unit tests (93 opt-in skips) and 53 independent inventory
validator fixtures. The required inventory check and canonical status reject stale inputs or
reports, and status records the inventory digest. This reporting increment does not change runtime
semantics or the recorded native/corpus evidence.

### Test types and packed declarations (2026-10-22, profile 0.379 unchanged)

Eleven test files now use complete runtime-limit fixtures, valid optional properties, discriminated
snapshot/AST narrowing, ArrayBuffer-backed archive bytes and a typed browser argument tuple. Focused
tests pass 158 cases with 13 opt-in skips; the full check passes 2,222 tests with 93 opt-in skips.
The broader non-emitting TypeScript check passes and is now a required check step.

The declaration plugin's obsolete rollupTypes option was replaced with bundleTypes and explicit
bundling of the AST, protocol and runtime type dependencies. The strict packed-consumer test first
reproduced missing internal-package declarations, then passed after the fix. Offline pack smoke also
passes the browser consumer build and package-tools CLI. Four runtime JavaScript artifacts retain
exactly the same hashes as the verified semantic build, so profile 0.379 and its native/corpus
evidence remain applicable. The installed API Extractor emits an advisory that its TypeScript 5.9.3
engine is older than the project's 6.0.3; the actual TypeScript 6.0.3 packed-consumer check passes.

### Profile 0.379 verification (2026-10-22)

names and names<- now use class/default dispatch with source-order forcing, original actual tags,
visible results and owned substitution/matched-call metadata. names.POSIXlt and names<-.POSIXlt
expose closure signatures and use shared dollar extraction/replacement, names and length dispatch in
library scope. Classed atomic inputs can dispatch before default errors. Year length is observed
before container length; short components expand without truncating longer ones. Library-internal
names calls dispatch once in their recorded scope, preserving factor/time-list behavior.

Direct and nested dollar-member replacement use shared class/default/NextMethod paths and preserve
RHS-first evaluation and invisible assignment results. Sixty independently authored native parity
fixtures and a resource/recovery test pass. Seven foundation/recursive groups include causal
controls; metadata and diagnostic-only groups receive no causal credit. The evidence validator now
admits registered replacement-method identifiers, with five owned acceptance/rejection tests and an
explicit TypeScript declaration. The full check passes 2221 tests with 93 opt-in skips.
Checked-in/live/recursive conformance passes 1375 / 1306 / 287, with 151 linked bindings. All 26
checkpoint-integrity tests pass. Bundle budgets pass: client 17.6/150 KiB gzip, Worker 484.4/512 KiB
gzip, parser 671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap is 782/2,522; it is
not a completion percentage.

The [0.379 checkpoint](../compatibility/package-check-evidence/corpus-0.379.0.json) records all 24
digest-pinned cached development/regression packages with original entrypoints and applicable native
repeatability. All 178 script input hashes, execution/comparison outcomes and repeatability flags
are unchanged from 0.378; package stages and tiers are unchanged. pkgconfig and abind remain P7,
numDeriv P6, eight packages P5, twelve P4 and BH P3. The untouched Formula holdout remains P0. The
withr timezone example retains its native repeatability failure and mismatch; unchanged failures
gain no credit. No substitute testing runner receives P6/P7 credit. Formula and partition
assignments are unchanged. No public NativR API, Worker protocol, dependency direction or host
capability changed. E2e, pack smoke and performance measurements were not refreshed for this
base-runtime increment. No downloads, pushes or publication occurred; no GNU R implementation bodies
were development inputs.

Native active-binding member replacement performs extra get/set callbacks that remain unmatched.
Broader nested extraction dispatch, direct first-class dollar-replacement bindings, malformed and
attributed objects, full condition calls and general NextMethod dots/default behavior remain open.
Earlier replication/compiler/time-attribute gaps, all thirteen domain matrices, browser timing,
dataset/testing support and platform gates still require work. This increment closes its recorded
matrix; it does not establish complete names, member-replacement or POSIXlt compatibility.

### Profile 0.378 verification (2026-10-22)

rep.int and rep_len now have closure signatures, declaration-order forcing, scalar/vector control
coercion, ordered warnings, typed empty filling, factor class normalization and expression/element
identity preservation. Their interpreted class dispatch uses the observed primary/default/fallback
order, library lookup frames, visible results and distinct NextMethod fallback rules. Shared S3
methods expose generic environments, NextMethod forwards reassigned supplied formals, and UseMethod
uses its first matched formal for reversed named actuals. Final allocations and steps remain
bounded. The type errors in call construction and an ES2023-only array operation were fixed without
raising the browser language target.

All 66 independently authored native parity fixtures and the resource/recovery test pass. Fourteen
foundation/recursive groups pass; metadata and error-only diagnostic groups have no causal claims.
The full check passes 2154 tests with 93 opt-in skips. Checked-in/live/recursive conformance passes
1368 / 1299 / 280, with 149 linked bindings. All 25 checkpoint-integrity tests pass after saving the
new corpus checkpoint. Bundle budgets pass: client 17.6/150 KiB gzip, Worker 483.6/512 KiB gzip,
parser 671.9/1,536 KiB raw, elementary 311.2/384 KiB raw. Name overlap stays 780/2,522; it is not a
completion percentage.

The [0.378 checkpoint](../compatibility/package-check-evidence/corpus-0.378.0.json) records all 24
digest-pinned cached development/regression packages with original entrypoints and applicable native
repeatability. All 178 script input hashes, execution/comparison outcomes and repeatability flags
are unchanged from 0.377; package stages and tiers are unchanged. pkgconfig and abind remain P7,
numDeriv P6, eight packages P5, twelve P4 and BH P3. The untouched Formula holdout remains P0. The
withr timezone example retains its native repeatability failure and mismatch; unchanged failures
gain no credit. No substitute testing runner receives P6/P7 credit. Formula and partition
assignments are unchanged. No public NativR API, Worker protocol, dependency direction or host
capability changed. E2e, pack smoke and performance measurements were not refreshed for this
base-runtime increment. No downloads, pushes or publication occurred; no GNU R implementation bodies
were development inputs.

Explicit local evaluation establishes interpreted behavior. Native compiler optimizations change
replication lookup, frame counts and call syntax; compiled-path equivalence remains unfinished.
Unbound symbol inputs have a separate native evaluation difference. Integer suffixes in unused
argument diagnostics, exact condition-call attribution and omitted/dots rewriting in NextMethod
remain open. General S3 names dispatch, POSIXlt method bindings, time attributes, domain closure,
browser timing, dataset/testing support and platform validation also remain required work.

### Profile 0.377 verification (2026-10-22)

Replication now dispatches from the first actual before forcing unused method arguments. Its default
path preserves source-order forcing, matching, length-before-each validation, scalar fallbacks,
count coercion and ordered warnings. Empty vectors fill with typed missing values; expressions,
names, encodings and element identity are preserved within the recorded matrix. Final allocation is
guarded before expansion, including large each with small explicit length. Date, POSIXct, difftime,
factor and numeric_version methods use NextMethod and restore their specific attributes. POSIXlt
replicates components with shared control promises, keeps balance state, uses its year component for
row names and measures the longest component for length.

All 67 independently authored native parity fixtures pass, plus one step/allocation recovery test.
Sixteen foundation/recursive groups include causal controls. The error-catching method diagnostic
group has no causal link; successful class-method groups establish those links independently. The
full check passes 2086 tests with 93 opt-in skips; checked-in/live/recursive conformance passes 1354
/ 1285 / 266, with 146 linked bindings. After saving the checkpoint, all 24 checkpoint-integrity
tests pass. Fixed budgets pass: client 17.6/150 KiB gzip, Worker 483.1/512 KiB gzip, parser
671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap is 780/2,522; this is not a
completion percentage.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.377 checkpoint](../compatibility/package-check-evidence/corpus-0.377.0.json). All 178 script
input hashes, execution/comparison outcomes and repeatability flags are unchanged from 0.376; all
package stages and tiers are unchanged. pkgconfig and abind remain P7, numDeriv P6, eight packages
P5, twelve P4 and BH P3. The untouched Formula holdout remains P0. The withr timezone example
retains its recorded native repeatability failure and mismatch; no completion credit is inferred
from unchanged failures. Original package entrypoints were used; no substitute testing runner
receives P6/P7 credit. Native filesystem checks used ordinary Windows permissions. Formula remains
untouched. No public NativR API, Worker protocol, dependency direction or host capability changed.
E2e, pack smoke and performance measurements were not refreshed for this base-runtime increment. No
downloads, pushes or publication occurred. GNU R implementation bodies were not used as development
inputs.

Exact warning conditionCall/library-frame attribution remains open, including NextMethod warnings.
Full rep.int/rep_len parity, general S3 names dispatch, POSIXlt names-method bindings, malformed
time objects, attributed class-result shapes and the as.POSIXct explicit-timezone attribute gap
remain required work. General attributes, bytecode-equivalent control, earlier eval-frame
performance cost, browser timing and all thirteen domain closures are also unfinished. The full goal
stays active.

### Profile 0.376 verification (2026-10-22)

Logical conversion now accepts the eight native spellings without whitespace folding or arbitrary
case folding. Vector coercion, scalar flags and conditions share the parser while retaining their
separate missing-value behavior; type.convert retains its narrower grammar. as.logical handles
scalar list/pairlist elements, factor labels, S3 methods, primitive forcing order and diagnostics.
Recursive anyNA validates its flag for list inputs and ignores its value for atomic inputs.

mode/storage.mode getters and replacement functions now expose their recorded signatures, conversion
lookup, factor restrictions, attributes, argument order and diagnostics. as.single uses double
values with a Csingle marker. Symbol construction accepts atomic values without dispatch.
as.function constructs owned closures with caller/explicit environments, lazy defaults, missing
formal names, ellipsis and callable identity; its default method bypasses dispatch. as.call keeps
existing calls and distinguishes invalid input from an empty argument list. Attribute validation
prevents names from being restored onto a function result. Failed replacement retains its target.

All 53 independently authored native parity fixtures pass, plus one explicit unsupported-boundary
test. Nineteen foundation/recursive groups include causal controls for replacement bindings. The
full check passes 2017 tests with 93 opt-in skips; checked-in/live/recursive conformance passes 1338
/ 1269 / 250, with 138 linked bindings. After saving the checkpoint, all 23 checkpoint-integrity
tests pass. Fixed budgets pass: client 17.6/150 KiB gzip, Worker 481.5/512 KiB gzip, parser
671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap is 774/2,522; this is not a
completion percentage.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.376 checkpoint](../compatibility/package-check-evidence/corpus-0.376.0.json). All 178 script
input hashes, execution/comparison outcomes and repeatability flags are unchanged from 0.375; all
package stages and tiers are unchanged. pkgconfig and abind remain P7, numDeriv P6, eight packages
P5, twelve P4 and BH P3. The untouched Formula holdout remains P0. The withr timezone example
retains its recorded native repeatability failure and mismatch; no completion credit is inferred
from unchanged failures. Original package entrypoints were used; no substitute testing runner
receives P6/P7 credit. Native filesystem checks used ordinary Windows permissions. Formula remains
untouched. No public NativR API, Worker protocol, dependency direction or host capability changed.
E2e, pack smoke and performance measurements were not refreshed for this base-runtime increment. No
downloads, pushes or publication occurred. GNU R implementation bodies were neither inspected nor
captured.

Attributed symbol/expression conversion results explicitly report NRU6250. The general object
attribute model, full attribute validation, numeric coercion warnings/fallbacks, bytecode-equivalent
control, earlier eval-frame performance cost, browser timing and all thirteen domain closures remain
unfinished. The full completion goal stays active.

### Profile 0.375 verification (2026-10-21)

for, while, repeat, break, next and braces now have first-class special-primitive bindings. Syntax
and aliases share the existing environment-directed control machinery. Loop arity is checked before
forcing arguments; tags are positional. Conditions and bodies are reevaluated each iteration while
referenced promises keep their memoization and origin. While handles transfers from its condition
and body. Loop results remain invisible NULL; empty braces now return visible NULL. Braces retain
ordered evaluation, final visibility and identity. Ordinary callable lookup preserves replaced,
active and lazy bindings.

For converts factor labels before initialization, preserves their encoding and missing values, and
does not dispatch conversion methods. A malformed factor leaves the previous binding intact. For
then initializes the variable to NULL, including empty or subsequently invalid ordinary sequences.
Pairlists/lists retain element identity and attributes; expression vectors supply quoted values;
atomic elements lose container attributes. Active bindings observe initialization and each item.
Locked-binding errors preserve sequence effects. Nested loops, evaluation contexts, forwarded
promises, cleanup and finite resource limits retain the verified control boundaries.

Fifty-one independently authored parity fixtures pass native GNU R and NativR. One additional test
covers step/depth exhaustion and session recovery. The focused loop/control/frame suite passes 195
tests. Ten foundation groups and ten recursive cases add causal evidence, including braces. The full
check passes 1962 tests with 93 opt-in skips; checked-in/live/recursive conformance passes 1319 /
1250 / 231, with 127 linked bindings. After saving the checkpoint, all 22 checkpoint-integrity tests
pass. Fixed budgets pass: client 17.6/150 KiB gzip, Worker 479.9/512 KiB gzip, parser 671.9/1,536
KiB raw and elementary 311.2/384 KiB raw. Name overlap is 767/2,522; this is not a completion
percentage.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.375 checkpoint](../compatibility/package-check-evidence/corpus-0.375.0.json). All 178 script
input digests and execution/comparison outcomes are unchanged from 0.374; stage statuses and tiers
are also unchanged. The native repeatability flag for withr's with_timezone example changed from
true to false. Its NativR execution still fails and mismatches the oracle; this fluctuating native
observation provides no semantic improvement or tier credit. The other 177 repeatability flags are
unchanged. The corpus retains two P7 packages (pkgconfig and abind), one P6, eight P5, twelve P4 and
one P3, plus the untouched P0 holdout. Original entrypoints were used; substitute-runner results
receive no P6/P7 credit. Native filesystem checks used ordinary Windows permissions. Formula is
untouched. No public NativR API, Worker protocol, host capability or dependency direction changed.
E2e and pack smoke were not refreshed for this base-runtime increment. No downloads, pushes or
publication occurred; GNU R library implementation bodies were neither inspected nor captured.

Three transfer fixtures and one active-binding fixture explicitly evaluate loops with evalq.
Independent default-native-compilation probes differ: ordinary function for-loops with aliased
break/next report no loop owner, and an active while binding is not read. Explicitly evaluated loops
find the owner and read that binding once. NativR currently follows the interpreted path. This is an
open bytecode-equivalence defect, not an exclusion or completed behavior. The final advisory paired
source benchmark is within six percent of 0.374 on all six workloads after removing unnecessary
standard-path call allocation. See
[performance.md](performance.md#loop-invocation-measurement-at-profile-0375). The earlier eval-frame
cost against 0.372, browser performance and all thirteen domain closures remain unfinished. The full
completion goal stays active.

### Profile 0.374 verification (2026-10-21)

return and if now have first-class special-primitive bindings. Aliases, constructed calls and
ordinary syntax use shared lazy control machinery. Syntax performs callable lookup, including active
bindings, lazy defaults and replacement functions. Return preserves the value's visibility,
attributes, identity, promise origin and environment-directed owner/cleanup. Its value is forced
before reporting a missing owner, while surplus arguments fail before evaluation. Named, missing and
surplus syntax arguments are retained by the parser. If forces only its condition and selected
branch; omitted and explicitly missing branches retain distinct visibility/error behavior.

Scalar conditional coercion is shared with while and existing library consumers. Length checks
precede type checks; logical NA has its own diagnostic; numeric/complex/character missing values and
uninterpretable values fail. Character conditions accept only the native spellings without trimming
or case folding. Special mapping targets retain literal ellipsis; extraction primitives [ and [[
expand it lazily, while dollar uses the literal member name. The full suite detected an extraction
regression during development; independent native probes established this distinction and the final
implementation passes the existing apply-family regression.

Forty-six independent parity fixtures pass GNU R and NativR, with two additional tests for the
top-level return boundary and resource-limit recovery. The focused control/integration suite passes
382 tests. Eight foundation groups and nine recursive cases add evidence with causal controls. The
full check passes 1909 tests with 93 opt-in skips; checked-in/live/recursive conformance passes 1309
/ 1240 / 221, with 121 linked bindings. After saving the checkpoint, all 21 checkpoint-integrity
tests pass. Fixed budgets pass: client 17.6/150 KiB gzip, Worker 479.2/512 KiB gzip, parser
671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap is 761/2,522; this is not a
completion percentage.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.374 checkpoint](../compatibility/package-check-evidence/corpus-0.374.0.json). All 178 script
input digests, execution/comparison outcomes and repeatability flags are unchanged from 0.373; stage
statuses and tiers are also unchanged. The corpus retains two P7 packages (pkgconfig and abind), one
P6, eight P5, twelve P4 and one P3, plus the untouched P0 holdout. Original entrypoints were used;
substitute-runner results receive no P6/P7 credit. Native filesystem checks used ordinary Windows
permissions. Formula is untouched. No public NativR API, Worker protocol, host capability or
dependency direction changed. E2e and pack smoke were not refreshed for this base-runtime increment.
No downloads, pushes or publication occurred; GNU R library implementation bodies were neither
inspected nor captured.

The advisory paired source benchmark against 0.373 measures a conditional-loop ratio of 1.104, an
eval-heavy ratio of 1.029 and an explicit-return ratio of 0.768. See workloads and medians in
[performance.md](performance.md#control-invocation-measurement-at-profile-0374). The previously
recorded eval-frame cost against 0.372 remains open; this comparison does not establish browser
performance acceptance or relax a budget. All thirteen domains and overall release readiness remain
unfinished; the full completion goal stays active.

### Profile 0.373 verification (2026-10-21)

Owned closures and modeled evaluation/library calls now share a reflective stack with explicit
parent links, call ASTs, callable identity and environment identity. eval/evalq have a public
library frame and an executable internal evaluator frame. local, eval.parent, with and with.default
execute through actual nested calls, including lazy formals/defaults and S3 method metadata. Fresh
environments reused by nested evaluation retain their first active parent context. Forwarded
promises retain their observation origin. Numeric eval environments select physical stack frames.
sys.frame, sys.parent, sys.parents, sys.calls and sys.frames expose the tested graph boundaries. The
internal evaluator has an unknown args/formals signature and forces its three arguments in order.
Host-driven namespace loading preserves the caller environment when no ordinary frame index exists,
so generated package functions retain their private helpers. The full native loader stack remains
outside this increment's evidence.

Forty-eight independent parity fixtures pass GNU R and NativR. They cover aliases, identities,
default bindings, nonlinear parents, calls/frame pairlists, numeric selection, errors, nested local
lookup and forcing order. Three additional tests cover the global boundary, resource-limit recovery
and namespace-created functions. The independent package fixture also passes native GNU R
installation/loading. Existing depth-eight recovery retains its budget: owned library AST bodies
reuse their active function's depth charge, while nested calls/evaluations remain bounded. Nine
foundation groups and eleven recursive cases add evidence with causal controls. The full check
passes 1859 tests with 93 opt-in skips; checked-in/live/recursive conformance passes 1301 / 1232 /
212, with 119 linked bindings. After saving the checkpoint, all 20 checkpoint-integrity tests pass.
Fixed budgets pass: client 17.6/150 KiB gzip, Worker 478.5/512 KiB gzip, parser 671.9/1,536 KiB raw
and elementary 311.2/384 KiB raw. Name overlap is 759/2,522; this is not a completion percentage.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.373 checkpoint](../compatibility/package-check-evidence/corpus-0.373.0.json). All 178 script
input digests, execution/comparison outcomes and repeatability flags are unchanged from 0.372; stage
statuses and tiers are also unchanged. The namespace-parent regression detected in the initial 0.373
sweep is repaired in this final checkpoint. The corpus retains two P7 packages (pkgconfig and
abind), one P6, eight P5, twelve P4 and one P3, plus the untouched P0 holdout. Original entrypoints
were used; substitute-runner results receive no P6/P7 credit. Native filesystem checks used ordinary
Windows permissions. Formula is untouched. No public NativR API, Worker protocol, host capability or
dependency direction changed. E2e and pack smoke were not refreshed for this base-runtime increment.
No downloads, pushes or publication occurred; GNU R library implementation bodies were neither
inspected nor captured.

The advisory paired source benchmark records an eval-heavy slowdown: 1,500 evalq calls took a median
31.3747 ms versus 10.7743 ms at 0.372 (2.912 times). Scalar/closure loops were within two percent;
exit cleanup took 1.100 times its prior median in this run. See the method and workloads in
[performance.md](performance.md#evaluation-frame-measurement-at-profile-0373). This is not browser
performance acceptance; optimization, startup/cancellation and representative package timings remain
required. Other library adapters, reflective stack traces and first-class special forms remain
incomplete. All thirteen domains and overall release readiness remain unfinished; the full
completion goal stays active.

### Profile 0.372 verification (2026-10-21)

source now establishes a return/cleanup scope around each expression, for parsed input and exprs=.
Return ends that expression while subsequent expressions continue; the final value and visibility
are preserved. Cleanup runs before the next expression, remains separate from owner cleanup, and can
replace the expression result. Ordinary errors stop later expressions after cleanup. Explicit
environments and local=TRUE/FALSE retain mutations and environment-directed loop control.

subset now scopes data-frame predicates and data-frame/matrix selections independently. Matrix,
atomic and plain-list predicates force their original promises; their control transfers and exit
handlers belong to the caller. Plain-list names no longer mask the caller's predicate bindings.
Forwarded promises, result dimensions/names, reference identity and resource-limit recovery have
owned evidence. No public API, Worker protocol, host capability or dependency direction changed.

Thirty-three independent parity fixtures pass GNU R and NativR; two additional tests verify that
cleanup returns cannot bypass resource exhaustion and that the session recovers. The focused scope
suite passes 79 tests. Five foundation groups and six recursive cases add causal evidence. The full
check passes 1807 tests with 93 opt-in skips; checked-in/live/recursive conformance passes 1292 /
1223 / 201, with 111 linked bindings. After saving the checkpoint, all 19 checkpoint-integrity tests
pass. Fixed budgets pass: client 17.6/150 KiB gzip, Worker 477.1/512 KiB gzip, parser 671.9/1,536
KiB raw and elementary 311.2/384 KiB raw. Name overlap remains 752/2,522.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.372 checkpoint](../compatibility/package-check-evidence/corpus-0.372.0.json). All 178 script
input digests and capture/comparison outcomes, stage statuses and tiers remain unchanged from 0.371.
One native repeatability flag changed: withr's with_timezone example is repeatable in this run,
after being nonrepeatable in 0.369–0.371. Its NativR execution still fails and mismatches the
oracle; this run does not establish stable behavior across runs or grant any semantic improvement or
tier credit. The other 177 repeatability flags are unchanged. Original entrypoints were used;
substitute-runner results receive no P6/P7 credit. Native filesystem checks used ordinary Windows
permissions. Formula is untouched. E2e and pack smoke were not refreshed for this base-runtime
increment. No downloads, pushes or publication occurred; no GNU R implementation bodies were
inspected.

Synthetic evaluation/library-wrapper frames, reflective stack identity and first-class special forms
remain incomplete. All thirteen domains and overall release readiness remain unfinished; the full
completion goal stays active.

### Profile 0.371 verification (2026-10-21)

Evaluation control scopes now isolate return and exit handlers for eval/evalq/local/with/within.
Return, break, next and on.exit resolve against the expression environment, preserving forwarded
promises and the distinction between reused and separate evaluation environments. Empty return is
visibly NULL. Missing targets now use the observed native messages. Owned closures retain their own
return targets, and matching-environment loop transfers pass through evaluation.

Owned closure and evaluation cleanup share captured handler execution. Handler registration order,
replacement/clearing, remaining handlers after ordinary errors or returns, result/visibility
overrides and registry changes during cleanup have independent evidence. Resource exhaustion remains
terminal and cannot be bypassed by a cleanup return; subsequent session evaluation succeeds.
transform now evaluates additions together, including unnamed expressions and visible list lookup,
so return skips later expressions and cleanup follows the complete addition evaluation.

Forty-two independently authored parity cases pass under native GNU R and NativR. Separate tests
cover a global eval return and resource-limit restoration. Six foundation groups and nine recursive
cases add causal evidence. The full check passes 1771 tests with 93 opt-in skips;
checked-in/live/recursive conformance passes 1287 / 1218 / 195, with 109 linked bindings. Fixed
budgets pass: client 17.6/150 KiB gzip, Worker 477.0/512 KiB gzip, parser 671.9/1,536 KiB raw and
elementary 311.2/384 KiB raw. Name overlap remains 752/2,522. After saving the evidence, all 18
checkpoint-integrity tests also pass.

An advisory paired evaluator comparison against a754902 produced median current/previous ratios:
scalar-loop 0.99, closure-loop 1.00, exit-loop 1.02, eval-loop 1.05. Both sides share other modules
at 0.371. This owned source-level check is not a browser, complete prior-release or package
performance claim; the declared performance gates remain open.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.371 checkpoint](../compatibility/package-check-evidence/corpus-0.371.0.json). Stage statuses and
tiers are unchanged from 0.370. withr's with_connection example now completes and matches the
repeatable native observation; its matching script count rises from two to three while remaining P4.
All 178 script input digests are unchanged; the other 177 capture/comparison outcomes are unchanged.
Formula is untouched. Original entrypoints were used; substitute-runner results receive no P6/P7
credit. Native filesystem checks used ordinary Windows permissions. E2e and pack smoke were not
refreshed for this runtime-only increment. The public API and Worker protocol are unchanged. No
downloads, pushes or publication occurred; no GNU R implementation bodies were inspected.

Synthetic evaluation/library-wrapper frames and reflective stack metadata remain incomplete.
First-class special-form bindings and further evaluation adapters still need closure. All thirteen
semantic domains and overall release readiness remain unfinished; the full completion goal stays
active.

### Profile 0.370 verification (2026-10-21)

Language evaluation now records its active environment and owned-frame entry position. Forwarded
promises retain that origin when younger closures force them. Nested and reused evaluation scopes
restore their predecessors; escaped environments without an active frame resolve to the global
position. The previously recorded local forwarding example now gives zero on both runtimes.

Twenty-one independently authored native parity cases cover eval/evalq/local/with, new/list/reused
environments, expression vectors, supplied/default promises, laziness, memoization, call/function
identity, visibility, side effects and escaped delayed bindings. A separate resource test exhausts
the existing call-depth budget through recursive eval and verifies subsequent frame inspection.
Evaluation origins participate in the runtime memory census and are removed in finally blocks. Three
foundation groups and six recursive cases add causal evidence without inspecting library
implementation bodies. The public API and Worker protocol are unchanged.

The full check passes 1726 tests with 93 opt-in skips. Checked-in/live/recursive conformance passes
1281 / 1212 / 186 cases, with 103 linked bindings. Fixed budgets pass: client 17.6/150 KiB gzip,
Worker 476.7/512 KiB gzip, parser 671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap
remains 752/2,522; it is not a completion percentage. The existing Node 24.19.0/pnpm 11.17.0 and GNU
R 4.6.1 caches were reused.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.370 checkpoint](../compatibility/package-check-evidence/corpus-0.370.0.json). Stage outcomes,
comparison-match counts and tiers are unchanged from 0.369. All 178 per-script input digests,
capture statuses and comparison outcomes are unchanged. Formula is untouched. Original entrypoints
were used; substitute-runner results receive no P6/P7 credit. Native filesystem checks used ordinary
Windows permissions. E2e and pack smoke were not refreshed for this runtime-only increment. No
downloads, pushes or publication occurred.

This closes relative evaluation-origin handling in the existing owned-frame model. Absolute native
eval and library-wrapper frames, their calls/functions, full control-flow behavior and complete
stack inspection remain open. All thirteen semantic domains and overall release readiness remain
incomplete. The active goal now records five measurable completion criteria in the
[development continuation](development-continuation.md); each must be evidenced before the goal is
complete.

### Profile 0.369 verification (2026-10-21)

Owned function display now omits embedded value attributes in bodies and defaults, while preserving
ordinary argument names where representable. Access and execution retain the original attributed
values. Nested lists and pairlists, factor/matrix storage, explicit structure syntax, observed
operator display and attributed closure values have independent evidence. Printed functions retain
ordinary nested atomic attributes with their attribute paths. Raw hexadecimal display, constructed
subset-call display and broader nested attribute printing remain unfinished.

sys.call and sys.function follow the evaluation frame of owned supplied/default promises; explicit
missing indices use their integer-zero defaults. sys.nframe has the observed zero-argument closure
signature and reports owned frame depth. Cases cover global evaluation, forwarded promises, relative
indices, range errors and restoration after errors and returns. Twenty-four independently authored
parity cases pass under native GNU R and NativR, with a separate global-frame regression. Three
foundation groups and six recursive cases add causal evidence. No library bodies were inspected.

The full check passes 1703 tests with 93 opt-in skips. Checked-in/live/recursive conformance passes
1278 / 1209 / 180 cases, with 101 linked bindings. Fixed budgets pass: client 17.6/150 KiB gzip,
Worker 476.6/512 KiB gzip, parser 671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap
is 752/2,522 and is not a completion percentage. The cached Node 24.19.0/pnpm 11.17.0 toolchain was
used without downloading dependencies.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.369 checkpoint](../compatibility/package-check-evidence/corpus-0.369.0.json). Stage outcomes,
comparison-match counts and tiers are unchanged from 0.368. Formula is untouched. Original
entrypoints were used; substitute-runner results receive no P6/P7 credit. Native filesystem checks
used ordinary Windows permissions. No Worker, playground or packaging interface changed, so e2e and
pack smoke were not refreshed. No downloads, pushes or publication occurred.

GNU R library wrappers and synthetic eval/local frames remain a reproduced gap: a forwarded
sys.nframe expression created in local can observe the forcing stack in NativR. The new frame
evidence uses explicitly owned function scopes; it does not claim synthetic-frame parity. Runtime
performance, browser/OS coverage, Linux validation and all thirteen semantic domains remain open.

### Profile 0.368 verification (2026-10-19)

Owned function reflection now returns atomic, symbol and call bodies in their observable types.
Named lookup skips non-functions and forces lazy or active bindings; explicit lookup environments
remain lazy for direct function inputs. Omitted accessors follow the caller evaluation frame,
including a promise forced by another owned closure. Public getter/setter signatures and warning
conditions have independent evidence. args uses global named lookup and distinguishes unknown
primitive signatures from an owned zero-argument function.

Body and formals replacement preserve embedded attributes, reference identity and lexical capture,
construct new closures without changing aliases, and drop function attributes as observed. Cases
cover expression bodies, constant/lazy defaults, explicit enclosures, warnings and forcing order.
Repeated constructed formal names retain separate argument positions; the body sees the first
binding and match.call retains both. Runtime limits still reject excessive materialization.
Forty-nine independently authored parity cases pass under native GNU R and NativR; a resource-limit
case also passes. Seven foundation groups and nine recursive cases cover storage, attributes,
conditions, calls, identity and side effects. No foreign implementation body was observed or
retained. Library-body reflection, complete callable defaults, first-class special-form bindings,
broad frame inspection and constructor diagnostic calls remain open.

The full check passes 1677 tests with 93 opt-in skips. Persisted checkpoint validation additionally
passes 15 tests. Checked-in/live/recursive conformance passes 1275 / 1206 / 174 cases, with 99
linked bindings. Fixed budgets pass: client 17.6/150 KiB gzip, Worker 476.1/512 KiB gzip, parser
671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap is 751/2,522 and is not a
completion percentage. A paired source-level evaluator/matcher comparison against 694b233 gave
repeat-run median ratios of 1.00 for a scalar loop, 1.01 for closure calls and 0.95 for vector
summation. This small advisory check shares other modules and establishes no browser or release
performance claim.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.368 checkpoint](../compatibility/package-check-evidence/corpus-0.368.0.json). Stage outcomes,
comparison-match counts and tiers are unchanged from 0.367. All 178 per-script input hashes, capture
statuses and comparison outcomes also match the previous checkpoint. Formula is untouched. Original
entrypoints were used; substitute-runner results receive no P6/P7 credit. Native filesystem checks
used ordinary Windows permissions. No Worker, playground or packaging interface changed, so e2e and
pack smoke were not refreshed. Runtime performance, browser/OS coverage, Linux validation and full
compatibility remain incomplete. No downloads, pushes or publication occurred.

### Profile 0.367 verification (2026-10-19)

Complex sequences retain real and imaginary components with explicit lengths. Colon coercion
warnings, invalid complex step comparisons, finite endpoints and empty output have owned evidence.
Numeric zero formatting now respects field alignment and trailing-zero removal, validates controls
when needed and signals one truncation warning. Unicode replacement widths and foreign internal
control-expression calls remain outside the demonstrated equivalence.

Factor double extraction continues S3 dispatch and restores levels/class, including attributes on
those metadata vectors. Cases distinguish direct named methods, aliases, anonymous calls and local
versus global next-method lookup. Internal .subset/.subset2 bypass class restoration. Recursive list
extraction accepts an atomic final leaf. Broad extraction diagnostics remain incomplete.

Partial sorting supports bounded rank selection, missing-region filtering, control forcing, integer
overflow warnings, option restrictions and the larger-request full-sort fallback. Forty-five owned
parity cases pass under native GNU R and NativR, plus a work-limit regression. Six foundation groups
and seven recursive cases retain values, storage, attributes, warnings, calls and forcing effects;
causal controls link .subset, .subset2, sort.int and format.default. A deterministic 600-input sweep
checks multiset preservation and every requested rank/partition invariant. The corresponding native
comparison found 376 different intermediate permutations. Those permutations remain an explicit
exactness gap; the suite does not declare full sort.int equivalence or invent a platform exclusion.

The full check passes 1626 tests with 93 opt-in skips. Checked-in/live/recursive conformance passes
1268 / 1199 / 165 cases, with 98 linked bindings. Fixed budgets pass: client 17.6/150 KiB gzip,
Worker 475.0/512 KiB gzip, parser 671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap
is 750/2,522 and is not a completion percentage. Native filesystem probes used ordinary Windows
permissions.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.367 checkpoint](../compatibility/package-check-evidence/corpus-0.367.0.json). Stage outcomes,
comparison-match counts and tiers are unchanged from 0.366. Formula is untouched. Original
entrypoints were used; substitute-runner results receive no P6/P7 credit. No Worker, playground or
packaging interface changed, so e2e and pack smoke were not refreshed. Runtime performance,
browser/OS coverage, Linux validation and full compatibility remain incomplete. No downloads, pushes
or publication occurred.

### Profile 0.366 verification (2026-10-19)

Runtime errors retain their originating language expressions across forced promises, closure calls,
handlers and evaluation. Explicit NULL origins and supplied conditions remain authoritative. Missing
object and callable diagnostics are distinct. Internal metadata storage preserves the public
TypeScript error API. The shared declared-default binder retains observed missing-argument condition
classes and class-specific handler selection; broader condition subclasses remain open.

match.arg now uses lazy declared defaults and preserves choice types and attributes. Owned cases
cover explicit and implicit forcing order, one/some/all selection modes, duplicate/ambiguous/empty
choices, missing values, NULL early return and diagnostic messages/calls. Factor vector subsetting
retains names, levels and class in observed order. Thirty-five owned parity cases pass under GNU R
and NativR, plus one resource-limit regression. Five foundation groups and five recursive cases
verify language structure, values, attributes, conditions and forcing effects. Causal controls link
match.arg; diagnostic-capture cases independently retain their observed fields.

A paired Node probe caught an 18-21% evaluator slowdown from an extra async wrapper. Origin handling
now stays inside the existing evaluation frame, awaiting recursive paths without adding another
function hop for literal evaluation. After repair, 24 alternating paired samples following eight
warmups had median previous/current times of 16.19/15.64 ms for a 3,000-step scalar loop,
27.63/24.96 ms for a 1,500-call closure loop, and 1.34/1.32 ms for a 10,000-element sum. The
baseline uses only the evaluator source from 1c8f052 with other modules shared at 0.366. These
advisory source-level timings resolve the observed local regression; they do not establish browser
startup, cancellation, package-workload performance or a general speedup.

The full check passes 1579 tests with 93 opt-in skips. Checked-in/live/recursive conformance passes
1262 / 1193 / 158 cases, with 96 linked bindings. Fixed budgets pass: client 17.6/150 KiB gzip,
Worker 473.1/512 KiB gzip, parser 671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap
remains 749/2,522 and is not a completion percentage. Native filesystem probes used ordinary Windows
permissions.

All 24 cached development/regression archives were digest-checked and rerun with applicable native
repeatability in the
[0.366 checkpoint](../compatibility/package-check-evidence/corpus-0.366.0.json). Stage outcomes,
comparison-match counts and tiers are unchanged from 0.365. Formula is untouched. Original
entrypoints were used; substitute-runner results receive no P6/P7 credit. No Worker, playground or
packaging interface changed, so e2e and pack smoke were not refreshed. Runtime performance,
browser/OS coverage, Linux validation and full compatibility remain incomplete. No downloads, pushes
or publication occurred.

### Profile 0.365 verification (2026-10-19)

Sequence, sorting and formatting generics now select their default methods through shared lazy
argument binding. Original actuals, method defaults, dispatch order, visibility and internal call
metadata are retained. Observable signatures add seq.default, sort.default, sort.int and
format.default. Sequence endpoints, lengths and storage types; sorted attributes and filtered
indices; complex ordering; and input-dependent formatting controls have owned parity evidence.
Recursive comparison also verifies factor attribute order and the chkDotsWarning subclass.

Forty-seven independently authored parity cases pass under GNU R 4.6.1 and NativR. Two allocation
tests reject oversized sequences and string padding before materialization. Seven foundation groups
and five recursive cases add value, attribute, warning, call and visibility evidence. Sequence
callables retain numeric status; the new exact cases do not imply full numerical closure. Existing
sequence/format assertions were updated for the closed along.with combination and the documented
diagnostic mappings NRE2160 and NRE2130.

The full check, including the new corpus checkpoint integrity case, passes 1542 tests with 93 opt-in
skips. Checked-in/live/recursive conformance passes 1257 / 1188 / 153 cases, with 95 linked
behavioral bindings. Fixed budgets pass: client 17.5/150 KiB gzip, Worker 472.6/512 KiB gzip, parser
671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. Name overlap is 749/2,522 and is not a
completion percentage. The first sandboxed live run failed only the native file.access permission
fixture; the complete live gate was rerun with ordinary filesystem permissions. No expectation was
weakened for it.

All 24 cached development/regression archives were digest-checked and rerun with applicable oracle
repeatability in the
[0.365 checkpoint](../compatibility/package-check-evidence/corpus-0.365.0.json). Stage outcomes,
comparison-match counts and tiers are unchanged from 0.364. Formula is untouched. Original package
entrypoints were used; substitute-runner execution receives no P6/P7 credit. No Worker/playground or
packaging interface changed, so e2e and pack smoke were not refreshed. Linux, the browser/OS matrix,
all thirteen domains and full compatibility remain incomplete. No downloads, pushes or publication
occurred.

### Profile 0.364 verification (2026-10-19)

Partial argument warnings now run synchronously with matching decisions through an awaited shared
matcher. The option has strict logical validation and defaults to FALSE. Conditions retain the R
4.6.1 partialMatchWarning class, argument/formal symbols and call metadata. Handlers can disable
later warnings; muffling precedes warn=2 promotion. Builtin S3 dispatch propagates method calls.
match.call emits its observed second matching pass and internal diagnostic call.

Twenty-seven independently authored parity cases pass directly under GNU R 4.6.1 and NativR.
Additional regressions cover default silence, wire warning records, immediate output order,
cancellation and bounded diagnostic traversal. The full check, including the new corpus checkpoint
integrity case, passes 1492 tests with 93 opt-in skips. Checked-in/live/recursive conformance passes
1250 / 1181 / 148 cases, with 91 linked behavioral bindings. Promotion uses the foundation oracle's
no-outer-handler mode; recursive observations cover conditions and muffling. Fixed budgets pass:
client 17.5/150 KiB gzip, Worker 469.4/512 KiB gzip, parser 671.9/1,536 KiB raw and elementary
311.2/384 KiB raw.

All 24 cached development/regression pins were rechecked with applicable oracle repeatability in the
[0.364 checkpoint](../compatibility/package-check-evidence/corpus-0.364.0.json). Formula remains
untouched. Original package entrypoints were used; no substitute runner received P6/P7 credit. Stage
outcomes, comparison-match counts and tiers are unchanged from profile 0.363. No Worker/playground
or packaging interface changed, so e2e and pack smoke were not refreshed. Linux, browser/OS
validation, all thirteen domains and full compatibility remain incomplete. No downloads, pushes or
publication occurred.

### Profile 0.363 verification (2026-10-19)

One bounded matcher now serves closures, named builtin matching and match.call reconstruction. This
increment corrects formal-order duplicate/ambiguity diagnostics, exact-before-partial matching,
unused expression rendering, explicit missing defaults, forwarded default missingness, missing
argument names and condition calls. person accepts empty slots using its NULL defaults. The sqrt/abs
primitive path preserves eager actual-order evaluation before arity/name validation.

Forty-seven owned behavioral regressions pass in NativR and directly under GNU R 4.6.1; a separate
resource-limit regression covers cancellation and bounded matching. The full check passes 1458 tests
with 93 opt-in skips. The subsequently added 0.363 checkpoint integrity test also passes.
Checked-in/live/recursive conformance passes 1,245 / 1,176 / 143 cases, with 88 linked behavioral
bindings. The primitive observations do not promote sqrt/abs from numeric to behavioral evidence.
Fixed budgets pass: client 17.5/150 KiB gzip, Worker 468.8/512 KiB gzip, parser 671.9/1,536 KiB raw
and elementary 311.2/384 KiB raw.

All 24 pinned cached development/regression archives were rechecked, with applicable oracle
repeatability recorded in the
[0.363 checkpoint](../compatibility/package-check-evidence/corpus-0.363.0.json). Metadata/dependency
checks now pass for generics, withr, assertthat and evaluate. Package tiers and comparison match
counts are unchanged. Formula remains untouched. Original package entrypoints were used; no
substitute runner received P6/P7 credit. No Worker/playground or packaging interface changed, so e2e
and pack smoke were not refreshed. Linux and the complete browser/OS matrix remain open. No
downloads, pushes or publication occurred.

### Profile 0.362 missing factor levels and addNA

Factors now preserve the NA level mask separately from missing integer codes. addNA handles
conditional/no-op paths, unused and ordered levels, names and reconstruction attributes. Observed
factor/ordered defaults and is.ordered are available. Label coercion, grouping, matching, table,
replacement and selected model/set/combination operations use the separate representations. Thirty
regression tests cover the increment, including execution limits; 26 retained behavior assertions
also pass directly under the GNU R 4.6.1 black-box oracle. Foundation and recursive evidence retain
values, masks, attributes and causal controls.

The full check passes 1,410 tests with 93 opt-in skips. Checked-in/live/recursive conformance passes
1,241 / 1,172 / 139 cases, with 87 linked bindings. Fixed budgets pass: client 17.5/150 KiB gzip,
Worker 468.6/512 KiB gzip, parser 671.9/1,536 KiB raw and elementary 311.2/384 KiB raw. No
Worker/playground or packaging interface changed; e2e and pack smoke were not refreshed.

All 24 pinned cached development/regression archives have repeatability observations in the
[0.362 checkpoint](../compatibility/package-check-evidence/corpus-0.362.0.json). Formula remains
untouched. No substituted dependency closure or testing runner received P6/P7 credit. No downloads,
push or publication occurred. Linux and full browser/OS validation remain open.

### Profile 0.361 factor printing

The registered print.factor method now renders levels, ordered separators, missing labels, empty
values, names, dimensions and incidental attributes, with explicit quote controls and invisible
returns. Owned probes establish width/limit boundaries and output before invalid summary controls.
Ten regression tests include resource limits; foundation and recursive cases retain values and
metadata with causal controls. NA-level construction/coercion and addNA remain next.

All 24 pinned cached development/regression archives were rechecked with repeatability observations.
Tiers and partitions are unchanged; pkgconfig and abind retain P7. The full check passes 1,379 tests
with 93 opt-in skips; checked-in/live/recursive conformance passes 1,238 / 1,169 / 136 cases. All
fixed bundle limits pass. No Worker/playground or packaging interface changed, so e2e and pack smoke
were not refreshed. This increment closes sampled factor-display gaps; all-domain closure and
platform/release verification remain incomplete.

### Profile 0.360 method and static metadata follow-up

Documentation policy v5 preserves S4 generic/class identities and resolves native method formals
through public reflection APIs. Missing NativR reflection remains unexecuted. Static comparisons
normalize observed literal storage and parsed-call structure without evaluating defaults; NaN and
Inf remain distinct. Isolated native fixtures corrected the prior treatment of internal-page alias
and extra-argument notes: they pass and remain recorded, while syntax warnings and codoc failures
still fail.

The [seven-package recheck](../compatibility/package-check-evidence/corpus-0.360.0.json) refreshes
pkgconfig, abind, inline, withr, evaluate, rprojroot and whisker from their pinned cached archives,
with repeatability observations. The full 24-package checkpoint remains at 0.359. Tiers and
partitions are unchanged. Inline now passes its usage checks; two ordinary signatures still differ,
and five method signatures remain unexecuted because NativR reflection is unavailable. Namespace
exports still differ. withr retains 14 actual signature mismatches and one inconclusive comparison.

The full check passes 1,368 tests with 93 opt-in skips. Checked-in/live/recursive conformance passes
1,236 / 1,167 / 134 cases; all fixed bundle budgets pass. No evaluator, Worker/playground or
packaging interface changed, so e2e and pack smoke were not refreshed. The next ordered semantic
work is factor printing/addNA, followed by argument matching. S4 runtime gaps, broader Rd closure
and all-domain/platform completion remain open.

### Profile 0.359 Rd boundary repairs

Documentation policy v4 retains syntax, alias, extra-argument and signature checks on internal pages
while allowing omitted argument descriptions. Qualified links resolve through aliases or Rd
filenames in the named package. The help catalog records 8,612 aliases and 2,635 public filenames;
alias sets are unchanged. Manual adaptation v2 handles verbatim contexts without globally accepting
unknown macros. Independent native fixtures include negative controls and literal-byte observations.

All 24 cached reports were refreshed with repeatability observations and unchanged pins/partitions.
evaluate, rprojroot and whisker now pass documentation; crayon and viridisLite now pass the manual
stage. Otel's corrected link leaves documentation unexecuted because other package catalogs are
unavailable. withr retains actual signature mismatches. Package tiers are unchanged; pkgconfig and
abind retain P7. S4 method identity/signature checking and static-only codoc comparison were left
for the 0.360 follow-up. The profile's stale planned label for elementary Wasm adoption is fixed;
normative Linux validation remains pending.

Verification: the full check passes 1,346 tests with 90 opt-in skips; checked-in/live/recursive
conformance passes 1,236 / 1,167 / 134 cases. All fixed bundle budgets pass. No Worker/playground or
packaging interface changed; e2e and pack smoke were not refreshed. This is a verified checker
increment; all 13 semantic domains and the broader roadmap still need closure.

### Profile 0.358 loaded metadata follow-up

Documentation policy v3 compares loaded namespace exports and public usage signatures in both
runtimes. The 23-comparison owned fixture covers computed definitions, imports, zero arguments, lazy
defaults, exact numeric values with storage equivalence, missing values and syntax differences.
Unknown signatures, active bindings and unsupported syntax remain unexecuted. A zero-argument
formals reflection defect found by the new conformance case is fixed.

All 24 cached non-holdout checks produced reports. Tiers and partitions are unchanged. Export
inventories agree for 23 packages; inline exposes 13 names versus 24 in native R. withr has 14
actual signature mismatches and one inconclusive comparison. Computed signatures in evaluate,
rprojroot and whisker now agree; separate usage checks still fail. prettyunits and rstudioapi pass
documentation, while other package stages remain blocked. Only bounded metadata, counts and digests
are committed; observed defaults and implementation bodies are not recorded.

At that checkpoint, Milestone 2 still included Rd usage, links and context-sensitive macros. The
remaining semantic domains, dataset provenance, separate testing runner and release platform gates
still need completion. No Worker/playground or packaging interface changed in this increment;
browser e2e and pack smoke were not refreshed.

### Profile 0.357 checker follow-up

Description policy v5 accepts the observed dependency-spacing boundary. Example dependency scans
exclude dontrun and retain donttest. Documentation policy v2 keeps static unknown definitions
unexecuted and gives repeated usage entries distinct IDs. Owned unit and native fixtures cover all
four repairs.

The [nine-package recheck](../compatibility/package-check-evidence/corpus-0.357.0.json) contains a
complete report for every affected package. inline no longer aborts; its examples remain blocked.
prettyunits and rstudioapi clear their metadata failures and stop at documentation. pkgconfig and
abind still pass all specified stages. Tiers and partitions are unchanged from 0.356.

Verification: 1,235 checked-in cases, 1,166 live GNU R cases, 133 recursive cases and two focused
native fixtures pass. The final full check passed 1,309 tests with 87 opt-in skips, including the
additional checkpoint validation case; all bundle budgets pass. Browser/OS, package test-runner,
dataset and domain-closure work remains open.

### numDeriv output differences

Run with the explicit RNG prologue and `--oracle-repeat` (`--rng-seed 20261016`):

| Input                | Result  | Classification                                                                              |
| -------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `tests/oneSided.R`   | match   |                                                                                             |
| `tests/grad01.R`     | match   | Fixed in 0.351: `require()` now emits GNU R's startup message                               |
| `man/genD.Rd`        | match   |                                                                                             |
| `man/grad.Rd`        | match   | Fixed in 0.355: complex functions use the session math (complex-step derivatives)           |
| `man/hessian.Rd`     | match   | Fixed in 0.355: same cause                                                                  |
| `tests/BWeg.R`       | differs | GNU R output is not repeatable, and `Sys.info()` uses the documented browser adaptation     |
| `tests/CSD.R`        | differs | GNU R output is not repeatable (`system.time()`); numeric output now matches                |
| `tests/hessian01.R`  | differs | Oracle libm: GNU R `sin`/`cos` near pi and 2*pi not correctly rounded (14 of 150 probes)    |
| `tests/jacobian01.R` | differs | Oracle libm: same class                                                                     |
| `tests/trig01.R`     | differs | Oracle libm: GNU R `asin` not correctly rounded at 8 of 24 probed points                    |
| `man/jacobian.Rd`    | differs | Oracle libm: `sin(2*pi)` residual (2.4492127e-16 against a correctly rounded 2.4492936e-16) |

Each deterministic difference is traced to a function, checked against an independent 90-digit
decimal reference (`compatibility/package-check-evidence/numDeriv-libm-trace-0.355.0.json`). NativR
is correctly rounded at every probed point. Discharging these needs the RFC-0007 libm deviation rule
and the normative Linux oracle (step 5) before numDeriv's output stage can pass. No output is
normalized.

## Defects confirmed and fixed in this pass

| Severity | Defect                                                                                                    | Fix (profile)                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| High     | Builtin and operator warnings never reached `tryCatch`, suppression, or calling handlers                  | Deferred warnings are signalled through the handler stack (0.351)                                       |
| High     | `suppressWarnings`/`suppressMessages` hid conditions from inner handlers and ignored class filters        | Class-filtered muffling frames; visibility kept (0.351)                                                 |
| High     | Double-to-character coercion used JavaScript's shortest round-trip string (`paste(0.1 + 0.2)`)            | 15-significant-digit coercion (0.352)                                                                   |
| High     | `qnorm`, `pnorm` and seeded `rnorm` were not bit-compatible (Acklam approximation, incomplete-gamma tail) | AS 241 and Cody from the published papers (0.352)                                                       |
| Medium   | `sprintf` lacked `%e`/`%E`/`%G`/`#`, wrote one-digit exponents, and rounded ties away from zero           | Exact C99 floating conversions (0.352)                                                                  |
| Medium   | `require()` emitted no startup message; no `packageStartupMessage`/`suppressPackageStartupMessages`       | Implemented (0.351)                                                                                     |
| Medium   | Common warning texts differed from GNU R (`NaNs produced.`)                                               | Five texts aligned (0.351)                                                                              |
| Medium   | Package-check compared unseeded RNG scripts, so oracle output was not reproducible                        | Explicit RNG prologue and `--oracle-repeat` (harness)                                                   |
| Medium   | A single capture from a non-repeatable oracle could pass or fail the output stage                         | `repeatable` oracle observations; such comparisons are `unexecuted` with code `oracle-nondeterministic` |
| Low      | Oracle harnesses parsed child output on `exit`, before the pipes drained, and dropped exit status/signal  | Use `close` and report status/signal (harness)                                                          |
| Low      | Conformance case `apply-conversion-and-lazy-dots` depended on top-level vs isolated evaluation            | Method assigned in `globalenv()`; case now passes on both sides                                         |

## Prioritized backlog

Each item names its acceptance criterion and the evidence it requires.

**R1 (P0, decided 2026-10-17): platform numeric policy.** NativR will own a correctly rounded
binary64 elementary-function library, planned as a pinned, Wasm-compiled CORE-MATH module. The
normative oracle platform is now x86_64 Linux with glibc, and Windows UCRT is advisory. See
[RFC-0007](rfcs/0007-correctly-rounded-elementary-functions.md) for the five-step plan, each step
with its acceptance criterion, and the verified libm deviation rule. Until step 5, the evidence in
this page, which was produced on Windows, is advisory for numeric last-place results.

**R3 (P0): real bundle budget. Done for milestone A.** The Worker budget is a fixed 512 KiB gzip,
which changes only through a recorded decision. The original criterion also asked for on-demand
loading of rarely used builtins. That part moves to milestone B: the Worker ships as one prebuilt
asset, and chunks it imported at runtime would not be copied by a consuming application's bundler.
It needs a packaging design that `pnpm pack:smoke` can verify for bundled consumers.

**R4 (P0, abind P7): `metadata-dependencies` stage. Done (RFC-0008).** Source-reference policy v2
follows native R CMD check scope on independently authored fixtures, with an opt-in parity test. A
base dependency-closure check is added. The stage passes for abind with 55 of 55 checks executed.

**R5 (P0, P7): output-order capture. Done (harness, profile 0.352).** Each oracle script also runs
in a second fresh session whose stdout and stderr share one file handle. The merged bytes are
aligned with the separate exact streams, and an order is accepted only when exactly one stream
assignment reproduces them. Ambiguous or inconsistent captures leave the stage `unexecuted`. Native
fixtures in `packages/package-tools/test/output-order-oracle.test.ts` cover partial lines, large
output, ambiguity, failed runs and the CRLF transport reversal.
`pnpm package:check --package abind --oracle-repeat` reports `output-order` **passed** with all ten
scripts executed. See
[the evidence README](../compatibility/package-check-evidence/README.md#cross-stream-output-order).

**R6 (P1): remaining package-check stages. Done for abind (RFC-0008).** installation-loading,
namespace-source, documentation and the manual adaptation each have an independent specification, a
package-tools implementation, native fixture parity tests and reasoned outcomes. abind reaches P7.
Still open: non-ASCII code without a declared encoding, INDEX files, `\Sexpr`, links into non-core
packages, and vignettes (inapplicable for abind).

**R14 (P2): slow WebKit e2e run.** On this Windows machine, WebKit takes 1.3-2.1 min for the
"required Worker examples" test and can exceed its 120 s timeout; Chromium and Firefox take under 30
s. _Acceptance:_ profile the WebKit run and fix the cause, or document an engine-specific budget
with evidence. Do not raise the timeout without that analysis.

**R7 (P1): `withCallingHandlers`, restarts, `options(warn)`. Done (profile 0.353).** Covered by
foundation and recursive cases. An independent black-box probe of muffle restarts, handler
escalation, `withRestarts`/`computeRestarts`, `options(warn = 2)` and nesting with suppression
matched GNU R 4.6.1.

**R8 (P1): reviewer findings to verify.** Each needs a reproduction against GNU R first:
`unloadNamespace` detaches before rejecting imported namespaces; `maxPackageResourceBytes` overrides
are not validated; `detach()` of a core package loads it; `file.access` tests the "other" permission
bits; invalid-UTF-8 byte-escaped strings compare equal. A claimed `[[Inf]]` defect was checked and
is not a defect (GNU R also returns `NULL`).

**R9 (P1): reusable formatting gaps.** `dnorm`; formatC's remaining optional controls,
locale/display widths and high-precision oracle discrepancies; `sprintf` `%a`/`*`/positional
arguments, early recursive list/language text allocation and GNU R's error for unknown directives;
the `str()` label for unnamed list elements (`$ :`); and 15th-digit ties in character coercion.
_Acceptance:_ independent foundation/recursive cases, resource recovery and separately authorized
normative numerical gates.

**R10 (P2): condition call attribution.** Coercion warnings report the builtin call where GNU R
reports the enclosing closure call. _Acceptance:_ cases for direct, nested, and apply-driven
coercions.

**R11 (P2): reproducible CI evidence.** The scheduled conformance workflow runs native conformance
and selected unchanged-package external tests on Ubuntu. It does not run comprehensive
`pnpm package:check` for abind/numDeriv or retain their redacted stage summaries. Browser CI runs
all three engines on Ubuntu but lacks a redacted success checkpoint and repeated performance report.
Main CI configuration now invokes the canonical `pnpm check` plus its existing coverage gate and
packed-consumer smoke; this configuration has not been pushed or run remotely. The maintained
`pnpm evidence:packages` command now verifies cached pins, observation inventories, original-runner
identity, RNG/repeatability settings and stable artifacts, and retains only redacted summaries. Its
[local 0.388 checkpoint](../compatibility/platform-evidence/offline-packages-windows-0.388.0/index.json)
preserves all 21 abind/numDeriv observations and stage results from the accepted baseline: abind has
ten matches; numDeriv retains six mismatches and two nonrepeatable observations. All 62 tooling
tests and the full canonical check pass. _Remaining acceptance:_ integrate the safe artifact
contract into separately authorized CI execution and complete browser checkpoint retention.
Normative evidence still requires RFC-0007's pinned Linux/glibc gate.

**R12 (P2): re-verify recorded corpus blockers** with the external suite, and evaluate the holdout
only at a release gate.

**R13 (P3): oracle discovery closed locally (2026-10-22).** Both native conformance runners and
package checking now share explicit CLI/environment precedence, PATH discovery and Windows
per-user/system discovery. Invalid overrides fail without fallback; optional absence remains an
explicit skip only for conformance. Existing exact-version gates remain intact. All 41 discovery and
CLI checks pass, including wrong-engine rejection, and a live metadata-only check finds the
installed per-user oracle with PATH empty. The full check passes 3,044 unit tests with 94 opt-in
skips, both typechecks, build and fixed bundle caps. [Development instructions](development.md)
document GNU R 4.6.1 selection and skip meaning. This development-tooling change retains profile
0.388 and adds no new native semantic or platform evidence. GNU R remains optional for ordinary
development and is never a runtime dependency.

## Next steps

1. Continue verified local development against all five completion criteria: close reusable semantic
   gaps, retain native/recursive causal evidence and pinned corpus checks, add independent datasets
   and isolated testing support, and commit verified increments locally.
2. Maintain offline package/browser evidence tooling, align CI configuration with canonical checks,
   and refresh startup, interruption/recovery and fixed numDeriv measurements on a stable build.
   Preserve bundle limits and distinguish observed timings from performance acceptance.
3. After separate authorization, execute RFC-0007's normative gate with pinned `ubuntu-24.04`, GNU R
   4.6.1 and recorded glibc; rerun conformance/corpus evidence and independently verify numerical
   deviations. Complete the declared browser/OS matrix. Formula remains untouched until its
   separately authorized holdout gate.
4. New downloads, remote workflow runs, pushes and publication require their separate approvals.
   Follow [releasing.md](releasing.md) when publication is authorized.

Estimates are uncertain. Each package-check stage has needed several increments in the past, and
RFC-0007 step 5 reruns all oracle evidence on a new platform.
