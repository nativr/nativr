import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createParser } from "../../parser/src/index.js";
import type { NativRParser } from "../../parser/src/index.js";
import {
  inspectPackageDocumentation,
  inspectPackageManual,
  parseRd,
  rdText,
} from "../src/index.js";
import type { DocumentationInput } from "../src/index.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

let parser: NativRParser;
beforeAll(async () => {
  parser = await createParser({
    treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
    rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url).href,
  });
});
afterAll(() => parser.dispose());

const catalog = JSON.parse(
  readFileSync(new URL("../../../compatibility/gnu-r/rd-aliases.json", import.meta.url), "utf8"),
) as { packages: Record<string, string[]>; files: Record<string, string[]> };
const installedAliases: DocumentationInput["installedAliases"] = new Map(
  Object.entries(catalog.packages).map(([name, aliases]) => [name, new Set(aliases)]),
);
const installedFiles: DocumentationInput["installedFiles"] = new Map(
  Object.entries(catalog.files).map(([name, files]) => [name, new Set(files)]),
);

// Independently authored fixture. Native GNU R 4.6.1 R CMD check on exactly these files reports
// WARNINGs for: the f.Rd missing link, the undocumented export, codoc mismatches in f.Rd (extra y)
// and g.Rd (default b), and \usage problems in f.Rd (undocumented y) and g.Rd (extra zz).
const code = "f <- function(x) x\ng <- function(a, b = 2) a + b\nundocumented <- function() NULL\n";
const fRd = [
  "\\name{f}",
  "\\alias{f}",
  "\\alias{f}",
  "\\title{F}",
  "\\usage{f(x, y)}",
  "\\arguments{\\item{x}{a value}}",
  "\\value{a value}",
  "\\description{See \\link{nonexistentTopic} and \\code{\\link{g}}.}",
].join("\n");
const gRd = [
  "\\name{g}",
  "\\alias{g}",
  "\\title{G}",
  "\\usage{g(a, b = 3)}",
  "\\arguments{\\item{a}{first}\\item{b}{second}\\item{zz}{not an argument}}",
  "\\value{sum}",
  "\\description{G.}",
].join("\n");
const nativeFailed = [
  "rd:codoc:man/f.Rd:f",
  "rd:codoc:man/g.Rd:g",
  "rd:links:man/f.Rd",
  "rd:missing-documentation",
  "rd:usage:man/f.Rd",
  "rd:usage:man/g.Rd",
];

function functionsOf(source: string): DocumentationInput["functions"] {
  const result = new Map<string, { name: string; defaultValue?: unknown }[]>();
  const ast = parser.parse(source).ast as { body: Record<string, unknown>[] };
  for (const statement of ast.body) {
    const target = statement.target as { name?: string } | undefined;
    const value = statement.value as
      { kind: string; parameters: { name: string; defaultValue?: unknown }[] } | undefined;
    if (statement.kind === "AssignmentExpression" && value?.kind === "FunctionExpression")
      result.set(
        target?.name ?? "",
        value.parameters.map((parameter) => ({
          name: parameter.name,
          ...(parameter.defaultValue === undefined ? {} : { defaultValue: parameter.defaultValue }),
        })),
      );
  }
  return result;
}

const assess = (rdFiles: DocumentationInput["rdFiles"], source: string, exports: string[]) =>
  inspectPackageDocumentation(
    {
      packageName: "ownedfixture",
      rdFiles,
      exports,
      functions: functionsOf(source),
      installedAliases,
      installedFiles,
    },
    (text) => parser.parse(text),
  );

describe("Rd parsing", () => {
  it("preserves verbatim backslashes, braces and escaped percent while removing comments", () => {
    const nodes = parseRd(String.raw`\preformatted{a{b}\{c\}\%d%comment
\n}`);
    expect(nodes).toEqual([
      {
        kind: "macro",
        name: "preformatted",
        args: [[{ kind: "text", text: "a{b}{c}%d\n\\n" }]],
      },
    ]);
  });

  it("keeps percent in the first equation argument and treats href text as markup", () => {
    const nodes = parseRd(String.raw`\eqn{\ownedmath{a%literal}}{a%comment
}\href{https://example.invalid/\owned}{\emph{owned}}`);
    expect(nodes).toEqual([
      {
        kind: "macro",
        name: "eqn",
        args: [
          [{ kind: "text", text: String.raw`\ownedmath{a%literal}` }],
          [{ kind: "text", text: "a\n" }],
        ],
      },
      {
        kind: "macro",
        name: "href",
        args: [
          [{ kind: "text", text: String.raw`https://example.invalid/\owned` }],
          [{ kind: "macro", name: "emph", args: [[{ kind: "text", text: "owned" }]] }],
        ],
      },
    ]);
  });
  it("handles escapes, comments, nested macros and R-like strings", () => {
    const nodes = parseRd(
      '\\name{x} % comment\n\\usage{f("a}b", \\dots)\n\\method{print}{foo}(x, \\dots)}\n\\description{100\\% \\code{\\link{g}}}',
    );
    const sections = nodes.filter((node) => node.kind === "macro");
    expect(sections.map((node) => node.kind === "macro" && node.name)).toEqual([
      "name",
      "usage",
      "description",
    ]);
    const usage = sections[1];
    expect(usage?.kind === "macro" && rdText(usage.args[0] ?? [])).toContain('f("a}b", ...)');
    const description = sections[2];
    expect(description?.kind === "macro" && rdText(description.args[0] ?? [])).toBe("100% g");
  });
});

