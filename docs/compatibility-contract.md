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
deterministically. Automatic frame row-name attributes use GNU R's integer storage, including
`integer(0)` for an empty frame. Default name checking uses the owned syntactic/unique repair and
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
column-major, and rejects numeric gaps. Rectangular data-frame replacement treats zero-row or
zero-column selections as no-ops, including empty atomic/list replacements, and extends numeric or
character-named rows, fills intervening cells with each column's missing representation, updates row
names, and can create a row and column together. Logical row overrun and every missing row subscript
retain GNU R's rejection behavior. As in GNU R, extending an extracted column through
`df$x[i] <- value` remains an incompatible column-length error rather than implicitly growing the
frame. Factor replacement maps labels back to existing levels, extends with missing codes, and warns
when an assigned label is not a level.

Atomic matrix arguments to `data.frame()` expand column-wise, preserve matrix row/column names, and
apply explicit argument-name prefixes. Package `data()` discovery recognizes the standard text,
R-source, and workspace suffixes plus their gzip-wrapped forms; decompression remains bounded and
browser-owned.

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
environments fail before returning a value. `utils::assignInMyNamespace(x, value)` and
`utils::assignInNamespace(x, value, ns, pos, envir)` replace an existing binding in Base or an
admitted package namespace, temporarily release and restore a per-binding lock, and return invisible
`NULL`; they never create a binding, infer a package from the global environment, or weaken the
environment lock. Complete namespace registration internals, `getNamespace*` inspection, and
lazy-load database bindings remain separate surfaces.

Random state is isolated per session and restored by reset. `RNGkind` queries and selects
session-local uniform, normal, and discrete-sampling kinds with prior-state return, mutation
invisibility, unique-prefix/default matching, and documented warnings. The independently implemented
Mersenne-Twister, Marsaglia-Multicarry, Wichmann-Hill, and L'Ecuyer-CMRG engines have fixed-seed
`set.seed`/`runif` differential sequence evidence. CMRG exposes GNU-shaped seven-integer state and
exact `parallel::nextRNGStream`/`nextRNGSubStream` jumps. Inversion and Box-Muller normal generation
plus Rounding and Rejection discrete sampling are selectable. `RNGversion` selects
Mersenne-Twister/Inversion/Rounding for version strings from R 1.7 through 3.5 and
Mersenne-Twister/Inversion/Rejection from R 3.6 onward. It returns the prior three-kind vector
invisibly and emits the ordinary Rounding warning, which makes zoo's measured
`suppressWarnings(RNGversion("3.5.0")); set.seed(1)` setup executable. Pre-0.99
Wichmann-Hill/Buggy-Kinderman-Ramage/Rounding and 0.99-through-1.6
Marsaglia-Multicarry/Buggy-Kinderman-Ramage/Rounding triples are selectable; fixed-seed uniform and
R 1.6 sampling sequences are proven. Buggy Kinderman-Ramage normal draws reproduce black-box
fixed-seed sequences across its triangular, near-zero, middle, and tail regions. Corrected
Kinderman-Ramage is independently selectable and has fixed-seed plus near-zero-correction evidence.
Super-Duper, Knuth-TAOCP, Knuth-TAOCP-2002, user-supplied uniform engines, user-supplied normal
engines, and Ahrens-Dieter remain unsupported rather than aliases. Generator transitions without a
subsequent `set.seed`, exhaustive tail-level normal identity, and all discrete-sampler sequences are
not yet claimed.

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

`nchar(x, type = "chars", allowNA = FALSE, keepNA = NA)` has differential evidence for exact and
partial type selection, Unicode scalar, exact-byte, and additive display-width counts,
type-dependent missing handling, first-element logical controls, atomic/list/pairlist/language/
expression coercion, structural attributes, factors, byte-marked strings, and invalid UTF-8. Width
follows the owned browser Unicode table, not host terminal probing; exhaustive locale and
Unicode-version identity is not claimed.

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
`boxplot`, `image`, `image.default`, `filled.contour`, `persp`, `lines`, `lines.default`, `points`,
`polygon`, `rasterImage`, `segments`, and `legend` provide the first browser-native graphics slice.
Evaluation owns page and linear or base-10-transformed coordinate-window state, converts
two-dimensional grayscale or character colors, three-/four-channel numeric/raw arrays, and packed
`nativeRaster` integers to row-major RGBA, and emits commands for recycled raster placements, styled
line segments, resolved point symbols and polygons, plot frames and boxplots, and resolved legend
entries. Commands preserve raster angle/interpolation, finite coordinates, canonical colors,
normalized line patterns, line widths, polygon fill rules, frame edges, text labels, point symbols,
placement, and layout controls. They cross the Worker boundary, remain available in
`evalDetailed.graphics`, and count toward the configured output budget. Inline and Worker callbacks
receive the same command shapes, and the Playground renders them to Canvas. Evidence covers the
measured systemfonts glyph-raster, httr PNG-array, posterior interval-segment, zoo filled-area, zoo
plot-frame, zoo grouped-boxplot, and zoo legend patterns. The owned registry also supports
`dev.cur`/`dev.list`, GNU R-shaped null device 1, simultaneous browser/PNG/PDF device identities,
selected `dev.off`/`graphics.off` closure, nested `dev.hold`/`dev.flush` levels, per-device `par()`
isolation and restoration, ordered cross-evaluation command buffering, and `dev.control` separation
of device output from the per-device recorded display list. Bounded same-session
`recordPlot`/`replayPlot` covers the owned
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
allocation is bounded. `grDevices::axisTicks(usr, log, axp, nint)` and private `.axisPars()` cover
linear and logarithmic transformed extents, derived or explicit axis parameters, reversed axes,
short-span linearization, logarithmic 1/2/5 subdivisions, wide-span thinning, and exact formals
without requiring a device. Complete `pretty` equivalence for every floating-point boundary,
`graphics::axTicks(log = TRUE)`, `par("xaxp"/"yaxp")`, and device-specific graphical parameters
beyond the documented session subset are not claimed.

`graphics::axis` has differential and browser-host evidence for all 18 measured calls across
labeling, zoo, and bit64. Sides 1:4 accept explicit sorted numeric locations or reuse the owned
linear window ticks; character, numeric, default, empty, and `labels = FALSE` modes preserve the
invisible GNU R-shaped return. Axis lines, recycled tick geometry, and resolved text labels reuse
the existing bounded segment/text journal, including secondary axes, `tcl`, `cex.axis`, colors, line
styles, font controls, pure-R package calls, Worker transport, Canvas/PNG rendering, and
display-list replay. Exact formals, empty input, non-finite drawing omission, label-length errors,
shared `xlab` controls that packages forward through `...`, invalid sides, and unknown-parameter
warnings have black-box differential evidence. `graphics::barplot()` honors `xaxt = "n"` and
`yaxt = "n"` on the corresponding category and numeric axes. Logarithmic/date axes, plotmath, outer
margins, exact label collision/gap layout, device font metrics, and pixel identity remain explicit
depth.

`graphics::box` has differential return/visibility evidence for zoo's measured `box()` redraw and
browser-host evidence for the resulting frame. `which = "plot"` accepts its documented unique
prefix, and `bty` resolves `o`, `l`, `7`, `c`, `u`, `]`, and `n` into explicit edges. A supplied
non-missing `col` takes precedence over `fg`, with black as the current owned-device default; named,
numeric, and hexadecimal line types are normalized, widths must be positive, and blank, transparent,
or no-frame styles emit no command. The command crosses inline/Worker APIs, is charged against
`maxOutputBytes`, renders on Canvas, and round-trips through the bounded display list. Figure, inner
and outer regions, graphical parameters beyond the documented `par()` subset, exact device dash
metrics, and cross-device pixel identity are not claimed. `graphics::par()` itself owns a
session-local 72-entry GNU R-shaped parameter inventory. It exposes the 66 mutable entries under
`no.readonly = TRUE`, warns when `cin`, `cra`, `csi`, `cxy`, `din`, or `page` are restored, and
supports scalar/vector queries, named updates, named-list restoration, invisible old values,
closure-like formals, validation, and unknown-parameter warnings without requiring an active device.
This is inventory and state evidence; the full rendering/layout effect of every entry is not
claimed.

`graphics::boxplot` has differential evidence for zoo's measured grouped-series call and adjacent
default shapes. Its S3 generic forwards classed inputs before the independently authored default
accepts numeric vectors, lists of numeric groups, or numeric matrix columns. Missing values are
omitted; Tukey hinges, whiskers, notch confidence limits, outliers, group indices, names, and sample
counts populate the standard six-field result, which is returned invisibly with `plot = TRUE` or
`FALSE`. Drawing supports vertical/horizontal orientation, notch and outline selection, fixed or
sample-scaled widths, explicit positions, additive drawing, recycled border/fill colors, and
resolved line types/widths. Positional formula/data grouping uses the shared model-frame path;
`axes` and `frame.plot` control category/value axes and the plot frame. Commands cross inline/Worker
APIs, Canvas pixels, output accounting, held journals, and same-session record/replay. Broader
formula-method controls, logarithmic axes, arbitrary `pars`, complete annotation/axis styling, exact
notch-overlap diagnostics, and device-identical layout remain unsupported.

`graphics::barplot` and `graphics::barplot.default` have differential evidence for the three
rank-343 calls measured in zoo and bit64. The S3 generic forwards classed inputs to package-owned
methods; the default accepts real vectors and two-dimensional matrices, reproduces visible
`plot = FALSE` midpoint vectors/matrices, and computes stacked or beside rectangles with recycled
width, spacing, offset, orientation, and stack ordering controls. Plotting reuses bounded
page/window, polygon, axis, box, text, and legend commands across inline, Worker, Canvas,
file-device, hold/flush, and record/replay paths. Names, annotations, panel hooks, additive drawing,
colors, borders, common line/axis controls, and clipped positive-density hatch lines share the
existing graphics state. Logarithmic axes, device-exact typography/margins and hatch phase, every
graphical parameter, and arbitrary specialized methods remain explicit compatibility depth rather
than silently approximated support.

`graphics::hist` and `graphics::hist.default` have differential evidence for all 19 measured calls
across testthat, openssl, shiny, and posterior. The generic dispatches package-owned S3 methods; the
default removes missing and non-finite numeric values, accepts vectors or matrices, and returns the
standard `breaks`, `counts`, `density`, `mids`, `xname`, and `equidist` fields with class
`histogram`. Sturges, Scott, Freedman-Diaconis, scalar-count, explicit-vector, and callable breaks;
right/left endpoint controls; unequal-bin densities; exact formals; visibility; and the connected
`grDevices::nclass.*` helpers have GNU R 4.6 evidence. Drawing recycles bar colors and styles,
supports labels and additive plots, and reuses bounded polygon/text/box events—including clipped
positive-density hatch lines—through Worker, Canvas, PNG, PDF, hold/flush, and record/replay paths.
Exhaustive `pretty()` floating-point boundaries, logarithmic axes, arbitrary graphical parameters,
device-exact hatch phase, and device-identical rendering remain unsupported.

`graphics::persp` has differential evidence for zoo's measured `persp(1:nO, 1:nC, zz)` call where
`zz` is a classed numeric matrix. S3 dispatch runs before the owned default, which accepts ascending
real x/y grids and a two-dimensional real z matrix, omits missing grid edges, validates explicit
limits, and returns the invisible `4 × 4` homogeneous view matrix. Separate and aspect-preserving
scale paths, `theta`, `phi`, `r`, `d`, `expand`, box control, axis-flag validation, namespace
access, output limits, Worker transport, Canvas rendering, and same-session display-list replay have
coverage. The browser drawing uses bounded projected wireframe/box segments for the default white
surface and depth-ordered polygon commands for explicit coloured facets. Facet colour assignment,
default/recycled borders, `border = NA`, missing-corner omission, Worker transport, and existing
Canvas/raster/vector device reuse have executable evidence. Lighting, axis arrows/ticks/labels,
exact hidden-surface intersections, hooks, arbitrary graphical `...`, and device-identical pixels
remain unsupported.

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
vectors, matrices, and numeric data frames are supported. Point, line, both, line-only-both,
overplotted, histogram-stem, lower-step, upper-step, and no-draw types cycle by series, as do
colors, symbols, fills, sizes, line types, and widths. Incomplete coordinate pairs are omitted and
interrupt line segments; x/y log scales are resolved to host-neutral coordinates before transport.
Each high-level call creates a bounded page and window, can emit a plot-frame box, and reuses the
existing segment/point Worker, Canvas, hold, and record/replay paths. Character axis labels are
accepted for the measured calls but complete axes/annotation rendering, class-specific
`plot`/`lines` methods, `add = TRUE`, `verbose = TRUE`, exact `b`/`c` point-clearance, arbitrary
graphical parameters, date/time axes, and device-identical layout are not claimed.

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
collection thresholds. The same census identifies registered environment targets absent from the
evaluator's R roots; their R closures run in reverse registration order and receive the target.
`onexit = TRUE` registrations additionally run before runtime reset/dispose. This is evaluator-owned
lifecycle behavior, not JavaScript weak-reference or host-GC integration. `base::gcinfo` preserves
its formals and previous-flag result, but automatic host collection messages, external-pointer
finalizers, exact GNU allocator counts, and forced host GC are not claimed.

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
solid fill. Positive density records physical lines-per-inch, counter-clockwise `angle`, resolved
`col`, and `lwd` in the shared protocol; Canvas, software PNG, and PDF render clipped hatch lines,
and record/replay preserves the hatch contract. Calls return invisible `NULL`; empty coordinates
emit no event. Coordinates, styles, command payloads, held journals, and display-list records are
bounded, and Worker transport, Canvas fill/border pixels, same-session record/replay,
malformed-record rejection, namespace access, and owned-device errors have coverage. Coordinate
classes beyond owned numeric storage, clipping/log axes, device-specific phase/subpixel metrics,
arbitrary graphical `...`, exact diagnostics, and cross-device pixel identity remain unsupported.

`graphics::rect` has differential evidence for sass and zoo's three measured calls. Its four
coordinate arguments accept coercible atomic or scalar-list values, choose the number of rectangles
from the longest coordinate vector, and recycle shorter coordinates without a warning; style-vector
lengths do not create additional rectangles. Missing/non-finite coordinate tuples are omitted,
all-empty coordinates return invisible `NULL`, and mixed empty/nonempty coordinates are rejected.
Fill/border colors, line types, and line widths recycle per rectangle; `border = NULL` uses the
current foreground, `border = NA` suppresses the stroke, `density = 0` suppresses the fill, and
negative, missing, or `NULL` density selects a solid fill. Positive density and recycled angles use
the same clipped physical hatch contract as `polygon`. Exact formals retain `par("lty")` and
`par("lwd")` defaults. Rectangles reuse the bounded polygon event, so inline/package/Worker calls,
Canvas/PNG/PDF rendering, held journals, and display-list record/replay share one implementation.
General coordinate classes, clipping/log axes, device-exact joins, hatch phase and dash metrics, and
arbitrary graphical parameters are not claimed.

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
symbols recycle across entries; missing, NaN, zero, and negative legend line types omit the affected
stroke. `bty`, `bg`, `cex`, `ncol`, `horiz`, `title`, numeric one-/two-value `adj`, and `plot` have
bounded shape coverage. The call returns an invisible list with named `rect` and `text` geometry,
and `plot = FALSE` computes that shape without emitting an event. Entry count is bounded by
`maxVectorLength`, event/display-list bytes by `maxOutputBytes`, and record/replay decoding
validates the owned command shape, including text adjustment. GNU R-exact font metrics and geometry
values, fill/density keys, merged-line controls, arbitrary graphical `...`, margins/clipping, log
axes, and device-identical rendering are not claimed.

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
coercion, and lazy `Xchk`. `png` reports `TRUE` because the runtime owns a real browser PNG device;
`sockets` additionally reflects the explicit host socket capability. Other values report `FALSE`:
the corresponding GNU R native graphics devices, Tcl/Tk, host filesystem, native profiling,
localization/iconv, Cairo, ICU, long-double, and libcurl facilities are not exposed through the
network-free browser runtime. These are platform non-applicability results, not emulation of the
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
bounds, cut extension, Gaussian and variance-standardized Epanechnikov kernels, their canonical
roughness constants, and the standard classed result fields. It evaluates admitted kernels directly
on the requested grid rather than reproducing GNU R's FFT coordinate path, so numeric evidence uses
declared tolerances. Other kernels and bandwidth selectors, infinite point masses, long-vector
performance, exact source-derived `call`/`data.name`, and the detailed `width`, `ext`, `old.coords`,
and `warnWbw` compatibility surface are not claimed.

`eigen` accepts finite logical, integer, and double square matrices and returns decreasing values,
normalized column eigenvectors, the documented names, and the `eigen` class unless `only.values` is
selected. The public real-symmetric path uses the embedded LAPACK 3.12.1 `DSYEVR` WebAssembly
backend and honors explicit symmetry by reading the lower triangle. The independent real-asymmetric
path covers orders one through three with analytic characteristic roots and real or
conjugate-complex null-space vectors, including jsonlite's measured random 3-by-3 result shape.
Complex input matrices, asymmetric order above three, every defective/repeated-root basis, complete
LAPACK diagnostics, and bit-for-bit results across every toolchain are not claimed. Exact signed
orientation is asserted only for the checked mtcars FPC/AOE contract; general evidence compares
values and eigenspaces with declared tolerances because valid eigenvector signs are algorithm- and
platform-dependent.

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
continuing through shared histogram, barplot, parameter-restoration, and axis behavior at P5.
Complex/raw/list inputs, unequal ordered-factor levels, S3/S4 method dispatch, locale-specific
character collation, and exhaustive class/recycling corner cases are not claimed.

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

`body` returns the public symbol, atomic, NULL, formula, or language value represented by a NativR
closure body, resolves a supplied character function name through the caller environment, and
returns NULL for registered primitive/special builtins. `body<-` replaces accepted bodies through
the normalized AST/constant-value boundary and can select an explicit enclosure. Missing-argument
self-inspection and bytecode/source-reference metadata are not claimed. `unlist` recursively
flattens owned atomic/list/pairlist values with GNU R type promotion, missingness, nested-name
construction, factor-level union, raw/complex support, `use.names`, and one-level
`recursive = FALSE` results. Arbitrary class dispatch, expression vectors, and recursive non-vector
objects remain outside this increment.

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
relative frame positions. `sys.calls()` and `sys.frames()` expose aligned pairlists of the recorded
R closure calls and their environments without leaking host JavaScript frames. Promise-evaluation
and method-dispatch frames, internal/native API frames, `sys.parents`, `sys.nframe`, and the
remaining `sys.*` call-stack API are not yet claimed. `t` transposes named vectors, factors, and
two-dimensional matrices in column-major order, swaps matrix dimension-name axes, and converts
atomic-column data frames to a common matrix shape. Arbitrary-dimensional arrays, custom methods,
and recursive/mixed data-frame columns remain outside this increment.

`formals` returns NULL or an owned pairlist for NativR closures and registered closure-like
builtins, preserving parameter names, missing-default symbols, literal defaults, and normalized
default-language values without exposing parser nodes. `formals<-` replaces closure parameters,
including call-rooted nested replacement such as `formals(f)[["x"]] <- value`, and can select an
explicit enclosure. `environment<-` replaces closure/formula enclosures or attaches `.Environment`
to supported attributed objects. Primitive/special builtins and character inputs return NULL from
the getter, while other non-functions warn. Bytecode and source-reference metadata remain outside
this increment. `replicate` reevaluates its captured expression lazily for each iteration, truncates
finite non-negative counts, returns lists when `simplify = FALSE`, performs ordinary atomic/matrix
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
runs BFGS, L-BFGS-B, Nelder-Mead, and conjugate-gradient objective paths and has differential
evidence for lazy forwarded arguments, named callback parameters, supplied and numerical gradients,
minimization and `fnscale`-based maximization, parameter and derivative scaling, bounded iteration
controls, named function/gradient counts, optional named Hessians, exact post-dots control matching,
the three standard CG update types, GNU R-shaped results, bounded L-BFGS-B callbacks, and `lmm`,
`factr`, and `pgtol` controls. SANN, Brent, trace output, remaining unevidenced method-specific
controls, more than 64 parameters, and exhaustive native-algorithm trajectory identity are not
claimed. `split` partitions atomic vectors, lists, pairlists, expressions, linearized matrices, and
data-frame rows by one or more atomic grouping vectors. Factor level order, optional empty levels,
`drop`, missing-group removal, element and row names, recycling warnings, interaction separators,
and lexical combination order have differential coverage. Custom split methods, arbitrary grouping
objects, locale collation, and every interaction/recycling corner case remain outside this
increment.

`sin` maps logical, integer, double, and complex vectors, returns the corresponding double or
complex shape, preserves attributes and NA/NaN distinctions, and emits one domain warning for
infinite real inputs that produce NaN. Complex values use the browser-native trigonometric and
hyperbolic identity with explicit infinite-magnitude zero handling. `cos` follows the same
real/complex, attribute, missingness, and warning contract with the corresponding cosine identity.
`tan` adds the locked base `pi` constant required by the measured package expressions, finite and
large-imaginary stable complex identities, signed limits for infinite imaginary inputs, and GNU
R-shaped domain warnings for infinite real inputs. `asin`, `acos`, and `atan` cover real and complex
vectors, attributes, missing values, factor rejection, and real-domain NaN warnings. Exact integer
complex powers use multiplication rather than polar reconstruction, preserving machine-epsilon
complex-step derivatives on the negative real axis. Math-group method dispatch, class-specific
methods, and exhaustive platform-libm/complex-branch-cut equivalence remain incomplete.

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
`rbind`, `cbind`, and `as.matrix` are supported. For non-matrix inputs, `as.matrix.default` rebuilds
the object as an `n × 1` matrix, promotes vector or one-dimensional-array names to row dimnames with
a null column axis, and removes unrelated attributes; existing two-dimensional objects are returned
unchanged. `rbind` additionally combines atomic-column data frames by unique column name, including
reordered columns and common factor levels, with fresh automatic row names. Mixed data-frame/atomic
inputs and recursive columns remain incomplete. `diag` constructs square or rectangular matrices
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

Binding exposes GNU R-shaped `(..., deparse.level = 1)` formals and composes row/column dimnames
from source matrix axes, vector names, explicit tags, simple symbols, and level-2 deparsed
expressions. Named comparisons plus `which`/`which.min`/`which.max` preserve selected names.
Callable closure-like builtins participate in the ordinary attribute and class model, including
`structure()` and subsequent invocation. These contracts are independently differential-tested.

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
checks. Builtin definitions with explicit ordinary R-level formals report `typeof = "closure"`; the
black-box surface inventory confirms that classification for all 92 registered names also found in
GNU R, while true primitives/specials remain unchanged. Atomic coercion covers `as.logical`,
`as.integer`, `as.double`/`as.numeric`, and `as.character`, with executable NA/NaN, complex, factor,
raw, warning, and integer-range cases. `as.logical()` additionally covers scalar list/pairlist
elements and their exact error/attribute-drop boundaries. General S3/S4 coercion dispatch beyond the
bounded registered paths, list coercion for other target modes, option-dependent numeric formatting,
and all locale-specific parsing remain outside this increment.

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
`as.call()` accepts a closure value as the call head and retains it as an owned runtime constant;
evaluation invokes that closure without generating JavaScript. `do.call(envir=)` supplies the
dynamic caller/evaluation environment and preserves already-forced argument syntax for special forms
such as `on.exit`. `local()` owns a function-like control scope, so `return` and ordered `on.exit`
cleanup apply to its fresh or supplied environment. Environment `$`/character-`[[` access, `get`,
`get0`, `mget`, `exists`, `assign`, `list2env`, `as.environment`, and `environmentName` cover
initial binding and conversion behavior, including inherited lookup and GNU R's eager evaluation of
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
parsing and source-reference preservation, `bquote`, inherited substitution lookup, alternate
`match.call(definition=, call=, envir=)` inputs, pairlist rectangular replacement and out-of-range
extension corner cases, generic pairlist attributes across the public snapshot, GNU R
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
Chained `*`, `:`, and `/` expressions expand recursively and retain GNU R's interaction-degree term
order. For `aov`, one formula-special `Error()` expression is evaluated through the same model-data
contract, decomposed into orthogonal intercept, named error-term, and Within subspaces, and returned
as an `aovlist`/`listof` with `error.qr`, call, terms, contrasts, factor levels, and per-stratum
`aov` models. `summary.aovlist` supplies the corresponding named ANOVA tables. Multiple separate
`Error()` calls, multistratum weights/offsets, and split/intercept summary controls remain explicit
boundaries. This is not a claim for the complete `terms`/`model.frame`/contrast family, multivariate
responses, every `na.action`, QR/LAPACK identity, the complete model summary/diagnostic family,
named ANOVA test or scale variants, or the full stats modeling ecosystem.

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
and column labels. For installed browser-owned packages it discovers `demo/*.R`, reads optional
`demo/00Index` titles, returns populated catalog rows, attaches the selected package, and evaluates
the decoded script in the global environment. Host R libraries, ambient filesystem discovery,
runtime downloads, and interactive pager/HTML fidelity remain outside the contract.

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
`R6Class` Rd example blocks additionally execute unchanged through `utils::example()`, preserving
their GNU R-observed returned visibility record and stdout sequence and advancing R6 2.6.1 to P5.
Finalization, arbitrary and multiple inheritance breadth, portable-locking variants, and complete R6
behavior remain unclaimed. `new_class` and `new_vctr` provide vctrs-compatible class construction
shapes, not the complete vctrs or S7 packages.

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

The Node-only `@nativr/package-tools` build path accepts standard source directories and `.tar.gz`
archives, or resolves required `Depends`/`Imports` from a CRAN-like `PACKAGES` index. It enforces
archive/file/byte/package limits, rejects links, native compilation, install hooks, `LinkingTo`,
`useDynLib`, invalid paths, and unsupported NAMESPACE directives, preserves package resources and
license metadata, and emits deterministic SHA-256 artifacts plus a dependency lock. The browser
runtime remains network-free. JVM sources and archives are admitted only as inert immutable package
resources and are never compiled, loaded, or executed. Standard `tools` is an admitted core
namespace dependency with an explicitly partial callable surface. Package `tools/**` files are
retained under a hidden immutable resource root and relative reads resolve there only while retained
package source is evaluated; `system.file()` cannot expose that implementation root. This models a
bounded read-only part of source installation, not a complete `R CMD INSTALL` snapshot.
Digest-pinned opt-in executable tests cover unchanged `pkgconfig 2.0.3`, `generics 0.1.4`,
`withr 3.0.3`, `R6 2.6.1`, `viridisLite 0.4.3`, `RColorBrewer 1.1-3`, `assertthat 0.2.1`,
`crayon 1.5.3`, `praise 1.0.0`, `prettyunits 1.2.0`, `evaluate 1.0.5`, `numDeriv 2016.8-1.1`,
`abind 1.4-8`, `rprojroot 2.1.1`, `rstudioapi 0.19.0`, `inline 0.3.21`, `rematch 2.0.0`, and
`whisker 0.4.1` sources. The third holdout rotation evaluated `evaluate` and `numDeriv` without
first using either package's R source to guide implementation; both now reach P4 through public
exports. The evidence covers evaluate's output-handler and condition predicates plus numDeriv's
public finite-difference gradient and Jacobian, with separate pinned source and NativR-artifact
digests. Together these tests prove the repository-to-namespace path, package-owned S3 dispatch, and
generated state-restoring wrappers through `with_options()`, plus R6 generator/object construction
and public reference mutation, private-state method access, an active read/write field, shallow/deep
cloning, and three-level inheritance with recursive `super` calls, plus package-owned 256-anchor Lab
spline palettes through generic arithmetic/array and `grDevices::colorRamp` semantics, plus exported
RColorBrewer palette metadata through explicit-row-name `data.frame()` construction and exact
palette/warning execution, without package patches.

Unchanged generics 0.1.4 reaches P5 by executing all three applicable Rd topics. Withr 3.0.3 stays
at P4 with a machine-readable P5 blocker, but its unchanged `defer` topic now completes through
reusable closure-headed call construction, target-frame `on.exit`, scoped `local`, call/frame
pairlists, and reachability-based `reg.finalizer`. Browser-owned, provenance-audited `mtcars` and
`iris` objects now load through the generic core-package resource seam, so unchanged `with_par` and
`with_tempfile` examples complete. Its first applicable remaining example requires the historical
pre-R-1.7 uniform and normal RNG engines; that boundary is not masked by a package-specific branch.

An explicit `includeTests` pack option preserves bounded source-package `tests/**` files under a
reserved immutable resource root and emits a versioned manifest of top-level R scripts plus optional
`.Rout.save` references. It defaults to false. P6 runners must opt in and source those scripts
through the normal runtime; retaining bytes is not execution evidence and is not a complete
`R CMD check`. Unchanged numDeriv reaches P6 by running all four Rd topics and seven package scripts
through this generic seam. Its intentionally expensive CSD test uses explicit finite resource
overrides while the default interactive profile remains unchanged.

