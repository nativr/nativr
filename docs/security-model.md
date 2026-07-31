# Security model

Evaluated R source can access only installed runtime values and builtins. It has no binding for
`window`, `document`, `globalThis`, fetch, storage, filesystem APIs, environment variables, module
loading, arbitrary host functions, or network sockets. The bootstrap runtime emits no telemetry and
performs no evaluation-time network request.

NativR interprets normalized AST nodes. It does not generate JavaScript or call
`eval`/`new Function`. A build-time CSP guard removes generic Emscripten EM_ASM/EM_JS dynamic-code
fallbacks from the pinned web-tree-sitter browser bundle and the browser audit rejects their
reappearance. Inline Node tests use the upstream module, but the dormant fallback is not reached by
the pinned grammar.

Internal names live in `Map`; public output uses arrays and typed snapshots. No untrusted name is
assigned to an ordinary JavaScript prototype-bearing record. Resource limits and Worker termination
reduce accidental hangs. NativR does not claim a formally verified hostile-code sandbox; host
applications should retain origin isolation and browser security controls.

Nested `capture.output()` frames retain selected textual events only in evaluator-owned memory and
enforce the same byte ceiling before constructing the result vector. Its `file` and connection forms
are explicit unsupported errors, so capture cannot become an implicit filesystem escape.

`tempfile()`, `dput()`, `dget()`, and `unlink()` expose only opaque session-memory paths. The map is
owned by the evaluator, cleared on reset/disposal, limited by the output-byte and vector budgets,
and never resolves a path through browser or operating-system APIs. `dget()` can parse only text
previously produced by the same session's bounded serializer; host paths and connections are
rejected before lookup.

`utils::demo()` does not probe installed R libraries, execute package scripts, start servers, or
perform network access. Only the empty owned catalog shape is available until package resources can
be validated and loaded through an explicit browser-safe package layer.

Graphics use typed, device-independent records rather than exposing a DOM or Canvas object to R
code. Raster RGBA bytes share the evaluation output budget and are transferred out of the Worker;
legend labels remain inert strings rather than HTML, segment and legend payloads share the same
budget, and the runtime cannot read pixels back from the host renderer.

`@nativr/package-tools` is a Node-only build tool and is not reachable from evaluated R. It bounds
repository responses, archive entries, path depth, file counts, per-file bytes, total bytes, and
dependency count; rejects links, special files, traversal paths, native code, and install hooks;
checks repository-provided source-package digests when present; and emits its own SHA-256 artifact
digest. Package archives are extracted only into a fresh temporary directory and removed after
inspection. Applications should retain the generated package set as a reviewed build artifact; the
browser runtime neither downloads nor unpacks source packages.

Dependencies are locked, build scripts are explicitly approved in `pnpm-workspace.yaml`, browser
bundles are audited for Node built-ins/dynamic code, and CI includes CodeQL and Dependabot.
