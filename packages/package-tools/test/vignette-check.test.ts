import { describe, expect, it } from "vitest";
import { extractVignetteCode, inspectPackageVignettes, isVignetteSource } from "../src/index.js";

const file = (path: string, text: string) => ({ path, text, bytes: text.length });

describe("vignette sources", () => {
  it("recognizes Sweave and R Markdown sources", () => {
    expect(["a.Rnw", "a.Stex", "a.rtex", "a.Rmd", "a.rmd"].map(isVignetteSource)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(["a.tex", "a.R", "a.pdf", "a.md"].map(isVignetteSource)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("extracts evaluated Sweave chunks and skips eval=FALSE", () => {
    const text = [
      "\\documentclass{article}",
      "<<setup>>=",
      "x <- 1",
      "@",
      "Some text \\Sexpr{x}.",
      "<<skipped, eval=FALSE>>=",
      "stop('never')",
      "@",
      "<<a, echo=TRUE>>=",
      "y <- x + 1",
      "<<b>>=",
      "z <- y * 2",
      "@",
    ].join("\n");
    expect(extractVignetteCode("v.Rnw", text)).toBe("x <- 1\ny <- x + 1\nz <- y * 2");
  });

  it("extracts evaluated R Markdown chunks and skips eval=FALSE", () => {
    const text = [
      "---",
      "title: t",
      "---",
      "```{r}",
      "a <- 1",
      "```",
      "```{r, eval = FALSE}",
      "stop('never')",
      "```",
      "```{python}",
      "print(1)",
      "```",
      "```{r named}",
      "b <- a",
      "```",
    ].join("\n");
    expect(extractVignetteCode("v.Rmd", text)).toBe("a <- 1\nb <- a");
  });
});

describe("inspectPackageVignettes", () => {
  const source = "%\\VignetteIndexEntry{Guide}\n<<>>=\n1 + 1\n@\n";

  it("passes a vignette with index entry, installed outputs and a matching source copy", () => {
    const assessment = inspectPackageVignettes([
      file("vignettes/Guide.Rnw", source),
      file("inst/doc/Guide.Rnw", source),
      file("inst/doc/Guide.R", "1 + 1\n"),
      file("inst/doc/Guide.pdf", "%PDF"),
    ]);
    expect(assessment.sources).toEqual([
      { path: "vignettes/Guide.Rnw", topic: "Guide", code: "1 + 1", indexEntry: "Guide" },
    ]);
    expect(assessment.vignetteChecks.map((check) => check.status)).toEqual(["passed"]);
    expect(
      assessment.installedDocumentationChecks.map((check) => [check.id, check.status]),
    ).toEqual([
      ["inst-doc:outputs:Guide", "passed"],
      ["inst-doc:source:Guide", "passed"],
      ["inst-doc:pdf-size:inst/doc/Guide.pdf", "passed"],
    ]);
  });

  it("fails a missing index entry and a diverging installed source", () => {
    const assessment = inspectPackageVignettes([
      file("vignettes/Guide.Rnw", "<<>>=\n1\n@\n"),
      file("inst/doc/Guide.Rnw", "changed"),
    ]);
    expect(assessment.vignetteChecks.map((check) => check.status)).toEqual(["failed"]);
    expect(
      assessment.installedDocumentationChecks.map((check) => [check.id, check.status]),
    ).toEqual([
      ["inst-doc:outputs:Guide", "unexecuted"],
      ["inst-doc:source:Guide", "failed"],
    ]);
  });

  it("is empty for a package without vignettes", () => {
    const assessment = inspectPackageVignettes([]);
    expect(assessment.sources).toEqual([]);
    expect(assessment.vignetteChecks).toEqual([]);
    expect(assessment.installedDocumentationChecks).toEqual([]);
  });
});
