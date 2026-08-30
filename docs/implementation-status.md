# Implementation status

Date: 2026-08-10

## Implemented

- Node 24/pnpm 11 monorepo, strict TypeScript, ESM browser packages, and cross-platform scripts.
- Reproducible Tree-sitter R Wasm build, normalized NativR AST, Unicode spans, and diagnostics.
- Typed logical/integer/double/complex/raw vectors with separate NA masks where applicable, lists,
  attributes, matrices/arrays, factors, frames, formulas, environments, closures, lazy promises,
  ellipsis, and resource limits.
- JavaScript reference operators with recycling warnings, comparison/logical semantics, control
  flow, rightward/non-local assignment, direct replacement-function assignment, simple nested
  subset/member replacement chains and GNU R argument matching. Registered-binding totals are
  generated in [`compatibility/status.json`](../compatibility/status.json), not maintained in prose.
  Supported arithmetic, comparison, logical, sequence, and matching operators are also first-class
  builtin bindings.
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
  `withr 3.0.3`, `R6 2.6.1`, `viridisLite 0.4.3`, `RColorBrewer 1.1-3`, `labeling 0.4.3`,
  `assertthat 0.2.1`, `crayon 1.5.3`, `praise 1.0.0`, `prettyunits 1.2.0`, `evaluate 1.0.5`,
  `numDeriv 2016.8-1.1`, `abind 1.4-8`, `rprojroot 2.1.1`, `rstudioapi 0.19.0`, `inline 0.3.21`,
  `rematch 2.0.0`, `whisker 0.4.1`, `zeallot 0.2.0`, and `ini 0.3.1`. Completed tiers and blockers
  are generated from the package corpus rather than collapsed into a supported/unsupported label.
  Unchanged generics and withr now reach P5 through all applicable Rd topics. Withr's unchanged
  `defer` example now completes through closure-headed calls, target-frame cleanup, scoped `local`,
  call/frame pairlists, reachability-based `reg.finalizer`, and reverse-order cleanup. Its
  provenance-audited browser resources let unchanged `with_par` and `with_tempfile` complete through
  ordinary `datasets::mtcars` and `datasets::iris` bindings; versioned Marsaglia-Multicarry sampling
  closes `with_rng_version`. Historical Buggy Kinderman-Ramage normal draws now reproduce fixed-seed
  pre-1.7 streams across every algorithm region. Withr's opt-in artifact also retains its unchanged
  top-level `testthat.R` driver; deterministic source preflight identifies the missing,
  native-compilation testthat dependency as its first P6 blocker, so no package-local test shim is
  introduced. The latest proofs cover package-owned S3 dispatch, a generated `with_options()`
  wrapper using call/formal/environment replacement, `bquote`, dynamic caller frames, hooks, and
  state restoration, plus `with_envvar()` mutation and cleanup through session-owned environment
  variables, plus unchanged R6 generator construction, object instantiation, public/private method
  calls, reference field mutation, and an active read/write field, plus shallow and recursive deep
  cloning of nested R6 objects, without translating or patching package code. The same unchanged
  package now constructs a three-level hierarchy and executes recursive
  `super$initialize()`/`super$greet()` paths with inherited fields, methods, and class membership.
  R6 reaches P5 by executing both unchanged official `R6Class` Rd example blocks through the generic
  package example pipeline, with GNU R-matching result visibility and console output. Unchanged
  viridisLite loads its package-owned 256-anchor map and executes Viridis, Magma, and reversed
  translucent palettes through generic Lab spline and matrix arithmetic; its unchanged example
  manifest deterministically identifies missing `ggplot2` as its first P5 blocker. Unchanged
  RColorBrewer reaches P5: its sole installed Rd topic executes without rewriting after shared
  `plot.default(bty=)` and ASCII-space-insensitive named-color semantics close the observed gaps. It
  constructs its exported 35-row palette metadata with explicit row names, then executes exact
  Set1/Blues palettes and the recursive minimum-size warning path. Unchanged labeling reaches P5
  across all nine labeling algorithms and the unchanged `extended.figures(2)` path. That deeper
  proof exercises shared parallel extrema, histogram and barplot graphics, `xaxt`/`yaxt`
  suppression, the 72-entry `par()` inventory, read-only restoration warnings, and axis shared
  controls under an explicit bounded output budget. The third blind rotation carries unchanged
  evaluate through its public handler/predicate APIs. Unchanged numDeriv now reaches P6 through all
  four Rd topics and seven original package tests using the generic opt-in test-resource manifest;
  that proof closes reusable `NULL` subscript, `diag<-`, browser-safe `Sys.info()`, complex integer
  power, and inverse-trigonometric gaps and uses explicit finite limits for its large CSD workload.
  Unchanged abind now reaches P6 through all five Rd topics and five original package tests. That
  proof adds reusable call/expression entry manipulation, replacement-call introspection, pairlist
  apply-family inputs, standard constants and `prod`, matrix/data-frame coercion, array/default
  metadata, and short-name replacement semantics; its large array script uses explicit finite
  limits. The fourth blind rotation originally admitted abind at P4 and carries unchanged rprojroot
  through S3 criterion composition plus virtual-filesystem root discovery. The fifth blind rotation
  carries unchanged rstudioapi through document-position/range construction and outside-RStudio
  availability checks, and unchanged inline through plugin registration/query. The sixth blind
  rotation carries unchanged rematch through public match/extract shapes and unchanged whisker
  through scalar, section, inverted, escaped, and triple-brace rendering. Its reusable increment
  covers row/column dimensions and names, regex/replacement/splitting boundaries, apply-family
  argument matching, factor-label comparisons, and list-valued atomic replacement promotion. Native
  compilation remains outside P4 evidence. The seventh blind rotation carries unchanged zeallot
  through nested/collector/default/named/rightward/data-frame/S3 destructuring and unchanged ini
  through browser-owned parsing and serialization. Its reusable increment covers constructed
  assignment, promise-origin caller frames, embedded runtime constants, recursive character
  coercion, string affixes, capture locations, and language equality. The eighth blind rotation
  carries unchanged cpp11 through immutable header vendoring and unchanged otel through no-op
  tracing, metrics, logging, and HTTP-context paths. A later example-depth audit executes cpp11's
  unchanged `cpp_vendor` topic, adds generic DCF parsing, and freezes the two compilation topics at
  their explicit missing dependency closures; cpp11 remains P4. Its reusable increment separates
  source/resource budgets and adds list-aware `sprintf`, `strrep`, `length<-`, `anyNA`, and
  `make.unique`. A subsequent otel depth audit executes all 45 frozen installed Rd topics unchanged
  after shared `is.finite`, `sys.nframe`, `topenv`, and reset-safe `.GlobalEnv` semantics, advancing
  otel to P5 without enabling telemetry exporters. The ninth blind rotation carries unchanged BH to
  P3 with 12,554 exact header resources, zero namespace exports, package loading, and attachment.
  Generic work adds standard `exportPattern`, a configurable 192 MiB default package-resource
  budget, facade/host double validation, and prompt archive-limit failure. BH has no R functions, so
  P4 is not applicable. No untouched eligible candidate remains in the committed top-100 snapshot;
  cpp11/BH downstream native compilation remains future Wasm-ABI work. The twenty-second
  package-depth audit advances unchanged pkgconfig and crayon to P5. Pkgconfig's frozen four-topic
  help catalog has an explicitly empty applicable-example set; all 19 crayon Rd topics execute
  unchanged after reusable full-signature `nchar`, bind dimnames/deparse labels, named `which*`
  results, structural comparison attributes, and callable builtin attributes close the observed
  gaps. No package-name runtime branch or rewritten package source is introduced. The twenty-third
  package-depth audit advances unchanged assertthat and praise to P5. All 11 assertthat topics and
  praise's sole topic execute unchanged after reusable `is.primitive`, explicit `match.call`,
  partial `all.equal` controls, class-preserving conditions, and virtual `file.access` semantics
  close the observed gaps. The permission path remains browser-owned and does not consult the host
  filesystem.

  The twenty-fourth package-depth audit advances unchanged prettyunits to P5. All eight frozen Rd
  topics execute unchanged after shared `units`/`units<-` difftime rescaling, primitive
  `is.infinite`, and browser-owned `formatC` semantics close the observed blockers.

  The twenty-fifth package-depth audit advances unchanged evaluate to P5. All six frozen Rd topics
  execute unchanged after shared calling-handler/restart, cooperative-interrupt, hook,
  source-reference, recursive-unlist, expression/data-frame, sequence, and recorded-plot semantics
  close the observed blockers. Its system query is admitted only through the explicit generic host
  adapter; default sessions retain no process authority.

  The twenty-sixth package-depth audit advances unchanged rprojroot, rstudioapi, rematch, whisker,
  zeallot, and ini to P5. Every runnable block across their exact 5-, 29-, 1-, 4-, 3-, and 2-topic
  installed help manifests executes unchanged. Provenance-audited `InsectSprays` and `faithful`
  resources use the generic core-package path; RStudio host behavior remains deterministically
  unavailable by default.

  The recursive function-introspection increment corrects symbol, atomic, NULL, call, and block
  `body()` values plus empty `formals()`. Oracle v2 now observes closure captures and environment
  graphs through seven exact cases associated with 19 validated behavioral registry bindings.

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
- `utils::demo()` returns GNU R-shaped empty or populated `packageIQR` catalogs and discovers and
  executes `demo/*.R` only from installed browser-owned package resources. Optional `00Index`
  titles, package attachment, declared encoding, echo control, and deterministic missing-package /
  missing-topic failures are covered; host R libraries and ambient I/O remain unavailable.
- Usage-ranked `utils::example()` discovers deterministic build-time extractions of package
  `man/*.Rd`, loads the selected source-only bundle, returns prepared lines or evaluates them in a
  global/fresh environment, and respects `run.dontrun` / `run.donttest`. Interactive HTML/prompting,
  exact source/echo formatting, `setRNG`, and abort recovery remain depth boundaries.
- `RNGversion()` selects the versioned Wichmann-Hill or Marsaglia-Multicarry historical uniform
  defaults before R 1.7, Mersenne-Twister/Inversion/Rounding through R 3.5, and current Rejection
  defaults for R 3.6 or newer. Fixed-seed historical uniform and R 1.6 sampling sequences are
  proven; Buggy Kinderman-Ramage normal draws have fixed-seed black-box evidence across all five
  algorithm regions. Corrected Kinderman-Ramage is also selectable, with fixed-seed stream and
  near-zero rejection-correction evidence.
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
  output accounting, same-session display-list replay, positional formula/data grouping, and
  `axes`/`frame.plot` decoration controls. Broader formula-method controls, logarithmic axes,
  arbitrary `pars`, complete annotation/axis styling, and device-identical layout remain explicit
  boundaries.
- Usage-ranked `graphics::barplot`/`barplot.default` for zoo and bit64's three measured calls,
  including S3 forwarding, vector and matrix inputs, stacked/beside geometry, GNU R-shaped midpoint
  return matrices, widths/spaces/offsets, horizontal layout, names, annotations, legends, additive
  drawing, source-only package reuse, and bounded Worker/Canvas/display-list output over existing
  polygon/axis/text events. Positive density uses the shared clipped hatch protocol. Log axes,
  device-exact hatch phase/layout, and the full graphical-parameter surface remain explicit
  boundaries.
- Usage-ranked `graphics::hist`/`hist.default` for 19 measured testthat, openssl, shiny, and
  posterior calls, including S3 forwarding, finite numeric/matrix inputs, Sturges/Scott/FD or
  numeric/callable breaks, endpoint controls, counts/densities/midpoints, standard histogram
  objects, labels, additive drawing, and bounded Worker/Canvas/PNG/record-replay output over the
  existing polygon journal, including clipped positive-density hatch lines. Exact `pretty()`
  boundaries for every floating-point range, logarithmic axes, device-exact hatch phase, and the
  full graphical-parameter surface remain explicit boundaries.
- Usage-ranked `graphics::persp` for zoo's measured classed `100 × 10` matrix call, including S3
  forwarding, ascending/default grids, missing surface cells, exact scaled/aspect-preserving
  homogeneous view matrices, bounded projected wireframe/box segments, depth-ordered coloured facet
  polygons, default and suppressed borders, invisible results, Worker transport, Canvas and file
  rendering, output accounting, and display-list replay. Lighting, axis arrows/ticks/text, hooks,
  exact intersecting-surface visibility, and arbitrary graphical controls remain explicit
  boundaries.
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
  classes, direct runtime bzip2/xz/zstd, host files, and installed `.rdx`/`.rdb` lazy-load databases
  remain explicit boundaries. The Node-only package tool normalizes bounded bzip2- and xz-wrapped
  package data/sysdata into raw serialization resources before the artifact reaches the browser.
- Usage-ranked `graphics::polygon` for zoo's measured filled-area panel helper, including paired
  vector/matrix/data-frame/list/complex coordinates, missing-coordinate polygon splitting, recycled
  fill/border colors and line types/widths, solid/no-fill/positive-hatch density, recycled angles,
  even-odd rules, invisible returns, bounded Worker transport, clipped Canvas/PNG/PDF rendering,
  output accounting, and display-list replay. Broader coordinate classes, clipping/log axes, exact
  device hatch phase/dash/fill metrics, and arbitrary graphical controls remain explicit boundaries.
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
- `methods::is` class-graph queries and reference-semantic `parent.env<-` replacement with exact
  implicit/explicit/inherited-class and cycle-boundary evidence. Host-oriented `install.packages`,
  `package.skeleton`, and `tar` bindings are present for namespace import compatibility but remain
  inert and fail explicitly when invoked in the browser runtime.
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
  independently implemented Mersenne-Twister, historical uniform, and L'Ecuyer-CMRG generation,
  Inversion/Box-Muller/Kinderman-Ramage normal generation, Rounding/Rejection discrete samplers,
  exact CMRG stream/substream jumps, explicit remaining-engine boundaries, and black-box fixed-seed
  sequence evidence.
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
  plus a bounded independent Gaussian and Epanechnikov `density.default` with direct grids, weights,
  `nrd0`, missing-value removal, kernel roughness, and density-object shape.
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
- Vitest currently passes 14 files and 516 tests; one opt-in file contains 28 external-package tests
  and is skipped in the default run. The source-blind `argparser 0.7.3` test passes independently;
  the complete external-package file must still finish successfully before release evidence can
  claim all 28 together.
- `pnpm research:usage:check` validates the committed snapshot, CSV tables, and three SVG figures.
- `pnpm capabilities:check` validates the generated capability manifest against runtime source.
- Checked-in conformance passes 968/968 cases. The local GNU R 4.6.0 advisory oracle matches 915 of
  919 eligible cases and skips 49 NativR-owned representation/random/platform/graphics/unsupported-
  boundary cases; the four differences assert the pinned 4.6.1 target version itself. The recursive
  oracle-v2 suite passes 10/10 and explicitly covers 27 behavioral registry bindings. Release gating
  still requires GNU R 4.6.1 rather than this advisory installation.
- Chromium, Firefox, and WebKit Worker/playground coverage passes 6/6 tests, including the
  source-only package bundle, expanded matrix, weighted sampling, S3, and R6 paths with no
  evaluation-time network requests.
- Package and playground production builds, browser audit, bundle budgets, and the packed clean
  consumer build pass.

The supported toolchain is Node 24 and pnpm 11. Local R, when installed, is used only as an optional
black-box conformance oracle.

## Profile 0.309 source-blind package evidence

The 26-release corpus now has 22 passing paths, three blocked paths, and one untouched holdout; 24
reach P4 or higher and 21 reach P5 or higher. Unchanged `docopt 0.7.2` installs, loads, attaches,
parses its representative example with GNU-R-matched output, and runs its installed Rd example with
zero warnings. Its source and normalized artifact retain distinct pinned digests. No runtime branch
recognizes `docopt`.

The generic blockers closed by that walk are bounded Reference Class construction and inheritance,
active fields, instance methods and initialization, ordinary S4 `as.character` selection, `is.na<-`,
inline regular-expression modes, match replacement, zero-length `&&`/`||` state, NULL substring
behavior, and list-aware membership/equality. Unsupported Reference Class and `regmatches<-`
surfaces remain explicit rather than being presented as complete GNU R coverage. `getopt 1.21.1` is
frozen as the next source-blind holdout and has not been executed or inspected.

## Profile 0.310 source-blind package evidence

The 27-release corpus now has 23 passing paths, three blocked paths, and one untouched holdout; 25
reach P4 or higher and 22 reach P5 or higher. Unchanged `getopt 1.21.1` installs, loads, attaches,
produces GNU R-matching representative option and usage results, and runs all four applicable
installed Rd examples with zero warnings. Its source and normalized artifact retain distinct pinned
digests. No runtime branch recognizes `getopt`.

The generic blockers closed by that walk are GNU R-shaped `match(..., nomatch=)` coercion,
closure-producing `Negate()`, shared `storage.mode()` query/replacement coercion, and a
deterministic browser `commandArgs()` contract that reports only a virtual `"nativr"` executable and
exposes no ambient host arguments. `optparse 1.8.2` is frozen as the next source-blind holdout and
has not been executed or inspected.

## Profile 0.311 source-blind package evidence

The 28-release corpus now has 24 passing paths, three blocked paths, and one untouched holdout; 26
reach P4 or higher and 23 reach P5 or higher. Unchanged `optparse 1.8.2` installs, loads, attaches,
produces GNU R-matching representative flag, value, and positional results, and executes all four
applicable installed Rd example topics. Its source and normalized artifact retain distinct pinned
digests. No runtime branch recognizes `optparse`.

The generic blockers closed by that walk are `exportClasses()` namespace metadata, `.__C__<Class>`
bindings, exact S4 slot extraction/replacement, `setValidity()`/`validObject()` and
validity-on-construction, package-local replacement-generic binding, and width/label-aware
`cat(fill=)`. Complete S4 slot-type/prototype validation, generated method-table metadata, the
testthat-dependent P6 suite, and P7 remain explicit. `argparser 0.7.3` is frozen as the next
source-blind holdout and has not been executed or inspected.

## Profile 0.312 source-blind package evidence

The 29-release corpus has 25 passing paths, three blocked paths, and one untouched holdout; 27 reach
P4 or higher and 24 reach P5 or higher. Unchanged `argparser 0.7.3` installs, loads, attaches,
matches GNU R on a representative positional/integer-option/flag parser path, and executes all three
applicable installed Rd example topics. Its source and normalized artifact retain distinct pinned
digests. No runtime branch recognizes `argparser`.

The reusable blockers closed by that walk are scalar list/pairlist `as.logical()` coercion and S4
`coerce` method dispatch over both source and requested target signatures. Checked-in differential
evidence is 968/968; the local GNU R 4.6.0 advisory oracle matches 915 of 919 eligible cases, with
only the four pinned 4.6.1 version-field differences; recursive Oracle v2 is 10/10 and associates 27
behavioral bindings. The generated inventory remains 766 registered bindings and 745 GNU R name
overlaps out of 2,522, which are inventory rather than behavioral evidence. `iterators 1.0.14` is
frozen as the next source-blind holdout and has not been inspected or executed.

## Profile 0.313 source-blind package evidence

The 30-release corpus has 26 passing paths, three blocked paths, and one untouched holdout; 28 reach
P4 or higher and 25 reach P5 or higher. Unchanged `iterators 1.0.14` installs, loads, attaches,
matches GNU R on its representative path, and executes all nine applicable installed Rd example
topics. Its source and normalized artifact retain distinct pinned digests. No runtime branch
recognizes `iterators`.

The reusable blockers closed by that walk are caller-environment legacy S3 method discovery,
immutable browser-owned runtime text resources, and GNU R-shaped `levels()`/`nlevels()`. Checked-in
differential evidence is 971/971; the GNU R 4.6.0 advisory oracle matches 917 of 921 eligible cases,
with only the four pinned 4.6.1 version-field differences; recursive Oracle v2 passes all 12 exact
cases and associates 32 behavioral bindings. The generated inventory is 767 registered bindings and
746 GNU R name overlaps out of 2,522, which remain inventory rather than behavioral evidence.
`foreach 1.5.2` and its untouched `codetools 0.2-20` dependency are frozen as the next source-blind
dependency-closure probe.

## Profile 0.314 source-blind package evidence

Profile 0.314 advances unchanged `foreach 1.5.2` and its frozen `codetools 0.2-20` and
`iterators 1.0.14` closure to P5. The first source-blind namespace blocker was the reusable
`compiler::compile` contract. Representative execution then exposed named call-entry preservation
after language subsetting, and the installed examples exposed Base `%*%`. These were implemented as
generic runtime semantics, not package-specific rewrites. Sequential and nested loops match GNU R,
and all four applicable installed Rd example topics execute.

Checked-in evidence is 975/975; the GNU R 4.6.0 advisory oracle matches 921 of 925 eligible cases,
with only the four pinned 4.6.1 version-field differences. Recursive Oracle v2 is 15/15 with 38
associated behavioral bindings, and the generated inventory contains 769 registered bindings with
747 GNU R name overlaps out of 2,522. The 31-release corpus has 27 passing, three blocked, and one
source-blind holdout; 29 reach P4 and 26 reach P5. `doParallel 1.0.17` is the next untouched
dependency-closure holdout.

## Profile 0.315 browser parallel package evidence

Profile 0.315 advances unchanged `doParallel 1.0.17` and its four-artifact dependency closure to P5.
Its source-blind first blocker was repository resolution treating the R-distribution package
`parallel` as a missing external archive. The reusable fix classifies provided core packages,
retains DESCRIPTION dependency kinds, and attaches `Depends` packages before the requested package.
A browser-owned `parallel` namespace supplies exact single-lane `mclapply()`/`splitIndices()`
semantics and an explicit sequential PSOCK adapter; it never spawns a host process or thread.
Registered `%dopar%`, explicit cluster execution, and the one applicable installed example pass.

Checked-in evidence is 977/977, recursive Oracle v2 is 16/16 with 41 associated behavioral bindings,
and the inventory contains 779 registered bindings with 747 GNU R name overlaps out of 2,522. The
32-release corpus has 28 passing, three blocked, and one source-blind holdout; 30 reach P4 and 27
reach P5. Usage-ranked pure-R `pbapply 1.7-4` is the next untouched holdout.

## Profile 0.316 conditional package metadata and pbapply evidence

Profile 0.316 advances unchanged `pbapply 1.7-4` from P0 to P4. The source-blind first blocker was a
conditional NAMESPACE declaration. Deterministic safe platform selection, text-progress state,
`parLapply`/load-balanced aliases, `crossprod()`, vectorized `rnorm()`, and retained `model.frame()`
semantics then close reusable package and Base R gaps. Sequential, simplified, and single-lane PSOCK
representative paths pass; no package-name branch was added.

The first installed example remains blocked where `mod$call$formula` must reconstruct a two-sided
formula, so P5 is not claimed. Checked-in conformance is 982/982, recursive Oracle v2 is 17/17 with
42 associated behavioral bindings, and the inventory records 787 bindings with 753 GNU R name
overlaps. The 33-release corpus has 28 passing, four blocked, and one unevaluated entry; 31 reach P4
and 27 reach P5. Untouched pure-R `globals 0.19.1` is the next source-blind holdout.

## Profile 0.317 Base reflection and globals evidence

Profile 0.317 advances unchanged `globals 0.19.1` and its `codetools 0.2-20` dependency closure to
P4. Its source-blind namespace blocker was the absent standard `R.version` object. Reusable fixes
add locked `R.version`/`version` bindings, environment `names()`, length-generic `seq_along()`,
language/expression/closure `unclass()`, and nested list-cell data-frame `[[` replacement. The
package installs, loads, attaches, runs representative `globalsByName()` and DFS `findGlobals()`
paths, and executes its first installed example without a package-name branch.

The second example remains blocked on list-valued subscript normalization during conservative
codetools traversal, so P5 is not claimed. Checked-in conformance is 986/986, recursive Oracle v2
remains 17/17 with 42 associated behavioral bindings, and the inventory remains 787 bindings with
753 GNU R name overlaps. The 34-release corpus has 28 passing, five blocked, and one unevaluated
entry; 32 reach P4 and 27 reach P5. Dependency-free pure-R `listenv 1.0.0` is the next untouched
holdout.

## Profile 0.319 package-construction and R.methodsS3 evidence

