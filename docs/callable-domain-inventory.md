# Callable and domain inventory

The generated [inventory](../compatibility/callable-domain-inventory.json) joins the observable GNU
R export snapshot, runtime registrations and recursive causal case links by exact, case-sensitive
`package::name`. It contains every binding in their union. The thirteen domain requirements are
maintained in [semantic-domains.json](../compatibility/semantic-domains.json), with explicit
assignments and gaps in
[callable-domain-annotations.json](../compatibility/callable-domain-annotations.json).

## Current scope

At profile 0.380, the inventory contains 2,553 bindings: 2,525 reference exports and 28
registrations absent from that export snapshot. There are 810 registrations and 782 exact qualified
overlaps. The existing 783 distinct-name overlaps measure a different relationship: registering a
name in one namespace does not establish the binding in another namespace.

All 153 bindings with existing causal links have explicit domain assignments. Reviewed purpose
assignments add 430 bindings from graphics, graphics devices and object-system methods, bringing the
classified total to 583. Another 1,970 bindings remain classification-pending. Assignments may span
domains, so per-domain counts cannot be summed.

Six bindings have 35 reviewed, partial behavioral-dimension declarations. Each declaration
references existing executable cases and retains explicit remaining gaps. No domain or callable is
complete; all undeclared dimensions remain pending. Even a callable with a partial declaration in
all seven dimensions still has an unfinished matrix.

These are declarations bound to source hashes, not records that oracle execution passed. Behavioral
claims still require the separate passing native/recursive gates for the matching profile and
evidence. Windows evidence does not satisfy the deferred normative Linux gate.

## Reviewed purpose assignments

The additional assignments cover 89 `graphics`, 139 `grDevices` and 202 `methods` bindings. Explicit
binding groups distinguish plotting and annotation, colors and numerical plot support, graphics
resources and devices, S4 dispatch and metadata, classes, slots and coercion, reference objects, and
package load actions. A namespace alone does not determine a binding's domain. Registered bindings
retain their implementation gaps; unregistered bindings still require implementation and evidence.

Nine opaque or legacy helpers in those namespaces remain pending: `grDevices::.opIndex`,
`grDevices::.ruleIndex`, `methods::classesToAM`, `methods::empty.dump`, `methods::findUnique`,
`methods::fixPre1.8`, `methods::metaNameUndo`, `methods::multipleClasses` and `methods::sigToEnv`.
Their exact public purpose needs further review.

Native windows, printers, font embedding and interactive devices remain unfinished. Assigning
graphics and I/O domains is not a platform exclusion; browser adaptations require documented host
capabilities and executable boundary checks. These purpose assignments add no causal evidence or
compatibility claims.

## Bounded behavioral review

The first matrix declarations review the existing replication and names fixtures from profiles 0.378
and 0.379. Recursive references are already causally linked to the credited binding. A shared case's
assertions are credited only to the binding they exercise.

| Binding                 | Partial dimensions                                                           | Dimensions still pending                                 |
| ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| `base::rep.int`         | Ordinary, boundaries, errors, attributes, visibility, side effects, identity | None lacks a partial declaration; all seven retain gaps. |
| `base::rep_len`         | Ordinary, boundaries, errors, attributes, visibility, side effects           | Identity                                                 |
| `base::names`           | Ordinary, boundaries, errors, attributes, visibility, side effects           | Identity                                                 |
| `base::names<-`         | Ordinary, boundaries, errors, attributes, visibility, side effects           | Identity                                                 |
| `base::names.POSIXlt`   | Ordinary, boundaries, errors, attributes                                     | Visibility, side effects, identity                       |
| `base::names<-.POSIXlt` | Ordinary, boundaries, errors, attributes, side effects, identity             | Visibility                                               |

Replication observations include selected count coercions, empty inputs, typed fills, factor and
time attributes, interpreted dispatch, forcing order and visible method results. The identity
declaration for `rep.int` is limited to an environment element retained in a replicated list. The
shared fixture's `rep_len` calls do not test reference aliases, so its identity dimension stays
pending. Compiled-path differences, unbound symbols and exact condition-call origins remain gaps.

Names observations include owned class/registered methods, primitive fallback, matching and forcing,
and POSIXlt year-component naming. The direct POSIXlt setter fixture checks that an environment
input is returned as the same reference with its year binding changed; this does not establish
identity for the names primitive or getter. Getter setup/cleanup operations do not count as getter
side-effect evidence. Names/member-replacement callback, malformed-object and dispatch gaps remain
explicit.

Two manually reviewed foundation cases supplement diagnostics: `replication-family-diagnostics`
directly checks `rep.int` messages, and `names-dispatch-method-errors` checks the four names
bindings' missing/empty arguments, atomic method inputs and absent year components. Both are
live-oracle eligible. Their recursive counterparts intentionally lack causal claims, and these
declarations do not add any. Resource-limit/recovery tests and metadata-only signature observations
are not promoted to differential behavioral coverage by this review.

## Maintenance and validation

Regenerate after building runtime semantics, in this order:

```text
pnpm capabilities:render
pnpm compatibility:report
pnpm inventory:render
pnpm status:render
```

`pnpm inventory:test` runs independently authored validator fixtures. `pnpm inventory:check`
reconstructs the report and rejects stale output. Both run during `pnpm check`. Canonical status
also reconstructs and validates the inventory before recording its digest and counts.

An annotation names an existing qualified callable, one or more known domains and explicit remaining
gaps. Every newly causal-linked binding needs an annotation. Duplicate/stale keys, invalid domains,
target/profile mismatches and unsupported evidence references fail validation. Unknown signatures
(`formals: null`) remain distinct from a known empty argument list.

Optional matrix declarations name a behavioral dimension, evidence references and remaining gaps.
They are always partial declarations. Recursive references must be causally linked to that binding.
Foundation references must exist and be eligible for the live oracle; relevance to the binding still
needs manual review. Neither reference type implies a passing run. NativR-only cases cannot supply
differential matrix evidence through this schema.

Schema v1 rejects completion and platform-exclusion claims. Registrations absent from the export
snapshot may be internal methods or extensions; the inventory does not infer which. Browser
adaptation prose is not an executable exclusion. The generated report contains observable signature
metadata and case IDs, with no native implementation bodies or package output.

## Remaining work

Classify the remaining qualified callables by semantic purpose, then audit bounded ordinary,
boundary, error, attribute, visibility, side-effect and identity evidence. Record unimplemented and
unverified behavior explicitly. Domain closure, platform exclusions and release completion retain
the acceptance criteria in the [compatibility ledger](gnu-r-compatibility.md).
