# Independently sourced Iris data

`bezdekIris.data` is the `bezdekIris.data` entry from the
[UCI Iris dataset](https://archive.ics.uci.edu/dataset/53/iris), credited there to R. A. Fisher. The
measurements originated with Edgar Anderson. UCI makes this dataset available under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). These data are separately licensed from
NativR's Apache-2.0 code.

- Source archive: `https://archive.ics.uci.edu/static/public/53/iris.zip`
- Source archive SHA-256: `d11fe30213d36434a0879aab7cb00ce3c812eb7ba2495874438abff7b7b762e9`
- `bezdekIris.data` SHA-256: `0fed2a99db77ec533a62dc66894d3ec6df3b58b6a8f3cf4a6b47e4086b7f97dc`
- Generated `iris.txt` SHA-256: `80a45375d65c8b97d79544ab8b575a0604c747463142d0ef8093c45f99432042`

The offline `scripts/prepare-standard-datasets.mjs` transform adds an R-shaped column header,
changes commas to tabs, and removes the `Iris-` prefix from species labels. It preserves the 150
observation order and all four numeric measurements. `iris.txt` is the transformed data supplied to
the browser runtime; no network access or GNU R/webR data or code is used at evaluation time. The
script verifies both input and output hashes.

In an advisory black-box comparison, the UCI `bezdekIris.data` numeric cells matched the 150-by-4
`datasets::iris` measurements in locally installed GNU R 4.6.0. The other UCI `iris.data` entry
differs at rows 35 and 38 and is not used. A focused black-box check against an isolated, official
GNU R 4.6.1 executable confirmed the frame shape, column names and classes, species levels and
sample labels, four column sums, and rows 35 and 38 used in the checked-in conformance case. The
full release oracle suite remains a separate gate.
