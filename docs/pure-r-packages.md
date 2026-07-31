# Pure-R package loading

Yes: packages whose executable code is entirely R can use NativR without rewriting each function in
TypeScript. The important qualification is that “written in R” is necessary, not sufficient. The
package and all of its dependencies must stay inside NativR's supported language, runtime,
namespace, data, and I/O contracts.

## Current model

NativR loads a browser-safe package bundle; it does not run an ordinary host installation process.
The initial public `PureRPackageBundle` contains:

- the original DCF `DESCRIPTION` text;
- the original `NAMESPACE` declarations;
- an ordered set of package-relative `R/*.R` source files.

The application explicitly provides bundles through `createR({ packages })`. Worker initialization
parses the metadata and R sources into NativR-owned normalized ASTs. Evaluation remains
network-free; an application or service worker may fetch and cache a bundle before the runtime
receives it.

```ts
const r = await createR({
  packages: [
    {
      description: "Package: demo\nVersion: 0.1.0\nNeedsCompilation: no",
      namespace: "export(square)",
      rSources: [{ path: "R/square.R", source: "square <- function(x) x ^ 2" }],
    },
  ],
});

await r.eval("library(demo)");
await r.eval("square(4)"); // 16
```

The runnable import-and-S3 example is in
[`examples/pure-r-package.ts`](../examples/pure-r-package.ts).

## Executable foundation

The first loader milestone provides:

1. isolated namespace and import environments;
2. dependency-ordered loading and `import`/`importFrom` binding resolution;
3. explicit exports, `pkg::name`, and internal `pkg:::name` lookup;
4. `S3method` registration without attaching the method;
5. `.onLoad()` and `.onAttach()` lifecycle hooks;
6. `library`, `require`, `requireNamespace`, namespace queries, and reset behavior;
7. rejection of native compilation, `LinkingTo`, `useDynLib`, malformed paths, and unsupported
   namespace directives before package evaluation.

The combined DESCRIPTION, NAMESPACE, source-path, and R-source text plus source-file count are
bounded by the configured `maxVectorLength` before any package source is parsed. Package loading
then consumes the normal step, call-depth, allocation, and output budgets.

The parser, owned AST, environments, closures, promises, dispatch, and registered core namespaces
are reused directly. Package closures retain their namespace environment, imported functions are
resolved without leaking all internals into the global environment, and registered S3 methods work
whether or not the package is attached.

The usage-ranked `base::aperm` increment demonstrates the reuse model: a package can define an
ordinary R S3 method for its own array class, receive lazy arguments, and call `NextMethod()` into
NativR's independently implemented `aperm.default` storage operation. The package method itself does
not need a TypeScript rewrite; the loader discovers, registers, and isolates it from `NAMESPACE`
metadata.

The usage-ranked `dput`/`dget` and `save`/`load` increments add browser-safe session-local resource
seams for supported package values. These formats are bounded and reset with the session; they are
not GNU R binary interchange files or a host package filesystem.

## Boundaries

- A pure-R package can load only when every core R feature and dependency it exercises is supported.
- Packages using C, C++, Fortran, Rust, Java, system libraries, subprocesses, sockets, or native
  graphics need a separately audited Wasm build or an explicit host adapter.
- Install scripts and arbitrary package code do not gain filesystem, network, DOM, or JavaScript
  access beyond declared browser-safe capabilities.
- Third-party package code keeps its own license and notices. Loading it as an application asset
  does not copy it into NativR's Apache-2.0 runtime or weaken the clean-room policy.
- The current NAMESPACE parser supports `export`, `import`, `importFrom`, and `S3method`. S4
  imports/method registration, conditional directives, `exportPattern`, lazy data, compiled code,
  package resource files, installation hooks, and byte-compiled code remain outside this milestone.
- The bundle is application-supplied, not a CRAN downloader or installer. A future build-time
  packager must validate licenses, dependency versions, datasets, resources, and a capability
  manifest before producing deployable artifacts.
- NativR reports compatibility per package/version and does not imply that arbitrary CRAN packages
  work merely because a loader exists.

## Delivery sequence

The first milestone is executable and tested in the inline integration suite and the real Worker
Playground: source parsing, imports, exports, namespace access, lifecycle hooks, S3 dispatch,
dependency loading, and reset are covered. The next milestone is a build-time packager plus an
independent public pure-R package whose measured tests pass unchanged. The bundle API remains
experimental until that external-package evidence, version constraints, package data, resources, and
broader NAMESPACE behavior are complete.
