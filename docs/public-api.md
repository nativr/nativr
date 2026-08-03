# Public API

```ts
import {
  createR,
  NA,
  isComplex,
  isExpression,
  isLanguage,
  isNA,
  isRaw,
  isSymbol,
} from "@nativr/nativr";

const r = await createR(); // Worker by default
await r.assign("x", new Float64Array([1, 2, 3, 4]));
const detail = await r.evalDetailed("mean(x)");
await r.dispose();
```

Sessions expose `eval`, `evalDetailed`, `evalRaw`, `assign`, `get`, `call`, `capabilities`, `reset`,
`interrupt`, and `dispose`. Operations mutate one session in submission order.

Applications may explicitly seed session-owned environment variables without exposing the browser or
Node host environment:

```ts
const r = await createR({ environmentVariables: { API_MODE: "browser" } });
await r.eval('Sys.setenv(TEMP_FLAG = "active")');
await r.eval('Sys.getenv(c("API_MODE", "TEMP_FLAG"))');
await r.reset(); // restores API_MODE and removes TEMP_FLAG
```

The options record is snapshotted at construction and sent through the Worker initialization
protocol. `Sys.getenv()`, `Sys.setenv()`, and `Sys.unsetenv()` operate only on that isolated map;
they never read or mutate `process.env`, browser globals, or another NativR session.

Executable discovery is a separate data-only allow-list. It lets unchanged package code check for
host-approved tools without giving R code a PATH scanner or process capability:

```ts
const r = await createR({
  executablePaths: {
    pandoc: "nativr://host/bin/pandoc",
  },
});

await r.eval('Sys.which(c("pandoc", "git"))');
// ["nativr://host/bin/pandoc", ""]
```

The map is snapshotted and works identically through inline and default Worker execution. It is not
derived from `systemCommand`; applications that both advertise and execute a tool should enforce the
same allow-list in both options.

`base::system()` and `base::system2()` are available through an explicit, asynchronous host policy.
NativR never chooses a shell or process API and the option is absent by default. An embedding
application may allow-list virtual commands, a sandboxed service, or a platform-specific process
runner and return bounded text plus an exit status:

```ts
const r = await createR({
  executablePaths: { "report-version": "nativr://host/bin/report-version" },
  systemCommand: async (request) => {
    if (request.operation !== "system" || request.command !== "report-version") {
      return { status: 127, errorMessage: "command is not allowed", failedToStart: true };
    }
    return { status: 0, stdout: "reporter 1.0\n" };
  },
});
await r.eval('Sys.which("report-version")'); // "nativr://host/bin/report-version"
await r.eval('system("report-version", intern = TRUE)'); // "reporter 1.0"
await r.eval('system2("report-version", "--json", stdout = TRUE)');
```

The request has an `operation` discriminator. A `system` request includes GNU R 4.6's controls,
line-oriented `input`, and timeout value. A `pipe` read sends `inputText: null`; a pipe write sends
the exact buffered stdin text in `inputText`. A `system2` request additionally preserves
`commandElements`, `args`, portable `environment` entries, `stdinPath`, and separate `stdout` /
`stderr` descriptors whose modes are `console`, `capture`, `discard`, or `file`. This is structured
policy input, not a safe-to-run shell string: the host must still validate executable identity,
arguments, environment names, and every file path. The result accepts `status`, optional
`stdout`/`stderr`, `errorMessage`, `failedToStart`, and `timedOut`. Inline execution calls the same
handler directly; Worker execution uses a correlated request/result exchange while the R evaluation
is suspended. With no handler, `system()`, `system2()`, and an executing `pipe()` fail with
`NRU6194`. A constructed but unused pipe remains inert and can be closed normally. The handler, not
NativR, owns allow-listing, argument interpretation, quoting, environment isolation, redirection,
cancellation, and actual process semantics.

The same policy can expose a selected command as a normal R connection, including from unchanged
pure-R package code: `readLines(pipe("approved-report"))`. Open write pipes buffer R output and pass
it as exact text when closed. The current adapter is one-shot and one-way; duplex `r+`, interactive
streaming, shell discovery, and NUL-containing binary stdin are not claimed.

