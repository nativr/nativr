# Implementation status

Date: 2026-08-03

## Implemented

- Node 24/pnpm 11 monorepo, strict TypeScript, ESM browser packages, and cross-platform scripts.
- Reproducible Tree-sitter R Wasm build, normalized NativR AST, Unicode spans, and diagnostics.
- Typed logical/integer/double/complex/raw vectors with separate NA masks where applicable, lists,
  attributes, matrices/arrays, factors, frames, formulas, environments, closures, lazy promises,
  ellipsis, and resource limits.
- JavaScript reference operators with recycling warnings, comparison/logical semantics, control
  flow, rightward/non-local assignment, direct replacement-function assignment, simple nested
  subset/member replacement chains, GNU R argument matching, and 672 registered functions. Supported
  arithmetic, comparison, logical, sequence, and matching operators are also first-class builtin
  bindings.
- Character vectors own exact per-element bytes and canonical `unknown`/`latin1`/`UTF-8`/`bytes`
  marks. `Encoding`, `Encoding<-`, `enc2utf8`, and deterministic browser-UTF-8 `enc2native` preserve
  that state through concatenation, subsetting/replacement, raw conversion, and XDR serialization,
  with GNU R 4.6 differential evidence. General `iconv`, host locale codecs, normalization, and
  exhaustive encoding-sensitive string behavior remain incomplete.
- Vector/list selection and replacement, recursive `[[`, arbitrary-dimensional column-major array
  selection/replacement, strict axis bounds, `drop`, zero-length axes, named dimension axes,
  one-dimensional array names, numeric/character coordinate-matrix array operations, common-type
  data-frame coordinate extraction, numeric cell replacement, row/column operations, binding, and
  class-preserving vector selection. Nested replacement rebuilds list/data-frame containers,
  supports NULL deletion and missing `$` intermediates, and preserves GNU R's repeated intermediate
  subscript evaluation. One-dimensional replacement extends atomic/list values with typed missing or
  NULL gaps, grows names, removes invalidated dimensions, appends consecutive data-frame columns,
  extends numeric/named data-frame rows with typed missing cells and row-name updates, and preserves
  factor levels with invalid-level warnings.
- Complete measured helper-name surfaces for strings, sorting/matching, apply/map, descriptive
  statistics, random distributions/sampling, and dates/times.
- Usage-ranked `as.difftime` numeric and character construction with exact GNU R 4.6 formals,
  recycled 24-hour formats, automatic or explicit units, names, missing values, and interval
  attributes. The connected `difftime` path adds automatic/minute/hour/week units, partial unit
  matching, name retention, and fractional-recycling warnings; named-zone date parsing, arbitrary
  locale `%X`, POSIXlt conversion, and the complete difftime method family remain incomplete.
- Usage-ranked `ls` plus its identical `objects` alias enumerate local bindings without forcing lazy
  promises, including hidden-name filtering, patterns, sorted/unhashed ordering, exact GNU R 4.6
  formals, caller frames, and numeric or named search-list environments. This lets unchanged pure-R
  package code inspect its namespace and local call frames. Browser regular expressions, locale
  collation and exact hash-bucket order remain bounded compatibility surfaces. Active bindings now
  have read/write, inspection, locking, and unchanged-R6 evidence; substitution and exhaustive
  primitive edges remain bounded.
- Native and magrittr-style pipes, richer normalized formulas, registered namespaces, S3 dispatch,
  bounded S4 registration, R6 construction, and vctrs class construction.
- Owned symbol/language/expression values, non-forcing `quote()`/`expression()`, bounded
  normalized-AST `eval()`/`substitute()`, canonical `match.call()` reconstruction, initial call
  construction/deparsing, language predicates, and stable public snapshots without parser-node
  exposure.
- Explicit global/base/empty/current/closure and named search-list environments, child creation,
  parent traversal, and lexical evaluation, plus mutable `$`/`[[` bindings, lookup, assignment,
  multi-binding `mget` with fallbacks/modes/inheritance, existence checks, list conversion,
  environment naming, delayed/active bindings, and explicit promise forcing.
- Owned pairlists with tags, type/mode/predicate behavior, list/vector/expression coercion,
  constructor mode, indexing, replacement type transitions, attributes, classes, dimensions,
  dimension names, Worker transport, and non-forcing `alist()` syntax capture.
- Text-driven parsing into owned expression vectors, bounded early `n` termination, and
  parser-validated public symbol/language/expression input records.
- Usage-ranked `base::source()` and input `textConnection()` fully pre-parse browser-owned text,
  evaluate sequentially in global/caller/explicit environments, preserve final value visibility, and
  support bounded echo/printing inside pure-R packages and the default Worker. Output text
  connections, URLs, host paths, source references, and abort recovery remain explicit boundaries.
- Backtick-delimited names normalize to their underlying R binding names, including operator names.
- Worker-first and inline public APIs, versioned snapshots/protocol, and a runnable Vite playground.
- Build-time installation of standard pure-R source directories, tarballs, and CRAN-like repository
  dependency closures into integrity-locked bundles, followed by normalized-AST parsing,
  dependency/version-checked isolated namespaces, imports/exports, `::`/`:::`, S3 registration,
  lifecycle hooks, attachment, reset/reload, and matching inline/Worker execution. Immutable
  DESCRIPTION/NAMESPACE/R-source/resource paths are exposed by `system.file()`, enumerable through
  `list.files()`/`list.dirs()`, selectable as a read-only working directory, and readable through
  bounded `readLines()` or read-only file connections. `utils::data()` discovers and executes
  package `data/*.R` scripts, imports `.csv`/`.tab`/`.txt`, or decodes XDR v2/v3 gzip
  `.rda`/`.RData` workspaces into a selected environment. Packaged `R/sysdata.rda` is decoded into
  the namespace before source evaluation. Build-time `man/*.Rd` extraction plus `utils::example()`
  runs package topics/aliases through the same normalized-AST runtime, with `give.lines` and
  explicit skipped-section controls. Native code, installed `.rdx`/`.rdb` lazy-load databases,
  unsupported serialized object types/compressors, broader NAMESPACE directives, and universal
  package execution remain explicit boundaries.
- Installed non-core packages take precedence over same-name compatibility shims; core namespaces
  remain reserved. Qualified `S3method(package::generic, class)` declarations resolve the generic's
  namespace independently from the package-local method binding. General attributes now cover
  environments by reference and closures by copy-on-modify. Environment/binding locks and
  non-dispatching `.subset`/`.subset2` extraction provide reusable package foundations.
- Usage-ranked `utils::getFromNamespace()` resolves exact public or private bindings from registered
  core and admitted pure-R package namespaces. Character namespaces load on demand, actual loaded
  namespace environments and attached-package `pos`/`envir` lookup are supported, unused controls
  stay lazy, and lookup never inherits from imports or Base. GNU R differential cases plus an
  unchanged source-only package private-function call cover the general seam; namespace mutation,
  lazy-load databases, and the complete namespace-management API remain incomplete.
- Usage-ranked `utils::help()` discovers core bindings and every indexed source-package `man/*.Rd`
  topic or alias without loading a host help database. It preserves GNU R's measured symbol,
  character, literal `package=`, laziness, result-class, and package-index shapes; text is the
  non-interactive default and requested HTML crosses the existing bounded Worker browse journal as
  script-free generated content. Exact GNU Rd conversion, `?`/`??` syntax/search, installed lazy
  help databases, and byte-identical text/HTML/PDF output remain incomplete.
- Usage-ranked `graphics::curve()` evaluates a named R function or lazy caller/package-scoped
  expression over bounded linear or logarithmic sample points, returns GNU R-shaped invisible
  `x`/`y` values, and delegates new/additive drawing to the existing `plot`/`lines` graphics stack.
  Pure-R package, Worker/Canvas, exact-formal, coercion, error, and GNU R differential evidence
  cover the general seam. `plot.default` now transforms positive logarithmic coordinates and warns
  when nonpositive values are omitted; `lines` and additive curves inherit active log axes. Complete
  log axes, other additive primitives, clipping, replayed log-axis metadata, and device-identical
  output remain incomplete.
- Usage-ranked `utils::packageVersion()` reads core or validated bundle versions without loading a
  namespace. Shared `numeric_version`, `package_version`, and `R_system_version` values preserve
  integer components, missing entries, printing/formatting, concatenation, and padded vectorized
  comparisons; `getRversion()` and `utils::compareVersion()` use the same parser. Arbitrary library
  paths, version replacement/indexing, the complete numeric-version method family, and execution
  compatibility for a merely discoverable package remain explicit gaps.
- Usage-ranked `utils::packageDescription()` retains validated DESCRIPTION fields and returns full
  or selected classed metadata, missing fields, scalar drops, exact formals, and virtual file
  locations without loading the namespace. A source-only fixture mirrors cli's measured field
  access, the default Worker exposes it in the Playground, and unchanged `pkgconfig 2.0.3` proves
  repository-installed metadata. Host-library scans, malformed package trees, arbitrary codecs, full
  core-package prose, print/citation/date methods, and metadata mutation remain explicit gaps.
