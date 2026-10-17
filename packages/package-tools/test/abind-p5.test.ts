import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createR } from "@nativr/nativr";
import { expect, it } from "vitest";

import { packPackage, runPackageExamples } from "../src/index.js";

it.runIf(process.env.NATIVR_EXTERNAL_PACKAGE_SMOKE === "1")(
  "runs every default-applicable example from the unchanged pinned abind package",
  async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-abind-examples-"));
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
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: [artifact.bundle],
      });
      await runtime.eval('library("abind")');
      const report = await runPackageExamples(
        archive,
        async (script) => {
          await runtime?.evalDetailed(`${script.source}\ninvisible(NULL)`);
        },
        {
          expectedPackage: { name: "abind", version: "1.4-8" },
          expectedSourceSha256: sourceSha256,
        },
      );
      expect(report.entrypoints).toEqual(
        ["abind", "acorn", "adrop", "afill", "asub"].map((topic) => ({
          path: `man/${topic}.Rd`,
          topic,
          applicableBlocks: 1,
          excludedDontrunBlocks: 0,
          excludedDonttestBlocks: 0,
        })),
      );
      expect(report).toMatchObject({
        outcome: "completed",
        executed: [
          { path: "man/abind.Rd", topic: "abind", status: "completed" },
          { path: "man/acorn.Rd", topic: "acorn", status: "completed" },
          { path: "man/adrop.Rd", topic: "adrop", status: "completed" },
          { path: "man/afill.Rd", topic: "afill", status: "completed" },
          { path: "man/asub.Rd", topic: "asub", status: "completed" },
        ],
        firstBlocker: null,
      });
    } finally {
      await runtime?.dispose();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  },
  120_000,
);
