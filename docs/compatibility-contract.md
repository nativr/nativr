# Compatibility contract

NativR reports five evidence levels: parse, API, result shape, numeric, and behavioral. A function
is never described beyond the highest level covered by automated tests or conformance cases.
Capabilities are versioned by NativR semver and `languageSubsetVersion`; protocol changes have their
own version.

The current bounded contract is not complete GNU R compatibility. The broader completion boundary
and black-box inventory are tracked in the [GNU R compatibility ledger](gnu-r-compatibility.md).

## Measured feature surface

All 25 feature groups in the package-usage study have a supported executable surface. Here,
**supported** means that every operator or function name recognized by that group's detector has an
acceptance case in [`feature-priority.test.ts`](../packages/nativr/test/feature-priority.test.ts).
It does not mean complete GNU R or arbitrary package compatibility.

| Area                                  | Evidence boundary                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| comparisons and logical operators     | vector recycling, three-valued logic, scalar short circuit                          |
| `[`, `[[`, `$`, and replacement       | vectors/lists, recursive extraction, arbitrary-dimensional arrays, and data frames  |
| conditionals, return, and loops       | lexical control frames under evaluator resource limits                              |
| lists, names, and attributes          | normalized immutable value model and documented attributes                          |
| sequences and repetition              | `:`, `seq*`, scalar/vector `rep`, and `rep_len`                                     |
| pipes and formulas                    | native and magrittr-style calls; normalized formula IR                              |
| frames, matrices, arrays, and factors | constructors, dimensions, selection, and core metadata                              |
| strings, sorting, matching, and apply | every measured helper name with bounded argument support                            |
| statistics and random numbers         | every measured function name; NativR-owned numeric algorithms                       |
| dates and times                       | deterministic ISO/UTC subset plus explicit host-clock functions                     |
| namespaces and ellipsis               | registered namespaces and lazy forwarding, including named formals after `...`      |
| quoted language                       | normalized symbols/calls plus bounded `quote()` and `eval()`                        |
| object systems                        | S3 dispatch, bounded S4 registration, R6 construction, and vctrs class construction |

The generated machine-readable declaration is
[`compatibility-manifest.json`](compatibility-manifest.json). `pnpm capabilities:check` verifies it
against the runtime capability source after a build.

## Exact boundaries

Indexing accepts positive, negative, zero, logical, truncated double, and exact character
subscripts. `[[` supports a recursive numeric or character path plus unique partial character
matching through `exact = FALSE` or warning-producing `exact = NA`. `$` uses exact names before GNU
R's default unique partial match. One-dimensional `[<-` and `[[<-` extend atomic vectors and lists
for positive, long logical, or new character-name subscripts, filling intervening atomic positions
with typed missing values and list positions with NULL. Existing names are extended, new character
names are created, and dimensions are dropped when linear extension invalidates them. Missing
numeric/logical positions are skipped only for a length-one replacement. Missing character
replacement names remain outside the current value-model boundary. Arrays support
arbitrary-dimensional column-major extraction and replacement, including one-dimensional array
names, strict per-axis bounds, non-finite numeric coercion warnings, zero-length selections, `drop`,
dimension names, and named dimension axes. Numeric and character coordinate matrices select or
replace one array element per matrix row, including zero-row omission and missing-coordinate
behavior. Data-frame selection and replacement support missing row/column positions, `drop`,
common-type coordinate-matrix extraction, and numeric coordinate-matrix replacement. Character,
missing, and zero-coordinate data-frame replacement matrices retain GNU R's rejection behavior.
Simple one-dimensional `$`, `[`, and `[[` replacement chains rebuild their containing lists or
data-frame columns, support non-local rebinding and missing `$` intermediates, and preserve GNU R's
repeated evaluation of intermediate subscripts. Global partial-match warning options,
multidimensional intermediate replacement targets, nested replacement-function calls, and
rectangular pairlist replacement remain outside the current contract. Direct or nested list and
data-frame-column replacement with NULL deletes the selected component. One-dimensional data-frame
replacement appends consecutively positioned or named columns, recycles scalar columns, distributes
atomic replacements column-major, and rejects numeric gaps. Rectangular data-frame replacement
extends numeric or character-named rows, fills intervening cells with each column's missing
representation, updates row names, and can create a row and column together. Logical row overrun and
every missing row subscript retain GNU R's rejection behavior. As in GNU R, extending an extracted
column through `df$x[i] <- value` remains an incompatible column-length error rather than implicitly
growing the frame. Factor replacement maps labels back to existing levels, extends with missing
codes, and warns when an assigned label is not a level.

`base::replace` has differential evidence for zoo's measured `replace(x, 1:min(length(x)), 3)`
missing-run helper. It returns a new value and leaves `x` unchanged by delegating to the same owned
one-dimensional `[<-` path. Numeric, logical, character, negative, zero, empty, and missing
subscript behavior; replacement recycling and promotion; names and extension; matrix
dimensions/dimnames; factor levels; list and pairlist results; owned data-frame columns; `NULL`
deletion/materialization; partial argument names; namespace access; warnings, errors, and resource
limits have coverage. Expression-vector replacement, arbitrary class-specific `[<-` dispatch,
recursive objects beyond the owned value model, exact diagnostic wording, and long-vector behavior
remain unsupported.

Direct `drop(x)` has differential coverage for the four measured matrixStats validation calls and
posterior's measured explicit rvar-array reduction. It removes every singleton extent, adjusts
surviving named dimension axes, derives vector names under GNU R's scalar and one-axis rules, keeps
zero-length non-singleton axes, preserves atomic/list storage plus factor/custom classes and
unrelated attributes, and returns objects without an explicit `dim` unchanged. Malformed dimension
metadata, ALTREP-specific storage behavior, and external class invariants beyond attribute
preservation are not claimed.

Comparisons accept numeric/logical and character vectors, recycle operands, and propagate NA and NaN
as unknown. Character ordering uses deterministic Unicode code-unit order rather than
locale-dependent R collation. `&` and `|` are vectorized; `&&` and `||` require scalar operands and
short-circuit their right side.

Conditions require one non-missing logical or numeric value. `return` is confined to its defining
function. `for` accepts vectors and lists; `while` and `repeat` share lexical `break` and `next`
boundaries. All loops consume the evaluator step budget.

Namespace access resolves exact builtins from the registered `base`, `stats`, `methods`, `R6`,
`vctrs`, and `tibble` namespaces, and exact owned base bindings such as `base::.Machine`. Public
`::` and registered internal `:::` lookup never load code, consult the network, or imply general
package compatibility.

Random state is isolated per session and restored by reset. `RNGkind` queries and selects
session-local uniform, normal, and discrete-sampling kinds with prior-state return, mutation
invisibility, unique-prefix/default matching, and documented warnings. The independently implemented
default Mersenne-Twister engine has fixed-seed `set.seed`/`runif` differential sequence evidence.
Inversion normal generation plus Rounding and Rejection discrete sampling are selectable.
`RNGversion` selects Mersenne-Twister/Inversion/Rounding for version strings from R 1.7 through 3.5
and Mersenne-Twister/Inversion/Rejection from R 3.6 onward. It returns the prior three-kind vector
invisibly and emits the ordinary Rounding warning, which makes zoo's measured
`suppressWarnings(RNGversion("3.5.0")); set.seed(1)` setup executable. Versions before R 1.7 require
historical uniform and normal engines and are rejected explicitly. Wichmann-Hill,
Marsaglia-Multicarry, Super-Duper, Knuth-TAOCP, Knuth-TAOCP-2002, L'Ecuyer-CMRG, user-supplied
uniform engines, Box-Muller, user-supplied normal engines, Ahrens-Dieter, Buggy Kinderman-Ramage,
and Kinderman-Ramage are explicit unsupported boundaries rather than aliases. Generator transitions
without a subsequent `set.seed`, exhaustive tail-level normal identity, and all discrete-sampler
sequences are not yet claimed.

`set.seed`, `sample`, `sample.int`, `runif`, `rnorm`, `rbeta`, `rbinom`, `rpois`, `rchisq`, `rt`,
and `rexp` use independently implemented algorithms. `sample.int` covers default size, replacement
and no-replacement, optional fixed-population hashing, finite non-negative probabilities, the
integer/double result boundary at `2^31`, and populations through the documented approximately
`4.5e15` limit. Differential cases pin the observed `sample.int(.Machine$integer.max, 1L)`
package-use shape and fixed-seed Rounding/Rejection, swap/hash, large-population, and weighted
paths. The installed `.Machine` list is the pinned R 4.6 x64 numeric-constant shape, not a claim
that JavaScript exposes every native C or long-double facility. Weighted replacement with more than
200 positive probabilities does not yet reproduce GNU R's Walker-alias stream identity, and
equal-weight ordering beyond the executable cases is not claimed. `sample(prob=)` supports weighted
sampling with and without replacement. `jitter` adds session-local uniform noise to integer/double
vectors using the documented approximate adjacent difference, explicit finite-range, and
constant-vector fallback scales. It retains attributes when the result length is unchanged,
preserves missing and non-finite values, returns empty inputs unchanged, and does not force `factor`
for a nonzero explicit `amount`. Exact random-stream values outside the fixed-seed uniform and
`sample.int` evidence above, every fuzz-rounding boundary, non-scalar control arguments, and
all-non-finite automatic scales are not claimed.

`stats::rbeta` has differential shape evidence for loo's measured central-beta prior and posterior
draws. Its owned sampler recycles real `shape1`, `shape2`, and optional `ncp` vectors; follows the
scalar-versus-vector `n` length rule; produces central values from stable log-gamma ratios; and uses
a Poisson/gamma construction for finite non-centrality. Zero and infinite shape limits, empty
parameters, invalid-value warnings, attribute-free results, fixed-seed session reproducibility,
range invariants, and sampled first two moments have executable evidence. Exact Cheng-algorithm
stream identity, every extreme finite non-centrality, long-vector behavior, and bit-for-bit tail
rounding are not claimed.

`stats::rgamma` has differential shape and behavioral evidence for posterior's measured
`rgamma(1, shape = 1, rate = 1)` uses through `rdo`, `rfun`, and `rvar_rng`. It follows the
scalar-versus-vector `n` length rule, recycles real shape and rate/scale parameters, drops
attributes, and advances only the resettable session RNG. Rate and scale parameterizations have
fixed-seed equivalence; redundant consistent pairs warn and inconsistent pairs fail. Sampled first
two moments, zero and infinite limits, empty parameters, missing/NaN/domain warnings, and namespace
access have executable evidence. Exact GNU R Ahrens-Dieter stream identity, every tiny-shape
underflow, long vectors, class-specific inputs, and the density/CDF/quantile gamma family are not
claimed.

`stats::rlnorm` has differential behavioral evidence for zoo's measured `rlnorm(200, mean = 1)` flow
generator. The scalar-or-vector `n` rule, vectorized recycled `meanlog`/`sdlog`, exact pinned
Mersenne-Twister/Inversion historical sequences, strictly positive finite draws, zero-deviation
point masses without RNG advancement, empty parameters, missing/NaN, negative/infinite deviations,
infinite means, one aggregate `NAs produced` warning, attribute-free results, partial argument
matching, namespace access, and resource bounds have coverage. Alternative normal generators, bit
identity outside the documented Inversion path, long vectors, exact platform diagnostics, and the
`dlnorm`/`plnorm`/`qlnorm` family remain unsupported.

The usage-ranked `stats::rcauchy` path and adjacent `dcauchy`/`pcauchy`/`qcauchy` family have GNU R
4.6 differential evidence for ggplot2's 1,000-draw examples, pillar's 20-value display example, and
purrr's 100-value invocation example. Coverage includes exact formals, scalar-versus-vector `n`,
parameter recycling, fixed-seed ordering, zero-scale point masses without RNG advancement, canonical
density/CDF/quantile values, stable ordinary/log lower and upper tails, longest-input metadata,
missing/NaN/domain behavior, warnings, namespace lookup, and resource bounds. The random path owns
its uniform stream and transform. Exhaustive platform-libm bit identity, long vectors, non-numeric
class methods, and the wider distribution catalog remain incomplete.

`stats::dbinom` has differential numeric evidence for loo's measured
`dbinom(data_i$y, size = data_i$K, prob = draws, log = TRUE)` likelihood shape. The vectorized path
recycles real quantiles, sizes, and probabilities; preserves the longest input's metadata; handles
ordinary and log probabilities, boundary masses, empty inputs, `NA`/`NaN`, and infinite sizes; and
emits domain or per-quantile non-integer warnings. Small edge counts use direct log products and
larger counts use an independent Lanczos log-gamma ratio. Bit-for-bit Loader saddle-point identity,
all huge-count cancellation boundaries, and platform-specific warning formatting are not claimed.

`base::mat.or.vec` has differential behavioral evidence for loo's measured `mat.or.vec(10, 3)`
scratch allocation. It returns owned double zeros, uses the unclassed-vector branch only when the
original `nc` compares equal to integer one, and otherwise creates a column-major matrix from
truncated nonnegative first extents. Zero rows or columns and attribute removal are covered. Long
vectors, every coercion diagnostic, and allocation sizes beyond the runtime resource budget are not
claimed.

Primitive `base::seq.int` has differential behavioral evidence for data.table's measured
`seq.int(n)` and `seq.int(n - 1L)` rolling-window indices. It also covers scalar and length-based
single inputs, forward/reverse unit sequences, finite explicit steps, rounded-up `length.out`,
`along.with`, integer/double storage selection, ignored dots, and internal `seq` S3 dispatch.
Long-vector compact representations, every floating-point endpoint tolerance, complex inputs, and
exact legacy diagnostics are not claimed.

`methods::as` has differential behavioral evidence for data.table's two measured checks comparing
its `as.IDate` and `as.ITime` constructors with explicitly registered coercions. `methods::setAs`
stores source/target closures per evaluator session and returns invisible NULL; lookup includes
explicit and implicit source classes, declared `setClass` parents, identity conversions, the
integer/double `numeric` identity, and callable core `as.<Class>` fallbacks. NativR does not bundle
data.table's classes or methods. Replacement coercions, automatic namespace registration,
multiple-signature selection, package loading, caches, slots, and exhaustive methods diagnostics are
not claimed.

The string surface includes `paste`, `paste0`, `sprintf`, `format`, `grep`, `grepl`, `gsub`, `sub`,
`strsplit`, `substring`, `substr`, `nchar`, `nzchar`, `tolower`, `toupper`, `chartr`, `trimws`,
`regexpr`, `gregexpr`, and `regmatches`. `trimws` covers both/left/right selection, configurable
whitespace patterns, missing values, atomic and bounded list coercion, and character-vector
attributes. Regex location objects use one-based Unicode-character positions and `match.length`
metadata. First/global matching, unmatched and missing text, zero-width matches, names, full-match
extraction, and inverse gaps have differential coverage. Regular-expression operations use a bounded
ECMAScript-compatible subset. Byte-oriented matching, capture start/length/name matrices,
`regexec`/`gregexec`, replacement through `regmatches<-`, locale-sensitive collation, exhaustive
recursive list stringification, and full GNU R TRE/PCRE/format compatibility are not claimed.

`nzchar` returns an attribute-free logical vector after internal-style character coercion of atomic,
bounded list/pairlist, language, and expression inputs. Empty strings are false; nonempty strings
are true; missing atomic values are true by default and remain missing when `keepNA` coerces to
true. NULL produces a zero-length result. Primitive one-/two-argument positioning, first-argument
name validation, and factor/environment/closure rejection have black-box evidence. Exact encoding
marks, invalid multibyte inputs, arbitrary recursive deparsing, every primitive diagnostic, and
host-locale differences are not claimed.

`make.names` has C-locale differential coverage for atomic and scalar-list coercion, empty and
missing inputs, valid starts, invalid-byte replacement, reserved words, `allow_`, attribute removal,
and the legal-name-first suffix behavior used by `unique = TRUE`. The measured tibble
`.name_repair = ~ make.names(., unique = TRUE)` callback executes with `.` bound in the formula's
captured environment and repairs duplicate columns. Standalone `make.unique`, non-C character-class
tables, recursive list stringification, and tibble's remaining vctrs name-repair strategies are not
claimed.

`print` has executable value, output, and invisibility coverage for NULL, atomic vectors, names,
basic lists, two-dimensional atomic matrices, and NativR data frames. `cat` concatenates NULL and
atomic inputs with character-vector separators, emits ordered stdout or writes to a supported
browser-memory path/file connection, honors path append mode, and returns invisible NULL. Both
inline and Worker APIs retain stdout in `evalDetailed`; output and stored text share configured
budgets. S3 print-method dispatch, global print options, line filling, labels, host files, and the
complete connection stack are not claimed.

`plot`, `plot.default`, `plot.new`, bounded `plot.window`, `axTicks`, `box`, `boxplot`, `image`,
`image.default`, `persp`, `lines`, `lines.default`, `points`, `polygon`, `rasterImage`, `segments`,
and `legend` provide the first browser-native graphics slice. Evaluation owns page and linear
coordinate-window state, converts two-dimensional grayscale or character colors, three-/four-channel
numeric/raw arrays, and packed `nativeRaster` integers to row-major RGBA, and emits commands for
recycled raster placements, styled line segments, resolved point symbols and polygons, plot frames
and boxplots, and resolved legend entries. Commands preserve raster angle/interpolation, finite
coordinates, canonical colors, normalized line patterns, line widths, polygon fill rules, frame
edges, text labels, point symbols, placement, and layout controls. They cross the Worker boundary,
remain available in `evalDetailed.graphics`, and count toward the configured output budget. Inline
and Worker callbacks receive the same command shapes, and the Playground renders them to Canvas.
Evidence covers the measured systemfonts glyph-raster, httr PNG-array, posterior interval-segment,
zoo filled-area, zoo plot-frame, zoo grouped-boxplot, and zoo legend patterns. The owned registry
also supports `dev.cur`/`dev.list`, GNU R-shaped null device 1, simultaneous browser/PNG device
identities, selected `dev.off`/`graphics.off` closure, nested `dev.hold`/`dev.flush` levels,
per-device `par()` isolation and restoration, ordered cross-evaluation command buffering, and
bounded same-session `recordPlot`/`replayPlot` over its own
page/window/raster/segments/points/text/polygon/box/boxplot/ legend display list. `grDevices::png`
uses that list to produce bounded, decompressible RGBA PNG bytes in the virtual file store,
including transparent backgrounds, exact requested dimensions, raw-byte reads, and numbered
multi-page targets. Closing flushes held commands and completes the current PNG page. Complete plot
methods, non-PNG devices, complete clipping/margins, graphical parameters beyond the documented
controls, external display-list formats, and pixel equivalence across GNU R devices are not claimed.

