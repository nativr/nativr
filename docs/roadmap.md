# Roadmap

## Milestone 0 — foundation

The Worker-first vertical slice, normalized parser, typed vectors, missingness, closures, promises,
reference operators, playground, packaging, and conformance system.

## Recommended next: evidence-ranked core collections and selection

The current [package-usage snapshot](feature-priorities.md) puts extraction, sequences, subsetting,
lists, conditionals, and comparisons at the top of the measured feature gaps. Implement them in
dependency order:

1. sequences/repetition, lists, and names;
2. comparison and three-valued logical operators;
3. `[[`, `$`, and `[`;
4. `if`, `return`, then bounded loops.

This is the next complete vertical slice. Each semantic addition must update conformance evidence,
the compatibility contract, and the capability manifest.

## Evidence-ranked follow-ons

1. Vector productivity: strings, deterministic RNG/sampling, dimensions, matrices/arrays, and
   high-reach descriptive statistics.
2. Structured data: replacement assignment, data frames, factors, ellipsis, apply/map, and explicit
   CSV/JSON host adapters.
3. Modeling: formula/model-frame IR, linear algebra interfaces, and an `lm` subset.
4. Adapter SDK: versioned R-facing JavaScript adapters; never arbitrary CRAN installation.
5. Shared table IR with optional Arrow or DuckDB-Wasm backends.
6. Declarative visualization adapters and optional browser-native ML backends.
7. Evidence-driven scientific operators, then a signed adapter registry and compatibility dashboard.

DuckDB, Arrow, Vega, ONNX, TensorFlow.js, WebGPU, and domain adapters remain out of core.
