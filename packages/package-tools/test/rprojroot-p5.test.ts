import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createR } from "@nativr/nativr";
import { expect, it } from "vitest";

import { packPackage, runPackageExamples, runPackageTests } from "../src/index.js";

it.runIf(process.env.NATIVR_EXTERNAL_PACKAGE_SMOKE === "1")(
  "runs pinned rprojroot examples and records its first direct-test blocker",
  async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-rprojroot-examples-"));
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const response = await fetch("https://cran.r-project.org/src/contrib/rprojroot_2.1.1.tar.gz");
      expect(response.ok).toBe(true);
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
      const sourceSha256 = "473989bbef45fd9cd68f68dc317b14c9f42de5cea4b55fd6ba9011f25e0517e9";
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sourceSha256);
      const archive = path.join(temporaryRoot, "rprojroot_2.1.1.tar.gz");
      await writeFile(archive, bytes);
      const artifact = await packPackage(archive);
      expect(artifact.integrity.value).toBe(
        "086ed9af48d2f4e917f40bdf3364e395115f25fff5017d5527d00b20df343744",
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
      await runtime.eval('library("rprojroot")');
      const report = await runPackageExamples(
        archive,
        async (script) => {
          await runtime?.evalDetailed(`${script.source}\ninvisible(NULL)`);
        },
        {
          expectedPackage: { name: "rprojroot", version: "2.1.1" },
          expectedSourceSha256: sourceSha256,
        },
      );
      expect(report.entrypoints).toEqual([
        {
          path: "man/find_root.Rd",
          topic: "find_root",
          applicableBlocks: 0,
          excludedDontrunBlocks: 1,
          excludedDonttestBlocks: 0,
        },
        {
          path: "man/find_root_file.Rd",
          topic: "find_root_file",
          applicableBlocks: 0,
          excludedDontrunBlocks: 1,
          excludedDonttestBlocks: 0,
        },
        {
          path: "man/root_criterion.Rd",
          topic: "root_criterion",
          applicableBlocks: 1,
          excludedDontrunBlocks: 1,
          excludedDonttestBlocks: 0,
        },
        {
          path: "man/rprojroot-package.Rd",
          topic: "rprojroot-package",
          applicableBlocks: 1,
          excludedDontrunBlocks: 1,
          excludedDonttestBlocks: 0,
        },
        {
          path: "man/thisfile.Rd",
          topic: "thisfile",
          applicableBlocks: 0,
          excludedDontrunBlocks: 1,
          excludedDonttestBlocks: 0,
        },
      ]);
      expect(report).toMatchObject({
        outcome: "completed",
        executed: [
          { path: "man/root_criterion.Rd", topic: "root_criterion", status: "completed" },
          { path: "man/rprojroot-package.Rd", topic: "rprojroot-package", status: "completed" },
        ],
        firstBlocker: null,
      });
      const tests = await runPackageTests(
        archive,
        async (script) => {
          await runtime?.evalDetailed(script.source);
        },
        {
          expectedPackage: { name: "rprojroot", version: "2.1.1" },
          expectedSourceSha256: sourceSha256,
        },
      );
      expect(tests.entrypoints).toEqual(["tests/testthat.R"]);
      expect(tests.nestedRFiles).toEqual([
        "tests/testthat/package/tests/testthat.R",
        "tests/testthat/package/tests/testthat/test-something.R",
        "tests/testthat/scripts/thisfile-cat.R",
        "tests/testthat/scripts/thisfile.R",
        "tests/testthat/setup.R",
        "tests/testthat/test-absolute.R",
        "tests/testthat/test-criterion.R",
        "tests/testthat/test-file.R",
        "tests/testthat/test-path.R",
        "tests/testthat/test-root.R",
        "tests/testthat/test-testthat.R",
        "tests/testthat/test-utils.R",
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
