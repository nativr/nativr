# Performance and bundle discipline

The JavaScript reference backend uses typed arrays and tight loops. It is a correctness baseline,
not a final optimized kernel. `pnpm benchmark` measures short parse/evaluation, scalar arithmetic,
100,000-element mean, typed assignment, and raw snapshots after a build.

Budgets:

- statically loaded public client: 150 KiB gzip;
- Worker JavaScript: 734 KiB gzip;
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

## Profile 0.519 bulk sequence and RNG state publication

The prior RNG hot path rebuilt and assigned the full `.Random.seed` vector after every generated
scalar. Bulk `runif` and `rnorm` now defer that publication until the vector is complete, preserving
the exact stream and externally visible final seed. Resource polling is bounded to every 4,096
elements for these bulk kernels and `:`, so cancellation and elapsed-time enforcement remain
cooperative without millions of redundant clock reads. On the local Windows/Node 24 package-test
run, the unchanged rbenchmark check including its deliberately heavy installed example completes in
about one minute instead of failing the execution-step guard or running indefinitely.

Profile 0.342 adds POSIXlt S3 extraction, balanced-state normalization, and C-locale month parsing.
The production Worker measures 530,400 bytes gzip, 582 bytes above Profile 0.341 and 32 bytes below
the existing 518 KiB ceiling. The budget therefore remains 518 KiB. The 150 KiB public-client and
1.5 MiB combined-parser-Wasm ceilings are unchanged.

Profile 0.343 adds memoized external LazyData bindings, linear canonical-base64 validation,
transport-byte accounting, and dense factor contrasts. A clean production build measures the Worker
at 532,132 bytes gzip, 1,732 bytes above Profile 0.342. This exceeds both the former 518 KiB ceiling
and a 519 KiB ceiling, so the explicit budget rises by the minimum whole-KiB increment to 520 KiB,
leaving 348 bytes of measured headroom. Build-time xz normalization is confined to package-tools and
does not enter the Worker. The 150 KiB public-client and 1.5 MiB combined-parser-Wasm ceilings are
unchanged.

Profile 0.344 removes the character-to-symbol promotion branch from generic language reconstruction
and adds no dependency or execution backend. A clean production build measures the Worker at 532,096
bytes gzip, 36 bytes below Profile 0.343 and below the unchanged 520 KiB ceiling, leaving 384 bytes
of measured headroom. The 150 KiB public-client and 1.5 MiB combined-parser-Wasm ceilings remain
unchanged.

Profile 0.345 adds only package-corpus/test evidence and updates the fixed-width compatibility
profile string; it adds no runtime path or dependency. A clean production build measures the Worker
at 532,097 bytes gzip, one byte above Profile 0.344 and below the unchanged 520 KiB ceiling, leaving
383 bytes of measured headroom. The 150 KiB public-client and 1.5 MiB combined-parser-Wasm ceilings
remain unchanged.

Profile 0.346 adds browser device creation, arrow drawing, physical aspect-ratio window expansion,
axis-style and polygon controls, and `NULL`-omitting matrix binding. A clean production build
measures the Worker at 533,905 bytes gzip, 1,808 bytes above Profile 0.345. This exceeds both the
former 520 KiB ceiling and a 521 KiB ceiling, so the explicit budget rises by the minimum whole-KiB
increment to 522 KiB, leaving 623 bytes of headroom. The implementation adds no dependency, host
capability, network path, or execution backend. The 150 KiB public-client and 1.5 MiB combined
parser-Wasm ceilings remain unchanged.

Profile 0.347 adds indexed `sort.default` output and corrects a build-time vignette check field; the
package-tools correction does not enter the Worker. A clean production build measures the Worker at
534,125 bytes gzip, 220 bytes above Profile 0.346 and below the unchanged 522 KiB ceiling, leaving
403 bytes of headroom. The implementation adds no dependency, host capability, network path, or
execution backend. The 150 KiB public-client and 1.5 MiB combined parser-Wasm ceilings remain
unchanged.

Profile 0.348 corrects exact-shadowed partial argument matching and adds reusable Pearson
data-frame/matrix covariance and correlation. A clean production build measures the Worker at
535,017 bytes gzip, 892 bytes above Profile 0.347 and 489 bytes above the former 522 KiB ceiling.
The explicit budget therefore rises by the minimum whole-KiB increment to 523 KiB, leaving 535 bytes
of headroom. The implementation adds no dependency, host capability, network path, or execution
backend. The 150 KiB public-client and 1.5 MiB combined parser-Wasm ceilings remain unchanged.

Profile 0.349 adds finite distance calculation, hierarchical linkage updates, recursive dendrogram
conversion/order, and array-coordinate `which`. A clean production build measures the Worker at
538,278 bytes gzip, 3,261 bytes above Profile 0.348 and 2,726 bytes above the former 523 KiB
ceiling. The explicit budget therefore rises by the minimum whole-KiB increment to 526 KiB, leaving
346 bytes of headroom. The implementation adds no dependency, host capability, network path, or
execution backend. The 150 KiB public-client and 1.5 MiB combined parser-Wasm ceilings remain
unchanged.

Profile 0.350 adds user-coordinate symbol geometry and multi-key ordering. A clean production build
measures the Worker at 539,850 bytes gzip, 1,572 bytes above Profile 0.349 and 1,226 bytes above the
former 526 KiB ceiling. A 527 KiB ceiling would still be 202 bytes too small, so the explicit budget
rises by the minimum sufficient whole-KiB increment to 528 KiB, leaving 822 bytes of headroom. The
implementation adds no dependency, host capability, network path, or execution backend. The 150 KiB
public-client and 1.5 MiB combined parser-Wasm ceilings remain unchanged.

Profile 0.351 adds validated merge-tree cutting and stats namespace exposure. A clean production
build measures the Worker at 540,871 bytes gzip, 1,021 bytes above Profile 0.350 and 199 bytes above
the former 528 KiB ceiling. The explicit budget therefore rises by the minimum whole-KiB increment
to 529 KiB, leaving 825 bytes of headroom. The implementation adds no dependency, host capability,
network path, or execution backend. The 150 KiB public-client and 1.5 MiB combined parser-Wasm
ceilings remain unchanged.

Profile 0.352 adds the 150,821-byte (61,530-byte gzip) source-reproducible LAPACK 3.12.1 `DSYEVR`
Wasm closure plus fractional-sequence semantics. A clean production build measures the Worker at
623,926 bytes gzip, 83,055 bytes above Profile 0.351 and above the former 529 KiB ceiling. The
explicit budget therefore rises by the minimum sufficient whole-KiB increment to 610 KiB, leaving
714 bytes of headroom. The Wasm module has one memory-growth import and no filesystem, network,
process, or package-native ABI. The 150 KiB public-client and 1.5 MiB combined parser-Wasm ceilings
remain unchanged.

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

Language subset 0.259 adds usage-ranked `base::find.package` by composing existing library paths,
registered core namespaces, admitted pure-R package descriptions, and owned directory enumeration.
It adds no dependency, protocol event, host filesystem scan, GNU R installation path, or package-
specific translation. The measured Worker is 402.5 KiB gzip (412,110 bytes), so the ceiling rises
narrowly from 402 KiB to 403 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.260 adds usage-ranked `base::l10n_info` as four ordinary owned R values. It adds
no dependency, protocol event, host locale/codepage probe, `Intl` call, codec, or package-specific
translation; inline and Worker sessions share the same non-Windows UTF-8 browser profile. The
measured Worker is 402.6 KiB gzip (412,213 bytes), within the existing 403 KiB ceiling, so all
budgets remain unchanged.

Language subset 0.261 adds usage-ranked `base::shQuote` as bounded in-memory character transforms
for documented Unix `sh`/`csh` and Windows `cmd`/`cmd2` modes. It adds no dependency, protocol
event, process launch, host-shell probe, or package-specific translation; coercion and registered S3
methods remain inside the evaluator. The measured Worker is 403.1 KiB gzip (412,820 bytes), so the
ceiling rises narrowly from 403 KiB to 404 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.262 adds usage-ranked `base::system2` by reusing the existing explicit
host-command request/result suspension path. The added fields preserve executable, arguments,
environment, stdin and stdout/stderr redirection intent across inline and Worker execution; NativR
still contains no process launcher or shell. The measured Worker is 404.2 KiB gzip (413,860 bytes),
164 bytes above the previous 404 KiB ceiling, so the ceiling rises narrowly to 405 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.263 adds usage-ranked `base::.Call` through declarative native-module metadata and
one typed request/result suspension path shared by inline and Worker sessions. It reuses the
existing public R snapshot representation and adds no dynamic loader, JavaScript code generation,
host pointer, or native dependency. The measured Worker is 405.0 KiB gzip (414,709 bytes), 11 bytes
below the existing 405 KiB ceiling, so all budgets remain unchanged.