`utils::aspell()` reuses the same policy for an Ispell-compatible `-a` program. Advertise only an
allow-listed checker in `executablePaths`, then accept the structured `system2` request in
`systemCommand`; its `input` contains caret-prefixed filtered lines and its `args` begin with `-a`.
The runtime reads only session/package virtual files, can invoke an arbitrary R `filter` function,
and converts the returned pipe text to GNU R's five-column `aspell` data frame. It never discovers
or launches a checker itself. Built-in document filters and `dictionaries=` are not yet supported.

## Typed native/Wasm calls

`.Call()` is available only through an explicit module registry and data-only host adapter:

```ts
const r = await createR({
  nativeModules: [
    {
      name: "mypackage",
      path: "wasm://mypackage/module.wasm",
      dynamicLookup: false,
      forceSymbols: false,
      routines: [{ name: "mypackage_sum", numParameters: 1 }],
    },
  ],
  nativeCall: async ({ module, routine, arguments: args }) => {
    if (module !== "mypackage" || routine !== "mypackage_sum") throw new Error("denied");
    const input = args[0];
    if (input?.type !== "double") throw new Error("double vector required");
    return {
      value: {
        version: 1,
        type: "double",
        values: new Float64Array([input.values.reduce((a, b) => a + b, 0)]),
      },
    };
  },
});

await r.eval('.Call("mypackage_sum", c(1, 2, 3), PACKAGE = "mypackage")'); // 6
```

`nativeModules` is snapshotted at construction. Registered names, `numParameters`, exact `PACKAGE`
selection, `dynamicLookup`, and `forceSymbols` are enforced before the callback runs.
`getLoadedDLLs()` exposes the owned registry using `DLLInfoList`/`DLLInfo` records and virtual
paths; its `handle` and `info` fields are `NULL` because raw pointers never cross this boundary.
Arguments and results use `RValueSnapshot`, so atomic vectors, lists, names, dimensions, missing
values, raw, complex, symbols, language, expressions, and the documented formula representation can
cross. Closures, environments, promises, arbitrary attributes, external pointers, and cyclic graphs
cannot yet cross. The handler should instantiate and call an audited Wasm module; it is not a
dynamic JavaScript evaluator. Results are checked against vector/output limits. Omitted modules
expose no symbols; an omitted handler fails with `NRU6210`.

`base::readline()` and interactive browser-page pauses requested by `grDevices::devAskNewPage(TRUE)`
use a separate line-oriented host adapter. This enables unchanged pure-R package prompts without
exposing DOM objects to R or the Worker:

```ts
const r = await createR({
  readline: async ({ prompt }) => showApplicationPrompt(prompt),
});
```

The handler receives a copied `{ prompt }` record and must return one string without NUL or newline
characters. NativR applies R's leading/trailing space-and-tab trimming and charges UTF-8 input bytes
to `maxOutputBytes`. The callback may be asynchronous; a correlated protocol exchange suspends only
the current Worker evaluation. A configured handler makes `interactive()` return `TRUE`. With no
handler, `interactive()` is `FALSE`, `readline()` emits its prompt with the non-interactive newline,
and returns `""` without contacting the host; `devAskNewPage(TRUE)` records device state but never
blocks. File graphics devices never invoke this handler.

The same explicit handler services `debug()`/`debugonce()` prompts, including across the default
Worker. The current debugger accepts empty/`next`, `continue`, `finish`, and `Q`; it does not yet
evaluate arbitrary R expressions or inspection commands at `Browse[]`. With no handler, a marked
call emits its entry trace and continues without granting any new host capability.

`evalDetailed` returns textual `print()`/`cat()` output as ordered
`{ stream: "stdout" | "stderr" | "message", text }` events. `createR({ onOutput })` receives the
same events in both inline and Worker execution, while the detailed result retains them for
deterministic inspection. `print()` returns its input invisibly and `cat()` returns invisible
`NULL`, exposed through the result's `visible` flag. Text counts toward `maxOutputBytes`.
`utils::capture.output()` diverts selected events into an in-memory character result, so captured
events are absent from `evalDetailed().output` and `onOutput`; `split = TRUE` duplicates stdout back
to both destinations. Captured bytes remain bounded by `maxOutputBytes`. A supported session path or
file connection stores captured text inside the evaluator; host paths remain unavailable.

