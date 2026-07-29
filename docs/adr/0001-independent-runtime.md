# ADR 0001: Independent runtime

- Status: accepted
- Date: 2026-07-28

## Context

Browser execution could embed GNU R/WebAssembly or implement documented behavior independently.

## Decision

Implement an independent TypeScript/JavaScript runtime and never ship GNU R, webR, or a remote/local
R fallback.

## Alternatives considered

GNU R in Wasm, webR wrapping, server-side R, and source-to-JavaScript transpilation.

## Consequences

Compatibility must grow slowly with explicit evidence, but the runtime remains browser-native,
permissively licensed, inspectable, and able to use web platform backends.
