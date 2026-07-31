# Roadmap

## Completed: browser-native foundation

The Worker-first vertical slice, normalized parser, typed vectors, missingness, closures, promises,
reference operators, playground, packaging, clean-room policy, and conformance system are in place.

## Completed: evidence-ranked feature surface

Language subset 0.120 implements an executable surface for all 25 groups in the
[package-usage snapshot](feature-priorities.md):

1. Collections and selection: sequences/repetition, lists, names/attributes, `[`, `[[`, `$`, and
   one-/two-dimensional replacement.
2. Operators and control: comparisons, three-valued logical operators, conditionals, return, and
   bounded loops.
3. Vector productivity: strings, deterministic random distributions and weighted sampling,
   matrices/arrays, descriptive statistics, sorting, and matching.
4. Structured data: data frames, tibble/tribble construction, factors, ellipsis, and the complete
   measured apply/map function-name surface.
5. Higher-level forms: richer formula IR, native and magrittr-style pipes, registered namespaces, S3
   method dispatch, and bounded S4/R6/vctrs construction.
6. Frequency-ranked statistics depth: the initial `lm`/`aov` model-frame, least-squares,
   factor-contrast, prediction, accessor, weighted covariance, and confidence-interval chain, plus
   central Student-t tails, `IQR`, and quantile types 1 through 9.
7. Frequency-ranked clustering depth: finite numeric vector, matrix, and data-frame `kmeans` inputs,
   explicit or deterministic session-random starts, and the documented four algorithm choices with
   standard result metrics.
8. Frequency-ranked signal depth: real/complex circular, open, and filtering `convolve` behavior
   backed by owned direct, radix-2, and arbitrary-length Bluestein transforms.
9. Frequency-ranked integer presentation depth: `as.hexmode`, its formatting/printing methods,
   class-preserving selection, and signed 32-bit bitwise operations.
10. Frequency-ranked environment depth: S3-aware `as.list` conversion with local binding,
    hidden-name, ordering, hash-mode, and lazy-promise behavior.
11. Frequency-ranked host inspection: GNU R-shaped `capabilities` selection with explicit
    browser-platform non-applicability values.
12. Frequency-ranked numerical diagnostics: `kappa` condition-number estimates and exact results
    over owned vectors, matrices, data frames, QR factors, and linear-model objects.
13. Frequency-ranked cross-tabulation: `xtabs` over normalized formulas, factor/character/numeric
    axes, weighted or matrix responses, subsets, missing values, and table metadata.
14. Frequency-ranked random-kind control: `RNGkind` query/selection for the default owned
    Mersenne-Twister/Inversion pair and both discrete samplers, with explicit alternate-engine
    boundaries and fixed-seed differential evidence.
15. Frequency-ranked integer sampling: `sample.int` covers exact default-engine fixed-seed
    sequences, replacement and no-replacement modes, optional hash selection, weighted sampling,
    large double-valued populations, and the `.Machine` constants used by sampled package code.
16. Frequency-ranked locale conventions: evaluator-owned `Sys.getlocale`, `Sys.setlocale`, and
    `Sys.localeconv` state covers the deterministic C profile plus the `it_IT` and `en_US` monetary
    profiles observed in package examples, without consulting the host operating system.
17. Frequency-ranked tangent: the base `pi` binding and vectorized real/complex `tan` run the
    measured `testthat` and `data.table` expressions with differential missingness, metadata,
    non-finite-limit, and warning evidence.
18. Frequency-ranked syntactic names: `make.names` implements deterministic C-locale repair and
    legal-name-first uniqueness, including tibble's measured one-sided-formula `.name_repair`
    callback over duplicate columns.
19. Frequency-ranked time-series origins: `start` complements `end` with default row origins,
    regular-series period/cycle coordinates, `ts.eps` grid recognition, decimal fallbacks, negative
    periods, and package-method S3 dispatch.
20. Frequency-ranked Roman row identifiers: `as.roman` runs pillar's measured `utils::` call with
    integer-backed values, canonical and documented historical parsing, character/width formatting,
    range/missing behavior, and matrix metadata.
