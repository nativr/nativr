# Callable and domain inventory

The generated [inventory](../compatibility/callable-domain-inventory.json) joins the observable GNU
R export snapshot, runtime registrations and recursive causal case links by exact, case-sensitive
`package::name`. It contains every binding in their union. The thirteen domain requirements are
maintained in [semantic-domains.json](../compatibility/semantic-domains.json), with explicit
assignments and gaps in
[callable-domain-annotations.json](../compatibility/callable-domain-annotations.json).

## Current scope

At profile 0.379, the inventory contains 2,553 bindings: 2,525 reference exports and 28
registrations absent from that export snapshot. There are 809 registrations and 781 exact qualified
overlaps. The existing 782 distinct-name overlaps measure a different relationship: registering a
name in one namespace does not establish the binding in another namespace.

All 151 bindings with existing causal links have explicit domain assignments. Another 2,402 bindings
remain classification-pending. Assignments may span domains, so per-domain counts cannot be summed.
No domain or callable is complete. All seven behavioral dimensions remain pending until explicit
matrix declarations are reviewed; a passing causal case alone does not fill a complete matrix.

These are declarations bound to source hashes, not records that oracle execution passed. Behavioral
claims still require the separate passing native/recursive gates for the matching profile and
evidence. Windows evidence does not satisfy the deferred normative Linux gate.

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
