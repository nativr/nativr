import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createParser } from "../../parser/src/index.js";
import type { NativRParser } from "../../parser/src/index.js";
import { inspectPackageSourceDependencies } from "../src/index.js";
import type { PackageDependencySource } from "../src/index.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

let parser: NativRParser;
beforeAll(async () => {
  parser = await createParser({
    treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
    rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url).href,
  });
});
afterAll(() => parser.dispose());

const description = "Package: ownedfixture\nVersion: 1.0.0\n";
const inspect = (
  source: string,
  dependency = "",
  role: PackageDependencySource["role"] = "package",
) =>
  inspectPackageSourceDependencies(
    description + dependency,
    [{ path: "R/owned.R", source, role }],
    (text) => parser.parse(text),
  );

describe("owned AST source dependency inventory", () => {
  it("checks the independently observed package-code declaration roles", () => {
    const source =
      'boot::boot; boot:::boot; library(boot); require(boot); requireNamespace("boot")';
    const cases = [
      ["", ["failed", "failed", "failed", "failed", "failed"]],
      ["Depends: boot\n", ["passed", "passed", "passed", "passed", "passed"]],
      ["Imports: boot\n", ["passed", "passed", "failed", "failed", "passed"]],
      ["Suggests: boot\n", ["passed", "passed", "passed", "passed", "passed"]],
      ["Enhances: boot\n", ["passed", "passed", "passed", "passed", "passed"]],
      ["LinkingTo: boot\n", ["failed", "failed", "failed", "failed", "failed"]],
    ] as const;
    for (const [dependencies, expected] of cases) {
      const assessment = inspect(source, dependencies);
      expect(assessment.references.map((reference) => reference.status)).toEqual(expected);
      expect(assessment.status).toBe(expected.includes("failed") ? "failed" : "passed");
      expect(assessment.references.map((reference) => reference.package)).toEqual(
        Array(5).fill("boot"),
      );
    }
  });

  it("exempts base-priority packages and retains exact UTF-16 source locations and hashes", () => {
    const source = '"é"\nutils::head; stats::median; methods::is; base::library("stats")';
    const result = inspect(source);
    expect(result.references.every((reference) => reference.status === "passed")).toBe(true);
    expect(result.references[0]).toMatchObject({
      package: "utils",
      reason: "base-package",
      span: { start: { offset: 4, line: 2, column: 1 } },
    });
    expect(result.files).toEqual([
      {
        path: "R/owned.R",
        role: "package",
        status: "passed",
        sha256: createHash("sha256").update(source).digest("hex"),
      },
    ]);
    expect(result.descriptionSha256).toBe(createHash("sha256").update(description).digest("hex"));
    expect(result.status).toBe("passed");
    expect(result.policy).toBe("literal-source-references-v2");
    expect(result.checks.every((check) => check.id.startsWith("source-dependency:"))).toBe(true);
  });

  it("handles literal controls and argument matching without evaluating expressions", () => {
    const result = inspect(
      [
        "library(boot)",
        'library("boot", character.only=TRUE)',
        "library(boot, character.only=TRUE)",
        'require("boot", char=FALSE)',
        "requireNamespace(boot)",
        'requireNamespace(pack="boot")',
        'library("boot", character.only=stop("MUST_NOT_EVALUATE"))',
        'library("boot", NULL, 2, NULL, TRUE)',
        'library("boot", package="stats")',
        'require("boot", package="stats", p="utils")',
        "library(...)",
      ].join("\n"),
      "Suggests: boot\n",
    );
    const calls = result.references.filter((reference) => reference.kind !== "::");
    expect(calls.map((reference) => reference.status)).toEqual([
      "passed",
      "passed",
      "unexecuted",
      "passed",
      "unexecuted",
      "passed",
      "unexecuted",
      "passed",
      "passed",
      "unexecuted",
      "unexecuted",
    ]);
    expect(calls[2]?.package).toBe(null);
    expect(calls[6]?.reason).toBe("computed-character-only");
    expect(calls[9]?.reason).toBe("ambiguous-arguments");
    expect(JSON.stringify(result)).not.toContain("MUST_NOT_EVALUATE");
  });

  it("recognizes base-qualified loaders without treating another package's member as base", () => {
    const result = inspect(
      'base::library(boot); base:::require("boot"); base::requireNamespace("boot"); other::library(boot)',
      "Suggests: boot\n",
    );
    expect(result.references.filter((reference) => reference.package === "boot")).toHaveLength(3);
    expect(result.references.filter((reference) => reference.package === "base")).toHaveLength(3);
    expect(result.references.find((reference) => reference.package === "other")?.status).toBe(
      "failed",
    );
  });

  it("scans quoted syntax but leaves shadowed and cross-file bindings unresolved", () => {
    const result = inspectPackageSourceDependencies(
      description,
      [
        {
          path: "R/use.R",
          source:
            "library(unknown); base::library(unknown); quote(quoted::x); expression(quoted2::x)",
        },
        {
          path: "R/bind.R",
          source: "library <- function(x) NULL; f <- function(require) require(unknown2)",
        },
      ],
      (source) => parser.parse(source),
    );
    expect(
      result.references.find(
        (reference) => reference.kind === "library" && reference.span?.start.offset === 0,
      )?.reason,
    ).toBe("shadowed-binding");
    expect(
      result.references
        .filter((reference) => reference.package === "unknown")
        .map((reference) => reference.status),
    ).toEqual(["unexecuted", "failed"]);
    // Native R CMD check reports undeclared packages referenced inside quote() (RFC-0008).
    expect(
      result.references
        .filter((reference) => reference.package?.startsWith("quoted"))
        .map((reference) => [reference.status, reference.reason]),
    ).toEqual([
      ["failed", "undeclared-package"],
      ["failed", "undeclared-package"],
    ]);
    expect(result.references.find((reference) => reference.kind === "require")?.reason).toBe(
      "shadowed-binding",
    );
    expect(result.files.every((file) => file.status === "unexecuted")).toBe(true);
    expect(inspect("`::` <- function(x, y) NULL; undeclared::x").references[0]?.reason).toBe(
      "shadowed-binding",
    );
  });

  it("records dynamic code as outside the static check and keeps invalid literals unresolved", () => {
    const result = inspect(
      'eval(parse(text="HIDDEN_BODY")); do.call("library", list("unknown")); get("library")("unknown"); ownedfixture::f; library("bad/package")',
    );
    expect(result.unresolved.map((entry) => entry.reason)).toEqual(["invalid-package-literal"]);
    expect(
      result.checks.filter((check) => check.reason === "outside-static-scope").length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      result.references.find((reference) => reference.package === "ownedfixture"),
    ).toMatchObject({ status: "passed", reason: "self-reference" });
    expect(result.status).toBe("unexecuted");
    expect(JSON.stringify(result)).not.toContain("HIDDEN_BODY");
    expect(JSON.stringify(result)).not.toContain("bad/package");
  });

  it("applies the natively observed example and test roles", () => {
    // Examples report any undeclared non-base package; tests only installed ones (RFC-0008).
    expect(inspect("missingpkg::f", "", "example").references[0]).toMatchObject({
      status: "failed",
      reason: "undeclared-package",
    });
    expect(inspect("missingpkg::f", "", "test").references[0]).toMatchObject({
      status: "passed",
      reason: "uninstalled-test-reference",
    });
    expect(inspect("library(MASS)", "", "test").references[0]).toMatchObject({
      status: "failed",
      reason: "undeclared-package",
    });
    expect(inspect("library(boot)", "Imports: boot\n", "example").references[0]?.status).toBe(
      "passed",
    );
    expect(inspect("library(boot)", "Imports: boot\n").references[0]?.status).toBe("failed");
    const custom = inspectPackageSourceDependencies(
      description,
      [{ path: "tests/t.R", source: "library(closurepkg)", role: "test" }],
      (text) => parser.parse(text),
      { installed: new Set(["closurepkg"]) },
    );
    expect(custom.references[0]?.status).toBe("failed");
  });

  it("treats empty index and dots placeholders as inert syntax", () => {
    const result = inspect("f <- function(x, ...) g(x[, 1], ...)");
    expect(result.unresolved).toEqual([]);
    expect(result.status).toBe("passed");
  });

  it("never leaks source bodies, parser diagnostics, arbitrary AST values or exception text", () => {
    const secret = "OWNED_PRIVATE_BODY_NOT_FOR_REPORTING";
    const source = `stop("${secret}")`;
    const throwing = inspectPackageSourceDependencies(
      description,
      [{ path: "R/fixture.R", source }],
      () => {
        throw new Error(secret);
      },
    );
    expect(throwing.files[0]?.status).toBe("unexecuted");
    expect(throwing.unresolved[0]?.reason).toBe("parse-failed");
    expect(JSON.stringify(throwing)).not.toContain(secret);
    const malformed = inspectPackageSourceDependencies(
      description,
      [{ path: "R/fixture.R", source }],
      () => ({
        ast: {
          kind: "ConstantExpression",
          get value() {
            throw new Error(secret);
          },
          display: { kind: "NamespaceExpression", namespace: { kind: "Identifier", name: secret } },
        },
        diagnostics: [{ severity: "warning", message: secret }],
      }),
    );
    expect(malformed.unresolved.map((entry) => entry.reason)).toEqual([
      "parse-diagnostics",
      "unsupported-ast",
    ]);
    expect(JSON.stringify(malformed)).not.toContain(secret);
  });

  it("does not convert parser recovery, malformed DESCRIPTION, or unknown AST nodes into failures", () => {
    const recovered = inspectPackageSourceDependencies(
      description,
      [{ path: "R/x.R", source: "missingpkg::f" }],
      (source) => ({
        ast: parser.parse(source).ast,
        diagnostics: [{ severity: "error" }],
      }),
    );
    expect(recovered.references[0]?.reason).toBe("parse-diagnostics");
    expect(recovered.status).toBe("unexecuted");
    const invalid = inspectPackageSourceDependencies(
      "PRIVATE INVALID DESCRIPTION",
      [{ path: "R/x.R", source: "missingpkg::f" }],
      (source) => parser.parse(source),
    );
    expect(invalid.references[0]?.reason).toBe("invalid-description");
    expect(JSON.stringify(invalid)).not.toContain("PRIVATE INVALID");
    const unknown = inspectPackageSourceDependencies(
      description,
      [{ path: "R/x.R", source: "" }],
      () => ({
        ast: { kind: "FutureOwnedSyntax", source: "PRIVATE NODE CONTENT" },
        diagnostics: [],
      }),
    );
    expect(unknown.unresolved[0]?.reason).toBe("unsupported-ast");
    expect(JSON.stringify(unknown)).not.toContain("PRIVATE NODE");
  });

  it("handles cycles without following arbitrary object fields", () => {
    const ast: { kind: string; body: unknown[] } = { kind: "Program", body: [] };
    ast.body.push(ast);
    const result = inspectPackageSourceDependencies(
      description,
      [{ path: "R/cycle.R", source: "" }],
      () => ({ ast, diagnostics: [] }),
    );
    expect(result.unresolved[0]?.reason).toBe("unsupported-ast");
    expect(result.status).toBe("unexecuted");
  });
});

