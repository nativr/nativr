# Optional owned testing runner

`nativrTest` 0.1.0 is an independently authored interpreted R bundle for repository-owned fixtures.
It is maintained under `testing/nativr-test-runner/`, outside the production workspace packages.
Load it through the existing `createR({ packages })` API. The public runtime and Worker protocol are
unchanged.

The initial milestone supports bounded assertions, conditions, setup/cleanup, skips, failures and
reporting. Its [behavior contract](../testing/nativr-test-runner/behavior-contract.md) defines the
owned behavior; its [support manifest](../testing/nativr-test-runner/support-manifest.json) records
each API's implemented subset, rejected controls, native observations and remaining gaps.

## Run the owned acceptance suite

Use the supported Node 24/pnpm 11 toolchain and an already verified serial build. Keep inputs and
dist unchanged during execution. The command does not build, install packages or require GNU R.

```text
pnpm testing:assisted:test
pnpm testing:assisted -- --suite core --out .tmp/assisted-test-runs/core-checkpoint
```

Only the pinned `core` suite is accepted. The output must be a new directory beneath
`.tmp/assisted-test-runs/`; existing directories and link/junction ancestors are rejected. The CLI
accepts no package, archive, URL or arbitrary source argument. It runs a bounded child with a
120-second process limit and an 8 MiB captured-result limit. Each fixture gets a fresh inline
session with explicit package-test resource limits and only the owned optional bundle.

The nine fixtures cover passing expectations, deliberate failure, caught unsupported APIs, cleanup
failure, ordinary errors, skips, reporter exhaustion, unaccounted outer output and runtime resource
exhaustion. Exit zero means all nine **expected outcomes** match. Deliberately failed or aborted
fixture reports retain those outcomes; they are never relabeled passed.

The pure host and CLI checks run in `pnpm check`. Source integration tests execute the 28 owned
behavior cases. Browser integration separately exercises the optional bundle through the existing
Worker API. These tests do not install or execute the original testthat dependency closure.

## Evidence and provenance

Successful capture produces `nativr-runner-assisted-report` version 1. Host admission binds runner
source/bundle/contract/support hashes, explicit fixture paths and pins, runtime profile,
capabilities, effective limits and execution configuration. Bundle identity is SHA-256 of the exact
JSON serialization of `{description,namespace,rSources}` in that order. Fixture pins hash original
UTF-8 bytes. The CLI records source, dist and tool hashes before/after execution and rejects
changes. Stability checks cannot prove that stale dist was built from current source; the verified
build is a prerequisite.

The host validates lossless snapshots, event ordering, terminal states and aggregate outcomes before
writing canonical JSON reports. Text that may contain source or diagnostics is represented by
digests and byte counts. Because outer output and callbacks lack a common chronology with private
events, any such effect rejects capture. Resource or cancellation failures may prevent a report and
produce only an explicit rejection. Mutable interpreted state is not hostile-code attestation.

`index.json` records the manifest pin, stable input inventory, report hashes, derived counts and
expected rejections. Infrastructure failure exits nonzero; the new output directory may remain empty
or incomplete and must not be treated as a valid checkpoint. The tool never overwrites or removes
it. Child exception text and stacks are suppressed.

Every report and checkpoint explicitly denies normative tier credit and original dependency closure
satisfaction. The original-package evidence validator rejects this report format. No corpus tier,
capability, callable inventory or recursive-oracle claim changes from an assisted run.

## Remaining work

The
[Windows 0.389 checkpoint](../compatibility/assisted-testing-evidence/owned-core-windows-0.389.0/index.json)
records all nine owned outcomes with stable input hashes. Its
[verification record](../compatibility/assisted-testing-evidence/owned-core-windows-0.389.0/verification.json)
records repeated report digests, 29 source tests, 86 host/CLI tests, the full repository gate and 12
browser tests. These are owned acceptance results with no normative tier credit.

The documented target is testthat 3.3.2 edition 3. Existing native reference observations are
separate from running our implementation under GNU R: cross-interpreter agreement establishes only
the owned contract. The manifest keeps APIs at observed-reference-only, own-only or unsupported
status until the same independent cases demonstrate real-testthat parity.

Comparison/snapshot APIs, general regex and condition ancestry, exact diagnostics/returns, nested
and interactive tests, helper discovery, native cleanup-failure equivalence, package admission and
dependency execution remain unfinished. Unsupported calls are explicit blockers even when the test
catches their error. Broader package use and any compatibility-contract change require separate
evidence; this tool does not substitute a `testthat` namespace.