- Usage-ranked `Sys.getpid()` exposes one positive integer identity per NativR session. It is stable
  across calls, reset, and Worker restart; concurrently created facade sessions are distinct; and an
  unchanged source-only package calls it through the ordinary base namespace. The identifier is not
  a host PID, and cross-page global uniqueness, process handles, parents/children, enumeration,
  signals, and native ps semantics remain explicit browser-platform boundaries.
- Usage-ranked `.libPaths()` owns normalized, deduplicated, resettable browser library roots for
  supplied source bundles and registered core namespaces. Default/explicit virtual `lib.loc`
  controls package loading, namespace operators, version/resource discovery, and lifecycle hook
  locations; unchanged `withr 3.0.3` runs `with_libpaths()` and restores state. Host library scans,
  startup `R_LIBS*`, runtime downloads, multiple installed versions, and binary trees remain gaps.
- Unchanged external-package execution is pinned for `pkgconfig 2.0.3`, `generics 0.1.4`,
  `withr 3.0.3`, and `R6 2.6.1`. The latest proofs cover package-owned S3 dispatch, a generated
  `with_options()` wrapper using call/formal/environment replacement, `bquote`, dynamic caller
  frames, hooks, and state restoration, plus `with_envvar()` mutation and cleanup through
  session-owned environment variables, plus unchanged R6 generator construction, object
  instantiation, public/private method calls, reference field mutation, and an active read/write
  field, plus shallow and recursive deep cloning of nested R6 objects, without translating or
  patching package code.
- Session environment variables are explicit, isolated runtime state. `createR()` snapshots an
  optional string map for inline or Worker execution; GNU R-shaped `Sys.getenv()`, `Sys.setenv()`,
  and `Sys.unsetenv()` query and mutate it, while reset restores the original map and host process
  variables remain inaccessible.
- Usage-ranked `Sys.which()` uses a separate snapshotted `createR({ executablePaths })` allow-list.
  Default sessions discover no tools; admitted names return their explicit path in inline, Worker,
  Playground, and unchanged pure-R package calls, with GNU R-shaped coercion, duplicate ordering,
  missing results, exact formals, reset, and validation evidence. It never scans host PATH/PATHEXT
  or the filesystem. GNU closure identity and missing values inside names attributes remain gaps.
- Browser-owned text I/O through `readLines()`/`writeLines()` covers same-session temporary files,
  immutable package text, GNU R line endings, separators, NUL/incomplete-line behavior, byte limits,
  and stdout events without host filesystem access. Session-owned `file()` handles add implicit and
  explicit open/close, read/write/append modes, persistent cursors, bounded `seek()`, `flush()`,
  `isOpen()`, `summary()`, invalid-handle rejection, `tempdir()`, and `file.exists()`. Usage-ranked
  `gzcon()` wraps the same handles with bounded browser-standard gzip text/raw reads and close-time
  writes, including immutable package resources and Worker execution. An owned directory tree adds
  `R.home()`, `dir.create()`/`dir.exists()`, `list.files()`/`dir()`, `list.dirs()`,
  `getwd()`/`setwd()`, `normalizePath()`, `basename()`, and `dirname()`; relative paths resolve only
  within the current session, package, or runtime root. `Sys.sleep()` adds interruptible
  asynchronous waits for package retry/polling code without blocking the Worker event loop.
- Usage-ranked `stdout()` and adjacent `stdin()`/`stderr()` expose stable terminal connection
  descriptors through the same registry. Explicit output targets route to bounded inline/Worker
  events; `isatty()`, `getConnection()`, `getAllConnections()`, `showConnections()`,
  `closeAllConnections()`, `summary()`, `isOpen()`, and `flush()` provide GNU R-shaped package
  introspection and lifecycle behavior. The browser is non-TTY and streaming stdin remains an
  explicit host-adapter gap.
- Usage-ranked `system.time()` plus adjacent `proc.time()` with one lazy expression evaluation,
  closure-like formals, validated `gcFirst`, visible named/classed `proc_time` results, monotonic
  elapsed seconds, missing unavailable child-process fields, timed-error stderr output, and
  deterministic reset. Browser-unavailable CPU, child-process, and forced-GC metrics are explicit
  platform boundaries rather than invented values.
- Usage-ranked `system()` with GNU R 4.6 formals/validation and an explicit `systemCommand` host
  handler. Inline and Worker execution share typed command/input/control requests, captured output,
  stderr, status/warning, timeout, and failure shapes; a pure-R package function executes through
  the same seam. The default runtime has no shell or process authority, and all executable lookup,
  quoting, environment, signal, and cancellation semantics remain host policy.
- Usage-ranked `pipe()` composes the same explicit host policy with the private connection store.
  Lazy/explicit text and binary reads, exact text writes, stderr/output/status propagation, normal
  close/summary/class behavior, resource limits, default denial, pure-R package calls, and Worker/
  Playground execution have evidence. Duplex/interactive streams, seeking, shell discovery, and
  NUL-containing binary stdin remain explicit boundaries.
- Usage-ranked `unz()` composes immutable package resources or session-owned ZIP bytes with the same
  private connection store. Exact stored/DEFLATE members, CRC and range validation, implicit/open
  cursors, text/raw reads, pure-R package calls, downloaded session archives, Worker, and Playground
  execution have evidence. No entry is extracted to a path; encryption, ZIP64, multi-disk archives,
  other compression methods, seeking, and writes remain explicit boundaries.
- Usage-ranked `utils::object.size()` supplies GNU R 4.6-shaped deterministic 64-bit accounting for
  atomic vectors, within-vector character sharing, recursive lists/pairlists, attributes, language
  objects, closures, and environment boundaries, plus legacy/IEC/SI formatting and printing. It
  estimates owned R objects and never presents browser heap telemetry as R memory.
- Usage-ranked `readline()` with GNU R 4.6 non-interactive prompt/empty-result behavior and an
  explicit asynchronous `readline` host adapter. Inline and Worker sessions share validated
  single-line input, R whitespace trimming, a 256-character prompt bound, resource limits, and
  capability-aware `interactive()`; an unchanged pure-R package function and Playground browser
  dialog execute through the same seam.
- Usage-ranked `url()` with GNU R 4.6 formals, class, and closed-summary evidence plus an explicit
  asynchronous byte adapter. Inline and Worker sessions share validated URL/method/header requests,
  copied bounded responses, lazy one-request connection state, and downstream `readLines()`, raw
  `readBin()`, `source()`, table/serialization, and `gzcon()` reuse. The default runtime remains
  network-free; origin, redirect, credential, timeout, and cache policy belongs to the host.
- Usage-ranked `socketConnection()` plus `isIncomplete()` and `socketTimeout()` with GNU R 4.6
  formals, classed integer handles, closed/open summaries, modes, visibility, timeout mutation, and
  text-write plus line/raw-read behavior. A typed `createR({ socket })` adapter owns endpoint and
  transport policy; requests and byte responses are copied, bounded, correlated through the Worker,
  and closed on R close, reset, restart, or disposal. Without the adapter, construction with
  `open = ""` remains an inert shape probe and network I/O fails closed.
- Usage-ranked `file.copy()` with GNU R 4.6 formals, defaults, lazy empty-source behavior,
  vectorization, directory expansion, overwrite, recursive trees, dotfiles, visible logical results,
  and validation boundaries. Exact text/binary bytes move from immutable package resources or
  session files only into bounded mutable session paths; unchanged pure-R package and default Worker
  examples execute without host-filesystem authority.
- Usage-ranked `find.package()` with GNU R 4.6 formals/defaults, attached-package order,
  vectorization, missing warning/error/quiet behavior, empty-input laziness, and explicit library
  filtering. Core and source-only packages resolve to immutable virtual roots; unchanged package R
  code locates and enumerates its own files inline and through the default Worker Playground.
- Usage-ranked `l10n_info()` with GNU R 4.6 null formals, visible named-list shape, portable scalar
  logical fields and OS-specific suffix contract. The browser platform reports MBCS UTF-8,
  non-Latin-1 text with `codeset = "UTF-8"`; unchanged package and Worker paths exercise xfun's
  measured UTF-8 branch without host-locale probing.
- Usage-ranked `shQuote()` with GNU R 4.6 closure/formal shape, partial mode matching, explicit
  `sh`/`csh`/`cmd`/`cmd2` rules, coercion and registered `as.character` S3 dispatch, missing values,
  visibility, and attribute removal. Pure-R and Worker paths execute without host process authority.
- Usage-ranked `system2()` with GNU R 4.6 closure/formal shape, structured executable/argument/
  environment and stream-redirection data, capture/status/timeout/warning/visibility semantics,
  explicit resource bounds, unchanged pure-R package execution, and inline/default-Worker host
  transport. Without a `systemCommand` policy it fails closed and launches no process.
- Usage-ranked `.Call()` with explicit native-module/routine manifests, exact package confinement,
  registered arity checks, bounded `RValueSnapshot` arguments/results, inline/default-Worker
  transport, and a default-deny typed native/Wasm callback. Automatic compiled-package builds and
  GNU R C-API/SEXP compatibility are not yet implemented.
