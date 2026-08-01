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
`do.call()` constructs a call from an ordinary list without converting source into JavaScript;
`quote = TRUE` and pairlist argument containers remain outside this increment. `delayedAssign()`
installs a memoizing promise with distinct evaluation and assignment environments. Calls that
evaluate multiple arguments do so from left to right rather than forcing them concurrently.
`withVisible()` evaluates its one lazy argument exactly once and returns a named `value`/`visible`
list. First forcing propagates assignment, `invisible()`, closure, block, ellipsis, and dynamic
evaluation visibility; reading a promise that was already forced is visible, matching GNU R's
promise boundary.

`strftime()` converts numeric, Date, POSIXct, POSIXlt, and custom S3 inputs through owned
`as.POSIXlt` dispatch, recycles `x` and `format`, and emits deterministic UTC/GMT C-locale text. The
supported token subset includes calendar, clock, weekday/month, week number, epoch, timezone, and
fractional-second forms; named time zones and host locale databases remain explicit boundaries.

Arithmetic, comparison, and logical operations are vectorized. Shorter operands recycle, with one
`NRW1001` warning when lengths are not multiples. NA propagates through arithmetic; ordinary NaN
stays NaN. Comparisons produce unknown for NA/NaN. `!`, `&`, and `|` use three-valued logic; `&&`
and `||` are scalar and short-circuit. Complex values support arithmetic, equality, logical
coercion, core component helpers, indexing/replacement, and Worker transport; the full GNU R complex
mathematics surface is not yet implemented.

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
that empty target. Expression vectors and arbitrary class-specific `[<-` methods remain outside the
owned path.

`typeof`, `mode`, and the core `is.*` predicates inspect NativR storage without exposing parser
nodes. `as.logical`, `as.integer`, `as.double`/`as.numeric`, and `as.character` cover NULL and
atomic vectors, including factors, complex imaginary-discard warnings, integer-range warnings, and
NA-versus-NaN handling. Coercions drop attributes as GNU R does. Locale- and option-dependent
number-to-character formatting and general list/method coercion remain incomplete.

`logical`, `integer`, `double`/`numeric`, `character`, and `vector` allocate zero-filled vectors
through the same resource-accounted storage model. `vector("expression", n)` allocates NULL-filled
owned expression vectors. `length` covers vectors, NULL, formulas, functions, and environments;
`lengths` vectorizes that operation over lists and expression vectors. Matrix, array, data-frame,
factor, and recursive-value predicates inspect owned dimensions/classes rather than host JavaScript
shapes.

Quoted identifiers are owned symbol values and quoted compound syntax stores only the normalized
NativR AST. `quote()` observes an argument promise without forcing it; `eval()` sends symbol lookup
or language/expression interpretation back through the ordinary evaluator and its resource limits.
`expression()` captures syntax without forcing it; `as.name`/`as.symbol`, `as.expression`, `call`,
`as.call`, `deparse`, and `deparse1` provide bounded construction and inspection. `substitute()`
walks owned syntax without forcing source promises, replaces bindings from the current closure frame
or a named list/data frame, and expands ellipsis arguments. An explicitly supplied global
environment retains GNU R's special non-substitution behavior. No source is converted into or
executed as JavaScript. Worker results deparse language and expression values into stable diagnostic
strings rather than exposing parser nodes. `parse(text=)` joins atomic input elements with newlines,
returns an owned expression vector, honors `n`, and can stop before a later syntax error once the
requested number of complete top-level expressions has been collected. `n = 0` does not inspect the
input. Parser-backed JavaScript symbol/language/expression records round-trip through `assign` and
`call`. File/connection input and `keep.source = TRUE` source-reference attributes are not
implemented. `match.call()` uses the active closure's already-computed argument matching to
canonicalize supplied names, omit unused defaults, and optionally retain dots as a pairlist-shaped
call. Root, child, parent, current-frame, and closure environments are available for lexical
evaluation. Environment `$` and character `[[` read or replace bindings; `get`, `get0`, `exists`,
and `assign` support explicit environments and inherited lookup, while `list2env`, `as.environment`,
`environmentName`, and `as.list.environment` cover initial conversion and identity operations.
Environment-to-list conversion enumerates only local bindings, optionally includes dot-prefixed
names, sorts before forcing when requested, and preserves the runtime's hash-aware unsorted order.
The `as.list` entry point performs S3 dispatch. As in GNU R, `exists(mode = "any")` detects an
unforced delayed binding without forcing it and an explicitly supplied `get0(ifnotfound=)` value is
evaluated even when the requested object exists. Locked and active bindings, the attached search
path, namespace mutation, arbitrary numeric search positions, and exact GNU R hash-bucket
enumeration order are not implemented. Evaluator-native syntax does not yet reproduce GNU R's
primitive-binding lookup failures when an evaluated expression's environment chain ends directly at
`emptyenv()`. Pairlists are distinct runtime values with exact tags; `pairlist`, `as.pairlist`,
`is.pairlist`, `as.list`, `vector("pairlist", n)`, `length`, type/mode inspection, `alist`, and
Worker transport use that value model. Pairlist `[`, `[[`, and `$` extraction follows the measured
GNU R list-return and unique-partial-name behavior. `[[<-` and `$<-` preserve pairlist type, `[<-`
converts to an ordinary list, and names, arbitrary runtime attributes, classes, dimensions,
dimension names, and implicit matrix/array classes are retained or dropped along the measured GNU R
paths. GNU R's `lengths()`, `is.matrix()`, and `is.array()` rejection/false results for pairlists
are preserved. This increment does not yet provide `bquote`, pairlist rectangular replacement or
every extension edge case, generic pairlist attributes across the public snapshot, inherited
substitution lookup, alternate `match.call` definitions/calls/environments, full language
indexing/attributes, list/data-frame evaluation environments, source-reference preservation, or
file/connection-driven parsing.

