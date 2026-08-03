# RFC-0003: pinned pure-R package corpus

Status: **accepted; implementation in progress**

## Corpus partitions

- **development** packages may identify semantic gaps and guide implementation;
- **regression** packages have reached a declared tier and must not regress;
- **holdout** packages are not used to guide implementation before their scheduled evaluation.

Moving a package out of holdout is a recorded corpus revision. All source URLs, versions, dependency
closures, source-archive SHA-256 digests, and evaluated NativR artifact SHA-256 digests are pinned.
The two digest domains are recorded separately; live repository state cannot redefine the corpus.

The first holdout rotation evaluated `assertthat 0.2.1` and `crayon 1.5.3`. Both complete P1 and
record an exact P2 blocker: the missing standard `tools` namespace dependency for `assertthat`, and
the relative `tools/ansi-palettes.txt` namespace resource read for `crayon`. Neither is described as
compatible. `praise 1.0.0` and `prettyunits 1.2.0` replace them as uninspected P0 holdouts.

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
