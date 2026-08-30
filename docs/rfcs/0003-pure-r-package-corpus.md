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

A later complete-example audit advances crayon to P5 after all 19 frozen installed Rd topics run
unchanged through reusable Base R semantics. The same audit advances pkgconfig to P5 on an exact
four-topic help manifest whose applicable-example set is explicitly empty. Neither tier is inferred
from representative calls alone.

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

The first two applicable P6 results are unchanged `numDeriv 2016.8-1.1` and `abind 1.4-8`. With test
retention explicitly enabled, each artifact carries a versioned manifest and immutable copies of its
top-level R test scripts. NumDeriv executes seven scripts and four Rd topics; abind executes five
scripts and five Rd topics. Computationally large scripts require explicit finite overrides, which
the evidence records rather than weakening interactive defaults. The generic runner can honor a test
script's top-level `options(error=)` handler after an intentional error. Retained bytes alone never
satisfy P6. The generic package-check runner now performs normalized `.Rout.save` comparison and the
remaining browser-admissible metadata, namespace, attachment, documentation, example, test, and
prebuilt-vignette checks required for P7.

Results report the highest completed tier and first blocker; the word “supported” alone is
forbidden. A compatible package must use unmodified package code and no package-specific runtime
branch.

Packages with no applicable scripts do not gain P6 merely because the test manifest is empty.
Likewise, a deeper tier remains blocked when an unchanged example reaches a missing shared contract.
Withr 3.0.3 reaches P5 after its finalizer-dependent `defer`, core-data-dependent
`with_par`/`with_tempfile`, and historical Marsaglia-Multicarry/Rounding `with_rng_version` topics
complete. Buggy Kinderman-Ramage normal draws now have reusable fixed-seed differential evidence,
although those examples do not exercise them. Generics 0.1.4 reaches P5 only after all three
applicable Rd topics execute.

The withr P6 audit retains its unchanged `testthat.R` driver and executes it far enough to identify
the unavailable testthat package as the first dependency blocker. Since current testthat requires
native compilation, this does not lower the pure-R P6 gate or authorize a package-specific testing
shim; it becomes explicit input to the later native-package ABI phase.

The profile-0.302 depth audit advances regression packages assertthat 0.2.1 and praise 1.0.0 to P5.
Every applicable frozen installed example topic runs unchanged. The assertthat failure sequence is
kept as reusable evidence for primitive reflection, explicit call matching, classed conditions, and
virtual file access; it does not authorize package-specific runtime behavior.

The profile-0.303 depth audit advances regression package prettyunits 1.2.0 to P5. Every applicable
frozen installed example topic runs unchanged. Its formatting and duration paths are retained as
reusable evidence for S3 difftime-unit access/replacement, primitive infinity classification, and
browser-owned C-style formatting; they do not authorize package-specific runtime behavior.

The profile-0.304 depth audit advances regression package evaluate 1.0.5 to P5. All six frozen
installed example topics run unchanged. The evidence is retained against shared condition/restart,
interrupt, hook, source-reference, expression/data-frame, sequence, and recorded-plot semantics. The
one process-shaped example uses an explicit generic host adapter and grants no ambient process
authority; no evaluate-specific runtime behavior is authorized.

The profile-0.305 depth audit advances rprojroot 2.1.1, rstudioapi 0.19.0, rematch 2.0.0, whisker
0.4.1, zeallot 0.2.0, and ini 0.3.1 to P5. Every runnable block in their exact frozen installed help
manifests executes unchanged. Provenance-audited `InsectSprays` and `faithful` resources close the
whisker and zeallot data blockers through the generic static-package path. Browser-unavailable
RStudio behavior remains an explicit host contract, and no package-specific runtime behavior is
authorized.

## CI tiers

Pull requests run a small pinned regression smoke set and affected semantic cases. Nightly jobs run
the full development and regression corpus. Holdout evaluation is scheduled and separately reported
so it measures generalization rather than implementation overfitting.

The tenth holdout rotation evaluates `docopt 0.7.2` only after freezing CRAN metadata and its source
archive digest. Its genuine first blocker was `methods::setRefClass`; after reusable Reference
Class, missingness, regex replacement, inline-regex-mode, logical, substring, list-comparison, and
S4 dispatch work, the unchanged installed example and representative parser path complete at P5.
`getopt 1.21.1` is the replacement untouched P0 holdout; only its CRAN metadata and source digest
are admitted.

The eleventh holdout rotation evaluates `getopt 1.21.1` only after freezing CRAN metadata and its
source archive digest. Its first runtime blocker was generic `match(..., nomatch=)` coercion; the
unchanged package subsequently exercised reusable `Negate()`, `storage.mode<-`, and deterministic
browser `commandArgs()` behavior. Its representative option parse, usage string, and all four
applicable installed Rd examples complete at P5 without a package-specific branch. `optparse 1.8.2`
is the replacement untouched P0 holdout; only official metadata and its source digest are admitted.

The twelfth holdout rotation evaluates `optparse 1.8.2` only after freezing its CRAN metadata and
source digest. Packaging first stops at the generic `exportClasses()` directive; unchanged loading
and execution then expose reusable S4 class metadata, slot, validity, replacement-generic, and
filled-output contracts. Its representative parser path and exact four-topic applicable installed
example manifest complete at P5 without a package-specific branch. `argparser 0.7.3` is the next
untouched P0 holdout. Because the committed top-100 snapshot has exhausted eligible standalone
pure-R candidates, this independent package is admitted as a same-domain generalization probe using
only official metadata and its source digest.

The thirteenth holdout rotation admits `argparser 0.7.3` to the standard installer before source
inspection; install, load, and attach succeed. Its first representative runtime blocker is scalar
list/pairlist `as.logical()` coercion, and its exact installed examples next expose target-aware S4
`coerce` method dispatch. The unchanged representative parser and all three applicable installed
example topics complete at P5 after those reusable fixes. `iterators 1.0.14` becomes the next
untouched P0 holdout, selected through the frozen-window frequency comparison and admitted only by
official metadata plus its uninspected archive digest.

The fourteenth holdout rotation evaluates `iterators 1.0.14` only after freezing official metadata
and its source digest. Install, load, and attach succeed before source inspection; generic
caller-environment S3 discovery is the first representative blocker, followed by reusable runtime
text-resource and level-count semantics in the exact example manifest. All nine applicable examples
complete at P5 without a package-specific branch. `foreach 1.5.2` is the replacement untouched P0
holdout. Its official source digest and the digest of required untouched pure-R `codetools 0.2-20`
are frozen to make the next rotation a transitive dependency-closure test.

The fifteenth holdout rotation evaluates the complete frozen `codetools`/`iterators`/`foreach`
closure before inspecting package source. It first records the missing generic `compiler` namespace
at P2. Reusable compiler identity, language call-entry tags, and `%*%` semantics then carry
unchanged `foreach 1.5.2` through its GNU R-matched representative path and all four applicable
examples at P5. `doParallel 1.0.17` is the replacement untouched P0 holdout; its official metadata
and archive digest are frozen to generalize the same stack toward the core `parallel` contract.

The sixteenth holdout rotation evaluates unchanged `doParallel 1.0.17` after freezing its official
source digest and complete pure-R dependency closure. The first source-blind blocker is that the
repository resolver incorrectly seeks core `parallel` on CRAN. Generic core-package provisioning,
`Depends` attachment, and a deterministic browser `parallel` adapter carry the package through load,
attach, representative sequential `%dopar%`, and its installed example at P5 without a
package-specific branch. Untouched `pbapply 1.7-4` is the next P0 holdout.

The seventeenth rotation evaluates unchanged `pbapply 1.7-4` after its metadata and digest freeze.
The source-blind first blocker is conditional NAMESPACE syntax. Safe platform selection and reusable
utils, parallel, Base, RNG, and fitted-model seams carry representative execution to P4. The first
installed example still stops at fitted-call formula reconstruction, which is recorded explicitly
instead of promoting the package to P5. Untouched `globals 0.19.1`, with its official source digest
and already pinned pure-R `codetools` dependency, becomes the replacement P0 holdout.

The eighteenth rotation evaluates unchanged `globals 0.19.1` only after freezing metadata, source
digest, and its `codetools` dependency closure. A missing `R.version` binding is the source-blind
first blocker. Generic version, environment-name, language-length, class-removal, and nested
data-frame-cell semantics carry representative execution and the first installed example to P4. The
second example records list-valued subscript normalization as its P5 blocker. Dependency-free pure-R
`listenv 1.0.0`, admitted only by metadata and source digest, becomes the replacement P0 holdout.

The nineteenth rotation evaluates unchanged `listenv 1.0.0` only after freezing its metadata, source
digest, and a replacement untouched holdout. Installation, loading, and attachment succeed before
source inspection; the public ordered-environment example records primitive S3 dispatch for classed
environments as the first blocker. Reusable extraction, replacement, shape, message, and membership
semantics carry all three installed examples to P5. Dependency-free pure-R `R.methodsS3 1.8.2`,
frozen by official metadata, download window, and unopened source digest, becomes the replacement P0
holdout.

The twentieth rotation freezes pure-R dependency closure `R.oo 1.27.1` before evaluating unchanged
`R.methodsS3 1.8.2`. The source-blind checkpoint records imported `utils::getAnywhere` as the first
blocker. Reusable lookup, namespace-self-reference, qualified-replacement, substitute, system-frame,
startup-condition, and S3-registry semantics carry the package through all installed examples at P5.
`R.oo 1.27.1`, admitted only by metadata, download window, and unopened source digest, becomes the
replacement P0 holdout.

The twenty-first rotation advances unchanged `R.oo 1.27.1` to P5 and freezes `R.utils 2.13.0`; the
twenty-second advances R.utils and its dependency closure to P5 after recording imported graphics as
the first blocker, then freezes `here 1.0.2`. The twenty-third rotation moves here directly to P5
without a new runtime blocker and freezes `R.matlab 3.7.0` from metadata only.

The twenty-fourth rotation evaluates unchanged R.matlab after its freeze. Auxiliary Java source is
the first source-blind blocker; a generic inert-resource rule, namespace re-export/load-hook fixes,
version shape, and S3 structural dispatch carry the exact package to P5. Dependency-free
`combinat 0.0-8` becomes the replacement P0 holdout only after its usage window, official metadata,
archive size, and source digest are frozen. Its archive remains unlisted, unextracted, unparsed, and
unevaluated.

The twenty-fifth rotation evaluates unchanged `combinat 0.0-8` after that freeze. Its ordered first
blockers are missing generic `lgamma()`, missing generic `tabulate()`, failure to ignore
percent-commented Rd example sections, and missing generic `gamma()`. Shared fixes carry all six
applicable example topics to P5; the entry moves to regression with pinned source and artifact
digests. No production package-name branch is permitted or present.

Only after closing that evidence, dependency-free `matrixcalc 1.0-6` becomes the twenty-sixth
metadata-only P0 holdout. Its archive remains unlisted, unextracted, unparsed, and unevaluated.

The twenty-sixth rotation evaluates unchanged `matrixcalc 1.0-6` only after that freeze. POSIX
`exportPattern()` is the first blocker, followed by reusable real-matrix product, triangle,
coordinate, Kronecker, combinatorial, determinant/solve, QR, and SVD semantics. Shared fixes carry
all 60 exact installed example topics to P5 with pinned source and artifact digests and no
package-name branch. The holdout partition may remain empty only until metadata and the unopened
digest for the next independent pure-R candidate are recorded.

Only after closing that evidence, `Formula 1.2-6` becomes the twenty-seventh metadata-only P0
holdout. It is selected by the frozen usage/dependency comparison after excluding host-clipboard
`clipr` and native `parallelly`. Its 47,339-byte source archive and SHA-256 are recorded without
listing, extraction, parsing, or execution.

The twenty-seventh rotation evaluates Formula only after that freeze. Its generic first-blocker
sequence closes formula S3 metadata and mutation, string apply function resolution, terms/model data
contracts, dot expansion, expression-column reuse, formula comparison, response helpers, and
offsets. The unchanged release reaches P5 by executing both exact installed example topics with
pinned artifact SHA-256 `c2c65ec4d007ebd4c304e43a0e2c402ca047e0ae38d8667bbf79aaa918007b0b` and no
package-name production branch. Formula moves to regression; the holdout partition may remain empty
only until the next candidate's metadata and unopened source digest are frozen.

After Formula reaches P5, `DBI 1.3.0` becomes the twenty-eighth metadata-only P0 holdout. It is the
highest-usage member (612,949 downloads) of a complete current-CRAN metadata filter retaining 3,331
non-native, non-OS-specific candidates whose mandatory dependency closure is browser core or already
passing. Its only package dependency is core `methods`; concrete DBMS implementations are optional
and outside the P0 closure. The official 744,704-byte archive and SHA-256
`13def8e90cbe41205a0dfcf585a6a7ea79ce10d45969789e82613c7ce3d5fb18` are recorded without listing,
extraction, parsing, or execution. Its first source-blind blocker, not its package identity, must
select the next semantic increment.

The twenty-eighth rotation evaluates DBI only after that freeze. Its ordered blockers cover shared
methods formals/value classes, S3 string conversion, concrete and atomic-data S4 storage,
Date/POSIXct conversion, legacy class metadata, namespace ownership, and compact/automatic row-name
semantics. The unchanged release reaches P5 through install, namespace load, attach, representative
ANSI/Id/SQL calls, and all runnable blocks in the exact 58-topic installed help manifest. Artifact
SHA-256 `d55fa587203e850bd7a7403a96aaa559bf9686c060816290904d1f4d7b9b6997` is pinned; DBI moves to
regression, and no package-name production branch is permitted or present.

Only after DBI reaches P5, `xtable 1.8-8` becomes the twenty-ninth metadata-only P0 holdout. The
same complete candidate comparison ranks it next at 606,555 downloads. Official metadata declares no
native compilation or OS restriction and only core mandatory dependencies. Its 618,708-byte archive
and source SHA-256 `b999c031b91255fb92134b0e70e5f84c5609e9312c0518393b9d0a4aaf6b2510` are recorded
without listing, extraction, parsing, or execution.

Profile 0.331 closes the previously recorded `globals 0.19.1` installed-example blocker through
generic runtime semantics and advances the unchanged package plus `codetools 0.2-20` to regression
P5. Both exact installed help topics pass. The corpus entry records the current deterministic
artifact digest and a null first blocker; it does not promote globals to P6/P7 or make an
arbitrary-package claim. Future rotation again requires either independently frozen metadata or an
explicit existing P6/P7 blocker selected before source inspection.

Profile 0.332 closes the recorded `pbapply 1.7-4` first blocker and advances the unchanged package
to regression P5. Every runnable block in its four installed topics passes through the standard
installer/runtime path. The corpus records the unchanged source and artifact digests, a null first
blocker, and no package-identity production branch. The next rotation again requires an
independently frozen metadata/usage selection or an explicit existing P6/P7 blocker before source
inspection.

The first generic P7 audit advances unchanged `numDeriv 2016.8-1.1` after every applicable planned
check passes. The same identity-agnostic runner keeps unchanged `abind 1.4-8` at P6 and records
GNU-compatible printed names/dimnames in normalized `abind.Rout.save` output as its first P7
blocker. Successful script execution alone is therefore no longer sufficient for the deepest tier.

Profile 0.333 closes that recorded blocker generically. The same runner passes all five abind help
topics, all five retained tests, and every normalized retained `.Rout.save` reference in isolated
sessions, so unchanged `abind 1.4-8` advances to P7 with a null first blocker. The next rotation
must again be chosen independently from frozen usage/metadata or another pre-existing explicit
blocker.

The thirtieth source-blind rotation freezes `selectr 0.6-0` at P0 before archive listing,
extraction, parsing, installation, or execution. A refreshed official `PACKAGES` comparison retains
3,384 current `NeedsCompilation: no`-or-absent, non-OS-specific releases whose mandatory
dependencies are browser core or already passing. In the shared frozen download window, `clipr` is
excluded for its required host-clipboard contract and `remotes` for its remote-repository and
git/subversion host contract. `selectr` is next at 368,242 downloads and imports only already-P5
`R6`; XML, xml2, and testthat are optional Suggests. The unopened 85,422-byte source archive is
pinned by SHA-256 `b877dfd9cc8b7d9afda1be9e45dfafc942e14b4279a430e5f8f75325c05eddd9`. No
compatibility is presumed until the scheduled source-blind attempt records its first concrete
blocker.

Profile 0.334 evaluates that frozen release. The ordered failure is generic unmatched-capture
extraction, not package identity: GNU R's `regexec()` emits `0/0` for an unmatched optional group,
and `regmatches()` returns `""` for that retained position. Reusable regex-object semantics and
guarded declared-Suggests warning handling carry unchanged selectr through install, namespace load,
attachment, complete export/help coverage, and both installed examples. The deterministic artifact
SHA-256 is `d286a0114315235128d81f91428b9799237ec56376a71e2895c709b8215a37f6`.

Selectr moves to regression P5 with an explicit P6 first blocker: retained `test-all.R` requires
unavailable suggested package `testthat`. The corpus does not call this P7 and does not infer
compatibility for XML/xml2 or arbitrary CSS workloads from the passing examples.

