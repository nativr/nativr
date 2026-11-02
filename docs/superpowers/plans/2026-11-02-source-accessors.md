# Source metadata accessors implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.
> Execution continues under the existing authorized roadmap and its boundaries.

**Goal:** Make retained parser metadata consumable through independently implemented
`utils::getParseData(x, includeText)` and `base::getSrcLines(srcfile, first, last)`.

**Architecture:** Keep source selection, line extraction and table materialization in a focused base
module. Reuse runtime argument matching, promises, immutable values and resource checkpoints.
Register the ordinary base and utils bindings without changing the Worker protocol or public API.

**Tech stack:** TypeScript, existing normalized values and evaluator invocation API, Vitest,
independently authored GNU R 4.6.1 black-box fixtures and recursive Oracle v2.

**Spec:** The source-accessor gap in [the compatibility contract](../../compatibility-contract.md),
the [completion roadmap](../../development-continuation.md) and
[clean-room policy](../../clean-room.md). This increment does not establish complete retained
parsing or finish a semantic domain.

## Global constraints

- Keep browser-first ESM, CSP safety, dependency direction and the Worker-first API.
- No GNU R implementation bodies, package tests, new dependencies or downloads as inputs.
- No push, publication or remote changes. Verified local commits are authorized.
- Leave Formula and Linux gates untouched. Windows oracle evidence remains advisory.
- Preserve client 150 KiB gzip, Worker 512 KiB gzip, parser Wasm 1.5 MiB raw and elementary Wasm 384
  KiB raw limits. The preceding Worker measurement is 505.0 KiB gzip.
- Maintain separate original dependency-closure and assisted-runner evidence.

## Verified starting evidence

On committed `de48b0e` (profile 0.403), 25 exploration cases and 27 follow-up cases observed
metadata, values, attributes and conditions only. Eleven subsequently frozen scalar assertions pass
with GNU R 4.6.1 in C locale and fail on the clean committed NativR build. Seven fail with NRE2211
because `utils::getParseData` is absent; four fail with NRE2001 because `getSrcLines` is absent.
Genuine before/after snapshots bind the native and NativR executions to unchanged sources, tools and
built artifacts. These are baseline observations, not passing compatibility evidence.

Scratch evidence is under `.tmp/source-accessors-next/` and `.tmp/source-accessors-followup/`. The
compact maintained receipt is
[source-accessors-baseline-0.403.0.json](../../../compatibility/platform-evidence/source-accessors-baseline-0.403.0.json).
The first candidate draft had one incorrect attribute-order expectation for explicit FALSE. Its
native output and original scripts remain preserved; no NativR baseline ran on that draft. The
corrected cohort differs only in that expectation.

Observed requirements:

- `getParseData` has formals `x, includeText`; the drafted `which` argument is rejected by GNU R.
- The default table retains terminal text. Explicit TRUE reconstructs nonterminal source text;
  explicit FALSE removes the text column. NA retains the sampled terminal text.
- Rows are source ordered, not parse-data storage ordered. The owned `17L + 29L` specimen has IDs
  `7, 1, 2, 3, 4, 5`, with those IDs also in `row.names`.
- Column types, attribute order and shared source-environment identity are observable. The default
  attribute order is `names, row.names, class, srcfile`; explicit TRUE and FALSE produce
  `names, row.names, srcfile, class` in the sampled nonempty table.
- Parsed expressions, supplied source environments and evaluated parsed closures expose source
  metadata. Bare parse-data matrices and expressions without retained source return NULL.
- Empty retained parsing yields a zero-row table; empty and missing data are different cases.
- `getSrcLines` requires both bounds. Sampled ranges truncate at the source end; reversed ranges
  return character(0) before forcing the source argument. Fractional, zero, negative, missing,
  vector and infinite bounds need their independently observed behaviors.
