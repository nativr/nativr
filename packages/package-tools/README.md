# @nativr/package-tools

Build-time tools for inspecting standard R source-package directories or `.tar.gz` archives and
producing deterministic, JSON-serializable NativR package artifacts.

```sh
nativr-package inspect ./mypackage
nativr-package pack ./mypackage --output mypackage.nativr.json
nativr-package install pkgconfig --output packages.json
nativr-package install mypackage --suggest optionalhelper --output packages.json
nativr-package verify mypackage.nativr.json
nativr-package resolve dependency.nativr.json mypackage.nativr.json --output packages.json
```

`Collate`, `Collate.unix`, `Collate.windows`, portable UTF-8/Latin-1 package encodings, and
platform-specific `R/unix` or `R/windows` sources are applied during packaging. The deterministic
default is `--source-platform unix`; select `--source-platform windows` when that is the intended
browser package variant.

The generated package set exposes `bundles`, which can be supplied directly to
`createR({ packages: packageSet.bundles })`. Packaging is a build-time operation; the browser
runtime remains network-free and does not execute host installation scripts.

The artifact preserves `inst/`, `data/`, demo, license, and `R/sysdata.rda` resources. It also
extracts topics, aliases, titles, and controlled code from `man/*.Rd` example sections into a
deterministic internal manifest. At runtime, `utils::example()` can return or execute that code,
including opt-in `run.dontrun` and `run.donttest` sections, without bundling an Rd parser or GNU R;
installed `inst/doc` R Markdown, Sweave, prebuilt HTML/PDF, and extracted R vignette files receive a
separate deterministic index consumed by GNU R-shaped `utils::vignette()` discovery; `utils::data()`
can load package `data/*.R`, `.csv`, `.tab`, `.txt`, `.rda`, and `.RData` entries; the namespace
loader installs XDR/gzip `R/sysdata.rda` before evaluating R source. Unsupported serialized graph
types/compressors and installed `.rdx`/`.rdb` lazy-load databases remain explicit compatibility
boundaries.

Normalized NAMESPACE support includes `export`, `exportPattern`, `exportMethods`, `exportClasses`,
`import`, `importFrom`, and `S3method`. S4 class exports are verified against package-created
`.__C__<Class>` metadata at namespace load; unsupported conditional, native, and broader S4 import
directives remain explicit packaging or execution failures.

`install` resolves `Depends` and `Imports` from a CRAN-like source repository and emits an
integrity-locked package set. Suggested packages remain optional by default. Repeat
`--suggest PACKAGE` to admit only named packages encountered through declared `Suggests` edges, or
use `--include-suggests` to require every such edge; the two policies are mutually exclusive. Lock
format v2 records `none`, `selected`, or `all` plus the sorted selected package names so the
optional closure is reproducible. An undeclared selection, unavailable archive, version mismatch, or
non-pure-R selected package fails deterministically. `pack` accepts only an install surface that can
be represented safely. It rejects native compilation, symbolic links, `configure*` installation
hooks, unsafe archive paths, `LinkingTo`, `useDynLib`, and unsupported NAMESPACE directives.
Unexecuted `cleanup*` hooks are reported as warnings because browser artifacts contain no host build
byproducts for them to remove. JVM sources and archives may be retained as inert immutable package
assets, but NativR never compiles, loads, or executes them; behavior that requires a JVM remains
unavailable. A successful package artifact is still marked `execution: "unchecked"` until NativR
loads it and package-specific executable tests pass.

For P7 evidence, `createPackageCheckPlan(artifact)` inventories the browser-admissible package-check
surface without executing code. `runPackageChecks(artifact, session)` then resets the supplied
NativR-compatible executor before each applicable check and verifies installed DESCRIPTION identity,
namespace loading, attachment, export documentation coverage, help topics, examples, package tests,
saved `.Rout.save` output, and installed/prebuilt vignette discovery. Results retain the first
failed or blocked check; missing check infrastructure and semantic output differences are never
reported as success. The runner is package-identity agnostic and does not depend on
`@nativr/nativr`.

Saved-output references that begin with a GNU R version header and also contain the standard
Foundation copyright and host `Platform:` lines are version/platform-bound batch transcripts. The
planner records those facets as `not-applicable` with an explicit reason, but the associated
retained R test remains independently applicable and must pass. Other `.Rout.save` resources
continue through exact normalized comparison; no package-name exception is used.
