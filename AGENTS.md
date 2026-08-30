# NativR agent guide

NativR is an independent browser-native runtime targeting versioned, browser-admissible behavioral
compatibility with GNU R 4.6.1. Preserve the vertical path from Tree-sitter R parsing through the
normalized AST and TypeScript runtime to the Worker-first `@nativr/nativr` API.

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
- Prioritize semantic closure and recursive Oracle v2 evidence over callable counts. Add an isolated
  callable only when it closes a named semantic-domain gap or unblocks a pinned corpus package
  through a reusable primitive.
- Treat package compatibility as a P0-P7 tier with an explicit first blocker. Preserve separate
  development, regression, and holdout partitions in `compatibility/package-corpus.json`.
- Architecture, parser, runtime, public API, security, and performance details live under `docs/`.
- Do not publish, push, add a remote, or commit unless the user explicitly requests it.
- Never add authorship or identity-attribution trailers (`Co-authored-by`, `Signed-off-by`,
  `Reviewed-by`, `Acked-by`, or `Tested-by`) for Codex, ChatGPT, Copilot, another AI agent, or a
  bot. When the user explicitly requests a commit, retain an identity approved in
  `.github/human-authors.json`; do not replace it with an automation identity.
- Dependency and release automation may report or validate changes, but it must not author version,
  dependency-update, merge, or other commits. Version and dependency-update commits must be made
  under a verified human identity and reach `main` through a pull request.