- Usage-ranked `utils::aspell()` with GNU R 4.6 formals and classed five-column results, virtual
  text inputs, arbitrary R filter functions, Ispell pipe parsing, explicit admitted-program
  selection, unchanged pure-R package execution, and inline/default-Worker transport. Built-in
  filters and serialized dictionaries remain explicit unsupported depth.
- Usage-ranked `graphics::abline()` with GNU R 4.6 formals/defaults, intercept/slope and coefficient
  precedence, generic S3 model coefficients, horizontal/vertical vectors, style recycling, linear
  plot-window clipping, display-list replay, unchanged pure-R package execution, and default
  Worker/Canvas rendering. Log-axis `untf` transforms and expanded `xpd` clipping remain depth.
- Usage-ranked `utils::browseVignettes()` with GNU R 4.6 formals, classed return object, package-
  grouped seven-column matrices, duplicate-package rows, attached/all-package selection, empty
  printing, and the `print.browseVignettes()` S3 method. Generic package manifests feed a bounded
  self-contained HTML catalog through the existing default-deny browse journal; unchanged pure-R
  package code and the Worker/Playground sandbox exercise it without runtime network or host files.
- Usage-ranked `utils::download.file()` composes that explicit byte adapter with session-owned
  files. GNU R 4.6 formals, preflight validation, invisible statuses, paired-vector `retvals`, exact
  replacement bytes, named headers, pure-R namespace calls, failure atomicity, default-deny inline
  behavior, and Worker/Playground execution have evidence. Host paths, ambient fetch, append modes,
  progress, redirects, caching, and platform downloader processes remain outside the browser
  contract.
- Usage-ranked `gc()` traverses the reachable NativR value graph into GNU R's named 2-by-6
  `Ncells`/`Vcells` report, maintains resettable session high-water values and full/partial census
  counts, emits bounded verbose messages, and shares its collection seam with
  `system.time(gcFirst)`. Adjacent `gcinfo()` preserves the documented previous-flag API without
  claiming host-GC control.
- Usage-ranked `grDevices::png()` with a numbered browser/PNG device registry, invisible open,
  selectable close, zero-byte target creation, `%d` multi-page filenames, pixel/resolution and
  background validation, a DOM-free renderer for the complete owned graphics-event vocabulary,
  per-device `par()` state, compressed RGBA PNG chunks, raw `readBin()` retrieval, and bounded
  pixel/file allocation. Tests verify GNU R lifecycle/shape behavior, parameter isolation, PNG
  signature and dimensions, IDAT decompression, and nontransparent plot pixels. Exact fonts,
  anti-aliasing, color profiles, typed binary reads, and non-PNG file devices remain explicit depth
  boundaries.
- Browser-memory tabular I/O includes `utils::read.table`, `read.csv`, `read.csv2`, `read.delim`,
  `read.delim2`, `write.table`, `write.csv`, and `write.csv2`. The bounded parser handles
  separators, quoted fields (including doubled quotes and embedded newlines), headers, row/column
  names, fill/skip/comment controls, missing strings, syntactic name repair, and deterministic
  logical/integer/double/complex/factor conversion. Host files, compressed inputs, URLs, arbitrary
  encodings, and the complete scan/column-class surface remain explicit boundaries.
- Browser-safe `print()` and `cat()` output with invisible return semantics, ordered inline/Worker
  events, `evalDetailed` retention, output-budget accounting, and Playground console rendering.
  `utils::capture.output()` adds nested in-memory stdout/message capture, visible-result printing,
  partial-line preservation, split output, and bounded browser-memory path/connection targets;
  `cat()` uses the same connection writer. Usage-ranked `sink()`/`sink.number()` add a persistent
  19-level output diversion stack, split tees, one message-connection slot, connection lifecycle,
  and shared ordering with `capture.output()` across separate evaluations and errors. Host
  filesystem output remains an explicit boundary.
- Usage-ranked `base::write()` composes the same browser-memory writer with GNU R-shaped one/five
  column defaults, vector separators, atomic-storage formatting, append behavior, closed/open
  connection lifecycle, invisible results, and output/resource bounds. The measured sass call runs
  unchanged in a source-only package and the default Worker. Native encodings, host files, and
  non-atomic deparse behavior remain explicit boundaries.
- Usage-ranked `utils::available.packages()` and `contrib.url()` compose the explicit URL callback
  with a bounded UTF-8/gzip DCF parser, GNU R 4.6-shaped package matrices, extra fields, standard
  and package-defined filters, duplicate selection, and an age-bounded session cache. The measured
  curl repository query runs unchanged in a source-only package and Worker. Ambient networking,
  persistent disk caches, binary installation, and complete recursive license analysis remain
  explicit boundaries.
- `utils::demo()` returns GNU R's empty `packageIQR` catalog shape when no package library is
  selected. External package demo discovery and execution remain an explicit package-resource
  boundary.
- Usage-ranked `utils::example()` discovers deterministic build-time extractions of package
  `man/*.Rd`, loads the selected source-only bundle, returns prepared lines or evaluates them in a
  global/fresh environment, and respects `run.dontrun` / `run.donttest`. Interactive HTML/prompting,
  exact source/echo formatting, `setRNG`, and abort recovery remain depth boundaries.
- `RNGversion()` selects the Mersenne-Twister/Inversion/Rounding defaults used by zoo's measured
  R-3.5 examples and restores current Rejection defaults for R 3.6 or newer. Historical pre-R-1.7
  uniform and normal generators remain explicit unsupported boundaries.
- Regular time-series foundations include vector and matrix `stats::ts()` construction with calendar
  coordinates and endpoint-driven recycling, default and S3-dispatched `as.ts()`, `frequency()`,
  `deltat()`, and `cycle()`, plus `stats::window()` subsetting, integral downsampling, bounded
  extension with typed `NA`, out-of-range warnings, and package-owned S3 method forwarding. Sampling
  intervals are reciprocal validated `tsp` frequencies or one for ordinary inputs; cycle results
  cover vector or matrix-row coordinates, validated `tsp`, and fractional frequencies. Data-frame
  coercion, irregular zoo indexes, replacement windows, interpolation, and the remaining adjacent
  time-series family remain incomplete.
- Usage-ranked `stats::embed()` creates bounded, column-major current-to-past lag matrices from
  supported atomic/list vectors and atomic matrices, including zero-column matrices, measured
  fractional-vector dimensions, vector storage preservation, GNU R matrix coercions, and
  source-attribute removal. Factor vectors, data frames, expression vectors, raw/list matrices,
  higher arrays, arbitrary non-`ts` vector classes, and fractional dimensions on nonempty matrices
  remain explicit boundaries.
- Usage-ranked `stats::filter()` runs zoo's genuine measured recursive-flow expression and supports
  owned convolution/recursive algorithms, one- and two-sided or circular boundaries, vector and
  matrix series, `tsp`/`ts`/`mts` metadata, missing propagation, recursive initial history, and GNU
  R formals. A source-only package and default Worker Playground execute the same path. Data-frame
  coercion, complex filtering, irregular-series package methods, and native algorithm identity
  remain explicit boundaries.
- Usage-ranked `stats::ts.plot()` runs magrittr's exposition-pipe vector example and aligns
  equal-frequency vector/matrix/data-frame/regular-series columns across their union time range.
  Missing union cells break paths; common line and point styles recycle by series; bounded linear or
  log windows, annotations, frame control, dynamic `par("usr")`, pure-R packages, Worker transport,
  and Canvas rendering share the existing graphics journal. Multi-panel `plot.ts`, irregular
  indexes, complete axis/margin layout, and device-exact output remain incomplete.
- Usage-ranked `base::findInterval()` runs zoo's irregular-Date rolling-window width expression
  through checkpointed binary search, including duplicate/infinite breakpoints, missing queries,
  closure and inside controls, flattened numeric coercion, sortedness validation, and unattributed
  integer output. Unchecked invalid break vectors, recursive-list coercion, and long-vector indices
  remain explicit boundaries.
- Device-independent `new-page`, coordinate-window, RGBA-raster, styled line-segment, resolved
  plot-frame/boxplot, and legend graphics events with bounded `plot.new()`, `plot.window()`,
  `rasterImage()`, `segments()`, `box()`, `boxplot()`, and `legend()` builtins, transferable raster
  buffers, output budgeting, and Playground Canvas rendering.
- Usage-ranked `graphics::image`/`image.default` with S3-first package-method forwarding,
  numeric/logical matrices, center and boundary coordinates, regular raster and irregular polygon
  grids, explicit colour breaks/ranges, transparent missing cells, one-row palette strips, exact
  image-style windows, invisible returns, and bounded Worker/Canvas transport. Legacy colour
  intervals, complete axes, and device-selected raster heuristics remain explicit boundaries.
