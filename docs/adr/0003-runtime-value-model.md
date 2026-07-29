# ADR 0003: Typed vectors and explicit missing masks

- Status: accepted
- Date: 2026-07-28

## Context

JavaScript primitives and arrays cannot represent R scalar-as-vector behavior or distinguish NA from
NaN reliably.

## Decision

Use typed atomic vectors with independent missing masks, immutable values, mutable lexical
environments, closures, and memoizing lazy promises.

## Alternatives considered

Loose JavaScript primitives, a single NaN sentinel, boxed per-element objects, and an early custom
memory manager.

## Consequences

Semantics are explicit and future columnar kernels fit naturally. Conversion is required at public
and Worker boundaries; future copy-on-write remains possible.
