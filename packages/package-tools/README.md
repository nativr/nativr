# @nativr/package-tools

Build-time tools for inspecting standard R source-package directories or `.tar.gz` archives and
producing deterministic, JSON-serializable NativR package artifacts.

```sh
nativr-package inspect ./mypackage
nativr-package pack ./mypackage --output mypackage.nativr.json
nativr-package install pkgconfig --output packages.json
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
`utils::data()` can load package `data/*.R`, `.csv`, `.tab`, `.txt`, `.rda`, and `.RData` entries;
the namespace loader installs XDR/gzip `R/sysdata.rda` before evaluating R source. Unsupported
serialized graph types/compressors and installed `.rdx`/`.rdb` lazy-load databases remain explicit
compatibility boundaries.

`install` resolves `Depends` and `Imports` from a CRAN-like source repository and emits an
integrity-locked package set. `pack` accepts only an install surface that can be represented safely.
It rejects native code, JVM code, symbolic links, installation hooks, unsafe archive paths,
`LinkingTo`, `useDynLib`, and unsupported NAMESPACE directives. A successful package artifact is
still marked `execution: "unchecked"` until NativR loads it and package-specific executable tests
pass.