21. Frequency-ranked broken-down date-times: `as.POSIXlt` runs testthat's measured
    construction/length path and zoo's measured month-day extraction with an owned 11-component
    UTC/GMT representation, fractional and missing seconds, documented attributes, and S3 dispatch.
22. Frequency-ranked singleton-axis reduction: `drop` runs matrixStats' four validation calls and
    posterior's explicit rvar-array reduction with adjusted named dimensions, scalar/vector naming
    rules, zero-length axes, and preservation of custom classes and unrelated attributes.
23. Frequency-ranked raster graphics: `rasterImage` runs the measured systemfonts native-raster and
    httr RGB(A)-array shapes through owned graphics commands, with bounded `plot.new`/`plot.window`
    state, Worker transport, and Canvas rendering.
24. Frequency-ranked model-weight dispatch: `stats::weights` supplies the independent S3 generic,
    default list/pairlist component lookup, `na.exclude` restoration, and weighted/unweighted `lm`
    behavior needed to host the 22 measured loo/posterior method calls without implementing those
    package-owned methods.
25. Frequency-ranked named colors: `colors` and its true `colours` alias expose the complete ordered
    GNU R 4.6.0 657-name catalog, the 502-name distinct subset, and registered `grDevices::` lookup
    required by scales' measured call.
26. Frequency-ranked outer products: `outer` runs scales' radial-matrix expression and covers
    vector/array Cartesian products, concatenated dimensions and dimension names, callable or
    character functions, lazy dots, and `%o%`.
27. Frequency-ranked nonempty-string tests: `nzchar` runs data.table's captured-group converter and
    Shiny's selected-name guard with `keepNA`, atomic and bounded recursive coercion, primitive
    argument boundaries, and attribute-free logical results.
28. Frequency-ranked density dispatch: `stats::density` forwards the 94 measured posterior and
    distributional S3 calls without implementing package-owned methods; a bounded independent
    Gaussian `density.default` adds numeric grids, weights, `nrd0`, and missing-value removal.
29. Frequency-ranked set equality: `setequal` runs dplyr's two measured data-frame row-set calls,
    keeps tibble row selection non-dropping, and covers base atomic, factor, list, NULL, coercion,
    duplicate, NA, and NaN semantics.
30. Frequency-ranked eigendecomposition: `eigen` runs jsonlite's measured random 3-by-3 result
    shape, supports arbitrary-order real symmetric Jacobi eigenpairs, and returns normalized real or
    complex eigenvectors for bounded one- through three-dimensional real asymmetric matrices.
31. Frequency-ranked column summaries: `colSums` runs loo's measured integer fold-table totals and
    zoo's logical non-missing-column mask with generalized numeric/complex array dimensions, numeric
    data frames, missing-value removal, empty reductions, and retained output axes.
32. Frequency-ranked sampling coordinates: `time` runs data.table's decade-spaced regular series,
    forwards zoo's package-owned S3 methods, and covers default vector/matrix rows, `tsp` intervals,
    offsets, integer snapping, and `ts` result metadata.
33. Frequency-ranked incomplete-case omission: `na.omit` forwards data.table's and zoo's eight
    measured calls to package-owned S3 methods and supplies owned atomic, factor, matrix,
    data-frame, and regular-time-series defaults with omission metadata.
34. Frequency-ranked upward rounding: `ceiling` runs data.table's positive exponential-sample
    conversion and zoo's nested tick-alignment helper with real-vector/array attributes,
    missing/non-finite values, and direct/Math S3 dispatch.
35. Frequency-ranked numeric interpolation: `stats::approx` runs data.table's sequence expansion and
    zoo's Date-coordinate helper with linear/constant methods, endpoint rules, generated grids,
    missing-pair handling, duplicate reducers, and explicit-coordinate metadata.
36. Frequency-ranked standard S4 generic dispatch: `standardGeneric` runs S7's measured generic
    definition body with session-local class/method lookup, formal/default/dots forwarding, `ANY`,
    and call-context boundaries.
