# Pure-R package installation and loading

Yes: NativR's package strategy is to run package-owned R code, not to rewrite every exported
function in TypeScript. Any standard pure-R source package can enter the installation pipeline. A
successful install does not by itself promise successful execution: the package and its required
dependency closure must stay inside NativR's supported language, namespace, data, resource, I/O, and
core API contracts.

The scalable unit is the package's R source, not a TypeScript rewrite of each function. NativR
builds one deterministic artifact from the unchanged source package, creates its namespace in the
browser, evaluates its `R/*.R` files through the normalized AST runtime, and reuses the resulting R
closures normally. When execution stops on a missing base/stats/utils primitive, that primitive is
implemented once for every package that needs it.

This is the deliberate minimum-engineering path: maximize the shared Base R/recommended-package
substrate, keep the installer package-agnostic, and use unchanged package execution as the
acceptance test. Package-specific runtime rewrites are avoided; a package-specific host adapter is
considered only when the package intentionally depends on an external capability that R code alone
cannot provide.

```text
CRAN-like source package
  -> bounded archive + license inspection
  -> DESCRIPTION/NAMESPACE/dependency resolution
  -> ordered R source + immutable resources + extracted Rd examples/vignette index
  -> namespace + imports + sysdata
  -> ordinary NativR closure evaluation
```

Source packages are the primary installation input because they retain portable R code. An already
installed GNU R library commonly replaces that source with lazy-load `.rdx`/`.rdb` databases and
possibly bytecode. Those databases are a separate future compatibility layer; applications do not
need them when the corresponding source tarball is available. Supporting their documented external
format later can improve installed-library import, but it does not replace the runtime semantics a
package's code calls.

## Build-time installation

Browser evaluation remains network-free. Repository access, archive unpacking, compatibility
inspection, and dependency resolution happen once during the application build:

```sh
pnpm add -D @nativr/package-tools

# Resolve the current CRAN-like source package plus required Depends/Imports.
pnpm exec nativr-package install pkgconfig --output packages.json

# Or package a local source directory or source tarball.
pnpm exec nativr-package pack ./mypackage --output mypackage.nativr.json
pnpm exec nativr-package pack ./mypackage_1.0.0.tar.gz --output mypackage.nativr.json
```

For separately built artifacts, `resolve` checks the complete local dependency graph and writes one
dependency-first package set:

```sh
pnpm exec nativr-package resolve dependency.nativr.json mypackage.nativr.json --output packages.json
```

The generated package set is ordinary JSON:

```ts
import { createR } from "@nativr/nativr";
import packageSet from "./packages.json" with { type: "json" };

const r = await createR({ packages: packageSet.bundles });
await r.eval("library(pkgconfig)");
const value = await r.eval('pkgconfig::get_config("unset-option", 42L)');
```

Package documentation examples are available through the ordinary R API after packaging:

```ts
await r.eval('utils::example("my_topic", package = "mypackage", echo = FALSE)');
```

The build tool independently extracts `\\examples{}` from `man/*.Rd` into a deterministic manifest.
The browser runtime therefore does not need GNU R, an installed help database, or an Rd parser. It
executes the extracted code through Tree-sitter, the normalized AST, and the same package namespace
used by application calls. `\\dontrun{}` and `\\donttest{}` remain disabled unless the caller sets
`run.dontrun = TRUE` or `run.donttest = TRUE`; `give.lines = TRUE` returns the prepared source
without executing it.

Installed package vignettes are discoverable through the ordinary utils API as well:

```ts
const catalog = await r.eval('utils::vignette(package = "mypackage")');
const guide = await r.eval('utils::vignette("getting-started", package = "mypackage")');
```

The packager indexes source-package `inst/doc` entries deterministically and preserves their Rmd,
Rnw/Snw, `*.pdf.asis`, extracted `.R`, and prebuilt `.html`/`.pdf` resources under `doc/`. The
runtime returns GNU R-shaped `packageIQR` catalogs and `vignette` metadata objects without running
knitr, Sweave, Pandoc, LaTeX, or host viewers. Building a development package's not-yet-rendered
`vignettes/` directory and opening the selected output are separate build/host adapter work.

An application can fetch and cache the JSON package set itself before `createR()`. The runtime does
not fetch repositories or package resources during evaluation.