`image` has shape-level differential evidence for the rank-163 calls sampled from `scales`,
`viridisLite`, and `RColorBrewer`. Its S3 generic preserves package-defined methods. The default
method covers matrix orientation, center/boundary expansion, regular raster and irregular polygon
paths, explicit colour breaks, finite `zlim`, transparent missing/non-finite cells, palette strips,
invisible `NULL`, and GNU R-observed user-window ranges. This is not a claim of device-identical
axes, interpolation, legacy colour intervals, or complete graphical-parameter behavior.

`base::plot` and `graphics::plot.default` have differential shape evidence for the sampled rank-22
numeric calls and package-owned S3 extension point. The generic probes class methods before entering
the default, including methods registered by application-supplied pure-R packages; method return
values and visibility remain package-owned. The default accepts one real vector, paired real x/y,
two-column matrices, one-/two-column data frames, named x/y lists, and complex coordinates through
the shared coordinate adapter. It computes GNU R-shaped linear ranges with 4% regular-axis padding,
opens a page/window, and emits point, line, both, overplotted, histogram, lower/upper step, or
no-draw geometry. Common color/fill/symbol/size/line controls recycle; incomplete coordinates are
omitted and split paths. `panel.first` and `panel.last` are forced around the data geometry,
`axes`/`frame.plot` control the owned frame, and supplied scalar character main/sub/x/y labels
become bounded text commands. The default returns invisible `NULL` through inline and Worker
sessions and participates in hold/flush and display-list replay. Automatic expression-derived
labels, automatic axis generation, logarithmic or fixed-aspect axes, complete axis-gap layout,
formula/function/time-series/raster and other specialized methods, arbitrary graphical parameters,
margins/clipping, and device-identical pixels remain outside this shape-level claim.

`graphics::lines` and `graphics::lines.default` have differential shape evidence for all 20 measured
calls across scales, matrixStats, posterior, and zoo. The generic dispatches package-owned S3
methods before the default and preserves their value and visibility. The default reuses the
plot/points coordinate adapter for paired vectors, one-vector indices, matrices, data frames, named
x/y lists, and complex coordinates; unequal paired lengths fail and missing/non-finite pairs split
paths. Types `l`, `p`, `b`, `c`, `o`, `h`, `s`, `S`, and `n` reuse bounded segment and point
commands. Ordinary connected paths use the first line colour/type/width, histogram lines recycle
colour, point-bearing types recycle symbol, colour, fill, size, and width, and the default returns
invisible `NULL`. Worker/Canvas rendering and same-session device recording therefore require no
package-specific protocol. Line joins/caps/mitres, clipping and log transforms, broader coordinate
classes, complete `par()` inheritance, every graphical parameter, and device-identical pixels are
not claimed.

`graphics::axTicks` has differential evidence for zoo's measured secondary-axis tick lookup and
ordinary horizontal-axis lookup. On the owned linear device, sides 1/3 derive ticks from the current
x limits and sides 2/4 from the current y limits; common ranges use independently authored
1/2/5-power-of-ten spacing, and reversed limits retain descending order. Explicit
`axp = c(start, end, intervals)` follows the GNU R-observed `floor(abs(intervals) + 0.25)`
conversion and can run without an active device when `log = FALSE`. Linear `usr` and `nintLog`
remain lazy, unique partial argument matching and namespace access are covered, and result
allocation is bounded. Complete `pretty` equivalence for every floating-point boundary,
`par("xaxp"/"yaxp")`, logarithmic axes and `grDevices::axisTicks`, and device-specific graphical
parameters beyond the documented session subset are not claimed.

`graphics::axis` has differential and browser-host evidence for all 18 measured calls across
labeling, zoo, and bit64. Sides 1:4 accept explicit sorted numeric locations or reuse the owned
linear window ticks; character, numeric, default, empty, and `labels = FALSE` modes preserve the
invisible GNU R-shaped return. Axis lines, recycled tick geometry, and resolved text labels reuse
the existing bounded segment/text journal, including secondary axes, `tcl`, `cex.axis`, colors, line
styles, font controls, pure-R package calls, Worker transport, Canvas/PNG rendering, and
display-list replay. Exact formals, empty input, non-finite drawing omission, label-length errors,
and invalid sides have GNU R 4.6 evidence. Logarithmic/date axes, plotmath, outer margins, exact
label collision/gap layout, device font metrics, and pixel identity remain explicit depth.

`graphics::box` has differential return/visibility evidence for zoo's measured `box()` redraw and
browser-host evidence for the resulting frame. `which = "plot"` accepts its documented unique
prefix, and `bty` resolves `o`, `l`, `7`, `c`, `u`, `]`, and `n` into explicit edges. A supplied
non-missing `col` takes precedence over `fg`, with black as the current owned-device default; named,
numeric, and hexadecimal line types are normalized, widths must be positive, and blank, transparent,
or no-frame styles emit no command. The command crosses inline/Worker APIs, is charged against
`maxOutputBytes`, renders on Canvas, and round-trips through the bounded display list. Figure, inner
and outer regions, graphical parameters beyond the documented `par()` subset, exact device dash
metrics, and cross-device pixel identity are not claimed. `graphics::par()` itself owns a
session-local set of common annotation, color, font, line, margin, layout, clipping, and axis
parameters. It supports scalar/vector queries, named updates, named-list restoration, invisible old
values, closure-like formals, validation, and unknown-parameter warnings without requiring an active
device.

`graphics::boxplot` has differential evidence for zoo's measured grouped-series call and adjacent
default shapes. Its S3 generic forwards classed inputs before the independently authored default
accepts numeric vectors, lists of numeric groups, or numeric matrix columns. Missing values are
omitted; Tukey hinges, whiskers, notch confidence limits, outliers, group indices, names, and sample
counts populate the standard six-field result, which is returned invisibly with `plot = TRUE` or
`FALSE`. Drawing supports vertical/horizontal orientation, notch and outline selection, fixed or
sample-scaled widths, explicit positions, additive drawing, recycled border/fill colors, and
resolved line types/widths. Commands cross inline/Worker APIs, Canvas pixels, output accounting,
held journals, and same-session record/replay. Formula/data-frame methods, logarithmic axes,
arbitrary `pars`, complete annotation/axes, exact notch-overlap diagnostics, and device-identical
layout remain unsupported.

`graphics::hist` and `graphics::hist.default` have differential evidence for all 19 measured calls
across testthat, openssl, shiny, and posterior. The generic dispatches package-owned S3 methods; the
default removes missing and non-finite numeric values, accepts vectors or matrices, and returns the
standard `breaks`, `counts`, `density`, `mids`, `xname`, and `equidist` fields with class
`histogram`. Sturges, Scott, Freedman-Diaconis, scalar-count, explicit-vector, and callable breaks;
right/left endpoint controls; unequal-bin densities; exact formals; visibility; and the connected
`grDevices::nclass.*` helpers have GNU R 4.6 evidence. Drawing recycles bar colors and styles,
supports labels and additive plots, and reuses bounded polygon/text/box events through Worker,
Canvas, PNG, hold/flush, and record/replay paths. Exhaustive `pretty()` floating-point boundaries,
logarithmic axes, positive line-density shading, arbitrary graphical parameters, and
device-identical rendering remain unsupported.

`graphics::persp` has differential evidence for zoo's measured `persp(1:nO, 1:nC, zz)` call where
`zz` is a classed numeric matrix. S3 dispatch runs before the owned default, which accepts ascending
real x/y grids and a two-dimensional real z matrix, omits missing grid edges, validates explicit
limits, and returns the invisible `4 × 4` homogeneous view matrix. Separate and aspect-preserving
scale paths, `theta`, `phi`, `r`, `d`, `expand`, box control, axis-flag validation, namespace
access, output limits, Worker transport, Canvas rendering, and same-session display-list replay have
coverage. The browser drawing is a bounded projected white/black wireframe and box encoded as
existing segment commands. Colored facet fills, lighting, axis arrows/ticks/labels,
hidden-line/painter equivalence, hooks, arbitrary graphical `...`, `trans3d`, and device-identical
pixels remain unsupported.

`graphics::points` has differential evidence for zoo's documented
`points.zoo(x, y = NULL, type = "p", ...)` package extension point and adjacent default calls.
Classed first arguments dispatch before device access and preserve the method's own visibility. The
owned default accepts paired real coordinates, one-/two-column data frames, two-column matrices,
complex coordinates, and named `list(x, y)` inputs; separate x/y vectors must have equal lengths.
Numeric `pch` 0:25, printable-ASCII/negative-Unicode codes, one-character symbols, and recycled
`col`/`bg`/`cex`/`lwd` are resolved before transport. Missing or non-finite coordinates,
missing/unused symbols, missing colors, missing/non-positive sizes, and missing/negative widths omit
their point; a transparent border can still retain the independent fill of symbols 21:25. Calls
return invisible `NULL`; `type = "n"` validates without drawing. Point count and allocation are
bounded by `maxVectorLength`, payloads by `maxOutputBytes`, and Worker/Canvas pixels plus
same-session record/replay have coverage. Line/path types, locale-dependent glyph codes,
character-coordinate coercion, coordinate classes beyond owned numeric storage, clipping/log axes,
device font/size identity, and arbitrary graphical `...` remain unsupported.

`graphics::text` has differential shape evidence for zoo's measured rotated, outside-region series
label. Classed first arguments dispatch before device access. The owned default accepts the same
numeric coordinate containers as points while recycling unequal x/y lengths; atomic labels coerce to
character, shorter labels recycle, longer labels warn and truncate, and missing coordinates or
labels are omitted. Recycled canonical colors, sizes, four font faces, positions, adjustment,
offset, scalar rotation, family, and `xpd` cross the Worker protocol as resolved host-neutral
labels. Invisible return, namespace access, Canvas pixels, output/resource accounting, held
journals, malformed-record rejection, and same-session record/replay have coverage. Plotmath,
Hershey fonts, class-specific label coercion, clipping/log axes, arbitrary graphical controls, exact
diagnostics, and device-identical metrics remain unsupported.

`graphics::matplot` has differential shape evidence for bit64's six measured matrix-performance
calls. One supplied vector/matrix/data frame becomes `y` with generated `1:n` x coordinates; two
inputs must have equal row counts and cycle their columns independently. Numeric and logical
vectors, matrices, and numeric data frames are supported. Point, line, both, overplotted, and
no-draw types cycle by series, as do colors, symbols, fills, sizes, line types, and widths.
Incomplete coordinate pairs are omitted and interrupt line segments; x/y log scales are resolved to
host-neutral coordinates before transport. Each high-level call creates a bounded page and window,
can emit a plot-frame box, and reuses the existing segment/point Worker, Canvas, hold, and
record/replay paths. Character axis labels are accepted for the measured calls but complete
axes/annotation rendering, class-specific `plot`/`lines` methods, `add = TRUE`, `verbose = TRUE`,
step/histogram series, arbitrary graphical parameters, date/time axes, and device-identical layout
are not claimed.

`base::aperm` and `aperm.default` have behavioral differential evidence for bit64's measured
`aperm(A, 2:1)` array-method requirement. The generic forces only its dispatch object and supports
lazy method arguments, inherited class lookup, and `NextMethod` before the independently authored
default; arguments are rematched at each method, including positional matching into `resize`. The
default accepts owned atomic and list arrays, reverses axes for omitted/`NULL`/empty `perm`,
truncates numeric axes to integers, resolves character axes against named dimensions, and reorders
storage in column-major order. With `resize = TRUE`, dimensions and dimension names follow the
permutation; `resize = FALSE` retains the original dimensions and removes dimension names. Output
drops unrelated source attributes as the documented default does. Direct/namespace access, zero
extents, lazy unused dots, invalid permutations, coercible resize flags, and allocation/step limits
have coverage. `aperm.table`, malformed attributes created below the public constructors, exact
legacy diagnostics, and long vectors are not claimed.

`base::dget`, `dput`, `tempfile`, and `unlink` have behavioral differential evidence for bit64's
measured classed-data-frame serialization roundtrip. `tempfile` returns unique vectorized
`nativr://session-temp/...` paths, and `dput` stores canonical R source in an evaluator-owned
session map or writes it to ordinary captured stdout when `file = ""`. `dget` reparses stored source
through the owned Tree-sitter/normalized-AST/evaluator path in the caller environment. Atomic
logical, integer, double, complex, raw, and character vectors; lists; pairlists; names; dimensions;
classes; data-frame metadata; custom attributes; `NA`; `NaN`; infinities; and Unicode strings have
differential roundtrip coverage. `dput` and `unlink` return invisibly, missing virtual files fail
deterministically, and file count, stored UTF-8 bytes, serialization depth, allocation, and
evaluation steps are bounded.

This is a browser-memory compatibility slice, not host filesystem emulation. Relative paths are
accepted only when the current directory belongs to a NativR-owned root; absolute host paths and
unsupported connections are rejected. Only the default `dput(control=)` set is accepted;
environments, closures, formulas, builtins, cyclic graphs, promise/source-reference retention,
arbitrary externally written source, binary serialization, compression, and cross-session
persistence are not claimed. Owned symbols, calls, and expression vectors use explicit
reconstructing wrappers and have NativR-only executable evidence; GNU R's own text roundtrip can
instead evaluate some nested language objects, so no strict differential claim is made for those
values.

`base::writeLines` and `readLines` have behavioral differential evidence for same-session text
roundtrips, per-element separators, invisible writes, LF/CRLF/CR recognition, line-count limits,
short-read errors, incomplete-final-line warnings, embedded-NUL truncation/skip behavior, and
standard-output events. The same reader consumes bounded immutable package metadata, retained R
source, and UTF-8/Latin-1 packaged resources through `system.file()` paths.

`base::file`, `open`, `close`, `flush`, `isOpen`, and `seek` expose evaluator-owned classed integer
handles over those paths. Differential evidence covers implicit operation-scoped opens; explicit
read, write, append, and update modes; private empty-description connections; persistent cursors;
connection summaries; access queries; flush/close visibility; and destruction. `tempdir` returns the
opaque session root and `file.exists` recognizes session files and installed-package files or
directories. `readLines`, `writeLines`, `cat`, and `utils::capture.output` consume the same handles;
closed `capture.output` targets follow GNU R's destroy-after-use behavior. Handle identity prevents
forging, package writes are rejected, and the map is reset with the evaluator. Host paths, URLs,
sockets, typed binary decoding/writes beyond raw `readBin`, encoding conversion on writes,
independent read/write positions, positions beyond end of file, and the broader
connection/filesystem stack are not claimed.

Usage-ranked `base::gzcon` has GNU R 4.6 behavioral differential evidence for its four formal names,
`c("gzcon", "connection")` handle shape, connection summary, gzip magic, text write/read roundtrips,
close-time emission, raw decompression, and `allowNonCompressed = FALSE` warning plus pass-through.
It mutates the evaluator connection record and invalidates the superseded file handle, so all
subsequent I/O traverses one bounded decompressed byte buffer. Immutable package gzip resources and
same-session files use browser-standard `CompressionStream`/`DecompressionStream` in both inline and
Worker execution. The `level` range is validated, but the browser API does not expose GNU zlib's
level control, so compressed-byte or compression-ratio identity is not claimed. URL/curl transports,
sockets, seek/pushback in compressed streams, concatenated-member fidelity, and typed binary I/O
remain separate capabilities.

`base::R.home`, `dir.create`, `dir.exists`, `list.files`/`dir`, `list.dirs`, `getwd`, `setwd`,
`normalizePath`, `basename`, and `dirname` have public-shape differential evidence plus NativR-only
integration coverage for the virtual directory boundary. The runtime owns a static runtime tree,
immutable package trees, a mutable session tree, and one current directory. Relative paths apply to
line, table, serialization, workspace, and connection operations; normalization of `.` and `..`
cannot escape an owned root. Recursive creation/removal is session-only. Host paths, symlinks,
native permissions/ownership, mounts, platform separators, and host current-directory behavior are
not claimed.

Usage-ranked `base::file.info`, together with `file.mode`, `file.mtime`, and `file.size`, has GNU R
4.6 differential evidence for formals, the stable six-column frame, zero rows, duplicate and missing
paths/row names, storage types, `octmode`/`POSIXct` classes, and wrapper results. NativR-owned files
report encoded byte sizes and evaluator-local write/read timestamps; directories and immutable
package resources report deterministic virtual modes and metadata. `extra_cols = TRUE` adds portable
`uid`, `gid`, `uname`, and `grname` columns whose values are missing because no host identity is
exposed. Host stat calls, links, ACLs, native owners, executable classification, and platform-exact
timestamps are not claimed.

`utils::read.table`, `read.csv`, `read.csv2`, `read.delim`, and `read.delim2` have behavioral
differential evidence for bounded browser-memory text, headers, quoted separators and doubled
quotes, missing strings, syntactic names, row names, and logical/integer/double conversion.
`write.table`, `write.csv`, and `write.csv2` have evidence for data-frame rows, headers, row-name
conventions, quoted character fields, missing values, invisible returns, and session-file
roundtrips. Existing readable/writable text connections are accepted with GNU R-style
operation-scoped destruction when initially closed. `colClasses`, escape processing, compression,
URLs, host paths, arbitrary encodings, locale-dependent formatting, and the full scanner/writer
surface are not claimed.

