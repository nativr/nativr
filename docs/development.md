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
Generated outputs are removed cross-platform by `pnpm clean`.

## Optional GNU R oracle

GNU R is used only as a local black-box development oracle. Native compatibility evidence requires
GNU R **4.6.1**. The conformance harnesses select the C locale for each isolated case; this matches
NativR's documented deterministic profile. An optional-oracle `SKIP` is not completed native
evidence. Windows observations remain advisory pending the separately authorized RFC-0007 Linux
gate.

The native conformance commands and package checker share executable selection:

1. An explicit `--rscript PATH` wins, followed by `NATIVR_RSCRIPT` when configured. A bad or empty
   override fails; it never falls back to another installation or becomes an optional skip.
2. Otherwise, try `Rscript` on PATH.
3. On Windows, try installations under `%LOCALAPPDATA%\Programs\R`, then `%ProgramFiles%\R`. If
   LOCALAPPDATA is absent, use `%USERPROFILE%\AppData\Local`. Installation directory names are tried
   in descending natural order, and each executable is checked with bounded `--version`.
4. If automatic discovery finds nothing, native conformance reports an explicit optional skip.
   Package checking requires an oracle and fails before archive preparation.

```text
pnpm conformance:r -- --rscript "PATH_TO_RSCRIPT"
pnpm conformance:r:v2 -- --rscript "PATH_TO_RSCRIPT"
pnpm package:check --package NAME --source CACHED_ARCHIVE --output REPORT.json --rscript "PATH_TO_RSCRIPT"
```

`NATIVR_RSCRIPT` is the reusable alternative to the command-line option. Executable availability
does not establish the required R version: both conformance commands retain their exact 4.6.1 gate.
Their existing `NATIVR_ALLOW_NON_NORMATIVE_R=1` option is only for advisory investigation. It does
not relax the package oracle's version requirement or establish release compatibility. Surface
metadata collectors have their own existing interfaces and are outside this three-command contract.
No command here authorizes a download; use previously approved cached inputs when downloads are
restricted. Ordinary development and `pnpm check` do not require GNU R.

Do not add shell-specific npm scripts. Browser packages must remain ESM-only and free of Node
built-ins. Semantic work requires tests, a conformance case, capability changes, and accurate docs.
