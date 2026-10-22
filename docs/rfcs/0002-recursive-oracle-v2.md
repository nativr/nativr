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
- language-call structure, closure formals/body, and direct observable environment bindings;
- ordered conditions with kind, classes, message, and call;
- separate stdout, stderr, and message streams plus result visibility;
- RNG state when a case declares it relevant.

The GNU R process emits an independently defined observation graph. GNU R private serialization is
not the comparison format.

Environment nodes enumerate direct binding names in sorted order. Ordinary bindings point to nodes
in the same graph, so an environment containing itself or two environments containing each other
retain their reference identity. Active bindings are marked but not read, because reading one can
run arbitrary code. The observer does not traverse parent environments, and limits each observed
environment to 128 direct bindings. Reading an ordinary binding may force a promise; cases must
avoid side-effectful promises until the observer can model them separately.

Raw promise objects can also appear as elements of replacement calls returned by `sys.call()` or
`match.call()`. GNU R 4.6.1 exposes these elements as `typeof == "promise"`; they are not ordinary
numeric call arguments even when the replacement value has been forced. The observer rejects this
type explicitly before attempting a fallback deparse, which can fail to terminate on an escaped
promise. No placeholder graph is accepted as exact evidence for these objects. Their source, cached
value, environment, and forcing behavior need a separate observation contract. The replacement cases
therefore retain the original and substituted expression nodes, evaluated values, and evaluation
counts. Direct and S3 methods also evaluate and store call arguments before returning; these stored
values do not establish compatibility of the escaped raw call objects. The live gate separately
checks escaped `sys.call()` and `match.call()` replacement results under GNU R with a fifteen-second
process timeout each, requiring the explicit unsupported-promise failure. These rejection checks are
observer preflights and do not increase the exact case count.

Cases may declare `graphAssertions`: `paths` require reachable nodes, `sameNode` and `differentNode`
compare pairs of graph paths by observation-local ID, and `activeBindings` require a named active
binding with no observed value. Paths start at the result node, follow list tags or environment
binding names, and use `@environment` to enter a closure's environment. Assertions run against both
GNU R and NativR observations before comparing the full graph; they prevent a case from passing if
both observers accidentally omit its intended reference edge. `observationAssertions` similarly pins
expected outcome, ordered condition records, visibility, or individual output streams when a case
exercises those channels, so a shared omission cannot pass as exact equality.

Cases may associate an exact observation with a qualified, manifest-registered behavioral binding
through `bindingEvidence`. The status generator validates that the binding is also a callable GNU R
export and that its unqualified name has a unique owner on both sides. The live gate shadows each
linked name in the case's lexical scope with a sentinel error, requiring both runtimes to reach it.
It then substitutes a successful alternate value and requires the recursive observation to change on
both sides. These controls prevent an unused or irrelevant call from increasing the count. The count
is limited to the linked case behavior, not complete compatibility of those functions.

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

Current exact-case and causal-link counts are generated in
[canonical status](../../compatibility/status.json). The maintained cases cover nested arbitrary
attributes, data frames, scalar missingness and non-finite boundaries, stdout with invisible return,
shared environment identity, self and mutual environment cycles, active binding observation without
evaluation, nested and matched language-call structure with unexpanded dots, tagged pairlists with
nested language and missingness, closure formals/body/environment capture, returned simple error and
custom warning conditions, signalled simple and custom errors and warnings, message output, two
ordered warnings with separate streams, a warning before a signalled error, and calls supplied by
conditions or captured from nested callers, and replacement RHS reflection through direct closures,
S3 methods, escaped captured frames, and nested reconstruction. Closure-rendering cases compare
complete formals/body language graphs alongside the printed and deparsed line vectors, and pin the
stdout ordering of a named closure environment and arbitrary attributes plus the invisible print
return. Table-rendering cases retain counts and all table attributes while pinning symbol, compound,
and explicit axis headings, zero-extent output, and invisible print returns. Factor-level
construction and additional table options remain outside those sampled claims. Numeric-reporting
cases preserve error attributes, callback side effects, scaling controls, session formatting
options, array metadata, and stdout/file output with visibility. Condition-accessor cases retain
owned fields, caller-local methods, and method visibility. Embedded-value cases retain full
call/value graphs, ordered attributes, names and dimensions, and replacement-condition call text
plus its evaluated replacement value. Raw oracle promises remain rejected. Qualified binding links
and their case IDs are recorded in canonical status; the live gate checks each link with causal
controls. The condition cases pin simple warning and error classes, custom condition classes,
messages, order, null calls when `call. = FALSE` including within a nested caller, explicit non-null
language calls, and nested caller calls. The NativR observer captures builtin warning conditions
through the public `globalCallingHandlers()` behavior. Automatic use of custom condition accessors
while signalling/printing conditions remains incomplete, as do warnings that bypass condition
signalling, interrupts, or every condition shape. RNG and migration of the remaining behavioral
surface are also pending; v1 remains the broad regression gate.

### Complex infinity observation

The recursive observer emits a complex-components token when a non-missing complex scalar has an
infinite or signed-zero component. Each component uses the existing double token grammar, so its
position and infinity sign survive JSON serialization. Ordinary finite complex tokens remain
unchanged. Independent assertions pin all four real/imaginary positive/negative infinity cases, and
a recursive case now compares complex infinities directly. This changes conformance evidence, not
the runtime semantic profile.

### Complex NaN observation

Complex values for which is.nan is true now retain separate real and imaginary double tokens,
including NaN positions, instead of being collapsed into complex-na. Independent expected-token
assertions cover each single-NaN position and both components. This tightens oracle evidence without
changing the runtime semantic profile.

### Mixed complex NA observation

Complex scalar tokens observe real and imaginary components separately. The historical `complex-na`
token is retained only when both component tokens are `double-na`; any mixed NA/finite, signed-zero,
infinity or NaN pair uses `complex-components`. The native observer preflight pins all 49 ordered
pairs of finite, signed-zero, NA, NaN and signed-infinity components, plus the whole-`NA_complex_`
token. These preflights do not increase the exact case count or give runtime binding credit.
Untagged raw complex values in a graph payload are rejected by the JS decoder, matching the native
encoder's tagged-value boundary.

This repairs an observer blind spot without asserting NativR mixed-component NA storage parity.
Construction, storage, arithmetic and public snapshot fidelity for those values remain unfinished
and require separate implementation and Worker evidence. No runtime semantic-profile or public
protocol change follows from this observer repair.

Missing list names use null in the redundant `tags` summary, keeping the JSON payload representable.
Their exact NA identity remains recorded in the recursively observed `names` attribute, distinct
from an absent names attribute or empty string. The `subset-name-missingness` fixture exercises this
boundary on native R and NativR.

### Byte strings and expression payloads

Bytes-marked character scalars and list tags use a `character-bytes` token with raw byte integers.
This keeps arbitrary byte sequences exact while the ordinary text transport continues to reject
invalid UTF-8. Explicit Encoding and charToRaw observations supplement the text tokens when encoding
marks and source bytes are part of the contract. Expression payload traversal uses as.vector in list
mode and retains the original expression type, attributes, tags, and recursively observed elements.