`base::Sys.sleep` accepts GNU R's non-negative scalar-coercible interval shape, permits `Inf`,
returns invisible `NULL`, and cooperatively checks cancellation between short asynchronous timer
slices. Missing, `NaN`, empty, and negative times fail. Exact scheduler resolution is host-dependent
and is not claimed.

`base::system.time` evaluates its lazy `expr` exactly once after validating the closure-like
`gcFirst` control and returns a visible five-element double vector with GNU R's `proc_time` class,
names, missing child-process fields, and elapsed wall time. Expression errors emit a bounded
`Timing stopped at:` stderr event before the original catchable condition continues. The adjacent
`proc.time()` exposes a nondecreasing session-relative elapsed clock with the same result shape.
Browsers expose neither process CPU accounting nor child processes, so `user.self` and `sys.self`
are truthfully zero and both child fields are `NA`; `gcFirst = TRUE` performs a silent census of the
NativR-owned R graph but cannot request host garbage collection. Exact scheduler resolution, CPU
accounting, child-process accounting, and GNU R's class-specific print/summary formatting are not
claimed.

`base::Sys.getpid` has GNU R 4.6 differential evidence for its zero formals, positive scalar integer
shape, repeated-call stability, and unused-argument error. NativR assigns the identity before inline
or Worker initialization, preserves it across reset and Worker replacement, and distinguishes
concurrent sessions created by one facade realm. An unchanged source-only package function observes
the same value. It is not a host PID: global uniqueness across independent page realms, process
handles, parent/child relationships, enumeration, signals, and ps's native-process equivalence are
not claimed.

`base::.libPaths` has GNU R 4.6 differential evidence for its `new`/`include.site` formals,
non-forcing getter, getter/setter visibility, character validation, missing/nonexistent filtering,
normalization, order-preserving deduplication, mandatory base-library suffix, and resettable state.
The browser-owned bundle library and runtime library are exposed through locked `.Library` and
`.Library.site`-compatible base bindings. Integration evidence proves that default and explicit
virtual `lib.loc` lookup affect `library`, `require`, `requireNamespace`, `pkg::`, `packageVersion`,
and `system.file`, lifecycle hooks receive the bundle root, and unchanged `withr 3.0.3` restores the
state. Host library trees, startup `R_LIBS*` expansion, runtime repository installation, duplicate
installed versions, native binaries, and every package that happens to be discoverable are not
claimed.

`base::system` has GNU R 4.6 differential evidence for its 11 closure-like formals and preflight
validation. With `createR({ systemCommand })`, behavioral integration evidence covers captured line
output, stderr events, nonzero status attributes/warnings, ordinary and asynchronous return codes,
timeout signaling, input/control transport, Worker correlation, and invocation from an unchanged
pure-R package function. Without that explicit option it fails closed. Command parsing, shell
selection, executable discovery, quoting, environment inheritance, signals, real timeout
enforcement, and the presence or behavior of any external program are host-defined and are not
claimed by the browser runtime.

`base::gc` has behavioral differential evidence for its closure-like defaults, control coercion,
visible double matrix, dimensions, row/column labels, resettable maxima, and verbose message shape.
`Ncells` counts reachable NativR runtime objects plus binding/attribute links; `Vcells` counts owned
payload bytes in eight-byte units. The `(Mb)` columns use GNU R's 56-byte node and eight-byte vector
display factors. Reporting triggers are adaptive NativR census thresholds, not JavaScript-engine
collection thresholds. `base::gcinfo` preserves its formals and previous-flag result, but automatic
host collection messages, weak-reference finalizers, exact GNU allocator counts, and forced host GC
are not claimed.

`base::save` and `load` extend the same session-owned resource seam with behavioral differential
evidence for bit64's observed workspace roundtrip. `save` selects direct object expressions and/or
character names supplied by `list`, looks them up in `envir`, forces promises by default, preserves
duplicate names, and writes an XDR version-2/version-3 `RDX2`/`RDX3` archive. `load` validates that
archive, restores bindings into the selected environment, optionally emits bounded verbose output,
and returns loaded names invisibly; `save` returns invisible `NULL`. The same bounded GNU R codec
serves `serialize`/`unserialize` and `saveRDS`/`readRDS`/`infoRDS`, and browser-standard streams
provide gzip. Exact black-box GNU R bytes and external package workspaces are evidence. Host paths,
ASCII/native-endian streams, unsupported graph types/compressors, cross-session persistence,
`eval.promises = FALSE`, and `precheck = FALSE` are rejected.

`graphics::polygon` has differential evidence for zoo's measured filled-area panel helper. Its
default accepts paired real coordinates, one-/two-column data frames, two-column matrices, complex
coordinates, and named `list(x, y)` inputs; separate x/y vectors must have equal lengths. Missing or
non-finite coordinate pairs split complete closed polygons. Fill and border colors, line types, and
line widths recycle by polygon; `border = FALSE` suppresses a border, `fillOddEven` selects the
Canvas fill rule, `density = 0` suppresses fill, and negative, missing, or `NULL` density selects a
solid fill. Calls return invisible `NULL`; empty coordinates emit no event. Coordinates, styles,
command payloads, held journals, and display-list records are bounded, and Worker transport, Canvas
fill/border pixels, same-session record/replay, malformed-record rejection, namespace access, and
owned-device errors have coverage. Positive hatch density, coordinate classes beyond owned numeric
storage, clipping/log axes, device-specific dash metrics, arbitrary graphical `...`, exact
diagnostics, and cross-device pixel identity remain unsupported.

`graphics::segments` has differential evidence for posterior's measured
`segments(seq_along(theta), y0 = q5, y1 = q95)` vertical-interval shape. Exactly one of `x1` or `y1`
may be omitted and then defaults to the corresponding start coordinate; omitting both is an error.
Coordinate vectors recycle to their common maximum without a warning, all-empty coordinates return
invisible `NULL`, and mixed empty/nonempty coordinates are rejected. Missing or non-finite
coordinates, missing/transparent colors, blank line types, and missing/NaN/negative line widths omit
the affected stroke. Character and numeric palette colors, named/numeric/custom hexadecimal line
types, and non-negative finite line widths are resolved before the event crosses the Worker
boundary. Segment count is bounded by `maxVectorLength`; estimated event, held-journal, and display
list payloads are bounded by `maxOutputBytes`. Canvas pixel tests and same-session
`recordPlot`/`replayPlot` tests cover host rendering and persistence. Coordinate class conversion,
log axes, `lend`/`ljoin`/`lmitre`, `xpd`, device-specific dash metrics, and pixel identity with
every GNU R graphics device are not claimed.

`graphics::legend` has differential evidence for zoo's three measured line/point legend calls.
Labels may be supplied through the positional `y` slot or named `legend`; keyword anchors support
documented unique partial matching and optional one-/two-value inset, while finite `x`/`y`
coordinates select explicit placement. Colors, text colors, line types, line widths, and point
symbols recycle across entries; `bty`, `bg`, `cex`, `ncol`, `horiz`, `title`, and `plot` have
bounded shape coverage. The call returns an invisible list with named `rect` and `text` geometry,
and `plot = FALSE` computes that shape without emitting an event. Entry count is bounded by
`maxVectorLength`, event/display-list bytes by `maxOutputBytes`, and record/replay decoding
validates the owned command shape. GNU R-exact font metrics and geometry values, expression labels,
fill/density keys, merged-line controls, arbitrary graphical `...`, margins/clipping, log axes, and
device-identical rendering are not claimed.

`comment(x)` and `comment(x) <- value` have differential evidence for zoo's measured metadata
example. On owned atomic vectors, arrays, factors, lists, pairlists, and data frames, comments are
character attributes that do not alter the underlying value or other attributes. `NULL` and
zero-length character replacement remove the attribute; missing character elements are retained;
non-character values fail; and direct `attr(x, "comment") <- value` follows the same validation.
Replacement assignment returns its right-hand side invisibly through the normal replacement-function
protocol. Querying an unsupported non-attributed value returns `NULL`; setting comments on closures,
environments, symbols, formulas, calls, and expression vectors remains explicit future general
attribute-model work.

`grDevices::as.raster` has differential coverage for ragg's measured captured-color-matrix call, the
row-first `"raster"` storage contract, character matrices/vectors, logical/numeric/raw grayscale
conversion, numeric/raw RGB and RGBA planes, missing grayscale pixels, `max` scaling, vector
`nrow`/`ncol` reshaping, dropped names/dimnames, S3 dispatch, existing-raster identity, internal
method access, predicates, lazy unused character/raw `max`, and bounded input errors. The resulting
object feeds the existing `rasterImage` RGBA journal with pixel-order evidence. `plot.raster`,
raster subset/replacement methods, `as.matrix.raster`, `nativeRaster` coercion, arbitrary external
classes, and complete legacy diagnostics are not claimed.

`grDevices::dev.flush` covers ragg's measured zero-argument animation-device call shape, and its
paired `dev.hold` supplies the documented nested-level protocol on NativR's owned browser device.
Positive levels increase or decrease the session-local hold count; negative levels clamp to zero;
the flush that reaches zero releases pending
page/window/raster/segments/points/text/polygon/box/boxplot/legend commands in original order
through the current `evalDetailed.graphics` result and host callback. Pending graphics storage
remains subject to `maxOutputBytes`, pending command count remains subject to `maxVectorLength`,
state survives ordinary evaluation boundaries, and reset/dispose clears it. Without an active owned
device both calls return integer zero. Level coercion, missing-state preservation, namespace access,
and nested returns have executable coverage. GNU R 4.6.0 currently returns these integer levels
visibly even though its help page describes them as invisible; NativR follows the pinned executable
oracle. The ragg device itself, WebP animation encoding, general device registration, cursors, and
arbitrary third-party device callbacks are not included.

`grDevices::recordPlot` covers ragg's measured capture/record/replay sequence after drawing on the
owned browser device. It returns a visible classed list with the GNU R-observed public
type/mode/class/length/no-names shape while storing an independently authored NativR command format.
Optional `load` and `attach` character metadata is retained. `grDevices::replayPlot` validates only
that format, restores page/window state, and re-emits raster, segment, point, text, polygon, box,
boxplot, and legend commands through the immediate or held graphics journal before returning
invisible `NULL`. Display-list and recorded command counts are bounded by `maxVectorLength`;
display-list graphics payloads and replay output by `maxOutputBytes`. Malformed values, absent
record devices, reset cleanup, namespace access, and held replay have executable evidence.
`reloadPkgs = TRUE` with stored package metadata is explicitly unsupported until namespace loading
exists. GNU R's private or serialized recorded-plot representation, cross-version/cross-device
replay, package reload/attach side effects, `print.recordedplot`, snapshots of arbitrary external
devices, and general display-list editing are not claimed.

`graphics::pairs` supplies the S3 generic used by rstan's measured `pairs.stanfit` call.
Differential evidence covers the original classed dispatch value, lazy dots, labels/panels,
parameter selection, condition arguments, registered namespace access, and custom method results.
The runtime does not implement or imitate Stan objects or rstan's package-owned plot method.
`pairs.default`, the formula method, scatterplot layout, panel callbacks, axes, text, and general
graphical parameters remain outside this bounded extension-point slice.

`stats::update` supplies the S3 generic used by zoo's documented lattice update call. Differential
shape evidence covers the original classed dispatch value, lazy `...`, inherited class lookup,
`NextMethod`, direct and namespace-qualified access, result visibility, missing-object errors, and
independently authored `update.default` methods. NativR does not implement or imitate lattice's
package-owned `update.trellis` method. Without a user or package method, the built-in
`update.default` stored-call extraction, call rewriting, formula replacement, and optional
re-evaluation path raises an explicit unsupported-feature error.

`grDevices::colors` and its true `colours` alias expose the complete ordered GNU R 4.6.0 catalog of
657 public names. `distinct = TRUE` returns the documented 502-name first-occurrence subset after
RGB deduplication; logical and numeric scalar conditions, partial argument matching, missing/invalid
conditions, and unclassed unnamed character output have differential evidence. The catalog is an
independently recorded public black-box result. It does not imply arbitrary color spaces, palette
mutation, raster conversion, or devices.

`grDevices::colorRampPalette` has differential evidence for isoband's two identical six-anchor,
21-color CIE Lab Viridis calls and for linear RGB, positive bias, alpha, partial choice matching,
and zero/singleton output lengths. It returns an owned first-class builtin function and performs all
interpolation with browser-native arithmetic; the observed palette is byte-identical to GNU R. All
657 catalog names are now accepted as color inputs. Spline interpolation, standalone `colorRamp`,
wide-gamut/device profiles, and exhaustive out-of-gamut rounding remain outside this bounded slice.

`grDevices::hcl` has differential evidence for all six measured ggplot2/zoo calls, including a
2,500-color raster vector, a ten-color strip, translucent threshold colors, and opaque neutral/high-
chroma colors. The browser-owned polar CIE-LUV/D65-to-sRGB path covers vector recycling, default and
exact formals, optional/recycled alpha, zero-length inputs, missing/non-finite coordinates, finite
range validation, clamped gamut fixup, and `NA` for out-of-gamut colors when `fixup = FALSE`.
Source-only package and default Worker execution use the same registered callable. ICC profiles,
device-dependent color management, `hcl.colors`, and the broader color-conversion API remain
separate compatibility depth.

`grDevices::col2rgb` has differential evidence for stringr's measured named-color-to-hex helper, the
complete 657-name catalog, short and long RGB(A) hexadecimal forms, transparent and missing values,
factor labels, default-palette numeric indices, row/column names, alpha selection, empty inputs, and
invalid specifications. The reverse `grDevices::rgb` path covers recycled numeric channels, optional
alpha/names, byte and normalized intensity ranges, and three-/four-column matrix or data-frame
input. Mutable palettes, arbitrary color spaces/profiles, and device-dependent interpretation remain
separate surfaces.

`grDevices::heat.colors` has differential evidence for the measured sequential palette, exact
red-to-yellow and pale-yellow hexadecimal bytes, optional alpha, reversal, count truncation, names,
zero/negative counts, and invalid scalar inputs. It is independently generated and does not claim
palette families beyond the separately documented gray palette, palette state, general color
conversion, or device-specific rendering.

`grDevices::gray`/`grey` and `gray.colors`/`grey.colors` have differential evidence for zoo's
measured `gray.colors(2, start = 0.7)` and `grey(7:1/8)` calls. Covered behavior includes uppercase
RGB(A) bytes, documented gamma interpolation, default/custom/descending endpoints, zero/fractional
counts, scalar or recycled alpha, reversal after alpha composition, alias identity, atomic numeric
coercion for gray levels, attribute removal, namespace access, invalid ranges, and pre-allocation
result limits. Start/end/gamma vectors, alpha vectors longer than direct gray-level inputs, host
color profiles, warning-text identity, and long vectors are not compatibility claims.

`head` has value and metadata coverage for atomic vectors, lists, pairlists, expressions, factors,
two-dimensional matrices, and NativR data frames, including positive and negative `n`. `str` has
output and invisibility coverage for representative atomic, named, matrix, list, data-frame, factor,
language, environment, closure, and builtin values, with bounded `max.level`, `vec.len`, and
`list.len` controls. Full method dispatch, every class-specific representation, exact whitespace
under all print options, and arbitrary recursive-object compatibility are not claimed.

`identical` has differential value coverage for strict atomic types, NA/NaN, signed zero, nested
lists and pairlists, factors and arbitrary owned attributes, normalized language/expression values,
environments, and closures. The documented `num.eq`, `single.NA`, `attrib.as.set`,
`ignore.environment`, and `ignore.srcref` switches affect comparison. `ignore.bytecode` and
`extptr.as.ref` are accepted but are operationally irrelevant until bytecode and external-pointer
value domains exist. Character encoding marks and exact bytes are now represented, although
`identical` does not yet promise every GNU R encoding-cache corner; every GNU R NaN payload is also
not yet representable.

The initial condition contract covers lazy `try` capture with classed error values, `tryCatch`
error/condition handlers plus `finally`, `stop`, logical-vector `stopifnot`, structured `warning`,
ordered `message` output, `conditionMessage`, dynamically nested warning/message suppression, and
`invisible`. Session-persistent `globalCallingHandlers` support query, registration/replacement,
newest-group-first ordering, clearing with invisible previous-handler return, warning/message
signals after dynamic suppression, and unhandled errors after dynamic catchers have unwound.
Differential cases cover values, output, warning presence, visibility, handler results, and
finalization. Resource-limit and cancellation errors deliberately bypass R-level catchers. Arbitrary
user-defined condition signaling, local calling handlers, restarts, traceback/call objects, deferred
warning policy, custom condition constructors/classes, class-selective suppression beyond
warning/message, and connection-backed `try(outFile=)` are not claimed.

Session options support exact `options()` queries, named mutation/removal, named-list mutation,
invisible old-value returns, lazy `getOption()` defaults, deterministic reset, and bounded
validation for common numeric/printing options. `digits` and `max.print` affect `print`, while
`ts.eps` controls time-series endpoint cycle recognition. The complete platform default catalog,
partial option-name matching, every GNU R validation rule, and full propagation to all consumers are
not claimed.

Session environment variables support GNU R-shaped `Sys.getenv()`, `Sys.setenv()`, and
`Sys.unsetenv()` over an evaluator-owned map. Differential evidence covers exact formals, `x = NULL`
Dlist and `character(0)` `NAME=value` queries, scalar versus vector naming, `unset = NA`,
atomic/list/factor coercion, missing keys, ordered duplicate setters, true-vector returns, and
factor name attributes. `createR({ environmentVariables })` is validated and snapshotted for both
inline and Worker execution; independent sessions do not share mutations and reset reconstructs the
initial map. The unchanged `withr 3.0.3` source package executes `with_envvar()` and restores an
existing value while deleting a temporary one. Reading or mutating the host process environment is
not supported, and empty string values remain explicit entries instead of following a host OS's
`setenv` convention.

