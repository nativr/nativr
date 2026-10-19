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
  - `OK`, `NOTE` and informational `INFO` pass. Notes and informational findings are recorded.
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
   execute, and none fails. Description policy v5 accepts the observed optional whitespace before a
   dependency constraint, including `R(>= 2.10)`; whitespace after its operator remains required.
2. **Declared dependencies.** Every required dependency (Depends, Imports and LinkingTo) is
   available on both runtimes and satisfies its version constraint. Under the
   declared-version-availability-v3 policy, Suggests and Enhances are observed, including version
   mismatches, but are not required by this stage. With `_R_CHECK_FORCE_SUGGESTS_=false`,
   unavailable Suggests are informational in native `R CMD check`. Independent fixtures cover this
   and a test that fails when it actually uses the missing dependency. Optionality does not waive
   examples, tests or other stages.
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
     Dependency input collection excludes `dontrun` blocks and includes `donttest` blocks, as
     observed in an independently authored native check. This scan scope is distinct from the
     default example execution selection.
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

## namespace-source (normative, policy namespace-source-v1)

Observed on native fixtures (opt-in parity test `namespace-source-check.test.ts`):

- **namespace information.** NAMESPACE exists and contains only unconditional, known directives.
  Conditional directives remain unexecuted.
- **package directory, subdirectories, index information.** Validated when the archive is packed:
  `R/` has R files, and there is no INDEX or demo index. An INDEX is unexecuted until specified.
- **non-ASCII code.** ASCII files pass, as do non-ASCII files when DESCRIPTION declares an Encoding.
  Undeclared non-ASCII stays unexecuted until its native outcome class is observed.
- **syntax.** Every R file parses without diagnostics; a syntax error is an ERROR.
- **S3 generic/method consistency** (WARNING). Only methods registered with `S3method()` are
  checked, against a generic defined in the package or recorded in the GNU R surface inventory.
  Compare the arguments before `...` position by position. The method needs `...` whenever the
  generic has it, and also whenever the method is shorter than the generic. The method may be longer
  only when the generic has `...`. Arguments after `...` are free. The core inventory records
  closure argument names through `formals()` and primitive signatures through `formals(args())`,
  never implementation bodies. A primitive with no observable signature has `formals: null` and
  `signature: "unknown"`; a known zero-argument function has `formals: []`. Unknown signatures leave
  consistency unexecuted. Independent native fixtures cover consistent and inconsistent methods for
  `as.character`, and the static fixture covers an unknown `[` signature.
- **replacement functions** (WARNING). The last argument of a `name<-` function is `value`.
- **foreign function calls** (WARNING). `.C`/`.Call`/`.Fortran`/`.External` calls need a `PACKAGE`
  argument. Calls that have one need the Native ABI and are unexecuted.
- **R code for possible problems** (NOTE). Free variables and called functions that are not visible
  are reported. The visible names are the package namespace, its imports, base, attached Depends
  packages, and locals bound anywhere in an enclosing function, including bindings that occur later.
  The analysis skips the arguments of `quote`, `bquote`, `substitute`, `expression` and `alist`,
  everything in `with()` except its first argument, formula terms, `$`/`@` members, `::` members and
  `if (FALSE)` branches. `<<-` to an undefined name is reported. Imports from non-core packages
  leave the item unexecuted.

## documentation (normative, policy documentation-v4)

