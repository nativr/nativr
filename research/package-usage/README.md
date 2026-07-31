# Package-usage research data

This directory contains the aggregate evidence behind
[`docs/feature-priorities.md`](../../docs/feature-priorities.md):

- `snapshot.json`: source window, package download counts, package-level feature flags, aggregate
  feature reach, and aggregate GNU R core callable counts;
- `package-downloads.csv`: review-friendly package table;
- `feature-reach.csv`: review-friendly feature ranking;
- `core-callable-reach.csv`: named GNU R core call frequency, reach, and current NativR registry
  status.

No R package source or reference-manual example text is stored here. The callable table is filtered
through the clean-room black-box inventory in `compatibility/gnu-r/surface.json`; direct calls to a
function assigned earlier in the same example block are excluded as local helpers.

Refresh the networked snapshot and all derived artifacts:

```text
pnpm research:usage
```

Regenerate CSV and SVG files without network access:

```text
pnpm research:usage:render
```

Verify that committed artifacts match the snapshot:

```text
pnpm research:usage:check
```

Review source-window changes, missing manuals, detector changes, and large ranking movements before
committing a refresh.
