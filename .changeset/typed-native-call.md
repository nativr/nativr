---
"@nativr/protocol": minor
"@nativr/runtime": minor
"@nativr/base": minor
"@nativr/nativr": minor
---

Add usage-ranked `base::.Call()` through an explicit typed native/Wasm adapter. Applications
register cloneable module/routine metadata, receive data-only R snapshots through inline or Worker
execution, and return a validated bounded snapshot. The default remains capability-free, while
`getLoadedDLLs()` now reports only explicitly registered modules.
