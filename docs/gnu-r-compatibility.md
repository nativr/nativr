# GNU R compatibility ledger

NativR targets versioned, browser-admissible behavioral compatibility with GNU R 4.6.1 while
preserving an independent browser-native implementation and clean-room constraints. The normative
and advisory profiles are defined in [`compatibility/profiles.json`](../compatibility/profiles.json)
and [RFC-0001](rfcs/0001-normative-compatibility-profiles.md). The 25 package-usage groups remain
useful for prioritization, but they are not a substitute for semantic or package-corpus evidence.

## Current black-box baseline

`pnpm compatibility:collect` queries a separately installed GNU R only for public namespace names,
callable kinds, and formal argument names. It never reads or serializes implementation bodies.

The generated [`compatibility/status.json`](../compatibility/status.json) is the only canonical
public status summary. It records the exact target, semantic profile, capability-manifest hash,
conformance counts, name inventory, and package-corpus tiers. Historical callable totals elsewhere
in this ledger are release notes, not current metrics.

Name overlap is not behavioral evidence. A matching name remains incomplete until recursive
differential tests cover its argument matching, types, values, attributes, warnings, errors,
visibility, side effects, reference identity, and relevant platform behavior.

The committed black-box snapshot is
[`compatibility/gnu-r/surface.json`](../compatibility/gnu-r/surface.json), and the derived report is
[`name-coverage.json`](../compatibility/gnu-r/name-coverage.json). `pnpm compatibility:check`
prevents the report from drifting from NativR's capability manifest. The name inventory records the
exact GNU R version under which it was collected; it does not redefine the normative 4.6.1 target.

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
| Package execution  | Namespace loading, lazy data, S3/S4 registration, bytecode-equivalent semantics, package resources, and R CMD check behavior                                                                           | Standard pure-R source directories and tarballs have build-time repository resolution, bounded archive inspection, deterministic artifacts, dependency/version checks, Collate and portable encoding handling, immutable resources, installed example/vignette indexes, isolated namespaces, imports/exports, `::`/`:::`, qualified S3 registration, lifecycle hooks, attachment, package source/text data plus XDR/gzip `.rda` and `R/sysdata.rda`, Worker transport, and reset/reload. The pinned 24-package corpus has 23 packages at P4 or higher, including unchanged `evaluate 1.0.5` at P5, plus resource-only BH at P3; source-archive and normalized-artifact digests are distinct evidence. Installed `.rdx`/`.rdb` lazy databases, complete `tools`, install-time package resource transformations, raw development-vignette building, broader namespace directives, native code, complete S4 namespace behavior, bytecode-equivalent behavior, R CMD check, universal package execution, and the broader domain remain incomplete                                                                                                                                                                                                                         |
| Graphics           | Devices, graphics state, base graphics, colors, fonts, and browser rendering equivalence                                                                                                               | Evidence covers the 72-entry session-local `graphics::par()` inventory, its 66 mutable `no.readonly` entries, query/update/restore semantics and read-only warnings; a numbered browser/PNG `dev.cur`/`dev.list`/`dev.off`/`graphics.off` lifecycle; standards-compliant RGBA PNG output; the `graphics::pairs` package-method extension point; complete ordered GNU R 4.6.0 named-color catalog and distinct subset; bounded linear RGB/Lab `colorRampPalette`; polar CIE-LUV `hcl`; deterministic palettes; owned page/window state; bounded linear `axis` ticks/labels; `barplot` axis suppression; raster/segment/plot primitives; command buffering; display-list replay; Worker transfer; and Canvas rendering. The behavioral effects of many `par` entries, non-PNG devices, complete device switching, logarithmic/date axes, font metrics, external/cross-device formats, layout identity, and rendering equivalence remain incomplete                                                                                                                                                                                                                                                                                                                      |

Profile 0.311 supersedes the package-corpus counts in the table above: the pinned corpus now has 28
releases, with 24 passing, three blocked, and one deliberately unevaluated source-blind holdout.
Twenty-six paths reach P4 or higher, 23 reach P5 or higher, unchanged `optparse 1.8.2` reaches P5,
and resource-only BH remains at P3. `argparser 0.7.3` is the next untouched holdout.

Profile 0.312 supersedes profile 0.311's current corpus counts: the pinned corpus has 29 releases,
with 25 passing, three blocked, and one deliberately unevaluated source-blind holdout. Twenty-seven
paths reach P4 or higher, 24 reach P5 or higher, unchanged `argparser 0.7.3` reaches P5, and
resource-only BH remains at P3. `iterators 1.0.14` is the next untouched holdout.

Profile 0.313 supersedes profile 0.312's current corpus counts: the pinned corpus has 30 releases,
with 26 passing, three blocked, and one deliberately unevaluated source-blind holdout. Twenty-eight
paths reach P4 or higher, 25 reach P5 or higher, unchanged `iterators 1.0.14` reaches P5, and
resource-only BH remains at P3. `foreach 1.5.2` is the next untouched dependency-closure holdout.

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

The rank-437 increment first added GNU R differential evidence for the empty `utils::demo()` package
catalog's `packageIQR` structure. Profile 0.407 extends the same browser-owned path to installed
source-package `demo/*.R` discovery, optional `00Index` titles, populated catalogs, package
attachment, declared-encoding decode, and global-environment execution. The unchanged registry
package test executes its demo without scanning an installed R library or granting ambient I/O.

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
`pkgconfig 2.0.3`, `generics 0.1.4`, `withr 3.0.3`, `R6 2.6.1`, `viridisLite 0.4.3`,
`RColorBrewer 1.1-3`, and `labeling 0.4.3`, pins each resulting artifact digest, and executes
package-resource, S3-dispatch, state-restoring wrapper, reference-object, and package-owned palette
paths without source rewrites. The `withr` proof drove general call-rooted replacement, `formals<-`,
`environment<-`, `bquote`, list-backed environments, dynamic caller-frame, hook-registry,
closure-like builtin-formal, and `graphics::par` work. The R6 proof additionally drove shim
precedence, qualified S3 registration, environment/closure attributes, NULL-as-empty
operator/application behavior, environment and binding locks, function-backed active bindings, and
non-dispatching subset primitives. The unchanged R6 proof now also exercises private state and an
active read/write field; viridisLite exercises generic arithmetic attribute propagation and a
256-anchor Lab spline through `grDevices::colorRamp`; RColorBrewer exercises exact trailing
`data.frame()` controls, explicit row names, metadata subsetting, palette recursion, and warnings.
Labeling reaches P5 through nine unchanged algorithms and the bounded-output `extended.figures(2)`
path, including the GNU R-shaped 72-entry `par()` inventory and read-only restore warnings. These
tiered package/version proofs are not universal package compatibility.

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

The viridisLite package-depth increment adds `grDevices::colorRamp`, raising current name overlap to
665 of 2,522. GNU R 4.6 differential evidence covers numeric-matrix closures, linear and
not-a-knot/FMM spline interpolation, RGB/Lab conversion, alpha, bias, empty shape, range/non-finite
points, and arithmetic array/attribute propagation. Digest-pinned, unchanged viridisLite 0.4.3 loads
its 256-anchor package data and returns exact observed Viridis, Magma, and reversed translucent
palettes without copied source, a package adapter, or runtime network access. This is the fifth
package/version proof, not arbitrary-package or complete grDevices compatibility.

The RColorBrewer package-depth increment adds no callable names, so current overlap remains 665 of
2,522. GNU R 4.6 differential evidence covers `data.frame()`'s exact trailing formals, explicit and
automatic row-name metadata, zero-column extent, atomic coercion, duplicate/missing/length failures,
and syntactic name repair. Digest-pinned, unchanged RColorBrewer 1.1-3 constructs its exported
35-row palette table and returns exact Set1/Blues palettes plus the minimum-size recursive warning.
This is the sixth package/version proof, not arbitrary-package or complete Base/graphics
compatibility.

## Profile 0.428 package-check lifecycle evidence

Standard namespace lifecycle hooks are classified outside ordinary export-help coverage by a
package-neutral rule and synthetic fixture. Unchanged `gsubfn` 0.7 reaches P4 after passing loading,
attachment, documentation, two examples, absent-test classification, and its vignette. Missing
browser-owned `datasets::BOD` is the next blocker. No new GNU callable claim is made: flat evidence
remains 1,385 cases and recursive evidence remains 251 graphs with 532 binding associations.

## Profile 0.363 language, regex, condition, and formatR evidence

New exact flat and recursive comparisons cover zero-formal function reconstruction, TRE dot matching
across newlines versus Perl behavior, exiting warning handlers, and name-insensitive `all.equal()`.
GNU R 4.6.1 remains normative and the installed 4.6.0 advisor remains non-normative. The unchanged
`formatR 1.14` artifact reaches P5 only; retained upstream test failures prevent a P6/P7 claim.

## Profile 0.364 deparse, condition-stack, visibility, and formatR evidence

One flat case and one recursive Oracle v2 graph add GNU black-box evidence for structural deparse
layout, nested calling/exiting handler order, suppression visibility, and output capture. The local
GNU R 4.6.0 advisor matches all 74 recursive graphs; GNU R 4.6.1 remains normative. The unchanged
pinned `formatR 1.14` artifact passes all applicable generic package checks and an independent
formatting/usage scenario at P7. This does not claim comprehensive GNU R or arbitrary-package
compatibility.

## Profile 0.362 modeling semantics and estimability evidence

Profile 0.362 contains 1126 checked-in flat cases and 72 recursive Oracle v2 graphs. New exact
coverage fixes `na.pass`, visible `qr.R`, retained terms, model-frame xlevels/NA policy,
rank-deficient predictions, stored-call formula updates, and treatment/sum/Helmert/matrix contrasts.
The non-normative GNU R 4.6.0 advisor is used only as an early differential signal; GNU R 4.6.1
remains the release authority.

The unchanged pinned `estimability 2.0.0` package and an independently authored estimability
scenario pass at P7. This is one package-depth result and does not claim arbitrary pure-R package or
comprehensive GNU R compatibility.

The generic NULL/inheritance-depth increment adds no callable names, so current overlap remains 664
of 2,522. GNU R 4.6 differential evidence now covers `NULL` extraction through `[`, `[[`, `$`,
`.subset`, `.subset2`, and first-class `[[`, including forced index/control expressions and missing
index errors. Replacement evidence covers `[<-`, `[[<-`, and `$<-` promotion with atomic/list
selection, typed gaps, names, empty selections, and long false logical indices. The unchanged R6
2.6.1 proof composes those generic semantics into a three-level class hierarchy with inherited
fields/methods and recursive `super$initialize()`/`super$greet()` calls. No package-specific branch
or source rewrite was added. Finalization, arbitrary/multiple inheritance breadth, portable-locking
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

## Namespace metadata increment

Language subset 0.284 adds the registered `utils::globalVariables` binding and raises current GNU R
name overlap to 684 of 2,522. GNU R 4.6 black-box evidence covers its exact formals, namespace-
scoped query/add/replace behavior, plus the `utils` ownership of `head` and `tail`. Pure-R package
metadata now distinguishes `exportMethods()` names from ordinary binding exports while reporting
both through `getNamespaceExports()`. Digest-pinned unchanged rstudioapi 0.19.0 and inline 0.3.21
reach P4 through document range/availability and plugin-registry calls, respectively. Complete S4,
RStudio host APIs, inline native compilation/loading, P5-P7, and arbitrary-package compatibility
remain unclaimed.

## Profile 0.355 root, covariance, product, and grid evidence

The evidence registry now contains 1109 flat cases and 63 recursive graphs. The new graph compares
`uniroot` callback forwarding/result structure, covariance-to-correlation normalization,
`tcrossprod` vector promotion, and the exact `graphics::grid` formal names. The available GNU R
4.6.0 advisor is used only locally; GNU R 4.6.1 remains normative.

The name inventory rises to 981 registered bindings with 931 overlapping the 2,522-name GNU R core
inventory. Name overlap remains discovery evidence rather than compatibility proof.

## Profile 0.356 factor-analysis and GPArotation evidence

Profile 0.356 contains 1110 checked-in flat cases and 64 recursive Oracle v2 graphs. The available
GNU R 4.6.0 advisor passes 64/64 graphs, including exact recursive evidence for `setNames`, `sweep`,
maximum-likelihood `factanal`, `loadings`, and a programmatic rotation callback. Pinned GNU R 4.6.1
remains normative.

The unchanged GPArotation 2026.8-1 artifact now completes its first installed `CCAI` example topic
under an explicit bounded high-intensity evidence profile and advances to P4. The next ordered
topic, `GPA`, proceeds through package-owned `cfQ` rotation before reaching the 100,000,000-step
ceiling. P5, arbitrary pure-R package support, and comprehensive GNU R compatibility remain
unclaimed.

## Sixth source-blind package rotation

Language subset 0.285 adds stored-dimension-aware `NROW`/`NCOL` without class dispatch,
row/column-name replacement, base logical constants, bounded GNU R regex/replacement/splitting
semantics, standard apply-family argument matching, factor-label equality/membership, and
atomic-to-list replacement promotion. The four new GNU R names raise current name overlap to 688 of
2,522, which remains inventory rather than behavioral completion. Digest-pinned, unchanged rematch
2.0.0 and whisker 0.4.1 install, load, attach, and reach P4 through declared public surfaces. This
does not claim complete TRE/PCRE identity, every package export, P5-P7, ordered-factor relational
behavior, or arbitrary-package compatibility. Uninspected zeallot 0.2.0 and ini 0.3.1 remain P0
holdouts.

The profile also closes advisory-oracle mismatches for symbol/language coercion in `Sys.which()` and
eager logical validation of `help(verbose=)`. Executable discovery remains limited to the explicit
session allow-list, and help rendering remains browser-owned.

## Seventh source-blind package rotation

Language subset 0.286 adds bounded `startsWith()`/`endsWith()` and `regexec()` capture locations,
symbol/language equality, constructed assignment-call evaluation, promise-origin-aware
`parent.frame()`, runtime constants in normalized language objects, and recursive `as.character()`
coercion. The three new GNU R names raise current overlap to 691 of 2,522; this is inventory, not
behavioral completion. Digest-pinned unchanged zeallot 0.2.0 and ini 0.3.1 install, load, attach,
and reach P4 through representative public surfaces. This does not claim complete regex identity,
every export, P5-P7, or arbitrary-package compatibility. At that rotation boundary, cpp11 0.5.5 and
otel 0.2.0 became the P0 holdouts.

## Eighth source-blind package rotation

Language subset 0.287 separates bounded executable R source from a 64 MiB immutable-resource budget
and adds GNU R-observed list/factor `%s` formatting, `strrep()`, `length<-`, `anyNA()`, and
`make.unique()`. The four new GNU R names raise current overlap to 695 of 2,522; this remains name
inventory, not behavioral completion. Digest-pinned unchanged cpp11 0.5.5 and otel 0.2.0 reach P4
through public header-vendoring and default no-op telemetry APIs. cpp11 compilation, real telemetry
exporters, every export, P5-P7, and arbitrary-package compatibility remain unclaimed. Usage-ranked
At that rotation boundary, BH 1.90.0-1 was the sole untouched P0 holdout.

## Ninth source-blind package rotation

Language subset 0.288 adds prompt archive-limit rejection, default bounded admission of 16,384 files
and 192 MiB of decoded package resources, pre-Worker resource validation, and standard
`exportPattern()` resolution over loaded local namespace bindings. Digest-pinned unchanged BH
1.90.0-1 loads and attaches at P3 with zero exports and the GNU R-observed 12,554 headers totaling
128,040,580 bytes. P4 is not applicable because BH has no R functions; downstream Boost C++
compilation remains outside this evidence. The committed top-100 snapshot has no remaining untouched
candidate whose complete runtime closure is already available and declares no native compilation.

## Tenth package-depth increment

Language subset 0.289 advances digest-pinned unchanged labeling 0.4.3 to P5 through
`extended.figures(2)`. The reusable graphics increment adds the ordered 72-entry `par()` inventory,
the 66-entry mutable view, GNU R-shaped warnings for the six read-only entries, `barplot`
`xaxt`/`yaxt` suppression, and shared `axis()` graphical-control forwarding. The figures path runs
under an explicit 128 MB evaluation-output bound because it emits many browser graphics events.
Complete effects for every graphical parameter, P6 package tests, P7 package-check behavior, and
arbitrary pure-R package compatibility remain unclaimed.

