---
"@nativr/nativr": minor
"@nativr/package-tools": minor
---

Developer preview. The supported scope, limitations and verification record are in
`docs/release-readiness.md`; this release makes no claim of general GNU R or package compatibility.

Conditions now follow GNU R's handler stack. Warnings from builtins and operators reach
`tryCatch(warning = )`, `withCallingHandlers` and session calling handlers. `suppressWarnings` and
`suppressMessages` muffle at their own stack position and honor `classes`. Restarts and
`options(warn = )` levels are supported. `packageStartupMessage`, `suppressPackageStartupMessages`
and `require()`'s startup message are added. Common warning texts now match GNU R (`NaNs produced`,
`NAs introduced by coercion`).

Numerics and text follow GNU R more closely. `qnorm` uses AS 241 and `pnorm` uses Cody's
approximations, so seeded `rnorm` streams reproduce GNU R's. `sprintf` adds the C99 `%e`/`%E`/`%g`/
`%G`/`%f` conversions with exact half-to-even rounding and two-digit exponents. Double-to-character
coercion uses GNU R's 15-significant-digit form (`paste(0.1 + 0.2)` is `"0.3"`).

Package-check tooling seeds both runtimes identically, detects non-repeatable oracle output, and
compares cross-stream output order. The normative oracle platform is now x86_64 Linux GNU R 4.6.1
(RFC-0007).
