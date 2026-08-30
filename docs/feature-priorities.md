# Evidence-based feature priorities

NativR uses public package-usage evidence to sequence core-language work. The current snapshot
covers the 100 most-downloaded packages reported by [cranlogs](https://cranlogs.r-pkg.org/) for the
30 available days from 2026-06-30 through 2026-07-29.

This evidence guides NativR's browser-native subset. It does not promise compatibility with the
sampled packages. Standard pure-R source packages can enter the bounded build-time installer, while
actual execution remains limited by the measured runtime capabilities each package uses.

## Package sample

![Top 20 CRAN package downloads in the sampled window](figures/package-downloads.svg)

The 100-package sample represents 127,485,250 downloads from the RStudio CRAN mirror. Ninety-seven
CRAN reference manuals contained analyzable `Examples` sections, covering 123,672,820 downloads, or
97.0% of the sampled total. Counts include direct installs, dependency installs, automation, and
repeat installs; they are not unique-user counts.

## Feature reach and implementation status

![R feature reach ranked by documented usage, with NativR support status](figures/feature-priority.svg)

The primary measure is download-weighted package reach: the share of analyzable downloads belonging
to packages whose manual examples contain a feature. Package reach is the unweighted share of the 97
analyzable packages. A package contributes at most once per feature.

| Rank | Measured feature                    | Status    | Weighted reach | Package reach |
| ---: | ----------------------------------- | --------- | -------------: | ------------: |
|    1 | element/member extraction `[[`, `$` | supported |          69.1% |         68.0% |
|    2 | sequences and repetition            | supported |          69.0% |         64.9% |
|    3 | vector/list subsetting `[`          | supported |          62.3% |         57.7% |
|    4 | lists                               | supported |          61.4% |         58.8% |
|    5 | namespace access                    | supported |          61.0% |         56.7% |
|    6 | `if` / `else`                       | supported |          50.6% |         47.4% |
|    7 | random numbers and sampling         | supported |          44.4% |         41.2% |
|    8 | string helpers                      | supported |          44.0% |         40.2% |
|    9 | comparison operators                | supported |          43.1% |         40.2% |
|   10 | matrices, arrays, and dimensions    | supported |          42.8% |         41.2% |
|   11 | names and attributes                | supported |          39.8% |         38.1% |
|   12 | descriptive statistics              | supported |          33.6% |         30.9% |
|   13 | logical operators                   | supported |          32.2% |         28.9% |
|   14 | data frames                         | supported |          30.8% |         27.8% |
|   15 | replacement assignment              | supported |          29.2% |         24.7% |
|   16 | dates and times                     | supported |          26.8% |         23.7% |
|   17 | apply/map family                    | supported |          26.1% |         24.7% |
|   18 | ellipsis arguments                  | supported |          24.8% |         21.6% |
|   19 | factors                             | supported |          23.6% |         20.6% |
|   20 | `for` / `while` / `repeat`          | supported |          21.9% |         19.6% |
|   21 | formulas                            | supported |          20.6% |         19.6% |
|   22 | sorting and matching                | supported |          13.4% |         12.4% |
|   23 | native and magrittr pipes           | supported |          13.4% |         11.3% |
|   24 | `return`                            | supported |          12.7% |         10.3% |
|   25 | S3/S4/R6/S7 object systems          | supported |          10.6% |          8.2% |

For this report, **supported** has a precise acceptance boundary: every operator or function name
recognized by the detector for that row has an executable case in
[`feature-priority.test.ts`](../packages/nativr/test/feature-priority.test.ts). The test contains 25
group cases plus an exact catalog check. Support is still bounded by the
[compatibility contract](compatibility-contract.md); it does not mean complete R/package semantics.

The committed CSV and SVG are generated from the same snapshot, so the status labels in the table,
dataset, and figure cannot be updated independently.

## Callable-level priorities

![Highest-reach GNU R core callable names not yet available in NativR](figures/core-callable-priority.svg)

The coarse feature groups are all runnable, so the collector also counts named-call syntax and
filters names through the checked-in GNU R 4.6.0 black-box callable inventory. Exact names exported
by each sampled package's official CRAN `NAMESPACE` and non-core namespace-qualified calls are
excluded; this prevents package-owned functions from being mislabeled as GNU R core requirements.
The primary ranking remains download-weighted package reach; raw occurrence counts are a secondary
signal.

| Priority | Measured rank | Callable          | Weighted reach | Packages | Observed calls |
| -------: | ------------: | ----------------- | -------------: | -------: | -------------: |
|        1 |           392 | `tracemem`        |           0.7% |        1 |              2 |
|        2 |           403 | `update.packages` |           0.7% |        1 |              1 |
|        3 |           406 | `df`              |           0.7% |        1 |              1 |
|        4 |           407 | `dist`            |           0.7% |        1 |              1 |
|        5 |           409 | `simulate`        |           0.7% |        1 |              1 |

“Not available” means absent from both the generated builtin registry and evaluator-native callable
language forms. It is still only a prioritization signal: an available name is not proof of complete
behavior. The previous leaders `library`, `require`, `requireNamespace`, `tempfile`, `unlink`,
`plot`, `Sys.sleep`, `writeLines`, `readLines`, `file`, `close`, `tempdir`, `file.exists`, `R.home`,
`dir.create`, and `list.files` now have executable browser-memory/package-bundle/graphics paths. The
remaining leaders divide across object-system inspection, browser capability adapters,
environment/process surfaces, and distributions. Dynamic caller lookup through `parent.frame` and
matrix transpose through `t` are now complete. Closure `formals` inspection (rank 135, 4.8% weighted
reach) and lazy `replicate` evaluation (rank 148, 4.5% weighted reach) are now complete as well.
Rank 188 `methods::showClass` is now complete for the four measured Rcpp/rstan class-inspection
calls, representing 2.9% download-weighted reach. The implementation reuses `setClass` and
`representation` metadata for namespace ownership, inherited slots/parents, virtual classes, known
subclasses, output capture, and invisible return behavior. An unchanged source-only package fixture
imports and exercises the same path; this is evidence for the shared S4 seam, not for Rcpp/rstan's
native components or the complete methods package. Rank 189 `utils::packageVersion` is now complete
for three calls across ggplot2 and bslib (2.9% weighted reach), together with adjacent rank 212
`getRversion`. Both reuse one component-based version representation and the immutable installed
bundle registry, including a source-only package self-version proof that does not force namespace
loading. Rank 194 `Sys.getpid` is now complete for six measured calls across ps, xfun, and promises
(2.8% weighted reach). The browser-owned positive session identity is stable across calls, reset,
and Worker replacement, distinct across concurrent facade sessions, and available unchanged inside
the source-only package fixture. It deliberately does not claim ps's native process-handle equality
or global uniqueness across independent page realms. Rank 195 `.libPaths` is now complete for six
measured calls across withr and callr (2.8% weighted reach). It owns one resettable virtual-library
order, retains only existing normalized browser directories, appends the runtime base library,
filters source-bundle discovery, accepts explicit virtual `lib.loc`, and supplies package-hook
`libname`. Unchanged `withr 3.0.3` executes and restores `with_libpaths()` through this path. Host
library discovery, startup `R_LIBS*` expansion, runtime downloads, and multiple installed versions
remain incomplete. Rank 204 `utils::vignette` is now complete for five observed calls across Rcpp
and data.table (2.4% download-weighted reach). Standard source-package `inst/doc` files are indexed
at build time; the Worker runtime lists installed or attached package catalogs and returns GNU
R-shaped topic metadata without loading GNU R, help databases, or document builders. Rcpp's native
package and data.table's compiled backend remain outside this proof; the reusable result is that any
source-only package artifact can expose its already-built documentation unchanged. Rank 205
`base::args` is now complete for three observed calls across S7 and StanHeaders (2.4%
download-weighted reach). It reconstructs closure defaults and ellipsis, documented builtin and
operator signatures, string lookup, global closure environment, `NULL` bodies, and silent
non-function boundaries. A source-only package fixture and the default Worker Playground execute the
same introspection path. This unblocks constructor/wrapper inspection; it does not claim S7's
complete object system or StanHeaders' compiled code. Rank 208 `base::registerS3method` is now
complete for two observed calls across pillar and knitr (2.4% download-weighted reach). Registered
functions may stay hidden, string method names resolve at registration time, repeated registrations
replace prior entries, and visible call-site methods retain precedence. Registries are isolated by
the generic's definition environment, include base builtins, reset with the session, and roll back
if a package `.onLoad()` fails. Source-only package and default Worker proofs exercise that
lifecycle without global implementation bindings. Delayed optional-package hooks and the broader
`methods()`/`getS3method()` inspection surface remain separate depth. Rank 209 `base::file.info` is
now complete for three observed calls across digest, data.table, and shiny (2.4% download-weighted
reach), together with `file.mode`, `file.mtime`, and `file.size`. The owned filesystem reports exact
byte sizes, directory flags, `octmode` permissions, classed timestamps, missing rows, and portable
owner columns for session files and immutable package resources. A source-only package and the
default Worker query the same metadata without host filesystem access. Native ownership, links, and
host paths remain outside the browser contract. Rank 214 `grDevices::hcl` is now complete for six
observed calls across ggplot2 and zoo (2.3% download-weighted reach). A shared polar CIE-LUV/D65
conversion covers ggplot2's 2,500-cell and 10-cell raster palettes plus zoo's opaque and translucent
event colors, with vector recycling, missing/non-finite coordinates, alpha bytes, gamut fixup, exact
formals, and invalid-range boundaries. Source-only package and default Worker proofs use the same
callable without package-specific rewrites or host color services. This is deterministic sRGB
conversion, not complete color management, ICC profiles, or every HCL palette helper. Rank 215
`graphics::axis` is now complete for all 18 measured calls across labeling, zoo, and bit64 (2.3%
download-weighted reach). Explicit or current-window linear ticks, sorted return locations,
character/numeric/no-label modes, sides 1:4, secondary axes, `tcl`, `cex.axis`, exact formals,
source-only package execution, and default Worker rendering share the existing bounded segment/text
journal. This is a reusable linear-axis primitive, not complete margin layout, collision avoidance,
plotmath, logarithmic axes, or device-identical font metrics. Ranks 221 `base::source` and 222
`base::textConnection` are now complete for rlang's two measured dynamic-trace examples (2.2%
download-weighted reach). Browser-memory character vectors become owned input connections; source
code is fully parsed before sequential evaluation in the global, caller, or explicit environment,
with GNU R-shaped final value/visibility, echo/printing, exact formals, pure-R package execution,
and default Worker evidence. Output text connections, host files, source-reference retention, abort
recovery, and byte-exact echo formatting remain separate depth. Rank 230 `base::readline` is now
complete for the two measured curl/crayon calls (2.1% download-weighted reach). A typed,
asynchronous `createR({ readline })` adapter carries single-line input through inline or Worker
execution, while the default session preserves GNU R's non-interactive prompt/empty-result shape. An
unchanged source-only package and the Playground use the same seam; browser UI, cancellation, and
secret policy remain host-owned. Rank 232 `base::url` is now complete for six calls across jsonlite
and openssl (2.1% download-weighted reach). Lazy read-only connections use an explicit bounded
inline/Worker byte adapter; `readLines`, raw `readBin`, `source`, tables, serialization, and `gzcon`
reuse the result without package-specific rewrites or ambient network access. Rank 239
`stats::filter` is now complete for the genuine zoo recursive-flow example plus convolution,
circular boundaries, multivariate series, missing values, recursive initial state, and exact
formals. The collector's second `filter` hit is a jsonlite example that has attached dplyr, so its
unqualified call is a documented lexical false positive rather than evidence for `stats::filter`;
the aggregate row remains unchanged to keep the committed snapshot reproducible. Rank 245
`utils::packageDescription` is now complete for cli's full DESCRIPTION-object call shape, selected
fields, missing fields/packages, file metadata, and exact formals. Validated bundle metadata is
retained once at install time and can be inspected without loading the package namespace; unchanged
`pkgconfig 2.0.3` and the Worker Playground exercise the same path. Rank 246 `base::stdout` is now
complete for cli's terminal selection and inspection shape, together with adjacent standard
connections and the later rank-342 `stderr` occurrence. Stable terminal handles, access summaries,
false embedded-session TTY detection, connection catalogs, pure-R package calls, and bounded Worker
stdout/stderr routing share the existing connection registry. Rank 252 `grDevices::rainbow` is now
complete for five measured calls across farver and zoo (1.8% weighted reach). The same owned HSV
conversion closes rank 262 `terrain.colors` for ggplot2's three measured calls and the adjacent
`topo.colors`/`cm.colors` family, with byte-exact palettes, alpha recycling, hue wrapping, reversal,
pure-R package calls, and GNU R 4.6 evidence. Rank 253 `graphics::rect` is now complete for sass and
zoo's three measured calls at 1.8% weighted reach. Four coordinate vectors recycle only to their
common longest length; missing/non-finite rectangles are omitted, transparent fills and borders plus
`par()` line defaults flow through the existing polygon journal, and exact formals, visibility,
record/replay, pure-R package, Worker, and Canvas paths have executable evidence. Positive hatch
density, clipping/log axes, coordinate-class conversion, and device-exact joins remain explicit
depth. Rank 256 `base::file.remove` is now complete for xfun and data.table's four measured cleanup
calls. Rank 259 `base::readChar` now runs digest and Shiny's two measured fixed-width file reads;
rank 277 `base::debug` and rank 279 `base::undebug` now run R6's measured method-instrumentation
calls through shared function-object state and the existing Worker readline seam. Rank 281
`grDevices::pdf` now covers knitr's recording device and data.table's file-backed plot. Rank 287
`base::file.create` now covers withr's deferred-cleanup setup. Rank 292 `stats::ts.plot` now runs
magrittr's measured exposition-pipe example. Rank 293 `base::Sys.which` now covers the two measured
knitr/sys executable-presence checks through an explicit session allow-list. Rank 311
`download.file` uses the byte URL seam; rank 313 `pipe` now reuses the explicit command seam and
private connection store; rank 314 `unz` now supplies bounded stored/DEFLATE package and session
ZIP-member connections. Rank 324 `object.size` now supplies deterministic owned-object accounting
for data.table and bit64. Rank 328 `title` now supplies shared plot annotations for all seven
measured Shiny/bit64 calls, including unchanged pure-R package and Worker rendering paths; rank 330
`sink` now supplies persistent output/message diversions for utf8's two measured calls; rank 338
`write` now runs sass's measured source-file write; rank 340 `available.packages` now runs curl's
measured repository query; rank 343 `barplot` now runs zoo and bit64's measured vector/matrix calls;
rank 344 `devAskNewPage` now runs RColorBrewer's ten measured page controls; rank 345
`getLoadedDLLs` now runs ps's measured module-path probe over a truthful empty-by-default browser
registry; rank 346 `socketConnection` now runs through a typed, default-deny duplex host adapter;
rank 348 `file.copy` now stages exact package resources into session paths; rank 349 `find.package`
now resolves core and pure-R package roots; rank 351 `l10n_info` now reports browser UTF-8
capability; rank 353 `shQuote` now quotes Unix and explicit Windows shell arguments without
executing a host shell; rank 357 `system2` now sends structured process intent only through an
explicit host policy; rank 358 `.Call` now uses the explicit typed native/Wasm adapter. Rank 144
`Encoding` is also complete for all 12 observed calls across rlang, utf8, and xfun (4.5% weighted
reach), together with adjacent `Encoding<-`, `enc2utf8`, and `enc2native`. The shared character
representation preserves exact bytes and canonical R marks through subset/replacement,
concatenation, raw conversion, and XDR serialization; this is reusable package infrastructure, not
an assertion that those packages' native components are supported. Rank 149 `rcauchy` is now
complete for four calls across ggplot2, pillar, and purrr (4.2% weighted reach), together with
`dcauchy`, `pcauchy`, and `qcauchy`. The shared distribution path covers seeded random-stream
consumption, vectorized parameters, stable probability tails, formals, and missing/domain behavior
without package-specific rewrites. Rank 162 `Sys.getenv` is now available for all 16 measured calls
across withr, xfun, and pkgbuild (3.7% weighted reach), together with rank 175 `Sys.setenv` across
xfun, memoise, openssl, and zoo (3.3%) and adjacent `Sys.unsetenv`. The shared session-state path is
Worker-safe, resettable, and sufficient for unchanged `withr::with_envvar()` mutation/restoration;
it does not expose the host environment. Rank 163 `image` is now available for the six measured
calls across scales, viridisLite, and RColorBrewer (3.7% weighted reach). Its reusable S3/default
path covers numeric/logical matrices, center or boundary coordinates, regular raster and irregular
polygon grids, colour intervals, missing transparency, and one-row palette strips through the same
Worker graphics journal; it is not a claim of complete base-graphics rendering. Rank 166 `browseURL`
is now available for eight calls across xfun, htmltools, knitr, and httpuv (3.6% weighted reach). R
callbacks and suppression remain evaluator-local; external locations become inert host requests and
existing browser-memory report/image files cross the Worker as bounded byte snapshots. This supplies
a reusable package viewer seam without granting network, DOM, process, or host-file access. Rank 168
`gc` is now available for 17 calls across rlang, matrixStats, and bit64 (3.5% weighted reach). The
no-argument cleanup/benchmark path, GNU R-shaped report matrix, resettable high-water values,
verbose output, adjacent `gcinfo`, and `system.time(gcFirst)` share a deterministic traversal of the
reachable NativR graph; this is not a claim to inspect or force the browser JavaScript heap. Rank
174 `lines` is now available for all 20 measured calls across scales, matrixStats, posterior, and
zoo (3.4% weighted reach). The exported S3 generic and `lines.default` preserve package-method
values and visibility, while ordinary coordinate vectors, matrices, lists, data frames, and complex
values share the existing plot-coordinate adapter. Connected, point, combined, overplotted,
histogram, step, and no-draw types emit existing bounded segment/point commands; incomplete
coordinates split paths and line-versus-point style rules follow the documented first-value and
recycling contract. This is reusable browser graphics infrastructure, not a claim of complete
devices, axes, clipping, or every graphical parameter. Rank 176 `system` is now available through an
explicit host policy for five measured withr/knitr/data.table calls (3.3% weighted reach). Its GNU
R-shaped formals, validation, status/output behavior, and inline/Worker bridge are reusable, but the
measured `R CMD SHLIB`, `pandoc`, and `diff` programs exist only when the embedding application
allows and implements them. The default browser runtime still has no process capability.
`as.difftime` is now available for both measured vctrs/scales calls at rank 177 (3.3% weighted
reach). Plain numeric intervals retain their explicit units, while recycled character formats feed
the shared seconds/minutes/hours/days/weeks constructor with automatic-unit selection, names,
missing values, exact formals, and GNU R-shaped interval attributes. The adjacent `difftime` path
now adds partial unit names, automatic units, and recycling warnings. Locale-specific `%X`,
date-bearing named-zone parsing, POSIXlt conversion, and the full difftime S3 arithmetic/method
family remain explicit compatibility depth. Rank 184 `ls` is now available for all five measured
calls across callr, rstan, and bit64 (3.0% weighted reach), together with its identical `objects`
alias. Caller, explicit, numeric-position, and exact named search-list environments share
non-forcing binding enumeration, hidden-name and pattern filtering, deterministic ordering, and GNU
R-shaped formals. A checked-in source-only package uses the same implementation inside its
namespace. Active-binding substitution, locale collation, exact hash-bucket order, and browser/GNU
regexp differences remain explicit compatibility depth. Rank 186 `hist` is now available for all 19
measured calls across testthat, openssl, shiny, and posterior (3.0% weighted reach). The shared
S3/default path returns standard histogram fields, supports numeric or algorithmic breaks,
right/left endpoint rules, densities, class-count helpers, and browser bar/label drawing over the
existing polygon journal. A checked-in pure-R package calls the same implementation unchanged;
complete pretty-boundary identity, logarithmic axes, line-density shading, and every graphics
parameter remain compatibility depth. Rank 22 `plot` is now available for all 179 measured
occurrences across 20 sampled package manuals, representing 19.1% download-weighted reach. The
implementation prioritizes the common numeric vector/x-y calls and the S3 seam required by
package-owned plot methods: point, line, both, overplotted, histogram, step, and no-draw geometry
reuse the owned Worker/Canvas graphics journal. This is shape-level availability, not complete
base-graphics compatibility; specialized methods, full axes/tick labels, log/aspect layout, margins,
clipping, and arbitrary graphical controls remain declared boundaries. Rank 27 `system.file` is now
available at 17.1% weighted reach through bounded, immutable package-resource paths. Rank 34
`Sys.sleep` adds cooperative Worker-safe waits, while rank 52 `writeLines` and rank 61 `readLines`
add session-memory roundtrips and immutable package-text reads. Ranks 65 `file`, 69 `close`, 71
`tempdir`, and 125 `file.exists` now share a bounded session-owned connection and path layer; rank
341 `open` and its adjacent `flush`, `isOpen`, and `seek` operations use the same handles. Ranks 48
`R.home`, 129 `dir.create`, and 135 `list.files` now share a bounded virtual-directory layer with
`dir.exists`, `list.dirs`, `getwd`/`setwd`, `normalizePath`, `basename`, and `dirname`. Usage-ranked
`data`, `write.csv`, and `read.csv` now use that layer for package data scripts, text datasets,
quoted tabular input/output, and deterministic type conversion. Rank 80 `dev.off` now participates
in a multi-device lifecycle. Rank 121 `png` covers all seven measured calls across five packages
through a browser-owned file device, deterministic command rasterizer, and real PNG encoding. Rank
127 `system.time` now covers all 95 measured calls across six packages through lazy single
evaluation, GNU R-shaped `proc_time` results, and the adjacent `proc.time` session clock. Grouped
`split` (rank 155) and real-vector `floor` (rank 156) are now complete at 4.1% weighted reach each.
Factor generator `gl` (rank 158, 4.1%) and a bounded data-frame `merge` subset (rank 161, 4.0%) are
now complete. Data-mask mutation through `within` (rank 167, 3.8%) and vectorized real/complex
trigonometry led by `sin` (rank 177, 3.6%) are now complete as well. After filtering out
already-supported names and architecture-dependent host, graphics, serialization, and source-loading
entries, numeric-order factor coercion through `as.factor` (rank 187, 3.1%) and grouped
transformation through `ave` (rank 188, 3.0%) are now complete. UTC date construction through
`ISOdate` (rank 189, 3.0%) and Cartesian data-frame construction through `expand.grid` (rank 190,
3.0%) are now complete too. After filtering out package metadata, graphics, host-memory, process,
and object-introspection work, vector insertion through `append` (rank 195, 2.9%) and vectorized
real/complex cosine through `cos` (rank 199, 2.9%) are now complete. The set-operation family is now
complete through `intersect` (rank 186), `setdiff` (rank 208), and `union` (rank 209), followed by
parallel minimum selection through `pmin` (rank 215, 2.4%), lagged vector differencing through
`diff` (rank 222, 2.3%), and explicit vector-mode coercion through `as.vector` (rank 224, 2.3%).
Integer-code-point decoding through `intToUtf8` (rank 226, 2.3%) is now complete as well. The
bounded `show` generic is now complete for registered single-object display methods and
deterministic fallback output, while rank 227 `rep_len` is already supported. Matrix-diagonal
construction and extraction through `diag` (rank 228, 2.2%) is now complete too. Rank 229 `identity`
is already supported, while rank 230 `textConnection` belongs to the connection/host-adapter
surface. Formula coercion through `as.formula` (rank 231, 2.2%) is now complete. Quoted evaluation
through `evalq` (rank 232, 2.2%) is now complete too. The global calling-handler surface through
`globalCallingHandlers` (rank 233, 2.2%) is now complete as well. Session search-path inspection
through `search` and dynamic R-syntax call inspection through `sys.call` (ranks 234–235, 2.2% each)
are now complete. Rank 236 `force` is already supported, rank 237 `readline` now uses an explicit
line-input host adapter, ranks 238–239 `difftime` and `is.character` are already supported, and rank
241 `unserialize` now shares the bounded GNU R XDR codec with rank 142 `serialize`. Time-series
coordinate shifting through `lag` (rank 242, 2.0%) is now complete. Numeric interval factorization
through `cut` (rank 243, 2.0%) is now complete too. Ranks 244–245 `Sys.setlocale` and
`Sys.getlocale` are now complete for evaluator-owned C locale state and the two monetary profiles
required by the later measured `withr` examples; arbitrary host locales, collation, and
time-language mutation remain explicit boundaries. Rank 246 `plot.new` is now the page-state
dependency for the measured raster slice, and rank 247 `logical` is already supported. Atomic
run-length encoding through `rle` (rank 248, 1.9%) is now complete. Rank 249 `deparse` is already
supported. Regex match extraction through `regmatches` (rank 250, 1.9%) is now complete together
with its `gregexpr` match-object producer (rank 252, 1.9%) and the supporting first-match `regexpr`
surface. Independent whitespace trimming through `trimws` (rank 251, 1.9%) is now complete too.
Ranks 253–255 require package-metadata, connection, or process-timing host contracts, while rank 256
`vapply` is already supported. Time-series endpoint inspection through `end` (rank 257, 1.8%) is now
complete. Ranks 258–259 belong to graphics/color architecture; ranks 260 `complex` and 261 `vector`
are already supported, while the current rank-256 `file.remove` now uses the owned session-file
contract without exposing a host filesystem. Grouped factor reordering through `reorder` (rank 263,
1.7%) and planar convex-hull selection through `chull` (rank 264, 1.7%) are now complete. Rank 265
`terrain.colors` belongs to color-generation architecture. Model covariance plus central Student-t
probabilities now complete `confint` (rank 266, 1.7%). Session-local numeric perturbation through
`jitter` (rank 267, 1.7%) and argument-choice normalization through `match.arg` (rank 268, 1.7%) are
complete. Stable logistic quantiles through `qlogis` (rank 269, 1.7%) and matrix centering/scaling
through `scale` (rank 270, 1.7%) are complete too. The model architecture completes `aov` and
`fitted` (ranks 271–272), and `IQR` (rank 273) covers interquartile ranges through all nine GNU R
quantile algorithms. Numeric clustering through `kmeans` (rank 274, 1.7%) is now complete for the
documented bounded algorithms and data shapes. Ranks 275–278 (`log2`, `predict`, `resid`, and `rt`)
are already supported. Circular, open, and filtering convolution through `convolve` (rank 225, 2.3%)
is now complete, and rank 279 `Filter` is already supported. Hexadecimal integer modes through
`as.hexmode` (rank 280, 1.7%) are now complete together with their formatting, printing, selection,
and bitwise method chain. Ranks 281 `axis` and 282 `readChar` now reuse the owned graphics and
connection architectures; ranks 283 `debug` and 285 `undebug` now reuse the explicit readline host
architecture with adjacent `debugonce` and `isdebugged`, preserving function-object identity,
one-shot consumption, and a bounded command subset. Arbitrary debugger expressions, nested stepping,
and S4 signatures remain depth. Rank 284 `emptyenv` is already supported. Rank 286
`as.list.environment` is the next isolated browser-safe callable and is now complete with S3
dispatch, local binding enumeration, hidden-name and sorting controls, hash-aware unsorted order,
and lazy-promise forcing. Rank 287 `list2env` is already supported. Rank 288 `capabilities` is now
complete: the four sampled calls query `cairo` or `profmem`, and the browser runtime truthfully
reports both unavailable while preserving GNU R's full named selection shape. Ranks 289 `pdf` and
290 `title` require graphics-host architecture, rank 291 `exists` is already supported, and rank 292
`kappa` is now complete with QR estimates, exact 2-norm results, direct one-/infinity-norm paths,
triangular controls, and `qr`/`lm` dispatch. Rank 293 `model.matrix` is already supported. Rank 294
`xtabs` is now complete for the sampled RcppEigen factor-table call plus weighted/matrix responses,
subsets, missing-value controls, unused levels, and table metadata. Rank 295 `RNGkind` is now
complete for the six sampled query calls in the
[`withr` reference manual](https://cran.r-project.org/web/packages/withr/refman/withr.html) plus
partial/default kind selection, prior-state return and visibility, warnings, the default
Mersenne-Twister/Inversion pair, historical uniform kinds, L'Ecuyer-CMRG stream/substream state,
supported normal kinds, and both discrete samplers. Rank 296 `sample.int` is now complete for the
two sampled calls in the same `withr` manual, where it generates a seed from `.Machine$integer.max`.
The implementation also has differential evidence for replacement, no-replacement, optional hash
selection, weighted draws, and populations above the 32-bit integer range. Rank 297 `Sys.localeconv`
is now complete for both sampled `withr` calls: its 18-name character-vector contract follows
session-local monetary state, including the observed `it_IT` and `en_US` profiles. Rank 298
`attributes` is already supported; ranks 299–302 require filesystem, process/PATH, or graphics host
adapters. Rank 303 `tan` is now complete for the measured
[`testthat`](https://cran.r-project.org/web/packages/testthat/refman/testthat.html) call
`expect_equal(tan(pi / 4), 1)` and the
[`data.table`](https://cran.r-project.org/web/packages/data.table/refman/data.table.html) expression
`tan(pi * (1 / 4 + 1:10))`. The same slice installs the base `pi` binding and adds differential
coverage for logical, integer, double, and complex vectors, attributes, `NA`/`NaN`, infinities, and
domain warnings. Rank 304 `make.names` is now complete for the measured
[`tibble`](https://cran.r-project.org/web/packages/tibble/refman/tibble.html) expression
`.name_repair = ~ make.names(., unique = TRUE)`. The implementation repairs duplicate tibble
arguments through that formula callback and has differential evidence for C-locale syntax, reserved
words, empty and missing names, underscore compatibility, scalar-list coercion, attribute removal,
and GNU R's legal-name-first uniqueness ordering. Rank 305 `start` is now complete for eight
measured calls across two packages with 1,856,101 snapshot downloads. The
[`crayon` manual](https://cran.r-project.org/web/packages/crayon/refman/crayon.html) uses
`start(red)` through its package-owned S3 method, while the
[`zoo` manual](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) calls `start(x)` on
date-indexed series. NativR supplies the generic's default row origin, regular-series period/cycle
coordinates, decimal off-grid fallback, `ts.eps`, negative periods, and S3 dispatch; those external
packages still own their class methods. Rank 306 `NextMethod` is already supported, so rank 307
`as.roman` is now complete for the one measured call in
[`pillar`](https://cran.r-project.org/web/packages/pillar/refman/pillar.html), whose 1,778,760
snapshot downloads give it 1.5% download reach. The exact expression
`utils::as.roman(seq_len(nrow(x)))` now resolves through the bounded `utils` namespace and feeds
pillar's subsequent `as.character`/`nchar` width calculation. Differential evidence also covers the
documented 1-through-4999 range, canonical and repeated-`I` historical forms, missing/invalid
inputs, formatting, idempotence, and matrix metadata. Rank 308 `as.POSIXlt` is now complete for
three measured calls across
[`testthat`](https://cran.r-project.org/web/packages/testthat/refman/testthat.html) and
[`zoo`](https://cran.r-project.org/web/packages/zoo/refman/zoo.html), representing 1,767,637
snapshot downloads and 1.4% download reach. The testthat example constructs `as.POSIXlt(Sys.time())`
and checks `length(x)`; the two zoo examples select observations with
`as.POSIXlt(time(z.na))$mday == 5`. NativR now provides those paths through an owned 11-component
POSIXlt list, UTC/GMT Date/POSIXct/epoch/strict-character decomposition, fractional and missing
seconds, documented class/attributes, and S3 dispatch. Regional time-zone and daylight-saving
databases remain explicit boundaries. Rank 309 `drop` is now complete for five measured calls across
[`matrixStats`](https://cran.r-project.org/web/packages/matrixStats/refman/matrixStats.html) and
[`posterior`](https://cran.r-project.org/web/packages/posterior/refman/posterior.html), representing
1,740,589 snapshot downloads and 1.4% download reach. MatrixStats uses four `identical(drop(Z), Z0)`
validations covering both multi-set matrices and one-set vector results; posterior explicitly
compares `drop(Sigma[1, ])` with `Sigma[1, drop = TRUE]` on an rvar covariance array. NativR removes
singleton extents, rebuilds surviving named dimensions or vector names, keeps zero-length
non-singleton axes, and preserves custom classes, factor levels, and unrelated attributes. Rank 310
`rasterImage` is now complete for two measured calls across
[`systemfonts`](https://cran.r-project.org/web/packages/systemfonts/refman/systemfonts.html) and
[`httr`](https://cran.r-project.org/web/packages/httr/refman/httr.html), representing 1,721,945
snapshot downloads and 1.4% download reach. Systemfonts passes a glyph `nativeRaster` after
`plot.new()` and `plot.window()`; httr passes an RGB(A) array decoded from PNG content. NativR owns
the page/window state, native packed-color and RGB(A)/grayscale conversion, recycled placements,
rotation/interpolation command fields, Worker transfer, and Playground Canvas rendering. This also
completes dependency ranks 246 `plot.new` and 393 `plot.window`. Complete axes, graphical
parameters, color databases, specialized plot methods, and the wider device stack remain explicit
boundaries. Rank 311 `weights` is now complete for 22 measured calls across
[`loo`](https://cran.r-project.org/web/packages/loo/refman/loo.html) and
[`posterior`](https://cran.r-project.org/web/packages/posterior/refman/posterior.html), representing
1,713,212 snapshot downloads and 1.4% download reach. The 12 loo calls and 10 posterior calls target
package-owned S3 methods with `log` and `normalize` combinations. NativR implements the independent
GNU R `stats::weights` generic boundary, default list/pairlist component lookup with unique partial
matching, `na.exclude` restoration, and weighted/unweighted `lm` access. Custom methods receive
their still-lazy arguments through ordinary S3 dispatch; the GPL package method algorithms remain
outside NativR. Rank 312 `rbinom` is already registered. Rank 313 `colours` is now complete for the
exact `alpha(colours(), 0.5)` example in
[`scales`](https://cran.r-project.org/web/packages/scales/refman/scales.html), representing
1,705,683 snapshot downloads and 1.4% download reach. NativR independently records the ordered GNU R
4.6.0 catalog of 657 public color names, returns the documented 502-name unique-RGB subset for
`distinct = TRUE`, preserves `colors`/`colours` function identity, and registers both names under
`grDevices::`. The later rank-366 increment adds bounded `col2rgb`; palette mutation, wider
color-space conversion, and the general graphics-device stack remain separate work. Rank 314 `outer`
is now complete for scales' exact `sqrt(outer(x^2, x^2, "+"))` radial-matrix example from the same
[`scales`](https://cran.r-project.org/web/packages/scales/refman/scales.html) manual, representing
1,705,683 snapshot downloads and 1.4% download reach. The owned implementation covers vector and
array Cartesian products, concatenated dimensions and dimension names, character and callable `FUN`,
still-lazy forwarded dots, the default multiplication path, and `%o%`. It does not claim data-frame
methods, arbitrary package-defined array classes, long-vector allocation, or exact legacy
diagnostics. Rank 315 `is.data.frame` is already registered. Rank 316 `nzchar` is now complete for
the two measured calls across
[`data.table`](https://cran.r-project.org/web/packages/data.table/refman/data.table.html) and
[`shiny`](https://cran.r-project.org/web/packages/shiny/refman/shiny.html), representing 1,689,653
snapshot downloads and 1.4% download reach. The data.table call converts captured regex groups with
`ifelse(nzchar(y), as.numeric(y), Inf)`; the Shiny call guards a selected data-set name. The
implementation covers atomic, bounded list/pairlist, language, and expression coercion, GNU R's
default/missing `keepNA` distinction, zero-length values, attribute removal, and primitive
argument-count/name errors. Factors, environments, and closures retain GNU R-shaped rejection. Exact
encoding marks, invalid multibyte strings, arbitrary recursive deparsing, and every primitive
diagnostic are not claimed. Rank 317 `density` is now complete for 94 measured calls across
[`posterior`](https://cran.r-project.org/web/packages/posterior/refman/posterior.html) and
[`distributional`](https://cran.r-project.org/web/packages/distributional/refman/distributional.html),
representing 1,680,147 snapshot downloads and 1.4% download reach. Posterior contributes two
`density.rvar` grid calls. Distributional contributes 92 `density.distribution` calls; 69 repeat the
scalar `density(dist, 2)` shape with and without `log = TRUE`, while the remainder use character,
matrix, list, and vector evaluation points. NativR implements the independent `stats::density` S3
generic and lazy argument forwarding these package methods require; it does not copy either
package's method algorithms. A bounded `density.default` additionally covers Gaussian and
Epanechnikov direct-kernel grids, numeric bandwidths and `nrd0`, adjustment, weights, missing-value
removal, explicit ranges, kernel roughness, and the documented result shape. Other kernels,
FFT-coordinate identity, alternate automatic bandwidth selectors, infinite point masses,
`width`/`ext`/legacy coordinates, arbitrary package methods, and exact source-derived `data.name`
remain explicit boundaries. Rank 318 `sd` is already registered. Rank 319 `setequal` is now complete
for the two calls in [`dplyr`](https://cran.r-project.org/web/packages/dplyr/refman/dplyr.html),
representing 1,675,114 snapshot downloads and 1.4% download reach. Both calls compare data-frame
rows: one unequal pair and one reversed-row equality check. NativR covers those owned
data-frame/tibble shapes with order-insensitive, duplicate-insensitive row matching and compatible
column reordering; it also covers GNU R's base atomic, factor, list, NULL, common-type, duplicate,
NA, and NaN set-equality rules. Tibble rectangular selection now retains tibble class and does not
drop a single selected column, allowing the measured `df1[3:1, ]` expression to remain a table.
Arbitrary dplyr methods, grouped or remote tables, namespace/package loading, pairlists,
locale-specific encodings, and exhaustive recursive-object identity remain outside this increment.
Rank 310 `grep` is already registered. Rank 311 `download.file` now uses the explicit byte adapter
and bounded session-owned files without weakening the default network-free browser boundary, or
adding ambient host access; rank 312 `eigen` is now complete for jsonlite's
`lapply(eigen(matrix(-rnorm(9), 3)), round, 3)` serialization fixture, representing 1,601,911
snapshot downloads and 1.3% download reach. NativR computes real symmetric matrices of arbitrary
owned order with an independent Jacobi rotation path, including normalized eigenvectors, decreasing
eigenvalues, automatic or explicit symmetry, `only.values`, lower-triangle selection, and classed
result shape. Real non-symmetric matrices of order one through three use independent characteristic
roots and complex null-space eigenvectors, covering jsonlite's exact random 3-by-3 shape and GNU R's
small complex-pair examples. Complex input matrices, non-symmetric order above three, defective and
ill-conditioned exhaustive cases, LAPACK convergence/rounding identity, and eigenvector phase/sign
identity remain explicit boundaries. Rank 313 `pipe` is now complete for jsonlite's measured
source-only call through lazy/explicit read and buffered write connections over the default-deny
`systemCommand` capability. It reuses ordinary line/raw/source/table/serialization consumers, exact
close statuses, pure-R namespaces, and Worker execution; duplex streaming and ambient processes
remain outside the contract. Rank 314 `unz` is now complete for jsonlite's measured archive-member
call and exposes exact stored/DEFLATE members from package or session ZIP bytes through the ordinary
connection stack. Bounds, CRC, closed/open cursors, raw/text reads, pure-R package use, downloaded
archives, and Worker execution have evidence; encryption, ZIP64, multi-disk archives, other codecs,
seeking, and writes remain explicit boundaries. Rank 324 `object.size` is now complete for
data.table/bit64's three measured calls, including GNU R 4.6-shaped vector/list/attribute sizes and
object-size unit formatting. Rank 328 `title` is complete for Shiny/bit64's seven measured
annotations through shared `par()` styles, Worker text events, browser/file devices, and unchanged
source-only package code. Rank 330 `sink` is complete for utf8's two measured redirection calls,
with reusable session stack, split, message, connection, pure-R package, and Worker evidence. Rank
338 `write` is complete for sass's measured source-line call with GNU R column layout and owned
file/connection targets. Rank 340 `available.packages` is complete for curl's measured repository
database; rank 343 `barplot` is complete for zoo and bit64's measured vector/matrix calls; and rank
344 `devAskNewPage` is complete for RColorBrewer's ten measured prompts. Rank 345 `getLoadedDLLs` is
shape-complete for ps's measured `vapply(..., "path")` probe over NativR's empty-by-default
native-module set. Rank 346 `socketConnection` is complete for ps's measured call and the reusable
connection lifecycle; rank 348 `file.copy` is complete for xfun's package-resource staging path;
rank 349 `find.package` is complete for its installed-root lookup; rank 351 `l10n_info` is complete
for xfun's UTF-8 branch; rank 353 `shQuote` is complete for its deterministic string-quoting path;
rank 357 `system2` is complete for its explicit structured host-policy path; rank 358 `.Call` now
has registered lookup, arity, bounded value transport, and default-deny adapter evidence. Rank 316
`colSums` is now complete for three observed calls across
[`loo`](https://cran.r-project.org/web/packages/loo/refman/loo.html) and
[`zoo`](https://cran.r-project.org/web/packages/zoo/refman/zoo.html), representing 1,601,512
snapshot downloads and 1.3% download reach. Loo calls `colSums(tab_10)` and `colSums(tab_9)` on
integer fold tables; zoo selects usable columns with `colSums(!is.na(za)) > 0`. NativR covers
logical, integer, double, and complex arrays of rank two or greater, numeric data frames,
column-local `NA`/`NaN` removal, generalized `dims`, empty reductions, and output
names/dimensions/dimnames. The bare-bones `.colSums`, the row/mean family, arbitrary external matrix
classes, extended-precision long-vector accumulation, and platform-specific `NA` versus `NaN`
precedence remain outside this increment. Rank 317 `time` is now complete for 25 observed calls
across [`data.table`](https://cran.r-project.org/web/packages/data.table/refman/data.table.html) and
[`zoo`](https://cran.r-project.org/web/packages/zoo/refman/zoo.html), representing 1,583,147
snapshot downloads and 1.3% download reach. Data.table converts `time(uspop)` into integer years;
zoo's 24 calls read package-owned indexes through `time.zoo`. NativR supplies the ordinary S3
generic, default vector/matrix row coordinates, validated regular-series `tsp` coordinates,
fractional offsets, `ts.eps` integer snapping, and `tsp`/`ts` result metadata while forwarding
custom methods without reproducing zoo. Zoo's `time<-` generic and index storage remain
package-owned, and irregular-series construction, malformed external classes, and the wider
`cycle`/`frequency`/`deltat` family remain outside this increment. Rank 327 `na.omit` is now
complete for eight observed calls across
[`data.table`](https://cran.r-project.org/web/packages/data.table/refman/data.table.html) and
[`zoo`](https://cran.r-project.org/web/packages/zoo/refman/zoo.html), representing 1,583,147
snapshot downloads and 1.3% download reach. Data.table's four calls use its package-owned
`na.omit.data.table`, including the `cols` extension; zoo's four calls remove missing observations
before maxima used in plotting. NativR supplies the S3 generic boundary without reproducing either
package method, plus an independent default for atomic vectors, factors, matrices, data frames, and
regular time series. Default removal treats both `NA` and `NaN` as incomplete, records 1-based
positions and row labels in classed `na.action` metadata, retains matrix/data-frame axes, trims only
leading/trailing missing `ts` observations, and rejects internal time-series gaps. Ordinary lists
and arrays of rank other than two follow GNU R's non-removing default. `na.exclude`, `na.fail`,
`na.pass`, namespace-hidden package methods, exotic class-specific subsetting, and exhaustive
malformed-object behavior remain outside this increment. Rank 328 `ceiling` is now complete for
three observed calls across
[`data.table`](https://cran.r-project.org/web/packages/data.table/refman/data.table.html) and
[`zoo`](https://cran.r-project.org/web/packages/zoo/refman/zoo.html), representing 1,583,147
snapshot downloads and 1.3% download reach. Data.table rounds positive exponential samples upward
before integer-like sampling; zoo's nested `ceiling(ceiling(x) / n) * n` helper aligns plot limits
to tick intervals. NativR returns doubles for logical, integer, and double vectors/arrays, retains
names and arbitrary attributes, preserves distinct `NA`/`NaN` and infinities, and offers direct
`ceiling.<class>` plus basic `Math.<class>` dispatch. This follows the
[GNU R rounding contract](https://stat.ethz.ch/R-manual/R-devel/library/base/html/Round.html).
Factors, Date/POSIXt, complex and nonnumeric defaults reject with bounded errors. Dynamic
`.Generic`/`.Group` bindings inside Math-group methods, built-in data-frame Math methods, every
class-specific method, and exhaustive browser floating-point edge identity remain outside this
increment. Rank 329 `read.table` remains a host-I/O boundary, and rank 330 `which.min` is already
registered. Rank 331 `approx` is now complete for the two observed calls across
[`data.table`](https://cran.r-project.org/web/packages/data.table/refman/data.table.html) and
[`zoo`](https://cran.r-project.org/web/packages/zoo/refman/zoo.html), representing 1,583,147
snapshot downloads and 1.3% download reach. Data.table interpolates the decade-spaced `uspop` series
onto a daily integer/Date-like sequence; zoo maps Date coordinates onto fractional year positions.
NativR supplies `stats::approx` with separate numeric coordinates, one-vector, two-column matrix,
and named `x`/`y` list inputs; linear or constant interpolation; one- or two-sided endpoint rules;
explicit boundaries; `f`; generated `n` grids; default missing-pair removal; missing output
propagation; and ordered, mean, min, max, or callable duplicate reducers. Explicit `xout` retains
its owned numeric attributes, including Date class metadata. This follows the
[GNU R interpolation contract](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/approxfun.html).
`approxfun`, the full `xy.coords` coercion surface, list-valued `ties`, every non-finite coordinate
corner, and exhaustive floating-point identity remain outside this increment. Rank 332 `mapply` is
already registered, as is rank 333 `setGeneric`. Rank 334 `standardGeneric` is now complete for the
one observed call in [`S7`](https://cran.r-project.org/web/packages/S7/refman/S7.html), representing
1,562,896 snapshot downloads and 1.3% download reach. The measured example defines an S4 generic
with `methods::setGeneric("S4_generic", function(x) standardGeneric("S4_generic"))` before S7
registers a class method. NativR's bounded session-local S4 layer now recognizes that definition
shape, forwards declared arguments, defaults, and dots, resolves explicit classes then `ANY`, and
reports calls outside the registered generic body or without a method. This follows the
[GNU R S4 generic contract](https://stat.ethz.ch/R-manual/R-devel/library/methods/html/standardGeneric.html).
The full methods package, multiple dispatch, signature inheritance, sealed classes, package
registration, method caching, primitive/group generics, and S7 itself remain outside this increment.
Rank 335 `colorRampPalette` is now complete for the two identical calls in
[`isoband`](https://cran.r-project.org/web/packages/isoband/refman/isoband.html), representing
1,536,503 snapshot downloads and 1.3% download reach. Both calls define a six-anchor Viridis
palette, request `space = "Lab"`, and generate 21 fill colors. NativR returns a first-class palette
function and independently implements linear RGB or CIE Lab interpolation, positive bias, optional
alpha interpolation, partial argument choices, zero/one-length output, and registered `grDevices::`
lookup. The exact 21-color observed output has byte-for-byte GNU R black-box evidence. This follows
the
[GNU R color-interpolation contract](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/colorRamp.html).
A later package-depth increment adds standalone linear/spline `colorRamp` for unchanged viridisLite;
palette mutation and general device color management remain outside this measured surface. The later
rank-366 work reuses the complete catalog for `col2rgb`. The refreshed detector excludes bslib's two
locally defined `person()` HTML-helper calls rather than misclassifying them as `utils::person()`.
Rank 336 `sink` remains deferred because utf8's measured output-redirection example still requires
stateful `file()`/`close()` connection objects. The session `tempfile()` and `readLines()` pieces
are now available, but implementing only the sink switch without that remaining connection vertical
path would not run the example. Rank 337 `sessionInfo` is now complete for the one call in
[`otel`](https://cran.r-project.org/web/packages/otel/refman/otel.html), representing 1,478,538
snapshot downloads and 1.2% download reach. The measured expression reads
`utils::sessionInfo()$platform` for a log field. NativR returns a classed, named list containing its
deterministic browser platform and running-host identity, R 4.6 compatibility target, current
session locale and RNG kinds, attached core packages, UTC time-zone contract, and explicit empty
native linear-algebra fields. This follows the
[GNU R session-information shape](https://stat.ethz.ch/R-manual/R-devel/library/utils/html/sessionInfo.html)
without pretending to be the user's OS or a GNU R binary. Package-description enumeration and the
`print.sessionInfo`/`toLatex.sessionInfo` methods remain outside this increment. Rank 338
`as.ordered` is now complete for the one call in
[`generics`](https://cran.r-project.org/web/packages/generics/refman/generics.html), representing
1,477,005 snapshot downloads and 1.2% download reach. The exact example converts `letters[1:5]` to
an ordered factor. NativR installs that lowercase base constant and preserves the measured codes,
labels, levels, and `c("ordered", "factor")` class; returns existing ordered factors unchanged;
removes unused levels from ordinary factor input while preserving names; and forwards dots to
package-defined S3 methods. This follows the
[GNU R factor coercion contract](https://stat.ethz.ch/R-manual/R-devel/library/base/html/factor.html).
The broader generics package namespace, recursive list/expression coercion, locale-specific level
sorting, and complete factor method family remain outside this increment. Rank 339 `as.array` is now
complete for the four detected calls in
[`rstan`](https://cran.r-project.org/web/packages/rstan/refman/rstan.html), representing 1,463,993
snapshot downloads and 1.2% download reach. The manual defines and exercises
`as.array.stanfit(x, ...)`; NativR supplies the generic S3 protocol and does not reproduce rstan's
package-owned object or method. Custom methods receive the classed object and lazy dots. The
independent default adds a one-dimensional extent to atomic vectors, lists, factors, and pairlists;
promotes ordinary names to one-axis dimension names; retains unrelated attributes; and returns
existing arrays unchanged. This follows the
[GNU R array-coercion contract](https://stat.ethz.ch/R-manual/R-devel/library/base/html/array.html).
Expression-vector coercion and arbitrary package-specific methods remain outside this increment.
Rank 340 `is.array` was already supported. Rank 341 `nlm` is now complete for the one call in
[`rstan`](https://cran.r-project.org/web/packages/rstan/refman/rstan.html), representing 1,463,993
snapshot downloads and 1.2% download reach. The measured example passes an objective whose scalar
result carries an analytic `gradient` attribute. NativR preserves that callback protocol, forwards
lazy `...` arguments, checks supplied derivatives, falls back to finite differences, and performs
bounded browser-native BFGS minimization with optional Hessian output and GNU R-shaped result names
and convergence codes. This follows the
[GNU R nonlinear minimization contract](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/nlm.html).
Trace printing, more than 64 parameters, iteration limits above 10,000, and bit-for-bit PORT
algorithm identity remain outside this increment. Rank 342 `optim` is now complete for the adjacent
call in the same [`rstan`](https://cran.r-project.org/web/packages/rstan/refman/rstan.html) example,
with the same 1,463,993 snapshot downloads and 1.2% download reach. The measured call supplies
separate scalar objective and gradient functions and selects `method = "BFGS"`. NativR implements
that independent BFGS vertical path with lazy `...` forwarding, parameter names, user or central
finite-difference gradients, `fnscale` maximization, parameter/derivative scaling, bounded
iterations, optional numerical Hessians, named call counts, and GNU R-shaped result fields. This
follows the
[GNU R general-purpose optimization contract](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/optim.html).
Nelder-Mead, CG, L-BFGS-B, SANN, Brent, box bounds, trace output, method-specific controls, more
than 64 parameters, and exact native-algorithm trajectories remain outside this increment. Rank 343
`pairs` is now complete for the one call in rstan's
[custom pairs method](https://cran.r-project.org/web/packages/rstan/refman/rstan.html), again
representing 1,463,993 downloads and 1.2% reach. The measured example invokes
`pairs(fit, pars = ..., log = TRUE, las = 1)` on a `stanfit`; rstan owns the plotting method. NativR
now registers the `graphics::pairs` S3 generic, forwards the original classed object and lazy
arguments to package-defined methods, and does not imitate Stan posterior objects or package
plotting logic. This follows the
[GNU R scatterplot-matrix generic contract](https://stat.ethz.ch/R-manual/R-devel/library/graphics/html/pairs.html).
The default matrix/data-frame scatterplot layout, formula method, panel callbacks, axes, text, and
general graphics parameters remain outside this extension-point increment. Rank 344 `heat.colors` is
now complete for the measured `rstan` reference-manual call, representing 1,466,422 downloads and
1.2% reach. The registered `grDevices` builtin independently generates GNU R's red-to-yellow and
pale-yellow sequence, including deterministic hexadecimal bytes, optional alpha, reversal, numeric
count truncation, name removal, and empty outputs. This follows the
[GNU R palette contract](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/palettes.html).
The related `hcl.colors`, `palette`, and device color-management surfaces are separate compatibility
work; `rainbow`, `terrain.colors`, `topo.colors`, and `cm.colors` are covered by the later shared
HSV increment. In ranks 345 through 353, `open` now uses the virtual connection layer and `readBin`
can retrieve raw bytes from owned binary files; typed binary decoding remains incomplete. The
`getLoadedDLLs` now exposes the owned empty-module truth without host inspection; `socketConnection`
uses an explicit bounded duplex browser adapter rather than ambient network authority.
`devAskNewPage`, `stderr`, and `barplot` now use the owned connection and graphics foundations.
Usage-ranked `write` now uses the owned file/connection writer. Rank 354 `factorial` is now complete
for xfun's [`factorial(10)` example](https://cran.r-project.org/web/packages/xfun/refman/xfun.html),
representing 1,305,720 downloads and 1.1% reach. The independent implementation uses direct products
for finite non-negative integers and a bounded Lanczos gamma approximation elsewhere, while
retaining vector attributes, `NA`/`NaN` distinctions, non-finite behavior, and one domain-warning
event. This follows the
[GNU R special-functions contract](https://stat.ethz.ch/R-manual/R-devel/library/base/html/Special.html).
Exact platform-libm trajectories near gamma poles, complex gamma values, and the wider beta, gamma,
polygamma, choose, and log-factorial family remain separate work. `file.copy` now uses the owned
virtual filesystem, and `find.package` uses the package-loader registry. Rank 357 `is.factor` was
already supported; rank 351 `l10n_info` now reports the fixed browser UTF-8 profile without a host
locale adapter. Rank 359 `lsfit` is now complete for xfun's measured
[`lsfit(1:9, 1:9)` tree example](https://cran.r-project.org/web/packages/xfun/refman/xfun.html),
again representing 1,305,720 downloads and 1.1% reach. NativR reuses its independent, browser-native
pivoted QR path for vector or matrix predictors, optional non-negative weights, intercept and
tolerance controls, complete-case omission, named coefficients/residuals, and a classed `qr` result
with the fields inspected by `str`. This follows the
[GNU R least-squares-fit contract](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/lsfit.html).
Multiple response columns, `yname` result shaping, LINPACK-internal reflector identity, and exact
platform numeric trajectories remain outside this bounded increment. Current rank 353 `shQuote` now
implements the documented Unix `sh`/`csh` and Windows `cmd`/`cmd2` transformations in owned memory,
including GNU R formals, partial type matching, coercion, S3 dispatch, missing values, and Worker
package use. This follows the
[GNU R shell-quoting contract](https://stat.ethz.ch/R-manual/R-devel/library/base/html/shQuote.html).
It deliberately does not execute the resulting command. Rank 361 `strwrap` is now complete for
xfun's measured repeated-text example, representing 1,305,720 downloads and 1.1% reach. The
browser-native implementation accepts atomic paragraph vectors, preserves paragraph and sentence
spacing rules, supports `width`, `indent`, `exdent`, `prefix`, `initial`, and simplified/list-shaped
results, and has black-box evidence for missing values, coercion, empty paragraphs, and input
errors. Rank 362 `suppressMessages` was already supported; `Sys.unsetenv` is now supported, while
rank 357 `system2` now covers the explicit structured process boundary; rank 358 `.Call` now covers
the typed native-interface boundary, while complete R C-API compatibility remains future work. Rank
366 `col2rgb` is now complete for stringr's measured named-color replacement helper, representing
1,237,835 downloads and 1.0% reach. Reviewing that end-to-end example also exposed an earlier missed
browser-safe dependency: rank 207 `rgb`, with 3.1% package reach and 2.6% download-weighted reach,
is now complete too. Together they run the measured `col2rgb` matrix lookup followed by
`rgb(..., maxColorValue = 255)`, cover the complete 657-name catalog, short/long hexadecimal alpha,
transparent and missing colors, the default numeric palette, intensity recycling, names, and
matrix/data-frame channel inputs. Rank 367 `colors` was already supported. The detector now excludes
package-owned `$method()`/`@method()` calls, so htmltools' `tagQ$find()` is no longer misranked as
`base::find`; rank 368 `simplify2array` is the next measured callable and is now complete for
stringi's two examples, representing 1,237,835 downloads and 1.0% reach. Equal-length vectors
simplify to a common-type matrix, unequal lengths remain a list, scalar inputs simplify with outer
names, and equal-dimensional inputs can retain a higher array shape and dimension names. List-valued
cells, zero-length exception controls, promotion, names, non-list identity, and invalid `higher`
boundaries have GNU R black-box evidence. Rank 363 `aspell` is now implemented through the explicit
Ispell-compatible host boundary. Rank 364 `abline` is now implemented over the existing browser
graphics journal with coefficient/model, horizontal/vertical vector, style-recycling, record/replay,
pure-R package, and Worker evidence. Rank 365 `browseVignettes` now aggregates the generic installed
package vignette manifest into GNU R-shaped package matrices and renders a bounded self-contained
catalog through the existing inert browser-file journal, including unchanged pure-R package and
Worker/Playground evidence. Rank 366 `dev.control` now separates the per-device replay recording
from live/PNG/PDF output, with exact formals, reset-on-toggle behavior, pure-R package imports, and
GNU R differential evidence; `lengths` was already supported. Rank 368 `getFromNamespace` has 37
apparent calls, all from backports examples that fetch that package's private implementations before
invoking them, and is now complete through the general package namespace loader. Exact
non-inheriting private bindings, character or loaded-environment namespaces, attached-package
location controls, lazy unused controls, exact formals, and an unchanged source-only private-call
fixture have executable evidence. This closes the measured namespace seam, not backports' entire
dependency surface. Ranks 376 `str2expression` and 377 `str2lang` are now complete for the measured
source strings and represent the same 1,112,829 downloads and 0.9% reach. They reuse the
browser-native Tree-sitter parser and return only owned expression/language/symbol/atomic values,
with differential evidence for vectors, comments, blank text, missing strings, single-result checks,
and parse/type errors. The preceding private-namespace retrieval is covered independently by the
rank-368 increment. Rank 378 `URLdecode` is now complete for backports' direct
`URLdecode("ab%20cd")` example, again representing 1,112,829 downloads and 0.9% reach. Registered
`utils::` lookup, vectorized ASCII and UTF-8 percent bytes, literal plus signs, missing/empty/NULL
values, attribute removal, and NUL termination have executable evidence. Malformed percent escapes
and invalid UTF-8 bytes are explicitly rejected because browser strings cannot represent GNU R's
platform-dependent raw-byte results losslessly. Rank 379 `warningCondition` is now complete for
backports' direct `warningCondition("warning", class = "testWarning")` call, representing the same
1,112,829 downloads and 0.9% reach. The owned constructor preserves the GNU R
message/call/additional-field order, prepends custom classes to `warning`/`condition`, supports
vector messages, and runs the measured class-selective `suppressWarnings` expression. Missing custom
class elements are an explicit boundary because NativR's class metadata model cannot preserve them.
Rank 370 `help` is now complete for pkgload's 15 measured calls (0.9% weighted reach). Every
source-package `man/*.Rd` page is indexed at build time, even when it has no examples; runtime
lookup returns GNU R-shaped `help_files_with_topic` and `packageInfo` values, preserves the measured
argument laziness and literal package-name rules, prints portable text by default, and requests
bounded script-free HTML through the existing Worker browse journal when asked. Core bindings and
unchanged source-package aliases share the same discovery path. This closes the measured
documentation seam, not exact GNU Rd conversion, `??` search, installed lazy help databases, or
byte-identical help rendering. Rank 381 `as.environment` is already supported. Ranks 382 `qbinom`
and 383 `qnorm` are now complete for openssl's `qbinom(rand_num(1000), size=10, prob=0.3)` and
`qnorm(rand_num(1000), mean=100, sd=15)` examples. Each represents 925,846 downloads and 0.7%
weighted reach. The shared vectorized path covers recycled distribution parameters, ordinary/log
lower and upper tails, missing/NaN propagation, longest-input metadata, registered `stats::` lookup,
and differential canonical quantiles. Binomial sizes above 10,000,000 and finite normal
log-probabilities below the browser double range are explicit bounded-algorithm limits. Rank 384
`rawToBits` is now complete for openssl's `as.logical(rawToBits(rnd))` example, again representing
925,846 downloads and 0.7% weighted reach. It expands each owned raw byte into eight raw 0/1 values
in GNU R's least-significant-bit-first order, drops source attributes, accepts empty raw vectors,
and strictly rejects other input types. Ranks 385 `rowMeans` and 386 `colMeans` are now complete for
matrixStats' matrix-subset validation calls, representing 901,775 downloads and 0.7% weighted reach.
The shared column-major reducer covers generalized array `dims`, numeric data frames, real and
complex storage, per-group missing-value removal, surviving axis names, automatic versus explicit
data-frame row names, and empty reductions. Rank 387 `weighted.mean` is now complete for
matrixStats' six comparisons against `weightedMean`, representing the same 901,775 downloads and
0.7% weighted reach. The registered `stats` generic dispatches custom S3 methods; its independent
default covers omitted, finite, negative, zero, infinite, missing, and complex weights, paired
`na.rm` filtering, scalar shape, and attribute removal. Infinite or zero total weight follows GNU
R's non-finite arithmetic rather than inventing a normalization fallback. Rank 388 `mad` is now
complete for matrixStats' `mad(1:10)` and `mad(1:2)` reference values, again representing 901,775
downloads and 0.7% weighted reach. The owned robust-scale path covers default/explicit centers,
scale constants, ordinary/low/high even-sample medians, missing-value removal, empty inputs, and
attribute-free scalars. Rank 380 `curve` is now complete for numDeriv's unchanged
`curve(func1, from = 0, to = 5)` example, representing 898,716 downloads and 0.7% weighted reach.
One package-independent path evaluates named functions or lazy caller/package-scoped expressions
over bounded linear or logarithmic samples, returns invisible `x`/`y` coordinates, and forwards
drawing to the existing `plot`/`lines` journal. Exact formals, coercion, errors, additive drawing,
source-package use, active-log-axis lines, and Worker/Canvas rendering have executable evidence.
Complete logarithmic ticks/labels, other additive primitives, clipping, replayed log-axis metadata,
and device-identical output remain graphics depth. Rank 390 `plot.window` is already registered.
Rank 391 `rbeta` is now complete for loo's `rbeta(1, a0, b0)` prior draw and
`as.matrix(rbeta(S, a, b))` posterior draw, representing 870,861 downloads and 0.7% weighted reach.
The independent session sampler covers recycled central and finite non-central parameters, stable
log-gamma ratios, deterministic reseeding, distribution moments, zero/infinite limit distributions,
documented `n` length behavior, and missing/invalid arguments. Exact GNU R beta-deviate stream
identity is not claimed. Rank 392 `dbinom` is now complete for the same loo example's
`dbinom(data_i$y, size = data_i$K, prob = draws, log = TRUE)` call, again representing 870,861
downloads and 0.7% weighted reach. The owned log-density path covers parameter recycling,
ordinary/log output, longest-input metadata, large-count stability, boundary masses, missing/NaN
distinctions, and domain/non-integer warnings. Exact Loader saddle-point rounding over every huge
count remains outside the increment. Rank 393 `mat.or.vec` is now complete for loo's
`b <- mat.or.vec(10, 3)` scratch allocation, again representing 870,861 downloads and 0.7% weighted
reach. It creates owned double zeros, returns an unclassed vector only when `nc == 1`, otherwise
attaches the truncated nonnegative row/column dimensions, accepts zero-sized extents, drops input
attributes, and rejects missing or invalid branch/extent inputs. Rank 394 `droplevels` is already
registered. Rank 395 `seq.int` is now complete for data.table's three rolling-window helper calls:
`seq.int(n)` and two uses of `seq.int(n - 1L)`, representing 864,145 downloads and 0.7% weighted
reach. The primitive path covers scalar numeric endpoints, length-based single inputs,
ascending/descending steps, fractional `length.out` rounding, `along.with`, integer/double result
selection, internal `seq` S3 dispatch, ignored dots, and strict finite/resource controls. Rank 396
methods `as` is now complete for data.table's two documented identity checks between its
`as.IDate`/`as.ITime` constructors and `methods::as`, representing 864,145 downloads and 0.7%
weighted reach. NativR provides a session-local `setAs` source/target registry, inherited
source-class lookup, core constructor fallback, identity behavior, namespace access, invisible
registration, and bounded invalid-definition/unknown-target errors. The data.table classes and
constructors remain package-owned and are not reproduced. Ranks 397 `as.name` and 398 `is.list` are
already registered. Ranks 399/400 `readRDS`/`saveRDS` now use the same XDR/gzip codec over
browser-owned binary files, and rank 401 `tracemem` depends on object-identity instrumentation that
the immutable value model does not yet expose. Rank 402 `weekdays` is now complete for data.table's
two IDate grouping-label calls: `factor(weekdays(idate))` and `weekday = weekdays(tt$date)`, again
representing 864,145 downloads and 0.7% weighted reach. The base S3 generic resolves the package's
inherited Date class and covers deterministic C-locale full/abbreviated names, recycled coercible
abbreviation flags, Date fractions, names, missing/non-finite values, UTC/GMT POSIXct/POSIXlt
inputs, direct methods, custom dispatch, and invalid inputs. Other locale profiles and the broader
`months`/`quarters`/`julian` family remain separate work. Rank 403 `write.table` is deferred until
the browser connection/filesystem adapter exists. Rank 404 `anyDuplicated` is now complete for
data.table's measured `anyDuplicated(DT, by = c("A", "B"))` query, representing 864,145 downloads
and 0.7% weighted reach. NativR supplies the package-method S3 seam plus independent atomic, factor,
list, and data-frame defaults with forward/reverse first positions, names, missing/NaN distinctions,
incomparables, empty inputs, and bounded control errors. The data.table class and method remain
package-owned. Ranks 405 `Im`, 406 `new`, and 407 `Re` are already registered. Rank 408 `rep.int` is
now complete for data.table's adaptive-window helper
`an <- function(n, len) c(seq.int(n), rep.int(n, len - n))`, representing 864,145 downloads and 0.7%
weighted reach. It covers scalar whole-vector and element-wise repetition, truncated/coercible
counts, atomic/list/factor/expression storage, documented attribute removal, factor metadata, custom
internal-S3 methods, and allocation guards. Rank 409 `methods::representation` is now complete for
data.table's measured legacy S4 declaration `representation(x = "character", dt = "data.table")`,
representing 864,145 downloads and 0.7% weighted reach. It returns an ordered plain parent/slot
declaration list, decodes backtick slot names, validates scalar character declarations, rejects
duplicate parent or slot entries, and feeds the bounded `setClass`/`new` path without bundling
data.table. Rank 410 `trunc` is now complete for data.table's measured `trunc(seqtimes, "hours")`
ITime method call, representing 864,145 downloads and 0.7% weighted reach. NativR supplies direct
and Math-group S3 dispatch plus an independent toward-zero default with logical/integer coercion,
signed zero, non-finite/missing values, attributes, eager default dots, and bounded invalid types;
data.table retains ownership of ITime and its method. Rank 411 `utils::type.convert` is now complete
for the callback in data.table's measured
`tstrsplit(v, " ", type.convert = list(..., function(x) type.convert(x, as.is = TRUE)))` example,
representing 864,145 downloads and 0.7% weighted reach. Its owned S3 default/list/data-frame methods
cover the logical/integer/double/complex inference ladder, missing/decimal controls,
character/factor fallback, arrays, recursive containers, and custom dispatch. Rank 412
`utils::update.packages` is deferred until the browser package/network adapter exists; rank 413
`get` is already registered. Rank 414 `withVisible` is now complete for Shiny's two measured
stack-trace-control calls, representing 843,616 downloads and 0.7% weighted reach. It captures
literal, assignment, invisible, block, nested, closure, ellipsis, and `evalq` visibility with one
evaluation, while preserving GNU R's distinction between an unforced forwarded promise and an
already-forced lookup. Rank 415 `df()` is a scope-resolution false positive: the Shiny example
defines `df <- eventReactive(...)` before calling that local function, so it is not evidence for
`stats::df`. Rank 416 `dist()` is another Shiny-local callback selected from `rnorm`, `rexp`,
`runif`, or `rlnorm`, not evidence for `stats::dist`. Rank 417 `normalizePath` is a genuine Shiny
filesystem call and remains deferred until the browser file adapter exists. Rank 418 `simulate()` is
a local `card_server` callback parameter rather than a core callable. Rank 419 `strftime` is now
complete for Shiny's measured `strftime(Sys.time(), " [%F %T] ")` log path, representing 843,616
downloads and 0.7% weighted reach. The owned implementation covers recycled UTC/GMT values and
formats, deterministic C-locale calendar/clock/week/epoch/timezone tokens, fractional seconds,
names, non-finite values, timezone labels, and custom `as.POSIXlt` dispatch. Rank 420
`grDevices::as.raster` is now complete for ragg's measured captured-color-matrix conversion,
representing 843,009 downloads and 0.7% weighted reach. It produces the GNU R row-first raster shape
from character matrices, grayscale logical/numeric/raw values, and numeric/raw RGB(A) planes, with
vector reshaping, missingness, scaling, S3, identity, predicates, and downstream `rasterImage` RGBA
evidence. The surrounding `plot.raster` method remains separately deferred. Rank 421 `dev.flush` is
now complete for ragg's genuine zero-argument animation-device call shape, representing 843,009
downloads and 0.7% weighted reach. Its paired `dev.hold` implements nested levels on the owned
browser device; held page/window/raster commands remain bounded and private across evaluations until
a flush reaches zero, then release in order. The executable R 4.6 oracle confirms the measured
call's visible integer return. NativR does not thereby claim ragg's WebP device or encoding. Rank
422 `replayPlot` is now complete for ragg's genuine same-session
`recordPlot()`/`replayPlot(recorded)` sequence, representing 843,009 downloads and 0.7% weighted
reach. The owned browser device records a bounded page/window/raster display list, returns the
observed classed-list shape, retains `load`/`attach` metadata, replays immediately or through
`dev.hold`, and returns invisible `NULL`. It intentionally does not consume GNU R's private
recorded-plot format, reload packages, implement `print.recordedplot`, or claim cross-device
equivalence. Rank 423 `ppoints` is now complete for posterior's two genuine
`quantile(x, ppoints(10))` examples, representing 838,867 downloads and 0.7% weighted reach. The
implementation covers documented 3/8-versus-1/2 defaults, scalar and observation-vector counts,
fractional endpoints, numeric/complex offsets, recycling warnings, attributes, missingness, lazy
nonpositive results, namespace access, and bounded allocation. It does not thereby claim posterior's
`rvar` methods or every GNU R long-vector/class arithmetic edge. Rank 424 `chol` is now complete for
posterior's genuine `chol(d$Sigma)` `rvar` method call, representing 838,867 downloads and 0.7%
weighted reach. The generic supplies the measured S3 extension seam, while `chol.default` adds an
independent upper-triangular real-matrix factor, scalar/data-frame conversion, dimnames, optional
positive-semidefinite pivot/rank metadata, warnings, lazy dots, and bounded controls. This does not
implement posterior's package-owned method, exact LAPACK identity, sparse/tensor factors, or complex
matrices. Rank 425 `pnorm` is now complete for posterior's genuine `pnorm(1.5, mean = 1:4, sd = 2)`
comparison, again representing 838,867 downloads and 0.7% weighted reach. The owned implementation
covers vectorized/recycled quantiles, means, and deviations, lower/upper and ordinary/log tails,
longest-input metadata, zero-deviation point masses, missing values, NaN warnings, empty inputs,
namespace access, and far-log-tail probabilities evaluated without intermediate underflow. It does
not claim bit-for-bit identity across every subnormal/libm boundary, complex quantiles, arbitrary
class-specific dispatch, or the wider normal-distribution family. Rank 426 `rgamma` is now complete
for posterior's genuine `rdo(rgamma(1, shape = 1, rate = 1))`, `rfun(rgamma)`, and
`rvar_rng(rgamma, 1, shape = 1, rate = 1)` examples, again representing 838,867 downloads and 0.7%
weighted reach. It exposes the existing owned gamma sampler with documented `n` lengths, recycled
shape/rate/scale parameters, equivalent/conflicting dual-parameter checks, deterministic reseeding,
statistical moments, zero/infinite limits, empty parameters, missing/NaN/domain warnings, and
namespace access. Exact GNU R Ahrens-Dieter draw sequences, every underflow boundary, class-specific
inputs, and the wider gamma density/CDF/quantile family are not claimed. Rank 427 `segments` is the
now complete for posterior's genuine `segments(seq_along(eight_schools$theta), y0 = q5, y1 = q95)`
credible-interval example, again representing 838,867 downloads and 0.7% weighted reach. The
browser-owned implementation covers the omitted-`x1` vertical-line default, coordinate and style
recycling, character/numeric colors, named/numeric/custom line types, line widths,
missing/non-finite omission, zero-length boundaries, Worker graphics transport, pixel-checked Canvas
drawing, hold/flush, and same-session record/replay. Coordinate classes, log axes, complete
clipping/margins, `...` graphical parameters, device-specific dash metrics, and rendering identity
across GNU R devices are not claimed. Rank 428 `glob2rx` is now complete for rprojroot's genuine
`glob2rx("DESCRIPTION")` file-root pattern, representing 838,555 downloads and 0.7% weighted reach.
The browser-owned text converter covers vectorized wildcards and anchors, documented
leading/trailing trimming, limited regex punctuation escaping, Unicode, NULL/missing and coerced
atomic/list/language inputs, attribute removal, namespace access, scalar logical controls, errors,
and bounded output. It does not claim filesystem traversal, platform path semantics, arbitrary byte
encodings, undocumented escape behavior, or general regex execution. Rank 429 `sQuote` is now
complete for httr's two genuine `sQuote(req$url)` callback-log expressions, representing 836,708
downloads and 0.7% weighted reach. The browser-owned formatter covers deterministic C-locale ASCII
quotes, explicit UTF-8 and TeX styles, arbitrary custom single-quote pairs, `useFancyQuotes` option
changes, owned-value coercion, missing/NULL values, removed attributes, and bounded output. It does
not claim host-locale quote discovery, arbitrary byte encodings, custom `as.character` methods,
`dQuote`, or exact formula-source reconstruction. Rank 430 `family` is now complete for the S3
extension point exercised by distributional's genuine `family(dist)` example, representing 836,291
downloads and 0.7% weighted reach. The owned generic covers stats-namespace lookup, lazy dots,
ordered class dispatch, `NextMethod`, user-defined default methods, visibility, and no-method
boundaries. It does not claim distributional object construction or its package-owned
`family.distribution` method, namespace loading, `family.glm`, or complete GLM-family behavior. Rank
431 `View` is now complete for rstudioapi's genuine `View(rstudioapi::terminalContext(termId))`
example, representing 809,771 downloads and 0.7% weighted reach. The call occurs in a non-running
manual example, so its evidence weight remains limited; the implemented browser slice nevertheless
covers owned data-frame/vector/list/array coercion, custom `as.data.frame` dispatch, non-empty
extent checks, deterministic character cells, titles and non-default row names, invisible return
behavior, structured inline/Worker events, output limits, and Playground rendering. It does not
claim a desktop spreadsheet window, editing, arbitrary package column formatting, or RStudio
terminal APIs. Rank 432 `setMethod` was already supported by the bounded S4 registry. Rank 433
`path.expand` is now complete for diffobj's genuine
`file.path(path.expand("~"), "web", "mycss.css")` example, representing 777,944 downloads and 0.6%
weighted reach. The browser contract follows R's documented unknown-home behavior and leaves leading
tildes unchanged. Its previously unresolved `file.path` dependency is also complete; that
constructor occurs in 20 analyzed packages and 48 calls with 20.2% download-weighted reach. Coverage
includes vectorized construction, recycling, separators, missing/coerced components, zero-length
propagation, strict `path.expand` character input, attribute removal, namespace access, errors, and
resource limits. It does not claim host-home discovery, normalization, existence checks, filesystem
access, platform encodings, or GNU R's Windows-specific trailing-separator cleanup. Rank 434
`setOldClass` is now complete for diffobj's genuine `setOldClass("zulu")` declaration before its
`guidesPrint` S4 method, again representing 777,944 downloads and 0.6% weighted reach. Coverage
includes session-local non-empty class-chain registration, inherited single-object S4 generic
dispatch, inherited explicit coercion lookup, prototype and environment arguments, namespace access,
invisible return behavior, input errors, and explicit unsupported bridge boundaries. It does not
claim namespace-scoped metadata, `test = TRUE` verification, explicit `S4Class` bridges, multiple
dispatch, full class representations, or methods cache behavior. Rank 435 `show` is now complete for
diffobj's genuine `show(StyleAnsi256LightYb())` example, again representing 777,944 downloads and
0.6% weighted reach. The package constructor and method remain package-owned; independently
registered equivalents demonstrate exact and inherited old-class method lookup, bounded text output,
visible/invisible method results, namespace access, deterministic fallback display, argument errors,
and output limits. This does not claim diffobj classes/styles, ANSI/HTML capability handling,
pagers, automatic bare-expression S4 display, multiple dispatch, or the complete methods display
protocol. Rank 436 `capture.output` is now complete for httpuv's genuine
`cat(capture.output(str(as.list(req))), sep = "\n")` WebSocket request-inspection example,
representing 770,373 downloads and 0.6% weighted reach. The browser-owned implementation captures
visible expression printing plus `cat`/`print` output in memory, preserves partial and empty lines,
selects output or message streams, supports nested captures and `split = TRUE`, observes the output
budget, and is available through `utils::`. GNU R differential evidence also covers argument
matching, prefix selection, visibility, and the newline-terminator rule used by the measured `cat`
call. Files, connections, warning/error sinks, arbitrary print-method behavior, and complete sink
stack semantics are not claimed. Rank 437 `demo` is now complete for the documented
`demo("echo", package = "httpuv")` call boundary, representing the same 770,373 downloads and 0.6%
weighted reach. NativR reproduces GNU R's `packageIQR` catalog without consulting an installed R
library. Profile 0.407 adds generic discovery and execution for demo scripts retained in
browser-owned installed package resources, including optional `00Index` titles, package attachment,
declared encoding, and echo control. Host libraries, ambient I/O, and complete interactive
presentation remain outside the contract. Rank 438 `RNGversion` is now complete for zoo's repeated
`suppressWarnings(RNGversion("3.5.0")); set.seed(1)` example setup, representing 731,390 downloads,
17 measured calls, and 0.6% weighted reach. It selects Mersenne-Twister/Inversion/Rounding for R
versions from 1.7 through 3.5, emits the historical Rounding warning, returns the prior kind vector
invisibly, and restores Rejection for R 3.6 or newer. At that increment, the Wichmann-Hill/Marsaglia
and Buggy Kinderman-Ramage defaults needed before R 1.7 failed explicitly rather than silently using
the wrong generator; increments 186-187 below close those historical paths. Ranks 439 `window`, 440
`as.ts`, 442 `frequency`, and 443 `ts` are now complete as one dependency-ordered regular
time-series foundation, representing zoo's 731,390 downloads, respectively 14, 7, 6, and 5 measured
calls, and 0.6% weighted reach. GNU R differential evidence covers vector/matrix construction,
calendar coordinates, endpoint recycling, coercion, frequency lookup, regular windows, integral
downsampling, extension with typed missing values, warnings, namespace access, and independently
registered package methods. Zoo's own irregular index constructors and methods remain package-owned
and are not claimed until an audited bundle fits the loader and supported runtime surface. Rank 444
`legend` is now complete for zoo's 731,390 downloads, three measured calls, and 0.6% weighted reach.
The browser-owned subset covers the observed bottom-left, bottom-right, and top-left line/point keys
plus coordinate placement, recycled colors/styles, boxes, columns, titles, invisible geometry
results, Worker transport, Canvas pixels, and display-list replay. General graphical `...`,
fill/density legends, expression labels, exact device text metrics, and the complete base-graphics
stack remain explicit boundaries. Rank 445 `comment` and its replacement form are now complete for
zoo's two measured calls, representing 731,390 downloads and 0.6% weighted reach. The observed
example attaches two character metadata lines to a classed series and reads them back without
affecting default printing. Differential evidence also covers absent comments, missing values,
`NULL`/empty removal, attribute preservation, `attr<-` validation, visibility, namespace access, and
invalid replacements. Comments on closures, environments, and language objects await the future
general attribute model. Rank 446 `cycle` is now complete for zoo's two measured calls, representing
731,390 downloads and 0.6% weighted reach. The owned default derives observation numbers from
validated regular `tsp` metadata for vectors and matrix rows, including calendar starts and
fractional frequencies, while the S3 generic forwards lazy dots to independently supplied methods
such as `cycle.zoo`. Zoo's irregular-series method, index storage, and package loading remain
package-owned. Rank 447 `signif` is now complete for zoo's two measured calls, again representing
731,390 downloads and 0.6% weighted reach. The observed maxima are rounded to two significant digits
before sizing a primary/secondary plot axis. Differential evidence covers real and complex vectors,
decimal ties-to-even, recycled and clamped 1–22 digit controls, missing and non-finite values,
metadata retention, allocation limits, and direct/Math-group S3 methods. Exact identity for every
platform decimal-to-binary boundary remains outside the claim. Rank 448 `axTicks` is now complete
for zoo's measured secondary-axis tick lookup, representing 731,390 downloads, one measured call,
and 0.6% weighted reach. The owned linear path derives horizontal or vertical ticks from
`plot.window()` state, supports explicit `axp`, ascending and descending axes, coercible sides, lazy
`usr`/`nintLog`, namespace access, and allocation limits. Logarithmic axes, `par("xaxp"/"yaxp")`,
and complete `pretty` boundary identity remain explicit boundaries; a separate session-local `par()`
subset covers common query/update/restoration patterns, and the later rank-215 `axis` increment
supplies bounded linear drawing. Rank 449 `box` is now complete for zoo's measured plot-frame
redraw, representing 731,390 downloads, one measured call, and 0.6% weighted reach. The owned
plot-region path resolves all documented `bty` edge shapes, `col`/`fg`, line type, and positive
width before a bounded event crosses the Worker boundary and reaches Canvas or same-session
record/replay. Figure, inner, and outer regions require a future margin/layout model. Rank 450
`boxplot` is now complete for zoo's measured grouped-series call, representing 731,390 downloads,
one measured call, and 0.6% weighted reach. The owned S3/default path computes Tukey statistics for
vector, list, and matrix groups and carries resolved boxes, whiskers, notches, and outliers through
Worker/Canvas and same-session record/replay. Formula/data-frame methods, logarithmic axes,
arbitrary `pars`, complete annotation/axes, and device-identical layout remain explicit boundaries.
Rank 451 `deltat` is now complete for zoo's measured regular-series sampling-interval call,
representing 731,390 downloads, one measured call, and 0.6% weighted reach. The generic forwards
lazy dots to package methods such as `deltat.zoo`; its owned default returns one or the reciprocal
of validated `tsp` frequency. Zoo's irregular-series inference and package methods remain
package-owned. Rank 452 `embed` is now complete for zoo's measured lagged-window dependency,
representing 731,390 downloads, one measured call, and 0.6% weighted reach. The owned path produces
current-to-past column-major windows for supported vectors and multivariate matrices with
source-type preservation, attribute removal, fractional-vector behavior, GNU R matrix coercions, and
pre-allocation result limits. Factor vectors, data frames, expression vectors, raw/list matrices,
and fractional nonempty-matrix dimensions remain explicit boundaries. Rank 453 `findInterval` is now
complete for [zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured
irregular-Date rolling-window width expression, representing 731,390 downloads, one measured call,
and 0.6% weighted reach. The owned
[documented interval search](https://stat.ethz.ch/R-manual/R-devel/library/base/html/findInterval.html)
uses bounded binary search with missing-query propagation, duplicate/infinite breakpoints,
left/right closure and inside controls, numeric coercion, and sortedness validation. Unsafe
unchecked break vectors, recursive-list coercion, and long-vector indices remain explicit
boundaries. Rank 454 `gray.colors` is now complete for
[zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured
`gray.colors(2, start = 0.7)` call, representing 731,390 downloads, one measured call, and 0.6%
weighted reach. Rank 455 `grey` is complete through the same shared path for zoo's measured
`grey(7:1/8)` call at the same reach. The owned
[gray palette](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/gray.colors.html) and
[gray-level](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/gray.html) constructors
cover all four documented gray/grey aliases, deterministic RGB(A) bytes, gamma correction, alpha
recycling, reversal, and bounded allocation. Vector-valued palette controls, device profiles, and
the remaining palette families are explicit boundaries. Rank 456 `ISOdatetime` is now complete for
[zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured five-date POSIXct
index constructor, representing 731,390 downloads, one measured call, and 0.6% weighted reach. The
owned [documented wrapper](https://stat.ethz.ch/R-manual/R-devel/library/base/html/ISOdatetime.html)
reuses the existing `ISOdate` calendar path with required clock components, ordinary recycling,
fractional seconds, UTC/GMT controls, calendar validation, and POSIXct metadata. Empty `tz` uses
deterministic UTC arithmetic while retaining its empty label; regional zones/DST, platform-specific
invalid-time normalization, and broad character coercion remain boundaries. Rank 457 `persp` is now
complete for [zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured
`persp(1:nO, 1:nC, zz)` call over a classed `100 × 10` numeric matrix, representing 731,390
downloads, one measured call, and 0.6% weighted reach. The owned
[documented perspective path](https://stat.ethz.ch/R-manual/R-devel/library/graphics/html/persp.html)
preserves S3 forwarding, computes scaled or aspect-preserving homogeneous view matrices, omits
missing grid edges, and emits a bounded default wireframe/box through Worker-safe line commands.
Facet colors, lighting, axis arrows/ticks/text, hidden-line equivalence, hooks, `trans3d`, and
arbitrary graphical controls remain boundaries. Rank 458 `points` is now complete for
[zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) documented
`points.zoo(x, y = NULL, type = "p", ...)` package extension point, representing 731,390 downloads,
one measured occurrence, and 0.6% weighted reach. The owned
[documented default](https://stat.ethz.ch/R-manual/R-devel/library/graphics/html/points.html)
preserves S3 forwarding and resolves vector/matrix/data-frame/list/complex coordinates plus recycled
plotting symbols, colors, fills, sizes, and widths into a bounded Worker point command. Missing
drawing entries are omitted; display-list replay and Canvas pixels share that command. Line/path
types, locale-dependent glyph codes, coordinate classes, clipping/log axes, font identity, and
arbitrary graphical controls remain boundaries. Rank 459 `polygon` is now complete for
[zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured `pnl.xyarea` helper,
which closes an observed series against a fill baseline, representing 731,390 downloads, one
measured occurrence, and 0.6% weighted reach. The owned
[documented default](https://stat.ethz.ch/R-manual/R-devel/library/graphics/html/polygon.html)
normalizes vector/matrix/data-frame/list/complex coordinates, splits missing-coordinate runs, and
resolves recycled fills, borders, line types/widths, solid/no-fill density, and even-odd fill rules
into a bounded Worker polygon command. Display-list replay and Canvas fill/border pixels share the
same command. Hatch-pattern density, broader coordinate classes, clipping/log axes, exact dash
metrics, and arbitrary graphical controls remain boundaries. Rank 460 `replace` is now complete for
[zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured
`replace(x, 1:min(length(x)), 3)` missing-run helper, representing 731,390 downloads, one measured
occurrence, and 0.6% weighted reach. The owned
[documented helper](https://stat.ethz.ch/R-manual/R-devel/library/base/html/replace.html) reuses
NativR's immutable subset-replacement engine for numeric/logical/character subscripts, recycling,
names/extension, atomic promotion, matrices, factors, lists, pairlists, owned data frames, and
`NULL` materialization/deletion. Expression vectors, arbitrary class-specific `[<-` methods, exact
legacy diagnostics, and long vectors remain boundaries. Rank 461 `rlnorm` is now complete for
[zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured
`rlnorm(200, mean = 1)` flow generator, representing 731,390 downloads, one measured occurrence, and
0.6% weighted reach. The owned
[documented distribution path](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/Lognormal.html)
uses the session Mersenne-Twister/Inversion stream, matches the pinned historical fixed-seed
sequence, follows scalar/vector `n`, recycles `meanlog`/`sdlog`, handles zero-deviation point
masses, missing/domain warnings, and allocation limits. Alternative normal generators, bit identity
beyond the Inversion path, and `dlnorm`/`plnorm`/`qlnorm` remain boundaries. Rank 462 `tapply` is
now complete for [zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured
`tapply(1:ncol(x), screens, f)` screen-range grouping path, representing 731,390 downloads, one
measured occurrence, and 0.6% weighted reach. The owned
[documented ragged-array path](https://stat.ethz.ch/R-manual/R-devel/library/base/html/tapply.html)
preserves factor-level dimensions and names, omits missing groups, forwards callback arguments,
supports scalar/default simplification and list-array results, and exposes `FUN = NULL` group codes.
Formula indexes, custom split methods, broader class-specific simplification, and long vectors
remain boundaries. Rank 463 `graphics::text` is now complete for
[zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) measured rotated series-label
call, representing 731,390 downloads, one measured occurrence, and 0.6% weighted reach. The owned
[documented text path](https://stat.ethz.ch/R-manual/R-devel/library/graphics/html/text.html)
carries recycled coordinates, labels, colors, sizes, font faces, positions, adjustment, offset,
rotation, and family through bounded Worker/Canvas and display-list paths. Plotmath, Hershey fonts,
class-specific label coercion, clipping/log axes, and device-identical metrics remain boundaries.
Rank 464 `stats::update` is now complete for
[zoo's](https://cran.r-project.org/web/packages/zoo/refman/zoo.html) documented
`update(trellis.last.object(), type = c("l", "g"))` lattice extension call, representing 731,390
downloads, one measured occurrence, and 0.6% weighted reach. The owned
[documented generic path](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/update.html)
preserves lazy dots and supports inherited S3/`NextMethod` dispatch plus independently authored
default methods. Lattice's package-owned method and GNU R's built-in stored-call rewriting and
re-evaluation remain boundaries. Rank 465 `graphics::matplot` is now complete for
[bit64's](https://cran.r-project.org/web/packages/bit64/refman/bit64.html) six measured
matrix-performance plots, representing 722,206 downloads and 0.6% weighted reach. The owned
[documented matrix-plot path](https://stat.ethz.ch/R-manual/R-devel/library/graphics/html/matplot.html)
cycles vector/matrix/data-frame columns and point/line styles, omits incomplete pairs, resolves
linear and logarithmic coordinates, and reuses bounded page/window/box/segment/point Worker/Canvas
and display-list commands. Full axes/annotations, class-specific plotting methods, `add = TRUE`,
step/histogram types, and device-identical layout remain boundaries. Ranks 466–469 are already
registered. Rank 470 `base::aperm` is now complete for
[bit64's](https://cran.r-project.org/web/packages/bit64/refman/bit64.html) measured `aperm(A, 2:1)`
array-method requirement, representing 722,206 downloads, one measured occurrence, and 0.6% weighted
reach. The owned
[documented array-permutation path](https://stat.ethz.ch/R-manual/R-devel/library/base/html/aperm.html)
adds `aperm`/`aperm.default` S3 dispatch, `NextMethod`, numeric/character axis permutations, reverse
defaults, resized or fixed dimensions, dimnames, atomic/list arrays, lazy dots, and bounded
column-major storage reordering. Table methods, malformed low-level attributes, exact diagnostics,
and long vectors remain boundaries. Rank 471 `base::dget` is now complete for
[bit64's](https://cran.r-project.org/web/packages/bit64/refman/bit64.html) measured `dput`/`dget`
roundtrip, representing 722,206 downloads, one measured occurrence, and 0.6% weighted reach. The
owned
[documented text-serialization path](https://stat.ethz.ch/R-manual/R-devel/library/base/html/dput.html)
also closes the higher-reach `tempfile` and `unlink` prerequisites through bounded
`nativr://session-temp/...` browser-memory paths. Atomic vectors, nested lists/pairlists, names,
ordinary attributes, data-frame metadata, bit64's classed double column, missing/NaN/infinite
values, complex/raw storage, and Unicode have roundtrip coverage. Host paths and connections,
nondefault controls, function/environment graphs, cycles, binary serialization, and cross-session
persistence remain boundaries. Ranks 465/466 `base::load` and `save` now cover bit64's observed
workspace save/remove/load flow on the same browser-memory resource seam. The refreshed CRAN
NAMESPACE attribution correctly excludes bit64's package-owned `hashtab` export rather than
mislabeling it as `base::hashtab`; remaining priorities return to the higher-reach gaps above.

## Completed implementation order

Frequency was the primary signal, with dependency order and browser-first architecture breaking
ties:

1. Core collections and selection: sequences, lists, names, operators, extraction, and indexing.
2. Control flow: conditionals, returns, and bounded loops.
3. Vector productivity: strings, deterministic RNG/sampling, dimensions, matrices/arrays, and
   descriptive statistics.
4. Structured data: frames, replacement, factors, ellipsis, and apply/map helpers.
5. Higher-level forms: formulas, native and magrittr-style pipes, registered namespaces, S3
   dispatch, and bounded S4/R6/vctrs constructors.
6. Text output: browser-safe `print`/`cat`, ordered inline/Worker events, return visibility, and
   output-budget accounting.
7. Structural inspection: class-preserving `head` selection and bounded, invisible `str` output.
8. Strict comparison: recursive `identical` across the owned value model and documented controls.
9. Initial conditions: `try`, error/finally handlers, stop/assertion paths, warning/message streams,
   suppression, and visibility.
10. Session state: resettable `options`/`getOption` behavior and print-option integration.
11. Host mode: deterministic non-interactive behavior for inline and Worker evaluations.
12. Numeric rounding: vectorized real/complex decimal `round` with exact ties-to-even behavior.
13. Elementary math: real/complex logarithms and exponentials with domain and metadata behavior.
14. Data-mask evaluation: lazy `with` masks, `local` environments, and propagated visibility.
15. Tolerant comparison: recursive `all.equal` plus exact scalar truth predicates.
16. Vectorized conditional selection: lazy, recycled `ifelse` branches with test metadata.
17. Logical summaries: eager, missing-aware `any` and `all` reductions with coercion boundaries.
18. Data-mask selection: lazy `subset` predicates and column expressions across core data shapes.
19. Environment removal: captured-name `rm`/`remove` mutation with inheritance controls.
20. Reversal: attribute-compatible `rev` across owned vector and list shapes.
21. Cumulative summaries: typed sums/products/extrema with missing and overflow behavior.
22. Function cleanup and class marking: delayed `on.exit` handlers plus attribute-preserving `I`.
23. Function inspection and flattening: owned closure `body` values plus recursive/shallow `unlist`.
24. Data-mask mutation and trailing selection: non-sequential `transform` columns plus
    attribute-aware vector/list/expression/matrix/data-frame `tail`.
25. Dynamic frames and transposition: caller-stack `parent.frame` plus column-major, dimname-aware
    `t` across core matrix shapes.
26. Function signatures and repeated evaluation: closure and explicitly modeled builtin `formals` as
    owned pairlists, `formals<-`/`environment<-` wrapper generation, plus lazy `replicate`
    evaluation with list, matrix, and array simplification. Unchanged `withr 3.0.3` now exercises
    this path end to end through `with_options()`.
27. Grouping and integerization: factor-level-aware `split` across owned data shapes plus
    metadata-preserving real-vector `floor`.
28. Factor patterns and joins: truncating `gl` factor construction plus bounded atomic-column
    data-frame `merge` behavior for explicit/default keys, duplicate matches, missing values, outer
    joins, sorting, suffixes, and Cartesian products.
29. Mask mutation and trigonometry: list/data-frame `within` mutation plus metadata-preserving
    real/complex `sin` with GNU R missingness and warning behavior.
30. Factor coercion and grouped transformations: numeric-order `as.factor` plus multi-group `ave`
    with scalar/vector function results, missing-group retention, callable lookup, and
    type-preserving replacement.
31. UTC construction and Cartesian frames: recycled UTC/GMT `ISOdate` components plus atomic
    `expand.grid` generation with first-column-fast ordering, factor controls, list input,
    zero-length shapes, and output-dimension metadata.
32. Insertion and cosine: type-promoting `append` across vector-like owned shapes plus
    metadata-preserving real/complex `cos` with missingness and domain-warning behavior.
33. Stable set operations: common-type atomic matching, left-type `setdiff`, factor-level unions,
    strict list-element equality, NULL identities, and attribute-free result shapes across
    `intersect`, `setdiff`, and `union`.
34. Parallel minima: recycled common-type `pmin` selection with first-input attributes, exact
    missing-value removal, NA/NaN identity, zero-length short-circuiting, and bounded factor
    behavior.
35. Lagged differences: repeated whole-number `diff` operations across numeric/complex vectors and
    matrices, with names/dimnames, integer overflow, missing-value identity, Date/POSIX `difftime`
    units, and regular time-series index updates.
36. Vector-mode coercion: attribute-dropping atomic `as.vector` defaults, factor label/code modes,
    explicit logical/integer/double/complex/character/raw conversion, scalar-list coercion,
    list/pairlist/expression construction, data-frame unclassing, and owned-language call
    decomposition.
37. Unicode code points: `intToUtf8` conversion for coercible integer-code-point inputs, combined
    and per-element output, missing/invalid values, zero omission, supplementary-plane characters,
    and explicitly enabled UTF-16 surrogate pairs.
38. Matrix diagonals: `diag` construction from scalar dimensions or recycled atomic values,
    rectangular and zero-dimensional shapes, factor/list/character coercion, and type-preserving
    extraction with GNU R-compatible matching dimension names.
39. Formula coercion: `as.formula` conversion from character or owned language values, caller and
    explicit environment attachment (including `NULL`), existing-formula identity, and the
    deprecated multi-string warning path.
40. Quoted evaluation: `evalq` capture without eager forcing, caller/explicit/`NULL` environments,
    list, pairlist, and data-frame evaluation masks with `enclos`, environment mutation, and result
    visibility propagation; `eval` now shares those data-mask environment rules.
41. Global condition handlers: session-persistent `globalCallingHandlers` registration, querying,
    replacement, stack ordering, clearing with previous-handler return, warning/message suppression
    interaction, and top-level unhandled-error signaling.
42. Session search path: deterministic, resettable `search()` inspection of the standard nine-entry
    GNU R startup path without introducing filesystem or package-loader dependencies.
43. Dynamic call inspection: `sys.call()` access to current, absolute, and relative R-syntax closure
    calls with owned language values and GNU R-compatible frame-index errors.
44. Time-series coordinate shifting: `lag()` preserves values and owned attributes while adding or
    shifting `tsp` coordinates across vectors, lists, matrices, arrays, and existing series; rounded
    offsets, warnings, positive/negative shifts, and custom S3 method dispatch are covered.
45. Numeric interval factorization: `cut()` classifies explicit or automatically generated breaks
    with exact boundary controls, default/custom/disabled labels, ordered factors, missing-value
    propagation, duplicate-label collapse, and custom S3 method dispatch.
46. Atomic run-length encoding: `rle()` returns classed lengths/value pairs across logical, integer,
    double, complex, character, and raw vectors, including GNU R-compatible NA/NaN run boundaries,
    infinities, signed zero, empty inputs, and input-attribute restrictions.
47. Regex match objects and extraction: `regexpr()` and `gregexpr()` produce character-indexed
    locations with match-length metadata, while `regmatches()` extracts matches or inverse gaps
    across named, unmatched, missing, zero-width, and Unicode text inputs.
48. Whitespace trimming: `trimws()` supports both/left/right and partial direction selection,
    configurable ECMAScript-compatible whitespace patterns, missing values, atomic/list coercion,
    zero-length inputs, and character-vector attribute retention.
49. Time-series endpoints: `end()` reports default row-based coordinates or regular-series
    period/cycle coordinates, honors configurable `ts.eps`, validates owned `tsp` metadata, handles
    matrices, arrays, lists, negative periods, and non-integer frequencies, and dispatches S3
    methods with the original lazy arguments.
50. Grouped factor reordering: `reorder()` computes scalar per-level scores through a callable,
    retains the original-level score array, stably remaps factor codes/levels, preserves names,
    handles ordered/decreasing, missing and unused groups, and dispatches custom S3 methods.
51. Planar convex hulls: `chull()` returns clockwise boundary indices from paired, recycled, matrix,
    data-frame, complex, or index/value coordinates, with deterministic collinear, duplicate, empty,
    and non-finite behavior.
52. Numeric perturbation: `jitter()` uses the session-local deterministic RNG with GNU R-compatible
    adjacent-difference, finite-range, and constant-vector scales, explicit-amount laziness,
    non-finite propagation, empty inputs, and owned metadata retention.
53. Argument-choice normalization: `match.arg()` supports exact and unique-partial choices,
    several-choice filtering, original choice types/names, NULL, and caller-formal default inference
    through the owned closure frame rather than source reflection.
54. Logistic quantiles: `qlogis()` provides stable ordinary/log probability formulas, lower/upper
    tails, location/scale recycling, boundary infinities, missing/NaN warnings, zero-length inputs,
    and longest-numeric-argument metadata.
55. Matrix standardization: `scale()` performs column-wise centering and root-mean-square scaling
    across numeric vectors, matrices, and numeric data frames; supports logical or explicit numeric
    controls, preserves matrix metadata and custom attributes, records named `scaled:center` and
    `scaled:scale` vectors, retains NA/NaN distinctions, handles degenerate columns, and dispatches
    custom S3 methods before the default path.
56. Linear models: `lm()` builds a normalized formula/data model frame and performs browser-native
    least squares for numeric, logical, factor, and character predictors, including interactions,
    treatment contrasts, dot expansion, missing-row omission, subsets, weights, offsets, singular
    fits, prediction, model matrices, `aov()` classing, and the ranked accessor/generic family.
57. Interquartile ranges: `IQR()` and `quantile()` cover types 1 through 9 with atomic coercion,
    missing-value controls, empty and degenerate inputs, non-finite values, and attribute removal.
58. Linear-model inference: central `pt()`/`qt()` supply ordinary/log lower and upper tails,
    recycled degrees of freedom, missingness, boundaries, warnings, and metadata; weighted QR
    covariance drives `vcov()`, `confint()`, and `df.residual()` across singular fits, parameter
    selection, fit objects without retained model frames, perfect-fit warnings, and S3 dispatch.
59. Numeric clustering: `kmeans()` accepts finite numeric vectors, matrices, and numeric data
    frames; supports explicit or deterministic session-random distinct starts and `nstart`
    selection; runs owned Hartigan-Wong transfer, Lloyd/Forgy batch, and MacQueen online paths; and
    returns the standard cluster, center, sum-of-squares, size, iteration, and fault fields.
60. Signal convolution: `convolve()` supports circular, open, and filter modes across real, logical,
    complex, and factor-shaped inputs, including conjugation, multidimensional circular indexing,
    GNU R-compatible name/attribute propagation, global NA/NaN behavior, and direct plus scalable
    radix-2/Bluestein transform paths.
61. Hexadecimal integer modes: `as.hexmode()` validates integer, integral-double, and base-16
    character inputs; retains integer metadata while replacing the class; formats signed 32-bit
    values with common/explicit padding and case control; preserves the class through selection;
    prints through the browser output path; and implements the associated bitwise methods.
62. Environment list conversion: `as.list()` performs custom S3 dispatch and `as.list.environment()`
    enumerates local bindings, filters dot-prefixed names, applies optional deterministic sorting,
    preserves hash-aware unsorted order, and forces selected lazy promises in result order.
63. Browser host capabilities: `capabilities()` exposes GNU R's 19 capability names, preserves exact
    requested order and duplicates while omitting unknown names, leaves `Xchk` lazy, and reports
    unavailable graphics, profiling, network, locale, and native facilities as false.
64. Matrix condition diagnostics: `kappa()` provides owned QR estimates, exact singular-value
    ratios, direct norm/inversion paths, triangular controls, and `qr`/`lm` S3 methods.
65. Formula cross-tabulation: `xtabs()` builds column-major `xtabs`/`table` values from normalized
    formulas, data masks, factor/character/numeric axes, weighted or matrix responses, subsets, and
    documented missing/unused-level controls.
66. Random-kind control: `RNGkind()` queries or selects session-local uniform, normal, and discrete
    generators with GNU R-compatible names, abbreviations, defaults, warnings, return visibility,
    and fixed-seed evidence for independently implemented Mersenne-Twister, historical, and
    L'Ecuyer-CMRG engines, including exact parallel stream/substream jumps.
67. Integer sampling: `sample.int()` implements default-size, replacement, swap-with-last,
    fixed-population hash, weighted, and large-population rejection paths; returns integer or double
    storage at the documented population boundary; and exposes the `.Machine` constants required by
    the observed `withr` calls.
68. Locale conventions: `Sys.getlocale()`, `Sys.setlocale()`, and `Sys.localeconv()` share
    resettable evaluator state, expose `.LC.categories`, reproduce the C locale shape, and implement
    the `it_IT` and `en_US` monetary profiles used by the measured `withr` examples.
69. Tangent: `tan()` runs the measured `testthat` and `data.table` expressions through the base `pi`
    constant, vectorizes real and complex inputs, preserves owned metadata and missingness, and
    emits the observed non-finite domain warnings.
70. Syntactic names: `make.names()` powers the measured tibble formula callback with deterministic
    C-locale byte rules, reserved-word repair, optional underscores, coercion, and legal-name-first
    uniqueness; tibble applies the returned names to duplicate columns.
71. Time-series origins: `start()` complements `end()` with the measured `crayon`/`zoo` generic call
    surface, default `(1, 1)` origins, regular-series period/cycle coordinates, configurable
    `ts.eps`, decimal and negative starts, and custom S3 dispatch.
72. Roman row identifiers: `as.roman()` runs pillar's measured `utils::` call with integer-backed
    values, canonical formatting, documented historical repeated-`I` parsing, range/missing
    behavior, and matrix metadata.
73. Broken-down date-times: `as.POSIXlt()` runs the measured testthat and zoo paths through an owned
    11-component UTC/GMT representation with Date/POSIXct/numeric/character input, fractional and
    missing seconds, POSIXlt-specific length/name behavior, documented attributes, and S3 dispatch.
74. Singleton-axis reduction: `drop()` runs the measured matrixStats and posterior paths with
    arbitrary-rank singleton removal, surviving named dimensions, GNU R scalar/vector naming rules,
    zero-length axes, list/factor storage, and custom class/attribute preservation.
75. Browser raster graphics: `rasterImage()` runs the measured systemfonts and httr image shapes
    through owned page/window state and RGBA commands, transfers them from the Worker, and renders
    them in the Playground Canvas; `plot.new()` and bounded `plot.window()` provide the required
    graphics-state dependencies.
76. Model-weight dispatch: `stats::weights()` runs the 22 measured loo/posterior call shapes through
    an independent S3 generic, provides GNU R-shaped default component and `lm` behavior, preserves
    lazy dots, restores `na.exclude` positions, and leaves package-owned numerical methods to those
    packages.
77. Named-color catalog: `colors()` and its true `colours()` alias run scales' measured catalog call
    with all 657 GNU R 4.6.0 names in order, the 502-name distinct subset, numeric/logical
    selection, and registered `grDevices::` access.
78. Outer products: `outer()` runs scales' measured radial-matrix expression and builds vector/array
    Cartesian products with concatenated dimensions and dimension names, character or callable
    functions, lazy forwarded dots, and the `%o%` multiplication shorthand.
79. Nonempty strings: `nzchar()` runs data.table's captured-group conversion and Shiny's
    nonempty-input guard with atomic and bounded recursive coercion, `keepNA`, zero-length values,
    primitive argument boundaries, and attribute-free logical output.
80. Density dispatch and Gaussian defaults: `stats::density()` forwards posterior's and
    distributional's 94 measured S3 calls without reproducing package methods; `density.default()`
    adds bounded direct Gaussian grids, weights, `nrd0`, missing-value removal, and density-object
    shape.
81. Set equality: `setequal()` runs dplyr's two measured data-frame row-set comparisons, preserves
    non-dropping tibble row selection, and covers base vector/factor/list common-type, missingness,
    and duplicate semantics.
82. Small-matrix eigendecomposition: `eigen()` runs jsonlite's measured random 3-by-3 fixture,
    computes arbitrary-order real symmetric eigenpairs with Jacobi rotations, and covers bounded
    one- through three-dimensional real asymmetric matrices with real or complex results.
83. Generalized column sums: `colSums()` runs loo's measured integer-table totals and zoo's logical
    non-missing mask while covering numeric/complex arrays, numeric data frames, missing-value
    removal, higher-rank `dims`, empty reductions, and retained result axes.
84. Sampling coordinates: `time()` runs data.table's decade-spaced `uspop` path and provides the S3
    method boundary for zoo's 24 index calls, with vector/matrix defaults, regular `tsp` series,
    offsets, integer snapping, and `ts` result metadata.
85. Incomplete-case omission: `na.omit()` forwards data.table's four and zoo's four measured calls
    to package-owned S3 methods while its independent default removes incomplete vector elements or
    matrix/data-frame rows, records classed omission metadata, preserves factor and rectangular
    shape, and trims only edge-missing regular time series.
86. Upward integer rounding: `ceiling()` runs data.table's positive exponential-sample conversion
    and zoo's nested tick-alignment helper while covering double output, vector/array attributes,
    missing and non-finite values, input rejection, and direct/Math S3 method boundaries.
87. Numeric interpolation: `stats::approx()` runs data.table's sequence expansion and zoo's
    Date-to-fractional-year helper with linear/constant interpolation, endpoint rules, generated
    grids, missing pairs, duplicate reducers, and explicit-coordinate metadata.
88. Standard S4 generic dispatch: `standardGeneric()` runs S7's measured `setGeneric` definition
    body with session-local class/method lookup, formal/default/dots forwarding, `ANY`, and
    call-context boundaries.
89. Color-ramp palettes: `grDevices::colorRampPalette()` runs isoband's two measured 21-color Lab
    Viridis calls with an owned first-class palette function, linear RGB/Lab interpolation, bias,
    alpha, and byte-exact black-box output evidence.
90. Session information: `utils::sessionInfo()` runs otel's measured platform lookup with a
    deterministic browser identity, target R version, session locale/RNG state, attached core
    packages, UTC time-zone contract, and classed named-list shape.
91. Ordered-factor coercion: `as.ordered()` runs generics' measured character-vector example,
    preserves names and ordered identity, drops unused ordinary-factor levels, and forwards
    package-defined S3 methods.
92. Array coercion: `as.array()` runs rstan's measured package-method call shape, forwards lazy dots
    through S3 dispatch, and supplies an independent default with one-dimensional extents,
    name-to-dimname promotion, attribute retention, and existing-array identity.
93. Nonlinear minimization: `stats::nlm()` runs rstan's measured analytic-gradient objective shape,
    forwards lazy objective arguments, validates supplied derivatives, provides finite-difference
    gradients and Hessians, and returns bounded BFGS results with GNU R-shaped fields and
    convergence codes.
94. General-purpose BFGS optimization: `stats::optim()` runs rstan's measured separate
    objective/gradient call, forwards lazy arguments, retains parameter names, applies scaling
    controls, supplies numerical gradients and Hessians, and returns named counts and GNU R-shaped
    convergence fields.
95. Scatterplot-matrix method dispatch: `graphics::pairs()` runs rstan's measured `pairs.stanfit`
    extension shape, forwarding the classed object and lazy labels, panels, parameter selection,
    condition, and graphical arguments without reproducing package-owned plotting logic.
96. Classic HSV palettes: `grDevices::heat.colors()` runs the measured heat call, while the
    higher-priority `rainbow()` and adjacent `terrain.colors()`, `topo.colors()`, and `cm.colors()`
    share byte-exact HSV conversion, alpha recycling, reversal, hue wrapping, numeric-count
    truncation, pure-R package execution, and explicit invalid-input boundaries.
97. Factorials: `factorial()` runs xfun's measured scalar call and vectorizes an independent direct
    product/Lanczos path across integer, fractional, missing, non-finite, and attributed real
    inputs.
98. Direct least squares: `stats::lsfit()` runs xfun's measured fit and returns coefficient,
    residual, intercept, and classed QR fields from the owned pivoted solver, including matrix,
    weighting, tolerance, missing-row, and collinearity boundaries.
99. Paragraph wrapping: `strwrap()` runs xfun's measured repeated-text example and covers vectorized
    paragraphs, whitespace and sentence gaps, width/indent/prefix controls, missing-value coercion,
    and simplified character or list-shaped results.
100. Color conversion: `rgb()` closes the missed rank-207 dependency and `grDevices::col2rgb()` runs
     stringr's rank-366 measured `col2hex` helper through the complete named catalog,
     hexadecimal/alpha and transparent forms, numeric palette indices, matrix metadata, channel
     recycling, and intensity validation.
101. Array simplification: `simplify2array()` runs stringi's two measured list examples and covers
     scalar/vector promotion, unequal-length fallback, list matrices, zero-length exception
     controls, names, and higher-dimensional array metadata.
102. String-to-language parsing: `str2expression()` and `str2lang()` parse the source forms measured
     in backports through the existing owned parser, including expression vectors, calls, symbols,
     constants, comments, blank input, missing text, and result-length/type errors.
103. URL percent decoding: `utils::URLdecode()` runs backports' direct example and covers vectorized
     ASCII/UTF-8 percent bytes, literal plus signs, missing/empty/NULL inputs, namespace lookup, and
     explicit malformed-byte browser boundaries.
104. Custom warning conditions: `warningCondition()` runs backports' measured constructor and
     class-selective suppression expression with owned message/call/additional fields, custom class
     prefixes, vector condition messages, atomic coercion, and explicit missing-class boundaries.
105. Distribution quantiles: `stats::qbinom()` and `stats::qnorm()` run openssl's measured
     uniform-to-binomial and uniform-to-normal transforms with vectorized/recycled parameters,
     ordinary/log tails, metadata, missingness, canonical quantiles, and explicit browser numeric
     limits.
106. Raw-byte bit expansion: `rawToBits()` runs openssl's measured raw-to-logical conversion with
     least-significant-bit-first output, eight raw bits per input byte, attribute removal, empty
     vectors, and strict raw input validation.
107. Matrix row and column means: `rowMeans()` and `colMeans()` run matrixStats' measured subset
     validations and cover generalized arrays, numeric data frames, complex values, `na.rm`,
     surviving axis names, automatic row-name handling, and empty reductions.
108. Weighted arithmetic means: `stats::weighted.mean()` runs matrixStats' six reference comparisons
     through an S3 generic and owned numeric/complex default with zero-weight omission, paired
     missing-value removal, non-finite arithmetic, scalar shape, and explicit input boundaries.
109. Median absolute deviations: `stats::mad()` runs matrixStats' two reference values and covers
     default/explicit centers, scale constants, ordinary/low/high median selection, missing-value
     removal, empty inputs, scalar shape, and strict real-numeric boundaries.
110. Beta random generation: `stats::rbeta()` runs loo's measured prior and posterior draws with
     recycled central/non-central parameters, stable log-gamma ratios, session-local
     reproducibility, documented length rules, limit distributions, and invalid-input handling.
111. Binomial densities: `stats::dbinom()` runs loo's vectorized log-likelihood call with recycled
     parameters, stable log probabilities, metadata, boundary masses, missing/NaN distinctions, and
     non-integer/domain warnings.
112. Zero matrix/vector allocation: `base::mat.or.vec()` runs loo's measured scratch-matrix call
     with double zero storage, the documented vector branch, truncated nonnegative matrix extents,
     zero-sized dimensions, attribute removal, and strict invalid-input boundaries.
113. Primitive sequence generation: `base::seq.int()` runs data.table's three rolling-window index
     calls with one-argument length behavior, ascending/descending numeric steps,
     `length.out`/`along.with`, integer/double result selection, internal `seq` S3 dispatch, and
     allocation guards.
114. Methods coercion: `methods::as()` runs data.table's two measured package-coercion checks
     through session-local `methods::setAs()` registration, inherited source classes, core
     constructor fallback, identity handling, and explicit error boundaries without bundling
     package-owned classes or methods.
115. Weekday extraction: `weekdays()` runs data.table's two measured IDate labeling calls through
     inherited Date dispatch, deterministic C-locale full/abbreviated names, UTC/GMT POSIXt methods,
     recycled abbreviation controls, names, missing/non-finite values, and custom S3/error
     boundaries.
116. Duplicate-position lookup: `anyDuplicated()` runs data.table's measured two-column `by` query
     through package-defined S3 dispatch and supplies independent atomic/list/data-frame defaults
     with directional first positions, factor and missing-value comparison, incomparables, empty
     inputs, and bounded controls.
117. Fixed repetition: `rep.int()` runs data.table's measured adaptive-window tail construction with
     scalar/per-element counts, numeric coercion and truncation, typed atomic/list/factor/
     expression results, factor-only metadata retention, custom dispatch, and allocation guards.
118. Legacy S4 declarations: `methods::representation()` runs data.table's measured named slot list
     through the bounded `setClass`/`new` path, preserving parent/slot order and names while
     validating duplicates, missing arguments, backtick names, and scalar character declarations.
119. Toward-zero rounding: `trunc()` supplies the S3 method seam for data.table's measured ITime
     hour truncation plus independent real-vector semantics, metadata/missingness, eager default
     dots, direct/Math dispatch, and bounded type errors.
120. Automatic field conversion: `utils::type.convert()` runs data.table's measured split-column
     callback with default/list/data-frame S3 methods, deterministic type inference, missing/decimal
     controls, matrix/container shapes, factor fallback, and bounded errors.
121. Gray colors and palettes: `grDevices::gray()`/`grey()` and `gray.colors()`/`grey.colors()` run
     zoo's two measured calls through a shared deterministic RGB(A) byte path with gamma
     interpolation, scalar/recycled alpha, reversal, descending endpoints, attribute removal,
     aliases, input validation, and allocation guards.
122. POSIXct component construction: `base::ISOdatetime()` runs zoo's measured five-date index
     through the shared `ISOdate` path with required clock fields, component recycling, fractional
     seconds, UTC/GMT/empty labels, deterministic browser UTC defaults, invalid-calendar
     missingness, namespace access, metadata, and allocation guards.
123. Perspective surfaces: `graphics::persp()` runs zoo's measured classed-matrix call through
     S3-first dispatch, exact scaled/aspect-preserving `4 × 4` view matrices, missing-cell omission,
     bounded projected wireframe/box line commands, namespace access, Worker rendering, output
     accounting, and display-list replay.
124. Point graphics: `graphics::points()` runs zoo's documented S3 extension point and an owned
     numeric default with paired/vector/matrix/data-frame/list/complex coordinates, numeric and
     character plotting symbols, recycled colors/fills/sizes/widths, missing-point omission,
     namespace access, bounded Worker/Canvas rendering, and display-list replay.
125. Polygon graphics: `graphics::polygon()` runs zoo's measured filled-area panel helper with
     vector/matrix/data-frame/list/complex coordinates, missing-coordinate polygon splitting,
     recycled fills/borders/line types/widths, solid/no-fill density, even-odd rules, namespace
     access, bounded Worker/Canvas rendering, and display-list replay.
126. Immutable value replacement: `base::replace()` runs zoo's measured missing-run helper through
     the shared one-dimensional subset-replacement path with input immutability, subscript forms,
     recycling, promotion, names/extension, matrices, factors, lists, pairlists, owned data frames,
     `NULL` paths, namespace access, warnings, errors, and resource bounds.
127. Log-normal random generation: `stats::rlnorm()` runs zoo's measured flow generator through the
     evaluator-owned Mersenne-Twister/Inversion stream with historical fixed-seed evidence,
     scalar/vector count rules, recycled log-scale parameters, zero-deviation point masses,
     missing/domain warnings, namespace access, and resource bounds.
128. Ragged-array grouping: `base::tapply()` runs zoo's measured screen-range callback with
     factor-level dimensions/dimnames, missing-group omission, scalar atomic/default simplification,
     unsimplified list arrays, forwarded arguments, function-name resolution, `FUN = NULL` group
     codes, errors, and resource bounds.
129. Plot text: `graphics::text()` runs zoo's measured rotated outside-label call with S3 dispatch,
     coordinate/label recycling, truncation warnings, missing omission, resolved browser text
     styles, Worker/Canvas rendering, display-list replay, namespace access, and resource bounds.
130. Model-call updates: `stats::update()` runs zoo's measured lattice extension call through lazy
     S3 dispatch, inherited method selection, `NextMethod`, namespace access, independently authored
     defaults, deterministic unsupported boundaries, and resource limits.
131. Matrix-series graphics: `graphics::matplot()` runs bit64's six measured performance plots with
     vector/matrix/data-frame inputs, generated x coordinates, column/style recycling, incomplete
     omission, logarithmic coordinates, point/line series, Worker/Canvas rendering, display-list
     replay, namespace access, and resource limits.
132. Array-axis permutation: `base::aperm()` and `aperm.default()` run bit64's measured matrix axis
     swap with numeric/character permutations, reverse defaults, dimension/dimname resizing,
     fixed-shape output, atomic/list arrays, lazy S3 dots, inherited dispatch, `NextMethod`,
     namespace access, attribute cleanup, and resource limits.
133. Text serialization: `base::dget`, `dput`, `tempfile`, and `unlink` run bit64's measured
     classed-data-frame roundtrip through a bounded session-local browser-memory text store. The
     independently authored serializer preserves owned atomic/list/pairlist values, ordinary
     attributes, missingness, complex/raw values, and Unicode before reparsing through the
     normalized-AST evaluator. Host paths/connections, nondefault controls, functions/environments,
     cycles, binary formats, and persistence remain separate I/O and serialization work.
134. High-reach plot generic: `base::plot()` and `graphics::plot.default()` cover rank 22's measured
     package S3 extension point and numeric vector/x-y shapes with bounded point/line/histogram/step
     geometry, range padding, common styles, panel hooks, scalar labels, Worker/Canvas rendering,
     display-list replay, differential visibility evidence, and resource limits.
135. Browser text connections: usage-ranked `base::file`, `close`, `tempdir`, and `file.exists`,
     plus adjacent `open`, `flush`, `isOpen`, and `seek`, expose bounded session-owned handles over
     browser-memory files and immutable installed-package resources. GNU R differential cases cover
     implicit opens, explicit read/write/append modes, persistent cursors, summaries, destruction,
     `readLines`, `writeLines`, `cat`, and `utils::capture.output`; forged handles, package writes,
     and host paths are rejected. Raw `readBin()` retrieval now covers owned binary files; typed
     binary decoding/writes, URLs, sockets, compressed seeking, and the wider filesystem remain
     separate host-adapter work. Rank-203 `gzcon` now adds browser-native gzip wrapping below.
136. Browser-owned directories and relative paths: ranks 48 `base::R.home`, 129 `base::dir.create`,
     and 135 `base::list.files`, with `dir.exists`, `dir`, `list.dirs`, `getwd`, `setwd`,
     `normalizePath`, `basename`, and `dirname`, expose bounded session, package, and runtime roots.
     Package code can enumerate installed resources, select a package subdirectory as its working
     directory, and use unchanged relative text/table paths; session code can create and recursively
     remove nested directories. Absolute host paths, root escape, symlinks, permissions, and mounts
     remain explicit boundaries.
137. Explicit command host seam: rank-176 `base::system` represents five calls across withr, knitr,
     and data.table at 3.3% weighted reach. The measured calls request `R CMD SHLIB`, `pandoc`, or
     `diff`; they are external-tool features rather than pure-R language work. NativR now supplies
     GNU R-shaped validation, result/warning behavior, and a typed inline/Worker bridge only when an
     application configures `systemCommand`. Default execution remains unavailable, and native
     compilation is still rejected by the source-only package installer.
138. Installed package examples: rank-196 `utils::example` represents four calls across rstan,
     pkgload, and data.table at 2.8% download-weighted reach. Standard source-package `man/*.Rd`
     sections are extracted deterministically at build time; topic/alias lookup, active virtual
     libraries, package loading, global/local execution, `give.lines`, and explicit
     `run.dontrun`/`run.donttest` controls reuse the normalized-AST Worker path. This turns
     unchanged package examples into executable gap discovery. Interactive HTML/help databases,
     prompting, exact source/echo formatting, RNG restoration, abort recovery, and examples that
     need still unsupported runtime features remain compatibility depth.
139. Gzip connections: rank-203 `base::gzcon` represents six calls across jsonlite and curl at 2.5%
     download-weighted reach. It wraps evaluator-owned package/session connections with bounded
     browser-standard gzip streams, GNU R-shaped connection classes/summaries, raw and text reads,
     noncompressed pass-through warnings, close-time writes, exact formal names, package resource
     evidence, and a Worker roundtrip. This supplies the reusable compression layer used by package
     R code; `url()`/curl transports, sockets, typed `readBin`/`writeBin`, seeking within compressed
     streams, and compression-level byte identity remain separate capabilities.
140. Installed package vignettes: rank-204 `utils::vignette` represents five calls across Rcpp and
     data.table at 2.4% download-weighted reach. The source-package installer extracts a bounded,
     deterministic catalog from `inst/doc` R Markdown, Sweave, `pdf.asis`, extracted R, and prebuilt
     HTML/PDF files. Runtime lookup follows virtual `package`/`lib.loc`, `all`, attached package,
     missing-topic, `packageIQR`, and seven-field `vignette` object semantics; a Worker package
     proves the same path. Building development vignettes, lazy help databases, `print.vignette`,
     and automatic browser/PDF viewers remain separate build and host work.
141. Callable signature reconstruction: rank-205 `base::args` represents three calls across S7 and
     StanHeaders at 2.4% download-weighted reach. Closure defaults and ellipsis, registered builtin
     and operator formals, string lookup, global result environments, `NULL` bodies, and silent
     non-function results have GNU R differential evidence. Source-only inline and Worker package
     calls prove the reusable loader seam; S7's wider protocols and StanHeaders' native routines
     remain outside this slice.
142. Dynamic S3 registration: rank-208 `base::registerS3method` represents two calls across pillar
     and knitr at 2.4% download-weighted reach. Hidden closure or string-named methods, replacement,
     visible-method precedence, base and closure generic-definition environments, exact formals,
     invisible return, reset, and failed-package-load rollback have executable evidence. A package
     `.onLoad()` uses the path inline and in the default Worker. Delayed registration for an
     unloaded suggested package and complete S3 introspection remain package-system depth.
143. Virtual file metadata: rank-209 `base::file.info` represents three calls across digest,
     data.table, and shiny at 2.4% download-weighted reach. Its stable six-column frame, duplicate
     and missing row names, exact byte sizes, directory flags, `octmode` modes, `POSIXct` times,
     `extra_cols`, and the `file.mode`/`file.mtime`/`file.size` wrappers have executable evidence.
     Session files update owned write/read timestamps; package resources remain immutable and expose
     deterministic metadata inline and through the default Worker. Host paths, platform owners,
     links, ACLs, and native filesystem timestamp fidelity remain explicit boundaries.
144. Perceptual HCL colors: rank-214 `grDevices::hcl` represents six calls across ggplot2 and zoo at
     2.3% download-weighted reach. The independent polar CIE-LUV/D65-to-sRGB path executes ggplot2's
     2,500- and 10-color raster vectors plus zoo's opaque/translucent event colors, with recycling,
     alpha, missing/non-finite coordinates, gamut fixup, exact formals, finite range errors, pure-R
     package execution, and default Worker evidence. ICC/device color management, `hcl.colors`, and
     broader conversion helpers remain compatibility depth.
145. Dynamic source loading: ranks 221 `base::source` and 222 `base::textConnection` run rlang's two
     measured `source(textConnection(...), echo = TRUE, local = TRUE)` calls through browser-owned
     text, the normalized AST, and the ordinary evaluator. Complete pre-parse, environment
     selection, sequential side effects, final value/visibility, echo/printing, connection
     lifecycle, exact formals, package namespace execution, Worker transport, errors, and resource
     limits have executable evidence. Output connections, host files, source references,
     `catch.aborts = TRUE`, and exact console formatting remain explicit boundaries.
146. Interactive line input: rank-230 `base::readline` represents two calls across curl and crayon
     at 2.1% download-weighted reach. Default non-interactive output/empty return, exact formals,
     prompt coercion and bounds, R whitespace trimming, validated asynchronous inline/Worker
     responses, resource limits, capability-aware `interactive()`, pure-R package execution, and a
     real Playground dialog have executable evidence. Terminal editing/history, EOF distinctions,
     password masking, and automatic trust for package prompts remain outside the contract.
147. URL input connections: rank-232 `base::url` represents six calls across jsonlite and openssl at
     2.1% download-weighted reach. GNU R formals, class, and closed summary; validated methods and
     named headers; lazy one-request loading; cursor reuse; response type/size enforcement;
     unchanged pure-R package execution; gzip composition; default Worker transport; and a
     zero-network Playground example have executable evidence. The runtime has no ambient network
     authority: HTTP status, redirects, authentication, cookies, CORS, caching, cancellation, origin
     policy, native libcurl, and writable URL connections remain host or compatibility depth.
148. Time-series filtering: rank-239 `stats::filter` has one genuine measured core call in zoo's
     recursive log-normal flow example. The owned implementation covers convolution and recursive
     methods, one- or two-sided and circular convolution, vector and multivariate matrix series,
     `tsp`/`ts`/`mts` results, missing propagation, recursive `init`, partial method matching, and
     GNU R formals. An unchanged source-only package and the default Worker Playground use the same
     function without translation. Data-frame coercion, complex filtering, irregular zoo indexes,
     and exact native implementation details remain compatibility depth. The snapshot's jsonlite
     occurrence resolves to dplyr after attachment and is retained only as an auditable collector
     limitation.
149. Installed package descriptions: rank-245 `utils::packageDescription` represents cli's one
     complete installed-package metadata example at 1.9% download-weighted reach. The runtime
     returns selected or full named DESCRIPTION lists, missing fields, the `packageDescription`
     class, `fields` and virtual `file` attributes, scalar dropping, warnings, encoding controls,
     exact formals, and bounded core fields without loading a namespace. An unchanged source-only
     fixture mirrors cli's `unclass()`/field access, unchanged `pkgconfig 2.0.3` proves public
     artifact metadata, and the default Worker Playground uses the same path. Host libraries,
     malformed installed trees, complete core DESCRIPTION prose, arbitrary `iconv` codecs, and
     package-description print/citation/date methods remain compatibility depth.
150. Standard terminal connections: rank-246 `base::stdout` represents cli's one measured terminal
     selection call at 1.9% download-weighted reach; adjacent `stderr` removes curl's later rank-342
     occurrence. Stable `stdin`/`stdout`/`stderr` descriptors, class/identity/summary, access
     queries, false embedded-browser `isatty`, exact formals, flush and invalid lifecycle
     operations, user/standard catalogs, close-all behavior, pure-R package execution, and default
     Worker stdout/stderr routing have evidence. Streaming stdin, `sink`, pushback, terminal
     negotiation, and host descriptors remain compatibility depth.
151. Vectorized rectangles: rank-253 `graphics::rect` represents three measured calls across sass
     and zoo at 1.8% download-weighted reach. The runtime recycles the four coordinate vectors,
     skips missing/non-finite rectangles, resolves transparent/palette fills and borders plus
     `par()` line defaults, and emits the existing bounded polygon event. Exact formals, invisible
     results, density-zero and negative-density behavior, display-list replay, source-only package
     execution, default Worker transport, and Playground Canvas rendering have evidence. Positive
     hatch density, coordinate classes, clipping/log axes, arbitrary graphical parameters, and
     device-identical joins remain compatibility depth.
152. Per-path file removal: rank-256 `base::file.remove` represents four measured calls across xfun
     and data.table at 1.8% download-weighted reach. It removes closed session-owned files with one
     visible logical result per path and a bounded warning for each failure. GNU R formals, argument
     validation/coercion, attribute removal, duplicate/missing paths, immutable package resources,
     open connections, namespace execution, default Worker transport, and resource limits have
     evidence. Host files, wildcard expansion, directory removal, and native platform error text
     remain compatibility depth.
153. Fixed-width character input: rank-259 `base::readChar` represents digest and Shiny's two
     measured calls at 1.7% download-weighted reach. Raw vectors, immutable package files, mutable
     session files, and file/URL/gzip connections share UTF-8 character or exact-byte counting,
     length-vector/EOF behavior, open cursor and closed lifecycle rules, text-mode warnings, invalid
     NUL/UTF-8 boundaries, exact formals, pure-R namespace execution, default Worker transport, and
     resource limits. Host files, native locale codecs, streaming stdin, and the adjacent
     `writeChar` surface remain compatibility depth.
154. Browser-native PDF device: rank-281 `grDevices::pdf` represents two measured calls across knitr
     and data.table at 1.7% download-weighted reach. `pdf(NULL)` supplies the recording-only
     lifecycle needed by `recordPlot()`, while file-backed devices write valid bounded PDF object
     graphs with multi-page/numbered output, base-14 fonts, metadata, alpha states, optional Flate
     compression, raw reads, exact formals and visibility, and default Worker execution. Embedded
     fonts, arbitrary encoding maps, exact metrics/kerning, full device controls, and byte identity
     with GNU R remain compatibility depth.
155. Session-owned file creation: rank-287 `base::file.create` represents withr's one measured call
     at 1.6% download-weighted reach. It creates or truncates zero-byte session files with exact
     dots/`showWarnings` matching, first-character/later-atomic argument rules, validation before
     mutation, vectorized visible logical results, silent missing paths, per-path warnings, package
     and Worker execution, and file/result resource bounds. Recursive parents, host files,
     permissions/umasks, links, devices, platform-exact diagnostics, and persistence remain
     compatibility depth.
156. Aligned time-series plotting: rank-292 `stats::ts.plot` represents magrittr's exposition-pipe
     example at 1.6% download-weighted reach. Unnamed vectors, regular `ts`/`mts` values, matrices,
     and data frames become bounded aligned columns on a shared frequency/time range; absent
     observations split paths, common line/point styles recycle by series, and `gpars` controls
     linear/log windows, annotations, and frames through the existing graphics journal. GNU R 4.6
     formals, visibility, user-window ranges, alignment errors, pure-R package execution, Worker
     transport, and Canvas rendering have evidence. The broader `plot.ts` multi-panel method,
     irregular indexes, every graphical parameter, exact axes/margins, and device-identical pixels
     remain compatibility depth.
157. Explicit executable discovery: rank-293 `base::Sys.which` represents two measured knitr/sys
     checks at 1.6% download-weighted reach. `createR({ executablePaths })` snapshots a NUL-free
     executable-name-to-path allow-list for inline or Worker sessions; default sessions expose no
     ambient PATH, package code receives named empty strings for absent tools, reset restores the
     initial map, and ordinary atomic/list/language coercion follows GNU R 4.6 black-box evidence.
     Host PATH/PATHEXT scanning, filesystem existence, platform path normalization, GNU closure
     identity, and an `NA` value in the names attribute remain compatibility depth.
158. Persistent output diversion: rank-330 `base::sink` represents utf8's two measured calls at 1.2%
     download-weighted reach. A session-owned router composes `sink()` and `capture.output()` by
     creation order, retains 19 nested output frames across evaluations and errors, tees split
     output, routes one replaceable message connection, and preserves automatically opened versus
     already-open connection lifecycle. GNU R 4.6 formals, restoration, append mode, pure-R package
     execution, default Worker execution, conformance, and output limits have evidence. Host paths,
     native descriptors, and interaction with an active target remain compatibility depth.
159. Atomic file writer: rank-338 `base::write` represents sass's measured source-line call at 1.2%
     download-weighted reach. GNU R 4.6 character/numeric column defaults, repeated separator
     vectors, underlying atomic/matrix/factor storage, append, final newlines, invisible return,
     closed/open connection lifecycle, exact formals, source-package execution, Worker execution,
     conformance, and resource limits have evidence. Host files, native encodings, platform line
     endings, and non-atomic values remain compatibility depth.
160. Repository package catalog: rank-340 `utils::available.packages` represents curl's measured
     reverse-dependency database call at 1.2% download-weighted reach. `contrib.url`, bounded
     UTF-8/gzip DCF parsing, GNU R 4.6-shaped package matrices, extra/missing fields, standard and
     package-defined filters, duplicate selection, cache controls, headers, source-package
     execution, Worker execution, conformance, and resource limits have evidence. Ambient network,
     persistent host caches, archive installation, binary execution, and dependency-recursive
     license proof remain compatibility depth.
161. Browser bar plots: rank-343 `graphics::barplot` represents three measured calls across zoo and
     bit64 at 1.2% download-weighted reach. GNU R 4.6 midpoint shapes, vector/matrix inputs,
     stacked/beside widths and spacing, offsets, names, axes, annotations, legends, S3 package
     methods, unchanged source-package execution, Worker/Canvas rendering, conformance, and resource
     accounting have evidence. Log axes, positive hatch density, complete graphical parameters, and
     device-exact layout remain compatibility depth.
162. Browser page prompting: rank-344 `grDevices::devAskNewPage` represents RColorBrewer's ten
     measured calls at 1.1% download-weighted reach. GNU R 4.6 formals, return visibility,
     first-element logical coercion, invalid inputs, `device.ask.default`, per-device isolation,
     unchanged source-package execution, non-interactive/file-device bypass, and the default Worker
     `readline` round trip have evidence. Native graphics event loops and platform screen devices
     remain compatibility depth.
163. Loaded-module introspection: rank-345 `base::getLoadedDLLs` represents ps's measured path probe
     at 1.1% download-weighted reach. Exact no-argument formals, visible `DLLInfoList` shape,
     `vapply(..., "path")`, empty subsetting, unchanged source-package execution, Worker execution,
     and rejection of extra arguments have evidence. The default list is empty; explicit
     `nativeModules` add only owned virtual paths and lookup flags, with `NULL` pointer fields.
     Arbitrary DLL entries and automatic compiled-package loading remain compatibility depth.
164. Typed native calls: rank-358 `base::.Call` represents digest's measured native entry point at
     1.0% download-weighted reach. Primitive shape, invalid-name/default-deny behavior, explicit
     module/package resolution, dynamic and force-symbol policy, registered arity, bounded snapshot
     values, inline/Worker transport, and Playground execution have evidence. GNU SEXP/external
     pointers, `.External`, automatic Wasm compilation, and arbitrary compiled packages remain
     compatibility depth.
165. Session-owned file copying: rank-348 `base::file.copy` represents xfun's one measured resource
     staging call at 1.1% download-weighted reach. GNU R 4.6 formals, empty-source laziness,
     vectorization, overwrite, recursive directories/dotfiles and result shapes combine with exact
     immutable-package-to-session binary copies, unchanged package code, default Worker execution,
     conformance, and storage/file/result limits. Host paths, links/devices, native permissions and
     cross-session persistence remain compatibility depth.
166. Host-backed spell checking: rank-363 `utils::aspell` represents knitr's two measured calls at
     1.0% download-weighted reach. Exact GNU R 4.6 formals, program selection, virtual file reads,
     encoding recycling, arbitrary R filter functions, Ispell `-a` requests, five-column `aspell`
     data frames, suggestions, empty results, pure-R package execution, and default Worker transport
     have evidence. The runtime reuses the explicit `executablePaths`/`systemCommand` policy and
     never bundles a dictionary or process runner. Built-in Rd/Sweave/R/pot/dcf/md filters,
     serialized R dictionaries, exact checker diagnostics, and ambient program discovery remain
     compatibility depth.
167. Browser reference lines: rank-364 `graphics::abline` represents knitr's measured plot-change
     call at 1.0% download-weighted reach. Exact formals/defaults, coefficient precedence and
     warnings, `a`/`b`, `coef`, one- and two-coefficient model objects through arbitrary S3
     `coef.*`, vectorized `h`/`v`, continuous style recycling, clipping, display-list replay,
     unchanged pure-R package code, and default Worker/Canvas rendering have evidence. Logarithmic
     transforms, non-plot-region `xpd` extension, and exact device line-cap/join metrics remain
     compatibility depth.
168. S4 method signatures: rank-425 `methods::signature` represents inline's 18 measured calls at
     0.6% download-weighted reach. GNU R-compatible empty/named/mixed/missing shapes and invalid
     element boundaries combine with real named and positional multi-argument `setMethod` dispatch,
     inherited classes, `ANY` fallback, and differential conformance. This advances inline's pure-R
     registration layer without claiming execution of its compiled native payloads; ambiguous
     methods, union classes, primitive/group generics, and the complete methods package remain
     depth.
169. Download-ranked package depth: R6 is package rank 6 in the committed snapshot with 2,110,617
     downloads, so unchanged R6 2.6.1 is now the fourth digest-pinned external execution proof. Its
     first real load exposed reusable gaps rather than package-specific work: non-core shim
     precedence, qualified S3 registration, environment/closure attributes, NULL empty-vector
     behavior, environment/binding locks, and `.subset`/`.subset2`. The resulting test installs and
     loads unchanged source, creates a generator and reference object, calls a public method, and
     mutates a field. This is package/version evidence selected by measured reach; it does not turn
     R6 examples, cloning/finalization, inheritance breadth, or arbitrary packages into claimed
     compatibility.
170. Download-ranked R6 depth: package-rank-6 R6 uses Base R active bindings to implement computed
     reference fields, so the next increment adds generic `makeActiveBinding`, `bindingIsActive`,
     and `activeBindingFunction` semantics rather than an R6 adapter. GNU R differential evidence
     covers repeated getter invocation, replacement callbacks, nested replacement, inspection,
     environment-to-list forcing, visibility, and binding locks. The unchanged R6 2.6.1 proof now
     runs public methods over private state and a read/write active field. Cloning, finalization,
     inheritance breadth, active-binding substitution, and arbitrary packages remain unclaimed.
171. Download-ranked R6 clone depth: the unchanged package's ordinary `clone()` implementation
     exposed missing generic `mget`, first-class `[[`, and `mapply`/`Map` result names. Those Base R
     capabilities now have GNU R 4.6 differential evidence, and the digest-pinned R6 2.6.1 proof
     verifies shallow nested-reference sharing plus recursive deep-copy independence. No R6 source,
     adapter, or package-specific branch was added. Finalization, inheritance breadth,
     portable-locking variants, and arbitrary packages remain unclaimed.
172. Download-ranked R6 inheritance depth: the unchanged package's ordinary multi-level
     `inherit`/`super` implementation exposed generic GNU R `NULL` extraction and replacement
     promotion gaps. Differential evidence now covers index forcing, missing `[[` indices,
     primitive-style positional tags, atomic/list promotion, typed gaps, names, empty selections,
     and long false logical replacement indices. Digest-pinned R6 2.6.1 then constructs a
     three-level hierarchy and runs recursive `super$initialize()`/`super$greet()` paths without an
     adapter or package patch. Finalization, arbitrary/multiple inheritance breadth,
     portable-locking variants, and arbitrary packages remain unclaimed.
173. Download-ranked package depth: viridisLite is package rank 30 in the committed snapshot with
     1,465,142 downloads and no runtime package dependencies. Its unchanged 0.4.3 source first
     exposed missing `grDevices::colorRamp`, then the more general loss of matrix attributes through
     arithmetic. GNU R differential evidence now covers array/long-operand attribute propagation and
     linear/not-a-knot spline numeric ramps in RGB/Lab space. The digest-pinned fifth external proof
     executes `viridis()`, `magma()`, and a reversed translucent range without copied package
     source, an adapter, or evaluation-time network access. It does not claim every viridisLite
     function, every palette boundary, or arbitrary packages.
174. Download-ranked package depth: RColorBrewer is package rank 35 in the committed snapshot with
     1,410,661 downloads, no runtime package dependencies, and Apache-2.0 metadata. Its unchanged
     1.1-3 source exposed `data.frame(..., row.names=)` being misclassified as a data column.
     Generic differential evidence now covers exact trailing formals, explicit/automatic/zero-column
     row names, atomic coercion, missing/duplicate/length errors, and `check.names`. The
     digest-pinned sixth external proof executes exported 35-row metadata, Set1 and Blues palettes,
     and the recursive minimum-size warning without copied package source, an adapter, or
     evaluation-time network access. Display helpers and arbitrary packages remain unclaimed.
175. Source-blind package generalization: dependency-free rematch 2.0.0 and whisker 0.4.1 were
     admitted as holdouts before their source was inspected or executed. Public documentation and
     black-box GNU R observations identified representative surfaces; unchanged packages now reach
     P4 through reusable `NROW`/`NCOL`, dimension-name replacement, regex/replacement/splitting,
     apply-family matching, factor-label comparison, and atomic-to-list replacement semantics. Full
     regex-engine identity, every export, P5-P7, and arbitrary packages remain unclaimed; zeallot
     0.2.0 and ini 0.3.1 replace them as untouched P0 holdouts.
176. Source-blind package generalization: unchanged zeallot 0.2.0 and ini 0.3.1 now reach P4 after
     their public manuals and black-box GNU R behavior were frozen. The reusable increment covers
     string affixes, capture locations, language equality, constructed assignment, promise-origin
     caller frames, embedded runtime constants, and recursive character coercion. Every export,
     complete regex identity, P5-P7, and arbitrary packages remain unclaimed; usage-ranked cpp11
     0.5.5 (package rank 13) and otel 0.2.0 (rank 29) are the next untouched P0 holdouts.
177. Source-blind package generalization: unchanged cpp11 0.5.5 and otel 0.2.0 now reach P4 after
     public manuals, formals, and GNU R black-box outputs were frozen. The reusable increment splits
     executable-source and immutable-resource budgets and adds list-aware `sprintf`, `strrep`,
     `length<-`, `anyNA`, and `make.unique`. cpp11 native compilation, real telemetry exporters,
     every export, P5-P7, and arbitrary packages remain unclaimed. Rank-50 BH 1.90.0-1 is the only
     remaining top-100 package with no non-core runtime dependency and `NeedsCompilation: no`, so it
     becomes the next untouched P0 holdout.
178. Source-blind package generalization: unchanged BH 1.90.0-1 now reaches P3 after its official
     metadata and GNU R resource shape were frozen. The reusable increment raises still-bounded
     package admission to 16,384 files and 192 MiB, makes archive-limit errors reject promptly,
     validates resources before Worker transfer, and resolves standard `exportPattern()`
     declarations from loaded local namespace bindings. BH exposes 12,554 headers totaling
     128,040,580 bytes and exports no R functions, so P4 is not applicable rather than claimed. This
     exhausts eligible standalone candidates in the committed top-100 snapshot; the next
     package-priority step must measure dependency closures, including explicit native/Wasm
     blockers, rather than inventing a replacement holdout.
179. Package-depth graphics closure: unchanged labeling 0.4.3 advances from P4 to P5 through
     `extended.figures(2)`. The reusable increment adds GNU R-shaped shared-control handling for
     `axis(xlab=)`, `barplot` category/numeric suppression through `xaxt`/`yaxt`, the ordered
     72-entry `par()` inventory, the 66-entry mutable view, and read-only restoration warnings. The
     figures path runs under an explicit 128 MB output bound because it emits many browser graphics
     events. This is a package-depth proof, not complete graphical-parameter effects, package tests,
     package check, or arbitrary-package compatibility.
180. Usage-prioritized example depth: package-rank-6 R6 2.6.1 advances from P4 to P5 by executing
     both official `R6Class` Rd example blocks unchanged through generic `utils::example()`. The
     evidence pins the GNU R-observed invisible returned visibility record and all eight stdout
     events. No R6 source, package adapter, or package-specific runtime branch is added; finalizers,
     arbitrary inheritance breadth, P6 tests, P7 check behavior, and arbitrary packages remain
     unclaimed.
181. Generic P6 package-test depth: unchanged numDeriv 2016.8-1.1 advances from P4 to P6. The
     packager can opt in to bounded `tests/**` retention and a versioned top-level test manifest;
     normal artifacts still omit tests. All four Rd topics and all seven original package scripts
     execute through the generic virtual filesystem and normalized-AST runtime. Reusable semantic
     closure adds empty `NULL` subsetting, `diag<-`, browser-safe `Sys.info()`, exact complex
     integer powers, and real/complex `asin`/`acos`/`atan`. The computationally large CSD test uses
     explicit finite resource overrides. This is P6 evidence for one regression package, not P7,
     universal package compatibility, or permission to weaken default browser limits.
182. Generic P6 metaprogramming and array depth: unchanged abind 1.4-8 advances from P4 to P6 after
     all five Rd topics and five original test scripts execute through the generic package runner.
     Reusable closure covers language/expression entry operations, replacement-call introspection,
     pairlist apply-family inputs, standard constants and `prod`, matrix/data-frame coercion, array
     defaults, nested `NULL` replacement, and short-name padding. The largest array case uses an
     explicit finite resource override. This does not claim automatic `.Rout.save` comparison, P7,
     complete `R CMD check`, or arbitrary-package compatibility.
183. Generic package-example and call-lifecycle depth: unchanged generics 0.1.4 advances from P4 to
     P5 by executing all three applicable Rd topics. The withr `defer` path adds closure-valued
     `as.call` heads, target-environment `do.call(on.exit, ...)`, function-scoped `local` cleanup,
     and aligned `sys.calls`/`sys.frames`. It identified `reg.finalizer` as a reusable lifecycle
     gap.
184. Environment lifecycle and full withr topic traversal: reachability-based `reg.finalizer`,
     reverse-order GC callbacks, session-exit callbacks, circular device navigation, timezone-cache
     restoration, POSIXct formatting, NULL-aware `mapply`, and list-path `unlink` coercion let the
     unchanged `defer` and other applicable topics complete. Withr remains P4 because its first P5
     blocker is now `datasets::mtcars`; `datasets::iris` and pre-R-1.7 RNG engines are separately
     mapped later gaps. No no-op finalizer or package-specific branch is counted as compatibility.
185. Generic core-package data admission: provenance-audited `datasets` resources load through the
     same `data/*.R` and CSV machinery used by source packages, populate an isolated static
     namespace, and appear on the default search path. Exact GNU R differential evidence covers
     `mtcars` types, dimensions, row names and namespace identity plus corrected `iris` values and
     factor levels. Unchanged withr `with_par` and `with_tempfile` examples now pass; its first P5
     blocker moves to the historical pre-R-1.7 RNG engines used by `with_rng_version`.
186. Historical uniform RNG closure: independently implemented Wichmann-Hill and
     Marsaglia-Multicarry recurrences, versioned seed initialization, warning order, and Rounding
     sampling reproduce fixed-seed GNU R sequences. Unchanged withr `with_rng_version` now passes,
     so all applicable withr Rd topics reach P5. At this increment, Buggy Kinderman-Ramage normal
     draws remained an explicit reusable runtime gap; increment 187 closes it without delegating to
     Inversion.
187. Historical normal RNG closure: the independently reconstructed Buggy Kinderman-Ramage generator
     preserves its legacy triangular coefficient and omitted near-zero density acceptance test.
     Fixed-seed GNU R black-box sequences cover all five rejection regions and the complete pre-1.7
     Marsaglia normal stream. Corrected Kinderman-Ramage and the remaining alternative normal
     engines stay explicit boundaries. Withr's retained `testthat.R` driver establishes its first P6
     blocker as the unavailable native-compilation testthat dependency; this is deferred to the
     reusable native-package ABI rather than replaced with a package-specific shim.
188. Corrected normal RNG closure: `normal.kind = "Kinderman-Ramage"` reuses the owned published
     transform with the corrected triangular coefficient, restored near-zero density acceptance, and
     negative-candidate rejection. Fixed-seed and targeted correction-region GNU R black-box cases
     pass. Ahrens-Dieter, Box-Muller, and user-supplied normal engines remain explicit gaps.
189. Download-ranked package example depth: package-rank-35 RColorBrewer 1.1-3 advances from P4 to
     P5 by executing its sole installed Rd topic unchanged. The example closes reusable
     `plot.default(bty=)` frame selection and GNU R's ASCII-space-insensitive named-color lookup;
     invalid box types, tabs, and hyphenated color spellings remain strict errors. Package-rank-30
     viridisLite's unchanged `viridis` topic is now executable evidence for its exact first P5
     blocker, the unavailable external package `ggplot2`, rather than an inferred package status.
190. Higher-ranked package metadata depth: package-rank-13 cpp11 0.5.5 drives a reusable
     browser-owned `read.dcf()` implementation with record continuation, selected/missing fields,
     duplicate-field `all = TRUE` data frames, whitespace controls, exact formals, and malformed
     input failures. The unchanged `cpp_vendor` topic passes; `cpp_register` and `cpp_source`
     deterministically stop at their declared missing R-package dependency closures. cpp11 remains
     P4, and no compiler or package-specific bypass is introduced.
191. Higher-ranked package example depth: package-rank-29 otel 0.2.0 advances from P4 to P5 by
     executing all 45 frozen installed Rd topics unchanged. The example chain closes reusable
     primitive `is.finite()` semantics, aligned owned-stack `sys.nframe()`, top-level environment
     discovery through `topenv()`, and the locked reset-safe `.GlobalEnv` binding. No telemetry
     exporter, network capability, package branch, or rewritten package source is introduced.
192. Package condition and reflection depth: unchanged assertthat 0.2.1 advances from P4 to P5 by
     executing all 11 frozen installed Rd topics, while praise 1.0.0 advances through its sole
     topic. The failure chain closes reusable `is.primitive`, explicit-definition `match.call`,
     unique-partial `all.equal` controls, class-preserving custom conditions, and browser-owned
     `file.access` semantics. No assertion-package branch, host permission probe, or source rewrite
     is introduced.
193. Package formatting and time-unit depth: unchanged prettyunits 1.2.0 advances from P4 to P5 by
     executing all eight frozen installed Rd topics. The failure chain closes reusable S3
     `units`/`units<-` difftime rescaling, primitive `is.infinite`, and browser-owned `formatC`
     controls. No prettyunits branch, host formatter, locale probe, or source rewrite is introduced.
194. Package evaluation-lifecycle depth: unchanged evaluate 1.0.5 advances from P4 to P5 by
     executing all six frozen installed Rd topics. Shared dynamic calling handlers, standard muffle
     and named restarts, cooperative interrupt control, hook composition, source references,
     recursive mixed-value `unlist`, expression-vector/data-frame behavior, sequence controls, and
     recorded plots close the observed blockers. The example's system query uses a caller-supplied
     generic host adapter; no evaluate branch, ambient process authority, or source rewrite is
     introduced.
195. Core-data and broad package-example depth: provenance-audited `InsectSprays` and `faithful`
     enter the generic static `datasets` path, and unchanged rprojroot 2.1.1, rstudioapi 0.19.0,
     rematch 2.0.0, whisker 0.4.1, zeallot 0.2.0, and ini 0.3.1 advance from P4 to P5 by executing
     every runnable block in their exact frozen installed help manifests. No package branch,
     rewritten source, ambient IDE authority, or host filesystem access is introduced.
196. Recursive function and environment evidence: `body()` preserves symbol, atomic literal, NULL,
     call, and block storage types at the AST boundary, while empty `formals()` is NULL. Oracle v2
     traverses captured closure bindings, environment parents/cycles, nested attributes, language
     structure, and shared reference identity. Seven exact cases are associated with 19 validated
     behavioral registry bindings rather than inferred from callable-name overlap.
197. Function reflection replacement: GNU R-shaped `body<-` and `formals<-` preserve closure
     structure and explicit enclosures, while primitive `environment<-` supports closure, formula,
     and ordinary attributed-object paths. Recursive exact evidence verifies the shared enclosure
     graph instead of counting the three callable names alone.
198. Dynamic closure construction: S3-aware `as.function()` and its default method construct
     closures from named lists through the shared formal/body converters, preserve caller or
     explicit enclosures, and retain lazy package-method dots. Recursive evidence observes the
     constructed function and captured environment as one graph.

Future prioritization should use semantic depth within these groups, host adapters, and new
longitudinal snapshots. High namespace reach is not an instruction to add a general CRAN loader.

## Method

`pnpm research:usage:collect` performs a networked refresh:

1. Fetch the cranlogs `top/last-month/100` aggregate. The service documents `last-month` as the last
   30 available days and identifies the RStudio CRAN mirror as its source.
2. Fetch the CRAN-generated HTML reference manual for every sampled package.
3. Extract only `Examples` code blocks, remove comments and string contents, and apply the
   independently written feature and named-call detectors in `scripts/package-usage.mjs`. Calls
   resolved to ordinary local assignments, right assignments, loop variables, or function formals
   are excluded; explicit core namespace calls remain attributable.
4. Filter named calls through the checked-in GNU R black-box callable inventory.
5. Discard the example text. Commit only package-level flags, aggregate counts, CSV tables, and
   generated SVG figures.

`pnpm research:usage:render` regenerates the CSV and SVG artifacts offline.
`pnpm research:usage:check` prevents them from drifting from the committed snapshot.

Inputs and outputs are under [`research/package-usage`](../research/package-usage/). The API
behavior is documented by the
[cranlogs application repository](https://github.com/r-hub/cranlogs.app#web-api-docs), and package
manuals come from the [CRAN package repository](https://cran.r-project.org/web/packages/).

## Limitations

- The sample covers one mirror and the top 100 packages, not the entire R ecosystem.
- Download popularity includes dependency and automation effects and does not measure active users.
- Documentation examples are a public-API usage proxy, not production-code telemetry.
- Lexical feature groups can produce false positives or miss indirect use.
- Named-call counts exclude lexically local bindings within each example block, but cannot fully
  resolve runtime reassignment, indirect calls, dynamically generated names, or operator syntax.
- A supported detector surface can still have explicitly documented semantic limits.

Refresh before a major roadmap revision and compare multiple snapshots before treating small rank
changes as a trend.

## Profile 0.309 package-driven priority check

The usage tables remain the ecosystem-level ordering input, while source-blind packages test whether
that ordering closes reusable semantic domains in practice. The `docopt 0.7.2` holdout exposed
Reference Classes as its first blocker and subsequently exercised generic replacement,
regular-expression, logical, substring, membership, and equality behavior. Those primitives were
implemented and evidenced because they closed the unchanged package path, not to inflate callable
counts. Untouched `getopt 1.21.1` is the next holdout; its first observed blocker will be compared
with the measured feature priorities before the next implementation increment.

## Profile 0.310 package-driven priority check

The frozen `getopt 1.21.1` holdout first failed at `match(..., nomatch = NA_integer_)`, then exposed
generic function negation, storage-mode replacement, and command-line discovery seams. Those shared
contracts were implemented with black-box evidence and carry the unchanged package through all four
applicable installed Rd examples at P5. The result adds package reach through semantic closure, not
through callable-count inflation or a package-specific branch. `optparse 1.8.2` is now the untouched
holdout whose first runtime blocker will be compared with the usage-ranked priorities.

## Profile 0.311 package-driven priority check

The frozen `optparse 1.8.2` holdout first failed at `exportClasses()`, then exposed reusable S4 slot
and validity semantics, namespace-local replacement generics, and `cat(fill=)` output behavior.
Those contracts carry the unchanged package through its representative GNU R-matched parser path and
all four applicable installed Rd examples at P5. The committed top-100 snapshot remains the
ecosystem-level priority input, but it has no untouched eligible standalone pure-R candidate;
`argparser 0.7.3` is therefore admitted as an independently authored same-domain generalization
probe rather than as a claim that command-line packages are the highest ecosystem-frequency group.

## Profile 0.312 package-driven priority check

The `argparser 0.7.3` generalization probe reaches its first public execution failure at
`as.logical()` list coercion and later its installed examples require S4 `coerce` dispatch. Both
features close reusable Base/methods domains and carry the unchanged package through P5; neither is
a package-specific branch or callable-count exercise. To avoid repeatedly choosing a low-frequency
same-domain parser after exhausting eligible top-100 candidates, the repository's frozen 2026-06-30
through 2026-07-29 window was applied to an explicit independent pure-R shortlist. `iterators`
records 304,194 downloads, ahead of the compared standalone candidates, and is admitted as the next
untouched holdout. This shortlist comparison is a sequencing input, not a claim of a global rank
across every CRAN package.

## Profile 0.313 package-driven priority check

The frozen `iterators 1.0.14` holdout first fails at a reusable S3 lookup rule rather than at an
iterator-specific API. Its exact examples then expose browser-owned runtime text resources and
`levels()`/`nlevels()`. Those contracts carry the unchanged package through all nine applicable
examples at P5. With `iterators` now available, usage-ranked `foreach 1.5.2` is admitted next as a
transitive dependency-closure probe: its imports require unchanged `iterators`, core `utils`, and
untouched pure-R `codetools`. This prioritizes reusable package-system closure over isolated
callable counts.

## Profile 0.314 package-driven priority check

The frozen `foreach 1.5.2` closure first fails at the missing `compiler` namespace and then exposes
named language-call entries and `%*%`. All three blockers close reusable Base/package-runtime
domains and carry the unchanged package through P5. The next holdout is `doParallel 1.0.17`, which
records 172,058 downloads in the same frozen 2026-06-30 through 2026-07-29 cranlogs window and
depends on the now-passing `foreach`/`iterators` stack plus core `parallel`. Selection is based on
dependency-closure leverage and ecosystem frequency; it is not a claim that a parallel backend is
already supported or that package-count growth establishes compatibility.

## Profile 0.315 package-driven priority check

`doParallel` first exposes core-package provisioning and then the semantic distinction between
`Depends` attachment and namespace imports. Its representative and installed-example paths require
both foreach-style single-lane mapping and PSOCK-shaped cluster calls, so the accepted work closes a
reusable browser `parallel` domain rather than adding a doParallel branch. Among compared eligible
pure-R follow-ups, `pbapply 1.7-4` records 121,725 downloads in the same frozen window and depends
only on `parallel`; it is selected as an independently authored generalization probe. Higher-count
`future`/`parallelly` paths are deferred because their required closure contains native code.

## Profile 0.316 package-driven priority check

`pbapply` exposed safe conditional NAMESPACE selection first, then reusable progress-state,
`parLapply`, `crossprod`, vectorized `rnorm`, and model-frame gaps. Those primitives now have
executable evidence. Its remaining first blocker is language/model reflection: `mod$call$formula`
must retain or reconstruct a valid two-sided formula for reuse by `lm()`. That semantic domain
outranks adding more isolated parallel names. `globals 0.19.1` is the next untouched
frequency-backed pure-R holdout.

## Profile 0.317 package-driven priority check

`globals` converted a package load failure into reusable `R.version`, environment-name,
language-length, class-removal, and nested data-frame-cell semantics. Its remaining installed
example blocker is list-valued subscript normalization in conservative code traversal, so that
language/subsetting seam outranks isolated callable additions. In the same frozen 2026-06-30 through
2026-07-29 cranlogs window, dependency-free `listenv 1.0.0` records 304,016 downloads and is the
next untouched pure-R holdout.

## Profile 0.318 package-driven priority check

`listenv` converted an ordinary-environment indexing failure into reusable primitive S3 dispatch
across extraction, replacement, length, names, dimensions, and transposition. Its installed examples
also closed small Base message and atomic-membership gaps. The unchanged package reaches P5, so the
next independent priority probe is dependency-free pure-R `R.methodsS3 1.8.2`: its generic S3
construction surface and broad reverse-dependency role provide more semantic leverage than another
isolated callable.

## Profile 0.319 package-driven priority check

`R.methodsS3` converted an imported-lookup failure into reusable namespace lookup, self-namespace,
qualified replacement, substitute, system-frame, startup-condition, and S3-registry semantics. The
unchanged package reaches P5 across all installed examples. The next priority is `R.oo 1.27.1`, a
pure-R dependency-closure probe with 183,372 downloads in the frozen comparison window; it provides
more semantic leverage than adding unrelated API names.

## Profile 0.320 package-driven priority check

`R.oo` converted its conditional-NAMESPACE blocker and subsequent example failures into reusable
namespace, S3, caller-frame, NULL Ops, metadata, string, attribute, delayed-binding, and
serialization semantics. All 90 installed topics now pass at P5. The next priority is the already
frozen, uninspected `R.utils 2.13.0` holdout, which exercises this dependency closure and provides a
fresh first-blocker signal. Isolated callable-count growth and native ABI work remain lower
priority.

## Profile 0.321 package-driven priority check

`R.utils` converted its first imported-graphics blocker and later example failures into reusable
parser, virtual I/O, graphics, condition, source-reference, time-limit, digest, environment, and
array-name semantics. The unchanged three-package closure reaches P5 without a package-name branch.
The next priority probe is frozen pure-R `here 1.0.2`, selected before source inspection and backed
by 196,779 downloads in the same comparison window; it independently reuses the already-P5
`rprojroot` dependency. First-blocker semantic closure remains higher priority than callable-count
growth or native ABI expansion.

## Profile 0.322 package-driven priority check

The frozen `here 1.0.2` probe reaches P5 without a new blocker, confirming that the existing package
and filesystem substrate generalizes across another independently authored package. Because no
semantic gap was exposed, this rotation adds no callable and does not alter the usage-ranked feature
order. `R.matlab 3.7.0` is now the untouched P0 probe: it records 8,450 downloads in the frozen
comparison window and composes the already-P5 `R.methodsS3`/`R.oo`/`R.utils` closure without a
mandatory native dependency. Its archive metadata, size, and digest were frozen before source
evaluation. `R.cache` was rejected because mandatory native `digest` would test Phase 3 rather than
the current pure-R package path. First-blocker semantic closure remains higher priority than
isolated callable-count growth or native ABI expansion.

## Profile 0.323 package-driven priority check

`R.matlab 3.7.0` converts its source-blind inert-Java packaging blocker and later namespace/runtime
failures into reusable asset, re-export, load-hook, version-object, and S3-dispatch semantics. Its
unchanged dependency closure reaches P5 with executable MAT v5 and installed-example evidence. The
next priority is frozen dependency-free `combinat 0.0-8`, with 35,946 downloads in the shared
comparison window. It was selected over lower-usage `matrixcalc`; candidates whose mandatory closure
enters native `digest` or `base64enc` were rejected for this Phase 2 rotation. Its first
source-blind blocker, not an isolated API name, will choose the next semantic increment.

## Profile 0.324 package-driven priority check

The `combinat 0.0-8` source-blind run validates first-blocker prioritization: three broadly useful
Base primitives and a generic Rd parser correction were required before all six examples passed. No
package-specific rewrite was needed. The next priority remains a metadata-frozen pure-R holdout
whose first blocker closes another reusable semantic domain; callable-name growth and native ABI
expansion remain secondary to that evidence.

The replacement P0 probe is `matrixcalc 1.0-6`, the metadata-only alternative already ranked during
the combinat selection. It remains unopened until the next source-blind attempt.

## Profile 0.325 package-driven priority check

The source-blind matrixcalc run validates the same first-blocker rule across a substantially broader
semantic chain: one standards-compatible namespace-regex seam and reusable real linear-algebra
operations close all 60 installed examples without package-specific code. The next priority is a new
metadata-frozen pure-R holdout, chosen by usage and dependency admissibility before opening its
archive. Callable-count growth, complex/full LAPACK work, and native-package ABI expansion remain
secondary unless that independent blocker evidence promotes them.

The replacement P0 probe is `Formula 1.2-6`, with 331,936 downloads in the shared comparison window.
Higher-usage `clipr` was excluded because its product contract centers on a host clipboard, and
`parallelly` was excluded by `NeedsCompilation: yes`. Formula depends only on R and core `stats`, so
its independently observed first blocker can exercise the current browser-admissible pure-R phase.
Its archive remains unopened at this selection checkpoint.

## Profile 0.326 package-driven priority check

The Formula source-blind run confirms that model-language closure had higher package reach than
adding isolated callable names. Generic formula attributes/classes and call mutation, string
function resolution, terms metadata, dot expansion, precomputed model-frame expression columns,
formula equality, response helpers, and offsets carry unchanged Formula 1.2-6 through both exact
installed examples to P5. The next priority is another independently frozen browser-admissible
pure-R holdout or an existing explicit first blocker; callable-count growth and native ABI work do
not outrank that evidence.

## Profile 0.327 package-driven priority check

The frozen unchanged `DBI 1.3.0` candidate now reaches P5 after reusable methods, S3/S4, Date/class,
namespace-export, and row-name work carries every runnable block in its exact 58-topic installed
manifest. The next priority is another independently frozen browser-admissible holdout or the
highest-leverage explicit P6/P7 first blocker. Optional database backends, connectivity, native ABI
work, and callable-count growth do not gain priority merely from DBI's interface-package result.

That next holdout is frozen at P0 as `xtable 1.8-8`: 606,555 downloads, no native compilation or OS
restriction, and only core `stats`, `utils`, and `methods` in its mandatory dependency closure. Its
unopened archive identity is pinned before execution. The next semantic priority must be selected by
xtable's first source-blind failure, not by its package name or anticipated rendering features.

## Profile 0.330 package-driven priority check

The frozen unchanged `xtable 1.8-8` candidate now reaches P5 after its sequential source-blind
failures selected reusable data-frame, model, GLM, PCA, flat-table, and argument-matching semantics.
Every runnable block in the exact eight-topic installed manifest passes without a package-identity
branch. The next priority is either a newly and independently frozen browser-admissible holdout or
the highest-leverage explicit P6/P7 first blocker. Callable-count growth and native ABI work do not
outrank evidence for semantic closure during the pure-R phase.

## Profile 0.331 package-driven priority check

The recorded globals P4 blocker was reclassified after source-blind reproduction: GNU R does not
accept list-valued subscripts here. The reusable fault sequence was core namespace leakage,
top-level substitution, absent first-class language primitives, and missing primitive `NextMethod()`
continuation. Closing those domains advances unchanged globals/codetools through all installed
examples and raises the package to P5.

The next known pure-R blocker with reusable reach is pbapply's LM call/formula reflection. It should
be compared against any newly frozen metadata-only holdout before implementation. Package-specific
branches, isolated callable growth, and native ABI expansion remain lower priority than the selected
pure-R semantic closure.

## Profile 0.332 package-driven priority check

The recorded pbapply blocker expanded into a reusable semantic chain rather than an `lm`-only fix.
Closing caller-frame evaluation, numeric/apply behavior, replacement/reflection state, data-resource
ownership, table/array normalization, and data-frame summaries now makes all four installed topics
pass unchanged. This promotes `pbapply 1.7-4` to P5 without recognizing the package identity.

The next priority must be selected before source inspection from a frozen, usage-ranked pure-R
holdout or an existing explicit P6/P7 first blocker. Callable-name overlap remains inventory, and
native ABI work remains behind broad pure-R semantic and package-system closure.

## Post-0.332 package-check priority

The new identity-agnostic runner makes P7 measurable rather than equating successful test sourcing
with package-check success. NumDeriv has no remaining applicable planned check and reaches P7.
Abind's first saved-output comparison fails on printed names/dimnames, a reusable Base presentation
contract with package-wide reach. That explicit blocker now competes with the next independently
frozen pure-R holdout; package counts and native ABI work do not outrank either evidence source.

## Profile 0.333 package-check priority result

The reusable presentation, visibility, replacement-call, condition-stack, and batch-output work
closes abind's recorded blocker and advances the unchanged release to P7. The next priority must now
be selected independently from frozen usage/metadata or another already recorded blocker; neither
numDeriv nor abind should be mined for additional work merely because they are familiar. Broad Base
semantic closure and diverse P7 evidence continue to outrank native ABI expansion.

## Post-0.333 metadata-frozen package priority

The next source-blind rotation is frozen as `selectr 0.6-0` before any archive listing, extraction,
parsing, installation, or execution. A refreshed official CRAN metadata comparison retains 3,384
current packages with no native compilation or OS restriction and with mandatory dependencies
limited to browser core or already-passing corpus packages. The shared 2026-06-30 through 2026-07-29
cranlogs window excludes higher-count `clipr` because its declared purpose requires a host clipboard
and excludes `remotes` because its declared purpose and system requirements require
network/process-backed remote installation. `selectr` is the next purpose-admissible candidate at
368,242 downloads; its only non-core mandatory dependency is the already-passing `R6`.

The unopened 85,422-byte archive is pinned by source SHA-256
`b877dfd9cc8b7d9afda1be9e45dfafc942e14b4279a430e5f8f75325c05eddd9`. Its first source-blind failure,
rather than anticipated CSS or package-specific behavior, must choose the next reusable semantic
increment.

## Profile 0.334 package-driven priority result

The frozen unchanged `selectr 0.6-0` run first stops in the generic `regexec()`/`regmatches()`
capture path: GNU R represents an unmatched optional group by a `0/0` location that extracts as an
empty string. Closing that contract, including exact ASCII index metadata, advances the package
through both installed example topics. The generic check runner also accepts only the specific
missing-package warning produced by a guarded probe for an edge declared in `Suggests`; unrelated
warnings still fail.

Selectr reaches P5 without a package-identity production branch. Its explicit P6 first blocker is
the unavailable `testthat` suggested dependency required by retained `test-all.R`. That dependency
closure now competes with the next independently frozen holdout; it is not silently skipped and does
not justify premature native-ABI work.

## Post-0.334 metadata-frozen package priority

`timeDate 4052.112` is the next independently frozen P0 holdout at 321,191 downloads in the fixed
comparison window. Official metadata declares `NeedsCompilation: no`, no OS restriction, and only R
plus core methods, graphics, utils, and stats in the mandatory closure; RUnit is optional. The
unopened 367,313-byte archive is pinned by SHA-256
`7f5b8e294f9fdf977cb721e711a6fcd664e379ee1b0ddb4c733374940e0e4646`. No source content has been
listed or inspected, and its first observed blocker must determine the next semantic priority.

## Profile 0.335 package-driven priority result

The blind first blocker was `graphics::axis.POSIXct`; the subsequent ordered chain exposed XDR
`S4SXP`, `.POSIXct`, `setReplaceMethod`, inherited `setGeneric` defaults, `callGeneric`, numeric
`pretty`, date-label generics, and `getDataPart`. Closing those reusable seams advances unchanged
`timeDate 4052.112` to P4 without a package-name branch. The next priority is not another isolated
callable: first reconcile S4 class/method documentation aliases, then close the highest-frequency
shared S4 primitive/operator and POSIX gaps visible across its remaining installed examples.

## Profile 0.336 package-driven priority result

The documentation alias seam is closed generically, followed by reusable S4 primitive operator and
subset dispatch and S3 forwarding for `as.double`/`as.numeric`, `sort`, and `diff`. This moves the
unchanged `timeDate 4052.112` package's ordered example frontier through `c`, `diff`, and
`difftimeDate` without package-specific production code.

The next priority is Base R `round.POSIXt` (and the shared POSIX rounding/truncation primitives it
depends on), because `example:round` is now the first executable blocker. Native-package ABI work
remains deferred behind this pure-R semantic closure.

## Profile 0.337 package-driven priority result

The former POSIX rounding blocker is closed with reusable UTC/GMT calendar semantics. Subsequent
source-blind progression exposed and closed S4 identity loss in internal subsetting, missing S3
`range` forwarding, and omitted prototype-slot completion in `new()`. The unchanged timeDate package
now reaches `example:align`; its unused-argument mismatch is the next ordered semantic priority.
Native-package ABI work remains behind this pure-R package frontier.

## Profile 0.338 package-driven priority result

The former `align` blocker decomposed into reusable `seq` forwarding, S4 named-dot positioning,
`pmatch`, forwarded-default presence, POSIXlt parsing/formatting, callable replacement, and
observation-level `[<-.POSIXlt`. The same source-blind run then exposed and closed method dispatch
gaps in `is.na`, `unique`, and `duplicated`, followed by `julian.POSIXt`. This advances unchanged
`timeDate 4052.112` past `align`, `isBizday`, and `nDay` without a package-name production branch.

The next priority is the generic sequence direction/step behavior exposed by `example:periods`.
Native-package ABI work remains deferred behind this pure-R semantic frontier.

## Profile 0.339 package-driven priority result

The former `periods` blocker decomposed into reusable S3/S4 length dispatch, recursive element
lengths, POSIXlt short-component recycling, the Base `.leap.seconds` object, logical-missing POSIXlt
conversion, and `...length`/`...elt`. The unchanged `timeDate 4052.112` package now passes that
ordered example and independently reproduces GNU R's 86 `periods` and 86 `monthlyRolling` windows.

The next priority is generic `base::asplit` array-margin slicing, exposed by
`example:timeDate-class`. Native-package ABI work remains deferred behind this reusable pure-R
semantic frontier.

## Profile 0.340 package-driven priority result

The former `timeDate-class`, `plot-methods`, and `holiday` blockers decomposed into reusable
`asplit`, empty-result `apply` typing, S4 graphics dispatch, measured axis styles, non-vector
`names`, and recursive `all.names`. The unchanged `timeDate 4052.112` package now passes all three
ordered topics without a package-specific production branch.

The next priority is generic object-system closure for the non-S4 `@` path exposed by
`example:in_int`. Native-package ABI work remains deferred behind this pure-R semantic frontier.

## Profile 0.341 package-driven priority result

The ordered unchanged timeDate frontier selected four reusable foundations: S4 constructor
initialization with `callNextMethod`, registered S4 `names` replacement, `seq.int` by-plus-length
controls, and the Base `is.na<-` subscript contract. These close multiple object-system, sequence,
and replacement gaps rather than adding isolated package callables. The package's new first blocker
is POSIXlt validation in `example:timeCeiling`; that explicit semantic gap outranks unrelated API
name additions for the next package-driven increment.

## Profile 0.342 package-driven priority result

The former `timeCeiling` and `timeSequence` blockers selected reusable `[.POSIXlt` extraction,
balanced-state invalidation/normalization, and `%b`/`%B`/`%h` parsing. Those changes carry the
unchanged package from P4 to P7 rather than merely adding isolated names. With no remaining timeDate
blocker, the next priority must come from a newly frozen metadata-first holdout or a higher
ledger-wide semantic closure gap; API-name overlap alone remains non-authoritative.

## Profile 0.343 package-driven priority result

The frozen `carData 3.0-6` candidate exposed four reusable layers in order: an installed
package-data environment for `LazyData`, build-time xz normalization, independent byte/vector
resource accounting, and factor contrast attributes/generators. These changes carry an unchanged
data package through all applicable checks at P7 and also close foundations used by model-oriented
packages. No package name, version, or data-set identity is recognized in production code.

The next priority is not another isolated callable. Freeze the next purpose-admissible metadata-only
candidate or select a recurring blocker across the 47-release corpus, then implement the smallest
general semantic closure. `.rdx`/`.rdb`, aliases and nonmatching data archives, ordered/sparse
contrasts, and broader package dependency closure remain higher-value frontiers than API-name count.

## Profile 0.344 package-driven priority result

The metadata-first `rex 1.2.2` rotation selected a reusable language-object invariant rather than a
regex callable: arbitrary values stored as a call's first entry must survive generic decomposition
and reconstruction without character-to-symbol promotion. Closing that invariant advances the
unchanged package through every installed example at P5 and strengthens metaprogramming for other
packages.

The new ordered blocker is reusable dependency/test closure: retained `testthat.R` requires the
suggested `testthat` package. That blocker recurs elsewhere in the corpus, but it does not by itself
justify premature package-specific shims or native/Wasm expansion. The next increment should compare
this cross-corpus dependency frontier with the next independently frozen browser-admissible holdout,
then choose the smallest general closure with executable evidence.

## Profile 0.345 package-driven priority result

Unchanged brew reaches P5 without selecting any new callable or semantic exception. That is useful
negative evidence: the current parser, language evaluation, connections, capture, regex, namespace,
and virtual-file foundations already cover the package's complete installed examples and an
independent template/parser probe. Adding code merely to make the profile look larger would reduce
reuse discipline rather than improve compatibility.

The retained test produces a third recurring `testthat` dependency blocker, but current testthat's
compiled closure remains downstream of mature pure-R foundations. The next active priority is the
metadata-frozen `shape 1.4.6.1` source-blind run; its first concrete failure, if any, outranks
isolated callable-name growth.

## Profile 0.346 package-driven priority result

Shape's ordered failures selected a reusable graphics seam rather than isolated name coverage:
browser device creation, arrows, physical aspect-ratio windows, axis expansion styles, polygon
controls, and Base matrix binding with `NULL` accumulators. The bind closure clears six installed
shape example failures and generalizes the common `out <- rbind(out, block)` pure-R pattern.

The current first blocker, `datasets::volcano`, is provenance-constrained by clean-room policy and
must not be closed by copying GNU R data. Until an admissible independent source is audited,
reusable `filled.contour`, argument matching, and vignette lookup gaps remain valid parallel
priorities. `corrplot 0.95` is frozen as the next untouched source-blind holdout.

## Profile 0.347 package-driven priority result

Shape's remaining generic argument failure was not an argument matcher defect: unchanged code
required `sort.default(..., index.return = TRUE)$ix`. Closing indexed sorting advances the complete
`filledellipse` example and strengthens a common ordering primitive for unrelated packages. Fixing
the package-check generator's canonical vignette `File` lookup also closes the installed shape
vignette without runtime or package identity branching.

Neither result outranks the existing `datasets::volcano` first blocker or advances shape beyond P4.
Until exact clean-room-compatible data provenance is available, the next priority should come from
the frozen `corrplot 0.95` source-blind first failure or the reusable `graphics::filled.contour`
surface, not from isolated callable-name growth.

## Profile 0.348 package-driven priority result

The corrplot source-blind rotation selected two high-reuse invariants in order. Exact actual names
must remove only their selected formal from later partial matching, allowing an otherwise ambiguous
short name to select a remaining formal or fall through dots. Numeric data frames and matrices must
then flow through Pearson `cor`/`cov` with matrix shape and column labels intact. Both closures
apply well beyond visualization packages.

Corrplot now stops at `stats::hclust`, not another color or drawing helper. The next increment
should close a coherent distance, hierarchical-clustering, dendrogram-conversion, and leaf-order
path with recursive evidence. The replacement source-blind holdout is metadata-frozen
`insight 1.5.2`; it must remain unopened until scheduled.

## Profile 0.349 package-driven priority result

The corrplot first blocker closed the full distance-to-dendrogram path with direct and recursive
evidence. Its next failure selected `which(..., arr.ind = TRUE)`, a Base array-coordinate primitive
used well beyond plotting. Both choices satisfy the rule that package work must close reusable
semantic domains instead of adding names or recognizing a package.

The ordered corrplot blocker is now `graphics::symbols` while rendering `example:corrMatOrder`. That
bounded browser graphics primitive is the next development candidate. The untouched `insight 1.5.2`
holdout must remain unopened until scheduled, and isolated callable-count growth must not displace
the observed blocker.

## Profile 0.350 package-driven priority result

The corrplot-selected symbol layer is now a reusable browser polygon primitive, and the secondary
multi-key `order` failure is closed with exact recursive evidence. The unchanged package can render
its default correlation plot, demonstrating package reach rather than callable-name growth.

The ordered first blocker is now `stats::cutree` in `example:corrMatOrder`. The next increment
should implement tree cutting over the owned `hclust` structure with GNU-shaped membership and label
behavior, then rerun the complete source-blind topic. `insight 1.5.2` must remain unopened until
scheduled, and native/Wasm work remains downstream of broad pure-R closure.

## Profile 0.351 package-driven priority result

The corrplot-selected `cutree` gap is closed as a general merge-tree operation with exact recursive
evidence. This advances a complete example topic rather than increasing callable-name counts.

The ordered first blocker is now deterministic symmetric-eigenvector orientation in
`example:corrRect`. The next increment should measure the GNU R 4.6.1 orientation contract across a
held-out symmetric-matrix set, define tolerances for eigenspaces and exact requirements for
sign-sensitive consumers, and improve the reusable eigensolver without recognizing corrplot or
mtcars. `insight 1.5.2` must remain unopened until scheduled.

## Profile 0.352 package-driven priority result

The corrplot-selected symmetric-eigen gap is closed through a source-reproducible numerical backend
rather than a package or dataset branch. The following fractional-sequence gap is also closed as a
general Base rule. These changes advance complete installed example topics and add exact recursive
evidence instead of increasing callable-name counts.

The ordered first blocker is now the remaining `graphics::symbols` parameter surface reached by
`example:corrplot`, reported as `invalid symbol parameter`. The next increment should isolate the
unsupported shape or normalization path, implement it as a reusable browser graphics primitive, and
rerun the unchanged topic. `insight 1.5.2` must remain unopened until scheduled, and the native
package ABI remains downstream of broad pure-R closure.

## Profile 0.353 package-driven priority result

All corrplot examples now pass through reusable Pearson-test, data-frame, and graphics semantics,
advancing the package to P5. The change is measured by complete example-topic execution and a new
recursive differential graph, not by callable-name growth.

The ordered first blocker is the suggested `testthat` dependency at `test:testthat.R`. The next
increment should resolve the pinned testthat dependency closure through the generic repository,
installation, namespace, and evaluator pipeline, then implement the first concrete reusable semantic
gap it exposes. No corrplot-specific test bypass is permitted. The unopened holdout and Phase 3
native-package ABI remain downstream of broader pure-R closure.

## Profile 0.354 package-driven priority result

All applicable unchanged insight examples now pass, advancing the package from P3 to P5. The work
closed reusable Base/model/RNG/data seams and is measured by complete example-topic execution plus
new flat and recursive differential evidence, not callable-name counts.

The ordered first blocker is `test:testthat.R`, where suggested dependency `testthat` is absent. The
next priority is generic dependency-closure planning for testthat and its native requirements, or
another scheduled development-package rotation if that closure belongs to the later native ABI
phase. `GPArotation` remains unopened, and package-specific test bypasses are forbidden.

## Profile 0.355 package-driven priority result

The scheduled GPArotation rotation selected four reusable foundations: browser grid lines, bounded
scalar roots, covariance-to-correlation normalization, and transposed cross-products. The package
now reaches P3 unchanged. Its first example is a deliberate 100-random-start numerical workload and
hits the standard allocation budget before completion.

The next priority is evidence-driven resource/algorithm efficiency for that workload or the next
scheduled pure-R rotation; the resource gate must not be bypassed per package. Testthat/native
dependency closure remains a later cross-package signal rather than an excuse for package-specific
rewrites.

## Profile 0.356 package-driven priority result

The first GPArotation workload selected reusable Base naming, array margin application,
maximum-likelihood factor analysis, loadings extraction, and programmatic callback-call semantics.
Those closures complete `example:CCAI` and advance the unchanged artifact to P4; callable-name
growth is not the success criterion.

The next measured blocker is the later `example:GPA` multi-rotation workload at the bounded
100,000,000-step ceiling. Priority should remain on reusable numerical efficiency and semantic
closure, with formula/scores/control gaps in `factanal` kept explicit. No GPArotation-specific fast
path or package rewrite is permitted.

## Profile 0.360 package-driven priority result

The scheduled palmerpenguins rotation shows why package depth outranks a green installation result.
The applicable generic package-check plan passed, while an independent LazyData scenario exposed the
namespace-consistency gap at the commonly used `as_tibble` generic and then a Base Date coercion
gap. Closing those reusable surfaces carries the unchanged pinned artifact to P7 without adding a
package-specific branch.

The next priority input must be either an existing recorded P5/P6 dependency or test blocker, or a
new source-blind holdout selected from frozen usage/dependency metadata. A replacement holdout must
be recorded at P0 with its unopened source digest before inspection. Callable-name growth and native
ABI work do not displace these evidence sources.

## Post-0.360 metadata-frozen package priority

The replacement source-blind holdout is `polynom 1.4-1`, selected before source inspection from a
complete current-CRAN admissibility filter and the fixed 2026-07-12 through 2026-08-10 download
window. It records 126,371 downloads and imports only core `stats` and `graphics`. Higher-count
candidates whose declared purpose fundamentally requires an operating-system clipboard, remote
package management, project-library/lockfile management, or Git credentials remain host-bound rather
than being mistaken for browser-admissible pure-R probes.

The archive digest and metadata are frozen at P0. Its first scheduled source-blind failure—not an
anticipated polynomial feature or isolated callable name—must select the next reusable semantic or
package-system increment.

## Profile 0.361 package-driven priority result

The unchanged `polynom 1.4-1` run reached P7 after a chain of reusable blockers: Stats generic and
basis behavior, implicit S3 group registration/context, `NextMethod()` state, callable operators,
Summary dispatch, list distinctness, and general real eigendecomposition. This validates the
selection policy: one source-blind package forced several cross-package primitives rather than a
package-specific rewrite.

The next priority is not an isolated callable inferred from polynom. The holdout partition must
first receive a new metadata-frozen candidate, after which its observed first blocker competes with
the nine existing blocked corpus entries. `stats::deriv.default`, multivariate `poly`, broader
numerical conditioning, test/dependency closure, and package namespace/object-system gaps remain
eligible only when measured evidence selects them.

## Profile 0.362 package-driven priority result

The frozen estimability holdout selected shared model semantics rather than isolated callable
counts. Closing lazy NA actions, visible QR/model reconstruction, rank-deficient prediction,
stored-call formula updates, and reusable factor contrasts carried the unchanged package to P7 and
also strengthened Base/stats consumers outside that package.

The next package-driven priority requires another metadata-first holdout selection. Its first
ordered blocker must compete with the nine existing blocked corpus entries; native-package ABI work
remains later than broad pure-R semantic and package-test closure.

## Profile 0.363 package-driven priority result

The opened `formatR 1.14` holdout selected shared parser/deparse, language-object, regex,
substitution, condition-handler, and comparison semantics. It reaches P5, while width-sensitive
deparse layout remains its first ordered blocker. That blocker retains priority over isolated API
name additions because it closes a reusable source-language domain and is backed by unchanged
package tests.

## Profile 0.366 package-driven priority result

The lambda.r frame-reflection blocker is closed through reusable evaluator, parse-data,
missing-name, and model NA-policy semantics, carrying the unchanged pinned package to P7 with flat
and recursive GNU differential evidence. This does not establish arbitrary pure-R package support.

The next source-blind candidate is metadata-frozen `SQUAREM 2026.1`, selected from 3,334 admissible
current releases after the recorded host-service exclusions. Its unopened source digest and size are
pinned at P0. The scheduled unchanged run and its first concrete reusable blocker now outrank
isolated callable-name growth; native testthat closure and the provenance-gated `volcano` resource
remain explicit later-phase or external-provenance constraints.

## Profile 0.367 package-driven priority result

SQUAREM's first blockers formed a coherent reusable chain rather than a package-specific patch:
recursive `modifyList()` configuration, paired Box-Muller normals, forwarding `qr()` dots to the
default method, and `solve.qr` dispatch. Those changes carry every applicable unchanged example and
retained test plus an independent fixed-point scenario to P7.

The next priority input requires a newly metadata-frozen holdout or a higher-leverage existing
non-native blocker. Acceptance of `LAPACK = TRUE` is deliberately bounded and does not establish
column-pivot identity; broader QR conditioning remains eligible when differential/package evidence
selects it. Native testthat closures remain downstream of mature Phase 2 evidence.

## Profile 0.368 package-driven priority result

The metadata-first ranking selected `snow 0.4-4` after excluding higher-ranked host-service
packages. Its first unchanged failure was a reusable Base coercion gap in namespace initialization:
an empty environment variable incorrectly produced a warning when converted to integer. Closing
empty/whitespace and character-`NaN` warning semantics carried the complete applicable package check
and an independent in-memory cluster protocol scenario to P7.

This result does not elevate process launch or external SOCK/MPI transports into the browser
contract. The next increment must again begin with a metadata-frozen source-blind candidate or a
higher-leverage existing semantic blocker, not callable-name growth.

## Profile 0.369 package-driven priority result

The metadata-first ranking selected untouched `futile.options 1.0.1`. Its first independently
authored source-blind scenario found that `UseMethod()` and `NextMethod()` discarded an invisible
method result. Closing visibility propagation in the generic evaluator carries the unchanged package
and its OptionsManager scenario to P7 without a package-specific rewrite.

The holdout partition is empty again. The next increment must freeze a new purpose-admissible
candidate before source inspection or select a higher-leverage blocker already recorded in the
corpus. Native-package ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.370 package-driven priority result

The fixed 2026-07-14 through 2026-08-12 metadata and usage window selected untouched
`futile.logger 1.4.9` at 118,068 downloads after the recorded host-service exclusions. Its ordered
unchanged failures selected four reusable gaps: character conditions, numeric factor ordering in
`split()`, environment formatting, and `tryCatch()` handler-list evaluation. Closing them carries
the unchanged artifact, its transitive pure-R dependencies, complete applicable checks, and an
independent logger scenario to P7.

The holdout partition is empty again. The next increment must freeze another purpose-admissible
candidate before source inspection or select a higher-leverage recorded semantic blocker. Native
package ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.420 semantic-evidence result

Before opening the next holdout, the evidence audit selected reusable discrepancies in matrix-tail
controls and formals, time-series attribute order, S4 data-part generic promotion, formal matrix
representation, and binary bind dispatch. Those discrepancies are now closed with exact flat and
recursive evidence and no package-specific branch. The corpus remains 96 pinned artifacts: 81
passing, 14 blocked, and unopened `pls` 2.9-0 as the sole holdout at P0. Its next run must remain
source-blind and follow the first package-neutral blocker. Native-package ABI work remains
downstream of mature pure-R semantic and package-system evidence.

## Profile 0.419 package-driven priority result

Unchanged timeSeries 4052.112 selected reusable smoothing, S4 vector/generic fallback,
aggregate/filter/product, core-data, year-day parsing, and POSIX sequence work and now reaches
scoped P7. Metadata-first ranking in the unchanged 2026-07-22 through 2026-08-20 window selects
unopened pls 2.9-0 next at 25,918 downloads after the recorded host-service, project-management,
credential, font/static-data, native-header, scaffolding, and documentation-asset exclusions.
Continue with its first unchanged generic blocker rather than isolated callable count growth.

## Profile 0.418 package-driven priority result

The scheduled unchanged NLP 0.3-3 run selected reusable gaps in actual argument counting, builtin
generic call frames, explicit date and time parsing, DCF output, and character sequence endpoints.
Closing those shared contracts carries the package through all applicable generic checks and an
independent GNU-matched scenario to P7 without package-specific rewriting or branching.

The fixed 2026-07-22 through 2026-08-20 metadata and usage window selects unopened timeSeries
4052.112 next at 25,290 downloads after recorded host, package-management, credential, font,
static-data, header, scaffolding, and documentation exclusions. Continue from its first unchanged
generic blocker; native-package ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.417 priority outcome

The scheduled proto 1.0.0 run selected three ordered reusable gaps: environment-reference deparsing,
`base::eapply`, and loss of the target expression across S3 subset dispatch. The implementation
closes those shared environment, callback, promise, and call-syntax contracts rather than adding a
proto-specific branch. Exact flat and recursive evidence accompanies each increment.

The fixed 2026-07-22 through 2026-08-20 ranking next selects purpose-admissible NLP 0.3-3 at 26,367
downloads after documented exclusions for host services, project/package managers, static assets and
datasets, native headers, scaffolding, and documentation tooling. Its metadata and unopened archive
digest are frozen before any source listing or evaluation. The next increment must follow NLP's
first unchanged reusable blocker.

## Profile 0.416 priority outcome

The scheduled ica 1.0-3 run selected missing exponential and Student-t density bindings in order.
Both reusable stats contracts now have exact GNU evidence and carry the unchanged package to P7
without source rewriting or package recognition. The observed signed-zero, warning-call, and
attribute-order differences were retained rather than normalized away.

The fixed ranking next selects purpose-admissible proto 1.0.0 at 27,390 downloads after the
documented host-service, static-resource, native-header, scaffolding, documentation-tool, data-only,
and target-version deferrals. Its unopened 541,398-byte archive is the sole P0 holdout. Its first
source-blind blocker determines the next reusable increment; native ABI work remains downstream of
broader pure-R semantic closure.

## Profile 0.415 priority outcome

The scheduled RUnit 0.4.33.1 run first selected direct `all.equal.numeric`, then methods generic
introspection. Both reusable contracts now have exact GNU evidence and carry the unchanged package
to P7 without source rewriting or package recognition.

The fixed ranking next selects purpose-admissible ica 1.0-3 at 27,832 downloads after the documented
host-service, static-resource, header/scaffolding, documentation-tool, target-version, and data-only
exclusions. Its unopened 12,825-byte archive is the sole P0 holdout.

## Profile 0.414 priority outcome

The scheduled dichromat 2.0-1 examples identify serialized `loess` prediction as the first reusable
blocker. A browser-native local-polynomial method now closes that path and gains independent GNU
numeric evidence. Broader exact kd-tree interpolation remains prioritized separately rather than
being inferred from package execution.

The fixed ranking next selects purpose-admissible RUnit 0.4.33.1 at 25,985 downloads, after
excluding the documented host-service, static-resource, native-header, scaffolding,
documentation-tool, data-only, and target-version candidates. Its unopened archive is the sole P0
holdout.

## Profile 0.413 priority outcome

The scheduled RSpincalc 1.0.2 run turns a package example failure into a reusable semantic priority:
three-dimensional rotation arrays require `apply(X, 3, FUN)` to pass each complementary 3-by-3
matrix to `FUN`. NativR now supports arbitrary array rank and ordered multi-axis margins with GNU
shape and dimname evidence. The unchanged package reaches scoped P7 without package-specific logic.

The fixed 2026-07-22 through 2026-08-20 ranking next selects purpose-admissible dichromat 2.0-1 at
26,939 downloads after the documented host-service, static-resource, native-header, scaffolding,
documentation-tool, data-only, and target-version exclusions. Its unopened digest-pinned archive is
the sole P0 holdout. Native ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.411 priority outcome

The frozen pixmap holdout selected reusable S4 coercion-target, inherited initialization, slot
access/replacement, and image aspect-window contracts. Its embedded GNU R batch-session transcript
also selected a generic evidence rule: a version/platform-bound reference is explicitly not
applicable, while the corresponding retained test must still pass. The unchanged artifact and an
independent image-object scenario now reach scoped P7.

Metadata-first ranking over the fixed 2026-07-22 through 2026-08-20 window selects unopened moments
0.14.1 at 30,170 downloads after the documented host-service, asset/header, documentation-time,
target-version, and static-data exclusions. Its 7,640-byte official archive is frozen at P0 with
SHA-256 `2ed2b84802da132ae0cf826a65de5bfa85042b82e086be844002fe1ce270d864`. No archive member or
source content has been listed or read.

## Profile 0.412 priority outcome

The frozen moments holdout passes unchanged through every applicable generic package-check step and
an independent scenario spanning all 12 exports. It exposes no reusable semantic or package-system
blocker. The small high-order floating tails are explicitly bounded by nine-decimal comparison and
are not used to justify package-specific arithmetic.

Metadata-first ranking over the fixed 2026-07-22 through 2026-08-20 window selects unopened
RSpincalc 1.0.2 at 28,766 downloads after the documented host-service, asset/header,
documentation-time, target-version, and static-data exclusions. Its 16,542-byte official archive is
frozen at P0 with SHA-256 `fa8c867ba4d0b393982e671a5872ae097214270ab2ffbb8262ebfe15bee3d225`. No
archive member or source content has been listed or read.

## Profile 0.410 priority outcome

The frozen dynamicTreeCut holdout selected reusable one-dimensional table sort/subset metadata and
Base `charmatch()` as its ordered blockers. Closing those contracts carried the unchanged artifact,
all applicable generic checks, and an independent all-export scenario to scoped P7. This outcome
raises reusable package reach; it is not evidence that clustering semantics or arbitrary package
installation are complete.

Metadata-first ranking replenishes the holdout partition with unopened pixmap 0.4-14 at 31,237
downloads. Its browser-core graphics dependency closure makes it a useful probe of reusable S4,
graphics, data-resource, and package-lifecycle semantics. The next increment must preserve its P0
source-blind boundary until scheduled rotation and stop at the first concrete generic blocker.
Native-package ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.404 package-driven priority result

The fixed 2026-07-22 through 2026-08-20 ranking selected untouched rbenchmark 1.0.1 at 39,477
downloads. Its ordered source-blind failure selected the reusable language/expression-vector
`mapply` contract. The unchanged artifact now reaches P4 and passes a bounded independent benchmark;
its intentionally high-workload installed example hits the browser package-test step limit, which is
retained as the explicit P5 resource blocker. The next candidate, untouched ca 0.71.1 at 39,260
downloads, is frozen at P0 before source inspection. Its scheduled run must follow its first shared
blocker without package-specific behavior.

## Profile 0.403 package-driven priority result

The fixed 2026-07-22 through 2026-08-20 ranking selected untouched GlobalOptions 0.1.4 at 44,676
downloads. Its ordered failures selected reusable utils completion/settings behavior and Reference
Class superclass dispatch rather than option-package-specific code. Closing those contracts carries
the unchanged artifact and all applicable checks to P7. The next increment should freeze another
metadata-first holdout or select a higher-reach recorded blocker such as the existing
`stats::arima0` gap. Native-package ABI work remains downstream of broader pure-R closure.

## Profile 0.402 package-driven priority result

The metadata-frozen ellipse 0.5.0 run selected reusable central chi-square and F quantile semantics
before reaching `stats::arima0` in its first installed example. Ellipse remains P4. The arima0
contract now competes with a new metadata-first holdout and other recorded semantic blockers by
reusable reach; it must not be approximated with a package-specific ellipse fixture. Native test
framework closures remain downstream of the Phase 2 foundation.

## Profile 0.401 priority update

The synchronized S4/model-environment omission blocker is closed through shared frame, model, NA
dispatch, and generic-promotion contracts. Unchanged modeltools 0.2-24 reaches scoped P7. The next
priority is the remaining corpus blocker with the greatest reusable semantic or dependency-closure
reach; package-specific branches and premature native-ABI work remain out of scope for this phase.

## Profile 0.400 package-driven priority result

Callable contrast and direct multi-response QR gaps are closed at shared stats/model layers. This
moves modeltools from the final example blocker into its retained regression test. The next
highest-leverage measured gap is synchronized missing-row omission across S4 model-environment
components: 90 design rows versus 100 response rows immediately before `lm.fit()`. That data/object
interaction takes priority over isolated callable-count work.

## Profile 0.399 package-driven priority result

The unchanged `modeltools 0.2-24` sequence selected call-object `$<-`, model-frame subset
evaluation, top-level S4 generic promotion, and explicit superclass queries as the reusable
blockers. Closing those contracts completes `example:MEapply`. The next measured blocker is callable
contrast generators supplied through `model.matrix(..., contrasts.arg=)`, reached by
`example:ModelEnvFormula`. This remains higher priority than isolated callable-count work because it
is a standard model-interface extension point used by pure-R packages.

## Profile 0.398 package-driven priority result

The fixed 2026-07-22 through 2026-08-20 metadata/cranlogs window ranked `modeltools 0.2-24` as the
next purpose-admissible candidate after excluding host clipboard, remote installation, project
library, credential, static-font, native-header, and scaffolding packages. Its source-blind run
selected cleanup-only packaging, `stats4` dependency registration, S4 prototype defaults, and the
`logLik` generic as reusable foundations. The next measured blocker is the package-neutral S4 `$`
path reached by `example:MEapply`; the provenance-gated `volcano` blocker remains open in parallel.

## Profile 0.397 package-driven priority result

The numeric matrix/data-frame `pairs` path removes retained expressions 24 and 25 without a package
identity branch. The unchanged `gridGraphics 0.5-1` run now selects `datasets::volcano` at
expression 26. The next priority is to locate and audit an independent lawful source for the exact
topographic matrix, record its dimensions, storage, values, checksum, and identity semantics, then
rerun the frozen artifact. Do not source the asset from GNU R or a GPL package data file.

## Profile 0.395 package-driven priority result

The unchanged `gridGraphics 0.5-1` test selected reusable grid polygon, segment, line, and point
grob families plus primitive `recordPlot()` descriptors. Those contracts now carry the artifact
through demo1, demo2, and demo3. The next highest-leverage blocker is generic lowering of composite
boxplot journal events into ordered GNU-compatible primitive operations. Native ABI work remains
downstream of broader pure-R semantic closure.

## Profile 0.396 package-driven priority result

Generic ordered boxplot lowering removes the unchanged `gridGraphics 0.5-1` expression-20 blocker
and carries its retained test through expression 23. Expression 24 now selects the next reusable
semantic domain: `pairs.default` scatterplot layout, lazy panel callbacks, axes, and primitive
recorded operations. This shared graphics slice is the next package-first priority; native ABI work
remains downstream of broader pure-R semantic closure.

## Profile 0.428 package-driven priority result

The first unchanged `gsubfn` run selected generic lifecycle-hook documentation classification. After
that reusable fix, the artifact reaches P4. The next ordered priority is independently sourced
browser-owned `datasets::BOD`, exposed by `example:fn`; later example failures remain behind it in
the first-blocker ledger.

## Profile 0.427 package-driven priority result

Source-blind execution of the frozen `gridBase` 0.4-7 artifact selected four ordered reusable
domains: viewport transform and current extent, graphical-parameter defaults and inheritance,
rectangle grobs and drawing, and base graphics layout-cell selection. Implementing those shared
contracts carries both installed example topics, the vignette, the complete applicable check plan,
and a separate all-export scenario to P7 without package-specific behavior.

The next unopened holdout is `gsubfn` 0.7 at 22,594 downloads in the same fixed usage window, after
the established browser-purpose exclusions. Its official archive is frozen from metadata only and
must remain unopened until the scheduled source-blind run. The next increment must follow its first
reusable semantic or package-infrastructure blocker; native package ABI work remains downstream of
broader pure-R semantic closure.

## Profile 0.393 package-driven priority result

The unchanged `gridGraphics 0.5-1` retained test selected two reusable gaps in order. The standard
runner now provides an isolated writable package-test copy, and grid now provides retained viewport
tree navigation plus justification normalization. These close the former filesystem, `upViewport`,
justification, and `downViewport` failures without package-specific behavior.

The next highest-leverage blocker is the recorded-graphics contract: `recordPlot()` journal entries
must preserve GNU-compatible operation provenance, named `C_*` descriptors, and argument shapes so
generic display-list consumers can dispatch them. Native package ABI work remains downstream of
broader pure-R semantic closure.

## Profile 0.392 next package-driven priority

The shared `grDevices::pdf.options` contract closes the unchanged `gridGraphics 0.5-1` expression 16
blocker. The retained runner now selects expression 17's first reusable host gap: package tests need
a writable, isolated browser-memory working directory so relative generated PDF/PNG paths are
admissible without writing into the installed artifact. Implement that generic package-check
sandbox, rerun the unchanged test plan, and retain the next observed blocker. Do not recognize
`gridGraphics`, special-case its filenames, or mark P6 before every retained test passes.

## Profile 0.391 next package-driven priority

The shared grid grob lifecycle closes both `makeContent` and its symmetric `makeContext` generic,
advancing unchanged `gridGraphics 0.5-1` through all applicable examples at P5. The ordered generic
check runner now selects `grDevices::pdf.options` in retained test `demo-graphics.R` expression 16.
The next increment should implement GNU-compatible PDF device default option query/update/reset
state and its interaction with `pdf()`, then rerun the unchanged test. It must not bypass the test
or recognize `gridGraphics`.

## Profile 0.390 next package-driven priority

The frozen unchanged `gridGraphics 0.5-1` run has closed its reusable `grDevices::contourLines`
blocker with exact flat and recursive black-box evidence. The artifact remains P1 because namespace
loading now stops at `grid::makeContent`. The next increment should implement the generic grob
content lifecycle—together with dispatch, mutation, and child-content contracts exposed by black-box
evidence—rather than recognize `gridGraphics` or bypass its namespace imports.

## Profile 0.374 package-driven priority result

The fixed 2026-07-14 through 2026-08-12 metadata and usage window selected untouched `pracma 2.4.6`
at 80,335 downloads. Its ordered unchanged failures selected reusable numerical and model semantics
rather than callable-count work: optimization, interpolation, probability, complex/QR/Cholesky
algebra, matrix model terms, exact pi trigonometry, and GNU array/vector Ops. Closing those gaps
carries the unchanged artifact, all applicable generic checks, and an independent four-function
numerical scenario to P7. Optional `NlcOptim` and `quadprog` paths remain explicitly not-applicable
without those declared Suggests.

The holdout partition is empty again. The next increment must freeze another purpose-admissible
candidate before source inspection or select a higher-leverage recorded semantic blocker. Native
package ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.409 package-first result and next priority

Unchanged vipor 0.4.7 selected four reusable foundations in order: grouped `split<-` replacement,
`plot.default(las=)` validation, standard ASCII native-encoding aliases for installed package data,
and the `stats::ave` namespace export revealed by an independent all-export scenario. With those
shared contracts, all applicable checks and both vignettes pass and the pinned artifact reaches
scoped P7.

The fixed-window metadata ranking now selects unopened dynamicTreeCut 1.63-1 at 33,315 downloads as
the next P0 holdout. Its official archive is pinned before inspection. The next semantic priority
will be its first unchanged generic failure, if any; callable-name expansion remains subordinate to
that measured package blocker and recursive semantic closure.

## Profile 0.408 package-driven priority result

The fixed 2026-07-22 through 2026-08-20 usage window selected untouched corpcor 1.6.10 at 34,052
downloads. Its ordered unchanged failure exposed the reusable wide-matrix SVD allocation strategy,
not a missing isolated callable. Choosing the smaller Gram matrix closes the blocker and carries all
13 examples plus an independent all-export scenario to scoped P7 without relaxing resource limits.

Metadata-only ranking now selects untouched vipor 0.4.7 at 33,579 downloads as the next
browser-purpose-admissible candidate. Its only mandatory imports are core stats and graphics. The
official archive is frozen before listing or inspection; its first scheduled failure must select a
reusable semantic or package-system contract. Native-package ABI work remains downstream of broader
pure-R semantic closure.

## Post-0.373 package-driven priority

The fixed 2026-07-14 through 2026-08-12 metadata and usage window selects untouched `pracma 2.4.6`
at 80,335 downloads after the established host-service exclusions and deferral of two static
font-asset packages. It is pure R and imports only core graphics, grDevices, stats, and utils,
making its numerical-analysis surface a broad browser-admissible semantic target. The unopened
official source archive is pinned at P0 before listing, extraction, parsing, installation, or
execution. Its first scheduled failure must drive reusable runtime or package infrastructure rather
than package-specific behavior.

## Post-0.372 package-driven priority

The fixed 2026-07-14 through 2026-08-12 metadata and usage window selects untouched `bigD 0.3.1` at
82,656 downloads after the established host-service exclusions and deferral of two static font-asset
packages. Its date, time-zone, locale, parsing, and formatting focus provides a broad
browser-admissible semantic target. The unopened official source archive is pinned at P0 before
listing, extraction, parsing, installation, or execution. Its first scheduled failure must drive
reusable runtime or package infrastructure rather than package-specific behavior.

## Profile 0.373 package-driven priority result

The fixed 2026-07-14 through 2026-08-12 metadata and usage window selected untouched `bigD 0.3.1` at
82,656 downloads. Its ordered unchanged failures selected reusable bounded package-resource
handling, separate reviewed serialization-input limits, and browser-safe null external-pointer
semantics. Closing them carries the unchanged artifact, all applicable generic checks, and an
independent date/locale scenario to P7. The optional `testthat` launcher and absent vignette surface
remain explicitly not-applicable rather than counted as passing.

The holdout partition is empty again. The next increment must freeze another purpose-admissible
candidate before source inspection or select a higher-leverage recorded semantic blocker. Native
package ABI work remains downstream of broader pure-R semantic closure.

## Post-0.371 package-driven priority

The fixed 2026-07-14 through 2026-08-12 metadata and usage window selects untouched `permute 0.9-10`
at 82,685 downloads after the recorded host-service and static-asset exclusions. Its unopened
official source archive is pinned at P0 before listing, extraction, parsing, installation, or
execution. The scheduled run must follow the first reusable semantic or package infrastructure
blocker rather than add package-specific behavior.

## Profile 0.371 package-driven priority result

The fixed 2026-07-14 through 2026-08-12 metadata and usage window selected untouched
`tinytest 1.4.3` at 85,045 downloads after the recorded host-service and static-asset exclusions.
Its ordered unchanged failures selected reusable gaps in argument matching, dynamic frames,
runtime-owned parsing/connections, factor and table semantics, PCRE replacement, core datasets, and
condition signaling. Closing them carries the unchanged artifact, all applicable generic checks, and
its retained 159-test self-test to P7.

The holdout partition is empty again. The next increment must freeze another purpose-admissible
candidate before source inspection or select a higher-leverage recorded semantic blocker. Native
package ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.372 package-driven priority result

The fixed 2026-07-14 through 2026-08-12 metadata and usage window selected untouched
`permute 0.9-10` at 82,685 downloads. Its ordered unchanged failures selected reusable gaps in exact
extraction, symbol conversion, log-factorials, nested update frames, condition restarts, classed
cumulative values, formula graphics, group reconstruction, and formula t-tests. Closing them carries
the unchanged artifact, all applicable generic checks, and an independent permutation-control
scenario to P7. The optional `testthat` launcher remains explicitly not-applicable without that
suggested dependency.

The holdout partition is empty again. The next increment must freeze another purpose-admissible
candidate before source inspection or select a higher-leverage recorded semantic blocker. Native
package ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.426 package-driven priority result

The fixed 2026-07-22 through 2026-08-20 metadata and usage window selected untouched `formula.tools`
1.7.1 at 24,221 downloads. Ordered unchanged execution exposed package-neutral gaps in search-path
introspection, expression replacement, formula terms metadata, symbol coercion, and language
deparsing. Closing them carries the unchanged artifact, every applicable generic check, and an
independently authored all-export scenario to P7. Its optional `testthat` launcher and absent
vignette surface remain explicitly not applicable rather than counted as passing.

The next unopened holdout is `gridBase` 0.4-7 at 23,103 downloads. Its official archive is frozen
from metadata only and must remain unopened until the scheduled source-blind run. The next increment
must follow its first reusable semantic or package-infrastructure blocker; native package ABI work
remains downstream of broader pure-R semantic closure.

## Profile 0.429 package-driven priority result

Ordered unchanged `gsubfn` execution selected reusable work in core data, grouped aggregation,
formula language, graphics type geometry, conjugate-gradient optimization, and repetition-count
coercion. Closing those contracts moves the first blocker from `datasets::BOD` through six installed
example topics to the unresolved Suggested `chron` dependency in `example:list`.

The next priority decision is package-system-wide: define how browser-admissible Suggested packages
are selected, resolved, bundled, and reported without installing every Suggests edge or creating
package-specific rules. Native ABI work remains downstream of broader pure-R semantic and package
closure.

## Profile 0.430 package-driven priority result

The package-system decision is now executable: callers may request an explicit declared Suggests
subset, and lock format v2 records the normalized none/all/selected policy. Unchanged `gsubfn` with
selected `chron` proves that resolution reaches the concrete optional artifact and then stops at its
native-code contract; default installation stays mandatory-only.

The same blocker sequence selected two reusable Base R fixes: GNU-compatible `isOpen(rw=)` selection
and inherited lookup that skips same-named values of the wrong requested mode. The first makes
`read.pattern` pass, while the second closes additional `strapply` paths. Continue semantic closure
from an independently reproducible browser-applicable blocker; do not implement a package-specific
`chron` substitute or start native ABI work ahead of the mature pure-R foundation.

The next usage-ranked source-blind probe is unopened `tinytable 0.18.0` at 21,458 downloads in the
fixed 2026-07-27 through 2026-08-25 window. Its mandatory surface is R plus browser-core `methods`,
and its declared table-conversion behavior supplies an executable semantic probe. Freeze it at P0,
then let the unchanged generic package-check path identify the next reusable blocker; optional
document/image integrations must be classified at their concrete Suggested or host boundary.

## Profile 0.431 package-driven priority result

The frozen `tinytable` probe selected two high-leverage runtime closures—S4 slot replacement for
`NULL` class unions and lazy `...names()`—and one package-system closure: example/test applicability
must understand both standard optional metadata categories, `Suggests` and `Enhances`. The package
now reaches regression P7 through unchanged source and an independently authored GNU-matched
scenario. This validates the priority method: package blockers become shared semantics rather than
package-specific shims.

The holdout partition is empty after promotion. The next increment should repeat the complete
metadata-first, usage-ranked rotation with a fresh fixed window, freeze the selected archive before
inspection, and follow its first browser-admissible reusable blocker. Native-package work remains
downstream of broader pure-R semantic and corpus maturity.

## Profile 0.489 priority outcome

The VennDiagram holdout selected matrix-valued data-frame binding and graphics annotations rather
than another isolated callable. Both are shared semantic domains with recursive GNU evidence, and
the unchanged artifact now reaches scoped P7. The next package-driven priority is metadata-frozen
`httpcode 0.3.0`; it reaches scoped P7 after selecting source-preserving `stopifnot` diagnostics as
its only shared gap. The next package-driven priority is metadata-frozen `shades 1.5.0`. Complete
plotmath glyph layout, broader data-frame binding shapes, and the remaining blocked regression
corpus remain explicit competing semantic priorities.

## Profile 0.490 priority outcome

The source-blind shades holdout selected shared colour-converter objects, custom XYZ routing, the
non-callable `colorspaces` namespace binding, HSV conversion, and structural attribute semantics
instead of isolated callable-count work. Those reusable contracts carry the unchanged artifact to
scoped P7 with recursive GNU evidence. The next package-driven priority is metadata-frozen, unopened
`relimp 1.0-5`; its first execution must determine the next reusable semantic blocker. Broader
colour spaces, the 15 blocked corpus releases, and still-unevidenced semantic domains remain
competing priorities rather than being hidden by the successful holdout.

## Profile 0.491 priority outcome

The unchanged relimp holdout required no new compatibility branch or isolated callable. Its generic
success strengthens evidence that the existing model, namespace, package-check, and expression
semantics compose across independently selected code. The next package-driven priority is the
metadata-frozen, unopened `codetools 0.2-20` archive. Static analysis of R language objects is a
high-leverage probe of calls, expressions, closures, traversal, scoping, and namespace behavior; its
first unchanged execution must select any next reusable blocker.

## Profile 0.492 priority outcome

The codetools rotation selected a compact but high-leverage language-reflection closure rather than
package-specific API work: missing-formal identity, syntax-object lookup, escape continuations,
zero-argument control-flow call entries, symbol output, call-head canonicalization, and exact
`bquote()` call matching. The unchanged package now reaches scoped P7 through the ordinary pipeline.

The next package-driven increment must be selected anew from the frozen usage ranking and declared
browser-purpose policy. The 15 explicit corpus blockers and still-unclosed Base R semantic domains
remain eligible higher-leverage work; codetools success does not justify callable-count expansion or
an arbitrary-package claim.

## Profile 0.493 priority outcome

The fixed-window ranking selects `stinepack 1.5` as the highest-ranked remaining executable package
after excluding host services, remote/project package managers, static assets, native headers,
profilers, and scaffolding. The source-blind run passes the complete applicable generic pipeline and
independent GNU R interpolation probes without identifying a new semantic gap. This validates
composition across an unseen numerical package and avoids manufacturing isolated callable work.

The replacement holdout is unopened `qvcalc 1.0.4`, selected from the same fixed window at 14,811
downloads after excluding model-ecosystem integration, parallel-host execution, and handbook/asset
surfaces ahead of it. Its first run should probe reusable factor-model, covariance, S3 object, and
printing semantics. The 15 explicit blockers, including `stats::arima0`, core-data provenance, and
broader dependency closures, remain competing priorities.

## Profile 0.494 priority outcome

The qvcalc rotation selected shared model semantics rather than package exports. GNU R black-box
evidence established that `vcov.lm()` rematches `complete` at the method and ignores unrelated lazy
dots. Package-neutral custom-family evidence then required callback execution for links, variance,
deviance, AIC, initialization, validation, residuals, Pearson dispersion, fixed dispersion, and
response prediction. Those seams now carry the unchanged artifact to scoped P7.

The next priority remains whichever newly frozen holdout or explicit corpus blocker closes the most
recursive browser-admissible behavior. Matrix-response custom-family initialization and mutation of
`y`, `weights`, or `n` remain explicit model gaps; native-package blockers stay deferred to the
common ABI phase rather than receiving per-package workarounds.

## Profile 0.495 priority outcome

The aod rotation selected shared model and S4 closure rather than isolated exports: residual-row
restoration, formal slot reflection, family-aware GLM covariance, formula normalization, factor
refactoring, and generic optional-dependency diagnostics. The unchanged artifact now reaches scoped
P7 through the standard package pipeline.

The next source-blind priority is `trust 0.1-9`, chosen from the fixed-window ranking after applying
the established browser-purpose exclusions. Its derivative-driven trust-region optimizer is a
high-leverage probe of closures, repeated callbacks, numerical linear algebra, convergence state,
conditions, and model-like result structures. No implementation work should begin until public
metadata and independent GNU R expectations are frozen.

## Profile 0.496 priority outcome

The trust rotation selected two high-leverage stats foundations rather than package exports.
`glm.fit` exposes the reusable matrix-level IRLS seam used by older pure-R statistical packages,
while `D` supplies evaluable normalized-language derivatives without generated JavaScript. Their
combined closure carries every applicable unchanged trust example, retained test, and vignette
through the standard package pipeline.

The next priority is not an isolated derivative-table expansion by default. Select the next
source-blind holdout or highest-reach recorded blocker first, then implement the smallest reusable
semantic closure it proves necessary. Complete `deriv.default`, additional derivative functions, and
exotic direct-GLM initialization remain explicit candidates rather than silently claimed coverage.

## Profile 0.497 priority outcome

The fixed-window rotation selected `itertools 0.1-3` after excluding host-service, asset-only,
native-header, profiling, package-management, model-ecosystem-dominated, and true-host-parallel
surfaces. Its source-blind run selected L'Ecuyer-CMRG rather than another isolated iterator helper:
the same generator and exact stream/substream jumps support reproducible parallel workflows across
unrelated packages.

The unchanged artifact now passes the complete applicable generic plan and an independent iterator
scenario. The next priority should be chosen from the next unopened purpose-admissible package or a
higher-reach recorded blocker; callable-count growth and unmeasured RNG variants remain secondary.

## Profile 0.498 priority outcome

The fixed-window rotation selected `optimParallel 1.0-3` because its mandatory closure isolates two
high-reach foundations: core parallel state semantics and bounded optimization. Ordered unchanged
execution selected persistent browser cluster environments first and public L-BFGS-B routing second;
neither implementation recognizes the package. The unchanged artifact now passes the full applicable
plan plus an independent scenario.

The next priority must again be selected from a metadata-frozen source-blind holdout or a
higher-reach explicit ledger blocker. True CPU parallelism is not automatically next: browser-safe
semantic closure and package reach remain the decision criteria.

## Profile 0.499 priority outcome

The refreshed fixed-window rotation selected `tictoc 1.2.1` as the next purpose-admissible
executable package after excluding host services, asset/header packages, profiling, scaffolding,
documentation-only surfaces, and optional-model-dominated integrations. Its ordinary package check
passed, while the independently authored scenario selected the reusable `as.vector` S3 seam.

This result reinforces why package counts and installed examples are insufficient: generic S3
conversion of a classed environment was missing even though the package appeared green. The next
priority must again come from a pre-frozen holdout or a higher-reach explicit first blocker, with an
independent scenario retained as a required gate.

## Profile 0.500 priority outcome

The refreshed metadata-only rotation selected `dfoptim 2023.1.0` after excluding host-service,
package-management, credential, asset/header, profiling, scaffolding, and data-only candidates. Its
package-owned checks passed; an independent all-export scenario selected the higher-reach discrete
RNG-state seam because a correct sample result can still leave an incompatible future stream.

The shared fix restores reproducible repeated sampling and randomized optimizer trajectories. The
next priority must again be selected before source inspection from a purpose-admissible holdout or a
higher-reach recorded blocker; adding isolated optimizer names is not the default priority.

## Profile 0.501 priority outcome

The metadata-first rotation selected `DFBA 0.1.0`. Its ordered failures first justified reusable
beta/logistic/Weibull distribution contracts, then exposed a broader runtime cost: repeated indexed
updates to one unaliased local vector copied the complete growing value. The package-neutral owner
proof and bounded growth path has higher package reach than increasing a package-test budget or
recognizing DFBA.

DFBA now reaches scoped P7. The next priority remains a metadata-frozen holdout or an explicit
high-reach blocker; callable-name growth and package counts remain secondary to recursive semantic
closure and unchanged-package evidence.

## Profile 0.502 priority outcome

The frozen `lm.beta 1.7-3` run selected list-backed environment enclosure rather than another model
callable. A list supplied through positional lookup must not inherit ambient functions, even when
`inherits = TRUE`; by contrast, an eval/with data mask retains its explicit enclosing environment.
This distinction has broader metaprogramming and package reach than a package-specific weights
workaround.

The unchanged artifact now reaches scoped P7. The next priority must again come from a
metadata-frozen holdout or a higher-reach recorded blocker, with independent behavior retained as a
gate after package-owned examples pass.

## Profile 0.503 priority outcome

Usage-ranked source-blind evaluation selected `alabama` and exposed `stats::nlminb` before any
package source guided implementation. The chosen increment closes a reusable bounded optimizer and
shared `optim` control/line-search domain, unblocking future constrained-optimization packages
rather than adding isolated package API names.

## Profile 0.507 priority outcome

The complete package regression, rather than callable-name growth, selected source reconstruction
and dots-position S3 dispatch. One parse-data omission and one leading-`NULL` bind duplication
blocked the high-reach lambda.r → futile.logger → VennDiagram chain. Fixing the parser/runtime/Base
contracts restored all three unchanged checks without package-specific logic, validating explicit
first blockers as the priority signal for the next corpus failures.

## Profile 0.509 priority outcome

The recorded ellipse blocker selected a reusable regular/seasonal ARIMA fitter rather than a
package-specific result. Its unchanged execution then exposed shared core-data and NLS model-frame,
summary, and profile seams. After those repairs, the first blocker is no longer a core semantic
name: it is the optional MASS dependency that owns `profile.glm`. Future work should compare that
dependency closure against other corpus blockers by package reach and phase fit.

## Profile 0.510 priority outcome

One audited core dataset closed two independent package blockers. Profile 0.511 completes the nearer
depth-ordered `persp(col=)` primitive and advances unchanged `shape` to `graphics::filled.contour`.
Generic filled contours and conditional plotting for `gridGraphics` are now the respective ordered
gaps; both require broader reusable panel/layout and annotation contracts.

## Profile 0.511 priority outcome

The package-first graphics slice now admits colored perspective facets through the shared polygon
journal. `shape` advances from `example:drapecol` to `example:femmecol`, selecting
`graphics::filled.contour` as its next reusable blocker. `gridGraphics` remains independently pinned
at `graphics::coplot`; dependency-only and later native-ABI blockers do not displace these explicit
Phase 1/2 semantic gaps.

## Profile 0.518 priority outcome

The recorded `gridGraphics` blocker selected a reusable numeric single-condition `graphics::coplot`
slice rather than an isolated API-name addition. The unchanged package now exposes
`datasets::quakes` as the ordered first blocker. That dataset is high leverage only if its exact
subsample has independent redistribution provenance and can be delivered lazily without inflating
the initial Worker; otherwise rotate to another recorded semantic gate while keeping this provenance
boundary explicit.

## Profile 0.519 priority outcome

The rbenchmark resource blocker exposed three reusable foundations rather than a package-specific
exception: bounded bulk `:` accounting, Math-group data-frame dispatch, and deferred bulk RNG seed
publication. Closing those contracts moves an unchanged, dependency-free source-blind package
through its full installed example and P7 while retaining browser resource guards. This is higher
leverage than raising `maxSteps` or skipping the benchmark example, because the same vector, S3,
data-frame, and RNG paths recur across the broader package corpus.

## Profile 0.520 priority outcome

The fixed-window metadata rotation selected dependency-free `invgamma 1.2`. Ordered unchanged
execution exposed exponential p/q namespace closure, then non-central chi-square d/q/r semantics,
then bulk gamma-family RNG cost. The resulting primitives serve unrelated statistical packages and
close a coherent distribution domain rather than adding package-owned names. The next increment must
again come from a frozen source-blind holdout or a higher-reach explicit blocker.

## Profile 0.521 priority outcome

The next metadata-frozen holdout, dependency-free `entropy 1.3.2`, selected the missing
`stats::chisq.test` contract through its unchanged `Gstat` example. Implementing Pearson tests,
table provenance, residual structure, warnings, and formals at the shared stats layer closes a
reusable inference domain used beyond this package. The unchanged artifact then passes all
applicable checks and an independent multi-family scenario at scoped P7. The next increment must be
selected from a newly frozen holdout or a higher-reach recorded blocker.

## Profile 0.522 priority outcome

The recorded simulated-p-value subdomain was the highest-leverage reusable semantic gap after the
remaining package blockers resolved to provenance, Suggested-dependency closure, or native-code
boundaries. The resulting AS 159 fixed-margin sampler and categorical goodness-of-fit path close a
general Monte Carlo inference primitive with exact random-stream evidence. Future work should return
to a newly frozen source-blind holdout or a higher-reach concrete blocker; adding isolated low-use
names solely to increase inventory overlap remains lower priority.

## Next source-blind rotation: profileModel 0.6.2 P0

The fixed 2026-07-31 through 2026-08-29 metadata ranking retained 3,366 eligible releases outside
the 134-release corpus. After the established browser-purpose exclusions for host services,
installers, credentials, static assets and datasets, development headers, scaffolding, project
libraries, profiling, and documentation-only delivery, `profileModel 0.6.2` is the next executable
statistical candidate at 10,803 downloads. It has no mandatory non-core package dependency; `MASS`
and `gnm` are Suggested only.

Before archive inspection, the official 21,461-byte source was frozen outside Dropbox at SHA-256
`a2b0b9af8b5ebe9bd732f1f6663f171929c0831f77c260b5aa9a126a12cf2ac1`. The holdout remains P0 and
unevaluated. Its next action is the ordered generic install/load/check run, with the first
failure—not package source familiarity—selecting the next reusable semantic increment.

## Profile 0.523 priority outcome

The frozen `profileModel 0.6.2` run selected three recursive, reusable gaps in order: missing
argument positions inside formula language, canonical matched-call retention for `glm()`, and
formula offsets that were represented in model frames but not applied to fitting. All three now have
GNU R black-box differential and integration evidence. The unchanged artifact passes every
applicable generic package-check step and an independent profile-likelihood scenario, so it moves to
development P7. This is scoped evidence for one pinned artifact, not a package-count completion
claim.

## aplpack 1.3.5 platform-boundary outcome

After `profileModel 0.6.2` reached scoped P7, the refreshed fixed 2026-07-31 through 2026-08-29
window contains 3,365 metadata-eligible releases outside the 135-package corpus. Established purpose
exclusions remove host clipboard, remote package/project management, credentials, static fonts and
datasets, documentation/web assets, native headers, scaffolding, and profiling. The native-ecosystem
support package `bigmemory.sri` and mandatory-`tcltk` `misc3d` are also excluded.

`aplpack 1.3.5` was the next executable candidate at 10,770 downloads. Its official metadata lists
`tcltk` only under Suggests, so the archive was frozen source-blind at SHA-256
`4454bc05cf70d5f3690b211e46b89b90a817de768b986098a3500c84f8d2664f`. The generic pipeline packages
and parses it, then stops at P1 because its unchanged NAMESPACE unconditionally imports `tcltk`.
That platform dependency cannot be made browser-admissible by pretending Tcl/Tk exists or rewriting
the package. The deterministic `NRE2221` result and artifact SHA-256
`1bf3afaae279ae0abc7e023c85167f25c9dcff876ccb23d564a7c6974ead224f` remain explicit boundary
evidence.

## Next source-blind rotation: nor1mix 1.3-3 P0

From the same fixed window, `nor1mix 1.3-3` is the next purpose-admissible executable statistical
candidate at 10,603 downloads. Official metadata declares no native compilation and imports only
browser-core `stats` and `graphics`; `cluster` and `copula` are Suggested. Before any archive
listing, extraction, parsing, installation, or NativR execution, its official 43,051-byte archive
was frozen outside Dropbox at SHA-256
`97bfd0f8c847fa68bf607aaa465845a34ac8a7a262315073026a6a1937dd076e`. It remains holdout P0 until the
unchanged generic pipeline records its first blocker.

## Profile 0.524 priority outcome

The frozen nor1mix run selected `stats::rmultinom`, then public `mean.default`, then Summary
handling of `NULL`, with a reusable package-check correction for top-level optional `require()`
calls. These changes move the unchanged artifact to P4 and leave call-valued `stats::deriv` as the
first applicable P5 blocker. Symbolic differentiation has higher recursive reach than adding
unrelated callable names, but it must return GNU-shaped executable derivative expressions rather
than merely silencing the example. The holdout partition is empty until the next metadata-first
rotation.

## Profile 0.525 priority outcome

The nor1mix blocker sequence justified reusable `deriv.default`, warning assertion, deprecation, and
BFGS trace work. Each now has differential and integration evidence, and the unchanged package
advances to `density.default(bw = "sj")`. Sheather-Jones bandwidth selection is the next ordered
semantic blocker because it unlocks an applicable installed example and extends a shared stats
primitive; unrelated callable-name additions remain lower priority.
