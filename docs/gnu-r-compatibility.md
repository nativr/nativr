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
| NativR registered names           |           594 |
| Overlapping callable names        |           578 |
| Missing GNU R callable names      |         1,944 |
| Name overlap                      |       22.918% |

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
| Environments       | Lexical lookup, superassignment, locks, active bindings, namespaces, search path, and parent manipulation                                                                                              | Lexical lookup, explicit environment creation/traversal/evaluation, `$`/`[[` bindings, `get`/`get0`/`exists`, assignment, hash-aware local list conversion with ordered promise forcing, superassignment, environment/binding locks, function-backed active-binding reads/writes/inspection, and standard startup `search()` inspection have differential evidence; active-binding substitution, attached-package mutation, and the domain remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Vector semantics   | Coercion, recycling, names/attributes, NA/NaN/Inf, indexing, replacement, and dispatch across every atomic/list type                                                                                   | Initial complex/raw, `intToUtf8`, mode-specific `as.vector`, primitive `nzchar` coercion, one-dimensional `as.array` default coercion, hexadecimal and Roman integer modes, type/coercion, `diag` construction/extraction, atomic `rle` run encoding, type-aware `setequal`, direct singleton-axis `drop`, and strict recursive `identical` evidence plus arbitrary-dimensional/coordinate-matrix arrays, nested replacement chains, vector/list extension, factor replacement, and data-frame column append behavior; incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Conditions         | Errors, warnings, messages, handlers, restarts, calls, traceback, and warning policy                                                                                                                   | Ordered output, `try`/`tryCatch` error/finally paths, `stop`/`stopifnot`, warnings/messages, suppression, condition messages, session-persistent global calling handlers, and visibility have initial differential evidence; local calling handlers, restarts, traceback, and the broader domain remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Object systems     | Full S3/group generics, S4 classes/generics/method selection/slots, and compatible external object packages                                                                                            | User-defined S3 dispatch now has explicit `UseMethod`/`NextMethod` plus built-in time-series, incomplete-case, factor, array-coercion, scatterplot-matrix, scale, model-accessor, model-weight, density, covariance, confidence-interval, and residual-degree generic evidence; the bounded S4 layer adds the measured `standardGeneric` definition/dispatch shape with explicit and `ANY` methods plus session-local `setAs`/`as` coercion registration and inherited source classes, while multiple dispatch, automatic namespace registration, slots, and the broader domain remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Core namespaces    | Behavioral coverage for base, stats, methods, utils, grDevices, graphics, and datasets                                                                                                                 | Initial differential evidence now includes bounded inspection, deterministic `utils::sessionInfo`, environment-to-list conversion, syntactic name repair, time-series coordinates, incomplete-case omission, factor reordering, hexadecimal/Roman integer modes, registered `utils::as.roman`, matrix scaling, vector/array `outer` products, type-aware `setequal`, small-matrix `eigen`, browser-native `lm`/`aov` fitting, independent `stats::weights`, `stats::density`, and `stats::approx` behavior, session-local `methods::setAs`/`methods::as` coercions, the complete `grDevices::colors`/`colours` name catalog, bounded RGB/Lab `colorRampPalette`, polar CIE-LUV `hcl`, and deterministic `heat.colors`, weighted QR covariance and confidence intervals, central Student-t tails, `IQR`/quantile types, `kmeans` clustering, `convolve`, convex hulls, jitter, interval factors, run encoding, regex extraction, trimming, glob-to-regex conversion, and the initial `graphics::rasterImage`/`segments` paths; domain incomplete                                                                                                                                                                                                                       |
| Numeric runtime    | Complex arithmetic, special functions, linear algebra, FFT, distributions, optimizers, integration, and deterministic tolerances                                                                       | Decimal and upward-integer rounding, numeric interpolation, bounded `nlm` and general-purpose `optim` BFGS minimization with analytic/numerical derivatives and scaling, real/complex trigonometry through `sin`/`cos`/`tan`, real factorials through direct products and Lanczos gamma approximation, logarithms/exponentials, Cartesian outer products, logistic, normal, and central Student-t probabilities/quantiles, gamma and central/bounded non-central beta generation, vectorized binomial densities, all nine sample-quantile algorithms, posterior-grid probability points, direct-grid Gaussian density estimation, pivoted/unpivoted real Cholesky factors, real symmetric and bounded small asymmetric eigendecomposition, matrix standardization, formula-driven and direct `lsfit` least-squares fitting plus covariance, finite-data clustering, direct/radix-2/Bluestein convolution, planar convex hulls, session RNG-kind selection, and fixed-seed `sample.int` replacement/no-replacement, hash, weighted, and large-population paths have missingness, non-finite, warning, distribution, optimization, geometry, signal, clustering, rank-deficiency, inference, tail, and metadata evidence; the broader numeric domain remains incomplete |
| Data and time      | Factors, frames, arrays, time zones, locales, encodings, connections, serialization, and native data formats                                                                                           | Column-major arrays, coordinate-matrix frames, frame extension, model-frame construction with treatment-coded factors, numeric data-frame/matrix standardization, grouped factor scoring/reordering, bounded delimited-table parsing/writing with type conversion, `lag`, `start`, `end`, and `time` regular-series coordinates, atomic/matrix/frame/regular-series `na.omit`, UTC/GMT POSIXlt calendar decomposition, inherited Date/POSIXt `weekdays` extraction with deterministic C-locale names, numeric `cut` factor construction, and deterministic C/Italian/US monetary locale-convention profiles have differential evidence; domain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| I/O and platform   | Files, URLs, compression, processes, environment variables, capabilities, and browser-safe host adapters                                                                                               | Deterministic non-interactive browser/Worker mode, GNU R-shaped host-capability selection, evaluator-owned locale query/mutation, truthful classed session information, transferable graphics commands, bounded session-local text/raw-binary reads, lazy explicit-host URL input, a PNG file device, and GNU R XDR v2/v3 serialization have evidence through `serialize`/`unserialize`, `saveRDS`/`readRDS`/`infoRDS`, `save`/`load`, gzip, virtual files/connections, raw `readBin`, and Worker rendering; native host devices, profiling, ambient/native networking, arbitrary host locales, host files, other compression/connection classes, typed binary I/O, processes, environment access, broader serialized graphs, persistence, and broader host-adapter behavior remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Package execution  | Namespace loading, lazy data, S3/S4 registration, bytecode-equivalent semantics, package resources, and R CMD check behavior                                                                           | Standard pure-R source directories and tarballs have build-time repository resolution, bounded archive inspection, deterministic artifacts, dependency/version checks, Collate and portable encoding handling, immutable resources, installed example/vignette indexes, isolated namespaces, imports/exports, `::`/`:::`, qualified S3 registration, lifecycle hooks, attachment, package source/text data plus XDR/gzip `.rda` and `R/sysdata.rda`, Worker transport, and reset/reload. Unchanged, digest-pinned `pkgconfig 2.0.3`, `generics 0.1.4`, `withr 3.0.3`, and `R6 2.6.1` sources provide executable evidence for resources, package-owned S3 dispatch, metaprogramming, state-restoring wrappers, and R6 reference objects with public/private method state and an active read/write field. Installed `.rdx`/`.rdb` lazy databases, raw development-vignette building, broader namespace directives, native code, S4 namespace registration, bytecode-equivalent behavior, R CMD check, universal package execution, and the broader domain remain incomplete                                                                                                                                                                                             |
| Graphics           | Devices, graphics state, base graphics, colors, fonts, and browser rendering equivalence                                                                                                               | Evidence covers common session-local `graphics::par` query/update/restore semantics, a numbered browser/PNG `dev.cur`/`dev.list`/`dev.off`/`graphics.off` lifecycle, standards-compliant RGBA PNG output, the `graphics::pairs` package-method extension point, complete ordered GNU R 4.6.0 named-color catalog and distinct subset, bounded linear RGB/Lab `colorRampPalette`, polar CIE-LUV `hcl`, deterministic palettes, owned page/window state, bounded linear `axis` ticks/labels, raster/segment/plot primitives, command buffering, display-list replay, Worker transfer, and Canvas rendering; remaining parameters, non-PNG devices, complete device switching, logarithmic/date axes, font metrics, external/cross-device formats, layout identity, and rendering equivalence remain incomplete                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

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
and the adjacent newline-terminating `cat` shape. Browser-memory files and owned connections are
supported; arbitrary print methods and host filesystem targets remain incomplete. The later rank-330
increment adds persistent output/message diversion through `base::sink` and `sink.number`, including
nested restoration, split tees, connection lifecycle, and cross-evaluation state.