One-dimensional `NULL` subscripts select zero elements and replacement through that selection is a
no-op across vectors, lists, matrices, and data frames; `[[NULL]]` remains an error. `diag<-`
replaces rectangular matrix or data-frame diagonals, preserves dimensions/dimnames and frame
metadata, promotes atomic storage when required, accepts scalar or exact-diagonal-length values, and
enforces GNU R's replacement-length errors. These semantics were closed through the unchanged
numDeriv example/test path rather than a package-specific adapter.

`Sys.info()` exposes GNU R's zero-formal, named eight-element character shape but deliberately uses
stable browser-safe NativR identities (`NativR`, `browser`, `wasm32`, and `nativr`) instead of
leaking host operating-system, node, or user information. Its values are shape-compatible platform
data, not a claim to reproduce an ambient GNU R host.

The fourth source-blind rotation evaluates `abind` and `rprojroot` only after collecting release
metadata, public documentation, public API expectations, and black-box GNU R results. Both first
reach P4: abind binds two matrices along a new dimension and removes a singleton dimension;
rprojroot constructs and combines S3 root criteria and resolves roots/files in the browser-owned
virtual filesystem. The reusable contract increment includes syntax and first-class specific/`Ops`
operator dispatch on either operand, incremental namespace S3 registration, `..N`, `missing(..N)`,
missing-endpoint `seq()`, `sign()`, `dimnames<-`, `methods::Quote`, trailing `as.data.frame()`
controls, and list/data-frame `is.na()` shape. A later depth increment advances unchanged abind to
P6 after closing the observed reusable language-object and matrix/data-frame coercion gaps;
arbitrary package execution is not claimed.

Unchanged abind 1.4-8 executes all five packaged Rd topics and all five top-level package test
scripts at P6. The reusable semantic closure includes call-entry `[`, `[[`, `[<-`, and `[[<-`;
expression-vector extraction; syntax-preserving replacement-call frames; unevaluated
`match.call(expand.dots = FALSE)` dots; pairlist apply-family inputs; Base `prod`, `LETTERS`,
`month.abb`, and `month.name`; matrix-to-data-frame and atomic-column data-frame-to-matrix coercion;
one-argument `array`; `dimnames(NULL)`; nested replacement from `NULL`; and short `names<-` padding.
Its large 10-dimensional `asub` test uses explicit finite limits. The test runner honors an
installed top-level `options(error=)` handler after an intentional error; it does not yet compare
`.Rout.save` bytes or claim complete `R CMD check` behavior. List-column matrix coercion, exhaustive
language-object coercion/warning boundaries, P7, and arbitrary-package compatibility remain open.

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

The same profile corrects two previously admitted oracle gaps: `Sys.which()` accepts symbol and
language values through ordinary character decomposition before its explicit allow-list lookup, and
`help()` forces and validates `verbose=` even when it finds the topic. These are reusable Base/utils
semantics, not host process discovery or desktop help integration.

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

Package admission is not universal execution compatibility. Package `data/*.R`, `.csv`, `.tab`,
`.txt`, and XDR/gzip `.rda`/`.RData` discovery/loading is supported through `utils::data`, including
explicit target environments and overwrite protection. The package tool normalizes bzip2-wrapped
`.rda`/`.RData`/`.rds` resources to size-checked raw serialization bytes at build time; no bzip2
decoder or package-installation authority enters the browser bundle. `R/sysdata.rda` initializes the
namespace before package source. Depends-style attachment, installed `.rdx`/`.rdb` lazy-load
databases, data indexes/aliases, broader NAMESPACE and S4 registration, bytecode, compiled code,
arbitrary connections, direct runtime bzip2 streams, xz/zstd, unsupported serialized types,
license-policy decisions, and R CMD check behavior remain outside this slice.

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

Language subset 0.298 adds differential and package-level evidence for the shared base-graphics
color/frame seam. GNU R named colors ignore ASCII spaces at any position but do not accept tabs or
hyphens; the runtime applies that rule at the common catalog lookup without relaxing hexadecimal
syntax. `plot.default(bty=)` selects the same partial/no-frame edge families as `box()` and
validates the control even when `frame.plot = FALSE`. Together these reusable semantics execute
unchanged RColorBrewer 1.1-3's sole installed Rd topic and advance that package to P5. This is not a
claim of pixel-equivalent graphics, every plot control, or universal package compatibility.

Language subset 0.299 adds behavioral evidence for
`read.dcf(file, fields = NULL, all = FALSE, keep.white = NULL)` over browser-owned files and
connections. Record boundaries, continuation lines, selected and missing fields, whitespace
retention, duplicate fields through `all = TRUE`, matrix/data-frame shapes, exact formals, and
malformed-record failures match GNU R observations. Unchanged cpp11 0.5.5's `cpp_vendor` topic
passes after this shared seam, while its compilation-oriented topics stop at explicit missing
dependency closures. This does not claim ambient filesystem access, arbitrary encodings, resolved
cpp11 dependencies, or native compilation.

Language subset 0.300 adds black-box behavioral evidence for primitive `is.finite()`, aligned owned
closure-stack depth through `sys.nframe()`, top-level environment discovery through `topenv()`, and
the locked `.GlobalEnv` binding that follows session reset. These reusable contracts execute every
frozen installed otel 0.2.0 Rd topic unchanged and advance it to P5. They do not expose browser host
stack frames, grant telemetry/network capabilities, claim native frames, or establish P6/P7.

Language subset 0.302 adds black-box behavioral evidence for `is.primitive()`, explicit-definition
and explicit-call `match.call()`, unique-partial `all.equal()` controls, package-defined condition
classes through `stop()`/`tryCatch()`, and browser-owned `file.access()`. Unchanged assertthat 0.2.1
and praise 1.0.0 execute every applicable installed Rd topic and advance to P5. Explicit call
matching remains limited to normalized function-call language objects; `file.access()` reports the
declared virtual mode and never consults host permissions. This evidence does not establish P6/P7,
ambient filesystem authority, or arbitrary-package compatibility.

Language subset 0.303 adds black-box behavioral evidence for closure-shaped `units()`/`units<-` S3
dispatch, difftime-unit replacement with elapsed-value rescaling, primitive `is.infinite()` across
atomic storage modes, the measured browser-owned `formatC()` surface, and left-to-right single
forcing of `rbind()`/`cbind()` arguments that share a lazy promise. Those shared contracts execute
all eight frozen installed prettyunits 1.2.0 Rd topics unchanged and advance it to P5. Complete
locale/multibyte/complex formatting, every width-preservation interaction, P6/P7, and
arbitrary-package compatibility remain unclaimed.

Language subset 0.304 adds black-box behavioral evidence for dynamic calling handlers, standard
muffle and named restarts, cooperative interrupt suspension/allowance, hook composition, recursive
mixed-value `unlist()`, `sequence.default()`, expression-vector loops/apply families, parse source
references and `removeSource()`, AsIs list/expression data-frame columns, and browser-owned recorded
plots. Those shared contracts execute all six frozen installed evaluate 1.0.5 Rd topics unchanged
and advance it to P5. An example process query is supplied only by an explicit generic
`systemCommand` adapter; default sessions retain no ambient executable authority. Exhaustive
condition/source-reference/graphics equivalence, P6/P7, and arbitrary-package compatibility remain
unclaimed.

Language subset 0.305 adds black-box behavioral evidence for the shape, storage modes, factor
metadata, selected values, aggregate values, and namespace identity of browser-owned
`datasets::InsectSprays` and `datasets::faithful`. Those provenance-audited resources traverse the
same static-package data path as other core datasets and close unchanged whisker and zeallot example
blockers. The exact installed example manifests for rprojroot 2.1.1, rstudioapi 0.19.0, rematch
2.0.0, whisker 0.4.1, zeallot 0.2.0, and ini 0.3.1 execute completely and advance all six to P5.
RStudio-dependent calls retain deterministic browser-unavailable behavior without an explicit host
integration. Full datasets-package coverage, IDE integration, P6/P7, and arbitrary-package
compatibility remain unclaimed.

## Language subset 0.314

The `compiler` base namespace is registered with
`compiler::compile(e, env = .GlobalEnv, options = NULL, srcref = NULL)`. In the browser-admissible
profile it validates the public arguments and returns the normalized expression as the executable
compiled representation. This is an exact semantic identity for evaluation, not a claim of GNU
bytecode representation, optimization, serialization, or introspection.

Language calls preserve pairlist entry tags independently from ordinary attributes. Consequently,
subsetting a call can leave a named callee entry, `names(call)` and `as.list(call)` agree with GNU
R, and apply-family iteration retains those tags. Base `%*%` covers logical, integer, double, and
complex vector/matrix products, missingness, conformability, dimensions, and outer dimnames. Each
contract has flat differential and recursive exact evidence. Full compiler bytecode behavior,
arbitrary native packages, P6/P7 corpus closure, and comprehensive GNU R compatibility remain
unclaimed.

Language subset 0.313 evaluates the untouched `iterators 1.0.14` archive through installation,
namespace loading, and attachment before source inspection. Its representative public path first
exposes legacy S3 method lookup from a package caller environment; exact installed examples then
require the immutable `R.home()/COPYING` browser resource and GNU R-shaped `levels()`/`nlevels()`.
All fixes are shared runtime contracts. The unchanged package matches GNU R on named iteration,
exhaustion, and chunking and executes all nine applicable installed Rd example topics at P5. This
does not claim complete S3 dispatch, host filesystem access, package tests, or arbitrary-package
compatibility.

Language subset 0.306 corrects function introspection at the normalized-AST boundary. `body()` now
returns a symbol for an identifier body, the matching atomic value for a literal body, `NULL` for a
NULL body, and a language object only for compound syntax; zero-argument `formals()` returns `NULL`
rather than an empty pairlist with synthetic names. Exact GNU R black-box evidence covers all of
those storage modes. Recursive Oracle v2 additionally traverses closure formals, bodies, captured
bindings, anonymous parent environments, nested attributes, environment cycles, and shared identity.
Seven exact graph cases are explicitly associated with 19 behavioral registry bindings; unknown or
non-behavioral associations fail generation. This is recursive evidence for those declared paths,
not a claim of complete reflection, environment, promise, or language semantics.

Language subset 0.307 adds GNU R-shaped function replacement at that same boundary. `body<-` and
`formals<-` are closure-shaped callables with `fun`, `envir = environment(fun)`, and `value`
formals; an explicit enclosure is retained on the returned closure. Body replacement preserves
atomic vectors, symbols, calls, lists, pairlists, formulas, and the first entry of expression
vectors without compiling generated JavaScript. Primitive `environment<-` replaces closure and
formula enclosures and attaches `.Environment` to supported ordinary attributed objects. Exact
recursive Oracle v2 evidence covers the resulting closures, attributes, shared enclosure identity,
and owned bindings. This does not claim every language-attribute mutation or complete reflection.

Language subset 0.308 adds the S3 `as.function()` entry point and its default list-to-closure
constructor. A list's final entry becomes a normalized body, preceding named entries become missing
or defaulted formals, and the explicit or caller enclosure is retained. Existing closures are
returned unchanged, classed inputs can dispatch to package methods, and invalid list/formal or
environment shapes fail before construction. This is reusable metaprogramming support, not evidence
that arbitrary generated functions or packages are fully compatible.

Language subset 0.309 adds a reusable `methods::setRefClass()` foundation: callable generators,
`$new`, inherited fields and methods, reference-semantics instance environments, `.self`, active
field accessors, initializer dispatch, and ordinary S4 `as.character` method selection. The same
profile adds `is.na<-`, leading PCRE `(?i)`/`(?m)`/`(?s)` mode flags, `regmatches<-`, GNU R's
zero-length `&&`/`||` state, NULL substring behavior, and list-aware matching/comparison seams. The
unchanged, source-blind `docopt 0.7.2` holdout now loads, attaches, executes its documented parser
path with GNU R-matching output, and runs its installed example without warnings. This proves one
digest-pinned P5 package path, not complete Reference Classes, PCRE, S4, or arbitrary-package
compatibility.

Language subset 0.310 follows the source-blind `getopt 1.21.1` blocker chain through reusable Base
semantics. `match()` now applies GNU R-shaped `nomatch` coercion, including missing, negative,
fractional, character, complex, and invalid-value boundaries. `Negate()` constructs a normal owned
closure over a resolved function and forwards `...`; `storage.mode()` and its replacement form use
shared atomic/list coercion while preserving ordinary attributes. Browser sessions expose
`commandArgs(trailingOnly = FALSE)` as the deterministic virtual invocation `"nativr"`, while
`trailingOnly = TRUE` remains empty and no ambient host command line is admitted. The unchanged
package installs, loads, attaches, executes a representative option parse with GNU R-matching
output, and runs all four applicable installed Rd examples without warnings, advancing it to P5.
This is evidence for the shared contracts and one frozen package, not complete command-line
emulation or arbitrary-package compatibility.

Language subset 0.311 follows the untouched `optparse 1.8.2` archive from its first generic
`exportClasses()` packaging blocker. Class declarations now expose `.__C__<Class>` metadata through
ordinary package namespaces; missing declarations fail at load. Exact `@`/`@<-` slot access,
registered `setValidity()`/`validObject()`, validity-on-`new()`, package-local replacement generics,
and element-aware `cat(fill=)` wrapping then close the unchanged runtime path. The package installs,
loads, attaches, produces GNU R-matching representative option and positional results, and executes
all four applicable installed Rd example topics at P5. This does not claim complete S4 slot typing,
method-table metadata, P6/P7, or arbitrary pure-R package compatibility.

Language subset 0.312 evaluates the untouched `argparser 0.7.3` archive through the standard
installer, namespace loader, and attachment path before source inspection; those phases succeed
without a blocker. Its first representative execution failure identifies GNU R's scalar
list/pairlist behavior in `as.logical()`. The next exact installed example exposes target-signature
dispatch for S4 methods registered on the `coerce` generic. Both seams are implemented generically,
with flat GNU R differential and recursive Oracle-v2 evidence. The unchanged package now matches GNU
R on positional, integer-option, and flag parsing and executes all three applicable installed Rd
example topics at P5. Complete S4 dispatch, testthat-based P6 evidence, P7, and arbitrary package
compatibility remain unclaimed.

## Language subset 0.315

DESCRIPTION relationships retain `Depends` separately from namespace-only `Imports`. Attaching a
package recursively attaches its `Depends` closure first, producing GNU R-shaped search-path order;
loading a namespace alone still does not attach those packages. The repository resolver treats only
explicitly bundled browser core namespaces as provided, so it neither downloads them from CRAN nor
silently claims unavailable core packages.

The browser `parallel` contract reports one deterministic execution lane.
`mclapply(..., mc.cores = 1L)` and `splitIndices()` have exact GNU R evidence. `makePSOCKcluster()`,
`makeCluster()`, `clusterCall()`, `clusterApply()`, and `clusterApplyLB()` expose an in-runtime
sequential adapter with GNU R-shaped public objects and results; `stopCluster()` is invisible. This
does not claim process isolation, multicore execution, sockets, remote hosts, scheduling fairness,
or performance parallelism.

## Language subset 0.316

NAMESPACE platform conditionals are selected only from a bounded, declarative expression subset over
`Sys.getenv("R_OSTYPE")` and `.Platform$OS.type`; arbitrary installation-time R evaluation remains
forbidden. The selected declarations, not host-dependent ambient state, enter the signed package
artifact. Unsupported conditions remain explicit packaging errors.

The runtime adds GNU-shaped `crossprod()`, vector-recycled `rnorm()` parameters, retained
`model.frame()` access for fitted linear models, text-progress state functions, and deterministic
single-lane `parLapply()`/LB behavior. These claims are bounded by executable cases. `pbapply 1.7-4`
is P4, not P5: its large example still requires call-component formula reconstruction.

## Profile 0.317 runtime-owned version and reflection contracts

The Base environment now owns locked, shared `R.version` and `version` lists for the pinned 4.6.1
browser profile; `sessionInfo()` reuses the same constructor. `names()` accepts environments,
`seq_along()` follows the general runtime length contract, and `unclass()` removes explicit classes
from attributed language, expression, closure, builtin, vector, and pairlist objects while retaining
other attributes. Environment unclassing remains an error.

Two-dimensional `[[<-` on an existing data-frame cell now preserves a list replacement as a nested
cell and promotes an atomic column to a list column when required. These general contracts carry
unchanged `globals 0.19.1` to P4. Its conservative-analysis example remains explicitly blocked on a
list-valued subscript seam and is not counted as P5.

## Profile 0.318 classed-environment primitive-generic contract

Primitive extraction and replacement perform registered S3 dispatch for explicitly classed values
before applying ordinary environment or vector rules. The same ordering applies to `length`,
`length<-`, `names`, `names<-`, `dim`, `dim<-`, `dimnames`, `dimnames<-`, and `t`. A method result
is assigned back through replacement syntax while the assignment expression retains the right-hand
side as its value.

Browser execution treats translation as a deterministic identity service: `gettext()` concatenates
its character inputs, `gettextf()` uses the runtime's `sprintf()` formatting, and `.makeMessage()`
builds condition text with an optional line feed. `is.element()` shares atomic matching semantics.
These contracts carry unchanged `listenv 1.0.0` through all installed examples at P5.

## Profile 0.319 package-construction and namespace contract

Replacement syntax may resolve its replacement function through `::` or `:::` and may access an
in-progress package's own namespace without treating that self-reference as a dependency cycle.
`substitute()` rewrites assignment targets and can embed closures as exact runtime constants, so
generated package code retains its lexical environment.

The browser-owned Base/Utils surface now includes `getAnywhere()`, `getS3method()`, `file_test()`,
`sys.source()`, `sys.frame()`, `sys.parents()`, `getNamespace()`, and `packageStartupMessage()` with
executable semantics. `library()` exposes its target default formals, and the Base S3 registry
constants are available to generic introspection. These contracts carry unchanged
`R.methodsS3 1.8.2` through all installed examples at P5.

## Profile 0.320 R.oo evidence contract

The R.oo checkpoint is P5 only because the exact frozen artifact installs, loads, attaches, and all
90 applicable installed Rd example topics execute unchanged. Its documented cache example may use an
explicit finite 100,000,000-step evidence limit; that exception does not alter standard runtime
profiles. The evidence is tied to source and artifact digests in the corpus ledger.

The underlying accepted changes are package-agnostic semantic primitives: safe NAMESPACE conditions,
post-load export discovery, namespace and caller-frame behavior, S3 dispatch and `NextMethod`, NULL
binary Ops, person metadata, string coercion, attribute matching, delayed bindings, and XDR object
serialization. This checkpoint does not satisfy the project completion gate, P6/P7, or the arbitrary
pure-R package claim.

## Profile 0.321 R.utils evidence contract

R.utils is P5 only for the exact source and artifact digests recorded in the package corpus. The
unchanged dependency closure must install, load, attach, execute representative exported behavior,
and run every frozen installed-example topic. Two browser-inapplicable paths remain explicit:
launching another R executable requires a host command capability, and the documented `touchFile`
example's optional native `digest` dependency is outside the pure-R closure. The latter also has an
independent unchanged functional path using browser-owned MD5 evidence.

Accepted runtime work is package-agnostic: parser escape decoding, source references, condition
transfer and cooperative time limits, virtual compressed/binary I/O, MD5 over owned bytes, atomic
dimension-name coercion, search-path/environment semantics, and browser graphics layout. Browser
time limits are cooperative; CPU time uses checkpoint wall time. Graphics evidence compares semantic
device state and operations, never platform pixel identity. This profile does not claim P6/P7,
complete Base R, arbitrary pure-R packages, host process execution, or native package ABI
completion.

Profile 0.504 adds exact black-box evidence for `methods::functionBody`: explicit closure bodies,
primitive `NULL`, caller-default selection, public formals, and closure binding type. The unchanged
logging 0.10-111 artifact passes its complete generic package plan and an independent handler
scenario. The 128-release ledger contains 113 passing, 15 blocked, none unevaluated, and 74 scoped
P7 entries; this remains pinned behavioral evidence, not arbitrary-package completion.

## Profile 0.503 nlminb and unchanged alabama evidence

The browser-admissible stats contract includes GNU-shaped `nlminb` argument/result structure backed
by the reusable L-BFGS-B module. Exact PORT iteration histories and messages are outside the current
claim. Shared `optim` control admission and non-finite intermediate trial behavior are covered by
flat and recursive GNU R evidence. The unchanged `alabama 2025.1.0` artifact passes its complete
generic check plan and an independent constrained-optimization scenario without source rewriting or
a package-specific runtime branch.

## Profile 0.322 zero-blocker holdout contract

`here 1.0.2` advances to P5 only for the source and artifact digests in the corpus ledger. Its
source-blind checkpoint predates source evaluation, and the exact unchanged package must install,
load, attach, execute its representative public path, and complete the three-topic installed-example
manifest with the generic runtime. No new callable or package-identity branch is accepted as part of
this rotation.

A zero-blocker holdout validates reuse of the existing substrate but cannot establish arbitrary
pure-R package compatibility. The replacement P0 holdout is `R.matlab 3.7.0`; its official metadata,
dependency closure, usage window, archive size, and source digest were frozen before the archive was
listed, opened, or run. Its first installation, namespace, attachment, or execution failure must be
recorded before source inspection and must drive only reusable semantic work. `R.cache` is excluded
from this pure-R rotation because mandatory native `digest` belongs to the later native-package
contract. All Phase 1/2 completion criteria and the P6/P7 gates remain unchanged.

## Profile 0.323 R.matlab evidence contract

`R.matlab 3.7.0` is P5 only for source SHA-256
`d713522268a1206555610938350137ea022e07e27fa9cdd73c02fae8d1a43dda` and artifact SHA-256
`523e1ab1d7a43fafdf4a4779e7562d105e24bf06cc876247a38007c963377dff`. The unchanged dependency closure
must install, load, attach, complete the exact four-topic installed-example manifest, and round-trip
scalar, vector, and matrix values through MAT v5 `writeMat()`/`readMat()` behavior.

The source-blind checkpoint exposed auxiliary Java source as the first blocker. Java and JAR files
may now survive packaging only as inert immutable resources: no classpath, JVM handle, compilation,
loading, or execution authority is granted. Imported-binding re-exports, `.onLoad`-created exports,
`R.Version()` shape, and `str` S3 dispatch are reusable runtime semantics, not package-name
branches. External MATLAB connections, JVM-backed behavior, P6/P7, complete Base R, arbitrary pure-R
package compatibility, and a native-package ABI remain unclaimed.

The replacement P0 holdout is dependency-free `combinat 0.0-8`, source SHA-256
`1513cf6b6ed74865bfdd9f8ca58feae12b62f38965d1a32c6130bef810ca30c1`. P0 asserts metadata and source
identity only. No install, namespace, attach, execution, example, or behavior claim exists until the
first source-blind attempt is recorded and reusable blockers are resolved.

## Profile 0.324 combinat evidence contract

`combinat 0.0-8` is P5 only for source SHA-256
`1513cf6b6ed74865bfdd9f8ca58feae12b62f38965d1a32c6130bef810ca30c1` and artifact SHA-256
`5d9c23c0589105289ae4e8b374e11e3873ba7f12475bbbfada6db7cb05406a97`. Executable evidence covers
install, namespace load, attach, and exactly `combn`, `dmnom`, `nsimplex`, `permn`, `rmultinomial`,
and `xsimplex`. The generic capability increment is real-vector `gamma()`/`lgamma()`, `tabulate()`,
and Rd comment recognition. It does not assert P6/P7, complete Base R, or arbitrary package support.

The replacement P0 holdout is `matrixcalc 1.0-6`, source SHA-256
`0bc7d2f11f62d8b1969474defe27c924a243ccba0c856d585f317f6caa07f326`. P0 asserts source identity and
metadata only; it makes no execution claim.

## Profile 0.325 matrixcalc evidence contract

`matrixcalc 1.0-6` is P5 only for source SHA-256
`0bc7d2f11f62d8b1969474defe27c924a243ccba0c856d585f317f6caa07f326` and artifact SHA-256
`d64cb82cebe99ded95ffe6c849ec665fc77a3f0438f76400872b56c050a3011e`. Executable evidence covers
install, namespace load, attach, and the exact 60 installed Rd topics asserted in the external
regression. C-locale POSIX classes and the exercised real-matrix operations are generic capability
increments; they do not assert complete Base R, arbitrary packages, exact GNU Householder storage,
complex/LAPACK coverage, or P6/P7.

The replacement P0 holdout is `Formula 1.2-6`, source SHA-256
`7e611ac371c045e100a6205d92fe5104001942673798f970290fea12e33bfd37`. P0 asserts only metadata, source
identity, archive size, and dependency admissibility. It makes no installation, namespace,
attachment, execution, example, or formula-semantics claim.

## Profile 0.326 Formula evidence contract

`Formula 1.2-6` is P5 only for source SHA-256
`7e611ac371c045e100a6205d92fe5104001942673798f970290fea12e33bfd37` and artifact SHA-256
`c2c65ec4d007ebd4c304e43a0e2c402ca047e0ae38d8667bbf79aaa918007b0b`. Executable evidence covers
unchanged installation, namespace loading, attachment, version discovery, and the exact `Formula`
and `model.frame.Formula` installed topics. Formula objects preserve owned syntax plus ordinary
attributes and S3 classes; runtime-created constant nodes participate in term/intercept analysis;
`terms` constructs variables/factors/labels/order/intercept/response/offset metadata and expands dot
terms from provided data; model frames reuse precomputed expression columns; language/formula `==`
and `!=`, response extraction/deletion, and additive model offsets follow the checked GNU R graphs.
No package identity may select these semantics. P6/P7, arbitrary Formula inputs beyond the evidence,
complete stats modeling, and arbitrary pure-R packages remain outside this claim.

## Profile 0.327 DBI evidence contract

Unchanged `DBI 1.3.0`, source SHA-256
`13def8e90cbe41205a0dfcf585a6a7ea79ce10d45969789e82613c7ce3d5fb18` and artifact SHA-256
`d55fa587203e850bd7a7403a96aaa559bf9686c060816290904d1f4d7b9b6997`, reaches P5. The contract covers
generic install/load/attach, the frozen representative ANSI/Id/SQL calls, and every runnable block
in the exact 58-topic installed Rd manifest. It covers only the exercised browser-admissible
methods, S3/S4, Date/class, namespace, and row-name graphs. It asserts no concrete DBMS backend,
connectivity, P6 tests, P7 check behavior, or arbitrary-package closure.

## Profile 0.330 xtable evidence contract

Unchanged `xtable 1.8-8`, source SHA-256
`b999c031b91255fb92134b0e70e5f84c5609e9312c0518393b9d0a4aaf6b2510` and artifact SHA-256
`bd7c22a70c628bd2a3655583b983884e962c4deebc4858db892361ed537e806b`, reaches P5. The contract covers
generic install/load/attach and every runnable block in the exact eight-topic installed Rd manifest.
The reusable increment includes the exercised dataset, data-frame, model, family/IRLS GLM, PCA,
flat-table, and argument-matching paths, without an xtable identity branch.

The GLM contract is limited to the exercised gaussian, binomial, and Poisson family links and
single-model summaries/ANOVA; quasi, Gamma, inverse-Gaussian, matrix-response binomial, custom
families, and multi-model ANOVA remain outside it. `prcomp` covers exercised numeric
matrix/data-frame inputs, not its formula/custom-method universe. `ftable`/`format.ftable` cover
default atomic, data-frame, and dimensional-table paths, not arbitrary custom permutations.
`summary.lm` does not yet claim correlation or symbolic-correlation output. P6/P7, arbitrary-package
closure, complete Base R, and native-package compatibility remain unclaimed.

## Profile 0.331 namespace ownership and language-reflection contract

Every builtin has one effective owning namespace. Base-only lookup must not find Stats, Utils,
Methods, Graphics, grDevices, or compatibility-shim bindings; qualified lookup and the default
attached search path must still resolve registered exports. Non-exported core S3 methods remain
discoverable only through dispatch/registry semantics. `.BaseNamespaceEnv` is a locked Base binding
whose value is the Base namespace environment, and reset must reconstruct core S3 registrations
without retaining user-package registrations.

Omitted `substitute()` performs no replacement when its captured expression environment is the
session global environment, but explicit list/local environments retain recursive promise and
binding substitution. `{`, `<-`, and `[` are first-class special values with observed type and
direct invocation behavior. When `NextMethod()` exhausts later S3 classes for a primitive generic,
it invokes the primitive default rather than reporting no applicable method. Flat and recursive GNU
R black-box cases plus unchanged globals/codetools examples gate these claims; they do not imply
complete namespace contents, arbitrary package closure, or P6/P7 completion.

## Profile 0.332 apply/data/reflection contract additions

Caller-frame evaluation must force the supplied `eval.parent()` expression before evaluating its
language value in the selected parent frame. Apply-family helpers, trace state, nested replacement,
factor-level replacement, list-table expansion, numeric summaries, and array construction follow
their checked GNU R value, storage-type, attribute, warning, and visibility observations. Array and
matrix construction strip unrelated source attributes and coerce factors to their character values.
`sum()` selects integer, double, or complex result storage from the supplied data and promotes
integer overflow rather than wrapping.

