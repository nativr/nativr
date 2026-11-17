---
"@nativr/base": patch
"@nativr/nativr": patch
---

Accept GNU R-shaped `major`/`minor` metadata lists in `package_version()` and construct the
corresponding `R_system_version` object without widening ordinary list coercion.
