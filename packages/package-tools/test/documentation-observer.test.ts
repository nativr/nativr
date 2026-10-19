import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { c as createTar } from "tar";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createR } from "../../nativr/src/index.js";
import { createParser } from "../../parser/src/index.js";
import type { NativRParser } from "../../parser/src/index.js";
import { collectDocumentationProbes, inspectPackageDocumentation } from "../src/index.js";
import type { DocumentationProbe, DocumentationInput } from "../src/index.js";
import { observePackageDocumentation } from "../../../scripts/lib/package-documentation-observer.mjs";
import { createPackageOracle } from "../../../scripts/lib/package-oracle.mjs";

// Independently authored inputs. No imported function body is inspected or serialized.
const description =
  "Package: owneddoc\nVersion: 1.0.0\nTitle: Owned Documentation Fixture\nDescription: Independent metadata observations.\nLicense: MIT\nAuthor: Fixture\nMaintainer: Fixture <f@example.invalid>\nImports: stats\n";
const namespace =
  'exportPattern("^pub")\nexport(zero, numericType, changed, reorder, extra, expr, near, literalNA, fold, missing, lazy, closureDefault)\nimportFrom(stats, na.omit)\n';
const definitions = [
  "pubComputed <- local({ hidden <- 7; function(x, y=2) x+y+hidden })",
  "pubValue <- 7L",
  "zero <- function() NULL",
  "numericType <- function(x=2) x",
  "changed <- function(x=2) x",
  "reorder <- function(x,y) x",
  "extra <- function(x,...) x",
  "expr <- function(x=1+2) x",
  "near <- function(x=2) x",
  "literalNA <- function(x=NA_real_) x",
  "fold <- function(x=1+2) x",
  "missing <- function(x) x",
  'lazy <- function(x=stop("MUST_NOT_FORCE")) x',
  "closureDefault <- function(x=function(y) y) x",
  "logicalNA <- function(x=NA) x",
  "nan <- function(x=NaN) x",
  "numericExpr <- function(x=c(a=1)) x",
  "negativeZero <- function(x=-0) x",
  "paren <- function(x=(2)) x",
  "nameOrder <- function(x=c(a=1,b=2)) x",
  "characterNA <- function(x=NA_character_) x",
  "complexNA <- function(x=NA_complex_) x",
  "boolean <- function(x=TRUE) x",
].join("\n");
const matrix = [
  ["pubComputed", "pubComputed(x,y=2)", "passed"],
  ["zero", "zero()", "passed"],
  ["numericType", "numericType(x=2L)", "passed"],
  ["changed", "changed(x=3)", "failed"],
  ["reorder", "reorder(y,x)", "failed"],
  ["extra", "extra(x)", "failed"],
  ["expr", "expr(x=1 + 2)", "passed"],
  ["near", "near(x=2.0000000000001)", "failed"],
  ["literalNA", "literalNA(x=NA_integer_)", "passed"],
  ["fold", "fold(x=3)", "failed"],
  ["missing", "missing(x=NULL)", "failed"],
  ["lazy", 'lazy(x=stop("MUST_NOT_FORCE"))', "passed"],
  ["closureDefault", "closureDefault(x=function(y) y)", "passed"],
  ["na.omit", "na.omit(object, ...)", "passed"],
  ["logicalNA", "logicalNA(x=NA_real_)", "passed"],
  ["nan", "nan(x=NA_real_)", "failed"],
  ["numericExpr", "numericExpr(x=c(a=1L))", "passed"],
  ["negativeZero", "negativeZero(x=0)", "failed"],
  ["paren", "paren(x=2)", "failed"],
  ["nameOrder", "nameOrder(x=c(b=2,a=1))", "failed"],
  ["characterNA", "characterNA(x=NA)", "failed"],
  ["complexNA", "complexNA(x=NA_real_)", "passed"],
  ["boolean", "boolean(x=1)", "failed"],
] as const;
const rdFiles = matrix.map(([name, usage]) => ({
  path: `man/${name}.Rd`,
  text: `\\name{${name}}\\alias{${name}}\\title{Owned}\\usage{${usage}}\\description{Independent fixture.}`,
}));
let parser: NativRParser;
let probes: DocumentationProbe[];
let captureError: unknown;
beforeAll(async () => {
  parser = await createParser({
    treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
    rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url).href,
  });
  probes = collectDocumentationProbes(rdFiles, (source) => parser.parse(source));
});
afterAll(() => parser.dispose());

async function capture(source: string, extra = "") {
  const runtime = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    },
    packages: [
      { description, namespace, rSources: [{ path: "R/main.R", source: definitions + extra }] },
    ],
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

