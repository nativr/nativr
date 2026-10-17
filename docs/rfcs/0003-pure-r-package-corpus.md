# RFC-0003: pinned pure-R package corpus

Status: **accepted; implementation in progress**

## Corpus partitions

- **development** packages may identify semantic gaps and guide implementation;
- **regression** packages have reached a declared tier and must not regress;
- **holdout** packages are not used to guide implementation before their scheduled evaluation.

Moving a package out of holdout is a recorded corpus revision. All source URLs, versions, dependency
closures, source-archive SHA-256 digests, and evaluated NativR artifact SHA-256 digests are pinned.
The two digest domains are recorded separately; live repository state cannot redefine the corpus.

The first holdout rotation evaluated `assertthat 0.2.1` and `crayon 1.5.3`. Their initial P2
blockers led to reusable standard-`tools` dependency handling and a hidden, read-only
source-resource context for standard package `tools/` files. Both now reach P4 through unchanged
public source and have moved to regression. `praise 1.0.0` and `prettyunits 1.2.0` replace them as
uninspected P0 holdouts.

The second holdout rotation evaluated `praise 1.0.0` and `prettyunits 1.2.0` without first using
their R source to guide implementation. Both now reach P4 through unchanged public source. The
evaluation exposed reusable PCRE capture metadata, quoted call-tag normalization, `paste()` and
`sub()` coercion semantics, the `grDevices::convertColor` import surface, and build-time
normalization of bounded bzip2-compressed package data. Both packages moved to regression;
usage-ranked pure-R packages `evaluate 1.0.5` and `numDeriv 2016.8-1.1` are the new uninspected P0
holdouts.

The third holdout rotation evaluated `evaluate 1.0.5` and `numDeriv 2016.8-1.1` using release
metadata, public documentation, public API calls, and black-box GNU R observations without first
inspecting their R source. Both install, load, attach, and execute declared representative public
functions unchanged, so they move to P4 regression. Reusable gaps covered callable resolution and
exact formals, simple condition/source-reference shapes, post-ellipsis builtin argument matching,
and recursive data-frame columns. Usage-ranked pure-R packages `abind 1.4-8` and `rprojroot 2.1.1`
are the new uninspected P0 holdouts; only their release metadata and source-archive digests have
been admitted.

The fourth holdout rotation evaluated `abind 1.4-8` and `rprojroot 2.1.1` using only release
metadata, public documentation, public API calls, and black-box GNU R observations before runtime
execution. Both install, load, attach, and execute declared representative functions unchanged, so
they move to P4 regression. Reusable gaps covered specific and `Ops`-group operator dispatch,
incremental package S3 registration, numbered ellipsis identifiers, missing-endpoint sequences,
dimension-name replacement, quoting, data-frame coercion controls, and recursive missingness.
`rstudioapi 0.19.0` and `inline 0.3.21` are the new uninspected P0 holdouts; only official release
metadata and source-archive digests have been admitted.

The fifth holdout rotation evaluated `rstudioapi 0.19.0` and `inline 0.3.21` through release
metadata, public documentation/API calls, and black-box GNU R observations before runtime execution.
Both install, load, attach, and execute declared representative public functions unchanged, so they
move to P4 regression. Reusable gaps covered `exportMethods()` namespace metadata, GNU R namespace
ownership of `utils::head`/`utils::tail`, and `utils::globalVariables()` metadata state.
Dependency-free pure-R releases `rematch 2.0.0` and `whisker 0.4.1` replace them as uninspected P0
holdouts; only metadata and source-archive digests have been admitted.

The sixth holdout rotation evaluated `rematch 2.0.0` and `whisker 0.4.1` through the same
source-blind gate. Both install, load, attach, and execute their declared representative public
functions unchanged, so they move to P4 regression. Reusable gaps covered `NROW()`/`NCOL()`
dimensional extents, row/column-name replacement, GNU R regex and replacement boundaries,
capture-free `strsplit()`, standard apply-family argument matching, factor-label equality, and
atomic replacement promotion by list values. Dependency-free pure-R releases `zeallot 0.2.0` and
`ini 0.3.1` replace them as uninspected P0 holdouts; only release metadata and source-archive
digests have been admitted.

The seventh holdout rotation evaluated `zeallot 0.2.0` and `ini 0.3.1` only after their release
metadata, public manuals, source-archive digests, and black-box GNU R behavior were frozen. Both
install, load, attach, and execute representative declared public behavior unchanged, so they move
to P4 regression. Reusable gaps covered `startsWith()`/`endsWith()`, `regexec()` capture locations,
language equality, first-class constructed assignment, promise-origin-aware `parent.frame()`,
runtime constants embedded in language objects, and recursive `as.character()` coercion. The next
untouched P0 holdouts are usage-ranked `cpp11 0.5.5` and `otel 0.2.0`; only public metadata and
source-archive integrity have been admitted.

The eighth holdout rotation evaluated `cpp11 0.5.5` and `otel 0.2.0` only after freezing public
manuals, exported formals, representative GNU R black-box behavior, and archive digests. Both move
to P4 regression through unchanged code. Reusable gaps covered separate executable-source and
immutable-resource budgets, list/factor `%s` formatting, `strrep()`, `length<-`, `anyNA()`, and
`make.unique()`. cpp11's native compilation path remains outside the tier. The committed top-100
usage snapshot leaves `BH 1.90.0-1` as the sole dependency-free, `NeedsCompilation: no` untouched
candidate; only its metadata and source-archive digest are admitted as the next P0 holdout.