Language subset 0.264 adds usage-ranked `utils::aspell` by composing existing virtual text reads,
R-callable invocation, structured `systemCommand` transport, and ordinary data-frame values. It adds
no dependency, protocol event, dictionary, process launcher, host PATH scan, or package-specific
translation. The measured Worker is 406.4 KiB gzip (416,123 bytes), so the ceiling rises narrowly
from 405 KiB to 407 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.265 adds usage-ranked `graphics::abline` by projecting coefficient/model and
horizontal/vertical line forms into the existing `segments` display-list event. It adds no
dependency, protocol event, renderer, package-specific translation, or host capability; inline,
Worker, Canvas, PNG, PDF, and record/replay paths reuse the same journal. The measured Worker is
407.4 KiB gzip (417,200 bytes), so the ceiling rises narrowly from 407 KiB to 408 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.266 adds usage-ranked `utils::browseVignettes` and its S3 print method by
composing the existing package vignette manifest, immutable package resources, session text-file
store, and `browseURL` event. It adds no dependency, protocol type, network client, document
builder, host path, DOM access, or package-specific adapter. The measured Worker is 408.9 KiB gzip
(418,665 bytes), so the ceiling rises narrowly from 408 KiB to 409 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.267 adds usage-ranked `grDevices::dev.control` by splitting per-device replay
recording state from the existing output page journal. It adds no dependency, protocol event,
renderer, host capability, or package-specific adapter; browser, PNG, PDF, and same-session replay
reuse the existing command values. The measured Worker is 409.2 KiB gzip (419,046 bytes), so the
ceiling rises narrowly from 409 KiB to 410 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.268 adds usage-ranked `utils::getFromNamespace` through the existing package
registry and isolated namespace maps. It adds no dependency, protocol event, package payload,
network/host capability, or package-specific adapter; exact lookup reuses already-owned bindings and
forces only the selected promise. The measured Worker is 409.6 KiB gzip (419,476 bytes), remaining
inside the 410 KiB ceiling, so no budget changes.

Language subset 0.269 adds usage-ranked `utils::help` plus generic build-time help manifests for
every source-package `man/*.Rd` page. Runtime discovery composes the existing installed-package and
namespace registries; text output reuses the console journal and escaped script-free HTML reuses the
session-file/`browseURL` path. It adds no dependency, protocol event, runtime Rd parser, GNU help
database, network/host capability, or package-specific adapter. The measured Worker is 411.7 KiB
gzip (421,565 bytes), 1,725 bytes above the previous 410 KiB ceiling, so the ceiling rises narrowly
to 412 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.270 adds usage-ranked `graphics::curve` plus shared positive-coordinate
logarithmic transforms in `plot.default`. Function/expression evaluation composes the existing
normalized-AST, promise/environment, numeric-vector, `plot`, and `lines` paths; rendering reuses the
same journal, Worker protocol, Canvas/PNG/PDF consumers, and package loader. It adds no dependency,
protocol event, renderer, host capability, generated JavaScript, or package-specific adapter. The
measured Worker is 413.1 KiB gzip (423,045 bytes), 1,157 bytes above the previous 412 KiB ceiling,
so the ceiling rises narrowly to 414 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.271 adds usage-ranked `methods::signature` and reusable multi-argument S4 method
selection. Registration and dispatch remain evaluator-session maps over owned character signatures;
they add no dependency, protocol event, package-specific rewrite, native payload, network access, or
generated JavaScript. The measured Worker is 413.7 KiB gzip (423,613 bytes), within the existing 414
KiB ceiling, so all budgets remain unchanged. The Node benchmark now embeds the built Wasm assets as
data URLs and raises only its local step allowance, making the same benchmark portable on Windows
without changing runtime defaults. This run measured 0.06 ms/op scalar parse/evaluation, 1.74 ms/op
for a 100,000-element mean, 0.46 ms/op typed-array assignment, and 1.12 ms/op raw snapshotting on
the current development machine.

Language subset 0.272 adds reusable pure-R package foundations: installed-package precedence over
non-core shims, namespace-qualified S3 registration, environment/closure attributes, environment and
binding locks, GNU R empty-`NULL` operator/application behavior, and `.subset`/`.subset2`. These
remain owned evaluator/value operations with no dependency, protocol event, native payload, network
access, generated JavaScript, or package-specific source rewrite. After consolidating static
namespace ownership checks, the measured Worker is 415.1 KiB gzip (425,096 bytes), 1,160 bytes above
the previous 414 KiB ceiling, so the ceiling rises narrowly to 416 KiB; client and parser-Wasm
budgets remain unchanged. The unchanged R6 2.6.1 external proof is opt-in and contributes no package
source or evaluation-time network payload to the bundle.

Language subset 0.273 adds function-backed active bindings to the shared environment model. Reads
and writes reuse the evaluator's ordinary callable path, including nested replacement, locks, and
the async JavaScript assignment API; there is no R6 adapter, dependency, protocol event, native
payload, network access, or generated JavaScript. The unchanged R6 2.6.1 proof remains opt-in and
ships no package source. The measured Worker is 415.4 KiB gzip (425,381 bytes), within the existing
416 KiB ceiling, so all budgets remain unchanged.

Language subset 0.274 adds generic `mget`, the first-class `[[` primitive, and GNU R-compatible
outer result names for `mapply`/`Map`. The unchanged R6 clone paths compose those existing
environment, promise, active-binding, callable, and extraction mechanisms; there is no package
adapter, dependency, protocol event, native payload, network access, or generated JavaScript. The
measured Worker is 416.1 KiB gzip (426,078 bytes), 94 bytes above the previous 416 KiB ceiling, so
the Worker ceiling rises narrowly to 417 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.275 adds GNU R-compatible `NULL` extraction, index forcing, and replacement
promotion across the shared evaluator/subsetting paths. The unchanged R6 inheritance proof composes
those operations with existing environments, closures, active bindings, and package-owned methods;
there is no R6 adapter, dependency, protocol event, native payload, evaluation-time network access,
or generated JavaScript. The measured Worker is 416.3 KiB gzip (426,286 bytes), within the existing
417 KiB ceiling, so all budgets remain unchanged.

Language subset 0.276 adds reusable binary-arithmetic attribute propagation and standalone
`grDevices::colorRamp` with precomputed, banded not-a-knot/FMM spline coefficients and logarithmic
anchor lookup. Unchanged viridisLite 0.4.3 remains opt-in and contributes no package source or map
data to the browser bundle. The measured Worker is 417.7 KiB gzip (427,754 bytes), 746 bytes above
the previous 417 KiB ceiling, so the Worker ceiling rises narrowly to 418 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.277 adds reusable `data.frame()` trailing-control matching, explicit row-name
validation/coercion, and default syntactic/unique column-name repair. Unchanged RColorBrewer 1.1-3
remains opt-in and contributes no package source or palette tables to the browser bundle. The
measured Worker is 418.1 KiB gzip (428,126 bytes), 94 bytes above the previous 418 KiB ceiling, so
the Worker ceiling rises narrowly to 419 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.280 adds reusable pure-R package installation foundations: the standard `tools`
namespace dependency, scoped immutable `tools/**` source resources, quoted assignment names,
automatic `read.table` headers, data-frame row binding, deterministic `.Platform`, `asNamespace`,
`sys.function`, primitive S3 registration, and bounded ASCII byte-pattern substitution. Unchanged
assertthat 0.2.1 and crayon 1.5.3 remain opt-in and contribute no package source or resource bytes
to the shipped Worker. The measured Worker is 420.1 KiB gzip (430,189 bytes), 1,133 bytes above the
previous 419 KiB ceiling, so the ceiling rises narrowly to 421 KiB; client and parser-Wasm budgets
remain unchanged.

Language subset 0.281 adds generic PCRE capture-location metadata, quoted call-tag normalization,
NULL/recursive `paste` coercion, atomic/recursive substitution coercion, and a numeric D65
`grDevices::convertColor` slice. The Node-only package tool additionally normalizes bzip2 package
resources without adding a decompressor or package payload to the browser. Unchanged `praise 1.0.0`
and `prettyunits 1.2.0` remain opt-in and ship no package source. After consolidating capture-matrix
construction, the measured Worker is 421.1 KiB gzip (431,230 bytes), 126 bytes above the previous
421 KiB ceiling, so the ceiling rises narrowly to 422 KiB; client and parser-Wasm budgets remain
unchanged.

Language subset 0.282 adds generic `match.fun` resolution, exact `identity`/condition/source-file
formals and shapes, shared post-ellipsis argument matching, and recursive/expression data-frame
column replacement. The evaluate and numDeriv packages remain opt-in test inputs and contribute no
source or resources to the shipped Worker. The measured Worker is 422.1 KiB gzip (432,275 bytes),
147 bytes above the previous 422 KiB ceiling, so the ceiling rises narrowly to 423 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.283 adds generic specific/`Ops` S3 operator dispatch, incremental package-method
registration, numbered ellipsis identifiers, missing-endpoint sequences, `sign`, dimension-name
replacement, quoting, data-frame coercion controls, and recursive missingness. The abind and
rprojroot packages remain opt-in test inputs and contribute no source or resources to the shipped
Worker. The measured Worker is 423.4 KiB gzip (433,521 bytes), 369 bytes above the previous 423 KiB
ceiling, so the ceiling rises narrowly to 424 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.284 adds generic S4 method-export metadata, correct `utils` namespace ownership
for `head`/`tail`, and session-owned `utils::globalVariables` declarations. The rstudioapi and
inline packages remain opt-in test inputs and contribute no source or resources to the shipped
Worker. The measured Worker is 423.8 KiB gzip (433,929 bytes), within the existing 424 KiB ceiling;
all budgets remain unchanged.