Packages may still perform data I/O at evaluation time through R's ordinary connection API when the
embedding application explicitly supplies a policy-enforcing transport:

```ts
const r = await createR({
  packages: packageSet.bundles,
  url: async (request) => {
    if (!request.url.startsWith("https://data.example/")) throw new Error("URL denied");
    const response = await fetch(request.url);
    return { body: new Uint8Array(await response.arrayBuffer()) };
  },
});
```

The runtime sends only the URL, selected R method, and validated named headers to this callback. It
copies and bounds the returned `Uint8Array`, stores it in the session byte store on first read, and
then uses the same cursor and connection code as package resources. There is no default `fetch`, so
redirects, authentication, cookies, CORS behavior, caching, and allowed origins remain application
policy. This is especially useful for unchanged pure-R packages that call `readLines(url(...))` or
`gzcon(url(...))`; packages using libcurl native APIs or compiled download code remain outside the
source-only contract.

## Artifact contract

Each `nativr-pure-r-package` v1 artifact contains:

- original DCF `DESCRIPTION` and `NAMESPACE` text;
- an explicit `unix` or `windows` source-platform selection;
- package-relative R sources decoded from portable UTF-8 or Latin-1 and ordered by `Collate`,
  `Collate.unix`, or `Collate.windows` when declared (otherwise C-locale path order);
- `inst/` files mapped to installed package-relative resources, plus preserved `data/`, `demo/`, and
  license files;
- an internal deterministic manifest for topics, aliases, titles, and controlled code extracted from
  `man/*.Rd` example sections when present;
- an internal deterministic vignette index for installed `inst/doc` source, extracted R, and
  rendered output entries when present;
- typed dependency kinds and version constraints;
- install-surface diagnostics;
- a SHA-256 digest over the deterministic JSON payload.

`verify` checks both the schema and digest. `createR()` deep-snapshots the bundle before structured
clone so later JavaScript mutation cannot alter a Worker session.

Resources use base64 only as a transport encoding. `system.file(..., package =)` exposes matching
entries as opaque `nativr://package/<package>/...` paths. Those paths identify immutable files in
the browser package store; they are not host filesystem paths. `readLines()` or a read-only `file()`
connection can consume UTF-8 or Latin-1 text from those paths, including `DESCRIPTION`, `NAMESPACE`,
retained `R/*.R` source, and packaged resources. Package files remain immutable.

## Loader behavior

Worker initialization parses all package R source through Tree-sitter into the NativR-owned
normalized AST. The runtime then provides:

1. dependency-ordered isolated namespaces with version checks;
2. `import` and `importFrom` binding resolution;
3. explicit exports, `pkg::name`, and internal `pkg:::name` lookup;
4. `S3method` registration without attaching implementation bindings globally;
5. `.onLoad()` and `.onAttach()` lifecycle hooks;
6. `library`, `require`, `requireNamespace`, namespace queries, attachment search paths, and reset;
7. package identity lookup through documented `utils::packageName()` semantics;
8. package-version lookup through `utils::packageVersion()` without loading the namespace, using
   validated DESCRIPTION metadata and shared comparable `package_version` values;
9. resettable `.libPaths()` state over normalized browser-owned library roots, consumed by package
   loading, namespace lookup, metadata/resource discovery, explicit virtual `lib.loc`, and hook
   `libname` arguments;
10. stable positive session identity through `Sys.getpid()` without exposing a host process;
11. bounded immutable resource lookup through `system.file()` and text access through `readLines()`
    or session-owned file connections;
12. browser-memory `tempdir()`/`tempfile()` paths, `file.exists()`, `file.info()` and its metadata
    wrappers, stateful text connections, and connection-aware `readLines()`, `writeLines()`,
    `cat()`, and `capture.output()`;
13. `utils::data()` discovery and loading for package `data/*.R`, `.csv`, `.tab`, and `.txt`
    resources plus GNU R XDR/gzip `.rda`/`.RData` workspaces, including target environments and
    overwrite protection;
14. bounded `read.table()`/`read.csv()`/`read.delim()` and `write.table()`/`write.csv()` text-table
    paths over package files, session files, connections, or inline `text=` input.
15. bounded GNU R XDR version-2/version-3 and gzip decoding for `R/sysdata.rda`, loaded into the
    package namespace before its R source is evaluated.
