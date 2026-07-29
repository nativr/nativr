# Development

Requirements are Node 24 and pnpm 11. This machine may have another system Node; `.nvmrc`,
`.node-version`, CI, and `package.json` define the supported baseline.

## Keep dependencies outside a synchronized source folder

Git should synchronize the repository. Dependency stores, browser binaries, and other machine-local
environment files do not belong in Dropbox, OneDrive, or another file-sync service. If the checkout
itself must live in a synchronized folder, create a local `node_modules` link before installing:

```text
node scripts/setup-local-dependencies.mjs
pnpm install --frozen-lockfile
```

The helper uses the operating system's local cache directory and creates only a Git-ignored
directory link in the repository. Set `NATIVR_LOCAL_DEPS_DIR` to an absolute path to select a
different machine-local target. The pnpm content-addressable store and Playwright browser cache also
remain machine-local by default. CI should use a normal ephemeral `node_modules` directory and does
not need this helper. Local Vitest coverage, Playwright reports, browser traces, screenshots, and
package-smoke workspaces are written to the operating system's temporary directory; CI keeps its
normal repository-relative artifact paths for upload.

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
uses a local Rscript only as a black-box development oracle.

Do not add shell-specific npm scripts. Browser packages must remain ESM-only and free of Node
built-ins. Semantic work requires tests, a conformance case, capability changes, and accurate docs.