Profile 0.319 advances unchanged `R.methodsS3 1.8.2` from the source-blind P0 holdout to P5. The
first recorded blocker was its imported `utils::getAnywhere` binding. Reusable closure then added
Utils lookup and file-test seams, `sys.source()` and system-frame reflection, package-startup
conditions, complete `library()` formals, substitute support for closure values and assignment
targets, namespace-qualified replacement, and access to an in-progress package's own namespace.

The package now installs, loads, attaches, constructs documented S3 generics and methods, and runs
all three installed example topics. Checked-in conformance is 990/990; the generated inventory has
799 bindings and 765 GNU R name overlaps. Recursive Oracle v2 is 19/19 with 62 explicitly associated
behavioral bindings. The 36-release corpus has 30 passing, five blocked, and one unevaluated entry;
34 reach P4 and 29 reach P5. Pure-R dependency-closure package `R.oo 1.27.1` is the next untouched
holdout.

## Profile 0.320 R.oo semantic-closure evidence

Profile 0.320 advances unchanged `R.oo 1.27.1` from its source-blind P0 checkpoint to P5 without a
package-identity branch. The reusable closure covers safe conditional NAMESPACE expressions,
post-`.onLoad` export discovery, namespace-proxy topology, caller frames, S3 dispatch for classed
closures and `c.person`, `NextMethod` forwarding, NULL binary Ops, string coercion, partial
attribute matching, delayed bindings, and XDR serialization of runtime objects.

The frozen package and its unchanged `R.methodsS3` dependency install, load, attach, construct
`Object` instances, and execute all 90 installed Rd example topics. The cache example has an
explicit finite 100,000,000-step evidence budget because it deliberately allocates several
million-element vectors; standard runtime-profile limits are unchanged. Checked-in evidence is 997
cases, recursive Oracle v2 is 22 cases, and the 37-release corpus has 31 passing, five blocked, and
one untouched holdout; 35 reach P4 and 30 reach P5. The generated inventory has 821 registered
bindings and 783 GNU R name overlaps. P6/P7 and arbitrary pure-R package compatibility remain
unclaimed.

## Profile 0.318 classed-environment dispatch and listenv evidence

Profile 0.318 advances unchanged `listenv 1.0.0` from an untouched P0 holdout to P5. The
source-blind public example first stopped because classed environments bypassed primitive S3
`[[`/`[[<-` dispatch. The reusable closure now covers `$`, `[[`, `[`, and their replacement forms,
plus `length`, `names`, `dim`, `dimnames`, and `t` primitive generics before ordinary-environment
fallback. Package execution also added browser-owned `gettext()`, `gettextf()`, `.makeMessage()`,
and `is.element()` behavior.

The unchanged package installs, loads, attaches, completes its ordered-environment path, and runs
all three installed example topics. Checked-in conformance is 988/988; the generated inventory has
791 bindings and 757 GNU R name overlaps. Recursive Oracle v2 is 18/18 with 56 explicitly associated
behavioral bindings. The 35-release corpus has 29 passing, five blocked, and one unevaluated entry;
33 reach P4 and 28 reach P5. Dependency-free pure-R `R.methodsS3 1.8.2` is the next untouched
holdout.

## Profile 0.321 R.utils semantic-closure evidence

Profile 0.321 advances unchanged `R.utils 2.13.0` and its unchanged `R.oo`/`R.methodsS3`
dependencies from the recorded source-blind namespace blocker to P5 without a package-identity
branch. Reusable closure spans graphics annotations and layout, R octal/hex string escapes,
browser-memory gzip/bzip2 connections, seek and typed binary I/O, search-path metadata, source
references, conditions and exiting handlers, cooperative time limits, owned-file MD5, and atomic
dimension-name coercion.

The complete frozen installed-example topic set is executed. `systemR` proves the explicit
host-process boundary; the unchanged `touchFile` example proves the optional native `digest`
boundary, while an independent unchanged `touchFile` path verifies timestamps and content identity
with browser-owned `tools::md5sum()`. Checked-in conformance is 1009/1009; recursive Oracle v2 has
23 cases and 79 explicitly associated behavioral bindings. The 38-release corpus has 32 passing,
five blocked, and one untouched holdout; 36 reach P4 and 31 reach P5. The generated inventory has
846 registered bindings and 807 GNU R name overlaps. P6/P7, complete Base R, and arbitrary pure-R
package compatibility remain unclaimed; untouched `here 1.0.2` is the next generalization holdout.

## Profile 0.322 zero-blocker here generalization evidence

Profile 0.322 evaluates the previously untouched `here 1.0.2` archive only after its source digest,
metadata, dependency closure, and usage selection were frozen. The unchanged package and its
already-P5 `rprojroot 2.1.1` dependency install, load, attach, execute `here()`, and complete all
three installed Rd example topics without exposing a new runtime blocker. No production code or
callable was added for this rotation.

The corpus now contains 39 releases: 33 passing, five blocked, and one unevaluated; 37 reach P4 and
32 reach P5. The development, regression, and holdout partitions contain 2, 36, and 1 entries,
respectively. Checked-in conformance remains 1009/1009, recursive Oracle v2 remains 23/23 with 79
associated behavioral bindings, and the name inventory remains 846 registered bindings with 807 GNU
R overlaps.

The next untouched holdout is `R.matlab 3.7.0`. Official metadata, its pure-R dependency closure,
the frozen usage window, archive byte count, and source SHA-256 were recorded before any archive
listing, extraction, parsing, or execution. `R.cache` was rejected for this rotation because its
mandatory native `digest` dependency would test the deferred native-package phase instead of the
current pure-R dependency-closure path. Complete Base R, arbitrary pure-R packages, P6/P7, and
native ABI completion remain unclaimed.

## Profile 0.323 R.matlab semantic-closure evidence

Profile 0.323 advances the frozen unchanged `R.matlab 3.7.0` closure to P5. The first source-blind
blocker was auxiliary Java source being treated as executable JVM code; the package tool now retains
such files only as inert immutable assets. Reusable namespace changes support imported-binding
re-exports and validate explicit exports after `.onLoad`; runtime changes add GNU R-shaped
`R.Version()` and S3 dispatch for `str`. No production branch recognizes R.matlab.

The exact four installed example topics pass, as does a MAT v5 scalar/vector/matrix write-read round
trip. After the metadata-only `combinat 0.0-8` freeze, the 40-release corpus has 34 passing, five
blocked, and one unevaluated entry: 40 reach P0, 39 reach P1-P3, 38 reach P4, 33 reach P5, and two
reach P6. The partitions contain 2 development, 37 regression, and 1 holdout entry. Checked-in
conformance is 1011/1011, GNU R 4.6.0 advisory evidence is 951/955 with four target-version
differences, recursive Oracle v2 remains 23/23 with 79 associated bindings, and inventory records
847 registered bindings with 808 GNU R overlaps. Complete Base R, arbitrary pure-R packages, P6/P7
completion, external MATLAB/JVM execution, and native ABI completion remain unclaimed.

## Profile 0.324 combinat semantic-closure evidence

The frozen unchanged `combinat 0.0-8` package reaches P5 without a package-name branch. Its
source-blind example run exposed missing generic Base `lgamma()`, then `tabulate()`, incorrect Rd
percent-comment handling, and missing generic Base `gamma()`. Those reusable capabilities now carry
all six applicable installed example topics: `combn`, `dmnom`, `nsimplex`, `permn`, `rmultinomial`,
and `xsimplex`.

After freezing the next holdout, the 41-release corpus has 35 passing, five blocked, and one
unevaluated entry; 41 reach P0, 40 reach P1-P3, 39 reach P4, 34 reach P5, and two reach P6. The
partitions contain 2 development, 38 regression, and 1 holdout entry. Flat conformance is 1014/1014
with 958 live-R-eligible cases; recursive Oracle v2 remains 23/23 with 79 associated bindings.
Inventory records 850 registered bindings and 811 GNU R name overlaps. Complete Base R, arbitrary
pure-R packages, P6/P7 completion, and the native-package ABI remain unclaimed.

The next untouched P0 holdout is dependency-free `matrixcalc 1.0-6`. Its official metadata,
9,926-download comparison count, 30,540-byte source archive, and SHA-256 were frozen before archive
listing, extraction, parsing, or execution.

## Profile 0.325 matrixcalc semantic-closure evidence

The unchanged frozen `matrixcalc 1.0-6` release now reaches P5. Its ordered source-blind blockers
were POSIX `exportPattern()` syntax, vector promotion in matrix products, triangle and coordinate
matrix helpers, Kronecker products, choose/lchoose, determinant/solve, QR, and SVD. Shared parser,
runtime, and Base implementations carry install, namespace load, attach, and all 60 exact installed
Rd example topics without a package-name branch.

After the next metadata-only freeze, the 42-release corpus has 36 passing, five blocked, and one
unevaluated entry; all 42 reach P0, 41 reach P1-P3, 40 reach P4, 35 reach P5, and two reach P6. Its
partitions are 2 development, 39 regression, and 1 holdout. Flat conformance is 1020/1020, the GNU R
4.6.0 advisor is 960/964 with four target-version-only differences, and recursive Oracle v2 is
23/23. Inventory records 872 registered bindings and 833 GNU R name overlaps. Complete Base R,
arbitrary pure-R packages, complex/full LAPACK linear algebra, P6/P7 completion, and the
native-package ABI remain unclaimed.

The next untouched P0 holdout is `Formula 1.2-6`. Higher-usage pure-R `clipr` was excluded by its
host-clipboard purpose and `parallelly` by `NeedsCompilation: yes`; Formula is the highest-usage
remaining browser-admissible candidate at 331,936 downloads in the shared window. Its metadata,
47,339-byte unopened archive, and SHA-256 were frozen before listing, extraction, parsing, or
execution.

## Profile 0.326 Formula semantic-closure evidence

The frozen unchanged `Formula 1.2-6` holdout now reaches P5 with artifact SHA-256
`c2c65ec4d007ebd4c304e43a0e2c402ca047e0ae38d8667bbf79aaa918007b0b`. Its source-blind blockers closed
through generic formula attributes and S3 dispatch, formula language indexing/replacement, string
`FUN` resolution, formula update, `terms`/model-frame dot expansion, precomputed expression columns,
formula/language equality, `delete.response`, `model.response`, `offset`, and `model.offset`.
Install, namespace load, attachment, package version, and both exact installed Rd topics pass
without a Formula-specific production branch.

The corpus now has 42 releases: 37 passing and five blocked; 42 reach P0-P3, 41 reach P4, 36 reach
P5, two reach P6, and none reaches P7. Partitions are two development, 40 regression, and no active
holdout pending the next metadata-only rotation. Flat conformance is 1021/1021; the GNU R 4.6.0
advisor is 961/965 with only four target-version differences; recursive Oracle v2 is 24/24 with 86
associated bindings. Inventory records 877 registered bindings and 838 GNU R name overlaps. This
does not claim arbitrary pure-R package support, complete Base R, P6/P7, or a native-package ABI.

## Profile 0.327 DBI source-blind semantic-closure evidence

The frozen unchanged `DBI 1.3.0` release now reaches P5 with artifact SHA-256
`d55fa587203e850bd7a7403a96aaa559bf9686c060816290904d1f4d7b9b6997`. Its ordered source-blind
blockers closed through reusable methods formals/value-class handling, S3 `toString`, concrete and
atomic-data S4 storage, Date-to-POSIXct conversion, `oldClass`, `stats::setNames`, row-name
dispatch, compact automatic row names, and NULL row-name replacement. Install, namespace load,
attachment, representative ANSI/Id/SQL behavior, and every runnable block in the exact 58-topic
installed help manifest pass without a DBI-specific production branch.

The corpus now has 44 releases: 38 passing, five blocked, and one unevaluated; 44 reach P0, 43 reach
P1-P3, 42 reach P4, 37 reach P5, two reach P6, and none reaches P7. Partitions are two development,
41 regression, and one holdout. Flat conformance is 1032/1032; the GNU R 4.6.0 advisor is 972/976
with only four target-version differences; recursive Oracle v2 is 25/25 with 93 associated bindings.
Inventory records 886 registered bindings and 847 GNU R name overlaps. Concrete database
backends/connectivity, DBI P6/P7, arbitrary pure-R packages, complete Base R, and the native-package
ABI remain unclaimed.

The next untouched P0 holdout is `xtable 1.8-8`, ranked immediately after DBI at 606,555 downloads
in the same frozen window. Official metadata declares `NeedsCompilation: no`, no OS restriction, and
only R >= 2.10.0 plus core `stats`, `utils`, and `methods` as mandatory. Its unopened 618,708-byte
archive has source SHA-256 `b999c031b91255fb92134b0e70e5f84c5609e9312c0518393b9d0a4aaf6b2510`; P0
claims no execution.

## Profile 0.330 xtable source-blind semantic-closure evidence

The frozen unchanged `xtable 1.8-8` release reaches P5 with artifact SHA-256
`bd7c22a70c628bd2a3655583b983884e962c4deebc4858db892361ed537e806b`. Its ordered source-blind
blockers closed through reusable datasets, data-frame/matrix and compressed package-data behavior,
LM/AOV and stratified summaries, `summary.lm`, gaussian/binomial/Poisson IRLS GLM inference,
`prcomp`, flat tables, row-bind attributes, matrix extents, and positional missing-argument
matching. Install, namespace load, attachment, and every runnable block in the exact eight-topic
installed help manifest pass without an xtable-specific production branch.

This is P5 evidence for one pinned package release, not completion of the program. P6 package tests,
P7 package-check/independent scenarios, arbitrary pure-R package support, complete Base R, broader
model/table semantics, and the native-package ABI remain unclaimed. The next semantic increment must
be selected by an independently frozen holdout or a recorded P6/P7 first blocker.

The corpus now contains 44 releases: 39 passing and five blocked, with two development and 42
regression entries and no active holdout. All 44 reach P0-P3, 43 reach P4, 38 reach P5, two reach
P6, and none reaches P7. Flat conformance is 1046/1046; the local non-normative GNU R 4.6.0 advisor
matches 986/990 with only four target-version differences, while recursive Oracle v2 is 27/27 with
114 associated behavioral bindings. Inventory records 909 registered bindings and 862 GNU R name
overlaps. The default test gate passes 574 tests with 44 opt-in/conditional skips, and Chromium,
Firefox, and WebKit pass all six Worker/playground E2E scenarios. The unchanged source-blind xtable
regression also passes independently.

## Profile 0.331 core namespace and globals semantic closure

The evaluator now owns separate builtin namespace environments, installs each definition according
to its declared core package, rebuilds exported default-search bindings without exposing namespace
internals, and records hidden core S3 methods in the same session registry used by package methods.
Reset preserves core registrations while discarding dynamic package state. Base now exposes the
locked `.BaseNamespaceEnv` identity; `{`, `<-`, and `[` are first-class special values; and
`NextMethod()` falls through to a registered primitive implementation when no later class method
exists. Omitted top-level `substitute()` uses the GNU R global-environment exception.

These generic changes advance unchanged `globals 0.19.1` plus `codetools 0.2-20` to P5 across all
installed examples. Current generated status records 1047 checked-in cases, 990 live-R-eligible
cases, 28 recursive cases, 121 associated behavioral bindings, 907 registered declarations, and 865
GNU R name overlaps. The 44-release corpus has 40 passing and four blocked entries; 39 reach P5, two
P6, and none P7. The next reusable recorded blocker is pbapply's LM call/formula reflection, subject
to comparison with any independently frozen new holdout.

## Profile 0.332 pbapply installed-example closure

Profile 0.332 advances unchanged `pbapply 1.7-4` from P4 to regression P5. The package's four
installed example topics (`pbapply`, `pboptions`, `splitpb`, and `timerProgressBar`) now execute
unchanged through the generic source-package pipeline. The reusable closure includes caller-frame
evaluation and retained calls/formulas; five-number, outer-product, trimmed-mean, table, summation,
array, and data-frame-summary semantics; shallow list handling and nested replacement; trace state;
`.mapply()`; factor-level replacement; and provenance-audited `warpbreaks` and `presidents` data.

Generated status records 1052 checked-in cases, 995 live-R-eligible cases, 29 recursive cases, 136
associated behavioral bindings, 916 registered declarations, and 873 GNU R name overlaps. The
44-release corpus has 40 passing and four blocked entries; 40 reach P5, two P6, and one P7. This
does not claim complete Base R or arbitrary pure-R package compatibility. The next package rotation
must be chosen independently from frozen usage/metadata evidence or an existing P6/P7 blocker.

The build-time package tools now produce and execute a deterministic, package-identity-agnostic P7
plan. Unchanged `numDeriv 2016.8-1.1` passes every applicable metadata, namespace, attachment,
documentation, example, and test check and advances to P7. Unchanged `abind 1.4-8` remains at P6:
the same runner executes its five examples and five tests, then reports the first normalized saved
output mismatch in `abind.Rout.save`. This explicit P7 blocker explains the corpus status change; it
is not a package execution regression.

## Profile 0.333 generic P7 saved-output closure

Profile 0.333 closes that reusable presentation and batch-check gap. Parenthesized assignment
visibility, one-dimensional and multidimensional array printing, table formatting, named dimension
axes, S3 method calls, replacement-call reconstruction, condition call stacks, and normalized batch
error output now have flat and recursive GNU R evidence. The generic runner passes all five retained
`abind` tests and every retained `.Rout.save` comparison without a package-name branch, advancing
unchanged `abind 1.4-8` to P7.

Generated status records 1054 checked-in cases, 997 live-R-eligible cases, 30 recursive cases, 142
associated behavioral bindings, 918 registered declarations, and 875 GNU R name overlaps. The
44-release corpus now has 41 passing and three blocked entries; 40 reach P5, two P6, and two P7.
This is a bounded corpus milestone, not complete Base R or arbitrary pure-R package compatibility.
The next package rotation must again be selected from frozen usage/metadata evidence or another
existing explicit blocker before source inspection.

The next rotation is now frozen without source inspection as `selectr 0.6-0`. Public metadata and
the fixed usage window select it after excluding host-clipboard `clipr` and remote-installer
`remotes`; its only non-core mandatory dependency is already-passing `R6`. The unopened 85,422-byte
archive has source SHA-256 `b877dfd9cc8b7d9afda1be9e45dfafc942e14b4279a430e5f8f75325c05eddd9`. The
corpus therefore has 45 releases: 41 passing, three blocked, and one P0 holdout. No selectr code or
resources have yet been listed, parsed, installed, or executed.

## Profile 0.334 selectr regex and optional-dependency evidence

The scheduled source-blind run advances unchanged `selectr 0.6-0` to regression P5. Generic
`regexec()`/`regmatches()` semantics now retain unmatched optional captures as empty strings with
GNU-compatible ASCII index metadata, and package checks allow guarded probes only for dependencies
declared in `Suggests`. Installation, namespace load, attachment, all export/help checks, and both
installed example topics pass without a package-name production branch. The retained package test
still requires unavailable suggested package `testthat`, which remains the explicit P6 blocker.

Generated status records 1055 checked-in cases, 998 live-R-eligible cases, 31 recursive cases, 144
associated behavioral bindings, 918 registered declarations, and 875 GNU R name overlaps. The
45-release corpus has 41 passing and four blocked entries; 41 reach P5, two P6, and two P7. This is
not comprehensive Base R or arbitrary pure-R package compatibility. The available non-normative GNU
R 4.6.0 flat advisor matches 994/998; its four differences are only the target-version fields pinned
by NativR to 4.6.1.

The next source-blind checkpoint is frozen as unevaluated `timeDate 4052.112`. Public metadata
declares no compilation or OS restriction and a core-only mandatory dependency closure; the fixed
usage window records 321,191 downloads. Its unopened 367,313-byte archive is pinned by SHA-256
`7f5b8e294f9fdf977cb721e711a6fcd664e379ee1b0ddb4c733374940e0e4646`. The corpus therefore has 46
releases: 41 passing, four blocked, and one P0 holdout, without any new compatibility claim.

## Profile 0.335 timeDate P4 and reusable S4/date seams

The frozen `timeDate 4052.112` release has moved from P1 failure to regression P4. Its unchanged
namespace loads and attaches, a declared public calendar conversion path runs, and retained
`doRUnit.R` passes. The generic closures are explicit POSIXct axes, XDR S4 serialization,
`.POSIXct`, inherited generic defaults, replacement-method registration, dynamic `callGeneric`,
`getDataPart`, numeric `pretty`, and the standard date-label S3 generics. Complete examples remain
red, so neither P5 nor P6 is claimed; S4 export documentation reconciliation is the ordered P5
blocker. Checked-in flat conformance is 1058/1058 and recursive Oracle v2 is 32/32.

## Profile 0.336 S4 primitive closure and timeDate example progression

Standard S4 Rd aliases now satisfy package export documentation checks. Primitive arithmetic and
subset AST paths dispatch registered S4 methods with `callGeneric()` fallback, while
`as.double`/`as.numeric`, `sort`, and `diff` restore their generic forwarding paths. Five new flat
cases bring checked-in conformance to 1063/1063; recursive Oracle v2 remains 32/32.

The unchanged `timeDate 4052.112` regression artifact now passes its documentation gate and the
installed examples through `c`, `diff`, and `difftimeDate`. Its tier remains P4 because
`example:round` stops at the missing Base R `round.POSIXt` method, the new ordered first blocker.

## Profile 0.337 POSIX/S4 continuity and timeDate progression

Owned UTC/GMT `round.POSIXt` and `trunc.POSIXt` cover the six Base calendar units and return named
POSIXlt values. Generic `round` and `range` forward method-specific arguments, internal subset
operations preserve S4 identity, and `new` completes omitted prototype slots. Four new flat cases
bring checked-in conformance to 1067/1067; one recursive case brings Oracle v2 to 33/33 against the
available non-normative GNU R 4.6.0 advisor.

The unchanged `timeDate 4052.112` artifact advances past its former `round`, `start`, and
`summary-methods` failures. Its explicit tier remains P4: `example:align` now fails first because of
an unused-argument mismatch. This is progression evidence, not complete package compatibility.

## Profile 0.338 generic/date closure and timeDate progression

Twelve new flat cases bring checked-in conformance to 1079/1079. The added recursive S4-dots and
partial-match graph brings Oracle v2 to 34/34 against the available non-normative GNU R 4.6.0
advisor. The implementation adds generic `seq`, `is.na`, `unique`, and `duplicated` dispatch;
S4-dot-safe signature positioning; forwarded-default presence; `pmatch`; POSIXlt parsing,
formatting, conversion, and replacement; callable `[<-`; and `julian.POSIXt`.

The unchanged `timeDate 4052.112` regression artifact now passes `align`, `alignDaily`,
`alignMonthly`, `isBizday`, and `nDay` along its ordered installed-example frontier. Its explicit
tier remains P4 because `example:periods` is the first failure, at a sequence direction/step
boundary. This profile does not claim complete package or Base R compatibility.

## Profile 0.339 length, POSIXlt, and ellipsis closure

Five new flat cases bring checked-in conformance to 1084/1084. Two recursive graphs bring Oracle v2
to 36/36 against the available non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release
gate. The reusable implementation adds S3/S4 `length` dispatch, element-wise `lengths` dispatch,
short-component recycling in POSIXlt formatting, the versioned `base::.leap.seconds` data object,
logical-missing and empty conversion through `as.POSIXlt`, and the `...length`/`...elt` primitives.

The unchanged `timeDate 4052.112` artifact now passes the former `example:periods` blocker.
Source-blind regression probes for `periods` and `monthlyRolling` each return GNU R's 86 windows.
The package remains P4 because `example:timeDate-class` now stops first at the missing generic
`base::asplit` array-margin operation. No package-specific production branch was added, and this is
not a complete Base R, GNU R, or arbitrary-package compatibility claim.

## Profile 0.340 array, apply, graphics-dispatch, and language-name closure

Profile 0.340 adds generic `asplit` over arbitrary vector/list arrays with ordered numeric,
negative, and named margins; `apply` now preserves GNU R's atomic type when every slice returns a
zero-length value. S4 `plot`, `points`, and `lines` methods dispatch before their S3/default paths,
including missing-`y` signatures, while `plot.default` accepts the measured `xaxt`/`yaxt` styles.
`names` returns `NULL` for non-vector functions and symbols, and `all.names` recursively enumerates
normalized language without exposing parser internals.