Identifier and direct replacement assignment accept `<-`, `=`, `->`, `<<-`, and `->>`. Non-local
assignment searches lexical parents and falls back to the global environment without mutating locked
built-in bindings.

Simple one-dimensional `$`, `[`, and `[[` replacement chains rebuild each containing value back to
an identifier root. They support local and non-local rebinding, data-frame column mutation, NULL
deletion, and `$`-driven creation of a missing list intermediate. Intermediate subscript expressions
are evaluated again while rebuilding the chain, matching GNU R's observable side effects. An
intermediate multidimensional selection remains unsupported.

Direct replacement-function targets invoke a registered `<-` function and rebind their first
identifier. `names<-`, `attr<-`, `class<-`, and `dim<-` cover exact non-missing names, arbitrary
owned vector attributes, explicit classes, and validated dimensions in both assignment directions.
Nested replacement-function targets and short-name padding for `names<-` remain incomplete.

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

`as.array()` is an S3 generic with an independently registered `as.array.default`. Package-defined
methods receive the classed object plus unforced dots, which covers rstan's measured
`as.array(fit, ...)` extension shape without implementing Stan objects in the runtime. The default
returns existing arrays unchanged; otherwise it adds a one-dimensional extent to atomic vectors,
lists, factors, or pairlists, promotes vector names to a one-axis `dimnames` component, and retains
other attributes. Expression-vector coercion remains outside this bounded increment.

Data frames are classed named lists with automatic row names and equal-length atomic columns after
documented recycling. They support rectangular and coordinate-matrix selection/replacement plus
column extraction. `tibble` and formula-header `tribble` construct stricter frame shapes without
importing external packages.

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
Complete axis ticks/labels, expression-derived labels, logarithmic or fixed-aspect windows,
specialized core plot methods, margins/clipping, and device-identical layout remain explicit
boundaries. `graphics::box()` resolves plot-region `bty` edge shapes, `col`/`fg` precedence, line
type, and positive width into one bounded frame command. It returns invisible `NULL`; figure, inner,
and outer regions are rejected until the owned device has a margin/layout model.
`graphics::boxplot()` is an S3 generic whose owned default accepts numeric vectors, lists of numeric
groups, and numeric matrix columns. It omits missing observations, computes Tukey hinges, whiskers,
notches, sample counts and outliers, and returns the six-field
`stats`/`n`/`conf`/`out`/`group`/`names` result invisibly whether or not drawing is enabled. Drawing
resolves positions, widths, fill/border colors, line types, and line widths into a bounded group
event; horizontal/notched boxes, `outline`, `varwidth`, `at`, and `add` use the same owned device.
Formula/data-frame methods, logarithmic axes, arbitrary `pars`, axis annotation, and
device-identical layout remain unsupported. `graphics::segments()` consumes real/logical endpoint
vectors, defaults an omitted `x1` or `y1` to its corresponding start coordinate, and recycles
coordinates, colors, line types, and line widths without a recycling warning. Missing/non-finite
coordinates and missing/transparent/invalid-width drawing entries are omitted. Valid colors are
resolved to `#RRGGBBAA`, and documented line-type names, numeric cycles, and custom hexadecimal
patterns are normalized before transport. `graphics::points()` dispatches classed first arguments
before accessing the owned device. Its default accepts paired real vectors, two-column matrices,
one-/two-column data frames, complex coordinates, and named `list(x, y)` containers, with an
implicit sequence paired to a single ordinary vector. Separate x/y vectors must have equal lengths.
It resolves numeric plotting-symbol codes 0:25, printable ASCII and negative-Unicode codes, literal
one-character symbols, colors, fills, sizes, and widths into a bounded point event;
missing/non-finite coordinates and non-drawing style entries are omitted. `type = "p"` draws,
`type = "n"` validates without emission, and both return invisible `NULL`. Line/path types,
locale-dependent codes, character coordinate coercion, broader coordinate classes, clipping/log
axes, and device-identical font metrics remain unsupported.

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
column-major series. Point, line, both, overplotted, and no-draw types plus colors, symbols, fills,
sizes, line types, and widths cycle by series. Incomplete pairs omit points and split line runs.
Logarithmic x/y values are converted to finite base-10 device coordinates before window and command
emission. A call begins a page, computes padded limits, writes a window and optional box, then emits
the same bounded segment and point events used elsewhere, so Worker transport and same-session
record/replay need no additional protocol. Complete axes/labels, class-preserving `plot`/`lines`
dispatch, additions to existing plots, remaining plot types, and exact graphics layout remain
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

