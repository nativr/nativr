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
| NativR registered names           |           463 |
| Overlapping callable names        |           448 |
| Missing GNU R callable names      |         2,074 |
| Name overlap                      |      17.7637% |

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
| Data and time      | Factors, frames, arrays, time zones, locales, encodings, connections, serialization, and native data formats                                                                                           | Column-major arrays, coordinate-matrix frames, frame extension, model-frame construction with treatment-coded factors, numeric data-frame/matrix standardization, grouped factor scoring/reordering, `lag`, `start`, `end`, and `time` regular-series coordinates, atomic/matrix/frame/regular-series `na.omit`, UTC/GMT POSIXlt calendar decomposition, inherited Date/POSIXt `weekdays` extraction with deterministic C-locale names, numeric `cut` factor construction, and deterministic C/Italian/US monetary locale-convention profiles have differential evidence; domain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| I/O and platform   | Files, URLs, compression, processes, environment variables, capabilities, and browser-safe host adapters                                                                                               | Deterministic non-interactive browser/Worker mode, GNU R-shaped host-capability selection, evaluator-owned locale query/mutation, truthful classed session information, and transferable graphics commands have initial evidence through `interactive()`, `capabilities()`, `Sys.getlocale()`, `Sys.setlocale()`, `Sys.localeconv()`, `utils::sessionInfo()`, and Worker raster/segment rendering; native devices, profiling, network, arbitrary host locales, filesystem, processes, environment access, package descriptions, and broader host-adapter behavior remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Package execution  | Namespace loading, lazy data, S3/S4 registration, bytecode-equivalent semantics, package resources, and R CMD check behavior                                                                           | Explicit evaluator-session `setAs` registration provides one independently tested coercion extension seam, but namespace loading, automatic registration, lazy data, resources, bytecode-equivalent behavior, and the broader domain remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Graphics           | Devices, graphics state, base graphics, colors, fonts, and browser rendering equivalence                                                                                                               | Initial evidence covers the `graphics::pairs` package-method extension point, complete ordered GNU R 4.6.0 named-color catalog and distinct subset, bounded linear RGB/Lab `colorRampPalette` with isoband's byte-exact Viridis result, deterministic `heat.colors`, owned page/window state, row-first `as.raster` grayscale/RGB(A) conversion, nativeRaster inputs, recycled `rasterImage` placements, posterior-style recycled `segments` with resolved colors/dashes/widths and omission rules, nested `dev.hold`/`dev.flush` command buffering, bounded same-session `recordPlot`/`replayPlot`, Worker transfer, rotation/interpolation fields, and pixel-checked Canvas rendering; complete `pairs.default`, other palette families, color conversion, spline palettes, general devices, `plot`, axes, full graphical parameters, fonts, external/cross-device recorded-plot formats, and rendering equivalence remain incomplete                                                                                                                                                                                                                                                                                                                               |

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
browser RGBA byte order are covered without claiming general `plot`, device capture, raster
index/replacement methods, or complete graphics-device equivalence.

The rank-421 increment adds GNU R differential evidence for ragg's measured `dev.flush()` call shape
and NativR-owned browser-device evidence for paired `dev.hold`. Nested levels, cross-evaluation
command suppression, ordered zero-level release, reset cleanup, namespace access, level coercion,
visible integer returns, and pending-memory limits are covered without claiming the ragg/WebP
device, arbitrary third-party device callbacks, general `plot`, or external display-list formats.

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
discovery, path normalization, existence checks, filesystem access, platform encodings, and
Windows-specific trailing-separator cleanup remain incomplete.

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
depends on the future package loader, virtual package resources, and browser-safe host adapters.

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
resampling remain incomplete and depend in part on the planned package loader.

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
