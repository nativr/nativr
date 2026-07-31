# Implementation status

Date: 2026-07-30

## Implemented

- Node 24/pnpm 11 monorepo, strict TypeScript, ESM browser packages, and cross-platform scripts.
- Reproducible Tree-sitter R Wasm build, normalized NativR AST, Unicode spans, and diagnostics.
- Typed logical/integer/double/complex/raw vectors with separate NA masks where applicable, lists,
  attributes, matrices/arrays, factors, frames, formulas, environments, closures, lazy promises,
  ellipsis, and resource limits.
- JavaScript reference operators with recycling warnings, comparison/logical semantics, control
  flow, rightward/non-local assignment, direct replacement-function assignment, simple nested
  subset/member replacement chains, GNU R argument matching, and 454 registered functions. Supported
  arithmetic, comparison, logical, sequence, and matching operators are also first-class builtin
  bindings.
- Vector/list selection and replacement, recursive `[[`, arbitrary-dimensional column-major array
  selection/replacement, strict axis bounds, `drop`, zero-length axes, named dimension axes,
  one-dimensional array names, numeric/character coordinate-matrix array operations, common-type
  data-frame coordinate extraction, numeric cell replacement, row/column operations, binding, and
  class-preserving vector selection. Nested replacement rebuilds list/data-frame containers,
  supports NULL deletion and missing `$` intermediates, and preserves GNU R's repeated intermediate
  subscript evaluation. One-dimensional replacement extends atomic/list values with typed missing or
  NULL gaps, grows names, removes invalidated dimensions, appends consecutive data-frame columns,
  extends numeric/named data-frame rows with typed missing cells and row-name updates, and preserves
  factor levels with invalid-level warnings.
- Complete measured helper-name surfaces for strings, sorting/matching, apply/map, descriptive
  statistics, random distributions/sampling, and dates/times.
- Native and magrittr-style pipes, richer normalized formulas, registered namespaces, S3 dispatch,
  bounded S4 registration, R6 construction, and vctrs class construction.
- Owned symbol/language/expression values, non-forcing `quote()`/`expression()`, bounded
  normalized-AST `eval()`/`substitute()`, canonical `match.call()` reconstruction, initial call
  construction/deparsing, language predicates, and stable public snapshots without parser-node
  exposure.
- Explicit global/base/empty/current/closure environments, child creation, parent traversal, and
  lexical evaluation, plus mutable `$`/`[[` bindings, lookup, assignment, existence checks, list
  conversion, environment naming, delayed bindings, and explicit promise forcing.
- Owned pairlists with tags, type/mode/predicate behavior, list/vector/expression coercion,
  constructor mode, indexing, replacement type transitions, attributes, classes, dimensions,
  dimension names, Worker transport, and non-forcing `alist()` syntax capture.
- Text-driven parsing into owned expression vectors, bounded early `n` termination, and
  parser-validated public symbol/language/expression input records.
- Backtick-delimited names normalize to their underlying R binding names, including operator names.
- Worker-first and inline public APIs, versioned snapshots/protocol, and a runnable Vite playground.
- Browser-safe `print()` and `cat()` output with invisible return semantics, ordered inline/Worker
  events, `evalDetailed` retention, output-budget accounting, and Playground console rendering.
  `utils::capture.output()` adds nested in-memory stdout/message capture, visible-result printing,
  partial-line preservation, split output, and an explicit no-filesystem boundary.
- `utils::demo()` returns GNU R's empty `packageIQR` catalog shape when no package library is
  selected. External package demo discovery and execution remain an explicit package-loader and
  host-resource boundary.
- Device-independent `new-page`, coordinate-window, RGBA-raster, and styled line-segment graphics
  events with bounded `plot.new()`, `plot.window()`, `rasterImage()`, and `segments()` builtins,
  transferable raster buffers, output budgeting, and Playground Canvas rendering.
