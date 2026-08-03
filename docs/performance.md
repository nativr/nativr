# Performance and bundle discipline

The JavaScript reference backend uses typed arrays and tight loops. It is a correctness baseline,
not a final optimized kernel. `pnpm benchmark` measures short parse/evaluation, scalar arithmetic,
100,000-element mean, typed assignment, and raw snapshots after a build.

Budgets:

- statically loaded public client: 150 KiB gzip;
- Worker JavaScript: 401 KiB gzip;
- parser Wasm assets combined: 1.5 MiB raw (stricter than the requested gzip ceiling).

The inline semantic host is a lazy chunk and is excluded from the default client budget. Parser Wasm
remains a physical asset; it is not base64-embedded. Future Wasm/WebGPU/table engines must be
optional lazy packages and are not bootstrap dependencies.

The Worker ceiling increased from 256 to 260 KiB when language subset 0.106 added the first
network-free graphics vertical slice. The additional budget covers owned raster conversion, graphics
state, and the wire command contract; Canvas rendering remains in the separately budgeted Playground
client.

Language subset 0.109 raises the ceiling from 260 to 264 KiB for the independently implemented
`outer` callable path: caller-environment function lookup, lazy ellipsis forwarding, vector/array
Cartesian inputs, dimension-name propagation, and user-defined infix dispatch. The measured bundle
is 260.2 KiB gzip, so the four-KiB ceiling preserves a small explicit margin without weakening the
client or Wasm budgets.

Language subset 0.113 raises the ceiling from 264 to 268 KiB for the independently implemented real
symmetric Jacobi decomposition and bounded one- through three-dimensional asymmetric complex
eigenpair path required by jsonlite's measured example. The first production build with this path
measures 265.5 KiB gzip.

Language subset 0.114 keeps the 268 KiB ceiling while adding generalized `colSums` accumulation,
numeric data-frame traversal, missing-value masks, and result-axis propagation for the measured loo
and zoo examples. The first production build with this path measures 266.4 KiB gzip.

Language subset 0.115 keeps the same ceiling while adding regular-series `time` coordinate
generation, S3 forwarding, tolerance snapping, and result metadata for the measured data.table and
zoo paths. The first production build with this path measures 266.8 KiB gzip.

Language subset 0.116 keeps the 268 KiB ceiling while adding `na.omit` S3 forwarding, atomic and
row-wise incomplete-case selection, omission metadata, and edge-only regular-series trimming for the
measured data.table and zoo paths. The first production build with this path measures 267.9 KiB
gzip.

Language subset 0.117 raises the Worker ceiling from 268 to 272 KiB after sharing the real
`floor`/`ceiling` rounding kernel. The increment covers direct and Math-group S3 forwarding,
class-aware rejection, missing/non-finite preservation, and attribute propagation for the measured
data.table and zoo `ceiling` paths. The first production build measures 268.0 KiB gzip; the four-KiB
step restores an explicit margin while leaving the public-client and parser-Wasm budgets unchanged.

Language subset 0.118 keeps the 272 KiB ceiling while adding independently implemented
`stats::approx` coordinate regularization, linear/constant interpolation, endpoint rules, missing
values, duplicate reducers, and explicit-coordinate metadata for the measured data.table and zoo
paths. The first production build measures 269.8 KiB gzip.

Language subset 0.119 keeps the 272 KiB ceiling while adding the bounded `standardGeneric`
definition/dispatch path, including session-local S4 method lookup, formal/default/dots forwarding,
`ANY`, and call-context errors for the measured S7 declaration. The first production build measures
270.1 KiB gzip.

Language subset 0.120 keeps the 272 KiB ceiling while adding the independently implemented linear
RGB/CIE Lab `colorRampPalette` path, returned first-class palette function, bias, alpha, and exact
isoband Viridis output. The first production build measures 272.0 KiB gzip.

Language subset 0.121 raises the Worker ceiling from 272 to 276 KiB for the deterministic,
browser-native `utils::sessionInfo` value graph required by otel's measured platform lookup. The
four-KiB step covers the nested R-version shape, live locale/RNG projection, attached-package
metadata, and explicit platform identity while leaving the public-client and parser-Wasm budgets
unchanged. The first production build measures 272.5 KiB gzip.

Language subset 0.122 keeps the 276 KiB ceiling while adding `as.ordered` default coercion,
ordered-factor identity, unused-level remapping, name retention, and S3 forwarding for generics'
measured example. The first production build measures 272.8 KiB gzip.

Language subset 0.123 keeps the 276 KiB ceiling while adding `as.array`/`as.array.default` S3
dispatch, lazy dots, one-dimensional vector/list/factor/pairlist shaping, name-to-dimname promotion,
and existing-array identity for rstan's measured extension shape. The first production build
measures 273.0 KiB gzip.

Language subset 0.124 keeps the 276 KiB ceiling while adding registered `stats::nlm`, lazy objective
arguments, analytic-derivative validation, finite-difference gradients and Hessians, bounded BFGS
updates, Armijo line search, and GNU R-shaped convergence results for rstan's measured callback
shape. The first production build measures 275.6 KiB gzip.

Language subset 0.125 raises the Worker ceiling from 276 to 280 KiB for rstan's measured
`stats::optim` BFGS objective/gradient path. The four-KiB step covers named/scaled callback
parameters, lazy shared arguments, numerical-gradient fallback, optimization controls, call counts,
optional named Hessians, and explicit method boundaries. The first production build measures 277.6
KiB gzip.

Language subset 0.126 keeps the 280 KiB ceiling while adding the `graphics::pairs` S3 extension
point required by rstan's measured package method, including lazy plotting arguments and an explicit
default-device boundary. The first production build measures 277.7 KiB gzip.

Language subset 0.127 keeps the 280 KiB ceiling while adding the measured registered
`grDevices::heat.colors` palette, deterministic hexadecimal generation, optional alpha, reversal,
numeric-count coercion, and explicit invalid-input boundaries. The first production build measures
278.1 KiB gzip.

Language subset 0.128 keeps the 280 KiB ceiling while adding xfun's measured `factorial(10)` call,
vectorized direct integer products, a bounded Lanczos/reflection path for other real values,
missing/non-finite handling, attribute retention, and domain warnings. The first production build
measures 278.6 KiB gzip.

