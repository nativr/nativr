# GNU R compatibility ledger

The long-term objective is complete behavioral compatibility with GNU R 4.6.0 while preserving
NativR's independent browser-native implementation and clean-room constraints. This ledger defines
the real completion boundary. The 25 package-usage groups remain useful for prioritization, but they
are not a substitute for full compatibility.

## Current black-box baseline

`pnpm compatibility:collect` queries a separately installed GNU R only for public namespace names,
callable kinds, and formal argument names. It never reads or serializes implementation bodies.

| Inventory metric                  | Current value |
| --------------------------------- | ------------: |
| GNU R core namespaces inventoried |             7 |
| Exported symbols                  |         2,736 |
| Unique exported callable names    |         2,522 |
| NativR registered names           |           546 |
| Overlapping callable names        |           531 |
| Missing GNU R callable names      |         1,991 |
| Name overlap                      |       21.055% |

Name overlap is not behavioral evidence. A matching name remains incomplete until differential tests
cover its argument matching, types, values, attributes, warnings, errors, visibility, side effects,
and relevant platform behavior.

The committed black-box snapshot is
[`compatibility/gnu-r/surface.json`](../compatibility/gnu-r/surface.json), and the derived report is
[`name-coverage.json`](../compatibility/gnu-r/name-coverage.json). `pnpm compatibility:check`
prevents the report from drifting from NativR's capability manifest.

## Required compatibility domains

