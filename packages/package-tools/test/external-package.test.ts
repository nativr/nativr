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

it.runIf(runExternal)(
  "packs and loads the unchanged public generics 0.1.4 pure-R source package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["generics"]);
      const artifact = installed.artifacts[0];
      expect(artifact).toMatchObject({
        package: { name: "generics", version: "0.1.4" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "4d4ee79d98a495b7799956b7279d313d43ac9da1165d6872b5aeec3590122b53",
        },
      });
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      expect(exampleResource).toBeDefined();
      const exampleManifest = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { aliases: string[] }[] };
      const exampleTopic = exampleManifest.topics[0]?.aliases[0];
      expect(exampleTopic).toBeTypeOf("string");
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
      await expect(runtime.eval('requireNamespace("generics", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval(`
          tidy.probe <- function(x, ...) "package-method"
          generics::tidy(structure(1, class = "probe"))
        `),
      ).resolves.toBe("package-method");
      await expect(runtime.eval('"tidy" %in% getNamespaceExports("generics")')).resolves.toBe(true);
      await expect(
        runtime.eval(
          `length(utils::example(${JSON.stringify(exampleTopic)}, package = "generics", give.lines = TRUE, echo = FALSE)) > 6L`,
        ),
      ).resolves.toBe(true);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs and loads the unchanged public withr 3.0.3 pure-R source package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["withr"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "withr", version: "3.0.3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "f6c848a7a1a4a60a3ae1237316c308ef50016c843e9548c3a36ce2caae7d3605",
        },
      });
      const vignetteResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/vignettes-v1.json",
      );
      expect(vignetteResource).toBeDefined();
      expect(
        JSON.parse(Buffer.from(vignetteResource?.data ?? "", "base64").toString("utf8")),
      ).toMatchObject({
        vignettes: [
          {
            topic: "withr",
            title: "Changing and restoring state",
            file: "withr.Rmd",
            r: "withr.R",
            output: "withr.html",
          },
        ],
      });
      runtime = await createR({
        execution: "inline",
        environmentVariables: { NATIVR_WITHR: "outside" },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      await expect(runtime.eval('requireNamespace("withr", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval(`
          v <- utils::vignette("withr", package = "withr")
          c(v$Package, v$Topic, v$Title, v$File, v$R, v$PDF)
        `),
      ).resolves.toEqual([
        "withr",
        "withr",
        "Changing and restoring state",
        "withr.Rmd",
        "withr.R",
        "withr.html",
      ]);
      await expect(
        runtime.eval(`
          before <- getOption("digits")
          inside <- withr::with_options(list(digits = 3L), getOption("digits"))
          c(before, inside, getOption("digits"))
        `),
      ).resolves.toEqual([7, 3, 7]);
      await expect(
        runtime.eval(`
          inside <- withr::with_envvar(
            c(NATIVR_WITHR = "inside", NATIVR_ADDED = "temporary"),
            c(Sys.getenv("NATIVR_WITHR"), Sys.getenv("NATIVR_ADDED"))
          )
          c(inside, Sys.getenv("NATIVR_WITHR"), Sys.getenv("NATIVR_ADDED", unset = "restored"))
        `),
      ).resolves.toEqual(["inside", "temporary", "outside", "restored"]);
      await expect(
        runtime.eval(`
          before <- .libPaths()
          temporary_library <- tempfile("withr-library-")
          dir.create(temporary_library)
          inside <- withr::with_libpaths(temporary_library, .libPaths())
          after <- .libPaths()
          c(
            identical(inside[1], normalizePath(temporary_library)),
            identical(tail(inside, 1), .Library),
            identical(after, before),
            unlink(temporary_library, recursive = TRUE) == 0L
          )
        `),
      ).resolves.toEqual([true, true, true, true]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);