## Eleventh package-depth increment

Language subset 0.290 establishes the first applicable P6 result: digest-pinned unchanged numDeriv
2016.8-1.1 executes all four Rd example topics and all seven top-level package test scripts. The
generic packager retains tests only when explicitly requested, emits a versioned manifest, and keeps
scripts inert until the evidence runner sources them through the ordinary parser, normalized AST,
evaluator, and virtual filesystem. The reusable closure adds `NULL` empty-selection semantics,
matrix/data-frame `diag<-`, browser-safe `Sys.info()`, exact complex integer powers, and
real/complex `asin`, `acos`, and `atan`. The large CSD numerical test uses explicit finite test
limits; defaults are unchanged. This does not claim P7, complete branch-cut identity, or broad P6
coverage across the package corpus.

## Twelfth package-depth increment

Language subset 0.291 advances digest-pinned unchanged abind 1.4-8 from P4 to P6: all five Rd
example topics and all five top-level package test scripts execute through the generic package
pipeline. The reusable closure adds normalized call-entry and expression-vector operations,
syntax-preserving replacement-call frames, unevaluated collapsed dots, pairlist apply-family inputs,
`prod` and standard character constants, matrix/data-frame round-tripping for atomic columns,
one-argument `array`, default `dimnames`, nested `NULL` replacement, and short-name padding. The
3,628,800-element array case uses explicit finite limits rather than changing runtime defaults. A
generic top-level-expression runner honors an installed test error handler after intentional
failures. This proves a second P6 regression package; it does not claim automatic `.Rout.save`
comparison, P7, full list-column coercion, exhaustive language mutation behavior, complete
`R CMD check`, or arbitrary-package compatibility.

## Thirteenth package-depth increment

Language subset 0.292 advances digest-pinned unchanged generics 0.1.4 from P4 to P5 by executing all
three applicable Rd topics through the ordinary package example pipeline. Deeper unchanged withr
3.0.3 evidence drives reusable closure-headed `as.call()` construction, `do.call(envir=)` dynamic
caller propagation, special-form syntax retention, function-scoped `local()` cleanup, and aligned
`sys.calls()`/`sys.frames()` pairlists. This increment recorded `reg.finalizer()` as the next exact
blocker; language subset 0.293 closes that lifecycle contract rather than substituting a no-op.

## Fourteenth package-depth increment

Language subset 0.293 implements environment finalizers against evaluator-owned reachability.
Unreachable targets run their closures in reverse registration order during `gc()`, receive the
target environment, and are removed before invocation; `onexit = TRUE` registrations also run on
asynchronous runtime reset and dispose. The unchanged withr `defer` example therefore completes. The
same generic example traversal closes circular graphics-device selection, locked base
`.sys.timezone` restoration, browser-local `bindtextdomain`, POSIXct formatting, NULL-aware
`mapply`, `setwd` formals, and list-path coercion for `unlink`. Withr remains P4 because its first
applicable P5 blocker is now the browser-admissible `datasets::mtcars` object used by `with_par`;
`datasets::iris` and pre-R-1.7 RNG engines are separately mapped later blockers. DBI and native
makevars topics are inapplicable at this tier and are not counted as passes. `sys.parents()`,
`sys.nframe()`, P6/P7 for generics, P5-P7 for withr, and arbitrary-package compatibility remain
open.

## Fifteenth package-depth increment

Language subset 0.294 adds declarative static core-package resources and isolated namespace
environments. Provenance-audited `mtcars` and corrected `iris` data load through the existing
`data/*.R` and CSV path, appear both on the default search path and through `datasets::`, and
survive session reset without network or host filesystem access. Differential evidence freezes
dimensions, column types/names, row names, factor levels, selected corrected values, and namespace
identity. Unchanged withr `with_par` and `with_tempfile` examples now complete. Withr remains P4
because its first applicable P5 blocker is the historical pre-R-1.7 uniform/normal RNG engines
selected by `with_rng_version`; DBI and native makevars remain inapplicable to the current
browser/pure-R tier.

## Sixteenth package-depth increment

Language subset 0.295 independently implements the Wichmann-Hill and Marsaglia-Multicarry uniform
engines with their versioned seed initialization and fixed-seed GNU R differential sequences.
`RNGversion("1.6.0")` now selects Marsaglia-Multicarry/Buggy-Kinderman-Ramage/Rounding; unchanged
withr sampling examples produce the historical selections and values, then restore the caller's
state. Every applicable withr Rd topic now executes, advancing the unchanged package from P4 to P5.
At profile 0.295, Buggy Kinderman-Ramage normal draws still failed explicitly and remained a general
runtime gap; passing withr did not claim that unexercised algorithm. Profile 0.296 below closes it.

## Seventeenth package-depth increment

Language subset 0.296 independently reconstructs the historical Buggy Kinderman-Ramage normal
generator from the published algorithm and GNU R black-box sequences. Differential cases freeze the
pre-1.7 stream, every rejection region, the legacy triangular coefficient, and the omitted near-zero
density acceptance test. The corrected Kinderman-Ramage generator and other non-default normal kinds
remain explicit boundaries; withr remains P5 while its next package-depth work is P6 test execution.
The opt-in test artifact retains the unchanged `testthat.R` driver and proves that its first P6
blocker is the missing testthat dependency. Current testthat requires native compilation, so this
blocker is deferred to the reusable native-package ABI phase rather than patched around inside
withr.

## Eighteenth semantic increment

Language subset 0.297 exposes corrected Kinderman-Ramage through the same independently owned
transform. It uses the published triangular coefficient, restores the near-zero density acceptance
test, and rejects negative half-normal candidates. Fixed-seed Marsaglia-Multicarry sequences and
targeted near-zero cases match GNU R black-box observations; Ahrens-Dieter, Box-Muller, and
user-supplied normal generators remain explicit boundaries.

## Nineteenth package-depth increment

Language subset 0.298 advances digest-pinned unchanged RColorBrewer 1.1-3 from P4 to P5 by running
its installed `RColorBrewer` Rd topic through the generic package example pipeline. The example
drives shared `plot.default(bty=)` frame-edge selection and GNU R-compatible named-color lookup that
ignores ASCII spaces but rejects tabs and hyphens. No palette table, package branch, or rewritten R
source enters the runtime. The same executable audit freezes viridisLite 0.4.3's first P5 blocker as
the missing external `ggplot2` package, so viridisLite correctly remains P4 until that dependency
closure is admitted.

## Twentieth package-depth increment

Language subset 0.299 audits all three installed cpp11 0.5.5 Rd topics and adds browser-owned
`read.dcf()` semantics for virtual files and connections. Differential cases cover multiple records,
continuations, union and selected fields, missing cells, duplicate fields through `all = TRUE`,
`keep.white`, exact formals, and malformed records. The unchanged `cpp_vendor` topic passes after
copying the package's immutable headers; `cpp_register` and `cpp_source` deterministically stop at
their missing R-package dependency closures. cpp11 therefore remains P4, without pretending that
dependency absence or eventual C++ compilation succeeded.

## Twenty-first package-depth increment

Language subset 0.300 advances digest-pinned unchanged otel 0.2.0 from P4 to P5 by executing all 45
frozen installed Rd topics through the generic example pipeline. GNU R black-box cases specify
primitive `is.finite()` across atomic storage modes and structural attributes, aligned
`sys.nframe()`/`sys.calls()`/`sys.frames()` closure depth, `topenv()` boundaries, and the locked
session-current `.GlobalEnv` binding. These are shared Base/runtime semantics: no package name,
rewritten R source, telemetry exporter, network access, or host telemetry object enters execution.
P6/P7, exporter-backed scenarios, and arbitrary-package compatibility remain unclaimed.

## Twenty-second package-depth increment

Language subset 0.301 advances digest-pinned unchanged pkgconfig 2.0.3 and crayon 1.5.3 from P4 to
P5. Pkgconfig's exact four-topic installed help manifest contains no Examples sections, making its
applicable-example set explicitly empty. Crayon's complete frozen 19-topic installed example
manifest runs unchanged. GNU R black-box cases specify the full `nchar(x, type, allowNA, keepNA)`
surface, Unicode/byte/width counting, bind dimnames and `deparse.level`, selected-name propagation
in `which*`, structural comparison names, and attributes on first-class callable builtins. These are
shared Base/runtime semantics; no package-specific branch, rewritten R source, terminal access, or
host locale probe enters execution. P6/P7 and arbitrary-package compatibility remain unclaimed.

## Twenty-third package-depth increment

Language subset 0.302 advances digest-pinned unchanged assertthat 0.2.1 and praise 1.0.0 from P4 to
P5. All 11 assertthat topics and praise's sole topic execute through the generic installed example
pipeline. GNU R black-box cases specify `is.primitive()` across builtin, special, closure, and
non-function values; `match.call()` with explicit definition/call/environment and canonical dots;
unique-partial `all.equal(tol=)` matching; class-preserving `stop(condition)` and `tryCatch`
handlers; and deterministic `file.access()` over browser-owned files and directories. No package
name, rewritten source, host filesystem probe, or assertion-specific error path enters the runtime.
P6/P7 and arbitrary-package compatibility remain unclaimed.

## Twenty-fourth package-depth increment

Language subset 0.303 advances digest-pinned unchanged prettyunits 1.2.0 from P4 to P5. All eight
frozen installed Rd topics execute through the generic example pipeline. GNU R black-box cases
specify exact closure formals and S3 dispatch for `units()`/`units<-`, value-preserving difftime
unit replacement across seconds, minutes, hours, days, and weeks, primitive `is.infinite()` across
atomic storage modes, the measured `formatC()` numeric formatting controls, and source-ordered bind
argument forcing verified by the unchanged numDeriv P6 suite. No package name, rewritten source,
host formatter, or locale probe enters the runtime. Full `formatC()` locale, multibyte, complex, and
width-preservation equivalence, P6/P7, and arbitrary-package compatibility remain unclaimed.

## Twenty-fifth package-depth increment

Language subset 0.304 advances digest-pinned unchanged evaluate 1.0.5 from P4 to P5. All six frozen
installed Rd topics execute through the generic example pipeline. Shared semantics now cover dynamic
calling handlers and standard muffle restarts, named restarts, cooperative interrupt control,
recursive mixed-value `unlist()`, expression-vector iteration and apply families, source-reference
attributes plus `removeSource()`, hook composition, sequence controls, and AsIs list/expression
data-frame columns. Recorded plots expose the browser-owned display-list shape needed by the
unchanged graphics example, while an explicit `systemCommand` host adapter supplies the example's
admitted R-version query. No package-name branch, rewritten source, ambient process execution, or
package-specific runtime object enters the implementation. Complete condition and graphics
equivalence, P6/P7, and arbitrary-package compatibility remain unclaimed.

## Twenty-sixth package-depth increment

Language subset 0.305 advances digest-pinned unchanged rprojroot 2.1.1, rstudioapi 0.19.0, rematch
2.0.0, whisker 0.4.1, zeallot 0.2.0, and ini 0.3.1 from P4 to P5. Their exact installed help
manifests contain 5, 29, 1, 4, 3, and 2 runnable topics respectively, and every runnable block
executes unchanged through the generic example pipeline. Provenance-audited browser-owned
`datasets::InsectSprays` and `datasets::faithful` resources close the two data blockers through the
same static-package path as other core data. RStudio-dependent behavior remains deterministically
unavailable unless an application supplies an explicit host capability; no IDE authority, package
branch, rewritten source, or host filesystem access enters the runtime. The remaining P4 paths are
viridisLite's external example dependency and inline/cpp11 native or dependency closures. P6/P7 and
arbitrary-package compatibility remain unclaimed.

## Recursive function-introspection increment

Language subset 0.306 corrects the public R values produced from closure body AST nodes: symbols and
atomic literal bodies retain their GNU R storage types, while only compound syntax is a language
object. Empty closure formals are `NULL`. Oracle v2 now recursively observes captured closure state,
environment parents and bindings, cycles, shared identity, language structure, and nested
attributes. Its seven exact GNU R graph comparisons are linked to 19 validated behavioral registry
bindings, replacing the prior unmeasured recursive-binding count. Complete reflection, promises,
environments, language mutation, and arbitrary-package compatibility remain unclaimed.

## Function replacement and enclosure increment

Language subset 0.307 implements black-box-observed `body<-`, `formals<-`, and `environment<-`
semantics. The first two expose GNU R's closure formals, preserve the unchanged portion of a
function, and honor an explicit replacement enclosure. Body values stay normalized runtime values or
AST nodes rather than executable JavaScript. Primitive environment replacement handles closures,
formulas, ordinary attributed vectors/containers, language objects, and GNU R's warning-only
primitive-function boundary. An eighth exact Oracle v2 graph proves replacement closures and
ordinary values share the intended enclosure. Complete reflection and arbitrary-package
compatibility remain unclaimed.

## List-to-function construction increment

Language subset 0.308 adds closure-shaped `as.function(x, ...)` S3 dispatch and
`as.function.default(x, envir = parent.frame(), ...)`. The default method constructs normalized
closures from lists, preserves missing/defaulted formals and duplicate tags, uses the last list
entry as the body, honors caller or explicit enclosures, and returns existing closures unchanged.
Pairlists remain an explicit error, matching the black-box contract. A ninth recursive graph case
observes the constructed closure and its shared captured enclosure. This does not claim complete
metaprogramming or arbitrary-package compatibility.

## Source-blind reference-class package increment

Language subset 0.309 advances the previously untouched `docopt 0.7.2` holdout from its first
`methods::setRefClass` blocker to P5 without package-specific rewrites. The reusable implementation
adds a bounded Reference Class generator and instance model with inherited fields and methods,
active fields, `.self`, `$new`, initializer invocation, and ordinary S4 `as.character` dispatch. The
same blocker walk added GNU-R-observed `is.na<-`, leading inline regular-expression modes,
`regmatches<-` for `regexpr`/`gregexpr`, zero-length short-circuit logical state, NULL substring
results, and list-aware `%in%` and equality seams.

Checked-in differential evidence is 961/961. The local GNU R 4.6.0 advisory oracle matches 909 of
913 eligible cases; the four remaining differences are the pinned GNU R 4.6.1 version fields, so
normative release gating still requires 4.6.1. This increment proves one source-blind package path,
not arbitrary pure-R package compatibility; untouched `getopt 1.21.1` remains the next independent
holdout.

## Source-blind command-option package increment

Language subset 0.310 advances the previously untouched `getopt 1.21.1` holdout to P5 without
package-specific rewrites. Its first runtime blocker was GNU R-shaped `match(..., nomatch=)`
coercion. The unchanged package then exposed reusable `Negate()`, `storage.mode()` replacement, and
browser `commandArgs()` contracts. After those generic seams were implemented, its representative
option parse and usage string match GNU R, and all four applicable installed Rd examples execute
without warnings.

Checked-in differential evidence is 964/964. The local GNU R 4.6.0 advisory oracle matches 911 of
915 eligible cases and skips 49 explicitly non-oracle cases; the only four differences remain the
pinned GNU R 4.6.1 version fields. The generated inventory records 764 registered bindings and 743
GNU R name overlaps out of 2,522, but those counts remain inventory rather than compatibility
evidence. The 27-release corpus has 23 passing, three blocked, and one deliberately unevaluated
path; 25 reach P4 and 22 reach P5. Untouched `optparse 1.8.2` is the next independent holdout.

## Source-blind S4 option-parser package increment

Language subset 0.311 advances the previously untouched `optparse 1.8.2` holdout to P5 without
package-specific rewrites. The initial packaging failure was the generic `exportClasses()` NAMESPACE
directive. Subsequent unchanged loading and examples exposed exact S4 slot extraction/replacement,
registered validity methods, package-local replacement generic definition, and `cat(fill=)` output
wrapping. The package now installs, loads, attaches, produces GNU R-matching representative
flag/value/positional results, and executes the exact four-topic applicable installed example
manifest.

Checked-in differential evidence is 966/966. The local GNU R 4.6.0 advisory oracle matches 913 of
917 eligible cases and skips 49 explicitly non-oracle cases; the only four differences remain the
pinned GNU R 4.6.1 version fields. The generated inventory records 766 registered bindings and 745
GNU R name overlaps out of 2,522, but those counts remain inventory rather than compatibility
evidence. The 28-release corpus has 24 passing, three blocked, and one deliberately unevaluated
path; 26 reach P4 and 23 reach P5. Untouched `argparser 0.7.3` is the next independent holdout.