Static core datasets are immutable, network-free resources with recorded independent provenance and
digests. `warpbreaks` and `presidents` are gated by shape, type, level/time-series, value,
missingness, and strict-identity cases. These contracts are exercised recursively and by all
unchanged pbapply installed examples; they do not generalize the current evidence to all Base
behavior or packages.

## Browser-admissible package-check contract

A P7 claim requires a deterministic plan derived from the artifact rather than a package-specific
test loop. Every applicable installed-metadata, namespace, attachment, documentation, example,
top-level test, saved-output, and prebuilt-vignette item runs in an isolated reset session. A source
vignette without installed output remains blocked until a browser build path exists; a missing
`.Rout.save` resource is blocked; and a normalized reference-output difference is a failure even
when the underlying script completes. The result preserves the first failed or blocked item.

Packages with no examples, tests, saved outputs, or vignettes record those facets as not applicable;
they do not silently skip present inputs. This contract advances numDeriv and abind to P7 without
recognizing either package identity in production code.

## Profile 0.333 presentation and batch-check contract additions

Parentheses are retained in the normalized AST as a controlled `(` call because they make an
otherwise invisible assignment result visible. S3 dispatch frames expose the selected method call;
replacement frames use the GNU-compatible temporary target and evaluated value representation.
Printing honors table spacing, vector index-label width, one-dimensional names, multidimensional
slices, matrix dimnames and named axes. Package saved-output execution captures errors before stack
unwinding, emits the condition call and compact call chain, applies the configured error handler,
and normalizes prompts and trailing whitespace before comparison. Flat and recursive GNU R evidence
and the unchanged abind P7 run gate these requirements.

## Profile 0.334 regex-object and optional-Suggests check contract

An unmatched optional capture in a `regexec()` result is not a whole-pattern miss. Its location and
length are `0/0`, it retains its capture position, and `regmatches()` extracts `""`; only `-1/-1`
denotes no match. ASCII match objects also retain GNU R's `useBytes`, `index.type`, and attribute
ordering contract, while multibyte inputs do not claim byte-index metadata.

A package-check warning is non-failing only when it is the runtime's specific unavailable-package
warning and the missing name is declared by that same artifact in `Suggests`. This models examples
that explicitly guard optional dependencies without suppressing undeclared missing dependencies or
ordinary warnings. It does not make the optional dependency installed, and a retained package test
that requires it remains an explicit blocker.

## Profile 0.335 S4 redispatch and timeDate P4 contract

`callGeneric(...)` is valid only during S4 method dispatch. Explicit arguments redispatch the
current generic; an empty argument list reconstructs values from the active method frame, including
locally replaced formal values and ellipsis arguments. `setGeneric(name)` preserves a callable
binding as its default, `setReplaceMethod()` registers the replacement generic, and `getDataPart()`
participates in the same signature dispatch. GNU XDR `S4SXP` values decode to and re-encode from the
owned S4 slot representation.

The unchanged `timeDate 4052.112` package provides the package-level evidence: metadata, namespace,
attachment, one declared public representative path, and its retained test script pass. P4 remains
the maximum claim because complete examples and package-check behavior do not pass. Explicit
`axis.POSIXct(at=)` behavior is covered; calendar-aware default POSIX tick selection and exhaustive
`pretty()` floating-point boundaries remain outside this profile.

## Profile 0.336 S4 primitive dispatch and package-check contract

Installed export documentation recognizes GNU R's conventional S4 Rd aliases: `Class-class`
documents the synthetic `.__C__Class` export, and `generic,signature-method` documents an exported
method generic. Exact aliases remain required for ordinary exports.

Primitive operators dispatch registered S4 methods before S3 or reference-operator fallback;
`callGeneric()` from an `Ops` group method redispatches the concrete operator. S4 `[` extraction
likewise dispatches its registered signature and retains the primitive subset fallback. The
`as.double`/`as.numeric`, `sort`, and `diff` entry points forward classed inputs and ellipsis to S3
methods before applying their defaults. The unchanged `timeDate 4052.112` package passes export
documentation and installed examples through `c`, `diff`, and `difftimeDate`; the ordered blocker is
now missing Base R `round.POSIXt`, so the package remains P4.

## Profile 0.337 date-time rounding and S4 prototype contract

UTC/GMT `round.POSIXt` and `trunc.POSIXt` are behavioral only where executable cases cover their six
units, POSIXct/POSIXlt conversion, returned POSIXlt class, names, time zone, formals, and
calendar-boundary selection. Other civil time zones remain explicitly unsupported.

Internal subset consumers retain an S4 object's marker, not merely its class attribute. Constructors
complete omitted slots from inherited/local prototypes and declared atomic slot types before
applying explicit values. `range` dispatches S3 before numeric reduction, and method-specific
arguments survive `round` dispatch. The unchanged timeDate artifact passes the former round, start,
and summary-methods blockers; `example:align` is the ordered P4 blocker, so no P5 claim is made.

## Profile 0.338 generic forwarding and calendar replacement contract

Method dispatch precedes owned default behavior for `seq`, `is.na`, `unique`, and `duplicated`.
Registered S4 signatures are populated only from matching formals; arbitrary named dots cannot alter
the dispatch argument position. Forwarding a promise backed by a formal default makes the receiving
argument present, but forwarding a genuinely absent argument preserves missingness.

The covered UTC/GMT POSIXlt contract includes `strptime` component lists, `format.POSIXlt`, POSIXct
conversion with retained timezone, and observation/component `[<-` replacement. `julian.POSIXt`
carries names, `difftime` class, day units, and the scalar POSIXct origin. The unchanged timeDate
artifact now passes the former `align`, `isBizday`, and `nDay` example blockers; `example:periods`
is the ordered P4 blocker, so P5 is still not claimed.

## Profile 0.339 dispatch, calendar-data, and ellipsis contract

`length` performs registered S4 dispatch before S3 dispatch and owned default behavior. `lengths`
applies the same element-length semantics to recursive inputs. POSIXlt formatting recycles each
component by that component's own length, and all-missing logical or empty logical input may be
converted to POSIXlt while nonmissing logical input remains rejected. `is.na.POSIXlt` derives
observation missingness from the six required calendar components. The owned Base namespace also
exposes the GNU R 4.6.1-targeted `.leap.seconds` value, class, and timezone contract. `...length()`
and `...elt(n)` observe the active ellipsis without eagerly forcing unrelated arguments.

Executable evidence consists of 1084/1084 flat cases and 36/36 recursive graphs against the local
GNU R 4.6.0 advisor. The unchanged `timeDate 4052.112` regression crosses `example:periods`; its
first ordered P4 blocker is now `example:timeDate-class` at missing `base::asplit`. That progression
does not raise the package to P5 or imply comprehensive compatibility.

## Profile 0.340 array transformation, graphics dispatch, and language names

`asplit(x, MARGIN, drop)` accepts dimension names, ordered or negative margins, zero extents, and
atomic or list storage while retaining the remaining dimensions unless `drop = TRUE`. `apply`
preserves the common atomic type of all-zero-length slice results and returns `NULL` only when every
slice result is `NULL`. Registered S4 methods for `plot`, `points`, and `lines` precede S3/default
dispatch, with absent `y` represented as a missing signature. Measured `xaxt` and `yaxt` values are
validated by the browser plot path. `all.names` walks the normalized AST with `functions`,
`max.names`, and `unique` controls; `names` returns `NULL` on non-vector functions and symbols.

Evidence consists of 1088/1088 flat cases and 39/39 recursive advisor graphs. The unchanged
`timeDate 4052.112` package advances through three former example blockers; its first ordered P4
failure is now `example:in_int` at the exercised non-S4 `@` path. This remains an explicit gap, not
a compatibility claim.

## Profile 0.341 initialization, next-method, sequence, and missing-replacement contract

S4 construction invokes `initialize(.Object, ...)`; the owned default accepts named slot values or
an unnamed compatible S4 template. `callNextMethod()` uses the active generic arguments and the next
less-specific registered signature before the generic fallback. `names` and `names<-` consult
registered S4 methods before S3/default behavior. These are executable covered seams, not a claim
for every methods-package metaobject operation.

`seq.int` accepts covered `from + by + length`, `to + by + length`, and implicit-start `by + length`
controls while continuing to reject simultaneous explicit `from`, `to`, `by`, and length. Default
`is.na<-` follows GNU R's `x[value] <- NA` contract, so numeric and logical subscripts share the
normal replacement engine and preserve covered structural attributes. The current evidence totals
1090/1090 flat cases and 42/42 recursive advisor graphs. The unchanged timeDate first blocker is
`example:timeCeiling`; P5 is not claimed.

## Profile 0.342 POSIXlt extraction and C-locale month contract

`[.POSIXlt(x, i, j, drop)` treats `i` as an observation subscript and an optional scalar character
`j` as a component selector. A known-balanced object is subset component by component; an object
whose `balanced` state was invalidated by `$<-.POSIXlt` is normalized through the owned UTC/GMT
POSIX conversion path before selection. Names, timezone, eleven component vectors, empty/missing
selections, and component recycling through normalization are covered. Civil time zones remain
outside the behavioral contract.

Within the browser C-locale profile, `strptime` accepts `%b`, `%B`, and `%h` using the twelve
English month names and their three-letter abbreviations without case sensitivity. This does not
upgrade the whole callable beyond its documented numeric/partial compatibility boundary. Evidence
totals 1092/1092 flat cases and 43/43 recursive advisor graphs. The unchanged timeDate package now
has P7 evidence; that package result does not imply arbitrary-package compatibility.

## Profile 0.343 external LazyData and dense factor-contrast contract

For an installed source package declaring `LazyData: yes`, each directly named `data/` resource
creates a memoized promise in a separate package-data environment. Namespace load and package attach
must not decode every data set. `pkg::name`, attached search lookup, and exported-value lookup may
force a matching data promise; `pkg:::name`, `asNamespace(pkg)`, and private namespace lookup do not
gain that binding. Data archives whose file basename does not identify the realized object, aliases,
multi-object installed lazy-load databases, and `.rdx`/`.rdb` remain outside this contract.

Build-time package admission accepts bounded bzip2 or xz wrappers by normalizing them to the owned
serialization input. Browser runtime decoding remains network-free and bounded by the independent
package-resource/output-byte ceilings. Transport byte buffers are not R vectors and therefore do not
consume the per-vector element ceiling; deserialized R objects still use ordinary allocation
accounting.

`stats::contrasts` covers unordered factors, dense stored numeric contrast matrices, stored
`contr.sum`/`contr.treatment` generator names, and `contrasts = FALSE`. Dense `contr.sum` and
`contr.treatment` cover numeric or character level specifications and numeric treatment baselines.
Sparse matrices, default ordered-factor polynomial contrasts, arbitrary named generator lookup, and
replacement through `contrasts<-` remain explicit boundaries.

Evidence totals 1093/1093 flat cases and 44/44 recursive advisor graphs. The unchanged
`carData 3.0-6` artifact reaches P7 by passing all applicable checks and independent GNU R-matched
probes. Neither that result nor the new callable names is a claim of arbitrary-package support.

## Profile 0.344 literal call-head and rex package contract

Generic call decomposition and reconstruction preserve the value stored in the call CAR. A scalar
character entry remains a literal character value through `[.call`, `as.list()`, and `as.call()`; it
is not rewritten as a symbol. Consequently `typeof(call[[1]])` reports `"character"`, deparsing
retains a quoted head, and evaluating that reconstructed call raises the ordinary non-function-head
error. This is distinct from `call(name, ...)`, whose character `name` argument intentionally
constructs a symbol.

Evidence totals 1094/1094 flat cases and 45/45 recursive advisor graphs. The unchanged `rex 1.2.2`
source reaches P5 for source SHA-256
`5c6a6f9bc45507038ae528e71a7f6cd69a77c24c2fed86383a34fd5c86c2ee48` and deterministic artifact
SHA-256 `191f79c1fb93b5381a466f8635c03d7ae750bacccbd42df03e22abc944bcce48`: it installs, loads,
attaches, passes all five installed example topics, and passes an independent GNU R-matched
capture/match probe without a package-specific branch. Its retained `testthat.R` script first stops
at unavailable suggested package `testthat`, so P6/P7 and arbitrary-package compatibility remain
unclaimed.

## Profile 0.345 brew package-depth contract

Profile 0.345 is an evidence-only package-depth increment: it does not add a runtime callable or
broaden any semantic declaration. The unchanged `brew 1.0-10` source and deterministic artifact
SHA-256 `51479288695528a14536eee3b4b0c96751d92e8c3442402cc6c3c7bfa140fd4a` pass generic
installation, namespace loading, attachment, complete export/help coverage, both installed example
topics, and an independent GNU R-matched inline template/parser scenario. Production code contains
no brew package, version, export, or template-specific branch.

The retained `testthat.R` script first stops because suggested package `testthat` is unavailable, so
brew is P5 rather than P6/P7. Checked-in semantic evidence remains 1094/1094 flat cases and 45/45
recursive advisor graphs. The untouched replacement holdout is `shape 1.4.6.1` at P0; neither result
changes the explicit comprehensive GNU R or arbitrary-package boundaries.

## Profile 0.346 browser graphics, bind, and package-warning contract

`grDevices::dev.new()` has GNU R-shaped trailing `noRStudioGD`, returns invisible `NULL`, delegates
to a function-valued configured device, and otherwise opens a numbered browser-owned device whose
state is isolated per device. `graphics::arrows()` draws recyclable shafts and device-scaled heads
with GNU R validation boundaries. Positive finite `plot.default(asp=)` values expand the user window
according to device `pin`; non-positive, missing, and infinite values are ignored. Axis style `"r"`
performs ordinary expansion while `"i"` uses internal limits.

`rbind()` and `cbind()` force supplied dot arguments left-to-right but omit values resolving to
`NULL`; matrices retain values, dimensions, and dimension names when all other inputs are `NULL`,
and an all-`NULL` call returns visible `NULL`. Package-check example, test, and saved-output steps
retain actionable warning counts without converting warnings into failures. Other check kinds still
fail on warnings, and execution errors or saved-output mismatches remain failures.

Evidence totals 1098/1098 flat cases and 48/48 recursive advisor graphs. Unchanged `shape 1.4.6.1`
reaches P4 and stops first at the independently sourced `datasets::volcano` boundary. This profile
does not claim P5 shape support, complete graphics, arbitrary pure-R package support, or
comprehensive GNU R compatibility.

## Profile 0.347 indexed sort and installed-vignette check contract

`sort()` retains S3 dispatch and `sort.default(x, decreasing = FALSE, na.last = NA, ...)` now
supports `index.return`. A true or coercibly true scalar control returns a list named `x` and `ix`;
`x` is the ordinary sorted vector with names preserved and `ix` is a one-based integer vector into
the original input. `index.return = FALSE` retains the vector result. Combining `partial` and
`index.return = TRUE` raises the GNU R-compatible unsupported-options error.

Package-check vignette execution consumes the canonical installed index field `File`; the lower-case
spelling is not an accepted alternate schema. Evidence totals 1099/1099 flat cases and 49/49
recursive advisor graphs. Unchanged `shape 1.4.6.1` now passes `filledellipse` and its installed
vignette step but remains P4 at the earlier `datasets::volcano` first blocker.

## Profile 0.348 exact-shadowed partial matching and Pearson matrix contract

Argument matching runs exact names before partial names. During the partial pass, a formal selected
by an exact actual is no longer a candidate: a short name may uniquely select another leading
formal, remain in `...`, or become an unused argument when no dots exist. A formal selected by one
partial actual remains visible for duplicate detection, so a second partial actual targeting it is
still an error. Positional matching then skips all exact- or partial-matched leading formals.

`cov(x, y = NULL, use = "everything", method = c("pearson", "kendall", "spearman"))` and `cor`
accept real numeric/logical vectors when both inputs are supplied and real matrices/data frames for
matrix results. Pearson output preserves column dimnames and covers `everything`, `all.obs`,
`complete.obs`, `na.or.complete`, and pairwise-complete observation selection. Zero-variance
correlations return missing entries with an observable warning. Kendall and Spearman are declared
but deterministically unsupported.

Evidence totals 1101/1101 flat cases and 51/51 recursive advisor graphs. Unchanged corrplot reaches
P4 with deterministic artifact SHA-256
`c24a371fb61302e64e399da83a6e229be0c44cb24a048347e5813fb5e30e16ab`; its first ordered blocker is the
reusable `stats::hclust` distance/dendrogram domain.

## Profile 0.349 clustering and array-index contract

For finite numeric/logical matrices, `dist` covers euclidean, maximum, manhattan, canberra, binary,
and Minkowski distances with GNU-shaped formals and `dist` metadata. `as.dist` covers real square
matrices. `hclust` covers the eight declared linkage choices, optional initial member sizes, merge
matrix, heights, stable leaf order, labels, method, call, distance method, and class. Recursive
`as.dendrogram(.hclust)` and `order.dendrogram` preserve branch/leaf members, midpoint, height,
label, leaf, and class structure. This contract excludes GNU R's incomplete-observation distance
rescaling and does not imply clustering semantics outside the executable finite-input cases.

Base `which` now has exact formals `x`, `arr.ind = FALSE`, and `useNames = TRUE`. For logical
arrays, `arr.ind = TRUE` emits column-major one-based coordinate matrices with GNU-compatible result
dimnames; `useNames = FALSE` omits those dimnames.

Evidence totals 1103/1103 flat cases and 53/53 recursive Oracle v2 graphs. The unchanged
`corrplot 0.95` artifact executes AOE, FPC, default-hclust, and Ward-D `corrMatOrder` probes without
package-specific runtime code. Its complete example topic now stops first at missing
`graphics::symbols`, so corrplot remains P4 and complete package compatibility is not claimed.

## Profile 0.350 symbol-graphics and multi-key-order contract

The browser graphics contract now includes `symbols` circles, squares, and rectangles when
dimensions are positive finite values in user coordinates (`inches = FALSE`). Geometry is recorded
as replayable polygon protocol data with colour and line controls. Device-inch scaling and the
stars, thermometers, and boxplots variants are deterministic unsupported boundaries; this is not a
claim of full GNU R `symbols` behavior.

Base `order` has exact formals
`..., na.last = TRUE, decreasing = FALSE, method = c("auto", "shell", "radix")`. Equal-length atomic
keys are ordered lexicographically with stable ties, per-key decreasing flags, and explicit missing
placement or omission.

Evidence totals 1105/1105 flat cases and 54/54 recursive Oracle v2 graphs. An unchanged direct
`corrplot(cor(mtcars))` call now renders through the generic path. The full source-blind
`example:corrMatOrder` check next stops at missing `stats::cutree`; corrplot remains P4 and complete
package compatibility is not claimed.

## Profile 0.351 tree-cut contract

`stats::cutree` has exact formals `tree, k = NULL, h = NULL`. For valid owned `hclust` objects it
supports scalar and vector cluster-count cuts, scalar and vector finite height cuts, observation
labels, repeated cuts, integer coercion of `k`, and GNU-shaped vector/matrix outputs. A supplied
non-NULL `k` takes precedence over `h`. Nonmonotone height trees are valid for `k` cuts but rejected
for `h` cuts.

Evidence totals 1106/1106 flat cases and 55/55 recursive Oracle v2 graphs. The unchanged corrplot
`example:corrMatOrder` topic now passes and the ordered first blocker advances to
`example:corrRect`, where GNU-different symmetric-eigenvector orientation cyclically rotates AOE
ordering and makes a lower-triangle requested name pair absent. Corrplot remains P4 and complete
package compatibility is not claimed.

## Profile 0.352 symmetric-DSYEVR and fractional-sequence contract

The public symmetric `eigen` backend is a source-reproducible LAPACK 3.12.1 `DSYEVR` Wasm closure.
The checked artifact is 150,821 bytes (61,530 bytes gzip), has SHA-256
`3a881a78636b286b41d3f4aa6814e6e0f8b0b07eef226a39335cf3a8c6a94ebf`, and imports only the bounded
memory-growth callback. Its mtcars FPC and AOE signed order is exact against the advisor; broad
symmetric-matrix compatibility is stated in terms of eigenvalues and eigenspaces, not a universal
eigenvector-sign promise. This is an internal numerical backend, not a package native ABI.

Fractional `seq(..., length.out=)` uses the GNU-observed ceiling rule, including integer empty
output for zero. Evidence remains 1106/1106 flat cases and rises to 57/57 recursive Oracle v2
graphs. The unchanged corrplot artifact now passes both `example:corrMatOrder` and
`example:corrRect`; after the sequence correction its next ordered failure is `example:corrplot`
with `invalid symbol parameter`. Corrplot remains P4 and comprehensive package compatibility is not
claimed.

## Profile 0.353 Pearson-test and package-example contract

The browser-admissible `stats::cor.test` surface now covers Pearson tests on equal-length numeric
vectors with complete-pair filtering, owned Student-t probabilities, Fisher confidence intervals,
three alternatives, inclusive zero-to-one confidence levels, and an `htest`-classed result. The
generic exposes `x, ...` formals. Rank methods, exact rank algorithms, and exact reconstruction of
arbitrary source expressions in `data.name` are not claimed.

Reusable table and graphics corrections add data-frame-aware column binding and column-name
replacement, zero-sized non-drawing `symbols` shapes, and `text(..., lwd=)` validation. Checked-in
evidence remains 1106 flat cases and rises to 58/58 recursive Oracle v2 graphs. Every installed
corrplot example topic now passes through the generic package pipeline, advancing corrplot to P5.
Its ordered first blocker is `test:testthat.R`: the suggested `testthat` dependency is not
installed. P5 is not package completion, and neither corrplot-specific branches nor a test bypass
are allowed.

## Profile 0.354 model/package contract

The checked contract adds reparsable precedence-aware deparsing, generalized language-variable and
term-label introspection, retained-model formula/prediction/deviance access, externally restorable
`.Random.seed`, NULL head/tail, complete logical `grepl`, quasi-binomial/Poisson families,
two-column grouped binomial GLMs, `cbind.data.frame`, and `datasets::anscombe`.

Checked-in evidence is 1108 flat cases and 62 recursive Oracle v2 graphs. The available GNU R 4.6.0
advisor passes 62/62 graphs; pinned GNU R 4.6.1 remains normative. Unchanged `insight 1.5.2`
advances to P5 because all applicable examples pass. Its suggested `testthat` dependency is the
first P6 blocker, and comprehensive package compatibility is not claimed.

## Profile 0.355 rotation/numeric contract

The contract adds executable behavior for `graphics::grid`, `stats::uniroot`, `stats::cov2cor`, and
primitive `base::tcrossprod`. Checked-in evidence is 1109 flat cases and 63 recursive Oracle v2
graphs; the available GNU R 4.6.0 advisor is non-normative and GNU R 4.6.1 remains the release gate.

Unchanged `GPArotation 2026.8-1` reaches P3. Its first example exceeds the standard package-test
allocation budget, so no P4/P5 claim is made. `palmerpenguins 0.1.1` remains unopened at P0.

## Profile 0.356 factor-analysis/package contract

The checked contract adds GNU-observed `setNames` coercion/removal, numeric-margin `sweep`, bounded
maximum-likelihood `factanal` from matrix and covariance inputs, direct `loadings` extraction, and
programmatic closure-call reconstruction. Callable `factanal` rotation receives only the loadings
argument, matching the advisor; outer dots are not forwarded. Formula/data/subset/NA-action paths,
factor scores, broader controls, and complete rotation metadata are not claimed.

Checked-in evidence is 1110 flat cases and 64 recursive Oracle v2 graphs; the available GNU R 4.6.0
advisor passes 64/64 and GNU R 4.6.1 remains normative. Unchanged GPArotation advances to P4 because
`example:CCAI` completes. Its ordered P5 blocker is the later `example:GPA` step ceiling, and
comprehensive package compatibility remains unclaimed.

## Profile 0.357 package-example/resource contract

The checked contract adds independent cumulative allocation accounting, bounded-batch numeric
checkpoints, scalar/vector layout coercion, `atan2`, expression-vector `c()` promotion,
deterministic expression axis labels, legend missing-line and text-adjustment semantics, GNU-shaped
print dots and width validation, and generic lazy stored-call rewriting through `update.default()`.

Checked-in evidence is 1111 flat cases and 65 recursive Oracle v2 graphs. The available GNU R 4.6.0
advisor is non-normative and GNU R 4.6.1 remains the release gate. Unchanged GPArotation advances to
P5 because every installed Rd example topic passes under explicit finite evidence limits. Its first
P6 blocker is retained `test:MASSoblimin.R` expression 5, where the default search path does not yet
expose `datasets::ability.cov`; no comprehensive package claim follows.

## Profile 0.358 core-data and factor-analysis contract

`datasets::ability.cov` is a browser-owned, provenance-audited static data resource loaded by the
same generic path as other core and pure-R package data. Namespace access, default attachment,
`data()`, session reset, list/matrix shape, labels, values, and observation count are executable
contracts rather than a package-specific lookup.

For covariance-list inputs, `factanal()` now contracts the factor-count-scaled default start,
bounded scaled optimization coordinates, reusable limited-memory updates, Kaiser-normalized varimax,
and deterministic positive column orientation. Numeric evidence is tolerant at `2e-5`; GPArotation's
stricter `1e-6` retained comparison remains the explicit first blocker, so exact GNU L-BFGS-B
trajectory compatibility and package P6 are not claimed.

## Profile 0.359 exact factor-analysis and package-check contract

The public runtime installs a typed, browser-contained L-BFGS-B backend generated from the official
BSD-3-Clause L-BFGS-B 2.1 distribution. `@nativr/base` supplies objective and gradient callbacks
without depending on Wasm or the composition root, and retains its owned fallback for isolated
tests. For the pinned `ability.cov` two-factor contract, executable evidence compares the exact
objective, uniquenesses, oriented loadings, function and gradient evaluation counts, and converged
status rather than accepting the former `2e-5` approximation.

`stats::varimax(x, normalize = TRUE, eps = 1e-5)` is a generic numeric binding with GNU-shaped
formals, Kaiser normalization, returned `loadings`/`rotmat` structure, dimensions, class, and
dimnames behavior. With neither dimension supplied, `matrix(data)` creates `length(data) x 1`,
including `0 x 1` for empty data; `unclass()` preserves those dimensions. `graphics::legend()`
recycles `fill` and `border` into Worker graphics records and Canvas/PNG/PDF renderers, including
transparent `NA` entries and the GNU default border for filled swatches.

The generic package-check harness parses a retained test script once and evaluates its top-level
expressions separately in one persistent session. Each expression receives a fresh per-evaluation
resource budget while preserving R state, warnings, graphics, and exact expression-number failure
reporting. The harness sets the current directory to the package `tests` root so ordinary relative
companion scripts resolve as they do during package checking.

Under the declared high-intensity limits, the pinned unchanged `GPArotation 2026.8-1` artifact now
passes every applicable example, retained test expression, companion-script load, and package-check
step and advances to P7 with no first blocker. This evidence is artifact-specific: arbitrary pure-R
packages, untested GNU R behavior, suggested dependency closure, and native-package compatibility
remain outside the claim.

## Profile 0.360 namespace-consistent tibble and Date contract

A namespace that is discoverable through `requireNamespace()` must not advertise a misleadingly
partial surface for a common generic. The bounded browser compatibility namespace now exports
`tibble::as_tibble(x, ..., .rows = NULL, .name_repair, rownames)` with S3 dispatch and reusable
atomic, list, matrix and data-frame conversion. It contracts scalar-column recycling, explicit
`.rows`, row-name conversion/preservation, extension attributes and checked, unique, universal and
minimal name-repair modes. This is not a claim that NativR implements the complete tibble package or
every tibble extension protocol.

`as.character.Date()` formats finite browser-owned epoch-day values as UTC civil dates, returns
GNU-shaped `NaN`, `Inf` and `-Inf` text, drops input names, and exposes the observed `x, ...`
formals. `as.Date()` preserves names while constructing attributes in GNU-observed order. Dates
outside the supported ECMAScript civil-time range fail explicitly.

The pinned unchanged `palmerpenguins 0.1.1` archive passes the generic applicable package-check
plan. An independently authored scenario also forces both LazyData promises and compares dimensions,
names, classes, factors, missing counts, selected records and Date text with black-box GNU R
evidence. The package advances to P7 with `firstBlocker: null`; the claim applies only to its
recorded digest and exercised surface. There is no package-identity branch, embedded package data,
source rewrite or arbitrary pure-R package claim.

## Profile 0.361 group-generic and polynom contract

An `S3method(Math, class)`, `S3method(Ops, class)`, `S3method(Summary, class)`,
`S3method(Complex, class)`, or `S3method(matrixOps, class)` namespace directive is valid without a
user-visible callable binding for the group name. Runtime registration associates those methods with
the Base generic-definition environment. Group calls expose GNU-shaped dispatch metadata; callable
operators and syntax operators share the same registry; and `NextMethod()` consumes method formals
after local reassignment while preventing recursive redispatch to the method being left.

