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

## Offline original-package evidence

`pnpm evidence:packages` captures the pinned abind/numDeriv development/regression pair with the
original package entrypoints. Complete the serial production build and its verification first; keep
source, dist, tooling and input files unchanged throughout the run. The command never builds,
downloads, changes corpus tiers or selects the holdout. Hashing source and dist verifies stability
during execution; it cannot establish that stale dist was compiled from current source.

```text
pnpm evidence:packages -- --archive-dir CACHED_ARCHIVE_DIRECTORY --rscript PATH_TO_RSCRIPT --baseline-profile 0.388.0 --output .tmp/package-preflight
pnpm evidence:packages -- --run --archive-dir CACHED_ARCHIVE_DIRECTORY --rscript PATH_TO_RSCRIPT --baseline-profile 0.388.0 --output .tmp/package-evidence
```

All paths resolve relative to this repository unless absolute. Supply an existing oracle executable
file and a new output directory inside the repository. Preflight hashes cached inputs and checks
prerequisites; it does not execute R or the runtime. `--run` validates the built capability
manifest, GNU R 4.6.1, archive/artifact pins, all fifteen stages and exact test/example input hashes
against the selected maintained baseline. Both packages use the existing package-test limits,
explicit RNG seed 20261016 and repeated native observations. Native package-version normalization
does not relax the exact archive or package pins.

Wrapper exit zero means both complete reports were captured and validated with stable artifacts. A
package may still fail compatibility: the wrapper accepts a checker exit of one only with a valid
complete non-P7 report and explicit blocker. Missing/truncated evidence, contradictory P7 claims,
unexpected exits, changed inputs and runner-substitution markers fail validation. An assisted runner
cannot be projected into this original-report format.

Publishable output contains `abind.json`, `numDeriv.json` and `index.json`, with allowlisted
metadata, counts and digests. Raw reports stay under gitignored `.tmp/package-evidence-raw/`; child
output is bounded, hashed and discarded. Raw/output overlap and link/junction ancestors are
rejected. Do not upload the quarantine. Failed runs retain safe partial evidence and an explicitly
failed index; reusing an output directory is rejected. Native observations remain advisory pending
RFC-0007.

The owned fixture and subprocess tests run in `pnpm check` without R or external archives. On an
unrestricted verification host, `NATIVR_PROCESS_TEST_REQUIRE_TREE_CLEANUP=1` additionally requires
successful process-tree termination. Restricted hosts may report a controlled termination failure;
that failure never becomes valid package evidence. Executable package runs are opt-in.

Do not add shell-specific npm scripts. Browser packages must remain ESM-only and free of Node
built-ins. Semantic work requires tests, a conformance case, capability changes, and accurate docs.
