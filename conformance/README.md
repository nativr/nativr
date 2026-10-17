# Conformance

Package-check DESCRIPTION structure has separate independently authored evidence in
`packages/package-tools/test/description-check.test.ts`, including opt-in native GNU R identity
diagnostics. This tooling policy is not counted as additional runtime conformance cases or callable
compatibility. Full metadata validation remains unexecuted in package reports.

Checked-in cases describe the exact source, expected friendly result, warning presence,
compatibility level, and numeric tolerance. `foundation.json` covers R expressions;
`package-loader.json` adds isolated NativR-only package-bundle cases, including expected load
errors. `pnpm conformance` runs both without GNU R. `pnpm conformance:r` optionally invokes a local
`Rscript --vanilla` as a black-box oracle for eligible foundation cases and compares canonical type,
length, value, visibility, and warning presence.

`oracle-v2.json` is a separate recursive graph gate run with `pnpm conformance:r:v2`. Its exact
cases compare nested values, attributes, direct environment bindings and reference identity against
GNU R 4.6.1. Case-level graph assertions check intended edges on both sides before comparison. The
release-gating commands require GNU R 4.6.1; `NATIVR_ALLOW_NON_NORMATIVE_R=1` permits an advisory
run against another installed version.

An exact case may list `bindingEvidence` as qualified names such as `base::data.frame`. The status
generator accepts a link only when it names one unambiguous behavioral binding in the NativR
capability manifest and one callable GNU R export. The live v2 runner additionally shadows each
linked name in the case's lexical scope. Both runtimes must hit a sentinel error, and replacing the
call with a successful alternate value must change each recursive observation. A linked binding has
evidence only for the listed cases; the count does not imply complete function behavior.

Replacement-reflection cases retain the original RHS syntax and evaluate reflected call values
inside the active replacement frame. GNU R can embed opaque promises in escaped replacement calls;
the observer rejects those values explicitly rather than deparsing them. The v2 runner checks this
rejection against the normative oracle before running the comparison suite.

Closure-rendering cases retain complete formals/body language graphs together with their rendered
line vectors. A separate case pins stdout for a named closure environment and attributes, including
the invisible return from `print()`. The causal links for `base::deparse` and `base::print`
establish these sampled behaviors; they do not cover retained source text, bytecode labels,
anonymous environment addresses, every deparse control, or every line-wrapping boundary. Foundation
closure-print cases explicitly evaluate in `globalenv()` when the expected output omits an
environment footer. The live oracle otherwise isolates cases in an anonymous child environment,
whose process address is intentionally outside those exact text comparisons.

Table-rendering cases retain complete integer counts, dimensions, dimension names, and class
attributes. They pin one-dimensional headings from symbol, compound, and explicitly named inputs,
zero-extent display, and invisible print returns. These sampled cases do not establish factor-level
ordering, unused-factor-level retention, or the remaining table construction options.

Numeric-reporting cases retain `all.equal()` error attributes, callback side effects and visibility,
scalar/vector scales, and equal/missing input contributions. Formatting cases cover session options,
array metadata, stdout and virtual file output. The linked `all.equal`, `format`, and `cat` cases
establish these sampled behaviors; general method dispatch, complex formatting, locale typography,
and the remaining output controls are not inferred from them.

Condition-accessor cases retain owned calls, messages, missing/unusual fields, caller-local S3
methods, and method visibility. The package-check observer fixtures separately compare ordered
conditions with a native GNU R session and verify that removed observers cannot establish complete
evidence. Broader condition dispatch and consumed conditions remain outside those sampled claims.

Embedded-value cases compare full call/value graphs, ordered attributes, dimensions and dimension
names, and call text from replacement conditions alongside the evaluated replacement value. Raw
oracle promises remain explicitly rejected; these cases do not establish promise identity.

R is development tooling only. No reference output or R implementation code is shipped in the
runtime. New semantic claims require a focused case here and a corresponding unit or integration
test.

The foundation runner accepts `expectedError` code/message checks for owned failure boundaries.
Constructed-syntax depth cases use this path with `rOracle: false`: NativR's finite resource guard
is tested without claiming GNU R has the same limit.

The native recursive oracle emits JSON strings as ASCII Unicode escapes, including surrogate pairs
for supplementary code points. This preserves observed Unicode independently of C-locale printing.
The string-escape graph case includes an astral character to exercise that transport; invalid UTF-8
cannot silently become a printable placeholder in the JSON serializer.

Bytes-marked character values and list tags use a `character-bytes` token containing their raw byte
integers. They are not decoded as Unicode. The unlist encoding fixture also observes Encoding and
charToRaw explicitly for inherited Latin-1 names and composed UTF-8 names. Expression payloads are
inspected through as.vector with list mode while retaining their expression type and recursive
elements; this observation path does not establish expression indexing support.

Process-time cases use independently constructed values to compare summary types, names, missing
values, child-time aggregation, method formals and invisible print returns. Fixed-value stdout is
compared exactly. The cases do not equate real CPU or elapsed measurements across platforms.

### Complex infinity observation

The recursive observer emits a complex-components token when a non-missing complex scalar has an
infinite or signed-zero component. Each component uses the existing double token grammar, so its
position and infinity sign survive JSON serialization. Ordinary finite complex tokens remain
unchanged. Independent assertions pin all four real/imaginary positive/negative infinity cases, and
a recursive case now compares complex infinities directly. The existing complex-na token still
collapses missing complex components; distinct NA/NaN component payloads remain an observer gap.
This changes conformance evidence, not the runtime semantic profile.

### Complex NaN observation

Complex values for which is.nan is true now retain separate real and imaginary double tokens,
including NaN positions, instead of being collapsed into complex-na. Independent expected-token
assertions cover each single-NaN position and both components. Non-NaN complex NA values retain the
historical collapsed token: component-specific NA storage and observation remain incomplete. This
tightens oracle evidence without changing the runtime semantic profile.
