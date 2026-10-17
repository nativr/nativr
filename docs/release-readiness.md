# Release readiness

This page records the release milestones, the verification behind each claim, and the prioritized
backlog. It was last assessed on 2026-10-17 at semantic profile **0.353.0**, with the uncommitted
working tree on top of commit `9b91c3f`. Canonical counts are generated into
[`compatibility/status.json`](../compatibility/status.json); this page explains them and does not
replace them.

## Milestones

### A. Limited developer release

An explicitly scoped developer preview of `@nativr/nativr` for embedding a sandboxed R subset in a
browser Worker. It makes no claim of general GNU R or package compatibility.

**Supported workloads**

- Evaluating R source inside a dedicated Worker (or inline) through the public API in
  [public-api.md](public-api.md), with cancellation, reset, disposal, finite resource limits, and no
  ambient network or host access.
- The executable language subset in [compatibility-contract.md](compatibility-contract.md): vectors
  and attributes, closures and promises, environments, S3 dispatch, `tryCatch`,
  `withCallingHandlers`, restarts, `options(warn = )` and the `suppress*` family, the registered
  `base`/`stats`/`utils`/`methods`/`graphics`/`grDevices` bindings listed in the capability
  manifest, and the documented data-frame, factor, apply-family and formatting surface.
- Deterministic random streams for `set.seed()` with the default Mersenne-Twister, Inversion and
  Rejection kinds. `runif` and `sample` are bit-identical to GNU R 4.6.1. Seeded `rnorm` is
  bit-identical for 2993 of 3000 sampled draws and otherwise within about 2 ulp.
- Loading unchanged pure-R source packages packed at build time by `@nativr/package-tools`, for the
  corpus packages at tier P4 or above and their declared representative functions.

**Documented limitations (non-exhaustive)**

- 742 of 2,522 GNU R 4.6.1 core callable names are registered. Name overlap is inventory, not
  behavior.
- No `dnorm`, `formatC`, or `sprintf("%a")`. Unknown `sprintf` directives pass through unchanged
  instead of raising GNU R's error.
- Elementary transcendental functions use the browser's `Math` implementations. These differ from
  the Windows GNU R oracle in the last place on 5-10% of sampled inputs, and ECMAScript lets
  browsers differ from each other.
- No package reaches P7. No native code, installed lazy-load databases, R CMD check equivalence, or
  arbitrary-package compatibility.
- Host processes, files, sockets, and devices are available only through explicit adapters and
  otherwise fail closed (see [security-model.md](security-model.md)).

**Acceptance criteria and status**

| ID  | Criterion                                                                 | Status                                                                                                   |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A1  | `pnpm check` passes on the pinned toolchain                               | Passed at 0.353: 1,269 tests, 82 opt-in skipped                                                          |
| A2  | Checked-in, live GNU R 4.6.1 and recursive Oracle v2 conformance all pass | Passed: 1,225/1,225, 1,155/1,155 and 127/127                                                             |
| A3  | Worker/playground e2e passes in Chromium, Firefox and WebKit              | Passed at 0.353 on Windows 11 (6/6). CI targets Ubuntu and has not run (no remote exists)                |
| A4  | Packed consumer, exports, declarations and parser/Wasm assets verified    | `pnpm pack:smoke` passed                                                                                 |
| A5  | Supported scope and limitations published                                 | This page plus the contract                                                                              |
| A6  | Bundle budgets are real limits                                            | Passed: the Worker budget is a fixed 512 KiB gzip (464.2 KiB used) and is no longer raised per increment |
| A7  | Publication bootstrap (npm organization, trusted publisher)               | **Blocked on the maintainer**: needs a GitHub remote and npm account actions                             |
| A8  | Release notes and a changeset for 0.1.x                                   | Passed: `.changeset/steady-owls-preview.md`                                                              |

**Readiness:** every code-level criterion (A1 to A6, A8) is met on the combined uncommitted tree.
Two steps remain, and both need the maintainer's explicit authorization: committing the work, and
the publication bootstrap (A7: a GitHub remote, the npm organization and the trusted publisher, then
the first release). CI on Ubuntu then needs to pass once before the release is cut.

