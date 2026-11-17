---
"@nativr/base": patch
"@nativr/nativr": patch
---

Compare language objects in `all.equal` by their GNU-shaped deparsed calls while preserving
structural `identical` semantics, allowing generically constructed and parsed calls to compare
equally without package-specific handling.