Checked-in evidence is 1088/1088 flat cases and 39/39 recursive graphs against the available
non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate. The unchanged
`timeDate 4052.112` regression now passes the former `timeDate-class`, `plot-methods`, and `holiday`
example blockers. It remains P4 because `example:in_int` now stops first where `@` receives a non-S4
value. No package-specific production branch was added.

## Profile 0.341 S4 initialization, sequence-control, and missing-replacement closure

Profile 0.341 routes `new()` through registered `initialize` methods, supplies the reusable default
slot/object initializer, and supports inherited `callNextMethod()` selection. Registered S4 `names`
and `names<-` methods now precede default behavior. Primitive `seq.int` accepts GNU R's valid `by`
plus `length.out`/`along.with` combinations, including a sequence anchored by `to`. Default
`is.na<-` now treats its right-hand side as a subscript and delegates to ordinary subset
replacement, covering lists, factors, atomic vectors, attributes, and S4 replacement dispatch.

Checked-in evidence is 1090/1090 flat cases and 42/42 recursive graphs against the available
non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate. The unchanged
`timeDate 4052.112` artifact advances through `in_int`, `names-methods`, `blockStart`, and
`is.na-methods`. It remains P4 because `example:timeCeiling` now stops first with
`invalid POSIXlt value`. No package-specific production branch was added.

## Profile 0.342 POSIXlt extraction, month parsing, and timeDate P7

Profile 0.342 adds the Base S3 `[.POSIXlt` observation/component extractor. It resolves observation
names once, preserves all eleven component vectors, invalidates and restores the `balanced` state
through `$<-.POSIXlt`, and normalizes only when the input state requires it. `strptime` now accepts
C-locale abbreviated or full English month names through `%b`, `%B`, and `%h`, case-insensitively.

Checked-in evidence is 1092/1092 flat cases and 43/43 recursive graphs against the available
non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate. The unchanged
`timeDate 4052.112` artifact now passes metadata, namespace, attachment, all applicable installed
documentation/examples, its retained test, and independent scenarios, advancing from P4 to P7. No
package-specific production branch was added.

## Profile 0.343 external LazyData, contrast semantics, and carData P7

Profile 0.343 recognizes `LazyData: yes` in installed pure-R artifacts and creates a separate
package-data environment populated with memoized per-data-set promises. Namespace loading and
attachment register names only; the first lookup through the search path, `pkg::data`, or
`getExportedValue()` realizes the matching data resource. `pkg:::data` and private namespace lookup
do not treat those data bindings as namespace members. Reset discards realized values while keeping
the immutable installed package catalog.

The build tool now normalizes bounded xz package data alongside bzip2 before browser admission.
Canonical base64 validation is linear and constant-stack, and decoded transport bytes use the
independent byte budget rather than pretending to be one R vector. `stats::contrasts`,
`stats::contr.sum`, and `stats::contr.treatment` cover stored numeric contrast matrices, stored
supported generator names, default unordered treatment coding, identity coding, and dense sum or
treatment generators. Ordered polynomial and sparse contrasts remain explicit boundaries.

Checked-in evidence is 1093/1093 flat cases and 44/44 recursive graphs against the available
non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate. Unchanged `carData 3.0-6`
passes every applicable installed package check and independent data/namespace/contrast probes at
P7. This does not claim comprehensive GNU R or arbitrary-package compatibility.

## Profile 0.344 literal call heads and rex P5

Call reconstruction no longer promotes a scalar character CAR to an identifier. Literal and symbol
heads remain distinguishable through call subsetting, list conversion, reconstruction, deparsing,
type inspection, and evaluation. This closes a generic metaprogramming seam used by packages that
capture unevaluated dots; no package identity is consulted.

Checked-in evidence is 1094/1094 flat cases and 45/45 recursive graphs against the available
non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate. Unchanged `rex 1.2.2`
passes installation, namespace load, attachment, complete installed documentation, all five example
topics, and an independent capture/match scenario at P5. Its first ordered blocker is the
unavailable suggested `testthat` dependency used by the retained package test, so P6/P7 are not
claimed. The 48-release corpus contains 43 passing and five blocked entries, with 44 at P5 or
higher.

## Profile 0.345 brew P5 evidence and shape holdout

The existing generic source-package pipeline installs unchanged `brew 1.0-10`, loads and attaches
its namespace, validates all five exports and both help topics, executes both installed example
topics, and passes an independent GNU R-matched inline template/parser scenario. No production
semantic code or package-identity branch was needed, so this is explicitly an evidence-only
package-depth increment.

Brew reaches regression P5 with retained `testthat.R` blocked on unavailable suggested package
`testthat`. The 50-release corpus now has 43 passing, six blocked, and one deliberately unevaluated
holdout; 45 releases reach P5 or higher. `shape 1.4.6.1` is the replacement metadata-only P0
holdout. Semantic evidence remains 1094/1094 flat cases and 45/45 recursive graphs.

## Profile 0.346 source-blind shape graphics and bind progression

The unchanged `shape 1.4.6.1` holdout now parses, loads, attaches, exposes and documents every
installed export, and executes representative arrow, ellipse, circle, cylinder, polygon, palette,
rotation, and annotation paths. Reusable closures add browser-owned `grDevices::dev.new`, generic
`graphics::arrows`, `plot.default(asp=)` physical-window expansion, `xaxs`/`yaxs` axis styles,
polygon graphical controls, and GNU R-compatible omission of `NULL` inputs by `rbind()`/`cbind()`.
Package examples retain non-fatal warning counts as evidence; warnings do not become errors.

Shape reaches development P4 with artifact SHA-256
`ef839b8ffe4d57b24dba3f62bd10149c007f834fb8ffd8342869df37435a93b8`. Its ordered first blocker is
`datasets::volcano`, which requires an independently redistributable provenance source rather than
copying GNU R data. Later gaps include `graphics::filled.contour`, one argument seam, and installed
vignette lookup. The 51-release corpus has 43 passing, seven blocked, and one untouched
`corrplot 0.95` P0 holdout. Evidence is 1098/1098 flat cases and 48/48 recursive graphs against the
non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

## Profile 0.347 indexed sorting and package-check closure

`sort.default()` now exposes its GNU R formal contract and implements generic `index.return`
behavior: the result is a named list containing the stable sorted vector and one-based source
indices, preserves input names, distinguishes missing-value placement, coerces scalar logical
controls, and rejects indexed partial sorting. Its `na.last` formal is represented as logical `NA`,
not as an unevaluated symbol.

The package-check vignette plan now reads the canonical installed `File` field. Unchanged
`shape 1.4.6.1` consequently passes `example:filledellipse` and its installed prebuilt vignette
check, while remaining honestly at P4 because `example:drapecol` still stops first at the
provenance-gated `datasets::volcano` object. Evidence is 1099/1099 flat cases and 49/49 recursive
graphs against the non-normative GNU R 4.6.0 advisor; GNU R 4.6.1 remains the release gate.

## Profile 0.348 exact/partial matching and matrix covariance closure

Ordinary closure and shared builtin matching now remove exact-matched formals from the later
partial-name candidate set. A unique partial name can therefore select another unmatched formal or
fall through to `...`; two partial actuals that select the same formal still raise the duplicate
match error. This closes the unchanged corrplot color-legend call shape without special casing.

Pearson `cov()` and `cor()` now accept numeric/logical matrices and data frames, preserve column
dimnames, produce matrix-by-matrix and matrix-by-vector result shapes, implement the declared
missing-observation policies, warn for zero standard deviations, and expose GNU R-shaped formals.
Kendall and Spearman remain explicit unsupported method boundaries.

The source-blind `corrplot 0.95` artifact reaches development P4 after `COL1`, `COL2`, and
`colorlegend` pass; `example:corrMatOrder` now stops first at missing `stats::hclust`. The
52-release corpus has 43 passing, eight blocked, and one untouched `insight 1.5.2` P0 holdout.
Evidence is 1101/1101 flat cases and 51/51 recursive graphs against the non-normative GNU R 4.6.0
advisor; GNU R 4.6.1 remains the release gate.

## Profile 0.349 distance/clustering/dendrogram closure

The runtime now owns a finite real-matrix distance path, real-square-matrix `as.dist`, all eight
documented hierarchical linkage updates, GNU-shaped `hclust` results, recursive dendrogram
conversion, and leaf-order traversal. Base `which` additionally supports array coordinate matrices
and their name controls. No production branch recognizes corrplot or any package identity.

The unchanged corrplot artifact independently executes all four `corrMatOrder` ordering probes. The
complete example progresses through clustering and array-index selection, then stops first at
missing `graphics::symbols`; corrplot therefore remains development P4. The 52-release corpus still
has 43 passing, eight blocked, and one untouched P0 holdout.

Evidence is 1103/1103 flat cases and 53/53 recursive graphs against the non-normative GNU R 4.6.0
advisor. The registered-name inventory is 912/2522 overlap and remains non-semantic. GNU R 4.6.1
remains the release gate.

## Profile 0.350 symbol graphics and multi-key order

The runtime now emits user-coordinate circles, squares, and rectangles from `graphics::symbols`
through the reusable polygon protocol, including the styles used by corrplot. Base `order` now
accepts multiple dots keys and vector decreasing flags with stable lexicographic behavior. No
production branch recognizes corrplot or any package identity.

An unchanged `corrplot(cor(mtcars))` call renders successfully. The complete source-blind
`example:corrMatOrder` topic next stops at missing `stats::cutree`, so the artifact remains
development P4. The 52-release corpus still has 43 passing, eight blocked, and one untouched P0
holdout.

Evidence is 1105/1105 flat cases and 54/54 recursive graphs against the non-normative GNU R 4.6.0
advisor. The registered-name inventory is 913/2522 overlap and remains non-semantic. GNU R 4.6.1
remains the release gate.

## Profile 0.351 reusable hclust tree cuts

The runtime now owns `stats::cutree` over validated `hclust` merge trees, including scalar/vector
`k`, scalar/vector `h`, stable cluster numbering, labels, output matrices, and the
nonmonotone-height boundary. No production branch recognizes corrplot or any package identity.

The complete unchanged `example:corrMatOrder` topic now passes. Source-blind execution advances to
`example:corrRect`, whose lower-triangle name selection exposes deterministic symmetric-eigenvector
orientation relative to GNU R. Corrplot therefore remains development P4. The 52-release corpus
still has 43 passing, eight blocked, and one untouched P0 holdout.

Evidence is 1106/1106 flat cases and 55/55 recursive graphs against the non-normative GNU R 4.6.0
advisor. The generated name inventory is refreshed separately and remains non-semantic. GNU R 4.6.1
remains the release gate.

## Profile 0.352 reproducible symmetric eigendecomposition

The public runtime now composes a minimal LAPACK 3.12.1 `DSYEVR` Wasm backend through a generic
base-layer interface. The 150,821-byte artifact is reproducible from a pinned machine-local LAPACK
source tree and audited to one memory-growth import. It exactly reproduces the signed mtcars FPC/AOE
order used by corrplot without recognizing the package or dataset. Fractional `seq()` length output
also follows the GNU-observed ceiling rule.

The unchanged corrplot artifact passes `example:corrMatOrder` and `example:corrRect`; its next
ordered blocker is `example:corrplot` at `invalid symbol parameter`, so it remains development P4.
The 52-release corpus remains 43 passing, eight blocked, and one untouched P0 holdout.

Evidence is 1106/1106 flat cases and 57/57 recursive graphs against the non-normative GNU R 4.6.0
advisor. The generated name inventory is 914/2522 overlap and remains non-semantic. GNU R 4.6.1
remains the release gate.

## Profile 0.353 complete corrplot examples

Owned Pearson `cor.test` semantics, data-frame-aware column binding and renaming, zero-size symbol
handling, and `text(..., lwd=)` validation close the remaining generic contracts reached by the
unchanged corrplot examples. All installed example topics now pass, so corrplot advances from P4 to
P5 without a package-name branch. Its first blocker is now `test:testthat.R`, where the suggested
`testthat` dependency is unavailable.

The 52-release corpus has 43 passing, eight blocked, and one untouched P0 holdout; 46 entries are P5
or higher. Evidence remains 1106 flat cases and rises to 58/58 recursive graphs against the
non-normative GNU R 4.6.0 advisor. The generated name inventory is 915/2522 overlap and remains
non-semantic. GNU R 4.6.1 remains the release gate.

## Profile 0.354 complete insight examples

Unchanged `insight 1.5.2` reaches P5 after all applicable installed examples pass through the
generic package pipeline. The reusable closure includes reparsable deparse output, retained-model
introspection and prediction, `.Random.seed` synchronization/restoration, NULL head/tail, missing
grep behavior, quasi families, grouped binomial response matrices, `datasets::anscombe`, and
`cbind.data.frame`.

The 53-release corpus has 43 passing, nine blocked, and one untouched holdout; 47 entries are P5 or
higher. Evidence is 1108 flat cases and 62/62 recursive graphs against the non-normative GNU R 4.6.0
advisor. Insight's first blocker is its retained `test:testthat.R` entry point because suggested
dependency `testthat` is unavailable. GNU R 4.6.1 remains normative.

## Profile 0.355 GPArotation rotation

The 54-release corpus contains 43 passing, ten blocked, and one untouched holdout; 47 entries remain
at P5 or higher. `GPArotation 2026.8-1` advances from P0 to P3 after generic grid, root-finding,
covariance normalization, and transposed matrix-product work closes installation and attachment. Its
`example:CCAI` workload first reaches the standard allocation budget, so later tiers remain
unclaimed. `palmerpenguins 0.1.1` is the replacement metadata-only P0 holdout.

Evidence is 1109 flat cases, 63 recursive graphs, 981 registered bindings, and 931 GNU-name
overlaps. The available GNU R 4.6.0 advisor is non-normative; GNU R 4.6.1 remains the release gate.

## Profile 0.356 GPArotation first-topic completion

The 54-release corpus remains 43 passing, ten blocked, and one untouched holdout; 47 entries are P5
or higher. GPArotation advances from P3 to P4 after reusable `setNames`, `sweep`, maximum-likelihood
`factanal`/`loadings`, and programmatic callback-call work completes `example:CCAI`. Its next
blocker is `example:GPA` at the explicit 100,000,000-step ceiling. `palmerpenguins 0.1.1` remains
unopened.

Evidence is 1110 flat cases, 64 recursive graphs, 984 registered bindings, 934 GNU-name overlaps,
and 224 explicitly associated recursive bindings. The available GNU R 4.6.0 advisor passes 64/64 but
remains non-normative; GNU R 4.6.1 remains the release gate.

## Profile 0.357 GPArotation complete-example closure

GPArotation advances from P4 to P5: deterministic installation, namespace load, attachment,
documentation discovery, and every installed example topic pass unchanged. Its first ordered failure
is now retained `test:MASSoblimin.R` expression 5 at missing default-path `datasets::ability.cov`,
so dependency-complete testing remains open.

Evidence is 1111 flat cases and 65 recursive graphs. The capability/name/status generators record
the exact binding and corpus totals for this profile; the available GNU R 4.6.0 advisor remains
non-normative and GNU R 4.6.1 remains the release gate.

## Profile 0.358 ability data and factor-analysis fidelity

The browser-owned `datasets` package now exposes `ability.cov` through its ordinary resource,
namespace, `data()`, default search-path, reset, and package-test paths. The compact covariance
facts come from an independently audited Oxford publication; GNU R remains only a black-box oracle
for object shape and behavior.

Generic `factanal()` now applies factor-count-scaled default starting uniquenesses, bounded scaled
optimization coordinates, limited-memory curvature updates, Kaiser normalization for default
varimax, and positive loading-column orientation. GPArotation's retained `MASSoblimin.R` test
advances from expression 5 to expression 17. It remains P5 because the package's `1e-6` comparison
still exposes a GNU L-BFGS-B convergence-path precision gap; no P6 claim is made. Evidence is 1113
flat cases and 66 recursive Oracle v2 graphs.

## Profile 0.359 exact factor analysis and GPArotation P7

The public Worker and inline runtimes now install a reproducibly generated L-BFGS-B 2.1 Wasm backend
behind the package-neutral bounded-optimizer interface. `factanal()` matches the pinned black-box
objective, uniquenesses, loadings, 18 function evaluations, 18 gradient evaluations, and convergence
result. Generic `stats::varimax()`, implicit single-column `matrix()` dimensions, filled/bordered
legend records and renderers, and package-test working-directory/per-expression semantics close the
successive retained GPArotation blockers.

The unchanged, digest-pinned `GPArotation 2026.8-1` artifact passes every applicable package-check
step and advances from P5 to P7 with `firstBlocker: null`. This does not promote other packages or
claim arbitrary pure-R package support. Evidence is 1115 flat cases and 66 recursive Oracle v2
graphs; GNU R 4.6.1 remains the normative release gate.

## Profile 0.360 palmerpenguins source-blind P7 evidence

The metadata-frozen `palmerpenguins 0.1.1` holdout was opened only after the prior GPArotation gate
closed. Its unchanged source archive installs and packs deterministically and passes all applicable
metadata, namespace, attachment, documentation, example, retained-test, saved-output and vignette
steps. The generic package check alone did not force its LazyData objects, so a separately authored
scenario did. That scenario exposed a real namespace-consistency gap: `requireNamespace("tibble")`
was true while the advertised compatibility namespace lacked `as_tibble`.

Reusable `tibble::as_tibble` conversion/name-repair behavior and Base `as.character.Date` now carry
both data promises. Their dimensions, names, tibble/data-frame classes, factor levels, missing
counts, selected records and Date strings agree with black-box GNU R observations. The pinned
artifact reaches P7, but arbitrary package compatibility remains unclaimed.

Generated evidence records 1117 flat cases, 66 recursive Oracle v2 graphs, 987 registered bindings,
937 GNU-name overlaps and 232 explicitly associated recursive bindings. The 54-release corpus has 45
passing and nine blocked entries; 49 reach at least P5 and six reach P7. Its partitions contain
seven development, 47 regression and temporarily zero holdout entries. The next rotation must freeze
metadata and a source digest before opening a replacement holdout. GNU R 4.6.1 remains normative;
the available GNU R 4.6.0 advisor is non-normative.

## Profile 0.361 polynom source-blind P7 evidence

The metadata-frozen `polynom 1.4-1` holdout now passes unchanged through deterministic installation,
namespace loading, attachment, documentation, every applicable Rd example, retained tests,
saved-output handling and vignette checks. An independent GNU-matched scenario exercises polynomial
construction, arithmetic, prediction, differentiation, integration, rounding, sum/product,
distinctness and roots. The artifact moves to development at P7 with `firstBlocker: null`.

Reusable closure includes `stats::deriv` S3 dispatch, single-variable `stats::poly`, implicit S3
group registration and metadata, method-local `NextMethod()` forwarding, callable Ops, Summary
dispatch, list distinctness and a general real eigensolver above order three. `deriv.default`,
multivariate `poly`, arbitrary ill-conditioned general eigen parity and arbitrary package support
remain explicit boundaries.

Generated evidence records 1120 flat cases, 68 recursive Oracle v2 graphs, 989 registered bindings,
939 GNU-name overlaps and 241 explicitly associated recursive bindings. The 55-release corpus has 46
passing and nine blocked entries; 50 reach at least P5 and seven reach P7. Its partitions contain
eight development, 47 regression and temporarily zero holdout entries. GNU R 4.6.1 remains
normative; the available GNU R 4.6.0 advisor is non-normative.

## Profile 0.362 estimability source-blind P7 evidence

The unchanged pinned `estimability 2.0.0` release advances from P0 holdout to P7 development after
all applicable generic package checks and an independent GNU-matched scenario pass. The profile adds
reusable `na.pass`, visible `qr.R`, model xlevel/contrast propagation, rank-deficient prediction,
and stored-call formula-update semantics without package-identity branches.

Generated evidence records 1126 flat cases, 72 recursive Oracle v2 graphs, 991 registered bindings,
941 GNU-name overlaps and 246 explicitly associated recursive bindings. After freezing the next
metadata-only candidate, the 57-release corpus has 47 passing, nine blocked, and one unevaluated
entry; 51 reach at least P5 and eight reach P7. Its partitions contain nine development, 47
regression and one holdout entry. GNU R 4.6.1 remains normative; the available GNU R 4.6.0 advisor
is non-normative.

## Profile 0.363 formatR source-blind P5 evidence

The unchanged pinned `formatR 1.14` holdout advances to P5 development: deterministic packaging,
namespace loading, documentation, all applicable Rd examples, and core `tidy_source()` execution
pass. Its retained upstream tests expose the next reusable blocker in width-sensitive deparse
layout, so P6/P7 remain unclaimed. Reusable closure includes normalized parse data, language-call
reconstruction including zero-formal functions, TRE newline matching, substitution coercion,
name-insensitive `all.equal()`, and exiting warning handlers.

## Profile 0.364 formatR source-blind P7 evidence

The unchanged `formatR 1.14` development artifact now passes every applicable generic package-check
step and an independently authored GNU R-matched formatting/usage scenario, advancing from P5 to P7
with `firstBlocker: null`. Reusable closure adds structural GNU-shaped deparse layout for nested
formulas/calls and noncanonical return calls, nesting-correct calling/exiting condition handlers,
and visibility preservation through warning suppression.

Checked-in flat conformance is 1128/1128 and recursive Oracle v2 is 74/74 under the local GNU R
4.6.0 advisor. GNU R 4.6.1 remains the normative release gate, and arbitrary pure-R package
compatibility remains unclaimed.

## Profile 0.365

The source-blind `lambda.r 1.2.4` dependency probe reaches P4 after generic parse-data and
one-dimensional `apply()` corrections. The explicit next blocker is R-level call-frame reflection
for `eval`/`source`/`example`; package-specific workarounds are not accepted.

## Profile 0.366

The unchanged pinned `lambda.r 1.2.4` dependency closure now reaches P7. Its complete applicable
generic package-check plan and an independently authored lambda scenario pass after reusable
`eval()` frame reflection, ellipsis parse-data classification, missing-name preservation,
`list2env()` behavior, and `na.fail` model-policy semantics were corrected. Production code has no
`lambda.r` identity branch.

Checked-in flat conformance is 1130/1130 and recursive Oracle v2 is 76/76 with the available GNU R
4.6.0 advisor. GNU R 4.6.1 remains normative. P7 applies only to the pinned artifact and exercised
surface; comprehensive GNU R and arbitrary pure-R package compatibility remain open program goals.

## Profile 0.367

The metadata-frozen `SQUAREM 2026.1` artifact advances from P0 holdout to development P7. The
unchanged package plus its pure-R `setRNG` example dependency pass every applicable generic
package-check step, including all retained tests, and a separately authored affine fixed-point
scenario matches GNU R.

Reusable closure adds `utils::modifyList`, Box-Muller normal streams and paired-cache behavior,
`qr()` dots/default dispatch for a `LAPACK` request, and `solve.qr` S3 execution. The optional
`interval` Suggests closure reaches native `survival` and is outside the applicable package checks.
Neither the P7 result nor acceptance of `LAPACK = TRUE` establishes arbitrary package or full LAPACK
pivot compatibility.

## Profile 0.368

The metadata-frozen unchanged `snow 0.4-4` artifact advances from P0 holdout to development P7.
Every applicable generic metadata, namespace, attachment, documentation, and runnable-example step
passes; the archive has no retained top-level tests or vignettes. An independent GNU-matched
in-memory S3 transport scenario exercises `clusterApply`, `clusterCall`, all four split helpers, and
remote-error aggregation without host process or socket access.

Reusable Base closure corrects blank/whitespace character conversion and character `NaN` integer
warning behavior. Checked-in flat conformance is 1132/1132 and recursive Oracle v2 is 78/78 with the
available GNU R 4.6.0 advisor. GNU R 4.6.1 remains normative; real SOCK/MPI launch, optional
`rlecuyer`, arbitrary packages, and comprehensive compatibility remain open.

## Profile 0.369

The metadata-frozen unchanged `futile.options 1.0.1` artifact advances from P0 holdout to
development P7. Its generic package checks and independent OptionsManager scenario pass without a
package identity branch or source rewrite. The first source-blind scenario exposed and selected a
general evaluator defect: method invisibility was discarded while crossing `UseMethod()` or
`NextMethod()`.

The evaluator now preserves S3 method visibility through direct and chained dispatch while allowing
a later enclosing expression to set the final visibility. Checked-in flat conformance passes
1133/1133 cases and recursive Oracle v2 passes 79/79 graphs with the available non-normative GNU R
4.6.0 advisor. GNU R 4.6.1 remains normative, and comprehensive or arbitrary-package compatibility
remains open.