The ninth holdout rotation evaluates `BH 1.90.0-1` only after freezing official metadata and GNU R
black-box resource counts and sizes. It reaches P3 unchanged through generic large-resource
admission, prompt archive-limit rejection, standard `exportPattern`, namespace loading, attachment,
and exact immutable header discovery. P4 is not applicable because BH exports no R functions, and
downstream C++ compilation is not claimed. No untouched candidate remains in the committed top-100
snapshot whose complete runtime closure is already available and declares no native compilation; the
holdout partition may therefore be empty until a dependency-closure snapshot admits the next
candidate.

The tenth holdout admission extends beyond the exhausted committed top-100 download snapshot.
`Formula 1.2-6` is selected for its documented multipart-formula and model-frame surface and broad
reverse-import reach. Its [CRAN release metadata](https://cran.r-project.org/package=Formula)
declares only `R (>= 2.0.0)` and `stats` as required dependencies and `NeedsCompilation: no`; the
official `PACKAGES` index reports MD5 `230a93c95eaabdfc7a2e958efbbe25db`. A transient download of
the canonical source archive matched that MD5 and pinned SHA-256
`7e611ac371c045e100a6205d92fe5104001942673798f970290fea12e33bfd37`. The archive was not opened, and
neither its source nor runtime behavior guided this admission. `Formula` remains an unevaluated P0
holdout with no first blocker until its scheduled evaluation.

A build-time metadata preflight now resolves a source-repository dependency closure without
downloading archives. It records dependency-first order, the repository-index SHA-256, and explicit
metadata blockers, while marking source archives unverified. The `lifecycle` candidate's closure
encounters `cli` and `rlang` native-compilation declarations in a pinned offline fixture. This
planning result does not admit a new P0 package, change partitions, or replace archive and artifact
digests.

The development package `labeling 0.4.3` now reaches P5: its one applicable Rd example executes
unchanged through the generic data loader and browser graphics, using independently sourced standard
Iris data. Its pinned source archive has no `tests/` directory; an empty test inventory alone does
not establish P6. Package-check behavior remains unevaluated. The separate `extended.figures(2)`
probe executes but still exposes an incomplete full `par()` return. The generic build-time test
runner inventories unchanged top-level `tests/*.R` scripts and records their first execution
failure. A generic digest-checked Rd runner completes all four applicable `numDeriv 2016.8-1.1`
examples, establishing P5. A separate finite 300-million-step/50-million-vector opt-in profile
executes all seven unchanged direct-test scripts with zero warnings, establishing P6. Exact GNU R
4.6.1 also exits successfully for all seven. The archive has no `.Rout.save` files; the first
`BWeg.R` output matches all 170 lines after the host-specific `Sys.info` header and GNU R bytecode
address are omitted under profile 0.301. Closure rendering, nested list paths, and attributes close
the former display gaps. These diagnostic omissions do not establish raw output fidelity. Explicit
browser display adaptations, complete output fidelity, and `R CMD check` behavior remain a P7
blocker. The separate pinned abind probe now executes all five unchanged direct-test scripts in
fresh sessions. Opt-in top-level continuation records the three expected errors from `adrop.R` and
`afill.R`; all five saved outputs match after generic prompt and whitespace normalization. Generic
deparsing, array slices, bind names, condition call traces, and visible parenthesized assignments
close the comparisons, establishing P6. Byte-level output identity and remaining `R CMD check`
stages are unverified at P7.

Profile 0.302 adds strict fresh-session native-oracle comparisons with explicit stage inventories.
All ten abind test/example streams match after independently probed Windows text transport decoding;
two of eleven numDeriv streams match, and nine retain host-display or numerical differences. No
whitespace or numeric tolerance is applied. Compact evidence is stored under
`compatibility/package-check-evidence/`. Missing condition/order observations and applicable
unexecuted check stages keep both packages at P6.

Profile 0.303 reruns both packages after numeric report and output formatting improvements. Complete
stream counts remain ten of ten for abind and two of eleven for numDeriv; several numDeriv first
differences occur later after earlier formatting differences close. Both historical and new compact
reports retain exact numeric tokens. Full condition/order evidence and unexecuted stages remain
required before either package can reach P7.

Profile 0.304 captures ordered condition classes, messages, calls and returning error-handler
evidence through global calling handlers. Abind retains ten matching output streams, but only nine
full comparisons match: `afill.R` has a newly observable attributed replacement-call difference.
Observer completeness is distinct from condition equality. Cross-stream ordering and unexecuted
check stages still prevent P7.

Profile 0.305 preserves embedded-value attributes in reflected calls and closes the observed abind
condition-call gap. All ten full comparisons now match, including ordered condition records.
NumDeriv completes eleven inputs with two matches and nine differences. Cross-stream order and
unexecuted stages still prevent P7; the development/regression/holdout partitions are unchanged.

## Validation tiers

| Tier | Required evidence                              |
| ---- | ---------------------------------------------- |
| P0   | Source archive admitted and integrity verified |
| P1   | Every R source file parses                     |
| P2   | Namespace loads                                |
| P3   | Package attaches                               |
| P4   | Declared representative functions execute      |
| P5   | Applicable examples execute                    |
| P6   | Applicable package tests execute               |
| P7   | Applicable package-check behaviors pass        |

Results report the highest completed tier and first blocker; the word “supported” alone is
forbidden. A compatible package must use unmodified package code and no package-specific runtime
branch.

## CI tiers

Pull requests run a small pinned regression smoke set and affected semantic cases. Nightly jobs run
the full development and regression corpus. Holdout evaluation is scheduled and separately reported
so it measures generalization rather than implementation overfitting.