`writeLines(text, path)` truncates a session text file and writes the selected separator after every
character element; missing strings render as `NA`. With no connection argument it emits the same
bounded stdout events as other textual output. `readLines(path)` recognizes LF, CRLF, and CR,
supports bounded `n`, `ok`, incomplete-final-line and embedded-NUL warnings, and `skipNul`. It reads
either session text or immutable package files resolved through `system.file()`. Session-owned
`file()` connections provide operation-scoped or persistent cursor access; host paths and other
connection classes are rejected before any host API can be reached.

The same map owns a bounded directory tree and current working directory. `R.home()` identifies a
static `nativr://runtime` shape; `tempdir()` identifies the mutable session root; and package roots
come only from supplied bundles. `dir.create()` and recursive `unlink()` mutate session directories,
while `dir.exists()`, `list.files()`/`dir()`, `list.dirs()`, `getwd()`/`setwd()`, `normalizePath()`,
`basename()`, and `dirname()` operate across owned roots. Relative paths resolve against the current
owned directory, including a read-only package directory. Dot segments are normalized without
allowing traversal above their root. Absolute host paths, links, permissions, mounts, and host
working-directory state are never consulted.

`utils::read.table` and its CSV/delimited variants consume that same text layer or inline `text=`.
The owned bounded scanner recognizes LF/CRLF/CR records, explicit or whitespace separators, quoted
fields, doubled quotes, embedded quoted newlines, comments, skipped/blank lines, filling, headers,
row/column names, missing strings, and syntactic name repair. Columns pass through the same
deterministic `utils::type.convert` ladder used by package code. `write.table` and its CSV variants
serialize owned atomic matrices, lists, and data frames with explicit row/header conventions,
missing markers, decimal separators, and escape/double quote modes. Files remain evaluator memory;
compressed streams, host paths, URLs, arbitrary encodings, `colClasses`, and the complete GNU R
scanner are outside this slice.

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
external packages can construct wrapper closures from package-owned source: nested replacement
rebuilds call roots through `formals<-`, closure enclosures can be replaced through `environment<-`,
mixed language/list `c()` inputs feed `as.call()`, and `bquote()` substitutes `.()` expressions
against explicit environments or list-backed masks. Dynamic `parent.frame()` uses the actual
call-site environment, while `packageEvent()` plus `setHook()`/`getHook()` provide a session
registry. These semantics are executable through the pinned `withr 3.0.3` `with_options()` proof
rather than inferred from successful parsing. `gctorture2()` exposes only its documented
argument/formal and previous-state API for wrapper construction; it does not and cannot force a
browser JavaScript engine's garbage collector. DESCRIPTION, NAMESPACE, retained `R/*.R` text, and
base64 package resources share one immutable package-file lookup seam. UTF-8 uses the
browser-standard fatal decoder, Latin-1 uses deterministic byte mapping, and both paths are bounded;
package paths cannot be written through `writeLines()`. One packaged `R/sysdata.rda` workspace is
decoded into the namespace before R source evaluation. `utils::data()` enumerates direct `data/`
resources in attached or explicitly named packages. An `.R` dataset is decoded according to the
package encoding, parsed to the normalized AST, and evaluated in the selected environment; overwrite
protection restores pre-existing direct bindings. `.csv`, `.tab`, and `.txt` datasets use the owned
table reader and bind one frame under the requested dataset name. `.rda`/`.RData` entries use the
same XDR/gzip workspace decoder and install every named binding. The return vector and `packageIQR`
listing shape follow GNU R's visible/invisible contract. Installed-package `.rdx`/`.rdb` lazy-load
databases, aliases/index metadata, unsupported serialized types/compressors, and temporary
working-directory changes remain explicit boundaries.