Language subset 0.285 adds generic row/column dimension and name replacement, bounded GNU R regex
normalization/replacement/splitting, standard apply-family argument matching, factor-label
comparison, atomic-to-list replacement promotion, `Sys.which()` language coercion, and
`help(verbose=)` validation. The rematch and whisker packages remain opt-in test inputs and
contribute no source or resources to the shipped Worker. The measured Worker is 425.1 KiB gzip
(435,284 bytes), 1,108 bytes above the previous 424 KiB ceiling, so the ceiling rises narrowly to
426 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.286 adds constructed assignment calls, promise-origin caller-frame resolution,
normalized runtime constants in language objects, recursive character coercion, string affixes,
capture-location matching, and language equality. The zeallot and ini packages remain opt-in test
inputs and contribute no source or resources to the shipped Worker. The measured Worker is 426.1 KiB
gzip (436,317 bytes), 93 bytes above the previous 426 KiB ceiling, so the ceiling rises narrowly to
427 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.287 separates executable package-source and immutable-resource budgets and adds
list/factor `%s` formatting, `strrep`, `length<-`, `anyNA`, and `make.unique`. The cpp11 and otel
packages remain opt-in test inputs and contribute no source or resources to the shipped Worker. The
measured Worker is 427.2 KiB gzip (437,474 bytes), 230 bytes above the previous 427 KiB ceiling, so
the ceiling rises narrowly to 428 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.288 adds standard dynamic `exportPattern` resolution, prompt tar-limit error
propagation, pre-Worker package-resource validation, and a dedicated package-resource field in the
existing runtime-limit record. BH remains an opt-in test input; none of its 128 MiB of headers ships
in the Worker. The measured Worker is 427.5 KiB gzip (437,733 bytes), within the existing 428 KiB
ceiling, so client, Worker, and parser-Wasm budgets remain unchanged. Build-time normalization of BH
is intentionally large and measured separately by the external regression rather than the browser
bundle budget.

Language subset 0.289 adds the complete ordered `par()` parameter inventory and read-only restore
handling, shared `axis(xlab=)` forwarding behavior, and `barplot` `xaxt`/`yaxt` suppression. The
unchanged labeling package remains an opt-in test input and contributes no source or resources to
the shipped Worker. The measured Worker is 428.3 KiB gzip (438,551 bytes), 279 bytes above the
previous 428 KiB ceiling, so the ceiling rises narrowly to 429 KiB; client and parser-Wasm budgets
remain unchanged. The unusually graphics-heavy `extended.figures(2)` regression uses an explicit 128
MB evaluation-output bound rather than weakening the interactive-safe default.

Language subset 0.290 adds opt-in package-test manifests, empty `NULL` subscript semantics,
matrix/data-frame diagonal replacement, browser-safe `Sys.info()`, exact complex integer powers, and
inverse trigonometric vectors. Retained numDeriv tests remain opt-in and contribute no package
source or resources to the shipped Worker. The measured Worker is 429.0 KiB gzip (439,345 bytes), 49
bytes above the previous 429 KiB ceiling, so the ceiling rises narrowly to 430 KiB; client and
parser-Wasm budgets remain unchanged. The large CSD regression uses explicit finite 500,000,000-step
and 100,000,000-element limits in the test only; interactive-safe defaults and named profiles are
unchanged.

Language subset 0.291 adds owned language/expression entry operations, syntax-preserving replacement
call frames, pairlist apply-family inputs, `prod` and standard character constants,
matrix/data-frame coercion, array/default metadata, nested `NULL` replacement, and short-name
padding. Retained abind examples and tests remain opt-in and contribute no package source or
resources to the shipped Worker. The measured Worker is 431.2 KiB gzip (441,571 bytes), 1,251 bytes
above the previous 430 KiB ceiling, so the ceiling rises narrowly to 432 KiB; client and parser-Wasm
budgets remain unchanged. The 3,628,800-element abind array regression uses explicit finite
100,000,000-step and 5,000,000-element limits in that test only.

Language subset 0.292 adds closure-valued call heads, target-environment `do.call()` invocation,
function-scoped `local()` cleanup, and bounded `sys.calls()`/`sys.frames()` stack inspection.
Retained generics and withr examples remain opt-in and contribute no package source or resources to
the shipped Worker. The measured Worker is 431.5 KiB gzip (441,837 bytes), within the existing 432
KiB ceiling, so client, Worker, and parser-Wasm budgets remain unchanged.

Language subset 0.293 adds evaluator-owned environment reachability and finalizers, asynchronous
session-exit cleanup, circular graphics-device navigation, base timezone-cache state, browser-local
message-domain state, POSIXct formatting, NULL-aware `mapply`, and list-path `unlink` coercion.
Retained withr examples remain opt-in and contribute no package source or resources to the shipped
Worker. The measured Worker is 432.9 KiB gzip (443,253 bytes), 885 bytes above the previous 432 KiB
ceiling, so the ceiling rises narrowly to 433 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.294 ships the first provenance-audited core data resources (`mtcars` and corrected
`iris`) and a reusable static-package namespace/resource loader. The CSV resources are immutable,
network-free bundle inputs and are the only package data added to the default Worker. The measured
Worker is 436.0 KiB gzip (446,444 bytes), 3,052 bytes above the previous 433 KiB ceiling, so the
ceiling rises narrowly to 436 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.295 adds two compact historical uniform engines and version selection without
shipping tables or external runtime code. The measured Worker is 436.4 KiB gzip (446,875 bytes), 431
bytes above the previous 436 KiB ceiling, so the ceiling rises narrowly to 437 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.296 adds the historical Buggy Kinderman-Ramage normal transform as compact owned
arithmetic without tables, host calls, or external runtime code. The measured Worker is 436.9 KiB
gzip (447,339 bytes), 464 bytes above profile 0.295 and still below the existing 437 KiB ceiling;
all budgets remain unchanged.

Language subset 0.297 reuses that transform for corrected Kinderman-Ramage with one mode branch and
no additional tables or dependencies. The measured Worker is 436.9 KiB gzip (447,428 bytes), 89
bytes above profile 0.296 and still below the existing 437 KiB ceiling; all budgets remain
unchanged.

Language subset 0.298 normalizes ASCII spaces at the existing named-color catalog lookup and routes
`plot.default(bty=)` through the existing box-edge selector. Unchanged package examples remain
opt-in and contribute no package source or resources to the shipped Worker. The measured Worker is
437.0 KiB gzip (447,472 bytes), 44 bytes above profile 0.297 and still within the existing 437 KiB
ceiling; all budgets remain unchanged.

Language subset 0.299 adds bounded DCF record parsing over the existing owned virtual file and
connection layer. The implementation adds no host parser, runtime package source, or dependency
payload. The measured Worker is 437.9 KiB gzip (448,385 bytes), 913 bytes above profile 0.298 and
897 bytes above the previous 437 KiB ceiling, so the ceiling rises narrowly to 438 KiB; client and
parser-Wasm budgets remain unchanged.

Language subset 0.300 adds compact primitive finiteness, owned closure-frame counting, top-level
environment traversal, and the session-current `.GlobalEnv` binding. Unchanged otel examples remain
opt-in and add no package source or telemetry dependency to the shipped Worker. The measured Worker
is 438.2 KiB gzip (448,695 bytes), 310 bytes above profile 0.299 and 183 bytes above the previous
438 KiB ceiling, so the ceiling rises narrowly to 439 KiB; client and parser-Wasm budgets remain
unchanged.

Language subset 0.301 adds full-signature `nchar` Unicode/encoding controls, bind-dimname labeling,
selected-name propagation, and attributes on first-class callable builtins. Unchanged pkgconfig and
crayon examples remain opt-in and add no package source or palette resource to the shipped Worker.
The measured Worker is 439.5 KiB gzip (450,039 bytes), 1,344 bytes above profile 0.300 and 503 bytes
above the previous 439 KiB ceiling, so the ceiling rises narrowly to 440 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.302 adds explicit call matching, class-preserving condition errors, primitive
reflection, and virtual permission checks. Unchanged assertthat and praise examples remain opt-in
and add no package source or resources to the shipped Worker. The measured Worker is 440.4 KiB gzip
(450,919 bytes), 880 bytes above profile 0.301 and 359 bytes above the previous 440 KiB ceiling, so
the ceiling rises narrowly to 441 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.303 adds reusable difftime-unit access and replacement, primitive infinity
classification, and browser-owned C-style formatting. Unchanged prettyunits examples remain opt-in
and add no package source or data to the shipped Worker. The measured Worker is 442.5 KiB gzip
(453,113 bytes), 2,194 bytes above profile 0.302 and 1,529 bytes above the previous 441 KiB ceiling,
so the ceiling rises narrowly to 443 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.304 adds reusable condition/restart and interrupt control, source references,
expression-container/data-frame behavior, hook and sequence semantics, and recorded-plot metadata.
Unchanged evaluate examples remain opt-in and add no package source or runtime adapter to the
shipped Worker. The measured Worker is 445.4 KiB gzip (456,041 bytes), 2,928 bytes above profile
0.303 and 2,359 bytes above the previous 443 KiB ceiling, so the ceiling rises narrowly to 446 KiB;
client and parser-Wasm budgets remain unchanged.

Language subset 0.305 adds provenance-audited `InsectSprays` and `faithful` bytes plus their generic
static `datasets` loaders. The six newly deep-audited external packages remain opt-in and add no
package source or host integration to the shipped Worker. The measured Worker is 448.3 KiB gzip
(459,027 bytes), 2,986 bytes above profile 0.304 and 2,323 bytes above the previous 446 KiB ceiling,
so the ceiling rises narrowly to 449 KiB; client and parser-Wasm budgets remain unchanged.

Language subset 0.306 reuses the existing normalized-AST quotation conversion for exact closure body
storage types and returns the existing singleton `NULL` for empty formal lists. Oracle-v2 binding
associations are development evidence only and do not enter the browser bundle. The measured Worker
is 448.3 KiB gzip (459,036 bytes), nine bytes above profile 0.305 and within the existing 449 KiB
ceiling; all budgets remain unchanged.

Language subset 0.307 adds normalized function-body/formal replacement and ordinary `.Environment`
attribute support. The recursive evidence remains development-only. The measured Worker is 448.8 KiB
gzip (459,556 bytes), 520 bytes above profile 0.306 and within the existing 449 KiB ceiling; all
budgets remain unchanged.

Language subset 0.308 adds S3 dispatch and shared list-to-closure construction for `as.function()`.
The measured Worker is 449.1 KiB gzip (459,878 bytes), 322 bytes above profile 0.307 and 102 bytes
above the previous 449 KiB ceiling, so the ceiling rises narrowly to 450 KiB; client and parser-Wasm
budgets remain unchanged.

