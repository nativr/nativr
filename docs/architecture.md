# Architecture

NativR executes a small R-compatible subset without GNU R:

```text
source -> Tree-sitter R Wasm -> normalized @nativr/ast
                                      |
                                      v
                       @nativr/runtime evaluator
                                      |
                         @nativr/base JS operators
                                      |
                    value + graphics commands -> Worker protocol -> browser host
```

`@nativr/ast` has no dependencies. `@nativr/parser` and `@nativr/runtime` independently depend on
the AST. `@nativr/base` supplies builtins and operators to the runtime. `@nativr/protocol` owns
wire-only schemas. `@nativr/nativr` is the only composition root and public import; the playground
imports only it. `scripts/check-boundaries.mjs` enforces this graph.

The default session owns a module Worker and a global environment. Requests are serialized. Inline
mode dynamically loads the same semantic host and exists for tests and constrained environments; it
can block its calling thread.

Construction-time host adapters are explicit inputs to that composition root. In particular,
`environmentVariables` is validated and snapshotted by `@nativr/nativr`, transported as inert
strings by `@nativr/protocol`, and installed as fresh evaluator state by the runtime host. The base
environment builtins read only that state. Reset re-runs the state initializer, so inline and Worker
sessions have identical restoration and isolation without granting access to a process environment.

High-level helpers reuse semantic runtime primitives instead of maintaining parallel behavior.
`base::replace`, for example, delegates to the same immutable one-dimensional subset-replacement
engine used by direct `x[index] <- value` evaluation, so coercion, recycling, attributes, extension,
warnings, checkpoints, and allocation accounting stay on one path. `base::tapply` likewise reuses
owned split grouping, subsetting, function invocation, atomic promotion, array attributes, and
allocation limits. Ragged groups and their result arrays never cross into a host dataframe,
statistics service, or package implementation.

Character vectors carry semantic JavaScript strings, exact per-element bytes, and canonical R
encoding marks as one owned value. The runtime—not Tree-sitter, the browser locale, or a host codec—
propagates that representation through subset/replacement and the XDR reader/writer. Base-layer
`Encoding`, `Encoding<-`, `enc2utf8`, `enc2native`, `charToRaw`, `rawToChar`, and `c` all use the
same storage seam. This lets package code inspect and preserve encoded data without exposing GNU R
internals or making execution depend on a machine locale.