## Source-blind list-coercion and S4-coercion package increment

Language subset 0.312 advances the previously untouched `argparser 0.7.3` holdout to P5 without
package-specific rewrites. Installation, namespace loading, and attachment succeed before source
inspection. Its first representative execution blocker is scalar list/pairlist `as.logical()`
coercion; the exact installed examples subsequently expose S4 `coerce` method selection by source
and target signatures. After those generic seams are implemented, its representative positional,
integer-option, and flag results match GNU R and all three applicable installed examples execute.

Checked-in differential evidence is 968/968. The local GNU R 4.6.0 advisory oracle matches 915 of
919 eligible cases and skips 49 explicitly non-oracle cases; the only four differences remain the
pinned GNU R 4.6.1 version fields. Recursive Oracle v2 is 10/10 and associates 27 behaviorally
proven bindings. The generated inventory records 766 registered bindings and 745 GNU R name overlaps
out of 2,522, but those counts remain inventory rather than compatibility evidence. The 29-release
corpus has 25 passing, three blocked, and one deliberately unevaluated path; 27 reach P4 and 24
reach P5. Untouched `iterators 1.0.14` is the next independent holdout.

## Source-blind iterator and caller-environment S3 increment

Language subset 0.313 advances the previously untouched `iterators 1.0.14` holdout to P5 without
package-specific rewrites. Installation, namespace loading, and attachment succeed before source
inspection. Its first representative blocker is discovery of an unexported legacy S3 method from the
package caller environment; installed examples then expose immutable `R.home()` text resources and
`levels()`/`nlevels()` semantics. Named iteration, exhaustion, chunking, and all nine applicable
installed examples now execute unchanged.

Checked-in differential evidence is 971/971. The GNU R 4.6.0 advisory oracle matches 917 of 921
eligible cases; only the four pinned 4.6.1 version-field differences remain. Recursive Oracle v2
passes all 12 exact cases and associates 32 behaviorally proven bindings. The generated inventory
records 767 registered bindings and 746 GNU R name overlaps out of 2,522. The 30-release corpus has
26 passing, three blocked, and one deliberately unevaluated path; 28 reach P4 and 25 reach P5.
Untouched `foreach 1.5.2`, including its frozen pure-R `codetools` dependency closure, is next.

Language subset 0.314 advances that unchanged dependency closure to P5. Generic `compiler::compile`
evaluation identity, named call-entry preservation, and `%*%` semantics close the observed blockers
without a package-name branch. `foreach` now loads, attaches, matches GNU R on sequential and nested
execution, and completes all four applicable installed example topics.

Checked-in differential evidence is 975/975. The GNU R 4.6.0 advisory oracle matches 921 of 925
eligible cases; only the four pinned 4.6.1 version-field differences remain. Recursive Oracle v2
passes all 15 exact cases and associates 38 behavioral bindings. The generated inventory records 769
registered bindings and 747 GNU R name overlaps out of 2,522. The 31-release corpus has 27 passing,
three blocked, and one deliberately unevaluated path; 29 reach P4 and 26 reach P5. Untouched
`doParallel 1.0.17` is next.

Language subset 0.315 advances unchanged `doParallel 1.0.17` to P5. Core-package provisioning,
DESCRIPTION `Depends` attachment, exact one-lane map/split behavior, and a browser sequential PSOCK
adapter close its reusable blockers without host processes or package-specific rewrites. The public
adapter matches applicable GNU R values and shapes but explicitly does not claim concurrent or
distributed execution.

Checked-in differential evidence is 977/977. The GNU R 4.6.0 advisory oracle matches 922 of 926
eligible cases; only the four pinned 4.6.1 version-field differences remain. Recursive Oracle v2
passes all 16 exact cases and associates 41 behavioral bindings. The generated inventory records 779
registered bindings and 747 GNU R name overlaps out of 2,522. The 32-release corpus has 28 passing,
three blocked, and one deliberately unevaluated path; 30 reach P4 and 27 reach P5. Untouched
`pbapply 1.7-4` is next.

Language subset 0.316 adds exact `crossprod()` structure and values, vectorized `rnorm()`
parameters, retained linear-model frames, text-progress state, single-lane `parLapply` shapes, and
safe package-platform namespace selection. Unchanged `pbapply 1.7-4` reaches P4 but remains below P5
at fitted-call formula reconstruction.

Checked-in evidence is 982/982. The GNU R 4.6.0 advisory oracle matches 926 of 930 eligible cases;
only the four pinned 4.6.1 version-field differences remain. The browser text-progress case is
excluded because terminal drawing is intentionally outside its browser-admissible contract.
Recursive Oracle v2 passes 17/17 exact cases and associates 42 behavioral bindings. The generated
inventory records 787 bindings and 753 GNU R name overlaps out of 2,522. The 33-release corpus has
28 passing, four blocked, and one deliberately unevaluated path; 31 reach P4 and 27 reach P5.
Untouched `globals 0.19.1` is next.

## Profile 0.317 version bindings and package-driven reflection

Profile 0.317 adds executable cases for the locked browser-owned `R.version`/`version` bindings,
environment `names()`, non-vector `seq_along()`, attributed-language `unclass()`, and nested
list-cell data-frame `[[<-`. Checked-in evidence is 986/986. GNU R 4.6.0 is advisory because the
normative target is 4.6.1; 929 of 933 eligible cases match, with only the same four target-version
field differences. Recursive Oracle v2 remains 17/17 with 42 associated behavioral bindings, and
inventory remains 787 registered bindings with 753 GNU R overlaps out of 2,522.

The 34-release corpus has 28 passing, five blocked, and one deliberately unevaluated entry; 32 reach
P4 and 27 reach P5. `globals 0.19.1` is P4 and untouched `listenv 1.0.0` is next.

## Profile 0.318 classed-environment and Base-message evidence

Profile 0.318 adds exact black-box cases for primitive S3 extraction/replacement and shape dispatch
on classed environments, plus browser-owned translation formatting, condition-message assembly, and
atomic membership. Checked-in evidence is 988/988, with 935 cases eligible for the live GNU R
advisor. Against the available non-normative GNU R 4.6.0 installation, 931 of 935 eligible cases
match; the four differences are the pinned 4.6.1 version fields. Recursive Oracle v2 advances to
18/18 with 56 explicitly associated behavioral bindings. The generated inventory records 791
bindings and 757 GNU R name overlaps out of 2,522.

The 35-release corpus has 29 passing, five blocked, and one deliberately unevaluated entry; 33 reach
P4 and 28 reach P5. `listenv 1.0.0` now passes all installed examples at P5, and untouched
`R.methodsS3 1.8.2` is next.

Profile 0.319 adds exact black-box cases for namespace-qualified replacement, closure-valued
substitution with assignment-target rewriting, Utils object/S3 lookup, system-frame shapes,
`library()` formals, and Base namespace introspection. Checked-in evidence is 990/990, with 937
cases eligible for the live GNU R advisor. Recursive Oracle v2 advances to 19/19 with 62 explicitly
associated behavioral bindings. The generated inventory records 799 bindings and 765 GNU R name
overlaps out of 2,522.

Against the available non-normative GNU R 4.6.0 installation, 933 of 937 eligible cases match. The
four remaining differences are exactly the pinned 4.6.1 version fields in `sessionInfo()`,
`packageVersion()`, `getRversion()`, and `packageDescription()`.

The 36-release corpus has 30 passing, five blocked, and one deliberately unevaluated entry; 34 reach
P4 and 29 reach P5. `R.methodsS3 1.8.2` now passes all installed examples at P5, and unopened pure-R
`R.oo 1.27.1` is next.

## Profile 0.320 R.oo compatibility evidence

Profile 0.320 adds exact cases for binary Ops with NULL, primitive `as.character` dispatch on
classed closures, explicit-object and forwarded-argument `NextMethod`, `strsplit(NULL)`, coercible
`grep`/`grepl` inputs, `attr(..., exact=)` matching, and common `utils::person()` Authors@R values.
The recursive observer contains 22 cases with 72 explicitly associated behavioral bindings.

Against the available non-normative GNU R 4.6.0 installation, 940 of 944 eligible flat cases match.
The four differences are exactly the target 4.6.1 version fields in `sessionInfo()`,
`packageVersion()`, `getRversion()`, and `packageDescription()`; the new profile cases all match.

Unchanged `R.oo 1.27.1` and its dependency install and execute all 90 frozen installed Rd example
topics at P5. This raises the 37-release corpus to 31 passing, five blocked, and one deliberately
unevaluated holdout; 35 reach P4 and 30 reach P5. These results are executable profile evidence, not
a claim of complete Base R or arbitrary-package compatibility.

## Profile 0.321 R.utils compatibility evidence

Profile 0.321 adds flat black-box cases for R octal/hex string escapes, atomic dimension-name
coercion, browser-owned MD5, condition signalling and exiting handlers, `source(keep.source=TRUE)`,
cooperative time-limit shape, and graphics-layout state. The recursive observer has 23 cases with 79
explicitly associated behavioral bindings. Checked-in conformance is 1009/1009; 953 cases are
eligible for a same-platform live GNU R oracle after browser-specific capability cases are excluded.
Against the available non-normative GNU R 4.6.0 installation, 949 of 953 eligible cases match. The
four differences are exactly the pinned 4.6.1 version fields in `sessionInfo()`, `packageVersion()`,
`getRversion()`, and `packageDescription()`.

Unchanged `R.utils 2.13.0` and its dependency closure install and complete the frozen installed
example set at P5, with host-process and optional-native-dependency paths asserted at their explicit
browser boundaries. The 38-release corpus has 32 passing, five blocked, and one unevaluated holdout;
36 reach P4 and 31 reach P5. Inventory records 846 registered bindings and 807 GNU R name overlaps
out of 2,522. This evidence does not claim complete Base R or arbitrary-package compatibility.

## Profile 0.322 here generalization evidence

The previously untouched `here 1.0.2` package and its existing `rprojroot` dependency install, load,
attach, execute `here()`, and complete all three frozen installed-example topics without a runtime
change. After admitting `R.matlab 3.7.0` from metadata only, the 39-release corpus has 33 passing,
five blocked, and one unevaluated entry; the development, regression, and holdout partitions contain
2, 36, and 1 entries. All 39 reach P0, 38 reach P1-P3, 37 reach P4, 32 reach P5, two reach P6, and
none reaches P7.

Flat conformance remains 1009/1009, the non-normative GNU R 4.6.0 advisor remains 949/953 with only
the four pinned 4.6.1 version-field differences, and recursive Oracle v2 remains 23/23 with 79
associated behavioral bindings. Inventory remains 846 registered bindings and 807 GNU R overlaps out
of 2,522. Zero-blocker package evidence is useful generalization evidence, not a completion claim.
The frozen `R.matlab` archive remains unopened and is the next source-blind pure-R
dependency-closure probe. A candidate requiring mandatory native code, such as `R.cache` through
`digest`, is not a substitute for this Phase 2 evidence.

## Profile 0.323 R.matlab compatibility evidence

The frozen unchanged `R.matlab 3.7.0` dependency closure installs, loads, attaches, completes its
exact four-topic installed-example manifest, and round-trips scalar, vector, and matrix data through
MAT v5 files at P5. Its source-blind first blocker and every accepted fix are recorded as generic
packaging or runtime semantics; JVM and external MATLAB execution are not claimed.

Flat conformance is 1011/1011. Of 955 live-oracle-eligible cases, the available non-normative GNU R
4.6.0 advisor matches 951; the four differences remain exactly the target 4.6.1 version fields.
Recursive Oracle v2 remains 23/23 with 79 associated behavioral bindings. After the metadata-only
`combinat 0.0-8` freeze, the 40-release corpus has 34 passing, five blocked, and one unevaluated
entry; 38 reach P4 and 33 reach P5. Inventory is 847 registered bindings and 808 GNU R name overlaps
out of 2,522; this name count is inventory only.

`combinat` is the next source-blind holdout. Its dependency-free, `NeedsCompilation: no` metadata,
35,946-download comparison window, 9,197-byte archive, and source SHA-256 were recorded before any
archive listing, extraction, parsing, or execution.

## Profile 0.324 combinat compatibility evidence

The previously frozen unchanged `combinat 0.0-8` package reaches P5 after generic implementations of
`lgamma()`, `tabulate()`, and `gamma()`, plus correct Rd percent-comment handling. All six
applicable installed example topics pass, with no package-identity branch. Flat conformance is
1014/1014 and 958 cases are live-oracle eligible. Recursive Oracle v2 remains 23/23 with 79
associated behavioral bindings.

After freezing the next holdout, the corpus contains 41 releases: 35 passing, five blocked, and one
unevaluated; 41 reach P0, 40 reach P1-P3, 39 reach P4, 34 reach P5, and two reach P6. Inventory is
850 registered bindings and 811 GNU R name overlaps out of 2,522; name overlap remains inventory
rather than semantic proof.

The available non-normative GNU R 4.6.0 advisor matches 954/958; the four differences remain exactly
the pinned 4.6.1 version fields. `matrixcalc 1.0-6` is the next metadata-frozen P0 holdout; its
archive remains unopened.

## Profile 0.325 matrixcalc compatibility evidence

The previously frozen unchanged `matrixcalc 1.0-6` release reaches P5 after generic POSIX
`exportPattern`, matrix/vector promotion, triangle/coordinate, Kronecker, choose/lchoose,
determinant/solve, QR, and SVD semantics. All 60 exact installed example topics pass with no
package-identity branch. After the next metadata-only freeze, the corpus contains 42 releases: 36
passing, five blocked, and one unevaluated; 40 reach P4, 35 reach P5, and two reach P6.

Flat conformance is 1020/1020, with 964 live-oracle-eligible cases. The non-normative GNU R 4.6.0
advisor matches 960/964; the four differences remain the pinned 4.6.1 version fields. Recursive
Oracle v2 remains 23/23 with 79 associated bindings. Inventory is 872 registered bindings and 833
GNU R name overlaps out of 2,522; these name counts remain inventory rather than semantic proof.

The next untouched P0 holdout is `Formula 1.2-6`, selected as the highest-usage browser-admissible
pure-R candidate after excluding host-clipboard `clipr` and native `parallelly`. Only metadata,
usage count, byte length, source URL, and unopened archive digest are admitted at this boundary.

## Profile 0.326 Formula compatibility evidence

The previously metadata-frozen unchanged `Formula 1.2-6` release reaches P5. Generic runtime and
modeling increments now cover custom formula classes and attributes, formula call mutation,
match.fun-backed apply calls, updates, terms variables/factors/response/offset metadata, dot
expansion, model-frame expression columns, formula equality, response deletion/extraction, model
matrices, and multiple offsets. Its pinned artifact digest is
`c2c65ec4d007ebd4c304e43a0e2c402ca047e0ae38d8667bbf79aaa918007b0b`; both exact installed example
topics execute after unchanged install/load/attach.

Flat evidence is 1021/1021 with 965 live-oracle-eligible cases. The GNU R 4.6.0 advisor matches
961/965, with only the four pinned 4.6.1 version differences. Recursive Oracle v2 is 24/24 with 86
associated behavioral bindings. Inventory is 877 registered bindings and 838 overlaps out of 2,522.
The 43-release corpus has 38 passing, five blocked, and 37 at P5 or above; these remain versioned
evidence, not a comprehensive GNU R or arbitrary-package claim.

## Profile 0.327 DBI compatibility evidence

The independently frozen unchanged `DBI 1.3.0` archive now reaches P5. Generic methods/S3/S4,
Date/class, namespace-export, and row-name increments carry install, namespace load, attach,
representative ANSI/Id/SQL calls, and all applicable blocks in the exact 58-topic installed help
manifest. Flat conformance is 1032/1032, the non-normative GNU R 4.6.0 advisor is 972/976 with only
the four pinned 4.6.1 version differences, and recursive Oracle v2 is 25/25 with 93 bindings. This
does not claim concrete database backends, connectivity, DBI P6/P7, or arbitrary-package support.

`xtable 1.8-8` is the replacement untouched P0 holdout. Official metadata declares
`NeedsCompilation: no`, no OS restriction, and only browser-core mandatory dependencies. Source
SHA-256 `b999c031b91255fb92134b0e70e5f84c5609e9312c0518393b9d0a4aaf6b2510` identifies the unopened
618,708-byte archive. The corpus therefore has 44 releases, including one unevaluated holdout; P0
adds no xtable execution or rendering claim.

