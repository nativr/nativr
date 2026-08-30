# Conformance

Checked-in cases describe the exact source, expected friendly result, warning presence,
compatibility level, and numeric tolerance. `pnpm conformance` runs them without GNU R.
`pnpm conformance:r` optionally invokes a local `Rscript --vanilla` as a black-box oracle and
compares canonical type, length, value, visibility, and warning presence.

`pnpm conformance:r:v2` observes recursive object graphs, including attributes, language objects,
closures, environment identity, parent chains, and owned bindings. Every v2 case declares the
behavioral `package::binding` entries it exercises. The runner and generated compatibility status
reject unknown, non-behavioral, or unassociated entries, so recursive binding coverage is an
evidence count rather than a name-overlap estimate.

R is development tooling only. No reference output or R implementation code is shipped in the
runtime. New semantic claims require a focused case here and a corresponding unit or integration
test.

Profile 0.307 adds a focused flat case for `body<-`, `formals<-`, and `environment<-` public shapes,
values, and enclosures, plus an exact recursive case that observes replacement closures, ordinary
`.Environment` attributes, owned enclosure bindings, and shared identity.

Profile 0.308 adds a flat list-to-closure and S3-dispatch case for `as.function`, plus a recursive
case observing the constructed formals, body, enclosure binding, and shared environment identity.

Profile 0.311 adds GNU R black-box cases for exact S4 slot extraction/replacement, registered
validity methods and public formals, plus option-width/explicit-width `cat(fill=)` wrapping and
labels. Package-level integration separately proves `exportClasses()` namespace metadata and
missing-class rejection.

Profile 0.312 adds flat GNU R black-box cases for scalar list/pairlist `as.logical()` coercion and
source/target S4 `coerce` method selection, plus an exact recursive case that observes the logical
vectors, dropped attributes, nested missing values, and pairlist result. The recursive suite now has
10 cases and 27 explicitly associated behavioral bindings.

Profile 0.313 adds flat GNU R black-box cases for caller-environment legacy S3 method discovery and
`levels()`/`nlevels()` behavior. Two recursive cases observe namespace-local S3 methods, owned
environment graphs, generic results, level attributes, and counts. The recursive suite now has 12
cases and 32 explicitly associated behavioral bindings.

Profile 0.314 adds flat GNU R black-box cases for the browser semantic compiler contract, call
subsetting that preserves a named first entry, apply-family language input, and real/complex `%*%`
with missingness and dimnames. Three recursive cases retain the call graph, matrix/complex objects,
missing values, compiler result, and exact formals. The recursive suite now has 15 cases and 38
explicitly associated behavioral bindings; checked-in flat conformance has 975 cases.

Profile 0.315 adds exact GNU R cases for single-lane `mclapply()`, `splitIndices()`, and public
formals, plus a browser-specific PSOCK sequential-adapter case. One recursive case retains the map
result, split structure, names, and callable formals. The recursive suite now has 16 cases and 41
explicitly associated behavioral bindings; checked-in flat conformance has 977 cases.

Profile 0.316 adds flat GNU R cases for `crossprod()`, vectorized `rnorm()`, retained
`model.frame()`, `parLapply()`/LB, and text-progress state/formals. A new exact recursive case
retains the cross-product matrix graph. The recursive suite now has 17 cases and 42 explicitly
associated behavioral bindings; checked-in flat conformance has 982 cases.

Profile 0.317 adds flat cases for locked `R.version`/`version` bindings, environment names,
length-generic `seq_along()`, attributed-language `unclass()`, and nested list-cell data-frame
`[[<-`. The recursive suite remains 17 cases with 42 explicitly associated behavioral bindings;
checked-in flat conformance has 986 cases.

Profile 0.318 adds flat exact cases for classed-environment primitive S3 extraction, replacement,
length, names, dimensions, and transposition, plus translation/message formatting and atomic
membership. The recursive suite advances to 18 cases with 56 explicitly associated behavioral
bindings; checked-in flat conformance has 988 cases.

Profile 0.319 adds flat exact cases for qualified replacement functions, closure-valued substitute
rewriting, Utils object/S3 lookup, Base namespace access, target `library()` formals, and
system-frame shapes. The recursive suite advances to 19 cases with 62 explicitly associated
behavioral bindings; checked-in flat conformance has 990 cases.

Profile 0.320 extends recursive and flat evidence for R.oo-driven namespace, S3, caller-frame,
coercion, metadata, attribute, delayed-binding, and serialization semantics. Profile 0.321 adds
package-driven cases for parser escapes, atomic dimension names, owned-file MD5, source references,
condition transfer, cooperative time-limit shape, and browser graphics layout. The recursive suite
now has 23 cases with 79 explicitly associated behavioral bindings; checked-in flat conformance has
1009 cases, of which 953 are eligible for a same-platform live GNU R oracle.

Profile 0.323 adds GNU R-observed flat cases for the unclassed `R.Version()` constructor versus the
classed `R.version` binding and for `str` S3 dispatch before default formatting. Checked-in flat
conformance is 1011/1011; 955 cases are live-oracle eligible. The available non-normative GNU R
4.6.0 advisor matches 951/955, with only the four pinned 4.6.1 version-field differences. Recursive
Oracle v2 remains 23/23 with 79 explicitly associated behavioral bindings.

Profile 0.324 adds GNU R-observed cases for generic `lgamma()`, `tabulate()`, and `gamma()`
semantics, including missing/non-finite values, attributes, dispatch, poles, coercion, and
documented formals. Checked-in flat conformance is 1014/1014; 958 cases are live-oracle eligible.
Recursive Oracle v2 remains 23/23 with 79 explicitly associated behavioral bindings.

On the available non-normative GNU R 4.6.0 advisor, 954/958 eligible cases match; the four
differences are exactly the pinned 4.6.1 version-field cases.

Profile 0.325 adds GNU R-observed flat cases for matrix/vector product promotion, triangular and
coordinate matrices, Kronecker products, choose/lchoose, determinant/solve, QR reconstruction and
coefficients, and SVD/La.svd reconstruction. Checked-in flat conformance is 1020/1020; 964 cases are
live-oracle eligible. The non-normative GNU R 4.6.0 advisor matches 960/964, with only the same four
target-4.6.1 version-field differences. Recursive Oracle v2 remains 23/23 with 79 associated
behavioral bindings.

Profile 0.326 adds a flat GNU R-observed model-frame case covering `terms`, dot expansion,
`model.response`, `delete.response`, formula equality, `offset`, and `model.offset`. Checked-in flat
conformance is 1021/1021 and 965 cases are live-oracle eligible. The non-normative GNU R 4.6.0
advisor matches 961/965; the four differences are still only pinned 4.6.1 version fields. Recursive
Oracle v2 is 24/24 with 86 explicitly associated behavioral bindings, including exact language,
attribute, storage-mode, response, and offset graphs for the new model-frame contract.

Profile 0.327 adds GNU R-observed flat cases for methods formals/value classes, concrete and
atomic-data S4 storage, `toString`, Date-to-POSIXct conversion, legacy classes, Stats `setNames`,
and compact/materialized row names. Checked-in flat conformance is 1032/1032 and 976 cases are
live-oracle eligible. The non-normative GNU R 4.6.0 advisor matches 972/976; the four differences
remain only the pinned 4.6.1 version fields. Recursive Oracle v2 advances to 25/25 with 93
explicitly associated behavioral bindings.

Profile 0.331 adds exact flat and recursive evidence for core-package namespace ownership,
`.BaseNamespaceEnv`, top-level versus local `substitute()`, first-class `{`, `<-`, and `[`, and
primitive `NextMethod()` fallback. Checked-in conformance is 1047/1047; 990 cases are eligible for
the live GNU R advisor. Recursive Oracle v2 is 28/28 with 121 explicitly associated behavioral
bindings. The available non-normative GNU R 4.6.0 advisor retains only the four pinned 4.6.1
version-field differences after excluding the intentionally top-level-only substitute case from the
local-environment oracle harness.

Profile 0.332 adds flat GNU R-observed cases for apply/caller-frame behavior, five-number and outer
summaries, trimmed means, list tables, summation storage types, array normalization, core dataset
identity, tracing, `.mapply`, factor-level replacement, nested replacement, and quoted `do.call`.
Checked-in conformance is 1052/1052; 995 cases are live-oracle eligible. Recursive Oracle v2 is
29/29 with 136 explicitly associated behavioral bindings. The local non-normative GNU R 4.6.0 flat
advisor matches 991/995 eligible cases; the four differences are exactly the pinned 4.6.1
version-field cases. Release gating remains pinned to GNU R 4.6.1.

Profile 0.333 adds flat cases for parenthesized assignment visibility, table and named-axis matrix
printing, S3 method condition calls, and replacement-call reconstruction. Checked-in conformance is
1054/1054; 997 cases are live-oracle eligible. Recursive Oracle v2 is 30/30 with 142 explicitly
associated behavioral bindings. The available GNU R 4.6.0 advisor retains only the four expected
target-version differences; release gating remains pinned to GNU R 4.6.1.

