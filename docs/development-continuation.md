# Development continuation

Approved 2026-10-19. The target remains all five completion criteria in
[gnu-r-compatibility.md](gnu-r-compatibility.md), including all thirteen semantic domains. This is
an execution queue, not a claim of completion. Canonical counts live in `compatibility/status.json`.

## Decisions

- Commit verified increments locally; never push, publish or alter remotes.
- Reuse the 24 digest-pinned development/regression archives. New downloads need approval.
- Leave the Formula holdout untouched until separately authorized.
- Linux oracle execution (RFC-0007 step 5) remains deferred and blocks normative completion.
- Source datasets independently, with license/provenance review and exact behavioral checks.
- Implement an isolated clean-room testing runner first. Report its identity and results separately:
  replacing testthat does not satisfy the original pinned dependency closure or automatically
  establish P6/P7. Contract changes require demonstrated equivalence and an explicit decision.
- Preserve the Worker-first API, clean-room policy, dependency direction, CSP/resource limits and
  existing bundle budgets. GNU R is an optional black-box oracle only.

## Ordered milestones

1. **Profile 0.356 stabilization:** complete optional-dependency policy v3, primitive-signature
   metadata, embedded call objects and non-dispatching factor coercion. Add independent native
   fixtures, foundation and recursive evidence; rebuild and pass the semantic gates.
2. **Corpus and checker evidence:** rerun the cached development/regression corpus; record tiers,
   first blockers, source/artifact/profile identities and redacted outcomes. Fix computed-function
   documentation checks, dependency versions, excluded example blocks, Rd usage, links and macros
   using owned fixtures. Inconclusive checks remain unexecuted.
3. **Reusable semantic closure:** factor printing and `addNA`; argument diagnostics; callable
   reflection; then the confirmed corpus blockers listed below. Each increment needs a named
   semantic-domain gap, independent oracle evidence and regressions.
4. **Datasets and testing support:** extend the generic immutable resource loader and an isolated
   testing runner. Unknown runner APIs remain explicit blockers, not skipped successes.
5. **Complete the ledger:** machine-check every callable's domain, evidence, remaining gaps or
   verified platform exclusion. Cover normal/boundary cases, errors, attributes, visibility, side
   effects and identity; extend recursive evidence with causal controls. Unsupported browser-
   meaningful behavior is unfinished work, not an exclusion.
6. **Platforms and readiness:** profile WebKit's slow required-example test without increasing its
   timeout; measure startup/cancellation/numDeriv; prepare reproducible CI and redacted evidence.
   Finish Linux and holdout gates only after authorization, then reconcile all readiness claims.

## Corpus findings to reproduce

These are leads from the previous sweep, not newly verified claims:

- Factor output: Levels line, ordered separators, max.levels, truncation, zero levels and NA.
- Argument matching: shared unused/duplicate/partial/missing diagnostics for closures and builtins.
- Reflection: formals, callable type and owned body/display behavior; do not copy GNU function
  bodies.
- Documentation: computed definitions need loaded-namespace metadata; static unknowns cannot fail
  merely because the checker cannot resolve them. Reported cases include evaluate `is.message`,
  rprojroot deprecated APIs, whisker `tag2delim`, withr `with_`, and otel/withr links.
- Metadata: prettyunits `R (>= 2.10)` and rstudioapi references inside dontrun need fixture parity.
- Manual rendering: crayon/viridisLite macros need documented or package-declared handling.
- Runtime: `units<-` on difftime, `is.infinite`, `sys.nframe`, `bindtextdomain`, `.sys.timezone`,
  crayon subsetting/`structure(.Data=)`, unlist of closures, evaluate parse-data row counts, pre-1.7
  RNGversion generators, and RColorBrewer plot `bty`.
- Dataset-dependent examples need mtcars, faithful, InsectSprays and other independently sourced
  resources; GNU R's distribution is not the source.
- numDeriv CSD performance and Windows libm differences need separate treatment. Recorded libm
  traces do not waive whole package outputs or replace the deferred normative Linux run.
- Release-readiness R8 findings still need reproductions: unloadNamespace import checks,
  maxPackageResourceBytes validation, core detach behavior, file.access permissions and invalid
  UTF-8.

