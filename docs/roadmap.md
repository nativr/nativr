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
    pixel-checked handoff to the existing browser `rasterImage` command path. `plot.raster` remains
    a separate graphics milestone.
72. Frequency-ranked device flushing: `grDevices::dev.flush` runs ragg's measured zero-argument
    animation call shape, while paired `dev.hold` gives the owned browser device nested hold levels,
    bounded cross-evaluation page/window/raster buffering, ordered zero-level release, namespace
    access, reset cleanup, and executable return/coercion evidence. Third-party ragg/WebP devices,
    complete high-level plot methods and external display-list formats remain separate milestones.
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
    partial/empty-line handling, message selection, split output, namespace access, and supported
    browser-memory path/connection targets. Host files, complete warning/error sinking, and
    arbitrary print-method fidelity remain separate work.
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
    package-method seams. Zoo's package-owned irregular indexes and methods remain audited-bundle
    and runtime-compatibility work rather than embedded runtime code.
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
97. Frequency-ranked sampling intervals: `stats::deltat` runs zoo's measured regular-series call
    through an S3 package-method seam and an owned default returning one or reciprocal validated
    `tsp` frequency, with lazy dots, namespace access, visibility, ordinary container shapes, and
    malformed-metadata guards. Zoo's irregular index inference and methods remain package-loader
    work.
98. Frequency-ranked lagged windows: `stats::embed` runs zoo's measured `embed(1:5, 3)` dependency
    with current-to-past column-major output for supported vectors and multivariate matrices, vector
    storage preservation, GNU R matrix coercions, attribute removal, measured fractional-vector
    behavior, zero-column matrices, namespace access, and pre-allocation result limits. Factor
    vectors, data frames, expression vectors, raw/list matrices, higher arrays, and fractional
    dimensions on nonempty matrices remain explicit boundaries.
99. Frequency-ranked interval indices: `base::findInterval` runs zoo's measured irregular-Date
    rolling-width expression through checkpointed binary search, with weakly sorted duplicate/
    infinite breakpoints, missing queries, closure and inside controls, flattened numeric coercion,
    namespace access, and attribute-free integer output. Unsafe unchecked invalid break vectors,
    recursive-list coercion, warning-text identity, and long-vector indices remain explicit
    boundaries.
100. Frequency-ranked gray colors: `grDevices::gray.colors` and `grey` run zoo's two measured calls
     through the shared `gray`/`grey` and `gray.colors`/`grey.colors` implementation, including
     deterministic RGB(A) bytes, gamma interpolation, alpha recycling, reversal, descending
     endpoints, aliases, namespace access, attribute removal, errors, and allocation limits.
     Vector-valued palette controls, device profiles, and other palette families remain explicit
     boundaries.
101. Frequency-ranked POSIXct construction: `base::ISOdatetime` runs zoo's measured five-date
     POSIXct index through the shared `ISOdate` calendar path with required clock fields, component
     recycling, fractional seconds, UTC/GMT and empty-zone labels, deterministic browser UTC
     defaults, invalid-calendar missingness, namespace access, metadata, and allocation guards.
     Regional zones/DST and platform-specific invalid-time normalization remain explicit boundaries.
102. Frequency-ranked perspective surfaces: `graphics::persp` runs zoo's measured classed-matrix
     call through an S3-first default with ascending grids, exact scaled/aspect-preserving `4 × 4`
     view matrices, missing-cell omission, bounded projected wireframe/box segments, namespace
     access, Worker/Canvas transport, and display-list replay. Facet fills, lighting, detailed
     axes/text, hidden-line equivalence, hooks, `trans3d`, and arbitrary graphical controls remain
     explicit boundaries.
103. Frequency-ranked point graphics: `graphics::points` runs zoo's documented S3 method extension
     point and an owned default for paired/vector/matrix/data-frame/list/complex coordinates,
     plotting symbols 0:25 and literal characters, recycled colors/fills/sizes/widths, missing-point
     omission, namespace access, bounded Worker/Canvas rendering, and display-list replay. Line/path
     types, locale-dependent glyphs, broader coordinate classes, clipping/log axes, device font
     identity, and arbitrary graphical controls remain explicit boundaries.
104. Frequency-ranked polygon graphics: `graphics::polygon` runs zoo's measured filled-area panel
     helper with paired vector/matrix/data-frame/list/complex coordinates, missing-coordinate
     polygon splitting, recycled fill/border colors and line types/widths, solid/no-fill density,
     even-odd rules, namespace access, bounded Worker/Canvas rendering, and display-list replay.
     Positive hatch density, broader coordinate classes, clipping/log axes, exact device dash/fill
     metrics, and arbitrary graphical controls remain explicit boundaries.
