# Callable and domain inventory

The generated [inventory](../compatibility/callable-domain-inventory.json) joins the observable GNU
R export snapshot, runtime registrations and recursive causal case links by exact, case-sensitive
`package::name`. It contains every binding in their union. The thirteen domain requirements are
maintained in [semantic-domains.json](../compatibility/semantic-domains.json), with explicit
assignments and gaps in
[callable-domain-annotations.json](../compatibility/callable-domain-annotations.json).

## Current scope

At profile 0.387, the inventory contains 2,553 bindings: 2,525 reference exports and 28
registrations absent from that export snapshot. There are 823 registrations and 795 exact qualified
overlaps. The existing 796 distinct-name overlaps measure a different relationship: registering a
name in one namespace does not establish the binding in another namespace.

All 169 bindings with existing causal links have explicit domain assignments. Reviewed purpose
assignments add 430 bindings from graphics, graphics devices and object-system methods, and 572
previously unclassified owned registrations. The bounded formatC increment adds one assignment. The
classified total is 1,353, including all 823 registered bindings. Another 1,200 reference bindings
remain classification-pending. Assignments may span domains, so per-domain counts cannot be summed.

Nineteen bindings have 107 reviewed, partial behavioral-dimension declarations. Each declaration
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

### Distribution reference callables

A separate
[purpose review](../compatibility/callable-purpose-evidence/stats-distributions-4.6.1.json) assigns
65 unregistered stats bindings across 23 documented distribution families to numeric and vector
semantics. Inputs were only the installed GNU R 4.6.1 public help titles and aliases, joined against
the already recorded callable export inventory. No function bodies, examples or behavior outputs
were used, and existing assignments were preserved.

The review covers univariate densities/probabilities/quantiles and sampling, rank-statistic and
Smirnov distributions, multivariate counts, coincidence probabilities and Wishart matrix sampling.
Parameter rules, tails/log scales, vector and matrix shapes, numerical accuracy, RNG state/draw
ordering, errors and metadata remain explicit work. Documentation establishes purpose; none of these
65 bindings receives a runtime registration, causal link, behavioral dimension or exclusion.

### Date and time reference callables

The [date/time purpose review](../compatibility/callable-purpose-evidence/data-time-4.6.1.json)
assigns 119 unregistered reference bindings in 26 families, using 32 public help topics. It covers
Date/POSIX/difftime methods, calendar sequences and components, timezone and timestamp helpers, and
time-series representation, alignment and sampling metadata. These assignments add no behavior
evidence, registrations, exclusions or complete dimensions. All prior assignments are preserved.

Calendar/DST/locale behavior, storage and attributes, class dispatch, missing values, arithmetic,
display, host capabilities and complete behavioral matrices remain explicit work. Internal-only or
ambiguous helpers, deprecated frame conversions and unrelated fitting/graphics remain pending.

### Owned registered callables

An additional 572 assignments cover 441 base, 76 stats and 55 utils bindings in 60 purpose families.
Exact owner-qualified names were checked against the generated inventory and owned registrations;
existing annotations and evidence were preserved. Case-sensitive identities such as NCOL/ncol and
NROW/nrow remain distinct. There are no registered datasets callables; utils::data is classified as
the registered resource loader. These assignments do not infer an unimplemented reference binding's
behavior from its name.