The thirty-first source-blind rotation then freezes `timeDate 4052.112` at P0 before archive
listing, extraction, parsing, installation, or execution. It is the next purpose-admissible release
in the same fixed usage comparison at 321,191 downloads. Official metadata declares no compilation
or OS restriction and only R plus core methods, graphics, utils, and stats in its mandatory closure;
RUnit is Suggests only. The unopened 367,313-byte archive is pinned by SHA-256
`7f5b8e294f9fdf977cb721e711a6fcd664e379ee1b0ddb4c733374940e0e4646`. Its first source-blind failure,
not anticipated date/time behavior, must select the next reusable increment.

Profile 0.335 records that rotation as regression P4. The unchanged archive installs, loads,
attaches, runs a declared representative calendar path, and passes retained `doRUnit.R` after a
generic blocker chain spanning POSIX axes, S4 serialization and redispatch, constructor/generic
formals, and standard date/scale generics. The ordered package-check blocker is S4
`exportClasses`/`exportMethods` documentation alias reconciliation. Remaining example failures keep
P5 incomplete, and the passing retained test cannot promote the package past a missing earlier tier.
No production rule recognizes the package name.

The next metadata-first rotation freezes `carData 3.0-6`, selected at 228,125 downloads in the
2026-07-12 through 2026-08-10 comparison after excluding higher-ranked host-service packages. The
995,588-byte official archive is pinned by source SHA-256
`b14d5b40b35e5a59c1ec1cdf3cce2cea239b60ff6977a821cca0d6d5b4112551` before execution.

Profile 0.343 records the source-blind result. Generic LazyData environments, xz normalization,
resource transport accounting, and dense contrast semantics carry the unchanged package through all
applicable package-check steps plus independent namespace/data probes. It moves to regression P7
with deterministic artifact SHA-256
`cb6e8d712d5031eb1c4e426911963d1ad7409eb702522d84422f3be512806d41`. The result does not waive
remaining `.rdx`/`.rdb`, alias, nonmatching archive, ordered/sparse contrast, dependency, or native
package blockers and does not imply arbitrary-package compatibility.

The next metadata-first rotation freezes `rex 1.2.2` at P0 before archive listing, extraction,
parsing, installation, or execution. A refreshed official PACKAGES comparison leaves 3,340
non-native, non-OS-specific candidates whose mandatory dependency closure is browser core or a
passing corpus package. After excluding higher-ranked clipboard, remote-installer, and host project
library tools, rex is the next purpose-admissible release at 218,894 downloads in the fixed
2026-07-12 through 2026-08-10 window. Official metadata declares `NeedsCompilation: no` and only
already-passing withr as an Import. The unopened 91,288-byte archive is pinned by SHA-256
`5c6a6f9bc45507038ae528e71a7f6cd69a77c24c2fed86383a34fd5c86c2ee48`; its scheduled first failure, not
anticipated regular-expression behavior, must select the next reusable increment.

Profile 0.344 records the scheduled source-blind result. The first failure in
`example:character_class` was generic language reconstruction: a literal character CAR captured by
`substitute(list(...))[-1]` became a symbol through list-to-call conversion. Preserving arbitrary
call-head values across `[.call`, `as.list()`, and `as.call()` carries the unchanged release through
installation, namespace loading, attachment, complete help coverage, all five installed example
topics, and an independent GNU R-matched capture/match probe.

Rex moves to regression P5 with artifact SHA-256
`191f79c1fb93b5381a466f8635c03d7ae750bacccbd42df03e22abc944bcce48`. Its first ordered blocker is now
P6 dependency closure: retained `testthat.R` requires unavailable suggested package `testthat`. The
two indexed prebuilt vignettes are also unresolved by the current vignette path. The ledger retains
those boundaries and makes no P6/P7 or arbitrary-package claim.

The next metadata-first rotation freezes `brew 1.0-10` at P0 before archive listing, extraction,
parsing, installation, or execution. The refreshed official PACKAGES comparison leaves 3,339
non-native, non-OS-specific candidates outside the corpus whose mandatory dependency closure is
browser core or a passing corpus package. The recurring `testthat` blockers remain recorded but are
not selected here because official metadata for current `testthat 3.3.2` declares
`NeedsCompilation: yes` plus a broad mandatory dependency closure. Admitting it now would
prematurely enter the native-package phase solely for P6 tests.

After the existing host-service exclusions, brew is the next purpose-admissible release at 197,954
downloads in the fixed 2026-07-12 through 2026-08-10 window, ahead of shape at 189,688 and corrplot
at 187,313. Official metadata declares `NeedsCompilation: no`, no mandatory dependencies, and only
testthat as a Suggest. The unopened 71,087-byte archive is pinned by source SHA-256
`4181f7334e032ae0775c5dec49d6137eb25d5430ca3792d321793307b3dda38f`; its first scheduled failure, not
anticipated templating behavior, must select the next reusable increment.

Profile 0.345 records the scheduled brew result without inventing a semantic change. The unchanged
artifact installs, loads, attaches, covers all five exports and both installed help topics, and
executes both complete example topics under the generic package-check runner. An independently
authored GNU R-matched scenario covers inline value/code/comment delimiters and the `run = FALSE`,
`parseCode = FALSE` parser result. No production branch recognizes brew or its identity.

Brew moves to regression P5 with deterministic artifact SHA-256
`51479288695528a14536eee3b4b0c96751d92e8c3442402cc6c3c7bfa140fd4a`. Its first ordered blocker is the
retained `testthat.R` script's unavailable suggested `testthat` dependency, so P6/P7 remain
unclaimed. This third recurring testthat blocker strengthens the future dependency-closure signal
but does not override the phase ordering while that closure requires native compilation.

The replacement metadata-only holdout is `shape 1.4.6.1`, the next purpose-admissible release at
189,688 downloads in the same fixed window, ahead of corrplot at 187,313. Official metadata declares
only core stats, graphics, and grDevices in its mandatory closure and no Suggests, native code, OS
restriction, or system requirement. The unopened 646,412-byte archive is pinned by source SHA-256
`43f9bd0f997fd6cf1838efd8b2509c9a6396513f4e54a20360481634affd22a4` and remains unlisted,
unextracted, unparsed, and unevaluated at P0.

The Profile 0.345 external regression reruns also re-verified unchanged `timeDate 4052.112` against
the current generic artifact normalizer. Two independent builds produced artifact SHA-256
`ab56e656c0e8ac9908812460b975548e4f073355ee1936ae83867305283f843b`; the ledger and executable
assertion replace the stale pre-normalizer digest while retaining the same source archive, package
behavior, and P7 claim.

## Profile 0.348 corrplot rotation and insight holdout

The metadata-frozen `corrplot 0.95` archive was opened only for its scheduled source-blind run. The
first package-check failure selected exact-shadowed partial argument matching; the next selected
numeric data-frame/matrix Pearson `cor` and `cov`. The unchanged artifact now passes namespace,
documentation, and the first three complete installed example topics at P4. Its ordered first
blocker is `stats::hclust` in `example:corrMatOrder`, with deterministic artifact SHA-256
`c24a371fb61302e64e399da83a6e229be0c44cb24a048347e5813fb5e30e16ab`.

A refreshed official PACKAGES filter produced 3,341 current non-native, non-OS-specific candidates
whose mandatory dependencies are browser core or passing corpus packages. In the fixed 2026-07-12
through 2026-08-10 cranlogs window, clipboard, remote-installer, project-library, and Git-credential
host-service packages are excluded. `insight 1.5.2` is the next purpose-admissible release at
155,722 downloads. Official metadata declares only core methods, stats, and utils as imports,
NeedsCompilation `no`, GPL-3, and publication on 2026-06-28. Its unopened 1,131,591-byte archive is
pinned by source SHA-256 `e537b74c195f363d8d2a5a015b0c91aed27f83f2ea5cfa67a947062476db5079` and
remains unlisted, unextracted, unparsed, and unevaluated at P0.

## Profile 0.349 corrplot blocker progression

The unchanged corrplot artifact retains its P4 tier and deterministic digest. Its source-blind
ordering probes now pass AOE, FPC, default `hclust`, and Ward D through reusable distance,
hierarchical-clustering, dendrogram, and array-coordinate semantics. The complete
`example:corrMatOrder` topic then stops first at missing `graphics::symbols`; the corpus ledger
records that ordered blocker instead of the closed clustering gap.

No new package was opened during this increment. `insight 1.5.2` remains the sole untouched P0
holdout, preserving the development/regression/holdout partition and source-blind rotation policy.

## Profile 0.350 corrplot blocker progression

The unchanged corrplot artifact retains its P4 tier and deterministic digest. Its direct default
plot now executes through package-neutral `symbols` polygon rendering and corrected multi-key
`order` semantics. The complete source-blind `example:corrMatOrder` topic next stops first at
missing `stats::cutree`; the corpus ledger records that ordered blocker rather than either closed
gap.

No new package was opened during this increment. `insight 1.5.2` remains the sole untouched P0
holdout, preserving the development/regression/holdout partition and source-blind rotation policy.

## Profile 0.351 corrplot blocker progression

The unchanged corrplot artifact retains its P4 tier and deterministic digest. Generic `cutree`
semantics carry the complete `example:corrMatOrder` topic to success. The next ordered failure is
`example:corrRect`: GNU-different symmetric-eigenvector signs cyclically shift AOE ordering, and a
lower-triangle name pair expected by the example is absent. The corpus ledger records this reusable
linear-algebra blocker instead of the closed tree-cut gap.

No new package was opened during this increment. `insight 1.5.2` remains the sole untouched P0
holdout, preserving the development/regression/holdout partition and source-blind rotation policy.

## Profile 0.352 corrplot blocker progression

The unchanged corrplot artifact retains its P4 tier and deterministic digest. A reusable,
source-reproducible LAPACK 3.12.1 `DSYEVR` Wasm backend carries `example:corrRect` through exact
signed FPC/AOE ordering, and general fractional `seq(length.out=)` ceiling semantics clear the next
failure. The ordered first blocker now lies in the remaining `graphics::symbols` parameter surface
inside `example:corrplot` and reports `invalid symbol parameter`.

No new package was opened during this increment. `insight 1.5.2` remains the sole untouched P0
holdout, preserving the development/regression/holdout partition and source-blind rotation policy.

## Profile 0.353 corrplot example completion

The unchanged corrplot artifact advances from P4 to P5. General Pearson-test, data-frame bind and
name replacement, zero-dimension symbol, and text graphical-control behavior carries every installed
example topic to success. The ledger now records `test:testthat.R` as the ordered first blocker:
suggested dependency `testthat` is unavailable, so dependency-complete package tests have not run.

No package-specific test bypass is allowed, and P5 is not treated as package completion. No new
holdout package was opened; `insight 1.5.2` remains the sole untouched P0 entry, preserving the
development/regression/holdout partition and source-blind rotation policy.

## Profile 0.354 insight example completion

The frozen unchanged insight artifact advances from P3 to P5 after every applicable installed Rd
example passes. The ledger records generic runtime/model/data changes and retains the exact artifact
digest; no package-local shim or production identity check is admitted.

The ordered blocker is now `test:testthat.R` because suggested dependency `testthat` is unavailable.
`GPArotation 2026.8-1` remains unopened at P0, preserving the development/regression/holdout
partition. P5 is not completion and no test bypass is permitted.

## Profile 0.355 GPArotation rotation and palmerpenguins holdout

The metadata-frozen `GPArotation 2026.8-1` archive was opened only for its scheduled source-blind
run. Generic `graphics::grid`, `stats::uniroot`, `stats::cov2cor`, and `base::tcrossprod` closures
carry the exact artifact through namespace load and attachment at P3. Its deterministic artifact
SHA-256 is `4ff33c454116f0b433d36fc7a393343fcae0fd44d2c276e773fef60f2aa9494b`.

The first example topic, `CCAI`, uses `randomStarts = 100` and reaches the standard package-test
allocation ceiling. A bounded large-browser diagnostic advances farther and reaches its step
ceiling, so the ledger records the resource limit as the ordered first blocker without claiming
P4/P5 or weakening the common gate.

`palmerpenguins 0.1.1` is the replacement metadata-only P0 holdout. Official CRAN metadata declares
NeedsCompilation `no`, CC0, publication on 2022-08-15, and only R >= 2.10 as mandatory. The unopened
2,995,960-byte archive is pinned by SHA-256
`2a40d48ba6c7978fdf2a6daf647ccb39cd17590680138931d11194d3dd1a30b4`.

## Profile 0.356 GPArotation first-topic completion

General `setNames`, `sweep`, maximum-likelihood `factanal`/`loadings`, and programmatic
`match.call()` callback support carry the unchanged GPArotation artifact through the complete
`example:CCAI` topic without a package-identity branch. The ledger therefore advances it from P3 to
P4.

The ordered first blocker moves to `example:GPA`: under an explicit 50,000,000-element
single-vector, 500,000,000-element cumulative, and 100,000,000-step evidence profile, execution
continues through list-valued covariance input and package-owned `cfQ` rotation before the step
ceiling. P5 is not claimed. `palmerpenguins 0.1.1` remains the untouched metadata-only P0 holdout.

## Profile 0.359 GPArotation P7 promotion

Successive package-neutral fixes close every remaining applicable package-check blocker in the
unchanged GPArotation artifact: exact L-BFGS-B-backed `factanal`, public `stats::varimax`, implicit
single-column matrix construction, legend fill/border rendering, and retained-test evaluation as
separate top-level expressions from the package tests directory. The complete scheduled external run
passes and the ledger advances `GPArotation 2026.8-1` to P7 with no first blocker.

The claim remains bound to the pinned archive digest and recorded high-intensity resource profile.
It does not relax source-blind rotation, establish an identity allowlist, or imply arbitrary-package
compatibility. `palmerpenguins 0.1.1` remains the unopened metadata-only P0 holdout and is the next
ordered evaluation target.

## Profile 0.360 palmerpenguins rotation

The metadata-frozen `palmerpenguins 0.1.1` archive was opened only for its scheduled source-blind
evaluation. Its pinned source SHA-256 remains
`2a40d48ba6c7978fdf2a6daf647ccb39cd17590680138931d11194d3dd1a30b4`; deterministic installation
produces artifact SHA-256 `c660a2971f4e288fca82a55fae86f4b62a5abb6764c620d255e99c94cd1ee3db`.

The generic applicable package-check plan passes. A separately authored data probe then forces the
two unchanged LazyData objects and initially exposes missing `tibble::as_tibble` behind a successful
`requireNamespace("tibble")` check. Package-neutral tibble conversion/name repair and Base Date text
conversion close that gap, and GNU-matched structural/content probes pass. The ledger moves the
artifact from holdout to development at P7 with `firstBlocker: null`; no package identity is used by
production code.

At this recorded rotation boundary the holdout partition is empty. That state is permitted only
until the next metadata-first selection freezes an official version, admissibility facts, source URL
and unopened archive digest. No new candidate may guide implementation before that record exists.

## Post-0.360 metadata-frozen polynom holdout

A complete official CRAN metadata filter on 2026-08-12 retains 3,368 current releases with no native
compilation, OS restriction, or `LinkingTo` edge and whose mandatory dependencies are browser core
or passing corpus packages. Download priority uses the already fixed 2026-07-12 through 2026-08-10
cranlogs window. Higher-ranked `clipr`, `remotes`, `BiocManager`, `renv`, and `gitcreds` are
excluded because their declared purposes require clipboard, remote-package-manager, project-library,
lockfile, or Git-credential host services.

`polynom 1.4-1` is the next purpose-admissible release at 126,371 downloads. Official metadata
declares `NeedsCompilation: no`, no OS restriction or `LinkingTo`, GPL-2, publication on 2022-04-11,
and only core `stats` and `graphics` imports; `knitr` and `rmarkdown` are optional. The unopened
334,803-byte archive is pinned by SHA-256
`bc1edb7bb16c8b299103f80a52ab8c5fc200cd07a9056578c1f672e9f5019278`. It remains unlisted,
unextracted, unparsed and unevaluated at P0 until its scheduled source-blind run.

## Profile 0.361 polynom rotation

The scheduled source-blind run opened the pinned `polynom 1.4-1` archive only after the preceding
metadata record. Deterministic packing produces artifact SHA-256
`d9980d6e2aeabe3a8474a415b4bdb4a9fdc148baad0d3973bae8b4a31003c442`. Successive ordered blockers
selected reusable `stats::deriv` generic dispatch, single-variable `stats::poly`, implicit S3 group
registration/context, `NextMethod()` forwarding, callable Ops, Summary sum/product, list
distinctness, and general real eigen behavior above order three.

Every applicable package-check step and an independently authored GNU-matched polynomial scenario
now pass unchanged. The ledger moves the artifact to development at P7 with `firstBlocker: null`.
This is not an allowlist or an arbitrary-package claim. At the rotation boundary the holdout
partition is empty; the next candidate again requires a metadata-first P0 freeze before source
inspection.

## Post-0.361 metadata-frozen estimability holdout