Language subset 0.129 keeps the 280 KiB ceiling while adding xfun's measured `stats::lsfit` example,
direct vector/matrix predictor shaping, weights, complete-case handling, named fit components, and
classed bounded QR metadata from the existing owned least-squares solver. The first production build
measures 279.9 KiB gzip.

Language subset 0.130 raises the Worker ceiling from 280 to 284 KiB while adding xfun's measured
`strwrap` paragraph-vector path. The four-KiB step covers paragraph splitting, sentence-gap
preservation, width and indentation controls, prefix handling, atomic coercion, and simplified or
list-shaped output. The first production build measures 280.6 KiB gzip.

Language subset 0.131 raises the Worker ceiling from 284 to 288 KiB while adding the earlier
rank-207 `grDevices::rgb` dependency and stringr's measured rank-366 `col2rgb` path. The step
includes the compact complete named-color byte table, short/long RGB(A), transparent and numeric
palette specifications, named integer-matrix output, recycled forward intensity conversion, and
shared catalog parsing for palette generation. The first production build measures 284.1 KiB gzip.

Language subset 0.132 keeps the 288 KiB ceiling while adding stringi's measured rank-368
`simplify2array` paths. The implementation reuses owned vector/list representations and common-type
promotion for scalar vectors, matrices, list-valued cells, exception lengths, and higher-dimensional
metadata. The first production build measures 284.7 KiB gzip.

Language subset 0.133 keeps the 288 KiB ceiling while adding the rank-376/377
`str2expression`/`str2lang` parser wrappers. They reuse the existing Tree-sitter-to-normalized-AST
pipeline and owned language snapshots rather than adding a second parser or code-generation path.
The first production build measures 284.9 KiB gzip.

Language subset 0.134 keeps the 288 KiB ceiling while adding the rank-378 `utils::URLdecode`
vertical path. A small owned UTF-8 validator/decoder avoids Node, DOM, locale, network, and URL API
dependencies while making malformed browser-string boundaries explicit. The first production build
measures 285.5 KiB gzip.

Language subset 0.135 keeps the 288 KiB ceiling while adding the rank-379 `warningCondition`
constructor over the existing owned list, class, and condition-message machinery. The measured
backports shape does not add a host adapter or another signaling system. The first production build
measures 285.9 KiB gzip.

Language subset 0.136 keeps the 288 KiB ceiling while adding openssl's rank-382/383 `stats::qbinom`
and `stats::qnorm` paths. The normal path reuses the existing owned approximation, while the
binomial path reuses the regularized-beta implementation with bounded binary search. The first
production build measures 286.7 KiB gzip.

Language subset 0.137 keeps the 288 KiB ceiling while adding openssl's rank-384 `rawToBits` path.
The implementation expands bytes directly over the existing raw-vector storage without a codec, host
adapter, or dependency. The first production build measures 286.8 KiB gzip.

Language subset 0.138 keeps the 288 KiB ceiling while adding matrixStats' rank-385/386 `rowMeans`
and `colMeans` paths over the existing owned column-major array and data-frame representations. The
shared reducer adds no host numeric adapter or dependency. The first production build measures 287.0
KiB gzip.

Language subset 0.139 keeps the 288 KiB ceiling while adding matrixStats' rank-387
`stats::weighted.mean` comparisons. The generic/default pair uses direct owned real/complex
accumulation and adds no host numeric adapter or dependency. The first production build measures
287.7 KiB gzip.

Language subset 0.140 raises the Worker ceiling from 288 to 290 KiB for matrixStats' rank-388
`stats::mad` path. The approximately 0.4 KiB measured increase covers the second sorted selection,
low/high median controls, and explicit center/constant validation. The first production build
measures 288.1 KiB gzip.

Language subset 0.141 keeps the 290 KiB ceiling while adding loo's rank-391 `stats::rbeta` prior and
posterior draw shapes. The owned implementation reuses session RNG state and adds stable log-gamma
ratios plus finite non-central Poisson mixtures without a host statistics dependency. The first
production build measures 288.9 KiB gzip.

Language subset 0.142 keeps the 290 KiB ceiling while completing loo's rank-392 `stats::dbinom`
vectorized log-likelihood. Direct small-edge log products and the existing owned Lanczos
approximation avoid a new statistics dependency while retaining large-count log output. The first
production build measures 289.3 KiB gzip.

Language subset 0.143 keeps the 290 KiB ceiling while completing loo's rank-393
`base::mat.or.vec(10, 3)` allocation. The small owned branch/extent validator and direct typed-array
allocation add no host dependency. The first production build measures 289.7 KiB gzip.

Language subset 0.144 raises the Worker ceiling from 290 to 292 KiB while completing data.table's
rank-395 primitive `base::seq.int` index calls. The approximately 0.8 KiB measured increase covers
internal `seq` dispatch, regular-step and requested-length generation, storage selection, and finite
resource validation. The first production build measures 290.5 KiB gzip.

Language subset 0.145 keeps the 292 KiB ceiling while completing data.table's rank-396 `methods::as`
package-coercion checks. The approximately 0.4 KiB measured increase covers the session-local
source/target registry, inherited source-class traversal, identity handling, and constructor
fallback. The first production build measures 290.9 KiB gzip.

Language subset 0.146 keeps the 292 KiB ceiling while completing data.table's rank-402 `weekdays`
IDate labeling calls. The approximately 0.7 KiB measured increase covers S3 Date/POSIXt dispatch,
the deterministic C-locale catalog, recycled abbreviation coercion, and bounded UTC weekday
arithmetic. The first production build measures 291.6 KiB gzip.

Language subset 0.147 raises the Worker ceiling from 292 to 293 KiB while completing data.table's
rank-404 `anyDuplicated` package-method call and owned defaults. The approximately 0.8 KiB measured
increase covers S3 dispatch, directional atomic/list/data-frame comparison, incomparables, and
bounded control validation. The first production build measures 292.4 KiB gzip.

Language subset 0.148 raises the Worker ceiling from 293 to 294 KiB while completing data.table's
rank-408 `rep.int` adaptive-window tail call. The approximately 0.7 KiB measured increase covers
preflighted repeat plans, typed atomic/list/expression output, factor metadata, coercion, and
internal-S3 dispatch. The first production build measures 293.1 KiB gzip.

