import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createR } from "@nativr/nativr";
import { expect, it } from "vitest";

import { packPackage, runPackageExamples } from "../src/index.js";

const runExternal = process.env.NATIVR_EXTERNAL_PACKAGE_SMOKE === "1";

it.runIf(runExternal)(
  "records the first P5 blocker across the pinned assertthat 0.2.1 example inventory",
  async () => {
    const sourceSha256 = "85cf7fcc4753a8c86da9a6f454e46c2a58ffc70c4f47cac4d3e3bcefda2a9e9f";
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-assertthat-examples-"));
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const response = await fetch(
        "https://cran.r-project.org/src/contrib/assertthat_0.2.1.tar.gz",
      );
      expect(response.ok).toBe(true);
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sourceSha256);
      const archive = path.join(temporaryRoot, "assertthat_0.2.1.tar.gz");
      await writeFile(archive, bytes);
      const artifact = await packPackage(archive);
      expect(artifact.integrity.value).toBe(
        "26678946c287baad27a9b359fb27ea64e349e0fd10a5e9b5346d1d8e38f69ca2",
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
      await runtime.eval('library("assertthat")');
      const report = await runPackageExamples(
        archive,
        async (script) => {
          await runtime?.evalDetailed(`${script.source}\ninvisible(NULL)`);
        },
        {
          expectedPackage: { name: "assertthat", version: "0.2.1" },
          expectedSourceSha256: sourceSha256,
        },
      );
      expect(
        report.entrypoints.map(({ path, topic, applicableBlocks }) => ({
          path,
          topic,
          applicableBlocks,
        })),
      ).toEqual([
        { path: "man/are_equal.Rd", topic: "are_equal", applicableBlocks: 1 },
        { path: "man/assert-is.Rd", topic: "assert-is", applicableBlocks: 1 },
        { path: "man/assert_that.Rd", topic: "assert_that", applicableBlocks: 2 },
        { path: "man/assertions-file.Rd", topic: "assertions-file", applicableBlocks: 1 },
        { path: "man/has_args.Rd", topic: "has_args", applicableBlocks: 1 },
        { path: "man/has_attr.Rd", topic: "has_attr", applicableBlocks: 1 },
        { path: "man/noNA.Rd", topic: "noNA", applicableBlocks: 1 },
        { path: "man/not_empty.Rd", topic: "not_empty", applicableBlocks: 1 },
        { path: "man/on_failure.Rd", topic: "on_failure", applicableBlocks: 1 },
        { path: "man/scalar.Rd", topic: "scalar", applicableBlocks: 1 },
        { path: "man/validate_that.Rd", topic: "validate_that", applicableBlocks: 1 },
      ]);
      expect(
        report.entrypoints.reduce(
          (counts, entry) => ({
            applicable: counts.applicable + entry.applicableBlocks,
            excludedDontrun: counts.excludedDontrun + entry.excludedDontrunBlocks,
            excludedDonttest: counts.excludedDonttest + entry.excludedDonttestBlocks,
          }),
          { applicable: 0, excludedDontrun: 0, excludedDonttest: 0 },
        ),
      ).toEqual({ applicable: 12, excludedDontrun: 1, excludedDonttest: 0 });
      expect(report).toMatchObject({
        outcome: "failed",
        executed: [
          { path: "man/are_equal.Rd", topic: "are_equal", status: "completed" },
          { path: "man/assert-is.Rd", topic: "assert-is", status: "completed" },
          { path: "man/assert_that.Rd", topic: "assert_that", status: "completed" },
          { path: "man/assertions-file.Rd", topic: "assertions-file", status: "completed" },
          { path: "man/has_args.Rd", topic: "has_args", status: "completed" },
          { path: "man/has_attr.Rd", topic: "has_attr", status: "completed" },
          { path: "man/noNA.Rd", topic: "noNA", status: "completed" },
          { path: "man/not_empty.Rd", topic: "not_empty", status: "failed" },
        ],
        firstBlocker: {
          code: "example-error",
          path: "man/not_empty.Rd",
          topic: "not_empty",
          message: "Object 'mtcars' not found.",
        },
      });
    } finally {
      await runtime?.dispose();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  },
  120_000,
);
