# Roadmap

## Primary strategy: complete the shared R substrate, then reuse package source

NativR's compatibility goal is Base R first and package reuse second. The runtime should implement
language semantics plus the documented `base`, `methods`, `stats`, `utils`, `graphics`, and
`grDevices` contracts once, then execute unchanged pure-R package source through the ordinary
package loader. Package-specific TypeScript rewrites are not the scaling strategy.

The practical target for “arbitrary pure-R packages” is an install pipeline that accepts any
standard source package, resolves its dependency closure, and either loads it unchanged or reports
the first concrete unsupported contract. Success still depends on all transitive code staying inside
the implemented R, namespace, data, resource, and host-adapter surface; “pure R” alone is not a
compatibility guarantee. Priority is therefore determined by measured package reach: each shared
Base R gap is implemented once, differential-tested against GNU R, and credited to every package
whose unchanged source can then pass it.

The remaining package-system foundation is ordered as follows:

1. broaden Base R and recommended-package semantics by measured package reach;
2. finish namespace directives, S3 and S4 registration/dispatch, package hooks, and dependency
   resolution needed by real source packages;
3. cover portable source-package data and resource formats, while keeping installed lazy-load
   databases and native code as separately declared compatibility layers;
4. continuously run unchanged public pure-R packages and publish executable pass/blocker evidence.

This changes neither the clean-room boundary nor the completion standard below: full compatibility
is claimed only when the inventory and cross-browser differential evidence support it.

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
    Gaussian and Epanechnikov `density.default` adds numeric grids, weights, `nrd0`, kernel
    roughness, and missing-value removal.
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
    allocation limits. Logarithmic ticks and exact floating-point boundary identity remain separate
    work; the later usage-ranked `axis` increment supplies bounded linear drawing.
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
     Vector-valued gray-palette controls, device profiles, and HCL palette catalogs remain explicit
     boundaries; the classic HSV palette family is covered separately.
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
     safe `.tar.gz` archives, and CRAN-like source indexes; rejects native-compilation/install-hook
     and namespace blockers; preserves R source, package resources, licenses, and dependency
     constraints; applies Collate/platform source selection and portable encodings; verifies
     repository digests; writes deterministic SHA-256 artifacts and locks; and feeds dependency-
     first bundles directly to `createR`. Runtime `system.file` exposes immutable package resources.
     Unchanged `pkgconfig 2.0.3`, `generics 0.1.4`, `withr 3.0.3`, `R6 2.6.1`, and
     `viridisLite 0.4.3` source packages pass opt-in digest-pinned repository/install/load/execution
     tests, including S3 dispatch and state restoration, reference objects, and package-owned Lab
     spline palettes. Binary/lazy data, broader NAMESPACE/S4 forms, package test orchestration, and
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
131. Browser-owned memory census: rank-168 `base::gc` and adjacent `gcinfo` now expose GNU R's
     closure-like formals, named 2-by-6 report, resettable high-water state, full/partial counters,
     and verbose message shape over the reachable NativR R-value graph. The same silent path now
     backs `system.time(gcFirst = TRUE)`. Exact GNU allocator counts, automatic host-GC messages,
     weak-reference finalization, and forced JavaScript collection remain explicit runtime-depth
     boundaries.
132. Usage-ranked connected lines: rank-174 `graphics::lines` and exported `lines.default` now run
     all 20 measured calls across scales, matrixStats, posterior, and zoo through a reusable S3 and
     coordinate-normalization path. All nine documented plot types, missing-value path breaks,
     line/point style rules, invisible default results, Worker/Canvas rendering, PNG output,
     recording/replay, and resource bounds have evidence over the existing segment/point journal.
     Broader coordinate classes, complete graphical parameters, clipping/log transforms, line
     cap/join controls, and device-identical rendering remain graphics-depth work.
133. Explicit system-command capability: rank-176 `base::system` now preserves GNU R 4.6 formals,
     validation, captured/output status shapes, and warnings over one opt-in host handler. Inline
     calls invoke the handler directly; Worker calls suspend over a correlated request/result
     bridge. The default remains fail-closed, the Playground allows only one virtual echo command,
     and shell parsing, executable discovery, native compilation, environment inheritance, signals,
     and real process cancellation remain host/platform work.
134. Usage-ranked time intervals: rank-177 `base::as.difftime` now runs the two measured vctrs and
     scales calls through numeric or recycled character interval construction with exact formals,
     automatic/explicit units, names, missing values, and class/unit attributes. The connected
     `difftime` constructor now adds automatic seconds/minutes/hours/days, explicit weeks, partial
     unit names, result names, and fractional-recycling warnings. Locale-specific `%X`, named-zone
     date parsing, POSIXlt conversion, leap-second databases, and the complete difftime method and
     arithmetic family remain date-time compatibility depth.
135. Usage-ranked environment introspection: rank-184 `base::ls` now runs all five measured calls
     across callr, rstan, and bit64, with an identical `objects` alias, exact GNU R 4.6 formals,
     caller/explicit/search-list environment selection, hidden-name and pattern filtering,
     deterministic ordering, and non-forcing binding enumeration. A source-only package fixture
     exercises the same implementation inside its namespace. Active-binding substitution, exact
     hash-bucket order, locale collation, browser/GNU regexp differences, and search-path mutation
     remain environment compatibility depth.
136. Usage-ranked histogram foundation: rank-186 `graphics::hist` now runs all 19 measured calls
     across testthat, openssl, shiny, and posterior through one reusable S3/default implementation.
     Standard result objects, Sturges/Scott/FD and numeric/callable breaks, endpoint controls,
     densities, labels, additive bars, Worker/Canvas/PNG transport, recording/replay, exact formals,
     GNU R differential cases, and unchanged source-package reuse have evidence. Exhaustive
     `pretty()` equivalence, log axes, line-density shading, and device-identical output remain
     graphics/statistics compatibility depth.
137. Usage-ranked class introspection: rank-188 `methods::showClass` now runs the four measured
     Rcpp/rstan calls at the reusable class-registry boundary. GNU R-shaped formals, package/global
     ownership, direct/inherited slots, representation parents, virtual classes, known subclasses,
     captured output, invisible return behavior, and unchanged source-package reuse have evidence.
     Native external classes, full class representations, validity, unions, multiple dispatch, cache
     behavior, and exact wide-console wrapping remain object-system compatibility depth.
138. Usage-ranked installed-version metadata: rank-189 `utils::packageVersion` and adjacent rank-212
     `getRversion` now share owned numeric-version component storage, GNU R-shaped class chains,
     formatting/printing, concatenation, missing propagation, vectorized comparisons, and
     `compareVersion`. Bundle lookup is read-only and does not load a namespace; the source-only
     fixture verifies its own DESCRIPTION version unchanged. Host library discovery, arbitrary
     `lib.loc`, and the complete numeric-version S3 method family remain compatibility depth.
139. Usage-ranked session identity: rank-194 `Sys.getpid` now returns a positive scalar integer with
     GNU R-shaped zero formals and same-session stability. The facade allocates distinct identities
     to concurrent inline/Worker sessions, the protocol preserves them across reset or Worker
     replacement, and unchanged source-package code observes the same value. OS process handles,
     independent-page global uniqueness, process trees, signals, and ps-native equivalence remain
     browser-platform compatibility depth.
140. Usage-ranked library search paths: rank-195 `.libPaths` now maintains normalized, deduplicated,
     resettable browser-owned library roots and exposes GNU R-shaped getter/setter visibility and
     formals. Source-bundle discovery, explicit virtual `lib.loc`, namespace operators, package
     metadata/resources, and lifecycle-hook `libname` values consume the same state. Unchanged
     `withr 3.0.3` executes `with_libpaths()` and restores it. Host filesystem libraries, startup
     environment expansion, runtime repository installation, duplicate versions, and binary package
     trees remain package-system compatibility depth.
141. Usage-ranked package examples: rank-196 `utils::example` now maps standard source-package Rd
     topics and aliases to deterministic build-time code blocks, discovers them through active or
     explicit virtual libraries, loads the package, and returns or executes prepared code through
     the normalized AST. Default and opt-in `dontrun`/`donttest`, local/global environments, GNU
     R-shaped formals/missing-topic behavior, Worker execution, and unchanged external-package
     discovery have evidence. Interactive help, exact Rd/source/echo rendering, RNG restoration,
     abort recovery, installed lazy help databases, and unsupported example dependencies remain
     package-system depth.
142. Usage-ranked installed vignettes: rank-204 `utils::vignette` now maps source-package `inst/doc`
     source, extracted R, and rendered HTML/PDF entries to a deterministic build-time index. GNU
     R-shaped formals, package catalogs, specific topic objects, virtual library selection,
     missing-topic behavior, and default Worker execution have evidence. Rendering raw development
     vignettes, lazy help databases, print/viewer methods, and document fidelity remain
     package-system and host-adapter depth.
143. Usage-ranked callable introspection: rank-205 `base::args` now returns GNU R-shaped signature
     closures for ordinary functions, registered builtins, first-class operators, and character
     names, with `NULL` bodies and global result environments. Non-functions and non-scalar
     character values return `NULL`; unresolved scalar names fail. Source-only package calls run
     unchanged in inline and default Worker sessions. Broader S7 behavior, compiled StanHeaders
     routines, undocumented primitive signatures, and the remaining introspection surface stay
     compatibility depth.
144. Usage-ranked dynamic S3 registration: rank-208 `base::registerS3method` now stores hidden
     function or resolved string methods against the generic's definition environment, replaces
     earlier registrations, preserves visible call-site precedence, supports base and closure
     generics, and returns invisible `NULL` with GNU R-shaped formals. Package `.onLoad()` mutations
     participate in namespace-load rollback and reset; inline and default Worker packages have
     evidence. Delayed registration for unloaded suggested packages, group-generic metadata, and
     complete method discovery remain compatibility depth.
145. Usage-ranked virtual file metadata: rank-209 `base::file.info`, plus `file.mode`, `file.mtime`,
     and `file.size`, now report GNU R-shaped metadata for bounded session files/directories and
     immutable package resources. Exact byte sizes, directory flags, `octmode` permissions,
     `POSIXct` times, missing and duplicate rows, portable extra columns, formals, source-only
     package calls, and default Worker execution have evidence. Host files, native ownership/ACLs,
     links, platform executable classification, and native timestamp fidelity remain host-adapter
     depth.
146. Usage-ranked perceptual color conversion: rank-214 `grDevices::hcl` now executes all six
     measured ggplot2/zoo calls through an independent polar CIE-LUV/D65-to-sRGB conversion.
     Recycling, alpha, missing/non-finite values, gamut fixup, exact formals, invalid ranges,
     source-only package calls, and default Worker execution have differential evidence. ICC
     profiles, device-dependent color management, `hcl.colors`, and the wider color-conversion API
     remain graphics compatibility depth.
147. Usage-ranked linear axes: rank-215 `graphics::axis` now executes all 18 measured labeling, zoo,
     and bit64 calls through the owned window and segment/text journal. Explicit/default sorted
     ticks, sides 1:4, character/numeric/no labels, secondary axes, measured style controls, exact
     formals, source-only package calls, and default Worker rendering have evidence.
     Logarithmic/date axes, outer margins, plotmath, collision layout, font metrics, and
     device-pixel identity remain graphics compatibility depth.
148. Usage-ranked standard connections: rank-246 `base::stdout` and adjacent `stdin`, `stderr`,
     `isatty`, connection lookup/catalog, and close-all lifecycle now use stable unforgeable
     terminal descriptors over the existing output journal. GNU R object/introspection behavior,
     direct and pure-R package calls, default Worker routing, and false embedded-session TTY
     detection have evidence. Streaming stdin, sink diversion, terminal negotiation, pushback, and
     host file descriptors remain compatibility depth.
149. Usage-ranked classic palettes: rank-252 `grDevices::rainbow`, rank-262 `terrain.colors`, and
     adjacent `topo.colors`/`cm.colors` now share an independent browser-native HSV conversion path
     with the existing `heat.colors`. GNU R 4.6 differential evidence covers byte-exact sequences,
     hue wrapping, saturation/value and alpha recycling, reversal, formals, count/error boundaries,
     source-only package namespaces, and the default Worker Playground. HCL palette catalogs,
     mutable palette state, profiles, and device color management remain compatibility depth.
150. Usage-ranked rectangles: rank-253 `graphics::rect` projects recycled coordinate/style vectors
     into the existing polygon journal for sass and zoo's measured calls. Missing/non-finite
     omission, exact formals and visibility, source-only packages, Worker transport, Canvas/PNG, and
     record/replay have evidence; positive hatching, clipping/log axes, coordinate classes, and
     device-pixel identity remain compatibility depth.
151. Usage-ranked file removal: rank-256 `base::file.remove` runs xfun and data.table's four
     measured cleanup calls over closed session-owned files. GNU R-shaped per-path results,
     warnings, coercion, mutation ordering, package execution, Worker transport, immutable
     resources, open handles, and resource bounds have evidence. Host filesystems, wildcard
     expansion, directory removal, and native platform diagnostics remain outside this browser-owned
     contract.
152. Usage-ranked fixed-width text input: rank-259 `base::readChar` runs digest's whole-file and
     Shiny's bookmark-file examples over the existing virtual byte and connection layer. Character
     versus byte widths, vector lengths, EOF, open/closed cursors, package/session files, URL/gzip
     composition, pure-R namespaces, Worker execution, invalid input, and resource bounds have GNU R
     4.6 evidence. Host files, native locale codecs, streaming stdin, and `writeChar` remain
     compatibility depth.
153. Usage-ranked function debugging: ranks 277 and 279 `base::debug`/`undebug` run R6's measured
     future-instance and single-instance method instrumentation, with adjacent `debugonce` and
     `isdebugged`. GNU R 4.6 evidence covers marks, aliases, visibility, warnings, formals, and name
     lookup; inline/package/Worker evidence covers one-shot consumption and bounded
     next/continue/finish/Q prompts. Arbitrary browser expressions, nested stepping, `browser()`,
     global debugging state, and S4 signature tracing remain compatibility depth.
154. Usage-ranked browser PDF: rank-281 `grDevices::pdf` runs knitr's `pdf(NULL)` record-plot setup
     and data.table's file-backed plotting call over the shared owned graphics journal. GNU R 4.6
     evidence covers formals, visibility, recording lifecycle and device closure; NativR-owned
     evidence covers valid PDF headers/object graphs/xref/trailers, multi-page and numbered files,
     standard fonts, metadata, compression, raw reads, resource bounds, and Worker execution.
     Embedded fonts, arbitrary encodings, exact glyph metrics/kerning, full PDF controls, and
     byte-identical output remain compatibility depth.
155. Usage-ranked file creation: rank-287 `base::file.create` runs withr's measured tempfile plus
     deferred-`unlink()` pattern over the existing session-owned filesystem. GNU R 4.6 evidence
     covers exact formals/matching, vector flattening, coercion, truncation, result shape, missing
     paths, warning suppression, and preflight errors; package and Worker evidence crosses the same
     path. Recursive parents, host paths, native permissions/umasks, links/devices, platform-exact
     diagnostics, and persistence remain compatibility depth.
156. Usage-ranked time-series plotting: rank-292 `stats::ts.plot` runs magrittr's measured
     `data.frame(z = ...) %$% ts.plot(z)` shape over the existing regular-time-series and graphics
     foundations. A generic bounded union aligns equal-frequency vectors and matrix/data-frame
     columns, preserves gaps as disconnected paths, recycles common `gpars` styles, reports the
     current `par("usr")` window, and crosses pure-R package and default Worker paths. Multi-panel
     `plot.ts`, irregular indexes, arbitrary graphical parameters, complete axis/margin layout, and
     device-exact output remain compatibility depth.
157. Usage-ranked executable discovery: rank-293 `base::Sys.which` checks a snapshotted
     `createR({ executablePaths })` name-to-path allow-list shared by inline, Worker, Playground,
     and unchanged pure-R package calls. Missing tools return named empty strings without probing a
     host PATH or filesystem; coercion, duplicates, missing values, formals, reset, and malformed
     option inputs have executable evidence. Platform PATH/PATHEXT rules, filesystem resolution, GNU
     closure identity, and missing names attributes remain compatibility depth.