The metadata-first comparison is now reproducible through `scripts/rank-pure-r-holdouts.mjs`. On
2026-08-12 it de-duplicates the official CRAN source `PACKAGES` index and retains 3,334 releases
outside the existing corpus with no native compilation, OS restriction, or `LinkingTo` edge and
whose mandatory dependency closure is browser core or a passing corpus package. Ranking reuses the
fixed 2026-07-12 through 2026-08-10 cranlogs window. Higher-ranked `clipr`, `remotes`,
`BiocManager`, `renv`, and `gitcreds` remain purpose-excluded for clipboard, remote-package-manager,
project-library/lockfile, or Git-credential host requirements.

`estimability 2.0.0` is the next purpose-admissible release at 124,366 downloads. Official metadata
declares `NeedsCompilation: no`, GPL >= 3, publication on 2026-06-26, R >= 4.1.0, mandatory
dependency `stats` only, and optional `knitr`/`rmarkdown`. The unopened 299,405-byte archive is
pinned by SHA-256 `4db3ed64e7a1b7234aed72ccc2c02590377b2234edb4ba282eefffb850838a66`. It remains
unlisted, unextracted, unparsed, and unevaluated at P0 until the scheduled source-blind run.

## Profile 0.362 estimability rotation

The scheduled run opened the pinned `estimability 2.0.0` archive only after the P0 record above.
Deterministic packing produces artifact SHA-256
`93c415103e22251e6a4db3b98df961202a692fe4d5ed1991479f6c4966a86dbc`. The unchanged package now passes
every applicable generic package-check step and an independent GNU-matched rank-deficient model
scenario.

Ordered failures selected package-neutral work in lazy `na.pass`, visible QR reconstruction,
model-frame/xlevel handling, rank-deficient prediction, stored-call formula updates, and named
treatment, sum, Helmert, and matrix contrasts. The ledger moves the artifact from holdout to
development at P7 with no first blocker. This remains a pinned-artifact result, not an arbitrary
pure-R package claim; the holdout partition is temporarily empty pending the next metadata-first
selection.

## Post-0.362 metadata-frozen formatR holdout

The reproducible comparison still retains 3,334 admissible releases outside the prior 56-release
corpus and reuses the fixed 2026-07-12 through 2026-08-10 download window. The five higher-ranked
host-service packages remain excluded for the already recorded clipboard, remote package-management,
project-library/lockfile, and Git-credential reasons.

`formatR 1.14` is the next purpose-admissible release at 123,902 downloads. Official metadata
declares `NeedsCompilation: no`, GPL, publication on 2023-01-17, R >= 3.2.3, no mandatory package
dependencies, and only optional UI/documentation/testing packages. Its core purpose is formatting R
source text; the optional Shiny interface is not required. The unopened 96,077-byte archive is
pinned by SHA-256 `4ebaab2c3f8527871655246b62abd060bc75dae1cec7f962ca4752b8080f474c` and remains P0
until its scheduled source-blind run.

## Profile 0.363 formatR rotation

The frozen `formatR 1.14` candidate was opened on schedule, moved to the development partition, and
advanced to P5 with deterministic artifact evidence. Retained upstream tests now record the first
blocker in width-sensitive deparse layout. The holdout partition is empty again; another candidate
must be frozen from metadata before its source is inspected.

## Post-0.366 metadata-frozen SQUAREM holdout

After lambda.r reaches P7, the same official PACKAGES and fixed 2026-07-12 through 2026-08-10
cranlogs procedure retains 3,334 admissible releases outside the 58-package corpus. The five
higher-ranked candidates remain excluded for the already recorded clipboard, remote-package,
project-library/lockfile, and credential host-service reasons.

`SQUAREM 2026.1` is next at 116,855 downloads. Official metadata records `NeedsCompilation: no`,
GPL >= 2, publication on 2026-03-12, R >= 4.0 as the only mandatory dependency, and optional
`setRNG` and `interval`. The unopened 240,392-byte source archive is pinned by SHA-256
`e9b32a384876b3a6646ea4262aedd738292220cd1852b2a289855606f56cfcad`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed; its first scheduled failure must drive a
package-neutral implementation increment.

## Profile 0.382 plotrix rotation and scatterplot3d holdout

The scheduled run moves unchanged `plotrix 3.8-14` from source-blind P0 to development P4 after
generic parsing, installation, namespace loading, attachment, documentation, representative
execution, and ordered example progress. Reusable fixes include multi-factor grouping, color
conversion, graphics argument routing, data-frame metadata, clipped hatch rendering, finite range,
and boxplot formula and axis controls. At this profile boundary, `example:election` records generic
`lm` response normalization as the first P5 blocker; the continuation below supersedes that
historical blocker.

`scatterplot3d 0.3-45` replaces it as the sole untouched P0 holdout. The release was selected from
the fixed 2026-07-17 through 2026-08-15 complete CRAN metadata/download comparison after documented
host-service, static-resource, native-development, and package-scaffolding exclusions. Only official
metadata and the 484,624-byte unopened source archive SHA-256 are admitted; it has not been listed,
extracted, parsed, installed, or executed.

## Profile 0.374 pracma rotation

The metadata-frozen `pracma 2.4.6` holdout moves to development P7 after its unchanged archive
passes every applicable generic check. Its optional `NlcOptim` and `quadprog` examples are
not-applicable because those packages are declared Suggests and unavailable; the absent vignette
surface is also not-applicable. Both the official source archive and deterministic evaluated
artifact are pinned by SHA-256.

The source-blind first-blocker sequence selected reusable optimization, interpolation, probability,
linear-algebra, model-matrix, trigonometric, and array/vector semantics. Independent package calls
and package-neutral flat/recursive GNU R evidence prevent package-specific bypasses. The
profile-0.374 corpus has 66 releases: 19 development, 47 regression, no holdout, 57 passing, and 18
at P7. Profile 0.375 then admits boot as the 67th release and moves its evaluated artifact to
regression P4; the next metadata-first holdout has not yet been selected.

## Post-0.374 metadata-frozen boot holdout

The fixed 2026-07-14 through 2026-08-12 metadata/cranlogs comparison selects untouched `boot 1.3-32`
as the next highest-leverage executable pure-R candidate at 79,749 downloads. The five higher-ranked
host-service packages remain excluded from this browser-admissible semantic rotation, and the two
intervening font packages remain deferred because they provide static assets rather than executable
R semantics. Official metadata declares a recommended, non-compiling package depending only on core
`graphics` and `stats`, with `MASS` and `survival` as Suggests.

The unopened 238,282-byte source archive is pinned by SHA-256
`3a05aced6fea42a5c310c5c6ab7a2019f69f757f5e77c4961183977747136c97`. Only public metadata and the
archive digest are admitted at this boundary: the archive remains unlisted, unextracted, unparsed,
uninstalled, and unevaluated at P0 until its scheduled source-blind run. The next candidate must
again be frozen from public metadata before source inspection.

## Profile 0.375 boot P4 evaluation

The scheduled source-blind run opened `boot 1.3-32` only after the P0 record fixed its selection
window, archive size, and source digest. The unchanged archive parses, installs, loads, attaches,
passes its exact export-documentation manifest, and executes representative `boot` and `boot.ci`
examples. Its deterministic installed artifact SHA-256 is
`8a5c4b9b152184ac07c786ab4292f991558d92415fabda8e07ed666daaee012f`.

The ordered rotation selected only shared semantics: noninteractive `graphics::identify`, standard R
source extensions, one-argument `seq`, `lm.influence`, data-frame argument expansion, `xor`,
two-vector `var`, and non-matrix `as.matrix.default` attribute/dimname rebuilding. Fourteen
applicable example topics pass with package-independent flat and recursive GNU R evidence for the
fixes. The ledger moves boot to regression P4 and records `example:control` requiring the missing
shared `stats::smooth.spline` contract as the first P5 blocker. No boot-specific source or runtime
branch is introduced, and later failures do not redefine the ordered blocker.

## Profile 0.376 boot reusable statistics advance

Package-neutral `stats::smooth.spline`, `predict.smooth.spline`, `stats::qqnorm`, `stats::qqplot`,
and `stats::glm.control` implementations, plus explicit missing-package `utils::data` behavior,
advance the unchanged artifact to nineteen passing applicable example topics. Examples requiring
unavailable declared Suggests packages are not applicable, not passed. Flat and recursive GNU R
evidence cover every newly claimed primitive. The ledger retains boot at regression P4 and moves the
ordered blocker to `example:saddle`, which reaches the missing shared `stats::dnorm` primitive;
`example:smooth.f` reaches the same gap. No package, dependency, or dataset identity branch is
permitted.

## Profile 0.377 boot normal-density advance

The package-neutral `stats::dnorm` primitive closes the shared `saddle` and `smooth.f` failures, so
twenty-one applicable example topics now pass. Integration, flat conformance, and recursive GNU R
evidence cover its values, recycling, boundaries, attributes, formals, and condition call. The
ledger retains boot at regression P4 and moves the ordered blocker to `example:tsboot`, which
requires the provenance-gated `datasets::lynx` object. No package or dataset identity branch is
permitted.

## Profile 0.378 boot lynx-data advance

An independent Key2STATS CC0 resource admits all 114 `datasets::lynx` observations through the
generic core-package resource and autoload path. Its source digest, runtime normalization, complete
values, double `ts` shape, attribute order, time coordinates, aggregates, and namespace/search
identity are frozen by provenance documentation plus integration, flat, and recursive GNU R
differential evidence.

The unchanged `boot 1.3-32` artifact remains regression P4 with twenty-one complete applicable
example topics. `example:tsboot` advances past data lookup and now stops at the missing shared
`stats::ar` contract. The ledger records that reusable semantic gap as the first P5 blocker; no
package or dataset identity branch is permitted.

## Profile 0.379 boot autoregression and geometric-random advance

Package-neutral univariate Yule-Walker `stats::ar` and vectorized `stats::rgeom` contracts carry the
unchanged `example:tsboot` path through model fitting and geometric block generation. Integration,
flat conformance, and recursive GNU R evidence cover their result structures, numeric invariants,
boundaries, warnings, and formals without recognizing the package identity.

The ledger retains boot at regression P4 with twenty-one complete applicable example topics and
moves its ordered P5 blocker to missing shared `stats::arima.sim`. Later example failures remain
unobserved and cannot replace that blocker.

## Profile 0.380 boot stationary-ARMA advance

Package-neutral stationary univariate `stats::arima.sim` closes the unchanged `example:tsboot` path
through the ordinary stats registry. Integration, flat conformance, and recursive GNU R evidence
cover explicit and generated innovations, burn-in, stable AR/MA recursion, forwarded generator
arguments, time-series shape, formals, and deterministic unsupported boundaries.

The generic package-check runner now passes every applicable boot step, including the complete
applicable installed Rd example set, and the ledger advances the unchanged artifact to regression
P5. The retained `parallel-censboot.R` test requires unavailable suggested package `survival`;
because an inapplicable test cannot satisfy P6, that dependency closure is the next ordered blocker.
No package identity branch or source rewrite is authorized.

## Post-0.380 metadata-frozen DEoptimR holdout

The reproducible official metadata filter uses the fixed 2026-07-16 through 2026-08-14 cranlogs
window and retains 3,360 current non-native, non-OS-specific candidates whose mandatory dependency
closure is browser core or already passing. Higher-ranked `clipr`, `remotes`, `BiocManager`, `renv`,
and `gitcreds` remain excluded because their primary contracts require host clipboard, remote
package management, project-library/lockfile, or credential services. `fontLiberation` and
`fontBitstreamVera` are deferred because they provide static font resources rather than an
executable R semantic surface.

Untouched `DEoptimR 1.2-0` is therefore the highest-ranked executable candidate at 79,539 downloads.
Official metadata declares `NeedsCompilation: no`, GPL >= 2 licensing, imports only core `stats` and
`methods`, and suggests only `mirai`. Without listing, extracting, parsing, installing, or executing
it, the official 24,134-byte source archive is pinned by SHA-256
`e725f9a49124fe63f7deb57db376efa092cfbe3a1554d9648af84bc31f1c1aa8`. It remains P0 until the
scheduled source-blind evaluation records its first package-neutral blocker.

## Profile 0.381 DEoptimR rotation

The scheduled run opened the archive only after the P0 selection record above. The first failure was
missing shared `methods::formalArgs` during namespace import; after reusable reflection support, all
examples passed and retained tests exposed vectorized `stats::runif` bounds. Package-independent
integration, flat conformance, and recursive GNU R cases cover both contracts.

The unchanged package now passes the complete applicable generic check plan, including all three
help/example topics and all three retained stochastic optimizer tests under an explicit finite
100,000,000-step evidence budget. An independently authored fixed-seed quadratic `JDEoptim` scenario
matches GNU R values and result structure. Deterministic artifact SHA-256 is
`b5c9a2bda1a2b7fff85f6483c219dade876c5d639db01df94eb53d74865a2591`. The ledger moves DEoptimR to
development P7 with no first blocker; no package-specific production behavior or default-limit
relaxation is authorized.

## Post-0.381 metadata-frozen multcompView holdout

The complete official metadata filter and fixed 2026-07-17 through 2026-08-15 cranlogs window retain
3,360 current pure-R candidates whose mandatory dependency closure is browser core or an
already-passing corpus package. Established host-service exclusions remove `clipr`, `remotes`,
`BiocManager`, `renv`, and `gitcreds`; the two higher-ranked font distributions remain deferred
because they expose static resources rather than executable R semantics. Untouched
`multcompView 0.1-12` is therefore the highest-ranked purpose-admissible executable candidate at
76,025 downloads. Its mandatory closure is only core `grid`; all other declared packages are
optional suggestions.

The unopened 159,725-byte source archive is pinned by SHA-256
`444af930d0da731e9be1c191e8ca48acaafbe8a64ef82351f59f9c113c6065b0`. It remains P0 with a null
artifact digest and has not been listed, extracted, parsed, installed, or executed. The scheduled
source-blind evaluation must record its first generic failure before any implementation increment.

## Post-0.371 metadata-frozen permute holdout

The reproducible official metadata filter uses the fixed 2026-07-14 through 2026-08-12 cranlogs
window. After the established host-service exclusions, the two higher-ranked static font-asset
packages remain deferred for this semantic-closure rotation because they provide no executable R
surface. Untouched `permute 0.9-10` is therefore the highest-leverage executable candidate at 82,685
downloads. Metadata records a pure-R GPL-2 package importing only core `stats`; all other declared
packages are optional suggestions.

The unopened 120,438-byte source archive is pinned by SHA-256
`dc182b20d2f0dcafbe0384640b949b9d70faee4cbd20bf88ab55de811b105104`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed; its first scheduled failure must select reusable
semantics, package-system behavior, or test-framework infrastructure rather than a package identity
branch.

## Profile 0.368 snow rotation

The scheduled run opened the frozen archive only after the P0 record above. Unchanged `snow 0.4-4`
passes the complete applicable generic check plan and an independent GNU-matched custom in-memory
transport scenario. Its deterministic artifact SHA-256 is
`560935e2d2c75f3374443e3ebea1b17f7de766778c4611c3f40db3fc47f2f22b`.

The first failure selected package-neutral Base empty/whitespace numeric-text conversion and
character-`NaN` integer warning semantics. The ledger moves snow to development P7 with no current
blocker. This does not claim SOCK/MPI process launch, external networking, optional `rlecuyer`, or
arbitrary pure-R package compatibility; the holdout partition is empty pending another
metadata-first selection.

## Post-0.368 metadata-frozen futile.options holdout

The fixed 2026-07-13 through 2026-08-11 metadata/cranlogs comparison selects untouched
`futile.options 1.0.1` at 101,395 downloads after the recorded host clipboard, remote-package,
project-library/lockfile, and credential-service exclusions. Repository and external-package-cache
searches confirm that it has not previously been evaluated as a dependency. Official metadata
declares `NeedsCompilation: no`, no mandatory or suggested package dependencies, and LGPL-3.

The unopened 3,919-byte archive is pinned by SHA-256
`7a9cc974e09598077b242a1069f7fbf4fa7f85ffe25067f6c4c32314ef532570`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed; its first scheduled failure must select a
package-neutral implementation increment.

## Profile 0.369 futile.options rotation

The scheduled source-blind run opened the archive only after the metadata, usage window, size, and
source digest were frozen. The unchanged package passes all applicable generic checks and an
independent GNU-matched OptionsManager scenario. Deterministic artifact SHA-256 is
`f6634f1724960119dd4f582dd0093e38bd7d4d38582f3cc3920843cc2d0c376a`.

The first scenario failure selected reusable S3 visible-state propagation through `UseMethod()` and
`NextMethod()`. Package-independent integration plus flat and recursive differential cases cover the
fix. The ledger moves `futile.options 1.0.1` to development P7 with no first blocker; the holdout
partition is empty pending another metadata-first selection.

## Post-0.372 metadata-frozen bigD holdout

The reproducible official metadata filter uses the fixed 2026-07-14 through 2026-08-12 cranlogs
window. After the established host-service exclusions, two higher-ranked static font-asset packages
remain deferred because they provide no executable R semantic surface. Untouched `bigD 0.3.1` is
therefore the highest-leverage executable candidate at 82,656 downloads. Metadata records a pure-R
MIT package with no mandatory package imports and optional `testthat` and `vctrs` suggestions.