- Usage-ranked `grDevices::as.raster`/`is.raster` with ragg's captured-color-matrix shape, row-first
  raster storage, logical/numeric/raw grayscale, numeric/raw RGB(A), vector reshaping,
  names/dimnames removal, S3 methods, identity, missingness/scaling boundaries, and downstream
  `rasterImage` pixel-order evidence.
- Usage-ranked `grDevices::dev.hold`/`dev.flush` with nested owned-device levels, bounded ordered
  graphics buffering across evaluations, zero-level release, namespace access, visible integer
  returns, and reset/dispose cleanup.
- Usage-ranked `grDevices::recordPlot`/`replayPlot` with a bounded independently owned display list,
  ragg's same-session record/replay shape, package-metadata retention, held replay, invisible replay
  return, namespace access, malformed-input guards, and explicit external-format/reload boundaries.
- Usage-ranked `graphics::segments` for posterior's measured vertical interval call, including
  omitted-endpoint defaults, vector recycling, resolved colors and line patterns, omitted
  missing/non-finite entries, Worker transport, Canvas pixels, and same-session display-list replay.
- Frequency-prioritized `head()` selection for core owned data shapes and bounded `str()` structural
  output with invisible return semantics.
- Strict recursive `identical()` comparison with numeric, missing-value, attribute-order,
  source-reference, and closure-environment controls across the owned value model.
- Initial conditions and handlers: `try`, `tryCatch` error/finally handling, `stop`, `stopifnot`,
  `warning`, `message`, `conditionMessage`, nested warning/message suppression, and `invisible`,
  while keeping resource-limit errors uncatchable.
- Resettable evaluator-owned `options()`/`getOption()` state with lazy defaults, exact
  query/mutation/removal behavior, and print `digits`/`max.print` integration.
- Deterministic browser/Worker host-mode detection through non-interactive `interactive()`.
- Exact binary-input, ties-to-even `round()` with vectorized digits, complex values, missingness,
  signed zero, and attribute retention.
- Real/complex `log`, `log10`, `log2`, `log1p`, `exp`, and `expm1` with recycled bases,
  near-zero-stable paths, domain warnings, and metadata retention.
- Lazy `with` data masks, isolated/supplied `local` environments, and visibility-preserving dynamic
  evaluation.
- Tolerant recursive `all.equal` comparisons plus scalar `isTRUE`/`isFALSE` predicates.
- Lazy vectorized `ifelse` selection with branch-only forcing, positional recycling, atomic/list
  promotion, and test-attribute retention.
- GNU R-compatible `any`/`all` logical summaries with empty identities, three-valued missingness,
  exact `na.rm` handling, eager argument evaluation, coercion warnings, and scalar-list support.
- Lazy data-mask `subset` selection for vectors, lists, matrices, and data frames, including NA-row
  removal, lexical fallback, column-selection expressions, and rectangular shape retention.
- Function-position lookup skips non-callable bindings while retaining ordinary value lookup,
  matching GNU R's separate callable resolution behavior.
- Captured-name `rm`/`remove` environment mutation with `list=`, explicit/inherited environments,
  missing-object warnings, and invisible NULL results.
- Attribute-aware `rev` across NULL, atomic, list, pairlist, factor, matrix, and data-frame shapes.
- `cumsum`, `cumprod`, `cummax`, and `cummin` across logical/integer/double/raw/complex inputs with
  GNU R output types, missing/NaN propagation, names, dimension dropping, and integer-overflow
  warnings.
- Delayed function-exit cleanup through `on.exit` across normal returns, explicit `return`, and
  errors, including replacement/clearing and before/after ordering, plus attribute-preserving `I`
  class marking.
- Closure-body inspection through owned language values and recursive/shallow `unlist` flattening
  with type promotion, nested names, factor-level union, raw/complex values, and pairlists.
- Lazy `transform` data-mask evaluation with caller fallback, replacement, removal, and frame-row
  recycling, plus attribute-aware `tail` selection across vectors, lists, expressions, matrices, and
  data frames.
- Dynamic caller-environment lookup through `parent.frame` and column-major `t` transposition for
  named vectors, factors, matrices, and atomic-column data frames.