16. `utils::example()` lookup by topic or alias across loaded/installed bundles, optional virtual
    `package` and `lib.loc` selection, package loading, local/global execution, `give.lines`, and
    explicit `run.dontrun` / `run.donttest` controls;
17. `base::gzcon()` wrapping of immutable package resources or session files for bounded gzip text
    and raw reads plus close-time writes through browser-standard streams.
18. `utils::vignette()` listing across installed or attached virtual packages and GNU R-shaped
    metadata lookup for retained package documentation;
19. lazy read-only `base::url()` connections backed by an explicit `createR({ url })` byte adapter,
    reusable by line, raw, source, table, serialization, and gzip readers without exposing host
    networking to package code.
20. stable `stdin()`/`stdout()`/`stderr()` terminal handles, bounded stdout/stderr Worker routing,
    and package-visible `isatty()`/connection-catalog introspection without granting host file
    descriptors or claiming an interactive TTY.
21. regular time-series plotting through exported `stats::ts.plot()`, including equal-frequency
    union, gap-aware line/point geometry, bounded `gpars`, package expression labels, and the same
    Worker graphics journal used by application R code.

Package source, metadata, resource counts, and encoded bytes are bounded before parsing. Package
evaluation then consumes the ordinary step, call-depth, allocation, and output budgets.

The current `example()` boundary is console-oriented. Interactive HTML help, prompting, exact GNU R
source-reference/echo formatting, RNG save-and-restore through `setRNG`, and abort recovery remain
incomplete. An example can still fail when its package code or the example itself reaches an
unsupported R feature; that failure is useful executable evidence for the next shared runtime gap.

The current `vignette()` boundary discovers and describes documentation already present in
`inst/doc`. It does not run vignette builders, regenerate output, implement installed lazy help
databases, or automatically open HTML/PDF through a viewer. Applications can resolve the returned
`Dir` plus `doc/<PDF>` through the immutable package resource API when they choose to expose it.

## Compatibility states

The package tool deliberately separates two questions:

| Field                    | Meaning                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `packaging: "ready"`     | The source install surface can be represented without native or host install code.         |
| `packaging: "blocked"`   | A concrete archive, native-code, install-hook, namespace, or internal-data blocker exists. |
| `execution: "unchecked"` | The artifact still needs runtime loading and package-specific executable evidence.         |

Runtime parse/load errors identify the next missing R feature or imported binding. This distinction
prevents a safe archive scan from being mislabeled as full package compatibility.

## External proof

The opt-in test `packages/package-tools/test/external-package.test.ts` downloads three unchanged
public source packages from the repository resolver and verifies a pinned artifact digest for each:

- [`pkgconfig 2.0.3`](https://cran.r-project.org/package=pkgconfig) proves namespace exports,
  package resources, classed DESCRIPTION metadata with a virtual installation path, and an ordinary
  package-owned call through `get_config()`;
- [`generics 0.1.4`](https://cran.r-project.org/package=generics) proves package-owned S3 generic
  dispatch to an application-defined method;
- [`withr 3.0.3`](https://cran.r-project.org/package=withr) proves deeper unchanged-source loading,
  deterministic installed-vignette discovery, and generated wrapper execution through
  `with_options()`, including restoration after the supplied expression finishes.

No package source is checked into this repository. Together these tests exercise repository
installation, runtime package files, namespace loading, metaprogramming, dynamic caller frames,
closure-formal replacement, and reusable state-management behavior.

The checked-in source-only fixture also exports a function that calls `grDevices::rainbow`,
`terrain.colors`, `topo.colors`, and `cm.colors` through its namespace. This is a small executable
example of the Base-first strategy: one shared runtime implementation becomes available to package
code without translating or wrapping that package function in TypeScript.

Package-defined constructor and wrapper code may also inspect callable signatures through
`args(fun)`. The runtime returns a fresh closure with matching formals and a `NULL` body, including
registered builtin/operator usage metadata; the inline source-package fixture and the Playground's
default Worker both execute this path. It removes one common introspection gap, but package loading
still stops at the first unsupported R semantic, namespace directive, data representation, or
native-code dependency.

Package code may inspect its installed metadata through `utils::packageDescription()` without
loading a second namespace or reading a host file. Full or selected DESCRIPTION fields retain their
source order and continuation text, and the result exposes GNU R-shaped class, field-selection, and
virtual installation-file attributes. The source-only fixture mirrors cli's documented
`unclass(desc)` field access, `pkgconfig 2.0.3` supplies an unchanged public artifact, and the
Playground runs the same query in its default Worker. This does not provide host-library discovery,
malformed-tree recovery, mutable metadata, arbitrary encoding conversion, or the complete
description printing/citation/date method family.

Package `.onLoad()` hooks may dynamically register hidden S3 methods with
`registerS3method(generic, class, method)`, using either a function or a method name resolved inside
the package namespace. Registrations are scoped to the generic's definition environment, repeated
registration replaces the previous entry, an ordinary visible `generic.class` function keeps
dispatch precedence, and a failed load rolls back registrations from that attempt. The inline
package fixture and default Worker example both execute this path, so packages using dynamic S3
registration do not need those methods rewritten as runtime builtins.

Package source may inspect bundled resources with `file.info()`, `file.size()`, `file.mode()`, or
`file.mtime()`. The result uses exact packaged byte sizes, read-only virtual modes, classed
timestamps, and missing rows for unavailable resources; the Playground package executes this path
inside the default Worker. These calls never expose a developer checkout or host filesystem, and
packages that require native owners, ACLs, links, or host-path metadata still need an explicit host
adapter.

Package source can call shared browser-native graphics utilities rather than receiving package-
specific rewrites. The fixture and default Worker now execute `grDevices::hcl()` from unchanged R
source, including recycled CIE-LUV coordinates and alpha transparency. They also create a linear
plot window and call `graphics::axis()` with explicit character labels; the same axis line, ticks,
and text cross the default Worker graphics journal. The package fixture additionally runs sass's
measured vectorized `graphics::rect()` shape with alpha fill and `border = NA`; it reuses the
generic polygon event through inline/package/Worker/Canvas paths rather than translating the package
or adding a package adapter. This proves the ordinary namespace/call path for those callables;
packages still fail explicitly when they reach an unsupported graphics helper, device feature,
native routine, or host color-management facility.

Package source may also load generated or bundled R text without translation. Input
`textConnection()` objects copy character vectors into bounded session memory, and `source()` fully
parses the program before evaluating it sequentially in the global, calling, or explicitly supplied
environment. The return value records the last value and its visibility, and measured echo/printing
behavior works through the same output channel in inline and Worker execution. The package fixture
executes this path unchanged. This does not yet provide output text connections, URLs, host-file
access, retained source references, or continuation after aborting errors.

```sh
$env:NATIVR_EXTERNAL_PACKAGE_SMOKE="1"
pnpm vitest run packages/package-tools/test/external-package.test.ts
```

On macOS or Linux, set the same variable for the command with
`NATIVR_EXTERNAL_PACKAGE_SMOKE=1 pnpm vitest run packages/package-tools/test/external-package.test.ts`.

Failures in these external tests become feature-discovery evidence. They have identified general
runtime seams such as `utils::packageName()`, call-rooted replacement, `bquote()`, closure-like
builtin formals, list-backed environments, dynamic `parent.frame()`, hook registration, and
session-scoped `graphics::par()`. The unchanged `withr 3.0.3` proof now also executes
`withr::with_envvar()` against session-owned `Sys.getenv`/`Sys.setenv`/`Sys.unsetenv`, including
restoring an existing value and removing a temporary value. This additionally exercised GNU R's
`duplicated(..., fromLast = TRUE)` character path. Each seam was implemented once in the runtime;
none of the three packages was patched or translated.

The same shared-runtime rule now covers the highest-reach missing text seam: rank-144 `Encoding`
appears 12 times across the sampled rlang, utf8, and xfun manuals (4.5% weighted reach). NativR now
stores exact bytes and R encoding marks per character element and exposes `Encoding`, `Encoding<-`,
`enc2utf8`, and `enc2native`. Package-owned R code can therefore query, change, subset, concatenate,
and serialize marked strings without a package-specific rewrite. This removes one reusable blocker;
it does not imply that rlang or utf8 are pure-R packages or that their native components can load
unchanged.

The same shared-runtime rule now covers rank-149 `rcauchy`, observed four times across ggplot2,
pillar, and purrr examples (4.2% weighted reach). NativR implements the whole Cauchy family once in
the runtime, including seeded random generation and stable density/probability/quantile operations,
so any package-owned R code can call it without a TypeScript rewrite. This removes a common runtime
gap; it does not mean those packages can already load, because their remaining R semantics,
dependencies, native components, graphics, and installation metadata must each pass independently.

The same rule applies to later packages: a missing callable is prioritized by measured package reach
and implemented as reusable runtime behavior. For example, the rank-80 `dev.off()` gap led to one
browser-device lifecycle shared by every package, including current/list queries, held-command
flush, close, reset, and reopen semantics. Package-specific shims are not the compatibility model.
Rank-127 `system.time()` similarly became one lazy monotonic timing primitive, plus `proc.time()`,
for all 95 measured calls across six packages rather than six package-specific substitutes. Rank-121
`png()` follows the same model for seven calls across five packages: one numbered file device reuses
the shared display list, software renderer, virtual binary store, and raw `readBin()` seam. Packages
can therefore generate and inspect actual PNG resources without a package-specific TypeScript port.
Font/device fidelity and unsupported graphics primitives still determine whether a particular
plotting package is compatible.

Rank-163 `graphics::image()` follows that same package-independent path for the sampled `scales`,
`viridisLite`, and `RColorBrewer` calls. The generic dispatches ordinary S3 methods; the default
method accepts numeric/logical matrices, center or boundary coordinates, explicit colour intervals,
missing transparent cells, one-row palette strips, and both regular and irregular grids. Regular
grids reuse one transferable raster command, while irregular grids reuse the polygon journal. This
removes a shared pure-R dependency seam without translating any of those packages to TypeScript;
their remaining dependencies and runtime calls still need executable evidence.

Rank-174 `graphics::lines()` now removes the next shared seam for scales, matrixStats, posterior,
and zoo. Package-owned `lines.<class>` methods stay ordinary R functions selected by the runtime's
S3 registry; the exported default maps vectors and common coordinate containers, all documented plot
types, missing-value breaks, and line/point styles onto the already-owned graphics journal. That
means installing another pure-R package can reuse this primitive immediately rather than requiring a
TypeScript rewrite or a new Worker message. Compatibility still depends on every other callable,
class, dependency, data format, and graphics behavior that the package exercises.

Rank-176 `base::system()` is now a reusable opt-in host seam rather than an implicit browser shell.
The measured five calls are two `R CMD SHLIB` examples in withr, one `pandoc -h` example in knitr,
and two duplicated `diff` examples in data.table. `R CMD SHLIB` is native compilation and therefore
outside the source-only package contract; `pandoc` and `diff` are external application features, not
R-language semantics. Packages may still load when those paths are not executed. If an application
needs one, `createR({ systemCommand })` can approve that exact command and return its status/output
across inline or Worker execution. No handler means no process authority, and a successful package
bundle still cannot claim that arbitrary external programs exist.

Rank-293 `base::Sys.which()` lets pure-R packages perform those presence checks without translating
their R source or probing the embedding machine. `createR({ executablePaths })` supplies the exact
approved name/path pairs, while an omitted map makes every ordinary query unavailable. The same
snapshot crosses inline and Worker initialization, survives reset, and is consumed by the checked-in
source-only fixture and Playground package. Advertising a path does not itself authorize `system()`;
an application that wants execution must separately configure `systemCommand` with a matching
policy. This keeps package feature detection reusable without turning package installation into
ambient shell access.

Rank-230 `base::readline()` is a second explicit host seam used by curl's email prompt and crayon's
no-prompt example. An application can provide `createR({ readline })`; unchanged package R code then
awaits that single-line callback in inline or Worker mode, and `interactive()` reflects its
availability. Without a callback, R's non-interactive prompt plus empty-result behavior is retained.
This avoids rewriting interactive package helpers while keeping dialog rendering, cancellation,
credential policy, and any secret admission under application control.

Rank-177 `base::as.difftime()` removes the next shared seam for the two measured vctrs/scales calls.
Numeric and character interval construction, automatic and explicit units, names, missing values,
attributes, and the connected `difftime()` recycling/unit behavior live in `base`, so package source
uses them without translation. The checked-in source-only fixture now exports an ordinary R
`duration()` wrapper and executes it through namespace loading. This proves reuse of the runtime
primitive, not compatibility for all of vctrs or scales; named-zone date parsing, arbitrary locale
formats, POSIXlt conversion, native dependencies, and every other package call remain independent
gates.

Rank-184 `base::ls()` removes a namespace and call-frame introspection seam measured in callr,
rstan, and bit64. Source-only package functions can enumerate their own closure namespace or a local
frame, filter hidden names or a pattern, and inspect attached search-list environments without
forcing delayed bindings. The checked-in fixture exports `namespace_names()` unchanged and executes
it through the normal namespace loader. This is reusable package infrastructure, not a claim that
rstan's native code or every package metaprogramming pattern is supported; active bindings, exact
hash-bucket order, locale collation, and the full package/search-path mutation API remain separate
gates.

Rank-186 `graphics::hist()` removes the next shared computation-and-rendering seam for testthat,
openssl, shiny, and posterior. Package R code receives an ordinary six-field `histogram` object and
can use default, named-algorithm, scalar-count, explicit-vector, or callable breaks; plotted bars
and labels reuse the same Worker graphics journal as other packages. The checked-in source-only
fixture exports `histogram_counts()` and loads it through the normal namespace path without a
TypeScript port. This proves reusable runtime behavior, not compatibility for every dependency or
every graphics option those packages may exercise.

The object-system foundation follows the same rule. The checked-in source-only fixture imports
`methods::setClass` and `methods::showClass`, declares `NativRFixtureClass` while its namespace is
loaded, and exports an unchanged R function that captures the class summary. Class ownership, slots,
and inherited declarations live in the session registry, so another pure-R package can reuse them
without a TypeScript rewrite. This does not yet make native Rcpp/rstan binaries loadable or
implement every S4 NAMESPACE directive, validity hook, union, reference class, or multiple-dispatch
rule.

Rank-166 `utils::browseURL()` supplies the same package-independent report/viewer seam for the
measured xfun, htmltools, knitr, and httpuv calls. Unchanged package code can write HTML, SVG, PNG,
or another asset to a session-local path and request that the embedding application present it. The
Worker returns a bounded immutable byte snapshot; it never invokes a desktop browser, reads a host
file, or fetches an external URL. R-function browser callbacks and `browser = "false"` continue to
work without a host event. This removes a common rewrite while leaving navigation policy in the
application.

Rank-195 `.libPaths()` makes package discovery state reusable by ordinary package code. The default
order is the immutable supplied-bundle library `nativr://package` followed by the registered runtime
library `nativr://runtime/library`; setters retain existing normalized virtual directories, remove
duplicates, append the runtime library, and reset with the session. The same state controls
`library`, `require`, `requireNamespace`, namespace operators, `packageVersion`, and `system.file`,
while an explicit virtual `lib.loc` provides a bounded override. The source-only fixture observes
its `.onLoad()` library root, and unchanged `withr 3.0.3` executes `with_libpaths()` and restores
the previous value. This is the library-tree foundation for future runtime installation, not yet a
host filesystem scanner, CRAN downloader, multi-version installed-package database, or binary
loader.

## Explicit boundaries

- C, C++, Fortran, Rust, Java, shared libraries, `LinkingTo`, `useDynLib`, subprocesses, system
  libraries, sockets, and native graphics require separate audited Wasm or host adapters.
- `system()` exposes only an explicit embedding-host request/response contract. The browser runtime
  has no default shell, command search path, inherited environment, or executable filesystem. A host
  adapter can support selected package features, but it does not make a package containing native
  code a pure-R package.
- `configure`, `configure.win`, `cleanup`, and `cleanup.win` are not executed.
- The current NAMESPACE parser supports `export`, `import`, `importFrom`, and `S3method`, while
  package code can call `registerS3method()` once its generic is available. Delayed registration
  against an unloaded suggested package, S4 registration directives, `exportPattern`, conditional
  declarations, and other directives remain blockers. Imported S4 construction/introspection
  functions can run from ordinary package R source, but this is not complete S4 package support.
- `file()` connections currently cover bounded text/binary-mode handles over immutable package files
  and same-session browser-memory paths, including implicit open/close, explicit `open()`/`close()`,
  `isOpen()`, `flush()`, bounded `seek()`, and `summary()`. `gzcon()` adds gzip wrapping for those
  owned connections without granting transport or filesystem authority. URLs, sockets, host paths,
  typed raw/binary decoding or writes beyond raw `readBin()`, seek/pushback within compressed
  streams, separate read/write seek positions, and the broader file API remain separate work.
- `readChar()` covers digest's whole-file and Shiny's bookmark-file fixed-width reads over package
  resources, session files, raw vectors, and owned file/URL/gzip connections. UTF-8 character and
  exact-byte widths, cursors, EOF, warnings, invalid input, and resource limits are shared runtime
  behavior rather than package-specific rewrites.
- `debug()`/`undebug()` cover R6's measured generator and instance-method instrumentation without
  rewriting those closures. Marks follow the shared function object, and `debugonce()` invocations
  can cross the default Worker through the explicit readline adapter. The present browser command
  subset does not yet include arbitrary expressions, nested stepping, `browser()`, or S4 signatures.
- `pdf(NULL)` now supports knitr's measured record/replay setup, and file-backed `pdf()` supports
  data.table's measured grouped-plot output without package-specific rewrites. Pure-R packages can
  therefore call the ordinary `grDevices` API and reuse the same graphics journal as the browser,
  PNG, and Worker paths. Custom/embedded fonts, broad encoding tables, device-exact metrics, and
  package code that depends on unsupported graphics primitives remain explicit compatibility gates.
- Package resources and their parent directories can be enumerated with `list.files()`/`list.dirs()`
  or selected with `setwd()`. Relative `readLines()`, table-reader, and connection paths then
  resolve inside that immutable package root. `R.home()` and the runtime/package/session directory
  trees are virtual NativR identifiers; they do not reveal or depend on an operating-system
  installation.
- `file.remove()` supports the per-file cleanup pattern measured in xfun and data.table. It can
  delete closed mutable session files and returns one logical result per path; immutable package
  resources, open connections, directories, wildcard literals, and host paths remain unavailable and
  produce bounded warnings. This lets package cleanup code run without exposing a host filesystem.
- `file.create()` supports withr's measured deferred-cleanup setup: package R code can create a
  zero-byte tempfile, verify it, and schedule ordinary `unlink()` cleanup without translation.
  Vectorized paths, existing-file truncation, later-argument coercion, exact `showWarnings`
  matching, per-path results/warnings, Worker execution, and resource preflight share the ordinary
  virtual filesystem. Parent directories must exist, and package/runtime resources plus host paths
  remain read-only or unavailable.
- `stats::ts.plot()` supports magrittr's measured exposition-pipe example without translating
  magrittr or the calling package. Numeric vectors and regular vector/matrix series align on a
  shared bounded time grid, missing union cells split paths, and styles/annotations traverse the
  normal Worker/Canvas graphics path. Irregular index packages and multi-panel `plot.ts` still need
  their broader shared runtime foundations before they can be claimed.
- Package `data/*.R` scripts execute through the same parser and normalized AST as package source;
  `.csv`, `.tab`, and `.txt` datasets load into owned data frames. XDR v2/v3 `.rda`/`.RData` and
  gzip wrappers use the independent bounded serialization decoder, and `R/sysdata.rda` enters the
  namespace before source evaluation. bzip2/xz/zstd wrappers, serialized closures/language objects,
  data indexes/aliases, installed-package `.rdx`/`.rdb` lazy-load databases, and full lazy-data
  behavior remain explicit boundaries.
- Bytecode is not loaded. Original R source is parsed into the owned AST.
- Character encoding marks and exact bytes survive the owned vector and XDR paths. Browser-native
  text is deterministically UTF-8; general `iconv`, host locale encodings, malformed-byte display,
  and every encoding-sensitive string primitive remain separate compatibility work.
- The packager defaults to the deterministic `unix` source variant. Packages with platform-specific
  `R/` code can select `--source-platform windows`; the chosen variant is recorded in the artifact.
- `Suggests` is optional unless `--include-suggests` is requested. `Enhances` is not a required
  dependency edge.
- Third-party package code retains its own license and notices. It is an application asset, not
  copied into NativR's Apache-2.0 runtime.
- A package is compatible only at the tested package version and capability manifest; NativR does
  not infer compatibility from “NeedsCompilation: no” alone.

The clean-room boundary in [`clean-room.md`](clean-room.md) applies to runtime work. Public package
documentation and black-box results may define required behavior; GNU R, webR, or third-party
implementation source is never copied into the runtime.
