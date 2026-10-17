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

Before downloading a new dependency closure, the build-time API can inspect repository metadata:

```ts
import { preflightPackagesFromRepository } from "@nativr/package-tools";

const plan = await preflightPackagesFromRepository(["lifecycle"]);
console.log(plan.packages.map(({ name }) => name)); // dependency-first order
console.log(plan.firstBlocker); // first metadata blocker, when present
```

Preflight fetches only the bounded `PACKAGES` index and reports declared native compilation,
`LinkingTo`, OS restrictions, missing dependencies, and version mismatches. It returns the index
SHA-256 for pinning, but marks source archives unverified. Corpus admission still requires archive
integrity, source inspection, an artifact digest, and executable tier evidence.

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
digest separately from each normalized NativR artifact digest. Eighteen reach P4, five reach P5; BH
reaches P3 because it declares no R functions to execute:

- [`pkgconfig 2.0.3`](https://cran.r-project.org/package=pkgconfig) proves namespace exports,
  package resources, classed DESCRIPTION metadata with a virtual installation path, and an ordinary
  package-owned call through `get_config()`;
- [`generics 0.1.4`](https://cran.r-project.org/package=generics) proves package-owned S3 generic
  dispatch to an application-defined method;
- [`withr 3.0.3`](https://cran.r-project.org/package=withr) proves deeper unchanged-source loading,
  deterministic installed-vignette discovery, and generated wrapper execution through
  `with_options()`, including restoration after the supplied expression finishes;
- [`R6 2.6.1`](https://cran.r-project.org/package=R6) reaches P5. It proves that a real installed
  package takes precedence over a non-core compatibility shim, that namespace-qualified S3
  registration loads, and that unchanged package code can construct a generator, instantiate a
  reference object, invoke public/private-state methods, mutate reference state, expose an active
  read/write field, preserve shared nested references through a shallow clone, and recursively copy
  a nested R6 object through a deep clone. The same unchanged source constructs a three-level
  `Person`/`Employee`/`Manager` hierarchy, invokes recursive `super$initialize()`/`super$greet()`
  paths, and observes inherited fields, methods, and class membership. Both default-applicable Rd
  example topics execute from the unchanged pinned source; the direct-test entrypoint needs
  unavailable `testthat`;
- [`viridisLite 0.4.3`](https://cran.r-project.org/package=viridisLite), package rank 30 in the
  committed usage snapshot, proves dependency-free unchanged source loading plus package-owned
  256-anchor CIE Lab spline interpolation. `viridis()`, `magma()`, and an alpha/range/reverse call
  return the GNU R-observed colors through generic `colorRamp`, matrix arithmetic, and `rgb`;
- [`RColorBrewer 1.1-3`](https://cran.r-project.org/package=RColorBrewer), package rank 35 with
  1,410,661 downloads in the committed snapshot, proves unchanged package-top-level data-frame
  construction with explicit row names. Its exported 35-row palette metadata, Set1 and Blues
  palettes, and minimum-size warning match GNU R through generic `data.frame`, subsetting, `switch`,
  recursion, warning, and `rgb` semantics.
- [`labeling 0.4.3`](https://cran.r-project.org/package=labeling), package rank 37 with 1,376,303
  downloads in the committed snapshot, reaches P5: all nine exported labeling algorithms execute
  unchanged, and its sole applicable Rd example (`labeling-package`) completes through generic
  `data(iris)` and browser graphics. The build-time source-audited example runner independently
  inventories that single topic and executes its default-applicable code. Its deeper
  `extended.figures(2)` path also completes with a finite 64 MiB output limit, though its returned
  `par()` state has 47 browser entries (48 on an explicit PDF/PNG device) versus GNU R 4.6.1's 72.
  Its pinned source archive has no `tests/` directory, so no P6 test execution is claimed.
  Package-check behavior remains unevaluated.
- [`assertthat 0.2.1`](https://cran.r-project.org/package=assertthat) reaches P4 through the
  standard `tools` namespace dependency and executes representative `assert_that()`,
  `validate_that()`, and `noNA()` calls unchanged. Its pinned Rd inventory has 11 applicable topics
  and 12 runnable blocks. Seven topics now complete through `man/noNA.Rd`, including file assertions
  against the browser-owned virtual filesystem. The first blocker is `man/not_empty.Rd`, which
  references the unavailable standard `datasets::mtcars` binding. P5 remains blocked.
- [`crayon 1.5.3`](https://cran.r-project.org/package=crayon) reaches P4 after reading its standard
  `tools/ansi-palettes.txt` build resource through the generic hidden source-evaluation context. It
  attaches normally and executes nested foreground/background styling plus `strip_style()` without a
  package adapter.
- [`praise 1.0.0`](https://cran.r-project.org/package=praise) reaches P4 through generic PCRE
  capture metadata and unchanged template replacement;
- [`prettyunits 1.2.0`](https://cran.r-project.org/package=prettyunits) reaches P4 through unchanged
  byte, duration, and compact-number formatting after bounded bzip2 data normalization;
- [`evaluate 1.0.5`](https://cran.r-project.org/package=evaluate) reaches P4 through its public
  output-handler constructor and condition/source/recorded-plot predicates;
- [`numDeriv 2016.8-1.1`](https://cran.r-project.org/package=numDeriv) reaches P6 through public
  finite-difference gradient and Jacobian calls, all four default-applicable Rd example topics, and
  all seven top-level package-test scripts executing from its unchanged, digest-pinned source. The
  complete test run uses a measured finite opt-in resource profile.
- [`abind 1.4-8`](https://cran.r-project.org/package=abind) reaches P6 after public array binding
  and singleton-dimension removal calls, followed by all five default-applicable Rd topics from its
  unchanged, digest-pinned source, and all five direct tests with normalized saved-output matches;
- [`rprojroot 2.1.1`](https://cran.r-project.org/package=rprojroot) reaches P5 through public S3
  criterion construction/composition, browser-owned project-root/file discovery, and both
  default-applicable Rd example topics in the unchanged pinned source. Its three other indexed
  topics contain only excluded `\\dontrun` blocks. The direct-test entrypoint requires unavailable
  `testthat`.
- [`rstudioapi 0.19.0`](https://cran.r-project.org/package=rstudioapi) reaches P4 through public
  document-position/range constructors and the outside-RStudio availability/error path;
- [`inline 0.3.21`](https://cran.r-project.org/package=inline) reaches P4 through its public plugin
  registry. Its C/C++ compilation entry points remain outside the browser-native ABI and are not
  counted as executable compatibility.
- [`rematch 2.0.0`](https://cran.r-project.org/package=rematch) reaches P4 through public scalar and
  vector match/extract calls, named capture columns, no-match shapes, and factor input;
- [`whisker 0.4.1`](https://cran.r-project.org/package=whisker) reaches P4 through public template
  rendering over scalars, sections, inverted sections, escaped/unescaped values, and triple braces.
- [`zeallot 0.2.0`](https://cran.r-project.org/package=zeallot) reaches P4 through nested,
  collected, skipped, defaulted, named, rightward, data-frame, and custom-S3 destructuring
  assignment;
- [`ini 0.3.1`](https://cran.r-project.org/package=ini) reaches P4 through browser-owned INI
  parsing, exact section/key/value shapes, serialization, invisible return, and read-back.
- [`cpp11 0.5.5`](https://cran.r-project.org/package=cpp11), package rank 13, reaches P4 through
  unchanged namespace loading and `cpp_vendor()` copying all 24 immutable header resources into the
  browser-owned filesystem. Its C++ compilation/evaluation entry points remain outside this tier and
  await the reusable native Wasm ABI.
- [`otel 0.2.0`](https://cran.r-project.org/package=otel), package rank 29, reaches P4 through its
  default no-op tracing, metrics, logging, span-context, HTTP-context, attribute, and constant APIs.
  No network exporter or host telemetry capability is granted.
- [`BH 1.90.0-1`](https://cran.r-project.org/package=BH), package rank 50, reaches P3 through
  unchanged namespace loading, attachment, zero exports, and exact discovery of 12,554 Boost header
  resources totaling 128,040,580 bytes. P4 is not applicable because BH exposes no R functions;
  downstream C++ compilation remains outside this evidence.

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

A build-time, source-independent `runPackageExamples()` path inventories all indexed `man/*.Rd`
example topics from a digest-pinned source archive, reports excluded `\\dontrun{}` and
`\\donttest{}` blocks, and executes default-applicable code through a caller-owned R session. The
pinned `numDeriv 2016.8-1.1` archive has four applicable topics: `genD`, `grad`, `hessian`, and
`jacobian` all complete after generic `diag<-` semantics were added. This is executable P5 evidence,
separate from its P6 package tests. A selected subset, absent topics, or no applicable blocks does
not establish P5.

A build-time, source-independent `runPackageTests()` path now inventories top-level `tests/*.R`
entrypoints from a source archive, verifies a caller-supplied SHA-256 and package identity, and
passes each unchanged script to a caller-owned R session. It reports nested test files and saved
output expectations without treating them as executed. A pinned `numDeriv 2016.8-1.1` probe now
completes its unchanged `tests/grad01.R` script after generic `NULL` subscript semantics were added.
All seven unchanged top-level scripts (`BWeg.R`, `CSD.R`, `grad01.R`, `hessian01.R`, `jacobian01.R`,
`oneSided.R`, and `trig01.R`) complete with zero NativR warnings under an explicit finite
300-million-step/50-million-vector opt-in profile. The unchanged `CSD.R` requires 273,659,236
evaluation steps and 382,508,540 cumulatively allocated elements; its 1,000-element Richardson
gradient alone requires 144,489,526 steps. Cartesian positive-integer complex power cleared its
former complex-gradient assertion, and reusable inverse-trigonometric primitives cleared the final
`asin()` blocker in `trig01.R`. The pinned archive supplies no `.Rout.save` files. Exact GNU R 4.6.1
also exits successfully for every script. Profile 0.301 matches all 170 lines of `BWeg.R` output
from `analytic D:` through the end after omitting its host-specific `Sys.info` header and GNU R's
process-specific bytecode label. This includes the derivative matrices, closure body, nested list
paths, and class attributes. Those diagnostic omissions are explicit browser adaptations, not a
raw-output or P7 pass. The stricter package-check comparison now runs every script in a fresh native
GNU R and NativR session. The `oneSided.R` streams match after independently probed Windows text
transport decoding; `genD.Rd` also matches. The other scripts and examples retain host-display or
numerical text differences. Profile 0.303 closes several earlier formatting differences through
shared `all.equal`/`format`/`cat` semantics, leaving two of eleven complete outputs matching. These
tests establish P6, while generic `R CMD check` and complete output fidelity remain P7 work. The
runner does not turn an empty `labeling` test inventory into a P6 claim and does not implement
testthat. Saved `.Rout.save` files are exposed to the caller for comparison.

`comparePackageSavedOutput()` compares caller-captured text under explicit policy version 1. The
caller selects saved-source-echo or display-only input and exact-text or display-whitespace
comparison. Source echo is removed only when it matches the next source line; unrelated prompt-like
output survives. The report distinguishes missing expectations from matches and gives a bounded
first-difference location. Combined inputs are capped at 64 MiB and each text at 250,000 lines. Echo
inference is ambiguous when program output exactly matches the next echoed source line, so this
diagnostic alone does not prove byte-level `R CMD check` fidelity.

`pnpm package:check --package NAME --output REPORT.json --rscript PATH` provides a stricter
build-time comparison for pinned, previously evaluated corpus archives. It executes unchanged script
bodies with explicit package setup for examples and a final `invisible(NULL)` harness expression on
both runtimes; the latter prevents an unsupported final closure from crossing the JavaScript result
boundary while preserving each script expression's auto-printing. Tests receive fresh working
directories and byte-verified UTF-8 fixtures. Reports preserve raw streams, source and artifact
digests, runtime limits, capability/profile identity, native transport probes, and
discovered/executed stage inventories. Non-UTF-8 fixtures, condition classes/calls/order, and GNU
cross-stream order remain explicit capture gaps. Only the proven Windows text transport transform
may be inverted; numerical differences, whitespace, and platform/bytecode labels remain visible. The
command exits nonzero until all applicable P7 stages are evidenced. Compact, source-free diagnostic
summaries live under `compatibility/package-check-evidence/`; they do not promote corpus tiers. Full
GNU `R CMD check` execution is not implemented by this harness.

The report's `sourceDependencyAssessment` inventories normalized package R sources, direct test R
files and extracted Rd example blocks under `literal-source-references-v1`. It stores hashes, paths,
roles, positions and fixed findings without implementation bodies. Example positions are relative to
the extracted block identified by its path, not to the original Rd file. Only literal package-code
declaration findings can pass or fail; test/example declaration rules, computed references,
vignettes, generated sources and transitive closure remain unexecuted. Passing the bounded inventory
cannot promote the metadata stage or P7. See the
[package-tools contract](../packages/package-tools/README.md#literal-source-dependency-inventory).
Unreadable test/example inputs appear separately in `sourceDependencyInputFailures`, with their
paths, original byte hashes and a fixed decode-failure reason. They remain discovered and unexecuted
instead of aborting the inventory or disappearing from its report.

The viridisLite, RColorBrewer, labeling, and crayon paths contain no palette table or package source
copied into NativR. Their sources are downloaded only by the opt-in test, digest-pinned, installed
through the public package pipeline, and discarded with the test process. The browser bundle
contains only reusable color interpolation, frame, warning, and arithmetic semantics.

The machine-readable [package corpus](../compatibility/package-corpus.json) is authoritative for
development/regression/holdout membership, source and artifact digests, completed tier, and first
blocker. BH was the final candidate whose complete runtime closure was already available in the
committed top-100 download snapshot and now reaches P3 regression. A source-blind `Formula 1.2-6` P0
holdout has since been admitted from outside that snapshot; its source archive remains unopened and
unevaluated. BH's source release had no non-core runtime dependency and declared no native
compilation. These proofs must not be summarized as a single unqualified “supported packages” count.

The fourth source-blind rotation used only release metadata, public documentation, public API calls,
and GNU R as a black-box oracle before the packages were executed. The reusable runtime work adds
specific and `Ops`-group S3 dispatch for syntax and first-class operators, incremental S3 method
registration while a namespace is initialized, numbered ellipsis identifiers, missing-endpoint
`seq()`, `sign()`, `dimnames<-`, `methods::Quote`, trailing `as.data.frame()` controls, and
list/data-frame `is.na()` shapes. A subsequent general language-call subset/replacement increment
now runs unchanged `abind::asub()` and `abind::acorn()` array selections. Its P5 inventory has five
default-applicable Rd topics, one block each; all five complete unchanged after missing dotted
arguments in a replacement S3 `match.call(expand.dots = FALSE)` pairlist became empty symbols as
observed in GNU R. These examples establish P5; the direct-test evidence below raises it to P6.

The pinned `abind 1.4-8` direct-test inventory contains five top-level scripts with saved-output
files. All five unchanged scripts now execute in fresh sessions under a finite 40-million-step /
10-million-element opt-in package-test profile. The public evaluation option honors a callable
`options(error=)` handler and continues through the two expected `adrop.R` errors and one expected
`afill.R` error, recording them separately. Reusable nested NULL/name replacement, first-class
constructed `[` calls, and one-/two-dimensional array dimname printing close the execution gaps.
Caller-owned comparison against all five source archive saved files now matches after generic prompt
and whitespace normalization. The closing primitives are operator deparsing, atomic array slice
printing, bind dimension names, condition call traces, and visible parenthesized assignments. Abind
reaches P6. Profile 0.302 closes the remaining one-dimensional table heading difference. All five
fresh direct-test and five example stream comparisons now match native GNU R 4.6.1 after the
independently probed Windows text transport decoding, with no display-whitespace normalization. The
three handled errors still lack complete public condition classes/calls/order evidence, and the GNU
cross-stream order and remaining package-check stages are unexecuted. A fresh profile 0.303 run
retains all ten stream matches. P7 remains blocked.

Profile 0.304 adds ordered condition capture through public global calling handlers. The three
handled abind errors now have classes, messages and calls available for comparison. Nine full
comparisons match; `afill.R` differs in a call containing an attributed replacement value whose
attributes are omitted by NativR. All ten stdout/stderr streams still match. Cross-stream ordering
and the remaining package-check stages stay open.

Profile 0.305 closes the attributed replacement-call gap with shared embedded-value display. All ten
abind stream and ordered condition comparisons now match, including its three handled errors. The
package remains P6: cross-stream order and the other unexecuted check stages still need evidence. A
fresh numDeriv run completes all eleven inputs with two matches and nine differences.

The digest-checked `rprojroot 2.1.1` example probe inventories five indexed Rd topics. Both
default-applicable blocks (`root_criterion` and `rprojroot-package`) execute unchanged; the other
three topics have only excluded `\\dontrun` blocks. This establishes P5 without counting excluded
examples as execution. Its direct-test inventory has one top-level `tests/testthat.R` entrypoint and
twelve nested R files; the entrypoint stops because `testthat` is not installed in NativR. No nested
tests or package-check output have passed, so P6/P7 remain unclaimed.

The digest-checked `R6 2.6.1` example probe inventories `R6Class` and `is.R6`; both
default-applicable blocks execute unchanged, and one `\\dontrun` block is excluded. The package
therefore reaches P5 through its real installed source rather than the compatibility shim. Its sole
top-level direct-test entrypoint is `tests/testthat.R`, which stops at the unavailable `testthat`
dependency. Fifteen nested R files are inventoried but unexecuted; P6/P7 remain open.

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

The eighth source-blind rotation evaluates cpp11 and otel only after public manuals, formals,
representative black-box GNU R results, and source digests were frozen. Generic work separates
executable R-source budgets from bounded immutable resources and adds list-aware `sprintf("%s")`,
`strrep()`, `length<-`, `anyNA()`, and `make.unique()`. Both unchanged packages reach P4. cpp11's
native compiler path, real telemetry exporters, every export, P5-P7, and arbitrary-package
compatibility remain unclaimed.

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
- `configure`, `configure.win`, `cleanup`, and `cleanup.win` are not executed.
- The current NAMESPACE parser supports `export`, `exportMethods`, standard `exportPattern` over
  loaded local bindings, `import`, `importFrom`, and `S3method`, while package code can call
  `registerS3method()` once its generic is available. Delayed registration against an unloaded
  suggested package, S4 registration directives, conditional declarations, and other directives
  remain blockers. Imported S4 construction/introspection functions can run from ordinary package R
  source, but this is not complete S4 package support.
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
  `.csv`, `.tab`, and `.txt` datasets load into owned data frames with GNU R's `as.is = FALSE`
  factor conversion. The standard `datasets` namespace now supplies an independently sourced UCI
  Iris text resource through this same `data()` path, without evaluation-time network access. XDR
  v2/v3 `.rda`/`.RData` and gzip wrappers use the independent bounded serialization decoder, and
  `R/sysdata.rda` enters the namespace before source evaluation. bzip2/xz/zstd wrappers, serialized
  closures/language objects, data indexes/aliases, installed-package `.rdx`/`.rdb` lazy-load
  databases, and full lazy-data behavior remain explicit boundaries.
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