158. Usage-ranked package resource download: rank-311 `utils::download.file` composes the explicit
     `createR({ url })` byte capability with the browser-session file tree for jsonlite's measured
     call and unchanged pure-R package code. Exact formals/defaults, preflight, paired vectors,
     invisible statuses/`retvals`, named headers, replacement bytes, failure atomicity, Worker, and
     Playground paths have evidence. Ambient network, host files, redirects/cache/progress, external
     downloader processes, append/partial-file modes, and `install.packages()` remain compatibility
     depth.
159. Usage-ranked command connection: rank-313 `base::pipe` composes the default-deny
     `createR({ systemCommand })` capability with private bounded connections. GNU R formals, class,
     summary, unused close and validation plus lazy/explicit reads, buffered writes, exact statuses,
     pure-R package calls, Worker transport, Playground use, and resource limits have evidence.
     Duplex/interactive streaming, seeking, NUL-containing binary stdin, host discovery, and shell
     semantics remain compatibility depth.
160. Usage-ranked ZIP-member connection: rank-314 `base::unz` reads one exact stored or DEFLATE
     member from immutable package resources or session-owned archives through the existing private
     connection store. GNU R formals/defaults, coercion, class, summary, and close behavior plus
     closed restart, open cursors, raw/text reads, `download.file()` composition, pure-R package,
     Worker, Playground, CRC/malformed input, and bounds have evidence. Encryption, ZIP64,
     multi-disk archives, other codecs, seeking, writing, and runtime package installation remain
     compatibility depth.
161. Usage-ranked owned-object accounting: rank-324 `utils::object.size` applies an independently
     specified GNU R 4.6-shaped 64-bit layout to vectors, within-vector character sharing, recursive
     lists/pairlists, attributes, language objects, closures, and environment boundaries. The
     length-one double `object_size` result plus legacy/IEC/SI formatting and printing have exact
     differential evidence and run unchanged in the measured data.table/bit64 call surface. It is
     not JavaScript heap telemetry and does not claim native/external allocation sizes.
162. Usage-ranked reusable plot annotation: rank-328 `graphics::title` normalizes GNU R-shaped title
     arguments and active `par()` styles into the shared text display-list event. All seven measured
     Shiny/bit64 calls, unchanged source-only package code, Worker delivery, browser rendering,
     record/replay, PNG, and PDF use one implementation path. Plotmath and exact device-specific
     margins remain compatibility depth.
163. Usage-ranked persistent output diversion: rank-330 `base::sink` and `sink.number` share one
     ordered session router with `capture.output`, preserving nested output frames, split tees,
     message routing, connection lifecycle, and restoration across evaluations/errors. The two
     measured utf8 calls plus source-package and Worker paths have executable evidence.
164. Usage-ranked atomic writer: rank-338 `base::write` reproduces GNU R's character/numeric column
     defaults, repeated separator vectors, final newline, underlying atomic storage, append mode,
     and owned file/connection lifecycle. Sass's measured call runs unchanged from a source-only
     package in the default Worker.
165. Usage-ranked repository catalog: rank-340 `utils::available.packages` and adjacent
     `contrib.url` turn application-approved CRAN-like `PACKAGES` bytes into GNU R's package matrix,
     with extra fields, built-in/custom filters, duplicate selection, session caching, request
     controls, package execution, and Worker evidence. Runtime code retains no ambient network or
     host cache authority.
166. Usage-ranked bar plots: rank-343 `graphics::barplot` and `barplot.default` reproduce the three
     measured zoo/bit64 vector-and-matrix calls through S3 dispatch, stacked/beside midpoint
     geometry, widths/spaces/offsets, names, axes, annotations, legends, and the existing bounded
     Worker polygon journal. Source-only packages can import or extend the generic without
     TypeScript rewrites; unsupported log axes, positive hatch density, and device-exact layout
     remain explicit.
167. Usage-ranked page prompting: rank-344 `grDevices::devAskNewPage` covers RColorBrewer's ten
     measured calls with GNU R query/update visibility, logical coercion, per-device state,
     `device.ask.default`, unchanged source-package imports, and default Worker prompting through
     the existing explicit `readline` bridge. First pages, non-interactive sessions, and PNG/PDF
     devices remain nonblocking.
168. Usage-ranked loaded-module introspection: rank-345 `base::getLoadedDLLs` covers ps's measured
     `vapply(..., "path")` probe with GNU R-shaped formals, visibility, `DLLInfoList` class, empty
     subsetting, source-package execution, and Worker evidence. It is truthfully empty by default
     and reports only explicit virtual `nativeModules`; it exposes no synthetic DLL, host path, or
     pointer handle.
169. Usage-ranked socket connections: rank-346 `base::socketConnection` plus adjacent `isIncomplete`
     and `socketTimeout` provide GNU R-shaped connection metadata, text writes, and line/raw reads
     through an explicit `createR({ socket })` lifecycle adapter. Default sessions have no network
     authority; inline, Worker, reset/dispose, conformance, and unchanged source-package paths have
     evidence.
170. Usage-ranked file copying: rank-348 `base::file.copy` covers xfun's measured resource staging,
     GNU R formals/laziness/vectorization/overwrite/recursive behavior, exact package-resource
     bytes, immutable-source to mutable-session transfer, pure-R package calls, default Worker
     execution, conformance, and evaluator resource limits.
171. Usage-ranked package-root discovery: rank-349 `base::find.package` queries the same owned
     library/package registry used by namespace loading, with GNU R formals, default attached order,
     vector/missing/quiet/library behavior, immutable core and pure-R package roots, unchanged
     package self-enumeration, inline/Worker execution, and differential conformance.
172. Usage-ranked localization capability reporting: rank-351 `base::l10n_info` exposes GNU R's
     portable logical list fields and a non-Windows `codeset = "UTF-8"` browser profile, with null
     formals, visibility/attribute invariants, unchanged xfun-shaped package use, inline/Worker
     execution, and differential conformance.
173. Usage-ranked shell-string quoting: rank-353 `base::shQuote` covers xfun's measured call with
     ordinary closure formals, browser-default Unix `sh`, explicit `csh`/`cmd`/`cmd2`, partial mode
     matching, coercion and S3 dispatch, missing values, unchanged pure-R package use, inline/Worker
     execution, and differential conformance without granting process authority.
174. Usage-ranked structured command execution: rank-357 `base::system2` carries xfun's measured
     call through the explicit default-deny host policy, preserving executable/argument/environment
     and stream-redirection structure, GNU R formals/coercion/capture/status/visibility, resource
     limits, unchanged pure-R package execution, and inline/Worker transport.
175. Usage-ranked typed native calls: rank-358 `base::.Call` resolves explicit module/routine
     manifests with package confinement, lookup policy and argument counts, then crosses a bounded
     `RValueSnapshot` request/result seam inline or through the default Worker. The default remains
     native-capability-free. Automatic native-package builds, SEXP/external-pointer fidelity,
     `.External`, and arbitrary compiled-package loading remain future depth.
176. Usage-ranked spell checking: rank-363 `utils::aspell` composes virtual package/session text,
     ordinary R filter closures, and the existing default-deny structured-command bridge into a
     bounded Ispell `-a` request. It returns GNU R-shaped `aspell` data frames inline and through
     the Worker without a bundled checker, dictionary, host PATH scan, or package-specific rewrite.
     Built-in document filters and R-level serialized dictionaries remain future depth.
177. Usage-ranked browser reference lines: rank-364 `graphics::abline` composes active linear plot
     limits, generic model coefficients, and the existing segment display list. Unchanged pure-R
     package code runs inline and in the default Worker/Canvas path without a new renderer or
     protocol event. Log-axis transformation, extended `xpd` clipping, and exact device stroke
     metrics remain future depth.
178. Usage-ranked installed vignette browsing: rank-365 `utils::browseVignettes` aggregates the
     generic package-tool manifest into GNU R-shaped package matrices and uses
     `print.browseVignettes` to emit one bounded self-contained catalog through the existing inert
     browse journal. Unchanged pure-R package code runs inline and in the Worker/Playground sandbox
     without a help server, runtime network, desktop viewer, or package-specific rewrite.
179. Usage-ranked display-list control: rank-366 `grDevices::dev.control` gives every owned graphics
     device separate output and replay-recording journals. Exact GNU R 4.6 formals, partial
     `enable`/`inhibit`, reset-on-toggle behavior, screen/file defaults, invisible returns, argument
     boundaries, unchanged pure-R imports, record/replay, PDF bytes, and browser events have
     executable evidence without adding a device adapter or protocol message.
180. Usage-ranked private namespace lookup: rank-368 `utils::getFromNamespace` resolves exact public
     or private bindings from core and admitted pure-R package namespaces, including package
     loading, actual namespace environments, attached-package `pos`/`envir`, lazy unused controls,
     strict non-inheritance, GNU R formals/errors, unchanged source-only private-function execution,
     inline/Worker compatibility, and differential evidence without a backports-specific adapter.
181. Usage-ranked package documentation: rank-370 `utils::help` consumes the generic build-time help
     manifest emitted for every source-package `man/*.Rd` page, discovers core callables and
     source-package aliases, returns GNU R-shaped topic/package-index values, and presents text or
     bounded script-free HTML through the existing Worker browse journal. Exact GNU Rd conversion,
     `?`/`??` syntax/search, lazy installed help databases, and byte-identical output remain future
     compatibility depth.
182. Usage-ranked function curves: rank-380 `graphics::curve` evaluates named functions or lazy
     caller/package expressions over bounded linear/logarithmic samples, returns GNU R-shaped
     invisible coordinates, and composes the existing `plot`/`lines` journal for new or additive
     drawing. The same increment adds positive-coordinate log transforms to `plot.default` and has
     unchanged pure-R package plus Worker/Canvas evidence. `lines` and additive curves inherit
     active log axes; complete log ticks/labels, other additive primitives, clipping, replayed
     log-axis metadata, and pixel identity remain future graphics depth.
183. Pure-R package compatibility depth: non-core installed bundles now replace same-name static
     shims, namespace-qualified S3 declarations resolve correctly, environment and closure
     attributes follow reference/copy-on-modify behavior, environment and binding locks constrain
     mutation, and `.subset`/`.subset2` expose non-dispatching extraction. Unchanged R6 2.6.1 now
     installs, loads, constructs a generator and object, calls a public method, and mutates a field.
     Generic active-binding read/write/inspection plus unchanged private-state and active-field R6
     paths add the next depth layer. Generic `mget`, first-class `[[`, and exact unsimplified
     `mapply`/`Map` result names now carry the same unchanged package through shallow and recursive
     deep clone paths. GNU R-compatible `NULL` extraction/replacement promotion now carries a
     three-level unchanged hierarchy through recursive `super$initialize()`/`super$greet()` calls,
     inherited fields/methods, and class-chain checks. Finalization, arbitrary/multiple inheritance
     breadth, portable-locking variants, broad R6 behavior, and arbitrary packages remain explicit
     future work. The fifth digest-pinned proof, unchanged viridisLite 0.4.3, now composes generic
     arithmetic attribute propagation with standalone RGB/Lab linear/FMM-spline `colorRamp` to
     produce exact observed palettes. The sixth proof, unchanged RColorBrewer 1.1-3, composes
     generic trailing `data.frame()` controls and explicit row-name construction with existing
     subsetting, warning, recursion, `switch`, and `rgb` semantics; broader measured pure-R package
     execution remains future work. The second source-blind holdout rotation moves unchanged
     `praise 1.0.0` and `prettyunits 1.2.0` to P4 regression evidence through generic PCRE capture
     metadata, quoted call tags, string coercion, D65 `convertColor`, and build-time bzip2 package-
     resource normalization. The third source-blind rotation moves unchanged `evaluate 1.0.5` and
     `numDeriv 2016.8-1.1` to P4 through generic callable lookup, exact builtin formals, condition
     constructors, post-dots argument matching, and list/expression-column replacement. The fourth
     source-blind rotation moves unchanged `abind 1.4-8` and `rprojroot 2.1.1` to P4 through generic
     operator S3 dispatch, incremental method registration, numbered dots, missing-endpoint
     sequences, dimension-name replacement, quoting, data-frame coercion, and recursive missingness.
     The fifth source-blind rotation moves unchanged `rstudioapi 0.19.0` and `inline 0.3.21` to P4
     through generic S4 method-export metadata, correct `utils` ownership for `head`/`tail`, and
     environment-scoped `utils::globalVariables` behavior. The sixth source-blind rotation moves
     unchanged `rematch 2.0.0` and `whisker 0.4.1` to P4 through generic dimension/name replacement,
     regex/replacement/splitting, apply-family matching, factor-label comparison, and atomic-to-list
     replacement semantics. The seventh rotation moves unchanged `zeallot 0.2.0` and `ini 0.3.1` to
     P4 through generic string-affix/capture-location semantics, language equality, constructed
     assignment, promise-origin caller frames, embedded runtime constants, and recursive character
     coercion. The eighth rotation moves unchanged `cpp11 0.5.5` and `otel 0.2.0` to P4 through
     separately bounded package resources, list-aware formatting, string repetition, length
     replacement, missingness inspection, and stable unique-name repair. The ninth rotation moves
     unchanged `BH 1.90.0-1` to P3 through bounded large-resource admission, prompt archive-limit
     failure, standard `exportPattern`, exact header-resource discovery, namespace loading, and
     attachment. P4 is not applicable because BH exports no R functions. This exhausts the committed
     top-100 snapshot's candidates whose runtime closure is already available and declares no native
     compilation; dependency-closure expansion is next. RStudio host operations and inline's native
     compilation surface remain explicit platform/Wasm-ABI work. The language-object blocker found
     in deeper `abind::acorn()`/`abind::asub()` breadth is closed by the later twelfth depth
     increment through foundational work rather than a package-specific patch.

     The tenth package-depth increment advances unchanged labeling 0.4.3 to P5 through
     `extended.figures(2)`, using reusable `axis` shared-control handling, `barplot` axis
     suppression, the complete 72-name `par()` inventory, and GNU R-shaped read-only restoration
     warnings under an explicit bounded graphics-output budget. Full graphical-parameter effects, P6
     package tests, P7 package-check behavior, and universal pure-R compatibility remain future
     work.

     The next evidence-only depth increment advances unchanged R6 2.6.1 to P5 by running both
     official `R6Class` Rd example blocks through the generic `utils::example()` path and matching
     GNU R's returned visibility record and stdout sequence. This adds no package-specific runtime
     code; P6/P7 and broader R6 behavior remain open.

     The eleventh depth increment establishes the first applicable P6 corpus result. The generic
     packager optionally retains source-package tests and emits a versioned manifest; unchanged
     numDeriv then runs four Rd topics and seven original test scripts through the same virtual
     filesystem, parser, AST, and runtime as application code. The exposed reusable gaps close
     `NULL` subscript semantics, matrix/data-frame `diag<-`, browser-safe `Sys.info()`, exact
     complex integer powers, and inverse trigonometric vectors. The heavy CSD script runs only with
     explicit finite test limits. P7 package-check orchestration and broad multi-package P6 evidence
     remain next-stage work.

     The twelfth depth increment advances unchanged abind 1.4-8 from P4 to P6. All five Rd topics
     and five original test scripts run through the generic retained-resource pipeline. Reusable
     closure covers language/expression entry operations, replacement-call introspection, pairlist
     apply-family inputs, Base constants and `prod`, matrix/data-frame coercion, array/default
     metadata, nested `NULL` replacement, and short-name padding. The largest array case uses
     explicit finite limits, and intentional errors continue only through a configured top-level
     error handler. P7, automatic `.Rout.save` comparison, complete `R CMD check`, and broad P6
     corpus coverage remain next-stage work.

     The thirteenth depth increment advances unchanged generics 0.1.4 to P5 through all three Rd
     topics. The same depth pass follows withr's unchanged `defer` example through closure-headed
     call construction, target-environment `do.call(on.exit, ...)`, scoped `local` cleanup, and
     `sys.calls`/`sys.frames`. This increment recorded `reg.finalizer` as the exact next P5 blocker;
     language subset 0.293 closes it with reachability and session-exit evidence.

     The fourteenth depth increment executes environment finalizers in reverse registration order
     after their target becomes unreachable, and executes `onexit = TRUE` finalizers on runtime
     reset/dispose. Unchanged withr now completes `defer` plus all otherwise applicable example
     topics except the explicitly mapped `datasets::mtcars`, `datasets::iris`, and pre-R-1.7 RNG
     boundaries. Its first P5 blocker is `datasets::mtcars` in `with_par`; DBI and native makevars
     topics remain inapplicable to the present pure-R/browser tier. Remaining `sys.*` stack APIs,
     core data admission, historical RNGs, P6 tests, and P7 behavior remain in progress.

     The fifteenth depth increment admits independently sourced `mtcars` and corrected `iris`
     resources through a reusable static core-package definition. Both default search bindings and
     `datasets::` exports are backed by the same isolated namespace objects, persist across reset,
     and execute through ordinary `data/*.R`/CSV loading. Withr's unchanged `with_par` and
     `with_tempfile` examples now complete. Its first P5 blocker is the historical pre-R-1.7 RNG
     engine requested by `with_rng_version`; P6 tests and P7 behavior remain in progress.

     The sixteenth depth increment implements the documented Wichmann-Hill and Marsaglia-Multicarry
     uniform recurrences and versioned seed initialization. Fixed-seed GNU R differentials cover
     both engines, while the R 1.6 Marsaglia/Rounding sample path closes unchanged withr
     `with_rng_version`. All applicable withr Rd topics now pass and the package reaches P5. Buggy
     Kinderman-Ramage normal draws, P6 tests, and P7 behavior remain in progress.

     The seventeenth depth increment independently reconstructs the historical Buggy
     Kinderman-Ramage normal generator from its published algorithm and black-box sequence evidence.
     The exact pre-1.7 Marsaglia normal stream and all five rejection regions now pass; corrected
     Kinderman-Ramage and other alternative normal engines remain boundaries. Withr stays at P5 and
     moves to P6 test execution as its next package-depth gate. Its retained top-level `testthat.R`
     driver fails first at the unavailable testthat package; because that dependency declares native
     compilation, it is routed to the future reusable native-package ABI instead of a withr-specific
     test rewrite.

     The eighteenth semantic increment exposes corrected Kinderman-Ramage through the shared owned
     normal transform. Separate fixed-seed and near-zero correction cases prove the published
     coefficient, restored density acceptance, and negative-candidate rejection. Ahrens-Dieter,
     Box-Muller, and user-supplied normal engines remain explicit boundaries.

     The nineteenth package-depth increment runs the installed example manifests of the two
     highest-ranked remaining graphics packages. Unchanged RColorBrewer 1.1-3 crosses its reusable
     `plot.default(bty=)` and named-color spacing blockers and reaches P5 through its sole Rd topic.
     Unchanged viridisLite 0.4.3 remains P4 because its example deterministically requires the
     separately unavailable `ggplot2` package; dependency admission, not a package-specific rewrite,
     is the next gate.

     The twentieth package-depth increment audits higher-ranked cpp11 0.5.5's three installed Rd
     topics. A reusable browser-owned `read.dcf()` path closes the first metadata gap and the
     unchanged `cpp_vendor` topic passes. `cpp_register` and `cpp_source` then stop at explicit
     missing R-package dependency closures, so cpp11 remains P4 pending generic dependency admission
     and, later, the reusable native Wasm ABI.

     The twenty-first package-depth increment executes all 45 frozen installed otel 0.2.0 Rd topics
     unchanged. Shared primitive finiteness, owned closure-stack depth, top-level environment
     discovery, and a locked reset-safe `.GlobalEnv` binding close the observed gaps, advancing otel
     from P4 to P5 without granting network/exporter access or adding a package-specific runtime
     path.

     The twenty-second package-depth increment advances unchanged pkgconfig 2.0.3 and crayon 1.5.3
     to P5. Pkgconfig has a frozen four-topic help catalog with no applicable Examples; every one of
     crayon's 19 frozen installed Rd topics runs unchanged after shared `nchar`, bind-label,
     name-propagation, comparison-attribute, and callable-attribute semantics close the observed
     blockers.

     The twenty-third package-depth increment advances unchanged assertthat 0.2.1 and praise 1.0.0
     to P5. All 11 assertthat example topics and praise's sole topic run unchanged after reusable
     primitive reflection, explicit call matching, partial equality controls, custom-condition
     propagation, and browser-owned access checks close the observed blockers.

     The twenty-fourth package-depth increment advances unchanged prettyunits 1.2.0 to P5. All eight
     frozen installed Rd topics run unchanged after reusable difftime-unit getter/replacement
     dispatch, value-preserving unit rescaling, primitive infinity classification, and browser-owned
     C-style formatting close the observed blockers.

     The twenty-fifth package-depth increment advances unchanged evaluate 1.0.5 to P5. All six
     frozen installed Rd topics run unchanged after shared calling-handler/restart, interrupt,
     source-reference, hook, recursive-unlist, expression/data-frame, sequence, and recorded-plot
     semantics close the observed blockers. The process-shaped example uses only the explicit
     generic host adapter; default browser sessions remain process-free.

     The twenty-sixth package-depth increment advances unchanged rprojroot, rstudioapi, rematch,
     whisker, zeallot, and ini to P5. Their complete runnable installed-example manifests execute
     unchanged after provenance-audited `InsectSprays` and `faithful` resources close the two data
     blockers through the generic core-package path. RStudio behavior remains deterministically
     browser-unavailable without an explicit host integration.

     The recursive function-introspection increment corrects symbol/atomic/NULL closure bodies and
     empty formal lists at the normalized-AST boundary. Oracle v2 now covers captured closure state,
     environment parents/bindings/cycles, shared identity, language structure, and nested attributes
     through seven exact graph cases associated with 19 validated behavioral registry bindings.

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
4. Expand the executable package installer from the pinned
   `pkgconfig`/`generics`/`withr`/`R6`/`viridisLite`/`RColorBrewer`/`assertthat`/`crayon`/`praise`/
   `prettyunits`/`evaluate` proofs to the measured pure-R package corpus, binary/text data adapters,
   broader namespace/object-system declarations, package test orchestration, and R CMD check
   scenarios without embedding GNU R or webR. In parallel, turn the typed `.Call` seam into a
   reusable audited Wasm package toolchain, including routine-registration extraction and the
   portable value/API subset needed by measured compiled packages.
