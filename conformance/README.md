# Conformance

Checked-in cases describe the exact source, expected friendly result, warning presence,
compatibility level, and numeric tolerance. `pnpm conformance` runs them without GNU R.
`pnpm conformance:r` optionally invokes a local `Rscript --vanilla` as a black-box oracle and
compares canonical type, length, value, visibility, and warning presence.

R is development tooling only. No reference output or R implementation code is shipped in the
runtime. New semantic claims require a focused case here and a corresponding unit or integration
test.
