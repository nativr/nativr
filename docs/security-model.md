# Security model

Evaluated R source can access only installed runtime values and builtins. It has no binding for
`window`, `document`, `globalThis`, fetch, storage, filesystem APIs, the host process environment,
module loading, arbitrary host functions, or network sockets. `createR({ environmentVariables })`
may admit an explicit string map into one evaluator-owned session; `Sys.getenv()`, `Sys.setenv()`,
and `Sys.unsetenv()` can inspect or mutate only that map, and reset restores the construction-time
snapshot. The bootstrap runtime emits no telemetry and performs no evaluation-time network request.

NativR interprets normalized AST nodes. It does not generate JavaScript or call
`eval`/`new Function`. A build-time CSP guard removes generic Emscripten EM_ASM/EM_JS dynamic-code
fallbacks from the pinned web-tree-sitter browser bundle and the browser audit rejects their
reappearance. Inline Node tests use the upstream module, but the dormant fallback is not reached by
the pinned grammar.

Function debugging reuses only the explicit `createR({ readline })` string exchange. Debug marks
remain evaluator-local weak object-identity state, prompts and traces are charged to the ordinary
output limit, and the current command parser accepts only a fixed next/continue/finish/Q vocabulary;
it does not execute host JavaScript or arbitrary generated code.

Internal names live in `Map`; public output uses arrays and typed snapshots. No untrusted name is
assigned to an ordinary JavaScript prototype-bearing record. Resource limits and Worker termination
reduce accidental hangs. NativR does not claim a formally verified hostile-code sandbox; host
applications should retain origin isolation and browser security controls.

Nested `capture.output()` frames retain selected textual events only in evaluator-owned memory and
enforce the same byte ceiling before constructing a result vector or writing a supported virtual
target. File-connection targets resolve only through the evaluator's opaque session map, so capture
cannot become an implicit filesystem escape.

`tempdir()`, `tempfile()`, `file()`, `gzcon()`, `file.exists()`, `file.remove()`, `readChar()`, line
I/O, `cat()`, `capture.output()`, `dput()`, `dget()`, and `unlink()` expose only opaque
session-memory or immutable package paths. The mutable file/connection maps are owned by the
evaluator, cleared on reset/disposal, limited by output-byte and vector budgets, and never resolve a
path through browser or operating-system APIs. Connection records use object identity as well as an
integer slot, so user-constructed classed integers cannot forge a live handle. `dget()` can parse
only text previously produced by the same session's bounded serializer. `readLines()` and read-only
connections may additionally decode reviewed package-bundle bytes; `gzcon()` admits only bytes
already reachable through such a handle, bounds both compressed and decompressed representations,
and uses browser-standard streams. Package writes and host paths are rejected before lookup.
`file.remove()` deletes only closed ordinary session files; it cannot remove an open connection,
directory, runtime/package resource, or anything resolved outside the owned virtual roots.
`readChar()` can consume only a supplied raw vector or bytes already admitted to those roots and
connection records; it cannot resolve a host path or initiate a network request without the existing
explicit URL capability.

GNU R XDR serialization is decoded directly from raw vectors or the same closed virtual-file
capability set. Input bytes, decompressed bytes, nesting, vector lengths, references, and result
allocation are bounded before use. Gzip uses browser-standard streams; unsupported compression,
native-endian/ASCII streams, graph types, and malformed references fail without falling through to
host libraries. Package `.rda` and `R/sysdata.rda` bytes are immutable reviewed bundle resources.

Character encoding metadata is evaluator-owned data, not authority to invoke a host codec or read
locale state. Exact stored bytes and four canonical marks are length-bounded with their vector;
conversion uses deterministic in-process UTF-8/Latin-1 rules and never falls through to `iconv`, an
operating-system API, or a network service.

Directory operations use the same closed capability set. Session, package, and runtime roots are
recognized structurally; `.` and `..` are normalized with an explicit no-root-escape check; and the
working directory is always one of those owned directories. Listing cannot discover host names,
package/runtime trees remain immutable, and recursive deletion is confined to the session tree.

`utils::data()` can enumerate only immutable resources already admitted to the session package
catalog. Package `.R` data scripts pass through Tree-sitter and the normalized evaluator under the
same call, step, allocation, and output budgets as all other R code. Delimited table readers and
writers use an owned bounded scanner over inline text or those same virtual paths/connections; they
do not call browser CSV libraries, resolve URLs, or acquire filesystem capabilities. Initially
closed connection handles are destroyed after a table operation, preventing leaked implicit state.

`utils::demo()` does not probe installed R libraries, execute package scripts, start servers, or
perform network access. Its current empty catalog does not yet discover or execute the validated
resources available through the separate browser-safe package layer.

