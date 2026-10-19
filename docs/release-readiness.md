# Release readiness

Last assessed 2026-10-19 at verified semantic profile **0.360.0**. Canonical counts are generated in
[compatibility/status.json](../compatibility/status.json). The full compatibility target remains the
five completion criteria in [gnu-r-compatibility.md](gnu-r-compatibility.md).

## A. Limited developer preview

The supported scope is the Worker-first browser API and executable subset in
[compatibility-contract.md](compatibility-contract.md). Runtime code remains browser-first, ESM,
CSP-safe and network-free; host access requires explicit capabilities. No general package or GNU R
compatibility claim follows from this preview.

| Gate                               | Latest evidence                                                                                                                                      | Status                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Production check                   | Profile 0.360: 1,368 unit tests pass, 93 opt-in tests skipped; build, boundaries, production types and bundle audit pass                             | Passed                    |
| Conformance                        | 1,236 checked-in, 1,167 live GNU R 4.6.1, 134 recursive cases; 81 bindings linked with causal controls                                               | Passed                    |
| Native metadata/signature fixtures | 71 owned Rd/S4 tests pass at 0.360, including native severity, signature and method fixtures                                                         | Passed                    |
| Browser e2e                        | Historical 6/6 pass reported at 0.353; WebKit also exceeded the 120 s required-example budget in later runs (R14). Not refreshed in these increments | Open                      |
| Packed consumer                    | Historical pack smoke pass; not refreshed in these increments                                                                                        | Revalidate before release |
| Fixed bundle limits                | Client 17.3/150 KiB gzip; Worker 466.4/512 KiB gzip; parser 671.9/1,536 KiB raw; elementary module 311.2/384 KiB raw                                 | Passed                    |
| CI and publication                 | Local work only; no pushed CI result for this increment; publication/bootstrap remains a maintainer action                                           | Open                      |

**Readiness:** release verification is incomplete. Browser timing, the declared OS matrix, CI and
release packaging need current evidence. The approved roadmap does not authorize push or
publication.

## B. Full browser-admissible GNU R 4.6.1 compatibility

| Criterion                                        | Current evidence                                                                                                                                                                                                                                   | Status                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Domain evidence                                  | All **13** required domains remain incomplete; behavioral matrices need closure                                                                                                                                                                    | Not met                 |
| Callable evidence/exclusions                     | 742/2,522 distinct names overlap; 81 bindings have specific recursive links. Name overlap is inventory, not a completion percentage                                                                                                                | Not met                 |
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
[checkpoint](../compatibility/package-check-evidence/corpus-0.359.0.json) links all 24 redacted
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