- Closure-formal inspection through owned pairlists and lazy repeated evaluation through
  `replicate`, including atomic/matrix/array simplification and unsimplified list results.
- Metadata-preserving real `floor` semantics and factor-aware `split` grouping for vectors, lists,
  matrices, expressions, pairlists, and data-frame rows, including empty levels and interactions.
- Usage-ranked `ceiling` with data.table's exponential-sample conversion, zoo's nested
  tick-alignment helper, logical/integer/double-to-double rounding, retained vector/array
  attributes, distinct missing/non-finite values, and direct/Math S3 method boundaries.
- Usage-ranked `stats::approx` with data.table's sequence interpolation and zoo's Date-coordinate
  mapping, linear/constant methods, endpoint rules, explicit or generated output grids, missing-pair
  handling, duplicate reducers, and explicit-coordinate attribute retention.
- Usage-ranked `standardGeneric` with S7's measured `setGeneric` definition body, session-local S4
  class/method resolution, formal/default/dots forwarding, `ANY`, and call-context errors.
- Usage-ranked `grDevices::colorRampPalette` with isoband's two measured 21-color Lab Viridis calls,
  an owned returned palette function, linear RGB/Lab interpolation, bias, alpha, namespace access,
  and byte-exact GNU R black-box results.
- Usage-ranked `utils::sessionInfo` with otel's measured `$platform` lookup, a deterministic
  browser-native platform descriptor, R 4.6 compatibility-target metadata, current session
  locale/RNG kinds, attached core packages, UTC time-zone reporting, and classed list shape.
- Usage-ranked `as.ordered` with generics' measured `letters` constant and character-vector
  coercion, ordered-factor identity, ordinary-factor unused-level dropping, name preservation, and
  custom S3 method forwarding.
- Usage-ranked `as.array` and `as.array.default` with rstan's measured package-method call shape,
  lazy S3 dots, one-dimensional atomic/list/factor/pairlist defaults, name-to-dimname promotion,
  unrelated-attribute retention, and existing-array identity.
- Usage-ranked `stats::nlm` with rstan's measured analytic-gradient callback shape, lazy forwarded
  objective arguments, supplied or finite-difference derivatives, bounded BFGS line search, optional
  Hessians, convergence codes, and explicit parameter/objective/control boundaries.
- Usage-ranked `stats::optim` with rstan's measured separate objective/gradient BFGS call, lazy
  forwarded arguments, named and scaled parameters, numerical-gradient fallback, optional Hessians,
  function/gradient counts, maximization scaling, and explicit unsupported-method boundaries.
- Usage-ranked `graphics::pairs` S3 dispatch for rstan's measured `pairs.stanfit` call shape,
  including lazy labels, panels, parameter selection, condition, and graphical dots, with an
  explicit boundary before the full default scatterplot-matrix device.
- Usage-ranked `grDevices::heat.colors` with the measured sequential palette shape, exact
  red-to-yellow/pale-yellow hexadecimal generation, optional alpha, reversal, numeric count
  coercion, empty outputs, and explicit invalid-input boundaries.
- Usage-ranked `factorial` with xfun's measured scalar call, direct finite integer products, an
  independent Lanczos gamma path for fractional/negative non-poles, vector attributes,
  missing/non-finite behavior, overflow, and domain warnings.
- Usage-ranked `stats::lsfit` with xfun's measured direct-fit call, vector/matrix predictors,
  optional weights, intercept and tolerance controls, complete-case omission, coefficients,
  residuals, and a classed bounded QR result from the existing owned least-squares solver.
- Usage-ranked `strwrap` with xfun's measured repeated-text example, vectorized paragraph
  boundaries, sentence spacing, width/indent/prefix controls, atomic coercion, and simplified or
  list-shaped results.
- Usage-ranked `grDevices::col2rgb` with stringr's measured named-color replacement helper and the
  earlier rank-207 `rgb` dependency, complete catalog/hex/alpha/transparent inputs, numeric palette
  indices, named matrix output, recycled intensity channels, and reverse hexadecimal formatting.