R code can use `tempdir()`/`tempfile()` with `file()`, `file.exists()`,
`readLines()`/`writeLines()`, connection-aware `cat()`/`capture.output()`,
`dput()`/`dget()`/`unlink()`/`file.create()`/`file.copy()`/`file.remove()`, or `save()`/`load()` for
bounded, same-session text and supported workspace serialization. `open()`/`close()` expose
read/write/append modes, `seek()` controls the supported shared text cursor, and `isOpen()` or
`summary()` reports state. `grDevices::png()` can write a bounded image into the same store;
`grDevices::pdf()` writes bounded single- or multi-page documents, while `pdf(NULL)` supplies a
recording-only device without a file. `gzcon()` can wrap an owned file connection for bounded
browser-native gzip text/raw reads or close-time writes, while raw `readBin()` returns owned bytes
and `readChar()` consumes fixed-width UTF-8 or byte fields; if such a raw value is the evaluation
result, the normal public raw-value conversion exposes its copied `Uint8Array`. Opaque
`nativr://session-temp/...` identifiers never become usable host paths and are cleared by `reset()`
or `dispose()`. The workspace archive is NativR canonical source rather than a GNU R `.RData`
binary.

Graphics recording is independently controllable from R. `grDevices::dev.control("inhibit")` clears
and disables the current device's `recordPlot()` display list without stopping structured browser
events or PNG/PDF generation; `dev.control("enable")` clears and starts a new recording. This is
per-device session state and introduces no host callback or additional public protocol.

Within R, `dir.create()` can create nested session directories and `getwd()`/`setwd()` plus relative
paths work across session files and immutable package resources. `list.files()`/`dir()` and
`list.dirs()` enumerate only those owned roots; `normalizePath()`, `basename()`, and `dirname()` are
pure virtual-path operations. `reset()` clears mutable directories and restores the working
directory to `tempdir()`. `R.home()` reports a static NativR runtime root, not a host R
installation.

`utils::read.table()`/`read.csv()`/`read.delim()` and their matching writers use the same paths and
connections, so package or application code can exchange bounded delimited data frames without a
host file. Inline `text=` is also accepted. This is a deterministic text-table subset, not a claim
for compressed files, URLs, arbitrary encodings, or the complete GNU R scanner.

`createR({ packages })` accepts `PureRPackageBundle` objects containing DCF `DESCRIPTION`,
`NAMESPACE`, deterministic package-relative `R/*.R` source strings, and optional base64 package
resources. The bundle is deep-snapshotted, structured-cloned during Worker initialization, parsed
into the owned AST, and registered in the session's isolated package catalog. `pkg::name` loads a
namespace without attaching it; `library(pkg)` attaches its exports. Imports, dependency version
constraints, S3 registrations, `.onLoad()`, and `.onAttach()` use the runtime's environment and
closure model. `system.file()` returns opaque `nativr://package/...` paths for immutable package
metadata, retained R source, and packaged resources; `readLines()` and read-only `file()`
connections can read their text, and `gzcon()` can unwrap packaged gzip bytes, without granting
host-filesystem or network access. `unz()` can likewise expose one bounded stored/DEFLATE member of
a packaged or session-owned ZIP through the ordinary connection readers without extracting it.
`reset()` unloads and detaches packages while retaining the supplied catalog so later namespace
access can load it again. `utils::data()` discovers direct package `data/*.R`, `.csv`, `.tab`,
`.txt`, `.rda`, and `.RData` resources and loads them into the requested R environment. `.R` scripts
use the package's declared UTF-8/Latin-1 encoding and the ordinary normalized-AST evaluator; binary
workspaces use the bounded GNU R XDR v2/v3 and gzip decoder. A packaged `R/sysdata.rda` is loaded
into its namespace before R source evaluation. Installed `.rdx`/`.rdb` lazy-load databases and
unsupported serialized object types/compressors remain explicit boundaries.

