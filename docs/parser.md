# Parser and grammar assets

NativR pins:

- `web-tree-sitter` 0.26.11 (MIT)
- `@davisvaughan/tree-sitter-r` 1.3.0 (MIT), from <https://github.com/r-lib/tree-sitter-r>
- `tree-sitter-cli` 0.26.11

`pnpm grammar:build` compiles the installed grammar source with the pinned CLI and WASI SDK, copies
the web runtime Wasm, preserves licenses, writes SHA-256 hashes to
`packages/parser/assets/manifest.json`, and performs an ABI parse smoke test.

Tree-sitter concrete nodes never cross the parser boundary. They are converted to a normalized
NativR AST with source spans and structured `NRP` diagnostics. The web-tree-sitter JavaScript string
callback currently reports UTF-16 indices; `Utf8SourceMap` also implements byte-to-UTF-16 conversion
for byte-oriented callbacks and has a Unicode test.

Complete top-level expressions before a trailing grammar error remain available in the normalized
program so `parse(text=, n=)` can stop at the requested boundary. Ordinary source evaluation still
rejects any error diagnostic. Recovery nodes and Tree-sitter objects never cross the parser facade.

Ordinary user-defined `%name%` infix syntax normalizes to an owned call expression, allowing
bindings such as `%o%` and user closures to use normal callable lookup. The built-in `%%`, `%/%`,
and `%in%` operators retain their explicit normalized binary forms, and pipe forms retain their
separate rewrite path.

The browser bundle applies a reviewed build-time patch to two generic Emscripten EM_ASM/EM_JS
fallbacks in web-tree-sitter. NativR's pinned R grammar exports neither facility, so the runtime
does not need dynamic code generation. The build fails if the reviewed upstream source shape
changes.