The rank-338 increment adds GNU R 4.6 differential evidence for sass's measured `base::write`
source-line call and the reusable atomic writer beneath it. Exact formals/defaults, character and
numeric column layout, separator-vector repetition, final newlines, underlying matrix/factor
storage, append, closed/open connections, visibility, errors, and bounds are covered. The same
unchanged helper executes from a source-only package in the default Worker; host files and native
encoding/newline identity remain explicit boundaries.

The rank-340 increment adds GNU R 4.6 differential evidence for curl's measured
`utils::available.packages(repos = mirror)` database path and adjacent `contrib.url`. Exact formals,
source/binary contribution paths, standard matrix fields, extra/missing fields, DCF continuation,
R-version/OS/subarchitecture/duplicate and custom filters, session caching, headers, empty results,
errors, and bounds are covered. Repository bytes cross only the explicit URL seam; the unchanged
source-package helper executes in the Worker without granting ambient network or filesystem access.

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
query/update/restore wrappers, but `par("xaxp"/"yaxp")`, logarithmic axes, and complete `pretty`
boundary identity remain explicit incomplete graphics work. A later usage-ranked increment supplies
bounded linear axis drawing over this tick state.

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

The rank-343 increment adds GNU R 4.6 black-box evidence for zoo and bit64's three measured
`barplot()` calls. Vector and matrix heights reproduce GNU R midpoint return shapes for default,
stacked, beside, custom-width, and custom-spacing layouts; `plot = FALSE` remains visible while
drawing returns the same value invisibly. The generic preserves package-owned S3 methods, including
source-only package namespaces, and the default routes resolved rectangles, linear axes, names,
annotations, and legends through the existing bounded Worker graphics journal. Log coordinates,
positive density hatching, exact device typography/margins, and the full graphical-parameter surface
remain declared gaps.

The rank-344 increment adds GNU R 4.6 black-box and browser-host evidence for RColorBrewer's ten
measured `devAskNewPage(ask = TRUE)` calls. Exact formals, visible queries, invisible updates that
return the previous flag, first-element logical coercion, invalid-value errors, per-device state,
and `options("device.ask.default")` initialization match the audited paths. The browser device
pauses only before replacing an existing page and only when an explicit interactive `readline`
adapter is present; the request crosses the default Worker protocol. First pages, non-interactive
sessions, and PNG/PDF devices remain nonblocking. Native screen devices and their platform event
loops are not claimed.

The rank-345 increment adds shape-level GNU R 4.6 black-box evidence for ps's measured
`vapply(getLoadedDLLs(), "[[", character(1), "path")` probe. NativR matches the no-argument formals,
visible list/mode/class contract, named character path projection, and class-preserving empty
subset. The runtime truthfully reports zero entries by default because GNU R's process-loaded DLL
contents are platform state, not values NativR imitates. Explicit `nativeModules` produce owned
records with virtual paths and `NULL` handles; `.Call` can resolve those registered names through
the typed adapter. GNU DLLInfo handle classes, arbitrary symbol objects, automatic compiled-package
registration, and ps's native library inspection remain gaps.

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
`pkgconfig 2.0.3`, `generics 0.1.4`, `withr 3.0.3`, and `R6 2.6.1`, pins each resulting artifact
digest, and executes package-resource, S3-dispatch, and state-restoring wrapper paths without source
rewrites. The `withr` proof drove general call-rooted replacement, `formals<-`, `environment<-`,
`bquote`, list-backed environments, dynamic caller-frame, hook-registry, closure-like
builtin-formal, and `graphics::par` work. The R6 proof additionally drove shim precedence, qualified
S3 registration, environment/closure attributes, NULL-as-empty operator/application behavior,
environment and binding locks, function-backed active bindings, and non-dispatching subset
primitives. The unchanged R6 proof now also exercises private state and an active read/write field.
These four package/version proofs are not universal package compatibility.

This metaprogramming/package increment adds eight overlapping GNU R names and raises current name
overlap to 531 of 2,522. Each added behavior has checked-in differential evidence; the unchanged
external package tests remain opt-in because they require repository access.

The browser-device lifecycle increment adds `dev.cur`, `dev.list`, `dev.off`, and `graphics.off`,
raising current name overlap to 535 of 2,522. One session-owned device reports device number 2,
falls back to GNU R's named null device 1, flushes held journal commands on close, resets its
`par()` state, and can be reopened by the next plot. The later PNG increment replaces the original
single-device restriction with a numbered registry; broader device classes and cross-device pixel
equivalence remain incomplete.

The browser-timing increment adds the usage-ranked `system.time` and adjacent `proc.time`, raising
current name overlap to 537 of 2,522. Differential evidence covers one lazy evaluation, side
effects, visible five-field `proc_time` shape, names/class/missingness, monotonic elapsed time, and
session-relative process-time queries. NativR reports zero process CPU and missing child-process
fields because browsers expose neither counter; `gcFirst` is validated but cannot force host GC.
Exact timing resolution, CPU/child accounting, and `print.proc_time`/`summary.proc_time` remain
incomplete.

The browser-PNG increment adds usage-ranked `grDevices::png` and raw `base::readBin`, raising
current name overlap to 539 of 2,522. Five sampled packages account for seven measured `png` calls.
The implementation opens PNG and browser devices concurrently, isolates and restores each device's
`par()` state, records the shared graphics vocabulary, rasterizes pages without DOM/native code,
writes valid compressed RGBA PNG chunks into the bounded session store, supports numbered multi-page
names, and exposes raw bytes for package-side inspection. Differential evidence covers open/close
visibility, zero-byte creation, signature, dimensions, and device return values; integration
evidence also decompresses IDAT pixels. Exact font metrics, anti-aliasing, color management, typed
`readBin`, non-PNG file devices, and pixel identity remain incomplete.

