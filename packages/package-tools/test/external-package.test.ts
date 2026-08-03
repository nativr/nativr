import { createR } from "@nativr/nativr";
import { expect, it } from "vitest";

import { installPackagesFromRepository } from "../src/index.js";

const runExternal = process.env.NATIVR_EXTERNAL_PACKAGE_SMOKE === "1";

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public R6 2.6.1 pure-R source package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["R6"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "R6", version: "2.6.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "71ec633b25beaabf1b6114e3a1cf488666e273a4b93729a837db87505ea0201f",
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
      await expect(runtime.eval('requireNamespace("R6", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("R6"))')).resolves.toBe("2.6.1");
      await expect(runtime.eval('"R6Class" %in% getNamespaceExports("R6")')).resolves.toBe(true);
      await expect(runtime.eval('Minimal <- R6::R6Class("Minimal"); class(Minimal)')).resolves.toBe(
        "R6ClassGenerator",
      );
      await expect(
        runtime.eval(`
          Counter <- R6::R6Class(
            "Counter",
            public = list(
              value = NULL,
              initialize = function(value = 0) self$value <- value,
              increment = function() self$value <- self$value + 1
            )
          )
          counter <- Counter$new(4)
          counter$increment()
          c(counter$value, class(counter))
        `),
      ).resolves.toEqual(["5", "Counter", "R6"]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

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
          value: "4622ae429bf36b71ec392ac3deb337db86e04e77b5e6ee91fc6ceef0de97835e",
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
      await expect(
        runtime.eval(`
          description <- utils::packageDescription("pkgconfig")
          c(
            description$Package,
            description$Version,
            class(description),
            basename(dirname(attr(description, "file")))
          )
        `),
      ).resolves.toEqual(["pkgconfig", "2.0.3", "packageDescription", "pkgconfig"]);
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
          value: "7720925af995c4519af8a5259dbb1529a0d45212aaa376b2fe24985c794efbaf",
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
          value: "a51a19247a01ad7d3f712b2029914f2c52f6c713846d0a63ada5a989ab4187f9",
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