Profile 0.334 adds flat and recursive GNU R evidence for `regexec()` optional captures represented
by `0/0` locations and extracted by `regmatches()` as retained empty strings. ASCII index metadata
and its observable attribute order are included in the recursive graph. Checked-in conformance is
1055/1055; 998 cases are live-oracle eligible. Recursive Oracle v2 is 31/31 with 144 explicitly
associated behavioral bindings. The available non-normative GNU R 4.6.0 advisor matches 994/998; the
four differences are exactly the target-version fields pinned by NativR to 4.6.1. Release gating
remains pinned to GNU R 4.6.1.

Profile 0.335 adds three checked-in flat cases for `.POSIXct`, S4
`callGeneric`/replacement/data-part dispatch, and `pretty` plus date-label generics. Checked-in
conformance is 1058/1058. Recursive Oracle v2 adds the exact nested POSIXct constructor and
pretty-scale graph and is 32/32 against the available non-normative GNU R 4.6.0 advisor. The exact
GNU-produced S4 XDR fixture is separately gated in runtime serialization tests. GNU R 4.6.1 remains
the normative target.

Profile 0.336 adds five checked-in flat cases for S4 primitive/operator and `Ops` dispatch,
`as.double`/`as.numeric` method forwarding, `sort` and `diff` generic forwarding, and S4 subset
dispatch with a primitive `callGeneric()` fallback. Checked-in conformance is 1063/1063. Recursive
Oracle v2 remains 32/32 against the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains
the normative release gate. The flat advisor matches 1000/1006: its six differences are the four
target-version observations plus the previously recorded `getDataPart` generic-creation output and
one `pretty()` decimal rendering delta. All five Profile 0.336 cases match GNU R 4.6.0.

Profile 0.337 adds four flat cases for POSIXt rounding/truncation, implicit S4 time-series endpoint
dispatch, S3 `range` forwarding, and prototype-complete S4 construction. Checked-in conformance is
1067/1067. Recursive Oracle v2 adds a nested POSIXt round/trunc graph and is 33/33 against the
available non-normative GNU R 4.6.0 advisor. The flat advisor matches 1004/1010; the unchanged six
deltas are four target-version observations, the recorded `getDataPart` generic-creation output, and
one `pretty()` decimal rendering difference. All four Profile 0.337 cases match GNU R 4.6.0. GNU R
4.6.1 remains the normative release gate.

Profile 0.338 adds twelve flat cases for generic `seq`, S4 dispatch with unrelated named dots,
`pmatch`, forwarded-default missingness, string/date coercion, POSIXlt parsing and replacement,
callable `[<-`, `is.na`/`unique`/`duplicated` method dispatch, and `julian.POSIXt`. Checked-in
conformance is 1079/1079. Recursive Oracle v2 adds the nested S4-dots and partial-match contract and
is 34/34 against the available non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative
release gate.

Profile 0.339 adds five flat cases for S3/S4 `length` and recursive `lengths` dispatch, POSIXlt
short-component recycling, the Base `.leap.seconds` object, logical-missing and empty POSIXlt
conversion, and `...length`/`...elt`. Checked-in conformance is 1084/1084. Two recursive graphs add
length/POSIXlt and `.leap.seconds` contracts, bringing Oracle v2 to 36/36 against the available
non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative release gate.

Profile 0.340 adds four flat cases for generic `asplit`, zero-length `apply` type stability, S4
graphics dispatch with measured axis styles, and recursive `all.names` plus non-vector `names`.
Checked-in conformance is 1088/1088. Three recursive graphs add the array split, apply result-type,
and language-name contracts, bringing Oracle v2 to 39/39 against the available non-normative GNU R
4.6.0 advisor. GNU R 4.6.1 remains the normative release gate.

Profile 0.341 adds two flat cases for legal `seq.int` by/length controls and S4
`initialize`/`callNextMethod`/`names<-` behavior, while strengthening the existing `is.na<-` case
with list, factor, numeric-subscript, and missing-subscript coverage. Three recursive graphs bring
Oracle v2 to 42/42 against the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the
release gate. The flat suite is 1090/1090.

Profile 0.342 adds two flat cases for POSIXlt observation/component extraction and C-locale
abbreviated/full month parsing, bringing checked-in conformance to 1092/1092. One recursive graph
compares the combined object and parsing contract, bringing Oracle v2 to 43/43 against the available
non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative release gate.

Profile 0.343 adds one flat dense factor-contrast case, bringing checked-in conformance to
1093/1093. One recursive graph compares stored factor contrast attributes, default/identity coding,
and dense sum/treatment generators, bringing Oracle v2 to 44/44 against the available non-normative
GNU R 4.6.0 advisor. External-package P7 evidence additionally covers memoized LazyData realization;
GNU R 4.6.1 remains the normative release gate.

Profile 0.355 contains 1109 checked-in flat cases and 63 recursive Oracle v2 graphs. The new
package-neutral evidence covers grid formals, scalar root finding and callback forwarding,
covariance normalization, and transposed cross-products. The available GNU R 4.6.0 oracle is an
advisory local check only; GNU R 4.6.1 remains normative.

Profile 0.344 adds one flat case for preserving a literal character value in call-head position
through call selection, list conversion, reconstruction, inspection, deparsing, and failed
evaluation. Checked-in conformance is 1094/1094. One recursive graph compares the same language
object structure and evaluation boundary, bringing Oracle v2 to 45/45 against the available
non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative release gate.

Profile 0.345 is an evidence-only package-depth increment. It adds unchanged `brew 1.0-10` P5
package-check and independent GNU R-matched template/parser evidence without changing semantic
coverage, so the checked-in suites remain 1094/1094 flat cases and 45/45 recursive Oracle v2 graphs.
GNU R 4.6.1 remains the normative release gate.

Profile 0.356 contains 1110/1110 checked-in flat cases and 64/64 recursive Oracle v2 graphs. The new
package-neutral evidence covers GNU-shaped `setNames`, margin `sweep`, maximum-likelihood
`factanal`, direct `loadings` extraction, and programmatic rotation-callback calls. The available
GNU R 4.6.0 advisor passes the complete recursive suite but remains non-normative; GNU R 4.6.1 is
the release gate.

Profile 0.358 contains 1113 checked-in flat cases and 66 recursive Oracle v2 graphs. New evidence
covers the independently sourced `datasets::ability.cov` object across search and namespace paths,
plus factor-count-scaled starts, bounded limited-memory fitting, Kaiser-normalized varimax, and
positive loading-column orientation. Numeric `factanal` evidence uses a declared `2e-5` tolerance;
the stricter package-level `1e-6` L-BFGS-B trajectory gap remains open.

Profile 0.359 contains 1115 checked-in flat cases and 66 recursive Oracle v2 graphs. Exact black-box
evidence now covers the pinned L-BFGS-B 2.1 optimization path used by `factanal()`, including
objective value, uniquenesses, loadings, function/gradient counts, and convergence;
`stats::varimax()` normalization, rotation matrix, dimensions, classes, and formals; and GNU-shaped
implicit single-column `matrix()` dimensions through `unclass()`. The existing recursive
factor-analysis graph is strengthened rather than duplicated. Unchanged `GPArotation 2026.8-1`
passes its entire applicable package-check surface at P7; this single-artifact result is not a claim
of arbitrary pure-R package or comprehensive GNU R compatibility.

Profile 0.360 contains 1117 checked-in flat cases and 66 recursive Oracle v2 graphs. New flat
evidence covers browser-owned `as.character.Date()` civil-date conversion, non-finite values and
formals, plus reusable `tibble::as_tibble()` conversion, recycling, row-name handling and name
repair. The existing POSIXct/Date recursive graph is strengthened with `as.Date()`,
`as.character.Date()`, attribute ordering, names and formals. The available non-normative GNU R
4.6.0 advisor passes 66/66; GNU R 4.6.1 remains the release gate. The unchanged pinned
`palmerpenguins 0.1.1` artifact also passes its applicable package-check surface and an
independently authored GNU-matched LazyData scenario at P7. This remains artifact-specific evidence.

Profile 0.361 contains 1120 checked-in flat cases and 68 recursive Oracle v2 graphs. New exact
black-box evidence covers implicit `Math`, `Ops`, and `Summary` S3 group context, `.Generic`,
`.Group`, `.Method`, `.Class`, method-local argument mutation across `NextMethod()`, callable
operator dispatch, list `unique`/`duplicated`, single-variable `stats::poly`, and a four-by-four
general real eigendecomposition residual. The available non-normative GNU R 4.6.0 advisor passes
68/68; GNU R 4.6.1 remains the release gate. The unchanged pinned `polynom 1.4-1` artifact passes
its complete applicable package-check plan and an independently authored GNU-matched polynomial
scenario at P7. This does not claim `stats::deriv.default`, multivariate `poly`, arbitrary pure-R
package compatibility, or comprehensive GNU R compatibility.