Language subset 0.149 keeps the 294 KiB Worker ceiling while completing data.table's rank-409
`methods::representation` legacy S4 declaration call. The implementation reuses the owned list,
argument, namespace, and session-local class-registry paths; the first production build measures
293.4 KiB gzip.

Language subset 0.150 keeps the 294 KiB Worker ceiling while completing data.table's rank-410
`trunc` ITime method call shape and an owned toward-zero numeric default. Direct/Math dispatch and
the shared typed-vector rounding path keep the first production build at 293.4 KiB gzip.

Language subset 0.151 raises the Worker ceiling from 294 to 296 KiB while completing data.table's
rank-411 `utils::type.convert` split-column callback. The approximately 1.7 KiB measured increase
covers deterministic logical/integer/double/complex recognition, factor fallback, recursive
container methods, controls, and S3 dispatch. The first production build measures 295.1 KiB gzip.

Language subset 0.152 keeps the 296 KiB Worker ceiling while completing Shiny's rank-414
`withVisible` stack-trace call shape. Promise-aware first-force visibility, named result
construction, and the already-forced lookup boundary add approximately 0.2 KiB; the first production
build measures 295.3 KiB gzip.

Language subset 0.153 raises the Worker ceiling narrowly to 298 KiB while completing Shiny's
rank-419 `strftime` log timestamp. Owned UTC/GMT POSIXlt conversion, bounded C-locale token
expansion, fractional seconds, recycling, names, and custom dispatch add approximately 1.8 KiB; the
first production build measures 297.1 KiB gzip.

Language subset 0.154 raises the Worker ceiling narrowly to 299 KiB while completing ragg's rank-420
`as.raster` capture-matrix conversion. Row-first raster construction, grayscale/RGB(A) conversion,
vector reshaping, S3 methods, predicates, and the namespace surface add approximately 1.1 KiB; the
first production build measures 298.2 KiB gzip.

Language subset 0.155 keeps the 299 KiB Worker ceiling while completing ragg's rank-421
`dev.flush()` call shape and the paired owned-device `dev.hold()` protocol. Nested levels,
cross-evaluation command buffering, ordered release, reset cleanup, and pending-byte enforcement add
approximately 0.6 KiB; the first production build measures 298.8 KiB gzip.

Language subset 0.156 raises the Worker ceiling narrowly to 301 KiB while completing ragg's rank-422
same-session `recordPlot()`/`replayPlot()` path. The independently owned display-list encoding,
strict decoder, page/window/raster replay, package metadata, hold integration, and resource guards
add approximately 1.2 KiB; the first production build measures 300.0 KiB gzip.

Language subset 0.157 keeps the 301 KiB Worker ceiling while completing posterior's rank-423
`stats::ppoints()` probability grid. Scalar/observation counts, default and vectorized real/complex
offsets, attribute retention, recycling warnings, laziness, and allocation guards add approximately
0.5 KiB; the first production build measures 300.5 KiB gzip.

Language subset 0.158 raises the Worker ceiling narrowly to 302 KiB while completing posterior's
rank-424 `base::chol()` S3 seam and owned default factorization. Unpivoted and positive-semidefinite
pivoted algorithms, rank/pivot metadata, numeric data-frame conversion, dimnames, warnings, and
bounded controls add approximately 1.0 KiB; the first production build measures 301.5 KiB gzip.

Language subset 0.159 raises the Worker ceiling narrowly to 303 KiB while completing posterior's
rank-425 `stats::pnorm()` vectorized-mean example. Reuse of the owned regularized-gamma normal tail,
a compact far-log-tail expansion, vectorized argument handling, attributes, and domain guards add
approximately 0.6 KiB; the first production build measures 302.1 KiB gzip.

Language subset 0.160 keeps the 303 KiB Worker ceiling while completing posterior's rank-426
`stats::rgamma()` examples. The public vectorized wrapper reuses the existing session-owned gamma
sampler and adds rate/scale validation, limit paths, missing/domain aggregation, and namespace
registration in approximately 0.4 KiB; the first production build measures 302.5 KiB gzip.

Language subset 0.161 raises the Worker ceiling narrowly to 305 KiB while completing posterior's
rank-427 `graphics::segments()` vertical-interval example. Endpoint/style recycling, normalized
colors and dash patterns, bounded graphics/display-list records, strict replay decoding, and the
Canvas-facing event contract add approximately 1.5 KiB; the first production build measures 304.0
KiB gzip.

Language subset 0.162 keeps the 305 KiB Worker ceiling while completing rprojroot's rank-428
`utils::glob2rx("DESCRIPTION")` example. Owned-value coercion, vectorized wildcard/anchor
translation, trimming controls, and bounded output add approximately 0.8 KiB; the first production
build measures 304.8 KiB gzip.

Language subset 0.163 raises the Worker ceiling narrowly to 306 KiB while completing httr's rank-429
`sQuote(req$url)` examples. Deterministic C-locale defaults, UTF-8/TeX/custom quote selection,
owned-value coercion, and resettable option state add approximately 0.3 KiB; the first production
build measures 305.1 KiB gzip.

Language subset 0.164 keeps the 306 KiB Worker ceiling while completing distributional's rank-430
`stats::family()` generic seam. Reuse of the evaluator's existing S3 dispatch stack plus a bounded
lazy forwarding adapter adds less than 0.1 KiB at the displayed precision; the first production
build remains 305.1 KiB gzip.

Language subset 0.165 keeps the 306 KiB Worker ceiling while completing rstudioapi's rank-431
`utils::View()` call shape. Owned rectangular coercion, character-formatted data-view journaling,
the public inline/Worker callback, and the Playground table renderer add approximately 0.8 KiB to
the Worker bundle; the first production build measures 305.9 KiB gzip.

Language subset 0.166 raises the Worker ceiling narrowly to 307 KiB while completing diffobj's
rank-433 `path.expand()` expression and its higher-reach `file.path()` dependency. Vectorized path
text coercion, recycling, separator handling, and the browser unknown-home contract add
approximately 0.3 KiB; the first production build measures 306.2 KiB gzip.

Language subset 0.167 keeps the 307 KiB Worker ceiling while completing diffobj's rank-434
`methods::setOldClass()` guides-method registration. Session-owned class chains and inherited
single-object S4/coercion lookup add approximately 0.4 KiB; the first production build measures
306.6 KiB gzip.

