---
"@nativr/nativr": minor
---

Add GNU R-style rightward and non-local assignment, exact/partial/positional argument matching,
missing-argument promises, complex vectors and arithmetic, and integer quotient/modulo operators.
Add raw-vector storage, transport, coercion, bitwise operations, shifts, and character conversion.
Add lazy `switch()` selection plus core GNU R storage-type predicates and atomic coercions. Add core
atomic constructors, `vector()`, `lengths()`, and recursive shape predicates. Add normalized
symbol/language values, lazy `quote()`, bounded `eval()`, language predicates, and stable Worker
snapshots that do not expose parser nodes. Add expression vectors, symbol coercion, call
construction, stable deparsing, and sequential expression evaluation on the same normalized language
model. Add bounded lazy `substitute()` semantics for closure promises, list bindings, and ellipsis
expansion. Decode backtick-delimited binding names and expose the supported arithmetic, comparison,
logical, sequence, and matching operators as first-class builtins. Add bounded `match.call()`
reconstruction and call-to-list inspection without forcing closure arguments. Add explicit root,
child, parent, current-function, and closure environment operations for lexical evaluation. Replace
the pairlist-shaped list approximation with an owned pairlist runtime type, coercion/predicates,
wire transport, lazy `alist()` construction, NULL-filled `vector("pairlist", n)`, indexing,
replacement type transitions, arbitrary runtime attributes, classes, dimensions, and dimension
names. Add `parse(text=)` with bounded `n` behavior and parser-validated JavaScript
symbol/language/expression record inputs. Let `structure()` attach arbitrary named attributes. Add
list-driven `do.call()`, explicit `force()`/`forceAndCall()` promise control, memoized
`delayedAssign()` bindings, and `identity()`. Add environment `$`/`[[` binding access and
replacement together with `get()`, `get0()`, `exists()`, `assign()`, `list2env()`,
`as.environment()`, and `environmentName()`. Match GNU R's `vapply()` logical-to-integer and
logical/integer-to-double/complex promotion rules, including complex and raw simplification. Add
arbitrary-dimensional column-major array extraction and replacement with strict per-axis subscripts,
GNU R-style `drop`, zero-length axes, dimension names and axis labels, non-finite subscript
warnings, and one-dimensional array name behavior. Add numeric and character coordinate-matrix array
extraction and replacement, including zero-row omission, missing coordinates, fractional truncation,
non-finite warnings, and strict bounds. Add common-type data-frame coordinate-matrix extraction and
numeric cell replacement with column-local coercion, recycling warnings, and GNU R-compatible
rejection boundaries. Add simple one-dimensional `$`, `[`, and `[[` replacement chains with
container reconstruction, NULL deletion, missing `$` intermediate creation, non-local rebinding,
data-frame column mutation, and GNU R-compatible repeated evaluation of intermediate subscript
expressions. Add GNU R-compatible one-dimensional replacement extension for atomic vectors and
lists, including typed missing or NULL gaps, logical/numeric/character-name growth, `[[<-`, name
extension, and dimension removal. Add consecutive data-frame column creation and factor replacement
with level mapping and invalid-level warnings. Add rectangular data-frame row extension for numeric
and character names, typed missing-cell padding, row-name growth, atomic and per-column list
replacements, and simultaneous row/column creation while retaining GNU R's logical-overrun and
missing-row rejection boundaries.
