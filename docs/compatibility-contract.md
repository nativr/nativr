# Compatibility contract

NativR reports five evidence levels: parse, API, result shape, numeric, and behavioral. A function
is never described beyond the highest level covered by automated tests or conformance cases.
Capabilities are versioned by NativR semver, `semanticProfileVersion`, `targetRVersion`, and the
generated capability-manifest hash; protocol changes have their own version. `languageSubsetVersion`
is a deprecated protocol-v1 alias of `semanticProfileVersion`.

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
R's default unique partial match. Extraction from `NULL` through `[`, `[[`, `$`, `.subset`,
`.subset2`, or first-class `[[` returns `NULL` while forcing supplied subscript/control expressions;
an absent `[[` subscript remains an error. Primitive-style named argument tags do not change the
positional target/index interpretation. One-dimensional `[<-` and `[[<-` extend atomic vectors and
lists for positive, long logical, or new character-name subscripts, filling intervening atomic
positions with typed missing values and list positions with NULL. Existing names are extended, new
character names are created, and dimensions are dropped when linear extension invalidates them.
Missing numeric/logical positions are skipped only for a length-one replacement. Missing character
replacement names remain outside the current value-model boundary. Arrays support
arbitrary-dimensional column-major extraction and replacement, including one-dimensional array
names, strict per-axis bounds, non-finite numeric coercion warnings, zero-length selections, `drop`,
dimension names, and named dimension axes. Numeric and character coordinate matrices select or
replace one array element per matrix row, including zero-row omission and missing-coordinate
behavior. Data-frame selection and replacement support missing row/column positions, `drop`,
common-type coordinate-matrix extraction, and numeric coordinate-matrix replacement. Character,
missing, and zero-coordinate data-frame replacement matrices retain GNU R's rejection behavior.
`data.frame(..., row.names = NULL, check.rows = FALSE, check.names = TRUE, fix.empty.names = TRUE, stringsAsFactors = FALSE)`
exposes the GNU R trailing-formal order. Explicit atomic row names become frame metadata rather than
a column; factor labels and other atomic types coerce to text, zero-column frames derive their
extent from explicit row names, and missing, duplicate, or incompatible-length values fail
deterministically. Default name checking uses the owned syntactic/unique repair and
`check.names = FALSE` preserves supplied tags. Full `check.rows`/`fix.empty.names` behavior,
column-derived scalar row-name selection, arbitrary recursive-column coercion, and legacy
`stringsAsFactors = TRUE` conversion remain outside this increment. Equal-length list columns and
scalar list-column recycling are preserved as recursive columns. Assigning an expression vector
preserves that expression column and recycles a singleton expression when required. This also
distinguishes `[[<-` list-column replacement from one-dimensional `[<-` column distribution. Simple
one-dimensional `$`, `[`, and `[[` replacement chains rebuild their containing lists or data-frame
columns, support non-local rebinding and missing `$` intermediates, and preserve GNU R's repeated
evaluation of intermediate subscripts. Global partial-match warning options, multidimensional
intermediate replacement targets, nested replacement-function calls, and rectangular pairlist
replacement remain outside the current contract. Direct or nested list and data-frame-column
replacement with NULL deletes the selected component. One-dimensional data-frame replacement appends
consecutively positioned or named columns, recycles scalar columns, distributes atomic replacements
column-major, and rejects numeric gaps. Rectangular data-frame replacement extends numeric or
character-named rows, fills intervening cells with each column's missing representation, updates row
names, and can create a row and column together. Logical row overrun and every missing row subscript
retain GNU R's rejection behavior. As in GNU R, extending an extracted column through
`df$x[i] <- value` remains an incompatible column-length error rather than implicitly growing the
frame. Factor replacement maps labels back to existing levels, extends with missing codes, and warns
when an assigned label is not a level.

Replacing through `[<-`, `[[<-`, or `$<-` on `NULL` promotes the target using GNU R's replacement
type, length, typed-gap, and name rules; replacement by `NULL` leaves it `NULL`. A long logical
replacement index determines the resulting length even where its positions are false, filling
unselected new atomic positions with typed missing values or list positions with `NULL`.

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
`::` and registered internal `:::` lookup never consult the network. An admitted non-core package
bundle replaces a same-name compatibility shim and then loads normally; core namespaces remain
reserved. Neither path implies general package compatibility.
`utils::getFromNamespace(x, ns, pos, envir)` additionally resolves one exact public or private
binding from a core or admitted pure-R package namespace. Character namespaces load on demand;
actual loaded namespace environments and attached-package `pos`/`envir` selection are accepted;
unused location controls remain lazy when `ns` is supplied. Lookup never inherits through the
namespace's imports/Base parent, and missing packages, bindings, invalid names, and non-namespace
environments fail before returning a value. Mutation helpers such as `assignInNamespace`, namespace
locking/registration internals, complete `getNamespace*` inspection, and lazy-load database bindings
remain separate surfaces.

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

`methods::is` has differential behavioral evidence for implicit atomic classes, the integer-to-
`numeric` relationship, ordinary vector membership, explicit classes, parents declared by
`setClass`, the unclassed-value `ANY` fallback, and scalar-`class2` validation. It uses the same
session-owned class graph as S4 dispatch and coercion; virtual classes, class unions, sealed
definitions, and the complete methods package are not claimed.

The string surface includes `paste`, `paste0`, `sprintf`, `format`, `grep`, `grepl`, `gsub`, `sub`,
`strsplit`, `substring`, `substr`, `nchar`, `nzchar`, `tolower`, `toupper`, `chartr`, `trimws`,
`regexpr`, `gregexpr`, and `regmatches`. `trimws` covers both/left/right selection, configurable
whitespace patterns, missing values, atomic and bounded list coercion, and character-vector
attributes. `paste`/`paste0` cover NULL/zero-length recycling and bounded list/pairlist coercion;
`sub`/`gsub` coerce atomic, factor, list, pairlist, and NULL input through the same owned string
surface. Regex location objects use one-based Unicode-character positions and `match.length`
metadata. First/global matching, unmatched and missing text, zero-width matches, names, full-match
extraction, and inverse gaps have differential coverage. In `perl = TRUE` mode, named and unnamed
capture groups additionally expose `capture.start`, `capture.length`, and `capture.names` matrices.
Regular-expression operations use a bounded ECMAScript-compatible subset. Byte-oriented matching,
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

`plot`, `plot.default`, `plot.new`, bounded `plot.window`, `curve`, `axTicks`, `barplot`, `box`,
`boxplot`, `image`, `image.default`, `persp`, `lines`, `lines.default`, `points`, `polygon`,
`rasterImage`, `segments`, and `legend` provide the first browser-native graphics slice. Evaluation
owns page and linear or base-10-transformed coordinate-window state, converts two-dimensional
grayscale or character colors, three-/four-channel numeric/raw arrays, and packed `nativeRaster`
integers to row-major RGBA, and emits commands for recycled raster placements, styled line segments,
resolved point symbols and polygons, plot frames and boxplots, and resolved legend entries. Commands
preserve raster angle/interpolation, finite coordinates, canonical colors, normalized line patterns,
line widths, polygon fill rules, frame edges, text labels, point symbols, placement, and layout
controls. They cross the Worker boundary, remain available in `evalDetailed.graphics`, and count
toward the configured output budget. Inline and Worker callbacks receive the same command shapes,
and the Playground renders them to Canvas. Evidence covers the measured systemfonts glyph-raster,
httr PNG-array, posterior interval-segment, zoo filled-area, zoo plot-frame, zoo grouped-boxplot,
and zoo legend patterns. The owned registry also supports `dev.cur`/`dev.list`, GNU R-shaped null
device 1, simultaneous browser/PNG/PDF device identities, selected `dev.off`/`graphics.off` closure,
nested `dev.hold`/`dev.flush` levels, per-device `par()` isolation and restoration, ordered
cross-evaluation command buffering, and `dev.control` separation of device output from the
per-device recorded display list. Bounded same-session `recordPlot`/`replayPlot` covers the owned
page/window/raster/segments/points/text/polygon/box/boxplot/legend command vocabulary.
`grDevices::png` uses that list to produce bounded, decompressible RGBA PNG bytes in the virtual
file store, including transparent backgrounds, exact requested dimensions, raw-byte reads, and
numbered multi-page targets. Usage-ranked `grDevices::pdf` uses the same device journal to produce a
bounded, self-contained PDF with a valid object graph, cross-reference table, metadata, standard
base-14 font families, alpha graphics states, optional Flate compression, multi-page `onefile`
output, and numbered single-page targets. PDF/PNG devices keep producing output while display-list
recording is inhibited by default; `dev.control("enable")` starts a fresh recording without
retroactively capturing earlier commands. Closing flushes held commands and completes the active
file device. Usage-ranked `grDevices::devAskNewPage` adds GNU R 4.6-shaped query/update visibility
and coercion, per-device flags, `device.ask.default` initialization, and a single prompt before a
later browser page when the session has an explicit `readline` host capability. It never prompts for
the first page, a non-interactive session, or an owned PNG/PDF file device. RColorBrewer's ten
measured calls, an unchanged source-only package import, and the default Worker request path have
executable evidence. Native device event loops and device-specific prompt wording beyond the owned
browser device are not claimed. Complete plot methods, embedded/custom fonts, arbitrary encodings,
device-exact text metrics, complete clipping/margins and graphical parameters, external display-list
formats, and pixel or byte equivalence with GNU R devices are not claimed.

Usage-ranked `base::getLoadedDLLs` has shape-level GNU R 4.6 evidence for its no-argument formals,
visible `DLLInfoList` result, class-preserving empty subset, and the measured ps
`vapply(..., "path")` call. Its default result is intentionally empty. Explicit `nativeModules`
produce owned `DLLInfo` records with virtual paths, lookup flags, and `NULL` pointer fields. NativR
does not synthesize GNU R's base DLL entries, expose parser Wasm or JavaScript modules, enumerate a
host process, or fabricate external pointers.

Usage-ranked `base::.Call` has GNU R 4.6 black-box evidence for primitive type, null formals,
missing/invalid name errors, exact `PACKAGE` confinement, registered argument counts, and symbol
lookup failure. NativR additionally has behavioral evidence for explicit routine resolution, bounded
snapshot arguments/results, inline/default-Worker transport, handler failure propagation, and
default-deny execution. The adapter is deliberately not binary-compatible with GNU R's SEXP C API.
Native symbol objects, `.External`, external pointers, arbitrary attributes/cycles, R C API
memory/protection semantics, shared-library loading, and automatic compiled-package installation
remain incomplete.

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
the shared coordinate adapter. It computes GNU R-shaped ranges with 4% regular-axis padding, opens a
page/window, and emits point, line, both, overplotted, histogram, lower/upper step, or no-draw
geometry. Common color/fill/symbol/size/line controls recycle; incomplete coordinates are omitted
and split paths. `panel.first` and `panel.last` are forced around the data geometry,
`axes`/`frame.plot` control the owned frame, and supplied scalar character main/sub/x/y labels
become bounded text commands. Positive values on requested logarithmic axes are transformed to
base-10 device coordinates; nonpositive values are omitted with a warning, and supplied limits are
validated and transformed through the same path. The default returns invisible `NULL` through inline
and Worker sessions and participates in hold/flush and display-list replay. Automatic
expression-derived labels, complete automatic linear/logarithmic axis generation, log-aware additive
geometry, fixed-aspect axes, complete axis-gap layout, formula/function/time-series/raster and other
specialized methods, arbitrary graphical parameters, margins/clipping, and device-identical pixels
remain outside this shape-level claim.

`graphics::curve` has GNU R 4.6 differential evidence for its exact formals, named-function and
lazy-expression modes, caller/package environment lookup, alternate `xname`, linear/logarithmic
sampling, point-count and limit coercion, invisible named `x`/`y` result, additive drawing, and
boundary errors. New plots and additive curves delegate to the general `plot`/`lines` stack rather
than a package-specific renderer, and source-only package plus Worker/Canvas tests traverse that
same path. `lines` and additive curves inherit the active device's log axes. Inline anonymous
function expressions, complete logarithmic axes, other additive primitives, clipping, replayed
log-axis metadata, and device-identical geometry remain incomplete.

`stats::ts.plot` has behavioral differential evidence for magrittr's measured exposition-pipe
example and for equal-frequency regular-series union. Unnamed vectors, matrices/data frames, and
`ts`/`mts` inputs become aligned columns on one shared time grid; cells outside a source interval
are missing and break the corresponding path. Default line geometry, all nine line/point types,
recycled colour/fill/symbol/size/line controls, explicit linear/log limits, annotations, frames,
invisible `NULL`, exact `(..., gpars = list())` formals, and current `par("usr")` values reuse the
owned graphics device. Source-only package and Worker/Canvas tests traverse the same public
namespace binding. This does not claim the broader multi-panel `plot.ts` method, irregular index
classes, every `gpars` value, complete tick/margin/clipping semantics, or device-identical output.

`graphics::lines` and `graphics::lines.default` have differential shape evidence for all 20 measured
calls across scales, matrixStats, posterior, and zoo. The generic dispatches package-owned S3
methods before the default and preserves their value and visibility. The default reuses the
plot/points coordinate adapter for paired vectors, one-vector indices, matrices, data frames, named
x/y lists, and complex coordinates; unequal paired lengths fail and missing/non-finite pairs split
paths. Types `l`, `p`, `b`, `c`, `o`, `h`, `s`, `S`, and `n` reuse bounded segment and point
commands. Active positive logarithmic axes transform coordinates before drawing and omit nonpositive
values with a warning. Ordinary connected paths use the first line colour/type/width, histogram
lines recycle colour, point-bearing types recycle symbol, colour, fill, size, and width, and the
default returns invisible `NULL`. Worker/Canvas rendering and same-session device recording
therefore require no package-specific protocol. Line joins/caps/mitres, clipping, replayed log-axis
metadata, broader coordinate classes, complete `par()` inheritance, every graphical parameter, and
device-identical pixels are not claimed.

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
and invalid sides have GNU R 4.6 evidence. Standard annotation controls `xlab`, `ylab`, `main`, and
`sub` supplied through `...` are forced once and ignored without a warning, allowing unchanged
labeling figure code to pass this shared axis seam. Logarithmic/date axes, plotmath, outer margins,
exact label collision/gap layout, device font metrics, and pixel identity remain explicit depth.

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
device. Device-backed `ask` queries and updates share state with `devAskNewPage()`. `usr` updates
replace the active user-coordinate window and enter the graphics journal; `new = TRUE` overlays the
next `plot.new()` on the existing page, while read-only `page` reflects that overlay state. On an
explicit PDF or PNG device, read-only `din` reports the owned device's size in inches from its PDF
region or pixel dimensions and resolution. `no.readonly = TRUE` omits `din` and `page`. The browser
event device has no fixed physical inch size, so `din` is not asserted there. Multi-figure layout,
complete graphical-parameter semantics, and device-exact pixels remain outside this slice.

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

`graphics::barplot` and `graphics::barplot.default` have differential evidence for the three
rank-343 calls measured in zoo and bit64. The S3 generic forwards classed inputs to package-owned
methods; the default accepts real vectors and two-dimensional matrices, reproduces visible
`plot = FALSE` midpoint vectors/matrices, and computes stacked or beside rectangles with recycled
width, spacing, offset, orientation, and stack ordering controls. Plotting reuses bounded
page/window, polygon, axis, box, text, and legend commands across inline, Worker, Canvas,
file-device, hold/flush, and record/replay paths. Names, annotations, panel hooks, additive drawing,
colors, borders, and common line/axis controls share the existing graphics state. Logarithmic axes,
positive line-density hatching, device-exact typography/margins, every graphical parameter, and
arbitrary specialized methods remain explicit compatibility depth rather than silently approximated
support.

The bounded axis-style seam accepts `xaxt` and `yaxt` through `barplot(...)`, `axis(...)`, and
session `par()` state. `"n"` suppresses the corresponding horizontal or vertical axis, while `"s"`,
`"l"`, and `"t"` render identically for the measured named-vector barplot and direct-axis paths,
matching GNU R 4.6.1 SVG output. An explicit per-call style overrides `par()` without changing
session state. `plot = FALSE` still returns midpoints before graphical style validation. This closes
the `labeling::extended.figures(2)` `barplot(xaxt=)` exception, but that function's full `par()`
snapshot remains incomplete: NativR exposes 47 entries on its browser event device and 48 on an
explicit PDF/PNG device versus GNU R 4.6.1's 72.

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

Usage-ranked `base::file.create(..., showWarnings = TRUE)` creates or truncates zero-byte files only
inside the mutable session tree. Exact-only matching leaves partial names in dots, the first
filename argument must be character, later atomic arguments are stripped of attributes and coerced,
and all filename arguments are validated before mutation. Results are one visible unclassed logical
per flattened path; missing names fail silently, while empty, parentless, directory, immutable, and
host paths produce bounded per-path warnings when requested. Existing open readers observe the
truncated owned file as GNU R does. File count, result length, storage, and steps remain bounded.
Parent creation is deliberately not recursive, and host permissions, umasks, ACLs, links, devices,
platform-exact diagnostics, and host persistence are outside this browser-memory contract.

Usage-ranked `base::file.copy` has GNU R 4.6 differential evidence for all six formals and defaults,
visible attribute-free logical results, source recycling, existing-directory expansion, overwrite,
self-copy failure, empty-source laziness, recursive directories, dotfiles, and invalid arguments.
NativR-only integration evidence additionally proves exact binary copying from immutable pure-R
package resources into mutable session paths, unchanged package helper execution, default Worker
transport, and file-count/storage limits. Destinations remain session-owned; package/runtime roots
are immutable and host paths are unavailable. Virtual modes are fixed rather than host-derived,
links/devices and platform-specific metadata are unsupported, and recursive copies require one
existing destination directory.