The unopened 1,310,144-byte source archive is pinned by SHA-256
`86b1b0cf1849f6b1418c3178ab5d7b04682652375c6e90ebac636921de6088d1`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed; its first scheduled failure must select reusable
semantics, package-system behavior, or test-framework infrastructure rather than a package identity
branch.

## Profile 0.373 bigD rotation

The scheduled source-blind run opened the frozen `bigD 0.3.1` archive only after the P0 record fixed
its usage window, source size, and digest. The unchanged package passes every applicable generic
check, including all four runnable Rd examples. Its retained `testthat` launcher is classified
not-applicable because its declared suggested framework is unavailable, and the absent vignette
surface is also not-applicable; the ledger does not represent either as passed. Deterministic
artifact SHA-256 is `e0d2dbed46a7a681989507648a07a1069951970c594a3bfdf4a95f7b42553cda`.

Ordered failures selected reusable bounded package-resource handling, separate reviewed
serialization-input limits, and browser-safe null external-pointer semantics. Package-independent
unit and flat/recursive differential cases cover the fixes. The ledger moves `bigD 0.3.1` to
development P7 with no first blocker; the holdout partition is empty pending another metadata-first
selection.

## Post-0.373 metadata-frozen pracma holdout

The reproducible official metadata filter uses the fixed 2026-07-14 through 2026-08-12 cranlogs
window. After the established host-service exclusions, two higher-ranked static font-asset packages
remain deferred because they provide no executable R semantic surface. Untouched `pracma 2.4.6` is
therefore the highest-leverage executable candidate at 80,335 downloads. Metadata records a pure-R
GPL-3-or-later package importing only core graphics, grDevices, stats, and utils; `NlcOptim` and
`quadprog` are optional suggestions.

The unopened 398,691-byte source archive is pinned by SHA-256
`1857b831ec7da6eb651574ccdb12e1baef4c7150cbdc6380cf9fd70e60ae4552`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed; its first scheduled failure must select reusable
semantics, package-system behavior, or test-framework infrastructure rather than a package identity
branch.

## Post-0.369 metadata-frozen futile.logger holdout

The reproducible official metadata filter now covers the fixed 2026-07-14 through 2026-08-12
cranlogs window. After the established host-service exclusions, untouched `futile.logger 1.4.9` is
the highest-ranked purpose-admissible candidate at 118,068 downloads. Official metadata records a
pure-R LGPL-3 package whose mandatory dependency closure is `utils`, `lambda.r`, and
`futile.options`; both non-core imports already have pinned P7 evidence.

The unopened 24,311-byte source archive is pinned by SHA-256
`496bedbe2e52d06db22a4d659b8e7dd9ad0f1d1f95ead459ec02d05d0ac2b3d6`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed. Its first scheduled generic failure must select
reusable semantics, package-system behavior, or dependency closure rather than a package identity
branch.

## Profile 0.370 futile.logger rotation

The scheduled source-blind run opened the frozen `futile.logger 1.4.9` archive only after the P0
record fixed its selection window, source size, and digest. The unchanged package plus the declared
`testit` dependency required by its retained top-level test pass the complete applicable generic
check plan and an independently authored logger hierarchy scenario. Deterministic artifact SHA-256
is `d021ece3671228382bd30cb9cb08392c2ca08794aa9f3d5e8c817f128f724bbc`.

Ordered failures selected reusable character-condition, numeric-group ordering, environment-format,
and `tryCatch()` handler-list semantics. Package-independent integration and flat/recursive GNU R
differential cases cover the fixes. The ledger moves `futile.logger 1.4.9` to development P7 with no
first blocker; the holdout partition is empty pending another metadata-first selection.

## Post-0.370 metadata-frozen tinytest holdout

The reproducible official metadata filter uses the fixed 2026-07-14 through 2026-08-12 cranlogs
window. After the established host-service exclusions, the two higher-ranked static font-asset
packages are deferred for this semantic-closure rotation because they provide no executable R
surface. Untouched `tinytest 1.4.3` is therefore the highest-leverage executable candidate at 85,045
downloads. Metadata records a pure-R GPL-3 package importing only `parallel` and `utils`, with no
suggested packages.

The unopened 595,901-byte source archive is pinned by SHA-256
`ecc3a398690e72ca70127c1177e1f78b602dc5062f1597b897255bcc33c38375`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed; its first scheduled failure must select reusable
semantics, package-system behavior, or test-framework infrastructure rather than a package identity
branch.

## Profile 0.371 tinytest rotation

The scheduled source-blind run opened the frozen `tinytest 1.4.3` archive only after the P0 record
fixed its selection window, source size, and digest. The unchanged package passes the complete
applicable generic check plan and its retained 159-test top-level self-test. Deterministic artifact
SHA-256 is `9ec3cb4437f8d96b05e8b69d092b20bbd23758ab653eaf99940387f09d43e0a2`.

Ordered failures selected reusable argument matching, system-frame, browser-owned parsing and
connection, factor/table, regex replacement, core-data, and condition signaling semantics.
Package-independent integration and flat/recursive GNU R differential cases cover the fixes. The
ledger moves `tinytest 1.4.3` to development P7 with no first blocker; the holdout partition is
empty pending another metadata-first selection.

## Profile 0.372 permute rotation

The scheduled source-blind run opened the frozen `permute 0.9-10` archive only after the P0 record
fixed its usage window, source size, and digest. The unchanged package passes every applicable
generic check, including all runnable Rd examples and its vignette. The retained `testthat` launcher
is classified not-applicable because its declared suggested framework is unavailable; the ledger
does not represent it as passed. Deterministic artifact SHA-256 is
`a24290e5e4172d2fb193a4fb41d6cfdd48a852823447bd0a52af0f752191191d`.

Ordered failures selected reusable exact extraction, language conversion, log-factorial,
argument-frame, condition/restart, cumulative, `unsplit()`, formula-graphics, and formula-statistics
semantics. Package-independent integration and flat/recursive GNU R differential cases cover the
fixes. The ledger moves `permute 0.9-10` to development P7 with no first blocker; the holdout
partition is empty pending another metadata-first selection.

## Profile 0.367 SQUAREM rotation

The scheduled source-blind run opened the frozen archive only after the P0 record above. The
unchanged package and pure-R `setRNG` dependency pass the complete applicable generic check plan and
an independent affine fixed-point scenario. Deterministic artifact SHA-256 is
`1f257cbdf4ac16d1dabfb9415e795819c5387819f413798a0a73c435c5d61b29`.

Ordered failures selected package-neutral `utils::modifyList`, Box-Muller paired-cache semantics,
`qr()` generic dots/default forwarding, and `solve.qr`. The ledger moves SQUAREM to development P7
with no first blocker. Optional `interval` reaches native `survival` and remains outside the
applicable pure-R check surface. The holdout partition is empty pending another metadata-first
selection.

## Post-0.367 metadata-frozen snow holdout

The reproducible official metadata filter now covers the fixed 2026-07-13 through 2026-08-11
cranlogs window. Higher-ranked `clipr`, `remotes`, `BiocManager`, `renv`, and `gitcreds` remain
excluded because their primary contracts require host clipboard, remote package management,
project-library/lockfile, or credential services.

`snow 0.4-4` is the next purpose-admissible release at 112,959 downloads. Official metadata declares
`NeedsCompilation: no`, `utils` as its only mandatory package dependency, optional `rlecuyer`, and
GPL licensing. The unopened 20,464-byte source archive is pinned by SHA-256
`84587f46f222a96f3e2fde10ad6ec6ddbd878f4e917cd926d632f61a87db13c9`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed; its first scheduled failure must drive a
package-neutral implementation increment.

## Profile 0.383 plotrix continuation

The same unchanged `plotrix 3.8-14` artifact advances source-blind through the former election/model
blocker and successive examples. Ordered failures select reusable model-frame, array, axis, palette,
legend, stripchart, membership, apply, argument-matching, physical-symbol, pie, perspective,
expression-text, recursive-range, barplot, callable-lookup, and repetition semantics. Each fix lives
in a shared runtime, base, model, or graphics layer and has package-independent integration plus
flat or recursive differential evidence.

Complete examples remain short of P5. The current first failure is `example:raw.means.plot`: an
upstream grouping/factor cardinality divergence reaches `rep(1:n.x, vapply(lst, length, 0))` with
two source values and four repetition counts. The same cardinalities are invalid in GNU R, so
`rep()` remains strict and the next investigation starts before that call. The deterministic
installed artifact digest remains
`abab2abfc7544a7afdefb242f5de5be79cbda360ab1f9c68e04fe691a079f143`.

The next continuation resolves that failure as missing-row whole-column data-frame assignment, which
had discarded factor attributes before grouping. Shared data-frame replacement/attribute order,
arithmetic Ops, plot-control forwarding, unknown-parameter warning, and NULL-label text contracts
then advance the same unchanged artifact through `raw.means.plot`, `soil.texture`, `staircasePlot`,
and `triax.fill`. The current first P5 blocker is `example:twoord.plot` at the generic
`base::seq.Date` date-sequence contract; the artifact remains P4.

## Profile 0.384 plotrix P7 promotion

The same unchanged artifact now completes its standard package-check plan. Generic `seq.Date`
semantics close `example:twoord.plot`; `graphics::axis.Date` completes its Date-axis call; shared
GNU-compatible `rect()` parameter forwarding closes `example:twoord.stackplot`; and recognized
graphical-control forwarding in `polygon()` closes `example:violin_plot`. Subsequent installed
examples and every other applicable planned check pass without a package-name branch, source
rewrite, fixture shortcut, or substituted result.

The ledger advances the exact artifact digest
`abab2abfc7544a7afdefb242f5de5be79cbda360ab1f9c68e04fe691a079f143` from development P4 to P7 with
`firstBlocker: null`. This promotion is evidence for one pinned unchanged release and does not claim
arbitrary pure-R package compatibility or completion of the program objective.

## Profile 0.385 scatterplot3d P7 promotion

The scheduled source-blind `scatterplot3d 0.3-45` archive is now a development regression target.
Its deterministic installed artifact digest is
`61c69a67ab1f2d24456c0d352b0ba62adeb12c8abeb30ec259d9b1cea34d915d`. Generic `xyz.coords`, recursive
data-frame list expansion, plot-window missing-aspect handling, and the provenance-audited `trees`
package resource close its ordered blockers. All applicable package-check steps pass unchanged, so
the ledger records P7 with `firstBlocker: null`; the promotion does not generalize the claim beyond
this pinned artifact.

## Post-0.385 metadata-frozen xmlparsedata holdout

The reproducible official metadata filter uses the fixed 2026-07-17 through 2026-08-15 cranlogs
window. Higher-ranked candidates remain excluded because their primary contracts require host
clipboard access, remote package management, project-library or lockfile management, credential
services, static font distribution, or native-development headers. Untouched `xmlparsedata 1.0.5` is
therefore the highest-ranked purpose-admissible executable candidate at 62,272 downloads. Official
metadata declares `NeedsCompilation: no`, no mandatory package dependencies, optional `covr`,
`testthat`, and `xml2` suggestions, and an MIT license with a packaged license file.

The unopened official 8,993-byte source archive is pinned by SHA-256
`766034ab5e9728609bd240c9954d23ca0cdb881a98a31b9d3e1c8767c7b7cbb0`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed. Its first scheduled failure must select a
reusable language, parse-data, namespace, package-system, or test-infrastructure contract rather
than a package identity branch.

## Profile 0.386 xmlparsedata source-blind P7 evidence

The scheduled run opened the frozen `xmlparsedata 1.0.5` archive only after the P0 record fixed its
selection window, source size, and digest. The unchanged archive passes metadata, all R-source
parsing, namespace loading, attachment, complete export documentation, installed examples, retained
test classification, and every applicable generic package-check step without exposing a blocker. The
deterministic installed artifact SHA-256 is
`db99c63faf1c13cbf36d7d48228f637e71fb8f8c1b0e090134456f8b46ff0c75`.

A separately authored data-frame scenario exercises pretty XML construction, location attributes,
XML escaping, and the exported token map; its exact result matches the available non-normative GNU R
4.6.0 black-box advisor. No package-specific runtime branch or source rewrite was needed. The ledger
moves the pinned release to development P7 with no first blocker; the holdout partition is again
empty pending the next metadata-first selection.

## Profile 0.387 mitools source-blind P7 evidence

The reproducible official metadata filter reuses the fixed 2026-07-17 through 2026-08-15 cranlogs
window after promoting `xmlparsedata`. Higher-ranked candidates remain excluded because their
primary contracts require host clipboard access, remote package management, project-library or
lockfile management, credential services, static font distribution, native-development headers, or
package scaffolding. Untouched `mitools 2.4` is therefore the highest-ranked purpose-admissible
executable candidate at 60,180 downloads. Official metadata declares `NeedsCompilation: no`,
mandatory `DBI`, `methods`, and `stats` dependencies, optional `RODBC` and `foreign` suggestions,
and GPL-2 licensing. `DBI` is already a pinned passing corpus dependency; the other mandatory
dependencies are browser-core packages.

The official 229,514-byte source archive was pinned while unopened at SHA-256
`f204f3774e29d79810f579f128de892539518f2cbe6ed237e08c8e7283155d30`. Only after that P0 record was
frozen did scheduled execution list, extract, parse, install, or run the source. Ordered package
failures selected five package-neutral contracts: lazy S3 dispatch for `with()`, preservation of the
original actual arguments when `UseMethod()` selects on an explicit object, formula
class/environment preservation through call-like subset selection, recursive expansion of
parenthesized additions inside formula `*` terms, and `with()` S3 dispatch before the default
method's required-`expr` validation.

With those shared semantics, the unchanged package passes metadata, dependency closure, all R-source
parsing, namespace loading, attachment, complete export documentation, installed examples,
retained-test handling, and every applicable generic package-check step. Its deterministic installed
artifact SHA-256 is `73ad17952b11912b871aea7e35c13643fe3da05a9801e90aa2e0bd847c053c03`. A separately
authored synthetic `imputationList` scenario covers generic construction, `with()` dispatch,
data-mask evaluation, and mean/variance summaries across multiple imputations. The release advances
to development P7 with no first blocker. No production branch recognizes `mitools`, rewrites its
source, or substitutes its results; the P7 claim remains scoped to this pinned artifact and
exercised browser-admissible surface.

## Post-0.387 metadata-frozen logger holdout

The reproducible official metadata filter reuses the fixed 2026-07-17 through 2026-08-15 cranlogs
window after promoting `mitools`. Higher-ranked candidates remain excluded because their primary
contracts require host clipboard access, remote package management, project-library or lockfile
management, credential services, static font distribution, native-development headers, or package
scaffolding. Untouched `logger 0.4.2` is therefore the highest-ranked purpose-admissible executable
candidate at 59,830 downloads. Official metadata declares `NeedsCompilation: no`, a mandatory
`utils` import, optional integrations and development suggestions, and MIT licensing with a LICENSE
file.

The unopened official 1,194,446-byte source archive is pinned by SHA-256
`0abd2d28518ee2bc8788aeee203acfd5c1431f5ba118b451322cf03bd82d9a93`. It remains P0 and has not been
listed, extracted, parsed, installed, or executed. Its first scheduled failure must select a
reusable language, condition, formatting, I/O, namespace, dependency, package-system, or
test-infrastructure contract rather than a package identity branch.

## Profile 0.388 logger source-blind P4 evidence

The scheduled run opened the frozen archive only after its P0 record fixed the selection evidence,
size, and source digest. The first unchanged namespace-load failure was the missing exported
`utils::assignInMyNamespace` import. Shared `assignInMyNamespace()` and `assignInNamespace()`
implement existing-binding replacement with lock restoration, invisible `NULL`, exact public
formals, calling-namespace inference, explicit namespace selection, and deterministic boundary
errors. No production path recognizes `logger` or modifies its source.

The deterministic installed artifact SHA-256 is
`cfb27f5576bc0ba194ce90f05d12288d28eb12303e6298faad0dc65a5d02a24f`. It passes P0-P3 and a P4
independent logging scenario using `formatter_sprintf`, a custom layout, and a custom appender. The
ordered P5 blocker is `example:appender_file`: the suggested `glue` dependency is absent, so logger
uses its strict `sprintf` fallback and supplies a bare numeric message. Advisory GNU R 4.6.0 without
`glue` produces the identical error. The ledger therefore records the optional `glue` dependency and
native-code closure rather than weakening a correct Base formatter contract.

## Post-0.388 metadata-frozen gridGraphics holdout

After recording logger's P4 native-dependency boundary, the reproducible official metadata filter
again uses the fixed 2026-07-17 through 2026-08-15 cranlogs window. The established exclusions cover
host clipboard, remote package management, project lockfiles, credential services, static font
distributions, native-development headers, and package scaffolding. Untouched `gridGraphics 0.5-1`
is the next highest-ranked purpose-admissible executable candidate at 59,758 downloads. Its
mandatory dependency closure is entirely browser core: `grid`, `graphics`, and `grDevices`; `magick`
and `pdftools` are optional suggestions. Official metadata declares `NeedsCompilation: no` and
GPL >= 2 licensing.