- Source aliases read original lines even when the alias contains a local `lines` binding. Source
  names survive ordinary extraction while unrelated attributes are dropped.

## Review focus

1. Alias cycles, long alias chains and active bindings must stay cancellable and resource bounded.
2. Tabs, UTF-8, multiline expressions and `#line` require separate physical-position observations.
3. Missing data and invalid controls can change forcing order; never infer it from eager matching.
4. Mutable or malformed source environments must not produce unchecked host exceptions or accept
   fabricated table shapes silently.
5. File-backed sources require explicit existing host capabilities; do not silently replace file
   reads with empty results or broaden host access.

## Task 1: Complete the accessor behavior matrix

Files: create `packages/nativr/test/source-accessors.test.ts`; use independent scratch native probes
and immutable corrected acceptance inputs before production changes.

- [x] Verify eleven native-TRUE candidates and their clean committed failing baseline.
- [ ] Add independent probes for active bindings, malformed data, absent parseData, namespace and
      caller lookup, control forcing order, multiline text, UTF-8, tabs and line directives.
- [ ] Add file-backed and alias-cycle boundary probes under explicit capabilities and resource
      limits.
- [ ] Freeze foundation assertions and separate raw recursive outputs with independent expected
      constructors. Use unqualified lookup where required by the existing causal-shadow harness;
      keep qualified namespace assertions separately. Do not backdate baseline credit to new cases.
- [ ] Run the new Vitest file and verify the missing-binding failures before implementation.

## Task 2: Implement shared source access and table materialization

Files: create `packages/base/src/source-accessors.ts`; modify `packages/base/src/builtins.ts`; test
through the file from Task 1 and focused base resource tests.

Interfaces: exported builtin implementations consume `BuiltinInvocation` and return
`Promise<RValue>`. Internal source resolution consumes ordinary runtime values and preserves source
environment identity. The implementation must not depend on parser concrete trees or GNU code.

- [ ] Implement lazy source resolution and bounded alias traversal using ordinary environment
      access.
- [ ] Implement source-line range extraction with observed coercion, names and forcing behavior.
      Test all five review-focus classes in the code path that owns each behavior.
- [ ] Convert validated retained parse-data matrices into typed source-ordered table columns.
      Preserve row IDs, parent relationships, source identity and sampled attribute order.
- [ ] Reconstruct requested text using observed physical positions, tab and encoding behavior;
      verify each behavior with independent outputs rather than inferred slicing rules.
- [ ] Register base/ utils ownership and observable signatures; verify namespace and ordinary
      lookup.
- [ ] Pass the focused regression/resource suite and independently review implementation and
      evidence.

## Task 3: Integrate evidence and verify the increment

Files: `packages/nativr/src/capabilities.ts`, `conformance/cases/foundation.json`,
`conformance/cases/oracle-v2.json`, generated reports, compatibility contract,
continuation/readiness documentation and digest-bound platform/package records.

- [ ] Synchronize both profile identifiers, add foundation/recursive cases with native causal
      controls, and update only the supported evidence boundary. Retain explicit remaining gaps.
- [ ] Build serially, then regenerate capabilities, coverage, inventory and canonical status.
- [ ] Pass `pnpm check`, `pnpm conformance`, `pnpm conformance:r` and `pnpm conformance:r:v2` with
      execution-time source/artifact snapshots. Do not build while consuming dist.
- [ ] Rerun affected cached evaluate/withr checks and additional shared consumers justified by the
      matrix; preserve redacted reports, partitions, first blockers and repeatability observations.
- [ ] Run applicable Worker tests when the pinned browsers are available. Download approval remains
      pending; no passing 0.403 or later browser result is implied by this plan.
- [ ] Reconcile final metadata, run its checks separately, and commit the verified local increment
      with any genuinely unexecuted external gate stated explicitly.

Completion of these tasks does not supersede the five overall completion criteria or the remaining
thirteen-domain work. Continue the roadmap after this increment.