The core deliberately has no external table, package, file, network, native statistics, or host
graphics engine. Its initial graphics seam is a deterministic command journal: base builtins emit
page, coordinate-window, RGBA-raster, resolved line-segment, resolved point-symbol, resolved text,
closed-polygon, plot-frame, resolved boxplot, and resolved legend records through the evaluation
context; the wire-only protocol transports them; and the Playground maps them onto Canvas. Runtime
and base packages never import DOM or Canvas APIs. `grDevices::as.raster` prepares row-first
character raster values from owned matrices, vectors, and RGB(A) arrays, and the existing
`rasterImage` conversion consumes the same representation without a host image library. The
`graphics::image` default method maps owned matrix values and coordinates into that raster command
for regular grids or into existing borderless polygon commands for irregular grids; its S3 generic
keeps package-defined methods in R. No image implementation, Canvas object, or package-specific
adapter crosses into the runtime core. The session-owned device state also implements
`dev.hold`/`dev.flush`: held commands remain in a bounded journal across evaluations and are copied
to the current evaluation context only when the nested hold level reaches zero. Resetting or
disposing the evaluator drops that private journal. A second bounded, session-owned display list
records emitted page/window/raster/segments/points/text/polygon/box/boxplot/legend commands.
`recordPlot` snapshots that list into NativR-owned runtime values, and `replayPlot` decodes only
that format back through the same graphics journal; neither operation serializes a host device nor
depends on GNU R's private recorded-plot representation. Coordinate and style recycling for
`graphics::segments` is resolved inside `@nativr/base`; the runtime and protocol see only finite
endpoints, canonical colors, line-widths, and line-type patterns. `graphics::points` resolves
coordinate containers, symbol codes, literal characters, colors, fills, sizes, widths, and omission
before emitting a host-neutral point array. `graphics::text` resolves recycled coordinates, labels,
canonical colors, size, face, family, adjustment, position, offset, rotation, and omission into a
host-neutral text array. `graphics::polygon` splits missing-coordinate runs and resolves their
closed paths, fill rules, canonical fill/border colors, widths, and dash patterns before emitting a
host-neutral polygon array. `graphics::legend` similarly resolves labels, anchors, colors, line
types, point symbols, and layout inside `@nativr/base`; `graphics::box` resolves plot-frame edges
and line style before crossing the host boundary; `graphics::boxplot` computes group statistics and
resolves its drawing controls before emitting a compact host-neutral command; and
`graphics::axTicks` reads only the same owned linear window state and returns ordinary runtime
vectors, so tick calculation adds no host command or device dependency. `graphics::persp`
independently normalizes and rotates owned matrix/grid coordinates, returns its column-major
homogeneous view transform, then projects the measured default wireframe and box into the existing
resolved segment command. The browser host receives no GNU R device object, 3D scene dependency, or
executable rendering code. Neither R code nor the Worker protocol receives a DOM or Canvas handle.
The initial linear-model solver lives in `@nativr/base`, consumes only normalized formulas and owned
runtime values, and has no host or package dependency. Matrix condition diagnostics use owned QR,
triangular-estimation, eigensolver, norm, and inversion paths in the same layer. Real-matrix
Cholesky decomposition likewise uses copied column-major values, an owned upper-factor algorithm,
and bounded diagonal pivoting behind ordinary S3 dispatch; it imports no LAPACK, tensor, or package
code. Cross-tabulation evaluates normalized formulas into owned column-major table vectors in that
layer; sparse Matrix classes remain outside the current value architecture. Session RNG state also
stays in that layer: an independently implemented Mersenne-Twister engine feeds normal/discrete
adapters, stable log-gamma beta draws, and exact integer-sampling paths without host entropy after
explicit seeding, native libraries, network requests, or generated code. `RNGversion` changes only
this session-owned kind metadata and engine state; historical generators are never delegated to a
host R installation. Normal probabilities likewise remain in the owned base layer: central tails
reuse the regularized-gamma path and far log tails use a direct Mills-ratio expansion, so
`stats::pnorm` never delegates to a host statistics library. The public `stats::rgamma` path reuses
the same rejection sampler that already feeds owned beta, chi-squared, and Student-t draws, without
introducing a second RNG or host distribution service. `stats::rlnorm` similarly exponentiates the
same session-owned Inversion normal stream after vectorized log-scale parameter validation,
preserving fixed-seed ordering without a parallel random engine. The Cauchy family stays on that
owned path too: `rcauchy` transforms one uniform draw per valid positive-scale result, while
`dcauchy`, `pcauchy`, and `qcauchy` use direct browser-native numeric formulas and stable tail
identities. No host statistics service or native distribution library participates.
Browser-independent text adapters also remain in the base layer: `utils::glob2rx` coerces owned
values and translates glob metacharacters directly into R regular-expression text, while `sQuote`
wraps coerced text using deterministic C-locale, explicit Unicode/TeX, or caller-supplied quote
pairs. Neither asks the host filesystem, shell, locale, URL APIs, or a JavaScript regular-expression
engine to interpret its input. Simple shape constructors remain in the same owned base layer:
`mat.or.vec` allocates zero-filled typed arrays and attaches runtime dimensions directly, without
delegating to a host matrix library. Primitive `seq.int` similarly selects integer or double typed
storage after bounded, checkpointed sequence generation and routes classed first arguments through
the evaluator's existing `seq` S3 dispatch seam. Explicit `methods::setAs` declarations live in a
separate evaluator-session coercion map; `methods::as` resolves owned source classes and their
declared parents before invoking a registered R closure or a core `as.<Class>` constructor.
`methods::setOldClass` records S3 class chains in the same session-owned class map, allowing bounded
S4 generic and coercion lookup to traverse declared old-style inheritance without consulting an R
installation, host class registry, or package code. `methods::show` consumes that same map for
single-object display dispatch; package-defined methods write through the bounded output journal,
while the fallback formats only owned values and never opens a pager or terminal device. The output
journal also supports nested, stream-selective capture frames for `utils::capture.output`. Captured
text remains evaluator-owned until it becomes a bounded character result or is explicitly duplicated
by `split = TRUE`; it never enters a host file or connection. The `stats::family` entry is another
deliberately thin generic seam: it routes owned class metadata through the same evaluator S3 stack
but does not embed distributional's package-owned method or objects. Regular time-series values
follow the same boundary. `stats::ts` creates only owned vectors/matrices and `tsp` metadata;
`as.ts`, `frequency`, `deltat`, `stats::cycle`, and `stats::window` route external classes through
the evaluator's S3 stack before using the regular-series fallback. The non-generic `stats::embed`
consumes only owned vector/matrix storage and builds bounded, column-major lag matrices, so pure-R
rolling-window helpers can reuse the runtime primitive without a host R process. The
application-supplied source-bundle loader can now install independently authored `window.*`,
`cycle.*`, `deltat.*`, or `as.ts.*` methods without replacing the core runtime, while
package-specific irregular indexes remain package-owned and must fit the supported value model.
Bundle metadata is normalized in the public facade; only normalized package definitions enter the
runtime, preserving `parser -> ast` and `runtime -> ast` dependency direction. `utils::demo`
likewise builds only an owned empty catalog; external demo discovery awaits virtual package
resources rather than a host R installation. `utils::View` remains host-independent by coercing
owned values to a bounded data-frame shape and journaling character-formatted columns; only the
public facade and Playground decide how to display that structured event. Date labeling follows the
same owned path: `weekdays` dispatches through registered Date/POSIXt methods and an embedded
C-locale catalog, using UTC arithmetic rather than browser locale or time zone services. Path text
follows the same host-independent boundary. `file.path` performs only vectorized string construction
with a caller-selected separator. `path.expand` does not query an operating-system account or
process environment; because browser sessions expose no home directory, leading tildes remain
unchanged. Neither operation normalizes paths, checks existence, or performs filesystem I/O.
Duplicate-position lookup is likewise an owned value operation: `anyDuplicated` dispatches package
methods through S3, while default atomic/list and data-frame row comparisons use runtime value
equality, missing-value, factor, and directional-scan primitives without serializing or hashing host
objects. Fixed repetition follows a direct typed-output path: `rep.int` validates and bounds its
repeat plan before allocating atomic/list/expression storage, removes ordinary attributes, and
restores only factor class/levels. Legacy S4 declaration follows an equally bounded owned path:
`methods::representation` forces and validates only its declaration arguments, rejects duplicate
parent/slot names, and returns the plain list consumed by the evaluator's session-local `setClass`
registry. Toward-zero rounding shares the same owned typed-vector path as floor and ceiling; `trunc`
performs direct and Math-group S3 dispatch before transforming real storage and never consults host
date, locale, or numeric libraries. `utils::type.convert` similarly scans owned character storage
through deterministic logical/integer/double/complex recognizers, recursively rebuilding lists and
data frames without a host parser or locale-sensitive conversion service. Visibility capture remains
evaluator-owned: `withVisible` asks the promise engine for the value and visibility produced by
first forcing an expression, while a previously forced promise is an ordinary visible lookup.
Interval lookup follows the same rule: `base::findInterval` converts owned numeric-like vectors,
validates ordinary breakpoint ordering, and performs a checkpointed binary search. This lets pure-R
rolling-window code compute irregular Date widths without package-specific host code or an R
process. Gray colors follow the same ownership boundary: `grDevices::gray` and `gray.colors` perform
numeric validation, gamma interpolation, byte rounding, alpha composition, and reversal without CSS,
Canvas, a device profile, or a host color service. Date-time construction and formatting are also
owned: `ISOdate`/`ISOdatetime` validate and recycle numeric calendar components, while `strftime`
converts through the runtime's POSIXlt representation and expands bounded UTC/GMT, C-locale tokens
without calling host locale or time-zone databases. The empty `ISOdatetime` timezone is resolved to
deterministic UTC instead of probing the browser host. No parser node or generated JavaScript
crosses this boundary. Platform-shaped numeric constants such as `.Machine` are installed as owned
runtime values rather than read from a host R process. Locale categories and monetary conventions
follow the same rule: resettable evaluator state owns the supported profiles, so Worker results do
not vary with the browser or operating-system locale. `utils::sessionInfo()` projects that state
into a deterministic NativR/browser identity rather than probing or claiming the user's native
operating system or a GNU R installation. Future backends attach behind stable operator IDs rather
than duplicating package-specific algorithms.