- Usage-ranked `base::plot` plus `graphics::plot.default` with S3-first package-method forwarding,
  numeric vector/x-y/matrix/data-frame/list coordinates, point/line/both/overplotted/histogram/step/
  no-draw geometry, GNU R-shaped 4% linear range padding, common styles, panel hooks, scalar labels,
  invisible default returns, bounded Worker/Canvas output, and display-list replay. Automatic axes,
  logarithmic or fixed-aspect layout, specialized core methods, margins/clipping, and
  device-identical rendering remain explicit boundaries.
- Usage-ranked `graphics::lines` plus exported `lines.default` with S3-first package-method
  forwarding, shared vector/matrix/data-frame/list/complex coordinate normalization, all nine plot
  types, missing-value path breaks, documented line/point style rules, invisible default results,
  and bounded Worker/Canvas/PNG/record-replay output through the existing segment and point event
  vocabulary. Complete coordinate classes, clipping/log transforms, line join/cap controls,
  arbitrary graphical parameters, and device-identical rendering remain explicit boundaries.
- Usage-ranked `grDevices::as.raster`/`is.raster` with ragg's captured-color-matrix shape, row-first
  raster storage, logical/numeric/raw grayscale, numeric/raw RGB(A), vector reshaping,
  names/dimnames removal, S3 methods, identity, missingness/scaling boundaries, and downstream
  `rasterImage` pixel-order evidence.
- Usage-ranked `grDevices::dev.hold`/`dev.flush` with nested owned-device levels, bounded ordered
  graphics buffering across evaluations, zero-level release, namespace access, visible integer
  returns, and reset/dispose cleanup.
- Usage-ranked `grDevices::dev.control` with exact GNU R 4.6 formals, partial `enable`/`inhibit`
  selection, invisible `NULL`, per-device state, and immediate recorded-display-list reset. Browser
  rendering and PNG/PDF output remain active while recording is inhibited; screen devices default to
  recording and file devices default to no recording. An unchanged pure-R package import and
  same-session `recordPlot`/`replayPlot` provide executable evidence.
- Usage-ranked `grDevices::dev.cur`/`dev.list`/`dev.off` plus `graphics.off` with one browser-owned
  device, GNU R-shaped null/current values and visibility, held-command flush on close, graphical-
  parameter reset, reopen behavior, namespace access, and explicit multiple/file-device boundaries.
- Usage-ranked `grDevices::devAskNewPage` for RColorBrewer's ten measured calls, with exact formals,
  visible queries, invisible previous-value updates, GNU R coercion, per-device state,
  `device.ask.default`, non-interactive/file-device bypass, unchanged source-package imports, and
  default Worker prompting through the existing explicit bounded `readline` exchange.
- Usage-ranked `base::getLoadedDLLs` for ps's measured module-path probe, with no-argument formals,
  visible `DLLInfoList` shape, `vapply(..., "path")`, empty subsetting, source-package and Worker
  evidence, a truthful empty default, and records only for explicit virtual `nativeModules`.
  Synthetic GNU R DLLs, host paths, pointer handles, and automatic compiled-package compatibility
  are explicitly excluded.
- Usage-ranked `grDevices::recordPlot`/`replayPlot` with a bounded independently owned display list,
  ragg's same-session record/replay shape, package-metadata retention, held replay, invisible replay
  return, namespace access, malformed-input guards, and explicit external-format/reload boundaries.
- Usage-ranked `graphics::segments` for posterior's measured vertical interval call, including
  omitted-endpoint defaults, vector recycling, resolved colors and line patterns, omitted
  missing/non-finite entries, Worker transport, Canvas pixels, and same-session display-list replay.
- Usage-ranked `graphics::legend` for zoo's three measured call shapes, including keyword and
  coordinate placement, recycled line/point/color controls, columns, titles, optional boxes,
  invisible geometry results, Worker transport, Canvas pixels, and same-session display-list replay.
- Usage-ranked `graphics::axTicks` for zoo's measured linear secondary-axis call, including
  state-derived horizontal/vertical pretty ticks, explicit `axp`, forward/reversed axes, coercible
  sides, lazy linear-only arguments, namespace access, and allocation limits. Logarithmic ticks
  remain an explicit unsupported boundary.
- Usage-ranked `graphics::axis` for all 18 measured labeling/zoo/bit64 calls, including sides 1:4,
  explicit or window-derived sorted linear ticks, character/numeric/default/no labels, secondary
  axes, measured styles, exact formals, invisible return locations, pure-R package calls, and
  bounded Worker/Canvas/PNG/record-replay output through existing segment/text events. Logarithmic
  and date axes, outer margins, plotmath, exact collision layout, and font/pixel identity remain
  explicit boundaries.
- Usage-ranked `graphics::box` for zoo's measured plot-frame redraw, including all plot-region `bty`
  edge shapes, `col`/`fg` precedence, normalized line types, positive widths, invisible returns,
  Worker transport, Canvas pixels, output accounting, and same-session display-list replay. Figure
  and margin regions remain an explicit unsupported boundary.
- Usage-ranked `graphics::boxplot` for zoo's measured grouped-series call, including numeric
  vector/list/matrix inputs, Tukey hinges and whiskers, notch confidence limits, outliers, invisible
  standard result shape, S3 forwarding, widths/positions/styles, Worker transport, Canvas pixels,
  output accounting, and same-session display-list replay. Formula/data-frame methods, logarithmic
  axes, arbitrary `pars`, complete annotation/axes, and device-identical layout remain explicit
  boundaries.
- Usage-ranked `graphics::barplot`/`barplot.default` for zoo and bit64's three measured calls,
  including S3 forwarding, vector and matrix inputs, stacked/beside geometry, GNU R-shaped midpoint
  return matrices, widths/spaces/offsets, horizontal layout, names, annotations, legends, additive
  drawing, source-only package reuse, and bounded Worker/Canvas/display-list output over existing
  polygon/axis/text events. Log axes, positive density hatching, device-exact layout, and the full
  graphical-parameter surface remain explicit boundaries.
- Usage-ranked `graphics::hist`/`hist.default` for 19 measured testthat, openssl, shiny, and
  posterior calls, including S3 forwarding, finite numeric/matrix inputs, Sturges/Scott/FD or
  numeric/callable breaks, endpoint controls, counts/densities/midpoints, standard histogram
  objects, labels, additive drawing, and bounded Worker/Canvas/PNG/record-replay output over the
  existing polygon journal. Exact `pretty()` boundaries for every floating-point range, logarithmic
  axes, positive line-density shading, and the full graphical-parameter surface remain explicit
  boundaries.
- Usage-ranked `graphics::persp` for zoo's measured classed `100 × 10` matrix call, including S3
  forwarding, ascending/default grids, missing surface cells, exact scaled/aspect-preserving
  homogeneous view matrices, bounded projected wireframe/box segments, invisible results, Worker
  transport, Canvas rendering, output accounting, and display-list replay. Filled facets, lighting,
  axis arrows/ticks/text, hooks, `trans3d`, hidden-line equivalence, and arbitrary graphical
  controls remain explicit boundaries.
- Usage-ranked `graphics::points` for zoo's documented package-method extension point and adjacent
  default calls, including S3 forwarding, paired/vector/matrix/data-frame/list/complex coordinates,
  plotting-symbol and style recycling, missing/non-finite omission, invisible returns, bounded
  Worker transport, Canvas pixels, output accounting, and display-list replay. Line/path types,
  locale-dependent glyphs, broader coordinate classes, clipping/log axes, font identity, and
  arbitrary graphical controls remain explicit boundaries.
- Usage-ranked `graphics::text` for zoo's measured rotated outside-label call, including S3
  forwarding, vector/list/matrix/data-frame/complex coordinates, x/y and label recycling, truncation
  warnings, missing omission, colors/sizes/font faces/position/adjustment/offset/rotation/family,
  bounded Worker transport, Canvas pixels, output accounting, and display-list replay. Plotmath,
  Hershey fonts, broader class coercion, clipping/log axes, and device-identical metrics remain
  explicit boundaries.
- Usage-ranked `graphics::matplot` for bit64's six measured matrix-performance calls, including
  vector/matrix/data-frame series, one-argument x generation, column cycling, missing omission,
  point/line/both/overplotted/no-draw types, log-x/log-y coordinate resolution, recycled colors,
  symbols, fills, sizes, line types, and widths, bounded Worker/Canvas output, and display-list
  replay. Full axes and annotations, class-specific plotting methods, `add = TRUE`, step/histogram
  types, and device-identical layout remain explicit boundaries.
- Usage-ranked `base::aperm`/`aperm.default` for bit64's measured matrix-axis swap and independently
  authored pure-R array classes, including numeric/character axis permutations, reverse defaults,
  resized dimensions/dimnames, fixed-shape output, atomic/list arrays, lazy S3 dots, inherited
  dispatch, `NextMethod`, namespace access, attribute cleanup, and resource bounds. `aperm.table`,
  malformed low-level attributes, exact diagnostics, and long vectors remain explicit boundaries.