The rank-22 plot increment adds GNU R differential shape evidence for the highest-reach previously
absent core name. `base::plot` dispatches user and registered package S3 methods before the owned
`graphics::plot.default`; custom method values and visibility are preserved. Numeric one-vector and
paired-coordinate calls cover regular range padding, point/line/both/overplotted/histogram/
step/no-draw geometry, common styles, panel hooks, scalar character annotations, invisible default
returns, Worker/Canvas output, display-list replay, errors, and allocation limits. A later
usage-ranked increment adds positive base-10 coordinate transforms for requested logarithmic axes.
Complete automatic axes and labels, log-aware additive geometry, fixed-aspect layout,
formula/function/time-series/raster and other core methods, margins/clipping, arbitrary graphical
controls, exact diagnostics, long vectors, and device-identical rendering remain incomplete.

The character-encoding increment added `Encoding`, `Encoding<-`, `enc2native`, and `enc2utf8`,
raising name overlap at that increment to 543 of 2,522. Rank-144 `Encoding` accounts for 12 observed
calls across three sampled package manuals and 4.5% download-weighted reach. Each character element
now owns exact bytes plus an `unknown`, `latin1`, `UTF-8`, or `bytes` mark; ASCII and missing
strings canonicalize to `unknown`. GNU R 4.6 differential evidence covers query/replacement, exact
label acceptance, recycling, attribute preservation, raw-byte reinterpretation, conversion, subset
writeback evaluation count, and XDR mark/byte roundtrips. Browser-native encoding is deterministic
UTF-8. General `iconv`, host locale codecs, normalization, malformed-byte display, and complete
encoding-sensitive string behavior remain incomplete.

The Cauchy-distribution increment adds `stats::dcauchy`, `pcauchy`, `qcauchy`, and `rcauchy`,
raising current name overlap to 547 of 2,522. Rank-149 `rcauchy` represents four documented calls
across three sampled package manuals and 4.2% download-weighted reach. GNU R 4.6 differential
evidence covers formals, vector recycling, attributes, seeded draw ordering, zero-scale RNG
preservation, density/CDF/quantile values, stable ordinary/log tails, missing and invalid domains,
warnings, and resource limits. Exhaustive libm bit identity and the wider distribution family remain
incomplete.

The session-environment increment adds `base::Sys.getenv`, `Sys.setenv`, and `Sys.unsetenv`, raising
current name overlap to 550 of 2,522. The usage snapshot ranks `Sys.getenv` at 162 with 16 calls
across three packages and 3.7% download-weighted reach, and `Sys.setenv` at 175 with seven calls
across four packages and 3.3% reach. GNU R 4.6 differential evidence covers exact formals, all- and
selected-variable queries, naming/coercion quirks, missing fallbacks, ordered and duplicate writes,
unsetting, and return shapes. Inline and Worker tests cover explicit initialization, isolation, and
reset restoration; an unchanged `withr 3.0.3` package executes `with_envvar()` over the same seam.
The host process environment is deliberately not inherited, and empty-string handling is the
documented platform-neutral browser rule.

The image-grid increment adds `graphics::image` and `image.default`, raising current name overlap to
552 of 2,522. Rank-163 `image` represents six documented calls across `scales`, `viridisLite`, and
`RColorBrewer`, or 3.7% download-weighted reach. GNU R 4.6 black-box evidence covers generic/default
formals, S3 forwarding, invisible return shape, and center-to-boundary coordinate ranges; NativR
Worker and Canvas tests additionally cover matrix orientation, colour mapping, missing transparency,
regular raster commands, irregular polygon cells, and one-row palette strips. Complete axes, legacy
interval behavior, device heuristics, and pixel-identical rendering remain incomplete.

The browser-request increment adds `utils::browseURL`, raising current name overlap to 553 of 2,522.
Rank-166 represents eight documented calls across xfun, htmltools, knitr, and httpuv. Differential
evidence covers callable-browser forwarding, original URL text, invisible results, suppression,
validation, and errors; NativR-owned Worker/Playground evidence covers inert external requests and
bounded virtual HTML/file snapshots. This does not claim desktop browser launch, network access,
host files, automatic navigation, or platform-identical diagnostics.

The browser-memory increment adds usage-ranked `base::gc` and adjacent `gcinfo`, raising current
name overlap to 555 of 2,522. Rank 168 represents 17 documented calls across `rlang`, `matrixStats`,
and `bit64`, or 3.5% download-weighted reach; all observed calls use the ordinary no-argument path
for weak-reference examples, benchmark preparation, or cleanup after `rm()`. GNU R 4.6 black-box
evidence covers formals, matrix type/dimensions/dimnames, reset maxima, controls, previous-flag
state, and verbose output. NativR measures only its reachable R-value graph, shares that census with
`system.time(gcFirst = TRUE)`, and does not claim host JavaScript heap counts or forced collection.

The connected-lines increment adds exported `graphics::lines` and `lines.default`, raising current
name overlap to 557 of 2,522. Rank 174 represents 20 documented calls across `scales`,
`matrixStats`, `posterior`, and `zoo`, or 3.4% download-weighted reach. GNU R 4.6 black-box evidence
covers generic/default formals, package-owned S3 forwarding, visibility, accepted coordinate shapes,
plot types, missing path breaks, styles, device errors, and input boundaries. NativR reuses its
existing coordinate adapter plus segment/point journal for browser, Worker, PNG, hold/flush, and
record/replay output; no package-specific translation or polyline protocol was added. Lines now
inherit active positive logarithmic axes and omit nonpositive values with a warning. Complete
graphics parameters, clipping, replayed log-axis metadata, specialized coordinate classes, and
device-identical rendering remain incomplete.

The explicit-command increment adds `base::system`, raising current name overlap to 558 of 2,522.
Rank 176 represents five documented calls across withr, knitr, and data.table, or 3.3%
download-weighted reach. GNU R 4.6 black-box evidence covers all 11 formals and validation that runs
before any process. Inline, Worker, Playground, and pure-R package integration evidence covers one
typed opt-in handler, captured lines, stderr, statuses, warnings, timeouts, controls, and failures.
The measured calls themselves request native compilation, Pandoc, or `diff`; NativR therefore does
not claim that those tools, a shell, executable discovery, environment inheritance, signals, or
process cancellation exist. Without a handler, execution fails closed.

