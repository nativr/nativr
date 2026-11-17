---
"@nativr/base": patch
"@nativr/nativr": patch
---

Dispatch primitive `as.integer()` calls through package-defined S3 methods before applying the
default atomic coercion path, including forwarded method arguments and S4 method selection.
