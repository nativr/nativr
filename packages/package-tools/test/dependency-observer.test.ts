import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { DependencyObservation } from "../../../scripts/lib/package-dependency-observer.mjs";
import { observePackageDependencies } from "../../../scripts/lib/package-dependency-observer.mjs";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";
import { createR } from "../../nativr/src/index.js";
import { comparePackageVersions } from "../src/resolve.js";
import type { PackageDependency } from "../src/types.js";

const dependencies: PackageDependency[] = [
  { name: "R", kind: "Depends", constraint: { operator: ">=", version: "4.6.1" } },
  { name: "utils", kind: "Imports", constraint: { operator: "==", version: "4.6-1" } },
  { name: "nativrMissingFixture", kind: "Suggests" },
  { name: "nativrMissingFixture", kind: "Enhances" },
];
const successful = () =>
  Promise.resolve({
    status: "completed",
    stdout: "0\t4.6.1\n1\t4.6.1\n2\tunavailable\n",
  });

it("retains pinned dependency evidence without promoting the incomplete metadata stage", async () => {
  const saved = JSON.parse(
    await readFile(
      new URL(
        "../../../compatibility/package-check-evidence/dependency-observations-0.306.0.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    observations: {
      package: { name: string; version: string };
      provenance: {
        sourceSha256: string;
        artifactSha256: string;
        capabilitySha256: string;
        semanticProfile: string;
      };
      rawReportSha256: string;
      dependencyObservation: DependencyObservation;
      metadataStage: { status: string; discovered: string[]; executed: string[] };
      p7Eligible: boolean;
    }[];
  };
  const corpus = JSON.parse(
    await readFile(new URL("../../../compatibility/package-corpus.json", import.meta.url), "utf8"),
  ) as {
    packages: { package: string; version: string; sourceSha256: string; artifactSha256: string }[];
  };
  expect(saved.observations.map((item) => item.package.name)).toEqual(["abind", "numDeriv"]);
  for (const item of saved.observations) {
    expect(corpus.packages.find((entry) => entry.package === item.package.name)).toMatchObject({
      version: item.package.version,
      sourceSha256: item.provenance.sourceSha256,
      artifactSha256: item.provenance.artifactSha256,
    });
    expect(item.provenance.semanticProfile).toBe("0.306.0");
    expect(item.rawReportSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(item.provenance.capabilitySha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(item.dependencyObservation.actual).toEqual(item.dependencyObservation.expected);
    expect(item.dependencyObservation.actual.status).toBe("completed");
    expect(
      item.dependencyObservation.dependencies.every((entry) => entry.actual === "satisfied"),
    ).toBe(true);
    expect(item.metadataStage.status).toBe("unexecuted");
    expect(item.metadataStage.executed).toHaveLength(
      item.dependencyObservation.dependencies.length,
    );
    expect(item.metadataStage.discovered.length).toBeGreaterThan(
      item.metadataStage.executed.length,
    );
    expect(item.p7Eligible).toBe(false);
  }
});

it("retains separate constraints and requiredness while probing each name once", async () => {
  const result = await observePackageDependencies(dependencies, {
    actual: successful,
    expected: successful,
    compareVersions: comparePackageVersions,
  });
  expect(result.dependencies.map((item) => [item.required, item.actual, item.expected])).toEqual([
    [true, "satisfied", "satisfied"],
    [true, "satisfied", "satisfied"],
    [true, "unavailable", "unavailable"],
    [false, "unavailable", "unavailable"],
  ]);
  expect(result.sourceSha256).toMatch(/^[a-f0-9]{64}$/u);
});

it.each([">", "!=", "<"] as const)(
  "evaluates a failing %s constraint independently on both sides",
  async (operator) => {
    const result = await observePackageDependencies(
      [{ name: "R", kind: "Depends", constraint: { operator, version: "4.6.1" } }],
      {
        actual: () => Promise.resolve({ status: "completed", stdout: "0\t4.6.1\n" }),
        expected: () => Promise.resolve({ status: "completed", stdout: "0\t4.6.1\r\n" }),
        compareVersions: comparePackageVersions,
      },
    );
    expect(result.dependencies[0]).toMatchObject({
      actual: "version-mismatch",
      expected: "version-mismatch",
    });
  },
);

it.each([
  "0\t4.6.1\n",
  "0\t4.6.1\n1\t4.6.1\n2\tunavailable",
  "1\t4.6.1\n0\t4.6.1\n2\tunavailable\n",
  "0\tgarbage\n1\t4.6.1\n2\tunavailable\n",
])("does not accept incomplete or malformed capture %j", async (stdout) => {
  const result = await observePackageDependencies(dependencies, {
    actual: () => Promise.resolve({ status: "completed", stdout }),
    expected: successful,
    compareVersions: comparePackageVersions,
  });
  expect(result.actual.status).toBe("invalid-output");
  expect(result.dependencies.every((item) => item.actual === "unobserved")).toBe(true);
});

it("does not classify process failure as a missing dependency", async () => {
  const result = await observePackageDependencies(dependencies, {
    actual: () => Promise.reject(new Error("worker stopped")),
    expected: successful,
    compareVersions: comparePackageVersions,
  });
  expect(result.actual.status).toBe("failed");
  expect(result.dependencies[0]?.actual).toBe("unobserved");
});

async function nativeNativrCapture(source: string) {
  const runtime = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    },
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
  } finally {
    await runtime.dispose();
  }
}

it("executes the version probe through the public NativR API", async () => {
  const result = await observePackageDependencies(dependencies, {
    actual: nativeNativrCapture,
    expected: successful,
    compareVersions: comparePackageVersions,
  });
  expect(result.actual).toEqual(result.expected);
});

describe.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "native dependency parity",
  () => {
    it("observes the independently authored public version probe on GNU R 4.6.1", async () => {
      const result = await observePackageDependencies(dependencies, {
        actual: nativeNativrCapture,
        expected: (source) =>
          capturePackageOracleScript({ source, rscript: process.env.NATIVR_RSCRIPT ?? "Rscript" }),
        compareVersions: comparePackageVersions,
      });
      expect(result.actual).toEqual(result.expected);
      expect(result.actual.status).toBe("completed");
    });
  },
);

