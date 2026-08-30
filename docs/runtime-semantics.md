# Runtime semantics

Atomic scalars are length-one vectors. Logical, integer, double, and parallel-real/imaginary complex
vectors use typed storage plus an independent missing mask, so R NA and IEEE NaN remain distinct.
Raw vectors use byte storage and, like GNU R raw values, have no NA representation. Character
vectors use immutable string storage and the same mask rule. Each character element also owns its
exact byte sequence and one canonical R encoding mark (`unknown`, `latin1`, `UTF-8`, or `bytes`).
ASCII and missing strings are always marked `unknown`. Lists and attributes are immutable values;
environment bindings are mutable references to those values.

`rawToBits()` expands each raw byte into eight raw 0/1 values, least-significant bit first. It drops
input attributes, maps an empty raw vector to an empty raw vector, and rejects non-raw inputs before
allocation. This is the exact bit layout consumed by openssl's measured `as.logical(rawToBits(rnd))`
example.

The environment chain is `empty <- base <- global`. Closures capture their defining environment.
Supplied and default arguments are lazy memoizing promises. Argument matching runs exact names,
unique partial names, and positional arguments in GNU R order; formals after ellipsis require exact
names. Omitted/defaulted argument state survives forwarding for `missing()`. Ellipsis preserves lazy
promises, may be forwarded, and supports later exact-named formals.

`force()` memoizes a promise through the ordinary evaluator, while `forceAndCall()` eagerly forces
only its requested leading arguments and preserves the remaining call arguments as promises.
`do.call()` constructs a call from an ordinary list without converting source into JavaScript and
uses `envir` as the dynamic caller/evaluation environment. Already-forced values retain normalized
syntax metadata, allowing special forms such as `on.exit` to capture a language value instead of
forcing it. `quote = TRUE` and pairlist argument containers remain outside this increment.
`delayedAssign()` installs a memoizing promise with distinct evaluation and assignment environments.
Calls that evaluate multiple arguments do so from left to right rather than forcing them
concurrently. `withVisible()` evaluates its one lazy argument exactly once and returns a named
`value`/`visible` list. First forcing propagates assignment, `invisible()`, closure, block,
ellipsis, and dynamic evaluation visibility; reading a promise that was already forced is visible,
matching GNU R's promise boundary.

`strftime()` converts numeric, Date, POSIXct, POSIXlt, and custom S3 inputs through owned
`as.POSIXlt` dispatch, recycles `x` and `format`, and emits deterministic UTC/GMT C-locale text. The
supported token subset includes calendar, clock, weekday/month, week number, epoch, timezone, and
fractional-second forms; named time zones and host locale databases remain explicit boundaries.

Arithmetic, comparison, and logical operations are vectorized. Shorter operands recycle, with one
`NRW1001` warning when lengths are not multiples. NA propagates through arithmetic; ordinary NaN
stays NaN. Comparisons produce unknown for NA/NaN. `!`, `&`, and `|` use three-valued logic; `&&`
and `||` are scalar and short-circuit. Complex values support arithmetic, equality, logical
coercion, core component helpers, indexing/replacement, and Worker transport; the full GNU R complex
mathematics surface is not yet implemented. Binary arithmetic preserves and combines attributes from
conforming arrays and the longer/equal-length operand using GNU R's precedence rules; arrays retain
dimensions, reject non-conformable shapes, and suppress ordinary vector names.

Raw values support construction/coercion, concatenation, comparison, bytewise `!`/`&`/`|`,
selection/replacement, shifts, integer-bit expansion, exact character-byte conversion, and Worker
transport. `Encoding()` and `Encoding<-` query or replace per-element marks without discarding the
stored bytes; valid replacement labels recycle without warning, while unrecognized labels become
`unknown`. `enc2utf8()` converts Latin-1-marked text to UTF-8 bytes and preserves byte-marked text;
`enc2native()` uses UTF-8 as NativR's deterministic browser-native encoding. Subsetting,
replacement, concatenation, attributes, and XDR serialization preserve marks and bytes. General
`iconv`, locale-dependent native encodings, Unicode normalization, malformed-sequence display, and
every encoding-sensitive string operation remain incomplete.

`base::replace(x, list, values)` forces its three arguments, leaves `x` unchanged, and returns the
result of the runtime's immutable one-dimensional subset replacement. Numeric/logical/character
subscripts, names and extension, atomic promotion, ordinary recycling warnings, dimensions, factors,
lists, pairlists, owned data frames, and `NULL` deletion share the direct `[<-` path. Replacing into
`NULL` first materializes an empty atomic/list target from `values`; a `NULL` subscript preserves
that empty target. Direct `NULL[...]`, `NULL[[...]]`, and `NULL$name` extraction returns `NULL`
while still forcing every supplied subscript/control expression. `[<-`, `[[<-`, and `$<-` promote a
`NULL` target with GNU R's atomic/list type, typed-gap, length, and name rules; a logical
replacement index can therefore extend through false positions and fill them with the target's
missing representation. Expression vectors and arbitrary class-specific `[<-` methods remain outside
the owned path.

`typeof`, `mode`, and the core `is.*` predicates inspect NativR storage without exposing parser
nodes. Registered builtins carrying ordinary R-level `formals` report `typeof = "closure"`; true
primitive and special builtins retain their GNU R storage labels. `as.logical`, `as.integer`,
`as.double`/`as.numeric`, and `as.character` cover NULL and atomic vectors, including factors,
complex imaginary-discard warnings, integer-range warnings, and NA-versus-NaN handling. Coercions
drop attributes as GNU R does. `as.character` also decomposes symbols/language and deparses
expression/list/pairlist elements for package metaprogramming. Locale- and option-dependent
number-to-character formatting and complete recursive/S3 coercion remain incomplete.

`logical`, `integer`, `double`/`numeric`, `character`, and `vector` allocate zero-filled vectors
through the same resource-accounted storage model. `vector("expression", n)` allocates NULL-filled
owned expression vectors. `length` covers vectors, NULL, formulas, functions, and environments;
`lengths` vectorizes that operation over lists and expression vectors. Matrix, array, data-frame,
factor, and recursive-value predicates inspect owned dimensions/classes rather than host JavaScript
shapes.

`body()` converts a closure's normalized AST node back to the corresponding public R object:
identifier bodies are symbols, scalar literal bodies retain their atomic storage mode, and compound
calls/blocks are language objects. It never exposes the AST itself. `formals()` returns `NULL` for a
zero-argument closure and a tagged pairlist only when parameters exist. Recursive Oracle v2 observes
these values together with closure environments, captured bindings, parent chains, environment
cycles, attributes, and shared identity.

Quoted identifiers are owned symbol values and quoted compound syntax stores only the normalized
NativR AST. `quote()` observes an argument promise without forcing it; `eval()` sends symbol lookup
or language/expression interpretation back through the ordinary evaluator and its resource limits.
`expression()` captures syntax without forcing it; `as.name`/`as.symbol`, `as.expression`, `call`,
`as.call`, `deparse`, and `deparse1` provide bounded construction and inspection. A list may contain
a closure as its `as.call()` head; the resulting call retains the closure as an owned runtime
constant and invokes it through the ordinary evaluator. `substitute()` walks owned syntax without
forcing source promises, replaces bindings from the current closure frame or a named list/data
frame, and expands ellipsis arguments. An explicitly supplied global environment retains GNU R's
special non-substitution behavior. No source is converted into or executed as JavaScript. Worker
results deparse language and expression values into stable diagnostic strings rather than exposing
parser nodes. `parse(text=)` joins atomic input elements with newlines, returns an owned expression
vector, honors `n`, and can stop before a later syntax error once the requested number of complete
top-level expressions has been collected. `n = 0` does not inspect the input. Parser-backed
JavaScript symbol/language/expression records round-trip through `assign` and `call`. `source()`
accepts owned file and connection input. With `keep.source = TRUE`, closures created by the sourced
text receive an eight-field `srcref` whose `srcfile` is an owned `srcfilecopy` environment.
`sys.source(..., keep.source = TRUE)` and complete GNU R source-retention behavior remain outside
this bounded claim. `match.call()` uses the active closure's already-computed argument matching to
canonicalize supplied names, omit unused defaults, and optionally retain dots as a pairlist-shaped
call. Root, child, parent, current-frame, and closure environments are available for lexical
evaluation. Environment `$` and character `[[` read or replace bindings; `get`, `get0`, `mget`,
`exists`, and `assign` support explicit environments and inherited lookup, while `list2env`,
`as.environment`, `environmentName`, and `as.list.environment` cover initial conversion and identity
operations. Environment-to-list conversion enumerates only local bindings, optionally includes
dot-prefixed names, sorts before forcing when requested, and preserves the runtime's hash-aware
unsorted order. The `as.list` entry point performs S3 dispatch. As in GNU R, `exists(mode = "any")`
detects an unforced delayed binding without forcing it and explicitly supplied `get0(ifnotfound=)`
and `mget(ifnotfound=)` values are evaluated even when every requested object exists. `mget()`
preserves duplicate and missing requested names, forces selected promises and active bindings,
filters by mode, optionally inherits, and invokes callable fallbacks with the missing name.
`lockEnvironment()` prevents adding or removing bindings while permitting replacement of existing
unlocked bindings; `lockBinding()`, `unlockBinding()`, `bindingIsLocked()`, and
`environmentIsLocked()` expose the corresponding reference-semantics state. `makeActiveBinding()`
stores a callable rather than a value; identifier, `$`, `[[`, `get`, `get0`, `.subset2`, and
environment-to-list reads invoke it with no arguments, while evaluator assignment, `assign()`, and
the async JavaScript `r.assign()` API invoke it with the replacement value and discard the callback
result. `bindingIsActive()` and `activeBindingFunction()` inspect the binding without forcing it,
and ordinary binding locks also protect active writes. Active-binding substitution, namespace
mutation, arbitrary numeric search positions, and exact GNU R hash-bucket enumeration order are not
implemented. Evaluator-native syntax does not yet reproduce GNU R's primitive-binding lookup
failures when an evaluated expression's environment chain ends directly at `emptyenv()`. Pairlists
are distinct runtime values with exact tags; `pairlist`, `as.pairlist`, `is.pairlist`, `as.list`,
`vector("pairlist", n)`, `length`, type/mode inspection, `alist`, and Worker transport use that
value model. Pairlist `[`, `[[`, and `$` extraction follows the measured GNU R list-return and
unique-partial-name behavior. `[[<-` and `$<-` preserve pairlist type, `[<-` converts to an ordinary
list, and names, arbitrary runtime attributes, classes, dimensions, dimension names, and implicit
matrix/array classes are retained or dropped along the measured GNU R paths. GNU R's `lengths()`,
`is.matrix()`, and `is.array()` rejection/false results for pairlists are preserved. This increment
does not yet provide `bquote`, pairlist rectangular replacement or every extension edge case,
generic pairlist attributes across the public snapshot, inherited substitution lookup, alternate
`match.call` definitions/calls/environments, full language indexing/attributes, list/data-frame
evaluation environments, source-reference preservation, or file/connection-driven parsing.

`textConnection()` supplies an always-open, session-owned input connection backed by a copied
character vector. `source()` reads such connections or browser-owned virtual/package paths, parses
the complete program before running any expression, and then evaluates sequentially in the global,
caller, or explicit environment. It returns an invisible named list containing the last value and
its visibility; bounded echo and visible-result printing use ordinary runtime output and S3 print
dispatch. `chdir = TRUE` temporarily selects the source file's virtual directory. Output text
connections, network URLs, host paths, source-reference retention, abort continuation, and exact
console deparse layout remain unsupported.

Identifier and direct replacement assignment accept `<-`, `=`, `->`, `<<-`, and `->>`. Non-local
assignment searches lexical parents and falls back to the global environment without mutating locked
built-in bindings.

Simple one-dimensional `$`, `[`, and `[[` replacement chains rebuild each containing value back to
an identifier root. They support local and non-local rebinding, data-frame column mutation, NULL
deletion, and `$`-driven creation of a missing list intermediate. Intermediate subscript expressions
are evaluated again while rebuilding the chain, matching GNU R's observable side effects. An
intermediate multidimensional selection remains unsupported.

Data-frame member replacement admits ordinary atomic columns, equal-length list columns, scalar
list-column recycling, and pairlist-to-list normalization. Expression vectors are preserved as
expression columns and singleton expressions recycle by row. `[[<-` treats a list replacement as one
recursive column, while `[<-` distributes a list across selected columns. Incompatible row counts
fail with bounded row, column, and replacement-length diagnostics rather than silently producing a
malformed frame.

Direct replacement-function targets invoke a registered `<-` function and rebind their first
identifier. `names<-`, `attr<-`, `class<-`, and `dim<-` cover exact non-missing names, arbitrary
owned vector attributes, explicit classes, and validated dimensions in both assignment directions.
Assigning non-NULL dimensions clears both `names` and `dimnames`, even when the extents are
unchanged, while retaining unrelated attributes; assigning NULL removes `dim` and `dimnames`. Nested
replacement-function targets and short-name padding for `names<-` remain incomplete.

`make.names()` coerces atomic and scalar-list inputs to an attribute-free character vector, applies
the deterministic C-locale ASCII/UTF-8-byte syntax rules, repairs reserved words and missing names,
supports the legacy `allow_` switch, and gives already-legal names priority when `unique = TRUE`.
Tibble construction accepts a callable or one-expression formula `.name_repair`; formula callbacks
receive the candidate names as `.` in their captured environment.

`start()` and `end()` share a validated time-series coordinate path. Unclassed nonempty inputs use
row-based `(1, 1)` and `(NROW, 1)` coordinates. Valid `tsp` metadata produces period/cycle
coordinates when the selected endpoint and positive integer frequency fall within `ts.eps`; other
frequencies or off-grid endpoints remain decimal scalars. Each generic performs its own S3 method
dispatch before the default path.

`time()` uses the same validated `tsp` interval model to generate one double coordinate per row.
Ordinary vectors and matrices use `1:NROW`; regular series advance by `1 / frequency`, add
`offset / frequency`, and snap coordinates within `ts.eps` of an integer. The result carries the
unshifted `tsp` triple and class `ts` when the input belongs to that class. Custom methods receive
the original lazy arguments before this default path, providing the package boundary used by zoo.

`stats::ts()` creates an owned equispaced-series value rather than a host object. It converts one-
or two-number calendar coordinates into a decimal start, derives or validates the observation count,
recycles or truncates each series by rows when an explicit end is supplied, and attaches `tsp` plus
the requested/default `ts` or `mts` class. Matrix columns remain independent series and receive
stable series names. `as.ts()`, `frequency()`, `deltat()`, and `cycle()` perform S3 dispatch first.
The first two defaults respect validated existing `tsp` metadata and otherwise use row coordinates
with frequency one. `deltat()` returns the reciprocal of validated `tsp` frequency, or one for
inputs without that metadata; unused default-method dots remain lazy. `cycle()` emits one double
observation number per vector element or matrix row, retaining the validated interval and explicit
`ts` class while supporting fractional frequencies.

`stats::embed(x, dimension)` converts a supported vector or two-dimensional matrix into a
column-major lag matrix. Output columns are ordered by current observations first and progressively
older observations after them; each source matrix column remains adjacent within a lag. The result
retains the source vector storage type (including ordinary list vectors), removes names, dimensions,
classes, `tsp`, and other source attributes, then installs only the result dimensions. Integer and
logical matrices use GNU R's double result storage, and factor matrices use character labels;
double, complex, and character matrix storage remains unchanged. Fractional dimensions reproduce the
measured GNU R vector behavior; nonempty matrices require an integer dimension. Invalid, empty,
classed non-`ts` vectors, factor vectors, data frames, expression vectors, higher arrays, raw/list
matrices, and the complete result length fail or are limited before allocation.

`stats::filter()` operates on owned regular time-series data. Convolution supports `sides = 1` or
`2`, optional circular indexing, empty coefficient vectors, and independent matrix columns;
unavailable boundary windows and windows containing `NA` or `NaN` produce `NA`. Recursive mode uses
each coefficient against prior output, accepts one initial history value per coefficient, and
propagates missing history forward. Results are double `ts` or `mts` values with validated or
row-based `tsp` metadata. Atomic vectors and two-dimensional matrices are supported; data-frame
coercion, complex filters, higher arrays, and irregular-series package methods remain outside this
path.

`base::findInterval(x, vec, ...)` flattens supported atomic inputs through the runtime's double
coercion path, validates `vec` as weakly increasing with no missing values by default, and returns
an unattributed integer vector with one interval index per `x` value. The default uses left-closed,
right-open intervals; `left.open`, `rightmost.closed`, and `all.inside` apply the documented
boundary transformations, including duplicate and infinite breakpoints. Missing and `NaN` queries
produce integer `NA`. Each query uses checkpointed binary search, while sortedness checking is
linear. `checkSorted = FALSE` skips validation only as documented; behavior for unsorted or missing
breakpoints is deliberately not claimed. `checkNA = FALSE` retains deterministic missing propagation
in the browser. Recursive-list coercion remains unsupported.

`stats::window()` also dispatches before its owned default. For regular vector or matrix series it
aligns boundaries to source observations, samples only integral divisors of the source frequency,
preserves series classes and column names, and computes a new exact `tsp`. Incompatible frequency
requests retain the source frequency with a warning. Boundaries outside the source interval clamp
with warnings unless `extend = TRUE`, in which case missing rows use the source vector's typed
missing representation.

`na.omit()` performs S3 dispatch before its owned default path. Atomic vectors remove missing
elements, while matrices and data frames remove any row containing an explicit `NA` or ordinary
`NaN`; factors retain levels and class, and rectangular results retain adjusted dimensions,
dimension names, column classes, and row names. A removal adds one-based source positions to a
class-`omit` `na.action` attribute, named by source element or row labels when available. Regular
`ts` values may trim incomplete observations only from their leading or trailing edge and receive an
adjusted `tsp`; all-missing or internally missing series error. Ordinary lists and arrays whose rank
is not two remain unchanged, matching the covered default behavior. Dots stay lazy unless a
package-defined method consumes them.

`switch` forces only `EXPR` and the selected alternative. Character selection supports exact names,
one unnamed default, and missing-alternative fall-through; numeric selection truncates toward an
integer position. Full GNU R result-visibility behavior for an unmatched switch remains incomplete.

`if` and `while` require one non-missing logical or numeric condition. `return` unwinds its matching
closure. `for` iterates vectors and lists. `while` and `repeat` use lexical `break`/`next`
boundaries. Every operation remains subject to step, call-depth, vector-length, allocation, output,
timeout, and cancellation limits.

Finite sequences use `:`, `seq`, `seq_len`, and `seq_along`. `rep` supports scalar or per-element
`times`, `each`, and `length.out`; `rep_len` enforces the requested result length.

One-dimensional `[` supports positive, negative, zero, logical, double-subscript truncation, and
exact character selection. `[[` selects one element or follows a recursive numeric/character path;
`exact = FALSE` enables unique partial character matching and `exact = NA` additionally emits
`NRW1008`. `$` first uses an exact name and then GNU R's default unique partial match, returning
NULL for ambiguity. One-dimensional `[<-` and `[[<-` extend atomic vectors and lists through
positive, long logical, or new character-name subscripts. Atomic gaps receive typed missing values
(zero bytes for raw vectors), list gaps receive NULL, names grow with empty or requested entries,
and invalidated `dim`/`dimnames` attributes are removed. Missing numeric/logical positions are
skipped for a scalar replacement and rejected for longer replacements. Missing character replacement
names are not yet represented. Arrays of any positive dimension count support rectangular `[`/`[<-`
and exact `[[`/`[[<-` in column-major order. Axis bounds, logical recycling limits, non-finite
numeric coercion warnings, zero-length axes, `drop`, dimension names, and named dimension axes
follow the executable GNU R cases. One-dimensional arrays retain or derive their names from their
sole dimension-name axis. Numeric and character coordinate matrices select or replace one array
element per row; numeric zero rows are skipped, missing coordinates propagate during extraction and
are skipped during replacement, and the result is an ordinary vector. Matrices and data frames
support their two-dimensional selection and replacement paths. Selection preserves relevant
class/level/row-name metadata. List `$<-`, `[[<-`, and `[<-` delete selected components when the
replacement is NULL. One-dimensional data-frame replacement appends consecutive numeric or named
columns, recycles scalar columns, distributes atomic replacements column-major, and rejects holes.
Rectangular replacement can extend numeric or character-named rows, grows every column with its
typed missing representation, derives numeric gap row names, preserves requested character row
names, accepts atomic or per-column list replacements, and can create a row and column together.
Logical row overrun and missing row subscripts are rejected. Extending an extracted column through a
nested `$`/`[[` chain remains an incompatible column-length error, matching GNU R. Factor
replacement preserves its integer-code/level model, maps labels from ordinary or factor
replacements, fills extension gaps with missing codes, and emits `NRW1009` for invalid levels. Data
frames also accept numeric or character coordinate matrices for cell extraction, coercing the frame
to one common atomic output type as GNU R does. Numeric coordinate matrices support cell
replacement; GNU R's rejection of character, missing, or zero-coordinate replacement matrices is
preserved. Global partial-match warning options, multidimensional intermediate replacement targets,
nested replacement-function calls, and rectangular pairlist replacement are not performed.

Matrices and arrays are vectors with validated integer dimensions and column-major storage.
Dimension names, named dimension axes, `rbind`, `cbind`, matrix conversion, and
arbitrary-dimensional array operations use that same value model. Friendly JavaScript results are
flattened; `evalRaw` preserves dimensions and attributes. `drop()` removes every extent of length
one without copying element storage. Two or more surviving axes retain adjusted `dim`/`dimnames`;
one surviving axis becomes a named vector; and an all-singleton scalar receives names only when
exactly one source dimension-name component is non-NULL. Custom classes, factor levels, and
unrelated attributes survive the shape change.

`cbind(..., deparse.level = 1)` and `rbind(..., deparse.level = 1)` retain cross-axis names from
vectors or matrices and compose the bound axis from existing matrix dimnames, explicit argument
tags, simple-symbol labels, or level-2 deparsed expressions. This is the generic matrix-label path
used by unchanged package code; it is not a package-specific post-processing step. Bound arguments
force once in source order, so multiple arguments can safely share the same still-lazy promise and
observable forcing effects remain deterministic.

`nchar(x, type = "chars", allowNA = FALSE, keepNA = NA)` coerces atomic, bounded list/pairlist,
symbol, call, and expression inputs through the owned character model. `chars` counts Unicode scalar
values, `bytes` counts exact stored bytes, and `width` uses an additive browser-owned Unicode
code-point width table. Missing-value handling follows the type-dependent `keepNA` rule; marked
`bytes` and invalid UTF-8 inputs fail or become missing according to `allowNA`. Names, dimensions,
and dimension names survive while custom class/attributes drop. Locale-specific width tables and
complete Unicode-version identity outside the differential corpus remain explicit boundaries.

First-class closure-like builtins may carry ordinary attributes, so
`structure(identity, class = ...)`, `attr<-`, class dispatch, and later calls operate on the same
callable value. `which()`, `which.min()`, and `which.max()` preserve selected input names, and
comparison results preserve structural names/dimensions; these shared rules close named lookup paths
used by package code.

`as.array()` is an S3 generic with an independently registered `as.array.default`. Package-defined
methods receive the classed object plus unforced dots, which covers rstan's measured
`as.array(fit, ...)` extension shape without implementing Stan objects in the runtime. The default
returns existing arrays unchanged; otherwise it adds a one-dimensional extent to atomic vectors,
lists, factors, or pairlists, promotes vector names to a one-axis `dimnames` component, and retains
other attributes. Expression-vector coercion remains outside this bounded increment.

Data frames are classed named lists with automatic or validated explicit row names and equal-length
atomic columns after documented recycling. `data.frame()` exposes GNU R's exact trailing control
formals after `...`; `row.names` is never mistaken for a data column, explicit atomic row names are
coerced to text, and missing, duplicate, or incompatible-length row names fail before construction.
Default `check.names = TRUE` applies the owned syntactic/unique name repair, while
`check.names = FALSE` preserves supplied column tags. They support rectangular and coordinate-matrix
selection/replacement plus column extraction. `tibble` and formula-header `tribble` construct
stricter frame shapes without importing external packages. `check.rows`, `fix.empty.names`, and
legacy `stringsAsFactors = TRUE` breadth beyond current atomic-column construction remain
incomplete.

Factors are integer codes plus levels and class metadata. Construction supports explicit levels,
labels, exclusions, ordering, and level dropping. Factor selection retains class and levels.
`as.ordered()` builds the same owned representation with `c("ordered", "factor")`; the installed
lowercase `letters` constant supplies the measured generics input. Existing ordered factors return
unchanged, ordinary factors lose unused levels while retaining names, and package-defined S3 methods
are checked before the default path. Atomic defaults share the factor level-ordering rules;
recursive container coercion remains outside the bounded slice.

String helpers use browser-safe JavaScript operations without dynamic evaluation. Paste, formatting,
bounded regular expressions, splitting, substring operations, character translation, case
conversion, and Unicode code-point length are vectorized. Locale-sensitive behavior is not claimed.
`nzchar` performs internal-style character coercion for owned atomic and bounded recursive values,
then returns an attribute-free logical vector. Its primitive call path preserves the observed
one-/two-argument positioning and `keepNA` controls whether coerced missing atoms remain missing or
count as nonempty.

`print()` emits deterministic stdout text for NULL, atomic vectors, basic names, two-dimensional
atomic matrices, lists, and NativR data frames, returning its input invisibly. `cat()` concatenates
NULL and atomic inputs with vectorized separators and returns invisible NULL. Output is collected by
the evaluation context, transported as ordered Worker events, retained by `evalDetailed`, and
charged against `maxOutputBytes`; `cat(file=)` can instead write a supported virtual path or file
connection. General S3 print methods, console options, line filling, and host filesystem output
remain outside this increment.

Graphics output uses a second ordered journal on the same evaluation context. `plot.new()` starts an
owned page, `plot.window()` records finite linear x/y limits, and `graphics::axTicks()` derives GNU
R-shaped linear tick locations for either axis from that state. Explicit finite
`axp = c(start, end, intervals)` works without a device when `log = FALSE`; the interval count is
converted with the GNU R-observed `floor(abs(intervals) + 0.25)` rule and bounded by
`maxVectorLength`, reversed endpoints retain their order, and unused linear `usr`/`nintLog` promises
remain lazy. Logarithmic axes are an explicit unsupported boundary. `grDevices::as.raster()`
converts character capture matrices, grayscale logical/numeric/raw values, and numeric/raw RGB(A)
planes into row-first classed character rasters. It drops source names/dimnames, supports vector
`nrow`/`ncol` reshaping, preserves missing grayscale pixels, performs S3 dispatch, and returns
existing raster values unchanged. `rasterImage()` consumes those values plus supported
matrix/array/native-raster inputs as row-major RGBA commands with recycled positions.

`graphics::axis()` consumes the same owned linear window. Omitted `at` uses its `axTicks()` spacing;
explicit locations are numeric-coerced and sorted for the invisible return while non-finite and
out-of-window positions are omitted from drawing. Sides 1:4, numeric/default/character/no labels,
secondary axes, `tcl`, `cex.axis`, colors, line type/width, font face/family, and orientation become
bounded segment and text commands. This keeps package and Worker execution host-neutral. Outer
margins, logarithmic/date scales, plotmath, exact collision avoidance, and device font metrics are
explicit unsupported boundaries.

## Profile 0.402 central distribution quantiles

`stats::qchisq()` and `stats::qf()` implement their central-distribution surfaces through bounded,
monotone inversion of NativR-owned regularized gamma and beta probabilities. Requested small tails
are evaluated directly, including log-probability complements. Results recycle parameters and retain
longest-input attributes. Non-central `ncp != 0` calls fail with an explicit unsupported feature
instead of silently applying the central distribution.

## Profile 0.401 model-frame and S4 omission semantics

`as.data.frame.list` now expands atomic matrix and data-frame members into columns while enforcing a
common row count and deterministic name repair. `model.matrix` preserves rows from an existing model
frame, honors a mutated terms intercept, and ignores unrelated extension arguments. The NA action
builtins dispatch registered S4 methods, while `setGeneric` promotion retains the existing ordinary
function as default fallback together with its formals. This is a bounded implemented surface; the
full GNU implementations of these generics are not claimed.

## Profile 0.398 S4 prototype defaults

`methods::prototype(...)` accepts named defaults, preserves their order for class construction,
allows at most one unnamed data-part value, exposes the GNU `...` formal, and returns an S4-marked
`classPrototypeDef` compatibility object. `setClass` consumes the defaults generically and `new`
uses them for omitted slots. The public compatibility case also covers `stats::logLik` as a lazy
no-default S3 generic. Complete prototype-object slot introspection remains a documented gap.

`graphics::image()` is an S3 generic whose default method accepts positive numeric/logical matrices,
strictly increasing center or boundary coordinates, explicit `zlim` or `breaks`, reusable R colour
vectors, missing transparent cells, and `add`. Matrix rows map to x and columns map to y, including
the documented bottom-up column orientation. Regular grids become one non-interpolated RGBA raster
command; irregular grids become borderless polygon cells through the same graphics journal.
One-row/one-column grids expand their degenerate coordinate range, and `xaxs = "i"`/`yaxs = "i"`
retain exact cell boundaries. The measured `axes`, `ann`, `bty`, `xaxt`, `yaxt`, and scalar label
controls are resolved before transport. Legacy `oldstyle = TRUE`, additional axis styles, complete
tick/label layout, and device-selected raster heuristics remain explicit boundaries.

`base::plot()` is an S3 generic that probes class methods without consuming `plot.default`; this
lets application-supplied pure-R package methods own their result and visibility. The
`graphics::plot.default()` fallback normalizes ordinary one-vector and paired x/y containers through
the same coordinate adapter as `points()`, computes finite linear ranges and GNU R-shaped 4% regular
axis padding, then emits a page, window, optional frame, geometry, and supplied scalar character
annotations. Point, line, both, overplotted, histogram, lower-step, upper-step, and no-draw types
map to the existing point/segment commands. Colors, fills, symbols, sizes, line types, and widths
recycle; missing or non-finite pairs are omitted and interrupt paths. Panel promises are forced
after the window and on either side of data geometry, while annotations remain lazy when
`ann = FALSE`. The default returns invisible `NULL`; package methods preserve their own visibility.
Automatic axes, expression-derived labels, logarithmic or fixed-aspect windows, specialized core
plot methods, margins/clipping, and device-identical layout remain explicit boundaries.

`stats::ts.plot(..., gpars = list())` is a high-level aligned-series plot rather than a
package-specific translation. Unnamed inputs and explicitly named `ts`/`mts` inputs become one or
more columns; other named dots and named `gpars` entries become plot controls. Every column must
have the same positive sampling frequency. The runtime constructs the union start/end grid, inserts
missing cells outside each source interval, and renders each column through the existing line/point
geometry so gaps remain disconnected. Default type is line, x coordinates retain `tsp` calendar
values, common styles recycle by column, and the result is invisible `NULL`. Linear/log windows,
explicit limits, frame/annotation controls, expression-derived single-series labels, and dynamic
`par("usr")` use the owned graphics state. Multi-panel `plot.ts`, irregular series, complete
axes/margins and arbitrary graphical parameters remain outside this behavioral slice.

`graphics::box()` resolves plot-region `bty` edge shapes, `col`/`fg` precedence, line type, and
positive width into one bounded frame command. It returns invisible `NULL`; figure, inner, and outer
regions are rejected until the owned device has a margin/layout model. `graphics::boxplot()` is an
S3 generic whose owned default accepts numeric vectors, lists of numeric groups, and numeric matrix
columns. It omits missing observations, computes Tukey hinges, whiskers, notches, sample counts and
outliers, and returns the six-field `stats`/`n`/`conf`/`out`/`group`/`names` result invisibly
whether or not drawing is enabled. Drawing resolves positions, widths, fill/border colors, line
types, and line widths into a bounded group event; horizontal/notched boxes, `outline`, `varwidth`,
`at`, and `add` use the same owned device. Formula/data-frame methods, logarithmic axes, arbitrary
`pars`, axis annotation, and device-identical layout remain unsupported. `graphics::segments()`
consumes real/logical endpoint vectors, defaults an omitted `x1` or `y1` to its corresponding start
coordinate, and recycles coordinates, colors, line types, and line widths without a recycling
warning. Missing/non-finite coordinates and missing/transparent/invalid-width drawing entries are
omitted. Valid colors are resolved to `#RRGGBBAA`, and documented line-type names, numeric cycles,
and custom hexadecimal patterns are normalized before transport. `graphics::lines()` dispatches
classed inputs before its owned `lines.default` fallback, preserving package-method values and
visibility. The default uses the same x/y normalization as `plot.default`, accepts all nine
documented plot types, and returns invisible `NULL`. Connected and step paths are broken by
missing/non-finite pairs; histogram lines recycle colour while ordinary line colour/type/width use
their first values, and point-bearing types reuse the point-style recycling path. All geometry
becomes existing bounded segment/point commands, so Worker transfer, browser/PNG rendering,
hold/flush, and record/replay need no separate polyline protocol. Line caps/joins/mitres, full
clipping/log transforms, and the remaining graphical parameter surface remain explicit boundaries.
`graphics::points()` dispatches classed first arguments before accessing the owned device. Its
default accepts paired real vectors, two-column matrices, one-/two-column data frames, complex
coordinates, and named `list(x, y)` containers, with an implicit sequence paired to a single
ordinary vector. Separate x/y vectors must have equal lengths. It resolves numeric plotting-symbol
codes 0:25, printable ASCII and negative-Unicode codes, literal one-character symbols, colors,
fills, sizes, and widths into a bounded point event; missing/non-finite coordinates and non-drawing
style entries are omitted. `type = "p"` draws, `type = "n"` validates without emission, and both
return invisible `NULL`. Line/path types, locale-dependent codes, character coordinate coercion,
broader coordinate classes, clipping/log axes, and device-identical font metrics remain unsupported.