Usage-ranked `base::find.package` has GNU R 4.6 differential evidence for its four formals and
defaults, default attached-package search order, vector order and duplicates, attribute removal,
missing-package warnings/errors, quiet filtering, empty-input laziness, and explicit library
selection. NativR-only evidence proves source-only package roots, directory enumeration from
unchanged package R code, immutable core-package directories, inline execution, and default Worker
Playground execution. Returned paths are owned virtual identifiers rather than host installation
paths. Package installation, arbitrary host library scanning, installed help databases, compiled
code discovery, and platform-exact diagnostics remain outside this slice.

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
connection/filesystem stack beyond the explicit URL adapter are not claimed.

`base::stdin()`, `stdout()`, and `stderr()` expose stable integer terminal connections 0, 1, and 2.
GNU R differential evidence covers class, identity, unclassed descriptor, summary fields, access
queries, false embedded-session `isatty()`, exact formals, invisible `flush()`, and the errors from
opening, closing, or seeking standard handles. `writeLines()` and `cat()` send explicit stdout or
stderr targets through bounded ordered runtime output. `getConnection()`, `getAllConnections()`,
`showConnections()`, and `closeAllConnections()` use the same unforgeable session registry; the last
operation preserves standard handles while invalidating user connections. Browser streaming stdin,
terminal capability negotiation, sink diversion/splitting, pushback, and host file descriptors
remain outside this contract.

Usage-ranked `base::url` has GNU R 4.6 behavioral differential evidence for its six formal names,
defaults, `c("url", "connection")` handle, and closed `url-libcurl` summary. A construction-time
`createR({ url })` capability carries validated URL, method, and named-header data across inline or
Worker execution, copies and bounds one returned `Uint8Array`, and materializes it lazily into the
owned connection store. Existing line/raw/source/table/serialization readers and `gzcon()` consume
the same record; repeated reads preserve one cursor without refetching. No adapter means no network
authority. HTTP status, redirects, authentication, cookies, CORS, caching, cancellation, and origin
allow-lists remain host policy; native libcurl and writable URL connections are not claimed.

Usage-ranked `base::socketConnection` has GNU R 4.6 differential evidence for its eight formal
names/defaults, `c("sockconn", "connection")` integer handle, closed/open summaries, modes,
visibility, access queries, and timeout state. NativR-only integration evidence covers typed
open/read/write/timeout/close and close-all requests, bounded copied byte results, line and raw
connection consumers, `isIncomplete`, reset/disposal, default denial, unchanged source-only package
code, Worker transport, and Playground use. This is an explicit transport boundary, not a claim for
browser raw TCP: DNS, TLS, server sockets, nonblocking scheduling, backpressure, half-close,
cancellation, and platform-exact diagnostics remain host or future compatibility work.

Usage-ranked `base::gzcon` has GNU R 4.6 behavioral differential evidence for its four formal names,
`c("gzcon", "connection")` handle shape, connection summary, gzip magic, text write/read roundtrips,
close-time emission, raw decompression, and `allowNonCompressed = FALSE` warning plus pass-through.
It mutates the evaluator connection record and invalidates the superseded file handle, so all
subsequent I/O traverses one bounded decompressed byte buffer. Immutable package gzip resources and
same-session files use browser-standard `CompressionStream`/`DecompressionStream` in both inline and
Worker execution. The `level` range is validated, but the browser API does not expose GNU zlib's
level control, so compressed-byte or compression-ratio identity is not claimed. Native curl
transports, sockets, seek/pushback in compressed streams, concatenated-member fidelity, and typed
binary I/O remain separate capabilities.

Usage-ranked `base::unz` has GNU R 4.6 behavioral differential evidence for its four formals and
defaults, scalar coercion boundaries, `c("unz", "connection")` class, closed summary, and invisible
`NULL` close. NativR-only evidence covers exact stored and raw-DEFLATE members, implicit restart and
explicit cursor behavior, text/raw reads, package resources, `download.file()` session archives,
read-only `r+`, missing members, CRC/malformed/unsupported forms, resource limits, pure-R package
calls, Worker execution, and Playground use. It extracts no paths and grants no archive, network, or
host-filesystem authority. Encryption, multi-disk/ZIP64 archives, additional compression methods,
seeking, writing, and platform-exact diagnostics remain outside this slice.

Usage-ranked `utils::object.size` has GNU R 4.6 behavioral differential evidence for its exact
single formal, length-one double `object_size` result, 64-bit allocation buckets for atomic vectors,
within-vector character sharing, recursively counted lists and pairlists, attributes, environment
boundary, and legacy/IEC/SI `format` and `print` units. NativR reports its owned R value model,
never the browser JavaScript heap. Associated environment bindings, host objects, platform word
sizes other than the documented 64-bit model, and byte identity for unsupported external/native
objects remain outside this slice.

Usage-ranked `base::readChar` has GNU R 4.6 behavioral differential evidence for digest's
`readChar(path, file.info(path)$size)` and Shiny's `readChar(path, 1000)` calls, exact formals,
raw-vector input, ASCII character/byte widths, vectorized/zero/fractional lengths, EOF, attribute
removal, visible results, and invalid NUL/length boundaries. Browser-owned executable evidence
separately covers deterministic UTF-8 scalar widths, exact arbitrary byte fields, and invalid UTF-8.
Closed file connections open only for the operation and remain closed; open readable connections
advance one byte cursor; open text mode warns; package/session paths and URL/gzip records reuse the
same bounded byte store. Host paths, streaming stdin, native non-UTF-8 locale codecs, `writeChar`,
and platform-exact connection diagnostics are not claimed.

Usage-ranked `base::debug` and `base::undebug` have GNU R 4.6 behavioral differential evidence for
R6's measured future-instance and single-instance method patterns, function-object identity,
invisible `NULL` returns, unmarked warnings, character-name lookup, exact formals, persistent marks,
and GNU R's separate `debugonce`/`isdebugged` state. NativR-only executable evidence consumes a
one-shot mark on invocation and routes closure statements through the existing bounded Worker
`readline` exchange. `next`/empty, `continue`, `finish`, and `Q` are supported; sessions without a
line-input adapter emit the entry trace and continue. Arbitrary R expressions and inspection
commands at `Browse[]`, nested step-in/step-out fidelity, `browser()` metadata access, global
`debuggingState()`, bytecode fallback, and S4 `signature=` tracing remain explicit compatibility
depth.

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

`base::file.access(names, mode = 0)` has GNU R 4.6.1 black-box evidence for its closure formals,
path-named integer results, empty and missing path vectors, mode coercion and validation, and the
existence/read/write/execute bit combinations from 0 through 7. The browser implementation applies
those checks to virtual file metadata: mutable session files have read/write access, session
directories are traversable, and immutable package resources are read-only. It makes no claim about
host access-control lists or executable file flags.

Usage-ranked `base::file.remove` has GNU R 4.6 differential evidence for its `...` formals, visible
per-path logical results, attribute removal, later-argument atomic coercion, zero-length arguments,
validation before mutation, and one warning per failed removal. NativR removes only closed ordinary
files in the mutable session tree. Open connections, directories, immutable runtime/package
resources, missing paths, wildcard literals, and host paths remain unchanged and return `FALSE`;
glob expansion and recursive directory removal remain separate `Sys.glob` and `unlink`
responsibilities. Browser-owned failure reasons are deterministic rather than claims about Windows
or Unix native diagnostics.

`utils::read.table`, `read.csv`, `read.csv2`, `read.delim`, and `read.delim2` have behavioral
differential evidence for bounded browser-memory text, explicit and one-fewer-field automatic
headers, quoted separators and doubled quotes, missing strings, syntactic names, row names, and
logical/integer/double conversion. `write.table`, `write.csv`, and `write.csv2` have evidence for
data-frame rows, headers, row-name conventions, quoted character fields, missing values, invisible
returns, and session-file roundtrips. Existing readable/writable text connections are accepted with
GNU R-style operation-scoped destruction when initially closed. `colClasses`, escape processing,
compression, URLs, host paths, arbitrary encodings, locale-dependent formatting, and the full
scanner/writer surface are not claimed.

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

`base::pipe` has GNU R 4.6 differential evidence for its three closure-like formals, default
expressions, class, closed summary, invisible `NULL` from an unused close, and invalid constructor
boundaries. NativR-only integration evidence covers lazy and explicit reads, persistent open
cursors, CRLF line normalization, stderr events, raw reads, exact text stdin, nonzero close status,
resource limits, default denial, unchanged pure-R package use, Worker transport, and Playground use.
It composes the existing `systemCommand` request/result seam rather than adding ambient process
authority. The current adapter is one-shot and one-way: duplex `r+`, interactive flush/streaming,
seeking, host executable discovery, shell semantics, and binary stdin containing NUL are not
claimed.

`base::Sys.which` has GNU R 4.6 differential evidence for visible named character results, empty and
repeated queries, missing values, factor/list/pairlist/symbol/call/expression coercion, exact
`names` formal matching, and malformed-input boundaries. Browser semantics are explicit rather than
ambient: `createR({ executablePaths })` snapshots a name-to-resolved-path allow-list for inline and
Worker sessions, default sessions report tools absent, reset restores the map, and unchanged pure-R
package/Playground calls reuse it. It never invokes `systemCommand`, scans PATH/PATHEXT, reads the
filesystem, or guesses platform extensions. GNU R reports the function as a closure and permits an
`NA_character_` output name for a missing query; NativR currently reports a builtin and encodes that
single name as `"NA"`. Host path discovery, canonicalization, executable permissions, and those two
representation differences remain outside the behavioral claim.

`utils::download.file` has GNU R 4.6 differential evidence for its nine formals, missing/default
shape, preflight URL/destination length checks, logical controls, and named-header validation.
Black-box probes additionally establish invisible integer `0L`, paired-vector `retvals`, and exact
replacement bytes for `w` and `wb`. The browser implementation sends copied URL, normalized method,
and headers only through an explicit `createR({ url })` adapter, writes complete bounded bodies to
preflighted session-owned files, and leaves an existing destination untouched when the request
fails. `auto` maps to the adapter's `default` method; `default`, `internal`, `libcurl`, and
`wininet` remain typed policy hints rather than built-in transports. Default sessions fail closed.
Host paths, ambient fetch, redirects, credentials, cache semantics, progress output, append modes,
external `curl`/`wget`, partial-file retention, and status-code policy remain explicit boundaries.

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

`graphics::rect` has differential evidence for sass and zoo's three measured calls. Its four
coordinate arguments accept coercible atomic or scalar-list values, choose the number of rectangles
from the longest coordinate vector, and recycle shorter coordinates without a warning; style-vector
lengths do not create additional rectangles. Missing/non-finite coordinate tuples are omitted,
all-empty coordinates return invisible `NULL`, and mixed empty/nonempty coordinates are rejected.
Fill/border colors, line types, and line widths recycle per rectangle; `border = NULL` uses the
current foreground, `border = NA` suppresses the stroke, `density = 0` suppresses the fill, and
negative, missing, or `NULL` density selects a solid fill. Exact formals retain `par("lty")` and
`par("lwd")` defaults. Rectangles reuse the bounded polygon event, so inline/package/Worker calls,
Canvas/PNG rendering, held journals, and display-list record/replay share one implementation.
Positive hatch density, general coordinate classes, clipping/log axes, device-exact joins and dash
metrics, and arbitrary graphical parameters are not claimed.

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

`grDevices::colorRamp` and `colorRampPalette` have differential evidence for first-class numeric
matrix and hexadecimal palette closures, linear and not-a-knot/FMM spline interpolation, RGB/CIE Lab
space, positive bias, alpha, partial choice matching, non-finite/out-of-range points, and
zero/singleton output lengths. Isoband's six-anchor 21-color palette and unchanged viridisLite
0.4.3's 256-anchor Lab spline produce GNU R-compatible colors with browser-native arithmetic. All
657 catalog names are accepted as color inputs. Wide-gamut/device profiles, other color spaces, and
exhaustive coercion/out-of-gamut rounding remain outside this bounded slice.

`grDevices::convertColor` has numeric differential evidence for numeric three-column matrices and
vectors converted among D65 sRGB, CIE Lab, and XYZ, including input/output scaling, sRGB clipping,
missing rows, matrix shape, and Lab column names. Custom reference whites, Apple RGB, CIE RGB, Luv,
chromatic adaptation, and device-profile color management remain explicit unsupported boundaries.

`grDevices::hcl` has differential evidence for all six measured ggplot2/zoo calls, including a
2,500-color raster vector, a ten-color strip, translucent threshold colors, and opaque neutral/high-
chroma colors. The browser-owned polar CIE-LUV/D65-to-sRGB path covers vector recycling, default and
exact formals, optional/recycled alpha, zero-length inputs, missing/non-finite coordinates, finite
range validation, clamped gamut fixup, and `NA` for out-of-gamut colors when `fixup = FALSE`.
Source-only package and default Worker execution use the same registered callable. ICC profiles,
device-dependent color management, and `hcl.colors` remain separate compatibility depth.

`grDevices::col2rgb` has differential evidence for stringr's measured named-color-to-hex helper, the
complete 657-name catalog, short and long RGB(A) hexadecimal forms, transparent and missing values,
factor labels, default-palette numeric indices, row/column names, alpha selection, empty inputs, and
invalid specifications. The reverse `grDevices::rgb` path covers recycled numeric channels, optional
alpha/names, byte and normalized intensity ranges, and three-/four-column matrix or data-frame
input. Mutable palettes, arbitrary color spaces/profiles, and device-dependent interpretation remain
separate surfaces.

`grDevices::heat.colors` has differential evidence for the measured sequential palette, exact
red-to-yellow and pale-yellow hexadecimal bytes, optional alpha, reversal, count truncation, names,
zero/negative counts, and invalid scalar inputs. The shared classic HSV path also gives
`grDevices::rainbow`, `terrain.colors`, `topo.colors`, and `cm.colors` GNU R 4.6 evidence for
byte-exact default/custom sequences, recycled saturation/value or alpha vectors, wrapped hue ranges,
reversal, namespace access, and zero/invalid boundaries. It does not claim `hcl.colors`, palette
state, general color conversion, or device-specific rendering.

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

`l10n_info()` has GNU R 4.6 differential evidence for its null formals, visible list result, first
three scalar logical fields and names, names-only attributes, OS-specific suffix contract, and the
invariants that UTF-8 implies MBCS and excludes Latin-1. NativR's platform-specific evidence fixes
the non-Windows browser suffix to `codeset = "UTF-8"`; unchanged source-only package and Worker
calls exercise xfun's measured `l10n_info()[["UTF-8"]]` branch. Host locale/codepage discovery,
Windows codepage fields, arbitrary native encodings, ICU/iconv, and mutation through LC_CTYPE remain
outside this browser profile.

`shQuote()` has GNU R 4.6 differential evidence for its closure type, `string`/`type` formals and
four-choice default, visible character result, partial type matching, attribute removal, explicit
Microsoft `cmd` and `cmd2` transformations, missing-value rules, and registered `as.character` S3
dispatch. The browser default follows the documented Unix `sh` contract; documented `csh` splitting
and escaping also has exact browser conformance. Atomic, factor, list/pairlist, symbol, call,
expression, and formula coercion use the owned value model. Byte-invalid native strings, exhaustive
host-shell round trips, and command execution are outside this function's contract.

`system2()` has GNU R 4.6 differential evidence for closure type, all twelve formals and defaults,
atomic/list argument and environment coercion, preflight errors, capture/status/warning/visibility,
and documented timeout/failed-start status conventions. NativR's platform-independent host contract
keeps executable, command elements, arguments, environment entries, stdin path, input lines and
stdout/stderr redirection descriptors separate across inline and Worker execution. Capturing either
stream forces waiting; absent `systemCommand` authority fails closed. Exact OS shell parsing,
executable discovery, inherited environment, host paths, terminal interaction, stream interleaving,
and arbitrary process support remain host-adapter responsibilities and are not claimed.

`utils::aspell()` has GNU R 4.6 differential and black-box fixture evidence for its six formals and
defaults, classed five-column result, line/column association, suggestion list column, correct-word
omission, and empty-result shape. Behavioral integration evidence covers automatic admitted-program
selection, multiple virtual files, encoding recycling, arbitrary R filter closures, unchanged
source-only package calls, and the same inline/Worker command transport used by `system2`. The
contract excludes built-in Rd/Sweave/R/pot/dcf/md filters, serialized R dictionaries, ambient PATH,
host files, and checker-identical diagnostics until executable cases cover them.

`utils::sessionInfo` has shape evidence for the measured otel `utils::sessionInfo()$platform` lookup
and differential evidence for its class, R major/minor target, RNG-kind length, attached
base-package length, and named-list access. Browser-specific values are deliberately NativR
identities: platform is `wasm32-unknown-browser/nativr`, running host is
`Browser JavaScript (NativR)`, time zone is UTC, native BLAS/LAPACK fields are empty, and the
version list describes R 4.6.1 as the compatibility target rather than claiming that GNU R is
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
and recursive lists. Profile 0.303 adds exact numerical error reporting: automatic relative versus
absolute labels, explicit scalar/vector scales and their near-unit labels, complex modulus labels,
the observed `countEQ` contributions, and positive reductions with compensation. Scale recycling
retains its warning. Numeric method controls match positionally or by unique partial name; controls
after the ellipsis stay exact-only. Custom `formatFUN(err, what)` callbacks remain lazy until a
difference needs rendering, retain side effects, and can return multiple display fields. `giveErr`
preserves the unrounded `err` and `what` attributes even within tolerance; identical inputs do not
acquire those attributes. Recursive Oracle v2 cases preserve these values, callback records, and
visibility. Full nonnumeric/attribute diagnostic wording, every method-specific control, custom
dispatch, cyclic environment-content comparison, and universal floating-point identity remain
unclaimed. Scalar `isTRUE`/`isFALSE` behavior is covered.

