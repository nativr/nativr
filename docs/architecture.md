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

The parser emits syntax-only nodes. Runtime language constructors may additionally create a
`ConstantExpression` node when GNU R would embed an already evaluated atomic/list value directly in
a call object. Its opaque value remains evaluator-owned and session-local, while its syntax-only
display node supplies deterministic deparsing; Tree-sitter never creates or observes it. This keeps
literal list constants distinct from executable `list(...)` calls without adding a runtime
dependency to `@nativr/ast`, generated JavaScript, or a package adapter.

The default session owns a module Worker and a global environment. Requests are serialized. Inline
mode dynamically loads the same semantic host and exists for tests and constrained environments; it
can block its calling thread.

Construction-time host adapters are explicit inputs to that composition root. In particular,
`environmentVariables` is validated and snapshotted by `@nativr/nativr`, transported as inert
strings by `@nativr/protocol`, and installed as fresh evaluator state by the runtime host. The base
environment builtins read only that state. Reset re-runs the state initializer, so inline and Worker
sessions have identical restoration and isolation without granting access to a process environment.

Line input follows the same explicit boundary. A configured `readline` callback is represented in
the initialization message by a capability boolean, not a function. When R calls `readline()` or an
enabled browser graphics device reaches a later page through `devAskNewPage(TRUE)`, the Worker emits
a correlated inert `{ prompt }` event and suspends that evaluation until the facade returns one
validated string or error. Inline mode calls the same validated adapter directly. With no adapter,
the evaluator remains non-interactive and never contacts the host. Thus package R code can reuse
browser UI supplied by the application without importing DOM APIs into `base`, `runtime`, or the
Worker.

Function-debug state follows the value boundary rather than the base-builtin boundary. Runtime-owned
weak registries key persistent and one-shot metadata by closure or builtin object identity; base
`debug`/`undebug` mutate those registries, while the evaluator consumes them at the common callable
entry point. Debugged closure statements then reuse the same readline exchange for a fixed bounded
command set. This preserves `base -> runtime`, avoids mutating normalized values, and gives inline,
package, and Worker calls one implementation.

R-callable loaded-module identity is also an owned boundary. `getLoadedDLLs()` does not inspect the
Worker implementation graph or treat parser Wasm/JavaScript bundles as R DLLs. It returns an empty
`DLLInfoList` by default and populated records only for construction-time `nativeModules` metadata.
`.Call` resolves that registry in `base`, while `runtime` carries internal values and `nativr`
converts them to protocol snapshots for the inline/Worker adapter. No lower layer imports the public
facade, and no raw host pointer crosses the boundary.

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
disposing the evaluator drops that private journal. Each device keeps a bounded page journal for
live/file output and a separate bounded recorded display list. `dev.control` clears and toggles only
the latter, so inhibiting `recordPlot` capture never suppresses Canvas, PNG, or PDF output. Screen
devices begin with recording enabled; file devices begin with it inhibited. `recordPlot` snapshots
the recorded list into NativR-owned runtime values, and `replayPlot` decodes only that format back
through the same graphics journal; neither operation serializes a host device nor depends on GNU R's
private recorded-plot representation. The PNG rasterizer and PDF serializer consume the page journal
independently: they write only bounded session-owned bytes and add no DOM, host-filesystem, network,
GNU R, or webR dependency. Coordinate and style recycling for `graphics::segments` is resolved
inside `@nativr/base`; the runtime and protocol see only finite endpoints, canonical colors,
line-widths, and line-type patterns. `graphics::points` resolves coordinate containers, symbol
codes, literal characters, colors, fills, sizes, widths, and omission before emitting a host-neutral
point array. `graphics::lines` keeps its S3/default method seam in R and normalizes all supported
line/point/step/histogram types into those existing segment and point records, including
missing-value path breaks and documented style selection; no polyline protocol or package adapter is
introduced. `graphics::text` resolves recycled coordinates, labels, canonical colors, size, face,
family, adjustment, position, offset, rotation, and omission into a host-neutral text array.
`graphics::polygon` splits missing-coordinate runs and resolves their closed paths, fill rules,
canonical fill/border colors, widths, and dash patterns before emitting a host-neutral polygon
array. `graphics::legend` similarly resolves labels, anchors, colors, line types, point symbols, and
layout inside `@nativr/base`; `graphics::box` resolves plot-frame edges and line style before
crossing the host boundary; `graphics::boxplot` computes group statistics and resolves its drawing
controls before emitting a compact host-neutral command; and `graphics::axTicks` reads only the same
owned linear window state and returns ordinary runtime vectors, so tick calculation adds no host
command or device dependency. `graphics::persp` independently normalizes and rotates owned
matrix/grid coordinates, returns its column-major homogeneous view transform, then projects the
measured default wireframe and box into the existing resolved segment command. The browser host
receives no GNU R device object, 3D scene dependency, or executable rendering code. Neither R code
nor the Worker protocol receives a DOM or Canvas handle. The initial linear-model solver lives in
`@nativr/base`, consumes only normalized formulas and owned runtime values, and has no host or
package dependency. Matrix condition diagnostics use owned QR, triangular-estimation, eigensolver,
norm, and inversion paths in the same layer. Real-matrix Cholesky decomposition likewise uses copied
column-major values, an owned upper-factor algorithm, and bounded diagonal pivoting behind ordinary
S3 dispatch; it imports no LAPACK, tensor, or package code. Cross-tabulation evaluates normalized
formulas into owned column-major table vectors in that layer; sparse Matrix classes remain outside
the current value architecture. Session RNG state also stays in that layer: independently
implemented Mersenne-Twister, Marsaglia-Multicarry, and Wichmann-Hill uniform engines feed one
normal/discrete adapter surface, stable log-gamma beta draws, and exact integer-sampling paths
without host entropy after explicit seeding, native libraries, network requests, or generated code.