37. Frequency-ranked color-ramp palettes: `grDevices::colorRampPalette` runs isoband's two measured
    21-color Lab Viridis calls through an owned returned function, with linear RGB/Lab
    interpolation, bias, alpha, and byte-exact GNU R oracle evidence.
38. Frequency-ranked session information: `utils::sessionInfo` runs otel's measured platform lookup
    with deterministic browser/runtime identity, R 4.6 target metadata, current locale/RNG state,
    attached core packages, and explicit platform-specific boundaries.
39. Frequency-ranked ordered-factor coercion: `as.ordered` runs generics' measured letters example,
    preserves factor names and identity, drops unused levels, and provides the package-method S3
    extension boundary.
40. Frequency-ranked array coercion: `as.array` runs rstan's measured package-method call shape,
    forwards lazy dots through S3 dispatch, and supplies an independent one-dimensional default with
    name-to-dimname promotion and existing-array identity.
41. Frequency-ranked nonlinear minimization: `stats::nlm` runs rstan's measured analytic-gradient
    callback shape with lazy objective arguments, checked supplied derivatives, finite-difference
    fallbacks, bounded BFGS minimization, optional Hessians, and GNU R-shaped result fields and
    convergence codes.
42. Frequency-ranked general-purpose optimization: `stats::optim` runs rstan's measured BFGS
    objective/gradient pair with lazy forwarded arguments, named and scaled parameters, numerical
    derivative fallbacks, optional Hessians, named call counts, maximization scaling, and explicit
    unsupported-method boundaries.
43. Frequency-ranked scatterplot-matrix dispatch: `graphics::pairs` runs rstan's measured
    `pairs.stanfit` call through the S3 extension protocol with lazy labels, panel functions,
    parameter selection, conditions, and graphical dots while keeping the full default plot matrix
    as explicit future graphics-device work.
44. Frequency-ranked heat palette: `grDevices::heat.colors` returns the measured deterministic
    sequential palette with alpha, reversal, numeric-count coercion, and explicit input boundaries.
45. Frequency-ranked factorials: `factorial` runs xfun's measured scalar example and supplies a
    vectorized direct-product/Lanczos real path with missingness, attributes, overflow, and domain
    warnings.
46. Frequency-ranked direct least squares: `stats::lsfit` runs xfun's measured fit with vector or
    matrix predictors, optional weights, intercept/tolerance controls, complete-case handling, and
    classed QR result metadata from the owned solver.
47. Frequency-ranked paragraph wrapping: `strwrap` runs xfun's measured vector example with
    paragraph boundaries, sentence gaps, width/indent/prefix controls, coercion, and simplified or
    list-shaped output.
48. Frequency-ranked color conversion: `rgb` closes the earlier rank-207 dependency and `col2rgb`
    runs stringr's measured color-to-hex helper with the complete named catalog, hexadecimal alpha,
    transparency, numeric palette indices, matrix metadata, and channel recycling.
49. Frequency-ranked array simplification: `simplify2array` runs stringi's equal- and unequal-length
    list examples with scalar/vector promotion, list matrices, exception lengths, names, and
    higher-dimensional array metadata.
50. Frequency-ranked string-to-language parsing: `str2expression` and `str2lang` reuse the owned
    Tree-sitter/normalized-AST path for backports' measured source strings, expression vectors,
    calls, symbols, constants, comments, missing text, and explicit result-length/type boundaries.
51. Frequency-ranked URL decoding: `utils::URLdecode` runs backports' direct example with vectorized
    ASCII/UTF-8 percent bytes, literal plus signs, missing/empty/NULL inputs, and explicit
    malformed-byte browser-string boundaries.
52. Frequency-ranked warning conditions: `warningCondition` runs backports' measured custom class
    construction and suppression shape with owned message/call/additional fields, ordered class
    prefixes, vector messages, and explicit missing-class metadata boundaries.
53. Frequency-ranked distribution quantiles: `stats::qbinom` and `stats::qnorm` run openssl's
    measured random-number transforms with recycled parameters, ordinary/log tails, metadata,
    missingness, canonical quantiles, and bounded browser numeric limits.
