# NativR

**Write R. Run JavaScript.**

> Experimental: NativR implements a small, explicitly documented R-compatible subset. It is not GNU
> R and does not run arbitrary R packages.

NativR is an independent, browser-native analytics runtime written in TypeScript. It parses
supported R source with Tree-sitter, normalizes that syntax into a NativR-owned AST, and interprets
it locally with explicit vector semantics. The default public API runs in a Web Worker and performs
no network access during evaluation.

## Quick start

Install from npm:

```sh
pnpm add @nativr/nativr
```

```ts
import { createR } from "@nativr/nativr";

const r = await createR();
const result = await r.eval(`
  x <- c(1, 2, 3, 4, 5)
  mean(x)
`);
console.log(result); // 3
await r.dispose();
```

### Load a source-only R package

Pure-R functions do not need TypeScript rewrites. Install the build-time package tool, then turn a
standard source directory or CRAN-like source package into a deterministic browser artifact:

```sh
pnpm add -D @nativr/package-tools
pnpm exec nativr-package install pkgconfig --output packages.json
```

```ts
import { createR } from "@nativr/nativr";
import packageSet from "./packages.json" with { type: "json" };

const r = await createR({ packages: packageSet.bundles });
await r.eval("library(pkgconfig)");
console.log(await r.eval('pkgconfig::get_config("unset", 42L)')); // 42
```

`install` reads the repository's source `PACKAGES` index, downloads the required `Depends`/`Imports`
closure, rejects unsafe or non-pure install surfaces, checks version constraints, and writes an
integrity-locked package set. To package a local source directory or `.tar.gz`:

```sh
pnpm exec nativr-package pack ./demo --output demo.nativr.json
```

Applications can also supply an audited bundle directly when the session is created:

```ts
const r = await createR({
  packages: [
    {
      description: "Package: demo\nVersion: 0.1.0\nNeedsCompilation: no",
      namespace: "export(twice_mean)",
      rSources: [
        {
          path: "R/twice-mean.R",
          source: "twice_mean <- function(x) 2 * mean(x)",
        },
      ],
    },
  ],
});

await r.eval("library(demo)");
console.log(await r.eval("twice_mean(c(1, 2, 6))")); // 6
console.log(await r.eval('readLines(system.file("DESCRIPTION", package = "demo"), n = 1)'));
// "Package: demo"
```

The loader supports isolated namespaces, dependency/import loading and version checks, package
metadata/source/resources through virtual `system.file()` paths, bounded `readLines()`, and
read-only `file()` connections, package `data/*.R`/text-dataset loading through `data()`, plus
exports, `pkg::name`, `pkg:::name`, S3 registrations, `.onLoad()`, `.onAttach()`, `library()`,
`require()`, and `requireNamespace()` in inline and Worker execution. Arbitrary pure-R source
packages can enter this pipeline, but that is not a claim that every package already executes: all
dependencies, data formats, namespace directives, and R features it uses must also be supported. The
unchanged public `pkgconfig 2.0.3` source package is the first pinned end-to-end external proof. See
the [complete bundle example](examples/pure-r-package.ts) and
[package-loading contract](docs/pure-r-packages.md).

### One-file browser example

Save this as `index.html` and serve it from any static web server. This CDN example uses inline
execution to avoid a build step; npm/bundler applications use the Worker-first default shown above.

```html
<!doctype html>
<button id="run">Run R</button>
<pre id="output">Loading NativR...</pre>
<script type="module">
  import { createR } from "https://cdn.jsdelivr.net/npm/@nativr/nativr@0.1.1/dist/index.js";

  const cdn = "https://cdn.jsdelivr.net/npm/@nativr/nativr@0.1.1/dist/";
  const r = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("web-tree-sitter.wasm", cdn),
      rGrammarWasm: new URL("tree-sitter-r.wasm", cdn),
    },
  });

  const run = document.querySelector("#run");
  const output = document.querySelector("#output");
  output.textContent = "Ready";
  run.onclick = async () => {
    output.textContent = JSON.stringify(await r.eval("mean(c(1, 2, 3, 4, 5))"));
  };
</script>
```

For an editable, persistent browser R console, open or copy the
[single-file HTML + JavaScript REPL](examples/browser-repl.html). It needs no framework or bundler.
The CDN is used only to load the package and Wasm assets; R evaluation itself remains local and
network-free.