The time-interval increment adds usage-ranked `base::as.difftime`, raising current name overlap to
559 of 2,522. Rank 177 represents two documented calls across vctrs and scales, or 3.3%
download-weighted reach. GNU R 4.6 black-box evidence covers exact formals, numeric and recycled
character formats, automatic and explicit seconds/minutes/hours/days/weeks, names, missing values,
attributes, and input errors. The adjacent `difftime` path now selects automatic units, accepts
partial unit names, preserves names and attributes, and reports fractional recycling. Deterministic
24-hour C-locale parsing is browser-owned; arbitrary locale-specific `%X`, named-zone date parsing,
POSIXlt conversion, leap-second databases, and the complete difftime method/arithmetic family remain
incomplete.

The environment-introspection increment adds usage-ranked `base::ls` and its identical
`base::objects` alias, raising current name overlap to 561 of 2,522. Rank 184 represents five
documented calls across callr, rstan, and bit64, or 3.0% download-weighted reach. GNU R 4.6
black-box evidence covers exact formals, caller and explicit environments, numeric and exact-name
search-list selection, hidden bindings, deterministic sorted and unhashed order, patterns, alias
identity, and non-forcing promise enumeration. Search-list package environments expose only NativR's
implemented exports; browser RegExp syntax, browser string collation, active bindings, and exact
hash-bucket enumeration remain incomplete.

The histogram increment adds usage-ranked `graphics::hist`, `hist.default`, internal
`plot.histogram`, and the three exported `grDevices::nclass.*` helpers, raising current name overlap
to 566 of 2,522. Rank 186 represents 19 documented calls across testthat, openssl, shiny, and
posterior, or 3.0% download-weighted reach. GNU R 4.6 black-box evidence covers standard result
shape, visibility, S3 dispatch, default/numeric/algorithmic breaks, right/left endpoints,
unequal-bin density, formals, matrices, and class counts. Browser bars reuse the owned polygon
display list; exhaustive `pretty()` boundaries, log axes, line-density shading, and device-identical
rendering remain incomplete.

The class-introspection increment adds usage-ranked `methods::showClass`, raising current name
overlap to 567 of 2,522. Rank 188 represents four documented calls across Rcpp and rstan, or 2.9%
download-weighted reach. GNU R 4.6 black-box evidence covers exact formals, namespace/global
ownership labels, direct and inherited slots, representation-declared parents, virtual classes,
known subclasses, custom property labels, errors, output capture, and invisible return behavior. A
source-only package fixture imports the same methods functions and declares/queries its class during
normal namespace loading. Native Rcpp/rstan classes and the complete S4 metadata, validity,
multiple-dispatch, cache, and console-wrapping domains remain incomplete.

The package-version increment raises current name overlap to 577 of 2,522. Measured rank 189
`utils::packageVersion` represents three calls across ggplot2 and bslib, or 2.9% download-weighted
reach; adjacent rank 212 `getRversion` represents two calls across two packages. GNU R 4.6 black-box
evidence covers component storage, class chains, constructors, missing values, printing/formatting,
concatenation, padded vectorized comparisons, `compareVersion`'s distinct component-count ordering,
formals, errors, and non-forcing installed-package lookup. The unchanged source-only fixture reads
its own DESCRIPTION version before and after namespace initialization. Duplicate package versions,
the complete numeric-version method family, and execution compatibility for any merely visible
bundle remain incomplete.

The session-identity increment raises current name overlap to 578 of 2,522. Measured rank 194
`Sys.getpid` represents six calls across ps, xfun, and promises, or 2.8% download-weighted reach.
GNU R 4.6 black-box evidence covers its zero formals, positive scalar integer shape, repeated-call
stability, and unused-argument error. NativR-only integration covers distinct concurrent facade
sessions, reset/Worker-restart preservation, protocol validation, and unchanged source-package use.
The identity is not an OS PID; ps process handles, cross-page global uniqueness, parent/child
relationships, process enumeration, signals, and host process accounting remain incomplete.

The library-path increment raises current name overlap to 579 of 2,522. Measured rank 195
`.libPaths` represents six calls across withr and callr, or 2.8% download-weighted reach. GNU R 4.6
black-box evidence covers exact formals, visible non-forcing getter, invisible setter, character and
logical validation, missing/nonexistent filtering, normalization, input-order deduplication,
mandatory `.Library` inclusion, and resettable state. NativR integration maps audited bundles to
`nativr://package`, registered namespaces to `nativr://runtime/library`, applies the active or
explicit virtual `lib.loc` to loading, namespace lookup, versions, and resources, and passes the
bundle root to lifecycle hooks. Unchanged `withr 3.0.3` executes and restores `with_libpaths()`.
Startup `R_LIBS*` expansion, host library discovery, runtime repository installation, duplicate
versions across roots, installed lazy-load databases, and binary packages remain incomplete.

The package-example increment raises current name overlap to 580 of 2,522. Measured rank 196
`utils::example` represents four calls across rstan, pkgload, and data.table, or 2.8%
download-weighted reach. GNU R 4.6 black-box evidence covers the 15 formal names, missing-topic
warning, invisible `NULL`, default skipped blocks, opt-in `dontrun`/`donttest`, alias lookup,
`give.lines`, and local/global execution. The Node-only packager independently extracts `man/*.Rd`
into a deterministic manifest; the Worker parses selected code through Tree-sitter and the
normalized AST. An unchanged `generics 0.1.4` source artifact supplies discovery evidence, while the
Playground executes a packaged example. Interactive HTML/help databases, prompting, exact
Rd/source/echo formatting, RNG restoration, abort recovery, core-package examples, and examples that
reach unsupported semantics remain incomplete.

The gzip-connection increment raises current name overlap to 581 of 2,522. Measured rank 203
`base::gzcon` represents six calls across jsonlite and curl, or 2.5% download-weighted reach. GNU R
4.6 black-box evidence covers exact formals, replacement handle/classes and summary shape, text/raw
decompression, non-gzip pass-through warnings, zero bytes before close, gzip magic after close, and
write/read roundtrips. Package-resource and browser Worker cases use the same bounded
`CompressionStream`/`DecompressionStream` path. This removes a reusable pure-R package compression
gap, but does not implement the `url()`/curl transports used by some measured examples, compressed
seeking/pushback, typed binary I/O, concatenated-member fidelity, or zlib compression-level byte
identity.

The installed-vignette increment raises current name overlap to 582 of 2,522. Measured rank 204
`utils::vignette` represents five calls across Rcpp and data.table, or 2.4% download-weighted reach.
GNU R 4.6 black-box evidence covers exact formals, empty catalogs, missing-topic behavior, and the
specific metadata object. The Node-only packager indexes retained `inst/doc` sources and rendered
outputs, while the default Worker discovers them through immutable virtual package resources.
Development-vignette rendering, installed lazy help databases, print/viewer dispatch, and the
measured packages' native code remain incomplete.

The callable-introspection increment raises current name overlap to 583 of 2,522. Measured rank 205
`base::args` represents three calls across S7 and StanHeaders, or 2.4% download-weighted reach. GNU
R 4.6 black-box evidence covers closure defaults and ellipsis, documented primitive signatures,
character-name resolution, global result environments, `NULL` bodies, unresolved names, and silent
non-function results. Source-only package fixtures exercise the same path inline and in the default
Worker. This is reusable support for package-generated constructors and wrappers, not evidence for
the complete S7 system or StanHeaders' native routines.

