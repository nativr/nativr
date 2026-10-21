# Exploratory package-check evidence

The latest cached development/regression checkpoint is [profile 0.372](corpus-0.372.0.json): 24
digest-pinned archives, original entrypoints and applicable native repeatability observations.
pkgconfig and abind reach P7 on this Windows host; full platform validation remains separate.
Formula was not evaluated. Reports contain only allowlisted metadata and digests. The sections below
retain historical evidence and its original limitations.

**abind 1.4-8 reaches P7 at profile 0.353.0** under RFC-0008: see the redacted summary
`abind-1.4-8-p7-0.353.0.json` (written by `scripts/redact-package-check.mjs` from a full local
report). The historical summaries below predate the RFC-0008 stages.

These summaries preserve the observed package-check diagnostics for semantic profiles **0.302.0**,
**0.303.0**, **0.304.0**, and **0.305.0**, with historical results shown below, against separately
installed **GNU R 4.6.1**. They do not establish P7. Both reports retain the first unexecuted check
stage, complete discovered/executed inventories, package archive and artifact digests, capability
hash, and effective finite runtime limits.

| Package             | Executions completed on both runtimes | Exact comparisons after transport reversal | Remaining evidence                                                                                                                                    |
| ------------------- | ------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| abind 1.4-8         | 5 tests and 5 example topics          | 10 match                                   | All ten output, ordered condition and (since 0.352) cross-stream order comparisons match; further stages remain unexecuted.                           |
| numDeriv 2016.8-1.1 | 7 tests and 4 example topics          | 2 match, 9 differ                          | Browser identity, numeric display and numerical differences remain visible; cross-stream ordering and further package-check stages remain unexecuted. |

The scripts are unchanged test inputs under their own licenses. Example execution prepends an
explicit `library()` call. Both runtimes receive the same trailing `invisible(NULL)` expression so
that the public data boundary does not attempt to return a final closure. Original script, setup,
and completion hashes are recorded separately. Top-level visible output remains enabled. Fixtures
were verified byte-for-byte through the virtual filesystem before execution. The full run
inventories record excluded example blocks and all discovered source-package paths.

## Comparison and transport

Comparison policy 1 preserves exact decoded text. The only applied adaptation is
`oracle-text-crlf-v1`, backed by an independent native-process probe for **both** output streams.
The probe verifies that each literal LF acquires exactly one preceding CR, including an LF that
already follows a literal CR. One reversal of each oracle CRLF pair restores the original text;
literal CRLF and bare CR remain distinct. The recorded probe bytes and per-stream pair counts make
the conversion explicit. Actual NativR text and condition messages are unchanged.

Raw and adapted differences are separate. There is no whitespace trimming, platform-header removal,
bytecode-line removal, number rounding, or numeric tolerance. In particular, numDeriv's
`tests/trig01.R` retains `7.08881205005` versus `7.08881205004`. Profile 0.302 records
`6.618484e-12` versus `6.618483539000408e-12` in `tests/grad01.R`. Shared numeric formatting closes
that earlier difference in 0.303; the new first difference is `7.698508e-12` versus `6.618817e-12`.
No additional complete output stream matches yet. The recorded numeric tokens require further
diagnosis; the summaries do not classify every mismatch as computation or formatting.

These reports describe individual fresh-session runs. The native `man/hessian.Rd` numeric output
varied across repeated captures at profile 0.303. Input/RNG parity and repeatability therefore need
to be established before attributing that difference to a numerical algorithm. The saved token is
the value observed in the final recorded run, not a stable reference fixture.

## Redaction and reproducibility

`lifecycle-observations-0.307.0.json` records matched abind and numDeriv load/attach transitions
with source/artifact/capability provenance and full local report hashes. The state tuple records
initial namespace/attachment presence, presence after namespace loading, presence after attachment,
and the number of search-path entries after repeated attachment. Both observed tuples are
`0|0|1|0|1|1|1`. The lifecycle stage retains unexecuted detach, unload, clean-base loading and full
installation validation. These records contain no package implementation or captured output text.
Independent native fixture tests additionally cover failed load/attach hook retries and hook counts;
they do not establish the entire lifecycle behavior of either pinned package.

`dependency-observations-0.306.0.json` separately preserves public dependency-version observations
for abind and numDeriv, with source/artifact/capability provenance and hashes of the complete local
reports. All three abind declarations and numDeriv's R declaration satisfy their constraints on both
runtimes. No package source or captured output is stored. The metadata inventories explicitly retain
unexecuted DESCRIPTION validation and undeclared/transitive dependency checks, so neither stage nor
P7 is promoted. Fresh full executions retained ten abind matches and two numDeriv matches with nine
differences; this file records dependency evidence rather than full output-comparison evidence.

