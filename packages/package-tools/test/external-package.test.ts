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
  "packs, loads, and exercises the unchanged public assertthat 0.2.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["assertthat"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "assertthat", version: "0.2.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "26678946c287baad27a9b359fb27ea64e349e0fd10a5e9b5346d1d8e38f69ca2",
        },
      });
      expect(installed.lock.providedPackages.tools).toBe("4.6.1");
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
      await expect(runtime.eval('requireNamespace("assertthat", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("assertthat"))')).resolves.toBe(
        "0.2.1",
      );
      await expect(
        runtime.eval(`
          library(assertthat)
          c(
            assert_that(is.string("nativr")),
            validate_that(is.flag(TRUE)),
            noNA(c(1, 2, 3))
          )
        `),
      ).resolves.toEqual([true, true, true]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public crayon 1.5.3 pure-R package",
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
          value: "1d7035a894f2b3aea604bf1af9a155a143c27e7889d0b95fd2f2be48e96a23d7",
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
      await expect(runtime.eval('requireNamespace("crayon", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("crayon"))')).resolves.toBe("1.5.3");
      await expect(
        runtime.eval(`
          library(crayon)
          c(
            "package:crayon" %in% search(),
            strip_style(red(bold("nativr"))),
            strip_style(bgBlue(white("browser")))
          )
        `),
      ).resolves.toEqual(["TRUE", "nativr", "browser"]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public praise 1.0.0 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["praise"]);
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "praise");
      expect(artifact).toMatchObject({
        package: { name: "praise", version: "1.0.0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "2b019b6f6363cfd1ddbf20694b6cdf6e6ce0fcb67f1775d5c64697d6ef5c2cae",
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
      await expect(runtime.eval('requireNamespace("praise", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("praise"))')).resolves.toBe("1.0.0");
      await expect(runtime.eval('sort(getNamespaceExports("praise"))')).resolves.toEqual([
        "praise",
        "praise_parts",
      ]);
      await expect(
        runtime.eval(`
          set.seed(1)
          replacement <- sample(praise::praise_parts[["adjective"]], 1)
          c(typeof(replacement), length(replacement), replacement)
        `),
      ).resolves.toEqual(["character", "1", "praiseworthy"]);
      await expect(
        runtime.eval(`
          set.seed(1)
          c(
            praise::praise(),
            praise::praise("A \${adjective} \${rpackage}!")
          )
        `),
      ).resolves.toEqual(["You are praiseworthy!", "A gnarly code!"]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public prettyunits 1.2.0 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["prettyunits"]);
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "prettyunits",
      );
      expect(artifact).toMatchObject({
        package: { name: "prettyunits", version: "1.2.0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "69d93f2b9a1190f907f14d7fb03f8f8c1ab424570544d9e27a8d52aa4ecd9a18",
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
      await expect(runtime.eval('requireNamespace("prettyunits", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("prettyunits"))')).resolves.toBe(
        "1.2.0",
      );
      await expect(
        runtime.eval(`
          computed <- prettyunits::compute_bytes(c(0, 1024, 1e6))
          c(computed$amount, computed$unit, computed$negative)
        `),
      ).resolves.toEqual(["0", "1.024", "1", "B", "kB", "MB", "FALSE", "FALSE", "FALSE"]);
      await expect(
        runtime.eval('prettyunits::pretty_bytes(c(0, 1024, 1e6), style = "default")'),
      ).resolves.toEqual(["    0 B", "1.02 kB", "   1 MB"]);
      await expect(runtime.eval("prettyunits::pretty_bytes(c(0, 1024, 1e6))")).resolves.toEqual([
        "    0 B",
        "1.02 kB",
        "   1 MB",
      ]);
      await expect(runtime.eval("prettyunits::pretty_ms(c(1, 1000, 60000))")).resolves.toEqual([
        "1ms",
        "1s",
        "1m",
      ]);
      await expect(runtime.eval("prettyunits::pretty_num(c(1, 1000, 1e6))")).resolves.toEqual([
        " 1 ",
        "1 k",
        "1 M",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public evaluate 1.0.5 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["evaluate"]);
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "evaluate",
      );
      expect(artifact).toMatchObject({
        package: { name: "evaluate", version: "1.0.5" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "4c69fe41198004538efce999d5be1b34cd9ec3641d476e09cb9ec350f02ef041",
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
      await expect(runtime.eval('requireNamespace("evaluate", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("evaluate"))')).resolves.toBe("1.0.5");
      await expect(
        runtime.eval('library("evaluate"); "package:evaluate" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('sort(getNamespaceExports("evaluate"))')).resolves.toEqual([
        "create_traceback",
        "evaluate",
        "flush_console",
        "inject_funs",
        "is.error",
        "is.message",
        "is.recordedplot",
        "is.source",
        "is.warning",
        "local_reproducible_output",
        "new_output_handler",
        "parse_all",
        "remove_hooks",
        "replay",
        "set_hooks",
        "trim_intermediate_plots",
        "try_capture_stack",
      ]);
      await expect(
        runtime.eval(`
          handler <- evaluate::new_output_handler()
          c(
            names(handler),
            class(handler),
            vapply(handler[1:7], function(fun) length(formals(fun)), integer(1))
          )
        `),
      ).resolves.toEqual([
        "source",
        "text",
        "graphics",
        "message",
        "warning",
        "error",
        "value",
        "calling_handlers",
        "output_handler",
        "1",
        "1",
        "1",
        "1",
        "1",
        "1",
        "3",
      ]);
      await expect(
        runtime.eval(`
          c(
            evaluate::is.source(structure("x", class = "source")),
            evaluate::is.message(simpleMessage("x")),
            evaluate::is.warning(simpleWarning("x")),
            evaluate::is.error(simpleError("x")),
            evaluate::is.recordedplot(structure(list(), class = "recordedplot"))
          )
        `),
      ).resolves.toEqual([true, true, true, true, true]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public numDeriv 2016.8-1.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["numDeriv"]);
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "numDeriv",
      );
      expect(artifact).toMatchObject({
        package: { name: "numDeriv", version: "2016.8-1.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "0a5bac977e0b258bc22dedf41adc2c48a0eaa8e197f48dfefede7ad0f3981e45",
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
      await expect(runtime.eval('requireNamespace("numDeriv", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("numDeriv"))')).resolves.toBe(
        "2016.8.1.1",
      );
      await expect(
        runtime.eval('library("numDeriv"); "package:numDeriv" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('sort(getNamespaceExports("numDeriv"))')).resolves.toEqual([
        "genD",
        "grad",
        "hessian",
        "jacobian",
      ]);
      await expect(
        runtime.eval(`
          gradient <- numDeriv::grad(
            function(x) sum(x ^ 2),
            c(1, 2),
            method = "simple",
            method.args = list(eps = 1e-6)
          )
          jacobian <- numDeriv::jacobian(
            function(x) c(x[1] + x[2], x[1] * x[2]),
            c(2, 3),
            method = "simple",
            method.args = list(eps = 1e-6)
          )
          c(round(gradient, 6), round(c(jacobian), 6), dim(jacobian))
        `),
      ).resolves.toEqual([2.000001, 4.000001, 1, 3, 1, 2, 2, 2]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public abind 1.4-8 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["abind"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "abind", version: "1.4-8" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "e9862a710e03ef978409dbd3c4138dd4cdf96b0584c6f228ffe2b42d1e0e9dee",
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
      await expect(runtime.eval('requireNamespace("abind", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("abind"))')).resolves.toBe("1.4.8");
      await expect(runtime.eval('library("abind"); "package:abind" %in% search()')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('sort(getNamespaceExports("abind"))')).resolves.toEqual([
        "abind",
        "acorn",
        "adrop",
        "afill<-",
        "asub",
      ]);
      await expect(
        runtime.eval(`
          x <- matrix(1:6, nrow = 2)
          y <- x + 10
          combined <- abind::abind(x, y, along = 3)
          dropped <- abind::adrop(array(1:6, c(2, 3, 1)), drop = 3)
          c(typeof(combined), dim(combined), c(combined), dim(dropped), c(dropped))
        `),
      ).resolves.toEqual([
        "double",
        "2",
        "3",
        "2",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "2",
        "3",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public rprojroot 2.1.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["rprojroot"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "rprojroot", version: "2.1.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "086ed9af48d2f4e917f40bdf3364e395115f25fff5017d5527d00b20df343744",
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
      await expect(runtime.eval('requireNamespace("rprojroot", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("rprojroot"))')).resolves.toBe(
        "2.1.1",
      );
      await expect(
        runtime.eval('library("rprojroot"); "package:rprojroot" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          criterion <- rprojroot::has_file("DESCRIPTION")
          composite <- criterion | rprojroot::has_dir(".git")
          c(
            class(criterion), names(criterion), length(criterion$testfun), criterion$desc,
            class(composite), length(composite$testfun), composite$desc
          )
        `),
      ).resolves.toEqual([
        "root_criterion",
        "testfun",
        "desc",
        "subdir",
        "find_file",
        "make_fix_file",
        "1",
        "contains a file 'DESCRIPTION'",
        "root_criterion",
        "2",
        "contains a file 'DESCRIPTION'",
        "contains a directory '.git'",
      ]);
      await expect(
        runtime.eval(`
          dir.create("probe-project/sub", recursive = TRUE)
          writeLines("Package: demo", "probe-project/DESCRIPTION")
          criterion <- rprojroot::has_file("DESCRIPTION")
          found <- rprojroot::find_root(criterion, "probe-project/sub")
          root_file <- rprojroot::find_root_file(
            "DESCRIPTION", criterion = criterion, path = "probe-project/sub"
          )
          c(
            criterion$testfun[[1]]("probe-project"),
            basename(found), basename(root_file), basename(dirname(root_file)),
            basename(criterion$find_file("DESCRIPTION", path = "probe-project/sub")),
            rprojroot::get_root_desc(criterion | rprojroot::has_dir(".git"), found)
          )
        `),
      ).resolves.toEqual([
        "TRUE",
        "probe-project",
        "DESCRIPTION",
        "probe-project",
        "DESCRIPTION",
        "contains a file 'DESCRIPTION'",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public rstudioapi 0.19.0 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["rstudioapi"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "rstudioapi", version: "0.19.0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "d3834a7e3c17f04c0808e50afe5fa80575fe87f3ed0ab8fc5c69fbb1ab645ab0",
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
      await expect(runtime.eval('requireNamespace("rstudioapi", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("rstudioapi"))')).resolves.toBe(
        "0.19.0",
      );
      await expect(
        runtime.eval('library("rstudioapi"); "package:rstudioapi" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          exports <- getNamespaceExports("rstudioapi")
          all(c(
            "document_position", "document_range", "isAvailable", "verifyAvailable"
          ) %in% exports)
        `),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          p <- rstudioapi::document_position(3, 5)
          p2 <- rstudioapi::as.document_position(c(7, 9))
          range <- rstudioapi::document_range(p, p2)
          range2 <- rstudioapi::document_range(c(1, 2, 4, 6))
          c(
            class(p), names(p), unlist(p), rstudioapi::is.document_position(p),
            class(range), names(range), unlist(range), unlist(range2),
            rstudioapi::is.document_range(range)
          )
        `),
      ).resolves.toEqual([
        "document_position",
        "row",
        "column",
        "3",
        "5",
        "TRUE",
        "document_range",
        "start",
        "end",
        "3",
        "5",
        "7",
        "9",
        "1",
        "2",
        "4",
        "6",
        "TRUE",
      ]);
      await expect(
        runtime.eval(`c(
          rstudioapi::isAvailable(),
          rstudioapi::isAvailable("1.0"),
          inherits(try(rstudioapi::verifyAvailable(), silent = TRUE), "try-error")
        )`),
      ).resolves.toEqual([false, false, true]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public inline 0.3.21 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["inline"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "inline", version: "0.3.21" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "1de1adf3d804477438730e68d81c9bf6173a4a1cedf0081dc838a0286b805af0",
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
      await expect(runtime.eval('requireNamespace("inline", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("inline"))')).resolves.toBe("0.3.21");
      await expect(runtime.eval('library("inline"); "package:inline" %in% search()')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('sort(getNamespaceExports("inline"))')).resolves.toEqual([
        "cfunction",
        "code",
        "cxxfunction",
        "getDynLib",
        "getPlugin",
        "moveDLL",
        "package.skeleton",
        "print",
        "rcpp",
        "readCFunc",
        "registerPlugin",
        "setCMethod",
        "writeCFunc",
      ]);
      await expect(
        runtime.eval(`
          plugin_function <- function(prefix = "") list(
            includes = paste0(prefix, "header"),
            LinkingTo = c("alpha", "beta"),
            env = list(PKG_LIBS = "-lm")
          )
          registration <- withVisible(inline::registerPlugin("nativr_probe", plugin_function))
          plugin <- inline::getPlugin("nativr_probe", prefix = "// ")
          c(
            typeof(registration$value), registration$visible,
            identical(registration$value, plugin_function),
            names(plugin), plugin$includes, plugin$LinkingTo,
            names(plugin$env), unlist(plugin$env),
            inherits(try(inline::getPlugin("not_registered"), silent = TRUE), "try-error")
          )
        `),
      ).resolves.toEqual([
        "closure",
        "FALSE",
        "TRUE",
        "includes",
        "LinkingTo",
        "env",
        "// header",
        "alpha",
        "beta",
        "PKG_LIBS",
        "-lm",
        "TRUE",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public rematch 2.0.0 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["rematch"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "rematch", version: "2.0.0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "9ebf25642db777d3a9d50470064a894ae773dcfb0419b0ceb969374c503196f0",
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
      await expect(runtime.eval('requireNamespace("rematch", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("rematch"))')).resolves.toBe("2.0.0");
      await expect(runtime.eval('sort(getNamespaceExports("rematch"))')).resolves.toEqual([
        "re_match",
        "re_match_all",
      ]);
      await expect(
        runtime.eval(`
          pattern <- "(?<year>[0-9]{4})-(?<month>[0-1][0-9])-(?<day>[0-3][0-9])"
          matched <- rematch::re_match(
            pattern, c("2016-04-20", "not a date", "1977-08-08")
          )
          output <- c(
            typeof(matched), class(matched), dim(matched), colnames(matched),
            c(matched), as.character(c(is.na(matched)))
          )
          output[is.na(output)] <- "<NA>"
          output
        `),
      ).resolves.toEqual([
        "character",
        "matrix",
        "array",
        "3",
        "4",
        ".match",
        "year",
        "month",
        "day",
        "2016-04-20",
        "<NA>",
        "1977-08-08",
        "2016",
        "<NA>",
        "1977",
        "04",
        "<NA>",
        "08",
        "20",
        "<NA>",
        "08",
        "FALSE",
        "TRUE",
        "FALSE",
        "FALSE",
        "TRUE",
        "FALSE",
        "FALSE",
        "TRUE",
        "FALSE",
        "FALSE",
        "TRUE",
        "FALSE",
      ]);
      await expect(
        runtime.eval(`
          matched <- rematch::re_match_all(
            "(?<letter>[a-z])(?<number>[0-9]+)", c("a1 b22", "none")
          )
          c(
            length(matched), dim(matched[[1]]), colnames(matched[[1]]),
            c(matched[[1]]), dim(matched[[2]]), colnames(matched[[2]]),
            c(matched[[2]])
          )
        `),
      ).resolves.toEqual([
        "2",
        "2",
        "3",
        ".match",
        "letter",
        "number",
        "a1",
        "b22",
        "a",
        "b",
        "1",
        "22",
        "0",
        "3",
        ".match",
        "letter",
        "number",
      ]);
      await expect(
        runtime.eval('library("rematch"); "package:rematch" %in% search()'),
      ).resolves.toBe(true);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public whisker 0.4.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["whisker"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "whisker", version: "0.4.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "29f934c71cb22d51e7cdaae64df35e2484b7797c44b6ab78371d18d50072c9c6",
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
      await expect(runtime.eval('requireNamespace("whisker", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("whisker"))')).resolves.toBe("0.4.1");
      await expect(runtime.eval('sort(getNamespaceExports("whisker"))')).resolves.toEqual([
        "iteratelist",
        "rowSplit",
        "whisker.escape",
        "whisker.render",
      ]);
      await expect(
        runtime.eval(`c(
          whisker::whisker.render("Hello {{place}}!", list(place = "World")),
          whisker::whisker.render(
            "escaped={{name}} raw={{{name}}}", list(name = '<Nescio&"x">')
          ),
          whisker::whisker.render(
            "{{#items}}{{>row}}{{/items}}{{^items}}empty{{/items}}",
            list(items = list(list(name = "A"), list(name = "B"))),
            partials = list(row = "[{{name}}]")
          ),
          whisker::whisker.render(
            "{{#ok}}yes{{/ok}}{{^missing}}/none{{/missing}}", list(ok = TRUE)
          )
        )`),
      ).resolves.toEqual([
        "Hello World!",
        'escaped=&lt;Nescio&amp;&quot;x&quot;&gt; raw=<Nescio&"x">',
        "[A][B]",
        "yes/none",
      ]);
      await expect(
        runtime.eval(`
          escaped <- whisker::whisker.escape(c("<&\\"'>", NA_character_))
          escaped[is.na(escaped)] <- "<NA>"
          iterated <- whisker::iteratelist(c(a = 1, b = 2))
          rows <- whisker::rowSplit(data.frame(
            x = c(1, 2), y = c("a", "b"), stringsAsFactors = FALSE
          ))
          c(
            escaped, unname(unlist(iterated)), is.null(names(iterated)),
            unname(unlist(rows)), is.null(names(rows))
          )
        `),
      ).resolves.toEqual([
        "&lt;&amp;&quot;'&gt;",
        "<NA>",
        "a",
        "1",
        "b",
        "2",
        "TRUE",
        "1",
        "a",
        "2",
        "b",
        "TRUE",
      ]);
      await expect(
        runtime.eval('library("whisker"); "package:whisker" %in% search()'),
      ).resolves.toBe(true);
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);