`graphics::text()` dispatches classed first arguments before device access. Its owned default
accepts the point-coordinate containers above while recycling unequal x/y lengths. Atomic labels
coerce to character, shorter labels recycle and longer labels warn before truncation; missing or
non-finite coordinates and missing labels omit entries. Colors, character sizes, four browser font
faces, positions, adjustment, offset, scalar rotation, family, and `xpd` are resolved into a bounded
host-neutral text event. Calls return invisible `NULL`, and Worker transport, Canvas rendering, held
journals, and same-session record/replay share the existing graphics path. Plotmath expressions,
Hershey fonts, class-specific label coercion, plot-region clipping, logarithmic axes, and
device-identical text metrics remain unsupported.

`graphics::matplot()` is a high-level numeric matrix-series adapter over the owned browser graphics
journal. With one input it generates `1:n` x coordinates; with two inputs it validates equal row
counts and cycles their columns. Numeric/logical vectors, matrices, and numeric data frames become
column-major series. Point, line, both, line-only-both, overplotted, histogram-stem, lower-step,
upper-step, and no-draw types plus colors, symbols, fills, sizes, line types, and widths cycle by
series. Incomplete pairs omit points and split line or step runs. Logarithmic x/y values are
converted to finite base-10 device coordinates before window and command emission. A call begins a
page, computes padded limits, writes a window and optional box, then emits the same bounded segment
and point events used elsewhere, so Worker transport and same-session record/replay need no
additional protocol. Complete axes/labels, class-preserving `plot`/`lines` dispatch, additions to
existing plots, exact point-clearance for the `b`/`c` distinction, and exact graphics layout remain
unsupported.

`base::aperm()` is an S3-first array-axis generic. Method arguments retain promises and are
rematched for each selected method and `NextMethod()` target; unmatched named dots can therefore
stay lazy, while an unnamed third argument can occupy `aperm.default()`'s later `resize` formal as
in GNU R. The default decodes output coordinates in the permuted shape, maps them to input
coordinates, and copies owned vector/list elements in column-major order without executing generated
JavaScript. Numeric axes are integer-coerced and character axes use dimension-axis names. Omitted,
`NULL`, and empty permutations reverse axes. Resized output permutes dimensions and dimnames;
fixed-size output restores the original dimensions and drops dimnames. Only result shape attributes
survive. Storage and iteration remain bounded by the shared allocation and step budgets.

`base::tempfile()` allocates unique opaque paths under `nativr://session-temp/`; it does not create
a host file. `dput(x, path)` independently serializes supported owned values to canonical R source
and stores that UTF-8 text in evaluator session state. `dget(path)` sends the stored text back
through the normal Tree-sitter R parser, normalized AST, and evaluator in the calling environment.
`unlink(path)` removes the entry. Runtime reset or disposal drops the complete map. The aggregate
stored-byte budget is `maxOutputBytes`; entry counts, traversal, recursion, and reconstructed values
also consume the normal resource limits.

`file.remove(...)` validates all arguments before mutation, returns a visible logical value for each
path, and warns once for every failure. The first argument must be character; later atomic arguments
use ordinary character coercion. Only closed ordinary session files are removed. Directories, open
connections, immutable runtime/package files, wildcard literals, missing paths, and host paths fail
deterministically. Wildcard expansion remains an explicit `Sys.glob()` concern, matching R's
separation between globbing and removal.

`writeLines(text, path)` truncates a session text file and writes the selected separator after every
character element; missing strings render as `NA`. With no connection argument it emits the same
bounded stdout events as other textual output. `readLines(path)` recognizes LF, CRLF, and CR,
supports bounded `n`, `ok`, incomplete-final-line and embedded-NUL warnings, and `skipNul`. It reads
either session text or immutable package files resolved through `system.file()`. Session-owned
`file()` connections provide operation-scoped or persistent cursor access; host paths and other
connection classes are rejected before any host API can be reached.

`stdin()`, `stdout()`, and `stderr()` return stable session-owned integer handles 0, 1, and 2 with
classes `c("terminal", "connection")`. They are always open text connections with the documented
read/write directions and cannot be opened, closed, or sought. `writeLines()` and `cat()` route
explicit stdout/stderr targets into the same bounded ordered output journal used by implicit console
output, including Worker transport and capture. `summary()`, `isOpen()`, `flush()`, `isatty()`,
`getConnection()`, `getAllConnections()`, `showConnections()`, and `closeAllConnections()` share the
ordinary connection registry; closing all connections destroys only user-created records.
Browser/Worker sessions report `isatty()` as false. Streaming
`readLines(stdin())`/`readBin(stdin())` remains unavailable until an explicit bounded host-input
adapter exists.

`gzcon(con, level = 6, allowNonCompressed = TRUE, text = FALSE)` replaces a valid evaluator-owned
file handle with a `c("gzcon", "connection")` handle over the same record. Reads unwrap bounded gzip
bytes (or pass ordinary bytes through, warning when requested); `readLines()` and raw `readBin()`
share the decompressed cursor. Writes retain bounded uncompressed bytes and emit one gzip stream
when `close()` destroys the wrapper, matching GNU R's zero-byte-before-close behavior. The browser
stream API does not expose compression-level selection, so `level` is range-checked but byte
identity is not promised. No URL, socket, host file, or ambient network capability is introduced.

`socketConnection(host, port, ...)` creates a `c("sockconn", "connection")` integer handle in the
same unforgeable registry. `open = ""` creates an inert closed record; opening requires the explicit
host socket capability. Open/read/write/timeout/close carry only session and connection IDs plus
validated scalar metadata or bounded copied bytes. Returned read bytes enter the private connection
buffer, so `readLines()`, raw `readBin()`, `writeLines()`, `cat()`, `isOpen()`, `isIncomplete()`,
`summary()`, and `socketTimeout()` reuse ordinary connection semantics. Reset and disposal issue a
session-scoped close-all request before clearing evaluator state. Raw TCP, TLS, DNS, CORS,
backpressure, cancellation, and endpoint selection are host policy rather than implicit runtime
authority.

`unz(description, filename, open = "", encoding = getOption("encoding"))` creates a lazy, read-only
`c("unz", "connection")` record over one exact member of an immutable package resource or
session-owned ZIP file. Stored and raw-DEFLATE members share the normal closed-operation or open
persistent-cursor behavior used by line/raw/source/table/serialization readers. The parser bounds
the archive, member count, compressed ranges, and output; validates filenames, sizes, and CRC32; and
rejects encrypted, multi-disk, ZIP64, and unknown-compression forms. Seeking and writing are not
enabled, and no archive entry becomes a virtual or host path.

`utils::object.size(x)` returns a visible length-one double with class `object_size`. The estimate
uses GNU R 4.6's documented 64-bit allocation shape: a 48-byte vector header, bounded payload
buckets, 56-byte nodes/tags, recursive attributes and list children, within-vector character-string
sharing, and normalized language/formal traversal. Repeated list children are counted each time;
environment bindings and closure environments are not followed. `format.object_size` and
`print.object_size` provide legacy binary, IEC, and SI unit selection with automatic scaling. The
result describes NativR's R object graph and is intentionally unrelated to host heap telemetry.

`readChar(con, nchars, useBytes = FALSE)` consumes fixed-width fields from a raw vector or the same
owned package/session/file/URL/gzip byte sources. Character mode validates UTF-8 and counts Unicode
scalar values; byte mode retains exact field bytes. Zero-width fields do not consume input, a
positive request at EOF stops the result, and a partial final field is returned. Open readable
connections advance their byte cursor after each field, while closed connections are read
operation-scoped and remain closed. Embedded NUL, invalid UTF-8, negative/missing widths, result
length, and total output bytes fail within the ordinary evaluator limits.

`debug(fun)` and `debugonce(fun)` retain evaluator-local marks in weak object-identity registries;
aliases of one closure therefore observe the same persistent mark, while replacing or rewriting a
function produces an unmarked object. `undebug()` removes only the persistent mark and warns when
none exists; `isdebugged()` intentionally does not report a one-shot mark, matching GNU R 4.6.
Entering a marked closure consumes any one-shot mark, emits a bounded trace, and, when an explicit
line-input host exists, prompts before normalized top-level body statements. The current command set
is empty/`next`, `continue`, `finish`, and `Q`. Non-interactive sessions continue after the entry
trace; arbitrary debugger expressions, nested stepping, and S4 method-signature tracing are not yet
implemented.

The same map owns a bounded directory tree and current working directory. `R.home()` identifies a
static `nativr://runtime` shape; `tempdir()` identifies the mutable session root; and package roots
come only from supplied bundles. `dir.create()` and recursive `unlink()` mutate session directories,
while `dir.exists()`, `list.files()`/`dir()`, `list.dirs()`, `getwd()`/`setwd()`, `normalizePath()`,
`basename()`, and `dirname()` operate across owned roots. Relative paths resolve against the current
owned directory, including a read-only package directory. Dot segments are normalized without
allowing traversal above their root. Absolute host paths, links, permissions, mounts, and host
working-directory state are never consulted.

`file.info(..., extra_cols = TRUE)` queries only those owned roots. Its first six columns use GNU
R's `double`, `logical`, `octmode`, and `POSIXct` shapes; unavailable paths produce missing rows and
`file.mode`, `file.mtime`, and `file.size` select the corresponding columns. Session text and binary
files expose exact encoded byte sizes and update evaluator-owned modification/status/access times;
session directories use writable virtual modes. Immutable runtime/package trees use deterministic
read-only modes and timestamps, and portable extra owner columns are `NA` because the browser has no
host user identity. No stat call, host path, ACL, link, or ambient filesystem capability is used.

`file.create(..., showWarnings = TRUE)` uses the same mutable session tree. It preflights every
argument before mutation, requires a character first dots value, coerces later atomic values after
attribute removal, expands vectors in order, and creates or truncates each successful path to zero
bytes. The result drops input attributes. Missing filenames return `FALSE` silently; other failures
emit one warning per path only when the first coercible `showWarnings` element is true. Named
`showWarnings` matching is exact because it follows dots, so `showW = FALSE` remains a filename.
Parents must already be session directories. Immutable package/runtime resources and host paths
remain unwritable, and evaluator limits bound path count, files, bytes, allocation, and steps.

`file.copy(from, to, overwrite = recursive, recursive = FALSE, copy.mode = TRUE, copy.date = FALSE)`
copies only from owned session, runtime, or immutable package paths into the mutable session tree.
It preserves exact binary bytes, recycles one source across multiple targets, expands multiple
sources into one existing destination directory, returns an unclassed visible logical per attempted
copy, and leaves existing targets unchanged unless overwrite is true. Recursive copies reproduce the
source basename, subdirectories, and dotfiles only beneath one existing destination directory. An
empty source returns before forcing later arguments. The browser store has deterministic virtual
modes, so `copy.mode` is accepted but cannot reproduce host ACLs; `copy.date` preserves owned
modification timestamps. File count, result length, bytes, recursion work, allocation, and steps are
bounded, while host paths, links, devices, cross-session persistence, and ambient filesystem access
remain unavailable.

`find.package(package = NULL, lib.loc = NULL, quiet = FALSE, verbose = getOption("verbose"))`
queries the same session-owned package registry used by namespace loading. With `package = NULL` it
returns attached package directories in search-list order; explicit vectors preserve order and
duplicates. Missing entries warn when some requested packages exist, error when none exist, or are
filtered when `quiet` is true. Explicit `lib.loc` restricts source-only bundles to admitted library
roots, while attached Base R packages retain their core runtime locations. Returned directories are
immutable virtual identifiers: source-only bundles use `nativr://package/<name>` and core packages
use `nativr://runtime/library/<name>`. `verbose` is retained as an unforced compatibility formal.
This is package discovery, not host library scanning or package installation.

`utils::read.table` and its CSV/delimited variants consume that same text layer or inline `text=`.
When `header` is omitted, the whitespace-table path recognizes GNU R's first-row-one-field-shorter
automatic header convention; `fill` follows the documented inverse of `blank.lines.skip` when it is
also omitted. The owned bounded scanner recognizes LF/CRLF/CR records, explicit or whitespace
separators, quoted fields, doubled quotes, embedded quoted newlines, comments, skipped/blank lines,
filling, headers, row/column names, missing strings, and syntactic name repair. Columns pass through
the same deterministic `utils::type.convert` ladder used by package code. `write.table` and its CSV
variants serialize owned atomic matrices, lists, and data frames with explicit row/header
conventions, missing markers, decimal separators, and escape/double quote modes. Files remain
evaluator memory; automatic compressed-path detection, host paths, URLs, arbitrary encodings,
`colClasses`, and the complete GNU R scanner are outside this slice. Callers can explicitly unwrap
an owned connection through `gzcon()` where a reader accepts a connection.

The independent binary serializer reads and writes GNU R's documented XDR version-2/version-3 stream
shape for owned atomic storage, explicit missing masks versus ordinary `NaN`, infinities, complex
components, raw bytes, strings, list/pairlist nesting, names, and ordinary vector attributes.
Version 3 records UTF-8 as its native encoding. The reader additionally expands the base compact
integer/real-sequence ALTREP forms and normalizes compact automatic data-frame row names.
Browser-standard `CompressionStream`/`DecompressionStream` supplies bounded gzip wrapping; the
runtime never calls a host filesystem or embeds GNU R.

`serialize(object, NULL)` returns a raw XDR stream and `unserialize(raw)` restores it.
`saveRDS`/`readRDS` operate on bounded browser-memory paths or binary connections, while `infoRDS`
reports the stream version, writer/minimum-reader versions, format, and native encoding. ASCII,
native-endian, ordinary environment/closure/language graphs, reference hooks, unsupported ALTREP
classes, bzip2/xz/zstd, cycles, and host persistence fail explicitly.

The Node-only package tool may normalize bzip2-wrapped `.rda`, `.RData`, and `.rds` package
resources to raw serialization bytes while constructing a size-checked immutable artifact. The
browser still receives only the existing raw/XDR/gzip surface: direct runtime bzip2, xz, and zstd
streams remain unsupported, and no decompressor or install-time filesystem authority is added to the
browser bundle.

`save(..., list, file, envir)` selects bindings without evaluating direct object names, forces their
promises by default, serializes a named pairlist behind the GNU R `RDX2`/`RDX3` workspace header,
and writes a binary session file. `load(file, envir, verbose)` decodes session or immutable package
workspace bytes and installs their named entries in order. Duplicate names are preserved in the
invisible return vector while the last binding wins in the target environment. Versions 2 and 3,
uncompressed output, and gzip output are supported; ASCII, other compressors, promise-graph
persistence, and partial writes remain explicit boundaries.

Application-supplied pure-R bundles are compiled at session initialization. DESCRIPTION and
NAMESPACE parsing produces parser-independent runtime package definitions; package sources then use
the same normalized AST as interactive code. Each namespace receives an imports parent and its own
bindings, dependencies load recursively, closures retain the namespace, S3 methods register without
attachment, and exported bindings enter the attached-package search environment only after
`library()`. Reset clears namespaces, hooks, attachment state, S3 registrations, and search entries
but retains the immutable bundle catalog for deterministic reload. Source size, source count,
dependency cycles, imports, exports, and lifecycle evaluation all remain resource-checked. Unchanged
source evaluation may read retained standard `tools/**` files from a hidden, immutable package root;
the scoped root is restored across nested loads and failures and is not returned by `system.file`.
Writes to that source root and a complete install-time filesystem remain unsupported. Unchanged R6
2.6.1 additionally proves that an installed package can replace the built-in compatibility shim of
the same non-core name, register a namespace-qualified S3 method, construct a generator, create a
reference object, call public methods, mutate public and private state, and expose a read/write
active field without source changes. Core package names remain reserved. This is an executable
package/version proof, not universal R6 or pure-R package compatibility. Unchanged
`utils::packageVersion(pkg)` consults that immutable catalog and therefore does not load or attach
the requested namespace. Core namespaces expose the runtime's documented `4.6.1` compatibility
identity; installed bundles expose their validated DESCRIPTION version. `getRversion()` uses the
same component representation with class chain `R_system_version`, `package_version`, and
`numeric_version`. Version constructors normalize dots and hyphens into integer components,
represent missing entries explicitly, and support character formatting, printing, concatenation, and
vectorized relational operators with trailing-zero padding. `utils::compareVersion()` preserves its
separate component-count ordering. Arbitrary `lib.loc` discovery, mutable installed metadata,
component extraction/replacement, summary methods, and the complete numeric-version S3 family are
not yet supported.

`utils::packageDescription()` reads the same immutable catalog without initializing a namespace.
Validated bundle DESCRIPTION fields retain their source order and folded continuation text; callers
may request a subset, receive character `NA` for absent fields, drop a one-field result to a scalar,
or inspect the named `packageDescription` list plus its `fields` and virtual `file` attributes.
Missing packages and empty field selections warn and return character `NA`. Core compatibility names
expose bounded `Package`, `Version`, and `Priority` metadata. Arbitrary host libraries, malformed
installed trees, full GNU core prose, runtime metadata mutation, and codecs beyond the owned
UTF-8/Latin-1 path remain outside this catalog.

Dynamic `registerS3method()` entries use the same owned S3 registry as declarative NAMESPACE
methods. The registry key includes the generic's definition environment, so independent namespaces
may define the same generic/class pair without cross-dispatch. Function values and character method
names are retained without creating visible `generic.class` bindings; later registration replaces
the same key, while a visible call-site method still wins. Namespace-load transactions restore all
changed entries when `.onLoad()` fails, and reset clears the registry. Declarative
`S3method(package::generic, class)` entries resolve the generic in its named namespace while looking
up the unqualified `generic.class` method in the installing package, matching the form used by R6
for `utils::.DollarNames`. Delayed registration against an unloaded suggested-package namespace and
complete method-table introspection are not yet supported.

Unchanged external packages can construct wrapper closures from package-owned source: nested
replacement rebuilds call roots through `formals<-`, closure enclosures can be replaced through
`environment<-`, mixed language/list `c()` inputs feed `as.call()`, and `bquote()` substitutes `.()`
expressions against explicit environments or list-backed masks. Dynamic `parent.frame()` uses the
actual call-site environment, including a promise's lexical evaluation origin rather than an
unrelated helper frame. Runtime-created language objects retain embedded atomic/list constants as
distinct normalized AST nodes, so `quote(list(...))` syntax remains different from a quoted literal
list. Constructed `<-`, `=`, `<<-`, `->`, and `->>` calls reuse ordinary assignment/replacement
semantics. `packageEvent()` plus `setHook()`/`getHook()` provide a session registry. These semantics
are executable through the pinned `withr 3.0.3` `with_options()` proof rather than inferred from
successful parsing. `gctorture2()` exposes only its documented argument/formal and previous-state
API for wrapper construction; it does not and cannot force a browser JavaScript engine's garbage
collector. DESCRIPTION, NAMESPACE, and retained `R/*.R` text share the executable-source-unit
budget; package resource count is independently bounded and decoded immutable resource bytes use the
profile's `maxPackageResourceBytes` aggregate ceiling (192 MiB by default). All enter one immutable
package-file lookup seam. UTF-8 uses the browser-standard fatal decoder, Latin-1 uses deterministic
byte mapping, and both paths are bounded; package paths cannot be written through `writeLines()`.
One packaged `R/sysdata.rda` workspace is decoded into the namespace before R source evaluation.
`utils::data()` enumerates direct `data/` resources in attached or explicitly named packages. An
`.R` dataset is decoded according to the package encoding, parsed to the normalized AST, and
evaluated in the selected environment; overwrite protection restores pre-existing direct bindings.
`.csv`, `.tab`, and `.txt` datasets use the owned table reader and bind one frame under the
requested dataset name. `.rda`/`.RData` entries use the same XDR/gzip workspace decoder and install
every named binding. The return vector and `packageIQR` listing shape follow GNU R's
visible/invisible contract. Installed-package `.rdx`/`.rdb` lazy-load databases, aliases/index
metadata, unsupported serialized types/compressors, and temporary working-directory changes remain
explicit boundaries.

Static core-package definitions reuse this pipeline for browser-owned resources. The runtime admits
only registered core namespaces, validates canonical resource paths/base64 and unique exports, loads
declared data through `data/*.R`, and installs those bindings in both the package namespace and the
default search path. `iris`, `mtcars`, `InsectSprays`, and `faithful` are admitted through that same
path; they remain available after session reset and require neither network nor host files. Their
exact origins, licenses, normalization, and hashes are in
[`core-data-provenance.md`](core-data-provenance.md).

The Node-only packager converts package-owned `man/*.Rd` example sections into one versioned JSON
resource containing canonical topics, aliases, titles, and ordered `run`, `dontrun`, or `donttest`
blocks. `utils::example()` searches loaded namespaces and the active virtual library paths (or
explicit `package` / `lib.loc` selections), loads the matching package, and parses the selected
source through the normal normalized-AST path. Default execution comments skipped blocks; explicit
flags admit them. `give.lines = TRUE` returns a GNU R-shaped header plus prepared code without
evaluation, and `local = TRUE` uses a fresh environment parented by the global environment.
Interactive help rendering/prompting, source references, exact console echo layout, RNG restoration,
and abort recovery are not yet modeled.

With `includeTests: true`, the packager also retains bounded `tests/**` content as inert immutable
resources and writes a versioned manifest for top-level R scripts and adjacent `.Rout.save` files.
The default is false. An evidence runner may locate the hidden test root with package-scoped
`system.file()` and `source(..., chdir = TRUE)` each script through the normal normalized-AST path.
The runtime neither auto-executes package tests nor treats retained bytes as P6 evidence. Unchanged
numDeriv's four example topics and seven test scripts exercise this path; its large numerical tests
use explicit finite step/allocation overrides. Unchanged abind adds five example topics and five
test scripts. Its runner evaluates top-level expressions in order and, after an intentional error,
invokes a configured `options(error=)` handler before continuing; an unhandled error still fails the
script. This is not automatic `.Rout.save` comparison or complete `R CMD check` orchestration.

Owned call objects and expression vectors support entry selection and replacement through `[`, `[[`,
`[<-`, and `[[<-`, including missing argument slots and normalized subset-call reconstruction.
Replacement-function frames retain the originating call syntax, while
`match.call(expand.dots = FALSE)` exposes unevaluated dots as a pairlist. Apply-family functions
accept pairlists without converting them through host-only representations. These are reusable
language semantics; exhaustive coercion/warning behavior for every language-object mutation remains
open.

`as.data.frame()` and matrix arguments to `data.frame()` split an atomic matrix into column-major
frame columns while preserving available row and column names. Explicit matrix argument names prefix
the expanded column names as in GNU R. `as.matrix()` combines atomic frame columns in column-major
order with factor-to-character promotion. Its default method returns existing two-dimensional
objects unchanged; otherwise it rebuilds an `n × 1` matrix, maps vector or one-dimensional-array
names to the row axis, supplies a null column axis, and removes unrelated attributes. Rectangular
data-frame replacement treats a zero-row or zero-column selection as a no-op, including the
empty-list pattern used by generic package constructors. List-column and exhaustive mixed-class
coercion remain incomplete. `array(data)` defaults to a one-dimensional array, `dimnames()` returns
`NULL` for objects without dimension names, shorter `names<-` values pad with missing names, and
nested replacement can grow a `NULL` base value. Base also exposes `LETTERS`, `month.abb`,
`month.name`, and numeric/complex `prod()` semantics covered by differential tests.

`NULL` under `[` resolves to an empty selection and `[NULL] <- value` leaves the target unchanged;
`[[NULL]]` retains its scalar-subscript error. Atomic-to-list replacement preserves matrix and other
stable attributes when result length is unchanged. `diag<-` uses the same replacement machinery for
matrix storage and per-column data-frame diagonals, preserving dimensions, dimnames, row names,
classes, and type promotion while requiring a scalar or exact diagonal-length replacement.

Inverse trigonometric functions cover real/complex `asin`, `acos`, and `atan`, including missing
propagation, real-domain warnings, factor rejection, and attributes. Complex integer exponentiation
uses exponentiation by squaring, avoiding polar branch noise that otherwise corrupts complex-step
derivatives near negative real inputs. Non-integer complex powers retain the general logarithmic
form.

`Sys.info()` returns the standard eight names with deterministic browser-safe values and zero
formals. It never reads ambient host OS, machine, node, login, or user identity.

`Sys.sleep(time)` uses short asynchronous timer slices, returns invisible `NULL`, and checks the
active cancellation token without consuming evaluation steps. Non-negative finite intervals and
`Inf` are accepted; missing, `NaN`, and negative values fail. Inline interruption is cooperative,
while the public Worker API retains its stronger terminate-and-reset behavior.

`gc(verbose, reset, full)` performs a deterministic census of the reachable NativR R-value graph. It
reports node links and owned payload storage in GNU R's named 2-by-6 `Ncells`/`Vcells` matrix, with
56-byte node and eight-byte vector-cell display units, adaptive reporting triggers, and resettable
session high-water values. `full` selects the compatible collection level/counter; NativR's graph
census is complete at either level because it has no generational R heap. `verbose` emits the
compatible three-line message shape through bounded runtime output. `gcinfo()` returns and updates
its session flag, but JavaScript-engine automatic collections cannot be observed or made verbose.
None of these values are host heap measurements.

`system.time(expr, gcFirst = TRUE)` validates `gcFirst` with GNU R's scalar condition coercion,
performs the same silent NativR graph census when true, then samples a monotonic browser clock
around one lazy force of `expr`. Its visible `proc_time` vector contains zero browser process CPU
fields, measured elapsed seconds, and missing child-process fields. A catchable expression error
writes `Timing stopped at:` to stderr and is rethrown. `proc.time()` uses the same clock and a
resettable session origin, never decreases within a session, and returns the same named/classed
shape. Browser JavaScript does not expose forced host garbage collection, process CPU counters, or
child-process counters, so those operations are not fabricated.

`Sys.getpid()` returns a positive signed-32-bit integer allocated by the NativR facade for one
session. The value is stable across evaluations, `reset()`, and automatic Worker replacement; two
concurrent sessions created in the same facade realm receive distinct values. A legacy protocol-v1
client that does not send the optional identity receives an evaluator-local fallback. The value is
session identity only, never a browser, Node, Worker, or operating-system process identifier.
Independent page realms cannot coordinate the counter, and the runtime exposes no parent process,
process enumeration, signaling, native handle, or CPU-accounting authority.

`system()` and `system2()` are ordinary R closures over one explicit construction-time
`systemCommand` capability. With no capability they fail before any host action. `system()` sends
its single command line and GNU R control flags; `system2()` keeps the first executable, additional
command elements, argument fragments, `NAME=value` environment entries, stdin path, input lines, and
stdout/stderr redirection descriptors separate. Capturing either stream forces waiting and returns
visible lines; otherwise the integer status is invisible, asynchronous success is zero, failed
starts use 127, and timeouts use 124. Nonzero captured status and host failures preserve the
documented warning/status/errmsg contract. Request and result text share `maxOutputBytes`, NUL is
rejected, and inline/Worker execution use the same copied record. The evaluator never resolves an
executable, interprets a shell, opens a host path, inherits host environment state, or starts a
process; those actions remain wholly inside an application allow-list policy.

`utils::aspell(files, filter, control, encoding, program, dictionaries)` selects an explicitly
advertised `aspell`, `hunspell`, or `ispell` path (or validates an explicit program), reads each
owned virtual file, and optionally invokes a supplied R filter with `ifile` and recycled `encoding`.
Caret-prefixed lines cross the existing structured command seam with `-a`; bounded Ispell response
groups become `Original`, `File`, `Line`, `Column`, and list-column `Suggestions` inside a
`c("aspell", "data.frame")` value. Missing process authority fails before execution. Built-in
filters and nonempty `dictionaries` currently fail explicitly rather than approximating.

`.libPaths()` returns the evaluator session's ordered package-library roots. The default is
`c("nativr://package", "nativr://runtime/library")`; the first root contains immutable supplied
source bundles and the second is `.Library` for registered runtime namespaces. A setter expands
relative browser-owned paths, applies supported virtual globbing, retains existing directories,
normalizes separators and dot segments, removes duplicates, appends `.Library`, and returns the new
path invisibly. A getter is visible and does not force `include.site`; `.Library.site` is currently
empty. Reset restores the default. Package discovery and explicit virtual `lib.loc` use the same
state, while already loaded namespaces remain usable as in R. Host paths, startup environment
variables, repository downloads, and native installed-package layouts are never consulted.

`graphics::polygon()` accepts the same owned coordinate containers but does not dispatch: paired
vectors, two-column matrices/data frames, complex coordinates, and named `list(x, y)` become
device-independent closed paths. Missing or non-finite pairs split separate polygons. Fill/border
colors, line types, and line widths recycle by path; `border = FALSE`, transparent styles,
`density = 0`, and `fillOddEven` resolve before transport. Negative, missing, and `NULL` density
select a solid fill. Positive density carries physical lines-per-inch, angle, color, and width in
the same replayable event; Canvas, software PNG, and PDF clip those hatch lines to the polygon.
Coordinate classes beyond owned numeric storage, clipping/log axes, arbitrary graphical controls,
and device-identical hatch phase, dash, and subpixel rasterization remain unsupported.

`graphics::legend()` resolves positional or named labels, keyword/coordinate placement, insets, line
and point keys, palette/text colors, box/background, size, columns, horizontal layout, and title
into a device-independent event. It returns an invisible `rect`/`text` geometry list; `plot = FALSE`
returns geometry without emission. Raster bytes and bounded
segment/point/text/polygon/box/boxplot/legend payloads share `maxOutputBytes` with text and returned
values. `dev.hold(level)` and `dev.flush(level)` maintain a session-local, nonnegative nested hold
level for the active owned device. While held,
page/window/raster/segments/points/text/polygon/box/boxplot/legend commands remain in an ordered
journal across evaluation boundaries; the flush that reaches zero emits all pending commands through
the current result and callback. Pending graphics bytes are bounded by `maxOutputBytes`, pending
command count is bounded by `maxVectorLength`, and reset/dispose clears them. Calls without an
active device return zero. The runtime and base packages contain no DOM or Canvas dependency; the
Worker transfers commands to the public API and the Playground owns the reference Canvas renderer.

`dev.cur()` and `dev.list()` expose a numbered registry containing the browser display and any open
PNG or PDF file devices, while retaining GNU R's named null-device value 1 when no device is active.
`dev.off(which = dev.cur())` can close the current or a selected registered device, flushes held
commands before removal, renders a pending PNG page when applicable, selects a remaining device, and
returns that new current device. Unsupported device numbers remain harmless no-ops, while closing
null device 1 is an error. `graphics.off()` closes every owned device and returns invisible `NULL`;
later drawing reopens the browser device at the lowest free number. Each device owns its own
`graphics::par()` map; opening a PNG device applies its point size without mutating the browser
device, and closing it restores the newly selected device's parameters.

The map exposes GNU R's ordered 72-name default-device inventory, while `par(no.readonly = TRUE)`
omits the six read-only entries `cin`, `cra`, `csi`, `cxy`, `din`, and `page`. Named-list
restoration leaves those entries unchanged and emits GNU R-shaped warnings. The remaining entries
retain the existing bounded query/update/restore validation. Inventory and state behavior are
covered; full figure-region calculations and rendering effects for every parameter remain
incomplete. `barplot()` resolves `xaxt`/`yaxt` against the corresponding category and numeric axes,
and `axis()` ignores a forwarded `xlab` while warning on unknown controls.

`grDevices::devAskNewPage(ask = NULL)` opens a browser device when the null device is current and
returns that device's ask flag visibly without changing it. A coercible non-missing `ask` updates
only the current device and returns the previous flag invisibly; new devices copy
`options("device.ask.default")`, using `FALSE` with a warning when that option cannot supply a first
logical value. Before replacing an existing browser page, an enabled interactive session emits
`"Hit <Return> to see next plot: "` through the explicit bounded `readline` exchange and waits for
one host-approved line. The first page, non-interactive sessions, and PNG/PDF devices do not prompt.
Reset/dispose and device closure remove the associated ask state with the rest of the device.

`grDevices::png()` opens an invisible-returning browser-memory file device with GNU R-shaped
formals. It resolves `px` dimensions directly or converts `in`/`cm`/`mm` dimensions using required
resolution, validates colors and device controls, creates the page target immediately, and records
the same page/window/raster/segment/point/text/polygon/box/boxplot/legend display list used by the
screen renderer. A deterministic DOM-free software rasterizer composites RGBA pixels; PNG encoding
uses the platform `CompressionStream` when available and a standards-compliant stored-DEFLATE
fallback otherwise. Page transitions and close write bounded PNG bytes to the session store, with
`%d`/zero-padded numbered filenames for multiple pages. Raw `readBin()` can retrieve those bytes.
Exact GNU R font metrics, anti-aliasing modes, device color profiles, every `png()` backend/control,
typed `readBin()` decoding, and cross-device pixel identity remain incomplete.

`grDevices::pdf()` opens the same owned registry with GNU R 4.6-shaped formals and an invisible
`NULL` result. `file = NULL` records graphics without creating a path; otherwise the virtual target
exists empty until a page transition or close. One-file mode accumulates pages into one PDF, while
`onefile = FALSE` expands `%d` patterns into independent page files. The DOM-free encoder writes a
PDF header, page tree, base-14 Helvetica/Times/Courier resources, content streams, alpha states,
metadata, cross-reference table, trailer, and EOF marker. Compression uses browser
`CompressionStream("deflate")` when available and the existing standards-compliant stored-DEFLATE
fallback otherwise. Page and output bytes remain under normal evaluator limits. Custom font maps,
non-single-byte encodings, font embedding, exact kerning/glyph metrics, dingbat substitution,
color-profile management, and GNU R byte-identical output remain explicit boundaries.

