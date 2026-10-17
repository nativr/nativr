import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { c as createTar } from "tar";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createR } from "../../nativr/src/index.js";
import { createPackageOracle } from "../../../scripts/lib/package-oracle.mjs";
import { observePackageLifecycle } from "../../../scripts/lib/package-lifecycle-observer.mjs";
import { observeCleanBaseLoad } from "../../../scripts/lib/package-clean-base-observer.mjs";
import type { LifecycleObservation } from "../../../scripts/lib/package-lifecycle-observer.mjs";

it.each(["0.307.0", "0.312.0", "0.314.0", "0.315.0"])(
  "retains pinned lifecycle observations at %s without promoting P7",
  async (profile) => {
    const saved = JSON.parse(
      await readFile(
        new URL(
          `../../../compatibility/package-check-evidence/lifecycle-observations-${profile}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      observations: {
        package: { name: string; version: string };
        provenance: { sourceSha256: string; artifactSha256: string; semanticProfile: string };
        rawReportSha256: string;
        lifecycleObservation: LifecycleObservation;
        cleanBaseObservation?: {
          outcome: string;
          actual: { state: string };
          expected: { state: string };
        };
        lifecycleStage: { status: string; discovered: string[]; executed: string[] };
        p7Eligible: boolean;
      }[];
    };
    const corpus = JSON.parse(
      await readFile(
        new URL("../../../compatibility/package-corpus.json", import.meta.url),
        "utf8",
      ),
    ) as {
      packages: {
        package: string;
        version: string;
        sourceSha256: string;
        artifactSha256: string;
      }[];
    };
    expect(saved.observations.map((item) => item.package.name)).toEqual(["abind", "numDeriv"]);
    for (const item of saved.observations) {
      expect(corpus.packages.find((entry) => entry.package === item.package.name)).toMatchObject({
        version: item.package.version,
        sourceSha256: item.provenance.sourceSha256,
        artifactSha256: item.provenance.artifactSha256,
      });
      expect(item.rawReportSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(item.provenance.semanticProfile).toBe(profile);
      expect(item.lifecycleObservation).toMatchObject({
        outcome: "match",
        actual: {
          status: "completed",
          state: profile === "0.307.0" ? "0|0|1|0|1|1|1" : "0|0|1|0|1|1|1|1|0|0|0",
        },
        expected: {
          status: "completed",
          state: profile === "0.307.0" ? "0|0|1|0|1|1|1" : "0|0|1|0|1|1|1|1|0|0|0",
        },
      });
      expect(item.lifecycleStage.status).toBe("unexecuted");
      expect(item.lifecycleStage.executed).toEqual(
        profile === "0.307.0"
          ? ["install", "load", "attach"]
          : [
              "install",
              "load",
              "attach",
              "detach",
              "unload",
              ...(profile === "0.315.0" ? ["base-search-path-load"] : []),
            ],
      );
      if (profile === "0.315.0")
        expect(item.cleanBaseObservation).toMatchObject({
          outcome: "match",
          actual: { state: "1|1|0|1|0|1|1" },
          expected: { state: "1|1|0|1|0|1|1" },
        });
      expect(item.lifecycleStage.discovered.length).toBeGreaterThan(
        item.lifecycleStage.executed.length,
      );
      expect(item.p7Eligible).toBe(false);
    }
  },
);

it.each([
  ["NATIVR_LIFECYCLE:0|0|1|0|1|1|1|1|0|0|0\n", "match"],
  ["NATIVR_LIFECYCLE:0|0|1|0|1|1|2|1|0|0|0\n", "mismatch"],
  ["NATIVR_LIFECYCLE:1|1|1|1|1|1|1|1|0|0|0\n", "mismatch"],
  ["NATIVR_LIFECYCLE:0|0|1", "incomplete"],
])("classifies lifecycle evidence %j as %s", async (stdout, outcome) => {
  const result = await observePackageLifecycle("fixture", {
    actual: () => Promise.resolve({ status: "completed", stdout }),
    expected: () =>
      Promise.resolve({ status: "completed", stdout: "NATIVR_LIFECYCLE:0|0|1|0|1|1|1|1|0|0|0\n" }),
  });
  expect(result.outcome).toBe(outcome);
});

// Independently authored lifecycle fixture; no external package implementation is used.
const coreHooksProbe = `local({
  events <- character()
  for (event in c("detach","attach")) local({
    e <- event
    setHook(packageEvent("stats",e),function(pkg,path) events <<- c(events,e,pkg,basename(path),as.character("package:stats" %in% search())),"replace")
  })
  detach("package:stats"); library(stats)
  cat(paste(events,collapse="|")); invisible(NULL)
})`;

it("runs static package user callbacks with attached state and package paths", async () => {
  expect(await capture("core", coreHooksProbe)).toBe(
    "detach|stats|stats|TRUE|attach|stats|stats|TRUE",
  );
});

it.each([
  ["1|1|0|1|0|1|1", "match"],
  ["0|0|1|1|0|1|1", "mismatch"],
  ["1|1", "incomplete"],
])("classifies clean search-path state %s as %s", async (state, outcome) => {
  const result = await observeCleanBaseLoad("fixture", {
    actual: () => Promise.resolve({ status: "completed", stdout: `NATIVR_CLEAN_BASE:${state}\n` }),
    expected: () =>
      Promise.resolve({ status: "completed", stdout: "NATIVR_CLEAN_BASE:1|1|0|1|0|1|1\n" }),
  });
  expect(result.outcome).toBe(outcome);
});

it("does not credit a failed clean search-path load even with a valid marker", async () => {
  const result = await observeCleanBaseLoad("fixture", {
    actual: () =>
      Promise.resolve({ status: "failed", stdout: "NATIVR_CLEAN_BASE:1|1|0|1|0|1|1\n" }),
    expected: () => Promise.reject(new Error("oracle unavailable")),
  });
  expect(result.outcome).toBe("incomplete");
});

const description =
  "Package: lifecyclefixture\nVersion: 1.0.0\nTitle: Lifecycle Fixture\nDescription: Independently authored lifecycle observation fixture.\nAuthor: NativR Authors\nMaintainer: NativR Authors <fixture@example.invalid>\nLicense: MIT\nImports: stats\n";
const namespace = "export(value)\nS3method(length,lifecyclefixture)\nimportFrom(stats,median)\n";
const source = `
.onLoad <- function(libname, pkgname) {
  options(nativr.loads = getOption("nativr.loads", 0L) + 1L)
  if (isTRUE(getOption("nativr.fail.load", FALSE))) stop("load fixture")
}
.onAttach <- function(libname, pkgname) {
  options(nativr.attaches = getOption("nativr.attaches", 0L) + 1L)
  options(nativr.hook.search = "package:lifecyclefixture" %in% search(), nativr.hook.export = exists("value", envir = .GlobalEnv, inherits = TRUE))
  if (isTRUE(getOption("nativr.fail.attach", FALSE))) stop("attach fixture")
}
.onDetach <- function(libpath) {
  options(nativr.detaches=getOption("nativr.detaches",0L)+1L, nativr.detach.attached="package:lifecyclefixture" %in% search(), nativr.detach.loaded="lifecyclefixture" %in% loadedNamespaces(), nativr.detach.path=basename(libpath))
  if(isTRUE(getOption("nativr.fail.detach",FALSE))) stop("detach fixture")
}
.onUnload <- function(libpath) {
  options(nativr.unloads=getOption("nativr.unloads",0L)+1L, nativr.unload.loaded="lifecyclefixture" %in% loadedNamespaces(), nativr.unload.attached="package:lifecyclefixture" %in% search(), nativr.unload.path=basename(libpath))
  if(isTRUE(getOption("nativr.fail.unload",FALSE))) stop("unload fixture")
}
length.lifecyclefixture <- function(x) 91L
namespaceProbe <- function() c(median(1:3),inherits(try(sd(1:3),silent=TRUE),"try-error"),stats::sd(1:3),globalMarker)
value <- function() 42L
`;
function probe(phase: string): string {
  return `
options(nativr.fail.${phase} = TRUE)
failed <- inherits(try(library(lifecyclefixture), silent = TRUE), "try-error")
before <- c(failed, "lifecyclefixture" %in% loadedNamespaces(), "package:lifecyclefixture" %in% search(), getOption("nativr.loads",0L), getOption("nativr.attaches",0L))
options(nativr.fail.${phase} = FALSE)
library(lifecyclefixture)
after <- c("lifecyclefixture" %in% loadedNamespaces(), "package:lifecyclefixture" %in% search(), getOption("nativr.loads",0L), getOption("nativr.attaches",0L), value())
library(lifecyclefixture)
cat(paste(c(before, after, getOption("nativr.loads"), getOption("nativr.attaches"), getOption("nativr.hook.search"), getOption("nativr.hook.export")), collapse="|"))
invisible(NULL)
`;
}
const searchChainProbe = `
library(lifecyclefixture)
e <- as.environment("package:lifecyclefixture")
saved <- value
initial <- c(identical(parent.env(globalenv()), e), identical(parent.env(e), as.environment(3)))
unlockBinding("value", e)
assign("value", function() 43L, envir=e)
ns <- asNamespace("lifecyclefixture")
unlockBinding("value", ns)
assign("value", function() 99L, envir=ns)
cat(paste(c(initial, value(), lifecyclefixture::value(), saved()), collapse="|"))
invisible(NULL)
`;
function detachProbe(fail: boolean): string {
  return `
library(lifecyclefixture)
saved <- as.environment("package:lifecyclefixture")
options(nativr.fail.detach=${fail ? "TRUE" : "FALSE"})
warnings <- 0L
globalCallingHandlers(warning=function(w) { warnings <<- warnings+1L; invisible(NULL) })
result <- withVisible(detach(package:lifecyclefixture))
before <- c(is.null(result$value),result$visible,"package:lifecyclefixture" %in% search(),"lifecyclefixture" %in% loadedNamespaces(),identical(parent.env(saved),baseenv()),getOption("nativr.detach.attached"),getOption("nativr.detach.loaded"),getOption("nativr.detach.path")=="lifecyclefixture",get("value",saved)(),warnings)
library(lifecyclefixture)
cat(paste(c(before,getOption("nativr.loads"),getOption("nativr.attaches"),getOption("nativr.detaches"),!identical(saved,as.environment(2)),value()),collapse="|"))
invisible(NULL)
`;
}
it.each([false, true])("detaches and reattaches after hook failure=%s", async (fail) => {
  expect(await capture("detach", detachProbe(fail))).toBe(
    `1|0|0|1|1|1|1|1|42|${fail ? 1 : 0}|1|2|1|1|42`,
  );
});
function unloadProbe(fail: boolean, viaDetach: boolean): string {
  return `
library(lifecyclefixture)
ns <- asNamespace("lifecyclefixture"); f <- value
options(nativr.fail.unload=${fail ? "TRUE" : "FALSE"})
warnings <- 0L
globalCallingHandlers(warning=function(w) { warnings <<- warnings+1L; invisible(NULL) })
result <- withVisible(${viaDetach ? 'detach("package:lifecyclefixture",unload=TRUE)' : "unloadNamespace(ns)"})
before <- c(is.null(result$value),result$visible,"lifecyclefixture" %in% loadedNamespaces(),"package:lifecyclefixture" %in% search(),getOption("nativr.unload.loaded"),getOption("nativr.unload.attached"),getOption("nativr.unload.path")=="lifecyclefixture",environmentName(ns)=="lifecyclefixture",f(),length(structure(1:2,class="lifecyclefixture")),warnings)
library(lifecyclefixture)
cat(paste(c(before,getOption("nativr.loads"),getOption("nativr.attaches"),getOption("nativr.unloads"),getOption("nativr.detaches"),!identical(ns,asNamespace("lifecyclefixture")),value(),get("value",ns)()),collapse="|"))
invisible(NULL)
`;
}
it.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])("unloads with failure=%s viaDetach=%s", async (fail, viaDetach) => {
  expect(await capture("unload", unloadProbe(fail, viaDetach))).toBe(
    `1|0|0|0|1|0|1|1|42|91|${fail ? 1 : 0}|2|2|1|1|1|42|42`,
  );
});
function userHookProbe(fail: boolean): string {
  return `
events <- character()
for (event in c("onLoad","attach","detach","onUnload")) local({
  e <- event
  setHook(packageEvent("lifecyclefixture",e),function(pkgname,pkgpath) {
    events <<- c(events,paste(e,pkgname,basename(pkgpath),"lifecyclefixture" %in% loadedNamespaces(),"package:lifecyclefixture" %in% search(),getOption("nativr.loads",0L),getOption("nativr.attaches",0L),getOption("nativr.detaches",0L),getOption("nativr.unloads",0L),sep=":"))
    if(e == "onLoad") {
      setHook(packageEvent("lifecyclefixture",e),NULL,"replace")
      if(${fail ? "TRUE" : "FALSE"}) stop("user callback fixture")
    }
  })
})
namedCallback <- function(...) events <<- c(events,"second")
setHook(packageEvent("lifecyclefixture","onLoad"),list("namedCallback",namedCallback))
library(lifecyclefixture)
unloadNamespace("lifecyclefixture")
cat(paste(c(events,length(getHook(packageEvent("lifecyclefixture","onLoad")))),collapse="|"))
invisible(NULL)
`;
}
it.each([false, true])(
  "runs lifecycle callbacks in order and survives user failure=%s",
  async (fail) => {
    expect(await capture("hooks", userHookProbe(fail))).toBe(
      "onLoad:lifecyclefixture:lifecyclefixture:TRUE:FALSE:1:0:0:0|second|attach:lifecyclefixture:lifecyclefixture:TRUE:TRUE:1:1:0:0|detach:lifecyclefixture:lifecyclefixture:TRUE:TRUE:1:1:0:0|onUnload:lifecyclefixture:lifecyclefixture:TRUE:FALSE:1:1:1:0|0",
    );
  },
);
const namespaceProbe = `
before <- c(!identical(baseenv(),asNamespace("base")),identical(parent.env(asNamespace("base")),globalenv()),!exists("median",baseenv(),inherits=FALSE),identical(environment(mean),asNamespace("base")),identical(environment(median),asNamespace("stats")),identical(graphics::plot,base::plot))
invisible(asNamespace("lifecyclefixture"))
globalMarker <- 7L
global <- globalenv()
savedParent <- parent.env(global)
parent.env(global) <- baseenv()
observed <- get("namespaceProbe",asNamespace("lifecyclefixture"))()
parent.env(global) <- savedParent
cat(paste(c(before,observed),collapse="|"))
invisible(NULL)
`;
it("isolates core namespaces and retains explicit imports under a base-only search path", async () => {
  expect(await capture("namespace", namespaceProbe)).toBe("1|1|1|1|1|1|2|1|1|7");
});
async function capture(phase: string, code = probe(phase)) {
  const runtime = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    },
    packages: [{ description, namespace, rSources: [{ path: "R/main.R", source }] }],
  });
  try {
    const result = await runtime.evalDetailed(code);
    return result.output
      .filter((item) => item.stream === "stdout")
      .map((item) => item.text)
      .join("");
  } finally {
    await runtime.dispose();
  }
}

it.each(["load", "attach"])("can retry a failed %s hook in the same session", async (phase) => {
  expect(await capture(phase)).toBe(
    phase === "load" ? "1|0|0|1|0|1|1|2|1|42|2|1|1|1" : "1|1|0|1|1|1|1|1|2|42|1|2|1|1",
  );
});

it("uses attached environment bindings for global lookup while keeping namespace bindings separate", async () => {
  expect(await capture("search", searchChainProbe)).toBe("1|1|43|99|42");
});

describe.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")("native lifecycle parity", () => {
  let temporary: string;
  let oracle: Awaited<ReturnType<typeof createPackageOracle>>;
  beforeAll(async () => {
    temporary = await mkdtemp(path.join(os.tmpdir(), "nativr-lifecycle-fixture-"));
    const root = path.join(temporary, "lifecyclefixture");
    await mkdir(path.join(root, "R"), { recursive: true });
    await writeFile(path.join(root, "DESCRIPTION"), description);
    await writeFile(path.join(root, "NAMESPACE"), namespace);
    await writeFile(path.join(root, "R/main.R"), source);
    const archive = path.join(temporary, "fixture.tar.gz");
    await createTar({ cwd: temporary, gzip: true, file: archive }, ["lifecyclefixture"]);
    oracle = await createPackageOracle({
      archive,
      expectedPackage: { name: "lifecyclefixture", version: "1.0.0" },
      expectedSourceSha256: createHash("sha256")
        .update(await readFile(archive))
        .digest("hex"),
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
  });
  afterAll(async () => {
    await oracle?.dispose();
    if (temporary !== undefined) await rm(temporary, { recursive: true, force: true });
  });
  it("compares attached environment identity and mutation with GNU R", async () => {
    const expected = await oracle.capture({ source: searchChainProbe });
    expect(expected.status, expected.stderr).toBe("completed");
    expect(await capture("search", searchChainProbe)).toBe(expected.stdout);
  });
  it("compares core package user callbacks with GNU R", async () => {
    const expected = await oracle.capture({ source: coreHooksProbe });
    expect(expected.status, expected.stderr).toBe("completed");
    expect(await capture("core", coreHooksProbe)).toBe(expected.stdout);
  });
  it("compares core isolation and explicit imports with GNU R", async () => {
    const expected = await oracle.capture({ source: namespaceProbe });
    expect(expected.status, expected.stderr).toBe("completed");
    expect(await capture("namespace", namespaceProbe)).toBe(expected.stdout);
  });
  it("loads with only base and Autoloads attached on both runtimes", async () => {
    let nativeError = "";
    let runtimeError = "";
    const result = await observeCleanBaseLoad("lifecyclefixture", {
      actual: async (code) => {
        try {
          return { status: "completed", stdout: await capture("clean", code) };
        } catch (error) {
          runtimeError = String(error);
          throw error;
        }
      },
      expected: async (source) => {
        const result = await oracle.capture({ source });
        nativeError = result.stderr;
        return result;
      },
    });
    expect(runtimeError).toBe("");
    expect(nativeError).toBe("");
    expect(result).toMatchObject({
      outcome: "match",
      actual: { state: "1|1|0|1|0|1|1" },
      expected: { state: "1|1|0|1|0|1|1" },
    });
  });
  it.each([false, true])("compares user lifecycle callbacks with failure=%s", async (fail) => {
    const expected = await oracle.capture({ source: userHookProbe(fail) });
    expect(expected.status, expected.stderr).toBe("completed");
    expect(await capture("hooks", userHookProbe(fail))).toBe(expected.stdout);
  });
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])("compares unload failure=%s viaDetach=%s", async (fail, viaDetach) => {
    const expected = await oracle.capture({ source: unloadProbe(fail, viaDetach) });
    expect(expected.status, expected.stderr).toBe("completed");
    expect(await capture("unload", unloadProbe(fail, viaDetach))).toBe(expected.stdout);
  });
  it.each([false, true])("compares detach with native hook failure=%s", async (fail) => {
    const expected = await oracle.capture({ source: detachProbe(fail) });
    expect(
      expected.status,
      JSON.stringify({
        stderr: expected.stderr,
        conditions: expected.conditions,
        reason: expected.reason,
      }),
    ).toBe("completed");
    expect(await capture("detach", detachProbe(fail))).toBe(expected.stdout);
  });
  it.each(["load", "attach"])("compares failed %s recovery with GNU R", async (phase) => {
    const expected = await oracle.capture({ source: probe(phase) });
    expect(
      expected.status,
      JSON.stringify({
        stderr: expected.stderr,
        conditions: expected.conditions,
        reason: expected.reason,
      }),
    ).toBe("completed");
    expect(await capture(phase)).toBe(expected.stdout);
  });
});