// Independent package fixtures; the optional oracle sees no third-party source bodies.
// Only fixed boolean classifications from the fixtures' check output leave the runner.
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches GNU R declaration roles using independently authored package fixtures",
  async () => {
    const result = await capturePackageOracleScript({
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 300_000,
      source: `local({
        Sys.setenv(LC_ALL="C", LANG="C", \`_R_CHECK_FORCE_SUGGESTS_\`="false", \`_R_CHECK_CRAN_INCOMING_\`="false")
        root <- tempfile("owned-source-dependencies-"); dir.create(root)
        old <- setwd(root); on.exit({setwd(old); unlink(root, recursive=TRUE)})
        for (role in c("none", "Depends", "Imports", "Suggests", "Enhances", "LinkingTo")) {
          name <- paste0("ownedfixture", tolower(role)); dir.create(name); dir.create(file.path(name,"R"))
          desc <- c(paste0("Package: ",name),"Version: 1.0.0","Title: Independent Dependency Fixture",
            "Description: Independently authored dependency role fixture.","License: GPL-2",
            "Author: Fixture Author","Maintainer: Fixture Author <fixture@example.invalid>")
          if (role != "none") desc <- c(desc,paste0(role,": boot"))
          writeLines(desc,file.path(name,"DESCRIPTION")); writeLines("export(ownref)",file.path(name,"NAMESPACE"))
          writeLines("ownref <- function() { boot::boot; boot:::boot; library(boot); require(boot); requireNamespace('boot'); utils::head; stats::median }", file.path(name,"R","own.R"))
          out <- paste0(name,".log")
          executable <- file.path(R.home("bin"),if (.Platform$OS.type == "windows") "R.exe" else "R")
          suppressWarnings(system2(executable,c("CMD","check","--no-manual","--no-examples","--no-tests","--no-vignettes","--no-build-vignettes","--no-codoc","--no-usage",name),stdout=out,stderr=out))
          lines <- readLines(out,warn=FALSE)
          if (!any(grepl("checking dependencies in R code",lines,fixed=TRUE))) stop("Independent fixture dependency check did not run")
          namespace <- any(grepl("'::' or ':::' import not declared from: 'boot'",lines,fixed=TRUE))
          attach <- any(grepl("'library' or 'require' call not declared from: 'boot'",lines,fixed=TRUE))
          requireNamespace <- any(grepl("'loadNamespace' or 'requireNamespace' call not declared from: 'boot'",lines,fixed=TRUE))
          cat(role,as.integer(namespace),as.integer(attach),as.integer(requireNamespace),sep="|"); cat(";")
        }
      })`,
    });
    expect(result.status).toBe("completed");
    expect(result.stdout).toBe(
      "none|1|1|1;Depends|0|0|0;Imports|0|1|0;Suggests|0|0|0;Enhances|0|0|0;LinkingTo|1|1|1;",
    );
  },
  330_000,
);