The official 69,207-byte archive is pinned while unopened at SHA-256
`29086e94e63891884c933b186b35511aac2a2f9c56967a72e4050e2980e7da8b`. It remains P0 with no
installed-artifact digest and has not been listed, extracted, parsed, installed, or executed. Its
scheduled first failure must select reusable graphics, grid, device, namespace, package-system, or
check-runner behavior rather than a package identity branch.

## Profile 0.389 gridGraphics source-blind P1 evidence

Scheduled evaluation opened the frozen `gridGraphics 0.5-1` archive only after the P0 ledger and
generated status agreed. The first unchanged run stopped at missing imported `grDevices::axisTicks`.
A package-neutral implementation now owns linear/logarithmic scale selection, explicit `axp` codes,
`.axisPars` derivation, reversed extents, short-span log linearization, decade subdivisions,
wide-range thinning, and public formals, with integration and flat/recursive black-box evidence.

The installed artifact SHA-256 is
`74079d0602a9ff7d52ce7e2f954df44fc45317d2da2323ede8ae4bb25b130f88`. The unchanged artifact passes
metadata and all R-source parsing at P1, then fails namespace loading at the next missing import,
`grDevices::contourLines`. The ledger records that exact graphics-contour blocker rather than
claiming package loading or adding a package identity branch.

## Profile 0.390 gridGraphics source-blind P1 evidence

The unchanged artifact was rerun after adding shared device-independent `grDevices::contourLines`
semantics. Numeric integration plus flat and recursive GNU black-box evidence covers topology,
missing cells, equality handling, packed inputs, limits, and diagnostics. Namespace processing now
passes the former import and stops at `grid::makeContent`. The frozen source and installed digests
are unchanged, the tier remains P1, and no production path recognizes `gridGraphics`.

## Profile 0.391 gridGraphics source-blind P5 evidence

Package-neutral grid lifecycle generics remove the former namespace blocker. The unchanged artifact
loads and attaches, registers `makeContent.echogrob` against the imported `grid::makeContent`
generic, and passes installed documentation plus every applicable example through the same generic
runner used by the corpus. Frozen source SHA-256
`29086e94e63891884c933b186b35511aac2a2f9c56967a72e4050e2980e7da8b` and installed artifact SHA-256
`74079d0602a9ff7d52ce7e2f954df44fc45317d2da2323ede8ae4bb25b130f88` are unchanged.

The first retained test stops at `demo-graphics.R` expression 16 with missing
`grDevices::pdf.options`; the ledger therefore records development P5 and that reusable device-state
blocker. No package identity branch, rewritten source, skipped applicable example, or higher-tier
claim is introduced.

## Profile 0.392 gridGraphics writable-sandbox blocker

The generic PDF option state removes retained expression 16 without changing the frozen source or
installed artifact. The unchanged `gridGraphics 0.5-1` test now reaches expression 17, where its
ordinary plotting helper requests relative generated files. Because the standard runner currently
uses the immutable installed test directory as its working directory, the ledger records a
package-check filesystem blocker: provide a writable isolated browser-memory working directory and
resolve relative paths within it. Development remains P5; no test is skipped and no package identity
branch or higher-tier claim is added.

## Profile 0.393 gridGraphics recorded-display-list blocker

The generic check runner now copies installed tests and resources to a fresh writable browser-memory
directory, preserving the installed artifact. Shared viewport-tree navigation and justification
normalization then carry the unchanged `gridGraphics 0.5-1` retained test through its former
filesystem and viewport failures. At expression 17, the first recorded plotting operation completes,
while the next display-list entry lacks the GNU-compatible named `C_*` operation descriptor expected
by generic dispatch. The ledger therefore records `graphics.recordedplot` as the first blocker.
Development remains P5; no test is skipped and no package identity branch, source rewrite, or
higher-tier claim is added.

## Profile 0.395 gridGraphics composite-journal blocker

Generic grid drawing grobs and primitive recorded-operation descriptors carry the unchanged artifact
through its first three visual comparison scenarios. Expression 20 next exposes the runtime's
aggregated boxplot journal entry, which must be lowered to the ordered GNU-compatible primitive
display-list operations. The ledger records that reusable blocker and retains development P5 without
skips, rewrites, or package identity branches.

## Profile 0.398 modeltools rotation

After the `volcano` provenance audit remained unresolved, the next metadata-first rotation froze
`modeltools 0.2-24` before source inspection. The unchanged artifact reaches P4 after generic
cleanup-only hook classification, `stats4` dependency registration, S4 prototype defaults, and
`logLik` dispatch. Its first P5 blocker is `example:MEapply` at the shared S4 `$` contract.

## Profile 0.397 gridGraphics core-data blocker

The reusable numeric `pairs` path carries the unchanged retained test through expressions 24 and 25.
Expression 26 first requests `datasets::volcano`; the ledger therefore moves to the core-data
provenance domain. The matrix may be added only from an independently auditable lawful source with
frozen dimensions, storage mode, value checksum, and identity evidence. Development remains P5; no
package source, test, or production identity branch is changed.

## Profile 0.396 gridGraphics pairs blocker

Generic `recordPlot()` lowering now exposes each composite boxplot as the ordered primitive
operations consumed by the unchanged artifact, removing the expression-20 failure and carrying the
retained test through expression 23. Expression 24 reaches `pairs.default`, whose reusable
scatterplot matrix layout, panel callbacks, axes, and recorded operations remain outside the current
browser graphics slice. The ledger records that first blocker and retains development P5 without
skips, rewrites, or package identity branches.

## Profile 0.399 modeltools ordered blocker

Source-blind execution now carries the unchanged artifact through `example:MEapply` using only
shared language, model-frame, and S4 primitives. Its first applicable failing step becomes
`example:ModelEnvFormula`, with evidence id
`modeltools-0.2-24-example-model-env-formula-callable-contrast`. The blocker belongs to the
`stats.model.contrasts` domain: a callable contrast generator must be invoked generically and its
returned matrix validated through the same path as string-selected and explicit matrix contrasts.

## Profile 0.400 modeltools P5 and retained-test blocker

The generic callable-contrast path and direct single-/multiple-response `stats::lm.fit()` remove the
remaining installed-example blockers. The frozen artifact advances to P5. Its ordered first P6
failure is `tests/regtest.R` expression 6 with evidence id
`modeltools-0.2-24-test-regtest-expression-6-synchronized-omit`: `na.omit()` leaves the S4 model
environment's design and response components at different row counts. Any repair must be a shared
S4/data omission contract; identity checks, test skips, source patches, and relaxed fitter
validation remain prohibited.

## Profile 0.401 result

The frozen modeltools 0.2-24 artifact now passes all installed examples, all 46 retained `regtest.R`
expressions, all applicable package checks, and the independent synchronized-omission scenario. Its
corpus entry advances to P7 with no first blocker. This is a scoped result for the pinned artifact
and current admissible checks; it does not complete the general package pipeline.

## Profile 0.402 result

Unchanged ellipse 0.5.0 was frozen at P0 before source inspection, then evaluated through the same
generic pipeline. Shared central qchisq/qf semantics close its namespace blockers and an independent
scenario passes. The artifact moves to development P4 with `example:ellipse.arima0` as its explicit
first blocker. The holdout partition returns to zero and must be replenished metadata-first.

## Profile 0.403 result

Unchanged GlobalOptions 0.1.4 was frozen at P0 before inspection. Its source-blind namespace failure
selected `utils::findMatches`; the next ordered example failure selected Reference Class
`callSuper()`. Both were implemented at shared layers with flat and recursive GNU R evidence. The
pinned deterministic artifact passes every applicable check plus an independent scenario and moves
to development P7. Its optional testthat launcher is explicitly not applicable. The holdout
partition returns to zero and must be replenished metadata-first.

## Profile 0.404 result

Unchanged rbenchmark 1.0.1 was frozen at P0 before inspection. Its first source-blind failure
selected the generic language/expression-vector `mapply` contract and call-head character rendering.
The pinned artifact now passes installation, namespace, attachment, metadata, documentation
preflight, and an independent bounded benchmark at P4. Its installed example exceeds the
deterministic package-test step limit and is retained as the explicit P5 resource blocker. Unchanged
ca 0.71.1 is frozen as the next unevaluated P0 holdout; no source content has been listed or read.

## Profile 0.405 result

Unchanged ca 0.71.1 was evaluated only after its P0 metadata and source hash were frozen. Its
ordered failures selected shared optional-S3, table, core-data, graphics-character,
string-abbreviation, and data-frame naming contracts. The deterministic artifact passes all
applicable checks and a separate GNU R-backed numeric scenario, so it moves to development P7 with
no first blocker. The result is scoped to the pinned artifact and exercised checks; arbitrary pure-R
packages remain incomplete.

The holdout partition is replenished with unopened nortest 1.0-4. Official metadata reports
NeedsCompilation:no and only a browser-core stats import. The 6,179-byte archive and its SHA-256 are
frozen, but evaluation and source inspection remain prohibited until the next scheduled rotation.

## Post-Profile 0.405 nortest result

Unchanged nortest 1.0-4 was evaluated only after its P0 metadata and source digest were frozen. It
needed no package-specific accommodation and no new primitive: the generic pipeline installs, loads,
attaches, documents, and executes every applicable Rd example plus an independently authored
scenario covering all five exports. Its deterministic artifact is pinned and advances to development
P7 with no first blocker. Tests and vignettes are absent and therefore explicitly not-applicable
rather than inferred to pass.

The holdout partition is replenished with unopened tensor 1.5.1. Metadata-first selection records
its ranking window, 38,437-download count, dependency-free and NeedsCompilation:no declarations,
2,541-byte archive size, and source SHA-256. Archive listing, source inspection, installation, and
execution remain prohibited until its scheduled rotation.

## Profile 0.406 tensor result

Unchanged tensor 1.5.1 was evaluated only after its P0 metadata and source digest were frozen. Its
first run selected the shared `dim<-` name/dimension-name cleanup contract. With that
package-neutral fix and GNU R evidence in place, the deterministic artifact passes every applicable
generic check, its installed example, and an independent contraction scenario, reaching development
P7 with no remaining blocker. Tests and vignettes are absent and explicitly not-applicable.

The holdout partition is replenished with unopened registry 0.5-1. Metadata-first selection records
its fixed-window usage rank, R and utils dependency closure, NeedsCompilation:no declaration,
170,969-byte archive size, and source SHA-256. The official index advertises a vignette, but the
archive and all executable or documentation content remain uninspected until the scheduled run.

## Profile 0.407 registry result

Unchanged registry 0.5-1 was evaluated only after its P0 metadata and source digest were frozen. Its
first run exposed the shared absence of callable `[[<-`; after that package-neutral replacement
contract, the retained test exposed missing installed-package demo discovery. The generic demo
resource path now discovers, catalogs, decodes, attaches, and evaluates browser-owned scripts. The
deterministic artifact passes every applicable check, including all examples, the retained test,
vignette discovery, and an independent behavioral scenario, reaching development P7 with no package
identity branch or source rewrite.

The holdout partition is replenished with unopened corpcor 1.6.10. Metadata-first selection records
its fixed-window usage rank, stats-only dependency closure, NeedsCompilation:no declaration,
22,678-byte archive size, and source SHA-256. Archive listing, source inspection, installation, and
execution remain prohibited until its scheduled rotation.

## Profile 0.408 corpcor result

Unchanged corpcor 1.6.10 was evaluated only after its P0 metadata and source digest were frozen. Its
first run selected the shared wide-matrix SVD allocation strategy: the prior implementation always
formed `X'X`, so a 50-by-5,000 documented example exceeded the bounded vector ceiling. The generic
SVD now chooses the smaller Gram matrix and reconstructs and completes both singular-vector bases.
The deterministic artifact passes every applicable package check, all 13 installed examples, and an
independent scenario spanning all 29 exports, reaching development P7 with no package identity
branch, source rewrite, or relaxed resource limit.

The holdout partition is replenished with unopened vipor 0.4.7. Metadata-first selection records its
fixed-window 33,579-download count, stats-and-graphics core dependency closure, NeedsCompilation:no
declaration, 4,688,496-byte archive size, and source SHA-256. Archive listing, source inspection,
installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.409 vipor result

Unchanged vipor 0.4.7 was evaluated only after its P0 metadata and source digest were frozen. Its
ordered failures selected shared `split<-` replacement, `plot.default(las=)` admission, and
ANSI_X3.4-1968 package-data decoding. Once those package-neutral contracts were present, the full
generic check passed. An independent scenario spanning all 13 exports additionally selected the
correct `stats::ave` namespace export. The deterministic artifact passes every applicable check, all
13 examples, both vignettes, and the GNU R-matched scenario, reaching development P7 with no package
identity branch, source rewrite, or relaxed resource limit.

The holdout partition is replenished with unopened dynamicTreeCut 1.63-1. Metadata-first selection
records its fixed-window 33,315-download count, stats-only core dependency closure,
NeedsCompilation:no declaration, 24,027-byte archive size, and source SHA-256
`831307f64eddd68dcf01bbe2963be99e5cde65a636a13ce9de229777285e4db9`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.419 rotation record

The frozen timeSeries 4052.112 artifact was opened on schedule. Ordered unchanged execution selected
only reusable statistical smoothing, S4 vector/generic fallback, aggregate/filter/product,
core-data, year-day parsing, and POSIX sequence contracts. Its deterministic installed artifact
SHA-256 is `81c1ce37173db4a98b93945ac65460c03d34b60df6bcfaece377241ca8d85631`. Every applicable
generic check and an independent GNU R-matched multivariate time-series scenario pass without source
rewriting or a package identity branch.

The holdout partition is replenished with unopened pls 2.9-0. Metadata-first selection records its
fixed-window 25,918-download count, browser-core dependency closure, `NeedsCompilation: no`
declaration, 4,371,152-byte archive size, and source SHA-256
`fd99cba675b189bda7dbfe56ad2e3c187dc0942a0ac53839dccd64ddfae78e1f`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.416 rotation record

ica 1.0-3 advances from holdout P0 to development P7 after its ordered blockers led to reusable
exponential and central Student-t density closure. Its deterministic artifact is pinned, every
applicable generic check passes, and separately authored evidence covers all exports plus ACY and a
complete one-component FastICA object. No package-specific runtime branch or source rewrite was
introduced.

The holdout partition is replenished with unopened proto 1.0.0. Metadata-first selection records its
fixed-window 27,390-download count, empty mandatory package dependency closure, NeedsCompilation:no
declaration, 541,398-byte archive size, and source SHA-256
`9294d9a3b2b680bb6fac17000bfc97453d77c87ef68cfd609b4c4eb6d11d04d1`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.415 rotation record

RUnit 0.4.33.1 advances from holdout P0 to development P7 after its ordered blockers led to direct
numeric-comparison and methods generic-introspection closure. Its deterministic artifact is pinned,
every applicable generic check passes, and separately authored GNU-matched evidence covers all
exports and representative unit-check/tracker behavior. No package-specific runtime branch or source
rewrite was introduced.

The holdout partition is replenished with unopened ica 1.0-3. Metadata-first selection records its
fixed-window 27,832-download count, empty mandatory dependency closure, NeedsCompilation:no
declaration, 12,825-byte archive size, and source SHA-256
`474d3530b16b76a1bf1a1114d24092678ea7215fa57c6fdcee6333f1e768b865`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.414 rotation record

dichromat 2.0-1 advances from holdout P0 to development P7 after its first generic blocker led to
numeric `predict.loess` closure. Its deterministic artifact is pinned, every applicable generic
check passes, and separately authored GNU-matched evidence covers both exports and representative
color/data behavior. No package-specific runtime branch or source rewrite was introduced.

The holdout partition is replenished with unopened RUnit 0.4.33.1. Metadata-first selection records
its fixed-window 25,985-download count, browser-core-only mandatory dependency closure,
NeedsCompilation:no declaration, 180,317-byte archive size, and source SHA-256
`8528fa3ba8d04a6e71783f01ba3e1163b5900c6b3c2bc81bad2349e220197f05`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.413 rotation record

RSpincalc 1.0.2 advances from holdout P0 to development P7 after its first generic blocker led to
N-dimensional `apply()` closure. Its deterministic artifact is pinned, every applicable generic
check passes, and separately authored GNU-matched evidence covers the public namespace and
representative quaternion/rotation behavior. No package-specific runtime branch or source rewrite
was introduced.

The holdout partition is replenished with unopened dichromat 2.0-1. Metadata-first selection records
its fixed-window 26,939-download count, browser-core-only dependency closure, NeedsCompilation:no
declaration, 128,443-byte archive size, and source SHA-256
`19375b11583bc45bc4710c4435cf1232aa1fd8fdd8746f3997f5fb98c792d95a`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.410 rotation record

The frozen dynamicTreeCut 1.63-1 artifact was opened on schedule and advanced from P0 to development
P7 after two ordered, reusable blockers were closed: one-dimensional table sort/subset metadata and
Base `charmatch()` semantics. The deterministic installed artifact SHA-256 is
`4f6d0df429642da937f7d76730ef89201f55ddeb839b6567066100887cd42016`. Installation, namespace and
attachment lifecycle, all six exports, eight documentation steps, two examples, absent-test and
absent-vignette checks, and an independent GNU R-matched scenario pass without source rewriting or a
package identity branch.