Language subset 0.309 adds generic bounded Reference Class support and the Base semantic seams
required by the source-blind `docopt` holdout. A complete clean rebuild measures the Worker at 451.3
KiB gzip (462,098 bytes), 1,298 bytes above the previous 450 KiB ceiling, so the ceiling rises
narrowly to 452 KiB. The statically loaded public client is 15.6 KiB gzip and combined parser Wasm
is 671.9 KiB raw; their budgets remain unchanged.

Language subset 0.310 adds generic `match(..., nomatch=)` coercion, `Negate()`, `storage.mode()` and
`storage.mode<-`, plus the deterministic browser `commandArgs()` contract required by the
source-blind `getopt` holdout. A complete clean rebuild measures the Worker at 452.1 KiB gzip
(462,941 bytes), 843 bytes above profile 0.309 and 93 bytes above the previous 452 KiB ceiling, so
the ceiling rises narrowly to 453 KiB. The statically loaded public client remains 15.6 KiB gzip and
combined parser Wasm remains 671.9 KiB raw; their budgets are unchanged.

Language subset 0.311 adds parser-independent S4 class exports, exact owned slot access and
replacement, registered validity execution, package-local replacement generics, and bounded
`cat(fill=)` wrapping. External package source and examples remain opt-in and add no payload to the
Worker. A complete clean rebuild measures the Worker at 453.2 KiB gzip (464,044 bytes), 1,103 bytes
above profile 0.310 and 172 bytes above the previous 453 KiB ceiling, so the ceiling rises narrowly
to 454 KiB. The statically loaded public client remains 15.6 KiB gzip and combined parser Wasm
remains 671.9 KiB raw; their budgets are unchanged.

Language subset 0.312 adds scalar list/pairlist logical coercion and target-aware S4 `coerce` method
selection. Package archives, examples, and Oracle evidence remain build/test inputs and add no
runtime payload. A complete rebuild measures the Worker at 453.3 KiB gzip (464,172 bytes), 128 bytes
above profile 0.311 and within the existing 454 KiB ceiling. The statically loaded public client
remains 15.6 KiB gzip and combined parser Wasm remains 671.9 KiB raw; all budgets remain unchanged.

Language subset 0.313 adds caller-environment S3 lookup, `levels()`/`nlevels()`, and one concise
immutable runtime-root legal notice. External package archives and Oracle evidence remain test-only.
A complete rebuild measures the Worker at 453.6 KiB gzip (464,502 bytes), 330 bytes above profile
0.312 and within the existing 454 KiB ceiling. The statically loaded public client remains 15.6 KiB
gzip and combined parser Wasm remains 671.9 KiB raw; all budgets remain unchanged.

Language subset 0.314 adds named call-entry retention, the browser semantic compiler seam, and
numeric/complex matrix multiplication. External package archives and Oracle observations remain
test-only. A complete rebuild measures the Worker at 454.0 KiB gzip (464,889 bytes), seven bytes
below the unchanged 454 KiB ceiling. The statically loaded public client remains 15.6 KiB gzip and
combined parser Wasm remains 671.9 KiB raw.

Language subset 0.315 adds core-package dependency attachment and a deterministic single-lane
`parallel` adapter. A complete rebuild measures the Worker at 455.3 KiB gzip (466,193 bytes), 1,304
bytes above profile 0.314. The explicit Worker ceiling is therefore 456 KiB, leaving 751 bytes of
headroom. The statically loaded public client remains 15.6 KiB gzip and combined parser Wasm remains
671.9 KiB raw.

Language subset 0.319 adds package-construction namespace lookup, system-frame reflection, qualified
replacement, and generated-code substitution semantics. A complete rebuild measures the Worker at
458.7 KiB gzip (469,729 bytes), 1,652 bytes above profile 0.318. The explicit Worker ceiling is 459
KiB, leaving 287 bytes of headroom. The statically loaded public client remains 15.8 KiB gzip and
combined parser Wasm remains 671.9 KiB raw.

Language subset 0.316 adds platform NAMESPACE selection, progress state, two parallel aliases, and
the package-driven Base/model primitives. A complete rebuild measures the Worker at 456.2 KiB gzip
(467,196 bytes), 1,003 bytes above profile 0.315. The explicit Worker ceiling is 457 KiB, leaving
772 bytes of headroom. The statically loaded public client remains 15.6 KiB gzip and combined parser
Wasm remains 671.9 KiB raw.

Language subset 0.317 adds runtime-owned version metadata and the generic reflection/data-frame
seams required by `globals`. A complete rebuild measures the Worker at 456.5 KiB gzip (467,507
bytes), 311 bytes above profile 0.316 and within the existing 457 KiB ceiling, leaving 461 bytes of
headroom. The statically loaded public client is 15.8 KiB gzip and combined parser Wasm remains
671.9 KiB raw.

Language subset 0.318 adds primitive S3 dispatch for classed environments and the package-driven
Base message/membership seams. A complete rebuild measures the Worker at 457.1 KiB gzip (468,077
bytes), 570 bytes above profile 0.317. The explicit Worker ceiling is 458 KiB, leaving 915 bytes of
headroom. The statically loaded public client remains 15.8 KiB gzip and combined parser Wasm remains
671.9 KiB raw.

Language subset 0.320 adds the reusable namespace, S3, caller-frame, NULL Ops, metadata, string,
attribute, delayed-binding, and serialization semantics required by the R.oo checkpoint. A complete
rebuild measures the Worker at 464.7 KiB gzip (475,868 bytes), 6,139 bytes above profile 0.319. The
explicit Worker ceiling is 465 KiB, leaving 292 bytes of headroom. The statically loaded public
client remains 15.8 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

Language subset 0.321 adds the reusable parser, virtual compressed/binary I/O, environment,
source-reference, condition/time-limit, digest, dimension-name, and graphics-layout semantics
required by the R.utils checkpoint. The bzip2 implementation is loaded only on first `bzfile()` use
as a separate 95.5 KiB gzip chunk; it is not part of startup Worker JavaScript. A complete rebuild
measures the startup Worker at 477.1 KiB gzip, 12.4 KiB above profile 0.320, so the explicit ceiling
is 478 KiB. The statically loaded public client is 16.5 KiB gzip and combined parser Wasm remains
671.9 KiB raw.

Language subset 0.325 adds C-locale POSIX regex-class normalization and the reusable real-matrix
semantics required by the source-blind matrixcalc checkpoint: vector-promoting matrix products,
triangular and coordinate matrices, Kronecker products, choose/lchoose, determinant/solve, QR, and
SVD. The unchanged external package remains test-only and contributes no source or resources to the
Worker. A complete rebuild measures the Worker at 483.2 KiB gzip (494,748 bytes), 5.4 KiB above the
profile 0.324 measurement. The explicit ceiling rises narrowly to 484 KiB, leaving 868 bytes of
headroom; the 150 KiB client and 1.5 MiB parser-Wasm budgets remain unchanged.

Language subset 0.326 adds the generic formula-language and model-frame substrate required by the
source-blind Formula checkpoint: formula attributes and call mutation, terms metadata and dot
expansion, model-frame expression-column reuse, formula equality, response deletion/extraction, and
additive offsets. The unchanged external package remains test-only. A complete rebuild measures the
Worker at 484.8 KiB gzip (496,440 bytes). The explicit ceiling rises by the minimum whole KiB to 485
KiB, leaving 200 bytes of headroom; the 150 KiB client and 1.5 MiB parser-Wasm budgets are
unchanged.

Language subset 0.327 adds the generic methods, S3/S4, Date/class, namespace-export, and compact
row-name semantics required by the source-blind DBI checkpoint. The unchanged external package
remains test-only. A complete rebuild measures the Worker at 486.9 KiB gzip (498,571 bytes), 2,131
bytes above profile 0.326. The explicit ceiling rises by the minimum whole-KiB increment to 487 KiB,
leaving 117 bytes of headroom; the 150 KiB client and 1.5 MiB parser-Wasm budgets are unchanged.

Language subset 0.328 adds reusable semantics exposed by the source-blind xtable checkpoint:
`zapsmall()` and numeric S3 dispatch, matrix-aware `data.frame()` construction, zero-selection
data-frame replacement, gzip package-data loading, and `anova.lm`/`summary.aov` model tables. A
complete rebuild measures the Worker at 490.6 KiB gzip (502,386 bytes), 3,815 bytes above profile
0.327. The explicit ceiling rises by the minimum whole-KiB increment to 491 KiB, leaving 398 bytes
of headroom; the 150 KiB client and 1.5 MiB parser-Wasm budgets are unchanged.

Language subset 0.329 adds recursive chained formula expansion and reusable stratified-analysis
semantics for one formula-special `Error()` term, `aovlist` construction, and `summary.aovlist`
tables. External package archives and Oracle observations remain test-only. A complete rebuild
measures the Worker at 492.1 KiB gzip (503,882 bytes), 1,496 bytes above profile 0.328. The explicit
ceiling rises by the minimum whole-KiB increment to 493 KiB, leaving 950 bytes of headroom; the 150
KiB client and 1.5 MiB parser-Wasm budgets are unchanged.

Language subset 0.330 adds generic `summary.lm`, gaussian/binomial/Poisson family objects and IRLS
GLM inference, numeric `prcomp`, the provenance-audited `USArrests` dataset, `ftable` formatting,
data-frame row-bind attribute preservation, missing positional argument matching, and matrix extent
handling. The unchanged external archive remains test-only. A clean rebuild measures the Worker at
504.8 KiB gzip (516,891 bytes), 13,009 bytes above profile 0.329. The explicit ceiling rises by the
minimum whole-KiB increment to 505 KiB, leaving 229 bytes of headroom; the statically loaded public
client is 16.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

