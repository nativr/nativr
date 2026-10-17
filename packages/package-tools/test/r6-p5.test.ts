import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createR } from "@nativr/nativr";
import { expect, it } from "vitest";

import { packPackage, runPackageExamples, runPackageTests } from "../src/index.js";

it.runIf(process.env.NATIVR_EXTERNAL_PACKAGE_SMOKE === "1")(
  "runs pinned R6 examples and records its first direct-test blocker",
  async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-r6-examples-"));
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const response = await fetch("https://cran.r-project.org/src/contrib/R6_2.6.1.tar.gz");
      expect(response.ok).toBe(true);
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
      const sourceSha256 = "59c6eba8b1b912eb7e104f65053235604be853425ee67c152ac4e86a1f2073b4";
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sourceSha256);
      const archive = path.join(temporaryRoot, "R6_2.6.1.tar.gz");
      await writeFile(archive, bytes);
      const artifact = await packPackage(archive);
      expect(artifact.integrity.value).toBe(
        "71ec633b25beaabf1b6114e3a1cf488666e273a4b93729a837db87505ea0201f",
      );
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: [artifact.bundle],
      });
      await runtime.eval('library("R6")');
      const report = await runPackageExamples(
        archive,
        async (script) => {
          await runtime?.evalDetailed(`${script.source}\ninvisible(NULL)`);
        },
        {
          expectedPackage: { name: "R6", version: "2.6.1" },
          expectedSourceSha256: sourceSha256,
        },
      );
      expect(report.entrypoints).toEqual([
        {
          path: "man/R6Class.Rd",
          topic: "R6Class",
          applicableBlocks: 1,
          excludedDontrunBlocks: 1,
          excludedDonttestBlocks: 0,
        },
        {
          path: "man/is.R6.Rd",
          topic: "is.R6",
          applicableBlocks: 1,
          excludedDontrunBlocks: 0,
          excludedDonttestBlocks: 0,
        },
      ]);
      expect(report).toMatchObject({
        outcome: "completed",
        executed: [
          { path: "man/R6Class.Rd", topic: "R6Class", status: "completed" },
          { path: "man/is.R6.Rd", topic: "is.R6", status: "completed" },
        ],
        firstBlocker: null,
      });
      const tests = await runPackageTests(
        archive,
        async (script) => {
          await runtime?.evalDetailed(script.source);
        },
        {
          expectedPackage: { name: "R6", version: "2.6.1" },
          expectedSourceSha256: sourceSha256,
        },
      );
      expect(tests.entrypoints).toEqual(["tests/testthat.R"]);
      expect(tests.nestedRFiles).toEqual([
        "tests/manual/encapsulation.R",
        "tests/manual/test-inheritance.R",
        "tests/testthat/helper.R",
        "tests/testthat/test-aslist.R",
        "tests/testthat/test-clone.R",
        "tests/testthat/test-cloning-inheritance.R",
        "tests/testthat/test-dollarnames.R",
        "tests/testthat/test-finalizer.R",
        "tests/testthat/test-is.R",
        "tests/testthat/test-nonportable-inheritance.R",
        "tests/testthat/test-nonportable.R",
        "tests/testthat/test-portable-inheritance.R",
        "tests/testthat/test-portable.R",
        "tests/testthat/test-s3-methods.R",
        "tests/testthat/test-set.R",
      ]);
      expect(tests.outputExpectations).toEqual([]);
      expect(tests).toMatchObject({
        outcome: "failed",
        executed: [{ path: "tests/testthat.R", status: "failed" }],
        firstBlocker: {
          code: "test-error",
          path: "tests/testthat.R",
          message: "There is no installed package called 'testthat'.",
        },
      });
    } finally {
      await runtime?.dispose();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  },
  120_000,
);