Package-file access follows the same ownership rule. The facade retains DESCRIPTION, NAMESPACE,
ordered `R/*.R` text, and base64 resources in immutable runtime definitions. `system.file()` creates
opaque virtual identifiers; the evaluator resolves exact identifiers without URL, filesystem, or
network access; and base `readLines()` performs bounded text decoding. Session writes use a separate
evaluator-owned namespace, so package resources cannot be mutated and no host path crosses the
`base -> runtime` boundary.

An evaluator-owned directory index sits over the same identifiers. It supplies static runtime and
package directories, mutable session directories, a resettable current working directory, and
root-bounded dot-segment normalization. Directory listing and relative-path resolution therefore
work for unchanged pure-R source without exposing browser URLs, Node paths, or operating-system
filesystem capabilities.

File connections are evaluator-owned records layered over those same opaque identifiers, never host
descriptors. R receives only a classed integer handle; the session map additionally checks the
original value identity, owns open mode and cursor state, bounds handle count and stored bytes, and
destroys records on `close()` or session reset. `readLines()`, `writeLines()`, `cat()`, and
`capture.output()` route through one connection writer/reader, while package-backed records are
read-only. This preserves the normal pure-R connection protocol without adding Node built-ins, DOM
objects, filesystem resolution, network access, or a second execution backend.

