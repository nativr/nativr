import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createParser } from "../../parser/src/index.js";
import type { NativRParser } from "../../parser/src/index.js";
import { inspectPackageNamespaceSource, s3Consistent } from "../src/index.js";
import type { NamespaceSourceInput } from "../src/index.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

let parser: NativRParser;
beforeAll(async () => {
  parser = await createParser({
    treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
    rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url).href,
  });
});
afterAll(() => parser.dispose());

const surface = JSON.parse(
  readFileSync(new URL("../../../compatibility/gnu-r/surface.json", import.meta.url), "utf8"),
) as {
  packages: { name: string; exports: { name: string; formals?: string[] | null }[] }[];
};
const coreExports: NamespaceSourceInput["coreExports"] = new Map(
  surface.packages.map((pkg) => [
    pkg.name,
    new Map(pkg.exports.map((entry) => [entry.name, entry.formals ?? null])),
  ]),
);

// Independently authored fixture sources. The expected outcomes below were observed with native
// GNU R 4.6.1 R CMD check on packages built from exactly these sources (RFC-0008).
const freeVariableSource = [
  "f1 <- function(x) { y <- 1; for (i in x) y <- y + i; y + missingA }",
  "f2 <- function(d) with(d, aWith + bWith)",
  '    f3 <- function(d) d$col + d[["k"]] + d@slotz',
  "f4 <- function() quote(zzQuoted + 1)",
  "f5 <- function(m) lm(yForm ~ xForm, data = m)",
  "f6 <- function() { g <- function() hiddenLater; hiddenLater <- 2; g() }",
  "f7 <- function() { superTarget <<- 3; superTarget }",
  "f8 <- function(x) stats::median(x) + utils::head(x)",
  "f9 <- function(x) helperInPkg(x)",
  "helperInPkg <- function(x) x",
  "f10 <- function(...) list(...)",
  "f11 <- function(x) x |> sort()",
  "f12 <- function(x) substitute(zzSubst)",
  "f13 <- function(x) bquote(.(x) + zzBquote)",
  'f14 <- function(x) { x$a <- 1; names(x) <- "q"; attr(x, "z") <- unknownRhs; x }',
  "f15 <- function(x) local({ v <- 1; v + x })",
  "f16 <- function(x) if (missing(x)) T else F",
  "f17 <- function() .packageName",
  "f18 <- function(x) { fn <- function(k) k + outerArg; outerArg <- x; fn(1) }",
  "f19 <- function(x) sapply(x, function(e) e + lambdaFree)",
  "f20 <- function(x) { if (FALSE) neverCalled(); x }",
  "f21 <- function(x) x %myop% 2",
  "f22 <- function() unknownFn",
  "f23 <- function(x, n = length(x)) n",
].join("\n");
const nativeUndefined = [
  "%myop%",
  "lambdaFree",
  "lm",
  "missingA",
  "superTarget",
  "unknownFn",
  "unknownRhs",
];

const s3Source = [
  "f <- function(x) x",
  "mygen <- function(x, y, ...) UseMethod('mygen')",
  "print.a <- function(x, digits = 1, ...) x",
  "t.b <- function(x, extra) x",
  "summary.c <- function(object, extra, ...) object",
  "format.d <- function(x, ..., extra) x",
  "as.character.e <- function(y, ...) y",
  "mygen.k <- function(x, ...) x",
  "mygen.m <- function(x, y, z, ...) x",
  "rev.n <- function(x, ...) x",
  "print.z <- function(x) x",
  "merge.p <- function(x, ...) x",
  "mygen.q <- function(x, w, ...) x",
  "mygen.r <- function(x) x",
  "summary.s <- function(object, ..., digits) object",
  "`g<-` <- function(x, val) x",
  "`h<-` <- function(x, value) x",
  'callsC <- function(x) .C("cfun", x)',
].join("\n");
const s3Namespace = [
  "export(f, mygen)",
  ...["print, a", "t, b", "summary, c", "format, d", "as.character, e", "mygen, k", "mygen, m"],
  ...["rev, n", "print, z", "merge, p", "mygen, q", "mygen, r", "summary, s"],
].map((entry, index) => (index === 0 ? entry : `S3method(${entry})`));
// Natively flagged methods: t.b, as.character.e, print.z, mygen.q and mygen.r.
const nativeInconsistent = ["as.character.e", "mygen.q", "mygen.r", "print.z", "t.b"];

const assess = (source: string, namespace: string) =>
  inspectPackageNamespaceSource(
    {
      packageName: "ownedfixture",
      depends: [],
      namespace,
      sources: [{ path: "R/f.R", bytes: new TextEncoder().encode(source) }],
      hasIndex: false,
      coreExports,
    },
    (text) => parser.parse(text),
  );