| Domain             | Completion requirement                                                                                                                                                                                 | Current evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language syntax    | Every GNU R expression and assignment form normalizes without losing semantics                                                                                                                         | Incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Value types        | NULL, logical, integer, double, complex, character, raw, list, pairlist, expression, symbol, language, environment, closure, builtin/special, promise, external pointer, weak reference, and S4 shapes | Owned pairlist construction, coercion, indexing, replacement, attributes/dimensions, and snapshots now have differential evidence; expression/symbol/language coverage remains initial and the domain is incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Calls and promises | Exact/partial/positional matching, missing arguments, dots, defaults, lazy forcing, quote/eval, substitute/match.call, and visibility                                                                  | Matching, missing state, dots, defaults, caller-formal `match.arg` inference, `force`, `forceAndCall`, `do.call`, delayed assignment, session options with lazy lookup defaults, text parsing, lazy `evalq` plus list/pairlist/data-frame evaluation masks, formula coercion with environment attachment, call construction/matching, bounded `sys.call` frame inspection, substitution, and `withVisible` first-force/already-forced visibility capture have differential evidence; domain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Environments       | Lexical lookup, superassignment, locks, active bindings, namespaces, search path, and parent manipulation                                                                                              | Lexical lookup, explicit environment creation/traversal/evaluation, `$`/`[[` bindings, `get`/`get0`/`exists`, assignment, hash-aware local list conversion with ordered promise forcing, superassignment, and standard startup `search()` inspection have initial differential evidence; attached-package mutation and the domain remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Vector semantics   | Coercion, recycling, names/attributes, NA/NaN/Inf, indexing, replacement, and dispatch across every atomic/list type                                                                                   | Initial complex/raw, `intToUtf8`, mode-specific `as.vector`, primitive `nzchar` coercion, one-dimensional `as.array` default coercion, hexadecimal and Roman integer modes, type/coercion, `diag` construction/extraction, atomic `rle` run encoding, type-aware `setequal`, direct singleton-axis `drop`, and strict recursive `identical` evidence plus arbitrary-dimensional/coordinate-matrix arrays, nested replacement chains, vector/list extension, factor replacement, and data-frame column append behavior; incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Conditions         | Errors, warnings, messages, handlers, restarts, calls, traceback, and warning policy                                                                                                                   | Ordered output, `try`/`tryCatch` error/finally paths, `stop`/`stopifnot`, warnings/messages, suppression, condition messages, session-persistent global calling handlers, and visibility have initial differential evidence; local calling handlers, restarts, traceback, and the broader domain remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Object systems     | Full S3/group generics, S4 classes/generics/method selection/slots, and compatible external object packages                                                                                            | User-defined S3 dispatch now has explicit `UseMethod`/`NextMethod` plus built-in time-series, incomplete-case, factor, array-coercion, scatterplot-matrix, scale, model-accessor, model-weight, density, covariance, confidence-interval, and residual-degree generic evidence; the bounded S4 layer adds the measured `standardGeneric` definition/dispatch shape with explicit and `ANY` methods plus session-local `setAs`/`as` coercion registration and inherited source classes, while multiple dispatch, automatic namespace registration, slots, and the broader domain remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Core namespaces    | Behavioral coverage for base, stats, methods, utils, grDevices, graphics, and datasets                                                                                                                 | Initial differential evidence now includes bounded inspection, deterministic `utils::sessionInfo`, environment-to-list conversion, syntactic name repair, time-series coordinates, incomplete-case omission, factor reordering, hexadecimal/Roman integer modes, registered `utils::as.roman`, matrix scaling, vector/array `outer` products, type-aware `setequal`, small-matrix `eigen`, browser-native `lm`/`aov` fitting, independent `stats::weights`, `stats::density`, and `stats::approx` behavior, session-local `methods::setAs`/`methods::as` coercions, the complete `grDevices::colors`/`colours` name catalog, bounded RGB/Lab `colorRampPalette`, and deterministic `heat.colors`, weighted QR covariance and confidence intervals, central Student-t tails, `IQR`/quantile types, `kmeans` clustering, `convolve`, convex hulls, jitter, interval factors, run encoding, regex extraction, trimming, glob-to-regex conversion, and the initial `graphics::rasterImage`/`segments` paths; domain incomplete                                                                                                                                                                                                                                            |
| Numeric runtime    | Complex arithmetic, special functions, linear algebra, FFT, distributions, optimizers, integration, and deterministic tolerances                                                                       | Decimal and upward-integer rounding, numeric interpolation, bounded `nlm` and general-purpose `optim` BFGS minimization with analytic/numerical derivatives and scaling, real/complex trigonometry through `sin`/`cos`/`tan`, real factorials through direct products and Lanczos gamma approximation, logarithms/exponentials, Cartesian outer products, logistic, normal, and central Student-t probabilities/quantiles, gamma and central/bounded non-central beta generation, vectorized binomial densities, all nine sample-quantile algorithms, posterior-grid probability points, direct-grid Gaussian density estimation, pivoted/unpivoted real Cholesky factors, real symmetric and bounded small asymmetric eigendecomposition, matrix standardization, formula-driven and direct `lsfit` least-squares fitting plus covariance, finite-data clustering, direct/radix-2/Bluestein convolution, planar convex hulls, session RNG-kind selection, and fixed-seed `sample.int` replacement/no-replacement, hash, weighted, and large-population paths have missingness, non-finite, warning, distribution, optimization, geometry, signal, clustering, rank-deficiency, inference, tail, and metadata evidence; the broader numeric domain remains incomplete |
| Data and time      | Factors, frames, arrays, time zones, locales, encodings, connections, serialization, and native data formats                                                                                           | Column-major arrays, coordinate-matrix frames, frame extension, model-frame construction with treatment-coded factors, numeric data-frame/matrix standardization, grouped factor scoring/reordering, bounded delimited-table parsing/writing with type conversion, `lag`, `start`, `end`, and `time` regular-series coordinates, atomic/matrix/frame/regular-series `na.omit`, UTC/GMT POSIXlt calendar decomposition, inherited Date/POSIXt `weekdays` extraction with deterministic C-locale names, numeric `cut` factor construction, and deterministic C/Italian/US monetary locale-convention profiles have differential evidence; domain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| I/O and platform   | Files, URLs, compression, processes, environment variables, capabilities, and browser-safe host adapters                                                                                               | Deterministic non-interactive browser/Worker mode, GNU R-shaped host-capability selection, evaluator-owned locale query/mutation, truthful classed session information, transferable graphics commands, bounded session-local text I/O, and GNU R XDR v2/v3 serialization have evidence through `serialize`/`unserialize`, `saveRDS`/`readRDS`/`infoRDS`, `save`/`load`, gzip, virtual files/connections, and Worker rendering; native devices, profiling, network, arbitrary host locales, host files, other compression/connection classes, processes, environment access, broader serialized graphs, persistence, and broader host-adapter behavior remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Package execution  | Namespace loading, lazy data, S3/S4 registration, bytecode-equivalent semantics, package resources, and R CMD check behavior                                                                           | Standard pure-R source directories and tarballs have build-time repository resolution, bounded archive inspection, deterministic artifacts, dependency/version checks, Collate and portable encoding handling, immutable resources, isolated namespaces, imports/exports, `::`/`:::`, S3 registration, lifecycle hooks, attachment, package source/text data plus XDR/gzip `.rda` and `R/sysdata.rda`, Worker transport, and reset/reload. Unchanged, digest-pinned `pkgconfig 2.0.3`, `generics 0.1.4`, and `withr 3.0.3` sources provide executable evidence for resources, package-owned S3 dispatch, metaprogramming, and a restoring `with_options()` wrapper. Installed `.rdx`/`.rdb` lazy databases, broader namespace directives, native code, S4 namespace registration, bytecode-equivalent behavior, R CMD check, universal package execution, and the broader domain remain incomplete                                                                                                                                                                                                                                                                                                                                                                    |
| Graphics           | Devices, graphics state, base graphics, colors, fonts, and browser rendering equivalence                                                                                                               | Initial evidence covers common session-local `graphics::par` query/update/restore semantics, the `graphics::pairs` package-method extension point, complete ordered GNU R 4.6.0 named-color catalog and distinct subset, bounded linear RGB/Lab `colorRampPalette`, deterministic palettes, owned page/window state, raster/segment/plot primitives, command buffering, display-list replay, Worker transfer, and Canvas rendering; remaining parameters, devices, axes, fonts, external/cross-device formats, layout identity, and rendering equivalence remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