- Usage-ranked `simplify2array` with stringi's measured equal- and unequal-length list examples,
  scalar/vector simplification, common-type promotion, list matrices, names and higher-dimensional
  metadata, exception lengths, and bounded input validation.
- Usage-ranked `str2expression` and `str2lang` over the existing browser-native parser, producing
  owned expression/language/symbol/atomic values for backports' measured source strings, comments,
  blank lines, missing text, and invalid type/result-length boundaries.
- Usage-ranked `utils::URLdecode` with backports' measured direct percent-decoding call, vectorized
  ASCII/UTF-8 byte handling, missing/empty/NULL inputs, attribute dropping, and explicit malformed
  percent/invalid browser-string byte boundaries.
- Usage-ranked `utils::glob2rx` with rprojroot's measured DESCRIPTION-file pattern, vectorized
  wildcard translation, documented head/tail trimming, atomic/list/language coercion, attribute
  dropping, namespace access, scalar control validation, and output-budget enforcement.
- Usage-ranked `sQuote` with httr's two measured request-URL logging calls, deterministic C-locale
  defaults, UTF-8/TeX/custom quote styles, resettable `useFancyQuotes`, owned-value coercion,
  attribute removal, missing/NULL behavior, and output-budget enforcement.
- Usage-ranked `stats::family` generic for distributional's measured `family(dist)` call shape, with
  lazy dots, ordered class and `NextMethod` dispatch, user-defined default methods, namespace
  access, visibility, and explicit package-owned-method boundaries.
- Usage-ranked `utils::View` for rstudioapi's measured terminal-context display shape, with owned
  data-frame coercion, custom `as.data.frame` dispatch, bounded character-formatted tabular events,
  inline/Worker callbacks, and a read-only Playground renderer.
- Usage-ranked `path.expand` for diffobj's measured home-path expression, with an explicit
  browser-unknown-home identity contract, plus vectorized `file.path` construction covering its
  higher-reach dependency without host filesystem access.
- Usage-ranked `methods::setOldClass` for diffobj's measured `zulu` guides-method registration, with
  evaluator-session old-class metadata, inherited single-object S4 dispatch, inherited `setAs`
  lookup, invisible registration, and explicit unsupported bridge boundaries.
- Usage-ranked `methods::show` for diffobj's measured style-display example, with session-registered
  S4/old-class method dispatch, inherited lookup, exact method-result visibility, bounded output,
  and a deterministic default display for owned values.
- Usage-ranked `warningCondition` with backports' measured custom-condition construction, GNU
  R-shaped message/call/additional fields, ordered custom condition classes, vector messages,
  condition-message extraction, and the measured class-selective suppression call shape.
- Usage-ranked `stats::qbinom` and `stats::qnorm` with openssl's measured distribution-transform
  examples, vectorized/recycled parameters, lower/upper and ordinary/log tail probabilities,
  longest-input metadata, missing/NaN handling, and explicit browser numeric-size boundaries.
- Usage-ranked `rawToBits` with openssl's measured random-byte-to-logical-bit conversion,
  least-significant-bit-first byte expansion, attribute removal, empty inputs, and strict raw input
  validation.
- Usage-ranked `rowMeans` and `colMeans` with matrixStats' measured matrix-subset validations,
  generalized array `dims`, numeric data frames, real/complex missing-value removal, surviving axis
  names, automatic-versus-explicit data-frame row-name behavior, and empty reductions.
- Usage-ranked `stats::weighted.mean` generic and numeric default with matrixStats' six measured
  reference comparisons, equal/biased/infinite/zero weights, numeric and complex accumulation,
  zero-weight omission, missing-value rules, attribute removal, and custom S3 dispatch.
- Usage-ranked `stats::mad` with matrixStats' two measured reference values, explicit/default
  centers, scale constants, ordinary/low/high even-sample medians, missing-value removal, empty
  inputs, scalar attribute removal, and strict real-numeric boundaries.
