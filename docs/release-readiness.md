# Release readiness

Last assessed 2026-10-21 at verified semantic profile **0.371.0**. Canonical counts are generated in
[compatibility/status.json](../compatibility/status.json). The full compatibility target remains the
five completion criteria in [gnu-r-compatibility.md](gnu-r-compatibility.md).

## A. Limited developer preview

The supported scope is the Worker-first browser API and executable subset in
[compatibility-contract.md](compatibility-contract.md). Runtime code remains browser-first, ESM,
CSP-safe and network-free; host access requires explicit capabilities. No general package or GNU R
compatibility claim follows from this preview.

| Gate                               | Latest evidence                                                                                                                                      | Status                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Production check                   | Profile 0.371: 1,771 unit tests pass, 93 opt-in tests skipped; build, boundaries, production types and bundle audit pass                             | Passed                    |
| Conformance                        | 1,287 checked-in, 1,218 live GNU R 4.6.1, 195 recursive cases; 109 bindings linked with causal controls                                              | Passed                    |
| Native metadata/signature fixtures | 71 owned Rd/S4 tests pass at 0.360, including native severity, signature and method fixtures                                                         | Passed                    |
| Browser e2e                        | Historical 6/6 pass reported at 0.353; WebKit also exceeded the 120 s required-example budget in later runs (R14). Not refreshed in these increments | Open                      |
| Packed consumer                    | Historical pack smoke pass; not refreshed in these increments                                                                                        | Revalidate before release |
| Fixed bundle limits                | Client 17.6/150 KiB gzip; Worker 477.0/512 KiB gzip; parser 671.9/1,536 KiB raw; elementary module 311.2/384 KiB raw                                 | Passed                    |
| CI and publication                 | Local work only; no pushed CI result for this increment; publication/bootstrap remains a maintainer action                                           | Open                      |

**Readiness:** release verification is incomplete. Browser timing, the declared OS matrix, CI and
release packaging need current evidence. The approved roadmap does not authorize push or
publication.

## B. Full browser-admissible GNU R 4.6.1 compatibility

| Criterion                                        | Current evidence                                                                                                                                                                                                                                   | Status                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Domain evidence                                  | All **13** required domains remain incomplete; behavioral matrices need closure                                                                                                                                                                    | Not met                 |
| Callable evidence/exclusions                     | 752/2,522 distinct names overlap; 109 bindings have specific recursive links. Name overlap is inventory, not a completion percentage                                                                                                               | Not met                 |
| Broad corpus evidence                            | 25 pins: 2 P7, 1 P6, 8 P5, 12 P4, 1 P3 and the unevaluated P0 holdout. Higher-tier blockers are explicit                                                                                                                                           | Not met                 |
| Platform verification                            | Correctly rounded elementary Wasm is shipped and used in sessions, including complex functions since 0.355. Windows oracle evidence remains advisory pending the separately authorized RFC-0007 Linux gate; browser/OS coverage remains incomplete | Not met                 |
| Agreement among ledger, capabilities and reports | Generated checks and this checkpoint agree. Future changes must regenerate capabilities, coverage and status in order                                                                                                                              | Met for this checkpoint |

There is no defensible completion date or percentage yet. Finishing requires semantic-domain
closure, broad package evidence and platform verification. See the maintained
[development continuation](development-continuation.md) for the ordered implementation queue.

## Verification environment

Node 24.19.0, pnpm 11.17.0 and GNU R 4.6.1 on Windows x64, with C locale settings. Existing compiler
and Wasm caches were reused. Unit-test temporary files were moved outside Dropbox after EBUSY
cleanup failures. Native oracle runs used ordinary Windows permissions because sandbox ACL checks
made GNU R file.access reject readable fixtures. These are harness constraints, not accepted
deviations.

No Worker/protocol/playground or packaging interface changed in stabilization. E2e and pack smoke
were not rerun for that increment. A supplemental all-test TypeScript check found existing fixture
typing errors; the required production typecheck passes. That broader check needs cleanup before
being adopted as a release gate.

## Cached package checkpoint

All 24 development/regression archives matched their pinned hashes and were attempted with the
original package entrypoints, explicit RNG initialization and native repeatability observations. The
[checkpoint](../compatibility/package-check-evidence/corpus-0.371.0.json) links all 24 redacted
reports with no checker aborts. Summaries contain allowlisted metadata, digests, capture statuses
and counts; source, output and diagnostic strings are omitted. Formula was untouched.

| Package group                                                                                                      | Highest demonstrated tier | First remaining work                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| pkgconfig 2.0.3; abind 1.4-8                                                                                       | P7                        | All specified stages pass or are inapplicable on this host; full platform gates remain separate |
| numDeriv 2016.8-1.1                                                                                                | P6                        | Output comparison: 5 matches, 6 differences; deferred numerical/platform verification           |
| generics; R6; labeling; praise; rprojroot; rstudioapi; rematch; ini                                                | P5                        | Tests unavailable, failed or not demonstrated; see each pinned entry                            |
| withr; viridisLite; RColorBrewer; assertthat; crayon; prettyunits; evaluate; inline; whisker; zeallot; cpp11; otel | P4                        | Applicable examples or evidence collection remains blocked                                      |
| BH 1.90.0-1                                                                                                        | P3                        | Representative workload/native build evidence unavailable; no oracle script observations        |
| Formula 1.2-6                                                                                                      | P0                        | Holdout gate has not been authorized                                                            |

The inline checker abort from 0.356 was repaired at 0.357. Its current report is complete;
applicable examples remain blocked, so it retains P4. A dispatch result of completed does not prove
evaluation success: tiers use reconciled capture/stage results. In particular rematch receives no P6
credit merely because a guarded test entrypoint completes while testthat is unavailable and nested
tests are unverified. No substitute testing runner was used.

## Verification details and remaining defects

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

**R9 (P1): reusable formatting gaps.** `dnorm`, `formatC`, `sprintf` `%a`/`*`/positional arguments,
GNU R's error for unknown directives, the `str()` label for unnamed list elements (`$ :`), and
15th-digit ties in character coercion. _Acceptance:_ foundation cases from GNU R observations.

**R10 (P2): condition call attribution.** Coercion warnings report the builtin call where GNU R
reports the enclosing closure call. _Acceptance:_ cases for direct, nested, and apply-driven
coercions.

**R11 (P2): CI coverage.** `pnpm package:check` is not run in any workflow, and the native jobs run
only on Ubuntu. _Acceptance:_ a scheduled job runs the abind and numDeriv checks with the RNG policy
and uploads the redacted summaries. The oracle platform follows the R1 decision.

**R12 (P2): re-verify recorded corpus blockers** with the external suite, and evaluate the holdout
only at a release gate.

**R13 (P3): toolchain discovery.** `findRscript()` searches only `Program Files\R`, not per-user
installs. `docs/development.md` should state that a pinned Node 24 and GNU R 4.6.1 are required for
the full gates.

## Next steps

1. With the maintainer's authorization: push to `origin`, let CI pass on Ubuntu, and carry out the
   publication bootstrap in [releasing.md](releasing.md) (A7).
2. Milestone B, in order: RFC-0007 adoption (the module now ships as a verified asset), then the
   Linux oracle switch (pin `ubuntu-24.04`, rerun the evidence); then numDeriv toward P7 using the
   RFC-0008 stages; then callable closure (Phase 3 of the plan).

Estimates are uncertain. Each package-check stage has needed several increments in the past, and
RFC-0007 step 5 reruns all oracle evidence on a new platform.