## Profile 0.330 xtable compatibility evidence

The independently frozen unchanged `xtable 1.8-8` archive reaches regression P5. Generic dataset,
data-frame, LM/AOV, family/IRLS GLM, PCA, flat-table, and argument-matching increments carry
install, namespace load, attach, and every runnable block in the exact eight-topic installed help
manifest. Flat checked-in conformance is 1046/1046. The non-normative local GNU R 4.6.0 advisor
matches 986/990 with only the four pinned 4.6.1 version differences, and recursive Oracle v2 is
27/27 with 114 associated behavioral bindings. The 44-release corpus now has 39 passing and five
blocked entries, 38 at P5 or above, two at P6, and none at P7. This is versioned evidence for the
pinned archive, not complete Base R, arbitrary pure-R package support, P6/P7 closure, or native-code
package compatibility.

## Profile 0.331 core namespaces and globals compatibility evidence

Core builtins now inhabit distinct Base, Stats, Utils, Methods, Graphics, and grDevices namespace
environments instead of relying on Base leakage. Default attached-package lookup remains intact,
non-exported core S3 methods are session-registered and rebuilt after reset, and `.BaseNamespaceEnv`
has the observed locked Base identity. Top-level `substitute()` preserves global symbols, while
local substitution retains ordinary binding replacement. First-class `{`, `<-`, and `[` values plus
primitive `NextMethod()` fallback close the package-driven traversal path.

The unchanged source-blind `codetools 0.2-20` and `globals 0.19.1` closure now installs, loads,
attaches, runs representative DFS/conservative/liberal analysis, and completes both installed help
topics, advancing globals to regression P5 without a package-name branch. Flat conformance is
1047/1047 and recursive Oracle v2 is 28/28 with 121 associated behavioral bindings. The corpus has
40 passing and four blocked releases, 39 at P5 or above, two at P6, and none at P7. Complete Base R,
arbitrary pure-R packages, P6/P7 closure, and native-package compatibility remain unclaimed.

## Profile 0.332 apply, data, reflection, and package evidence

GNU R black-box cases now cover corrected `eval.parent()` forcing and caller selection, `fivenum`,
numeric `outer`, trimmed `mean`, shallow `unlist`, list-expanding `table`, GNU-compatible `sum`
result types, source-attribute-stripping array construction, trace/untrace state, `.mapply`, factor
level replacement, nested replacement calls, and quoted `do.call`. Provenance-audited browser data
adds `datasets::warpbreaks` and `datasets::presidents` with shape, type, value, and identity checks.

These semantics carry unchanged `pbapply 1.7-4` through all four installed example topics and to
regression P5. Flat conformance is 1052/1052 and recursive Oracle v2 is 29/29 with 136 associated
behavioral bindings. The corpus has 40 passing and four blocked releases, 40 at P5 or above, two at
P6, and one at P7. The evidence remains bounded to the declared browser-admissible contract;
complete Base R, arbitrary pure-R packages, and native-package compatibility remain unclaimed.

The available non-normative GNU R 4.6.0 flat advisor matches 991/995 eligible cases. Its four
differences are only the target-version fields pinned by NativR to 4.6.1; a normative 4.6.1 run is
still required for release gating.

The generic package-check runner advances unchanged `numDeriv 2016.8-1.1` to P7 after every
applicable installed metadata, namespace, attachment, documentation, example, and package-test check
passes in isolation. The same runner keeps `abind 1.4-8` at P6 and records its first P7 failure as
GNU-compatible printed names/dimnames in normalized `abind.Rout.save` output. Successful evaluation
without reference-output agreement is not treated as package-check compatibility.

## Profile 0.333 parenthesis, presentation, condition-call, and P7 evidence

GNU R black-box cases now cover parentheses as a visibility-bearing normalized call, compact S3
method calls, replacement calls with the evaluated `value` expression, table leading/trailing
formatting, array/matrix row, column, and axis names, numeric vector index-label padding, and
batch-style error call stacks and line wrapping. Checked-in conformance is 1054/1054; recursive
Oracle v2 is 30/30 with 142 associated behavioral bindings.

The identity-agnostic package-check runner now passes every applicable check for unchanged
`abind 1.4-8`, including normalized comparison of all five retained `.Rout.save` references. Abind
therefore joins numDeriv at P7. The 44-release corpus has 41 passing and three blocked releases, 40
at P5 or above, two at P6, and two at P7. This evidence remains bounded to the pinned releases and
does not claim arbitrary pure-R package compatibility or comprehensive GNU R compatibility.

The next source-blind checkpoint is now frozen as unevaluated `selectr 0.6-0`, chosen through
official metadata and fixed-window usage evidence before source inspection. It has no native or OS
restriction and imports only already-passing `R6`; the unopened source digest is recorded in the
corpus. This raises the corpus to 45 releases—41 passing, three blocked, and one unevaluated—without
changing any compatibility claim.

## Profile 0.334 unmatched capture and package-check evidence

GNU R black-box evidence now covers recursive `regexec()` objects with matched, unmatched optional,
and zero-length captures. NativR preserves the `0/0` unmatched-capture location, extracts it as
`""`, and matches the ASCII `useBytes`/`index.type` attribute contract exactly. Checked-in
conformance is 1055/1055; recursive Oracle v2 is 31/31 with 144 associated behavioral bindings. The
available non-normative GNU R 4.6.0 flat advisor matches 994/998 eligible cases; the only
differences are the four target-version fields intentionally pinned to GNU R 4.6.1.

The same reusable fix plus guarded declared-Suggests warning handling advances unchanged
`selectr 0.6-0` through both installed examples to P5. Its retained test requires unavailable
suggested package `testthat`, so the package remains explicitly blocked before P6. The corpus has 45
releases: 41 passing and four blocked, with two at P7. No broader XML, CSS-selector, testthat, or
arbitrary-package claim is implied.

The next source-blind checkpoint is frozen as unevaluated `timeDate 4052.112` using only public
metadata, the fixed usage window, and the unopened archive digest. Its mandatory dependencies are
browser core and it declares no native compilation or OS restriction. This raises the corpus to 46
releases - 41 passing, four blocked, and one unevaluated - without changing any compatibility claim.

## Profile 0.335 S4 redispatch, serialization, and timeDate evidence

GNU-observed formals and behavior now cover `.POSIXct`, `setReplaceMethod`, `callGeneric`, and
`getDataPart`; the XDR serializer also round-trips an exact GNU-produced `S4SXP` fixture. Standard
`pretty`, `julian`, `months`, `quarters`, and `weekdays` generic entry points allow package-owned
methods to register unchanged. Explicit POSIXct axis ticks preserve ordering, class, timezone,
labels, and invisibility. Default calendar-aware tick choice and exhaustive `pretty` boundaries are
still incomplete.

Unchanged `timeDate 4052.112` supplies package evidence through P4: install, namespace, attach, a
representative calendar path, and the retained test script pass. Its complete example and
package-check surfaces do not, so this is not evidence for arbitrary pure-R packages or complete
Base R/S4 compatibility.

## Profile 0.338 source-blind generic and POSIXlt evidence

Checked-in evidence now covers 1079 flat cases and 34 recursive Oracle v2 graphs. The new surface is
argument matching and missingness, S3/S4 dispatch for sequence/missingness/deduplication, `pmatch`,
callable and POSIXlt subset replacement, POSIXlt parse/format/convert behavior, and `julian.POSIXt`.
All additions are owned browser-first implementations; GNU R remains only the black-box oracle.

Unchanged `timeDate 4052.112` now passes the former `align`, `isBizday`, and `nDay` example
frontiers. `example:periods` is the first remaining failure, so the package stays at P4 and no
comprehensive GNU R or arbitrary-package compatibility claim is made.

## Profile 0.339 length and POSIXlt differential evidence

Checked-in evidence now covers 1084 flat cases and 36 recursive Oracle v2 graphs. The added graphs
compare S3/S4 length behavior, recursive element lengths, POSIXlt short-component recycling, and the
exact `.leap.seconds` object graph. The available GNU R 4.6.0 installation passes all 36 graphs as a
non-normative advisor; GNU R 4.6.1 remains the normative target and release gate.

Unchanged `timeDate 4052.112` passes its former `periods` example failure, while independent
source-blind probes confirm 86 period windows and 86 monthly rolling windows, matching GNU R. Its
next first failure is missing generic `base::asplit` in `example:timeDate-class`, so the explicit
package tier remains P4. No complete GNU R or arbitrary-package claim follows from this increment.

## Profile 0.340 array, empty-result, and language differential evidence

Checked-in evidence now covers 1088 flat cases and 39 recursive Oracle v2 graphs. New exact graphs
compare `asplit` array-margin structure, `apply` zero-length result typing, and recursive
`all.names` enumeration. The available GNU R 4.6.0 installation passes all 39 graphs as a
non-normative advisor; pinned GNU R 4.6.1 remains the normative target and release gate. Graphics S4
dispatch and measured axis-style behavior additionally have executable flat evidence because their
public compatibility level remains shape rather than full behavioral compatibility.

Unchanged `timeDate 4052.112` now crosses `timeDate-class`, `plot-methods`, and `holiday`. Its next
first failure is `example:in_int` at a non-S4 `@` access path, so the package remains P4 and no
comprehensive GNU R or arbitrary-package support is claimed.

## Profile 0.341 S4 construction and replacement differential evidence

Checked-in evidence now covers 1090 flat cases and 42 recursive Oracle v2 graphs. New exact graphs
compare valid `seq.int` control combinations, S4 `initialize`/`callNextMethod` ordering with
registered `names` replacement, and subscript-based `is.na<-` behavior over lists, factors, and
atomic vectors. The available GNU R 4.6.0 installation passes all 42 graphs as a non-normative
advisor; pinned GNU R 4.6.1 remains the normative target and release gate.

The unchanged `timeDate 4052.112` package crosses four more installed-example frontiers. Its next
first failure is `example:timeCeiling` at POSIXlt validation, so the package remains P4 and neither
comprehensive GNU R nor arbitrary pure-R package compatibility is inferred.

## Profile 0.342 POSIXlt extraction and month-name differential evidence

Checked-in evidence now covers 1092 flat cases and 43 recursive Oracle v2 graphs. New evidence
compares observation-wise and component-wise POSIXlt extraction, balanced-state normalization,
short-component behavior, names and all eleven component lengths, plus C-locale abbreviated/full
month parsing. The available GNU R 4.6.0 installation passes all 43 graphs as a non-normative
advisor; pinned GNU R 4.6.1 remains the normative target and release gate.

The unchanged `timeDate 4052.112` artifact now passes the generic package-check plan through P7.
This is strong package evidence for the covered surface, but it is neither comprehensive GNU R
compatibility nor proof that arbitrary pure-R packages will pass.

## Profile 0.343 LazyData and factor-contrast differential evidence

Checked-in evidence now covers 1093 flat cases and 44 recursive Oracle v2 graphs. The new exact
graph compares unordered factor defaults, stored numeric/string contrast attributes, identity
coding, and dense sum/treatment generators. The available GNU R 4.6.0 installation passes all 44
graphs as a non-normative advisor; pinned GNU R 4.6.1 remains the normative target and release gate.

The unchanged `carData 3.0-6` source archive passes the generic package-check plan through P7 after
reusable LazyData, xz normalization, bounded resource transport, and contrast work. Namespace/data
environment separation and large data dimensions/names are independently probed. Arbitrary pure-R
packages, installed `.rdx`/`.rdb` databases, ordered/sparse contrasts, and comprehensive GNU R
compatibility remain unclaimed.

## Profile 0.344 literal call-head differential evidence

Checked-in evidence now covers 1094 flat cases and 45 recursive Oracle v2 graphs. The new exact case
compares a captured literal character call head through `[.call`, `as.list()`, `as.call()`, type
inspection, and the expected evaluation error. The available GNU R 4.6.0 installation passes all 45
graphs as a non-normative advisor; pinned GNU R 4.6.1 remains the normative target and release gate.

The unchanged `rex 1.2.2` artifact reaches P5 through all five installed examples and an independent
capture/match probe. Its retained test first stops at unavailable suggested package `testthat`. This
is bounded evidence for one digest-pinned release, not complete regex identity, arbitrary pure-R
package support, or comprehensive GNU R compatibility.

## Profile 0.345 brew package-depth evidence

Profile 0.345 adds no semantic claim, so checked-in differential totals remain 1094 flat cases and
45 recursive Oracle v2 graphs. Instead, unchanged `brew 1.0-10` passes generic install/load/attach,
complete export/help coverage, both installed examples, and an independent scenario whose inline
template output and non-executing parser representation match the available GNU R 4.6.0 advisor.

The retained test first stops at unavailable suggested package `testthat`, so the result is P5 and
not P6/P7. `shape 1.4.6.1` replaces brew as the deliberately unevaluated P0 holdout. Pinned GNU R
4.6.1 remains the normative target, and neither package result proves arbitrary pure-R package or
comprehensive GNU R compatibility.

## Profile 0.346 shape-driven graphics and binding compatibility

Profile 0.346 raises checked-in evidence to 1098 flat cases and 48 recursive Oracle v2 graphs. New
contracts cover configured and internal browser graphics-device opening, arrow formals, visibility
and validation, positive plot aspect-ratio window expansion, and `rbind()`/`cbind()` omission of
`NULL` inputs while preserving matrix identity and dimensions. The available GNU R 4.6.0 advisor
passes every recursive graph; pinned GNU R 4.6.1 remains normative.

Unchanged `shape 1.4.6.1` reaches P4 after generic graphics and bind closures. Its first ordered P5
blocker is the provenance-gated `datasets::volcano` object. Normal example/test warnings are
retained as step-level counts and do not fail otherwise successful execution. The result does not
claim complete graphics, Base R, pure-R package, or GNU R compatibility.

## Profile 0.347 indexed sort differential evidence

Profile 0.347 raises checked-in evidence to 1099 flat cases and 49 recursive Oracle v2 graphs. The
new exact graph compares `sort.default` formals, named indexed output, one-based source indices,
missing and NaN placement, false controls, and the indexed-partial-sort error boundary. The
available GNU R 4.6.0 advisor passes every recursive graph; pinned GNU R 4.6.1 remains normative.

The same generic closure carries unchanged `shape 1.4.6.1` through `filledellipse`, and correcting
the package-check plan's installed vignette `File` field makes its prebuilt vignette step pass.
Shape remains P4 because the earlier `datasets::volcano` provenance boundary still blocks complete
examples; this does not claim complete sorting, Base R, arbitrary-package, or GNU R compatibility.

## Profile 0.348 argument matching and covariance differential evidence

Profile 0.348 raises checked-in evidence to 1101 flat cases and 51 recursive Oracle v2 graphs. One
exact graph proves that an exact formal match shadows only that formal during later partial
matching, while partial duplicates and no-dots leftovers remain errors. A second graph compares
`cor` formals, Pearson correlation and covariance matrices for a numeric data frame, cross-input
matrix shape, dimnames, and evaluated defaults. The available GNU R 4.6.0 advisor passes every
recursive graph; pinned GNU R 4.6.1 remains normative.

Unchanged `corrplot 0.95` advances from untouched P0 to P4 and now stops first at `stats::hclust`.
Kendall/Spearman covariance methods, the clustering/distance/dendrogram closure, complete corrplot
examples, arbitrary-package support, and comprehensive GNU R compatibility remain unclaimed.

## Profile 0.349 clustering and coordinate-matrix differential evidence

Profile 0.349 raises checked-in evidence to 1103 flat cases and 53 recursive Oracle v2 graphs. One
new exact graph compares `which` formals, linear results, named coordinate matrices, and the
`useNames = FALSE` shape. The other compares finite euclidean distance values and metadata,
complete-linkage merge/heights/order/labels, a normalized recursive dendrogram observation, and leaf
order. The available GNU R 4.6.0 advisor passes every graph; pinned GNU R 4.6.1 remains normative.

All eight `hclust` linkage methods also have direct rounded-height integration evidence. The
source-blind corrplot probes cover AOE, FPC, default hierarchical clustering, and Ward D before the
full example reaches missing `graphics::symbols`. Missing-distance rescaling, broader dendrogram
methods, complete corrplot examples, arbitrary-package support, and comprehensive GNU R
compatibility remain unclaimed.

## Profile 0.350 multi-key ordering and symbol-rendering evidence