54. Frequency-ranked raw bit expansion: `rawToBits` runs openssl's measured random-byte conversion
    with eight least-significant-bit-first raw outputs per byte, attribute removal, empty inputs,
    and strict raw input validation.
55. Frequency-ranked matrix means: `rowMeans` and `colMeans` run matrixStats' measured matrix-subset
    validations with generalized array dimensions, numeric data frames, complex values,
    missing-value removal, surviving axis names, automatic row-name handling, and empty reductions.
56. Frequency-ranked weighted means: `stats::weighted.mean` runs matrixStats' six comparisons with
    an S3 generic, numeric/complex accumulation, zero-weight omission, paired missing-value removal,
    non-finite arithmetic, scalar shape, and strict input boundaries.
57. Frequency-ranked robust scale: `stats::mad` runs matrixStats' two reference values with
    default/explicit centers, scale constants, ordinary/low/high median selection, missing-value
    removal, empty inputs, scalar shape, and strict real-numeric boundaries.
58. Frequency-ranked beta generation: `stats::rbeta` runs loo's two measured prior/posterior calls
    with recycled central/non-central parameters, stable log-gamma ratios, deterministic session
    state, distribution limits, documented result lengths, and invalid-input handling.
59. Frequency-ranked binomial densities: `stats::dbinom` completes loo's measured vectorized
    log-likelihood call with recycled parameters, stable log probabilities, metadata, boundary
    masses, missing/NaN distinctions, and GNU R-shaped warnings.
60. Frequency-ranked zero allocation: `base::mat.or.vec` runs loo's measured 10-by-3 scratch-matrix
    call with owned double zeros, vector/matrix branch behavior, truncated nonnegative extents,
    zero-sized dimensions, and explicit invalid-input boundaries.
61. Frequency-ranked primitive sequences: `base::seq.int` runs data.table's three measured
    rolling-window index calls with single-input length behavior, numeric steps,
    `length.out`/`along.with`, integer/double storage, `seq` S3 dispatch, and finite allocation
    guards.
62. Frequency-ranked methods coercion: `methods::as` runs data.table's two measured IDate/ITime
    identity checks through session-local `setAs` registration, inherited source classes, core
    constructor fallback, namespace access, and bounded identity/error behavior without bundling
    package-owned classes or methods.
63. Frequency-ranked weekday extraction: `weekdays` runs data.table's two measured IDate grouping
    labels through inherited Date dispatch, deterministic C-locale full/abbreviated names, UTC/GMT
    POSIXt methods, recycled abbreviation controls, and custom S3/error boundaries.
64. Frequency-ranked duplicate-position lookup: `anyDuplicated` runs data.table's measured
    two-column `by` query through package-defined S3 dispatch and supplies owned atomic/list/frame
    defaults with directional scans, missing-value distinctions, incomparables, and bounded errors.
65. Frequency-ranked fixed repetition: `rep.int` runs data.table's measured adaptive-window tail
    call with scalar/per-element counts, typed atomic/list/factor/expression output, documented
    attribute removal, internal S3 dispatch, count coercion, and pre-allocation bounds.
66. Frequency-ranked legacy S4 declarations: `methods::representation` runs data.table's measured
    slot-definition list through the bounded `setClass`/`new` path with ordered parent/slot entries,
    scalar character validation, backtick names, duplicate rejection, and empty/missing-string
    boundaries.
67. Frequency-ranked toward-zero rounding: `trunc` supplies data.table's measured ITime method
    extension seam with direct/Math S3 dispatch plus owned real-vector truncation, signed zero,
    metadata, missing/non-finite values, eager dots, and bounded type errors.
68. Frequency-ranked automatic field conversion: `utils::type.convert` runs data.table's measured
    split-column callback through owned default/list/data-frame S3 methods with logical, integer,
    double, complex, character, and factor inference plus missing/decimal and shape controls.
