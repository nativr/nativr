# Core data provenance

NativR ships a small browser-owned core-data catalog so that package examples can use the ordinary
`datasets` namespace without GNU R files at runtime. Data resources are admitted only when their
origin and redistribution terms are explicit. GNU R is used solely as a black-box oracle for object
shape and selected values; no GNU R data file, package source, or serialization was copied.

## `datasets::AirPassengers`

- Browser resource: the Kaggle
  [Airlines Passenger Data](https://www.kaggle.com/datasets/ternaryrealm/airlines-passenger-data)
  publication, whose metadata declares `CC0: Public Domain` and identifies its upstream CSV as the
  DataMarket international-airline-passenger series rather than an R package extraction.
- Download endpoint used for the audit:
  `https://www.kaggle.com/api/v1/datasets/download/ternaryrealm/airlines-passenger-data`.
- Downloaded archive SHA-256: `800ea7d54c0c3600ee03957e3c4e5f73ff5bcc0efd3f51684640e7b477b96ba8`.
- Normalization: the 144 monthly counts become a double `ts` vector starting in January 1949 with
  frequency 12. Complete values, `tsp`, class, endpoints, extrema, total, and namespace/search
  identity are frozen by executable differential evidence.

## `datasets::ability.cov`

- Upstream facts: the Oxford-hosted _Statistics Complements to Modern Applied Statistics with S_
  publishes the 6-by-6 covariance matrix for six ability tests administered to 112 individuals and
  attributes the example to Smith and Stanley (1983), as quoted by Bartholomew (1987, pp. 61-65).
  The audited public document is [`VR3stat.pdf`](https://www.stats.ox.ac.uk/pub/MASS3/VR3stat.pdf),
  section 11.10.
- Compatibility projection: the browser resource is an independently authored transcription of the
  compact numerical facts in that published table. GNU R 4.6.0 was queried only through the public
  `ability.cov` object as a black-box oracle to freeze list-field order, storage modes, matrix and
  dimname attributes, zero center, and `n.obs = 112`. No GNU R data file, package source,
  serialization, or executable implementation was read or copied.
- Runtime normalization: an ordinary `data/ability.cov.R` resource constructs a three-field list
  whose `cov` field is the named double matrix. Shape, labels, selected values, aggregates, and
  namespace/search identity are frozen by executable differential evidence.

## `datasets::BOD`

- Browser resource: the independently authored `reporter` project publishes the complete six-row
  biochemical-oxygen-demand table in its report examples at commit
  [`0ff631f92284b4a39ed1d71b0859652fe8ae6dcf`](https://github.com/dbosak01/reporter/blob/0ff631f92284b4a39ed1d71b0859652fe8ae6dcf/R/report_spec.r#L416-L430).
  The same pinned project's
  [`DESCRIPTION`](https://github.com/dbosak01/reporter/blob/0ff631f92284b4a39ed1d71b0859652fe8ae6dcf/DESCRIPTION#L24)
  declares `License: CC0`.
- Audited source integrity: the pinned 110,428-byte `R/report_spec.r` resource has SHA-256
  `50d1aef3a62bc720e431600d671553a23afb87b580808fd799be05e96cdfa7d4`.
- Upstream facts: the six observations record incubation time in days and biochemical oxygen demand
  in mg/l and are attributed to Marske (1967), as later presented by Bates and Watts (1988).
- Compatibility projection: GNU R 4.6.0 was queried only through the public `datasets::BOD` object
  as a black-box oracle to freeze the `Time` and `demand` names, double column storage, compact row
  names, data-frame class, and `reference = "A1.4, p. 270"` attribute. No GNU R data file, package
  source, serialization, or executable implementation was read or copied.
- Runtime normalization: an ordinary declarative `data/BOD.R` resource constructs the two-column
  browser-owned data frame. Complete values, attributes, aggregates, namespace/search identity, and
  unchanged-package use are frozen by flat, recursive, integration, and package-corpus evidence.

## `datasets::CO2`

- Browser resource: Frank Narf's independently published
  [Quick R Tutorial table chapter](https://franknarf1.github.io/r-tutorial/_book/tables.html#reshaping-to-long)
  reproduces the full 12-plant by seven-concentration uptake table. The corresponding source project
  is pinned at commit
  [`212c29281fa822145552604e9f9a67d0397595b0`](https://github.com/franknarf1/r-tutorial/tree/212c29281fa822145552604e9f9a67d0397595b0)
  and applies
  [CC0 1.0 Universal](https://github.com/franknarf1/r-tutorial/blob/212c29281fa822145552604e9f9a67d0397595b0/LICENSE)
  to the work.
- Audited publication integrity: the downloaded 220,535-byte generated `tables.html` page has
  SHA-256 `41cfe23426bee3cf33ee4bf3105200df3d292f7f192e65d81febeee2ab95804e`. Its pinned 92,845-byte
  `tables.Rmd` source has SHA-256
  `b0d63d0f84958029d91a32aafb065bd2509e8d973c10c1ffbb7a5477dcd82b32`.
- Upstream facts: the 84 observations measure carbon-dioxide uptake by 12 plants of _Echinochloa
  crus-galli_ at seven ambient concentrations, with Quebec/Mississippi origin and chilled/nonchilled
  treatment, as reported by Potvin, Lechowicz, and Tardif (1990).
- Compatibility projection: GNU R 4.6.0 was queried only through the public `datasets::CO2` object
  as a black-box oracle to freeze row order, factor level order, ordered-factor status, grouped-data
  class vector, formulas with empty environments, labels, units, and numeric values. No GNU R data
  file, package source, serialization, or executable implementation was read or copied.
- Runtime normalization: an ordinary declarative `data/CO2.R` resource constructs the complete
  browser-owned grouped data frame, including its public attributes. Full values, grouped summaries,
  namespace/search identity, and unchanged-package use are frozen by flat, recursive, integration,
  and package-corpus evidence.

## `datasets::iris`

- Upstream facts: the [UCI Iris dataset](https://doi.org/10.24432/C56C76), licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Browser resource: scikit-learn's corrected `iris.csv` at commit
  [`399f1b27615aa0f4b0901e7164fe043c7f5ecf5b`](https://github.com/scikit-learn/scikit-learn/blob/399f1b27615aa0f4b0901e7164fe043c7f5ecf5b/sklearn/datasets/data/iris.csv),
  covered by scikit-learn's
  [BSD-3-Clause license](https://github.com/scikit-learn/scikit-learn/blob/399f1b27615aa0f4b0901e7164fe043c7f5ecf5b/COPYING).
- Resource SHA-256: `f13ffa8fdd56fd8e6c8d16d4081a3fbd3114bcd0aae4256c43205169cd9d1449`.
- Normalization: the four measurements retain the corrected numeric observations; the integer class
  codes become a factor with `setosa`, `versicolor`, and `virginica` levels. Column names and
  selected correction points are frozen by differential conformance evidence.

Scikit-learn documents that its two corrected observations agree with R rather than the two
erroneous UCI points. NativR independently verifies the resulting public object behavior against a
separately installed R oracle.

`datasets::iris3` is a deterministic alternate projection of the same admitted observations, not a
second copied dataset. NativR reshapes the four numeric columns into a 50-by-4-by-3 double array in
species order and supplies the GNU-observed abbreviated measurement and title-cased species
dimension names. Exact complete values, dimensions, dimension names, namespace/search identity, and
equality to the three corresponding `iris` measurement blocks are frozen by flat, recursive, and
integration evidence.

## `datasets::mtcars`

- Browser resource: the public `ruiromanini/mtcars` Kaggle dataset, whose
  [dataset metadata](https://www.kaggle.com/datasets/ruiromanini/mtcars) declares
  `CC0: Public Domain`.
- Download endpoint used for the audit:
  `https://www.kaggle.com/api/v1/datasets/download/ruiromanini/mtcars`.
- Downloaded archive SHA-256: `e35bb337b1f03629c04aa95fc2fcd07feb45e7784f56a02f64ea161bab9ee335`.
- Embedded `mtcars.csv` SHA-256: `b7d914b5d47c73b3ea5aab8e7298886d70c6fdf873087df0d4a382393f81065b`.
- Normalization: the `model` field becomes exact row names and all eleven measurement columns become
  double vectors. Dimensions, names, endpoint row names, types, and namespace/search identity are
  frozen by differential conformance evidence.

## `datasets::InsectSprays`

- Browser resource: the Key2STATS
  [Effectiveness of Insect Sprays dataset](https://www.key2stats.com/data-set/view/391), whose
  metadata declares `Public Domain (CC0)` and attributes the observations to Beall (1942).
- Download endpoint used for the audit:
  `https://www.key2stats.com/Effectiveness_of_Insect_Sprays_391_66.csv`.
- Resource SHA-256: `c599781da32ca4dcb91535ee912c86c1f0297f41cf2a96bf48a102968a3653f0`.
- Normalization: the source's redundant ordinal column is discarded; `count` becomes a double vector
  and `spray` becomes a factor with levels `A` through `F`. All 72 observations retain their source
  order and row identifiers. Dimensions, storage types, classes, levels, selected values, totals,
  and namespace/search identity are frozen by differential conformance evidence.

## `datasets::faithful`

- Browser resource: the Kaggle
  [Old Faithful dataset](https://www.kaggle.com/datasets/janithwanni/old-faithful), whose metadata
  declares `CC0: Public Domain`.
- Download endpoint used for the audit:
  `https://www.kaggle.com/api/v1/datasets/download/janithwanni/old-faithful`.
- Downloaded archive SHA-256: `3fa7b51aba823914c57e0c000c81263fd65e489d3fab51de2b8a79fbdb020c4b`.
- Embedded `faithful.csv` SHA-256:
  `6675d052dd7495645ac2146290c8ca69e6c1d0795723288d578d2cb2c6c9cda3`.
- Normalization: the source row identifier becomes exact row names, while `eruptions` and `waiting`
  become double vectors. All 272 observations retain source order. Dimensions, names, storage types,
  selected endpoint values, aggregate checks, and namespace/search identity are frozen by
  differential conformance evidence.

## `datasets::HairEyeColor`

- Upstream facts: Michael Friendly's Data Visualization site publishes the compact
  [`haireye.sas`](http://www.datavis.ca/sas/vcd/catdata/haireye.sas) table used for categorical-data
  demonstrations and attributes the University of Delaware survey to Snee (1974). The independent
  SAS data statement lists all 32 observed counts by sex, eye colour, and hair colour.
- Audited source integrity: the downloaded 712-byte SAS data statement has SHA-256
  `6bdcadc920fae76284ea22a397622b8f8439670a5e23e50b1b4b2db3e12ed39d`.
- Compatibility projection: the browser resource is an independently authored transcription of those
  compact statistical facts. GNU R 4.6.0 was queried only through the public `HairEyeColor` object
  as a black-box oracle to freeze axis order, full labels (`Male` and `Female`), double storage,
  `table` class, and observable margins. No GNU R data file, package source, serialization, or
  executable implementation was read or copied.
- Runtime normalization: a declarative browser-owned data script constructs the 4-by-4-by-2 table
  with named Hair, Eye, and Sex dimensions. All cells, total 592, one-way margins, namespace/search
  identity, and unchanged-package use are frozen by executable differential evidence.

## `datasets::UCBAdmissions`

- Independent facts: Random Services publishes the 24 admitted and rejected male and female counts
  for the six largest University of California, Berkeley departments in 1973 and cites Bickel,
  Hammel, and O'Connell (1975) and Freedman, Pisani, and Purves. The independently readable table is
  at `https://www.randomservices.org/random/data/Berkeley.html`.
- Compatibility projection: GNU R 4.6.0 was queried only through the public `UCBAdmissions` object
  as a black-box oracle to freeze dimension order, labels, double storage, `table` class, and
  column-major cell ordering. No GNU R data file, package source, or serialization was read or
  copied.
- Runtime normalization: the independently published counts become a declarative 2-by-2-by-6 table
  with dimensions `Admit`, `Gender`, and `Dept`. All cells, total 4526, one-way margins, and
  namespace/search identity are frozen by executable integration and differential evidence.

## `datasets::swiss`

- Browser resource: the Key2STATS
  [Swiss Fertility and Socioeconomic Indicators (1888) dataset](https://www.key2stats.com/data-set/view/440),
  whose catalog declares the tabular resource to be Public Domain (CC0) and attributes the
  observations to Francine van de Walle and Princeton University's Office of Population Research.
- Download endpoint used for the audit:
  `https://www.key2stats.com/Swiss_Fertility_and_Socioeconomic_Indicators__1888__Data_440_69.csv`.
- Resource SHA-256: `56bc6a531b0c2b814fa624726608299c1ab1df089d554560cb4fb0f5545ab5cc`.
- Runtime normalization: the source district field becomes exact row names; `Fertility`,
  `Agriculture`, `Catholic`, and `Infant.Mortality` become double columns, while `Examination` and
  `Education` retain integer storage. Shape, labels, storage modes, endpoint observations, column
  totals, namespace identity, and PCA compatibility are frozen by executable differential evidence.

## `datasets::stackloss`, `datasets::stack.x`, and `datasets::stack.loss`

- Browser resource: statsmodels 0.14.6 publishes the complete 21-observation Brownlee stack-loss
  table and explicitly declares the dataset public domain. The audited release is pinned at
  statsmodels commit `40e6a84d26ac74623c6b94b718f0987ef0351c53`.
- Audited resource: `statsmodels/datasets/stackloss/stackloss.csv` is 292 bytes with SHA-256
  `7395953d62eec7abab783ae9603ff82f091d04a4689780e455c239f0f5509f64`.
- Upstream facts: the 21 rows are operational measurements from a nitric-acid plant reported by
  Brownlee (1965): air flow, cooling-water temperature, acid concentration, and stack loss.
- Compatibility projection: GNU R 4.6.0 was queried only through the three public data objects to
  freeze double storage, matrix/data-frame shapes, labels, and the historical relationship among the
  predictor matrix, response vector, and combined frame. No GNU R data file, package source,
  serialization, or implementation was read or copied.
- Runtime normalization: three declarative data resources expose the combined data frame and the
  S-compatible predictor/response projections through `data()`, namespace, and attached search
  paths. Complete values, aggregates, object identity, and unchanged-package use are executable
  evidence.

## `datasets::precip`

- Upstream facts: U.S. Bureau of the Census, _Statistical Abstract of the United States, 1975_, 96th
  edition, table 327 on printed page 192, “Normal Monthly and Annual Precipitation—Selected Cities.”
  The table identifies the 1941–1970 standard period, 70-city ordering, units, and its U.S. National
  Oceanic and Atmospheric Administration source. The
  [ERIC catalog record](https://eric.ed.gov/?id=ED121885) identifies the Bureau of the Census as the
  authoring institution; the audited page is preserved in the
  [Internet Archive scan](https://archive.org/details/sim_statistical-abstract-of-the-united-states_1975_section-1-34/page/n211/mode/1up).
- Redistribution basis: the Statistical Abstract is a work of the United States Government.
  [17 U.S.C. § 105](https://uscode.house.gov/view.xhtml?req=%28title%3A17+section%3A105+edition%3Aprelim%29)
  states that U.S. copyright protection is unavailable for such works.
- Audited scan-page SHA-256: `5d2534335f9cb0347378018a86032cd1ec094b6459045d4dc2da3f6f8d8872db`.
- Embedded `precip.csv` SHA-256: `3e5cb5660cd3bd1bfd3d58ea446189de8f65d01512452f2da6f8863a647c1d46`.
- Compatibility projection: the federal table supplies the independent statistical provenance, city
  set, ordering, and two-decimal annual observations. GNU R 4.6.0 was queried only through the
  public `precip` object as a black-box compatibility oracle to freeze its one-decimal values and
  current spellings (`Bismarck`, `Cincinnati`, and `Pittsburgh`). Some published R values are not a
  mechanical one-decimal rounding of table 327's annual column, so the resource records that
  distinction rather than silently treating the federal observations and the R compatibility
  projection as identical. No GNU R data file, source, or serialization was read or copied.
- Runtime normalization: the two-column browser CSV becomes a named double vector of length 70.
  Type, class, names, selected values, aggregates, duplicate `Portland` names, and namespace/search
  identity are frozen by differential conformance evidence.

## `datasets::USArrests`

- Upstream facts: the U.S. Department of Justice catalog identifies the FBI's _Uniform Crime Reports
  for the United States, 1973_ as the federal source for arrest and index-crime statistics; the 1970
  Census state reports separately publish population classified by urban and rural residence. The
  corresponding public catalogs are
  [OJP/NCJRS 1973 UCR](https://ojp.gov/ncjrs/virtual-library/abstracts/uniform-crime-reports-united-states-1973)
  and the
  [1970 Census population reports](https://www.census.gov/library/publications/1971/dec/pc-v1.html).
- Redistribution basis: the underlying crime and census observations are facts published by United
  States Government agencies. Works prepared by federal employees as part of their official duties
  are outside U.S. copyright under
  [17 U.S.C. § 105](https://uscode.house.gov/view.xhtml?req=%28title%3A17+section%3A105+edition%3Aprelim%29).
- Compatibility projection: GNU R 4.6.0 was queried only through the public `USArrests` object as a
  black-box oracle to freeze the 50-state ordering, four current column names, and numeric values.
  No GNU R data file, package source, or serialization was read or copied. The browser CSV is a
  clean-room tabular projection of those public observations.
- Embedded `USArrests.csv` SHA-256:
  `0e786531584827c5f3966ad0bb21a08162dbe9dde619824eb940ff9e1438e3b8`.
- Runtime normalization: the state label becomes exact row names and the four measurement columns
  become double vectors. Shape, names, endpoint states, selected values, aggregates, namespace
  identity, and PCA-derived invariants are frozen by executable conformance evidence.

## `datasets::USJudgeRatings`

- Upstream facts: the published table records lawyers' ratings of 43 Connecticut Superior Court
  judges across 12 measures. The original source is the _New Haven Register_, 14 January 1977,
  attributed through John Hartigan. Independent public descriptions reproduce the 43-by-12 shape,
  measure definitions, judge labels, and observed ranges, including the
  [Tablicious dataset catalog](https://apjanke.github.io/octave-tablicious/release/v0.3.7/user-guide/tablicious.pdf)
  and an independently generated [variable table](https://nickchk.com/vtexamples/cvex1.html).
- Compatibility projection: GNU R 4.6.0 was queried only through the public `USJudgeRatings` object
  as a black-box oracle to freeze its observable row order, column order, double values, and row
  labels. No GNU R data file, package source, serialization, or implementation was read or copied.
  The pinned GNU R 4.6.1 oracle remains the normative compatibility authority.
- Embedded `USJudgeRatings.csv` SHA-256:
  `00ea732f66fd6ee0a532fbdb18dd85d1580b8094670e0e4c3cdda328401f338a`.
- Runtime normalization: the first CSV field becomes exact judge row names and all 12 rating fields
  become double data-frame columns. The complete recursive value, shape, names, types, selected
  boundaries, column totals, namespace identity, and unchanged-package use are frozen by flat and
  recursive differential evidence.

## `datasets::presidents`

- Upstream facts: the American Presidency Project's
  [presidential job-approval archive](https://www.presidency.ucsb.edu/statistics/data/presidential-job-approval-all-data)
  identifies Gallup as the consistent source of historical observations and records the public poll
  question, field dates, and approval percentages. The legacy quarterly series is attributed to the
  Gallup Organisation and documented by D. R. McNeil, _Interactive Data Analysis_ (1977).
- Compatibility projection: the historical `presidents` series is explicitly an approximately
  quarterly, adjusted projection rather than a lossless copy of Gallup's individual polls. GNU R
  4.6.0 was queried only through the public object as a black-box oracle to freeze its 120 published
  quarterly values, six missing quarters, and `tsp = c(1945, 1974.75, 4)` contract. No GNU R data
  file, package source, or serialization was read or copied.
- Embedded `presidents.csv` SHA-256:
  `a7253b879bad63a6a37ec198740b79739e4e6b92aca3ee41b7f30ee96b6a6b3e`.
- Runtime normalization: the one-column browser CSV becomes a double `ts` vector starting in quarter
  one of 1945 with frequency four. Length, class, endpoints, frequency, missingness, selected
  values, aggregate checks, cycles, and namespace/search identity are frozen by executable
  differential evidence.

## `datasets::warpbreaks`

- Browser resource: SciCloj's
  [`data/warpbreaks.csv`](https://github.com/scicloj/tablecloth/blob/cbe8e6420676fba47faab6900ef39fe0e9739cbc/data/warpbreaks.csv)
  at commit `cbe8e6420676fba47faab6900ef39fe0e9739cbc`, distributed with the repository under its
  [MIT license](https://github.com/scicloj/tablecloth/blob/cbe8e6420676fba47faab6900ef39fe0e9739cbc/LICENSE).
- Upstream facts: the 54 measurements record the number of warp breaks for two wool types at three
  tension levels in a balanced experiment originally reported by Tippett (1950).
- Resource SHA-256: `256b46e881ed7397eff3559e86f94cb119bc65bd353ebd248034a3835a9932bf`.
- Normalization: `breaks` becomes a double vector; `wool` and `tension` become factors with levels
  `A`, `B` and `L`, `M`, `H`, respectively. Source order is retained and ordinary compact row names
  are generated. Shape, storage types, factor levels, selected boundary values, grouped totals, and
  namespace/search identity are frozen by differential conformance evidence.

## `datasets::cars`

- Upstream facts: Wolfram Data Repository's _Sample Data: Car Stopping Distances_ identifies the
  50-row, two-column data as car speed and stopping distance observations created by M. Ezekiel and
  published by Wiley in _Methods of Correlation Analysis_ (1930). Its resource record supplies a
  stable DOI and downloadable tabular representations.
- Compatibility projection: GNU R 4.6.0 was queried only through the public `cars` object as a
  black-box oracle to freeze column names, double storage, ordering, and values. No GNU R data file,
  package source, or serialization was read or copied.
- Runtime normalization: the browser-owned data script constructs a 50-by-2 data frame with double
  `speed` and `dist` columns. Shape, endpoint and interior values, column totals, and
  namespace/search identity are frozen by flat and recursive differential evidence.

## `datasets::women`

- Upstream facts: the 15 height-and-average-weight pairs for American women aged 30-39 are
  attributed to _The World Almanac and Book of Facts, 1975_. An independently published Wiley
  textbook excerpt reproduces the complete table and identifies weight as the average in pounds at
  each height in inches.
- Compatibility projection: GNU R 4.6.0 was queried only through the public `women` object as a
  black-box oracle to freeze the two column names, double storage, ordinary row names, source order,
  and values. No GNU R data file, package source, or serialization was read or copied.
- Runtime normalization: the browser-owned declarative data script constructs a 15-by-2 data frame
  with double `height` and `weight` columns. Shape, types, endpoints, aggregates, and
  namespace/search identity are frozen by flat and recursive differential conformance evidence.

## `datasets::trees`

- Browser resource: the Key2STATS
  [Diameter, Height and Volume for Black Cherry Trees dataset](https://www.key2stats.com/data-set/view/445),
  whose catalog declares the 31-observation table to be Public Domain (CC0) and attributes it to
  Ryan, Joiner, and Ryan's 1976 _Minitab Student Handbook_.
- Download endpoint used for the audit:
  `https://www.key2stats.com/Diameter__Height_and_Volume_for_Black_Cherry_Trees_445_80.csv`.
- Resource integrity: the downloaded CSV is 2,038 bytes with SHA-256
  `36e1bab003f342218da90b23868291c3da53b3ccda450332b9f12e93b91c46cf`.
- Runtime normalization: the source ordinal field is discarded; `Girth`, `Height`, and `Volume`
  become double columns with the source row identifiers retained. Shape, types, endpoints,
  aggregates, and namespace/search identity are frozen by flat and recursive differential
  conformance evidence.

## `datasets::lynx`

- Browser resource: Key2STATS publishes the complete
  [Annual Canadian Lynx trappings 1821-1934 data set](https://www.key2stats.com/data-set/view/405)
  and explicitly marks it Public Domain (CC0). The corresponding
  [CSV resource](https://www.key2stats.com/Annual_Canadian_Lynx_trappings_1821___1934_405_72.csv)
  contains 114 annual observations and cites Brockwell and Davis (1991) and Campbell and Walker
  (1977).
- Resource integrity: the admitted CSV is 2,131 bytes with SHA-256
  `dda119ffe6e3a0e4b30bcf119521ec5616fc1e14808ac5ac0680fa3c97045ddf`.
- Compatibility projection: GNU R 4.6.0 was queried only through the public `lynx` object as a
  black-box oracle. All 114 independent-source values agree exactly with the public object, whose
  observable shape is a double `ts` series with `tsp = c(1821, 1934, 1)`. No GNU R data file,
  package source, serialization, or derived extraction was read or copied.
- Runtime normalization: the independently licensed CSV value column becomes a double `ts` vector
  starting in 1821 with frequency one. Complete values, class, endpoints, frequency, aggregates, and
  namespace/search identity are frozen by flat and recursive differential conformance evidence.

## `datasets::attitude`

- Upstream facts: UCLA Statistical Methods and Data Analytics publishes the third-edition
  _Regression Analysis by Example_ data files and identifies the 30-by-7 “Supervisor Performance”
  table on page 54. Its
  [raw ASCII table](https://stats.oarc.ucla.edu/wp-content/uploads/2016/02/p054.txt) uses the book's
  `Y`, `X1`, ..., `X6` headings and contains all 30 department-level observations.
- Audited source integrity: the UTF-8 bytes returned by that endpoint have SHA-256
  `a60c6685877eb00b4b7918c5f9af27ff923e7da60898020c86594460e6bd18fc`.
- Compatibility projection: the independently published numeric facts are mapped to `rating`,
  `complaints`, `privileges`, `learning`, `raises`, `critical`, and `advance`. GNU R 4.6.0 was
  queried only through the public `attitude` object as a black-box oracle to freeze double storage,
  column and row order, selected values, and aggregates. No GNU R data file, package source,
  serialization, or executable implementation was read or copied.
- Runtime normalization: a declarative browser-owned data script constructs the 30-by-7 double data
  frame with compact row names. Complete values, dimensions, names, storage types, column totals and
  means, and namespace/search identity are frozen by flat, integration, and recursive differential
  evidence.

## `datasets::airquality`

- Browser resource:
  [csvbase `r-datasets/airquality`](https://csvbase.com/r-datasets/airquality/details) publishes the
  complete 153-observation table under the Public Domain Dedication and License (PDDL) 1.0.
- Audited resource: `https://csvbase.com/r-datasets/airquality.csv` is 4,360 bytes with SHA-256
  `cd460803926fc86b01610deff43257b1ee5fe7dc0104ae2f9f94feea7ba3b082`.
- Upstream facts: the table records daily New York air-quality and weather measurements from May
  through September 1973. The source includes a stable row identifier plus `Ozone`, `Solar.R`,
  `Wind`, `Temp`, `Month`, and `Day`.
- Compatibility projection: the independent row identifier is removed and compact row names `1`
  through `153` are generated. GNU R 4.6.0 was queried only through the public `airquality` object
  as a black-box oracle to freeze column order, integer/double storage, 37 missing ozone
  observations, seven missing solar-radiation observations, endpoints, and aggregates. No GNU R data
  file, package source, serialization, or executable implementation was read or copied.
- Runtime normalization: a declarative browser-owned data script reads the embedded CSV, preserves
  `NA`, materializes the six-column data frame, and exposes it through the ordinary `datasets`
  namespace, search path, and `data()` lifecycle without filesystem or network access.

## `datasets::LifeCycleSavings`

- Independent public record: David C. Hoaglin and Roy E. Welsch's 1977 MIT Sloan working paper
  [_The Hat Matrix in Regression and ANOVA_](http://hdl.handle.net/1721.1/1920), Working Paper
  901-77, reproduces the complete 50-country savings table in Exhibit 5 and the country labels in
  Exhibit 4. The paper attributes collection of the cross-national data to Arlie Sterling of MIT.
- Compatibility projection: the published `SR`, `POP15`, `POP75`, `DILEV`, and `DIGRO` fields map
  respectively to the modern observable names `sr`, `pop15`, `pop75`, `dpi`, and `ddpi`. GNU R 4.6.0
  was queried only through the public `LifeCycleSavings` object as a black-box oracle to freeze the
  modern field names, exact country-label spellings and order, double storage, dimensions, and
  aggregates.
- Runtime normalization: a declarative browser-owned `data/LifeCycleSavings.R` resource constructs
  the 50-by-5 double data frame and exposes it through the same `datasets` namespace, search-path,
  and `data()` lifecycle used by arbitrary static package data. No GNU R data file, package source,
  serialization, executable implementation, or derived extraction was read or copied. Complete
  values, row names, types, aggregates, and namespace/search identity are frozen by flat,
  integration, and recursive differential evidence.

## `datasets::Puromycin`

- Independent public record: the Wolfram Data Repository publishes the 23-observation
  [Sample Data: Puromycin Reaction Velocity](https://datarepository.wolframcloud.com/resources/Sample-Data-Puromycin-Reaction-Velocity/)
  table, identifies M. A. Treloar as creator and the University of Toronto as the 1974 publisher,
  and assigns DOI [10.24097/wolfram.98789.data](https://doi.org/10.24097/wolfram.98789.data). Its
  public CSV endpoint contains concentration, reaction-rate, and treated/untreated state facts for
  all observations.
- Compatibility projection: the independently published fields map to `conc`, `rate`, and `state`.
  GNU R 4.6.0 was queried only through the public `Puromycin` object as a black-box oracle to freeze
  column order, double storage for the numeric fields, factor storage and level order, compact row
  names, selected endpoints, and numeric aggregates. No GNU R data file, package source,
  serialization, executable implementation, or derived extraction was read or copied.
- Runtime normalization: a declarative browser-owned `data/Puromycin.R` resource constructs the
  complete 23-by-3 data frame, including the `treated`, `untreated` factor levels, and exposes it
  through the ordinary `datasets` namespace, search-path, and `data()` lifecycle. The repository
  records independently reproduced public data facts and their provenance; it does not claim that
  the external repository page itself carries a permissive software license. Flat, integration, and
  recursive differential evidence freezes the admitted compatibility projection.

## Pending `datasets::volcano`

Profile 0.346 records `datasets::volcano` as the first ordered blocker for unchanged
`shape 1.4.6.1`. The GNU R object may be queried as a black-box oracle, but its packaged data,
source, serialization, and derived extraction are not admissible browser resources. Admission
requires a separately obtained 87-by-61 elevation grid with explicit redistribution terms and a
documented compatibility projection. Until that audit exists, NativR intentionally leaves the
binding unavailable instead of shipping unproven or copied data.

The Profile 0.397 follow-up audit also rejected Vega's `volcano.json` as an admission source. The
resource at Vega datasets commit `dedfc126e87dfde2df0332744689844314911d5d` describes itself as
"adapted from R datasets", points back to the R datasets manual, and has no resource-specific
license entry in the repository's data-package metadata. The repository's BSD license covers its
code and infrastructure, not every collected dataset. Other located mirrors likewise derive from R
or do not provide explicit redistribution terms. These mirrors may help locate an independent rights
holder, but they cannot launder GNU-derived data into the browser bundle. The blocker stays open and
package rotation continues independently.

## `datasets::state` family

- Government sources: the U.S. Census Bureau's
  [Statistical Abstract of the United States: 1977](https://www.census.gov/library/publications/1977/compendia/statab/98ed.html)
  and historical state/area tables establish the demographic and area observations; the Census
  Bureau's
  [regions and divisions catalog](https://www.census.gov/programs-surveys/economic-census/guidance-geographies/levels.html)
  establishes the state groupings; and the U.S. Geological Survey's
  [geographic-centers publication](https://www.usgs.gov/educational-resources/geographic-centers)
  establishes the underlying center facts.
- Redistribution basis: these observations and classifications are United States Government facts;
  federal works prepared as official duties are outside U.S. copyright under
  [17 U.S.C. § 105](https://uscode.house.gov/view.xhtml?req=%28title%3A17+section%3A105+edition%3Aprelim%29).
- Compatibility projection: GNU R 4.6.0 was queried only through the public `state.abb`,
  `state.area`, `state.center`, `state.division`, `state.name`, `state.region`, and `state.x77`
  objects. The black-box observations freeze historical alphabetical order, legacy `North Central`
  spelling, factor levels/codes, compact map placement, matrix labels, storage modes, and numeric
  values. No GNU R data file, serialization, package source, Rd content, or implementation was read
  or copied.
- Runtime normalization: one declarative `data/state.R` topic constructs all seven related objects.
  The static autoload topic is deliberately distinct from its exported object names, exercising the
  same multi-object package-data contract as a standard `.rda` topic. Complete values and recursive
  attributes, namespace/search identity, explicit `data(state)` loading, aggregates, and selected
  endpoints are frozen by flat, integration, and exact recursive differential evidence.

## `datasets::sunspots`

- Independent factual records: NOAA/NCEI's UAG-95 monthly sunspot-number tables and archived
  international monthly listing establish the historical observations without using GNU R source or
  packaged data.
- Version distinction: GNU R documents its fixed series as sourced from Andrews and Herzberg (1985).
  That compatibility series differs from the NOAA table in 143 months; those differences are encoded
  as a reviewable declarative projection over the NOAA baseline. The later SILSO Version 2 revision
  is not embedded.
- Compatibility observation: GNU R is used only as a public-object black-box oracle for the fixed
  values, `ts` attributes, and summary facts. No GNU R data file, serialization, package source, Rd
  content, or implementation source is an input.
- Runtime path: one ordinary `data/sunspots.R` resource parses the compact baseline, applies the
  historical projection, and constructs the regular monthly series through `stats::ts`.

## `datasets::EuStockMarkets`

- Public description: the datasets manual identifies daily closing prices for Germany's DAX,
  Switzerland's SMI, France's CAC, and the UK's FTSE, sampled in business time with 1,860 rows from
  1991 through 1998. It identifies Erste Bank AG, Vienna, as the data provider.
- Compatibility observation: the separately installed GNU R public object is used only as a
  black-box historical catalog for all 7,440 numeric observations, ordering, names, dimensions,
  classes, and `tsp` metadata. No GNU R package data file, serialization, source, or documentation
  content is copied.
- Runtime normalization: an ordinary `data/EuStockMarkets.rda` resource generated by NativR's own
  serializer restores the column-major numeric matrix and time-series attributes. Autoload,
  `data()`, namespace, search-path, and reset behavior use the same core package-data machinery as
  other resources.

## Admission and runtime path

The base layer exports declarative static-package definitions containing resources, exports, and
autoload data names. The evaluator validates paths, duplicate exports, and canonical base64, then
loads each declared data object through the same `data/*.R` and table-reader path used by arbitrary
pure-R packages. The core data are therefore resources of `datasets`, not package-specific runtime
builtins. They are available consistently through `data()`, the default `package:datasets` search
entry, and `datasets::name`, and persist across a session reset without host filesystem or network
access.

## `datasets::Theoph`

- Independent redistribution source: the `medicaldata` project publishes its `theoph` table under
  the MIT license. The audited upstream revision is
  `higgi13425/medicaldata@cf7eea82dad7c30ea6d62efc7bad7d01158e2bf7`; its license identifies the
  medicaldata authors as the copyright holders.
- Reproducible tabular projection: the embedded CSV is the `medicaldata/theoph.csv` projection from
  `vincentarelbundock/Rdatasets@cc03c29690889dbe83089f5206e2422db8c3f71f`, Git blob
  `f84509f7e58a7addfa957288aba7f7b979c5d227`, with SHA-256
  `f9b77033090644cf38c83056c25c8137bca71cf629d7c0159a72ef18095726b0`.
- Compatibility observation: GNU R is used only as a black-box oracle for column storage, ordered
  Subject levels, row order, grouped-data classes and attributes, aggregates, and selected values.
  No GNU R data file, serialization, package source, Rd content, or implementation source is read or
  copied.
- Runtime normalization: the ordinary `data/Theoph.R` resource reads the audited CSV and constructs
  the 132-by-5 grouped data frame through reusable `read.csv`, factor, data-frame, attribute,
  namespace, autoload, and `data()` paths. Flat, integration, and exact recursive evidence freezes
  the admitted projection.

## `datasets::USAccDeaths`

- Public identification: published time-series literature identifies the 72 monthly accidental-
  death totals in the United States from January 1973 through December 1978 and attributes the
  historical table to P. J. Brockwell and R. A. Davis, _Time Series: Theory and Methods_ (1991).
- Compatibility observation: the installed GNU R public object was queried only as a black-box
  historical catalog to freeze the 72 integer facts, order, `ts` class, and `tsp` metadata. No GNU R
  data file, serialization, package source, Rd content, or implementation source was read or copied.
- Runtime normalization: an ordinary `data/USAccDeaths.R` resource constructs the fixed monthly
  series with `stats::ts`. Autoload, `data()`, namespace access, reset, and package examples use the
  same declarative core-data path as every other admitted dataset.

## `datasets::volcano`

- Identity: elevation measurements for Maungawhau / Mount Eden, Auckland, on an 87-by-61 grid at
  10-metre resolution.
- Independent source: the MIT-licensed `mdsumner/volcano` georeferencing project, whose
  `inst/extdata/volcano.tif` is 7,356 bytes with SHA-256
  `941e9b754afea4c2b6280c8a6fb624cfd8ce284516821a3e70dcd60bf76ed7f3` and records NZMG EPSG:27200
  coordinates.
- Reproduction: reverse both TIFF axes as documented by the source project, then flatten in R
  column-major order. The resulting 5,307 elevations match the GNU R public object exactly; range
  94--195, sum 690,907, and squared sum 93,488,451 are independently checked.
- Runtime normalization: an ordinary `data/volcano.R` resource constructs a double matrix with
  dimensions 87 by 61 and no dimnames through the generic static-package data path.
- Clean-room boundary: no GNU R package data file, serialization, implementation source, Rd text, or
  package source was used as an implementation input.

## Pending `datasets::quakes`

Profile 0.518 advances unchanged `gridGraphics 0.5-1` to the missing `quakes` object in retained
`demo-graphics.R` expression 27. Public documentation identifies the 1,000 observations as a
subsample of a 5,000-event Harvard PRIM-H earthquake catalog obtained from Dr. John Woodhouse,
Department of Geophysics, Harvard University. It does not by itself establish redistribution terms
for the exact selected rows.

An advisory GNU R 4.6.0 public-object black-box projection produced a 1,001-line, 25,055-byte CSV
with SHA-256 `c1b74ad3a6e5fa985db308d2f2a2c596f10a21bf151f85f03857b933655a1a90`; gzip level 9 is
8,952 bytes. Those observations characterize the compatibility target only. They are not checked in,
because no independently audited permissive/public-domain source for the exact subsample has yet
been established, and embedding the catalog in the initial Worker would violate its size gate.

Admission requires both an explicit redistribution basis independent of GNU R/R-derived mirrors and
a browser-local lazy-resource path that remains network-free while keeping the initial Worker within
budget. Until both gates close, NativR intentionally leaves `datasets::quakes` unavailable.