The public `@nativr/nativr` composition installs a symmetric-eigen backend implemented by a minimal
LAPACK 3.12.1 `DSYEVR` WebAssembly closure. `@nativr/base` depends only on a typed decomposition
interface and retains an owned Jacobi fallback for isolated base-layer tests; the Worker and inline
public runtimes instantiate the Wasm backend per evaluator. The module is compiled once, imports
only `env.emscripten_resize_heap`, and has no filesystem, network, process, DOM, or JavaScript-code
generation surface. This is an internal numerical implementation detail, not the native-package ABI
planned for Phase 3.

`pnpm lapack:build` regenerates that artifact from a pinned LAPACK 3.12.1 checkout. The build reads
`NATIVR_LAPACK_SOURCE`, `F2C`, `F2C_INCLUDE`, and `EMCC`, creates all translated C and object files
under an operating-system temporary directory, discovers the 73-routine dependency closure, and
emits only the deterministic base64 Wasm module. Toolchains and intermediate files therefore remain
machine-local and outside the source tree; the generated header records the artifact hash.

Bounded optimization uses the same dependency pattern. `@nativr/base` defines a typed box-optimizer
interface and retains an independently authored fallback; `@nativr/nativr` installs a per-evaluator
WebAssembly backend built from the official BSD-3-Clause L-BFGS-B 2.1 distribution.
`pnpm lbfgsb:build` verifies the combined pinned source/license hash, Netlib f2c executable and
header hashes, translates and compiles under an operating-system temporary directory, verifies the
sole memory-growth import, and emits only deterministic base64 Wasm plus its SHA-256. No
intermediate Fortran/C/object file enters the source tree, and this internal numeric backend is not
the Phase 3 native-package ABI. `RNGversion` changes only this session-owned kind metadata and
engine state through deterministic transition/reseed rules; historical generators are never
delegated to a host R installation. Buggy Kinderman-Ramage normal generation is independently
reconstructed from the published algorithm and black-box fixed-seed observations, including the
legacy triangular coefficient and omitted near-zero acceptance test. The same owned transform
supplies corrected Kinderman-Ramage by restoring the published coefficient, density acceptance, and
negative-candidate rejection. Normal probabilities likewise remain in the owned base layer: central
tails reuse the regularized-gamma path and far log tails use a direct Mills-ratio expansion, so
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
while the fallback formats only owned values and never opens a pager or terminal device. A
session-owned output router sits between that journal and each evaluation's public result.
`utils::capture.output()` and `base::sink()` share its ordered frames, so the most recently created
capture or diversion wins even when package code nests the two. Persistent output frames survive
separate `r.eval()` calls, while file and connection writes remain in the base layer over the
bounded virtual store; runtime knows only the dependency-neutral router interface. `base::write()`
composes that same base-owned target writer with an independently implemented atomic formatter and
GNU R-shaped column separators; neither package code nor the runtime facade receives a host file
handle. Repository discovery follows the same split: `utils::available.packages()` owns DCF parsing,
matrices, filters, and session-cache state in the base layer, while bytes arrive through the
runtime's dependency-neutral URL request interface and the public facade transports only the
application-approved response. Package code never receives `fetch`, a socket, or a host cache path.
The `stats::family` entry is another deliberately thin generic seam: it routes owned class metadata
through the same evaluator S3 stack but does not embed distributional's package-owned method or
objects. Regular time-series values follow the same boundary. `stats::ts` creates only owned
vectors/matrices and `tsp` metadata; `as.ts`, `frequency`, `deltat`, `stats::cycle`, and
`stats::window` route external classes through the evaluator's S3 stack before using the
regular-series fallback. The non-generic `stats::embed` consumes only owned vector/matrix storage
and builds bounded, column-major lag matrices, so pure-R rolling-window helpers can reuse the
runtime primitive without a host R process. The application-supplied source-bundle loader can now
install independently authored `window.*`, `cycle.*`, `deltat.*`, or `as.ts.*` methods without
replacing the core runtime, while package-specific irregular indexes remain package-owned and must
fit the supported value model. Bundle metadata is normalized in the public facade; only normalized
package definitions enter the runtime, preserving `parser -> ast` and `runtime -> ast` dependency
direction. `utils::demo` likewise builds only an owned empty catalog; external demo discovery awaits
virtual package resources rather than a host R installation. `utils::View` remains host-independent
by coercing owned values to a bounded data-frame shape and journaling character-formatted columns;
only the public facade and Playground decide how to display that structured event. Date labeling
follows the same owned path: `weekdays` dispatches through registered Date/POSIXt methods and an
embedded C-locale catalog, using UTC arithmetic rather than browser locale or time zone services.
Path text follows the same host-independent boundary. `file.path` performs only vectorized string
construction with a caller-selected separator. `path.expand` does not query an operating-system
account or process environment; because browser sessions expose no home directory, leading tildes
remain unchanged. Neither operation normalizes paths, checks existence, or performs filesystem I/O.
Duplicate-position lookup is likewise an owned value operation: `anyDuplicated` dispatches package
methods through S3, while default atomic/list and data-frame row comparisons use runtime value
equality, missing-value, factor, and directional-scan primitives without serializing or hashing host
objects. Fixed repetition follows a direct typed-output path: `rep.int` validates and bounds its
repeat plan before allocating atomic/list/expression storage, removes ordinary attributes, and
restores only factor class/levels. Legacy S4 declaration follows an equally bounded owned path:
`methods::representation` forces and validates only its declaration arguments, rejects duplicate
parent/slot names, and returns the plain list consumed by the evaluator's session-local `setClass`
registry. `methods::showClass` reads that registry without host reflection, recursively combines
owned parent/slot declarations, and writes namespace-aware class metadata to the bounded output
journal used by `capture.output`. Toward-zero rounding shares the same owned typed-vector path as
floor and ceiling; `trunc` performs direct and Math-group S3 dispatch before transforming real
storage and never consults host date, locale, or numeric libraries. `utils::type.convert` similarly
scans owned character storage through deterministic logical/integer/double/complex recognizers,
recursively rebuilding lists and data frames without a host parser or locale-sensitive conversion
service. Visibility capture remains evaluator-owned: `withVisible` asks the promise engine for the
value and visibility produced by first forcing an expression, while a previously forced promise is
an ordinary visible lookup. Interval lookup follows the same rule: `base::findInterval` converts
owned numeric-like vectors, validates ordinary breakpoint ordering, and performs a checkpointed
binary search. This lets pure-R rolling-window code compute irregular Date widths without
package-specific host code or an R process. Gray colors follow the same ownership boundary:
`grDevices::gray` and `gray.colors` perform numeric validation, gamma interpolation, byte rounding,
alpha composition, and reversal without CSS, Canvas, a device profile, or a host color service.
Date-time construction and formatting are also owned: `ISOdate`/`ISOdatetime` validate and recycle
numeric calendar components, while `strftime` converts through the runtime's POSIXlt representation
and expands bounded UTC/GMT, C-locale tokens without calling host locale or time-zone databases. The
empty `ISOdatetime` timezone is resolved to deterministic UTC instead of probing the browser host.
No parser node or generated JavaScript crosses this boundary. Platform-shaped numeric constants such
as `.Machine` are installed as owned runtime values rather than read from a host R process. Locale
categories and monetary conventions follow the same rule: resettable evaluator state owns the
supported profiles, so Worker results do not vary with the browser or operating-system locale.
`utils::sessionInfo()` projects that state into a deterministic NativR/browser identity rather than
probing or claiming the user's native operating system or a GNU R installation. Future backends
attach behind stable operator IDs rather than duplicating package-specific algorithms.