5. Verify platform, browser, locale, time-zone, graphics, numeric, and performance behavior against
   the completion criteria in the GNU R compatibility ledger.
6. Continue refreshing package-usage snapshots so high-reach gaps determine implementation order
   within the full compatibility objective.

GNU R/webR embedding, JavaScript code generation, and unreviewed external source remain prohibited
by the clean-room and security policies.

Profile 0.307 adds closure-shaped `body<-`/`formals<-`, primitive `environment<-`, normalized body
values, explicit enclosure replacement, and ordinary `.Environment` attributes. Its eighth recursive
graph case verifies replacement closures and attributed values share the same owned enclosure. This
closes a reusable reflection prerequisite; it does not complete reflection or arbitrary pure-R
package compatibility.

Profile 0.308 adds S3 `as.function()` and reusable list-to-closure construction through the same
formal, body, and enclosure paths as profile 0.307. This closes another dynamic pure-R
metaprogramming prerequisite but does not imply arbitrary generated-code or package compatibility.

Profile 0.309 uses an untouched public package as a semantic-discovery gate. `docopt 0.7.2` first
failed at `methods::setRefClass`; the resulting generic Reference Class, S4 dispatch, replacement,
regular-expression, short-circuit, substring, membership, and equality work now carries the
unchanged package through P5. `getopt 1.21.1` replaces it as the frozen source-blind holdout. The
next iteration must begin with that package's first observed blocker and may inspect its source only
after the initial runtime evaluation, preserving independent evidence against corpus overfitting.

Profile 0.310 evaluates that frozen `getopt 1.21.1` archive before source inspection. Its first
failure identifies generic `match(..., nomatch=)` coercion, followed by reusable `Negate()`,
`storage.mode<-`, and browser `commandArgs()` seams. The unchanged package now completes its
representative GNU R-matched path and all four applicable installed Rd examples at P5.
`optparse 1.8.2` becomes the next untouched holdout; its first observed blocker, not its package
identity, drives the next package-generalization iteration.

Profile 0.311 evaluates that frozen `optparse 1.8.2` archive before source inspection. Its first
failure identifies generic `exportClasses()` package metadata, followed by reusable S4 slot,
validity, namespace-local replacement-generic, and filled-output seams. The unchanged package now
completes a GNU R-matched representative parser path and its exact four-topic applicable installed
example manifest at P5. Since the committed top-100 snapshot has exhausted eligible standalone
pure-R candidates, independently authored `argparser 0.7.3` becomes the next untouched holdout and
same-domain generalization probe.

Profile 0.312 evaluates that frozen `argparser 0.7.3` archive through installation, loading, and
attachment before source inspection; all three phases succeed. The first representative execution
failure identifies generic scalar list/pairlist `as.logical()` coercion, and the exact installed
examples identify target-signature S4 `coerce` dispatch. The unchanged package now completes its GNU
R-matched representative path and exact three-topic applicable example manifest at P5.
Frequency-ranked `iterators 1.0.14` becomes the next untouched holdout; its first observed blocker,
not its identity, drives the next semantic-closure iteration.

Profile 0.313 evaluates that frozen `iterators 1.0.14` archive before source inspection. Its first
failure identifies caller-environment discovery of namespace-local legacy S3 methods; exact examples
subsequently identify immutable `R.home()` text resources and `levels()`/`nlevels()`. The unchanged
package completes its GNU R-matched representative path and all nine applicable example topics at
P5. `foreach 1.5.2` becomes the next untouched holdout, together with the frozen pure-R
`codetools 0.2-20` dependency needed to test generic transitive installation.

Profile 0.314 carries that frozen three-package closure through P5. The reusable work is a
browser-admissible `compiler::compile` semantic identity, lossless named call entries after language
subsetting, and numeric/complex `%*%`. The unchanged `foreach` package now passes representative
sequential and nested execution plus all four applicable installed examples. `doParallel 1.0.17`
becomes the next untouched holdout. Its dependency on core `parallel` deliberately moves the next
iteration toward a reusable browser parallelism contract rather than another isolated callable.

Profile 0.315 closes that first browser parallelism slice: core-package provisioning, DESCRIPTION
`Depends` attachment, single-lane `mclapply`, deterministic splitting, and a sequential PSOCK object
adapter. This is semantic package compatibility, not a claim of actual concurrent execution.
Unchanged `doParallel 1.0.17` reaches P5. Usage-ranked `pbapply 1.7-4` becomes the next untouched
generalization holdout before broader parallel/future APIs or any native-package ABI work.

Profile 0.316 carries `pbapply` to P4 through reusable package-install, Base, stats, utils, and
parallel semantics. The next direct semantic closure target is formula reconstruction from fitted
model call components; `pbapply` cannot advance to P5 before that evidence passes. In parallel with
that regression path, untouched `globals 0.19.1` is the next source-blind pure-R dependency probe.
Native-package ABI work remains deferred.

Profile 0.317 carries `globals 0.19.1` to P4 through runtime-owned version metadata, environment and
language reflection, and nested list-cell replacement. Its next direct closure target is generic
list-valued subscript normalization in the conservative codetools path. Untouched `listenv 1.0.0` is
the next source-blind pure-R probe; native-package ABI work remains deferred until the pure-R
foundation is materially broader.

Profile 0.319 carries `R.methodsS3 1.8.2` to P5 through reusable package-construction, namespace,
replacement, substitution, system-frame, and Utils lookup semantics. The next source-blind probe is
pure-R `R.oo 1.27.1`, which exercises the dependency closure just established and a larger S3
object-system surface. Native-package ABI work remains deferred until the pure-R foundation is
materially broader.

Profile 0.318 carries `listenv 1.0.0` to P5 through reusable primitive S3 dispatch for classed
environments and the Base message/membership seams exposed by its examples. The next source-blind
probe is `R.methodsS3 1.8.2`, selected to stress generic S3 construction and namespace behavior
across a broad reverse-dependency surface. Native-package ABI work remains deferred.

Profile 0.320 carries `R.oo 1.27.1` to P5 across all 90 installed example topics through reusable
namespace, S3, caller-frame, coercion, metadata, attribute, delayed-binding, and serialization
semantics. The next untouched dependency-closure probe is pure-R `R.utils 2.13.0`. Phase 1 remains
semantic closure and Phase 2 remains generic arbitrary pure-R package support; native/Wasm ABI work
stays deferred until those gates are materially broader.

Profile 0.321 carries frozen `R.utils 2.13.0` and its unchanged pure-R dependency closure to P5
through package-agnostic parser, connection, binary I/O, environment, source-reference, condition,
time-limit, digest, array-dimension, and graphics-layout semantics. Browser-inapplicable example
paths are asserted at explicit capability boundaries rather than omitted. The next untouched
source-blind probe is `here 1.0.2`; its first observed blocker will determine the next reusable
semantic increment. Native/Wasm ABI work remains deferred until Base semantics and arbitrary pure-R
package loading are materially broader.

Profile 0.322 moves previously untouched `here 1.0.2` directly to P5: the package reuses the current
pure-R installer and runtime without exposing a blocker or requiring implementation work. The
replacement P0 holdout is `R.matlab 3.7.0`, whose official metadata, pure-R dependency closure,
usage window, archive size, and digest were frozen before any source evaluation. Its first observed
blocker will determine the next reusable semantic increment. `R.cache` was rejected because its
mandatory native `digest` dependency belongs to the later native/Wasm phase. Base semantic closure
and generic arbitrary pure-R package loading remain ahead of native/Wasm ABI expansion.

Profile 0.323 carries unchanged `R.matlab 3.7.0` and its already-P5 dependency closure to P5 through
generic inert-asset packaging, namespace re-export and load-hook lifecycle semantics, version-object
shape, and S3 structural-inspection dispatch. Its exact installed examples and a MAT v5 round trip
are executable regression evidence; external MATLAB and JVM execution remain outside the claim. The
next pure-R holdout is dependency-free `combinat 0.0-8`, selected from metadata and frozen by its
official source digest before archive inspection or execution. Its first source-blind blocker will
choose the next reusable semantic increment. Native/Wasm ABI expansion remains deferred behind
materially broader Base and arbitrary pure-R package compatibility.

Profile 0.324 advances unchanged `combinat 0.0-8` from its metadata-only freeze to P5. Its ordered
source-blind blockers produced reusable Base `lgamma()`, `tabulate()`, and `gamma()` semantics plus
generic Rd percent-comment parsing. The exact six applicable examples are now regression evidence.
The next rotation must again be frozen from metadata before source inspection; native/Wasm ABI work
remains behind broader Base semantic closure and generic pure-R package compatibility.

The next source-blind rotation is frozen dependency-free `matrixcalc 1.0-6`. Its usage count,
official metadata, byte length, and source digest were recorded before archive inspection or
execution; its first observed blocker will choose the next reusable increment.

Profile 0.325 advances unchanged `matrixcalc 1.0-6` from the frozen P0 probe to P5 through generic
POSIX regex normalization and reusable real-matrix semantics. Its exact 60-topic installed-example
manifest is now regression evidence. The next action is to select and freeze another pure-R
candidate from metadata and usage evidence before source inspection, then let its first blocker
choose the next Base/runtime increment. Complex and full LAPACK semantics remain after broader
pure-R closure; native/Wasm ABI work remains deferred behind that foundation.

The next source-blind rotation is frozen as `Formula 1.2-6`. Its core-only dependency metadata,
331,936-download comparison count, 47,339-byte archive, and source digest were recorded before
archive inspection or execution. Its first observed blocker will choose the next reusable formula,
modeling, language, or package-system increment; no success is presumed from P0 metadata.

Profile 0.326 completes that rotation at P5: unchanged Formula installs, loads, attaches, and runs
both exact installed example topics after generic formula-language, S3, apply-family, terms,
model-frame/matrix, dot, response, equality, and offset increments. The next action remains the same
evidence-first loop: freeze a new browser-admissible pure-R candidate from metadata and usage before
source inspection, then let its first blocker choose the next reusable semantic increment. Formula
P5 is not a reason to begin native/Wasm ABI work early; broad pure-R P6/P7 and semantic closure
still precede that phase.

## Profile 0.327 next package-compatibility gate