69. Frequency-ranked visibility capture: `withVisible` runs Shiny's two measured stack-trace
    examples with an exact named result, single evaluation, assignment/invisible/dynamic visibility,
    lazy closure and ellipsis forwarding, and already-forced promise behavior. The following
    name-ranked `df()` observation is recorded as a Shiny-local reactive call rather than
    misclassified as `stats::df`.
70. Frequency-ranked date-time formatting: `strftime` runs Shiny's measured logging timestamp
    through owned UTC/GMT POSIXlt conversion and deterministic C-locale formatting, with recycled
    formats, common calendar/clock/week/epoch/timezone tokens, fractional seconds, names, non-finite
    values, timezone labels, custom dispatch, and bounded errors. The intervening `dist()` and
    `simulate()` observations are recorded as Shiny-local callbacks, while the genuine
    `normalizePath` call remains deferred behind a browser filesystem adapter.
71. Frequency-ranked raster coercion: `grDevices::as.raster` converts ragg's measured capture matrix
    to GNU R's row-first raster shape, with grayscale logical/numeric/raw values, numeric/raw RGB(A)
    arrays, vector reshaping, missing/scaling boundaries, S3 methods, predicates, identity, and a
    pixel-checked handoff to the existing browser `rasterImage` command path. General `plot` and
    `plot.raster` remain separate graphics milestones.
72. Frequency-ranked device flushing: `grDevices::dev.flush` runs ragg's measured zero-argument
    animation call shape, while paired `dev.hold` gives the owned browser device nested hold levels,
    bounded cross-evaluation page/window/raster buffering, ordered zero-level release, namespace
    access, reset cleanup, and executable return/coercion evidence. Third-party ragg/WebP devices,
    general `plot`, and external display-list formats remain separate milestones.
73. Frequency-ranked plot replay: `grDevices::recordPlot` snapshots the supported browser device's
    bounded page/window/raster display list and `replayPlot` runs ragg's measured same-session
    record/replay shape, including public object shape, metadata retention, invisible return,
    namespace access, held release, malformed-input guards, and reset/allocation boundaries. GNU R
    recorded-plot serialization, package reload/attach side effects, `print.recordedplot`, arbitrary
    devices, and cross-version/device replay remain outside this milestone.
74. Frequency-ranked probability points: `stats::ppoints` runs posterior's two measured
    `quantile(x, ppoints(10))` examples, with documented default offsets, scalar and
    observation-vector point counts, fractional endpoints, numeric/complex offset recycling,
    names/dimensions, missingness, lazy nonpositive results, namespace access, warnings, and
    allocation guards. Posterior's `rvar` methods, GNU R long vectors, and exhaustive class-specific
    arithmetic remain separate compatibility work.
75. Frequency-ranked Cholesky decomposition: `base::chol` supplies posterior's measured `rvar` S3
    extension seam, while independently authored `chol.default` computes bounded upper factors for
    real/logical matrices, scalars, and numeric data frames. Upper-only input, dimnames,
    positive-definite failures, optional positive-semidefinite pivot/rank results, warnings, lazy
    dots, forced tolerance, and defunct controls have executable evidence. Posterior's method, exact
    LAPACK identity, sparse/tensor/complex matrices, and the wider decomposition family remain
    separate compatibility work.
76. Frequency-ranked normal probabilities: `stats::pnorm` runs posterior's measured vectorized mean
    comparison with recycled real arguments, lower/upper and ordinary/log tails, longest-input
    metadata, point-mass limits, missing/domain boundaries, and direct far-log-tail evaluation.
    Complex/class-specific inputs, exact platform-libm identity, and the wider normal distribution
    family remain separate compatibility work.
77. Frequency-ranked gamma generation: `stats::rgamma` runs posterior's measured scalar shape/rate
    examples through the existing session-owned gamma sampler, with result-length and parameter
    recycling, rate/scale equivalence, deterministic reseeding, moments, zero/infinite limits,
    missing/domain warnings, and strict conflicting-parameter errors. Exact GNU R RNG sequences,
    exhaustive underflow boundaries, and the wider gamma family remain separate compatibility work.
