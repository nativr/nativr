# Development continuation

Approved 2026-10-19. The target remains all five completion criteria in
[gnu-r-compatibility.md](gnu-r-compatibility.md), including all thirteen semantic domains. This is
an execution queue, not a claim of completion. Canonical counts live in `compatibility/status.json`.

## Active completion goal (2026-10-22)

Continue until all five existing completion criteria are demonstrated. Track progress using
executable evidence and explicit remaining work; callable overlap is not a completion percentage.

- [ ] All 13 required domains have complete differential behavioral matrices: ordinary and boundary
      cases, errors, attributes, visibility, side effects and identity where applicable.
- [ ] Every inventoried callable maps to a domain and declared behavioral evidence or a justified,
      executable platform exclusion; recursive evidence includes causal controls.
- [ ] A broad clean-room corpus covers language, examples, serialization, namespaces and owned R CMD
      check scenarios. Pinned package reports retain hashes, profiles, partitions, tiers and first
      blockers. Substitute-runner results remain separate from the original dependency closure.
- [ ] Supported browser/OS, performance, cancellation, numeric/locale/time-zone/graphics and
      host-adapter gates pass within existing budgets, including the separately authorized Linux
      gate.
- [ ] The compatibility ledger, capabilities, public API, release evidence and generated reports
      agree after those gates pass.

Each semantic increment must pass pnpm check and checked-in/live/recursive conformance, refresh
affected cached-package repeatability, and add independent tests, contract and capability evidence.
Run browser/packaging gates when applicable. Commit verified increments locally. A single increment
or a clean test run cannot satisfy the overall goal while required gaps remain. Request user input
only for concrete dependencies or decisions outside the boundaries below.

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

1. **Profile 0.356 stabilization (completed):** optional-dependency policy v3, primitive-signature
   metadata, embedded call objects and non-dispatching factor coercion passed their owned native
   fixtures, foundation/recursive evidence and semantic gates. See the verification record below.
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

For semantic increments: build serially; regenerate capabilities, name coverage, callable inventory,
then status; run `pnpm check`, `pnpm conformance`, `pnpm conformance:r` and `pnpm conformance:r:v2`.
Run affected cached package checks with repeatability observations. Worker/playground changes need
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

### Profile 0.361 factor printing

The registered print.factor method renders ordinary and ordered factors, level summaries and
truncation, missing labels, empty values, names, dimensions, incidental attributes and quoted nested
display. Ten regression tests include malformed values, output before errors, S3 overrides,
invisible returns and resource limits. The 34-case owned boundary probe matches GNU R output.
Explicit width controls the summary while the vector body uses the session width; numeric level
limits override width, and max partially matches max.levels. Foundation and recursive cases retain
text, values and metadata. Checked-in/live/recursive conformance passes 1,238 / 1,169 / 136 cases,
with 82 bindings linked through causal controls.

The [24-package checkpoint](../compatibility/package-check-evidence/corpus-0.361.0.json) refreshes
every pinned development/regression archive with repeatability observations and no checker aborts.
Tiers and partitions are unchanged; pkgconfig and abind retain P7. Output comparison match counts
and stage outcomes remain unchanged. No original dependency closure was replaced, and Formula
remains unevaluated.

The final `pnpm check` passes 1,379 tests with 93 opt-in skips, production types, lint, dependency
boundaries, browser audit and all fixed bundle limits. Client/Worker gzip sizes are 17.3 / 467.7
KiB; parser/elementary raw sizes are 671.9 / 311.2 KiB. No Worker/playground or packaging interface
changed, so e2e and pack smoke were not refreshed. No downloads, push or publication occurred.

### Continuation recorded at profile 0.361 (superseded below)

Next implement addNA and NA-level construction/coercion, then the shared argument-matching work.
Broader Rd parsing/rendering still needs domain evidence; the checker increments do not establish
complete native renderer equivalence.

Seventeen owned observations in `.tmp/add-na-probe.R` establish addNA's `(x, ifany=FALSE)`
signature, coercion of non-factors, retention of unused/ordered levels, and conversion of missing
codes to a real NA level. `is.na()` is then false for those codes while `as.character()` returns
missing strings. No-op cases retain incidental attributes; rebuilding retains names but drops
incidental attributes, dimensions and factor subclasses other than ordered. NULL and empty inputs
can receive an unused NA level. Existing NA levels must not be duplicated. Numeric NaN remains the
distinct "NaN" level. The next increment needs this evidence in retained tests and recursive cases.

Nineteen further owned cases in `.tmp/factor-construction-probe.R` cover NULL/missing input,
explicit NA levels, exclude=NULL versus the default NA exclusion, distinct numeric NaN, duplicate
level rejection, merged/NA labels and scalar label prefixes. Refactoring with default exclude drops
an NA level; exclude=NULL and droplevels retain a used NA level. as.ordered on an unordered factor
drops it while retaining the ordinary used levels. levels<- with an NA label removes that level and
marks its codes missing. These distinctions require preserving both the level mask and the code
mask.

The current isFactor helper rejects NA-bearing levels, structure(levels=) rejects NA, and factor
construction/coercion do not preserve the level mask. The printing tests construct such vectors via
attribute assignment to isolate display; constructor and conversion gaps remain genuine work. The
owned option-width test also exposed on.exit(options(old)) inside local() failing to restore
options; an ordinary function frame restores them correctly. Reproduce and repair the local/frame
behavior during the calls/environments work rather than treating local as an ordinary closure.

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

Shared argument matching must include the confirmed person() missing-slot case. Datasets, the
separate testing runner, all-domain closure, browser/OS validation, the holdout and the Linux gate
remain outstanding.

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

### Continuation recorded at profile 0.362 (superseded below)

Continue the shared argument-matching diagnostics next: unused, duplicate, partial and missing
arguments across closures and builtins, including the confirmed person() explicit missing-slot case.
Preserve required primitive/closure evaluation-order distinctions.

The owned .tmp/argument-diagnostics-next.R probe confirms that exact matches reserve a formal before
partial matching: f(alpha=1, al=2) reports unused al, rather than duplicate alpha. An explicit
missing actual selects a closure's default. Native closure-like as.factor rejects extra arguments
without forcing them, while primitive sqrt forces an extra stop() before checking arity. Current
runtime errors lose conditionCall metadata for these cases. The matching copies in base/arguments.ts
and runtime/evaluator.ts (closure invocation and match.call reconstruction) need one consistent
policy while retaining primitive-specific forcing. Missing promises currently throw without the
formal's name; preserve argument-origin metadata through forwarding.

The new owned factor probes also confirm follow-up gaps: summary.factor is absent and generic
summary currently summarizes integer codes numerically; levels<- is absent; model.frame is absent.
Native summary.factor retains NA level names separately from the final NAs count and has maxsum
truncation behavior. NA replacement levels remove their category and mark its codes missing. A model
matrix can encode an NA factor level as a category named xNA, while missing codes are omitted by the
default frame policy. The new tests establish the supported matrix path, not model.frame.

Direct c.factor, mixed-class and ordered concatenation, all class-specific factor coercions,
malformed objects, table options beyond the retained cases, and the remaining factorLevels callers
still need closure. xtabs call normalization and one-dimensional names attributes differ in the
owned broader probe; retain those as observable metadata gaps. Factor helpers and the public NativR
Worker protocol continue to use existing integer/character attribute masks.

Owned scratch probes remain under .tmp/factor-na-*.R and .tmp/factor-table-probe.R; the executable
retained subset is in factor-na.test.ts and the foundation/Oracle v2 cases. local/on.exit,
reflection, S4, datasets, the separate testing runner, all-domain inventory, performance, CI and the
platform gates remain required work. All thirteen domains remain incomplete.

### Profile 0.363 verification (2026-10-19)

One bounded matcher now serves closures, named builtin matching and match.call reconstruction. This
increment corrects formal-order duplicate/ambiguity diagnostics, exact-before-partial matching,
unused expression rendering, explicit missing defaults, forwarded default missingness, missing
argument names and condition calls. person accepts empty slots using its NULL defaults. The sqrt/abs
primitive path preserves eager actual-order evaluation before arity/name validation.

Forty-seven owned behavioral regressions pass in NativR and directly under GNU R 4.6.1; a separate
resource-limit regression covers cancellation and bounded matching. The full check passes 1458 tests
with 93 opt-in skips. The new checkpoint integrity case also passes in the separate ten-test
checkpoint run. Checked-in/live/recursive conformance passes 1,245 / 1,176 / 143 cases, with 88
linked behavioral bindings. The primitive observations do not promote sqrt/abs from numeric to
behavioral evidence. Fixed budgets pass: client 17.5/150 KiB gzip, Worker 468.8/512 KiB gzip, parser
671.9/1,536 KiB raw and elementary 311.2/384 KiB raw.

All 24 pinned cached development/regression archives were rechecked, with applicable oracle
repeatability recorded in the
[0.363 checkpoint](../compatibility/package-check-evidence/corpus-0.363.0.json). Metadata/dependency
checks now pass for generics, withr, assertthat and evaluate. Package tiers and comparison match
counts are unchanged. Formula remains untouched. Original package entrypoints were used; no
substitute runner received P6/P7 credit. No Worker/playground or packaging interface changed, so e2e
and pack smoke were not refreshed. Linux and the complete browser/OS matrix remain open. No
downloads, pushes or publication occurred.