The independently frozen `DBI 1.3.0` rotation now reaches regression P5 through unchanged source,
representative public calls, and all runnable blocks in its exact 58-topic installed example
manifest. The next action is to freeze another usage-ranked browser-admissible holdout or advance an
existing explicit P6/P7 blocker, whichever closes more reusable semantics. Concrete DBMS backends
and native ABI work do not inherit compatibility from DBI's pure-R interface result.

The next rotation is frozen at P0 as `xtable 1.8-8`, the next-highest candidate at 606,555 downloads
in the same window. Its core-only dependency closure, official metadata, source URL, 618,708-byte
archive, and SHA-256 are recorded without source inspection. The next action is source-blind
install/load/attach followed by its first concrete reusable blocker.

## Profile 0.330 next package-compatibility gate

Unchanged `xtable 1.8-8` now reaches regression P5 through all runnable blocks in its exact
eight-topic installed manifest. The source-blind sequence selected reusable model, GLM, PCA,
data-frame, flat-table, and argument-matching semantics; it did not create a package-identity path.
The next action is to freeze a new browser-admissible pure-R holdout independently from metadata and
usage evidence, or to advance the highest-leverage recorded P6/P7 blocker. Complete Base semantics,
generic arbitrary-package closure, and executable P6/P7 evidence remain ahead of native/Wasm ABI
expansion.

## Profile 0.331 next compatibility gate

Core namespace ownership, hidden core S3 registration, top-level `substitute()`, first-class
language primitives, and primitive `NextMethod()` fallback advance unchanged globals/codetools to
P5. The next gate is either an independently frozen browser-admissible pure-R holdout or the current
highest-leverage explicit blocker: pbapply's reusable LM call/formula reflection. Completion still
requires broad Base semantics, arbitrary conforming pure-R package closure, P6/P7 evidence, and only
then the audited native/Wasm ABI.

## Profile 0.332 next compatibility gate

Unchanged `pbapply 1.7-4` now completes all four installed example topics and reaches regression P5
through reusable language, vector, reflection, data, apply-family, and summary semantics. The next
gate is not another package-specific patch: freeze a new browser-admissible pure-R holdout from
usage and metadata before source inspection, or select the highest-leverage existing P6/P7 blocker.
Complete Base semantics and broad generic package-check evidence remain prerequisites for starting
the native/Wasm ABI phase.

## Post-0.332 P7 gate

The generic package-check runner advances numDeriv to the corpus's first P7 result and converts
abind's previously unmeasured P7 surface into an explicit saved-output blocker. The next
highest-leverage recorded task is the underlying GNU-compatible names/dimnames and printing contract
exposed by `abind.Rout.save`; it should be compared with a newly frozen pure-R holdout before
implementation. Native/Wasm ABI expansion remains behind broad pure-R P7 closure.

## Profile 0.333 next compatibility gate

The generic runner now carries unchanged abind through every retained saved-output comparison and to
P7. Its former printing/dimnames blocker is closed through reusable normalized-AST, visibility,
presentation, condition-call, and batch-check semantics. Freeze the next browser-admissible pure-R
rotation from usage and metadata before source inspection, or select another existing explicit
blocker. Two P7 releases are mechanism evidence, not arbitrary-package closure; native/Wasm ABI work
remains behind broad pure-R compatibility and Base semantic completion.

## Post-0.333 frozen source-blind rotation

`selectr 0.6-0` is now the sole P0 holdout. It was selected from a refreshed 3,384-package official
metadata filter and the fixed 2026-06-30 through 2026-07-29 usage window after excluding
host-clipboard `clipr` and remote installer `remotes` on their declared host contracts. Its only
non-core mandatory dependency is already-passing `R6`; its unopened 85,422-byte source archive and
SHA-256 are frozen in the corpus. The next action is the scheduled source-blind generic
install/load/attach attempt, whose first reusable blocker—not the package identity—selects the next
runtime or Base increment.

## Profile 0.334 next compatibility gate

The source-blind selectr rotation now reaches regression P5 through generic `regexec()` capture
extraction and declared-Suggests check policy. Both exact installed example topics pass unchanged;
the retained package test remains blocked by its `testthat` suggested dependency closure. The next
gate is either that reusable dependency closure or a newly metadata-frozen browser-admissible
holdout, selected before source inspection. Two examples and a P5 package do not establish arbitrary
pure-R compatibility, and native/Wasm ABI work remains deferred.

## Post-0.334 frozen source-blind rotation

`timeDate 4052.112` is now the sole P0 holdout, selected next from the fixed usage and official
metadata comparison. Its mandatory dependency closure is browser core, its unopened source archive
and SHA-256 are frozen, and no package contents have been listed or executed. The next action is the
scheduled generic install/load/attach attempt; the first concrete reusable date/time, object-system,
package-system, or other semantic blocker will choose the implementation increment.

## Profile 0.335 compatibility gate

The scheduled rotation advances unchanged `timeDate 4052.112` to regression P4. Namespace load,
attachment, a representative calendar conversion, and the retained package test script pass after
generic S4 serialization/redispatch and date-time foundation work. The P5 gate remains complete
installed examples plus correct S4 export documentation accounting; P6 and P7 remain downstream and
cannot be inferred from the passing test step. Continue closing reusable semantic domains from the
ordered failure ledger before freezing the next holdout.

## Profile 0.338 compatibility gate

The unchanged timeDate regression now passes ordered examples through `nDay` after generic argument,
dispatch, and POSIXlt work. The immediate gate is the reusable sequence direction/step boundary in
`example:periods`; the package remains P4 until every applicable installed example passes. Pure-R
package-system and semantic closure remain ahead of native/Wasm package ABI expansion.

## Profile 0.339 compatibility gate

The unchanged timeDate regression passes the former `periods` frontier. Generic length dispatch,
POSIXlt component recycling, `.leap.seconds`, logical-missing POSIXlt conversion, and ellipsis
introspection are covered by 1084/1084 flat cases and 36/36 recursive advisor graphs. The immediate
gate is now reusable `base::asplit` array-margin slicing in `example:timeDate-class`; the package
remains P4 until all applicable installed examples pass. Native/Wasm package ABI expansion remains
downstream of Base R and generic pure-R package closure.

## Profile 0.340 compatibility gate

Reusable array splitting, zero-length apply typing, graphics S4 seams, plot axis controls, and
language-name enumeration are covered by 1088/1088 flat cases and 39/39 recursive advisor graphs.
The unchanged timeDate regression passes the former `timeDate-class`, `plot-methods`, and `holiday`
frontiers. The immediate gate is now the browser-admissible non-S4 `@` behavior exposed by
`example:in_int`; timeDate remains P4 until every applicable installed example passes. Native/Wasm
package ABI expansion remains downstream of Base R and generic pure-R closure.

## Profile 0.341 compatibility gate

Reusable S4 initialization and inherited next-method dispatch, S4 names replacement, valid `seq.int`
by/length controls, and subscript-based `is.na<-` are covered by 1090/1090 flat cases and 42/42
recursive advisor graphs. The unchanged timeDate regression crosses four former blockers. The
immediate package gate is now POSIXlt validation/replacement behavior in `example:timeCeiling`;
timeDate remains P4 until all applicable examples pass. Native/Wasm package ABI expansion remains
downstream of semantic and generic pure-R package closure.

## Profile 0.342 compatibility gate

POSIXlt extraction/balancing and C-locale month-name parsing are covered by 1092/1092 flat cases and
43/43 recursive advisor graphs. The unchanged timeDate regression advances to P7 with every
applicable planned check passing. The next package gate is no longer a timeDate-specific blocker:
freeze and execute the next admissible source-blind holdout, then let its first generic failure
select the following semantic increment. Native/Wasm ABI work remains downstream of broad pure-R
closure.

## Profile 0.343 compatibility gate

Memoized per-data-set LazyData realization, bounded build-time xz normalization, transport-byte
accounting, and dense factor contrasts are covered by 1093/1093 flat cases, 44/44 recursive advisor
graphs, and unchanged `carData 3.0-6` P7 package evidence. The next gate must again be selected from
a metadata-first source-blind candidate or a cross-corpus semantic closure gap. Data aliases,
nonmatching/multi-object archives, `.rdx`/`.rdb`, ordered/sparse contrasts, arbitrary pure-R
packages, and comprehensive GNU R remain incomplete. Native/Wasm ABI expansion stays downstream of
broader pure-R closure.

## Profile 0.344 compatibility gate

Literal character call-head preservation is covered by 1094/1094 flat cases and 45/45 recursive
advisor graphs. Unchanged `rex 1.2.2` reaches regression P5 after all five installed example topics
and an independent GNU R-matched capture/match probe pass. Its retained test first stops at the
unavailable suggested `testthat` package; P6/P7 therefore remain open.

The next gate is either reusable cross-corpus dependency/test closure or another metadata-first,
source-blind browser-admissible candidate. Passing rex does not imply complete regular-expression,
Base R, arbitrary pure-R package, or GNU R compatibility. Native/Wasm ABI expansion remains
downstream of broader pure-R semantic and package-system closure.

## Profile 0.345 compatibility gate

The generic package pipeline carries unchanged `brew 1.0-10` through P5 without a runtime semantic
change or package-specific branch. Metadata, namespace, attachment, all five exports, both help and
example topics, and an independent GNU R-matched template/parser scenario pass. Retained tests stop
first at unavailable suggested package `testthat`, preserving the explicit P6/P7 boundary.

Semantic totals remain 1094/1094 flat cases and 45/45 recursive advisor graphs. The next gate is the
untouched `shape 1.4.6.1` P0 holdout; its scheduled first failure must select reusable graphics or
runtime work. Native/Wasm ABI expansion remains downstream of broad pure-R closure despite the
recurring testthat blocker.

## Profile 0.346 compatibility gate

The source-blind shape rotation closes generic browser-device opening, arrows, plot aspect and axis
window styles, polygon controls, and `NULL`-omitting matrix binding. Evidence reaches 1098/1098 flat
cases and 48/48 recursive advisor graphs, while unchanged shape reaches P4 rather than P5.

The next ordered shape gate is a provenance-admissible `datasets::volcano`; direct extraction from
GNU R is forbidden. Parallel high-reuse work may address `graphics::filled.contour`, the remaining
generic argument seam, or installed vignette lookup while data provenance is unresolved. The new
untouched holdout is `corrplot 0.95`. Native/Wasm ABI expansion remains downstream of broader pure-R
semantic and package-system closure.

## Profile 0.347 compatibility gate

Indexed `sort.default` output and its exact formal shape are covered by 1099/1099 flat cases and
49/49 recursive advisor graphs. The same reusable semantic closure clears unchanged shape's
`filledellipse` example, while the canonical installed-vignette `File` field closes its vignette
check. Shape correctly remains P4 because `datasets::volcano` is still the first ordered blocker.

The next gate should preserve this ordering: obtain an independently redistributable exact
compatibility source for `volcano`, or rotate to the frozen source-blind `corrplot 0.95` holdout and
let its first failure select reusable work. `graphics::filled.contour` remains a valid cross-package
graphics seam. Native/Wasm ABI expansion remains downstream of broad pure-R closure.

## Profile 0.348 compatibility gate

Exact-shadowed partial argument matching and Pearson numeric data-frame/matrix covariance are
covered by 1101/1101 flat cases and 51/51 recursive advisor graphs. Those generic closures advance
unchanged corrplot from P0 to P4 through its first three complete example topics.

The next active gate is `stats::hclust` selected by `example:corrMatOrder`, including the reusable
`as.dist` and dendrogram/order chain needed to make clustering results useful rather than exposing
an isolated name. `insight 1.5.2` remains unopened at P0 as the replacement holdout. Native/Wasm ABI
work remains downstream of broad pure-R semantic and package-system closure.

## Profile 0.349 compatibility gate

Finite distance matrices, all eight hierarchical linkage methods, recursive dendrogram conversion,
leaf ordering, and array-coordinate `which` are covered by 1103/1103 flat cases and 53/53 recursive
advisor graphs. The unchanged corrplot artifact directly exercises four clustering-order paths.

The next active gate is the reusable browser graphics `symbols` primitive selected while rendering
`example:corrMatOrder`. Corrplot remains P4 until the complete topic passes. `insight 1.5.2` remains
unopened at P0, missing-distance rescaling remains explicit, and native/Wasm ABI work remains
downstream of broad pure-R semantic and package-system closure.

## Profile 0.350 compatibility gate

User-coordinate symbol polygons and lexicographic multi-key ordering are covered by 1105/1105 flat
cases and 54/54 recursive advisor graphs. The unchanged corrplot artifact now renders its direct
default call without a package-specific runtime path.

The next active gate is reusable `stats::cutree` behavior over the owned `hclust` result, selected
by the complete `example:corrMatOrder` topic. Corrplot remains P4 until that topic passes.
`insight 1.5.2` remains unopened at P0, the unsupported `symbols` variants remain explicit, and
native/Wasm ABI work remains downstream of broad pure-R semantic and package-system closure.

## Profile 0.351 compatibility gate

Owned merge-tree cutting is covered by 1106/1106 flat cases and 55/55 recursive advisor graphs. The
unchanged corrplot artifact now completes `example:corrMatOrder` through generic `cutree` semantics.

The next active gate is deterministic symmetric-eigenvector orientation selected by
`example:corrRect`. Work must be source-independent and validated on a matrix suite, not tuned to a
single package or dataset. Corrplot remains P4, `insight 1.5.2` remains unopened at P0, and
native/Wasm ABI work remains downstream of broad pure-R semantic and package-system closure.

## Profile 0.352 compatibility gate

The public symmetric eigen path is now a pinned, reproducible LAPACK 3.12.1 `DSYEVR` Wasm closure.
Together with fractional `seq(length.out=)` ceiling semantics, it is covered by 1106/1106 flat cases
and 57/57 recursive advisor graphs. The unchanged corrplot artifact completes `example:corrMatOrder`
and `example:corrRect` without package-specific runtime code.

The next active gate is the generic `graphics::symbols` parameter contract selected inside
`example:corrplot` (`invalid symbol parameter`). Corrplot remains P4, `insight 1.5.2` remains
unopened at P0, and Phase 3 native-package ABI work remains downstream of broad pure-R semantic and
package-system closure. The internal DSYEVR module does not begin or imply that ABI.

## Profile 0.353 compatibility gate

Pearson correlation tests, data-frame column binding and renaming, zero-size symbol handling, and
text line-width validation are covered by 1106 flat cases and 58/58 recursive advisor graphs. The
unchanged corrplot artifact now completes every installed example topic and advances to P5 without
package-specific runtime code.

The next active gate is its dependency-complete test entry point: suggested package `testthat` is
not yet available through the generic package pipeline. Work proceeds through that reusable
dependency chain and its first explicit blocker. `insight 1.5.2` remains unopened at P0, and Phase 3
native-package ABI work remains downstream of broad pure-R semantic and package-system closure.

## Profile 0.354 compatibility gate

The gate now includes 1108 flat cases, 62/62 recursive advisor graphs, and complete unchanged
`insight 1.5.2` examples. Model introspection, source deparsing, RNG state, grouped binomial GLMs,
quasi families, the anscombe dataset, and data-frame method binding are covered without package
identity branches.

The next active gate is dependency-complete testing: insight's retained test driver requires
suggested package `testthat`. P6/P7 remain open. Work must preserve the source-blind corpus rotation
and must not pull the native-package ABI ahead of broader pure-R semantic closure without recording
that dependency decision explicitly.

## Profile 0.355 compatibility gate

Generic `grid`, `uniroot`, `cov2cor`, and `tcrossprod` behavior advances unchanged GPArotation to
P3. Its first installed example exceeds the standard package-test allocation budget under a
100-random-start workload; P4/P5 remain open. The next milestone should improve reusable numerical
efficiency/resource accounting or rotate to the independently frozen `palmerpenguins 0.1.1` holdout,
while preserving package-neutral production code and executable differential evidence.

## Profile 0.356 compatibility gate

GNU-compatible `setNames`, reusable array `sweep`, maximum-likelihood `factanal`/`loadings`, and
programmatic callback-call reconstruction carry unchanged GPArotation through the complete `CCAI`
topic. The package advances to P4; it does not reach P5 because the later `GPA` topic reaches the
explicit 100,000,000-step evidence ceiling.