The numeric contract adds single-variable `stats::poly` and general real non-symmetric `eigen()`
above order three. The latter is a browser-owned characteristic-polynomial/root/null-space path; the
existing reproducible DSYEVR Wasm backend remains the symmetric path. `stats::deriv` is only an S3
generic at this profile, and multivariate `poly` remains unsupported.

The frozen unchanged `polynom 1.4-1` source and deterministic artifact SHA-256
`d9980d6e2aeabe3a8474a415b4bdb4a9fdc148baad0d3973bae8b4a31003c442` pass the complete applicable
generic package-check plan. Independent black-box-matched evidence covers construction, arithmetic,
prediction, derivative/integral methods, Math rounding, Summary accumulation, list distinctness and
four real roots. The ledger records P7 only for this artifact and exercised surface.

## Profile 0.362 estimability and model-update contract

`getCall.default(x, ...)` accepts and leaves unused dots lazy. The default update path matches
`object`, `formula.`, `...`, and trailing `evaluate`, updates a retained model formula before
rewriting the stored call, preserves unevaluated replacement expressions when requested, and
evaluates the rebuilt call in the caller environment.

Linear-model construction and reconstruction accept named contrast lists whose entries are
`contr.treatment`, `contr.sum`, `contr.helmert`, or numeric/logical contrast matrices. The selected
specifications propagate through retained model objects, `model.matrix(contrasts.arg=)`, and
prediction. `predict.lm(rankdeficient = "NA" | "NAwarn")` marks non-estimable design rows from the
visible QR row space. These claims are fixed by flat and recursive GNU differential evidence.

The unchanged pinned `estimability 2.0.0` package passes at P7 with artifact SHA-256
`93c415103e22251e6a4db3b98df961202a692fe4d5ed1991479f6c4966a86dbc`; this does not generalize the
claim to arbitrary packages or comprehensive GNU R behavior.

## Profile 0.366 eval, names, and model-policy contract

An `eval()` call exposes an outer synthetic frame containing forced `expr`, `envir`, and `enclos`
bindings, then evaluates in an inner frame that is the selected target environment. Normalized parse
data distinguishes formal `...` (`SYMBOL_FORMALS`) from expression `...` (`SYMBOL`). Names
replacement preserves missing-name masks; `list2env()` treats a missing name as the literal `"NA"`
binding but rejects an empty name. The bounded model path honors `na.action = na.fail` and reports
incomplete model data as an error.

Flat and recursive GNU differential cases fix these behaviors. The unchanged pinned `lambda.r 1.2.4`
artifact passes at P7 only for its applicable generic checks and independently exercised surface.
The contract does not claim exact identity for every synthetic stack frame, custom method ecosystem,
arbitrary pure-R package, or comprehensive GNU R behavior.

## Profile 0.367 configuration, RNG, and QR contract

`utils::modifyList(x, val, keep.null = FALSE)` requires two lists, recursively merges common named
list entries, appends new named entries, deletes `NULL` replacements unless requested otherwise, and
preserves the outer attributes of `x`. The Box-Muller normal kind produces measured GNU R fixed-seed
pairs, consumes two uniform values per pair, and retains the second value without advancing
`.Random.seed`.

Named dots on `qr()` reach `qr.default()`, and a QR object dispatches `solve()` through
`solve.qr(a, b, ...)`. Exact flat and recursive cases cover a bounded full-rank solve and the RNG
cache position. The contract does not claim arbitrary LAPACK pivot vectors, rank decisions on
ill-conditioned matrices, or native LAPACK ABI compatibility.

## Profile 0.363 language, regex, condition, and package contract

Synthetic calls reconstruct function expressions from pairlists or `NULL` zero-formal lists. Default
TRE-compatible regular expressions allow dot to cross newlines while `perl = TRUE` keeps PCRE-style
dot behavior. `sub()`/`gsub()` coerce replacement inputs through `as.character()`,
`all.equal(check.names = FALSE)` excludes only names from attribute comparison, and warnings reach
the nearest matching exiting `tryCatch()` handler. These behaviors have flat and recursive GNU
differential cases. The pinned `formatR 1.14` claim stops at P5 with its retained tests as the first
blocker.

## Profile 0.368 blank numeric-text and snow package contract

`as.integer()` and `as.double()` return typed missing values without warnings for empty or
whitespace-only character elements. Numeric decimal/exponent syntax remains accepted; integer
conversion truncates toward zero. Character `NaN` maps to missing integer without an out-of-range
warning, while invalid character syntax and infinities preserve their distinct warnings. Flat and
recursive GNU differential cases cover values, missingness, and the warning boundary.

The pinned unchanged `snow 0.4-4` artifact passes the complete applicable generic package-check plan
and a GNU-matched custom in-memory transport scenario. This contract covers pure-R scheduling,
splitting, S3 transport dispatch, and remote-error aggregation. It does not claim browser launch of
SOCK/MPI workers, external network access, optional `rlecuyer`, or arbitrary package compatibility.

## Profile 0.369 S3 visibility and futile.options package contract

An S3 method result retains its visible or invisible state through both `UseMethod()` and
`NextMethod()`. A subsequent expression in an enclosing block may replace that state in the ordinary
way. Flat and recursive GNU differential cases plus a package-independent integration test cover
both dispatch paths.

The pinned unchanged `futile.options 1.0.1` artifact passes every applicable generic package-check
step and an independently authored GNU-matched OptionsManager scenario. The P7 claim is scoped to
that artifact and exercised surface; it does not imply arbitrary pure-R package or comprehensive GNU
R compatibility.

## Profile 0.370 futile.logger transitive-package contract

Character values used by `if` and `while` follow GNU R's exact logical-string coercion boundary.
Implicit numeric `split()` groups use numeric factor ordering and keep `NaN` distinct from `NA`.
Environment formatting exposes GNU R-shaped registered-environment labels, and `tryCatch()` forces
the handler list before the protected expression while retaining empty names when at least one
condition-class name is supplied. Flat and recursive black-box cases cover all four contracts.

The pinned unchanged `futile.logger 1.4.9` artifact, its mandatory `lambda.r` and `futile.options`
closure, and the retained `testit` test dependency pass every applicable generic package-check step.
An independently authored scenario also matches GNU R for root and child thresholds, carp state,
logger removal, and hierarchical fallback. This P7 result is artifact-scoped and does not imply
arbitrary pure-R package or comprehensive GNU R compatibility.

## Profile 0.371 tinytest package and condition contract

The runtime supports the package-neutral contracts selected by the frozen run: omitted-choice
`match.arg()`, dynamic system-parent queries, null-device paths, `options(list())`, parsing from
browser-owned files/connections, explicit missing factor levels, `as.table()` conversion and S3
dispatch, text-connection seek queries, and PCRE replacement case controls. Browser-owned
`datasets::women` and `datasets::cars` have independent provenance. `errorCondition()` is
extensible; `warning(condition)` and `message(condition)` preserve the supplied condition; and
automatic vector-recycling warnings participate in calling/exiting handlers and `muffleWarning`.

The pinned unchanged `tinytest 1.4.3` artifact passes every applicable generic package-check step
and its retained 159-test self-test. This P7 result is artifact-scoped and does not imply arbitrary
pure-R package or comprehensive GNU R compatibility.

## Profile 0.372 permute package and reusable foundation contract

Exact `getElement()` extraction, `as.list(symbol)`, `lfactorial()`, nested `update.default()` call
reconstruction, startup-message muffling, one-dimensional classed cumulative values, ordinary
vector/list `unsplit()`, factor-response `plot.formula()`, and two-group `t.test.formula()` follow
the executable contracts covered by flat, recursive, and public API tests. Unsupported data-frame
`unsplit()` and formula-subset paths remain explicit rather than silently approximated.

The pinned unchanged `permute 0.9-10` artifact passes every applicable generic package-check step
and an independently authored permutation-control scenario. Its retained `testthat` launcher is
not-applicable because the declared suggested dependency is unavailable; it is not a passing-test
claim. This P7 result is artifact-scoped and does not imply arbitrary pure-R package or
comprehensive GNU R compatibility.

## Profile 0.373 bigD package-resource and null-external-pointer contract

Package normalization permits a reviewed individual resource up to 64 MiB beneath an independent 192
MiB aggregate ceiling. Loading an installed package resource uses the package-resource input limit
while ordinary user serialization remains limited by `maxOutputBytes`. A decoded `EXTPTRSXP` is
represented only as a null browser value with protected/tag fields, attributes, and reference
identity; it can round-trip through supported serialization but cannot expose an address or cross
the public JavaScript value boundary.

The pinned unchanged `bigD 0.3.1` artifact passes every applicable generic package-check step and an
independently authored date/locale scenario. Its retained `testthat` launcher is not-applicable
because the declared suggested dependency is unavailable, and it has no vignette manifest; neither
is a passing-test claim. This P7 result is artifact-scoped and does not imply arbitrary pure-R
package, non-null external-pointer, native-package, or comprehensive GNU R compatibility.

## Profile 0.374 pracma numerical and model contract

The browser runtime now contracts the measured `stats::optimize`, `stats::spline`,
`stats::approxfun`, and `stats::pgamma` surfaces; Base `sort.list`, `chol2inv`, exact
`sinpi`/`cospi`/`tanpi`, full-row-rank underdetermined `qr.solve`, complex solve/eigen, and numeric
matrix-valued model terms; and GNU singleton-array recycling and logical matrix Ops. Each claim is
backed by package-independent integration, flat conformance, and recursive GNU R comparison.

## Profile 0.376 smoothing, quantile-plot, GLM-control, and package-data contract

`stats::smooth.spline` contracts weighted natural-cubic smoothing with explicit effective degrees of
freedom, lambda or spar controls, GCV/leave-one-out selection, fitted values, leverage, criterion
fields, the public object class and formals, and reusable `predict.smooth.spline` interpolation,
extrapolation, and derivatives. Exact knot-subselection equivalence, unrestricted large inputs, and
every `control.spar` path remain outside the current claim.

For `data(..., package =)` with an explicit package vector, package availability is validated before
dataset lookup. An unavailable package raises the conventional package-missing diagnostic instead of
degrading into a later missing-object error. This lets the generic package checker classify an
example that depends only on an unavailable declared Suggests package as not applicable; it does not
count that example as passing or provide the absent package's datasets.

`stats::qqnorm` contracts S3 dispatch plus GNU-compatible default theoretical positions, retained
missing-value placement, invisible coordinate output, and the ordinary plotting path.
`stats::qqplot` contracts equal- and unequal-length sample coordinates and ordinary plotting.
Confidence bands selected through `conf.level` or `conf.args` remain outside the current claim.

`stats::glm.control` contracts the three-field control object, GNU defaults and formals, positive
scalar validation, and preservation of a caller-supplied integer `maxit`. It is a reusable model
control primitive and does not by itself claim complete GLM fitting or diagnostics.

## Profile 0.377 normal-density contract

`stats::dnorm` contracts vectorized density and log-density results, argument recycling, missing and
NaN propagation, zero/negative/infinite standard-deviation boundaries, longest-argument attribute
selection, exact public formals, and the GNU-shaped `NaNs produced` warning call. This closes a
shared statistical primitive; it does not imply that every distribution family or numerical tail
algorithm is complete.

The pinned unchanged `pracma 2.4.6` artifact passes every applicable generic check and an
independent numerical scenario. Errors naming unavailable packages are classified not-applicable
only when the named dependency is declared in Suggests. Optional Suggests paths are not passing
claims. This P7 result is artifact-scoped and does not imply arbitrary pure-R package,
native-package, or comprehensive GNU R compatibility.

## Profile 0.378 lynx data contract

`datasets::lynx` contracts a 114-observation double `ts` series spanning 1821 through 1934 at
frequency one. Values come from an independently published CC0 resource whose complete sequence was
checked against GNU R only through the public object as a black-box oracle. Exact class, attribute
order, time coordinates, all values, aggregates, namespace/search identity, and generic package
resource loading are executable evidence. This admits one reviewed core dataset; it does not claim
the remaining `datasets` catalog or relax the provenance gate.

## Profile 0.379 autoregression and geometric-random contract

`stats::ar` contracts univariate Yule-Walker estimation, fixed-order and AIC-selected fits,
coefficient and partial-autocorrelation values, corrected prediction variance, residual shape,
asymptotic covariance, result fields/classes, and public formals. Other fitting methods,
multivariate series, broader missing-data actions, and comprehensive AR modeling remain outside this
profile and fail explicitly.

`stats::rgeom` contracts integer result shape, `n` length rules, probability recycling, non-negative
support, the probability-one limit, missing/invalid probability behavior, structured domain
warnings, and public formals. Ordinary draws use the session RNG and are covered by distributional
invariants; exact GNU RNG-stream identity is not claimed by this increment.

## Profile 0.380 stationary ARMA simulation contract

`stats::arima.sim` contracts univariate stationary AR, MA, and mixed ARMA recursion; explicit
`innov` and `start.innov`; default or caller-supplied `rand.gen`; forwarding of `...`; burn-in
length validation; stable-AR validation; double time-series shape; and public formals. The claimed
surface is deterministic under explicit innovations and is recursively compared with GNU R.
Integrated models, multivariate models, exhaustive initialization behavior, and exact ordinary
random-stream identity remain outside this increment and fail explicitly where applicable.

## Profile 0.381 reflection and uniform-random contract

`methods::formalArgs` contracts formal-name reflection for closures, regular builtins, and
character-resolved functions; null results for primitives and zero-formal functions; invalid-value
warnings; namespace export; and its one-argument public signature.

`stats::runif` contracts random-result length rules, recycled vector bounds, fixed-seed values,
constant intervals without RNG advancement, empty-bound NA results, invalid-bound NaN results,
structured warnings, metadata dropping, and exact public formals. The ordinary values share the
session RNG and are covered against the pinned engine behavior.

## Profile 0.382 hatch graphics, finite range, and plotrix package contract

Positive `density` for `polygon`, `rect`, histogram bars, and barplots now produces a shared
replayable hatch description containing physical lines-per-inch, counter-clockwise angle, resolved
color, and line width. Browser Canvas and the software PNG renderer use clipped device-pixel lines;
the PDF device uses 72-point-per-inch clipped paths. Solid fill, hatch, and border remain separate,
and display-list serialization preserves hatch metadata. Device-specific hatch origin/subpixel
identity remains outside the claim.

`base::range.default` now has exact `..., na.rm = FALSE, finite = FALSE` formals for the claimed
numeric/logical surface. Named dots remain data, `finite = TRUE` removes missing, NaN, and infinite
values before extrema, and the generic still performs Summary/S3 dispatch. Recursive Oracle v2
retains the results and callable formals.

`graphics::boxplot` now accepts positional formula/data input through the shared model-frame path,
honors `axes` and `frame.plot`, and emits category/value axes and the plot frame when requested.
Explicit suppression emits only page/window/boxplot commands, which is the unchanged plotrix ehplot
path that selected this work.

Checked-in evidence for this profile is 1245/1245 flat cases and 139/139 exact recursive Oracle v2
graphs on the available advisory GNU R 4.6.0 installation; GNU R 4.6.1 remains normative. The
unchanged pinned `plotrix 3.8-14` artifact advances from source-blind P0 to development P4. At this
profile boundary its complete examples stop first at `example:election`; later profiles record the
subsequent source-blind progress and current first blocker. The replacement metadata-only P0 holdout
is `scatterplot3d 0.3-45`, selected from the same fixed 2026-07-17 through 2026-08-15 usage window
and frozen only by official metadata and the unopened 484,624-byte source archive SHA-256. No
arbitrary-package or comprehensive GNU R claim follows.

## Profile 0.383 call, collection, and graphics closure

Ordinary closure calls and `do.call()` now treat an exactly or partially named missing actual as
provisional: a later non-missing positional actual may fill that formal, while duplicate non-missing
named matches still fail. Character `do.call()` targets use function-mode lexical lookup, skipping
nearer non-callable bindings. `rep(times=)` applies vector times to the sequence after `each`
expansion and retains GNU-shaped invalid-times diagnostics. `%in%` bypasses Ops S3 dispatch, and
`apply()` coerces data frames through their matrix surface.

`range.default()` recursively consumes list and pairlist leaves on its supported atomic surface.
One-dimensional arrays are accepted by `barplot()` and model-frame paths. `stripchart()` exposes its
generic, formula, default, and bounded-overplot behavior. `symbols(inches=)` scales physical symbol
sizes from plot-region inches, and `pie()` supplies wedge, label, annotation, direction, density,
and visibility behavior with GNU-shaped formals. Expression labels have a deterministic source-text
fallback, and `persp(ticktype = "detailed", axes = FALSE)` no longer requires suppressed annotation
work. These are shared contracts, not package-specific branches; mathematical glyph layout and
enabled detailed perspective axes remain outside the claim.

Checked-in evidence is 1260/1260 flat cases and 144/144 recursive Oracle v2 graphs on the available
non-normative GNU R 4.6.0 advisor; pinned GNU R 4.6.1 remains the release gate. The unchanged
`plotrix 3.8-14` examples progress through `multhist`, `multsymbolbox`, `panes`, `paxis3d`,
`plotCI`, and `radial.pie`. They now stop first at `example:raw.means.plot`, where an upstream
grouping/factor cardinality divergence produces two source values and four repetition counts. GNU R
rejects those same `rep()` cardinalities, so weakening `rep()` would be incorrect; the next reusable
blocker is the preceding grouping/factor construction. The artifact remains P4.

The continuation closes that grouping divergence at the data-frame replacement layer:
`frame[, column] <- object` now installs whole-column factor and classed objects, while an explicit
full-row index retains cell-coercion semantics. All data-frame replacement paths reproduce the
observable GNU attribute order. Binary arithmetic `Ops.data.frame` supports either operand order,
equal data frames, column lists, flattened vectors/matrices, missing values, names, row names, and
the data-frame result shape. `plot.default()` accepts state-neutral inline `mar`, warns and ignores
truly unknown non-graphical parameters while retaining explicit boundaries for known unsupported
graphical controls, and `text(labels = NULL)` is an invisible no-op.

With 1265/1265 flat cases and 146/146 recursive graphs passing against the available advisory GNU R
4.6.0, unchanged plotrix advances through `raw.means.plot`, `soil.texture`, `staircasePlot`, and
`triax.fill`. Its current first failure is `example:twoord.plot`, which requires the shared
`base::seq.Date` contract. GNU R 4.6.1 remains normative.

## Profile 0.384 Date sequences, Date axes, and plotrix P7

`seq.Date()` now participates in ordinary `seq()` S3 dispatch and implements finite scalar Date
endpoints, numeric and `difftime` day steps, day/week/month/quarter/year strings, forward and
reverse sequences, `length.out`, `along.with`, calendar rollover, Date class preservation, and
deterministic sign/cardinality diagnostics. `graphics::axis.Date()` supplies automatic civil-date
ticks or sorted explicit Date ticks, formatted labels, forwarded graphical controls, invisible
classed results, and the documented formal surface.

Shared `rect()` and `polygon()` forwarding now accepts irrelevant recognized graphical controls and
warns rather than aborting for genuinely unknown named controls, matching GNU behavior selected by
package-level `...` forwarding. With these package-neutral changes, the unchanged pinned
`plotrix 3.8-14` artifact passes the complete applicable generic package-check plan and advances to
P7 with no first blocker. Flat conformance is 1268/1268 and recursive Oracle v2 is 147/147 on the
available advisory GNU R 4.6.0; GNU R 4.6.1 remains normative, and this pinned result does not imply
arbitrary-package completion.

## Profile 0.507 source reconstruction and bind-dispatch contract

`utils::getParseData()` includes explicit `;` separators even though the pinned Tree-sitter grammar
does not expose them as concrete child nodes. Each recovered terminal has its exact source span and
the smallest enclosing normalized expression parent. `deparse()` renders a custom `%...%` call with
a braced operand as a multiline, reparsable block even when its compact spelling fits
`width.cutoff`.

The binding generics ignore `NULL` inputs only while choosing a dispatch object and retain that
object's original argument index when invoking the S3 method. The selected method still receives the
original arguments: `rbind.data.frame(NULL, frame)` accepts the leading `NULL`, whereas
`cbind.data.frame(NULL, frame)` treats it as a zero-row input and reports GNU R's
differing-row-count error against a positive-row frame. Flat, recursive, and unchanged
dependency-chain tests pin the combined source-transforming package contract.

## Profile 0.506 recursive calls, standard GLM links, and enrichwith evidence

Runtime-created calls preserve exact recursive object graphs, including closure and environment
identity, instead of requiring every value to be representable as source syntax. The public
`stats::make.link` contract covers all nine standard links, five-component `link-glm` structure,
closure formals, numerical behavior, epsilon boundaries, link-specific validity, and reuse by family
constructors.

Flat and exact recursive GNU black-box cases cover both contracts. The unchanged `enrichwith 0.5.0`
artifact `dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612` passes every applicable
generic package check and an independent link/family/lm scenario. The 130-release ledger contains
115 passing, 15 blocked, none unevaluated, and 76 scoped P7 entries. This remains pinned
browser-admissible evidence, not arbitrary-package completion.

## Profile 0.385 scatterplot3d source-blind closure

The generic three-dimensional coordinate, recursive data-frame composition, plot-window aspect
sentinel, and static core-data contracts now carry unchanged `scatterplot3d 0.3-45` through its
complete applicable package-check plan. `datasets::trees` is independently sourced from a CC0
resource and follows the same package-data loader as the existing core catalog. The exact installed
artifact is pinned at P7 with no first blocker; this proves one source-blind package result, not
arbitrary pure-R package or comprehensive GNU R compatibility.

## Profile 0.386 xmlparsedata source-blind evidence

The metadata-frozen unchanged `xmlparsedata 1.0.5` release passes the complete applicable generic
package-check plan and an independently authored parse-data-shaped XML scenario. The scenario covers
source-location attributes, pretty indentation, XML escaping, and the exported token-name map; its
exact observable result matches the available non-normative GNU R 4.6.0 black-box advisor. Source
and deterministic installed-artifact digests are pinned separately. The release reaches P7 without a
package-specific branch or source rewrite; this remains evidence for one pinned package surface, not
a claim of comprehensive GNU R or arbitrary-package compatibility.

## Profile 0.387 lazy S3 dispatch and formula-language contract

`with()` forces only its dispatch object before S3 selection, forwards the original lazy actual
arguments unchanged, and applies the default method's required-`expr` validation only after no S3
method is found. A selected method may therefore leave `expr` missing and consume a method-specific
named argument. An explicit second object passed to `UseMethod()` selects the method but does not
replace or inject the generic's original actual arguments, including the zero-argument case.

Formula call-like subset replacement preserves formula class, normalized structure, and lexical
environment. Parenthesized formula expressions remain valid language labels and are transparent to
ordinary `+`, `*`, `:`, and `/` term expansion, while actual calls such as `I()` retain call
semantics. Exact flat and recursive evidence covers these contracts through `terms()`,
`model.frame()`, and `model.matrix()`.

These package-neutral changes carry unchanged, source-blind `mitools 2.4` through its complete
applicable generic package-check plan and an independent synthetic multiple-imputation scenario at
P7. Its source and installed-artifact digests are pinned separately. This result is scoped to the
pinned artifact; it does not imply arbitrary package or comprehensive GNU R compatibility.

## Profile 0.388 namespace assignment and logger dependency boundary

The `utils` namespace exports `assignInMyNamespace()` and `assignInNamespace()` with GNU-compatible
formals and lazy location defaults. Both helpers replace only an existing binding, preserve an
existing binding lock across replacement, and return invisible `NULL`. The implicit helper resolves
the calling package namespace, with Base as the direct public-call fallback; the explicit helper
accepts a package name or namespace environment. Missing bindings and non-package environments fail
deterministically. Base `pi` is locked, so differential evidence observes the complete unlock,
replace, relock contract rather than only an unlocked assignment.

These package-neutral semantics carry unchanged `logger 0.4.2` through parsing, namespace loading,
attachment, both namespace-assignment paths, and an independently authored logging scenario at P4.
Its first installed-example blocker remains the optional `glue` Suggests/native-code dependency
closure. Without `glue`, advisory GNU R 4.6.0 selects the same `formatter_sprintf` fallback and
rejects the example's bare numeric message; NativR therefore retains strict `sprintf` semantics.

## Profile 0.389 device-independent axis ticks and gridGraphics P1

`grDevices::axisTicks()` now computes graphics-engine-independent linear and logarithmic tick
vectors from transformed `usr` extents. It accepts explicit `axp` codes or derives them through the
private `.axisPars()` helper, supports reversed extents, linear short log spans, 1/5 and 1/2/5 log
subdivisions, wide-decade thinning by `nint`, exact endpoint handling, and documented formals. The
implementation shares the existing linear-axis parameter machinery but does not require an active
graphics device or add package-specific behavior.

The source-blind `gridGraphics 0.5-1` artifact advances from frozen P0 through complete R-source
parsing at P1. `axisTicks` removes its first namespace-import blocker; the next deterministic
namespace failure is the missing reusable `grDevices::contourLines` contract. Source and installed
artifact digests are pinned separately, and namespace loading, attachment, examples, tests, and
package-check completion are not claimed.

## Profile 0.390 device-independent contour extraction

`grDevices::contourLines()` now returns device-independent numeric contour polylines from ordinary
matrix grids or documented packed `x`/`y`/`z` lists. The shared implementation preserves supplied
level order and duplicates, uses the observed global-range equality perturbation, joins open and
closed cell segments deterministically, resolves four-edge saddle cells by their center value,
retains triangular finite regions beside missing/non-finite cells, and honors
`options("max.contour.segments")` with bounded truncation and a warning. Increasing coordinate and
matrix-shape checks, constant/all-missing diagnostics, public formals, nested result structure, and
memory/checkpoint limits are executable contracts; no graphics device is opened.

Flat conformance is 1281/1281 and exact recursive Oracle v2 is 156/156 against the available
non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains the normative release gate. The unchanged
`gridGraphics 0.5-1` artifact still reaches P1: `contourLines` removes its previous namespace
blocker, and the next deterministic namespace failure is the missing reusable `grid::makeContent`
grob lifecycle generic. Loading, attachment, examples, tests, and later tiers are not claimed.

## Profile 0.391 grid grob lifecycle generics

`grid::makeContent(x)` and `grid::makeContext(x)` now provide the shared S3 lifecycle seam used to
resolve or augment grob content and context before drawing. Both have the exact single `x` formal,
dispatch through ordinary registered and caller-visible S3 methods, preserve `NextMethod()` class
progression and result visibility, and default to returning `x` unchanged. Methods may return a
modified object or another value; NativR does not impose a package-specific grob class or rewrite.

Checked-in flat conformance is 1282/1282 and exact recursive Oracle v2 is 157/157 against the
available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains normative. The unchanged
`gridGraphics 0.5-1` package now loads, attaches, registers `makeContent.echogrob`, passes its
documentation checks and every applicable installed example, and advances from P1 to P5. Its first
retained-test blocker is the shared `grDevices::pdf.options` device-default contract. P6/P7 are not
claimed.

## Profile 0.392 session PDF option state

`grDevices::pdf.options(..., reset = FALSE)` now owns package-neutral, session-scoped PDF defaults.
The visible zero-argument query returns the 21 GNU R defaults in their normative order. Named
updates and reset operations return the previous complete option list invisibly; reset is applied
before any simultaneous updates. Option names are exact and prevalidated transactionally. Ordinary
updates must preserve R mode and length and otherwise warn without mutation; `fonts` retains its
separate list-valued contract.

`grDevices::pdf()` consumes the current option state for omitted arguments, while explicit device
arguments override it without mutating the stored defaults. Flat and recursive evidence covers
query, update, visibility, reset, validation, device consumption, explicit override, and public
formals. Checked-in flat conformance is 1284/1284 and recursive Oracle v2 is 158/158 against the
available non-normative GNU R 4.6.0 advisor. The unchanged `gridGraphics 0.5-1` retained test
advances past expression 16 and first stops at expression 17 because the generic package-check
runner does not yet provide a writable, isolated working directory for relative generated files. The
artifact remains P5; P6/P7 are not claimed.

## Profile 0.393 writable package tests and viewport navigation

Package tests and saved-output runs now execute from a fresh writable browser-memory copy of their
installed `tests` tree. Resources are copied recursively, relative output stays inside that copy,
and the immutable installed artifact is not mutated. This is a package-neutral execution contract;
it does not recognize package names or rewrite package source.

Grid viewport state now retains a navigable tree independently of the current path. `upViewport`,
`downViewport`, `current.viewport`, and `vpPath` implement GNU-observed formals, path objects,
invisible navigation results, strict and descendant lookup, and top-level errors. `viewport(just =)`
normalizes character and numeric justification into the two-coordinate `justification` and
`valid.just` fields. Checked-in flat conformance is 1285/1285 and exact recursive Oracle v2 is
159/159 against the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains normative. The
unchanged `gridGraphics 0.5-1` test advances through the former filesystem and viewport blockers and
now first stops at GNU-compatible recorded-graphics operation descriptors. It remains P5.

## Profile 0.394 recorded-graphics operation descriptors