- Usage-ranked `stats::rbeta` with loo's two measured central-beta posterior draws, vectorized shape
  and optional non-centrality parameters, session-local reproducibility, stable log-gamma ratios,
  zero/infinite limit distributions, output-length rules, and GNU R-shaped invalid-input results.
- Usage-ranked `stats::dbinom` with loo's measured vectorized posterior log-likelihood, recycled
  quantile/size/probability vectors, stable large-size log probabilities, longest-input metadata,
  boundary masses, missing/NaN distinctions, and non-integer/domain warnings.
- Usage-ranked `base::mat.or.vec` with loo's measured 10-by-3 zero-matrix allocation, double vector
  output when `nc == 1`, column-major matrix metadata otherwise, truncated nonnegative extents,
  zero-sized dimensions, dropped input attributes, and explicit branch/extent errors.
- Usage-ranked primitive `base::seq.int` with data.table's three measured rolling-window index
  calls, scalar and length-based one-argument behavior, ascending/descending numeric steps,
  `length.out`/`along.with`, integer-versus-double storage, custom `seq` S3 dispatch, and finite
  resource bounds.
- Usage-ranked `methods::as` and `methods::setAs` with data.table's measured package-defined IDate
  and ITime coercion shapes, session-local source/target registration, inherited source classes,
  core constructor fallback, identity conversions, namespace lookup, invisible registration, and
  bounded error behavior.
- Usage-ranked `weekdays`, `weekdays.Date`, and `weekdays.POSIXt` with data.table's two measured
  IDate grouping-label calls, inherited Date dispatch, deterministic C-locale full/abbreviated
  names, recycled abbreviation flags, UTC/GMT date-time handling, names, missing/non-finite values,
  and custom S3/error boundaries.
- Usage-ranked `anyDuplicated`, `anyDuplicated.default`, and `anyDuplicated.data.frame` with
  data.table's measured two-column duplicate-row query, package-defined S3 forwarding, first and
  reverse positions, atomic/list/frame equality, factors, missing values, incomparables, and bounded
  controls.
- Usage-ranked `rep.int` with data.table's measured adaptive-window tail construction,
  scalar/per-element truncated counts, coercible count vectors, typed atomic/list/factor/expression
  results, attribute removal, factor metadata, custom internal-S3 dispatch, and allocation guards.
- Usage-ranked `methods::representation` with data.table's measured legacy S4 slot declaration,
  ordered unnamed parent and named slot entries, plain-list output, empty/missing class strings,
  backtick slot names, duplicate detection, strict scalar-character validation, and bounded
  `setClass`/`new` integration.
- Usage-ranked `trunc` with data.table's measured ITime hour-truncation method seam, direct and
  Math-group S3 dispatch, toward-zero real-vector behavior, logical/integer double output, signed
  zero, missing/non-finite values, retained attributes, eager default dots, and bounded invalid
  types.
- Usage-ranked `utils::type.convert` default/list/data-frame methods with data.table's measured
  split-field conversion, logical/integer/double/complex inference, character/factor fallback,
  missing strings and blank fields, decimal controls, integral-double narrowing, matrix shape,
  recursive containers, custom dispatch, and bounded validation.
- Usage-ranked `withVisible` with Shiny's two measured stack-trace calls, exact named result shape,
  single evaluation, nested and dynamic visibility, lazy closure/ellipsis forwarding, and the
  already-forced promise boundary.
- Usage-ranked `strftime` with Shiny's measured log timestamp, recycled UTC/GMT values and formats,
  deterministic C-locale calendar/clock/week/epoch/timezone tokens, fractional seconds, names,
  non-finite values, timezone labels, custom `as.POSIXlt` dispatch, and bounded errors.
- Truncating factor-pattern generation through `gl` and bounded atomic-column data-frame `merge`
  joins with default or explicit keys, duplicate-key expansion, missing-key matching, outer joins,
  sorting, suffixes, and zero-key Cartesian products.
- List/data-frame `within` mutation with lexical fallback, GNU R column ordering and type-specific
  NULL handling, plus metadata-preserving real/complex `sin` with missingness and domain warnings.