Profile 0.350 raises checked-in evidence to 1105 flat cases and 54 recursive Oracle v2 graphs. The
new exact graph compares `order` formals, multiple-key lexicographic results, per-key decreasing
flags, and all three missing-placement modes. The available GNU R 4.6.0 advisor passes every graph;
pinned GNU R 4.6.1 remains normative.

Integration evidence additionally checks GNU-shaped `graphics::symbols` formals, invisible return,
rectangle geometry, 32-vertex circle geometry, replay styles, and deterministic unsupported
boundaries. Because inch-scaled symbols and three shape families are not implemented, `symbols`
remains shape-level rather than behaviorally complete. The unchanged corrplot direct rendering path
passes and its full example advances to missing `stats::cutree`. Complete corrplot examples,
arbitrary-package support, and comprehensive GNU R compatibility remain unclaimed.

## Profile 0.351 cutree differential evidence

Profile 0.351 raises checked-in evidence to 1106 flat cases and 55 recursive Oracle v2 graphs. The
new exact graph compares `cutree` formals, scalar named memberships, repeated vector `k` columns,
height cuts, integer coercion, label propagation, custom merge topology, and `k` precedence over
`h`. The available GNU R 4.6.0 advisor passes every graph; pinned GNU R 4.6.1 remains normative.

The source-blind corrplot check now completes `example:corrMatOrder`. Its next failure is
`example:corrRect`: the current Jacobi eigenvectors span the correct eigenspaces but choose the
opposite signs from the GNU advisor for the leading mtcars correlation eigenvectors, rotating AOE
order by half a turn. Because the package's lower-triangle example depends on GNU's deterministic
orientation, this remains an explicit compatibility gap rather than being hidden as mathematical
sign equivalence. Complete corrplot examples, arbitrary-package support, and comprehensive GNU R
compatibility remain unclaimed.

## Profile 0.352 DSYEVR and fractional-length differential evidence

Profile 0.352 retains 1106 flat cases and raises checked-in recursive Oracle v2 evidence to 57
graphs. One new graph compares the exact signed FPC/AOE ordering derived from `eigen(cor(mtcars))`;
the other compares `seq()` at zero, subunit, and fractional `length.out` values. The available GNU R
4.6.0 advisor passes 57/57 graphs; pinned GNU R 4.6.1 remains normative.

The symmetric path is generated from permissively licensed LAPACK 3.12.1 through a clean-room,
source-reproducible build and has no GNU R or webR dependency. The unchanged corrplot package now
passes `example:corrRect`; its next source-blind failure is the remaining generic
`graphics::symbols` parameter surface in `example:corrplot`. Exact signs outside the recorded
contract, complete corrplot examples, arbitrary-package support, and comprehensive GNU R
compatibility remain unclaimed.

## Profile 0.353 Pearson-test and package-example evidence

Profile 0.353 retains 1106 flat cases and raises checked-in recursive Oracle v2 evidence to 58
graphs. The new graph compares Pearson `cor.test` formals, statistic, parameter, p-value, estimate,
confidence interval, alternatives, complete-pair handling, names, and class. The existing bind graph
also observes normalized data-frame dimensions, names, row names, and columns after `cbind` and
column-name replacement. The available GNU R 4.6.0 advisor passes 58/58 graphs; pinned GNU R 4.6.1
remains normative.

Package evidence now runs all installed corrplot example topics, including its significance-matrix
path, without package-specific runtime code. Corrplot advances to P5 and stops first at its test
entry point because suggested dependency `testthat` is unavailable. Rank correlation tests, exact
`data.name` expression identity, corrplot's dependency-complete tests, arbitrary-package support,
and comprehensive GNU R compatibility remain unclaimed.

## Profile 0.354 model and insight evidence

Profile 0.354 raises checked-in flat evidence to 1108 cases and recursive Oracle v2 evidence to 62
graphs. New graphs compare RNG seed visibility/restoration, NULL head/tail and missing-string grep,
model formula/terms/labels/all-vars/deparse/predict/deviance behavior, quasi families and grouped
binomial fitting, the `anscombe` dataset, and `cbind.data.frame`. The available GNU R 4.6.0 advisor
passes 62/62 graphs; GNU R 4.6.1 remains the release gate.

Every applicable installed `insight 1.5.2` example now passes unchanged. The retained test driver
stops at unavailable suggested dependency `testthat`, so P6/P7 and arbitrary-package compatibility
remain unclaimed.

## Profile 0.359 exact optimizer and GPArotation evidence

Profile 0.359 contains 1115 checked-in flat cases and 66 recursive Oracle v2 graphs. Exact black-box
evidence now covers L-BFGS-B-backed two-factor `factanal()` results and evaluation counts, public
`stats::varimax()` structure and numerics, and implicit single-column `matrix()` behavior. The
recursive ability graph is strengthened in place so structural comparisons continue to cover nested
classes, dimensions, names, values, and attributes rather than only flat scalars.

The unchanged GPArotation 2026.8-1 artifact passes its complete applicable package-check surface at
P7. This demonstrates reusable closure across the semantics its pinned package exercises; it does
not demonstrate all GNU R semantics, arbitrary pure-R packages, optional dependency ecosystems, or
native-package compatibility. GNU R 4.6.1 remains the normative release gate.

## Profile 0.360 tibble/Date and palmerpenguins evidence

Profile 0.360 contains 1117 checked-in flat cases and 66 recursive Oracle v2 graphs. New executable
evidence covers generic `tibble::as_tibble` conversion/name repair and Base `as.character.Date`
civil text, non-finites and formals. The existing Date/POSIXct recursive graph now also compares
Date construction, character conversion, names and attribute order. The available GNU R 4.6.0
advisor passes 66/66 as a non-normative black-box check; GNU R 4.6.1 remains normative.

The unchanged pinned `palmerpenguins 0.1.1` artifact reaches P7 after both its generic applicable
package-check surface and an independently authored LazyData scenario pass. The latter compares
dimensions, names, classes, factors, missing counts, selected records and Date strings. This is
evidence for one artifact and the semantics it exercises, not comprehensive GNU R or arbitrary
pure-R package compatibility.

## Profile 0.361 S3 groups, general eigen and polynom evidence

Profile 0.361 contains 1120 checked-in flat cases and 68 recursive Oracle v2 graphs. Exact recursive
black-box comparison covers S3 `Math`, `Ops`, and `Summary` context variables, binary `.Method`,
method-local argument changes across `NextMethod()`, callable operators, list distinctness, and a
four-by-four non-symmetric eigensystem residual. The available GNU R 4.6.0 advisor passes 68/68; GNU
R 4.6.1 remains normative.

The unchanged pinned `polynom 1.4-1` artifact reaches P7 after its complete applicable package-check
surface and a separately authored polynomial scenario pass. The supporting `stats::deriv` binding is
a generic, not a symbolic default implementation; `stats::poly` is single-variable; and the general
eigensolver evidence does not imply arbitrary ill-conditioned LAPACK parity. The result is therefore
one more package-depth data point, not comprehensive GNU R or arbitrary pure-R package
compatibility.

## Profile 0.365 evidence

Executable flat and recursive evidence now covers option-inherited parse data, list-valued
`parse(text=)` input, GNU nonterminal parse tokens, and one-dimensional `apply()` simplification.
The `lambda.r` P4 ledger separately records the unresolved `eval` frame-environment reflection gap.

## Profile 0.366 evidence

Checked-in flat conformance passes 1130/1130 cases and recursive Oracle v2 passes 76/76 graphs with
the available non-normative GNU R 4.6.0 advisor. New evidence covers target-environment `eval()`
frames and bindings, formal-versus-expression ellipsis parse tokens, missing names through
replacement and `list2env()`, and `lm()`/`model.frame()` behavior under `na.action = na.fail`.

The unchanged pinned `lambda.r 1.2.4` artifact passes its complete applicable generic package-check
surface and an independent GNU-matched usage scenario, so its ledger entry advances to P7 with no
current blocker. GNU R 4.6.1 remains the normative gate, and neither the evidence counts nor this
single package result imply comprehensive GNU R or arbitrary pure-R package compatibility.

## Profile 0.367 evidence

New flat and recursive black-box cases cover recursive `utils::modifyList()` behavior, exact
Box-Muller values and uniform-stream positions, `qr()` forwarding of a `LAPACK` request, and the
`solve.qr` S3 method contract. The available GNU R 4.6.0 advisor remains non-normative; GNU R 4.6.1
is the release gate.

The unchanged pinned `SQUAREM 2026.1` artifact and pure-R `setRNG` example dependency pass the
complete applicable generic package-check plan, including retained tests, plus an independent
two-dimensional fixed-point scenario. This is P7 evidence for one artifact, not proof of arbitrary
pure-R packages, exhaustive numerical parity, or LAPACK pivot identity.

## Profile 0.368 evidence

Flat and recursive black-box cases now distinguish empty and whitespace-only numeric text, character
decimal/exponent conversion, character `NaN`, genuinely invalid text, and infinite integer inputs.
The checked-in flat suite passes 1132/1132 and recursive Oracle v2 passes 78/78 with the available
non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

The frozen unchanged `snow 0.4-4` archive passes its complete applicable package-check plan and an
independent custom in-memory transport scenario matching GNU R. This demonstrates browser-admissible
pure-R orchestration and S3 transport reuse, not native process, MPI, network, or arbitrary-package
compatibility.

## Profile 0.369 evidence

New flat and recursive black-box cases cover visible-state propagation from an invisible S3 method
through direct `UseMethod()` dispatch and a `NextMethod()` chain, plus visible-state replacement by
a later enclosing expression. The public API integration suite repeats the package-independent
contract. Checked-in flat conformance passes 1133/1133 cases and recursive Oracle v2 passes 79/79
graphs with the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

The frozen unchanged `futile.options 1.0.1` archive passes its applicable generic package-check plan
and a separately authored OptionsManager scenario matching GNU R state and visibility. This is
artifact-scoped evidence, not proof of exhaustive S3 semantics, arbitrary pure-R package support, or
comprehensive GNU R compatibility.

## Profile 0.370 evidence

New flat black-box cases cover exact character condition coercion, numeric versus lexical grouping
order with `NaN`, registered-environment labels, and eager/empty-name `tryCatch()` handlers. One
recursive graph observes the grouping, environment, and handler contracts together. Checked-in flat
conformance passes 1137/1137 and recursive Oracle v2 passes 81/81 with the available non-normative
GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

The frozen unchanged `futile.logger 1.4.9` archive passes every applicable generic package-check
step and a separately authored logger hierarchy scenario. Source SHA-256 is
`496bedbe2e52d06db22a4d659b8e7dd9ad0f1d1f95ead459ec02d05d0ac2b3d6`; deterministic artifact SHA-256
is `d021ece3671228382bd30cb9cb08392c2ca08794aa9f3d5e8c817f128f724bbc`. This is artifact-scoped
evidence, not proof of arbitrary pure-R package or comprehensive GNU R compatibility.

## Profile 0.391 evidence

The `grid::makeContent` and `grid::makeContext` lifecycle generics now match the GNU-observed
single-argument formals, visible identity defaults, S3 method lookup, object mutation/return
behavior, and multi-class `NextMethod()` traversal. The exact recursive graph includes both default
and custom-method structures and is paired with flat and integration evidence. The available
advisory GNU R 4.6.0 comparison passes 157/157 recursive graphs; GNU R 4.6.1 remains the release
gate.

This shared seam allows unchanged `gridGraphics 0.5-1` to load, attach, register its
`makeContent.echogrob` method, and pass documentation and installed examples at P5. The next
evidence-selected blocker is `grDevices::pdf.options` in a retained package test. This is not a P6
or P7 claim and does not establish complete grid rendering or arbitrary-package compatibility.

## Profile 0.390 contour topology evidence

`grDevices::contourLines()` now has executable behavioral coverage for matrix and packed-list
inputs, ordered/duplicate levels, GNU-observed equality perturbation, open and closed polylines,
saddle disambiguation, non-finite cells, coordinate validation, callable formals, and the bounded
`max.contour.segments` option. It is a numeric extraction contract and does not depend on a device
or claim rendering equivalence. Flat conformance is 1281/1281 and exact recursive Oracle v2 is
156/156 on the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

The unchanged `gridGraphics 0.5-1` source continues at P1. Its next first namespace blocker is the
generic `grid::makeContent` lifecycle contract, not `contourLines`; later package behavior remains
unproven.

## Profile 0.374 evidence

Twenty-four new flat cases and twenty-one recursive graphs cover the package-neutral contracts
selected during the `pracma` run, including optimization, spline and callable interpolation,
probability, complex and QR/Cholesky linear algebra, matrix-valued model terms, array/vector Ops,
and pi-scaled trigonometry. Checked-in flat conformance passes 1183/1183 and recursive Oracle v2
passes 115/115 with the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release
gate.

The unchanged `pracma 2.4.6` archive passes every applicable generic package-check step plus an
independently authored numerical scenario. Declared unavailable Suggests paths are not-applicable.
Source SHA-256 is `1857b831ec7da6eb651574ccdb12e1baef4c7150cbdc6380cf9fd70e60ae4552`; deterministic
artifact SHA-256 is `f11a2d3b9f5ccb9dd0afa01fe183f12fa736f5b12b9fd818b20166486b1bef79`. This is
artifact-scoped evidence, not proof of arbitrary pure-R package or comprehensive GNU R
compatibility.

## Profile 0.375 evidence

Seven new flat cases and seven recursive graphs cover the package-neutral contracts selected by the
source-blind `boot` rotation: noninteractive `graphics::identify`, one-argument `seq`,
`lm.influence`, data-frame expansion and automatic row-name storage, vectorized `xor` and warning
metadata, two-vector `var`, and non-matrix `as.matrix.default` attribute/dimname rebuilding.
Checked-in flat conformance passes 1190/1190 and recursive Oracle v2 passes 122/122 with the
available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

The unchanged `boot 1.3-32` archive reaches regression P4 through the generic source-package path.
Representative `boot` and `boot.ci` examples plus fourteen applicable example topics execute. Source
SHA-256 is `3a05aced6fea42a5c310c5c6ab7a2019f69f757f5e77c4961183977747136c97`; deterministic
artifact SHA-256 is `8a5c4b9b152184ac07c786ab4292f991558d92415fabda8e07ed666daaee012f`. P5 remains
blocked at `example:control` by the missing shared `stats::smooth.spline` contract. This is
artifact-scoped evidence, not proof of arbitrary pure-R package or comprehensive GNU R
compatibility.

## Profile 0.376 evidence

Four new flat cases and four recursive graphs cover package-neutral `stats::smooth.spline` and
`predict.smooth.spline`; `stats::qqnorm` and `stats::qqplot`; `stats::glm.control`; and explicit
missing-package behavior in `utils::data`. The evidence includes explicit effective degrees of
freedom, fitted values, leverage, prediction, quantile coordinates and missing positions, control
storage/defaults, diagnostics, classes, and exact public formals. Checked-in flat conformance passes
1194/1194 and recursive Oracle v2 passes 126/126 with the available non-normative GNU R 4.6.0
advisor; GNU R 4.6.1 remains the release gate.

## Profile 0.398 prototype and logLik evidence

Flat and recursive black-box cases exercise `methods::prototype` as input to `setClass`/`new`, its
class/S4 marker and public formals, plus `stats::logLik` S3 method dispatch and formals. The
implementation is package-neutral and unblocks unchanged S4 package namespace loading; full
`classPrototypeDef` introspection, the complete `stats4` callable surface, and comprehensive S4
compatibility remain unclaimed.

The unchanged `boot 1.3-32` artifact remains regression P4 while nineteen applicable example topics
now execute. Examples requiring unavailable declared Suggests packages `MASS` or `survival` are
classified not applicable rather than passed. The ordered P5 blocker is now `example:saddle`, which
reaches the missing shared `stats::dnorm` primitive; `example:smooth.f` independently reaches the
same reusable gap. This is artifact-scoped evidence, not proof of arbitrary pure-R package or
comprehensive GNU R compatibility.

## Profile 0.377 evidence

One new flat case and one recursive graph cover package-neutral `stats::dnorm`: ordinary and log
density, recycling, NA/NaN distinction, zero/negative/infinite scales, attributes, formals, and the
structured domain warning call. Checked-in flat conformance passes 1195/1195 and recursive Oracle v2
passes 127/127 with the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release
gate.

