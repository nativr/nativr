# Independent reference observations

These files preserve public documentation metadata and black-box observations of installed GNU R
4.6.1 / testthat 3.3.2, explicitly edition 3, collected on 2026-10-22. The inputs are independently
authored. No package implementation body, foreign example/test, condition call, traceback or source
reference is an implementation input.

`public-sources.json` records official documentation URLs and the version shown on the site. Those
are rolling URLs, not immutable web snapshots. No linked source/archive was read.
`native-observations.json` and `native-repeat-reference.json` preserve two matching runs of 27
direct API observations, one forcing observation, 15 observable argument-name lists and five owned
suite tests. `historical-validation.json` records the original 16 grouped checks; it is historical
evidence, not an acceptance report for a later runtime or relocated harness.

`native-probes.R` reproduces only these owned observations against an already installed reference.
It requires one fresh output directory, refuses an existing one and generates its own suite there.
It never downloads or installs anything. Native error/skip conditions in the outputs are intentional
inputs. The default NativR assisted CLI never invokes this optional observer.

Example invocation with a separately selected installed Rscript:

```text
Rscript --vanilla testing/nativr-test-runner/reference/native-probes.R <fresh-output-directory>
```

The observer checks exact native versions before running. Only controlled classes/messages, values,
argument names and owned lifecycle markers are retained; implementation bodies are not inspected.
The relocated observer has not acquired new native-parity claims merely by moving.

Reference observations do not establish full API equivalence. Negative condition matching, condition
identity/attributes, interactive test return, diagnostic rendering and setup/cleanup failure
behavior remain gaps identified in `../support-manifest.json`. Running the independently authored
`nativrTest` core under GNU R is a separate cross-interpreter check. Neither kind of evidence grants
original dependency-closure or normative P6/P7 credit.