## Profile 0.370

The metadata-frozen unchanged `futile.logger 1.4.9` artifact advances from P0 holdout to development
P7. Its complete applicable generic check plan and an independent logger-state scenario pass without
source rewrites or package-identity production branches. The retained package test is run with its
declared suggested `testit` dependency.

Ordered failures selected reusable fixes for character control-flow conditions, numeric `split()`
factor ordering including `NaN`, registered-environment formatting, and eager `tryCatch()` handler
list semantics. Checked-in flat conformance passes 1137/1137 cases and recursive Oracle v2 passes
81/81 graphs with the available non-normative GNU R 4.6.0 advisor. The corpus contains 62 pinned
releases: 15 development, 47 regression, and no current holdout; 53 are passing and 14 reach P7. GNU
R 4.6.1 remains normative, and comprehensive or arbitrary-package compatibility remains open.

## Profile 0.371

The metadata-frozen unchanged `tinytest 1.4.3` artifact advances from P0 holdout to development P7.
Its complete applicable generic package-check plan, runnable documentation examples, and retained
159-test self-test pass without source rewrites or package-identity production branches. Source and
deterministic installed-artifact digests are pinned.

Ordered failures selected reusable semantics across argument matching, dynamic frames, virtual
files/connections, factor and table conversion, PCRE replacement, core datasets, and the condition
system. In particular, supplied warning/message conditions retain custom classes, and automatic
vector-recycling warnings now participate in `tryCatch()`, `withCallingHandlers()`, and
`muffleWarning`. Checked-in flat conformance passes 1149/1149 cases and recursive Oracle v2 passes
92/92 graphs with the available non-normative GNU R 4.6.0 advisor. The corpus contains 63 pinned
releases: 16 development, 47 regression, and no current holdout; 54 are passing and 15 reach P7. GNU
R 4.6.1 remains normative, and comprehensive or arbitrary-package compatibility remains open.

## Profile 0.372

The metadata-frozen unchanged `permute 0.9-10` artifact advances from P0 holdout to development P7.
Metadata, namespace loading, attachment, documentation, all runnable Rd examples, and the vignette
pass through the generic package checker. The retained `testthat` launcher is not-applicable because
its declared suggested framework is unavailable; it is not reported as passed. Source and
deterministic installed-artifact digests are pinned.

Ordered failures selected reusable reflection, argument-frame, condition/restart, cumulative, group
reconstruction, formula graphics, and formula statistics semantics. Checked-in flat conformance
passes 1158/1158 cases and recursive Oracle v2 passes 93/93 graphs with the available non-normative
GNU R 4.6.0 advisor. The corpus contains 64 pinned releases: 17 development, 47 regression, and no
current holdout; 55 are passing and 16 reach P7. GNU R 4.6.1 remains normative, and comprehensive or
arbitrary-package compatibility remains open.

## Profile 0.373

The metadata-frozen unchanged `bigD 0.3.1` artifact advances from P0 holdout to development P7.
Metadata, namespace loading, attachment, documentation, and all four runnable Rd examples pass
through the generic package checker. Its retained `testthat` launcher is not-applicable because its
declared suggested framework is unavailable, and the package has no vignette manifest; neither is
reported as passed. Source and deterministic installed-artifact digests are pinned.

Ordered failures selected reusable bounded package-resource, serialized-input, and null
external-pointer semantics. Checked-in flat conformance passes 1159/1159 cases and recursive Oracle
v2 passes 94/94 graphs with the available non-normative GNU R 4.6.0 advisor. The corpus contains 65
pinned releases: 18 development, 47 regression, and no current holdout; 56 are passing and 17 reach
P7. GNU R 4.6.1 remains normative, and comprehensive or arbitrary-package compatibility remains
open.

## Profile 0.374

The metadata-frozen unchanged `pracma 2.4.6` artifact advances from P0 holdout to development P7.
The generic checker passes every applicable metadata, namespace, attachment, documentation, example,
and retained-test step. Declared-Suggests-only `NlcOptim` and `quadprog` example paths and the
absent vignette surface are not-applicable, not passing claims. Source and deterministic
installed-artifact digests are pinned.

Ordered failures closed reusable optimization, interpolation, probability, trigonometric,
linear-algebra, matrix-model, vector/array Ops, and package-check classification gaps. Checked-in
flat conformance passes 1183/1183 cases and recursive Oracle v2 passes 115/115 graphs with the
available non-normative GNU R 4.6.0 advisor. The corpus contains 66 pinned releases: 19 development,
47 regression, and no holdout; 57 are passing and 18 reach P7. GNU R 4.6.1 remains normative, and
comprehensive or arbitrary-package compatibility remains open.

## Profile 0.375

The metadata-frozen unchanged `boot 1.3-32` archive advances from P0 holdout to regression P4.
Generic parsing, installation, namespace loading, attachment, documentation coverage, and
representative `boot`/`boot.ci` examples pass. Fourteen applicable example topics execute; P5 is not
claimed because `example:control` first reaches the missing shared `stats::smooth.spline` contract.
The source and deterministic installed-artifact digests are pinned separately.

Seven new flat cases and seven recursive graphs close or strengthen package-neutral `identify`,
one-argument `seq`, `lm.influence`, data-frame expansion and automatic row-name storage, `xor`
including warning metadata, two-vector `var`, and `as.matrix.default` attribute/dimname rebuilding.
Checked-in flat conformance passes 1190/1190 cases and recursive Oracle v2 passes 122/122 graphs
with the available non-normative GNU R 4.6.0 advisor. The corpus contains 67 pinned releases: 19
development, 48 regression, and no current holdout; 57 are passing and 18 reach P7. GNU R 4.6.1
remains normative, and comprehensive or arbitrary-package compatibility remains open.

## Profile 0.376

The runtime adds package-neutral `stats::smooth.spline` and `predict.smooth.spline` contracts using
an independently implemented weighted natural-cubic penalty system, together with reusable
`stats::qqnorm`, `stats::qqplot`, `stats::glm.control`, and explicit missing-package `utils::data`
behavior. Integration, flat, and recursive GNU R evidence cover smoothing fits and predictions,
quantile coordinates and plotting, control defaults/storage/formals, and deterministic package-data
admission. Checked-in flat conformance passes 1194/1194 cases and recursive Oracle v2 passes 126/126
graphs with the available non-normative GNU R 4.6.0 advisor.

The unchanged `boot 1.3-32` artifact remains regression P4 but advances to nineteen applicable
passing example topics. Declared unavailable Suggests paths are classified not applicable rather
than passed. Its first ordered P5 blocker is now `example:saddle`, which reaches the missing shared
`stats::dnorm` primitive; `example:smooth.f` reaches the same reusable gap. The corpus remains 67
pinned releases: 19 development, 48 regression, and no current holdout; 57 are passing and 18 reach
P7. GNU R 4.6.1 remains normative.

## Profile 0.377

The runtime adds package-neutral `stats::dnorm` with vectorized density and log-density evaluation,
recycling, missing/non-finite/scale boundaries, attribute propagation, exact formals, and structured
warning-call evidence. Checked-in flat conformance passes 1195/1195 cases and recursive Oracle v2
passes 127/127 graphs with the available non-normative GNU R 4.6.0 advisor.

The unchanged `boot 1.3-32` artifact remains regression P4 but advances to twenty-one applicable
passing example topics. Its first ordered P5 blocker is now `example:tsboot`, which requests the
provenance-gated core `datasets::lynx` object. The corpus remains 67 pinned releases: 19
development, 48 regression, and no current holdout; 57 are passing and 18 reach P7. GNU R 4.6.1
remains normative.

## Profile 0.378

The browser core `datasets` package adds independently sourced CC0 `lynx` data through its ordinary
resource, data-script, autoload, and namespace paths. Executable evidence freezes all 114 values,
double `ts` shape, observable attribute order, time coordinates, aggregates, and identity. Flat
conformance passes 1196/1196 cases and recursive Oracle v2 passes 128/128 graphs with the available
non-normative GNU R 4.6.0 advisor.

The unchanged `boot 1.3-32` artifact remains regression P4 with twenty-one complete applicable
example topics. `example:tsboot` advances past `lynx` and now reaches the missing reusable
`stats::ar` contract. The corpus remains 67 pinned releases: 19 development, 48 regression, and no
current holdout; 57 are passing and 18 reach P7. GNU R 4.6.1 remains normative.

## Profile 0.379

The stats layer adds package-neutral univariate Yule-Walker `ar` and geometric-random `rgeom`
contracts. Integration plus flat and recursive GNU R evidence cover order selection, coefficients,
prediction and coefficient variance, partial autocorrelations, residual series, geometric support,
length/recycling, missing/domain behavior, warnings, and formals. Flat conformance passes 1198/1198
cases and recursive Oracle v2 passes 130/130 graphs with the available non-normative GNU R 4.6.0
advisor.

The unchanged `boot 1.3-32` artifact remains regression P4 with twenty-one complete applicable
example topics. `example:tsboot` now reaches the missing reusable `stats::arima.sim` contract. The
corpus remains 67 pinned releases: 19 development, 48 regression, and no current holdout; 57 are
passing and 18 reach P7. GNU R 4.6.1 remains normative.

## Profile 0.380

The stats layer adds package-neutral stationary univariate `arima.sim`. Integration plus flat and
recursive differential evidence cover explicit AR, MA, and mixed innovations, burn-in, custom R
random generators with forwarded arguments, time-series shape, formals, non-stationary rejection,
and the explicit integrated-model boundary. Flat conformance passes 1199/1199 cases and recursive
Oracle v2 passes 131/131 graphs with the available non-normative GNU R 4.6.0 advisor.

The unchanged `boot 1.3-32` artifact passes every applicable generic package-check step and advances
to regression P5. Its retained `parallel-censboot.R` test requires unavailable suggested package
`survival`, which is the ordered P6 dependency-closure blocker. The corpus remains 67 pinned
releases: 19 development, 48 regression, and no current holdout; GNU R 4.6.1 remains normative.

## Profile 0.381

The methods and stats layers add package-neutral `formalArgs` reflection and fully vectorized
`runif` bound semantics. Integration plus flat and recursive evidence cover function-name
reflection, primitive/empty cases, vector bounds, random-result length, invalid/empty bounds,
constant-interval RNG preservation, warning behavior, and public formals. Flat conformance passes
1201/1201 cases and recursive Oracle v2 passes 133/133 graphs with the available non-normative GNU R
4.6.0 advisor.

The metadata-first `DEoptimR 1.2-0` rotation passes the complete applicable generic package-check
plan and an independent GNU-matched fixed-seed optimizer scenario, reaching development P7. Its
three retained optimizer tests require an explicit finite 100,000,000-step evidence budget; default
runtime limits remain unchanged. The corpus now contains 68 pinned releases: 20 development, 48
regression, and no current holdout; 58 are passing and 19 reach P7. GNU R 4.6.1 remains normative.

## Profile 0.383

Shared call, collection, model, and graphics layers add provisional named-missing argument matching,
function-mode character `do.call()` lookup, vector `rep(times=)` after `each`, recursive list range,
one-dimensional model/barplot arrays, data-frame `apply()`, non-generic `%in%`, stripchart,
physical-inch symbols, pie, expression-text fallback, and disabled-axis detailed perspective
behavior. Checked-in flat conformance passes 1260/1260 cases and recursive Oracle v2 passes 144/144
graphs with the available non-normative GNU R 4.6.0 advisor.

The unchanged `plotrix 3.8-14` artifact remains development P4 but advances through the former
election/model blocker and successive graphics examples. Its first remaining example failure is
`raw.means.plot`, where upstream grouping/factor cardinality produces two source values and four
repetition counts. GNU R also rejects those `rep()` cardinalities; the next fix must address the
preceding shared grouping behavior. GNU R 4.6.1 remains normative.

That grouping blocker is now closed by preserving whole-column factor/class objects during
missing-row data-frame replacement and matching replacement attribute order. Shared `Ops.data.frame`
arithmetic, state-neutral inline plot margins, unknown non-graphical parameter warnings, and NULL
text labels then advance unchanged plotrix through `raw.means.plot`, `soil.texture`,
`staircasePlot`, and `triax.fill`. Flat conformance is 1265/1265 and recursive Oracle v2 is 146/146
on the advisory GNU R 4.6.0 installation. The current first blocker is `example:twoord.plot` at the
missing reusable `base::seq.Date` contract.

Profile 0.384 closes that blocker with generic `seq.Date` S3 behavior, then adds reusable
`graphics::axis.Date` ticks, labels, formals, and invisible Date results. GNU-compatible graphical
parameter forwarding for `rect()` and `polygon()` closes the later `twoord.stackplot` and
`violin_plot` failures. The unchanged pinned `plotrix 3.8-14` artifact now passes every applicable
step in the generic package-check plan and is recorded at P7 with no first blocker. Checked-in flat
conformance is 1268/1268 and recursive Oracle v2 is 147/147 using advisory GNU R 4.6.0 evidence; GNU
R 4.6.1 remains the normative target and the overall program objective remains incomplete.

## Profile 0.385

The source-blind `scatterplot3d 0.3-45` rotation now passes P0-P7 unchanged. Ordered execution
selected reusable `grDevices::xyz.coords`, recursive ordinary-list expansion in `data.frame`,
`plot.window(asp = NA)` sentinel behavior, and the independently sourced CC0 `datasets::trees`
resource. The deterministic installed artifact is
`61c69a67ab1f2d24456c0d352b0ba62adeb12c8abeb30ec259d9b1cea34d915d`; no first blocker or
package-specific production behavior remains for this pinned release. The overall GNU R and
arbitrary-package objective remains incomplete.

## Profile 0.386

The metadata-frozen unchanged `xmlparsedata 1.0.5` archive passes the complete applicable generic
package-check plan immediately and advances from holdout P0 to development P7. Its official source
SHA-256 and deterministic installed-artifact SHA-256 are pinned separately. A separately authored
scenario covers pretty XML construction from parse-data-shaped input, source-location attributes,
XML escaping, and token-name mapping and matches the available non-normative GNU R 4.6.0 black-box
advisor exactly. No reusable semantic blocker or package-specific production behavior was required.

The corpus now contains 72 pinned releases: 22 development, 50 regression, and temporarily no
holdout; 62 are passing, 10 are blocked, and 23 reach P7. GNU R 4.6.1 remains normative, and the
comprehensive GNU R and arbitrary-package objective remains incomplete.

## Profile 0.387

The metadata-frozen unchanged `mitools 2.4` archive advances from source-blind P0 to development P7.
Its ordered failures closed five reusable semantic gaps: lazy `with()` S3 dispatch; explicit-object
`UseMethod()` selection without rewriting the generic's actual arguments; formula class and
environment preservation through call-like subset selection; recursive parenthesized formula-term
expansion; and method-first `with()` dispatch when `expr` is absent but a method-specific named
argument is present. Integration, checked-in flat cases, and exact recursive Oracle v2 graphs cover
the resulting shared contracts.

The unchanged source now passes dependency closure, parsing, namespace loading, attachment, complete
export documentation, installed examples, retained-test handling, and every applicable generic
package-check step. Source and deterministic installed-artifact SHA-256 digests are pinned
separately. An independently authored synthetic multiple-imputation scenario covers construction,
data-mask dispatch, and mean/variance summaries. Checked-in flat conformance is 1277/1277 and the
available non-normative GNU R 4.6.0 advisor passes 153/153 recursive graphs; GNU R 4.6.1 remains the
normative release gate.

The corpus now contains 73 pinned releases: 23 development, 50 regression, and temporarily no
holdout; 63 are passing, 10 are blocked, and 24 reach P7. This artifact-scoped result does not claim
comprehensive GNU R or arbitrary pure-R package compatibility.

The subsequent metadata-only rotation freezes unopened `logger 0.4.2` at P0, bringing the current
corpus to 74 pinned releases: 23 development, 50 regression, and one holdout. It has not been
listed, extracted, parsed, installed, or executed.

## Profile 0.388

Scheduled source-blind execution of unchanged `logger 0.4.2` first stopped at its imported
`utils::assignInMyNamespace` binding. Generic implementations of `assignInMyNamespace()` and
`assignInNamespace()` now replace existing namespace bindings, preserve binding locks, return
invisible `NULL`, expose the expected formals, and reject missing bindings or non-package locations.
Integration, one new flat case, and one exact recursive graph cover the shared contract.

The pinned logger artifact now parses, loads, attaches, exercises both namespace mutation helpers,
and completes an independent `formatter_sprintf` logging scenario at P4. Its first installed-example
failure is `example:appender_file`. The same example fails under advisory GNU R 4.6.0 when optional
suggested package `glue` is absent, because the fallback formatter correctly requires a character
format. NativR keeps strict `sprintf` behavior; the P5 blocker is the optional `glue` dependency and
native-code closure. The corpus remains 74 releases but now contains 24 development, 50 regression,
and no holdout; 63 pass, 11 are blocked, and 24 reach P7. Comprehensive GNU R and arbitrary-package
compatibility remain incomplete.

## Post-0.388 metadata-frozen gridGraphics holdout

The fixed 2026-07-17 through 2026-08-15 usage window and complete official PACKAGES filter now
select untouched `gridGraphics 0.5-1` as the highest-ranked browser-purpose-admissible executable
candidate at 59,758 downloads. Higher-ranked host-service, static-font, native-header, and package-
scaffolding candidates retain their documented exclusions. Official metadata declares
`NeedsCompilation: no`, mandatory `grid` and `graphics`, imported `grDevices`, optional `magick` and
`pdftools`, and GPL >= 2 licensing.

Only the official archive bytes were downloaded. The unopened 69,207-byte archive is frozen at
SHA-256 `29086e94e63891884c933b186b35511aac2a2f9c56967a72e4050e2980e7da8b`; it has not been listed,
extracted, parsed, installed, or executed. The corpus now contains 75 pinned releases: 24
development, 50 regression, and one P0 holdout.

## Profile 0.389

The scheduled unchanged `gridGraphics 0.5-1` run opened the frozen archive only after its P0
provenance record was validated. Its first failure was the missing `grDevices::axisTicks` import at
namespace load. The shared implementation adds device-independent linear and logarithmic tick
generation, explicit and derived axis parameters, reversed ranges, short-span log linearization,
wide-span thinning, exact formals, and private `.axisPars`. Integration, flat conformance, and an
exact recursive Oracle graph cover the contract.

The deterministic installed artifact SHA-256 is
`74079d0602a9ff7d52ce7e2f954df44fc45317d2da2323ede8ae4bb25b130f88`. All unchanged package R source
parses, so the artifact reaches development P1. Its next namespace blocker is
`grDevices::contourLines`; no later package behavior is claimed. The corpus remains 75 releases but
now contains 25 development, 50 regression, and no holdout; 63 pass, 12 are blocked, and 24 reach
P7. Checked-in flat evidence is 1279 cases and recursive Oracle v2 is 155 graphs. GNU R 4.6.1
remains normative.

## Profile 0.390

The runtime now registers `grDevices::contourLines` as a browser-safe, device-independent numeric
primitive. Integration and differential evidence cover straight and closed contours, exact-level
vertices, saddle topology, missing-cell boundaries, packed coordinate input, formals, default
segment limits, constant-surface warnings, and bounded long-line truncation. Checked-in flat
conformance is 1281/1281 and recursive Oracle v2 is 156/156 with the available advisory GNU R 4.6.0;
pinned GNU R 4.6.1 remains normative.

The pinned unchanged `gridGraphics 0.5-1` artifact remains development P1. Its previous
`grDevices::contourLines` import succeeds, and generic namespace checking now reports
`grid::makeContent` as the first blocker. The corpus remains 75 releases: 25 development, 50
regression, no holdout; 63 passing, 12 blocked, and 24 at P7. Comprehensive GNU R and arbitrary
pure-R package compatibility remain incomplete.

## Profile 0.391

The grid package now exposes package-neutral `makeContent` and `makeContext` S3 lifecycle generics
and their identity default methods. Exact integration and recursive black-box evidence covers
caller-visible methods, registered package methods, multi-class `NextMethod()` progression,
arbitrary method return values, visibility, identity defaults, and public formals.

The unchanged `gridGraphics 0.5-1` artifact advances from development P1 to P5: namespace loading,
attachment, its imported-generic `makeContent.echogrob` registration, installed documentation, and
all applicable examples pass. Its first retained-test failure is `demo-graphics.R` expression 16 at
missing `grDevices::pdf.options`. The profile contains 1282 flat cases, 157 recursive Oracle graphs,
385 recursively evidenced bindings, and 1097 registered bindings. The 75-release corpus has 68 at
least P5, 24 at P7, 63 passing and 12 blocked; comprehensive compatibility remains incomplete.

## Profile 0.392

The runtime now exposes session-scoped `grDevices::pdf.options` state with the complete ordered
default surface, exact transactional option names, GNU R-compatible query/update/reset visibility,
mode-and-length mismatch warnings, and `pdf()` consumption of omitted defaults. Explicit `pdf()`
arguments remain device-local and do not mutate the option store.

The unchanged `gridGraphics 0.5-1` artifact remains development P5 but its first retained-test
failure advances from expression 16 to expression 17. The next blocker is package-check
infrastructure: a writable isolated working directory for relative PDF output. This is not a
graphics-semantic bypass or a P6 claim. The profile contains 1284 flat cases, 158 recursive Oracle
graphs, 388 recursively evidenced bindings, and 1098 registered bindings. The 75-release corpus has
68 at least P5, 24 at P7, 63 passing, and 12 blocked; comprehensive compatibility remains
incomplete.

## Profile 0.393

The standard package-check pipeline now copies installed test resources into a fresh writable
browser-memory work directory for both ordinary test execution and saved-output comparison. A
runtime test proves relative reads and writes succeed while the installed test tree remains
unchanged.

Grid now retains viewport-tree paths and implements `upViewport`, `downViewport`,
`current.viewport`, and `vpPath`, including invisible results, strict and descendant navigation,
top-level boundaries, and two-axis justification normalization. The profile contains 1285 flat
cases, 159 exact recursive Oracle graphs, 395 recursively evidenced bindings, and 1102 registered
bindings. The unchanged `gridGraphics 0.5-1` artifact remains P5 but advances through the
writable-workspace and viewport blockers; its first failure is now the recorded-plot display-list
operation descriptor contract. Comprehensive compatibility remains incomplete.

## Profile 0.394

Recorded plots now expose GNU-shaped operation descriptors for new-page, window, and box commands
without sacrificing normalized replay data. The profile contains 1286 flat cases, 160 exact
recursive Oracle graphs, 399 recursively evidenced bindings, and 1102 registered bindings. The
unchanged `gridGraphics 0.5-1` test advances to the shared `grid::grid.polygon` primitive and
remains P5; comprehensive compatibility remains incomplete.

## Profile 0.395

Grid polygon, segment, line, and point grob families now construct and draw through the shared
browser graphics journal. Seven primitive recorded operations have GNU-shaped dispatch descriptors.
The profile has 1287 flat cases, 161 recursive Oracle graphs, 412 recursively evidenced bindings,
and 1110 registered bindings. The unchanged `gridGraphics 0.5-1` test reaches expression 20; its
next blocker is generic lowering of composite boxplot journal events to ordered primitive
display-list operations. It remains P5 and comprehensive compatibility remains incomplete.

## Profile 0.396

Recorded composite boxplots are lowered into per-group primitive display-list entries in the
GNU-observed operation order and remain replayable through normalized browser graphics events. The
profile has 1288 flat cases, 162 recursive Oracle graphs, 412 recursively evidenced bindings, and
1110 registered bindings. The unchanged `gridGraphics 0.5-1` retained test completes expressions 1
through 23; expression 24 now selects the reusable `pairs.default` scatterplot-layout and
panel-function slice as its first blocker. It remains P5 and comprehensive compatibility remains
incomplete.

## Profile 0.397

A browser-native numeric matrix/data-frame `pairs` subset now emits reusable segment, point, and
text operations with diagonal labels, recycled point styles, title controls, lazy S3 dispatch, exact
generic formals, and invisible return. The unchanged `gridGraphics 0.5-1` retained test completes
expressions 1 through 25; expression 26 selects the missing `datasets::volcano` matrix and its
independent provenance as the next blocker. `pairs` remains shape-level because formula methods,
custom panels, logarithmic axes, and the complete GNU panel layout are not yet implemented. The
artifact remains P5 and comprehensive compatibility remains incomplete.