describe("documentation checks", () => {
  it("exempts only missing argument descriptions on internal pages", () => {
    const page = (usage: string, argumentsText = "", internal = true, alias = "f") =>
      String.raw`\name{f}\alias{${alias}}\title{Owned}\usage{${usage}}\description{Owned.}${argumentsText}${internal ? String.raw`\keyword{internal}` : ""}`;
    const cases = [
      [page("f(x,y=2)"), "passed", "passed"],
      [page("f(x,y=2)", "", false), "failed", "passed"],
      [page("f(x,y=2)", String.raw`\arguments{\item{extra}{Owned.}}`), "failed", "passed"],
      [page("f(x,y=2)", "", true, "different"), "failed", "passed"],
      [page("f(x,y=3)"), "passed", "failed"],
      [page("f(x"), "failed", undefined],
    ] as const;
    for (const [text, usage, codoc] of cases) {
      const result = assess([{ path: "man/f.Rd", text }], "f <- function(x,y=2) x", ["f"]);
      expect(result.checks.find(({ id }) => id === "rd:usage:man/f.Rd")?.status).toBe(usage);
      expect(result.checks.find(({ id }) => id === "rd:codoc:man/f.Rd:f")?.status).toBe(codoc);
    }
  });

  it.each([
    [String.raw`\link[base:mean]{owned}`, "passed"],
    [String.raw`\link[grDevices:cairo]{owned}`, "passed"],
    [String.raw`\link[grDevices]{cairo}`, "passed"],
    [String.raw`\link[base:median]{owned}`, "failed"],
    [String.raw`\link{cairo}`, "failed"],
    [String.raw`\link{ mean }`, "passed"],
    [String.raw`\link[base:zzownedmissing]{owned}`, "failed"],
    [String.raw`\link[ownedfixture:ownname]{owned}`, "failed"],
    [String.raw`\link[ownedfixture:ownfilename]{owned}`, "passed"],
    [String.raw`\link[ownedfixture:ownalias]{owned}`, "passed"],
    [String.raw`\link[ownedfixture:median]{owned}`, "failed"],
    [String.raw`\link[zzownedmissing:f]{owned}`, "unexecuted"],
    [String.raw`\link[=ownalias]{owned}`, "passed"],
  ])("resolves native cross-reference boundaries: %s", (link, status) => {
    const result = assess(
      [
        {
          path: "man/ownfilename.Rd",
          text: String.raw`\name{ownname}\alias{ownalias}\title{Owned}\description{Owned.}`,
        },
        {
          path: "man/link.Rd",
          text: String.raw`\name{link}\alias{link}\title{Owned}\description{${link}}`,
        },
      ],
      "",
      [],
    );
    expect(result.checks.find(({ id }) => id === "rd:links:man/link.Rd")?.status).toBe(status);
  });

  it("leaves qualified filename resolution inconclusive without a complete file catalog", () => {
    const result = inspectPackageDocumentation(
      {
        packageName: "ownedfixture",
        exports: [],
        functions: new Map(),
        installedAliases,
        rdFiles: [
          {
            path: "man/link.Rd",
            text: String.raw`\name{link}\title{Owned}\description{\link[grDevices:cairo]{owned}}`,
          },
        ],
      },
      (text) => parser.parse(text),
    );
    expect(result.checks.find(({ id }) => id === "rd:links:man/link.Rd")?.status).toBe(
      "unexecuted",
    );
  });
  it("keeps computed definitions inconclusive until loaded metadata is available", () => {
    const rd = String.raw`\name{f}\alias{f}\title{F}\usage{f(x, y=2)}\arguments{\item{x}{First.}\item{y}{Second.}}\description{Fixture.}`;
    const result = assess(
      [{ path: "man/f.Rd", text: rd }],
      "f <- local({ marker <- 3; function(x, y=2) x + y + marker })",
      ["f"],
    );
    expect(result.checks.find(({ id }) => id === "rd:codoc:man/f.Rd:f")?.status).toBe("unexecuted");
    expect(result.status).toBe("unexecuted");
  });

  it("gives repeated usage entries distinct identities and preserves conflicting outcomes", () => {
    const rd = String.raw`\name{f}\alias{f}\title{F}\usage{f(x, y=2)
f(x, y=3)}\arguments{\item{x}{First.}\item{y}{Second.}}\description{Fixture.}`;
    const result = assess([{ path: "man/f.Rd", text: rd }], "f <- function(x, y=2) x+y", ["f"]);
    expect(result.checks.filter(({ id }) => id.startsWith("rd:codoc:"))).toMatchObject([
      { id: "rd:codoc:man/f.Rd:f", status: "passed" },
      { id: "rd:codoc:man/f.Rd:f#2", status: "failed" },
    ]);
    expect(new Set(result.checks.map(({ id }) => id)).size).toBe(result.checks.length);
  });

  it("reports the natively observed documentation failures", () => {
    const result = assess(
      [
        { path: "man/f.Rd", text: fRd },
        { path: "man/g.Rd", text: gRd },
      ],
      code,
      ["f", "g", "undocumented"],
    );
    const failed = result.checks
      .filter((check) => check.status === "failed")
      .map((check) => check.id)
      .sort();
    expect(failed).toEqual(nativeFailed);
    expect(result.checks.find((check) => check.id === "rd:file:man/f.Rd")?.status).toBe("passed");
    expect(result.status).toBe("failed");
  });

  it("passes consistent documentation, including S3 method usage and installed links", () => {
    const rd = [
      "\\name{h}",
      "\\alias{h}",
      "\\title{H}",
      "\\usage{h(x, n = 2L, \\dots)\n\\method{print}{hh}(x, \\dots)}",
      "\\arguments{\\item{x}{a value}\\item{n}{a count}\\item{\\dots}{passed on}}",
      "\\value{x}",
      "\\description{Uses \\code{\\link{lm}} and \\link[stats:median]{the median}.}",
    ].join("\n");
    const source = "h <- function(x, n = 2L, ...) x\nprint.hh <- function(x, ...) x\n";
    const result = assess([{ path: "man/h.Rd", text: rd }], source, ["h"]);
    expect(result.checks.filter((check) => check.status !== "passed")).toEqual([]);
    expect(result.status).toBe("passed");
  });

  it("fails an Rd file without a unique title", () => {
    const result = assess(
      [{ path: "man/x.Rd", text: "\\name{x}\\alias{x}\\description{X.}" }],
      "",
      [],
    );
    expect(result.checks.find((check) => check.id === "rd:file:man/x.Rd")?.status).toBe("failed");
  });
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "observes computed definitions, dependency spacing and excluded example blocks in native check",
  async () => {
    const source = readFileSync(new URL("fixtures/checker-edge-cases.R", import.meta.url), "utf8");
    const result = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 180_000,
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout.replaceAll("\r\n", "\n")).toBe(
      [
        "DESCRIPTION meta-information:NOTE",
        "for code/documentation mismatches:OK",
        "for unstated dependencies in examples:WARNING",
        "zzownedrun=TRUE",
        "zzowneddontrun=FALSE",
        "zzowneddonttest=TRUE",
        "dependency strict=FALSE:FALSE",
        "dependency strict=TRUE:FALSE",
        "",
      ].join("\n"),
    );
  },
  200_000,
);

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native R CMD check documentation outcomes",
  async () => {
    const result = await capturePackageOracleScript({
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 300_000,
      source: `local({
        Sys.setenv(LC_ALL="C", LANG="C", \`_R_CHECK_FORCE_SUGGESTS_\`="false")
        root <- tempfile("owned-rd-"); dir.create(root)
        old <- setwd(root); on.exit({setwd(old); unlink(root, recursive=TRUE)})
        name <- "ownedrd"; dir.create(file.path(name, "R"), recursive=TRUE); dir.create(file.path(name, "man"))
        writeLines(c("Package: ownedrd","Version: 1.0.0","Title: Independent Rd Fixture",
          "Description: Independently authored documentation fixture.","License: GPL-2",
          "Author: Fixture Author","Maintainer: Fixture Author <fixture@example.invalid>"),
          file.path(name,"DESCRIPTION"))
        writeLines("export(f, g, undocumented)", file.path(name,"NAMESPACE"))
        writeLines(${JSON.stringify(code)}, file.path(name,"R","f.R"))
        writeLines(${JSON.stringify(fRd)}, file.path(name,"man","f.Rd"))
        writeLines(${JSON.stringify(gRd)}, file.path(name,"man","g.Rd"))
        out <- "rd.log"
        executable <- file.path(R.home("bin"),if (.Platform$OS.type == "windows") "R.exe" else "R")
        suppressWarnings(system2(executable,c("CMD","check","--no-manual","--no-examples","--no-tests","--no-vignettes","--no-build-vignettes",name),stdout=out,stderr=out))
        lines <- readLines(out, warn=FALSE)
        status <- function(item) {
          line <- grep(paste0("^\\\\* checking ", item), lines, value=TRUE)[1]
          if (is.na(line)) stop("check item did not run: ", item)
          sub(".* \\\\.\\\\.\\\\. ", "", line)
        }
        for (item in c("Rd files", "Rd cross-references", "for missing documentation entries",
                       "for code/documentation mismatches", "Rd \\\\\\\\usage sections", "Rd contents"))
          cat(item, "=", status(item), ";", sep="")
      })`,
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      "Rd files=OK;Rd cross-references=WARNING;for missing documentation entries=WARNING;" +
        "for code/documentation mismatches=WARNING;Rd \\\\usage sections=WARNING;Rd contents=OK;",
    );
  },
  300_000,
);