Profile 0.362 contains 1126 checked-in flat cases and 72 recursive Oracle v2 graphs. New exact
evidence covers lazy `na.pass`, visible `qr.R`, model-frame xlevels, rank-deficient prediction,
stored-call formula updates, and treatment/sum/Helmert/matrix contrasts. The unchanged pinned
`estimability 2.0.0` artifact passes its complete applicable package-check plan plus an independent
GNU-matched scenario at P7. GNU R 4.6.1 remains normative; the available GNU R 4.6.0 advisor is
non-normative.

Profile 0.363 adds one flat case and one recursive Oracle v2 graph for zero-formal function-call
reconstruction, TRE-versus-Perl newline matching, exiting warning handlers, and
`all.equal(check.names = FALSE)`. The unchanged `formatR 1.14` artifact reaches P5; its retained
tests remain an explicit blocker rather than a compatibility claim.

Profile 0.364 adds one flat case and one recursive Oracle v2 graph for structural deparse layout,
interleaved calling/exiting condition-handler order, and suppression visibility. Checked-in flat
conformance is 1128/1128 and recursive Oracle v2 is 74/74 under the local non-normative GNU R 4.6.0
advisor; GNU R 4.6.1 remains required for release-gating evidence. The unchanged `formatR 1.14`
artifact reaches P7 without package-specific runtime behavior. Profile 0.365 adds flat and recursive
contracts for option-inherited parse data, list input to `parse(text=)`, and one-dimensional
`apply()`. Exact parse-data row counts are intentionally not claimed until normalized Tree-sitter
ownership reaches GNU R's complete row topology.

Profile 0.382 adds flat cases for clipped positive-density polygon/rectangle hatching, finite
`range.default`, and boxplot axis/frame plus positional-formula behavior. Runtime integration
separately verifies hatch metadata, Worker-facing graphics events, display-list replay, Canvas,
software PNG, and PDF rendering. One exact recursive graph observes finite-range results, named
dots, missingness, and callable formals. Checked-in flat conformance is 1245/1245 and recursive
Oracle v2 is 139/139 on the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains
normative.

## Profile 0.510 evidence increment

Flat evidence pins the complete observable `volcano` matrix shape and summaries together with
`persp(main=)` result invariance and visibility. Oracle v2 compares the entire 5,307-value matrix
recursively against the live GNU R oracle. Worker-facing integration verifies the emitted browser
text event, and unchanged-package checks prove that `shape` and `gridGraphics` advance to their next
ordered reusable graphics blockers.

## Profile 0.511 evidence increment

Flat GNU R 4.6.1 evidence pins colored-facet painter order across four view quadrants and preserves
the existing projection-matrix contract. Worker-facing integration verifies polygon fills, borders,
transparent border suppression, and event ordering. Recursive Oracle v2 is intentionally not claimed
while `persp` remains classified as partial shape compatibility. The unchanged `shape 1.4.6.1` check
proves both `example:drapecol` calls pass and advances the first blocker to missing
`graphics::filled.contour` in `example:femmecol`.

## Profile 0.509 evidence increment

Two flat cases cover tolerant seasonal `stats::arima0` numeric results and exact result/data/formals
shape. Oracle v2 adds an exact graph for `datasets::USAccDeaths` and coarsely rounded model fields,
preserving implementation-independent numerical latitude while checking recursive classes,
dimensions, names, residual time metadata, and callable formals. Integration evidence separately
covers `nls(subset=)`, `summary.nls`, model parameter retrieval, and unchanged ellipse execution.
GNU R 4.6.1 remains normative; the local 4.6.0 oracle is advisory.

Profile 0.383 adds package-independent flat and recursive evidence for provisional named-missing
argument matching, character `do.call()` function-mode lookup, recursive list range, vector
`rep(times=)` after `each`, one-dimensional-array barplots, pie visibility/formals, expression-text
graphics, and disabled-axis detailed perspective behavior. Integration evidence additionally covers
physical-inch `symbols()`, stripchart generic/formula behavior, data-frame `apply()`, and
non-generic `%in%`. Checked-in flat conformance is 1260/1260 and recursive Oracle v2 is 144/144 on
the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains normative.

The Profile 0.383 continuation adds flat evidence for missing-row whole-column data-frame object
replacement, replacement attribute order, state-neutral inline plot margins, unknown
non-graphical-parameter warnings, and NULL text labels. Exact recursive evidence covers the
data-frame replacement distinction and binary arithmetic `Ops.data.frame` across both operand
orders, data frames, vectors, matrices, and lists. Checked-in conformance is 1265/1265 and recursive
Oracle v2 is 146/146 on the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains
normative.

Profile 0.384 adds flat behavioral evidence for generic daily/calendar `seq.Date`, automatic and
explicit `graphics::axis.Date`, and warning-with-continuation behavior for unknown forwarded
`rect()` controls. Recursive Oracle v2 adds exact nested evidence for Date sequence values, storage,
classes, `difftime` steps, formals, reverse endpoints, and direction errors. Checked-in conformance
is 1268/1268 and recursive Oracle v2 is 147/147 on the available non-normative GNU R 4.6.0 advisor;
GNU R 4.6.1 remains normative.

Profile 0.385 adds flat behavioral evidence for `grDevices::xyz.coords`, recursive named-list and
matrix expansion in `data.frame`, `graphics::plot.window` missing-aspect/formal behavior, and the
independently sourced `datasets::trees` object. One exact recursive Oracle v2 graph freezes the
complete `trees` frame shape, types, row identity, selected values, and aggregates. Checked-in flat
conformance is 1272/1272 and recursive Oracle v2 is 149/149 on the available non-normative GNU R
4.6.0 advisor; GNU R 4.6.1 remains normative.

Profile 0.387 adds flat and exact recursive evidence for lazy `with()` S3 dispatch, method-specific
arguments with a missing default `expr`, explicit-object `UseMethod()` argument preservation,
formula class/environment preservation through call-like subset selection, and recursive expansion
of parenthesized formula additions inside `*` terms. The formula evidence traverses `terms()`,
`model.frame()`, and `model.matrix()` rather than observing labels alone. Checked-in flat
conformance is 1277/1277 and recursive Oracle v2 is 153/153 on the available non-normative GNU R
4.6.0 advisor; GNU R 4.6.1 remains normative.

Profile 0.388 adds one flat case and one recursive Oracle v2 graph for the exported
`utils::assignInMyNamespace` and `utils::assignInNamespace` contracts: exact formals, invisible
`NULL`, existing-binding replacement, Base binding-lock preservation, missing-binding failure, and
rejection of a non-package caller location. Checked-in flat conformance contains 1278 cases and
recursive Oracle v2 contains 154 graphs. GNU R 4.6.1 remains the normative release gate; local GNU R
4.6.0 results are advisory only.

Profile 0.389 adds one flat case and one exact recursive Oracle v2 graph for `grDevices::axisTicks`
and private `.axisPars`: linear and logarithmic scales, explicit log codes, short-span parameter
derivation, wide-range interval thinning, reversed results, nested parameter shape, and callable
formals. Checked-in flat conformance contains 1279 cases and recursive Oracle v2 contains 155
graphs. GNU R 4.6.1 remains normative; local GNU R 4.6.0 evidence is advisory.

Profile 0.390 adds two flat cases and one exact recursive graph for `grDevices::contourLines`:
numeric topology, exact-level perturbation, saddle cells, missing-cell boundaries, closed paths,
packed input, public formals, constant-surface warnings, and the bounded segment option. Checked-in
flat conformance is 1281/1281 and recursive Oracle v2 is 156/156 against the available non-normative
GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative release gate.

Profile 0.391 adds one flat case and one exact recursive graph for the grid grob lifecycle:
`makeContent`, `makeContext`, identity defaults, exact formals, caller-visible S3 methods,
registered package methods, arbitrary method results, visibility, and multi-class `NextMethod()`
progression. Checked-in flat conformance is 1282/1282 and recursive Oracle v2 is 157/157 against the
available non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains normative.

Profile 0.392 adds two flat cases and one exact recursive graph for `grDevices::pdf.options`:
ordered defaults, query/update/reset state, return visibility, transactional validation, `pdf()`
default consumption, explicit override, and public formals. GNU R 4.6.1 remains normative; local GNU
R 4.6.0 evidence is advisory. Checked-in flat conformance is 1284/1284 and recursive Oracle v2 is
158/158 against that available advisor.

Profile 0.393 adds one flat case and one exact recursive graph for grid viewport justification and
retained-tree navigation: `upViewport`, `downViewport`, `current.viewport`, `vpPath`, return
visibility, path classes and fields, strict lookup, public formals, and top-level boundaries.
Checked-in flat conformance is 1285/1285 and recursive Oracle v2 is 159/159 against the available
non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains normative.

