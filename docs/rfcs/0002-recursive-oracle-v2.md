# RFC-0002: recursive oracle format v2

Status: **accepted; implementation in progress**

## Problem

The v1 oracle compares flattened atomic values, visibility, a warning boolean, and combined output.
It cannot prove nested lists, arbitrary attributes, condition order, language objects, or reference
identity. Curated scalar extraction can therefore pass while the returned object is wrong.

## Observation contract

Oracle v2 produces a versioned evaluation observation with:

- outcome: value, error, or interrupt;
- a cycle-safe node graph with stable observation-local IDs;
- `typeof`, length, exact scalar tokens, elements, pairlist tags, and arbitrary named attributes;
- language-call structure, closure formals/body, and observable environment references;
- ordered conditions with kind, classes, message, and call;
- separate stdout, stderr, and message streams plus result visibility;
- RNG state when a case declares it relevant.

The GNU R process emits an independently defined observation graph. GNU R private serialization is
not the comparison format.

## Exactness policies

Every v2 case declares one of `exact`, `bitwise`, `ulp-bounded`, `absolute-relative`, `structural`,
`statistical`, `platform-adapted`, or `explicit-deviation`. Tolerances are invalid unless the
selected policy accepts them. Platform adaptations must identify the matching entry in RFC-0001.

## Rollout

1. Land the schema, validator, and atomic/list/attribute observers.
2. Gate foundational pull requests on the v2 subset while retaining v1 regression coverage.
3. Add conditions, language values, closures, environments, shared references, cycles, and RNG.
4. Migrate every behavioral claim; retire scalar-extraction workarounds only after equivalent v2
   evidence exists.

The current gate completes the first rollout slice with five exact cases: nested arbitrary
attributes, data frames, shared environment identity, nested language-call structure, and closure
formals/body/environment capture. Conditions, cycles, RNG, and migration of the remaining behavioral
surface are still pending; v1 remains the broad regression gate.