## Verification and continuation record

Use Node 24 and pnpm 11.17.0. On this host GNU R 4.6.1 is installed per-user; use NATIVR_RSCRIPT.
Use LC_ALL/LC_CTYPE/LANG=C for reproducible Windows fixture runs. Never run build/typecheck while
another process consumes dist. Reuse existing artifacts; do not trigger implicit downloads.

For semantic increments: build serially; regenerate capabilities, name coverage, then status; run
`pnpm check`, `pnpm conformance`, `pnpm conformance:r` and `pnpm conformance:r:v2`. Run affected
cached package checks with repeatability observations. Worker/playground changes need
`pnpm test:e2e`; packaging changes need `pnpm pack:smoke`. Record real skips/failures explicitly.

Initial verification: HEAD 455e76a, profile 0.355; 24 archive digests match. Five focused files
passed 41 tests (3 opt-in skipped); a separate two-case integration run passed one and failed the
obsolete as.ordered dispatch expectation. Full gates had not been rerun. An independently authored
native probe additionally confirmed that as.call must preserve character heads without symbol
coercion.

### Profile 0.356 verification (2026-10-19)

The four pending fixes are complete. Primitive signature collection reproduced byte-for-byte; 212
primitive/special entries gained observable signature metadata. Six foundation and six recursive
cases cover embedded closure capture, object/attribute retention, arbitrary call heads, deparse,
exit callbacks and non-dispatching factor coercion. The obsolete factor-dispatch case now verifies
rejection of extra arguments against GNU R.

- `pnpm check`: passed, 1,302 tests and 86 opt-in skips.
- `pnpm conformance`: 1,235/1,235.
- `pnpm conformance:r`: 1,166/1,166 (51 NativR-only cases excluded).
- `pnpm conformance:r:v2`: 133/133; 79 bindings have causal case links.
- Independently authored native dependency/signature fixtures: 22/22.
- Bundle sizes: client 17.3 KiB gzip, Worker 466.4 KiB gzip, parser 671.9 KiB raw, elementary module
  311.2 KiB raw; every existing limit passes.
- All 24 cached archives were checked again against their pins and evaluated. The
  [checkpoint](../compatibility/package-check-evidence/corpus-0.356.0.json) contains 23 reports and
  one explicit abort (inline: duplicate documentation inventory IDs). pkgconfig and abind pass all
  package-check stages. numDeriv remains P6; its 5 matches/6 differences are unchanged.

No Worker/protocol/playground or packaging change was made for this increment; e2e and pack smoke
were not refreshed. Linux and the Formula holdout remain deferred. HANDOFF.md was removed after its
useful findings were preserved here and in regression tests.

Tooling on this host: Node 24.19.0 is already bundled in the Codex runtime. The existing tree-sitter
SDK is under the user's actual LocalAppData; the sandbox's redirected cache lacks it. Temporary test
directories must be outside Dropbox to avoid cleanup EBUSY errors. Native GNU R file.access returns
-1 under the Windows sandbox even for readable fixtures; native package/oracle gates were therefore
run with ordinary Windows permissions. No downloads were needed. The session-specific environment
helper and raw evidence remain gitignored under `.tmp/`.

### Profile 0.357 checker work

Owned native fixtures confirm that `R(>= 2.10)` is accepted, computed function definitions are
valid, and unstated-dependency scans exclude dontrun while retaining donttest. Repairs passed 44
focused unit tests, two focused native fixtures, and the 0.357 checked-in/live/recursive suites
(1,235 / 1,166 / 133 cases). The
[nine-package recheck](../compatibility/package-check-evidence/corpus-0.357.0.json) preserves pins
and explicit blockers. inline now produces a report; prettyunits and rstudioapi clear metadata and
stop at documentation. pkgconfig and abind retain P7. Static unknown definitions remain unexecuted
until loaded namespace metadata can settle them. Policy documentation-v2 now gives repeated usage
entries distinct IDs. The final full check passed 1,309 tests with 87 opt-in skips, including
checkpoint validation. All fixed bundle budgets pass. Stabilization is committed as `6b8fef5`; the
checker repairs are committed as `b3dbd9e`.