Localization capability reporting is a projection of that same owned platform contract.
`l10n_info()` constructs four ordinary R values directly: the three portable GNU R logical fields
and a non-Windows `codeset` string. It does not call `Intl`, inspect browser language preferences,
read Windows codepages, or share mutable state with the host. Pure-R package feature branches see
the same UTF-8 result inline and across the Worker because no protocol extension is required.

Shell quoting is intentionally below the host-command boundary. `shQuote()` converts owned R
character values with deterministic Unix or Windows quoting rules and returns another owned vector;
it neither probes the page's operating system nor invokes the `systemCommand` adapter. This lets
pure-R packages prepare command text without receiving process authority, while `system()` and
`system2()` calls remain separately policy-gated. `system2()` crosses that gate as a structured
record: the executable and command elements, argument fragments, portable environment entries,
standard- stream redirection intent, input lines, wait/signal controls, and timeout remain distinct
fields. Inline and Worker modes use the same record, and neither mode has an implicit process
launcher.

`utils::aspell()` is a base-layer composition over that record, not a new host protocol. It reads
owned virtual text, optionally invokes an ordinary R filter closure, sends caret-prefixed lines to
an admitted Ispell-compatible program, and reconstructs an owned data frame. The Worker therefore
uses the existing command event while package code remains independent of host process APIs.