`Sys.sleep(time)` uses short asynchronous timer slices, returns invisible `NULL`, and checks the
active cancellation token without consuming evaluation steps. Non-negative finite intervals and
`Inf` are accepted; missing, `NaN`, and negative values fail. Inline interruption is cooperative,
while the public Worker API retains its stronger terminate-and-reset behavior.

`system.time(expr, gcFirst = TRUE)` validates `gcFirst` with GNU R's scalar condition coercion, then
samples a monotonic browser clock around one lazy force of `expr`. Its visible `proc_time` vector
contains zero browser process CPU fields, measured elapsed seconds, and missing child-process
fields. A catchable expression error writes `Timing stopped at:` to stderr and is rethrown.
`proc.time()` uses the same clock and a resettable session origin, never decreases within a session,
and returns the same named/classed shape. Browser JavaScript does not expose forced garbage
collection, process CPU counters, or child-process counters, so those operations are not fabricated.

`graphics::polygon()` accepts the same owned coordinate containers but does not dispatch: paired
vectors, two-column matrices/data frames, complex coordinates, and named `list(x, y)` become
device-independent closed paths. Missing or non-finite pairs split separate polygons. Fill/border
colors, line types, and line widths recycle by path; `border = FALSE`, transparent styles,
`density = 0`, and `fillOddEven` resolve before transport. Negative, missing, and `NULL` density
select a solid fill. Positive hatch density, coordinate classes beyond owned numeric storage,
clipping/log axes, arbitrary graphical controls, and device-identical dash/fill rasterization remain
unsupported.

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
PNG file devices, while retaining GNU R's named null-device value 1 when no device is active.
`dev.off(which = dev.cur())` can close the current or a selected registered device, flushes held
commands before removal, renders a pending PNG page when applicable, selects a remaining device, and
returns that new current device. Unsupported device numbers remain harmless no-ops, while closing
null device 1 is an error. `graphics.off()` closes every owned device and returns invisible `NULL`;
later drawing reopens the browser device at the lowest free number. Each device owns its own
`graphics::par()` map; opening a PNG device applies its point size without mutating the browser
device, and closing it restores the newly selected device's parameters.

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

`graphics::persp()` dispatches classed first arguments before its owned matrix default. The default
requires increasing finite x/y coordinates and a two-dimensional real z grid, derives missing grids
over `[0, 1]`, validates finite limits, and leaves edges touching missing z values absent. It
normalizes coordinates separately when `scale = TRUE` or by their common largest range otherwise,
applies `expand`, azimuth/elevation rotations, eye distance, and perspective division, and returns
the resulting column-major `4 × 4` matrix invisibly. The measured default white surface and black
border are represented by projected grid/box line segments in a padded linear window, so the
existing Worker protocol, Canvas renderer, hold/flush journal, and record/replay codec need no host
3D object. The `axes` flag is validated, but directional arrows and axis text are not emitted yet.
Filled facets, shading/light angles, axis arrows/ticks/text, hidden-line removal, hooks, `trans3d`,
and arbitrary graphical parameters are rejected explicitly.

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

`colorRampPalette()` is a separate registered `grDevices` builtin. It validates hexadecimal and
catalog named colors, then returns a first-class palette function accepting the requested output
length. The observed isoband path linearly interpolates six anchors in CIE Lab space and reproduces
GNU R's 21 returned hexadecimal colors exactly; ordinary RGB, positive bias, optional alpha, partial
choice matching, and empty or singleton outputs have differential evidence. Conversion uses owned
sRGB/D65 transforms and never consults CSS, Canvas, or a host color service. Spline interpolation,
standalone `colorRamp`, and device color profiles remain outside this slice.