The package-I/O increment adds `readLines`, `writeLines`, and `Sys.sleep`, raising name overlap to
490 of 2,522. Differential cases cover session text roundtrips, separator/output visibility, all
three documented line-ending forms, line limits and short reads, incomplete/NUL handling, invalid
sleep intervals, and invisible zero-duration waits. NativR-only package tests additionally read
DESCRIPTION, NAMESPACE, retained R source, and base64 resources through `system.file()` in inline
and Worker execution. This is not a general filesystem or R-connection claim.

The browser-connection increment adds `file`, `open`, `close`, `flush`, `isOpen`, `seek`, `tempdir`,
and `file.exists`, raising current name overlap to 498 of 2,522. Differential cases cover GNU R's
classed integer handle shape; implicit read/write opens; explicit read, write, append, and update
modes; persistent cursors; summaries; close visibility and destruction; private `file("")`
connections; `cat` and `capture.output` targets; and virtual existence checks. NativR-only cases
reject forged handles, host paths, and writes to installed-package resources. This is a bounded
browser text-connection slice, not a claim for host files, compression, URLs, sockets, raw/binary
I/O, or the complete connection stack.

The package-data/table increment adds `utils::data`, `read.table`, `read.csv`, `read.csv2`,
`read.delim`, `read.delim2`, `write.table`, `write.csv`, and `write.csv2`, raising current name
overlap to 507 of 2,522. Differential cases cover browser-memory CSV roundtrips, quote doubling,
missing values, header/name preservation, type conversion, inline delimited input, and invisible
writes. NativR-only package cases additionally discover and execute unchanged `data/*.R` resources,
load `.csv` package datasets, honor the package's UTF-8/Latin-1 declaration, target explicit
environments, and protect existing bindings. XDR/gzip `.rda` and package `R/sysdata.rda` now use the
bounded GNU R decoder. Installed lazy databases, unsupported graph types/compressors, host files,
URLs, arbitrary encodings, and the full `scan`/column-class surface remain incomplete.

The browser-directory increment adds `R.home`, `dir.create`, `dir.exists`, `list.files`/`dir`,
`list.dirs`, `getwd`, `setwd`, `normalizePath`, `basename`, and `dirname`, raising current name
overlap to 518 of 2,522. Differential cases cover public return shapes, listing and path behavior;
NativR-only integration cases cover nested session directories, relative text/table I/O, bounded
normalization, recursive removal, package-resource enumeration, and a package directory as the
working directory. These are browser-owned virtual roots, not access to host files, symlinks,
permissions, mount points, or an installed GNU R library.

The rank-404 increment adds differential evidence for `anyDuplicated` across atomic vectors,
factors, recursive lists, complete data-frame rows, missing-value distinctions, incomparables,
directional first positions, and independently authored package-method dispatch. This is one bounded
vector/object-system slice, not a claim that data.table or general package execution is available.

The rank-408 increment adds differential evidence for `rep.int` scalar and element-wise repetition
over owned atomic/list/factor/expression values, including coercion, attribute, dispatch, error, and
resource boundaries. It does not imply unbounded GNU R long-vector storage or full internal-method
coverage.

The rank-409 increment adds differential evidence for `methods::representation` as a bounded legacy
S4 declaration-list constructor, including data.table's measured named slots, parent classes,
ordering/names, empty and missing strings, duplicate/type validation, and `setClass`/`new`
integration. It does not imply complete S4 class-definition or methods-package compatibility.

The rank-410 increment adds differential evidence for `trunc` direct and Math-group dispatch through
data.table's measured ITime call shape plus independently implemented toward-zero real-vector
behavior, metadata, missingness, eager dots, and bounded errors. It provides a package extension
seam rather than the data.table class/method or complete built-in date-time truncation.

The rank-411 increment adds differential evidence for `utils::type.convert` through data.table's
measured split-column callback, independently implemented type inference, missing and decimal
controls, factor fallback, matrices, recursive lists/data frames, S3 dispatch, warnings, and bounded
errors. Locale-wide parsing, complete numeral precision-loss policies, and the full utils method
ecosystem remain incomplete.

The rank-414 increment adds differential evidence for `withVisible` through Shiny's two measured
stack-trace examples and owned promise-evaluation results. Literal, assignment, invisible, nested,
block, dynamic-evaluation, lazy-forwarding, forced-promise, result-name, and single-evaluation
behavior are covered without claiming every language construct's visibility semantics.

The rank-419 increment adds differential evidence for `strftime` through Shiny's measured log
timestamp and owned UTC/GMT POSIXlt conversion. Recycled format/value vectors, deterministic
C-locale tokens, fractional seconds, names, missing/non-finite values, timezone labels, custom
dispatch, and bounded errors are covered without claiming named-zone/DST, host-locale, alternate-era
or complete ISO week-year behavior.

The rank-420 increment adds differential evidence for `grDevices::as.raster` through ragg's measured
capture-matrix conversion. Row-first character raster storage, grayscale and RGB(A) conversion,
vector shaping, missing/scaling behavior, S3 methods, predicates, identity, and the downstream
browser RGBA byte order are covered without claiming `plot.raster`, device capture, raster
index/replacement methods, or complete graphics-device equivalence.