The unchanged `boot 1.3-32` artifact remains regression P4 while twenty-one applicable example
topics now execute; both `saddle` and `smooth.f` pass through the shared density primitive. The next
ordered blocker is `example:tsboot`, which requests the missing provenance-gated `datasets::lynx`
object. Dataset admission must satisfy the clean-room provenance policy and cannot be replaced by a
package-specific value. P5 and comprehensive package compatibility remain unclaimed.

## Profile 0.378 evidence

One new flat case and one recursive graph cover independently sourced `datasets::lynx`: namespace
and search identity, double `ts` shape, observable attribute order, the complete 114-value sequence,
time coordinates, and aggregates. Checked-in flat conformance passes 1196/1196 cases; recursive
Oracle v2 passes 128/128 graphs with the available non-normative GNU R 4.6.0 advisor. GNU R 4.6.1
remains the normative release gate.

The unchanged `boot 1.3-32` artifact remains regression P4 with twenty-one complete applicable
example topics. `example:tsboot` now loads `datasets::lynx` through the generic core-package path
and continues to the missing shared `stats::ar` contract, which is the ordered P5 blocker. This is
artifact-scoped progress, not a P5 or arbitrary-package claim.

## Profile 0.379 evidence

Two new flat cases and two recursive graphs cover univariate Yule-Walker `stats::ar` and
`stats::rgeom`. The autoregression evidence includes fixed/AIC order selection, coefficients,
partial autocorrelations, corrected prediction variance, residual values and time coordinates,
asymptotic covariance, result shape, and formals. Geometric-random evidence covers integer shape,
support and mean invariants, degenerate and invalid probabilities, missingness, structured warnings,
and formals. Checked-in flat conformance passes 1198/1198 cases and recursive Oracle v2 passes
130/130 graphs with the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains normative.

The unchanged `boot 1.3-32` artifact remains regression P4 with twenty-one complete applicable
example topics. `example:tsboot` advances through Lynx data, autoregressive fitting, and geometric
block-length generation, then reaches the missing shared `stats::arima.sim` contract. P5 and
arbitrary-package compatibility remain unclaimed.

## Profile 0.380 evidence

One new flat case and one recursive graph cover package-neutral stationary univariate
`stats::arima.sim`: explicit AR, MA, and mixed innovations, burn-in, a caller-supplied R generator
with forwarded arguments, time-series shape, and public formals. Checked-in flat conformance passes
1199/1199 cases. Recursive Oracle v2 passes 131/131 graphs with the available non-normative GNU R
4.6.0 advisor; GNU R 4.6.1 remains the normative release gate.

The unchanged `boot 1.3-32` artifact now passes the complete applicable generic package-check plan,
including every applicable installed Rd example. It advances to regression P5. Its retained
`parallel-censboot.R` package test requires the unavailable suggested `survival` dependency, so it
does not gain P6 merely because that script is classified not applicable. This is artifact-scoped
evidence and does not imply arbitrary-package compatibility.

## Profile 0.381 evidence

Two new flat cases and two recursive graphs cover `methods::formalArgs` plus vectorized
`stats::runif`. Reflection evidence covers closures, character names, primitives, zero-formal
functions, namespace identity, callable type, and formals. Uniform evidence covers vector bounds,
`n` length rules, fixed-seed values, zero-width RNG preservation, missing/non-finite/reversed/empty
bound behavior, and formals. Checked-in flat conformance passes 1201/1201 cases. Recursive Oracle v2
passes 133/133 graphs with the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the
normative release gate.

The metadata-frozen unchanged `DEoptimR 1.2-0` artifact passes the complete applicable generic
package-check plan: three help/example topics and all three retained stochastic optimizer tests. The
evidence run uses an explicit finite 100,000,000-step override without changing runtime defaults. An
independently authored fixed-seed quadratic optimizer scenario matches GNU R result values and
structure, advancing the pinned artifact to P7. This does not imply arbitrary-package compatibility.

## Profile 0.371 evidence

New flat and recursive black-box cases cover omitted-choice `match.arg()`, dynamic system-parent
frames, option-list queries, virtual-file and text-connection parsing, explicit missing factor
levels, table conversion, PCRE replacement case controls, `women` and `cars` data shape/values,
`errorCondition()`, supplied condition identity, and handler/restart behavior for vector-recycling
warnings. Checked-in flat conformance passes 1149/1149 and recursive Oracle v2 passes 92/92 with the
available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

The frozen unchanged `tinytest 1.4.3` archive passes every applicable generic package-check step,
including its retained 159-test self-test. Source SHA-256 is
`ecc3a398690e72ca70127c1177e1f78b602dc5062f1597b897255bcc33c38375`; deterministic artifact SHA-256
is `9ec3cb4437f8d96b05e8b69d092b20bbd23758ab653eaf99940387f09d43e0a2`. This is artifact-scoped
evidence, not proof of arbitrary pure-R package or comprehensive GNU R compatibility.

## Profile 0.372 evidence

Six new flat cases and one recursive graph cover nested update/getCall frames, startup-message
suppression and restart invocation, cumulative table semantics, factor-response formula plotting,
vector/list `unsplit()`, and two-sample formula t-tests. The earlier profile work also adds flat
evidence for exact `getElement()`, `as.list(symbol)`, and `lfactorial()`. Checked-in flat
conformance passes 1158/1158 and recursive Oracle v2 passes 93/93 with the available non-normative
GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

The frozen unchanged `permute 0.9-10` archive passes every applicable generic package-check step.
Its declared-Suggests `testthat` launcher is classified not-applicable, not passed. Source SHA-256
is `dc182b20d2f0dcafbe0384640b949b9d70faee4cbd20bf88ab55de811b105104`; deterministic artifact
SHA-256 is `a24290e5e4172d2fb193a4fb41d6cfdd48a852823447bd0a52af0f752191191d`. This is
artifact-scoped evidence, not proof of arbitrary pure-R package or comprehensive GNU R
compatibility.

## Profile 0.373 evidence

One new flat case and one recursive graph cover browser-safe null external-pointer type, length,
class, attributes, identity, and XDR round-trip semantics. Unit tests separately cover protected/tag
fields, attributed fixtures, reference identity, workspace decoding, public-boundary rejection, and
the distinction between reviewed package-resource input and ordinary user serialization limits.
Checked-in flat conformance passes 1159/1159 and recursive Oracle v2 passes 94/94 with the available
non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

The frozen unchanged `bigD 0.3.1` archive passes every applicable generic package-check step. Its
declared-Suggests `testthat` launcher and absent vignette surface are classified not-applicable, not
passed. An independent scenario matches UTC and localized date formatting, regional first weekdays,
locale tables, and the serialized null external-pointer shape. Source SHA-256 is
`86b1b0cf1849f6b1418c3178ab5d7b04682652375c6e90ebac636921de6088d1`; deterministic artifact SHA-256
is `e0d2dbed46a7a681989507648a07a1069951970c594a3bfdf4a95f7b42553cda`. This is artifact-scoped
evidence, not proof of arbitrary pure-R package or comprehensive GNU R compatibility.

## Profile 0.392 PDF option evidence

Black-box observations cover the ordered 21-value `grDevices::pdf.options` default list,
zero-argument visibility, invisible previous-state returns, reset-before-update behavior, exact
transactional names, same-mode/same-length warnings, and the special `fonts` shape. Executable
NativR evidence also proves that omitted `pdf()` arguments consume session defaults and explicit
arguments override them without changing option state. GNU R 4.6.1 remains normative; local GNU R
4.6.0 results are advisory. Checked-in flat conformance passes 1284/1284 and recursive Oracle v2
passes 158/158 against that available advisor.

## Profile 0.393 package-test and viewport evidence

Executable evidence covers recursive copying of package-test resources into a writable isolated
browser-memory directory, relative input and generated output, and preservation of the immutable
installed test tree. GNU black-box observations and differential cases cover viewport justification
normalization, retained tree navigation, `vpPath` structure and classes, navigation visibility and
depths, public formals, and top-level errors. Checked-in flat conformance passes 1285/1285 and
recursive Oracle v2 passes 159/159 against the available non-normative GNU R 4.6.0 advisor. GNU R
4.6.1 remains the release gate.

## Profile 0.394 recorded-operation evidence

Black-box and recursive evidence covers the nested native-symbol name carrier, operation ordering,
descriptor lengths, and named `C_box` arguments for `C_plot_new`, `C_plot_window`, and `C_box`. Flat
conformance passes 1286/1286 and Oracle v2 passes 160/160 against the available GNU R 4.6.0 advisor.
GNU R 4.6.1 remains normative.

## Profile 0.395 grid drawing evidence

Black-box evidence covers polygon, segment, line, and point grob classes, ordered fields, default
units, vpPath conversion, gpar retention, public formals, draw visibility, and invalid polygon
grouping. Recorded-operation evidence now includes `C_segments`, `C_plotXY`, `C_text`, and
`C_polygon`. Flat conformance passes 1287/1287 and exact Oracle v2 passes 161/161 against the
available GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

## Profile 0.396 boxplot display-list evidence

Black-box evidence now covers the ordered primitive operation provenance produced by recording an
axes-suppressed two-group boxplot, including its fill, median, placeholder point, whisker, staple,
outline, and outlier sequence. NativR's filtered operation names exactly match the available
non-normative GNU R 4.6.0 advisor, and replay tests verify that no composite boxplot command remains
in the recorded stream. Flat conformance passes 1288/1288 and exact Oracle v2 passes 162/162; GNU R
4.6.1 remains the normative release gate.

## Profile 0.397 pairs evidence

Exact black-box evidence covers the `pairs` generic's `x, ...` formals plus the default numeric
matrix path's invisible `NULL` result and one-column rejection. Integration evidence separately
checks the browser event sequence, panel point count, diagonal labels, title, style recycling, and
unchanged lazy S3 dispatch. The callable remains shape-level: the evidence does not claim exact GNU
panel geometry, axes, formula handling, logarithmic transforms, or arbitrary panel callbacks.
Recursive Oracle v2 advances to 163 exact graphs against the available non-normative GNU R 4.6.0
advisor; GNU R 4.6.1 remains the release gate.

## Profile 0.399 call, model-frame, and S4 evidence

New flat and recursive black-box cases cover call-object `$` exact/partial extraction, exact
replacement, append, deletion, attribute retention, and ambiguous-partial behavior; model-frame
integer, logical data-mask, negative, and character subsets with duplicate row-name repair; and
top-level `setMethod(where=)` generic promotion plus `methods::extends()` lineage and formals. The
available GNU R 4.6.0 installation is advisory only. GNU R 4.6.1 remains the normative release
oracle and must reproduce these cases before a release compatibility claim. Current generated
evidence contains 1,292 flat cases and 167 exact recursive graphs, with 415 recursively evidenced
bindings. The generated name inventory reports 1,027 overlaps out of 2,522 GNU R callable names;
that overlap is not behavioral evidence.

## Profile 0.400 callable model extensions and direct fitting evidence

New flat, recursive Oracle v2, and integration cases cover callable `contrasts.arg` invocation,
default argument observation, generated-matrix metadata, deterministic complement columns,
singular-matrix rejection, and single-/multiple-response `stats::lm.fit()` result structure and
formals. The unchanged modeltools package now passes every installed example and reaches its first
retained-test failure. GNU R 4.6.0 remains only the available advisory oracle; GNU R 4.6.1 remains
the normative release gate.

The generated Profile 0.400 ledger contains 1,294 checked-in flat cases, 169 recursive graphs, and
416 recursively evidenced bindings. It inventories 1,114 registered bindings and 1,028 overlaps with
2,522 GNU R callable names; those counts do not substitute for behavioral evidence.

## Profile 0.401 evidence

New differential cases cover nested list-to-data-frame expansion, existing-model-frame row
preservation, terms-driven intercept mutation, ignored model-matrix extension arguments, S4 NA
dispatch, and ordinary-function fallback after `setGeneric`. The resulting ledger contains 1,297
flat cases and 170 exact recursive graphs covering 418 bindings. GNU R 4.6.0 remains advisory in
this environment; the required normative release gate remains GNU R 4.6.1.

## Profile 0.402 evidence

Flat and recursive black-box cases now cover central chi-square and F quantiles across ordinary and
log probabilities, lower and upper tails, recycling, attributes, formals, finite/infinite
boundaries, invalid inputs, and deterministic non-central rejection. The ledger contains 1,298 flat
cases and 171 recursive graphs covering 420 bindings. The local GNU R 4.6.0 oracle remains advisory;
GNU R 4.6.1 remains the normative release gate.

## Profile 0.403 evidence

Flat and recursive black-box cases now cover completion matching, exact-before-fuzzy fallback,
input-name retention, backtick quoting, missing and coercible controls, ordered session settings,
invalid-update preservation, Reference Class root initialization, same-name superclass traversal,
nested `callSuper()` discovery, and the absence of a public instance binding. The ledger contains
1,300 flat cases and 173 recursive graphs covering 423 bindings. Local GNU R 4.6.0 results remain
advisory; GNU R 4.6.1 remains the normative release gate.

## Profile 0.404 evidence

Flat and recursive cases cover language/call and expression-vector inputs to `mapply()`, including
call-entry tags, lengths, element extraction, expression preservation, and non-symbol call-head
character rendering. The ledger contains 1,301 flat cases and 174 exact recursive graphs covering
424 bindings. All 174 graphs pass locally against advisory GNU R 4.6.0; GNU R 4.6.1 remains the
normative release gate and was not available in this environment.

## Profile 0.408 wide-SVD evidence

New flat, integration, and recursive cases cover a wide real matrix whose smaller `XX'` Gram path
returns GNU-compatible singular values, requested 2-by-2 and complete 3-by-3 singular-vector
dimensions, reconstruction, and orthogonality. The independent corpcor scenario was captured from
the public package API with the available GNU R 4.6.0 black box and matches NativR across all 29
exports. No GNU R or package implementation was copied into production.

The generated ledger contains 1,305 checked-in flat cases and 178 exact recursive graphs covering
428 bindings; all 178 recursive cases pass against the local advisory GNU R 4.6.0 installation. GNU
R 4.6.1 remains the normative release gate, and the current name overlap remains inventory rather
than compatibility evidence.

## Profile 0.409 grouped-replacement and vipor evidence

New flat and integration cases cover callable `split<-` formals, S3 dispatch, atomic/list/data-frame
group replacement, names and row names, missing grouping entries, empty input, and replacement
errors. A new exact recursive graph covers the same representative replacement structure. Additional
flat and integration evidence compares GNU admission and rejection of `plot.default(las=)`, while a
recursive graph verifies `stats::ave` namespace identity, formals, and grouped results. Runtime unit
evidence covers standard ASCII native-encoding aliases and invalid high bytes; unchanged vipor
package data supplies the external version-3 ANSI_X3.4-1968 artifact.

The independent vipor scenario was captured from the public package API with GNU R 4.6.0 and calls
all 13 exports without inspecting implementation internals for production work. The generated ledger
contains 1,307 checked-in flat cases and 180 exact recursive graphs covering 430 bindings; all 180
graphs pass against the local advisory GNU R 4.6.0 installation. GNU R 4.6.1 remains the normative
release gate. API-name overlap and the scoped vipor P7 result remain evidence inputs, not claims of
comprehensive compatibility.

## Profile 0.410 differential evidence

GNU R black-box observations now pin one-dimensional array/table sort metadata, scalar and empty
dimension dropping, empty-name retention, deparse-level-one table axis labels, object-sort control
handling, and `charmatch()` matching, coercion, ambiguity, `nomatch`, and formal structure. The flat
suite contains 1,309 checked-in cases. Oracle v2 contains 182 exact recursive graphs covering 432
bindings, and all 182 pass against the locally available advisory GNU R 4.6.0 installation.

The unchanged dynamicTreeCut 1.63-1 public surface and package-check evidence reaches scoped P7 and
matches the same advisory oracle in its independent scenario. These results are not a substitute for
the normative GNU R 4.6.1 release gate and do not establish comprehensive Base R or arbitrary pure-R
package compatibility.

## Profile 0.411 differential evidence

GNU R black-box observations now pin the unusual target-aware `setAs()` contract, including a usable
`to` value with `missing(to) == TRUE`; inherited parent-object S4 initialization; `slot()` and
`slot<-` values and formals; and exact aspect-adjusted `image.default()` window limits. The flat
suite contains 1,312 checked-in cases. Oracle v2 contains 184 exact recursive graphs covering 437
bindings, and all 184 pass against the locally available advisory GNU R 4.6.0 installation.