`col2rgb()` converts every owned catalog name, transparent/missing specifications, short or long
RGB(A) hexadecimal strings, and positive default-palette indices to a named three- or four-row
integer matrix. Input names become column names, and factors use their labels. `rgb()` performs the
inverse byte formatting used by stringr's measured `col2hex` helper, including recycled numeric
channels, optional alpha and result names, `maxColorValue`, and three-/four-column matrix or data
frame input. The default palette is deterministic session data in this slice; palette mutation,
wide-gamut spaces, and device profiles remain outside it.

`heat.colors()` independently generates the registered `grDevices` sequential heat palette. It uses
deterministic byte-rounded red-to-yellow and pale-yellow segments, returns uppercase hexadecimal
colors, optionally appends a recycled alpha byte, and can reverse the finished sequence. Numeric `n`
is truncated, names are discarded, and non-positive counts return an empty character vector. Other
palette families, palette mutation, broad color-space conversion, device profiles, and rendering
interpretation are separate surfaces.

`gray()` and its `grey()` alias coerce supported atomic gray levels, require finite values in
`[0, 1]`, recycle a nonempty optional alpha vector across the level vector, drop source attributes,
and emit uppercase RGB or RGBA hexadecimal bytes. `gray.colors()` and `grey.colors()` independently
compute the documented `seq(start^gamma, end^gamma)^(1/gamma)` palette, including default/custom or
descending endpoints, zero/fractional counts, gamma zero/negative behavior, alpha composition, and
final reversal. All loops and result allocations are charged to the runtime limits. Vector-valued
start/end/gamma controls, alpha longer than a direct level input, host color profiles, and the other
palette families are separate surfaces.

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

`interactive()` deterministically returns `FALSE`. NativR evaluations run as inline or Worker
requests rather than through GNU R's terminal read-eval-print loop, so the browser runtime never
claims an interactive session.

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

`utils::sessionInfo()` assembles a classed named list from the same evaluator-owned state. It
reports `wasm32-unknown-browser/nativr` and `Browser JavaScript (NativR)` instead of leaking or
misrepresenting the host operating system, identifies R 4.6.0 as the compatibility target, exposes
the active locale and three RNG kind names, lists the seven attached core packages, and reports the
runtime's UTC/internal time-zone contract. Native BLAS/LAPACK strings and loaded-only packages are
empty because the interpreter does not load those host facilities. Explicit `package=` description
enumeration and the display/LaTeX methods remain outside this slice.

`round()` vectorizes over both `x` and `digits` without a recycling warning, applies ties-to-even to
the exact binary input value, supports real and complex vectors, distinguishes missing digits from
numeric NaN, preserves `NA`/`NaN`/infinities and signed zero, and retains input attributes when the
result length does not change. Decimal scaling is implemented with bounded integer arithmetic rather
than host-locale formatting. Math2 S3 dispatch and class-specific methods remain outside this slice.

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

`stats::optim()` supports the measured BFGS path with a scalar finite `fn`, an optional finite
vector-valued `gr`, and lazily forwarded `...` arguments shared by both callbacks. Named initial
parameters retain their names in every callback and in the result. Without `gr`, central
finite-difference gradients are computed on the scaled parameter coordinates. The bounded
independent BFGS loop uses inverse-Hessian updates and Armijo line search; `fnscale`, `parscale`,
`ndeps`, `maxit`, `abstol`, and `reltol` controls cover minimization or maximization and coordinate
scaling, while `hessian = TRUE` adds a named numerical Hessian. Results expose `par`, `value`, named
function/gradient `counts`, `convergence`, `message`, and optional `hessian`. Arguments after `...`
require exact formal-name matching. Nelder-Mead, CG, L-BFGS-B, SANN, Brent, box bounds, trace
output, method-specific controls, more than 64 parameters, and native-algorithm trajectory identity
remain outside this slice.

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
a supplied environment. `eval`, `with`, and `local` propagate the final expression's visible or
invisible result. Custom `with` methods, active bindings, and full search-path behavior remain
outside this slice.

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
generation currently covers the default Mersenne-Twister uniform and Inversion normal kinds;
discrete sampling covers Rounding and Rejection. `set.seed` resets the selected engine, and its
fixed-seed `runif` sequence has executable GNU R black-box evidence. `sample.int()` uses the
selected discrete sampler for integer and large double-valued populations. Its Rejection path
assembles unbiased candidates from 16-bit uniform chunks; no-replacement sampling uses either an
owned sparse swap map or the documented fixed-population hash path. The evaluator installs the R 4.6
x64 `.Machine` constant shape, including `integer.max`, as an owned named list. Alternate uniform
and normal names remain queryable but are explicit unsupported selection boundaries. Sampling and
the documented distribution constructors consume the selected state in order. Weighted sampling
validates finite, non-negative probabilities.