Session process identity follows the same rule. The facade allocates one positive integer before
choosing inline or Worker execution, sends it as an optional protocol-v1 initialization field, and
the evaluator retains it outside resettable builtin state. `Sys.getpid()` therefore remains stable
across reset and Worker replacement without inspecting Node, Worker, browser, or OS process state.
The protocol keeps a local fallback for older clients; independent page realms and actual process
management remain explicitly outside this ownership boundary.

Package library paths are evaluator-owned session state. `nativr://package` is the immutable library
of audited source bundles supplied at initialization, while `nativr://runtime/library` is the
registered core library. Base `.libPaths()` resolves and normalizes only browser-owned virtual
directories before updating that state; the evaluator then applies the same order to namespace
operators, package loading, metadata, resources, and explicit virtual `lib.loc` overrides. Reset
restores the two default roots. No host path, environment-derived R library, or network repository
is inspected implicitly.

Private namespace retrieval is another narrow evaluator-owned seam. `@nativr/base` performs GNU
R-style argument matching for `utils::getFromNamespace`, while the runtime resolves one exact
binding from the named or already-loaded namespace and forces only that binding. Source-package
imports remain in the namespace's parent environment, so private lookup cannot accidentally inherit
an imported or Base binding. Core namespaces are filtered by registered package ownership and
explicit namespace constants; package namespaces use their actual isolated binding map. No package
bundle, parser node, host object, or package-specific callback crosses the `runtime -> base`
direction.

Package-file access follows the same ownership rule. The facade retains DESCRIPTION, NAMESPACE,
ordered `R/*.R` text, and base64 resources in immutable runtime definitions. `system.file()` creates
opaque virtual identifiers; the evaluator resolves exact identifiers without URL, filesystem, or
network access; and base `readLines()` performs bounded text decoding. Session writes use a separate
evaluator-owned namespace, so package resources cannot be mutated and no host path crosses the
`base -> runtime` boundary.

Executable package text and immutable resources have separate admission budgets. DESCRIPTION,
NAMESPACE, and `R/*.R` consume the parser-facing source-unit limit; resource count remains bounded
and decoded resource bytes use a separate profile-selected aggregate ceiling (192 MiB by default).
The facade checks that ceiling before a bundle crosses the Worker boundary, and the runtime host
checks it again. Header/data payload size therefore cannot silently raise the executable-code
parsing budget.