`recordPlot()` now preserves GNU-shaped second-slot descriptors for `C_plot_new`, `C_plot_window`,
and `C_box` while retaining replay-safe normalized fields. Descriptor names, lengths, argument
names, and nesting pass 1286/1286 flat cases and 160/160 exact recursive Oracle graphs against the
available non-normative GNU R 4.6.0 advisor. GNU R 4.6.1 remains normative. The unchanged
`gridGraphics 0.5-1` test next stops at missing `grid::grid.polygon` and remains P5.

## Profile 0.395 grid drawing grobs and primitive display-list coverage

The grid namespace now provides GNU-shaped `polygonGrob`, `segmentsGrob`, `linesGrob`, and
`pointsGrob` objects plus their drawing functions. Construction covers unit coercion, `id` and
`id.lengths`, gpar styles, vpPath conversion, generated names, draw visibility, and browser journal
events. Recorded plots now also expose `C_segments`, `C_plotXY`, `C_text`, and `C_polygon`
descriptors. Flat conformance is 1287/1287 and exact Oracle v2 is 161/161 against the available GNU
R 4.6.0 advisor; GNU R 4.6.1 remains normative. Unchanged `gridGraphics 0.5-1` completes its first
three demos and remains P5 at composite boxplot display-list lowering.

## Profile 0.396 ordered boxplot display-list lowering

`recordPlot()` now expands a retained composite boxplot event into per-group polygon, median,
placeholder-point, whisker, staple, outline, and outlier operations. For the evidenced two-group,
axes-suppressed contract, the filtered `C_plot_new`, `C_plot_window`, `C_polygon`, `C_segments`, and
`C_plotXY` operation sequence exactly matches the GNU R black-box result; normalized fields remain
available for safe replay. Flat conformance is 1288/1288 and exact Oracle v2 is 162/162 against the
available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains normative. The unchanged
`gridGraphics 0.5-1` retained test now completes expressions 1 through 23 and remains P5 at
expression 24's reusable `pairs.default` graphics-layout and panel-callback blocker.

## Profile 0.397 numeric scatterplot-matrix path

`graphics::pairs` now retains exact `x, ...` formals and routes unclassed numeric matrices and data
frames through a browser-native scatterplot-matrix path. It supports recycled point symbols,
foreground and background colours, sizes, diagonal column labels, main-title style controls,
missing-point omission, invisible `NULL`, and primitive recorded events. S3 dispatch remains lazy.
This is a shape-level subset: custom panel callbacks, formula inputs, logarithmic panels, and GNU's
complete per-panel axis/layout engine remain explicit boundaries. The unchanged `gridGraphics 0.5-1`
test completes both iris pairs demonstrations at expressions 24 and 25 and now first stops at
expression 26 because `datasets::volcano` is absent. The dataset must enter through the independent
core-data provenance policy, not by copying GNU R data files.

## Profile 0.398 cleanup-only packaging and S4 prototype closure

`configure*` remains a hard packaging boundary because generated installation outputs cannot be
assumed or executed in the browser build. A source `cleanup*` file alone is now an explicit warning:
NativR does not execute it, package it, or create the host build byproducts it would remove. The
browser-core dependency registry includes the empty, explicitly incomplete `stats4` namespace so
pure-R dependency resolution can proceed without pretending its callable surface is complete.
`methods::prototype(...)` now supplies reusable named S4 slot defaults and rejects multiple unnamed
data objects, while `stats::logLik(object, ...)` performs ordinary lazy S3 dispatch and preserves
its GNU formals. Differential evidence covers the named-default consumption and S3 dispatch path.

## Profile 0.399 call mutation, model subsets, and implicit S4 generics

Call-language objects support default `$` extraction with exact and unique-partial tag matching and
exact `$<-` replacement, append, and `NULL` deletion. Replacement retains ordinary call attributes.
`stats::model.frame()` evaluates `subset` lazily in the model data mask, applies the shared logical,
numeric, negative, and character row-selection contract, and repairs duplicate row names in GNU
order. `setMethod()` promotes an ordinary closure owned by its top-level `where` environment to a
callable S4 generic, including legacy bodies that spell `standardGeneric(name)` with an unquoted
symbol; nested local-only closures retain GNU R's missing-definition error. `methods::extends()`
reports self and explicit inherited class relationships and a bounded implicit numeric/vector
lineage. `fullInfo = TRUE` remains an explicit unsupported metadata boundary.

## Profile 0.400 callable model contrasts and `lm.fit`

`stats::model.matrix()` accepts callable entries in `contrasts.arg`, invokes them with named factor
levels, validates and completes the returned contrast matrix, rejects singular generators, and
records the resolved numeric matrix as contrast metadata. `stats::lm.fit()` accepts direct numeric
designs with vector or matrix responses and returns the bounded QR fit contract. Multi-response
offset matrices, alternative fitting methods, and complete native QR storage identity are not
claimed. Package evidence advances unchanged modeltools to P5; synchronized S4 model-environment row
omission is its next explicit blocker.

## Profile 0.401 evidence boundary

Profile 0.401 adds executable flat and recursive evidence for nested frame construction,
model-frame-preserving matrix construction, terms intercept mutation, S4 NA methods, and promoted
generic fallback. It advances one frozen artifact, modeltools 0.2-24, to scoped P7 only because all
of its applicable examples, 46 retained expressions, checks, and the independent scenario pass. That
result must not be generalized to arbitrary packages or to complete implementations of the named GNU
R functions.

## Profile 0.402 evidence boundary

Central `stats::qchisq` and `stats::qf` carry unchanged ellipse 0.5.0 through installation,
namespace loading, attachment, documentation, and independent execution to P4. Non-central quantiles
and `stats::arima0` remain outside this increment and fail explicitly. The package's P4 result is
not evidence for complete distribution, time-series, or arbitrary-package compatibility.

## Profile 0.403 evidence boundary

Generic utils completion/settings behavior and Reference Class `callSuper()` semantics carry the
unchanged GlobalOptions 0.1.4 archive through install, namespace load, attachment, all five
documentation/example topics, its browser-applicable vignette check, and an independent scenario.
The optional testthat launcher is not applicable without that Suggested dependency. P7 is evidence
for this pinned artifact and exercised surface only; it is not a claim that Reference Classes,
completion services, or arbitrary pure-R packages are complete.

## Profile 0.404 evidence boundary

`mapply()`, `Map()`, and `.mapply()` now accept language and expression vectors through the same
pairlist-like length, tag, and element-selection contract used by GNU R. Character conversion of a
non-symbol call head omits only the synthetic parentheses needed to represent it as a callee. This
carries unchanged rbenchmark 1.0.1 through P4 and an independent bounded benchmark. Its installed
example deliberately performs million-element allocations and hundreds-to-thousands of repetitions,
so P5 remains blocked by the deterministic package-test execution-step limit; the limit is not
weakened. Unchanged ca 0.71.1 is frozen at P0 and remains source blind.

## Profile 0.405 evidence boundary

The runtime defers qualified S3 registration only while the referenced generic namespace is absent
and completes registration when it loads. This is a package-neutral optional-dependency contract; it
is not an rgl or ca identity rule. Table margins, table-to-data-frame expansion, data-frame
dimension-name replacement, and the two independently sourced contingency tables have flat,
integration, and recursive GNU R evidence. Browser graphics preserve numeric `pch` 32 through 255 as
deterministic single-byte scalar events; device font selection remains a documented host tolerance,
and larger positive codes warn and emit no point. `abbreviate()` remains capability-declared as
shape, not behavioral, because this increment proves the package path and core C-locale cases rather
than every method, locale, and character-class branch.

The unchanged ca 0.71.1 artifact passes every applicable generic package check and an independent
numeric scenario, reaching P7 for this pinned artifact only. This does not establish arbitrary
pure-R package compatibility or complete Base R. GNU R 4.6.0 supplies the 175/175 advisory recursive
result; GNU R 4.6.1 remains the normative release gate. Unopened nortest 1.0-4 is the next P0
source-blind holdout.

## Post-Profile 0.405 package-evidence boundary

Unchanged nortest 1.0-4 advances from metadata-frozen P0 to scoped P7 through the existing generic
pipeline. All five exports, installed examples, applicable checks, htest result structure, and
sample-size diagnostics are exercised without a new runtime primitive or package-specific branch.
This strengthens evidence for the existing 0.405 contract but does not broaden the declared semantic
capability surface or prove arbitrary pure-R package support. Unopened tensor 1.5.1 is the next P0
source-blind holdout; its archive remains unlisted and unevaluated.

## Profile 0.406 evidence boundary

Non-NULL `dim<-` replacement clears both `names` and `dimnames` before installing validated new
dimensions, including when the replacement repeats the existing extents. Other attributes remain
attached. NULL replacement removes `dim` and `dimnames`. Flat, integration, and exact recursive GNU
R evidence cover reshaping, unchanged extents, undimensioning, and unrelated-attribute retention.

This shared rule carries unchanged tensor 1.5.1 through installation, namespace loading, attachment,
all four exports, both documentation checks, its installed example, and an independent array
contraction scenario to scoped P7. The result does not establish complete array semantics or
arbitrary-package compatibility. GNU R 4.6.0 supplies the advisory 176/176 recursive result; GNU R
4.6.1 remains the normative release gate. Unopened registry 0.5-1 is the next P0 source-blind
holdout.

## Profile 0.407 evidence boundary

Callable `[[<-` is now a GNU R-shaped special primitive with a NULL formal list and ordinary S3/S4
replacement dispatch. The final unnamed argument is matched as `value`; one-dimensional atomic,
list/pairlist, environment, and language replacement, dimensional single-element replacement,
recursive list paths, deletion, extension, names, and type promotion use shared runtime machinery.
Flat, integration, and exact recursive GNU R evidence cover its public call shape and representative
replacement graph.

Installed source packages may expose browser-owned `demo/*.R` resources. `utils::demo()` now
catalogs them, reads optional `00Index` titles, attaches the package, decodes with package encoding,
and evaluates the selected script without host filesystem or network access. These two shared
contracts carry unchanged registry 0.5-1 through all documentation, examples, its retained package
test, vignette discovery, and an independent behavioral scenario to scoped P7. This does not prove
arbitrary-package compatibility. GNU R 4.6.0 supplies the advisory 177-case recursive result; GNU R
4.6.1 remains the normative release gate. Unopened corpcor 1.6.10 is the next P0 holdout.

## Profile 0.408 evidence boundary

For a finite real `n`-by-`p` input, `svd()` now diagonalizes the smaller symmetric Gram matrix:
`X'X` when `n >= p`, or `XX'` when `n < p`. The opposite singular-vector family is reconstructed
from `X`, the retained singular values, and the owned eigensystem. Requested `nu` and `nv` columns
are completed through the same deterministic orthonormal-basis contract, including wide inputs that
request more right vectors than the numerical rank. Result dimensions, reconstruction, and
orthogonality are covered by flat, integration, and exact recursive GNU R evidence. Complex inputs,
host BLAS/LAPACK identity, and bit-for-bit singular-vector signs remain outside the contract.

This shared bounded-allocation rule closes unchanged corpcor 1.6.10's first source-blind blocker
without raising the package-test vector ceiling. The pinned artifact installs, loads, attaches,
exposes all 29 declared exports, passes 16 documentation checks, all 13 installed Rd examples, and
the applicable absence checks for tests and vignettes. A separately authored scenario exercises all
exports and matches the GNU R black box across weighted statistics, decompositions, pseudoinverses,
matrix powers, positive-definite repair, fast SVD, and shrinkage estimators. The artifact reaches
scoped P7; this is not a claim of complete linear algebra or arbitrary-package compatibility. GNU R
4.6.0 supplies the advisory 178/178 recursive result; GNU R 4.6.1 remains the normative release
gate. Unopened vipor 0.4.7 is the next metadata-frozen P0 holdout.

## Profile 0.409 evidence boundary

Callable `split<-` now owns GNU R-shaped `x`, `f`, `drop = FALSE`, `...`, and `value` formals and
performs ordinary S3 replacement dispatch before the default path. The shared replacement path
supports atomic vectors, lists/pairlists, matrices, and data frames; preserves unselected values for
missing grouping entries; recycles group replacements; and retains names, dimensions, and data frame
row names through the existing subset machinery. Expression-vector replacement and wider
class-specific replacement contracts remain outside this increment.

`graphics::plot.default(las=)` now coerces a length-one graphical parameter, truncates finite
numeric input, and accepts only the GNU range zero through three. This is an admission and
validation contract at the current recorded-graphics boundary, not a claim of pixel-identical axis
text orientation. The version-3 XDR reader also recognizes ASCII, US-ASCII, ANSI_X3.4-1968, 646, and
ISO646-US as deterministic seven-bit native-encoding aliases and rejects bytes above `0x7f`; the
writer continues to declare UTF-8 and no host codec or locale authority is introduced. `stats::ave`
is now exported from its GNU namespace with `x`, `...`, and `FUN = mean` formals while remaining
available from the default attached search path.

These package-neutral contracts carry unchanged vipor 0.4.7 through installation, loading,
attachment, all 13 exports, 16 documentation checks, all 13 installed examples, the explicit
unavailable-Suggested test classification, both vignettes, and an independently authored scenario
that invokes every export and matches the GNU R black box. The pinned artifact reaches scoped P7;
this does not establish arbitrary-package compatibility or complete graphics and serialization.
Generated evidence contains 1,307 flat cases, 180 exact recursive graphs, and 430 recursively
evidenced bindings. All recursive graphs pass locally against advisory GNU R 4.6.0; GNU R 4.6.1
remains the normative release gate. The 86-artifact corpus has 71 passing, 14 blocked, and one
unevaluated artifact, including 32 at P7. Unopened dynamicTreeCut 1.63-1 is the next P0 holdout.

## Profile 0.410 evidence boundary

One-dimensional array sorting now follows the shared dimensional subset contract. The sorted value
reorders the sole dimname vector, retains `dim` when more than one element survives, and retains a
`table` class only while that dimension remains. Scalar and empty default subsets drop the sole
dimension; an empty selection retains `names = character(0)` when the source axis had dimnames. For
object inputs, `sort.default()` ignores `index.return` and `partial` as GNU R does. Table axis
labels use deparse level one, so an unnamed symbol supplies its name while an unnamed call supplies
the empty label. This increment does not claim complete `[.table` or arbitrary class-specific
subsetting.

`charmatch()` now provides exact-match precedence, duplicate and partial ambiguity, unique partial
matching, empty-string rules, atomic/list/factor character coercion, integer `nomatch` coercion, and
the GNU-shaped `NA_integer_` formal. Results intentionally drop input attributes. Flat and exact
recursive evidence cover these behaviors and reflection.

Those package-neutral contracts carry unchanged dynamicTreeCut 1.63-1 through installation,
namespace loading, attachment, all six exports, eight documentation steps, both installed examples,
explicit absent-test and absent-vignette checks, and a separately authored GNU R-matched scenario.
The deterministic artifact reaches scoped P7 without a package identity branch or source rewrite.
Generated evidence contains 1,309 flat cases, 182 exact recursive graphs, and 432 recursively
evidenced bindings. All recursive graphs pass locally against advisory GNU R 4.6.0; GNU R 4.6.1
remains the normative release gate. The 87-artifact corpus has 72 passing, 14 blocked, and one
unevaluated artifact, including 33 at P7. Unopened pixmap 0.4-14 is the next P0 holdout.

## Profile 0.411 evidence boundary

Registered `setAs()` conversions now receive the target class through `to` when their callable
accepts `to` or `...`, while retaining GNU R's observable `missing(to)` marker; one-argument
conversions remain unchanged. `new(child, parentObject, ...)` copies matching inherited S4 slots,
and methods-package `slot()` and `slot<-` provide named access, checked replacement, and GNU-shaped
formals. These are session-local, single-object contracts and do not claim the complete methods
package, multiple inheritance resolution, validity dispatch, or every S4 replacement path.

`graphics::image.default(..., asp=)` validates the scalar control and adjusts its recorded plot
window using the shared device-aspect calculation. Differential evidence covers the exact 7-by-7 PDF
window for a non-square image and GNU admission of zero, negative, and missing aspect values. This
does not claim pixel identity across arbitrary graphics devices.

The generic package-check planner classifies a saved-output transcript as not applicable when its
content begins with a GNU R version header and also identifies the Foundation copyright and host
platform lines. It records a deterministic reason and still executes the corresponding retained R
test. Portable `.Rout.save` resources remain exact normalized comparisons; this rule neither
pretends to emit a GNU startup banner nor silently counts a host-bound reference as passed.

Those package-neutral contracts carry unchanged pixmap 0.4-14 through namespace loading, attachment,
six documentation steps, four examples, and both retained tests. Its GNU R 4.5
version/platform/timing transcript is explicitly not applicable, while an independent GNU R 4.6.0
scenario covers constructors, S4 coercions, channels, indexed conversion, subsetting, and geometry.
Generated evidence contains 1,312 flat cases, 184 exact recursive graphs, and 437 recursively
evidenced bindings. The 88-artifact corpus has 73 passing, 14 blocked, and one unevaluated artifact,
including 34 at P7. Unopened moments 0.14.1 is the next P0 holdout. GNU R 4.6.1 remains normative.

## Profile 0.412 evidence boundary

The frozen unchanged moments 0.14.1 artifact passes the generic source-package pipeline without a
new runtime or package-system primitive. Evidence covers installed identity, namespace loading,
attachment, 13 documentation checks, all 12 installed Rd example topics, and explicit absent-test
and absent-vignette classification. A separately authored GNU R 4.6.0 black-box scenario invokes all
12 exports over vectors, matrices, and data frames, including raw and central moments, cumulants,
reconstruction, skewness, Pearson and Geary kurtosis, and four classed hypothesis tests.

The numeric comparison uses nine decimal places. Four high-order values have at most approximately
`4e-12` absolute and `3e-16` relative cross-implementation tail differences; structure, names,
classes, alternatives, methods, and data-name capture match exactly. This tolerance is explicit
evidence policy, not a package-specific computation path. No production code recognizes moments or
rewrites its source.

Because no reusable semantic gap was found, checked-in flat evidence remains 1,312 cases and Oracle
v2 remains 184 exact graphs covering 437 bindings. The 89-artifact corpus has 74 passing, 14
blocked, and one unevaluated artifact, including 35 at P7. Unopened RSpincalc 1.0.2 is the next P0
holdout. This scoped package result does not establish arbitrary pure-R or complete Base R
compatibility; GNU R 4.6.1 remains normative.

## Profile 0.413 evidence boundary

`base::apply` now traverses arbitrary-dimensional arrays using one or more ordered margin axes. Each
call receives the complementary vector, matrix, or array with applicable names/dimnames, and equal
atomic results reconstruct GNU-compatible dimensions and named dimnames. One new flat case and one
exact recursive graph cover scalar, multi-axis, all-axis, named-result, identity-slice, and
three-dimensional matrix-slice behavior. Oracle v2 now covers 438 recursively evidenced bindings.

This shared closure carries unchanged RSpincalc 1.0.2 through installation, loading, attachment, all
applicable package checks, its full runnable example set, and an independent GNU-matched
quaternion/rotation scenario. The 90-artifact corpus has 75 passing, 14 blocked, and one unevaluated
artifact, including 36 at P7. Unopened dichromat 2.0-1 is the next P0 holdout. This remains scoped
evidence, not arbitrary package or complete Base R compatibility; GNU R 4.6.1 remains normative.

## Profile 0.414 evidence boundary

`stats::predict` now dispatches serialized `loess` objects to a browser-native numeric method. The
implemented contract covers numeric matrix `newdata`, normalized predictors, degree-one/two local
polynomials, tricube neighborhoods, observation and robust weights, and returned row names. Flat and
exact recursive GNU evidence use a synthetic direct-surface quadratic fit. `se=TRUE`, generic
data-frame reconstruction, and exact kd-tree interpolate-surface evaluation remain explicit gaps;
serialized interpolate models currently use direct local reconstruction.

This shared method carries unchanged dichromat 2.0-1 through all applicable package checks and an
independent exact GNU-matched two-export scenario. The 91-artifact corpus has 76 passing, 14
blocked, and one unevaluated artifact, including 37 at P7. Unopened RUnit 0.4.33.1 is the next P0
holdout. GNU R 4.6.1 remains normative.

## Profile 0.415 evidence boundary

`base::all.equal.numeric` now accepts its direct method signature, positional or named tolerance,
scale and count controls, attribute controls, and GNU-compatible `countEQ` relative scaling.
`methods::isGeneric` reports registered and built-in methods generics and supports the documented
name-return shape. Exact recursive Oracle graphs cover both contracts.

These shared primitives carry unchanged RUnit 0.4.33.1 through every applicable generic check and an
independent all-export unit-check/tracker scenario. The 92-artifact corpus has 77 passing, 14
blocked, and one unevaluated artifact, including 38 at P7. Unopened ica 1.0-3 is the next P0
holdout. This does not claim all `all.equal.numeric` formatting/error edges or complete methods
introspection. GNU R 4.6.1 remains normative.

## Profile 0.416 evidence boundary

`stats::dexp` and central `stats::dt` now provide package-neutral numeric density contracts across
vector recycling, missing and non-finite inputs, invalid-domain warnings with calls, longest-input
attribute propagation, exact formals, and logarithmic output. Exact Oracle graphs also preserve the
observed signed-zero and attribute-order details. Non-central Student-t density remains an explicit
unsupported boundary.

These shared primitives carry unchanged ica 1.0-3 through every applicable package check and an
independent export/ACY/FastICA scenario. The 93-artifact corpus has 78 passing, 14 blocked, and one
unevaluated artifact, including 39 at P7. Unopened proto 1.0.0 is the next P0 holdout. This is
artifact-scoped evidence, not a claim of complete ICA input coverage. GNU R 4.6.1 remains normative.

## Profile 0.417 evidence boundary

`deparse()` and `deparse1()` now represent environment references without attempting value-to-AST
conversion and expose their GNU-shaped formals. `eapply()` covers own-binding enumeration,
`all.names`, `USE.NAMES`, non-hashed order, named empty results, lazy and active bindings,
`match.fun`-style resolution, and forwarded arguments. S3 subset dispatch retains the target's
source expression for `substitute()`; replacement dispatch retains GNU's `*tmp*` contract.

These shared contracts carry unchanged proto 1.0.0 through every applicable generic package check
and an independent inheritance, method-override, receiver-mutation, and list-conversion scenario.
The 94-artifact corpus has 79 passing, 14 blocked, and one unevaluated artifact, including 40 at P7.
Unopened NLP 0.3-3 is the next P0 holdout. Hashed-environment enumeration remains the runtime's
documented deterministic browser order rather than a promise of GNU hash-table internals. GNU R
4.6.1 remains normative.

## Profile 0.418 evidence boundary

`nargs()` reports the actual arguments supplied to the active closure, including synthetic `eval()`
frames. Builtin S3 dispatch for `merge()`, `subset()`, and `as.Date()` now installs the generic's
source call in the method frame and preserves lazy dots. Explicit `%Y-%m-%d` date conversion accepts
one- or two-digit month/day fields and maps invalid or incomplete values to `NA`; conversion without
an explicit format retains its existing stricter boundary. `strptime()` recognizes fractional `%OS`
seconds and numeric `%z` offsets for the evidenced layouts.

`write.dcf()` emits browser-owned record output to standard output, virtual files, or supported
connections with blank-record separators, missing-field omission, continuation indentation, and
`keep.white` handling. `seq()` accepts character-coercible endpoints and preserves the evidenced
integer/double storage distinction. These contracts carry unchanged NLP 0.3-3 to scoped P7. The
95-artifact corpus has 80 passing, 14 blocked, and one unevaluated artifact, including 41 at P7;
unopened timeSeries 4052.112 is the next P0 holdout. This does not claim arbitrary date formats,
complete DCF formatting parity, or comprehensive GNU R compatibility.

## Profile 0.419 time-series and pure-R package evidence

The shared runtime now preserves formal S4 vector identity through `exp`, `expm1`, and unary `!`,
falls back to a registered S4 generic when no first positional dispatch object exists, dispatches
`aggregate` before its default path, accepts the documented vector-valued `filter` method default,
and treats `prod(NULL)` as the empty double product. Stats adds browser-native `lowess` and `supsmu`
paths plus implicit-vector and two-column inputs for `smooth.spline`. Date/time parsing recognizes
`%j`, and `seq.POSIXt` supports evidenced fixed-second and UTC calendar steps.

The independently licensed `datasets::AirPassengers` object loads through the ordinary declarative
core-package resource path. These package-neutral contracts carry unchanged timeSeries 4052.112
through every applicable generic package-check step and an independent GNU R-matched scenario. The
96-artifact corpus has 81 passing, 14 blocked, and one unevaluated artifact, with 42 at P7. Unopened
pls 2.9-0 is the next source-blind P0 holdout. This remains artifact-scoped evidence, not a claim of
complete time-series, statistics, package, or GNU R compatibility.

## Profile 0.420 evidence-integrity and methods closure

`utils::tail.matrix` now exposes the GNU formals `x`, `n`, `keepnums`, `addrownums`, and `...`,
constructs padded row-number labels when row names are absent, honors `keepnums = FALSE`, and
implements the deprecated `addrownums` alias with its observed warning. `na.contiguous.ts` retains
the GNU-observed structural, `na.action`, `tsp`, and class attributes in observable order while
dismissing unrelated attributes.

The methods path promotes `getDataPart` and `setDataPart` to global S4 generics with the observed
message when a first method is installed, without converting unrelated ordinary or primitive
functions into implicit generics. Formal matrix subclasses use their atomic data part, newly
populated slots precede the formal class attribute, `cbind2` and `rbind2` expose `x`, `y`, and
`...`, and base bind dispatch gives a formal S4 binary method precedence over an S3 method name on
the same object. A matrix-backed S4 binary method that delegates back to base bind resumes through
the S3 method, matching package method chains without recursion. Oracle fixtures use GNU-valid
syntax and formal matrix class definitions while retaining the intended black-box assertions.

The checked-in flat suite is 1,360/1,360. The 232 recursive graphs cover 496 explicitly associated
behavioral or numeric bindings and pass against the available non-normative GNU R 4.6.0 advisor. The
96-artifact corpus remains 81 passing, 14 blocked, and one unopened holdout, including 42 at P7;
`pls` 2.9-0 remains the next source-blind P0 evaluation. GNU R 4.6.1 remains the normative release
gate, so this profile is not a claim of comprehensive GNU R or arbitrary-package compatibility.

## Profile 0.421 model, QR, and lazy graphics evidence

Data-frame row subsetting now preserves the `AsIs` wrapper on matrix-valued columns while retaining
matrix dimensions, dimnames, and compact row-name behavior. `terms.default` participates in normal
S3 discovery, `model.matrix` and `model.matrix.default` expose their observed public formals, and
character formula updates follow the shared formula path. Householder QR now uses the observed
LINPACK-compatible sign convention, and `qr.qy`, `qr.qty`, `backsolve`, and `forwardsolve` share
that representation. These are observable contracts, not merely equivalent numeric decompositions.

`matplot` exposes its public formals and keeps `panel.first` and `panel.last` lazy. A new plot page
and window exist before `panel.first` is forced; series geometry precedes `panel.last`. This closes
the unchanged `simpls.fit` example without recognizing `pls` or evaluating generated JavaScript. The
wider `matplot` surface remains limited to the declared shape/graphics-journal contract.

The checked-in flat suite passes 1,371/1,371. All 241 recursive graphs pass exactly against the
available non-normative GNU R 4.6.0 advisor and cover 514 explicitly associated behavioral or
numeric bindings. Unchanged `pls` 2.9-0 reaches scoped P7 through the generic pipeline, including 43
exports, all applicable installed examples, its installed vignette, and independent yarn and
mayonnaise scenarios. The corpus now contains 97 releases: 82 passing, 14 blocked, and one
unevaluated; 43 are at P7. Unopened `stargazer` 5.2.3 is the next frozen P0 holdout. GNU R 4.6.1
remains the normative release gate.

## Profile 0.422 distribution, core-data, and bind evidence

The browser-owned `datasets::attitude` object now follows the ordinary declarative data-resource
path, with independently sourced provenance and exact shape, storage, value, aggregate, namespace,
and search-path evidence. `stats::pf` implements central F probabilities with vector recycling,
missing propagation, lower and upper tails, logarithmic output, and finite or infinite degrees of
freedom. Non-central F probabilities remain explicitly outside this increment.

Base `cbind` and `rbind` now let a matrix establish the binding extent while ordinary vectors are
recycled or truncated to that extent, matching GNU R even when a vector is longer than the matrix.
Zero-length vectors are ignored when a positive extent exists, retain an empty row or column when
the extent is zero, and preserve common output type. Multiple matrix inputs must still agree on the
non-binding dimension.

These reusable contracts carry unchanged `stargazer` 5.2.3 through installation, loading,
attachment, complete export documentation, its full installed example, and an independently authored
exact regression-table scenario. Checked-in flat conformance passes 1,374/1,374, while all 244
recursive graphs pass exactly against the available non-normative GNU R 4.6.0 advisor and cover 516
explicitly associated behavioral or numeric bindings. The corpus contains 98 releases: 83 passing,
14 blocked, and one unevaluated; 44 are at P7. Unopened `lgr` 0.5.2 is the next source-blind P0
holdout. GNU R 4.6.1 remains the normative release gate, so this scoped artifact evidence is not a
claim of complete statistics, package, or GNU R compatibility.