### B. Full browser-admissible GNU R 4.6.1 compatibility

The repository's completion criteria are defined in
[gnu-r-compatibility.md](gnu-r-compatibility.md#completion-evidence). They are not reduced here.

| Criterion                                                          | Current evidence                                                                                                                                                                                                         | Status         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| 1. Executable differential suite for every required domain         | All twelve ledger domains have partial suites; every domain is still marked incomplete                                                                                                                                   | Not met        |
| 2. Every inventoried callable has evidence or a verified exclusion | 742 of 2,522 names registered; 77 bindings have recursive Oracle v2 case links; the other 1,780 names have no registered binding                                                                                         | Not met        |
| 3. Broad clean-room corpus including R CMD check scenarios         | 1,225 foundation and 127 recursive cases; 25 pinned packages; no P7 package; abind passes the test-output, output-order and conditions stages, while metadata, namespace, documentation and manual stages are unexecuted | Not met        |
| 4. Browsers, operating systems and tolerances verified             | Three engines on Windows here and Ubuntu in CI; macOS unverified; numeric policy decided (RFC-0007), library built and verified across engines, not yet adopted                                                          | Not met        |
| 5. Ledger, capabilities, public API and reports agree              | `capabilities:check`, `status:check` and `compatibility:check` pass; stale narrative counts fixed in this pass                                                                                                           | Met for checks |

**Readiness:** B is far from complete. As a rough, low-confidence estimate, closing criteria 1-3 is
a multi-year effort at the current increment rate: about 1,800 callables lack registration or
exclusion, and the package-check stages need new tooling. The estimate depends heavily on how many
callables can be excluded as browser-inapplicable, which has not been assessed.

## Verification record (2026-10-17)

Toolchain: Node 24.14.0 (official zip, SHA-256 verified), pnpm 11.17.0 (corepack), and GNU R 4.6.1
for Windows (CRAN installer, MD5 verified) as the black-box oracle, on Windows 11 x64.

| Command                                         | Baseline (profile 0.350)        | Combined tree (profile 0.353)                                     |
| ----------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| `pnpm check`                                    | Passed; 1,241 tests, 76 skipped | Passed; 1,269 tests, 82 skipped (note 1)                          |
| `pnpm conformance`                              | 1,200/1,200                     | 1,225/1,225                                                       |
| `pnpm conformance:r` (live GNU R 4.6.1)         | 1,129/1,130; one case failed    | 1,155/1,155                                                       |
| `pnpm conformance:r:v2`                         | 125/125, 69 linked bindings     | 127/127, 77 linked bindings                                       |
| `pnpm pack:smoke`                               | Passed                          | Passed                                                            |
| `pnpm test:e2e`                                 | Not run at baseline             | 6/6 (Chromium, Firefox, WebKit)                                   |
| `pnpm package:check --package abind`            | 10/10 comparisons match         | 10/10 match; test-output, output-order and conditions stages pass |
| `pnpm package:check --package numDeriv`         | 2 match, 9 differ (unseeded)    | 3 match, 8 differ (seeded)                                        |
| External corpus suite (`NATIVR_EXTERNAL_...=1`) | Not run in this pass            | Not run in this pass                                              |

1. The Worker budget is now a fixed 512 KiB gzip; see "Worker budget policy" in
   [performance.md](performance.md). The baseline live-oracle failure was a deterministic
   environment-sensitive case, not a transient error; see the fixed-defects table.

Skipped tests are the opt-in native-oracle fixtures and external package downloads; the default
suite does not run them. The holdout package (Formula 1.2-6) was not evaluated.

## Package tiers and first blockers

| Package             | Tier | First blocker                                                          |
| ------------------- | ---- | ---------------------------------------------------------------------- |
| abind 1.4-8         | P6   | P7 `metadata-dependencies` unexecuted; all 10 output comparisons match |
| numDeriv 2016.8-1.1 | P6   | P7 `metadata-dependencies` unexecuted; output comparisons below        |
| R6 2.6.1            | P5   | P6 `tests/testthat.R` needs testthat                                   |
| rprojroot 2.1.1     | P5   | P6 `tests/testthat.R` needs testthat                                   |
| labeling 0.4.3      | P5   | Recorded as passing at P5; no recorded blocker                         |
| assertthat 0.2.1    | P4   | P5 `man/not_empty.Rd` example error                                    |
| BH 1.90.0-1         | P3   | Recorded as passing at P3 (header-only package)                        |
| 17 further packages | P4   | Recorded as passing at P4 (see `compatibility/package-corpus.json`)    |
| Formula 1.2-6       | P0   | Holdout; deliberately unevaluated                                      |

Only the abind and numDeriv blockers were re-verified in this pass. The others are the recorded
values; re-verifying them needs the opt-in external corpus suite, which downloads every pinned
archive.

### numDeriv output differences

Run with the explicit RNG prologue and `--oracle-repeat` (`--rng-seed 20261016`):

| Input                | Result  | Classification                                                                                |
| -------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `tests/oneSided.R`   | match   |                                                                                               |
| `tests/grad01.R`     | match   | Fixed in 0.351: `require()` now emits GNU R's startup message                                 |
| `man/genD.Rd`        | match   |                                                                                               |
| `tests/BWeg.R`       | differs | GNU R output is not repeatable, and `Sys.info()` uses the documented browser adaptation       |
| `tests/CSD.R`        | differs | GNU R output is not repeatable (`system.time()`); a last-place numeric difference comes first |
| `tests/hessian01.R`  | differs | Deterministic. Last-place numeric differences amplified by finite differencing                |
| `tests/jacobian01.R` | differs | Deterministic. Same class                                                                     |
| `tests/trig01.R`     | differs | Deterministic. One-ulp difference in the twelfth printed digit                                |
| `man/grad.Rd`        | differs | Deterministic once seeded. Same class                                                         |
| `man/hessian.Rd`     | differs | Deterministic once seeded. Was a 50x gap with unseeded input; now the same order of magnitude |
| `man/jacobian.Rd`    | differs | Deterministic. One-ulp difference in a ~1e-16 residual                                        |

The deterministic numeric differences are consistent with the measured libm deviations, but each one
has not yet been traced to a specific function. That tracing, and a decision on R1 below, must come
before numDeriv's output stage can pass. No output is normalized.

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

**R4 (P0, abind P7): `metadata-dependencies` stage.** Full DESCRIPTION validation, plus undeclared
and transitive dependency closure with explicit treatment of computed references. _Acceptance:_ the
stage reports `passed` for abind with a complete inventory, and fixture packages cover failures.

**R5 (P0, P7): output-order capture. Done (harness, profile 0.352).** Each oracle script also runs
in a second fresh session whose stdout and stderr share one file handle. The merged bytes are
aligned with the separate exact streams, and an order is accepted only when exactly one stream
assignment reproduces them. Ambiguous or inconsistent captures leave the stage `unexecuted`. Native
fixtures in `packages/package-tools/test/output-order-oracle.test.ts` cover partial lines, large
output, ambiguity, failed runs and the CRLF transport reversal.
`pnpm package:check --package abind --oracle-repeat` reports `output-order` **passed** with all ten
scripts executed. See
[the evidence README](../compatibility/package-check-evidence/README.md#cross-stream-output-order).

**R6 (P1): `namespace-source`, `documentation`, `installed-documentation`, `manual` and `vignettes`
stages.** _Acceptance:_ each stage has an independently written specification, a NativR
implementation in package-tools, fixture packages, and `passed`/`failed`/`inapplicable` outcomes
with reasons.

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

1. With the maintainer's authorization: commit the work, create the GitHub remote, let CI pass on
   Ubuntu, and carry out the publication bootstrap in [releasing.md](releasing.md) (A7).
2. Milestone B, in order: RFC-0007 steps 4-5 (adopt the correctly rounded library, pin
   `ubuntu-24.04`, rerun the evidence on Linux); then R4, the first blocker for abind's P7; then R6.

Estimates are uncertain. Each package-check stage has needed several increments in the past, and
RFC-0007 step 5 reruns all oracle evidence on a new platform.