## Profile 0.398

The provenance audit keeps `datasets::volcano` unavailable: located mirrors derive from R or lack
resource-specific redistribution terms. Work therefore rotated to the independently frozen
`modeltools 0.2-24` pure-R holdout. Cleanup-only source hooks are now retained as explicit warnings
without executing shell code, while `configure*` remains a hard browser-packaging error. The runtime
registers the browser-core `stats4` dependency surface and adds GNU-observed `methods::prototype`
slot-default consumption plus the `stats::logLik` S3 generic. The unchanged package now installs,
loads, attaches, passes documentation checks, and executes representative S4 model-environment
construction at P4. Its first P5 blocker is the shared S4/model-environment `$` interaction in
`example:MEapply`; comprehensive compatibility remains incomplete.

## Profile 0.399

The ordered `modeltools 0.2-24` failure was resolved through four package-neutral contracts:
pairlist-tag `$` mutation on call objects, data-mask `model.frame(subset=)` evaluation with
duplicate row-name repair, top-level generic promotion by `setMethod(where=)`, and explicit S4
class-lineage queries through `methods::extends()`. The unchanged `MEapply` example now completes,
including cloning the model environment and applying `scale` to its design matrix. The package
remains P4 because the next installed example, `example:ModelEnvFormula`, passes a callable
`contr.treatment` generator in `contrasts.arg`; model-matrix contrast specifications currently
accept named generator strings or numeric matrices, not callable generators. Comprehensive
compatibility remains incomplete.

Generated evidence records 1,292 checked-in flat cases, 167 exact recursive Oracle v2 graphs, 415
recursively evidenced bindings, 1,113 registered bindings, and 1,027 of 2,522 GNU R inventory-name
overlaps. Name overlap remains an inventory metric, not a behavioral compatibility claim.

## Profile 0.400

`model.matrix(..., contrasts.arg=)` now invokes arbitrary R closure/builtin generators with the
factor levels as named argument `n`, validates their numeric matrix result, completes a short
independent result to `n - 1` columns through a deterministic orthogonal complement, rejects
singular generators, and stores the resolved matrix in model-matrix contrast metadata.
`stats::lm.fit()` adds direct QR fitting for vector and matrix responses with GNU-shaped result
fields.

These package-neutral contracts carry unchanged `modeltools 0.2-24` through every installed Rd
example and into `tests/regtest.R`, advancing it to P5. The first P6 blocker is expression 6: after
`na.omit()` processes a `ModelEnvFormula`, its design matrix has 90 rows while its response matrix
retains 100, and the following `lm.fit()` correctly rejects incompatible dimensions. Synchronized
omission across S4 model-environment components is the next measured contract.

Generated Profile 0.400 evidence records 1,294 flat cases, 169 exact recursive Oracle v2 graphs, 416
recursively evidenced bindings, 1,114 registered bindings, and 1,028 of 2,522 GNU R inventory-name
overlaps. Name overlap remains inventory only.

## Profile 0.401

The shared runtime now expands matrix and data-frame members of list inputs to `as.data.frame`,
preserves rows when `model.matrix` consumes an existing `na.pass` model frame, honors the mutable
terms intercept, tolerates unrelated extension arguments, and dispatches registered S4 methods for
NA actions. Promoting an ordinary function with `setGeneric` retains its default implementation and
formals.

These contracts synchronize omission across every component of an unchanged modeltools
`ModelEnvFormula`. The 0.2-24 artifact passes all installed examples, all 46 retained test
expressions, all applicable package checks, and an independent scenario, reaching scoped P7. This is
evidence for that pinned artifact, not a claim of general R-package compatibility.

Generated Profile 0.401 evidence records 1,297 flat cases and 170 exact recursive Oracle v2 graphs
covering 418 bindings. The runtime registers 1,114 bindings and overlaps 1,028 of 2,522 GNU R
inventory names. The corpus records 64 passing and 12 blocked artifacts, including 25 at P7.

## Profile 0.402

The stats namespace now exports central `qchisq()` and `qf()` quantiles through shared monotone
inversion paths. They recycle numeric parameters, preserve attributes from the longest argument,
support lower/upper tails and log probabilities without avoidable cancellation, reproduce boundary
and NaN behavior, and reject non-central requests explicitly.

The metadata-frozen unchanged ellipse 0.5.0 artifact now installs, loads, attaches, documents its
four exports, and passes an independent covariance-ellipse scenario. It reaches P4; its first
installed-example blocker is the browser-native `stats::arima0` model-fitting contract.

Generated Profile 0.402 evidence records 1,298 flat cases, 171 exact recursive Oracle v2 graphs, and
420 recursively evidenced bindings. The runtime registers 1,116 bindings and overlaps 1,030 of 2,522
GNU R inventory names. The 77-artifact corpus records 64 passing and 13 blocked artifacts, including
25 at P7.

## Profile 0.403

The utils namespace now exports GNU-compatible `findMatches()` and `rc.settings()` behavior for
completion matching, fuzzy fallback, name retention, syntactic backticks, control coercion,
warnings, ordered settings queries, invisible updates, and session-local defaults. Reference Class
methods receive a private `callSuper()` binding that traverses the same-name superclass method,
works through nested calls, and delegates a root `initialize` to generic named-field assignment
without exposing an instance member or public methods export.

These shared contracts carry the metadata-frozen, unchanged GlobalOptions 0.1.4 artifact from its
namespace and first-example blockers through every applicable package check and an independent
option-registry scenario to scoped P7. Its optional testthat launcher remains deterministically
not-applicable because testthat is only an unavailable Suggested dependency.

Generated Profile 0.403 evidence records 1,300 flat cases, 173 exact recursive Oracle v2 graphs, and
423 recursively evidenced bindings. The runtime registers 1,118 bindings and overlaps 1,032 of 2,522
GNU R inventory names. The 78-artifact corpus records 65 passing and 13 blocked artifacts, including
26 at P7.

## Profile 0.404

The shared apply/map implementation now treats language objects and expression vectors as valid
vector-like inputs, retaining call-entry tags and unevaluated language values. Character conversion
of a non-symbol call head now matches GNU R without leaking synthetic callee parentheses.

These contracts remove unchanged rbenchmark 1.0.1's first source-blind blocker. Its deterministic
artifact installs, loads, attaches, and passes an independent bounded benchmark at P4. Its installed
high-replication example is explicitly blocked by the package-test execution-step limit. Unchanged
ca 0.71.1 remains frozen and unevaluated at P0.

Generated Profile 0.404 evidence records 1,301 flat cases, 174 exact recursive Oracle v2 graphs, and
424 recursively evidenced bindings. The runtime registers 1,118 bindings and overlaps 1,032 of 2,522
GNU R inventory names. The 80-artifact corpus records 65 passing, 14 blocked, and one unevaluated
artifact, including 26 at P7.

## Profile 0.405

Qualified S3 methods for an absent Suggested-package generic are now recorded and registered when
that namespace later loads, without forcing or requiring the optional package. Shared table support
adds arbitrary-axis `margin.table()`, `as.data.frame.table()`, and independently sourced
browser-owned `HairEyeColor` and `UCBAdmissions` resources. Data-frame `dimnames<-` now updates row
and column names through the data-frame contract. Numeric plotting characters implement the GNU
single-byte range and warn while omitting invalid positive codes. `abbreviate()` supplies the
measured C-locale package path but remains honestly declared shape-level pending broader methods,
character-class, and locale closure.

These foundations carry the unchanged, pinned ca 0.71.1 artifact through namespace loading without
rgl, attachment, all 20 documentation checks, all ten applicable installed examples, and an
independently authored correspondence-analysis scenario to scoped P7. Absent tests and vignettes are
recorded as not applicable, not passed. Unopened nortest 1.0-4 is frozen as the next P0 holdout.

Generated Profile 0.405 evidence records 1,302 flat cases, 175 exact recursive Oracle v2 graphs, and
426 recursively evidenced bindings. The inventory records 1,121 registered names and 1,035 overlaps
with 2,522 GNU R callable names. The 81-artifact corpus has 66 passing, 14 blocked, and one
unevaluated artifact, including 27 at P7.

## Post-Profile 0.405 package evidence

The metadata-frozen, unchanged nortest 1.0-4 archive passes the generic source-package pipeline
without a new compatibility primitive. Namespace loading, attachment, all six documentation checks,
all five installed examples, and an independently authored scenario spanning every export pass; the
absent test and vignette manifests are classified not-applicable. The exact deterministic artifact
advances to scoped P7 without source rewriting or a package identity branch.

This evidence-only corpus revision does not change the 0.405 semantic capability profile or its
conformance counts. The 82-artifact corpus now has 67 passing, 14 blocked, and one unevaluated
artifact, including 28 at P7. Unopened tensor 1.5.1 is frozen as the next P0 source-blind holdout.

## Profile 0.406

Dimension replacement now follows the shared GNU R attribute-cleanup rule: assigning non-NULL
dimensions removes both ordinary names and dimension names before installing the new shape, even
when the extents are unchanged, while unrelated attributes survive. Assigning NULL removes the
dimension and dimension-name attributes.

This closes the first source-blind tensor 1.5.1 failure. The unchanged artifact passes the generic
installer, namespace and attachment lifecycle, exact export discovery, documentation, its installed
example, and an independently authored scenario covering outer products, multi-axis contractions,
dimension names, scalar contraction, infix shortcuts, and diagnostics. It reaches scoped P7 without
package-specific code.

Generated Profile 0.406 evidence records 1,303 flat cases, 176 exact recursive Oracle v2 graphs, and
426 recursively evidenced bindings. The inventory remains 1,121 registered names and 1,035 overlaps
with 2,522 GNU R callable names. The 83-artifact corpus has 68 passing, 14 blocked, and one
unevaluated artifact, including 29 at P7. Unopened registry 0.5-1 is frozen as the next holdout.

## Profile 0.407

The Base environment now exposes callable `[[<-` as a special primitive. Its final unnamed argument
matches `value`, and the shared replacement engine covers atomic vectors, lists/pairlists,
environments, language objects, dimensions, recursive index paths, deletion, extension, and S3/S4
dispatch. Installed browser-owned package demos are now catalogued and evaluated generically through
`utils::demo()`.

These package-independent contracts close registry 0.5-1's two source-blind blockers. The unchanged
artifact passes installation, namespace loading, attachment, six exports, four documentation checks,
three examples, the retained demo-driven test, vignette discovery, and an independent registry
scenario, reaching scoped P7. The exact artifact hash is pinned in the corpus ledger. Generated
Profile 0.407 evidence records 1,304 flat cases, 177 exact recursive Oracle v2 graphs, and 427
recursively evidenced bindings. The inventory contains 1,122 registered names and 1,036 overlaps
with 2,522 GNU R callable names. The 84-artifact corpus has 69 passing, 14 blocked, and one
unevaluated artifact, including 30 at P7. Unopened corpcor 1.6.10 is frozen as the next source-blind
P0 holdout.

## Profile 0.408

Real rectangular `svd()` now chooses the smaller Gram matrix and reconstructs the complementary
singular vectors, completing requested left and right bases deterministically. A 50-by-5,000 input
therefore allocates a 50-by-50 eigensystem instead of a 5,000-by-5,000 crossproduct, while retaining
bounded reconstruction, requested dimensions, and orthogonality evidence.

This package-independent change closes corpcor 1.6.10's first source-blind failure. The unchanged
artifact passes installation, namespace loading, attachment, all 29 exports, 16 documentation
checks, all 13 Rd examples, absent-test and absent-vignette classification, and an independent GNU
R-matched scenario spanning every export. It reaches scoped P7 with the default package-test limits
and no package-specific production behavior. Generated Profile 0.408 evidence records 1,305 flat
cases, 178 exact recursive Oracle v2 graphs, and 428 recursively evidenced bindings. The inventory
remains 1,122 registered names and 1,036 overlaps with 2,522 GNU R callable names. The 85-artifact
corpus has 70 passing, 14 blocked, and one unevaluated artifact, including 31 at P7. Unopened vipor
0.4.7 is frozen as the next source-blind P0 holdout.

## Profile 0.409

The shared runtime now provides callable `split<-` replacement with S3 dispatch and grouped
replacement across atomic, recursive, matrix, and data-frame values. `plot.default` admits and
validates scalar `las` values in the GNU zero-through-three range. Version-3 package serialization
accepts standard seven-bit ASCII native-encoding aliases without consulting the host, and
`stats::ave` is registered, attached, and reflected from its correct namespace with GNU-shaped
formals.

These reusable changes close the ordered blockers found by unchanged vipor 0.4.7 and by its
independent all-export scenario. The package passes installation, namespace loading, attachment, all
13 exports, 16 documentation checks, all 13 examples, explicit unavailable-Suggested test
classification, both vignettes, and the GNU R-matched scenario without package-specific production
behavior. Its deterministic artifact advances to scoped P7. Generated Profile 0.409 evidence records
1,307 flat cases, 180 exact recursive Oracle v2 graphs, and 430 recursively evidenced bindings. The
inventory contains 1,123 registered names and 1,037 overlaps with 2,522 GNU R callable names. The
86-artifact corpus has 71 passing, 14 blocked, and one unevaluated artifact, including 32 at P7.
Unopened dynamicTreeCut 1.63-1 is frozen as the next source-blind P0 holdout.

## Profile 0.410

Shared one-dimensional array subsetting and `sort.default()` now preserve reordered dimensions,
dimnames, and valid table class state while dropping the sole dimension for scalar and empty default
subsets. Object sorting ignores non-applicable `index.return` and `partial` controls. Table argument
labels use deparse-level-one rules, and the Base registry now exposes a GNU-shaped `charmatch()`
with exact/partial ambiguity, coercion, empty-string, `nomatch`, and formal-reflection behavior.

These reusable changes close the ordered source-blind blockers in unchanged dynamicTreeCut 1.63-1.
The package passes installation, namespace loading, attachment, all six exports, eight documentation
steps, both installed examples, absent-test and absent-vignette classification, and an independent
GNU R-matched all-export scenario. Its deterministic artifact advances to scoped P7. Generated
Profile 0.410 evidence records 1,309 flat cases, 182 exact recursive Oracle v2 graphs, and 432
recursively evidenced bindings. The inventory contains 1,124 registered names and 1,038 overlaps
with 2,522 GNU R callable names. The 87-artifact corpus has 72 passing, 14 blocked, and one
unevaluated artifact, including 33 at P7. Unopened pixmap 0.4-14 is frozen as the next source-blind
P0 holdout.

## Profile 0.411

The shared methods surface now passes a registered coercion's target class without losing GNU R's
omitted-formal marker, initializes a child S4 object from a parent instance, and exposes generic
`slot()`/`slot<-` access with GNU-shaped formals. `image.default()` admits `asp` and applies the
shared aspect-window calculation. The package-check planner records GNU version/platform-bound saved
transcripts as not applicable while leaving their retained R tests applicable.

These reusable contracts close the scheduled blockers in unchanged pixmap 0.4-14. Its pinned
artifact passes six documentation steps, four examples, both retained tests, and an independent GNU
R-matched constructor/coercion/channel/subsetting scenario. Profile 0.411 records 1,312 flat cases,
184 recursive Oracle v2 graphs, and 437 recursively evidenced bindings. The inventory has 1,126
registered names and 1,040 overlaps with 2,522 GNU R callable names. The 88-artifact corpus has 73
passing, 14 blocked, and one unevaluated artifact, including 34 at P7. Unopened moments 0.14.1 is
frozen as the next source-blind P0 holdout.

## Profile 0.416

The stats layer now exposes browser-native exponential and central Student-t densities with shared
distribution semantics for recycling, NA/NaN/infinities, invalid-domain warnings, attributes,
formals, logarithmic output, and signed zero. Flat and exact recursive GNU evidence cover both.

Unchanged ica 1.0-3 installs, loads, attaches, passes every applicable generic package-check step,
and passes an independent 11-export, ACY identity, and one-component FastICA scenario. Checked-in
evidence is 1,318 flat cases and 190 Oracle v2 graphs covering 443 bindings. The 93-artifact corpus
has 78 passing, 14 blocked, and one unevaluated artifact, including 39 at P7. Unopened proto 1.0.0
is frozen as the next source-blind P0 holdout. Non-central `dt` remains explicit future work.

## Profile 0.415

The Base comparison layer now exposes direct `all.equal.numeric` behavior, including the GNU
`countEQ` automatic-scale rule, and the methods layer exposes generic-registration introspection via
`isGeneric`. Both additions are package-neutral and have flat plus exact recursive GNU evidence.

Unchanged RUnit 0.4.33.1 installs, loads, attaches, passes 11 documentation checks, all seven Rd
examples, its installed vignette-resource check, and an independent all-export behavior scenario.
Checked-in evidence is 1,316 flat cases and 188 Oracle v2 graphs covering 441 bindings. The
inventory has 1,129 registered names and 1,042 GNU R overlaps. The 92-artifact corpus has 77
passing, 14 blocked, and one unevaluated artifact, including 38 at P7. Unopened ica 1.0-3 is frozen
as the next source-blind P0 holdout.

## Profile 0.414

The stats model layer now exposes numeric `predict.loess` S3 behavior for serialized pre-fitted
objects using independent local-polynomial reconstruction. This closes dichromat 2.0-1's first
unchanged blocker without package recognition. Its generic metadata, namespace, attachment,
documentation, example, data-resource, and independent color-transformation evidence all pass.

Checked-in evidence is 1,314 flat cases and 186 Oracle v2 graphs. The 91-artifact corpus has 76
passing, 14 blocked, and one unevaluated artifact, including 37 at P7. Unopened RUnit 0.4.33.1 is
frozen as the next source-blind P0 holdout. Exact loess kd-tree interpolation and standard-error
prediction remain explicit boundaries.

## Profile 0.413

`apply()` now supports arbitrary array rank and ordered multi-axis `MARGIN` selections. Its generic
coordinate traversal preserves complementary slice shape and dimnames and rebuilds simplified result
arrays with GNU-compatible margin dimensions. The first RSpincalc 1.0.2 blocker is therefore closed
without package recognition or source rewriting, and the unchanged artifact passes every applicable
generic check plus an independent GNU-matched scenario.

Checked-in evidence is 1,313 flat cases and 185 Oracle v2 graphs covering 438 bindings. The
90-artifact corpus has 75 passing, 14 blocked, and one unevaluated artifact, including 36 at P7.
Unopened dichromat 2.0-1 is frozen as the next source-blind P0 holdout.

## Profile 0.412

Unchanged moments 0.14.1 passes the complete applicable generic package-check plan on its scheduled
first run: metadata, namespace, attachment, 13 documentation checks, all 12 examples, and explicit
absent-test and absent-vignette classification. An independently authored GNU R-matched scenario
invokes every export across vectors, matrices, data frames, moment/cumulant transforms, and classed
hypothesis tests. The deterministic artifact reaches scoped P7 without a runtime primitive,
package-name branch, source patch, or relaxed resource limit.

Profile 0.412 intentionally retains 1,312 flat cases, 184 Oracle v2 graphs, and 437 recursively
evidenced bindings because it makes no new semantic callable claim. The inventory remains 1,126
registered names and 1,040 overlaps with 2,522 GNU R callable names. The 89-artifact corpus has 74
passing, 14 blocked, and one unevaluated artifact, including 35 at P7. Unopened RSpincalc 1.0.2 is
frozen as the next source-blind P0 holdout.

## Profile 0.417

Environment deparsing now returns GNU's stable `<environment>` representation, and `eapply()`
provides package-neutral current-frame enumeration, hidden-name control, non-hashed order, named
empty-list shape, lazy/active binding forcing, callback resolution, and dots forwarding. S3 subset
and replacement dispatch now retains the original target syntax observed by `substitute()`, while
replacement methods observe GNU's synthetic `*tmp*` target.

Those shared semantics carry unchanged proto 1.0.0 through installation, namespace loading,
attachment, complete documentation, both Rd example topics, vignette resources, applicable test
classification, and an independent prototype inheritance/mutation scenario. Checked-in evidence is
1,321 flat cases and 193 Oracle v2 graphs covering 449 bindings. The inventory has 1,132 registered
names and 1,045 GNU R overlaps. The 94-artifact corpus has 79 passing, 14 blocked, and one
unevaluated artifact, including 40 at P7. Unopened NLP 0.3-3 is frozen as the next source-blind P0
holdout.

## Profile 0.418

Actual-call argument accounting, generic S3 call frames for `merge()`, `subset()`, and `as.Date()`,
explicit ISO date parsing, `%OS`/`%z` `strptime()` fields, `write.dcf()`, and character `seq()`
endpoints close the reusable blockers selected by unchanged NLP 0.3-3. The generic package pipeline
passes metadata, namespace loading, attachment, all 16 documentation/example topics, explicit
absent-test and absent-vignette classification, and an independent GNU-matched annotation,
tokenization, feature, merge/subset, date, and time scenario.

Checked-in evidence is 1,328 flat cases and 200 Oracle v2 graphs covering 457 bindings. The
inventory has 1,134 registered names and 1,047 GNU R overlaps. The 95-artifact corpus has 80
passing, 14 blocked, and one unevaluated artifact, including 41 at P7. Unopened timeSeries 4052.112
is frozen as the next source-blind P0 holdout.

## Profile 0.420

Matrix utility and methods semantics now cover GNU-shaped `tail.matrix` row numbering, controls,
deprecation behavior, and formals; `na.contiguous.ts` attribute order; narrowly scoped first-method
promotion of `getDataPart` and `setDataPart`; formal atomic matrix data parts and slot ordering; and
S4 precedence plus complete formals for binary bind generics. The generic-promotion implementation
does not take over unrelated S3 or primitive functions.

Checked-in evidence is 1,360 passing flat cases and 232 passing Oracle v2 graphs covering 496
explicitly associated behavioral or numeric bindings. The inventory has 1,156 registered names and
1,065 overlaps with 2,522 GNU R callable names. The 96-artifact corpus remains 81 passing, 14
blocked, and one unevaluated artifact, including 42 at P7. Unopened `pls` 2.9-0 remains frozen as
the next source-blind P0 holdout. The recursive results use GNU R 4.6.0 only as an advisory
black-box oracle; GNU R 4.6.1 remains normative.

## Profile 0.421

Package-neutral matrix-column subsetting, generic `terms`/`model.matrix` fallback and formals,
character formula updates, observable QR signs and transforms, triangular solves, and lazy `matplot`
panel hooks close the ordered blockers exposed by unchanged `pls` 2.9-0. The standard package-check
path passes installed identity, namespace loading, attachment, all 43 exports and their
documentation, every applicable example, and the installed vignette. The `cppls.fit` example is
explicitly not applicable because it requires unavailable Suggested `MASS`; no top-level tests
exist. Independent yarn PLS prediction and mayonnaise matrix-response scenarios pass without a
package-specific runtime path.

Checked-in evidence passes 1,371 flat cases and 241 exact recursive Oracle v2 graphs covering 514
explicitly associated behavioral or numeric bindings. The inventory has 1,173 registered names and
1,077 overlaps with 2,522 GNU R callable names. The 97-artifact corpus has 82 passing, 14 blocked,
and one unevaluated release, including 43 at P7. Unopened `stargazer` 5.2.3 is frozen as the next
source-blind P0 holdout. Recursive results use GNU R 4.6.0 only as an advisory black-box oracle; GNU
R 4.6.1 remains normative.

## Profile 0.422

Independent `datasets::attitude` provenance, central `stats::pf` probability semantics, and
matrix-constrained `cbind`/`rbind` recycling close the ordered reusable blockers exposed by
unchanged `stargazer` 5.2.3. Binding now covers longer vectors, positive-extent omission of empty
vectors, zero-extent row/column retention, common type, and continued strict agreement among matrix
inputs.

The generic package-check path passes installed identity, namespace loading, attachment, all export
documentation, and the complete installed Rd example. The package has no top-level tests or
installed vignettes. A separately authored GNU R 4.6.0 black-box-matched regression scenario
verifies exact 13-line text output without source rewriting or a package identity path. The
checked-in flat suite passes 1,374/1,374; all 244 recursive graphs pass against the available
non-normative GNU R 4.6.0 advisor and cover 516 explicitly associated behavioral or numeric
bindings. The inventory has 1,174 registered names and 1,078 overlaps with 2,522 GNU R callable
names. The 98-release corpus has 83 passing, 14 blocked, and one unevaluated artifact, including 44
at P7. Unopened `lgr` 0.5.2 is frozen as the next source-blind P0 holdout; GNU R 4.6.1 remains
normative.

