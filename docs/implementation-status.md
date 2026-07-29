# Implementation status

Date: 2026-07-28

## Implemented

- Empty directory initialized as a local Git repository and pnpm monorepo.
- Node 24/pnpm 11 policy, strict TypeScript, ESM packages, build-script allowlist.
- Reproducible Tree-sitter R Wasm build, hashes, licenses, and ABI smoke.
- Normalized AST, Unicode spans, diagnostics, parsed unsupported nodes.
- Typed atomic vectors, explicit NA masks, environments, closures, lazy promises, limits.
- Required arithmetic/recycling behavior and eight base builtins.
- Versioned snapshots/protocol, Worker-first and inline APIs, timeout/reset design.
- Vanilla Vite playground, checked-in conformance cases, package and browser test scaffolding.
- CSP build guard, browser-bundle audit, bundle budgets, governance, ADRs, and CI.

## Verified while implementing

- Dependencies installed with pnpm 11.17 outside Dropbox; approved tree-sitter-cli/esbuild scripts
  completed successfully.
- Tree-sitter R grammar build and ABI parse smoke: passed.
- Formatting, ESLint typed lint, package-boundary checks, strict TypeScript, and Playground
  typecheck: passed.
- Vitest coverage: 7 files and 66 tests passed; 86% statements/lines, 80.23% branches, and 95.2%
  functions.
- Production package and Playground builds: passed. Browser bundle audit passed with no Node
  built-ins, forbidden dynamic imports, or generic `eval`.
- Bundle budgets: 4.4 KiB gzip static client, 140.3 KiB gzip Worker JavaScript, and 671.9 KiB raw
  combined parser Wasm.
- Chromium end-to-end: 2/2 passed, including Worker execution, recycling warnings, TypedArray
  assignment, reset, and zero evaluation-time network requests.
- Checked-in conformance: 8/8 passed. Live black-box R 4.6 oracle: 8/8 passed.
- Packed tarball installed into a clean temporary consumer and built with Vite successfully.

The installed system Node is 20.12.2; project commands were run with the Codex-provided Node
24.14.0. Local R 4.6.0 is used only for the optional conformance oracle. Local dependency contents,
Playwright browsers, coverage, browser reports, and package-smoke workspaces remain outside Dropbox.