`@nativr/package-tools` is the build-time installer for standard source directories, `.tar.gz`
archives, and CRAN-like repositories. It resolves required dependencies and emits integrity-locked
JSON whose `bundles` field can be passed directly to `createR()`. Repository access and archive
inspection never run inside the browser evaluator. See
[`examples/pure-r-package.ts`](../examples/pure-r-package.ts) and
[`pure-r-packages.md`](pure-r-packages.md).

The tool rejects native compilation, JVM code, symbolic links, unsafe archive paths, installation
hooks, `LinkingTo`, `useDynLib`, and unsupported NAMESPACE directives. Successful packaging remains
distinct from execution compatibility: every dependency and R feature exercised by the package must
still be in the documented NativR subset.

`utils::demo(package = character())` exposes the empty GNU R catalog shape without host I/O.
External package/topic selection is rejected until bundles can provide browser-safe demo resources;
the public API never searches a system R library.

Source-package bundles built by `@nativr/package-tools` can expose their `man/*.Rd` examples through
`utils::example(topic, package=)`. Topic aliases, `give.lines`, local/global execution, active or
explicit virtual libraries, and opt-in `run.dontrun` / `run.donttest` are supported; the selected
source runs through the same Worker and resource limits as `eval()`. The public API never reads a
host help database or fetches documentation during evaluation.

The same bundles expose every indexed `man/*.Rd` topic through `utils::help()`. Default text output
uses the evaluation output journal; an explicit `help_type = "html"` followed by `print()` produces
a bounded, script-free session-file browse request available in `evalDetailed().browseRequests` or
`createR({ onBrowse })`. The host remains responsible for presenting that inert snapshot. This is a
portable common-section renderer, not byte-identical GNU Rd conversion or `?`/`??` search.

`utils::View()` emits character-formatted tables in `evalDetailed().dataViews` and returns invisible
`NULL`. Each event contains a title, named columns, and optional non-default row names.
`createR({ onDataView })` receives the same events after inline or Worker evaluation. Event text
counts toward `maxOutputBytes`; the runtime never opens a window or imports the DOM. The Playground
provides the reference read-only HTML table renderer, while embedding applications can present the
same structured event in their own UI.

```ts
const views = [];
const r = await createR({ onDataView: (event) => views.push(event) });
await r.eval(`
  measurements <- data.frame(sample = c("A", "B"), value = c(1.2, NA))
  View(measurements, "Measurements")
`);
```

`utils::browseURL()` uses a separate inert host seam. `evalDetailed().browseRequests` and
`createR({ onBrowse })` receive `{ kind: "url", url }` for ordinary locations or
`{ kind: "file", url, mimeType, bytes }` for an existing browser-memory session/package file. File
bytes are copied at evaluation time, cross the Worker boundary as transferables, and count toward
`maxOutputBytes`. Nothing is fetched or opened automatically; the embedding application must apply
its own scheme/origin policy and require user interaction where appropriate.

```ts
const requests = [];
const r = await createR({ onBrowse: (event) => requests.push(event) });
await r.eval(`
  page <- tempfile(fileext = ".html")
  writeLines("<h1>Package report</h1>", page)
  browseURL(page)
`);
// requests[0].kind === "file"; the host may preview it in a sandboxed iframe.
```

The same seam backs installed documentation catalogs. `utils::browseVignettes()` returns its GNU
R-shaped index without host activity; printing that object generates one self-contained virtual HTML
file whose links embed the package's immutable rendered output, source, and extracted R code:

```ts
const evaluation = await r.evalDetailed('print(utils::browseVignettes(package = "mypackage"))');
// evaluation.browseRequests[0].kind === "file"
```

The reference Playground previews that file in an iframe with no sandbox permissions. Embedders must
retain an equivalent content and navigation policy.

GNU R's `browser = function(url) ...` extension remains inside R and receives a lazy original or
`encodeIfNeeded`-encoded URL; `browser = "false"` suppresses the request. A character
browser-program name is treated only as host intent because browser packages cannot spawn processes.

The independent `createR({ url })` byte adapter also backs read-only `url()` connections,
session-file downloads, and `utils::available.packages()` repository indexes:

```ts
const r = await createR({
  url: async ({ url }) => {
    if (!url.startsWith("https://data.example/")) throw new Error("URL denied");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { body: new Uint8Array(await response.arrayBuffer()) };
  },
});

await r.eval(`
  path <- tempfile(fileext = ".csv")
  utils::download.file("https://data.example/input.csv", path, quiet = TRUE, mode = "wb")
  read.csv(path)