`base::getLoadedDLLs()` is a separate R-native-module introspection surface, not a view of the
parser Wasm, Worker bundle, JavaScript modules, graphics devices, or host process. It accepts no
arguments and returns a visible list with class `DLLInfoList`. The list has length zero by default;
ordinary list subsetting preserves the class and `vapply(..., "path")` yields `character(0)`.
Construction-time `nativeModules` add named `DLLInfo` records containing the registered name,
virtual path, lookup flags, and `NULL` handle/info fields. `.Call` accepts a character routine name,
applies exact `PACKAGE` confinement plus dynamic/force-symbol and registered-arity checks, forces
the R arguments, and invokes the explicit typed adapter. JavaScript object references and raw host
pointers are never entries or call arguments.

`graphics::persp()` dispatches classed first arguments before its owned matrix default. The default
requires increasing finite x/y coordinates and a two-dimensional real z grid, derives missing grids
over `[0, 1]`, validates finite limits, and leaves edges touching missing z values absent. It
normalizes coordinates separately when `scale = TRUE` or by their common largest range otherwise,
applies `expand`, azimuth/elevation rotations, eye distance, and perspective division, and returns
the resulting column-major `4 × 4` matrix invisibly. The measured default white surface and black
border are represented by projected grid/box line segments in a padded linear window. Explicit
non-white facet colours instead produce ordinary polygon journal entries: colours are assigned in
column-major facet order, complete four-corner facets are sorted by ascending homogeneous
transformed depth, borders recycle by source-facet index, and `border = NA` is transparent.
Missing-corner facets are omitted. The existing Worker, Canvas, raster/vector device, hold/flush,
and record/replay paths therefore need no host 3D object. The `axes` flag is validated, but
directional arrows and axis text are not emitted yet. Shading/light angles, axis arrows/ticks/text,
exact hidden-surface intersections, hooks, and arbitrary graphical parameters remain explicit
boundaries.

The active owned device also records a bounded display list. `recordPlot(load, attach)` snapshots
the current page/window/raster/segments/points/text/polygon/box/boxplot/legend commands into an
independently owned, classed `"recordedplot"` value and preserves the optional package metadata
without loading packages. `replayPlot(x, reloadPkgs = FALSE)` accepts only that NativR-owned format,
replaces the active display list, and routes the recorded commands through the same immediate or
held journal; it returns invisible `NULL`. Display-list command count is limited by
`maxVectorLength`, raster bytes by `maxOutputBytes`, and reset/dispose clears device state.
`reloadPkgs = TRUE` is rejected when stored package metadata would require a namespace loader.
External or serialized GNU R `recordedplot` values, `print.recordedplot`, cross-version
compatibility, complete devices, general high-/low-level plotting beyond the documented
`segments`/`points`/`polygon`/`box`/`legend` slices, axes, complete clipping/margins, graphical
parameters supplied through `...`, broad color-space conversion, fonts, and arbitrary display-list
operations remain outside this increment.

`graphics::pairs()` adds the S3 extension point exercised by rstan's `pairs.stanfit` method. The
generic forces only its dispatch object, then forwards that original object and otherwise lazy
labels, panel functions, parameter selection, condition, and graphical arguments to a
package-defined method. NativR does not reproduce Stan objects or rstan's plotting implementation.
The default matrix/data-frame scatterplot layout, formula method, panel execution, axes, text, and
general graphical parameters remain outside the current graphics-device slice and produce an
explicit unsupported-feature error.

`stats::update()` is an S3-first extension point. It forces only `object` for dispatch and forwards
the original argument promises, including lazy `...`, to the selected method. Inherited class search
and `NextMethod()` reuse the evaluator's ordinary S3 machinery; a package or user-defined
`update.default` can therefore provide its own behavior. If no method exists, NativR reports a
bounded unsupported-feature error because the built-in GNU R default requires stored-call
extraction, language rewriting, formula substitution, and optional re-evaluation that are not yet
implemented.

`colors()` and `colours()` resolve to the same registered `grDevices` builtin. A compact
browser-owned catalog expands to the 657 GNU R 4.6.0 public names in their documented order; a
versioned omission index derives the 502-name `distinct = TRUE` result. Each call returns a fresh
unnamed character vector and does not read DOM, CSS, host locale, network, or GNU R state. The name
catalog's compact aligned RGB table backs `col2rgb` and palette interpolation without consulting
host color APIs.

`colorRamp()` and `colorRampPalette()` are registered `grDevices` builtins. They validate
hexadecimal and catalog named colors, then return first-class numeric-matrix or hexadecimal palette
functions. Linear and not-a-knot/FMM spline interpolation, ordinary RGB, CIE Lab, positive bias,
optional alpha, partial choice matching, non-finite/out-of-range points, and empty or singleton
outputs have differential evidence. The observed isoband path reproduces GNU R's 21-color result,
and unchanged viridisLite 0.4.3 composes a 256-anchor Lab spline through `colorRamp()` into exact
Viridis, Magma, alpha, range, and direction outputs. Conversion uses owned sRGB/D65 transforms and
never consults CSS, Canvas, or a host color service. Other color spaces, device profiles, and
exhaustive coercion/rounding boundaries remain outside this slice.

`hcl()` is a registered `grDevices` builtin with GNU R-shaped defaults and formals. It recycles hue,
chroma, luminance, and optional alpha vectors, converts polar CIE-LUV coordinates through a fixed
D65 white point into sRGB, and emits deterministic uppercase RGB(A) bytes. Non-finite color
coordinates become missing colors; finite chroma/luminance/alpha ranges are validated.
`fixup = TRUE` clips out-of-gamut sRGB channels, while `FALSE` returns a missing color. The path is
pure browser arithmetic and does not consult Canvas, CSS, ICC profiles, locale, network, or GNU R.

`col2rgb()` converts every owned catalog name, transparent/missing specifications, short or long
RGB(A) hexadecimal strings, and positive default-palette indices to a named three- or four-row
integer matrix. Input names become column names, and factors use their labels. `rgb()` performs the
inverse byte formatting used by stringr's measured `col2hex` helper, including recycled numeric
channels, optional alpha and result names, `maxColorValue`, and three-/four-column matrix or data
frame input. The default palette is deterministic session data in this slice; palette mutation,
wide-gamut spaces, and device profiles remain outside it.

`rainbow()`, `heat.colors()`, `terrain.colors()`, `topo.colors()`, and `cm.colors()` share an owned
HSV-to-RGB path while independently constructing each documented classic palette. Results use
deterministic uppercase RGB(A) bytes, recycle optional alpha, reverse only after color generation,
truncate numeric `n`, discard input names, and return an empty character vector for non-positive
counts. `rainbow()` additionally recycles saturation/value vectors and wraps a descending hue range
through red. HCL palette catalogs, palette mutation, broad color-space conversion, device profiles,
and rendering interpretation are separate surfaces.

`gray()` and its `grey()` alias coerce supported atomic gray levels, require finite values in
`[0, 1]`, recycle a nonempty optional alpha vector across the level vector, drop source attributes,
and emit uppercase RGB or RGBA hexadecimal bytes. `gray.colors()` and `grey.colors()` independently
compute the documented `seq(start^gamma, end^gamma)^(1/gamma)` palette, including default/custom or
descending endpoints, zero/fractional counts, gamma zero/negative behavior, alpha composition, and
final reversal. All loops and result allocations are charged to the runtime limits. Vector-valued
start/end/gamma controls, alpha longer than a direct level input, host color profiles, and HCL
palette catalogs are separate surfaces.

`outer()` constructs repeated column-major Cartesian inputs in the runtime, resolves character or
callable `FUN` values through the caller environment, and forwards ellipsis promises without forcing
unused arguments. The returned vector receives the concatenated input dimensions and dimension
names; `%o%` selects the same owned numeric multiplication path. Existing attributes from the
function result are replaced by this output shape, while real/complex `sqrt` and `abs` retain their
input metadata so matrix-valued numeric pipelines remain shaped.

`head()` selects leading elements from vectors, lists, pairlists, expressions, factors, matrices,
and data frames, with negative `n` dropping trailing elements. Matrix and data-frame selection is
row-oriented and preserves their owned dimensions and metadata. `str()` provides deterministic,
bounded structural output for atomic values, matrices, lists, data frames, factors, expressions,
pairlists, environments, closures, and builtins, then returns invisible NULL. Its current
`max.level`, `vec.len`, and `list.len` controls bound recursive output without reproducing every GNU
R print option.

`identical()` performs type-strict recursive comparison across atomic vectors, missing masks,
attributes, lists, pairlists, factors, normalized language/expression values, formulas,
environments, closures, and builtins. `num.eq`, `single.NA`, `attrib.as.set`, `ignore.environment`,
and `ignore.srcref` control the owned representations; `ignore.bytecode` and `extptr.as.ref` are
accepted but have no additional effect because NativR has neither GNU R bytecode nor
external-pointer values.

The initial condition system provides lazy `try()` error capture, classed `try-error` values,
`tryCatch()` error/condition handlers and `finally`, `stop()`, `stopifnot()`, `warning()`,
`message()`, `conditionMessage()`, `suppressWarnings()`, `suppressMessages()`, and `invisible()`.
Messages use the ordered `message` output stream; warnings use the structured warning channel.
Suppression is dynamically nested for the evaluated promise. Evaluation cancellation and resource
limit failures remain uncatchable so R-level handlers cannot bypass the browser sandbox. Calling
handlers, restarts, deferred warning policy, traceback/call reconstruction, custom condition
constructors, class-selective warning/message handlers, and connection-backed `try(outFile=)` remain
outside this slice.

`options()` and `getOption()` use evaluator-owned session state with deterministic browser defaults.
Exact character queries never partially match; named values set or remove options and return their
previous values invisibly, while pure queries are visible. Named lists set multiple options, missing
lookups evaluate `default` lazily, and runtime reset restores the defaults. `digits` and `max.print`
feed the browser-safe print formatter. The complete GNU R option catalog and every downstream option
consumer are not yet implemented.

`Sys.getenv()`, `Sys.setenv()`, and `Sys.unsetenv()` use a separate evaluator-owned string map.
`createR({ environmentVariables })` is the only host-to-session admission path; the input is
snapshotted, each Worker receives its own copy, and neither Node `process.env` nor browser globals
are consulted. Queries preserve GNU R's scalar/multiple-name rules, `unset = NA`, all-variable
`Dlist` shape, coercion, and factor-name attributes. Named setters apply in order, duplicate names
use the last value, and unset returns one logical result per request. Reset reconstructs the initial
map, while disposal drops it. Empty values remain explicit entries as a deterministic
platform-neutral browser rule rather than inheriting operating-system-specific `setenv` behavior.

`Sys.which(names)` uses an independent construction-time executable map. Only
`createR({ executablePaths })` can admit name/path pairs; the record is validated, snapshotted,
copied through Worker initialization, and restored on reset. Queries coerce atomic, factor, list,
pairlist, symbol, call, and expression inputs to command text, preserve order and duplicates, return
one named path or empty string per command, and keep missing query values missing. Default sessions
therefore report every non-missing tool as absent without consulting PATH, PATHEXT, browser globals,
the host filesystem, or `systemCommand`. The current generic names representation encodes the name
of a missing query as the literal `"NA"`; GNU R keeps an `NA_character_` name. Host-specific search,
path canonicalization, executable-bit checks, and GNU closure identity remain explicit depth.

`readline(prompt)` is non-interactive by default: it emits the prompt with a trailing newline and
returns a visible empty character scalar, while `interactive()` returns `FALSE`. Supplying
`createR({ readline })` authorizes a line-input adapter for that session, makes `interactive()`
return `TRUE`, and lets evaluation await one inline or Worker-correlated host response. Prompts are
coerced and limited to 256 characters; returned leading/trailing spaces and tabs are removed.
Multiline, NUL-containing, and oversized host values are rejected before they enter runtime state.
This models the interaction capability used by package R code, not GNU R's terminal REPL.

`capabilities()` returns GNU R's 19-name logical-vector shape and exact `what` selection order,
including duplicate known names and omission of unknown names. Every entry is `FALSE` because the
network-free browser runtime does not expose GNU R native screen-device capabilities, Tcl/Tk,
sockets, host filesystem FIFOs, native profiling, native localization/iconv, Cairo, ICU, long
double, or libcurl through the R surface. The internal `Xchk` formal is accepted without forcing,
matching the observed public call contract.

Locale inspection is deterministic and session-local. `.LC.categories` exposes the nine GNU R
category names; `Sys.getlocale()` begins at C, `Sys.setlocale()` mutates supported state, and reset
restores C. `Sys.localeconv()` returns the 18-name character-vector shape from that state. In
addition to C, the owned `LC_MONETARY` table covers Italian and US UTF-8 aliases used by the
measured package examples. It never reads or mutates browser/OS locale globals, and unsupported
profiles warn instead of silently substituting the user's host locale.

`l10n_info()` exposes the adjacent encoding-capability shape as a visible named list. The portable
GNU R fields are `MBCS = TRUE`, `UTF-8 = TRUE`, and `Latin-1 = FALSE`; because NativR targets
`wasm32-unknown-browser` rather than Windows, the platform field is `codeset = "UTF-8"` instead of
invented Windows codepages. These values describe the owned browser text representation. C-locale
collation, names, dates, and numeric formatting remain separate deterministic policy, and monetary
profile changes do not alter the native UTF-8 encoding report.

`shQuote()` is a deterministic character transformation. Omitted `type` selects `sh` for NativR's
non-Windows browser platform; explicit `sh`, `csh`, `cmd`, and `cmd2` reproduce the documented
quote, escape, backslash-doubling, and caret-prefix rules. Type names partially match as in
`match.arg`, the four-choice formal default is visible through `formals`, ordinary `as.character` S3
methods can participate, and the output drops source attributes. This function never calls `system`,
a Worker host handler, or any native shell.

`match.fun()` accepts direct closures/builtins, symbols, and one-element character names. Name
lookup begins in the parent of its caller and, when `descend = TRUE`, skips non-function bindings;
direct callables leave `descend` lazy. This is the shared lookup path used by unchanged package
code, not a package registry shortcut.

`utils::sessionInfo()` assembles a classed named list from the same evaluator-owned state. It
reports `wasm32-unknown-browser/nativr` and `Browser JavaScript (NativR)` instead of leaking or
misrepresenting the host operating system, identifies R 4.6.1 as the compatibility target, exposes
the active locale and three RNG kind names, lists the seven attached core packages, and reports the
runtime's UTC/internal time-zone contract. Native BLAS/LAPACK strings and loaded-only packages are
empty because the interpreter does not load those host facilities. Explicit `package=` description
enumeration and the display/LaTeX methods remain outside this slice.

`round()` vectorizes over both `x` and `digits` without a recycling warning, applies ties-to-even to
the exact binary input value, supports real and complex vectors, distinguishes missing digits from
numeric NaN, preserves `NA`/`NaN`/infinities and signed zero, and retains input attributes when the
result length does not change. Decimal scaling is implemented with bounded integer arithmetic rather
than host-locale formatting. Direct `round.<class>` methods take precedence over `Math.<class>`
group methods. `zapsmall()` exposes the documented four formals, derives the relative rounding
precision from a caller-supplied magnitude function, respects `min.d`, and delegates final rounding
through that same S3/Math path. Its real, complex, missing, matrix-attribute, and custom-method
behavior is covered by black-box differential evidence.

`signif()` vectorizes over `x` and `digits`, rounds finite real values to 1–22 significant decimal
digits with ties-to-even, and uses a shared component scale for complex values. Fractional digit
controls round to the nearest integer before clamping; missing digits produce `NA`, numeric `NaN`
remains `NaN`, and non-finite values and signed zero are preserved. Unchanged-length results retain
the input attribute map. Direct `signif.<class>` methods take precedence over `Math.<class>` group
methods; dynamic `.Generic`/`.Group` bindings and exhaustive platform conversion identity remain
outside this slice.

`ceiling()` returns double storage for real logical, integer, and double inputs, applies upward
rounding element-wise, preserves the complete owned attribute map, and keeps explicit `NA`, ordinary
`NaN`, signed zero, and infinities distinct. Direct `ceiling.<class>` methods take precedence over
basic `Math.<class>` group methods. Factors, Date/POSIXt values, complex vectors, and nonnumeric
defaults produce bounded errors. Dynamic `.Generic` and `.Group` bindings within group methods and
the built-in data-frame Math family are not yet supplied.

`stats::approx()` regularizes numeric coordinates, sorts them, removes incomplete pairs by default,
and collapses duplicate `x` positions through mean, min, max, ordered-last, or callable reducers. It
evaluates linear or constant interpolation on an explicit `xout` vector or a bounded, equally-spaced
`n` grid; `rule`, `yleft`, `yright`, and `f` control endpoint and step behavior. Explicit output
coordinates are returned unchanged, retaining Date-like or other owned numeric attributes, while
interpolated `y` is a plain double vector with distinct NA and NaN propagation. Named `x`/`y` lists,
two-column numeric matrices, and the one-vector `y` shorthand are supported. `approxfun`, the
complete `xy.coords` coercion surface, list-valued tie specifications, and every non-finite
interpolation corner remain outside this path.

`stats::nlm()` accepts a finite nonempty numeric parameter vector and invokes its objective with
that vector plus lazily forwarded `...` arguments. The objective must return one finite numeric
value and may attach finite `gradient` and matrix-shaped `hessian` attributes. NativR checks an
initial analytic gradient when requested, warns and falls back to central finite differences on
mismatch, and otherwise uses an independent bounded BFGS inverse-Hessian update with Armijo line
search. `hessian`, `typsize`, `fscale`, `ndigit`, `gradtol`, `stepmax`, `steptol`, `iterlim`, and
`check.analyticals` controls are supported with exact post-dots matching; unknown named arguments
remain lazy objective arguments. Results use GNU R's `minimum`, `estimate`, `gradient`, optional
`hessian`, `code`, and `iterations` fields. Trace output, more than 64 parameters, iteration limits
above 10,000, and numerical identity with GNU R's PORT implementation are not claimed.

`stats::optim()` supports BFGS, L-BFGS-B, Nelder-Mead, and conjugate-gradient paths with a scalar
finite `fn`, an optional finite vector-valued `gr`, and lazily forwarded `...` arguments shared by
both callbacks. Named initial parameters retain their names in every callback and in the result.
Without `gr`, central finite-difference gradients are computed on the scaled parameter coordinates.
The bounded independent BFGS loop uses inverse-Hessian updates and Armijo line search; the bounded
CG loop supports Fletcher-Reeves, Polak-Ribiere, and Beale-Sorenson updates selected by
`control$type` and restarts non-descent directions. `fnscale`, `parscale`, `ndeps`, `maxit`,
`abstol`, and `reltol` controls cover minimization or maximization and coordinate scaling, while
`hessian = TRUE` adds a named numerical Hessian. Results expose `par`, `value`, named
function/gradient `counts`, `convergence`, `message`, and optional `hessian`. Arguments after `...`
require exact formal-name matching. L-BFGS-B accepts recycled finite/infinite bounds, clips the
initial point, applies `parscale`, and routes value/gradient callbacks plus `lmm`, `factr`, and
`pgtol` controls through the browser-contained Wasm backend. SANN, Brent, trace output, remaining
method-specific controls, more than 64 parameters, and exhaustive native-algorithm trajectory
identity remain outside this slice.

`log()`, `log10()`, `log2()`, and `log1p()` provide vectorized real and complex logarithms.
`log(x, base)` recycles both operands without a recycling warning and drops `x` attributes only when
a longer base changes the result length. `exp()` and `expm1()` preserve input length and attributes,
with stable near-zero real paths and explicit complex formulas. Invalid real logarithm domains emit
one `NaNs produced` warning per call. Math/Math2 S3 dispatch and exhaustive platform-libm edge
equivalence remain outside this slice.

The base environment installs `pi` as a locked double binding. `tan()` accepts logical, integer,
double, and complex vectors, preserves attributes and the distinct NA mask, and uses stable explicit
complex identities for finite values and large imaginary magnitudes. Infinite real inputs emit one
domain warning; infinite imaginary inputs converge to signed unit imaginary values. Math-group
dispatch and bit-for-bit agreement across every browser math library remain outside this slice.

`factorial()` accepts logical, integer, and double vectors and always returns doubles with the input
attributes and missing-value mask. Finite non-negative integers through 170 use direct products;
larger integers overflow to positive infinity. Other real values use an independently implemented
Lanczos approximation to `gamma(x + 1)` with reflection for negative non-poles. Negative integers
and negative infinity produce NaN and one call-level warning. Complex inputs, group dispatch,
near-pole precision warnings, and the broader gamma/beta/polygamma family remain outside this slice.

`stats::lsfit()` exposes the direct least-squares layer used by xfun's measured structural
inspection example. It accepts a real vector or two-dimensional predictor matrix and one real
response, optionally adds an intercept, validates non-negative row weights and positive tolerance,
and removes rows containing `NA` or `NaN` before fitting. The existing owned pivoted Gram-Schmidt/QR
solver returns named coefficients, full-row residuals with omitted entries restored as missing, the
intercept flag, optional original weights, and a classed `qr` list with `qt`, `qr`, `qraux`, `rank`,
`pivot`, and `tol`. Multiple response columns, `yname` shaping, and exact LINPACK reflector storage
remain outside this bounded path.

`strwrap()` provides browser-native paragraph wrapping for the measured xfun example. It coerces
atomic inputs to character paragraphs, maps missing strings to `"NA"`, splits embedded blank-line
paragraphs, and wraps words using GNU R's strict line-width fit and double spacing after sentence
punctuation. `indent`, `exdent`, `prefix`, and `initial` affect the first and following lines, while
`simplify = FALSE` returns one character vector per input element. Names and other input attributes
are dropped. Display-width calculation is currently Unicode-code-point based rather than a
locale-aware terminal-width implementation.

`simplify2array()` provides the shared list-to-vector/array simplification used directly by
stringi's measured examples. Equal scalar results become an atomic vector with outer names;
equal-length vectors use the ordinary atomic promotion ladder and become a column-major matrix,
while unequal lengths return the original list. Equal-dimensional arrays can append an outer axis
when `higher = TRUE`, carrying the first element's dimension names and the outer list names. List
cells produce list matrices, and `except` controls lengths that remain flat. Method/class-specific
coercion, long vectors, arbitrary recursive objects, and every legacy diagnostic remain outside this
bounded slice.

`str2expression()` and `str2lang()` send character input through the same Tree-sitter R parser and
normalization boundary as `parse(text=)`. The former returns an owned expression vector and treats
its input elements as source lines; the latter requires one character element and exactly one parsed
expression, then returns the corresponding owned call, symbol, NULL, or atomic constant. Neither
function exposes Tree-sitter nodes, compiles JavaScript, executes generated source, retains source
references, nor accepts host files/connections. Encoding metadata and byte-for-byte GNU R parse
diagnostics remain outside this slice.

`utils::URLdecode()` decodes percent-encoded ASCII and well-formed UTF-8 byte runs without network,
DOM, locale, or host URL APIs. It is vectorized, leaves `+` literal, maps missing character elements
to the observed `"NA"` string, drops input attributes, returns an empty character vector for NULL,
and truncates at a decoded NUL as GNU R does. Malformed `%xx` syntax and invalid UTF-8 byte
sequences raise explicit unsupported-feature errors because NativR's JavaScript string
representation cannot preserve GNU R's platform-dependent unknown/raw-byte strings losslessly.

`utils::glob2rx()` converts owned character-like values to regular-expression strings without
consulting a filesystem or invoking a host glob/regex engine. Each pattern is independently
translated (`?` to `.`, `*` to `.*`, and the documented subset of regex punctuation is escaped),
then anchored at both ends. `trim.tail` removes a terminal wildcard and end anchor; `trim.head`
subsequently removes an initial wildcard and start anchor. Pattern coercion follows the observed R
character-conversion shapes, result attributes are dropped, NULL produces `character(0)`, controls
use scalar logical coercion, and output allocation remains bounded. This is a text conversion
helper: matching files, platform path syntax, encoding-byte preservation, and undocumented
escape-normalization behavior are not claimed.

`sQuote()` wraps text after owned-value character coercion and always returns an unclassed character
vector with input attributes removed. The resettable `useFancyQuotes` option defaults to `FALSE`,
matching NativR's deterministic C locale. Explicit `"UTF-8"` selects U+2018/U+2019, `"TeX"` selects
grave/apostrophe, and a character vector of at least four elements supplies the opening and closing
single-quote strings in its first two positions. NULL produces `character(0)`, missing elements
become quoted `"NA"` text, and no quote escaping or host-locale lookup occurs. Atomic, factor,
list/pairlist, symbol/language/expression, and bounded normalized-formula inputs are covered; custom
`as.character` methods, byte encodings, locale-dependent `q = TRUE` outside C, and exact
round-tripping of formula syntax lost by the normalized formula representation are not claimed.

`warningCondition()` constructs an owned condition list whose first fields are `message` and `call`,
followed by the arguments captured through `...` in source order, including duplicate or unnamed
fields. Atomic messages and custom classes use the ordinary character coercion path; custom classes
precede `warning` and `condition`. `conditionMessage()` returns the stored character vector, and the
measured `suppressWarnings(condition, "testWarning")` expression preserves the condition value.
Missing or empty custom class elements are explicitly rejected because the owned class metadata
model cannot represent them. Signaling arbitrary classed warning objects, class-specific
calling-handler dispatch, missing class metadata, and exhaustive legacy diagnostics remain outside
this constructor slice.

`simpleCondition()`, `simpleError()`, `simpleWarning()`, and `simpleMessage()` produce the standard
two-field owned condition shapes with exact formals. `srcfilecopy()` creates the documented
browser-owned source-file environment and metadata while remaining disconnected from host files.

`stats::qnorm()` maps probabilities through the owned central-normal quantile approximation already
used by the Student-t path, with stable tail symmetry, vectorized `mean`/`sd`, recycling, ordinary
or log probabilities, and longest-input metadata. `stats::qbinom()` binary-searches the first
integer whose independently computed regularized-beta CDF reaches the requested probability. It
supports vectorized `size`/`prob`, rounded sizes, degenerate distributions, lower/upper tails, log
probabilities, missingness, and attributes. Binomial sizes above 10,000,000 and finite normal log
probabilities that underflow the browser double range raise explicit unsupported-feature errors.
Bit-for-bit equivalence for all extreme tails, arbitrary-size binomials, noncentral distributions,
and every platform libm boundary is not claimed.

`stats::pnorm()` vectorizes and recycles `q`, `mean`, and `sd`, reads the first lower-tail and
log-probability controls, and carries attributes from the first longest numeric input. Central
normal tails reuse the independently implemented regularized-gamma calculation. Far log tails use a
direct Mills-ratio expansion, while large log probabilities are formed with `log1p`, avoiding
intermediate browser-double underflow and cancellation. Zero standard deviations produce the
documented point-mass limit; negative deviations and indeterminate non-finite arithmetic produce one
call-level NaN warning, while missing values and input NaNs remain distinct.

`with()` evaluates lazily captured expressions against named list, pairlist, or data-frame masks
whose lexical parent is the caller; an environment is used directly, while other data values follow
GNU R's caller-environment fallback. Mask assignments remain isolated, but assignments through an
environment mutate that environment. `local()` evaluates in a fresh child environment by default or
a supplied environment. It creates a function-like control scope so explicit `return` and `on.exit`
handlers run on normal completion or failure. `eval`, `with`, and `local` propagate the final
expression's visible or invisible result. Custom `with` methods, active bindings, and full
search-path behavior remain outside this slice.

`sys.calls()` and `sys.frames()` return aligned pairlists for active R closure frames, and
`sys.nframe()` returns their shared integer depth. Calls remain normalized language objects and
frames remain evaluator-owned environments; browser host stack frames are never exposed. `topenv()`
walks owned parent links to explicit matches, global, base, package, or namespace boundaries and
honors the session `topLevelEnvironment` option. The locked `.GlobalEnv` binding always identifies
the session's current global environment, including after reset. `sys.parents()`, promise-evaluation
frames, native frames, and the distinct GNU R base-namespace environment remain explicit depth.

`all.equal()` returns scalar `TRUE` for equality and character diagnostics otherwise. Its bounded
comparison covers integer/double tolerance and scale, real/complex missing and non-finite values,
attribute controls, recursive lists/pairlists, and the remaining owned value model through strict
fallbacks. `isTRUE()` and `isFALSE()` provide the scalar logical predicates commonly used around
these results. Exact GNU R diagnostic wording, every method-specific control, custom dispatch, and
cyclic environment content comparison remain outside this slice.

`ifelse()` coerces an atomic test to logical, retains the test's attributes, recycles selected
branch values by result position, and promotes the result through GNU R's atomic ladder or to an
ordinary list. The `yes` branch is forced only when a true test exists, and `no` only when a false
test exists; missing test positions remain typed missing values. Raw branches and non-vector
replacement objects are rejected in this bounded slice.

`any()` and `all()` eagerly force every data argument, use false and true respectively as their
empty identities, and implement three-valued logical reduction with exact `na.rm` control-name
matching. Logical/integer vectors are accepted directly; other atomic vectors and scalar ordinary
lists follow the documented coercion-warning path. Classed vectors and non-scalar list elements are
rejected until Summary-group dispatch is implemented.

`subset()` captures its predicate and column-selection expressions without forcing them first. Named
lists and data frames provide a data mask whose parent is the caller; missing predicate positions
are removed. Matrices and data frames use the shared rectangular selector with `drop = FALSE` by
default, while ordinary vectors and lists use one-dimensional logical selection. Function-position
lookup walks past non-callable bindings, so a column such as `c` remains available as a value
without shadowing the base `c()` callable. Custom subset methods and the full S3 method surface
remain outside this slice.

`rm()` and its `remove()` alias capture identifier/string arguments without evaluating the named
objects, combine them with forced `list=` names, and delete from the selected environment or the
first inherited environment containing the binding. Missing objects produce warnings; successful
calls return invisible NULL. Numeric/character search-path positions beyond `-1` are not supported.

`rev()` delegates to one-dimensional owned-vector selection, reversing values and names while
preserving class, levels, and data-frame row names; matrix dimensions drop as in GNU R. `cumsum()`,
`cumprod()`, `cummax()`, and `cummin()` preserve names but drop dimensions, propagate explicit
missing values through the remaining prefix, retain numeric NaN, support complex sums/products, and
emit a stable warning when integer `cumsum` overflows.

Sorting is stable. Matching and distinctness use type-aware keys that distinguish explicit NA and
numeric NaN. The apply/map family invokes closures and builtins through the evaluator so normal
resource accounting remains active.

`base::tapply()` partitions an owned vector-like input by one or more same-length atomic grouping
vectors. Factor levels determine column-major array extents and dimnames; non-factor groupings use
the existing deterministic split ordering, and missing group positions are omitted. `FUN = NULL`
returns integer cell codes without array attributes. Otherwise, callbacks receive named subsets and
forwarded arguments: single atomic results simplify with a typed `default`, while vector, recursive,
or explicitly unsimplified results remain indexable list arrays. Formula indexes, custom split
methods, and arbitrary class-specific simplification are not implemented.

`setequal()` uses those same type-aware keys for atomic sets, recursively compares list elements,
and treats order and duplicates as irrelevant. Owned data frames take an independent row-set path
with column-name alignment; this supplies the two measured dplyr call shapes while package loading
remains outside the runtime. Rectangular selection preserves the source data-frame class chain, and
`tbl_df` inputs keep one selected column as a table even when ordinary data frames would drop it.

Each evaluator owns a deterministic pseudorandom state. `RNGkind()` reports or selects the uniform,
normal, and discrete-sampling kinds and returns the prior three names invisibly when it mutates the
state. Unique prefixes and `default` selections follow the documented R surface. Browser-native
generation covers Mersenne-Twister, Marsaglia-Multicarry, Wichmann-Hill, and L'Ecuyer-CMRG uniform
kinds plus the default Inversion, Box-Muller, historical Buggy Kinderman-Ramage, and corrected
Kinderman-Ramage normal kinds; discrete sampling covers Rounding and Rejection. CMRG uses a
GNU-shaped seven-integer state and exact published 2^127 stream and 2^76 substream matrix jumps via
`parallel::nextRNGStream` and `parallel::nextRNGSubStream`. `set.seed` resets the selected engine,
and fixed-seed `runif` sequences have executable GNU R black-box evidence. `sample.int()` uses the
selected discrete sampler for integer and large double-valued populations. Its Rejection path
assembles unbiased candidates from 16-bit uniform chunks; no-replacement sampling uses either an
owned sparse swap map or the documented fixed-population hash path. The evaluator installs the R 4.6
x64 `.Machine` constant shape, including `integer.max`, as an owned named list. Other uniform and
normal names remain queryable but are explicit unsupported selection boundaries. Buggy
Kinderman-Ramage reproduces the pre-1.7 normal stream, including its historical triangular
coefficient and omitted near-zero density acceptance test. Corrected Kinderman-Ramage uses the
published coefficient, restores that density test, and rejects negative half-normal candidates.
Sampling and the documented distribution constructors consume the selected state in order. Weighted
sampling validates finite, non-negative probabilities.

`RNGversion(vstr)` parses the first atomic version value and chooses the documented default-kind
triple. Versions before 0.99 select Wichmann-Hill/Buggy Kinderman-Ramage/Rounding; versions from
0.99 through 1.6 select Marsaglia-Multicarry/Buggy Kinderman-Ramage/Rounding; R 1.7 through 3.5
selects Mersenne-Twister/Inversion/Rounding; R 3.6 and future versions select
Mersenne-Twister/Inversion/Rejection. The previous triple is returned invisibly. Fixed-seed
Wichmann-Hill, Marsaglia, R 1.6 sampling, and Buggy Kinderman-Ramage normal sequences have
differential evidence, including all five published rejection regions. Corrected Kinderman-Ramage
has separate fixed-seed and near-zero-correction differential cases.