The rank-421 increment adds GNU R differential evidence for ragg's measured `dev.flush()` call shape
and NativR-owned browser-device evidence for paired `dev.hold`. Nested levels, cross-evaluation
command suppression, ordered zero-level release, reset cleanup, namespace access, level coercion,
visible integer returns, and pending-memory limits are covered without claiming the ragg/WebP
device, arbitrary third-party device callbacks, specialized plot methods, or external display-list
formats.

The rank-422 increment adds GNU R differential evidence for ragg's measured `recordPlot()` and
`replayPlot(recorded)` call shapes plus NativR-owned same-session display-list behavior. Public
class/type/mode/length shape, metadata retention, invisible replay return, page/window/raster
ordering and bytes, held replay, reset, namespace access, malformed values, and resource limits are
covered. NativR's recorded command representation is independently authored and intentionally
incompatible with GNU R's private serialized format; package reloading, `print.recordedplot`,
arbitrary devices, cross-version/device replay, and full graphics equivalence remain incomplete.

The rank-423 increment adds GNU R differential evidence for posterior's two measured
`quantile(x, ppoints(10))` examples and `stats::ppoints`. Default 3/8-versus-1/2 offsets, scalar and
observation-vector counts, fractional endpoints, numeric/complex offsets, recycling warnings,
names/dimensions, missingness, lazy nonpositive results, namespace access, input errors, and
resource limits are covered. Posterior's `rvar` methods, GNU R long-vector capacity, exhaustive
class-specific arithmetic, and bit-for-bit identity at every floating extreme remain incomplete.

The rank-424 increment adds GNU R differential evidence for posterior's measured `chol.rvar`
extension point and an independently authored real-matrix `chol.default`. Canonical and upper-only
factors, scalar/data-frame inputs, dimnames, positive-definite failures, semi-definite pivot/rank
results, warnings, default-method access, lazy dots, eager tolerance, and defunct/type/shape
boundaries are covered. Posterior's package method, exact LAPACK rounding and error codes, sparse
and tensor methods, complex matrices, indefinite pivoted outputs, and broad decomposition
equivalence remain incomplete.

The rank-425 increment adds GNU R differential evidence for posterior's measured vectorized
`stats::pnorm` example. Recycled real inputs, lower/upper and ordinary/log tails, attributes,
zero-deviation point masses, missing/domain behavior, namespace access, and direct far-log-tail
evaluation are covered. Complex/class-specific inputs, exhaustive subnormal/platform rounding, and
the wider normal-distribution family remain incomplete.

The rank-426 increment adds GNU R differential evidence for posterior's measured scalar
`stats::rgamma` examples. Result lengths, parameter recycling, rate/scale equivalence, deterministic
reseeding, moments, zero/infinite limits, empty and missing parameters, warnings, namespace access,
and invalid inputs are covered. Exact GNU R random-stream identity, exhaustive underflow and
long-vector behavior, class-specific arguments, and the wider gamma family remain incomplete.

The rank-427 increment adds GNU R differential evidence for posterior's measured vertical
`graphics::segments` interval call. Omitted endpoint defaults, coordinate/style recycling, character
and numeric colors, named/numeric/custom line types, widths, missing/non-finite omissions,
zero-length and device errors, namespace access, Worker transport, Canvas pixels, hold/flush, and
same-session record/replay are covered. Coordinate classes, log axes, complete clipping/margins,
general `...` parameters, device-specific dash metrics, and cross-device pixel identity remain
incomplete.

The rank-428 increment adds GNU R differential evidence for rprojroot's measured
`utils::glob2rx("DESCRIPTION")` call. Vectorized wildcard/anchor translation, documented head/tail
trimming, limited regex punctuation escaping, Unicode, missing/NULL and coerced inputs, attribute
removal, namespace access, scalar controls, errors, and resource limits are covered. Filesystem and
platform path matching, arbitrary byte encodings, undocumented escaping, and general regex execution
remain incomplete.

The rank-429 increment adds GNU R differential evidence for httr's two measured `sQuote(req$url)`
calls. C-locale ASCII, explicit UTF-8/TeX, custom quote pairs, option changes, owned-value coercion,
missing/NULL values, attribute removal, errors, and resource limits are covered. Host-locale quote
selection, arbitrary encodings, custom coercion methods, `dQuote`, and lossless formula-source
reconstruction remain incomplete.

The rank-430 increment adds GNU R differential evidence for the `stats::family` S3 generic seam used
by distributional's measured `family(dist)` call. Stats-namespace lookup, lazy dots, ordered
class/`NextMethod`/default resolution, method visibility, and no-method/missing-object errors are
covered. Distributional's object constructors and package method, namespace loading, `family.glm`,
and complete GLM family objects remain incomplete.

The rank-431 increment adds GNU R differential evidence for `utils::View` using rstudioapi's
measured terminal-context display call shape. Owned data-frame/vector/list/array coercion, custom
`as.data.frame` dispatch, non-empty extent and title boundaries, and invisible return behavior are
covered. NativR transports a bounded character-formatted table event to inline and Worker hosts;
desktop windows, editing, arbitrary package formatting, and RStudio terminal APIs remain incomplete.

