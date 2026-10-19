import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { c as createTar } from "tar";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createParser } from "../../parser/src/index.js";
import type { NativRParser } from "../../parser/src/index.js";
import { createR } from "../../nativr/src/index.js";
import { collectDocumentationProbes, inspectPackageDocumentation } from "../src/index.js";
import { observePackageDocumentation } from "../../../scripts/lib/package-documentation-observer.mjs";
import { createPackageOracle } from "../../../scripts/lib/package-oracle.mjs";

// Owned fixtures and public signature APIs only. No method bodies are observed.
const description =
  "Package: owneds4\nVersion: 1.0.0\nTitle: Owned Fixture\nDescription: Independent S4 documentation fixture.\nLicense: MIT\nAuthor: Fixture\nMaintainer: Fixture <f@example.invalid>\nImports: methods\n";
const namespace = "import(methods)\nexport(owned, paired)\n";
const definitions = [
  'setClass("Owned", representation=list(value="numeric"))',
  'setClass("Other", representation=list(value="numeric"))',
  'owned <- function(x, ...) standardGeneric("owned")',
  'setGeneric("owned", owned)',
  'setMethod("owned", "Owned", function(x, extra=2, ...) x@value)',
  'setMethod("owned", "Other", function(x, other=3, ...) x@value)',
  'paired <- function(x, y, ...) standardGeneric("paired")',
  'setGeneric("paired", paired)',
  'setMethod("paired", c("Owned","Other"), function(x, y, tag=4, ...) x@value)',
  'setMethod("names<-", "Owned", function(x, value) x)',
  "`owned,Owned-method` <- function(unrelated) NULL",
].join("\n");
const cases = [
  ["generic", "owned", "owned(x, ...)", "match"],
  ["owned", "owned,Owned-method", "\\S4method{owned}{Owned}(x, extra=2L, ...)", "match"],
  ["other", "owned,Other-method", "\\S4method{owned}{Other}(x, other=3, ...)", "match"],
  ["mismatch", "owned,Other-method", "\\S4method{owned}{Other}(x, other=5, ...)", "mismatch"],
  [
    "paired",
    "paired,Owned,Other-method",
    "\\S4method{paired}{Owned,Other}(x, y, tag=4, ...)",
    "match",
  ],
  ["replacement", "names<-,Owned-method", "\\S4method{names}{Owned}(x) <- value", "match"],
  ["missing", "owned,Absent-method", "\\S4method{owned}{Absent}(x, ...)", "missing"],
  ["ordinary", "owned,Owned-method", "`owned,Owned-method`(unrelated)", "match"],
] as const;
const rdFiles = cases.map(([name, alias, usage]) => ({
  path: "man/" + name + ".Rd",
  text:
    "\\name{" +
    name +
    "}\\alias{" +
    alias +
    "}\\title{Owned}\\usage{" +
    usage +
    "}\\description{Owned.}\\keyword{internal}",
}));
let parser: NativRParser;
let captureError: unknown;
beforeAll(async () => {
  parser = await createParser({
    treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
    rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url).href,
  });
});
afterAll(() => parser.dispose());
const collect = () => collectDocumentationProbes(rdFiles, (source) => parser.parse(source));

it("preserves exact method identities, replacement methods and ordinary same-named symbols", () => {
  const probes = collect();
  expect(probes.map(({ name }) => name)).toEqual(cases.map(([, alias]) => alias));
  expect(probes.map(({ method }) => method)).toEqual([
    undefined,
    { generic: "owned", classes: ["Owned"] },
    { generic: "owned", classes: ["Other"] },
    { generic: "owned", classes: ["Other"] },
    { generic: "paired", classes: ["Owned", "Other"] },
    { generic: "names<-", classes: ["Owned"] },
    { generic: "owned", classes: ["Absent"] },
    undefined,
  ]);
  expect(probes[1]?.signature).toBe("function(`x`, `extra` = 2L, `...`) NULL");
  expect(probes[5]?.signature).toBe("function(`x`, `value`) NULL");
  const assessed = inspectPackageDocumentation(
    {
      packageName: "owneds4",
      rdFiles,
      exports: [],
      installedAliases: new Map(),
      functions: new Map([["owned,Owned-method", [{ name: "unrelated" }]]]),
    },
    (source) => parser.parse(source),
  );
  expect(
    assessed.checks
      .filter(({ id }) => id.startsWith("rd:usage:"))
      .every(({ status }) => status === "passed"),
  ).toBe(true);
  const codoc = assessed.checks.filter(({ id }) => id.startsWith("rd:codoc:"));
  expect(codoc.map(({ status }) => status)).toEqual([
    ...Array<string>(7).fill("unexecuted"),
    "passed",
  ]);
});

