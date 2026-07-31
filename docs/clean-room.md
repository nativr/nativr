# Clean-room policy

NativR is an independent Apache-2.0 implementation. It does not incorporate, translate, link, or
derive implementation code from GNU R, webR, or R packages merely to reproduce their behavior.

Permitted evidence:

- public language and package documentation;
- published mathematical or statistical definitions;
- public APIs and specifications;
- black-box input/output observations from a separately installed R runtime;
- permissively licensed dependencies after license review.

Versioned public catalogs may be recorded as compact observable data when their order, values, and
selection behavior are independently reproduced from documentation and black-box outputs. Such
catalogs must identify provenance and must not be extracted from implementation source.

Prohibited without explicit legal and maintainer review:

- copying or mechanically translating GNU R or GPL package source;
- using webR or GNU R as a shipped implementation dependency;
- copying tests when their license is incompatible or provenance is unclear;
- implying affiliation or using official R branding.

Semantic contributions must identify their behavioral sources, add independently written tests and
conformance cases, and update the compatibility contract. The optional R oracle records canonical
type/value/warning observations only; it never copies implementation source. Reviewers must reject
unexplained large translations or suspiciously source-shaped changes and escalate uncertain
provenance before merging.

Serialization work may use the public R Internals serialization description and black-box byte
outputs from a separately installed R process. Small byte fixtures must record that provenance and
cover only observable interchange behavior. GNU R serializer/deserializer source, headers, tests, or
mechanically translated control flow are not implementation inputs.

Unmodified third-party source packages may be downloaded transiently in opt-in external execution
tests to prove that the package loader works without package-specific rewrites. Those sources are
test inputs under their own licenses: they are not copied into this repository, translated into the
runtime, or treated as implementation evidence. A package artifact used by an application likewise
retains the package's license independently of NativR's Apache-2.0 runtime.
