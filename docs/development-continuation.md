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
checker repairs form the next independently verified local increment.

The sweep also reproduced an explicitly missing positional argument in `person()` as a shared
Authors@R blocker. Add it to the argument-matching increment. A supplemental
`tsc -p tsconfig.eslint.json` run found errors in existing test fixtures (resource limits, snapshot
types, graphics options and a Playwright tuple); it is not the normal production typecheck gate and
needs separate cleanup before being adopted as a gate.

### Immediate continuation

Finish Milestone 2 before declaring it complete. Integrate loaded namespace signature/export
metadata into documentation checks; keep unknown signatures and failed observations unexecuted. An
`args()` signature stub has a NULL body and can supply formals without printing implementation
bodies. Reject unexpected stub shapes, retain only bounded metadata/digests in reports, and use
independently authored computed-definition fixtures. Continue reproducing Rd usage, links and macro
failures. Then proceed to factor printing/addNA and shared argument matching, including the
confirmed person() missing-slot case. No datasets, substitute test runner, holdout or Linux gate has
been completed by these two increments.