The next gate is reusable numerical/runtime efficiency for that later multi-rotation workload or the
next scheduled source-blind rotation. Formula-driven factor analysis, factor scores, broader
rotation/control fidelity, dependency-complete package tests, and pure-R package-system closure
remain ahead of native-package ABI expansion.

## Profile 0.357 compatibility gate

Bounded-batch numeric checkpoints, independent cumulative allocation accounting, expression and
graphics closure, GNU-shaped print dots, and generic stored-call `update.default()` rewriting carry
unchanged GPArotation through every installed example topic. The package advances to P5.

The next gate is reusable core-data/search-path closure for `datasets::ability.cov`, the first
retained-test blocker in `test:MASSoblimin.R`. Work should solve default core-package data
visibility generically, preserve the source-blind corpus partitions, and keep native-package ABI
expansion downstream of broader pure-R semantic and package-test closure.

## Profile 0.358 compatibility gate

The `ability.cov` provenance and generic datasets-path gate is closed. The next ordered gate is a
reusable bounded L-BFGS-B optimizer/convergence contract precise enough for GNU `factanal()` loading
agreement at `1e-6`, currently exposed by GPArotation `test:MASSoblimin.R` expression 17. The work
must generalize to `optim(method = "L-BFGS-B")` and other factor-analysis consumers; a fixed matrix,
package identity, or expected-value substitution is not admissible.

## Profile 0.359 compatibility gate

The bounded-optimizer gate is closed with a reproducible L-BFGS-B 2.1 Wasm backend and exact
factor-analysis evidence. Generic `stats::varimax`, `matrix()` default dimensions, legend fill and
border rendering, and package-test expression/working-directory behavior close every subsequent
applicable blocker in unchanged `GPArotation 2026.8-1`; that pinned artifact reaches P7.

The next ordered package gate is the still-unopened `palmerpenguins 0.1.1` P0 holdout. Its scheduled
source-blind evaluation must first record installation/load/data/example/test behavior and the first
concrete reusable blocker. A data-only success must not be generalized into arbitrary pure-R package
support, and native-package ABI work remains downstream of broad semantic and pure-R corpus closure.

## Profile 0.360 compatibility gate

The scheduled `palmerpenguins 0.1.1` rotation is closed at P7. Its generic package-check path and an
independent LazyData scenario now pass through reusable `tibble::as_tibble` and
`base::as.character.Date` semantics without a package-identity branch. This is a pinned-artifact
result, not proof of arbitrary pure-R package support.

The holdout partition is temporarily empty at this rotation boundary. Before inspecting or executing
another candidate, the next increment must choose it from the recorded usage/dependency policy,
freeze official metadata and the unopened source digest, and record it at P0. Its first observed
blocker should compete with existing P5 test/dependency blockers for priority. Broad pure-R package
closure remains ahead of the native-package ABI phase.

The replacement P0 holdout is now metadata-frozen as `polynom 1.4-1`, the highest-download
purpose-admissible candidate after explicit host-service exclusions in the fixed comparison window.
Its unopened source digest is recorded in the corpus. The next gate is its scheduled source-blind
installation/package-check path and first concrete reusable blocker.

## Profile 0.361 compatibility gate

The scheduled `polynom 1.4-1` source-blind gate is closed at P7. Its successive failures selected
reusable stats generic/basis behavior, S3 group registration/context and `NextMethod()`, callable
Ops, Summary accumulation, list distinctness and general real eigendecomposition; the unchanged
artifact and independent polynomial scenario now pass without a package-identity branch.

The holdout partition is temporarily empty. The next package-driven increment must again freeze a
purpose-admissible candidate's official metadata, download window and unopened source digest before
inspection. Existing P5 dependency/test blockers remain eligible to outrank that new holdout when
they expose broader semantic closure. Native-package ABI work remains downstream of broad Base and
pure-R package-system maturity.

The replacement P0 holdout is now metadata-frozen as `estimability 2.0.0`, the highest-download
purpose-admissible candidate after the recorded host-service exclusions in the fixed comparison
window. Its unopened source size and digest are recorded in the corpus. The next gate is its
scheduled unchanged installation/package-check path and first concrete reusable blocker.

## Profile 0.362 compatibility gate

The scheduled unchanged `estimability 2.0.0` package and an independently authored GNU-matched
estimability scenario pass at P7. Reusable Base/stats closure now includes lazy `na.pass`, visible
`qr.R`, retained model terms, `model.frame()` xlevels/NA policy, rank-deficient `predict.lm()`,
`getCall.default()` dots, `update.default()` formula rewriting, and named built-in or numeric-matrix
factor contrasts.

The holdout partition is temporarily empty. The next increment must freeze a new purpose-admissible
release from official metadata before opening it, while existing lower-tier corpus blockers remain
eligible when they promise broader semantic closure. Native-package ABI work remains downstream of
broad Base and pure-R package maturity.

The replacement P0 holdout is now metadata-frozen as `formatR 1.14`, the highest-download
purpose-admissible candidate after the existing host-service exclusions. Its official metadata,
fixed usage window, unopened 96,077-byte source size, and source SHA-256 are recorded. The next gate
is its scheduled unchanged package-check run and first concrete reusable blocker.

## Profile 0.363 compatibility gate

`formatR 1.14` has moved from holdout P0 to development P5. The next work remains source-blind and
package-independent: close the recorded deparse-layout blocker, rerun retained tests, and advance
only if executable evidence supports P6/P7. A new metadata-only holdout must be frozen before any
next candidate source is opened.

## Profile 0.364 compatibility gate

The recorded formatR blocker is closed at P7. The unchanged package passes the complete applicable
generic check plan and an independent GNU-matched scenario after reusable deparse, condition-stack,
and visibility semantics were corrected. The next package-driven increment must freeze a new
metadata-only holdout before opening or executing its source. Native-package ABI work remains
downstream of broad Base and pure-R package-system maturity.

## Post-0.364 frozen source-blind rotation

The replacement P0 holdout is `lambda.r 1.2.4`, frozen before any archive inspection or execution.
Its official metadata, 112,995 downloads in the fixed 2026-07-12 through 2026-08-10 window, unopened
25,666-byte source archive, and source SHA-256 are recorded in the corpus. It imports only the newly
P7 `formatR` package and suggests the already-P7 `testit` package, making it a direct test of
generic pure-R dependency closure rather than an isolated callable count.

The next gate is unchanged source-blind installation and the complete applicable generic
package-check plan. Its first observed failure must select reusable Base, language, namespace, or
package-system work; production code must not branch on `lambda.r`. Native-package ABI expansion
remains downstream of broader pure-R semantic closure.

## Profile 0.365 compatibility gate

The scheduled unchanged `lambda.r 1.2.4` dependency-closure probe advances from P0 to development
P4. Generic fixes cover `parse()` option inheritance and list input, normalized parse-data terminal
classification, and one-dimensional `apply()`. The next ordered blocker is no longer package
loading: `example:UseFunction` requires GNU R-compatible R-level `eval`/`source`/`example`
call-frame reflection so the frame selected through `sys.frame()` exposes `envir`.

The next semantic increment should model those reusable call frames and verify them independently
against GNU R before rerunning the unchanged package. No `lambda.r` identity branch is acceptable,
and native-package ABI expansion remains downstream of broader pure-R closure.

## Profile 0.366 compatibility gate

The `lambda.r 1.2.4` frame-reflection blocker is closed through reusable evaluator semantics, and
the unchanged artifact advances to P7 after the complete applicable generic package-check plan and
an independent GNU-matched scenario pass. Ellipsis parse data, missing names through replacement and
`list2env()`, and `na.fail` model policy are covered by independent differential evidence.

This checkpoint does not complete the roadmap. Continue selecting the next source-blind package
blocker from the frozen corpus, close it through general Base/language/package-system semantics, and
require both generic package checks and independent scenarios for advancement. Native-package ABI
work remains downstream of broad pure-R semantic closure.

## Post-0.366 frozen source-blind rotation

`SQUAREM 2026.1` is metadata-frozen at P0 as the next purpose-admissible pure-R holdout. It has no
native compilation or mandatory non-core package dependency and exercises general numerical
fixed-point acceleration rather than a host service. Its official source size and digest were
recorded without listing, extraction, parsing, installation, or execution.

The next gate is the unchanged generic package-check path. Its first observed failure must select a
reusable numerical, language, package-system, or resource contract; no SQUAREM identity branch or
source rewrite is admissible. Existing dependency/native and provenance-gated blockers remain
explicit rather than being hidden by the new rotation.

## Profile 0.367 compatibility gate

The unchanged SQUAREM artifact now passes the complete applicable generic plan and an independent
GNU-matched fixed-point scenario at P7. Its blockers were closed through reusable
list-configuration, normal-RNG, QR dispatch, and S3 solve semantics. The optional native
`interval`/`survival` closure remains outside Phase 2 and is not silently treated as supported.

The holdout partition is empty again. Before another candidate is inspected, freeze its official
metadata, fixed-window usage evidence, source size, and unopened digest at P0. LAPACK pivot parity,
existing testthat/native closures, and the provenance-gated volcano resource remain explicit gaps.

## Profile 0.368 compatibility gate

The frozen unchanged `snow 0.4-4` archive passes every applicable generic check and an independent
GNU-matched custom in-memory transport scenario at P7. Its first blocker was closed in the shared
Base character-to-numeric coercion path, with exact flat and recursive evidence for blank,
whitespace, decimal, NaN, invalid, and infinite inputs.

SOCK/MPI process launch and external networking remain explicit host-adapter boundaries rather than
being inferred from package loading. The holdout partition is empty again and the next source must
be frozen at P0 before inspection.

## Profile 0.369 compatibility gate

The frozen unchanged `futile.options 1.0.1` archive passes its complete applicable generic check
plan and an independent GNU-matched OptionsManager scenario at P7. Its first source-blind semantic
failure was closed through package-neutral `UseMethod()` and `NextMethod()` visibility propagation,
with direct, chained, and enclosing-block behavior covered independently.

This checkpoint does not complete the roadmap. Freeze the next source-blind candidate before
inspection and continue selecting reusable Base, language, namespace, and package-system blockers.
Native-package ABI expansion remains downstream of mature broad pure-R closure.

## Profile 0.370 compatibility gate

The frozen unchanged `futile.logger 1.4.9` archive passes its complete applicable generic check plan
and an independent GNU-matched logger hierarchy scenario at P7. Package-neutral fixes cover exact
character conditions, numeric/`NaN` grouping, registered-environment formatting, and eager
`tryCatch()` handler lists, with flat and recursive differential evidence.

This checkpoint does not complete the roadmap. Freeze the next source-blind candidate before
inspection and continue selecting reusable Base, language, namespace, and package-system blockers.
Native-package ABI expansion remains downstream of mature broad pure-R closure.

## Profile 0.371 compatibility gate

The frozen unchanged `tinytest 1.4.3` archive passes its complete applicable generic check plan,
including its retained 159-test top-level self-test, at P7. Package-neutral fixes span
omitted-choice `match.arg()`, dynamic system frames, virtual parsing and connections, factor/table
semantics, PCRE replacement controls, independently sourced core data, condition construction and
identity, and handler-aware vector-recycling warnings.

This checkpoint does not complete the roadmap. Continue with another metadata-frozen source-blind
candidate or a higher-leverage recorded semantic blocker. Native-package ABI expansion remains
downstream of mature broad pure-R closure.

## Profile 0.372 compatibility gate

The frozen unchanged `permute 0.9-10` archive reaches development P7 for every applicable generic
check plus an independent permutation-control scenario. Its retained `testthat` launcher is
not-applicable because that declared Suggests dependency is unavailable, and is not counted as a
passing test. Reusable fixes cover exact extraction and language conversion, log-factorials, nested
update frames, startup-message restarts, classed cumulative functions, formula plotting,
`unsplit()`, and formula t-tests.

This checkpoint does not complete the roadmap. Freeze another purpose-admissible candidate before
source inspection or select a higher-leverage recorded blocker. Native-package ABI expansion remains
downstream of mature broad pure-R semantic closure.

## Profile 0.373 compatibility gate

The frozen unchanged `bigD 0.3.1` archive reaches development P7 for every applicable generic check
plus an independent date/locale scenario. Its retained `testthat` launcher is not-applicable because
that declared Suggests dependency is unavailable, and its absent vignette surface is also
not-applicable; neither is counted as passed. Reusable fixes add bounded large normalized package
resources, a separate reviewed package-resource serialization-input ceiling, and browser-safe null
external-pointer serialization and value semantics.

This checkpoint does not complete the roadmap. Freeze another purpose-admissible candidate before
source inspection or select a higher-leverage recorded blocker. Native-package ABI expansion,
including non-null external pointers, remains downstream of mature broad pure-R semantic closure.

## Profile 0.374 compatibility gate

The frozen unchanged `pracma 2.4.6` archive reaches development P7. Every applicable generic
metadata, namespace, attachment, documentation, example, and retained-test check passes. Examples
that explicitly require unavailable declared Suggests `NlcOptim` or `quadprog`, and the absent
vignette surface, remain not-applicable rather than passed. Independent `gmres`, `gammainc`,
`histc`, and matrix-exponential scenarios match GNU R black-box results.

This checkpoint does not complete the roadmap. The next work must freeze a new untouched
purpose-admissible candidate or select a higher-leverage recorded semantic blocker. Arbitrary pure-R
packages, complete Base R semantics, and native-package ABI support remain open.

## Profile 0.390 compatibility gate

Device-independent `grDevices::contourLines` now covers reusable numeric contour topology and
bounded complexity with 1281/1281 flat and 156/156 recursive evidence. The unchanged
`gridGraphics 0.5-1` artifact advances past that import but remains P1 at its next namespace
blocker, `grid::makeContent`. Continue through the shared grid grob lifecycle and rerun the
unchanged package; do not claim namespace loading or a higher package tier until the generic check
plan proves it.

## Profile 0.391 compatibility gate

Shared `grid::makeContent` and `grid::makeContext` S3 lifecycle semantics pass 1282/1282 flat cases
and 157/157 exact recursive graphs. The unchanged `gridGraphics 0.5-1` artifact now proves namespace
loading, attachment, imported-generic method registration, documentation, and all applicable
examples at P5. Continue at its first P6 blocker, `grDevices::pdf.options`; do not claim retained
tests, saved output, independent scenarios, or P6/P7 until those ordered gates pass.

## Profile 0.392 compatibility gate

Session `grDevices::pdf.options` query, update, reset, validation, and `pdf()` default consumption
now have flat and exact recursive black-box evidence. The unchanged `gridGraphics 0.5-1` retained
test proceeds through expression 16 and stops at expression 17 because relative generated output
does not yet have a writable isolated package-test working directory. Continue with that reusable
package-check sandbox and rerun the frozen artifact. Keep it at P5 until all retained tests pass.

## Profile 0.393 compatibility gate

Package tests and saved-output runs now use writable isolated browser-memory copies, and retained
grid viewport-tree navigation has flat and exact recursive evidence. The unchanged
`gridGraphics 0.5-1` test proceeds through those former blockers but remains P5 at its next ordered
failure: GNU-compatible `recordPlot()` operation provenance and named `C_*` display-list
descriptors. Continue with that reusable graphics contract; do not claim P6 until all retained tests
pass.

## Profile 0.395 compatibility gate

Reusable grid drawing grobs and seven primitive recorded-operation descriptors pass 1287 flat and
161 exact recursive cases. The unchanged `gridGraphics 0.5-1` test now stops at expression 20 on
composite boxplot display-list lowering. Continue at that shared graphics-journal abstraction and
retain P5 until all retained tests pass.

## Profile 0.396 compatibility gate

Ordered per-group boxplot recording passes 1288 flat and 162 exact recursive cases and advances the
unchanged `gridGraphics 0.5-1` retained test through expression 23. Continue at expression 24's
shared `pairs.default` scatterplot-layout, panel-callback, axis, and recorded-operation contract.
Retain P5 until every retained test passes; do not infer complete boxplot, graphics-engine, or
arbitrary-package compatibility from this advance.

## Profile 0.397 compatibility gate

The shape-level numeric `pairs` implementation carries unchanged `gridGraphics 0.5-1` through both
iris demonstrations and makes expression 26's missing `datasets::volcano` object the ordered first
blocker. Continue with independently sourced core-data provenance before adding the matrix. Retain
P5 until all retained tests pass, and keep complete formula, panel-callback, logarithmic, and GNU
layout semantics open in the compatibility ledger.