`readline()` has GNU R 4.6 formals, visible scalar return, 256-character prompt bound, prompt
coercion, and leading/trailing space-and-tab trimming. In the default non-interactive session it
prints the prompt plus newline, returns `""`, and `interactive()` is `FALSE`. An explicit
`createR({ readline })` callback enables asynchronous inline and Worker input, makes `interactive()`
`TRUE`, and is exercised from an unchanged source-only package function and the browser Playground.
The host result must be one NUL-free line within the session byte budget. EOF distinctions, terminal
editing/history, password masking, nested browser dialogs, and GNU R's complete front-end state are
not claimed.

`capabilities()` has differential coverage for the complete GNU R 4.6 capability-name set, named
logical-vector attributes, `NULL`/empty/unknown selection, requested order and duplication, factor
coercion, and lazy `Xchk`. All values deliberately report `FALSE`: none of the corresponding GNU R
native graphics devices beyond the owned PNG path, Tcl/Tk, sockets, host filesystem, native
profiling, localization/iconv, Cairo, ICU, long-double, or libcurl facilities are exposed through
the network-free browser runtime. This is a platform non-applicability result, not emulation of the
host machine's installed libraries.

`.LC.categories`, `Sys.getlocale`, `Sys.setlocale`, and `Sys.localeconv` use resettable
evaluator-owned state rather than browser or operating-system locale globals. The C profile and its
18 named convention values have exact shape evidence. `LC_MONETARY` additionally accepts the
`it_IT`/`Italian_Italy` and `en_US`/`English_United States` UTF-8 aliases required by the measured
`withr` examples, with differential evidence for their currency symbols, decimal/thousands
separators, placement flags, and session reset. Unsupported locale requests return an empty string
with a stable warning; unsupported categories report an error. Collation, localized time names,
message translation, paper/measurement categories, arbitrary system locale databases, encoding
mutation, and package-level `with_locale` execution are not claimed.

`utils::sessionInfo` has shape evidence for the measured otel `utils::sessionInfo()$platform` lookup
and differential evidence for its class, R major/minor target, RNG-kind length, attached
base-package length, and named-list access. Browser-specific values are deliberately NativR
identities: platform is `wasm32-unknown-browser/nativr`, running host is
`Browser JavaScript (NativR)`, time zone is UTC, native BLAS/LAPACK fields are empty, and the
version list describes R 4.6.0 as the compatibility target rather than claiming that GNU R is
embedded. Current evaluator locale and RNG-kind mutations are reflected. `sessionInfo(package=)`,
package descriptions, platform-native code-page fields, `print.sessionInfo`, `toLatex.sessionInfo`,
and arbitrary host probing are not claimed.

`round` has differential numeric and metadata coverage for vectorized/recycled `x` and `digits`,
ties-to-even from exact binary inputs, real and complex values, `NA`/`NaN`/infinities, signed zero,
and attribute retention when the result length is unchanged. S3 Math2 dispatch, factor-specific
behavior, and every platform-specific extreme floating-point edge are not claimed.

`signif` has differential behavioral evidence for zoo's two measured plot-limit calls and for
vectorized real/complex inputs. Requested digits recycle, round to the nearest integer, clamp to the
documented 1–22 range, and distinguish missing from numeric NaN. Decimal ties-to-even, signed zero,
infinities, output type, unchanged-length attributes, allocation limits, direct S3 methods, and the
S3 Math-group fallback are covered. Dynamic `.Generic`/`.Group` method bindings, S4 Math2 dispatch,
and bit-for-bit identity across every browser decimal-conversion edge remain incomplete.

Natural, base-10, base-2, and one-plus logarithms plus `exp`/`expm1` have differential coverage for
real and complex vectors, recycled `log` bases, stable near-zero real calculations, missing and
non-finite values, domain warnings, and attribute retention. Math/Math2 S3 dispatch, class-specific
methods, and bit-for-bit agreement with every platform math library are not claimed.

`qlogis` computes browser-native logistic quantiles for recycled real probability, location, and
scale vectors. Ordinary and log probabilities, lower/upper tails, stable near-boundary formulas,
zero and negative scales, NA/NaN/infinities, zero-length short-circuiting, one domain warning, and
attribute retention from the first longest numeric argument have differential coverage. The
implementation uses explicit numeric tolerances against GNU R rather than claiming bit-for-bit libm
identity. Complex/class-specific inputs, non-scalar tail flags, and exhaustive subnormal probability
behavior are not claimed.

Central `pt` and `qt` use a NativR-owned incomplete-beta implementation with monotone quantile
inversion. Recycled real inputs and degrees of freedom, infinite degrees of freedom, ordinary and
log probabilities, lower/upper tails, boundaries, explicit NA versus NaN, domain warnings,
zero-length inputs, and first-longest-numeric-input attributes have differential coverage.
Non-central distributions currently accept `ncp = 0`; nonzero `ncp`, exhaustive subnormal tails, and
bit-for-bit agreement with every platform math library are not claimed.

`scale` first converts owned numeric vectors, two-dimensional matrices, and numeric data frames to a
column-major matrix, then applies column-wise centering and scaling. Default logical controls,
explicit per-column real controls, root-mean-square behavior when centering is disabled, missing
value exclusion from statistics, NA/NaN retention, empty/constant/single-observation columns,
dimension names, custom attributes, named `scaled:center`/`scaled:scale` metadata, and global custom
S3 methods have differential coverage. The implementation also accepts complex matrices on the owned
complex arithmetic path, but exhaustive complex control and non-finite branch behavior, array
coercion, factor/character data-frame columns, namespace-hidden methods, and exact legacy diagnostic
text are not claimed.

`IQR` delegates to the owned `quantile` implementation and has differential coverage for types 1
through 9, logical/integer/double/character coercion, missing-value removal, empty and degenerate
inputs, infinities, and attribute removal. The broader quantile contract remains bounded to one
probability vector and does not claim Date/POSIX methods, arbitrary S3 dispatch, names controls, or
bit-for-bit equivalence for every extreme floating-point interpolation.

`stats::ppoints` has differential coverage for posterior's two measured `quantile(x, ppoints(10))`
examples. It implements the documented `(i - a) / (m + 1 - 2a)` grid, the 3/8 default through 10
points and 1/2 default thereafter, multi-element observation lengths, fractional positive scalar
sequence endpoints, nonpositive lazy-empty results, real and complex offsets, ordinary recycling
warnings, missing offsets, longest-offset names/dimensions, namespace access, and browser allocation
limits. Scalar factors/raw/language values, exact legacy diagnostics, GNU R long vectors, and
exhaustive IEEE edge identity are not claimed.

`base::chol` has differential coverage for posterior's measured `chol.rvar` S3 method call and an
independently authored `chol.default`. The default covers real/logical square matrices, positive
scalars, numeric data frames, upper-triangle-only input, upper-factor orientation, dimnames,
positive-definite failures, lazy unused dots, eagerly checked `tol`, and the defunct `LINPACK`
boundary. Optional diagonal pivoting covers positive-semidefinite rank detection, one-based `pivot`,
integer `rank`, and the documented warning. Complex/non-finite values, zero/nonsquare matrices, and
invalid controls fail explicitly. Exact LAPACK rounding/error codes, indefinite pivoted results,
long matrices, sparse/Matrix methods, posterior's package-owned `rvar` algorithm, and general tensor
Cholesky are not claimed.

`stats::pnorm` has differential coverage for posterior's measured `pnorm(1.5, mean = 1:4, sd = 2)`
comparison. It covers real/logical vectorized `q`, `mean`, and `sd`, GNU R recycling without a
recycling warning, first-longest-input attributes, scalar lower/upper and ordinary/log controls,
empty inputs, missing and input-NaN propagation, zero-deviation point masses, negative-deviation and
indeterminate non-finite warnings, infinities, and namespace access. Far small log tails use an
owned Mills-ratio expansion and complementary log tails use `log1p`, with executable evidence at 50
standard deviations. Complex quantiles, arbitrary class dispatch, bit-for-bit identity at every
subnormal or platform-libm boundary, and the broader normal-distribution family remain incomplete.

`stats::density` is an ordinary S3 generic and forwards the original lazy call arguments to global
methods. This is sufficient to host the 94 measured posterior and distributional call sites when
those packages provide their own methods; NativR does not copy or claim those package algorithms.
The independent `density.default` path covers finite logical/integer/double observations, optional
missing-value removal, numeric or `nrd0` bandwidths, adjustment, non-negative weights, grid size and
bounds, cut extension, the Gaussian kernel constant, and the standard classed result fields. It
evaluates the Gaussian estimate directly on the requested grid rather than reproducing GNU R's FFT
coordinate path, so numeric evidence uses declared tolerances. Other kernels and bandwidth
selectors, infinite point masses, long-vector performance, exact source-derived `call`/`data.name`,
and the detailed `width`, `ext`, `old.coords`, and `warnWbw` compatibility surface are not claimed.

`eigen` accepts finite logical, integer, and double square matrices and returns decreasing values,
normalized column eigenvectors, the documented names, and the `eigen` class unless `only.values` is
selected. The independent real-symmetric path uses Jacobi rotations and honors explicit symmetry by
reading the lower triangle. The independent real-asymmetric path covers orders one through three
with analytic characteristic roots and real or conjugate-complex null-space vectors, including
jsonlite's measured random 3-by-3 result shape. Complex input matrices, asymmetric order above
three, every defective/repeated-root basis, LAPACK convergence diagnostics, platform rounding, and
eigenvector sign/phase identity are not claimed; numeric evidence compares values and invariant
vector magnitudes with declared tolerances.

`colSums` has differential coverage for loo's measured integer `table` totals and zoo's measured
`colSums(!is.na(za)) > 0` column mask. `rowMeans` and `colMeans` have differential coverage for
matrixStats' measured matrix-subset validations. The shared implementation accepts logical, integer,
double, and complex arrays with at least two dimensions plus numeric data frames; reduces the
requested `dims` axes in column-major order; applies `na.rm` independently to each output cell;
returns double or complex storage; handles empty reductions; and carries the surviving names,
dimensions, named axes, and dimnames. Default data-frame row names are omitted from `rowMeans`
results while explicit row names are retained. `is.na` and unary `!` retain the structural
attributes required by the zoo expression. Bare-bones `.colSums`/`.rowMeans`/`.colMeans`, `rowSums`,
arbitrary external matrix classes, long-vector extended-precision identity, and platform-specific
ordering between `NA` and `NaN` are not claimed by this increment.

`stats::weighted.mean` has differential coverage for matrixStats' six measured comparisons against
its optimized `weightedMean` helper. The ordinary S3 generic forwards original lazy arguments to
custom methods. The independent default accepts equal-length logical, integer, double, or complex
values and weights; supplies equal weights when `w` is omitted; omits zero-weight pairs before
value-missingness propagation; removes missing/NaN `x` values and paired weights under `na.rm`;
returns a missing scalar for any remaining missing/NaN weight; and preserves GNU R's `NaN` or
infinite outcomes for infinite or zero total weights. Results are attribute-free double or complex
scalars. Built-in Date/POSIX/difftime methods, arbitrary arithmetic classes, factor-operation
details beyond the observed warning/missing result, long-vector compensated summation, and
bit-for-bit platform rounding are not claimed by this increment.

`stats::mad` has differential coverage for matrixStats' measured `mad(1:10)` and `mad(1:2)`
reference values plus documented default/explicit centers, scale constants, ordinary/low/high
even-sample medians, missing/NaN removal, empty inputs, and attribute-free scalar results. Both
`low` and `high` cannot be selected together. The current path deliberately requires real logical,
integer, or double data and scalar real `center`/`constant` values; complex deviations, vectorized
centers/constants and their recycling warnings, arbitrary numeric classes, and bit-for-bit
long-vector selection behavior are not claimed.

`stats::rbeta` has differential shape coverage for loo's measured `rbeta(1, a0, b0)` prior draw and
`as.matrix(rbeta(S, a, b))` posterior draw. The same cases cover namespace lookup, vectorized
central/non-central parameters, deterministic reseeding, documented result lengths, ordinary
distribution moments, zero/infinite limits, missing/invalid arguments, and attribute-free double
results. NativR owns the random stream and gamma-ratio sampler; exact GNU R beta-deviate sequences
and exhaustive extreme-parameter identity are outside this increment.

`stats::dbinom` has differential numeric coverage for the corresponding loo log-likelihood call,
canonical probabilities, parameter recycling, large log densities, boundary and infinite-size
masses, longest-input attributes, missing/NaN distinctions, non-integer quantile warnings, and
invalid size/probability results. The owned log-factorial calculation stays stable for the measured
posterior path and checked large case; exact GNU R saddle-point rounding over every extreme count is
outside this increment.

`base::mat.or.vec` has differential behavioral coverage for the corresponding loo 10-by-3
zero-matrix call, double storage, its special `nc == 1` vector result, zero-sized dimensions,
fractional-extent truncation, first-extent selection, attribute removal, namespace lookup, and
missing/type/range errors. Exact legacy diagnostic strings, long-vector extents, and allocations
outside the configured browser resource limit are outside this increment.

Primitive `base::seq.int` has differential behavioral coverage for data.table's three corresponding
rolling-window calls, one-argument numeric and length interpretations, zero/negative endpoints,
forward/reverse and fractional steps, requested/along lengths, storage selection, attribute removal,
`seq` S3 dispatch, and finite/control errors. Compact long-vector encodings, complex sequences,
every sub-ULP endpoint case, and exact legacy diagnostics are outside this increment.

`methods::as` and `methods::setAs` have differential behavioral coverage for data.table's two
package-defined IDate/ITime coercion shapes, built-in character/integer/factor conversion,
same-class and integer-to-`numeric` identity, inherited registered source classes, result metadata,
invisible registration, namespace lookup, and missing/invalid/unknown-target boundaries. Explicit
registrations and values are evaluator-session-local. Package namespace loading, replacement
methods, slots, multiple signatures, cache invalidation, and the remainder of the methods coercion
graph are outside this increment.

`kappa` has differential coverage for default QR estimates and exact 2-norm condition numbers over
square, tall, and wide real matrices; 1- and infinity-norm controls; direct inversion; upper/lower
triangular selection; vectors, character matrices, and numeric data frames; empty and non-finite
inputs; lazy inverse arguments; custom S3 dispatch; and owned `qr`/`lm` objects. The implementation
uses independently authored Householder, triangular-estimation, Jacobi, and inversion paths. Complex
matrices, arbitrary array ranks, external sparse/dense matrix classes, every legacy diagnostic
string, bit-for-bit platform LAPACK rounding, and exhaustive ill-conditioned large-matrix stability
are not claimed by this increment.

`xtabs` has differential coverage for the usage-ranked RcppEigen factor-table call, integer counts,
numeric weights, factor/character/numeric axes, declared and dropped factor levels, subsets,
`na.rm`, `addNA`, `na.omit`, matrix responses, call/class/dimension metadata, and
formula-environment lookup. Interaction terms, nonnumeric responses, and unequal variable lengths
are rejected. `sparse = TRUE` is deliberately unsupported until NativR has an independently owned
sparse-matrix value and class contract; external Matrix classes and the full formula/contrast
ecosystem are not claimed.

`kmeans` accepts finite numeric/logical/raw/character/factor vectors and matrices plus
numeric-coercible data frames. It covers explicit distinct centers, scalar center counts,
deterministic session-random initialization, `nstart` best-fit selection, standard result names and
class, row/column metadata, convergence warnings, and the documented Hartigan-Wong, Lloyd/Forgy, and
MacQueen choices. Differential cases pin explicit-center metrics and object shapes for all four
algorithm names. The Hartigan-Wong path is an independent optimal-transfer implementation and does
not yet claim GNU R's complete quick-transfer staging or iteration identity on every dataset.
Random-start cluster identity is intentionally not differential because NativR does not reproduce
GNU R's random stream. Non-finite observations, sparse matrices, arbitrary class-specific coercions,
every numerical tie, and large-data performance equivalence remain outside this bounded increment.

`convolve` covers circular, open, and filter choices; default or disabled conjugation; exact and
unique-partial type selection; integer/double, logical, and complex inputs; factor warning results;
empty/mismatched input errors; circular custom attributes and dimensions; open/filter names; and
global NA/NaN propagation. Short inputs use direct complex accumulation, while larger
one-dimensional inputs have executable radix-2 and arbitrary-length Bluestein evidence. Shared
matrix dimensions have differential circular-convolution coverage through column-major
multidimensional indexing. Raw, character, list, and other non-numeric inputs remain errors as in
the observed contract. Bit-for-bit identity of every floating-point FFT rounding path, every
infinite-value cancellation, mixed incompatible array dimensions, and GNU R's platform-specific FFT
performance are not yet claimed; the standalone `fft`/`mvfft` API is also not exposed by this
increment.

`as.hexmode` has differential coverage for integer attribute retention; integral-double and
hexadecimal-character conversion; NA/NaN and signed-range behavior; lower/upper-case formatting;
explicit/common zero padding; names, matrix metadata, class-preserving one-dimensional selection;
browser-safe printing; and signed 32-bit `!`, `&`, and `|` methods with recycling. Character inputs
discard source attributes as observed. Exhaustive legacy diagnostic text, malformed class objects,
arbitrary multidimensional method dispatch, arithmetic attribute propagation, and the related
`octmode` family are not claimed by this increment.

`as.roman` has differential coverage for the measured `utils::as.roman(seq_len(nrow(x)))` pillar
row-identifier path, integer storage and class, idempotence, values 1 through 4999, numeric
truncation/range handling, unsigned decimal and canonical case-insensitive Roman strings, documented
repeated-`I` historical forms, missing and invalid inputs, canonical `as.character`, left-justified
`format` widths, and matrix metadata. Noncanonical Roman spellings beyond the documented
repeated-`I` examples, `.romans`, `print.roman`, the complete `Ops`/`Summary` method families, and
arbitrary malformed class objects are not claimed.