Installed packages declaring `LazyData: yes` get a runtime-owned package-data environment distinct
from their namespace. Attachment/search environments share memoized promises keyed by direct data
resource basenames; forcing one promise invokes the ordinary bounded `utils::data` path for that one
resource. This preserves namespace isolation and avoids loading a package's entire data catalog at
attachment time. Build-time bzip2/xz normalization stays in package-tools and does not add a
compressor or host capability to the production Worker.

The build tool additionally maps standard source-package `tools/**` files into a reserved hidden
resource root. The evaluator exposes that root through scoped builtin state only while it evaluates
the owning package's retained R programs, then restores the previous state even across nested loads
or errors. Relative reads can therefore reproduce bounded install-time resource consumption without
making the root discoverable through `system.file()` or adding a host working directory.

An opt-in package-test layer similarly maps bounded `tests/**` files into a separate reserved hidden
root and emits a versioned script/reference manifest. It is build metadata, not executable package
source: P6 evidence runners must explicitly source listed scripts through the same parser →
normalized AST → evaluator path. The default artifact excludes tests, and package loading never
executes them.

The package-check driver parses each retained test script once, stores its normalized top-level
expressions in the session, and evaluates them one at a time. This preserves package state and exact
expression ordering while applying the selected resource ceiling to each evaluation instead of
mistaking a long valid script for one cumulative expression. Before evaluation it changes the
evaluator-owned working directory to the package tests root, so relative companion files resolve
without exposing a host directory. Saved-output comparison remains a distinct package-check step.

The planner recognizes a GNU R batch-session reference only from its version, Foundation copyright,
and host-platform header content. Such a transcript is recorded as an explicit not-applicable
saved-output facet because a browser runtime must not impersonate a GNU version/platform banner or
host timing. Its retained R script remains a separate runnable test. Portable saved-output
references still use deterministic normalized comparison, and the rule never branches on package
identity.

Scripts that intentionally test errors are evaluated as ordered top-level normalized expressions. An
unhandled error fails the evidence run; when the script installs `options(error=)`, the runner
invokes that R handler and can continue to later expressions. This policy stays in the generic test
harness and does not add a package-aware evaluator branch. Expected portable `.Rout.save` resources
use deterministic normalized output comparison; GNU version/platform-bound transcripts follow the
explicit policy above.

Installed-version lookup is a narrower read-only seam over those definitions. The runtime invocation
context exposes only `installedPackageVersion(name)`, not the bundle object or loader internals;
`@nativr/base` turns that validated string into owned numeric-version values. Consequently
`packageVersion()` can satisfy package dependency guards before load without creating a namespace,
performing I/O, or reversing the `base -> runtime` dependency. Core-package compatibility identity
uses the same seam. Future library indexes can implement this query behind the facade without
changing version comparison semantics.

Function-like scoped evaluation is an evaluator primitive rather than a Base-package workaround.
Closure frames and `local()` scopes register ordered cleanup handlers against their exact owned
environment; `do.call(envir=)` propagates that target environment without exposing a host stack.
`sys.calls()` and `sys.frames()` project only normalized calls and evaluator-owned environments.
`sys.nframe()` projects the same owned-frame count, while `topenv()` and `.GlobalEnv` traverse or
identify only runtime-owned environment nodes and are refreshed with the session lifecycle. Closure
values embedded as constructed call heads remain data in the normalized AST and execute through
ordinary callable dispatch—never through generated JavaScript.

Function curves preserve the same dependency direction. `graphics::curve` receives its expression as
a normalized AST or an ordinary R closure, evaluates it in a bounded child environment with the
sample variable bound, and passes owned numeric vectors to the existing `plot` or `lines` builtin.
Positive logarithmic coordinates are transformed inside the graphics layer before journal commands
are emitted. No parser node, package-specific adapter, JavaScript code generation, host callback, or
new wire command is introduced.

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
read-only. `gzcon()` replaces the visible handle for the same record and inserts a bounded
decompressed-byte buffer; raw/text readers consume that buffer and writers emit gzip through the
runtime's shared browser-standard stream helpers only when the wrapper closes. This preserves the
normal pure-R connection protocol without adding Node built-ins, DOM objects, filesystem resolution,
network access, or a second execution backend.

