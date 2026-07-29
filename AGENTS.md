# NativR agent guide

NativR is an independent, browser-native runtime for a documented subset of R. Preserve the vertical
path from Tree-sitter R parsing through the normalized AST and TypeScript runtime to the
Worker-first `@nativr/nativr` API.

- Never embed, link, copy from, or depend on GNU R or webR. R may be used only as an optional,
  black-box conformance oracle. Follow `docs/clean-room.md`.
- Keep production code browser-first, ESM-only, CSP-safe, network-free, and free of Node built-ins,
  `eval`, `new Function`, or generated JavaScript execution.
- Preserve dependency direction: `ast` is independent; `parser -> ast`; `runtime -> ast`;
  `base -> runtime + ast`; `protocol` is wire-only; `nativr` composes them; the playground imports
  only `@nativr/nativr`.
- Run `pnpm check` for semantic changes and `pnpm test:e2e` for Worker or playground changes.
- Update conformance cases, `docs/compatibility-contract.md`, and the capability manifest whenever
  semantics change. Never claim compatibility without executable evidence.
- Architecture, parser, runtime, public API, security, and performance details live under `docs/`.
- Do not publish, push, add a remote, or commit unless the user explicitly requests it.