`RNGversion(vstr)` parses the first atomic version value and chooses the documented default-kind
triple. R 1.7 through 3.5 selects Mersenne-Twister, Inversion, and Rounding; R 3.6 and future
versions select Mersenne-Twister, Inversion, and Rejection. The previous triple is returned
invisibly. Pre-R-1.7 defaults are rejected because their historical uniform and normal engines are
not yet implemented.

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

`eigen()` copies a finite real matrix into evaluator-owned storage. Symmetric inputs use Jacobi
plane rotations while accumulating the orthonormal eigenvector basis; bounded one- through
three-dimensional asymmetric inputs derive characteristic roots and normalized real or complex
right-null vectors. Results remain typed runtime vectors and matrices. No host BLAS/LAPACK binding,
native library, network request, or generated JavaScript is used.

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

`utils::capture.output()` evaluates its dots lazily inside a nested output-journal capture. The
`output` mode captures stdout and prints each visible expression result with the owned formatter;
the `message` mode captures message/stderr events while leaving stdout public. Captured chunks are
normalized into character lines without losing a final intentional blank line. Output-mode
`split = TRUE` re-emits the same events after capture, and every capture has an independent
`maxOutputBytes` bound. With `file = NULL` it returns character lines; a supported session path or
file connection receives the exact captured chunks. Closed connection targets are destroyed after
use as GNU R does. Host files, warning/error sink behavior, arbitrary class-specific top-level
printing, and the complete connection stack are outside this increment.

`utils::demo()` constructs the empty `packageIQR` catalog entirely from owned values when
`package = character()` and no library location is supplied. It does not scan an operating-system R
library or fetch package resources. Topics, nonempty package selections, and host library locations
therefore fail explicitly until virtual package resources and demo-script discovery are available.

The QR object stores the weighted upper-triangular factor needed to recover coefficient covariance.
`vcov()` combines its inverse crossproduct with weighted residual variance, `confint()` applies the
central Student-t critical value, and `df.residual()` exposes the fitted residual degrees of
freedom. Aliased coefficients remain explicit missing rows and columns.

Native `|>` evaluates its left expression once and inserts it as a forced first argument to the
right call. `%>%` additionally supports bare callables and dot insertion. Neither form rewrites
source into JavaScript.

Registered `base`, `stats`, `graphics`, `methods`, `utils`, `R6`, `vctrs`, and `tibble` namespace
access bypasses global shadowing for exact members. `::` and registered `:::` lookup do no I/O and
never load packages.

`comment()` reads the `"comment"` character attribute from the currently attributed sequence model.
`comment<-` and `attr(x, "comment") <- value` share validation: character values attach metadata,
`NULL` or `character()` removes it, missing character elements remain distinct, and every unrelated
attribute is preserved. Replacement uses the ordinary copy-and-rebind path. Closures, environments,
and owned language values do not yet carry general attribute maps, so setting their comments raises
an explicit unsupported-feature condition rather than silently discarding metadata.

Explicit classes use the ordinary attribute map. S3 `UseMethod` dispatches through ordered classes
and `.default`; `NextMethod` continues the current chain. The bounded S4 layer stores class,
old-style class, single-object generic, method, and explicit coercion declarations in session state.
`standardGeneric()` recognizes a registered generic definition's active closure frame, forwards its
declared values, evaluated defaults, and dots, and selects the first explicit class method or `ANY`;
declared S4 and old-style parent classes participate in that lookup. Calls outside that body and
missing methods are bounded errors. The generic wrapper performs the same lookup before evaluating
an ordinary fallback definition. `methods::show()` performs the same inherited single-object lookup
for registered `show` methods and preserves each method's returned value and visibility. Without a
registered method it writes the deterministic owned-value representation to the output journal and
returns invisible `NULL`; no terminal, pager, ANSI capability, or package-specific display code is
consulted. R6 generators construct classed public-field lists, and vctrs helpers construct class
metadata. Multiple S4 dispatch, full signature inheritance, automatic namespace/package
registration, method caches, primitive/group generics, and complete external-package behavior are
not claimed.

Default resource limits are 100,000 steps, 100 calls, 1,000,000 elements per vector, and 1,000,000
output bytes. Structured resource errors reduce accidental denial of service but are not a formal
security sandbox.