The unchanged pixmap 0.4-14 artifact reaches scoped P7 through the generic pipeline and an
independent GNU-matched image-object scenario. Its GNU R 4.5 startup/platform/timing transcript is
host-bound and explicitly not applicable, but both underlying retained tests pass. These results do
not replace the normative GNU R 4.6.1 gate or establish comprehensive S4, graphics, Base R, or
arbitrary-package compatibility.

## Profile 0.412 package differential evidence

The unchanged moments 0.14.1 artifact and its independently authored all-export scenario match the
available GNU R 4.6.0 black box across raw/central moments, cumulants, reconstruction,
vector/matrix/data-frame summaries, and four `htest` objects. Numeric evidence is compared at nine
decimal places; the largest observed high-order floating tail difference is approximately `4e-12`
absolute and `3e-16` relative. Object classes, names, alternatives, methods, and captured data names
match exactly.

No runtime semantic claim is added, so flat and recursive counts remain 1,312 and 184 respectively,
with 437 recursively evidenced bindings. This package-only evidence increment does not substitute
for the GNU R 4.6.1 normative gate or prove broad package, statistical, or Base R completion.

## Profile 0.413 array-apply differential evidence

The GNU R black box establishes higher-dimensional `apply()` ordering and shape for scalar margin 3,
combined margins 1 and 3, all dimensions, named multi-value results, identity slices, and 3-by-3
matrix slices. One flat case and one exact recursive Oracle v2 graph encode those observations. The
same reusable implementation removes unchanged RSpincalc 1.0.2's first blocker and its independent
conversion/quaternion/rotation scenario matches GNU R 4.6.0 values. Oracle v2 now covers 438
recursively evidenced bindings.

GNU R 4.6.1 remains the normative release gate. This increment does not claim every `apply()` edge
case, arbitrary pure-R package compatibility, or native-package support.

## Profile 0.414 loess-prediction differential evidence

A synthetic serialized `loess` object isolates S3 dispatch and direct local-polynomial prediction
without requiring a loess fitting implementation. GNU R and NativR agree after ten-decimal rounding
for normalized two-predictor quadratic evaluation at three new points; the flat case also records a
strict numeric tolerance. Unchanged dichromat 2.0-1 then matches selected GNU deutan, protan, and
tritan color transformations exactly while executing every installed example.

The evidence does not claim `loess()` fitting, exact kd-tree interpolate-surface evaluation,
`se=TRUE`, or all predict.loess inputs. GNU R 4.6.1 remains the normative release gate.

## Profile 0.415 numeric-comparison and methods evidence

Direct `all.equal.numeric` evidence covers near-equality, relative differences, positional
tolerance, attribute suppression, formals, and the non-obvious `countEQ` automatic-scale rule.
Methods evidence registers a fresh generic, distinguishes absent and built-in generics, returns its
generic name, and checks formals. GNU R and NativR agree exactly across both recursive object
graphs.

Those generic semantics remove unchanged RUnit 0.4.33.1's ordered example blockers. Its 19-export
independent scenario matches successful checks, expected condition classes/messages, and tracker
surface. This remains artifact-scoped evidence; GNU R 4.6.1 remains the normative release gate.

## Profile 0.416 distribution-density evidence

Exponential-density evidence covers ordinary and logarithmic output, zero and invalid rates,
infinities, NA/NaN, recycling, longest-input attributes, warning calls, formals, and GNU's observed
negative zero. Central Student-t evidence covers finite and infinite degrees of freedom, invalid
domains, logarithmic tails, recycling, attributes, warning calls, and formals. GNU R and NativR
agree exactly across both recursive graphs against the available 4.6.0 advisor.

Those shared semantics remove unchanged ica 1.0-3's ordered namespace blockers. Its independent
scenario exercises all exports, ACY identity error, and public dispatch into a complete
one-component FastICA result. Non-central Student-t density and broader ICA behavior remain outside
this increment; GNU R 4.6.1 remains the normative release gate.

## Profile 0.417 environment traversal and S3 call-syntax evidence

Environment display evidence covers custom-class, global, base, empty, and substituted environment
references plus exact `deparse`/`deparse1` formals. `eapply()` evidence covers hidden names,
non-hashed reverse insertion order, parent exclusion, named empty lists, function-name resolution,
dots forwarding, delayed promises, active bindings, and exact formals. S3 evidence records the
original `.super` and symbol index syntax observed through `substitute()` and the synthetic `*tmp*`
replacement target.

Those package-neutral contracts remove unchanged proto 1.0.0's ordered example blockers. Its
independent scenario exercises prototype inheritance, receiver injection, mutation, method
overrides, parent identity, and list conversion. This remains artifact-scoped evidence; complete
environment hashing internals, arbitrary object systems, and comprehensive GNU R compatibility are
not claimed. GNU R 4.6.1 remains the normative release gate.

## Profile 0.418 package-call, date/time, DCF, and sequence evidence

Recursive graphs record actual `nargs()` counts through direct, nested, primitive, and `eval()`
calls; method-visible calls and exact formals for `merge()`, `subset()`, and `as.Date()`; explicit
ISO date success and failure; fractional seconds and numeric time-zone offsets; DCF output,
visibility, and file round trips; and character endpoint sequence values and storage. The resulting
200 Oracle v2 graphs cover 457 explicitly associated bindings, while 1,328 checked-in flat cases
remain the broader regression surface.

The unchanged NLP 0.3-3 source package passes every applicable generic check and an independently
authored GNU R-matched scenario spanning annotations, string tokens, merged features, S3
merge/subset calls, ISO dates, and date-times. These are scoped contracts against the available GNU
R 4.6.0 advisor; GNU R 4.6.1 remains the normative release gate.

## Profile 0.419 time-series and package-closure evidence

Three new flat cases and three exact/numeric recursive graphs cover S4 vector preservation and
fallback, statistical smoothing inputs and outputs, empty-product and filter defaults,
`datasets::AirPassengers`, `%j` parsing, and POSIX fixed/calendar sequences. The unchanged
timeSeries 4052.112 artifact passes all applicable installed metadata, namespace, attachment,
documentation, example, test-classification, and vignette checks. An independently authored
multivariate construction/arithmetic/returns scenario matches the GNU R 4.6.0 black-box advisor.

The evidence is pinned to the unchanged source and deterministic installed artifact and adds no
package identity branch. It does not claim full LOWESS/supsmu edge parity, every POSIX time zone,
arbitrary pure-R package compatibility, or comprehensive GNU R compatibility. GNU R 4.6.1 remains
the normative release gate.

## Profile 0.420 matrix, S4 generic, and bind evidence

Exact recursive graphs now cover `tail.matrix` row labels, `keepnums`, deprecated `addrownums`, and
formals; `na.contiguous.ts` attribute retention and ordering; first-method promotion and fallback
for `getDataPart` and `setDataPart`; formal atomic matrix data parts and slot order; S4 operator
fallback; and direct/base `cbind2` and `rbind2` dispatch with S4-before-S3 precedence and
matrix-backed S4-to-S3 resumption. Invalid probe syntax and invalid formal class definitions were
replaced with GNU-valid black-box constructions without weakening the semantic assertions.

The resulting 232 Oracle v2 graphs cover 496 explicitly associated behavioral or numeric bindings,
and the 1,360 checked-in flat cases pass. These results use the available GNU R 4.6.0 installation
as a non-normative advisor; GNU R 4.6.1 remains the release gate. The package corpus is unchanged at
96 artifacts, with 81 passing, 14 blocked, and unopened `pls` 2.9-0 at source-blind P0, so no broad
package or GNU R compatibility claim follows from this increment.

## Profile 0.426 formula-language and package evidence

Flat differentials cover symbol-preserving and first-element atomic `as.name`/`as.symbol` coercion
and compact spacing for selected arithmetic operators during deparse. A recursive Oracle v2 graph
records the same values, types, errors, and formals. Integration evidence additionally covers
`utils::apropos`, expression-vector replacement, and `stats::terms.formula` through both direct
calls and unchanged package execution.

Unchanged `formula.tools` 1.7.1 passes its complete applicable generic package-check plan and an
independently authored scenario covering every ordinary public export, formula conversion, and terms
dispatch. The 102-artifact corpus now has 87 passing, 14 blocked, one unopened holdout, and 48 P7
artifacts. This is scoped evidence against the available GNU R 4.6.0 black-box advisor; GNU R 4.6.1
remains the normative release gate, and arbitrary pure-R package or comprehensive GNU R
compatibility is not claimed.

## Profile 0.427 grid and gridBase evidence

Four new flat differentials cover current viewport transforms and extents, graphical-parameter
selection and inheritance, rectangle grob shape and formals, and `par(mfrow=)`/`par(mfg=)` layout
state. One exact recursive Oracle v2 graph records the nested matrix, unit, `gpar`, grob, list,
integer-layout, and formal structures. The graph passes against the available GNU R 4.6.0 black-box
advisor; GNU R 4.6.1 remains the normative gate.

Unchanged `gridBase` 0.4-7 passes all applicable generic package-check steps and a separately
authored all-export scenario. The corpus now has 103 artifacts, 88 passing, 14 blocked, and one
unopened holdout, with 49 at P7. Unopened `gsubfn` 0.7 is the next source-blind package gate. This
remains artifact-scoped evidence, not a claim of arbitrary pure-R package or comprehensive GNU R
compatibility.

## Profile 0.429 recursive package-driven evidence

Seven added flat contracts cover `BOD`, grouped `CO2`, multi-group data-frame aggregation, compound
formula adapters, all standard `matplot` types, conjugate-gradient `optim`, and atomic `rep()` count
coercion. Six new recursive graphs cover the behavioral or numeric portions; together the suite
contains 1,392 flat cases and 257 recursive graphs with 533 explicit binding associations. Focused
recursive graphs pass exactly against the available GNU R 4.6.0 black-box advisor; GNU R 4.6.1
remains normative.

Unchanged `gsubfn` 0.7 passes six installed example topics before `example:list` reaches an
unresolved `chron` Suggests dependency. That dependency boundary is recorded rather than hidden by a
package-specific runtime path or by misclassifying `month.day.year` as Base R.

## Profile 0.430 optional-dependency and inherited-lookup evidence

Two flat differentials and two exact recursive Oracle v2 graphs cover connection access selection
and mode-filtered inherited environment lookup. A prior list-valued `utils::combn` flat case is now
correctly excluded from the atomic Oracle v1 transport and represented by an exact recursive graph,
which also closes callback-result array dimensions. The inventory contains 1,394 flat cases, 1,337
live-R-eligible cases, and 260 recursive graphs with 536 distinct explicitly evidenced bindings. The
focused graphs pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains the normative gate.

Package lock format v2 records none/all/selected Suggests policy. An explicit unchanged `gsubfn`
plus `chron` resolution reaches and rejects the native `chron` artifact at the phase boundary, while
the default mandatory-only closure stays `proto` plus `gsubfn`. The unchanged `read.pattern` example
now passes, and a separate `strapply` combine-list path verifies inherited function-mode lookup. The
artifact remains P4 with `example:list` as its first blocker; no broader package or GNU R
compatibility claim follows.

Unopened `tinytable 0.18.0` is now the metadata-frozen P0 holdout. It is the highest-usage
executable candidate remaining after the documented browser-purpose and already-evaluated dependency
exclusions in the fixed 2026-07-27 through 2026-08-25 window. Only its official metadata,
440,097-byte archive length, source URL, and SHA-256
`83a69d454d2c9333cd4d54bb6c12bc6970d034545c17b260fe4a87e6be04324c` have been read. The corpus now
contains 104 releases: 88 passing, 15 blocked, one unevaluated, and 49 at P7.

## Profile 0.431 differential result

Two new flat cases and two exact recursive Oracle v2 graphs cover S4 `NULL` class-union slot
replacement/validity, atomic-data default slot initialization, and lazy `...names()` behavior. The
checked-in inventory is 1,397 flat cases, including 1,340 eligible for live comparison, and 262
recursive graphs with 539 distinct explicitly associated behavioral or numeric bindings. Focused
live and recursive comparisons pass against the available advisory GNU R 4.6.0; pinned GNU R 4.6.1
remains required for normative release evidence.

The unchanged `tinytable 0.18.0` artifact reaches regression P7 after those semantic fixes and a
generic package-check rule for unavailable dependencies declared in `Suggests` or `Enhances`.
Independent package behavior matches the advisory oracle; no GNU R implementation code or package
source modification is used. The corpus is 89 passing and 15 blocked out of 104, with 50 at P7 and
no current holdout.

## Profile 0.472 PostScript behavioral evidence

The existing `grDevices::postscript` flat case is strengthened from API-only boundary evidence to
behavioral device evidence. It compares exact public formals, invisible `NULL` opening, `postscript`
device identity, device number and dimensions, named close result, the `%!PS` signature, DSC
page/trailer markers, and nonempty output. The checked-in inventory remains 1,468 flat cases with
1,409 eligible for live comparison and 326 recursive graphs because the prior case was replaced
rather than duplicated. NativR emits its own genuine DSC PostScript Level 2 document from the owned
graphics journal; byte identity with GNU R is not claimed. The focused flat case passes against
advisory GNU R 4.6.0, while GNU R 4.6.1 remains normative.

## Profile 0.473 native line encoding

GNU R black-box probes establish that `readLines` accepts `native`, `native.enc`, and `nativeenc`,
returns the same text for those aliases, and marks native-decoded strings as `unknown`. NativR now
matches that observable contract while defining its browser-native byte encoding as UTF-8. One new
flat case and one exact recursive Oracle v2 graph carry the evidence; arbitrary platform code pages
remain outside the admitted browser profile.

## Profile 0.474 expression assertions

GNU R black-box probes establish block decomposition, first-failure short-circuiting, assignment
visibility, explicit expression-object evaluation, invisible success, singular/plural source
diagnostics, local isolation, and assertion-mode mutual exclusion for `stopifnot`. The new flat case
and exact recursive Oracle v2 graph reproduce that surface. This closes the reusable contract used
by unchanged sfsmisc examples without claiming completion of their later dependencies.

## Profile 0.475 tools error assertions

GNU R black-box probes establish `tools::assertError` formals, invisible one-element condition-list
results, class/message identity, no-error failure, and verbose message behavior. A new flat case and
exact recursive Oracle v2 graph reproduce the portable surface and carry unchanged sfsmisc past its
expected-error example.

## Profile 0.476 package-version metadata lists

Focused flat and exact recursive comparison confirm GNU R's narrow `package_version()` behavior for
named version metadata: `major = "4"` and `minor = "6.1"` produce `4.6.1` with the complete
`R_system_version` class stack, member order and extra fields are irrelevant, incomplete lists keep
the non-character error, and a two-component joined value is invalid. The normative target remains
GNU R 4.6.1; the available GNU R 4.6.0 installation is advisory evidence only.

## Profile 0.477 compiler-report compatibility

GNU R black-box evidence pins `R_compiled_by` as a locked zero-argument closure returning populated
character elements named `C` and `Fortran`. NativR matches that observable structure and uses an
explicit platform-adapted tolerance for the compiler strings, which describe its actual browser
toolchain rather than the advisory Windows GNU R build.

## Profiles 0.478–0.480 runtime metadata compatibility

GNU R black-box probes establish the complete external-software name set, zero-formal and locked
binding contracts, LAPACK 3.12.1 value, internal-library empty marker, and named `pcre_config()`
feature flags. NativR matches the portable structure and exact LAPACK/regex capability values while
treating external-library version strings as platform-adapted. Focused flat and exact recursive
evidence pass against advisory GNU R 4.6.0; GNU R 4.6.1 remains normative.

## Profile 0.487 non-central probability and formula-point compatibility

GNU R black-box grids establish non-central chi-square, F, and Student-t probability behavior across
ordinary and logarithmic tails, parameter recycling, boundaries, attributes, and formal metadata.
NativR matches within the declared `2e-8` absolute/relative Oracle v2 tolerance; no bit-for-bit
platform-libm claim is made. Exact recursive evidence additionally pins `points.formula` S3
dispatch, formals, value visibility, and formula-driven coordinates on a browser-owned graphics
device. The checked-in ledger contains 1,489 flat cases, 1,430 live-R-eligible cases, and 348
recursive graphs. Advisory GNU R 4.6.0 passes the focused evidence; GNU R 4.6.1 remains normative.