The sweep also reproduced an explicitly missing positional argument in `person()` as a shared
Authors@R blocker. Add it to the argument-matching increment. A supplemental
`tsc -p tsconfig.eslint.json` run found errors in existing test fixtures (resource limits, snapshot
types, graphics options and a Playwright tuple); it is not the normal production typecheck gate and
needs separate cleanup before being adopted as a gate.

### Profile 0.358 loaded documentation metadata

Documentation policy v3 observes loaded export names and compares documented formals inside both
runtimes. Computed definitions, imported signatures and non-function exportPattern matches are
covered. Only bounded metadata and digests leave the observer; observed defaults and implementation
bodies are never recorded. Unknown signatures, active bindings, non-syntax objects and unsupported
recursive syntax remain unexecuted. The independently authored native matrix covers 23 signature
comparisons, including numeric storage, typed missing values, NA versus NaN, argument order and
unevaluated defaults. Both owned native test files pass (22 tests). Checked-in conformance passes
1,236 cases. The new conformance case also identified and fixed zero-argument `formals()` returning
an empty pairlist instead of NULL.

The [complete 24-package checkpoint](../compatibility/package-check-evidence/corpus-0.358.0.json)
has no checker aborts. Every cached source and artifact pin matched; tiers and partitions are
unchanged. pkgconfig and abind retain P7. Export inventories agree for 23 packages; inline exposes
13 exports in NativR versus 24 in the native oracle. Those differences are failures, not successful
empty inventories. Native conformance passes 1,167 cases (51 NativR-only exclusions); recursive
Oracle v2 passes 134 cases with 81 binding links and causal controls.

The final `pnpm check` passes 1,321 tests with 89 opt-in skips, production types, lint, dependency
boundaries, browser bundle audit and all fixed size budgets. No Worker/playground or packaging
interface changed; e2e and pack smoke were not refreshed. No downloads, push or publication
occurred.

### Profile 0.359 Rd boundary repairs

Documentation policy v4 corrects the internal-page argument exemption and qualified-link filename
fallback. Its combined native fixture retained diagnostics for extra documented arguments, missing
aliases, invalid usage and signature mismatches. Profile 0.360 corrects the first two diagnostics'
severity from failure to NOTE using isolated checks. Qualified links must resolve within the named
package; a filename can resolve even when it is not an alias, while a bare `\name` cannot. The
public help catalog retains the same 8,612 aliases and adds 2,635 Rd filenames across 29
base/recommended packages, in deterministic order. No implementation bodies were collected.

Manual adaptation v2 handles literal backslashes and braces in verbatim contexts and preserves
context-dependent percent behavior. LaTeX commands remain invalid outside appropriate verbatim
contexts. The retained `rd-contexts.R` fixture covers native warnings and literal bytes; all 34
focused Rd tests, including three opt-in native tests, pass. Runtime semantics are unchanged.

The [24-package checkpoint](../compatibility/package-check-evidence/corpus-0.359.0.json) preserves
every source/artifact pin and partition. evaluate, rprojroot and whisker pass documentation; crayon
and viridisLite pass the manual stage. Otel's corrected link leaves other unavailable catalogs
explicitly unexecuted. Tiers are unchanged, with pkgconfig and abind retaining P7. The full check
passes 1,346 tests with 90 opt-in skips. Checked-in, native and recursive conformance pass 1,236 /
1,167 / 134 cases, with 81 causal binding links. All fixed bundle budgets pass. The stale planned
label for the adopted elementary Wasm backend is corrected; normative Linux validation remains
pending. No Worker/playground or packaging interface changed, so e2e and pack smoke were not
refreshed. No downloads, push or publication occurred.

### Profile 0.360 method and static metadata repairs

Documentation policy v5 preserves S4 generic/class identity and source offsets, including
replacement methods and ordinary symbols with the same spelling. Public `getMethod()` and
`unRematchDefinition()` observations recover original method formals without returning bodies. Owned
native fixtures verify exact signatures, rematched defaults, multiple dispatch arguments,
replacement methods, missing methods and a same-named ordinary binding. Unavailable NativR method
reflection remains unexecuted. The earlier wrapper-only observation is retained as a reason not to
compare a method with its generic's arguments.

