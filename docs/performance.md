# Performance and bundle discipline

The JavaScript reference backend uses typed arrays and tight loops. It is a correctness baseline,
not a final optimized kernel. `pnpm benchmark` measures short parse/evaluation, scalar arithmetic,
100,000-element mean, typed assignment, and raw snapshots after a build.

Budgets:

- statically loaded public client: 150 KiB gzip;
- Worker JavaScript: 250 KiB gzip;
- parser Wasm assets combined: 1.5 MiB raw (stricter than the requested gzip ceiling).

The inline semantic host is a lazy chunk and is excluded from the default client budget. Parser Wasm
remains a physical asset; it is not base64-embedded. Future Wasm/WebGPU/table engines must be
optional lazy packages and are not bootstrap dependencies.