The rank-433 increment adds GNU R differential evidence for diffobj's measured
`file.path(path.expand("~"), "web", "mycss.css")` expression. `file.path` coercion, recycling,
separators, missing and zero-length components, plus strict character-only `path.expand`, attribute
removal, errors, and resource limits are covered. NativR deliberately exposes no browser home
directory, so leading tildes follow R's documented unknown-home rule and remain unchanged. Host-home
discovery, host-path normalization, host filesystem access, platform encodings, and Windows-specific
trailing-separator cleanup remain incomplete. The later browser-directory increment supplies bounded
normalization and existence checks only for NativR-owned virtual roots.

The rank-434 increment adds GNU R differential evidence for diffobj's measured `setOldClass("zulu")`
registration before its `guidesPrint` S4 method. Session-local class-chain registration, inherited
single-object S4 dispatch, inherited explicit coercion lookup, prototypes, explicit environments,
namespace access, invisible return behavior, and input errors are covered. Namespace-scoped
metadata, registration verification with `test = TRUE`, explicit `S4Class` bridges, multiple
dispatch, full class representations, and methods cache behavior remain incomplete.

The rank-435 increment adds GNU R differential evidence for diffobj's measured
`show(StyleAnsi256LightYb())` extension shape using an independently defined constructor and method.
Exact and inherited S4/old-class method lookup, package-method output, visible and invisible method
results, methods-namespace access, deterministic fallback display, missing/extra arguments, and
output limits are covered. Diffobj's constructors, classes, ANSI/HTML styles, pagers, automatic S4
display on bare expression evaluation, multiple dispatch, and the full methods display protocol
remain incomplete.

The rank-436 increment adds GNU R differential evidence for `utils::capture.output` through httpuv's
measured request-inspection call. It covers nested in-memory stream capture, visible results,
partial lines, message selection, split output, namespace and argument behavior, resource limits,
and the adjacent newline-terminating `cat` shape. Files, connections, arbitrary print methods,
warning/error sinks, and the full connection stack remain incomplete.

The rank-437 increment adds GNU R differential evidence for the empty `utils::demo()` package
catalog's `packageIQR` structure and an explicit browser boundary for external package demo scripts.
NativR does not inspect an installed R library or claim execution of httpuv's `echo` demo. That path
still requires virtual package resources and browser-safe host adapters beyond the source loader.

The rank-438 increment adds GNU R differential evidence for `RNGversion` through zoo's repeated
R-3.5 reproducibility setup. It covers version parsing, prior-kind return and invisibility, Rounding
warnings, the R-3.6 Rejection transition, and the fixed-seed normal sequence used after the measured
call. Defaults before R 1.7 require historical uniform and normal engines and remain an explicit
unsupported boundary.

The ranks 439-443 increment adds GNU R differential evidence for the regular time-series chain
needed beneath zoo's measured calls. `stats::ts` covers vector and matrix construction, calendar
coordinates, endpoint-driven recycling, names, classes, and `tsp`; `as.ts` and `frequency` cover
default behavior plus S3 forwarding; and `stats::window` covers aligned subsetting, integral
downsampling, extension padding, clamping warnings, and package-method forwarding. The S3 seam is
tested with an independently declared `window.zoo` equivalent, not zoo implementation code.
Irregular indexes, zoo constructors/methods, replacement windows, data-frame coercion, and arbitrary
resampling remain incomplete; an audited zoo bundle would also need those runtime features.

The rank-444 increment adds GNU R differential evidence for all three `graphics::legend` call shapes
measured in zoo's documentation. The browser-owned subset covers positional or named labels,
keyword/coordinate placement, line and point keys, palette or named colors, text colors, boxes,
backgrounds, titles, columns, horizontal layout, inset, `plot = FALSE`, invisible geometry results,
Worker transport, Canvas rendering, output limits, and same-session record/replay. It does not claim
GNU R's complete text metrics, margins/clipping, expression labels, fill/density keys, arbitrary
graphical `...`, device-specific placement, or zoo package loading.

The rank-445 increment adds GNU R differential evidence for zoo's paired `comment(x) <- value` and
`comment(x)` calls. Character vectors, missing comments, absent attributes, `NULL`/empty removal,
replacement visibility, preservation of other attributes, and the equivalent `attr<-` validation
path are covered for owned attributed sequences. GNU R also permits comments on closures,
environments, and language objects; those require NativR's future general attribute model and remain
explicitly unsupported for replacement.

The rank-446 increment adds GNU R differential evidence for zoo's two measured `cycle` calls.
Regular vector and matrix-row series, default frequency-one inputs, calendar starts, fractional
frequencies, `tsp`/`ts` metadata, namespace access, lazy dots, errors, and allocation limits are
covered. An independently declared `cycle.zoo` method verifies the S3 package seam without copying
or claiming zoo's irregular-series implementation, index storage, or package loading.

The rank-447 increment adds GNU R differential evidence for zoo's two measured `signif` plot-limit
calculations. Real and complex vectors, decimal ties-to-even, recycled and clamped digit controls,
missing and non-finite values, signed zero, attributes, direct/Math S3 dispatch, errors, and
allocation limits are covered. This is a bounded browser-number implementation, not a claim of
bit-for-bit identity for every platform decimal conversion or complete S4 Math2 behavior.