Language subset 0.331 adds core-package namespace isolation, Base namespace identity, top-level
`substitute()` behavior, first-class special operators, and primitive `NextMethod()` fallback
required by the source-blind `globals` checkpoint. Package archives and GNU R observations remain
test-only. A clean rebuild measures the Worker at 504.9 KiB gzip (516,978 bytes), 87 bytes above
profile 0.330 and below the unchanged 505 KiB ceiling, leaving 142 bytes of headroom. The statically
loaded public client remains 16.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

Language subset 0.332 adds the reusable apply-family, caller-frame, numeric-summary, table/array,
replacement, trace, data-frame-summary, and core-data semantics required to complete unchanged
`pbapply 1.7-4` installed examples. The external package remains test-only; only the compact audited
`warpbreaks` and `presidents` data are new runtime resources. A clean rebuild measures the Worker at
508.3 KiB gzip (520,542 bytes), 3,564 bytes above profile 0.331. The explicit ceiling rises by the
minimum whole-KiB increment to 509 KiB, leaving 674 bytes of headroom; the statically loaded public
client remains 16.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

Language subset 0.333 adds parenthesized visibility, reusable S3/replacement condition-call shapes,
owned table/array/matrix presentation, and generic saved-output error-stack formatting. A clean
rebuild measures the Worker at 509.3 KiB gzip (521,507 bytes), 965 bytes above profile 0.332. The
explicit ceiling rises by the minimum whole-KiB increment to 510 KiB, leaving 733 bytes of headroom;
the statically loaded public client is 16.9 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

Language subset 0.334 adds exact unmatched-capture extraction, ASCII regex index metadata, and
generic declared-Suggests warning classification in the build-time package-check runner. A clean
rebuild measures the Worker at 509.4 KiB gzip (521,643 bytes), 136 bytes above profile 0.333 and
below the unchanged 510 KiB ceiling, leaving 597 bytes of headroom. The statically loaded public
client remains 16.9 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

Profile 0.335 adds bounded S4 dispatch-stack frames, S4 XDR encoding/decoding, and numeric scale
selection. Each S4 redispatch frame is released with stack unwinding; XDR readers allocate only the
declared slot/vector graph; `pretty.default()` remains subject to the evaluation vector budget. A
shared S3-generic path removes duplicate dispatch code. After that reduction, a clean build measures
the Worker at 523,758 bytes gzip. The explicit ceiling rises by the minimum whole-KiB increment that
admits the reusable semantic closure, from 510 KiB to 512 KiB, leaving 530 bytes of headroom. The
client and parser-Wasm ceilings are unchanged.

Profile 0.336 adds generic S4 primitive operator/subset dispatch and the package-driven coercion,
sorting, and differencing seams. A clean build measures the Worker at 524,297 bytes gzip, 9 bytes
above the former 512 KiB ceiling. The explicit budget therefore rises by the minimum whole-KiB
increment to 513 KiB, leaving 1,015 bytes of headroom. The browser bundle audit remains
authoritative; this is not permission for unbounded callable growth.

Profile 0.337 adds UTC/GMT POSIX rounding, S3 range forwarding, S4 marker continuity, and prototype
slot completion. A clean build measures the Worker at 525,150 bytes gzip, 853 bytes above Profile
0.336 and below the unchanged 513 KiB ceiling, leaving 162 bytes of headroom. The browser bundle
audit passes; any further growth must reduce code or explicitly re-evaluate the whole-KiB budget.

Profile 0.338 adds reusable argument/generic dispatch, partial matching, POSIXlt parsing and
replacement, and `julian.POSIXt`. A clean build measures the Worker at 526,703 bytes gzip, 1,553
bytes above Profile 0.337. This exceeds both the former 513 KiB ceiling and a 514 KiB ceiling, so
the explicit budget rises by the minimum whole-KiB increment to 515 KiB, leaving 657 bytes of
headroom. The client and parser-Wasm ceilings are unchanged.

Profile 0.339 adds reusable length dispatch, POSIXlt component recycling and missingness, the Base
`.leap.seconds` object, and ellipsis introspection. A clean build measures the Worker at 527,413
bytes gzip, 710 bytes above Profile 0.338 and 53 bytes above the former 515 KiB ceiling. The
explicit budget therefore rises by the minimum whole-KiB increment to 516 KiB, leaving 971 bytes of
headroom. The client and parser-Wasm ceilings are unchanged.

Profile 0.340 adds generic array splitting, empty-result apply typing, graphics S4 dispatch, plot
axis-style handling, and recursive language-name enumeration. A clean build measures the Worker at
529,122 bytes gzip, 1,709 bytes above Profile 0.339 and 738 bytes above the former 516 KiB ceiling.
The explicit budget therefore rises by the minimum whole-KiB increment to 517 KiB, leaving 286 bytes
of headroom. The client and parser-Wasm ceilings are unchanged.

Profile 0.341 adds S4 constructor/next-method dispatch, registered names replacement, extended
primitive sequence controls, and generic missing-value replacement. The production Worker measures
529,818 bytes gzip, 696 bytes above Profile 0.340 and 410 bytes above the former 517 KiB ceiling.
The explicit budget therefore rises by the minimum whole-KiB increment to 518 KiB, leaving 614 bytes
of measured headroom. The 150 KiB public-client and 1.5 MiB combined-parser-Wasm ceilings remain
unchanged.

Profile 0.353 adds the reusable Pearson-test, data-frame binding, and graphics corrections that
complete corrplot's installed examples. A clean production build measures the Worker at 625,180
bytes gzip, 1,254 bytes above Profile 0.352 and 540 bytes above the former 610 KiB ceiling. The
explicit budget therefore rises by the minimum whole-KiB increment to 611 KiB, leaving 484 bytes of
headroom. The public-client and combined-parser-Wasm ceilings are unchanged.

Profile 0.354 adds model/RNG/grouped-binomial and dataset seams that complete insight's installed
examples. A clean production build measures the Worker at 631,580 bytes gzip, 6,400 bytes above
Profile 0.353 and 5,916 bytes above the former 611 KiB ceiling. The explicit budget therefore rises
by the minimum whole-KiB increment to 617 KiB, leaving 228 bytes of headroom. The public-client and
combined-parser-Wasm ceilings are unchanged.

Profile 0.355 adds generic grid, root-finding, covariance normalization, and transposed-product
semantics. A clean production build measures the Worker at 633,837 bytes gzip, 2,257 bytes above
Profile 0.354. The explicit ceiling rises by the minimum whole-KiB increment from 617 KiB to 620
KiB, leaving 1,043 bytes of headroom. Public-client and combined-parser-Wasm ceilings are unchanged.

Profile 0.356 adds reusable naming, array sweep, maximum-likelihood factor-analysis, loadings, and
programmatic callback-call semantics. A clean production build measures the Worker at 639,381 bytes
gzip, 5,544 bytes above Profile 0.355 and 4,501 bytes above the former 620 KiB ceiling. The explicit
budget therefore rises by the minimum whole-KiB increment to 625 KiB, leaving 619 bytes of headroom.
Public-client and combined-parser-Wasm ceilings are unchanged.

Profile 0.357 adds independent allocation accounting, package-scale numeric checkpoint batching,
expression/`atan2`/stored-call semantics, and reusable graphics closure. A clean production build
measures the Worker at 640,583 bytes gzip, 1,202 bytes above Profile 0.356 and 583 bytes above the
former 625 KiB ceiling. The explicit budget therefore rises by the minimum whole-KiB increment to
626 KiB, leaving 441 bytes of headroom. Public-client and combined-parser-Wasm ceilings are
unchanged.

Profile 0.358 adds the provenance-audited `ability.cov` resource plus generic scaled limited-memory
factor fitting and Kaiser-normalized varimax. A clean production build measures the Worker at
641,133 bytes gzip, 550 bytes above Profile 0.357 and 109 bytes above the former 626 KiB ceiling.
The explicit budget therefore rises by the minimum whole-KiB increment to 627 KiB, leaving 915 bytes
of headroom. Public-client and combined-parser-Wasm ceilings are unchanged.

Profile 0.359 embeds the reproducible 40,728-byte L-BFGS-B 2.1 Wasm module and its typed
reverse-communication adapter, alongside generic varimax, legend swatches, and package-check
closure. A clean production build measures the Worker at 666,809 bytes gzip, 25,676 bytes above
Profile 0.358 and 24,761 bytes above the former 627 KiB ceiling. The explicit budget therefore rises
by the minimum whole-KiB increment to 652 KiB, leaving 839 bytes of headroom. The statically loaded
public client remains 17.5 KiB gzip and the combined parser Wasm remains 671.9 KiB raw, so their
ceilings are unchanged.

Profile 0.360 adds generic `tibble::as_tibble` conversion/name repair and Base `as.character.Date`
civil-date semantics. A clean production build measures the Worker at 667,911 bytes gzip, 1,102
bytes above Profile 0.359 and 263 bytes above the former 652 KiB ceiling. The explicit budget
therefore rises by the minimum whole-KiB increment to 653 KiB, leaving 761 bytes of headroom. The
statically loaded public client remains 17.5 KiB gzip and the combined parser Wasm remains 671.9 KiB
raw, so their ceilings are unchanged.

Profile 0.361 adds generic S3 group registration/context and `NextMethod()` forwarding, callable
operator and Summary dispatch, list distinctness, single-variable `stats::poly`, and the
browser-owned general real eigensolver. A clean production build measures the Worker at 671,284
bytes gzip, 3,373 bytes above Profile 0.360 and 2,812 bytes above the former 653 KiB ceiling. The
explicit budget therefore rises by the minimum whole-KiB increment to 656 KiB, leaving 460 bytes of
headroom. The statically loaded public client remains 17.5 KiB gzip and the combined parser Wasm
remains 671.9 KiB raw, so their ceilings are unchanged.