The holdout partition is replenished with unopened pixmap 0.4-14. Metadata-first selection records
its fixed-window 31,237-download count, browser-core methods/graphics/grDevices dependency closure,
NeedsCompilation:no declaration, 37,054-byte archive size, and source SHA-256
`26710c931f95b89b66b50e3ee1c4b6e1ba383b8067f80b3d7de2f0d58cb9fa9`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.411 rotation record

The frozen pixmap 0.4-14 artifact was opened on schedule. Ordered unchanged execution selected
target-aware registered S4 coercion, inherited parent-object initialization, `slot()`/`slot<-`, and
`image.default(asp=)` as reusable contracts. The deterministic installed artifact SHA-256 is
`6951089f6601dee90417f06ef27d06491c2159195859bb997aab310936ffa380`. Six documentation steps, four
examples, both retained tests, and an independent GNU R-matched image-object scenario pass. The GNU
R 4.5 startup/platform/timing `.Rout.save` is explicitly not applicable; its test still passes.

The holdout partition is replenished with unopened moments 0.14.1. Metadata-first selection records
its fixed-window 30,170-download count, empty mandatory package dependency closure,
NeedsCompilation:no declaration, 7,640-byte archive size, and source SHA-256
`2ed2b84802da132ae0cf826a65de5bfa85042b82e086be844002fe1ce270d864`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.412 rotation record

The frozen moments 0.14.1 artifact was opened on schedule and passed every applicable generic check
on its first run. Its deterministic installed artifact SHA-256 is
`205770aa5cb2912fada6ef201ba7a3eab6215cd80696471e0e8c568f717a4ab6`. Thirteen documentation checks,
all 12 examples, absent-test and absent-vignette classification, and an independent GNU R-matched
all-export scenario pass without source rewriting, package identity logic, or a new runtime
primitive. The numeric scenario records a nine-decimal tolerance for sub-ULP high-order tails.

The holdout partition is replenished with unopened RSpincalc 1.0.2. Metadata-first selection records
its fixed-window 28,766-download count, empty mandatory package dependency closure,
NeedsCompilation:no declaration, 16,542-byte archive size, and source SHA-256
`fa8c867ba4d0b393982e671a5872ae097214270ab2ffbb8262ebfe15bee3d225`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.417 rotation record

The frozen proto 1.0.0 artifact was opened on schedule. Ordered unchanged execution selected
environment-reference deparsing, `eapply()` traversal/callback semantics, and preservation of S3
subset target syntax as reusable contracts. Its deterministic installed artifact SHA-256 is
`70b797c90818d74e30973e884fd769fb5b4e56208aa042543086fa70d01d0757`. Complete applicable generic
checks and an independent GNU-matched inheritance/mutation scenario pass without source rewriting or
a package identity branch.

The holdout partition is replenished with unopened NLP 0.3-3. Metadata-first selection records its
fixed-window 26,367-download count, browser-core utils dependency closure, NeedsCompilation:no
declaration, 148,952-byte archive size, and source SHA-256
`65abee2eb654cd5bf4e7e52b01055ba22c077bb6f1f64e39b3f9aa9b22e3cec8`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.418 rotation record

The frozen NLP 0.3-3 artifact was opened on schedule. Ordered unchanged execution selected actual
argument counting, generic S3 call frames, explicit ISO/date-time parsing, DCF output, and character
sequence endpoints as reusable contracts. Its deterministic installed artifact SHA-256 is
`402e66dd96238f942c902001fb45f4c76d47f319ea8ee1f04ecc42e797f89eab`. Complete applicable generic
checks and an independent GNU-matched annotation/token/feature/date-time scenario pass without
source rewriting or a package identity branch.

The holdout partition is replenished with unopened timeSeries 4052.112. Metadata-first selection
records its fixed-window 25,290-download count, browser-core dependency closure,
`NeedsCompilation: no` declaration, 1,457,372-byte archive size, and source SHA-256
`c4e50a669cfa34814a71e47bb93020442ec40694fc3f1c7bcd94edf2368c6993`. Archive listing, source
inspection, installation, and execution remain prohibited until its scheduled rotation.

## Profile 0.421 rotation record

The frozen `pls` 2.9-0 artifact was opened on schedule only after its metadata, usage window, source
size, dependency surface, and source digest were fixed. Ordered unchanged execution selected
matrix-valued `AsIs` data-frame subsetting, generic terms/model-matrix and character formula-update
behavior, observable QR transforms and triangular solves, and lazy `matplot` panel lifecycle as
reusable contracts. The deterministic installed artifact SHA-256 is
`282bafa4753ea45f9dd5c4fc3b6c2e8e9cf7389db09ee7f953f4d63adf92988f`. Complete applicable generic
checks and independent yarn and mayonnaise scenarios pass without source rewriting or a package
identity branch.

The holdout partition is replenished with unopened `stargazer` 5.2.3. Metadata-first selection uses
the fixed 2026-07-22 through 2026-08-20 cranlogs window and records 25,450 downloads after existing
host-service, static-resource/data, native-development/scaffolding, and already-evaluated dependency
exclusions. Official metadata declares a core-only `stats`/`utils` mandatory closure,
`NeedsCompilation: no`, no Suggested package, no `LinkingTo`, no OS restriction, and GPL >= 2. The
unopened official 311,587-byte archive is frozen by SHA-256
`208e9b48a11cf56ce142731c204f3d2bcb5b68719f84309a36362cd925414265`. Archive listing, extraction,
source inspection, installation, and execution remain prohibited until the scheduled rotation.

## Profile 0.428 rotation record

The frozen `gsubfn` 0.7 archive was opened on schedule. Its first failure was ordinary export-help
coverage incorrectly including `.onAttach`; a package-neutral lifecycle classification now fixes
that. The rerun reaches P4 before missing `datasets::BOD` in `example:fn`. Deterministic artifact
SHA-256 is `296a095209abaad70ec1ee5c2e9d1936e0797cd1f7c09818f9298a75fce52f03`; source SHA-256
remains `89351df9e65722d2862f26a0a3985666de3c86e8400808ced8a6eb6e165a4602`. The corpus has 53
development and 50 regression artifacts and temporarily no holdout.

## Profile 0.427 rotation record

The frozen `gridBase` 0.4-7 holdout was executed unchanged after its metadata-only admission. Its
ordered first blockers were `grid::current.transform`, `grid::get.gpar`, `grid.rect`, and
two-element `graphics::par(mfg=)`. Each was resolved through reusable grid or graphics semantics,
with flat, integration, and recursive GNU black-box evidence. The package then passed every
applicable generic check plus an independently authored scenario spanning all five exports. Source
SHA-256 remains `be8718d24cd10f6e323dce91b15fc40ed88bccaa26acf3192d5e38fe33e15f26`; deterministic
artifact SHA-256 is `41a4dd801b19b29fe882380b2f510986fbb99b6e2fa3ce805489c00e316f7bd7`.

`gridBase` moves from holdout P0 to development P7. The corpus contains 52 development and 50
regression releases. The replacement metadata-only holdout is `gsubfn` 0.7, selected at 22,594
downloads in the fixed 2026-07-22 through 2026-08-20 window after the established browser-purpose
exclusions. Official metadata declares `NeedsCompilation: no`, GPL >= 2, and only already-passing
`proto` as a mandatory dependency. The unopened official 311,271-byte archive is frozen by SHA-256
`89351df9e65722d2862f26a0a3985666de3c86e8400808ced8a6eb6e165a4602`; archive listing, extraction,
parsing, installation, and execution remain prohibited until the scheduled rotation.

## Profile 0.422 rotation record

The frozen `stargazer` 5.2.3 artifact was opened on schedule only after its metadata, usage window,
source size, dependency surface, and source digest were fixed. Ordered unchanged execution selected
an independently sourced core dataset, central F probabilities, and matrix-extent/vector-empty bind
semantics as reusable contracts. Its deterministic installed artifact SHA-256 is
`5630ee0af4ccd30f34347b61fdfa0b43547dd3f8348474471f83e362a1e75929`. Complete applicable generic
checks and an independent exact regression-table scenario pass without source rewriting or a package
identity branch.

The holdout partition is replenished with unopened `lgr` 0.5.2. Metadata-first selection uses the
fixed 2026-07-22 through 2026-08-20 cranlogs window and records 25,079 downloads after the existing
exclusions. Official metadata declares only `R6` as a mandatory import, `NeedsCompilation: no`, and
MIT + file LICENSE. The unopened official 585,978-byte archive is frozen by SHA-256
`4649e34129b3e1cbbca801983adbe6f857a748301bdb1330985e69dde9892273`. Archive listing, extraction,
source inspection, installation, and execution remain prohibited until the scheduled rotation.

## Profile 0.423 rotation record

The frozen `lgr` 0.5.2 artifact was opened on schedule only after its metadata, usage window, source
size, dependency surface, and source digest were fixed. Ordered unchanged execution selected
language/recursive formatting, declared-Suggests package-check classification, portable file
extension extraction, and display-width string trimming as reusable contracts. Its deterministic
installed artifact SHA-256 is `d09a1147aa2f4317795cd6a44ec6a3a9bb7e10f5892fd54be7bd5e2ba2534c4a`.
Complete applicable generic checks and an independent Logger/AppenderBuffer scenario pass without
source rewriting or a package identity branch.

The holdout partition is replenished with unopened `operator.tools` 1.6.3.1. Metadata-first
selection uses the fixed 2026-07-22 through 2026-08-20 cranlogs window and records 24,899 downloads
after the existing exclusions. Official metadata declares only `utils` as a mandatory import,
`NeedsCompilation: no`, and GPL-2 + file LICENSE. The unopened official 15,035-byte archive is
frozen by SHA-256 `ef811a3b42820026361cf13ba47031281205f0dff6c2ec7fadb61cd2dd91bec9`. Archive
listing, extraction, source inspection, installation, and execution remain prohibited until the
scheduled rotation.

## Profile 0.424 rotation record

The frozen `operator.tools` 1.6.3.1 artifact was opened on schedule only after its metadata, usage
window, source size, dependency surface, and source digest were fixed. Ordered unchanged execution
selected the locked Base R `.Options` pairlist and its `options()` synchronization across the base
environment and namespace as a reusable contract. Its deterministic installed artifact SHA-256 is
`77f20c3fed33d2cc54438125cb625fa91c198a29ba1f154b656351be182400b2`. Complete applicable generic
checks and an independent GNU-matched built-in/custom operator scenario pass without source
rewriting or a package identity branch.

The holdout partition is replenished with unopened `stabledist` 0.7-2. Metadata-first selection uses
the fixed 2026-07-22 through 2026-08-20 cranlogs window and records 23,709 downloads after the
documented exclusions. Official metadata declares only browser-core `stats` as a mandatory import,
`NeedsCompilation: no`, GPL >= 2, and Suggested Matrix, fBasics, FMStable, RUnit, Rmpfr, sfsmisc,
and libstable4u integrations. The unopened official 33,308-byte archive is frozen by SHA-256
`26671710c0d8e3c815b56e6e4f6bc9ea0509db47c0ef5b8acfbfa16095a16fd5`. Archive listing, extraction,
source inspection, installation, and execution remain prohibited until the scheduled rotation.

## Profile 0.425 rotation record

The frozen `stabledist` 0.7-2 artifact was opened on schedule only after its metadata, usage window,
source size, dependency surface, and source digest were fixed. Ordered unchanged execution selected
explicit-bound and infinite-endpoint `uniroot`, GNU-shaped `ecdf` closures and S3 plots,
browser-native `rug`, and general RGBA `adjustcolor` behavior as reusable contracts. Its
deterministic installed artifact SHA-256 is
`14cc678395697fe8851cbd921268cf69a84f5dd3c922b0f6570c984ddea7d8c2`. Complete applicable generic
checks and an independent GNU-matched distribution scenario pass without source rewriting or a
package identity branch.

The holdout partition is replenished with unopened `formula.tools` 1.7.1. Metadata-first selection
uses the fixed 2026-07-22 through 2026-08-20 cranlogs window and records 24,221 downloads after the
existing exclusions. Official metadata declares `NeedsCompilation: no`, GPL-2 + file LICENSE,
mandatory imports limited to the already-passing `operator.tools` and browser-core `utils` and
`methods`, with `magrittr` and `testthat` Suggested only. The unopened official 19,464-byte archive
is frozen by SHA-256 `4fe0e72d9d96f2398e86cbd8536d0c84de38e5583d4ff7dcd73f415ddd8ca395`. Archive
listing, extraction, source inspection, installation, and execution remain prohibited until the
scheduled rotation.

## Profile 0.426 rotation record

The frozen `formula.tools` 1.7.1 artifact was opened on schedule only after its metadata, usage
window, source size, dependency surface, and source digest were fixed. Ordered unchanged execution
selected `utils::apropos`, expression-vector replacement, `stats::terms.formula`, symbol/atomic
`as.name` coercion, and compact arithmetic deparse spacing as reusable contracts. Its deterministic
installed artifact SHA-256 is `bce730059c494ed09405ed5e5e5e81bdfc2a0ccfe7785b750d136d9c53415be5`.
Complete applicable generic checks and an independently authored all-export formula scenario pass
without source rewriting or a package identity branch.

The holdout partition is replenished with unopened `gridBase` 0.4-7. Metadata-first selection uses
the fixed 2026-07-22 through 2026-08-20 cranlogs window and records 23,103 downloads after the
documented browser-purpose exclusions. Official metadata declares `NeedsCompilation: no`, GPL,
mandatory imports limited to browser-core `graphics` and `grid`, and `lattice` as Suggested only.
The unopened official 153,373-byte archive is frozen by SHA-256
`be8718d24cd10f6e323dce91b15fc40ed88bccaa26acf3192d5e38fe33e15f26`. Archive listing, extraction,
source inspection, installation, and execution remain prohibited until the scheduled rotation.

## Post-0.430 tinytable holdout record

The holdout partition is replenished with unopened `tinytable 0.18.0`. Metadata-first selection uses
the complete official CRAN `PACKAGES` snapshot and fixed 2026-07-27 through 2026-08-25 cranlogs
window, where it records 21,458 downloads. Established exclusions remove host-service, static
font/data/web-asset, native-header, scaffolding, documentation-time, and already-evaluated
dependency candidates; `codetools` is excluded because it has already executed unchanged in pinned
dependency closures.

Official metadata records `NeedsCompilation: no`, GPL >= 3, R >= 4.1.0, and only core `methods` as a
mandatory import. The unopened 440,097-byte official archive is pinned at P0 by SHA-256
`83a69d454d2c9333cd4d54bb6c12bc6970d034545c17b260fe4a87e6be04324c`. Archive listing, extraction,
parsing, installation, and execution remain prohibited until the scheduled source-blind run. The
corpus has 104 releases: 88 passing, 15 blocked, one unevaluated, and 49 at P7.

## Profile 0.431 tinytable execution record

The scheduled fixed archive was installed and executed unchanged before package source inspection.
Its first blockers were frozen in order: S4 `NULL` slot replacement, missing `...names()`, a custom
missing-`data.table` diagnostic for a declared `Suggests` edge, and a generated `knitr` guard for a
declared `Enhances` edge. The first two produced shared runtime semantics with GNU differential
evidence; the latter two produced a generic optional-dependency applicability rule. No package name
or source rewrite participates in the implementation.

The final run passes every applicable installed check and retained `tinytest.R`; missing vignettes
and optional integrations are explicit. An independently authored S4 formatting/styling scenario
matches advisory GNU R 4.6.0. The artifact moves from holdout through development to regression P7.
The corpus now records 104 releases: 89 passing, 15 blocked, 50 at P7, and no unevaluated holdout.

## Profile 0.435 sfsmisc execution record

The frozen `sfsmisc 1.1-25` archive entered unchanged execution only after metadata, usage, source
digest, and an independent GNU black-box scenario were fixed. Its first exact failure selected a
generic non-evaluating NAMESPACE grammar extension for safe nested and unbraced platform
conditionals. Ordered reruns then selected reusable grDevices, graphics, distribution, S3,
missing-data, loess-control, and step-function contracts. Capability-dependent PostScript, loess
fitting, and multi-panel time-series plotting remain explicit API-only boundaries.

The ready artifact SHA-256 is `1ba46207ef708889f31dcb27f092d64e3e646f01db9a312e2a6858a2ce9e3ce6`. It
reaches P1 and freezes the next first blocker at missing `stats::symnum`. The corpus records 108
releases: 92 passing, 16 blocked, 53 at P7, and no unevaluated holdout. No package identity branch,
source rewrite, result substitution, or check bypass was introduced.

## Profile 0.436 sfsmisc import progression

Ordered unchanged execution selected `stats::symnum` and then `stats::update.formula`. Both were
implemented at shared package/runtime layers with flat, integration, and exact recursive GNU
black-box evidence. Symbolic arrays retain observable shape, labels, legends, and ordinary
attributes; formula updates normalize dot-expanded term algebra and retain lexical environments.
Formula `as.list` structure was closed as an independently reusable language-object contract.

The same artifact remains at P1 and freezes the next first blocker at missing `utils::count.fields`.
Corpus totals remain 108 releases: 92 passing, 16 blocked, 53 at P7, and no unevaluated holdout. No
package identity branch, source rewrite, result substitution, or check bypass was introduced.