## Profile 0.423

GNU-shaped `format.default`, portable `tools::file_ext`, and vectorized `strtrim` semantics close
the ordered reusable blockers exposed by unchanged `lgr` 0.5.2. The package-check engine now treats
a missing optional package as not applicable only when the failure identifies an unavailable
declared `Suggests` dependency; other namespace failures remain deterministic blockers.

The unchanged package passes installation, namespace loading, attachment, export documentation, all
applicable installed examples, and its installed vignette. Independently authored logging evidence
verifies R6 Logger/AppenderBuffer thresholds, filtering, event fields, classes, and ordering. Flat
conformance passes 1,377 cases; all 247 recursive Oracle v2 graphs pass against the advisory GNU R
4.6.0 installation and cover 519 bindings. The inventory has 1,177 registered names and 1,080
overlaps with 2,522 GNU R callable names. The 99-release corpus has 84 passing, 14 blocked, and one
unevaluated artifact, including 45 at P7. Unopened `operator.tools` 1.6.3.1 is the next P0 holdout;
GNU R 4.6.1 remains normative.

## Profile 0.424

The runtime now installs the locked Base R `.Options` pairlist during evaluator construction,
synchronizes it with `options()` across the base environment and base namespace, and recreates it on
reset. Updates, removals, visibility, core entry order, and ordinary user-environment shadowing have
direct integration and GNU R differential evidence.

Unchanged `operator.tools` 1.6.3.1 passes installation, namespace loading, attachment, export
documentation, every applicable package-check step, and an independent GNU-matched custom-operator
scenario. Flat conformance passes 1,378 cases; all 248 recursive Oracle v2 graphs pass against the
advisory GNU R 4.6.0 installation and cover 519 callable bindings. The inventory remains 1,177
registered names and 1,080 overlaps with 2,522 GNU R callable names. The 100-release corpus has 85
passing, 14 blocked, and one unevaluated artifact, including 46 at P7. Unopened `stabledist` 0.7-2
is the next P0 holdout; GNU R 4.6.1 remains normative.

## Profile 0.425

Reusable `uniroot` explicit-bound and infinite-endpoint semantics, GNU-shaped `stats::ecdf`
closures, `plot.ecdf` S3 graphics, browser-native `graphics::rug`, and general
`grDevices::adjustcolor` RGBA transforms close the ordered blockers exposed by unchanged
`stabledist` 0.7-2. Integration evidence covers closure reflection, missing and `NaN` boundaries,
graphics-journal operations, color transforms, formals, and deterministic errors.

The unchanged package passes installation, namespace loading, attachment, complete export
documentation, every installed example, and the applicable package-check plan. An independent
GNU-matched scenario covers stable density, probability, quantile, mode, and random generation. Flat
conformance passes 1,379 cases, and the new recursive graph passes exactly against the advisory GNU
R 4.6.0 installation. The 101-release corpus has 86 passing, 14 blocked, and one unevaluated
artifact, including 47 at P7. Unopened `formula.tools` 1.7.1 is the next P0 holdout; GNU R 4.6.1
remains normative.

## Profile 0.426

Reusable `utils::apropos`, expression-vector replacement, `stats::terms.formula`, GNU-shaped
`as.name`/`as.symbol` symbol and atomic coercion, and compact arithmetic deparse spacing close the
ordered blockers exposed by unchanged `formula.tools` 1.7.1. The implementation is shared across the
Base, stats, utils, expression, and language layers and contains no package identity branch.

The unchanged package passes installation, namespace loading, attachment, complete export
documentation, every applicable installed example, deterministic unavailable-Suggested test
classification, and absent-vignette classification. An independent GNU-matched scenario exercises
every ordinary public export plus formula conversion and terms dispatch. Flat conformance passes
1,381 cases; the new recursive graph passes against the advisory GNU R 4.6.0 installation. The
inventory has 1,183 registered names and 1,086 overlaps with 2,522 GNU R callable names. The
102-release corpus has 87 passing, 14 blocked, and one unevaluated artifact, including 48 at P7.
Unopened `gridBase` 0.4-7 is the next P0 holdout; GNU R 4.6.1 remains normative.

## Profile 0.427

Reusable `grid::current.transform`, `grid::get.gpar`, `rectGrob`/`grid.rect`, and
`graphics::par(mfg=)` layout semantics close the ordered blockers exposed by unchanged `gridBase`
0.4-7. Direct tests cover nested and rotated viewport transforms, device-inch extents, graphical
parameter defaults and cumulative inheritance, rectangle grob shape and drawing, layout
synchronization, formals, warnings, and deterministic errors.

The unchanged package passes all applicable generic package-check steps and a separate all-export
scenario. Flat conformance is 1,385/1,385; the recursive inventory contains 251 graphs and 532
explicitly associated bindings, with the new graph passing against advisory GNU R 4.6.0. The name
inventory has 1,187 registered bindings and 1,086 overlaps with 2,522 GNU R callable names. The
103-release corpus has 88 passing, 14 blocked, and one unevaluated artifact, including 49 at P7.
Unopened `gsubfn` 0.7 is the next P0 holdout; GNU R 4.6.1 remains normative.

## Profile 0.428

Standard lifecycle hooks are now excluded from ordinary export-documentation coverage by a generic
package-check rule with synthetic fixture evidence. Unchanged `gsubfn` 0.7 reaches development P4
after passing loading, attachment, documentation, two examples, absent-test classification, and its
vignette. Missing `datasets::BOD` in `example:fn` is its first remaining blocker.

The 103-release corpus has 88 passing and 15 blocked artifacts, including 49 at P7 and no current
holdout. Flat conformance remains 1,385/1,385 and recursive evidence remains 251 graphs with 532
binding associations. GNU R 4.6.1 remains normative.

## Profile 0.429

Reusable `BOD`/`CO2` data resources, data-frame aggregation, compound formula language, complete
standard `matplot` type admission, conjugate-gradient `optim`, and atomic `rep()` count coercion
advance unchanged `gsubfn` 0.7 through the `as.function.formula`, `fn`, `gsubfn-package`, `gsubfn`,
`match.funfn`, and `transform2` examples. The package remains development P4; `example:list` now
stops first because its unqualified `month.day.year` call follows `require(chron)`, while `chron` is
an unresolved Suggested dependency rather than a Base R API.

Flat conformance is 1,392/1,392. Recursive evidence contains 257 exact graphs with 533 explicit
binding associations. The corpus remains 103 releases with 88 passing, 15 blocked, and 49 at P7. GNU
R 4.6.1 remains the normative release gate.

## Profile 0.430

Repository installs can now select an explicit declared Suggests subset and preserve the normalized
none/all/selected decision in lock format v2. Invalid, duplicate, undeclared, or conflicting
selections fail deterministically. Resolving unchanged `gsubfn` with selected `chron` reaches the
current artifact and rejects its compilation plus native-library requirements at the pure-R phase
boundary; the default mandatory-only closure remains `proto` plus `gsubfn`.

Base semantics now match GNU R's `isOpen(rw=)` partial-selection behavior and make `read.pattern`
pass. `get`, `get0`, `mget`, and `exists` skip inherited same-name bindings that do not match the
requested mode, which closes an additional unchanged `strapply` path. `utils::combn` simplified
callbacks preserve scalar, vector, and array result dimensions. Flat evidence is 1,394/1,394 with
1,337 live-R-eligible cases; recursive evidence is 260/260 with 536 distinct bindings, and the
corpus remains 103 releases with 88 passing, 15 blocked, and 49 at P7. GNU R 4.6.1 remains
normative.

The next source-blind P0 gate is unopened `tinytable 0.18.0`, the highest-ranked executable,
purpose-admissible candidate after the documented exclusions in the fixed 2026-07-27 through
2026-08-25 window. Official metadata declares only browser-core `methods` as mandatory and no native
compilation. Its source URL, 440,097-byte length, and SHA-256
`83a69d454d2c9333cd4d54bb6c12bc6970d034545c17b260fe4a87e6be04324c` are frozen without opening the
archive. The 104-release corpus has 88 passing, 15 blocked, one unevaluated, and 49 at P7.

## Profile 0.431

The source-blind `tinytable 0.18.0` rotation is complete at regression P7. Its fixed archive and
deterministic artifact pass all browser-applicable installation, namespace, attachment,
documentation, example, and retained-test checks, plus an independently authored GNU-matched S4
format/style composition. `data.table` remains an unselected `Suggests` edge and `knitr` remains an
unselected `Enhances` edge; both are reported as explicit non-applicable example paths rather than
runtime failures or silently installed packages.

The blocker sequence added reusable S4 slot replacement validation and the lazy primitive
`...names()`. Full recursive verification also closed atomic-data S4 default slot materialization
before initialization. Flat conformance is 1,397/1,397 with 1,340 live-R-eligible cases; recursive
Oracle v2 is 262/262 graphs with 539 distinct binding associations. The GNU R name inventory reports
1,188 registered bindings and 1,087 overlaps out of 2,522 reference names. The corpus has 104
releases: 89 passing, 15 blocked, 50 at P7, and no unevaluated holdout. GNU R 4.6.1 remains
normative.

## Profile 0.432

The unchanged `magic 1.6-1` rotation now reaches development P7. Its fixed source and deterministic
artifact pass installation, mandatory `abind` closure, namespace loading, attachment, complete
export/help coverage, every applicable example, retained `aaa.R`, the installed vignette, and an
independently authored GNU-matched scenario spanning square/product construction, block diagonals,
Latin squares, and multidimensional shifts.

Ordered blockers closed reusable semantics for primitive `rep()` dots and S3 dispatch,
`stats::optim(method = "SANN")`, `noquote()`, coordinate-matrix admission, zero-selection atomic
replacement promotion, RHS-before-subscript chained replacement, and shape-preserving wholly missing
array subscripts. The opt-in package-test profile admits four million elements while the interactive
default remains one million. Flat conformance is 1,404/1,404 with 1,347 live-R-eligible cases;
recursive Oracle v2 is 269/269 graphs with 541 distinct binding associations. The corpus has 105
releases: 90 passing, 15 blocked, 51 at P7, and no unevaluated holdout. GNU R 4.6.1 remains
normative.

The generated GNU R name inventory contains 1,189 registered bindings and 1,088 overlaps among 2,522
reference core callable names; these counts remain discovery metrics rather than behavioral
compatibility evidence.

## Post-0.432 source-blind gate

Unopened `countrycode 1.9.0` is frozen at P0 from official metadata and the fixed 2026-07-29 through
2026-08-27 usage window. It has no mandatory package dependency or native compilation requirement;
its exact 539,016-byte archive and SHA-256 are recorded without listing or reading source members.
The corpus now contains 106 releases: 90 passing, 15 blocked, one unevaluated holdout, and 51 at P7.

The exact archive has now entered scheduled source-blind execution and is recorded at development
P4. Its deterministic artifact is pinned, and installation, metadata, namespace/attachment, complete
help coverage, and three of four example topics pass. The first frozen diagnostic is
`example:countrycode: sourcevar must be a character or numeric vector.` The shared blocker is
`as.data.frame()` behavior for inherited `tbl_df`/`tbl`/`data.frame` classes: NativR currently
retains the subclass, causing a later one-column subset to remain list-like instead of atomic. The
corpus therefore has 90 passing, 16 blocked, no unevaluated holdout, and 51 P7 releases while this
generic S3/data-frame contract is addressed.

Profile 0.433 closes that contract. S3 dispatch now reaches the inherited `as.data.frame.data.frame`
method after trying more-specific classes; the method reduces the class to `data.frame` while
preserving columns, row names, and unrelated attributes, and honors an explicit replacement
`row.names`. Flat, integration, and exact recursive GNU black-box tests cover both inherited
fallback and more-specific overrides. The unchanged package consequently passes all applicable
checks and advances to P7. Corpus totals are now 91 passing, 15 blocked, zero unevaluated, and 52 P7
releases among 106 pinned releases.

The next metadata-only gate freezes unopened `implied 0.5` at P0 from official metadata and the
fixed 2026-07-30 through 2026-08-28 usage window. It has no mandatory package dependency or native
compilation requirement; its exact 43,534-byte archive and SHA-256 are recorded without listing or
reading source members. The corpus now contains 107 releases: 91 passing, 15 blocked, one
unevaluated holdout, and 52 at P7.

The exact artifact has now entered scheduled source-blind execution at development P6. All
applicable generic package-check steps pass, but the independently frozen all-method numeric
scenario first differs in `jsd`: GNU R rounds the first probability to `0.2315189095`, while NativR
returns `0.23152114`. Power-method inverse conversion also exposes solver drift. The corpus now has
91 passing, 16 blocked, no unevaluated holdout, and 52 P7 releases; the discrepancy was recorded
before package-source inspection.

Profile 0.434 closes the reusable `stats::uniroot` gap: the Brent safeguard compares interpolation
against the previous actual step, `estim.prec` exposes the final bracket width, and `f.root` comes
from a final observable callback evaluation at the selected root. Integration, flat, and exact
recursive black-box tests cover the full evaluation sequence. The unchanged `implied 0.5` artifact
and eight-method scenario then pass and advance to P7. Corpus totals are now 92 passing, 15 blocked,
zero unevaluated, and 53 P7 releases among 107 pinned releases.

The next metadata-only gate freezes unopened `sfsmisc 1.1-25` at P0 from official metadata and the
fixed 2026-07-30 through 2026-08-28 usage window. It imports only browser-core packages and has no
native compilation requirement; its exact 190,824-byte archive and SHA-256 are recorded without
listing or reading source members. The corpus now contains 108 releases: 92 passing, 15 blocked, one
unevaluated holdout, and 53 at P7.

The exact `sfsmisc` artifact has now entered scheduled execution at development P0. Its
deterministic artifact is pinned, but packaging first fails with `NRPKG1010` before R-source parsing
because the safe NAMESPACE selector does not yet accept the package's standard unbraced and nested
platform conditionals. The blocker was recorded before inspecting that declaration. Corpus totals
are now 92 passing, 16 blocked, zero unevaluated, and 53 P7 releases among 108 pinned releases.

Profile 0.435 closes that generic selector gap and the ordered reusable namespace imports through
`stepfun`. Browser-admissible behavioral additions include Cairo PDF device lifecycle,
platform-shaped graphics-library reporting, panel layout, central chi-square and gamma distribution
functions, S3 generic/action behavior, loess control records, and callable step functions.
PostScript, loess fitting, and multi-panel `plot.ts` are exposed only as deterministic capability
boundaries. The same unchanged `sfsmisc 1.1-25` artifact reaches P1 and now stops at missing
`stats::symnum`. Corpus totals remain 92 passing, 16 blocked, zero unevaluated, and 53 P7 releases
among 108 pinned releases.

Profile 0.436 adds behavioral `stats::symnum`, term-normalizing `stats::update.formula`, and
formula-as-language `as.list` structure with attribute retention. Flat, integration, and exact
recursive GNU black-box evidence covers symbolic values, dimensions, dimnames, legends, formals,
formula sides, term deletion, generic update routing, environment identity, and language entries.
The unchanged `sfsmisc 1.1-25` artifact remains at P1 and now stops at missing
`utils::count.fields`. Corpus totals remain 92 passing, 16 blocked, zero unevaluated, and 53 P7
releases among 108 pinned releases.

Profile 0.437 adds behavioral `utils::count.fields` at the shared virtual-I/O layer. Flat,
integration, and exact recursive GNU black-box evidence covers path and connection input, cursor
consumption, separator/quote/comment controls, blank and skipped lines, explicit empty fields,
multiline physical-line `NA` markers, return type, validation, and complete formals. The unchanged
`sfsmisc 1.1-25` artifact remains at P1 and now stops at missing `tools::Rcmd`. Corpus totals remain
92 passing, 16 blocked, zero unevaluated, and 53 P7 releases among 108 pinned releases.

Profile 0.438 exposes `tools::Rcmd` with exact callable shape and a deterministic browser host-
process boundary. The unchanged `sfsmisc 1.1-25` artifact consequently passes namespace loading,
attachment, complete documentation discovery, and representative example execution, advancing from
P1 to P4. Its first P5 blocker is `example:D1D2`, where the shared `plot()` path rejects non-real
coordinates. Corpus totals remain 92 passing, 16 blocked, zero unevaluated, and 53 P7 releases among
108 pinned releases; all 108 now reach at least P4.

Profile 0.439 adds exported behavioral `graphics::plot.function` through the shared curve/plot
pipeline. The method evaluates closures over the endpoint sequence, follows GNU endpoint precedence,
returns the invisible coordinate list, forwards ordinary graphical controls, and preserves integer
storage for integer-valued `seq.int` sequences. The unchanged `sfsmisc 1.1-25` artifact passes
`example:D1D2` and remains at P4; its next P5 blocker is `example:D2ss`, where the existing
`smooth.spline` implementation reaches its documented 256-unique-observation browser limit. Corpus
totals remain 92 passing, 16 blocked, zero unevaluated, and 53 P7 releases among 108 pinned
releases.

Profile 0.440 replaces the old unique-observation ceiling for default `smooth.spline` calls with a
bounded active-knot policy. Large fits retain full public observation, fitted-value, leverage, and
prediction shapes while explicit requests above 256 knots remain resource-bounded. The unchanged
`sfsmisc 1.1-25` artifact passes `example:D2ss` and remains at P4; its next P5 blocker is
`example:Duplicated`, where `base::match` lacks the standard `incomparables` argument. Corpus totals
remain 92 passing, 16 blocked, zero unevaluated, and 53 P7 releases among 108 pinned releases.

Profile 0.441 implements the standard `base::match(incomparables=)` contract for atomic and
recursive values with exact formals. The unchanged `sfsmisc 1.1-25` artifact passes
`example:Duplicated` and remains at P4; its next P5 blocker is `example:QUnif`, where `plot.default`
does not yet admit `xpd`.

Profile 0.442 admits scalar `plot.default(xpd=)` controls with GNU R-shaped length validation and
state neutrality. The unchanged `sfsmisc 1.1-25` artifact passes `example:QUnif` and remains at P4;
its next P5 blocker is `example:TA.plot`, where the reusable standard `stack.x` helper is absent.
This is control admission evidence, not a claim that expanded figure/device clipping is complete.

Profile 0.443 adds the complete public-domain Brownlee stack-loss dataset family to the generic
browser-owned `datasets` resource path. The unchanged `sfsmisc 1.1-25` `example:TA.plot` advances
past `stack.x` and now freezes missing `datasets::airquality` as its first blocker. The artifact
remains at P4 and no package-specific runtime path was introduced.

Profile 0.444 adds the complete PDDL-1.0 `airquality` table through that same generic `datasets`
resource path. Exact flat, integration, and recursive evidence covers its shape, types, missingness,
values, aggregates, row names, and namespace identity. The unchanged `sfsmisc 1.1-25` package now
classifies `example:TA.plot` as not applicable because it requires unavailable Suggested package
`nlme`; its first P5 blocker advances to `example:axTexpr`, where `:` rejects a non-finite endpoint.
The artifact remains at P4 and no package-specific runtime path was introduced.

Profile 0.445 synchronizes logarithmic window parameters and makes `graphics::axTicks` state-aware.
The unchanged `sfsmisc 1.1-25` `example:axTexpr` now passes, including its public logarithmic-axis
example. Its first P5 blocker advances to `example:compresid2way`, where `stats::dummy.coef` does
not yet dispatch for an object with class `c("aov", "lm")`. The artifact remains at P4 and no
package-specific branch was introduced.

Profile 0.446 implements the reusable `stats::dummy.coef.lm` S3 method from fitted model metadata.
The unchanged `sfsmisc 1.1-25` `example:compresid2way` now passes. Its ordered first P5 blocker
advances to `example:eaxis`, where `base::format.info` is unavailable. The artifact remains at P4
and no package-specific runtime path was introduced.

Profile 0.447 implements the reusable `base::format.info` atomic formatting contract. The unchanged
`sfsmisc 1.1-25` `example:eaxis` now passes its formatting-information stage and reaches the next
explicit boundary: `hist.default(..., xaxt=)` is outside the browser histogram subset. The artifact
remains at P4 and no package-specific runtime path was introduced.

Profile 0.448 implements reusable histogram `xaxt`/`yaxt` forwarding, validation, state neutrality,
and plot-disabled laziness. The unchanged `sfsmisc 1.1-25` `example:eaxis` now passes completely;
its ordered first P5 blocker advances to `example:formatN`, where numeric scientific penalties were
not accepted. The artifact remains at P4 and no package-specific branch was introduced.

Profile 0.449 implements logical and numeric `format(..., scientific=)` controls through the shared
atomic formatting path, including truncated integer penalties and the session `scipen` default. The
unchanged `sfsmisc 1.1-25` `example:formatN` now passes. Its ordered first P5 blocker advances to
`example:hatMat`, where reusable `stats::ksmooth` is unavailable. The artifact remains at P4 and no
package-specific branch was introduced.

Profile 0.450 implements reusable `stats::ksmooth` box and normal kernel regression. The unchanged
`sfsmisc 1.1-25` `example:hatMat` advances through kernel smoothing and is classified not applicable
because it requires unavailable Suggested package `Matrix`. Its ordered first P5 blocker is now
`example:helppdf`, where the browser file/PDF lifecycle leaves the expected output path absent for
`file.exists()`. The artifact remains at P4 and no package-specific branch was introduced.

Profile 0.451 implements generic browser-owned PDF rendering for any resolved core or installed
source-package help page. Printing PDF help writes a bounded `%PDF` artifact into the current
virtual directory without a browser request or host toolchain, and the documented `stats::Normal`
topic now resolves through the shared core-help catalog. The unchanged `sfsmisc 1.1-25`
`example:helppdf` passes without source changes. Its ordered first P5 blocker advances to
`example:inv.seq`, whose second inverse-sequence result differs under `all.equal`. The artifact
remains at P4 and no package-specific branch was introduced.

Profile 0.452 implements GNU-compatible deparse-based equality for language objects. The unchanged
`sfsmisc 1.1-25` `example:inv.seq` now accepts an inverse-sequence call whose negative ranges are
constructed from numeric constants but deparse identically to the parsed source call. Its ordered
first P5 blocker advances to `example:iterate.lin.recursion`, where `plot.ts` multi-panel rendering
is not implemented. The artifact remains at P4 and no package-specific branch was introduced.

Profile 0.453 implements the reusable univariate and explicit single-panel portions of
`stats::plot.ts`. Direct calls and ordinary `plot.ts` S3 dispatch share the existing regular
time-series graphics journal; true multi-panel and two-series phase plots remain explicit. The
unchanged `sfsmisc 1.1-25` `example:iterate.lin.recursion` now passes. Its ordered first P5 blocker
advances to `example:linesHyperb.lm`, where generic `predict.lm` rank-deficiency behavior is
incomplete. The artifact remains at P4 and no package-specific branch was introduced.

Profile 0.454 adds GNU-compatible unique partial matching for `predict.lm(newdata=)` and finite
upper bounds for extreme expanded logarithmic plot windows. The unchanged `sfsmisc 1.1-25` examples
`linesHyperb.lm` and `lseq` pass without source changes. Its ordered first P5 blocker is now
`example:mult.fig`, where the browser-owned datasets catalog lacks `LifeCycleSavings`. The artifact
remains at P4 and no package-specific branch was introduced.

Profile 0.455 admits `datasets::LifeCycleSavings` through the ordinary declarative dataset path and
implements reusable `stats::plot.lm` rendering for the four default regression diagnostics. The
implementation composes existing influence, smoothing, quantile, and browser graphics primitives;
Cook's-distance panels and deeper custom labeling/panel behavior remain explicit boundaries. The
unchanged `sfsmisc 1.1-25` `example:mult.fig` passes, and its ordered first P5 blocker advances to
`example:p.arrows`, where evaluation reaches an unresolved symbol `x`. The artifact remains at P4
and no package-specific branch was introduced.

Profile 0.456 adds an independently authored core `graphics::arrows` example manifest to the same
generic resource and evaluation path used by installed packages. Its observable `x`, `y`, and `s`
side effects and invisible result shape have flat, recursive, and integration evidence. The
unchanged `sfsmisc 1.1-25` `example:p.arrows` passes; its ordered first P5 blocker advances to
`example:p.profileTraces`, where the browser-owned datasets catalog lacks `Puromycin`. The artifact
remains at P4 and no package-specific branch was introduced.