The PNG device composes existing owned seams instead of introducing a host renderer. A numbered
device records the same normalized graphics events used by Worker callbacks and replay plots; a
DOM-free software rasterizer converts those events to RGBA; an independent PNG encoder writes
IHDR/IDAT/IEND chunks through browser-standard DEFLATE or a stored-DEFLATE fallback; and the result
enters the session byte store. Raw `readBin()` reads that store back into an R raw vector. Thus
package code can create a real image file while device commands, pixels, compression, paths, and
resource limits remain under evaluator control.

GNU R serialization is an independent runtime codec layered over the same byte store. It reads and
writes documented XDR v2/v3 streams, recognizes `RDX2`/`RDX3` workspaces, and uses browser-standard
compression streams for gzip. The codec translates supported serialized values directly into
NativR-owned values; Tree-sitter nodes, GNU R objects, and implementation internals never cross the
boundary. Package `data/*.rda` uses the workspace decoder, while `R/sysdata.rda` is installed into a
namespace before its ordered R sources execute. Installed-package `.rdx`/`.rdb` databases will be a
separate lazy object-store adapter rather than a change to evaluator semantics.

Package data and delimited tables reuse these seams rather than introducing a package-specific
interpreter. The evaluator exposes bounded package-resource enumeration to base builtins;
`utils::data()` resolves a direct `data/` entry, decodes the package's declared portable encoding,
and sends `.R` content through the existing parser/normalized-AST evaluator in the selected
environment. Text datasets and `read.table`/`write.table` variants use one owned record/field codec
over inline text, immutable package bytes, or session connections. No package code, table content,
or path is converted to JavaScript source or delegated to a host filesystem/parser.
