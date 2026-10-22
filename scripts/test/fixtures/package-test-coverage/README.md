# Owned nested test execution fixtures

These five source trees and the harness are independently authored NativR fixtures. They contain no
package or GNU R implementation bodies. The harness executes only enumerated top-level R files in
the supplied fixture tree, and records controlled values from our own instrumentation. It never
inspects a native body or condition call.

Initial observations: GNU R 4.6.1, C locale, 2026-10-22. Each of the five scratch fixtures passed
before promotion; the maintained opt-in test repeats those observations with unchanged fixture
hashes, a 15-second child timeout and a 64-KiB output bound. Only the existing installed oracle is
used; no dependency installation or download is performed.

Run with Node 24 and an installed GNU R 4.6.1:

```powershell
$env:NATIVR_RUN_NATIVE_PACKAGE_COVERAGE = '1'
node --test scripts/test/package-test-coverage.native.test.mjs
```

An explicit `NATIVR_RSCRIPT` path is authoritative, following the shared discovery policy. The test
is skipped when the opt-in environment variable is absent. These native observations do not run
NativR, execute external package tests, or grant compatibility or package-tier credit.

| Fixture               | Top-level outcome             | Nested marker count |
| --------------------- | ----------------------------- | ------------------: |
| `direct-nested`       | completed                     |                   1 |
| `guarded-unavailable` | completed                     |                   0 |
| `no-entrypoint`       | no entrypoint selected        |                   0 |
| `direct-only`         | completed                     |                   0 |
| `top-failure`         | failed with the owned message |                   0 |

`guarded-unavailable` verifies that the invented namespace `nativrOwnedMissingRunnerClosure0a393` is
unavailable. It does not depend on testthat. All nested paths are under `tests/helpers/`; a
framework-specific directory does not drive this policy.

The direct source fixture establishes actual nested execution through our marker. The production
checker currently observes only top-level capture paths, so both the direct-source and guarded
fixtures conservatively have an unverified nested execution closure. This is an explicit limit, not
evidence that every nested helper is an independent required test. Real top-level failures remain
failures, and direct tests without nested files retain the existing successful route.