Profile 0.394 adds one flat case and one exact recursive graph for recorded `C_plot_new`,
`C_plot_window`, and `C_box` descriptor names, lengths, nesting, and argument names. Checked-in flat
conformance is 1286/1286 and recursive Oracle v2 is 160/160 against the available non-normative GNU
R 4.6.0 advisor. GNU R 4.6.1 remains normative.

Profile 0.395 adds one flat case and one exact recursive graph for polygon, segment, line, and point
grid grobs, drawing visibility, unit and viewport structure, grouping, gpar retention, public
formals, and browser-journal behavior. The recorded-operation case is strengthened through
`C_segments`, `C_plotXY`, `C_text`, and `C_polygon`. Flat conformance is 1287/1287 and Oracle v2 is
161/161 against the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains normative.

Profile 0.396 adds one flat case and one exact recursive graph for axes-suppressed boxplot
recording: per-group fill, median, placeholder point, whisker, staple, outline, and outlier
operations are filtered to the public `C_plot_new`, `C_plot_window`, `C_polygon`, `C_segments`, and
`C_plotXY` provenance sequence. Flat conformance is 1288/1288 and Oracle v2 is 162/162 against the
available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains normative.

Profile 0.397 strengthens the existing flat `pairs` case and adds one exact recursive graph for
numeric-matrix default return shape, invisibility, one-column rejection, generic formals, and lazy
S3 preservation. Integration evidence covers the device-independent scatterplot event sequence and
style recycling. The callable remains shape-level because complete panel geometry and callback
semantics remain open. Oracle v2 is 163 graphs; GNU R 4.6.1 remains normative.

Profile 0.403 adds two flat cases and two exact recursive graphs for utils completion matching and
session settings plus Reference Class `callSuper()` inheritance/root initialization. Checked-in flat
conformance is 1300/1300 and recursive Oracle v2 is 173/173 against the available non-normative GNU
R 4.6.0 advisor. The GNU R 4.6.1 release gate remains normative.

Profile 0.409 adds two flat cases and two exact recursive graphs for grouped `split<-` replacement,
the `stats::ave` namespace/formal contract, and the GNU admission boundary for `plot.default(las=)`.
Runtime unit and unchanged-package evidence cover standard ASCII aliases in version-3 serialized
data. Checked-in flat conformance is 1307/1307 and recursive Oracle v2 is 180/180 against the
available non-normative GNU R 4.6.0 advisor. The GNU R 4.6.1 release gate remains normative.

Profile 0.410 adds two flat cases and two exact recursive graphs for one-dimensional array/table
sort metadata, scalar and empty drop behavior, deparse-level-one table axis labels, and
`charmatch()` exact/partial ambiguity, coercion, `nomatch`, and formal reflection. Checked-in flat
conformance is 1309/1309 and recursive Oracle v2 is 182/182 against the available non-normative GNU
R 4.6.0 advisor. The GNU R 4.6.1 release gate remains normative.

Profile 0.411 adds three flat cases and two exact recursive graphs for target-aware registered S4
coercions, inherited parent-object initialization, `slot()`/`slot<-` access and formals, plus
`image.default(asp=)` window adjustment and admission. Checked-in flat conformance is 1312/1312 and
recursive Oracle v2 is 184/184 against the available non-normative GNU R 4.6.0 advisor. The GNU R
4.6.1 release gate remains normative.

Profile 0.412 is a package-evidence increment and adds no new semantic callable claim. The unchanged
moments 0.14.1 source package passes the generic applicable package-check plan and an independent
GNU R-matched all-export scenario. Flat conformance therefore remains 1312/1312 and recursive Oracle
v2 remains 184/184; GNU R 4.6.1 remains the normative release gate.

Profile 0.413 generalizes `apply()` from one- and two-dimensional special cases to arbitrary array
rank and ordered multi-axis margins, preserving slice and simplified result dimensions and dimnames.
Flat conformance is 1313/1313 and recursive Oracle v2 is 185/185 against the available non-normative
GNU R 4.6.0 advisor. The unchanged RSpincalc 1.0.2 artifact reaches scoped P7 through that reusable
primitive; GNU R 4.6.1 remains the normative release gate.

Profile 0.414 adds browser-native numeric `predict.loess` dispatch for serialized pre-fitted models,
including normalized degree-one/two local-polynomial reconstruction, tricube neighborhoods, and
observation/robust weights. Flat conformance is 1314/1314 and recursive Oracle v2 is 186/186 against
the available non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative release gate.

Profile 0.415 adds direct `base::all.equal.numeric` controls and `methods::isGeneric` registration
introspection after unchanged RUnit 0.4.33.1 exposed both reusable gaps. Flat conformance is
1316/1316 and recursive Oracle v2 is 188/188 with 441 recursively evidenced bindings against the
available non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative release gate.

Profile 0.416 adds `stats::dexp` and central `stats::dt` after unchanged ica 1.0-3 exposed both
namespace gaps. Flat conformance is 1318/1318 and recursive Oracle v2 is 190/190 with 443
recursively evidenced bindings against the available non-normative GNU R 4.6.0 advisor. The exact
graphs include recycling, missing and non-finite values, warnings and calls, attributes, formals,
and IEEE signed zero. GNU R 4.6.1 remains the normative release gate.

Profile 0.417 adds environment-reference deparsing, exact `eapply()` enumeration and callback
semantics, and preservation of the original target expression through S3 `$`, `[[`, `$<-`, and
`[[<-` dispatch. Flat conformance is 1321/1321 and recursive Oracle v2 is 193/193 with 449
recursively evidenced bindings against the available non-normative GNU R 4.6.0 advisor. The exact
graphs cover formals, empty named lists, hidden and lazy/active bindings, callback forwarding,
environment order, target syntax, and replacement-call `*tmp*` syntax. GNU R 4.6.1 remains the
normative release gate.

Profile 0.418 adds actual-call `nargs()` accounting, source-call-preserving S3 dispatch for
`merge()`, `subset()`, and `as.Date()`, explicit ISO date-format coercion, `%OS`/`%z` time parsing,
browser-native `write.dcf()`, and character endpoint coercion in `seq()`. Flat conformance is
1328/1328 and recursive Oracle v2 is 200/200 with 457 recursively evidenced bindings. The checked-in
graphs cover formals, lazy dots and method calls, invalid dates, fractional seconds and numeric
zones, DCF records, visibility, file output, and sequence storage. GNU R 4.6.1 remains the normative
release gate; GNU R 4.6.0 is advisory only.

Profile 0.419 adds three flat cases and three recursive Oracle v2 graphs for package-neutral
time-series foundations: robust `lowess`, fixed-span `supsmu`, implicit-input `smooth.spline`,
`aggregate` dispatch, vector-valued `filter` defaults, `prod(NULL)`, S4 vector identity through
Math/logical primitives, generic fallback with only later named arguments, independently licensed
`datasets::AirPassengers`, `%j` parsing, and fixed/calendar `seq.POSIXt` steps. Flat conformance is
1,331 cases and recursive Oracle v2 is 203 graphs. Unchanged timeSeries 4052.112 reaches scoped P7;
GNU R 4.6.1 remains normative and GNU R 4.6.0 remains advisory only.

Profile 0.420 adds exact flat and recursive evidence for `tail.matrix` row labels, controls,
deprecation, and formals; `na.contiguous.ts` attribute order; `getDataPart`/`setDataPart`
first-method generic promotion; formal atomic matrix data parts and slot order; S4 operator
fallback; and `cbind2`/`rbind2` formals plus base-bind S4 precedence. Invalid R probe syntax and
invalid class definitions were replaced with valid black-box constructions. Matrix-backed S4 bind
methods that delegate to base bind also have exact resumption evidence. Flat conformance is
1,360/1,360 and recursive Oracle v2 is 232/232 with 496 recursively evidenced bindings against the
available non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative release gate.

Profile 0.426 adds flat cases for symbol-preserving and first-element atomic `as.name`/`as.symbol`
coercion and exact compact deparse spacing for `/`, `^`, `:`, `%%`, and `%/%`. The new recursive
Oracle v2 graph covers the same package-neutral language contracts, while integration evidence also
covers `utils::apropos`, expression-vector replacement, and `stats::terms.formula`. Checked-in flat
conformance is 1,381/1,381; the focused recursive graph passes exactly against the available
non-normative GNU R 4.6.0 advisor. The inventory contains 250 recursive graphs with 525 explicitly
associated bindings. GNU R 4.6.1 remains the normative release gate.

Profile 0.427 adds four flat cases for current grid viewport transforms and extents, inherited
graphical parameters, rectangle grob shape and formals, and base graphics `mfrow`/`mfg` layout
state. One exact recursive Oracle v2 graph covers the corresponding nested matrices, units, gpars,
grobs, layout lists, warnings, and formals. Checked-in flat conformance is 1,385/1,385; the focused
recursive graph passes exactly against the available non-normative GNU R 4.6.0 advisor. The
inventory contains 251 recursive graphs with 532 explicitly associated bindings. GNU R 4.6.1 remains
the normative release gate.