The rank-448 increment adds GNU R differential evidence for zoo's measured `axTicks(4)` call and the
adjacent linear-axis shapes. State-derived x/y ticks, explicit `axp`, ascending and descending axes,
side coercion, the observed `floor(abs(intervals) + 0.25)` conversion, lazy linear-only arguments,
namespace access, errors, and allocation limits are covered. The independently authored spacing path
targets the measured 1/2/5-power-of-ten ranges. A common session-local `par()` subset now supports
query/update/restore wrappers, but `par("xaxp"/"yaxp")`, logarithmic axes, complete `pretty`
boundary identity, and actual axis drawing remain explicit incomplete graphics work.

The rank-449 increment adds GNU R differential return/visibility evidence and browser-host evidence
for zoo's measured `box()` call. The plot-region path covers all documented `bty` edge shapes,
unique-prefix `which`, `col` then `fg` fallback, normalized line types, strictly positive widths,
transparent/no-frame suppression, namespace access, unknown-parameter warnings, output limits,
Worker transfer, Canvas pixels, and same-session record/replay. Figure, inner, and outer regions
await a browser margin/layout model; arbitrary graphical parameters and device-pixel identity are
not claimed.

The rank-450 increment adds GNU R differential evidence and browser-host evidence for zoo's measured
`boxplot()` call. Numeric vectors, grouped lists, and matrix columns produce Tukey hinges, whiskers,
notch confidence limits, outliers, counts, names, and group indices in the standard invisible result
shape. S3 forwarding, missing/empty groups, range and width controls, orientation, notches,
outlines, colors, line styles, `add`, output limits, Worker transfer, Canvas pixels, and owned
record/replay have executable coverage. Formula/data-frame methods, logarithmic axes, arbitrary
`pars`, complete annotation/axes, every legacy diagnostic, and device-identical layout remain
incomplete.

The rank-451 increment adds GNU R differential evidence for zoo's measured `deltat(z)` regular
sampling-interval call. The generic dispatches to independently declared package methods with lazy
dots; its default returns an unnamed visible double equal to one for ordinary inputs or the
reciprocal of validated `tsp` frequency. Vectors, matrices, expressions, closures, namespace access,
visibility, and malformed metadata have adjacent coverage. Zoo's irregular index inference and
methods remain package-owned, and loading zoo still requires an audited bundle whose dependencies
fit the supported pure-R package and runtime contracts.

The rank-452 increment adds GNU R differential evidence for zoo's documented `embed(1:5, 3)`
rolling-window dependency. Supported atomic/list vectors preserve storage, while matrices apply GNU
R's integer/logical-to-double and factor-to-character coercions; both produce current-to-past lag
columns with column-major ordering and only result dimensions retained. Multivariate inputs, regular
`ts` attribute removal, zero-column matrices, integer/logical and measured fractional-vector
dimensions, namespace access, errors, and allocation limits have coverage. Factor vectors, data
frames, expression vectors, raw/list matrices, higher arrays, fractional nonempty-matrix dimensions,
and exact undocumented diagnostics remain explicitly incomplete.

The rank-453 increment adds GNU R differential evidence for zoo's measured
`seq_along(tt) - findInterval(tt - 3, tt)` irregular-Date rolling-width expression. Weakly sorted,
duplicate, empty, single, finite, and infinite break vectors; default and left-open intervals;
rightmost closure; `all.inside`; missing/NaN queries; flattened atomic numeric coercion; control
coercion; namespace access; result type/attributes; errors; and bounded binary-search steps have
coverage. Unsafe unchecked invalid break vectors, recursive-list coercion, exact diagnostics, and
long-vector indices remain incomplete.

The rank-454/455 increment adds GNU R differential evidence for zoo's measured
`gray.colors(2, start = 0.7)` and `grey(7:1/8)` calls. The documented `gray`/`grey` and
`gray.colors`/`grey.colors` aliases, default/custom/descending gamma-corrected palettes, byte-exact
RGB(A) formatting, scalar/recycled alpha, reversal, zero/fractional counts, atomic gray-level
coercion, namespace access, attribute removal, errors, and allocation limits have coverage.
Vector-valued palette controls, direct alpha vectors longer than the level input, exact diagnostics,
device color profiles, and long vectors remain incomplete.

The rank-456 increment adds GNU R differential evidence for zoo's measured
`ISOdatetime(2003, 2, c(1, 3, 7, 9, 14), 0, 0, 0)` POSIXct index shape. Required clock fields,
component recycling, fractional seconds, explicit UTC/GMT values and labels, default-zone relative
spacing, POSIXct/POSIXt class and `tzone` metadata, years 0:9999, missing/non-finite/non-integral/
invalid components, empty inputs, namespace access, errors, and allocation limits have coverage.
Regional zones and daylight-saving transitions, the host-dependent absolute value of `tz = ""`,
platform-specific invalid-time normalization, broad character coercion, exact diagnostics, and long
vectors remain incomplete.