`as.POSIXlt` has differential coverage for testthat's measured `as.POSIXlt(Sys.time())` and
`length()` shape, zoo's measured `$mday` extraction, fixed UTC/GMT POSIXct and Date input, bare
epoch seconds, strict ISO character input, fractional seconds, missing/non-finite component
behavior, the documented 11-component list and attributes, and custom S3 dispatch. Regional
time-zone databases, daylight-saving transitions, leap seconds, locale-specific parsing, arbitrary
malformed POSIXlt objects, and the complete date-time method family are not claimed.

`weekdays`, `weekdays.Date`, and `weekdays.POSIXt` have differential behavioral evidence for
data.table's two measured IDate grouping-label calls. The S3 generic follows IDate's explicit Date
inheritance and custom package classes; registered methods cover deterministic C-locale full and
abbreviated names, recycled coercible abbreviation flags, fractional Date values, names,
missing/non-finite values, UTC/GMT POSIXct and owned POSIXlt inputs, zero lengths, direct method
calls, and invalid inputs. Other locale translations, named-zone/DST behavior, malformed POSIXlt
objects, and the related `months`/`quarters`/`julian` family are not claimed.

`anyDuplicated`, `anyDuplicated.default`, and `anyDuplicated.data.frame` have differential
behavioral evidence for data.table's measured two-column duplicate-row query and independently
authored package-method dispatch. The owned defaults cover first-position and reverse scans, atomic
vectors, factors, recursive lists, complete data-frame rows, `NULL`/empty inputs, names, `NA` versus
`NaN`, vector/list incomparables, and bounded invalid controls. Long-vector double indices,
array-specific methods, arbitrary recursive cycles, external pointers, and all package methods are
not claimed.

`rep.int` has differential behavioral evidence for data.table's measured adaptive-window tail
construction. Scalar whole-vector and element-wise repetition cover logical, integer, double,
complex, character, raw, list, factor, and expression inputs, truncated and coercible counts, empty
outputs, ordinary-attribute removal, factor class/level retention, and custom internal-S3 dispatch.
Configured allocation limits replace GNU R long-vector allocation; S4 containment, pairlists,
`NULL`, malformed objects, and every internal method are not claimed.

`methods::representation` has differential behavioral evidence for data.table's measured legacy S4
slot declaration and for the returned parent/slot list shape. Scalar character declarations, unnamed
parent classes, named slots, empty and missing strings, backtick-decoded slot names, empty calls,
and duplicate/type/missing-argument failures are covered. Full S4 class validity, prototypes,
unions, virtual classes, sealed definitions, namespace registration, and every interaction with the
complete methods package are not claimed.

`trunc` has differential behavioral evidence for data.table's measured ITime hour-truncation method
shape. Direct and Math-group S3 methods receive the original object and lazy dots; the independent
default covers toward-zero logical/integer/double conversion, signed zero, infinities, `NA`/`NaN`,
empty values, eager otherwise-unused dots, and attribute retention. Complex, factor, character, S4,
and the complete built-in date-time method family are not claimed.

`utils::type.convert`, its default method, and its list/data-frame methods have differential
behavioral evidence for data.table's measured split-column `as.is = TRUE` call. The owned inference
ladder covers logical tokens, integer syntax, decimal/hexadecimal/non-finite doubles, complex
constants, missing strings and blank fields, alternate decimal marks, character/factor fallback,
integral-double narrowing, matrix shape, recursive containers, omitted-`as.is` warnings, and custom
S3 dispatch. Full precision-loss handling for `numerals`, locale-dependent parsing, vectorized
controls, arbitrary recursive cycles, exotic atomic types, and every package method are not claimed.

`withVisible` has differential behavioral evidence for Shiny's two measured stack-trace example
calls and GNU R's primitive result shape. It evaluates one argument once, returns the exact named
`value`/`visible` list, propagates visibility through assignments, `invisible`, blocks, closures,
ellipsis, and `evalq`, and treats a previously forced promise lookup as visible. Exact GNU R
diagnostic wording and visibility behavior for unsupported language constructs are not claimed.

`with` supports named list, pairlist, and data-frame masks with caller fallback plus direct
environment evaluation and mutation. `local` supports fresh child and supplied environments.
Assignments, lexical fallback, and dynamic-evaluation visibility have differential coverage across
`eval`, `with`, and `local`. Custom `with` methods, active bindings, search-path masks, and every
nonstandard data-mask class are not claimed.

`all.equal` has differential truth-result coverage for default and explicit tolerance, automatic
relative versus absolute scaling, integer/double compatibility, `NA`/`NaN`/infinities, attributes,
and recursive lists. It returns deterministic character diagnostics for mismatches; exact GNU R
diagnostic text, the complete method family, custom dispatch, and cyclic environment-content
comparison are not claimed. Scalar `isTRUE`/`isFALSE` behavior is covered.

`ifelse` has differential coverage for logical coercion, missing tests, positional branch recycling,
atomic promotion, ordinary-list results, names/dimension/custom test attributes, and lazy forcing
only of branches selected by at least one test element. Raw branches, class/method dispatch, and
every exotic replacement type are outside this bounded increment.

`any` and `all` have differential coverage for empty identities, three-valued missingness, exact
`na.rm` matching/coercion, eager argument evaluation, logical/integer inputs, warned coercion of
other atomic types, and scalar ordinary-list elements. Summary-group method dispatch beyond the
explicit rejection of classed values and broader recursive object coercion are not claimed.

`subset` has differential coverage for lazy vector/list predicates, missing-predicate removal,
recycling, data-frame column masks with caller fallback, matrix row selection, column-selection
expressions, and non-dropping rectangular results. Custom S3 methods, arbitrary-dimensional arrays,
and the complete method-specific dots surface are not claimed. Function-position lookup separately
skips non-callable bindings, which allows a data column to share a name with a called function.

`rm`/`remove` cover captured identifier and string names, `list=`, explicit environments,
inheritance, missing-object warnings, and invisible NULL. Search-path numeric/character `pos`
variants beyond `-1`, locked bindings, and active bindings are not claimed.

`rev` covers the owned vector/list/pairlist shapes, reverses names, preserves class/levels/row
names, and drops matrix dimensions. `append` inserts at bounded whole-number positions across atomic
vectors, lists, pairlists, and expression vectors, promotes atomic types, preserves names, unions
ordinary factor levels, and drops matrix dimensions. Fractional/negative positions, ordered-factor
corner cases, arbitrary class dispatch, and every mixed recursive coercion are not claimed. The
cumulative family (`cumsum`, `cumprod`, `cummax`, `cummin`) covers GNU R result-type promotion,
names, dimension dropping, integer overflow, real/complex arithmetic, and missing/NaN propagation.
Group-generic dispatch and exhaustive floating-point edge equivalence remain outside these
increments.

`intersect`, `setdiff`, and `union` retain the first occurrence of each matched value in stable
input order. Atomic inputs use GNU R-compatible common-type matching, with `setdiff` retaining the
left input's storage type; NA and NaN remain distinct, names/custom attributes and matrix dimensions
are dropped, and mixed factor/non-factor inputs compare as character labels. Two-factor operations
return ordinary factors, union their levels where required, and drop ordered status. Lists and data
frames compare elements recursively with attributes and return plain unnamed lists. Pairlists,
expression vectors, method dispatch, locale-specific encodings, and exhaustive recursive-object
identity corner cases remain outside this increment.

`setequal` returns one logical value after order- and duplicate-insensitive comparison. Atomic
inputs use a common comparison type while keeping NA and NaN distinct; factors compare labels; lists
compare recursively; and NULL agrees with other empty set inputs. The usage-ranked data-frame path
independently compares row sets across compatible reordered columns, which runs dplyr's two measured
examples without copying package source. Single-column tibble rectangular selection remains a tibble
rather than dropping to a vector, and selected data frames retain their class chain. The data-frame
behavior is an explicit package-usage extension; the source-bundle namespace loader does not imply
general dplyr compatibility; arbitrary dplyr methods, grouped/remote tables, dots, pairlists,
locale-specific encodings, and exhaustive recursive identity corners are not claimed.

`pmin` computes recycled elementwise minima across logical, integer, double, character, factor, and
NULL inputs. Nonempty logical results use integer storage, mixed inputs follow the ordinary
character/double/integer promotion order, fractional recycling emits one warning, and any
zero-length input produces a typed zero-length result. The result copies the first input's owned
attributes, including names, dimensions, custom metadata, and compatible classes. NA and NaN remain
distinct, exact `na.rm` control ignores missing candidates unless every candidate is missing, and
all-missing positions retain GNU R's rightmost NA/NaN identity. Equal-level ordered factors compare
by level order; ordinary factors retain GNU R's warning-producing first-input behavior in the
covered shapes. Complex/raw/list inputs, unequal ordered-factor levels, S3/S4 method dispatch,
locale-specific character collation, and exhaustive class/recycling corner cases are not claimed.

`outer(X, Y, FUN, ...)` forms column-major Cartesian inputs, invokes the resolved callable once, and
requires a vector result whose length matches the product of the input lengths. Vector inputs
produce a two-dimensional result; array dimensions, dimension names, and named dimension axes are
concatenated in input order. The default multiplication path and `%o%` cover logical, integer,
double, and complex storage; character function lookup and user callables receive still-lazy dots.
The covered empty generic path retains zero dimensions, and numeric `sqrt`/`abs` preserve matrix
metadata needed by scales' measured radial-matrix expression. Data frames, long vectors beyond
browser allocation limits, arbitrary package array classes, method dispatch, and exact legacy
diagnostic text are not claimed.

`lag` preserves values, names, dimensions, classes, and other owned attributes while adding a
default `tsp` coordinate or shifting an existing one by `k / frequency`. Positive, negative, zero,
infinite, logical, and ties-to-even rounded real offsets have differential coverage, including the
non-integer warning. Row counts follow vectors, lists, data frames, matrices, and higher-rank
arrays; zero-length and malformed metadata cases retain bounded errors. Global custom S3 methods
receive the original lazy arguments, while the built-in fallback implements GNU R's default
behavior. Expression vectors, closures, namespace-registered hidden methods, exhaustive malformed
`tsp` validation, and exact legacy diagnostic text remain outside this increment.

`start` and `end` return default `(1, 1)` and `(NROW, 1)` coordinates for nonempty unclassed
vectors, lists, matrices, and arrays. Valid regular `tsp` metadata produces a period/cycle pair when
its positive integer frequency and selected endpoint fall on the configurable `ts.eps` grid;
non-integer or off-grid frequencies return the decimal endpoint. Negative coordinates, matrix/array
row counts, malformed metadata, zero-length and data-frame rejection, explicit/session tolerances,
ignored default-method dots, and separate global custom S3 methods have differential coverage.
Pairlists, arbitrary recursive objects, namespace-registered hidden methods, package-owned
`start.zoo`/`start.crayon` implementations, and exhaustive floating-point boundary behavior are not
claimed.

`time` runs data.table's measured `as.integer(time(uspop))` path and forwards the 24 measured zoo
calls to package-owned S3 methods without reproducing zoo index storage. The default method covers
nonempty vectors and matrix row counts, positive regular `tsp` metadata including frequencies below
one, fractional `offset`, configurable `ts.eps` snapping near integer years, unchanged result `tsp`,
and `ts` result class. Empty values, data frames, malformed series metadata, and non-finite controls
produce bounded errors. Zoo's replacement generic `time<-`, irregular indexes, and
namespace-registered hidden methods remain outside this increment.

`stats::ts` constructs nonempty vector or two-dimensional matrix time series. One- or two-number
calendar `start`/`end` coordinates, positive `frequency` or `deltat`, configurable `ts.eps`,
endpoint-driven row recycling/truncation, vector names, matrix series names, `tsp`, default
`ts`/`mts` classes, and explicit class overrides have executable GNU R differential evidence.
`as.ts` dispatches package-owned S3 methods before its default path, which retains a valid existing
`tsp` interval or creates the row-based interval `(1, NROW, 1)`. `frequency` likewise dispatches
first and otherwise returns the validated `tsp` frequency or one. Data-frame-to-numeric-matrix
coercion, zero-row series, higher-rank arrays, long-vector storage, language-specific printing,
aligned time-series arithmetic, and exhaustive floating-point endpoint diagnostics are not claimed.

`stats::deltat` dispatches package-owned S3 methods before its default. The default returns one for
ordinary values and the reciprocal of a vector or matrix's validated `tsp` frequency, yielding one
unnamed visible double while leaving unused dots lazy. Differential evidence covers zoo's measured
regular-series call through ordinary `ts` values and an independently declared `deltat.zoo` seam,
plus matrices, expressions, closures, namespace access, visibility, and malformed metadata. Zoo's
irregular index inference and methods, namespace-hidden methods, and exhaustive floating-point
boundaries remain package or future compatibility work.

`stats::embed` constructs the documented lagged-observation matrix for supported atomic/list vectors
and atomic two-dimensional matrices. Differential evidence covers zoo's observed `embed(1:5, 3)`
rolling-window dependency, multivariate column-major ordering, integer/logical dimensions, measured
fractional-vector row truncation, zero-column matrices, namespace access, attribute removal, vector
storage, integer/logical-to-double and factor-to-character matrix coercion, and result-allocation
limits. The result columns contain current observations before older lags. Factor vectors, data
frames, arbitrary classed vectors other than `ts`, expression vectors, higher-rank arrays, raw/list
matrices, and fractional dimensions on nonempty matrices are rejected; long-vector storage and
undocumented edge diagnostics are not claimed.

`base::findInterval` returns interval indices for supported atomic `x` and `vec` inputs after
flattened double coercion. Differential evidence covers zoo's measured irregular-Date rolling-width
expression, default and left-open boundaries, rightmost closure, `all.inside`, duplicate/empty/
single/infinite break vectors, missing and `NaN` queries, numeric character coercion, matrix
flattening, attribute removal, logical control coercion, namespace access, and sortedness checks.
The implementation uses bounded binary search. Unsorted or missing breakpoints with
`checkSorted = FALSE`, platform-dependent unchecked missing-query behavior, recursive-list coercion,
warning text identity, and long-vector indices are not compatibility claims.

`stats::cycle` dispatches package-owned S3 methods before its regular-series default. The default
returns one observation cycle per vector element or matrix row, derives the initial cycle from
validated `tsp` start/frequency metadata with ties-to-even rounding, retains the `tsp` interval, and
keeps explicit `ts` class metadata. GNU R differential evidence covers zoo's two measured generic
call shapes through ordinary `ts` values and an independently declared `cycle.zoo` seam, including
fractional frequencies and lazy dots. Zoo's irregular indexes and method implementation,
namespace-hidden methods, data frames, zero-row series, and exhaustive floating-point boundaries
remain incomplete.

`stats::window` dispatches package-owned methods before its regular-series default. The owned path
aligns scalar or calendar-pair boundaries to the next/previous observation, preserves vector or
matrix shape, selects integral lower-frequency samples, warns and retains the source frequency when
resampling is incompatible, clamps out-of-range boundaries by default, and pads extension rows with
typed `NA` when `extend = TRUE`. GNU R differential evidence covers the measured zoo-facing generic
seam through an independently registered `window.zoo` method; it does not claim zoo's irregular
index implementation. Replacement `window<-`, interpolation or upsampling, hidden namespace method
tables, package index classes, and exact legacy diagnostics remain incomplete.

`na.omit` runs all eight measured calls across data.table and zoo by forwarding classed values and
lazy dots to package-owned S3 methods; NativR does not reproduce either package's implementation.
The independent default removes `NA` and `NaN` elements from atomic vectors and incomplete rows from
two-dimensional matrices and data frames. Names, factor levels/classes, rectangular axes, column
metadata, row names, and class-`omit` `na.action` positions/labels have differential coverage.
Regular `ts` inputs trim leading and trailing incomplete observations, adjust `tsp`, and reject
all-missing or internal-gap series. NULL, ordinary lists, unchanged higher-rank arrays, ignored
default dots, and dropped arbitrary default-vector attributes also have executable evidence.
`na.exclude`, `na.fail`, `na.pass`, namespace-hidden methods, POSIXlt and arbitrary external class
methods, long vectors, and exhaustive malformed recursive columns remain outside this increment.

`cut` classifies integer and double vectors against sorted explicit breaks or a requested count of
automatically expanded equal-width intervals. Right- or left-closed boundaries, `include.lowest`,
out-of-range values, NA/NaN propagation, infinite explicit endpoints, missing break removal,
duplicate-break rejection, `labels = FALSE`, custom/coerced labels, duplicate-label collapse,
ordered results, bounded `dig.lab` formatting, ignored default-method dots, and dropped input names
have differential coverage. Global custom S3 methods receive the original lazy arguments. Date,
POSIX, difftime, and dendrogram methods, missing factor levels supplied through labels, exhaustive
extreme-number label formatting, namespace-registered hidden methods, and exact legacy diagnostics
remain outside this increment.

`rle` returns classed `lengths`/`values` pairs for logical, integer, double, complex, character, and
raw vectors. Exact runs, infinities, signed-zero equality, empty typed inputs, and GNU R's separate
run boundaries for every NA or NaN value have differential coverage. Result lengths use integer
storage, result values preserve the input atomic storage type, and input names are dropped.
Attributes other than names, including matrix dimensions and factor classes, plus recursive inputs
are rejected consistently with the covered GNU R behavior. Character run values retain their owned
bytes and marks through ordinary extraction. Long-vector lengths beyond JavaScript's safe integer
range, exhaustive encoding-cache identity, and exotic NaN payload identity are not claimed.

`diff` computes repeated, positive whole-number lagged differences for logical, integer, double, and
complex vectors. Logical results use integer storage; integer overflow produces missing values and
one warning; names follow the later operands; and NA, NaN, infinities, empty inputs, and ignored
ellipsis arguments follow the executable GNU R 4.6 oracle cases. Two-dimensional inputs difference
down rows and retain adjusted dimensions and dimension names. Date results use day `difftime`
metadata, POSIXct results select seconds/minutes/hours/days units from the observed interval scale,
and regular `ts` inputs retain class while advancing `tsp` by `lag * differences / frequency`.
Explicit non-time-series classes are retained while other custom attributes are dropped, matching
the covered default behavior (including factor classes without copied levels). Fractional controls
are deliberately rejected rather than reproducing GNU R's historical recycling artifact. Non-numeric
inputs, higher-rank array semantics, POSIXlt, S3/S4 method dispatch, malformed time metadata, and
exhaustive exotic-class behavior are not claimed.