describe("namespace-source checks", () => {
  it("reports the natively observed undefined globals as a NOTE", () => {
    const result = assess(freeVariableSource, "export(f1)");
    expect(result.undefinedGlobals).toEqual(nativeUndefined);
    const problems = result.checks.find((check) => check.id === "code:possible-problems");
    expect(problems?.status).toBe("passed");
    expect(problems?.notes).toContain(
      "f19 : <anonymous>: no visible binding for global variable 'lambdaFree'",
    );
    expect(problems?.notes).toContain(
      "f7: no visible binding for '<<-' assignment to 'superTarget'",
    );
  });

  it("applies the natively observed S3, replacement and foreign-call rules", () => {
    const result = assess(s3Source, s3Namespace.join("\n"));
    const failedS3 = result.checks
      .filter((check) => check.id.startsWith("s3:") && check.status === "failed")
      .map((check) => check.id.slice(3))
      .sort();
    expect(failedS3).toEqual(nativeInconsistent);
    expect(result.checks.find((check) => check.id === "replacement:g<-")?.status).toBe("failed");
    expect(result.checks.find((check) => check.id === "replacement:h<-")?.status).toBe("passed");
    expect(result.checks.find((check) => check.id.startsWith("foreign:callsC"))?.status).toBe(
      "failed",
    );
    expect(result.status).toBe("failed");
  });

  it("encodes the observed consistency rule directly", () => {
    expect(s3Consistent(["x", "..."], ["x", "digits", "..."])).toBe(true);
    expect(s3Consistent(["x"], ["x", "extra"])).toBe(false);
    expect(s3Consistent(["x", "y", "..."], ["x", "..."])).toBe(true);
    expect(s3Consistent(["x", "..."], ["x"])).toBe(false);
    expect(s3Consistent(["x"], ["x", "..."])).toBe(true);
  });

  it("passes a clean package and keeps unresolvable imports unexecuted", () => {
    const clean = assess("f <- function(x) utils::head(x)", "export(f)\nimportFrom(utils, head)");
    expect(clean.status).toBe("passed");
    const unknown = assess("f <- function(x) x", "export(f)\nimport(notacorepkg)");
    expect(unknown.checks.find((check) => check.id === "code:possible-problems")?.status).toBe(
      "unexecuted",
    );
    const missing = inspectPackageNamespaceSource(
      {
        packageName: "ownedfixture",
        depends: [],
        namespace: undefined,
        sources: [],
        hasIndex: false,
        coreExports,
      },
      (text) => parser.parse(text),
    );
    expect(missing.checks.find((check) => check.id === "namespace:present")?.status).toBe("failed");
  });
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native R CMD check for undefined globals and S3 consistency",
  async () => {
    const result = await capturePackageOracleScript({
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      timeoutMs: 300_000,
      source: `local({
        Sys.setenv(LC_ALL="C", LANG="C", \`_R_CHECK_FORCE_SUGGESTS_\`="false")
        root <- tempfile("owned-namespace-"); dir.create(root)
        old <- setwd(root); on.exit({setwd(old); unlink(root, recursive=TRUE)})
        build <- function(name, source, namespace) {
          dir.create(file.path(name, "R"), recursive=TRUE)
          writeLines(c(paste0("Package: ", name),"Version: 1.0.0","Title: Independent Namespace Fixture",
            "Description: Independently authored namespace fixture.","License: GPL-2",
            "Author: Fixture Author","Maintainer: Fixture Author <fixture@example.invalid>"),
            file.path(name,"DESCRIPTION"))
          writeLines(namespace, file.path(name,"NAMESPACE"))
          writeLines(source, file.path(name,"R","f.R"))
          out <- paste0(name, ".log")
          executable <- file.path(R.home("bin"),if (.Platform$OS.type == "windows") "R.exe" else "R")
          suppressWarnings(system2(executable,c("CMD","check","--no-manual","--no-examples","--no-tests","--no-vignettes","--no-build-vignettes",name),stdout=out,stderr=out))
          readLines(out, warn=FALSE)
        }
        lines <- build("ownedglobals", ${JSON.stringify(freeVariableSource)}, "export(f1)")
        i <- grep("Undefined global functions or variables:", lines, fixed=TRUE)
        globals <- if (length(i)) strsplit(trimws(lines[i + 1L]), " +")[[1]] else character()
        cat("globals=", paste(sort(globals), collapse=","), ";", sep="")
        lines <- build("owneds3", ${JSON.stringify(s3Source)}, c(${s3Namespace.map((line) => JSON.stringify(line)).join(",")}))
        methods <- sub(":$", "", grep("^[A-Za-z.]+\\\\.[a-z]:$", lines, value=TRUE))
        cat("s3=", paste(sort(methods), collapse=","), ";", sep="")
      })`,
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe(
      `globals=${[...nativeUndefined].sort().join(",")};s3=${nativeInconsistent.join(",")};`,
    );
  },
  600_000,
);
