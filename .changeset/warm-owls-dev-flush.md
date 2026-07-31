---
"@nativr/base": minor
"@nativr/nativr": minor
"@nativr/runtime": patch
---

Add usage-ranked `grDevices::dev.hold()` and `dev.flush()` with nested browser-device hold levels,
cross-evaluation graphics buffering, bounded pending raster memory, and ordered release when the
hold level returns to zero.