The default numerical report and `format()` share the owned decimal formatter. Numeric `format()`
honors session `digits`, `scipen`, and `OutDec`, explicit digits/scientific/decimal-mark controls,
minimum fractional digits, shared precision, missing/non-finite tokens, and names/dimensions. Digit
limits and per-element work remain bounded. Broader complex formatting, locale typography,
grouping-mark options, character display-cell alignment, and full `format.default` breadth remain
outside this increment. Evidence comes from independently authored GNU R 4.6.1 probes and the public
[`all.equal`](https://stat.ethz.ch/R-manual/R-devel/library/base/html/all.equal.html) and
[`format`](https://stat.ethz.ch/R-manual/R-devel/library/base/html/format.html) contracts.

Numeric `cat()` output uses the same decimal formatter independently for each real value or complex
component, honoring session `digits`, `scipen`, and `OutDec` without shared vector padding. Exact
cases cover stdout, capture, virtual file output, missing/non-finite tokens, and invisible `NULL`
returns. The public [`cat`](https://stat.ethz.ch/R-manual/R-devel/library/base/html/cat.html)
contract and independently authored GNU R 4.6.1 observations establish this bounded behavior. Output
text connections, `fill`, `labels`, and the complete separator/complex edge surface remain
incomplete.

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
variants beyond `-1` are not claimed. Locked bindings protect removal, and removing an unlocked
active binding removes its callable without invoking it.

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

`pmin` and `pmax` compute recycled elementwise extrema across logical, integer, double, character,
factor, and NULL inputs. Nonempty logical results use integer storage, mixed inputs follow the
ordinary character/double/integer promotion order, fractional recycling emits one warning, and any
zero-length input produces a typed zero-length result. The result copies the first input's owned
attributes, including names, dimensions, custom metadata, and compatible classes. NA and NaN remain
distinct, exact `na.rm` control ignores missing candidates unless every candidate is missing, and
all-missing positions retain GNU R's rightmost NA/NaN identity. Equal-level ordered factors compare
by level order; ordinary factors retain GNU R's operation-specific warning-producing first-input
behavior in the covered shapes. The unchanged `labeling 0.4.3` figures path exercises `pmax` before
reaching its separately recorded graphics blocker. Complex/raw/list inputs, unequal ordered-factor
levels, S3/S4 method dispatch, locale-specific character collation, and exhaustive class/recycling
corner cases are not claimed.

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

`stats::filter` implements the documented convolution and recursive methods for atomic vectors and
two-dimensional matrices. Differential evidence covers zoo's measured recursive coefficient,
ordinary and initialized recursion, centered/trailing/circular convolution, independent matrix
columns, `NA`/`NaN` propagation, exact formals, partial method matching, and `ts`/`mts` plus `tsp`
result metadata. Missing coefficients and invalid controls fail before allocation. Data-frame
`as.ts` coercion, complex input, higher arrays, long vectors, irregular-series methods, warning and
error text identity, and native floating-point implementation identity are not claimed.

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
`parent.env` has differential coverage. `parent.env<-` replaces a non-empty environment's parent by
reference, returns through ordinary replacement-assignment semantics, rejects non-environment
parents, and prevents self or indirect cycles. `sys.call` returns owned R-language calls for the
current closure frame, positive absolute frame positions, and negative relative positions, with NULL
for position zero and GNU R-compatible out-of-range errors. Promise-evaluation and method-dispatch
frames and `sys.function` returns owned closure identities for the same current, absolute, and
relative frame positions. Promise-evaluation and method-dispatch frames, internal/native API frames,
`sys.calls`, `sys.frames`, and the remaining `sys.*` call-stack API are not yet claimed. `t`
transposes named vectors, factors, and two-dimensional matrices in column-major order, swaps matrix
dimension-name axes, and converts atomic-column data frames to a common matrix shape.
Arbitrary-dimensional arrays, custom methods, and recursive/mixed data-frame columns remain outside
this increment.

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
metadata, exact parser diagnostic text, and files/connections remain separate compatibility
surfaces. Backports' private retrieval seam is covered by the later generic `getFromNamespace`
increment; that does not by itself establish complete backports compatibility.

`textConnection` copies a character vector into a bounded, always-open input connection owned by the
evaluator session. `source` accepts that connection, a browser-memory path, an immutable package
resource path, or an already-built expression/call container. The complete program is parsed before
any expression runs; evaluation is sequential in the global, caller, or explicit environment, and
the invisible named result retains the last value plus its visibility. Measured echo and visible
result printing use bounded runtime output and ordinary S3 print dispatch. Exact formal names,
connection classes, cursor consumption, local/global assignment, parse atomicity, virtual `chdir`,
package execution, and Worker execution have evidence. Output text connections, host-file input,
source-reference retention, abort recovery, exact echo deparsing, and every encoding remain outside
this increment; URL-connection input is covered by the later explicit host-adapter increment.

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

The base `simpleCondition`, `simpleError`, `simpleWarning`, and `simpleMessage` constructors expose
the exact `message, call = NULL` formals and GNU R class order. The first three use ordinary
character coercion for `message`; `simpleMessage` preserves the supplied owned value. `srcfilecopy`
creates an empty-parent browser-owned environment with the documented filename, lines, timestamp,
encoding, file, working-directory, and newline fields plus `srcfilecopy/srcfile` classes; it is a
source-reference shape, not host-file access.

Profile 0.304 adds `conditionCall()` and S3 dispatch for both `conditionCall()` and
`conditionMessage()`, with exact single-`c` formals. The default condition path retains the owned
call/message value, including NULL and unusual field types, through ordinary list/pairlist member
selection. Caller-local methods and their visibility have exact recursive GNU R 4.6.1 evidence.
Unclassed inputs without applicable methods are rejected. Complete default-method registration,
`NextMethod` chains, environment-backed conditions, and every malformed condition remain outside
this increment. The package-check harness uses these generic accessors to observe ordered condition
classes, messages, calls, and returning top-level handlers through `globalCallingHandlers()`; source
handlers can consume a condition before that observation boundary.

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
`rbind`, `cbind`, and `as.matrix` are supported. `rbind` additionally combines atomic-column data
frames by unique column name, including reordered columns and common factor levels, with fresh
automatic row names. Mixed data-frame/atomic inputs and recursive columns remain incomplete. `diag`
constructs square or rectangular matrices from scalar dimensions and recycled logical, integer,
double, complex, or raw diagonal values, including factor codes, scalar-list coercion,
character-to-double warnings, and zero dimensions. It also extracts type-preserving diagonals from
two-dimensional atomic or list matrices and retains names only when row and column dimension names
match. Method dispatch and exotic class-specific coercion remain outside this bounded diagonal
subset. Data frames use named list columns, row names, rectangular and coordinate-matrix
selection/replacement, common-type cell extraction, and scalar recycling. `expand.grid` accepts
direct atomic vectors or one list of atomic vectors, varies the first input fastest, preserves
factor inputs, optionally converts character inputs to factors in first-occurrence level order,
handles empty Cartesian products, and can attach dimension metadata. Recursive grid values,
class-specific coercion, locale formatting, and every `out.attrs` display corner case remain outside
this bounded subset. `tibble` and formula-header `tribble` provide construction subsets, not the
full tibble package API.

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

`match.fun` accepts an already-callable value without forcing `descend`, resolves a symbol or
one-element character name from the parent of its caller, and optionally walks past non-functions.
Forwarded promises retain their callable value; no source reflection or package-specific lookup is
used. `identity` exposes the exact one-formal closure shape required by higher-order package APIs.

Leftward, rightward, and non-local assignment are supported for identifiers, direct replacement
targets, and simple one-dimensional subset/member replacement chains. Non-local assignment searches
lexical parents, creates an otherwise absent binding in the global environment, and rejects attempts
to mutate the locked built-in environment. Direct replacement-function assignment invokes and
rebinds through `names<-`, `attr<-`, `class<-`, and `dim<-`. Short `names<-` character values pad
the target with missing names, and the measured nested `names(dimnames(x))[i] <- value` path rebinds
through a promoted NULL intermediate. Other nested replacement-function call shapes remain outside
this boundary.

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
checks. Builtin definitions with explicit ordinary R-level formals report `typeof = "closure"`; the
black-box surface inventory confirms that classification for all 92 registered names also found in
GNU R, while true primitives/specials remain unchanged. Atomic coercion covers `as.logical`,
`as.integer`, `as.double`/`as.numeric`, and `as.character`, with executable NA/NaN, complex, factor,
raw, warning, and integer-range cases. General S3/S4 coercion dispatch beyond the bounded `hexmode`
chain, list coercion, option-dependent numeric formatting, and all locale-specific parsing remain
outside this increment.

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
canonical formal names, optional ellipsis expansion, and no promise forcing. Explicit closure or
closure-shaped builtin `definition=` rematches supplied arguments; primitive definitions are
rejected. An owned language `call=` supplies syntax without evaluating its arguments. Synthetic
replacement calls preserve their evaluated value and `*tmp*` object argument across S3 dispatch and
`NextMethod()`. Root, child, parent, current-frame, and closure environments participate in lexical
`eval()`. `do.call()` invokes a callable from an ordinary list, `force()` and `forceAndCall()`
expose selective promise forcing, and `delayedAssign()` installs a memoizing promise with separate
evaluation and assignment environments. Environment `$`/character-`[[` access, `get`, `get0`,
`mget`, `exists`, `assign`, `list2env`, `as.environment`, and `environmentName` cover initial
binding and conversion behavior, including inherited lookup and GNU R's eager evaluation of
explicitly supplied `get0(ifnotfound=)` and `mget(ifnotfound=)` values. The measured `mget()`
contract includes duplicate/missing request names, mode filtering, optional inheritance, delayed and
active binding reads, scalar/per-name fallback lists, callable fallbacks, exact result names, and
GNU R 4.6 formals. Numeric and exact-name `as.environment()` selectors resolve the standard search
list, with stable supported-export package environments and parent links. `ls` and its identical
`objects` alias enumerate only local bindings without forcing promises, honor
caller/explicit/search-list selection, hidden-name and pattern filtering, and deterministic sorted
or unhashed order, and expose the exact GNU R 4.6 formals. `as.list` performs custom S3 dispatch,
while `as.list.environment` enumerates only local bindings, supports `all.names` and `sorted`,
returns an attribute-free empty list when appropriate, and forces selected promises in result order.
Non-hashed environments retain reverse binding order and hashed environments retain deterministic
insertion order when sorting is disabled. `search()` exposes the deterministic standard nine-entry
GNU R startup path and resets with the session. Attached-package lookup mutation, `attach`,
`detach`, `searchpaths`, locked/active bindings, search-path environment mutation, exact GNU R
hash-bucket order, active-binding enumeration, locale collation and GNU TRE regexp edge cases,
`do.call(quote = TRUE)`, and pairlist call arguments remain outside this increment. `typeof`,
`mode`, `length`, `lengths`, `is.symbol`/`is.name`, `is.expression`, `is.language`, `is.call`,
`is.recursive`, and the Worker boundary cover this value surface. Public snapshots contain only a
stable name or R-like source string, never Tree-sitter or normalized-AST nodes. Pairlists have their
own runtime and wire type, exact tags, coercion, predicates, lazy `alist()` construction, one- and
two-dimensional extraction, GNU R-compatible replacement type transitions, arbitrary runtime
attributes, classes, dimensions, and dimension names. `parse(text=)` creates owned expression
vectors from atomic text, honors bounded `n` parsing, and drives the same normalized evaluator;
parser-backed public symbol/language/expression records are accepted as inputs. File/connection
parsing and source-reference preservation, `bquote`, inherited substitution lookup,
`match.call(envir=)` and definitions without R-level formals, pairlist rectangular replacement and
out-of-range extension corner cases, generic pairlist attributes across the public snapshot, GNU R
primitive-binding failures under an `emptyenv()`-terminated evaluation chain, full language
attributes/indexing, and numeric call-frame evaluation selectors remain outside this increment.

The apply/map surface comprises `apply`, `lapply`, `sapply`, `vapply`, `mapply`, `Map`, `Reduce`,
`Filter`, `by`, `aggregate`, `ave`, and `tapply`. Current implementations target atomic vectors,
lists, matrices, and the documented grouping shapes. `mapply(..., SIMPLIFY = FALSE)` and `Map()`
retain explicit first-input names or derive names from first-input character values, including
missing and empty names; scalar simplification retains names and matrix simplification retains the
outer dimension names. The primitive `[[` is a first-class special builtin, so package code may pass
it to higher-order functions without a wrapper. `ave` partitions an atomic input by zero or more
same-length atomic grouping vectors, leaves missing-group positions unchanged, resolves a direct
callable or one function name, and replaces each group with a nonempty atomic scalar or vector
result using ordinary recycling and promotion. Forwarding extra arguments to its function,
class-specific method dispatch, and all simplification or grouping corner cases are not claimed.

`vapply` uses the shared exact/partial/positional argument matcher: `X`, `FUN`, and `FUN.VALUE` may
be reordered by name, arguments after `...` require exact names, and remaining arguments are
forwarded without stealing `USE.NAMES`.

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
and file connections with differential evidence. Host files and arbitrary print methods are not
claimed; the later rank-330 increment supplies the stateful output/message sink stack.

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
bounded. Browser-memory path and owned connection targets use the same writer as `cat()`.

Usage-ranked `base::sink()` and `sink.number()` have GNU R 4.6 black-box evidence for exact
formals/defaults, invisible `NULL` restoration, 19 nested output diversions, `split` tee ordering,
append mode, cross-evaluation and post-error persistence, message connection replacement, and
closed/already-open connection lifecycle. `capture.output()` shares the same ordered router, so
nesting is determined by creation order rather than by two competing capture systems. Output is
buffered within `maxOutputBytes` and committed on restoration. Reading, closing, or externally
mutating an active sink target, host filesystem paths, native file descriptors, and platform-exact
console diagnostics remain outside the browser contract.

Usage-ranked `base::write()` has GNU R 4.6 black-box evidence for exact formals/defaults, invisible
`NULL`, character and numeric column defaults, repeated separator vectors, final newlines,
underlying named/matrix/factor storage, missing values, append mode, and closed/already-open
connection lifecycle. Sass's measured source-line write runs unchanged in the source-only package
fixture and Worker Playground. The writer is bounded by output/vector/session-file limits and does
not grant host filesystem access, native encodings, platform-specific line endings, or support for
non-atomic objects.

Usage-ranked `utils::available.packages()` and `contrib.url()` have GNU R 4.6 black-box evidence for
exact formals/default expressions, contribution path rules, GNU R's distinct early-empty and
populated character-matrix shapes, row/column names, the conditional `Built` column,
standard/extra/missing fields, R-version/OS/duplicate filters, ordered custom filter functions,
cache bypass, request headers, and invalid inputs. Curl's measured reverse-dependency database shape
runs unchanged inside a source-only package and Worker. All repository bytes require the explicit
bounded URL callback; persistent host caches, ambient networking, repository archive installation,
binary packages, and full dependency-recursive license filters remain outside this increment.

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

Usage-ranked `utils::help()` has GNU R 4.6 differential evidence for its seven exact formals and
defaults, symbol/character/reserved-word topics, literal unquoted `package=` names, option-driven
controls, argument laziness, package and library selection, missing-topic results, canonical topic
paths, help types, `help_files_with_topic` attributes, and `packageInfo` shape. The build-time tool
indexes every source-package `man/*.Rd` page, including pages with no examples, into deterministic
topic/alias/title/common-section records. Runtime lookup covers registered core bindings and
unchanged source-package aliases; text output uses the bounded console journal and requested HTML
uses escaped script-free session content through the existing Worker browse journal. The portable
renderer does not claim complete Rd macro expansion, `?`/`??` syntax/search, installed `.rdb`/`.rdx`
help databases, exact GNU pagination, PDF output fidelity, or byte-identical text/HTML.

Usage-ranked `utils::vignette()` has GNU R 4.6 differential evidence for its four formal names,
empty `packageIQR` catalog, result matrix labels, missing-topic warning/value, and specific
seven-field `vignette` object shape. The build-time package tool independently indexes retained
`inst/doc` R Markdown, Sweave, `*.pdf.asis`, extracted R, and prebuilt HTML/PDF resources; runtime
discovery respects installed/attached virtual packages, explicit `package`, `lib.loc`, and `all`. An
inline package artifact, unchanged `withr 3.0.3`, and the Worker Playground exercise topic discovery
without GNU R, runtime network access, or document builders. Building a raw development `vignettes/`
directory, installed lazy help databases, `print.vignette`, automatic viewer dispatch, and
byte-identical document rendering remain incomplete.

Usage-ranked `utils::browseVignettes()` has GNU R 4.6 differential evidence for its three formal
names/defaults, classed named-list result, `call`/`footer` attributes, seven-column per-package
matrices, explicit duplicate-package rows, attached-versus-all discovery, missing packages, lazy
empty-package `lib.loc`, and `print.browseVignettes()` visibility/empty output. At runtime it
aggregates the same versioned manifest generated for every admitted source package and creates a
bounded self-contained HTML catalog whose output/source/R-code links contain immutable package
resources. The catalog enters the existing `browseURL()` file journal and Playground sandbox; it
does not receive network, DOM, desktop viewer, or host-filesystem authority. GNU help-server URL
layout, installed lazy help databases, development-time vignette building, and byte-identical HTML
remain outside this shape-level claim.

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
surface supports `setClass`, multi-argument `setGeneric`/`setMethod`, `standardGeneric`, `new`, and
explicit single-source `setAs`/`as` coercions. The measured S7 generic-definition body has
differential evidence for explicit/`ANY` method selection, formals, defaults, dots, missing methods,
and calls outside a generic body. `methods::signature()` and named/positional multi-argument method
registration have differential evidence, including reordered named calls, inherited classes, and
`ANY` fallback selection. Ambiguity reporting, union classes, complete argument matching, automatic
package registration, method caching, primitive/group generics, and the full methods/S7 protocols
are not claimed. The built-in `R6Class` compatibility helper supplies a generator with `$new` and
public-field defaults. Separately, unchanged R6 2.6.1 now loads and exercises a real generator,
mutable public `self`, reference field mutation, and public method calls through the generic package
runtime. The same unchanged package now exercises private state through public methods and a
read/write active field backed by `makeActiveBinding()`, shallow cloning with shared nested
references, and deep cloning with an independent nested R6 object. A three-level unchanged
`Person`/`Employee`/`Manager` hierarchy additionally proves inherited fields and methods, recursive
`super$initialize()`/`super$greet()` calls, and the expected class chain. Finalization, arbitrary
and multiple inheritance breadth, portable-locking variants, and complete R6 behavior remain
unclaimed. `new_class` and `new_vctr` provide vctrs-compatible class construction shapes, not the
complete vctrs or S7 packages.

Applications may provide `PureRPackageBundle` records at `createR()` initialization. DESCRIPTION and
NAMESPACE metadata, package-relative `R/*.R` source, and optional base64 resources are validated and
bounded before the Worker parses source into normalized ASTs. The loader provides dependency-ordered
isolated namespaces, DESCRIPTION version checks, `import`/`importFrom`, explicit exports and
internals, `S3method`, `.onLoad`, `.onAttach`, `library`, `require`, `requireNamespace`, namespace
queries, `utils::packageName`, immutable `system.file` virtual paths, attachment search-path
entries, bounded text reads for DESCRIPTION/NAMESPACE/R source/resources, and reset/reload behavior.
Qualified `S3method(package::generic, class)` declarations resolve the generic in the named
namespace and the default unqualified `generic.class` method in the package namespace. General
attributes cover environments by reference and closures by copy-on-modify; environment/binding locks
and non-dispatching `.subset`/`.subset2` extraction follow the measured GNU R boundaries.

Installed-version lookup has GNU R 4.6 black-box evidence.
`utils::packageVersion(pkg, lib.loc = NULL)` returns a length-one classed package version for core
namespaces and validated pure-R bundle definitions without forcing namespace initialization; absent
packages fail with the package-named error. `getRversion()`, `numeric_version()`,
`package_version()`, character conversion, formatting, printing, concatenation, missing propagation,
padded vectorized relational comparison, and `utils::compareVersion()` share one owned component
parser. Explicit unsupported boundaries include host library discovery, non-`NULL` library
locations, the complete numeric-version indexing, replacement, summary, ordering, data-frame, and S3
method surface, and any inference that version visibility proves package execution compatibility.

Usage-ranked
`utils::packageDescription(pkg, lib.loc = NULL, fields = NULL, drop = TRUE, encoding = "")` reads
validated bundle metadata without loading or attaching the package. Differential evidence covers
bounded core Package/Version/Priority fields, selected/full named lists, missing fields, scalar
dropping, class and `fields` attributes, exact formals/defaults, and missing-package warnings.
Source-only fixture and Worker tests reproduce cli's measured `unclass()`/field access and virtual
`file` lookup; unchanged `pkgconfig 2.0.3` supplies public artifact evidence. Full GNU core
DESCRIPTION prose, malformed installed directories, host-library search, arbitrary iconv codecs,
`print.packageDescription`, citation/date utilities, and writable metadata are not claimed.

Language subset 0.302 prints one-dimensional array axis headings, including empty and missing
headings, when the dimension has labels. `table()` preserves explicit axis names, derives omitted
names from simple symbols, and uses an empty heading for compound expressions. Empty table
dimensions retain `NULL` labels; zero-extent tables print their extent summary. Tables retain the
existing array width/digits/truncation controls, suppress ordinary attribute trailers, and return
the unchanged value invisibly. Exact GNU R 4.6.1 cases cover one-, two-, and three-dimensional
output, nested tables, missing labels, ordinary-array controls, and recursive attribute identity.
Unused factor levels and their ordering, general `structure()` attribute normalization, and the full
table-construction option surface remain outside this closure.

The build-time package-check report compares fresh native GNU R and NativR sessions, records
explicit stage inventories, and rejects partial evidence as P7. Its versioned comparison preserves
raw stdout/stderr and only reverses independently probed native CRLF text transport. It does not
remove host headers, bytecode labels, whitespace, or numerical differences. Condition classes,
calls, and cross-stream ordering remain incomplete through the current public capture APIs; full
metadata, namespace, documentation, vignette, installation/loading, and manual checks are still
unexecuted. A successful package script is not a complete package-check result.

Language subset 0.301 renders closure formals and bodies from owned AST with structural indentation,
operator grouping, cutoff-aware continuation lines, and source-independent function layout.
`deparse()` retains supported closure attributes through `structure()`, and `deparse1()` joins lines
under its default 500-column cutoff or returns the vector for `collapse = NULL`. Closure printing
uses `deparse.cutoff`, appends environment and attribute information, and composes nested list
printing with complete element paths and list attributes. Exact evidence includes control flow,
primitive and ordinary call contexts, named/unnamed/nonsyntactic nested paths, classed child path
resets, and empty lists. Traversal has step checks and a 512-level syntax bound; output limits still
apply. Source retention, advanced deparse controls, exhaustive layout/numeric-literal spelling,
custom nested class printers, and static core namespace identity remain incomplete. Anonymous
environment labels and absent GNU bytecode addresses follow RFC-0001's explicit display adaptation.

The same increment selects registered S3 methods from the generic's top environment. Ordinary
private registration tables are ignored by dispatch; global fallback, package-named top boundaries,
empty parent chains, and `NextMethod` have exact GNU R 4.6.1 evidence. Real installed namespace
names are retained. This resolves the prior arbitrary-environment registration mismatch while
preserving the separate static-core namespace aliasing limitation.

Language subset 0.300 preserves original RHS syntax on an already forced replacement-value promise.
`substitute(value)` observes that source, while the synthetic replacement call continues to display
and evaluate its computed value. Direct closures, S3 dispatch, subset receivers, captured frames,
and outer reconstruction have executable evidence; the RHS executes once. This uses owned normalized
AST and does not introduce generated JavaScript. Opaque GNU R promise values embedded in escaped
replacement `sys.call()` and `match.call()` language remain outside the current recursive value
model; their internal type and identity are not claimed by this evidence.

Profile 0.305 shares embedded-value display across `call`, `as.call`, substitution, language
replacement, and replacement-call reflection. Atomic/list/pairlist attributes retain insertion order
through `structure(...)`; eligible names remain argument tags, and integer sequences keep compact
colon notation. Nested attributes, dimensions, dimension names, missing character attribute values,
and evaluation of the original owned values have exact GNU R 4.6.1 evidence. Error display omits
structure attributes of embedded values while `conditionCall()` retains them, matching the distinct
native observation channels. Recursive conversion is depth-bounded and checkpoints work where an
evaluation context is available. Missing-name construction, arbitrary embedded object types,
exhaustive complex/raw text, and general deparse controls remain incomplete. Escaped raw oracle
promises are still rejected; the replacement case observes their evaluated value and call text
without claiming raw promise identity.

The same increment formats real matrix columns at shared decimal precision, chooses fixed or
scientific notation with `digits`/`scipen`, and splits atomic matrix and array output into complete
column panels under `width`. Cubic and quartic real powers use the left-to-right multiplication
rounding observed in GNU R 4.6.1; other powers retain the existing path. Independently written exact
numeric and printed-output cases cover these behaviors, including a rational derivative whose
previous result differed by one ULP.

Atomic vector output uses shared fields, aligned index prefixes, and width-bounded panels. Named
vectors retain name/value alignment and trailing print gaps; real vectors use common decimal
precision over displayed entries. Character, logical, and raw vectors use the same panel layout.
Vector truncation follows the observed one-entry omission exception. Formatting work and emitted
text remain subject to session limits. Complex shared precision, Unicode display-cell widths,
general data-frame output, and complete closure printing remain incomplete.

S3 method lookup follows the generic caller's lexical chain and skips non-function bindings before
using the existing registered-method fallback and attached search path. `NextMethod` retains the
original caller. Exact cases cover local methods, lexical parents, namespace registration fallback,
and internal/operator/member dispatch. Full S3 dispatch semantics remain bounded by the recorded
cases; this increment does not claim complete object-system compatibility.

Language subset 0.299 adds precedence-aware operator deparsing, bounded atomic array slices, and
preserved warning/error condition calls and classes. Array output covers higher-dimensional
column-major slices, dimension labels, empty dimensions, and `max.print` truncation. Complex column
precision, rank-one axis labels, and list arrays remain incomplete. Deparsing preserves required
operator grouping and renders embedded integer sequences compactly. Parentheses remain owned calls
and make their result visible, including assignments; full GNU R multiline deparse layout remains
unclaimed. Continued top-level errors print stored condition calls and captured closure traces.
These claims are bounded by checked-in conformance cases and the recursive Oracle v2 condition
records; full traceback APIs and custom condition accessor methods remain outside this increment.

The Node-only `@nativr/package-tools` build path accepts standard source directories and `.tar.gz`
archives, or resolves required `Depends`/`Imports` from a CRAN-like `PACKAGES` index. It enforces
archive/file/byte/package limits, rejects links, native/JVM code, install hooks, `LinkingTo`,
`useDynLib`, invalid paths, and unsupported NAMESPACE directives, preserves package resources and
license metadata, and emits deterministic SHA-256 artifacts plus a dependency lock. The browser
runtime remains network-free. Standard `tools` is an admitted core namespace dependency with an
explicitly partial callable surface. Package `tools/**` files are retained under a hidden immutable
resource root and relative reads resolve there only while retained package source is evaluated;
`system.file()` cannot expose that implementation root. This models a bounded read-only part of
source installation, not a complete `R CMD INSTALL` snapshot. Digest-pinned opt-in executable tests
cover unchanged `pkgconfig 2.0.3`, `generics 0.1.4`, `withr 3.0.3`, `R6 2.6.1`, `viridisLite 0.4.3`,
`RColorBrewer 1.1-3`, `assertthat 0.2.1`, `crayon 1.5.3`, `praise 1.0.0`, `prettyunits 1.2.0`,
`evaluate 1.0.5`, `numDeriv 2016.8-1.1`, `abind 1.4-8`, `rprojroot 2.1.1`, `rstudioapi 0.19.0`,
`inline 0.3.21`, `rematch 2.0.0`, and `whisker 0.4.1` sources. The third holdout rotation evaluated
`evaluate` and `numDeriv` without first using either package's R source to guide implementation;
both now reach P4 through public exports. The evidence covers evaluate's output-handler and
condition predicates plus numDeriv's public finite-difference gradient and Jacobian, with separate
pinned source and NativR-artifact digests. Together these tests prove the repository-to-namespace
path, package-owned S3 dispatch, and generated state-restoring wrappers through `with_options()`,
plus R6 generator/object construction and public reference mutation, private-state method access, an
active read/write field, shallow/deep cloning, and three-level inheritance with recursive `super`
calls, plus package-owned 256-anchor Lab spline palettes through generic arithmetic/array and
`grDevices::colorRamp` semantics, plus exported RColorBrewer palette metadata through
explicit-row-name `data.frame()` construction and exact palette/warning execution, without package
patches.

The fourth source-blind rotation evaluates `abind` and `rprojroot` only after collecting release
metadata, public documentation, public API expectations, and black-box GNU R results. Both reach P4:
abind binds two matrices along a new dimension and removes a singleton dimension; rprojroot
constructs and combines S3 root criteria and resolves roots/files in the browser-owned virtual
filesystem. The reusable contract increment includes syntax and first-class specific/`Ops` operator
dispatch on either operand, incremental namespace S3 registration, `..N`, `missing(..N)`,
missing-endpoint `seq()`, `sign()`, `dimnames<-`, `methods::Quote`, trailing `as.data.frame()`
controls, and list/data-frame `is.na()` shape. A later general call-element increment adds named,
numeric, and logical language-call extraction/replacement, retaining normalized syntax for `eval()`.
The unchanged `abind::asub()` and `abind::acorn()` paths now execute their array selections through
that seam. NULL subscripts select zero elements and make `[<-` a no-op, including the empty-control
path in numDeriv. The next direct-test increment preserves `match.call(expand.dots = FALSE)$...` as
a pairlist of quoted arguments, accepts literal `$...` extraction/replacement, and admits the
measured positional `deparse(expr, width.cutoff)` call for short expressions. Matrix-to-data-frame
conversion now creates columns in source order and `as.matrix()` reconstructs atomic, including
factor-to-character, data-frame columns in column-major order. `array(data)` uses a one-dimensional
extent equal to `length(data)`; `dimnames(NULL)` returns NULL; base `LETTERS` is available. The five
unchanged abind direct-test scripts now execute in fresh sessions under a finite opt-in package-test
profile. `evalDetailed` can continue after a top-level error when a callable `options(error=)`
handler is installed, preserving two expected errors in `tests/adrop.R` and one in `tests/afill.R`;
ordinary evaluation still stops on an uncaught error. Reusable nested NULL and name replacement,
first-class constructed `[` calls, and one-/two-dimensional array dimname printing close the
measured execution gaps. The digest-checked P5 probe also completes all five applicable Rd topics
from unchanged source. Precedence-aware deparsing, higher-dimensional array printing, generic
`rbind`/`cbind` dimension names, condition call traces, and visible parenthesized assignments now
make all five saved outputs match after generic prompt and whitespace normalization. This
establishes P6 for the pinned release. Byte-level output identity, remaining package-check stages,
P7, and arbitrary package execution remain unclaimed. Long-call `deparse()` line wrapping,
list-column matrix conversion, and full matrix name repair remain outside this increment.

The digest-checked `rprojroot 2.1.1` P5 probe inventories five indexed Rd topics and executes both
default-applicable blocks from the unchanged source. The remaining three topics contain only
`\\dontrun` blocks and are recorded as exclusions. Its sole top-level direct-test entrypoint,
`tests/testthat.R`, requires `testthat`, which is not installed in the NativR package corpus; twelve
nested R files therefore remain unexecuted. This is a P6 first blocker, not package-test success.

The digest-checked `R6 2.6.1` P5 probe executes both default-applicable Rd topics from the real
installed source and records one excluded `\\dontrun` block. Its `tests/testthat.R` entrypoint also
requires unavailable `testthat`; fifteen nested R files remain unexecuted, so P6/P7 are not claimed
for R6.

`Sys.info()` preserves the R 4.6.1 named-character/zero-formal shape but reports the virtual browser
platform (`NativR`, `wasm32`) and missing host identity fields. `diag<-` now performs measured
matrix and data-frame diagonal replacement, including zero-size, list-matrix, numeric-promotion, and
attribute-preservation cases. `prod()` covers the measured numeric, logical, complex, missing, and
data-frame aggregate paths. These reusable changes complete all four applicable unchanged numDeriv
Rd examples, raising that pinned package to P5. Cartesian positive-integer complex power removes the
former complex-gradient assertion in `tests/CSD.R`; the isolated Example 3 had an error of
5.0779879265460925 in NativR versus 1.20338213114386e-16 in GNU R 4.6.1 before that fix. A bounded
300-million-step/50-million-vector opt-in profile completes all seven unchanged top-level test
scripts, including `tests/CSD.R` at 273,659,236 steps and 382,508,540 cumulatively allocated
elements. Generic vectorized `asin()`, `acos()`, and `atan()` clear the final `tests/trig01.R`
blocker, establishing P6. GNU R 4.6.1 exits successfully on the same seven scripts, but matrix print
layout and numeric precision differ in the explicit output. The archive has no `.Rout.save` files.
Full `R CMD check` and output fidelity remain unverified P7 work.

`is.primitive(x)` classifies first-class base functions against the GNU R 4.6.1 observable
primitive-binding catalog, independently of NativR's internal eager/special dispatch kind. A
digest-checked `assertthat 0.2.1` P5 probe inventories 11 Rd example topics with 12 runnable blocks
and one excluded `\\dontrun` block. Seven topics complete, including `man/are_equal.Rd` and
`man/assertions-file.Rd`, after generic function introspection, call matching, condition handling,
partial argument matching, and virtual `file.access` support. The first blocker is
`man/not_empty.Rd`: the standard `datasets::mtcars` binding is unavailable. That package remains P4
with an explicit P5 blocker.

The fifth source-blind rotation evaluates rstudioapi and inline after the same public-only evidence
gate. Both install, load, attach, and reach P4 unchanged. The reusable contract increment treats
`exportMethods()` declarations as namespace exports without requiring every S4 method name to be an
ordinary variable binding, assigns `head()` and `tail()` to their GNU R `utils` namespace, and adds
environment-scoped `utils::globalVariables(names, package, add)` accumulation/query behavior.
rstudioapi's document-position/range constructors and outside-RStudio availability path execute;
inline's plugin registration/query path executes. RStudio host operations and inline's
`cfunction()`/`cxxfunction()` native compilation, dynamic loading, P5-P7, and arbitrary package
execution remain unclaimed.

The sixth source-blind rotation evaluates rematch and whisker only after recording official release
metadata, public API documentation/formals, representative black-box GNU R results, and frozen
source digests. Both install, load, attach, and reach P4 unchanged. The reusable contract increment
adds `NROW()`/`NCOL()` dimensional extents without class-method dispatch, `rownames<-`/`colnames<-`,
base `T`/`F`, bounded GNU R-compatible regex normalization and lazy-overlap behavior, replacement
backreferences, capture-free `strsplit()`, three-phase matching for apply-family calls, factor-label
equality and membership, and atomic `[<-` promotion when the right-hand side is a list. The evidence
covers rematch's scalar/vector matches, named captures, no-match shapes, and factor input plus
whisker's scalar, section, inverted-section, escaped/unescaped, and triple-brace rendering. This is
not a claim of complete POSIX/PCRE equivalence, every package export, P5-P7, or arbitrary package
execution. `zeallot 0.2.0` and `ini 0.3.1` remain uninspected P0 holdouts.

The same profile corrects a previously admitted oracle gap: `Sys.which()` accepts symbol and
language values through ordinary character decomposition before its explicit allow-list lookup. A
later exact GNU R 4.6.1 oracle check establishes that `help()` leaves `verbose=` unevaluated on
measured topic, missing-topic, and package-index paths. These are reusable Base/utils semantics, not
host process discovery or desktop help integration.

The seventh source-blind rotation evaluates zeallot and ini only after recording public manuals,
formals, representative black-box GNU R results, and source digests. Both reach P4 unchanged. The
reusable contract increment adds bounded `startsWith()`/`endsWith()`, `regexec()` capture locations,
language equality, constructed assignment calls, promise-origin-aware `parent.frame()`, embedded
runtime constants for `call()`/`as.call()`/`substitute()`/`bquote()`, and recursive `as.character()`
coercion. Evidence covers nested/collector/default/named/rightward/data-frame/S3 destructuring plus
browser-owned INI parsing and serialization. Complete regex identity, every export, P5-P7, and
arbitrary-package execution remain unclaimed. At that rotation boundary, `cpp11 0.5.5` and
`otel 0.2.0` became the uninspected P0 holdouts.

The eighth source-blind rotation evaluates cpp11 and otel only after freezing public manuals,
formals, GNU R black-box outputs, and source digests. The reusable contract separates executable
R-source units from immutable resource bytes and adds list/factor `%s` formatting, recycled bounded
`strrep()`, vector/list/pairlist/expression `length<-`, recursive `anyNA()`, and stable
`make.unique()`. Both unchanged packages reach P4 through public resource-vendoring and no-op
telemetry surfaces. Native compilation, telemetry exporters, every export, P5-P7, and universal
package execution remain outside the claim. `BH 1.90.0-1` is the next untouched P0 holdout.

The ninth source-blind rotation evaluates BH only after official CRAN metadata and GNU R black-box
resource shape were frozen. Generic admission now permits up to 16,384 archive files and 192 MiB by
default, rejects archive-limit errors promptly, validates aggregate resources before Worker transfer
and in the runtime host, and computes standard `exportPattern()` names after local namespace
bindings load. Unchanged BH loads and attaches with zero R exports and 12,554 headers totaling
128,040,580 bytes, reaching P3. P4 is not applicable because the package declares no R functions;
this does not claim that downstream `LinkingTo: BH` C++ packages compile or execute. The committed
top-100 snapshot now has no untouched candidate whose entire runtime closure is already available
and native-free.

`exportPattern()` resolves against local namespace bindings after package source evaluation. Its
quoted pattern supports the standard POSIX character classes under the deterministic C locale;
invalid patterns and unsupported collating or equivalence constructs fail during namespace load.
Pattern exports are available through `pkg::name`, namespace export queries, and package attachment.

Package admission is not universal execution compatibility. Package `data/*.R`, `.csv`, `.tab`,
`.txt`, and XDR/gzip `.rda`/`.RData` discovery/loading is supported through `utils::data`, including
explicit target environments and overwrite protection. Text data now applies GNU R's `as.is = FALSE`
factor conversion. A separately attributed UCI Iris text resource flows through the same generic
core-package resource and `data()` path; `data(iris)` yields the 150-row, five-column frame with
four numeric measurements and a three-level Species factor. This is executable evidence for one
standard dataset, not the full `datasets` catalog or lazy lookup of every built-in dataset. The
package tool normalizes bzip2-wrapped `.rda`/`.RData`/`.rds` resources to size-checked raw
serialization bytes at build time; no bzip2 decoder or package-installation authority enters the
browser bundle. `R/sysdata.rda` initializes the namespace before package source. Depends-style
attachment, installed `.rdx`/`.rdb` lazy-load databases, data indexes/aliases, broader NAMESPACE and
S4 registration, bytecode, compiled code, arbitrary connections, direct runtime bzip2 streams,
xz/zstd, unsupported serialized types, license-policy decisions, and R CMD check behavior remain
outside this slice.

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

Profile 0.306 shares syntax depth validation across compact deparsing, diagnostics and closure
layout. Display depth beyond 512 is rejected with `NRL4004` before recursive formatting. Public
`deparse` and `deparse1` charge syntax traversal to the session work budget. Shared subexpressions
remain valid. These are NativR resource limits, not GNU R equivalence claims; broader compact-output
allocation limits remain separate work.

Recursive value printing rejects nesting deeper than 512 with `NRL4004`. List and closure formatting
checks accumulated UTF-8 output bytes while assembling lines; the final output route also enforces
the session limit. These resource boundaries are NativR-owned behavior.

Profile 0.307 aligns direct browser bundle admission with build-time DESCRIPTION checks: metadata
must contain one nonempty DCF record, duplicate fields are rejected, and a continuation requires a
preceding field. Blank or whitespace-only lines separate records; surrounding blank lines are
allowed. Malformed direct bundles fail with `NRE2229`. Multi-record repository indexes remain valid.
This is a strict package-admission policy, not a claim to reproduce general `read.dcf` behavior or
all DESCRIPTION checks.

Profile 0.308 attaches a source package's exports and search-path entry before invoking `.onAttach`.
Independent GNU R fixtures verify that the hook can observe both. Hook failure removes that
attachment while keeping the loaded namespace available for a retry. Owned-state tests additionally
cover masked export restoration, preservation of other attachments created by the hook, cached
search-environment links, and recovery after a work-limit failure. Detach/unload and complete
package event-hook semantics remain unimplemented.

Deliberate current exclusions include GNU R/webR embedding, browser-time package installation,
universal package execution, generated JavaScript execution, the complete graphics-device/base-
graphics stack, filesystem access, runtime network access, locale-specific raw encodings, and the
unimplemented remainder of complex mathematics.

Usage-ranked `graphics::title()` has GNU R 4.6 black-box evidence for its exact formals/defaults,
invisible `NULL` result, pre-plot error, annotation coercion, list-local style overrides, unknown
graphics-parameter boundary, session `par()` state, explicit line/outer placement, and the
main/subtitle/axis-label style families. Its normalized text events execute through inline, Worker,
record/replay, Canvas, PNG, and PDF paths, including unchanged source-only package code. Browser
plotmath glyph layout, exact device-specific margin metrics, Hershey fonts, and the rest of the
base-graphics layout engine remain compatibility depth.

Usage-ranked `graphics::abline()` has GNU R 4.6 differential evidence for its exact
`a, b, h, v, reg, coef, untf, ...` signature, invisible `NULL`, two-element `a` shorthand, `b`
through-origin behavior, coefficient and model precedence/warnings, one-coefficient model slope,
arbitrary registered S3 `coef.*`, nonfinite horizontal/vertical omission, empty styles, and invalid
inputs. NativR clips finite intercept/slope lines to the active linear plot window and emits
horizontal/vertical segments in GNU R's style-recycling order. The same bounded events pass through
inline callbacks, the Worker protocol, Canvas, PNG, PDF, and record/replay, including unchanged
source-only package code. Log-axis `untf`, clipping outside the plot region when `xpd` expands it,
and exact device line-cap/join behavior are not part of this shape-level claim.

Usage-ranked `methods::signature()` represents 18 measured calls in inline's CRAN reference-manual
examples. Empty, positional, named, mixed, duplicate-name, empty-string, and missing class values
produce GNU R-compatible character-vector shapes; nonscalar, noncharacter, factor, `NULL`, and
missing arguments fail explicitly. The full signature is retained by `setMethod()` and participates
in exact, inherited, named, positional, and `ANY` multi-argument dispatch through both generated
generic wrappers and `standardGeneric()`. This directly covers inline's pure-R S4 registration layer
without claiming that its compiled C/C++/Fortran payloads can execute. Ambiguous-method diagnostics,
union classes, `callNextMethod`, primitive/group generics, and the complete methods package remain
compatibility depth.

Profile 0.309 provides `.GlobalEnv` as a locked, ordinary base binding, including `base::.GlobalEnv`
and package namespace lookup. Lexical shadowing remains possible. Session reset replaces the binding
with the fresh session global environment and restores its lock; sessions remain isolated.
Independent GNU R 4.6.1 probes cover location, lock/active state, identity, shadowing and rejected
assignment. Recursive Oracle v2 checks shared environment values written through `.GlobalEnv`, and
the native package-hook fixture now uses this binding. This does not extend search-path, detach or
unload compatibility.

Profile 0.310 makes the global environment parent chain use the same attached environments returned
by `as.environment()`. Attached export mutation affects unqualified lookup; namespace bindings
remain separate. Search-chain identity holds after reset, and failed attachment removes only its
environment while preserving nested attachments and masking. Independent native package fixtures
cover identity and unlocked export mutation. Default package-environment locking, arbitrary
`attach`, `detach`, and namespace unloading remain incomplete; static namespaces still share the
base implementation environment.

Profile 0.311 implements `detach` for supplied source packages: name/position selection,
`character.only`, attached `Depends` guards with `force`, invisible NULL, `.onDetach` before
removal, namespace retention, masking restoration, escaped export preservation with base parent, and
reattachment without rerunning `.onLoad`. Ordinary hook errors warn and proceed; resource-limit and
unsupported-capability failures abort without detaching. Native independent package fixtures cover
successful and failing hooks and subsequent reattachment; Oracle v2 covers formals and invalid-name
control flow. Namespace unloading (`unload=TRUE`), static core package detachment, arbitrary
attached objects, user `setHook` lifecycle dispatch, and exact hook-error call formatting remain
unsupported or incomplete. No P7 package promotion follows from this bounded lifecycle work.

Profile 0.312 supports source `unloadNamespace` and `detach(unload=TRUE)`. Attached packages detach
first; loaded namespace imports prevent unregistration. Direct unload reports an error for that
blocker, while detach-with-unload warns and retains the namespace. `.onUnload` sees the namespace
loaded and detached; ordinary hook errors warn and proceed, while resource failures preserve the
namespace for retry. Unregistration retains escaped environments, closures, their namespace names,
and registered S3 methods, matching independently authored GNU R 4.6.1 fixtures. Reload constructs a
fresh namespace and reruns load hooks. Absent namespaces return invisible NULL. Static core and DLL
unloading, user lifecycle hooks, complete S4 deregistration, and exact hook-error call rendering
remain incomplete. `length` now uses shared S3 class/default dispatch, closing a gap exposed by the
retained-method fixture; unclassed values keep their primitive length behavior. Exhaustive primitive
`NextMethod` fallback remains outside this claim.

Profile 0.313 runs registered user package lifecycle callbacks. `onLoad` and `attach` callbacks
follow package hooks; `detach` and `onUnload` callbacks precede package hooks. Callbacks receive
package name and the browser-owned package path, execute in registration order, and use a snapshot
of the current hook list. Clearing or replacing hooks during execution affects later events.
Ordinary callback errors print to stderr and allow subsequent callbacks to run; resource and
unsupported-capability failures remain explicit. `setHook` supports unnamed lists, NULL clearing,
and stored non-callable values that fail during invocation. Native fixtures cover order, state,
argument paths, non-callable entries, clearing during dispatch and continued execution after
failure. Reset clears registrations. Exact arbitrary callback diagnostics/caller frames, named
hook-list metadata, static-package lifecycle transitions and complete namespace semantics remain
compatibility depth.

Profile 0.314 separates registered core namespaces from attached package environments and the base
environment. The base namespace has distinct identity, shares base bindings, and has the session
global environment as its parent; reset refreshes that parent. Other core namespaces use named
imports environments whose parent is the base namespace. Builtin package ownership follows the
checked-in public GNU R 4.6.1 export inventory; `stats::mean` is rejected, and `graphics::plot`
preserves the base generic re-export. Explicit source-package imports remain available with a
base-only global search path, while unimported functions do not leak from the base environment.
Serialization preserves base/base-namespace identity. Evidence uses independently written cases and
native package fixtures. Complete core import graphs, static core detachment/unloading, and full
clean-base installation checks remain incomplete; this does not establish P7 compatibility.

Profile 0.315 permits detachment and reattachment of registered core package exports while retaining
their namespaces. Escaped attached environments retain their values and parent the base environment;
reattachment creates a fresh export environment. Registered user detach/attach callbacks observe the
package still/already attached and receive its system-library path. Resource failures retain an
existing attachment during detach and remove a newly created attachment during attach. The package
checker separately observes loading and attachment with only `.GlobalEnv`, `Autoloads`, and
`package:base` on the search path. It validates the initial path, absent unqualified `median`, and
fresh target namespace state. Core namespaces remain loaded, so this evidence does not establish
startup without default namespaces, full native core hook side effects, static namespace unloading,
or full installation validation. Those remain explicit limitations, and P7 remains unproven.

The package-tools `description-structure-v1` assessment records single-record DCF admission,
required literal field presence, documented package-name/version grammar and dependency-list syntax.
It follows the public Writing R Extensions DESCRIPTION contract, with independently authored
black-box GNU R identity diagnostics. `Authors@R`-derived fields are unexecuted rather than accepted
without evaluating their values. Structural success does not validate license expressions,
maintainer addresses, prose quality, all field rules or undeclared/transitive dependencies. The
checker preserves the unexecuted full-metadata stage and fails it when a structural check fails.
This is package-check evidence policy, not a change to runtime semantic profile 0.315.

The `description-structure-v2` tooling policy additionally records native strict Title and
Description punctuation diagnostics. Title rejects a terminal ASCII period; Description requires a
terminal `.`, `!` or `?`, optionally followed by one closing quote or parenthesis, after DCF
whitespace handling. Independently authored native fixtures cover empty fields, punctuation-only
text, ellipses, quotations and continuation lines. Required presence remains a separate check. These
diagnostics do not establish sentence quality, title case, single-paragraph prose, license validity
or complete metadata validation. Historical v1 reports remain readable; runtime profile and callable
capabilities are unchanged.

Profile 0.316 adds ordinary S3 class/default dispatch for `c()` based on its first argument after
forcing all supplied arguments. Later classed arguments and an unclassed first argument do not
trigger this dispatch. `NextMethod()` traverses the remaining methods and, for `c`, reaches an
explicit primitive implementation without redispatch. Native cases cover first-argument selection,
default methods, inherited methods, retained names and primitive fallback; unit cases cover eager
evaluation and single evaluation of side effects. This is a shared prerequisite for classed
collections such as `person` metadata used by Authors@R. Person construction/formatting and derived
author validation remain unimplemented. General method-local argument updates and exhaustive
primitive fallback/control-argument semantics remain compatibility depth.

Native evidence also establishes default-method re-entry: `NextMethod()` from a default method
selects that default again. This applies to ordinary generics and primitive `c`; resource limits
bound methods that recurse indefinitely. Primitive fallback occurs only when no applicable default
method exists.

### Person metadata baseline (profile 0.317)

`utils::person()` constructs classed lists of records with given, family, role, email and comment
fields. The baseline covers empty objects, list-column vectorization, legacy name arguments, role
filtering, collection concatenation, field/subscript access, text formatting, printing and ORCID
check digits. Private utils S3 methods remain registered across detachment and reset; namespace
exports exclude those private bindings. Shared `[`/`[[` dispatch preserves missing indices, and
`as.character` dispatches class methods.

Evidence consists of independent fixtures, recursive object/formals comparison, and an optional
black-box test of the native accepted role catalog. The observer traverses unclassed storage for
classed vectors/lists so user methods cannot change the recorded payload. No implementation bodies
were used. Public references: the R utils person manual and ORCID's ISO 7064 MOD 11-2 identifier
specification.

This is a bounded prerequisite for Authors@R. Parsing with `as.person`, derived DESCRIPTION
validation, R/Markdown styles, ROR handling, class-specific noncharacter field coercion, nested list
fields, and exhaustive formatting options/private-method formals remain outside the claim.
Unsupported class-specific coercion and non-text styles fail explicitly.

The invalid-role recursive fixture compares the filtered value with warnings suppressed. Native
warning class/call envelopes are not yet represented by the runtime warning API, so exact condition
equivalence for person warnings is not claimed.

### Executed Authors@R role evidence

The package checker separately records `authors-person-roles-v1`: it evaluates the unchanged
Authors@R expression in fresh bounded sessions and compares NativR with native GNU R. Its three
flags record a person list, a named role-bearing author, and exactly one named creator with a
bounded first email address. Multiple emails use the first value. Independent fixtures also compare
acceptance with GNU R's DESCRIPTION checker, without inspecting its implementation.

An absent field is inapplicable. Evaluation failure or missing output is incomplete evidence; a
completed differing result or matching invalid metadata fails the metadata stage. Full metadata
validation stays unexecuted. Derived Author/Maintainer formatting, explicit-field conflicts,
complete email syntax, field integrity and warning equivalence remain open. Structural checking
continues to avoid evaluating source; this separate opt-in package-check execution supplies the role
evidence. The runtime profile remains 0.317.

### Person whitespace and derived fields (profile 0.318)

Person field strings trim only boundary spaces, tabs, CR and LF, including role values before
catalog validation. Interior whitespace and named comments are preserved; vertical tab and form feed
are not boundary-trimmed. Independent unit and recursive native fixtures establish this
normalization, including the difference between stored text and DESCRIPTION expansion.

The package checker records `authors-derived-fields-v1` separately from role validity. It compares
independently derived Author/Maintainer strings against native metadata expansion, using UTF-8 hex
framing to preserve newlines. Author text includes named role-bearing people, excludes email, and
collapses internal whitespace; people are separated by comma/newline/two spaces. A single named
creator with an email supplies Maintainer, using its first email and omitting role/comments.
Explicit fields take precedence, including empty strings. Invalid email text may still be expanded;
role/email validation remains a separate observation. Evaluation errors and unsupported formatting
remain incomplete evidence. Full DESCRIPTION validation and P7 remain open.

### Effective author metadata assessment

The package checker now combines explicit DESCRIPTION fields with completed matching derived-field
observations under `effective-author-fields-v1`. It checks nonempty effective Author/Maintainer
fields and the final angle-bracketed Maintainer address. Explicit fields, including empty values,
retain precedence. Missing, failed or contradictory derivation cannot establish field validity.

Maintainer syntax is independently specified and tested against GNU R DESCRIPTION diagnostics:
dot-atom or nonempty quoted local parts, escaped quoted characters and dotted domains. Diagnostic
acceptance permits an absent displayed name and validates the final address even when preceding text
includes another address. This is not a claim of email deliverability or full RFC conformance. The
role observer advances to `authors-person-roles-v2` to share quoted-local-part handling.
Internationalized addresses, comprehensive metadata validation and P7 remain open. Runtime profile
0.318 is unchanged because this change is package-check tooling.

### Shared POSIX regex classes (profile 0.319)

Ordinary regex consumers now share the independent C-locale POSIX bracket translator previously used
only for namespace export patterns. The supported classes are alnum, alpha, blank, cntrl, digit,
graph, lower, print, punct, space, upper and xdigit. Translation composes with class negation,
adjacent literal members, a leading literal closing bracket, ranges and quantifiers. Fixed matching
preserves literal pattern text. Unknown classes and collating/equivalence elements fail explicitly
instead of falling through to incompatible JavaScript matching.

Evidence compares every non-NUL ASCII character for all 12 classes with native R in both ordinary
and perl modes, plus replacement, splitting and capture/location graphs. This does not establish
complete TRE/PCRE identity, locale-specific Unicode classifications or all case-folding behavior.
The same runtime helper serves namespace export patterns and base string functions without changing
package dependency direction or executing generated JavaScript.

The same profile corrects location-result metadata: ASCII-only pattern/input vectors report
`index.type = "chars"` and `useBytes = TRUE`; mixed Unicode input omits those attributes. Missing
entries and Perl regexec attribute order follow separately observed native behavior. Explicit
byte-oriented matching remains outside the admitted contract.

### Source character escapes (profile 0.320)

The parser now decodes one-to-three-digit octal escapes, one-to-two-digit hex escapes,
one-to-four/eight-digit Unicode escapes (including braced forms), escaped backticks and raw
character delimiters. It rejects unknown escapes, zero bytes, out-of-range octal/Unicode values,
mixed byte/Unicode escapes and Unicode escapes in backtick identifiers with structured diagnostics.
No statements execute when a program has an error diagnostic. Unpaired Unicode surrogates are
explicitly outside the browser string contract; native nonstandard UTF-8/warning behavior is not
claimed. Paired surrogates decode to their Unicode scalar.

Normalized StringLiteral nodes can carry exact byte payloads and encoding marks. Evaluation,
quotation and language-value reconstruction preserve these bytes; byte-bearing deparse uses
reparseable hexadecimal spelling when needed. This does not claim native textual deparse identity
for invalid UTF-8 or complete byte-string behavior across all string operations. The contract is
supported by all 255 nonzero byte escapes and recursive byte/encoding observations, with independent
fixtures based on the public R Quotes documentation and GNU R 4.6.1 black-box execution.

### Process-time summary and printing (profile 0.321)

`summary.proc_time` combines parent and nonmissing child user/system times, retains elapsed time,
and returns three named values without the input's class or extra attributes. Numeric, integer,
logical and complex fixtures cover absent child fields, missing parents, NA/NaN children and empty
inputs. `print.proc_time` prints that summary using session options, ignores unused dots, and
invisibly returns the original object. Both methods are registered with base S3 generics and
exported. `summary` now dispatches class/default methods with lazy dots; its default options and
complete native method catalog remain incomplete. Real CPU and elapsed timings remain
platform-adapted; this increment does not establish exact native package timing output or P7
compatibility.

### Sum input and result types (profile 0.322)

`sum()` admits named data arguments and NULL, matches only exact `na.rm`, and forces arguments in
source order before reduction. All-integer/logical input returns an integer when possible; crossing
the integer range after a complete argument promotes the running result permanently to double.
Within one integer vector, an exact accumulator permits cancellation without premature promotion.
Missing results retain the current promoted type, with real/complex input types determined before
reduction. Native fixtures cover empty vectors, NULL, named arguments, range boundaries, ordered
missing inputs and control evaluation. Factors fail explicitly. Summary group/data-frame dispatch,
componentwise complex NA payloads and platform-specific extended-precision floating accumulation
remain incomplete; these results do not establish full summation or numerical-package identity.

### Summary group dispatch (profile 0.323)

`sum`, `prod`, `min`, `max`, `any`, `all` and `range` dispatch on the first data argument after
forcing arguments in source order. For each class, a specific method precedes a Summary method.
Initial dispatch ignores `.default` methods; continuation can select the specific generic's default
and then its primitive implementation. Methods receive an explicit uncoerced `na.rm`, defaulting to
FALSE, plus `.Generic`, `.Group`, `.Method` and `.Class` metadata. Namespace Summary registrations
use base's group identity without exposing a fictitious callable named Summary.

`NextMethod()` retains the selected dispatch group, class history and original arguments. Native
fixtures cover inherited group methods, specific-method continuation, primitive fallback and bounded
mixed-method re-entry. Native pathological recursion is subject to NativR's call-depth guard.
Modified method arguments, dispatch-environment variables and exact reconstructed calls remain
outside this increment. Full factor/data-frame/time-class Summary method catalogs, other
group-generic families and floating accumulation remain incomplete.

### Factor Summary methods (profile 0.324)

Base registers and exports `Summary.factor` and `Summary.ordered`. Unordered factors reject all
Summary members. Ordered factors admit `min`, `max` and `range` only when every supplied data
argument is ordered with identical levels in identical order. Results retain ordered/factor class
and levels, discarding names and incidental attributes. Missing and empty inputs produce missing
ordered values; empty/all-removed inputs emit the observed extrema warnings in order. Unsupported
ordered operations and incompatible levels fail explicitly. Recursive native fixtures cover results,
formals, control forwarding and inherited group dispatch. Malformed factor storage, missing level
labels and exact native warning call envelopes remain outside these sampled claims.

### Atomic extrema (profile 0.325)

`min`, `max` and `range` preserve integer/logical result types unless a double input promotes the
result. Empty numeric reductions return double infinities with ordered warnings; missing integer
reductions retain integer NA. NA takes precedence over NaN regardless of input order. NULL and named
data arguments are admitted, primitive `na.rm` uses scalar coercion, and results discard input
attributes. Character reductions support ordinary ASCII ordering, mixed atomic coercion and missing
or empty character results. `range(..., finite=TRUE)` removes nonfinite numeric values and missing
values. Independently authored recursive native fixtures verify these result graphs, error messages
and unit tests check native-observed warning order. Recursive list inputs to range, malformed range
control identity, locale-dependent collation, character byte/encoding identity and full
data-frame/time-class method catalogs remain incomplete. Exact warning call envelopes are outside
this increment.

### Data-frame Summary methods (profile 0.326)

Base exports and registers `Summary.data.frame` across sum, product, extrema, range and logical
summaries. Each numeric-alike frame is combined into one atomic argument, preserving common type and
integer argument-boundary behavior. Logical, real, complex and matrix columns are admitted; factor,
date/time, raw, character and list columns fail explicitly. Multiple frames and numeric arguments
are supported when the first argument selects the method. Missing, empty and scalar controls
delegate to the shared reducers; empty or multi-element atomic `na.rm` controls follow the observed
argument-expansion behavior. The former product-only flattening shortcut is removed, so a later data
frame does not silently bypass first-argument dispatch. Independently authored native recursive
fixtures cover method formals, result graphs, controls and failure messages. Custom
numeric-predicate/coercion methods, non-atomic controls, malformed frames, componentwise complex NA,
extended floating accumulation and exact warning call envelopes remain incomplete.

### Numeric predicates (profile 0.327)

`is.numeric` dispatches on explicit classes, supports a classed-input default method and permits
`NextMethod()` to reach the storage predicate. Unclassed inputs use the storage predicate directly.
Base registers `is.numeric.Date`, `is.numeric.POSIXt` and `is.numeric.difftime`; these return FALSE
without forcing their argument. Integer and double storage is numeric except factors; complex,
logical and other storage is not numeric. Data-frame Summary validation now consults custom numeric
predicates before accepting ordinary numeric columns, including the registered time predicates.
Independent native result graphs cover classification, lazy time methods, formals, method metadata,
default selection and frame validation. Summary validation uses base namespace lookup, so
caller-local methods do not override it. Global custom methods are covered by unit tests based on
native probes. Malformed predicate results, S4 dispatch and custom matrix coercion remain
incomplete.

### DESCRIPTION diagnostic policy v3

Build-time package inspection now emits `description-structure-v3`. It rejects case-insensitive
reserved Priority values `base` and `recommended`. For Depends, Imports, Suggests and Enhances,
structural diagnostics require native-observed constraint spacing and at least two numeric version
components, admit R revision constraints in each field, and admit a single terminal comma while
rejecting leading or interior empty entries. A 134-input independently authored native fixture
matrix checks diagnostic presence for these dependency and Priority rules. LinkingTo retains the
separate loader syntax check; native DESCRIPTION diagnostic equivalence is not claimed for that
field. Old v1/v2 assessments remain readable evidence. This build-time policy does not change the
runtime semantic profile or claim dependency availability, full metadata validation, license
validity or P7 completion.

### License structural policy v1

Build-time `inspectPackageLicense` reports independent expression recognition, required template
extensions, permitted extra terms and root file-reference presence. A 32-row public catalog is
pinned to GNU R 4.6.1 through its observable database API; no implementation source or license text
is copied. Native fixtures compare catalog data and diagnostic flags across canonical names,
abbreviations, display labels, numeric version restrictions, alternatives, unknown expressions and
present/missing files. Package reports include `licenseAssessment` and credit only the executed
checks. File content, standardization aliases, SPDX expansion, legal rights and dependency-license
compatibility remain outside this structural policy. The runtime profile remains 0.327 and full
metadata/P7 remains open.

### License structural policy v2

`inspectPackageLicense` accepts optional file text and checks template DCF syntax and required
fields. MIT and BSD templates require YEAR and COPYRIGHT HOLDER; BSD 3-clause additionally requires
ORGANIZATION. The observed checker combines required fields across alternatives and reads the first
referenced file. Multiple records and repeated fields are admitted; each record must contain
nonempty required values. Empty files pass the sampled native structural check, and field meaning is
not inferred. Missing text remains unexecuted. Independently authored native fixtures cover 136
template/file/alternative combinations. The package runner supplies only root LICENSE/LICENCE text,
credits the executed diagnostics, and preserves full metadata/P7 as incomplete. Legal
interpretation, encoding edge cases and template field meaning remain outside this build-time
policy; the runtime profile is unchanged.

### Namespace declaration audit v1

Build-time `inspectPackageDependencyDeclarations` audits supported static import/importFrom package
names against DESCRIPTION Imports/Depends. GNU R 4.6.1 base packages are exempt. Suggests, Enhances
and LinkingTo do not satisfy a namespace dependency declaration. Native fixtures verify missing sets
across 12 field, quoting and base-package cases; an independent native R CMD check fixture confirmed
the missing declaration is a dependency error. Unsupported conditional declarations, escaped names
and named controls are marked unexecuted. The package runner records `declarationAssessment` and
credits only completed audits. Dynamic code references, undeclared transitive dependencies and full
metadata/P7 remain open. Runtime capabilities are unchanged.

### Namespace declaration audit v2

Static auditing now accepts named package arguments and exact `except` controls containing literals
or literal `c(...)` lists. Exclusions are not counted as dependencies; other named import arguments
remain package references. Controls may precede or follow package arguments. Missing package names
are sorted in C order. All 23 native fixtures compare the resulting missing-name diagnostic sets.
Computed controls, escaped package names, conditional namespaces, dynamic references and transitive
closure remain unexecuted. This changes build-time audit coverage, not runtime namespace execution
or the semantic profile. The report policy is `namespace-declarations-v2`.

### Namespace import exclusions (profile 0.328)

Source-package imports accept named package arguments and the first exact `except` argument with
literal exclusions, literal `c(...)` lists or NULL. Import controls are normalized from the R AST;
computed expressions fail without execution. The runtime omits excluded exported bindings, merges
repeated full imports by their combined imported surface, and preserves explicit importFrom
re-imports. Ten independently authored source-package installations compare observable imported
bindings with native R. The package-loader conformance suite retains a checked-in executable case.
The build-time declaration audit advances to v3 to apply the native first-except rule, with 24
native fixtures. Conditional namespaces, arbitrary computed controls, full importFrom renaming and
exact conflicting-import warning envelopes remain incomplete.

### Namespace import export boundary (profile 0.329)

Explicit importFrom bindings must belong to the dependency namespace export surface. Private
bindings and inherited base bindings are rejected, as are absent names. Three independently authored
native package installations verify rejection; runtime tests and package-loader conformance retain
executable evidence. Renamed imports and exact native diagnostic wording remain incomplete.

### Namespace import renaming (profile 0.330)

Literal importFrom arguments retain local alias names separately from dependency export names. Named
package arguments and quoted binding names are normalized from the AST. Import directives retain
their order, so full imports and exclusions preserve explicit aliases. Seven native installation
fixtures verify alias presence and values alongside the ten existing import cases. Duplicate local
names within one directive are rejected. Computed directives and exact conflicting import
diagnostics remain incomplete.

### Namespace import conflict warnings (profile 0.331)

Ordinary imports compare an existing local binding with the incoming value using identical.
Different values emit a replacement warning naming the previous and current packages; equal values
are replaced silently. Four independent native installation fixtures cover selected and full
imports, equal values across packages, and repeated imports from one package. The latest binding
remains visible. Renamed incoming binding conflicts, repeated alias errors and their native
diagnostic envelopes remain incomplete; this capability is partial.

### DESCRIPTION structural policy v4

The build-time DESCRIPTION assessment checks VignetteBuilder syntax against 30 independently written
native GNU R 4.6.1 fixtures. It accepts ASCII alphanumeric/dot tokens with comma separators,
including the native empty-entry behavior, and rejects embedded whitespace, constraints and other
punctuation. These tokens are not validated as package names by this native diagnostic. Builder
availability, vignette execution and full metadata validation remain separate, incomplete checks.
This changes build-time evidence only; the runtime profile remains unchanged.

### Provided dependency lookup boundary

Local artifact resolution, repository preflight and repository installation consult only explicit
provided-package entries. Valid package names such as constructor, toString and hasOwnProperty must
resolve to an artifact, repository entry or explicitly supplied version; inherited JavaScript
properties never establish availability. Regression fixtures cover missing roots and dependencies,
explicit versions and artifact load order. Runtime semantics and the capability profile are
unchanged.

### Repository installation index pin

Repository installation accepts expectedIndexIntegrity from a preflight result. The CLI exposes
`--expected-index-integrity sha256-DIGEST`. Invalid pins fail before network access; changed index
bytes fail before any archive download. A matching pin continues through ordinary dependency
installation and archive digest checks. Index identity does not establish source archive identity,
package behavioral compatibility or transitive API coverage. Runtime capabilities are unchanged.

### Bounded repository dependency traversal

Repository installation keeps active packages separate from completed artifacts. The package limit
counts each package once, and a cycle fails when traversal returns to an active package. Required
version constraints are checked against available artifact, provided or index versions before
fetching the dependency archive. Source DESCRIPTION remains authoritative for dependency edges.
Tests cover a two-package closure at its exact limit and early cycle, version and limit failures
without unrelated archive downloads. Runtime semantics and compatibility tiers are unchanged.

### Archive and index dependency disagreement

Three independent repository fixtures verify that installation follows the downloaded archive's
DESCRIPTION when its dependency edges differ from PACKAGES metadata. An archive-only dependency is
installed and included in the lock, an index-only stale dependency is not fetched, and a stronger
archive version constraint fails before downloading the incompatible dependency. The fixtures also
reuse the preflight index pin: unchanged index bytes alone do not prove that the installed
dependency graph equals the metadata plan. Preflight findings remain metadata evidence, not
installation evidence.

### Extended vector summation (profile 0.332)

Double and complex sum inputs use an independently implemented binary accumulator with a 64-bit
significand and ties-to-even rounding after each addition. Each vector result rounds to binary64
before combination with other arguments, matching the observed GNU R 4.6.1 profile. Native fixtures
cover cancellation, halfway cases, finite overflow recovery, infinities, subnormals, complex values
and argument boundaries. Integer promotion and missing-value behavior are retained. Other numerical
reducers and math-library differences remain separate gaps; this does not establish package-wide
numerical equivalence or compatibility with every platform's long-double format.

### Extended matrix reductions (profile 0.333)

colSums, colMeans and rowMeans reuse the owned 64-bit-significand accumulator. Means divide in
extended precision before rounding to binary64, preserving finite means when the unscaled sum
exceeds binary64 range. Gradual underflow and ties-to-even conversion cover subnormal results.
Recursive native fixtures cover real and complex cancellation, overflow, subnormals, infinities,
empty groups and missing-value removal. Existing dimension and naming behavior is retained. The
separate correction pass of mean() and other numerical reducers remain incomplete.

### Extended mean correction (profile 0.334)

Numeric mean accumulation and division use the owned extended arithmetic. Double and complex inputs
additionally accumulate residuals around the extended mean and apply a correction before binary64
conversion; integer and logical means retain direct division. Native evidence includes cancellation
with large magnitudes, finite overflow recovery, subnormals, complex components, infinities, empty
vectors and missing-value removal. Argument matching, trimming and class-method coverage remain
separate contracts; this change does not claim complete mean generic compatibility.

### Complex infinity observation

The recursive observer emits a complex-components token when a non-missing complex scalar has an
infinite or signed-zero component. Each component uses the existing double token grammar, so its
position and infinity sign survive JSON serialization. Ordinary finite complex tokens remain
unchanged. Independent assertions pin all four real/imaginary positive/negative infinity cases, and
a recursive case now compares complex infinities directly. The existing complex-na token still
collapses missing complex components; distinct NA/NaN component payloads remain an observer gap.
This changes conformance evidence, not the runtime semantic profile.

### Complex NaN observation

Complex values for which is.nan is true now retain separate real and imaginary double tokens,
including NaN positions, instead of being collapsed into complex-na. Independent expected-token
assertions cover each single-NaN position and both components. Non-NaN complex NA values retain the
historical collapsed token: component-specific NA storage and observation remain incomplete. This
tightens oracle evidence without changing the runtime semantic profile.

### Mean default dispatch and trimming (profile 0.335)

mean dispatches S3 methods while preserving lazy dots and has a registered, directly callable
mean.default(x, trim = 0, na.rm = FALSE, ...). Numeric trimming removes the specified fraction from
each sorted end; trim at least one half selects the central value or pair. Negative trim retains all
values. Named and partial controls, unused lazy dots and NextMethod have native recursive fixtures.
Non-numeric inputs warn and return NA before forcing trim; positive complex trimming is rejected.
Dedicated Date/time methods, all control-coercion details and rounding-sensitive partial selection
order remain incomplete. The default method reuses the extended mean reducer.

### Mean missing controls (profile 0.336)

mean.default removes missing entries only for a length-one, non-missing logical TRUE na.rm value.
Other control values retain missing entries rather than coercing or rejecting the control. The
control is forced before trim. NA takes precedence over NaN in real means regardless of encounter
order, and complex means preserve a NaN in one component while averaging the other. Native recursive
fixtures cover 15 controls, typed missing inputs, ordering and both NaN component positions.
Component-specific complex NA storage remains incomplete and is not claimed by this profile.

### Numeric time means (profile 0.337)

`mean.Date`, `mean.POSIXct`, and `mean.difftime` reuse the shared mean controls and accumulation,
restoring canonical classes and retaining only the time-zone or units attribute appropriate to the
class. Subclasses, names, and unrelated attributes are removed. Direct calls, trimming, empty
values, missing removal, lazy extra arguments, and method formals have independent black-box GNU R
4.6.1 evidence in `numeric-time-mean-methods`. POSIXlt mean conversion and non-UTC time conversion
remain incomplete; these methods do not establish general date-time compatibility.

The mean probes also exposed an existing selection gap: `[` on POSIXct and difftime can drop
time-zone and units metadata before mean is called. Empty mean inputs are constructed explicitly in
the method fixture to isolate this outstanding subset contract.

### Numeric time selection (profile 0.338)

Registered `[` methods for Date, POSIXct, and difftime preserve subclasses and the applicable
time-zone or units metadata through empty, reordered, and dimensional selection. Date and POSIXct
`[[` methods retain those classes and metadata; difftime single extraction remains an ordinary
scalar. Missing-index whole selection retains unrelated attributes. The independent
`numeric-time-subset-methods` native fixture covers method formals, dimensions, NextMethod
continuation, and empty selection into mean, closing the metadata gap recorded in profile 0.337.
Missing names in selections and general POSIXlt selection remain separate incomplete contracts.

### Missing names in vector selection (profile 0.339)

One-dimensional `[` selects the character names attribute with its missingness and encoding
metadata. Missing, out-of-range, and unmatched selections produce missing names for named vectors;
selected existing NA names remain missing. Empty character indices do not match empty names, and
missing names do not match literal strings. The independent native `subset-name-missingness` fixture
covers atomic, raw, list, pairlist, and Date inputs, numeric/logical/character indices, empty
selections, repeated missing names, and the literal string `"NA"`. This closes the vector-selection
name gap found in profile 0.338. Array dimname selection and replacement-name masks remain separate
incomplete contracts.

`setNames()` and `structure(names=)` now share names-assignment handling for missing entries,
shorter character vectors padded with NA, and NULL name removal. Non-character name coercion and S3
replacement dispatch remain outside this evidence.

### Missing array dimnames (profile 0.340)

Dimensional selection accepts missing axis names and retains their character masks through reordered
or missing indices. Dropped dimensions transfer the surviving axis names, including NA, to the
result's names. Retained dimnames also preserve missing dimension labels; empty selected axes have
NULL dimnames. Native recursive evidence in `array-dimname-missingness` covers one-, two-, and
three-dimensional arrays, dimension dropping, empty axes, and rejected empty/missing character
indices. Replacement-name masks and coordinate-matrix name matching remain separate boundaries.

For one-dimensional arrays, an empty selection with `drop=TRUE` becomes an empty vector and retains
an empty names attribute when the source axis was named.

### Missing names in replacement (profile 0.341)

The shared replacement path retains existing name masks and encoding metadata during atomic/list
assignments, extensions, and atomic-to-list promotion. List deletion via `[<-`, `[[<-`, and `$<-`
tracks retained source positions, preserving NA names after indices shift. New unnamed extension
slots have empty names. Native recursive evidence in `replacement-name-missingness` covers
assignment, extension, deletion, promotion, factors, and missing numeric indices. Missing character
replacement indices and broader data-frame name repair remain separate incomplete contracts.

Factor replacement also restores the class attribute after other attributes, matching the observed
native attribute order.

### Missing character replacement indices (profile 0.342)

Character NA indices in atomic/list `[<-` and `[[<-` append distinct NA-named entries. They do not
match existing missing names or the literal string `"NA"`. Empty character `[[<-` indices append
unnamed entries. Deleting a new NA-named list position leaves existing elements intact. Data-frame
assignment continues to reject missing character indices. Native recursive evidence in
`missing-character-replacement-indices` covers named/unnamed vectors and lists, repeated missing
indices, scalar/vector replacements, and deletion. Broader replacement dispatch and data-frame
diagnostics remain incomplete.

### Missing names in extraction (profile 0.343)

Single `[[` extraction ignores missing names during exact and partial character matching; missing
and empty character indices do not select a named entry. Lists return NULL for those unmatched
indices and for missing numeric/logical indices, while atomic vectors fail. Finite out-of-range
numeric list indices still fail. Default `$` matching treats missing names as the text `"NA"`,
including ambiguity with literal names during partial matching. Its empty-name query does not match.
Independent `missing-name-extraction` native evidence covers both name orders, literal/missing/empty
names, exact and partial matching, and typed missing indices. Recursive missing subscripts and
broader extraction diagnostics remain incomplete.

The callable `$` special now routes literal/symbol member names through the same evaluator path as
syntax, including environment/language handling and S3 dispatch. Dynamic call expressions as member
names remain invalid and are not evaluated.

`do.call()` preserves its selected caller environment on forced argument promises, so local S3
methods remain visible when invoking builtin generics. Its existing quoted-call and
language-argument evaluation boundaries remain unchanged.

### Language arguments to do.call (profile 0.344)

`do.call()` builds an owned AST call and evaluates it in the requested environment. Symbol and
language arguments therefore use ordinary promise evaluation, including lazy unused arguments and
local lookup. `quote=TRUE` wraps each argument in `base::quote()`, retaining observable substitute
syntax and attributed constants. Return visibility is propagated from the invoked call. Missing
argument names become the literal tag `"NA"`. Native recursive evidence in
`do-call-language-arguments` covers these paths, explicit environments, function-name lookup, and
reflection. This replaces the quoted-call/language-argument boundaries recorded in profile 0.343;
complete control coercion and all malformed-call diagnostics remain incomplete.

### R runtime versus package dependency observations

Build-time declared-version evidence policy v2 reserves runtime version lookup for `Depends: R`.
Other dependency fields naming R require a package version lookup; its unavailable result remains
separate from the installed runtime version. Own DESCRIPTION fixtures compare all five dependency
fields against native GNU R 4.6.1 checks. This corrects false satisfied results without changing
runtime semantics or crediting full metadata/dependency validation.

Artifact resolution and both repository paths also reserve `providedPackages.R` for runtime
requirements. An Imports or enabled Suggests dependency named R requires its own package version,
and a root named R requires an artifact or repository entry. Supplied artifacts and repository
records named R cannot replace the runtime version when checking Depends constraints. Runtime
requirements do not create artifact lock edges, even when a package named R is supplied. Synthetic
fixtures verify missing dependencies, runtime and package version mismatches, archive request
boundaries and load order. This is a build-time resolver correction; the runtime capability profile
and package compatibility tiers remain unchanged.

### do.call control evaluation (profile 0.345)

`do.call()` forces and validates args before quote, then forces what and envir in that order. Quote
accepts the scalar numeric, complex, raw and character coercions of an R condition, with length and
missing-value diagnostics verified against GNU R 4.6.1. A quoted pairlist becomes ordinary call
arguments; an unquoted pairlist still fails. Missing character function names look up the literal
name `"NA"`. Empty and nonscalar character names fail, and omitted quote/envir arguments use their
defaults. Formals expose quote=FALSE and envir=parent.frame(). Recursive evidence in
`do-call-controls-and-forcing` covers these paths and argument side effects. The condition
conversion is shared with system.time's gcFirst control, whose missing/list/language cases are also
compared. Full condition-call text, propagated missing-promise diagnostics and every classed
argument-list conversion remain incomplete.

### Apply input conversion and method dispatch (profile 0.346)

`lapply()`, `sapply()`, and `vapply()` resolve FUN before forcing X, convert classed/non-vector
inputs through `as.list()`, and dispatch `[[` on classed converted sequences. Method lookup follows
the base apply context: global/registered methods are visible, while methods local only to the
caller are not. Sequence length does not call a custom length method. Quoted `do.call()` reuses
conversion and extraction before forcing what/envir; unquoted calls retain the original argument
list.

Forwarded dots remain promises, including unused and empty-input cases. sapply controls are forced
after mapping; vapply forces its template and naming control after input conversion. Missing names
survive list conversion and apply outputs. sapply derives automatic character names from its
original input; vapply uses its converted input. Existing names survive sapply's USE.NAMES=FALSE.
Default as.list preserves classed-list attributes, removes data-frame class/row names, and converts
expression vectors to lists of owned language values.

Independent recursive cases `apply-class-conversion-and-extraction` and
`apply-lazy-dots-control-order-and-names` verify these shared paths. Callback promise/call
reflection and general sapply array simplification remain incomplete. Profiles 0.347 and 0.348
extend result validation, template shape, and classed list conversion below.

### vapply template validation and shape (profile 0.347)

`vapply()` checks each callback result before invoking the next callback, checking length before
storage type. Atomic templates support the logical/integer/double/complex widening chain; character
and raw require exact types. List templates collect list elements without recursive flattening.
Empty results retain the template storage type. Non-vector templates fail before USE.NAMES is
forced; expression templates fail after validating that control. USE.NAMES uses the first atomic
value with native logical coercion and rejects missing or non-atomic controls.

Scalar templates produce vectors. Other templates produce arrays with the template dimensions (or
its length) followed by input length, including zero-length inputs/results. Template names or
dimnames take precedence over the first result's corresponding attributes. Input names form the
final axis, missing names survive, and USE.NAMES=FALSE removes output names and dimnames. Dimname
axis labels are discarded. Shape validation occurs after mapping; independently authored recursive
cases `vapply-template-shape-and-types` and `vapply-result-validation-order` verify these rules
against GNU R 4.6.1, including error messages and callback side effects.

Apply input conversion now happens once. Custom as.list results retain their extraction semantics:
NULL is empty, expression/language/pairlist results expose elements, and nonempty environments fail
numeric extraction. sapply pads short automatic character names with missing names and rejects
excess names before forcing simplify. The recursive case `apply-single-conversion-and-name-length`
covers these corrections across apply and quoted do.call. Callback promise/call reflection and
expression-vector metadata remain separate incomplete areas.

### Classed list conversion and names (profile 0.348)

`as.list.Date`, `as.list.POSIXct`, and `as.list.difftime` preserve full source classes on converted
elements. POSIXct restores tzone and difftime restores units, replacing or removing those element
attributes while preserving other attributes already on list elements. Atomic elements drop
unrelated source attributes. Outer results retain names only, including missing and empty names, and
one-dimensional array names. Direct methods also accept ordinary supported vector, list, pairlist,
symbol, and call inputs; dots remain lazy. Custom length and extraction methods are ignored. POSIXct
calls globally visible names methods before conversion and applies the resulting names after
converting elements. Metadata lookup is lazy, cached, and occurs after the first element's class
assignment; empty inputs do not read metadata.

`as.list.factor` preserves scalar levels and full classes, and supports globally visible length,
extraction, and names methods. Two length observations determine allocation and iteration; names are
observed after extraction. NULL results use list replacement deletion behavior. Caller-local methods
do not override this base-method lookup. Native fixtures cover changing valid lengths, custom
extraction, empty factors, direct ordinary storage, and public formals. Malformed second
length-method results, closure conversion, and attributed formula/language representations remain
incomplete.

`structure(levels=)` and `structure(class=)` retain metadata on accepted character attribute
vectors. Factor list conversion retains those attribute objects on scalar results; recursive
observations verify nested metadata directly, including on the original factor stored inside another
list.

Shared names replacement coerces atomic and list values, dispatching as.character for names<- and
setNames while direct attr/structure assignment uses storage coercion. setNames and internal
class-list methods use global method lookup; direct names<- sees caller-local methods. Padding,
missing names, pairlist tags, one-dimensional array dimnames, character bytes, and length errors
have independent native evidence. Recursive cases compare actual attributed outputs and errors.

Attribute lookup now distinguishes exact, unique partial, and ambiguous matches, preserves stored
name masks, and emits warnPartialMatchAttr warnings. Names lookup also exposes one-dimensional array
dimnames, including their missing-name masks. Time metadata conversion shares this lookup. The
recursive cases `time-class-list-conversion`, `time-list-shape-names-and-formals`, and
`partial-attribute-lookup-and-time-forcing` cover class restoration, dispatch visibility, metadata
forcing, attributes, and errors against GNU R 4.6.1. Full internal condition-call text and all
attribute-control coercions remain outside this increment's evidence.

`factor-list-conversion-and-dispatch` and `names-replacement-coercion-and-metadata` compare actual
objects, nested attributes, encoding bytes, dispatch traces, and errors. The case
`classed-list-visibility-and-environment-names` verifies visible results after invisible internal
methods, avoids dispatch on unclassed numeric values, and checks direct environment conversion
including hidden-name length errors and classed-environment rejection. Environment name ordering
continues to follow the owned environment model; exact native hash-bucket ordering is not claimed.

### Exiting warning and message handlers (profile 0.348)

`tryCatch` intercepts explicit warning and message signals, including custom condition classes and
warnings from partial attribute lookup. Handler expressions are forced before expr. The first
matching handler in argument order is selected; its callback runs with only later sibling handlers
still available. Result visibility is preserved. Finally runs after the callback, outside that
tryCatch's handlers, while outer handlers remain available. Pending exits retain handler eligibility
until inner finally and on.exit cleanup completes, so a new condition from cleanup can replace the
pending condition. Resource-limit and cancellation failures remain outside R-level capture and
cannot be replaced by a condition emitted during cleanup.

Simple message conditions include the newline controlled by appendLF. Supplied message conditions
retain their classes and message text. The independently authored recursive case
`exiting-condition-handlers-and-unwind` compares handler values, custom conditions, dispatch order,
cleanup traces, and visibility against GNU R 4.6.1.

Profile 0.351 replaces the earlier suppression flags with muffling frames on the same handler stack
(see "Condition muffling frames and package startup messages" below). Profile 0.353 adds local
calling handlers and restarts (see "Local calling handlers, restarts and warning levels" below).
Ignored-extra-argument diagnostics for supplied message conditions remain incomplete.

### Shared apply simplification (profile 0.349)

`sapply` and `simplify2array` share result simplification for scalar results, matrices, higher
arrays, and unsimplified lists. Only a non-missing scalar logical FALSE disables sapply
simplification. Other simplify values are compared with "array" only when array construction needs
the higher control, including global equality/group methods. USE.NAMES uses scalar logical
short-circuit behavior: a missing value can remain harmless for numeric inputs or already-named
results, but fails when automatic character names need it. Mapping precedes names and simplify
controls. Character names retain missingness, encoding marks, and bytes.

Simplification observes length and lengths, coerces except to integer and retains only exception
lengths zero/one, and flattens one list level through the shared unlist operation. Empty inputs and
unequal lengths leave controls lazy. A NULL flatten result leaves higher lazy; other flatten-length
mismatches return the original input after the applicable higher/dimension observations. Numeric
matching dimensions can produce higher arrays; otherwise results use width-by-count matrices.
Missing higher values fail only when compatible dimensions require a decision. Array construction
observes as.vector before extraction and names, with ordinary recycling after a custom conversion.

Global S3 methods participate in length, lengths, integer exception coercion, unlist, as.list,
dimension inspection, numeric and product gates, extraction, names, dimnames, and as.vector.
Caller-local method overrides do not change this base-function lookup. Shared lengths now dispatches
each classed list element's length method, retaining dimensions and optional names. Integer coercion
accepts scalar atomic list cells, produces missing integers for empty or nested vector cells, and
rejects non-vector cells.

Shallow unlist preserves atomic storage promotion, nested list/language/NULL cells, typed empty
results, and composed names. Inherited names retain encoding bytes; name composition uses UTF-8 and
rejects bytes-marked strings. All-factor inputs merge levels into a plain factor with native
attribute order. Scalar simplification preserves that factor; array simplification uses its labels.
Array names retain NA masks and named-axis labels. Custom dimnames containers append the outer axis
before padding, and non-character axes use storage coercion without as.character dispatch.

Direct unlist validates recursive before forcing x and use.names, including global length and is.na
methods on recursive. It forwards original control values and explicit default TRUE arguments to
global unlist methods, validates recursive before dispatch and use.names on the default path, and
returns visibly even when a method returns invisibly. Its public formals retain both control
defaults.

Independent recursive cases `apply-simplification-shapes`, `apply-simplification-controls`,
`apply-simplification-methods-and-gates`, `sapply-controls-dispatch-and-names`,
`unlist-shallow-values-types-and-names`, `unlist-name-encoding`,
`unlist-controls-global-dispatch-and-formals`, `simplification-dimension-gates-and-axis-packing`,
and `simplification-lengths-and-integer-coercion` compare actual values, attributes, errors, and
method traces against GNU R 4.6.1. Expression-vector names/attributes and expression-array storage
remain outside the current value representation. Broader recursive unlist mixed-language/name
behavior, malformed custom length results, attributes supplied by a custom dimension concatenation
method, class-preserving c.POSIXct for POSIXct-only dimension classes, and simplification in the
other apply helpers remain incomplete.

### Mapped and replicated results (profile 0.350)

`mapply` and `replicate` use the shared sapply/simplify2array result builder, including scalar,
matrix, higher-array, factor and list results. Their simplify controls retain the scalar logical
FALSE bypass and lazy comparison with "array". Empty and unequal results retain the same lazy
higher-dimension gates. Map forwards MoreArgs and USE.NAMES while fixing SIMPLIFY to FALSE.

Mapply resolves FUN before forcing dotted inputs and MoreArgs. Classed sequences observe global
length and extraction methods, and each callback receives eagerly extracted elements. Recycling
warnings occur after successful mapping and before names and simplification controls; a callback
error prevents that warning. Names are observed after mapping through global methods and the shared
name replacement rules. No-input and zero-length mapping return lists while retaining the required
control observations. NULL MoreArgs is accepted; pairlist MoreArgs is accepted without forwarding
its cells. Public formals expose the native defaults. Recycling conditions retain the original
mapply call or the observed Map wrapper call. Invalid function values report the rejected expression
through shared match.fun resolution; forwarded promises retain their caller expression. Diagnostic
deparsing checks work limits. Language-valued deparse uses the existing structural syntax renderer,
including function blocks inside calls and width-based continuations, so recorded condition calls
retain that layout.

Replicate coerces n using the observed vector-length rules and evaluates expr in a fresh owned
closure frame on each iteration, with one zero integer in dots. Ordinary assignments stay in that
frame; superassignment reaches the enclosing environment. Return exits one iteration and on.exit
cleanup runs for each frame, including errors. Missing expr is harmless for a zero count. Simplify
is forced after all successful iterations, including a zero-count run. Results are visible after
internal invisible callbacks. Invalid character counts signal a coercion warning before reporting
the invalid size, including exiting warning handlers. No generated JavaScript is involved. Character
counts include the observed hexadecimal floating syntax and case-insensitive Inf/NaN forms. Already
forced expressions preserve symbol and call values; ordinary expression promises still execute
syntax. Embedded display construction retains step and cancellation checks. Very long hexadecimal
significands and compensating extreme exponents remain a numeric-conversion boundary; these cases do
not establish full native text-to-number equivalence.

Independent recursive cases `mapply-values-forcing-and-methods`, `mapply-controls-and-names`, and
`replicate-counts-frames-and-simplification`, together with
`apply-function-rejection-and-warning-calls`, compare actual values, method/forcing traces, errors,
warnings and visibility against GNU R 4.6.1. The existing simplification boundaries for expression
metadata, custom dimension attributes, malformed method return values and class-preserving POSIXct
concatenation remain open. Full reflection of synthesized callback calls and frame stacks, formula
extraction, and simplification in the other apply helpers are not established by this increment.
Native mapply/Map can reuse a mutable loop-index object when a custom extraction method returns its
index directly; NativR currently supplies distinct index values. This identity-sensitive behavior
remains an explicit boundary.

### Condition muffling frames and package startup messages (profile 0.351)

`suppressWarnings`, `suppressMessages` and the new `suppressPackageStartupMessages` establish a
muffling frame on the same dynamically scoped stack as `tryCatch` exiting handlers, matching the
documented calling-handler behavior of those functions. Handlers established inside `expr` see a
condition first; a muffled condition never reaches outer handlers or session-global calling
handlers. The `classes` argument filters by condition class, so a custom warning class can be
suppressed while a plain warning escapes. The value keeps the visibility of `expr`.

Warnings recorded by builtins and operators, such as coercion, `NaNs produced` and recycling
warnings, are now signalled as `simpleWarning` conditions when the producing call or operator
returns. They reach `tryCatch(warning = )`, suppression frames and session calling handlers. A
consumed warning is removed from the deferred warning list; an unhandled one stays for top-level
reporting. `warning()` and `message()` record or print only when no frame muffled them.

`packageStartupMessage(..., domain, appendLF)` signals a message condition with the additional class
`packageStartupMessage` and its own call. `require()` signals `Loading required package: <name>`
with that class before attaching, unless the package is already on the search path or
`quietly = TRUE`. A handler that unwinds there leaves the package unattached. The missing-package
warning is now catchable.

Independently authored foundation cases `suppression-frames-yield-to-inner-handlers`,
`internal-warnings-reach-exiting-handlers`, `suppression-class-filters-and-visibility`,
`package-startup-message-conditions` and `startup-message-suppression-output`, plus the recursive
case `condition-muffling-frames-and-startup-messages`, compare values, classes, calls, output and
visibility against GNU R 4.6.1.

Known boundaries:

- Condition calls for builtin-recorded warnings are the producing call or operator, such as
  `log(-1)` or `1:3 + 1:2`. GNU R attributes some coercion warnings to the enclosing closure call
  (for example `h("z")` for `h <- function(v) as.integer(v)`).
- `require()` reports its own call for the startup message. GNU R reports an internal call.
- The most common builtin warnings now use GNU R 4.6.1's observed text: `NaNs produced`,
  `NAs introduced by coercion`, `NAs produced by integer overflow`,
  `longer object length is not a multiple of shorter object length`, and
  `out-of-range values treated as 0 in coercion to raw`. Other builtin warnings keep NativR's
  sentence style or context-free wording, for example the `matrix()` data-length warning, which in
  GNU R reports the data length and row count. That text is observable through `conditionMessage()`.
- A builtin that records a warning and then raises an R-level error delivers the warning when the
  error unwinds through the producing call, before outer handlers see the error. GNU R signals at
  the point of the warning, so side effects between the warning and the error inside that builtin
  are not interleaved with handler execution.
- Profile 0.353 adds `withCallingHandlers`, restarts such as `muffleWarning`, and `options(warn = )`
  escalation (see the next profile section below).

### Normal distribution algorithms, C formatting and character coercion (profile 0.352)

`qnorm` now uses Wichura's Algorithm AS 241 (Applied Statistics 37, 1988), and `pnorm` uses W. J.
Cody's rational Chebyshev approximations (Mathematics of Computation 23, 1969; SPECFUN ANORM, ACM
TOMS Algorithm 715). GNU R documents both algorithms; the published constants were the only
implementation input. The Inversion normal generator behind `rnorm` uses the same quantile, so a
seeded `rnorm` stream reproduces GNU R's. Logarithmic `qnorm` feeds the smaller tail's logarithm
straight into AS 241 instead of rounding it through a probability. `pnorm(log.p = TRUE)` evaluates
the requested tail directly.

On GNU R 4.6.1 for Windows, the sampled bit-identity is: `qnorm` 2997/3000 for uniform
probabilities, AS 241's tail branch 546/546 for log probabilities with 5 < sqrt(-log p) <= 27,
seeded `rnorm` 2993/3000, and `pnorm` 92-95% across tails and log scales. All residual differences
are at most about 2 units in the last place. They come from the host's `log`/`exp`: V8's `Math.log`
and `Math.exp` differ from the oracle's on 5.7% and 9.2% of sampled inputs, while `Math.sqrt`
matches exactly. ECMAScript leaves these functions implementation-approximated, so the residual is a
platform-libm tolerance, not an algorithm difference. `qnorm` for log probabilities with sqrt(-log
p) > 27 fails closed with NRU6153, because GNU R documents a separate treatment there that has not
been verified.

`sprintf` implements the C99 `%e`, `%E`, `%f`, `%F`, `%g` and `%G` conversions, including the `#`,
`+`, space, `-` and `0` flags, precision, and width. Digits come from the exact binary value,
rounded half to even (`"%.2f"` of 0.125 is `"0.12"`, `"%.0f"` of 2.5 is `"2"`). Exponents have at
least two digits, and `%f` prints every integer digit of large values. Non-finite and missing values
print as `Inf`, `-Inf`, `NaN` and `NA` and are never zero-padded. `%x`, `%X` and `%o` format the
32-bit two's-complement value. `%d` honors precision, and `%s` honors truncating precision.

Double-to-character coercion (`as.character`, `paste`, and `c()` with character values) uses at most
15 significant digits, as R documents. Trailing zeros are removed. Fixed notation is used unless the
scientific form is strictly narrower, and fixed notation keeps every exact digit of integers wider
than 15 digits (`2^62` gives `4611686018427387904`). Complex parts follow the same rule.

Independently authored foundation cases `normal-quantile-as241-central-exact` (exact),
`normal-quantile-as241-tails-and-log`, `normal-probability-cody-branches` and
`inversion-normal-generator-seeded` use a 1e-14 relative tolerance for the libm-dependent results.
`sprintf-c99-floating-conversions` and `double-character-coercion-significant-digits` are exact. All
compare against GNU R 4.6.1.

Known boundaries:

- In a 3,179-value sample, 5 character coercions differ from GNU R in the 15th significant digit at
  exact or near ties (for example, 392878021113574.5 gives `...574`; GNU R gives `...575`).
- `sprintf` `%a`, `*` widths, and `%n$` positional arguments are not implemented. Unknown directives
  still pass through unchanged instead of raising GNU R's format error.
- `dnorm` and `formatC` are not registered.
- `cos(1.5707963267948966)` is correctly rounded in NativR (`6.123233995736766e-17`). The Windows
  oracle reports `6.12303176911189e-17`. Such libm deviations need an explicit platform-tolerance
  policy.

### Local calling handlers, restarts and warning levels (profile 0.353)

`withCallingHandlers(expr, class = handler, ...)` pushes one calling frame per handler on the same
dynamically scoped stack as `tryCatch` exiting frames and suppression frames. A signalled condition
walks that stack from the innermost frame. The handlers of one call are offered the condition in
argument order. A matching calling handler runs in place, before any unwinding. While it runs, its
own frame and every frame above it are hidden, so a condition the handler signals reaches only the
outer frames. When the handler returns, the walk continues outward. If no frame muffles or exits,
the default action follows: `message()` prints, and a warning is handled by the warning level. The
value of `withCallingHandlers` keeps the visibility of `expr`. Unnamed handlers give GNU R's
`condition handlers must be specified with a condition class` error.

`warning()` establishes a `muffleWarning` restart and `message()` establishes a `muffleMessage`
restart while they signal. Warnings recorded by builtins and operators get the same restart when
they are delivered at the call boundary. `invokeRestart("muffleWarning")` from a handler ends the
signal, and `warning()` still returns its message invisibly. `stop()` and warnings converted to
errors are offered to the stack where they are raised. A calling error handler therefore runs before
`on.exit` cleanup and before outer `finally` expressions, and it can transfer control to a restart.
`try()` marks its position on the stack, so handlers outside a `try()` do not see errors it catches.
`signalCondition(cond)` offers any condition to calling and exiting handlers and returns `NULL`.

`withRestarts(expr, name = function(...) ..., ...)` establishes restarts. A specification can also
be `list(handler = , description = )`. `computeRestarts()` lists restart objects innermost first,
ending with the top-level `abort` restart. A restart object is a list of class `restart` with the
fields `name`, `exit`, `handler`, `description`, `test` and `interactive`. The `abort` restart is an
unnamed two-element list, as in GNU R. `invokeRestart(r, ...)` accepts a name or a restart object.
It unwinds to the establishing `withRestarts`, then calls the restart handler with the remaining
arguments; that call gives the value of `withRestarts`. Unknown names give
`no 'restart' '<name>' found`, and a saved object whose `withRestarts` has returned gives
`restart not on stack`. `tryInvokeRestart`, `findRestart`, `isRestart` and `print.restart` follow
from the same stack.

`options(warn = )` is applied after the handlers. A negative level drops the warning. Level 0 defers
it for top-level reporting. Level 1 writes `Warning in <call> : <message>` immediately to the
message stream, or `Warning: <message>` when the call is `NULL`. The message moves to an indented
second line when the call text and first message line together exceed 57 characters. Level 2 or more
raises a `simpleError` with the message `(converted from warning) <message>` and the warning's call.
That error is then signalled like `stop()`. A `tryCatch(warning = )`, a suppression frame or a
`muffleWarning` restart still handles the warning before conversion. The option accepts one logical
or numeric value and truncates it toward zero. Other values give `invalid value for 'warn'`.

`suppressWarnings`, `suppressMessages` and `suppressPackageStartupMessages` keep their muffling
frames. A muffling frame acts like a calling handler that invokes the muffle restart at its stack
position, and those frames already matched that behavior bit for bit.

Independently authored foundation cases `calling-handlers-run-inner-first-and-resume`,
`calling-handlers-follow-argument-order`, `calling-handler-sees-only-outer-frames`,
`calling-handlers-nest-with-trycatch-and-suppression`,
`calling-error-handler-runs-before-unwinding`, `unmuffled-calling-handlers-keep-default-actions`,
`calling-handlers-keep-expression-visibility`, `restarts-compute-invoke-and-transfer-values`,
`restart-lookup-failures-and-try-invoke`, `signal-condition-runs-calling-and-exiting-handlers`,
`warn-level-one-reports-immediately`, `warn-level-one-wraps-long-reports`,
`warn-level-two-converts-after-handlers` and `warn-level-option-coercion-and-silence` compare
values, output and visibility against GNU R 4.6.1. The recursive case
`calling-handlers-and-restarts` links `base::withCallingHandlers`, `base::invokeRestart`,
`base::computeRestarts` and `base::withRestarts`; it also checks that a restart unwinds through
`on.exit` before the restart handler runs. The `options(warn = 2)` conversion stays outside the
recursive case, because the v2 observer expects every warning its global handler sees to remain a
public deferred warning.

Known boundaries:

- Errors raised by builtins, not by `stop()` or warning conversion, reach calling error handlers as
  they unwind through each `withCallingHandlers` frame. `on.exit` cleanup inside the failing
  closures has then already run, and session-global error handlers still run at top level.
- `withCallingHandlers`, `withRestarts` and `tryCatch` are builtins, so they do not appear in
  `sys.calls()`. A `warning()` evaluated directly in their `expr` reports the enclosing closure
  call, or `NULL` at top level, where GNU R reports the `withCallingHandlers(...)` call.
- Invoking the `abort` restart is unsupported. `computeRestarts(cond)` ignores `cond`, and restart
  `test` functions are not consulted. `invokeRestartInteractively` and `restartDescription` are not
  provided.
- Printing a list of restarts uses ordinary list printing, not `print.restart` for each element.

### Correctly rounded elementary functions in sessions (profile 0.354)

Sessions that load the RFC-0007 module use it for `exp`, `expm1`, `log`, `log1p`, `log2`, `log10`,
`sin`, `cos`, `tan`, `asin`, `acos` and `atan`, for `^` with exponents other than 2, 3 and 4, and
inside the AS 241 and Cody normal-distribution algorithms behind `qnorm`, `pnorm` and `rnorm`. These
sessions compute identical bits in every browser engine. Regular finite, nonzero arguments use the
module; non-finite and zero arguments take the engine's exact IEEE 754 paths. Sessions without the
module use the engine's `Math` functions. Browser and Worker sessions load the module by default,
and the conformance and package-check runners load it explicitly.

Black-box evidence from GNU R 4.6.1:

- `log(x, 10)` and `log(x, 2)` equal `log10(x)` and `log2(x)`; other bases use `log(x)/log(base)`.
  NativR previously divided natural logarithms for every base.
- `1 ^ y` and `y ^ 0` are 1 for every operand, including `NA` and `NaN`, as `?Arithmetic` documents.
  `(-1)^Inf` is `NaN`. NativR previously returned `NaN` or `NA` for `1^NaN`, `1^Inf`, `1^NA` and
  `NA^0`.
- In sampled sweeps against the Windows oracle, correctly rounded sessions match `pnorm` on
  3000/3000 values and seeded `rnorm` on 3000/3000 draws. Host-math sessions match 2805 and 2993.

Independently authored foundation cases `power-one-and-zero-exponent-rules` and
`logarithm-base-function-selection` compare against GNU R 4.6.1, and `elementary-math.test.ts`
covers the backend routing.

Known boundaries:

- `x^3` and `x^4` keep repeated multiplication. Neither that nor `pow` matches every Windows oracle
  result, so the choice waits for the Linux oracle (RFC-0007 step 5).
- Complex elementary functions, Student-t internals, and other builtins that call `Math` directly
  still use the engine's functions. `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh` and `atan2`
  are not registered yet.
- The Windows oracle's own `atan`, `asinh` and similar results are not always correctly rounded.
  Where they differ, the RFC-0007 libm deviation rule applies, once it is implemented in step 5.

### Complex arithmetic on the session math and vignette package checks (profile 0.355)

The complex elementary functions (`exp`, `expm1`, `log`, `log1p`, `sin`, `cos`, `tan`, `asin`,
`acos`, `atan`) and complex `^` now use the session's elementary math, so correctly rounded sessions
compute them with the same module as their real counterparts. This closes the 0.354 boundary for
complex functions. The complex step derivative `Im(sin(1 + 1e-20i)) / 1e-20` now equals `cos(1)`
exactly, as it does in GNU R 4.6.1.

Complex division uses Smith's scaled algorithm. Against GNU R 4.6.1 it reproduced 2000 of 2000
sampled quotients bit for bit; the textbook formula reproduced 558. Divisors with a zero imaginary
part divide each component by the real part, and divisors with a zero real part divide by the
imaginary part. An infinite divisor with a finite numerator gives signed zeros, as C99 Annex G
specifies and GNU R shows.

Package checks implement the RFC-0008 vignettes and installed-documentation stages (policy
`vignettes-v1`). Rebuilding vignette outputs needs a host Sweave/LaTeX or Pandoc toolchain, so the
stage runs each vignette's evaluated R code on both runtimes instead; PDF compression analysis needs
host qpdf. Both adaptations are recorded in `compatibility/profiles.json`.

Independently authored foundation cases `complex-division-smith-and-special-divisors` and
`complex-step-derivative-exactness` compare against GNU R 4.6.1, and `vignette-check.test.ts` covers
the vignette rules.

numDeriv 2016.8-1.1 now matches native GNU R on `tests/grad01.R`, `tests/oneSided.R` and the `genD`,
`grad` and `hessian` examples. Each remaining deterministic difference traces to the Windows
oracle's libm, checked against an independent 90-digit decimal reference:

- `tests/trig01.R`: GNU R's `asin` is not correctly rounded at 8 of the 24 points the test
  evaluates; NativR is correctly rounded at all 24.
- `tests/hessian01.R`, `tests/jacobian01.R` and the `jacobian` example: GNU R's `sin` and `cos` near
  π and 2π are not correctly rounded at 14 of 150 sampled points (for example `sin(pi)` is
  1.2246063538223773e-16, against a correctly rounded 1.2246467991473532e-16); NativR is correctly
  rounded at all 150.

Known boundaries:

- The libm deviation rule still waits for the normative Linux oracle (RFC-0007 step 5), so these
  traced differences keep numDeriv below P7.
- `tests/BWeg.R` and `tests/CSD.R` are not repeatable on the native oracle. BWeg prints
  `Sys.info()`, and CSD prints `system.time()`; CSD also takes about 25 times longer in NativR.
- Dividing (1e308+1e308i) by (1e-308+1e-308i) gives `Inf+NaNi` in GNU R but `Inf+0i` in NativR.
