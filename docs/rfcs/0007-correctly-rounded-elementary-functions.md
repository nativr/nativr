# RFC-0007: correctly rounded elementary functions and the normative oracle platform

Status: **accepted** (decision recorded 2026-10-17; steps 1-4 done 2026-10-17 at profile 0.354; step
5 pending; see [Implementation record](#implementation-record))

## Problem

NativR evaluates `exp`, `log`, `sin`, `pow` and the other elementary functions with the host's
`Math` object. ECMAScript leaves these results implementation-approximated, so two browsers may
return different last-place results for the same input. GNU R calls its platform's C library.
Measured against GNU R 4.6.1 for Windows (UCRT), V8's `Math.log` differs on 5.7% of sampled inputs
and `Math.exp` on 9.2%, while `Math.sqrt`, which IEEE 754 requires to be correctly rounded, matches
exactly. The oracle is not always the more accurate side: for `cos(1.5707963267948966)` the Windows
oracle returns `6.12303176911189e-17`, while the correctly rounded value is `6.123233995736766e-17`.

These last-place differences propagate. They are the remaining cause of `qnorm`/`pnorm`/`rnorm`
differences after profile 0.352. They also explain, unverified individually, the deterministic
numDeriv output differences. As long as the result depends on which browser runs NativR, no exact
numeric comparison can be release-gating.

## Decision

1. NativR will own a **correctly rounded binary64 elementary-function library**. Every browser then
   computes the same bits, and those bits are the mathematically defined round-to-nearest results.
2. The **normative oracle platform** for GNU R 4.6.1 is **x86_64 Linux with glibc**, as recorded in
   `compatibility/profiles.json`. GNU R 4.6.1 for Windows (UCRT) becomes an advisory oracle.
3. A comparison whose only difference is a last-place elementary-function result is accepted only
   under the **verified libm deviation** rule below. Differences are recorded, never normalized
   away.

## Source of the algorithms

The candidate is **CORE-MATH** (Inria; Sibidanov, Zimmermann, Glondu and contributors). It is MIT
licensed and provides correctly rounded binary64 implementations of `exp`, `exp2`, `exp10`, `expm1`,
`log`, `log2`, `log10`, `log1p`, `pow`, `sin`, `cos`, `tan`, `sinpi`, `cospi`, `tanpi`, `asin`,
`acos`, `atan`, `atan2`, `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh`, `cbrt` and `hypot`
(project page checked 2026-10-17). It is not derived from GNU R and is a permitted, permissively
licensed dependency under [docs/clean-room.md](../clean-room.md) after license review.

Known limits that NativR must handle itself:

- Correct rounding is claimed only for regular inputs. NaN, infinities, signed zeros, overflow and
  underflow are specified by NativR from IEEE 754 and checked against the oracle.
- Upstream testing covers x86_64 Linux with and without FMA. The NativR build must use the non-FMA
  paths and avoid relaxed SIMD, whose fused multiply-add is nondeterministic across engines.
- `lgamma`, `gamma`, `beta`, the distribution functions and similar R-level numerics are **not**
  replaced. GNU R uses its own algorithms for those, which NativR follows from their publications,
  as AS 241 and Cody were in profile 0.352.

## Delivery: a pinned Wasm module (recommended)

Compile a pinned CORE-MATH commit to a standalone `wasm32` module at build time and ship it as a
digest-verified asset, as the parser Wasm already is.

- Build-time tooling only: a pinned clang/wasi-sdk produces the module from unmodified sources. The
  toolchain stays outside the browser bundle, like the grammar build. The source commit, compiler
  version, flags (`-O2`, no FMA, no relaxed SIMD, no host imports) and the output SHA-256 are
  recorded.
- Determinism: WebAssembly binary64 arithmetic is IEEE 754 round-to-nearest in every engine. Only
  NaN payloads may vary, and R already treats `NaN` uniformly (`NA` is distinguished by payload, so
  the adapter preserves NativR's own `NA` before calling into Wasm).
- Runtime shape: the module is instantiated during runtime start-up, beside the parser, so the
  synchronous operator paths never await. Vector paths copy inputs into linear memory and run one
  exported loop, instead of crossing the boundary per element. No imports and no dynamic code; the
  CSP posture is unchanged from the parser's Wasm.
- Size: the module is a separate asset with its own raw budget; Worker JavaScript should not grow.

An alternative is a TypeScript translation of the algorithms. It avoids a C toolchain, but it would
translate 64-bit integer and double-double code into JavaScript by hand, which raises the risk of
silent errors, and it would run slower. It remains the fallback if Wasm start-up cost proves too
high for small sessions.

## Verified libm deviation rule

The normative platform's libm is accurate but not uniformly correctly rounded (since release 2.43,
glibc includes only some CORE-MATH binary64 functions). A difference between NativR and the
normative oracle is therefore classified, not waived:

1. The comparison harness recomputes the disputed elementary-function value with an independent
   high-precision reference at test time (for example, the BSD-licensed mpmath). The reference is a
   separately installed black-box tool and is never shipped.
2. If NativR's value equals the correctly rounded reference and the oracle's does not, the
   observation is recorded as `oracle-libm-deviation`, with the input, both values and the
   reference.
3. Any other difference is a NativR defect.

This applies only where a single elementary-function result is compared directly. Package output
that is derived from many operations is not waived wholesale: such a difference becomes acceptable
only after it is traced to specific deviation records.

## Normative oracle platform

| Field          | Value                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| Implementation | GNU R 4.6.1                                                                             |
| Platform       | x86_64 Linux, glibc                                                                     |
| Reference host | GitHub Actions `ubuntu-24.04` with `r-lib/actions/setup-r` pinned to `r-version: 4.6.1` |
| Advisory       | GNU R 4.6.1 for Windows x86_64 (UCRT)                                                   |

Rationale: the CI oracle job already runs on Ubuntu, Linux is the platform GNU R is principally
developed and checked on, and glibc's binary64 functions are closer to correctly rounded than UCRT's
in the sampled cases. Evidence collected on Windows remains valid advisory evidence, but it must be
rerun on the normative platform before it can gate a release. The CI workflow must pin
`ubuntu-24.04` instead of `ubuntu-latest`, and evidence must record the glibc version.

## Implementation plan

Each step lands with its own tests and does not change semantics until step 4.

1. **License and pin.** Record the CORE-MATH commit, MIT license text and `NOTICE` entry. Add a
   build script that compiles the selected functions to `elementary.wasm` with the pinned toolchain
   and verifies the digest. Done when the build reproduces the same digest twice from a clean
   checkout.
2. **Reference harness.** Add an opt-in test that compares every exported function with an
   independent high-precision reference on fixed hard-to-round inputs and randomized samples. Done
   when every sampled result is correctly rounded and special values match IEEE 754.
3. **Cross-engine identity.** Run the same inputs through the module in Chromium, Firefox and WebKit
   (Playwright). Done when the three engines return identical bits.
4. **Adoption.** Route the base builtins (`exp`, `log`, the trig family, `^` for non-integer
   exponents) and the internal callers (`normal.ts`, `printf`-independent numerics) through the
   module, behind a semantic profile bump. Done when the existing suites pass and the 0.352 sweeps
   show NativR as correctly rounded on every sampled input.
5. **Oracle platform switch.** Pin the CI runner, add the `oracle-libm-deviation` classification to
   the oracle runners and package-check, and rerun the conformance, Oracle v2 and package evidence
   on the normative platform. Done when `compatibility/status.json` records Linux-produced evidence
   and numDeriv's remaining differences are each either fixed or traced to recorded deviations.

## Implementation record

Steps 1-3 and step 4a (delivery) were completed on 2026-10-17 on Windows 11 x86_64 with Node
24.14.0. Each session now loads and verifies the module, but nothing computes through it yet, so no
runtime semantics changed.

### Step 1: pins and build

| Field     | Value                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| Source    | CORE-MATH `dae5dd8c0d5bd2691b45de28c9edbe12f067c3d3` (master, 2026-10-15), gitlab.inria.fr/core-math         |
| License   | MIT, reviewed; `LICENSE` SHA-256 `81830875…86de3`; `NOTICE` entry added                                      |
| Toolchain | wasi-sdk 29.0: clang/LLVM 21.1.4 (`222fc11f2b8f`), wasi-libc `ac020b86fd44`                                  |
| Compile   | `--target=wasm32-wasip1 -mcpu=lime1 -mno-simd128 -mno-relaxed-simd -O2 -ffp-contract=off -fno-fast-math`     |
| Link      | `-nostdlib --no-entry --strip-all`, nine named wasi-libc members, compiler-rt builtins                       |
| Output    | `elementary.wasm`, 318,690 bytes, SHA-256 `0467e7c1a694e4b0eb86343457cfe733d9220132385dfe73f7845d1261837a0a` |
| Interface | no imports; exports `memory`, `reserve`, and for each of the 22 functions a scalar export and `v_<name>`     |

The pins, per-file source digests and flags live in `scripts/elementary/core-math.json`.
`node scripts/build-elementary-wasm.mjs [--fetch]` verifies every source file against its digest and
checks the wasi-sdk `VERSION` file. It builds twice, each time from fresh copies in its own
temporary directory, and fails unless both builds and the pinned digest agree. It then rejects any
import and any missing or extra export, and writes `.tmp/elementary/` with the module, a manifest
and the CORE-MATH license. Both builds reproduced the pinned digest.

The 22 upstream translation units compile unmodified. Three NativR-owned files under
`scripts/elementary/` contain no numerical code:

- `wasm-fenv.h` is force-included. wasi-libc defines only `FE_TONEAREST` and `FE_ALL_EXCEPT`,
  because WebAssembly has one rounding mode and no exception flags. The shim defines the remaining
  flag macros as 0, so flag operations are no-ops. It gives the directed rounding modes distinct
  values that `fegetround()` never returns. With `CORE_MATH_SUPPORT_ERRNO` undefined, no result
  depends on a flag.
- `nativr-elementary.c` exports the functions, the vector loops and a scratch-memory `reserve`. It
  also defines trapping `printf`, `puts` and `exit`, used only by upstream diagnostics in `pow` and
  `atan2` for inputs believed unreachable. This keeps stdio and WASI imports out. Linking the whole
  libc archive made wasm-ld extract `exit.o`, so the link names libc members explicitly.
- `functions.h` lists the exports.

CORE-MATH's `__builtin_fma` calls lower to wasi-libc's software `fma`, which is exact and
deterministic. The disassembly contains no SIMD, relaxed-SIMD or fused instructions.

### Step 2: reference harness

`NATIVR_MPMATH=<dir> node scripts/test-elementary-reference.mjs` (opt-in, not part of `pnpm check`)
uses mpmath 1.3.0 (BSD), run as a separate `python -I` process. The wheel was installed with a
verified hash into a directory outside the repository. For each case,
`scripts/elementary/mpmath-reference.py` raises the working precision from 160 bits until two
consecutive precisions round to the same binary64 value under round-to-nearest-even. The inputs are:

- 96 hard-to-round inputs per function, taken from the start of CORE-MATH's published `.wc`
  worst-case files (`scripts/elementary/hard-cases.json`, MIT, regenerated with `--update-fixture`);
- seeded random samples, half from each function's domain and half random finite bit patterns;
- 195 IEEE 754-2019 §9.2 / ISO C Annex F special cases (NaN, signed zeros, infinities, overflow,
  underflow, exact cases, and the `pow`, `atan2` and `hypot` edge rules), checked against a table
  without mpmath;
- every case again through the vector export, which must match the scalar export bit for bit.

| Run                                   | Reference cases | Failures | Host `Math` differs from the correctly rounded value |
| ------------------------------------- | --------------: | -------: | ---------------------------------------------------: |
| default, 2,000 samples, seed 20261017 |          46,112 |        0 |                           3,172 (V8 in Node 24.14.0) |
| 20,000 samples, seed 7                |         442,112 |        0 |                                               26,479 |

Every sampled result was correctly rounded, and every special value matched IEEE 754.

### Step 3: cross-engine identity

`pnpm exec playwright test -c playwright.elementary.config.ts` (opt-in, needs the built module) runs
91,184 inputs through every scalar and vector export. The inputs are the hard cases, 16 IEEE special
values (unary, and all 256 pairs for binary functions) and 4,000 random bit patterns per function.
It checks Node 24.14.0, Chromium 151.0.7922.34, Firefox 153.0 and WebKit (Playwright 1.62.0 builds).
All four returned identical bits, comparing NaN as NaN without its payload.

### Step 4a: delivery

Step 4 is split. Step 4a ships the module as a runtime asset without routing any computation through
it, so no result changes and the semantic profile is unchanged. Step 4b (adoption) remains as
described in the implementation plan.

- **Build.** `pnpm build` runs `scripts/build-elementary-wasm.mjs --reuse`, which skips compiling
  only when `.tmp/elementary/` already holds the pinned module, manifest and licenses. It then runs
  `scripts/copy-elementary-assets.mjs`. The copy refuses a module whose SHA-256 differs from
  `core-math.json`, or from the digest and length pinned in `packages/nativr/src/elementary.ts`. It
  writes `elementary.wasm`, `elementary.manifest.json` and `licenses/` into
  `packages/nativr/src/assets`, `apps/playground/public/assets`, `packages/nativr/dist` and
  `packages/nativr/dist/assets`, the same targets as the parser assets.
- **Toolchain pin.** `core-math.json` `toolchainDownloads` records the six wasi-sdk 29.0 release
  archives with their SHA-256 values (GitHub release asset digests). `--fetch` downloads the archive
  for the host, rejects a digest mismatch before extracting it, and installs it under
  `<cache>/NativR/wasi-sdk/29.0-<platform>`. That copy is then preferred over tree-sitter-cli's
  cache. The CI, conformance, browser and release workflows run
  `node scripts/build-elementary-wasm.mjs --fetch` after `pnpm install`. Local builds still accept
  tree-sitter-cli's copy after the same `VERSION` check. The archive download path has not yet run
  in CI.
- **Licenses.** The wasi-libc `LICENSE` and `LICENSE-MIT` and musl `COPYRIGHT` files, from wasi-libc
  `ac020b86fd44`, are kept verbatim under `scripts/elementary/licenses/`. Their digests are pinned
  in `bundledLicenses`. They ship beside the module with the CORE-MATH license, and `NOTICE`
  reproduces the CORE-MATH and musl license texts.
- **API.** `CreateRAssets.elementaryWasm` and the Worker `init` request's `assets.elementaryWasm`
  are optional. The default URL applies only when neither parser asset is overridden. This keeps
  callers that pass explicit parser URLs working, including Node test and conformance runners, where
  `fetch` cannot read `file:` URLs. Those sessions load no module.
- **Host.** `RuntimeHost.create` loads the module once per session, before the parser. The loader
  hashes it with an in-tree FIPS 180-4 SHA-256, so verification does not depend on `crypto.subtle`
  or a secure context. It checks length and digest, requires zero imports and exactly `memory`,
  `reserve` and the 44 function exports, and instantiates with `{}`. The instance is exposed as
  `RuntimeHost.elementary` and is not yet used. Failures are `NRS5012` (fetch), `NRS5013` (digest)
  and `NRS5014` (interface).
- **Budget.** `scripts/check-bundle-size.mjs` gives `elementary.wasm` its own 384 KiB raw ceiling,
  separate from the 1.5 MiB parser-Wasm budget.
- **Evidence.** `packages/nativr/test/elementary-asset.test.ts` checks the pins against
  `core-math.json`, the digest against `node:crypto`, rejection of tampered and import-bearing
  modules, inline instantiation of the built module, and the Worker `init` payload. The Playwright
  suite loads the default asset through the playground Worker in Chromium, Firefox and WebKit.

### Step 4b: adoption (profile 0.354)

- **Injection.** `ElementaryMath` (runtime) is carried on every evaluation context as
  `context.math`. `RuntimeHost` builds it from the session's verified instance
  (`createElementaryMath`); otherwise the session uses `HOST_ELEMENTARY_MATH`. There is no
  module-level global.
- **NA.** NativR carries `NA` in the missing mask, and missing elements never reach the module, so
  no payload restoration is needed.
- **Fallback.** Sessions without the module keep a recorded JavaScript fallback (backend `"host"`).
  Browser and Worker sessions load the module by default. The conformance, Oracle v2 and
  package-check runners load it explicitly, so the release-gating evidence exercises the correctly
  rounded path.
- **Routing.** `exp`, `expm1`, `log`, `log1p`, `log2`, `log10`, `sin`, `cos`, `tan`, `asin`, `acos`
  and `atan`; `^` except exponents 2, 3 and 4; and `normal.ts` (`qnorm`, `pnorm`, `rnorm`).
  Non-finite and zero arguments use the engine's exact IEEE paths.
- **Results.** On the Windows oracle, `pnorm` matches 3000/3000 and seeded `rnorm` 3000/3000 (host
  math: 2805 and 2993). `pnpm conformance` passes 1225/1225 and Oracle v2 127/127 on this path.
- **Remaining.** Complex functions, Student-t internals, other direct `Math` uses, the unregistered
  hyperbolic functions and `atan2`, and start-up cost measurement.

## Open questions

- Start-up cost of instantiating a second Wasm module in small sessions.
- Whether `^` with integer exponents should keep GNU R's observable repeated-multiplication results
  (to be established black-box first) rather than `pow`.
- Whether to expose the deviation records in the public capability report.