`readChar()` is another consumer of this same record: it slices fixed-width fields by validated
UTF-8 scalar count or exact byte count, advances the existing cursor only for open connections, and
returns NativR character values with preserved source bytes. Raw vectors, package resources, session
files, URL results, and decompressed gzip contents therefore share one implementation.

URL input extends that connection map through a narrow two-way capability. `base::url()` creates a
lazy read-only record containing only validated request data. On first open or read, inline
composition calls the explicit host adapter, while the Worker emits a correlated `url` event and
accepts a copied `url-result` byte buffer. The bytes then enter the same bounded session store and
all subsequent line/raw/source/table/serialization/gzip reads use existing connection paths. The
runtime never imports `fetch` or embeds a network policy; omitted adapters fail closed.

Socket input/output uses a separate typed lifecycle capability over the same connection map.
`socketConnection()` stores validated endpoint/mode/timeout metadata; the facade invokes the
construction-time adapter directly inline or relays correlated `socket`/`socket-result` records
through the Worker. Reads return bounded copied bytes plus an incomplete flag, writes carry copied
bytes, and timeout/close operations carry no executable object. Reset, Worker restart, and disposal
send session-scoped close-all. No raw socket API, `fetch`, DOM object, Node builtin, or transport
policy enters `base`, `runtime`, or evaluated package code.

`utils::download.file()` composes that same request capability with the mutable session file tree.
It validates every URL, header, mode, and destination before making the first request, delegates
only typed request data, and atomically replaces each destination after a complete bounded response
arrives. The operation adds neither a second transport nor host-path access. It is a reusable
runtime primitive for package resource downloads, while repository resolution, archive admission,
dependency locking, and package activation remain separate package-manager responsibilities.

File copying composes existing owned-path and byte-store primitives without a new backend or Worker
message. `base::file.copy()` resolves sources across immutable package/runtime resources and mutable
session paths, copies exact admitted bytes only into the session tree, and recursively enumerates
owned directories under evaluator checkpoints. Pure-R package resource staging therefore uses the
same normalized-AST evaluator and virtual filesystem as interactive code; no package translation,
Node filesystem, DOM API, or host path is introduced.

Package-root discovery composes the evaluator's existing library paths, registered core namespaces,
and admitted pure-R bundle records. `base::find.package()` returns the directory that owns the same
retained DESCRIPTION/resources already used by `library()`, `requireNamespace()`, `system.file()`,
and `packageDescription()`. Core package directories are read-only children of the virtual runtime
library; bundle roots remain `nativr://package` children. No directory crawler, host R installation,
Node filesystem, Worker protocol event, or package-specific rewrite is introduced.

Command pipes compose the existing command request with that same private connection storage.
`base::pipe()` creates an inert record; a read asks the explicit host policy once and writes copied
stdout bytes into the record, while a write buffers bytes and submits exact text on close. Existing
connection consumers then operate without knowing about Worker transport or processes. No new wire
event, shell, executable search, host file, or package-specific execution backend is introduced.

ZIP-member connections compose the same store without another filesystem or package backend.
`base::unz()` keeps an archive path plus exact member name in a lazy record, validates a bounded
single-disk non-ZIP64 central directory, and copies a stored or raw-DEFLATE member into its private
byte file after size and CRC checks. Package resources and session files therefore feed the same
line/raw/source/table/serialization/gzip consumers; no entry is extracted to a path and no new
Worker protocol event is required.

Object-size reporting is another owned-runtime service rather than a host probe. The runtime walks
one NativR value using a deterministic 64-bit R object layout, including vector allocation buckets,
attributes, pairlist tags, normalized language nodes, and closure formals/body. It deliberately does
not inspect the JavaScript heap, follow environment bindings, or ask the Worker host for memory
data. Repeated list children are counted repeatedly while equal strings share storage only within
one character vector, matching the documented attribution boundary used by `utils::object.size()`.

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

