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

```text
CRAN-like source package
  -> bounded archive + license inspection
  -> DESCRIPTION/NAMESPACE/dependency resolution
  -> ordered R source + immutable resources
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

An application can fetch and cache the JSON package set itself before `createR()`. The runtime does
not fetch repositories or package resources during evaluation.

## Artifact contract

Each `nativr-pure-r-package` v1 artifact contains:

- original DCF `DESCRIPTION` and `NAMESPACE` text;
- an explicit `unix` or `windows` source-platform selection;
- package-relative R sources decoded from portable UTF-8 or Latin-1 and ordered by `Collate`,
  `Collate.unix`, or `Collate.windows` when declared (otherwise C-locale path order);
- `inst/` files mapped to installed package-relative resources, plus preserved `data/`, `demo/`, and
  license files;
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
9. stable positive session identity through `Sys.getpid()` without exposing a host process;
10. bounded immutable resource lookup through `system.file()` and text access through `readLines()`
    or session-owned file connections;
11. browser-memory `tempdir()`/`tempfile()` paths, `file.exists()`, stateful text connections, and
    connection-aware `readLines()`, `writeLines()`, `cat()`, and `capture.output()`;
12. `utils::data()` discovery and loading for package `data/*.R`, `.csv`, `.tab`, and `.txt`
    resources plus GNU R XDR/gzip `.rda`/`.RData` workspaces, including target environments and
    overwrite protection;
13. bounded `read.table()`/`read.csv()`/`read.delim()` and `write.table()`/`write.csv()` text-table
    paths over package files, session files, connections, or inline `text=` input.
14. bounded GNU R XDR version-2/version-3 and gzip decoding for `R/sysdata.rda`, loaded into the
    package namespace before its R source is evaluated.

Package source, metadata, resource counts, and encoded bytes are bounded before parsing. Package
evaluation then consumes the ordinary step, call-depth, allocation, and output budgets.

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
  package resources, and an ordinary package-owned call through `get_config()`;
- [`generics 0.1.4`](https://cran.r-project.org/package=generics) proves package-owned S3 generic
  dispatch to an application-defined method;
- [`withr 3.0.3`](https://cran.r-project.org/package=withr) proves deeper unchanged-source loading
  plus generated wrapper execution through `with_options()`, including restoration after the
  supplied expression finishes.

No package source is checked into this repository. Together these tests exercise repository
installation, runtime package files, namespace loading, metaprogramming, dynamic caller frames,
closure-formal replacement, and reusable state-management behavior.

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

## Explicit boundaries

- C, C++, Fortran, Rust, Java, shared libraries, `LinkingTo`, `useDynLib`, subprocesses, system
  libraries, sockets, and native graphics require separate audited Wasm or host adapters.
- `system()` exposes only an explicit embedding-host request/response contract. The browser runtime
  has no default shell, command search path, inherited environment, or executable filesystem. A host
  adapter can support selected package features, but it does not make a package containing native
  code a pure-R package.
- `configure`, `configure.win`, `cleanup`, and `cleanup.win` are not executed.
- The current NAMESPACE parser supports `export`, `import`, `importFrom`, and `S3method`. Imported
  S4 construction/introspection functions can run from ordinary package R source, but S4
  registration directives, `exportPattern`, conditional declarations, and other directives remain
  blockers.
- `file()` connections currently cover bounded text/binary-mode handles over immutable package files
  and same-session browser-memory paths, including implicit open/close, explicit `open()`/`close()`,
  `isOpen()`, `flush()`, bounded `seek()`, and `summary()`. Compressed connections, URLs, sockets,
  host paths, typed raw/binary decoding or writes beyond raw `readBin()`, separate read/write seek
  positions, and the broader file API remain separate work.
- Package resources and their parent directories can be enumerated with `list.files()`/`list.dirs()`
  or selected with `setwd()`. Relative `readLines()`, table-reader, and connection paths then
  resolve inside that immutable package root. `R.home()` and the runtime/package/session directory
  trees are virtual NativR identifiers; they do not reveal or depend on an operating-system
  installation.
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
