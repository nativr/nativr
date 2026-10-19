# @nativr/package-tools

`inspectPackageDescription(text)` reports versioned structural checks for a single DCF record,
required field presence, package-name/version grammar, dependency-list syntax and strict Title/
Description terminal punctuation and reserved Priority values (`description-structure-v3`). Native
diagnostic fixtures cover Depends, Imports, Suggests and Enhances constraints, including spacing,
version components, trailing commas and R revision syntax. LinkingTo retains the separate
package-loader syntax check; native structural diagnostic equivalence is not claimed for it. The
independent rules follow
[Writing R Extensions](https://cran.r-project.org/doc/manuals/r-release/R-exts.html#The-DESCRIPTION-file).
Each result is passed, failed, or unexecuted. `Authors@R`-derived Author/Maintainer fields remain
unexecuted until their value is evaluated and validated; the inspector never executes that source.
License validity, maintainer address validation, prose quality and other field rules remain outside
this structural policy. `package:check` includes the assessment and credits only executed checks; it
does not infer full metadata-stage completion from them.

Build-time tools for inspecting standard R source-package directories or `.tar.gz` archives and
producing deterministic, JSON-serializable NativR package artifacts.

```sh
nativr-package inspect ./mypackage
nativr-package pack ./mypackage --output mypackage.nativr.json
nativr-package install pkgconfig --output packages.json
nativr-package verify mypackage.nativr.json
nativr-package resolve dependency.nativr.json mypackage.nativr.json --output packages.json
```

`Collate`, `Collate.unix`, `Collate.windows`, portable UTF-8/Latin-1 package encodings, and
platform-specific `R/unix` or `R/windows` sources are applied during packaging. The deterministic
default is `--source-platform unix`; select `--source-platform windows` when that is the intended
browser package variant.

The generated package set exposes `bundles`, which can be supplied directly to
`createR({ packages: packageSet.bundles })`. Packaging is a build-time operation; the browser
runtime remains network-free and does not execute host installation scripts.

The artifact preserves `inst/`, `data/`, demo, license, and `R/sysdata.rda` resources. It also
extracts topics, aliases, titles, and controlled code from `man/*.Rd` example sections into a
deterministic internal manifest. At runtime, `utils::example()` can return or execute that code,
including opt-in `run.dontrun` and `run.donttest` sections, without bundling an Rd parser or GNU R;
installed `inst/doc` R Markdown, Sweave, prebuilt HTML/PDF, and extracted R vignette files receive a
separate deterministic index consumed by GNU R-shaped `utils::vignette()` discovery; `utils::data()`
can load package `data/*.R`, `.csv`, `.tab`, `.txt`, `.rda`, and `.RData` entries; the namespace
loader installs XDR/gzip `R/sysdata.rda` before evaluating R source. Unsupported serialized graph
types/compressors and installed `.rdx`/`.rdb` lazy-load databases remain explicit compatibility
boundaries.

`install` resolves `Depends` and `Imports` from a CRAN-like source repository and emits an
integrity-locked package set. `pack` accepts only an install surface that can be represented safely.
It rejects native code, JVM code, symbolic links, installation hooks, unsafe archive paths,
`LinkingTo`, `useDynLib`, and unsupported NAMESPACE directives. A successful package artifact is
still marked `execution: "unchecked"` until NativR loads it and package-specific executable tests
pass.

For a metadata-only dependency survey, call `preflightPackagesFromRepository()` at build time:

```ts
import { preflightPackagesFromRepository } from "@nativr/package-tools";

const plan = await preflightPackagesFromRepository(["lifecycle"]);
console.log(plan.packages.map(({ name }) => name)); // dependency-first order
console.log(plan.firstBlocker); // e.g. a native-code dependency
```

Preflight fetches only the bounded `PACKAGES.gz` or `PACKAGES` index. It reports missing or
incompatible dependencies and metadata-declared native, `LinkingTo`, or OS restrictions without
downloading archives. `indexIntegrity` can be supplied on a later call as `expectedIndexIntegrity`
to reject changed repository metadata. Its `sourceArchiveIntegrity: "unverified"` is intentional:
preflight does not verify source-archive SHA-256, inspect NAMESPACE or source contents, construct
artifacts, or establish a P0 corpus tier. Corpus admission still requires separately pinned and
verified source-archive and artifact digests.

## Source-package examples

`runPackageExamples()` verifies a source archive digest and package identity, inventories every
indexed `man/*.Rd` example topic, and passes default-applicable code to a caller-owned R evaluator
in path order. Attach the package to the evaluation session when its examples use unqualified
exports:

```ts
import { runPackageExamples } from "@nativr/package-tools";

await session.eval('library("mypackage")');
const report = await runPackageExamples(
  "./mypackage_1.0.0.tar.gz",
  ({ source }) => session.evalDetailed(`${source}\ninvisible(NULL)`),
  {
    expectedSourceSha256: "<64 lowercase hex digits>",
    expectedPackage: { name: "mypackage", version: "1.0.0" },
  },
);
console.log(report.outcome, report.firstBlocker);
```

The appended `invisible(NULL)` only keeps a final R closure or other non-serializable example result
from crossing the public JavaScript boundary. The example statements still run in order. The report
counts runnable, `\\dontrun{}`, and `\\donttest{}` blocks for each topic and stops on the first
evaluator error. A selected `paths` subset with runnable code reports `partial`. An archive with no
example topics or no selected default-applicable blocks reports `no-examples` or `no-applicable`;
none of these outcomes establishes P5. The runner uses the portable Rd extraction already used by
`example()`. It does not claim full Rd conditional-macro processing or `R CMD check` behavior. Raw
`man/*.Rd` files stay out of the browser artifact; the extracted example manifest is packaged for
`example()`.

## Source-package tests

`runPackageTests()` reads top-level `tests/*.R` scripts from an audited source directory or archive
and passes their unchanged text to a caller-owned R evaluator in deterministic path order. The
caller supplies an already loaded session and can pin both the archive SHA-256 and package identity:

```ts
import { runPackageTests } from "@nativr/package-tools";

const report = await runPackageTests(
  "./mypackage_1.0.0.tar.gz",
  ({ source }) => session.evalDetailed(source),
  {
    expectedSourceSha256: "<64 lowercase hex digits>",
    expectedPackage: { name: "mypackage", version: "1.0.0" },
  },
);
console.log(report.outcome, report.firstBlocker);
```

The report lists all discovered entrypoints, nested R test files, saved-output expectations, and
executed scripts. Each callback also receives the exact paired `.Rout.save` text as `expectedOutput`
when present. A selected `paths` subset reports `partial`; no test entrypoint reports `no-tests` or
`no-entrypoint`. The runner stops on the first evaluator error. Callers that need Rscript-style
continuation can opt into
`session.evalDetailed(source, { topLevelErrorHandling: "option", printVisibleTopLevel: true })` and
reset the session between test scripts. The opt-in mode continues only when a top-level error has a
callable `options(error=)` handler; it returns those errors in `topLevelErrors`.

The runner does not silently execute nested testthat files, compare `.Rout.save` output, mount
auxiliary test fixtures, or represent a complete `R CMD check`. An empty or partial run does not
establish P6 corpus evidence. Test sources stay out of the packaged browser artifact.

For a separate, bounded saved-output diagnostic, call `comparePackageSavedOutput()` inside the test
callback with the script, captured output, and explicit options. Set `policyVersion: 1` to pin the
comparison semantics. The required `expectedFormat` is `"rout-save-source-echo"` for a saved R
transcript or `"display-only"` for text without echoed source. In Rout mode, it removes only `> ` or
`+ ` lines matching the next source line, plus a final bare prompt; an unrelated user-output line
beginning with `>` stays. The required `comparison` is `"exact-text"` for decoded display text or
`"display-whitespace"` for the weaker diagnostic used by the pinned `abind` probe. That mode
normalizes CR/LF line endings and ASCII space/tab runs and ignores lines containing only those
characters while retaining other printed text and error traces.

The versioned report (`schemaVersion: 1`, `policyVersion: 1`) gives `match`, `mismatch`, or
`no-expectation`, the number of source-echo lines removed, and the first UTF-16 text difference with
bounded excerpts. Inputs have a combined 64 MiB limit, and each text has a 250,000-line limit. Text
alone cannot distinguish an echoed source line from user output identical to that next source line.
The helper does not establish byte-level `.Rout.save` identity or a complete `R CMD check`; callers
must record their selected policy and evaluate remaining package-check stages separately.

## Package-check evidence and repository CLI

`comparePackageCheckObservation()` compares separately captured NativR and GNU R observations. An
observation includes execution status, fresh-session evidence, stdout, stderr, ordered conditions,
and explicit output/condition completeness flags. Condition records preserve their kind, classes,
message, call when available, and whether an error was handled. Optional `outputOrder` records
cross-stream ordering only when the observer actually captured it.

```ts
import {
  comparePackageCheckObservation,
  createPackageCheckReport,
  PACKAGE_CHECK_STAGES,
  type PackageCheckEvidence,
  type PackageCheckObservation,
} from "@nativr/package-tools";

function compare(actual: PackageCheckObservation, expected: PackageCheckObservation) {
  return comparePackageCheckObservation(actual, expected, {
    policyVersion: 1,
    adaptations: [],
  });
}

function summarize(evidence: PackageCheckEvidence) {
  const report = createPackageCheckReport(evidence);
  return {
    stages: PACKAGE_CHECK_STAGES,
    eligible: report.p7Eligible,
    blocker: report.firstBlocker,
  };
}
```

Policy 1 compares exact decoded text, preserving whitespace and identity-bearing output. It retains
both `rawDifference` and `adaptedDifference`. Its sole permitted adaptation, `oracle-text-crlf-v1`,
reverses a separately probed native LF-to-CRLF text transport on the oracle streams. The probe must
demonstrate the exact transformation of LF, literal CRLF, bare CR, and repeated CR before LF on both
stdout and stderr. Reversal removes one added CR per CRLF pair; literal carriage returns survive.
The report records the probe bytes and transformed-pair counts. The policy does not remove bytecode
addresses, host-identity lines, numeric differences, or arbitrary whitespace. A missing oracle
observation reports `no-expectation`.

`createPackageCheckReport()` aggregates caller-supplied evidence; it does not run checks. Its
versioned report includes source/archive, artifact, and capability SHA-256 provenance, GNU R
version, semantic profile, effective runtime limits, observations, and the fixed stage inventory
exported as `PACKAGE_CHECK_STAGES`. Each stage has discovered/executed items, a reason, and a
`passed`, `failed`, `unexecuted`, or `inapplicable` status. Missing stages, partial inventories,
unobserved stream ordering, and incomplete condition records remain blockers. A matching output
comparison alone does not establish P7.

The repository provides a separate opt-in command after building:

```sh
pnpm build
pnpm package:check --package abind --output ./package-check-abind.json --rscript /path/to/Rscript
```

This command accepts only an artifact-pinned development or regression entry from
`compatibility/package-corpus.json`; it preserves the holdout partition. It downloads the pinned
source archive, or accepts a local archive with `--source`, and verifies both source and artifact
digests. GNU R must be exactly 4.6.1; `--rscript` defaults to `NATIVR_RSCRIPT`, then `Rscript` on
PATH. The oracle is a separately installed executable used only by repository tooling and is not
part of the published browser runtime or the `nativr-package` CLI.

For each selected test or example, the command creates fresh GNU R and NativR sessions. GNU R
installs the verified archive into an isolated temporary library. Native Rscript executes the
unchanged top-level test text between observation probes, preserving ordinary visible printing,
warnings, and returning `options(error=)` handlers. Examples run their extracted applicable code
with an explicitly recorded `library()` setup. Both runtimes receive a recorded final
`invisible(NULL)` harness expression, preserving source-expression auto-printing while keeping a
final closure or other non-data value out of the JavaScript result boundary. Test fixtures are
copied into fresh working directories; current NativR mounting requires UTF-8 bytes that round-trip
exactly through virtual file writes and reads. The report includes fixture hashes, source hashes,
oracle settings, and capture limitations. Observer prefixes shift native parse-diagnostic line
numbers, which are recorded explicitly.

Repeat `--test tests/name.R` to select test entrypoints and use `--skip-examples` for a targeted
diagnostic. The complete discovered inventory remains in the report, so a selected subset does not
become a full package-check pass. Defaults allow 300 million evaluation steps, call depth 200, 50
million vector elements, 32 million output bytes, and 256 MiB of package resources. The step and
vector limits can be set with `--max-steps` and `--max-vector-length`. Downloads are bounded to 64
MiB; each oracle subprocess has a ten-minute timeout and the same 32-million-byte output cap.

The command writes its JSON report and exits **1 while `p7Eligible` is false**, including when all
selected streams match but other stages remain unexecuted. Current evidence leaves full metadata and
dependency checks, loading lifecycle checks, source/namespace checks, documentation checks, manual
generation, and applicable remaining package stages open. Cross-stream order comes from a second
fresh GNU R session whose stdout and stderr share one file handle. That capture is accepted only
when exactly one alignment with the separate exact streams exists; otherwise `output-order` stays
unexecuted for that script. The NativR harness now observes ordered conditions through
`globalCallingHandlers()`, using generic `conditionCall()` and `conditionMessage()` accessors. It
retains classes, NULL/call text, and returning top-level-handler evidence. Observer state stays in
closure attributes, without adding global bindings. Observation is bounded to 10,000 records and 8
MiB of field bytes; removed observers, overflow, and failed capture remain explicitly incomplete.
The report records observer setup/read hashes and limits. This observes conditions after source
handlers, matching the native oracle boundary; it is not a trace of conditions consumed by those
handlers. Failed evaluations still do not return complete partial output. The command does not claim
complete `R CMD check` equivalence or P7 closure.

The report's `dependencyObservation` records isolated public `getRversion()`/`packageVersion()`
lookups on both runtimes, the probe hash, every declared version constraint, and each outcome. The
check profile requires declared Depends, Imports, LinkingTo and Suggests versions; Enhances entries
are observed but optional. This policy follows the roles described in
[Writing R Extensions](https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Package-Dependencies).
Unavailable lookup results remain distinct from failed or malformed captures. Version availability
does not prove API compatibility or namespace loading. The metadata stage records the lookups as
executed, but broader DESCRIPTION validation and undeclared/transitive dependency analysis remain
unexecuted. A required unavailable or incompatible version fails the stage.

Package admission requires one DESCRIPTION record. Blank or whitespace-only separators cannot
silently join identity or dependency fields from separate records; repository PACKAGES indexes still
accept multiple records. A native fixture verifies the record boundary using GNU R `read.dcf`, whose
[DCF rules](https://stat.ethz.ch/R-manual/R-devel/library/base/html/dcf.html) define blank lines as
record separators. This is a package-admission check, not complete DESCRIPTION validation or general
`read.dcf` compatibility.

`lifecycleObservation` records fresh-session namespace and search-path state before loading, after
`getNamespaceExports()`, after attachment, repeated `library()`, detachment and unloading. Both
runtimes must start unloaded/unattached, load without attaching, attach successfully and retain
exactly one search-path entry, then detach while retaining the namespace and finally unregister it.
Failed or malformed captures cannot pass. These observations mark load, attach, detach and unload
executed. Independently authored native fixtures also compare retries after failing `.onLoad` and
`.onAttach`, including hook counts and namespace retention. Neither fixture evidence nor load/attach
observations establish the full lifecycle stage or P7.

`cleanBaseObservation` separately detaches the default package exports in a fresh session, verifies
the exact base/Autoloads search path and absent unqualified `median`, then loads and attaches the
target. A completed observation credits `base-search-path-load` only. Core namespaces remain loaded;
startup without default namespaces (`clean-base-load`) and full installation validation remain
unexecuted. This distinction prevents an isolated search-path check from claiming full installation
compatibility.

The package-check CLI now records `authorsObservation` under `authors-person-roles-v1` when
Authors@R is present. It compares fresh-session execution and author/creator role predicates with
native GNU R, including first-email handling. Invalid completed evidence fails metadata checks;
incomplete evaluation cannot establish validity. Full metadata validation and P7 remain open.

`authorFieldsObservation` (`authors-derived-fields-v1`) compares derived Author/Maintainer text with
native metadata expansion. Explicit fields take precedence, including present empty fields. Text
equivalence is separate from validity: it cannot establish full DESCRIPTION validation or P7.

`authorMetadataAssessment` (`effective-author-fields-v1`) validates effective Author/Maintainer
presence and Maintainer address syntax using explicit fields or completed matching derivation. The
role observer uses `authors-person-roles-v2` for quoted email local parts. These checks do not
promote full DESCRIPTION validation or P7.

### License structure

`inspectPackageLicense(description, files?, contents?)` checks expressions against a pinned public
GNU R 4.6.1 license catalog, numeric version restrictions, required template references, permitted
extensions, and root LICENSE/LICENCE file presence. Without a file inventory, file-reference
validation is unexecuted. Its `license-structure-v2` assessment is included by `package:check`; only
those structural checks receive execution credit. It does not assess license text, template file
contents, legal rights, dependency-license compatibility or full metadata completion. Catalog
provenance and grammar come from the public license database API and the
[documented license-field specification](https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Licensing),
with independently authored black-box native fixtures. Catalog display labels are retained as data
and are not automatically accepted as expressions.

### Namespace dependency declarations

`inspectPackageDependencyDeclarations(description, namespace)` checks static `import` and
`importFrom` declarations against DESCRIPTION Imports/Depends and the pinned GNU R 4.6.1
base-package catalog. Suggests, Enhances and LinkingTo do not satisfy this check. Its
`namespace-declarations-v3` assessment is included in package reports. Conditional declarations,
escaped package names and computed import controls remain unexecuted; dynamic references and
transitive dependency closure are separate checks. Independently authored fixtures compare the
missing-package set with native package-dependency diagnostics.

Policy v2 admits literal `except` controls and literal `c(...)` exclusion lists in `import`,
including controls before or between packages. Only the exact control name is excluded from package
references. Named package arguments are admitted, and missing names use stable C ordering. No
namespace expressions are executed by the auditor.

Policy v3 follows the native duplicate-control rule: only the first `except` argument is a control;
later arguments with that name are package references.

### DESCRIPTION structural policy v4

The build-time DESCRIPTION assessment checks VignetteBuilder syntax against 30 independently written
native GNU R 4.6.1 fixtures. It accepts ASCII alphanumeric/dot tokens with comma separators,
including the native empty-entry behavior, and rejects embedded whitespace, constraints and other
punctuation. These tokens are not validated as package names by this native diagnostic. Builder
availability, vignette execution and full metadata validation remain separate, incomplete checks.
This changes build-time evidence only; the runtime profile remains unchanged.

### Provided dependency lookup boundary

Local artifact resolution, repository preflight and repository installation consult only explicit
provided-package entries. Valid package names such as constructor, toString and hasOwnProperty must
resolve to an artifact, repository entry or explicitly supplied version; inherited JavaScript
properties never establish availability. Regression fixtures cover missing roots and dependencies,
explicit versions and artifact load order. Runtime semantics and the capability profile are
unchanged.

### Repository installation index pin

Repository installation accepts expectedIndexIntegrity from a preflight result. The CLI exposes
`--expected-index-integrity sha256-DIGEST`. Invalid pins fail before network access; changed index
bytes fail before any archive download. A matching pin continues through ordinary dependency
installation and archive digest checks. Index identity does not establish source archive identity,
package behavioral compatibility or transitive API coverage. Runtime capabilities are unchanged.

### Bounded repository dependency traversal

Repository installation keeps active packages separate from completed artifacts. The package limit
counts each package once, and a cycle fails when traversal returns to an active package. Required
version constraints are checked against available artifact, provided or index versions before
fetching the dependency archive. Source DESCRIPTION remains authoritative for dependency edges.
Tests cover a two-package closure at its exact limit and early cycle, version and limit failures
without unrelated archive downloads. Runtime semantics and compatibility tiers are unchanged.

### Archive and index dependency disagreement

Three independent repository fixtures verify that installation follows the downloaded archive's
DESCRIPTION when its dependency edges differ from PACKAGES metadata. An archive-only dependency is
installed and included in the lock, an index-only stale dependency is not fetched, and a stronger
archive version constraint fails before downloading the incompatible dependency. The fixtures also
reuse the preflight index pin: unchanged index bytes alone do not prove that the installed
dependency graph equals the metadata plan. Preflight findings remain metadata evidence, not
installation evidence.

The declared-version observer policy `declared-version-availability-v3` interprets `Depends: R` as
the runtime requirement. An `R` entry in Imports, Suggests, Enhances, or LinkingTo is observed
through package-version lookup instead. Reports retain separate version keys `R` and `package:R`
when both forms occur, preventing a runtime version from satisfying a package dependency. This does
not complete metadata checks or establish P7 eligibility. Only Depends, Imports and LinkingTo are
required: under the RFC-0008 check profile (`_R_CHECK_FORCE_SUGGESTS_=false`) native `R CMD check`
reports unavailable Suggests as INFO, so v3 observes Suggests and Enhances without requiring them.

Artifact resolution, repository preflight and installation use the same distinction. The reserved
`providedPackages.R` entry supplies only the runtime version for `Depends: R`; it cannot satisfy an
`Imports: R`, an enabled `Suggests: R`, or a root package named R. Those require an actual artifact
or repository package. A package named R cannot override a runtime constraint, and runtime
requirements never create artifact lock edges. Independently written fixtures cover missing package
dependencies, distinct runtime/package versions, archive requests and dependency-first locks.

### Literal source dependency inventory

`inspectPackageSourceDependencies(description, sources, parse)` accepts a caller-owned normalized
parser and inventories literal namespace access (`::` and `:::`), `library`, `require`, and
`requireNamespace` calls. The standalone package tools do not acquire a parser or Wasm dependency.
Reports contain source hashes, paths, roles, positions and fixed reason codes; source expressions
and parser diagnostic text are omitted.

`collectPackageSourceDependencyInputs(bundle, files)` supplies package R text, test R files and
extracted Rd blocks for that inventory. Its separate failures list retains unreadable inputs by path
and original byte hash with an unexecuted status. The runner serializes those failures and the
assessment, while source text remains an input. Hashes in the assessment cover decoded UTF-8 text;
example locations are relative to their extracted block.

Policy `literal-source-references-v1` checks package-code declarations using independently written
GNU R 4.6.1 fixtures. Depends, Suggests and Enhances satisfy the measured forms; Imports also
satisfies namespace access and requireNamespace, but not library/require attachment calls. LinkingTo
alone does not satisfy these forms. Observed base-priority packages are exempt. This is a
declaration check: it does not prove package availability, exports, conditional use or attachment
advice. Test/example roles and self references remain unexecuted.

Quoted syntax, computed controls and targets, known shadowed bindings, dynamic evaluation, parse
diagnostics and unsupported syntax are conservatively reported as unexecuted. Aliases, runtime
search-path changes and transitive dependency closure remain open. A file's passed status means its
syntax inventory completed; the assessment itself can only be failed or unexecuted. It cannot
complete metadata checks or establish P7. The documented scope follows
[Writing R Extensions](https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Checking-packages).
