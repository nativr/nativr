# Performance and bundle discipline

The JavaScript reference backend uses typed arrays and tight loops. It is a correctness baseline,
not a final optimized kernel. `pnpm benchmark` measures short parse/evaluation, scalar arithmetic,
100,000-element mean, typed assignment, and raw snapshots after a build.

Budgets:

- statically loaded public client: 150 KiB gzip;
- Worker JavaScript: 308 KiB gzip;
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