Profile 0.428 changes package-check classification only: standard lifecycle hooks are not ordinary
exports requiring standalone help aliases. A synthetic fixture and unchanged `gsubfn` run provide
executable evidence. No GNU callable claim changes, so flat conformance remains 1,385/1,385 and
recursive Oracle v2 remains 251 graphs with 532 binding associations. GNU R 4.6.1 remains normative.

Profile 0.430 adds exact flat and recursive evidence for `isOpen(rw=)` first-element partial
selection and for `get`/`get0`/`mget`/`exists` mode filtering across inherited environments. The
list-valued `utils::combn` flat case is excluded from atomic Oracle v1 and gains an exact recursive
graph covering callback shapes and formals. Checked-in flat conformance is 1,394/1,394, including
1,337 live-R-eligible cases. Recursive Oracle v2 is 260/260 graphs with 536 distinct explicitly
evidenced bindings. Focused graphs pass against the available non-normative GNU R 4.6.0 advisor; GNU
R 4.6.1 remains the release gate.

Profile 0.431 adds flat and exact recursive evidence for two package-driven contracts. S4 slot
replacement admits `NULL` only when the declared slot class accepts `NULL` (including class unions
and `ANY`), preserves `check = FALSE`, and lets `validObject()` diagnose deliberately invalid
objects. The lazy primitive `...names()` reports names without forcing dot promises and rejects use
outside a dots context. Atomic S4 data classes also materialize declared slot defaults before
`initialize()` applies supplied values. Checked-in flat conformance is 1,397/1,397 with 1,340
live-R-eligible cases; recursive Oracle v2 is 262/262 graphs with 539 distinct explicitly evidenced
bindings. Focused live and recursive cases pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains
normative.

Profile 0.432 adds seven flat cases across primitive `rep()` dispatch, simulated annealing,
`noquote()`, coordinate-matrix width admission, zero-selection atomic promotion, replacement
evaluation order, and wholly missing array-subscript identity. Seven exact recursive graphs cover
the corresponding nested values, attributes, calls, and conditions. Checked-in flat conformance is
1,404/1,404 with 1,347 live-R-eligible cases; recursive Oracle v2 is 269 graphs with 541 distinct
explicit binding associations. The focused new live and recursive cases pass against advisory GNU R
4.6.0; GNU R 4.6.1 remains normative.

Profile 0.433 adds flat, integration, and exact recursive evidence for inherited data-frame
coercion. The cases verify ordered S3 fallback through `tbl_df`, `tbl`, and `data.frame`, precedence
of more-specific methods, class reduction, preservation of row names and unrelated attributes,
explicit row-name replacement, atomic single-column extraction, and public method formals.
Checked-in flat conformance is 1,405 cases with 1,348 live-R-eligible cases; recursive Oracle v2 is
270 graphs with 544 distinct explicit binding associations. The focused flat and recursive cases
pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.434 adds one flat case, one integration trace, and one exact recursive graph for
`stats::uniroot`. They pin the Brent safeguard's previous-step state, nonlinear evaluation points,
iteration count, final bracket precision, returned list, and final repeated callback at the selected
root. Checked-in flat conformance is 1,406 cases with 1,349 live-R-eligible cases; recursive Oracle
v2 is 271 graphs with 544 distinct explicit binding associations. The focused flat and recursive
cases pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.435 adds fourteen flat cases and eleven exact recursive graphs for the package-neutral
NAMESPACE selector and reusable graphics, distribution, S3, missing-data, control-record, and
step-function contracts selected by the unchanged `sfsmisc 1.1-25` artifact. PostScript output,
loess fitting, and multi-panel `plot.ts` remain explicit API-only capability boundaries. Checked-in
flat conformance is 1,420/1,420 with 1,363 live-R-eligible cases; recursive Oracle v2 is 282/282
graphs with 556 distinct explicit binding associations. The full recursive suite passes against
advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.436 adds two flat cases and two exact recursive graphs for `stats::symnum`,
`stats::update.formula`, and formula-as-language `as.list`. They cover symbolic matrix values and
attributes, legends, missing values, column abbreviation, complete formals, recursive dot
substitution, formula term normalization, generic update routing, environment identity, and list
language entries. Checked-in flat conformance is 1,422/1,422 with 1,365 live-R-eligible cases;
recursive Oracle v2 is 284/284 graphs with 559 distinct explicit binding associations. The focused
graphs pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.437 adds one flat case and one exact recursive graph for `utils::count.fields`. The
evidence covers path and connection inputs, cursor consumption, whitespace and explicit separators,
empty fields, selectable quote sets, comments, skipped and retained blank lines, multiline quoted
records with physical-line `NA` markers, return type, validation, and complete formals. Checked-in
flat conformance is 1,423/1,423 with 1,366 live-R-eligible cases; recursive Oracle v2 is 285/285
graphs with 561 distinct explicit binding associations. The focused cases pass against advisory GNU
R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.453 adds one live-R-eligible flat case, one API boundary case, and one exact recursive
graph for `stats::plot.ts`. Evidence covers complete formals, univariate and explicit single-panel
regular series, partial `plot.type` selection, invisible results, graphics-window state, and the
retained multi-panel and phase-plot boundaries. The unchanged `sfsmisc 1.1-25`
`example:iterate.lin.recursion` passes and the first blocker advances to generic `predict.lm`
rank-deficiency behavior. Checked-in flat conformance is 1,441/1,441 with 1,382 live-R-eligible
cases; recursive Oracle v2 is 300/300 graphs with 574 distinct explicit behavioral/numeric bindings.
GNU R 4.6.1 remains normative.

Profile 0.454 adds two live-R-eligible flat cases and two exact recursive graphs for unique partial
`predict.lm(newdata=)` matching and finite extreme logarithmic plot windows. Duplicate and ambiguous
argument errors, return values, visibility, `par("usr")`, `par("yaxp")`, and finite generated ticks
are executable evidence. The unchanged `sfsmisc 1.1-25` examples `linesHyperb.lm` and `lseq` pass;
its first blocker advances to missing browser-owned `datasets::LifeCycleSavings`. Checked-in flat
conformance is 1,443/1,443 with 1,384 live-R-eligible cases; recursive Oracle v2 is 302/302 graphs
with 575 distinct explicit behavioral/numeric bindings. GNU R 4.6.1 remains normative.

Profile 0.452 adds one live-R-eligible flat case and one exact recursive graph for language-object
equality. They distinguish strict structural `identical` from `all.equal.language` deparse
equivalence, including parsed versus constructed unary-negative calls, unequal calls, and ordinary
call attributes. The focused cases pass against advisory GNU R 4.6.0. Checked-in flat conformance is
1,440/1,440 with 1,381 live-R-eligible cases; recursive Oracle v2 is 299/299 graphs with 573
distinct explicit behavioral/numeric bindings. GNU R 4.6.1 remains normative.

Profile 0.441 adds one behavioral flat case and one exact recursive graph for
`base::match(incomparables=)`, covering atomic and recursive values, common character coercion,
`NA`/`NaN`, the legacy `FALSE` sentinel, `nomatch`, and exact public formals. Checked-in flat
conformance is 1,428/1,428 with 1,370 live-R-eligible cases; recursive Oracle v2 is 288/288 graphs.
GNU R 4.6.1 remains normative.

Profile 0.455 adds two live-R-eligible flat cases and two exact recursive graphs for the complete
`datasets::LifeCycleSavings` observable data contract and the first `stats::plot.lm` diagnostic
panel. They freeze dataset values, shape, types, row names, aggregates, namespace identity, method
formals, invisible return behavior, and graphics-window coordinates. Integration evidence exercises
all four standard default panels and the explicit Cook's-distance boundary. The focused comparable
cases pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative. Checked-in flat conformance
is 1,445/1,445 with 1,386 live-R-eligible cases; recursive Oracle v2 is 304/304 graphs with 576
distinct explicit behavioral/numeric bindings.

Profile 0.456 adds one live-R-eligible flat case and one exact recursive graph for generic core
example discovery and evaluation. It freezes `utils::example(arrows, package = "graphics")`
visibility plus the structural `x`, `y`, and `s` side effects without comparing or retaining the GNU
R example source. Integration evidence additionally observes the browser arrow segments. The focused
cases pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative. Checked-in flat conformance
is 1,446/1,446 with 1,387 live-R-eligible cases; recursive Oracle v2 is 305/305 graphs with 577
distinct explicit behavioral/numeric bindings.

Profile 0.442 admits the standard scalar `xpd` graphical control through `plot.default`, preserves
the surrounding `par("xpd")` state, and rejects zero- or multi-length controls at GNU R's measured
boundary. One flat case and one exact recursive interaction graph cover logical, missing, numeric,
recursive, and `NULL` inputs. Checked-in flat conformance is 1,429/1,429 with 1,371 live-R-eligible
cases; recursive Oracle v2 is 289/289 graphs. The focused graph passes against advisory GNU R 4.6.0;
GNU R 4.6.1 remains normative.