The historical uniform implementations use the published Wichmann-Hill modular recurrence, Marsaglia
multiply-with-carry construction, and L'Ecuyer MRG32k3a recurrence/jump matrices cited by the public
[R random-generation manual](https://stat.ethz.ch/R-manual/R-devel/library/base/html/Random.html).
Seed-state shape and output values were established only through black-box `.Random.seed`/`runif`
observations from a separate R process. No GNU R or package implementation code was imported or
translated.

`quantile()` implements the nine documented sample-quantile algorithms directly over the owned
vector model. `IQR()` computes the 0.25/0.75 spread through the selected type, with explicit
missingness and coercion rules rather than delegating to a host statistics library.
`stats::ppoints(n, a)` constructs the probability grid consumed by posterior's measured quantile
examples. A multi-element observation value contributes its length; a scalar real `n` supplies the
count directly. The default offset is 3/8 through 10 points and 1/2 thereafter. Explicit real or
complex offsets follow ordinary vector recycling, preserve their attributes when they determine the
output shape, and retain missingness. Nonpositive counts return before forcing `a`; sequence and
result allocations remain subject to `maxVectorLength`.

`base::chol()` first exposes ordinary S3 dispatch, which supplies the extension seam used by
posterior's measured `chol.rvar` call. The owned default converts scalar, real matrix, or numeric
data-frame input to column-major doubles and reads only the upper triangle. Its direct algorithm
returns upper `R` with `t(R) %*% R = x`, while optional complete diagonal pivoting accepts
positive-semidefinite inputs and attaches one-based `pivot` plus integer `rank`. Dimnames survive,
unused dots remain unforced, `tol` is forced, and the defunct `LINPACK` argument is rejected.
Complex, non-finite, empty, nonsquare, and non-positive-definite unpivoted inputs fail explicitly;
all copied matrices and factors remain bounded by the evaluator allocation limits.

`stats::density()` first performs ordinary S3 dispatch with the original lazy arguments. Its
independent default method then evaluates a weighted Gaussian kernel directly over an owned numeric
grid, including `nrd0` bandwidth selection and missing-value filtering. It constructs the classed
`density` result entirely from runtime vectors and does not call a host statistics library or
execute generated code. Package-owned posterior and distributional methods remain external to
NativR; the generic provides their dispatch boundary without reproducing their algorithms.

`eigen()` copies a finite real matrix into evaluator-owned storage. In the public runtime, symmetric
inputs use the embedded LAPACK 3.12.1 `DSYEVR` WebAssembly backend; explicit symmetry reads the
lower triangle. Bounded one- through three-dimensional asymmetric inputs derive characteristic roots
and normalized real or complex right-null vectors. Results remain typed runtime vectors and
matrices. No host BLAS/LAPACK installation, network request, filesystem access, or generated
JavaScript is used.

`colSums()`, `rowMeans()`, and `colMeans()` traverse the owned column-major array representation.
Column summaries reduce contiguous groups formed by the first `dims` axes; row means stride over the
remaining axes. Logical, integer, and double inputs produce double storage, while complex means use
parallel real/imaginary accumulators and the runtime's independent missing mask. Numeric data-frame
columns are traversed as a virtual column-major matrix without materializing a host matrix. Missing
and `NaN` values are removed per output group only when `na.rm = TRUE`; surviving dimension-name
axes are rebuilt on the result. Automatic data-frame row names remain internal while explicit row
names become result names. Empty groups retain GNU R's `NaN` mean behavior. These operations use no
host numeric library.

`stats::weighted.mean()` is an ordinary S3 generic. Its default path walks equal-length owned
numeric or complex vectors once, accumulates the weighted numerator and weight total directly, and
returns an attribute-free scalar. Zero weights omit the paired value before missingness is applied;
`na.rm` removes a missing `x` together with its paired weight; and any remaining missing or `NaN`
weight produces an owned missing result. Infinite and zero total weights retain ordinary
IEEE-754/GNU R non-finite outcomes. Custom S3 methods receive the original lazy arguments.

`stats::mad()` collects the owned real numeric values, removes `NA` and `NaN` only under `na.rm`,
sorts once for a default center, then sorts absolute deviations for the ordinary, low, or high
median. The documented scale constant is applied to the selected deviation median. Results are
attribute-free double scalars, and empty or unremoved-missing inputs return the owned missing
scalar. Resource checkpoints and allocation accounting cover both passes.

`stats::rbeta()` draws two evaluator-owned gamma variates on the log scale and forms their ratio
without underflow-prone host-library calls. Zero and infinite shapes take their limiting point-mass
paths directly. Explicit finite non-centrality first draws the independently represented Poisson
mixture index, then reuses the same gamma-ratio path. Numeric parameters recycle to the result
length, while a multi-element `n` requests `length(n)` values. Invalid or missing parameters produce
`NaN` with one evaluation warning; an empty parameter produces owned missing values. The result is
an attribute-free double vector, and all draws advance only the session's resettable RNG state.

`stats::rgamma()` exposes that evaluator-owned gamma sampler directly. A multi-element `n` requests
`length(n)` draws; otherwise its non-negative scalar is truncated. Shape and rate/scale vectors
recycle to that fixed length without carrying attributes or issuing recycling warnings. `rate` is
converted to reciprocal scale, equivalent supplied rate/scale pairs warn, and inconsistent pairs
fail before drawing. Zero shape or scale returns zero, infinite positive parameters follow their
documented limits, and empty parameters return owned missing values. Invalid, missing, or NaN
parameters produce `NaN` with one call-level warning. Reseeding resets the same session stream used
by every other random builtin.

`stats::rlnorm()` applies `exp(meanlog + sdlog * Z)` to the same evaluator-owned Inversion normal
stream. A multi-element `n` requests its length; otherwise the non-negative scalar is truncated. Log
means and deviations recycle without a fractional-recycling warning, and output drops their
attributes. Zero deviation returns the point mass `exp(meanlog)` without consuming RNG state.
Missing/NaN means and negative/non-finite deviations produce `NaN`, while empty parameter vectors
produce missing values; either path emits one call-level warning. Infinite means with finite
non-negative deviation retain their zero/infinity limits. Alternative normal generators and the
remaining log-normal distribution family are not implemented.

The complete `stats::dcauchy()`/`pcauchy()`/`qcauchy()`/`rcauchy()` family vectorizes and recycles
location and scale parameters using GNU R-shaped defaults and formals. Density, probability, and
quantile results inherit the first longest numeric argument's metadata; stable reciprocal-angle and
`log1p` identities retain far ordinary/log tails. Missing values propagate, invalid domains produce
one aggregate warning, and zero-scale distribution queries follow their documented degenerate or
undefined cases. Random generation uses one evaluator-owned uniform draw for each valid
positive-scale result, consumes none for a zero-scale point mass, drops parameter attributes, and
uses the scalar-or-vector `n` length rule. Empty random parameters produce missing results with one
warning. No host entropy or host distribution routine is used.

`stats::dbinom()` evaluates binomial mass on the log scale, then exponentiates only for ordinary
probability output. Edge counts below 64 accumulate a direct log-product coefficient; larger counts
use the owned Lanczos log-gamma approximation. Quantile, size, and probability vectors recycle to
their maximum length, and the first longest input supplies result metadata. `NA` remains owned
missingness, ordinary `NaN` remains `NaN`, non-integer quantiles return zero or negative infinity
with a warning, and invalid sizes or probabilities return `NaN` with one aggregate warning.

`base::mat.or.vec()` first evaluates the original `nc == 1L` branch condition. That exact branch
allocates an attribute-free double vector whose length is the truncated scalar `nr`; every other
branch validates and truncates the first real row/column extents, allocates zero-filled owned double
storage, and attaches two-dimensional column-major metadata. Zero extents are valid. Allocation is
charged to the evaluation context before typed-array construction, and oversized products fail the
browser resource contract.

Primitive `base::seq.int()` checks the first supplied classed argument through the evaluator's
internal `seq` S3 method path before ordinary argument matching. Its default path interprets a lone
real scalar as the endpoint from one and other lone values by their owned length; explicit finite
steps and requested/along lengths generate checkpointed values. Attribute-free integer storage is
used when every result fits signed 32-bit range, otherwise double storage is used. Length and
allocation limits are charged before materialization.

`methods::setAs()` records an explicit source/target closure in evaluator-session state and returns
invisible NULL. `methods::as()` first recognizes identity and integer/double-to-`numeric` coercions,
then searches the object's explicit or implicit classes, including parents declared by `setClass()`
or `setOldClass()`. A matching registered closure receives the original owned object; otherwise a
callable core `as.<Class>` constructor is used. This supplies data.table's measured IDate/ITime
extension shape when that package's independently defined constructors and registrations are
present. `methods::setOldClass()` records a non-empty character class chain in the same
evaluator-session metadata and invisibly returns `NULL`; each earlier class inherits the trailing
classes for bounded S4 generic and coercion lookup. Prototype values and an explicit `where`
environment are accepted, but namespace-scoped metadata, `test = TRUE`, explicit `S4Class` bridges,
replacement coercions, S4 slot validation, and the complete methods selection/cache protocol remain
outside this slice.

`methods::is()` queries that same class graph for one requested class. It recognizes explicit and
implicit classes, declared parents, integer values as `numeric`, ordinary non-callable values as
`vector` only when no explicit class is present, and `ANY` for unclassed values. Environment parent
links are mutable R references: `parent.env<-` validates the replacement, walks the proposed parent
chain before mutation, and rejects cycles without changing the target.

`kappa()` converts supported vectors, matrices, and numeric-coercible data frames to owned
column-major storage. Its default path computes a Householder QR factor and applies a bounded
triangular 1-norm estimator; wide inputs are transposed before factorization. `exact = TRUE`
computes the ratio of extreme singular values through an owned symmetric Jacobi eigensolver, while
`method = "direct"` combines an explicit matrix norm with an owned inverse. Triangular controls and
`qr`/`lm` methods share these paths. No host BLAS/LAPACK binding, native library, network request,
or generated JavaScript is used.

`xtabs()` evaluates its normalized formula in a data-frame, named-list, environment, or formula
environment mask. Factor axes retain declared levels by default; character and numeric axes derive
sorted observed levels. Counts use integer storage, numeric responses preserve integer or double
aggregation, and matrix responses append a response-column dimension. `subset`, `na.rm`, `addNA`,
`na.omit`, `exclude`, and unused-level dropping are applied before column-major accumulation. The
result carries `c("xtabs", "table")`, named dimension axes, and its owned call value. Sparse output
is an explicit unsupported boundary because it requires external Matrix class architecture.

`kmeans()` converts finite numeric vectors, matrices, and numeric data frames into owned
column-major storage. Explicit centers are copied into the runtime; scalar center counts draw
distinct rows from the evaluator's deterministic session RNG, and `nstart` retains the least
within-cluster-sum-of-squares fit. Hartigan-Wong uses an owned optimal-transfer pass, Lloyd and
Forgy use batch reassignment, and MacQueen uses online transfers. The implementation never calls a
host statistics library. The standard cluster, center, sum-of-squares, size, iteration, and fault
fields are computed from the final owned assignments.

`convolve()` evaluates circular correlation/convolution, zero-padded open convolution, and
valid-window filtering over owned real or complex storage. Short inputs use pairwise accumulation;
larger one-dimensional inputs use an in-place radix-2 transform or a Bluestein reduction for
arbitrary lengths. Conjugation, output rotation, factor warnings, global NA/NaN propagation, and
mode-specific names/attributes are applied explicitly around that NativR-owned Fourier backend.
Matrix-shaped circular inputs use column-major multidimensional modular indices. No host FFT, native
library, runtime network request, or generated JavaScript is involved.

`as.hexmode()` represents hexadecimal modes as owned signed 32-bit integer vectors with a `hexmode`
class. Integer inputs retain their non-class attributes, integral doubles and valid base-16 strings
are checked before conversion, and negative values stringify through their two's-complement 32-bit
representation. `as.character` emits unpadded lower-case digits, while `format` applies a common or
explicit zero-padded width and optional upper case. One-dimensional selection retains the class, and
`!`, `&`, and `|` run explicit 32-bit bitwise operations in the JavaScript operator backend so
inline and Worker evaluation share the same path.

`as.roman()` creates owned integer vectors with a `roman` class for values from 1 through 4999.
Numeric inputs truncate toward zero before range validation; canonical case-insensitive Roman and
unsigned decimal character inputs are accepted, and the documented one-through-six repeated-`I`
historical forms normalize to canonical output. `utils::as.roman` resolves through the registered
core namespace. `as.character` emits canonical numerals, `format` uses left-justified common or
explicit widths, and matrix dimensions/dimnames survive construction.

Central Student-t probabilities use a continued-fraction regularized incomplete beta calculation;
quantiles invert that monotone tail with a bounded bracket. `pt()` and `qt()` therefore remain
browser-native and preserve tail precision without calling a host statistics service.

Date values are UTC days since 1970-01-01; POSIXct values are UTC seconds. `as.POSIXlt()` converts
those values, numeric epoch seconds, factors, and strict ISO character input into an owned list of
`sec`, `min`, `hour`, `mday`, zero-based `mon`, years since 1900, `wday`, zero-based `yday`,
`isdst`, `zone`, and `gmtoff`. The class is `c("POSIXlt", "POSIXt")`; `length()` follows the `sec`
component rather than the internal list length, and the component names remain visible through
`unclass()`. Fractional seconds and non-finite `sec` values are retained while unavailable calendar
components are missing. Strict parsing and UTC/GMT-only conversion avoid browser-locale dependence.
Named regional zones and daylight-saving transitions remain outside this slice. `Sys.Date` and
`Sys.time` explicitly expose the host clock.

`ISOdate()` and `ISOdatetime()` share an owned numeric-component constructor. Both recycle year,
month, day, hour, minute, and second vectors, retain fractional seconds, return
`c("POSIXct", "POSIXt")` with the requested `tzone` label, and map missing, non-finite, non-integral
calendar fields, years outside 0:9999, and invalid calendar/time combinations to missing values.
`ISOdate` supplies noon/GMT defaults; `ISOdatetime` requires all clock fields and maps `tz = ""` to
deterministic UTC arithmetic without changing the empty label. Regional zones, DST transitions,
host-zone probing, platform-specific normalization of invalid times, and broad character component
coercion are outside this slice.

`weekdays()` is an S3 generic with registered `Date` and `POSIXt` methods. Package classes such as
data.table's IDate reach the Date method through their explicit inherited class vector. Full and
three-letter names come from the runtime's deterministic C `LC_TIME` profile; abbreviation controls
are coercible, recycled, and checked before output. Date fractions use the containing UTC day,
POSIXct seconds and owned POSIXlt weekday components use UTC/GMT, input names survive, and owned
missing/non-finite representations follow the black-box result shape. Named time zones and non-C
weekday translations remain outside this slice.

`anyDuplicated()` is an S3 generic whose default method returns the one-based position of the first
duplicate, or integer zero when none exists. Atomic vectors distinguish `NA` from `NaN`, discard
names for comparison, normalize factor values, honor vector `incomparables`, and scan in reverse
when `fromLast` is true. Lists use recursive owned-value comparison and support atomic/list
incomparables; data frames compare whole rows. Package-defined methods receive the original object
and lazy dots, which supplies the extension seam used by data.table's measured `by` call without
bundling data.table. Long-vector indices, arbitrary external objects, and every class-specific core
method remain outside this increment.

`rep.int()` accepts a scalar repeat count for whole-vector repetition or one truncated nonnegative
count per input element. Logical, integer, double, complex, character, raw, list, factor, and
expression results retain their storage type; ordinary names, dimensions, classes, and custom
attributes are removed, while factor class and levels survive. Character/complex count coercion
follows the owned numeric path, direct class methods receive the original arguments, and the result
length is checked before allocation. `NULL`, pairlists, raw counts, S4 containment, and long vectors
beyond configured browser limits are explicit boundaries.

`methods::representation()` implements the legacy declaration helper used as the second argument to
`setClass()`. Each unnamed scalar character argument declares a parent class and each named scalar
character argument declares a slot; the returned value is a plain list whose names preserve empty
entries for parents. Missing arguments, non-character or non-scalar declarations, duplicate parent
classes, and duplicate slot names are rejected before class registration. Empty strings and
`NA_character_` are retained because the GNU R black-box contract permits them at this helper
boundary. This is a declaration-list constructor, not a complete S4 representation or validity
engine.

`methods::showClass()` reads the same session-local class registry populated by `setClass()` and
prints GNU R-shaped metadata through the bounded output journal. Named entries in a representation
are slots; unnamed entries now also contribute parent classes to construction and inherited
dispatch. The display recursively gathers inherited slots, reports direct/transitive parents and
known subclasses, distinguishes virtual declarations, preserves package namespace ownership, and
returns invisible `NULL`. The `complete` argument is accepted and validated; NativR's owned class
registry currently has no sealed/incomplete class-definition variants for it to expand. Class
validity functions, unions, multiple dispatch, redefinition warnings, exact wide-output wrapping,
and the full `classRepresentation` object remain outside this slice.

`trunc()` first forwards the original lazy call to a class-specific `trunc.<Class>` method or the
`Math` group, which supplies the extension seam used by data.table's package-owned `ITime` method.
The default path forces otherwise unused dots, converts logical/integer input to double, truncates
finite values toward zero, retains signed zero, infinities, `NA`/`NaN`, names, dimensions, classes,
and custom attributes, and returns an empty double vector for empty numeric input. Factors,
complex/character values, missing `x`, and the complete built-in date-time method family remain
explicit boundaries.

`utils::type.convert()` is an S3 generic with owned default, list, and data-frame methods. The
default removes ordinary vector attributes while retaining matrix/array dimensions and dimension
names, then selects the first complete conversion among logical, integer syntax, real/hexadecimal
numeric constants, and complex constants. Exact `na.strings` plus blank fields become typed missing
values on successful conversion; otherwise `as.is` selects character or factor fallback. Alternative
decimal marks, `tryLogical`, entirely missing vectors, integral-double narrowing, list and
data-frame recursion, custom S3 forwarding, and the warning for omitted `as.is` are covered.
Locale-specific numeric grammars, full `numerals` precision-loss policy, vectorized per-column
controls, arbitrary recursive cycles, and every package method remain outside this slice.

Formula syntax becomes a NativR-owned IR containing optional response, variables, expanded terms,
interactions, transformations, intercept state, and its lexical environment. Public snapshots never
expose Tree-sitter nodes. The initial `lm()` path evaluates model variables through that IR, builds
an owned model frame and treatment-coded design matrix, and solves least squares inside the
browser-native runtime. The resulting `lm`/`aov` lists carry coefficients, residuals, fitted values,
effects, rank, QR-shaped metadata, model data, term metadata, contrasts, factor levels, and their
original R-language call. Model accessors and `predict()` use those owned fields; no R source,
generated JavaScript, native linear-algebra library, or host evaluator is involved.

Formula expansion recursively closes chained `*`, `:`, and `/` expressions instead of treating a
nested left-hand interaction as a synthetic variable. Terms are ordered by interaction degree, so
`A*B*C` yields the three main effects, the three two-way interactions, and the three-way interaction
used consistently by `terms()`, model frames, and design matrices.

`stats::anova.lm()` and `anova.aov()` derive sequential term sums of squares from the owned QR
pivot, effect, assignment, residual, rank, and term fields. They return standard single-model and
multi-model `anova` data frames with independently computed F upper tails. `summary.aov()` wraps the
single-model table in the documented `summary.aov`/`listof` shape. A single formula-special
`Error()` expression now builds its own design matrix, derives orthogonal intercept/term/Within
subspaces, projects the response and fixed-effect design into each subspace, and returns the owned
`aovlist`/`listof`, `error.qr`, call, terms, contrast, and factor-level shape. `summary.aovlist()`
returns named per-stratum `summary.aov` tables with independently computed F tails. Multiple
separate `Error()` calls, multistratum weights/offsets, split/intercept summary controls,
generalized linear models, and multivariate responses remain explicit next-stage boundaries.

`stats::weights()` dispatches through the owned S3 machinery. The default path reads an exact or
unique-partial `weights` component from lists/pairlists and applies the bounded integer `na.exclude`
restoration shape; the `lm` path therefore returns fitted prior weights or `NULL`. Ellipsis promises
remain unforced unless a package-owned method consumes them. This is the generic extension boundary
exercised by the measured loo/posterior calls, not an implementation of either package's weighting
algorithms.

`stats::family()` is a generic-only extension seam for distributional's measured `family(dist)`
call. It forwards the original object and lazy dots through ordered S3 class lookup, supports
`NextMethod` and a user-defined `family.default`, preserves method visibility, and raises a
no-applicable-method error when the session supplies none. NativR does not construct distributional
objects, embed its `family.distribution` method, load package namespaces, or implement the broader
`family.glm` result contract in this slice.

`utils::View()` forces `x`, honors a session-defined `as.data.frame.<class>` method, or coerces
owned data frames, atomic vectors, matrices/arrays, and atomic-column lists to a rectangular table.
Zero-row and zero-column inputs are rejected. Columns are converted to deterministic character
cells, ordinary `1:n` row names are omitted, non-default row names are retained, and the result is
invisible `NULL`. The table and title enter a bounded data-view journal transported unchanged
through inline and Worker execution. The runtime does not import the DOM, open a desktop viewer, or
implement editable `data.entry`; host applications choose how to render the event.

`file.path()` coerces owned atomic, factor, list, and pairlist components to character text,
recycles components to the longest length without a recycling warning, renders missing components as
`"NA"`, and joins with the scalar `fsep` (default `/`). A zero-length component produces a
zero-length result. `path.expand()` accepts only character input and returns a fresh, attribute-free
character vector. Browsers have no runtime home directory, so NativR follows R's documented
unknown-home rule and leaves leading tildes unchanged. These functions construct path text only:
they do not normalize, resolve, inspect, or access a host filesystem.

`utils::capture.output()` evaluates its dots lazily inside the session output-router stack. The
`output` mode captures stdout and prints each visible expression result with the owned formatter;
the `message` mode captures message/stderr events while leaving stdout public. Captured chunks are
normalized into character lines without losing a final intentional blank line. Output-mode
`split = TRUE` tees the same events to the next older frame or public output, and all buffered
frames share the session's `maxOutputBytes` bound. With `file = NULL` it returns character lines; a
supported session path or file connection receives the exact captured chunks. Closed connection
targets are destroyed after use as GNU R does.

`base::sink(file = NULL, append = FALSE, type = c("output", "message"), split = FALSE)` uses that
same router. Output diversions form GNU R's 19-entry user stack, persist across evaluations and
errors, and restore in last-in-first-out order; `split = TRUE` tees through older diversions.
Message diversion is one replaceable slot, accepts only an already-open writable connection, and
routes both message and stderr events. `sink.number()` reports output depth or the active message
connection number (2 when absent). Character targets are bounded session paths, automatically opened
output connections are closed but remain valid after restoration, and already-open connections
remain open. Buffered text is committed when a frame is removed, so reading or closing its target
while active is deliberately outside the supported interaction boundary. Host paths, ambient file
descriptors, and byte-for-byte native console buffering are not exposed.

`base::write(x, file = "data", ncolumns = if (is.character(x)) 1 else 5, append = FALSE, sep = " ")`
writes the underlying atomic storage in column-major vector order. Its separator vector is repeated
`ncolumns - 1` times and followed by a newline, reproducing character one-per-line, numeric
five-per-line, multi-separator, zero-length, matrix, factor-code, missing, file, and connection
behavior from GNU R 4.6. A newline anywhere in a `cat()` separator vector likewise terminates its
final item, fixing the shared formatting primitive used by `write()`. Output and session-file limits
apply before publication; non-atomic values, host paths, native encodings, and platform newline
bytes remain outside this browser contract.

`utils::contrib.url()` derives GNU R 4.6 source, Windows, and macOS contribution paths without
opening them. `utils::available.packages()` then requests `<contrib>/PACKAGES` only through the
application's explicit `createR({ url })` callback, accepts plain UTF-8 or gzip bytes, and parses
bounded DCF records into GNU R-shaped character matrices with package row names and a `Repository`
column. Populated reads include the standard `Built` column; GNU R's early empty path omits it.
Extra fields, missing cells, default R-version/Unix-OS/subarchitecture/latest-duplicate filters,
named built-in filters, ordered package-defined filter closures, request headers, and age-bounded
session caching share the ordinary value/call model. Cache state is reset with the session. No
ambient fetch, host cache directory, repository archive installation, binary execution, or OS
credential/certificate store is exposed.

`utils::demo()` discovers `demo/*.R` scripts only inside installed browser-owned package resources.
It returns a `packageIQR` catalog, derives optional titles from `demo/00Index`, loads and attaches
the selected package, decodes the script with its declared package encoding, and evaluates it in the
global environment with bounded optional console echo. Relative package reads remain rooted in the
immutable demo directory during evaluation. It never scans an operating-system R library or fetches
resources; missing packages, topics, and non-virtual library locations fail deterministically.

The first-class special primitive `[[<-` shares the immutable element-replacement engine used by
replacement syntax. It recognizes the final positional argument as `value`, supports atomic,
list/pairlist, environment, language, and dimensional targets, performs recursive list-path
replacement, deletion and extension, and dispatches registered S3/S4 replacement methods.

The QR object stores the weighted upper-triangular factor needed to recover coefficient covariance.
`vcov()` combines its inverse crossproduct with weighted residual variance, `confint()` applies the
central Student-t critical value, and `df.residual()` exposes the fitted residual degrees of
freedom. Aliased coefficients remain explicit missing rows and columns.

Native `|>` evaluates its left expression once and inserts it as a forced first argument to the
right call. `%>%` additionally supports bare callables and dot insertion. Neither form rewrites
source into JavaScript.

Registered `base`, `stats`, `graphics`, `methods`, `utils`, `R6`, `vctrs`, and `tibble`
compatibility namespaces bypass global shadowing for exact members when no installed bundle has the
same non-core name. An admitted package bundle takes precedence over its shim and then follows
ordinary lazy namespace loading; core package names cannot be replaced. Static lookup does no I/O.

`comment()` reads the `"comment"` character attribute from vectors, pairlists, environments, and
closures. `comment<-` and `attr(x, "comment") <- value` share validation: character values attach
metadata, `NULL` or `character()` removes it, missing character elements remain distinct, and every
unrelated attribute is preserved. Vector, pairlist, and closure replacement uses the ordinary
copy-and-rebind path; environment attributes mutate by reference and are visible through every
alias. General `attr`, `attributes`, `class`, `inherits`, and `is.object` use the same maps. Owned
language values do not yet carry general attribute maps.

Explicit classes use the ordinary attribute map. S3 `UseMethod` dispatches through ordered classes
and `.default`; `NextMethod` continues the current chain. The bounded S4 layer stores class,
old-style class, generic, method-signature, and explicit coercion declarations in session state.
`standardGeneric()` recognizes a registered generic definition's active closure frame, forwards its
declared values, evaluated defaults, and dots. `methods::signature()` returns the GNU R-shaped,
possibly named character signature, preserving empty names and missing class strings while rejecting
non-scalar class specifications. `setMethod()` retains every positional or named signature element;
generic dispatch maps supplied arguments to the generic's formal order, selects exact or inherited
classes across all declared dispatch arguments, and uses `ANY` only when a more specific registered
method does not match. Calls outside a generic body and missing methods are bounded errors. The
generic wrapper performs the same lookup before evaluating an ordinary fallback definition.
`methods::show()` performs the same inherited single-object lookup for registered `show` methods and
preserves each method's returned value and visibility. Without a registered method it writes the
deterministic owned-value representation to the output journal and returns invisible `NULL`; no
terminal, pager, ANSI capability, or package-specific display code is consulted. The bounded
built-in R6 helper constructs classed public-field lists; the unchanged external R6 2.6.1 proof
exercises its own package generator, environment locks, reference field mutation, public/private
method state, active-binding invocation, shallow clone aliasing, and recursive deep cloning of a
nested R6 object. The same unchanged package now constructs a three-level class hierarchy, runs
recursive `super$initialize()`/`super$greet()` calls, and observes inherited fields, methods, and
class membership. Both official `R6Class` Rd example blocks execute through `utils::example()` with
the GNU R-observed result visibility and stdout sequence. vctrs helpers construct class metadata. R6
finalization, arbitrary and multiple inheritance breadth, portable-locking variants, and broad R6
behavior remain unclaimed. Ambiguous-method diagnostics, union classes, full formal/partial argument
matching, automatic namespace/package registration, method caches, primitive/group generics, and
complete external-package behavior are not claimed.

Named resource profiles make workload intent explicit:

| Profile                      |       Steps | Calls | Vector elements | Cumulative elements | Output / graphics bytes | Package resource bytes |
| ---------------------------- | ----------: | ----: | --------------: | ------------------: | ----------------------: | ---------------------: |
| `interactive-safe` (default) |     100,000 |   100 |       1,000,000 |          10,000,000 |               1,000,000 |            201,326,592 |
| `package-test`               | 100,000,000 |   200 |       4,000,000 |         750,000,000 |              32,000,000 |            268,435,456 |
| `large-browser`              |  10,000,000 |   250 |      10,000,000 |         100,000,000 |              64,000,000 |            536,870,912 |

`createR({ runtimeProfile, limits })` selects a profile and then applies explicit per-field
overrides. The larger profiles are opt-in and remain finite; they do not weaken the default browser
session. Structured resource errors reduce accidental denial of service but are not a formal
security sandbox. The package-test profile permits long, allocation-heavy pure-R example and test
loops while retaining a four-million-element per-vector ceiling, enough for bounded multidimensional
package checks such as a 12-by-12-by-12-by-12-by-12-by-12 array; its cumulative allocation counter
measures total evaluator work rather than peak live memory. Byte-oriented graph accounting beyond
output, resources, and graphics remains an open object-memory-model requirement.

`utils::browseURL()` validates one non-empty character URL and preserves GNU R's invisible return. A
callable `browser` option/function receives a lazy original or `encodeIfNeeded`-encoded URL and its
value becomes the invisible result; an unused callback argument does not force the encoding
expression, while `browser = "false"` suppresses the operation. Other calls append an inert host
request. Existing owned session/package files become a canonical path, MIME type, and byte snapshot;
other locations remain URL strings. Simple relative paths use URL percent encoding when requested.
Desktop process selection, host files, automatic navigation, fetching, and platform-specific browser
diagnostics are outside this browser contract.

`utils::download.file(url, destfile, ...)` accepts one or more paired character URLs and
destinations, validates logical controls and named headers, and supports replacement `w`/`wb` modes.
A successful scalar call returns invisible `0L`; a vector call attaches the per-request integer
`retvals` vector. `method = "auto"` normalizes to the explicit URL adapter's `default` method. Every
destination must resolve below the mutable browser-session temp root and every parent must exist
before the first request is issued. Each complete copied `Uint8Array` replaces its target atomically
through the shared byte-store accounting. There is no ambient transport, host path, partial response
stream, progress display, append mode, or cache implementation; those policies and effects remain
with the application callback.

`base::pipe(description, open = "", encoding = getOption("encoding"))` creates a private lazy
`c("pipe", "connection")` record. A read executes only through the explicit `systemCommand` adapter,
stores its stdout in the bounded connection byte store, exposes stderr as output events, and
preserves the completed status for invisible `close()`. An open write connection buffers exact text
and submits it as `inputText` on close; writing to a closed pipe performs the same one-shot exchange
immediately. Without an adapter, execution fails closed, while an unused closed pipe can still be
inspected and closed with invisible `NULL`. Text/UTF-8 or Latin-1 byte projection, binary reads,
line/raw/source/table/serialization consumers, and unchanged pure-R package calls reuse the normal
connection machinery. Duplex modes, interactive streaming/flush, seeking, command parsing, ambient
program discovery, and NUL-containing binary stdin remain explicit host/runtime boundaries.

`graphics::title(main = NULL, sub = NULL, xlab = NULL, ylab = NULL, line = NA, outer = FALSE, ...)`
requires an active plot and returns invisible `NULL`. Character/numeric/logical annotations,
symbols, language, expression vectors, and title lists normalize into owned text labels. A title
list may override `col`, `cex`, and `font`; named title-specific graphical controls override the
active device's `par()` values without mutating them. Browser callbacks, Worker transport,
display-list replay, PNG, and PDF share the same text event. Expressions currently use deterministic
normalized deparse text; mathematical plotmath glyph construction and exact platform font/margin
metrics remain explicit depth work.

## Operator dispatch during package initialization

Operator evaluation consults an operand's specific S3 method and then the `Ops` group for both
syntax and first-class operator calls, including a classed right operand. Package namespaces expose
declared S3 registrations after each top-level source expression so later initialization expressions
can use earlier methods without a package-specific load-order exception. Numbered `..N` identifiers
resolve against the current dots binding and participate in `missing()`. These semantics are covered
by differential cases and by unchanged rprojroot criterion composition.

## Package method exports and global-variable declarations

`exportMethods()` names are retained in a package's reported namespace exports and are attached when
an ordinary binding exists, but namespace loading does not require an S4 method name to be a normal
variable binding. This matches the distinction needed by generated NAMESPACE files without adding
package-specific exceptions. `utils::head` and `utils::tail` now carry their GNU R namespace
ownership while remaining available through the default search path.

`utils::globalVariables(names, package, add = TRUE)` stores declarations against the selected
namespace environment. Missing `names` queries current declarations; additive updates retain first
occurrence order and replacement updates preserve the supplied vector. The state is session-owned
and reset with the runtime. This models package metadata used during source loading; it does not
implement global-variable diagnostics from R CMD check.

## Dimension, regex, apply, factor, and replacement depth

`NROW()` and `NCOL()` use GNU R scalar/vector defaults and stored dimensions without dispatching a
class-specific `dim()` method; `rownames<-` and `colnames<-` update matrix/array dimension names and
data-frame row or column names without exposing parser or Tree-sitter nodes. The predefined `T` and
`F` bindings are ordinary mutable logical bindings, matching their Base R role rather than treating
them as syntax.

Regex calls normalize the evidenced GNU R boundary for literal braces, PCRE identity escapes, and
default-engine lazy-overlap matches while preserving Unicode code-point escapes. `sub()` and
`gsub()` interpret GNU R capture backreferences and literal `&`/`$`; `strsplit()` omits separator
capture groups and has explicit empty, leading, trailing, and zero-width behavior. This is a bounded
browser implementation, not a claim that JavaScript RegExp is a complete TRE or PCRE replacement.

`lapply()`, `sapply()`, `vapply()`, `mapply()`, `Map()`, and adjacent apply helpers use the standard
exact, unique-partial, then positional matcher for their formal arguments. Exact `FUN=`/`f=` names
therefore win before earlier positional dots, and controls after `...` remain exact-only. Factor
`==`, `!=`, and `%in%` compare labels instead of internal integer codes. Atomic `[<-` with a list
right-hand side promotes a non-factor target to a list while preserving names and inserted `NULL`
gaps. Ordered/unordered factor relational warnings and the broader replacement matrix remain
compatibility depth.

`Sys.which()` applies ordinary character-vector coercion to symbols and decomposes language calls
into their character components before consulting the explicit executable allow-list. `help()`
forces and validates its `verbose` logical control even when a topic is found; neither behavior
grants process discovery or a desktop help browser.

## Environment finalization and state-restoring package code

`reg.finalizer(e, f, onexit = FALSE)` accepts an owned environment and an R closure, returns
invisible `NULL`, and records the registration in session state. A full or ordinary `gc()` walks the
same evaluator roots used by the memory census. Registrations whose target environment is no longer
reachable are removed first, then invoked newest-first with that environment as their sole argument.
Removing before invocation permits resurrection without duplicate execution. An error from one
callback is emitted to the bounded error stream and later callbacks still run.

Reset and dispose are asynchronous lifecycle operations. Before replacing or destroying session
state, they run the remaining `onexit = TRUE` finalizers in reverse registration order.
Registrations without `onexit` are not promoted to session-exit callbacks. This behavior is
independent of the host JavaScript garbage collector and does not yet admit external-pointer
finalizers.

The same package-depth increment gives Base R its locked, missing-character `.sys.timezone` cache
binding; withr can temporarily unlock, replace, restore, and relock it through ordinary environment
operations. `dev.next`, `dev.prev`, and `dev.set` navigate the evaluator-owned device list
circularly. `bindtextdomain` stores only browser-local domain/directory state and makes no NLS
translation claim. `unlink` applies ordinary scalar-list/atomic character coercion before enforcing
owned virtual paths, and `mapply`/`Map` treat `NULL` as a zero-length input.

Package examples use a source-like scoped evaluator: expressions still run in the requested
environment, so `local = FALSE` assignments remain global, while a distinct source exit frame owns
`on.exit` handlers. Its normalized `source`/`withVisible`/`eval`/`eval` call-frame shape lets
unchanged state-restoring packages identify the source lifetime through ordinary `sys.calls()` and
`sys.frames()`. This is a reusable evaluator path, not a package-name check.

## Named-color spacing and plot frames

Named-color resolution follows GNU R's observable rule that ASCII space characters are insignificant
anywhere in a color name. Leading, trailing, and repeated spaces therefore resolve through the same
catalog entry, while tabs, other whitespace, hyphens, and malformed hexadecimal forms remain
invalid. This normalization is shared by `col2rgb()`, palette interpolation, and graphics controls.

`plot.default()` validates and applies `bty` through the shared plot-region edge selector. Values
`o`, `l`, `7`, `c`, `u`, `]`, and `n` select the corresponding frame edges, and invalid values fail
even when `frame.plot = FALSE`, matching black-box behavior. The semantics are device-independent;
the resulting normalized box event is consumed by inline, Worker, Canvas, PNG, and PDF paths.

## Browser-owned DCF records

`read.dcf(file, fields = NULL, all = FALSE, keep.white = NULL)` reads a bounded owned virtual file
or connection and returns the GNU R matrix shape for ordinary records. Blank lines delimit records;
field order is first-observed order; indented continuation lines are joined with newlines; absent
cells are character `NA`; and `fields` selects and orders columns. Named `keep.white` fields retain
continuation indentation and trailing whitespace while ordinary fields are trimmed.

With `all = TRUE`, repeated fields become list columns in a data frame while singleton fields remain
character columns. Malformed fields and continuation lines at the beginning of a record fail before
returning partial data. Reads stay inside the session filesystem and share its byte, vector, and
checkpoint budgets; they do not expose host paths or introduce repository/network authority.

## Primitive reflection, explicit call matching, conditions, and virtual access

`is.primitive(x)` reports true only for callable values whose public storage remains GNU R `builtin`
or `special`; closure-shaped runtime builtins with declared R formals report false. The predicate
itself is closure-shaped with the exact `x` formal. `match.call()` accepts an explicit closure
definition and normalized call, performs exact then unique-partial then positional matching, keeps
exact formals after `...`, and either expands unmatched arguments or retains them in the canonical
`... = pairlist(...)` entry. Supplied calls never evaluate their argument expressions.

`stop(condition)` retains the original classed R condition and payload. `tryCatch()` selects the
first handler matching that condition's class vector, so package-defined errors are not collapsed to
`simpleError`; ordinary text errors retain the existing simple-error shape. `all.equal()` accepts
unique partial names for its method controls, including `tol` for `tolerance`.

`file.access(names, mode = 0)` is restricted to the owned virtual filesystem. It returns named
integer success/failure codes for existence and read/write/execute bit combinations. Temporary files
and directories use their deterministic virtual modes, installed package resources remain read-only,
missing paths fail, and no host permission or filesystem query is performed.

## Difftime units, infinity, and C-style formatting

`units()` and `units<-` are closure-shaped S3 generics with exact public formals. The built-in
`difftime` methods recognize seconds, minutes, hours, days, and weeks; replacement rescales stored
values so elapsed time is preserved, retains structural attributes, and rejects unsupported units.
User-defined getter and replacement methods dispatch through the ordinary S3 registry rather than a
package-specific branch.

Primitive `is.infinite()` classifies logical, integer, double, complex, raw, and character vectors,
preserves structural dimensions and names, and drops object class in the result. `formatC()` is an
owned closure implementing the measured integer, fixed, exponential, general, significant, and
hybrid decimal modes, ties-to-even rounding, widths and flags, decimal and grouping marks, interval
grouping, zero replacement, trailing-zero removal, and names. Complete locale-sensitive and
multibyte marks, complex formatting, and every GNU R width-preservation interaction remain explicit
boundaries.

## Evaluation lifecycle, source references, and expression containers

`withCallingHandlers()` installs dynamically scoped class handlers without unwinding the evaluated
expression. `warning()` and `message()` signal through standard `muffleWarning` and `muffleMessage`
restarts; message conditions retain the requested trailing line feed. `withRestarts()` installs
named reusable restart frames, and `invokeRestart()` transfers control with lazy R arguments to the
selected handler. Ordinary `stop()` signals a `simpleError` whose call field respects `call.` before
raising the evaluator-owned condition error. `conditionCall()` reads that field through normal S3
dispatch.

`suspendInterrupts(expr)` and `allowInterrupts(expr)` push a scoped interrupt mode, preserve caller
effects and result visibility, and unwind the mode even on errors. Cancellation remains cooperative:
an interrupt deferred by a suspended scope is observed at the next checkpoint after that scope,
while a nested allowed scope can observe it immediately. This adds no preemptive host execution.

Expression vectors now participate in `for`, `lapply`, `sapply`, and `vapply` without prematurely
evaluating their language entries. Mixed recursive `unlist()` results that contain closures,
environments, or language objects promote to a named list. `data.frame()` and row binding retain
AsIs list and expression columns, row subsetting preserves expression attributes, and three-
position data-frame indexing honors positional `drop`.

`parse(..., srcfile =)` attaches expression-level `srcref`, `srcfile`, and `wholeSrcref` attributes,
with eight-field classed source references on each parsed expression. `removeSource()` removes
source metadata from closures, language values, and expression vectors. `setHook()` composes
callable, list, or pairlist hooks through replace, prepend, and append actions. `sequence()` and
`sequence.default()` share vectorized length, origin, and step controls. Recorded plots retain a
bounded browser-owned display-list shape suitable for inspection and replay; no host graphics device
or package-specific representation is exposed.

## Function reflection replacement

`body<-` and `formals<-` are ordinary closure-shaped builtins with the public formals `fun`,
`envir = environment(fun)`, and `value`. Their implementation returns a new closure, preserving
formals or body respectively and selecting either the supplied enclosure or the function's current
enclosure. Atomic, list, pairlist, symbol, language, formula, NULL, and expression-body values are
stored as normalized AST nodes or constant runtime nodes; no source generation or JavaScript
evaluation is involved. Empty expression bodies and non-body reference values fail explicitly.

`environment<-` remains primitive-shaped. Closures and formulas carry a direct enclosure; supported
ordinary attributed values carry `.Environment`; primitive functions warn and remain unchanged.
`environment()` reads those representations through the shared attribute model.

`as.function()` performs S3 dispatch before the default constructor. The default accepts an existing
closure or a non-empty list. For a list, all entries except the last pass through the same
formal-parameter conversion used by `formals<-`; the final entry passes through the same normalized
body conversion used by `body<-`. Its enclosure is an explicit environment or the caller
environment. Extra arguments remain lazy for package methods and are ignored by the default method.
An existing closure is returned before evaluating `envir` or default-method dots.

## Reference classes and holdout-driven Base seams

Profile 0.309 adds browser-owned Reference Class definitions and instances. Generators are callable
directly and through `$new`; instances are classed environments whose field bindings, `.self`,
inherited method closures, active accessors, and `initialize` calls share reference identity.
Reference inheritance is registered with the existing methods dispatcher, including package-defined
`as.character` methods. The implementation does not copy methods-package source and does not yet
claim complete Reference Class metadata, `callSuper`, locking, tracing, or every S4 interaction.

The same profile records GNU R behavior for `is.na<-` (TRUE marks elements missing; FALSE does not
clear an existing missing value), zero-length logical operands under `&&`/`||`, NULL substring
inputs, list membership/empty-list equality, leading PCRE mode flags, and `regmatches<-`
replacement.

Profile 0.334 extends the same regex object contract to `regexec()` capture vectors. GNU R encodes
an unmatched optional capture as location `0` with `match.length` `0`; `regmatches()` must retain
that capture in position and return `""`, while a whole-pattern miss remains the existing `-1/-1`
no-match shape. The distinction is generic and applies to any package consuming capture vectors.

The package-check runner also distinguishes a guarded probe for an unavailable package that the
artifact itself declares in `Suggests` from an actionable semantic warning. Only the runtime's
specific missing-package warning for that declared optional edge is non-failing; undeclared missing
packages and every other warning remain failures. This allows examples with
`if (!require(optional)) return()` to express browser-applicable behavior without weakening warning
checks globally.

## Match fallback coercion, function negation, storage mode, and browser arguments

Profile 0.310 applies `match()`'s `nomatch` argument through a shared GNU R-shaped scalar coercion
path. Missing, NaN, NULL, empty, list, and out-of-range inputs select the integer missing sentinel;
finite numeric values truncate, negative sentinels remain valid, and character, logical, raw,
factor, and complex values follow their observed integer conversions and warnings. The matching
algorithm itself remains generic and does not inspect package identity.

`Negate(f)` resolves functions by the same callable lookup used by `match.fun`, then returns an
owned closure with `...` formals that calls the captured function and applies unary `!`. Its
captured environment remains in the ordinary lexical chain. `storage.mode()` reports GNU R public
storage labels, while `storage.mode(x) <- value` reuses the ordinary vector coercion machinery for
logical, integer, double/numeric, complex, character, raw, list, expression, and pairlist targets
and preserves ordinary attributes. Defunct `single`/`real` and invalid modes fail explicitly.

`commandArgs(trailingOnly = FALSE)` returns the deterministic virtual executable name `"nativr"` in
the browser-admissible profile, while `trailingOnly = TRUE` returns `character(0)`. NativR does not
leak Node, browser, or embedding-process arguments. A future explicit host adapter may define a
separate admitted contract; the default remains deterministic and ambient-authority free.

## S4 class exports, slots, validity, and filled output

Profile 0.311 admits `exportClasses()` as parser-independent package metadata. Each declared class
is exported through the class representation binding created by `setClass()` at `.__C__<Class>`;
namespace loading rejects a declaration whose class metadata was not registered. The same binding
can be resolved by `::` and enters an attached package search environment. S4 method-table bindings
synthesized by complete GNU R methods internals are not yet reproduced.

The normalized `@` expression now performs exact named extraction on owned formal objects, and `@<-`
rebuilds the immutable object while preserving its S4 marker, class chain, attributes, and other
slots. Missing slots and non-S4 targets fail deterministically. Slot storage-class checking,
prototype completion, virtual classes, and the complete methods replacement protocol remain explicit
depth boundaries.

`methods::setValidity(Class, method, where = topenv(parent.frame()))` registers or removes a
class-local validity closure and returns the class representation.
`validObject(object, test = FALSE, complete = FALSE)` runs the registered class chain, accepts only
`TRUE` or character diagnostics, returns diagnostics under `test = TRUE`, and otherwise raises a
classed evaluation failure. `new()` runs complete registered validity before returning.
Package-defined replacement generics are installed in the calling namespace rather than leaking into
`.GlobalEnv`.

`cat(fill=)` uses an explicit positive width or the session `width` option, wraps only between
elements, retains the active separator at a wrapped line end, cycles optional labels, and terminates
filled output with a line feed. It uses the same output and virtual-file budgets as ordinary
`cat()`. Complete display-width, multibyte, and every embedded-line/connection interaction remain
compatibility depth.

## List logical coercion and S4 coercion methods

Profile 0.312 extends `as.logical()` to GNU R-shaped list and pairlist coercion. Every top-level
element must have length one. Atomic scalars are coerced from their underlying storage, so a factor
element uses its integer code rather than its level label; scalar nested lists and expressions
produce `NA`; zero-length, multi-element, language, symbol, environment, and function elements fail
deterministically. Output names, classes, and arbitrary attributes are dropped. Other recursive
coercion targets remain separate contracts rather than inheriting this rule accidentally.

`methods::as()` now consults methods registered as
`setMethod("coerce", c(from = ..., to = ...), definition)`. Dispatch scores both the source class
chain and the requested target class, prefers a specific source over `ANY`, and invokes the selected
method with `from`; the target formal remains missing exactly as in GNU R. `setAs()` registrations
continue through the existing direct coercion registry. Complete S4 ambiguity resolution, method
metadata, replacement coercions, and every inherited class-distance rule remain explicit depth.

## Caller-local S3 methods and immutable runtime resources

Profile 0.313 separates the environment used to register an S3 generic from the environment used to
discover legacy `generic.class` methods. `UseMethod()` now searches the generic call's caller
environment before the registered method table, preserving caller overrides while allowing an
unchanged package-internal call to find an unexported method in its namespace. `NextMethod()` keeps
that lookup environment for the rest of the dispatch chain.

`levels()` performs ordinary S3 dispatch and otherwise returns the owned `levels` attribute;
`nlevels()` returns the resulting level count with GNU R-shaped formals and closure type. The
deterministic `R.home()` root also exposes a bounded immutable NativR `COPYING` text resource
through the existing virtual connection layer. It contains NativR's own Apache-2.0 notice, not GNU R
text, and grants no host-filesystem capability.

## Profile 0.314 compiler, call-entry, and matrix-product semantics

`compiler::compile` is a browser semantic seam. It validates `env` and `options`, accepts GNU
R-shaped formals, and returns the normalized expression/value unchanged so `eval()` observes the
same behavior. NativR does not create GNU bytecode, expose bytecode inspection, or execute generated
JavaScript.

An `RLanguage` value stores optional call-entry tags separately from its attribute map. This models
GNU R's distinction where `names(call)` exposes pairlist tags while `attributes(call)` can remain
`NULL`. Selection and reconstruction preserve a tag on the first surviving entry, including the case
where `substitute(list(i = 1:3))[-1]` produces a one-entry named call. `as.list()`, `names()`,
`lapply()`, `sapply()`, and `vapply()` consume the same entry view.

`%*%` promotes vectors to a row operand on the left and a column operand on the right, requires
conformable inner extents, and returns a two-dimensional double or complex result in column-major
order. Missing values dominate an output cell, NaN remains NaN, complex products do not conjugate,
and matrix row/column dimnames propagate from the outer axes.

## Profile 0.315 dependency attachment and browser parallel semantics

Normalized package dependencies retain whether they came from DESCRIPTION `Depends` or `Imports`.
Namespace loading resolves both kinds without modifying the search path. `library()` recursively
attaches only `Depends` packages before the requested package, then invalidates the evaluator's
search-environment cache. Core packages such as `parallel` are satisfied by the browser runtime
rather than looked up in an external repository.

The browser `parallel` contract has one deterministic execution lane. `detectCores()` reports one;
`mclapply()` preserves map order and names in the current interpreter; and `splitIndices()` matches
GNU R's evenly spaced centers and ties-to-even distribution. A PSOCK cluster is an inert classed
list. Cluster calls and applies invoke ordinary R closures sequentially through the same evaluator,
while `stopCluster()` returns invisibly and owns no host resource.

## Profile 0.316 package selection, numeric, model, and progress semantics

Safe NAMESPACE platform branches are resolved during packaging, so runtime namespace parsing still
consumes only ordinary declarations. `crossprod()` reuses the matrix-product engine with a
transposed left matrix, preserving column dimnames and missing/complex behavior. `rnorm()` recycles
`mean` and `sd`, avoids consuming a normal draw for zero scale, and warns on invalid recycled
parameters. Fitted `lm`/`aov` objects expose a retained `model.frame()`.

Text progress bars are classed state handles with bounded numeric min/max/value state;
`getTxtProgressBar()`, `setTxtProgressBar()`, and `flush.console()` have GNU-shaped formals and
visibility. `parLapply()` and `parLapplyLB()` preserve input order and names while invoking the same
single-lane cluster evaluator.

## Profile 0.317 version, language, and nested-cell semantics

The base environment exposes one shared immutable-shaped value through locked `R.version` and
`version` bindings. Its 15 fields identify the 4.6.1 browser target, and `sessionInfo()` builds its
version member from the same runtime constructor.

`names(environment)` exposes all local bindings without hiding dot-prefixed names; unhashed
environments retain GNU R's reverse insertion traversal while hashed environments use deterministic
runtime map order. `seq_along()` uses the general length of language, expression, pairlist,
environment, closure, builtin, symbol, vector, or NULL values. `unclass()` removes only the explicit
class attribute from supported attributed values and retains other attributes. Data-frame
two-dimensional `[[<-` preserves a list replacement as one nested cell, promoting an existing atomic
column to a list column when necessary.

## Profile 0.318 classed-environment primitive dispatch

For explicitly classed environments, `$`, `[[`, `[`, and their replacement forms consult registered
S3 methods before validating ordinary environment subscripts. Replacement methods return the updated
object that is rebound to the assignment target; the replacement expression itself still yields the
right-hand-side value. `length`, `names`, `dim`, `dimnames`, their replacement forms, `seq_along`,
and `t` follow the same class-aware ordering.

The browser translation boundary is deterministic and network-free: `gettext()` is identity
concatenation, `gettextf()` composes `sprintf()`, and `.makeMessage()` builds condition text.
`is.element()` uses the same missing-aware atomic keys as `match()`.

## Profile 0.319 generated package code and namespace reflection

Replacement calls can resolve qualified `namespace::binding` and `namespace:::binding` callees;
during package evaluation, a namespace may resolve its own already-created bindings without
recursively reloading itself. `substitute()` rewrites assignment targets and represents embedded
closures as exact constants, preserving their lexical environment through later `eval()`.

Runtime-owned reflection now covers `sys.source()`, `sys.frame()`, `sys.parents()`,
`getNamespace()`, the Base S3 registry constants, and target `library()` default formals. Utils
object/S3 discovery and virtual-file tests remain browser-owned and network-free. Package startup
messages signal the target condition-class chain and support the standard message-muffling restart.

## Profile 0.320 package-driven object semantics

Binary arithmetic, comparison, and logical Ops coerce NULL to a typed zero-length vector while unary
numeric Ops retain their error contract. Primitive `as.character` and `c` consult S3 methods before
their fallback coercions, including classed closures and `person` objects. `NextMethod` supports an
explicit object and forwards or replaces named arguments when continuing along the remaining class
vector.

Package export patterns are resolved after `.onLoad`, so dynamically created namespace bindings can
be exported. `strsplit(x, NULL)`, coercible `grep`/`grepl` inputs, and GNU-style partial attribute
lookup with `exact` controls close reusable string and reflection seams. Common `utils::person()`
Authors@R construction, combination, and formatting is implemented; this bounded evidence is not a
claim of the complete person API.

## Profile 0.321 R.utils-driven parser, I/O, condition, and graphics semantics

R string normalization decodes one-to-three-digit octal escapes and one-to-two-digit hexadecimal
escapes before constructing the normalized AST. Atomic dimension-name components are coerced to
character consistently through `matrix()`, `array()`, `dimnames<-`, `attr<-`, and `attributes<-`;
the runtime never retains parser or package-specific representations for these values.

Browser-owned file connections now cover gzip and bzip2 streams, seekability and binary cursors,
atomic `scan()` subsets, and eight-byte logical/integer binary fields within the JavaScript numeric
precision contract. `tools::md5sum()` uses a bounded browser implementation over owned bytes.
`Sys.readlink()` reports owned-path link state without exposing host filesystem links.

`signalCondition()` participates in dynamically scoped calling handlers and transfers control to the
nearest matching exiting `tryCatch()` handler, including `finally` unwinding. `setTimeLimit()` is
cooperative and checked at evaluator checkpoints; elapsed deadlines are enforced directly and CPU
deadlines currently use checkpoint wall time as the browser approximation. Neither feature creates a
host thread or preemptive interrupt.

Graphics devices retain weighted `layout()` state and `layout.show()` records browser-owned
diagnostic drawing operations. These are semantic display-list claims, not cross-device pixel
identity. Together with source references and generic closure/environment reflection, these
package-agnostic seams carry the frozen R.utils dependency closure through P5.

## Profile 0.323 namespace lifecycle, version shape, and structural dispatch

Explicit package exports are resolved through imported namespace parents and validated after
`.onLoad`, so a package can re-export an imported binding or create an exported object in its load
hook. Package attachment copies those resolved exported values without attaching the import
provider. Dynamic `pkg::name` lookup follows inherited lookup for ordinary explicit re-exports while
`exportMethods()` metadata cannot expose an inherited generic without an ordinary binding;
`pkg:::name` retains own-namespace semantics.

`R.Version()` is a zero-formal closure returning the unclassed fifteen-field version list, while the
locked `R.version` binding retains class `simple.list`. `str()` performs ordinary S3 dispatch before
its default browser-owned structural formatter. Error spans for scalar `&&` operands identify the
failing operand without changing short-circuit behavior. These semantics are generic and were
exercised by the R.matlab P5 rotation.

## Profile 0.324 special functions, tabulation, and Rd comments

`gamma()` and `lgamma()` accept real logical, integer, and double vectors, preserve structural
attributes, and perform direct then `Math` S3 dispatch. Missing, NaN, infinities, poles, factor, and
complex boundaries are explicit; positive integral gamma values use an exact factorial path within
the finite range. `tabulate()` truncates real bin values, ignores missing, non-positive, and
out-of-range bins, supports factor storage, and exposes GNU R-shaped `bin`/`nbins` formals.

Installed Rd extraction strips unescaped percent comments before locating command bodies while
preserving escaped `\\%`. Commented-out example sections therefore cannot become runnable package
evidence.

## Profile 0.325 POSIX regex and real linear algebra

R regex entry points and NAMESPACE `exportPattern()` translate the standard POSIX named character
classes into an explicit browser C-locale/ASCII contract. Unsupported named classes fail instead of
silently changing meaning.

Matrix products apply GNU R-observed vector promotion, and Base now exposes triangle masks,
row/column coordinate matrices, Kronecker products, choose/lchoose, determinant/solve, QR helpers,
and SVD/La.svd for exercised real inputs. QR and SVD use owned deterministic numerical kernels and
bounded allocation. Custom `kronecker(FUN=)` callbacks, complex solve/QR/SVD, LAPACK/LINPACK modes,
and GNU R's private Householder-packed `qr$qr` coefficient representation are explicit unsupported
boundaries. QR helper calls are supported for QR objects created in the same runtime session;
serialized or foreign internal decompositions are not claimed.

## Profile 0.326 formula and model-frame substrate

Formula values retain their normalized formula expression plus ordinary attributes, so language
indexing/replacement can rebuild terms while custom formula S3 classes remain dispatchable.
Runtime-created constant expressions are unwrapped for intercept and term analysis. Formula and
language equality compares owned syntax for `==`/`!=`; ordered comparisons remain invalid.

`terms()` constructs owned variables, factors, labels, order, intercept, response, and offset
metadata. With named data, `.` expands to columns not otherwise referenced by the formula, including
variables explicitly removed from a dot expression. `model.frame()` attaches that terms object,
retains evaluated expression columns under their full labels, and `model.matrix()` reuses those
columns before attempting expression evaluation. `model.response()`, `delete.response()`,
`offset()`, and `model.offset()` implement the checked response/offset shapes. This is the exercised
browser-admissible model substrate, not complete GNU R modeling semantics.

## Profile 0.327 methods and row-name substrate

The methods subset accepts the checked full public formals for `setClass`, `setGeneric`, and
`setMethod`, including `slots` and result-value classes. S4 instances expose only their concrete
class through `class()` while registry inheritance remains visible through `inherits()` and
`methods::is()`; classes containing atomic data types retain atomic storage instead of being
rewritten as lists. These are the exercised graphs, not complete S4 replacement, validity, or
multiple-dispatch semantics.

Base now exposes exact `oldClass` query/replacement, origin-free Date-to-POSIXct conversion,
`row.names` S3 dispatch, `.set_row_names()` compact construction, and GNU R-observed NULL
replacement on undimensioned objects. Compact automatic row names remain internal storage: `attr()`
and `attributes()` materialize the observable integer sequence, while `row.names()` returns
character labels. These semantics are generic and contain no DBI package branch.

## Profile 0.330 model, PCA, and flat-table substrate

`summary.lm` constructs the exercised coefficient matrix, residual and rank metadata, sigma,
R-squared values, F statistic, and unscaled covariance with class `summary.lm`. The generic family
registry now provides gaussian, binomial, and Poisson family objects for their exercised links, and
`glm` runs deterministic iteratively reweighted least squares with owned fitted values, residuals,
deviance, summaries, and single-model analysis-of-deviance tables. Unsupported custom and broader
family graphs fail explicitly instead of silently substituting a model.

`prcomp` accepts exercised real numeric matrices and data frames, centers/scales columns, and
returns owned rotation, singular-value, center, scale, and score values; `summary.prcomp` reports
importance statistics. Formula methods, complex inputs, and broader method-specific PCA behavior are
outside this profile.

`ftable` constructs flattened contingency tables from atomic vectors, data frames, and exercised
dimensional table-like values. `format.ftable` supports the checked compact and non-compact layouts.
Data-frame row binding preserves the leading input's custom class and ordinary attributes while
rebuilding names and row names. A missing unnamed positional argument now advances closure argument
matching without overriding a default or entering `...`, and `matrix()` follows the checked GNU R
behavior of using the first element of a vector-valued row extent. These are generic runtime
contracts, not xtable-specific branches; arbitrary custom permutations and the full modeling/table
universes remain unclaimed.

## Profile 0.331 core namespace environments and primitive continuation

Evaluator construction allocates one immutable-lifetime environment for every builtin-owned non-Base
package. Builtins are installed into the effective owner, the Base namespace receives only Base
bindings, and attached search environments are rebuilt from declared exports. Static data packages
keep their own resource namespace. Environment naming, package naming, memory roots, reset, and
disposal all recognize the additional namespace identities.

Core S3 methods are derived from builtin method names using the longest available generic prefix and
registered under the Base generic identity used by current builtin dispatch. This keeps hidden
`format.object_size`, `format.person`, reference-class `$`, and analogous methods dispatchable
without exporting them. `NextMethod()` tries remaining class/default methods and then invokes the
first-class primitive implementation. The new first-class `{`, `<-`, and `[` values provide the
reflection and direct-call behavior needed by static analysis while syntax keeps its normalized-AST
evaluation path.

## Profile 0.332 runtime closure

Builtin call matching can now be reused by runtime-owned tracing wrappers without re-parsing or
generating JavaScript. Trace registrations attach to callable identity and are removed generically;
`.mapply()` reuses ordinary argument matching. Nested replacement calls preserve the required
unevaluated call shape, while `eval.parent()` forces its expression in the current frame and then
evaluates the resulting language object in the requested caller frame.

Array construction first normalizes input into an unclassed, unnamed data vector; factor input
becomes character data before dimensions are attached. Table construction expands one list/data
frame argument into axes and retains unused factor levels. Core dataset scripts build owned runtime
values from immutable audited bytes, so package data remains browser-local and independent of GNU R.

## Profile 0.333 runtime closure

Parenthesized expressions remain explicit normalized `(` calls so assignment visibility is not lost
during parsing. S3 dispatch frames synthesize the selected method call, while replacement calls use
the temporary target and evaluated value representation observed from GNU R. Non-syntactic
identifiers deparse with backticks, and call-to-character coercion preserves the distinct raw call
head versus quoted argument behavior.

The owned printer now covers one-dimensional names, multidimensional array slices, matrix row and
column dimnames, named axes, table spacing, and numeric vector index-label padding. Saved-output
execution captures condition calls and the closure call chain before stack unwinding, formats long
errors deterministically, invokes the configured error handler, and compares normalized output.

Profile 0.335 adds a dynamic S4 dispatch stack. `callGeneric()` without supplied arguments rebuilds
the current generic call from the active method environment, so locally replaced formals and
ellipsis values are visible; supplied arguments redispatch directly. The stack is unwound in
`finally`, including failed nested dispatch. Omitted-`def` `setGeneric()` retains an existing
callable fallback, `setReplaceMethod()` registers the `<-` generic, and `getDataPart()` shares
signature selection. Serialized `S4SXP` slot graphs preserve the owned `s4` marker across XDR decode
and encode. These are bounded runtime primitives, not a claim of complete methods-package semantics.

## Profile 0.336 method dispatch on primitive paths

AST arithmetic and subset fast paths now route S4 operands through the corresponding first-class
primitive. Operator methods retain a callable primitive fallback for nested `callGeneric()`, and an
`Ops` method records the concrete operator in its dispatch frame. S4 `[` methods receive named
`x`/`i`/`j` dispatch values and can call the primitive fallback on their data part. Integer subset
indices participate in the S4 `numeric` signature relation without broadening unrelated generic
selection.

`as.double` (and its `as.numeric` alias), `sort`, and `diff` now attempt method dispatch before
owned default behavior and preserve forwarded arguments. These additions are independently gated;
they do not imply complete S4 inheritance or date-time rounding semantics.

## Profile 0.337 POSIX rounding and S4 construction continuity

`round.POSIXt()` and `trunc.POSIXt()` return named POSIXlt values for POSIXct or POSIXlt input. The
owned UTC/GMT path supports seconds, minutes, hours, days, months, and years, including unique
partial unit matching and calendar-length midpoints. Generic `round()` accepts method-specific
arguments before S3 dispatch, while ordinary numeric calls still reject unused arguments.

Internal one-dimensional subsetting retains the S4 marker as well as class metadata. `new()` merges
inherited and local prototype slots, fills omitted declared atomic slots, and then applies explicit
fields. `range()` dispatches S3 before numeric reduction; `start()` and `end()` honor registered S4
methods. Non-UTC civil time and complete methods-package behavior remain outside this profile.

## Profile 0.338 argument, generic, and POSIXlt continuity

`seq()` now performs S3 forwarding before its numeric default and S4 signature selection no longer
lets unrelated named ellipsis arguments displace formal dispatch positions. A defaulted promise
forwarded to another closure is no longer reported as missing, while a truly absent no-default
promise remains missing. Owned `pmatch()` implements exact-first and unique-partial matching with
GNU-compatible duplicate reservation and `duplicates.ok` behavior.

`strptime()` coerces through `as.character`, returns component-complete POSIXlt values, and
dispatches through `format.POSIXlt`. Callable `[<-` performs ordinary S3/S4 dispatch; `[<-.POSIXlt`
replaces observations across all components or a named component while preserving class and
timezone. `is.na`, `unique`, and `duplicated` now attempt S4 and S3 methods before owned defaults,
and `julian.POSIXt` returns a named `difftime` with its origin. The browser-owned implementation
remains limited to the documented UTC/GMT civil-time surface.

## Profile 0.339 length, POSIXlt component, and ellipsis continuity

`length()` now dispatches registered S4 and S3 methods before the owned default, and `lengths()`
uses the same element-length path for recursive inputs. POSIXlt formatting indexes every component
modulo that component's own length, matching GNU R's observable recycling of short components.
`as.POSIXlt()` accepts empty and all-missing logical input but continues to reject nonmissing
logical values. `is.na.POSIXlt()` reports missing observations from the six required calendar
components. The Base namespace exposes the versioned `.leap.seconds` POSIXct object used by package
calendar code.

The primitive `...length()` reports the number of arguments in the active ellipsis, and `...elt(n)`
forces and returns only the selected one-based element. Both reject use outside an ellipsis context.
These semantics are independently executable and do not imply complete POSIX, reflection, or Base R
coverage.

## Profile 0.340 array, graphics-generic, and language-name semantics

`asplit` maps ordered, named, or negative margins into an outer list-array and preserves the
remaining source-axis order, dimensions, and dimension names unless `drop = TRUE`. Atomic and list
arrays, including zero extents, use the same generic path. `apply` keeps the common source type when
every non-`NULL` slice result has length zero, including normal atomic promotion.

S4 `plot`, `points`, and `lines` signatures dispatch before S3/default behavior; an omitted `y`
remains missing for method selection. The default plot path accepts and validates `xaxt`/`yaxt`
styles `s` and `n`. `all.names` recursively visits normalized language, expression, formula, and
symbol values with stable function inclusion, maximum-count, and uniqueness controls. `names`
returns `NULL` for non-vector functions and symbols, matching the observed GNU R contract.

## Profile 0.341 S4 initialization and replacement semantics

`new(Class, ...)` first constructs the inherited prototype-backed object and dispatches
`initialize(.Object, ...)`. The default initializer fills named slots or copies an unnamed
compatible S4 object. Within an S4 method, `callNextMethod()` reuses the active arguments and
selects the next less-specific matching signature, falling back to the generic default when no
registered method remains. Registered `names` and `names<-` methods use the same signature engine.

Primitive `seq.int` now covers forward and backward anchoring when `by` is combined with
`length.out` or `along.with`. Default `is.na<-` uses its right-hand side as a subscript and performs
ordinary `[` replacement with a missing logical scalar; list elements, factors, attributes, and
registered S4 replacement methods therefore share the normal subset engine.

## Profile 0.342 POSIXlt extraction and month-token semantics

The Base `[.POSIXlt` method resolves `i` against the observation sequence, applies the resulting
positions to each component, and returns a POSIXlt object unless `j` requests one named component.
`$<-.POSIXlt` removes the stale `balanced` marker. A later observation extraction normalizes such an
object through POSIXct and back to POSIXlt, while an explicitly balanced object is subset directly,
including any observable inconsistent short component. UTC/GMT, names, missing/out-of- range
observations, and all eleven standard components are covered.

The owned `strptime` parser recognizes `%b`, `%B`, and `%h` against the browser C-locale English
month tables. Abbreviated and full forms are accepted for each token without case sensitivity;
invalid spellings produce missing parsed observations.

## Profile 0.344 literal call-head semantics

An R call is represented as language structure whose first entry is a value, not implicitly a
function-name string. `languageEntries()` exposes the normalized callee exactly: identifiers become
symbols, string literals remain character scalars, and other owned constants remain their original
runtime values. `languageFromEntries()` embeds those values back into the normalized AST without
promoting a character scalar to an identifier.

This distinction is observable after `[.call`, `as.list()`, or `as.call()`: a literal character CAR
has type `character`, deparses with quotes, and fails when evaluated as a call head.
`call(name, ...)` continues to provide its separate documented symbol-construction behavior. The
runtime still evaluates normalized AST directly and does not generate JavaScript.

## Profile 0.348 exact-shadowed matching and covariance matrices

Closure and shared builtin argument matching retain separate exact and partial reservations. Exact
matches are removed from the subsequent partial candidate set; partial matches remain candidates for
duplicate detection. This permits a short named actual to select another unmatched leading formal or
remain in dots while preserving duplicate-partial errors and positional skip order.

The Pearson covariance path treats a numeric/logical data frame as a column-major real matrix and
shares pair construction across vector, matrix, and cross-input forms. Result dimensions and column
labels are owned R attributes. Observation-policy selection is explicit and missing/NaN values do
not escape into host control flow. Kendall and Spearman remain deterministic unsupported method
boundaries rather than silently using Pearson behavior.

## Profile 0.349 distance, hierarchical clustering, and array indices

`dist()` computes the six documented finite real-matrix distance methods and returns an owned `dist`
vector with size, labels, display flags, method, call, and class metadata. `as.dist()` extracts the
lower triangle of an owned real square matrix. Missing-value rescaling and non-finite distance
inputs remain explicit boundaries rather than host-dependent approximations.

`hclust()` consumes that owned distance shape and implements single, complete, average, McQuitty,
median, centroid, Ward D, and Ward D2 linkage through reusable Lance-Williams updates. Its merge
matrix, heights, leaf order, labels, method, call, distance method, and class remain R values.
`as.dendrogram()` builds recursive classed branches and leaves, while `order.dendrogram()` traverses
the owned tree without exposing implementation nodes.

`which(x, arr.ind = TRUE, useNames = TRUE)` converts logical array hits from column-major linear
positions into a coordinate matrix. It retains first-axis result labels and dimension labels when
requested; ordinary vector `which()` behavior and selected names remain unchanged.

## Profile 0.350 symbols and lexicographic ordering

`graphics::symbols()` now maps circles, squares, and rectangle width/height matrices expressed in
user coordinates (`inches = FALSE`) onto the existing browser-owned polygon event. It supports
matrix or paired coordinates, `add`, foreground/background colours, line type, line width, and
clipping validation without exposing a canvas or package-specific branch. Device-inch scaling,
stars, thermometers, and boxplots remain explicit unsupported boundaries, so the callable retains a
shape-level compatibility declaration.

`order(...)` now collects an arbitrary number of equal-length atomic sort keys from dots, compares
them lexicographically, and supports scalar or per-key `decreasing`, `na.last`, and the GNU-shaped
`method` selector. Stable source positions break complete ties. This corrects the reusable sorting
contract that corrplot reaches after drawing its symbol layer.

## Profile 0.351 hierarchical tree cutting

`stats::cutree(tree, k = NULL, h = NULL)` now consumes the owned `hclust` merge matrix without
reconstructing distances. Scalar cuts return named integer memberships; vector cuts return
column-major integer matrices with observation and cut labels. `k` is integer-coerced and takes
precedence over `h`; height cuts require nondecreasing merge heights and include merges at the cut
height. Cluster numbers are assigned stably by the first original observation in each component.

The implementation validates merge references, label length, cut ranges, missing values, and
nonmonotone height trees. It remains independent of corrplot and exposes no internal clustering
nodes.

## Profile 0.352 reproducible symmetric eigensolver and fractional sequences

The public runtime's finite real-symmetric `eigen()` path delegates through the base-layer backend
interface to a minimal LAPACK 3.12.1 `DSYEVR` WebAssembly module. It reads the lower triangle,
returns decreasing eigenvalues and matching column vectors, and preserves evaluator-owned input and
result storage. The base package retains a Jacobi fallback only for isolated composition tests.
Signed mtcars FPC/AOE ordering is exact evidence; arbitrary eigenvector sign identity is not a
portable contract, while values and eigenspaces remain tolerance-tested.

`seq(..., length.out = n)` now applies `ceiling(n)` for finite non-negative fractional lengths. Zero
produces `integer(0)`, matching the observable empty-sequence type. Missing, non-finite, negative,
or oversized requests remain deterministic errors or resource-limit failures.

## Profile 0.353 correlation tests and data-frame composition

`stats::cor.test()` now dispatches through an explicit `x, ...` generic to an owned Pearson
implementation. The default method selects complete numeric pairs, computes the correlation,
Student-t statistic and p-value, produces a Fisher-transform confidence interval, supports all three
alternatives, accepts confidence levels from zero through one, and returns an `htest`-classed list
with GNU-shaped fields and metadata. Kendall and Spearman methods, exact rank tests, and complete
source-expression reconstruction for `data.name` remain explicit boundaries.

Column binding now treats a data frame as a row-bearing table rather than as an atomic vector of
columns. `cbind()` preserves existing columns and row extent, appends compatible atomic columns with
normal recycling warnings, and supports nested `colnames(x)[i] <- value` replacement. Mixed
data-frame inputs outside that reusable surface remain deterministic unsupported cases.

`graphics::symbols()` accepts finite zero circle, square, and rectangle dimensions, matching GNU R's
validation contract; zero-area shapes emit no polygon. Negative or non-finite dimensions remain
errors. `graphics::text()` also accepts and validates the reusable `lwd` graphical control without
pretending it changes glyph geometry.

## Profile 0.354 model introspection and grouped-binomial closure

`deparse()` now renders reparsable R source with operator precedence instead of surrounding every
binary node with diagnostic parentheses. This keeps explicit parentheses while allowing formula
consumers to split expressions such as `log(wt) + I(gear^2) + exp(am)`. `formula`, `terms`,
`labels`, generalized `all.vars`, `predict`, and `deviance` compose on retained model objects.

The RNG owns a regular `.GlobalEnv$.Random.seed` integer vector, updates it after draws, and
restores the stream after ordinary assignment of a previously saved seed. `head(NULL)` and
`tail(NULL)` return NULL, and `grepl` treats missing input strings as non-matches.

GLM families now include `quasibinomial` and `quasipoisson`. A two-column binomial matrix response
is filtered by row, converted from success/failure counts to proportions, and multiplies trial
totals into prior weights. `cbind.data.frame` exposes the matching data-frame method, and the
browser-owned datasets package includes the canonical `anscombe` frame.

## Profile 0.355 numeric and graphics closure

`graphics::grid` now emits reusable line segments and returns its invisible `atx`/`aty` contract.
`stats::uniroot` owns bounded scalar root finding, endpoint reuse, `...` forwarding, interval
extension, convergence signaling, and the five-field GNU R result shape. `stats::cov2cor` preserves
square-matrix attributes while normalizing covariance scales, and primitive `tcrossprod` shares the
owned numeric matrix-product path with vector promotion and dimname propagation.

## Profile 0.356 factor-analysis and package-callback closure

`stats::factanal` now fits bounded maximum-likelihood factor models from numeric data matrices,
covariance/correlation matrices, and `list(cov=, n.obs=)` inputs. The implemented slice owns
uniqueness optimization, the lower-bound control, no rotation, varimax rotation, callable rotation,
GNU-shaped result fields, and `stats::loadings` extraction. Formula/data/subset/NA-action handling,
factor scores, broader controls, and full print/rotation metadata remain explicit gaps.

`base::sweep` applies a resolved function across numeric array margins with recycling checks and
shape restoration. `stats::setNames` removes names for NULL, coerces non-character names, pads short
names with missing values, and rejects overlong names. Programmatic closure calls now provide a
bounded synthetic call to `match.call`; the original caller symbol cannot be recovered when no R
syntax call exists. GNU R evidence also fixes `factanal(..., rotation=fn)` to pass only loadings,
not the outer `...`, to the rotation callback.

## Profile 0.357 package-example closure and independent allocation accounting

Numeric binary vector loops checkpoint in bounded batches rather than consulting the host clock for
every output element. R-level loops and calls remain step-accounted, small operations still
checkpoint immediately, and single-vector, cumulative-allocation, output, call-depth, and time
limits remain finite. `maxAllocatedElements` now owns the cumulative element budget independently of
`maxVectorLength`.

Language and Base closure adds expression-vector promotion in `c()`, vectorized `atan2()` with
recycling and shape propagation, GNU-shaped `print(x, ...)`/`print.default(..., width, ...)`, and
generic `update.default()` stored-call rewriting. Updated calls replace named arguments, append new
arguments, preserve lazy syntax, and either return the language object or evaluate it in the caller.

The browser graphics slice accepts scalar/vector `layout(mat=)` as a one-column layout, expression
axis labels through deterministic source rendering, missing/nonpositive legend line types as omitted
entry strokes, and numeric `legend(adj=)` carried through graphics events, PNG/PDF rendering, and
record/replay. Expression labels are not a claim of complete GNU plotmath glyph geometry.

## Profile 0.358 factor-analysis start, optimization, and orientation

Covariance-list factor analysis derives the default uniqueness vector by scaling the inverse-
correlation diagonal estimate by `1 - factors / (2 * variables)`. Optimization operates on bounded
percentage coordinates and retains a five-pair limited-memory curvature history. Default varimax
uses Kaiser row normalization before rotation, restores row scales afterward, and orients each
loading column so its sum is non-negative. These rules are package-neutral and apply to every
browser-admissible `factanal()` call.

## Profile 0.359 exact bounded optimization and reusable package semantics

The composition root installs a typed L-BFGS-B 2.1 Wasm backend for bounded optimization. Base
factor analysis sends only copied numeric coordinates, bounds, objective values, and gradients
through that interface; no package identity, GNU R process, host filesystem, network service, or
generated JavaScript participates. The resulting `ability.cov` fit matches black-box GNU evidence
for its complete optimization result and evaluation counts, while the base layer keeps an owned
fallback for isolated tests.

The same rotation primitive is exposed generically as `stats::varimax()`, including optional Kaiser
row normalization and the returned rotation matrix. `matrix(data)` now defaults to an implicit
single column, and removing its class preserves its dimensions. Filled legend swatches travel as
ordinary `fill`/`border` graphics fields through record/replay and each Canvas, PNG, and PDF host.

Retained package tests run as ordered top-level expressions in one session and from the package
tests directory. Session state therefore crosses expression boundaries and relative `source()` calls
resolve package companions, while step and allocation ceilings restart for each expression instead
of accumulating into an artificial whole-file failure. Unhandled errors still fail at the reported
expression number; no package-specific bypass is added.

## Profile 0.360 generic tibble conversion and civil Date text

The optional `tibble` compatibility namespace is internally consistent for `as_tibble`: namespace
lookup exposes an S3 generic whose default data-frame, list, matrix and atomic paths share one
package-neutral implementation. Scalar values recycle to the inferred or requested row count,
incompatible sizes fail, row names can become a column, and extension attributes survive data-frame
conversion. Checked, unique, universal and minimal name-repair modes are deterministic. This
boundary is narrower than the full upstream tibble extension surface.

Date-to-character coercion maps epoch days through UTC civil time, distinguishes missing values from
numeric non-finites, and rejects values outside the browser's supported civil-date range.
GNU-observed name dropping and attribute construction order are executable flat and recursive
contracts, not incidental implementation details.

## Profile 0.361 S3 group context and polynomial prerequisites

Package namespace loading recognizes GNU R's implicit `Math`, `Ops`, `Summary`, `Complex`, and
`matrixOps` S3 group registrations without inventing visible Base bindings for those group names.
Selected methods receive `.Generic`, `.Group`, `.Method`, `.Class`, `.GenericCallEnv`, and
`.GenericDefEnv`; binary `Ops` supplies one `.Method` entry per operand. `NextMethod()` observes
values reassigned to method formals, skips the active group method, and enters the underlying
primitive/default path without recursively dispatching to itself. Operators invoked as first-class
functions use the same S3 path as operator syntax. `sum()` and `prod()` participate in `Summary`
dispatch, and `unique()`/`duplicated()` compare list entries structurally.

`stats::deriv` is currently the GNU-shaped S3 generic only; symbolic `deriv.default` remains
unsupported. `stats::poly` supplies single-variable raw and orthogonal bases, coefficient reuse,
prediction, attributes, and formals; multivariate `...` bases remain explicit. General real
non-symmetric `eigen()` is no longer limited to order three: the browser-owned fallback derives the
characteristic polynomial, finds complex roots, and solves complex null spaces. This is reusable
package closure, not a claim of complete LAPACK numerical identity for arbitrary ill-conditioned
matrices.

## Profile 0.362 model calls, contrasts, and rank deficiency

`getCall.default()` forces only `x`; dots remain accepted and lazy. The internal default update path
uses GNU-shaped `formula.` and trailing `evaluate` matching, applies dot-formula substitution to a
retained model formula, rewrites named stored-call arguments without forcing their expressions, and
evaluates only when requested.

Factor encoding can resolve named treatment, sum, Helmert, or explicit numeric/logical contrast
matrices. Contrast values and column labels feed interactions, retained model metadata,
`model.matrix()`, and prediction. Visible QR state is sufficient for `qr.R()` reconstruction and for
the row-space test behind `predict.lm(rankdeficient = "NA" | "NAwarn")`; operations requiring the
discarded full decomposition remain explicit boundaries.

## Profile 0.363 source-language and condition closure

Language reconstruction recognizes `function(NULL, body)` as a zero-formal function and retains
named call entries. Deparse owns structural function/lambda lines and escapes control characters in
non-syntactic identifiers. The default TRE path treats dot as newline-matching; the Perl path does
not unless explicitly enabled. Warning signaling now traverses dynamic handlers, exiting
`tryCatch()` handlers, then global handlers while preserving muffle restarts.

## Profile 0.364 deparse, handler-order and visibility closure

Source-language deparsing now distinguishes closure display (`function (`) from quoted source
functions (`function(`), emits GNU-shaped multiline blocks, wraps formulas and nested-call
arguments, and retains noncanonical multi-argument `return()` as a language call. Calling-handler
and exiting-handler frames share a monotonic nesting sequence, so only dynamically inner calling
handlers run before a selected exiting handler. `suppressWarnings()` and `suppressMessages()`
propagate the wrapped expression's visibility as well as its value.

## Profile 0.365 parse-data and one-dimensional apply semantics

`parse()` now inherits `keep.source` from the ordinary option default when the argument is omitted,
matching the GNU R closure contract used by unchanged package code. `parse(text=)` also accepts list
and pairlist inputs through element-wise character coercion. Nonterminal `getParseData()` rows use
the GNU token `expr`; assignment-related terminal nodes retain their distinct terminal tokens.

`apply()` accepts one-dimensional arrays for a scalar `MARGIN = 1`, passes each element as a
length-one slice, and applies the existing simplification rules to the collected results. Higher
dimensional margins beyond the currently implemented one- and two-dimensional subset remain
explicitly unsupported.

## Profile 0.366 eval frames, ellipsis, missing names, and model NA policy

`eval()` now exposes GNU-shaped synthetic dynamic frames: an outer frame owns the forced `expr`,
`envir`, and `enclos` bindings, while the inner frame is the selected evaluation environment itself.
This makes ordinary frame reflection reusable by `source()`, examples, and package code without
recognizing a package identity.

Normalized parse data classifies `...` as `SYMBOL_FORMALS` in a parameter list and as `SYMBOL` in an
expression. Names replacement preserves missing-name masks, and `list2env()` maps a missing name to
the literal binding `"NA"` while continuing to reject a genuinely empty name. `na.fail()` is a
generic runtime binding, and the bounded `lm()`/`model.frame()` path honors `na.action = na.fail` by
rejecting incomplete model data.

These contracts are fixed by checked-in flat and recursive GNU differential cases. They do not claim
exhaustive call-stack identity, every custom `na.fail` method, comprehensive GNU R behavior, or
arbitrary package compatibility.

## Profile 0.367 configuration, Box-Muller, and QR dispatch semantics

`utils::modifyList()` recursively merges named lists, preserves the first list's non-name
attributes, removes `NULL` replacements by default, and retains them under `keep.null = TRUE`.
Unnamed replacement entries remain non-operative, matching the measured GNU contract.

The browser-owned normal RNG now implements `normal.kind = "Box-Muller"`. Each generated pair uses
two uniform draws, retains the partner outside `.Random.seed`, and clears that partner when the
uniform/normal kind or seed is reset. Fixed-seed values and `.Random.seed` positions are covered by
exact differential evidence.

The `qr()` generic now forwards named dots to `qr.default()`, including `LAPACK`, and `solve()` has
the GNU-shaped `solve.qr(a, b, ...)` S3 path over evaluator-owned decompositions. Profile 0.367 does
not claim LAPACK column-pivot identity for arbitrary matrices; the owned QR backend and its current
rank/conditioning boundaries remain the declared browser-admissible implementation.

## Profile 0.368 blank character coercion semantics

Character-to-integer and character-to-double coercion treat empty and whitespace-only strings as
typed missing values without emitting `NAs introduced by coercion`. Decimal and exponent strings
remain numeric inputs; integer conversion truncates them toward zero. Character `"NaN"` becomes
`NA_integer_` without an integer-range warning, while invalid text and infinities retain the
separate general-coercion and integer-range warning contracts measured from GNU R.

These rules apply to the shared Base coercion path, including package namespace initialization from
empty environment variables. They do not make host processes, MPI, or external socket transports
available in a browser runtime.

## Profile 0.369 S3 dispatch visibility

`UseMethod()` returns the selected S3 method's value with that method's visibility. `NextMethod()`
propagates the next selected method's visibility through the current method and generic. This
applies to ordinary and registered methods and remains independent of any package identity. A later
expression in an enclosing block still determines the block's final visibility.

Flat, recursive GNU differential, and public API integration cases fix the direct, chained, and
enclosing-block behavior. This closes one reusable S3 dispatch gap; it does not establish exhaustive
S3 parity or arbitrary package compatibility.

## Profile 0.370 package-driven control, grouping, environment, and handler semantics

`if` and `while` accept GNU R's exact character logical spellings: `TRUE`, `T`, and `true` are true;
`FALSE`, `F`, and `false` are false. Other strings remain non-interpretable, and this coercion does
not extend to `&&` or `||`. Zero-, multi-, and missing-value conditions retain their distinct GNU R
errors.

`split()` derives implicit integer and double groups in numeric factor order rather than lexical
character order and retains `NaN` as a non-missing group while excluding `NA`. `format()` returns
GNU R-shaped labels for registered global, empty, package, and namespace environments and a stable
session-local hexadecimal label for anonymous environments. `tryCatch()` evaluates its handler list
before its protected expression and permits empty handler names when the list also has named
handlers, matching the behavior of `list(...)` and `names()` in GNU R's implementation contract.

These are package-neutral runtime rules with public API, flat, and recursive differential evidence.
They close the ordered blockers selected by one frozen package artifact; they do not claim complete
control-flow, formatting, condition-system, or arbitrary-package compatibility.

## Profile 0.371 package-driven parsing, data, table, and condition semantics

`match.arg()` derives choices from its calling formal when `choices` is omitted. Dynamic call-frame
queries preserve GNU R's `sys.parent()`/`sys.parents()` relationships. `options(list())`, browser
null-device paths, `parse(file=)` over runtime-owned files and connections, explicit missing factor
levels, `as.table()` dispatch/default conversion, and text-connection seek queries now follow the
observed GNU R contracts selected by the frozen package run.

PCRE replacement processing supports stateful `\\U`, `\\L`, and `\\E` controls. The independently
sourced `datasets::women` and `datasets::cars` objects are browser-owned core data with recorded
provenance. `errorCondition()` constructs extensible condition objects. Passing an existing
condition to `warning()` or `message()` preserves its fields and class vector, while automatic
vector-recycling warnings now enter calling and exiting condition handlers and expose a working
`muffleWarning` restart. Structured warning results retain the standard
`simpleWarning`/`warning`/`condition` class vector and the originating deparsed operator call.

These rules are package-neutral and covered by public API, flat, and recursive GNU R differential
tests. They close the ordered blockers exposed by `tinytest 1.4.3`; they do not establish exhaustive
condition, parser, dataset, Base R, or arbitrary-package compatibility.

## Profile 0.372 package-driven reflection, conditions, grouping, graphics, and statistics

`getElement()` performs exact extraction across vectors, environments, expression vectors, language
objects, S4 objects, and S3 `[[` dispatch. `as.list(symbol)` produces a one-element list, and
`lfactorial()` reuses `lgamma(x + 1)` with GNU-exact zero values and Math-group dispatch. Nested
`update.default()` calls now dispatch `getCall()` with the nested object's promise rather than an
outer closure's argument frame.

`suppressPackageStartupMessages()` muffles only `packageStartupMessage` conditions through
`tryInvokeRestart()`. Cumulative functions accept classed numeric vectors and convert
one-dimensional `dimnames` to names while dropping dimensions and classes. `unsplit()` reconstructs
ordinary atomic and list vectors, including factor groups with unused levels.
`graphics::plot.formula()` covers the factor-response boxplot path, and `stats::t.test.formula()`
covers a numeric response split by an exactly two-level factor.

Public API, flat, and recursive GNU R differential tests cover these package-neutral contracts. They
close the ordered blockers exposed by `permute 0.9-10`; broader `unsplit()` data-frame,
formula-subset, graphics, statistics, and arbitrary-package compatibility remain open.

## Profile 0.373 package resources and null external pointers

Source-package normalization accepts an individual reviewed resource up to 64 MiB while retaining
the independent 192 MiB aggregate package ceiling. Runtime loading gives those already reviewed
package resources a separate serialized-input ceiling; ordinary user-provided serialization remains
bounded by `maxOutputBytes`. Both limits are enforced before allocation or decoding.

The serialization model now represents `EXTPTRSXP` as a permanently null, browser-safe external
pointer with protected value, tag, trailing attributes, and reference identity. It supports XDR and
workspace round trips, reports GNU-compatible `typeof()`, `length()`, and implicit class shapes, and
cannot cross the public JavaScript value boundary. It does not expose a native address, finalizer,
or host capability.

Unit tests plus flat and recursive GNU R differential cases cover these package-neutral contracts.
They close the first blockers exposed by `bigD 0.3.1`; general external-pointer operations, native
package ABIs, arbitrary package resources, and comprehensive serialization compatibility remain
open.

## Profile 0.374 numerical and package-runtime closure

The runtime adds reusable scalar optimization, gamma probability, exact pi-scaled trigonometry, four
documented cubic-spline methods, callable `approxfun` interpolation, complex linear algebra, and
full-row-rank underdetermined `qr.solve`. `chol2inv` consumes the leading upper-triangular Cholesky
factor, while formula evaluation expands numeric matrix terms into named design columns and
preserves the matrix in the model frame. Array/vector Ops now follow GNU's singleton-dimension-drop
contract, and logical matrix Ops preserve dimensions.

These are package-neutral browser implementations with flat and recursive GNU R evidence. They do
not delegate to GNU R, identify `pracma`, or imply complete numerical, model, or package semantics.

## Profile 0.376 smoothing splines, quantile plots, and GLM controls

`stats::smooth.spline` independently solves the weighted natural-cubic roughness-penalty system on
normalized coordinates. It supports explicit effective degrees of freedom, direct lambda, spar, GCV
or leave-one-out selection, duplicate-coordinate aggregation, leverage and criterion output, and the
public `smooth.spline` object shape. `predict.smooth.spline` performs natural cubic interpolation,
linear boundary extrapolation, and first- or second-derivative prediction.

The browser implementation admits at most 256 active spline knots and uses its independent
natural-spline basis. Large default fits select a bounded deterministic subset of ordered
observations, then expand fitted values and leverage back to the full observation coordinates;
explicit `all.knots` or `nknots` requests above the browser budget fail deterministically.
Explicit-df fits, large-fit structure, and prediction have package-neutral flat and recursive GNU R
evidence; this does not yet claim exact equivalence for every knot-selection or `control.spar` path.

`stats::qqnorm` is an S3 generic whose default method preserves missing-value positions, uses the
GNU-compatible `ppoints` convention, returns the invisible theoretical/sample quantile pair, and
optionally plots it. `stats::qqplot` sorts equal-length samples or interpolates the longer sample at
endpoint-inclusive probabilities for unequal lengths. Its returned coordinates and plotting path are
covered; confidence-band behavior requested through `conf.level` or `conf.args` is not yet part of
the compatibility claim.

`stats::glm.control` constructs the public `epsilon`, `maxit`, and `trace` control list, validates
the positive scalar controls, preserves supplied integer/double storage, and exposes GNU-compatible
defaults and formals. Explicit `data(..., package =)` lookup now fails immediately with the package
missing diagnostic when the requested package is unavailable, allowing declared-Suggests paths to be
classified without inventing the absent dataset.

## Profile 0.377 normal density

`stats::dnorm` provides vectorized normal density and log-density evaluation with mean and standard
deviation recycling, NA/NaN distinction, zero-, negative-, and infinite-scale boundaries, attribute
selection from the longest numeric argument, GNU-compatible formals, and a structured domain warning
whose call identifies the originating expression. The implementation is browser-owned and uses the
shared runtime vector and condition contracts; it does not delegate to GNU R or package code.

## Profile 0.378 independently sourced lynx data

`datasets::lynx` is now a browser-owned package resource admitted from an independently published
CC0 CSV. The ordinary core-package resource loader evaluates its data script, constructs the double
`ts` series with `tsp = c(1821, 1934, 1)`, and exposes the same object through autoload and
namespace lookup. The loader contains no package-consumer identity branch and performs no host I/O
or network access at runtime.

## Profile 0.379 autoregression and geometric random generation

`stats::ar` adds browser-owned univariate Yule-Walker fitting with AIC order selection,
autoregressive coefficients, corrected prediction variance, partial autocorrelations, residual
time-series shape, and asymptotic coefficient covariance. The current contract explicitly rejects
multivariate input and `burg`, `ols`, and `mle` methods.

`stats::rgeom` adds vectorized integer geometric variates over the shared session RNG with `n`
length semantics, probability recycling, the probability-one limit, missing/domain propagation, and
structured warnings. The evidence covers distributional invariants rather than claiming exact
cross-engine sample identity for ordinary probabilities.

## Profile 0.380 stationary ARMA simulation

`stats::arima.sim` adds browser-owned univariate stationary ARMA recursion with explicit or
generator-produced innovations, burn-in innovations, forwarded generator arguments, and double `ts`
output. Stable AR, MA, and mixed ARMA paths plus custom R closure generators have flat, recursive,
and integration evidence. Non-stationary autoregressive coefficients fail with the GNU R-shaped
diagnostic. Integrated models (`d > 0`) remain an explicit unsupported boundary until their
initialization and differencing contracts receive independent evidence.

## Profile 0.381 callable reflection and vectorized uniform generation

`methods::formalArgs` returns formal parameter names for closures, registered regular builtins, and
character-named functions, while primitive/zero-formal functions and invalid values follow the
documented null/warning behavior. It is exported through the ordinary core `methods` namespace.

`stats::runif` now follows the common random-generator length contract and recycles vector `min` and
`max` bounds. Finite equal bounds return constants without advancing the session RNG; missing,
non-finite, reversed, and zero-length bound inputs produce GNU-shaped NaN/NA values and warnings.
Results drop bound metadata and expose the public `n`, `min`, and `max` formals.

## Profile 0.383 call, collection, and graphics semantics

Closure argument matching treats a named missing actual as provisional, allowing a subsequent
non-missing positional actual to fill the same formal while preserving duplicate named-argument
errors. `do.call()` shares that rule, and a character target uses function-mode lexical lookup so a
nearer non-callable value does not hide an outer callable. Vector `rep(times=)` is applied after
`each` expansion, `%in%` remains non-generic, data-frame `apply()` uses matrix coercion, and
`range.default()` recursively traverses supported list and pairlist leaves.

One-dimensional arrays are admitted by the shared model-frame and `barplot()` paths. `stripchart()`
has generic, formula, default, and bounded-overplot behavior. `symbols(inches=)` converts physical
dimensions through the plot-region inch scale. `pie()` produces replayable wedge polygons and labels
with direction, radius, edge, color, border, line, density, angle, annotation, and visibility
controls. Expression labels use normalized source text as a deterministic fallback, not a claim of
complete mathematical glyph layout. Detailed perspective ticks remain accepted when axes are
disabled; enabled detailed-axis construction is still explicitly unsupported.

The unchanged plotrix examples select these shared semantics and now reach `example:raw.means.plot`.
Its current two-value/four-count `rep()` call is invalid in GNU R as well, so the open semantic
divergence is the preceding grouping/factor cardinality rather than repetition strictness.

The follow-on replacement increment distinguishes missing-row whole-column data-frame assignment
from explicit row-cell assignment. Whole-column factors and arbitrary classed vectors retain their
object attributes; replacement results also expose GNU's `names`, `row.names`, `class` attribute
ordering. Binary arithmetic `Ops.data.frame` applies operators columnwise across scalars, flattened
vectors or matrices, lists, and equally-sized data frames in either operand order, preserving the
result frame's column and row identity.

High-level `plot.default()` forces but does not persist inline `mar`, warns for unknown
non-graphical parameters, and continues to reject known graphical controls whose behavior is not
implemented. `text(labels = NULL)` returns invisible `NULL` without drawing, while other zero-length
label vectors remain errors. These shared fixes move unchanged plotrix to the missing `seq.Date`
contract in `example:twoord.plot`.

## Profile 0.384 Date sequence and graphical forwarding semantics

Date sequence dispatch now returns classed Date vectors for numeric, `difftime`, daily, weekly, and
calendar-unit steps. Endpoint, length, direction, calendar rollover, `length.out`, and `along.with`
behavior is implemented at the shared Base layer, including reverse construction from a supplied
`to` value. Automatic Date axes derive civil tick positions from the active user-coordinate range;
explicit positions are finite-filtered, sorted, formatted, drawn through the common axis path, and
returned invisibly with Date class.

Rectangle and polygon primitives distinguish recognized-but-irrelevant graphical controls from truly
unknown names. The former are forced and ignored where they cannot affect the primitive; the latter
produce GNU-compatible warnings without preventing drawing. These semantics carry the unchanged
plotrix artifact through its remaining installed examples and generic applicable package checks at
P7 without package identity branches.

## Profile 0.385 recursive data-frame composition and scatterplot3d P7

`grDevices::xyz.coords()` owns separate, matrix, data-frame, and named-list three-dimensional
normalization with recycling, logarithmic omission, labels, and exact formals. `data.frame()` now
recursively expands ordinary named lists, nested lists, matrices, and data frames while preserving
row labels; `I()` list/expression columns remain atomic columns. `graphics::plot.window()` accepts
GNU R's missing/non-positive aspect sentinel and exposes the documented `log = ""`, `asp = NA`
formals. The independently sourced CC0 `datasets::trees` table loads through the ordinary static
package resource path.

Those shared contracts carry the unchanged pinned `scatterplot3d 0.3-45` artifact through every
installed example and applicable generic package-check step at P7. No package identity branch,
source rewrite, or substituted result is present.

## Profile 0.387 lazy dispatch and formula semantics

The Base `with()` generic now resolves S3 methods after forcing only `data` and before applying the
default path's required-`expr` rule. Its original promises remain lazy and unchanged, so a method
can observe a missing `expr`, accept method-specific named arguments, or substitute and evaluate the
expression in its own data masks. The evaluator's explicit-object `UseMethod()` route uses that
object only for method selection and preserves the generic call's original actual arguments.

Formula call-like subset selection rebuilds a normalized formula while retaining its class and
lexical environment. Parenthesized formula bodies render as valid language and unwrap recursively
for term algebra, so `a * (b + c)` expands to `a`, `b`, `c`, `a:b`, and `a:c` through the common
`terms()`, `model.frame()`, and `model.matrix()` paths. Non-grouping calls remain ordinary formula
terms. These shared semantics remove the ordered unchanged-`mitools` blockers without a package
identity branch.

## Profile 0.388 namespace binding replacement

The shared namespace layer now exposes the two `utils` assignment helpers needed by ordinary package
imports. `assignInMyNamespace()` derives the package from its calling namespace;
`assignInNamespace()` accepts an explicit package name or namespace environment and otherwise
requires a package-associated location. Replacement is limited to existing bindings. A locked
binding is temporarily unlocked and restored in a `finally` path, and successful calls return
invisible `NULL`. Missing bindings and global/non-package locations remain errors.

The unchanged `logger 0.4.2` package exercises both paths against its namespace and then performs a
separately authored `formatter_sprintf` logging call. The next example failure is deliberately not
handled by coercing numeric `sprintf` formats: GNU R without logger's suggested `glue` dependency
fails the same `appender_file` example, so the remaining gap is dependency/native closure.

## Profile 0.389 device-independent axis tick semantics

The `grDevices` namespace now owns exported `axisTicks()` and private `.axisPars()` builtins. Linear
scales derive bounded interior tick extents from the requested interval count or interpolate an
explicit `axp` vector. Log scales consume `log10`-transformed `usr`, select decade codes, emit 1/2/5
or 1/5 subdivisions, thin wide decade ranges, and linearize spans below one decade in the original
scale. Reversed input preserves reversed tick order. Both functions enforce finite numeric extents,
positive interval counts, deterministic allocation, and GNU-compatible formals.

This shared implementation removes the first unchanged `gridGraphics 0.5-1` namespace blocker. All
package R source parses; namespace loading now stops at the next missing shared core primitive,
`grDevices::contourLines`.

## Profile 0.390 device-independent contour topology

`grDevices::contourLines()` coerces a documented numeric matrix grid, or packed `x`/`y`/`z` list,
into an ordered list of level/x/y polylines without opening a graphics device. Cell crossings share
canonical edge identities so open paths and closed loops join deterministically. Four-edge cells use
a center-value saddle decision, cells with one non-finite corner retain the finite triangular
boundary, and values exactly equal to a level receive the GNU-observed 0.1% global-range
perturbation. Duplicate levels remain duplicate output passes.

Strictly increasing coordinates and conformable matrix dimensions are enforced. Constant and
all-missing surfaces warn and return `NULL`; non-finite levels are skipped. The evaluator-owned
`max.contour.segments` option defaults to 25,000 and bounds individual output paths with a warning,
while runtime allocation and cooperative checkpoints bound the complete calculation. The unchanged
`gridGraphics` namespace now proceeds to the reusable `grid::makeContent` lifecycle blocker.

## Profile 0.391 grid grob content and context lifecycle

`grid::makeContent(x)` and `grid::makeContext(x)` are ordinary visible S3 generics with one required
argument. They resolve caller-visible or namespace-registered class methods through the shared S3
registry, retain the original call arguments during dispatch, and support the normal class chain and
`NextMethod()` continuation. Their default methods return the input object unchanged, including all
attributes and reference identity where applicable. A method result is not forced into a particular
grob shape because grid extensions may replace or augment the object during lifecycle resolution.

This package-neutral lifecycle seam is sufficient for unchanged `gridGraphics` namespace loading,
attachment, method registration, documentation, and example execution. Device rendering and PDF
default state are separate contracts; the next retained-test blocker is `grDevices::pdf.options`.

## Profile 0.392 PDF option state and device defaults

Each runtime session lazily owns an ordered PDF option store with GNU R's 21 defaults. A plain
`pdf.options()` query is visible. Named update and `reset = TRUE` calls return a snapshot of the
previous state invisibly; reset restores defaults before processing simultaneous updates. Names are
validated before mutation, duplicates are rejected, and ordinary values with a different R mode or
length warn and leave the corresponding option unchanged. `fonts` is deliberately shape-flexible at
option-storage time and is validated when a device consumes it.

When `pdf()` omits an option-bearing argument, it reads the session store. An explicit argument wins
only for that device and does not modify the store. File-path admissibility, device validation, and
browser-memory output remain downstream contracts rather than state-update side effects.

## Profile 0.393 retained grid viewport tree

Grid state separates the current viewport path from retained paths. Pushing viewports records each
prefix, moving upward changes only the current path, and moving downward resolves an exact path or a
descendant name sequence in the retained tree. `upViewport()` returns the traversed `vpPath`
invisibly, `downViewport()` returns the traversed depth invisibly, `vpPath()` constructs the shared
`vpPath`/`path` object, and `current.viewport()` exposes the current node. Pop operations remove the
corresponding retained subtree, while `grid.newpage()` clears both path views.

Viewport justification accepts GNU-observed character axis labels or numeric/logical coordinates and
stores a normalized two-value vector in both `justification` and `valid.just`. This increment does
not claim the complete ROOT viewport state or complete recorded-graphics display-list compatibility;
the latter is the next package-selected blocker.

## Profile 0.395 grid drawing grob families

Grid polygon, segment, line, and point constructors retain unit objects, grouping metadata, gpar,
name, and viewport path in GNU-shaped grobs. Drawing emits device-independent polygon, segment, and
point journal events and returns the grob invisibly. `draw = FALSE` constructs without emitting.
This primitive layer does not yet claim that composite high-level graphics events are lowered to the
same ordered display-list sequence as GNU R.

## Profile 0.396 recorded boxplot expansion

Recording expands each composite boxplot group into independent fill, median, placeholder point,
whisker, staple, outline, and outlier journal entries. This keeps the live browser event compact
while giving generic recorded-plot consumers an ordered primitive stream and giving replay the same
normalized primitive geometry. Exact black-box evidence currently covers the axes-suppressed,
vertical, unnotched two-group path; it does not claim complete GNU graphics-engine internals,
`pairs.default`, or every boxplot graphical control.

## Profile 0.400 callable contrasts and direct QR fitting

Model-matrix contrast specifications may be callable R values. The runtime calls a generator with
`n = levels(factor)` and lets ordinary defaults control `contrasts` and `sparse`. Numeric matrix
results are checked for row count, missing values, degree count, and independence from the intercept
and earlier columns. When fewer than `n - 1` independent columns are returned, a deterministic
orthogonal complement is appended while supplied values and labels remain first. The resolved
matrix, rather than the closure, becomes the matrix `contrasts` metadata.

`stats::lm.fit()` accepts a numeric design matrix and one or multiple numeric responses, applies an
optional vector offset, shares the pivoted QR least-squares engine, and returns the direct-fit
fields. Non-QR methods and broader multi-response offset shapes remain explicit boundaries.

## Profile 0.399 call `$`, model-frame subsets, and S4 promotion

Normalized call values expose their pairlist-style tags through `$`: reads use GNU's exact then
unique-partial matching, while writes use exact names and can replace, append, or delete entries.
Rebuilding the normalized call retains its ordinary attribute map. Model-frame subset expressions
run in the data environment before row filtering, and duplicate selected row names receive stable
`.1`, `.2`, and later suffixes without changing the original data frame. The S4 registry now
promotes an ordinary closure owned by `setMethod(where=)` when its first method establishes generic
dispatch, while excluding closures found only in nested local frames; `methods::extends()` traverses
stored superclass definitions. Complete conditional extension metadata and
`extends(fullInfo = TRUE)` are not yet represented.

## Profile 0.397 numeric pairs layout

The default numeric `pairs` path maps each finite matrix/data-frame column into an inset unit cell
inside one device-independent scatterplot matrix. Off-diagonal cells emit point events, diagonal
cells emit column labels, cell boundaries emit segment events, and an optional main title emits a
separate text event. Point symbol, foreground, fill, and size inputs recycle by observation. The
result is invisible `NULL`; missing coordinate pairs are omitted. Custom panel functions, formula
inputs, logarithmic transforms, per-panel GNU parameter stacks, and exact GNU axis geometry remain
explicit unsupported boundaries.

## Profile 0.403 completion settings and Reference Class super calls

`utils::findMatches()` applies regex matching first and retries case-insensitively only when fuzzy
matching is enabled and the exact pass is empty. It preserves selected input names, drops missing
candidates, uses the first pattern with a warning, and quotes nonsyntactic matches only when every
selected value is nonempty. `utils::rc.settings()` stores its documented controls per evaluator
session, returns them in GNU query order, updates invisibly, and ignores non-scalar, missing, or
non-logical update values instead of overwriting existing state.

Each bound Reference Class method receives a private lexical environment above the instance. That
environment supplies `callSuper()` without adding a visible field or method. Invocation metadata
selects the next same-name implementation in the recorded class hierarchy; nested closures may still
discover the owning method frame. When a root `initialize` calls super, named arguments are assigned
through the shared field map and unknown fields fail deterministically. Unnamed reference object
merging and the complete GNU Reference Class metadata protocol remain outside this increment.

## Profile 0.404 apply/map language vectors

The apply/map iterator accepts ordinary vectors, pairlists, expression vectors, and language
objects. Language objects expose their call entries as a pairlist-like sequence, retain entry tags
as result names, and pass each unevaluated entry to the mapped callable. Expression entries remain
language values rather than being evaluated. When a call created by removing the original function
head has a non-symbol first entry, `as.character()` renders that entry without the synthetic outer
parentheses required only by its temporary callee position. Recycling warnings, empty-input
behavior, simplification, and fixed `MoreArgs` continue through the existing generic path.

## Profile 0.408 bounded rectangular SVD

The owned real `svd()` kernel chooses the smaller Gram matrix. Tall and square inputs diagonalize
`X'X` and reconstruct `U = X V / d`; wide inputs diagonalize `XX'` and reconstruct `V = X' U / d`.
Both sides pass through deterministic orthonormal completion so `nu` and `nv` requests may include
the complete admissible bases without allocating the larger Gram matrix.

This contract covers finite real matrices, bounded allocation, requested output dimensions,
reconstruction, orthogonality, and the existing deterministic singular-value ordering. It does not
claim GNU's internal LAPACK algorithm, singular-vector sign identity, complex matrices, or unbounded
dense inputs.

## Profile 0.409 grouped replacement and package-data encoding

`split<-` performs replacement-function dispatch before a shared default path. Default replacement
groups atomic vectors, lists/pairlists, matrices, and data frames with the same selector model used
by `split`; group values recycle, missing grouping positions remain unchanged, and existing names,
dimensions, columns, and row names flow through the generic replacement machinery. A zero-length
replacement for a selected nonempty group is an error. Expression-vector replacement and broader
class-specific contracts remain explicit boundaries.

`plot.default(las=)` consumes a coercible length-one value, truncates finite numeric input, and
rejects values outside zero through three. The recorded graphics protocol does not yet encode axis
text orientation, so this increment covers call admission and validation rather than rendering
identity. `stats::ave` is owned and exported by the stats namespace and exposes `FUN = mean` in its
formal list.

The version-3 XDR reader treats ASCII, US-ASCII, ANSI_X3.4-1968, 646, and ISO646-US as equivalent
seven-bit native encodings. Decoding is chunked and browser-owned; a byte above `0x7f` fails
deterministically. NativR serialization still writes UTF-8, and arbitrary host-native code pages,
locale databases, and host codec discovery remain unsupported.

## Profile 0.410 one-dimensional selection and character matching

Rectangular subsetting treats a one-dimensional array as dimensional while more than one selected
element remains. With default dropping, scalar and empty results lose `dim`; selected axis labels
become ordinary names, including `character(0)` for an empty selection from a named axis. Larger
results retain the sole dimension and the selected dimname vector. `sort.default()` routes
one-dimensional inputs through this same selector, and a `table` class is retained only when the
dimension survives. Object sorts ignore `index.return` and `partial`; non-object sorts retain the
existing control behavior.

`table()` derives unnamed dimension labels at deparse level one: identifiers retain their spelling,
while calls and other expressions use the empty label. `charmatch()` first resolves exact matches,
then accepts only a unique partial match; duplicate exact matches and ambiguous partial matches
return zero. Empty strings never partially match, missing values participate through character
coercion, `nomatch` is coerced to a scalar integer, and output attributes are dropped. Matching uses
bounded checkpoints and does not consult host locale services.

## Profile 0.411 S4 package seams and image aspect windows

A `setAs()` registration whose conversion closure accepts `to` or `...` receives the requested
target class. The target promise retains GNU R's omitted-formal marker, so the closure can both read
`to` and observe `missing(to)`. A conversion that accepts only its source remains a one-argument
call. `new()` accepts an unnamed S4 parent instance only when the target class extends its source
class and copies matching inherited slots before named overrides. `slot()` and `slot<-` resolve a
single character slot name, preserve the S4 class, and expose GNU-shaped formals including the
replacement `check` argument. Registries and values remain evaluator-session-local.

`image.default()` admits `asp` through measured graphical controls and uses the shared plot-aspect
calculation before writing its window event. The calculation is device-parameter aware and covered
by exact GNU R window evidence. Broader S4 validity/multiple-dispatch behavior and pixel identity
for arbitrary graphics devices remain outside this increment.

## Profile 0.417 environment traversal and S3 target syntax

Environment references deparse as the stable text `<environment>` without exposing evaluator or
Tree-sitter internals. `eapply()` enumerates only the supplied environment's own bindings, filters
dot-prefixed names through `all.names`, uses `ls(sorted = FALSE)`-compatible reverse insertion order
for non-hashed environments, forces delayed and active bindings through the shared evaluator, and
invokes a `match.fun`-resolved callback with forwarded arguments. `USE.NAMES = TRUE` preserves a
zero-length names attribute for an empty result. Hashed environments retain NativR's documented
deterministic browser enumeration order rather than emulating private GNU hash-table buckets.

S3 dispatch for `$`, `[[`, `$<-`, and `[[<-` carries the evaluated receiver together with the
original target expression. Method-side `substitute(x)` therefore observes source names such as
`.super`; replacement methods observe the synthetic `*tmp*` receiver used by GNU replacement-call
semantics. This is call-frame metadata, not generated JavaScript or package-specific behavior.

## Profile 0.418 call frames, date/time, DCF, and sequence semantics

Each closure invocation records its supplied actual-argument count independently of formal matching;
`nargs()` reads that count from the active frame, and evaluator-created frames expose their
GNU-observed synthetic count. Generic builtin dispatch carries the original generic call and caller
environment into the selected S3 method, so `match.call()` and lazy dots observe method-name and
source-expression semantics rather than an anonymous implementation closure.

Explicit `%Y-%m-%d` conversion normalizes one- or two-digit month/day fields and produces missing
dates for invalid or incomplete fields. Formatted date-time parsing recognizes evidenced `%OS`
fractions and `%z` numeric offsets before constructing browser-owned POSIX values. `write.dcf()`
serializes atomic tabular records through the virtual connection layer with missing-field omission,
blank record separators, continuation indentation, and invisible return. Character `seq()` endpoints
use scalar numeric coercion while preserving GNU-observed storage for implicit versus explicit step
forms. These are reusable semantics; no package identity is inspected.

## Profile 0.419 time-series, S4 vector, and POSIX sequence semantics

Elementwise `exp`, `expm1`, and unary `!` retain formal S4 identity for numeric or logical data-part
subclasses. S4 generic selection permits the registered default closure when no first positional
dispatch object is supplied, so later named arguments retain ordinary generic fallback behavior.
`aggregate` performs normal S3 dispatch before its vector default, `filter` accepts its documented
two-choice default expression, and `prod(NULL)` returns the empty double product.

Stats exposes reusable robust LOWESS, deterministic fixed-span/adaptive super-smoothing, and
smoothing-spline input normalization for a response vector, x/y list, or two-column matrix.
`strptime` resolves `%j` through leap-year-aware UTC civil dates. `seq.POSIXt` implements the exact
three-of-four argument contract with fixed seconds/minutes/hours/days/weeks, `difftime`, and UTC
month/quarter/year offsets while retaining POSIXct/POSIXt class and available time-zone metadata.
All paths are evaluator-owned and package-neutral.

## Profile 0.420 matrix utilities and S4 promotion semantics

`tail.matrix` computes row slices through the shared tail path, synthesizes width-padded row labels
only when no explicit row names exist and `keepnums` is true, and treats `addrownums` as a
deprecated alias only when `keepnums` was not supplied. `na.contiguous.ts` rebuilds the selected run
with structural attributes first, followed by `na.action`, `tsp`, and class, matching the observable
GNU attribute contract rather than retaining arbitrary custom metadata.

Installing the first method for the methods-package `getDataPart` or `setDataPart` closure creates a
global S4 generic and emits the observed promotion message. This promotion is deliberately limited
to those ordinary methods-package functions; implicit dispatch does not replace unrelated S3
generics or primitives. Formal matrix subclasses retain an atomic matrix data part, newly assigned
formal slots precede the class attribute, and base `cbind`/`rbind` select an applicable formal S4
binary method before attempting S3 dispatch. When a matrix-backed binary S4 method delegates to the
base bind generic, the nested call resumes through its S3 method instead of redispatching the same
S4 method. Direct `cbind2`/`rbind2` calls expose `x`, `y`, and `...`. These rules are
package-neutral and do not inspect package identity.

## Profile 0.421 matrix-column, model, QR, and graphics-panel semantics

Row selection on a data frame delegates matrix-valued columns to dimensional subsetting and then
restores the `AsIs` wrapper used to protect a matrix as one column. The selected matrix retains its
dimensions and dimnames while the outer frame rebuilds compact row names. Arbitrary matrix custom
classes are not retained by this path, matching the observed black-box behavior.

`terms` dispatches through a discoverable `terms.default`; the default avoids redispatch and feeds
the shared formula/model path. `model.matrix` and `model.matrix.default` expose GNU-shaped formals,
including environment-derived data and `contrasts.arg`/`xlev` defaults. Character formula updates
are parsed through the same normalized-AST route as formula objects.

The QR backend uses explicit Householder reflections with the observed LINPACK-compatible sign
choice. `qr.qy` and `qr.qty` apply that representation directly, while `backsolve` and
`forwardsolve` operate on the corresponding triangular systems. `matplot` retains `panel.first` and
`panel.last` as promises: the former is forced after page/window creation and before axes and
geometry, and the latter after series geometry. The graphics journal makes this lifecycle executable
without a host canvas or package-specific behavior.

## Profile 0.422 central F and matrix-extent binding semantics

`stats::pf` uses the shared independently authored beta/gamma numeric kernel for central F
probabilities. It recycles `q`, `df1`, and `df2`, preserves attributes from the longest input,
propagates `NA` and `NaN`, supports lower/upper and ordinary/logarithmic tails, and handles finite
and infinite degree limits. Supplying a non-centrality value remains a deterministic unsupported
contract rather than silently selecting the central path.

For `cbind` and `rbind`, any matrix input establishes the non-binding extent; every other matrix
must agree, while atomic vectors are recycled or truncated against that fixed extent. Without a
matrix, the longest vector establishes the extent. Empty vectors contribute no row or column when
the extent is positive, but remain represented when all inputs or the constraining matrix have zero
extent. Empty results select the common input type before dimensions and dimnames are attached.
These rules apply centrally and do not inspect package identity.

## Profile 0.423 formatting, extension, and display-width semantics

`format` and `format.default` share a central path for atomic, language, expression, pairlist, list,
closure, formula, builtin, and environment values while exposing the observed GNU formal contracts.
The evidenced numeric controls cover trimming, minimum decimals, NA encoding, and trailing-zero
removal; unexercised formatting controls are not implied by this increment.

`tools::file_ext` coerces ordinary atomic, factor, list, and pairlist inputs to portable path text,
separates both slash styles, and accepts only a final ASCII-alphanumeric suffix. Missing paths map
to an empty suffix as observed. `strtrim` coerces `width` to non-negative integers, recycles widths
over the character input, preserves missing values and existing character attributes, and truncates
at browser Unicode display-width boundaries. Combining marks have zero width and wide CJK/emoji code
points use the same deterministic width table as `nchar(type = "width")`.

## Profile 0.424 Base option-state semantics

Every evaluator session initializes a named pairlist at the locked `.Options` binding in the base
environment. The same value is visible from the base namespace. `options()` remains the mutable
interface: each accepted update or removal rebuilds both views from session-owned state while
returning the previous values with GNU-compatible visibility. Reset discards the prior option state
and reinstalls the defaults.

The initial order begins with the observed prompt, continuation, expression limit, width, deparse
cutoff, digits, echo, quiet, verbose, bounds-check, and source-retention entries. Because `.Options`
is an ordinary locked inherited binding, replacement syntax in a user environment creates a local
shadow and does not alter `getOption()` or the base binding. This behavior is generic and contains
no package-specific operator registry.

## Profile 0.425 root finding, empirical distributions, and graphics primitives

`stats::uniroot` treats `interval` as optional when both `lower` and `upper` are supplied. Endpoint
function values may be finite or infinite, while missing and `NaN` results remain errors. The
reported result and convergence path still use the shared browser-native scalar root finder.

`stats::ecdf` removes missing observations after ordinary numeric coercion, sorts unique knots, and
constructs a real closure with the observed `v` formal, `.approxfun(...)` body, call attribute,
`ecdf`/`stepfun`/`function` classes, and eight captured environment bindings. Evaluation is a
binary-search step function with zero/one boundaries, empty-input preservation, and distinct
`NA`/`NaN` propagation. Its `plot.ecdf` S3 method composes ordinary graphics operations rather than
recognizing a calling package.

`graphics::rug` maps finite values to edge ticks in the current user-coordinate window, supports all
four sides, records line color and width, respects log axes, and warns about clipping unless quiet.
`grDevices::adjustcolor` converts palette or named colors to RGBA, applies a column-major 4-by-4
transform and recycled four-channel offset, clamps channels to `[0, 1]`, and returns canonical
eight-digit hexadecimal colors. These contracts are browser-native and journal-observable.

## Profile 0.426 symbol coercion and formula-language semantics

`as.name` and its `as.symbol` alias return an input symbol unchanged. For a nonempty atomic input,
they use the first element's intrinsic scalar text: factors therefore use their underlying integer
code, missing atomic values become the symbol `NA`, and later vector elements are ignored. Empty
strings, zero-length vectors, recursive values, calls, closures, and environments fail
deterministically instead of producing synthetic names.

Language deparsing renders `/`, `^`, `:`, `%%`, and `%/%` without surrounding spaces and retains
spaces around ordinary arithmetic, comparison, logical, formula, and custom infix operators. This
rule is centralized in the owned language serializer rather than inferred from package source.

The same profile adds search-path and mode/location behavior for `utils::apropos`, language-valued
`[<-` and `[[<-` expression-vector replacement, and exported `stats::terms.formula` metadata and dot
expansion. These shared contracts are exercised directly and through unchanged package code.

## Profile 0.427 grid viewport and base-layout semantics

`grid::current.transform()` returns the current viewport's 3-by-3 homogeneous row-vector transform
as a double matrix in device inches. Nested viewport locations, justifications, rotations, native
scales, and physical or normalized units compose through a shared geometry path; `convertWidth()`
and `convertHeight()` use the current viewport extent rather than a fixed device size.

`grid::get.gpar(names = NULL)` starts from GNU-shaped grid defaults and overlays graphical
parameters from each active viewport. Ordinary fields replace their inherited value, while `cex`,
`alpha`, and `lex` multiply cumulatively. Requested names retain order and duplicates; empty
selection returns an empty named `gpar`, and invalid names fail deterministically.

`rectGrob()` constructs the documented `rect`/`grob`/`gDesc` object and `grid.rect()` records one
polygon per recycled rectangle after applying `just`, `hjust`, and `vjust`. Base graphics accepts
two-value `mfg` using the current layout dimensions, normalizes four-value `mfg`, keeps `mfrow` and
`mfcol` synchronized, and updates the current layout cell consistently.

## Profile 0.429 package-driven semantic closure

Browser-owned `datasets::BOD` and `datasets::CO2` now use the ordinary core-package data-resource
path, including the grouped-data formula, factor, label, unit, and enclosure metadata needed by
unchanged package code. `aggregate()` accepts data frames, multiple atomic grouping columns,
missing-group removal, factor-level order, and scalar or fixed-width vector callback results.

Formula values retain compound blocks and control-flow language through variable collection and
formula-to-function adapters. `matplot()` accepts all nine standard plot types and emits direct,
step, stem, and point journal geometry. `optim(method = "CG")` supplies three bounded conjugate
gradient variants, and `rep()` count controls coerce GNU-admissible atomic inputs before cardinality
validation. These are generic runtime contracts; no production branch recognizes a corpus package.

## Profile 0.430 connection and mode-filtered lookup semantics

`isOpen(con, rw)` uses the first supplied atomic element and GNU-compatible partial matching against
`read` and `write`. Unique prefixes select a capability check; unmatched strings, `NA`, the empty
string, and `rw` query only open state, while zero-length and `NULL` controls fail. This admits text
and binary-looking unmatched selectors such as `rt` without pretending that they are connection open
modes.

`get()`, `get0()`, `mget()`, and `exists()` now apply `mode` while traversing inherited
environments. A same-named value of the wrong mode no longer terminates an inherited search; the
lookup continues until it finds a matching value or exhausts the chain. `inherits = FALSE` remains
strictly local. The behavior is shared by ordinary environments and package search paths and has no
package-name branch.

`utils::combn(..., FUN=, simplify = TRUE)` retains GNU R's array shape for callback results. Scalar
callbacks produce a one-dimensional array over combinations, vector callbacks produce a
result-width-by-combination matrix, and array-valued callbacks append the combination extent to the
callback's dimensions. Callback names and dimnames do not leak into the simplified result.

## Profile 0.431 S4 replacement and ellipsis-name semantics

S4 replacement validates the assigned value against the declared slot class. A `NULL` value is
accepted for `ANY` and for a class union whose closure contains `NULL`; it is rejected for ordinary
incompatible slots with the GNU-shaped slot-class diagnostic. `slot(object, name, check = FALSE) <-`
intentionally bypasses that assignment check, while a later `validObject(object, test = TRUE)`
reports the resulting structural invalidity. Direct `@<-` and nested replacement share the same
validator hook, so package code does not receive a separate path.

For formal classes containing atomic data such as `matrix`, `new()` materializes every declared
non-data slot before initialization. Built-in vector slot classes receive their GNU empty prototype
(for example `character(0)` or `numeric(0)`), explicit class prototypes are retained, and supplied
slot values replace those defaults through the same validator. This prevents validity checking from
mistaking an unmaterialized attribute for a user-assigned `NULL`.

The primitive `...names()` reads the current closure's dots metadata without forcing any promise. It
returns `NULL` for an empty dots list, preserves empty names and duplicate names for populated dots,
and errors outside a call frame containing `...`. This behavior remains inside the ordinary
promise/call machinery and does not materialize generated JavaScript.

## Profile 0.433 inherited data-frame coercion

The `as.data.frame` generic uses the runtime's normal ordered S3 class traversal. Data-frame
subclasses therefore get an opportunity to provide methods for every leading class before the
inherited `as.data.frame.data.frame` method runs. The inherited method shallowly preserves the
column objects and all non-class attributes, replaces the class vector with `data.frame`, and
validates an explicitly supplied non-NULL `row.names` vector against the existing row count. This
keeps package-defined subclasses out of subsequent base data-frame subsetting behavior without
introducing a package identity check.

## Profile 0.434 observable Brent root finding

`stats::uniroot()` keeps the previous actual step as the Brent interpolation safeguard. When an
interpolated step is too large relative to that history it falls back to bisection, so nonlinear
callbacks receive the GNU-observed point sequence instead of a merely convergent alternative. The
reported `estim.prec` is the final bracket width. The selected root is evaluated once more to
produce `f.root`; this last callback invocation participates in ordinary closure mutation and
resource accounting and is therefore not optimized away.

## Profile 0.435 graphics, distribution, missing-data, and step-function closure

Safe NAMESPACE condition selection now accepts nested braced and unbraced branches without executing
package code. The runtime adds a shared PDF-backed Cairo device contract, honest graphics-library
reporting, GNU-shaped panel-layout selection, the `frame()` alias, central chi-square and gamma
density/quantile behavior, no-default `dummy.coef` S3 dispatch, loess control records, `na.exclude`
action metadata, and callable `stepfun` closures with exact knot continuity.

PostScript encoding, loess fitting, and multi-panel time-series plotting remain deterministic
capability boundaries. Their callable shapes are available for namespace imports, but calls fail
with an unsupported-feature condition instead of emitting another format or a fabricated fit.

## Profile 0.436 symbolic encoding and formula normalization

Symbolic numeric encoding preserves ordinary vector/array attributes while replacing class with
`noquote`. Numeric values use sorted cutpoints and right-closed intervals; correlation mode adds
zero and one, codes absolute values, and applies configurable lower-triangular masking. Endpoint,
missing-value, legend, and column-abbreviation decisions remain part of the returned value graph.

Formula update substitutes each dot with the corresponding old side, normalizes additive,
subtractive, interaction, and intercept terms through the shared formula model, rebuilds canonical
formula syntax, and retains the old lexical environment. Formula-to-list coercion exposes the same
language entries while retaining formula attributes.

## Profile 0.437 physical-record field counting

`utils::count.fields` consumes browser-owned paths and text connections through the shared
connection layer. It counts whitespace-delimited or explicitly separated records, preserves empty
fields for explicit separators, recognizes configurable quote and comment characters, applies
physical-line skipping and blank-line policy, and advances already-open connection cursors.

Quoted records may cross physical lines. Each non-final physical line receives an integer `NA`, and
the line that terminates the record receives its complete field count, including the deterministic
end-of-input treatment of an incomplete final quoted record. Empty input returns `NULL` as in the
GNU black-box contract.

## Profile 0.438 host R command-driver boundary

`tools::Rcmd` exposes the GNU `args, ...` closure shape so conforming namespaces can import it. A
call fails with a deterministic unsupported-feature condition: GNU R delegates this helper to the
host R command driver and therefore launches operating-system processes. NativR neither bundles GNU
R nor fabricates an R command driver in browser production code. Package code that only imports the
binding can load; code that calls it receives the first concrete unavailable host contract.

## Profile 0.439 function plotting through the shared curve path

`graphics::plot.function` is an exported behavioral S3 method with GNU-compatible
`x, y = 0, to = 1, from = y, xlim = NULL, ylab = NULL, ...` formals. It evaluates the supplied
closure once over the generated coordinate vector, delegates drawing and graphical controls to the
shared `curve`/`plot.default` path, and returns the invisible named `x`/`y` list.

Explicit `from` wins over the legacy positional `y`; otherwise `xlim` supplies missing endpoints
before the zero/one defaults. Integer-valued length-out sequences now preserve the observable
`seq.int` integer storage mode. Flat, integration, graphics-journal, and exact recursive GNU
black-box evidence cover the contract.

## Profile 0.440 bounded large smoothing-spline bases

Default `stats::smooth.spline` calls with more than 256 unique observations now select a
deterministic ordered knot subset within the browser matrix budget, fit the independent natural
spline there, and expand fitted values and leverage to every original coordinate. The public object
therefore retains full `x`, `y`, `yin`, `w`, and `lev` lengths and remains directly reusable by
`predict.smooth.spline`.

Explicit `all.knots = TRUE` or `nknots` requests above 256 active knots remain a concrete browser
resource boundary. Structural flat and recursive GNU black-box evidence covers a 500-observation
default fit and derivative prediction; the existing smaller exact-numeric suite remains intact.

## Profile 0.441 incomparable match values

`base::match` now exposes exact `x, table, nomatch = NA_integer_, incomparables = NULL` formals and
prevents values listed in `incomparables` from matching. The shared contract covers atomic and
recursive vectors, common character coercion, distinct missing/NaN keys, custom `nomatch`, and the
legacy scalar `FALSE` sentinel for no exclusions.

## Profile 0.442 inline plot clipping-control admission

`graphics::plot.default(..., xpd=)` accepts any GNU R-measured length-one runtime value and `NULL`,
rejects zero- and multi-length values, and leaves `par("xpd")` unchanged after the call. This closes
the high-level control-forwarding contract used by pure-R plotting packages. Expanded clipping
outside the plot region remains an explicit graphics-rendering depth gap.

## Profile 0.443 browser-owned stack-loss data projections

Static core-package data now materialize `datasets::stackloss` as a four-column double data frame,
`datasets::stack.x` as its three-column double predictor matrix, and `datasets::stack.loss` as its
double response vector. They load through the ordinary `data()` path, are exported and attached by
the standard `datasets` package lifecycle, and preserve exact matrix/frame projection identity.

## Profile 0.444 browser-owned `airquality` data

Static core-package data now materialize `datasets::airquality` as the complete 153-by-6 data frame
from a pinned PDDL-1.0 browser resource. The generic data path preserves integer storage for
`Ozone`, `Solar.R`, `Temp`, `Month`, and `Day`, double storage for `Wind`, the exact missing-value
pattern, compact row names, namespace identity, endpoints, and aggregates. No runtime branch
recognizes a consuming package.

## Profile 0.445 logarithmic graphics-axis state

Every recorded graphics window now synchronizes `usr`, `xaxp`, `yaxp`, `xlog`, and `ylog` from its
actual limits and scale. `graphics::axTicks` derives omitted logarithmic controls from that active
device state, honors explicit logarithmic `usr` and interval controls, and reuses the shared
`grDevices::axisTicks` value generator. This preserves ordinary linear behavior while making
logarithmic plot state reusable by package plotting helpers.

## Profile 0.446 linear-model dummy coefficients

`stats::dummy.coef.lm` now expands fitted coefficients over original factor levels using the shared
model-matrix assignment, level, and contrast metadata. It handles main effects, interactions,
intercept-free factor models, aliased columns, and the documented `use.na` switch without inspecting
or recognizing consuming package code.

## Profile 0.447 atomic formatting information

`base::format.info` reports the shared display width and fixed or exponential numeric mode for
atomic vectors. The reusable contract covers logical, integer, raw, character, double, and complex
storage; missing and infinite values; `digits` and `nsmall`; and session `scipen` selection.

## Profile 0.448 histogram axis-style controls

`hist.default` and `plot.histogram` now forward `xaxt` and `yaxt` through the shared graphics path.
The first character element selects standard or suppressed axes, invalid values fail with the
graphical-parameter diagnostic, inline controls do not mutate `par()`, and `plot = FALSE` with
`warn.unused = FALSE` preserves lazy unused controls.

## Profile 0.449 scientific-format penalties

Atomic numeric formatting now accepts logical force controls and finite numeric `scientific`
penalties. Numeric values are truncated to integer penalties, missing controls inherit the session
`scipen` option, and invalid length, type, and `NULL` controls fail deterministically. The shared
format-info calculation selects fixed or exponential output and a common decimal width.

## Profile 0.450 kernel regression smoothing

`stats::ksmooth` implements reusable Nadaraya-Watson regression for the documented box and normal
kernels. It sorts explicit evaluation points, generates uniform default grids, applies the GNU
quartile-scaled bandwidth and bounded normal support, returns named `x`/`y` vectors, and preserves
missing fits where no observation has positive kernel weight.

## Profile 0.451 browser-owned help PDF output

Printing a resolved `help_files_with_topic` object whose `help_type` is `"pdf"` now writes a valid,
bounded PDF into the session-owned virtual working directory. The renderer consumes the same generic
resolved help pages used by HTML output, performs no network or host-process access, emits no
browser request, and enforces `maxOutputBytes`. Core topic resolution also recognizes the documented
`stats::Normal` help page, while source-package topics continue to come from installed Rd manifests.
The same profile corrects `getElement` to perform exact structural extraction without dispatching an
S3 `[[` method, matching the GNU contract for classed lists while retaining environment, expression,
language, and S4-slot handling.

## Profile 0.452 language-object equality

`all.equal` now compares two language objects through their GNU-shaped deparsed call text rather
than requiring identical normalized AST storage. Parsed unary-negative calls therefore compare equal
to calls constructed with equivalent negative numeric constants, while `identical` remains a strict
structural test. Ordinary attributes on calls do not affect this language comparison, matching the
observed GNU `all.equal.language` contract.

## Profile 0.453 regular time-series plot routing

`stats::plot.ts` now sends an univariate regular series, or a multivariate regular series explicitly
requested with `plot.type = "single"`, through the same bounded browser graphics path as
`stats::ts.plot`. It preserves regular `tsp` coordinates, invisible `NULL`, line-style recycling,
axis and annotation controls, device state, and GNU-shaped partial selection of `plot.type`.
Multivariate `plot.type = "multiple"` layouts and two-series phase plots remain deterministic
capability boundaries rather than being flattened or fabricated.

## Profile 0.454 prediction matching and finite logarithmic graphics

Linear-model prediction accepts the unique `new=` and `newd=` partial matches for `newdata`, whether
the call enters through the generic or its S3 dispatch path. A positional new-data argument combined
with a named partial match is rejected as a duplicate, and the ambiguous one-letter `n=` remains an
error. Expanded logarithmic plot windows cap their upper coordinate and tick parameters at GNU R's
finite graphics exponent rather than converting a valid finite-data plot into an overflow failure.

## Profile 0.455 linear-model diagnostic dispatch

The `plot` S3 generic now resolves an `lm` object to exported `stats::plot.lm`. Panels 1, 2, 3, and
5 derive fitted values, residuals, standardized residuals, leverage, and scale-location coordinates
from the model and shared `lm.influence` contract, then render through ordinary browser graphics.
The residual and scale-location panels use shared `lowess` smoothing when requested; the Q-Q panel
uses shared `qqnorm` coordinates and an interquartile reference line. The method returns invisible
`NULL`. Cook's-distance panels 4 and 6, custom panels, and full point-identification/caption depth
remain deterministic capability boundaries.

## Profile 0.456 core example resources

Core packages may provide the same validated `.nativr/examples-v1.json` manifest used by installed
source packages. `utils::example()` resolves those topics by package and alias, loads the core
namespace, evaluates the selected blocks in the requested global or local environment, preserves
documented side effects, and returns the ordinary invisible example result. The initial
`graphics::arrows` topic is independently authored and exercises shared plot and arrow primitives.

## Profile 0.457 declarative Puromycin data

`datasets::Puromycin` is materialized by the ordinary validated static-package resource evaluator,
not by a dataset-specific runtime builtin. It is a 23-by-3 data frame with double `conc` and `rate`
columns, an integer-backed `state` factor whose levels are `treated` then `untreated`, and compact
row names. Namespace lookup, search-path autoloading, `data()`, reset persistence, and JavaScript
conversion therefore reuse the same mechanisms as other core and installed-package data.

## Profile 0.458 nonlinear least-squares semantics

Default-algorithm `stats::nls` binds named scalar start values into a child of the supplied data
environment, evaluates the normalized formula response and right-hand AST directly, and minimizes
the residual sum of squares with a bounded finite-difference Jacobian and damped Gauss-Newton
iteration. The fitted object exposes reusable coefficients, fitted/residual vectors, deviance,
residual degrees of freedom, formula/data/call/control state, and convergence metadata. Generic
`profile` S3 dispatch performs bounded one-parameter profile refits and returns `profile.nls`
components with `tau` and parameter matrices; its plot method uses the ordinary browser graphics
path. Non-default algorithms, bounds, model-frame controls, trace output, full summary/inference,
and exact internal `nlsModel` closure identity remain declared incomplete contracts.

## Profile 0.459 core statistical example resources

The static `stats` namespace may expose the same validated `.nativr/examples-v1.json` resource used
by installed packages and the core graphics namespace. The initial independently authored
`lm.influence` topic creates a global `lm.SR` fit through normal `lm` evaluation over
`datasets::LifeCycleSavings`, evaluates `lm.influence`, preserves the example result and visibility,
and contains no privileged runtime operation.

## Profile 0.460 multi-object static data topics

A static package's `autoloadData` entries identify resource topics rather than requiring a
same-named exported object. This preserves the generic `data/<topic>.R` contract when one topic
constructs several related bindings. Initialization evaluates the topic once into the core
namespace, after which declared exports populate namespace and search-path access exactly like
single-object resources. The `state` topic exercises seven heterogeneous objects: character and
double vectors, a named list, two factors with fixed level order, and a double matrix with complete
dimnames.

## Profile 0.461 time-series coordinates and axis controls

Two-component regular-time-series coordinates use `unit + (cycle - 1) / frequency`; the cycle may be
fractional, while the frequency and resulting window bounds retain the existing finite-value and
range validation. `plot.ts` and `ts.plot` pass `xaxt` and `yaxt` through the shared graphics path,
accept the standard `"s"` and `"n"` styles, reject unsupported styles deterministically, and do not
persist inline controls into graphics state.

## Profile 0.462 static data initialization isolation

Core static-package data topics are still evaluated through the same `data()` and package-resource
pipeline as installed package data, but each declared topic receives a fresh trusted initialization
context. Resource failures remain deterministic and bounded per topic; a large topic can no longer
consume the step allowance of unrelated later topics. Session evaluation profiles and explicit user
limits are unchanged.

## Profile 0.463 numeric POSIX conversion and forwarded missing formats

Plain integer and double inputs to `as.POSIXct()` are Unix-epoch seconds even when `origin` is
omitted. That path preserves the original numeric storage, missing mask, names, and array
attributes, then adds `POSIXct`/`POSIXt` class and the externally observable timezone attribute.
When supplied, an origin is converted to seconds from character, Date, POSIXct/POSIXlt, numeric, or
all-missing logical values and combined by ordinary vector recycling. Recycling attribute precedence
follows the longer operand (or the origin on equal lengths), and non-multiple lengths emit the
standard warning condition. Date/POSIXct axis methods treat a promise whose identifier chain
terminates in a missing formal as missing for optional `format` processing; defaulted promises
remain forceable, preserving the distinction between recursively missing and defaulted arguments.

## Profile 0.464 installed package metadata and apply simplification

An installed pure-R package description presents a derived `Built` field with four semicolon-
separated sections: target R version, architecture, deterministic UTC timestamp, and browser
platform. The timestamp is selected from pinned `Packaged`, publication, or date metadata with a
target-release fallback; installation never depends on the current clock and the source DESCRIPTION
remains unchanged. Core package descriptions use the same public shape with a browser architecture.

`sapply()` matrix simplification uses names from the first simplified result as row dimnames and
uses explicit input names, or character input values when `USE.NAMES = TRUE`, as column names.
`USE.NAMES = FALSE` suppresses character fallback while preserving explicit input names for
`sapply()`; `vapply()` follows its separate template-name and output-name rules. Empty and
non-simplifying results retain the corresponding generic naming behavior.

## Profile 0.465 callable attributes and self-start models

An installed builtin is still a first-class callable value, but may now receive a copied attribute
map at evaluator installation. This gives model callables the same observable `class`, `pnames`, and
`initial` protocol surface used by pure-R self-start closures without exposing implementation nodes.
Automatic nonlinear starts resolve the model call from the formula, invoke its initializer through
the normal argument matcher, and require a named finite numeric result. Explicit `start` values
continue to take precedence.

`predict.nls()` retains the fitted model environment internally and overlays `newdata` bindings for
formula evaluation. The supported result is the numeric fitted/predicted value vector. GNU R's
gradient attribute, `se.fit`, confidence/prediction intervals, covariance calculations, and the
broader self-start model catalog remain explicit gaps.

## Profile 0.466 atomic ftable permutation

When `ftable()` receives a dimensioned atomic vector, row/column variable selection defines a
bijective permutation of the existing cells. The runtime allocates an output of the same atomic
storage type and permutes values, complex components, missing masks, and character encoding/byte
metadata together. It does not interpret those cells as counts, truncate doubles, or discard missing
values. Observation-vector and data-frame inputs continue to construct integer frequency counts
through the separate categorical path.

The resulting attribute insertion order is `dim`, `class`, `row.vars`, then `col.vars`, matching the
observable GNU structure. `ftable` is a public `stats` binding; `format.ftable` is its registered
stats S3 method.

## Profile 0.467 interaction cell callbacks and graphics

`interaction.plot()` derives ordered levels from factor metadata (or the ordinary atomic-level
ordering), omits rows with missing factor coordinates, and visits cells with the first factor
varying fastest inside each trace-factor level. Nonempty response subsets are passed to the supplied
callable through the normal invocation path; empty cells remain missing and scalar numeric results
form the plot matrix. This preserves lazy closure behavior and nonlocal callback side effects.

The renderer opens or uses the current browser device through `plot.default`, adds trace geometry
through `lines`, and composes axes, box, annotations, and legend from existing graphics primitives.
The return value is invisible `NULL`. This profile does not claim pixel-identical text placement or
all edge behavior of `fixed`, `xtick`, complex default-formal expressions, and uncommon legend
controls.

## Profile 0.468 call and expression indexing

A language call exposes its callee and arguments as a tagged list for subsetting. `[[` returns one
quoted entry with exact or partial name matching as requested; `[` selects entries and rebuilds the
resulting call, including unusual but GNU-valid calls whose selected first entry is not the original
callee. A selected all-empty tag vector becomes absent rather than an observable vector of empty
strings.

Expression-vector indexing uses the same positional/name resolver while keeping expression storage.
Named expression entries are unwrapped before element extraction, so `expression(a = 1 + 2)[[1]]`
returns the call `1 + 2`; slices reconstruct an expression vector and retain its `names` attribute.
Evaluator syntax and first-class primitive calls share this behavior.

## Profile 0.469 matplot annotation forwarding

`matplot()` passes `xlab` and `ylab` directly into the same annotation normalization used by
`title()`. Atomic vectors are coerced to text, expression entries remain deparsed symbolic labels,
missing entries become blank lines, and empty vectors produce no text event. Annotation validation
occurs only when annotations are rendered, so `ann = FALSE` retains lazy graphics behavior. Scalar
and vector labels use one implementation and the return value remains invisible `NULL`.

## Profile 0.470 formatted matrix and array shape

Atomic formatting computes text cell-by-cell, then reapplies `dim` and `dimnames` when the input is
an array. Matrix and higher-dimensional class observations therefore arise from dimensions exactly
as in GNU R, without copying explicit class or unrelated attributes. A non-array input follows the
separate names-only path. Formatted arrays remain eligible for ordinary rectangular `[` operations.

## Profile 0.471 formals caller and environment defaults

Omitted `formals(fun=)` selects the active ordinary closure and returns its pairlist of formal
defaults, including missing-symbol entries. Character `fun` values search the explicit `envir` and
its parents for the first callable binding. The public reflection object exposes the GNU-shaped
`fun = sys.function(sys.parent())` and `envir = parent.frame()` defaults. This profile does not add
a new claim for top-level or `local()` dynamic-frame equivalence.

## Profile 0.472 PostScript graphics journal encoding

The owned graphics-device registry now includes a `postscript` file device. Page transitions move
the current bounded display list into a one-file page array or encode it immediately to a numbered
target; close flushes held commands, finalizes the last page, writes the virtual file, removes the
device, and restores the remaining device's parameter map. The renderer maps every current owned
graphics event to PostScript Level 2 path, text, clipping, or `colorimage` commands and emits DSC
headers, page records, trailer, bounding box, and base Type 1 font resources.

PostScript cannot represent an alpha channel. Fully transparent marks are omitted and opaque marks
are encoded normally; semi-transparent vectors and semi-transparent rasters over a transparent page
fail with an explicit unsupported-feature condition. A semi-transparent raster may be composited
against an opaque declared page background. Output is checkpointed and must fit `maxOutputBytes`.
The device never invokes `command`, and `print.it = TRUE` requires a separately authorized host
contract rather than ambient process access.

## Profile 0.473 deterministic native `readLines` decoding

The virtual text decoder recognizes GNU R's `native`, `native.enc`, and `nativeenc` labels as the
runtime's deterministic browser-native UTF-8 encoding. Decoding remains bounded and operates only on
bytes already admitted to owned files or connections. Returned strings use `unknown` marks for
native/unknown input, `UTF-8` for an explicit UTF-8 request, `latin1` for Latin-1, and `bytes` for
byte-preserving input; ASCII elements remain unmarked as in the shared character representation.

## Profile 0.474 `stopifnot` assertion streams

A named `exprs` block is decomposed into normalized AST entries without first forcing the block's
final value. Entries execute sequentially in the promise environment for `local = TRUE`; an isolated
child environment is used for `local = FALSE`. An `exprObject` value supplies expression nodes or a
language node to the same loop. Every result uses the ordinary all-TRUE rule, and evaluation ends at
the first failure with the deparsed failing node in the diagnostic.

## Profile 0.475 tools error capture

`tools::assertError` preserves its input as a lazy promise until the helper enters its catch
boundary. A matching caught condition is converted through the shared condition-value path and
returned inside an invisible list. `classes` matches the condition class vector; `verbose` writes
one bounded message event. Successful evaluation raises the documented assertion failure.

## Profile 0.476 package-version metadata lists

The ordinary character paths for `numeric_version()`, `package_version()`, and `R_system_version()`
remain unchanged. In addition, `package_version()` recognizes a named list containing both `major`
and `minor`, converts those two public metadata fields to their printed pieces, joins them with a
period, and validates the result as exactly three nonnegative integer components. Success produces
the system/package/numeric version class hierarchy; unrelated fields are ignored. A list missing
either required name is still a non-character version specification.

## Profile 0.477 browser-owned compiler report

`R_compiled_by()` is a locked, zero-argument base closure returning two nonempty character values
named `C` and `Fortran`. The names and shape follow GNU R; the platform-adapted values describe the
actual NativR TypeScript and WebAssembly numerical paths. No host compiler discovery is attempted.

## Profiles 0.478–0.480 external and numerical backend metadata

`extSoftVersion()` returns the fixed names `zlib`, `bzlib`, `xz`, `libdeflate`, `zstd`, `PCRE`,
`ICU`, `TRE`, `iconv`, `readline`, and `BLAS`. The `bzlib` value identifies bundled bzip2 1.0.8;
other values are empty because NativR either lacks that facility or uses an owned/browser-standard
path without a stable external-library version. `La_version()` returns `3.12.1` and `La_library()`
returns an empty string for the internal bundled LAPACK backend. `pcre_config()` returns named
logical values for UTF-8, Unicode properties, JIT, and stack as `TRUE`, `TRUE`, `FALSE`, `FALSE`.
All four functions have zero formals and locked base bindings.

## Profile 0.487 non-central probability and formula-point semantics

`stats::pchisq` and `stats::pf` evaluate finite non-negative non-centrality through centered Poisson
mixtures of the owned regularized-gamma and regularized-beta kernels. `pt` evaluates the requested
normal tail directly over the independent chi-square scale and switches to the limiting normal law
for sufficiently large finite degrees of freedom, preserving monotonicity for root finders that
probe extreme sample-size bounds. These paths retain recycling, missingness, longest-input
attributes, tail/log controls, boundaries, warnings, and cooperative checkpoints. Non-central
density and quantile surfaces remain explicit gaps.

`graphics::points.formula` uses ordinary S3 dispatch, builds response and predictor columns through
`stats::model.frame`, forwards graphical arguments to `points`, and returns invisibly. Explicit
`subset=` remains a declared wider formula-graphics gap.

## Profile 0.489 matrix binding, grid labels, and package-test work budget

Data-frame column binding now treats two-dimensional atomic and list values as matrices rather than
ordinary flat vectors. Columns are extracted in column-major order, row extents recycle only when
divisible, multi-column names follow explicit-argument and matrix-dimname rules, and automatic row
names remain automatic unless valid matrix row names replace them. List-matrix columns retain their
per-row names and recursive values.

Grid text grobs retain expression vectors, language calls, and symbols as graphics annotations;
logical, integer, double, and raw labels are converted to character with missingness preserved.
Drawing and extent estimation use a stable source-form representation. This admits browser-safe
plotmath-labelled grobs but does not yet implement GNU grid's complete mathematical glyph layout.

The opt-in `package-test` cumulative allocation-work ceiling is 750,000,000 elements. The
four-million-element single-vector ceiling, output/resource limits, and default interactive-safe
profile are unchanged. The increase is executable evidence for an unchanged Rd example that serially
generates several 3000-by-3000 TIFFs; it is a shared finite workload profile, not a package-specific
bypass or a peak-live-memory claim.

`stopifnot` now derives failed-expression text from source-valid precedence-aware deparse for
ordinary arguments, `exprs` blocks, and expression objects. This removes diagnostic-only outer
parentheses around binary predicates while retaining short-circuit evaluation and the original
failed expression.

## Profile 0.490 converter objects, namespace values, and static renderers

Core namespaces can now install immutable non-callable bindings alongside builtin functions.
`grDevices::colorspaces` uses that path, so list structure and callable converter members preserve
ordinary R value semantics without treating a data object as a function. `colorConverter` creates
closures-as-builtin wrappers that either apply the supplied converter row by row or forward the
whole matrix when `vectorized = TRUE`; `convertColor` routes custom endpoints through the shared XYZ
bridge. `rgb2hsv` preserves matrix column names and accepts separately recycled channels.

Structural construction treats `dim = NULL` as removal of both dimension attributes and applies
atomic coercion plus missing padding to short `names=` values. Browser-owned device serializers stay
inside the static Worker graph, with shared vector geometry and serialization utilities reducing
duplication. Opening or writing a device therefore does not fetch a renderer module; the observable
device lifecycle and resource checks are unchanged.

## Profile 0.495 missing-row restoration, slot names, and GLM covariance

`stats::naresid` is a package-neutral S3 generic with GNU-shaped `omit`, `x`, and `...` formals.
Default and class-`omit` calls return `x`; class-`exclude` actions insert missing rows at recorded
one-based positions and restore action names across vectors and arrays. The implementation shares
the row-reconstruction primitive used by `napredict` rather than duplicating model-specific logic.

`methods::slotNames` and `.slotNames` resolve registered formal class metadata from S4 objects,
classed objects, class-name strings, and classRepresentation values. Own slots precede inherited
slots, duplicates are removed by first declaration, and vector-data formal classes expose `.Data`
before ordinary slots. Plain values return `NULL`; an unknown explicit class name returns
`character()`.

The `vcov.glm` method derives unscaled covariance from the fitted weighted QR factor and applies
fixed, Pearson-estimated, or explicitly supplied dispersion. Aliased coefficients remain missing in
the complete matrix and are removed from both axes when `complete = FALSE`. The generic still runs
ordinary S3 dispatch first, while direct `stats:::vcov.glm` calls use method formals without
redispatching.

## Profile 0.496 direct GLM fitting and symbolic differentiation

`stats::glm.fit` now exposes GNU-shaped formals and runs the shared deterministic IRLS engine on
numeric design matrices, responses, weights, offsets, starts, family objects, controls, intercept
metadata, and singular-fit policy. It returns the ordinary unclassed fit list, including QR and R
components, working and prior weights, deviances, degrees of freedom, convergence, and boundary
state. This is a reusable lower-level fitting seam used directly by pure-R packages; it does not
claim every matrix-response or exotic family initialization contract.

`stats::D` differentiates normalized expression, call, and symbol language objects without generated
JavaScript. The admitted addition, subtraction, multiplication, unary-sign, parenthesized grouping,
and constant numeric-power forms produce recursively differentiable, evaluable R language or scalar
results. Other calls, division, and symbolic exponents fail at the explicit derivative-table
boundary. Symbolic `deriv.default`, user-extensible derivative tables, and every GNU derivative
simplification remain separate work.

## Profile 0.497 L'Ecuyer-CMRG streams

The evaluator-owned RNG now implements the published two-component MRG32k3a recurrence behind
`"L'Ecuyer-CMRG"`. `set.seed` produces the GNU-shaped kind code plus six signed state words,
ordinary draws update `.Random.seed`, and restoring that vector resumes the exact stream. Modular
arithmetic stays within deterministic integer-safe operations and does not use host randomness.

`parallel::nextRNGStream(seed)` and `parallel::nextRNGSubStream(seed)` validate an integer CMRG seed
and apply the published 2^127 and 2^76 jump matrices without mutating the evaluator's active stream.
Their result state, formals, invalid-seed diagnostic, fixed-seed uniform values, and recursive shape
are pinned against GNU R black-box observations. This does not claim the remaining unsupported RNG
kinds or browser-host parallel execution.

## Profile 0.498 browser cluster state and public L-BFGS-B optimization

Core `parallel` now provides `clusterEvalQ`, `clusterExport`, `getDefaultCluster`, and
`setDefaultCluster` with GNU-shaped formals and visibility. Each browser cluster owns persistent
evaluator environments; exports, quoted evaluation, cluster calls, and `parLapply` distribution use
those environments without host processes, network access, or ambient workers. This is a
deterministic browser-admissible adaptation, not a claim of CPU-parallel execution.

`stats::optim(method = "L-BFGS-B")` now uses the audited L-BFGS-B 2.1 Wasm backend through the typed
box-optimization interface. Bounds, scaling, analytic or numerical gradients, method controls,
counts, convergence codes, and messages have executable GNU black-box evidence. Remaining methods
and exhaustive floating-point trajectory identity stay explicit gaps.

## Profile 0.499 `as.vector` S3 conversion semantics

`base::as.vector` now performs ordinary S3 method selection before its internal coercion fallback.
The generic forwards its default `mode = "any"` promise into method calls so reflective
`match.call()` observes the same argument shape as GNU R. Base `as.vector.factor` and
`as.vector.data.frame` methods take precedence over a caller-defined `as.vector.default`, while
class-specific methods can convert attributed environments and other non-vector objects.

Flat, integration, and exact recursive black-box evidence covers class-chain selection, explicit and
default modes, reflective calls, custom defaults, factor conversion, data-frame conversion, and
public formals. This closes the reusable conversion seam selected by unchanged `tictoc`; it does not
claim complete behavior for every internal or package-defined coercion method.

## Profile 0.500 discrete-sampling RNG state

Default `sample.kind = "Rejection"` now advances the selected uniform engine for every realized
draw, including the final draw from a one-element population. A full permutation therefore consumes
the same observable RNG state as GNU R even though its last result is predetermined. This preserves
subsequent `runif`, repeated `sample`, and package-level randomized algorithm trajectories.

Flat, integration, and exact recursive black-box evidence pins singleton sampling, repeated
two-element permutations, following uniform values, and RNG-kind metadata. This increment does not
claim unsupported RNG engines.

## Profile 0.501 owned local vector growth and replacement

Atomic replacement remains copy-on-modify by default. A numeric vector produced by replacement in an
active closure frame may reuse its backing storage only while the evaluator retains an exact binding
owner. Same-length writes update that owned storage, and extension uses finite geometric capacity
bounded by `maxVectorLength`; newly allocated capacity is charged to `maxAllocatedElements`.
Assignment to another binding, forced-promise exposure, active bindings, nonlocal storage,
attributes, names, S4 state, coercion, and unsupported storage all use the ordinary copying path.

Flat, integration, and exact recursive GNU R evidence covers vector growth, missing initialization,
direct aliases, promise aliases, visible length, and values. This removes quadratic allocation from
ordinary package loops without changing observable copy-on-modify semantics.

## Profile 0.502 list-backed lookup environments

`as.environment(list)` creates a temporary environment whose parent is `emptyenv()`. The same
conversion is used when lookup APIs such as positional `exists(name, where)` and `ls(pos)` accept a
named list, so `inherits = TRUE` cannot escape the supplied list into a caller or package namespace.
Lookup still respects local binding type/mode selection.

This does not change evaluation data masks. `eval`, `evalq`, `with`, and related paths continue to
create list-backed evaluation environments with the documented caller or explicit enclosure. Flat,
integration, exact recursive GNU R, and unchanged-package evidence cover this separation.

## Profile 0.503 bounded optimization contracts

`stats::nlminb(start, objective, gradient, hessian, ..., scale, control, lower, upper)` is available
with GNU-shaped formals and result fields. The browser-admissible implementation maps bounds,
parameter scaling, iteration limits, relative tolerance, and zero-trace operation to the audited
L-BFGS-B backend. It preserves named parameters and returns named function/gradient evaluations.
This is an evidenced numerical subset, not a claim of native PORT iteration or message identity.

`optim` validates `REPORT` and method-specific control fields even when the selected method does not
consume them. A finite initial objective remains mandatory, while non-finite intermediate
line-search trials may be rejected by step reduction rather than aborting the call.

## Profile 0.504 function-body reflection

`methods::functionBody` shares the runtime's normalized closure-body representation with `body()`.

## Profile 0.505 regular-expression identities and row binding

GNU TRE- and PCRE-compatible patterns may identity-escape ordinary punctuation inside a bracket
expression even when ECMAScript Unicode-mode regular expressions reject the same spelling. The
browser normalizer removes only those invalid punctuation backslashes. It preserves semantic escapes
such as `\d`, `\s`, `\w`, and `\b`, hexadecimal and Unicode escapes, doubled backslashes, and
escaped bracket syntax such as `\-`, `\]`, and `\^`.

`rbind.data.frame` is a directly callable Base method with formals `...`, `deparse.level`,
`make.row.names`, `stringsAsFactors`, and `factor.exclude`. It shares the generic row-binding
engine, matches trailing controls after dots, preserves factor columns and explicit row names,
repairs duplicate row names, emits automatic names when requested, and returns a zero-row,
zero-column data frame for an empty call. It has GNU formals `fun = sys.function(sys.parent())`,
returns a quoted language/scalar body for a closure, returns `NULL` for primitives, and uses the
active caller when `fun` is omitted. It does not expose parser or Tree-sitter nodes.

## Profile 0.506 runtime-value calls and standard link objects

`call()` may embed arbitrary recursive runtime values, including lists containing closures and
environments. The normalized language node retains the exact value graph and identity for later
evaluation; its syntax projection exists only for display and never reconstructs or serializes the
runtime value.

`stats::make.link` returns a five-component `link-glm` object for `logit`, `probit`, `cauchit`,
`cloglog`, `identity`, `log`, `sqrt`, `1/mu^2`, and `inverse`. Each component is an ordinary R
closure with the GNU-visible formal, and probability-link inverses and derivatives apply the
machine-epsilon stability boundary. `valideta` follows the selected link rather than a single
finite-only predicate. Standard family constructors use the same shared components.

## Profile 0.507 source-aware parse and bind dispatch

Normalized parse data synthesizes only explicit semicolons found in source gaps not owned by a
Tree-sitter child. String and comment spans remain opaque, each synthesized token keeps its exact
UTF-16 span, and the direct enclosing syntax node owns its parent identifier. This lets
source-transforming R code observe the same terminal separator ordering without exposing parser
internals.

Width-sensitive source deparse expands a custom infix call when either operand is a block and joins
the operator to the opening brace. For `rbind`/`cbind`, `NULL` values do not change the dispatch
argument index, and the S3 method receives every original promise. Consequently,
`rbind.data.frame(NULL, frame)` accepts the leading `NULL`, while `cbind.data.frame(NULL, frame)`
counts it as zero rows and reports a differing-row-count error for a positive-row frame.

## Profile 0.508 S4 signature forcing and POSIXct combination

S4 generic metadata records the dispatch signature separately from the complete formal list.
Selection forces only signature promises and maps positional method signatures in the declared
signature order; the method receives the original lazy call, including forwarded missing and
non-signature arguments. Literal `...` passed to special `rep()` is expanded as the original promise
sequence so matching and S3 dispatch do not prematurely evaluate it.

`c.POSIXct` strips input classes for atomic combination, then reapplies POSIXct/POSIXt only when the
first argument is POSIXct. Names follow ordinary `c()` rules. The result retains `tzone` only when
all non-NULL inputs are POSIXct values carrying the same one-element, non-missing time-zone tag.

## Profile 0.521 Pearson chi-square tests

The stats namespace exposes `chisq.test` with lazy argument matching and exact public formals.
Goodness-of-fit execution preserves vector names; contingency execution preserves dimensions,
dimnames, table class where GNU does, and source-expression labels for paired inputs. Zero marginal
rows and columns are removed before fitting, Yates adjustment is bounded per cell, and the shared
gamma probability kernel supplies the upper tail. Expected values below five signal the standard
warning through the ordinary condition system.

## Profile 0.522 simulated Pearson chi-square tests

For integer goodness-of-fit totals, simulated tests draw weighted categories from the evaluator's
owned random stream and construct one count vector per replicate. For contingency tables with
positive integer margins, a browser-native AS 159 sampler fills each non-terminal cell by
mode-centred conditional-probability inversion and derives the terminal row and column from the
remaining margins. Log-factorials are allocated within the runtime resource budget, long setup and
replicate loops retain cancellation checkpoints, and `.Random.seed` is published once around the
bulk operation without changing its observable final state.

The Monte Carlo result counts statistics at least as extreme as the observed Pearson statistic, uses
the finite-sample `(extreme + 1) / (B + 1)` correction, returns a missing `df`, and records the
requested replicate value in the method. Non-integral totals or margins are rejected explicitly;
legacy non-integral coercion behavior is not yet admitted.

## Profile 0.523 formula holes, matched model calls, and offsets

The normalized AST represents a missing call or subset argument explicitly. Formula label
construction renders that node as an empty field while variable collection treats it as no variable,
preserving `f(x, )`, `f(, x)`, `x[, 1]`, and `x[1, ]` without exposing parser nodes.

Fitted GLMs now store the call produced by formal argument matching. Formula `offset(...)` terms
remain model-frame variables but are also accumulated into the numeric fit offset; an explicit
offset is additive, and filtering occurs against the same selected rows as the response and design.

## Profile 0.524 multinomial and Summary runtime semantics

`rmultinom()` normalizes a finite non-negative probability vector, then fills each matrix column by
sequential conditional binomial allocation, preserving row names from `prob` and exact column sums.
Zero-mass, negative, missing, and non-finite inputs fail deterministically. The non-degenerate draw
engine currently uses the browser-owned Bernoulli path, so GNU binomial random-stream identity is an
explicit open contract.

`mean.default` is directly addressable with GNU-shaped formals. Scalar Summary extrema ignore `NULL`
arguments, including conditional expressions whose false branch returns `NULL`.

## Profile 0.525 derivative and captured-warning semantics

The derivative engine constructs normalized AST rather than generated JavaScript. `deriv.default`
evaluates the primal expression once, evaluates symbolic partials in the same environment, and
attaches GNU-shaped gradient and optional Hessian arrays. Character `function.arg` values and
closure templates produce closures; expression input produces an expression result.

Warning capture is stack-scoped in the operator context. `tools::assertWarning` forces its lazy
expression inside that scope, returns matching conditions invisibly, and distinguishes no-warning,
wrong-class, and error outcomes. Warnings created through `warning()` retain their original
condition; lower-level numeric warnings receive a simple condition with their observable classes and
message. `.Deprecated` uses this same reusable condition path.