## Profile 0.398 compatibility gate

The `volcano` audit rejected unlicensed or R-derived mirrors and therefore did not add the data. The
program rotated to `modeltools 0.2-24`, which now reaches P4 through reusable package-cleanup,
core-namespace, S4 prototype, and S3 generic contracts. The next package-driven gate is the shared
S4/model-environment `$` behavior in its first failing installed example. `stats4` is registered as
an explicit dependency surface, not claimed as a completed package.

## Profile 0.399 compatibility gate

The reusable call-mutation, model-frame subset, top-level-generic, and superclass-query contracts
carry the unchanged modeltools artifact through `example:MEapply`. Keep the artifact at P4 until the
remaining applicable installed examples pass. The next gate is package-neutral invocation of
callable contrast generators in the model-matrix pipeline, beginning with the unchanged
`example:ModelEnvFormula` failure. Do not encode a modeltools identity or convert package functions
to strings as a shortcut.

## Profile 0.400 compatibility gate

Callable contrast generators and multi-response `lm.fit()` carry unchanged modeltools through all
installed examples to P5. The next gate is `tests/regtest.R` expression 6: close the generic S4
row-omission contract so design, response, weight, and offset components retain one observation set.
Do not relax direct-fitter dimension checks or recognize the modeltools class in production.

## Profile 0.401 compatibility gate

The generic synchronized-omission contract closes the measured modeltools blocker and advances the
unchanged 0.2-24 artifact to scoped P7. Rotate next to the highest-leverage reusable semantic or
dependency-closure blocker among the remaining corpus failures. Native-code ABI work remains a later
phase, and neither a P7 artifact nor current callable coverage completes the program goal.

## Profile 0.402 compatibility gate

Central qchisq/qf semantics advance unchanged ellipse 0.5.0 to P4. Its next gate is a reusable,
browser-native `stats::arima0` implementation with model-object and optimizer evidence, or a newly
frozen holdout whose first blocker has greater cross-corpus reach. Non-central quantiles remain an
explicit boundary. The empty holdout partition must be replenished before another source-blind run.

## Profile 0.403 compatibility gate

Completion/settings semantics and generic Reference Class super dispatch advance unchanged
GlobalOptions 0.1.4 to scoped P7. The next package-driven gate requires a new metadata-first
holdout; alternatively, the recorded ellipse `stats::arima0` blocker remains a reusable time-series
target. Do not infer broad Reference Class or arbitrary-package completion from one passing
artifact, and do not begin package-specific rewrites or native ABI work ahead of the evidence-based
phase boundary.

## Profile 0.404 compatibility gate

Language/expression-vector apply semantics advance unchanged rbenchmark 1.0.1 to P4. Its P5 blocker
is now an explicit browser resource contract: the installed benchmark example exceeds the fixed
package-test step budget. Do not raise the global safety limit merely to complete a benchmarking
workload. The next source-blind gate is frozen ca 0.71.1 at P0; alternatively, ellipse's reusable
`stats::arima0` blocker remains available if it has greater cross-corpus leverage after ca's first
run. Native ABI work remains downstream of broader pure-R closure.

## Profile 0.409 compatibility gate

Unchanged vipor 0.4.7 reaches scoped P7 after reusable grouped replacement, graphical-parameter,
serialized ASCII, and stats namespace corrections. The corpus now contains 86 pinned releases with
71 passing, 14 blocked, and one unevaluated; 32 have P7 evidence. Unopened dynamicTreeCut 1.63-1 is
the next source-blind P0 holdout. Continue with its first unchanged generic blocker while preserving
the pure-R package pipeline and GNU R differential gates. Native ABI work remains downstream of
broader pure-R semantic closure.

## Profile 0.410 compatibility gate

Unchanged dynamicTreeCut 1.63-1 reaches scoped P7 after reusable one-dimensional table
sort/subsetting and character-matching corrections. The corpus now contains 87 pinned releases with
72 passing, 14 blocked, and one unevaluated; 33 have P7 evidence. Unopened pixmap 0.4-14 is the next
source-blind P0 holdout. Continue with its first unchanged generic blocker while preserving the
pure-R installer, package-check pipeline, source-blind partition, and GNU R differential gates.
Native ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.411 compatibility gate

Unchanged pixmap 0.4-14 reaches scoped P7 after package-neutral S4 coercion, inherited
initialization, slot access/replacement, image aspect-window, and host-bound saved-output
classification work. The corpus now contains 88 pinned releases with 73 passing, 14 blocked, and one
unevaluated; 34 have P7 evidence. Unopened moments 0.14.1 is the next source-blind P0 holdout.
Continue with its first unchanged generic blocker. Native ABI work remains downstream of broader
pure-R semantic and package-system closure.

## Profile 0.412 compatibility gate

Unchanged moments 0.14.1 reaches scoped P7 through the existing generic package path and an
independent all-export GNU-matched scenario, without exposing a new shared blocker. The corpus now
contains 89 pinned releases with 74 passing, 14 blocked, and one unevaluated; 35 have P7 evidence.
Unopened RSpincalc 1.0.2 is the next source-blind P0 holdout. Continue with its first unchanged
generic blocker; native ABI work remains downstream of broader pure-R closure.

## Profile 0.413 compatibility gate

Unchanged RSpincalc 1.0.2 reaches scoped P7 after package-neutral N-dimensional `apply()` work and
an independent GNU-matched quaternion/rotation scenario. The corpus now contains 90 pinned releases
with 75 passing, 14 blocked, and one unevaluated; 36 have P7 evidence. Unopened dichromat 2.0-1 is
the next source-blind P0 holdout. Continue with its first unchanged generic blocker; native ABI work
remains downstream of broader pure-R closure.

## Profile 0.414 compatibility gate

Unchanged dichromat 2.0-1 reaches scoped P7 after package-neutral numeric `predict.loess` work and
an independent exact GNU-matched color/data scenario. The corpus now contains 91 pinned releases
with 76 passing, 14 blocked, and one unevaluated; 37 have P7 evidence. Unopened RUnit 0.4.33.1 is
the next source-blind P0 holdout. Continue with its first unchanged generic blocker; exact loess
interpolation and native ABI work remain downstream of broader semantic closure.

## Profile 0.415 compatibility gate

Unchanged RUnit 0.4.33.1 reaches scoped P7 after package-neutral `all.equal.numeric` and
`methods::isGeneric` closure plus an independent exact GNU-matched check/tracker scenario. The
corpus now contains 92 pinned releases with 77 passing, 14 blocked, and one unevaluated; 38 have P7
evidence. Unopened ica 1.0-3 is the next source-blind P0 holdout. Continue with its first unchanged
generic blocker; native ABI work remains downstream of broader pure-R semantic closure.

## Profile 0.416 compatibility gate

Unchanged ica 1.0-3 reaches scoped P7 after package-neutral `stats::dexp` and central `stats::dt`
closure plus an independent export/ACY/FastICA scenario. The corpus now contains 93 pinned releases
with 78 passing, 14 blocked, and one unevaluated; 39 have P7 evidence. Unopened proto 1.0.0 is the
next source-blind P0 holdout. Continue with its first unchanged generic blocker; non-central
density, broader semantic closure, and native ABI work remain downstream priorities.

## Profile 0.417 compatibility gate

Unchanged proto 1.0.0 reaches scoped P7 after package-neutral environment deparsing, `eapply()`, and
expression-preserving S3 subset/replacement dispatch plus an independent inheritance/mutation
scenario. The corpus now contains 94 pinned releases with 79 passing, 14 blocked, and one
unevaluated; 40 have P7 evidence. Unopened NLP 0.3-3 is the next source-blind P0 holdout. Continue
with its first unchanged generic blocker; broader pure-R semantic closure and native ABI work remain
downstream priorities.

## Profile 0.418 compatibility gate

Unchanged NLP 0.3-3 reaches scoped P7 after package-neutral actual-call accounting, generic S3 call
frames, date/time parsing, DCF output, and character endpoint closure plus an independent
annotation/token/feature/date-time scenario. The corpus now contains 95 pinned releases with 80
passing, 14 blocked, and one unevaluated; 41 have P7 evidence. Unopened timeSeries 4052.112 is the
next source-blind P0 holdout. Continue with its first unchanged generic blocker; broader pure-R
semantic closure and native ABI work remain downstream priorities.

## Profile 0.419 compatibility gate

Unchanged timeSeries 4052.112 reaches scoped P7 after package-neutral statistical smoothing, S4
vector/generic fallback, aggregate/filter/product, core-data, year-day parsing, and POSIX sequence
work plus an independent GNU-matched scenario. The corpus now contains 96 pinned releases with 81
passing, 14 blocked, and one unevaluated; 42 have P7 evidence. Unopened pls 2.9-0 is the next
source-blind P0 holdout. Continue with its first unchanged generic blocker; broader pure-R semantic
closure and native ABI work remain downstream priorities.

## Profile 0.420 compatibility gate

The evidence-integrity increment closes reusable matrix utility, time-series attribute, S4 data-part
promotion, formal matrix representation, and binary bind dispatch gaps. Flat conformance is
1,360/1,360 and the 232 recursive Oracle v2 graphs pass against the available advisory GNU R 4.6.0
installation. The corpus remains 96 artifacts with 81 passing, 14 blocked, and one unevaluated; 42
have P7 evidence. Unopened `pls` 2.9-0 remains the next source-blind P0 holdout. Continue with its
first unchanged generic blocker; broader pure-R semantic closure and native ABI work remain
downstream priorities, and GNU R 4.6.1 remains the normative release gate.

## Profile 0.421 compatibility gate

Unchanged `pls` 2.9-0 reaches scoped P7 after package-neutral matrix-valued data-frame subsetting,
model formula/terms/matrix, QR transformation and triangular-solve, and lazy graphics-panel work,
plus independent GNU-matched yarn and mayonnaise scenarios. Flat conformance is 1,371/1,371 and all
241 recursive Oracle v2 graphs pass against the available advisory GNU R 4.6.0 installation. The
corpus now contains 97 artifacts with 82 passing, 14 blocked, and one unevaluated; 43 have P7
evidence. Unopened `stargazer` 5.2.3 is the next source-blind P0 holdout. Continue with its first
unchanged generic blocker; broader pure-R semantic closure and native ABI work remain downstream,
and GNU R 4.6.1 remains the normative release gate.

## Profile 0.422 compatibility gate

Unchanged `stargazer` 5.2.3 reaches scoped P7 after package-neutral core-data provenance, central F
probability, and matrix-constrained bind recycling work, plus an independent exact GNU-matched
regression-table scenario. Flat conformance is 1,374/1,374 and all 244 recursive graphs pass against
the available advisory GNU R 4.6.0 installation. The corpus now contains 98 artifacts with 83
passing, 14 blocked, and one unevaluated; 44 have P7 evidence. Unopened `lgr` 0.5.2 is the next
source-blind P0 holdout. Continue with its first unchanged generic blocker; broader pure-R semantic
closure and native ABI work remain downstream, and GNU R 4.6.1 remains the normative release gate.

## Profile 0.429 compatibility gate

The unchanged `gsubfn` 0.7 artifact advances across seven package-neutral contracts: `BOD`, grouped
`CO2`, data-frame aggregation, compound formula-to-function conversion, the complete standard
`matplot` type alphabet, conjugate-gradient `optim`, and atomic `rep()` count coercion. Its first
remaining blocker is now the optional `chron` dependency used by `example:list`. The next increment
must define and evidence a generic Suggested-dependency admission policy or record a more
high-leverage semantic blocker; it must not copy `chron::month.day.year` into Base R.

Flat conformance is 1,392/1,392; recursive Oracle v2 evidence is 257/257 graphs with 533 explicit
binding associations. The 103-release corpus has 88 passing, 15 blocked, and 49 P7 artifacts. GNU R
4.6.1 remains normative, and broader pure-R closure precedes native ABI work.

## Profile 0.430 compatibility gate

Deterministic selected-Suggests resolution and lock v2 evidence close the package-system policy gap.
The unchanged `gsubfn` probe proves both outcomes: mandatory-only resolution remains pure R, while
selecting `chron` fails with its concrete compilation and native-library contracts. This blocker is
reserved for the later reusable native ABI rather than answered with copied or package-specific R
code.

GNU-compatible `isOpen(rw=)` selection advances `read.pattern`, and mode-filtered inherited
`get`/`get0`/`mget`/`exists` lookup closes an additional `strapply` route. Flat conformance is
1,394/1,394 with 1,337 live-R-eligible cases; recursive Oracle v2 is 260/260 with 536 distinct
binding associations after moving list-valued `combn` evidence to the recursive transport and
closing its callback dimensions. The corpus stays at 103 artifacts, 88 passing, 15 blocked, and 49
P7; `gsubfn` remains P4 at the selected optional native dependency boundary.

## Profile 0.428 compatibility gate

Generic package checks now distinguish standard lifecycle hooks from ordinary documented exports.
This closes the first unchanged `gsubfn` 0.7 infrastructure blocker without package identity logic.
The artifact reaches development P4; missing browser-owned `datasets::BOD` in `example:fn` is the
next ordered blocker. The 103-artifact corpus has 88 passing and 15 blocked entries, 49 at P7, and
temporarily no holdout. GNU R 4.6.1 remains normative.

## Profile 0.423 compatibility gate

Unchanged `lgr` 0.5.2 reaches scoped P7 after package-neutral formatting, portable extension
parsing, string-width trimming, and strict optional-Suggests classification, plus an independent
GNU-matched in-memory logging scenario. Flat conformance is 1,377/1,377 and all 247 recursive graphs
pass against the available advisory GNU R 4.6.0 installation. The corpus now contains 99 artifacts
with 84 passing, 14 blocked, and one unevaluated; 45 have P7 evidence. Unopened `operator.tools`
1.6.3.1 is the next source-blind P0 holdout. Continue with its first unchanged generic blocker;
broader pure-R semantic closure and native ABI work remain downstream, and GNU R 4.6.1 remains
normative.

## Profile 0.424 compatibility gate

Unchanged `operator.tools` 1.6.3.1 reaches scoped P7 after package-neutral locked `.Options`
initialization, base-environment/base-namespace synchronization, removal, reset, and lexical-shadow
semantics, plus an independent GNU-matched custom-operator scenario. Flat conformance is 1,378/1,378
and all 248 recursive graphs pass against the available advisory GNU R 4.6.0 installation. The
corpus now contains 100 artifacts with 85 passing, 14 blocked, and one unevaluated; 46 have P7
evidence. Unopened `stabledist` 0.7-2 is the next source-blind P0 holdout. Continue with its first
unchanged generic blocker; broader pure-R semantic closure and native ABI work remain downstream,
and GNU R 4.6.1 remains the normative release gate.

## Profile 0.425 compatibility gate

Unchanged `stabledist` 0.7-2 reaches scoped P7 after package-neutral `uniroot` endpoint semantics,
GNU-shaped `ecdf` closures and S3 plotting, browser-native rug marks, and reusable RGBA color
transforms, plus an independently authored GNU-matched distribution scenario. Flat conformance is
1,379/1,379, and the added exact recursive graph passes against the available advisory GNU R 4.6.0
installation. The corpus now contains 101 artifacts with 86 passing, 14 blocked, and one
unevaluated; 47 have P7 evidence. Unopened `formula.tools` 1.7.1 is the next source-blind P0
holdout. Continue with its first unchanged generic blocker; broader pure-R semantic closure and
native ABI work remain downstream, and GNU R 4.6.1 remains the normative release gate.

## Profile 0.426 compatibility gate

Unchanged `formula.tools` 1.7.1 reaches scoped P7 after package-neutral `utils::apropos`, expression
replacement, `stats::terms.formula`, symbol/atomic name coercion, and compact deparse spacing, plus
an independently authored GNU-matched scenario covering its ordinary public API. Flat conformance is
1,381/1,381, and the added exact recursive graph passes against the available advisory GNU R 4.6.0
installation. The corpus now contains 102 artifacts with 87 passing, 14 blocked, and one
unevaluated; 48 have P7 evidence. Unopened `gridBase` 0.4-7 is the next source-blind P0 holdout.
Continue with its first unchanged generic blocker; broader pure-R semantic closure and native ABI
work remain downstream, and GNU R 4.6.1 remains the normative release gate.