it("keeps same-file generic, method, repeated method and same-named binding probes separate", () => {
  const text =
    "\\usage{owned(x, ...)\n\\S4method{owned}{Owned}(x,extra=2,...)\n\\S4method{owned}{Other}(x,other=3,...)\n\\S4method{owned}{Owned}(x,extra=4,...)\n`owned,Owned-method`(unrelated)}";
  const probes = collectDocumentationProbes([{ path: "man/mixed.Rd", text }], (source) =>
    parser.parse(source),
  );
  expect(probes.map(({ id }) => id)).toEqual([
    "rd:codoc:man/mixed.Rd:owned",
    "rd:codoc:man/mixed.Rd:owned,Owned-method",
    "rd:codoc:man/mixed.Rd:owned,Other-method",
    "rd:codoc:man/mixed.Rd:owned,Owned-method#2",
    "rd:codoc:man/mixed.Rd:owned,Owned-method#3",
  ]);
  expect(probes[4]?.method).toBeUndefined();
});

async function capture(source: string) {
  const runtime = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    },
    packages: [{ description, namespace, rSources: [{ path: "R/owned.R", source: definitions }] }],
  });
  try {
    const result = await runtime.evalDetailed(source);
    return {
      status: "completed",
      stdout: result.output
        .filter((item) => item.stream === "stdout")
        .map((item) => item.text)
        .join(""),
    };
  } catch (error) {
    captureError = error;
    throw error;
  } finally {
    await runtime.dispose();
  }
}

it("reports unavailable method reflection without comparing generic or ordinary signatures", async () => {
  const result = await observePackageDocumentation("owneds4", collect(), {
    actual: capture,
    expected: capture,
  });
  expect(result.actual.status, String(captureError)).toBe("completed");
  expect(result.actual.states).toEqual([
    "match",
    "unknown",
    "unknown",
    "unknown",
    "unknown",
    "unknown",
    "unknown",
    "match",
  ]);
  expect(result.functions.map(({ status }) => status)).toEqual([
    "passed",
    ...Array<string>(6).fill("unexecuted"),
    "passed",
  ]);
});

describe.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")("native S4 metadata", () => {
  let temporary: string;
  let oracle: Awaited<ReturnType<typeof createPackageOracle>>;
  beforeAll(async () => {
    temporary = await mkdtemp(path.join(os.tmpdir(), "nativr-owned-s4-doc-"));
    const root = path.join(temporary, "owneds4");
    await mkdir(path.join(root, "R"), { recursive: true });
    await mkdir(path.join(root, "man"));
    await writeFile(path.join(root, "DESCRIPTION"), description);
    await writeFile(path.join(root, "NAMESPACE"), namespace);
    await writeFile(path.join(root, "R/owned.R"), definitions);
    for (const file of rdFiles) await writeFile(path.join(root, file.path), file.text);
    const archive = path.join(temporary, "fixture.tar.gz");
    await createTar({ cwd: temporary, gzip: true, file: archive }, ["owneds4"]);
    oracle = await createPackageOracle({
      archive,
      expectedPackage: { name: "owneds4", version: "1.0.0" },
      expectedSourceSha256: createHash("sha256")
        .update(await readFile(archive))
        .digest("hex"),
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
  }, 60_000);
  afterAll(async () => {
    await oracle?.dispose();
    if (temporary !== undefined) await rm(temporary, { recursive: true, force: true });
  });
  it("observes rematched defaults, multi-argument signatures, replacements and missing methods", async () => {
    const result = await observePackageDocumentation("owneds4", collect(), {
      actual: capture,
      expected: (source) => oracle.capture({ source }),
    });
    expect(result.expected.status).toBe("completed");
    expect(result.expected.states).toEqual(cases.map(([, , , state]) => state));
    expect(result.functions.slice(1, 7).every(({ status }) => status === "unexecuted")).toBe(true);
    const native = await oracle.capture({
      source:
        'cat(paste(sort(names(tools::codoc(package="owneds4"))),collapse="|")); invisible(NULL)',
    });
    expect(native.status).toBe("completed");
    expect(native.stdout).toBe("mismatch.Rd");
  });
});