The dynamic-S3-registration increment raises current name overlap to 584 of 2,522. Measured rank 208
`base::registerS3method` represents two calls across pillar and knitr, or 2.4% download-weighted
reach. GNU R 4.6 black-box evidence covers its four formals and `parent.frame()` default, invisible
`NULL`, hidden function and string methods, replacement, visible-method precedence,
generic-definition-environment isolation, base generics, invalid methods, and missing generics.
Source-only package `.onLoad()` registration runs inline and in the default Worker, while failed
loads roll registration changes back. Delayed registration for an unloaded suggested package and
complete S3 method discovery remain incomplete.

The virtual-file-metadata increment raises current name overlap to 588 of 2,522. Measured rank 209
`base::file.info` represents three calls across digest, data.table, and shiny, or 2.4%
download-weighted reach; adjacent `file.mode`, `file.mtime`, and `file.size` share the
implementation. GNU R 4.6 black-box evidence covers formals, stable column names and storage
classes, zero-row results, duplicate/missing paths and row names, `octmode`/`POSIXct` classes, and
wrapper results. NativR-only evidence covers exact UTF-8/binary byte sizes, writable-directory
modes, owned modification/access timestamps, immutable package resources, and the default Worker.
Host paths, native identities/ACLs, links, executable classification, and platform timestamp
fidelity remain outside the browser runtime.

The perceptual-color increment raises current name overlap to 589 of 2,522. Measured rank 214
`grDevices::hcl` represents six calls across ggplot2 and zoo, or 2.3% download-weighted reach. GNU R
4.6 black-box evidence covers the measured 2,500-/10-color raster and threshold-color calls plus
defaults, exact formals, recycling, alpha, missing/non-finite coordinates, gamut fixup, zero-length
inputs, and invalid finite ranges. Source-only package and default Worker tests use the same
browser-native polar CIE-LUV/D65 conversion. Device color profiles, ICC management, `hcl.colors`,
and the broader conversion API remain incomplete.

The linear-axis increment raises current name overlap to 590 of 2,522. Measured rank 215
`graphics::axis` represents 18 calls across labeling, zoo, and bit64, or 2.3% download-weighted
reach. GNU R 4.6 black-box evidence covers exact formals, invisible sorted locations, default and
explicit ticks, sides 1:4, character/numeric/no labels, empty/non-finite input, and validation.
Browser-owned evidence covers line/tick/text commands, measured styles, pure-R package execution,
the default Worker, Canvas/PNG rendering, and record/replay. Logarithmic/date axes, outer margins,
plotmath, exact collision layout, font metrics, and device-pixel identity remain incomplete.

The dynamic-source increment raises current name overlap to 592 of 2,522. Measured ranks 221
`base::source` and 222 `base::textConnection` represent rlang's two
`source(textConnection(...), echo = TRUE, local = TRUE)` calls, or 2.2% download-weighted reach. GNU
R 4.6 black-box evidence covers exact formal names, connection classes, caller/global/explicit
environments, complete-parse-before-execution behavior, sequential side effects, invisible named
return shape, last-result visibility, and echo printing. Browser-owned evidence adds virtual package
paths, bounded storage/output, unchanged pure-R package execution, and the default Worker. Output
text connections, host-file input, retained source references, `catch.aborts = TRUE`, and
byte-identical console deparsing remain incomplete.

The URL-connection increment raises current name overlap to 594 of 2,522. Measured rank 232
`base::url` represents six calls across jsonlite and openssl, or 2.1% download-weighted reach. GNU R
4.6 black-box evidence covers exact formals/defaults, class, and closed summary. Browser-owned
evidence covers validated methods and named headers, lazy one-request materialization, persistent
cursors, byte/type limits, unchanged pure-R package calls, `gzcon` composition, the Worker protocol,
and a Playground fixture that performs no network request. This is a reusable connection seam, not
evidence that jsonlite or openssl's native components run. Network fetch, redirects, credentials,
cookies, CORS, timeouts, caching, and origin trust are explicit host policy; native libcurl and
writable URL connections remain incomplete.

The time-series-filter increment raises current name overlap to 595 of 2,522. Measured rank 239
`stats::filter` has one genuine GNU R core use in zoo's documented recursive log-normal-flow
example; the usage collector's jsonlite hit resolves to dplyr after package attachment and is an
audited lexical false positive. GNU R 4.6 black-box evidence covers centered, trailing, and circular
convolution; ordinary and initialized recursion; vector and matrix series; missing propagation;
time-series metadata; exact formals; partial methods; and invalid controls. Source-only package and
Worker Playground tests execute the same owned implementation without package-specific rewrites.
Data-frame coercion, complex filters, irregular-series methods, and native algorithm identity remain
incomplete.

The package-description increment raises current name overlap to 596 of 2,522. Measured rank 245
`utils::packageDescription` is cli's one full installed-package metadata call at 1.9%
download-weighted reach. GNU R 4.6 black-box evidence covers selected fields, absent fields,
one-field dropping, named classed lists, `fields` and file-shape semantics, exact formals/defaults,
and missing-package warnings. NativR retains validated source-bundle DESCRIPTION metadata in its
immutable catalog, exposes virtual installation paths, and reads it without namespace loading. A
source-only fixture mirrors cli's `unclass()` access, unchanged `pkgconfig 2.0.3` proves a public
artifact, and the default Worker Playground executes the same path. Host libraries, malformed
installed trees, complete core-package prose, arbitrary codecs, and description print/citation/date
methods remain incomplete.

The standard-connection increment raises current name overlap to 604 of 2,522. Measured rank 246
`base::stdout` is cli's 1.9% download-weighted terminal-selection call; adjacent `stderr` also
removes curl's later rank-342 gap. GNU R 4.6 differential evidence covers stable integer terminal
descriptors, class and identity, summary/access fields, exact formals, embedded-session TTY state,
flush visibility, and open/close/seek errors. Browser-owned cases additionally cover user/standard
connection catalogs, close-all preservation, unforgeable handles, unchanged pure-R package calls,
and default Worker stdout/stderr events. Streaming stdin, sink diversion, pushback, terminal
negotiation, and host descriptors remain incomplete.

The classic-palette increment raises current name overlap to 608 of 2,522. Rank 252
`grDevices::rainbow` covers five measured calls across farver and zoo at 1.8% download-weighted
reach; rank 262 `terrain.colors` covers ggplot2's three measured calls at 1.7%, and the shared owned
HSV path also closes adjacent `topo.colors` and `cm.colors`. GNU R 4.6 differential evidence covers
default and custom sequences, byte rounding, wrapped hue ranges, saturation/value and alpha
recycling, reversal, count coercion, empty values, exact formals, and invalid boundaries. The same
implementation runs unchanged from a source-only package namespace. `hcl.colors`, palette state,
device color management, and complete plotting-package compatibility remain separate work.