Language subset 0.168 keeps the 307 KiB Worker ceiling while completing diffobj's rank-435
`methods::show()` extension shape. Detailed method invocation visibility, inherited display
dispatch, and deterministic fallback output add approximately 0.2 KiB; the first production build
measures 306.8 KiB gzip.

Language subset 0.169 raises the Worker ceiling narrowly to 308 KiB while completing httpuv's
rank-436 `utils::capture.output()` request-inspection shape. Nested stream-selective capture,
visible-result formatting, line reconstruction, split duplication, resource accounting, and the
adjacent GNU R `cat` newline-terminator rule add approximately 0.7 KiB; the first production build
measures 307.5 KiB gzip.

Language subset 0.170 adds the rank-437 `utils::demo()` empty-catalog shape and explicit external
package-resource boundary without raising the ceiling. After the Vite 8/Oxc build migration, the
complete production Worker measures 283.7 KiB gzip against the 308 KiB limit.

Language subset 0.171 adds the rank-438 `RNGversion()` selector and version parser without raising
the ceiling. The complete production Worker measures 284.0 KiB gzip against the 308 KiB limit.

Language subset 0.172 adds ranks 439-443's regular time-series constructor, coercion, frequency,
window selection, integral downsampling, extension padding, and S3 seams without raising the
ceiling. The complete production Worker measures 285.7 KiB gzip against the 308 KiB limit.

Language subset 0.173 adds rank 444's `graphics::legend()` event, resolved line/point keys, geometry
result, strict display-list codec, and browser Canvas renderer without raising the Worker ceiling.
The complete production Worker measures 287.9 KiB gzip against the 308 KiB limit.

Language subset 0.174 adds rank 445's `comment()` getter/replacement and matching special-attribute
validation without raising the ceiling. The complete production Worker measures 288.1 KiB gzip
against the 308 KiB limit.

Language subset 0.175 adds rank 446's `stats::cycle()` generic, regular-series coordinate default,
and package-method S3 seam without raising the ceiling. The complete production Worker measures
288.3 KiB gzip against the 308 KiB limit.

Language subset 0.176 adds rank 447's `signif()` real/complex significant-digit rounding and S3
dispatch seams without raising the ceiling. The complete production Worker measures 288.9 KiB gzip
against the 308 KiB limit.

Language subset 0.177 adds rank 448's `graphics::axTicks()` linear state-derived and explicit
parameter paths without raising the ceiling. The complete production Worker measures 289.6 KiB gzip
against the 308 KiB limit.

Language subset 0.178 adds rank 449's `graphics::box()` resolved plot-frame event, Worker transport,
Canvas renderer, and display-list codec without raising the ceiling. The complete production Worker
measures 290.4 KiB gzip against the 308 KiB limit.

Language subset 0.179 adds rank 450's `graphics::boxplot()` Tukey-statistics path, grouped graphics
event, Worker transport, Canvas renderer, and display-list codec without raising the ceiling. The
complete production Worker measures 292.8 KiB gzip against the 308 KiB limit.

Language subset 0.180 adds rank 451's `stats::deltat()` S3 generic and validated sampling-interval
default without raising the ceiling. The complete production Worker remains 292.8 KiB gzip against
the 308 KiB limit.

Language subset 0.181 adds rank 452's `stats::embed()` column-major lag-matrix construction,
fractional-vector compatibility, attribute normalization, and result-length accounting without
raising the ceiling. The first production Worker measures 293.3 KiB gzip against the 308 KiB limit.

Language subset 0.182 adds rank 453's `base::findInterval()` sorted-break validation, numeric
coercion, interval controls, and checkpointed binary search without raising the ceiling. The first
production Worker measures 293.9 KiB gzip against the 308 KiB limit.

Language subset 0.183 adds ranks 454-455's shared `grDevices` gray/grey level and gamma-corrected
palette generation, including validation, alpha composition, reversal, and byte formatting without
raising the ceiling. The first production Worker measures 294.8 KiB gzip against the 308 KiB limit.

Language subset 0.184 adds rank 456's shared `ISOdatetime()`/`ISOdate()` numeric calendar
construction, deterministic empty-zone handling, component validation, recycling, and fractional
seconds without raising the ceiling. The first production Worker measures 294.9 KiB gzip against the
308 KiB limit.

Language subset 0.185 adds rank 457's `graphics::persp()` S3-first matrix path, homogeneous view
transform, projected default wireframe/box output, and bounded graphics accounting without raising
the ceiling. The first production Worker measures 297.2 KiB gzip against the 308 KiB limit.

Language subset 0.186 adds rank 458's `graphics::points()` S3-first coordinate path, resolved point
protocol/display-list command, plotting-symbol and style recycling, missing-point omission, and
bounded graphics accounting without raising the ceiling. The first production Worker measures 298.7
KiB gzip against the 308 KiB limit.

Language subset 0.187 adds rank 459's `graphics::polygon()` closed-path protocol/display-list
command, missing-coordinate polygon splitting, recycled fill/border styles, Canvas fill rules, and
bounded graphics accounting without raising the ceiling. The first production Worker measures 299.7
KiB gzip against the 308 KiB limit.

Language subset 0.188 adds rank 460's `base::replace()` wrapper over the existing immutable subset
replacement engine, including `NULL` target materialization and no parallel replacement algorithm.
The first production Worker measures 299.9 KiB gzip against the 308 KiB limit.

Language subset 0.189 adds rank 461's `stats::rlnorm()` adapter over the session-owned Inversion
normal stream, vectorized log-scale validation, point-mass short-circuits, and bounded output
without a second random engine. The first production Worker measures 300.2 KiB gzip against the 308
KiB limit.

Language subset 0.190 adds rank 462's `base::tapply()` grouping, factor-level result arrays,
callback dispatch, and the list-array extraction path required by zoo. The first production Worker
measures 300.9 KiB gzip against the 308 KiB limit.

Language subset 0.191 adds rank 463's `graphics::text()` S3-first coordinate path, resolved
host-neutral text protocol/display-list command, style recycling, missing-label omission, and Canvas
rendering. The first production Worker measures 302.3 KiB gzip against the unchanged 308 KiB limit.

