# Compatibility contract

NativR reports five evidence levels: parse, API, result shape, numeric, and behavioral. A function
is never described beyond the highest level covered by automated tests and conformance cases.
Capabilities are versioned by NativR semver and `languageSubsetVersion`; protocol changes have their
own version.

| Area                                                   | Status            | Evidence boundary              |
| ------------------------------------------------------ | ----------------- | ------------------------------ |
| literals, assignment, arithmetic                       | Supported         | behavior tests                 |
| vector recycling and warning                           | Supported         | behavior tests                 |
| closures, lexical capture, lazy arguments              | Supported         | behavior tests                 |
| `c`, `length`, `mean`, `is.na`, `is.nan`               | Behavioral subset | checked-in cases/tests         |
| `sum`, `sqrt`, `abs`                                   | Numeric subset    | focused unit/integration tests |
| if, loops, return, subset, namespace, formula, pipe    | Parsed            | explicit unsupported error     |
| data frames, packages, graphics, S3/S4, files, network | Unsupported       | capability manifest            |

Numeric conformance uses explicit absolute and relative tolerances; foundation cases currently use
zero tolerance. Warning presence, stable code, ordering, missing positions, and visible status form
part of behavioral evidence. Message wording is equivalent in meaning, not byte-identical.

Deliberate divergences include no partial argument-name matching, ellipsis, general attributes,
control-flow evaluation, replacement functions, complex values, or dynamic evaluation. Future
adapters must declare their exact reference package/version, exports, evidence level, tolerances,
and unsupported behavior.