## Profile 0.427 compatibility gate

Unchanged `gridBase` 0.4-7 reaches scoped P7 after shared grid viewport-transform, graphical
parameter inheritance, rectangle-grob, and base graphics layout-state gaps are closed. Its full
applicable package-check plan and an independently authored scenario covering all exports pass
without source rewriting or package identity logic.

Flat conformance is 1,385/1,385; the exact recursive inventory is 251 graphs with 532 associated
bindings, and the focused graph passes against advisory GNU R 4.6.0. The corpus has 103 artifacts,
88 passing, 14 blocked, and one unevaluated, with 49 at P7. Unopened `gsubfn` 0.7 is the next
source-blind P0 holdout. Continue with its first unchanged generic blocker; broader pure-R semantic
closure and native ABI work remain downstream, and GNU R 4.6.1 remains the normative release gate.

## Post-0.430 compatibility gate

The usage-ranked holdout partition is replenished with unopened `tinytable 0.18.0`, selected at
21,458 downloads in the fixed 2026-07-27 through 2026-08-25 window after documented host-service,
resource-only, native-header, tooling, and already-evaluated-dependency exclusions. Official
metadata declares no native compilation and only browser-core `methods` as mandatory. Its source
URL, 440,097-byte size, and SHA-256
`83a69d454d2c9333cd4d54bb6c12bc6970d034545c17b260fe4a87e6be04324c` are frozen without opening the
archive. The corpus has 104 artifacts: 88 passing, 15 blocked, one unevaluated, and 49 at P7.
Execute this exact archive unchanged and follow its first package-neutral blocker.

## Profile 0.431 compatibility gate

`tinytable 0.18.0` completes the scheduled source-blind rotation at regression P7. Shared fixes
cover S4 `NULL` class-union slot replacement, `validObject()` structural diagnostics, lazy
`...names()`, backtick-form missing-optional-package diagnostics, and standard `Enhances`
applicability. The final unchanged package check and an independent GNU-matched S4 composition pass
without package identity logic or source rewriting.

Flat evidence is 1,397/1,397 with 1,340 live-eligible cases; recursive evidence is 262/262 with 539
associated bindings. The 104-artifact corpus is 89 passing and 15 blocked, with 50 at P7 and no
unevaluated holdout. Replenish the holdout from a new fixed metadata/usage window and continue from
its first reusable blocker; the overall GNU R compatibility objective remains far from complete.

## Profile 0.432 compatibility gate

`magic 1.6-1` completes its scheduled unchanged rotation at development P7 after shared fixes for
`rep()` dispatch, simulated annealing, `noquote()`, matrix-subscript admission, empty replacement
promotion, replacement evaluation order, and wholly missing array-subscript identity. Its complete
applicable package-check plan and a separately authored GNU-matched multidimensional scenario pass
without source rewriting or package identity logic.

Flat evidence is 1,404/1,404 with 1,347 live-eligible cases; recursive evidence is 269/269 graphs
with 541 associated bindings. The 105-artifact corpus is 90 passing and 15 blocked, with 51 at P7
and no unevaluated holdout. Select and freeze the next source-blind package through a new fixed
metadata/usage window, then continue from its first reusable blocker; semantic closure and the
overall GNU R compatibility objective remain far from complete.

## Post-0.432 source-blind gate

The holdout partition is replenished with unopened `countrycode 1.9.0`, the highest-ranked
purpose-admissible candidate after established exclusions in the fixed 2026-07-29 through 2026-08-27
metadata/usage window. Its official 539,016-byte archive is pinned by SHA-256 before any member
listing, extraction, parsing, installation, or execution. Execute this exact artifact unchanged and
follow its first reusable blocker.

The scheduled execution is now frozen at development P4. Installation, namespace/attachment,
complete help coverage, and three example topics pass; `example:countrycode` first fails because
inherited data-frame coercion retains `tbl_df`/`tbl` rather than producing an ordinary data frame.
Close that package-neutral `as.data.frame`/S3 inheritance contract with GNU differential evidence,
then rerun the same unchanged artifact from the beginning.

Profile 0.433 closes the inherited data-frame coercion gap with package-neutral S3 dispatch and
attribute-preserving `as.data.frame.data.frame` behavior. The same unchanged `countrycode 1.9.0`
artifact then passes all applicable package checks and its independently authored scenario, reaching
development P7. Freeze the next source-blind package from a new fixed metadata/usage window and
continue from its first reusable blocker; the program-level objective remains incomplete.

The next gate freezes unopened `implied 0.5`, the highest-ranked purpose-admissible candidate after
the established exclusions in the fixed 2026-07-30 through 2026-08-28 metadata/usage window. Its
official 43,534-byte archive is pinned by SHA-256 before any member listing, extraction, parsing,
installation, or execution. Freeze an independent GNU black-box scenario, execute this exact
artifact unchanged, and follow its first reusable blocker.

Profile 0.440 closes `example:D2ss` with a bounded large-input smoothing-spline basis rather than
raising the dense-system ceiling. Full public fit and prediction shapes have executable structural
evidence, and explicit oversized knot requests remain resource-bounded. The unchanged artifact now
freezes `example:Duplicated`; implement the reusable `match(incomparables=)` contract next.

Profile 0.439 closes `example:D1D2` with a reusable `graphics::plot.function` S3 method over the
shared curve/plot pipeline. Exact differential evidence covers formals, endpoint precedence,
callback evaluation, invisible results, graphics forwarding, and sequence storage. The unchanged
artifact remains at P4 and now freezes `example:D2ss`: the next reusable investigation is the
documented `smooth.spline` 256-unique-observation browser limit. Any extension must preserve
resource accounting and numerical evidence rather than merely raising the guard.

Profile 0.438 classifies `tools::Rcmd` as an importable API shape with an explicit host-process
boundary. The unchanged `sfsmisc` artifact advances to P4 and now freezes `example:D1D2` as its
first P5 blocker: the shared plot path rejects a non-real `x` coordinate object. Trace GNU plot
dispatch and coordinate normalization as a black box, close the reusable plotting contract, and
rerun the same artifact unchanged.

Profile 0.437 closes the next ordered `sfsmisc` import with a reusable browser-owned
`utils::count.fields` implementation. The same unchanged artifact remains at P1 and now stops at
missing `tools::Rcmd`. Classify that callable's browser-admissible command-construction contract
separately from any desktop process-launch behavior, implement only behavior supported by the
declared host boundary, add GNU differential evidence, and rerun the same artifact unchanged.

Profile 0.436 closes the next two ordered `sfsmisc` imports with reusable `stats::symnum` symbolic
matrix behavior and `stats::update.formula` term-normalizing dot substitution. Exact recursive
graphs also close formula-as-language list structure and attribute retention. The unchanged artifact
remains at P1 and now stops at missing `utils::count.fields`; implement that browser-safe
field-counting parser contract before evaluating any later package behavior.

Profile 0.435 advances the unchanged `sfsmisc 1.1-25` artifact from its NAMESPACE parsing failure to
P1. Generic conditional selection and a sequence of shared graphics, distribution, S3, missing-data,
control-record, and step-function contracts now pass their focused evidence. The ordered namespace
gate next stops at missing `stats::symnum`; implement that reusable symbolic number contract before
evaluating any later package behavior. Full loess fitting, PostScript output, and multi-panel
`plot.ts` remain explicit later semantic/host gates rather than hidden substitutes.

The unchanged run is now frozen at development P0 with `NRPKG1010`: safe unbraced and nested
platform conditionals in the standard NAMESPACE are outside the current selector grammar. Extend the
package-neutral, non-evaluating selector for that static conditional surface, then rerun the same
artifact from the beginning.

The unchanged artifact passes the complete applicable generic package-check plan. Its separately
frozen eight-method scenario first differs in `jsd` probability output and also exposes power
inverse root-solver drift. The package is recorded at development P6 with the exact first mismatch
and artifact digest. Diagnose and close the package-neutral numeric solver contract, then rerun the
same artifact and scenario unchanged.

Profile 0.434 closes the package-neutral Brent/`uniroot` contract. The same unchanged artifact now
passes its complete applicable package checks and the independently authored eight-method plus
inverse-conversion scenario, reaching development P7. Replenish the source-blind partition through
the next fixed usage window and continue from the next reusable blocker; the program-level objective
remains incomplete.

The next gate freezes unopened `sfsmisc 1.1-25`, the highest-ranked purpose-admissible candidate
after established exclusions in the fixed 2026-07-30 through 2026-08-28 metadata/usage window. Its
official 190,824-byte archive is pinned by SHA-256 before any member listing, extraction, parsing,
installation, or execution. Freeze an independent GNU black-box scenario, execute this exact
artifact unchanged, and follow its first reusable blocker.

After `sfsmisc 1.1-25` reaches scoped P7, the next gate freezes unopened `testit 1.1` through the
complete official metadata filter and the fixed 2026-07-30 through 2026-08-28 usage window. Its
official 20,631-byte archive is pinned by SHA-256 before any member listing, extraction, parsing,
installation, or execution. Freeze an independent GNU R black-box scenario, execute this exact
artifact unchanged, and close its first package-neutral blocker without recognizing the package
identity.

Profile 0.485 closes `testit 1.1` at scoped P7 with shared `getExportedValue()` namespace reflection
and exact GNU differential evidence. The next gate is unopened `Metrics 0.1.4`, selected from the
same fixed metadata/usage window and pinned as a 14,898-byte source archive before any member
listing, extraction, parsing, installation, or execution. Freeze a broad independent GNU R scenario
for regression, classification, time-series, and retrieval metrics, then run this exact archive
unchanged and follow its first reusable blocker.

Profile 0.486 closes `Metrics 0.1.4` at scoped P7 after its unchanged kappa example exposed the
shared rank-one `t()` array contract. The next gate is unopened `pwr 1.3-0`, selected from the same
fixed metadata/usage window and pinned as an 80,426-byte source archive before any member listing,
extraction, parsing, installation, or execution. Freeze an independent GNU R power-analysis
scenario, run this exact archive unchanged, and follow its first reusable semantic or package-system
blocker.

Profile 0.487 closes `pwr 1.3-0` at scoped P7 with shared non-central chi-square, F, and Student-t
probability semantics plus `graphics::points.formula`, all backed by GNU differential evidence. The
next gate is unopened `VennDiagram 1.8.2`, selected from the same fixed metadata/usage window at
18,839 downloads and pinned as an 82,792-byte source archive before any member listing, extraction,
parsing, installation, or execution. Freeze its public surface and an independent GNU R graphics
scenario, then run this exact archive unchanged and follow its first reusable blocker.

## Profile 0.489 VennDiagram closure and next gate

Profile 0.489 closes the reusable list/atomic-matrix `cbind.data.frame` and grid graphics-annotation
contracts. The unchanged VennDiagram artifact passes every applicable generic check and its
independent scenario at scoped P7. This does not complete pure-R package compatibility or the wider
program objective.

The first unchanged `httpcode 0.3.0` run passes its generic check plan and reaches scoped P7 after a
shared source-preserving `stopifnot` diagnostic fix. The next gate is unopened `shades 1.5.0`, the
highest-ranked purpose-admissible executable candidate after the recorded exclusions in the same
fixed window. Its 35,768-byte source archive is integrity-frozen before inspection. Freeze its
public surface and an independently authored GNU R colour scenario, execute the exact archive
unchanged, and follow the first reusable browser-admissible blocker.

## Profile 0.490 shades closure and next gate

Profile 0.490 closes shared colour-converter construction, custom conversion, namespace-value, HSV,
and structural attribute gaps. The unchanged `shades 1.5.0` archive passes its complete applicable
check plan and independent scenarios at scoped P7. This does not complete the pure-R or
program-level objective.

The next gate is unopened `relimp 1.0-5`, frozen from official metadata and the same fixed usage
window before archive inspection. First freeze its public surface, formals, help inventory, and an
independently authored GNU R regression-importance scenario; then execute the exact archive through
the generic pipeline and close only its first reusable browser-admissible blocker. Suggested Tcl/Tk
UI behavior is outside the browser contract unless a host adapter is explicitly admitted.

## Profile 0.491 relimp closure and next gate

The exact unchanged `relimp 1.0-5` artifact passes its complete applicable generic check plan and
independent regression-importance scenarios at scoped P7. This is new source-blind compositional
evidence, not completion of pure-R package compatibility or the program objective.

The next gate is unopened `codetools 0.2-20`, frozen from official metadata and the same fixed usage
window before archive inspection. First freeze its exports, formals, help inventory, and independent
GNU R language-analysis scenarios; then execute the exact archive through the generic pipeline and
close only its first reusable browser-admissible blocker.

## Profile 0.492 codetools closure and next gate

The exact unchanged `codetools 0.2-20` artifact reaches scoped P7 after shared language-reflection
work closes missing-formal identity, reflective syntax bindings, dynamically scoped `callCC()`,
zero-argument `break`/`next` call entries, symbol `cat()`, character call-head normalization, and
`bquote()`/`match.call()` formals. Its complete applicable examples, retained tests, and independent
analysis scenarios pass without a package-specific branch.

Select the next package gate from a newly frozen usage-ranked candidate set after applying the
documented browser-purpose exclusions, unless an existing P4-P7 first blocker offers greater
semantic reach. Freeze metadata and independent GNU evidence before execution, and continue to
prefer recursive semantic closure over package or callable counts.

## Profile 0.493 stinepack closure and next gate

The newly frozen, usage-ranked `stinepack 1.5` holdout reaches scoped P7 on its first unchanged run.
Generic installation, namespace lifecycle, documentation, examples, package checks, and independent
GNU-matched interpolation scenarios pass without a runtime change or package-specific branch. This
is useful negative-blocker evidence: the existing semantics compose for a previously unseen
numerical package.

The next gate is unopened `qvcalc 1.0.4`, frozen from the same metadata and usage window before
archive inspection. Its factor-model, covariance, S3 object, and diagnostic surface has independent
GNU R expectations. Execute the unchanged archive through the generic path and close only its first
reusable blocker; do not infer broad package compatibility from the clean stinepack pass.

## Profile 0.494 qvcalc closure and next gate

The unchanged `qvcalc 1.0.4` holdout reaches scoped P7 after closing two package-neutral model
contracts: `vcov.lm()` method-level argument matching with lazy unrelated dots, and callback-driven
custom numeric-response GLM families across fitting, residuals, summaries, and predictions. Flat,
integration, recursive GNU R, package-check, and independent scenario evidence all pass.

The next increment should select a newly frozen source-blind pure-R holdout from current official
metadata and a fixed usage window, unless one of the 15 recorded blockers yields greater reusable
semantic reach. Custom-family initialization that mutates response/trial state is a known model
closure candidate. Continue to freeze public metadata and GNU expectations before opening a new
archive and never infer arbitrary-package completion from 64 scoped P7 entries.

## Profile 0.495 aod closure and next gate

The unchanged aod holdout reaches scoped P7 after reusable formula, factor, probability, S4, model,
and package-check contracts receive flat, integration, recursive GNU R, and package evidence. All
applicable examples and independent scenarios pass; Suggested MASS, boot, and lme4 paths remain
explicitly unavailable rather than silently approximated.

The next gate is unopened `trust 0.1-9`, frozen from official metadata and the fixed usage window
before archive inspection. First freeze its public surface and independently authored GNU R
trust-region scenarios, then execute the exact archive through the generic pipeline and close only
its first reusable browser-admissible blocker. The 15 existing blocked entries remain eligible when
one offers broader semantic leverage.

## Profile 0.496 trust closure and next gate

The unchanged trust holdout reaches scoped P7 after direct `stats::glm.fit` and normalized-language
`stats::D` close its ordered reusable blockers. Full generic package checks plus flat, integration,
and recursive GNU black-box evidence pass for the exact pinned artifact. The apparent later
`data.frame` and array failures were consequences of the earlier missing derivative function and
were not weakened with permissive package-specific behavior.

The next increment should choose a newly metadata-frozen source-blind pure-R holdout from a current
fixed usage window, or an existing explicit blocker when it provides greater recursive package
reach. Broader symbolic derivative tables, `deriv.default`, and remaining direct-GLM family
initialization are known candidates, but should be selected only by an ordered package blocker or a
named semantic-domain gap.

## Profile 0.497 itertools closure and next gate