- Numeric-order `as.factor` coercion with existing-factor identity, plus grouped `ave`
  transformations with multiple grouping vectors, missing-group retention, callable lookup, and
  type-preserving group replacement.
- Vectorized UTC/GMT `ISOdate` construction with component recycling, class/time-zone metadata, and
  invalid-date missingness, plus bounded atomic `expand.grid` Cartesian data frames with factor
  controls, list inputs, zero-length shapes, and optional output-dimension metadata.
- Type-promoting `append` insertion across atomic, list, factor, pairlist, expression, and matrix
  shapes, plus metadata-preserving real/complex `cos` with missingness and domain warnings.
- Browser-native clockwise `chull` boundary indices across paired/recycled coordinates, matrices,
  data frames, complex vectors, degenerate inputs, duplicates, and finite-coordinate validation.
- Session-local `jitter` perturbation with documented automatic/explicit scales, lazy factor
  handling, constant and non-finite inputs, deterministic seeding, and metadata preservation.
- Caller-aware `match.arg` normalization with exact/partial matching, several-choice filtering,
  atomic choice types/names, NULL, and owned formal-default evaluation.
- Stable `qlogis` logistic quantiles with ordinary/log probabilities, lower/upper tails,
  location/scale recycling, boundary infinities, domain warnings, and metadata retention.
- Column-wise `scale` standardization for numeric vectors, matrices, and data frames with
  logical/explicit controls, missing and degenerate columns, matrix metadata, scaled-statistic
  attributes, and custom S3 dispatch.
- Usage-ranked linear-model infrastructure with normalized formula/data model frames, browser-native
  least squares, numeric/logical/factor/character predictors, treatment contrasts, interactions, dot
  expansion, missing-row omission, subsets, weights, offsets, singular fits, `lm`/`aov` object
  shapes, model matrices, prediction, and S3-aware coefficient/fitted/residual accessors.
- `IQR` and `quantile` types 1 through 9 with atomic coercion, missing-value controls, empty,
  degenerate, and non-finite inputs, and GNU R-compatible attribute removal.
- Usage-ranked `stats::ppoints` for posterior's two measured quantile-grid examples, with documented
  default offsets, scalar or observation-vector point counts, fractional endpoints, numeric/complex
  offsets, recycling warnings, attributes, missingness, lazy nonpositive results, namespace access,
  and bounded allocations.
- Usage-ranked `base::chol`/`chol.default` for posterior's measured `rvar` S3 method seam and owned
  real-matrix upper Cholesky factors, including scalar/data-frame inputs, upper-only source
  semantics, dimnames, positive-semidefinite pivot/rank metadata, warnings, lazy dots, forced
  tolerance, defunct `LINPACK`, and bounded shape/type failures.
- Usage-ranked `stats::pnorm` for posterior's measured vectorized-mean probability example, with
  recycled numeric arguments, lower/upper and ordinary/log tails, longest-input attributes,
  point-mass limits, missing/domain warnings, and an owned far-log-tail expansion.
- Usage-ranked `stats::rgamma` for posterior's measured scalar shape/rate examples, with
  result-length semantics, recycled shape and rate/scale vectors, deterministic session reseeding,
  moment evidence, degenerate limits, missing/domain warnings, and explicit dual-parameter checks.
- Browser-native central Student-t `pt`/`qt` with recycled degrees of freedom, ordinary/log lower
  and upper tails, boundaries, missingness, warnings, and first-longest-input metadata.
- Weighted QR covariance and model inference through `vcov`, usage-ranked `confint`, and
  `df.residual`, including singular fits, parameter selection, model-frame-free fit objects,
  perfect-fit warnings, matrix dimnames, and custom S3 dispatch.
- Usage-ranked `kmeans` clustering for finite numeric vectors, matrices, and numeric data frames,
  with explicit or deterministic session-random starts, `nstart` selection, four documented
  algorithm choices, standard metrics/object fields, metadata, convergence warnings, and errors.