The rectangle increment raises current name overlap to 609 of 2,522. Rank 253 `graphics::rect`
covers sass and zoo's three measured calls at 1.8% download-weighted reach. GNU R 4.6 differential
evidence covers its exact formals, invisible `NULL`, coordinate-only length selection and recycling,
empty-vector errors, missing/non-finite omission, fill/border/line recycling, `par()` defaults, and
zero/negative density behavior. The same event crosses inline, pure-R package, Worker, Canvas, PNG,
and record/replay paths without a package-specific implementation. Positive hatch density,
coordinate classes, clipping/log axes, arbitrary graphics parameters, and device-identical joins
remain incomplete. The next measured unresolved callable is rank 256 `base::file.remove`.

The file-removal increment raises current name overlap to 610 of 2,522. Rank 256 `base::file.remove`
covers four measured cleanup calls across xfun and data.table at 1.8% download-weighted reach. GNU R
4.6 differential evidence covers exact formals, visible per-path logical results, attribute removal,
later-argument atomic coercion, validation before mutation, zero-length inputs, duplicate and
missing paths, and per-failure warnings. NativR-only package and Worker evidence proves that closed
session files can be removed while package resources, open connections, directories, wildcard
literals, and host paths stay protected. Native filesystem permissions/diagnostics and `Sys.glob`
expansion remain separate compatibility depth. The next measured unresolved callable is rank 259
`base::readChar`.

The fixed-width text-input increment raises current name overlap to 611 of 2,522. Rank 259
`base::readChar` covers digest's whole-file and Shiny's bookmark-file examples at 1.7%
download-weighted reach. GNU R 4.6 differential evidence covers exact formals, raw vectors, ASCII
character/byte widths, vectorized/zero/fractional lengths, EOF and partial fields, attribute
removal, open cursor and closed lifecycle behavior, text-mode warnings, and invalid NUL/length
inputs. NativR-only browser-UTF-8 evidence covers scalar widths, exact arbitrary byte fields, and
invalid UTF-8; package and Worker evidence crosses immutable resources, session files, file/URL/gzip
connections, and resource bounds without a package-specific path. Host files, native locale codecs,
streaming stdin, `writeChar`, and platform-exact diagnostics remain compatibility depth.

The function-debugging increment raises current name overlap to 615 of 2,522. Ranks 277
`base::debug` and 279 `base::undebug` cover R6's two measured method-instrumentation calls at 1.7%
download-weighted reach, while the same state model adds adjacent `debugonce` and `isdebugged`. GNU
R 4.6 differential evidence covers exact formals, visibility, warnings, string lookup, closure and
primitive marks, shared aliases, replacement reset, and the fact that a one-shot mark is not
reported by `isdebugged` or removed by `undebug`. NativR-only inline, source-only package, and
Worker evidence covers invocation, one-shot consumption, non-interactive tracing, and bounded
next/continue/finish/Q prompts through the existing readline bridge. Arbitrary Browse expressions,
nested stepping, `browser()`, global debugging state, and S4 signature tracing remain compatibility
depth.

The browser-PDF increment raises current name overlap to 616 of 2,522. Rank 281 `grDevices::pdf`
covers knitr's recording-only device and data.table's file-backed plot at 1.7% download-weighted
reach. GNU R 4.6 differential evidence covers all 22 formal names, invisible opening, `pdf(NULL)`,
`recordPlot()` shape, and device closure. NativR-only inline and Worker evidence validates immediate
empty targets, valid PDF headers, page trees, content streams, cross-reference/trailer/EOF
structure, metadata controls, standard font resources, compressed and uncompressed content, one-file
multi-page output, numbered page files, raw reads, and output limits. Custom/embedded fonts,
arbitrary encoding maps, exact glyph metrics and kerning, complete PDF controls, and byte-identical
output remain compatibility depth.

The file-creation increment raises current name overlap to 617 of 2,522. Rank 287
`base::file.create` covers withr's measured tempfile/deferred-cleanup setup at 1.6%
download-weighted reach. GNU R 4.6 differential evidence covers exact formals and exact-only
trailing-control matching, first-argument validation, later atomic coercion, vector flattening,
attribute removal, existing-file truncation, visible per-path logical results, missing paths,
warning suppression, and validation before mutation. NativR-only package, immutable-resource,
host-boundary, resource-limit, and default-Worker evidence runs through the ordinary virtual
filesystem without a withr-specific adapter. Recursive parent creation, host paths, native
permissions/umasks, links/devices, platform-exact diagnostics, and persistence remain compatibility
depth.

The time-series-plot increment raises current name overlap to 618 of 2,522. Rank 292
`stats::ts.plot` covers magrittr's measured exposition-pipe call at 1.6% download-weighted reach.
GNU R 4.6 differential evidence covers exact formals and invisible return, regular-axis `usr`
ranges, equal-frequency union across different starts, style and limit controls, empty/named-only
inputs, incompatible frequencies, and invalid `gpars`. NativR-only event assertions prove gap-aware
segments and points, style recycling, expression labels, resource preflight, pure-R namespace use,
default Worker transport, and Canvas pixels without a magrittr adapter. Multi-panel `plot.ts`,
irregular indexes, complete axes/margins, arbitrary graphical parameters, and device-exact rendering
remain compatibility depth.

The executable-discovery increment raises current name overlap to 619 of 2,522. Rank 293
`base::Sys.which` covers the two measured knitr/sys checks at 1.6% download-weighted reach. GNU R
4.6 differential evidence covers visible named results, empty/duplicate/missing queries,
factor/list/pairlist/language coercion, exact `names` formal matching, and invalid inputs.
NativR-only evidence proves snapshotted `createR({ executablePaths })` admission, default-deny
behavior, reset/isolation, pure-R package execution, Worker transport, Playground use, and malformed
host-map rejection. No package adapter, PATH scan, filesystem access, or process invocation is
involved. Host PATH/PATHEXT and executable-bit rules, path canonicalization, GNU closure identity,
and an `NA_character_` value inside the names attribute remain compatibility depth.

The download increment raises current name overlap to 620 of 2,522. Rank 311 `utils::download.file`
covers jsonlite's measured call while supplying a package-independent resource path for source-only
packages. GNU R 4.6 black-box evidence covers exact formals/defaults, preflight argument boundaries,
invisible scalar status, paired vector downloads, `retvals`, and replacement bytes. NativR-only
evidence covers copied request data, named headers, `auto` mapping, session-owned destinations,
failure atomicity, pure-R namespaces, default-deny behavior, Worker transport, and Playground use.
Ambient networking, host files, redirect/cache policy, progress display, platform downloader
processes, append modes, and HTTP status interpretation remain outside the browser contract.

The pipe increment raises current name overlap to 621 of 2,522. Rank 313 `base::pipe` covers
jsonlite's measured call while adding a package-independent command connection. GNU R 4.6 black-box
evidence covers exact formals/defaults, class, closed summary, invisible `NULL` on unused close, and
invalid constructor inputs. NativR-only evidence covers lazy and explicit reads, open cursors, raw
bytes, exact write stdin, stderr and nonzero statuses, limits, default denial, unchanged pure-R
package use, Worker transport, and Playground use. The runtime adds no shell or process authority:
the embedding host must explicitly allow each request through `systemCommand`. Duplex/interactive
streams, seeking, binary stdin containing NUL, executable discovery, and platform shell semantics
remain compatibility depth.