Language subset 0.192 adds rank 464's `stats::update()` S3 extension seam by reusing the evaluator's
existing lazy method-dispatch machinery. No package method or second call-rewriting engine is
embedded; the built-in stored-call default remains explicit future work. The measured Worker size is
302.4 KiB gzip against the unchanged 308 KiB limit.

Language subset 0.193 adds rank 465's `graphics::matplot()` matrix-series adapter, log-coordinate
resolution, and style/column cycling while reusing existing page, window, box, segment, and point
events. The measured Worker size is 304.0 KiB gzip against the unchanged 308 KiB limit.

Language subset 0.194 adds rank 470's `base::aperm()`/`aperm.default()` array-axis permutation and
S3 extension seam. The column-major reorder reuses owned vector subsetting and dimension metadata
without another execution backend. The measured Worker size is 304.7 KiB gzip against the unchanged
308 KiB limit.

Language subset 0.195 adds rank 471's `base::dget()` path with `dput()`, `tempfile()`, and
`unlink()` over an evaluator-owned browser-memory text map. Reconstruction reuses the existing
parser and evaluator, while stored UTF-8 text shares the configured output-size ceiling. The
measured Worker size is 306.1 KiB gzip against the unchanged 308 KiB limit.

Language subset 0.196 adds usage-ranked `save()`/`load()` workspace round-trips and the first
source-only R package bundle loader. Package DESCRIPTION, NAMESPACE, source-file count, and total
source text are validated before parsing; dependency loading and evaluation continue to use the
existing call, step, allocation, and output budgets. This executable package namespace/import/S3
vertical slice raises the Worker ceiling narrowly to 312 KiB; the measured Worker is 310.8 KiB gzip.

Language subset 0.197 adds measured rank 22's `base::plot()` S3 extension point and
`graphics::plot.default()` numeric browser path. It reuses existing page, window, box, segment,
point, text, Worker, Canvas, and display-list machinery; the only evaluator change lets a generic
probe class methods without prematurely selecting its default. The measured Worker is 312.1 KiB
gzip, so the ceiling rises narrowly to 314 KiB.

Language subset 0.199 retains DESCRIPTION, NAMESPACE, and ordered R source beside immutable package
resources, adds bounded `readLines()`/`writeLines()` text paths, and implements cooperative
`Sys.sleep()` timer slices. UTF-8 and base64 use standard browser primitives after size review; the
measured Worker is 315.1 KiB gzip, so the ceiling rises narrowly to 316 KiB. Client and parser-Wasm
budgets remain unchanged.

Language subset 0.200 adds one evaluator-owned virtual file/connection state machine and routes
existing line I/O, `cat()`, and `capture.output()` through it. The implementation adds no
dependency, host filesystem adapter, network path, or execution backend. The measured Worker is
317.7 KiB gzip, so the ceiling rises narrowly to 318 KiB. Client and parser-Wasm budgets remain
unchanged.

Language subset 0.201 adds package-data enumeration/execution plus one bounded delimited-table
scanner/writer shared by `data()`, the `read.table`/CSV/delimited family, and the matching writers.
It reuses owned vectors, data frames, type conversion, virtual files, and connections without a host
CSV dependency or another execution backend. The measured Worker is 323.3 KiB gzip, so the ceiling
rises to 324 KiB. Client and parser-Wasm budgets remain unchanged.

Language subset 0.202 adds one evaluator-owned directory index, current-directory state, and shared
relative-path normalization for the existing text, table, serialization, package-resource, and
connection seams. It adds no dependency or host filesystem capability. The measured Worker is 326.0
KiB gzip, so the ceiling rises narrowly to 328 KiB. Client and parser-Wasm budgets remain unchanged.

Language subset 0.203 adds one independently implemented GNU R XDR v2/v3 reader/writer shared by raw
serialization, RDS, workspaces, package data, and namespace sysdata. Gzip uses browser-standard
streams and no new dependency or host capability. The measured Worker is 331.4 KiB gzip, so the
ceiling rises narrowly to 333 KiB. Client and parser-Wasm budgets remain unchanged.

Language subset 0.204 adds reusable pure-R metaprogramming and wrapper foundations, including
call-rooted replacement, builtin formal metadata, dynamic caller frames, hooks, and common
session-local `graphics::par()` state. It introduces no dependency, network path, or execution
backend. The measured Worker is 333.7 KiB gzip, so the ceiling rises by 1 KiB to 334 KiB. Client and
parser-Wasm budgets remain unchanged.

Language subset 0.205 adds the usage-ranked single-browser-device lifecycle through `dev.cur()`,
`dev.list()`, `dev.off()`, and `graphics.off()`. Closing flushes held journal commands and resets
device-local graphical parameters without adding a device library or host adapter. The measured
Worker is 334.1 KiB gzip, so the ceiling rises narrowly to 335 KiB. Client and parser-Wasm budgets
remain unchanged.

Language subset 0.206 adds `system.time()` and `proc.time()` over the browser monotonic clock,
including lazy expression timing, `proc_time` metadata, scalar control validation, and bounded
timed-error output. It adds no dependency or host process adapter. The measured Worker is 334.6 KiB
gzip and remains within the existing 335 KiB ceiling; client and parser-Wasm budgets are unchanged.

Language subset 0.207 adds the usage-ranked PNG file-device path: a numbered device registry,
DOM-free rasterizer for the owned graphics command vocabulary, PNG chunk/checksum encoder,
browser-standard DEFLATE with a stored-block fallback, multi-page filenames, and raw virtual-file
reads. This adds no dependency or host renderer. The measured Worker is 340.4 KiB gzip, so the
ceiling rises narrowly to 341 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.208 adds exact byte storage and canonical encoding marks to character vectors,
plus `Encoding`, `Encoding<-`, `enc2utf8`, and `enc2native` over the same representation. It adds no
dependency, host locale lookup, or external codec. The measured Worker is 341.8 KiB gzip, so the
ceiling rises narrowly to 343 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.209 adds `dcauchy`, `pcauchy`, `qcauchy`, and the usage-ranked `rcauchy` over
owned vector semantics, stable numeric tail identities, and the evaluator's existing uniform random
stream. It adds no dependency, host entropy, native numeric library, or second random engine. The
measured Worker is 342.7 KiB gzip and remains within the 343 KiB ceiling; client and parser-Wasm
budgets are unchanged.

