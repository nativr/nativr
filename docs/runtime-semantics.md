# Runtime semantics

Atomic scalars are length-one vectors. Logical, integer, and double vectors use typed storage plus
an independent `Uint8Array` missing mask; therefore R NA and IEEE NaN remain distinct. Character
vectors use string storage and the same mask rule. Atomic values are immutable; environment bindings
are mutable.

The environment chain is `empty <- base <- global`. Closures capture their defining environment.
Supplied and default function arguments are lazy memoizing promises. Recursive forcing raises
`NRE2010`; argument matching supports positional and exact names, but not partial matching or
ellipsis.

Arithmetic is vectorized. Shorter operands recycle, and a single `NRW1001` warning is collected when
the longer length is not a multiple of the shorter. Missing operands produce missing output;
ordinary NaN stays NaN. Division and exponentiation produce doubles.

Each evaluation accounts for AST steps, approximate allocated elements, vector length, and call
depth. Defaults are 100,000 steps, 100 calls, 1,000,000 elements per vector, and 1,000,000 output
bytes. Resource failures are structured; these limits reduce accidental denial of service but are
not a formal security sandbox.