- Usage-ranked `base::dget`/`dput` plus the measured `tempfile`/`unlink` prerequisites for bit64's
  classed-data-frame roundtrip, backed by bounded evaluator-owned `nativr://session-temp/...` text
  storage and the existing parser/normalized-AST/evaluator path. Atomic vectors, list/pairlist
  nesting, ordinary attributes, missing/NaN/infinite values, complex/raw storage, Unicode,
  visibility, missing files, and resource limits have coverage. Absolute host paths/connections,
  nondefault controls, closures/environments, cycles, binary serialization, and persistence remain
  explicit boundaries.
- GNU R-compatible XDR version-2/version-3 serialization for owned atomic vectors, lists, pairlists,
  names, and ordinary attributes. `serialize`/`unserialize`, `saveRDS`/`readRDS`/`infoRDS`, and
  `save`/`load` share one bounded codec; browser-standard gzip streams provide the default file
  wrapper. Exact black-box GNU R bytes, package `.rda`, `R/sysdata.rda`, raw-vector roundtrips,
  return visibility, malformed input, and resource limits have executable coverage.
  ASCII/native-endian formats, ordinary environments, closures/language objects, more ALTREP
  classes, bzip2/xz/zstd, host files, and installed lazy-load databases remain explicit boundaries.
- Usage-ranked `graphics::polygon` for zoo's measured filled-area panel helper, including paired
  vector/matrix/data-frame/list/complex coordinates, missing-coordinate polygon splitting, recycled
  fill/border colors and line types/widths, solid/no-fill density, even-odd rules, invisible
  returns, bounded Worker transport, Canvas fill/border pixels, output accounting, and display-list
  replay. Positive hatch density, broader coordinate classes, clipping/log axes, exact device
  dash/fill metrics, and arbitrary graphical controls remain explicit boundaries.
- Usage-ranked `base::replace` for zoo's measured missing-run helper, reusing immutable
  one-dimensional subset replacement for numeric/logical/character subscripts, recycling, promotion,
  names/extension, matrices, factors, lists, pairlists, owned data frames, `NULL`
  materialization/deletion, partial arguments, namespace access, and resource limits. Expression
  vectors, arbitrary class-specific `[<-` methods, and exact legacy diagnostics remain explicit
  boundaries.
- Usage-ranked `comment()`/`comment<-` for zoo's measured metadata example, including query,
  replacement, `NULL`/empty removal, missing character comments, ordinary attribute preservation,
  `attr<-` validation, and explicit boundaries for values outside the current attributed-sequence
  model.
- Frequency-prioritized `head()` selection for core owned data shapes and bounded `str()` structural
  output with invisible return semantics.
- Strict recursive `identical()` comparison with numeric, missing-value, attribute-order,
  source-reference, and closure-environment controls across the owned value model.
- Initial conditions and handlers: `try`, `tryCatch` error/finally handling, `stop`, `stopifnot`,
  `warning`, `message`, `conditionMessage`, nested warning/message suppression, and `invisible`,
  while keeping resource-limit errors uncatchable.
- Resettable evaluator-owned `options()`/`getOption()` state with lazy defaults, exact
  query/mutation/removal behavior, and print `digits`/`max.print` integration.
- Deterministic browser/Worker host-mode detection through non-interactive `interactive()`.
- Exact binary-input, ties-to-even `round()` with vectorized digits, complex values, missingness,
  signed zero, and attribute retention.
- Usage-ranked `signif()` with zoo's measured plot-limit calculations, decimal significant-digit
  ties-to-even rounding, real/complex vector controls, metadata retention, and direct/Math S3
  dispatch.
- Real/complex `log`, `log10`, `log2`, `log1p`, `exp`, and `expm1` with recycled bases,
  near-zero-stable paths, domain warnings, and metadata retention.
- Lazy `with` data masks, isolated/supplied `local` environments, and visibility-preserving dynamic
  evaluation.
- Tolerant recursive `all.equal` comparisons plus scalar `isTRUE`/`isFALSE` predicates.
- Lazy vectorized `ifelse` selection with branch-only forcing, positional recycling, atomic/list
  promotion, and test-attribute retention.
- GNU R-compatible `any`/`all` logical summaries with empty identities, three-valued missingness,
  exact `na.rm` handling, eager argument evaluation, coercion warnings, and scalar-list support.
- Lazy data-mask `subset` selection for vectors, lists, matrices, and data frames, including NA-row
  removal, lexical fallback, column-selection expressions, and rectangular shape retention.
- Function-position lookup skips non-callable bindings while retaining ordinary value lookup,
  matching GNU R's separate callable resolution behavior.
- Captured-name `rm`/`remove` environment mutation with `list=`, explicit/inherited environments,
  missing-object warnings, and invisible NULL results.
- Attribute-aware `rev` across NULL, atomic, list, pairlist, factor, matrix, and data-frame shapes.
- `cumsum`, `cumprod`, `cummax`, and `cummin` across logical/integer/double/raw/complex inputs with
  GNU R output types, missing/NaN propagation, names, dimension dropping, and integer-overflow
  warnings.
- Delayed function-exit cleanup through `on.exit` across normal returns, explicit `return`, and
  errors, including replacement/clearing and before/after ordering, plus attribute-preserving `I`
  class marking.
- Closure-body inspection through owned language values and recursive/shallow `unlist` flattening
  with type promotion, nested names, factor-level union, raw/complex values, and pairlists.
- Lazy `transform` data-mask evaluation with caller fallback, replacement, removal, and frame-row
  recycling, plus attribute-aware `tail` selection across vectors, lists, expressions, matrices, and
  data frames.
- Dynamic caller-environment lookup through `parent.frame` and column-major `t` transposition for
  named vectors, factors, matrices, and atomic-column data frames.
- Closure-formal inspection through owned pairlists and lazy repeated evaluation through
  `replicate`, including atomic/matrix/array simplification and unsimplified list results.
- Metadata-preserving real `floor` semantics and factor-aware `split` grouping for vectors, lists,
  matrices, expressions, pairlists, and data-frame rows, including empty levels and interactions.
- Usage-ranked `ceiling` with data.table's exponential-sample conversion, zoo's nested
  tick-alignment helper, logical/integer/double-to-double rounding, retained vector/array
  attributes, distinct missing/non-finite values, and direct/Math S3 method boundaries.
- Usage-ranked `stats::approx` with data.table's sequence interpolation and zoo's Date-coordinate
  mapping, linear/constant methods, endpoint rules, explicit or generated output grids, missing-pair
  handling, duplicate reducers, and explicit-coordinate attribute retention.
- Usage-ranked `standardGeneric` with S7's measured `setGeneric` definition body, session-local S4
  class/method resolution, formal/default/dots forwarding, `ANY`, and call-context errors.
- Usage-ranked `grDevices::colorRampPalette` with isoband's two measured 21-color Lab Viridis calls,
  an owned returned palette function, linear RGB/Lab interpolation, bias, alpha, namespace access,
  and byte-exact GNU R black-box results.
- Usage-ranked `grDevices::hcl` with all six measured ggplot2/zoo raster and event-color calls,
  browser-native polar CIE-LUV/D65-to-sRGB conversion, vector recycling, alpha, missing/non-finite
  coordinates, gamut fixup, exact formals, and source-only package/Worker execution.
- Usage-ranked `utils::sessionInfo` with otel's measured `$platform` lookup, a deterministic
  browser-native platform descriptor, R 4.6 compatibility-target metadata, current session
  locale/RNG kinds, attached core packages, UTC time-zone reporting, and classed list shape.
- Usage-ranked `as.ordered` with generics' measured `letters` constant and character-vector
  coercion, ordered-factor identity, ordinary-factor unused-level dropping, name preservation, and
  custom S3 method forwarding.
- Usage-ranked `as.array` and `as.array.default` with rstan's measured package-method call shape,
  lazy S3 dots, one-dimensional atomic/list/factor/pairlist defaults, name-to-dimname promotion,
  unrelated-attribute retention, and existing-array identity.
- Usage-ranked `stats::nlm` with rstan's measured analytic-gradient callback shape, lazy forwarded
  objective arguments, supplied or finite-difference derivatives, bounded BFGS line search, optional
  Hessians, convergence codes, and explicit parameter/objective/control boundaries.
- Usage-ranked `stats::optim` with rstan's measured separate objective/gradient BFGS call, lazy
  forwarded arguments, named and scaled parameters, numerical-gradient fallback, optional Hessians,
  function/gradient counts, maximization scaling, and explicit unsupported-method boundaries.
- Usage-ranked `graphics::pairs` S3 dispatch for rstan's measured `pairs.stanfit` call shape,
  including lazy labels, panels, parameter selection, condition, and graphical dots, with an
  explicit boundary before the full default scatterplot-matrix device.
- Usage-ranked `stats::update` S3 dispatch for zoo's measured lattice call shape, including lazy
  dots, inherited method lookup, `NextMethod`, direct and namespace-qualified access, and
  independently authored default methods. The built-in stored-call rewriting and re-evaluation
  default remains an explicit boundary.
- Usage-ranked `grDevices::heat.colors` with the measured sequential palette shape, exact
  red-to-yellow/pale-yellow hexadecimal generation, optional alpha, reversal, numeric count
  coercion, empty outputs, and explicit invalid-input boundaries.