`as.vector` supports GNU R's `any`, logical, integer, numeric/double, complex, character, raw, list,
expression, and pairlist modes across the owned value model. Atomic default coercion removes names,
dimensions, classes, and custom attributes; factors use labels for `any`/character and codes for
numeric or recursive language modes. Scalar list/pairlist entries may be coerced to atomic modes,
while recursive modes preserve list metadata where the owned representation can carry it. Data
frames become ordinary column containers, NULL produces mode-specific empty values, and symbol/call
character or list conversion decomposes normalized language forms without exposing AST nodes.
Expression attributes, POSIXlt-specific dispatch, S4 methods, arbitrary recursive-to-atomic
coercion, class-specific methods, and exhaustive locale-dependent parsing/formatting remain outside
this increment.

`on.exit` captures cleanup expressions without forcing them and executes them when the active
closure leaves by normal completion, explicit `return`, or error. Replacement, clearing, `add`, R
4.6's default `after = TRUE`, explicit before-ordering, lexical evaluation environments, and
original result visibility are covered. Dynamic handler mutation during cleanup and exhaustive
interrupt/error precedence are not claimed. `I` prefixes one `AsIs` class on vectors, lists, and
pairlists while retaining existing classes and attributes; assigning attributes to NULL and other
non-attributable values remains an error.

`body` returns an owned normalized language value for NativR closures, resolves a supplied character
function name through the caller environment, and returns NULL for registered primitive/special
builtins. Missing-argument self-inspection, bytecode/source-reference metadata, and replacement via
`body<-` are not claimed. `unlist` recursively flattens owned atomic/list/pairlist values with GNU R
type promotion, missingness, nested-name construction, factor-level union, raw/complex support,
`use.names`, and one-level `recursive = FALSE` results. Arbitrary class dispatch, expression
vectors, and recursive non-vector objects remain outside this increment.

`transform` evaluates named additions lazily in the original list/data-frame mask with lexical
caller fallback, so sibling additions do not become visible to later expressions. Existing columns
may be replaced or removed with NULL, new columns retain order, compatible shorter vectors recycle,
and atomic/list inputs produce a data frame. Custom S3 transform methods, nested data-frame/list
column expansion, and broader zero-row corner cases are not claimed. `tail` supports positive,
negative, zero, and infinite counts for atomic vectors, lists, pairlists, expressions, matrices, and
data frames while retaining names, dimensions, dimension names, classes, and row names through the
owned subset model. Method-specific dots and arbitrary-dimensional array margins remain outside this
increment.

`within` evaluates one captured expression in a caller-backed list or data-frame mask, ignores the
expression result, applies existing-name replacements, and appends newly created names in GNU R's
reverse creation order. List results retain NULL-valued names, while data-frame results remove those
columns and enforce exact row recycling; row names, classes, lexical fallback, and extra attributes
are retained. Custom methods, atomic/environment inputs, duplicate-name corner cases, and method
dots remain outside this increment.

`parent.frame` traverses the dynamic closure-call stack, supports positive multi-level offsets, and
falls back to the global environment beyond the recorded stack. Its distinction from lexical
`parent.env` has differential coverage. `sys.call` returns owned R-language calls for the current
closure frame, positive absolute frame positions, and negative relative positions, with NULL for
position zero and GNU R-compatible out-of-range errors. Promise-evaluation and method-dispatch
frames, internal/native API frames, `sys.calls`, `sys.frames`, `sys.function`, and the remaining
`sys.*` call-stack API are not yet claimed. `t` transposes named vectors, factors, and
two-dimensional matrices in column-major order, swaps matrix dimension-name axes, and converts
atomic-column data frames to a common matrix shape. Arbitrary-dimensional arrays, custom methods,
and recursive/mixed data-frame columns remain outside this increment.

`formals` returns an owned pairlist for NativR closures and registered closure-like builtins,
preserving parameter names, missing-default symbols, literal defaults, and normalized
default-language values without exposing parser nodes. `formals<-` replaces closure parameters,
including call-rooted nested replacement such as `formals(f)[["x"]] <- value`; `environment<-`
replaces a closure enclosure. Primitive/special builtins and character inputs return NULL, while
other non-functions warn. Bytecode and source-reference metadata remain outside this increment.
`replicate` reevaluates its captured expression lazily for each iteration, truncates finite
non-negative counts, returns lists when `simplify = FALSE`, performs ordinary atomic/matrix
simplification, and appends an iteration axis for equal-dimensional results under `"array"`
simplification. `simplify2array` separately has differential evidence for stringi's equal- and
unequal-length list examples, scalar and vector promotion, outer/inner names, equal-dimensional
higher arrays, list matrices, zero-length exception controls, atomic identity, and invalid `higher`
inputs. Method/class-specific coercion, long vectors, arbitrary recursive objects, and exhaustive
diagnostic wording are not claimed.

`str2expression` and `str2lang` have differential evidence for the source strings measured in
backports, character-vector line joining, comments and blank input, expression/call/symbol/constant
result types, missing text, single-expression enforcement, and invalid type or syntax boundaries.
They reuse the owned parser and never expose its implementation nodes. Source references, encoding
metadata, exact parser diagnostic text, files/connections, and backports' private namespace
retrieval through `getFromNamespace` remain separate compatibility surfaces.

`textConnection` copies a character vector into a bounded, always-open input connection owned by the
evaluator session. `source` accepts that connection, a browser-memory path, an immutable package
resource path, or an already-built expression/call container. The complete program is parsed before
any expression runs; evaluation is sequential in the global, caller, or explicit environment, and
the invisible named result retains the last value plus its visibility. Measured echo and visible
result printing use bounded runtime output and ordinary S3 print dispatch. Exact formal names,
connection classes, cursor consumption, local/global assignment, parse atomicity, virtual `chdir`,
package execution, and Worker execution have evidence. Output text connections, URL/host-file input,
source-reference retention, abort recovery, exact echo deparsing, and every encoding remain outside
this increment.

`utils::URLdecode` has GNU R differential evidence for backports' measured `URLdecode("ab%20cd")`
call and NativR executable coverage for vectorized hexadecimal case, reserved characters, literal
plus signs, UTF-8 multibyte sequences, missing/empty/NULL values, attribute removal, NUL
termination, namespace lookup, and invalid input types. Malformed escapes and invalid UTF-8 are
explicit browser boundaries rather than claims of equivalence with platform-dependent raw-byte
strings.

`utils::glob2rx` has GNU R differential evidence for rprojroot's measured `glob2rx("DESCRIPTION")`
call and the documented wildcard/anchor examples. Coverage includes vectorized `?`/`*` translation,
terminal and leading trimming, the utility's deliberately limited regex-character escaping, Unicode
text, NULL and missing inputs, ordinary atomic/list/language coercion, attribute removal, namespace
access, scalar logical control coercion, invalid controls, and output limits. It produces regex text
only: filesystem matching, platform path rules, byte-encoding fidelity, undocumented escape
behavior, and general regular-expression execution are separate surfaces.

`sQuote` has GNU R differential evidence for httr's two measured `sQuote(req$url)` callback
expressions and the documented ASCII, UTF-8, TeX, and custom-quote modes. Coverage includes
vectorized owned-value character coercion, quoted missing values, NULL, attribute removal,
resettable `useFancyQuotes`, permissive fallback controls, custom strings in the first two
positions, and bounded output. NativR's locale is deterministically C, so logical `TRUE` does not
consult the host and uses ASCII unless `"UTF-8"` is requested explicitly. Custom `as.character`
dispatch, arbitrary host locales and encodings, exact non-C `q = TRUE` selection, `dQuote`, and
formula syntax that the normalized formula value no longer retains are separate surfaces.

`warningCondition` has differential evidence for backports' measured custom warning construction and
class-selective suppression expression, default and explicit calls, ordered additional fields,
duplicate and unnamed field names, atomic message/class coercion, custom class vectors, and vector
condition messages. The result uses NativR-owned list and class metadata and does not depend on GNU
R condition objects. Missing or empty custom class elements are explicitly rejected because the
owned class representation cannot preserve them. Arbitrary condition signaling, class-specific
calling-handler behavior, every constructor accepting `...`, and exact legacy diagnostics remain
separate compatibility surfaces.

`stats::qbinom` and `stats::qnorm` have differential evidence for openssl's two measured
uniform-to-distribution examples, registered namespace lookup, canonical quantiles, vectorized and
recycled parameters, lower/upper tails, log probabilities, boundary infinities, degenerate
distributions, longest-input metadata, empty inputs, missing values, NaNs, and domain warnings. The
normal path reuses the owned central-normal approximation; the binomial path uses an owned
regularized-beta CDF and discrete binary search. Binomial sizes above 10,000,000 and finite normal
log probabilities below the browser double range are explicit unsupported boundaries. Arbitrary
large-count precision, sub-double normal tails, exhaustive platform-libm agreement, and the wider
distribution family are not claimed.

`floor` returns double vectors for real logical/integer/double inputs, preserves owned attributes,
and distinguishes NA from NaN while retaining infinities. Complex inputs and factors retain GNU R's
rejection behavior; Math-group S3 dispatch is not claimed. `ceiling` runs the three measured
data.table/zoo calls and returns attribute-preserving doubles for real logical, integer, and double
vectors or arrays. Upward rounding, empty values, signed zero, NA/NaN/infinities, arbitrary
attributes, direct `ceiling.<class>` dispatch, basic `Math.<class>` dispatch, and factor,
Date/POSIXt, complex, and nonnumeric rejection have differential evidence. Dynamic `.Generic` and
`.Group` method bindings, the built-in data-frame Math method, S4 dispatch, and exhaustive
browser-libm boundaries are not claimed. `stats::approx` runs the two measured data.table/zoo
interpolation calls and has differential evidence for separate, one-vector, named-list, and
two-column-matrix coordinates; linear/constant methods; explicit or generated output coordinates;
one- and two-sided endpoint rules; boundary overrides; step fractions; missing-pair removal and
propagation; duplicate reducers; namespace lookup; and Date-class `xout` retention. `approxfun`, the
complete `xy.coords` coercion surface, list-valued ties, arbitrary coordinate classes, and
exhaustive non-finite/floating-point behavior are not claimed. `stats::nlm` runs rstan's measured
analytic-gradient callback shape and has differential evidence for lazy forwarded objective
arguments, scalar finite objective validation, initial analytic-gradient checking with numerical
fallback, central finite-difference gradients and Hessians, bounded BFGS line search, exact
post-dots controls, optional Hessian output, and GNU R-shaped result names and convergence codes.
Trace printing, non-finite or recursive parameters, more than 64 parameters, iteration limits above
10,000, every PORT diagnostic, and bit-for-bit numerical equivalence are not claimed. `stats::optim`
runs rstan's measured BFGS objective/gradient pair and has differential evidence for lazy forwarded
arguments, named callback parameters, supplied and numerical gradients, minimization and
`fnscale`-based maximization, parameter and derivative scaling, bounded iteration controls, named
function/gradient counts, optional named Hessians, exact post-dots control matching, and GNU
R-shaped results. Nelder-Mead, CG, L-BFGS-B, SANN, Brent, box bounds, trace output, method-specific
controls, more than 64 parameters, and native-algorithm trajectory identity are not claimed. `split`
partitions atomic vectors, lists, pairlists, expressions, linearized matrices, and data-frame rows
by one or more atomic grouping vectors. Factor level order, optional empty levels, `drop`,
missing-group removal, element and row names, recycling warnings, interaction separators, and
lexical combination order have differential coverage. Custom split methods, arbitrary grouping
objects, locale collation, and every interaction/recycling corner case remain outside this
increment.

`sin` maps logical, integer, double, and complex vectors, returns the corresponding double or
complex shape, preserves attributes and NA/NaN distinctions, and emits one domain warning for
infinite real inputs that produce NaN. Complex values use the browser-native trigonometric and
hyperbolic identity with explicit infinite-magnitude zero handling. `cos` follows the same
real/complex, attribute, missingness, and warning contract with the corresponding cosine identity.
`tan` adds the locked base `pi` constant required by the measured package expressions, finite and
large-imaginary stable complex identities, signed limits for infinite imaginary inputs, and GNU
R-shaped domain warnings for infinite real inputs. Math-group method dispatch, class-specific
methods, inverse trigonometric functions, and exhaustive platform-libm equivalence are not part of
this increment.

`factorial` has differential evidence for xfun's measured `factorial(10)` call, logical/integer/
double vectors, non-negative integer products, fractional and negative non-pole gamma values,
attributes, empty and missing inputs, overflow, negative poles, and call-level NaN warnings. The
real non-integer path is an independent bounded Lanczos approximation. Complex values, group
dispatch, exact near-pole platform behavior, `gamma`, `lgamma`, `lfactorial`, beta/polygamma
functions, and combinatorics remain separate compatibility surfaces.

`stats::lsfit` has differential evidence for xfun's measured `lsfit(1:9, 1:9)` result, vector and
matrix predictors, an intercept toggle, non-negative weights, tolerance-based rank detection,
complete-case omission, collinearity warnings, coefficient/residual shape, and the named classed QR
fields consumed by structural inspection. It uses NativR's owned pivoted QR solver. Multiple
response columns, `yname` matrix shaping, exact LINPACK reflector contents, `ls.print`, and
`ls.diag` remain outside this bounded surface.

`strwrap` has differential evidence for xfun's measured repeated-text example, vectorized input,
embedded paragraph breaks, sentence spacing, zero and positive widths, indentation, initial and
continuation prefixes, simplified and list-shaped output, missing/numeric coercion, and invalid
indentation errors. Input names and attributes are dropped as observed. Locale-dependent terminal
display widths, every Unicode width convention, and custom character encodings remain separate
compatibility surfaces.

`gl` truncates finite non-negative `n`, `k`, and `length` inputs, generates the repeated integer
factor-code pattern, accepts independently sized atomic labels, and produces ordinary or ordered
factor classes, including zero-group empty results. Allocation remains subject to NativR resource
limits. `merge` currently joins two data frames whose columns are atomic vectors. Default common
keys and explicit character, numeric, or logical `by`/`by.x`/`by.y` selectors, duplicate-key
Cartesian expansion, NA/NaN key matching, `all`/`all.x`/`all.y`, sorted or input-stable output,
suffixes, `no.dups`, and zero-key Cartesian products have differential coverage. Method dispatch,
recursive/list columns, locale-specific collation, custom row-name preservation, and non-NULL
`incomparables` remain outside this bounded join subset.

`as.factor` returns existing factors unchanged and otherwise builds a factor from atomic input.
Numeric inputs use numeric rather than lexical level ordering, missing values remain missing, names
are retained, and matrix dimensions are dropped. `as.ordered` runs generics' measured
`as.ordered(letters[1:5])` path using the installed lowercase base constant, adds the ordered/factor
class pair, returns already ordered factors unchanged, drops unused ordinary-factor levels,
preserves names, and performs S3 lookup with lazy dots before the default. Recursive list/expression
coercion, locale-specific character ordering, and the wider factor method surface are not claimed.

`as.array` supplies the S3 extension point used by rstan's measured `stanfit` documentation calls;
NativR does not implement or imitate rstan's package-owned method or objects. Custom methods receive
the forced dispatch object and otherwise lazy dots. The registered `as.array.default` accepts atomic
vectors, lists, factors, and pairlists, preserves existing arrays unchanged, attaches a
one-dimensional extent otherwise, moves ordinary vector names into one-axis dimension names, and
retains unrelated attributes. GNU R's errors for NULL, data frames, symbols, calls, environments,
and functions have black-box evidence. Expression-vector array coercion and arbitrary class-specific
package methods remain outside this bounded increment.

`reorder` coerces atomic or NULL inputs to factors, partitions an equally sized atomic `X` by the
original factor levels, and calls scalar `FUN` for every nonempty group with forwarded arguments.
Scores retain their original-level one-dimensional array metadata while stable ascending or
descending ordering remaps levels and codes; input names, missing factor entries, unused-level NA
scores, NA/NaN ordering, ordered-class defaults/overrides, character scores, and global custom S3
methods have differential coverage. Dendrogram methods, multivalued or complex scores, arbitrary
class-specific coercion, namespace-registered hidden methods, and locale-specific collation are not
claimed.

`chull` computes an independent browser-native planar convex hull and returns unnamed integer
indices in clockwise boundary order. Explicit atomic `x`/`y` coordinates recycle to their common
length without a fractional-recycling warning. Two-or-more-column matrices and data frames use their
first two columns; one-column matrices/data frames and ordinary atomic vectors use index/value
coordinates; complex vectors use real/imaginary coordinates; and named lists accept atomic `x`/`y`
components. Empty, singleton, duplicate, and collinear shapes have deterministic coverage, while
missing, NaN, or infinite coordinates are rejected. The exact representative index chosen for every
adversarial duplicate-coordinate arrangement, arbitrary recursive columns, class-specific coordinate
methods, long vectors, and floating-point robustness beyond ordinary double precision are not
claimed.

Matrices and arrays use validated dimensions and column-major storage. Matrix/array construction,
dimension names and axis labels, arbitrary-dimensional and coordinate-matrix selection/replacement,
`rbind`, `cbind`, and `as.matrix` are supported. `diag` constructs square or rectangular matrices
from scalar dimensions and recycled logical, integer, double, complex, or raw diagonal values,
including factor codes, scalar-list coercion, character-to-double warnings, and zero dimensions. It
also extracts type-preserving diagonals from two-dimensional atomic or list matrices and retains
names only when row and column dimension names match. Method dispatch and exotic class-specific
coercion remain outside this bounded diagonal subset. Data frames use named list columns, row names,
rectangular and coordinate-matrix selection/replacement, common-type cell extraction, and scalar
recycling. `expand.grid` accepts direct atomic vectors or one list of atomic vectors, varies the
first input fastest, preserves factor inputs, optionally converts character inputs to factors in
first-occurrence level order, handles empty Cartesian products, and can attach dimension metadata.
Recursive grid values, class-specific coercion, locale formatting, and every `out.attrs` display
corner case remain outside this bounded subset. `tibble` and formula-header `tribble` provide
construction subsets, not the full tibble package API.

