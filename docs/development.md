# Development

Requirements are Node 24 and pnpm 11. This machine may have another system Node; `.nvmrc`,
`.node-version`, CI, and `package.json` define the supported baseline.

## Verification

```text
pnpm install
pnpm grammar:build
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm size
pnpm pack:smoke
pnpm test:e2e
pnpm conformance
```

`pnpm dev` builds required package and parser assets, then serves the vanilla Vite playground.
Generated outputs are removed cross-platform by `pnpm clean`. `pnpm conformance:r` is optional and
uses a local Rscript only as a black-box development oracle. The harness selects the C locale before
each isolated case so locale-sensitive evidence matches NativR's documented deterministic profile.

Do not add shell-specific npm scripts. Browser packages must remain ESM-only and free of Node
built-ins. Semantic work requires tests, a conformance case, capability changes, and accurate docs.