The unchanged itertools holdout reaches scoped P7 after its ordered `iRNGStream` failure selects a
shared L'Ecuyer-CMRG contract. Exact seed generation, uniform recurrence, external seed restoration,
and core `parallel` stream/substream jumps now have flat, integration, recursive GNU R, and package
evidence. The package's applicable documentation/examples/checks and an independent iterator
scenario pass without package recognition or source modification.

The next gate is another metadata-frozen source-blind pure-R holdout or a higher-reach explicit
ledger blocker. Selection must again precede archive inspection. Remaining RNG engines and actual
browser parallel workers are valid candidates only when measured package reach or a named semantic
domain makes them the highest-leverage reusable closure.

## Profile 0.498 optimParallel closure and next gate

The unchanged optimParallel holdout reaches scoped P7 after closing reusable core-parallel
environment/default-cluster semantics and routing `stats::optim(method = "L-BFGS-B")` through the
existing browser Wasm backend. Flat, integration, exact recursive GNU R, package-check, example,
vignette, and independent package evidence pass for the pinned artifact.

Select and freeze the next holdout before archive inspection, then close only its first concrete
reusable blocker. Do not infer host-process parallelism or generic package completion from this
single package's browser-admissible adaptation.

## Profile 0.499 tictoc closure and next gate

The unchanged tictoc holdout reaches scoped P7 after its independent scenario, rather than its own
package check, selects `as.vector` S3 dispatch and generic-default forwarding. Flat, integration,
exact recursive GNU R, complete package-check, and independent nested stack/timing evidence pass for
the pinned artifact without package recognition or source modification.

Select and freeze the next purpose-admissible holdout before archive inspection. Keep independent
behavioral scenarios mandatory even when installed examples and tests already pass; this increment
demonstrates that package-owned checks alone can miss an important generic interaction.

## Profile 0.500 dfoptim closure and next gate

The unchanged dfoptim holdout reaches scoped P7 after its independent optimizer scenario, rather
than the standard package check, exposes terminal-singleton RNG-state consumption in default
Rejection sampling. Flat, integration, exact recursive GNU R, full package-check, all-export
optimizer, formal, and diagnostic evidence pass without package recognition or source modification.

Select and freeze the next purpose-admissible holdout before inspection. Continue treating future
RNG state as part of observable semantics; matching only the immediately sampled values is
insufficient evidence for package reproducibility.

## Profile 0.501 DFBA closure and next gate

The unchanged DFBA holdout reaches scoped P7 after shared distribution work and a reusable local
copy-on-modify optimization. Exact owner invalidation preserves aliases and promises, bounded
geometric capacity removes the package's quadratic replacement path, and the standard 66-step check
finishes without a package branch or relaxed resource limit.

Select and freeze the next purpose-admissible holdout before inspection. Continue using heavy but
browser-admissible package examples to expose asymptotic runtime defects; do not treat higher
resource ceilings as a substitute for correcting reusable semantics and storage behavior.

## Profile 0.502 lm.beta closure and next gate

The frozen unchanged `lm.beta 1.7-3` artifact reaches scoped P7 after its first example exposes
ambient inheritance from an `as.environment(list)` lookup. The empty-parent correction passes flat,
integration, exact recursive GNU R, all 19 package-check steps, and an independent weighted and
no-intercept model scenario without package recognition or source modification.

Select and freeze the next purpose-admissible holdout before inspection. Continue distinguishing
lookup-list conversion from eval/with data masks: the former has an empty parent in GNU R, while the
latter intentionally evaluates against an enclosing caller environment.

## Next gate: source-blind alabama 2025.1.0

The next holdout is frozen at P0 from metadata only. Its official 10,539-byte archive has SHA-256
`fad845617a59f67233f6e7a9355fcace4c1d2c12f750acd1de39bc7d0705d7cc`; its sole mandatory dependency is
the existing passing P7 `numDeriv` artifact. Do not inspect package source before the ordered
generic installation and execution path records the first blocker. Promote only through reusable
runtime or package-system work and independent GNU R evidence, never a package-name branch.

## Profile 0.503 alabama closure and next gate

The unchanged `alabama 2025.1.0` artifact reaches scoped P7 after selecting the reusable
`stats::nlminb`, shared `optim` control, and barrier line-search contracts. Flat, integration,
recursive GNU R, all package-check steps, and independent constrained-optimization evidence pass.

Select the next metadata-only holdout before inspection. Treat the current `nlminb` implementation
as an explicitly evidenced browser subset over L-BFGS-B, not proof of complete PORT algorithm
identity; future callers must extend controls and convergence evidence generically.

## Next gate: source-blind logging 0.10-111

The next executable holdout is frozen at P0 from metadata only. Its official 17,086-byte archive has
SHA-256 `019bd366f14c9702378b74d0f2babd14497448f8792ccd45d1846cddd3104f59`; its mandatory closure
contains only browser-core `methods`. Do not inspect package source before the ordered generic
installation and execution path records the first blocker. Promote only through reusable runtime or
package-system work and independent GNU R evidence, never a package-name branch.

The ordered run has selected `methods::functionBody` as the first blocker after installation,
namespace, attachment, documentation, and seven example topics pass. Close the GNU-observed closure
body and default-call contract with flat, integration, and recursive differential evidence, then
resume the unchanged package plan from `example:setMsgComposer`.

## Profile 0.504 logging closure and next gate

The unchanged `logging 0.10-111` artifact reaches scoped P7 after the reusable
`methods::functionBody` contract closes its only ordered blocker. Flat, integration, recursive GNU,
all package-check steps, and independent handler/level/composer evidence pass.

Select and freeze the next metadata-only holdout before inspection. Continue prioritizing reusable
function reflection, namespace, reference-object, and condition semantics exposed by unchanged
packages rather than adding isolated callable names.

## Profile 0.505 latex2exp closure and next gate

The unchanged `latex2exp 0.9.8` artifact reaches scoped P7 after the source-blind run selects two
reusable gaps: punctuation identity escapes inside bracket expressions and the public
`rbind.data.frame` method. Flat, integration, exact recursive GNU, all 18 generic package-check
steps, and an independent conversion/custom-command/supported-table scenario pass without package
recognition or source modification.

Select and freeze the next metadata-only holdout before inspection. Continue using independent
scenarios after generic package checks: this rotation demonstrated that a green package-check plan
can still miss a public export path and must not alone be treated as mature package evidence.

## Next gate: source-blind enrichwith 0.5.0

The next executable holdout is frozen at P0 from metadata only. Its official 126,233-byte archive
has SHA-256 `fd1c07136409b40bf8246400ef784bacfe74a8a0db19fa695a80a38b46e46e07`; it declares no
mandatory package dependency or import. Do not inspect package source before the ordered generic
installation and execution path records the first blocker. Promote only through reusable runtime or
package-system work and independent GNU R evidence, never a package-name branch.

The ordered run now reaches development P4. Its deterministic artifact is
`dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612`; installation through complete
help coverage and multiple examples pass. `example:enrich.family` selects closure-to-language
conversion as the first reusable blocker. Measure that contract against GNU R before implementation;
the later missing `stats::make.link` binding remains secondary until the first blocker closes.

The shared language bridge now preserves recursive runtime values and object identity through
runtime-created calls, with flat and exact recursive GNU evidence. The package example passes and
selects the next ordered reusable blocker: the complete standard `stats::make.link` constructor
contract, not a package-specific `logit` substitute.

## Profile 0.506 enrichwith P7 and next rotation

The shared stats/model layer now exposes all nine standard `stats::make.link` constructors and
reuses their link functions, inverse functions, derivatives, and validity predicates inside family
objects. The unchanged artifact passes its complete applicable plan and a separate link/family/lm
scenario at scoped P7. Corpus totals are 130 releases: 115 passing, 15 blocked, none unevaluated,
and 76 at P7.

Freeze the next purpose-admissible metadata-only holdout before archive inspection. Continue the
same ordered cycle: generic execution, exact first blocker, reusable semantic repair, differential
evidence, full rerun, and independent scenario. Do not infer arbitrary package compatibility from
this promotion.

## Profile 0.507 regression-selected source reconstruction closure

The reviewed artifact-fingerprint refresh exposed a real namespace blocker in unchanged lambda.r,
then in its futile.logger and VennDiagram dependency chain. The shared repair recovers semicolon
parse-data terminals, uses GNU multiline deparse for custom-infix blocks, and preserves the original
dots position during S3 bind dispatch after ignored `NULL` arguments. All three targeted unchanged
package checks pass without package recognition.

Continue with the remaining explicit first blockers from the complete 130-release corpus rerun. Do
not treat restoration of this dependency chain as program completion or skip the independent
semantic and package partitions.

## Profile 0.509 compatibility gate

The former ellipse `arima0` blocker is closed through shared Stats, NLS, and core-data contracts.
The pinned artifact's next ordered gate is its guarded Suggested MASS dependency for `profile.glm`.
Treat that as dependency-closure evidence: do not copy the MASS method into core Stats. Continue
prioritizing broader semantic blockers and generic pure-R dependency installation; native or
mixed-code dependency work remains in the later ABI phase.

## Profile 0.511 compatibility gate

Profile 0.511 completes browser polygon lowering for colored `persp` surfaces with differential
graphics evidence and advances unchanged `shape` to missing `graphics::filled.contour`. Implement
that reusable contour-layout contract or the independent `gridGraphics::coplot` conditional-panel
contract according to measured package reach. Neither gate may be bypassed by accepting but not
drawing requested graphics.

## Post-0.512 source-blind diagram gate

Profile 0.512 closes the shared `graphics::filled.contour` layout, band-clipping, device-journal,
and Worker rendering contract and advances unchanged `shape 1.4.6.1` to scoped P7. The next
metadata-only holdout is unopened `diagram 1.6.5`, selected from the fixed 2026-07-29 through
2026-08-27 window as the highest-ranked purpose-admissible executable candidate with a closed
mandatory dependency set. Its official 536,872-byte archive is frozen outside Dropbox at SHA-256
`e9c03e7712e0282c5d9f2b760bafe2aac9e99a9723578d9e6369d60301f574e4` before archive inspection or
execution. Run it unchanged through the generic pipeline and record the first reusable blocker; do
not infer broader graphics or arbitrary-package closure from the passing shape artifact.

## Profile 0.513 diagram gate result

The scheduled unchanged `diagram 1.6.5` run is complete at scoped P7. Generic LazyData mapping,
line-end semantics and rendering, `format.pval()`, plot title controls, recursive text labels, and
zero-row data-frame construction close its ordered reusable blockers. All applicable installed
examples, help/export coverage, namespace/attachment checks, the prebuilt vignette, and an
independent plotting scenario pass. Continue by selecting the next metadata-frozen package or
highest-leverage ledger blocker; do not generalize this result to arbitrary pure-R packages.

## Post-0.513 source-blind plotmo gate

The official `plotmo 3.7.1` archive is frozen at SHA-256
`c5ffd8b2a5e2156ab4182ae1f8501850eb60b72aba1cb5ca185e6661854e86cf` after metadata-only selection
from the fixed 2026-07-31 through 2026-08-29 window. Its first execution moved it from holdout to
development. The unchanged source and passing `Formula`/`plotrix` closure produce deterministic
artifact SHA-256 `b14ec30d18a30e3e802d5650ef5b9e9b744e18051cde38d5db4acb886c1f5d21`.

Profile 0.514 closes the first two ordered namespace blockers with reusable
`grDevices::as.graphicsAnnot` and `stats::hatvalues` contracts. The artifact remains at P1 because
its next declared import is the missing `stats::qqline`; do not inspect later package behavior until
that shared blocker is closed and the unchanged artifact is rerun.

## Profile 0.516 plotmo gate result

The unchanged plotmo artifact now passes the complete applicable generic package-check plan at P6.
The next ordered task is its independently authored P7 blocker: determine why the multi-predictor
`plotmo()` path supplies a non-atomic value to Base `abbreviate()`, compare the underlying
colname/coercion behavior with GNU R 4.6.1, and close only the reusable semantic cause. Do not add a
plotmo-specific branch or infer arbitrary pure-R package compatibility from the P6 result.

## Profile 0.517 plotmo gate result

The reusable blocker was `abbreviate(levels(numeric.predictor), ...)`: GNU R coerces the resulting
`NULL` through `as.character` to a named zero-length character vector. The generic coercion repair
also covers recursive values and S3 methods. The unchanged artifact now passes its independent
multi-predictor scenario and complete applicable generic plan at scoped P7. Continue with the next
highest-leverage recorded semantic or package blocker; do not generalize this pinned result to
arbitrary pure-R packages.

## Profile 0.518 gridGraphics gate result

The package-neutral numeric `graphics::coplot` slice advances unchanged `gridGraphics 0.5-1` through
its former callable blocker. Retained `demo-graphics.R` expression 27 now stops at missing
`datasets::quakes`. Keep the artifact at P5 and retain `coplot` at shape-level until the wider
conditioning, panel, layout, and axis surface has evidence.

The next ordered task is a clean-room and bundle-safe `quakes` admission audit. The public object is
a 1,000-row factual catalog attributed to the Harvard PRIM-H project and Dr. John Woodhouse; do not
copy a GNU R data file or an R-derived mirror. If no independently auditable redistribution basis
and resource delivery path can be established, record the provenance blocker and rotate to another
high-leverage semantic gate instead of weakening the policy.

## Profile 0.519 rbenchmark gate result

The former rbenchmark step-limit gate is closed without increasing global limits or recognizing the
package in production code. The generic runtime now completes its full installed example and the
pinned artifact reaches P7. Continue rotating to the highest-leverage recorded first blocker; do not
infer general package maturity from one additional P7 artifact, and keep the unresolved quakes
provenance gate separate from this semantic/performance closure.

## Profile 0.520 invgamma gate result

The usage-ranked `invgamma 1.2` holdout reaches scoped P7 through generic distribution and package
machinery. Its ten-million-element example uses the existing opt-in `large-browser` vector ceiling
with an explicit 100,000,000-step bound; interactive-safe and package-test defaults remain intact.
Continue by freezing the next purpose-admissible pure-R holdout before inspection, and retain the
MASS/native and quakes/provenance blockers as explicit later-phase boundaries.

## Profile 0.521 entropy gate result

The metadata-frozen `entropy 1.3.2` holdout reaches scoped P7 through the generic package pipeline
after selecting and closing reusable Pearson chi-square behavior. All applicable package checks and
an independent statistical/discretization scenario pass without source rewriting or package-name
logic. Rotate to another metadata-frozen pure-R holdout or higher-reach recorded first blocker next;
keep `quakes` provenance/delivery, native dependencies, and broader statistical closure explicit
rather than inferring them from this package result.

## Profile 0.522 simulated chi-square gate result

Fixed-seed integer-count goodness-of-fit and fixed-margin contingency Monte Carlo paths now match
the advisory oracle, including RNG advancement. This closes the recorded reusable simulation gap;
non-integral coercion corners remain explicit. Continue with a newly frozen source-blind holdout or
a higher-reach recorded blocker, without weakening the independent provenance and native-package
gates.

## Profile 0.523 package-reuse gate result

`profileModel 0.6.2` reached scoped P7 through shared formula-language, matched-call, and
model-offset semantics. The next rotation should freeze a new purpose-admissible pure-R holdout from
the same reproducible ranking process, while preserving separate development, regression, and
holdout partitions and the GNU R 4.6.1 release gate.

## Profile 0.524 package-reuse gate result

The rotation retained `aplpack 1.3.5` as explicit P1 Tcl/Tk platform-boundary evidence, then froze
and evaluated `nor1mix 1.3-3`. Shared multinomial, direct-mean, Summary-NULL, and optional-example
contracts move nor1mix to P4. The next highest-leverage ordered blocker is reusable call-valued
`stats::deriv` behavior; it must be implemented with GNU differential evidence rather than an
example bypass or placeholder gradient.

## Profile 0.525 package-reuse gate result

Reusable call-valued symbolic differentiation, warning-condition capture, deprecation conditions,
and BFGS trace controls remove four successive unchanged-nor1mix blockers. The next recorded first
blocker is the Sheather-Jones `density.default(bw = "sj")` selector in `example:norMixFit`.
Implement that bandwidth-selection contract with GNU differential evidence before rotating the
package; do not add a nor1mix-specific branch or claim P5 from the already passing examples.