## Profile 0.362 model-semantics size delta

Profile 0.362 adds contrast-matrix encoding, stored-call formula rewriting, visible-QR
reconstruction, and rank-deficient prediction checks. A clean production build measures the Worker
at 673,198 bytes (657.4 KiB) gzip, 1,914 bytes above the Profile 0.361 measurement and 1,454 bytes
above the former 656 KiB ceiling. The explicit budget therefore rises by the minimum whole-KiB
increment to 658 KiB, leaving 594 bytes of headroom. No package source or package-identity dispatch
is embedded in production output.

## Profile 0.363 language and package-semantics size delta

Profile 0.363 adds normalized parse-data ownership, structural width-sensitive deparsing, general
language reconstruction, and reusable condition and regular-expression semantics needed by the
source-blind `formatR` package check. L-BFGS-B is now loaded only when its optimization backend is
first invoked, so its independently cached 25.7 KiB gzip chunk is excluded from Worker startup. A
clean production build measures the initial Worker at 651,004 bytes (635.7 KiB) gzip, 22,194 bytes
below Profile 0.362 and 22,788 bytes below the unchanged 658 KiB ceiling.

## Profile 0.364 deparse and condition-semantics size delta

Profile 0.364 closes structural nested deparse layout, interleaved calling/exiting handler order,
and suppression visibility without adding a dependency or package-specific branch. A clean
production build measures the initial Worker at 651,587 bytes (636.3 KiB) gzip, within the unchanged
658 KiB ceiling. The statically loaded public client is 19.1 KiB gzip and the combined parser Wasm
remains 671.9 KiB raw.

## Profiles 0.376–0.377 reusable statistics size delta

Profiles 0.376 and 0.377 add the independent smoothing-spline solver and predictor, Q-Q coordinate
and plotting helpers, GLM control construction, explicit missing-package data admission, and the
vectorized normal-density primitive. A clean production build measures the initial Worker at 675,077
bytes (659.3 KiB) gzip, 1,285 bytes above the former 658 KiB ceiling. A 659 KiB ceiling is still 261
bytes too small, so the explicit budget rises by the minimum sufficient whole-KiB increment to 660
KiB, leaving 763 bytes of measured headroom. No package source, package identity, network path, host
process, generated JavaScript, or new runtime dependency is added. The statically loaded public
client remains 19.4 KiB gzip and the combined parser Wasm remains 671.9 KiB raw.

## Profiles 0.378–0.380 data and time-series statistics size delta

Profiles 0.378 through 0.380 add the independently sourced 114-value `datasets::lynx` resource,
univariate Yule-Walker `stats::ar`, vectorized `stats::rgeom`, and stationary univariate
`stats::arima.sim`. A clean production build measures the initial Worker at 678,660 bytes (662.754
KiB) gzip, 3,583 bytes above Profile 0.377 and 2,820 bytes above the former 660 KiB ceiling. The
explicit budget therefore rises by the minimum sufficient whole-KiB increment to 663 KiB, leaving
252 bytes of measured headroom. No package source, package identity, host adapter, network path,
generated JavaScript, or new runtime dependency is added; the public client and parser Wasm ceilings
remain unchanged.

## Profile 0.381 reflection and vectorized-uniform size delta

Profile 0.381 adds package-neutral `methods::formalArgs` reflection and vectorized `stats::runif`
bound, domain, and RNG-consumption semantics. A clean production build measures the initial Worker
at 678,743 bytes (662.835 KiB) gzip, 83 bytes above Profile 0.380 and within the unchanged 663 KiB
ceiling, leaving 169 bytes of measured headroom. No dependency, package source, package identity,
host adapter, network path, generated JavaScript, or default-limit change is added; the
public-client and parser-Wasm ceilings remain unchanged.

## Post-0.381 multcompView semantic-closure size delta

The source-blind `multcompView 0.1-12` progression adds reusable array/dimname handling,
`datasets::USJudgeRatings`, `as.matrix.dist`, `interaction`, character-to-formula coercion,
fitted-model terms metadata, and `plot.default(cex.axis=)` validation. A clean production build
measures the initial Worker at 686,289 bytes (670.204 KiB) gzip, 7,546 bytes above Profile 0.381 and
7,377 bytes above the former 663 KiB ceiling. The explicit budget therefore rises by the minimum
sufficient whole-KiB increment to 671 KiB, leaving 815 bytes of measured headroom. The public-client
and parser-Wasm ceilings remain unchanged. The additional package-test computation budget is opt-in;
the interactive-safe profile and all per-vector, output, call-depth, and package-resource ceilings
remain bounded.

## Profile 0.408 wide-SVD allocation bound

The real rectangular SVD no longer always materializes an `ncol(X)`-squared crossproduct. It forms
an `ncol(X)`-squared Gram matrix for tall or square inputs and an `nrow(X)`-squared Gram matrix for
wide inputs, then reconstructs the opposite singular vectors. The dominant symmetric intermediate
therefore scales with `min(nrow(X), ncol(X))^2`. The unchanged corpcor 50-by-5,000 documented
example now stays within the existing two-million-element package-test vector limit; no default
resource ceiling, dependency, native backend, or package-specific fast path is added.

## Profile 0.409 grouped-replacement and ASCII-decoding bounds

`split<-` reuses existing selector and replacement allocation paths; it does not materialize a
package-specific copy or unbounded group index. ASCII native decoding scans each byte once, rejects
non-seven-bit input before publication, and constructs output in bounded 8,192-byte chunks. The
`las` validation and stats namespace correction add constant work. No default resource ceiling,
dependency, native backend, host codec, package identity branch, or network path is added. Final
bundle measurements are recorded by the repository size gate.

## Profile 0.410 selection and matching bounds

One-dimensional sorting retains the existing `O(n log n)` ordering path and reuses the shared array
selector for one additional linear metadata pass. `charmatch()` performs bounded
`O(length(x) * length(table))` exact/partial scans with cooperative checkpoints and allocations
proportional to the two input lengths. Table-label and formal-reflection corrections add constant
work. No package-specific cache, host service, dependency, native backend, or network path is added.

The post-build size gate records 19.4 KiB gzip for statically loaded public client JavaScript
against a 150.0 KiB ceiling, 624.9 KiB gzip for Worker JavaScript against a 671.0 KiB ceiling, and
671.9 KiB raw for combined parser Wasm against a 1,536.0 KiB ceiling.

## Profile 0.432 bounded package-test arrays

The opt-in package-test profile raises only its per-vector ceiling from two million to four million
elements so a retained unchanged pure-R test can construct a finite 12-by-12-by-12-by-12-by-12-by-12
array. The interactive profile remains capped at one million elements, and existing total
allocation, output, call-depth, timeout, package-resource, and browser bundle gates remain in force.
The array missing-subscript identity path returns the existing immutable runtime value instead of
allocating and flattening a second copy.

## Profile 0.458 nonlinear least-squares size delta

The reusable `stats::nls`, nonlinear profile, and profile-plot vertical slice adds a bounded
finite-difference Jacobian, damped Gauss-Newton solver, profile refits, public fitted-model
structure, and S3 dispatch without a dependency, package identity branch, host adapter, generated
JavaScript, or network path. A clean production build measures Worker JavaScript at 690,666 bytes
(674.5 KiB) gzip, 3,562 bytes above the former 671 KiB ceiling. The explicit budget therefore rises
by the minimum sufficient whole-KiB increment to 675 KiB, leaving 534 bytes of measured headroom.
The statically loaded public-client and combined parser-Wasm ceilings remain unchanged.

## Profile 0.459 core-example resource size delta

The independently authored `stats::lm.influence` example is stored in the existing validated core
example manifest and executes through the generic package-resource path. A clean production build
measures Worker JavaScript at 690,774 bytes (674.6 KiB) gzip, 108 bytes above Profile 0.458 and 426
bytes below the existing 675 KiB ceiling. No budget changes, dependencies, package identity
branches, host adapters, generated JavaScript, or network paths are introduced.

## Profile 0.460 state-family resource size delta

The complete seven-object state family is retained as one declarative multi-object data resource and
uses the existing parser, factor, list, matrix, namespace, and data-loading machinery. A clean
production build measures Worker JavaScript at 693,407 bytes (677.2 KiB) gzip, 2,633 bytes above
Profile 0.459 and 2,205 bytes above the former 675 KiB ceiling. The Worker ceiling therefore rises
by the minimum sufficient whole-KiB increment to 678 KiB, leaving 867 bytes of measured headroom.
The public-client and combined parser-Wasm ceilings remain unchanged.

## Profile 0.461 sunspots and time-series size delta

The complete fixed `sunspots` series is retained as a compact declarative resource and reuses the
existing parser, vector, time-series, namespace, and data-loading machinery. The production build
measures Worker JavaScript at 701,154 bytes (684.7 KiB) gzip, 7,747 bytes above Profile 0.460 and
286 bytes below a 685 KiB ceiling. The Worker ceiling therefore rises by the minimum sufficient
whole-KiB increment from 678 KiB to 685 KiB. The public-client and combined parser-Wasm ceilings
remain unchanged.

## Profile 0.462 EuStockMarkets size delta

The complete 7,440-value multivariate series is retained as a compact NativR-generated `.rda`
resource and uses the generic package-data and time-series machinery. A production build measures
Worker JavaScript at 723,480 bytes (706.5 KiB) gzip, 22,326 bytes above Profile 0.461 and 488 bytes
below a 707 KiB ceiling. The Worker ceiling therefore rises by the minimum sufficient whole-KiB
increment from 685 KiB to 707 KiB. The public-client and combined parser-Wasm ceilings remain
unchanged.