describe("manual text rendering (browser adaptation)", () => {
  it.each([
    [String.raw`\preformatted{cat("owned\n")}`, "passed"],
    [String.raw`\if{latex}{\out{\begin{center}owned\end{center}}}`, "passed"],
    [String.raw`\notARdMacro{owned}`, "failed"],
    [String.raw`\alpha`, "failed"],
    [String.raw`\eqn{\ownedmath{a%literal}}{a}`, "passed"],
    [String.raw`\href{https://example.invalid/\owned}{\emph{owned}}`, "passed"],
    [String.raw`\href{https://example.invalid}{\notARdMacro{owned}}`, "failed"],
  ])("classifies macros in context: %s", (context, status) => {
    const result = inspectPackageManual([
      { path: "man/owned.Rd", text: String.raw`\name{owned}\title{Owned}\description{${context}}` },
    ]);
    expect(result.status).toBe(status);
  });
  it("renders documented and package-defined macros and rejects unknown ones", () => {
    const result = inspectPackageManual([
      { path: "man/f.Rd", text: fRd },
      {
        path: "man/m.Rd",
        text: "\\newcommand{\\mymacro}{X}\n\\name{m}\\alias{m}\\title{M}\\description{\\mymacro \\eqn{\\alpha}{alpha}}",
      },
      { path: "man/u.Rd", text: "\\name{u}\\alias{u}\\title{U}\\description{\\notARdMacro{x}}" },
      { path: "man/s.Rd", text: "\\name{s}\\alias{s}\\title{S}\\description{\\Sexpr{1+1}}" },
    ]);
    expect(result.checks.map((check) => [check.id, check.status])).toEqual([
      ["manual:man/f.Rd", "passed"],
      ["manual:man/m.Rd", "passed"],
      ["manual:man/u.Rd", "failed"],
      ["manual:man/s.Rd", "unexecuted"],
    ]);
    expect(result.status).toBe("failed");
  });
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "observes internal usage, qualified filename links and verbatim contexts in native R",
  async () => {
    const result = await capturePackageOracleScript({
      source: readFileSync(new URL("fixtures/rd-contexts.R", import.meta.url), "utf8"),
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 180_000,
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout.replaceAll("\r\n", "\n")).toBe(
      [
        "usage:ordinary:TRUE",
        "usage:internal:FALSE",
        "usage:internalExtra:TRUE",
        "usage:internalAlias:TRUE",
        "usage:internalMismatch:FALSE",
        "usage:internalSyntax:TRUE",
        "codoc:internalMismatch:TRUE",
        "link:alias:FALSE",
        "link:topic:FALSE",
        "link:plainTopic:FALSE",
        "link:fallback:TRUE",
        "link:unqualified:TRUE",
        "link:spaces:FALSE",
        "link:missing:TRUE",
        "link:ownName:TRUE",
        "link:ownFilename:FALSE",
        "link:ownAlias:FALSE",
        "link:ownFallback:TRUE",
        "context:preformatted:completed:0",
        "context:out:completed:0",
        "context:unknown:completed:1",
        "context:outsideMath:completed:1",
        "context:equation:completed:0",
        "context:verbatim:completed:0",
        "verbatim-bytes:97,123,98,125,123,99,125,37,100,10,92,110",
        "context:url:completed:0",
        "",
      ].join("\n"),
    );
  },
  200_000,
);
