---
"@nativr/parser": patch
"@nativr/runtime": patch
"@nativr/base": patch
"@nativr/nativr": patch
"@nativr/package-tools": patch
---

Recover explicit semicolon terminals in normalized parse data, render custom infix block operands
with GNU-shaped deparse lines, and preserve the original argument position when `rbind()` or
`cbind()` dispatches past leading `NULL` values.

Use the shared contracts to keep unchanged lambda.r, futile.logger, and VennDiagram package checks
passing without package-specific runtime behavior.

Make S4 generic dispatch force only declared signature arguments while preserving missing and lazy
non-signature promises, forward literal ellipsis promises through special `rep()`, and implement the
GNU-shaped `c.POSIXct` class, name, and compatible-time-zone contract. The generic package checker
now keeps its repository index cache and reports the exact failed plan when unchanged timeDate
regresses; flat and exact recursive GNU observations cover the semantics, and timeDate 4052.112
passes the complete current P7 plan through the shared paths.