Profile 0.457 admits the independently published complete `datasets::Puromycin` table through the
generic declarative data-resource path. Values, dimensions, storage, factor levels, row names,
aggregates, and namespace identity have integration plus flat and recursive differential evidence.
The unchanged `sfsmisc 1.1-25` `example:p.profileTraces` now reaches the next reusable blocker,
unavailable `stats::nls`. The artifact remains at P4 and no package-specific branch was introduced.

Profile 0.458 adds reusable default-algorithm nonlinear least squares, bounded nonlinear profile
refits, profile plotting, and finite three-value `plot.default(mgp=)` admission. The implementation
evaluates arbitrary admitted formula ASTs against ordinary data and parameter environments; it does
not recognize `sfsmisc` or the Puromycin formula. The unchanged `example:p.profileTraces` passes,
and the first P5 blocker advances to `example:p.res.2x`, where `datasets::lm.SR` is unavailable. The
artifact remains at P4 because later examples and tests still have independent blockers.

Profile 0.459 adds a browser-owned core `stats::lm.influence` example resource through the generic
example manifest and evaluator. It creates `lm.SR` from admitted core data and reusable model
primitives; no package identity or result substitution is involved. Unchanged `example:p.res.2x`
passes, and the first P5 blocker advances to `example:p.tachoPlot`, where `state.center` is absent.
The artifact remains at P4.

Profile 0.460 adds generic multi-object static data topics and the complete provenance-audited
`datasets::state` family. One `data(state)` resource creates all seven standard bindings; ordinary
autoload, search-path, namespace, reset, and explicit target-environment paths reuse the package
data machinery. Unchanged `example:p.tachoPlot` passes, and sfsmisc's first P5 blocker advances to
`example:p.ts`, where `datasets::sunspots` is absent. The artifact remains at P4.

Profile 0.461 adds the complete fixed `datasets::sunspots` series through the ordinary declarative
core-data path, reusable time-series plot forwarding and validation for `xaxt` and `yaxt`, and
fractional two-component coordinates in `window()`. The implementation recognizes no sfsmisc package
identity and substitutes no example result. The unchanged `example:p.ts` advances through all three
contracts to its next concrete blocker, missing `datasets::EuStockMarkets`. The artifact remains at
P4 because subsequent examples and tests retain independent blockers.

Profile 0.462 adds the complete fixed `datasets::EuStockMarkets` multivariate series through the
generic core-data path. Each trusted static data topic receives an independent initialization step
budget, so a large resource cannot starve later topics while ordinary evaluation limits remain
unchanged. Complete flat, integration, reset, namespace, and recursive evidence covers all 7,440
values and `mts` metadata. The unchanged `sfsmisc` `example:p.ts` advances to numeric `as.POSIXct()`
without an explicit `origin`; the artifact remains at P4.

Profile 0.463 implements optional-origin numeric `as.POSIXct()` as a reusable Base conversion
contract rather than an sfsmisc path: it preserves storage and arithmetic attributes, supports
vectorized origin classes, retains special numeric values, and reports exact recycling conditions.
Date and POSIXct axis methods now also use recursive missing-promise recognition for forwarded
`format` arguments. Flat, integration, and exact recursive GNU evidence covers both changes. Every
unchanged `example:p.ts` call now passes, and sfsmisc's first P5 blocker advances to
`example:pkgDesc`, which reports `missing value where TRUE/FALSE needed`. The artifact remains at P4
because later examples and tests retain independent blockers.

## Profile 0.464 installed metadata, simplification names, and Theoph progression

Installed pure-R package descriptions now expose deterministic GNU-shaped `Built` metadata without
mutating the archived DESCRIPTION. Matrix simplification through `sapply()` preserves inner result
names as row dimnames and derives outer names from character inputs under `USE.NAMES`, while
`vapply()` retains its template-name contract. These reusable fixes make unchanged
`sfsmisc::pkgDesc` pass. The provenance-audited `datasets::Theoph` grouped data frame then clears
the next missing-data blocker through the ordinary static package-data path. The first ordered
blocker is now `example:plotDS`, where `nls()` lacks automatic starting values for the `SSfol`
self-starting model. The artifact remains at P4; no package identity branch or source rewrite was
introduced.

## Profile 0.465 generic self-start initialization and nls prediction

Builtin callables now retain ordinary R attributes, and the nonlinear-model layer implements a
package-neutral self-start protocol: resolve the formula's model callable, invoke its `initial`
attribute with the matched call, data, and response, validate a named finite numeric start, then use
the existing bounded `nls` fitter. `stats::SSfol` supplies the first clean-room numeric model and
initializer. `predict.nls` evaluates the fitted formula against complete or partial `newdata` while
retaining the fit's model environment. Gradient attributes and uncertainty intervals are not yet
claimed. This carries unchanged `sfsmisc::plotDS` past its model blocker; its next ordered blocker
is `example:potatoes: ftable() requires a numeric or logical vector`. The artifact remains at P4.

## Profile 0.466 storage-preserving ftable array flattening

The shared `ftable` path distinguishes observation vectors/data frames from an already tabulated
atomic array. Existing arrays now use a bijective source-to-destination permutation with type-aware
logical, integer, double, complex, raw, and character construction, including missing masks and
character encoding bytes. This removes the previous integer truncation and numeric-only assumption.
The callable and formatter are registered under their GNU `stats` namespace ownership. Unchanged
`sfsmisc::potatoes` advances through all flat-table calls; its next blocker is absent
`stats::interaction.plot`. The artifact remains P4 and no package identity branch was introduced.

## Profile 0.467 interaction-plot grouping and rendering

The shared stats layer now computes the interaction cell matrix by factor-level order and invokes
the supplied summary callable on each nonempty response subset, preserving ordinary closure side
effects. The graphics layer is composed from existing plot, lines, axis, box, title, and legend
bindings, so the feature emits the same browser-owned command stream and observes the current device
lifecycle. The implementation validates equal lengths, factor levels, scalar numeric summaries, type
selection, axis style, and finite limits. Unchanged `sfsmisc::potatoes` passes; the next ordered
blocker is `example:pretty10exp: [[() requires a vector, list, pairlist, or environment`. The
artifact remains P4 and no package identity branch was introduced.

## Profile 0.468 language and expression extraction

Both evaluator-native subset syntax and first-class `[`/`[[` calls now treat a call as its tagged
entry list and an expression vector as named quoted AST entries. Element extraction returns the
callee, argument, or expression value; slicing reconstructs call/expression containers and preserves
observable names. Expression entries represented internally as named assignments are normalized on
extraction and rewrapped only when rebuilding a named expression slice. Unchanged
`sfsmisc::pretty10exp` passes; the next ordered blocker is multi-label `matplot(ylab=)` in
`example:primes`. The artifact remains P4 and no package-specific path was added.

## Profile 0.469 shared vector annotations

The `matplot` adapter no longer imposes a scalar-character-only label boundary before calling the
shared title renderer. That renderer already owns atomic coercion, expression labels, missing and
empty entries, multiline placement, and browser text events, so the package-neutral fix removes a
duplicate restriction rather than adding another graphics path. Unchanged `sfsmisc::primes` passes;
the next ordered blocker is `example:printTable2: Incorrect number of array dimensions.` The
artifact remains P4 and no package identity branch was introduced.

## Profile 0.470 formatted array attributes

The shared `format.default` atomic path now rebuilds the character result with the source array's
dimensions and dimension names. It deliberately does not copy arbitrary attributes; non-array
vectors continue to preserve only names. This keeps formatted tables rectangular for subsequent
two-dimensional indexing. Unchanged `sfsmisc::printTable2` passes; the next ordered blocker is
`example:ps.end: Argument 'fun' is missing in formals().` The artifact remains P4 and no
package-specific branch was added.

## Profile 0.471 caller-default formals

The shared reflection builtin now uses the active ordinary closure when `fun` is omitted and
supports character-function lookup in an explicit `envir`, skipping non-callable bindings while
walking parent environments. Its reflected public formals carry the GNU default expressions.
Unchanged `sfsmisc::ps.end` advances past missing `fun`; its next failure is the existing honest
`postscript()` boundary requiring a real browser-admissible encoder. The artifact remains P4.

## Profile 0.472 browser-owned PostScript output

`grDevices::postscript()` now opens an owned file device and encodes the shared graphics journal as
genuine DSC PostScript Level 2. The device covers page/window state, segments, points, text,
polygons and hatch clipping, rasters, plot boxes, boxplots, and legends; it supports base Type 1
font families, RGB/gray/CMYK output, one-file multi-page documents, numbered per-page targets,
orientation, virtual-file reads, and the ordinary device lifecycle. It never launches a viewer or
printer. `print.it = TRUE` remains an explicit host-capability boundary, and semi-transparent vector
graphics fail deterministically because PostScript has no alpha channel.

Unchanged `sfsmisc::ps.end` reaches its subsequent external `system()` viewer request, which the
generic package checker classifies as not applicable in a default browser session without granting
ambient process authority. The next applicable first blocker is `example:read.org.table`, where
`readLines(encoding = "native")` is still unavailable. The artifact remains P4.

## Profile 0.473 browser-native line decoding

`readLines(encoding = "native")` now selects the same deterministic UTF-8 decoder as NativR's
documented browser-native encoding. The existing `native.enc` and `nativeenc` spellings share that
path. Results decoded as native or unknown retain GNU R's `unknown` character mark; explicit UTF-8,
Latin-1, and bytes requests retain their corresponding marks. No host locale or codec is consulted.

Unchanged `sfsmisc::read.org.table` now passes. Ordered package checking advances to
`example:relErr`, whose first failure is generic `stopifnot(exprs=)` expression-object support. The
artifact remains P4 and no package-specific branch was added.

## Profile 0.474 expression-block assertions

`stopifnot(exprs = { ... })` now evaluates every block entry in order, validates each result, and
stops before later side effects after the first failure. `exprObject` accepts expression vectors and
language blocks through the same evaluator path. The implementation preserves source-based singular
and plural diagnostics, invisible `NULL` success, caller-local versus isolated evaluation, and the
GNU error when `...`, `exprs`, or `exprObject` modes are mixed.

Unchanged `sfsmisc::relErr` and `pkgLibs` advance through their assertion blocks. The ordered first
blocker remains in `example:relErr`, now at the missing exported `tools::assertError` binding. The
artifact remains P4.

## Profile 0.475 generic error assertions

The tools namespace now exports `assertError(expr, classes = "error", verbose = FALSE)`. It forces
the expression once, captures a matching catchable condition into an invisible one-element list,
optionally emits the asserted diagnostic on the message stream, and errors when evaluation succeeds.
Resource-limit failures remain uncatchable.

Unchanged `sfsmisc::relErr` now completes. Ordered package checking advances to
`example:sessionInfoX`, where a list-backed version value reaches the generic version parser. The
artifact remains P4.

## Profile 0.476 version-metadata conversion

`package_version()` now accepts the GNU R version-metadata shape only when a list has both exact
`major` and `minor` fields. It composes and strictly validates the three-component value and returns
the `R_system_version`, `package_version`, and `numeric_version` class stack. Other lists retain the
existing non-character error, so this is not a general list-coercion shortcut.

Unchanged `sfsmisc::sessionInfoX` advances through this conversion. Its next ordered blocker is the
missing core binding `R_compiled_by`; the artifact remains P4.

## Profile 0.477 browser toolchain reporting

Base now exposes the locked zero-argument `R_compiled_by()` closure. Its result preserves the GNU R
portable shape—a named character pair `C` and `Fortran`—while the values honestly identify NativR's
TypeScript runtime and WebAssembly numerical kernels instead of inventing GNU compiler versions.

Unchanged `sfsmisc::sessionInfoX` advances through compiler reporting. Its next ordered blocker is
the missing generic `extSoftVersion()` callable; the artifact remains P4.

## Profiles 0.478–0.480 runtime metadata closure

The locked zero-argument `extSoftVersion()` closure now returns GNU R's complete eleven-name
character shape. Only the actually bundled bzip2 1.0.8 external library is versioned; browser
facilities without a stable external-library version remain empty. Locked `La_version()` and
`La_library()` report the internal pinned LAPACK 3.12.1 WebAssembly backend, and `pcre_config()`
reports UTF-8 and Unicode-property support with no PCRE JIT or recursive stack backend.

Unchanged `sfsmisc::sessionInfoX` and `test:posdef.R` now pass. Ordered checking advances to
`example:sourceAttach`, which currently reports `no file found`; the artifact remains P4.

## Profiles 0.481–0.484 `sfsmisc` semantic closure

The shared runtime now carries the unchanged `sfsmisc 1.1-25` artifact through every applicable
generic package-check step. Browser-owned `datasets::iris3` is derived from the admitted Iris
resource with the GNU-compatible array layout and dimnames. Expression comparison recognizes the
deparse-equivalent negative-exponent language forms produced by substitution. Primitive
`as.integer()` dispatches package-defined S3 methods before its default coercion, which lets
`as.integer.basedInt` reconstruct arbitrary-base digit matrices. `density.default()` additionally
supports the variance-standardized Epanechnikov kernel and its canonical roughness constant.

The package checker classifies historic GNU R development and legacy saved-output session headers as
host-bound while still executing the corresponding retained tests. The final unchanged run passes
metadata, namespace loading, attachment, complete help/export coverage, all applicable examples, all
retained tests, saved-output classification, and vignette classification. The pinned artifact
advances from P4 to scoped P7; this does not claim arbitrary pure-R package compatibility.

## Profile 0.485 namespace reflection and `testit` closure

Base now exposes GNU-compatible `getExportedValue(ns, name)` through the shared namespace registry.
It accepts package names and namespace environments, returns only exported bindings, preserves
callable identity, and has exact two-argument closure formals and deterministic validation errors.
Flat, integration, and exact recursive GNU black-box evidence covers the reusable contract.

The unchanged `testit 1.1` source package passes installation, namespace loading, attachment,
complete export/help coverage, all three installed examples, and an independent scenario over all
six exports. Its retained `test-all.R` is explicitly not applicable because it invokes a host R
executable and git through `system2()`; the package has no vignette. Its deterministic artifact is
pinned at SHA-256 `3e9d9a40e7dbe2cb6cd951ffd15d2d7c5db585258e4ab3fefafd0976445cd09f` and advances to
scoped P7. No production path recognizes its package identity. Unopened `Metrics 0.1.4` is the
replacement P0 holdout; its source archive remains metadata-and-hash only.

## Profile 0.486 rank-one transpose and `Metrics` closure

Base `t.default()` now converts one-dimensional arrays and tables to GNU-compatible row matrices,
including axis dimnames, axis-label movement, empty dimensions, class retention, and deterministic
rejection of higher-rank arrays. Flat, integration, and exact recursive GNU black-box cases cover
the reusable behavior.

The unchanged `Metrics 0.1.4` archive first stopped in its installed `ScoreQuadraticWeightedKappa`
example when a one-dimensional `table` reached `t()`. After the shared fix, installation, loading,
attachment, complete export/help coverage, every installed example, and an independent 32-export
metric scenario pass. Retained `testthat.R` is explicitly not applicable because `testthat` is an
unavailable Suggests dependency, and the package has no vignette. The artifact advances to scoped P7
with SHA-256 `4de5f0a5d6b28958a09ef4c5448f60a0a9421c39232515a65d28545493936764`. Unopened
`pwr 1.3-0` is the replacement P0 holdout.

## Profile 0.487 non-central probabilities, formula points, and `pwr` closure

The unchanged `pwr 1.3-0` run first stopped at non-central `pchisq`, then exposed the shared
non-central F and Student-t probability contracts and `graphics::points.formula` used by
`plot.power.htest`. Package-neutral centered Poisson mixtures, direct-tail Student-t integration,
large-degree stabilization, exact `pt`/`qt` formals, and formula-point S3 dispatch now have flat,
integration, and recursive GNU black-box evidence.

The deterministic artifact SHA-256 is
`12a73d3b7d71ef95fa4d27e9f151450e0ff34bd72f228396f7fb10dc70c956d6`. Installation, namespace loading,
attachment, complete export/help coverage, all applicable examples and checks, and the independent
15-export power scenario pass unchanged at scoped P7. No production path recognizes the package.
Unopened `VennDiagram 1.8.2` is the replacement P0 holdout, frozen as an 82,792-byte archive at
SHA-256 `24b9751b7a537f7eb6273f14dd845f0ca38c2f5230b619ff637a839f8489fd93`.

## Profile 0.488 SVG/TIFF, hypergeometric, and grid package progression

Browser-owned `svg()` and `tiff()` now participate in the ordinary graphics-device lifecycle. TIFF
supports both uncompressed RGBA and standards-shaped LZW compression; an independent decoder
round-trip verifies the compressed strip rather than only its header. `stats::phyper` adds reusable
bounded hypergeometric tail behavior. `grid::gList` and `grid.draw` add recursive grob collection,
generic dispatch, admitted grob rendering, and default-device opening without recognizing a package
identity.

The unchanged `VennDiagram 1.8.2` archive now passes metadata, namespace loading, attachment,
complete export/help coverage, `calculate.overlap`, and its ordinary pairwise, single, triple,
quadruple, and quintuple drawing examples through those shared paths. It remains blocked at the
first outstanding package-check contract recorded in `compatibility/package-corpus.json`; later
failures are diagnostic only and are not used to overstate its tier.

## Profile 0.489 VennDiagram P7 and next holdout

Shared `cbind.data.frame` matrix expansion closes `get.venn.partitions`; shared grid annotation
handling closes the expression-label path in `venn.diagram`. The high-resolution TIFF example runs
under the common finite package-test profile, whose cumulative element-work ceiling is 750,000,000
while the four-million-element per-vector ceiling remains unchanged.

The unchanged `VennDiagram 1.8.2` artifact now passes installation, metadata, namespace loading,
attachment, complete export/help coverage, every applicable example, and an independent overlap,
partition, geometry, and grob scenario. Its retained testthat driver is deterministically not
applicable because testthat is Suggested and unavailable; no vignette is installed. It advances to
scoped P7 without a package-identity branch. Unopened `httpcode 0.3.0` is frozen as the replacement
P0 holdout before archive listing or execution. Its first unchanged run subsequently passes every
applicable check and an independent four-export scenario after source-preserving `stopifnot`
diagnostics remove the only mismatch, so httpcode advances to scoped P7. Unopened `shades 1.5.0` is
the current P0 holdout, frozen as a 35,768-byte archive before member listing or execution.

## Profile 0.490 shades P7 and relimp holdout

The unchanged `shades 1.5.0` archive now passes generic installation, metadata, namespace loading,
attachment, complete export/help discovery, every applicable example and package-check step, and
independent scenarios over construction, replacement, gradients, colour-space conversion,
saturation, HSV, contrast, and distance. Its deterministic artifact is
`3e67f4610e761b2b5049b807baf08a332f425922e57885f7978e79e4e3114e88`. Shared implementations of
`colorConverter`, the non-callable `colorspaces` binding, `rgb2hsv`, custom `convertColor` routing,
and structural attribute rules close the ordered blockers without source rewriting or package-name
branches.

The ledger now records 115 releases: 99 passing, 15 blocked, one unevaluated; 60 are scoped P7.
Unopened `relimp 1.0-5` is the sole holdout, frozen as the official 13,836-byte source archive at
SHA-256 `acac7cf72ea39916761b51c825db0ffcb2bb1640e0a04086831fb78e9e40b679` before member listing,
extraction, parsing, installation, or execution.

## Profile 0.491 relimp P7 and codetools holdout

The unchanged `relimp 1.0-5` artifact passes generic installation, metadata and namespace
processing, attachment, complete export/help discovery, every applicable installed example and
package-check step, and independent `lm` relative-importance and Tcl-list conversion scenarios. Its
deterministic artifact SHA-256 is
`9384901bcd3072a55a52f4c94ad3cf0f8662b4aebd523d37ac879377ea06a894`. Optional Tcl/Tk selectors and
Suggested model integrations remain outside the exercised mandatory closure. No source rewrite or
package-identity branch exists.

The ledger records 116 releases: 100 passing, 15 blocked, one unevaluated; 61 are scoped P7.
Unopened `codetools 0.2-20` is the sole holdout, selected at 56,062 downloads from the fixed
2026-07-30 through 2026-08-28 usage window. Its official 38,683-byte archive is frozen at SHA-256
`3be6f375ec178723ddfd559d1e8e85bfeee04a5fbaf9f53f2f844e1669fea863` without listing, extraction,
parsing, installation, or execution.

## Profile 0.492 codetools P7 and language-reflection closure

The frozen `codetools 0.2-20` archive was opened only after its metadata, source digest, 19-export
inventory, formals, help topics, and independent GNU R scenarios were fixed. Ordered execution
exposed reusable runtime gaps in missing-formal identity, first-class syntax reflection, dynamic
escape continuations, `break`/`next` language entries, symbol `cat()` output, character call heads,
and `bquote()` formals for `match.call()`. Those contracts now have package-neutral flat,
integration, and recursive differential evidence.

Artifact SHA-256 `8ae46174e686b5083d2d034caaf26f59beab0e3b69990cfc52f7a5302580794e` passes the full
applicable generic check plan and independent globals, locals, assignment, tree, usage, and
constant-folding scenarios at scoped P7. The ledger records 116 releases: 101 passing, 15 blocked,
none unevaluated, and 62 at P7. No production branch recognizes codetools or rewrites its source,
and no arbitrary pure-R package claim follows.

## Profile 0.493 stinepack P7 compositional evidence

The official `stinepack 1.5` archive was frozen at source SHA-256
`536c7a923064fd02eaa31161dd55d92369566fb351fbaee1ec188b1980438686` before NativR archive inspection
or execution, together with its public formals and independent GNU R interpolation expectations. Its
first unchanged generic run exposed no new blocker and required no production change. Artifact
SHA-256 `9c23ae1de366e04d575ac4954d08d540b51e646ef2f19ac29cb50b17818d33bc` passes the complete
applicable package-check plan and independent numerical, missing-value, class, boundary, and
diagnostic scenarios at scoped P7.

The ledger records 118 releases: 102 passing, 15 blocked, one unevaluated, and 63 at P7. Unopened
`qvcalc 1.0.4` is frozen as the next holdout at source SHA-256
`90403cada56e82a6bbd067f397fab20c721850b50874345a6322619165dafb59`, together with its eight-export
surface and GNU R factor-model/covariance expectations.

## Profile 0.494 custom-family model closure and qvcalc P7

The shared model layer now executes standard numeric-response custom GLM-family callbacks through
fitting, residual calculation, summary dispersion/inference, and response-scale prediction.
`vcov.lm()` independently matches its own `object`, `complete`, and `...` formals, so extra package
dots remain lazy while positional and partial `complete` arguments retain GNU R behavior. Two flat
cases, a package-neutral integration scenario, and one recursive live-R graph provide executable
evidence.

The unchanged `qvcalc 1.0.4` artifact SHA-256
`34400402c98126098ef2f914d55f5946fbd9d0ea24a7d91489ff603e97cb2146` passes the applicable generic P7
plan and an independent factor-model scenario. The ledger is 118 releases: 103 passing, 15 blocked,
none unevaluated, and 64 at P7. This increment does not yet cover custom-family matrix responses or
`initialize` expressions that rewrite `y`, `weights`, or `n`.

### Next source-blind holdout: aod 1.3.3

The next purpose-admissible package is unopened `aod 1.3.3`, selected at 14,153 downloads from the
fixed 2026-07-30 through 2026-08-28 usage window. Before any NativR archive listing or execution,
the official 58,304-byte archive was frozen at source SHA-256
`b7245e8abf7d78cdfa7f74f6d90f79a418b883058aa3edd5977a60bdbed4087e`, together with its 50-export
surface, exact function formals, 57 help entries, 10 datasets, public S4 metadata, and independent
GNU R transform, Wald-test, and quasipoisson expectations. It is registered at P0 with no inferred
blocker.

## Profile 0.495 aod P7 and next trust holdout

Ordered unchanged `aod 1.3.3` execution closed only reusable shared gaps: formula intercept and NULL
term normalization, factor refactoring, `dpois`, S4 residual/predict dispatch,
`predict.glm(se.fit=)`, `logLik.glm`, `naresid`, `slotNames`, correctly dispersed `vcov.glm`, and
deterministic unavailable- Suggests classification. Flat, integration, recursive GNU R, full
package-check, and independent scenario evidence covers the new behavior. No production branch
recognizes aod or rewrites its source.