`utils::example()` reads only the generated example manifest already admitted in a validated package
bundle. Rd parsing happens in the bounded Node build tool; the Worker parses the selected extracted
R source into the normalized AST and evaluates it under ordinary runtime limits. It cannot scan host
R libraries, open help databases, fetch documentation, or make skipped `\\dontrun`/`\\donttest` code
executable unless the caller explicitly opts in.

Graphics use typed, device-independent records rather than exposing a DOM or Canvas object to R
code. Raster RGBA bytes share the evaluation output budget and are transferred out of the Worker;
legend labels remain inert strings rather than HTML, segment and legend payloads share the same
budget, and the runtime cannot read pixels back from the host renderer.

PNG output does not grant a Canvas, DOM, download, or host-file capability. The Worker rasterizes
only validated graphics records into a freshly allocated bounded RGBA buffer, emits fixed PNG chunk
types with independently computed checksums, compresses inert bytes, and writes only to a normalized
session path. Pixel count and encoded size are checked against runtime limits; raw `readBin()` can
read owned bytes but cannot resolve a host path or mutate immutable package resources.

`@nativr/package-tools` is a Node-only build tool and is not reachable from evaluated R. It bounds
repository responses, archive entries, path depth, file counts, per-file bytes, total bytes, and
dependency count; rejects links, special files, traversal paths, native code, and install hooks;
checks repository-provided source-package digests when present; and emits its own SHA-256 artifact
digest. Package archives are extracted only into a fresh temporary directory and removed after
inspection. Applications should retain the generated package set as a reviewed build artifact; the
browser runtime neither downloads nor unpacks source packages.

`browseURL()` grants no navigation capability. It records a bounded request only after explicit R
code calls it. External URLs are never resolved or fetched, and virtual-file requests contain a
fresh byte snapshot rather than a filesystem handle. Embedding hosts must allow-list schemes and
origins, render links with `noopener`/`noreferrer`, and normally require a user gesture. The
Playground permits user-clicked HTTP(S) targets, renders owned files in a script-disabled sandboxed
iframe, and renders other schemes as review-only; it never evaluates URL text as JavaScript or opens
a request automatically.

`system()` grants no process capability unless the application supplies `systemCommand`. The runtime
validates and copies a data-only request; Worker transport correlates one data-only result; and
returned text is charged to the normal output budget. No command is parsed, searched, or run by
NativR. Hosts must use an exact allow-list, avoid ambient credentials and inherited environment,
bound stdout/stderr and execution time, reject shell metacharacter composition unless deliberately
supported, and treat package-provided command text as untrusted input. The Playground handler is a
single virtual echo command and never touches an operating-system process.

`readline()` grants only a construction-time, line-oriented callback when the application supplies
`readline`. The Worker sends inert prompt text and accepts one validated string result; R code never
receives a DOM handle or arbitrary JavaScript function. Hosts must treat package prompts as
untrusted display text, avoid rendering them as HTML, bound or cancel their UI, and return no
secrets unless the calling R code is trusted. Newlines, NUL characters, and results beyond the
session output-byte budget are rejected. The default runtime never opens a dialog or reads stdin.

`url()` is likewise inert unless the application supplies `createR({ url })`. The callback receives
only copied URL/method/header data and must return a `Uint8Array`; the facade copies and charges the
bytes to the session output limit before the Worker can expose them to R. NativR does not call
`fetch`, follow redirects, attach cookies, consult ambient credentials, or choose trusted origins.
Hosts must allow-list schemes and origins, validate redirect targets, bound response time and size,
and avoid forwarding secrets to package-selected destinations. The Playground adapter serves one
embedded allow-listed fixture and performs no network request.

PNG and PDF output is encoded from the bounded NativR graphics journal into the session-owned
virtual file store. The encoders do not invoke native libraries, load fonts, read host files, fetch
resources, evaluate generated code, or expose DOM objects. Raster dimensions, journal growth,
compression work, and final bytes remain subject to evaluator limits; applications must still treat
package-selected filenames and rendered document content as untrusted data when exporting it.

`file.create()` grants no host-filesystem capability. It resolves relative and absolute virtual
identifiers through the owned-path normalizer and mutates only descendants of the session-temp root;
host, runtime, and package paths return bounded failures. Filename vectors are validated and file
count limits are checked before mutation, preventing invalid later arguments or resource overflow
from leaving a partially created batch.

`stats::ts.plot()` grants no DOM, Canvas, device, or package-specific callback capability. It aligns
finite evaluator-owned observations under the normal vector/allocation limits and emits only the
existing bounded, data-only graphics events. Worker hosts receive the same events as any other plot;
labels and package-supplied style strings remain untrusted display content, never HTML or executable
code. Large union ranges fail before a page or partial series is emitted.

Dependencies are locked, build scripts are explicitly approved in `pnpm-workspace.yaml`, browser
bundles are audited for Node built-ins/dynamic code, and CI includes CodeQL and Dependabot.