Profile 0.443 adds the public-domain Brownlee stack-loss family as browser-owned `datasets`
resources: the complete `stackloss` data frame and its historical `stack.x` predictor matrix and
`stack.loss` response vector projections. One flat case and one exact recursive graph cover all
values, storage modes, dimensions, labels, projections, aggregates, and namespace/search identity.
Checked-in flat conformance is 1,430/1,430 with 1,372 live-R-eligible cases; recursive Oracle v2 is
290/290 graphs. The graph passes against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.444 adds the complete PDDL-1.0 `airquality` data frame through the generic browser-owned
`datasets` path. One flat case and one exact recursive graph cover shape, storage, missingness,
values, aggregates, row names, and namespace identity. Checked-in flat conformance is 1,431/1,431
with 1,373 live-R-eligible cases; recursive Oracle v2 is 291/291 graphs. The graph passes against
advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.445 synchronizes `usr`, `xaxp`, `yaxp`, `xlog`, and `ylog` whenever a graphics window is
recorded and makes `graphics::axTicks` consume the active logarithmic axis state. One flat case and
one exact recursive graph reproduce the public logarithmic-axis example's parameter and tick
contract. Checked-in flat conformance is 1,432/1,432 with 1,374 live-R-eligible cases; recursive
Oracle v2 is 292/292 graphs. The graph passes against advisory GNU R 4.6.0; GNU R 4.6.1 remains
normative.

Profile 0.446 adds reusable `stats::dummy.coef.lm` factor expansion over the fitted model's original
levels and contrast metadata. Exact evidence covers main effects, output class and attributes,
coefficient names, singular aliases, and `use.na`. Checked-in flat conformance is 1,433/1,433 with
1,375 live-R-eligible cases; recursive Oracle v2 is 293/293 graphs. The focused graph passes against
advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.447 adds `base::format.info` for atomic display widths, numeric fixed/exponential mode
selection, complex components, `digits`, `nsmall`, and `scipen`. Checked-in flat conformance is
1,434/1,434 with 1,376 live-R-eligible cases; recursive Oracle v2 is 294/294 graphs. The focused
graph passes against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.448 adds one flat case and one exact recursive graph for histogram `xaxt`/`yaxt`
suppression, validation, state neutrality, and plot-disabled laziness. Checked-in flat conformance
is 1,435/1,435 with 1,377 live-R-eligible cases; recursive Oracle v2 is 295/295 graphs. The focused
graph passes against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.449 adds one flat case and one exact recursive graph for logical and numeric
`format(..., scientific=)` controls, integer-penalty truncation, `scipen` inheritance, validation,
and eager forcing. Checked-in flat conformance is 1,436/1,436 with 1,378 live-R-eligible cases;
recursive Oracle v2 is 296/296 graphs. The focused graph passes against advisory GNU R 4.6.0; GNU R
4.6.1 remains normative.

Profile 0.450 adds one numeric flat case and one exact recursive graph for `stats::ksmooth` box and
normal kernels, sorted explicit evaluation points, generated grids, result shape, and exact formals.
Checked-in flat conformance is 1,437/1,437 with 1,379 live-R-eligible cases; recursive Oracle v2 is
297/297 graphs. The focused graph passes against advisory GNU R 4.6.0; GNU R 4.6.1 remains
normative.

Profile 0.451 adds one live-R-eligible flat case and one exact recursive graph for the documented
`stats::Normal` help topic, plus one API-graded browser-owned virtual-PDF case. The GNU-comparable
cases pin topic class, cardinality, attributes, and canonical stats path; the browser case pins an
observable `%PDF` file without requiring a desktop Rd-to-PDF toolchain. Worker integration also
covers unchanged installed-package Rd pages and the absence of browser requests. Checked-in flat
conformance is 1,439/1,439 with 1,380 live-R-eligible cases; recursive Oracle v2 is 298/298 graphs
with 573 distinct explicit behavioral/numeric bindings. The focused comparable cases pass against
advisory GNU R 4.6.0. The profile also corrects the existing `getElement` flat case to pin GNU's
exact, non-S3-dispatch extraction behavior. GNU R 4.6.1 remains normative.

Profile 0.440 adds one numeric flat case and one exact recursive graph for large default
`stats::smooth.spline` fits. They verify 500-observation fitted-value and leverage shape, finite
expanded results, derivative-prediction shape, and retained `smooth.spline` class while the active
browser basis remains bounded. Checked-in flat conformance is 1,427/1,427 with 1,369 live-R-eligible
cases; recursive Oracle v2 is 287/287 graphs with 565 distinct explicit behavioral/numeric bindings.
The focused cases pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.438 adds one API-graded flat case for `tools::Rcmd`. It pins the GNU `args, ...` closure
shape while requiring a deterministic unsupported-feature condition instead of launching a host R
command driver from a browser. Checked-in flat conformance is 1,424/1,424; the live-R-eligible count
remains 1,366 because the browser capability boundary intentionally differs from desktop GNU R
execution. Recursive Oracle v2 remains 285/285 graphs with 561 explicit behavioral/numeric bindings;
GNU R 4.6.1 remains normative.

Profile 0.439 adds two behavioral flat cases and one exact recursive graph for
`graphics::plot.function`. They cover complete formals, S3 dispatch on closures, one vectorized
function evaluation, `y`/`from`/`to`/`xlim` endpoint precedence, invisible `x`/`y` results,
graphical-control forwarding, and integer-valued `seq.int` coordinate storage. Checked-in flat
conformance is 1,426/1,426 with 1,368 live-R-eligible cases; recursive Oracle v2 is 286/286 graphs
with 563 distinct explicit behavioral/numeric bindings. The focused cases pass against advisory GNU
R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.457 adds one live-R-eligible flat case and one exact recursive graph for the complete
independently published `datasets::Puromycin` table. They pin values, shape, numeric storage,
factor-level order, compact row names, aggregates, and namespace/search identity through the generic
declarative data path. Checked-in flat conformance is 1,447/1,447 with 1,388 live-R-eligible cases;
recursive Oracle v2 is 306/306 graphs with 577 distinct explicit behavioral/numeric bindings. The
focused cases pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.458 adds two live-R-eligible flat cases and two exact recursive graphs for default
nonlinear least-squares fitting/profile structure and non-persistent `plot.default(mgp=)` admission.
They pin rounded GNU-compatible coefficients and deviance, residual degrees of freedom, convergence,
S3 profile shape, finite profile values, graphics-control validation, and graphics-state neutrality.
Checked-in flat conformance is 1,449/1,449 with 1,390 live-R-eligible cases; recursive Oracle v2 is
308/308 graphs with 580 distinct explicit behavioral/numeric bindings. The focused graphs pass
against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.459 adds one live-R-eligible flat case and one exact recursive graph for the independently
authored core `stats::lm.influence` example. They pin diagnostic result names, invisible example
return, `lm.SR` side-effect identity, rounded coefficients, and residual length. Checked-in flat
conformance is 1,450/1,450 with 1,391 live-R-eligible cases; recursive Oracle v2 is 309/309 graphs
with 581 distinct explicit behavioral/numeric bindings. The focused graph passes against advisory
GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.464 adds three live-R-eligible flat cases and three exact recursive graphs. They cover
deterministic installed-package `Built` metadata, `sapply()`/`vapply()` simplification names, and
the complete `datasets::Theoph` grouped data frame from an independently licensed source. Checked-in
flat conformance is 1,460/1,460 with 1,401 live-R-eligible cases; recursive Oracle v2 is 319/319
graphs. All focused cases pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.460 adds one live-R-eligible flat case and one exact recursive graph for the complete
seven-object `datasets::state` family. The recursive graph compares every abbreviation, name, area,
map-center coordinate, factor code and level, and `state.x77` matrix value and attribute, while the
flat case pins types, dimensions, labels, aggregates, endpoints, and namespace identity. Checked-in
flat conformance is 1,451/1,451 with 1,392 live-R-eligible cases; recursive Oracle v2 is 310/310
graphs with 581 distinct explicit behavioral/numeric bindings. The focused cases pass against
advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.461 adds three live-R-eligible flat cases and three exact recursive graphs. They cover the
complete fixed 2,820-observation `datasets::sunspots` series, `plot.ts`/`ts.plot` forwarding and
validation of `xaxt` and `yaxt`, and fractional second components in two-component `window()` time
coordinates. Checked-in flat conformance is 1,454/1,454 with 1,395 live-R-eligible cases; recursive
Oracle v2 is 313/313 graphs with 583 distinct explicit behavioral/numeric bindings. The focused
cases pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.462 adds one live-R-eligible flat case and one exact recursive graph for the complete
1,860-by-4 `datasets::EuStockMarkets` multivariate time series. The recursive graph compares all
7,440 values, dimensions, column names, time-series metadata, classes, and namespace identity.
Checked-in flat conformance is 1,455/1,455 with 1,396 live-R-eligible cases; recursive Oracle v2 is
314/314 graphs with 583 distinct explicit behavioral/numeric bindings. The focused cases pass
against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.463 adds two live-R-eligible flat cases and two exact recursive graphs. Numeric
`as.POSIXct()` now covers the optional Unix-epoch origin, integer/double storage, names and matrix
attributes, logical missing values, distinct NA/NaN/infinities, reusable character/Date/POSIXct/
numeric origins, vector recycling, and the exact warning condition. Date/POSIXct axis methods also
accept a recursively forwarded missing `format` promise without forcing it. Checked-in flat
conformance is 1,457/1,457 with 1,398 live-R-eligible cases; recursive Oracle v2 is 316/316 graphs
with 585 distinct explicit behavioral/numeric bindings. Both focused graphs pass against advisory
GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.465 adds two live-R-eligible flat cases and one exact recursive graph for callable
`selfStart` attributes, `SSfol` vector values, generic `getInitial()` dispatch, omitted-start
`nls()` fitting, convergence structure, value prediction, and exact public formals. The recursive
graph compares the admitted value contract after deliberately stripping GNU R's currently
unsupported prediction-gradient attribute; uncertainty and interval behavior are not claimed.
Checked-in flat conformance is 1,462/1,462 with 1,403 live-R-eligible cases; recursive Oracle v2 is
320/320 graphs. The focused graph passes against advisory GNU R 4.6.0; GNU R 4.6.1 remains
normative.

