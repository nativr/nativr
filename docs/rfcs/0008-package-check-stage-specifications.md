# RFC-0008: package-check stage specifications

Status: **accepted** (2026-10-17). The metadata-dependencies stage is specified in full here; the
other stages have outlines that later increments refine.

## Problem

Tier P7 requires every applicable package-check stage to be `passed` or justifiably `inapplicable`.
Five stages in `scripts/package-check.mjs` could never pass, because no specification said what
passing means: metadata-dependencies, installation-loading, namespace-source, documentation and
manual. abind 1.4-8 already passes the other ten stages.

## Method

- **Inputs.** Each stage is defined from public documentation (_Writing R Extensions_, _R
  Internals_, _R Installation and Administration_) and from black-box `R CMD check` output. The
  `tools` package source and package implementation code are never read.
- **Outcome oracle.** Native `R CMD check` from GNU R 4.6.1 is the outcome oracle. Each of its check
  items (for example `checking dependencies in R code ... OK`) maps to one NativR stage.
- **Status mapping.** A NativR stage passes only when NativR independently executes every mapped
  item with the same outcome class:
  - `OK` and `NOTE` both pass. Notes are recorded.
  - `WARNING` and `ERROR` fail.
- **Fixture parity.** Each rule is pinned by small, independently written fixture packages. An
  opt-in native fixture test runs `R CMD check` on them and compares outcome classes with NativR's.
- **Check profile.** The default `R CMD check` (not `--as-cran`) with
  `_R_CHECK_FORCE_SUGGESTS_=false`, on an R 4.6.1 installation with the recommended packages.
  Behavior that the documented `_R_CHECK_*` variables switch on (_R Internals_, "Tools") follows the
  default unless this RFC says otherwise.

Native `R CMD check` passes all 44 check items for the pinned abind 1.4-8 archive (observed
2026-10-17, GNU R 4.6.1, including the PDF manual).

## Item mapping

| Stage                   | Native check items                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| archive-artifact        | file DESCRIPTION; source package; executable files; hidden files; portable file names; top-level files; left-over files                                                                                                                                                               |
| metadata-dependencies   | package dependencies; DESCRIPTION meta-information; dependencies in R code; unstated dependencies in examples; unstated dependencies in tests                                                                                                                                         |
| installation-loading    | installed; installed package size; loaded; loaded with stated dependencies; unloaded cleanly; namespace loaded with stated dependencies; namespace unloaded cleanly; loading without being on the library search path                                                                 |
| namespace-source        | namespace information; there is a namespace; package directory; package subdirectories; code files for non-ASCII characters; R files for syntax errors; S3 generic/method consistency; replacement functions; foreign function calls; R code for possible problems; index information |
| documentation           | Rd files; Rd metadata; Rd cross-references; missing documentation entries; code/documentation mismatches; Rd `\usage` sections; Rd contents                                                                                                                                           |
| examples, package-tests | examples; tests (already executed)                                                                                                                                                                                                                                                    |
| manual                  | PDF version of manual                                                                                                                                                                                                                                                                 |

## metadata-dependencies (normative)

The stage passes when all of the following hold:

1. **DESCRIPTION validation.** The existing structural, license, author and derived-field checks
   (`inspectPackageDescription`, `inspectPackageLicense`, `assessEffectiveAuthorFields`) all
   execute, and none fails.
2. **Declared dependencies.** Every declared dependency is available on both runtimes and satisfies
   its version constraint. `observePackageDependencies` provides this.
3. **Dependency closure.** Every package in the transitive closure of `Depends` and `Imports` is a
   base package or a package packed with the bundle. `LinkingTo` packages are build-time
   dependencies only.
4. **Source references** (policy `literal-source-references-v2`), with these rules observed on
   native fixtures:
   - All syntax is scanned, including quoted expressions. `eval(quote(library(p)))` and
     `quote(library(p))` are detected.
   - Detected forms are literal `library()`/`require()` targets, and `p::f` / `p:::f`. A `library()`
     or `require()` with a computed `character.only` control, or with a non-literal target, is not
     detected.
   - `do.call("library", …)`, functions bound through `get()`, and calls of computed callees are
     outside the native check. They are recorded as `outside-static-scope` and do not affect the
     outcome.
   - Missing-argument placeholders (`x[, 1]`) and `...` are inert syntax.
   - The package itself and base-priority packages are always accepted.
   - Package code: an undeclared target is a WARNING. A literal `library()`/`require()` of a
     declared package is a NOTE ("use `::` or `requireNamespace()`").
   - Examples: an undeclared non-base target is a WARNING, whether or not it is installed.
   - Tests: an undeclared non-base target is a WARNING only when the package is **installed**. The
     installed set is deterministic: the base and recommended packages of R 4.6.1 (_R Installation
     and Administration_) plus the bundle's packed closure. Other names produce no finding, as
     observed natively.
   - Recommended packages for R 4.6.1: boot, class, cluster, codetools, foreign, KernSmooth,
     lattice, MASS, Matrix, mgcv, nlme, nnet, rpart, spatial, survival. Base packages: base,
     compiler, datasets, graphics, grDevices, grid, methods, parallel, splines, stats, stats4,
     tcltk, tools, utils.

`requireNamespace()`/`loadNamespace()` literal targets keep their current, more conservative
treatment until fixture parity establishes the native rule.

## installation-loading (normative)

The stage passes when every item below executes and matches the native oracle:

- **install:** the native installation of the pinned archive exits successfully, and the NativR
  artifact is packed with the pinned digest (archive-artifact stage).
- **installed-size:** the size of the packed NativR artifact is recorded. Above the documented 5 Mb
  threshold (`_R_CHECK_PKG_SIZES_THRESHOLD_`) it is a NOTE, which still passes.
- **load, attach, detach, unload:** observed in fresh sessions on both runtimes
  (`namespace-load-attach-detach-unload-v2`).
- **load-with-stated-dependencies, namespace-load-with-stated-dependencies:** with the default
  packages detached from the search path, loading the namespace and then attaching the package
  succeed (`base-search-path-load-attach-v1`).
- **library-search-path-load:** after the package's own library is removed from `.libPaths()`,
  `library(pkg, lib.loc = )` attaches it (`explicit-lib-loc-load-v1`). System libraries stay on the
  path, as they do in GNU R.

Adaptation: GNU R starts a fresh session with `R_DEFAULT_PACKAGES=NULL`. NativR's core namespaces
are resident in every session, so the stated-dependency items detach the default packages instead.
Code that tests whether a core namespace is loaded without loading it can therefore observe a
difference; library loading and symbol visibility cannot. This is recorded in
`compatibility/profiles.json`.

## Other stages (outline)

- **namespace-source.** Parse every R file; NAMESPACE directives consistent with definitions;
  non-ASCII code without a declared encoding; S3 generic/method signature consistency; replacement
  functions whose last argument is `value`; foreign calls (browser-inapplicable unless registered
  with the Native ABI). The "possible problems" item needs an independent specification of the
  documented codetools-style findings before it can pass.
- **documentation.** A complete Rd parser; required sections; aliases; cross-references to
  documented topics; documented exports; `\usage` consistent with formals.
- **manual.** PDF typesetting needs a host LaTeX toolchain and is browser-inapplicable. The stage is
  redefined as rendering every Rd file to text without errors, recorded as a documented adaptation
  in `compatibility/profiles.json`. This item does not claim PDF equivalence.