## Profile 0.437 sfsmisc field-counting progression

Ordered unchanged execution next selected `utils::count.fields`. The shared implementation consumes
browser-owned paths and connections and has flat, integration, and exact recursive GNU black-box
evidence for record boundaries, separators, quotes, comments, blanks, skip, multiline `NA` markers,
cursor state, return shape, validation, and formals.

The same artifact remains at P1 and freezes the next first blocker at missing `tools::Rcmd`. Corpus
totals remain 108 releases: 92 passing, 16 blocked, 53 at P7, and no unevaluated holdout. No package
identity branch, source rewrite, result substitution, or check bypass was introduced.

## Profile 0.438 sfsmisc namespace closure and first P5 blocker

The next namespace import, `tools::Rcmd`, is exposed with exact callable shape and an explicit
browser host-process boundary. GNU behavior launches the host R command driver; NativR does not
embed that executable or fabricate command execution. The unchanged artifact now loads, attaches,
discovers all documentation, and executes representative examples, advancing from P1 to P4.

Its first P5 blocker is `example:D1D2`, where the shared plot path rejects a non-real `x` coordinate
shape. Corpus totals remain 108 releases: 92 passing, 16 blocked, 53 at P7, and no unevaluated
holdout; all 108 reach at least P4. No package identity branch, source rewrite, result substitution,
or check bypass was introduced.

## Profile 0.439 sfsmisc function-plot progression

The next ordered example blocker selected reusable `graphics::plot.function`. Its shared
implementation supplies exact formals, closure evaluation, endpoint precedence, invisible
coordinates, graphical-control forwarding, and `seq.int`-compatible storage with flat and recursive
GNU black-box evidence. The unchanged artifact now passes `example:D1D2` without source changes.

The artifact remains at P4 and freezes `example:D2ss` as the next first blocker: `smooth.spline`
reaches the documented 256-unique-observation browser limit. Corpus totals remain 108 releases: 92
passing, 16 blocked, 53 at P7, and no unevaluated holdout. No package identity branch, source
rewrite, result substitution, or check bypass was introduced.

## Profile 0.440 sfsmisc large-spline progression

The next ordered example blocker selected large default `stats::smooth.spline` input. The shared
implementation now selects a bounded active-knot basis, expands fitted values and leverage to the
full coordinates, and preserves prediction shape with structural GNU black-box evidence. Explicit
oversized knot requests remain deterministic browser resource boundaries. The unchanged artifact
passes `example:D2ss` without source changes.

The artifact remains at P4 and freezes `example:Duplicated` as the next first blocker: `base::match`
lacks the standard `incomparables` argument. Corpus totals remain 108 releases: 92 passing, 16
blocked, 53 at P7, and no unevaluated holdout. No package identity branch, source rewrite, result
substitution, or check bypass was introduced.

## Post-0.484 metadata-frozen testit holdout

The source-blind partition is replenished with unopened `testit 1.1`. The complete official CRAN
`PACKAGES` filter and fixed 2026-07-30 through 2026-08-28 cranlogs window retain 3,370 current
NeedsCompilation:no-or-absent, non-OS-specific candidates outside the 108-release corpus whose
mandatory dependencies are browser core or passing packages. Established exclusions remove host
clipboard, remote package-management, Bioconductor-service, project-library/lockfile, credential,
font/data/asset/header-only, scaffolding, and already-evaluated dependency candidates. `testit` is
the highest-ranked remaining purpose-admissible executable package at 20,790 downloads.

Official CRAN metadata declares version 1.1, MIT + file LICENSE, Published: 2026-06-18,
NeedsCompilation:no, and no Depends, Imports, LinkingTo, Suggests, OS restriction, or
SystemRequirements. Its purpose is a minimal dependency-free R package testing framework. The
official 20,631-byte source archive is frozen at SHA-256
`152156ca35867c05dae3201f8486c0a5f100767d988a050c4ea0a5d445aafa31`. No archive member has been
listed, extracted, parsed, installed, or executed, and no deterministic NativR artifact exists yet.
The corpus now has 109 releases: 93 passing, 15 blocked, one unevaluated holdout, and 54 at P7.

## Profile 0.485 testit execution and Metrics holdout

The frozen `testit 1.1` archive was executed unchanged only after its metadata record and an
independent GNU R black-box scenario were fixed. Its complete generic package-check plan passed on
the first run. The independent scenario then exposed the missing reusable Base `getExportedValue()`
namespace-reflection contract. A shared implementation with flat, integration, and exact recursive
GNU evidence closes that gap; no package name or source rewrite participates. The deterministic
artifact SHA-256 is `3e9d9a40e7dbe2cb6cd951ffd15d2d7c5db585258e4ab3fefafd0976445cd09f`. The
unchanged package and all-export scenario now pass at scoped P7, and the artifact moves to
development. All three installed examples pass; retained `test-all.R` is explicitly not applicable
because it invokes a host R executable and git through `system2()`, and there is no vignette.

The replacement source-blind P0 holdout is unopened `Metrics 0.1.4`, selected from the same fixed
2026-07-30 through 2026-08-28 window after excluding the 109-release corpus. The complete filter
retains 3,369 candidates; `Metrics` is the highest-ranked remaining purpose-admissible executable
package at 20,012 downloads after established host-service, package-management, static
asset/data/header, scaffolding, and already-evaluated exclusions. Official CRAN metadata declares
NeedsCompilation:no, BSD_3_clause + file LICENSE, Published: 2018-07-09, no mandatory dependencies,
and testthat only in Suggests. The unopened 14,898-byte archive is pinned at SHA-256
`7395694d57cc6efa33d2af8ef22f0e4b32ccfa22993f2a8e804f7d4ee5c2083a`; no member has been listed,
extracted, parsed, installed, or executed. The corpus now has 110 releases: 94 passing, 15 blocked,
one unevaluated holdout, and 55 at P7.

## Profile 0.486 Metrics execution and pwr holdout

The frozen `Metrics 0.1.4` archive was installed and executed unchanged only after its source hash,
public formals, and independent GNU R black-box scenario were fixed. The first generic check blocker
was the installed `ScoreQuadraticWeightedKappa` example: Base `t()` rejected the rank-one `table`
used to form an expected-frequency matrix. The package-neutral rank-one transpose contract now
matches GNU R with flat, integration, and exact recursive evidence. The same artifact then passes
its complete applicable package-check plan and independent multi-domain metric scenario at scoped
P7. `testthat.R` is not applicable because `testthat` is Suggests-only and unavailable; no vignette
exists. The artifact SHA-256 is `4de5f0a5d6b28958a09ef4c5448f60a0a9421c39232515a65d28545493936764`.

The replacement source-blind P0 holdout is unopened `pwr 1.3-0`, the highest-ranked remaining
purpose-admissible executable package after the established exclusions in the same fixed usage
window. It records 19,559 downloads and imports only browser-core `stats` and `graphics`. Its
official 80,426-byte archive is frozen at SHA-256
`5bb00747aa599b11f133e94c6e4999e592456e966cba3607bbd1fcb1c7f1dfcd`; no archive member has been
listed, extracted, parsed, installed, or executed. The corpus now has 111 releases: 95 passing, 15
blocked, one unevaluated holdout, and 56 at P7.

## Profile 0.487 pwr execution and VennDiagram holdout

The frozen `pwr 1.3-0` archive was installed and executed unchanged after its metadata, exported
formals, and independent GNU R black-box scenario were fixed. Ordered checks exposed reusable
non-central chi-square, F, and Student-t probability contracts followed by
`graphics::points.formula`. Package-neutral implementations and flat, integration, and recursive GNU
evidence close those blockers. The deterministic artifact SHA-256 is
`12a73d3b7d71ef95fa4d27e9f151450e0ff34bd72f228396f7fb10dc70c956d6`; the complete applicable
package-check plan and independent 15-export scenario pass at scoped P7.

The replacement source-blind P0 holdout is unopened `VennDiagram 1.8.2`. The complete official
filter retains 3,368 candidates outside the 111-release corpus; after established exclusions,
VennDiagram is the highest-ranked purpose-admissible executable package at 18,839 downloads. It is
NeedsCompilation:no, depends only on browser-core `grid` and already-passing `futile.logger`, and
imports browser-core `methods`. The official 82,792-byte archive is frozen at SHA-256
`24b9751b7a537f7eb6273f14dd845f0ca38c2f5230b619ff637a839f8489fd93`; no member has been listed,
extracted, parsed, installed, or executed. The corpus now has 112 releases: 96 passing, 15 blocked,
one unevaluated holdout, and 57 at P7.

## Profile 0.489 VennDiagram/httpcode P7 and shades P0

The unchanged `VennDiagram 1.8.2` artifact passes its complete applicable check plan and independent
scenario after package-neutral matrix binding and grid-annotation fixes; it advances to scoped P7.
The corpus rotation preserves a source-blind partition by freezing unopened `httpcode 0.3.0` as P0.

The complete official filter retains 3,372 candidates outside the prior 112-release corpus. After
the established host-service, static-asset, native-header, scaffolding, testing-infrastructure, and
already-evaluated dependency exclusions, plus exclusion of profmem because its primary contract is
host allocation profiling through `Rprofmem`, httpcode is the highest-ranked purpose-admissible
executable candidate at 18,378 downloads in the fixed 2026-07-30 through 2026-08-28 window. Official
metadata declares NeedsCompilation:no, MIT + file LICENSE, no mandatory dependencies, and testthat
only in Suggests. Its 17,821-byte archive is frozen at SHA-256
`593a030a4f94c3df8c15576837c17344701bac023ae108783d0f06c476062f76` before member listing,
extraction, parsing, installation, or execution.

The exact httpcode archive passes its complete applicable package-check plan and an independent
four-export lookup/search/URL scenario. The only initial mismatch is a package-neutral
`stopifnot(length(code) == 1)` diagnostic with spurious outer parentheses; source-preserving
diagnostic deparse closes it with executable GNU evidence. httpcode advances to scoped P7.

Unopened `shades 1.5.0` becomes the replacement P0 holdout at 16,328 downloads after the same
recorded exclusions. Official metadata declares NeedsCompilation:no, BSD_3_clause + file LICENCE, no
mandatory dependencies, and tinytest/covr only in Suggests. Its 35,768-byte archive is frozen at
SHA-256 `848398c2e1c10e9c95582841867bb3d1143ff8495047fab03313fe239feed2ac` before member listing,
extraction, parsing, installation, or execution. The corpus now has 114 releases: 98 passing, 15
blocked, one unevaluated holdout, and 59 at P7.

## Profile 0.490 shades P7 and relimp P0

The exact unchanged `shades 1.5.0` artifact passes its complete applicable generic package-check
plan and independent colour scenarios after shared grDevices converter, namespace-binding, HSV, and
structural-attribute fixes. Its artifact SHA-256 is
`3e67f4610e761b2b5049b807baf08a332f425922e57885f7978e79e4e3114e88`; it advances to scoped P7 without
source rewriting or package recognition.

The replacement source-blind holdout is unopened `relimp 1.0-5`, selected at 15,915 downloads after
the established purpose exclusions. Official metadata declares NeedsCompilation:no, imports only
core `stats` and `utils`, and keeps Tcl/Tk/model extensions in Suggests. Its official 13,836-byte
archive is frozen at SHA-256 `acac7cf72ea39916761b51c825db0ffcb2bb1640e0a04086831fb78e9e40b679`
before member listing, extraction, parsing, installation, or execution. The corpus now has 115
releases: 99 passing, 15 blocked, one unevaluated holdout, and 60 at P7.

## Profile 0.491 relimp P7 and codetools P0

The frozen `relimp 1.0-5` archive was opened only after its metadata, source hash, complete public
inventory, and independent GNU R black-box scenarios were fixed. The exact unchanged artifact passes
the generic installer, namespace and attachment lifecycle, all applicable installed examples and
package-check steps, and independent `lm` relative-importance and Tcl-list conversion scenarios. Its
artifact SHA-256 is `9384901bcd3072a55a52f4c94ad3cf0f8662b4aebd523d37ac879377ea06a894`; it advances
to scoped P7 with no source rewrite, fixture shortcut, or package-name branch.

The replacement source-blind holdout is unopened `codetools 0.2-20`, selected at 56,062 downloads
after the established browser-purpose exclusions. Official metadata declares NeedsCompilation:no, no
dependencies, GPL licensing, and a reusable static R-code analysis purpose. Its official 38,683-byte
archive is frozen at SHA-256 `3be6f375ec178723ddfd559d1e8e85bfeee04a5fbaf9f53f2f844e1669fea863`
before member listing, extraction, parsing, installation, execution, or source inspection. The
corpus now has 116 releases: 100 passing, 15 blocked, one unevaluated holdout, and 61 at P7.

## Profile 0.492 codetools P7

The `codetools 0.2-20` archive is opened only after the P0 metadata, source hash, complete public
inventory, and independent black-box scenarios are fixed. Ordered unchanged execution selects
generic missing-formal, syntax-reflection, continuation, zero-argument language-entry,
symbol-output, call-head normalization, and `bquote()` formal contracts. Their implementations and
differential tests are package-neutral.

The deterministic artifact SHA-256 is
`8ae46174e686b5083d2d034caaf26f59beab0e3b69990cfc52f7a5302580794e`. Installation, namespace and
attachment lifecycle, documentation, every installed example, every retained test, vignette
classification, and independent code-analysis scenarios pass through the generic pipeline. The entry
advances to scoped P7 without source rewriting or package recognition. The 116-release corpus
therefore contains 101 passing, 15 blocked, no unevaluated entries, and 62 at P7.

## Profile 0.493 stinepack P7

The fixed 2026-07-30 through 2026-08-28 ranking selects `stinepack 1.5` at 14,917 downloads after
the recorded browser-purpose exclusions. Its official metadata, source URL, 6,733-byte archive,
SHA-256 `536c7a923064fd02eaa31161dd55d92369566fb351fbaee1ec188b1980438686`, public surface, and
independent GNU R expectations are frozen before NativR opens the archive.

The exact unchanged package requires no new production behavior and passes generic installation,
dependency closure, namespace loading, attachment, complete export/help coverage, every applicable
example and package-check step, absent-test/vignette classification, and independent interpolation
scenarios. Its deterministic artifact SHA-256 is
`9c23ae1de366e04d575ac4954d08d540b51e646ef2f19ac29cb50b17818d33bc`. It advances to scoped P7 without
source rewriting or package recognition.

The replacement holdout is unopened `qvcalc 1.0.4`, selected at 14,811 downloads after the recorded
purpose exclusions. Its official 13,982-byte archive and source SHA-256
`90403cada56e82a6bbd067f397fab20c721850b50874345a6322619165dafb59`, eight-export/formal surface, and
independent GNU R factor-model/covariance scenarios are frozen before NativR inspection or
execution. The 118-release corpus contains 102 passing, 15 blocked, one unevaluated entry, and 63 at
P7.

## Profile 0.494 qvcalc P7

The exact frozen `qvcalc 1.0.4` archive first identified method-level `vcov.lm()` matching and lazy
extra dots, then a package-defined custom GLM family. Both were resolved through reusable stats
contracts with flat, integration, and recursive GNU R evidence before promotion.

The unchanged deterministic artifact SHA-256 is
`34400402c98126098ef2f914d55f5946fbd9d0ea24a7d91489ff603e97cb2146`. Generic installation,
metadata/dependency processing, namespace loading, attachment, export/help coverage, applicable
examples and package checks, Suggested-path classification, and an independent balanced-factor
scenario pass without source rewriting or package recognition. The entry moves from holdout P0 to
development P7. The 118-release corpus contains 103 passing, 15 blocked, no unevaluated entries, and
64 at P7.

## Next source-blind holdout: aod 1.3.3

`aod 1.3.3` was selected as the next purpose-admissible statistical package at 14,153 downloads from
the fixed 2026-07-30 through 2026-08-28 window. Before any archive listing, extraction, parsing,
installation by NativR, or NativR execution, the official 58,304-byte source archive was frozen at
SHA-256 `b7245e8abf7d78cdfa7f74f6d90f79a418b883058aa3edd5977a60bdbed4087e`. Its official metadata,
50 exports, exact public function formals, 57 help entries, 10 dataset names, exported S4 metadata,
and independent GNU R transform, Wald-test, and quasipoisson expectations form the P0 baseline. The
first blocker is deliberately unknown until the unchanged generic pipeline runs.

## Profile 0.495 aod P7 and trust P0

The exact unchanged aod artifact advances from holdout P0 to development P7 at artifact SHA-256
`a5b3429016dd237589f80a64ade844ce1ae3c2e659ec7e4cceb9a9cf03403900`. Generic installation,
metadata/dependency processing, namespace loading, attachment, complete export/help coverage, all
applicable examples/checks, deterministic unavailable-Suggested classification, and independent
statistical/S4 scenarios pass after reusable shared semantic fixes. No package identity or source
rewrite is present.

The replacement holdout is unopened `trust 0.1-9`, the next purpose-admissible executable candidate
after the established exclusions in the fixed usage window. Its official 302,619-byte source archive
is frozen at SHA-256 `68d41390d6abd79461a972b424e8832272afdf0fd6e7fb57c379ae286919a1dd` before
archive listing or execution. The corpus contains 120 releases: 104 passing, 15 blocked, one
unevaluated holdout, and 65 at P7.