The ZIP-member increment raises current name overlap to 622 of 2,522. Rank 314 `base::unz` covers
jsonlite's measured archive-member call. GNU R 4.6 black-box evidence covers exact formals/defaults,
scalar coercion boundaries, class, closed summary, and invisible `NULL` close. NativR-only evidence
covers stored and raw-DEFLATE members, closed restarts and open cursors, raw/text reads, immutable
package resources, downloaded session archives, read-only update mode, missing/corrupt/unsupported
archives, resource limits, unchanged pure-R package calls, Worker transport, and Playground use. No
member is extracted to a path and no network or host-filesystem authority is added. Encryption,
ZIP64, multi-disk archives, other compression methods, seeking, writing, runtime installation, and
platform-exact diagnostics remain compatibility depth.

The object-size increment raises current name overlap to 623 of 2,522. Rank 324 `utils::object.size`
covers the three measured data.table/bit64 calls. GNU R 4.6 black-box evidence covers the single
formal, double `object_size` class, exact common 64-bit vector allocation buckets,
within-character-vector sharing, recursively counted list/pairlist children, attributes, environment
exclusion boundary, and legacy/IEC/SI formatting and invisible printing. NativR uses an independent
traversal of owned values and normalized syntax; it never reports the JavaScript heap as R memory.
External pointers, native package allocations, other platform word sizes, and broader host-object
attribution remain compatibility depth.

The title-annotation increment raises current name overlap to 624 of 2,522. Rank 328
`graphics::title` covers all seven measured Shiny/bit64 calls. GNU R 4.6 black-box evidence covers
the exact signature/defaults, invisible result, active-plot requirement, character/numeric/logical,
language/expression/list annotations, list-local styles, session title parameters, named graphical
controls, line/outer inputs, and unknown-parameter behavior. NativR emits the existing owned text
event for Worker/Canvas, record/replay, PNG, PDF, and unchanged pure-R package calls. Plotmath glyph
layout and platform-exact margin/font metrics remain compatibility depth. Rank 330 `base::sink` is
the next measured unresolved callable.

The socket-connection increment raises current name overlap to 636 of 2,522. Rank 346
`base::socketConnection` covers ps's measured connection-list call shape while adding reusable
`isIncomplete` and `socketTimeout` support. GNU R 4.6 black-box evidence covers exact formals and
defaults, classed integer handles, closed/open summaries, access queries, modes, timeout values, and
close visibility. NativR-owned evidence covers bounded typed open/read/write/timeout/close events,
line/raw connection consumers, unchanged source-only package code, default Worker execution,
reset/disposal cleanup, invalid handler results, output limits, and default denial. Because browsers
do not expose raw TCP to ordinary JavaScript, DNS, TLS, server sockets, backpressure, cancellation,
and endpoint policy belong to the explicit host adapter and remain compatibility depth.

The file-copy increment raises current name overlap to 637 of 2,522. Rank 348 `base::file.copy`
covers xfun's measured package-resource staging call at 1.1% download-weighted reach. GNU R 4.6
black-box evidence covers all six formals/defaults, empty-source laziness, visible attribute-free
logical results, vector source recycling, existing-directory basename expansion, overwrite,
self-copy failure, recursive subdirectories and dotfiles, and invalid flags/destinations.
NativR-only evidence proves exact binary package-resource copies, immutable-source to
mutable-session transfer, unchanged pure-R package execution, default Worker/Playground use, and
result/file/storage bounds. Host paths, links, devices, platform permissions/ACLs, and cross-session
persistence remain outside the browser-owned filesystem contract. Rank 349 `base::find.package` is
implemented by the next package-discovery increment.

The package-discovery increment raises current name overlap to 638 of 2,522. Rank 349
`base::find.package` covers xfun's measured package-root lookup at 1.1% download-weighted reach. GNU
R 4.6 black-box evidence covers its four formals/defaults, default attached-package order, vector
order/duplicates, missing warning/error/quiet behavior, empty-input laziness, and explicit library
selection. NativR-only evidence covers immutable core and pure-R bundle roots, the missing
`datasets` core registration, directory enumeration from unchanged package R code, and default
Worker/Playground execution. Returned locations are virtual owned directories; host-library scans,
package installation, native-code loading, and platform-exact paths remain outside this slice. Rank
351 `base::l10n_info` is implemented by the next localization-capability increment.

The localization-capability increment raises current name overlap to 639 of 2,522. Rank 351
`base::l10n_info` covers xfun's measured UTF-8 branch at 1.1% download-weighted reach. GNU R 4.6
black-box evidence covers null formals, visible named-list shape, the three portable scalar logical
fields, names-only attributes, OS-specific suffix validity, and encoding invariants. NativR-only
evidence covers its non-Windows `codeset = "UTF-8"` browser identity, unchanged pure-R package use,
and default Worker/Playground execution. It does not claim Windows codepages, host locale discovery,
arbitrary native encodings, ICU/iconv, or LC_CTYPE mutation. Rank 353 `base::shQuote` is implemented
by the next shell-string increment.

The shell-string increment raises current name overlap to 640 of 2,522. Rank 353 `base::shQuote`
covers xfun's measured argument-quoting call at 1.1% download-weighted reach. GNU R 4.6 differential
evidence covers its closure/formals/default vector, partial type matching, visibility, attribute
removal, explicit `cmd`/`cmd2` output, missing values, and registered `as.character` S3 dispatch.
The public GNU R documentation supplies the non-Windows `sh` and `csh` contract, which has exact
NativR browser cases together with unchanged pure-R package and default Worker execution. Quoting is
an owned string transform and grants no process authority; actual command execution remains behind
the separate default-deny host seam.

The structured-command increment raises current name overlap to 641 of 2,522. Rank 357
`base::system2` covers xfun's measured portable process call at 1.1% download-weighted reach. GNU R
4.6 black-box evidence covers closure formals/defaults, argument/environment coercion, output
capture, status/warning/visibility behavior and preflight errors. NativR-only evidence covers the
explicit data-only host request, console/capture/discard/file redirection intent, resource limits,
failed-start and timeout outcomes, unchanged source-only package execution, and inline/default-
Worker transport. No handler means no process authority, and NativR does not claim host shell,
filesystem, environment, or executable discovery.

The typed-native-call increment raises current name overlap to 642 of 2,522. Rank 358 `.Call` now
has a typed native/Wasm ABI foundation rather than JavaScript or host pointers. Complete
compiled-package compatibility still requires the portable R C-API/value subset and an automatic
Wasm build/registration pipeline.

