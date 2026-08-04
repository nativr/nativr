# RFC-0003: pinned pure-R package corpus

Status: **accepted; implementation in progress**

## Corpus partitions

- **development** packages may identify semantic gaps and guide implementation;
- **regression** packages have reached a declared tier and must not regress;
- **holdout** packages are not used to guide implementation before their scheduled evaluation.

Moving a package out of holdout is a recorded corpus revision. All source URLs, versions, dependency
closures, source-archive SHA-256 digests, and evaluated NativR artifact SHA-256 digests are pinned.
The two digest domains are recorded separately; live repository state cannot redefine the corpus.

The first holdout rotation evaluated `assertthat 0.2.1` and `crayon 1.5.3`. Their initial P2
blockers led to reusable standard-`tools` dependency handling and a hidden, read-only
source-resource context for standard package `tools/` files. Both now reach P4 through unchanged
public source and have moved to regression. `praise 1.0.0` and `prettyunits 1.2.0` replace them as
uninspected P0 holdouts.

The second holdout rotation evaluated `praise 1.0.0` and `prettyunits 1.2.0` without first using
their R source to guide implementation. Both now reach P4 through unchanged public source. The
evaluation exposed reusable PCRE capture metadata, quoted call-tag normalization, `paste()` and
`sub()` coercion semantics, the `grDevices::convertColor` import surface, and build-time
normalization of bounded bzip2-compressed package data. Both packages moved to regression;
usage-ranked pure-R packages `evaluate 1.0.5` and `numDeriv 2016.8-1.1` are the new uninspected P0
holdouts.

The third holdout rotation evaluated `evaluate 1.0.5` and `numDeriv 2016.8-1.1` using release
metadata, public documentation, public API calls, and black-box GNU R observations without first
inspecting their R source. Both install, load, attach, and execute declared representative public
functions unchanged, so they move to P4 regression. Reusable gaps covered callable resolution and
exact formals, simple condition/source-reference shapes, post-ellipsis builtin argument matching,
and recursive data-frame columns. Usage-ranked pure-R packages `abind 1.4-8` and `rprojroot 2.1.1`
are the new uninspected P0 holdouts; only their release metadata and source-archive digests have
been admitted.

## Validation tiers

| Tier | Required evidence                              |
| ---- | ---------------------------------------------- |
| P0   | Source archive admitted and integrity verified |
| P1   | Every R source file parses                     |
| P2   | Namespace loads                                |
| P3   | Package attaches                               |
| P4   | Declared representative functions execute      |
| P5   | Applicable examples execute                    |
| P6   | Applicable package tests execute               |
| P7   | Applicable package-check behaviors pass        |

Results report the highest completed tier and first blocker; the word “supported” alone is
forbidden. A compatible package must use unmodified package code and no package-specific runtime
branch.

## CI tiers

Pull requests run a small pinned regression smoke set and affected semantic cases. Nightly jobs run
the full development and regression corpus. Holdout evaluation is scheduled and separately reported
so it measures generalization rather than implementation overfitting.
