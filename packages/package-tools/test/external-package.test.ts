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
      await expect(
        runtime.eval(`
          Meter <- R6::R6Class(
            "Meter",
            private = list(value = 1L),
            public = list(
              reveal = function() private$value,
              increment = function() private$value <- private$value + 1L
            ),
            active = list(
              doubled = function(value) {
                if (missing(value)) private$value * 2L
                else private$value <- value / 2L
              }
            )
          )
          meter <- Meter$new()
          before <- meter$doubled
          meter$doubled <- 10L
          meter$increment()
          c(
            before, meter$reveal(), meter$doubled,
            bindingIsActive("doubled", meter), is.null(meter$private)
          )
        `),
      ).resolves.toEqual([2, 6, 12, 1, 1]);
      await expect(
        runtime.eval(`
          Cloneable <- R6::R6Class(
            "Cloneable",
            private = list(secret = 2L),
            public = list(
              value = NULL,
              initialize = function(value = 1L) self$value <- value,
              get_secret = function() private$secret,
              set_secret = function(value) private$secret <- value
            ),
            active = list(total = function() self$value + private$secret)
          )
          original <- Cloneable$new(3L)
          original$set_secret(4L)
          cloned <- original$clone()
          cloned$value <- 10L
          cloned$set_secret(7L)
          c(
            original$value, original$get_secret(), original$total,
            cloned$value, cloned$get_secret(), cloned$total,
            identical(original, cloned), bindingIsActive("total", cloned)
          )
        `),
      ).resolves.toEqual([3, 4, 7, 10, 7, 17, 0, 1]);
      await expect(
        runtime.eval(`
          Node <- R6::R6Class(
            "Node",
            public = list(
              value = NULL,
              child = NULL,
              initialize = function(value) self$value <- value
            )
          )
          root <- Node$new(1L)
          root$child <- Node$new(2L)
          shallow <- root$clone()
          deep <- root$clone(deep = TRUE)
          deep$child$value <- 9L
          c(
            root$child$value, shallow$child$value, deep$child$value,
            identical(root$child, shallow$child), identical(root$child, deep$child)
          )
        `),
      ).resolves.toEqual([2, 2, 9, 1, 0]);
      await expect(
        runtime.eval(`
          Person <- R6::R6Class(
            "Person",
            public = list(
              name = NULL,
              initialize = function(name) self$name <- name,
              greet = function() paste0("hello ", self$name)
            )
          )
          Employee <- R6::R6Class(
            "Employee",
            inherit = Person,
            public = list(
              role = NULL,
              initialize = function(name, role) {
                super$initialize(name)
                self$role <- role
              },
              greet = function() paste0(super$greet(), " (", self$role, ")")
            )
          )
          Manager <- R6::R6Class(
            "Manager",
            inherit = Employee,
            public = list(
              team = NULL,
              initialize = function(name, role, team) {
                super$initialize(name, role)
                self$team <- team
              },
              greet = function() paste0(super$greet(), " [", self$team, "]")
            )
          )
          NULL
        `),
      ).resolves.toBeNull();
      await expect(
        runtime.eval(`
          employee <- Manager$new("Ada", "engineer", "runtime")
          NULL
        `),
      ).resolves.toBeNull();
      await expect(
        runtime.eval(`
          c(
            employee$greet(), employee$name, employee$role, employee$team,
            class(employee), inherits(employee, "Person"), inherits(employee, "Employee")
          )
        `),
      ).resolves.toEqual([
        "hello Ada (engineer) [runtime]",
        "Ada",
        "engineer",
        "runtime",
        "Manager",
        "Employee",
        "Person",
        "R6",
        "TRUE",
        "TRUE",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public viridisLite 0.4.3 pure-R source package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["viridisLite"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "viridisLite", version: "0.4.3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "aba19bcae8a19d1bfaa4806275b6caf4c6d0d4ea7acd58cbb8df7474aa39bb09",
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
      await expect(runtime.eval('requireNamespace("viridisLite", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("viridisLite"))')).resolves.toBe(
        "0.4.3",
      );
      await expect(runtime.eval("viridisLite::viridis(5)")).resolves.toEqual([
        "#440154FF",
        "#3B528BFF",
        "#21908CFF",
        "#5DC863FF",
        "#FDE725FF",
      ]);
      await expect(runtime.eval("viridisLite::magma(5)")).resolves.toEqual([
        "#000004FF",
        "#51127CFF",
        "#B63679FF",
        "#FB8861FF",
        "#FCFDBFFF",
      ]);
      await expect(
        runtime.eval(
          "viridisLite::viridis(3, alpha = 0.5, begin = 0.2, end = 0.8, direction = -1)",
        ),
      ).resolves.toEqual(["#7AD15180", "#21908C80", "#41448780"]);
    } finally {
      await runtime?.dispose();
    }
  },
  120_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public RColorBrewer 1.1-3 pure-R source package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["RColorBrewer"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "RColorBrewer", version: "1.1-3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "4a5438a27a6ddfe2ead9563c736b34498081c811a4185d84bb18ecbde12f6ba8",
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
      await expect(runtime.eval('requireNamespace("RColorBrewer", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("RColorBrewer"))')).resolves.toBe(
        "1.1.3",
      );
      await expect(runtime.eval('RColorBrewer::brewer.pal(5, "Set1")')).resolves.toEqual([
        "#E41A1C",
        "#377EB8",
        "#4DAF4A",
        "#984EA3",
        "#FF7F00",
      ]);
      await expect(runtime.eval('RColorBrewer::brewer.pal(9, "Blues")')).resolves.toEqual([
        "#F7FBFF",
        "#DEEBF7",
        "#C6DBEF",
        "#9ECAE1",
        "#6BAED6",
        "#4292C6",
        "#2171B5",
        "#08519C",
        "#08306B",
      ]);
      await expect(
        runtime.eval(`
          info <- RColorBrewer::brewer.pal.info
          c(dim(info), names(info), unlist(info["Set1", ]))
        `),
      ).resolves.toEqual(["35", "3", "maxcolors", "category", "colorblind", "9", "qual", "FALSE"]);
      const minimum = await runtime.evalDetailed('RColorBrewer::brewer.pal(2, "Set1")');
      expect(minimum.value).toEqual(["#E41A1C", "#377EB8", "#4DAF4A"]);
      expect(minimum.warnings).toEqual([
        {
          code: "NRW1100",
          message:
            "minimal value for n is 3, returning requested palette with 3 different levels\n",
        },
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  120_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public labeling 0.4.3 pure-R source package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["labeling"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "labeling", version: "0.4.3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "2d4f9e5a9b1b0e109821a3cd705ca81dbbc46c6ee53acc0d216db907e857a89f",
        },
      });
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
        packages: installed.bundles,
      });
      await expect(runtime.eval('requireNamespace("labeling", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("labeling"))')).resolves.toBe("0.4.3");
      await expect(runtime.eval("labeling::heckbert(8.1, 14.1, 4)")).resolves.toEqual([5, 10, 15]);
      await expect(runtime.eval("labeling::wilkinson(8.1, 14.1, 4)")).resolves.toEqual([
        8, 9, 10, 11, 12, 13, 14, 15,
      ]);
      await expect(runtime.eval("labeling::extended(8.1, 14.1, 4)")).resolves.toEqual([
        8, 10, 12, 14,
      ]);
      await expect(runtime.eval("labeling::rpretty(8.1, 14.1, 4)")).resolves.toEqual([
        8, 10, 12, 14, 16,
      ]);
      await expect(runtime.eval("labeling::matplotlib(8.1, 14.1, 4)")).resolves.toEqual([
        8, 10, 12, 14, 16,
      ]);
      await expect(runtime.eval("labeling::gnuplot(8.1, 14.1, 4)")).resolves.toEqual([6, 12, 18]);
      await expect(runtime.eval("labeling::nelder(8.1, 14.1, 4)")).resolves.toEqual([
        8, 10, 12, 14,
      ]);
      await expect(runtime.eval("labeling::sparks(8.1, 14.1, 4)")).resolves.toEqual([6, 9]);
      await expect(runtime.eval("labeling::thayer(8.1, 14.1, 4)")).resolves.toEqual([6, 9, 12, 15]);
      await expect(
        runtime.evalDetailed("set.seed(1); labeling::extended.figures(2)"),
      ).rejects.toMatchObject({
        code: "NRU6197",
        message: "axis() graphical control 'xlab' is outside the measured browser subset.",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  120_000,
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

it.runIf(runExternal)(
  "records the first unchanged public assertthat 0.2.1 pure-R package blocker",
  async () => {
    await expect(installPackagesFromRepository(["assertthat"])).rejects.toThrow(
      "Package 'assertthat' requires 'tools', which is absent from https://cran.r-project.org/.",
    );
  },
  30_000,
);

it.runIf(runExternal)(
  "records the first unchanged public crayon 1.5.3 pure-R package blocker",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["crayon"]);
      expect(
        installed.artifacts.find((artifact) => artifact.package.name === "crayon"),
      ).toMatchObject({
        package: { name: "crayon", version: "1.5.3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "8e1e46992f4e3348cb03ab87850c5efd4305f6a2f4cda5fc201bcdf438cc0bdf",
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
      await expect(
        runtime.eval('requireNamespace("crayon", quietly = TRUE)'),
      ).rejects.toMatchObject({
        code: "NRE2195",
        message: "Cannot open virtual text file 'nativr://session-temp/tools/ansi-palettes.txt'.",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);