- Usage-ranked `grDevices::rainbow` plus the adjacent `terrain.colors`, `topo.colors`, and
  `cm.colors` classic HSV family, with byte-exact RGB(A), hue wrapping, vector recycling, optional
  alpha, reversal, count coercion, empty outputs, namespace access, pure-R package execution, and
  GNU R 4.6 differential evidence.
- Usage-ranked `graphics::rect` with sass and zoo's measured vectorized calls, coordinate-only
  recycling, missing/non-finite omission, transparent/palette fill and border resolution, `par()`
  line defaults, exact formals and visibility, bounded polygon journaling, record/replay, pure-R
  package execution, Worker transport, and Playground Canvas rendering.
- Usage-ranked `base::file.remove` for xfun and data.table's measured cleanup calls, including
  visible per-path logical results, per-failure warnings, attribute removal, later-argument atomic
  coercion, validation before mutation, package-namespace and Worker execution, and resource bounds.
  Only closed mutable session files are removed; open connections, directories, immutable resources,
  wildcard literals, and host paths remain protected.
- Usage-ranked `base::readChar` for digest and Shiny's measured fixed-width file reads, including
  raw vectors, package/session paths, file/URL/gzip connections, UTF-8 character and exact-byte
  counts, vector lengths, EOF/zero fields, cursor/lifecycle behavior, text-mode warnings, invalid
  NUL/UTF-8 input, exact formals, pure-R package and Worker execution, and resource bounds.
- Usage-ranked `base::debug` and `base::undebug` for R6's measured generator/instance-method calls,
  together with `debugonce` and `isdebugged`: object-identity state shared by closure aliases,
  persistent and one-shot marks, invisible returns and warnings, string lookup, ordinary and package
  closures, primitive functions, non-interactive tracing, and Worker-safe
  `next`/`continue`/`finish`/`Q` commands through the explicit readline host capability.
- Usage-ranked `grDevices::pdf` for knitr's recording-only and data.table's file-backed calls:
  invisible device opening, `pdf(NULL)` plus `recordPlot`, valid browser-native PDF object/xref
  structure, base-14 fonts, metadata, alpha graphics states, optional Flate compression, one-file
  multi-page and numbered single-page output, virtual-file lifecycle, raw reads, and Worker proof.
- Usage-ranked `base::file.create` for withr's measured deferred-cleanup setup: zero-byte creation
  and truncation, exact dots/`showWarnings` matching, first-character and later-atomic coercion,
  vectorized visible results, silent missing values, bounded per-path warnings, preflight before
  mutation, pure-R package execution, Worker transport, and resource limits.
- Usage-ranked `base::file.copy` for xfun's measured immutable-resource staging path: exact text and
  binary bytes, vector targets, existing-directory basename expansion, overwrite, recursive session
  trees including dotfiles, GNU R-shaped lazy/formal/result behavior, unchanged package execution,
  Worker proof, and file-count/storage limits.
- Usage-ranked `base::find.package` for xfun's measured package-root lookup: GNU R-shaped formals,
  search order, vector results, missing/quiet behavior, library selection, registered `datasets`,
  immutable core/bundle directories, unchanged package self-discovery, directory enumeration,
  conformance, and Worker proof.
- Usage-ranked `base::l10n_info` for xfun's measured native-encoding check: GNU R-shaped names,
  list/scalar types, visibility, null formals, platform suffix validation, browser-owned UTF-8
  `codeset`, unchanged package helper, conformance, and Worker proof.
- Usage-ranked `base::shQuote` for xfun's measured shell-argument preparation: ordinary closure
  metadata, documented non-Windows default, all four explicit quote modes, partial selection,
  coercion/S3 behavior, missingness, unchanged package helper, conformance, and Worker proof.
- Usage-ranked `base::system2` for xfun's measured portable command path: exact closure formals,
  argument/environment coercion, separate stream redirection intent, capture/status/visibility,
  request/result resource bounds, unchanged package namespace execution, protocol validation, and
  default-Worker Playground proof through an explicit allow-list handler.
- Usage-ranked `grDevices::gray`/`grey` and `gray.colors`/`grey.colors` with zoo's two measured
  calls, byte-exact RGB(A) output, documented gamma correction, alpha recycling, reversal,
  descending endpoints, alias behavior, atomic gray-level coercion, attribute removal, and bounded
  result allocation.
- Usage-ranked `factorial` with xfun's measured scalar call, direct finite integer products, an
  independent Lanczos gamma path for fractional/negative non-poles, vector attributes,
  missing/non-finite behavior, overflow, and domain warnings.
- Usage-ranked `stats::lsfit` with xfun's measured direct-fit call, vector/matrix predictors,
  optional weights, intercept and tolerance controls, complete-case omission, coefficients,
  residuals, and a classed bounded QR result from the existing owned least-squares solver.
- Usage-ranked `strwrap` with xfun's measured repeated-text example, vectorized paragraph
  boundaries, sentence spacing, width/indent/prefix controls, atomic coercion, and simplified or
  list-shaped results.
- Usage-ranked `grDevices::col2rgb` with stringr's measured named-color replacement helper and the
  earlier rank-207 `rgb` dependency, complete catalog/hex/alpha/transparent inputs, numeric palette
  indices, named matrix output, recycled intensity channels, and reverse hexadecimal formatting.
- Usage-ranked `simplify2array` with stringi's measured equal- and unequal-length list examples,
  scalar/vector simplification, common-type promotion, list matrices, names and higher-dimensional
  metadata, exception lengths, and bounded input validation.
- Usage-ranked `str2expression` and `str2lang` over the existing browser-native parser, producing
  owned expression/language/symbol/atomic values for backports' measured source strings, comments,
  blank lines, missing text, and invalid type/result-length boundaries.
- Usage-ranked `utils::URLdecode` with backports' measured direct percent-decoding call, vectorized
  ASCII/UTF-8 byte handling, missing/empty/NULL inputs, attribute dropping, and explicit malformed
  percent/invalid browser-string byte boundaries.
- Usage-ranked `utils::glob2rx` with rprojroot's measured DESCRIPTION-file pattern, vectorized
  wildcard translation, documented head/tail trimming, atomic/list/language coercion, attribute
  dropping, namespace access, scalar control validation, and output-budget enforcement.
- Usage-ranked `sQuote` with httr's two measured request-URL logging calls, deterministic C-locale
  defaults, UTF-8/TeX/custom quote styles, resettable `useFancyQuotes`, owned-value coercion,
  attribute removal, missing/NULL behavior, and output-budget enforcement.
- Usage-ranked `stats::family` generic for distributional's measured `family(dist)` call shape, with
  lazy dots, ordered class and `NextMethod` dispatch, user-defined default methods, namespace
  access, visibility, and explicit package-owned-method boundaries.
- Usage-ranked `utils::View` for rstudioapi's measured terminal-context display shape, with owned
  data-frame coercion, custom `as.data.frame` dispatch, bounded character-formatted tabular events,
  inline/Worker callbacks, and a read-only Playground renderer.
- Usage-ranked `utils::browseURL` for eight measured xfun/htmltools/knitr/httpuv calls, with GNU
  R-function dispatch and suppression, bounded virtual-file snapshots, inert URL requests,
  transferable Worker results, `onBrowse`, and a user-clicked scheme-filtering Playground viewer.
- Usage-ranked `path.expand` for diffobj's measured home-path expression, with an explicit
  browser-unknown-home identity contract, plus vectorized `file.path` construction covering its
  higher-reach dependency without host filesystem access.
- Usage-ranked `methods::setOldClass` for diffobj's measured `zulu` guides-method registration, with
  evaluator-session old-class metadata, inherited single-object S4 dispatch, inherited `setAs`
  lookup, invisible registration, and explicit unsupported bridge boundaries.
- Usage-ranked `methods::show` for diffobj's measured style-display example, with session-registered
  S4/old-class method dispatch, inherited lookup, exact method-result visibility, bounded output,
  and a deterministic default display for owned values.
- Usage-ranked `warningCondition` with backports' measured custom-condition construction, GNU
  R-shaped message/call/additional fields, ordered custom condition classes, vector messages,
  condition-message extraction, and the measured class-selective suppression call shape.
- Usage-ranked `stats::qbinom` and `stats::qnorm` with openssl's measured distribution-transform
  examples, vectorized/recycled parameters, lower/upper and ordinary/log tail probabilities,
  longest-input metadata, missing/NaN handling, and explicit browser numeric-size boundaries.
- Usage-ranked `rawToBits` with openssl's measured random-byte-to-logical-bit conversion,
  least-significant-bit-first byte expansion, attribute removal, empty inputs, and strict raw input
  validation.
- Usage-ranked `rowMeans` and `colMeans` with matrixStats' measured matrix-subset validations,
  generalized array `dims`, numeric data frames, real/complex missing-value removal, surviving axis
  names, automatic-versus-explicit data-frame row-name behavior, and empty reductions.
- Usage-ranked `stats::weighted.mean` generic and numeric default with matrixStats' six measured
  reference comparisons, equal/biased/infinite/zero weights, numeric and complex accumulation,
  zero-weight omission, missing-value rules, attribute removal, and custom S3 dispatch.