Language subset 0.210 adds session-owned environment-variable state, Worker initialization and reset
transport, GNU R-shaped `Sys.getenv`, `Sys.setenv`, and `Sys.unsetenv`, plus the
`duplicated(..., fromLast = TRUE)` character seam required by unchanged `withr::with_envvar()`. It
adds no dependency and never reads a host process environment. The measured Worker is 343.7 KiB
gzip, so the ceiling rises narrowly to 345 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.211 adds usage-ranked `graphics::image`/`image.default` over the existing owned
graphics journal. Regular grids reuse one transferable raster command and irregular grids reuse
polygon commands; S3 dispatch and all matrix/colour mapping remain inside the existing runtime
layers. It adds no dependency, Canvas import, or package-specific adapter. The measured Worker is
345.8 KiB gzip, so the ceiling rises narrowly to 347 KiB; client and parser-Wasm budgets remain
unchanged.

Language subset 0.212 adds usage-ranked `utils::browseURL`, a bounded URL/file request journal, lazy
R-function callback forwarding, final-result Worker transport, and public `onBrowse`/
`browseRequests` surfaces. It adds no dependency, network client, DOM import, or automatic opener;
virtual files reuse the existing byte store and cross as transferables. The measured Worker is 346.8
KiB gzip and remains within the existing 347 KiB ceiling; client and parser-Wasm budgets are
unchanged.

Language subset 0.213 adds usage-ranked `base::gc`, adjacent `gcinfo`, and one dependency-free
reachable-graph census shared with `system.time(gcFirst = TRUE)`. The traversal counts only owned R
runtime objects and payload storage, uses cycle guards, and imports no host heap profiler or GC
adapter. The measured Worker is 348.3 KiB gzip, so the ceiling rises narrowly to 349 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.214 adds usage-ranked `graphics::lines`/`lines.default` without a new event type,
renderer, dependency, or package adapter. Generic/default dispatch and coordinate normalization stay
inside existing runtime/base layers; all geometry reuses the bounded segment and point journal
already transported to Worker, Canvas, and PNG consumers. The measured Worker is 348.6 KiB gzip
within the existing 349 KiB ceiling; client and parser-Wasm budgets remain unchanged.

Language subset 0.215 adds usage-ranked `base::system` as an explicit typed host capability. Inline
execution invokes only an application-supplied handler; Worker execution adds one correlated
request/result exchange whose response bypasses the serialized evaluation queue. No process,
filesystem, network, or shell dependency enters the browser bundle. The measured Worker is 350.1 KiB
gzip, so the ceiling rises narrowly to 351 KiB; client and parser-Wasm budgets remain unchanged.

The usage-ranked time-interval increment adds one shared constructor, deterministic character-format
parser, automatic unit selection, and expanded `difftime` recycling/metadata behavior without a
timezone database or host dependency. The measured Worker is 351.8 KiB gzip, so the ceiling rises
narrowly to 353 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.217 adds usage-ranked `ls`/`objects` and lazily materialized supported-export
views of the search list. Enumeration copies binding references but never forces promises, adds no
dependency or host capability, and invalidates its small environment cache only when a package is
attached or the session resets. The measured Worker is 352.7 KiB gzip within the existing 353 KiB
ceiling; client and parser-Wasm budgets remain unchanged.

Language subset 0.218 adds usage-ranked `graphics::hist`/`hist.default`, `plot.histogram`, and the
three class-count helpers without adding a dependency, renderer, package adapter, or protocol event.
Break calculation, counting, S3 dispatch, and returned R objects stay in the shared runtime; bars
reuse the existing bounded polygon journal across Worker, Canvas, recording, and PNG paths. The
measured Worker is 356.0 KiB gzip, so the ceiling rises narrowly to 357 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.219 adds usage-ranked `methods::showClass` by extending the existing session-local
S4 registry with namespace ownership plus recursive parent/slot inspection. Formatting and output
capture reuse owned strings and the bounded journal; there is no reflection dependency, host
adapter, protocol event, or package-specific implementation. The measured Worker is 356.9 KiB gzip
within the existing 357 KiB ceiling; client and parser-Wasm budgets remain unchanged.

Language subset 0.220 adds usage-ranked `utils::packageVersion`, adjacent `getRversion`, the shared
numeric-version object/parser, and both explicit-call and infix comparison paths. Installed package
metadata is read through the existing immutable bundle facade without loading a namespace; no
dependency, protocol event, host library search, or second execution backend is added. The measured
Worker is 358.7 KiB gzip, so the ceiling rises narrowly to 359 KiB; client and parser-Wasm budgets
remain unchanged.

Language subset 0.221 adds usage-ranked `Sys.getpid` plus one positive session-identity field shared
by inline and Worker initialization. The evaluator retains the integer outside resettable builtin
state, and the optional protocol-v1 field preserves compatibility with older clients without adding
a host process probe, dependency, event, or adapter. The measured Worker is 358.9 KiB gzip within
the existing 359 KiB ceiling; client and parser-Wasm budgets remain unchanged.

Language subset 0.222 adds usage-ranked `.libPaths`, two locked virtual-library roots, resettable
evaluator search state, virtual directory normalization/globbing, and shared discovery filtering for
package loading, namespace operators, metadata, resources, and explicit `lib.loc`. It reuses the
existing package registry and browser filesystem without a dependency, protocol event, host scan, or
network adapter. The measured Worker is 359.9 KiB gzip, so the ceiling rises narrowly to 360 KiB;
client and parser-Wasm budgets remain unchanged.