The current milestone supports all 25 feature groups measured by the repository's package-usage
study, including structured data, the measured vector-helper surface, native and magrittr-style
pipes, registered namespaces, bounded object-system construction and dispatch, browser-safe
`print`/`cat` output, initial `head`/`str` inspection, strict recursive `identical` comparison, and
an initial condition/handler slice. It exposes 522 registered functions, including resettable
session options, deterministic non-interactive host-mode detection, and vectorized decimal rounding
plus real/complex logarithm and exponential semantics. Browser-memory `read.table`/`read.csv`/
`read.delim` and `write.table`/`write.csv` paths provide quoted text-table interchange without host
filesystem access. Data-mask and local-environment evaluation preserve result visibility, while
`all.equal` provides bounded tolerant recursive comparison and `ifelse` provides lazy vectorized
branch selection. Missing-aware `any`/`all` logical summaries cover atomic and list inputs, while
`subset` provides lazy vector/list/matrix/data-frame selection expressions. Environment removal,
core value reversal, cumulative numeric summaries, function-exit cleanup, `AsIs` class marking,
closure-body inspection, and recursive list flattening extend the frequency-ranked surface. Closure
`formals` inspection and lazy repeated evaluation through `replicate`, real-vector `floor`, grouped
`split`, factor-pattern generation through `gl`, and bounded data-frame joins through `merge` follow
the same measured priority data. List/data-frame mutation through `within` and vectorized
real/complex `sin` continue that frequency-ranked sequence. Numeric-order factor coercion through
`as.factor` and grouped transformation through `ave` are the next completed entries from the same
ranking. Vectorized UTC/GMT construction through `ISOdate` and Cartesian data-frame generation
through `expand.grid` are the next completed pair. Type-promoting insertion through `append` and
vectorized real/complex `cos` follow, with stable `intersect`, `setdiff`, and `union` completing the
next measured family and parallel minimum selection through `pmin` following it. The
frequency-ranked model path now includes `lm`, `aov`, treatment-coded model matrices, prediction and
accessors, while `IQR` and all nine `quantile` algorithms cover the next isolated
descriptive-statistics entry. Central Student-t probabilities and quantiles now support weighted QR
covariance, `vcov`, `confint`, and residual degrees of freedom for that model path. Usage-ranked
`kmeans` adds an independently implemented browser-native clustering path with explicit or
session-random initial centers and the documented Hartigan-Wong, Lloyd/Forgy, and MacQueen algorithm
choices. Circular, open, and filtering convolution now follows the same ranking through an owned
complex radix-2/Bluestein Fourier backend. Usage-ranked hexadecimal integer modes add validated
numeric/character construction, signed 32-bit formatting, class-preserving subsetting, printing, and
bitwise operations. Environment-to-list conversion now follows the same usage ranking with local
binding enumeration, hidden-name and ordering controls, lazy-promise forcing, and S3 dispatch.
Browser host-capability reporting follows with GNU R's named selection shape and deterministic
`FALSE` values for unavailable graphics, profiling, network, and native facilities. Usage-ranked
`kappa` adds owned QR-based estimates, exact 2-norm condition numbers, direct one-/infinity-norm
paths, triangular controls, and `qr`/`lm` S3 methods without a host linear-algebra dependency. The
next measured callable, `xtabs`, now cross-tabulates formula-selected factor, character, and numeric
axes with weighted or matrix responses, subsets, missing-value controls, and GNU R-shaped table
metadata. Usage-ranked `RNGkind` now covers the sampled kind-query surface, default
Mersenne-Twister/Inversion selection, and both discrete samplers; the fixed-seed uniform sequence
has black-box GNU R evidence. Rank-296 `sample.int` then adds the exact fixed-seed integer-sampling
path used by `withr`, including `.Machine$integer.max`, replacement, no-replacement, hash, weighted,
and large-population modes. The next usage-ranked locale slice adds session-local `Sys.getlocale`,
`Sys.setlocale`, and `Sys.localeconv` behavior for the deterministic C profile and the
`it_IT`/`en_US` monetary profiles observed in `withr`, without reading host locale state. Rank-303
`tan` then runs the expressions observed in `testthat` and `data.table`, backed by the base `pi`
constant and vectorized real/complex, missing-value, metadata, and non-finite warning semantics.
Rank-304 `make.names` now runs tibble's measured formula-based custom name repair with GNU
R-compatible C-locale syntax, reserved-word, underscore, missing-name, and uniqueness rules.
Rank-305 `start` adds row-based and regular-time-series origin coordinates, `ts.eps` grid
recognition, negative periods, decimal fallbacks, and package-defined S3 method dispatch. Rank-307
`as.roman` runs pillar's measured `utils::as.roman(seq_len(nrow(x)))` row-identifier path with
integer-backed Roman values and canonical character formatting. Rank-308 `as.POSIXlt` now runs
testthat's measured `as.POSIXlt(Sys.time())`/`length()` path and zoo's month-day extraction with an
owned 11-component POSIXlt representation, UTC/GMT calendar decomposition, fractional seconds,
missing values, and S3 dispatch. Rank-309 `drop` now runs matrixStats' singleton-set validations and
posterior's explicit rvar array reduction while preserving surviving dimension names, custom
classes, and non-shape attributes. Rank-310 `rasterImage` now runs the measured systemfonts
`nativeRaster` and httr RGB(A)-array shapes through device-independent Worker graphics events, with
`plot.new`/`plot.window` state and a real Playground canvas renderer. Every claim has an explicit
boundary. Rank-311 `weights` now supplies the GNU R `stats` generic, list/pairlist default component
lookup, `na.exclude` restoration, weighted/unweighted `lm` access, and package-owned S3 method
dispatch for the measured `loo` and `posterior` call shapes. NativR does not reproduce those
packages' methods; it provides the generic protocol they extend. Rank-313 `colours` now runs scales'
measured catalog call through the complete ordered 657-name GNU R 4.6.0 catalog, including the
502-name `distinct = TRUE` result, the `colors` alias, and registered `grDevices::` lookup. Rank-314
`outer` now runs scales' measured radial-matrix expression and covers vector/array Cartesian
products, concatenated dimensions and dimension names, character or callable `FUN`, lazy forwarded
dots, and the `%o%` operator. Rank-316 `nzchar` now runs data.table's captured-group converter and
Shiny's nonempty-input guard, with atomic/list coercion, `keepNA`, primitive argument boundaries,
and attribute-free logical results. Rank-317 `density` now supplies the S3 generic boundary needed
by posterior and distributional plus a bounded, independently implemented Gaussian numeric default
with grids, weights, missing-value removal, and the `nrd0` bandwidth selector. Rank-319 `setequal`
now covers base vector/factor/list set equality and dplyr's two measured data-frame row-set
examples; tibble row selection retains its non-dropping class behavior. Rank-322 `eigen` now runs
jsonlite's measured 3-by-3 decomposition through independent symmetric Jacobi and bounded asymmetric
real/complex eigenpair paths. Rank-325 `colSums` now runs loo's two fold-table totals and zoo's
non-missing-column mask, with logical/integer/double/complex arrays, numeric data frames, `na.rm`,
generalized `dims`, and retained output names. Rank-326 `time` now runs data.table's decade-spaced
`uspop` coordinates and supplies the S3 boundary for zoo's 24 package-owned index calls, with
regular-series offsets, integer snapping, and `tsp`/`ts` result shape. Rank-327 `na.omit` now runs
the eight measured data.table and zoo calls through package-owned S3 methods while supplying an
independent default for atomic vectors, factors, matrices, data frames, and regular time series. It
removes both `NA` and `NaN`, preserves row-oriented shape metadata, and records GNU R-shaped
`na.action` positions and labels. Rank-328 `ceiling` now runs the measured data.table exponential
sample conversion and zoo tick-alignment helper with real-vector/array rounding, missing/non-finite
values, attribute retention, and direct or Math-group S3 method boundaries. Rank-331 `approx` now
runs data.table's date-sequence interpolation and zoo's Date-coordinate helper through registered
`stats::` access, with linear/constant methods, endpoint rules, generated grids, missing-value
handling, duplicate-coordinate reducers, and preservation of an explicitly supplied `xout`
coordinate shape. Rank-334 `standardGeneric` now runs S7's measured standard S4 generic definition
shape through the bounded session-local class/generic/method registry, including defaults, dots,
`ANY`, and call-context errors. Rank-335 `colorRampPalette` now runs isoband's two measured 21-color
Viridis palette calls through registered `grDevices::` access. The returned first-class palette
function uses independent linear RGB or CIE Lab interpolation with bias and alpha controls; the
measured Lab output matches GNU R byte-for-byte. Rank-336 `sink` is explicitly deferred until the
browser connection/filesystem adapter exists; rank-337 `sessionInfo` now runs otel's measured
`utils::sessionInfo()$platform` path with an owned, deterministic browser-platform descriptor,
target R version, locale, RNG kinds, attached core packages, and a classed GNU R-shaped result.
Rank-338 `as.ordered` now runs generics' measured `as.ordered(letters[1:5])` example through the
existing owned factor representation, with ordered-factor identity, unused-level removal, names, and
package-defined S3 forwarding. Rank-339 `as.array` now supplies rstan's measured package-method
extension point: class-specific methods receive the original object and lazy dots, while
`as.array.default` adds a one-dimensional extent to atomic vectors, lists, factors, and pairlists,
promotes vector names to dimension names, preserves unrelated attributes, and returns existing
arrays unchanged. Rank-341 `nlm` now runs rstan's measured analytic-gradient objective shape through
registered `stats::` access, lazy forwarded objective arguments, finite-difference or supplied
derivatives, bounded BFGS minimization, optional Hessians, and GNU R-shaped convergence results.
Rank-342 `optim` now runs rstan's separate objective/gradient BFGS example with named and scaled
parameters, lazy forwarded arguments, numerical-gradient fallback, optional Hessians, call counts,
and GNU R-shaped convergence results. Rank-343 `pairs` now supplies rstan's measured `pairs.stanfit`
S3 extension point with lazy plotting arguments, while the broader default scatterplot-matrix device
remains explicit future graphics work. Rank-344 `heat.colors` now provides the measured `grDevices`
sequential palette with deterministic hexadecimal output, optional alpha, reversal, numeric count
coercion, and empty-result boundaries. Rank-354 `factorial` now runs xfun's measured `factorial(10)`
example and extends it with vectorized integer and non-integer gamma values, missingness, non-finite
boundaries, warnings, and attribute retention. Rank-359 `lsfit` now runs xfun's measured
least-squares example through the owned QR solver, with matrix predictors, weights, intercept
control, complete-case handling, rank metadata, and explicit multi-response boundaries. Rank-361
`strwrap` now runs xfun's measured paragraph-wrapping example with vectorized text, paragraph
boundaries, prefixes, indentation, sentence spacing, and simplified or list-shaped results. Rank-360
`shQuote` remains browser host-shell adapter work. A ranking audit also closed the earlier rank-207
`rgb` gap, and rank-366 `col2rgb` now runs stringr's measured named-color-to-hex helper across the
complete owned color catalog, numeric palette indices, hexadecimal alpha forms, transparent values,
matrix metadata, and reverse RGB formatting. Rank-368 `simplify2array` now runs stringi's two
measured list-shape examples, with scalar/vector simplification, common-type promotion, list
matrices, retained names and higher-dimensional array metadata, and explicit exception controls.
Ranks 376/377 `str2expression` and `str2lang` now parse backports' measured source strings through
the owned Tree-sitter/normalized-AST path into NativR expression, language, symbol, and atomic
values. The source-bundle loader now supplies private-namespace lookup, although backports itself is
not yet a verified compatible package. Rank-378 `utils::URLdecode` now runs backports' direct
percent-decoding example with vectorized ASCII and UTF-8 byte decoding, deterministic missing/empty
handling, and explicit browser-string boundaries for malformed byte input. Rank-379
`warningCondition` now runs backports' measured custom-condition construction and covers owned
message/call/additional-field lists, custom class prefixes, condition-message extraction, and the
class-selective suppression call shape. Ranks 382/383 `stats::qbinom` and `stats::qnorm` now run
openssl's measured uniform-to-binomial and uniform-to-normal transforms through owned,
browser-native quantile algorithms, including vectorized distribution parameters, tail/log
probabilities, recycling, metadata, and explicit numeric bounds. Rank-384 `rawToBits` now runs
openssl's measured random-byte bit expansion with GNU R's least-significant-bit-first order over the
owned raw vector model. Ranks 385/386 `rowMeans` and `colMeans` now run matrixStats' measured
matrix-subset validation paths and cover generalized array dimensions, numeric data frames, complex
values, missing-value removal, retained axis names, and empty reductions. Rank-387
`stats::weighted.mean` now runs matrixStats' six reference comparisons with numeric/complex weights,
zero-weight omission, missing-value rules, non-finite results, and S3 dispatch. Rank-388
`stats::mad` now supplies matrixStats' two reference values plus center/constant controls, ordinary,
low, and high medians, missing-value removal, and strict real-numeric boundaries. Rank-391
`stats::rbeta` now runs loo's two measured beta-posterior calls with recycled central/non-central
parameters, deterministic session RNG state, stable log-gamma ratios, limit distributions, and
missing/invalid argument handling. Rank-392 `stats::dbinom` now completes the same loo example's
vectorized log-likelihood call with recycled parameters, stable log probabilities, metadata, missing
values, and GNU R-shaped domain warnings. Rank-393 `base::mat.or.vec` now runs loo's measured
`mat.or.vec(10, 3)` scratch-matrix allocation with double zero storage, vector-versus-matrix branch
behavior, truncated nonnegative extents, zero-sized dimensions, and explicit invalid-input
boundaries. Rank-395 primitive `base::seq.int` now runs data.table's three rolling-window index
calls, with one-argument length semantics, ascending/descending steps, `length.out`/`along.with`,
integer/double result selection, S3 `seq` dispatch, and finite allocation guards. Rank-396
`methods::as` now runs data.table's measured IDate and ITime conversion checks through a
session-local `setAs` registry. Explicit source-class inheritance, identity coercions, core
`as.<Class>` constructor fallback, namespace access, invisible registration, and bounded errors are
covered. NativR supplies the package-extension mechanism; it does not claim to bundle or support
data.table's classes and methods. Rank-402 `weekdays` then runs data.table's two measured IDate
labeling calls through the inherited `Date` method, with deterministic C-locale names, recycled
abbreviation controls, UTC/GMT POSIXt support, custom S3 dispatch, names, missing/non-finite values,
and explicit invalid-input boundaries. Rank-403 `write.table` remains deferred pending a
browser-owned connection/filesystem adapter. Rank-404 `anyDuplicated` now supplies the S3 generic
and default/data-frame methods used by data.table's measured `by = c("A", "B")` duplicate-row check,
with first-position results, reverse scans, missing-value distinctions, incomparables, factors,
lists, frames, names, and package-defined methods. Rank-408 `rep.int` now runs data.table's measured
adaptive-window tail construction with scalar or element-wise counts, numeric coercion, attribute
removal, factor metadata, atomic/list/expression results, S3 methods, and allocation guards.
Rank-409 `methods::representation` now runs data.table's measured legacy S4 slot declaration,
returning the validated parent/slot list consumed by `setClass`; duplicate declarations, missing
arguments, backtick slot names, and class-string boundaries have differential evidence. Rank-410
`trunc` now supplies the direct and Math-group S3 extension seam used by data.table's measured
`trunc(seqtimes, "hours")` call, plus owned toward-zero real-vector behavior, retained attributes,
eager default dots, and bounded type/missingness errors. Rank-411 `utils::type.convert` now runs
data.table's measured split-column conversion with recursive list/data-frame methods and an owned
logical, integer, double, complex, character, and factor inference ladder. Rank-414 `withVisible`
now captures Shiny's measured visibility-control call shape, including lazy forwarded and
already-forced promise distinctions. Rank-419 `strftime` now formats Shiny's measured log timestamp
through deterministic UTC/GMT and C-locale semantics, including recycled formats, fractional
seconds, names, non-finite values, timezone labels, and custom `as.POSIXlt` dispatch. Rank-420
`as.raster` now converts ragg's measured capture matrix plus grayscale and RGB(A) inputs into owned,
row-first raster values that feed the existing browser RGBA command path. Rank-421 `dev.flush` and
its paired `dev.hold` now implement nested browser-device hold levels: graphics commands remain
bounded and private across evaluations until the level returns to zero, then reach the host in their
original order. This covers the measured ragg animation call shape without claiming ragg's file
device, WebP encoding, or complete high-level plot methods. Rank-422 `recordPlot`/`replayPlot` now
captures and replays that owned page/window/raster display list for ragg's measured same-session
call shape, including hold/flush integration and bounded command/raster storage. External GNU R
recorded-plot formats, package reloading, `print.recordedplot`, and general graphics devices remain
outside this increment. Rank-423 `stats::ppoints` now runs posterior's two measured
`quantile(x, ppoints(10))` examples with documented default offsets, observation-vector lengths,
numeric/complex offsets, recycling and attributes, lazy nonpositive results, and bounded allocation.
Rank-424 `chol` now supplies posterior's measured `rvar` S3 method seam plus an independently
implemented upper-triangular real-matrix default with optional positive-semidefinite pivot/rank
metadata, data-frame coercion, dimnames, lazy dots, and explicit non-finite/shape/defunct-control
boundaries. Rank-425 `stats::pnorm` now runs posterior's measured vectorized-mean probability
example with recycled `q`/`mean`/`sd`, lower and upper tails, attributes, point-mass and
missing/domain boundaries, and stable far-tail log probabilities computed without host statistics
libraries. Rank-426 `stats::rgamma` now runs posterior's measured scalar rate/shape examples through
the session-owned gamma sampler, with vectorized parameters, rate/scale equivalence, moments,
degenerate limits, warnings, and deterministic reseeding. Rank-427 `graphics::segments` now runs
posterior's measured vertical credible-interval call through a Worker-safe vector graphics event,
including endpoint defaults, recycled coordinates/styles, missing-value omission, Canvas rendering,
and same-session record/replay. Rank-428 `utils::glob2rx` now runs rprojroot's measured
`glob2rx("DESCRIPTION")` file-pattern call, with vectorized wildcard translation, documented
head/tail trimming, ordinary R coercion, dropped attributes, namespace access, and bounded output.
Rank-429 `sQuote` now runs httr's two measured request-URL logging calls with deterministic ASCII
defaults, explicit UTF-8/TeX/custom styles, owned-value coercion, and session-option integration.
Rank-430 `stats::family` now provides distributional's measured `family(dist)` S3 extension seam,
including lazy dots, class-order/`NextMethod`/default dispatch, and explicit package-method
boundaries. Rank-431 `utils::View` now maps rstudioapi's measured terminal-context call shape to a
bounded, character-formatted data-view event available identically in inline and Worker execution;
the Playground renders those events as read-only tables without importing a DOM into the runtime.
Rank-433 `path.expand` now runs diffobj's measured home-path expression under an explicit
browser-without-a-home-directory contract, while the higher-reach `file.path` dependency provides
vectorized, deterministic path-string construction without consulting a host filesystem. Rank-434
`methods::setOldClass` now runs diffobj's measured `zulu` S3/S4 guides-method registration and links
declared old-class inheritance into the bounded single-object S4 dispatch and coercion paths.
Rank-435 `methods::show` now provides diffobj's measured style-display extension seam with inherited
method lookup, method-result visibility, and bounded default text output. Rank-436
`utils::capture.output` now runs httpuv's measured request-inspection expression through a nested,
resource-bounded in-memory output capture, with visible-result printing, partial-line handling,
message selection, split output, and bounded browser-memory file/connection targets. Host filesystem
targets remain an explicit boundary. Rank-437 `utils::demo` reproduces the empty package-demo
catalog shape while making external package demo discovery and execution an explicit
package-resource boundary. Rank-438 `RNGversion` runs zoo's measured R-3.5 reproducibility setup by
selecting the historical Rounding sampler before `set.seed`; pre-R-1.7 generator families remain
explicit boundaries. Ranks 439-443 add the regular time-series foundation: `ts()` constructs vector
or matrix series, `as.ts()` and `frequency()` expose their sampling metadata, and `window()` slices,
downsamples, or explicitly extends them. These generics also forward to independently supplied
methods such as `window.zoo`; NativR does not claim that zoo itself is bundled or compatible yet.
Rank 444 `graphics::legend` now runs zoo's three measured line/point legend shapes through a bounded
Worker graphics event and the Playground Canvas renderer, including keyword/coordinate placement,
colors, columns, titles, invisible geometry results, and same-session record/replay. General base
graphics, arbitrary graphical parameters, and device-identical layout remain explicit boundaries.
See the
[compatibility contract](https://github.com/nativr/nativr/blob/main/docs/compatibility-contract.md)
for exact boundaries.

Rank 445 `comment` and its replacement form now run zoo's measured metadata example. Owned vectors,
arrays, lists, pairlists, and data frames can query, set, replace, or remove character comments
while preserving their other attributes; the future general attribute model is still required before
closures, environments, and language objects can receive comments.

Rank 446 `stats::cycle` now runs zoo's two measured regular-series call shapes through a GNU
R-compatible default and an S3 extension seam. It derives observation cycles from validated `tsp`
metadata for vectors and matrix rows, including fractional frequencies, while leaving zoo's
irregular-series method and index model package-owned.

Rank 447 `signif` now runs zoo's two measured plot-limit calculations. Real and complex vectors use
1–22 rounded significant digits with decimal ties-to-even behavior, recycled controls, retained
metadata, and direct or Math-group S3 extension seams.

Rank 448 `graphics::axTicks` now runs zoo's measured linear secondary-axis tick lookup. It derives
horizontal or vertical tick locations from the owned `plot.window` state, also supports explicit
`axp` parameters and reversed axes, and keeps logarithmic axes as an explicit compatibility
boundary.

Rank 449 `graphics::box` now runs zoo's measured plot-frame redraw. Plot-region frames support all
documented `bty` edge shapes, resolved `col`/`fg`, line types and positive widths, invisible return
semantics, Worker transport, Canvas rendering, bounded display-list record/replay, and explicit
boundaries for figure and margin regions that need a future layout model.

Rank 450 `graphics::boxplot` now runs zoo's measured grouped-series example. The owned default
computes Tukey hinges, whiskers, notches, and outliers for numeric vectors, lists, and matrix
columns; returns GNU R-shaped statistics invisibly; forwards classed inputs through S3; and carries
resolved boxplot commands through the Worker, Canvas renderer, output budget, and display-list
record/replay path. Formula/data-frame methods, logarithmic axes, arbitrary `pars`, axis annotation,
and device-identical layout remain explicit boundaries.

Rank 451 `stats::deltat` now runs zoo's measured regular-series sampling-interval call. The generic
forwards classed values and lazy dots to package methods, while its owned default returns the
reciprocal of validated `tsp` frequency or one for ordinary inputs. Zoo's irregular index, `zooreg`
construction, and package-owned methods require an audited bundle plus additional runtime support.

Rank 452 `stats::embed` now runs zoo's documented lagged-window building block `embed(1:5, 3)`. It
returns column-major current-to-past windows for supported vectors and multivariate matrices,
preserves vector storage, applies GNU R's matrix coercions, removes source attributes, and accounts
for the complete result before allocation. This is directly reusable by pure-R rolling-window code;
factor/data-frame inputs, expression vectors, list matrices, and fractional dimensions on nonempty
matrices remain explicit GNU R-aligned boundaries.

Rank 453 `base::findInterval` now runs zoo's irregular-date rolling-window width expression
`seq_along(tt) - findInterval(tt - 3, tt)`. A bounded binary search supports duplicate and infinite
breakpoints, missing queries, the documented closure/inside controls, flattened numeric coercion,
and attribute-free integer output. Unchecked unsorted/missing break vectors and recursive-list
coercion remain explicit unsafe or unsupported boundaries.

Ranks 454-455 add the shared `grDevices` gray-color surface used by zoo:
`gray.colors(2, start = 0.7)` and `grey(7:1/8)`. The `gray`/`grey` and `gray.colors`/`grey.colors`
aliases now produce deterministic uppercase RGB(A) bytes, including gamma-corrected palettes, alpha
recycling, reversal, descending endpoints, and bounded output. General color spaces, device
profiles, and the remaining palette families stay separate.

Rank 456 `base::ISOdatetime` now runs zoo's five-value POSIXct index constructor with ordinary
component recycling, fractional seconds, explicit UTC/GMT labels, class metadata, invalid-calendar
missingness, and pre-allocation limits. Its documented default `tz = ""` is computed as
deterministic UTC in the browser while retaining the empty `tzone` label; regional time zones and
daylight-saving databases remain explicit future work.

Rank 457 `graphics::persp` now runs zoo's documented classed `100 × 10` numeric-matrix surface. The
owned generic preserves package-defined S3 methods; its default validates ascending grids, computes
the documented invisible `4 × 4` view transform for scaled or aspect-preserving views, and projects
the default white/black wireframe plus bounding box into bounded Worker-safe line events rendered by
the Playground. Filled facets, lighting, detailed ticks/text, hidden-line equivalence, and arbitrary
graphical parameters remain explicit graphics-depth work.

Rank 458 `graphics::points` now supplies zoo's documented S3 plotting extension point and an owned
default for real coordinate vectors, two-column matrices, data frames, complex coordinates, and
`list(x, y)` inputs. Numeric plotting symbols 0:25, ASCII/Unicode characters, recycled
`pch`/`col`/`bg`/`cex`/`lwd`, missing-point omission, invisible results, bounded display-list
replay, Worker transfer, and Canvas rendering share one host-neutral point command. Line/path
`type`s, coordinate classes beyond owned numeric storage, clipping/log axes, font identity, and
arbitrary graphical parameters remain explicit boundaries.

Rank 459 `graphics::polygon` now runs zoo's measured filled-area panel helper. The owned default
accepts paired vectors, two-column matrices/data frames, complex coordinates, and `list(x, y)`;
missing coordinates split independent closed polygons, while recycled fill/border colors, line
types/widths, `fillOddEven`, solid fills, and `density = 0` resolve into a bounded Worker command.
The same command supports held graphics, display-list replay, and Canvas rendering. Hatch-pattern
density, coordinate classes beyond owned numeric storage, clipping/log axes, exact device dash
metrics, and arbitrary graphical parameters remain explicit boundaries.

Rank 460 `base::replace` now runs zoo's measured missing-run fill helper through NativR's existing
immutable `[` replacement engine. It covers numeric/logical/character subscripts, ordinary
recycling, names and extension, atomic type promotion, matrices, factors, lists, pairlists, owned
data frames, `NULL` materialization/deletion, partial argument matching, input immutability, and
resource limits. Expression vectors, arbitrary class-specific `[<-` methods, and exact legacy
diagnostic wording remain explicit boundaries.

Rank 461 `stats::rlnorm` now runs zoo's measured 200-value log-normal flow generator. It uses the
session-owned Mersenne-Twister/Inversion stream, matches the pinned historical fixed-seed sequence,
follows scalar-or-vector `n` sizing, recycles vectorized `meanlog`/`sdlog`, preserves zero-deviation
point masses without advancing the RNG, drops input metadata, and emits one bounded missing/domain
warning. Alternative normal generators, bit identity beyond the documented Inversion path, and the
rest of the log-normal density/CDF/quantile family remain explicit boundaries.

Rank 462 `base::tapply` now runs zoo's measured screen-range grouping path. It accepts one or more
same-length atomic grouping vectors, preserves factor levels as array dimensions and dimnames, omits
missing groups, forwards `...`, resolves functions or function names, returns group codes for
`FUN = NULL`, simplifies scalar atomic results with a typed `default`, and otherwise returns
indexable list arrays. Formula indexes, custom split methods, and broader class-specific
simplification remain explicit boundaries.

Rank 463 `graphics::text` now runs zoo's measured rotated outside-label call through the Worker
graphics protocol and Playground Canvas renderer. It supports S3 dispatch, R coordinate containers
with x/y recycling, character-label coercion and truncation warnings, missing omission, recycled
colors/sizes/font faces/positions, adjustment, offset, rotation, browser font families, namespace
access, bounded graphics accounting, and same-session recording/replay. Plotmath expressions,
Hershey fonts, class-specific label coercion, clipping/log axes, and device-identical text metrics
remain explicit boundaries.

Rank 464 `stats::update` now exposes the S3 extension seam used by zoo's documented
`update(trellis.last.object(), type = c("l", "g"))` call. It preserves lazy `...`, dispatches across
inherited classes and `NextMethod`, permits independently authored `update.default` methods, and
works through direct and namespace-qualified calls. NativR does not include lattice's package-owned
`update.trellis` method; the built-in `update.default` stored-call rewriting and re-evaluation path
remains an explicit boundary.

Rank 465 `graphics::matplot` now runs bit64's measured matrix-performance plots through the Worker
graphics path. It accepts one- or two-argument numeric vectors, matrices, and data frames; cycles
matrix columns and point/line styles; omits incomplete pairs; supports point, line, both,
overplotted, and no-draw series; resolves x/y logarithmic coordinates; opens bounded pages and
windows; and records/replays the resulting box, segment, and point commands. Full axes and
annotations, class-specific `lines` methods, `add = TRUE`, step/histogram series, and
device-identical layout remain explicit boundaries.

Rank 470 `base::aperm` now runs bit64's measured matrix-axis swap and supplies the S3 extension seam
needed by pure-R array classes. The independently authored `aperm.default` handles numeric and named
axis permutations, reverse-axis defaults, dimension/dimname resizing, `resize = FALSE`, atomic and
list arrays, lazy dots, inherited dispatch, and `NextMethod`. Table-specific methods, invalid
low-level attribute shapes, exact diagnostics, and long-vector storage remain explicit boundaries.

Rank 471 `base::dget` now runs bit64's measured `dput`/`dget` serialization roundtrip together with
the higher-reach `tempfile` and `unlink` prerequisites. Temporary paths use a bounded, session-local
`nativr://session-temp/...` text store: no host files are read or written. The independent
serializer round-trips owned atomic vectors, lists, pairlists, names and ordinary attributes,
including bit64's classed double column; `NA`, `NaN`, infinities, complex, raw, and Unicode values
have differential coverage. Host paths and connections, arbitrary `dput` controls,
closures/environments, cyclic values, binary serialization, and cross-session persistence remain
explicit boundaries.

The same browser-memory resource seam now supports `save()`/`load()` workspace round-trips for owned
values. The bit64-observed `save(e, file); rm(e); load(file)` shape, explicit object lists, target
environments, duplicate names, verbose output, return visibility, and format rejection have
executable coverage. The archive is NativR-owned canonical source, not a GNU R `.RData` binary or a
host file.

The usage-ranked `file`, `close`, `tempdir`, and `file.exists` foundation now exposes bounded,
session-owned connection handles over that same browser-memory store and immutable package files.
Implicit and explicit opening, read/write/append modes, persistent cursors, `seek`, `flush`,
`isOpen`, `summary`, destruction, and connection-aware `readLines`, `writeLines`, `cat`, and
`capture.output` have GNU R 4.6 differential coverage. Compressed, URL, socket, host-file, and raw
binary connections remain explicit boundaries.

Measured rank 22 `plot()` now supplies the high-reach S3 extension point used by package-defined
`plot.<class>` methods and a bounded browser-native numeric default. One-argument vectors and paired
x/y data support point, line, both, overplotted, histogram, step, and no-draw types; finite ranges,
common point/line styles, panel hooks, scalar character labels, Worker transport, Canvas rendering,
and display-list replay reuse the existing graphics path. Complete axes/tick labels, logarithmic and
fixed-aspect layouts, formula/function/time-series/raster methods, clipping/margins, and
device-identical output remain explicit boundaries.

Development priority is based on a reproducible analysis of documented usage in popular CRAN
packages. The committed
[priority report and figures](https://github.com/nativr/nativr/blob/main/docs/feature-priorities.md)
show the data, method, limitations, and current status of all 25 measured feature groups.

Pure-R package loading now has an initial executable vertical slice; it is not a blanket CRAN
compatibility claim. Source-only bundles can reuse supported R code without TypeScript rewrites, but
a package still works only when every dependency and R feature it uses is supported. Compiled/native
packages need separately audited Wasm or host adapters. See the
[pure-R package loading contract](docs/pure-r-packages.md).

Source releases are managed with Changesets. npm publication uses GitHub Actions trusted publishing
without a long-lived registry token; see the
[release guide](https://github.com/nativr/nativr/blob/main/docs/releasing.md).

## Development

Use Node 24 and pnpm 11.

```text
pnpm install
pnpm grammar:build
pnpm check
pnpm dev
```

The repository is a pnpm workspace:

```text
R source -> @nativr/parser -> normalized @nativr/ast
                                  |
                                  v
                  @nativr/runtime <- @nativr/base
                                  |
                                  v
                  @nativr/nativr Worker API -> playground
```

NativR intentionally does not perform package installation inside the browser and does not yet
implement complete GNU R/package semantics, the complete graphics-device/base-graphics stack,
host-filesystem access, or runtime network access. Semantic limits and planned directions are
documented in the [roadmap](https://github.com/nativr/nativr/blob/main/docs/roadmap.md).

This Apache-2.0 project follows an independent clean-room policy. It is not affiliated with or
endorsed by the R Foundation, Posit, OpenAI, or R package authors. No official R branding is used.

## License

Apache License 2.0. Third-party notices are in
[`NOTICE`](https://github.com/nativr/nativr/blob/main/NOTICE).