`);

const packages = await r.eval(`
  db <- utils::available.packages(repos = "https://data.example/cran", type = "source")
  c(rownames(db), db[, "Version"])
`);
```

The destination is a browser-memory session path, not a host path. `available.packages()` requests
the derived `src/contrib/PACKAGES` URL and maintains only an age-bounded evaluator-session cache.
The default session has no URL adapter and fails closed. Redirects, credentials, persistent caching,
and origin policy remain entirely with the application.

Duplex socket connections use a separate explicit lifecycle adapter. The package receives ordinary R
connection semantics; the host decides which endpoints and transport implementation are allowed:

```ts
const r = await createR({
  socket: async (request) => {
    if (request.operation === "open") {
      if (request.host !== "service.example" || request.port !== 443) throw new Error("denied");
      await transport.open(request.sessionId, request.connectionId);
      return {};
    }
    if (request.operation === "write") {
      await transport.write(request.sessionId, request.connectionId, request.bytes);
      return {};
    }
    if (request.operation === "read") {
      return { body: await transport.read(request.maxBytes), incomplete: false };
    }
    await transport.lifecycle(request);
    return {};
  },
});

await r.eval(`
  con <- socketConnection("service.example", 443, open = "a+b")
  writeLines("ping", con)
  reply <- readLines(con, n = 1)
  close(con)
  reply
`);
```

Requests are typed as `open`, `read`, `write`, `timeout`, `close`, or session-scoped `close-all`.
Read results require a bounded `Uint8Array` and `incomplete` flag; lifecycle operations return `{}`.
Inline and Worker sessions use the same validation. With no adapter, `capabilities("sockets")` is
false and opening a socket fails with `NRU6207`; NativR never chooses raw TCP, WebSocket, TLS,
proxy, credentials, or endpoint policy on the application's behalf. Socket text writes and line/raw
reads are covered; general `writeBin()`, typed binary decoding, half-close, and transport-specific
buffering remain outside this increment.

`evalDetailed` also retains device-independent graphics commands in `graphics`.
`createR({ onGraphics })` receives the same commands after each inline or Worker evaluation.
`new-page` clears a host device, `window` declares its user-coordinate limits, `raster` carries an
owned row-major RGBA buffer plus placement, angle, and interpolation fields, and `segments` carries
finite endpoint records with resolved `#RRGGBBAA` colors, line widths, and normalized dash patterns.
`points` carries finite coordinates, numeric or literal-character symbols, resolved border/fill
colors, size multipliers, and line widths. `polygon` carries closed finite-coordinate paths,
canonical fill/border colors, normalized line types and widths, and an even-odd or nonzero fill
rule. `legend` carries a keyword/coordinate anchor, resolved entry labels and line/point styles, box
and background state, column count, scale, and optional title. Raster buffers and bounded
segment/point/polygon/legend payloads count toward `maxOutputBytes`; raster buffers cross the Worker
boundary as transferables. The package never imports the DOM; hosts decide whether to render
commands to Canvas, another device, or a test recorder. The Playground includes the reference Canvas
renderer.

High-level `graphics::image()` uses the same public command vocabulary: regular grids emit one
`raster` event, while irregular grids emit borderless `polygon` cells. Hosts do not need a separate
image-specific renderer. `graphics::lines()` likewise maps connected, point-bearing, histogram, and
step types onto existing `segments` and `points` events, so package-owned line methods require no
additional host protocol.

`stats::ts.plot()` also uses only this vocabulary: equal-frequency regular series align on a bounded
union time grid and emit ordinary `window`, `box`, `segments`, `points`, and `text` events. Hosts
need no time-series-specific handler, `par("usr")` reports the active event window, and the default
Worker plus source-only package example exercise the same route.

```ts
const graphics = [];
const r = await createR({ onGraphics: (event) => graphics.push(event) });
await r.eval(`
  plot.new()
  dev.hold()