Factors support explicit levels, labels, exclusions, ordering, level dropping, and bounded
`as.factor` coercion. Model contrasts and the full factor method surface remain outside this
contract. Ellipsis arguments stay lazy and may be forwarded from any closure position; unnamed
arguments after `...` bind to dots while later formals require exact names. Ordinary formals use GNU
R's exact, unique-partial, then positional matching phases. Omitted arguments retain their missing
state through defaults and promise forwarding, and `missing()` observes that state without forcing
the promise. `match.arg` selects exact or unique-partial character requests from atomic choices,
retains the selected choice storage type and names, handles NULL/default-vector selection, and
supports multiple-result filtering through logical or `"all"` controls. When choices are omitted, it
evaluates the matching caller-formal default through the owned closure frame, including lexical
defaults, without source reflection or generated code. Recursive choices, non-symbol caller
expressions, exhaustive duplicate/missing tables, and exact legacy diagnostic text are not claimed.

Leftward, rightward, and non-local assignment are supported for identifiers, direct replacement
targets, and simple one-dimensional subset/member replacement chains. Non-local assignment searches
lexical parents, creates an otherwise absent binding in the global environment, and rejects attempts
to mutate the locked built-in environment. Direct replacement-function assignment invokes and
rebinds through `names<-`, `attr<-`, `class<-`, and `dim<-`. Replacement-function targets still
require a direct identifier as their first argument; nested replacement-function calls and GNU R's
shorter-name padding remain outside the boundary.

Complex literals and `NA_complex_` use parallel real/imaginary storage with an independent missing
mask. Arithmetic, equality, logical coercion, recycling, indexing/replacement, public Worker
transport, `complex`, `as.complex`, `is.complex`, `Re`, `Im`, `Mod`, `Arg`, and `Conj` have
executable coverage. This is an initial complex surface, not full GNU R complex special-function
coverage.

Raw vectors use byte storage without a missing mask. `raw`, `as.raw`, `is.raw`, `rawToChar`,
`charToRaw`, `rawShift`, `intToBits`, and `rawToBits` cover the initial constructor/coercion surface
together with bytewise logical operators, indexing, replacement, and public transport. `rawToBits`
has differential evidence for openssl's measured raw-to-logical conversion,
least-significant-bit-first byte order, eight raw outputs per byte, attribute removal, empty input,
and strict input validation. `intToUtf8` converts coercible scalar code-point inputs to combined or
elementwise browser-native Unicode strings, including zero omission, missing/invalid points,
supplementary-plane characters, and GNU R's opt-in adjacent surrogate-pair handling. Character
conversion uses exact owned bytes rather than a host codec. Character vectors carry per-element
`unknown`, `latin1`, `UTF-8`, or `bytes` marks; ASCII and missing values canonicalize to `unknown`.
`Encoding`, `Encoding<-`, `enc2utf8`, and `enc2native` have GNU R 4.6 differential evidence for
query, exact accepted labels, unrecognized-label fallback, positive-length replacement recycling,
attribute preservation, bytes reinterpretation, and byte-mark preservation. General `iconv`, locale
databases, platform-native encodings other than deterministic browser UTF-8, Unicode normalization,
malformed-sequence display, and complete encoding-aware string semantics are not claimed.

Core storage inspection covers `typeof`, `mode`, `is.null`, atomic storage predicates, `is.numeric`,
`is.atomic`, `is.list`, `is.function`, `is.environment`, and bounded `is.vector` mode/attribute
checks. Atomic coercion covers `as.logical`, `as.integer`, `as.double`/`as.numeric`, and
`as.character`, with executable NA/NaN, complex, factor, raw, warning, and integer-range cases.
General S3/S4 coercion dispatch beyond the bounded `hexmode` chain, list coercion, option-dependent
numeric formatting, and all locale-specific parsing remain outside this increment.

Zero-filled logical/integer/double/character constructors, the corresponding common `vector()`
modes, `lengths()`, and matrix/array/data-frame/factor/recursive predicates have executable
coverage. `expression()` and `vector("expression", n)` construct owned normalized syntax, while
`vector("pairlist", n)` constructs the GNU R-compatible NULL-filled pairlist shape. As in GNU R,
`lengths()` rejects pairlists rather than treating them as ordinary lists.

`switch` provides lazy character/numeric branch selection, a single unnamed default, and
missing-alternative fall-through. Unmatched-switch visibility is not yet equivalent to GNU R.

`quote()` captures one normalized expression without forcing it. Identifiers become owned symbol
values; calls and other compound syntax become owned language values. `eval()` evaluates those
values, including expression vectors in sequence, in the caller environment, an explicitly supplied
environment, or named list, pairlist, and data-frame masks with an optional enclosure. `evalq()`
captures its expression without eager forcing and applies the same caller, explicit, `NULL`, mask,
enclosure, mutation, and visibility rules. Numeric call-frame selectors remain outside this bounded
evaluation subset. `as.name`/`as.symbol`, `as.expression`, `call`, `as.call`, `deparse`, and
`deparse1` provide initial owned-language construction and inspection. `substitute()` recursively
replaces unforced closure promises or named list/data-frame bindings and expands ellipsis without
forcing its source expressions. `match.call()` reconstructs the active R-syntax closure call with
canonical formal names, optional ellipsis expansion, and no promise forcing. Root, child, parent,
current-frame, and closure environments participate in lexical `eval()`. `do.call()` invokes a
callable from an ordinary list, `force()` and `forceAndCall()` expose selective promise forcing, and
`delayedAssign()` installs a memoizing promise with separate evaluation and assignment environments.
Environment `$`/character-`[[` access, `get`, `get0`, `exists`, `assign`, `list2env`,
`as.environment`, and `environmentName` cover initial binding and conversion behavior, including
inherited lookup and GNU R's eager evaluation of an explicitly supplied `get0(ifnotfound=)` value.
Numeric and exact-name `as.environment()` selectors resolve the standard search list, with stable
supported-export package environments and parent links. `ls` and its identical `objects` alias
enumerate only local bindings without forcing promises, honor caller/explicit/search-list selection,
hidden-name and pattern filtering, and deterministic sorted or unhashed order, and expose the exact
GNU R 4.6 formals. `as.list` performs custom S3 dispatch, while `as.list.environment` enumerates
only local bindings, supports `all.names` and `sorted`, returns an attribute-free empty list when
appropriate, and forces selected promises in result order. Non-hashed environments retain reverse
binding order and hashed environments retain deterministic insertion order when sorting is disabled.
`search()` exposes the deterministic standard nine-entry GNU R startup path and resets with the
session. Attached-package lookup mutation, `attach`, `detach`, `searchpaths`, locked/active
bindings, search-path environment mutation, exact GNU R hash-bucket order, active-binding
enumeration, locale collation and GNU TRE regexp edge cases, `do.call(quote = TRUE)`, and pairlist
call arguments remain outside this increment. `typeof`, `mode`, `length`, `lengths`,
`is.symbol`/`is.name`, `is.expression`, `is.language`, `is.call`, `is.recursive`, and the Worker
boundary cover this value surface. Public snapshots contain only a stable name or R-like source
string, never Tree-sitter or normalized-AST nodes. Pairlists have their own runtime and wire type,
exact tags, coercion, predicates, lazy `alist()` construction, one- and two-dimensional extraction,
GNU R-compatible replacement type transitions, arbitrary runtime attributes, classes, dimensions,
and dimension names. `parse(text=)` creates owned expression vectors from atomic text, honors
bounded `n` parsing, and drives the same normalized evaluator; parser-backed public
symbol/language/expression records are accepted as inputs. File/connection parsing and
source-reference preservation, `bquote`, inherited substitution lookup, alternate
`match.call(definition=, call=, envir=)` inputs, pairlist rectangular replacement and out-of-range
extension corner cases, generic pairlist attributes across the public snapshot, GNU R
primitive-binding failures under an `emptyenv()`-terminated evaluation chain, full language
attributes/indexing, and numeric call-frame evaluation selectors remain outside this increment.

The apply/map surface comprises `apply`, `lapply`, `sapply`, `vapply`, `mapply`, `Map`, `Reduce`,
`Filter`, `by`, `aggregate`, `ave`, and `tapply`. Current implementations target atomic vectors,
lists, matrices, and the documented grouping shapes. `ave` partitions an atomic input by zero or
more same-length atomic grouping vectors, leaves missing-group positions unchanged, resolves a
direct callable or one function name, and replaces each group with a nonempty atomic scalar or
vector result using ordinary recycling and promotion. Forwarding extra arguments to its function,
class-specific method dispatch, and all simplification or grouping corner cases are not claimed.

`base::tapply` has differential behavioral evidence for zoo's measured
`tapply(1:ncol(x), screens, f)` screen-range path. Single and multiple grouping vectors,
factor-level order, missing-group omission, named dimensions, scalar atomic simplification, typed
empty-cell defaults, unsimplified list arrays, forwarded arguments, function-name resolution,
`FUN = NULL` group codes, list-array `[[` extraction, length errors, empty indexes, and allocation
bounds have coverage. Formula indexes, custom split methods, raw/list-scalar coercion corners, long
vectors, and arbitrary class-specific simplification remain unsupported.

Date conversion accepts strict ISO dates and UTC/GMT date-times. `ISOdate` and `ISOdatetime` recycle
real component vectors, preserve fractional seconds and POSIXct/POSIXt `tzone` metadata, and map
missing, non-finite, non-integral calendar, out-of-range year, or invalid date/time components to
missing results. `ISOdate` defaults to GMT noon; `ISOdatetime` requires clock components and maps
its documented empty current-zone label to deterministic UTC arithmetic in the browser while
preserving `tzone = ""`. `as.POSIXlt` exposes the owned 11-component calendar representation, with
POSIXlt-specific `length`/`names` behavior and zero-based month/year day fields. `strptime` accepts
the documented UTC parsing subset. `strftime` recycles values and formats, preserves input names,
converts through custom `as.POSIXlt` methods, distinguishes missing from non-finite seconds, and
formats bounded calendar, clock, week, epoch, timezone, and fractional-second tokens in
deterministic C/UTC or C/GMT form. `as.difftime` accepts plain numeric intervals with explicit units
or character intervals with recycled 24-hour formats, selecting the documented automatic unit or
converting to explicit seconds, minutes, hours, days, or weeks while retaining names and missing
values. `difftime` now shares those units, automatic selection, partial unit matching, class/unit
attributes, names, and vector recycling warnings for Date, POSIXct, and numeric epoch values. Named
time zones for date-bearing character intervals, POSIXlt conversion, daylight-saving databases,
leap-second tables, locale-specific `%X` parsing/formatting, alternate digits/eras, ISO week-year
tokens, the complete difftime arithmetic/method family, and unbounded output are outside the current
subset. `Sys.Date` and `Sys.time` deliberately expose the host clock.

`weekdays` has differential coverage for the corresponding data.table IDate grouping-label calls,
explicit Date inheritance, custom S3 forwarding, Date/POSIXct/POSIXlt and direct-method inputs,
deterministic C-locale full/abbreviated output, recycled logical coercion, names, missing/non-finite
values, zero lengths, and bounded errors. Named-zone/DST calendars, localized weekday catalogs,
host-locale probing, malformed external POSIXlt objects, and the broader calendar-extraction family
remain outside this increment.

`anyDuplicated` has differential coverage for data.table's measured `by = c("A", "B")` extension
shape, default atomic/list/data-frame behavior, custom S3 forwarding, forward/reverse first
positions, factors, names, `NA`/`NaN`, incomparables, empty values, and bounded control errors.
Long-vector index representation, cyclic structures, external-object identity, array methods, and
the complete package-method ecosystem remain outside this increment.

`rep.int` has differential coverage for data.table's measured `rep.int(n, len - n)` call, scalar and
per-element counts, fractional truncation, character/complex coercion, atomic/list/factor/
expression storage, missing values, empty vectors, attribute rules, custom dispatch, and bounded
invalid inputs. Long vectors beyond runtime limits, S4-contained vectors, pairlists, `NULL`, and the
complete internal-method ecosystem remain outside this increment.

`methods::representation` has differential coverage for data.table's
`representation(x = "character", dt = "data.table")` declaration and its consumption by the bounded
`setClass`/`new` path. Parent and slot ordering/names, empty calls, empty/`NA` class strings,
backtick slot names, duplicate declarations, scalar-character validation, and missing arguments are
covered. Complete GNU R S4 class-definition semantics and package namespace loading remain outside
this increment.

`methods::showClass` has differential coverage for the four measured Rcpp/rstan inspection calls at
the reusable class-registry boundary. GNU R 4.6 evidence covers exact formals, global/package
location labels, direct and inherited slot tables, representation-declared parents, extends and
known-subclass lines, virtual classes, custom property labels, error shapes, captured output, and
invisible `NULL`. A source-only package imports `setClass`/`showClass`, declares its class while its
namespace loads, and queries the same metadata unchanged. External/native Rcpp and rstan classes,
complete `classRepresentation` objects, validity, unions, sealed classes, exact wide-console
wrapping, multiple dispatch, and the full methods cache remain outside this increment.

`trunc` has differential coverage for data.table's measured `trunc(seqtimes, "hours")` extension
shape using an independently authored `ITime` method, direct and Math-group dispatch, toward-zero
real values, logical/integer double output, signed zero, missing/non-finite values, empty input,
metadata, eager default dots, and bounded invalid types. NativR supplies the generic seam rather
than data.table's class or method; built-in POSIXt unit truncation and complete Math-group semantics
remain outside this increment.

`utils::type.convert` has differential coverage for the `type.convert(x, as.is = TRUE)` callback in
data.table's measured `tstrsplit` example. Default logical/integer/double/complex inference,
character/factor fallback, NA/blank and decimal controls, arrays, lists, data frames, custom S3
methods, and bounded errors are covered. Precision-loss decisions for every long numeral,
locale-specific syntax, per-column control vectors, recursive cycles, and the complete utils method
ecosystem remain outside this increment.

`withVisible` has differential coverage for Shiny's two measured stack-trace example calls plus
visible literals, assignments, invisible calls, nested results, blocks, `evalq`, lazy closure and
ellipsis forwarding, and already-forced promises. It returns the GNU R-shaped named two-element list
and does not evaluate the captured expression more than once. Unsupported syntax and exact legacy
diagnostic text remain outside this increment.

`strftime` has differential coverage for Shiny's measured `strftime(Sys.time(), " [%F %T] ")`
logging shape, fixed UTC/GMT instants, recycled formats, default Date/POSIX formatting, C-locale
month and weekday names, common composite/week/epoch/timezone tokens, fixed and option-selected
fractional seconds, names, missing/non-finite inputs, timezone labels, empty inputs, custom
`as.POSIXlt` dispatch, and bounded invalid-format/timezone/control errors. The host clock is covered
separately by `Sys.time`; named-zone/DST and host-locale behavior are not claimed.

`as.raster` has differential coverage for ragg's measured `plot(as.raster(raster))` conversion
input, excluding the still-unimplemented `plot.raster` method. Character capture matrices retain
their color strings while switching to row-first raster storage; numeric/logical/raw grayscale,
RGB(A) arrays, reshaping, S3, predicates, identity, missing values, scaling, and the downstream
`rasterImage` byte order are covered. Device capture, `plot.raster`, raster indexing/replacement,
and the complete graphics method family remain outside this increment.

The rank-421 increment adds GNU R differential evidence for ragg's measured zero-argument
`dev.flush()` call shape and NativR-owned evidence for the supported browser device's paired
`dev.hold()` protocol. Nested levels, cross-evaluation suppression, ordered release, reset,
namespace access, scalar/vector level coercion, missing input, visible integer returns, and pending
raster memory limits are covered. This does not claim ragg's `agg_webp_anim` device, animation
encoding, specialized plot methods, or arbitrary GNU R graphics-device equivalence.

The rank-422 increment adds GNU R differential evidence for ragg's measured `recordPlot()` and
`replayPlot(recorded)` call shapes plus NativR-owned device evidence for bounded capture and replay.
Public recorded-object shape, package metadata retention, replay invisibility, page/window/raster
order and bytes, held replay, reset, namespace access, malformed input, and allocation limits are
covered. This is a deliberately independent same-runtime format; it does not claim GNU R
recorded-plot serialization, cross-version/device replay, automatic package reload/attachment,
`print.recordedplot`, ragg's native device implementation, or general graphics equivalence.

The rank-423 increment adds GNU R differential evidence for posterior's two measured
`quantile(x, ppoints(10))` examples and the public `stats::ppoints` contract. Default switching at
10/11, observation-vector lengths, fractional scalar endpoints, explicit numeric/complex offsets,
recycling warnings, names/dimensions, missingness, namespace access, lazy nonpositive counts,
invalid inputs, and allocation limits are covered. This does not claim posterior's `rvar` type or
quantile methods, GNU R long-vector capacity, or every undocumented class-specific arithmetic edge.

The rank-424 increment adds GNU R differential evidence for posterior's measured `chol.rvar`
extension point and the browser-owned real-matrix `chol.default`. Canonical and upper-only factors,
scalar/data-frame inputs, dimnames, positive-definite errors, semi-definite pivot/rank results,
warnings, namespace/default-method access, lazy dots, eager tolerance, and defunct/control/type
boundaries are covered. Posterior's random-variable implementation, exact LAPACK identity and error
codes, sparse matrices, tensor decompositions, complex inputs, and broad package methods remain
incomplete.

