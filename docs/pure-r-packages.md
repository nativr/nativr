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

That gives NativR a two-layer compatibility target:

1. implement the Base R and recommended-package language/API substrate once, with black-box GNU R
   evidence for each claimed behavior;
2. admit and execute unchanged source-only packages through one generic installer and loader;
3. for packages with compiled code, build their portable native component to an audited Wasm module
   and register its exported routines through the generic typed `.Call` adapter.

This is how package coverage can grow much faster than the TypeScript codebase. The third layer now
has a real `.Call` request/result seam, but not a GNU R C-API implementation: each compiled package
still needs a reviewed Wasm build/adapter, and C/C++/Fortran/JVM code does not become portable
merely because its R wrapper can load. The long-term engineering goal is one reusable Wasm ABI and
package build pipeline, not a TypeScript rewrite of every native routine.

The usage-ranked `graphics::curve` increment is executable evidence for this strategy: an unchanged
source-package function can import or namespace-qualify `curve`, evaluate its own caller-scoped R
expression, and render through the same Worker graphics journal as inline code. The runtime contains
no package-specific implementation for that fixture or for numDeriv's measured example. This proves
the generic package seam for the exercised behavior, not compatibility with every numDeriv function
or arbitrary pure-R package.

```text
CRAN-like source package
  -> bounded archive + license inspection
  -> DESCRIPTION/NAMESPACE/dependency resolution
  -> ordered R source + immutable resources + extracted Rd examples/vignette index
  -> namespace + imports + sysdata
  -> ordinary NativR closure evaluation

Package with compiled code
  -> the same R-source installation path
  -> separately audited C/C++/Fortran-to-Wasm build
  -> registered module/routine manifest
  -> typed `.Call` snapshots through the Worker
```

Today the first path is executable. The second path's registration, lookup, argument-count checking,
Worker transport, resource validation, and Playground proof are executable; automatic compilation,
the full SEXP/external-pointer model, registration extraction, and arbitrary CRAN native-package
loading remain future work.

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

Every packaged `man/*.Rd` page is also discoverable through the ordinary help API, whether or not
the page contains an examples section:

```ts
const topic = await r.eval('utils::help("my_topic", package = "mypackage")');
const page = await r.evalDetailed(
  'print(utils::help("my_topic", package = "mypackage", help_type = "html"))',
);
console.log(topic.attributes.class); // ["help_files_with_topic"]
console.log(page.browseRequests[0]?.url); // bounded session-file snapshot
```

The build tool converts common Rd sections into a deterministic, package-independent text manifest;
the Worker never embeds an Rd parser or opens a GNU R help database. Text is the non-interactive
default. Requested HTML is generated as escaped, script-free content and crosses the existing
`browseURL` journal, so the application still decides whether to display it. This portable renderer
does not yet promise exact GNU Rd macro expansion, `?`/`??` search, installed lazy help databases,
PDF fidelity, or byte-identical GNU text/HTML.

Installed package vignettes are discoverable through the ordinary utils API as well:

```ts
const catalog = await r.eval('utils::vignette(package = "mypackage")');
const guide = await r.eval('utils::vignette("getting-started", package = "mypackage")');
const browsed = await r.evalDetailed('print(utils::browseVignettes(package = "mypackage"))');
```

The packager indexes source-package `inst/doc` entries deterministically and preserves their Rmd,
Rnw/Snw, `*.pdf.asis`, extracted `.R`, and prebuilt `.html`/`.pdf` resources under `doc/`. The
runtime returns GNU R-shaped `packageIQR`, `vignette`, and `browseVignettes` objects without running
knitr, Sweave, Pandoc, or LaTeX. Printing a browse catalog creates a bounded self-contained HTML
snapshot for the existing inert host viewer seam. Building a development package's not-yet- rendered
`vignettes/` directory remains separate build work.

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
policy. This is especially useful for unchanged pure-R packages that call `readLines(url(...))`,
`gzcon(url(...))`, or `utils::download.file()` into a session-owned path; packages using libcurl
native APIs or compiled download code remain outside the source-only contract.

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
- a separate deterministic help manifest for every `man/*.Rd` page, including topics without
  examples, with portable common-section text;
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
3. explicit exports, `pkg::name`, internal `pkg:::name`, and exact non-inheriting private lookup
   through `utils::getFromNamespace()`;
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
17. `utils::help()` lookup for registered core bindings or indexed package topics/aliases, plus GNU
    R-shaped topic/package-index values and bounded text or script-free HTML presentation;
18. `base::gzcon()` wrapping of immutable package resources or session files for bounded gzip text
    and raw reads plus close-time writes through browser-standard streams.
19. `utils::vignette()` listing across installed or attached virtual packages and GNU R-shaped
    metadata lookup for retained package documentation;
20. lazy read-only `base::url()` connections backed by an explicit `createR({ url })` byte adapter,
    reusable by line, raw, source, table, serialization, and gzip readers without exposing host
    networking to package code.
21. `utils::download.file()` over the same explicit byte adapter, with vectorized preflight,
    browser-memory destinations, replacement modes, GNU R-shaped status values, and no ambient
    network or host filesystem.
22. stable `stdin()`/`stdout()`/`stderr()` terminal handles, bounded stdout/stderr Worker routing,
    and package-visible `isatty()`/connection-catalog introspection without granting host file
    descriptors or claiming an interactive TTY.
23. regular time-series plotting through exported `stats::ts.plot()`, including equal-frequency
    union, gap-aware line/point geometry, bounded `gpars`, package expression labels, and the same
    Worker graphics journal used by application R code.
24. lazy one-way `base::pipe()` connections over an explicit `createR({ systemCommand })` policy,
    reusable by unchanged package line/raw/source/table/serialization reads and exact buffered text
    writes without granting an ambient browser shell.
25. read-only `base::unz()` connections for exact stored or DEFLATE members in immutable package
    resources or session-owned ZIP files, reusable by the existing line/raw/source/table/
    serialization stack without extracting paths or granting host-filesystem access.
26. persistent `base::sink()` output diversions, split tees, message routing, and `sink.number()`
    inspection over the same bounded session files/connections. The unchanged package fixture and
    default Worker package both write and read a sink target without JavaScript shims.
27. usage-ranked `base::write()` over those same bounded files/connections. The unchanged fixture
    writes sass's measured `$color: "red";` source line, reads it back, exports the helper, and runs
    through the default Worker without a package-specific JavaScript implementation.
28. usage-ranked `utils::available.packages()` over an application-approved repository index. The
    unchanged fixture derives a source `contrib` URL, reads package names and versions from the GNU
    R-shaped matrix, and runs through inline and Worker APIs without a JavaScript package shim or
    ambient network authority.
29. usage-ranked `base::socketConnection()` over an explicit `createR({ socket })` duplex lifecycle
    adapter. Unchanged package code can open, write, read, query completeness, change timeouts, and
    close ordinary socket connections in inline or Worker sessions; endpoint policy and the actual
    transport stay outside the package, and omission of the adapter fails closed.
30. usage-ranked `base::file.copy()` over the owned virtual filesystem. Unchanged package code can
    stage immutable text or binary resources into a writable tempfile, copy several files into an
    existing directory, and recursively reproduce session trees without a JavaScript package shim or
    host-filesystem access.
31. usage-ranked `base::find.package()` over the owned package-library registry. Unchanged package
    code can resolve its installed root, enumerate bundled `DESCRIPTION`, `NAMESPACE`, R source,
    data, documentation, and resources, and respect explicit library selection without scanning a
    host R installation. The same helper executes inline and in the default Worker Playground.
32. usage-ranked `base::l10n_info()` as a GNU R-shaped browser encoding-capability report. Unchanged
    package code can select its UTF-8 path with `l10n_info()[["UTF-8"]]` inline or in the default
    Worker without inspecting browser preferences, host locales, or Windows codepages.
33. usage-ranked `base::shQuote()` as a process-free string transformation. Unchanged package code
    can prepare Unix `sh`/`csh` or explicit Windows `cmd`/`cmd2` arguments, including custom
    `as.character` methods and missing values, inline or in the default Worker. This does not grant
    permission to execute the result.

Package source, metadata, resource counts, and encoded bytes are bounded before parsing. Package
evaluation then consumes the ordinary step, call-depth, allocation, and output budgets.

The current `example()` boundary is console-oriented. Prompting, exact GNU R source-reference/echo
formatting, RNG save-and-restore through `setRNG`, and abort recovery remain incomplete. An example
can still fail when its package code or the example itself reaches an unsupported R feature; that
failure is useful executable evidence for the next shared runtime gap.

The current vignette boundary discovers and describes documentation already present in `inst/doc`.
It does not run vignette builders, regenerate output, or implement installed lazy help databases.
`browseVignettes()` and its print method aggregate that same index into a self-contained HTML
catalog and request presentation through the existing inert browse event; the application still
decides whether and how to expose the snapshot and its embedded immutable resources.

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

The opt-in test `packages/package-tools/test/external-package.test.ts` evaluates twenty-four
unchanged public source packages from the repository resolver. It verifies the pinned source-archive
digest separately from each normalized NativR artifact digest. Twenty-three reach P4; BH reaches P3
because it declares no R functions to execute:

- [`pkgconfig 2.0.3`](https://cran.r-project.org/package=pkgconfig) reaches P5. It proves namespace
  exports, package resources, classed DESCRIPTION metadata with a virtual installation path, and an
  ordinary package-owned call through `get_config()`. Its exact four-topic installed help manifest
  contains no Examples sections, so the applicable-example set is auditable and empty rather than
  silently untested;
- [`generics 0.1.4`](https://cran.r-project.org/package=generics) reaches P5: package-owned S3
  dispatch targets application-defined methods, and all three applicable Rd topics execute unchanged
  through the generic example pipeline;
- [`withr 3.0.3`](https://cran.r-project.org/package=withr) reaches P5 through every applicable Rd
  topic. Its unchanged `defer` example completes through closure-headed `as.call()`,
  target-environment `do.call(on.exit, ...)`, function-scoped `local()`, `sys.calls()`/
  `sys.frames()`, reachability-based `reg.finalizer()`, and reverse-order cleanup. The generic
  example runner also completes `with_par` and `with_tempfile` through provenance-audited,
  browser-owned `datasets::mtcars` and `datasets::iris` resources. `with_rng_version` executes its
  R-before-1.7 Marsaglia-Multicarry/Rounding sampling paths. Historical Buggy Kinderman-Ramage
  normal draws are also available generically with fixed-seed differential evidence, although that
  example does not exercise them. DBI-backed and native makevars topics are recorded as inapplicable
  to the present pure-R/browser tier rather than counted as passes. Its retained P6 manifest
  contains the unchanged top-level `testthat.R` driver; executable preflight freezes `testthat` as
  the first P6 dependency blocker. Current testthat declares
  [`NeedsCompilation: yes`](https://cran.r-project.org/web/packages/testthat/index.html), so that
  dependency belongs to the later native-package ABI phase rather than a withr-specific shim;
- [`R6 2.6.1`](https://cran.r-project.org/package=R6) proves that a real installed package takes
  precedence over a non-core compatibility shim, that namespace-qualified S3 registration loads, and
  that unchanged package code can construct a generator, instantiate a reference object, invoke
  public/private-state methods, mutate reference state, expose an active read/write field, preserve
  shared nested references through a shallow clone, and recursively copy a nested R6 object through
  a deep clone. The same unchanged source constructs a three-level `Person`/`Employee`/`Manager`
  hierarchy, invokes recursive `super$initialize()`/`super$greet()` paths, and observes inherited
  fields, methods, and class membership. It reaches P5 by executing both official `R6Class` Rd
  example blocks through generic `utils::example()`, including the GNU R-observed returned
  visibility record and eight stdout events;
- [`viridisLite 0.4.3`](https://cran.r-project.org/package=viridisLite), package rank 30 in the
  committed usage snapshot, proves dependency-free unchanged source loading plus package-owned
  256-anchor CIE Lab spline interpolation. `viridis()`, `magma()`, and an alpha/range/reverse call
  return the GNU R-observed colors through generic `colorRamp`, matrix arithmetic, and `rgb`. Its
  installed example manifest is executed without source rewriting and records the missing external
  `ggplot2` package as the deterministic first P5 blocker, so viridisLite remains P4;
- [`RColorBrewer 1.1-3`](https://cran.r-project.org/package=RColorBrewer), package rank 35 with
  1,410,661 downloads in the committed snapshot, reaches P5 by executing its installed
  `RColorBrewer` Rd topic unchanged. It proves package-top-level data-frame construction with
  explicit row names, exported 35-row palette metadata, Set1 and Blues palettes, the minimum-size
  warning, partial/no plot frames through `plot.default(bty=)`, and GNU R named-color spacing
  through generic data-frame, graphics, color, subsetting, `switch`, recursion, warning, and `rgb`
  semantics.
- [`labeling 0.4.3`](https://cran.r-project.org/package=labeling), package rank 37 with 1,376,303
  downloads in the committed snapshot, reaches P5 with all nine exported labeling algorithms and the
  deeper `extended.figures(2)` path executing unchanged. The figures path exercises shared `pmax`,
  histogram, `barplot(xaxt=)`, complete `par()` inventory/restoration, read-only graphical parameter
  warnings, and browser axis handling under an explicit 128 MB bounded output budget.
- [`assertthat 0.2.1`](https://cran.r-project.org/package=assertthat) reaches P5 through the
  standard `tools` namespace dependency and all 11 frozen installed Rd example topics. The unchanged
  examples exercise primitive reflection, explicit-definition call matching, partial `all.equal()`
  controls, class-preserving condition errors, and browser-owned file access without an assertthat
  adapter;
- [`crayon 1.5.3`](https://cran.r-project.org/package=crayon) reaches P5 after reading its standard
  `tools/ansi-palettes.txt` build resource through the generic hidden source-evaluation context and
  executing all 19 frozen installed Rd topics unchanged. The proof covers ANSI-aware alignment,
  length, splitting, substring, style composition/removal/query, hyperlinks, color-count discovery,
  and callable-style attributes through reusable Base R semantics, without a package adapter.
- [`praise 1.0.0`](https://cran.r-project.org/package=praise) reaches P5 through generic PCRE
  capture metadata, unchanged template replacement, and its sole frozen installed Rd example topic;
- [`prettyunits 1.2.0`](https://cran.r-project.org/package=prettyunits) reaches P5: all eight frozen
  installed Rd topics execute unchanged after reusable `units`/`units<-` difftime rescaling,
  primitive `is.infinite()`, and browser-owned `formatC()` semantics close the observed blockers.
  Bounded bzip2 data normalization remains part of its generic package artifact path;
- [`evaluate 1.0.5`](https://cran.r-project.org/package=evaluate) reaches P5: all six frozen
  installed Rd topics execute unchanged through reusable condition/restart, interrupt, hook,
  source-reference, expression/data-frame, sequence, and recorded-plot semantics. Its admitted
  system-version example uses the generic explicit `systemCommand` host adapter; the default runtime
  still launches no process;
- [`numDeriv 2016.8-1.1`](https://cran.r-project.org/package=numDeriv) reaches P6. Its public
  gradient/Jacobian calls, all four packaged Rd example topics, and all seven top-level package test
  scripts execute unchanged. The P6 path uses generic retained test resources and an explicit finite
  high-compute budget for the package's 100-dimensional Hessian and 1000-dimensional gradient cases;
  it adds no numDeriv-specific runtime branch.
- [`abind 1.4-8`](https://cran.r-project.org/package=abind) reaches P6. All five Rd topics and all
  five top-level package test scripts execute unchanged through the generic example/test pipeline.
  The proof uses explicit finite limits for the package's 3,628,800-element array test and adds no
  abind-specific runtime branch;
- [`rprojroot 2.1.1`](https://cran.r-project.org/package=rprojroot) reaches P5 through public S3
  criterion construction/composition, browser-owned project-root/file discovery, and every runnable
  block across its exact five-topic installed Rd manifest;
- [`rstudioapi 0.19.0`](https://cran.r-project.org/package=rstudioapi) reaches P5 by executing every
  runnable block across its exact 29-topic installed Rd manifest under the deterministic
  outside-RStudio host contract. This grants no browser IDE authority;
- [`inline 0.3.21`](https://cran.r-project.org/package=inline) reaches P4 through its public plugin
  registry. Its C/C++ compilation entry points remain outside the browser-native ABI and are not
  counted as executable compatibility.
- [`rematch 2.0.0`](https://cran.r-project.org/package=rematch) reaches P5 through public scalar and
  vector match/extract calls, named capture columns, no-match shapes, factor input, and its sole
  frozen installed Rd example topic;
- [`whisker 0.4.1`](https://cran.r-project.org/package=whisker) reaches P5 through public template
  rendering over scalars, sections, inverted sections, escaped/unescaped values, and triple braces;
  all four frozen installed Rd topics execute unchanged through the generic example runner;
- [`zeallot 0.2.0`](https://cran.r-project.org/package=zeallot) reaches P5 through nested,
  collected, skipped, defaulted, named, rightward, data-frame, and custom-S3 destructuring
  assignment; all three frozen installed Rd topics execute unchanged;
- [`ini 0.3.1`](https://cran.r-project.org/package=ini) reaches P5 through browser-owned INI
  parsing, exact section/key/value shapes, serialization, invisible return, read-back, and both
  frozen installed Rd topics.
- [`cpp11 0.5.5`](https://cran.r-project.org/package=cpp11), package rank 13, reaches P4 through
  unchanged namespace loading and `cpp_vendor()` copying all 24 immutable header resources into the
  browser-owned filesystem. Its unchanged `cpp_vendor` Rd topic also executes through the generic
  example pipeline. The `cpp_register` topic now crosses generic browser-owned `read.dcf()` parsing
  before freezing its first P5 blocker as the missing `brio`, `cli`, `decor`, `desc`, `glue`,
  `tibble`, and `vctrs` dependency closure; `cpp_source` similarly requires `brio`, `callr`, `cli`,
  `decor`, `desc`, and `glue`. cpp11 therefore remains P4. Its eventual C++ compilation/evaluation
  path still awaits the reusable native Wasm ABI.
- [`otel 0.2.0`](https://cran.r-project.org/package=otel), package rank 29, reaches P5: all 45
  frozen installed Rd topics execute unchanged through the generic example pipeline. The proof
  covers its default no-op tracing, metrics, logging, span-context, HTTP-context, attribute, and
  constant APIs after reusable `is.finite()`, `sys.nframe()`, `topenv()`, and `.GlobalEnv` closure.
  No network exporter or host telemetry capability is granted.
- [`BH 1.90.0-1`](https://cran.r-project.org/package=BH), package rank 50, reaches P3 through
  unchanged namespace loading, attachment, zero exports, and exact discovery of 12,554 Boost header
  resources totaling 128,040,580 bytes. P4 is not applicable because BH exposes no R functions;
  downstream C++ compilation remains outside this evidence.

Package tests are opt-in build inputs. `packPackage(root, { includeTests: true })` retains bounded
`tests/**` bytes under the reserved `.nativr/tests/` resource root and emits
`.nativr/tests-v1.json`, listing top-level `.R` scripts and any adjacent `.Rout.save` reference. The
default remains `false`, so normal browser artifacts do not silently acquire development tests.
Retained scripts are inert until an evidence runner explicitly sources them through the ordinary
parser, normalized AST, evaluator, and virtual package filesystem. This is the reusable P6 seam; it
does not claim a complete `R CMD check` harness or automatic `.Rout.save` comparison.

Withr's opt-in artifact now retains its sole top-level `testthat.R` driver and records the changed
normalized-artifact digest separately from the unchanged CRAN source digest. Sourcing the driver
fails deterministically at the missing `testthat` package. Because current testthat requires native
compilation and a broad dependency closure, withr remains P5 until the reusable native-package ABI
can admit that dependency; no local substitute or package-specific test rewrite is counted as P6.

No package source is checked into this repository. Together these tests exercise repository
installation, runtime package files, namespace loading, qualified S3 registration, metaprogramming,
dynamic caller frames, closure-formal replacement, environment/closure attributes, environment and
binding locks, function-backed active bindings, internal subset primitives, and reusable
state-management behavior. The clone paths additionally exercise generic `mget()`, first-class `[[`,
`mapply()`/`Map()` naming, environment copying, active bindings, and recursive package-owned method
invocation. The inheritance path additionally exercises GNU R-compatible `NULL` extraction and
replacement promotion used by package-owned super environments; there is no R6 adapter or
package-source rewrite. Finalization, arbitrary/multiple inheritance breadth, portable-locking
variants, and complete R6 remain outside the evidence.

The viridisLite, RColorBrewer, labeling, and crayon paths contain no palette table or package source
copied into NativR. Their sources are downloaded only by the opt-in test, digest-pinned, installed
through the public package pipeline, and discarded with the test process. The browser bundle
contains only reusable color interpolation, frame, warning, and arithmetic semantics.

The machine-readable [package corpus](../compatibility/package-corpus.json) is authoritative for
development/regression/holdout membership, source and artifact digests, completed tier, and first
blocker. BH was the final candidate whose complete runtime closure was already available in the
committed top-100 download snapshot and now reaches P3 regression, so the holdout partition is
temporarily empty. That candidate's source release had no non-core runtime dependency and declared
no native compilation. These proofs must not be summarized as a single unqualified “supported
packages” count.

The fourth source-blind rotation used only release metadata, public documentation, public API calls,
and GNU R as a black-box oracle before the packages were executed. The reusable runtime work adds
specific and `Ops`-group S3 dispatch for syntax and first-class operators, incremental S3 method
registration while a namespace is initialized, numbered ellipsis identifiers, missing-endpoint
`seq()`, `sign()`, `dimnames<-`, `methods::Quote`, trailing `as.data.frame()` controls, and
list/data-frame `is.na()` shapes. A later package-depth increment closes the observed generic
language-object and matrix/data-frame coercion gaps and advances abind to P6; the original P4
rotation remains the source-blind admission boundary.

The abind P6 runner executes each retained test script as a sequence of top-level expressions so an
intentional error can invoke the script's configured `options(error=)` handler and allow later
assertions to continue, matching ordinary R test-script control flow. This is generic test-runner
behavior, not output-file equivalence: `.Rout.save` references are retained when present but are not
yet compared automatically, and the runner is not a complete `R CMD check` implementation.

The fifth source-blind rotation likewise used release metadata, public documentation, public API
calls, and black-box GNU R observations before execution. It adds generic `exportMethods()`
namespace metadata, correct `utils` ownership for `head()`/`tail()`, and behavioral
`utils::globalVariables()` state. Unchanged rstudioapi and inline now install, load, attach, and run
their declared representative public calls. The result is P4 evidence only: RStudio host APIs and
inline's native compiler/dynamic-library paths remain explicit platform and future Wasm-ABI gaps.

The sixth source-blind rotation adds no package adapter. Generic runtime work covers
stored-dimension `NROW()`/`NCOL()` without class dispatch, `rownames<-`/`colnames<-`, base logical
constants, GNU R-observed regex identity escapes and lazy-overlap behavior, R replacement
backreferences, capture-free `strsplit()`, three-phase apply-family matching, factor-label
equality/membership, and atomic `[<-` promotion for list right-hand sides. Unchanged rematch and
whisker install, load, attach, and execute their declared public surfaces at P4. Full POSIX/PCRE
equivalence, every exported function, P5-P7, and arbitrary package compatibility remain unclaimed.

The seventh source-blind rotation likewise adds no package adapter. Generic semantics now preserve
runtime constants embedded by `call()`, `as.call()`, `substitute()`, and `bquote()`; evaluate
constructed assignment calls; resolve `parent.frame()` relative to the promise's evaluation origin;
coerce language/list/pairlist/expression values through `as.character()`; and provide bounded
`startsWith()`, `endsWith()`, `regexec()`, and language equality. Unchanged zeallot and ini reach
P4, but this does not claim every export path, complete regex equivalence, P5-P7, or arbitrary
packages.

The profile-0.305 depth audit executes the complete runnable installed-example manifests for
rprojroot, rstudioapi, rematch, whisker, zeallot, and ini and advances all six to P5. Two previously
missing example inputs, `InsectSprays` and `faithful`, are admitted as provenance-audited static
`datasets` resources and load through the same package-independent data path as `iris` and `mtcars`.
The audit adds no package-specific runtime branch, RStudio host authority, or rewritten package
source.

The eighth source-blind rotation evaluates cpp11 and otel only after public manuals, formals,
representative black-box GNU R results, and source digests were frozen. Generic work separates
executable R-source budgets from bounded immutable resources and adds list-aware `sprintf("%s")`,
`strrep()`, `length<-`, `anyNA()`, and `make.unique()`. Both unchanged packages reach P4. cpp11's
native compiler path, real telemetry exporters, every export, P5-P7, and arbitrary-package
compatibility remain unclaimed.

## Profile 0.342 unchanged timeDate P7 evidence

The unchanged `timeDate 4052.112` artifact now reaches P7 after reusable POSIXlt observation
extraction and C-locale month parsing close the final two ordered example blockers. The generic
runner passes installed DESCRIPTION identity, namespace load, attachment, export documentation, all
68 installed help topics, every runnable block across the 66 example-bearing topics, and the
retained `doRUnit.R` test; vignettes are explicitly not applicable. Independent scenarios cover
calendar construction, S4 sampling/range, alignment, a 2,923-day sequence, and both 86-window period
paths. No production code recognizes the package name or version.

This single P7 package is not evidence for arbitrary pure-R packages. The next corpus action is a
fresh metadata-first, source-blind holdout rotation using the pinned candidate policy; native/Wasm
package work remains downstream of broader semantic and package-system closure.

The ninth source-blind rotation evaluates BH only after official metadata and GNU R black-box
resource counts and sizes were frozen. Generic work raises bounded defaults to 16,384 package files
and 192 MiB, makes tar admission failures reject promptly, validates resources before Worker
transfer and in the runtime host, and computes standard `exportPattern()` exports after local
namespace bindings load. Unchanged BH reaches P3 with exact header-resource parity. Its lack of R
functions makes P4 inapplicable; no downstream Boost C++ package execution is claimed.

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

The deeper withr traversal closes closure-headed `as.call()`, target-environment
`do.call(on.exit, ...)`, function-scoped `local()` cleanup, `sys.calls()`/`sys.frames()`,
reachability-based environment finalizers, circular graphics-device selection, base timezone-cache
restoration, browser-local message-domain state, POSIXct formatting, NULL-aware `mapply`, and list
path coercion for `unlink`. Finalizers execute in reverse registration order after an environment
becomes unreachable; `onexit = TRUE` registrations also run during asynchronous runtime reset or
dispose. Provenance-audited core resources let unchanged `with_par` and `with_tempfile` use ordinary
`datasets::mtcars` and `datasets::iris` bindings. Versioned Marsaglia-Multicarry/Rounding sampling
then closes `with_rng_version`, so withr reaches P5 without a package-specific shim or no-op claim.
Historical Buggy Kinderman-Ramage normal draws now reproduce the pre-1.7 stream across every
published algorithm region. Corrected Kinderman-Ramage is separately selectable with fixed-seed and
near-zero-correction evidence; other alternative normal engines remain explicit boundaries.

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

Rank-357 `base::system2()` makes the portable variant reusable by unchanged source-only package
code. Instead of translating a package helper, NativR sends the approved host policy separate
executable, command-element, argument, environment, stdin/stdout/stderr, input, wait/signal, and
timeout fields through the same inline/Worker bridge. Captured output, exit status, warnings,
visibility, missing values, redirection intent, and GNU R-shaped formals are handled in the shared R
runtime. The embedding application still decides whether any executable, environment entry, or path
is allowed; the browser runtime neither owns a shell nor inherits a host process environment.

Rank-313 `base::pipe()` exposes the same opt-in command policy through R's ordinary connection
protocol. A source-only package can keep `readLines(pipe(command))`, `source(pipe(command))`, or a
text write pipe in its R code; NativR routes only an allow-listed, copied request through inline or
Worker execution and reuses the shared line/raw/table/serialization consumers. This avoids a
package-specific TypeScript rewrite for the measured jsonlite call and future packages using the
same shape. It does not make arbitrary commands, duplex streams, native tools, or shell behavior
available: each embedding application must admit exact commands, and omitted policies fail closed.

Rank-314 `base::unz()` supplies a package-independent archive-resource seam. Unchanged source-only
packages can keep calls such as `readLines(unz(system.file(...), "member.txt"))`; NativR resolves
one exact member, checks its bounds and CRC, and feeds copied bytes into the ordinary connection
consumers. This is also reusable after `download.file()` writes a ZIP to the session tree. It is not
runtime `install.packages()`: dependency resolution and source-package admission remain the
deterministic build-time installer's responsibility.

Rank-324 `utils::object.size()` supplies package code with a reusable object-footprint estimate
instead of a package-specific memory helper. The three measured `data.table`/`bit64` calls can keep
their ordinary R syntax and receive the same class, byte unit, common 64-bit vector/list/attribute
layout, and display methods as the GNU R 4.6 black-box cases. The estimate is deterministic across
inline and Worker sessions and does not expose JavaScript heap internals. Native allocations,
external pointers, package C/C++ objects, and platform-specific headers remain separate package
compatibility gates.

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

Rank-343 `graphics::barplot()` demonstrates the intended package-amplification path directly. A
source-only package can import the S3 generic, define its own `barplot.<class>` method when needed,
or pass an ordinary numeric vector/matrix into the shared default without translating that package's
R source to TypeScript. The checked-in fixture exports `package_bars()` unchanged, while zoo-style
class methods can prepare a matrix and delegate to `barplot.default`. This avoids rewriting each
pure-R package, but it does not bypass dependencies: the package still loads only when all language,
namespace, data, and runtime calls it actually executes are supported and its dependency closure is
license-admissible and free of native-code requirements.

Rank-344 `grDevices::devAskNewPage()` removes RColorBrewer's repeated pagination shim without a
package rewrite. A source-only namespace can import the function and execute its ordinary
`devAskNewPage(ask = TRUE)` calls; state belongs to the current graphics device and the next browser
page uses the already explicit `createR({ readline })` bridge. In a non-interactive embedding or on
PNG/PDF file devices, plotting continues without a prompt, matching the relevant GNU R branch. This
reuses package code but does not make interactive menus, native window devices, or arbitrary UI
toolkits available.

Rank-345 `base::getLoadedDLLs()` supports a common optional-native-backend probe without pretending
that compiled code is present. A source-only package can run
`vapply(getLoadedDLLs(), "[[", character(1), "path")` unchanged; today it receives `character(0)`
and can choose its ordinary R fallback. This reduces package-specific ports where a fallback already
exists. It does not make a package with `NeedsCompilation: yes` installable, nor does it turn parser
Wasm or JavaScript bundles into R DLLs. Those packages need a future explicit, typed, browser-safe
Wasm/native registration and foreign-call ABI.

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

Rank-365 `utils::browseVignettes()` composes that viewer seam with the package-independent vignette
index. An unchanged package can request its installed guide catalog, and the default Worker returns
one bounded HTML snapshot with rendered-output, source, and R-code links. No package adapter,
runtime fetch, host library scan, or desktop process is introduced.

Rank-366 `grDevices::dev.control()` removes knitr's measured display-list switch through the same
generic namespace path. The checked-in source-only fixture imports and calls it unchanged. Inhibit
mode clears only replay recording while Canvas/PDF/PNG output continues; enable mode starts a fresh
bounded recording that ordinary `recordPlot()` and `replayPlot()` consume. No knitr-specific code,
device adapter, or Worker protocol message is involved.

Rank-368 `utils::getFromNamespace()` removes the private-implementation lookup seam measured in all
37 backports examples. The loader resolves a character package name or actual namespace environment,
loads admitted bundles on demand, and returns only an exact namespace-owned binding: imports and
Base parents are deliberately not searched. The checked-in source-only fixture imports the ordinary
utility and invokes its own unexported `hidden_helper` without source translation. This is reusable
namespace infrastructure for any admitted package, not a backports rewrite or proof that backports'
remaining runtime dependencies are complete. Namespace mutation, installed lazy-load databases, and
the wider namespace-management API remain explicit gates.

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
- `system()`, `system2()`, and `pipe()` expose only an explicit embedding-host request/response
  contract. The browser runtime has no default shell, command search path, inherited environment, or
  executable filesystem. A host adapter can support selected package features, but it does not make
  a package containing native code a pure-R package. Pipe execution is currently one-shot and
  one-way rather than interactive or duplex.
- `configure*` and `cleanup*` are not executed. `configure*` remains a packaging error because the
  installed artifact may depend on generated output. `cleanup*` alone is a warning: the immutable
  browser artifact contains no host build byproducts, and the hook itself is not packaged.
- The current NAMESPACE parser supports `export`, `exportPattern`, `exportMethods`, `exportClasses`,
  `import`, `importFrom`, and `S3method`, while package code can call `registerS3method()` once its
  generic is available. Exported S4 classes use their ordinary `.__C__<Class>` namespace metadata
  bindings. Delayed registration against an unloaded suggested package, `importClassesFrom`,
  `importMethodsFrom`, conditional declarations, and other directives remain blockers. This is not
  complete S4 package support.
- `file()` connections currently cover bounded text/binary-mode handles over immutable package files
  and same-session browser-memory paths, including implicit open/close, explicit `open()`/`close()`,
  `isOpen()`, `flush()`, bounded `seek()`, and `summary()`. `gzcon()` adds gzip wrapping for those
  owned connections without granting transport or filesystem authority. Explicit URL and one-way
  command adapters compose the same registry; sockets, host paths, duplex/interactive pipes, typed
  binary writes containing NUL, seek/pushback within compressed streams, separate read/write seek
  positions, and the broader file API remain separate work.
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
- `file.copy()` supports xfun's measured resource-staging pattern: package R code can copy exact
  immutable bundle bytes to a tempfile and then use ordinary readers or cleanup functions. It also
  supports vector targets, overwrite control, recursive session directories and dotfiles, bounded
  Worker execution, and logical per-path results. It cannot write package/runtime roots, discover
  host files, reproduce host permissions, or follow links.
- `find.package()` supports xfun's measured package-root lookup and the common pure-R package
  self-discovery pattern. Default attached-package order, vectorization, missing-package
  warning/error/quiet behavior, explicit library selection, immutable virtual roots, directory
  enumeration, unchanged fixture code, and Worker execution have evidence. It does not discover host
  libraries, install packages, or make native-code packages portable.
- `l10n_info()` supports xfun's measured UTF-8 branch with the portable GNU R list fields and the
  non-Windows `codeset` suffix. Direct, namespace, unchanged fixture, Worker, formals, visibility,
  attribute, and platform-invariant evidence is executable. It does not provide arbitrary locale
  installation, LC_CTYPE mutation, native codecs, or compiled package portability.
- `shQuote()` supports xfun's measured shell-argument preparation without translating xfun. Its
  ordinary closure formals, partial mode selection, four documented quoting modes, coercion/S3
  behavior, attributes, missing values, unchanged fixture function, and Worker Playground path have
  executable evidence. It only returns text; package process execution still requires the explicit
  default-deny host command adapter.
- `system2()` supports xfun's measured portable command path through that adapter. It preserves
  argument and environment vectors plus stream redirection intent as structured data, forces waiting
  when output is captured, returns GNU R-shaped output/status/visibility, and runs from an unchanged
  source-only package namespace in both runtime modes. It does not discover executables, grant
  ambient process authority, implement host file paths, or make native-code packages pure R.
- `utils::aspell()` supports knitr's measured custom-filter shape without translating package
  source. Package filter closures receive their virtual file name and encoding normally; filtered
  lines cross an explicitly admitted Ispell-compatible `systemCommand` policy and return a standard
  classed result. Applications must provide the checker/dictionary implementation. Built-in document
  filters and R-level serialized dictionaries are not yet admitted.
- `graphics::abline()` supports knitr's measured reference-line call without translating package
  source. Source-only packages can import it normally, pass fitted model objects through their own
  `coef.*` methods, and draw coefficient, horizontal, and vertical lines through the same default
  Worker/Canvas journal. The current claim is limited to linear plot windows; logarithmic transforms
  and expanded clipping remain explicit capability boundaries.
- `stats::ts.plot()` supports magrittr's measured exposition-pipe example without translating
  magrittr or the calling package. Numeric vectors and regular vector/matrix series align on a
  shared bounded time grid, missing union cells split paths, and styles/annotations traverse the
  normal Worker/Canvas graphics path. Irregular index packages and multi-panel `plot.ts` still need
  their broader shared runtime foundations before they can be claimed.
- `graphics::title()` covers the seven measured Shiny/bit64 calls and is imported by the executable
  source-only fixture through ordinary NAMESPACE metadata. Package functions can add styled plot
  titles without source translation; their events cross the same Worker/Canvas and file-device paths
  as direct calls. Plotmath glyph layout and the unimplemented remainder of base graphics are still
  capability-manifest boundaries.
- Package `data/*.R` scripts execute through the same parser and normalized AST as package source;
  `.csv`, `.tab`, and `.txt` datasets, including their `.gz` source-package forms, load into owned
  data frames through bounded browser-native decompression. Gzip-wrapped `.R` and XDR v2/v3
  `.rda`/`.RData` resources use the same generic loader, and `R/sysdata.rda` enters the namespace
  before source evaluation. The Node package tool normalizes bounded bzip2 and xz wrappers before
  browser admission; zstd and direct runtime compressed wrappers remain unsupported. Serialized
  closures/language objects, data aliases, installed-package `.rdx`/`.rdb` lazy-load databases, and
  archive basenames that differ from their realized object remain explicit boundaries. For
  `LazyData: yes`, directly named data resources are exposed as memoized promises in a package-data
  environment rather than loaded eagerly. The core `datasets` package uses this same static-resource
  machinery for provenance-audited `iris`, `mtcars`, `InsectSprays`, and `faithful`; those bundled
  datasets are evidence for the generic loader, not a special package-execution path.
- Bytecode is not loaded. Original R source is parsed into the owned AST.
- Character encoding marks and exact bytes survive the owned vector and XDR paths. Browser-native
  text is deterministically UTF-8; general `iconv`, host locale encodings, malformed-byte display,
  and every encoding-sensitive string primitive remain separate compatibility work.
- The packager defaults to the deterministic `unix` source variant. Packages with platform-specific
  `R/` code can select `--source-platform windows`; the chosen variant is recorded in the artifact.
- `Suggests` is optional by default. Repeated `--suggest PACKAGE` options select only declared
  optional edges; `--include-suggests` requests the complete closure and cannot be combined with a
  selected list. Lock format v2 records the mode and sorted selection. Selected packages receive the
  same pure-R and browser-admission audit as required dependencies; an optional native package
  remains a deterministic incompatibility rather than being silently omitted. `Enhances` is not a
  required dependency edge.
- Third-party package code retains its own license and notices. It is an application asset, not
  copied into NativR's Apache-2.0 runtime.
- A package is compatible only at the tested package version and capability manifest; NativR does
  not infer compatibility from “NeedsCompilation: no” alone.

The clean-room boundary in [`clean-room.md`](clean-room.md) applies to runtime work. Public package
documentation and black-box results may define required behavior; GNU R, webR, or third-party
implementation source is never copied into the runtime.

## Profile 0.309 source-blind holdout rotation

`docopt 0.7.2` was admitted from CRAN metadata and a frozen source-archive digest before its package
source was inspected or executed. Its first runtime blocker was the general `methods::setRefClass()`
contract. After implementing that reusable object-system foundation and the subsequent shared
Base/regex blockers, the unchanged package installs, loads, attaches, parses its documented CLI
example with GNU R-matching output, and runs its installed Rd example without warnings. It therefore
moves to the regression partition at P5.

`getopt 1.21.1` replaces it as the untouched P0 holdout. Only CRAN `PACKAGES` metadata and the
SHA-256 of the uninspected source archive are admitted. Its source must not guide implementation
until the next scheduled holdout evaluation.

## Profile 0.310 source-blind holdout rotation

`getopt 1.21.1` was first installed and loaded from its frozen archive before package source
inspection. Its first observed runtime blocker was generic `match(..., nomatch = NA_integer_)`
coercion. Subsequent unchanged execution exposed shared `Negate()`, `storage.mode<-`, and
browser-command-argument contracts. After those reusable seams were implemented and evidenced, the
package installs, loads, attaches, produces GNU R-matching representative parse and usage results,
and runs all four applicable installed Rd examples without warnings. It moves to regression at P5;
no package-name branch or source rewrite was added.

`optparse 1.8.2` is the replacement untouched P0 holdout. Only official CRAN metadata and the
SHA-256 of its uninspected source archive are admitted. Its source has not been inspected or
executed and must not guide implementation before the next scheduled source-blind evaluation.

## Profile 0.311 source-blind holdout rotation

`optparse 1.8.2` was first passed to the standard repository installer before its package source was
inspected. Packaging stopped at the general `exportClasses()` NAMESPACE directive. After that first
blocker was frozen, unchanged package execution exposed reusable S4 class metadata export, slot
extraction/replacement, `setValidity()`/`validObject()`, package-local replacement-generic binding,
and `cat(fill=)` line-wrapping seams. With those shared contracts in place, the package installs,
loads, attaches, matches GNU R on representative flag, value, and positional-argument parsing, and
executes the exact four-topic applicable installed Rd example manifest. It advances to P5 without a
package-name branch or source rewrite. Its testthat-based package tests and complete S4 method-table
metadata remain deeper evidence gates.

`argparser 0.7.3` is the replacement untouched P0 holdout. The committed top-100 usage snapshot has
no remaining eligible standalone pure-R candidate, so this independently authored command-parser
package tests whether the newly expanded S4/package foundation generalizes. Only official CRAN
metadata and the SHA-256 of its uninspected source archive are admitted; its source has not been
inspected or executed.

## Profile 0.312 source-blind holdout rotation

`argparser 0.7.3` installs, loads, and attaches through the standard package path before package
source inspection, so its first packaging/namespace blocker is explicitly “none.” After that
checkpoint, a GNU R-matched public parser scenario first fails at generic `as.logical(list(...))`
coercion. Running the exact installed example manifest then exposes generic S4 `coerce` method
selection by source and requested target signatures. With those shared contracts implemented, the
unchanged package matches GNU R on positional, integer-option, and flag parsing and executes all
three applicable installed Rd example topics. It advances to regression at P5 with distinct frozen
source and normalized-artifact digests and without a package-name branch or source rewrite.

`iterators 1.0.14` is the replacement untouched P0 holdout. The existing top-100 snapshot has no
remaining eligible standalone pure-R candidate, so the same frozen window was used to compare an
explicit independent pure-R shortlist; cranlogs records 304,194 downloads for `iterators`. Official
CRAN metadata declares only R and core `utils` dependencies, no compilation, and an Apache-2.0
license. Only that metadata and the SHA-256 of the uninspected archive are admitted; its source has
not been listed, inspected, parsed, or executed.

## Profile 0.313 source-blind holdout rotation

`iterators 1.0.14` installs, loads, and attaches before package source inspection. Its first public
runtime blocker is generic namespace-local legacy S3 method discovery. The exact installed example
manifest then exposes an immutable browser-owned `R.home()/COPYING` resource and reusable
`levels()`/`nlevels()` semantics. With those shared contracts in place, the unchanged package
matches GNU R on named iteration, exhaustion, and chunking and executes all nine applicable Rd
example topics. It advances to regression at P5 with distinct frozen source and normalized-artifact
digests and without a package-name branch or source rewrite.

`foreach 1.5.2` is the replacement untouched P0 holdout. It is a source-only Apache-2.0 package
whose required closure imports `iterators`, core `utils`, and pure-R recommended package
`codetools 0.2-20`. Official metadata and the SHA-256 digests of both untouched archives are frozen;
neither source archive has been listed, inspected, parsed, or executed. This rotation deliberately
tests generic transitive dependency resolution rather than another standalone package.

## Profile 0.314 source-blind holdout rotation

The standard installer resolves the frozen `codetools 0.2-20`, `iterators 1.0.14`, and
`foreach 1.5.2` archives into a deterministic three-artifact lock before source inspection.
`foreach` first stops at the absent `compiler` namespace, then exercises generic language-call tags
and Base matrix multiplication. After those shared contracts are closed, the unchanged package
loads, attaches, matches GNU R on sequential and nested iteration, and executes all four applicable
installed examples at P5. No production branch recognizes `foreach`, `iterators`, or `codetools`.

`doParallel 1.0.17` is the replacement untouched P0 holdout. Official metadata declares a pure-R
source package depending on `foreach`, `iterators`, core `parallel`, and `utils`, with optional
`compiler` enhancement. Its official archive SHA-256 is frozen before source inspection. This next
rotation tests whether the same generic closure extends from sequential iteration to a
browser-admissible parallel backend contract.

## Profile 0.315 source-blind holdout rotation

Before source inspection, `doParallel 1.0.17` stops because the repository resolver attempts to
download core package `parallel`. Generic provided-package classification unblocks packaging; the
runtime then exposes and fixes the independent `Depends`-attachment contract. The package loads and
attaches with `parallel`, `iterators`, and `foreach` in GNU R-shaped search order. Its multicore
path uses the documented one-lane `mclapply` profile, while its explicit PSOCK example uses the same
bounded interpreter through a sequential cluster adapter. The unchanged package reaches P5 without a
package-name branch.

`pbapply 1.7-4` is the replacement untouched P0 holdout. It records 121,725 downloads in the frozen
comparison window and imports only browser core `parallel`; official metadata and the archive digest
are frozen before source inspection. It independently tests the new parallel contract through an
apply/progress package rather than another foreach backend.

## Profile 0.316 platform declarations and pbapply

The packager now resolves safe platform-only NAMESPACE `if` blocks at artifact construction time.
The grammar admits boolean combinations of the selected `R_OSTYPE` and `.Platform$OS.type` values,
rejects host-capability probes, and emits a deterministic directive-only namespace for the chosen
source platform.

Unchanged `pbapply 1.7-4` installs, loads, attaches, and completes representative sequential,
simplified, and browser PSOCK paths. Its P4 artifact hash is
`15c708ebeee0c0d54a3e0fd079cf169791d098a2d6cbe3f396c331d1f6e22d64`. P5 remains blocked on generic
`lm` call-formula reflection. `globals 0.19.1` replaces it as the untouched P0 holdout.

## Profile 0.317 globals dependency closure

The source-blind resolver freezes `codetools 0.2-20` followed by `globals 0.19.1`; the globals
artifact hash is `fd281f7d9069246d6e28b4bf2802e37edf28f4912a56ce2724753a278ebaa9db`. After generic
Base reflection and data-frame-cell fixes, the unchanged package installs, loads, attaches,
completes representative lookup and DFS analysis, and runs the `globalsByName` installed example.
The `findGlobals` example remains the P5 blocker at list-valued subscript normalization in
conservative codetools traversal.

Dependency-free pure-R `listenv 1.0.0` is the replacement untouched holdout. Its official source
digest is `b12c71b839638b324857e134e31e7de4fc7595e00af5e7c634a78374bd1cd2aa`; no source file has
been inspected or executed.

## Profile 0.318 listenv source-blind rotation

The source-blind checkpoint froze `listenv 1.0.0` artifact
`c1fe6955b53f403f3cac497bd60b271bbe4033576a634ad23ef95115d01b7601` after installation, namespace
loading, and attachment succeeded. Its public ordered-environment example then recorded
classed-environment primitive S3 dispatch as the first blocker before source inspection. Generic
extraction, replacement, shape, message-formatting, and membership fixes now carry the unchanged
package through the representative path and all three installed Rd example topics at P5.

`R.methodsS3 1.8.2` is the replacement untouched holdout. Its dependency-free pure-R metadata,
193,518 downloads in the frozen 2026-06-30 through 2026-07-29 window, and source digest
`822d5e61dad4c91e8883be2b38d7b89f87492046d0fe345704eb5d2658927c2e` were frozen without opening or
executing its source archive.

## Profile 0.319 R.methodsS3 source-blind rotation

Before evaluating `R.methodsS3 1.8.2`, the official `R.oo 1.27.1` archive was frozen unopened at
SHA-256 `5faf599cc1f027d8b80e1270aa6a43e29dccd6fee8287953f13e7ab3d94270f5`. Official metadata marks
it pure R with no compilation, and cranlogs records 183,372 downloads in the frozen 2026-06-30
through 2026-07-29 window.

The `R.methodsS3` source-blind checkpoint recorded evaluated artifact
`79b2dbec6e65cfe58fede0368b4f6560c1d62b6b9a20b275bb829ab3e73edc03` and the first namespace-load
blocker, imported `utils::getAnywhere`, before source inspection. Generic namespace, replacement,
substitution, stack-reflection, startup-condition, S3-registry, and Utils lookup fixes now carry the
unchanged package through installation, loading, attachment, representative generic construction,
and all three installed examples at P5. `R.oo 1.27.1` remains the sole untouched holdout.

## Profile 0.320 R.oo source-blind rotation

The frozen `R.oo 1.27.1` archive records source SHA-256
`5faf599cc1f027d8b80e1270aa6a43e29dccd6fee8287953f13e7ab3d94270f5` and evaluated artifact SHA-256
`cf79fcaeae429eda84ee84d71529f575041b2659b0b2ab70398b48c9934af8d5`. Its first source-blind blocker
was safe interpretation of conditional NAMESPACE directives. General namespace, S3, caller-frame,
NULL coercion, person metadata, string, attribute, delayed-binding, and serialization work now
carries the unchanged dependency closure through all 90 installed example topics at P5.

The cache example alone opts into a finite 100,000,000-step test budget for its documented
multi-million-element vectors; production and named profile defaults are unchanged. `R.utils 2.13.0`
remains frozen and uninspected in the holdout partition. Passing R.oo does not establish arbitrary
pure-R package support, and the next iteration must record R.utils' first blocker before source
inspection.

## Profile 0.321 R.utils source-blind rotation

The frozen `R.utils 2.13.0` archive records source SHA-256
`ab2043c34e129928ff85a037ce7a3f7791f245f49a55ee9a95bd7df0813bcf25` and evaluated artifact SHA-256
`878133418745fae5ac635d90863def62277a6cbf2987581b8efc1f769ff2dbd7`. Its first source-blind namespace
blocker was imported `graphics::mtext`. Subsequent unchanged examples exposed reusable parser
escapes, connection and binary I/O, environment/search-path, graphics layout, source reference,
condition/time-limit, digest, and dimension-name semantics. No production branch checks the R.utils
package name.

The package installs, loads, attaches, executes representative GString paths, and completes the
frozen installed-example topic set at P5. Browser-inapplicable examples remain evidence rather than
silent skips: `systemR` must fail at the host-process capability boundary, and the documented
`touchFile` example must fail where its optional native `digest` dependency is absent. An
independent unchanged `touchFile` path verifies timestamp mutation and MD5-stable contents.
Untouched pure-R `here 1.0.2` is the next source-blind holdout; passing R.utils still does not
establish arbitrary pure-R package compatibility.

## Profile 0.322 here source-blind rotation

The previously frozen `here 1.0.2` source SHA-256 is
`71980aa294314d6e032e680dfd2a59f792cab6f8d414cce03f2e823819190c3d`; the evaluated artifact SHA-256
is `7d3262b5b1d1547c73c5f22ab0b79282bb81142ab2ee6c4d84c891255a9f361b`. The current generic packager
emits its `rprojroot 2.1.1` dependency as artifact
`6912fcb92677a3393af6484a98ed1acb8c9de4b2b0f9243d8aa869d1df131d0d`, including retained NEWS
resources.

Unchanged installation, namespace loading, attachment, `here()`, and every runnable block across the
exact `dr_here`, `here`, and `i_am` example topics pass without a new semantic fix or package-name
branch. This zero-blocker holdout is evidence that existing primitives generalize; it is not proof
of arbitrary package support.

`R.matlab 3.7.0` is the replacement untouched P0 holdout. Official metadata marks it as
`NeedsCompilation: no` and gives a required closure of core `methods`/`utils` plus the already-P5
pure-R `R.methodsS3`, `R.oo`, and `R.utils` packages; `Matrix` and `SparseM` are only suggested. The
frozen 2026-06-30 through 2026-07-29 usage window records 8,450 downloads. Its unopened 109,258-byte
archive has source SHA-256 `d713522268a1206555610938350137ea022e07e27fa9cdd73c02fae8d1a43dda`; no
source file has been listed, extracted, parsed, or executed. `R.cache` was not admitted because its
mandatory native `digest` dependency would test the later native-package phase rather than this
pure-R closure.

## Profile 0.323 R.matlab source-blind rotation

The frozen `R.matlab 3.7.0` source SHA-256 is
`d713522268a1206555610938350137ea022e07e27fa9cdd73c02fae8d1a43dda`; the deterministic artifact
SHA-256 is `523e1ab1d7a43fafdf4a4779e7562d105e24bf06cc876247a38007c963377dff`. The first
source-blind failure was `NRPKG1002` on auxiliary Java source. Because CRAN metadata declares no
compilation and the Java tree is an external-server asset, the generic packager now preserves JVM
sources/archives only as inert immutable resources. NativR still provides no JVM compilation or
execution.

Unchanged package execution then exposed imported-binding re-exports, exports created during
`.onLoad`, `R.Version()` shape, and `str` S3 dispatch. These reusable fixes carry the package
through installation, namespace loading, attachment, a MAT v5 scalar/vector/matrix round trip, and
the exact `Matlab`, `readMat`, `setFunction.Matlab`, and `writeMat` installed-example topics. No
package-name branch was added. The package is P5 for the frozen digests only; external MATLAB
connectivity, JVM behavior, arbitrary pure-R package support, and native-package compatibility
remain unclaimed.

Dependency-free `combinat 0.0-8` is the replacement P0 holdout. The shared comparison window records
35,946 downloads, versus 9,926 for the considered `matrixcalc` alternative. Official metadata says
`NeedsCompilation: no`; the unopened 9,197-byte source archive has SHA-256
`1513cf6b6ed74865bfdd9f8ca58feae12b62f38965d1a32c6130bef810ca30c1`. `R.rsp` and `R.devices` were
rejected because their mandatory closures enter native `digest` and `base64enc`. No combinat archive
member has been listed, extracted, parsed, or executed.

## Profile 0.324 combinat source-blind rotation

The unchanged frozen source and generated artifact SHA-256
`5d9c23c0589105289ae4e8b374e11e3873ba7f12475bbbfada6db7cb05406a97` now have P5 evidence.
Source-blind execution exposed, in order, generic Base gaps in `lgamma()`, `tabulate()`, Rd
percent-comment parsing, and `gamma()`. Fixes were made in shared Base and package-tool layers only.
Install, namespace load, attach, and the exact six applicable installed topics (`combn`, `dmnom`,
`nsimplex`, `permn`, `rmultinomial`, and `xsimplex`) pass unchanged. This is evidence for that
pinned release, not a claim of arbitrary pure-R package compatibility.

Dependency-free `matrixcalc 1.0-6` is the replacement P0 holdout. Official metadata declares
`NeedsCompilation: no`, GPL >= 2, Published 2022-09-14, and only an R version dependency. Its
unopened 30,540-byte source archive has SHA-256
`0bc7d2f11f62d8b1969474defe27c924a243ccba0c856d585f317f6caa07f326`; no archive member has been
listed, extracted, parsed, or executed.

The completed source-blind `xtable 1.8-8` rotation reaches P5 for artifact SHA-256
`bd7c22a70c628bd2a3655583b983884e962c4deebc4858db892361ed537e806b`. Reusable sequential blockers
closed through `toLatex`, `anova`/`pchisq`, provenance-audited datasets, `zapsmall`,
matrix/data-frame and gzip package-data behavior, LM/AOV and recursive `Error()`-stratum summaries,
`summary.lm`, gaussian/binomial/Poisson IRLS GLM summaries and ANOVA, `prcomp` summaries, data-frame
row binding, matrix extent handling, `ftable` formatting, and missing positional argument matching.
Installation, namespace load, attachment, and every runnable block in the exact eight-topic
installed Rd manifest pass unchanged. No xtable-specific runtime branch or rewritten package source
was added; P6/P7, arbitrary pure-R packages, and broader unexercised model/table behavior remain
open.

## Profile 0.325 matrixcalc source-blind rotation

The scheduled unchanged source now has artifact SHA-256
`d64cb82cebe99ded95ffe6c849ec665fc77a3f0438f76400872b56c050a3011e` and P5 evidence. The first
failure was its POSIX `exportPattern("^[[:alpha:]]+")`; later unchanged examples exposed generic
matrix-vector promotion, triangle masks, Kronecker products, coordinate matrices, choose/lchoose,
determinant/solve, QR, and SVD gaps. Shared fixes carry installation, loading, attachment, and all
60 exact installed topics. No production code recognizes the package identity.

This proves only the pinned matrixcalc release and exercised paths. Arbitrary pure-R packages,
custom Kronecker callbacks, complex/full LAPACK linear algebra, serialized foreign QR internals, and
P6/P7 remain unclaimed.

`Formula 1.2-6` is the replacement untouched P0 holdout. The shared comparison window records
331,936 downloads. Higher-usage pure-R `clipr` was rejected because its declared purpose requires a
host clipboard; `parallelly` was rejected because official metadata declares native compilation.
Formula is `NeedsCompilation: no` and depends only on R and core `stats`. Its unopened 47,339-byte
source archive has SHA-256 `7e611ac371c045e100a6205d92fe5104001942673798f970290fea12e33bfd37`; no
member has been listed, extracted, parsed, or executed.

## Profile 0.326 Formula source-blind rotation

After the P0 freeze, unchanged `Formula 1.2-6` installs, loads, attaches, reports version 1.2.6, and
executes both exact installed Rd topics. The deterministic artifact SHA-256 is
`c2c65ec4d007ebd4c304e43a0e2c402ca047e0ae38d8667bbf79aaa918007b0b`. The first namespace blocker and
every later example blocker selected reusable formula, S3, apply-family, terms, model-frame,
model-matrix, response, dot-expansion, and offset semantics; production contains no package-name
branch. Formula is therefore regression P5, not evidence that all pure-R packages work. P6 package
tests/check scenarios, P7 independent scenarios, the next untouched holdout, and arbitrary package
closure remain open.

## Profile 0.327 DBI generic-package depth

After its metadata-only freeze, unchanged `DBI 1.3.0` installs, loads, attaches, executes the frozen
representative ANSI/Id/SQL calls, and runs every applicable block across its exact 58-topic
installed Rd manifest. The artifact SHA-256 is
`d55fa587203e850bd7a7403a96aaa559bf9686c060816290904d1f4d7b9b6997`. Source-blind blockers selected
shared methods, S3, S4, Date, legacy class, namespace export, and row-name semantics; no package
name selects runtime behavior. DBI therefore moves to regression P5. Optional concrete DBMS
packages, database connectivity, its package-test/check tiers, arbitrary packages, and the next
independent holdout remain open rather than inferred from the interface package.

## Profile 0.330 xtable source-blind rotation

After its independent metadata-only freeze, unchanged `xtable 1.8-8` installs, loads, attaches, and
runs every applicable block across its exact eight-topic installed Rd manifest. The generated
artifact SHA-256 is `bd7c22a70c628bd2a3655583b983884e962c4deebc4858db892361ed537e806b`. Its
source-blind failures selected shared dataset, data-frame, model, GLM, PCA, table-formatting, and
argument-matching semantics; no package name selects runtime behavior. xtable therefore moves to
regression P5. This evidence covers only the pinned release and exercised graphs: P6 package tests,
P7 package-check/independent scenarios, arbitrary pure-R packages, complete Base R, and native-code
packages remain open.

## Profile 0.331 globals source-blind closure

The frozen `globals 0.19.1` artifact is
`ddf3aae1439cb48c614a7769eb83bd44fe1d189e3297010cd0ed15def9fbfb87`; its unchanged dependency is
`codetools 0.2-20`. The original installed-example failure was not a valid list-subscript extension:
it exposed incorrect core namespace ownership and then top-level substitution and primitive S3
continuation gaps. Generic namespace environments, `.BaseNamespaceEnv`, omitted-global
`substitute()`, first-class language primitives, and `NextMethod()` fallback now carry the unchanged
closure through installation, namespace load, attachment, representative analysis, and every
runnable block in both installed help topics.

`globals` is regression P5 with no first blocker and no package-identity production branch. This is
evidence for the pinned release, not P6 package tests, P7 package-check/independent scenarios,
arbitrary pure-R package compatibility, or complete codetools language analysis.

## Profile 0.332 pbapply source-blind closure

The frozen unchanged `pbapply 1.7-4` source SHA-256 is
`6a5c7110a6bf13735374d3b2e75b32ec0e0f0276ad95e928d2c802b53ff1302d`; its deterministic installed
artifact SHA-256 remains `811dd8f01c8ea4177caf5624c116d64e3427cee70522e4162463713e025605f3`. The
original source-blind failure was conditional NAMESPACE selection. A reusable sequence of platform
selection, browser progress and single-lane parallel adapters, call/formula reflection,
apply/numeric behavior, replacement state, table/array normalization, data-frame summaries, and
audited core datasets now carries the package through installation, loading, attachment,
representative calls, and every runnable block in all four installed help topics.

`pbapply` is regression P5 with no current first blocker and no production package-identity branch.
This is not P6 package-test evidence, P7 package-check/independent evidence, or a claim that an
arbitrary pure-R package is already compatible.

## Generic browser-admissible P7 package checks

`@nativr/package-tools` now derives a deterministic check plan from any packaged artifact and runs
each applicable item in an isolated reset session. The reusable surface includes installed metadata
identity, namespace load, attachment, export-to-help coverage, help lookup, unchanged examples,
retained tests, normalized saved-output comparison, and installed/prebuilt vignette discovery.
Missing infrastructure, warnings, runtime errors, and output differences remain explicit results
with an ordered first blocker.

This runner advances unchanged `numDeriv 2016.8-1.1` from P6 to P7: four help/example topics and
seven retained tests pass, with no saved outputs or source-only vignette build applicable. The same
runner advances unchanged `abind 1.4-8` to P7 after all five help/example topics, five retained
tests, and every normalized `.Rout.save` comparison pass. Neither path contains a package-name
branch. These two pinned results validate the generic mechanism but do not establish arbitrary
pure-R package compatibility.

## Next metadata-frozen holdout

`selectr 0.6-0` is frozen as an unevaluated P0 holdout before source inspection. Official metadata
declares `NeedsCompilation: no`, no OS restriction, and only R plus already-passing `R6` in its
mandatory dependency closure; XML, xml2, and testthat are Suggests. The fixed usage window records
368,242 downloads. Higher-count `clipr` and `remotes` are excluded because their declared purposes
require host clipboard or remote repository/process capabilities, respectively. The official
85,422-byte archive is pinned by SHA-256
`b877dfd9cc8b7d9afda1be9e45dfafc942e14b4279a430e5f8f75325c05eddd9` without listing or extraction.
The corpus now has 45 releases: 41 passing, three blocked, and one deliberately unevaluated; no
claim is made for selectr until the source-blind runner records evidence.

## Profile 0.334 selectr source-blind closure

The unchanged release installs with its already-passing R6 dependency, loads and attaches, covers
all exported documentation, and runs both installed example topics after a reusable Base regex fix.
`regexec()` optional captures now preserve GNU R's `0/0` unmatched location and `regmatches()`
extracts the retained empty string. The package-check runner treats only a missing-package warning
for an artifact-declared `Suggests` edge as a guarded optional probe, so the XML/xml2 demo can
return early while every unrelated warning remains actionable.

The artifact SHA-256 is `d286a0114315235128d81f91428b9799237ec56376a71e2895c709b8215a37f6`. Selectr
is regression P5, not P7: retained `test-all.R` requires unavailable suggested package `testthat`,
recorded as the first P6 blocker. The 45-release corpus has 41 passing and four blocked entries; 41
reach P5, two reach P6, and two reach P7.

The replacement P0 holdout is unchanged `timeDate 4052.112`, frozen before source inspection from
official metadata and the fixed usage window at 321,191 downloads. It has no native or OS
restriction and only core mandatory dependencies; RUnit is Suggests only. Its unopened 367,313-byte
archive has SHA-256 `7f5b8e294f9fdf977cb721e711a6fcd664e379ee1b0ddb4c733374940e0e4646`. The corpus
now has 46 releases: 41 passing, four blocked, and one deliberately unevaluated.

## Profile 0.335 timeDate source-blind P4 closure

The unchanged `timeDate 4052.112` archive now installs, loads its namespace, attaches, executes a
declared `timeCalendar()`/`as.character()`/`finCenter()` representative path, and completes its
retained `doRUnit.R` script. The source SHA-256 remains
`7f5b8e294f9fdf977cb721e711a6fcd664e379ee1b0ddb4c733374940e0e4646`; the generic packager emits
artifact SHA-256 `ab56e656c0e8ac9908812460b975548e4f073355ee1936ae83867305283f843b`.

Reusable runtime work closed `axis.POSIXct`, XDR `S4SXP`, `.POSIXct`, `setReplaceMethod`, inherited
`setGeneric()` defaults, `callGeneric`, `getDataPart`, `pretty`, `julian`, `months`, `quarters`, and
`weekdays`. Production code contains no `timeDate` identity branch. The package is regression P4,
not P5 or P6: complete installed examples still expose broader S4/operator/date-time gaps, and the
ordered package-check blocker is reconciliation of `exportClasses`/`exportMethods` aliases with Rd
aliases. A passing retained test is evidence, but cannot skip the tier ladder.

## Profile 0.336 S4 documentation and example progression

The package-check planner now treats standard S4 class and method Rd aliases as documentation for
their namespace-visible exports while continuing to reject genuinely undocumented ordinary exports.
The unchanged `timeDate 4052.112` artifact therefore clears metadata, namespace, attachment, all
installed help checks, export documentation, and the ordered example topics through `c`, `diff`, and
`difftimeDate`. Reusable S4 operator/subset dispatch plus generic coercion, sorting, and
differencing produced that progression without a package identity branch.

The first remaining installed-example blocker is Base R `round.POSIXt`. The package stays at P4:
passing earlier examples and the retained test does not establish complete P5 examples or P6 tests.

## Profile 0.337 reusable POSIX and S4 package seams

The unchanged `timeDate 4052.112` artifact now crosses the former `round`, `start`, and
`summary-methods` blockers. The reusable changes are UTC/GMT POSIX rounding/truncation, generic
`round`/`range` forwarding, S4 identity preservation through internal subset consumers, and
constructor completion from class prototypes. Regression probes retain a sampled S4 `timeDate`
object and verify that `range(timeCalendar())` contains all three declared slots.

The package remains P4 because `example:align` is now the first failed installed example, reporting
an unused-argument mismatch. No package-specific production branch was added, and neither P5 nor
arbitrary pure-R package compatibility is claimed.

## Profile 0.338 unchanged-package argument and date progression

The unchanged `timeDate 4052.112` artifact now completes its former `align`, `isBizday`, and `nDay`
example topics. Independent regression probes verify two-week alignment, weekday/weekend daily
alignment, and all twelve monthly calendar results against GNU R. The implementation changes are
generic: S3/S4 forwarding, partial matching, promise missingness, POSIXlt parsing and replacement,
method dispatch for missingness/deduplication, and `julian.POSIXt`. No production path recognizes
the package name or version.

The artifact remains P4. Its first ordered package-check failure is `example:periods`, which exposes
a reusable `seq` direction/step boundary. Passing earlier topics and the retained test still does
not establish complete P5 examples, arbitrary pure-R package reuse, or P6/P7 compatibility.

## Profile 0.339 unchanged-package period progression

The unchanged `timeDate 4052.112` artifact now passes the former `example:periods` blocker after
generic length dispatch, POSIXlt component recycling, Base calendar-data, logical-missing POSIXlt,
and ellipsis-primitive work. Independent source-blind probes evaluate both `periods` and
`monthlyRolling` and obtain GNU R's 86 windows for each path. Production code contains no package
name or version branch.

The artifact remains P4 because its first remaining installed-example failure is now
`example:timeDate-class`, where generic array-margin splitting requires missing `base::asplit`. That
reusable array operation is the next pure-R package frontier; native-package ABI work remains
deferred behind semantic and package-system closure.

## Profile 0.340 unchanged-package example progression

The unchanged `timeDate 4052.112` artifact now passes the former `timeDate-class`, `plot-methods`,
and `holiday` topics after reusable `asplit`, empty-result `apply`, graphics S4 dispatch,
axis-style, `names`, and `all.names` work. The package source and production runtime contain no
timeDate-specific rewrite or identity branch.

The artifact remains P4 because its first installed-example failure is now `example:in_int`, where
the exercised `@` operation receives a non-S4 value. That object-system semantic is the next pure-R
frontier. Native/Wasm package ABI work remains downstream of generic pure-R closure.

## Profile 0.341 unchanged-package S4 and replacement progression

The unchanged `timeDate 4052.112` artifact now passes the former `in_int`, `names-methods`,
`blockStart`, and `is.na-methods` topics after reusable S4 initialization/next-method dispatch, S4
names replacement, primitive sequence controls, and Base missing-value replacement work. Production
code contains no timeDate name, version, or callable-specific branch.

The artifact remains P4. Its first installed-example failure is now `example:timeCeiling`, where the
exercised POSIXlt path reports `invalid POSIXlt value`. POSIXlt normalization/replacement is
therefore the next explicit package blocker; arbitrary packages, P5, P6, P7, and native/Wasm package
compatibility remain unclaimed.

## Profile 0.343 unchanged-package LazyData progression

The unchanged `carData 3.0-6` archive selected generic package-data infrastructure rather than a
package rewrite. The packager records `LazyData`, normalizes bounded xz resources, and emits the
same immutable browser artifact form used by other pure-R packages. The runtime creates separate
memoized data promises so namespace load and attachment do not realize all 64 data resources.

After transport accounting and dense factor-contrast closure, the package passes metadata,
namespace, attachment, all 64 installed help topics, all 18 example-bearing topics, and independent
GNU R-matched namespace/data probes. It reaches P7 with artifact SHA-256
`cb6e8d712d5031eb1c4e426911963d1ad7409eb702522d84422f3be512806d41`. Aliases, multi-object or
nonmatching archive names, installed `.rdx`/`.rdb`, and arbitrary pure-R packages remain open.

## Profile 0.344 unchanged-package language reconstruction progression

The metadata-frozen unchanged `rex 1.2.2` archive initially stopped in `character_class` because a
captured literal string in call-head position was reconstructed as a symbol. The generic language
model now preserves literal call CAR values across `[.call`, `as.list()`, and `as.call()`. The same
artifact installs, loads, attaches, covers all installed help, runs all five example topics, and
passes an independent GNU R-matched regex capture/data-frame scenario without recognizing the
package name or version.

Rex advances to regression P5 with deterministic artifact SHA-256
`191f79c1fb93b5381a466f8635c03d7ae750bacccbd42df03e22abc944bcce48`. Its retained `testthat.R` test
first stops because suggested package `testthat` is unavailable, and the two prebuilt vignette
topics are not resolved by the current vignette path. These are explicit P6/P7 boundaries; one
passing regex package does not establish arbitrary pure-R package compatibility.

## Profile 0.345 unchanged brew progression

The source-blind `brew 1.0-10` run required no new runtime behavior. Its unchanged source installs,
loads, attaches, documents every export, and executes both installed example topics using the
generic package artifact and check pipeline. An independent GNU R-matched scenario covers inline
text, value, code and comment delimiters plus the non-executing parser representation. No production
branch recognizes brew, its version, or its exports.

Brew advances to regression P5 with artifact SHA-256
`51479288695528a14536eee3b4b0c96751d92e8c3442402cc6c3c7bfa140fd4a`. Retained tests first require
unavailable suggested package `testthat`, so P6/P7 remain open. The replacement source-blind P0
holdout is `shape 1.4.6.1`, admitted only by metadata and unopened source digest; this preserves one
unevaluated holdout and makes no arbitrary-package claim.

## Profile 0.346 unchanged shape progression

The metadata-frozen `shape 1.4.6.1` source was opened only after its P0 record was frozen. Its first
failures selected reusable graphics-device, arrow, plot-window, polygon, and matrix-binding
semantics. Those generic closures carry the unchanged artifact through load, attachment, complete
export/help coverage, and representative execution across most example topics without any production
branch recognizing shape, its version, or its exports.

Shape advances to development P4 with artifact SHA-256
`ef839b8ffe4d57b24dba3f62bd10149c007f834fb8ffd8342869df37435a93b8`. Its first ordered P5 blocker is
`datasets::volcano`; clean-room policy requires a provenance-audited, independently redistributable
resource and forbids copying the GNU R dataset. `corrplot 0.95` becomes the new unopened P0 holdout.
Neither package establishes generic P5 or arbitrary-package compatibility.

## Profile 0.347 unchanged shape sorting and vignette progression

The unchanged shape code exposed a reusable Base seam in its color mapping path:
`sort(values[, 1], index.return = TRUE)$ix`. Implementing that public contract in `sort.default()`
clears `example:filledellipse` without a package-specific rewrite. Independently, the generic
package-check generator now uses the installed vignette index's canonical `File` field, so
`vignette:shape` also passes.

Shape remains development P4 with the same deterministic artifact because its ordered first P5
blocker is still the provenance-admissible `datasets::volcano` resource. `graphics::filled.contour`
is a later generic example gap, and `corrplot 0.95` remains the untouched P0 holdout. Passing these
additional checks does not establish arbitrary pure-R package compatibility.

## Profile 0.348 unchanged corrplot progression

The frozen `corrplot 0.95` source was opened only after its metadata-only P0 record existed. Its
first failure exposed exact-versus-partial argument matching when a short `col` argument followed an
exact `colbar`; the generic matcher now lets that name select another unmatched formal or fall into
dots. The next failure, `cor(mtcars)`, selected reusable numeric data-frame/matrix Pearson
covariance and correlation semantics.

The unchanged artifact installs, loads, attaches, exposes and documents its namespace, and passes
the complete `COL1`, `COL2`, and `colorlegend` example topics without a production branch
recognizing corrplot. It reaches development P4 with artifact SHA-256
`c24a371fb61302e64e399da83a6e229be0c44cb24a048347e5813fb5e30e16ab`. Its first ordered blocker is
`stats::hclust` in `example:corrMatOrder`; distance and dendrogram gaps may follow.

The replacement unopened holdout is `insight 1.5.2`, selected from the same fixed download window
after excluding host clipboard, installer, project-library, and credential-manager packages. This
rotation preserves source-blind evidence and does not imply arbitrary-package compatibility.

## Profile 0.349 unchanged corrplot clustering progression

The ordered corrplot blocker selected a coherent reusable chain rather than an isolated callable:
finite-matrix `dist`, square-matrix `as.dist`, eight `hclust` linkage methods, recursive
`as.dendrogram`, and `order.dendrogram`. Source-blind probes now run `corrMatOrder` for AOE, FPC,
default hierarchical clustering, and Ward D. The next execution failure exposed generic
`which(..., arr.ind = TRUE)` matrix coordinates, which are also implemented without package identity
branching and have exact recursive GNU R evidence.

The full `example:corrMatOrder` topic next stops when rendering calls missing `graphics::symbols`.
The artifact remains P4 because the complete example topic has not passed; its deterministic SHA-256
is unchanged. `insight 1.5.2` remains unopened at P0 until a scheduled corpus rotation. These
results strengthen reusable pure-R execution but do not establish arbitrary-package compatibility.

## Profile 0.350 unchanged corrplot rendering progression

The ordered blocker selected a reusable `graphics::symbols` subset. Circles, squares, and rectangles
with user-coordinate dimensions now use the existing browser polygon protocol; inch scaling and the
remaining symbol families fail explicitly. The same unchanged corrplot execution then exposed the
general Base requirement that `order(...)` accept several positional sort keys, which now has
recursive GNU R evidence.

The direct `corrplot(cor(mtcars))` path passes without package identity branching. The full
`example:corrMatOrder` topic next stops at missing `stats::cutree`, recorded as the new ordered
first blocker. The artifact remains P4 until the complete topic passes, and `insight 1.5.2` remains
unopened at P0. These results do not establish arbitrary-package compatibility.

## Profile 0.351 unchanged corrplot tree-cut progression

The ordered `stats::cutree` blocker selected reusable merge-tree semantics rather than a corrplot
helper. Scalar and vector count/height cuts now preserve labels and GNU-shaped membership matrices,
and exact recursive evidence covers a custom interleaved merge topology. The unchanged
`example:corrMatOrder` topic passes completely.

The next source-blind failure occurs in `example:corrRect`. NativR's leading symmetric eigenvectors
have valid values and eigenspaces but GNU-different signs, so corrplot's AOE order is cyclically
shifted and a later lower-triangle name pair is absent. This deterministic linear-algebra contract
is recorded as the first blocker. Corrplot remains P4; `insight 1.5.2` remains unopened at P0, and
arbitrary-package compatibility is not claimed.

## Profile 0.352 unchanged corrplot eigensolver progression

The package-selected eigenvector-orientation gap is closed by a reusable, package-neutral LAPACK
3.12.1 `DSYEVR` Wasm backend. Exact recursive evidence covers the signed mtcars FPC/AOE order, while
a broader matrix suite checks eigenvalues and eigenspaces without claiming universal sign identity.
The unchanged `example:corrRect` topic now passes. A following fractional `seq(..., length.out=)`
failure selected and received the general GNU ceiling rule.

The ordered failure has advanced within `example:corrplot` to generic `graphics::symbols` parameter
normalization (`invalid symbol parameter`). Corrplot stays P4 until that complete topic passes.
`insight 1.5.2` remains unopened at P0, the corpus partitions are unchanged, and arbitrary-package
compatibility is not claimed.

## Profile 0.353 unchanged corrplot example completion

General Pearson-test, data-frame bind/name-replacement, and graphics-control semantics carry every
installed corrplot example topic through the unchanged package pipeline. Corrplot therefore advances
to P5: examples pass, but its tests and package-check surface do not.

The ordered first blocker is now `test:testthat.R`, which cannot start because suggested dependency
`testthat` is unavailable. The next work must evaluate and support that dependency through the same
generic source-package and runtime contracts, or record its first reusable blocker; it must not skip
tests or add corrplot-specific behavior. `insight 1.5.2` remains the untouched P0 holdout, and
arbitrary-package compatibility is not claimed.

## Profile 0.354 unchanged insight example completion

The frozen, unchanged `insight 1.5.2` artifact now installs, loads, attaches, exposes its namespace,
and completes every applicable installed Rd example topic. Package-neutral changes cover model
introspection, reparsable deparse output, RNG state, quasi families, grouped binomial responses,
Base datasets, and data-frame binding. No insight source is translated, patched, or recognized by
production code, so the corpus tier advances from P3 to P5.

Its retained `test:testthat.R` driver is the new ordered first blocker because suggested dependency
`testthat` is not installed. P6/P7 remain unclaimed. `GPArotation 2026.8-1` remains unopened in the
holdout partition.

## Profile 0.355 GPArotation source-blind rotation

The frozen unchanged `GPArotation 2026.8-1` archive now installs, loads its namespace, attaches, and
discovers its documentation through the standard pipeline. Reusable `grid`, `uniroot`, `cov2cor`,
and `tcrossprod` semantics close its import surface without translating or patching package code.

The first installed topic, `example:CCAI`, intentionally runs multiple rotations with
`randomStarts = 100` and reaches the standard package-test cumulative allocation budget. A bounded
large-browser diagnostic progressed farther and then reached its step budget; the ledger therefore
records a resource blocker and P3, not example completion. Metadata-only `palmerpenguins 0.1.1`
replaces it as the unopened P0 holdout.

## Profile 0.356 unchanged GPArotation first example

The unchanged artifact now completes `example:CCAI` through generic `setNames`, `sweep`, `factanal`,
`loadings`, and callback-call support. This includes three 100-random-start rotation analyses plus
the factor-analysis-to-bifactor path, so GPArotation advances from P3 to P4 without translated
source, patched package code, or a production package-name check.

Its next ordered topic, `example:GPA`, runs through list-valued covariance input and package-owned
`cfQ` rotation but reaches the explicit 100,000,000-step evidence ceiling. Complete examples (P5),
dependency-complete tests, arbitrary pure-R package compatibility, and native-package compatibility
remain unclaimed. `palmerpenguins 0.1.1` remains unopened.

## Profile 0.357 unchanged GPArotation complete examples

The unchanged GPArotation artifact now completes every installed Rd example topic under explicit
finite evidence limits. The reusable closure spans numeric checkpoint batching, independent
cumulative allocation accounting, `layout`, `atan2`, expression-vector construction and axis labels,
legend line/adjustment controls, print dots, and lazy `update.default()` call rewriting. No package
source is translated or patched and production semantics do not inspect the package name.

GPArotation therefore advances from P4 to P5. Its first retained-test blocker is
`test:MASSoblimin.R` expression 5 because `datasets::ability.cov` is not yet visible on the default
search path. P6/P7, arbitrary pure-R package compatibility, and native-package compatibility remain
unclaimed.

## Profile 0.358 GPArotation retained-test advance

The ordinary browser-owned `datasets` resource path now supplies `ability.cov`, so unchanged
`GPArotation 2026.8-1` reaches expression 17 of retained `test:MASSoblimin.R`. Generic `factanal`
start, bounded optimization, varimax normalization, and loading-orientation work also remove the
large prior rotation delta. The remaining failure is the test's `1e-6` numeric comparison against
its reference loadings, which requires closer GNU L-BFGS-B convergence-path compatibility. The
package therefore remains P5; no package-specific runtime branch or rewritten test is accepted.

## Profile 0.359 GPArotation complete package-check evidence

The unchanged, digest-pinned `GPArotation 2026.8-1` artifact now passes deterministic installation,
namespace loading, attachment, all installed Rd example topics, every retained top-level test
expression, relative companion scripts, and all other applicable package-check steps. The reusable
closures are an exact typed L-BFGS-B 2.1 backend for `factanal`, generic `stats::varimax`,
GNU-shaped implicit `matrix()` dimensions, filled legend rendering, and a package-neutral test
runner that preserves session state while resetting budgets per expression and running from
`tests/`.

The corpus ledger therefore records P7 and `firstBlocker: null`. This is evidence for one pinned
artifact, not an allowlist: production code does not inspect GPArotation's identity, rewrite its
source, substitute expected values, or skip tests. Arbitrary pure-R packages, unavailable suggested
dependencies, other untested package contracts, and native code remain outside the claim.

## Profile 0.360 unchanged palmerpenguins package and data evidence

The scheduled, digest-pinned `palmerpenguins 0.1.1` archive passes the complete applicable generic
package-check plan unchanged. Because that plan can validate a data-only package without forcing
every lazy object, a separately authored scenario loads `penguins` and `penguins_raw` through the
ordinary package data path and checks their observable structure and representative contents against
black-box GNU R.

The first forced-data failure was generic: the discoverable partial `tibble` namespace made the
package select `tibble::as_tibble`, but did not export it. A reusable S3 `as_tibble` implementation
now handles data frames, lists, matrices and atomic vectors with row inference, recycling, row-name
and name-repair behavior. Generic `as.character.Date` supplies the raw dataset's civil-date text.
Neither implementation recognizes palmerpenguins or embeds its data.

The ledger moves the pinned artifact into development at P7 with no first blocker. A replacement
holdout has not yet been selected; source-blindness requires the next candidate's metadata and
source digest to be frozen before its source is opened or executed. This temporary empty holdout
does not relax the development/regression/holdout policy or expand the compatibility claim.

## Profile 0.361 unchanged polynom package evidence

The frozen `polynom 1.4-1` archive was inspected only after its P0 selection record existed. Its
unchanged sources now pass the full applicable generic package-check plan and produce deterministic
artifact SHA-256 `d9980d6e2aeabe3a8474a415b4bdb4a9fdc148baad0d3973bae8b4a31003c442`. An
independently authored scenario, separately observed under GNU R, covers polynomial arithmetic,
prediction, derivative/integral methods, Math and Summary groups, list distinctness and roots.

No loader or runtime branch recognizes the package. The source-blind blockers were closed through
generic runtime and Base/Stats surfaces: implicit group-generic namespace registration, dispatch
metadata, `NextMethod()` argument state, first-class operators, `sum`/`prod`, list
`unique`/`duplicated`, `stats::poly`, and general real `eigen()`. The P7 record applies only to the
pinned artifact and applicable checks. Symbolic `stats::deriv.default`, multivariate polynomial
bases, arbitrary pure-R packages, and native packages remain outside the claim.

## Profile 0.362 unchanged estimability package evidence

The metadata-frozen `estimability 2.0.0` archive and deterministic artifact SHA-256
`93c415103e22251e6a4db3b98df961202a692fe4d5ed1991479f6c4966a86dbc` pass the complete applicable
generic package-check plan unchanged. An independent black-box-matched scenario covers null-basis
construction, estimability decisions, NA-marked predictions, and model updates.

The reusable closure is in standard modeling semantics: lazy NA actions, visible QR reconstruction,
model terms/frames/matrices, rank-deficient prediction, stored-call formula updates, and factor
contrasts. P7 remains limited to this pinned artifact and exercised surface; it is not a declaration
that arbitrary pure-R packages now work.

## Profile 0.363 unchanged formatR package evidence

The metadata-frozen `formatR 1.14` source and deterministic artifact SHA-256
`f73828da43c168463c260077a6025a9c11051b7c4c1e6786b9c75f544fc00065` reach P5 unchanged with the
declared `testit` test dependency included. Every applicable Rd example passes. The retained test
suite still fails first in width-sensitive `args.newline` layout, so the package remains blocked at
P5 and is not evidence of arbitrary pure-R package compatibility.

## Profile 0.364 unchanged formatR package evidence

The pinned `formatR 1.14` artifact now reaches P7 unchanged. Its complete applicable generic
package-check plan passes with the declared `testit` dependency: installed metadata, namespace,
attachment, documentation, every applicable Rd example, retained tests, saved-output handling and
vignette classification. A separately authored GNU R-matched scenario covers conditional/function
formatting, formula/model calls and width-bounded `stats::lm` usage output.

The final blockers closed through reusable semantics rather than package identity: structural
width-sensitive `deparse()`, correct interleaving of dynamically nested calling and exiting
handlers, and visibility propagation through `suppressWarnings()`. No loader or runtime branch
recognizes formatR. P7 is evidence only for the pinned artifact and exercised surface.

## Post-0.364 metadata-frozen holdout rotation

`lambda.r 1.2.4` is frozen at P0 before archive listing, extraction, parsing, installation, or
execution. The fixed 2026-07-12 through 2026-08-10 cranlogs window records 112,995 downloads, and
official metadata declares a pure-R package importing only the now-P7 `formatR` package and
suggesting only the already-P7 `testit` package. The unopened 25,666-byte source archive and its
SHA-256 are pinned in the corpus.

This candidate deliberately probes package-on-package dependency closure and foundational language
semantics. Higher-count host-bound candidates require a clipboard, remote package management,
project-library management, or credential access; `SQUAREM` and `snow` remain admissible future
candidates. P0 records integrity and selection only. The next scheduled source-blind run must use
the generic package pipeline and record the first concrete reusable blocker before any compatibility
claim advances.

## Profile 0.365 lambda.r source-blind advance

The unchanged `lambda.r 1.2.4` dependency closure installs and packs deterministically, then reaches
P4 through the generic package-check pipeline. Its source-blind namespace blockers selected reusable
`parse()` option defaults, GNU-shaped nonterminal parse-data tokens, list input to `parse(text=)`,
and one-dimensional `apply()` behavior. Namespace load, attachment, documentation discovery, and the
preceding installed examples now pass without a package-identity branch.

The first remaining blocker is `example:UseFunction`: GNU R's R-level `eval`/`source`/`example` call
stack exposes the selected `eval` frame's `envir` binding through `sys.frames()` and `sys.frame()`,
while NativR's builtin-driven stack is currently shorter and lacks that reflected binding. This is
recorded as an environment/call-frame semantic gap, not patched around for `lambda.r`. P5-P7 and
arbitrary pure-R package support remain unclaimed.

## Profile 0.366 lambda.r P7 closure

The Profile 0.365 blocker is closed generically: `eval()` contributes an outer frame with forced
`expr`, `envir`, and `enclos` bindings and evaluates in an inner frame that is the selected target
environment. Together with reusable ellipsis parse-data, missing-name/`list2env()`, and `na.fail`
model-policy corrections, the unchanged package and its declared pure-R dependency closure pass
every applicable generic package-check step.

A separate scenario exercises `%as%`, `...`, guarded lambdas, and ordinary calls and matches GNU R.
The ledger therefore records the pinned `lambda.r 1.2.4` artifact at P7 with no current blocker.
This is artifact-scoped executable evidence, not a promise that arbitrary pure-R packages install or
run without further Base, language, namespace, package-system, or optional-dependency work.

## Post-0.366 metadata-frozen SQUAREM holdout

The reproducible official metadata filter retains 3,334 pure-R candidates outside the 58-package
corpus whose mandatory dependency closure is browser core or already passing. Ranking reuses the
fixed 2026-07-12 through 2026-08-10 cranlogs window. Higher-ranked `clipr`, `remotes`,
`BiocManager`, `renv`, and `gitcreds` remain excluded because their purposes require host clipboard,
remote package management, project-library/lockfile, or credential services.

`SQUAREM 2026.1` is the next purpose-admissible release at 116,855 downloads. Official metadata
declares `NeedsCompilation: no`, no mandatory package dependency beyond R >= 4.0, and only optional
`setRNG` and `interval`. Its purpose is numerical acceleration of smooth linearly convergent
schemes, including EM-like algorithms. The unopened 240,392-byte archive is pinned by SHA-256
`e9b32a384876b3a6646ea4262aedd738292220cd1852b2a289855606f56cfcad` and remains unlisted,
unextracted, unparsed, and unevaluated at P0 until the scheduled source-blind run.

## Profile 0.367 SQUAREM P7 closure

The scheduled unchanged run advances `SQUAREM 2026.1` to development P7 with deterministic artifact
SHA-256 `1f257cbdf4ac16d1dabfb9415e795819c5387819f413798a0a73c435c5d61b29`. The package and pure-R
`setRNG` example dependency pass metadata, namespace, attachment, documentation, every applicable
example, all retained tests, saved-output handling, and vignette classification. The optional
`interval` closure reaches native `survival` but is not required by those applicable checks.

Source-blind failures selected reusable `utils::modifyList`, Box-Muller paired normal generation,
generic `qr()` dots/default dispatch, and `solve.qr` S3 semantics. A separately authored affine
fixed-point scenario verifies convergence and evaluation counts. No package identity branch or
source rewrite was added; the result remains scoped to the pinned artifact and exercised surface.

## Post-0.367 metadata-frozen snow holdout

The next source-blind rotation freezes `snow 0.4-4` from official metadata and the fixed 2026-07-13
through 2026-08-11 usage window. It is the highest-ranked purpose-admissible candidate after
excluding packages whose primary contracts require host clipboard, remote package management,
project-library/lockfile, or credential services. Metadata declares a pure-R archive with only
`utils` mandatory and `rlecuyer` optional. The unopened 20,464-byte source is pinned by SHA-256
`84587f46f222a96f3e2fde10ad6ec6ddbd878f4e917cd926d632f61a87db13c9` and remains unlisted,
unextracted, unparsed, uninstalled, and unevaluated at P0 until its scheduled generic run.

## Profile 0.368 snow P7 closure

The scheduled source-blind run advances unchanged `snow 0.4-4` to development P7 with deterministic
artifact SHA-256 `560935e2d2c75f3374443e3ebea1b17f7de766778c4611c3f40db3fc47f2f22b`. Its complete
applicable generic plan passes metadata, namespace, attachment, documentation, and all runnable
examples; the archive has no retained top-level tests or vignettes.

The first failure selected shared Base empty/whitespace character coercion and character-`NaN`
integer warning semantics. A separately authored GNU-matched scenario supplies ordinary in-memory
`sendData`/`recvData` S3 methods and exercises cluster scheduling, splitting, and remote-error
aggregation without a package branch. Real SOCK/MPI processes, external network transports, and
optional `rlecuyer` remain outside this artifact-scoped browser-admissible claim.

## Post-0.368 metadata-frozen futile.options holdout

The next metadata-first rotation selects untouched `futile.options 1.0.1` from the fixed 2026-07-13
through 2026-08-11 usage window at 101,395 downloads. It is the highest-ranked purpose-admissible
candidate after the recorded host-service exclusions; repository and external-package-cache audits
confirm that it has not already been evaluated as a dependency. Official metadata declares a pure-R
archive with no mandatory or suggested package dependencies.

The unopened 3,919-byte archive is pinned by SHA-256
`7a9cc974e09598077b242a1069f7fbf4fa7f85ffe25067f6c4c32314ef532570` and remains unlisted,
unextracted, unparsed, uninstalled, and unevaluated at P0 until its scheduled generic run.

## Profile 0.369 futile.options P7 closure

The scheduled run opened the frozen archive only after the P0 record above. Unchanged
`futile.options 1.0.1` passes every applicable generic package-check step and produces deterministic
artifact SHA-256 `f6634f1724960119dd4f582dd0093e38bd7d4d38582f3cc3920843cc2d0c376a`.

The first independent source-blind scenario selected a package-neutral S3 visibility gap. The
runtime now propagates an invisible result through `UseMethod()` and `NextMethod()`, and the
separately authored OptionsManager scenario matches GNU R for retrieval, mutation, reset, missing
lookups, state, and visibility. No package identity branch or source rewrite was added. P7 remains
scoped to this pinned artifact; the holdout partition is empty pending another metadata-first
selection.

## Post-0.369 metadata-frozen futile.logger holdout

The fixed 2026-07-14 through 2026-08-12 metadata/cranlogs comparison selects untouched
`futile.logger 1.4.9` at 118,068 downloads after the recorded host-service exclusions. Repository
and external dependency-cache searches find no prior evaluation. Official metadata declares
`NeedsCompilation: no`, `utils` plus the already-P7 `lambda.r` and `futile.options` as mandatory
imports, optional suggested packages only, and LGPL-3 licensing.

The unopened 24,311-byte archive is pinned by SHA-256
`496bedbe2e52d06db22a4d659b8e7dd9ad0f1d1f95ead459ec02d05d0ac2b3d6`. It remains unlisted,
unextracted, unparsed, uninstalled, and unevaluated at P0 until its scheduled generic run. This
rotation specifically tests generic transitive reuse of two prior P7 packages.

## Profile 0.370 futile.logger P7 closure

The scheduled run opened the archive only after its metadata, usage window, byte size, and source
digest were frozen. Unchanged `futile.logger 1.4.9`, its mandatory `lambda.r` and `futile.options`
dependency closure, and the declared suggested `testit` dependency needed by the retained test
launcher pass every applicable generic package-check step. The installed artifact has deterministic
SHA-256 `d021ece3671228382bd30cb9cb08392c2ca08794aa9f3d5e8c817f128f724bbc`.

Ordered failures selected exact character condition coercion, numeric factor ordering and `NaN`
retention in `split()`, environment formatting, and eager `tryCatch()` handler-list behavior. Each
fix is package-neutral and independently covered. A separately authored logger scenario matches GNU
R for root and child thresholds, carp state, removal, and hierarchical fallback. The ledger moves
the artifact to development P7 with no first blocker. This remains pinned-artifact evidence, not an
arbitrary-package or comprehensive GNU R claim.

## Profile 0.374 pracma P7 closure

The scheduled source-blind run opened the frozen `pracma 2.4.6` archive only after selection,
archive size, and source digest were recorded at P0. The unchanged package passes every applicable
generic metadata, namespace, attachment, documentation, example, and retained-test check. Examples
requiring unavailable declared Suggests `NlcOptim` or `quadprog`, plus the absent vignette surface,
are not-applicable and are not counted as passed. Deterministic installed-artifact SHA-256 is
`f11a2d3b9f5ccb9dd0afa01fe183f12fa736f5b12b9fd818b20166486b1bef79`.

Ordered failures selected only reusable numerical, model, and Base-language semantics. Independent
`gmres`, `gammainc`, `histc`, and matrix-exponential calls match GNU R black-box results. Generic
unit, public API, flat, and recursive differential cases cover the fixes. The ledger moves the
artifact to development P7 with no first blocker. This remains pinned-artifact evidence, not an
arbitrary-package or comprehensive GNU R claim.

## Post-0.372 metadata-frozen bigD holdout

The fixed 2026-07-14 through 2026-08-12 metadata/cranlogs comparison selects untouched `bigD 0.3.1`
as the next highest-leverage executable pure-R candidate at 82,656 downloads after the recorded
host-service exclusions and deferral of static font-asset distributions. Official metadata declares
`NeedsCompilation: no`, no mandatory package imports, optional `testthat` and `vctrs` suggestions,
MIT licensing, and publication on 2025-04-03.

The unopened 1,310,144-byte archive is pinned by SHA-256
`86b1b0cf1849f6b1418c3178ab5d7b04682652375c6e90ebac636921de6088d1`. It remains unlisted,
unextracted, unparsed, uninstalled, and unevaluated at P0 until its scheduled generic run.

## Profile 0.373 bigD P7 closure

The scheduled source-blind run opened the frozen `bigD 0.3.1` archive only after selection, source
size, and source digest were recorded at P0. The unchanged package passes metadata, namespace,
attachment, documentation, and all four runnable Rd examples through the generic checker. Its
retained `testthat` launcher is not-applicable because that optional declared Suggests dependency is
unavailable, and it has no vignette manifest; neither is counted as passed. The deterministic
installed artifact SHA-256 is `e0d2dbed46a7a681989507648a07a1069951970c594a3bfdf4a95f7b42553cda`.

Ordered failures selected only reusable package-resource limits, serialization-input limits, and
null external-pointer value/serialization semantics. Package-independent unit, flat, and recursive
GNU R differential cases cover the fixes. A separately authored date/locale scenario matches GNU R
for UTC and localized formatting, regional first weekdays, locale tables, and external-pointer
shape. The ledger moves the artifact to development P7 with no first blocker. This remains
pinned-artifact evidence, not an arbitrary-package or comprehensive GNU R claim.

## Post-0.373 metadata-frozen pracma holdout

The fixed 2026-07-14 through 2026-08-12 metadata/cranlogs comparison selects untouched
`pracma 2.4.6` as the next highest-leverage executable pure-R candidate at 80,335 downloads after
the recorded host-service exclusions and deferral of static font-asset distributions. Official
metadata declares `NeedsCompilation: no`, only core graphics, grDevices, stats, and utils imports,
optional `NlcOptim` and `quadprog` suggestions, GPL-3-or-later licensing, and publication on
2025-10-22.

The unopened 398,691-byte archive is pinned by SHA-256
`1857b831ec7da6eb651574ccdb12e1baef4c7150cbdc6380cf9fd70e60ae4552`. It remains unlisted,
unextracted, unparsed, uninstalled, and unevaluated at P0 until its scheduled generic run.

## Post-0.371 metadata-frozen permute holdout

The fixed 2026-07-14 through 2026-08-12 metadata/cranlogs comparison selects untouched
`permute 0.9-10` as the next highest-leverage executable pure-R candidate at 82,685 downloads.
Higher-ranked host clipboard, remote package-management, project-library/lockfile, and credential
packages remain excluded. The two higher-ranked font packages remain deferred because this rotation
prioritizes reusable executable semantics over static-asset package-count growth.

Official metadata declares `NeedsCompilation: no`, core `stats` as the only mandatory import,
optional suggested packages only, and GPL-2 licensing. The unopened 120,438-byte archive is pinned
by SHA-256 `dc182b20d2f0dcafbe0384640b949b9d70faee4cbd20bf88ab55de811b105104`. It remains unlisted,
unextracted, unparsed, uninstalled, and unevaluated at P0 until its scheduled generic run.

## Post-0.370 metadata-frozen tinytest holdout

The fixed 2026-07-14 through 2026-08-12 metadata/cranlogs comparison selects untouched
`tinytest 1.4.3` as the next highest-leverage executable pure-R candidate at 85,045 downloads.
Higher-ranked host clipboard, remote package-management, project-library/lockfile, and credential
packages remain excluded. The two intervening font packages are static asset distributions and are
deferred because this rotation prioritizes reusable executable semantics over a package-count gain.

Repository and external cache audits find no prior tinytest evaluation. Official metadata declares
`NeedsCompilation: no`, `parallel` and `utils` as mandatory imports, no suggested packages, and
GPL-3 licensing. The unopened 595,901-byte archive is pinned by SHA-256
`ecc3a398690e72ca70127c1177e1f78b602dc5062f1597b897255bcc33c38375`. It remains unlisted,
unextracted, unparsed, uninstalled, and unevaluated at P0 until its scheduled generic run.

## Profile 0.371 tinytest P7 closure

The scheduled source-blind run opened the archive only after its metadata, usage window, byte size,
and source digest were frozen. Unchanged `tinytest 1.4.3` passes every applicable generic
package-check step, including documentation examples and the retained top-level 159-test self-test.
The installed artifact has deterministic SHA-256
`9ec3cb4437f8d96b05e8b69d092b20bbd23758ab653eaf99940387f09d43e0a2`.

Ordered failures selected reusable argument-matching, call-frame, virtual-file/connection, factor,
table, regex replacement, core-data, and condition-system semantics. Package-independent public API,
flat, and recursive GNU R differential cases cover the fixes. The ledger moves the artifact to
development P7 with no first blocker. This remains pinned-artifact evidence, not an
arbitrary-package or comprehensive GNU R claim.

## Profile 0.372 permute P7 closure

The scheduled source-blind run opened the frozen `permute 0.9-10` archive only after selection,
source size, and source digest were recorded at P0. The unchanged package passes metadata,
namespace, attachment, documentation, every runnable Rd example, and its vignette through the
generic checker. Its retained `testthat` launcher is not-applicable because that optional declared
Suggests dependency is unavailable; it is not counted as passed. The deterministic installed
artifact SHA-256 is `a24290e5e4172d2fb193a4fb41d6cfdd48a852823447bd0a52af0f752191191d`.

Ordered failures selected only reusable reflection, argument-frame, condition/restart, cumulative,
group-reconstruction, graphics-formula, and statistics-formula semantics. Package-independent public
API, flat, and recursive GNU R differential cases cover the fixes. The ledger moves the artifact to
development P7 with no first blocker. This remains pinned-artifact evidence, not an
arbitrary-package or comprehensive GNU R claim.

## Post-0.374 metadata-frozen boot holdout

The reproducible official metadata filter uses the fixed 2026-07-14 through 2026-08-12 cranlogs
window. After the established host-service exclusions, `fontLiberation` and `fontBitstreamVera`
remain deferred because they are static font-asset distributions without an executable R semantic
surface. Untouched `boot 1.3-32` is therefore the next highest-leverage executable pure-R candidate
at 79,749 downloads.

Official CRAN metadata records `Priority: recommended`, `NeedsCompilation: no`, the Unlimited
license, a 2025-08-27 date, and only core `graphics` and `stats` as mandatory package dependencies;
`MASS` and `survival` are optional suggestions. The unopened 238,282-byte source archive is pinned
by SHA-256 `3a05aced6fea42a5c310c5c6ab7a2019f69f757f5e77c4961183977747136c97`. It remains P0 and has
not been listed, extracted, parsed, installed, or executed. Its first scheduled generic failure must
select reusable semantics, package-system behavior, resource/data support, or test infrastructure
rather than a package identity branch.

## Profile 0.375 boot P4 source-blind evaluation

The scheduled run opened the frozen archive only after its P0 metadata, size, usage window, and
source digest were recorded. The unchanged package parses, installs, loads its namespace, attaches,
and passes the complete installed export-documentation manifest. Representative `boot` and `boot.ci`
examples execute, so the deterministic artifact with SHA-256
`8a5c4b9b152184ac07c786ab4292f991558d92415fabda8e07ed666daaee012f` reaches P4 regression.

Ordered failures selected reusable `graphics::identify`, standard R source-extension, one-argument
`seq`, `lm.influence`, data-frame expansion, `xor`, two-vector `var`, and `as.matrix.default`
attribute/dimname contracts. Fourteen applicable example topics now pass. The first remaining P5
blocker is `example:control`, which reaches the missing shared `stats::smooth.spline` contract.
Later example gaps do not replace that ordered blocker. No runtime branch recognizes boot and no
package source is patched; P5 and arbitrary-package compatibility remain unclaimed.

## Profile 0.376 boot reusable statistics advance

The reusable `stats::smooth.spline`, `predict.smooth.spline`, `stats::qqnorm`, `stats::qqplot`, and
`stats::glm.control` contracts advance the unchanged examples through the generic installed
artifact. Explicit missing-package behavior in `utils::data` also lets the generic checker classify
examples requiring unavailable declared Suggests packages without counting them as passing. Nineteen
applicable `boot` example topics now pass. Flat and recursive GNU R evidence cover every newly
claimed primitive.

The artifact remains P4. The next ordered P5 blocker is `example:saddle`, which reaches the missing
shared `stats::dnorm` primitive; `example:smooth.f` reaches the same gap. `MASS` and `survival`
Suggests paths are not applicable in this installed closure. No package, dependency, or dataset-name
branch is introduced, and later example failures do not replace the ordered blocker.

## Profile 0.377 boot normal-density advance

The reusable `stats::dnorm` contract allows the unchanged `saddle` and `smooth.f` examples to pass,
bringing the artifact to twenty-one passing applicable example topics. Package-independent
integration plus flat and recursive GNU R evidence cover density values, recycling, boundaries,
attributes, formals, and warning-call structure.

The artifact remains P4. The next ordered P5 blocker is `example:tsboot`, which requests the missing
core `datasets::lynx` object. Core data are admitted only with reviewed provenance and executable
shape/value evidence; neither `boot` nor the dataset identity may receive a production shortcut.

## Profile 0.378 boot lynx-data advance

The independently licensed `datasets::lynx` resource is admitted through the same declarative
resource, data-script, autoload, and namespace machinery used by browser core and installed pure-R
packages. Package-independent integration plus flat and recursive differential evidence cover its
complete values, `ts` shape, time coordinates, aggregates, attribute order, and identity.

The unchanged boot artifact remains P4 with twenty-one complete applicable example topics.
`example:tsboot` now passes the data lookup and reaches the missing shared `stats::ar` contract,
which becomes the ordered P5 blocker. No production branch recognizes boot or rewrites the example.

## Profile 0.379 boot autoregression and geometric-random advance

Reusable univariate Yule-Walker `stats::ar` and vectorized `stats::rgeom` contracts advance the
unchanged `tsboot` example through autoregressive order selection and geometric block-length
generation. Package-independent integration plus flat and recursive GNU R evidence cover the newly
claimed statistics surfaces; unsupported `ar` methods remain explicit rather than approximate.

The boot artifact remains P4 with twenty-one complete applicable example topics. The same example
now reaches missing shared `stats::arima.sim`, which becomes the ordered P5 blocker. No production
branch recognizes boot, its data, or its example source.

## Profile 0.380 boot stationary-ARMA advance

Reusable univariate stationary `stats::arima.sim` closes the final applicable `tsboot` example gap
through the ordinary stats registry. Package-independent integration plus flat and recursive
differential evidence cover explicit AR/MA innovations, burn-in, custom R generators, forwarded
arguments, output shape, and deterministic boundaries. No production path recognizes boot or
rewrites its source, examples, or model values.

The unchanged artifact now passes every applicable generic package-check step and advances to P5.
Its retained `parallel-censboot.R` test is guarded by the unavailable suggested `survival`
dependency. The script is correctly not applicable in the installed closure and therefore cannot
satisfy P6; that dependency closure is the next explicit blocker.

## Profile 0.381 DEoptimR source-blind rotation

After metadata, usage window, archive size, and SHA-256 were frozen without inspecting source,
unchanged `DEoptimR 1.2-0` first exposed missing shared `methods::formalArgs` at namespace load.
Closing that reusable reflection contract carried installation, loading, attachment, documentation,
and all three examples through the generic pipeline. Its retained tests then exposed vectorized
`stats::runif(min, max)` bounds; the package-neutral fix adds recycling, domain, warning, length,
and RNG-preservation behavior with integration plus flat/recursive differential evidence.

All three retained optimizer tests pass under an explicit finite 100,000,000-step evidence budget,
and a separately authored fixed-seed quadratic `JDEoptim` scenario matches GNU R black-box values
and structure. The unchanged artifact reaches P7. No package identity branch, source rewrite,
fixture substitution, or default-limit relaxation is present; the result remains scoped to the
pinned artifact and exercised browser-admissible surface.

## Post-0.381 metadata-frozen multcompView holdout

The reproducible official metadata filter uses the fixed 2026-07-17 through 2026-08-15 cranlogs
window and retains 3,360 current pure-R candidates whose mandatory dependencies are browser core or
already-passing corpus packages. The established host-service exclusions remove `clipr`, `remotes`,
`BiocManager`, `renv`, and `gitcreds`; `fontLiberation` and `fontBitstreamVera` remain deferred as
static font-resource distributions without an executable R semantic surface. Untouched
`multcompView 0.1-12` is therefore the highest-ranked purpose-admissible executable candidate at
76,025 downloads. Official metadata records `NeedsCompilation: no`, GPL-2, core `grid` as its only
mandatory import, and only optional suggested packages.

The 159,725-byte source archive is pinned by SHA-256
`444af930d0da731e9be1c191e8ca48acaafbe8a64ef82351f59f9c113c6065b0`; the deterministic installed
artifact is pinned separately as `d696e11461adc083c4ef9d4fe09a2d0702afe29900f5313fb7e0fb49bb69a3c7`.
The scheduled unchanged run exposed reusable gaps in missing dimname handling, `USJudgeRatings`,
`as.matrix.dist`, data-frame row names, `interaction()`, character-to-formula coercion, fitted-model
terms factors, and `plot.default(cex.axis=)`. Those gaps were closed in shared runtime, base, model,
dataset, and graphics layers with executable evidence; no package source was rewritten and no
production branch recognizes the package.

The unchanged artifact now passes the complete applicable generic package-check plan: metadata,
R-source parsing, namespace loading, attachment, export documentation, installed examples, and
retained tests. A separately authored three-level comparison also matches GNU R black-box
`multcompLetters` and `multcompTs` classes, labels, dimensions, names, and matrix values. It
therefore reaches P7 for this pinned artifact and exercised browser-admissible surface. This is not
a claim of arbitrary pure-R package or comprehensive GNU R compatibility.

## Post-multcompView metadata-frozen plotrix holdout

After the evaluated `multcompView` artifact moved to the regression partition, the same fixed
2026-07-17 through 2026-08-15 cranlogs window and current official metadata filter retained 3,359
outside-corpus candidates. The established host-service and static-resource exclusions still apply;
`RcppProgress` is additionally deferred because its useful surface is native-development headers,
which belongs to the later native-package phase. Untouched `plotrix 3.8-14` is the next
purpose-admissible executable pure-R candidate at 72,428 downloads. Its mandatory dependencies are
only `grDevices`, `graphics`, `stats`, and `utils`, and official metadata declares no suggested
packages and `NeedsCompilation: no`.

Only the 320,289 raw bytes of the official archive were read to pin SHA-256
`880bb3c2912962cbc3a5998510f4c450ea697a37b2935b5d8ae08495527d7272`. The archive remains unlisted,
unextracted, unparsed, uninstalled, and unexecuted at P0. Its scheduled evaluation must again select
only reusable semantic, package-system, graphics, or check-runner increments.

## Profile 0.388 logger source-blind P4 boundary

The frozen unchanged `logger 0.4.2` source installs through the standard package pipeline and now
loads after the shared `utils::assignInMyNamespace` and `utils::assignInNamespace` contracts were
implemented. Both imported helpers are exercised against logger's own namespace, and an independent
scenario attaches the package, selects `formatter_sprintf`, installs custom layout/appender
functions, and captures the expected message. The installed artifact SHA-256 is
`cfb27f5576bc0ba194ce90f05d12288d28eb12303e6298faad0dc65a5d02a24f`.

The release is P4 rather than P5. Its first installed example passes a numeric message to the
fallback `sprintf` formatter when suggested package `glue` is unavailable. GNU R 4.6.0 under the
same dependency closure fails identically, so this is recorded as the optional `glue`/native-package
dependency boundary rather than handled by a package-specific patch or incorrect numeric coercion.

## Post-0.388 gridGraphics source-blind holdout

The next metadata-only rotation freezes `gridGraphics 0.5-1`, selected at 59,758 downloads in the
fixed 2026-07-17 through 2026-08-15 window after applying the documented browser-purpose exclusions.
Its mandatory dependencies are only browser-core `grid`, `graphics`, and `grDevices`; native
image/PDF integrations are suggestions rather than part of the initial dependency closure.

The unopened 69,207-byte official archive has source SHA-256
`29086e94e63891884c933b186b35511aac2a2f9c56967a72e4050e2980e7da8b`. No archive member, package
source, example, or test has yet been inspected. The scheduled evaluation must begin through the
same generic source-package pipeline used for every other holdout.

## Profile 0.389 gridGraphics axisTicks advance

The scheduled unchanged run first selected the missing shared `grDevices::axisTicks` namespace
import. NativR now supplies that core primitive and `.axisPars` through generic grDevices
registration, covering linear/logarithmic axes, explicit and generated parameters, reversed ranges,
sub-decade scales, and wide-range thinning without consulting the package identity.

The exact installed artifact is pinned at
`74079d0602a9ff7d52ce7e2f954df44fc45317d2da2323ede8ae4bb25b130f88`. The package's R source parses,
but namespace loading next requires `grDevices::contourLines`; the release is therefore development
P1 with an explicit first blocker, not a package-compatibility claim.

## Profile 0.390 gridGraphics contourLines advance

The same unchanged installed artifact now imports the package-neutral `grDevices::contourLines`
implementation. Independent runtime evidence exercises numeric contour topology without loading or
patching package source. The package-check plan proceeds to its next namespace error,
`object 'makeContent' not found`, selecting the reusable `grid::makeContent` grob lifecycle generic.
The artifact remains P1; namespace loading and all higher tiers are still blocked and are not
reported as passing.

## Profile 0.391 gridGraphics lifecycle and P5 advance

The generic grid namespace now owns `makeContent` and `makeContext` plus their identity default
methods. Package S3 registration remains keyed to the imported generic rather than a package name;
the unchanged artifact's `makeContent.echogrob` method is discoverable after namespace loading.

The same frozen `gridGraphics 0.5-1` source and installed digests now pass metadata, namespace,
attachment, documentation, and every applicable installed example through the standard check runner,
advancing the artifact from P1 to P5. The first retained test, `demo-graphics.R`, reaches expression
16 before failing at missing shared `grDevices::pdf.options`. The artifact remains blocked below P6;
no source rewrite or `gridGraphics` production branch was added.

## Profile 0.392 gridGraphics retained-test advance

The package-neutral `grDevices::pdf.options` implementation removes retained `demo-graphics.R`
expression 16 as the first blocker. The frozen unchanged artifact now reaches expression 17, whose
plotting helper writes relative PDF and PNG output. The generic check runner currently executes
installed tests from an immutable artifact location, so it reports the first concrete missing
contract: a writable isolated package-test working directory with browser-memory relative paths. The
package remains P5 until the full retained tests pass; no package-specific rewrite, branch, output
skip, or P6 claim is introduced.

## Profile 0.393 generic test sandbox and gridGraphics advance

The package-check runner now copies every installed test tree, including dotfiles and nested
resources, into a fresh writable browser-memory directory before parsing or running tests. Saved
output is produced under the same isolated contract. The installed artifact remains immutable and
the mechanism applies identically to every package.

The unchanged `gridGraphics 0.5-1` retained test therefore passes its former relative-output
blocker. Shared viewport justification and retained-tree navigation also remove its subsequent
`upViewport` and `downViewport` failures. Expression 17 now reaches recorded display-list dispatch
and first fails because NativR's later `recordPlot()` entries do not yet expose GNU-compatible named
`C_*` operation descriptors and arguments. The package remains P5; no source rewrite or
package-specific runtime path was added.

## Profile 0.394 gridGraphics recorded-operation advance

The unchanged artifact now generically dispatches recorded `C_plot_new`, `C_plot_window`, and
`C_box` operations through GNU-shaped descriptors. Its next expression-17 failure is the missing
shared `grid::grid.polygon` drawing primitive. The artifact remains P5; no package source or
package-specific production path was changed.

## Profile 0.395 gridGraphics primitive-drawing advance

The frozen unchanged artifact now consumes generic grid polygon, segment, line, and point grobs and
the corresponding primitive recorded-operation descriptors. Its retained test completes demo1,
demo2, and demo3 before expression 20 exposes a composite boxplot journal entry that lacks ordered
GNU-equivalent primitive lowering. The artifact remains P5; no source rewrite or package-specific
runtime path was added.

## Profile 0.396 gridGraphics boxplot advance

The frozen unchanged artifact now consumes boxplots through generic per-group primitive recorded
operations. Its retained `demo-graphics.R` test completes expressions 1 through 23, including the
four boxplot/grid-echo demonstrations, before expression 24 reaches the deliberately incomplete
`pairs.default` browser graphics path. The ledger records scatterplot layout, panel callbacks, axes,
and their recorded operations as the next reusable blocker. The artifact remains P5; no source
rewrite or package-specific production path was added.

## Profile 0.397 gridGraphics pairs advance

The frozen unchanged artifact now runs both iris scatterplot-matrix demonstrations through the
generic numeric `pairs` path, including a vectorized background-colour input. Its retained test
therefore completes expressions 1 through 25. Expression 26 first requests the absent
`datasets::volcano` 87-by-61 topographic matrix; adding that asset requires an independently
auditable non-GNU source and an exact provenance record. The artifact remains P5, and the limited
`pairs` path is not represented as complete GNU panel compatibility.

## Profile 0.398 modeltools source-blind rotation

`modeltools 0.2-24` was frozen at P0 from metadata and usage data before its 14,911-byte archive was
opened. Generic cleanup-hook classification, browser-core `stats4` dependency registration,
`methods::prototype`, and `stats::logLik` carry the unchanged package through installation,
namespace load, attachment, documentation checks, and representative `ModelEnvMatrix` plus
`StatModelCapabilities` execution. It reaches P4. Its first P5 blocker is the shared S4/model-
environment `$` interaction in `example:MEapply`; no package source is patched or recognized by
production code.

## Profile 0.399 modeltools MEapply advance

The unchanged `MEapply` example now completes through generic call mutation, model-frame subset,
implicit S4 generic, and class-lineage behavior. No modeltools source, example, or artifact is
rewritten. The package remains P4: its next applicable installed example is
`example:ModelEnvFormula`, whose first failure is a callable `contr.treatment` value in
`contrasts.arg`. Supporting callable contrast generators must be implemented once at the shared
model-matrix layer and must not recognize modeltools.

## Profile 0.400 modeltools examples and test advance

Callable `contrasts.arg` values now execute through the ordinary R callable interface and their
returned matrices flow through one shared validation/completion path. The same increment exposes
single- and multiple-response `stats::lm.fit()` over the reusable QR solver. The unchanged
modeltools artifact passes all installed examples and reaches P5 without source rewriting or a
package identity branch. Its first retained-test failure is `tests/regtest.R` expression 6, where
the preceding S4 `na.omit()` result has 90 design rows but 100 response rows. The next fix must
synchronize omission generically; weakening `lm.fit()` dimension checks would be incorrect.

## Profile 0.401 modeltools P7 evidence

Generic nested-frame expansion, model-frame row preservation, terms intercept handling, S4 NA
dispatch, and promoted-generic fallback now keep every model-environment component on the same
observation set. The unchanged modeltools 0.2-24 artifact passes all installed examples, all 46
retained test expressions, all applicable package checks, and an independently authored scenario. It
is therefore P7 for the current pinned corpus contract. No modeltools identity, source rewrite, or
package-specific runtime branch was added; broader arbitrary-package reuse remains incomplete.

## Profile 0.402 ellipse source-blind rotation

Metadata-only ranking over 3,359 admissible candidates in the fixed 2026-07-22 through 2026-08-20
window selected unchanged ellipse 0.5.0 at 47,846 downloads. Its 160,353-byte official archive was
pinned before inspection. The scheduled run first exposed missing shared `stats::qchisq` and
`stats::qf`; central browser-native implementations now carry installation, namespace loading,
attachment, documentation, and an independent covariance-ellipse scenario to P4. The ordered example
blocker is `stats::arima0`. The holdout partition is empty pending another metadata-first rotation.

## Profile 0.403 GlobalOptions source-blind rotation

Metadata-only ranking selected unchanged GlobalOptions 0.1.4 at 44,676 downloads and froze its
382,348-byte official archive before inspection. Scheduled execution first exposed the missing
`utils::findMatches` import and then Reference Class `callSuper()` in `example:.v`. Package-neutral
implementations close both blockers. The deterministic artifact passes metadata, namespace,
attachment, five documentation topics, five installed examples, vignette classification, and an
independent getter/setter, dynamic-value, validation, filtering, completion, addition, and reset
scenario. The testthat launcher is not applicable because its dependency is Suggested only. The
artifact moves to development P7 without source rewriting or a package identity branch; the holdout
partition is empty and must be replenished before the next source-blind evaluation.

## Profile 0.404 rbenchmark source-blind rotation

Metadata-only ranking selected unchanged rbenchmark 1.0.1 at 39,477 downloads and froze its
8,956-byte archive before inspection. Its first run exposed that `mapply` rejected the call object
created by `match.call()[-1]`; shared apply/map and language-character semantics now close that gap.
The pinned artifact installs, loads, attaches, reports its version, and executes a separately
authored bounded benchmark with GNU-compatible labels and shape, advancing to P4. The installed
example's million-element and high-replication workload exceeds the deterministic execution-step
budget, so it remains the explicit P5 resource blocker rather than prompting a weaker safety limit.
Untouched ca 0.71.1 is now frozen at P0, keeping the source-blind holdout partition populated.

## Profile 0.405 ca source-blind rotation

The scheduled unchanged ca 0.71.1 run exposed only reusable blockers: optional qualified S3 method
registration, multidimensional margins, two core contingency tables, table-to-data-frame expansion,
single-byte plotting characters, abbreviation, and data-frame dimension names. None was repaired by
recognizing ca or rewriting its source. The pinned deterministic artifact now passes metadata,
namespace, attachment, 20 documentation checks, all ten installed examples, explicit absent-test and
absent-vignette classification, and an independently authored 2-by-3 correspondence-analysis
scenario. It advances to scoped P7.

Metadata-only ranking over 3,355 eligible candidates in the same fixed 2026-07-22 through 2026-08-20
window selected nortest 1.0-4 at 38,650 downloads after the documented browser-purpose exclusions.
Its unopened 6,179-byte official archive is frozen at P0 with SHA-256
`a3850a048181d5d059c1e74903437569873b430c915b709808237d71fee5209f`; no archive member or source
content has been listed or read.

## Profile 0.416 ica source-blind P7 closure

Unchanged ica 1.0-3 first stopped at missing `stats::dexp`, then at missing `stats::dt`. The
package-neutral implementations carry it through installation, namespace loading, attachment, and
every applicable generic documentation, example, test, and vignette-classification step. Independent
evidence covers all 11 exports, ACY identity error, and public `ica()` dispatch into a complete
one-component FastICA result. The deterministic artifact SHA-256 is
`ba3440c05805fd2697ac9cd70def95d696bef9b24dd6259ceebd2fde675f8fd5`.

Metadata-first ranking selects proto 1.0.0 next at 27,390 downloads. Official metadata declares no
compilation, OS, or mandatory package dependency requirement; testthat and covr are Suggested only.
Its unopened 541,398-byte archive is frozen at P0 with SHA-256
`9294d9a3b2b680bb6fac17000bfc97453d77c87ef68cfd609b4c4eb6d11d04d1`; no archive member or source
content has been listed or read.

## Profile 0.415 RUnit source-blind P7 closure

Unchanged RUnit 0.4.33.1 first stopped at direct `all.equal.numeric`, then at `methods::isGeneric`.
The package-neutral implementations carry it through metadata, namespace loading, attachment, 11
documentation checks, all seven installed examples, the installed vignette-resource check, and
explicit top-level-test non-applicability. Independent GNU-matched evidence covers all 19 exports,
successful comparison/exception checks, expected failure conditions, and tracker structure.

Metadata-first ranking selects ica 1.0-3 next at 27,832 downloads. Its unopened 12,825-byte archive
is frozen at P0 with SHA-256 `474d3530b16b76a1bf1a1114d24092678ea7215fa57c6fdcee6333f1e768b865`; no
archive member or source content has been listed or read.

## Profile 0.414 dichromat source-blind P7 closure

Unchanged dichromat 2.0-1 first stopped when its serialized pre-fitted `loess` objects dispatched to
an absent method. The generic numeric method now carries the package through installed metadata,
namespace loading, attachment, four documentation checks, all three installed examples, and explicit
absent-test/vignette classification. Independent GNU-matched evidence covers both exports, selected
three-mode color transformations, 17 color schemes, and the 256-by-3-by-4 `dalton` data object.

Metadata-first ranking selects RUnit 0.4.33.1 next at 25,985 downloads. Its unopened 180,317-byte
archive is frozen at P0 with SHA-256
`8528fa3ba8d04a6e71783f01ba3e1163b5900c6b3c2bc81bad2349e220197f05`; no archive member or source
content has been listed or read.

## Profile 0.413 RSpincalc source-blind P7 closure

The unchanged RSpincalc 1.0.2 artifact first exposed the generic N-dimensional `apply()` gap through
its DCMrandom and isPureRotationMatrix examples. The package-neutral implementation now passes
matrix slices for three-dimensional arrays, supports multi-axis margins, and preserves GNU result
shape and dimnames. The generic package-check plan passes metadata, namespace, attachment,
documentation and all runnable examples, with tests and vignettes explicitly absent. Independent
evidence exercises all 45 exports at the namespace surface and representative conversion,
quaternion, interpolation, rotation, and three-dimensional validation paths.

Metadata-first ranking in the same fixed window selects dichromat 2.0-1 next at 26,939 downloads.
Its unopened 128,443-byte archive is frozen at P0 with SHA-256
`19375b11583bc45bc4710c4435cf1232aa1fd8fdd8746f3997f5fb98c792d95a`; no archive member or source
content has been listed or read.

## Profile 0.410 dynamicTreeCut source-blind P7 closure

The scheduled run opened frozen dynamicTreeCut 1.63-1 only after its metadata, 24,027-byte archive,
source SHA-256, dependency closure, and usage rank were recorded. Ordered unchanged execution first
exposed one-dimensional table-sort metadata and drop behavior, then the absent Base `charmatch()`
contract. Both blockers were closed in shared Base/runtime machinery without rewriting package code
or adding a dynamicTreeCut identity branch.

The deterministic installed artifact has SHA-256
`4f6d0df429642da937f7d76730ef89201f55ddeb839b6567066100887cd42016`. The unchanged package now passes
installation, namespace loading, attachment, exact six-export discovery, eight documentation steps,
both installed examples, and explicit absent-test and absent-vignette classification. An
independently authored scenario exercises all six exports and matches GNU R. The pinned artifact
advances to scoped P7.

Metadata-first ranking in the same fixed 2026-07-22 through 2026-08-20 window selects pixmap 0.4-14
next at 31,237 downloads after the documented purpose exclusions. Official metadata declares
NeedsCompilation:no, only browser-core methods, graphics, and grDevices imports, no Suggested or
LinkingTo packages, no OS restriction, and GPL-2 licensing. Its unopened 37,054-byte official
archive is frozen at P0 with SHA-256
`26710c931f95b89b66b50e3ee1c4b6e1ba383b8067f80b3d7de2f0d58cb9fa9`; no archive member or source
content has been listed or read.

## Post-0.405 nortest source-blind P7 evidence

The scheduled run opened the frozen nortest 1.0-4 archive only after its metadata, byte size, source
digest, dependency closure, and usage rank were recorded. The unchanged archive passed the generic
installer, namespace loading, attachment, exact export discovery, all six documentation checks, all
five installed Rd example topics, and explicit absent-test and absent-vignette classification. Its
deterministic installed artifact has SHA-256
`370bd2c877f8a89bfcece5f2174c4c0b50e276baa60f9cc0432f788139b115c2`.

An independently authored missing-value scenario exercises all five exported normality tests and
matches the GNU R black box for nested htest structure, statistic names and values, p-values,
Pearson class counts and degrees of freedom, captured data names, and sample-size errors. No new
runtime primitive, package identity branch, source rewrite, or fixture substitution was required.
The pinned artifact therefore advances directly from P0 to scoped P7; this is strong holdout
evidence for the generic package path, not proof that arbitrary pure-R packages are complete.

The same fixed 2026-07-22 through 2026-08-20 metadata and cranlogs ranking retained 3,354 eligible
outside-corpus candidates after excluding all 81 prior entries. After the documented host-service,
static-resource, native-header, scaffolding, web-asset, documentation-time, and target-version
exclusions, tensor 1.5.1 is the next purpose-admissible executable candidate at 38,437 downloads.
Official metadata reports no mandatory or Suggested package dependencies, no native compilation,
GPL-2-or-later licensing, and publication on 2025-06-17. Its unopened 2,541-byte archive is frozen
at P0 with SHA-256 `6edb07024eaaadec1f83694f5012c2355aced3e589c2c3c659021b5f03168b58`; no archive
member or source content has been listed or read.

## Profile 0.427 gridBase source-blind P7 closure

The frozen unchanged `gridBase` 0.4-7 archive was opened only after its first source-blind failure
was recorded. Ordered execution exposed missing `grid::current.transform`, then `grid::get.gpar`,
then `grid.rect`, and finally two-element `graphics::par(mfg=)` behavior. Each blocker was fixed at
the shared grid or graphics layer; no package source was patched and no production path recognizes
the package name.

The generic package-check plan now passes metadata, namespace, attachment, export documentation,
both installed example topics, absent-test classification, and the installed vignette. A separate
scenario exercises `baseViewports`, `gridOMI`, `gridFIG`, `gridPLT`, and `gridPAR` together with
viewport geometry and inherited graphical parameters. The deterministic installed artifact is pinned
at SHA-256 `41a4dd801b19b29fe882380b2f510986fbb99b6e2fa3ce805489c00e316f7bd7`.

The corpus now has 103 releases: 88 passing, 14 blocked, and one unevaluated; 49 reach P7. Unopened
`gsubfn` 0.7 is the next metadata-frozen holdout at 22,594 downloads in the fixed usage window.
Official metadata declares `NeedsCompilation: no`, GPL >= 2, and only already-passing `proto` as a
mandatory dependency. Its unopened 311,271-byte official archive is pinned by SHA-256
`89351df9e65722d2862f26a0a3985666de3c86e8400808ced8a6eb6e165a4602`.

## Profile 0.428 gsubfn source-blind first-blocker record

The frozen `gsubfn` 0.7 archive was opened only after its metadata, usage count, dependency surface,
size, and digest were recorded. Its first run exposed generic lifecycle-hook documentation
classification. After that package-neutral fix, it passes loading, attachment, documentation, two
examples, absent-test classification, and its vignette. It reaches development P4 with installed
SHA-256 `296a095209abaad70ec1ee5c2e9d1936e0797cd1f7c09818f9298a75fce52f03`; missing browser-owned
`datasets::BOD` in `example:fn` is the ordered first remaining blocker.

## Profile 0.419 timeSeries source-blind P7 closure

The frozen timeSeries 4052.112 archive was opened only after its metadata, 1,457,372-byte size,
browser-core dependency surface, fixed-window 25,290-download count, and source SHA-256 were
recorded. Ordered unchanged execution selected package-neutral LOWESS/supsmu/smoothing-spline, S4
vector/generic fallback, aggregate/filter/product, core-data, year-day parsing, and POSIX sequence
contracts. The deterministic installed artifact SHA-256 is
`81c1ce37173db4a98b93945ac65460c03d34b60df6bcfaece377241ca8d85631`.

The generic pipeline passes metadata, namespace loading, attachment, complete export documentation,
every applicable installed Rd example, explicit absent-test classification, and the installed
vignette check. A separately authored GNU R-matched scenario covers multivariate construction,
arithmetic, data extraction, returns, dimensions, units, endpoints, and dimensionality predicates.
No production path recognizes timeSeries or rewrites its source.

After the same purpose exclusions, metadata-first ranking selects pls 2.9-0 next at 25,918
downloads. Its unopened 4,371,152-byte official archive is frozen at P0 with SHA-256
`fd99cba675b189bda7dbfe56ad2e3c187dc0942a0ac53839dccd64ddfae78e1f`; no archive member or source
content has been listed or read.

## Profile 0.406 tensor source-blind P7 closure

The scheduled unchanged tensor 1.5.1 run first failed during full contraction because `dim<-`
retained stale dimension names while reshaping an intermediate array. The package-neutral fix makes
dimension replacement clear `names` and `dimnames` before installing non-NULL dimensions while
preserving unrelated attributes. Flat, integration, and exact recursive GNU R evidence cover the
rule; no tensor identity or source rewrite is involved.

The deterministic installed artifact has SHA-256
`24d419d06864b8c219275b140b98405e7512c29c643a1fa3543bffc73e01241e`. The unchanged package now passes
metadata, namespace loading, attachment, exact four-export discovery, both documentation checks, its
installed Rd example, and explicit absent-test and absent-vignette classification. An independently
authored scenario matches GNU R for uncontracted outer products, single- and multi-axis
contractions, named dimensions, scalar full contraction, all three infix shortcuts, and ordered
mismatch errors. The pinned artifact advances to scoped P7.

Metadata-first ranking in the same fixed window selects registry 0.5-1 next at 37,561 downloads
after the established purpose exclusions. Official metadata declares R >= 2.6.0, only browser-core
utils as an import, no Suggested packages, no native compilation, GPL-2 licensing, and publication
on 2019-03-05. Its unopened 170,969-byte archive is frozen at P0 with SHA-256
`dfea36edb0a703ec57e111016789b47a1ba21d9c8ff30672555c81327a3372cc`. The official page advertises a
vignette, but no archive member, source, example, test, or vignette content has been inspected.

## Profile 0.407 registry source-blind P7 closure

The scheduled unchanged registry 0.5-1 run first reached its `lapply(..., \`[[<-\`,
...)`setup and exposed the missing first-class replacement primitive. After that shared contract was added, its retained test selected`demo("registry")`, exposing the generic installed-demo resource boundary. Callable `[[<-`
and browser-owned demo discovery/evaluation were implemented without inspecting a host R
installation, rewriting package source, or adding a registry identity branch.

The deterministic installed artifact has SHA-256
`7f5d9911120d97ae3946fafb6eaff51d221acd9ad987be53ee0f33a9f6059097`. The package now passes metadata,
namespace loading, attachment, six-export discovery, four documentation checks, three Rd example
topics, its retained package test, and installed vignette discovery. An independent scenario matches
GNU R for key matchers, registry construction and summary, defaults, mutation, sealing, permission
changes, and diagnostics. The pinned artifact advances to scoped P7.

Metadata-first ranking in the same fixed window selects corpcor 1.6.10 next at 34,052 downloads
after the established host-service, static-resource, native-header, scaffolding, web-asset,
documentation-time, target-version, and static-data exclusions. Official metadata declares only
browser-core stats as an import, no Suggested packages, no native compilation, and GPL-3-or-later
licensing. Its unopened 22,678-byte archive is frozen at P0 with SHA-256
`71a04c503c93ec95ddde09abe8c7ddeb36175b7da76365a14b27066383e10e09`; no archive member or source
content has been listed or read.

## Profile 0.408 corpcor source-blind P7 closure

The scheduled run opened frozen corpcor 1.6.10 only after its metadata, 22,678-byte archive, source
SHA-256, dependency closure, and usage rank were recorded. The unchanged package installed, loaded,
attached, exposed all 29 exports, and passed 12 of 13 Rd examples before `fast.svd`'s 50-by-5,000
example reached the bounded vector ceiling. The first blocker was the shared Base SVD strategy,
which always formed `X'X` even when `XX'` was much smaller.

Profile 0.408 selects the smaller Gram matrix and reconstructs the complementary singular vectors.
With that package-neutral fix, the unchanged deterministic artifact, SHA-256
`aac42dd5f974f093b902fe40e80b63a2159b99a316c2f504dbbfa78084f13aca`, passes 16 documentation checks,
all 13 examples, and explicit absent-test and absent-vignette checks under the unchanged
package-test limits. An independently authored scenario calls all 29 exports and matches GNU R for
weighted statistics, matrix packing, covariance and precision decomposition, partial correlations,
pseudoinverses, rank and condition, positive-definite repair, matrix powers, fast SVD, and fixed and
estimated shrinkage paths. The artifact advances to scoped P7 without a corpcor identity branch or
source rewrite.

Metadata-first ranking in the same fixed 2026-07-22 through 2026-08-20 window selects vipor 0.4.7
next at 33,579 downloads after the established exclusions. Official metadata declares
NeedsCompilation:no, only browser-core stats and graphics imports, no mandatory non-core package, no
LinkingTo field, and no OS restriction. Its unopened 4,688,496-byte official archive is frozen at P0
with SHA-256 `baad41e9ddaa13b5a1db1abab34253b27d5b99e5a6a649b2036aaf1483370b9e`; no archive member
or source content has been listed or read.

## Profile 0.409 vipor source-blind P7 closure

The scheduled run opened frozen vipor 0.4.7 only after its metadata, 4,688,496-byte archive, source
SHA-256, dependency closure, and usage rank were recorded. Ordered unchanged execution selected
three generic blockers: `split<-` used by grouped averaging, `plot.default(las=)` used by a plotting
example, and the ANSI_X3.4-1968 native-encoding label on an installed `.RData` resource. After those
shared contracts were implemented, every applicable package check passed. A separately authored
scenario that invokes all 13 exports then exposed the deeper `stats::ave` namespace-export gap,
which was likewise closed in the core namespace registry rather than in package code.

The deterministic installed artifact has SHA-256
`f09ed3092919c8b6c32527ebc8b57a826125497cbd5f6317c1c65eecf2fc3f0f`. The unchanged package now passes
16 documentation checks, all 13 installed examples, explicit unavailable-Suggested test
classification, both vignettes, and the independent GNU R-matched permutation, radix,
low-discrepancy, averaging, density-offset, texture, and plotting scenario. It reaches scoped P7
without a vipor identity branch, source rewrite, or relaxed resource limit.

Metadata-first ranking in the same fixed 2026-07-22 through 2026-08-20 window selects dynamicTreeCut
1.63-1 next at 33,315 downloads after the established exclusions. Official metadata declares
NeedsCompilation:no, only browser-core stats as a mandatory dependency, no Suggested packages, no
LinkingTo field, no OS restriction, and GPL-2-or-later licensing. Its unopened 24,027-byte official
archive is frozen at P0 with SHA-256
`831307f64eddd68dcf01bbe2963be99e5cde65a636a13ce9de229777285e4db9`; no archive member or source
content has been listed or read.

## Profile 0.411 pixmap source-blind P7 closure

The scheduled run opened frozen pixmap 0.4-14 only after its metadata, 37,054-byte archive, source
SHA-256, core-only dependency closure, and usage rank were recorded. The unchanged package selected
shared S4 coercion-target, inherited initialization, slot access/replacement, and image
aspect-window gaps. Its deterministic artifact SHA-256 is
`6951089f6601dee90417f06ef27d06491c2159195859bb997aab310936ffa380`.

The unchanged artifact passes namespace loading, attachment, six documentation checks, four Rd
examples, and both retained tests. Its saved `bugs.Rout.save` embeds a GNU R 4.5 startup banner,
platform, and host timing, so that reference facet is explicitly not applicable while `bugs.R` still
executes. An independently authored GNU R 4.6.0-matched scenario covers grey, RGB, and indexed
construction, registered coercion, channel combination/extraction, subsetting, and geometry. The
artifact reaches scoped P7 without a pixmap identity branch or source rewrite.

Metadata-first ranking in the fixed 2026-07-22 through 2026-08-20 window selects moments 0.14.1 next
at 30,170 downloads after the established exclusions. Its unopened 7,640-byte archive is frozen at
P0 with SHA-256 `2ed2b84802da132ae0cf826a65de5bfa85042b82e086be844002fe1ce270d864`; no archive
member or source content has been listed or read.

## Profile 0.412 moments source-blind P7 closure

The scheduled run opened frozen moments 0.14.1 only after its metadata, 7,640-byte archive, source
SHA-256, empty mandatory dependency closure, and usage rank were recorded. The unchanged
deterministic artifact SHA-256 is
`205770aa5cb2912fada6ef201ba7a3eab6215cd80696471e0e8c568f717a4ab6`.

The generic pipeline passes namespace loading, attachment, 13 documentation checks, all 12 Rd
examples, and explicit absent-test and absent-vignette checks on its first run. An independent GNU R
4.6.0-matched scenario invokes all 12 exports over vector, matrix, and data-frame inputs and covers
moments, cumulants, reconstruction, skewness, two kurtosis definitions, and four classed tests. It
uses a documented nine-decimal numeric tolerance for sub-ULP high-order tails. The artifact reaches
scoped P7 without a package identity branch, source rewrite, new runtime primitive, or relaxed
resource limit.

Metadata-first ranking in the same fixed window selects RSpincalc 1.0.2 next at 28,766 downloads.
Its unopened 16,542-byte archive is frozen at P0 with SHA-256
`fa8c867ba4d0b393982e671a5872ae097214270ab2ffbb8262ebfe15bee3d225`; no archive member or source
content has been listed or read.

## Profile 0.417 proto source-blind P7 closure

The frozen proto 1.0.0 archive was opened only after its metadata, 541,398-byte size, dependency
surface, fixed-window 27,390-download count, and source SHA-256
`9294d9a3b2b680bb6fac17000bfc97453d77c87ef68cfd609b4c4eb6d11d04d1` were recorded. Ordered unchanged
execution selected environment deparsing, `eapply()`, and expression-preserving S3 subset dispatch
as reusable contracts. The deterministic installed artifact SHA-256 is
`70b797c90818d74e30973e884fd769fb5b4e56208aa042543086fa70d01d0757`.

The generic pipeline passes metadata, namespace loading, attachment, complete export documentation,
both help and Rd example topics, both installed vignette-resource checks, and the applicable
Suggested-test classification. An independent GNU-matched scenario covers prototype inheritance,
automatic receiver injection, mutable state, inherited and overridden methods, parent identity, and
`as.proto.list`. No package source was rewritten and production code has no proto identity branch.

Metadata-first ranking in the fixed 2026-07-22 through 2026-08-20 window selects NLP 0.3-3 next at
26,367 downloads after the documented host-service, project-management, static-asset/data,
native-header, scaffolding, and documentation-tool exclusions. Its unopened 148,952-byte archive is
frozen at P0 with SHA-256 `65abee2eb654cd5bf4e7e52b01055ba22c077bb6f1f64e39b3f9aa9b22e3cec8`; no
archive member or source content has been listed or read.

## Profile 0.418 NLP source-blind P7 closure

The frozen NLP 0.3-3 archive was opened only after its metadata, 148,952-byte size, dependency
surface, fixed-window 26,367-download count, and source SHA-256
`65abee2eb654cd5bf4e7e52b01055ba22c077bb6f1f64e39b3f9aa9b22e3cec8` were recorded. Ordered unchanged
execution selected actual-call argument counts, generic S3 call frames, explicit date formats,
fractional seconds and numeric zones, DCF output, and character sequence endpoints as reusable
contracts. The deterministic installed artifact SHA-256 is
`402e66dd96238f942c902001fb45f4c76d47f319ea8ee1f04ecc42e797f89eab`.

The generic pipeline passes metadata, namespace loading, attachment, complete help and all 16 Rd
example topics, with tests and vignettes explicitly absent. An independent GNU-matched scenario
covers annotations, tokenization, merged features, generic merge/subset behavior, ISO dates, and
date-times. No package source was rewritten and production code has no NLP identity branch.

Metadata-first ranking in the fixed 2026-07-22 through 2026-08-20 window selects timeSeries 4052.112
next at 25,290 downloads after documented exclusions. Its unopened 1,457,372-byte archive is frozen
at P0 with SHA-256 `c4e50a669cfa34814a71e47bb93020442ec40694fc3f1c7bcd94edf2368c6993`; no archive
member or source content has been listed or read.

## Profile 0.421 pls source-blind P7 closure

The frozen `pls` 2.9-0 archive was opened only after its official metadata, 4,371,152-byte size,
fixed-window 25,918-download count, browser-core mandatory dependency closure, and source SHA-256
`fd99cba675b189bda7dbfe56ad2e3c187dc0942a0ac53839dccd64ddfae78e1f` were recorded. Ordered unchanged
execution selected reusable matrix-valued data-frame, terms/model-matrix, formula-update, QR
transform/solve, text/segment, and lazy `matplot` panel contracts. The deterministic installed
artifact SHA-256 is `282bafa4753ea45f9dd5c4fc3b6c2e8e9cf7389db09ee7f953f4d63adf92988f`.

The generic pipeline passes installation, namespace loading, attachment, documentation for all 43
exports, all applicable installed examples, and the installed vignette. The `cppls.fit` example is
not applicable because Suggested `MASS` is unavailable, and the source package has no top-level
tests. Independently authored GNU-matched yarn and mayonnaise scenarios exercise unchanged PLS and
CPPLS model paths. No production branch recognizes `pls`, rewrites its source, or substitutes its
results; P7 remains scoped to this pinned artifact and exercised browser-admissible surface.

The holdout partition is replenished with unopened `stargazer` 5.2.3. The complete metadata-first
filter and fixed 2026-07-22 through 2026-08-20 download window place it at 25,450 downloads after
the recorded host-service, static-asset/data, development-header/scaffolding, and already-evaluated
dependency exclusions. Official metadata declares `NeedsCompilation: no`, GPL >= 2, imports only
core `stats` and `utils`, and declares no Suggested package, `LinkingTo`, or OS restriction. Its
unopened 311,587-byte archive is pinned by SHA-256
`208e9b48a11cf56ce142731c204f3d2bcb5b68719f84309a36362cd925414265`; no archive member or source
content has been listed or read.

## Profile 0.422 stargazer source-blind P7 closure

The frozen `stargazer` 5.2.3 archive was opened only after its official metadata, 311,587-byte size,
fixed-window 25,450-download count, core-only mandatory dependency closure, and source SHA-256
`208e9b48a11cf56ce142731c204f3d2bcb5b68719f84309a36362cd925414265` were recorded. Ordered unchanged
execution selected the independently sourced `datasets::attitude` resource, central `stats::pf`, and
matrix-extent precedence plus vector/empty handling in base bind as reusable contracts. The
deterministic installed artifact SHA-256 is
`5630ee0af4ccd30f34347b61fdfa0b43547dd3f8348474471f83e362a1e75929`.

The generic pipeline passes installation, namespace loading, attachment, complete export
documentation, and the full installed example; top-level tests and installed vignettes are absent.
An independently authored GNU-matched regression-table scenario verifies exact text output. No
production branch recognizes `stargazer`, rewrites its source, or substitutes its results; P7
remains scoped to this pinned artifact and exercised browser-admissible surface.

The holdout partition is replenished with unopened `lgr` 0.5.2. The same complete metadata-first
filter and fixed 2026-07-22 through 2026-08-20 download window place it at 25,079 downloads after
the recorded exclusions. Official metadata declares `NeedsCompilation: no`, MIT + file LICENSE, and
only the already exercised pure-R `R6` package as a mandatory import; optional integrations are
Suggested dependencies. Its unopened 585,978-byte archive is pinned by SHA-256
`4649e34129b3e1cbbca801983adbe6f857a748301bdb1330985e69dde9892273`; no archive member or source
content has been listed or read.

## Profile 0.423 lgr source-blind P7 closure

The frozen `lgr` 0.5.2 archive was opened only after its official metadata, 585,978-byte size,
fixed-window 25,079-download count, mandatory `R6` closure, and source SHA-256
`4649e34129b3e1cbbca801983adbe6f857a748301bdb1330985e69dde9892273` were recorded. Ordered unchanged
execution selected generic `format.default`, optional-Suggests failure classification,
`tools::file_ext`, and `strtrim` contracts. The deterministic installed artifact SHA-256 is
`d09a1147aa2f4317795cd6a44ec6a3a9bb7e10f5892fd54be7bd5e2ba2534c4a`.

The generic pipeline passes every applicable installed check and a separately authored GNU-matched
in-memory Logger/AppenderBuffer scenario. Optional examples are excluded only at concrete calls to
unavailable declared Suggested packages. No production branch recognizes `lgr` or rewrites its
source; P7 remains scoped to this pinned browser-admissible surface.

The holdout partition is replenished with unopened `operator.tools` 1.6.3.1, ranked at 24,899
downloads in the fixed window. Official metadata declares `NeedsCompilation: no`, GPL-2 + file
LICENSE, and only browser-core `utils` as a mandatory import. Its unopened 15,035-byte archive is
pinned by SHA-256 `ef811a3b42820026361cf13ba47031281205f0dff6c2ec7fadb61cd2dd91bec9`; no archive
member or source content has been listed or read.

## Profile 0.424 operator.tools source-blind P7 closure

The frozen `operator.tools` 1.6.3.1 archive was opened only after its release metadata, fixed-window
usage count, size, dependency surface, and source digest were recorded. Its first unchanged blocker
was the locked Base R `.Options` pairlist. The generic implementation initializes that pairlist per
session, synchronizes it with `options()` in the base environment and namespace, supports removal,
restores it on reset, and retains ordinary lexical shadowing. The deterministic installed artifact
SHA-256 is `77f20c3fed33d2cc54438125cb625fa91c198a29ba1f154b656351be182400b2`.

Every applicable generic check and a separately authored GNU R-matched built-in/custom operator
scenario pass without rewriting package source or adding a package identity branch. The replacement
holdout is unopened `stabledist` 0.7-2, ranked at 23,709 downloads in the fixed 2026-07-22 through
2026-08-20 window after the documented exclusions. Official metadata declares only `stats` as a
mandatory import, `NeedsCompilation: no`, GPL >= 2, and optional Suggested packages. Its unopened
33,308-byte archive is pinned by SHA-256
`26671710c0d8e3c815b56e6e4f6bc9ea0509db47c0ef5b8acfbfa16095a16fd5`; no archive member or source
content has been listed or read.

## Profile 0.425 stabledist source-blind P7 closure

The frozen `stabledist` 0.7-2 archive was opened only after its official metadata, 33,308-byte size,
fixed-window 23,709-download count, browser-core mandatory dependency closure, and source SHA-256
`26671710c0d8e3c815b56e6e4f6bc9ea0509db47c0ef5b8acfbfa16095a16fd5` were recorded. Ordered unchanged
execution selected reusable `uniroot` bound and endpoint behavior, GNU-shaped `ecdf` closures and S3
plotting, browser-native `rug`, and RGBA `adjustcolor` transforms. The deterministic installed
artifact SHA-256 is `14cc678395697fe8851cbd921268cf69a84f5dd3c922b0f6570c984ddea7d8c2`.

The complete generic package-check plan passes metadata, namespace loading, attachment, export
documentation, both installed example topics, and absent test/vignette classification. A separately
authored GNU-matched scenario covers all five public distribution operations without package-source
rewriting or a package identity path.

The holdout partition is replenished with unopened `formula.tools` 1.7.1, ranked at 24,221 downloads
in the same fixed 2026-07-22 through 2026-08-20 window after the documented exclusions. Official
metadata declares `NeedsCompilation: no`, GPL-2 + file LICENSE, imports only the already-passing
`operator.tools` plus browser-core `utils` and `methods`, and lists `magrittr` and `testthat` as
Suggested only. Its unopened 19,464-byte official archive is pinned by SHA-256
`4fe0e72d9d96f2398e86cbd8536d0c84de38e5583d4ff7dcd73f415ddd8ca395`; no archive member or source
content has been listed or read.

## Profile 0.426 formula.tools source-blind P7 closure

The frozen `formula.tools` 1.7.1 archive was opened only after its official metadata, 19,464-byte
size, fixed-window 24,221-download count, dependency surface, and source SHA-256
`4fe0e72d9d96f2398e86cbd8536d0c84de38e5583d4ff7dcd73f415ddd8ca395` were recorded. Ordered unchanged
execution selected reusable `utils::apropos`, expression-vector replacement, `stats::terms.formula`,
symbol/atomic `as.name` coercion, and compact arithmetic deparse spacing. The deterministic
installed artifact SHA-256 is `bce730059c494ed09405ed5e5e5e81bdfc2a0ccfe7785b750d136d9c53415be5`.

The complete generic package-check plan passes metadata, namespace loading, attachment, export
documentation, and every applicable installed example. Its retained test launcher is classified not
applicable only because the declared Suggested `testthat` dependency is unavailable; the vignette
surface is absent. A separately authored GNU-matched scenario exercises all ordinary public exports,
formula character conversion, and package-defined `terms` dispatch without source rewriting or a
package identity path.

The holdout partition is replenished with unopened `gridBase` 0.4-7, ranked at 23,103 downloads in
the same fixed 2026-07-22 through 2026-08-20 window after documented browser-purpose exclusions.
Official metadata declares `NeedsCompilation: no`, GPL, mandatory imports limited to browser-core
`graphics` and `grid`, and `lattice` as Suggested only. Its unopened 153,373-byte official archive
is pinned by SHA-256 `be8718d24cd10f6e323dce91b15fc40ed88bccaa26acf3192d5e38fe33e15f26`; no archive
member or source content has been listed or read.

## Profile 0.429 gsubfn optional-dependency boundary

The frozen unchanged `gsubfn` 0.7 artifact now passes metadata, namespace loading, attachment,
export documentation, six installed example topics, absent-test classification, and its installed
vignette after reusable semantic closure. It remains P4 because `example:list` calls
`month.day.year` after `require(chron)`, while `chron` is declared only in Suggests and is not in
the current resolved bundle.

This is a package-system blocker, not permission to reproduce `chron` code or expose its API from
Base R. A generic follow-up must admit only selected browser-compatible optional dependencies,
preserve deterministic dependency closures, and report the first unavailable host or dependency
contract. The corpus remains 103 releases with 88 passing, 15 blocked, and 49 at P7.

## Profile 0.430 deterministic selected-Suggests resolution

Repository installation now accepts an explicit, repeatable set of Suggested package names in
addition to the existing none/all modes. The resolver validates that every selected name is declared
somewhere in the traversed closure, rejects conflicting all-plus-selected controls and duplicates,
follows transitive mandatory dependencies normally, and records the normalized policy in lock format
v2. Default installation remains mandatory-only, preventing a package's entire testing ecosystem
from becoming an accidental production dependency.

Selecting `chron` while installing unchanged `gsubfn` reaches the current archive but
deterministically rejects it at the pure-R boundary: its DESCRIPTION declares compilation and its
NAMESPACE requests a native dynamic library. The mandatory-only lock still contains only `proto` and
`gsubfn` and records Suggests mode `none`. This makes the `example:list` blocker precise and
reproducible without copying `chron::month.day.year`, pretending the optional dependency is
installed, or beginning the native ABI phase prematurely.

The same unchanged run now passes `read.pattern` after GNU-compatible `isOpen(rw=)` selection.
Mode-filtered inherited lookup also admits a separate `strapply(..., combine = list)` path. The
installed `strapply` topic remains failed because its list-FUN R-engine branch produces the same
`Object 'FUN'` failure under advisory GNU R 4.6.0; NativR does not conceal that upstream/browser
fallback behavior with a package-specific rewrite.

## Post-0.430 metadata-frozen tinytable holdout

The next source-blind rotation freezes unopened `tinytable 0.18.0`, selected at 21,458 downloads in
the fixed 2026-07-27 through 2026-08-25 cranlogs window. The complete official metadata filter
retains 3,372 current pure-R candidates outside the 103-release corpus whose mandatory closure is
browser core or already passing. Higher-ranked candidates are excluded by the established
host-service, static font/data/web-asset, native-header, scaffolding, documentation-time, and
already-evaluated-dependency rules; in particular, `codetools` has already run unchanged inside the
`foreach` and `globals` closures.

Official metadata declares `NeedsCompilation: no`, GPL >= 3, R >= 4.1.0, and only browser-core
`methods` as a mandatory import; output integrations are Suggested or Enhanced. The package's
declared surface converts and customizes data-frame tables, so it is an executable
purpose-admissible probe rather than a data-only distribution. Its unopened 440,097-byte archive is
pinned by SHA-256 `83a69d454d2c9333cd4d54bb6c12bc6970d034545c17b260fe4a87e6be04324c`. No archive
member has been listed or read, and no source has been extracted, parsed, installed, or executed.
The corpus now contains 104 releases: 88 passing, 15 blocked, and one deliberately unevaluated
holdout; 49 reach P7.

## Profile 0.431 tinytable execution and optional Enhances edges

The frozen `tinytable 0.18.0` archive was executed unchanged. Its initial ordered blockers exposed
shared S4 slot replacement validation and the lazy `...names()` primitive; both were fixed below the
package layer with GNU differential evidence. A later custom `Please install the \`data.table\`
package.`error is now recognized only because`data.table`is a declared unavailable`Suggests`edge. The generated`style_tt`example guard names`knitr`, which DESCRIPTION records through `Enhances`;
package-check applicability now understands that standard optional category without selecting it
into the dependency closure.

The final generic run passes packaging, namespace loading, attachment, complete export and help
coverage, every applicable example, and retained `tinytest.R`. Vignettes are absent rather than
silently skipped. An independent `tt()` plus `format_tt()` plus `style_tt()` scenario matches
advisory GNU R 4.6.0 for the resulting S4 structure and queued operations. The artifact moves to
regression P7 without source rewriting or package-name logic. The 104-release corpus now contains 89
passing and 15 blocked releases, 50 at P7, and no unevaluated holdout.

## Post-0.431 metadata-frozen magic holdout

The next source-blind rotation freezes unopened `magic 1.6-1`, selected at 22,102 downloads in the
fixed 2026-07-28 through 2026-08-26 cranlogs window. The complete official metadata filter retains
3,375 current pure-R candidates outside the 104-release corpus whose mandatory closure is browser
core or already passing. Higher-ranked candidates are excluded by the established host clipboard,
remote package-management, Bioconductor-service, project-library/lockfile, credential, static
font/data/web-asset, native-header, scaffolding, documentation-time, testing-infrastructure, and
already-evaluated-dependency rules; `codetools` has already run unchanged in dependency closures.

Official metadata declares `NeedsCompilation: no`, GPL-2, Published: 2022-11-16, and only R >= 2.10
plus already-passing `abind` as mandatory dependencies. Its declared purpose—constructing and
investigating magic squares and high-dimensional magic hypercubes—is executable and
browser-admissible rather than data-only or host-service behavior. The unopened 190,592-byte archive
is pinned by SHA-256 `ca79ec7ae92b736cb128556c081abf547f49956c326e053a76579889cbcb7976`. No archive
member has been listed or read, and no source has been extracted, parsed, installed, or executed.
The corpus now contains 105 releases: 89 passing, 15 blocked, and one deliberately unevaluated
holdout; 50 reach P7.

## Post-0.431 magic scheduled source-blind execution

Only after the metadata, download window, official archive size, source digest, P0 corpus entry, and
independent test were frozen, the generic installer opened and evaluated unchanged `magic 1.6-1`.
The deterministic artifact is pinned separately by SHA-256
`47e6ab749b09957ba8e01115cb9872e204163045b8f3785efc143167b7b3276d`. Installation, the mandatory
`abind` dependency closure, namespace loading, attachment, complete export-documentation coverage,
every installed help topic, and ordered examples through `apad` pass.

The initial concrete blocker was `example:apl`: NativR's Base `rep()` rejected the package's extra
`by` argument. Ordered unchanged reruns then exposed shared contracts in primitive `rep()` dots and
S3 dispatch, `stats::optim(method = "SANN")`, `noquote()`, coordinate-matrix admission,
empty-selection replacement type promotion, bounded package-test capacity, chained replacement
evaluation order, and array identity under a wholly missing linear subscript. Every fix lives below
the package layer and has independent GNU differential evidence; no production path recognizes
`magic` or rewrites its source.

The final unchanged run passes all metadata, dependency, namespace, attachment, export/help,
example, retained `aaa.R` test, and vignette steps. A separately authored GNU R 4.6.0 black-box
scenario also verifies five-dimensional surfaces: magic-square invariants, magic products,
rectangular block diagonals, Latin squares, and multidimensional shifts. The artifact reaches scoped
development P7. The 105-release corpus now contains 90 passing and 15 blocked releases, 51 at P7,
and no unevaluated holdout.

## Post-0.432 metadata-frozen countrycode holdout

The next source-blind rotation freezes unopened `countrycode 1.9.0`, selected at 21,023 downloads in
the fixed 2026-07-29 through 2026-08-27 cranlogs window. The complete official metadata filter
retains 3,375 current pure-R candidates outside the 105-release corpus whose mandatory closure is
browser core or already passing. Higher-ranked candidates are excluded by the established host
clipboard, remote package-management, Bioconductor-service, project-library/lockfile, credential,
font/data-only, native-header, scaffolding, and testing-infrastructure rules.

Official metadata declares `NeedsCompilation: no`, GPL-3, Published: 2026-08-20, R >= 2.10, and no
mandatory package dependency. Its country-name standardization and conversion across coding schemes
is executable and browser-admissible. The unopened 539,016-byte official archive is pinned by
SHA-256 `d560b1c2011e19ebf21f7576ba0be9f5bad573082eda1f555f9153b0ba5ae7da`. No archive member has
been listed or read, and no source has been extracted, parsed, installed, or executed. The corpus
now contains 106 releases: 90 passing, 15 blocked, one deliberately unevaluated holdout, and 51 at
P7.

## Post-0.432 countrycode scheduled source-blind execution

After the archive and an independently authored GNU R black-box scenario were frozen, the generic
installer opened and evaluated unchanged `countrycode 1.9.0`. Its deterministic installed artifact
has SHA-256 `8b1abe6442e04e7d4966f63f7775970654ff023154347e9ea323193fcba75e0c`. Installation,
metadata, dependency closure, namespace loading, attachment, every exported help topic, and the
`countryname`, `get_dictionary`, and `guess_field` examples pass. Its testthat harness is explicitly
not applicable because testthat is only Suggested and unavailable; no vignette is installed.

The ordered run freezes `example:countrycode` as the first blocker with
`sourcevar must be a character or numeric vector.` The underlying reusable gap is inherited
data-frame coercion: `as.data.frame()` must reduce a `tbl_df`/`tbl`/`data.frame` subclass to an
ordinary data frame so subsequent single-column extraction returns an atomic vector. Current NativR
retains the leading subclasses and therefore lets the package's generic conversion path produce a
list. The package is recorded at development P4 while that shared S3/data-frame contract is being
closed. The 106-release corpus now contains 90 passing, 16 blocked, no unevaluated holdout, and 51
at P7.

The inherited data-frame coercion contract is now closed with flat, integration, and exact recursive
GNU black-box evidence. The same unchanged artifact then passes the previously blocked `countrycode`
example and every other applicable package-check step. A separately authored scenario matches
name-to-code conversion and warnings, reverse conversion, a custom dictionary, and the bundled
292-by-628 `codelist` resource. `countrycode 1.9.0` therefore reaches scoped development P7. The
106-release corpus now contains 91 passing, 15 blocked, no unevaluated holdout, and 52 at P7. No
production branch recognizes the package or changes its source.

## Post-0.433 metadata-frozen implied holdout

The next source-blind rotation freezes unopened `implied 0.5`, selected at 20,212 downloads in the
fixed 2026-07-30 through 2026-08-28 cranlogs window. The complete official metadata filter retains
3,375 current pure-R candidates outside the 106-release corpus whose mandatory closure is browser
core or already passing. The established exclusions remove host clipboard, remote package
management, Bioconductor-service, project-library/lockfile, credential, font/data-only,
native-header, scaffolding, testing-infrastructure, and already-evaluated-dependency candidates.

Official metadata declares `NeedsCompilation: no`, GPL-3, Published: 2023-06-11, no mandatory
package dependencies, and only testthat, knitr, and rmarkdown in Suggests. Converting between
bookmaker odds and probabilities through eight algorithms is executable and browser-admissible. The
unopened 43,534-byte official archive is pinned by SHA-256
`d55abcefdaa433ce6f1697a86eb610feec2545767590e3c80701718046c49607`. No archive member has been
listed or read, and no source has been extracted, parsed, installed, or executed. The corpus now
contains 107 releases: 91 passing, 15 blocked, one deliberately unevaluated holdout, and 52 at P7.

## Post-0.433 implied scheduled source-blind execution

After metadata and the independent GNU black-box scenario were frozen, the generic installer opened
and evaluated unchanged `implied 0.5`. The deterministic installed artifact has SHA-256
`fbfbddde54b0fac55d5e15c812702cd37e7a1b205fa0bab6b96f8b837f45804c`. Installation, metadata,
namespace/attachment, complete export and help coverage, every applicable example, and the
applicable retained-test and vignette classifications pass.

The independently authored scenario covers all eight documented odds-to-probability algorithms and
power-method inverse conversion. Its first exact mismatch is frozen before source inspection: `jsd`
row 1, column 1 rounds to `0.2315189095` under GNU R but `0.23152114` under NativR. The inverse
power path has related root-solver drift. The package is conservatively recorded at development P6
until this shared numeric contract is closed. The corpus has 91 passing, 16 blocked, no unevaluated
holdout, and 52 P7 releases among 107 pinned releases.

The shared solver contract is now closed. `stats::uniroot` retains the previous actual Brent step
for interpolation admission, reports the final bracket width as `estim.prec`, and performs the
observable final callback evaluation used for `f.root`. Flat, integration, and exact recursive GNU
black-box evidence fixes the evaluation sequence. The same unchanged package and independently
frozen eight-method scenario now pass, so `implied 0.5` reaches scoped development P7. The
107-release corpus contains 92 passing, 15 blocked, no unevaluated holdout, and 53 at P7. No
production branch recognizes the package or substitutes its numeric results.

## Post-0.434 metadata-frozen sfsmisc holdout

The next source-blind rotation freezes unopened `sfsmisc 1.1-25`, selected at 19,929 downloads in
the fixed 2026-07-30 through 2026-08-28 cranlogs window. The complete official metadata filter
retains 3,374 current pure-R candidates outside the 107-release corpus whose mandatory closure is
browser core or already passing. Higher-ranked candidates are excluded by the established host
clipboard, remote package-management, Bioconductor-service, project-library/lockfile, credential,
font/data-only, native-header, scaffolding, testing-infrastructure, and already-evaluated-dependency
rules.

Official metadata declares `NeedsCompilation: no`, GPL >= 2, Published: 2026-08-03, R >= 3.3.0, and
imports only browser-core grDevices, utils, stats, and tools. Its numerical/statistical utilities,
robust tests, graphics helpers, integer utilities, and browser-admissible subset of system helpers
exercise reusable runtime behavior. The unopened 190,824-byte official archive is pinned by SHA-256
`65e66acf26bb0d7fa8852cae492359c13249ab875fd66351aa73823e46230906`. No archive member has been
listed or read, and no source has been extracted, parsed, installed, or executed. The corpus now
contains 108 releases: 92 passing, 15 blocked, one deliberately unevaluated holdout, and 53 at P7.

## Post-0.434 sfsmisc scheduled source-blind execution

After the metadata gate and independently authored GNU R scenario were frozen, the exact archive
entered the unchanged package pipeline. Its deterministic blocked artifact has SHA-256
`9943c7454d3d1e4346c3496494118ba73df0d6bdbf449841fd983bee1c732f96`. The first run stops at P0 before
R-source parsing with `NRPKG1010`: the standard `NAMESPACE` contains safe unbraced and nested
platform conditionals outside the selector's current grammar. Only after recording that exact
blocker was the `NAMESPACE` declaration inspected. The corpus now has 92 passing and 16 blocked
releases, no unevaluated holdout, and 53 at P7.

## Profile 0.435 sfsmisc namespace progression

The package-neutral NAMESPACE selector now accepts the frozen artifact's safe unbraced and nested
platform conditionals without evaluating package code. Repeated unchanged runs then selected shared
graphics-device, distribution, S3, missing-data, control-record, and step-function contracts in
namespace order. Each behavioral addition has flat, integration, or exact recursive GNU black-box
evidence; PostScript output, loess fitting, and multi-panel time-series plotting remain explicit
API-only capability boundaries.

The deterministic ready artifact is pinned by SHA-256
`1ba46207ef708889f31dcb27f092d64e3e646f01db9a312e2a6858a2ce9e3ce6`. The unchanged package now
reaches P1 and stops at the next missing reusable import, `stats::symnum`. The 108-release corpus
contains 92 passing and 16 blocked releases, no unevaluated holdout, and 53 at P7. No production
branch recognizes `sfsmisc`, rewrites its source, substitutes results, or bypasses checks.

## Profile 0.436 sfsmisc symbolic and formula imports

The unchanged artifact now imports the package-neutral `stats::symnum` implementation, including
symbolic correlation matrices, triangular display, legends, missing values, attribute preservation,
and column abbreviation. Its next ordered import selected `stats::update.formula`; recursive dot
substitution now normalizes formula terms and preserves the original formula environment, while
`as.list` exposes formula language entries with their attributes intact.

The same deterministic artifact remains at P1 and now freezes its next namespace blocker at missing
`utils::count.fields`. Corpus totals remain 108 releases, 92 passing, 16 blocked, no unevaluated
holdout, and 53 at P7. No package source was rewritten and no production branch identifies the
package.

## Profile 0.437 sfsmisc field-counting import

The same unchanged artifact now imports package-neutral `utils::count.fields`. The implementation
uses the shared browser-owned path and connection layer and matches GNU black-box behavior for
whitespace and explicit separators, quotes, comments, blank lines, skip, empty fields, multiline
quoted records, connection cursors, return type, validation, and formals.

The deterministic artifact remains at P1 and freezes its next namespace blocker at missing
`tools::Rcmd`. Corpus totals remain 108 releases, 92 passing, 16 blocked, no unevaluated holdout,
and 53 at P7. No package source was rewritten and no production branch identifies the package.

## Profile 0.453 sfsmisc regular time-series plot progression

The shared `stats::plot.ts` path now renders univariate series and multivariate series explicitly
requested as one panel. It does not recognize `sfsmisc`, and genuine multi-panel and phase-plot
calls still fail at named capability boundaries. The unchanged `example:iterate.lin.recursion`
passes through ordinary S3 plot dispatch; the first blocker advances to `example:linesHyperb.lm` and
the reusable `predict.lm` rank-deficiency contract.

## Profile 0.454 sfsmisc prediction and log-axis progression

Package code can use unique partial spellings of `predict.lm(newdata=)` through the ordinary
generic, and finite extreme values remain drawable after logarithmic window expansion. The unchanged
`linesHyperb.lm` and `lseq` examples pass. The first blocker advances to `example:mult.fig` and the
missing browser-owned `datasets::LifeCycleSavings` resource; no package identity or source rewrite
is introduced.

## Profile 0.455 sfsmisc data and regression-diagnostics progression

The generic `datasets` resource loader now exposes a provenance-audited `LifeCycleSavings` data
frame, and reusable `stats::plot.lm` composes the shared model-influence and browser-graphics paths
for the four default diagnostic panels. Unchanged `sfsmisc 1.1-25` `example:mult.fig` passes without
source changes. Its ordered next blocker is `example:p.arrows`, where evaluation reaches an
unresolved symbol `x`; the artifact remains P4 and no package identity branch or source rewrite is
introduced.

## Profile 0.456 sfsmisc core-example progression

The ordinary package example loader now admits independently authored core-package manifests as well
as installed-package Rd extractions. A browser-owned `graphics::arrows` demonstration creates the
documented `x`, `y`, and `s` side effects through the generic global example environment, so
unchanged `sfsmisc 1.1-25` `example:p.arrows` passes without a package branch or source rewrite. The
ordered next blocker is `example:p.profileTraces`, where `datasets::Puromycin` is unavailable.

## Profile 0.452 sfsmisc language-equality progression

The shared `all.equal` path now treats language calls with the same GNU-shaped deparse as equal even
when their internal normalized trees distinguish parsed unary-negative syntax from constructed
negative constants. This preserves strict `identical` behavior and requires no knowledge of
`sfsmisc`. Unchanged `example:inv.seq` passes; the first blocker advances to
`example:iterate.lin.recursion` and the missing reusable `plot.ts` multi-panel contract.

## Profile 0.441 sfsmisc match progression

The shared `base::match(incomparables=)` contract now lets the unchanged package pass
`example:Duplicated`. The artifact remains at P4 and freezes `example:QUnif` as its next P5 blocker:
`plot.default` does not yet admit graphical control `xpd`.

## Profile 0.442 sfsmisc graphical-control progression

The shared `plot.default` path now admits scalar `xpd` controls at GNU R's measured length boundary
without modifying persistent graphics parameters. The unchanged package passes `example:QUnif` and
freezes `example:TA.plot` as its next P5 blocker: the standard reusable `stack.x` helper is absent.
No package source or package-identity branch was added.

## Profile 0.443 sfsmisc core-data progression

The generic `datasets` resource mechanism now provides the public-domain Brownlee `stackloss`,
`stack.x`, and `stack.loss` objects with exact projection and namespace evidence. The unchanged
package advances within `example:TA.plot` and freezes `datasets::airquality` as the next blocker.
The dataset family is reusable by every package and session; no sfsmisc-specific branch exists.

## Profile 0.444 sfsmisc air-quality-data progression

The generic `datasets` resource mechanism now provides the complete PDDL-1.0 `airquality` data frame
with exact shape, storage, missingness, value, and namespace evidence. The unchanged package no
longer fails `example:TA.plot` on a missing core object; that example is classified not applicable
because its Suggested `nlme` dependency is unavailable. The ordered first P5 blocker is now
`example:axTexpr`, where the shared `:` operator rejects a non-finite endpoint. The artifact remains
at P4 and no sfsmisc-specific branch exists.

## Profile 0.445 sfsmisc logarithmic-axis progression

The shared graphics window path now publishes exact logarithmic axis parameters and
`graphics::axTicks` derives omitted scale controls from the active device. The unchanged package's
`example:axTexpr` passes without source changes. Its ordered first P5 blocker advances to
`example:compresid2way`, where `stats::dummy.coef` lacks the required dispatch for class
`c("aov", "lm")`. The artifact remains at P4 and no sfsmisc-specific branch exists.

## Profile 0.446 sfsmisc dummy-coefficient progression

The generic `stats::dummy.coef.lm` method expands coefficients from standard fitted-model metadata,
including original factor levels, contrasts, interactions, aliases, and `use.na`. The unchanged
package's `example:compresid2way` passes without source changes. Its ordered first P5 blocker is now
`example:eaxis`, where `base::format.info` is unavailable. The artifact remains at P4 and no
sfsmisc-specific branch exists.

## Profile 0.447 sfsmisc formatting-information progression

The generic `base::format.info` implementation covers atomic widths and numeric display-mode
selection with session formatting options. The unchanged package's `example:eaxis` advances beyond
its formatting-information call and now reaches `hist.default(..., xaxt=)`, an explicit browser
histogram-control boundary. The artifact remains at P4 and no sfsmisc-specific branch exists.

## Profile 0.448 sfsmisc histogram-axis progression

The shared histogram drawing path now honors `xaxt` and `yaxt`, validates GNU-shaped axis-style
controls, keeps inline controls out of persistent graphics state, and does not force unused controls
when plotting is disabled. The unchanged package's `example:eaxis` passes and its first blocker
advances to the numeric `scientific` penalty used by `example:formatN`.

## Profile 0.449 sfsmisc scientific-format progression

The shared atomic formatter now accepts logical and numeric `scientific` controls and inherits
missing controls from `options("scipen")`. The unchanged package's `example:formatN` passes without
source changes. Its first blocker advances to `example:hatMat`, where `stats::ksmooth` is absent;
the artifact remains P4 and no sfsmisc-specific branch exists.

## Profile 0.450 sfsmisc kernel-smoothing progression

The shared stats namespace now exports `ksmooth` with box and normal kernels, sorted explicit
evaluation points, generated grids, and exact callable formals. The unchanged package's
`example:hatMat` reaches its unavailable Suggested `Matrix` dependency and is classified not
applicable. Its first blocker advances to `example:helppdf` and the browser file/PDF lifecycle; the
artifact remains P4 and no sfsmisc-specific branch exists.

## Profile 0.451 sfsmisc help-PDF progression

The shared help printer now turns any resolved installed Rd or core help page into a valid PDF in
the browser-owned virtual working directory. The implementation neither invokes a host Rd-to-PDF
toolchain nor recognizes consuming package identities. With the documented `stats::Normal` topic in
the core help catalog, unchanged `sfsmisc 1.1-25` `example:helppdf` observes `Normal.pdf` through
`file.exists()` and passes. Its first blocker advances to `example:inv.seq`, where the second
inverse-sequence result fails its `all.equal` assertion; the artifact remains P4.

## Profile 0.440 sfsmisc large-spline progression

Large default `smooth.spline` fits now use a bounded shared knot basis while retaining full public
fit and prediction shapes. The unchanged package's `D2ss` example passes without source changes or
package-specific runtime logic.

The artifact remains at P4 and freezes `example:Duplicated` as the next P5 blocker: `base::match`
does not yet accept its standard `incomparables` argument. Corpus totals remain 108 releases, 92
passing, 16 blocked, no unevaluated holdout, and 53 at P7.

## Profile 0.439 sfsmisc function-plot progression

The reusable exported `graphics::plot.function` S3 method now routes closures through the shared
curve and graphics contracts. The unchanged package's `D1D2` example passes, including the public
`plot(cos, 0, 10, ...)` call shape, without source rewriting or package identity branches.

The artifact remains at P4 and its next P5 blocker is `example:D2ss`: `smooth.spline` reaches the
documented 256-unique-observation browser limit. Corpus totals remain 108 releases, 92 passing, 16
blocked, no unevaluated holdout, and 53 at P7.

## Profile 0.438 sfsmisc namespace closure and P4 execution

`tools::Rcmd` now satisfies namespace import shape while preserving an explicit browser boundary:
GNU behavior launches the host R command driver, so calls fail deterministically rather than
embedding GNU R or pretending a browser has that process. The unchanged package now loads, attaches,
documents every export, and executes representative installed examples, advancing from P1 to P4.

The first P5 blocker is `example:D1D2`, where the shared plot path reports that `x` coordinates must
be real numeric. Corpus totals remain 108 releases, 92 passing, 16 blocked, no unevaluated holdout,
and 53 at P7. No package source was rewritten and no production branch identifies the package.

## Profile 0.457 sfsmisc data progression

The independently published complete `datasets::Puromycin` table is now available through the
generic declarative resource and autoload path. The unchanged `sfsmisc 1.1-25`
`example:p.profileTraces` passes its data-loading stage and reaches unavailable `stats::nls`, now
recorded as the first concrete P5 blocker. The artifact remains at P4; no source rewrite, result
substitution, or package-identity runtime branch was introduced.

## Profile 0.458 sfsmisc nonlinear-model progression

Generic default-algorithm `stats::nls`, `profile.nls`, `plot.profile.nls`, and non-persistent
`plot.default(mgp=)` validation now cover the unchanged nonlinear-model example. The fitter accepts
ordinary admitted two-sided numeric formulas and named starts, so this is reusable by other pure-R
packages and contains no `sfsmisc` or formula-specific branch. `example:p.profileTraces` passes; the
first concrete P5 blocker advances to `example:p.res.2x`, where the browser-owned datasets catalog
lacks `lm.SR`. The artifact remains at P4.

## Profile 0.459 sfsmisc core-example progression

An independently authored `stats::lm.influence` core example manifest now creates `lm.SR` through
ordinary reusable data, formula, linear-model, and influence paths. The unchanged `example:p.res.2x`
passes without package rewriting. The first P5 blocker advances to `example:p.tachoPlot`, where the
browser-owned datasets catalog lacks `state.center`; the artifact remains at P4.

## Profile 0.460 sfsmisc state-family progression

The generic core data pipeline now accepts a topic name that differs from the bindings created by
its resource. The complete `state` family enters as one provenance-audited topic and exposes all
seven public objects without recognizing sfsmisc. The unchanged `example:p.tachoPlot` passes,
including its ordinary `data(state)`, `USArrests`, graphics, and repeated mtcars paths. The first P5
blocker advances to `example:p.ts`, where `datasets::sunspots` is absent; the artifact remains at
P4.

## Profile 0.461 sfsmisc time-series progression

The generic core-data catalog now supplies the complete fixed `sunspots` series, while reusable
time-series primitives admit `xaxt`/`yaxt` plotting controls and fractional two-component `window()`
coordinates. The unchanged `sfsmisc 1.1-25` `example:p.ts` advances without source rewriting or
runtime package recognition. Its next ordered P5 blocker is the missing browser-owned
`datasets::EuStockMarkets` object; the artifact remains at P4.

## Profile 0.462 sfsmisc EuStockMarkets progression

The generic core-data catalog now supplies the complete fixed `EuStockMarkets` `mts`, including all
values, dimensions, names, classes, and time metadata. Static topic budget isolation is reusable by
other large package resources and does not recognize sfsmisc. The unchanged `example:p.ts` advances
to numeric `as.POSIXct()` without an explicit `origin`; the artifact remains at P4.

## Profile 0.463 sfsmisc POSIX and axis progression

The shared Base conversion path now supports numeric `as.POSIXct()` without an explicit origin and
with reusable vectorized origin types, attributes, special values, and recycling diagnostics. Shared
Date/POSIXct axis methods also recognize a forwarded missing format promise through the same
recursive argument state used by `missing()`, without changing closure matching or substituting a
package result. All seven unchanged calls in `example:p.ts`, including its two dense Date-axis
paths, now pass without source rewriting or package recognition. The first ordered P5 blocker is
`example:pkgDesc: missing value where TRUE/FALSE needed`; the artifact remains at P4.

## Profile 0.464 sfsmisc metadata and Theoph progression

The installed-package pipeline synthesizes stable `Built` metadata from pinned package fields and
the NativR target instead of host clock state. Generic `sapply()` simplification now carries the
names needed by `sfsmisc::pkgDesc`, so that unchanged example passes. A complete independently
licensed `datasets::Theoph` resource loads through normal autoload, namespace, and `data()` paths,
allowing `example:plotDS` to reach its actual reusable model blocker. The ordered first blocker is
now `nls() automatic starting values are not implemented; supply a named start list`; sfsmisc stays
at P4 until that and the later independent checks close.

## Profile 0.465 sfsmisc self-start model progression

The runtime now discovers self-start behavior from callable attributes rather than a package name or
formula string. `getInitial()` and omitted-`start` `nls()` share that protocol, while `SSfol` and
value-only `predict.nls()` provide the admitted pharmacokinetic model surface. The unchanged
`example:plotDS` passes without source rewriting or runtime recognition of sfsmisc. Its ordered
first blocker advances to `example:potatoes`, where the shared `ftable()` path rejects an admitted
table-like input as non-numeric. sfsmisc remains P4 until this and later independent checks close.

## Profile 0.466 sfsmisc atomic-table progression

The package-neutral flat-table implementation now preserves arbitrary atomic cells in an existing
multiway array, rather than assuming every table contains integer counts. This covers the character
table generated by unchanged `example:potatoes` as well as logical, integer, double, complex, raw,
and missing values through one reusable permutation path. The example advances to its next
independent blocker, absent `stats::interaction.plot`. sfsmisc remains P4; neither source rewriting
nor a package-specific runtime branch was introduced.

## Profile 0.467 sfsmisc interaction-plot progression

A package-neutral `stats::interaction.plot` implementation now supplies the grouped callback and
browser graphics behavior exercised by unchanged `example:potatoes`. It uses factor metadata,
ordinary callable invocation, and shared graphics primitives, without recognizing sfsmisc or its
data. The complete potatoes example now passes. The next independent blocker is
`example:pretty10exp`, where `[[` is applied to a non-vector language/object shape that the shared
subsetting layer does not yet admit. sfsmisc remains P4 until this and later checks close.

## Profile 0.468 sfsmisc language-subset progression

The shared subset layer now supports positional and named extraction from calls and expression
vectors, including reconstruction and tag/name preservation. This is the generic language behavior
needed by unchanged `example:pretty10exp`; the example now passes without rewriting its formatting
logic. The next independent blocker is `example:primes`, where the shared `matplot` path accepts
only a scalar `ylab` while the package supplies a reusable multi-label form. sfsmisc remains P4.

## Profile 0.469 sfsmisc matplot-label progression

The shared graphics annotation path now accepts the vector `ylab` form used by unchanged
`example:primes`, including the ordinary character, numeric, expression, missing, and empty-label
contracts. The example passes without package source changes or a package-specific runtime branch.
The next independent blocker is `example:printTable2`, where generic array indexing reports an
incorrect number of dimensions. sfsmisc remains P4 until that and later checks close.

## Profile 0.470 sfsmisc formatted-table progression

The package-neutral formatter now preserves matrix and array dimensions and dimension names on its
character output. This closes the rectangular indexing assumption exercised by unchanged
`example:printTable2`; the example passes without source rewriting. The next independent blocker is
`example:ps.end`, where a missing argument reaches the generic `formals()` path. sfsmisc remains P4.

## Profile 0.471 sfsmisc formals progression

Generic omitted-argument reflection now lets unchanged `example:ps.end` inspect its caller's
formals, and character/envir lookup follows the reusable function-search contract. The example then
reaches the independently declared `postscript()` host-format boundary: progress is not claimed as a
pass until a real browser-admissible PostScript encoder exists. No package branch or source rewrite
was introduced; sfsmisc remains P4.

## Profile 0.472 sfsmisc PostScript progression

The unchanged `sfsmisc` artifact now executes `ps.end` through the generic browser-owned PostScript
device and produces a real virtual `.ps` file. Its later attempt to start an external viewer reaches
the ordinary default-deny `systemCommand` boundary. The package checker classifies that exact
host-capability diagnostic as not applicable for examples and retained tests; it does not add a
package rule or pretend that the viewer ran. Ordered execution therefore advances to
`example:read.org.table`, whose first applicable blocker is `readLines(encoding = "native")`. The
artifact remains P4 pending the remaining examples and tests.

## Profile 0.473 sfsmisc native-encoding progression

The package-neutral line reader now accepts the native encoding label used by unchanged
`sfsmisc::read.org.table` and decodes it through the declared browser-native UTF-8 profile. That
example passes without rewriting package code. Ordered checking next reaches `example:relErr`, where
`stopifnot(exprs=)` rejects expression objects. sfsmisc remains P4 until that and the later
independent example/test blockers close.

## Profile 0.474 sfsmisc assertion-block progression

The generic `stopifnot` evaluator now runs the unchanged multi-expression assertion blocks in
`sfsmisc::relErr` and `pkgLibs`; both advance without source rewriting or a package branch. Ordered
checking keeps `example:relErr` as the first blocker because its next call requires the currently
unregistered exported `tools::assertError`. sfsmisc remains P4 pending that and later blockers.

## Profile 0.475 sfsmisc error-assertion progression

The generic tools export lets unchanged `example:relErr` verify its expected invalid-length error
and complete. Ordered checking now reaches `example:sessionInfoX`; its first blocker is generic
conversion of a list-backed version specification. sfsmisc remains P4 and no package-specific
behavior was added.

## Profile 0.476 sfsmisc version-metadata progression

The generic `package_version()` path now accepts R-shaped named `major`/`minor` metadata and returns
the strict system-version class stack. Unchanged `example:sessionInfoX` passes that conversion
without source rewriting or package recognition. Its next first blocker is the missing core object
`R_compiled_by`; sfsmisc remains P4.

## Profile 0.477 sfsmisc compiler-report progression

The generic locked `R_compiled_by()` binding now supplies portable compiler-report names and honest
browser-owned toolchain labels. Unchanged `example:sessionInfoX` advances without package-specific
behavior. Its next blocker is missing `extSoftVersion()`; sfsmisc remains P4.

## Profiles 0.478–0.480 sfsmisc session-metadata progression

Generic external-software, LAPACK, and regular-expression capability metadata now carry unchanged
`example:sessionInfoX` to completion and also close `test:posdef.R`. No package source or runtime
branch recognizes sfsmisc. The next ordered blocker is `example:sourceAttach: no file found`;
sfsmisc remains P4.

## Profile 0.487 `pwr` closure

The unchanged `pwr 1.3-0` artifact passes the complete applicable generic package-check plan after
shared non-central chi-square, F, and Student-t probabilities and formula-based point dispatch close
its ordered blockers. Its independent scenario covers all 15 exports, representative power
calculations, solved sample size, result structures, and diagnostics. The deterministic artifact is
pinned at SHA-256 `12a73d3b7d71ef95fa4d27e9f151450e0ff34bd72f228396f7fb10dc70c956d6` and advances to
scoped P7. No package identity branch or source rewrite exists. Unopened `VennDiagram 1.8.2` is the
replacement P0 holdout.

## Profile 0.489 VennDiagram closure and holdout rotation

The unchanged `VennDiagram 1.8.2` archive passes the complete applicable generic package-check plan
and an independent scenario after shared matrix binding and grid graphics-annotation contracts close
its final ordered blockers. Evidence covers installation, dependency/namespace closure, attachment,
all export/help topics, every applicable example, overlap and partition results, geometry helpers,
and returned grob families. Its testthat driver is not applicable because the package declares
testthat only in Suggests and that optional package is unavailable; no vignette is installed. The
artifact advances to scoped P7 without source rewriting or a package-name branch.

The next source-blind holdout, `httpcode 0.3.0`, required no package-specific accommodation. Its
complete applicable check plan passed immediately; an independent all-export scenario exposed only
outer parentheses in a Base `stopifnot` binary-expression diagnostic. Source-preserving diagnostic
deparse closes that shared gap, and the unchanged artifact advances to scoped P7.

Unopened `shades 1.5.0` is the replacement P0 holdout from the same fixed 2026-07-30 through
2026-08-28 usage window at 16,328 downloads. Its official 35,768-byte archive is frozen at SHA-256
`848398c2e1c10e9c95582841867bb3d1143ff8495047fab03313fe239feed2ac` before member listing,
extraction, parsing, installation, or execution.

## Profile 0.490 unchanged shades closure and holdout rotation

The source-blind `shades 1.5.0` run used the exact official archive and the ordinary repository
installer. It exposed reusable grDevices converter, namespace-value, HSV, and structural-attribute
contracts. After those shared contracts received differential and integration evidence, the same
unchanged artifact passes the complete applicable generic package-check plan and independent
scenarios spanning its public colour-manipulation surface. It advances to scoped P7; this remains
evidence for one pinned artifact, not a claim that arbitrary pure-R packages are complete.

The next sole holdout is unopened `relimp 1.0-5`, the next purpose-admissible executable candidate
in the fixed 2026-07-30 through 2026-08-28 usage window at 15,915 downloads after the recorded
host-service, asset, native-tooling, and infrastructure exclusions. Official metadata declares no
compiled code, imports only `stats` and `utils`, and places Tcl/Tk and model-related extensions in
Suggests. Its 13,836-byte archive is frozen at SHA-256
`acac7cf72ea39916761b51c825db0ffcb2bb1640e0a04086831fb78e9e40b679` without member listing,
extraction, parsing, installation, or execution.

## Profile 0.491 unchanged relimp closure and holdout rotation

The exact source-blind `relimp 1.0-5` archive passes the ordinary repository installer and complete
applicable package-check plan without exposing a new blocker. Independent black-box scenarios cover
its mandatory browser-admissible `lm` result surface and its pure string conversion helpers. It
advances to scoped P7; optional interactive Tcl/Tk and Suggested model-package paths are explicitly
not generalized from this evidence.

The replacement holdout is unopened `codetools 0.2-20`, the highest-ranked purpose-admissible
executable candidate after the recorded exclusions in the fixed 2026-07-30 through 2026-08-28 window
at 56,062 downloads. Official metadata declares no compiled code or dependencies and a code analysis
purpose. Its official 38,683-byte archive is frozen at SHA-256
`3be6f375ec178723ddfd559d1e8e85bfeee04a5fbaf9f53f2f844e1669fea863` without archive listing,
extraction, parsing, installation, or execution.

## Profile 0.492 unchanged codetools closure

The exact `codetools 0.2-20` artifact is evaluated only after its source-blind metadata, public
inventory, and GNU R expected scenarios are frozen. Its first failures identify generic language
semantics rather than a package API: missing formal sentinels, reflective special bindings,
`callCC()` escape continuations, zero-argument control-flow call heads, symbol output, normalized
character call heads, and callable `bquote()` formals. The shared implementations contain no
codetools identity check or source rewrite.

The pinned artifact installs, loads, attaches, documents every export, executes every installed
example and retained test, and passes independent language-analysis scenarios through the standard
package-check pipeline. It advances to scoped P7 with artifact SHA-256
`8ae46174e686b5083d2d034caaf26f59beab0e3b69990cfc52f7a5302580794e`. This is compositional evidence
for the generic pure-R pipeline, not proof that arbitrary packages are supported.

## Profile 0.493 unchanged stinepack closure

The metadata-first ranking selects `stinepack 1.5` after applying the established browser-purpose
exclusions. Its official metadata, 6,733-byte archive, source digest, complete five-export/formal
surface, and independent GNU R interpolation scenario are frozen before the generic installer opens
the archive. The unchanged package then passes ordinary installation, namespace and attachment
lifecycle, complete documentation and example execution, all applicable package-check steps, and
independent numerical and error-contract probes without exposing a new semantic gap.

The artifact advances directly from P0 to scoped P7 with SHA-256
`9c23ae1de366e04d575ac4954d08d540b51e646ef2f19ac29cb50b17818d33bc`. No production branch recognizes
the package and no source is rewritten. The result strengthens generic reuse evidence but does not
imply that packages outside the declared browser-admissible closure are supported.

The replacement source-blind holdout is unopened `qvcalc 1.0.4`, selected at 14,811 downloads after
the recorded purpose exclusions. Its official 13,982-byte archive is frozen at SHA-256
`90403cada56e82a6bbd067f397fab20c721850b50874345a6322619165dafb59` before archive inspection or
NativR execution, together with the eight-export/formal inventory and independent GNU R
quasi-variance scenarios.

## Profile 0.494 unchanged qvcalc closure

The frozen `qvcalc 1.0.4` holdout exposed `vcov.lm()` method-formal matching with lazy extra dots,
then a standard custom numeric-response GLM family whose callbacks must remain executable after the
model is stored. Both blockers were implemented in the shared model layer. No package name, source
rewrite, result fixture, or qvcalc-specific dispatch exists in production code.

Artifact SHA-256 `34400402c98126098ef2f914d55f5946fbd9d0ea24a7d91489ff603e97cb2146` passes
installation, namespace loading, attachment, complete applicable documentation/examples/checks,
deterministic classification of unavailable Suggested paths, and an independently authored
factor-model scenario. It advances to scoped P7. The 118-release corpus now has 103 passing, 15
blocked, no unevaluated holdout, and 64 at P7. Custom matrix responses and family initialization
that rewrites `y`, `weights`, or `n` remain outside this increment and are not silently
approximated.

### Source-blind aod 1.3.3 registration

`aod 1.3.3` is the next P0 holdout. Its official 58,304-byte source archive has SHA-256
`b7245e8abf7d78cdfa7f74f6d90f79a418b883058aa3edd5977a60bdbed4087e`. Official metadata reports
`NeedsCompilation: no`, mandatory dependencies only on `methods` and `stats`, and Suggested packages
`MASS`, `boot`, and `lme4`. The public export/formal/help/data/S4 inventory and independent GNU R
black-box scenarios were frozen before NativR opened the archive. The first generic blocker is not
predicted from metadata and must be discovered by unchanged execution.

## Profile 0.495 unchanged aod closure and trust holdout

The frozen `aod 1.3.3` holdout selected reusable formula, factor, density, S4 dispatch, GLM
prediction/log-likelihood/covariance, missing-residual restoration, and formal slot-reflection
contracts. The standard package checker also recognizes a declared unavailable Suggests dependency
when a package-owned error contains the dependency name inside a literal `dQuote(...)` spelling; it
does not infer unmentioned dependencies or suppress ordinary failures.

Artifact SHA-256 `a5b3429016dd237589f80a64ade844ce1ae3c2e659ec7e4cceb9a9cf03403900` passes
installation, namespace lifecycle, complete applicable documentation/examples/checks, and
independently authored statistical and S4 scenarios without source rewriting or package recognition.
It advances to scoped P7. The 120-release corpus has 104 passing, 15 blocked, one unevaluated entry,
and 65 at P7.

The replacement P0 holdout is unopened `trust 0.1-9`, selected at 13,772 downloads from the fixed
2026-07-30 through 2026-08-28 window after applying the recorded browser-purpose exclusions.
Official metadata declares only a stats import, no Suggests, no compiled code, and a trust-region
optimization purpose. Its official 302,619-byte archive is frozen outside Dropbox at SHA-256
`68d41390d6abd79461a972b424e8832272afdf0fd6e7fb57c379ae286919a1dd` without archive listing,
extraction, parsing, installation, or execution.

## Profile 0.496 unchanged trust closure

The frozen `trust 0.1-9` source selected two ordered package-neutral stats seams: direct `glm.fit`
for its Poisson contingency-table regression test and `D` for language-object gradients and Hessians
in its trust-region tests. Neither implementation inspects the package identity or rewrites source.
The deterministic installed artifact SHA-256 is
`303df0c340588d989a4e5a71d496a5535466fea3a17007c0546c2dc323649053`.

The artifact passes the complete applicable generic plan: installation, metadata, mandatory closure,
namespace lifecycle, all export/help documentation, examples, retained tests, saved-output
classification, and vignette execution. It advances from the frozen holdout partition to development
at scoped P7. The 120-release ledger now contains 105 passing, 15 blocked, no unevaluated entry, and
66 scoped P7 artifacts; those counts are evidence about pinned packages, not a declaration that
arbitrary pure-R packages are supported.

## Profile 0.497 unchanged itertools closure

`itertools 0.1-3` was selected and its 21,415-byte official archive frozen at SHA-256
`b69b0781318e175532ad2d4f2840553bade9637e04de215b581704b5635c45d3` before archive listing, source
parsing, installation, or execution. The first generic run isolated one reusable blocker: the
`iRNGStream` example required browser-native L'Ecuyer-CMRG state and core parallel stream/substream
jumps.

After closing that shared random/parallel contract, installed artifact
`bf2fe6d71b785b1a65004649de200dc79295af74f67020537d58a42feade80ae` passes metadata, mandatory
dependency closure, namespace lifecycle, all export/help documentation, every applicable example,
absent tests/vignettes, and an independent product/zip/stream scenario. The Suggested foreach-only
example is deterministically not applicable. The entry advances to development P7 without source
rewriting or a package-name runtime branch. The 121-release ledger now has 106 passing, 15 blocked,
no unevaluated entry, and 67 scoped P7 artifacts.

## Profile 0.498 unchanged optimParallel closure

The metadata-frozen `optimParallel 1.0-3` archive first exposed missing core-parallel cluster
exports and evaluation state, then the public L-BFGS-B `optim` boundary. Shared implementations
close both contracts without package recognition or source rewriting. Artifact
`9230df11e2f6dceb5f8424d296062e416408bd22708e481cc24b188921e2c1cd` passes the complete applicable
generic plan, including all installed examples and its vignette, plus an independent bounded
analytic-gradient scenario.

The entry advances to development P7. The 122-release ledger has 107 passing, 15 blocked, no
unevaluated entry, and 68 scoped P7 artifacts. Browser cluster execution remains a deterministic
single-runtime adaptation rather than a promise of host CPU parallelism.

## Profile 0.499 unchanged tictoc closure

The metadata-frozen `tictoc 1.2.1` artifact passed the generic package-check plan without exposing a
blocker, but the required independent scenario found that `as.vector(Stack())` skipped the
package-registered S3 method. Shared `as.vector` dispatch, generic-default forwarding, and base
factor/data-frame method precedence close that gap without recognizing the package or changing its
source.

Artifact `02a0f5f2303a0fb641a8e404986608d415ab49917d3fae4eee1c5d39c8497fd7` now passes nested Stack
and StackList mutation, nested timers, custom callbacks, raw timing logs, empty-stack behavior, all
applicable examples/checks, and the complete generic P0-P7 plan. The entry advances to development
P7. The 123-release ledger has 108 passing, 15 blocked, no unevaluated entry, and 69 scoped P7
artifacts.

## Profile 0.500 unchanged dfoptim closure

The official 14,416-byte `dfoptim 2023.1.0` archive was metadata-selected and frozen at source
SHA-256 `c436a6d866c94fc71e71a1f6a39bee9245aea1a062dc8dba3b2b229b88d05c30` before archive inspection
or execution. Its standard generic package-check plan passed immediately, but an independent
five-optimizer scenario found that repeated full permutations consumed too little RNG state.

Shared Rejection sampling now advances the uniform engine for the terminal one-candidate draw.
Artifact `7247194cefd1075cf7c8c4ca1356123abf21c307217ad7c8cf58776e4b85f3fa` passes all applicable
metadata, namespace, documentation, example, test/vignette classification, optimizer, dots,
convergence, public-formal, and diagnostic surfaces without source rewriting or package recognition.
The 124-release ledger has 109 passing, 15 blocked, no unevaluated entry, and 70 scoped P7
artifacts.

## Profile 0.501 unchanged DFBA closure

The official 1,229,340-byte `DFBA 0.1.0` archive was selected from the fixed 2026-07-31 through
2026-08-29 usage window and frozen at source SHA-256
`f95a98619321fc1190e1daf2fd2cfc8e529eacba72db7a779f5dac6fae9edc8b` before inspection. Scheduled
execution exposed five reusable beta/logistic/Weibull distribution gaps and then the runtime's
quadratic copying of a locally owned vector grown one element at a time.

The shared runtime now preserves ordinary copy-on-modify while reusing storage only under an exact
local-owner proof. Deterministic artifact
`d1b0d0223c1b5dac43641247af38a01a2cde0e08dc8085e4cf33d53cf185cf5e` passes all 66 planned checks,
including 33 help topics, 14 installed examples, the optional test-driver classification, and 14
vignette records. The 125-release ledger has 110 passing, 15 blocked, no unevaluated entry, and 71
scoped P7 artifacts.

## Profile 0.502 unchanged lm.beta closure

The same fixed 2026-07-31 through 2026-08-29 metadata rotation retains 3,366 admissible releases
outside the 125-release corpus and selects `lm.beta 1.7-3` next at 12,685 downloads after the
documented browser-purpose exclusions. Official metadata declares `NeedsCompilation: no`, GPL >= 3,
`xtable` as its only mandatory non-core dependency, and `knitr` as Suggested only. The existing
corpus already carries unchanged `xtable 1.8-8` through P5.

The official 228,589-byte archive was frozen outside Dropbox at SHA-256
`2bb0aa2603476bdbf7e0a92cdc5c3e3f98d1575cde5a34fa2924ff6b88146faa` before inspection. Its first
unchanged example blocker exposed inherited lookup from a list-backed temporary environment:
`exists("weights", object)` found the outer `weights()` function when the lm list had no weights
field. Profile 0.502 gives `as.environment(list)` and positional list lookup an empty parent while
leaving eval/with data-mask enclosure unchanged.

Deterministic artifact `1c13aeb2a45d1790e851ad5f0a4cdbeeb4bfa6f66c39898e47b023f784aa2201` passes all
19 generic checks and an independent GNU-matched weighted/no-intercept coefficient, summary, xtable,
and error scenario. The 126-release ledger has 111 passing, 15 blocked, no unevaluated holdout, and
72 scoped P7 artifacts.

## Next source-blind holdout: alabama 2025.1.0

After the `lm.beta` promotion, the same fixed 2026-07-31 through 2026-08-29 ranking retains 3,365
metadata-admissible releases outside the 126-release corpus. The next purpose-admissible executable
candidate is `alabama 2025.1.0` at 12,292 downloads. Its only mandatory dependency is the already
passing P7 `numDeriv` artifact; CRAN metadata declares `NeedsCompilation: no`, GPL >= 2, and no
imports, suggests, OS restriction, `LinkingTo`, or `SystemRequirements`.

The official 10,539-byte archive is frozen outside Dropbox at SHA-256
`fad845617a59f67233f6e7a9355fcace4c1d2c12f750acd1de39bc7d0705d7cc`. It has not been listed,
extracted, parsed, installed, or executed. The 127-release ledger therefore contains 111 passing, 15
blocked, and one deliberately unevaluated P0 holdout; 72 remain at scoped P7.

## Profile 0.503 unchanged alabama closure

The ordered run first stopped at missing `stats::nlminb`, then at shared `optim` controls, and
finally at non-finite intermediate barrier trials. The package-neutral implementation exposes
GNU-shaped `nlminb` formals, bounds, scaling, core controls, result fields, and evaluation counters
over the audited L-BFGS-B backend. `optim` now accepts validated method-irrelevant default controls
and lets a line search retreat from non-finite intermediate points while still rejecting a
non-finite start.

Artifact `d436014a3bd2e86072dffe66e9aeabe9bf3d63ba16822c99c0291c1a0610bed6` passes all 11 generic
checks plus an independently authored constrained optimum and direct bounded `nlminb` scenario
against GNU R. The 127-release ledger has 112 passing, 15 blocked, no unevaluated holdout, and 73 at
scoped P7. This evidence does not claim complete equivalence with the native PORT implementation.

## Next source-blind holdout: logging 0.10-111

The fixed 2026-07-31 through 2026-08-29 ranking retains 3,364 metadata-admissible releases outside
the 127-release corpus. After the established browser-purpose exclusions, including the data-asset
package `ISOcodes`, the next executable candidate is `logging 0.10-111` at 11,910 downloads. CRAN
metadata declares `NeedsCompilation: no`, GPL-3, an import only on browser-core `methods`, and
`testthat` and `crayon` as Suggested dependencies.

The official 17,086-byte archive is frozen outside Dropbox at SHA-256
`019bd366f14c9702378b74d0f2babd14497448f8792ccd45d1846cddd3104f59`. It has not been listed,
extracted, parsed, installed, or executed. The 128-release ledger therefore contains one
deliberately unevaluated P0 holdout; its next action is the ordered generic package pipeline and
first-blocker record.

The ordered unchanged run has now advanced the artifact to development P4. Installation, metadata,
namespace loading, attachment, complete export/help coverage, and seven example topics pass. The
first failure is `example:setMsgComposer`: the imported `methods::functionBody` callable is absent.
GNU R reports formals `fun = sys.function(sys.parent())` and returns a closure body as a language
object. Deterministic artifact SHA-256 is
`25cf50ea3597f6fb657a33d2b58169dbcd34972612adb3b809abb4b805c72431`.

## Profile 0.504 unchanged logging closure

The package-neutral `methods::functionBody` binding now exposes GNU's
`fun = sys.function(sys.parent())` default and returns closure bodies as language objects while
primitive bodies remain `NULL`. Flat, integration, and exact recursive GNU evidence cover explicit,
primitive, and caller-default forms.

The pinned logging artifact passes all 27 generic steps and an independent handler scenario covering
registration, INFO filtering, inherited DEBUG levels, a branch message composer, record formatting,
and handler removal. The 128-release ledger has 113 passing, 15 blocked, none unevaluated, and 74 at
scoped P7.

## Next source-blind holdout: latex2exp 0.9.8

The fixed 2026-07-31 through 2026-08-29 ranking retains 3,363 metadata-admissible releases outside
the 128-release corpus. After the established browser-purpose exclusions, `latex2exp 0.9.8` is the
next executable candidate at 11,735 downloads. Official metadata declares `NeedsCompilation: no`,
MIT plus a file LICENSE, no mandatory dependencies or imports, and only optional Suggested packages.

Before archive listing, extraction, parsing, installation, or NativR execution, the official
986,104-byte source archive was frozen outside Dropbox at SHA-256
`8dd641f263989515d0c327550934e4954dc582230ca2bb9f280b6b28a46510a5`. The 129-release ledger now
contains one deliberately unevaluated P0 holdout. Its next action is the ordered generic pipeline
and an explicit first-blocker record.

The ordered unchanged run advances the artifact to development P3: packaging, installed metadata,
namespace loading, attachment, all export documentation, and all eight help topics pass. The first
applicable `TeX` example stops because GNU R accepts identity escapes such as `\>`, `\<`, `\,`, and
`\;` inside a bracket expression while an ECMAScript Unicode-mode `RegExp` rejects them. The
include-tests artifact is pinned at SHA-256
`c3b0426b7d6621ac5dc270e5f78ea389e2129b326d1322cd3691ae5270c93fdc`; the reusable blocker is now the
shared TRE/PCRE-to-browser regex normalization contract.

The package-neutral regex repair makes the complete 18-step plan pass, including both examples,
explicit unavailable-`testthat` classification, and both installed vignettes. An independent
GNU-matched conversion scenario then reaches `latex2exp_supported()` and records the next reusable
blocker: Base exposes a directly callable `rbind.data.frame` method, while NativR currently has only
the generic `rbind()` data-frame behavior. The artifact is P7 for applicable package-check steps but
remains blocked rather than promoted until that public method and the independent scenario pass.

## Profile 0.505 unchanged latex2exp closure

The public `rbind.data.frame` binding now has GNU-shaped formals, direct data-frame row binding,
`make.row.names` behavior, duplicate row-name repair, and an empty-frame result. Together with the
bracket-class identity-escape normalization, flat and exact recursive GNU evidence closes both
ordered blockers.

Artifact `c3b0426b7d6621ac5dc270e5f78ea389e2129b326d1322cd3691ae5270c93fdc` passes all 18 generic
steps and the independently authored vector conversion, styling, custom-command, expression,
invalid-input, and supported-command-table scenario. The 129-release ledger has 114 passing, 15
blocked, none unevaluated, and 75 at scoped P7.

## Next source-blind holdout: enrichwith 0.5.0

The fixed 2026-07-31 through 2026-08-29 ranking retains 3,363 metadata-admissible releases outside
the 129-release corpus. After the established host-service, package-management, credential,
asset/data/header, profiling, scaffolding, and documentation-only exclusions, and after excluding
`plotmo` because its mandatory dependency closure is not available, `enrichwith 0.5.0` is the next
purpose-admissible executable candidate at 10,703 downloads. Official metadata declares
`NeedsCompilation: no`, GPL-3, no mandatory dependencies or imports, and only optional Suggested
packages.

Before archive listing, extraction, parsing, installation, or NativR execution, the official
126,233-byte source archive was frozen outside Dropbox at SHA-256
`fd1c07136409b40bf8246400ef784bacfe74a8a0db19fa695a80a38b46e46e07`. The 130-release ledger now
contains one deliberately unevaluated P0 holdout. Its next action is the ordered generic package
pipeline and an exact first-blocker record; P0 metadata does not imply runtime compatibility.

The ordered unchanged run advances the artifact to development P4. Deterministic include-tests
artifact SHA-256 is `dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612`.
Installation, metadata, namespace loading, attachment, complete export documentation, all 44 help
topics, and multiple examples pass before `example:enrich.family` stops because a closure value
cannot yet be converted into R language syntax. The complete plan also records a later missing
`stats::make.link` binding, but the closure-to-language contract is the ordered first blocker.

The shared language bridge now embeds the exact recursive value behind a runtime constant node and
uses syntax only as its display projection. Flat and exact recursive GNU evidence cover nested
closure/environment identity and evaluation. `example:enrich.family` passes, advancing the ordered
first blocker to the missing public `stats::make.link` constructor in `example:enrich.link-glm`.

## Profile 0.506 unchanged enrichwith closure

The public `stats::make.link` binding now constructs all nine standard `link-glm` objects with GNU
class, component names, closure formals, link/inverse/derivative behavior, machine-epsilon
stabilization, and link-specific `valideta` contracts. Standard family objects reuse those same
components. Flat and exact recursive GNU black-box evidence covers the public structure and nested
behavior without comparing implementation-specific closure bodies.

Pinned artifact `dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612` passes every
applicable generic check, including all installed examples and prebuilt vignette records with
deterministic absent-test classification. A separately authored scenario spans `link-glm`
derivatives, Poisson-family enrichment, linear-model enrichment, auxiliary score/information/bias
closures, reflective formals, and option dispatch. The 130-release ledger now has 115 passing, 15
blocked, none unevaluated, and 76 at scoped P7. No package source or package-identity branch is
involved.

## Profile 0.507 unchanged source-transforming dependency closure

A regression run of unchanged `lambda.r 1.2.4` selected three reusable seams: explicit semicolon
parse data, custom-infix block deparse, and S3 bind dispatch after a leading `NULL`. The first two
preserve the source reconstruction used to create runtime functions; the third prevents
`rbind(NULL, one.row)` from duplicating its first accumulated row.

After the shared fixes, lambda.r passes its complete applicable check and behavioral scenario. The
unchanged dependent `futile.logger 1.4.9` and `VennDiagram 1.8.2` checks also pass. This is evidence
for that pinned dependency closure, not a claim that arbitrary pure-R packages are complete.

## Profile 0.508 unchanged timeDate regression closure

The unchanged `timeDate 4052.112` regression selected three package-neutral contracts: S4 generic
dispatch must force only its declared signature, special `rep()` must preserve promises forwarded
through `...`, and `c.POSIXct` must retain class and compatible time-zone metadata. These repairs
live in the shared Base/methods layer and contain no package-name, version, callable, or source
rewrite.

The artifact now passes the complete current generic plan again, including installation, namespace
lifecycle, documentation, installed examples, retained tests, and the independent sampled-calendar
scenario at scoped P7. Focused unchanged withr and rex checks also pass. This does not imply that
all pure-R packages, all S4 behavior, or arbitrary host time zones are supported.

## Profile 0.509 ellipse advances to its Suggested MASS boundary

The unchanged pinned ellipse 0.5.0 artifact now passes the former `arima0` example and the reusable
NLS/subset, `summary.nls`, model-parameter, and `profile.nls` paths. An independent scenario covers
all three model-based ellipse entry points without patching package source. The next ordered failure
is `example:ellipse.profile.glm`: its guarded example requests Suggested package MASS, and the
required `profile.glm` method is not in the installed browser package closure. Ellipse remains P4
until that dependency is generically available or the check policy proves the guarded path
non-applicable; no MASS method is copied into Base or Stats.

## Profile 0.510 advances two unchanged graphics packages

The generic core-data path now supplies `datasets::volcano` without changing either package. The
unchanged `shape 1.4.6.1` check passes data loading and perspective title annotation before stopping
at the shared `persp(col=)` filled-surface contract. Profile 0.511 closes that contract through the
ordinary polygon journal, so both `example:drapecol` calls pass unchanged. The next ordered failure
is `example:femmecol`, where `graphics::filled.contour` is missing. The unchanged
`gridGraphics 0.5-1` retained demo passes expression 26 and stops at expression 27 because
`graphics::coplot` is not installed. Both first blockers are explicit reusable graphics work;
neither package is rewritten or named by production runtime logic.

## Post-0.512 metadata-frozen diagram holdout

The source-blind partition is replenished with unopened `diagram 1.6.5`, selected from the complete
official CRAN metadata filter and the fixed 2026-07-29 through 2026-08-27 download window. The
filter retained 3,364 current packages outside the 130-release corpus that declare no native
compilation, OS restriction, or `LinkingTo`, and whose mandatory dependencies are browser core or
already-passing corpus packages. Packages ranked above diagram were excluded because their primary
contracts are host clipboard, remote package/project management, Bioconductor service access,
credentials, static asset/header delivery, package scaffolding, or host-runtime profiling.

At 94,603 downloads, diagram is the highest-ranked remaining purpose-admissible executable
candidate. Official metadata declares `NeedsCompilation: no`, GPL >= 2, mandatory dependency
`shape`, imports from browser-core `stats` and `graphics`, and no Suggests. Before archive listing,
extraction, parsing, installation, or NativR execution, its official 536,872-byte archive was frozen
outside Dropbox at SHA-256 `e9c03e7712e0282c5d9f2b760bafe2aac9e99a9723578d9e6369d60301f574e4`. The
131-release ledger now contains one deliberately unevaluated P0 holdout. The next scheduled action
is the unchanged generic pipeline and an exact first-blocker record; P0 metadata does not imply
runtime compatibility.

## Profile 0.513 generic diagram package closure

The frozen unchanged `diagram 1.6.5` artifact now reaches scoped P7 with deterministic artifact
SHA-256 `1d4c58cfd389fe81f399f0640f05f981877012361ffde007ffc4d78836674251`. The generic pipeline
maps documented LazyData object names to serialized resource basenames without changing the public
`data()` contract, including case-different names such as `Rigaweb`.

Ordered package failures also closed reusable Base and graphics behavior: `par(lend=)` line-cap
normalization and device rendering, `format.pval()`, plot title controls, recursive plotmath text
labels, and zero-row `data.frame(NULL, ...)` handling. The complete applicable package-check plan
and an independently authored `plotmat` geometry/rendering scenario pass without package-specific
branches or source rewrites. This remains pinned-package evidence, not arbitrary-package closure.

## Post-0.513 metadata-frozen plotmo holdout

The next source-blind holdout is `plotmo 3.7.1`, selected from the complete official CRAN `PACKAGES`
filter and the fixed 2026-07-31 through 2026-08-29 download window. The ranking retained 3,364
current pure-R candidates outside the 131-release corpus. Higher-ranked entries whose primary
contract is clipboard access, remote package/library management, credentials, static assets, package
scaffolding, profiling, or documentation-only behavior were excluded as not useful browser-runtime
execution probes. `plotmo` became admissible when its mandatory `Formula` and `plotrix` dependency
closure reached the passing corpus.

Before listing or extracting the archive, the official 1,267,466-byte source was frozen at SHA-256
`c5ffd8b2a5e2156ab4182ae1f8501850eb60b72aba1cb5ca185e6661854e86cf`. Its first execution moved it
from holdout to development. The unchanged source and mandatory `Formula`/`plotrix` closure now
parse and package deterministically as artifact SHA-256
`b14ec30d18a30e3e802d5650ef5b9e9b744e18051cde38d5db4acb886c1f5d21`.

Ordered namespace loading first exposed missing `grDevices::as.graphicsAnnot`, then
`stats::hatvalues`. Profile 0.514 closes both through shared contracts: graphics annotations
preserve ordinary non-objects and language values while S3 objects use character coercion;
`hatvalues` is a public S3 generic whose `lm` method reuses `lm.influence` and honors an explicitly
supplied influence object. Flat, integration, and recursive GNU-advisor evidence covers the new
surface. The unchanged artifact now stops at the next declared import, missing `stats::qqline`, so
the corpus claim is P1 only. Namespace loading, attachment, examples, tests, independent scenarios,
and deeper package-check stages remain unclaimed.

## Profile 0.516 plotmo P6 package-check closure

Reusable qqline, language-tail pairlist, captured-dots promise, and plot-stepfun contracts advance
the unchanged deterministic plotmo artifact through installation, namespace loading, attachment,
complete export/help coverage, and every installed example. Its complete generic package-check plan
passes: the retained test and saved output both require unavailable Suggested package rpart and are
classified consistently as not applicable.

An independently authored multi-predictor linear-model scenario verifies `plotres` fitted/residual
values and emitted graphics, then stops in `plotmo` when Base `abbreviate()` receives a non-atomic
predictor-name value. The artifact is therefore P6, not P7. No source rewrite or package-identity
runtime branch was added.

## Profile 0.517 plotmo P7 closure

GNU R character coercion permits `abbreviate(NULL)` and routes recursive or classed input through
`as.character`. Closing that reusable Base contract carries the unchanged plotmo artifact through
its independent multi-predictor path. The call invisibly returns the exact 31-by-2 Girth/Height data
frame and emits new-page, text, and segment graphics; the independent `plotres` scenario and full
applicable generic package-check plan also pass. Plotmo therefore reaches scoped P7 without a
package-specific runtime branch or source rewrite.

## Profile 0.518 gridGraphics conditional-plot advance

The reusable `graphics::coplot` blocker is closed for the numeric one-conditioning-variable call
retained by `gridGraphics`. The implementation is package-neutral, browser-native, recorded through
the ordinary graphics journal, and backed by flat, recursive, and integration evidence. The
unchanged artifact proceeds within the same expression to its next concrete blocker,
`datasets::quakes`.

`gridGraphics` therefore remains P5 blocked. The next step is not to special-case its test: admit
the 1,000-row earthquake catalog only through the core-data provenance policy and a bundle-safe
resource path, or keep the blocker explicit. The current callable also deliberately retains
shape-level status because factor/two-way conditioning, custom panels, explicit layout, and wider
axis/control semantics are not implemented.

## Profile 0.519 unchanged rbenchmark P7 evidence

The pinned `rbenchmark 1.0.1` source archive remains unchanged and receives no package-specific
runtime branch. Its namespace loads and attaches, export documentation passes, and the complete
installed benchmark example now runs with million-element colon vectors and repeated 10,000-value
normal/uniform generation. The independently authored small benchmark remains a separate scenario.
Because the package ships no top-level tests or vignettes, those facets are explicitly not
applicable; every applicable step passes and the artifact advances from P4 to P7.

## Profile 0.520 unchanged invgamma P7 evidence

`invgamma 1.2` was frozen at P0 from official metadata and source SHA-256 before archive inspection.
The unchanged source then selected reusable exponential and non-central chi-square foundations. Its
deterministic artifact installs, loads, attaches, documents all 12 exports, passes all three example
topics—including the original ten-million-draw path—and completes the generic package-check plan.
The retained testthat driver is explicitly not applicable because testthat is Suggested and
unavailable. A separate all-family rate/scale/export scenario matches black-box numeric evidence. No
production code recognizes the package or rewrites its source.

## Post-0.520 metadata-frozen entropy holdout

The source-blind partition is replenished with unopened `entropy 1.3.2`. The complete official CRAN
metadata filter and fixed 2026-07-31 through 2026-08-29 cranlogs window retain 3,365 current
`NeedsCompilation:no`-or-absent, non-OS-specific releases outside the 133-release corpus whose
mandatory dependencies are browser core or already-passing corpus packages. After the established
host-service, package-management, credential, asset/data/header, scaffolding, profiling, and
documentation-only exclusions, entropy is the next purpose-admissible executable statistical package
at 10,910 downloads.

Official metadata declares version 1.3.2 as `NeedsCompilation: no` and GPL >= 3, depending only on
R >= 3.4.0, with no imports, suggests, `LinkingTo`, OS restriction, or `SystemRequirements`. Before
archive listing, extraction, parsing, installation, or NativR execution, the official 15,343-byte
source archive was frozen in the machine-local source cache at SHA-256
`901a2ade8f99b0c45c948cbc2fc792beef7346bc81de33987bb754da12ad76a5`. The 134-release ledger contains
one deliberately unevaluated P0 holdout at this chronological checkpoint; the next scheduled action
was the unchanged generic pipeline and an exact first-blocker record.

## Profile 0.521 unchanged entropy P7 evidence

The scheduled unchanged run installed and loaded the frozen archive before identifying
`stats::chisq.test` as the first reusable failure in the `Gstat` example. The shared Pearson-test
implementation closes goodness-of-fit and contingency values, Yates correction, residual structure,
approximation warnings, formals, and paired-input table provenance. No package source was rewritten
and no production path recognizes `entropy`.

The deterministic include-tests artifact is pinned at SHA-256
`97bfc1652049169c7bad395597d12df5eb392dabcd3e798f7a920522a67e57c5`. It passes installation,
metadata, namespace loading, attachment, all applicable examples, documentation for all 34 exports,
and the complete generic package-check plan under the ordinary finite `package-test` profile. The
archive has no top-level tests or vignettes. A separately authored GNU-matched scenario exercises
empirical and shrinkage frequencies, four entropy estimators, likelihood-ratio and Pearson
statistics, mutual information, independence tests, KL and chi-square divergence, and one- and
two-dimensional discretization. The artifact advances to development P7; the 134-release corpus has
121 passing, 13 blocked, no unevaluated holdout, and 82 at scoped P7.

## profileModel 0.6.2 source-blind result

The official source archive was frozen at
`a2b0b9af8b5ebe9bd732f1f6663f171929c0831f77c260b5aa9a126a12cf2ac1` before inspection. Its ordered
generic run selected missing formula arguments, canonical GLM call retention, and applied formula
offsets as package-neutral blockers. The deterministic installed artifact is
`92b39003801686260fc4b3ddcd32c307aedd1cdca401576839b7386b9693041d`.

The unchanged package now passes installation, namespace loading, attachment, complete export/help
coverage, and every runnable installed example. The MASS-dependent example is not applicable because
MASS is Suggested only; no tests or vignettes are installed. A separately authored GNU R 4.6.0
advisory scenario verifies offset-sensitive profile traces, model/object shape, and all 16 exports.
No production path recognizes the package name or rewrites its source.

## Profile 0.525 nor1mix first-blocker update

The digest-pinned unchanged `nor1mix 1.3-3` artifact now passes the generic `norMix2call` example
through shared call-valued `deriv.default`. Its deprecated `sig2` path also passes through the
generic `tools::assertWarning` and `.Deprecated` condition machinery, and the requested BFGS trace
controls execute without package recognition. The artifact remains P4 because `example:norMixFit`
first requests the unsupported Sheather-Jones density bandwidth selector. No package source was
rewritten and no package-name production branch was added.