// RFC-0008 policy v2: each fixture source is classified by NativR and by native R CMD check.
const scopeFixtures = {
  code: [
    "f <- function() {",
    "  eval(quote(library(zzquotedattach)))",
    '  do.call("library", list("zzdynamicattach"))',
    '  g <- get("library"); g(zzaliasattach)',
    "  zzliteralns::thing",
    "}",
  ].join("\n"),
  example: "if (FALSE) library(zzexampleattach)\nif (FALSE) library(MASS)",
  test: "if (FALSE) library(zztestattach)\nif (FALSE) library(MASS)\nif (FALSE) lattice::xyplot",
} as const;

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches GNU R scope rules for quoted, dynamic, example and test references",
  async () => {
    const nativr = inspectPackageSourceDependencies(
      "Package: ownedscope\nVersion: 1.0.0\n",
      [
        { path: "R/scope.R", source: scopeFixtures.code, role: "package" },
        { path: "man/scope.Rd", source: scopeFixtures.example, role: "example" },
        { path: "tests/scope.R", source: scopeFixtures.test, role: "test" },
      ],
      (text) => parser.parse(text),
    );
    const failed = new Set(
      nativr.references
        .filter((reference) => reference.status === "failed")
        .map((reference) => `${reference.role}:${reference.package}`),
    );
    const result = await capturePackageOracleScript({
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 300_000,
      source: `local({
        Sys.setenv(LC_ALL="C", LANG="C", \`_R_CHECK_FORCE_SUGGESTS_\`="false")
        root <- tempfile("owned-scope-"); dir.create(root)
        old <- setwd(root); on.exit({setwd(old); unlink(root, recursive=TRUE)})
        name <- "ownedscope"; dir.create(file.path(name, "R"), recursive=TRUE)
        dir.create(file.path(name, "man")); dir.create(file.path(name, "tests"))
        writeLines(c("Package: ownedscope","Version: 1.0.0","Title: Independent Scope Fixture",
          "Description: Independently authored dependency scope fixture.","License: GPL-2",
          "Author: Fixture Author","Maintainer: Fixture Author <fixture@example.invalid>"),
          file.path(name,"DESCRIPTION"))
        writeLines("export(f)", file.path(name,"NAMESPACE"))
        writeLines(${JSON.stringify(scopeFixtures.code)}, file.path(name,"R","scope.R"))
        writeLines(c("\\\\name{f}","\\\\alias{f}","\\\\title{F}","\\\\usage{f()}","\\\\value{None.}",
          "\\\\description{Fixture.}","\\\\examples{",${JSON.stringify(scopeFixtures.example)},"}"),
          file.path(name,"man","f.Rd"))
        writeLines(${JSON.stringify(scopeFixtures.test)}, file.path(name,"tests","scope.R"))
        out <- "scope.log"
        executable <- file.path(R.home("bin"),if (.Platform$OS.type == "windows") "R.exe" else "R")
        suppressWarnings(system2(executable,c("CMD","check","--no-manual","--no-tests","--no-vignettes","--no-build-vignettes",name),stdout=out,stderr=out))
        lines <- readLines(out,warn=FALSE)
        section <- function(start) {
          i <- grep(start, lines, fixed=TRUE)[1]; if (is.na(i)) stop("check item did not run: ", start)
          j <- i + 1L; while (j <= length(lines) && !startsWith(lines[j], "* ")) j <- j + 1L
          lines[i:(j - 1L)]
        }
        flagged <- function(lines, pkg) any(grepl(paste0("'", pkg, "'"), lines, fixed=TRUE))
        code <- section("checking dependencies in R code")
        ex <- section("checking for unstated dependencies in examples")
        te <- section("checking for unstated dependencies in 'tests'")
        for (p in c("zzquotedattach","zzdynamicattach","zzaliasattach","zzliteralns")) if (flagged(code, p)) cat("package:", p, ";", sep="")
        for (p in c("zzexampleattach","MASS")) if (flagged(ex, p)) cat("example:", p, ";", sep="")
        for (p in c("zztestattach","MASS","lattice")) if (flagged(te, p)) cat("test:", p, ";", sep="")
      })`,
    });
    expect(result.status, result.stderr).toBe("completed");
    const native = new Set(result.stdout.split(";").filter((item) => item.length > 0));
    expect([...failed].sort()).toEqual([...native].sort());
  },
  330_000,
);
