import { createR } from "@nativr/nativr";
import { expect, it } from "vitest";

import { installPackagesFromRepository } from "../src/index.js";

const runExternal = process.env.NATIVR_EXTERNAL_PACKAGE_SMOKE === "1";

it.runIf(runExternal)(
  "packs and loads the unchanged public pkgconfig 2.0.3 pure-R source package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["pkgconfig"]);
      const artifact = installed.artifacts[0];
      expect(artifact).toBeDefined();
      expect(artifact).toMatchObject({
        package: { name: "pkgconfig", version: "2.0.3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "c574661146fe159eea8a31458549af021516c92c974e8956b5d5b51c45c2b2f8",
        },
      });
      runtime = await createR({
        execution: "inline",
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      await expect(runtime.eval('requireNamespace("pkgconfig", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('sort(getNamespaceExports("pkgconfig"))')).resolves.toEqual([
        "get_config",
        "set_config",
        "set_config_in",
      ]);
      await expect(runtime.eval('pkgconfig::get_config("unset-option", 42L)')).resolves.toBe(42);
      await expect(
        runtime.eval('readLines(system.file("DESCRIPTION", package = "pkgconfig"), n = 1L)'),
      ).resolves.toBe("Package: pkgconfig");
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);