The rank-457 increment adds GNU R differential evidence for zoo's measured `persp(1:nO, 1:nC, zz)`
call over a classed numeric matrix. S3 package-method forwarding, default/explicit grids, scaled and
aspect-preserving normalization, `theta`/`phi` rotations, `r`/`d` perspective controls, `expand`,
missing cells, ascending-grid and dimension validation, invisible `4 × 4` matrix shape and
coefficients, namespace access, browser graphics output, same-session replay, errors, and allocation
limits have coverage. The owned browser renderer emits the default white/black projected wireframe
and box through resolved segment commands. Colored facets, shading, detailed ticks/text, hidden-line
equivalence, hooks, arbitrary graphical parameters, `trans3d`, exact diagnostics, and cross-device
pixel identity remain incomplete. The `axes` flag is validated, but axis arrows, ticks, and text
remain unsupported.

The rank-458 increment adds GNU R differential evidence for zoo's documented
`points.zoo(x, y = NULL, type = "p", ...)` extension point and adjacent default calls. S3
package-method forwarding, invisible default results, paired/vector/matrix/data-frame/list/complex
coordinates, equal-length validation, numeric symbols 0:25, printable-ASCII/negative-Unicode and
literal characters, recycled colors/fills/sizes/widths, missing/non-finite/style omission, namespace
access, Worker protocol output, Canvas pixels, same-session replay, malformed-record rejection,
errors, and allocation/output limits have coverage. Line/path types, locale-dependent glyph codes,
character coordinate coercion, broader coordinate classes, clipping/log axes, exact device
font/symbol sizing, arbitrary graphical parameters, exact diagnostics, and cross-device pixel
identity remain incomplete.

The rank-459 increment adds GNU R differential evidence for zoo's measured filled-area `polygon`
call. Paired/vector/matrix/data-frame/list/complex coordinates, equal-length validation,
missing/non-finite polygon splitting, invisible results, recycled fill/border colors, line
types/widths, logical borders, `fillOddEven`, `density = 0`, solid density modes, namespace access,
Worker protocol output, Canvas fill/border pixels, same-session replay, malformed-record rejection,
errors, and allocation/output limits have coverage. Positive hatch density, coordinate classes
beyond owned numeric storage, clipping/log axes, exact device dash/fill metrics, arbitrary graphical
parameters, exact diagnostics, and cross-device pixel identity remain incomplete.

The rank-460 increment adds GNU R differential evidence for zoo's measured
`replace(x, 1:min(length(x)), 3)` missing-run helper. Input immutability,
numeric/logical/character/negative/zero/empty/missing subscripts, recycling and promotion,
names/extension, matrix metadata, factors, lists, pairlists, owned data frames, `NULL`
materialization/deletion, partial argument matching, namespace access, warnings, errors, and
allocation limits have coverage. Expression vectors, arbitrary class-specific `[<-` methods,
recursive objects outside the owned value model, exact legacy diagnostics, and long-vector behavior
remain incomplete.

The rank-461 increment adds GNU R differential evidence for zoo's measured `rlnorm(200, mean = 1)`
flow generator. Historical Mersenne-Twister/Inversion fixed-seed values, scalar/vector `n`,
truncated counts, recycled `meanlog`/`sdlog`, attribute removal, zero-deviation point masses without
RNG advancement, empty parameters, missing/NaN and non-finite/domain behavior, one aggregate
warning, namespace access, errors, and allocation limits have coverage. Alternative normal
generators, bit identity outside the Inversion path, exact platform diagnostics, long vectors, and
the `dlnorm`/`plnorm`/`qlnorm` family remain incomplete.

The rank-462 increment adds GNU R differential evidence for zoo's measured
`tapply(1:ncol(x), screens, f)` screen-range grouping path. One and multiple atomic grouping
vectors, factor-level order, missing-group omission, dimensions/dimnames, scalar atomic
simplification, typed defaults, unsimplified list arrays, forwarded callback arguments, function
names, `FUN = NULL` group codes, list-array extraction, errors, and allocation limits have coverage.
Formula indexes, custom split methods, raw/list-scalar coercion corners, class-specific
simplification, exact diagnostics, and long vectors remain incomplete.

The rank-463 increment adds GNU R differential shape evidence for zoo's measured rotated
`graphics::text` series label. S3 dispatch, paired and container coordinates, unequal x/y recycling,
label coercion/recycling/truncation, missing omission, colors, size, four font faces,
position/adjustment/offset, rotation, family, `xpd`, invisible return, namespace access, Worker and
Canvas transport, recording/replay, malformed records, errors, and resource limits have coverage.
Plotmath, Hershey fonts, class-specific label coercion, clipping/log axes, arbitrary graphical
parameters, exact diagnostics, long vectors, and device-identical metrics remain incomplete.

The rank-464 increment adds GNU R differential shape evidence for the `stats::update` S3 extension
point used by zoo's documented lattice call. Original classed objects, lazy dots, inherited method
selection, `NextMethod`, direct and namespace-qualified access, visibility, missing-object errors,
and independently authored `update.default` methods have coverage. NativR does not implement or copy
lattice's package-owned `update.trellis`; GNU R's built-in stored-call extraction, call rewriting,
formula updates, and optional re-evaluation remain incomplete.