78. Frequency-ranked browser line segments: `graphics::segments` runs posterior's measured vertical
    credible-interval call through the owned page/window journal, with omitted endpoint defaults,
    coordinate/style recycling, resolved colors and dash patterns, missing/non-finite omission,
    Worker transport, Canvas pixel evidence, hold/flush, and record/replay integration. Coordinate
    classes, log axes, general graphical parameters, complete clipping/margins, and cross-device
    pixel identity remain separate compatibility work.
79. Frequency-ranked glob translation: `utils::glob2rx` runs rprojroot's measured DESCRIPTION-file
    root pattern through a browser-owned text converter, with vectorized wildcard/anchor handling,
    documented head/tail trimming, limited regex punctuation escaping, ordinary owned-value
    coercion, dropped attributes, scalar control validation, and output limits. Filesystem matching,
    platform path rules, byte-encoding identity, undocumented escape behavior, and general regex
    execution remain separate compatibility work.
80. Frequency-ranked display quoting: `sQuote` runs httr's two measured request-URL callback
    expressions with deterministic C-locale ASCII output, explicit UTF-8/TeX and custom quote pairs,
    resettable option selection, owned-value coercion, missing/NULL handling, attribute removal, and
    output limits. Host-locale discovery, arbitrary encodings, custom coercion methods, `dQuote`,
    and lossless formula-source reconstruction remain separate compatibility work.
81. Frequency-ranked distribution-family dispatch: `stats::family` supplies distributional's
    measured `family(dist)` S3 extension seam with lazy dots, ordered class/`NextMethod` resolution,
    user-defined default dispatch, namespace access, and no-method boundaries. Distributional object
    construction, its package-owned `family.distribution` method, namespace loading, and full
    `family.glm` behavior remain separate compatibility work.
82. Frequency-ranked data viewing: `utils::View` maps rstudioapi's measured terminal-context call
    shape to a bounded character-formatted table journal, with owned coercion, custom
    `as.data.frame` dispatch, inline/Worker callbacks, and a Playground renderer. Desktop windows,
    editing, arbitrary package formatting methods, and RStudio terminal APIs remain separate work.
83. Frequency-ranked browser-safe path text: `path.expand` runs diffobj's measured home-path
    expression under the documented unknown-home rule, while the higher-reach `file.path` dependency
    supplies vectorized construction, recycling, separator selection, coercion, and resource limits.
    Host-home discovery, normalization, existence checks, and filesystem access remain separate
    work.
84. Frequency-ranked old-style class registration: `methods::setOldClass` runs diffobj's measured
    `zulu` guides-method example and links declared S3 class chains into evaluator-session
    single-object S4 dispatch and explicit coercion lookup. Namespace metadata, registration
    verification, explicit `S4Class` bridges, and complete methods machinery remain separate work.
85. Frequency-ranked S4 display: `methods::show` supplies diffobj's measured style-display extension
    seam with exact/inherited old-class method lookup, dynamic method-result visibility, bounded
    output, and deterministic fallback rendering. Diffobj classes/styles, ANSI/HTML capability
    handling, pagers, and automatic bare-expression S4 display remain separate work.
86. Frequency-ranked in-memory output capture: `utils::capture.output` runs httpuv's measured
    request-inspection expression through nested bounded stream capture, visible-result printing,
    partial/empty-line handling, message selection, split output, and namespace access. Files,
    connections, complete warning/error sinking, and arbitrary print-method fidelity remain separate
    work.
87. Frequency-ranked demo catalog boundary: `utils::demo` reproduces the empty GNU R `packageIQR`
    catalog shape without reading a host library. Topic lookup, external package discovery, and demo
    script execution fail explicitly pending package namespaces, resources, and source loading; no
    httpuv server demo compatibility is claimed.
88. Frequency-ranked RNG-version defaults: `RNGversion` runs zoo's measured R-3.5 reproducibility
    setup with prior-kind return values, historical Rounding warnings, and current defaults from R
    3.6 onward. Pre-R-1.7 uniform and normal generator families remain explicit unsupported
    boundaries.