Language subset 0.223 adds usage-ranked `utils::example` plus one compact, versioned package-example
manifest. Rd extraction remains in the Node-only packager; the Worker adds only manifest validation,
virtual-library discovery, skipped-block preparation, and normalized-AST execution over existing
package/resource/evaluator paths. The measured Worker is 361.4 KiB gzip, so the ceiling rises
narrowly to 362 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.224 adds usage-ranked `base::gzcon` over the existing evaluator-owned connection
and byte-store seams. Generic gzip helpers are shared with serialization and use only browser
`CompressionStream`/`DecompressionStream`; the Worker adds bounded wrapper state, validation,
text/raw cursor handling, and close-time emission without a dependency, protocol event, network
transport, or package-specific adapter. The measured Worker is 362.5 KiB gzip, so the ceiling rises
narrowly to 363 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.228 adds usage-ranked `base::file.info` and its `file.mode`, `file.mtime`, and
`file.size` projections over the existing owned virtual filesystem. The implementation shares file,
directory, package-resource, and timestamp state without a host-filesystem adapter or dependency.
The measured Worker is 364.8 KiB gzip, so the ceiling rises narrowly to 365 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.229 adds usage-ranked `grDevices::hcl` through a compact polar CIE-LUV/D65-to-
sRGB conversion shared by direct, source-only package, and Worker calls. It adds no dependency,
Canvas/CSS path, color-profile adapter, protocol event, or package-specific implementation. The
measured Worker is 365.7 KiB gzip, so the ceiling rises narrowly to 366 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.230 adds usage-ranked `graphics::axis` over the existing owned linear-window,
segment, text, graphics-parameter, journal, Worker, Canvas, PNG, and record/replay paths. It adds no
dependency, protocol event, host font/layout service, or package-specific implementation. The
measured Worker is 367.6 KiB gzip, so the ceiling rises narrowly to 368 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.231 adds usage-ranked `base::source` and input `textConnection` over the existing
normalized parser, evaluator environments, virtual text store, package resources, and output
journal. It adds no dependency, protocol event, network/host-filesystem adapter, generated
JavaScript, or package-specific implementation. The measured Worker is 369.1 KiB gzip, so the
ceiling rises narrowly to 370 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.233 adds usage-ranked `base::url` as a lazy read-only connection over the existing
session byte store and I/O consumers. A small correlated Worker protocol carries data-only
URL/method/header requests and copied byte results only when the embedding host supplies a handler;
there is no fetch dependency, ambient network authority, or package-specific adapter. The measured
Worker is 370.1 KiB gzip, so the ceiling rises narrowly to 371 KiB; client and parser-Wasm budgets
remain unchanged.

Language subset 0.234 adds usage-ranked `stats::filter` through checkpointed loops over the existing
owned double-vector and regular-time-series representations. Convolution and recursive modes share
the same implementation across direct, pure-R package, and Worker calls without a dependency,
protocol event, host adapter, or package-specific translation. The measured Worker is 371.1 KiB
gzip, so the ceiling rises narrowly to 372 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.235 adds usage-ranked `utils::packageDescription` by retaining the already parsed
DESCRIPTION field table in each immutable package definition and projecting it into ordinary owned
lists on demand. It adds no dependency, protocol event, host adapter, filesystem scan, namespace
load, or package-specific translation. The measured Worker is 371.8 KiB gzip within the existing 372
KiB ceiling; client and parser-Wasm budgets remain unchanged.

Language subset 0.236 adds usage-ranked `base::stdout` plus the adjacent standard-connection family
over the existing evaluator output journal and connection registry. Stable terminal handles, stderr
routing, TTY detection, connection catalogs, and lifecycle controls add no dependency, protocol
event, host stream, or package-specific translation. The measured Worker is 372.8 KiB gzip, so the
ceiling rises narrowly to 373 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.237 adds usage-ranked `grDevices::rainbow` plus `terrain.colors`, `topo.colors`,
and `cm.colors` through one compact HSV conversion and palette-sequence path shared by direct,
source-only package, and Worker calls. It adds no dependency, protocol event, Canvas/CSS path, color
profile, or package-specific translation. The measured Worker is 373.9 KiB gzip, so the ceiling
rises narrowly to 374 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.238 adds usage-ranked `graphics::rect` by projecting recycled rectangles into the
existing polygon journal. Inline, pure-R package, Worker, Canvas, PNG, and record/replay paths share
the same coordinate/color/style normalization without a dependency, new protocol event, host
adapter, or package-specific translation. The measured Worker is 374.5 KiB gzip, so the ceiling
rises narrowly to 375 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.239 adds usage-ranked `base::file.remove` over the existing virtual file,
directory, and connection registries. It adds no dependency, protocol event, filesystem adapter, or
package-specific translation: each path is resolved entirely inside the evaluator-owned tree and
only closed mutable session files can be deleted. The measured Worker is 374.8 KiB gzip within the
existing 375 KiB ceiling; client and parser-Wasm budgets remain unchanged.

Language subset 0.240 adds usage-ranked `base::readChar` over the existing virtual byte store and
file/URL/gzip connection registry. One bounded UTF-8 prefix validator provides character-count and
byte-count modes without a codec dependency, protocol event, filesystem adapter, or package-specific
translation. The measured Worker is 375.6 KiB gzip, so the ceiling rises narrowly to 376 KiB; client
and parser-Wasm budgets remain unchanged.

Language subset 0.241 adds usage-ranked `base::debug`/`undebug` plus `debugonce`/`isdebugged`
through weak function-object registries and the existing evaluator call/readline paths. It adds no
dependency, protocol event, DOM surface, generated-code path, or package-specific translation. The
measured Worker is 376.7 KiB gzip, so the ceiling rises narrowly to 377 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.242 adds usage-ranked `grDevices::pdf` as a direct serializer over the existing
bounded graphics journal and virtual byte store. The owned PDF object/xref builder and reuse of the
PNG zlib helper add no dependency, DOM surface, native library, protocol event, filesystem/network
adapter, generated-code path, or package-specific translation. Compressed/uncompressed content and
final document bytes remain subject to evaluator checkpoints and output limits. The measured Worker
is 381.9 KiB gzip, so the ceiling rises narrowly from 377 KiB to 382 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.243 adds usage-ranked `base::file.create` as a thin mutation over the existing
virtual path, directory, binary-file, metadata, and resource-accounting state. Validation and file
count preflight allocate only bounded path/result arrays; successful files reuse the zero-byte
binary writer. It adds no dependency, protocol event, filesystem/network adapter, generated-code
path, or package-specific translation. The measured Worker is 382.3 KiB gzip, so the ceiling rises
narrowly from 382 KiB to 383 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.244 adds usage-ranked `stats::ts.plot` by composing the existing regular-series
metadata validators, bounded numeric coercion, graphics window, segment/point geometry, annotations,
and device journal. Equal-frequency union allocates one preflighted rectangular grid and adds no
dependency, protocol event, DOM/device access, generated-code path, or package-specific translation.
The measured Worker is 383.8 KiB gzip, so the ceiling rises narrowly from 383 KiB to 384 KiB; client
and parser-Wasm budgets remain unchanged.