### Continuation recorded at profile 0.363 (superseded below)

Continue argument semantics with warnPartialMatchArgs and the remaining primitive families before
reflection. An owned GNU R probe confirms that partial warnings follow formal order, carry the
original call, and precede a later duplicate or ambiguity error. For f(alpha,beta), f(be=2,al=1)
warns about al/alpha before be/beta. For f(alpha,alpine), f(al=1) warns about al/alpha before the
ambiguity error. Exact-reserved formals generate no partial warning. match.call uses its internal
observable call as warning metadata. The probe is .tmp/partial-argument-warnings-next.R; it contains
only independently authored functions and no implementation bodies. Preserve warning muffling,
warn=2 conversion and evaluation order when extending the shared matcher.

Other open argument work: primitive-specific forcing/arity outside sqrt/abs, forwarded dots
missingness, optional builtin defaults beyond person and the already covered factor paths, long
unused-diagnostic layouts, and condition-call origins beyond the covered argument errors.

Then resume callable reflection and the reproduced corpus blockers. The profile 0.362 factor
follow-ups remain open, as do independent datasets, isolated testthat support, the complete callable
and thirteen-domain inventory, performance/CI/release work, and the separately authorized Linux and
holdout gates. No full compatibility percentage or completion date is established.

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

### Continuation recorded at profile 0.364 (superseded below)

Continue generic/method argument behavior and the remaining primitive rules before reflection. An
owned black-box sweep confirms three direct fallback gaps with warnPartialMatchArgs enabled:
seq(f=1,t=3) warns from seq.default in R but seq in NativR; format(1.234,dig=2) warns from
format.default in R but format in NativR; sort(c(3,1,2),decr=TRUE) emits both sort and sort.default
warnings in R but only the generic warning in NativR. Implement reusable generic and method
delegation with matching/forcing evidence instead of merely changing diagnostic text. The owned
.tmp/partial-warning-delegation.R probe also covers mean, print.factor, seq.int, rep, factor, sum,
match, unlist, lapply, sapply, matrix and as.matrix. The mean/print.factor metadata gap is fixed
through shared builtin S3 dispatch and retained in executable cases.

The follow-up owned .tmp/generic-warning-next.R probe confirms that seq and sort currently bypass
custom S3 methods. Native seq() returns 1L; seq(f=,t=3) uses its from default, and sort(x,decr=)
uses decreasing=FALSE. NativR currently errors for those default-selection cases. Observable
signature metadata identifies seq(...), sort(x,decreasing=FALSE,...) and format(x,...), plus their
default methods. format dispatches an owned method correctly, but format.default is not registered.
These are confirmed behavior and metadata gaps, with no implementation-body inspection.

Other argument work remains: primitive-specific forcing/arity outside sqrt/abs, forwarded dots
missingness, optional builtin defaults, long diagnostic formatting and broader condition-call
origins. The recursive observer muffles outer warnings, so use the foundation oracle's existing
no-outer-handler mode for unhandled warn=2 conversion; do not infer promotion from muffled cases.

Then resume reflection and the reproduced corpus blockers. Factor follow-ups, independent datasets,
the isolated testing runner, the complete callable/domain inventory, browser performance, CI and
release validation remain outstanding. Linux and holdout execution require separate authorization.
No full compatibility percentage or completion date is established.

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

### Continuation recorded at profile 0.365 (superseded below)

Continue argument/default closure before the broader reflection work. New owned black-box probes
confirm the following remaining differences, using no foreign implementation bodies:

- match.arg diagnostics: format.default("x",justify=c("left","right")) reports "'arg' must be of
  length 1" in GNU R; the shared matcher still uses its older wording. Invalid choices similarly
  retain the older prefix/punctuation. Preserve match.arg(justify).
- Condition origins through forced promises: a helper that catches force(expr) currently loses inner
  error call metadata for these default-method failures. Reproduce with probe <- function(expr)
  tryCatch(force(expr),error=conditionCall), then probe(format.default("x",justify="bad")). Native
  returns match.arg(justify); NativR returns NULL.
- sort(c(2,1),decreasing=NA) has the observed inner order(x,na.last=na.last,
  decreasing=decreasing,method="radix") call. Method-specific control and tie behavior remains
  bounded. sort.int(...,partial=3) is explicitly unsupported and needs independent partial-sort
  behavior, rather than assuming a full sort establishes equivalence.
- seq.default(from=1+2i,to=3) warns about discarding imaginary parts before returning 1:3; NativR
  currently returns those values without the warning. Broaden coercion/boundary evidence.
- format.default(c(0,1),zero.print="zero") returns c("z","1") and warns about truncation in R;
  NativR currently omits that warning. Non-atomic formatting, grouping and other control boundaries
  remain open. Retain generic promises and resource checks while closing them.

The owned probes and parity inputs remain in .tmp/generic-*.R and the maintained generic-method-
defaults tests and conformance cases. Do not read foreign implementation bodies to fill these gaps.
After argument/default closure, resume callable reflection and the confirmed corpus blockers.
Independent datasets, the isolated testing runner, full domain/callable inventory, browser
performance, CI and release validation remain outstanding. Linux and holdout execution still need
separate authorization. Keep the completion goal active; no overall percentage or date is
established.

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

### Continuation recorded at profile 0.366 (superseded below)