Bundled core data uses the same boundary. `base` supplies declarative static-package resources,
export names, and autoload names; `runtime` validates and mounts them under a distinct core
namespace environment, then invokes ordinary `data()` before the session is exposed. The default
search path, `data(package=)`, and `datasets::name` therefore resolve one package-owned binding
rather than a dataset-specific builtin. Resource provenance and hashes are recorded in
[`core-data-provenance.md`](core-data-provenance.md).

Navigation requests are another one-way journal beside output, data views, and graphics.
`utils::browseURL()` either invokes a first-class R callback inside the evaluator or appends a typed
URL/file record to the per-evaluation context. The public protocol transports it only with the final
result; virtual-file buffers are transferred, while the host facade invokes `onBrowse`. No DOM,
Window, network, or process object enters `base`, `runtime`, or the Worker. This keeps viewer
support reusable for source-only packages without weakening the dependency direction or CSP model.

System commands use a deliberately different, two-way capability because R must receive a status or
captured output before evaluation can continue. `base` validates GNU R-shaped arguments and asks the
runtime invocation for a typed command result. Inline composition calls an explicit facade handler;
the Worker emits a correlated request, suspends only that evaluation, and resolves it from an
immediate response message that bypasses the ordinary serialized operation queue. Neither runtime
nor protocol imports Node process APIs or parses a shell command. Missing policy fails closed, and
the embedding host remains the sole authority for allow-lists, execution, and cancellation.

Title annotations are deliberately not a second graphics renderer. `graphics::title()` normalizes
annotation values and session `par()` state into the existing owned `text` display-list event.
Browser Canvas, PNG, PDF, record/replay, inline callbacks, and the Worker protocol therefore consume
one event shape. Source-only packages resolve the callable through ordinary NAMESPACE imports; no
package name or translated JavaScript enters the graphics layer.

Reference lines follow the same rule. `graphics::abline()` resolves direct coefficients or generic
model `coef.*` results, clips finite lines to the owned linear window, and emits the existing
`segments` event alongside vectorized horizontal and vertical lines. Record/replay, Canvas, PNG,
PDF, inline callbacks, and Worker transport therefore need no new protocol or renderer branch, and
source-only packages import the ordinary graphics callable without a package adapter.

Installed vignette browsing is also composition rather than a second documentation subsystem.
`utils::browseVignettes()` groups the versioned package-tool index already consumed by `vignette()`,
while `print.browseVignettes()` writes a self-contained catalog to the existing session file store
and calls `browseURL()`. Package resources remain immutable, the Worker carries the existing typed
file snapshot, and the host keeps navigation and sandbox policy; no package name, DOM object,
network client, or host path enters the runtime implementation.

Package help follows the same build-time/runtime split. `@nativr/package-tools` converts every
admitted `man/*.Rd` page into a deterministic topic/alias/title/common-section manifest, including
pages with no examples. `utils::help()` resolves that immutable index or a registered core binding,
then `print.help_files_with_topic()` writes text to the bounded output journal or creates escaped,
script-free HTML through the existing session-file and `browseURL()` path. No Rd parser, GNU help
database, package-specific adapter, network client, or DOM object enters the Worker runtime.

Package-check orchestration remains build-time composition. The package tool derives an immutable
plan from artifact metadata/help/example/test/vignette resources and accepts only a minimal
reset/evaluate executor interface, avoiding a dependency on the public runtime package. Every
runnable item receives an isolated session reset. Saved output is normalized and compared as data;
the runner reports the first missing facility, warning, runtime failure, or semantic difference and
never introduces package-identity branches into the evaluator.

Environment finalization stays inside the evaluator instead of delegating lifecycle to JavaScript.
The memory census returns the IDs of environments reachable from global/base/package state, active R
frames, builtin state, and registered runtime roots. `gc()` compares that set with session-owned
registrations and invokes unreachable R closures through normal callable dispatch. Runtime hosts
await exit-finalizer completion before parser disposal, Worker termination, socket-session closure,
or state replacement. No `WeakRef`, `FinalizationRegistry`, generated JavaScript, or host object
enters the semantic path, so results depend on explicit R reachability and lifecycle operations
rather than browser GC timing.

The package-example runner enters a normalized source scope rather than wrapping example code in an
ordinary closure. Evaluation therefore preserves the requested target environment while a separate
source frame owns exit handlers and exposes the GNU R-observed `source`/`withVisible`/`eval`/`eval`
stack through the existing call/frame APIs. This keeps global assignments, `local = TRUE`, and
withr-style deferred cleanup compatible without translating example source or branching on a package
name.