Language subset 0.245 adds usage-ranked `base::Sys.which` through a construction-time immutable
string map transported with the existing Worker initialization request. Lookup is linear only in the
requested vector and uses the evaluator-owned `Map`; it performs no PATH scan, filesystem call,
process launch, network request, or package-specific translation. The measured Worker is 384.2 KiB
gzip, so the ceiling rises narrowly from 384 KiB to 385 KiB; client and parser-Wasm budgets remain
unchanged.

Language subset 0.246 adds usage-ranked `utils::download.file` by composing the existing typed URL
request callback with the session-owned binary-file writer. Preflight allocates only bounded URL and
destination arrays; response copying and aggregate file storage reuse existing output accounting. It
adds no dependency, protocol event, ambient network/filesystem operation, generated-code path, or
package-specific translation. The measured Worker is 384.6 KiB gzip within the existing 385 KiB
ceiling; client and parser-Wasm budgets remain unchanged.

Language subset 0.247 adds usage-ranked `base::pipe` by composing the existing command callback with
the private connection store. Lazy reads copy bounded stdout once; open writes reuse the existing
file buffer and submit exact text on close. The path adds no dependency, protocol event, ambient
process/filesystem access, generated-code execution, or package-specific translation. The measured
Worker is 385.6 KiB gzip, so the ceiling rises narrowly from 385 KiB to 386 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.248 adds usage-ranked `base::unz` by composing one bounded ZIP central-directory
reader, stored/raw-DEFLATE member validation, CRC32, and the existing private connection byte store.
Package resources and downloaded session archives reuse ordinary line/raw/source/table/
serialization consumers; the path adds no dependency, protocol event, host filesystem, ambient
network operation, extracted path, generated-code execution, or package-specific translation. The
measured Worker is 388.1 KiB gzip, so the ceiling rises narrowly from 386 KiB to 389 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.249 adds usage-ranked `utils::object.size` through a bounded traversal of the
owned R value graph and independently defined 64-bit allocation buckets. It reuses normalized AST,
attribute, vector, and class metadata; it does not inspect the JavaScript heap, add a dependency or
protocol event, access the DOM/host, generate code, or translate package source. The measured Worker
is 389.7 KiB gzip, so the ceiling rises narrowly from 389 KiB to 390 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.250 adds usage-ranked `graphics::title` by normalizing annotations and current
device parameters into the existing bounded text display-list event. Canvas, PNG, PDF,
record/replay, inline callbacks, Worker transport, and source-only package calls reuse existing
paths; no dependency, protocol event, DOM/runtime network access, generated code, or package-source
translation is added. The measured Worker is 390.4 KiB gzip, so the ceiling rises narrowly from 390
KiB to 391 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.251 adds usage-ranked `base::sink` and `sink.number` by composing the existing
output router, bounded virtual targets, and private connection state. It adds no dependency,
protocol event, host descriptor, generated-code path, or package-specific translation. The measured
Worker is 391.5 KiB gzip, so the ceiling rises narrowly from 391 KiB to 392 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.252 adds usage-ranked `base::write` by composing the existing atomic formatter,
`cat` separator layout, bounded session-file writer, and private connection state. It adds no
dependency, protocol event, host filesystem access, generated-code path, or package-specific
translation. The measured Worker is 392.0 KiB gzip, so the ceiling rises narrowly from 392 KiB to
393 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.253 adds usage-ranked `utils::available.packages` and `contrib.url` through a
bounded DCF index parser, character-matrix builder, reusable filtering pipeline, session cache, and
the existing explicit URL callback. It performs no ambient fetch, filesystem scan, archive install,
generated-code execution, or package-specific translation. The measured Worker is 395.1 KiB gzip, so
the ceiling rises narrowly from 393 KiB to 396 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.254 adds usage-ranked `graphics::barplot` and `barplot.default` by composing the
existing S3 dispatcher, matrix/value model, graphics state, polygon/axis/text/legend journal, Worker
protocol, and browser/file renderers. It adds no dependency, ambient network or filesystem access,
generated-code path, package-specific translation, or new graphics command kind. The measured Worker
is 398.5 KiB gzip, so the ceiling rises narrowly from 396 KiB to 399 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.255 adds usage-ranked `grDevices::devAskNewPage` as one boolean on each existing
graphics-device record plus a conditional call through the existing explicit `readline` bridge. It
adds no dependency, protocol event, ambient terminal/UI authority, package-specific translation, or
graphics command kind. Non-interactive and file-device paths remain synchronous; the interactive
browser path performs exactly one bounded host round trip per later page when enabled. The measured
Worker is 398.9 KiB gzip, so the 399 KiB ceiling remains unchanged; client and parser-Wasm budgets
also remain unchanged.

Language subset 0.256 adds usage-ranked `base::getLoadedDLLs` as an allocation-accounted empty
classed list plus ordinary list/vapply composition. It adds no dependency, host enumeration,
filesystem access, pointer value, protocol event, or package-specific translation. The empty
browser-native result is constant-size; populated native-module records remain outside this
increment. The measured Worker is 399.0 KiB gzip (408,591 bytes), 15 bytes above the previous 399
KiB byte ceiling, so the ceiling rises narrowly to 400 KiB; client and parser-Wasm budgets remain
unchanged.

Language subset 0.257 adds usage-ranked `base::socketConnection`, `isIncomplete`, and
`socketTimeout` by composing the existing connection registry with one typed, construction-time
duplex host capability. Open/read/write/timeout/close operations cross inline or Worker execution as
bounded data-only records; the default remains network-free and fails closed. The measured Worker is
400.4 KiB gzip (410,003 bytes), so the ceiling rises narrowly from 400 KiB to 401 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.258 adds usage-ranked `base::file.copy` by composing the existing owned path,
directory, metadata, and exact-byte stores. It adds no dependency, protocol event, host filesystem,
package-specific translation, or second file backend; immutable package resources and mutable
session paths use the same bounded copy path inline and in the Worker. The measured Worker is 401.6
KiB gzip (411,265 bytes), so the ceiling rises narrowly from 401 KiB to 402 KiB; client and parser-
Wasm budgets remain unchanged.