Profile 0.304 observes NativR conditions through `globalCallingHandlers()` after source handlers,
matching the native oracle observation boundary. Generic accessors retain classes, messages and
calls in order, including returning top-level error handlers. Observer setup/read hashes and bounds
are recorded in the execution profile. Removed observers, overflow and incomplete execution do not
establish complete evidence. This exposes an `afill.R` call difference that the earlier reports
could not compare: attributes are omitted from an embedded replacement value. The nine-of-ten full
comparison result does not mean stdout/stderr regressed; all ten streams still match.

Profile 0.305 closes that call gap through shared embedded-value attribute display. All ten full
abind comparisons now match, including all three handled errors. Historical reports remain intact.
The fresh numDeriv capture completes all eleven inputs with two matches and nine differences;
cross-stream order and unexecuted check stages still prevent P7 for both packages.

The JSON files use diagnostic schema 1 and redaction policy `sha256-no-output-v1`. They contain no
package implementation, raw stdout/stderr, printed function bodies, or raw condition messages. Text
is represented by SHA-256, UTF-8 byte length, and UTF-16 length. A first-difference record retains
its field, UTF-16 offset, excerpt hash/length, and first UTF-16 code unit. Selected observed numeric
differences also retain complete numeric tokens as strings, without changing precision.
`rawReportSha256` identifies the complete local report from which each summary was derived. These
compact records cannot independently replay an output comparison; the opt-in command recreates the
full local evidence from pinned source archives.

Reproduce a full report after building the repository:

```sh
pnpm package:check --package abind --output /path/to/abind-report.json --rscript /path/to/R-4.6.1/Rscript
pnpm package:check --package numDeriv --output /path/to/numDeriv-report.json --rscript /path/to/R-4.6.1/Rscript
```

Since profile 0.351, both runtimes receive the same explicit RNG prologue,
`set.seed(20261016L, kind = "Mersenne-Twister", normal.kind = "Inversion", sample.kind = "Rejection")`,
before each script. Without it, GNU R seeds from the clock and process, so scripts that draw random
numbers without seeding are not comparable. The report records this as `executionProfile.rng`.
`--rng-seed N` selects another seed, and `--rng-seed none` restores session defaults.
`--oracle-repeat` captures each oracle script twice and records `oracleRepeat` per execution. A
script whose native output differs between two runs cannot establish an exact comparison. The
redacted summaries above predate this policy.

The command exits nonzero while P7 remains incomplete. Supply `--source` to reuse a local archive;
its digest must match the corpus pin. The persisted-evidence test validates the redacted schema,
corpus identity, stage inventories, comparison counts, transport declaration, and exact retained
numeric differences. It never executes or reads third-party implementation source.

## Cross-stream output order

Since R5, every compared oracle script runs in a second fresh GNU R session. The runner and fixture
bytes are the same, and stdout and stderr share **one** newly created file handle, as in an R CMD
check `.Rout` transcript. GNU R writes each console emission as it occurs. Native fixtures show that
partial lines, deferred top-level warnings, `stderr()` writes and output larger than stream buffers
keep their emission order there. The capture adds no R-level sink and does not change the evaluated
program.

The merged bytes do not say which stream wrote each byte. The harness therefore aligns them with the
exact stdout and stderr bytes of the first, separate-pipe session. The order is accepted only when
**exactly one** stream assignment reproduces all three byte sequences. Otherwise the oracle records
`ambiguous`, `inconsistent`, `incomplete`, `unbounded` or `undecodable`, supplies no `outputOrder`,
and the stage stays `unexecuted` for that script. For example, `cat(1); message(1)` and
`message(1); cat(1)` merge to the same bytes, so the harness never picks one of them. Event text
keeps the native CRLF transport bytes. Comparison reverses them only through the same verified
`oracle-text-crlf-v1` declaration, including a CR and LF split across events of one stream. With
`--oracle-repeat`, both captures are repeated and `oracleRepeat.outputOrderEqual` is part of
`repeatable`.

`output-order-v1-0.352.0.json` records the first executed stage: abind `output-order` **passed**
with all ten scripts executed. `tests/adrop.R` and `tests/afill.R` interleave stdout, stderr and
stdout; the other eight scripts write only stdout. Every oracle order was uniquely aligned and
repeated identically, and every NativR event sequence matches it exactly. The record keeps
provenance, the stage inventory and per-event stream, SHA-256, UTF-8 byte length and UTF-16 length,
under `sha256-no-output-v1`; it holds no output text. P7 stays false: the first blocker remains
`metadata-dependencies`.

`lifecycle-observations-0.312.0.json` records matched load, attach, detach and unload transitions
for the unchanged pinned abind and numDeriv archives. Observer v2 records the eleven-field tuple
`0|0|1|0|1|1|1|1|0|0|0`: initial namespace/search presence, namespace-only load presence, attached
presence, repeated-attachment count, detached presence, and unloaded presence. It uses qualified
base operations and local observer state. Only provenance, states, stage classification and raw
report hashes are retained; no third-party implementation or printed function bodies are stored.
Clean-base loading and full installation validation remain unexecuted, and P7 stays false.