## Profile 0.423 formatting, path-extension, and logging-package evidence

Base `format`/`format.default` now accepts language and recursive values through GNU-shaped formals,
while `strtrim` provides vectorized width recycling, coercion, missing propagation, character
attribute retention, and deterministic browser Unicode display-width trimming. `tools::file_ext`
implements package-neutral portable path-extension extraction. Package-check classification may mark
an example not applicable only when its concrete failure names an unavailable package declared in
`Suggests`; mandatory or undeclared namespace failures remain blockers.

These contracts carry unchanged `lgr` 0.5.2 through all applicable generic package-check steps and
an independent GNU-matched in-memory Logger/AppenderBuffer scenario. Flat conformance passes
1,377/1,377 and all 247 recursive graphs pass exactly against the available non-normative GNU R
4.6.0 advisor, covering 519 explicitly associated behavioral or numeric bindings. The 99-release
corpus has 84 passing, 14 blocked, and one unevaluated artifact; 45 are at P7. Unopened
`operator.tools` 1.6.3.1 is the next source-blind P0 holdout. GNU R 4.6.1 remains the normative
gate; this evidence does not claim optional `lgr` integrations or arbitrary-package compatibility.

## Profile 0.424 Base options and operator-package evidence

The base environment now owns a locked `.Options` pairlist from session construction onward. Its
GNU-shaped core entries are synchronized with `options()` updates and removals in both the base
environment and base namespace, reset restores a fresh session value, and ordinary replacement
syntax may still create a user-environment shadow without mutating the locked base binding.

This package-neutral contract carries unchanged `operator.tools` 1.6.3.1 through all applicable
generic package checks and an independent GNU-matched operator registration/classification scenario.
Flat conformance passes 1,378/1,378 and all 248 recursive graphs pass exactly against the available
non-normative GNU R 4.6.0 advisor, covering 519 explicitly associated callable bindings. The
100-release corpus has 85 passing, 14 blocked, and one unevaluated artifact; 46 are at P7. Unopened
`stabledist` 0.7-2 is the next source-blind P0 holdout. GNU R 4.6.1 remains normative; this scoped
evidence is not a claim of arbitrary-package or comprehensive GNU R compatibility.

## Profile 0.425 empirical distributions, reusable graphics, and stable-package evidence

`stats::uniroot` now accepts explicit `lower` and `upper` bounds when `interval` is omitted and
permits infinite endpoint function values while continuing to reject missing or `NaN` results.
`stats::ecdf` returns an observable GNU-shaped `ecdf`/`stepfun` closure: its formals, body,
environment bindings, call attribute, missing-value removal, endpoint behavior, and `NA` versus
`NaN` results have exact differential evidence. `stats::plot.ecdf` dispatches through the ordinary
graphics S3 path and records horizontal steps, optional vertical jumps, points, and zero/one
reference lines. `graphics::rug` records finite edge ticks with clipping warnings, and
`grDevices::adjustcolor` applies general 4-by-4 RGBA transforms and offsets.

These package-neutral contracts carry unchanged `stabledist` 0.7-2 through every applicable generic
package-check step and an independently authored GNU-matched density, probability, quantile, mode,
and random-generation scenario. The quantile comparison declares a 5e-6 numeric tolerance; no
expected value is substituted into production. Flat conformance passes 1,379/1,379, and the new
exact recursive graph passes against the available non-normative GNU R 4.6.0 advisor. All 249
recursive graphs pass exactly against that advisor and cover 524 explicitly associated behavioral or
numeric bindings. The 101-release corpus has 86 passing, 14 blocked, and one unevaluated artifact;
47 are at P7. Unopened `formula.tools` 1.7.1 is the next source-blind P0 holdout. GNU R 4.6.1
remains the normative release gate, and this scoped evidence is not a claim of arbitrary-package
compatibility.

## Profile 0.426 formula-language and unchanged-package evidence

The shared runtime now provides `utils::apropos` search-path discovery with mode and location
filtering, expression-vector `[<-` and `[[<-` replacement with language values, and exported
`stats::terms.formula` model metadata and dot expansion. `as.name` and `as.symbol` preserve symbol
identity and otherwise coerce the first element of a nonempty atomic vector; factors use their
underlying integer code and missing atomic values produce the symbol `NA`. Recursive and zero-length
inputs remain deterministic errors. Language deparsing uses GNU-compatible compact spacing for `/`,
`^`, `:`, `%%`, and `%/%` while retaining spaces around ordinary infix operators.

These package-neutral contracts carry unchanged `formula.tools` 1.7.1 through the complete
applicable generic package-check plan and an independently authored GNU-matched scenario covering
every ordinary public export plus formula character conversion and package-defined `terms` dispatch.
Its source SHA-256 is `4fe0e72d9d96f2398e86cbd8536d0c84de38e5583d4ff7dcd73f415ddd8ca395`; the
deterministic installed artifact SHA-256 is
`bce730059c494ed09405ed5e5e5e81bdfc2a0ccfe7785b750d136d9c53415be5`. The retained `testthat` launcher
is deterministically not applicable because that declared Suggested dependency is unavailable, and
the package has no vignette surface.

Flat conformance passes 1,381/1,381. The new recursive graph passes exactly against the available
non-normative GNU R 4.6.0 advisor; the inventory now has 250 graphs covering 525 explicitly
associated behavioral or numeric bindings. The 102-release corpus has 87 passing, 14 blocked, and
one unevaluated artifact; 48 are at P7. Unopened `gridBase` 0.4-7 is the next source-blind P0
holdout. GNU R 4.6.1 remains normative, and this scoped evidence is not a claim of arbitrary-package
or comprehensive GNU R compatibility.

## Profile 0.427 grid viewport, graphical-parameter, and package evidence

The browser-admissible `grid` contract now includes exported `current.transform()`, inherited
`get.gpar()`, and reusable `rectGrob()`/`grid.rect()` behavior. Viewport transforms are expressed as
GNU-shaped 3-by-3 double matrices in device inches, nested geometry controls unit conversion, and
graphical parameters preserve the documented defaults, requested order, duplicate names, viewport
inheritance, and cumulative `cex`, `alpha`, and `lex`. Base graphics now accepts two- or four-value
`par(mfg=)`, synchronizes `mfrow`/`mfcol`, and reports mismatched supplied layout dimensions without
using them.

The unchanged `gridBase` 0.4-7 source archive reaches scoped P7 through those shared primitives. It
passes installation, namespace loading, attachment, export documentation, both installed example
topics, absent-test classification, its installed vignette, and a separately authored scenario
covering all five exports. Source SHA-256 is
`be8718d24cd10f6e323dce91b15fc40ed88bccaa26acf3192d5e38fe33e15f26`; installed artifact SHA-256 is
`41a4dd801b19b29fe882380b2f510986fbb99b6e2fa3ce805489c00e316f7bd7`.

Flat conformance passes 1,385/1,385. The added recursive graph passes exactly against the available
non-normative GNU R 4.6.0 advisor; the inventory has 251 graphs and 532 explicit binding
associations. The 103-release corpus has 88 passing, 14 blocked, and one unevaluated artifact,
including 49 at P7. Unopened `gsubfn` 0.7 is the next source-blind P0 holdout. GNU R 4.6.1 remains
normative, and this evidence does not claim arbitrary-package or comprehensive GNU R compatibility.

## Profile 0.428 lifecycle-hook classification and gsubfn first blocker

The generic package-check planner no longer treats `.onLoad`, `.onAttach`, `.onUnload`, `.onDetach`,
`.First.lib`, or `.Last.lib` as ordinary exported APIs requiring standalone help aliases. A
synthetic package fixture verifies this package-neutral lifecycle classification.

The unchanged `gsubfn` 0.7 run passes installation, namespace loading, attachment, documentation,
two installed examples, absent-test classification, and its vignette. It reaches development P4 with
artifact SHA-256 `296a095209abaad70ec1ee5c2e9d1936e0797cd1f7c09818f9298a75fce52f03`; missing
browser-owned `datasets::BOD` in `example:fn` is its ordered first blocker. The 103-release corpus
has 88 passing and 15 blocked artifacts, 49 at P7, and no unopened holdout. GNU R 4.6.1 remains
normative.

## Profile 0.429 data, formula, graphics, optimization, and package evidence

Independent data provenance and exact shape/value evidence cover browser-owned `datasets::BOD` and
the grouped `datasets::CO2` object. Generic `aggregate.data.frame` behavior now covers multiple
groups, missing grouping values, factor order, every input column, and fixed-width vector results.
Compound formula language survives variable discovery and formula-to-function conversion without
generated JavaScript. `matplot()` admits the complete standard type alphabet, `optim(method = "CG")`
covers its three standard update choices, and `rep()` accepts the GNU-observed atomic count coercion
surface.

Flat conformance passes 1,392/1,392. The recursive Oracle v2 inventory has 257 exact graphs and 533
explicit behavioral/numeric binding associations; the new focused graphs pass against the available
non-normative GNU R 4.6.0 advisor. Unchanged `gsubfn` 0.7 now passes six installed example topics;
its ordered first blocker is `example:list`, where `month.day.year` belongs to the unresolved
Suggested `chron` package. The corpus remains 103 releases, 88 passing and 15 blocked, with 49 at
P7. GNU R 4.6.1 remains normative.

## Profile 0.430 selected optional dependencies and lookup closure

Pure-R repository resolution has three explicit Suggests modes: none, all, or a validated selected
set. Selected names must be declared within the traversed closure, duplicates and conflicting modes
are rejected, mandatory transitive dependencies retain ordinary resolution, and lock format v2
records the sorted policy. A selected optional package is still subject to the same archive and
browser-admissibility checks as every mandatory dependency.

The `gsubfn`/`chron` probe demonstrates the phase boundary: current `chron` declares compilation and
a native dynamic library, so the pure-R installer rejects it with those concrete issues. Default
`gsubfn` installation records mode none and contains only `proto` and `gsubfn`. Generic
`isOpen(rw=)` partial selection makes `read.pattern` pass, and mode-filtered inherited environment
lookup closes an additional combine-list path without a package-specific branch.

Flat evidence is 1,394/1,394; 1,337 cases are live-R eligible. Recursive Oracle v2 is 260/260 graphs
with 536 distinct explicitly evidenced behavioral/numeric bindings. The recursive addition moves a
list-valued `utils::combn` contract out of the atomic Oracle v1 transport and verifies callback
simplification dimensions. The 103-release corpus remains 88 passing, 15 blocked, and 49 at P7.
`gsubfn` remains P4 at the deterministic `example:list` optional-native dependency blocker; GNU R
4.6.1 remains normative.

The next metadata-only package gate is unopened `tinytable 0.18.0`, selected from the complete
official metadata filter at 21,458 downloads in the fixed 2026-07-27 through 2026-08-25 window after
the documented browser-purpose and already-evaluated-dependency exclusions. Its only mandatory
package import is browser-core `methods`; the 440,097-byte archive is pinned by SHA-256
`83a69d454d2c9333cd4d54bb6c12bc6970d034545c17b260fe4a87e6be04324c` and remains unlisted,
unextracted, unparsed, uninstalled, and unevaluated. The corpus therefore contains 104 releases: 88
passing, 15 blocked, one unevaluated, and 49 at P7.

## Profile 0.431 S4, ellipsis, and optional-package closure

The unchanged `tinytable 0.18.0` rotation closed two reusable runtime contracts before completing
its package surface. S4 slot replacement now respects `NULL` class unions, `ANY`, unchecked
replacement, and subsequent validity diagnostics. `...names()` exposes lazy dots names without
forcing values. Both contracts have flat, integration, live-R, and exact recursive evidence.

Package artifacts preserve both `Suggests` and `Enhances`. Neither category is installed by default,
but example and retained-test failures are classified as not applicable only when the diagnostic
names a dependency declared on one of those optional edges. Backtick-form install diagnostics are
recognized generically; an undeclared package with the same wording remains a failure. The rule has
no package identity branch and does not turn `Enhances` into a mandatory dependency.

The fixed tinytable source and artifact now reach regression P7: all applicable install, namespace,
attachment, documentation, example, and retained-test checks pass, absent vignettes are explicit,
and an independently authored S4 formatting/styling composition matches advisory GNU R 4.6.0. The
104-release corpus is 89 passing and 15 blocked, with 50 at P7 and no unevaluated holdout. Flat
evidence is 1,397/1,397 (1,340 live eligible); recursive Oracle v2 is 262/262 with 539 explicitly
associated bindings. GNU R 4.6.1 remains the normative gate.

## Profile 0.432 array, replacement, callable, and package closure

Primitive `rep()` accepts and lazily routes extra dots through S3 methods while its default path
ignores unmatched extras. `stats::optim(method = "SANN")` has reusable proposal, count, control, and
optional Hessian behavior; `noquote()` exposes GNU-shaped class and formal semantics. Coordinate
matrices are admitted only when their column count equals the target dimensionality. Empty
replacement selections still perform atomic storage promotion, replacement values are evaluated
before subscripts, chained replacements reload the post-RHS target, and a wholly missing linear
subscript is an identity operation for an array, including `dim`, `dimnames`, and custom attributes.

The package-test profile's per-vector ceiling is four million elements, sufficient for bounded
browser-applicable retained tests without changing the one-million-element interactive default. The
unchanged `magic 1.6-1` artifact passes the complete applicable generic package-check plan and an
independent GNU-matched scenario. Flat evidence is 1,404/1,404 with 1,347 live-R-eligible cases;
recursive evidence is 269/269 exact graphs with 541 explicitly associated bindings. The 105-release
corpus is 90 passing and 15 blocked, with 51 at P7. This remains scoped evidence, not a claim of
arbitrary-package or comprehensive GNU R compatibility; GNU R 4.6.1 remains normative.

The accompanying name inventory reports 1,189 registered bindings and 1,088 overlaps out of 2,522
reference callable names; overlap is not promoted to behavioral evidence.

## Profile 0.433 inherited data-frame coercion closure

`as.data.frame()` follows ordinary S3 inheritance across every declared class. A more-specific
method such as `as.data.frame.tbl_df` or `as.data.frame.tbl` wins when present; otherwise an object
whose class vector ends in `data.frame` reaches `as.data.frame.data.frame`. That inherited method
preserves columns, row names, automatic-row-name state, names, and unrelated attributes while
reducing the class vector to exactly `data.frame`. An explicit non-NULL `row.names` value is
validated and replaces the stored row names; `NULL` preserves them. Extra generic controls carried
through `...`, including `optional`, do not prevent inherited fallback.

Flat, integration, and exact recursive black-box evidence covers subclass removal, custom-attribute
preservation, explicit row names, atomic one-column extraction after coercion, first-applicable S3
selection, and the method's public formals. The unchanged `countrycode 1.9.0` artifact passes its
complete applicable generic package-check plan and an independent conversion/dictionary/resource
scenario after this shared fix. Flat evidence is 1,405 cases, recursive Oracle v2 is 270 graphs with
544 distinct binding associations, and the 106-release corpus is 91 passing and 15 blocked, with 52
at P7. These remain scoped executable claims; GNU R 4.6.1 remains normative.

## Profile 0.434 Brent root-finding closure

`stats::uniroot()` implements the browser-admissible Brent contract with callback behavior visible
to R code. Interpolation admission compares against the actual step taken in the preceding iteration
rather than a stale pre-interpolation bracket width. The returned `estim.prec` is the absolute final
bracket width. After selecting the root, the callable is invoked once more at that exact value and
the result becomes `f.root`; mutations performed by that final call are observable.

Integration and flat evidence pins the exact evaluation sequence for a nonlinear exponential root,
including the bisection/interpolation decisions, iteration count, precision, and final repeated
callback. An exact recursive Oracle v2 graph preserves the result list and evaluation trace. The
unchanged `implied 0.5` artifact then passes every applicable package-check step and a separately
frozen scenario spanning all eight documented odds-to-probability algorithms plus inverse power
conversion. Flat evidence is 1,406 cases, recursive Oracle v2 is 271 graphs with 544 distinct
binding associations, and the 107-release corpus is 92 passing and 15 blocked, with 53 at P7. GNU R
4.6.1 remains normative.

## Profile 0.435 sfsmisc namespace progression

The package selector accepts safe unbraced and nested `if` declarations in NAMESPACE files and
evaluates only a closed, non-executing platform predicate grammar. Browser selection owns an
explicit target OS and never evaluates package-provided R or JavaScript while choosing imports and
exports.

Reusable runtime additions cover browser PDF-backed `grDevices::cairo_pdf`, platform-shaped
`grSoftVersion`, aspect-aware `n2mfrow`, `graphics::frame`, central `dchisq`, `dgamma`, `qgamma`,
`dummy.coef` dispatch, `loess.control`, `na.exclude`, and callable left- and right-continuous
`stepfun` closures. `postscript`, `loess` fitting, and multi-panel `plot.ts` expose GNU-shaped
formals but fail deterministically at explicit browser capability boundaries; they are API graded,
not behavioral claims. Central `dchisq` deliberately does not claim non-central support.

The unchanged `sfsmisc 1.1-25` artifact parses every R source and reaches P1. Namespace loading now
stops at the next shared missing import, `stats::symnum`. Checked-in flat conformance is 1,420/1,420
with 1,363 live-R-eligible cases; recursive Oracle v2 is 282/282 graphs with 556 distinct explicit
binding associations. GNU R 4.6.1 remains normative.

## Profile 0.436 symbolic matrices and formula update closure

`stats::symnum` behaviorally encodes numeric, correlation, and logical vectors and arrays into
`noquote` character objects. The shared contract covers sorted and correlation-augmented cutpoints,
right-closed intervals, endpoint tolerance, special minimum/maximum labels, NA coding, legend
construction, attribute preservation, lower-triangular masking, deterministic column abbreviation,
and complete public formals.

`stats::update.formula` performs recursive dot substitution on both formula sides, applies formula
term addition/removal and interaction algebra, retains the old formula environment, and exposes the
GNU `old, new, ...` callable shape. Formula objects also follow their language representation
through `as.list`, including class and `.Environment` attributes. The unchanged `sfsmisc 1.1-25`
artifact remains at P1; namespace loading now stops at missing `utils::count.fields`.

Checked-in flat conformance is 1,422/1,422 with 1,365 live-R-eligible cases; recursive Oracle v2 is
284/284 graphs with 559 distinct explicit binding associations. GNU R 4.6.1 remains normative.

## Profile 0.437 browser-owned field-counting closure

`utils::count.fields` is behavioral for browser-owned paths and supported text connections. Its
contract covers exact public formals, whitespace and single-character separators, explicit empty
fields, the first supplied quote-set and separator controls, comment termination, skip and
blank-line controls, connection cursor/lifecycle behavior, integer/`NULL` return shape, and
deterministic validation. Multiline quoted records expose physical-line `NA` entries followed by the
complete logical-record width on the terminating line.

The unchanged `sfsmisc 1.1-25` artifact imports this shared implementation without source changes,
remains at P1, and now stops at missing `tools::Rcmd`. Checked-in flat conformance is 1,423/1,423
with 1,366 live-R-eligible cases; recursive Oracle v2 is 285/285 graphs with 561 distinct explicit
binding associations. GNU R 4.6.1 remains normative.

## Profile 0.438 tools command-driver boundary and sfsmisc P4

`tools::Rcmd` is API graded with exact `args, ...` formals. Its desktop behavior launches the host R
command driver, so browser calls fail deterministically with `NRU6256`; no GNU R executable, shell
substitute, or generated command execution is embedded. This is an explicit browser non-
applicability rule rather than a behavioral compatibility claim.

The unchanged `sfsmisc 1.1-25` artifact now passes parsing, namespace load, attachment, complete
export/help discovery, and representative installed examples through P4. Its first P5 blocker is
`example:D1D2`: `plot()` currently rejects the non-real coordinate shape reaching the shared plot
contract. Checked-in flat conformance is 1,424/1,424 with 1,366 live-R-eligible cases; recursive
Oracle v2 remains 285/285 graphs with 561 explicit behavioral/numeric bindings. GNU R 4.6.1 remains
normative.

## Profile 0.439 function S3 plotting and sfsmisc blocker progression

`graphics::plot.function` now closes the reusable closure-dispatch contract through the existing
curve and plot pipeline. Exact formals, endpoint precedence, vectorized callback evaluation,
invisible coordinate results, graphical-control forwarding, and `seq.int`-compatible coordinate
storage are executable evidence rather than package-specific behavior.

The unchanged `sfsmisc 1.1-25` artifact now passes `example:D1D2`. It remains at P4 and freezes its
next P5 blocker at `example:D2ss`, where `smooth.spline` exceeds the explicitly documented
256-unique-observation browser limit. Checked-in flat conformance is 1,426/1,426 with 1,368
live-R-eligible cases; recursive Oracle v2 is 286/286 graphs with 563 distinct explicit
behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.440 bounded large smoothing splines and sfsmisc progression

Large default `stats::smooth.spline` calls now use a bounded deterministic knot basis and expand the
fit back to all supplied coordinates. Full public observation, fitted-value, leverage, class, and
derivative-prediction shapes are covered by flat and exact recursive GNU black-box evidence;
explicit knot requests beyond 256 remain an honest browser resource boundary.

The unchanged `sfsmisc 1.1-25` artifact now passes `example:D2ss` and remains at P4. Its next P5
blocker is `example:Duplicated`, where `base::match` does not yet accept the standard
`incomparables` argument. Checked-in flat conformance is 1,427/1,427 with 1,369 live-R-eligible
cases; recursive Oracle v2 is 287/287 graphs with 565 distinct explicit behavioral/numeric bindings.
GNU R 4.6.1 remains normative.

## Profile 0.465 reusable self-start nonlinear models

First-class callables may carry observable attributes, allowing a `selfStart` model's `initial`
callable and parameter names to travel through ordinary lookup and invocation. `getInitial()` now
applies this protocol generically, and `nls()` uses the resulting named numeric vector when `start`
is omitted. The initial admitted model is `stats::SSfol`; `predict.nls()` supports fitted values and
value-only evaluation over ordinary `newdata`. Prediction gradients, standard errors, and intervals
remain outside this profile. The unchanged `sfsmisc` `example:plotDS` passes and the next blocker is
`example:potatoes`, where `ftable()` rejects an admitted table-like input. The artifact remains at
P4. Checked-in flat conformance is 1,462/1,462 with 1,403 live-R-eligible cases; recursive Oracle v2
is 320/320 graphs. GNU R 4.6.1 remains normative.

## Profile 0.441 match exclusions and sfsmisc progression

`base::match(incomparables=)` now has exact public formals and behavioral evidence across atomic,
recursive, coercion, missing-value, and legacy-`FALSE` paths. The unchanged `sfsmisc 1.1-25`
artifact passes `example:Duplicated` and remains at P4. Its next P5 blocker is `example:QUnif`,
where `plot.default` does not yet admit graphical control `xpd`. Checked-in flat conformance is
1,428/1,428 with 1,370 live-R-eligible cases; recursive Oracle v2 is 288/288 graphs. GNU R 4.6.1
remains normative.

## Profile 0.442 `plot.default(xpd=)` admission and sfsmisc progression

`graphics::plot.default` now admits GNU R's measured scalar `xpd` control surface, including
logical, missing, numeric, recursive, and `NULL` values, rejects zero- and multi-length values, and
does not persist the inline control into `par("xpd")`. This closes the unchanged `sfsmisc 1.1-25`
`example:QUnif` blocker without package-specific code. The artifact remains at P4 and now stops at
`example:TA.plot`, where the standard `stack.x` helper is absent. Checked-in flat conformance is
1,429/1,429 with 1,371 live-R-eligible cases; recursive Oracle v2 is 289/289 graphs. Extended
figure/device clipping outside the plot region remains a separately documented graphics-depth gap;
this increment does not claim it. GNU R 4.6.1 remains normative.

## Profile 0.443 stack-loss core data and sfsmisc progression

The browser-owned `datasets` catalog now exposes `stackloss`, `stack.x`, and `stack.loss` from a
pinned public-domain statsmodels resource. Exact flat and recursive evidence covers the full 21-by-4
data frame, 21-by-3 predictor matrix, 21-element response, their double storage, labels, aggregates,
namespace identity, and exact projections. This closes the first `example:TA.plot` object lookup in
unchanged `sfsmisc 1.1-25`; the example now continues until the next missing core dataset,
`airquality`. Checked-in flat conformance is 1,430/1,430 with 1,372 live-R-eligible cases; recursive
Oracle v2 is 290/290 graphs. GNU R 4.6.1 remains normative.

## Profile 0.444 `airquality` core data and sfsmisc progression

The browser-owned `datasets` catalog now exposes the complete 153-by-6 `airquality` data frame from
a pinned PDDL-1.0 csvbase resource. Exact flat and recursive evidence covers column and row shape,
integer/double storage, missing-value counts, aggregates, endpoint observations, row names, and
namespace identity. This closes the missing-object failure in unchanged `sfsmisc 1.1-25`;
`example:TA.plot` is now not applicable because it requires unavailable Suggested package `nlme`,
and the ordered first P5 blocker advances to `example:axTexpr`, where `:` rejects a non-finite
endpoint. Checked-in flat conformance is 1,431/1,431 with 1,373 live-R-eligible cases; recursive
Oracle v2 is 291/291 graphs. GNU R 4.6.1 remains normative.

## Profile 0.445 logarithmic axis state and sfsmisc progression

Recorded graphics windows now synchronize `usr`, `xaxp`, `yaxp`, `xlog`, and `ylog`, and
`graphics::axTicks` consumes the active logarithmic state through the shared axis-tick generator.
Exact evidence covers the documented logarithmic plot shape, linear y-axis parameters, logical scale
flags, logarithmic x ticks, and exponent bounds. This closes unchanged `sfsmisc 1.1-25`
`example:axTexpr`; the ordered first P5 blocker advances to `example:compresid2way`, where
`stats::dummy.coef` has no applicable method for class `c("aov", "lm")`. Checked-in flat conformance
is 1,432/1,432 with 1,374 live-R-eligible cases; recursive Oracle v2 is 292/292 graphs. GNU R 4.6.1
remains normative.

## Profile 0.446 model dummy coefficients and sfsmisc progression

The standard `stats::dummy.coef` generic now dispatches to a reusable `dummy.coef.lm` method. The
method expands fitted coefficients over original factor levels using model-matrix assignments and
contrast metadata, preserves the documented `dummy_coef`/`matrix` result contract, and distinguishes
zero-filled from `NA` aliases through `use.na`. Exact flat and recursive GNU R evidence covers these
contracts. The unchanged `sfsmisc 1.1-25` `example:compresid2way` passes; its first P5 blocker
advances to `example:eaxis`, where `base::format.info` is unavailable. Checked-in flat conformance
is 1,433/1,433 with 1,375 live-R-eligible cases; recursive Oracle v2 is 293/293 graphs. GNU R 4.6.1
remains normative.

## Profile 0.447 atomic formatting information and sfsmisc progression

`base::format.info` now exposes GNU-shaped atomic widths and numeric fixed/exponential display
metadata across storage types, missing and infinite values, complex components, `digits`, `nsmall`,
and `scipen`. Exact flat and recursive evidence covers the public contract. The unchanged
`sfsmisc 1.1-25` `example:eaxis` advances to `hist.default(..., xaxt=)`, which remains outside the
browser histogram subset. Checked-in flat conformance is 1,434/1,434 with 1,376 live-R-eligible
cases; recursive Oracle v2 is 294/294 graphs. GNU R 4.6.1 remains normative.

## Profile 0.448 histogram axis controls and sfsmisc progression

`hist.default` and `plot.histogram` now honor standard and suppressed `xaxt`/`yaxt` axis styles
through the reusable device-recording path, with exact validation, persistent-state neutrality, and
plot-disabled laziness evidence. The unchanged `sfsmisc 1.1-25` `example:eaxis` passes and its first
blocker advances to `example:formatN`. Checked-in flat conformance is 1,435/1,435 with 1,377
live-R-eligible cases; recursive Oracle v2 is 295/295 graphs. GNU R 4.6.1 remains normative.

## Profile 0.449 numeric scientific penalties and sfsmisc progression

`base::format` now accepts logical force values and finite numeric `scientific` penalties, truncates
fractional penalties, inherits missing values from `scipen`, and rejects invalid type, length, and
`NULL` controls. The unchanged `sfsmisc 1.1-25` `example:formatN` passes; its first blocker advances
to missing `stats::ksmooth` in `example:hatMat`. Checked-in flat conformance is 1,436/1,436 with
1,378 live-R-eligible cases; recursive Oracle v2 is 296/296 graphs. GNU R 4.6.1 remains normative.

## Profile 0.450 kernel regression and sfsmisc progression