Profile 0.466 adds one live-R-eligible flat case and one exact recursive graph for `ftable()` over
existing atomic arrays. They compare three-dimensional row/column permutation, character, logical,
double, complex, and raw storage, missing masks, dimensions, class, variable metadata, attribute
order, and stats namespace ownership. Checked-in flat conformance is 1,463/1,463 with 1,404
live-R-eligible cases; recursive Oracle v2 is 321/321 graphs. The focused graph and the pre-existing
numeric ftable graph pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.467 adds one live-R-eligible flat case and one exact recursive graph for
`stats::interaction.plot`. They pin factor-cell traversal order, exact callback subsets, closure
side effects, invisible `NULL` return behavior, and all public formal names while exercising the
browser PDF-device lifecycle. Checked-in flat conformance is 1,464/1,464 with 1,405 live-R-eligible
cases; recursive Oracle v2 is 322/322 graphs. The focused graph passes against advisory GNU R 4.6.0;
GNU R 4.6.1 remains normative.

Profile 0.468 adds one live-R-eligible flat case and one exact recursive graph for call-language and
expression-vector `[`/`[[` semantics. They pin positional and named extraction, callee slicing,
argument-tag reconstruction, expression-value unwrapping, expression names, container types, and
empty-tag normalization. Checked-in flat conformance is 1,465/1,465 with 1,406 live-R-eligible
cases; recursive Oracle v2 is 323/323 graphs. The focused graph passes against advisory GNU R 4.6.0;
GNU R 4.6.1 remains normative.

Profile 0.469 adds one live-R-eligible flat case for `matplot()` vector annotations and one exact
recursive graph for the shared `title()` annotation path. They pin acceptance of character and
numeric vectors, expression vectors, missing and empty labels, invisible `NULL` results, and reuse
of the browser graphics title contract. Checked-in flat conformance is 1,466/1,466 with 1,407
live-R-eligible cases; recursive Oracle v2 is 324/324 graphs. Both focused cases pass against
advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.470 adds one live-R-eligible flat case and one exact recursive graph for atomic
`format.default()` over matrices, three-dimensional arrays, and named vectors. They pin formatted
values, dimensions, named dimension axes, attribute order, names-only vector behavior, and removal
of unrelated attributes. Checked-in flat conformance is 1,467/1,467 with 1,408 live-R-eligible
cases; recursive Oracle v2 is 325/325 graphs. Both focused cases pass against advisory GNU R 4.6.0;
GNU R 4.6.1 remains normative.

Profile 0.471 adds one live-R-eligible flat case and one exact recursive graph for omitted
`formals()` caller reflection, exact public default expressions, missing formal entries, and
character lookup through an explicit environment. Checked-in flat conformance is 1,468/1,468 with
1,409 live-R-eligible cases; recursive Oracle v2 is 326/326 graphs. Both focused cases pass against
advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

Profile 0.472 upgrades the existing `grDevices::postscript` flat case from API-only boundary
evidence to behavioral device evidence. It compares formals, open visibility, device identity and
geometry, close behavior, `%!PS`, DSC page/trailer markers, and nonempty file output. Because the
case was strengthened in place, checked-in counts remain 1,468 flat cases, 1,409 live-R-eligible
cases, and 326 recursive graphs. The focused case passes against advisory GNU R 4.6.0; pinned GNU R
4.6.1 remains the normative release gate.

## Profile 0.473 evidence increment

The flat suite adds `read-lines-browser-native-utf8-encoding-alias-contract`, covering native alias
acceptance, non-ASCII UTF-8 roundtrip, result marks, and file cleanup. Oracle v2 adds
`recursive-read-lines-browser-native-utf8-encoding-alias-contract`, covering nested alias results,
encoding marks, and identity against GNU R. Totals are 1,469 flat cases, 1,410 live-R-eligible
cases, and 327 recursive graphs.

## Profile 0.474 evidence increment

The flat suite adds `stopifnot-exprs-block-expr-object-short-circuit-and-mutual-exclusion-contract`;
Oracle v2 adds `recursive-stopifnot-exprs-block-expr-object-short-circuit-contract`. Together they
cover sequential block evaluation, nested result structure, source diagnostics, short-circuit side
effects, explicit expression objects, invisibility, and mode exclusivity. Totals are 1,470 flat
cases, 1,411 live-R-eligible cases, and 328 recursive graphs.

## Profile 0.475 evidence increment

The flat suite adds `tools-assert-error-capture-formals-visibility-and-failure-contract`; Oracle v2
adds `recursive-tools-assert-error-capture-and-failure-contract`. Totals are 1,471 flat cases, 1,412
live-R-eligible cases, and 329 recursive graphs.

## Profile 0.476 evidence increment

The flat suite adds `package-version-major-minor-metadata-list-contract`; Oracle v2 adds
`recursive-package-version-major-minor-metadata-list-contract`. They pin the named `major`/`minor`
metadata-list exception, the `R_system_version` class stack, strict three-component validation,
extra-field tolerance, and continued rejection of ordinary lists. Totals are 1,472 flat cases, 1,413
live-R-eligible cases, and 330 recursive graphs. Focused live evidence passes against advisory GNU R
4.6.0; GNU R 4.6.1 remains normative.

## Profile 0.477 evidence increment

The flat suite adds `r-compiled-by-portable-shape-names-formals-and-binding-contract`; Oracle v2
adds `recursive-r-compiled-by-portable-shape-contract`. They compare callable type, zero formals,
named two-element character shape, populated toolchain labels, and locked base binding while
treating compiler text as platform-adapted. Totals are 1,473 flat cases, 1,414 live-R-eligible
cases, and 331 recursive graphs. Focused evidence passes against advisory GNU R 4.6.0; GNU R 4.6.1
remains normative.

## Profiles 0.478–0.480 evidence increments

Profile 0.478 adds flat and recursive cases for the complete `extSoftVersion()` name shape, zero
formals, populated-version invariant, missing-value exclusion, and locked binding. Profile 0.479
adds corresponding `La_version()` and `La_library()` evidence for the pinned LAPACK 3.12.1 backend.
Profile 0.480 adds exact `pcre_config()` Unicode, JIT, stack, formal, and locking evidence. Totals
are 1,476 flat cases, 1,417 live-R-eligible cases, and 334 recursive graphs. Focused evidence passes
against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

## Profiles 0.481–0.484 semantic and package-closure evidence

Profiles 0.481–0.482 add graphics evidence for expression/language legend labels and inherited
logarithmic `curve(add = TRUE)` coordinates, plus reusable parallel-extrema, one-dimensional array
binding, mixed-frame `data.matrix`, and corrected `datasets::esoph` storage contracts. Profile 0.483
adds the complete browser-owned `datasets::iris3` projection and language-aware
`all.equal.expression` evidence for generated negative exponents. Profile 0.484 adds primitive
`as.integer` S3 dispatch and numeric Epanechnikov `density.default` evidence. The latter uses an
absolute/relative Oracle v2 tolerance because NativR evaluates the admitted kernel directly while
GNU R uses a discretized estimator.

Totals are 1,485 flat cases, 1,426 live-R-eligible cases, and 344 recursive graphs. The unchanged
`sfsmisc 1.1-25` artifact passes its complete applicable generic package-check plan at P7. Focused
recursive evidence passes against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

## Profile 0.485 evidence increment