- Usage-ranked `convolve` across circular, open, and filter modes with real/logical/complex input
  behavior, conjugation, matrix-shaped circular indexing, names and attributes, NA/NaN propagation,
  factor warnings, and direct plus radix-2/Bluestein large-vector paths.
- Usage-ranked `as.hexmode` construction from validated integer, integral-double, and hexadecimal
  character inputs, with signed 32-bit string/format behavior, names and matrix metadata,
  class-preserving selection, browser-safe printing, and `!`/`&`/`|` bitwise methods.
- Usage-ranked environment-to-list conversion with S3 dispatch, local-only binding enumeration,
  hidden-name and ordering controls, hash-aware unsorted order, empty-list attributes, and
  result-ordered lazy-promise forcing.
- Usage-ranked browser capability reporting with GNU R's complete 19-name logical-vector shape,
  exact known-name selection, lazy `Xchk`, and explicit false results for unavailable graphics,
  profiling, network, locale, and native host facilities.
- Usage-ranked `kappa` condition numbers with independently implemented Householder QR, 1-norm
  triangular estimation, exact 2-norm singular-value ratios, direct inversion, triangular controls,
  and `qr`/`lm` S3 dispatch.
- Usage-ranked `xtabs` formula cross-tabulation with factor/character/numeric axes, weighted and
  matrix responses, subsets, missing-value controls, unused-level handling, and table metadata.
- Usage-ranked `RNGkind` session control with query/set visibility, partial/default selection,
  independently implemented default Mersenne-Twister uniform and Inversion normal generation,
  Rounding/Rejection discrete samplers, explicit unsupported alternate-engine boundaries, and
  black-box fixed-seed sequence evidence.
- Usage-ranked `sample.int` with the observed `withr` seed-generation shape, the R 4.6 x64
  `.Machine` constant list, fixed-seed replacement/no-replacement and hash paths, weighted sampling,
  large double-valued populations, and exact GNU R black-box evidence.
- Usage-ranked locale inspection and mutation through evaluator-owned `Sys.getlocale`,
  `Sys.setlocale`, `.LC.categories`, and `Sys.localeconv`, including the deterministic C profile and
  `it_IT`/`en_US` monetary conventions observed in `withr`.
- Usage-ranked `tan` with the base `pi` binding required by the measured `testthat` and `data.table`
  expressions, plus real/complex vectorization, metadata, missingness, non-finite limits, and GNU
  R-differential warning evidence.
- Usage-ranked `make.names` with deterministic C-locale syntactic repair, reserved words,
  underscores, coercion, legal-name-first uniqueness, and the measured tibble one-sided-formula
  `.name_repair` callback.
- Usage-ranked `start` with unclassed row origins, regular-time-series period/cycle coordinates,
  decimal off-grid fallbacks, negative periods, configurable `ts.eps`, and S3 method dispatch for
  package-owned object methods.
- Usage-ranked `as.roman` with the measured pillar `utils::` row-identifier path, integer-backed
  Roman values, 1-through-4999 range handling, canonical and documented historical parsing,
  character/width formatting, warnings, idempotence, and matrix metadata.
- Usage-ranked `as.POSIXlt` with testthat's measured construction/length path, zoo's measured
  month-day extraction, an owned 11-component UTC/GMT representation, Date/POSIXct/numeric/character
  inputs, fractional and missing seconds, POSIXlt attributes, and S3 method dispatch.
- Usage-ranked `drop` with four measured matrixStats validations and posterior's measured explicit
  rvar-array reduction, singleton-axis removal, adjusted named dimension axes, scalar/vector naming
  rules, zero-length axes, and custom class/attribute preservation.
- Usage-ranked `rasterImage` with the measured systemfonts native-raster and httr RGB(A)-array
  shapes, scalar/vector placement recycling, rotation/interpolation fields, grayscale/color
  matrices, browser-safe graphics state, and pixel-checked Worker/Canvas coverage.
- Usage-ranked `weights` with the 22 measured loo/posterior S3 call shapes, an independent
  `stats::weights` generic, exact and unique-partial default component lookup, lazy dots,
  `na.exclude` restoration, and weighted/unweighted `lm` access without reproducing package-owned
  method algorithms.
