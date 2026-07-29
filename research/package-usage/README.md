# Package-usage research data

This directory contains the aggregate evidence behind
[`docs/feature-priorities.md`](../../docs/feature-priorities.md):

- `snapshot.json`: source window, package download counts, package-level feature flags, and
  aggregate reach;
- `package-downloads.csv`: review-friendly package table;
- `feature-reach.csv`: review-friendly feature ranking.

No R package source or reference-manual example text is stored here.

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
