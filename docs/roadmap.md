# Roadmap

## Milestone 0 — foundation

The Worker-first vertical slice, normalized parser, typed vectors, missingness, closures, promises,
reference operators, playground, packaging, and conformance system.

## Recommended next: core control and indexing

Add three-valued logical operators, `if`, `return`, bounded loops, lists, names, `[`, `[[`, `$`,
sequences, and richer exact argument matching without changing the current value model.

## Later milestones

1. Structured data: factors, dimensions, matrices, data frames, and explicit CSV/JSON host adapters.
2. Modeling: formula/model-frame IR, linear algebra interfaces, deterministic RNG, `lm` subset.
3. Adapter SDK: versioned R-facing JavaScript adapters; never arbitrary CRAN installation.
4. Shared table IR with optional Arrow or DuckDB-Wasm backends.
5. Declarative visualization adapters and optional browser-native ML backends.
6. Evidence-driven scientific operators, then a signed adapter registry and compatibility dashboard.

DuckDB, Arrow, Vega, ONNX, TensorFlow.js, WebGPU, and domain adapters remain out of core.
