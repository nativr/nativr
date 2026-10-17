import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createR } from "@nativr/nativr";
import { expect, it } from "vitest";

import {
  comparePackageSavedOutput,
  packPackage,
  runPackageTests,
  type PackageSavedOutputComparison,
} from "../src/index.js";

it.runIf(process.env.NATIVR_EXTERNAL_PACKAGE_SMOKE === "1")(
  "probes unchanged pinned abind direct package tests",
  async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-abind-tests-"));
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const response = await fetch("https://cran.r-project.org/src/contrib/abind_1.4-8.tar.gz");
      expect(response.ok).toBe(true);
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
      const sourceSha256 = "264a051b523ceae1795a0879e7768949ea55c586ac8db0adf1f5ebeddd2623e1";
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sourceSha256);
      const archive = path.join(temporaryRoot, "abind_1.4-8.tar.gz");
      await writeFile(archive, bytes);
      const artifact = await packPackage(archive);
      expect(artifact.integrity.value).toBe(
        "e9862a710e03ef978409dbd3c4138dd4cdf96b0584c6f228ffe2b42d1e0e9dee",
      );
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 40_000_000, maxVectorLength: 10_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: [artifact.bundle],
      });
      const observed: {
        readonly path: string;
        readonly actual: string;
        readonly expected: string;
        readonly errors: readonly { readonly code: string; readonly message: string }[];
        readonly exact: PackageSavedOutputComparison;
        readonly displayDiagnostic: PackageSavedOutputComparison;
      }[] = [];
      const report = await runPackageTests(
        archive,
        async (script) => {
          await runtime?.reset();
          const result = await runtime?.evalDetailed(script.source, {
            topLevelErrorHandling: "option",
            printVisibleTopLevel: true,
          });
          expect(result).toBeDefined();
          expect(script.expectedOutput?.path).toBe(script.path.replace(/\.R$/u, ".Rout.save"));
          const actual = (result?.output ?? []).map((event) => event.text).join("");
          observed.push({
            path: script.path,
            actual,
            expected: script.expectedOutput?.source ?? "",
            errors: result?.topLevelErrors ?? [],
            exact: comparePackageSavedOutput(script, actual, {
              policyVersion: 1,
              expectedFormat: "rout-save-source-echo",
              comparison: "exact-text",
            }),
            displayDiagnostic: comparePackageSavedOutput(script, actual, {
              policyVersion: 1,
              expectedFormat: "rout-save-source-echo",
              comparison: "display-whitespace",
            }),
          });
        },
        {
          expectedPackage: { name: "abind", version: "1.4-8" },
          expectedSourceSha256: sourceSha256,
        },
      );
      expect(report.entrypoints).toEqual([
        "tests/abind.R",
        "tests/adrop.R",
        "tests/afill.R",
        "tests/asub.R",
        "tests/dnns.R",
      ]);
      expect(report.outputExpectations).toEqual([
        "tests/abind.Rout.save",
        "tests/adrop.Rout.save",
        "tests/afill.Rout.save",
        "tests/asub.Rout.save",
        "tests/dnns.Rout.save",
      ]);
      expect(report).toMatchObject({
        outcome: "completed",
        executed: [
          { path: "tests/abind.R", status: "completed" },
          { path: "tests/adrop.R", status: "completed" },
          { path: "tests/afill.R", status: "completed" },
          { path: "tests/asub.R", status: "completed" },
          { path: "tests/dnns.R", status: "completed" },
        ],
        firstBlocker: null,
      });
      expect(observed).toHaveLength(5);
      expect(observed.find((item) => item.path === "tests/adrop.R")?.errors).toMatchObject([
        { code: "NRE2300", message: "dimensions to drop (1) do not have length 1" },
        { code: "NRE2300", message: "dimensions to drop (1) do not have length 1" },
      ]);
      expect(observed.find((item) => item.path === "tests/afill.R")?.errors).toMatchObject([
        { code: "NRE2300", message: "value has dimnames that are not in 'x' on dim[1]: 'G'" },
      ]);
      expect(
        observed
          .filter((item) => !["tests/adrop.R", "tests/afill.R"].includes(item.path))
          .flatMap((item) => item.errors),
      ).toEqual([]);
      for (const item of observed) {
        const expectedErrorCount = (item.expected.match(/^Error in /gmu) ?? []).length;
        expect(item.errors).toHaveLength(expectedErrorCount);
        for (const error of item.errors) expect(item.expected).toContain(error.message);
      }
      const outputComparisons = observed.map((item) => ({
        path: item.path,
        matchesSavedOutput: item.displayDiagnostic.outcome === "match",
      }));
      expect(outputComparisons).toEqual([
        { path: "tests/abind.R", matchesSavedOutput: true },
        { path: "tests/adrop.R", matchesSavedOutput: true },
        { path: "tests/afill.R", matchesSavedOutput: true },
        { path: "tests/asub.R", matchesSavedOutput: true },
        { path: "tests/dnns.R", matchesSavedOutput: true },
      ]);
      const firstExactMismatch = observed.find((item) => item.exact.outcome === "mismatch");
      if (firstExactMismatch !== undefined) {
        console.info("abind exact saved-output diagnostic", {
          path: firstExactMismatch.path,
          removedSourceEchoLines: firstExactMismatch.exact.sourceEchoLinesRemoved,
          firstDifference: firstExactMismatch.exact.firstDifference,
        });
      }
    } finally {
      await runtime?.dispose();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  },
  120_000,
);