The previous match.arg wording and promise-origin defects are closed within the owned evidence.
Continue the remaining independently reproduced default-method gaps: seq.default complex-to-real
coercion warnings, format.default zero.print truncation warnings, and sort control/partial-sort
behavior. Keep lazy promises and resource limits. Broader eval-frame attribution, missing-argument
subclasses, long diagnostics and primitive-specific rules remain open. Factor [[ extraction still
drops attributes in NativR; an owned probe confirms native levels/class retention. Do not infer
factor extraction closure from the fixed vector subset path.

Then resume callable reflection and confirmed corpus blockers. Independent datasets, the isolated
testing runner, complete domain/callable inventory, browser performance, CI and release validation
remain outstanding. Continue the planned browser startup/cancellation/workload measurements; the
small paired Node probe does not satisfy that platform gate. Linux and holdout execution require
separate authorization. Keep the full goal active; no overall completion percentage or date is
established. Public metadata and owned black-box observations remain the only GNU R inputs. Native
diagnostic calls that expose internal implementation fragments must be omitted, never used as
implementation evidence.

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

### Continuation recorded at profile 0.367 (superseded below)

The reproduced complex-sequence, zero-formatting and factor-element gaps are closed within the owned
evidence. Partial sorting now has an executable bounded surface; exact intermediate permutations,
method/tie behavior, Unicode zero formatting and broader diagnostic calls remain open. Do not infer
full domain closure from passing examples. Existing arbitrary owned functions and resource limits
must remain intact when extending reflection and direct S3 continuation.

Owned continuation probes reproduce three reflection gaps: formals("owned") does not resolve a named
function; body() wraps owned atomic/symbol bodies as language rather than returning their value
types; body<- is unavailable. A body("owned") lookup also stops at a local non-function binding
instead of finding the outer function. Native metadata classifies the first-class if binding as
special, but NativR has no corresponding binding. Existing abs/mean/owned-closure classification and
args(owned) signature/body/environment controls agree. These are next-step leads, not new
compatibility claims. Fix shared reflection primitives using owned closures only, then continue
confirmed corpus blockers with independently authored probes and shared primitives. Independent
datasets, the isolated testing runner, complete domain/callable inventory, browser performance, CI
and release validation remain outstanding. Linux and holdout execution require separate
authorization. Keep the goal active; no overall completion percentage or date is established. Public
metadata and owned black-box observations remain the only GNU R inputs. Never retain foreign
implementation bodies or internal control fragments in evidence.

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

### Continuation recorded at profile 0.368 (superseded below)

The named-function, owned body-type and component-replacement gaps reproduced at 0.367 now have
owned evidence. New independently authored probes reproduce the next reflection gaps. For an owned
function whose body is `structure(1:3, names=c("a","b","c"), tag="owned")`, native print/deparse of
the function shows `1:3`; NativR includes the body's attributes as a structure expression. A
pairlist body similarly retains nested attributes in NativR display that native function display
omits. Body access and evaluation must still preserve those attributes. Ordinary owned closure
display and repeated formal-name display agree. Primitive abs and closure mean classification also
agree.

First-class `if` remains unavailable, and `sys.nframe` is absent. In the owned chain below,
`g(sys.call())` returns NULL natively but `h(x)` in NativR; `g(sys.nframe())` returns zero natively.

```r
g <- function(x) h(x)
h <- function(x) x
g(sys.call())
g(sys.nframe())
```

This extends the caller-promise frame issue beyond the accessors fixed here. Reproduce these cases
in maintained tests and close the shared display/frame primitives next. Complete callable default
metadata is not established. Do not inspect GNU R library bodies to fill gaps. Preserve
unknown-versus-empty signatures, embedded identity, repeated formal positions and work limits.

Then continue confirmed corpus blockers through shared primitives. Exact partial-sort intermediate
permutations, method/tie behavior, Unicode zero formatting and broader diagnostics remain open.
Independent datasets, the isolated testing runner, complete domain/callable inventory, browser
performance, CI and release validation are outstanding. Linux and holdout execution still need
separate authorization. Keep the goal active; no overall completion percentage or date is justified.

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

### Continuation recorded at profile 0.369 (superseded below)

Continue the frame model through independently authored eval/local and wrapper fixtures. For
example,
local({base<-sys.nframe();h<-function(x)x;f<-function(x)h(x);observed<-f(sys.nframe());observed-base})
is zero natively but two in this NativR profile. Owned function scopes pass. Model evaluation
origins without losing promise laziness, identity, cancellation limits or frame restoration. Native
library wrappers also add frames that NativR's implementation builtins do not model; do not inspect
their implementation bodies to reproduce those observations. First-class if remains unavailable.

Display gaps are also reproducible: native function display of a constructed [ call with an embedded
1:3 operand is 1:3[2], while NativR prints a backtick call. Raw bodies use hexadecimal byte display
natively. Closure attributes containing more complex attributed objects need broader path/layout
evidence. Preserve body/default values and identity independently of display.

Then continue confirmed corpus blockers through shared primitives. Exact partial-sort intermediate
permutations, method/tie behavior, Unicode zero formatting and broader diagnostics remain open.
Independent datasets, the isolated testing runner, complete domain/callable inventory, browser
performance, CI and release validation are outstanding. Linux and holdout execution still need
separate authorization. No overall completion percentage or date is justified.

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
incomplete. The active goal now records five measurable completion criteria near the top of this
continuation document; each must be evidenced before the goal is complete.

### Continuation recorded at profile 0.370 (superseded below)

Fix evaluation control boundaries first. Owned native probes show that
(function(){eval(quote(return(7L)));9L})() returns nine; NativR returns seven. The same difference
occurs with evalq, local and with. A caller exit handler plus an eval exit handler yields events
eval, after, owner natively; NativR yields after, eval because the inner handler replaces the
caller's handler. Reproduce this with the independently authored fixture below, then retain
maintained tests and recursive evidence. Break and next still reach an enclosing owned loop through
eval on both runtimes: an evaluation scope is not an ordinary function barrier. Preserve that
distinction, promise origins, handler ordering, visibility and resource/cancellation cleanup.

```r
events <- character()
f <- function() {
  on.exit(events <<- c(events, "owner"))
  eval(quote(on.exit(events <<- c(events, "eval"))))
  events <<- c(events, "after")
  invisible(NULL)
}
f()
events
```

Model synthetic evaluation contexts separately from owned closure frames and environment origins.
Black-box standalone observations: sys.nframe is zero globally; eval(quote(sys.nframe())) and
evalq(sys.nframe()) return two; local(sys.nframe()) returns six; with(list(),sys.nframe()) returns
four. NativR currently returns zero in those standalone scopes. An owned caller adds one on both
sides. Nested local scopes add six natively. These are observed cases, not a prescription to insert
fixed offsets: call/function/environment identity, laziness and unwinding must determine the model.

Native eval(quote(sys.function())) returns a function of type builtin, distinct from the public eval
closure. Its parent frame is the public eval closure; the current call matches the original eval
call. A default promise forced inside eval reusing its owned environment observes that active eval
context; a distinct environment leaves the default associated with its owning closure. Use
independent fixtures and public metadata, never library bodies. Check return and condition-handler
unwinding as part of the context model, including cancellation and resource-limit restoration.

Then close constructed subset-call and raw hexadecimal function display, more complex nested
attribute paths, first-class special-form bindings, and confirmed shared corpus blockers. Complete
callable defaults, partial-sort permutations, method/tie behavior and broader diagnostics remain.
Independent datasets, isolated testing support, the complete domain/callable inventory, browser
performance, reproducible CI and release gates are still required. Linux and holdout execution
remain separately authorized gates. Continue useful local work without claiming full completion.

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

### Continuation recorded at profile 0.371 (superseded below)

The reproduced evaluation return/exit-handler defects from 0.370 now pass. Continue the context
model through the next reproduced adapters. An owned function that calls
subset(data.frame(a=1:3),return(c(TRUE,FALSE,TRUE))) and then returns 9L yields nine natively;
NativR reports no function to return from. The same happens for data-frame select=return(1L).
Matrix/atomic subset return must still reach the owning function: native and NativR both return the
logical predicate in the matrix probe. Matrix select has a separate evaluation scope, like
data-frame select: native return is contained and its on.exit runs immediately; NativR currently
errors on return and drops the cleanup. Matrix predicate cleanup instead belongs to the caller; both
runtimes retain its later execution after the caller's remaining body. Source also needs
per-expression evaluation scopes: source(textConnection("return(7L)\n9L"),local=new.env())$value is
nine natively but currently errors. An on.exit inside a sourced expression runs before the next
source expression natively; NativR drops the handler. A data-frame subset predicate's on.exit
likewise needs to execute at the end of predicate evaluation. Add owned tests and recursive evidence
for these distinctions using the shared control-scope mechanism; internal AST composition remains
transparent. Source exprs= must also isolate each expression, retain an invisible return's
visibility, and contain return under local=TRUE. These independently reproduced native controls
confirm that the scope belongs around each evaluated source node rather than the entire source call.

Then continue synthetic frames and reflective identity, using the absolute-count and primitive
evaluation-function observations recorded above.

First-class return remains missing: (function(){do.call("return",list(7L));9L})() returns seven
natively; NativR reports that return is not a callable binding. First-class if is also unfinished.
Close special-form callable classification and lazy invocation through a shared mechanism rather
than package-specific exceptions. Preserve environment-directed control, call identity, defaults,
promise memoization and resource/cancellation limits.

Then continue constructed subset-call and raw hexadecimal function display, complex attribute paths,
callable defaults, partial-sort/method/tie behavior and confirmed shared corpus blockers.
Independent datasets, isolated testing support, complete domain/callable inventory, browser/OS
performance, reproducible CI and release gates remain required. Linux and holdout execution still
need separate authorization. Keep the full goal active while useful local work remains.

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

### Continuation recorded at profile 0.372 (superseded below)

The reproduced source/subset control defects now pass. Continue the actual frame model for synthetic
evaluation/library contexts and reflective identity, preserving the completed control scopes and
promise origins. Independent metadata-only probes, with results assigned before printing, observe
these native frame kinds: standalone eval and evalq each have closure,builtin at depth two; local
has closure,closure,closure,builtin,closure,builtin at depth six; with(list(),...) has
closure,closure,closure,builtin at depth four. In each, the first function is identical to the
public adapter binding. NativR observes depth zero in these probes. Evalq reusing an owned
function's environment has depth three natively (closure,closure,builtin), versus one in NativR.
Public print adds its own closure frame when it forces an unassigned probe, so capture observations
before printing. Do not replace the frame model with hard-coded count offsets; identities, calls,
frame environments, parentage and forwarded/default promise origins must remain coherent. Only
public metadata and owned calls are oracle inputs/outputs; library function bodies remain off
limits.

First-class special-form bindings also remain open: native get("return",baseenv()) is a primitive
function of type special. NativR currently lacks that binding and do.call("return",list(7L)) fails.
Use a shared callable/lazy-invocation mechanism and preserve environment-directed control and
limits. First-class if remains open as well.

Continue constructed subset-call/raw hexadecimal display, complex attribute paths, callable
defaults, partial-sort/method/tie behavior and confirmed shared corpus blockers. Independently
licensed offline datasets, isolated testing support, complete domain/callable inventory, browser/OS
performance, reproducible CI and release gates remain required. Linux and holdout execution still
need separate authorization. Keep the full goal active while useful local work remains.

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

### Continuation recorded at profile 0.373 (superseded below)

The evaluation/library frame defects recorded at 0.372 now pass. Continue first-class special-form
invocation through shared callable and control machinery. Seven independently authored probes
reconfirm the next gap: native return/if bindings are primitive functions of type special, with NULL
formals. An alias of return and do.call("return",list(7L)) each return 7 from an owning closure;
registered owner cleanup runs once. An alias of if selects 7 without forcing its false branch;
do.call("if",list(FALSE,quote(stop("not forced")),9L)) returns 9. NativR lacks both bindings and
fails these lookups/invocations. Preserve lazy evaluation, environment-directed return, visibility,
diagnostics, cancellation and resource-limit recovery when implementing them. No library body is
needed as an implementation input.

Further reflective adapter/stack-trace work remains. Profile the measured evalq overhead while
preserving the verified frame graph and defaults. Continue constructed subset-call/raw hexadecimal
display, complex attributes, callable defaults, partial-sort/method/tie behavior and confirmed
shared corpus blockers. Independently licensed offline datasets, isolated testing support, complete
domain/callable inventory, browser/OS performance, reproducible CI and release gates remain
required. Linux and holdout execution still need separate authorization. Keep the full goal active
while useful local work remains.

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

### Continuation recorded at profile 0.374 (superseded below)

The reproduced return/if defects now pass. Continue the shared callable/control mechanism for the
remaining special forms. Eight independently authored probes establish concrete gaps: native
get("break",baseenv()) has type special; aliases of break, next, while, for, repeat and braces
execute owned loops/blocks with their expected control effects. NativR lacks all six bindings.
Preserve environment-directed loop ownership, lazy bodies, visibility, cleanup, argument errors,
callable replacement and resource-limit recovery. Use public metadata and owned behavioral probes;
no GNU R implementation body is needed.

The same probe confirms a separate coercion gap: native as.logical of
`c("tRuE"," TRUE ","true","False","T","f")` is `c(NA,NA,TRUE,FALSE,TRUE,NA)`; NativR differs.
Conditional coercion is now correct for those spellings, but general vector/option conversion still
uses a permissive trim/case-fold helper. Reproduce each consumer before sharing a corrected parser.

Further reflective adapter/stack-trace work remains. Profile the measured evalq overhead while
preserving the verified frame graph and defaults. Continue constructed subset-call/raw hexadecimal
display, complex attributes, callable defaults, partial-sort/method/tie behavior and confirmed
shared corpus blockers. Independently licensed offline datasets, isolated testing support, complete
domain/callable inventory, browser/OS performance, reproducible CI and release gates remain
required. Linux and holdout execution still need separate authorization. Keep the full goal active
while useful local work remains.

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

### Continuation recorded at profile 0.375 (superseded below)

The recorded callable loop/block and interpreted-transfer defects now pass. Continue the confirmed
character-to-logical gap: native as.logical of `c("tRuE"," TRUE ","true","False","T","f")` is
`c(NA,NA,TRUE,FALSE,TRUE,NA)`; NativR differs. Conditional coercion already uses the accepted
spellings, but general vector/option conversion still uses a permissive trim/case-fold helper. Probe
each consumer before sharing a corrected parser; preserve warnings, names, types and missingness.
Keep separate evidence for conversion and condition interpretation.

Additional owned probes confirm the same string gap through as.vector(...,"logical"). Native
storage.mode and mode replacement convert that vector to the same expected values; NativR lacks both
replacement bindings. Invalid mixed-case na.rm in sum and recursive in anyNA produce native "NA in
coercion to boolean"; NativR respectively accepts the value or emits a different diagnostic. These
are reusable vector/scalar conversion gaps. A separate rep(each="tRuE") probe warns about coercion
and retains one copy natively; NativR rejects it. Keep that numeric-conversion boundary distinct
when planning the conversion matrix.

Bytecode-equivalent control remains a required gap. These owned probes reproduce two observations
under GNU R 4.6.1's default compilation, without reading or printing a library body:

```r
(function(){b<-get("break");n<-0L;for(i in 1:3){n<-n+1L;b()};n})()
# Native error: no loop for break/next, jumping to top level. NativR returns 1L.
(function(){e<-new.env();e$n<-0L;makeActiveBinding("while",function(){
  e$n<-e$n+1L;get("while",baseenv())},environment());
  i<-0L;while(i<3L)i<-i+1L;c(i,e$n)})()
# Native c(3L,0L); NativR c(3L,1L).
```

Evaluating the loop expression explicitly with evalq yields 1L and c(3L,1L) respectively on both
runtimes. Preserve that distinction in future compiler/control evidence; do not change the oracle
compiler setting or treat compiled semantics as a platform exclusion. A causal matrix across
ordinary, interpreted, warmed and explicitly compiled owned functions is needed before designing the
corresponding execution policy.

Further reflective adapter/stack-trace work remains. Profile evalq overhead while preserving the
verified frame graph and defaults. Continue constructed subset-call/raw hexadecimal display, complex
attributes, callable defaults, partial-sort/method/tie behavior and confirmed shared corpus
blockers. Independently licensed offline datasets, isolated testing support, complete
domain/callable inventory, browser/OS performance, reproducible CI and release gates remain
required. Linux and holdout execution still need separate authorization. Keep the full goal active
while useful local work remains.

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

### Continuation recorded at profile 0.376 (superseded below)

The recorded logical-string and mode conversion gaps now pass their bounded matrices. Next,
reproduce and close the numeric-coercion warning/fallback gap in rep(each="tRuE"): native warns and
uses one copy while NativR rejects it. Cover scalar types, missing values, length, attributes,
forcing and warning order before sharing a coercion primitive with other callers.

Additional owned probes show that native missing/nonfinite each and length.out controls fall back;
fractional controls truncate; invalid character controls warn; NULL/empty controls warn about the
first element. Explicit length can fill an empty atomic vector with typed missing values (raw with
zero bytes), while NULL retains NULL with a warning. Default replication drops arbitrary class
attributes, supports expressions and rejects pairlists as defunct. A user rep method can run without
forcing its unused times promise. NativR still differs on these cases. Preserve source-order
forcing, length-before-each validation, warning order, names and element identity in the new matrix.

Keep attributed symbol/expression results and full attribute assignment validation in the value
model queue; do not silently discard attributes or broaden the public Worker snapshots incidentally.
Retain the default-native-compilation control differences documented at 0.375, and the outstanding
eval-frame performance cost. Continue browser timing, domain/callable inventory, independently
licensed datasets, isolated testing support and release gates from the original roadmap. Linux
execution and Formula remain separately authorized gates; downloads still require approval. All five
completion criteria remain open; no input is required for the next local semantic work.

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

### Continuation recorded at profile 0.377 (superseded below)

Next close rep.int and rep_len using independently authored native fixtures. Initial observations
show both are closures with x/times or x/length.out formals; they force x before the control even
when actuals are supplied in reverse named order, before dispatching global user class methods.
Further probes show different lookup for locally scoped methods; establish the environment rules.
Default ordinary vectors drop names/unrelated attributes, while class fallback can retain names,
class and class-specific attributes. Preserve factor levels and expression elements as well.
Negative fractions truncate to zero. Blank text differs from invalid text in coercion warnings.
rep_len fills empty vectors and expressions, rejects positive length on NULL, and requires a scalar
length. rep.int has distinct NULL, raw-control, vector-count and missing-argument diagnostics.
Verify these cases against NativR, then implement the shared primitives with resource limits,
foundation evidence and recursive causal controls. Do not copy native function bodies or include
library-body-bearing condition calls in probe output.

Keep exact replication warning-call attribution, general S3 names dispatch and POSIXlt method
bindings in the semantic queue; retain the explicit-timezone constructor and general attribute model
gaps. Preserve the native-compilation control differences recorded at 0.375 and outstanding
eval-frame performance cost. Continue browser timing, domain/callable inventory, independently
licensed datasets, isolated testing support and release gates from the roadmap. Linux execution and
Formula remain separately authorized gates; downloads require approval. All five completion criteria
remain open; no input is required for the next local semantic work.

A separate 36-case owned reproduction matrix passes in native GNU R 4.6.1; 29 cases fail against
NativR 0.377 and seven pass. This matrix is investigative evidence, not added passing conformance.
Concrete examples include rep.int(1:2, -0.9), rep.int(1:2, list(1, 2)), rep.int(NULL, 0L),
rep_len(integer(), 2L), rep_len(expression(x, y), 3L), rep_len(1:2, "3"), attribute stripping,
missing-argument diagnostics and forcing a times error before global method dispatch. Closure
signatures, raw/list controls, warning order and class-specific fallback complete the next bounded
acceptance matrix before the usual full gates and corpus rerun.

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

### Continuation recorded at profile 0.378 (superseded below)

Close general S3 names/names<- dispatch and expose the missing names.POSIXlt/names<-.POSIXlt methods
using independently authored parity fixtures. Native observations demonstrate caller-local and
global methods, default methods, forced-input error ordering, x/value signatures and year component
names with the POSIXlt balance transition. Reproduce NativR failures first, then reuse the bounded
dispatch/replacement primitives and add foundation/recursive evidence before full gates. The initial
independently authored 22-case matrix passes in GNU R 4.6.1; NativR 0.378 passes two cases and fails
twenty. Method-continuation fixtures assert that the method actually ran, so a default-only result
cannot accidentally pass the dispatch check. This is investigative evidence, not passing conformance
credit.

Retain exact replication condition calls, unbound-symbol evaluation, integer diagnostic suffixes,
native compiler differences, omitted/dots NextMethod arguments, explicit time-zone attributes and
the general attribute model in the semantic queue. Continue the measurable thirteen-domain and
callable inventory, independently licensed offline datasets, isolated testing support, browser
timing and release gates. Linux and Formula still require separate authorization; downloads need
approval. The full five-criterion target remains unfinished; the next local semantic work needs no
additional input.

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

### Immediate continuation after profile 0.379

Add the machine-checked callable/domain inventory required by milestone 5, keeping unknown mappings
and incomplete behavioral dimensions explicit. Link the existing registered-name and recursive
causal evidence without converting either into complete callable/domain claims. Preserve the native
active-binding/member-replacement reproduction as an open semantic lead. Resume shared corpus
blockers and the independently licensed offline datasets/testing runner after the inventory exposes
coverage and gaps. Linux and Formula still need separate authorization; downloads need approval. The
full five-criterion target remains unfinished; this next local work needs no additional input.

### Test/config typecheck and package declarations (2026-10-22)

The broader test/config TypeScript errors are repaired. pnpm typecheck:all now runs without emit as
a required pnpm check step; the full check passes 2,222 tests with 93 opt-in skips. The installed
declaration plugin uses bundleTypes, including internal AST/protocol/runtime type definitions.
Strict packed-consumer checking reproduced the missing workspace declarations and passes after the
fix. Offline browser-consumer and package-tools CLI smoke checks pass. All four runtime JavaScript
hashes match the verified 0.379 build, so no semantic-profile bump or repeated native/corpus run is
needed for this typing/packaging increment. Continue the callable/domain inventory next.

### Callable/domain inventory v1 (2026-10-22)

The machine-checked [qualified inventory](callable-domain-inventory.md) now covers all 2,553
bindings in the union of the reference exports and runtime registrations. All 151 causal-linked
bindings have domain assignments and explicit remaining gaps. Another 2,402 bindings need
classification. All thirteen domains remain incomplete; empty behavioral matrices stay pending.
Fifty-three owned validator fixtures pass, and inventory validation is required by pnpm check and
canonical status. Source hashes and case links are declarations, not a substitute for recorded
passing oracle gates. The integrated full check passes 2,222 unit tests with 93 opt-in skips, plus
those 53 validator tests.

Next measurable inventory step: classify remaining core-namespace exports by semantic purpose,
retaining absent runtime registrations and explicit gaps, then audit bounded matrix declarations
against maintained tests and passing evidence. Continue shared semantic blockers, dataset/testing
support and browser/platform gates. Linux and Formula remain separately authorized boundaries.

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

### Next measured platform increment

Profile the required WebKit Worker-example test at the existing 120-second budget. The preserved
failure trace shows substantial click actionability/stability waits; measure frame cadence, button
geometry and evaluation timing before choosing a fix. Preserve network-free execution assertions,
real UI interaction, and all examples. Then refresh the declared browser matrix. Continue the
remaining semantic domains, callable classification, independent datasets and isolated runner. The
full five-criterion goal remains unfinished. No additional input is needed for this local work;
Linux, Formula and new downloads retain their separate authorization boundaries.

### Windows browser verification after profile 0.380

All nine maintained browser tests pass with one worker across cached Chromium, Firefox and WebKit.
Required examples take 10.4 / 11.7 / 41.5 seconds within the unchanged 120-second budget. An
unchanged isolated WebKit baseline also passes in 42.6 seconds. Current frame/geometry measurements
do not reproduce the historical half-second click-stability waits, so no product or test workaround
was introduced. Source hashes, browser revisions and redacted timings are retained in
[the browser checkpoint](../compatibility/platform-evidence/browser-windows-0.380.0.json).

Next performance work measures public Worker startup, interrupt rejection separately from Worker
restart/recovery, and cached numDeriv workloads. Small arithmetic activation timing is not evidence
of representative package performance. The broader browser/OS and separately authorized Linux gates
remain incomplete.

### Repeated Windows performance and offline packaging (2026-10-22)

The profile 0.380
[performance checkpoint](../compatibility/platform-evidence/performance-windows-0.380.0.json)
records seven fresh-context starts, seven same-document starts and seven interruption/recovery
cycles per cached browser, plus two warmups and nine samples for each of five owned numDeriv
workloads. All value, state-reset, profile, external-request and artifact-stability assertions pass.
The runner and its 37 validation/redaction tests are maintained and wired into pnpm check. These
measurements are advisory; no new latency budget, package tier or platform completion is inferred.
The
[offline packed-consumer checkpoint](../compatibility/platform-evidence/pack-windows-0.380.0.json)
also passes strict declarations, browser build and package-tools CLI against current tarballs.

Next bounded semantic step: reproduce and implement difftime units access/replacement using owned
native fixtures, all five concrete units, attributes, argument matching, visibility and lazy S3
dispatch; then rerun prettyunits and the required semantic gates. Continue numeric predicates,
remaining domain evidence, independently sourced datasets and isolated testing support. Linux,
Formula, new downloads and remote publication retain their existing authorization boundaries.

### Profile 0.381 verification (2026-10-22)

Implemented units/units<- and their difftime methods through shared argument, S3, attribute and
arithmetic paths. All 132 owned native parity fixtures and a resource-limit/recovery test pass.
Evidence covers all 25 concrete conversions, ratio-first scaling, empty and complex values,
attributes/reference identity, visibility, lazy dispatch, omitted actuals and NextMethod. Eleven
native gap probes retain classed/malformed unit metadata and implicit storage-class dispatch work;
this is bounded evidence, not complete difftime or S3 compatibility.

The full check passes 2,463 unit tests with 93 opt-in skips, both TypeScript gates, 53 inventory
validators and 37 browser-report validators. Checked-in/live/recursive conformance passes 1,396 /
1,327 / 310 with 157 causal-linked bindings. The subsequent partial-checkpoint integrity suite
passes 28 tests. Client and Worker gzip sizes are 17.6/150 and 485.8/512 KiB; parser and elementary
Wasm remain 671.9/1,536 and 311.2/384 KiB raw. The inventory classifies 587 of 2,553 bindings; 1,966
remain pending and all thirteen domains remain incomplete. Name overlap 787/2,522 is not a
completion percentage.

The [affected-package checkpoint](../compatibility/package-check-evidence/corpus-0.381.0.json)
reruns prettyunits with its pinned archive, original entrypoints and native repeatability. All nine
input hashes are unchanged and observations repeat. pretty_dt and vague_dt now match; time_ago
completes with a mismatch. Seven of eight examples execute, six match, and pretty_p_value becomes
the first P5 blocker. prettyunits remains P4; the other 23 non-holdout entries retain complete 0.380
evidence. Pins, partitions and Formula are unchanged. Browser, performance and offline pack evidence
remain at 0.380; no public API or Worker protocol changed.

Next measurable increment: reproduce and close the bounded is.finite/is.infinite/is.nan primitive
matrix with shared forcing, S3 dispatch, attributes, resource limits and recursive causal evidence;
then rerun prettyunits and required semantic gates. Preserve mixed-component complex NA and POSIXlt
method gaps explicitly. Continue the full five-criterion goal, including independent datasets,
isolated testing support, remaining domain matrices and platform verification. No additional input
is needed for this local work. Linux, Formula, downloads and remote actions retain their boundaries.

### Profile 0.382 verification (2026-10-22)

Implemented shared is.finite/is.infinite/is.nan primitives with eager source-order forcing, exact
argument tags, visible owned S3 methods and NextMethod fallback. All 68 owned tests pass, covering
real/integer/logical/character/raw/NULL classification, ordinary complex component combinations,
names and dimensions, diagnostics, metadata, reference identity and session-limit recovery. Six
native gap probes preserve mixed-component complex NA and POSIXlt method limitations. S4 and full S3
continuation/condition origins remain incomplete.

The full check passes 2,532 tests with 93 opt-in skips, both TypeScript gates, 53 inventory tests
and 37 browser-report tests. Checked-in/live/recursive conformance passes 1,405 / 1,336 / 320 with
160 causal-linked bindings. The Worker is 486.2/512 KiB gzip; client and Wasm sizes remain within
their unchanged limits. The inventory classifies 590 of 2,553 bindings, with 1,963 pending; all
thirteen domains remain incomplete. Distinct-name overlap 789/2,522 does not measure completion.

The [complete 0.382 checkpoint](../compatibility/package-check-evidence/corpus-0.382.0.json) reruns
all 24 cached development/regression packages with original entrypoints and native repeatability.
All 178 input hashes and execution/comparison/repeatability outcomes match the prior evidence:
prettyunits at 0.381 and the other packages at 0.380. Tiers are unchanged, including two P7 packages
and prettyunits P4. All 29 saved-checkpoint integrity tests pass. pretty_p_value now reaches the
missing formatC binding; time_ago still mismatches. The withr timezone repeatability failure remains
explicit. No pins, partitions or Formula changed, and no substitute testing runner receives tier
credit. Browser/performance/pack evidence remains at 0.380; public API and Worker protocol are
unchanged.

Next measurable work: correct the recursive observer's conflation of mixed-component complex NA with
whole NA, without claiming the runtime representation is fixed; classify remaining owned
registrations by domain; then close reusable formatC behavior behind prettyunits' next blocker.
POSIXlt predicates require a shared conversion/dispatch increment. Their primary calendar fields,
normalization and UTC/GMT behavior need independent evidence; inspecting only seconds is
insufficient. The complex value-model repair also requires lossless structural/serialization paths
and a deliberate API/Worker compatibility design before enabling new component masks. Continue
remaining domains, independently licensed datasets and isolated testing support. Linux, Formula, new
downloads and remote actions retain the existing boundaries. No additional input is needed for the
current local observer, inventory or formatting work.

### Registered callable classification at profile 0.382

All 816 runtime registrations now have explicit domain assignments. The 572 newly reviewed entries
cover 441 base, 76 stats and 55 utils bindings in 60 owned-purpose families. Independent review
separated formula construction from numeric design matrices and identity's force/return behavior
from equality/missingness. Existing annotations, matrices, case links and exclusions are unchanged.

The generated inventory classifies 1,162 of 2,553 bindings, leaving 1,391 reference bindings
pending. All 2,553 bindings and all thirteen domains remain incomplete. The 53 validator tests and
generated inventory/status checks pass. This metadata increment adds no runtime behavior or
compatibility credit. Continue classification of unregistered reference bindings using documented
public purpose, the observer repair, shared formatting and remaining domain matrices.

### Recursive complex observation correction at profile 0.382

The owned observer now emits whole-complex NA only when both component tokens are NA. Mixed
component values retain their existing component-token schema. An independent native preflight
checks 49 ordered pairs plus whole NA; the previous observer conflated ten of those pairs. The JS
decoder rejects untagged raw complex payloads instead of losing their values through typed-array
coercion. Six pure decoder tests and all five focused inline/native observer tests pass.

The full check passes 2,534 tests with 94 opt-in skips; the corrected live recursive gate passes all
320 existing cases and all controls for 160 linked bindings. No existing case or causal claim was
weakened. All ten production JavaScript/Wasm hashes are unchanged, so runtime profile 0.382, the
public API, Worker protocol and current corpus evidence remain unchanged. Runtime component NA
storage and lossless public values still need separate work; an observer preflight grants no runtime
compatibility credit.

Continue the native-backed formatC matrix and affected prettyunits repeatability, then the shared
POSIXlt conversion/dispatch and remaining semantic-domain work. The full five-criterion goal remains
unfinished. Local commits remain authorized; downloads, Linux, Formula and remote actions retain
their existing boundaries.

### Bounded formatC increment (profile 0.383)

Implemented reusable numeric/printable-character formatting with fifteen lazy formals, observed
coercions, flags and widths, precision caps, nonfinite alignment, metadata retention and explicit
resource limits. All 132 focused tests pass: 128 native-backed fixtures, an independent exact
high-precision regression and three resource/deferred-behavior tests. Nine native gap probes retain
optional controls and the Windows high-precision discrepancy; exact binary64 input bits and an
independent rational expansion distinguish that discrepancy from a parser error. Linux verification
remains deferred. The shared exact floating formatter is unchanged.

The full check passes 2,666 tests with 94 opt-in skips, both TypeScript gates and all validators.
Checked-in/live/recursive conformance passes 1,416 / 1,347 / 331 with 161 causal-linked bindings.
The Worker is 488.0/512 KiB gzip; all bundle limits pass. The inventory assigns all 817 registered
bindings and 1,163 of 2,553 total bindings, leaving 1,390 pending; seven bindings have 42 partial
dimensions. All thirteen domains remain incomplete. Both profile identifiers and generated reports
agree. Public API and Worker protocol are unchanged; browser/performance/pack evidence remains at
0.380.

The [affected-package checkpoint](../compatibility/package-check-evidence/corpus-0.383.0.json)
reruns the pinned prettyunits archive with original entrypoints and native repeatability. All nine
input hashes are unchanged. All eight examples execute and seven match, including pretty_p_value;
time_ago still mismatches. prettyunits advances from P4 to P5, with its test stage now the first
blocker. The other 23 non-holdout packages retain the complete 0.382 evidence. The subsequently
extended saved-checkpoint integrity suite passes all 30 tests. No substitute runner, partition or
pin changes receive tier credit.

Next measurable increment: close the confirmed early width/precision allocation gap in sprintf using
bounded arithmetic, aggregate output accounting and cancellation/recovery evidence. Preserve
ordinary C99 behavior and distinguish unbounded recursive list/deparse work explicitly. Then close
the reusable POSIXlt conversion/dispatch prerequisite for numeric predicates; seconds-only
classification is insufficient. Continue all five completion criteria and the remaining domain,
dataset, testing-runner and platform work. No new user input is needed for these local steps.

### Bounded sprintf resource increment (profile 0.384)

Closed the reproduced intermediate-width/precision and aggregate formatted-output gap. Deterministic
scanning checkpoints long fields and directives; the exact formatter bounds decimal arithmetic and
preflights expanding zero tails. UTF-8 accounting includes literals, conversions and vector rows,
with correct same-row surrogate pairing and padding boundaries. Huge short-output precision remains
bounded. Recursive list/language early text construction, full native grammar and Unicode field
semantics remain explicit gaps.

All 200 focused tests pass (37 pure formatter, six resource/recovery, 25 native parity, 132
formatC). The full check passes 2,736 tests with 94 opt-in skips and both TypeScript gates.
Checked-in, live and recursive conformance pass 1,425 / 1,353 / 337, with 162 causal-linked
bindings. The full
[24-package checkpoint](../compatibility/package-check-evidence/corpus-0.384.0.json) preserves all
178 script hashes, outcomes, stage statuses and repeatability flags; tiers and partitions are
unchanged. Formula remains untouched. The browser suite passes 9/9 with Worker errors/recovery and
no evaluation network traffic; its checkpoint records exact source/runtime hashes. Required examples
take 12.0 / 15.4 / 59.5 seconds within the unchanged timeout. All bundle caps pass; Worker gzip is
489.0/512 KiB. Performance and pack evidence remain at 0.380.

The inventory retains 817 registered and 1,163 classified bindings, with 1,390 pending; eight
bindings now have 48 partial dimensions. All thirteen domains and the five completion criteria
remain open. Public API and Worker protocol are unchanged.

Next measurable increment: implement shared bounded UTC/GMT POSIXlt-to-POSIXct conversion, lazy
as.POSIXct generic/numeric/default/POSIXlt routes and the three numeric-predicate methods. Reuse the
independent calendar, metadata, forcing, warning and dispatch fixtures, add resource recovery and
recursive causal evidence, and explicitly reject unsupported calendar ranges/timezones. Preserve
existing character conversion and input identity; defer standalone Date method metadata without
behavior. Then continue the remaining domain, dataset, testing-runner and platform work under the
existing download, Linux, holdout and remote-action boundaries. No input is needed for this step.

### Distribution purpose inventory review (2026-10-22)

Classified 65 reference-only stats distribution bindings from 23 public documentation topics using
only observable titles and aliases. The
[review record](../compatibility/callable-purpose-evidence/stats-distributions-4.6.1.json) maps
exact qualified names to those topics. Explicit gaps retain numerical, vector/shape, RNG, error and
metadata work. Existing assignments and all behavioral evidence remain unchanged.

The inventory has 1,228 classified bindings and 1,325 pending; all 817 registered bindings remain
assigned. This purpose-only increment leaves profile 0.384, callable overlap, 162 causal links, 48
partial dimensions and all incomplete domains unchanged. It was verified with inventory validators
and generated inventory/status consistency checks. The active semantic step remains bounded UTC/GMT
POSIXlt conversion and dispatch.

### Bounded POSIXlt conversion increment (profile 0.385)

Implemented shared UTC/GMT POSIXlt conversion, lazy as.POSIXct generic/numeric/default/POSIXlt
routes and three numeric-predicate methods. The converter preserves observed storage, masks, year
names, attributes, warning/validation order, missingness and reference results. Independent
Gregorian arithmetic admits the documented wide-year range and explicitly rejects unsupported finite
fields. Empty-zone arithmetic is deterministic UTC; named timezone/DST parity, broad parsing, vector
origins and full implicit S3 chains remain unfinished.

All 206 focused tests pass (191 native fixtures, four strict conversion-order regressions, eight
shared arithmetic cases and three range/resource/recovery cases), alongside 144 existing related
regressions. The full check passes 2,943 tests with 94 opt-in skips and both TypeScript gates.
Checked-in/live/recursive conformance passes 1,447 / 1,374 / 360, with 169 causal-linked bindings.
The separate native fixture validation passes 286 checks; 22 maintained native gap controls plus
three arithmetic/coercion gap families receive no passing compatibility credit. Separate arithmetic
validation passes thirteen native checks; its exact graph case has no qualified operator-binding
credit. Seven matrices add 42 partial dimensions, bringing the inventory to 90 across fifteen
bindings. All thirteen domains remain open.

The [24-package checkpoint](../compatibility/package-check-evidence/corpus-0.385.0.json) preserves
all 178 input hashes, outcomes, stage statuses and repeatability flags from 0.384. Tiers remain
unchanged and Formula was not evaluated. Worker browser checks pass 9/9, including UTC/nonfinite and
wide-year fractional conversion without network traffic. Required examples take 12.5 / 16.1 / 53.7
seconds within the unchanged timeout. Worker gzip is 491.1/512 KiB; all bundle caps pass.
Performance and pack evidence remain at 0.380. Public API and protocol are unchanged.

Next measurable increment: close the independently reproduced implicit S3 class-chain gap shared by
UseMethod/NextMethod and conversion generics. Establish integer/double numeric fallback,
matrix/array storage chains, explicit-class precedence and method metadata with independent native
fixtures and causal controls. Keep internal/group-generic dispatch rules distinct and preserve the
original input identity. Continue the wider semantic-domain, dataset, testing-runner and platform
work under the existing boundaries; no new user input is required for this local step.

### Date/time purpose inventory increment (2026-10-22)

Classified 119 previously pending reference bindings from 32 public GNU R 4.6.1 help titles and
alias lists. Twenty-six families cover Date/POSIX/difftime methods, calendar helpers, direct
timezone/timestamp APIs and time-series representation. Exact provenance is retained in the
[purpose review](../compatibility/callable-purpose-evidence/data-time-4.6.1.json); existing
annotations remain unchanged. No implementation bodies or examples were development inputs.

The inventory now has 1,353 assigned and 1,200 pending bindings. Runtime registrations, causal
links, matrix dimensions, profile 0.385 and corpus tiers are unchanged. All domains and callable
matrices remain incomplete. The active semantic step is the bounded implicit S3 class-chain fix. All
53 inventory validators and generated inventory/status checks pass; independent review confirms the
exact documentation aliases and preservation of every previous annotation.

### Bounded implicit S3 class-chain increment (profile 0.386)

Closed the reproduced implicit-chain failures for ordinary UseMethod and modeled units, units<- and
as.POSIXct generics. Integer/double numeric fallback, matrix/array storage chains, explicit-class
precedence, .Class suffix/previous history and initial-versus-reached default metadata use a scoped
policy. Original arguments and references are preserved. Internal/group generics and public
class()/inherits() retain their separate behavior. Missing-method searches, environment traversal
and metadata copies obey the runtime's step/allocation limits and recover after failures.

The baseline had 37 failing bounded cases plus sixteen passing cases/guards. All 56 new tests now
pass, including three resource/recovery cases; the combined related run passes 628. Native candidate
validation passes 98 checks, including 28 strict causal controls. Seven foundation and eight exact
recursive groups extend evidence. Five annotation matrices merge 21 partial links, resulting in 107
partial dimensions across nineteen bindings. The 21 neighboring native observations remain separate,
with no passing compatibility credit. All thirteen domains remain incomplete.

Full pnpm check passes 3,000 tests with 94 opt-in skips, both type gates and all validators.
Checked-in/live/recursive conformance passes 1,454 / 1,381 / 368, with 169 causal-linked bindings.
The [24-package checkpoint](../compatibility/package-check-evidence/corpus-0.386.0.json) preserves
all 178 inputs/outcomes/stages/repeatability flags from 0.385. Browser checks pass 9/9 with no
evaluation network traffic; required examples take 12.5 / 15.1 / 56.3 seconds under the existing
timeout. Worker gzip is 491.4/512 KiB. Public API/protocol and all boundaries remain unchanged.

Next measurable increment: fix explicit UseMethod selectors so selecting a method does not replace
or inject original call arguments. Verify original promises, names/order, laziness, reference
identity and NextMethod continuation with independent native cases and exact causal evidence. Keep
omitted-dispatch/default and other neighboring gaps separate until independently addressed.

### Explicit UseMethod selector increment (profile 0.387)

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

Next measurable increment: reproduce omitted-selector behavior for zero actuals, generic defaults
and literal missing arguments. Preserve original promises, method defaults, local-reassignment
behavior and references. Admit only independently verified NULL or missing-symbol dispatch cases;
keep forwarded-missing diagnostics, nonlocal return and visibility separate. Continue all wider
completion work under the existing boundaries. No user input is needed for this local step.

### Omitted UseMethod selector increment (profile 0.388)

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
caps pass. Performance and pack evidence remain at 0.380. Public API/protocol, holdout, Linux,
download and remote-action boundaries remain unchanged.

Next measurable increment: promote the repeated offline abind/numDeriv evidence procedure into
maintained tooling with explicit cached inputs, pin/profile/artifact checks, repeatability, raw
output quarantine and safe redacted reports. Distinguish valid blocked package evidence from
infrastructure failures. Then advance the isolated clean-room runner using a separate versioned
assisted-report contract that cannot confer original P6/P7 credit. Continue bounded S3 control-flow
and all wider domain work afterward. Local configuration/tooling work needs no new approval;
downloads, Linux execution, holdout evaluation and remote actions retain their existing boundaries.

### Shared optional-oracle discovery (development tooling)

The two native conformance commands and package checker now use one tested executable resolver. CLI
selection takes precedence over NATIVR_RSCRIPT, then PATH and Windows per-user/system installations.
Empty, invalid or unavailable explicit choices fail rather than falling back or silently skipping
evidence. Availability probes are bounded, shell-free and metadata-only; each caller retains its
exact GNU R 4.6.1 gate. Package checking requires an oracle before preparing an archive, while
optional conformance absence remains an explicit skip.

All 41 owned unit/CLI checks pass, including wrong-engine rejection after a successful availability
probe. A live metadata-only check confirms that explicit selection and automatic per-user discovery
with PATH empty choose the installed oracle. The full check passes 3,044 unit tests with 94 opt-in
skips, both typechecks, build, generated-report checks and fixed bundle caps. The current browser
checkpoint remains bound to the same source/runtime artifacts. No runtime semantics changed; profile
0.388 and its existing conformance/corpus evidence remain unchanged. R13 is closed locally.

Next measurable increment remains the offline abind/numDeriv evidence command: validate exact cached
pins and observation inventories, keep raw output quarantined, reject assisted reports and
distinguish complete blocked-package evidence from infrastructure failures. Complete its independent
review and local execution before committing. Isolated testing-runner development continues against
independently authored fixtures; original P6/P7 credit remains separate.

### Canonical CI configuration and offline packed consumer

Main CI configuration now invokes the canonical `pnpm check` and retains its additional coverage
gate. Packed-consumer smoke reuses that verified build with `--skip-build`. This is a local
configuration change; no workflow was pushed or executed remotely. Cross-platform and browser
evidence requirements remain open.

The
[0.388 offline packed-consumer checkpoint](../compatibility/platform-evidence/pack-windows-0.388.0.json)
records both tarball hashes and smoke-script inputs. With offline dependency resolution enabled,
strict public declaration checking, the browser consumer build and the package-tools tarball CLI
pass. No emitting build ran during the smoke. Performance measurements still need refreshing from
0.380, and this packaging result does not establish publication or broader OS readiness.

### Browser performance refresh at profile 0.388

The maintained full harness passes all three cached engines using pinned numDeriv inputs and the
verified production build. The
[redacted checkpoint](../compatibility/platform-evidence/performance-windows-0.388.0.json) contains
seven fresh-context and seven same-document startups, seven cancellation/recovery samples, and two
warmups plus nine measured samples for each of five owned package workloads per engine. All
correctness checks pass, runtime/tool hashes remain stable, and no external requests or page errors
occur. Fresh-context createR medians are 56 / 116 / 87 ms; complete post-interrupt recovery medians
are 68.4 / 116 / 94 ms for Chromium / Firefox / WebKit. Zero-valued measurements reflect clock
resolution. These are exploratory observations; release latency budgets, broader OS evidence and
optimization of the required-example workload remain unfinished. No timeout or bundle cap was
changed. Performance and packed-consumer evidence are now both current at 0.388.

### Maintained offline original-package evidence

`pnpm evidence:packages` now provides a read-only preflight and an explicit offline run for the
pinned development/regression abind and numDeriv archives. It requires an existing GNU R 4.6.1
oracle, validates the full observation inventory and original-runner identity, and checks source,
tool, archive, executable and build hashes before and after execution. Raw child output is bounded
and quarantined; only allowlisted summaries and hashes are retained. Blocked package evidence is
accepted only when complete and internally consistent. Assisted-runner evidence cannot confer
original-package tier credit through this command.

The
[verified local checkpoint](../compatibility/platform-evidence/offline-packages-windows-0.388.0/index.json)
records 487 stable artifact inputs. All 21 observation records and package stage results match the
accepted 0.388 baseline. abind retains ten matching, repeatable observations and P7 eligibility;
numDeriv retains five matches, six mismatches and two nonrepeatable observations, with test-output
as its first blocker. The checkpoint is advisory Windows evidence and does not promote corpus tiers
or satisfy the deferred normative Linux gate.

All 62 independent tooling tests pass, including bounded child output, process-tree cleanup,
contradictory P7 rejection, mixed-runner rejection, canonical report bytes and report digest checks.
The full canonical check passes 3,044 unit tests with 94 opt-in skips, both typechecks, builds,
generated reports and unchanged bundle limits. Runtime semantics and profile 0.388 are unchanged.

Next measurable increments: verify direct S3 dispatch's nonlocal return, method visibility and
cleanup against independently authored native cases, preserving NextMethod continuation; finish the
isolated testing runner's strict host projection, adversarial fixtures and native parity review.
Keep runner-assisted evidence separate from original dependency-closure and P6/P7 evidence. All
broader domain and platform completion criteria remain open; current local work needs no new input.

### Direct UseMethod completion (profile 0.389)

The stable 0.388 baseline reproduced all 21 proposed completion/visibility defects; eight
preservation controls already passed. Direct dispatch now preserves the selected method's complete
result and returns to the captured generic closure target through existing cleanup machinery.
Pending statements, assignments and arithmetic do not resume inside the generic. The caller and
ordinary NextMethod continuation still resume. Method/generic cleanup order, explicit cleanup
returns, original promises, attributes and reference identity retain their bounded observations.

All 31 focused tests pass, including step/depth exhaustion and recovery, alongside 206 related
regressions. Five foundation groups and five recursive graphs add ten links across six UseMethod
dimensions, including a new visibility dimension. Totals are 108 partial dimensions on nineteen
bindings and 169 causal-linked bindings; no callable or domain is complete. Independent native
validation passes 49 assertions including ten strict causal controls. Seven neighboring context and
NextMethod visibility observations remain explicit exclusions from this claim.

The full canonical check passes 3,076 unit tests with 94 opt-in skips, all tooling tests, both
typechecks, serial build, generated reports and fixed caps. Checked-in/live/recursive conformance
passes 1,467 / 1,394 / 382, with 55 NativR-only live skips. The 24-package checkpoint retains all
178 input hashes, execution/comparison outcomes and stage statuses from 0.388, with unchanged tiers.
The withr timezone repeatability flag changes from true to false while execution still fails; this
variation receives no compatibility credit. Formula remains untouched.

The [Windows browser checkpoint](../compatibility/platform-evidence/browser-windows-0.389.0.json)
passes 9/9 with direct return, invisibility and ordered cleanup through the Worker and no evaluation
network traffic. Required examples take 12.8 / 15.9 / 57 seconds under the unchanged 120-second
budget. An initial UI interruption fixture was rejected because Chromium exhausted the default step
budget before its click, and WebKit also timed out. The final maintained cancellation fixture
instead uses the existing public-API performance harness and explicit test budget, without changing
product limits.

The
[repeated performance checkpoint](../compatibility/platform-evidence/performance-windows-0.389.0.json)
passes all three engines, including seven selected-method interruption/recovery samples each. It
checks NRL4005/reset, sentinel and generic state loss, zero frames and a fresh invisible finite
generic. Pending status is verified after the existing 100 ms delay; no method-entry acknowledgement
or cleanup-after-termination guarantee is inferred. The changed recovery workload precludes a direct
total-recovery timing comparison to 0.388. All runtime/tool hashes remain stable, external requests
and page errors are zero. Pack evidence remains at 0.388; public API/protocol and bundle caps are
unchanged.

Next measurable increments: promote the reviewed isolated own-name runner with bounded host capture,
per-API parity qualifiers and owned-fixture-only acceptance; retain explicit unsupported behavior
and zero original P6/P7 credit. Then close the independently reproduced loop-context admission gap
for UseMethod, preserving rejection before selector forcing and valid generic calls from
loop/evaluation callers. Wider domain closure, provenance-backed datasets, browser/OS coverage and
release gates remain unfinished. Current local work needs no new input; download, holdout, Linux and
remote-action boundaries remain unchanged.

### Maintained optional testing foundation (runner 0.1.0, profile 0.389)

The independently authored `nativrTest` bundle now lives under `testing/nativr-test-runner/` with an
explicit behavior contract, per-API support labels, pinned owned fixtures and separate historical
native references. The offline `testing:assisted` command accepts only the owned core suite. It
binds source/bundle/configuration/runtime identities, rejects malformed or incomplete capture and
writes a separate assisted report. Existing output directories, path escapes and linked ancestors
are rejected. The original-package evidence validator rejects assisted reports.

The 28 core behavior cases and inventory check pass, as do all 86 host/CLI tests. Nine built-runtime
acceptance scenarios preserve deliberate failures, unsupported calls, skipped tests, cleanup and
ordinary errors, reporter aborts and rejected runtime/outer-effect capture. Two final runs match
their expected outcomes. Browser Worker coverage independently checks pass/failure/unsupported,
reporter abort and same-Worker recovery under the existing CSP and timeout.

The full canonical gate passes 3,105 unit tests with 94 opt-in skips, both typechecks, tooling,
serial build, generated checks and unchanged bundle limits. Runtime profile, capabilities, public
API and protocol remain unchanged. No original package tier or callable/domain credit is granted.
Checked-in/live/recursive conformance passes 1,467 / 1,394 / 382, with 55 NativR-only live skips;
the complete browser suite passes 12/12. The
[owned checkpoint](../compatibility/assisted-testing-evidence/owned-core-windows-0.389.0/index.json)
and its separate verification record retain all nine outcomes, repeated digests and stable inputs.
The [runner guide](assisted-testing-runner.md) documents explicit gaps: real-testthat API parity,
comparison/snapshot support, discovery/helpers, broader conditions and package/dependency admission.

The next 38 independently native-verified loop-context fixtures reproduce sixteen defects on the
stable 0.389 runtime, with twenty-two passing controls and no exceptions. Fifteen defects concern
active-loop admission; one concerns generic-first forcing with reversed named arguments. Next
measurable semantic increment: correct direct UseMethod admission before selector forcing while
preserving valid inner generic calls, cleanup and original promises. Add bounded foundation and
recursive causal evidence, rerun all semantic gates and affected cached package checks, then commit
locally. Full compatibility, further datasets, original package testing, OS coverage and release
gates remain open. No new user input is required for this local increment.

### UseMethod loop-context admission (profile 0.390)

The independently observed 38-case matrix closes sixteen reproduced defects and retains twenty-two
passing baseline guards. Generic matching/evaluation now precedes the same-closure loop admission
check; rejected contexts do not force selectors or original dispatch promises or enter methods. For
sequences, completed loops, helper generics and first-class aliases retain their observations. All
39 focused tests pass, including cleanup, zero frames and subsequent invisible finite dispatch in
the same session. Existing step/depth exhaustion tests remain in the direct-completion suite.

Three foundation groups retain all 38 assertions; three exact recursive groups retain 25
observations with strict causal controls. The new partial errors dimension, following 0.389's
visibility dimension, gives 109 partial dimensions on nineteen bindings. There remain 169
causal-linked bindings; no domain or callable is complete. Forced-argument/evaluation contexts,
malformed generic diagnostics, full condition origins and direct NextMethod visibility remain open.

The canonical check passes 3,144 unit tests with 94 opt-in skips, both typechecks, tooling, serial
build and fixed bundle caps. Checked-in/live/recursive conformance passes 1,470 / 1,397 / 385, with
55 NativR-only live skips. Client/Worker gzip sizes are 17.6/491.6 KiB; parser and elementary Wasm
are 671.9/311.2 KiB raw, all below unchanged limits. The
[Windows browser checkpoint](../compatibility/platform-evidence/browser-windows-0.390.0.json) passes
12/12, including same-Worker loop rejection and invisible recovery. Required examples take 11.4 /
15.7 / 42.0 seconds for Chromium / Firefox / WebKit under the unchanged 120-second budget.

The
[two-package checkpoint](../compatibility/platform-evidence/offline-packages-windows-0.390.0/index.json)
rechecks original abind and numDeriv entrypoints against 0.389, preserving all 21 observations and
stage outcomes with stable inputs. abind retains P7 eligibility; numDeriv retains its test-output
blocker. This is a regression-pair refresh, not a rerun of the full 24-package corpus, which remains
recorded at 0.389. Formula, pins and partitions are unchanged. Performance evidence remains at 0.389
and packed-consumer evidence at 0.388. The separate nativrTest evidence grants no original
dependency-closure or P6/P7 credit.

Next steps remain independently reproducing the neighboring evaluation/forced-argument dispatch
contexts, extending the isolated runner's documented parity, and closing the broader semantic and
platform ledger. Linux, holdout, downloads and remote actions retain their existing boundaries.

### Interpreted UseMethod promise-origin admission (profile 0.391)

The 22 independently native-verified assertions reproduce ten defects on 0.390 and retain twelve
passing guards. The evaluator now compares the explicit expression origin with the active
interpreted closure only when its exact function target is current. A foreign forced expression
raises the observed context error after generic-name evaluation and before selector/original
forcing. Own-default evaluation, unused actuals, ordinary inner generic entry, reference identity
and ordered helper/generic cleanup retain their bounded observations. No native-wrapper or
library/evaluation admission claim follows from this change.

All 23 source tests pass. One is an explicitly NativR-only session guard: the same retained promise
fails, retries successfully after an owned flag changes, then returns its cached value; cleanup,
zero frames and a fresh invisible generic verify recovery. Native interrupted-promise restart
warnings are not covered by that guard. Three foundation and three exact recursive groups retain 22
assertions and 21 raw components. Native assembly validation passes all six groups, all components
and six strict causal controls. Those controls apply to three composite binding associations, not 21
independent per-component causal proofs. Six new links extend ordinary, boundary, error and
side-effect declarations; 109 partial dimensions on nineteen bindings and 169 causal-linked bindings
remain unchanged. No complete callable or domain is claimed.

The canonical check passes 3,167 unit tests with 94 opt-in skips, both typechecks, tooling, serial
build and fixed bundle caps. Checked-in/live/recursive conformance passes 1,473 / 1,400 / 388, with
55 NativR-only live skips. Client/Worker gzip sizes are 17.6/491.6 KiB; parser and elementary Wasm
are 671.9/311.2 KiB raw, all below unchanged limits. The
[Windows browser checkpoint](../compatibility/platform-evidence/browser-windows-0.391.0.json) passes
12/12. Four assertions added inside the existing Worker test verify context rejection before
selector/original effects, ordered helper/generic cleanup, a valid generic through the helper and
own-default preservation. Required examples take 11.3 / 12.7 / 50.1 seconds for Chromium / Firefox /
WebKit under the unchanged 120-second budget; this is not a new performance benchmark or
visibility-equivalence claim.

The
[two-package checkpoint](../compatibility/platform-evidence/offline-packages-windows-0.391.0/index.json)
uses the maintained 0.389 full-corpus baseline accepted by the CLI and additionally agrees with the
0.390 partial pair: all 21 observation objects and stage arrays match, including repeatability.
abind retains ten matching observations and P7 eligibility. numDeriv retains five matches, six
mismatches, two nonrepeatable observations and its test-output blocker. Source pins and regression
partitions are unchanged. The complete 24-package corpus remains at 0.389, performance at 0.389 and
packed-consumer evidence at 0.388. Formula remains untouched; isolated-runner results receive no
original package-tier credit.

Next work remains independently reproducing native-wrapper/library and evaluation-context admission,
extending the isolated runner's documented parity, and closing the semantic and platform ledger.
Full condition origins, arbitrary generic diagnostics, direct NextMethod visibility and complete S3
behavior remain unfinished. Linux, holdout, downloads and remote actions retain their existing
boundaries.