`);
await r.eval(`
  plot.window(c(0, 2), c(0, 2))
  image <- as.raster(matrix(c("red", "green", "blue", "white"), 2, 2))
  rasterImage(image, 0, 0, 2, 2)
  lines(c(.25, 1, 1.75), c(1.5, .5, 1.5), col = "purple", lwd = 2)
  segments(c(.5, 1.5), c(.25, .5), y1 = c(1.5, 1.75), col = c("red", "blue"))
  points(c(.5, 1, 1.5), c(.5, 1.5, 1), pch = c(16, 21, 65), col = c("red", "blue", "green"))
  polygon(c(.25, 1, 1.75), c(.25, 1.75, .25), col = "#FFA50099", border = "blue")
  legend("topleft", c("A", "B"), lty = 1, pch = 1:2, col = c("red", "blue"))
`);
await r.eval("dev.flush()");
await r.eval(`
  recorded <- recordPlot()
  replayPlot(recorded)
`);
```

The middle evaluation returns no graphics because the owned device is held. The final flush reaches
level zero and releases the pending window/raster/segments/points/polygon/legend commands in order;
pending raster, segment, point, polygon, and legend storage remains subject to `maxOutputBytes` and
pending command count to `maxVectorLength`. `recordPlot()` snapshots the current NativR-owned
display list and `replayPlot()` re-emits it through the same graphics callback. Only same-runtime
NativR recorded plots are accepted; external GNU R serialized plots and package reloading are not
part of this API slice.

`eval` unwraps length-one atomic vectors and returns arrays for longer vectors. `NULL` becomes
`null`; R missing values become the canonical exported `NA` marker; ordinary NaN remains JavaScript
`NaN`. Complex scalars become immutable `{ __nativr__: "complex", real, imaginary }` records and
complex vectors become arrays of those records; `isComplex` identifies that shape. Formulas return
an immutable `{ __nativr__: "formula", response?, terms, variables, intercept }` record. `evalRaw`
returns versioned typed-array snapshots with explicit missing masks, optional exact `names` and
`dim` arrays, or a normalized formula record. The friendly atomic/list conversion intentionally
omits R attributes.

Quoted identifiers become immutable `{ __nativr__: "symbol", name }` records, while quoted compound
syntax becomes `{ __nativr__: "language", source }`; `isSymbol` and `isLanguage` identify these
shapes. Expression vectors become immutable `{ __nativr__: "expression", sources }` records and
`isExpression` identifies them. Each source string is a stable R-like diagnostic rendering, not
original source text and not an exposed AST. Symbol, language, and expression records can also be
passed to `assign` or `call`; the runtime parses each diagnostic source back into exactly one
normalized expression before accepting it. Malformed or multi-expression entries are rejected.

Pairlists use a distinct lossless `evalRaw` snapshot type with recursive values, optional exact
tags, and optional validated dimensions. Friendly `eval` converts both lists and pairlists to
JavaScript arrays; use `evalRaw` when the pairlist/list distinction or dimensions matter. Arbitrary
runtime attributes and explicit classes do not yet cross this public snapshot boundary.

Raw vectors become `{ __nativr__: "raw", bytes: Uint8Array }` records and `isRaw` identifies that
shape. Passing the same record to `assign` or `call` preserves the raw type; a bare `Uint8Array`
continues to mean an integer input for backward compatibility.

Inside an R session, character elements retain exact bytes and R encoding marks for `Encoding`, raw
conversion, subset/replacement, and XDR serialization. Friendly `eval` and the current version-1
`evalRaw` character snapshot intentionally return Unicode string values only; they do not expose or
round-trip internal encoding metadata through JavaScript. Use R-side `charToRaw`, `Encoding`, or
serialization when byte/mark identity is required.

Inputs include scalar numbers, booleans, strings, null, homogeneous arrays, supported TypedArrays,
`NA` inside arrays, complex records, homogeneous arrays of complex records, raw records, and
symbol/language/expression records. `assign(..., { transfer: true })` may detach a transferable
Worker input; the default copies. Unsupported objects are rejected.

Worker timeout or interrupt terminates and recreates the Worker because a synchronous Worker cannot
process a message cooperatively. The thrown error reports `runtimeReset: true`; prior user bindings
are lost. Inline interrupt is cooperative at evaluator checkpoints.