Static comparisons now use native-observed literal equivalence and parsed-call structure. The
23-signature fixture and a further 16 default-expression pairs cover storage, missing/nonfinite
values, string escapes, alternate call spellings, assignments, subsets, blocks and nested function
defaults. Unsupported or ambiguous syntax stays unexecuted. Eight isolated native usage fixtures
also correct a 0.359 error: extra arguments and missing aliases on internal pages are `NOTE`s, not
warnings. They pass under RFC-0008 and remain recorded. Syntax errors remain warnings. The earlier
combined fixture established diagnostic presence, not per-diagnostic severity.

All 71 owned parity tests pass, including native checks. Behavioral sources are public Rd and
method-utility documentation, the local normalized AST specification and independently authored
oracle inputs. A broad search unexpectedly returned a tools implementation snippet; that source page
was not opened and the snippet was excluded from development evidence. No method bodies or observed
default expressions are collected by the checker.

The [seven-package checkpoint](../compatibility/package-check-evidence/corpus-0.360.0.json)
refreshes pkgconfig, abind, inline, withr, evaluate, rprojroot and whisker from pinned cached
archives with repeatability observations. Tiers and partitions are unchanged. inline passes its
usage checks; two ordinary signature mismatches remain failures and five S4 signatures remain
unexecuted because NativR method reflection is unavailable. withr retains 14 signature mismatches
and one unexecuted comparison. The full 24-package checkpoint remains at 0.359.

The final `pnpm check` passes 1,368 tests with 93 opt-in skips, production types, lint, dependency
boundaries, browser audit and all fixed bundle limits. Checked-in/live/recursive conformance passes
1,236 / 1,167 / 134 cases, with 81 causal binding links. No evaluator, Worker/playground or
packaging interface changed, so e2e and pack smoke were not refreshed. No downloads, push or
publication occurred.

### Immediate continuation

Proceed to the ordered factor printing/addNA and argument-matching work. Broader Rd
parsing/rendering still needs domain evidence; these bounded checks do not establish complete native
renderer equivalence.

An owned factor probe already reproduces the next gaps: ordinary and ordered factors omit their
level summaries; missing labels print `NA` instead of `<NA>`; empty factors print `integer(0)`
instead of `factor()`; quote, width and `max.levels` behavior differs; `addNA()` is absent. Native
`max.levels=2` on four levels prints `4 Levels: a ... d` (ordered: `a < ... < d`). After
`addNA(factor(c("a",NA,"b")))`, the NA level is retained while `is.na()` is false for every element.
The 15 independently authored cases remain in `.tmp/factor-roadmap-probe.R`, with native and NativR
output logs, ready to become regression and recursive evidence with the implementation. Additional
owned native probes in `.tmp/factor-print-boundaries.R` and `.tmp/factor-level-layout.R` cover level
truncation, attributes, named and empty factors, matrix/list display, invalid controls and output
before errors. They establish that the explicit `width` controls the level summary while the vector
body uses the session width; `max=2` partially matches `max.levels`. Numeric limits override width,
while logical TRUE retains automatic truncation. Missing-level factors require representation work:
the current `isFactor()` rejects an NA-bearing levels attribute. Preserve that distinction from
missing integer codes when implementing addNA.

S4 runtime follow-up includes missing method-selection/unrematching APIs, rejection of
`setClass(slots=...)`, custom replacement generic binding names, and a package export failure when a
generic is defined solely by `setGeneric()`. The checker fixtures use valid shared syntax to isolate
metadata observations; they do not establish closure of those runtime gaps. Reproduce each through
an owned native/runtime pair before changing runtime behavior.

The new withr observations distinguish 14 actual signature mismatches from the remaining unknown
signature. Reproduce these through owned factories and formals assignment before changing runtime
semantics. Reflection follow-up leads also include `args(stats::setNames)`'s `object = nm` default,
pairlist `seq_along`, `quote(expr=)`, and traversal of quoted function syntax. The observer bounds
unsupported recursive traversal instead of losing all export evidence.

Then proceed to factor printing/addNA and shared argument matching, including the confirmed person()
missing-slot case. Datasets, the separate testing runner, all-domain closure, browser/OS validation,
the holdout and the Linux gate remain outstanding.
