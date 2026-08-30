---
"@nativr/base": minor
"@nativr/nativr": minor
"@nativr/package-tools": minor
---

Add the complete browser-owned `datasets::esoph` resource and preserve structured missing-package
evidence when `system.file(..., mustWork = TRUE)` targets an unavailable optional dependency, so
generic package checks can distinguish unavailable Suggested packages from genuine missing files.