## Profile 0.498 parallel-state and bounded-optimization compatibility

GNU R black-box comparisons now pin persistent core-parallel export/evaluation state, default
cluster registration, apply distribution, public formals and visibility, plus bounded
`stats::optim(method = "L-BFGS-B")` results, callback counts, controls, and convergence messages.
The implementation uses browser-owned environments and the audited L-BFGS-B Wasm backend; it does
not spawn or depend on GNU R processes. The unchanged optimParallel artifact reaches scoped P7
through the generic package pipeline. GNU R 4.6.1 remains the normative target; local 4.6.0 evidence
is advisory only.

## Profile 0.489 matrix binding and graphics-annotation compatibility

GNU black-box comparisons now pin atomic/list-matrix expansion through `cbind.data.frame`, including
recursive list-column contents, row-name representation, column-name derivation, recycling, and
failure diagnostics. Exact recursive evidence also pins `grid::textGrob` labels across expression,
language, symbol, and atomic inputs. Browser graphics events render plotmath expressions through a
stable textual representation; typographic plotmath layout is not yet claimed equivalent.

The ledger contains 1,495 flat cases, 1,436 live-R-eligible cases, and 354 recursive graphs. The
unchanged VennDiagram artifact passes scoped P7 evidence. Advisory GNU R 4.6.0 passes the focused
suite; GNU R 4.6.1 remains the normative target.

`stopifnot` diagnostics now use precedence-preserving source deparse, so a failed binary predicate
is reported as `length(code) == 1 is not TRUE` without NativR's former diagnostic-only outer
parentheses. Strengthened flat and exact recursive evidence covers block, expression-object,
short-circuit, and binary failure paths; the unchanged httpcode holdout passes at scoped P7.

## Profile 0.490 colour-converter and structural-attribute compatibility

GNU R black-box comparisons pin `colorConverter` object shape and formals, row-wise versus
vectorized calls, custom converters passed through `convertColor`, `colorspaces` names and sRGB
metadata, and `rgb2hsv` values and dimnames. Exact evidence also pins `structure(dim = NULL)` and
short-name padding recursively. The ledger contains 1,498 flat cases, 1,439 live-R-eligible cases,
and 355 recursive graphs; 626 behavioral or numeric bindings now have an explicit recursive
association. Advisory GNU R 4.6.0 passes the focused exact suite; GNU R 4.6.1 remains normative.

Numeric equivalence is currently claimed for the XYZ, sRGB, and Lab converter routes exercised by
the suite. Apple RGB, CIE RGB, and Luv converter members expose their documented object shape but
raise a deterministic unsupported-feature condition instead of silently approximating results.

## Profile 0.488 device, hypergeometric, and grid compatibility

GNU R black-box comparisons now pin SVG/TIFF formals and lifecycle, portable file signatures, TIFF
LZW admission, hypergeometric distribution tails and rounding, recursive `gList` naming, and
`grid.draw` formals, visibility, null behavior, and error dispatch. NativR's SVG and TIFF bytes are
independently generated and need not be byte-identical to GNU R; observable portable structure is
the contract. The checked-in ledger contains 1,493 flat cases, 1,434 live-R-eligible cases, and 352
recursive graphs. Advisory GNU R 4.6.0 passes the focused evidence; GNU R 4.6.1 remains normative.

## Profile 0.499 `as.vector` S3 compatibility

GNU R black-box comparisons now pin class-specific and default `as.vector` dispatch, the observable
default `mode = "any"` argument in `match.call`, factor/data-frame precedence, method formals, and
recursive attributes/results. The unchanged tictoc scenario separately covers conversion of its
classed Stack environment together with nested StackList and timing state. The normative target
remains GNU R 4.6.1; the locally available GNU R 4.6.0 installation is advisory only.

## Profile 0.500 discrete-sampling RNG compatibility

GNU R black-box comparisons now pin that `sample.int(1, 1)` and the terminal singleton selection in
a full permutation advance the uniform RNG stream. Exact recursive evidence covers repeated
two-element permutations, subsequent `runif` values, and RNG-kind metadata; unchanged dfoptim
evidence separately verifies the resulting randomized `mads` trajectory. GNU R 4.6.1 remains the
normative target and local GNU R 4.6.0 results remain advisory.

## Profile 0.501 distribution and local copy-on-modify compatibility

GNU R black-box comparisons now pin central/noncentral beta density, probability, and quantile
behavior, logistic and Weibull random generation, and recursive local vector growth plus alias
results. The implementation may reuse numeric storage only under an evaluator-owned local binding;
observable aliases still receive copy-on-modify behavior. Checked-in flat evidence passes
1,536/1,536 and recursive Oracle v2 passes 392/392. GNU R 4.6.1 remains normative; the locally
available GNU R 4.6.0 run is advisory.

## Profile 0.502 list-backed environment compatibility

GNU R black-box comparisons now pin the empty parent of `as.environment(list)`, confined positional
list lookup under `exists`, mode-specific binding selection, and the absence of ambient inheritance.
Unchanged lm.beta evidence separately verifies the practical distinction from eval/with data masks
through weighted and unweighted linear-model standardization. GNU R 4.6.1 remains normative; the
locally available GNU R 4.6.0 run is advisory.

## Profile 0.503 bounded optimizer compatibility

GNU R black-box comparisons pin `nlminb` formals, bounded quadratic values, result names, evaluation
names, and compatible shared `optim` controls. NativR deliberately implements this browser subset on
L-BFGS-B rather than claiming exact native PORT iteration or diagnostic identity. Unchanged alabama
package checks and an independent constrained problem exercise the same reusable contracts. GNU R
4.6.1 remains normative; the locally available GNU R 4.6.0 run is advisory.

Profile 0.504 pins `methods::functionBody` formals, explicit closure-language return, primitive
`NULL`, and omitted-argument caller behavior with exact recursive black-box evidence. Unchanged
logging examples and an independent handler scenario exercise the same reusable reflection seam.

## Profile 0.505 regex identity and data-frame row-binding compatibility

GNU R black-box comparisons pin ordinary punctuation identity escapes inside bracket expressions
under default TRE and `perl = TRUE`, while preserving escapes with actual regex or class-syntax
meaning. Separate exact recursive evidence pins the public `rbind.data.frame` formals, named-column
matching, factors and levels, explicit/automatic/duplicate row names, controls, and empty-frame
boundary. Unchanged latex2exp examples and an independent conversion/table scenario exercise both
contracts. GNU R 4.6.1 remains normative; the locally available GNU R 4.6.0 run is advisory.

## Profile 0.506 recursive call values and GLM link compatibility

GNU R black-box comparisons pin exact identity retention when `call()` embeds a recursive list of
closures and environments. Separate flat and recursive evidence pins the public `stats::make.link`
object shape, formals, nine standard links, representative numerical behavior, epsilon
stabilization, validity predicates, and standard-family reuse. The exact recursive case observes
public structure and results without requiring clean-room closure bodies to match GNU R internals.

Checked-in evidence totals 1,543 flat cases, 1,484 live-R-eligible cases, 399 recursive graphs, and
674 recursively evidenced bindings. Unchanged `enrichwith 0.5.0` passes its applicable generic plan
and independent scenario at scoped P7. GNU R 4.6.1 remains normative; the locally available GNU R
4.6.0 run is advisory.

## Profile 0.507 parse-data, deparse, and binding compatibility

GNU R black-box comparisons pin the explicit semicolon terminal, its enclosing parse-data parent,
multiline custom-infix block deparse, and original-position S3 dispatch after leading `NULL` bind
arguments. Exact recursive evidence retains the parse-data frame, reparsable language text, and
row/column-bound data frames. Unchanged lambda.r, futile.logger, and VennDiagram checks exercise the
same shared path. GNU R 4.6.1 remains normative; the local GNU R 4.6.0 advisor is evidence only.

## Profile 0.508 signature-aware S4 and POSIXct compatibility

GNU R black-box comparisons pin explicit and default S4 dispatch-signature ordering, forwarded
missing signature arguments, lazy non-signature promises, special `rep()` ellipsis forwarding, and
`c.POSIXct` formals, class, names, mixed-input, and time-zone retention behavior. A combined exact
recursive graph retains nested S4 dispatch results, laziness state, formals, POSIXct attributes, and
mixed-input output. The unchanged `timeDate 4052.112` archive passes the complete current generic
package-check plan through these shared paths. This is scoped package evidence, not comprehensive
S4, time-zone, or arbitrary-package compatibility. GNU R 4.6.1 remains normative; the local GNU R
4.6.0 advisor is evidence only.

## Profile 0.512 filled-contour and shape package evidence

GNU R 4.6.1 black-box probes pin `graphics::filled.contour` public formals, invisible return,
strict-level error, lazy callback order, graphics-parameter restoration, and normalized key/main
panel placement. NativR independently clips a fixed-diagonal grid triangulation into filled bands,
supports missing-cell omission and compound even-odd rings, and carries normalized viewports through
Worker, Canvas, PNG, SVG, PDF, and PostScript paths. Exact device-pixel equivalence and exhaustive
topology remain outside the claim.

The frozen unchanged `shape 1.4.6.1` artifact passes every applicable generic package-check step at
scoped P7, including `example:femmecol` and its installed vignette, without a package-identity
branch or source rewrite. This is evidence for that pinned package surface, not arbitrary pure-R
package or comprehensive GNU R compatibility.

## Profile 0.513 diagram-driven GNU R evidence

GNU R black-box cases pin `format.pval()`, numeric/character `par(lend=)` state and diagnostics, and
zero-row versus nonzero `data.frame(NULL, ...)` behavior. Recursive evidence retains the associated
formals, values, graphics state, data-frame graph, and error text. NativR-specific integration tests
additionally prove that resolved line caps are rendered across supported devices, documented
LazyData names resolve through generic package metadata, recursive plotmath labels render, and title
controls affect emitted text.

The unchanged `diagram 1.6.5` artifact passes its complete applicable generic plan and an
independent plotting scenario at scoped P7. GNU R 4.6.0 supplied provisional local advisory
observations; the normative compatibility target remains GNU R 4.6.1.

## Profile 0.514 annotation and leverage-diagnostic evidence

GNU R black-box comparisons pin `grDevices::as.graphicsAnnot` formals, passthrough identity for
ordinary and language values, and character coercion for representative classed objects. Separate
flat and recursive evidence pins the public `stats::hatvalues` generic, `lm` method formals,
ordinary and weighted linear models, `glm` inheritance, supplied influence objects, and custom S3
dispatch. The GLM graph uses a declared `1e-5` absolute/relative tolerance for NativR's independent
IRLS implementation.

The unchanged `plotmo 3.7.1` artifact advances through both namespace imports and now stops at
missing `stats::qqline`. GNU R 4.6.0 supplied local advisory observations; GNU R 4.6.1 remains the
normative compatibility target.

## Profile 0.516 forwarding and step-function evidence

Exact flat and recursive GNU R comparisons cover active-frame promise provenance across captured and
re-forwarded dots and the geometry, formals, and visibility of `stats::plot.stepfun`. Flat and
integration evidence additionally covers call-head pairlist conversion and attributed
`as.list(pairlist)` behavior. GNU R 4.6.0 supplied local advisory observations; 4.6.1 remains
normative. Unchanged plotmo reaches P6, with its independent multi-predictor blocker retained.

## Profile 0.517 abbreviation-coercion evidence

GNU R black-box evidence pins `abbreviate()` character coercion for `NULL`, empty atomic vectors,
lists, pairlists, and custom `as.character` S3 methods, including zero-length names and
`named = FALSE`. NativR follows that shared coercion path. The unchanged plotmo artifact
consequently passes its independent multi-predictor graphics scenario and advances to scoped P7. GNU
R 4.6.1 remains normative; the local GNU R 4.6.0 observation is advisory.

## Profile 0.518 conditional-plot evidence

Exact flat and recursive black-box comparisons pin the supported `graphics::coplot` formal names,
invisible `NULL` return, and numeric single-condition execution. Independently authored integration
evidence freezes three overlapping intervals for `1:12`, a 2-by-2 normalized panel journal, point
membership, conditioning labels, and deterministic rejection of unsupported custom or multi-given
paths. The callable remains shape-level; no complete graphics compatibility claim is made.

The unchanged `gridGraphics 0.5-1` package check advances to missing `datasets::quakes`. GNU R 4.6.0
supplied local advisory observations; GNU R 4.6.1 remains normative.

## Profile 0.519 Math data-frame, numeric predicate, and bulk-vector evidence

GNU R black-box observations now cover million-element integer colon sequences; column-wise
`round`/Math behavior on numeric and logical data-frame columns; result attributes and row names;
non-numeric-alike diagnostics; and S3 `is.numeric` behavior for Date, difftime, and a user-defined
class. The available GNU R 4.6.0 advisor matches both new flat cases and the exact recursive graph;
GNU R 4.6.1 remains the normative target. RNG sequence/replay tests separately prove that deferred
seed publication changes cost, not observable random-stream behavior.

## Profile 0.520 exponential and non-central chi-square evidence

GNU R black-box observations freeze exponential probability/quantile tails and log encodings,
non-central chi-square density and quantiles, zero boundaries, public formals, vector metadata, and
round trips. Exact recursive evidence records the complete returned structure; statistical
integration evidence separately checks central/non-central means and exponential scale. The local
GNU R 4.6.0 advisor is non-normative; GNU R 4.6.1 remains the release target.

## Profile 0.521 Pearson chi-square evidence

Flat black-box cases pin goodness-of-fit values, expected counts, residuals, standardized residuals,
Yates correction, warnings, and exact public formals. Oracle v2 additionally compares complete
`htest` graphs for named probabilities, dimnamed matrices, corrected 2-by-2 tables, and paired
character inputs, including source-derived data names, table dimnames, class retention, and
attribute order. The available GNU R 4.6.0 advisor passes the selected flat and recursive cases; GNU
R 4.6.1 remains normative.

The unchanged `entropy 1.3.2` artifact passes the generic package plan and a separate 31-value
frequency, entropy, divergence, independence, and discretization scenario. This is scoped package
evidence, not a claim that arbitrary statistical packages are complete.

## Profile 0.522 simulated Pearson chi-square evidence

Fixed-seed flat and recursive cases cover integer-count goodness-of-fit, 2-by-2, and 2-by-3
contingency simulations. They pin Monte Carlo p-values, missing degrees of freedom, complete method
strings and `htest` structure, fractional replicate requests, and the final Mersenne-Twister stream
position. Integration evidence exercises the same contracts through the Worker-facing public API.

The local GNU R 4.6.0 advisor matches the selected trajectories exactly; GNU R 4.6.1 remains
normative and must replay the cases before a release claim. Legacy non-integral count coercion is
not covered and fails explicitly.

## Profile 0.523 formula and GLM offset evidence

Flat and recursive cases compare missing positions in formula calls and subscripts, variable
discovery, canonical `glm()` call names, omitted `data`, and offset-sensitive binomial coefficients,
deviances, and retained offset vectors. Local GNU R 4.6.0 is advisory; GNU R 4.6.1 remains the
normative release gate. The unchanged `profileModel 0.6.2` scenario adds recursive package-level
evidence without treating package examples alone as compatibility proof.

## Profile 0.524 multinomial and Summary evidence

Flat and recursive cases compare `rmultinom()` formals, deterministic one-hot and empty matrix
shapes, row names, column totals, size truncation, public `mean.default`, and `min`/`max` omission
of `NULL`. Non-degenerate fixed-seed identity is not yet claimed because the browser sampler does
not yet reproduce GNU R's binomial generator. Unchanged `nor1mix 1.3-3` provides package-level P4
evidence, while call-valued `stats::deriv` remains its exact first applicable example blocker.

## Profile 0.525 symbolic differentiation, warning, and optimization evidence

GNU R black-box observations define the public formals, return graphs, gradient/Hessian shapes,
condition classes, visibility, and trace-record structure for `deriv.default`,
`tools::assertWarning`, `.Deprecated`, and BFGS `optim`. New flat and recursive Oracle v2 cases plus
Worker integration tests make those admitted behaviors executable. Local GNU R 4.6.0 remains an
advisory oracle; pinned GNU R 4.6.1 is still the normative release target.

The evidence is deliberately narrower than API-name presence: unsupported derivative functions, GNU
expression-print identity, non-BFGS trace behavior, and Sheather-Jones density bandwidth remain
outside the profile. Consequently nor1mix remains P4 at `example:norMixFit`.