105. Frequency-ranked immutable replacement: `base::replace` runs zoo's measured missing-run helper
     through the shared one-dimensional subset-replacement engine with input immutability,
     numeric/logical/character subscripts, recycling/promotion, names/extension, matrices, factors,
     lists, pairlists, owned data frames, `NULL` paths, namespace access, and resource bounds.
     Expression vectors, arbitrary class-specific `[<-` methods, exact legacy diagnostics, and long
     vectors remain explicit boundaries.
106. Frequency-ranked log-normal generation: `stats::rlnorm` runs zoo's measured 200-value flow
     generator through the evaluator-owned Mersenne-Twister/Inversion stream with historical
     fixed-seed evidence, scalar/vector count rules, recycled log-scale parameters, zero-deviation
     point masses, missing/domain warnings, namespace access, and resource bounds. Alternative
     normal generators and the remaining log-normal distribution family remain explicit boundaries.
107. Frequency-ranked ragged-array grouping: `base::tapply` runs zoo's measured screen-range
     callback with factor-level dimensions/dimnames, missing-group omission, scalar/default
     simplification, list-array results and extraction, forwarded arguments, function names,
     `FUN = NULL` group codes, errors, and resource bounds. Formula indexes, custom split methods,
     broader class-specific simplification, and long vectors remain explicit boundaries.
108. Frequency-ranked plot text: `graphics::text` runs zoo's measured rotated outside-label call
     through resolved Worker/Canvas text commands with S3 dispatch, coordinate and label recycling,
     truncation warnings, missing omission, colors/sizes/font faces/position/adjustment/offset/
     rotation/family, namespace access, recording/replay, and resource bounds. Plotmath, Hershey
     fonts, clipping/log axes, broader class coercion, and device-identical metrics remain explicit
     boundaries.
109. Frequency-ranked model-call updates: `stats::update` runs zoo's documented lattice extension
     call through an S3-first generic with lazy dots, inherited method lookup, `NextMethod`, direct
     and namespace-qualified access, independently authored defaults, and deterministic errors.
     Lattice's `update.trellis` remains package-owned, while built-in stored-call rewriting and
     re-evaluation remain separate language/call work.
110. Frequency-ranked matrix-series graphics: `graphics::matplot` runs bit64's six measured
     performance plots through existing page/window/box/segment/point commands with vector, matrix,
     and numeric data-frame inputs, generated x positions, column and style cycling, incomplete
     omission, logarithmic axes, point/line series, namespace access, Worker/Canvas rendering,
     recording/replay, and resource bounds. Full axes/annotations, class-specific plot/line methods,
     `add = TRUE`, step/histogram types, and device-identical layout remain separate graphics work.
111. Frequency-ranked array permutation: `base::aperm` and `aperm.default` run bit64's measured axis
     swap with numeric/character permutations, reverse defaults, resized or fixed dimensions,
     permuted dimnames, owned atomic/list storage, lazy S3 dots, inherited dispatch, `NextMethod`,
     namespace access, and resource bounds. Table methods, malformed low-level attributes, exact
     diagnostics, and long-vector storage remain separate compatibility work.
112. Frequency-ranked text serialization: `base::dget`, `dput`, `tempfile`, and `unlink` run bit64's
     measured classed-data-frame roundtrip through bounded session-local browser-memory text.
     Canonical source preserves owned atomic/list/pairlist values and ordinary attributes, then
     returns through the existing parser, normalized AST, and evaluator. Host paths and connections,
     external file content, nondefault controls, functions/environments, cycles, binary formats, and
     persistence remain separate I/O and serialization work.
113. Frequency-ranked workspaces: `base::save` and `load` run bit64's observed save/remove/load flow
     through the same browser-memory seam, including object lists, environments, promise forcing,
     duplicate names, verbose output, format controls, visibility, and invalid archives. GNU R
     `.RData` binary interchange, host files, true compression, and persistence remain separate.
114. Source-only package foundation: application-supplied bundles validate DESCRIPTION, NAMESPACE,
     bounded `R/*.R` inputs, optional immutable resources, and dependency versions; load isolated
     namespaces; resolve imports/exports and `::`/`:::`; register S3 methods; run lifecycle hooks;
     attach through `library`; resolve package identity through `utils::packageName`; and execute in
     inline or Worker sessions.