const rByField: PackageDependency[] = [
  "Depends",
  "Imports",
  "Suggests",
  "Enhances",
  "LinkingTo",
].map((kind) => ({ name: "R", kind: kind as PackageDependency["kind"] }));
it("distinguishes the R runtime dependency from an R package dependency", async () => {
  const result = await observePackageDependencies(rByField, {
    actual: nativeNativrCapture,
    expected: () => Promise.resolve({ status: "completed", stdout: "0\t4.6.1\n1\tunavailable\n" }),
    compareVersions: comparePackageVersions,
  });
  expect(result.policy).toBe("declared-version-availability-v2");
  expect(result.actual).toEqual(result.expected);
  expect(result.actual.versions).toEqual({ R: "4.6.1", "package:R": null });
  expect(result.dependencies.map((entry) => entry.actual)).toEqual([
    "satisfied",
    "unavailable",
    "unavailable",
    "unavailable",
    "unavailable",
  ]);
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "matches native R dependency meaning in every DESCRIPTION dependency field",
  async () => {
    const result = await observePackageDependencies(rByField, {
      actual: nativeNativrCapture,
      expected: (source) =>
        capturePackageOracleScript({ source, rscript: process.env.NATIVR_RSCRIPT ?? "Rscript" }),
      compareVersions: comparePackageVersions,
    });
    expect(result.actual).toEqual(result.expected);
    const source = `local({d<-tempfile();dir.create(d);dir.create(file.path(d,"R"));on.exit(unlink(d,recursive=TRUE));base<-c("Package: fixture","Version: 1.0","Title: Fixture","Description: Independent fixture.","License: GPL-3","Author: Ada","Maintainer: Ada <ada@example.com>");for(kind in c("Depends","Imports","Suggests","Enhances","LinkingTo")){writeLines(c(base,paste0(kind,": R")),file.path(d,"DESCRIPTION"));writeLines("",file.path(d,"NAMESPACE"));r<-tools:::.check_package_depends(d,force_suggests=FALSE);cat(any(c(r$required_but_not_installed,r$suggests_but_not_installed,r$enhances_but_not_installed)=="R"),";",sep="")}})`;
    const native = await capturePackageOracleScript({
      source,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(native.status, native.stderr).toBe("completed");
    expect(native.stdout).toBe("FALSE;TRUE;TRUE;TRUE;TRUE;");
  },
);