## Profile 0.463 numeric POSIX and missing-format size delta

Optional-origin numeric POSIX conversion and recursive optional-format recognition reuse the
existing vector, promise, condition, date-time, and graphics machinery and add no package resource
or dependency. A production build measures Worker JavaScript at 723,956 bytes (707.0 KiB) gzip, 476
bytes above Profile 0.462 and 12 bytes below the existing 707 KiB ceiling. No budget changes are
required; the public-client and combined parser-Wasm ceilings remain unchanged.

## Profile 0.464 metadata, apply naming, and Theoph size delta

Deterministic installed-package metadata and apply-family naming reuse existing description,
attribute, and simplification machinery. The complete `Theoph` table is retained as a compact base64
CSV and constructed through the generic package-data path. A clean production build measures Worker
JavaScript at 725,844 bytes (708.8 KiB) gzip, 1,888 bytes above Profile 0.463 and 1,876 bytes above
the former 707 KiB ceiling. The Worker ceiling therefore rises by the minimum sufficient whole-KiB
increment to 709 KiB, leaving 172 bytes of measured headroom. The statically loaded public client
measures 19.5 KiB gzip and the parser Wasm remains 671.9 KiB raw; their ceilings do not change.

## Profile 0.465 self-start nonlinear-model size delta

Callable attributes, generic self-start initialization, `SSfol`, and value-only `predict.nls` reuse
the existing evaluator, formula, model-environment, vector, and bounded nonlinear-optimization paths
and add no dependency or package resource. A clean production build measures Worker JavaScript at
727,812 bytes (710.8 KiB) gzip, 1,968 bytes above Profile 0.464 and 1,796 bytes above the former 709
KiB ceiling. The Worker ceiling therefore rises by the minimum sufficient whole-KiB increment to 711
KiB, leaving 252 bytes of measured headroom. The public client remains 19.5 KiB gzip and the
combined parser Wasm remains 671.9 KiB raw; their ceilings do not change.

## Profile 0.466 storage-preserving ftable size delta

Atomic flat-table permutation reuses existing vector constructors, missing masks, attributes, and
dimension-index helpers and adds no dependency or package resource. A clean production build
measures Worker JavaScript at 727,961 bytes (710.9 KiB) gzip, 149 bytes above Profile 0.465 and 103
bytes below the existing 711 KiB ceiling. No budget changes are required; the public client remains
19.5 KiB gzip and the combined parser Wasm remains 671.9 KiB raw.

## Profile 0.467 interaction-plot size delta

Grouped interaction summaries and rendering reuse the existing factor, subset, callback, plot,
lines, axis, box, annotation, legend, and device machinery and add no dependency or package
resource. A clean production build measures Worker JavaScript at 729,554 bytes (712.5 KiB) gzip,
1,593 bytes above Profile 0.466 and 1,490 bytes above the former 711 KiB ceiling. The Worker ceiling
therefore rises by the minimum sufficient whole-KiB increment to 713 KiB, leaving 558 bytes of
measured headroom. The public client remains 19.5 KiB gzip and combined parser Wasm remains 671.9
KiB raw.

## Profile 0.489 matrix/grid annotation size and package-test budget

Matrix-aware data-frame binding, graphics-annotation normalization, and source-preserving
`stopifnot` diagnostics add no dependency or host capability. A clean production build measures
Worker JavaScript at 742,329 bytes (724.9 KiB) gzip, 502 bytes above Profile 0.488 and 71 bytes
below the existing 725 KiB ceiling. The public client remains 19.5 KiB gzip and combined parser Wasm
remains 671.9 KiB raw.

The opt-in package-test cumulative work budget rises from 500,000,000 to 750,000,000 elements while
the four-million-element per-vector bound and the interactive-safe profile remain unchanged. The
increase is backed by an unchanged Rd example that serially renders multiple 3000-by-3000 TIFFs; it
bounds cumulative evaluator work and does not claim 750 million simultaneously live elements.

## Profile 0.468 language-subset size delta

Call and expression extraction reuse existing language/list conversion, vector index resolution, AST
quoting, and call reconstruction machinery and add no dependency or package resource. A clean
production build measures Worker JavaScript at 729,964 bytes (712.9 KiB) gzip, 410 bytes above
Profile 0.467 and 148 bytes below the existing 713 KiB ceiling. No budget changes are required; the
public client remains 19.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.469 vector-annotation size delta

`matplot()` now reuses the already bundled title annotation normalizer without its former redundant
scalar-label guard. A clean production build measures Worker JavaScript at 729,900 bytes (712.8 KiB)
gzip, 64 bytes below Profile 0.468 and 212 bytes below the existing 713 KiB ceiling. No budget
change or dependency is required; the public client remains 19.5 KiB gzip and combined parser Wasm
remains 671.9 KiB raw.

## Profile 0.470 formatted-array size delta

Atomic formatting now reuses existing dimension and attribute constructors to retain `dim` and
`dimnames`, adding no dependency or package resource. A clean production build measures Worker
JavaScript at 729,952 bytes (712.8 KiB) gzip, 52 bytes above Profile 0.469 and 160 bytes below the
existing 713 KiB ceiling. No budget change is required; the public client remains 19.5 KiB gzip and
combined parser Wasm remains 671.9 KiB raw.

## Profile 0.471 formals-reflection size delta

Caller-default reflection and character/envir lookup reuse existing dynamic-frame and environment
binding machinery and add no dependency. A clean production build measures Worker JavaScript at
730,095 bytes (713.0 KiB) gzip, 143 bytes above Profile 0.470 and 17 bytes below the existing 713
KiB ceiling. No budget change is required; the public client remains 19.5 KiB gzip and combined
parser Wasm remains 671.9 KiB raw.

## Profile 0.472 PostScript-device size delta

The owned PostScript renderer adds DSC document assembly and path, text, hatch, raster, boxplot, and
legend serialization while reusing the existing graphics journal and device registry. It adds no
runtime dependency, host capability, network path, or package resource. A clean production build
measures Worker JavaScript at 732,545 bytes (715.4 KiB) gzip, 2,450 bytes above Profile 0.471 and
2,433 bytes above the former 713 KiB ceiling. The Worker ceiling therefore rises by the minimum
sufficient whole-KiB increment to 716 KiB, leaving 639 bytes of measured headroom. The public client
remains 19.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.473 native line-encoding size delta

Native line-encoding aliases and returned-mark selection reuse the existing UTF-8/Latin-1 decoder
and character storage. A clean production build measures Worker JavaScript at 732,625 bytes (715.5
KiB) gzip, 80 bytes above Profile 0.472 and 559 bytes below the existing 716 KiB ceiling. No budget
change is required; the public client remains 19.5 KiB gzip and combined parser Wasm remains 671.9
KiB raw.

## Profile 0.474 assertion-block size delta

Expression-block assertions reuse the normalized AST evaluator and owned environment constructors,
adding no dependency or generated-code path. A clean production build measures Worker JavaScript at
732,797 bytes (715.6 KiB) gzip, 172 bytes above Profile 0.473 and 387 bytes below the existing 716
KiB ceiling. No budget change is required; the public client remains 19.5 KiB gzip and combined
parser Wasm remains 671.9 KiB raw.

## Profile 0.475 tools error-assertion size delta

The exported tools helper reuses lazy promises and the existing condition representation. A clean
production build measures Worker JavaScript at 733,110 bytes (715.9 KiB) gzip, 313 bytes above
Profile 0.474 and 74 bytes below the existing 716 KiB ceiling. No budget change is required; the
public client remains 19.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.476 version-metadata size delta

The narrow metadata-list path reuses the existing version parser, R list storage, numeric formatter,
and dput serializer and adds no dependency or host resource. A clean production build measures
Worker JavaScript at 733,290 bytes (716.1 KiB) gzip, 180 bytes above Profile 0.475 and 106 bytes
above the former 716 KiB ceiling. The Worker ceiling therefore rises by the minimum sufficient
whole-KiB increment to 717 KiB, leaving 918 bytes of measured headroom. The public client remains
19.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.477 compiler-report size delta

The fixed metadata closure adds no dependency or host capability. A clean production build measures
Worker JavaScript at 733,393 bytes (716.2 KiB) gzip, 103 bytes above Profile 0.476 and 815 bytes
below the existing 717 KiB ceiling. No budget change is required; the public client remains 19.5 KiB
gzip and combined parser Wasm remains 671.9 KiB raw.

## Profiles 0.478–0.480 runtime-metadata size delta

The fixed metadata closures add no dependency or host capability beyond the already bundled bzip2
and LAPACK assets. A clean production build measures Worker JavaScript at 733,590 bytes (716.4 KiB)
gzip, 197 bytes above Profile 0.477 and 618 bytes below the existing 717 KiB ceiling. No budget
change is required; the public client remains 19.5 KiB gzip and combined parser Wasm remains 671.9
KiB raw.

## Profiles 0.481–0.484 semantic-closure size delta

The graphics, array-binding, data-matrix, browser-owned `iris3`, expression-comparison, primitive S3
coercion, and Epanechnikov-density increments reuse existing runtime storage and package-resource
machinery and add no dependency or host capability. A clean production build measures Worker
JavaScript at 735,102 bytes (717.9 KiB) gzip, 1,512 bytes above Profile 0.480 and 894 bytes above
the former 717 KiB ceiling. The Worker ceiling therefore rises by the minimum sufficient whole-KiB
increment to 718 KiB, leaving 130 bytes of measured headroom. The public client remains 19.5 KiB
gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.485 namespace-reflection size delta

