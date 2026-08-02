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

`base::system()` is available through an explicit, asynchronous host policy. NativR never chooses a
shell or process API and the option is absent by default. An embedding application may allow-list
virtual commands, a sandboxed service, or a platform-specific process runner and return bounded text
plus an exit status:

```ts
const r = await createR({
  systemCommand: async (request) => {
    if (request.command !== "report-version") {
      return { status: 127, errorMessage: "command is not allowed", failedToStart: true };
    }
    return { status: 0, stdout: "reporter 1.0\n" };
  },
});
await r.eval('system("report-version", intern = TRUE)'); // "reporter 1.0"
```

The request includes GNU R 4.6's controls, input lines, and timeout value. The result accepts
`status`, optional `stdout`/`stderr`, `errorMessage`, `failedToStart`, and `timedOut`. Inline
execution calls the same handler directly; Worker execution uses a correlated request/result
exchange while the R evaluation is suspended. With no handler, `system()` fails with `NRU6194`. The
handler, not NativR, owns allow-listing, quoting, environment isolation, cancellation, and actual
process semantics.

`base::readline()` uses a separate line-oriented host adapter. This enables unchanged pure-R package
prompts without exposing DOM objects to R or the Worker:

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
and returns `""` without contacting the host.

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
`dput()`/`dget()`/`unlink()`/`file.remove()`, or `save()`/`load()` for bounded, same-session text
and supported workspace serialization. `open()`/`close()` expose read/write/append modes, `seek()`
controls the supported shared text cursor, and `isOpen()` or `summary()` reports state.
`grDevices::png()` can write a bounded image into the same store. `gzcon()` can wrap an owned file
connection for bounded browser-native gzip text/raw reads or close-time writes, while raw
`readBin()` returns owned bytes and `readChar()` consumes fixed-width UTF-8 or byte fields; if such
a raw value is the evaluation result, the normal public raw-value conversion exposes its copied
`Uint8Array`. Opaque `nativr://session-temp/...` identifiers never become usable host paths and are
cleared by `reset()` or `dispose()`. The workspace archive is NativR canonical source rather than a
GNU R `.RData` binary.

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
host-filesystem or network access. `reset()` unloads and detaches packages while retaining the
supplied catalog so later namespace access can load it again. `utils::data()` discovers direct
package `data/*.R`, `.csv`, `.tab`, `.txt`, `.rda`, and `.RData` resources and loads them into the
requested R environment. `.R` scripts use the package's declared UTF-8/Latin-1 encoding and the
ordinary normalized-AST evaluator; binary workspaces use the bounded GNU R XDR v2/v3 and gzip
decoder. A packaged `R/sysdata.rda` is loaded into its namespace before R source evaluation.
Installed `.rdx`/`.rdb` lazy-load databases and unsupported serialized object types/compressors
remain explicit boundaries.

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

GNU R's `browser = function(url) ...` extension remains inside R and receives a lazy original or
`encodeIfNeeded`-encoded URL; `browser = "false"` suppresses the request. A character
browser-program name is treated only as host intent because browser packages cannot spawn processes.

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
