# Evidence-based feature priorities

NativR uses public package-usage evidence to decide which language gaps to close first. The current
snapshot covers the 100 most-downloaded packages reported by [cranlogs](https://cranlogs.r-pkg.org/)
for the 30 available days from 2026-06-28 through 2026-07-27.

This evidence guides NativR core-language sequencing. It does not promise compatibility with the
sampled packages, and it does not change the rule that arbitrary R package installation remains out
of scope.

## Package sample

![Top 20 CRAN package downloads in the sampled window](figures/package-downloads.svg)

The 100-package sample represents 123,957,146 downloads from the RStudio CRAN mirror. Ninety-seven
CRAN reference manuals contained analyzable `Examples` sections, covering 120,247,607 downloads, or
97.0% of the sampled total. Download counts include direct installs, dependency installs, automated
systems, and repeated installs; they are not unique-user counts.

## Feature-gap reach

![R feature gaps ranked by documented usage](figures/feature-priority.svg)

The primary measure is download-weighted package reach: the share of analyzable downloads belonging
to packages whose reference-manual examples contain a feature. Package reach is the unweighted share
of the 97 analyzable packages. A package contributes at most once to each feature, so a long manual
cannot dominate the result merely by repeating an operator.

| Rank | Feature gap                         | Current status | Weighted reach | Package reach |
| ---: | ----------------------------------- | -------------- | -------------: | ------------: |
|    1 | element/member extraction `[[`, `$` | parsed         |          69.1% |         68.0% |
|    2 | sequences and repetition            | unsupported    |          69.0% |         64.9% |
|    3 | vector/list subsetting `[`          | parsed         |          62.4% |         57.7% |
|    4 | lists                               | unsupported    |          61.4% |         58.8% |
|    5 | namespace access                    | parsed         |          61.0% |         56.7% |
|    6 | `if` / `else`                       | parsed         |          50.6% |         47.4% |
|    7 | random numbers and sampling         | unsupported    |          44.4% |         41.2% |
|    8 | string helpers                      | unsupported    |          44.0% |         40.2% |
|    9 | comparison operators                | unsupported    |          43.1% |         40.2% |
|   10 | matrices, arrays, and dimensions    | unsupported    |          42.8% |         41.2% |
|   11 | names and attributes                | unsupported    |          39.8% |         38.1% |
|   12 | descriptive statistics              | partial        |          33.7% |         30.9% |
|   13 | logical operators                   | partial        |          32.2% |         28.9% |
|   14 | data frames                         | unsupported    |          30.8% |         27.8% |
|   15 | replacement assignment              | unsupported    |          29.1% |         24.7% |

`parsed` means the normalized AST preserves the syntax but evaluation returns an explicit
unsupported-feature error. `partial` means NativR implements only a documented subset of the feature
group.

## Implementation order

Frequency is the primary signal, then dependency order and NativR's browser-first architecture break
ties:

1. **Core collections and selection:** sequences/repetition, lists, names, comparison and logical
   operators, then `[[`, `$`, and `[`. Collections must exist before extraction can return useful
   values.
2. **Control flow:** evaluate `if` / `else` and `return` on top of three-valued logical semantics.
   Add bounded loops after the same control-flow machinery is stable.
3. **Vector productivity:** string helpers, deterministic RNG and sampling, dimensions,
   matrices/arrays, and the most frequent descriptive statistics.
4. **Structured data:** data frames, replacement assignment, factors, ellipsis, and the apply/map
   family.
5. **Higher-level language forms:** formulas and pipes remain behind their value-model and dispatch
   prerequisites even when parsing already exists.

Namespace syntax has high measured reach, but it is not an instruction to add a general CRAN package
loader. Runtime namespace dispatch belongs with the later signed adapter registry.

## Method

`pnpm research:usage:collect` performs a networked refresh:

1. Fetch the cranlogs `top/last-month/100` aggregate. The service documents `last-month` as the last
   30 available days and identifies the RStudio CRAN mirror as its source.
2. Fetch the CRAN-generated HTML reference manual for every sampled package.
3. Extract only `Examples` code blocks, remove comments and string contents, and apply the
   independently written feature detector in `scripts/package-usage.mjs`.
4. Discard the example text. Commit only package-level feature flags, aggregate counts, CSV tables,
   and generated SVG figures.

`pnpm research:usage:render` regenerates the CSV and SVG artifacts offline from the committed
snapshot. `pnpm research:usage:check` prevents those artifacts from drifting from the snapshot.

The committed inputs and outputs are under [`research/package-usage`](../research/package-usage/).
The API behavior is documented by the
[cranlogs application repository](https://github.com/r-hub/cranlogs.app#web-api-docs), and package
manuals come from the [CRAN package repository](https://cran.r-project.org/web/packages/).

## Limitations

- The sample covers one mirror and the top 100 packages, not the entire R ecosystem.
- Download popularity includes dependency and automation effects and does not measure active users.
- Documentation examples are a public-API usage proxy, not production-code telemetry.
- Lexical feature groups can produce false positives or miss indirect use.
- A high-reach feature may still depend on lower-level work or conflict with core scope.

Refresh this snapshot before a major roadmap revision and compare multiple snapshots before treating
small rank changes as a trend.