`stats::ksmooth` now provides reusable box and quartile-scaled normal Nadaraya-Watson estimates,
sorted explicit points, generated grids, exact formals, and deterministic validation. The unchanged
`sfsmisc 1.1-25` `example:hatMat` is now not applicable only because Suggested package `Matrix` is
unavailable; its first blocker advances to the browser file/PDF lifecycle in `example:helppdf`.
Checked-in flat conformance is 1,437/1,437 with 1,379 live-R-eligible cases; recursive Oracle v2 is
297/297 graphs. GNU R 4.6.1 remains normative.

## Profile 0.451 browser-owned help PDF output and sfsmisc progression

Resolved `help_files_with_topic` objects with `help_type = "pdf"` now print to a valid, bounded PDF
in the session-owned virtual working directory. This browser-admissible substitute uses the generic
installed Rd/core help renderer, performs no host-process or network access, and exposes the result
through ordinary virtual-file APIs. Exact GNU black-box evidence pins `stats::Normal` topic
resolution; browser-specific flat and Worker integration evidence pins PDF visibility and signature.
The unchanged `sfsmisc 1.1-25` `example:helppdf` passes, and its first blocker advances to
`example:inv.seq`. Checked-in flat conformance is 1,439/1,439 with 1,380 live-R-eligible cases;
recursive Oracle v2 is 298/298 graphs with 573 explicitly evidenced behavioral/numeric bindings. An
advisory full-flat run also exposed and closed an older `getElement` deviation: classed values are
now extracted exactly without S3 `[[` dispatch. GNU R 4.6.1 remains normative.

## Profile 0.452 language equality and sfsmisc progression

Two language objects now compare through GNU-shaped deparsed call text under `all.equal`, while
`identical` continues to compare their structure. This covers parsed versus programmatically
constructed unary-negative ranges, ordinary call-attribute neutrality, and unequal deparse results
with exact flat, recursive, and integration evidence. The unchanged `sfsmisc 1.1-25`
`example:inv.seq` passes, and its first blocker advances to `example:iterate.lin.recursion`, where
the browser graphics subset lacks `plot.ts` multi-panel rendering. Checked-in flat conformance is
1,440/1,440 with 1,381 live-R-eligible cases; recursive Oracle v2 is 299/299 graphs with 573
explicitly evidenced behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.453 regular plot.ts routing and sfsmisc progression

`stats::plot.ts` has exact flat, recursive GNU black-box, and integration graphics evidence for
univariate regular series and multivariate `plot.type = "single"` rendering. The implementation
reuses the existing `ts.plot` alignment and browser graphics path, retains invisible `NULL`, window
state, styling, axes, and annotations, and keeps true multi-panel and two-series phase plots as
explicit incomplete contracts. The unchanged `sfsmisc 1.1-25` `example:iterate.lin.recursion`
passes; its first blocker advances to `example:linesHyperb.lm` and incomplete reusable `predict.lm`
rank-deficiency behavior. Checked-in flat conformance is 1,441/1,441 with 1,382 live-R-eligible
cases; recursive Oracle v2 is 300/300 graphs with 574 explicitly evidenced behavioral/numeric
bindings. GNU R 4.6.1 remains normative.

## Profile 0.454 partial model arguments and finite log windows

`stats::predict` now matches `new=` and `newd=` uniquely to the linear-model `newdata` argument,
while duplicate positional/named matches and ambiguous `n=` calls remain errors. Logarithmic plot
windows cap expansion at GNU R's finite upper graphics exponent, keeping axis parameters and ticks
finite when later data values overflow but an earlier finite range remains drawable. Exact flat,
recursive GNU black-box, integration, and unchanged-package evidence cover these contracts. The
unchanged `sfsmisc 1.1-25` examples `linesHyperb.lm` and `lseq` pass; the first blocker advances to
missing browser-owned `datasets::LifeCycleSavings` in `example:mult.fig`. Checked-in flat
conformance is 1,443/1,443 with 1,384 live-R-eligible cases; recursive Oracle v2 is 302/302 graphs
with 575 explicitly evidenced behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.455 browser-owned savings data and linear-model diagnostics

`datasets::LifeCycleSavings` is now a provenance-audited, declarative browser resource loaded
through the generic static-package data path. Complete values, shape, types, country row names,
aggregates, and namespace/search identity have flat, integration, and exact recursive evidence.
`stats::plot.lm` now dispatches fitted models to the four standard default diagnostic panels using
shared `lm.influence`, `lowess`, `qqnorm`, and graphics primitives. It preserves exact callable
formals and invisible `NULL`; Cook's-distance panels and the remaining labeling/custom-panel depth
are explicit incomplete contracts. The unchanged `sfsmisc 1.1-25` `example:mult.fig` passes and its
first blocker advances to `example:p.arrows`, where evaluation reaches an unresolved symbol `x`.
Checked-in flat conformance is 1,445/1,445 with 1,386 live-R-eligible cases; recursive Oracle v2 is
304/304 graphs with 576 explicitly evidenced behavioral/numeric bindings. GNU R 4.6.1 remains
normative.

## Profile 0.456 browser-owned core examples

The generic `utils::example()` path now discovers an independently authored `graphics::arrows`
demonstration in the ordinary static-package example manifest. It produces the documented `x`, `y`,
and `s` side effects, renders through the shared browser graphics path, and retains GNU-compatible
structural and visibility observations without copying GNU R example source. Flat, recursive, and
integration evidence covers the reusable contract. The unchanged `sfsmisc 1.1-25` `example:p.arrows`
passes; its first blocker advances to missing browser-owned `datasets::Puromycin` in
`example:p.profileTraces`. Checked-in flat conformance is 1,446/1,446 with 1,387 live-R-eligible
cases; recursive Oracle v2 is 305/305 graphs with 577 explicitly evidenced behavioral/numeric
bindings. GNU R 4.6.1 remains normative.

## Profile 0.457 browser-owned Puromycin data

The complete independently published 23-row `datasets::Puromycin` table now enters through the same
declarative static-package data path used by other core and installed-package resources. Flat,
integration, and exact recursive evidence pins values, shape, storage, factor-level order, compact
row names, aggregates, and namespace/search identity. The unchanged `sfsmisc 1.1-25`
`example:p.profileTraces` progresses past data loading to the reusable `stats::nls` semantic gap;
that callable is unavailable rather than emulated with a package-specific branch. Checked-in flat
conformance is 1,447/1,447 with 1,388 live-R-eligible cases; recursive Oracle v2 is 306/306 graphs
with 577 explicitly evidenced behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.458 nonlinear least squares and profile plotting

`stats::nls` now evaluates ordinary two-sided numeric formulas in a generic data environment and
fits named starting parameters with a bounded finite-difference, damped Gauss-Newton path.
Coefficients, fitted values, residuals, deviance, residual degrees of freedom, convergence metadata,
and reusable `profile.nls`/`plot.profile.nls` dispatch are available. Default-algorithm fits and
bounded profile refits have flat, integration, and exact recursive evidence; `plinear`, `port`,
bounds, subset/weights/NA controls, trace output, and the full GNU `nlsModel` closure surface remain
explicit boundaries. `plot.default(mgp=)` validates a finite three-value control without persisting
inline graphics state. The unchanged `sfsmisc 1.1-25` `example:p.profileTraces` passes, and the next
blocker is missing browser-owned `datasets::lm.SR` in `example:p.res.2x`. Checked-in flat
conformance is 1,449/1,449 with 1,390 live-R-eligible cases; recursive Oracle v2 is 308/308 graphs
with 580 explicitly evidenced behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.459 browser-owned lm.influence example

The generic `utils::example()` path now discovers an independently authored `stats::lm.influence`
example manifest. It constructs `lm.SR` from the already admitted `LifeCycleSavings` data using
ordinary `stats::lm`, then returns ordinary `stats::lm.influence` diagnostics. Flat, integration,
and exact recursive evidence pins result shape, visibility, fitted-model class, rounded
coefficients, and residual length without copying GNU R example source. The unchanged
`sfsmisc 1.1-25` `example:p.res.2x` passes; the next blocker is missing browser-owned
`datasets::state.center` in `example:p.tachoPlot`. Checked-in flat conformance is 1,450/1,450 with
1,391 live-R-eligible cases; recursive Oracle v2 is 309/309 graphs with 581 explicitly evidenced
behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.460 multi-object core data families

Static-package autoload resource names are now independent from exported binding names, matching the
ordinary package-data rule that one `data/<topic>` resource may create multiple public objects. The
browser-owned `data/state.R` resource loads `state.abb`, `state.area`, `state.center`,
`state.division`, `state.name`, `state.region`, and `state.x77` atomically through generic `data()`;
all seven are also visible through the datasets search entry and namespace access. Flat,
integration, and exact recursive evidence covers the complete object family. Unchanged
`sfsmisc 1.1-25` `example:p.tachoPlot` passes; its next ordered blocker is missing
`datasets::sunspots` in `example:p.ts`. Checked-in flat conformance is 1,451/1,451 with 1,392
live-R-eligible cases; recursive Oracle v2 is 310/310 graphs with 581 explicitly evidenced
behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.461 fixed sunspots and time-series controls

The complete fixed 2,820-observation `datasets::sunspots` series is now admitted through the generic
declarative data-resource path and is available through autoload, `data()`, search-path, and
namespace access. Regular time-series plotting forwards and validates standard `xaxt` and `yaxt`
controls, and `window()` accepts a fractional second component in two-component time coordinates.
Flat, integration, and exact recursive evidence covers these contracts without a package-specific
branch. The unchanged `sfsmisc 1.1-25` `example:p.ts` advances to its next ordered blocker, missing
`datasets::EuStockMarkets`; the artifact remains at P4. Checked-in flat conformance is 1,454/1,454
with 1,395 live-R-eligible cases; recursive Oracle v2 is 313/313 graphs with 583 explicitly
evidenced behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.462 complete EuStockMarkets data

The complete fixed `datasets::EuStockMarkets` object is now admitted through an ordinary encoded
`data/EuStockMarkets.rda` resource. It materializes a 1,860-by-4 `mts` with exact values, column
names, classes, and business-time coordinates through generic package-data, matrix, and `stats::ts`
paths. Trusted static data topics initialize with independent step budgets, preventing one large
resource from consuming the budget of unrelated topics without changing user-evaluation limits. The
unchanged `sfsmisc 1.1-25` `example:p.ts` advances to numeric `as.POSIXct()` without an explicit
`origin`; the artifact remains at P4. Checked-in flat conformance is 1,455/1,455 with 1,396
live-R-eligible cases; recursive Oracle v2 is 314/314 graphs with 583 explicitly evidenced
behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.463 numeric POSIX conversion and recursively missing axis formats

Numeric `as.POSIXct()` accepts an omitted `origin` as the Unix epoch while preserving integer or
double storage, ordinary names/dimensions/dimnames, the observable empty default `tzone`, and
NA/NaN/infinity distinctions. Explicit character, Date, POSIXct, POSIXlt, logical-missing, and
numeric origins are converted to seconds, combined elementwise under ordinary recycling and
attribute precedence, and emit GNU R's warning message, classes, and call when lengths are not
multiples. The production browser timezone boundary remains UTC/GMT; this increment does not claim
arbitrary host time zones. Date/POSIXct axis format handling recognizes recursively forwarded
missing promises and applies its normal omitted-format path without prematurely forcing them. The
unchanged `sfsmisc 1.1-25` `example:p.ts` now passes and its next ordered blocker is
`example:pkgDesc: missing value where TRUE/FALSE needed`; the artifact remains at P4. Checked-in
flat conformance is 1,457/1,457 with 1,398 live-R-eligible cases; recursive Oracle v2 is 316/316
graphs with 585 explicitly evidenced behavioral/numeric bindings. GNU R 4.6.1 remains normative.

## Profile 0.464 installed metadata, simplification names, and Theoph data

Installed DESCRIPTION views include deterministic GNU-shaped `Built` fields, and apply-family matrix
simplification preserves the observable inner and outer names used by ordinary pure-R code. The
complete 132-by-5 `datasets::Theoph` object is admitted from an independently licensed source
through the generic declarative data path, including ordered Subject levels, grouped-data classes,
attributes, values, and namespace identity. Unchanged `sfsmisc` examples `pkgDesc` and the data-load
portion of `plotDS` now pass without source rewriting. Its next ordered blocker is automatic `nls()`
starting values for the `SSfol` self-start model; the artifact remains at P4. Checked-in flat
conformance is 1,460/1,460 with 1,401 live-R-eligible cases; recursive Oracle v2 is 319/319 graphs.
GNU R 4.6.1 remains normative.

## Profile 0.466 atomic existing-array flat tables

`stats::ftable()` now treats an existing atomic array as values to permute rather than counts to
coerce. Character, logical, integer, double, complex, and raw storage are retained exactly, missing
values survive the dimension permutation, and `dim`, `class`, `row.vars`, and `col.vars` follow GNU
attribute order and metadata. The callable is owned and exported by the `stats` namespace while its
S3 formatter remains registered there. The unchanged `sfsmisc` `example:potatoes` clears its table
summaries and advances to missing `stats::interaction.plot`; the artifact remains at P4. Checked-in
flat conformance is 1,463/1,463 with 1,404 live-R-eligible cases; recursive Oracle v2 is 321/321
graphs. GNU R 4.6.1 remains normative.

## Profile 0.467 grouped interaction plots

`stats::interaction.plot()` now partitions a numeric response by two factor dimensions, invokes an
arbitrary callable once for each nonempty cell in GNU array order, retains missing cells, and draws
one trace per trace-factor level through the shared browser graphics path. The admitted controls
cover line/point type, colors, line types, symbols, axes, labels, limits, annotations, and an
optional legend; the result is invisible `NULL`. Exact flat and recursive evidence covers callback
inputs, order, visibility, and public formal names. Unchanged `sfsmisc` `example:potatoes` passes
and its next blocker is `example:pretty10exp`, where `[[` rejects an unsupported non-vector object
shape. The artifact remains P4. Checked-in flat conformance is 1,464/1,464 with 1,405
live-R-eligible cases; recursive Oracle v2 is 322/322 graphs. GNU R 4.6.1 remains normative.

## Profile 0.468 call and expression subsetting

Language calls and expression vectors now participate in ordinary `[` and `[[` extraction.
Positional and named double-bracket access returns the underlying language value, call slices
rebuild a valid call from selected entries, expression slices retain expression type and names, and
`exact=` follows the standard matching contract. Empty call-entry tags normalize to absent tags,
matching recursive GNU structure. The unchanged `sfsmisc` `example:pretty10exp` passes and the next
blocker is `example:primes`, where `matplot(ylab=)` rejects multiple labels. The artifact remains
P4. Checked-in flat conformance is 1,465/1,465 with 1,406 live-R-eligible cases; recursive Oracle v2
is 323/323 graphs. GNU R 4.6.1 remains normative.

## Profile 0.469 vector graphics annotations in matplot

`graphics::matplot()` now forwards scalar or vector annotations to the shared title system instead
of rejecting every non-scalar character label. Character and numeric vectors, expression vectors,
missing labels, and empty labels follow the ordinary graphics annotation contract; the result
remains invisible `NULL`. Unchanged `sfsmisc` `example:primes` passes and the next blocker is
`example:printTable2`, where a reusable array subscript path reports an incorrect number of
dimensions. The artifact remains P4. Checked-in flat conformance is 1,466/1,466 with 1,407
live-R-eligible cases; recursive Oracle v2 is 324/324 graphs. GNU R 4.6.1 remains normative.

## Profile 0.470 format.default array shape preservation

`format.default()` now preserves `dim` and `dimnames` when formatting atomic matrices and arrays,
while ordinary named vectors retain `names` and unrelated attributes are discarded. This matches GNU
character-result shape for two- and higher-dimensional arrays and keeps downstream rectangular
subsetting valid. Unchanged `sfsmisc` `example:printTable2` passes and the next blocker is
`example:ps.end`, where `formals()` receives a missing `fun` argument. The artifact remains P4.
Checked-in flat conformance is 1,467/1,467 with 1,408 live-R-eligible cases; recursive Oracle v2 is
325/325 graphs. GNU R 4.6.1 remains normative.

## Profile 0.471 omitted formals caller reflection

`formals()` now exposes GNU's `fun = sys.function(sys.parent())` and `envir = parent.frame()` public
defaults. When `fun` is omitted inside an ordinary closure, it reflects that active caller; a
one-element character name resolves the first callable binding through the supplied environment and
its parents. Unchanged `sfsmisc` `example:ps.end` clears its missing-`fun` failure and reaches the
declared real-PostScript-encoder boundary. The artifact remains P4. Checked-in flat conformance is
1,468/1,468 with 1,409 live-R-eligible cases; recursive Oracle v2 is 326/326 graphs. GNU R 4.6.1
remains normative.

## Profile 0.472 PostScript device and host-bound example classification

`grDevices::postscript()` now consumes the same bounded owned graphics journal as the browser, PNG,
and PDF devices and emits a real `%!PS-Adobe-3.0` DSC document using PostScript Level 2 operators.
Its admitted contract includes invisible opening, named device registration, 72-point geometry,
horizontal orientation, base Type 1 sans/serif/mono fonts, RGB/gray/CMYK color, nonzero/even-odd
fills, hatch clipping, opaque vector graphics, raster image data, multi-page `onefile` output,
numbered single-page output, virtual-file lifecycle, and bounded close-time encoding. The encoder is
DOM-free, network-free, process-free, and CSP-safe. It does not claim byte identity with GNU R,
custom font maps, arbitrary encodings, device-exact text metrics, semi-transparent vectors, or host
printing; those unsupported contracts fail deterministically.

The flat differential replaces the former API-only boundary case with lifecycle and DSC-output
behavior shared with GNU R: exact formals, visibility, device identity and number, device size,
close return, `%!PS`, page/trailer markers, and nonempty output. The inventory remains 1,468 flat
cases, 1,409 live-R-eligible cases, and 326 recursive graphs because this increment strengthens an
existing case rather than adding a new one. The `postscript` capability advances from API-only to
behavioral for the documented admitted subset.

The generic package checker now marks an example or retained test not applicable only when its
runtime error exactly declares the absent explicit `createR({ systemCommand })` capability. It does
not execute, emulate, or silently approve a command. This carries unchanged `sfsmisc::ps.end`
through PostScript generation to its host viewer boundary; the next applicable first blocker is
`example:read.org.table` at `readLines(encoding = "native")`. The artifact remains P4.

## Profile 0.473 native line-encoding alias and result marks

`base::readLines` accepts `"native"`, `"native.enc"`, and `"nativeenc"` as aliases for NativR's
versioned browser-native UTF-8 representation. Native and unknown reads return strings marked
`unknown`, matching GNU R; explicitly requested UTF-8, Latin-1, or bytes reads retain the associated
mark. This is deterministic text decoding over evaluator-owned files and connections, not a claim of
arbitrary host-native code-page support.

Checked-in flat conformance is 1,469/1,469 with 1,410 live-R-eligible cases, and recursive Oracle v2
is 327 graphs. The new focused flat case covers non-ASCII UTF-8 roundtrip and aliases; the exact
recursive case covers alias results, nested values, marks, and identity. GNU R 4.6.1 remains the
normative target; local advisory execution used GNU R 4.6.0.

## Profile 0.474 `stopifnot` expression evaluation

`base::stopifnot` now covers ordinary `...` assertions, syntactic `exprs = { ... }` blocks, and
explicit `exprObject` expression/language values. Each expression is evaluated exactly once in
order; a non-scalar or scalar logical result must contain only non-missing `TRUE`, and the first
failure stops later expressions. `local = FALSE` evaluates in an isolated child environment. Mixing
the three assertion modes is rejected with GNU's public diagnostic.

Checked-in conformance is 1,470/1,470 with 1,411 live-R-eligible cases. Recursive Oracle v2 contains
328 exact graphs. The new cases cover visibility, nested results, source diagnostics, assignment
side effects, short-circuiting, explicit expression objects, and mutual exclusion.

## Profile 0.475 `tools::assertError`

`tools::assertError` has behavioral coverage for exact formals, lazy expression evaluation, matching
error capture, invisible condition-list return, condition message/class observation, optional
verbose message output, and the no-error diagnostic. The helper uses the ordinary condition
representation and does not catch resource-limit aborts.

Checked-in conformance is 1,471/1,471 with 1,412 live-R-eligible cases; recursive Oracle v2 contains
329 exact graphs. GNU R 4.6.1 remains normative and local advisory evidence uses GNU R 4.6.0.

## Profile 0.476 `package_version()` metadata-list contract

`package_version(x, strict)` behaviorally supports GNU R's narrow version-metadata exception: a
named list with exact `major` and `minor` members constructs a one-element `R_system_version` when
their joined printed value is a valid three-component system version. Member order and unrelated
metadata do not affect the result. Missing required members retain the ordinary non-character-list
error, and an invalid joined specification fails even when `strict = FALSE`. Arbitrary parsed or
unnamed lists are not admitted.

Checked-in conformance is 1,472/1,472 with 1,413 live-R-eligible cases; recursive Oracle v2 contains
330 exact graphs. GNU R 4.6.1 remains normative and local advisory evidence uses GNU R 4.6.0.

## Profile 0.477 `R_compiled_by()` portable contract

The base binding is a locked zero-argument closure whose result is a length-two character vector
named `C` and `Fortran`, with both values populated. Compiler strings are explicitly
platform-adapted: GNU R reports its build compilers, while NativR reports its TypeScript runtime and
WebAssembly numerical kernels. No claim of identical compiler text is made.

Checked-in conformance is 1,473/1,473 with 1,414 live-R-eligible cases; recursive Oracle v2 contains
331 exact graphs.

## Profiles 0.478–0.480 runtime metadata contracts

`extSoftVersion()` behaviorally preserves the GNU R eleven-name character result, zero formals,
non-missing values, at least one populated external version, and a locked binding. Individual
version strings and availability are platform-adapted. `La_version()` is exactly `"3.12.1"` for the
pinned bundled backend, while `La_library()` is empty because it is internal. `pcre_config()`
exactly reports UTF-8 and Unicode-property support and the absence of PCRE JIT and stack backends.
These functions are locked zero-argument base closures.

Checked-in conformance is 1,476/1,476 with 1,417 live-R-eligible cases; recursive Oracle v2 contains
334 exact graphs.

## Profiles 0.481–0.484 semantic and package-check contracts

Expression/language legend labels, inherited logarithmic `curve(add = TRUE)` coordinates,
`pmin.int`/`pmax.int`, one-dimensional-array `rbind`/`cbind`, and mixed-frame `data.matrix` are
covered by executable contracts. The browser-owned `datasets::iris3` object is a deterministic
projection of the admitted Iris data rather than copied GNU R data. Generated and literal negative
exponents remain structurally distinct for `identical()` but compare equal through
`all.equal.expression` when their language deparses agree.

Primitive `as.integer()` performs S4 selection and package-defined S3 dispatch before default atomic
coercion, forwarding original lazy arguments without adding package-specific branches.
`density.default()` admits Gaussian and variance-standardized Epanechnikov direct-kernel paths; the
remaining kernels, non-`nrd0` bandwidth selectors, infinite masses, and broader FFT-coordinate
details remain explicit boundaries. Numeric Oracle evidence declares the direct-versus-discretized
tolerance rather than claiming bitwise equivalence.

Checked-in conformance is 1,485/1,485 with 1,426 live-R-eligible cases; recursive Oracle v2 contains
344 graphs. The pinned unchanged `sfsmisc 1.1-25` artifact passes every applicable generic
package-check step and is scoped P7. This result is evidence for the exercised artifact and
contract, not a declaration of general pure-R package completeness.

## Profile 0.485 namespace export reflection

`getExportedValue(ns, name)` is a two-formal Base closure over the shared namespace registry. `ns`
accepts a package-name character vector or a loaded namespace environment; `name` accepts a symbol
or character vector, with GNU-compatible first-element selection. The function loads an available
namespace, returns only declared public bindings, and distinguishes bad namespace/name inputs,
missing packages, missing Base objects, and non-exported package objects. It does not bypass the
namespace export table or expose package internals.

Checked-in conformance is 1,486/1,486 with 1,427 live-R-eligible cases; recursive Oracle v2 contains
345 graphs. The unchanged `testit 1.1` artifact passes every applicable generic package-check step
and a separately frozen scenario covering all six exports, assertions, equality, and condition
capture. This is scoped evidence for the pinned artifact, not general pure-R package completeness.

## Profile 0.486 one-dimensional transpose contract

`t.default()` treats an atomic rank-one array as a row matrix rather than rejecting it. The result
has dimensions `1 x length(x)`, carries the source axis values into column dimnames, retains the
source axis label in the second dimname position, preserves unrelated class attributes, and
normalizes an empty rank-one axis to two null dimname entries. Two-dimensional matrices swap both
axis values and axis labels. Arrays of rank greater than two fail with GNU R's
`argument is not a matrix` diagnostic.

Checked-in conformance is 1,487/1,487 with 1,428 live-R-eligible cases; recursive Oracle v2 contains
346 graphs. The unchanged `Metrics 0.1.4` artifact passes its complete applicable generic
package-check plan and an independently frozen scenario over regression, classification, retrieval,
scale, and kappa behavior. This remains scoped evidence for the pinned artifact.

## Profile 0.487 non-central probabilities, formula points, and `pwr` closure

Finite non-negative non-centrality is behavioral for `stats::pchisq`, `stats::pf`, and `pt` across
the checked-in value grids, lower/upper and ordinary/log tails, recycling, boundaries, attributes,
formal metadata, and declared absolute/relative numeric tolerances. Non-central `dt`, `qchisq`,
`qf`, and `qt` remain explicit gaps. `graphics::points.formula` has GNU-shaped formals and ordinary
formula S3 dispatch, constructs coordinates through `stats::model.frame`, forwards point controls,
and returns invisibly; explicit formula `subset=` is not claimed.

Checked-in conformance is 1,489/1,489 with 1,430 live-R-eligible cases; recursive Oracle v2 contains
348 graphs. The unchanged `pwr 1.3-0` artifact passes its complete applicable generic package-check
plan and an independent scenario over all 15 exports. This is scoped evidence for the pinned
artifact, not a claim of general package or complete distribution compatibility.

## Profile 0.488 browser vector/raster devices, hypergeometric tails, and grid drawing

`grDevices::svg` writes standalone UTF-8 SVG from the browser graphics journal, and
`grDevices::tiff` writes baseline little-endian RGBA TIFF with either uncompressed or genuine TIFF
LZW strips. Unsupported SVG event families and TIFF codecs remain explicit capability boundaries.
`stats::phyper` covers vectorized lower/upper ordinary/log tails, GNU parameter and quantile
rounding, attributes, missingness, domain warnings, and bounded exact summation.

`grid::gList` accepts only grobs, recursively flattens nested lists with GNU-compatible derived
names, and `grid::grid.draw` preserves the generic S3 extension seam while drawing admitted grob
families and automatically opening the default browser device. Checked-in conformance is 1,493/1,493
with 1,434 live-R-eligible cases; recursive Oracle v2 contains 352 graphs. The unchanged
`VennDiagram 1.8.2` artifact has advanced through namespace, documentation, hypergeometric, device,
grob-list, and drawing blockers, but remains scoped and blocked at its first outstanding generic
contract recorded in the corpus.

## Profile 0.489 data-frame matrix binding and grid annotations

`cbind.data.frame` expands two-dimensional atomic and list inputs by column, recycles compatible row
extents, derives GNU-compatible names, retains explicit data-frame row names, admits matrix row
names when the frame used automatic rows, and preserves names on list-column elements. Incompatible
row counts fail with the GNU diagnostic. `grid::textGrob` preserves expression, language, and symbol
annotations and converts ordinary atomic annotations to character; browser drawing emits a stable
text representation while complete plotmath glyph layout remains outside the current graphics claim.

Checked-in conformance is 1,495/1,495 with 1,436 live-R-eligible cases; recursive Oracle v2 contains
354 graphs. The unchanged `VennDiagram 1.8.2` archive passes all applicable generic package-check
steps and its independent scenario at scoped P7. `httpcode 0.3.0` then passes the same generic path
and an independent all-export scenario after a shared `stopifnot` diagnostic-deparse fix. The corpus
contains 114 pinned releases, with unopened `shades 1.5.0` retained as the next source-blind P0
holdout.

## Profile 0.490 colour converters, structural attributes, and non-callable bindings

`grDevices::colorConverter` now constructs GNU-shaped converter objects with row-wise and declared
vectorized wrappers. `convertColor()` accepts those objects on either side of the XYZ bridge, and
`rgb2hsv()` covers matrix and separate-channel forms with names, dimensions, recycling, scale, and
range validation. The `grDevices::colorspaces` namespace value is represented as a first-class,
immutable non-callable core binding and is now declared separately from callable functions in the
capability manifest. Its XYZ, sRGB, and Lab conversions are numeric; Apple RGB, CIE RGB, and Luv
retain GNU-shaped converter objects but fail deterministically when their unimplemented numeric
paths are invoked.