The flat suite adds `get-exported-value-namespace-reflection-and-validation-contract`; Oracle v2
adds `recursive-get-exported-value-namespace-reflection-and-validation-contract`. They pin character
and namespace-environment selection, symbol and character binding names, exact closure formals,
public-binding identity, and deterministic missing-package, non-export, namespace, and variable
diagnostics. Totals are 1,486 flat cases, 1,427 live-R-eligible cases, and 345 recursive graphs. The
unchanged `testit 1.1` artifact passes its complete applicable generic package-check plan and
independent all-export scenario at scoped P7. Focused evidence passes against advisory GNU R 4.6.0;
GNU R 4.6.1 remains normative.

## Profile 0.486 evidence increment

The flat suite adds `transpose-one-dimensional-array-dimnames-and-rank-validation`; Oracle v2 adds
`recursive-transpose-one-dimensional-array-contract`. They pin rank-one row-matrix conversion,
empty-axis normalization, class retention, one- and two-dimensional dimname-axis labels, and the
rank-greater-than-two diagnostic. Totals are 1,487 flat cases, 1,428 live-R-eligible cases, and 346
recursive graphs. The unchanged `Metrics 0.1.4` artifact passes its complete applicable generic
package-check plan and independent multi-domain metric scenario at scoped P7. Focused evidence
passes against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

## Profile 0.487 evidence increment

The flat suite adds `noncentral-probability-tail-recycling-attributes-and-formals-contract` and
`graphics-points-formula-dispatch-formals-and-visibility-contract`; Oracle v2 adds corresponding
recursive numeric-tolerance and exact dispatch graphs. They cover non-central chi-square, F, and
Student-t probabilities, tails, recycling, attributes, formal metadata, formula S3 dispatch,
invisibility, and browser graphics coordinates. Totals are 1,489 flat cases, 1,430 live-R-eligible
cases, and 348 recursive graphs. The unchanged `pwr 1.3-0` artifact passes its complete applicable
generic package-check plan and independent all-export scenario at scoped P7. Focused evidence passes
against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

## Profile 0.488 evidence increment

The flat suite adds exact browser-device, hypergeometric-tail, and recursive grid-list contracts;
Oracle v2 adds the corresponding exact or absolute/relative observation graphs. The evidence pins
browser-owned SVG and TIFF lifecycle/formals, real TIFF LZW strips, `stats::phyper` rounding and
tail behavior, recursive `grid::gList` flattening, and generic `grid.draw` dispatch/rendering.
Totals are 1,493 flat cases, 1,434 live-R-eligible cases, and 352 recursive graphs. The unchanged
`VennDiagram 1.8.2` artifact now installs, loads, attaches, documents all exports, and passes its
ordinary drawing examples through shared primitives; its remaining first blocker is recorded in the
package corpus rather than treated as completion. Focused evidence passes against advisory GNU R
4.6.0; GNU R 4.6.1 remains normative.

## Profile 0.489 evidence increment

The flat suite adds GNU-compatible `cbind.data.frame` expansion for atomic and list matrices plus
grid graphics-annotation preservation/coercion; Oracle v2 adds exact recursive object graphs for
both contracts. The matrix evidence covers recycling, column naming, explicit and automatic row
names, list-column element names, atomic columns, and mismatch diagnostics. Grid evidence preserves
expression, language, and symbol labels while coercing ordinary atomic annotations to character.
Totals are 1,495 flat cases, 1,436 live-R-eligible cases, and 354 recursive graphs. The unchanged
`VennDiagram 1.8.2` artifact passes its complete applicable package-check plan and independent
scenario at scoped P7. Existing flat and recursive `stopifnot` evidence is strengthened to pin
source-preserving binary-expression diagnostics; unchanged `httpcode 0.3.0` then passes at scoped
P7. Advisory GNU R 4.6.0 passes the focused evidence; GNU R 4.6.1 remains normative.

## Profile 0.490 evidence increment

The flat suite adds `color-converter-row-vectorization-and-custom-convert-color`,
`color-converter-colorspaces-and-rgb2hsv-shape-contract`, and
`structure-null-dim-and-short-missing-names-contract`. Oracle v2 adds one exact recursive graph over
the converter object, custom conversion, non-callable `colorspaces` binding, HSV matrix, and
structural attributes. Totals are 1,498 flat cases, 1,439 live-R-eligible cases, and 355 recursive
graphs. The capability schema now records non-callable namespace bindings explicitly, so the graph
is machine-associated with all 15 relevant behavioral or numeric bindings. The unchanged
`shades 1.5.0` artifact passes its complete applicable package-check plan and independent scenarios
at scoped P7. Advisory GNU R 4.6.0 passes the focused exact evidence; GNU R 4.6.1 remains normative.

## Profile 0.506 evidence increment

The flat suite adds `call-embeds-recursive-runtime-values-contract` and
`stats-make-link-standard-family-contract`; Oracle v2 adds the corresponding exact recursive object
graphs. They cover runtime-created call identity, the public nine-link `stats::make.link` structure,
closure formals, representative link/inverse/derivative values, validity predicates, and family
reuse. Totals are 1,543 flat cases, 1,484 live-R-eligible cases, 399 recursive graphs, and 674
recursively evidenced bindings. Unchanged `enrichwith 0.5.0` passes its applicable generic plan and
independent scenario at scoped P7. Focused advisory GNU R 4.6.0 evidence passes; GNU R 4.6.1 remains
normative.

## Profile 0.513 evidence increment

The flat suite adds GNU R-observed contracts for `format.pval()` thresholds, significant formatting
and formals; numeric and character `par(lend=)` normalization and diagnostics; and `data.frame()`
treatment of `NULL` beside zero-row and nonzero columns. Oracle v2 retains the same values, formals,
graphics state, empty data-frame graph, and mismatch diagnostic. Integration evidence additionally
covers recursive plotmath labels, title-scale propagation, line-cap delivery through
Browser/PNG/SVG/PDF/PostScript devices, and generic LazyData object-to-resource mapping. The
metadata-frozen unchanged `diagram 1.6.5` artifact passes its complete applicable package check and
an independently authored plotting scenario at scoped P7. GNU R 4.6.0 is only the available
non-normative advisor; GNU R 4.6.1 remains the compatibility target.

## Profile 0.514 evidence increment

The flat suite adds `grdevices-as-graphics-annot-contract` and
`stats-hatvalues-generic-and-lm-contract`; Oracle v2 adds the corresponding recursive object graphs.
They cover annotation identity/coercion, exact public and method formals, ordinary and weighted
linear-model leverage, GLM inheritance, a supplied influence object, and custom S3 dispatch. The GLM
graph declares a `1e-5` absolute/relative tolerance for the independent IRLS path; the annotation
graph is exact. The unchanged `plotmo 3.7.1` artifact reaches the next ordered namespace blocker,
missing `stats::qqline`, and remains P1. GNU R 4.6.0 is advisory; GNU R 4.6.1 remains normative.

## Profile 0.516 evidence increment

The flat suite adds the qqline, call-tail pairlist, captured-dots promise-provenance, and
plot-stepfun contracts. Oracle v2 adds exact recursive graphs for each shared semantic increment.
Integration evidence covers active versus expired promise provenance, generic step-function
graphics, and the unchanged plotmo P6 check plan. The independent multi-predictor plotmo scenario
records the non-atomic `abbreviate()` input as the first P7 blocker. GNU R 4.6.1 remains normative.

Profile 0.519 adds flat GNU R-observed contracts for million-element colon sequence type/endpoints
and Math data-frame/numeric-alike S3 behavior. One exact recursive case retains the sequence,
rounded data frame, attributes, predicate results, and diagnostic. Checked-in conformance advances
to 1,565/1,565; Oracle v2 advances to 413 cases with 687 explicitly associated behavioral/numeric
bindings after manifest regeneration. GNU R 4.6.1 remains normative; the installed 4.6.0 advisor is
used only for non-normative local comparison.

## Profile 0.521 evidence increment

The flat suite adds `pearson-chi-square-test-structure-and-values-contract`; Oracle v2 adds
`recursive-pearson-chi-square-test-contract`. Together they cover goodness-of-fit and contingency
statistics, expected values, residuals, standardized residuals, Yates correction, warning call
provenance, exact formals, paired-input data names, table dimname labels, classes, and attribute
order. Totals are 1,567 checked-in cases, 1,509 live-R-eligible cases, 415 recursive graphs, and 692
explicitly associated behavioral/numeric bindings. Focused flat and recursive comparisons pass
against the installed non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the compatibility
target.

Profile 0.525 adds flat and recursive evidence for call-valued `stats::deriv.default`, executable
gradient/Hessian attributes, `tools::assertWarning`, `.Deprecated`, and structural BFGS `optim`
trace behavior. Trace text is compared by stable record kind and result structure rather than
optimizer-specific intermediate numeric strings. Profile totals are 1,572 checked-in cases, 1,514
live-R-eligible cases, 420 recursive graphs, and 695 explicitly associated behavioral/numeric
bindings. The two new recursive cases pass against the installed non-normative GNU R 4.6.0 advisor;
GNU R 4.6.1 remains the release target.