## Profile 0.496 trust P7 and itertools P0

The exact trust artifact advances from holdout P0 to development P7 after reusable direct
`stats::glm.fit` and recursive normalized-language `stats::D` closure. The replacement holdout is
`itertools 0.1-3`, chosen from the same fixed 2026-07-30 through 2026-08-28 window. Before archive
listing or execution, its official 21,415-byte archive was frozen at SHA-256
`b69b0781318e175532ad2d4f2840553bade9637e04de215b581704b5635c45d3` and recorded at P0.

## Profile 0.497 itertools P7

The unchanged itertools artifact advances to development P7 at artifact SHA-256
`bf2fe6d71b785b1a65004649de200dc79295af74f67020537d58a42feade80ae`. Its first ordered blocker, the
`iRNGStream` example, was closed through shared L'Ecuyer-CMRG generation and exact core parallel
stream/substream jumps. Generic metadata/dependency processing, namespace lifecycle, complete
export/help coverage, every applicable example/check, absent-test/vignette classification, and an
independent iterator scenario pass. The corpus contains 121 releases: 106 passing, 15 blocked, no
unevaluated holdout, and 67 at scoped P7.

## Profile 0.498 optimParallel P7

The frozen unchanged optimParallel artifact advances to development P7 at artifact SHA-256
`9230df11e2f6dceb5f8424d296062e416408bd22708e481cc24b188921e2c1cd`. Its ordered blockers were closed
through reusable browser cluster environments/default registration and the public bounded L-BFGS-B
`optim` path. The standard package checker passes metadata and dependency processing, namespace
lifecycle, complete help/examples, applicable tests, and its vignette; independent and GNU
differential evidence covers the shared semantics. The corpus contains 122 releases: 107 passing, 15
blocked, none unevaluated, and 68 at scoped P7.

## Profile 0.499 tictoc P7

The metadata-frozen unchanged tictoc artifact advances to development P7 at artifact SHA-256
`02a0f5f2303a0fb641a8e404986608d415ab49917d3fae4eee1c5d39c8497fd7`. Its standard package-check plan
passed before an independent Stack/StackList and nested-timing scenario exposed missing `as.vector`
S3 dispatch for a classed environment. Shared class/default dispatch, default-mode forwarding, and
base factor/data-frame method precedence close the seam without package recognition. The corpus
contains 123 releases: 108 passing, 15 blocked, no unevaluated holdout, and 69 at scoped P7.

## Profile 0.500 dfoptim P7

The metadata-frozen unchanged dfoptim artifact advances to development P7 at artifact SHA-256
`7247194cefd1075cf7c8c4ca1356123abf21c307217ad7c8cf58776e4b85f3fa`. Its standard check plan passed
before an independent all-export scenario exposed missing RNG advancement for the final singleton
draw of a full permutation. Shared Rejection-sampling state consumption closes the seam without
package recognition. The corpus contains 124 releases: 109 passing, 15 blocked, no unevaluated
holdout, and 70 at scoped P7.

## Profile 0.501 DFBA P7

The metadata-frozen unchanged DFBA artifact advances to development P7 at artifact SHA-256
`d1b0d0223c1b5dac43641247af38a01a2cde0e08dc8085e4cf33d53cf185cf5e`. Its ordered scheduled run
selected shared `dbeta`, `pbeta`, `qbeta`, `rlogis`, and `rweibull` contracts and then the generic
local-vector growth/copy-on-modify seam. Exact owner invalidation and bounded geometric storage
growth close the resource blocker without changing the package or raising its profile budget. All 66
planned checks pass. The corpus contains 125 releases: 110 passing, 15 blocked, no unevaluated
holdout, and 71 at scoped P7.

## Profile 0.502 lm.beta P7

After DFBA reaches scoped P7, the fixed 2026-07-31 through 2026-08-29 metadata rotation retains
3,366 admissible releases outside the 125-release corpus. Following the established host-service,
package-management, credential, asset/data/header, profiling, scaffolding, and documentation-only
exclusions, `lm.beta 1.7-3` is the next purpose-admissible executable release at 12,685 downloads.
Its sole mandatory non-core import is the already represented `xtable`; `knitr` is Suggested only.

The official 228,589-byte archive was frozen outside Dropbox at source SHA-256
`2bb0aa2603476bdbf7e0a92cdc5c3e3f98d1575cde5a34fa2924ff6b88146faa` before inspection. Unchanged
execution selected the shared list-backed environment parent contract through
`exists("weights", object)`. Giving list conversion an empty parent closes the lookup leak without
recognizing the package or changing eval/with data-mask semantics.

Artifact `1c13aeb2a45d1790e851ad5f0a4cdbeeb4bfa6f66c39898e47b023f784aa2201` passes all 19 generic
package-check steps plus independent weighted, no-intercept, summary, xtable, and error evidence.
The corpus contains 126 releases: 111 passing, 15 blocked, none unevaluated, and 72 at scoped P7.

## Next source-blind rotation: alabama 2025.1.0 P0

The fixed 2026-07-31 through 2026-08-29 metadata ranking retains 3,365 candidates outside the
126-release corpus and selects `alabama 2025.1.0` next at 12,292 downloads after the established
browser-purpose exclusions. Its mandatory closure adds only `numDeriv`, already pinned at passing
P7. Before any archive inspection or execution, the official 10,539-byte archive was frozen outside
Dropbox at SHA-256 `fad845617a59f67233f6e7a9355fcace4c1d2c12f750acd1de39bc7d0705d7cc`.

The entry is holdout P0 and deliberately unevaluated. Its next allowed action is the ordered generic
install/load/check run that records the first concrete reusable blocker before source-guided work.

## Profile 0.504 logging 0.10-111 P7

The ordered blocker closed through the reusable `methods::functionBody` reflection contract, with no
package recognition or source rewrite. Artifact
`25cf50ea3597f6fb657a33d2b58169dbcd34972612adb3b809abb4b805c72431` passes the complete 27-step plan
and an independent GNU-matched handler, level, composer, formatter, and removal scenario. The entry
advances to development P7; the corpus contains 128 releases, 113 passing, 15 blocked, none
unevaluated, and 74 at P7.

That ordered run passes installation through seven example topics and records
`methods::functionBody` as the first blocker at `example:setMsgComposer`. The deterministic artifact
is `25cf50ea3597f6fb657a33d2b58169dbcd34972612adb3b809abb4b805c72431`; the entry moves to
development P4 while the package-neutral closure-body reflection contract is implemented.

## Profile 0.503 alabama 2025.1.0 P7

The source-blind run recorded `stats::nlminb` as the first namespace blocker. Subsequent ordered
execution selected shared `optim` control compatibility and non-finite intermediate line-search
handling. A reusable bounded optimizer surface now maps GNU-shaped `nlminb` calls to the audited
L-BFGS-B backend without recognizing the package.

The deterministic artifact `d436014a3bd2e86072dffe66e9aeabe9bf3d63ba16822c99c0291c1a0610bed6` passes
its complete 11-step plan and an independent constrained/direct-optimizer scenario. The entry
advances to development P7; the corpus contains 127 releases, 112 passing, 15 blocked, none
unevaluated, and 73 at P7.

## Next source-blind rotation: logging 0.10-111 P0

The fixed 2026-07-31 through 2026-08-29 metadata ranking retains 3,364 candidates outside the
127-release corpus and selects `logging 0.10-111` next at 11,910 downloads after the established
browser-purpose exclusions. Its mandatory closure contains only browser-core `methods`; `testthat`
and `crayon` are Suggested. Before any archive listing, extraction, source parsing, installation, or
NativR execution, the official 17,086-byte archive was frozen outside Dropbox at SHA-256
`019bd366f14c9702378b74d0f2babd14497448f8792ccd45d1846cddd3104f59`.

The entry is holdout P0 and deliberately unevaluated. Its next allowed action is the ordered generic
install/load/check run that records the first concrete reusable blocker before source-guided work.

## Next source-blind rotation: latex2exp 0.9.8 P0

After logging reached scoped P7, the fixed 2026-07-31 through 2026-08-29 metadata ranking retained
3,363 admissible releases outside the 128-release corpus. Following the established host-service,
package-management, credential, asset/data/header, profiling, scaffolding, and documentation-only
exclusions, `latex2exp 0.9.8` is the next purpose-admissible executable release at 11,735 downloads.
It declares no mandatory package dependency or import and is `NeedsCompilation: no`.

Before any archive listing, extraction, source parsing, installation, or NativR execution, the
official 986,104-byte archive was frozen outside Dropbox at source SHA-256
`8dd641f263989515d0c327550934e4954dc582230ca2bb9f280b6b28a46510a5`. The entry is holdout P0 and
deliberately unevaluated; its next allowed action is the ordered generic package pipeline and exact
first-blocker record.

## Next source-blind rotation: profileModel 0.6.2 P0

After profile 0.522 closed the recorded simulated chi-square subdomain, the fixed 2026-07-31 through
2026-08-29 ranking retained 3,366 eligible releases outside the 134-release corpus. Applying the
established purpose exclusions selects `profileModel 0.6.2`, an executable pure-R statistical
package with no mandatory package imports; `MASS` and `gnm` are Suggested only. Official metadata
records `NeedsCompilation: no`, GPL >= 2, and publication on 2026-02-06.

Before any archive listing, extraction, parsing, installation, or execution, the official
21,461-byte source was frozen outside Dropbox at SHA-256
`a2b0b9af8b5ebe9bd732f1f6663f171929c0831f77c260b5aa9a126a12cf2ac1`. It enters the holdout partition
at P0 and remains deliberately unevaluated until the ordered generic pipeline records its first
concrete reusable blocker.

The ordered unchanged run first reached installation, namespace lifecycle, complete export
documentation, all 44 help topics, and multiple examples. `example:enrich.family` then selected
recursive runtime-value embedding in `call()`; after that package-neutral repair,
`example:enrich.link-glm` selected the absent public `stats::make.link` binding. Profile 0.506
implements the complete nine-link constructor and shares it with standard family objects. Flat and
exact recursive GNU black-box evidence covers both repairs.

Artifact `dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612` passes every applicable
generic check and a separately authored link/family/lm enrichment scenario. The entry advances to
development P7 with no first blocker and no source rewrite or package-name branch. The 130-release
corpus contains 115 passing, 15 blocked, none unevaluated, and 76 at scoped P7.

The ordered run reaches development P4 with deterministic include-tests artifact SHA-256
`dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612`. The shared call-language bridge
now passes flat and exact recursive GNU evidence while retaining shared closure and environment
identity. `example:enrich.family` passes; the blocker advances to the missing public
`stats::make.link` constructor in `example:enrich.link-glm`.

The first ordered run advances the unchanged artifact to development P4 with deterministic
include-tests SHA-256 `dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612`.
Installation, metadata, namespace, attachment, export/help coverage, and multiple examples pass.
`example:enrich.family` is the first failure: a closure value cannot yet be represented as R
language syntax. A later `stats::make.link` absence remains recorded but does not displace the first
blocker. The corpus now contains 130 releases: 114 passing, 16 blocked, none unevaluated, and 75 at
P7.

The first ordered execution reaches development P3. Packaging, metadata, namespace loading,
attachment, export documentation, and every help topic pass before `example:TeX` reaches a bracket
expression containing GNU-accepted identity escapes that ECMAScript Unicode mode rejects. Artifact
`c3b0426b7d6621ac5dc270e5f78ea389e2129b326d1322cd3691ae5270c93fdc` is blocked on the package-neutral
TRE/PCRE identity-escape normalization contract; no package source has been changed.

After that shared regex repair, all 18 generic checks pass. The source-independent scenario covers
vector conversion, styles, a custom command, expression metadata, invalid-input diagnostics, and the
supported-command table. Its first failure is the missing public Base `rbind.data.frame` binding.
The entry therefore records P7 package-check evidence but remains blocked on the reusable direct
method contract rather than claiming package completion.

## Profile 0.505 latex2exp 0.9.8 P7

The shared regex layer now translates only ECMAScript-invalid GNU punctuation identity escapes
inside bracket expressions, preserving semantic and class-syntax escapes. The public
`rbind.data.frame` method adds exact formals, control matching, row-name behavior, factor-preserving
row binding, and the empty-frame boundary. Both increments have flat and exact recursive GNU
black-box evidence.

The pinned artifact passes all 18 generic steps and the independently authored conversion and
supported-command scenario. It advances to development P7 without a package-specific branch or
source rewrite; the corpus contains 129 releases, 114 passing, 15 blocked, none unevaluated, and 75
at P7.

## Next source-blind rotation: enrichwith 0.5.0 P0

After `latex2exp` reached scoped P7, the fixed 2026-07-31 through 2026-08-29 metadata ranking
retained 3,363 admissible releases outside the 129-release corpus. Following the established
host-service, package-management, credential, asset/data/header, profiling, scaffolding, and
documentation-only exclusions, and excluding `plotmo` because its mandatory dependency closure is
unavailable, `enrichwith 0.5.0` is the next purpose-admissible executable release at 10,703
downloads. It declares no mandatory package dependency or import and is `NeedsCompilation: no`.

Before archive listing, extraction, source parsing, installation, or NativR execution, the official
126,233-byte archive was frozen outside Dropbox at source SHA-256
`fd1c07136409b40bf8246400ef784bacfe74a8a0db19fa695a80a38b46e46e07`. The entry is holdout P0 and
deliberately unevaluated; its next allowed action is the ordered generic package pipeline and exact
first-blocker record.

## profileModel 0.6.2 source-blind outcome

The P0-frozen artifact first stopped on a missing formula argument, then on raw GLM call retention,
and finally on unapplied formula offsets. These were implemented only as shared runtime/model
contracts. The deterministic installed artifact now passes the complete applicable generic plan and
an independently authored profile-likelihood scenario, so the entry advances to development P7.
Optional MASS behavior remains explicitly outside this artifact's applicable surface.

## aplpack 1.3.5 platform-boundary result

The fixed 2026-07-31 through 2026-08-29 usage window and current official CRAN metadata select
`aplpack 1.3.5` after the established browser-purpose exclusions. The package declares no mandatory
Imports and delivers executable statistical graphics; optional `tcltk`, image, and spline paths are
Suggested only. Its official 3,437,817-byte source archive was frozen before listing or execution at
SHA-256 `4454bc05cf70d5f3690b211e46b89b90a817de768b986098a3500c84f8d2664f`.

The unchanged generic artifact packages and parses completely, but its first namespace load stops on
the package's unconditional `import(tcltk, ...)`. That NAMESPACE edge is mandatory despite the
DESCRIPTION classification and lies outside the browser-admissible platform contract. The artifact
is pinned at SHA-256 `1bf3afaae279ae0abc7e023c85167f25c9dcff876ccb23d564a7c6974ead224f` and retained
at development P1 with deterministic `NRE2221` evidence. NativR does not rewrite the package or
fabricate a working Tcl/Tk namespace.

## nor1mix 1.3-3 metadata-only holdout

The same fixed usage window selects `nor1mix 1.3-3` as the next purpose-admissible executable at
10,603 downloads. Official metadata declares NeedsCompilation `no`, GPL >= 2, publication on
2024-04-06, and mandatory imports only from browser-core `stats` and `graphics`; `cluster` and
`copula` are Suggested. Its declared surface covers one-dimensional Gaussian mixtures, random
generation, graphics, maximum-likelihood fitting, and EM estimation.

Before archive listing, extraction, parsing, installation, or NativR execution, the official
43,051-byte source archive was frozen outside Dropbox at SHA-256
`97bfd0f8c847fa68bf607aaa465845a34ac8a7a262315073026a6a1937dd076e`. It is the sole deliberately
unevaluated P0 holdout; the next permitted step is the unchanged generic pipeline and exact
first-blocker record.

## Profile 0.524 aplpack boundary and nor1mix P4

The generic aplpack attempt packages and parses the archive, then stops at its unconditional Tcl/Tk
namespace import. It is retained at P1 as a declared browser-platform boundary. The replacement
nor1mix artifact first exposed missing `stats::rmultinom`; shared multinomial, direct-mean,
Summary-NULL, and optional-example applicability work now carries it through P4.

The unchanged nor1mix artifact SHA-256 is
`4e0737231bf2e00e1e10206a958c0045f9c757084595e7f3d16ce6fed092be9f`. Its cluster-dependent example is
not applicable because the unchanged runnable block has a top-level `require("cluster")` and cluster
is only Suggested. The first applicable blocker is `example:norMix2call`, where `stats::deriv` has
no method for call input. P5 is not claimed. The holdout partition is empty until the next
source-blind metadata freeze.

## Profile 0.525 nor1mix blocker progression

The unchanged artifact and its partition remain fixed. Generic semantic work resolves call-valued
`deriv.default`, warning assertion, deprecation conditions, and BFGS trace controls, with direct
regression coverage for the package's deprecated `sig2` route. The recorded first applicable failure
is now `example:norMixFit`: `density.default(bw = "sj")` is outside the current `nrd0` selector.
nor1mix remains blocked at P4 until that and all later applicable checks pass.