Rd files are parsed following
[_Writing R Extensions_ chapter 2](https://www.stat.ethz.ch/R-manual/R-devel/doc/manual/R-exts.html#Rd-format)
and the published Rd parsing notes: `%` comments, the `\\` `\{` `\}` `\%` escapes, macros with brace
and `[option]` arguments, and quoted strings in R-like contexts (`\usage`, `\examples`, `\code`).
Observed on native fixtures (opt-in parity test `rd-check.test.ts`):

- **Rd files** (ERROR otherwise): `\name` and `\title` exist and are unique. A duplicated `\alias`
  within one file is accepted.
- **Rd cross-references** (WARNING): unqualified `\link` targets resolve through package aliases or
  installed aliases. Qualified links resolve through aliases or Rd file basenames within the named
  package. `\name` alone does not establish a target. Native check rejects a qualified target found
  only in another package, even though the HTML renderer documents a broader fallback.
  `compatibility/gnu-r/rd-aliases.json` schema 2 records base/recommended aliases and public Rd
  filenames from GNU R 4.6.1, without implementation bodies. Missing catalogs leave resolution
  unexecuted; a complete catalog with no matching target fails. Owned native fixtures distinguish
  filenames, names, aliases, qualified and unqualified links, and whitespace handling.
- **missing documentation entries** (WARNING): every exported object, including `exportPattern()`
  matches and non-function objects, has an alias. The checker observes `getNamespaceExports()` in
  both loaded runtimes. Incomplete observations leave this item unexecuted; differing inventories
  fail a separate namespace-export check.
- **code/documentation mismatches** (WARNING): each `\usage` function matches the code's argument
  names, order and unevaluated defaults. `\method{g}{c}` usage is compared with `g.c`. The package
  checker constructs NULL-bodied stubs only from public usage sections and compares their formals
  with `formals(args(target))` inside each loaded runtime. A bounded recursive syntax comparison
  accepts integer/double storage differences and numeric/logical typed NA differences, including
  inside default expressions. Character NA remains distinct. It distinguishes NA from NaN and
  rejects changed numeric values, reordered arguments, parentheses and changed expressions in
  independent native `codoc` fixtures. Arbitrary embedded objects, attributed atomic defaults and
  syntax deeper than 32 recursive comparisons remain unexecuted rather than being evaluated or
  deparsed. Observed argument stubs must have NULL bodies. Computed definitions and imported
  bindings can therefore be observed without inspecting their implementation bodies. Unknown
  primitive signatures, active bindings, missing/noncallable targets, unsupported usage syntax and
  failed observations remain unexecuted. A known zero-argument function is distinct from `args()`
  returning NULL. Static-only callers retain bounded syntax comparison, and unresolved static
  functions remain unexecuted. Repeated usage entries retain separate, deterministic inventory IDs,
  including when their outcomes differ.
- **Observation provenance:** `loaded-documentation-signatures-v1` records a probe digest, export
  names and bounded comparison states, never implementation bodies or observed default expressions.
  Committed summaries retain only the digest, counts and status values. A successful signature check
  does not establish complete function behavior or resolve other Rd checks.
- **Rd \usage sections** (WARNING): every usage argument, including `...`, has an `\item` in
  `\arguments`, and every item is in usage. Usage functions other than documented S3 methods have an
  alias. Pages with `\keyword{internal}` may omit argument descriptions. Internal status does not
  exempt extra documented arguments, missing aliases, invalid R syntax or codoc mismatches. Owned
  native fixtures exercise each boundary separately.
- **Rd contents**: every file has a non-empty `\description`.

## manual (normative adaptation, policy manual-text-rendering-v2)

GNU R typesets a PDF manual, which needs a host LaTeX toolchain and is browser-inapplicable. NativR
instead renders every Rd file to text and requires that it uses only the Rd macros documented in
_Writing R Extensions_ chapter 2 (including the system macros) or macros the file defines with
`\newcommand`. Verbatim contexts preserve literal backslashes and balanced braces, decode escaped
braces/percent/backslashes, and remove percent comments. These include `\preformatted`, `\out`, both
equation arguments and the first `\href` argument; its second argument remains markup. The first
equation argument preserves unescaped percent. LaTeX commands inside equations or `\out` are literal
text, while unknown commands in markup still fail. Native parse/render fixtures and literal-byte
observations cover these distinctions. This remains a bounded text adaptation, not a claim of
complete native Rd rendering behavior. Files with `\Sexpr` remain unexecuted. The adaptation is
recorded in `compatibility/profiles.json` and does not claim PDF equivalence. Native `R CMD check`
reported the PDF manual for abind 1.4-8 as OK.

## vignettes and installed-documentation (normative adaptation, policy vignettes-v1)

Vignette sources are the files directly under `vignettes/` matching Sweave's documented default
pattern (`.Rnw`, `.Snw`, `.Rtex`, `.Stex` in either case) or R Markdown (`.Rmd`), following _Writing
R Extensions_, "Writing package vignettes". Native `R CMD check` on numDeriv 2016.8-1.1 reported OK
for files in vignettes, unstated dependencies in vignettes, package vignettes, re-building of
vignette outputs, installed files from inst/doc and sizes of PDF files under inst/doc.

- **files in vignettes / package vignettes.** Every source declares a non-empty
  `%\VignetteIndexEntry{}`; a missing one fails.
- **unstated dependencies in vignettes.** The R code of the evaluated chunks (Sweave `<<>>=` to `@`,
  or R Markdown ` ```{r} ` fences; chunks with `eval=FALSE` are skipped) is checked with the
  metadata-dependencies rules for the example role.
- **re-building of vignette outputs** (adaptation). Weaving needs host Sweave/LaTeX or Pandoc, which
  is browser-inapplicable. Instead the extracted code runs after `library(pkg)` on both runtimes: it
  passes when both complete, fails when only GNU R completes, and stays unexecuted when GNU R does
  not complete. Output comparison of weaved documents is not claimed.
- **installed files from inst/doc.** For each source, the built output (`.pdf` or `.html`) and the
  tangled `.R` code must be installed, otherwise the item stays unexecuted (it would need a host
  rebuild). An installed copy of the source must equal `vignettes/`; a diverging copy fails.
- **sizes of PDF files under inst/doc** (adaptation). Sizes are recorded; GNU R's compression
  analysis needs host qpdf and is not reproduced.

Both adaptations are recorded in `compatibility/profiles.json`.

## First P7 package

With these specifications, `pnpm package:check --package abind --oracle-repeat` reports
`p7Eligible: true` for abind 1.4-8 at profile 0.353.0. Every stage passes or is justifiably
inapplicable, every inventory is fully executed, and all ten output, order and condition comparisons
match native GNU R 4.6.1. The redacted summary is
`compatibility/package-check-evidence/abind-1.4-8-p7-0.353.0.json`. This is evidence for this
package and these specifications, not general package-check equivalence.

## Remaining outlines

- Non-ASCII code without a declared encoding, INDEX files, `\Sexpr`, and links into non-core
  packages remain unexecuted until their native outcomes are observed.