115. Frequency-ranked high-level plotting: `base::plot` and `graphics::plot.default` run rank 22's
     measured numeric calls and package-owned S3 methods through the existing page/window/box/
     segment/point/text journal. One-vector and paired coordinates, regular linear ranges, common
     styles, point/line/both/overplotted/histogram/step/no-draw geometry, panel hooks, scalar
     labels, Worker/Canvas rendering, recording/replay, visibility, and resource bounds have
     evidence. Specialized core methods, full axes, log/aspect layout, margins/clipping, and pixel
     equivalence remain separate graphics work.
116. Build-time pure-R installation: `@nativr/package-tools` consumes bounded source directories,
     safe `.tar.gz` archives, and CRAN-like source indexes; rejects native/JVM/install-hook and
     namespace blockers; preserves R source, package resources, licenses, and dependency
     constraints; applies Collate/platform source selection and portable encodings; verifies
     repository digests; writes deterministic SHA-256 artifacts and locks; and feeds dependency-
     first bundles directly to `createR`. Runtime `system.file` exposes immutable package resources.
     Unchanged `pkgconfig 2.0.3`, `generics 0.1.4`, and `withr 3.0.3` source packages pass opt-in
     digest-pinned repository/install/load/execution tests, including S3 dispatch and state
     restoration. Binary/lazy data, broader NAMESPACE/S4 forms, package test orchestration, and
     audited native Wasm adapters remain later layers.
117. Package text and cooperative waits: `base::readLines` reads same-session temporary text plus
     immutable DESCRIPTION, NAMESPACE, retained R source, and UTF-8/Latin-1 package resources;
     `writeLines` supplies bounded temporary-file and stdout writes; and `Sys.sleep` yields in short
     cancellable timer slices. Host files, compression, URLs, and binary resource/data readers
     remain later layers.
118. Browser text connections: usage-ranked `base::file`, `close`, `tempdir`, and `file.exists`,
     with adjacent `open`, `flush`, `isOpen`, and `seek`, expose session-owned classed handles over
     temporary text and immutable package resources. Implicit/explicit lifecycle, read/write/append
     modes, cursors, summaries, destruction, connection-aware line I/O, `cat`, and
     `utils::capture.output` have GNU R differential evidence. Host files, compression, URLs,
     sockets, typed raw/binary I/O, and the full filesystem remain later layers; raw `readBin()`
     retrieval from owned binary files is now available.
119. Package data and delimited tables: usage-ranked `utils::data`, `write.csv`, and `read.csv`,
     together with `read.table`/`read.csv2`/`read.delim*` and `write.table`/`write.csv2`, discover
     and execute package `data/*.R`, import package text datasets, decode XDR v2/v3 gzip
     `.rda`/`.RData` and `R/sysdata.rda`, and round-trip quoted data frames over bounded
     browser-memory paths/connections. Installed `.rdx`/`.rdb` lazy data, unsupported serialized
     object types/compressors, aliases, host paths, URLs, arbitrary encodings, and the complete
     scanner remain later layers.
120. Browser-owned directories and relative paths: usage-ranked `R.home`, `dir.create`, and
     `list.files`, together with `dir.exists`, `dir`, `list.dirs`, `getwd`, `setwd`,
     `normalizePath`, `basename`, and `dirname`, provide bounded session/package/runtime directory
     trees. Relative line/table/serialization/connection I/O, package-resource enumeration,
     read-only package working directories, recursive session creation/removal, root-escape checks,
     and reset behavior have executable evidence. Host files, links, permissions, metadata, mounts,
     and platform-specific path behavior remain later layers.
121. Portable package serialization: usage-ranked `serialize`, `unserialize`, `saveRDS`, and
     `readRDS`, together with `infoRDS` and the existing `save`/`load`, share an independently
     implemented GNU R XDR v2/v3 codec with bounded gzip. Package `data/*.rda` and `R/sysdata.rda`
     now enter ordinary environments/namespaces without source translation. Broader serialized
     graphs and ALTREP classes, bzip2/xz/zstd, and installed-package `.rdx`/`.rdb` lazy-load
     databases remain later layers.
122. Pure-R metaprogramming wrappers: call-rooted nested replacement, `formals<-`, `environment<-`,
     mixed language/list `c()`, `bquote()` `.()` substitution, list-backed environments, true
     dynamic caller frames, session hooks, closure-like builtin formal metadata, and common
     `graphics::par()` state now let unchanged `withr 3.0.3` load and execute `with_options()`. This
     is reusable runtime support, not a package-specific translation; broader hook delivery,
     complete builtin signatures, arbitrary `bquote` splicing, and the remaining graphical
     parameters stay in progress.