`structure(dim = NULL)` removes both `dim` and `dimnames` while preserving unrelated attributes, and
short or missing atomic `names=` values are coerced and padded using GNU missing-name rules.
Checked-in evidence is 1,498/1,498 with 1,439 live-R-eligible cases and 355 recursive Oracle v2
graphs. The unchanged `shades 1.5.0` artifact passes its complete applicable package-check plan and
independent colour scenarios at scoped P7. The corpus has 115 pinned releases; unopened
`relimp 1.0-5` is the sole source-blind P0 holdout.

## Profile 0.491 unchanged relimp package evidence

The unchanged `relimp 1.0-5` archive passes generic source installation, metadata processing,
namespace loading, attachment, complete export/help coverage, every applicable installed example and
package-check step, and independent GNU-matched scenarios over `lm` relative-importance comparisons
and Tcl-list string conversion. Its Suggested Tcl/Tk UI and optional model integrations are not part
of the mandatory dependency closure and are not claimed. The pinned artifact advances to scoped P7
without source rewriting or package recognition.

The corpus now contains 116 releases: 100 passing, 15 blocked, one unevaluated, and 61 at scoped P7.
`codetools 0.2-20` is the sole unopened source-blind P0 holdout.

## Profile 0.492 language reflection and unchanged codetools evidence

Profile 0.492 closes shared reflection contracts exposed by the frozen `codetools 0.2-20` artifact:
assigned missing-formal sentinels remain missing, parsed syntax has first-class special bindings for
inspection, `callCC()` implements dynamically scoped escape continuations, `break`/`next` expose
symbol call heads through `as.list()`, character-literal call heads normalize to symbols, `cat()`
accepts symbols but still rejects language calls, and `bquote()` supplies its GNU-shaped formals to
`match.call()`. Flat, integration, and recursive Oracle v2 cases cover these contracts independently
of the package.

The deterministic unchanged codetools artifact passes installation, namespace loading, attachment,
complete export/help coverage, all installed examples, all retained tests, absent-vignette
classification, and independent code-analysis scenarios at scoped P7. The corpus remains 116
releases, now with 101 passing, 15 blocked, no unevaluated holdout, and 62 at scoped P7. This closes
one pinned package surface, not arbitrary pure-R package compatibility.

## Profile 0.493 unchanged stinepack package evidence

The usage-ranked `stinepack 1.5` archive was admitted as a source-blind P0 holdout only after its
official metadata, 6,733-byte archive, source SHA-256, five-export/formal inventory, and independent
GNU R black-box interpolation scenarios were frozen. The first unchanged NativR run required no
semantic change or package-specific accommodation. The deterministic artifact passes installation,
metadata and dependency processing, namespace loading, attachment, complete export/help coverage,
every applicable example and package-check step, absent-test and absent-vignette classification, and
independent scaled-Stineman, parabola, missing-value, class, boundary, and diagnostic scenarios.

The corpus now contains 118 releases: 102 passing, 15 blocked, one unevaluated holdout, and 63 at
scoped P7. Unopened `qvcalc 1.0.4` is the next metadata-first statistical probe. This is additional
source-blind compositional evidence for the declared pure-R pipeline; it does not establish
arbitrary-package or program-level completion.

## Profile 0.494 custom GLM families and unchanged qvcalc evidence

Profile 0.494 admits standard numeric-response custom `family` objects through the shared GLM
protocol. `glm()` invokes package-provided `linkfun`, `linkinv`, `variance`, `dev.resids`, `aic`,
`mu.eta`, `initialize`, `validmu`, and `valideta` behavior; `residuals.glm()`, `summary.glm()`, and
new-data `predict.glm(type = "response")` reuse the same callbacks. A finite `family$dispersion`
selects fixed-dispersion z inference at its declared value; missing dispersion uses callback-based
Pearson estimation and t inference. `vcov.lm()` now rematches its method formals, accepts positional
or partial `complete`, and leaves unrelated `...` promises unforced, as GNU R does. Flat,
integration, and recursive Oracle v2 evidence covers these contracts without a package identity.

The frozen unchanged `qvcalc 1.0.4` artifact reaches scoped P7 after those two reusable model seams
were closed. It passes generic installation, metadata/dependency processing, namespace loading,
attachment, export/help coverage, applicable examples and package checks, deterministic
unavailable-Suggested classification, and an independent balanced-factor quasi-variance scenario.
The ledger now contains 118 releases: 103 passing, 15 blocked, none unevaluated, and 64 at scoped
P7. Custom matrix-response initialization and arbitrary `initialize` mutation of `y`, `weights`, or
`n` are not claimed by this increment; such families must continue to fail at their first concrete
unsupported contract rather than silently receiving package-specific treatment.

## Profile 0.495 residual restoration, S4 reflection, GLM covariance, and aod evidence

Profile 0.495 adds `stats::naresid`, its default and `exclude` methods, and ordinary S3 dispatch.
The exclude path restores omitted vector or matrix rows, missing values, names, and row dimnames by
the same shared mechanism as `napredict`. `methods::slotNames` and hidden `.slotNames` report local
then inherited slots for formal objects, class names, class representations, and classed objects;
formal vector-data classes include `.Data` first. Unknown explicit class names return an empty
character vector, while ordinary nonformal values retain `NULL` behavior.

`vcov.glm()` now uses the fitted weighted QR inverse scaled by the family dispersion rather than an
ordinary least-squares residual variance. Fixed-dispersion families use their declared scale,
estimated-dispersion families use Pearson dispersion over residual degrees of freedom, an explicit
`dispersion=` overrides either, and `complete = FALSE` removes aliased rows and columns. Flat,
integration, and recursive GNU R evidence covers fixed Poisson, quasipoisson, explicit scale, rank
deficiency, dimnames, missing coefficients, and generic/method formals.

The unchanged `aod 1.3.3` artifact
`a5b3429016dd237589f80a64ade844ce1ae3c2e659ec7e4cceb9a9cf03403900` passes generic installation,
metadata/dependency processing, namespace loading, attachment, complete export/help coverage, every
applicable installed example and package-check step, and independent transform, Wald, S4
quasipoisson, residual, fitted-value, deviance, and covariance scenarios at scoped P7. Paths
requiring Suggested MASS, boot, or lme4 are deterministically not applicable. The corpus contains
120 releases: 104 passing, 15 blocked, one unopened holdout, and 65 at P7. Unopened `trust 0.1-9` is
the sole P0 holdout; this increment remains evidence for bounded surfaces, not arbitrary-package
completion.

## Profile 0.496 direct fit, symbolic D, and unchanged trust evidence

The browser-admissible stats contract now includes direct `glm.fit` IRLS behavior and exact public
formals. Numeric matrices, standard/custom family callbacks, weights, offsets, starts, controls,
intercept metadata, singular policy, warnings, and the ordinary unclassed result structure use the
same package-neutral model primitives as `glm`. The contract also includes `stats::D` over
normalized language objects for additive, multiplicative, unary-sign, parenthesized, and constant
numeric-power forms, including repeated differentiation of its generated language; unsupported
calls, division, and symbolic exponents fail deterministically rather than invoking generated code.

Flat cases, an integrated Worker-facing API case, and recursive GNU black-box graphs cover both
seams. The unchanged `trust 0.1-9` artifact
`303df0c340588d989a4e5a71d496a5535466fea3a17007c0546c2dc323649053` passes the complete applicable
generic P0-P7 plan. This is scoped evidence for the pinned artifact and exercised surface. It does
not claim complete `glm.fit` family initialization, `deriv.default`, an extensible derivative table,
or arbitrary pure-R package compatibility.

## Profile 0.497 CMRG streams and unchanged itertools evidence

The random-state contract admits browser-native `"L'Ecuyer-CMRG"`: GNU-shaped seven-integer seeds,
deterministic MRG32k3a uniform draws, `.Random.seed` synchronization/restoration, and exact 2^127
stream and 2^76 substream jumps. `parallel::nextRNGStream` and `parallel::nextRNGSubStream` preserve
the seed kind code, expose one `seed` formal, leave the active stream unchanged, and reject
non-integer, wrong-length, or non-CMRG inputs deterministically.

Flat, integrated API, exact recursive GNU black-box, and unchanged-package evidence cover the seam.
The frozen `itertools 0.1-3` artifact
`bf2fe6d71b785b1a65004649de200dc79295af74f67020537d58a42feade80ae` passes generic installation,
dependency closure, namespace lifecycle, complete export/help coverage, every applicable example,
absent-test/vignette classification, and an independent product/zip/stream scenario at scoped P7.
The foreach-only example remains deterministically not applicable because that Suggested package is
not installed. This does not imply true parallel workers or arbitrary pure-R package compatibility.

## Profile 0.498 browser-parallel closure and unchanged optimParallel evidence

The frozen unchanged `optimParallel 1.0-3` artifact
`9230df11e2f6dceb5f8424d296062e416408bd22708e481cc24b188921e2c1cd` passes the complete applicable
generic package-check plan after two ordered reusable blockers were closed. Persistent browser
cluster environments support default registration, exported bindings, quoted evaluation, and
deterministic apply/call distribution. Public bounded `stats::optim` calls reuse the audited
L-BFGS-B Wasm backend with GNU-shaped controls and results.

Flat, integration, exact recursive GNU R, installed-package, and independent scenario evidence
covers the increment. The 122-release ledger contains 107 passing, 15 blocked, none unevaluated, and
68 scoped P7 entries. This is not a claim of host CPU parallelism or arbitrary package
compatibility.

## Profile 0.499 `as.vector` dispatch and unchanged tictoc evidence

The frozen unchanged `tictoc 1.2.1` artifact
`02a0f5f2303a0fb641a8e404986608d415ab49917d3fae4eee1c5d39c8497fd7` passes generic installation, the
mandatory `methods` closure, namespace load and attachment, complete export/help coverage, every
applicable installed example/check, and deterministic unavailable-Suggested classification. An
independently authored nested timing and Stack/StackList scenario exposed a missing S3 conversion
contract that the package's own checks did not reach.

`as.vector` now dispatches class and default methods, retains `mode = "any"` in reflective method
calls, and preserves base factor/data-frame method precedence. Flat, integration, exact recursive
GNU R, and unchanged-package evidence covers the seam. The 123-release ledger contains 108 passing,
15 blocked, none unevaluated, and 69 scoped P7 entries. This remains scoped evidence rather than a
claim of arbitrary pure-R compatibility.

## Profile 0.500 rejection-sampling state and unchanged dfoptim evidence

The frozen unchanged `dfoptim 2023.1.0` artifact
`7247194cefd1075cf7c8c4ca1356123abf21c307217ad7c8cf58776e4b85f3fa` passes generic installation,
namespace lifecycle, complete five-export documentation coverage, all public help and installed
example topics, absent-test/vignette classification, and independent coverage of all five exported
optimizers. Its randomized `mads` path exposed that a predetermined final sample result still must
advance the uniform stream under GNU R's default Rejection sampler.

Profile 0.500 closes that package-neutral RNG-state contract. Flat, integration, exact recursive GNU
R, and unchanged-package evidence covers singleton and repeated-permutation state consumption. The
124-release ledger contains 109 passing, 15 blocked, none unevaluated, and 70 scoped P7 entries;
these remain pinned-corpus facts rather than arbitrary-package completion.

## Profile 0.501 distribution closure, owned replacement, and unchanged DFBA evidence

The frozen unchanged `DFBA 0.1.0` artifact
`d1b0d0223c1b5dac43641247af38a01a2cde0e08dc8085e4cf33d53cf185cf5e` passes its generic 66-step
package-check plan: metadata, namespace lifecycle, 34 documentation checks, 14 installed examples,
explicit optional-test dependency classification, and 14 prebuilt vignette records. Its scheduled
run selected shared `dbeta`, `pbeta`, `qbeta`, `rlogis`, and `rweibull` gaps, followed by quadratic
allocation in repeated local vector growth and replacement.

Profile 0.501 provides those versioned stats contracts and bounded, exclusively owned local numeric
storage reuse without package recognition. Any observable alias or unsupported shape falls back to
copy-on-modify. Checked-in evidence is 1,536/1,536 flat cases and 392/392 recursive Oracle v2 cases,
with 668 recursively evidenced bindings. The 125-release ledger contains 110 passing, 15 blocked,
none unevaluated, and 71 scoped P7 entries; this is pinned evidence, not arbitrary-package
completion.

## Profile 0.502 list-backed lookup and unchanged lm.beta evidence

The frozen unchanged `lm.beta 1.7-3` artifact
`1c13aeb2a45d1790e851ad5f0a4cdbeeb4bfa6f66c39898e47b023f784aa2201` passes its 19-step generic plan:
metadata, namespace lifecycle, seven documentation checks, six installed examples, explicit
absent-test classification, and two prebuilt vignette records. Its first example selected the
package-neutral difference between positional list lookup and an evaluating data mask.

Profile 0.502 gives `as.environment(list)` an empty parent. Consequently `exists(name, list)` cannot
inherit an ambient binding, while eval/with list environments retain their separately specified
caller enclosure. Flat, integration, exact recursive GNU R, and independent weighted/no-intercept
model evidence cover the seam. The 126-release ledger contains 111 passing, 15 blocked, none
unevaluated, and 72 scoped P7 entries; this remains pinned evidence rather than arbitrary-package
completion.

## Profile 0.505 bracket identity escapes, public row binding, and latex2exp evidence

GNU-compatible default and Perl-mode regular expressions accept ordinary punctuation identity
escapes inside bracket expressions that ECMAScript Unicode mode rejects. NativR removes only that
invalid punctuation subset and preserves semantic escapes, Unicode/hexadecimal escapes, doubled
backslashes, and escaped bracket syntax. `rbind.data.frame` is now a public behavioral Base binding
with exact GNU formals, trailing-control matching, factor-preserving row binding, explicit and
automatic row-name behavior, duplicate repair, and the zero-row/zero-column result.

Flat and exact recursive GNU black-box cases cover both contracts. The unchanged `latex2exp 0.9.8`
artifact `c3b0426b7d6621ac5dc270e5f78ea389e2129b326d1322cd3691ae5270c93fdc` passes all 18 applicable
generic package-check steps and an independently authored conversion, styling, custom-command,
expression, diagnostic, and supported-command-table scenario. The 129-release ledger contains 114
passing, 15 blocked, none unevaluated, and 75 scoped P7 entries; this is pinned evidence rather than
arbitrary-package completion.

## Profile 0.508 S4 dispatch signatures and POSIXct combination

An S4 generic's dispatch signature is the explicit `signature=` sequence when supplied and otherwise
the non-ellipsis formals in declaration order. Dispatch forces only those arguments. Missing
forwarded signature arguments participate as missing values for selection, while promises outside
the signature are preserved for the selected method. Positional method signatures map in declared
signature order. This does not claim complete multiple-dispatch, validity, or namespace behavior.

Special `rep()` expands a literal forwarded ellipsis into its original promises before matching and
S3 dispatch. `c.POSIXct(..., recursive = FALSE)` preserves POSIXct/POSIXt class and names when the
first argument is POSIXct, retains an identical non-missing `tzone` across all non-NULL POSIXct
inputs, and drops that attribute for mixed zones or non-POSIXct inputs. A non-POSIXct first argument
keeps ordinary atomic `c()` behavior. Current date parsing remains limited to the documented UTC/GMT
browser contract.

## Profile 0.509 seasonal ARIMA and nonlinear-model reuse boundary

`stats::arima0` now provides a browser-native univariate regular/seasonal ARIMA subset. It supports
finite series, ordinary and seasonal differencing, multiplicative AR/MA polynomials, CSS and
profile-Gaussian ML objectives, deterministic optimization, coefficient covariance, residual time
metadata, and GNU-shaped result/formals fields. Checked-in numeric evidence uses explicit
tolerances: the independent implementation is not claimed bit-identical to GNU R's Kalman path.
`xreg`, fixed coefficients, non-default optimizer controls, and wider model families remain explicit
boundaries.

The shared nonlinear-model layer evaluates `nls(subset=)` in a data-frame mask before fitting,
returns a callable `m$getPars()` interface, supplies `summary.nls` sigma/df/covariance structure,
and retains profile degrees of freedom. These are reusable Stats contracts, not package-specific
code.

## Profile 0.510 provenance-audited volcano data and perspective titles

The browser-owned `datasets::volcano` object is now loaded through the ordinary static-package data
path as an exact 87-by-61 double matrix. Its complete 5,307-cell recursive graph is checked against
GNU R, while an independently licensed georeferenced TIFF establishes provenance and exact
reproduction independently of GNU implementation files.

`graphics::persp(main=)` now accepts standard graphics annotation values and lowers the title into
the browser graphics text journal without changing the invisible 4-by-4 projection matrix. Axis
labels, subtitles, shading, and detailed perspective ticks remain explicit boundaries. The unchanged
`shape 1.4.6.1` example now reaches the colored-surface boundary, and `gridGraphics 0.5-1` retained
tests advance from expression 26 to the missing generic `graphics::coplot` boundary. No production
path recognizes either package identity.

## Profile 0.511 depth-ordered perspective facets

Explicit non-white `persp(col=)` values now lower complete surface cells into the shared polygon
journal. Colours remain attached to their column-major source-facet indices while draw order is the
stable ascending transformed-depth order observed from GNU R 4.6.1 SVG output. Default borders,
transparent `border = NA`, colour recycling, missing-corner omission, projection-matrix invariance,
resource accounting, Worker transport, device rendering, and display-list replay reuse existing
graphics contracts.

The unchanged `shape 1.4.6.1` package now passes both `example:drapecol` perspective calls. Its
ordered package-check failure advances to `example:femmecol`, where `graphics::filled.contour` is
not yet installed. Lighting, exact intersecting-surface visibility, perspective axis annotations,
and arbitrary graphical controls remain outside this incremental claim.

## Profile 0.512 browser-native filled contours

`graphics::filled.contour` now accepts explicit x/y/z grids and GNU's matrix-as-first-argument
convenience, validates strictly increasing finite levels, recycles colors, honors `color.palette`
and `key.border`, and preserves lazy key/plot axis and title callback order. It restores the
caller's graphics parameters after rendering and returns invisible `NULL`.

The independent band builder clips a fixed-diagonal triangulation into scalar intervals, omits cells
with unavailable corners, cancels shared edges, and emits compound even-odd rings without depending
on GNU R implementation code. Normalized key/main viewports travel through the Worker protocol and
render through Canvas, PNG, SVG, PDF, and PostScript geometry paths. GNU R 4.6.1 black-box probes
pin public formals, validation, callback order, panel layout, parameter restoration, and
representative planar/saddle device output; unit, integration, package, and browser tests cover the
owned implementation.

The frozen unchanged `shape 1.4.6.1` artifact now passes every applicable generic package-check
step, including `example:femmecol`, all other installed examples, and its installed vignette, with
tests correctly classified as absent. This scoped P7 result does not claim exact device pixels,
arbitrary contour topology equivalence, comprehensive graphics compatibility, or arbitrary pure-R
package compatibility.

## Profile 0.513 package-data, formatting, and graphics controls

Installed LazyData metadata may map a documented public object name to a differently named
serialized resource. The mapping is generated from source-package Rd/data metadata, validated at
bundle admission, and used only for lazy resource resolution; public object and `data()` names
remain exact.

`format.pval()` now implements the observed numeric threshold, significant formatting, missing
value, width, names, and public-formals contract. `par(lend=)` accepts exact line-end names and
GNU-compatible nonnegative numeric codes; resolved non-default caps cross the Worker protocol and
render in Canvas, PNG, SVG, PDF, and PostScript. `plot.default()` forwards measured title controls,
`text()` admits recursive plotmath labels, and `data.frame()` distinguishes omitted zero-length
`NULL` arguments from incompatible nonzero rows. Flat, recursive, integration, renderer, and
unchanged-package evidence back this increment.

## Profile 0.514 graphics annotations and leverage diagnostics

`grDevices::as.graphicsAnnot(x)` preserves ordinary non-object values and symbols, calls, formulas,
and other language objects. Classed non-language objects are converted through the ordinary
`as.character` S3 path. This is the shared graphics-annotation coercion boundary; it does not
introduce a package-specific representation.

`stats::hatvalues(model, ...)` is an exported S3 generic. The shared `hatvalues.lm` method obtains
the `hat` component from `lm.influence(model, do.coef = FALSE)` unless an `infl` argument is
supplied, and `glm` objects reuse that method through their `c("glm", "lm")` inheritance. Custom
package methods dispatch through the normal namespace/S3 registry. The recursive GLM comparison uses
a documented `1e-5` absolute/relative tolerance because the existing independent browser IRLS path
is not bit-identical to GNU R's native model implementation.

The unchanged `plotmo 3.7.1` source and mandatory dependency closure produce deterministic artifact
SHA-256 `b14ec30d18a30e3e802d5650ef5b9e9b744e18051cde38d5db4acb886c1f5d21`. Ordered execution closed
the two contracts above and now stops at missing `stats::qqline`. This is P1 package evidence only;
no deeper namespace, lifecycle, example, test, or package-check compatibility is implied.

## Profile 0.516 captured dots, step-function plots, and P6 package evidence

Captured ellipsis entries produced by `match.call(expand.dots = FALSE)` retain the originating
promise while that dynamic frame remains active. Evaluation through nested forwarding therefore uses
the original argument environment; language values retained after frame exit resume ordinary
evaluation in the explicitly supplied environment.

`stats::plot.stepfun` accepts standard step functions or numeric data, computes bounded horizontal
and vertical geometry, forwards graphical controls, returns `list(t, y)` invisibly, and exposes GNU
R's public formals. The unchanged plotmo artifact passes its applicable generic plan at P6. Its
known P7 multi-predictor `abbreviate` blocker remains explicit.

## Profile 0.517 character coercion and plotmo P7 evidence

`abbreviate(names.arg, ...)` now obtains its input through the ordinary `as.character` generic
before applying abbreviation rules. This admits GNU-shaped `NULL`, zero-length, list, pairlist, and
S3-method results while retaining the `named` contract; unsupported values still fail through the
shared character-coercion boundary.

The callable remains capability-declared as shape rather than behavioral: this increment closes the
package-selected coercion seam but does not claim every locale, character-class, or abbreviation
method branch.

The unchanged plotmo artifact passes its independent multi-predictor scenario and complete
applicable generic package-check plan at scoped P7. This closes one pinned package blocker without
claiming arbitrary-package or complete Base compatibility.

## Profile 0.518 numeric single-condition coplot evidence

`graphics::coplot` is now exported with GNU R's public formal names and implements a bounded numeric
`y ~ x | given` path over an explicit data frame. The shape-level slice computes overlapping
conditioning intervals, lays panels out in the browser graphics journal, recycles point symbols and
colours, emits conditioning labels, and returns `NULL` invisibly. Unsupported multi-condition,
custom-panel, axis-label, explicit-layout, and wider graphical-control paths fail with `NRU6237`.

Exact flat and recursive black-box cases freeze the supported return, visibility, and formal shape;
Worker-facing integration additionally freezes panel events and interval labels. The unchanged
`gridGraphics 0.5-1` test advances from missing `coplot` to missing `datasets::quakes`. This is not
a claim of complete `coplot`, graphics, dataset, or package compatibility.

## Profile 0.519 bulk-vector and Math data-frame evidence

Large `:` kernels now allocate under the existing vector/allocation limits but check cancellation,
elapsed time, and execution steps in bounded 4,096-element chunks, matching the established bulk
operator policy. `Math.data.frame` accepts numeric-alike columns, forwards generic arguments to each
column, rebuilds GNU R attribute order, and reports all non-numeric-alike column names. `is.numeric`
now performs ordinary S3 dispatch, including the false Date, POSIXt, and difftime methods. Bulk
`runif`/`rnorm` calls retain exact stream results and final `.Random.seed` state while materializing
that 626-integer state once per vector rather than once per generated scalar.

Flat and recursive GNU R differential cases freeze types, values, attributes, dispatch, diagnostics,
and million-element sequence endpoints. An unchanged `rbenchmark 1.0.1` artifact passes every
applicable package-check step through P7. This evidence does not claim arbitrary data-frame Math,
RNG, performance, or package compatibility beyond the exercised contracts.

## Profile 0.520 exponential and non-central chi-square contract

`stats::pexp` and `stats::qexp` now provide vector recycling, attribute retention, lower/upper
tails, log probabilities, boundary values, domain warnings, and GNU-shaped formals. `dchisq`,
`pchisq`, `qchisq`, and `rchisq` share a bounded non-central Poisson-mixture foundation, including
density, inverse-CDF, random generation, and zero-boundary behavior. Bulk gamma, chi-square, and
exponential generation publishes `.Random.seed` once per vector while retaining periodic
cancellation checks.

Flat and recursive GNU R evidence covers the numeric and reflective contracts. Unchanged
`invgamma 1.2` passes every applicable generic check at P7 under an explicit finite large-browser
resource profile; this is scoped evidence, not a claim of exhaustive distribution or package
support.

## Profile 0.521 Pearson chi-square contract

`stats::chisq.test` supports numeric goodness-of-fit tests with supplied or uniform probabilities,
optional probability rescaling, two-dimensional contingency tables, paired atomic inputs, and Yates'
correction for 2-by-2 tables. The returned `htest` includes GNU-shaped statistic,
degrees-of-freedom, probability, method, data-name, observed, expected, residual, standardized-
residual, names, dimensions, dimnames, and class structure. Small expected cells emit the standard
approximation warning with the active call.

The supported formals match GNU R. Flat, exact recursive, and integration evidence cover the
admitted paths. Unchanged `entropy 1.3.2` reaches scoped P7 through this shared primitive and the
generic package pipeline.

## Profile 0.522 simulated Pearson chi-square contract

`simulate.p.value = TRUE` supports integer-count goodness-of-fit tests and contingency tables with
positive integer margins. Goodness-of-fit replicates use the session's weighted categorical stream;
contingency replicates use an independently implemented AS 159 mode-centred inversion sampler that
preserves both margins. Continuity correction and approximation warnings are disabled on simulated
paths, `parameter` is named missing `df`, and the method reports the requested `B`. Fractional
non-negative finite `B` retains GNU R's observable floor-for-generation and original-denominator
behavior. The statistic comparison, `(extreme + 1) / (B + 1)` correction, random-stream advancement,
complete `htest` graph, and method text have fixed-seed flat, recursive, and integration evidence.

Non-integral count totals/margins fail explicitly; their legacy coercion and warning corner cases
remain outside this profile. This increment closes a reusable Monte Carlo inference seam but does
not imply broad statistical-package or comprehensive GNU R compatibility.

## Profile 0.523 formula-call and model-offset contract

Formula calls and subscripts may contain missing argument positions. NativR preserves those
positions as empty text in term labels (for example `f(x, )`, `x[, 1]`, and `x[1, ]`) and excludes
them from variable discovery. Other unsupported normalized forms still fail with their concrete
feature name.

`glm()` retains its matched call, including canonical formal names, so later language-object
replacement and reevaluation follow GNU R argument matching. Model preparation evaluates every
`offset(...)` formula term, sums multiple formula offsets with an explicit `offset` argument, and
applies the selected-row result in LM and GLM fitting. Flat, recursive Oracle v2, integration, and
unchanged-package evidence cover these contracts; profile 0.523 does not imply general model or
arbitrary-package compatibility.

## Profile 0.524 multinomial shape and optional-example contract

`stats::rmultinom(n, size, prob)` provides integer-matrix shape, probability normalization,
probability-name row labels, zero-size/zero-column and one-hot boundaries, validation, and exact
public formals. Flat and recursive GNU R evidence uses deterministic boundary cases. The current
Bernoulli-backed non-degenerate sampler preserves multinomial invariants but does not claim GNU
`rbinom` algorithm or fixed-seed stream identity.

The public `base::mean.default` method shares the covered numeric/logical mean contract, and Summary
`min`/`max` omit `NULL` arguments. The generic package-check planner marks an example inapplicable
when an unchanged runnable block contains a top-level `require()` for an unavailable declared
Suggests/Enhances dependency; guarded conditional requirements continue to execute.

These changes advance unchanged `nor1mix 1.3-3` to P4. Its first applicable P5 blocker is
`example:norMix2call`, where `stats::deriv` lacks the GNU default method for call input. Complete
symbolic differentiation, exact non-degenerate multinomial random streams, P5-P7, and arbitrary
pure-R package compatibility remain unclaimed.

## Profile 0.525 symbolic differentiation and warning contract

`stats::deriv.default` accepts call, expression, and symbol inputs and constructs executable
normalized-AST derivative expressions or closures. The admitted derivative table covers arithmetic,
general powers, common elementary functions, normal density/distribution functions, and optional
gradient/Hessian attributes. It does not claim GNU's complete derivative table, expression-text
identity, or every simplification rule.

`tools::assertWarning` lazily captures and validates warning-condition classes without leaking the
captured warning, and `.Deprecated` emits a `deprecatedWarning` condition. BFGS `stats::optim`
accepts non-negative `trace` and positive `REPORT` controls and emits GNU-shaped progress records;
nonzero trace for other methods remains an explicit boundary. Flat, recursive Oracle v2, and
integration cases cover these contracts. The unchanged nor1mix artifact remains P4, now blocked by
the unsupported Sheather-Jones `density(..., bw = "sj")` selector rather than `deriv()`.