The rank-425 increment adds GNU R differential evidence for posterior's measured vectorized
`stats::pnorm` call. Vectorized/recycled quantiles, means, and standard deviations, lower and upper
tails, direct log probabilities through 50 standard deviations, longest-input metadata,
zero-variance limits, empty and missing inputs, domain warnings, namespace access, and invalid
numeric types are covered. Complex/class-specific inputs, all subnormal and platform-libm rounding,
general distribution dispatch, and `dnorm`/`rnorm`/other normal-family completeness remain
incomplete.

The rank-426 increment adds GNU R differential evidence for posterior's measured scalar
`stats::rgamma` calls. Result-length rules, recycled shape/rate/scale parameters, rate-scale
equivalence and conflict handling, deterministic reseeding, moment checks, zero/infinite limits,
empty parameters, missing/NaN/domain warnings, namespace access, and invalid numeric types are
covered. Exact GNU R random-stream identity, exhaustive underflow and long-vector behavior,
class-specific arguments, and the wider gamma family remain incomplete.

The rank-427 increment adds GNU R differential evidence for posterior's measured vertical
`graphics::segments` call. Omitted endpoint defaults, coordinate/style recycling, color and
line-pattern resolution, missing/non-finite omission, zero-length and invalid-input boundaries,
namespace access, bounded graphics payloads, Worker transport, Canvas pixels, hold/flush, and
same-session record/replay are covered. Coordinate classes, log axes, complete clipping/margins,
general `...` graphical parameters, device-specific dash metrics, and cross-device pixel identity
remain incomplete.

The rank-428 increment adds GNU R differential evidence for rprojroot's measured
`utils::glob2rx("DESCRIPTION")` call. Vectorized wildcard and anchor conversion, documented
head/tail trimming, limited regex punctuation escaping, Unicode, missing/NULL values, atomic/list/
language coercion, dropped attributes, namespace access, scalar controls, errors, and output limits
are covered. Filesystem traversal, platform-specific path matching, arbitrary byte encodings, and
undocumented regex-escape edge cases remain incomplete.

The rank-429 increment adds GNU R differential evidence for httr's two measured `sQuote(req$url)`
calls. Deterministic ASCII output, explicit UTF-8 and TeX pairs, arbitrary custom single-quote
pairs, resettable option selection, owned-value coercion, missing/NULL values, attribute removal,
errors, and resource limits are covered. Host-locale-dependent selection, encoding metadata, custom
coercion methods, `dQuote`, and lossless reconstruction of every formula surface remain incomplete.

The rank-430 increment adds GNU R differential evidence for the `stats::family` S3 generic seam used
by distributional's measured `family(dist)` call. Namespace lookup, lazy forwarding, ordered
class/`NextMethod`/default dispatch, visibility, errors, and package-boundary behavior are covered.
Distributional's object constructors and method, general package loading, `family.glm`, and complete
GLM-family behavior remain incomplete.

The rank-431 increment adds GNU R differential evidence for `utils::View` using rstudioapi's
measured terminal-context display call shape. Data-frame, vector, list, matrix/array, and custom
`as.data.frame` coercion; non-empty extent checks; title validation; invisible `NULL`; structured
inline/Worker events; resource limits; and Playground rendering are covered. Desktop viewer windows,
editing, arbitrary package formatting methods, and RStudio terminal APIs remain incomplete.

The rank-433 increment adds GNU R differential evidence for diffobj's measured
`file.path(path.expand("~"), "web", "mycss.css")` expression. Vectorized `file.path` coercion,
recycling, separator selection, missing and zero-length components, plus strict character-only
`path.expand`, attribute removal, errors, and resource limits are covered. A browser session has no
runtime home directory, so NativR follows R's documented unknown-home rule and preserves leading
tildes. Host-home discovery, path normalization, existence checks, filesystem access, platform
encodings, and Windows-specific trailing-separator cleanup are not claimed.

The rank-434 increment adds GNU R differential evidence for diffobj's measured `setOldClass("zulu")`
declaration before its `guidesPrint` S4 method. Session-local class-chain registration, inherited
single-object S4 dispatch, inherited explicit coercion lookup, prototype and environment arguments,
namespace access, invisible return behavior, input errors, and explicit unsupported bridge
boundaries are covered. Namespace-scoped metadata, `test = TRUE` verification, explicit `S4Class`
bridges, multiple dispatch, full class representations, and methods cache behavior are not claimed.

The rank-435 increment adds GNU R differential evidence for diffobj's measured
`show(StyleAnsi256LightYb())` extension shape using independently defined constructor and method
fixtures. Exact and inherited old-class method lookup, output events, visible/invisible method
results, namespace access, deterministic fallback display, arguments, and output limits are covered.
Diffobj's class/style implementations, ANSI/HTML capability handling, pagers, automatic display of
bare S4 expressions, multiple dispatch, and the complete methods display protocol are not claimed.

The rank-436 increment adds GNU R differential evidence for httpuv's measured
`cat(capture.output(str(as.list(req))), sep = "\n")` request-inspection expression. In-memory stdout
capture, visible expression printing, block visibility, partial and empty lines, nested captures,
message-stream selection, unique type prefixes, split duplication, namespace access, argument
errors, and byte limits are covered. The measured `cat` path also verifies GNU R's
newline-containing separator terminator rule. Both functions now target bounded browser-memory paths
and file connections with differential evidence. Host files, warning/error sinks, arbitrary print
methods, and the complete connection/sink stack are not claimed.

Formula values record response, variables, expanded terms, interactions, transformations, and
intercept state without exposing Tree-sitter nodes. `as.formula` accepts one character expression or
an owned formula-language value and attaches the caller, an explicit environment, or `NULL`; an
existing formula is returned unchanged, and a multi-string character vector follows GNU R's
deprecated first-element behavior with a warning.

The initial model vertical slice builds one-response model frames from a formula environment or an
explicit data frame. `lm` covers main terms, transformations handled by the normalized evaluator,
interactions, dot expansion, intercept removal, numeric/logical predictors, treatment-coded
factor/character predictors, row omission, `subset`, `weights`, `offset`, rank-deficient fits,
fitted values, residuals, and prediction against compatible `newdata`. `aov` adds the bounded
`c("aov", "lm")` object shape. `coef`/`coefficients`, `fitted`/`fitted.values`, `resid`/`residuals`,
`predict`, and `model.matrix` expose the ranked model path and allow ordinary S3 methods.
Differential cases cover numeric and factor designs, weighted/offset fits, singular coefficients,
formula environments, missing rows, design matrices, prediction, object fields, and custom methods.
This is not a claim for the complete `terms`/`model.frame`/contrast family, multivariate responses,
every `na.action`, QR/LAPACK identity, summaries, diagnostics, ANOVA tables, or the full stats
modeling ecosystem.

`stats::weights` is an ordinary S3 generic. Its default method reads a `weights` component from
owned lists and pairlists using exact then unique-partial member matching, returns `NULL` when no
unambiguous component exists, and restores omitted positions for the bounded `na.exclude` integer
shape. The `lm` method exposes fitted prior weights or `NULL` for an unweighted fit. Extra arguments
remain lazy and are forwarded to package-defined methods, covering the measured loo/posterior
`log`/`normalize` call shapes without implementing either package's numerical method. Arbitrary
`napredict` classes, non-list foreign objects, and package-specific weighting algorithms are not
claimed.

`stats::family` has GNU R differential evidence for the S3 extension point used by distributional's
measured `family(dist)` example. Coverage includes stats-namespace lookup, exact/partial object
argument matching, lazy dots, ordered class lookup, `NextMethod`, a user-defined default, method
visibility, and no-method/missing-object boundaries. Distributional construction, its package-owned
`family.distribution` method and vector classes, namespace loading, built-in `family.glm`, and
complete GLM family objects are not claimed.

`utils::View` has GNU R differential evidence for coercible non-empty tables, custom `as.data.frame`
dispatch, title and missing-input boundaries, and invisible return behavior. NativR adds an explicit
browser host contract: character-formatted named columns and optional row names are retained in
`evalDetailed().dataViews` and delivered to `onDataView` in inline and Worker execution. This does
not claim GNU R's platform-specific desktop viewer, editing, complete `format.data.frame` method
coverage, or any RStudio API implementation.

`utils::browseURL` has GNU R differential evidence for callable-browser dispatch, lazy URL
forwarding and percent encoding, invisible results, `browser = "false"`, condition validation, and
input boundaries. NativR replaces the desktop program launch with an explicit browser host contract:
ordinary locations appear in `evalDetailed().browseRequests`, while existing browser-memory files
include canonical paths, MIME types, and bounded byte snapshots; `onBrowse` receives the same final
events in inline and Worker execution. External fetching, automatic navigation, process execution,
host files, platform browser selection, and exact verbose diagnostics are not claimed.

`file.path` has GNU R differential evidence for vectorized construction, ordinary recycling,
separator selection, owned-value coercion, missing and zero-length components, attribute removal,
and argument errors. `path.expand` has differential evidence for strict character input, missing
values, attribute removal, and argument boundaries. Its host-dependent successful expansion is
replaced by an explicit browser rule: with no available home directory, input text is unchanged.
Neither function claims normalization, path resolution, filesystem access, platform encoding
behavior, or Windows-specific trailing-separator cleanup.

`methods::setOldClass` has GNU R differential evidence for diffobj's `zulu` guides-method
registration, old-style class-chain inheritance in single-object S4 dispatch, inherited `setAs`
lookup, prototypes, explicit environment arguments, namespace access, invisible `NULL`, and invalid
inputs. Registrations are evaluator-session-local. NativR explicitly rejects registration
verification and explicit S4 bridges rather than treating them as successful metadata operations;
namespace ownership, multiple dispatch, complete S3/S4 interoperability, and cache invalidation are
not claimed.

`methods::show` has GNU R differential evidence for diffobj's measured style-display call shape when
the package constructor and display method are independently registered. The generic selects exact
or inherited session methods, transports their text through the bounded output journal, and
preserves their returned value and visibility. Its fallback prints deterministic owned-value text
and returns invisible `NULL`. This does not claim diffobj's classes, style rendering, terminal/ANSI
discovery, HTML pagers, automatic bare-expression S4 display, multiple dispatch, or the complete
methods display contract.

`utils::capture.output` has GNU R differential evidence for stdout and message selection, visible
expression printing, partial-line reconstruction, nested calls, `split`, argument matching, result
visibility, and httpuv's measured `str(as.list(req))` capture. Captured events remain private until
returned as a character vector or re-emitted by `split`; both capture storage and public output are
bounded. Filesystem/connection output and the complete warning/error sink protocol are not claimed.

`utils::demo` has GNU R differential evidence for the empty package catalog returned by
`demo(package = character())`, including its `packageIQR` class, fields, zero-row results matrix,
and column labels. Supplying a topic, external package, or host library location raises an explicit
unsupported-feature error. External demo discovery and script execution require package-loader and
virtual-resource support and are not claimed.

Usage-ranked `utils::example()` has GNU R 4.6 differential evidence for its 15 formal names and the
warning/invisible-`NULL` missing-topic result. Standard source-package `man/*.Rd` files are
independently extracted at build time into deterministic topic/alias/title and controlled-code
records. The runtime searches active virtual libraries or explicit `package`/`lib.loc`, loads the
matching bundle, supports symbol or character topics, returns prepared code with `give.lines`,
evaluates in the global or a fresh local environment, and skips `dontrun`/`donttest` blocks unless
explicitly enabled. An unchanged `generics 0.1.4` artifact supplies external discovery evidence, and
the Worker Playground executes an extracted package example. Interactive HTML/prompting, exact GNU R
Rd conversion/source references/echo formatting, `setRNG` preservation, `catch.aborts`, core-package
help databases, and execution beyond the supported R surface remain incomplete.

Usage-ranked `utils::vignette()` has GNU R 4.6 differential evidence for its four formal names,
empty `packageIQR` catalog, result matrix labels, missing-topic warning/value, and specific
seven-field `vignette` object shape. The build-time package tool independently indexes retained
`inst/doc` R Markdown, Sweave, `*.pdf.asis`, extracted R, and prebuilt HTML/PDF resources; runtime
discovery respects installed/attached virtual packages, explicit `package`, `lib.loc`, and `all`. An
inline package artifact, unchanged `withr 3.0.3`, and the Worker Playground exercise topic discovery
without GNU R, runtime network access, or document builders. Building a raw development `vignettes/`
directory, installed lazy help databases, `print.vignette`, automatic viewer dispatch, and
byte-identical document rendering remain incomplete.

The inference extension retains a weighted upper-triangular QR factor, derives residual variance and
coefficient covariance without requiring the model frame, and exposes `vcov`, `confint`, and
`df.residual`. Differential cases cover complete/incomplete covariance matrices, aliased
coefficients, weighted and essentially perfect fits, numeric/character/reordered parameter
selection, confidence levels and dimnames, `model = FALSE`, and custom S3 methods. Profile
likelihood intervals, non-`lm` default covariance protocols, robust/sandwich covariance, every
summary statistic, and inference for generalized or nonlinear model families are not claimed.
Formula environment serialization remains outside the public snapshot.

Native `|>` evaluates the left side once and inserts it as the first call argument. `%>%`
additionally supports a bare callable and one dot insertion; it does not reproduce every magrittr
rewriting rule.

S3 dispatch supports `UseMethod`, ordered class lookup, `.default`, and `NextMethod`. The bounded S4
surface supports `setClass`, single-object `setGeneric`/`setMethod`, `standardGeneric`, `new`, and
explicit single-source `setAs`/`as` coercions. The measured S7 generic-definition body has
differential evidence for explicit/`ANY` method selection, formals, defaults, dots, missing methods,
and calls outside a generic body. Multiple dispatch, full signature/class inheritance, automatic
package registration, method caching, primitive/group generics, and the full methods/S7 protocols
are not claimed. `R6Class` supplies a generator with `$new` and public-field defaults, but not
mutable `self`, private/active bindings, or reference semantics. `new_class` and `new_vctr` provide
vctrs-compatible class construction shapes, not the complete vctrs or S7 packages.

Applications may provide `PureRPackageBundle` records at `createR()` initialization. DESCRIPTION and
NAMESPACE metadata, package-relative `R/*.R` source, and optional base64 resources are validated and
bounded before the Worker parses source into normalized ASTs. The loader provides dependency-ordered
isolated namespaces, DESCRIPTION version checks, `import`/`importFrom`, explicit exports and
internals, `S3method`, `.onLoad`, `.onAttach`, `library`, `require`, `requireNamespace`, namespace
queries, `utils::packageName`, immutable `system.file` virtual paths, attachment search-path
entries, bounded text reads for DESCRIPTION/NAMESPACE/R source/resources, and reset/reload behavior.

Installed-version lookup has GNU R 4.6 black-box evidence.
`utils::packageVersion(pkg, lib.loc = NULL)` returns a length-one classed package version for core
namespaces and validated pure-R bundle definitions without forcing namespace initialization; absent
packages fail with the package-named error. `getRversion()`, `numeric_version()`,
`package_version()`, character conversion, formatting, printing, concatenation, missing propagation,
padded vectorized relational comparison, and `utils::compareVersion()` share one owned component
parser. Explicit unsupported boundaries include host library discovery, non-`NULL` library
locations, the complete numeric-version indexing, replacement, summary, ordering, data-frame, and S3
method surface, and any inference that version visibility proves package execution compatibility.

The Node-only `@nativr/package-tools` build path accepts standard source directories and `.tar.gz`
archives, or resolves required `Depends`/`Imports` from a CRAN-like `PACKAGES` index. It enforces
archive/file/byte/package limits, rejects links, native/JVM code, install hooks, `LinkingTo`,
`useDynLib`, invalid paths, and unsupported NAMESPACE directives, preserves package resources and
license metadata, and emits deterministic SHA-256 artifacts plus a dependency lock. The browser
runtime remains network-free. Digest-pinned opt-in executable tests cover unchanged
`pkgconfig 2.0.3`, `generics 0.1.4`, and `withr 3.0.3` sources. They prove the
repository-to-namespace path, package-owned S3 dispatch, and generated state-restoring wrappers
through `with_options()` without package patches.

Package admission is not universal execution compatibility. Package `data/*.R`, `.csv`, `.tab`,
`.txt`, and XDR/gzip `.rda`/`.RData` discovery/loading is supported through `utils::data`, including
explicit target environments and overwrite protection. `R/sysdata.rda` initializes the namespace
before package source. Depends-style attachment, installed `.rdx`/`.rdb` lazy-load databases, data
indexes/aliases, broader NAMESPACE and S4 registration, bytecode, compiled code, arbitrary
connections, unsupported serialized types/compressors, license-policy decisions, and R CMD check
behavior remain outside this slice.

Usage-ranked `base::args()` has GNU R 4.6 differential evidence for ordinary closures, registered
builtins, first-class operators, character function names, default expressions, ellipsis, global
result environments, `NULL` bodies, unresolved-name errors, and silent non-function results. The
returned value is a new owned closure and never exposes parser or Tree-sitter nodes. Source-only
package fixtures execute the same path inline and through the default Worker, supporting package
code that inspects generated constructors and wrappers without rewriting that code. This does not
make undocumented primitive usage, the complete S7 protocol, or packages with native code
compatible.

Usage-ranked `base::registerS3method()` has GNU R 4.6 differential evidence for function and
character method references, hidden namespace methods, replacement, visible-method precedence,
generic-definition-environment isolation, base generics, formals, invisible results, and invalid
generic or method errors. Registrations made by package source or `.onLoad()` use the same owned,
environment-scoped registry as declarative `S3method` entries. Failed package loads roll their
registrations back, while reset and disposal clear them. Inline and default-Worker package fixtures
execute the same dynamic-registration path. Delayed registration against an unavailable suggested
package, the complete S3 method table API, and broader NAMESPACE registration directives are not
claimed.

Deliberate current exclusions include GNU R/webR embedding, browser-time package installation,
universal package execution, generated JavaScript execution, the complete graphics-device/base-
graphics stack, filesystem access, runtime network access, locale-specific raw encodings, and the
unimplemented remainder of complex mathematics.