it("collects repeated, replacement and S3 usage with no executable body", () => {
  const rd = String.raw`\usage{f(x=stop("lazy"))
f(x=2)
\method{print}{owned}(x, \dots)
value(x) <- value
odd(1+2)}`;
  const result = collectDocumentationProbes([{ path: "man/f.Rd", text: rd }], (text) =>
    parser.parse(text),
  );
  expect(result.map(({ id, name, signature }) => [id, name, signature])).toEqual([
    ["rd:codoc:man/f.Rd:f", "f", 'function(`x` = stop("lazy")) NULL'],
    ["rd:codoc:man/f.Rd:f#2", "f", "function(`x` = 2) NULL"],
    ["rd:codoc:man/f.Rd:print.owned", "print.owned", "function(`x`, `...`) NULL"],
    ["rd:codoc:man/f.Rd:value<-", "value<-", "function(`x`, `value`) NULL"],
    ["rd:codoc:man/f.Rd:odd", "odd", null],
  ]);
});

it("matches the native signature matrix using complete static metadata", () => {
  const functions = new Map<string, readonly { name: string; defaultValue?: unknown }[]>();
  for (const node of parser.parse(definitions).ast.body) {
    if (node.kind === "AssignmentExpression" && node.value.kind === "FunctionExpression")
      functions.set(node.target.name, node.value.parameters);
  }
  const input: DocumentationInput = {
    packageName: "owneddoc",
    rdFiles,
    functions,
    exports: [],
    installedAliases: new Map(),
  };
  const result = inspectPackageDocumentation(input, (text) => parser.parse(text));
  expect(
    result.checks.filter(({ id }) => id.startsWith("rd:codoc:")).map(({ status }) => status),
  ).toEqual(
    matrix.map(([name, , status]) =>
      name === "pubComputed" || name === "na.omit" ? "unexecuted" : status,
    ),
  );
});

it("observes computed definitions, imported signatures, zero args and all exportPattern bindings", async () => {
  const result = await observePackageDocumentation("owneddoc", probes, {
    actual: capture,
    expected: capture,
  });
  expect(result.exportsStatus, String(captureError)).toBe("passed");
  expect(result.actual.exports).toContain("pubValue");
  expect(result.functions.map(({ status }) => status)).toEqual(
    matrix.map(([, , status]) => status),
  );
  expect(JSON.stringify(result)).not.toContain("MUST_NOT_FORCE");
  expect(JSON.stringify(result)).not.toContain("hidden");
  const assessed = inspectPackageDocumentation(
    {
      packageName: "owneddoc",
      rdFiles,
      exports: result.actual.exports ?? [],
      functions: new Map(),
      installedAliases: new Map(),
      loaded: {
        exportsStatus: result.exportsStatus,
        functions: new Map(result.functions.map(({ id, status }) => [id, status])),
      },
    },
    (source) => parser.parse(source),
  );
  expect(assessed.checks.find(({ id }) => id === "rd:missing-documentation")?.status).toBe(
    "failed",
  );
  expect(
    assessed.checks.filter(({ id }) => id.startsWith("rd:codoc:")).map(({ status }) => status),
  ).toEqual(matrix.map(([, , status]) => status));
});

it("does not force active bindings and keeps missing/noncallable signatures inconclusive", async () => {
  const source =
    '\n.onLoad <- function(...) makeActiveBinding("active", function() stop("MUST_NOT_FORCE"), environment(.onLoad))';
  const extra: DocumentationProbe[] = ["active", "absent", "pubValue"].map((name) => ({
    id: name,
    name,
    signature: "function() NULL",
  }));
  extra.push({
    id: "active-s4",
    name: "active,Owned-method",
    signature: "function() NULL",
    method: { generic: "active", classes: ["Owned"] },
  });
  extra.push({
    id: "empty-s4",
    name: "zero,-method",
    signature: "function() NULL",
    method: { generic: "zero", classes: [] },
  });
  const run = (text: string) => capture(text, source);
  const result = await observePackageDocumentation("owneddoc", extra, {
    actual: run,
    expected: run,
  });
  expect(result.actual.states, String(captureError)).toEqual([
    "active",
    "missing",
    "noncallable",
    "active",
    "unknown",
  ]);
  expect(result.functions.every(({ status }) => status === "unexecuted")).toBe(true);
});

it("bounds unsupported recursive syntax without discarding the export observation", async () => {
  const probe = {
    id: "closure-default-change",
    name: "closureDefault",
    signature: "function(x=function(y)y+1) NULL",
  };
  const result = await observePackageDocumentation("owneddoc", [probe], {
    actual: capture,
    expected: capture,
  });
  expect(result.exportsStatus, String(captureError)).toBe("passed");
  expect(result.actual.states).toEqual(["unknown"]);
  expect(result.functions[0]?.status).toBe("unexecuted");
});