- Usage-ranked `stats::mad` with matrixStats' two measured reference values, explicit/default
  centers, scale constants, ordinary/low/high even-sample medians, missing-value removal, empty
  inputs, scalar attribute removal, and strict real-numeric boundaries.
- Usage-ranked `stats::rbeta` with loo's two measured central-beta posterior draws, vectorized shape
  and optional non-centrality parameters, session-local reproducibility, stable log-gamma ratios,
  zero/infinite limit distributions, output-length rules, and GNU R-shaped invalid-input results.
- Usage-ranked `stats::dbinom` with loo's measured vectorized posterior log-likelihood, recycled
  quantile/size/probability vectors, stable large-size log probabilities, longest-input metadata,
  boundary masses, missing/NaN distinctions, and non-integer/domain warnings.
- Usage-ranked `base::mat.or.vec` with loo's measured 10-by-3 zero-matrix allocation, double vector
  output when `nc == 1`, column-major matrix metadata otherwise, truncated nonnegative extents,
  zero-sized dimensions, dropped input attributes, and explicit branch/extent errors.
- Usage-ranked primitive `base::seq.int` with data.table's three measured rolling-window index
  calls, scalar and length-based one-argument behavior, ascending/descending numeric steps,
  `length.out`/`along.with`, integer-versus-double storage, custom `seq` S3 dispatch, and finite
  resource bounds.
- Usage-ranked `methods::as` and `methods::setAs` with data.table's measured package-defined IDate
  and ITime coercion shapes, session-local source/target registration, inherited source classes,
  core constructor fallback, identity conversions, namespace lookup, invisible registration, and
  bounded error behavior.
- Usage-ranked `weekdays`, `weekdays.Date`, and `weekdays.POSIXt` with data.table's two measured
  IDate grouping-label calls, inherited Date dispatch, deterministic C-locale full/abbreviated
  names, recycled abbreviation flags, UTC/GMT date-time handling, names, missing/non-finite values,
  and custom S3/error boundaries.
- Usage-ranked `anyDuplicated`, `anyDuplicated.default`, and `anyDuplicated.data.frame` with
  data.table's measured two-column duplicate-row query, package-defined S3 forwarding, first and
  reverse positions, atomic/list/frame equality, factors, missing values, incomparables, and bounded
  controls.
- Usage-ranked `rep.int` with data.table's measured adaptive-window tail construction,
  scalar/per-element truncated counts, coercible count vectors, typed atomic/list/factor/expression
  results, attribute removal, factor metadata, custom internal-S3 dispatch, and allocation guards.
- Usage-ranked `methods::representation` with data.table's measured legacy S4 slot declaration,
  ordered unnamed parent and named slot entries, plain-list output, empty/missing class strings,
  backtick slot names, duplicate detection, strict scalar-character validation, and bounded
  `setClass`/`new` integration.
- Usage-ranked `methods::showClass` with Rcpp/rstan's four measured class-inspection calls, GNU
  R-shaped class location, direct/inherited slots, parent classes, known subclasses, virtual
  classes, configurable property label, exact formals, invisible `NULL`, and source-only package
  namespace reuse. This is registered-class introspection, not complete S4 metadata or validation.
- Usage-ranked `trunc` with data.table's measured ITime hour-truncation method seam, direct and
  Math-group S3 dispatch, toward-zero real-vector behavior, logical/integer double output, signed
  zero, missing/non-finite values, retained attributes, eager default dots, and bounded invalid
  types.
- Usage-ranked `utils::type.convert` default/list/data-frame methods with data.table's measured
  split-field conversion, logical/integer/double/complex inference, character/factor fallback,
  missing strings and blank fields, decimal controls, integral-double narrowing, matrix shape,
  recursive containers, custom dispatch, and bounded validation.
- Usage-ranked `withVisible` with Shiny's two measured stack-trace calls, exact named result shape,
  single evaluation, nested and dynamic visibility, lazy closure/ellipsis forwarding, and the
  already-forced promise boundary.
- Usage-ranked `strftime` with Shiny's measured log timestamp, recycled UTC/GMT values and formats,
  deterministic C-locale calendar/clock/week/epoch/timezone tokens, fractional seconds, names,
  non-finite values, timezone labels, custom `as.POSIXlt` dispatch, and bounded errors.
- Truncating factor-pattern generation through `gl` and bounded atomic-column data-frame `merge`
  joins with default or explicit keys, duplicate-key expansion, missing-key matching, outer joins,
  sorting, suffixes, and zero-key Cartesian products.
- List/data-frame `within` mutation with lexical fallback, GNU R column ordering and type-specific
  NULL handling, plus metadata-preserving real/complex `sin` with missingness and domain warnings.
- Numeric-order `as.factor` coercion with existing-factor identity, plus grouped `ave`
  transformations with multiple grouping vectors, missing-group retention, callable lookup, and
  type-preserving group replacement.
- Vectorized UTC/GMT `ISOdate` and usage-ranked `ISOdatetime` construction with component recycling,
  fractional seconds, class/time-zone metadata, invalid-date missingness, required `ISOdatetime`
  clock fields, and a deterministic browser UTC interpretation of empty `tz`, plus bounded atomic
  `expand.grid` Cartesian data frames with factor controls, list inputs, zero-length shapes, and
  optional output-dimension metadata.
- Type-promoting `append` insertion across atomic, list, factor, pairlist, expression, and matrix
  shapes, plus metadata-preserving real/complex `cos` with missingness and domain warnings.
- Browser-native clockwise `chull` boundary indices across paired/recycled coordinates, matrices,
  data frames, complex vectors, degenerate inputs, duplicates, and finite-coordinate validation.
- Session-local `jitter` perturbation with documented automatic/explicit scales, lazy factor
  handling, constant and non-finite inputs, deterministic seeding, and metadata preservation.
- Caller-aware `match.arg` normalization with exact/partial matching, several-choice filtering,
  atomic choice types/names, NULL, and owned formal-default evaluation.
- Stable `qlogis` logistic quantiles with ordinary/log probabilities, lower/upper tails,
  location/scale recycling, boundary infinities, domain warnings, and metadata retention.
- Column-wise `scale` standardization for numeric vectors, matrices, and data frames with
  logical/explicit controls, missing and degenerate columns, matrix metadata, scaled-statistic
  attributes, and custom S3 dispatch.
- Usage-ranked linear-model infrastructure with normalized formula/data model frames, browser-native
  least squares, numeric/logical/factor/character predictors, treatment contrasts, interactions, dot
  expansion, missing-row omission, subsets, weights, offsets, singular fits, `lm`/`aov` object
  shapes, model matrices, prediction, and S3-aware coefficient/fitted/residual accessors.
- `IQR` and `quantile` types 1 through 9 with atomic coercion, missing-value controls, empty,
  degenerate, and non-finite inputs, and GNU R-compatible attribute removal.
- Usage-ranked `stats::ppoints` for posterior's two measured quantile-grid examples, with documented
  default offsets, scalar or observation-vector point counts, fractional endpoints, numeric/complex
  offsets, recycling warnings, attributes, missingness, lazy nonpositive results, namespace access,
  and bounded allocations.
- Usage-ranked `base::chol`/`chol.default` for posterior's measured `rvar` S3 method seam and owned
  real-matrix upper Cholesky factors, including scalar/data-frame inputs, upper-only source
  semantics, dimnames, positive-semidefinite pivot/rank metadata, warnings, lazy dots, forced
  tolerance, defunct `LINPACK`, and bounded shape/type failures.
- Usage-ranked `stats::pnorm` for posterior's measured vectorized-mean probability example, with
  recycled numeric arguments, lower/upper and ordinary/log tails, longest-input attributes,
  point-mass limits, missing/domain warnings, and an owned far-log-tail expansion.
- Usage-ranked `stats::rgamma` for posterior's measured scalar shape/rate examples, with
  result-length semantics, recycled shape and rate/scale vectors, deterministic session reseeding,
  moment evidence, degenerate limits, missing/domain warnings, and explicit dual-parameter checks.
- Usage-ranked `stats::rlnorm` for zoo's measured 200-value flow generator, with historical
  Mersenne-Twister/Inversion fixed-seed values, scalar/vector result lengths, recycled
  `meanlog`/`sdlog`, zero-deviation point masses without RNG advancement, empty and non-finite
  parameter behavior, one aggregate warning, namespace access, and bounded allocation.
- Usage-ranked `stats::rcauchy` for ggplot2, pillar, and purrr's measured random-vector shapes,
  together with `dcauchy`/`pcauchy`/`qcauchy`; vectorized locations/scales, stable ordinary/log
  tails, zero-scale behavior, fixed-seed uniform consumption, missing/domain warnings, formals,
  metadata, namespace access, and resource limits have GNU R 4.6 evidence.
- Usage-ranked `base::tapply` for zoo's measured screen-range callback, with one or more atomic
  grouping vectors, factor-level dimensions/dimnames, missing-group omission, scalar/default
  simplification, list-array results and extraction, forwarded arguments, function names,
  `FUN = NULL` group codes, errors, and bounded allocation.