| Reviewed families                                                    | Purpose and retained gaps                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arithmetic, reductions, matrices, sequences, probability and RNG     | Owned operator/numerical implementations identify numeric and vector domains. Exceptional values, precision, shapes, coercion, RNG and platform behavior need complete evidence.                                                                               |
| Complex values, type constructors, missingness and equality          | Runtime value helpers identify value/numeric/vector domains. Component NA provenance and complete coercion, equality and attribute matrices remain open. identity is separately assigned to calls/promises and values because it forces and returns its input. |
| Indexing, attributes, shapes, ordering, sets and iteration           | Owned storage and callback paths identify vector behavior and calls/promises. Registration supplies no complete error, side-effect or identity evidence.                                                                                                       |
| Raw/encoding, text, regex, Roman and hexmode values                  | Character and class helpers identify vector, data and object behavior. Locale, encoding, pattern and dispatch limits remain explicit.                                                                                                                          |
| Parsing, deparsing, control, calls, source metadata and debugging    | Owned AST/evaluator helpers identify language and calls/promises. Source metadata and delayed assignment additionally involve environments; debugger interaction retains its host boundary.                                                                    |
| Environments, namespaces, package state and native interfaces        | Binding and loader code distinguish lexical state from package execution. Native interfaces retain explicit I/O/platform work.                                                                                                                                 |
| Conditions and restarts                                              | Construction, signalling, handlers, restarts and presentation map to conditions, with complete condition shape/order/call behavior still unfinished.                                                                                                           |
| Files, connections, serialization, host services and memory          | Virtual I/O and host-capability paths identify I/O/platform and data responsibilities. No assignment is a platform exclusion.                                                                                                                                  |
| Calendar/time, categorical, tabular and time-series values           | Owned conversion and data structures identify data/time with vector, object or numeric responsibilities. Malformed structures, attributes, dispatch and numerical boundaries remain open.                                                                      |
| Classes, extension objects, models, formulas and plots               | Owned dispatch and model paths distinguish object systems, numerics, language and graphics. Formula construction is language/environment work; model.matrix additionally performs numeric design-matrix work.                                                  |
| Utils metadata, documentation, datasets, tables and namespace access | Resource/loader and namespace helpers distinguish core namespaces, packages, data and environment responsibilities. Dependency and host boundaries remain unfinished.                                                                                          |
| Object inspection and person metadata                                | Owned member/environment, recursive presentation, resource and structured-class helpers identify their respective domains; complete reflection and identity evidence remains open.                                                                             |

Review inputs are the owner-qualified registration map, baseBuiltins and first-class operator
tables, and owned implementations in builtins.ts, operators.ts, person.ts, roman.ts, hexmode.ts and
sequences.ts. Each assignment retains specific remaining gaps and an unfinished behavioral matrix.
This review adds no executable case, causal link, matrix declaration or completion claim.

## Bounded behavioral review

Explicit-selector forwarding adds seventeen evidence links to nine existing UseMethod/NextMethod
dimensions, preserving all prior evidence and the total of 107 partial dimensions on nineteen
bindings. Selected actual values, forcing, call metadata and reference continuation are covered;
omitted selectors, arbitrary selector objects, visibility and complete S3 behavior remain open.

Five S3 callable matrices add 21 partial dimension links for implicit search chains, class history,
selected forcing and returned-reference behavior. Four dimensions merge with existing as.POSIXct
evidence; the other seventeen are new declarations. Explicit selector/default/missing corners,
complete errors/visibility and S4/internal/group interactions remain unfinished. Existing evidence
is preserved and no new callable registration or completed matrix is claimed.

Seven date/time callable matrices add 42 partial dimensions for the shared UTC/GMT POSIXlt
converter, lazy as.POSIXct routes and numeric predicates. Evidence includes actual epochs, storage,
masks, names, attributes, dispatch/forcing/warning order and shared reference results. Native range,
non-scalar origin, full implicit class-chain, parsing and timezone gaps remain explicit. The owned
range-rejection case supplies no differential matrix or platform-exclusion credit.

The sprintf declaration adds six partial dimensions for ordinary directives/recycling, nonfinite and
precision boundaries, forcing errors, basic attribute loss, visibility and side effects. It does not
claim identity evidence. Native byte-field semantics, complete grammar/diagnostics and coercion
matrices remain unfinished; NativR-only resource cases are deliberately excluded from differential
matrix credit.

The formatC declaration links all seven dimensions to its owned foundation and recursive cases:
ordinary conversions, precision/width boundaries, diagnostics, numeric/character attributes,
visibility, forcing effects and reference identity. Every dimension remains partial. Optional
formatting controls, locale/display widths, malformed/classed inputs and high-precision Windows
oracle differences retain explicit gaps; the complete matrix and normative Linux verification remain
unfinished.

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