- Usage-ranked `colors`/`colours` with scales' measured default call, the complete ordered 657-name
  GNU R 4.6.0 public catalog, the 502-name `distinct = TRUE` subset, true function aliases, and
  registered `grDevices::` access.
- Usage-ranked `outer` with scales' measured radial-matrix expression, vector/array Cartesian
  products, concatenated dimensions and dimension names, callable or character `FUN`, lazy forwarded
  dots, and the `%o%` operator.
- Usage-ranked `nzchar` with data.table's captured-group conversion and Shiny's input-name guard,
  atomic and bounded recursive coercion, `keepNA`, primitive argument boundaries, zero-length
  values, and attribute-free logical results.
- Usage-ranked `stats::density` dispatch for posterior's and distributional's 94 measured S3 calls,
  plus a bounded independent Gaussian `density.default` with direct grids, weights, `nrd0`,
  missing-value removal, and density-object shape.
- Usage-ranked `setequal` with dplyr's two measured data-frame row-set comparisons, non-dropping
  tibble row selection, and GNU R-shaped atomic, factor, list, NULL, common-type, duplicate, NA, and
  NaN equality.
- Usage-ranked `eigen` with jsonlite's measured random 3-by-3 result shape, arbitrary-order real
  symmetric Jacobi eigenpairs, bounded one- through three-dimensional real asymmetric eigenpairs,
  normalized real/complex vectors, and `only.values`.
- Usage-ranked `colSums` with loo's two measured integer fold-table totals and zoo's measured
  logical non-missing-column selection, plus numeric/complex arrays, numeric data frames, `na.rm`,
  generalized dimensions, empty reductions, and result names/dimnames.
- Usage-ranked `time` with data.table's measured decade-spaced `uspop` years, the S3 generic
  boundary for zoo's 24 package-owned index calls, vector/matrix defaults, regular-series offsets,
  `ts.eps` snapping, and `tsp`/`ts` result metadata.
- Usage-ranked `na.omit` with the S3 method boundary for data.table's four and zoo's four measured
  calls, plus independent atomic, factor, matrix, data-frame, and regular-time-series defaults,
  `NA`/`NaN` incomplete-case detection, classed `na.action` metadata, and retained row shape.
- Usage-ranked `stats::approx` with both measured data.table/zoo calls, independent interpolation,
  ordinary plotting-coordinate inputs, output-grid and boundary controls, missing values, ties, Date
  metadata, and explicit unsupported coercion boundaries.
- Usage-ranked `standardGeneric` with S7's measured S4 generic declaration, explicit and `ANY`
  methods, argument/default/dots forwarding, and bounded missing-method/out-of-context behavior.
- Reproducible top-100 CRAN usage snapshot, feature and core-callable CSV tables, three checked-in
  SVG figures, and one executable acceptance case for every measured feature group.
- Clean-room policy, CSP/browser bundle guards, bundle budgets, conformance, package smoke tests,
  browser tests, Changesets, and CI.

## Current executable evidence

- The feature-priority acceptance matrix covers exactly 25 measured groups and every detector
  operator/function surface.
- Vitest currently passes 9 files and 307 tests.
- `pnpm research:usage:check` validates the committed snapshot, CSV tables, and three SVG figures.
- `pnpm capabilities:check` validates the generated capability manifest against runtime source.
- Checked-in conformance passes 603/603 cases. The optional black-box R oracle passes all 575
  eligible cases and explicitly skips 28 NativR-owned
  representation/random/platform/graphics/unsupported-boundary cases.
- Chromium Worker/playground coverage passes 2/2 tests, including the expanded matrix, weighted
  sampling, S3, and R6 paths with no evaluation-time network requests.
- Package and playground production builds, browser audit, bundle budgets, and the packed clean
  consumer build pass.

The supported toolchain is Node 24 and pnpm 11. Local R, when installed, is used only as an optional
black-box conformance oracle.
