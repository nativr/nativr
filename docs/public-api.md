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

`evalDetailed` returns textual `print()`/`cat()` output as ordered
`{ stream: "stdout" | "stderr" | "message", text }` events. `createR({ onOutput })` receives the
same events in both inline and Worker execution, while the detailed result retains them for
deterministic inspection. `print()` returns its input invisibly and `cat()` returns invisible
`NULL`, exposed through the result's `visible` flag. Text counts toward `maxOutputBytes`.
`utils::capture.output()` diverts selected events into an in-memory character result, so captured
events are absent from `evalDetailed().output` and `onOutput`; `split = TRUE` duplicates stdout back
to both destinations. Captured bytes remain bounded by `maxOutputBytes`. File paths and connection
targets are rejected because the browser runtime exposes no filesystem.

`utils::demo(package = character())` exposes the empty GNU R catalog shape without host I/O.
External package/topic selection is rejected until a package loader can provide browser-safe demo
resources; the public API never searches a system R library.

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

`evalDetailed` also retains device-independent graphics commands in `graphics`.
`createR({ onGraphics })` receives the same commands after each inline or Worker evaluation.
`new-page` clears a host device, `window` declares its user-coordinate limits, `raster` carries an
owned row-major RGBA buffer plus placement, angle, and interpolation fields, and `segments` carries
finite endpoint records with resolved `#RRGGBBAA` colors, line widths, and normalized dash patterns.
Raster buffers and bounded segment payloads count toward `maxOutputBytes`; raster buffers cross the
Worker boundary as transferables. The package never imports the DOM; hosts decide whether to render
commands to Canvas, another device, or a test recorder. The Playground includes the reference Canvas
renderer.

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
  segments(c(.5, 1.5), c(.25, .5), y1 = c(1.5, 1.75), col = c("red", "blue"))
`);
await r.eval("dev.flush()");
await r.eval(`
  recorded <- recordPlot()
  replayPlot(recorded)
`);
```

The middle evaluation returns no graphics because the owned device is held. The final flush reaches
level zero and releases the pending window/raster/segments commands in order; pending raster and
segment storage remains subject to `maxOutputBytes` and pending command count to `maxVectorLength`.
`recordPlot()` snapshots the current NativR-owned display list and `replayPlot()` re-emits it
through the same graphics callback. Only same-runtime NativR recorded plots are accepted; external
GNU R serialized plots and package reloading are not part of this API slice.

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

Inputs include scalar numbers, booleans, strings, null, homogeneous arrays, supported TypedArrays,
`NA` inside arrays, complex records, homogeneous arrays of complex records, raw records, and
symbol/language/expression records. `assign(..., { transfer: true })` may detach a transferable
Worker input; the default copies. Unsupported objects are rejected.

Worker timeout or interrupt terminates and recreates the Worker because a synchronous Worker cannot
process a message cooperatively. The thrown error reports `runtimeReset: true`; prior user bindings
are lost. Inline interrupt is cooperative at evaluator checkpoints.