function frame(names: string[], states: string[]) {
  return `\nNATIVR_DOCUMENTATION_BEGIN\n${names.length}\n${names.map((name) => `${Buffer.from(name).toString("hex")}\n`).join("")}${states.join("|")}\nNATIVR_DOCUMENTATION_END\n`;
}
it.each([
  "",
  "unframed output",
  frame(["f"], ["match"]) + "trailing",
  frame(["f", "f"], ["match"]),
  frame(["f"], []),
])("rejects incomplete or malformed paired evidence %j", async (stdout) => {
  const result = await observePackageDocumentation("owneddoc", [probes[0]!], {
    actual: () => Promise.resolve({ status: "completed", stdout }),
    expected: () => Promise.resolve({ status: "completed", stdout: frame(["f"], ["match"]) }),
  });
  expect(result.exportsStatus).toBe("unexecuted");
  expect(result.functions[0]?.status).toBe("unexecuted");
});
it("retains export mismatches and unknown signatures without falling back to static success", async () => {
  const result = await observePackageDocumentation("owneddoc", [probes[0]!], {
    actual: () =>
      Promise.resolve({ status: "completed", stdout: frame(["pubComputed"], ["match"]) }),
    expected: () =>
      Promise.resolve({
        status: "completed",
        stdout: frame(["pubComputed", "pubValue"], ["unknown"]),
      }),
  });
  expect(result.exportsStatus).toBe("failed");
  expect(result.functions[0]?.status).toBe("unexecuted");
  const assessed = inspectPackageDocumentation(
    {
      packageName: "owneddoc",
      rdFiles: [rdFiles[1]!],
      exports: ["zero"],
      functions: new Map([["zero", []]]),
      installedAliases: new Map(),
      loaded: { exportsStatus: "unexecuted", functions: new Map() },
    },
    (source) => parser.parse(source),
  );
  expect(
    assessed.checks
      .filter(({ id }) => id === "rd:missing-documentation" || id.startsWith("rd:codoc:"))
      .every(({ status }) => status === "unexecuted"),
  ).toBe(true);
});

it("distinguishes paired mismatches from missing evidence and accepts complete empty catalogs", async () => {
  const run = (states: string[]) => () =>
    Promise.resolve({ status: "completed", stdout: frame([], states) });
  const mismatch = await observePackageDocumentation("owneddoc", [probes[0]!], {
    actual: run(["match"]),
    expected: run(["mismatch"]),
  });
  expect(mismatch.functions[0]?.status).toBe("failed");
  const empty = await observePackageDocumentation("owneddoc", [], {
    actual: run([]),
    expected: run([]),
  });
  expect(empty.exportsStatus).toBe("passed");
  expect(empty.actual.exports).toEqual([]);
  expect(empty.functions).toEqual([]);
});

describe.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "native documentation metadata parity",
  () => {
    let temporary: string;
    let oracle: Awaited<ReturnType<typeof createPackageOracle>>;
    beforeAll(async () => {
      temporary = await mkdtemp(path.join(os.tmpdir(), "nativr-documentation-fixture-"));
      const root = path.join(temporary, "owneddoc");
      await mkdir(path.join(root, "R"), { recursive: true });
      await mkdir(path.join(root, "man"));
      await writeFile(path.join(root, "DESCRIPTION"), description);
      await writeFile(path.join(root, "NAMESPACE"), namespace);
      await writeFile(path.join(root, "R/main.R"), definitions);
      for (const file of rdFiles) await writeFile(path.join(root, file.path), file.text);
      const archive = path.join(temporary, "fixture.tar.gz");
      await createTar({ cwd: temporary, gzip: true, file: archive }, ["owneddoc"]);
      oracle = await createPackageOracle({
        archive,
        expectedPackage: { name: "owneddoc", version: "1.0.0" },
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
    it("agrees with native loaded metadata and codoc outcomes on the owned matrix", async () => {
      let details = "";
      const result = await observePackageDocumentation("owneddoc", probes, {
        actual: capture,
        expected: async (source) => {
          const result = await oracle.capture({ source });
          details = JSON.stringify({
            status: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
          });
          return result;
        },
      });
      expect(result.exportsStatus, details).toBe("passed");
      expect(result.actual.states).toEqual(result.expected.states);
      expect(result.functions.map(({ status }) => status)).toEqual(
        matrix.map(([, , status]) => status),
      );
      const native = await oracle.capture({
        source:
          'cat(paste(sort(names(tools::codoc(package="owneddoc"))), collapse="|")); invisible(NULL)',
      });
      expect(native.status).toBe("completed");
      expect(native.stdout).toBe(
        matrix
          .filter(([, , status]) => status === "failed")
          .map(([name]) => `${name}.Rd`)
          .sort()
          .join("|"),
      );
    });
    it("distinguishes an unknown primitive signature from a known zero-argument signature", async () => {
      const unknown = { id: "unknown", name: "[", signature: "function(`x`, `...`) NULL" };
      const result = await observePackageDocumentation("owneddoc", [unknown, probes[1]!], {
        actual: capture,
        expected: (source) => oracle.capture({ source }),
      });
      expect(result.expected.states).toEqual(["unknown", "match"]);
      expect(result.functions.map(({ status }) => status)).toEqual(["unexecuted", "passed"]);
    });
  },
);