Color names and plot-frame selection stay on that same normalization boundary. `@nativr/base`
canonicalizes GNU R named colors by removing only insignificant ASCII spaces before consulting the
owned catalog, and validates `plot.default(bty=)` through the shared box-edge selector. The runtime,
Worker protocol, and renderers receive only canonical RGBA values and selected edges, so unchanged
package examples do not introduce package-specific branches or new host behavior.

DCF parsing follows the existing virtual-I/O ownership boundary. `@nativr/base` consumes text from
the session file/connection layer, applies record/continuation/field semantics, and constructs owned
matrix or data-frame values. Package code such as cpp11 metadata inspection uses the ordinary Base R
binding; neither the package name nor a host filesystem parser enters the evaluator or Worker
protocol.

Recursive Oracle v2 cases declare the exact behavioral `package::binding` entries they exercise. The
runner and status generator validate those associations against the generated capability manifest
before counting them. The observer traverses public R values only—attributes, closure
formals/body/environment, owned environment bindings and parents, and reference identity—and never
reads runtime implementation state or GNU R source.

Function replacement stays on the normalized-value boundary. `body<-` converts accepted public R
values to normalized AST or constant nodes, `formals<-` converts pairlist/list entries to normalized
parameters, and both return closures with an explicit lexical enclosure. `environment<-` reuses the
runtime attribute model for non-functions. None of these paths parses generated source, emits
JavaScript, or exposes Tree-sitter nodes.

`as.function.default` composes those same converters rather than maintaining a second function
representation: list prefixes become normalized parameters, the final value becomes a normalized
body, and the result is an ordinary runtime closure. The S3 entry point uses the shared dispatch
registry, so package-defined methods do not require package-name branches.

Runtime-root text files use the same evaluator-owned immutable resource boundary as package files,
but occupy `nativr://runtime` rather than a package namespace. The base connection layer receives
only a data-only resource callback, so inline and Worker execution share identical reads without
Node filesystem APIs, network access, or host installation probing. S3 dispatch separately retains
the generic-definition environment for registered methods and the generic caller environment for
legacy method discovery and `NextMethod()` continuation.

The `compiler` package is a registered browser-owned base namespace rather than a package rewrite.
Its `compile` entry returns normalized syntax for interpretation, so the parser → AST → runtime path
remains the only executable-code path. Language objects carry call-entry tags beside, but not
inside, their ordinary attribute map; the evaluator and Base apply/coercion functions share one
canonical entry projection. `%*%` remains a Base primitive implemented over runtime vectors and
attributes, with no BLAS, native module, or host dependency.

Package dependency edges retain their DESCRIPTION kind through installation and compilation.
Namespace resolution loads both `Depends` and `Imports`; a separate attachment phase exposes only
`Depends` packages on the search path in dependency order. Browser-provided core packages are
declared consistently by the repository resolver, static namespace registry, capability manifest,
and installed-package description rather than synthesized as external archives.

The `parallel` namespace follows the same composition boundary. Cluster values are data-only R
lists, and map/call operations reuse the ordinary closure evaluator in one deterministic lane. No
process, socket, native module, or host scheduler enters the runtime. A future Worker concurrency
layer must remain explicit and preserve the same semantic API instead of changing this dependency or
evaluator architecture.

Platform-conditional NAMESPACE selection belongs to the build-time package boundary. It converts a
strictly bounded platform predicate into ordinary declarations before hashing the artifact; the
browser runtime never receives executable installation logic. Unsupported conditions fail closed.

The progress adapter stores mutable state inside an evaluator-owned environment referenced by a
classed R handle. Parallel `parLapply` aliases reuse the same mapping and closure-invocation path as
the cluster adapter. Matrix cross-products reuse the numeric matrix-product kernel, while fitted
model-frame access reuses the data frame already retained by the linear-model builder.

Pearson `cor.test` is composed entirely from evaluator-owned vectors, the existing Student-t
probability implementation, and Base value constructors. Data-frame `cbind` now recognizes the table
abstraction at the Base boundary and emits ordinary named column lists with row metadata. Neither
path introduces a package identity check, host callback, native dependency, or alternate execution
route.