- Browser-native central Student-t `pt`/`qt` with recycled degrees of freedom, ordinary/log lower
  and upper tails, boundaries, missingness, warnings, and first-longest-input metadata.
- Weighted QR covariance and model inference through `vcov`, usage-ranked `confint`, and
  `df.residual`, including singular fits, parameter selection, model-frame-free fit objects,
  perfect-fit warnings, matrix dimnames, and custom S3 dispatch.
- Usage-ranked `kmeans` clustering for finite numeric vectors, matrices, and numeric data frames,
  with explicit or deterministic session-random starts, `nstart` selection, four documented
  algorithm choices, standard metrics/object fields, metadata, convergence warnings, and errors.
- Usage-ranked `convolve` across circular, open, and filter modes with real/logical/complex input
  behavior, conjugation, matrix-shaped circular indexing, names and attributes, NA/NaN propagation,
  factor warnings, and direct plus radix-2/Bluestein large-vector paths.
- Usage-ranked `as.hexmode` construction from validated integer, integral-double, and hexadecimal
  character inputs, with signed 32-bit string/format behavior, names and matrix metadata,
  class-preserving selection, browser-safe printing, and `!`/`&`/`|` bitwise methods.
- Usage-ranked environment-to-list conversion with S3 dispatch, local-only binding enumeration,
  hidden-name and ordering controls, hash-aware unsorted order, empty-list attributes, and
  result-ordered lazy-promise forcing.
- Usage-ranked browser capability reporting with GNU R's complete 19-name logical-vector shape,
  exact known-name selection, lazy `Xchk`, and explicit false results for unavailable graphics,
  profiling, network, locale, and native host facilities.
- Usage-ranked `kappa` condition numbers with independently implemented Householder QR, 1-norm
  triangular estimation, exact 2-norm singular-value ratios, direct inversion, triangular controls,
  and `qr`/`lm` S3 dispatch.
- Usage-ranked `xtabs` formula cross-tabulation with factor/character/numeric axes, weighted and
  matrix responses, subsets, missing-value controls, unused-level handling, and table metadata.
- Usage-ranked `RNGkind` session control with query/set visibility, partial/default selection,
  independently implemented default Mersenne-Twister uniform and Inversion normal generation,
  Rounding/Rejection discrete samplers, explicit unsupported alternate-engine boundaries, and
  black-box fixed-seed sequence evidence.
- Usage-ranked `sample.int` with the observed `withr` seed-generation shape, the R 4.6 x64
  `.Machine` constant list, fixed-seed replacement/no-replacement and hash paths, weighted sampling,
  large double-valued populations, and exact GNU R black-box evidence.
- Usage-ranked locale inspection and mutation through evaluator-owned `Sys.getlocale`,
  `Sys.setlocale`, `.LC.categories`, and `Sys.localeconv`, including the deterministic C profile and
  `it_IT`/`en_US` monetary conventions observed in `withr`.
- Usage-ranked `tan` with the base `pi` binding required by the measured `testthat` and `data.table`
  expressions, plus real/complex vectorization, metadata, missingness, non-finite limits, and GNU
  R-differential warning evidence.
- Usage-ranked `make.names` with deterministic C-locale syntactic repair, reserved words,
  underscores, coercion, legal-name-first uniqueness, and the measured tibble one-sided-formula
  `.name_repair` callback.
- Usage-ranked `start` with unclassed row origins, regular-time-series period/cycle coordinates,
  decimal off-grid fallbacks, negative periods, configurable `ts.eps`, and S3 method dispatch for
  package-owned object methods.
- Usage-ranked `as.roman` with the measured pillar `utils::` row-identifier path, integer-backed
  Roman values, 1-through-4999 range handling, canonical and documented historical parsing,
  character/width formatting, warnings, idempotence, and matrix metadata.
- Usage-ranked `as.POSIXlt` with testthat's measured construction/length path, zoo's measured
  month-day extraction, an owned 11-component UTC/GMT representation, Date/POSIXct/numeric/character
  inputs, fractional and missing seconds, POSIXlt attributes, and S3 method dispatch.
- Usage-ranked `drop` with four measured matrixStats validations and posterior's measured explicit
  rvar-array reduction, singleton-axis removal, adjusted named dimension axes, scalar/vector naming
  rules, zero-length axes, and custom class/attribute preservation.
- Usage-ranked `rasterImage` with the measured systemfonts native-raster and httr RGB(A)-array
  shapes, scalar/vector placement recycling, rotation/interpolation fields, grayscale/color
  matrices, browser-safe graphics state, and pixel-checked Worker/Canvas coverage.
- Usage-ranked `weights` with the 22 measured loo/posterior S3 call shapes, an independent
  `stats::weights` generic, exact and unique-partial default component lookup, lazy dots,
  `na.exclude` restoration, and weighted/unweighted `lm` access without reproducing package-owned
  method algorithms.
- Usage-ranked `colors`/`colours` with scales' measured default call, the complete ordered 657-name
  GNU R 4.6.0 public catalog, the 502-name `distinct = TRUE` subset, true function aliases, and
  registered `grDevices::` access.
- Usage-ranked `outer` with scales' measured radial-matrix expression, vector/array Cartesian
  products, concatenated dimensions and dimension names, callable or character `FUN`, lazy forwarded
  dots, and the `%o%` operator.
- Usage-ranked `nzchar` with data.table's captured-group conversion and Shiny's input-name guard,
  atomic and bounded recursive coercion, `keepNA`, primitive argument boundaries, zero-length
  values, and attribute-free logical results.
- Usage-ranked `stats::density` dispatch for posterior's and distributional's 94 measured S3 calls,
  plus a bounded independent Gaussian `density.default` with direct grids, weights, `nrd0`,
  missing-value removal, and density-object shape.
- Usage-ranked `setequal` with dplyr's two measured data-frame row-set comparisons, non-dropping
  tibble row selection, and GNU R-shaped atomic, factor, list, NULL, common-type, duplicate, NA, and
  NaN equality.
- Usage-ranked `eigen` with jsonlite's measured random 3-by-3 result shape, arbitrary-order real
  symmetric Jacobi eigenpairs, bounded one- through three-dimensional real asymmetric eigenpairs,
  normalized real/complex vectors, and `only.values`.
- Usage-ranked `colSums` with loo's two measured integer fold-table totals and zoo's measured
  logical non-missing-column selection, plus numeric/complex arrays, numeric data frames, `na.rm`,
  generalized dimensions, empty reductions, and result names/dimnames.
- Usage-ranked `time` with data.table's measured decade-spaced `uspop` years, the S3 generic
  boundary for zoo's 24 package-owned index calls, vector/matrix defaults, regular-series offsets,
  `ts.eps` snapping, and `tsp`/`ts` result metadata.
- Usage-ranked `na.omit` with the S3 method boundary for data.table's four and zoo's four measured
  calls, plus independent atomic, factor, matrix, data-frame, and regular-time-series defaults,
  `NA`/`NaN` incomplete-case detection, classed `na.action` metadata, and retained row shape.
- Usage-ranked `stats::approx` with both measured data.table/zoo calls, independent interpolation,
  ordinary plotting-coordinate inputs, output-grid and boundary controls, missing values, ties, Date
  metadata, and explicit unsupported coercion boundaries.
- Usage-ranked `standardGeneric` with S7's measured S4 generic declaration, explicit and `ANY`
  methods, argument/default/dots forwarding, and bounded missing-method/out-of-context behavior.
- Usage-ranked `graphics::title()` with all seven measured Shiny/bit64 calls, active `par()` title
  styles, annotation/list coercion, Worker text events, browser and PNG/PDF rendering, display-list
  replay, and an unchanged source-only package import/call path.
- Reproducible top-100 CRAN usage snapshot, feature and core-callable CSV tables, three checked-in
  SVG figures, and one executable acceptance case for every measured feature group.
- Clean-room policy, CSP/browser bundle guards, bundle budgets, conformance, package smoke tests,
  browser tests, Changesets, and CI.

## Current executable evidence

- The feature-priority acceptance matrix covers exactly 25 measured groups and every detector
  operator/function surface.
- Vitest currently passes 14 files and 475 tests; one opt-in file with four external-package tests
  is skipped in the default run and passes when enabled.
- `pnpm research:usage:check` validates the committed snapshot, CSV tables, and three SVG figures.
- `pnpm capabilities:check` validates the generated capability manifest against runtime source.
- Checked-in conformance passes 847/847 cases. The optional black-box R oracle passes all 806
  eligible cases and explicitly skips 41 NativR-owned
  representation/random/platform/graphics/unsupported-boundary cases.
- Chromium Worker/playground coverage passes 2/2 tests, including the source-only package bundle,
  expanded matrix, weighted sampling, S3, and R6 paths with no evaluation-time network requests.
- Package and playground production builds, browser audit, bundle budgets, and the packed clean
  consumer build pass.

The supported toolchain is Node 24 and pnpm 11. Local R, when installed, is used only as an optional
black-box conformance oracle.