123. Browser graphics-device lifecycle: usage-ranked `grDevices::dev.off`, adjacent `dev.cur` and
     `dev.list`, and `graphics.off` now expose one session-owned device with GNU R-shaped
     null/current values, close visibility, held-command flushing, graphical-parameter reset, and
     deterministic reopen behavior. Multiple simultaneous devices, selection among devices, and
     file-format devices remain later graphics architecture.
124. Browser-safe timing: rank-127 `base::system.time` and adjacent `proc.time` now provide lazy
     single evaluation, closure-like formals, validated `gcFirst`, GNU R-shaped `proc_time`
     names/class/missingness, monotonic elapsed time, timed-error output, and reset behavior for all
     95 measured calls across six packages. Process CPU, child-process accounting, forced host GC,
     and class-specific printing remain explicit platform/runtime work.
125. Browser PNG file device: rank-121 `grDevices::png` now opens a numbered device alongside the
     browser display, records the shared graphics command vocabulary, rasterizes it without DOM or
     native dependencies, and writes a standards-compliant RGBA PNG to the bounded session file
     store on page transition or `dev.off()`. Pixel dimensions, transparent backgrounds, point size,
     per-device `par()` isolation/restoration, numbered multi-page filenames, device selection, PNG
     signature/dimensions, decompression, and raw-byte retrieval have executable evidence. Exact GNU
     R font metrics, anti-aliasing, color profiles, every device parameter, and pixel identity
     remain graphics-depth work.
126. Owned character encodings: rank-144 `base::Encoding`, adjacent `Encoding<-`, `enc2utf8`, and
     `enc2native` now preserve exact per-string bytes plus `unknown`/`latin1`/`UTF-8`/`bytes` marks
     through vector construction, concatenation, subset replacement, raw conversion, and GNU R XDR
     serialization. Browser-native encoding is deterministic UTF-8; general `iconv`, host locale
     codecs, normalization, malformed-byte display, and exhaustive encoding-aware string behavior
     remain later compatibility depth.
127. Owned Cauchy distribution family: rank-149 `stats::rcauchy` now runs the measured ggplot2,
     pillar, and purrr result shapes over the evaluator-owned uniform stream. Adjacent `dcauchy`,
     `pcauchy`, and `qcauchy` share vectorized location/scale validation, stable ordinary/log tails,
     GNU R-shaped missing/domain warnings, metadata, and exact formals. Wider distribution coverage,
     long-vector behavior, and exhaustive browser-libm identity remain compatibility-depth work.
128. Session-owned environment variables: ranks 162 `Sys.getenv` and 175 `Sys.setenv`, plus adjacent
     `Sys.unsetenv`, now operate on an explicitly configured per-session map in inline and Worker
     execution. GNU R 4.6 differential cases cover query/mutation/coercion/formals, reset restores
     the initial snapshot, and unchanged `withr 3.0.3` executes `with_envvar()` with cleanup. Host
     environment inheritance and operating-system mutation remain intentionally unavailable.
129. Usage-ranked image grids: rank-163 `graphics::image` and `image.default` now run the measured
     scales, viridisLite, and RColorBrewer matrix/palette calls through a reusable S3/default path.
     Center/boundary coordinates, regular raster and irregular polygon grids, colour intervals,
     missing transparency, one-row strips, Worker transport, and Canvas pixels have executable
     evidence. Complete axes, legacy intervals, device heuristics, and pixel identity remain later
     graphics-depth work.
130. Usage-ranked browser requests: rank-166 `utils::browseURL` now runs the eight measured
     xfun/htmltools/knitr/httpuv calls through an inert per-evaluation host journal. R-function
     callbacks, suppression, invisible returns, URL validation, bounded virtual-file bytes,
     transferable Worker transport, `onBrowse`, and a user-clicked Playground viewer have executable
     evidence. Fetching, automatic navigation, host files, process launch, and full
     platform-specific browser diagnostics remain deliberate host-adapter boundaries.

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
4. Expand the executable package installer from the pinned `pkgconfig`/`generics`/`withr` proofs to
   the measured pure-R package corpus, binary/text data adapters, broader namespace/object-system
   declarations, package test orchestration, and R CMD check scenarios without embedding GNU R or
   webR.
5. Verify platform, browser, locale, time-zone, graphics, numeric, and performance behavior against
   the completion criteria in the GNU R compatibility ledger.
6. Continue refreshing package-usage snapshots so high-reach gaps determine implementation order
   within the full compatibility objective.

GNU R/webR embedding, JavaScript code generation, and unreviewed external source remain prohibited
by the clean-room and security policies.
