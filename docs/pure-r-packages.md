# Pure-R package loading

Yes: packages whose executable code is entirely R can eventually run on NativR without rewriting
each function in TypeScript. The important qualification is that “written in R” is necessary, not
sufficient. The package and all of its dependencies must stay inside NativR's supported language,
runtime, namespace, data, and I/O contracts.

## Intended model

NativR should load a browser-safe package bundle, not run an ordinary host installation process. A
build-time packager can validate and transform a source package into:

- normalized R source or serialized NativR AST modules;
- parsed `DESCRIPTION` and `NAMESPACE` metadata;
- declared imports, exports, S3 registrations, and datasets;
- package license and attribution metadata;
- a capability/dependency manifest that can be checked before execution.

The application would explicitly provide those bundles when creating a session. Package evaluation
would remain network-free; an application or service worker may fetch/cache bundles before the
runtime receives them.

## Runtime foundations required

The reusable loader depends on:

1. package and namespace environments with correct import/export lookup;
2. `source`, `library`, `require`, `.onLoad`, and `.onAttach` lifecycle behavior;
3. safe parsers for `DESCRIPTION` and `NAMESPACE`;
4. S3/S4 registration and lazy-data/resource loading;
5. a versioned dependency resolver and package capability checks;
6. serialization for package data and compiled normalized AST modules;
7. browser-safe virtual files/connections for package resources.

The parser, owned AST, environments, closures, promises, dispatch, and registered core namespaces
already provide much of the execution foundation. The remaining work is tracked separately because
loading a package is a namespace, dependency, lifecycle, data, licensing, and compatibility
problem—not just parsing a directory of `.R` files.

The usage-ranked `base::aperm` increment demonstrates the intended reuse model: a package can define
an ordinary R S3 method for its own array class, receive lazy arguments, and call `NextMethod()`
into NativR's independently implemented `aperm.default` storage operation. The package method itself
does not need a TypeScript rewrite. A general package loader is still required to discover,
register, and isolate that method from `NAMESPACE` metadata.

## Boundaries

- A pure-R package can load only when every core R feature and dependency it exercises is supported.
- Packages using C, C++, Fortran, Rust, Java, system libraries, subprocesses, sockets, or native
  graphics need a separately audited Wasm build or an explicit host adapter.
- Install scripts and arbitrary package code must not gain filesystem, network, DOM, or JavaScript
  access beyond declared browser-safe capabilities.
- Third-party package code keeps its own license and notices. Loading it as an application asset
  does not copy it into NativR's Apache-2.0 runtime or weaken the clean-room policy.
- NativR must report compatibility per package/version and must not imply that arbitrary CRAN
  packages work merely because a loader exists.

## Delivery sequence

The practical first milestone is a fixture package authored for NativR with only R source, one
namespace, imports from supported core packages, exported functions, an S3 method, and a small
dataset. The next milestone is an independent public pure-R package whose measured tests pass
unchanged. Only after those vertical slices should the project expose a stable package-bundle API.
