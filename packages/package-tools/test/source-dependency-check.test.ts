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
      expect(assessment.status).toBe(expected.includes("failed") ? "failed" : "unexecuted");
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
    expect(result.status).toBe("unexecuted");
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

  it("leaves quoted, shadowed and cross-file bindings unresolved", () => {
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
    expect(
      result.references
        .filter((reference) => reference.package?.startsWith("quoted"))
        .every((reference) => reference.reason === "quoted-syntax"),
    ).toBe(true);
    expect(result.references.find((reference) => reference.kind === "require")?.reason).toBe(
      "shadowed-binding",
    );
    expect(result.files.every((file) => file.status === "unexecuted")).toBe(true);
    expect(inspect("`::` <- function(x, y) NULL; undeclared::x").references[0]?.reason).toBe(
      "shadowed-binding",
    );
  });

  it("keeps dynamic code, unsupported syntax, self references and unverified roles unexecuted", () => {
    const result = inspect(
      'eval(parse(text="HIDDEN_BODY")); do.call("library", list("unknown")); get("library")("unknown"); ownedfixture::f; library("bad/package")',
    );
    expect(result.unresolved.map((entry) => entry.reason)).toEqual(
      expect.arrayContaining([
        "dynamic-evaluation",
        "computed-callee",
        "self-reference",
        "invalid-package-literal",
      ]),
    );
    expect(result.status).toBe("unexecuted");
    expect(JSON.stringify(result)).not.toContain("HIDDEN_BODY");
    expect(JSON.stringify(result)).not.toContain("bad/package");
    for (const role of ["test", "example"] as const)
      expect(inspect("missingpkg::f", "", role).references[0]?.reason).toBe(
        "unverified-source-role",
      );
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