Artifact SHA-256 `a5b3429016dd237589f80a64ade844ce1ae3c2e659ec7e4cceb9a9cf03403900` passes every
applicable installed example and package-check step plus independent transform, Wald, S4
quasipoisson, fitted-value, residual, deviance, and covariance scenarios. It advances to scoped P7.
The ledger now records 120 releases: 104 passing, 15 blocked, one unevaluated, and 65 at P7.

Unopened `trust 0.1-9` is the replacement source-blind P0 holdout, selected at 13,772 downloads from
the same fixed usage window. Its official 302,619-byte archive is frozen at SHA-256
`68d41390d6abd79461a972b424e8832272afdf0fd6e7fb57c379ae286919a1dd` outside Dropbox without listing,
extraction, parsing, installation, or NativR execution.

## Profile 0.496 trust P7 through reusable glm.fit and D closure

Source-blind execution of frozen `trust 0.1-9` first exposed direct `stats::glm.fit` as the ordered
blocker. After that shared IRLS entry point was added, a package test's installed error handler made
a missing `stats::D` appear downstream as malformed optimization-history data; an exact isolated
probe identified the earlier symbolic-differentiation cause. The shared language implementation now
covers recursively differentiated parenthesized arithmetic and constant numeric powers needed by
this and broader polynomial pure-R code without recognizing the package.

The pinned artifact passes installation, metadata/dependency processing, namespace loading,
attachment, complete export/help coverage, every installed example, all retained package tests,
saved-output applicability classification, and its vignette. Flat, integration, and recursive GNU
black-box evidence covers `glm.fit` and `D`. The corpus remains 120 releases and now records 105
passing, 15 blocked, none unevaluated, and 66 at scoped P7. Comprehensive symbolic derivatives, all
direct-fit family shapes, and arbitrary-package compatibility remain open.

## Profile 0.497 itertools P7 through reusable CMRG streams

The metadata-frozen `itertools 0.1-3` run passed installation, its `iterators` dependency, namespace
loading, attachment, and all documentation before first stopping at the `iRNGStream` example. The
blocker was package-neutral: core `parallel` lacked L'Ecuyer-CMRG state and stream jump semantics.
The shared RNG layer now implements reproducible seven-word state, uniform draws, external seed
restoration, and exact stream/substream jump matrices; no branch recognizes the package.

The digest-pinned artifact passes all applicable package-check steps and every runnable example. The
foreach-only path is explicitly unavailable as an uninstalled Suggests dependency, and no top-level
tests or vignettes are present. An independently authored product, zip, and two-stream scenario
matches GNU R. The corpus contains 121 releases: 106 passing, 15 blocked, none unevaluated, and 67
at scoped P7. Remaining RNG engines, actual host parallelism, and comprehensive package
compatibility remain open.

## Profile 0.498 optimParallel P7 through browser cluster state and L-BFGS-B

The source-blind `optimParallel 1.0-3` run first stopped at missing core-parallel namespace exports,
then at the public L-BFGS-B method boundary. Shared browser cluster environments now retain exports
and quoted evaluation across cluster operations, support default-cluster registration, and route
apply/call work deterministically without spawning host processes.
`stats::optim(method = "L-BFGS-B")` now delegates through the existing typed, audited Wasm backend
with bounds, scaling, analytic/numerical gradients, method controls, counts, convergence, and
messages.

The exact pinned artifact passes installation, dependency processing, namespace lifecycle, all
export/help documentation, every applicable example/check, its vignette, and an independent
analytic-gradient scenario at scoped P7. Flat and exact recursive GNU R evidence independently
covers both primitives. The corpus is 122 releases: 107 passing, 15 blocked, none unevaluated, and
68 at P7. True host parallelism and comprehensive package compatibility remain open.

## Profile 0.499 tictoc P7 through `as.vector` S3 closure

The source-blind `tictoc 1.2.1` package passed its installed package-check surface immediately, but
an independently authored Stack/timing probe caught a deeper interaction: `as.vector` directly
coerced a classed environment instead of invoking `as.vector.Stack`. The generic now dispatches
class and default methods, forwards the default mode into reflective calls, and supplies base
factor/data-frame methods so a user default cannot shadow their standard conversions.

The pinned artifact passes namespace lifecycle, complete documentation, applicable examples/checks,
nested vector/list stacks, timing nesting, callback and log behavior, and empty-stack boundaries at
scoped P7. Flat, integration, and exact recursive GNU R evidence independently covers the shared
primitive. The corpus is 123 releases: 108 passing, 15 blocked, none unevaluated, and 69 at P7.

## Profile 0.500 dfoptim P7 through discrete RNG-state closure

The source-blind `dfoptim 2023.1.0` package passed its standard checks before an independent
scenario isolated a deeper reproducibility gap: full permutations returned the right values but did
not consume a uniform draw for the final singleton selection. The resulting RNG stream changed later
`mads` poll bases and optimization trajectories. The shared sampler now advances that draw exactly,
with no package branch.

The pinned artifact passes all five exported optimizers across bounded/unbounded, deterministic and
randomized paths, dots forwarding, convergence results, formals, diagnostics, all installed
examples, and every applicable generic check. Flat, integration, and exact recursive GNU R evidence
covers the primitive. The corpus is 124 releases: 109 passing, 15 blocked, none unevaluated, and 70
at P7.

## Profile 0.501 DFBA P7 through reusable distribution and copy-on-modify closure

The source-blind `DFBA 0.1.0` run first selected five shared stats distribution primitives. After
those were implemented, its unchanged 10,000-sample contrast examples exposed quadratic allocation
from immutable whole-vector copies during local indexed replacement. The evaluator now retains a
bounded hidden capacity only for an exactly owned numeric binding and invalidates that optimization
on alias/promise exposure; all other cases retain copying semantics.

The deterministic DFBA artifact passes its complete generic 66-step plan without source rewriting or
package-specific runtime behavior. Evidence is 1,536 flat cases, 392 recursive Oracle v2 graphs, and
668 recursively evidenced bindings. The corpus is 125 releases: 110 passing, 15 blocked, none
unevaluated, and 71 at scoped P7.

## Profile 0.502 lm.beta P7 through list-backed lookup closure

The source-blind `lm.beta 1.7-3` run passed installation, namespace, attachment, and documentation
before every example stopped because list-backed `exists()` inherited the ambient `weights()`
function. `as.environment(list)` now has GNU R's empty parent, so positional list lookup is confined
to list fields while eval/with data masks continue to use their caller enclosure.

Artifact `1c13aeb2a45d1790e851ad5f0a4cdbeeb4bfa6f66c39898e47b023f784aa2201` passes all 19 generic
checks and independent weighted/unweighted, no-intercept, summary, xtable, and error evidence. Flat
and recursive GNU R evidence covers the shared primitive. The corpus is 126 releases: 111 passing,
15 blocked, none unevaluated, and 72 at scoped P7.

## Source-blind alabama 2025.1.0 freeze

The next metadata-only rotation selected `alabama 2025.1.0` at 12,292 downloads. CRAN metadata marks
it pure R and gives it only the already passing P7 `numDeriv` dependency. The official 10,539-byte
archive is frozen outside Dropbox at SHA-256
`fad845617a59f67233f6e7a9355fcace4c1d2c12f750acd1de39bc7d0705d7cc` without listing, extraction,
parsing, installation, or execution. The ledger now has 127 releases with one deliberately
unevaluated holdout at P0.

## Profile 0.503 alabama P7 and bounded nlminb

The first ordered blocker was the missing `stats::nlminb` namespace binding. The shared optimizer
now provides GNU formals, bounds, scale, selected controls, result names, and named evaluation
counts via the browser L-BFGS-B backend. `optim` accepts validated shared default controls and
non-finite intermediate barrier trials. The unchanged package passes all 11 checks and an
independent GNU-matched scenario. The corpus is 127 releases: 112 passing, 15 blocked, none
unevaluated, and 73 at P7.

## Source-blind logging 0.10-111 freeze

The next metadata-only rotation selected `logging 0.10-111` at 11,910 downloads after excluding
`ISOcodes` as a data-asset package. CRAN metadata marks it pure R and gives it only the browser-core
`methods` import; `testthat` and `crayon` are Suggested. The official 17,086-byte archive is frozen
outside Dropbox at SHA-256 `019bd366f14c9702378b74d0f2babd14497448f8792ccd45d1846cddd3104f59`
without listing, extraction, parsing, installation, or execution. The ledger now has 128 releases
with one deliberately unevaluated holdout at P0.

The source-blind run now pins deterministic artifact
`25cf50ea3597f6fb657a33d2b58169dbcd34972612adb3b809abb4b805c72431` and advances to development P4.
Installation, namespace, attachment, all documentation, and seven example topics pass. The first
ordered blocker is missing `methods::functionBody` in `example:setMsgComposer`; GNU R exposes
`fun = sys.function(sys.parent())` and returns the closure body as a language object.

## Profile 0.504 logging P7 and functionBody

The GNU-shaped `methods::functionBody` binding now covers explicit closures, primitives, and its
caller-default form. Flat, integration, and exact recursive oracle evidence pass. The unchanged
logging artifact passes all 27 package-check steps plus an independent handler, filter, inheritance,
composer, formatter, and removal scenario. The corpus is 128 releases: 113 passing, 15 blocked, none
unevaluated, and 74 at P7.

## Profile 0.505 latex2exp P7

The metadata-only rotation froze unchanged `latex2exp 0.9.8` at source SHA-256
`8dd641f263989515d0c327550934e4954dc582230ca2bb9f280b6b28a46510a5`. Its first example exposed GNU
punctuation identity escapes inside bracket expressions; after that shared repair, an independent
scenario exposed the missing public `rbind.data.frame` binding. The regex normalizer and public
row-binding method now have flat and exact recursive GNU evidence.

Deterministic artifact `c3b0426b7d6621ac5dc270e5f78ea389e2129b326d1322cd3691ae5270c93fdc` passes all
18 generic checks plus independent vectorized conversion, style, custom command, expression
metadata, invalid input, and supported-command-table behavior. The corpus is 129 releases: 114
passing, 15 blocked, none unevaluated, and 75 at P7.

## Profile 0.506 enrichwith P7

The source-blind `enrichwith 0.5.0` run first selected exact recursive value embedding in runtime
calls, then the missing standard `stats::make.link` constructor. The language bridge now preserves
closure/environment identity inside constructed calls. The shared stats/model implementation
provides all nine standard `link-glm` objects and supplies the same functions and validity contracts
to family constructors.

Artifact `dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612` passes every applicable
generic check and an independent link, family, linear-model, score, information, bias, formals, and
option-dispatch scenario. Evidence totals are 1,543 flat cases, 1,484 live-R-eligible cases, 399
recursive graphs, and 674 recursively evidenced bindings. The corpus is 130 releases: 115 passing,
15 blocked, none unevaluated, and 76 at scoped P7.

## Profile 0.507 parse-data and leading-NULL bind closure

Explicit semicolons omitted by tree-sitter-r's concrete children are recovered as normalized
terminal parse-data records with the enclosing expression as parent. Custom infix calls whose
operand is a block use GNU-shaped multiline `deparse()` output. `rbind()` and `cbind()` now dispatch
on the first non-`NULL` argument at its original dots position, so leading `NULL` values are ignored
without duplicating the dispatched data frame.

The unchanged `lambda.r 1.2.4` package check now passes again, and its unchanged downstream
`futile.logger 1.4.9` and `VennDiagram 1.8.2` checks pass through the same shared behavior. Parser,
runtime, flat differential, recursive Oracle v2, and unchanged-package evidence cover the repair; no
package source or package identity branch is used.

## Profile 0.508 S4 signature laziness and POSIX combination closure

S4 generic definitions retain their declared dispatch signature, including explicit reordered
signatures. Method selection forces only those signature arguments; forwarded missing arguments
remain matchable and non-signature promises remain lazy inside the selected method. Special `rep()`
calls expand a forwarded literal `...` into the original promises before S3 dispatch.

The public `c.POSIXct(..., recursive = FALSE)` method now combines atomic epoch values with GNU
class and name behavior. A leading POSIXct object controls the result class; `tzone` is retained
only when every non-NULL input is POSIXct with the identical tag. Flat and exact recursive
GNU-observed cases cover the new contracts. The unchanged `timeDate 4052.112` artifact again passes
its complete current generic package-check plan, including installed examples and retained tests,
without source rewriting or a package identity branch. Focused unchanged `withr 3.0.3` and
`rex 1.2.2` regressions also pass.

## Profile 0.509 arima0, USAccDeaths, and ellipse dependency boundary

The Stats layer now contains an independently implemented univariate `arima0` subset with seasonal
differencing, CSS/ML objectives, deterministic fitting, covariance, residual-series metadata, and
explicit unsupported controls. The core datasets package exposes the 72-month `USAccDeaths` series
through the ordinary autoload/data/namespace resource path. NLS data-frame subset evaluation,
`summary.nls`, the model `getPars` callable, and profile degrees of freedom are also implemented.

Unchanged ellipse 0.5.0 crosses its former arima0 blocker and executes independent covariance,
ARIMA, NLS, and NLS-profile ellipse scenarios. It remains blocked at P4 by the example that
conditionally requires Suggested package MASS for `profile.glm`; NativR does not substitute that
non-core method. This increment is not a claim of complete ARIMA, NLS, MASS, or package support.

## Profile 0.510 volcano and perspective-title increment

- Added the exact 87-by-61 `datasets::volcano` matrix from an independently audited MIT TIFF.
- Added `persp(main=)` browser text-journal rendering while retaining the existing projection
  matrix, visibility, surface-wireframe, and resource-limit contracts.
- Advanced unchanged `shape` to its `persp(col=)` surface-fill blocker and unchanged `gridGraphics`
  to its `coplot` blocker.
- Added flat, Worker-facing graphics, exact recursive GNU-oracle, package-check, provenance, and
  capability-ledger evidence. This remains an incremental compatibility claim, not completion.

## Profile 0.511 coloured perspective-facet increment

- Added reusable depth-ordered `persp(col=)` facet polygons with GNU-observed source-colour
  assignment, default/recycled borders, `border = NA`, missing-corner omission, resource limits, and
  unchanged 4-by-4 projection results.
- Reused the existing polygon event across inline/Worker journals, Canvas, PNG, PDF, TIFF, SVG,
  PostScript, display-list recording, and replay; no package-specific graphics object was added.
- Advanced unchanged `shape 1.4.6.1` through both `example:drapecol` calls to the missing
  `graphics::filled.contour` blocker in `example:femmecol`.
- Added GNU-backed flat facet-order, integration journal, and unchanged package-check evidence.
  Recursive Oracle v2 remains intentionally unavailable while `persp` is classified as partial shape
  compatibility. This remains an incremental claim, not complete `persp` or package support.

## Profile 0.513 diagram compatibility increment

- Added generated and admission-validated LazyData public-name-to-resource mapping.
- Added `format.pval()`, `par(lend=)` normalization and multi-device line-cap rendering, plot-title
  control forwarding, recursive plotmath text labels, and GNU-shaped zero-row
  `data.frame(NULL, ...)` handling.
- Advanced frozen unchanged `diagram 1.6.5` to scoped P7 across its complete applicable generic
  check plan and an independently authored `plotmat` scenario.
- Added flat GNU-advisor, recursive Oracle v2, integration, device, packaging, and corpus evidence.
  This does not claim arbitrary pure-R package or comprehensive GNU R compatibility.

## Profile 0.514 plotmo namespace increment

- Added reusable `grDevices::as.graphicsAnnot` behavior: non-object and language annotations retain
  identity, while classed objects use ordinary `as.character` dispatch.
- Added the exported `stats::hatvalues` S3 generic and shared `hatvalues.lm` method, including `glm`
  inheritance, custom package methods, supplied-influence handling, and public formals.
- Froze the unchanged `plotmo 3.7.1` installed artifact at SHA-256
  `b14ec30d18a30e3e802d5650ef5b9e9b744e18051cde38d5db4acb886c1f5d21` and advanced its ordered
  namespace failure from `as.graphicsAnnot` through `hatvalues` to missing `stats::qqline`.
- Added flat, integration, and recursive GNU-advisor evidence. The GLM diagnostic graph uses an
  explicit `1e-5` absolute/relative tolerance inherited from the independent IRLS path. GNU R 4.6.1
  remains normative; locally available GNU R 4.6.0 observations are advisory only.
- The package remains P1. Namespace loading, attachment, examples, tests, scenarios, and arbitrary
  pure-R package compatibility are not claimed.

## Profile 0.516 plotmo package-check and promise-forwarding increment

- Added `stats::qqline` and reusable `stats::plot.stepfun` geometry with exact public formals,
  invisible returns, graphics events, and GNU R differential evidence.
- Preserved active promise provenance when `match.call(expand.dots = FALSE)$...` crosses nested
  forwarding frames; provenance expires with the originating frame, matching GNU R.
- Added call-head deletion to attributed pairlists and pairlist-to-list attribute retention.
- Advanced unchanged `plotmo 3.7.1` through its complete generic package-check plan at P6. All
  installed examples pass; retained rpart-dependent test/output steps are explicitly not applicable.
- An independent multi-predictor scenario retains the first P7 blocker: `abbreviate()` receives a
  non-atomic predictor-name value. Comprehensive package compatibility is not claimed.

## Profile 0.517 plotmo P7 and abbreviate-coercion increment

- Routed `abbreviate()` input through the existing `as.character` generic, including GNU-shaped
  `NULL`, list, pairlist, and custom S3-method behavior.
- Added exact flat GNU R evidence and a focused integration regression for zero-length naming,
  recursive coercion, and S3 dispatch.
- Advanced unchanged `plotmo 3.7.1` to scoped P7: its complete applicable generic package-check
  plan, independent residual plot, and independent multi-predictor plot now pass with return-shape,
  visibility, and graphics-journal assertions.
- No package source rewrite or package-identity production branch was added. Comprehensive GNU R and
  arbitrary pure-R package compatibility remain open.

## Profile 0.518 gridGraphics coplot increment

- Added the exported, shape-level numeric single-condition `graphics::coplot` path, including
  bounded interval construction, normalized multi-panel graphics, point controls, labels, exact
  public formals, and invisible return.
- Moved pure interval and panel-event construction into a lazy Worker support chunk so the initial
  Worker payload remains within its explicit size gate.
- Added focused integration plus exact flat and recursive GNU R black-box evidence. GNU R 4.6.0 is
  advisory locally; 4.6.1 remains the normative release gate.
- Reran unchanged `gridGraphics 0.5-1`: retained `demo-graphics.R` expression 27 now reaches the
  missing provenance-admissible `datasets::quakes` object instead of missing `coplot`.
- The package remains blocked at P5, and `coplot` remains shape-level. Wider conditioning formulas,
  custom panels, factor conditioning, axes, layout controls, and arbitrary graphics compatibility
  remain open.

## Profile 0.519 rbenchmark semantic and performance closure

- Replaced per-element `:` resource checks with the shared bounded bulk-kernel cadence while
  preserving vector/allocation limits and cancellation/time checks.
- Added behavioral `Math.data.frame`, S3-dispatched `is.numeric`, and the GNU false methods for
  Date, POSIXt, and difftime values.
- Deferred `.Random.seed` materialization across bulk `runif` and `rnorm` generation, preserving
  exact values, replay, and final seed state without rebuilding the full seed vector per scalar.
- Advanced unchanged `rbenchmark 1.0.1` from P4 to P7: namespace, attachment, documentation,
  complete installed examples, and the independently authored benchmark scenario pass; absent tests
  and vignettes are explicitly not applicable.
- Checked-in conformance advances to 1,565 cases; recursive Oracle v2 advances to 413 cases and 687
  explicitly associated behavioral/numeric bindings after generated evidence is refreshed.

## Profile 0.520 exponential and non-central chi-square package closure

- Added behavioral `stats::pexp` and `stats::qexp`, plus complete public formals and namespace
  ownership for the exponential d/p/q/r family.
- Added browser-native Poisson-mixture density and bounded inverse-CDF quantile paths for
  non-central chi-square values, and vectorized `rchisq(ncp=)` generation.
- Extended deferred seed publication and sparse cooperative checkpoints to gamma, chi-square, and
  exponential bulk RNG without changing final RNG state or the default runtime limits.
- Advanced unchanged `invgamma 1.2` from metadata-frozen P0 to scoped P7 under the finite opt-in
  large-browser profile; all applicable package-check steps and an independent all-family scenario
  pass without package-specific runtime logic.

## Profile 0.521 Pearson chi-square and entropy closure

- Added `stats::chisq.test` goodness-of-fit, contingency, paired-input, probability-rescaling, and
  Yates-correction paths with exact public formals and deterministic simulation rejection.
- Matched complete `htest` structure, warnings, source-derived data names, paired-table dimname
  labels, class retention, and GNU attribute order through flat, integration, and Oracle v2
  evidence.
- Advanced unchanged `entropy 1.3.2` from source-blind P0 to scoped P7. Its deterministic artifact,
  all applicable generic checks, installed examples, documentation for all 34 exports, and an
  independent 31-value statistical/discretization scenario pass without package recognition or
  source rewriting.
- The corpus contains 134 pinned releases: 121 passing, 13 blocked, none unevaluated, and 82 at
  scoped P7. These counts remain evidence for the pinned corpus rather than general package
  maturity.

## Profile 0.522 simulated Pearson chi-square closure

- Added reusable fixed-margin contingency-table generation through an independently implemented
  browser-native AS 159 mode-centred inversion sampler.
- Added fixed-seed simulated p-values for integer-count goodness-of-fit, 2-by-2, and 2-by-3 Pearson
  tests, including exact RNG advancement, missing degrees of freedom, method labels, finite-sample
  correction, fractional `B` behavior, and cancellation/resource accounting.
- Added flat, recursive Oracle v2, and Worker integration evidence. The local GNU R 4.6.0 advisor
  matches; GNU R 4.6.1 remains the normative release gate.
- Non-integral count coercion remains an explicit boundary. This semantic closure does not change
  the pinned package-corpus totals or resolve the independent `quakes`, Suggested-dependency, or
  native-code blockers.

## Profile 0.523 formula offsets and profileModel

- Formula normalization now retains missing call/subscript positions in term labels and ignores them
  during `all.vars()`-style variable collection.
- GLM objects retain a canonical matched call rather than the raw positional invocation.
- Shared model preparation now sums formula-specified and explicit offsets before LM/GLM fitting.
- The unchanged `profileModel 0.6.2` artifact installs, loads, attaches, passes every applicable
  generic package-check step, and matches an independent profile-likelihood scenario. It advances
  from source-blind holdout P0 to scoped development P7.

## Profile 0.524 multinomial and nor1mix progression

- Added `stats::rmultinom` matrix/normalization/name/boundary behavior with flat, recursive, and
  Worker integration evidence. Exact non-degenerate GNU random-stream identity remains open.
- Added public `mean.default` and `min`/`max` omission of `NULL` arguments.
- Package checks now distinguish a top-level unavailable optional `require()` from guarded optional
  execution without installing or impersonating the dependency.
- Unchanged `nor1mix 1.3-3` installs, loads, attaches, documents its exports, executes a separate
  Gaussian-mixture scenario, and reaches P4. `stats::deriv` call handling is its first P5 blocker.
- `aplpack 1.3.5` remains P1 platform-boundary evidence because its namespace unconditionally
  imports unavailable Tcl/Tk despite listing it under Suggests.

## Profile 0.525 deriv, warning, and nor1mix progression

- Added call-valued `stats::deriv.default` expressions and closures with executable gradients,
  multivariable derivatives, and Hessian attributes for the documented derivative table.
- Added lazy `tools::assertWarning`, original warning-condition retention, and `.Deprecated`
  `deprecatedWarning` behavior.
- Added BFGS `optim` trace/`REPORT` validation and GNU-shaped captured progress output.
- The unchanged `nor1mix 1.3-3` path now passes `norMix2call` and its deprecated `sig2` route. It
  remains P4; `example:norMixFit` first fails at unsupported `density.default(bw = "sj")`.
- These are reusable semantic increments, not claims of complete GNU differentiation, warning,
  optimization, density-bandwidth, P5-P7, or arbitrary-package compatibility.