The spell-check increment raises current name overlap to 643 of 2,522. Rank 363 `utils::aspell`
covers knitr's two measured custom-filter calls through a generic Ispell `-a` adapter. GNU R 4.6
black-box evidence fixes the closure formals/defaults, program failure, five-column classed frame,
line/column mapping, suggestions, and empty-result shape. NativR evidence covers session-owned and
package files, arbitrary R filter closures, bounded request/result parsing, pure-R package calls,
and inline/default-Worker execution. Spell checking requires matching `executablePaths` and
`systemCommand` policies; built-in filters, serialized dictionaries, and ambient PATH discovery
remain incomplete.

The reference-line increment raises current name overlap to 644 of 2,522. Rank 364
`graphics::abline` covers knitr's measured plot annotation call through the existing owned
`segments` journal. GNU R 4.6 black-box evidence fixes its eight formals/defaults, invisible result,
coefficient/model precedence, warnings, two-element `a` shorthand, one-coefficient through-origin
models, arbitrary S3 `coef.*`, vectorized horizontal/vertical inputs, omissions, and input errors.
NativR evidence adds exact linear-window geometry and style ordering, resource limits,
record/replay, unchanged source-only package imports, and default Worker/Canvas rendering. This is a
shape-level linear-device claim: logarithmic `untf` transformation, extended `xpd` clipping, and
device-exact cap/join metrics remain incomplete.

The vignette-browser increment raises current name overlap to 645 of 2,522. Rank 365
`utils::browseVignettes` covers knitr's measured interactive catalog call through the generic
installed-package documentation index. GNU R 4.6 black-box evidence fixes formals, class and
attributes, per-package matrix columns, package selection, duplicate rows, errors, empty printing,
and S3 visibility. NativR evidence adds deterministic self-contained HTML, immutable document links,
resource limits, unchanged pure-R package execution, Worker transport, and sandboxed Playground
rendering. It is a browser-native presentation seam, not a claim for GNU's help server, desktop
viewer, lazy help databases, or runtime vignette builders.

The display-list-control increment raises current name overlap to 646 of 2,522. Rank 366
`grDevices::dev.control` covers knitr's measured device-recording switch with GNU R 4.6 formals,
partial `enable`/`inhibit` matching, explicit-`NULL` inhibition, invisible `NULL`, no-device and
argument errors, per-device state, file-device recording defaults, and the observed rule that every
toggle clears earlier replay capture. NativR keeps the output page journal separate, so Canvas, PNG,
and PDF generation continue while `recordPlot()` returns an empty snapshot; enabling starts a fresh
bounded capture of only subsequent commands. Differential, pure-R package, same-session replay,
PDF-byte, and Worker-compatible integration evidence cover this owned representation. GNU R's
private recorded-plot binary layout, external devices, and cross-runtime replay remain outside the
claim.

The private-namespace increment raises current name overlap to 647 of 2,522. Rank 368
`utils::getFromNamespace` covers all 37 measured backports calls with GNU R 4.6 differential
evidence for the four exact formals/defaults, character namespace selection, first-element behavior,
lazy unused `pos`/`envir`, attached-package lookup, visible callable identity, strict
non-inheritance, and argument/package/object errors. NativR-only package evidence imports the same
callable into an unchanged source-only namespace and invokes a real unexported helper. The
implementation resolves the generic isolated namespace map rather than a core-only facade or
backports adapter. This does not claim namespace mutation/locking, installed lazy-load databases,
every namespace-management helper, or complete backports/package compatibility.

The package-help increment raises current name overlap to 649 of 2,522. Rank 370 `utils::help`
covers pkgload's 15 measured calls with GNU R 4.6 differential evidence for exact formals/defaults,
symbol and character topics, reserved words, literal unquoted package names, control laziness,
package/library selection, missing results, canonical paths, result attributes/classes, help types,
and package-index shape. The package tool emits one generic manifest for every source-package
`man/*.Rd` page, including pages with no examples; unchanged package aliases and registered core
bindings use the same lookup. Default text writes through the bounded output journal, while explicit
HTML uses escaped script-free content and the existing Worker browse event. This is portable
documentation discovery and presentation, not complete Rd conversion, `?`/`??` search, installed
lazy help databases, exact pagination/PDF, or byte-identical GNU pages.

The function-curve increment raises current name overlap to 650 of 2,522. Rank 380 `graphics::curve`
covers numDeriv's measured `curve(func1, from=0, to=5)` example through a general
function/expression-to-graphics seam. GNU R 4.6 differential evidence covers exact formals, named
functions, lazy caller-scoped expressions, alternate `xname`, bounded `n` and limit coercion,
linear/logarithmic sampling, invisible named coordinates, `add`, style forwarding, and errors.
NativR-only evidence evaluates the same mechanism from an unchanged source-package namespace and
through the default Worker/Canvas journal; no numDeriv adapter or generated JavaScript is involved.
The shared `plot.default` path now transforms positive logarithmic coordinates and omits nonpositive
values with a warning; `lines` and additive curves inherit current device log axes. Complete log
ticks/labels, other additive primitives, clipping, replayed log-axis metadata, inline
anonymous-function interpretation, and device-identical pixels remain incomplete.

The multi-argument S4 signature increment adds `methods::signature` and raises name overlap to 651
of 2,522, with differential evidence for named/positional signatures and multi-argument dispatch.

The pure-R R6 depth increment adds eight GNU R names and raises current name overlap to 659 of
2,522: `.DollarNames`, `.subset`, `.subset2`, `lockEnvironment`, `environmentIsLocked`,
`lockBinding`, `unlockBinding`, and `bindingIsLocked`. Differential cases cover environment/closure
attributes, lock mutation boundaries, internal extraction, and NULL empty-vector behavior. The
digest-pinned, unchanged R6 2.6.1 test proves repository packaging, shim replacement,
namespace-qualified S3 registration, generator/object construction, public method invocation, and
field mutation. That increment alone did not claim active/private binding fidelity,
cloning/finalization, complete R6, or arbitrary-package compatibility.

The active-binding depth increment adds three GNU R names and raises current name overlap to 662 of
2,522: `makeActiveBinding`, `bindingIsActive`, and `activeBindingFunction`. Differential evidence
covers repeated getters, write callbacks, nested replacement, non-forcing inspection,
environment-to-list forcing, assignment visibility, and binding locks. The unchanged, digest-pinned
R6 2.6.1 proof uses those generic Base R semantics for private method state and a read/write active
field. Active-binding substitution, R6 cloning/finalization and inheritance breadth, complete R6,
and arbitrary-package compatibility remain unclaimed.

The generic clone-path increment adds `mget` and the first-class `[[` primitive, raising current
name overlap to 664 of 2,522. GNU R 4.6 differential evidence covers named multi-binding lookup,
inheritance, mode filtering, delayed promises, active bindings, eager fallback preparation, callable
fallbacks, missing request names, exact formals, higher-order `[[` calls, and `mapply()`/`Map()`
result-name derivation including missing and empty names. The digest-pinned, unchanged R6 2.6.1
proof now executes both shallow and recursive deep clone paths for nested R6 objects. This is
reusable Base R semantic depth, not an R6 adapter; finalizers, broad inheritance, portable-locking
variants, complete R6, and arbitrary-package compatibility remain unclaimed.

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