89. Frequency-ranked regular time-series foundation: `stats::ts`, `as.ts`, `frequency`, and
    `stats::window` cover ranks 439, 440, 442, and 443 with vector/matrix metadata, calendar
    coordinates, endpoint recycling, integral downsampling, extension padding, and independent S3
    package-method seams. Zoo's package-owned irregular indexes and methods remain package-loader
    work rather than embedded runtime code.
90. Frequency-ranked browser legend: `graphics::legend` covers zoo's three measured line/point call
    shapes with keyword and coordinate placement, recycled styles, optional boxes/titles/columns,
    invisible geometry results, Worker transport, Canvas rendering, bounded journals, and
    same-session record/replay. Complete base graphics and device-identical layout remain separate
    work.
91. Frequency-ranked comment metadata: `comment`, `comment<-`, and the equivalent `attr<-` path
    cover zoo's measured set/query example, missing character comments, deletion, visibility,
    validation, and preservation of other owned attributes. Extending attributes to closures,
    environments, and language objects remains separate value-model work.
92. Frequency-ranked regular-series cycles: `stats::cycle` covers zoo's two measured call shapes
    through a validated vector/matrix-row default and an S3 extension seam, including calendar
    starts, fractional frequencies, `tsp` metadata, lazy dots, and package-owned `cycle.zoo`
    forwarding without embedding zoo.
93. Frequency-ranked significant-digit rounding: `signif` runs zoo's two plot-limit calculations and
    covers decimal ties-to-even, real/complex vectors, recycled/clamped digit controls, metadata,
    missing and non-finite values, resource limits, and direct/Math S3 dispatch.
94. Frequency-ranked linear axis ticks: `graphics::axTicks` runs zoo's measured secondary-axis
    lookup through owned `plot.window` state and explicit `axp` parameters, including forward and
    reversed 1/2/5-power-of-ten ranges, lazy linear arguments, namespace access, validation, and
    allocation limits. Logarithmic axes and complete base-graphics axis drawing remain separate
    work.
95. Frequency-ranked plot frames: `graphics::box` runs zoo's measured redraw through a bounded
    plot-region graphics event with all documented `bty` edge shapes, resolved `col`/`fg`, line
    styles, positive widths, Worker/Canvas rendering, and same-session record/replay. Figure and
    margin regions remain separate layout work.
96. Frequency-ranked grouped boxplots: `graphics::boxplot` runs zoo's measured vector/matrix example
    through owned Tukey statistics and a bounded S3/default graphics path, including grouped
    list/matrix inputs, missing/empty groups, whiskers/notches/outliers, widths/positions,
    Worker/Canvas rendering, and same-session record/replay. Formula/data-frame methods, logarithmic
    axes, arbitrary `pars`, complete annotation/axes, and device-identical layout remain separate
    work.

The exact catalog and executable evidence live in
[`feature-priority.test.ts`](../packages/nativr/test/feature-priority.test.ts). "Completed" means
the measured surface is runnable, not that NativR implements all R semantics or arbitrary packages.

## In progress: GNU R compatibility depth

1. Complete core value, coercion, attribute, missingness, vector, call, promise, scoping, and quoted
   language semantics. The current symbol/language/expression/pairlist, environment,
   `quote()`/`eval()`/`parse()`/`substitute()`/`match.call()`, and call construction slice is an
   owned-language vertical path, not the completion of dynamic language behavior.
2. Complete indexing, arrays, frames, conditions, dates/times, object systems, I/O, serialization,
   numeric algorithms, statistics, and graphics behind browser-safe host interfaces.
3. Implement the full inventoried core namespace surface with per-callable differential evidence.
4. Run independently authored package fixtures and R CMD check scenarios, then expand toward package
   namespace/loading compatibility without embedding GNU R or webR.
5. Verify platform, browser, locale, time-zone, graphics, numeric, and performance behavior against
   the completion criteria in the GNU R compatibility ledger.
6. Continue refreshing package-usage snapshots so high-reach gaps determine implementation order
   within the full compatibility objective.

GNU R/webR embedding, JavaScript code generation, and unreviewed external source remain prohibited
by the clean-room and security policies.