The rank-465 increment adds GNU R differential shape evidence for bit64's measured
`graphics::matplot` calls. One- and two-argument numeric vectors, matrices, and data frames,
generated x coordinates, cycled columns, incomplete-pair omission, point/line/both/overplotted/
no-draw types, logarithmic coordinate resolution, style recycling, invisible return, namespace
access, Worker/Canvas output, recording/replay, errors, and resource limits have coverage. Complete
axes and annotation, class-specific `plot`/`lines` dispatch, `add = TRUE`, remaining plot types,
date/time axes, exact diagnostics, long vectors, and device-identical layout remain incomplete.

The rank-470 increment adds GNU R behavioral differential evidence for bit64's measured
`base::aperm(A, 2:1)` requirement and the public `aperm.default` path. Numeric and named axis
permutations, reverse defaults, resized and fixed-shape dimensions, permuted/dropped dimnames,
atomic/list arrays, user and inherited S3 methods, `NextMethod`, lazy dots, direct/namespace access,
attribute cleanup, errors, and resource limits have coverage. `aperm.table`, malformed low-level
attributes, exact diagnostics, long vectors, and broader package-defined array classes remain
incomplete.

The rank-471 increment adds GNU R behavioral differential evidence for bit64's measured
`dput(d, fi64)`/`dget(fi64)` classed-column roundtrip. `tempfile`, `dput`, `dget`, and `unlink`
share an evaluator-owned, session-local text map; canonical source is reparsed through the owned
parser and normalized AST. Atomic/list/pairlist values, ordinary attributes, data-frame shape,
missing/NaN/infinite values, complex/raw values, Unicode, visibility, errors, and resource limits
have coverage. Host filesystem and connection semantics, externally written text, arbitrary
controls, closure/environment graphs, cycles, binary formats, compression, and persistence remain
incomplete. NativR-only tests cover explicit wrappers for nested symbols, calls, and expression
vectors; these are not counted as GNU R differential evidence because GNU R's text representation
may evaluate such nested language objects during `dget`.

The adjacent workspace increment adds GNU R behavioral differential evidence for bit64's observed
`save(e, file); rm(e); load(file)` flow. Direct and `list=` object selection, duplicate names,
target environments, promise forcing, verbose output, return visibility, format controls, missing
objects, and invalid archives are covered. The serialization increment replaces the former private
archive with bounded GNU R XDR v2/v3 and gzip, adds `serialize`/`unserialize` and
`saveRDS`/`readRDS`/`infoRDS`, and raises current name overlap to 523 of 2,522. Exact black-box GNU
R bytes, raw roundtrips, external package `.rda`, and `R/sysdata.rda` have evidence. Broader graph
types, installed lazy-load databases, other compressors, host files, and persistence remain
incomplete.

The pure-R installation increment adds a Node-only build-time packager for standard source
directories and tarballs plus CRAN-like repository dependency closure resolution. It preserves
metadata and resources, selects and records platform-specific R sources, applies Collate order and
portable encodings, rejects native/install-hook surfaces, emits SHA-256 artifacts and locks, and
passes them to the existing Worker loader. The opt-in external test downloads unchanged
`pkgconfig 2.0.3`, `generics 0.1.4`, and `withr 3.0.3`, pins each resulting artifact digest, and
executes package-resource, S3-dispatch, and state-restoring wrapper paths without source rewrites.
The `withr` proof drove general call-rooted replacement, `formals<-`, `environment<-`, `bquote`,
list-backed environments, dynamic caller-frame, hook-registry, closure-like builtin-formal, and
`graphics::par` work. These three package/version proofs are not universal package compatibility.

This metaprogramming/package increment adds eight overlapping GNU R names and raises current name
overlap to 531 of 2,522. Each added behavior has checked-in differential evidence; the unchanged
external package tests remain opt-in because they require repository access.

The rank-22 plot increment adds GNU R differential shape evidence for the highest-reach previously
absent core name. `base::plot` dispatches user and registered package S3 methods before the owned
`graphics::plot.default`; custom method values and visibility are preserved. Numeric one-vector and
paired-coordinate calls cover regular linear range padding, point/line/both/overplotted/histogram/
step/no-draw geometry, common styles, panel hooks, scalar character annotations, invisible default
returns, Worker/Canvas output, display-list replay, errors, and allocation limits. Complete axes and
auto labels, log/aspect layout, formula/function/time-series/raster and other core methods,
margins/clipping, arbitrary graphical controls, exact diagnostics, long vectors, and
device-identical rendering remain incomplete.

## Completion evidence

The objective is complete only when:

1. Every domain above has an executable differential-test suite against the pinned GNU R version.
2. Every inventoried callable has declared evidence or an explicitly verified platform
   non-applicability rule; name overlap alone never counts.
3. A broad clean-room corpus covers language semantics, documented examples, serialization fixtures,
   package namespace behavior, and independently written R CMD check scenarios.
4. Results are verified across supported browsers and operating systems with documented numeric,
   locale, time-zone, graphics, and host-adapter tolerances.
5. The compatibility ledger, runtime capability manifest, public API, and generated reports agree.

Until all five conditions hold, NativR must describe itself as incomplete GNU R compatibility.