`getExportedValue()` reuses the existing namespace loader, export registry, namespace-environment
identity, and binding-forcing paths and adds no dependency, host capability, or package resource. A
clean production build measures Worker JavaScript at 735,418 bytes (718.2 KiB) gzip, 316 bytes above
Profile 0.484 and 186 bytes above the former 718 KiB ceiling. The Worker ceiling therefore rises by
the minimum sufficient whole-KiB increment to 719 KiB, leaving 838 bytes of measured headroom. The
public client remains 19.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.486 rank-one transpose size delta

Rank-one transpose and dimname-axis ordering reuse the existing vector attribute and matrix-shape
machinery and add no dependency, host capability, or package resource. A clean production build
measures Worker JavaScript at 735,617 bytes (718.4 KiB) gzip, 199 bytes above Profile 0.485 and 639
bytes below the existing 719 KiB ceiling. No budget change is required; the public client remains
19.5 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.487 non-central probability size delta

The centered Poisson mixtures and adaptive Student-t integrator reuse the existing special-function
kernel, while formula-point dispatch reuses the model-frame and graphics paths. A clean production
build measures Worker JavaScript at 736,968 bytes (719.7 KiB) gzip, 1,351 bytes above Profile 0.486
and 312 bytes below a minimally raised 720 KiB ceiling. The public client remains 19.5 KiB gzip and
combined parser Wasm remains 671.9 KiB raw.

## Profile 0.488 device, hypergeometric, and grid size delta

The browser-owned SVG serializer, TIFF container and LZW encoder, bounded hypergeometric tail
kernel, and generic grid collection/drawing paths add no dependency, host capability, or package
resource. A clean production build measures Worker JavaScript at 741,827 bytes (724.4 KiB) gzip,
4,859 bytes above Profile 0.487 and 4,547 bytes above the former 720 KiB ceiling. The Worker ceiling
therefore rises by the minimum sufficient whole-KiB increment to 725 KiB, leaving 573 bytes of
measured headroom. The public client remains 19.5 KiB gzip and combined parser Wasm remains 671.9
KiB raw.

## Profile 0.490 converter and static-device size delta

The converter, HSV, namespace-binding, and structural-attribute increment initially pushed the
Worker above the unchanged 725 KiB ceiling. PDF and PostScript now share their vector-device
geometry, while PDF, PostScript, and PNG share byte, colour, hatch, point, and string helpers. The
production-only Worker compaction uses the pinned Terser implementation, and runtime-only builtin
values omit review metadata already owned by the compatibility ledger, capability sources, and
documentation. Device serializers remain statically bundled: evaluating R code never imports or
fetches a renderer module. A clean production build measures the Worker at 741,429 bytes (724.1 KiB)
gzip, leaving 971 bytes below the unchanged ceiling. Device behavior remains distributed and tested;
the optimization does not remove functionality or raise a budget. The public client remains 19.5 KiB
gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.494 custom-family size delta

The custom numeric-response GLM-family protocol and method-correct `vcov.lm()` behavior reuse the
existing evaluator, promise, model, residual, summary, and prediction machinery and add no
dependency, host capability, or package resource. The family descriptor is shared by fitting and
stored-model consumers so those paths do not carry duplicate parsers or drift independently. A clean
production build measures Worker JavaScript at 742,972 bytes (725.6 KiB) gzip, 572 bytes above the
former 725 KiB ceiling. The Worker ceiling therefore rises by the minimum sufficient whole-KiB
increment to 726 KiB, leaving 452 bytes of measured headroom. The public client remains 19.6 KiB
gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.501 local replacement allocation behavior

Repeated replacement of an exactly owned local numeric vector now reuses same-length backing storage
and grows capacity geometrically up to `maxVectorLength`. Capacity is hidden from R length, wire
values, and serialization, but is charged when allocated and included in runtime memory census
estimates. Alias assignment, promise forcing, active/nonlocal bindings, names, attributes, S4 state,
and coercion disable reuse. A 1,000-element grow-and-update regression completes inside a 700,000
cumulative-element budget while direct and promised aliases retain GNU R values. The unchanged DFBA
package's four 10,000-sample contrast examples complete under the existing package-test limits; no
evaluation-resource ceiling was raised. A clean production build measures Worker JavaScript at
745,534 bytes (728.1 KiB) gzip, 2,562 bytes above Profile 0.494 and 2,558 bytes above the former 726
KiB ceiling. The explicit Worker budget therefore rises by the minimum sufficient whole-KiB
increment to 729 KiB, leaving 962 bytes of measured headroom. The public client remains 19.6 KiB
gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.513 package-data and diagram size delta

Generic documented LazyData mapping is build-time metadata and adds no runtime package identity or
network path. The Worker increment contains reusable `format.pval()`, line-end normalization and
multi-device propagation, plot-title controls, recursive graphics labels, and zero-row data-frame
semantics. A clean production build measures Worker JavaScript at 747,870 bytes (730.3 KiB) gzip,
2,336 bytes above Profile 0.501 and 1,374 bytes above the former 729 KiB ceiling. The explicit
Worker budget therefore rises by the minimum sufficient whole-KiB increment to 731 KiB, leaving 674
bytes of measured headroom. The public client remains 19.6 KiB gzip and combined parser Wasm remains
671.9 KiB raw.

## Profile 0.516 promise forwarding and step-function plotting

Active-frame promise provenance for captured/re-forwarded dots and the reusable GNU-shaped
`stats::plot.stepfun` graphics contract add no dependency or network path. A clean production build
measures Worker JavaScript at 750,054 bytes (732.475 KiB) gzip. This exceeds the prior 731 KiB
ceiling by 1,510 bytes, so the Worker budget increases by the minimum sufficient whole-KiB step to
733 KiB, leaving 538 bytes of headroom. The statically loaded client and parser-Wasm budgets are
unchanged.

## Profile 0.517 abbreviation-coercion size delta

Routing `abbreviate()` through the existing `as.character` generic adds no dependency, package
identity, network path, or host capability. A clean production build measures Worker JavaScript at
750,060 bytes (732.480 KiB) gzip, six bytes above Profile 0.516 and 532 bytes below the unchanged
733 KiB ceiling. The public client and combined parser-Wasm budgets remain unchanged.

## Profile 0.518 conditional-plot size delta

The numeric single-condition `graphics::coplot` slice reuses the shared graphics journal and moves
its pure interval/panel construction into a lazy Worker support chunk. A clean production build
measures the statically loaded Worker JavaScript at 750,774 bytes (733.178 KiB) gzip, 714 bytes
above Profile 0.517 and 182 bytes above the former 733 KiB ceiling. After extracting the reusable
numeric layout from the entry chunk, the explicit Worker budget rises by the minimum whole-KiB
increment to 734 KiB, leaving 842 bytes of headroom. The public client and parser-Wasm budgets are
unchanged.

## Profile 0.520 gamma-family bulk RNG

`rgamma`, `rchisq`, and `rexp` now defer `.Random.seed` publication until a complete vector has been
generated. Their outer loops use one cooperative checkpoint per 4,096 outputs, while rejection loops
retain an internal periodic checkpoint so adversarial parameters remain interruptible. The unchanged
invgamma examples fall from minutes to tens of seconds locally without increasing default limits.
Its deliberate ten-million-element draw uses the finite opt-in `large-browser` profile and an
explicit 100,000,000-step ceiling.

The bounded non-central Student-t quadrature is preloaded with the other Worker support assets but
is emitted as a lazy chunk, so later evaluation remains offline without charging this low-frequency
kernel to the initial Worker entry. A clean production build measures initial Worker JavaScript at
751,389 bytes (733.778 KiB) gzip, 227 bytes below the unchanged 734 KiB ceiling. The statically
loaded public client remains 19.6 KiB gzip and combined parser Wasm remains 671.9 KiB raw.

## Profile 0.521 Pearson and digest support chunks

The initial Pearson implementation raised Worker JavaScript to 736.0 KiB gzip, above the unchanged
734 KiB gate. The budget was not increased. An initial attempt to emit the whole `chisq.test`
wrapper as a support block was rejected by real-browser evidence: the generated block imported the
Worker entry, which would either leave an unresolved URL or instantiate a second runtime module.
`chisq.test` therefore remains statically linked to the one Worker semantic host.

The browser-owned core-package definitions and data resources contain no evaluator behavior or
runtime imports, so they now form a one-way startup module loaded in parallel with the parser and
other support assets. The independent MD5 kernel remains a self-contained startup-preloaded module.
Worker readiness awaits these imports; later R evaluation remains network-free and cannot observe a
partially initialized package registry. The Playground asset copier follows relative support-module
imports transitively and rejects any back-edge to `worker-entry-*`, making the one-runtime invariant
an executable build rule instead of a packaging assumption.

A clean production build measures initial Worker JavaScript at 693,458 bytes (677.205 KiB) gzip,
58,158 bytes below the unchanged 734 KiB ceiling. The statically loaded public client is 19.6 KiB
gzip and combined parser Wasm is 671.9 KiB raw. The browser bundle audit covers 40 JavaScript files,
and the production Playground passes all six Worker scenarios across Chromium, Firefox, and WebKit,
including the no-evaluation-network-traffic assertion.

## Profile 0.522 conditional-table simulation

The independently implemented AS 159 sampler remains in the existing statically linked Pearson path
and adds no Worker support chunk, network fetch, generated JavaScript, or host dependency. Its
log-factorial workspace and simulated tables are charged to the runtime allocation budget; setup and
replicate loops retain cooperative checkpoints, while deferred seed publication prevents a global
binding rewrite for every random draw.

A clean production build measures initial Worker JavaScript at 694,510 bytes (678.232 KiB) gzip,
57,106 bytes below the unchanged 734 KiB ceiling. The statically loaded public client remains 19.6
KiB gzip, combined parser Wasm remains 671.9 KiB raw, and the browser audit still covers 40
JavaScript files.
