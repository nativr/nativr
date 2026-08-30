import { createR, NA } from "@nativr/nativr";
import { expect, it } from "vitest";

import {
  PackageCompatibilityError,
  installPackagesFromRepository,
  runPackageChecks,
} from "../src/index.js";

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
          value: "68472dcdb97b6726be934a1c683bd81439bd31ed92c76f5e5adbeaa56c7435e2",
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
      const examples = await runtime.evalDetailed(
        'utils::example("R6Class", package = "R6", echo = FALSE)',
      );
      expect(examples.value).toEqual([5, true]);
      expect(examples.visible).toBe(false);
      expect(examples.warnings).toEqual([]);
      expect(examples.output).toEqual(
        [
          "Next item is at index 1 \n",
          "1: 5\n",
          "2: 6\n",
          "3: foo\n",
          "Next item is at index 2 \n",
          "1: 5\n",
          "2: 6\n",
          "3: foo\n",
        ].map((text) => ({ stream: "stdout", text })),
      );
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
          value: "715cc8f343e6a1c5ae21d7df1ddc078fa61403a3c90aeeae93ca2864394edf69",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual(["viridis"]);
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
      await expect(
        runtime.evalDetailed(
          'utils::example("viridis", package = "viridisLite", echo = FALSE); invisible(NULL)',
        ),
      ).rejects.toMatchObject({
        code: "NRE2221",
        message: "There is no installed package called 'ggplot2'.",
      });
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
          value: "4f52890b51308b0defe00ddc542d93ea4865c80190ceb562b0d7d935e62ccf7a",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual(["RColorBrewer"]);
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
      expect(minimum.warnings).toMatchObject([
        {
          code: "NRW1100",
          message:
            "minimal value for n is 3, returning requested palette with 3 different levels\n",
        },
      ]);
      await expect(
        runtime.evalDetailed(
          'utils::example("RColorBrewer", package = "RColorBrewer", echo = FALSE); invisible(NULL)',
        ),
      ).resolves.toMatchObject({ value: null, visible: false, warnings: [] });
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
        limits: { maxOutputBytes: 128_000_000 },
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
      const figures = await runtime.evalDetailed(`
          set.seed(1)
          figures <- labeling::extended.figures(2)
          c(length(figures), names(figures))
        `);
      expect(figures.value).toEqual([
        "72",
        "xlog",
        "ylog",
        "adj",
        "ann",
        "ask",
        "bg",
        "bty",
        "cex",
        "cex.axis",
        "cex.lab",
        "cex.main",
        "cex.sub",
        "cin",
        "col",
        "col.axis",
        "col.lab",
        "col.main",
        "col.sub",
        "cra",
        "crt",
        "csi",
        "cxy",
        "din",
        "err",
        "family",
        "fg",
        "fig",
        "fin",
        "font",
        "font.axis",
        "font.lab",
        "font.main",
        "font.sub",
        "lab",
        "las",
        "lend",
        "lheight",
        "ljoin",
        "lmitre",
        "lty",
        "lwd",
        "mai",
        "mar",
        "mex",
        "mfcol",
        "mfg",
        "mfrow",
        "mgp",
        "mkh",
        "new",
        "oma",
        "omd",
        "omi",
        "page",
        "pch",
        "pin",
        "plt",
        "ps",
        "pty",
        "smo",
        "srt",
        "tck",
        "tcl",
        "usr",
        "xaxp",
        "xaxs",
        "xaxt",
        "xpd",
        "yaxp",
        "yaxs",
        "yaxt",
        "ylbias",
      ]);
      expect(figures.warnings).toEqual(
        ["cin", "cra", "csi", "cxy", "din", "page"].map((name) => ({
          code: "NRW1141",
          message: `graphical parameter "${name}" cannot be set`,
        })),
      );
      expect(new Set(figures.graphics.map((event) => event.kind))).toEqual(
        new Set(["new-page", "window", "polygon", "segments", "text"]),
      );
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
          value: "58b166d2ec91ce7d993bbca6ba05a2df4241fa9e61fa62ef116731355845e629",
        },
      });
      expect(
        artifact?.bundle.resources.find((resource) => resource.path === ".nativr/examples-v1.json"),
      ).toBeUndefined();
      const helpResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/help-v1.json",
      );
      const help = JSON.parse(Buffer.from(helpResource?.data ?? "", "base64").toString("utf8")) as {
        topics: { name: string; sections: { name: string }[] }[];
      };
      expect(help.topics.map((topic) => topic.name)).toEqual([
        "get_config",
        "pkgconfig-package",
        "set_config",
        "set_config_in",
      ]);
      expect(
        help.topics
          .flatMap((topic) => topic.sections)
          .some((section) => section.name === "examples"),
      ).toBe(false);
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
          value: "885d6994fbe2b9501cb66fcf9d7fccdf171768282ab5d869c5204323b7af938d",
        },
      });
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      expect(exampleResource).toBeDefined();
      const exampleManifest = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; aliases: string[] }[] };
      expect(exampleManifest.topics.map((topic) => topic.name)).toEqual([
        "coercion-factor",
        "coercion-time-difference",
        "setops",
      ]);
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
      for (const topic of exampleManifest.topics) {
        await expect(
          runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "generics", echo = FALSE); invisible(NULL)`,
          ),
        ).resolves.toMatchObject({ value: null, visible: false, warnings: [] });
      }
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
      const installed = await installPackagesFromRepository(["withr"], {
        pack: { includeTests: true },
      });
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "withr", version: "3.0.3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "7a4dfdfd8052c17b6ec9d5a5136d580d468f4f18911d94995d473a3f7f4d468d",
        },
      });
      const packageTestsResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/tests-v1.json",
      );
      const packageTests = JSON.parse(
        Buffer.from(packageTestsResource?.data ?? "", "base64").toString("utf8"),
      ) as { scripts: { path: string; expectedOutput: string }[] };
      expect(packageTests.scripts).toEqual([{ path: "testthat.R", expectedOutput: "" }]);
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
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const exampleManifest = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string }[] };
      expect(exampleManifest.topics.map((topic) => topic.name)).toEqual([
        "defer",
        "devices",
        "local_",
        "with_connection",
        "with_db_connection",
        "with_dir",
        "with_envvar",
        "with_file",
        "with_language",
        "with_libpaths",
        "with_locale",
        "with_makevars",
        "with_options",
        "with_package",
        "with_par",
        "with_path",
        "with_rng_version",
        "with_seed",
        "with_tempfile",
        "with_timezone",
        "withr",
      ]);
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
      await runtime.reset();
      const inapplicableExampleTopics = new Set(["with_db_connection", "with_makevars"]);
      const blockedExampleTopics = new Set<string>();
      for (const topic of exampleManifest.topics) {
        if (inapplicableExampleTopics.has(topic.name) || blockedExampleTopics.has(topic.name)) {
          continue;
        }
        let result;
        try {
          result = await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "withr", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          throw new Error(`withr example topic '${topic.name}' failed`, { cause: error });
        }
        expect(result).toMatchObject({ value: null, visible: false });
        if (topic.name === "defer") {
          expect(result.output).toEqual([
            { stream: "stdout", text: "NULL\n" },
            { stream: "stdout", text: '[1] "two"\n' },
            { stream: "stdout", text: '[1] "one"\n' },
          ]);
        }
        if (topic.name === "with_language") {
          expect(result.warnings).toMatchObject(
            Array.from({ length: 3 }, () => ({
              code: "NRW1100",
              message: "Changing language has no effect when R installed without NLS",
            })),
          );
        } else if (topic.name === "with_locale") {
          expect(result.warnings).toMatchObject(
            ["es_ES", "en_GB", "es_ES", "fr_FR"].map((locale) => ({
              code: "NRW1021",
              message: `OS reports request to set locale to '${locale}' cannot be honored`,
            })),
          );
        } else if (topic.name === "with_rng_version") {
          expect(result.warnings).toEqual([
            { code: "NRW1121", message: "buggy version of Kinderman-Ramage generator used" },
            {
              code: "NRW1122",
              message: "RNGkind: Marsaglia-Multicarry has poor statistical properties",
            },
            { code: "NRW1121", message: "buggy version of Kinderman-Ramage generator used" },
            {
              code: "NRW1122",
              message: "RNGkind: Marsaglia-Multicarry has poor statistical properties",
            },
          ]);
        } else {
          expect(result.warnings).toEqual([]);
        }
      }
      await runtime.reset();
      await expect(
        runtime.eval(`
          tests <- system.file(".nativr", "tests", package = "withr")
          source(file.path(tests, "testthat.R"), chdir = TRUE)
        `),
      ).rejects.toMatchObject({
        code: "NRE2221",
        message: "There is no installed package called 'testthat'.",
      });
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
          value: "8b00c6709bb16b53a750f1aafecbfe737be52bd77ffe2e9fbc41e72e90af7cae",
        },
      });
      const artifact = installed.artifacts[0];
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "are_equal",
        "assert-is",
        "assert_that",
        "assertions-file",
        "has_args",
        "has_attr",
        "noNA",
        "not_empty",
        "on_failure",
        "scalar",
        "validate_that",
      ]);
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
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "assertthat", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`assertthat example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
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
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "crayon");
      expect(artifact).toMatchObject({
        package: { name: "crayon", version: "1.5.3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "f3f95c0c6d69eb404eb4017b4cc6613df3b17fb4b79005c368fd39371d591932",
        },
      });
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "col_align",
        "col_nchar",
        "col_strsplit",
        "col_substr",
        "col_substring",
        "combine_styles",
        "concat",
        "crayon",
        "drop_style",
        "has_color",
        "has_style",
        "hyperlink",
        "make_style",
        "num_ansi_colors",
        "num_colors",
        "start.crayon",
        "strip_style",
        "style",
        "styles",
      ]);
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
      await expect(
        runtime.eval('named_alert <- combine_styles("bold", "red4", "bgCyan"); TRUE'),
      ).resolves.toBe(true);
      await expect(runtime.eval('strip_style(named_alert("Warning!"))')).resolves.toBe("Warning!");
      await expect(
        runtime.eval('strip_style(combine_styles(bold, red, bgCyan)("Warning!"))'),
      ).resolves.toBe("Warning!");
      await expect(runtime.eval('strip_style((bold $ red $ bgCyan)("Warning!"))')).resolves.toBe(
        "Warning!",
      );
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "crayon", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`crayon example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  120_000,
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
          value: "5da883430cdeea09c8517e7a9bf0ac1ba5690a907d54e5bb913c96ede1fe7e53",
        },
      });
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual(["praise"]);
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
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "praise", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`praise example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
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
          value: "40fd763f9f66ed24df5d5b3040f5489ebf1c2ed2d0f26c01caee20cbecac06b1",
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
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "pretty_bytes",
        "pretty_dt",
        "pretty_ms",
        "pretty_num",
        "pretty_p_value",
        "pretty_sec",
        "time_ago",
        "vague_dt",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "prettyunits", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`prettyunits example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
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
          value: "872960aa242089f6b0ba7c96913d8a25e596feb9657632ec90921cbc0288a4a3",
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
        systemCommand: () => ({
          status: 0,
          stdout: "R version 4.6.1 (2026-06-12) -- NativR evaluate fixture\n",
        }),
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
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "evaluate",
        "inject_funs",
        "parse_all",
        "replay",
        "set_hooks",
        "trim_intermediate_plots",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "evaluate", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`evaluate example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
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
      const installed = await installPackagesFromRepository(["numDeriv"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "numDeriv",
      );
      expect(artifact).toMatchObject({
        package: { name: "numDeriv", version: "2016.8-1.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "3a8ceb6ce9eb8536331b718976107d61da881eb1dded1461fba85d047d0a7eea",
        },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "large-browser",
        limits: { maxSteps: 500_000_000, maxVectorLength: 100_000_000 },
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

      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "genD",
        "grad",
        "hessian",
        "jacobian",
      ]);
      await expect(runtime.eval("round(numDeriv::grad(sin, pi), 10)")).resolves.toBe(-1);
      await expect(
        runtime.eval(`
          rosbkext.f <- function(p, cons = 10) {
            n <- length(p)
            j <- 1:(n / 2)
            tjm1 <- 2 * j - 1
            tj <- 2 * j
            sum(cons ^ 2 * (p[tjm1] ^ 2 - p[tj]) ^ 2 + (p[tj] - 1) ^ 2)
          }
          rosbkext.g <- function(p, cons = 10) {
            n <- length(p)
            g <- rep(NA, n)
            j <- 1:(n / 2)
            tjm1 <- 2 * j - 1
            tj <- 2 * j
            g[tjm1] <- 4 * cons ^ 2 * p[tjm1] * (p[tjm1] ^ 2 - p[tj])
            g[tj] <- -2 * cons ^ 2 * (p[tjm1] ^ 2 - p[tj]) + 2 * (p[tj] - 1)
            g
          }
          set.seed(123)
          p0 <- runif(10)
          exact <- rosbkext.g(p0, cons = 10)
          observed <- numDeriv::grad(func = rosbkext.f, x = p0, cons = 10, method = "complex")
          max(abs(exact - observed) / (1 + abs(exact)))
        `),
      ).resolves.toBeLessThan(1e-15);
      const testsResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/tests-v1.json",
      );
      const tests = JSON.parse(
        Buffer.from(testsResource?.data ?? "", "base64").toString("utf8"),
      ) as { scripts: { path: string; expectedOutput: string }[] };
      expect(tests.scripts).toEqual([
        { path: "BWeg.R", expectedOutput: "" },
        { path: "CSD.R", expectedOutput: "" },
        { path: "grad01.R", expectedOutput: "" },
        { path: "hessian01.R", expectedOutput: "" },
        { path: "jacobian01.R", expectedOutput: "" },
        { path: "oneSided.R", expectedOutput: "" },
        { path: "trig01.R", expectedOutput: "" },
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck.firstBlocker)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "passed").length).toBeGreaterThan(
        15,
      );
    } finally {
      await runtime?.dispose();
    }
  },
  120_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public abind 1.4-8 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["abind"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "abind");
      expect(artifact).toMatchObject({
        package: { name: "abind", version: "1.4-8" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "5495ab3589038cfd5dfb132e124fc7d1b3a3188dbbfe967018e4ede4c146ecdd",
        },
      });
      runtime = await createR({
        execution: "inline",
        limits: { maxSteps: 100_000_000, maxVectorLength: 5_000_000 },
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
      await expect(
        runtime.eval(`
          cc <- as.data.frame(matrix(25:36, nrow = 3))
          converted <- as.matrix(cc)
          c(length(converted), dim(converted), typeof(converted))
        `),
      ).resolves.toEqual(["12", "3", "4", "integer"]);

      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "abind",
        "acorn",
        "adrop",
        "afill",
        "asub",
      ]);
      const testsResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/tests-v1.json",
      );
      const tests = JSON.parse(
        Buffer.from(testsResource?.data ?? "", "base64").toString("utf8"),
      ) as { scripts: { path: string; expectedOutput: string }[] };
      expect(tests.scripts).toEqual([
        { path: "abind.R", expectedOutput: "abind.Rout.save" },
        { path: "adrop.R", expectedOutput: "adrop.Rout.save" },
        { path: "afill.R", expectedOutput: "afill.Rout.save" },
        { path: "asub.R", expectedOutput: "asub.Rout.save" },
        { path: "dnns.R", expectedOutput: "dnns.Rout.save" },
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck.firstBlocker)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "passed").length).toBeGreaterThan(
        15,
      );
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public selectr 0.6-0 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["selectr"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "selectr",
      );
      expect(artifact).toMatchObject({
        package: { name: "selectr", version: "0.6-0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 500_000_000, maxVectorLength: 100_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "d286a0114315235128d81f91428b9799237ec56376a71e2895c709b8215a37f6",
      });
      expect(
        packageCheck.steps
          .filter((step) => step.id.startsWith("example:"))
          .map((step) => [step.id, step.status]),
      ).toEqual([
        ["example:css_to_xpath", "passed"],
        ["example:querySelectorAll", "passed"],
      ]);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  120_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public timeDate 4052.112 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["timeDate"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "timeDate",
      );
      expect(artifact).toMatchObject({
        package: { name: "timeDate", version: "4052.112" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 500_000_000, maxVectorLength: 100_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "ab56e656c0e8ac9908812460b975548e4f073355ee1936ae83867305283f843b",
      });
      expect(
        packageCheck.steps
          .filter((step) =>
            ["metadata", "namespace", "attachment", "test:doRUnit.R"].includes(step.id),
          )
          .map((step) => [step.id, step.status]),
      ).toEqual([
        ["metadata", "passed"],
        ["namespace", "passed"],
        ["attachment", "passed"],
        ["test:doRUnit.R", "passed"],
      ]);
      await expect(
        runtime.eval(`
          value <- timeCalendar(2020, 1, 2, 3, 4, 5, FinCenter = "GMT")
          c(class(value), as.character(value), finCenter(value))
        `),
      ).resolves.toEqual(["timeDate", "2020-01-02 03:04:05", "GMT"]);
      await expect(
        runtime.eval(`
          set.seed(1234)
          tR <- sample(timeCalendar())
          c(class(tR), isS4(tR), length(tR))
        `),
      ).resolves.toEqual(["timeDate", "TRUE", "12"]);
      await expect(
        runtime.eval(`
          bounds <- range(timeCalendar())
          c(class(bounds), isS4(bounds), names(unclass(bounds)))
        `),
      ).resolves.toEqual(["timeDate", "TRUE", "Data", "format", "FinCenter"]);
      expect(
        await runtime.eval(`
          aligned <- align(timeCalendar(), by = "2w", offset = "3d")
          c(class(aligned), isS4(aligned), length(aligned))
        `),
      ).toEqual(["timeDate", "TRUE", "24"]);
      expect(
        await runtime.eval(`
          daily <- alignDaily(timeCalendar())
          weekends <- alignDaily(timeCalendar(), include.weekends = TRUE)
          monthly <- alignMonthly(timeCalendar())
          c(class(daily), length(daily), class(weekends), length(weekends), class(monthly), length(monthly))
        `),
      ).toEqual(["timeDate", "239", "timeDate", "335", "timeDate", "12"]);
      expect(
        await runtime.eval(`
          monthly <- alignMonthly(timeCalendar())
          c(length(monthly), as.character(monthly))
        `),
      ).toEqual([
        "12",
        "2026-01-30",
        "2026-02-27",
        "2026-03-31",
        "2026-04-30",
        "2026-05-30",
        "2026-06-30",
        "2026-07-31",
        "2026-08-31",
        "2026-09-30",
        "2026-10-30",
        "2026-11-30",
        "2026-12-31",
      ]);
      expect(
        await runtime.eval(`
          x <- timeSequence(from = "2001-01-01", to = "2009-01-01", by = "day")
          c(length(x), isS4(x), class(x), length(x@Data))
        `),
      ).toEqual(["2923", "TRUE", "timeDate", "2923"]);
      expect(
        await runtime.eval(`
          firsts <- timeFirstDayInMonth(x)
          lasts <- timeLastDayInMonth(x)
          periodWindows <- periods(x, "12m", "1m")
          rollingWindows <- monthlyRolling(x)
          c(
            length(unique(firsts)), length(unique(lasts)),
            length(periodWindows), lengths(periodWindows),
            length(rollingWindows), lengths(rollingWindows)
          )
        `),
      ).toEqual([97, 97, 2, 86, 86, 2, 86, 86]);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.find((step) => step.id === "vignettes")).toMatchObject({
        kind: "vignettes",
        status: "not-applicable",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  180_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public carData 3.0-6 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["carData"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "carData",
      );
      expect(artifact).toMatchObject({
        package: { name: "carData", version: "3.0-6" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "cb6e8d712d5031eb1c4e426911963d1ad7409eb702522d84422f3be512806d41",
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        throw new Error(`carData first blocker: ${JSON.stringify(packageCheck.firstBlocker)}`);
      }
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(18);
      expect(packageCheck.steps.find((step) => step.id === "tests")).toMatchObject({
        status: "not-applicable",
      });
      expect(packageCheck.steps.find((step) => step.id === "vignettes")).toMatchObject({
        status: "not-applicable",
      });
      await expect(
        runtime.eval(`
          library(carData)
          c(
            identical(Arrests, carData::Arrests),
            exists("Arrests", envir = asNamespace("carData"), inherits = FALSE),
            "Arrests" %in% getNamespaceExports("carData"),
            dim(Arrests), names(Arrests),
            dim(MplsStops), names(MplsStops)
          )
        `),
      ).resolves.toEqual([
        "TRUE",
        "FALSE",
        "FALSE",
        "5226",
        "8",
        "released",
        "colour",
        "year",
        "age",
        "sex",
        "employed",
        "citizen",
        "checks",
        "51920",
        "14",
        "idNum",
        "date",
        "problem",
        "MDC",
        "citationIssued",
        "personSearch",
        "vehicleSearch",
        "preRace",
        "race",
        "gender",
        "lat",
        "long",
        "policePrecinct",
        "neighborhood",
      ]);
      await expect(
        runtime.eval(`
          c(
            contrasts(OBrienKaiser$gender),
            contrasts(OBrienKaiser$treatment)
          )
        `),
      ).resolves.toEqual([1, -1, -2, 1, 1, 0, -1, 1]);
    } finally {
      await runtime?.dispose();
    }
  },
  180_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public rex 1.2.2 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["rex"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "rex");
      expect(artifact).toMatchObject({
        package: { name: "rex", version: "1.2.2" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "191f79c1fb93b5381a466f8635c03d7ae750bacccbd42df03e22abc944bcce48",
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toMatchObject([
        { id: "example:capture", status: "passed" },
        { id: "example:character_class", status: "passed" },
        { id: "example:lookarounds", status: "passed" },
        { id: "example:re_matches", status: "passed" },
        { id: "example:re_substitutes", status: "passed" },
      ]);
      expect(packageCheck.steps.filter((step) => step.kind === "vignettes")).toMatchObject([
        { id: "vignette:log_parsing", status: "passed" },
        { id: "vignette:url_parsing", status: "passed" },
      ]);
      await expect(
        runtime.eval(`
          library(rex)
          pattern <- rex("gr", one_of("a", "e"), "y")
          captures <- re_matches(
            c("12=alpha", "7=beta", "bad"),
            rex(capture(digits, name = "n"), "=", capture(alphas, name = "value"))
          )
          c(
            as.character(pattern),
            grepl(pattern, c("grey", "gray", "green")),
            captures$n,
            captures$value
          )
        `),
      ).resolves.toEqual([
        "gr[ae]y",
        "TRUE",
        "TRUE",
        "FALSE",
        "12",
        "7",
        { __nativr__: "NA" },
        "alpha",
        "beta",
        { __nativr__: "NA" },
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  180_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public brew 1.0-10 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["brew"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "brew");
      expect(artifact).toMatchObject({
        package: { name: "brew", version: "1.0-10" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "51479288695528a14536eee3b4b0c96751d92e8c3442402cc6c3c7bfa140fd4a",
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toMatchObject([
        { id: "example:brew", status: "passed" },
        { id: "example:brewCache", status: "passed" },
      ]);
      expect(packageCheck.steps.find((step) => step.id === "vignettes")).toMatchObject({
        kind: "vignettes",
        status: "not-applicable",
      });
      await expect(
        runtime.eval(`
          library(brew)
          env <- new.env(parent = globalenv())
          env$name <- "Ada"
          env$values <- c(2L, 4L, 6L)
          output <- capture.output(brew(
            text = "Hello <%= name %>! Sum=<%= sum(values) %>. <%# ignored %>Done",
            envir = env
          ))
          parsed <- brew(
            text = "A<%= 1 + 2 %>B",
            run = FALSE,
            parseCode = FALSE
          )
          c(output, parsed$text, parsed$code, length(parsed$text), length(parsed$code))
        `),
      ).resolves.toEqual([
        "Hello Ada! Sum=12. Done",
        "A",
        " 1 + 2 ",
        "B\n",
        ".brew.cat(1,1)",
        "cat( 1 + 2 )",
        ".brew.cat(3,3)",
        "3",
        "3",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  180_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public shape 1.4.6.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["shape"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "shape");
      expect(artifact).toMatchObject({
        package: { name: "shape", version: "1.4.6.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "ef839b8ffe4d57b24dba3f62bd10149c007f834fb8ffd8342869df37435a93b8",
      });
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.find((step) => step.id === "example:femmecol")).toEqual({
        id: "example:femmecol",
        kind: "examples",
        status: "passed",
      });
      expect(packageCheck.steps.find((step) => step.id === "example:Arrows")).toEqual({
        id: "example:Arrows",
        kind: "examples",
        status: "passed",
        warningCount: 10,
      });
      expect(packageCheck.steps.find((step) => step.id === "vignette:shape")).toEqual({
        id: "vignette:shape",
        kind: "vignettes",
        status: "passed",
      });
      for (const topic of [
        "filledcircle",
        "filledcylinder",
        "filledellipse",
        "filledmultigonal",
        "filledshape",
        "roundrect",
      ]) {
        expect(packageCheck.steps.find((step) => step.id === `example:${topic}`)).toEqual({
          id: `example:${topic}`,
          kind: "examples",
          status: "passed",
        });
      }
    } finally {
      await runtime?.dispose();
    }
  },
  180_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public corrplot 0.95 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["corrplot"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "corrplot",
      );
      expect(artifact).toMatchObject({
        package: { name: "corrplot", version: "0.95" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "c24a371fb61302e64e399da83a6e229be0c44cb24a048347e5813fb5e30e16ab",
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
      await expect(
        runtime.eval("length(corrplot::corrMatOrder(cor(mtcars), order = 'AOE'))"),
      ).resolves.toBe(11);
      await expect(
        runtime.eval("length(corrplot::corrMatOrder(cor(mtcars), order = 'FPC'))"),
      ).resolves.toBe(11);
      await expect(
        runtime.eval("length(corrplot::corrMatOrder(cor(mtcars), order = 'hclust'))"),
      ).resolves.toBe(11);
      await expect(
        runtime.eval(
          "length(corrplot::corrMatOrder(cor(mtcars), order = 'hclust', hclust.method = 'ward.D'))",
        ),
      ).resolves.toBe(11);
      await expect(runtime.eval("corrplot::corrplot(cor(mtcars)); TRUE")).resolves.toBe(true);
      await expect(
        runtime.eval("length(corrplot::cor.mtest(mtcars, conf.level = .95)$p)"),
      ).resolves.toBe(121);
      await expect(
        runtime.eval(`
          testRes <- corrplot::cor.mtest(mtcars, conf.level = .95)
          corrplot::corrplot(
            cor(mtcars), p.mat = testRes$p, sig.level = .05, order = 'hclust', addrect = 2
          )
          TRUE
        `),
      ).resolves.toBe(true);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(
        packageCheck.steps
          .filter((step) => step.kind === "examples")
          .every((step) => step.status === "passed"),
      ).toBe(true);
      for (const topic of ["COL1", "COL2", "colorlegend", "corrMatOrder", "corrRect"]) {
        expect(packageCheck.steps.find((step) => step.id === `example:${topic}`)).toEqual({
          id: `example:${topic}`,
          kind: "examples",
          status: "passed",
        });
      }
    } finally {
      await runtime?.dispose();
    }
  },
  180_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public insight 1.5.2 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["insight"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "insight",
      );
      expect(artifact).toMatchObject({
        package: { name: "insight", version: "1.5.2" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "180cbb7ff819047f02dc143336bf19ed7483585f1db2f9746e55e442c4ea351b",
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
      await runtime.eval("library(insight); data(iris); data(mtcars)");
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.firstBlocker).toEqual({
        id: "test:testthat.R",
        kind: "tests",
        status: "failed",
        message: "expression 1: There is no installed package called 'testthat'.",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  180_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public GPArotation 2026.8-1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["GPArotation"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "GPArotation",
      );
      expect(artifact).toMatchObject({
        package: { name: "GPArotation", version: "2026.8-1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "4ff33c454116f0b433d36fc7a393343fcae0fd44d2c276e773fef60f2aa9494b",
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: {
          maxSteps: 100_000_000,
          maxVectorLength: 50_000_000,
          maxAllocatedElements: 1_000_000_000,
        },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      await runtime.eval("library(GPArotation)");
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "passed").length).toBeGreaterThan(
        50,
      );
    } finally {
      await runtime?.dispose();
    }
  },
  1_200_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public palmerpenguins 0.1.1 pure-R data package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["palmerpenguins"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "palmerpenguins",
      );
      expect(artifact).toMatchObject({
        package: { name: "palmerpenguins", version: "0.1.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "c660a2971f4e288fca82a55fae86f4b62a5abb6764c620d255e99c94cd1ee3db",
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        throw new Error(
          `palmerpenguins first blocker: ${JSON.stringify(packageCheck.firstBlocker)}`,
        );
      }
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      await runtime.eval("library(palmerpenguins)");
      await expect(runtime.eval("dim(penguins)")).resolves.toEqual([344, 8]);
      await expect(runtime.eval("names(penguins)")).resolves.toEqual([
        "species",
        "island",
        "bill_length_mm",
        "bill_depth_mm",
        "flipper_length_mm",
        "body_mass_g",
        "sex",
        "year",
      ]);
      await expect(runtime.eval("class(penguins)")).resolves.toEqual([
        "tbl_df",
        "tbl",
        "data.frame",
      ]);
      await expect(
        runtime.eval("c(levels(penguins$species), levels(penguins$island), levels(penguins$sex))"),
      ).resolves.toEqual([
        "Adelie",
        "Chinstrap",
        "Gentoo",
        "Biscoe",
        "Dream",
        "Torgersen",
        "female",
        "male",
      ]);
      await expect(runtime.eval("sum(is.na(penguins))")).resolves.toBe(19);
      await expect(
        runtime.eval(
          "c(penguins$bill_length_mm[c(1, 344)], penguins$bill_depth_mm[c(1, 344)], penguins$flipper_length_mm[c(1, 344)], penguins$body_mass_g[c(1, 344)], penguins$year[c(1, 344)])",
        ),
      ).resolves.toEqual([39.1, 50.2, 18.7, 18.7, 181, 198, 3750, 3775, 2007, 2009]);
      await expect(
        runtime.eval(
          "c(as.character(penguins$species[c(1, 344)]), as.character(penguins$island[c(1, 344)]), as.character(penguins$sex[c(1, 344)]))",
        ),
      ).resolves.toEqual(["Adelie", "Chinstrap", "Torgersen", "Dream", "male", "female"]);
      await expect(runtime.eval("c(dim(penguins_raw), sum(is.na(penguins_raw)))")).resolves.toEqual(
        [344, 17, 336],
      );
      await expect(
        runtime.eval(
          "c(as.character(penguins_raw$`Date Egg`[c(1, 344)]), penguins_raw$studyName[c(1, 344)], penguins_raw$Species[c(1, 344)])",
        ),
      ).resolves.toEqual([
        "2007-11-11",
        "2009-11-21",
        "PAL0708",
        "PAL0910",
        "Adelie Penguin (Pygoscelis adeliae)",
        "Chinstrap penguin (Pygoscelis antarctica)",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public polynom 1.4-1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["polynom"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "polynom",
      );
      expect(artifact).toMatchObject({
        package: { name: "polynom", version: "1.4-1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "d9980d6e2aeabe3a8474a415b4bdb4a9fdc148baad0d3973bae8b4a31003c442",
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        throw new Error(`polynom first blocker: ${JSON.stringify(packageCheck.firstBlocker)}`);
      }
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          library(polynom)
          p <- polynomial(c(1, 2, 1))
          q <- poly.calc(-1:1)
          r <- (q - 2 * p)^2
          pl <- polylist(p, q)
          c(
            as.numeric(r),
            as.numeric(predict(p, c(-2, 0, 3))),
            as.numeric(deriv(p)),
            as.numeric(integral(p)),
            as.numeric(round(polynomial(c(1.2, 2.8, -0.2)))),
            as.numeric(sum(pl)),
            as.numeric(prod(pl)),
            length(unique(rep(pl, 3))),
            sort(round(Re(solve(poly.calc(c(-2, 0, 3, 5)))), 12))
          )
        `),
      ).resolves.toEqual([
        4,
        20,
        33,
        16,
        -6,
        -4,
        1,
        1,
        1,
        16,
        2,
        2,
        0,
        1,
        1,
        1 / 3,
        1,
        3,
        1,
        1,
        1,
        1,
        0,
        -1,
        -2,
        0,
        2,
        1,
        2,
        -2,
        0,
        3,
        5,
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public estimability 2.0.0 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["estimability"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "estimability",
      );
      expect(artifact).toMatchObject({
        package: { name: "estimability", version: "2.0.0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "93c415103e22251e6a4db3b98df961202a692fe4d5ed1991479f6c4966a86dbc",
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        throw new Error(`estimability first blocker: ${JSON.stringify(packageCheck.firstBlocker)}`);
      }
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          library(estimability)
          x1 <- -4:4
          x2 <- c(-2, 1, -1, 2, 0, 2, -1, 1, -2)
          x3 <- 3 * x1 - 2 * x2
          x4 <- x2 - x1 + 4
          y <- 1 + x1 + x2 + x3 + x4 + c(-.5, .5, .5, -.5, 0, .5, -.5, -.5, .5)
          fit <- lm(y ~ x1 + x2 + x3 + x4)
          testset <- data.frame(
            x1 = c(3, 6, 6, 0, 0, 1),
            x2 = c(1, 2, 2, 0, 0, 2),
            x3 = c(7, 14, 14, 0, 0, 3),
            x4 = c(2, 4, 0, 4, 0, 4)
          )
          basis <- nonest.basis(fit)
          design <- model.matrix(delete.response(terms(fit)), testset)
          prediction <- epredict(fit, newdata = testset)
          updated <- eupdate(fit, . ~ . - x2, subset = -c(3, 7))
          c(
            dim(basis),
            is.estble(design, basis),
            is.na(prediction),
            round(unname(prediction[c(1, 3, 4)]), 12),
            updated$rank,
            dim(updated$nonest)
          )
        `),
      ).resolves.toEqual([5, 2, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 14, 23, 5, 3, 4, 1]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public formatR 1.14 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["formatR", "testit"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "formatR",
      );
      expect(artifact).toMatchObject({
        package: { name: "formatR", version: "1.14" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "f73828da43c168463c260077a6025a9c11051b7c4c1e6786b9c75f544fc00065",
        },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
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
        runtime.eval(
          `library(formatR); tidy_source(text = c('a<-1+1;a', 'matrix(rnorm(10),5)'), output = FALSE)$text.tidy`,
        ),
      ).resolves.toEqual(["a <- 1 + 1", "a", "matrix(rnorm(10), 5)"]);
      await expect(
        runtime.eval(
          `formatR::tidy_source(text = "function(fn,idx,raw) { { class(fn) <- NULL; print(fn) } }", indent = 2, output = FALSE)$text.tidy`,
        ),
      ).resolves.toBe(
        "function(fn, idx, raw) {\n  {\n    class(fn) <- NULL\n    print(fn)\n  }\n}",
      );
      await expect(
        runtime.evalDetailed(
          `formatR::usage(barplot.default, width = 30, output = FALSE, fail = "none")`,
        ),
      ).resolves.toMatchObject({ visible: false });
      await expect(
        runtime.evalDetailed(
          `formatR::usage(barplot.default, width = 30, output = TRUE, fail = "none")`,
        ),
      ).resolves.toMatchObject({ visible: false });
      await expect(
        runtime.eval(
          `captured <- capture.output(formatR::usage(barplot.default, width = 30, output = TRUE, fail = "none")); c(length(captured), nchar(tail(captured, 1)))`,
        ),
      ).resolves.toEqual([26, 27]);
      await expect(
        runtime.eval(`
          formatted <- tidy_source(
            text = c(
              "score<-function(x,y=1){z<-mean(x,na.rm=TRUE);z+y}",
              "fit<-lm(y~x1+x2+x3,data=df)"
            ),
            output = FALSE
          )$text.tidy
          target <- function(alpha = 1, beta = FALSE, gamma = "x", ...) NULL
          c(formatted, usage(target, width = 40, output = FALSE, fail = "stop"))
        `),
      ).resolves.toEqual([
        "score <- function(x, y = 1) {\n    z <- mean(x, na.rm = TRUE)\n    z + y\n}",
        "fit <- lm(y ~ x1 + x2 + x3, data = df)",
        'target(alpha = 1, beta = FALSE,\n    gamma = "x", ...)',
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).not.toContainEqual(
        expect.objectContaining({ status: "failed" }),
      );
      expect(packageCheck.steps.filter((step) => step.kind === "tests")).not.toContainEqual(
        expect.objectContaining({ status: "failed" }),
      );
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public lambda.r 1.2.4 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["lambda.r", "formatR", "testit"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "lambda.r",
      );
      expect(artifact).toMatchObject({
        package: { name: "lambda.r", version: "1.2.4" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "2279897b33dbfa3574cf3afbfc39a71c496c38b2e2fac81d8cf3a151e0ddf63b",
        },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck.firstBlocker)).toBe(true);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).not.toContainEqual(
        expect.objectContaining({ status: "failed" }),
      );
      expect(packageCheck.steps.filter((step) => step.kind === "tests")).not.toContainEqual(
        expect.objectContaining({ status: "failed" }),
      );
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          library(lambda.r)
          combine(x, ..., scale = 1) %as% { scale * sum(x, ...) }
          classify(x) %when% { x > 0 } %as% { "positive" }
          classify(x) %as% { "other" }
          seal(combine)
          seal(classify)
          list(combine(c(1, 2), 3, 4, scale = 2), classify(5), classify(-1))
        `),
      ).resolves.toEqual([20, "positive", "other"]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public SQUAREM 2026.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["SQUAREM", "setRNG"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "SQUAREM",
      );
      expect(artifact).toMatchObject({
        package: { name: "SQUAREM", version: "2026.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "1f257cbdf4ac16d1dabfb9415e795819c5387819f413798a0a73c435c5d61b29",
        },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          library(SQUAREM)
          mapping <- function(p, target) 0.5 * p + 0.5 * target
          objective <- function(p, target) sum((p - target)^2)
          fit <- squarem(
            par = c(0, 3),
            fixptfn = mapping,
            objfn = objective,
            target = c(2, -1),
            control = list(tol = 1e-10)
          )
          c(
            round(fit$par, 12), fit$value.objfn, fit$convergence,
            fit$fpeval, fit$objfeval, class(fit)
          )
        `),
      ).resolves.toEqual(["2", "-1", "0", "TRUE", "6", "3", "list"]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public snow 0.4-4 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["snow"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "snow");
      expect(artifact).toMatchObject({
        package: { name: "snow", version: "0.4-4" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "560935e2d2c75f3374443e3ebea1b17f7de766778c4611c3f40db3fc47f2f22b",
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          library(snow)
          sendData.MEMnode <- function(node, data) {
            node$message <- data
            invisible(NULL)
          }
          recvData.MEMnode <- function(node) {
            request <- node$message
            success <- TRUE
            value <- tryCatch(
              do.call(request$data$fun, request$data$args),
              error = function(condition) {
                success <<- FALSE
                structure(
                  conditionMessage(condition),
                  class = c("snow-try-error", "try-error")
                )
              }
            )
            list(
              type = "VALUE",
              value = value,
              success = success,
              time = structure(
                rep(0, 5L),
                names = c("user.self", "sys.self", "elapsed", "user.child", "sys.child"),
                class = "proc_time"
              ),
              tag = request$data$tag
            )
          }
          make_memory_cluster <- function(size) {
            nodes <- lapply(seq_len(size), function(index) {
              node <- new.env(parent = emptyenv())
              class(node) <- "MEMnode"
              node
            })
            structure(nodes, class = c("MEMcluster", "cluster"))
          }
          cluster <- make_memory_cluster(3L)
          c(
            unlist(clusterApply(cluster, 1:7, function(x, offset) x + offset, offset = 10L)),
            unlist(clusterCall(cluster, function(value) value * 2L, 4L)),
            vapply(splitIndices(10L, 3L), paste, "", collapse = "-"),
            vapply(splitList(letters[1:7], 3L), paste, "", collapse = "-"),
            vapply(splitRows(matrix(1:12, nrow = 3L), 2L), nrow, 0L),
            vapply(splitCols(matrix(1:12, nrow = 3L), 3L), ncol, 0L),
            inherits(
              try(
                clusterApply(
                  cluster,
                  c(1L, -1L),
                  function(x) if (x < 0L) stop("negative") else x
                ),
                silent = TRUE
              ),
              "try-error"
            )
          )
        `),
      ).resolves.toEqual([
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "8",
        "8",
        "8",
        "1-2-3",
        "4-5-6-7",
        "8-9-10",
        "a-b",
        "c-d-e",
        "f-g",
        "1",
        "2",
        "1",
        "2",
        "1",
        "TRUE",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public futile.options 1.0.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["futile.options"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "futile.options",
      );
      expect(artifact).toMatchObject({
        package: { name: "futile.options", version: "1.0.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "f6634f1724960119dd4f582dd0093e38bd7d4d38582f3cc3920843cc2d0c376a",
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          library(futile.options)
          profile.options <- OptionsManager(
            "profile.options",
            defaults = list(alpha = 1L, beta = "x", enabled = TRUE)
          )
          initial <- profile.options()
          selected.list <- profile.options("alpha", "beta", simplify = FALSE)
          selected.vector <- profile.options("alpha", "beta", simplify = TRUE)
          setter <- withVisible(profile.options(alpha = 2L, extra = "new"))
          after.setter <- profile.options()
          updater <- withVisible(updateOptions("profile.options", "beta", "y"))
          after.update <- profile.options()
          resetter <- withVisible(resetOptions(profile.options, alpha = 9L, enabled = FALSE))
          after.reset <- profile.options()
          c(
            initial$alpha, initial$beta, initial$enabled,
            unlist(selected.list), selected.vector,
            is.null(setter$value), !setter$visible,
            after.setter$alpha, after.setter$beta, after.setter$enabled, after.setter$extra,
            is.null(updater$value), !updater$visible,
            after.update$alpha, after.update$beta, after.update$enabled, after.update$extra,
            is.null(resetter$value), !resetter$visible,
            is.na(after.reset[1L]), after.reset[["alpha"]], after.reset[["enabled"]],
            is.null(profile.options("not-there"))
          )
        `),
      ).resolves.toEqual([
        "1",
        "x",
        "TRUE",
        "1",
        "x",
        "1",
        "x",
        "TRUE",
        "TRUE",
        "2",
        "x",
        "TRUE",
        "new",
        "TRUE",
        "TRUE",
        "2",
        "y",
        "TRUE",
        "new",
        "TRUE",
        "TRUE",
        "TRUE",
        "9",
        "0",
        "TRUE",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public futile.logger 1.4.9 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["futile.logger", "testit"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "futile.logger",
      );
      expect(artifact).toMatchObject({
        package: { name: "futile.logger", version: "1.4.9" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          library(futile.logger)
          flog.threshold(ERROR)
          before <- flog.threshold()
          flog.threshold(DEBUG, name = "profile.child")
          child <- flog.threshold(name = "profile.child")
          flog.carp(TRUE, name = "profile.child")
          carp <- flog.carp(name = "profile.child")
          flog.remove("profile.child")
          fallback <- flog.threshold(name = "profile.child")
          c(before, child, carp, fallback)
        `),
      ).resolves.toEqual(["ERROR", "DEBUG", "TRUE", "ERROR"]);
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "d021ece3671228382bd30cb9cb08392c2ca08794aa9f3d5e8c817f128f724bbc",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public tinytest 1.4.3 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["tinytest"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "tinytest",
      );
      expect(artifact).toMatchObject({
        package: { name: "tinytest", version: "1.4.3" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "9ec3cb4437f8d96b05e8b69d092b20bbd23758ab653eaf99940387f09d43e0a2",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public permute 0.9-10 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["permute"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "permute",
      );
      expect(artifact).toMatchObject({
        package: { name: "permute", version: "0.9-10" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
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
        runtime.eval(`
          library("permute", character.only = TRUE)
          within <- Within(type = "grid", mirror = FALSE, constant = TRUE, nrow = 3, ncol = 2)
          plots <- Plots(strata = gl(2, 6))
          c(
            tryCatch({ getCall(within); "getCall-within" }, error = conditionMessage),
            tryCatch({ getCall(plots); "getCall-plots" }, error = conditionMessage),
            tryCatch({ ctrl <- how(within = within, plots = plots); "how" }, error = conditionMessage),
            tryCatch({ update(ctrl, observed = TRUE); "update-observed" }, error = conditionMessage),
            tryCatch({ updatedWithin <- update(getWithin(ctrl), mirror = TRUE); "update-within" }, error = conditionMessage),
            tryCatch({ update(ctrl, within = updatedWithin); "update-with-updated-within" }, error = conditionMessage),
            tryCatch({ update(ctrl, within = update(getWithin(ctrl), mirror = TRUE)); "update-nested" }, error = conditionMessage)
          )
        `),
      ).resolves.toEqual([
        "getCall-within",
        "getCall-plots",
        "how",
        "update-observed",
        "update-within",
        "update-with-updated-within",
        "update-nested",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "a24290e5e4172d2fb193a4fb41d6cfdd48a852823447bd0a52af0f752191191d",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public bigD 0.3.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["bigD"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "bigD");
      expect(artifact).toMatchObject({
        package: { name: "bigD", version: "0.3.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000 },
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
        runtime.eval(`
          library("bigD", character.only = TRUE)
          pointer <- attr(get("tz_name_resolution", asNamespace("bigD")), "problems")
          c(
            fdt("2018-07-04T22:05:09Z", format = "yyyy-MM-dd HH:mm:ss XXX", locale = "en"),
            fdt("2018-07-04T22:05:09Z", format = "EEEE, MMMM d, y", locale = "en"),
            fdt("2018-07-04T22:05:09Z", format = "EEEE d MMMM y", locale = "fr"),
            unname(first_day_of_week()[c("US", "FR", "DE")]),
            names_months()[c(1, 7, 12)], names_wkdays()[c(1, 7)],
            length(fdt_locales_vec()), typeof(pointer), length(pointer), class(pointer)
          )
        `),
      ).resolves.toEqual([
        "2018-07-04 22:05:09 Z",
        "Wednesday, July 4, 2018",
        "mercredi 4 juillet 2018",
        "sun",
        "mon",
        "mon",
        "jan",
        "jul",
        "dec",
        "sun",
        "sat",
        "574",
        "externalptr",
        "1",
        "externalptr",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "e0d2dbed46a7a681989507648a07a1069951970c594a3bfdf4a95f7b42553cda",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public pracma 2.4.6 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["pracma"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "pracma");
      expect(artifact).toMatchObject({
        package: { name: "pracma", version: "2.4.6" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000, maxAllocatedElements: 500_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          library("pracma")
          iterative <- gmres(matrix(c(4, 1, 1, 3), 2), c(1, 2))
          gamma.parts <- gammainc(2, 2)
          histogram <- histc(c(-1, 0, .5, 1, 2), c(0, 1, 2))
          rotation <- expm(matrix(c(0, -1, 1, 0), 2))
          c(
            round(iterative$x, 12), iterative$niter,
            max(abs(matrix(c(4, 1, 1, 3), 2) %*% iterative$x - c(1, 2))) < 1e-12,
            round(gamma.parts, 12), names(gamma.parts),
            histogram$cnt, histogram$bin,
            round(rotation, 7), dim(rotation)
          )
        `),
      ).resolves.toEqual([
        "0.090909090909",
        "0.636363636364",
        "2",
        "TRUE",
        "0.59399415029",
        "0.40600584971",
        "0.59399415029",
        "lowinc",
        "uppinc",
        "reginc",
        "2",
        "1",
        "1",
        "0",
        "1",
        "1",
        "2",
        "3",
        "0.5403023",
        "-0.841471",
        "0.841471",
        "0.5403023",
        "2",
        "2",
      ]);
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "f11a2d3b9f5ccb9dd0afa01fe183f12fa736f5b12b9fd818b20166486b1bef79",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind checks the unchanged public boot 1.3-32 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["boot"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find((candidate) => candidate.package.name === "boot");
      expect(artifact).toMatchObject({
        package: { name: "boot", version: "1.3-32" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 50_000_000, maxAllocatedElements: 500_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          cl <- parallel::makeCluster(2)
          parallel::setDefaultCluster(cl)
          fit <- optimParallel::optimParallel(
            c(a = 4, b = -3),
            function(par, target) sum((par - target) ^ 2),
            gr = function(par, target) 2 * (par - target),
            target = c(1, 2), lower = c(0, -1), upper = c(2, 4)
          )
          parallel::setDefaultCluster(NULL)
          parallel::stopCluster(cl)
          c(round(fit$par, 10), round(fit$value, 10), fit$convergence)
        `),
      ).resolves.toEqual([1, 2, 0, 0]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public DEoptimR 1.2-0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["DEoptimR"], {
        pack: { includeTests: true },
      });
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "DEoptimR",
      );
      expect(artifact).toMatchObject({
        package: { name: "DEoptimR", version: "1.2-0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
      });
      expect(artifact?.integrity).toEqual({
        algorithm: "sha256",
        value: "b5c9a2bda1a2b7fff85f6483c219dade876c5d639db01df94eb53d74865a2591",
      });
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        // The unchanged SPJDEoptim retained test intentionally performs two full stochastic
        // optimization runs. Keep this source-blind evidence finite without weakening defaults.
        limits: { maxSteps: 100_000_000, maxAllocatedElements: 500_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          set.seed(31415)
          fit <- JDEoptim(
            c(-4, -4), c(4, 4),
            function(x) (x[1] - 1.25)^2 + (x[2] + 0.75)^2,
            NP = 20, maxiter = 80, tol = 1e-10
          )
          c(
            as.character(round(c(fit$par, fit$value), 12)),
            as.character(fit$iter), as.character(fit$convergence), names(fit), class(fit)
          )
        `),
      ).resolves.toEqual([
        "1.250001378513",
        "-0.750000260444",
        "2e-12",
        "44",
        "0",
        "par",
        "value",
        "iter",
        "convergence",
        "list",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  600_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public multcompView 0.1-12 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["multcompView"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "multcompView",
    );
    expect(artifact).toMatchObject({
      package: { name: "multcompView", version: "0.1-12" },
      compatibility: { packaging: "ready", execution: "unchecked" },
    });
    try {
      try {
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
      } catch (error) {
        throw new Error(
          `multcompView artifact ${artifact?.integrity.value ?? "missing"} initialization blocker: ${String(error)}`,
          { cause: error },
        );
      }
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        let diagnostic = "";
        if (packageCheck.firstBlocker?.id.startsWith("example:")) {
          const exampleResource = artifact?.bundle.resources.find(
            (resource) => resource.path === ".nativr/examples-v1.json",
          );
          const examples = JSON.parse(
            Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
          ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
          const topic = examples.topics.find(
            (candidate) => `example:${candidate.name}` === packageCheck.firstBlocker?.id,
          );
          const source = topic?.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          if (source !== undefined) {
            try {
              await runtime.reset();
              await runtime.eval('library("multcompView")');
              await runtime.eval(`
                local({
                  .nativr_example_exprs <- parse(text = ${JSON.stringify(source)})
                  for (.nativr_example_i in seq_along(.nativr_example_exprs)) {
                    tryCatch(
                      eval(.nativr_example_exprs[[.nativr_example_i]], envir = .GlobalEnv),
                      error = function(e) stop(paste0(
                        "top-level expression ", .nativr_example_i, ": ", conditionMessage(e)
                      ))
                    )
                  }
                })
              `);
            } catch (error) {
              diagnostic = `; diagnostic replay: ${String(error)}`;
            }
          }
        }
        throw new Error(
          `multcompView artifact ${artifact?.integrity.value ?? "missing"} first blocker: ${JSON.stringify(packageCheck.firstBlocker)}${diagnostic}`,
        );
      }
      expect(
        packageCheck.steps.some((step) => step.kind === "examples" && step.status === "passed"),
      ).toBe(true);
      expect(
        packageCheck.steps.every(
          (step) => step.status === "passed" || step.status === "not-applicable",
        ),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          p <- c("a-b" = 0.01, "a-c" = 0.2, "b-c" = 0.03)
          letters <- multcompLetters(p)
          display <- multcompTs(p)
          c(
            class(letters), unname(letters$Letters), names(letters$Letters),
            class(display), dim(display), rownames(display), colnames(display),
            as.character(display)
          )
        `),
      ).resolves.toEqual([
        "multcompLetters",
        "a",
        "b",
        "a",
        "a",
        "b",
        "c",
        "multcompTs",
        "3",
        "2",
        "a",
        "b",
        "c",
        "a.c",
        "b",
        "1",
        "-1",
        "1",
        "-1",
        "1",
        "-1",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public plotrix 3.8-14 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["plotrix"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "plotrix");
    expect(artifact).toMatchObject({
      package: { name: "plotrix", version: "3.8-14" },
      compatibility: { packaging: "ready", execution: "unchecked" },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        const examplesResource = artifact!.bundle.resources.find(
          (resource) => resource.path === ".nativr/examples-v1.json",
        );
        const examples = JSON.parse(
          Buffer.from(examplesResource?.data ?? "", "base64").toString("utf8"),
        ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
        const topicName = packageCheck.firstBlocker?.id.replace(/^example:/u, "");
        const source = examples.topics
          .find((topic) => topic.name === topicName)
          ?.blocks.filter((block) => block.kind === "run")
          .map((block) => block.source)
          .join("\n");
        const relatedResources = artifact!.bundle.resources
          .filter((resource) => /abline|\/R\//iu.test(resource.path))
          .map((resource) => resource.path);
        throw new Error(
          `plotrix artifact ${artifact!.integrity.value} first blocker: ${JSON.stringify(packageCheck.firstBlocker)}\n${source ?? ""}\nresources: ${JSON.stringify(relatedResources)}`,
        );
      }
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public scatterplot3d 0.3-45 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["scatterplot3d"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "scatterplot3d",
    );
    expect(artifact).toMatchObject({
      package: { name: "scatterplot3d", version: "0.3-45" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "61c69a67ab1f2d24456c0d352b0ba62adeb12c8abeb30ec259d9b1cea34d915d",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        const examplesResource = artifact!.bundle.resources.find(
          (resource) => resource.path === ".nativr/examples-v1.json",
        );
        const examples = JSON.parse(
          Buffer.from(examplesResource?.data ?? "", "base64").toString("utf8"),
        ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
        const topicName = packageCheck.firstBlocker?.id.replace(/^example:/u, "");
        const source = examples.topics
          .find((topic) => topic.name === topicName)
          ?.blocks.filter((block) => block.kind === "run")
          .map((block) => block.source)
          .join("\n");
        throw new Error(
          `scatterplot3d artifact ${artifact!.integrity.value} first blocker: ${JSON.stringify(packageCheck.firstBlocker)}\n${source ?? ""}`,
        );
      }
      expect(
        packageCheck.steps.every(
          (step) => step.status === "passed" || step.status === "not-applicable",
        ),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public xmlparsedata 1.0.5 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["xmlparsedata"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "xmlparsedata",
    );
    expect(artifact).toMatchObject({
      package: { name: "xmlparsedata", version: "1.0.5" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "db99c63faf1c13cbf36d7d48228f637e71fb8f8c1b0e090134456f8b46ff0c75",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        const examplesResource = artifact!.bundle.resources.find(
          (resource) => resource.path === ".nativr/examples-v1.json",
        );
        const examples = JSON.parse(
          Buffer.from(examplesResource?.data ?? "", "base64").toString("utf8"),
        ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
        const topicName = packageCheck.firstBlocker?.id.replace(/^example:/u, "");
        const source = examples.topics
          .find((topic) => topic.name === topicName)
          ?.blocks.filter((block) => block.kind === "run")
          .map((block) => block.source)
          .join("\n");
        throw new Error(
          `xmlparsedata artifact ${artifact!.integrity.value} first blocker: ${JSON.stringify(packageCheck.firstBlocker)}\n${source ?? ""}`,
        );
      }
      expect(
        packageCheck.steps.every(
          (step) => step.status === "passed" || step.status === "not-applicable",
        ),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      await expect(
        runtime.eval(`
          pd <- data.frame(
            line1 = c(1L, 1L, 1L), col1 = c(1L, 3L, 5L),
            line2 = c(1L, 1L, 1L), col2 = c(1L, 3L, 5L),
            id = 1:3, parent = c(0L, 0L, 0L),
            token = c("SYMBOL", "SPECIAL", "STR_CONST"), terminal = TRUE,
            text = c("a&b", "%%", "<x>"), stringsAsFactors = FALSE
          )
          c(
            xmlparsedata::xml_parse_data(pd, pretty = TRUE),
            unname(xmlparsedata::xml_parse_token_map[1:2])
          )
        `),
      ).resolves.toEqual([
        '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<exprlist>\n  <SYMBOL line1="1" col1="1" line2="1" col2="1" start="7" end="7">a&amp;b</SYMBOL>\n  <SPECIAL line1="1" col1="3" line2="1" col2="3" start="9" end="9">%%</SPECIAL>\n  <STR_CONST line1="1" col1="5" line2="1" col2="5" start="11" end="11">&lt;x&gt;</STR_CONST>\n</exprlist>\n',
        "OP-QUESTION",
        "OP-TILDE",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public mitools 2.4 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["mitools"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "mitools");
    expect(artifact).toMatchObject({
      package: { name: "mitools", version: "2.4" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "73ad17952b11912b871aea7e35c13643fe3da05a9801e90aa2e0bd847c053c03",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library(mitools)
          synthetic <- imputationList(list(
            data.frame(x = c(1, 2, 3)),
            data.frame(x = c(2, 3, 4))
          ))
          summaries <- with(synthetic, c(mean = mean(x), variance = var(x)))
          c(
            class(synthetic), length(synthetic$imputations),
            unname(unlist(summaries))
          )
        `),
      ).resolves.toEqual(["imputationList", "2", "2", "1", "3", "1"]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      if (!packageCheck.passed) {
        const examplesResource = artifact!.bundle.resources.find(
          (resource) => resource.path === ".nativr/examples-v1.json",
        );
        const examples = JSON.parse(
          Buffer.from(examplesResource?.data ?? "", "base64").toString("utf8"),
        ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
        const topicName = packageCheck.firstBlocker?.id.replace(/^example:/u, "");
        const source = examples.topics
          .find((topic) => topic.name === topicName)
          ?.blocks.filter((block) => block.kind === "run")
          .map((block) => block.source)
          .join("\n");
        throw new Error(
          `mitools artifact ${artifact!.integrity.value} first blocker: ${JSON.stringify(packageCheck.firstBlocker)}\n${source ?? ""}`,
        );
      }
      expect(
        packageCheck.steps.every(
          (step) => step.status === "passed" || step.status === "not-applicable",
        ),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public logger 0.4.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["logger"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "logger");
    expect(artifact).toMatchObject({
      package: { name: "logger", version: "0.4.2" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "10f3bdd5ba1597d7e832df231ebee37bdd3dbbdb1f15ba55ca97c196b6b46b8b",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          mine <- evalq(
            function(value) assignInMyNamespace("shiny_input_values", value),
            asNamespace("logger")
          )
          first <- withVisible(mine(list(my = 1L)))
          explicit <- evalq(
            function(x, value, ns) assignInNamespace(x, value, ns = ns),
            asNamespace("logger")
          )
          second <- withVisible(explicit(
            "shiny_input_values", list(explicit = 2L), ns = "logger"
          ))
          c(
            first$visible, is.null(first$value),
            second$visible, is.null(second$value),
            getFromNamespace("shiny_input_values", "logger")$explicit
          )
        `),
      ).resolves.toEqual([0, 1, 0, 1, 2]);
      await expect(
        runtime.eval(`
          library(logger)
          store <- new.env()
          store[["captured"]] <- character()
          log_threshold(INFO)
          log_formatter(formatter_sprintf)
          log_layout(function(level, msg, ...) paste(level, msg, sep = ":"))
          log_appender(function(lines) {
            store[["captured"]] <- c(store[["captured"]], lines)
          })
          log_info("value=%d", 7L)
          store[["captured"]]
        `),
      ).resolves.toBe("400:value=7");
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(false);
      expect(packageCheck.firstBlocker).toEqual({
        id: "example:appender_file",
        kind: "examples",
        status: "failed",
        message: "'sprintf' must be a character vector.",
      });
      const blockerIndex = packageCheck.steps.findIndex(
        (step) => step.id === packageCheck.firstBlocker?.id,
      );
      expect(blockerIndex).toBeGreaterThanOrEqual(0);
      expect(
        packageCheck.steps
          .slice(0, blockerIndex)
          .every((step) => step.status === "passed" || step.status === "not-applicable"),
      ).toBe(true);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public gridGraphics 0.5-1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["gridGraphics"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "gridGraphics",
    );
    expect(artifact).toMatchObject({
      package: { name: "gridGraphics", version: "0.5-1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "74079d0602a9ff7d52ce7e2f954df44fc45317d2da2323ede8ae4bb25b130f88",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          p <- grDevices:::.axisPars(c(0, .5), TRUE)
          c(
            grDevices::axisTicks(c(-3.2, 8.7), FALSE),
            grDevices::axisTicks(c(1, 3), TRUE),
            p$axp, p$n
          )
        `),
      ).resolves.toEqual([-2, 0, 2, 4, 6, 8, 10, 20, 50, 100, 200, 500, 1000, 1, 3, -4]);
      await expect(
        runtime.eval(`
          lines <- grDevices::contourLines(
            z = matrix(c(0, 1, 1, 2), 2, 2),
            levels = c(.5, 1.5)
          )
          c(
            lines[[1]]$level, lines[[1]]$x, lines[[1]]$y,
            lines[[2]]$level, lines[[2]]$x, lines[[2]]$y
          )
        `),
      ).resolves.toEqual([0.5, 0.5, 0, 0, 0.5, 1.5, 1, 0.5, 0.5, 1]);
      await expect(
        runtime.eval(`
          c(
            requireNamespace("gridGraphics", quietly = TRUE),
            is.function(getS3method("makeContent", "echogrob", optional = TRUE)),
            "grid.echo" %in% getNamespaceExports("gridGraphics")
          )
        `),
      ).resolves.toEqual([true, true, true]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(false);
      expect(packageCheck.firstBlocker).toEqual({
        id: "test:demo-graphics.R",
        kind: "tests",
        status: "failed",
        message: "expression 27: Object 'quakes' not found.",
      });
      const blockerIndex = packageCheck.steps.findIndex(
        (step) => step.id === packageCheck.firstBlocker?.id,
      );
      expect(blockerIndex).toBeGreaterThanOrEqual(0);
      expect(
        packageCheck.steps
          .slice(0, blockerIndex)
          .every((step) => step.status === "passed" || step.status === "not-applicable"),
      ).toBe(true);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public modeltools 0.2-24 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["modeltools"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "modeltools",
    );
    expect(artifact).toMatchObject({
      package: { name: "modeltools", version: "0.2-24" },
      compatibility: {
        packaging: "ready",
        execution: "unchecked",
        issues: [{ code: "NRPKG1015", severity: "warning", path: "cleanup" }],
      },
      integrity: {
        algorithm: "sha256",
        value: "85d0ba34fcfbee7522ec1429328b44fc04db6d78fc70b9bc8d4432265353c7e6",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library(modeltools)
          capabilities <- new("StatModelCapabilities")
          matrixEnvironment <- ModelEnvMatrix(
            designMatrix = matrix(1:6, nrow = 3),
            responseMatrix = matrix(7:9, nrow = 3)
          )
          c(
            capabilities@weights,
            capabilities@subset,
            dim(matrixEnvironment@get("designMatrix")),
            requireNamespace("stats4", quietly = TRUE)
          )
        `),
      ).resolves.toEqual([1, 1, 3, 2, 1]);
      await expect(
        runtime.eval(`
        d <- data.frame(x = c(NA, 2, 3), y = c(4, 5, 6), z = c(7, 8, 9))
        a <- linearModel@dpp(y ~ x + z - 1, data = d, na.action = na.pass)
        cc <- modeltools:::complete.cases.ModelEnv(a)
        b <- na.omit(a)
        c(
          which(!cc), length(cc),
          unlist(lapply(ls(a@env), function(name) nrow(a@get(name)))),
          unlist(lapply(ls(b@env), function(name) nrow(b@get(name)))),
          unlist(lapply(ls(a@env), function(name) ncol(a@get(name)))),
          unlist(lapply(ls(b@env), function(name) ncol(b@get(name)))),
          identical(a@env, b@env), inherits(b, "ModelEnvFormula")
        )
      `),
      ).resolves.toEqual([1, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 1, 1, 0, 1]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public ellipse 0.5.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["ellipse"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "ellipse");
    expect(artifact).toMatchObject({
      package: { name: "ellipse", version: "0.5.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "8fcc404e3ba8f979cfd07d56df58b3ff5be2b8e878869f9605a0e19abeb5d79d",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          c(
            requireNamespace("ellipse", quietly = TRUE),
            as.character(packageVersion("ellipse")),
            length(getNamespaceExports("ellipse"))
          )
        `),
      ).resolves.toEqual(["TRUE", "0.5.0", "4"]);
      await expect(
        runtime.eval(`
          m <- matrix(c(4, 1, 1, 9), 2,
            dimnames = list(c("u", "v"), c("u", "v")))
          e <- ellipse::ellipse(m, centre = c(2, -1), level = .9, npoints = 5)
          expected <- c(
            5.278017251425, -0.770430227115, -1.278017251425,
            4.770430227115, 5.278017251425, 3.917025877137,
            3.155645340673, -5.917025877137, -5.155645340673,
            3.917025877137
          )
          c(max(abs(as.vector(e) - expected)) < 1e-10, dim(e))
        `),
      ).resolves.toEqual([1, 5, 2]);
      await expect(runtime.eval("colnames(e)")).resolves.toEqual(["u", "v"]);
      await expect(
        runtime.eval(`
          ar.fit <- stats::arima0(datasets::USAccDeaths, order = c(0, 1, 1),
            seasonal = list(order = c(0, 1, 1)))
          ar.ellipse <- ellipse::ellipse(ar.fit)
          nls.fit <- stats::nls(rate ~ Vm * conc / (K + conc), data = datasets::Puromycin,
            subset = state == "treated", start = list(K = .05, Vm = 200))
          nls.ellipse <- ellipse::ellipse(nls.fit, which = c("Vm", "K"))
          nls.profile <- stats::profile(nls.fit)
          profile.ellipse <- ellipse::ellipse(nls.profile, which = c("Vm", "K"))
          c(
            dim(ar.ellipse), dim(nls.ellipse), dim(profile.ellipse),
            all(is.finite(ar.ellipse)), all(is.finite(nls.ellipse)),
            all(is.finite(profile.ellipse)),
            identical(nls.fit$m$getPars(), stats::coef(nls.fit))
          )
        `),
      ).resolves.toEqual([100, 2, 100, 2, 100, 2, 1, 1, 1, 1]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(false);
      expect(packageCheck.firstBlocker).toEqual({
        id: "example:ellipse.profile.glm",
        kind: "examples",
        status: "failed",
        message: "no applicable method for 'profile'.",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public GlobalOptions 0.1.4 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["GlobalOptions"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "GlobalOptions",
    );
    expect(artifact).toMatchObject({
      package: { name: "GlobalOptions", version: "0.1.4" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "e97b6664a3dfb46d14f825511ce89088145fd1e314fd8b1dbf7f7aa55bf978d0",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("GlobalOptions", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("GlobalOptions"))')).resolves.toBe(
        "0.1.4",
      );
      await expect(
        runtime.eval(`
          opt <- GlobalOptions::set_opt(
            alpha = 1,
            beta = function() GlobalOptions::.v$alpha * 2,
            mode = list(.value = "raw", .class = "character", .filter = toupper),
            positive = list(.value = 2, .validate = function(x) x > 0,
              .failed_msg = "positive only")
          )
          initial <- opt()
          opt(alpha = 3, mode = "ready")
          changed <- opt()
          opt$alpha <- 4
          member <- c(opt$alpha, opt[["beta"]], opt[["mode"]])
          invalid <- tryCatch({ opt(positive = -1); "none" },
            error = function(e) conditionMessage(e))
          GlobalOptions::add_opt(opt, extra = 5)
          added <- opt()
          completion <- utils:::.DollarNames(opt, "^a")
          GlobalOptions::reset_opt(opt)
          reset <- opt()
          as.character(c(
            unlist(initial), unlist(changed), member,
            grepl("positive only", invalid), names(opt), unlist(added),
            completion, unlist(reset)
          ))
        `),
      ).resolves.toEqual([
        "1",
        "2",
        "raw",
        "2",
        "3",
        "6",
        "READY",
        "2",
        "4",
        "8",
        "READY",
        "TRUE",
        "alpha",
        "beta",
        "mode",
        "positive",
        "extra",
        "4",
        "8",
        "READY",
        "2",
        "5",
        "alpha",
        "1",
        "2",
        "raw",
        "2",
        "5",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.steps.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: "metadata", status: "passed" },
        { id: "namespace", status: "passed" },
        { id: "attachment", status: "passed" },
        { id: "documentation:exports", status: "passed" },
        { id: "documentation:.v", status: "passed" },
        { id: "documentation:reset_opt", status: "passed" },
        { id: "documentation:print.GlobalOptionsFun", status: "passed" },
        { id: "documentation:[.GlobalOptionsFun", status: "passed" },
        { id: "documentation:setGlobalOptions", status: "passed" },
        { id: "example:.v", status: "passed" },
        { id: "example:reset_opt", status: "passed" },
        { id: "example:print.GlobalOptionsFun", status: "passed" },
        { id: "example:[.GlobalOptionsFun", status: "passed" },
        { id: "example:setGlobalOptions", status: "passed" },
        { id: "test:test-all.R", status: "not-applicable" },
        { id: "vignette:GlobalOptions", status: "passed" },
      ]);
      expect(
        packageCheck.steps.every(
          (step) => step.status === "passed" || step.status === "not-applicable",
        ),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public rbenchmark 1.0.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["rbenchmark"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "rbenchmark",
    );
    expect(artifact).toMatchObject({
      package: { name: "rbenchmark", version: "1.0.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "8f8ebb691b4caa943423ab038a0a01a8fe2d10f2db632468cfa53d9e23373fbf",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("rbenchmark", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("rbenchmark"))')).resolves.toBe(
        "1.0.1",
      );
      await expect(
        runtime.eval(`
          measured <- rbenchmark::benchmark(
            1 + 1,
            replications = 2,
            columns = c("test", "replications"),
            order = NULL
          )
          as.character(c(nrow(measured), ncol(measured), measured$test, measured$replications))
        `),
      ).resolves.toEqual(["1", "2", "1 + 1", "2"]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.steps.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: "metadata", status: "passed" },
        { id: "namespace", status: "passed" },
        { id: "attachment", status: "passed" },
        { id: "documentation:exports", status: "passed" },
        { id: "documentation:benchmark", status: "passed" },
        { id: "documentation:rbenchmark-package", status: "passed" },
        { id: "example:benchmark", status: "passed" },
        { id: "tests", status: "not-applicable" },
        { id: "vignettes", status: "not-applicable" },
      ]);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public ca 0.71.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["ca"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "ca");
    expect(artifact).toMatchObject({
      package: { name: "ca", version: "0.71.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "2c80820bc1dce79a9bc7a485265ec5bd1d6ebe1db0b217a3439a3404cf3a7f20",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("ca"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("ca"))')).resolves.toBe("0.71.1");
      await expect(
        runtime.eval(`
          x <- matrix(
            c(10, 20, 30, 40, 15, 25), nrow = 2,
            dimnames = list(c("r1", "r2"), c("c1", "c2", "c3"))
          )
          fit <- ca::ca(x)
          c(
            class(fit), round(fit$sv, 6), is.na(fit$nd),
            fit$rownames, fit$colnames,
            round(fit$rowmass, 6), round(fit$colmass, 6),
            dim(fit$rowcoord), dim(fit$colcoord),
            round(abs(fit$rowcoord), 6), round(abs(fit$colcoord), 6),
            as.vector(fit$N)
          )
        `),
      ).resolves.toEqual([
        "ca",
        "0.078986",
        "TRUE",
        "r1",
        "r2",
        "c1",
        "c2",
        "c3",
        "0.392857",
        "0.607143",
        "0.214286",
        "0.5",
        "0.285714",
        "2",
        "1",
        "3",
        "1",
        "1.243163",
        "0.8044",
        "1.543033",
        "0.92582",
        "0.46291",
        "10",
        "20",
        "30",
        "40",
        "15",
        "25",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "documentation")).toHaveLength(20);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(10);
      expect(packageCheck.steps.find((step) => step.id === "tests")).toMatchObject({
        status: "not-applicable",
      });
      expect(packageCheck.steps.find((step) => step.id === "vignettes")).toMatchObject({
        status: "not-applicable",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public nortest 1.0-4 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["nortest"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "nortest");
    expect(artifact).toMatchObject({
      package: { name: "nortest", version: "1.0-4" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "370bd2c877f8a89bfcece5f2174c4c0b50e276baa60f9cc0432f788139b115c2",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("nortest"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("nortest"))')).resolves.toBe("1.0.4");
      await expect(runtime.eval('sort(getNamespaceExports("nortest"))')).resolves.toEqual([
        "ad.test",
        "cvm.test",
        "lillie.test",
        "pearson.test",
        "sf.test",
      ]);
      await expect(
        runtime.eval(`
          x <- c(-2.1, -1.3, -0.7, -0.2, 0.1, 0.4, 0.9, 1.1, 1.7, 2.4, NA)
          fits <- list(
            nortest::ad.test(x),
            nortest::cvm.test(x),
            nortest::lillie.test(x),
            nortest::pearson.test(x, n.classes = 4),
            nortest::sf.test(x)
          )
          c(
            vapply(fits, class, ""),
            vapply(fits, function(fit) names(fit$statistic), ""),
            round(vapply(fits, function(fit) unname(fit$statistic), 0), 12),
            round(vapply(fits, function(fit) fit$p.value, 0), 12),
            fits[[4]]$n.classes, fits[[4]]$df,
            vapply(fits, function(fit) fit$data.name, "")
          )
        `),
      ).resolves.toEqual([
        "htest",
        "htest",
        "htest",
        "htest",
        "htest",
        "A",
        "W",
        "D",
        "P",
        "W",
        "0.092232322519",
        "0.011226400811",
        "0.08734717055",
        "0.4",
        "0.996618165585",
        "0.995874444241",
        "0.998576195394",
        "1",
        "0.527089256866",
        "0.999999702051",
        "4",
        "1",
        "x",
        "x",
        "x",
        "x",
        "x",
      ]);
      await expect(runtime.eval("nortest::ad.test(1:7)")).rejects.toThrow(
        "sample size must be greater than 7",
      );
      await expect(runtime.eval("nortest::sf.test(1:4)")).rejects.toThrow(
        "sample size must be between 5 and 5000",
      );
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "documentation")).toHaveLength(6);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(5);
      expect(packageCheck.steps.find((step) => step.id === "tests")).toMatchObject({
        status: "not-applicable",
      });
      expect(packageCheck.steps.find((step) => step.id === "vignettes")).toMatchObject({
        status: "not-applicable",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public tensor 1.5.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["tensor"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "tensor");
    expect(artifact).toMatchObject({
      package: { name: "tensor", version: "1.5.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "24d419d06864b8c219275b140b98405e7512c29c643a1fa3543bffc73e01241e",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("tensor"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("tensor"))')).resolves.toBe("1.5.1");
      await expect(runtime.eval('library("tensor"); "package:tensor" %in% search()')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('sort(getNamespaceExports("tensor"))')).resolves.toEqual([
        "%*t%",
        "%t*%",
        "%t*t%",
        "tensor",
      ]);
      await expect(
        runtime.eval(`
          A <- matrix(
            1:6, 2, 3,
            dimnames = list(row = c("r1", "r2"), col = c("c1", "c2", "c3"))
          )
          B <- matrix(
            1:12, 4, 3,
            dimnames = list(item = paste0("b", 1:4), col = c("c1", "c2", "c3"))
          )
          E <- matrix(1:8, 2, 4)
          F <- matrix(1:8, 4, 2)
          contracted <- tensor::tensor(A, B, 2, 2)
          outer <- tensor::tensor(A, setNames(c(10, 20), c("x", "y")))
          scalar <- tensor::tensor(contracted, matrix(1:8, 2, 4), 1:2, 1:2)
          c(
            dim(contracted), as.vector(contracted), names(dimnames(contracted)),
            dim(outer), as.vector(outer), names(dimnames(outer)),
            scalar, is.null(dim(scalar)),
            as.vector(A %*t% B), as.vector(A %t*% E), as.vector(A %t*t% F),
            tryCatch(tensor::tensor(A, B, 1, 1:2), error = conditionMessage),
            tryCatch(tensor::tensor(A, B, 2, 1), error = conditionMessage)
          )
        `),
      ).resolves.toEqual([
        "2",
        "4",
        "61",
        "76",
        "70",
        "88",
        "79",
        "100",
        "88",
        "112",
        "row",
        "item",
        "2",
        "3",
        "2",
        "10",
        "20",
        "30",
        "40",
        "50",
        "60",
        "20",
        "40",
        "60",
        "80",
        "100",
        "120",
        "row",
        "col",
        "",
        "3282",
        "TRUE",
        "61",
        "76",
        "70",
        "88",
        "79",
        "100",
        "88",
        "112",
        "5",
        "11",
        "17",
        "11",
        "25",
        "39",
        "17",
        "39",
        "61",
        "23",
        "53",
        "83",
        "11",
        "23",
        "35",
        "14",
        "30",
        "46",
        "17",
        "37",
        "57",
        "20",
        "44",
        "68",
        '"along" vectors must be same length',
        'Mismatch in "along" dimensions',
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "documentation")).toHaveLength(2);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(1);
      expect(packageCheck.steps.find((step) => step.id === "tests")).toMatchObject({
        status: "not-applicable",
      });
      expect(packageCheck.steps.find((step) => step.id === "vignettes")).toMatchObject({
        status: "not-applicable",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public registry 0.5-1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["registry"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "registry");
    expect(artifact).toMatchObject({
      package: { name: "registry", version: "0.5-1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "7f5d9911120d97ae3946fafb6eaff51d221acd9ad987be53ee0f33a9f6059097",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("registry"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("registry"))')).resolves.toBe("0.5.1");
      await expect(
        runtime.eval('library("registry"); "package:registry" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('sort(getNamespaceExports("registry"))')).resolves.toEqual([
        "match_exact",
        "match_ignorecase",
        "match_partial",
        "match_partial_ignorecase",
        "match_regexp",
        "registry",
      ]);
      await expect(
        runtime.eval(`
          R <- registry::registry(
            registry_class = "probe_registry", entry_class = "probe_entry",
            stop_if_missing = FALSE
          )
          R$set_field(
            "key", type = "character", is_key = TRUE,
            index_FUN = registry::match_partial_ignorecase
          )
          R$set_field("value", type = "numeric", default = 1)
          R$set_field("label", type = "character", default = "default")
          R$set_entry(key = c("Alpha", "A"), value = 2, label = "first")
          R$set_entry(key = "Beta", value = 3)
          alpha <- R[["alp"]]
          before.names <- R$get_entry_names()
          before.values <- R$get_field_entries("value")
          before.frame <- summary(R)
          absent <- R[["missing"]]
          grep.names <- names(R$grep_entries("fir"))
          R$modify_entry(key = "Beta", value = 4, label = "second")
          R$seal_entries()
          sealed.error <- tryCatch(
            { R$delete_entry("Alpha"); NA_character_ }, error = conditionMessage
          )
          R$set_field("extra", default = NA)
          R$set_entry(key = "Gamma", value = 5, label = "third", extra = "new")
          R$restrict_permissions(delete_entries = FALSE)
          permission.error <- tryCatch(
            { R$delete_entry("Gamma"); NA_character_ }, error = conditionMessage
          )
          beta <- R[["bet"]]
          gamma <- R[["gam"]]
          c(
            registry::match_exact("a", c("a", "b")),
            registry::match_ignorecase("A", c("a", "b")),
            registry::match_partial("al", c("alpha", "beta")),
            registry::match_partial_ignorecase("AL", c("alpha", "beta")),
            registry::match_regexp("^b", c("alpha", "beta")),
            class(R), 2L, before.names,
            alpha$key, alpha$value, alpha$label, is.null(absent), grep.names,
            unname(before.values), dim(before.frame), names(before.frame),
            unname(unlist(before.frame)),
            beta$key, beta$value, beta$label, is.na(beta$extra),
            gamma$key, gamma$value, gamma$label, gamma$extra,
            unname(R$get_permissions()), R$get_sealed_field_names(),
            sealed.error, permission.error
          )
        `),
      ).resolves.toEqual([
        "TRUE",
        "TRUE",
        "TRUE",
        "TRUE",
        "TRUE",
        "probe_registry",
        "registry",
        "2",
        "Alpha",
        "Beta",
        "Alpha",
        "A",
        "2",
        "first",
        "TRUE",
        "Alpha",
        "2",
        "3",
        "2",
        "3",
        "key",
        "value",
        "label",
        "Alpha",
        "Beta",
        "2",
        "3",
        "first",
        "default",
        "Beta",
        "4",
        "second",
        "TRUE",
        "Gamma",
        "5",
        "third",
        "new",
        "TRUE",
        "TRUE",
        "FALSE",
        "TRUE",
        "key",
        "value",
        "label",
        "Deletion of entry not allowed.",
        "Deletion of entries not allowed.",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "documentation")).toHaveLength(4);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(3);
      expect(packageCheck.steps.filter((step) => step.kind === "tests")).toHaveLength(1);
      expect(packageCheck.steps.filter((step) => step.kind === "vignettes")).toHaveLength(1);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public corpcor 1.6.10 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["corpcor"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "corpcor");
    expect(artifact).toMatchObject({
      package: { name: "corpcor", version: "1.6.10" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "aac42dd5f974f093b902fe40e80b63a2159b99a316c2f504dbbfa78084f13aca",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("corpcor"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("corpcor"))')).resolves.toBe("1.6.10");
      await expect(
        runtime.eval('library("corpcor"); "package:corpcor" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('sort(getNamespaceExports("corpcor"))')).resolves.toEqual([
        "cor.shrink",
        "cor2pcor",
        "cov.shrink",
        "crossprod.powcor.shrink",
        "decompose.cov",
        "decompose.invcov",
        "estimate.lambda",
        "estimate.lambda.var",
        "fast.svd",
        "invcor.shrink",
        "invcov.shrink",
        "is.positive.definite",
        "make.positive.definite",
        "mpower",
        "pcor.shrink",
        "pcor2cor",
        "powcor.shrink",
        "pseudoinverse",
        "pvar.shrink",
        "rank.condition",
        "rebuild.cov",
        "rebuild.invcov",
        "sm.index",
        "sm2vec",
        "var.shrink",
        "vec2sm",
        "wt.moments",
        "wt.scale",
        "wt.var",
      ]);
      await expect(
        runtime.eval(`
          x <- matrix(
            c(1,2,4,7,11, 2,5,3,8,13, 4,1,6,10,15),
            5, 3,
            dimnames = list(paste0("r", 1:5), c("a", "b", "c"))
          )
          w <- c(1,2,3,2,2) / 10
          moments <- wt.moments(x, w)
          weighted.variance <- wt.var(x[, 1], w)
          scaled <- wt.scale(x, w)
          m <- matrix(c(4,1,2, 1,3,.5, 2,.5,5), 3, 3)
          packed <- sm2vec(m)
          packed.index <- sm.index(m)
          unpacked <- vec2sm(packed)
          covariance.parts <- decompose.cov(m)
          rebuilt <- rebuild.cov(covariance.parts$r, covariance.parts$v)
          inverse <- solve(m)
          inverse.parts <- decompose.invcov(inverse)
          rebuilt.inverse <- rebuild.invcov(inverse.parts$pr, inverse.parts$pv)
          correlation <- cov2cor(m)
          partial <- cor2pcor(correlation)
          correlation.roundtrip <- pcor2cor(partial)
          pseudo <- pseudoinverse(x)
          rank.info <- rank.condition(x)
          indefinite <- matrix(c(1,2,2,1), 2, 2)
          positive <- make.positive.definite(indefinite)
          square.root <- mpower(m, .5)
          decomposition <- fast.svd(x)
          lambda <- estimate.lambda(x, w, verbose = FALSE)
          lambda.var <- estimate.lambda.var(x, w, verbose = FALSE)
          shrunk.cor <- cor.shrink(x, lambda = .25, w = w, verbose = FALSE)
          shrunk.var <- var.shrink(x, lambda.var = .3, w = w, verbose = FALSE)
          shrunk.cov <- cov.shrink(
            x, lambda = .25, lambda.var = .3, w = w, verbose = FALSE
          )
          inverse.cor <- invcor.shrink(x, lambda = .25, w = w, verbose = FALSE)
          inverse.cov <- invcov.shrink(
            x, lambda = .25, lambda.var = .3, w = w, verbose = FALSE
          )
          partial.shrunk <- pcor.shrink(x, lambda = .25, w = w, verbose = FALSE)
          partial.var <- pvar.shrink(
            x, lambda = .25, lambda.var = .3, w = w, verbose = FALSE
          )
          powered.cor <- powcor.shrink(
            x, alpha = .5, lambda = .25, w = w, verbose = FALSE
          )
          powered.product <- crossprod.powcor.shrink(
            x, diag(3), alpha = .5, lambda = .25, w = w, verbose = FALSE
          )
          unname(round(c(
            moments$mean, moments$var, weighted.variance,
            max(abs(colSums(w * scaled))),
            max(abs(colSums(w * scaled^2) - (1 - sum(w^2)))),
            packed, as.vector(packed.index),
            max(abs(unpacked[lower.tri(unpacked)] - packed)),
            max(abs(rebuilt - m)), max(abs(rebuilt.inverse - inverse)),
            max(abs(correlation.roundtrip - correlation)),
            max(abs(x %*% pseudo %*% x - x)),
            rank.info$rank, rank.info$condition,
            is.positive.definite(m), is.positive.definite(indefinite),
            is.positive.definite(positive),
            min(eigen(positive, symmetric = TRUE, only.values = TRUE)$values),
            max(abs(square.root %*% square.root - m)),
            decomposition$d,
            max(abs(
              decomposition$u %*% diag(decomposition$d) %*% t(decomposition$v) - x
            )),
            lambda, lambda.var,
            shrunk.cor[1,2], shrunk.var[1], shrunk.cov[1,2],
            inverse.cor[1,2], inverse.cov[1,2],
            partial.shrunk[1,2], attr(partial.shrunk, "spv")[1],
            partial.var[1], powered.cor[1,2], powered.product[1,2],
            max(abs(shrunk.cor %*% inverse.cor - diag(3))),
            max(abs(shrunk.cov %*% inverse.cov - diag(3))),
            attr(shrunk.cor, "lambda"), attr(shrunk.var, "lambda.var"),
            attr(shrunk.cov, "lambda"), attr(shrunk.cov, "lambda.var")
          ), 10))
        `),
      ).resolves.toEqual([
        5.3, 6.3, 7.4, 14.8846153846, 19.2435897436, 29.2820512821, 14.8846153846, 0, 0, 1, 2, 0.5,
        1, 1, 2, 2, 3, 3, 0, 0, 0, 0, 0, 3, 22.3971932578, 1, 0, 1, 0, 0, 28.7140118957,
        3.7231578145, 1.2820361715, 0, 0.3297926421, 1, 0.6936980463, 16.1923076923, 12.2452565953,
        -1.0279369569, -0.0582329862, 0.4411211961, 0.3799838162, 6.1528148706, 0.3339786771,
        0.3339786771, 0, 0, 0.25, 0.3, 0.25, 0.3,
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "documentation")).toHaveLength(16);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(13);
      expect(packageCheck.steps.filter((step) => step.kind === "tests")).toHaveLength(1);
      expect(packageCheck.steps.filter((step) => step.kind === "vignettes")).toHaveLength(1);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public vipor 0.4.7 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["vipor"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "vipor");
    expect(artifact).toMatchObject({
      package: { name: "vipor", version: "0.4.7" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "f09ed3092919c8b6c32527ebc8b57a826125497cbd5f6317c1c65eecf2fc3f0f",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("vipor"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("vipor"))')).resolves.toBe("0.4.7");
      await expect(runtime.eval('library("vipor"); "package:vipor" %in% search()')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('sort(getNamespaceExports("vipor"))')).resolves.toEqual([
        "aveWithArgs",
        "digits2number",
        "generatePermuteString",
        "number2digits",
        "offsetSingleGroup",
        "offsetX",
        "permute",
        "topBottomDistribute",
        "tukeyPermutes",
        "tukeyT",
        "tukeyTexture",
        "vanDerCorput",
        "vpPlot",
      ]);
      await expect(
        runtime.eval(`
          set.seed(123)
          permutations <- permute(1:3)
          tukey.permutations <- tukeyPermutes(4, 2)
          permutation.string <- generatePermuteString(3, 5)
          tukey.offsets <- tukeyT(2, 5)
          texture <- tukeyTexture(c(1, 2, 3, 4, 5), jitter = FALSE)
          distributed <- topBottomDistribute(1:5)
          low.discrepancy <- vanDerCorput(5)
          digits <- number2digits(13, 2)
          number <- digits2number(digits, 2)
          averaged <- aveWithArgs(1:6, rep(1:2, 3), sum)
          single <- offsetSingleGroup(c(1, 2, 4, 8), method = "maxout", nbins = 8)
          groups <- rep(c("a", "b"), each = 2)
          offsets <- offsetX(c(1, 2, 4, 8), groups, method = "maxout", nbins = 8)
          plotted <- vpPlot(
            factor(groups), c(1, 2, 4, 8), xaxt = "n",
            offsetXArgs = list(method = "maxout", nbins = 8)
          )
          unname(c(
            length(permutations),
            identical(
              vapply(permutations, paste, collapse = "", FUN.VALUE = character(1)),
              c("123", "132", "213", "231", "312", "321")
            ),
            length(tukey.permutations), length(permutation.string),
            all(vapply(
              split(permutation.string, ceiling(seq_along(permutation.string) / 5)),
              function(value) identical(sort(value), 1:5), logical(1)
            )),
            length(tukey.offsets), all(tukey.offsets >= 1 & tukey.offsets <= 99),
            length(texture), all(texture >= 1 & texture <= 100),
            distributed, low.discrepancy, digits, number, averaged,
            length(single), all(is.finite(single)), all(abs(single) <= 1),
            length(offsets), all(is.finite(offsets)),
            max(abs(plotted - as.numeric(factor(groups)) - offsets)) < 1e-12
          ))
        `),
      ).resolves.toEqual([
        6, 1, 10, 15, 1, 10, 1, 5, 1, 0.5, 0.75, 0.25, 1, 0, 0.5, 0.25, 0.75, 0.125, 0.625, 1, 0, 1,
        1, 13, 9, 12, 9, 12, 9, 12, 4, 1, 1, 4, 1, 1,
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "documentation")).toHaveLength(16);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(13);
      expect(packageCheck.steps.filter((step) => step.kind === "tests")).toHaveLength(1);
      expect(packageCheck.steps.filter((step) => step.kind === "vignettes")).toHaveLength(2);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public dynamicTreeCut 1.63-1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["dynamicTreeCut"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "dynamicTreeCut",
    );
    expect(artifact).toMatchObject({
      package: { name: "dynamicTreeCut", version: "1.63-1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "4f6d0df429642da937f7d76730ef89201f55ddeb839b6567066100887cd42016",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("dynamicTreeCut"))')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("dynamicTreeCut"))')).resolves.toBe(
        "1.63.1",
      );
      await expect(
        runtime.eval('library("dynamicTreeCut"); "package:dynamicTreeCut" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('sort(getNamespaceExports("dynamicTreeCut"))')).resolves.toEqual([
        "cutreeDynamic",
        "cutreeDynamicTree",
        "cutreeHybrid",
        "indentSpaces",
        "merge2Clusters",
        "printFlush",
      ]);
      await runtime.eval(`
        values <- c(0, .1, .2, 5, 5.1, 5.2)
        distances <- dist(matrix(values, ncol = 1))
        dendro <- hclust(distances, method = "average")
      `);
      await expect(
        runtime.eval(
          "cutreeDynamicTree(dendro, maxTreeHeight = 1, deepSplit = FALSE, minModuleSize = 2)",
        ),
      ).resolves.toEqual([1, 1, 1, 2, 2, 2]);
      await expect(
        runtime.eval(`
          cutreeDynamic(
            dendro, cutHeight = 1, minClusterSize = 2, method = "tree",
            deepSplit = FALSE, verbose = 0
          )
        `),
      ).resolves.toEqual([1, 1, 1, 2, 2, 2]);
      await expect(
        runtime.eval(`
          hybrid <- cutreeHybrid(
            dendro, distM = as.matrix(distances), cutHeight = 1,
            minClusterSize = 2, deepSplit = 0, pamStage = FALSE, verbose = 0
          )
          as.character(c(
            unname(hybrid$labels), names(hybrid), unname(hybrid$cores),
            hybrid$smallLabels, hybrid$onBranch
          ))
        `),
      ).resolves.toEqual([
        "2",
        "2",
        "2",
        "1",
        "1",
        "1",
        "labels",
        "cores",
        "smallLabels",
        "onBranch",
        "mergeDiagnostics",
        "mergeCriteria",
        "branches",
        "2",
        "2",
        "2",
        "1",
        "1",
        "1",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
      ]);
      await expect(
        runtime.eval(`
          characters <- merge2Clusters(c("a", "b", "b", "c"), "a", "b")
          factors <- merge2Clusters(factor(c("a", "b", "b", "c")), "a", "b")
          numbers <- merge2Clusters(c(1, 2, 2, 3), 1, 2)
          printed <- capture.output(visible <- withVisible(printFlush("probe", 2)))
          as.character(c(
            characters, as.character(factors), levels(factors), class(factors), numbers,
            nchar(indentSpaces(0)), nchar(indentSpaces(3)), printed,
            is.null(visible$value), visible$visible
          ))
        `),
      ).resolves.toEqual([
        "a",
        "a",
        "a",
        "c",
        "a",
        "a",
        "a",
        "c",
        "a",
        "c",
        "factor",
        "1",
        "1",
        "1",
        "3",
        "0",
        "6",
        "probe 2",
        "TRUE",
        "FALSE",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "documentation")).toHaveLength(8);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(2);
      expect(packageCheck.steps.filter((step) => step.kind === "tests")).toHaveLength(1);
      expect(packageCheck.steps.filter((step) => step.kind === "vignettes")).toHaveLength(1);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public pixmap 0.4-14 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["pixmap"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "pixmap");
    expect(artifact).toMatchObject({
      package: { name: "pixmap", version: "0.4-14" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "6951089f6601dee90417f06ef27d06491c2159195859bb997aab310936ffa380",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("pixmap"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("pixmap"))')).resolves.toBe("0.4.14");
      await expect(runtime.eval('library("pixmap"); "package:pixmap" %in% search()')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval(`
          probe <- read.pnm(system.file("pictures/logo.ppm", package = "pixmap")[1])
          as.character(c(
            class(probe), probe@size, probe@bbox, probe@cellres, probe@bbcent,
            dim(probe@red)
          ))
        `),
      ).resolves.toEqual([
        "pixmapRGB",
        "77",
        "101",
        "0",
        "0",
        "101",
        "77",
        "1",
        "1",
        "FALSE",
        "77",
        "101",
      ]);
      await expect(
        runtime.eval(`
          grey_image <- pixmapGrey(
            matrix(c(0, 0.25, 0.5, 1), nrow = 2),
            bbox = c(10, 20, 14, 24)
          )
          rgb_image <- as(grey_image, "pixmapRGB")
          weighted <- addChannels(rgb_image, coef = c(0.5, 0.25, 0.25))
          channels <- getChannels(rgb_image, c("blue", "red", "blue"))
          indexed <- as(rgb_image, "pixmapIndexed")
          cropped <- indexed[1, 2]
          as.character(c(
            class(grey_image), class(rgb_image), class(weighted), class(indexed), class(cropped),
            grey_image@size, grey_image@cellres, grey_image@bbox,
            cropped@size, cropped@cellres, cropped@bbox,
            as.numeric(weighted@grey), dim(channels), as.numeric(channels),
            as.numeric(indexed@index), length(indexed@col), as.numeric(cropped@index)
          ))
        `),
      ).resolves.toEqual([
        "pixmapGrey",
        "pixmapRGB",
        "pixmapGrey",
        "pixmapIndexed",
        "pixmapIndexed",
        "2",
        "2",
        "2",
        "2",
        "10",
        "20",
        "14",
        "24",
        "1",
        "1",
        "2",
        "2",
        "12",
        "20",
        "14",
        "22",
        "0",
        "0.25",
        "0.5",
        "1",
        "2",
        "2",
        "2",
        "0",
        "0.25",
        "0.5",
        "1",
        "0",
        "0.25",
        "0.5",
        "1",
        "1",
        "2",
        "3",
        "4",
        "4",
        "3",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      await expect(
        runtime.eval(`
          graphics::par(
            omi = rep(0, 4), fig = c(0, 1, 0, 1), plt = c(0, 1, 0, 1),
            usr = c(0, 1, 0, 1), xlog = FALSE, ylog = FALSE
          )
          grid::grid.newpage()
          viewports <- gridBase::baseViewports()
          grid::pushViewport(grid::viewport(
            x = .25, y = .75, width = .5, height = .25,
            just = c("left", "top"),
            gp = grid::gpar(col = "red", lwd = 3, lty = "dotted")
          ))
          omi <- gridBase::gridOMI()
          fig <- gridBase::gridFIG()
          plt <- gridBase::gridPLT()
          pars <- gridBase::gridPAR()
          c(
            round(c(omi, fig, plt), 4),
            names(viewports), class(viewports$inner), attr(viewports$inner$width, "unit"),
            names(pars), unlist(pars, use.names = FALSE)
          )
        `),
      ).resolves.toEqual([
        "3.5",
        "1.75",
        "1.75",
        "1.75",
        "0.25",
        "0.75",
        "0.5",
        "0.75",
        "0.25",
        "0.75",
        "0.5",
        "0.75",
        "inner",
        "figure",
        "plot",
        "viewport",
        "col",
        "lwd",
        "lty",
        "red",
        "3",
        "dotted",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public moments 0.14.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["moments"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "moments");
    expect(artifact).toMatchObject({
      package: { name: "moments", version: "0.14.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "205770aa5cb2912fada6ef201ba7a3eab6215cd80696471e0e8c568f717a4ab6",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("moments"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("moments"))')).resolves.toBe("0.14.1");
      await expect(
        runtime.eval('library("moments"); "package:moments" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          sample_values <- c(-4, -2, -1, 0, 1, 2, 3, 7, 8, 10)
          raw_moments <- all.moments(sample_values, order.max = 5)
          central_moments <- raw2central(raw_moments)
          reconstructed <- central2raw(central_moments, raw_moments[2])
          cumulants <- all.cumulants(raw_moments)
          sample_matrix <- cbind(sample_values, sample_values + 1)
          sample_frame <- data.frame(first = sample_values, second = sample_values + 2)
          skew_test <- agostino.test(sample_values, alternative = "greater")
          kurtosis_test <- anscombe.test(sample_values, alternative = "less")
          geary_test <- bonett.test(sample_values, alternative = "greater")
          normality_test <- jarque.test(sample_values)
          round(c(
            moment(sample_values, 3, central = TRUE, absolute = TRUE),
            skewness(sample_values), kurtosis(sample_values), geary(sample_values),
            all.moments(sample_matrix, order.max = 3, central = TRUE),
            raw_moments, central_moments, reconstructed, cumulants,
            skewness(sample_matrix), kurtosis(sample_matrix), geary(sample_frame),
            skew_test$statistic, skew_test$p.value,
            kurtosis_test$statistic, kurtosis_test$p.value,
            geary_test$statistic, geary_test$p.value,
            normality_test$statistic, normality_test$p.value
          ), 9)
        `),
      ).resolves.toEqual([
        111.5408, 0.371782867, 1.928368406, 0.843362617, 1, 0, 19.04, 30.888, 1, 0, 19.04, 30.888,
        1, 2.4, 24.8, 181.8, 1686.8, 14879.4, 1, 0, 19.04, 30.888, 699.0752, 1999.63296, 1, 2.4,
        24.8, 181.8, 1686.8, 14879.4, 0, 0, 19.04, 90.408, -380.7136, -8764.34784, 0.371782867,
        0.371782867, 1.928368406, 1.928368406, 0.843362617, 0.843362617, 0.371782867, 0.661952469,
        0.745999158, 1.928368406, -0.672587768, 0.749395207, 3.68, -0.720160003, 0.235713244,
        0.708868448, 0.701570263,
      ]);
      await expect(
        runtime.eval(`
          c(
            sort(getNamespaceExports("moments")),
            class(skew_test), names(skew_test$statistic), skew_test$alternative,
            skew_test$method, skew_test$data.name,
            class(kurtosis_test), names(kurtosis_test$statistic), kurtosis_test$alternative,
            kurtosis_test$method, kurtosis_test$data.name,
            class(geary_test), names(geary_test$statistic), geary_test$alternative,
            geary_test$method, geary_test$data.name,
            class(normality_test), names(normality_test$statistic), normality_test$alternative,
            normality_test$method, normality_test$data.name
          )
        `),
      ).resolves.toEqual([
        "agostino.test",
        "all.cumulants",
        "all.moments",
        "anscombe.test",
        "bonett.test",
        "central2raw",
        "geary",
        "jarque.test",
        "kurtosis",
        "moment",
        "raw2central",
        "skewness",
        "htest",
        "skew",
        "z",
        "data have negative skewness",
        "D'Agostino skewness test",
        "sample_values",
        "htest",
        "kurt",
        "z",
        "kurtosis is greater than 3",
        "Anscombe-Glynn kurtosis test",
        "sample_values",
        "htest",
        "tau",
        "z",
        "kurtosis is lower than sqrt(2/pi)",
        "Bonett-Seier test for Geary kurtosis",
        "sample_values",
        "htest",
        "JB",
        "greater",
        "Jarque-Bera Normality Test",
        "sample_values",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.filter((step) => step.kind === "documentation")).toHaveLength(13);
      expect(packageCheck.steps.filter((step) => step.kind === "examples")).toHaveLength(12);
      expect(packageCheck.steps.find((step) => step.id === "tests")).toMatchObject({
        status: "not-applicable",
      });
      expect(packageCheck.steps.find((step) => step.id === "vignettes")).toMatchObject({
        status: "not-applicable",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public RSpincalc 1.0.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["RSpincalc"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "RSpincalc",
    );
    expect(artifact).toMatchObject({
      package: { name: "RSpincalc", version: "1.0.2" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "c4840be44806e0eb9f3f9a251945693c2b01b2e22c30d14a0496fd2c44384b20",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("RSpincalc"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("RSpincalc"))')).resolves.toBe(
        "1.0.2",
      );
      await expect(
        runtime.eval('library("RSpincalc"); "package:RSpincalc" %in% search()'),
      ).resolves.toBe(true);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      await expect(
        runtime.eval(`
          exports <- getNamespaceExports("RSpincalc")
          c(
            length(exports),
            all(c(
              "EA2Q", "Q2DCM", "DCM2Q", "Qnormalize", "%Q*%", "Qlerp",
              "vectQrot", "isPureRotationMatrix", "DCMrandom"
            ) %in% exports)
          )
        `),
      ).resolves.toEqual([45, 1]);
      await expect(
        runtime.eval(`
          c(
            RSpincalc::EA2Q(c(0, 0, 0)), RSpincalc::Qzero(), RSpincalc::Qone(),
            RSpincalc::Qnorm(c(1, 0, 0, 0)),
            RSpincalc::isPureRotationMatrix(diag(3)),
            RSpincalc::isPureRotationMatrix(array(c(diag(3), diag(3)), c(3, 3, 2)))
          )
        `),
      ).resolves.toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]);
      await expect(
        runtime.eval(`
          q1 <- RSpincalc::EA2Q(c(.1, -.2, .3))
          q2 <- RSpincalc::EA2Q(c(-.4, .25, .05))
          round(c(
            q1, q2, RSpincalc::\`%Q*%\`(q1, q2), RSpincalc::Qinv(q1),
            RSpincalc::Qlerp(q1, q2, .25),
            RSpincalc::vectQrot(q1, c(1, 2, 3))
          ), 12)
        `),
      ).resolves.toEqual([
        0.981856172866, 0.153439302024, -0.091157549343, 0.064071347706, 0.971496745266,
        0.049069267968, 0.117223889201, -0.200112070299, 0.969848214531, 0.207975779522,
        0.060386727249, -0.111776379771, 0.981856172866, -0.153439302024, 0.091157549343,
        -0.064071347706, 0.996081290155, 0.072253974958, -0.046586981884, 0.020762457089,
        1.766865109602, 2.604501406877, 2.023551359874,
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public dichromat 2.0-1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["dichromat"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "dichromat",
    );
    expect(artifact).toMatchObject({
      package: { name: "dichromat", version: "2.0-1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "18fcbd4a0a24bb5fe58029ff16c10a47c665b46e48caa807f05ee45362905353",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("dichromat"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("dichromat"))')).resolves.toBe(
        "2.0.1",
      );
      await expect(
        runtime.eval('library("dichromat"); "package:dichromat" %in% search()'),
      ).resolves.toBe(true);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      await expect(runtime.eval('sort(getNamespaceExports("dichromat"))')).resolves.toEqual([
        "colorschemes",
        "dichromat",
      ]);
      await expect(
        runtime.eval(`
          colours <- c("red", "blue", "#663000", "white", "black")
          dichromat::dichromat(colours, "deutan")
        `),
      ).resolves.toEqual(["#949405", "#2C2CFD", "#4F4F2A", "#FCFCFD", "#2C2C2C"]);
      await expect(
        runtime.eval(`
          colours <- c("red", "blue", "#663000", "white", "black")
          dichromat::dichromat(colours, "protan")
        `),
      ).resolves.toEqual(["#60601C", "#1515FF", "#3C3C16", "#FFFFFF", "#141414"]);
      await expect(
        runtime.eval(`
          colours <- c("red", "blue", "#663000", "white", "black")
          dichromat::dichromat(colours, "tritan")
        `),
      ).resolves.toEqual(["#F35B5B", "#0D7F7F", "#7E6262", "#F3F3F3", "#5B5B5B"]);
      await expect(
        runtime.eval(`
          c(
            length(dichromat::colorschemes),
            length(dichromat::colorschemes$BrowntoBlue.10),
            dichromat::colorschemes$BrowntoBlue.10[c(1, 10)]
          )
        `),
      ).resolves.toEqual(["17", "10", "#663000", "#00AACC"]);
      await expect(
        runtime.eval(`
          data(dalton, package = "dichromat")
          c(length(dalton), dalton[1:4])
        `),
      ).resolves.toEqual([3072, 255, 204, 153, 102]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public RUnit 0.4.33.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["RUnit"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "RUnit");
    expect(artifact).toMatchObject({
      package: { name: "RUnit", version: "0.4.33.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "835dd48f8ca88f320e083a446fccea847e4f9b9bfda8b88f4464f4c7935828d5",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("RUnit"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("RUnit"))')).resolves.toBe("0.4.33.1");
      await expect(runtime.eval('library("RUnit"); "package:RUnit" %in% search()')).resolves.toBe(
        true,
      );
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      await expect(runtime.eval('sort(getNamespaceExports("RUnit"))')).resolves.toEqual([
        ".setUp",
        ".tearDown",
        "DEACTIVATED",
        "checkEquals",
        "checkEqualsNumeric",
        "checkException",
        "checkIdentical",
        "checkTrue",
        "defineTestSuite",
        "getErrors",
        "inspect",
        "isValidTestSuite",
        "printHTML",
        "printHTMLProtocol",
        "printJUnitProtocol",
        "printTextProtocol",
        "runTestFile",
        "runTestSuite",
        "tracker",
      ]);
      await expect(
        runtime.eval(`
          all(c(
            RUnit::checkTrue(TRUE),
            RUnit::checkEquals(list(a = 1L), list(a = 1L)),
            RUnit::checkEqualsNumeric(c(1, 2), c(1, 2 + 1e-9)),
            RUnit::checkIdentical(1L, 1L),
            RUnit::checkException(stop("boom"), silent = TRUE)
          ))
        `),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          c(
            tryCatch(RUnit::DEACTIVATED("reason"), error = function(e) c(class(e), conditionMessage(e))),
            tryCatch(RUnit::checkTrue(FALSE, msg = "marker"), error = function(e) c(class(e), conditionMessage(e)))
          )
        `),
      ).resolves.toEqual([
        "simpleError",
        "error",
        "condition",
        "reason",
        "simpleError",
        "error",
        "condition",
        "Test not TRUE\nmarker",
      ]);
      await expect(runtime.eval("names(RUnit::tracker())")).resolves.toEqual([
        "addFunc",
        "getSource",
        "init",
        "bp",
        "getTrackInfo",
        "isValid",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public ica 1.0-3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["ica"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "ica");
    expect(artifact).toMatchObject({
      package: { name: "ica", version: "1.0-3" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "ba3440c05805fd2697ac9cd70def95d696bef9b24dd6259ceebd2fde675f8fd5",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("ica"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("ica"))')).resolves.toBe("1.0.3");
      await expect(runtime.eval('library("ica"); "package:ica" %in% search()')).resolves.toBe(true);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      await expect(runtime.eval('sort(getNamespaceExports("ica"))')).resolves.toEqual([
        "acy",
        "ica",
        "icafast",
        "icaimax",
        "icajade",
        "icaplot",
        "icasamp",
        "print.icafast",
        "print.icaimax",
        "print.icajade",
        "sdiag",
      ]);
      await expect(runtime.eval("ica::acy(diag(2), diag(2))")).resolves.toBe(0);
      await expect(
        runtime.eval(`
          fit <- ica::ica(matrix(c(-2, -1, 1, 2), ncol = 1), 1, method = "fast")
          c(
            class(fit), names(fit),
            dim(fit$S), dim(fit$M), dim(fit$W),
            round(fit$vafs, 12), fit$converged, is.na(fit$iter),
            fit$alg, fit$fun, fit$alpha
          )
        `),
      ).resolves.toEqual([
        "icafast",
        "S",
        "M",
        "W",
        "Y",
        "Q",
        "R",
        "vafs",
        "iter",
        "alg",
        "fun",
        "alpha",
        "converged",
        "4",
        "1",
        "1",
        "1",
        "1",
        "1",
        "1",
        "TRUE",
        "TRUE",
        "par",
        "logcosh",
        "1",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public proto 1.0.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["proto"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "proto");
    expect(artifact).toMatchObject({
      package: { name: "proto", version: "1.0.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "70b797c90818d74e30973e884fd769fb5b4e56208aa042543086fa70d01d0757",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("proto"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("proto"))')).resolves.toBe("1.0.0");
      await expect(runtime.eval('library("proto"); "package:proto" %in% search()')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval(`
          Root <- proto()
          Counter <- Root$proto(
            value = 1L,
            inc = function(., by = 1L) { .$value <- .$value + by; .$value },
            read = function(.) .$value
          )
          first <- Counter$inc()
          second <- Counter$inc(3L)
          Child <- Counter$proto(
            value = 10L,
            read = function(.) paste("child", .$value)
          )
          child.before <- Child$read()
          child.after <- Child$inc(2L)
          parent.after <- Counter$read()
          Counter$proto <- function(., seed) { .super$proto(., value = seed) }
          Grand <- Counter$proto(seed = 20L)
          grand.after <- Grand$inc(5L)
          clone <- as.proto(
            list(name = "copy", label = function(.) paste(.$name, .$value)),
            envir = new.env(parent = Counter),
            parent = Counter
          )
          as.character(c(
            first, second, child.before, child.after, parent.after, grand.after, clone$label(),
            is.proto(Root), is.proto(Child), identical(parent.env(Child), Counter),
            identical(parent.env(Grand), Counter), identical(parent.env(clone), Counter),
            sort(Child$ls()), sort(clone$ls()), sort(names(clone$as.list()))
          ))
        `),
      ).resolves.toEqual([
        "2",
        "5",
        "child 10",
        "12",
        "5",
        "25",
        "copy 5",
        "TRUE",
        "TRUE",
        "TRUE",
        "TRUE",
        "TRUE",
        "read",
        "value",
        "label",
        "name",
        "label",
        "name",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public NLP 0.3-3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["NLP"]);
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "NLP");
    expect(artifact).toMatchObject({
      package: { name: "NLP", version: "0.3-3" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "402e66dd96238f942c902001fb45f4c76d47f319ea8ee1f04ecc42e797f89eab",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("NLP"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("NLP"))')).resolves.toBe("0.3.3");
      await expect(runtime.eval('library("NLP"); "package:NLP" %in% search()')).resolves.toBe(true);
      await expect(
        runtime.eval(`
          text <- String("Alpha beta.")
          base <- Annotation(
            1:3,
            c("sentence", "word", "word"),
            c(1L, 1L, 7L),
            c(11L, 5L, 10L),
            list(NULL, list(kind = "noun"), NULL)
          )
          update <- Annotation(
            3L, "word", 7L, 10L,
            list(list(kind = "noun", score = 2L))
          )
          merged <- merge(base, update)
          selected <- subset(merged, type == "word")
          parsed <- parse_ISO_8601_datetime(c(
            "2024-02-29", "2024-02", "2024-02-29T12:34:56Z"
          ))
          dates <- as.character(as.Date(parsed))
          times <- format(as.POSIXlt(parsed), "%Y-%m-%d %H:%M:%S", tz = "UTC")
          dates[is.na(dates)] <- "<NA>"
          times[is.na(times)] <- "<NA>"
          as.character(c(
            class(merged), selected$id, as.character(text[selected]),
            merged$features[[3L]]$kind, merged$features[[3L]]$score,
            dates, times
          ))
        `),
      ).resolves.toEqual([
        "Annotation",
        "Span",
        "2",
        "3",
        "Alpha",
        "beta",
        "noun",
        "2",
        "2024-02-29",
        "<NA>",
        "2024-02-29",
        "<NA>",
        "<NA>",
        "2024-02-29 12:34:56",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public timeSeries 4052.112 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["timeSeries"]);
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "timeSeries",
    );
    expect(artifact).toMatchObject({
      package: { name: "timeSeries", version: "4052.112" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "81c1ce37173db4a98b93945ac65460c03d34b60df6bcfaece377241ca8d85631",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("timeSeries"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("timeSeries"))')).resolves.toBe(
        "4052.112",
      );
      await expect(
        runtime.eval('library("timeSeries"); "package:timeSeries" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          x <- timeSeries(
            matrix(c(1, 2, 4, 10, 20, 40), ncol = 2),
            c("2024-01-01", "2024-01-02", "2024-01-03"),
            units = c("left", "right")
          )
          y <- x + 1
          z <- returns(x, type = "discrete", trim = TRUE)
          as.character(c(
            class(x), dim(x), colnames(x), as.numeric(series(x)),
            as.numeric(series(y)), dim(z), round(as.numeric(series(z)), 8),
            as.character(start(x)), as.character(end(x)),
            is.timeSeries(x), isUnivariate(x), isMultivariate(x)
          ))
        `),
      ).resolves.toEqual([
        "timeSeries",
        "3",
        "2",
        "left",
        "right",
        "1",
        "2",
        "4",
        "10",
        "20",
        "40",
        "2",
        "3",
        "5",
        "11",
        "21",
        "41",
        "2",
        "2",
        "0.69314718",
        "0.69314718",
        "0.69314718",
        "0.69314718",
        "2024-01-01",
        "2024-01-03",
        "TRUE",
        "FALSE",
        "TRUE",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public pls 2.9-0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["pls"]);
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "pls");
    expect(artifact).toMatchObject({
      package: { name: "pls", version: "2.9-0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "282bafa4753ea45f9dd5c4fc3b6c2e8e9cf7389db09ee7f953f4d63adf92988f",
      },
    });
    try {
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
      await expect(runtime.eval('is.environment(getNamespace("pls"))')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("pls"))')).resolves.toBe("2.9.0");
      await expect(runtime.eval('library("pls"); "package:pls" %in% search()')).resolves.toBe(true);
      await expect(
        runtime.eval(`
          data(yarn)
          training <- yarn[yarn$train,]
          c(dim(yarn$NIR), dim(training$NIR), dim(model.matrix(density ~ NIR, training)))
        `),
      ).resolves.toEqual([28, 268, 21, 268, 21, 269]);
      await expect(
        runtime.eval(
          'data(mayonnaise); c(nrow(mayonnaise), length(attr(mayonnaise, "row.names")), tail(attr(mayonnaise, "row.names"), 1))',
        ),
      ).resolves.toEqual([162, 162, 162]);
      await expect(
        runtime.eval(`
          data(mayonnaise)
          mayonnaise$dummy <- I(model.matrix(
            ~ y - 1,
            data.frame(y = factor(mayonnaise$oil.type))
          ))
          may.cpls <- cppls(dummy ~ NIR, 10, data = mayonnaise, subset = train)
          may.test <- predict(
            may.cpls,
            newdata = mayonnaise[!mayonnaise$train,],
            type = "score"
          )
          fitdata <- data.frame(
            oil.type = mayonnaise$oil.type[mayonnaise$train],
            NIR.score = I(may.cpls$scores[, 1:3, drop = FALSE])
          )
          testdata <- data.frame(
            oil.type = mayonnaise$oil.type[!mayonnaise$train],
            NIR.score = I(may.test[, 1:3, drop = FALSE])
          )
          c(dim(fitdata$NIR.score), dim(testdata$NIR.score))
        `),
      ).resolves.toEqual([120, 3, 42, 3]);
      await expect(
        runtime.eval(`
          data(yarn)
          training <- yarn[yarn$train, ]
          held <- yarn[!yarn$train, ]
          fit <- plsr(
            density ~ NIR,
            data = training,
            ncomp = 3,
            validation = "none"
          )
          prediction <- predict(fit, newdata = held, ncomp = 3)
          as.character(c(
            class(fit),
            dim(fit$scores),
            dim(fit$loadings),
            dim(coef(fit, ncomp = 3)),
            dim(prediction),
            round(fit$scores[c(1, 21), c(1, 3)], 10),
            round(fit$loadings[c(1, 268), c(1, 3)], 10),
            round(coef(fit, ncomp = 3)[c(1, 268), 1, 1], 10),
            round(prediction[c(1, 7), 1, 1], 10),
            round(explvar(fit), 10),
            length(getNamespaceExports("pls"))
          ))
        `),
      ).resolves.toEqual([
        "mvr",
        "21",
        "3",
        "268",
        "3",
        "268",
        "1",
        "1",
        "7",
        "1",
        "1",
        "4.6279699759",
        "-2.831241269",
        "0.7792134554",
        "0.338480791",
        "0.0070915987",
        "-0.0032000534",
        "-0.1089712457",
        "-0.029858006",
        "-1.4170144054",
        "-0.4265488155",
        "50.0552718481",
        "18.1205594348",
        "47.0708917074",
        "51.5062727691",
        "0.9194073228",
        "43",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public stargazer 5.2.3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["stargazer"]);
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "stargazer",
    );
    expect(artifact).toMatchObject({
      package: { name: "stargazer", version: "5.2.3" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "5630ee0af4ccd30f34347b61fdfa0b43547dd3f8348474471f83e362a1e75929",
      },
    });
    try {
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
      await runtime.eval('library("stargazer"); stargazer(attitude)');
      await runtime.eval("stargazer(attitude, summary = FALSE)");
      await runtime.eval(`
        linear.1 <- lm(
          rating ~ complaints + privileges + learning + raises + critical,
          data = attitude
        )
        linear.2 <- lm(rating ~ complaints + privileges + learning, data = attitude)
        attitude$high.rating <- attitude$rating > 70
        probit.model <- glm(
          high.rating ~ learning + critical + advance,
          data = attitude,
          family = binomial(link = "probit")
        )
        NULL
      `);
      await expect(
        runtime.eval("is.null(dim(as.vector(names(linear.1$coefficients))))"),
      ).resolves.toBe(true);
      await expect(
        runtime.eval("is.null(dim(as.vector(names(probit.model$coefficients))))"),
      ).resolves.toBe(true);
      await runtime.eval("stargazer(linear.1)");
      await runtime.eval("stargazer(linear.1, linear.2)");
      await runtime.eval("stargazer(linear.1, linear.2, probit.model)");
      await runtime.eval(`
        stargazer(
          linear.1, linear.2, probit.model,
          type = "text", title = "Regression Results", single.row = TRUE,
          ci = TRUE, ci.level = 0.9, omit.stat = c("f", "ser")
        )
      `);
      await runtime.eval(`
        stargazer(
          probit.model, linear.1, linear.2, type = "text",
          keep = c("complaints", "learning", "raises", "critical"),
          keep.stat = "n", order = c("learning", "raises")
        )
      `);
      await runtime.eval(`
        multiply.by.10 <- function(x) x * 10
        stargazer(
          probit.model, linear.1, linear.2,
          apply.coef = multiply.by.10, apply.se = multiply.by.10
        )
      `);
      await runtime.eval(`
        correlation.matrix <- cor(attitude)
        stargazer(correlation.matrix, type = "html")
      `);
      await expect(
        runtime.eval(`
          independent.fit <- lm(rating ~ complaints + learning, attitude)
          stargazer(
            independent.fit, type = "text", keep = "complaints",
            keep.stat = "n", digits = 3
          )
        `),
      ).resolves.toEqual([
        "",
        "========================================",
        "                 Dependent variable:    ",
        "             ---------------------------",
        "                       rating           ",
        "----------------------------------------",
        "complaints            0.644***          ",
        "                       (0.118)          ",
        "                                        ",
        "----------------------------------------",
        "Observations             30             ",
        "========================================",
        "Note:        *p<0.1; **p<0.05; ***p<0.01",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public lgr 0.5.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["lgr"]);
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "lgr");
    expect(artifact).toMatchObject({
      package: { name: "lgr", version: "0.5.2" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "d09a1147aa2f4317795cd6a44ec6a3a9bb7e10f5892fd54be7bd5e2ba2534c4a",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library(lgr)
          buffer <- AppenderBuffer$new(
            buffer_size = 10L,
            flush_on_exit = FALSE,
            flush_on_rotate = FALSE
          )
          logger <- Logger$new(
            name = "scenario",
            appenders = list(memory = buffer),
            threshold = "info",
            propagate = FALSE
          )
          logger$log(
            level = "debug", msg = "hidden",
            timestamp = as.POSIXct("2020-01-02 03:04:05", tz = "UTC"), caller = "probe"
          )
          logger$log(
            level = "info", msg = "value=%s", "7", stage = "alpha",
            timestamp = as.POSIXct("2020-01-02 03:04:05", tz = "UTC"), caller = "probe"
          )
          logger$log(
            level = "warn", msg = "caution", code = 42L,
            timestamp = as.POSIXct("2020-01-02 03:04:06", tz = "UTC"), caller = "probe"
          )
          events <- buffer$buffer_events
          c(
            length(events),
            vapply(events, function(event) event$msg, ""),
            vapply(events, function(event) event$level, 0L),
            vapply(events, function(event) event$caller, ""),
            events[[1L]]$stage, as.character(events[[2L]]$code),
            class(events), class(events[[1L]]),
            logger$threshold, buffer$threshold
          )
        `),
      ).resolves.toEqual([
        "2",
        "value=7",
        "caution",
        "400",
        "300",
        "probe",
        "probe",
        "alpha",
        "42",
        "event_list",
        "list",
        "LogEvent",
        "R6",
        "400",
        NA,
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public operator.tools 1.6.3.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["operator.tools"]);
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "operator.tools",
    );
    expect(artifact).toMatchObject({
      package: { name: "operator.tools", version: "1.6.3.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "77f20c3fed33d2cc54438125cb625fa91c198a29ba1f154b656351be182400b2",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library(operator.tools)
          \`%between%\` <- function(x, bounds) x >= bounds[[1L]] & x <= bounds[[2L]]
          setOperator(
            "%between%", type = "relational", inverse = "%!between%",
            rel.type = "eq", marker = "custom"
          )
          c(
            paste(operators(c("arithmetic", "logical")), collapse = ","),
            operator.type(as.name("%between%")),
            rel.type(as.name("%between%")),
            .Options$operators[["%between%"]]$marker,
            as.character(can.operator("%between%")),
            as.character(is.operator(as.name("%between%"))),
            paste(as.character(c(1, 3, 7) %between% c(2, 6)), collapse = ","),
            as.character(inverse(as.name("%between%"))),
            paste(as.character(c("a", "c") %!in% c("a", "b")), collapse = ",")
          )
        `),
      ).resolves.toEqual([
        "+,-,*,/,^,%%,%/%,!,&,&&,|,||",
        "relational",
        "eq",
        "custom",
        "TRUE",
        "TRUE",
        "FALSE,TRUE,FALSE",
        "%!between%",
        "FALSE,TRUE",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public stabledist 0.7-2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["stabledist"]);
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "stabledist",
    );
    expect(artifact).toMatchObject({
      package: { name: "stabledist", version: "0.7-2" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "14cc678395697fe8851cbd921268cf69a84f5dd3c922b0f6570c984ddea7d8c2",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      await expect(
        runtime.eval(`
          density <- stabledist::dstable(c(-2, 0, 2), alpha = 1.5, beta = .25,
            gamma = 1.2, delta = .5, pm = 1)
          probability <- stabledist::pstable(c(-2, 0, 2), alpha = 1.5, beta = .25,
            gamma = 1.2, delta = .5, pm = 1)
          quantile <- stabledist::qstable(c(.1, .5, .9), alpha = 1.5, beta = .25,
            gamma = 1.2, delta = .5, pm = 1)
          mode <- stabledist::stableMode(alpha = 1.5, beta = .25)
          set.seed(20260825)
          draws <- stabledist::rstable(4, alpha = 1.5, beta = .25,
            gamma = 1.2, delta = .5, pm = 1)
          c(
            max(abs(density - c(.0790178808, .2377310411, .1155294557))) < 1e-9,
            max(abs(probability - c(.099801737, .4334480972, .8187202744))) < 1e-9,
            max(abs(quantile - c(-1.9974907331, .2789611283, 2.9770495357))) < 5e-6,
            abs(mode - (-.0471214983)) < 1e-9,
            length(draws) == 4,
            all(is.finite(draws))
          )
        `),
      ).resolves.toEqual([true, true, true, true, true, true]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public formula.tools 1.7.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["formula.tools"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "formula.tools",
    );
    expect(artifact).toMatchObject({
      package: { name: "formula.tools", version: "1.7.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "bce730059c494ed09405ed5e5e5e81bdfc2a0ccfe7785b750d136d9c53415be5",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      await expect(
        runtime.eval(`
          suppressPackageStartupMessages(library(formula.tools))
          public <- c(
            "env", "get.vars", "invert", "is.one.sided", "is.two.sided",
            "lhs", "lhs.vars", "lhs<-", "op", "op.type", "op<-", "rhs",
            "rhs.vars", "rhs<-", "split_terms", "toggle.sign"
          )
          f <- A + B ~ C + D
          original <- c(
            as.character(f), deparse(lhs(f)), deparse(rhs(f)), as.character(op(f)),
            op.type(f), lhs.vars(f), rhs.vars(f), is.one.sided(f), is.two.sided(f),
            identical(env(f), environment(f))
          )
          lhs(f) <- quote(E / F)
          rhs(f) <- quote(G + H)
          modified <- c(as.character(f), deparse(lhs(f)), deparse(rhs(f)))
          call <- quote(A + B > C + D)
          op(call) <- quote(\`<=\`)
          split <- vapply(
            split_terms(quote(-(a + (b - c))), recursive = TRUE), deparse, character(1)
          )
          toggled <- vapply(
            toggle.sign(expression(a, -b, -(a - b))), deparse, character(1)
          )
          inverted <- vapply(
            expression(
              A > 5, A >= 5, A < 5, A <= 5, A == 5, A != 5,
              A %in% letters[1:5], A %!in% letters[1:5]
            ),
            function(x) deparse(invert(x)), character(1)
          )
          c(
            all(public %in% getNamespaceExports("formula.tools")),
            original, modified, deparse(call),
            get.vars(Species ~ ., iris), terms(quote(A + B)), split, toggled, inverted
          )
        `),
      ).resolves.toEqual([
        "TRUE",
        "A + B ~ C + D",
        "A + B",
        "C + D",
        "~",
        "tilde",
        "A",
        "B",
        "C",
        "D",
        "FALSE",
        "TRUE",
        "TRUE",
        "E/F ~ G + H",
        "E/F",
        "G + H",
        "A + B <= C + D",
        "Species",
        "Sepal.Length",
        "Sepal.Width",
        "Petal.Length",
        "Petal.Width",
        "A",
        "B",
        "-(a + (b - c))",
        "-a",
        "b",
        "(a - b)",
        "A <= 5",
        "A < 5",
        "A >= 5",
        "A > 5",
        "A != 5",
        "A == 5",
        "A %!in% letters[1:5]",
        "A %in% letters[1:5]",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public gridBase 0.4-7 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["gridBase"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "gridBase");
    expect(artifact).toMatchObject({
      package: { name: "gridBase", version: "0.4-7" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "41a4dd801b19b29fe882380b2f510986fbb99b6e2fa3ce805489c00e316f7bd7",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public gsubfn 0.7 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    let selectedSuggestsError: unknown;
    try {
      await installPackagesFromRepository(["gsubfn"], {
        pack: { includeTests: true },
        selectedSuggests: ["chron"],
      });
    } catch (error) {
      selectedSuggestsError = error;
    }
    expect(selectedSuggestsError).toBeInstanceOf(PackageCompatibilityError);
    if (!(selectedSuggestsError instanceof PackageCompatibilityError)) throw new Error();
    expect(selectedSuggestsError.artifact).toMatchObject({
      package: { name: "chron" },
      compatibility: { packaging: "blocked" },
    });
    expect(
      selectedSuggestsError.artifact.compatibility.issues.map((issue) => issue.message),
    ).toEqual(
      expect.arrayContaining([
        "DESCRIPTION declares NeedsCompilation: yes.",
        "NAMESPACE requests a native dynamic library.",
      ]),
    );
    const installed = await installPackagesFromRepository(["gsubfn"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "gsubfn");
    expect(artifact).toMatchObject({
      package: { name: "gsubfn", version: "0.7" },
      compatibility: { packaging: "ready", execution: "unchecked" },
    });
    expect(installed.lock.suggests).toEqual({ mode: "none", packages: [] });
    expect(installed.artifacts.map((candidate) => candidate.package.name)).toEqual([
      "proto",
      "gsubfn",
    ]);
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(false);
      expect(packageCheck.firstBlocker).toEqual({
        id: "example:list",
        kind: "examples",
        status: "failed",
        message: "Object 'month.day.year' not found.",
      });
      expect(packageCheck.steps.find((step) => step.id === "example:read.pattern")).toMatchObject({
        status: "passed",
      });
      expect(packageCheck.steps.find((step) => step.id === "example:strapply")).toMatchObject({
        status: "failed",
        message: "Object 'FUN' of mode 'function' was not found.",
      });
      await expect(
        runtime.eval(`
          library(gsubfn)
          strapply("a:b c:d", "(.):(.)", c, combine = list)[[1]]
        `),
      ).resolves.toEqual([
        ["a", "b"],
        ["c", "d"],
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public tinytable 0.18.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["tinytable"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "tinytable",
    );
    expect(artifact).toMatchObject({
      package: { name: "tinytable", version: "0.18.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "fa5f1f7a1a3cc53ac1f27200dafc7bf3d73923949902b57d84d14f22e544371f",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
      expect(packageCheck.steps.find((step) => step.id === "test:tinytest.R")).toMatchObject({
        kind: "tests",
        status: "passed",
      });
      expect(packageCheck.steps.find((step) => step.id === "vignettes")).toMatchObject({
        kind: "vignettes",
        status: "not-applicable",
      });
      expect(
        packageCheck.steps.find((step) => step.id === "example:rbind2,tinytable,tinytable-method"),
      ).toEqual({
        id: "example:rbind2,tinytable,tinytable-method",
        kind: "examples",
        status: "not-applicable",
        message: "Example requires unavailable suggested package 'data.table'.",
      });
      expect(packageCheck.steps.find((step) => step.id === "example:style_tt")).toEqual({
        id: "example:style_tt",
        kind: "examples",
        status: "not-applicable",
        message: "Example requires unavailable optional package 'knitr' declared in Enhances.",
      });
      await expect(
        runtime.eval(`
          library(tinytable)
          input <- data.frame(
            label = c("alpha", "beta", "gamma"),
            score = c(1.234, NA_real_, 9.876),
            keep = c(TRUE, FALSE, TRUE)
          )
          tab <- tt(input, caption = "Results", notes = list("*" = "note"), width = 0.75)
          tab <- format_tt(tab, j = "score", digits = 1)
          tab <- style_tt(
            tab,
            i = keep,
            j = c("label", "score"),
            bold = TRUE,
            color = "navy"
          )
          c(
            class(tab),
            as.character(nrow(tab@data_body)),
            as.character(ncol(tab@data_body)),
            tab@caption,
            as.character(tab@width),
            as.character(length(tab@lazy_format)),
            as.character(length(tab@lazy_style)),
            paste(names(tab@data_body), collapse = ","),
            paste(tab@data_body$label, collapse = ","),
            paste(is.na(tab@data_body$score), collapse = ",")
          )
        `),
      ).resolves.toEqual([
        "tinytable",
        "3",
        "3",
        "Results",
        "0.75",
        "1",
        "1",
        "label,score,keep",
        "alpha,beta,gamma",
        "FALSE,FALSE,FALSE",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public magic 1.6-1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["magic"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "magic");
    expect(artifact).toMatchObject({
      package: { name: "magic", version: "1.6-1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "47e6ab749b09957ba8e01115cb9872e204163045b8f3785efc143167b7b3276d",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library("magic")
          square <- magic(5)
          product <- magic.product(magic(3), magic(4))
          diagonal <- adiag(matrix(1:4, 2, 2), matrix(5:10, 2, 3), pad = -1)
          latin4 <- latin(4)
          shifted <- ashift(array(1:8, c(2, 2, 2)), c(1, -1, 0))
          list(
            square = list(
              dim = dim(square), magic = is.magic(square), constant = magic.constant(square),
              rows = rowSums(square), columns = colSums(square)
            ),
            product = list(
              dim = dim(product), magic = is.magic(product), constant = magic.constant(product),
              corners = as.vector(product[c(1, nrow(product)), c(1, ncol(product))])
            ),
            diagonal = list(dim = dim(diagonal), values = as.vector(diagonal)),
            latin = list(dim = dim(latin4), values = as.vector(latin4), valid = is.latin(latin4)),
            shifted = list(dim = dim(shifted), values = as.vector(shifted))
          )
        `),
      ).resolves.toEqual([
        [[5, 5], true, 65, [65, 65, 65, 65, 65], [65, 65, 65, 65, 65]],
        [[12, 12], true, 870, [17, 52, 93, 128]],
        [
          [4, 5],
          [1, 2, -1, -1, 3, 4, -1, -1, -1, -1, 5, 6, -1, -1, 7, 8, -1, -1, 9, 10],
        ],
        [[4, 4], [1, 4, 3, 2, 2, 1, 4, 3, 3, 2, 1, 4, 4, 3, 2, 1], true],
        [
          [2, 2, 2],
          [4, 3, 2, 1, 8, 7, 6, 5],
        ],
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public countrycode 1.9.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["countrycode"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "countrycode",
    );
    expect(artifact).toMatchObject({
      package: { name: "countrycode", version: "1.9.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: { algorithm: "sha256" },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);

      await expect(
        runtime.eval(`
          library("countrycode")
          warning.message <- NULL
          converted <- withCallingHandlers(
            countrycode(
              c("United States", "France", "Cote d'Ivoire", "Atlantis", NA),
              "country.name", "iso3c", warn = TRUE
            ),
            warning = function(w) {
              warning.message <<- conditionMessage(w)
              invokeRestart("muffleWarning")
            }
          )
          reversed <- countrycode(c("USA", "FRA", "CIV"), "iso3c", "country.name.en")
          dictionary <- data.frame(
            origin = c("alpha", "beta"), destination = c("A", "B")
          )
          custom <- countrycode(
            c("beta", "alpha", "missing"), "origin", "destination",
            custom_dict = dictionary, warn = FALSE
          )
          list(
            converted = converted,
            reversed = reversed,
            custom = custom,
            warning = warning.message,
            data = list(
              class = class(codelist), dim = dim(codelist),
              first = unlist(codelist[1, c("iso2c", "iso3c", "country.name.en")])
            )
          )
        `),
      ).resolves.toEqual([
        ["USA", "FRA", "CIV", NA, NA],
        ["United States", "France", "Côte d’Ivoire"],
        ["B", "A", NA],
        "Some values were not matched unambiguously: Atlantis\nTo fix unmatched values, please use the `custom_match` argument. If you think the default matching rules should be improved, please file an issue at https://github.com/vincentarelbundock/countrycode/issues\n",
        [
          ["tbl_df", "tbl", "data.frame"],
          [292, 628],
          ["AF", "AFG", "Afghanistan"],
        ],
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public implied 0.5 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["implied"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "implied");
    expect(artifact).toMatchObject({
      package: { name: "implied", version: "0.5" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: { algorithm: "sha256" },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);

      await expect(
        runtime.eval(`
          library("implied")
          odds <- rbind(
            home = c(4.20, 3.70, 1.95),
            away = c(2.45, 3.70, 2.90)
          )
          methods <- c("basic", "shin", "bb", "wpo", "or", "power", "additive", "jsd")
          observed <- lapply(methods, function(method) {
            converted <- implied_probabilities(odds, method = method)
            detail <- switch(
              method,
              shin = converted$zvalues,
              bb = converted$zvalues,
              wpo = as.numeric(converted$specific_margins),
              or = converted$odds_ratios,
              power = converted$exponents,
              jsd = converted$distance,
              NULL
            )
            list(
              method = method,
              names = names(converted),
              dim = dim(converted$probabilities),
              probabilities = round(as.numeric(converted$probabilities), 10),
              sums = round(unname(rowSums(converted$probabilities)), 12),
              margin = round(unname(converted$margin), 10),
              detail = if (is.null(detail)) NULL else round(unname(detail), 10),
              problematic = unname(converted$problematic)
            )
          })
          generated <- implied_odds(c(.5, .3, .2), method = "power", margin = .05)
          roundtrip <- implied_probabilities(generated$odds, method = "power")
          list(
            methods = observed,
            inverse = list(
              names = names(generated),
              odds = round(as.numeric(generated$odds), 10),
              probabilities = round(as.numeric(roundtrip$probabilities), 10),
              margin = round(unname(roundtrip$margin), 10)
            )
          )
        `),
      ).resolves.toEqual([
        [
          [
            "basic",
            ["probabilities", "margin", "problematic"],
            [2, 3],
            [0.2331555986, 0.3988847584, 0.264663112, 0.2641263941, 0.5021812894, 0.3369888476],
            [1, 1],
            [0.0211860212, 0.0232611218],
            null,
            [false, false],
          ],
          [
            "shin",
            ["probabilities", "margin", "zvalues", "problematic"],
            [2, 3],
            [0.2315810579, 0.4000159792, 0.2635807688, 0.2629335553, 0.5048381733, 0.3370504655],
            [1, 1],
            [0.0211860212, 0.0232611218],
            [0.0105473377, 0.0115731356],
            [false, false],
          ],
          [
            "bb",
            ["probabilities", "margin", "zvalues", "problematic"],
            [2, 3],
            [0.2299379628, 0.4011988723, 0.2624574745, 0.2616832321, 0.5076045627, 0.3371178955],
            [1, 1],
            [0.0211860212, 0.0232611218],
            [0.0105930106, 0.0116305609],
            [false, false],
          ],
          [
            "wpo",
            ["probabilities", "margin", "specific_margins", "problematic"],
            [2, 3],
            [0.231033231, 0.400409558, 0.2632082632, 0.262516563, 0.5057585058, 0.3370738789],
            [1, 1],
            [0.0211860212, 0.0232611218],
            [0.0305670618, 0.019364441, 0.0268304915, 0.0295360688, 0.0139631998, 0.0230029906],
            [false, false],
          ],
          [
            "or",
            ["probabilities", "margin", "odds_ratios", "problematic"],
            [2, 3],
            [0.2320045334, 0.3996913472, 0.2636413017, 0.2633867532, 0.504354165, 0.3369218996],
            [1, 1],
            [0.0211860212, 0.0232611218],
            [1.0344562778, 1.035813892],
            [false, false],
          ],
          [
            "power",
            ["probabilities", "margin", "exponents", "problematic"],
            [2, 3],
            [0.2311414278, 0.4003156304, 0.2630644489, 0.2627189095, 0.5057941234, 0.33696546],
            [1, 1],
            [0.0211860212, 0.0232611218],
            [0.9797665697, 0.9788117146],
            [false, false],
          ],
          [
            "additive",
            ["probabilities", "margin", "problematic"],
            [2, 3],
            [0.231033231, 0.400409558, 0.2632082632, 0.262516563, 0.5057585058, 0.3370738789],
            [1, 1],
            [0.0211860212, 0.0232611218],
            null,
            [false, false],
          ],
          [
            "jsd",
            ["probabilities", "margin", "distance", "problematic"],
            [2, 3],
            [0.2315189095, 0.4000504543, 0.2634116565, 0.2629589312, 0.505069434, 0.3369906145],
            [1, 1],
            [0.0211860212, 0.0232611218],
            [0.0054853714, 0.005849245],
            [false, false],
          ],
        ],
        [
          ["odds", "exponents"],
          [1.9355739477, 3.1490437841, 4.6339533582],
          [0.49999861, 0.300000432, 0.2000009579],
          0.0499977978,
        ],
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public sfsmisc 1.1-25 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["sfsmisc"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "sfsmisc");
    expect(artifact).toMatchObject({
      package: { name: "sfsmisc", version: "1.1-25" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: { algorithm: "sha256" },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);

      await expect(
        runtime.eval(`
          library("sfsmisc")
          input <- matrix(c(1, .91, .73, .91, 1, 1.04, .73, 1.04, 1), 3, 3)
          corrected <- nearcor(input)
          list(
            primes = unname(primes(50)),
            factors = lapply(c(360L, 84L, 97L), function(n) {
              unname(as.numeric(factorize(n)[[1]]))
            }),
            gcd = c(GCD(84L, 30L), GCD(48L, 18L)),
            lcm = c(LCM(12L, 18L), LCM(21L, 6L)),
            whole = unname(is.whole(c(1, 1 + 1e-10, 2.5, NA_real_, Inf))),
            duplicates = unname(Duplicated(
              c("a", "b", "a", NA, NA, "c", "b"),
              nomatch = 0L
            )),
            integrals = round(c(
              integrate.xy(c(0, 1, 2, 3), c(0, 1, 4, 9), .5, 2.5, use.spline = FALSE),
              integrate.xy(c(0, 1, 2, 3), c(0, 1, 4, 9), .5, 2.5, use.spline = TRUE)
            ), 10),
            scaled = round(as.numeric(col01scale(
              matrix(c(1, 2, 4, 10, 20, 40), nrow = 3)
            )), 10),
            ellipse = round(as.numeric(ellipsePoints(
              a = 4,
              b = 2,
              alpha = pi / 6,
              loc = c(3, -2),
              n = 5
            )), 8),
            nearcor = list(
              names = names(corrected),
              matrix = round(as.numeric(corrected$cor), 8),
              eigenvalues = round(eigen(
                corrected$cor,
                symmetric = TRUE,
                only.values = TRUE
              )$values, 8),
              iterations = corrected$iterations,
              converged = corrected$converged
            )
          )
        `),
      ).resolves.toEqual([
        [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47],
        [
          [2, 3, 5, 3, 2, 1],
          [2, 3, 7, 2, 1, 1],
          [97, 1],
        ],
        [6, 6],
        [36, 42],
        [true, true, false, true, true],
        [1, 2, 1, 0, 0, 0, 2],
        [5.5, 5.1666695333],
        [-0.4444444444, -0.1111111111, 0.5555555556, -0.4444444444, -0.1111111111, 0.5555555556],
        [
          6.99983298, 2.98172321, -0.99983298, 3.01827679, 6.99983298, -1.96344642, -0.00008351,
          -2.03655358, -3.99991649, -1.96344642,
        ],
        [
          ["cor", "fnorm", "iterations", "converged"],
          [1, 0.87915221, 0.75239564, 0.87915221, 1, 0.97537333, 0.75239564, 0.97537333, 1],
          [2.74111279, 0.25888718, 0.00000003],
          18,
          true,
        ],
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public testit 1.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["testit"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "testit");
    expect(artifact).toMatchObject({
      package: { name: "testit", version: "1.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: { algorithm: "sha256" },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("testit")
          public <- c("assert", "has_error", "has_warning", "has_message", "test_pkg", "%==%")
          list(
            exports = length(getNamespaceExports("testit")) == length(public) &&
              all(public %in% getNamespaceExports("testit")),
            formals = lapply(c("assert", "has_error", "has_warning", "has_message", "test_pkg"),
              function(name) names(formals(getExportedValue("testit", name)))),
            success = is.null(assert("math", 1 + 1 == 2)),
            assert_failure = tryCatch(
              assert("sum mismatch", 1 + 1 == 3),
              error = function(e) conditionMessage(e)
            ),
            equal = c(1:3 %==% c(1L, 2L, 3L), 1:3 %==% c(1L, 2L, 4L)),
            conditions = c(
              has_error(1 + 1),
              has_error(stop("boom"), "boom"),
              has_error(stop("boom"), "other"),
              has_warning(warning("warn"), "warn"),
              has_warning(warning("warn"), "other"),
              has_message(message("note"), "note"),
              has_message(message("note"), "other")
            ),
            missing_tests = tryCatch(
              test_pkg("testit"),
              error = function(e) conditionMessage(e)
            )
          )
        `),
      ).resolves.toEqual([
        true,
        [
          ["fact", "..."],
          ["expr", "message", "..."],
          ["expr", "message", "..."],
          ["expr", "message", "..."],
          ["package", "dir", "filter", "update"],
        ],
        true,
        "-- Assertion failed: sum mismatch --\n   1 + 1 == 3 is not TRUE but FALSE",
        [true, false],
        [false, true, false, true, false, true, false],
        "None of the directories exists:\n* testit\n* tests/testit",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public Metrics 0.1.4 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["Metrics"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "Metrics");
    expect(artifact).toMatchObject({
      package: { name: "Metrics", version: "0.1.4" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "4de5f0a5d6b28958a09ef4c5448f60a0a9421c39232515a65d28545493936764",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("Metrics")
          actual <- c(1, 2, 3, 4)
          predicted <- c(1, 3, 2, 6)
          list(
            exports = length(getNamespaceExports("Metrics")),
            formals = lapply(c("accuracy", "fbeta_score", "mase", "apk", "mapk"),
              function(name) names(formals(getExportedValue("Metrics", name)))),
            regression = round(c(
              ae = ae(actual, predicted)[2],
              se = se(actual, predicted)[4],
              bias = bias(actual, predicted),
              mae = mae(actual, predicted),
              mse = mse(actual, predicted),
              rmse = rmse(actual, predicted),
              mdae = mdae(actual, predicted),
              sse = sse(actual, predicted),
              rse = rse(actual, predicted),
              rrse = rrse(actual, predicted)
            ), 12),
            classification = round(c(
              accuracy = accuracy(c(1, 0, 1, 0), c(1, 1, 1, 0)),
              ce = ce(c(1, 0, 1, 0), c(1, 1, 1, 0)),
              precision = precision(c(1, 0, 1, 0), c(1, 1, 1, 0)),
              recall = recall(c(1, 0, 1, 0), c(1, 1, 1, 0)),
              f1 = f1(c(1, 0, 1, 0), c(1, 1, 1, 0)),
              fbeta = fbeta_score(c(1, 0, 1, 0), c(1, 1, 1, 0), 2),
              auc = auc(c(1, 0, 1, 0), c(.9, .8, .7, .1))
            ), 12),
            retrieval = round(c(
              apk = apk(3, c(1, 2, 3), c(1, 4, 2, 5)),
              mapk = mapk(3, list(c(1, 2, 3), c(4, 5)), list(c(1, 4, 2), c(5, 6, 4)))
            ), 12),
            scale = round(mase(c(1, 3, 2, 5), c(1, 2, 4, 4), 1), 12),
            kappa = round(
              ScoreQuadraticWeightedKappa(c(1, 2, 3, 2), c(1, 2, 2, 3), 1, 3),
              12
            ),
            empty = mae(numeric(), numeric())
          )
        `),
      ).resolves.toEqual([
        32,
        [
          ["actual", "predicted"],
          ["actual", "predicted", "beta"],
          ["actual", "predicted", "step_size"],
          ["k", "actual", "predicted"],
          ["k", "actual", "predicted"],
        ],
        [1, 4, -0.5, 1, 1.5, 1.224744871392, 1, 6, 1.2, 1.09544511501],
        [0.75, 0.25, 0.666666666667, 1, 1, 0.909090909091, 0.75],
        [0.555555555556, 0.694444444444],
        0.5,
        0.5,
        Number.NaN,
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public pwr 1.3-0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["pwr"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "pwr");
    expect(artifact).toMatchObject({
      package: { name: "pwr", version: "1.3-0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "12a73d3b7d71ef95fa4d27e9f151450e0ff34bd72f228396f7fb10dc70c956d6",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
      expect(packageCheck.steps.filter((step) => step.status === "failed")).toEqual([]);

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("pwr")
          t_known <- pwr.t.test(
            n = 64, d = .5, sig.level = .05, type = "two.sample", alternative = "two.sided"
          )
          t_solve <- pwr.t.test(d = .5, power = .8, sig.level = .05, type = "two.sample")
          t_unequal <- pwr.t2n.test(n1 = 40, n2 = 60, d = .4, sig.level = .05)
          two_prop <- pwr.2p.test(h = .35, n = 80, sig.level = .05)
          unequal_prop <- pwr.2p2n.test(h = .35, n1 = 60, n2 = 90, sig.level = .05)
          anova <- pwr.anova.test(k = 4, n = 30, f = .25, sig.level = .05)
          chisq <- pwr.chisq.test(w = .3, N = 100, df = 3, sig.level = .05)
          regression <- pwr.f2.test(u = 4, v = 95, f2 = .15, sig.level = .05)
          normal <- pwr.norm.test(d = .4, n = 50, sig.level = .05)
          proportion <- pwr.p.test(h = .4, n = 50, sig.level = .05)
          correlation <- pwr.r.test(n = 50, r = .3, sig.level = .05)
          conventional <- cohen.ES("t", "medium")
          list(
            exports = length(getNamespaceExports("pwr")),
            formals = lapply(
              c("pwr.t.test", "pwr.t2n.test", "pwr.anova.test", "pwr.r.test", "cohen.ES"),
              function(name) names(formals(getExportedValue("pwr", name)))
            ),
            effects = round(c(
              h = ES.h(.5, .3),
              w1 = ES.w1(c(.5, .5), c(.7, .3)),
              w2 = ES.w2(matrix(c(.3, .2, .2, .3), 2))
            ), 12),
            conventional = c(
              conventional$test,
              conventional$size,
              conventional$effect.size,
              conventional$method,
              class(conventional)
            ),
            powers = round(c(
              t_known = t_known$power,
              t_solve_n = t_solve$n,
              t_unequal = t_unequal$power,
              two_prop = two_prop$power,
              unequal_prop = unequal_prop$power,
              anova = anova$power,
              chisq = chisq$power,
              regression = regression$power,
              normal = normal$power,
              proportion = proportion$power,
              correlation = correlation$power
            ), 9),
            shapes = lapply(
              list(t_known, t_unequal, two_prop, anova, chisq, regression, correlation),
              function(value) c(class(value), names(value))
            ),
            invalid = tryCatch(
              pwr.t.test(n = 10, d = .3, power = .8),
              error = function(e) conditionMessage(e)
            )
          )
        `),
      ).resolves.toEqual([
        15,
        [
          ["n", "d", "sig.level", "power", "type", "alternative"],
          ["n1", "n2", "d", "sig.level", "power", "alternative"],
          ["k", "n", "f", "sig.level", "power"],
          ["n", "r", "sig.level", "power", "alternative"],
          ["test", "size"],
        ],
        [0.411516846067, 0.4, 0.2],
        ["t", "medium", "0.5", "Conventional effect size from Cohen (1982)", "power.htest"],
        [
          0.801459558, 63.765610444, 0.492232749, 0.600124431, 0.555708773, 0.606522787, 0.7112536,
          0.873500581, 0.807430419, 0.807430419, 0.571555842,
        ],
        [
          ["power.htest", "n", "d", "sig.level", "power", "alternative", "note", "method"],
          ["power.htest", "n1", "n2", "d", "sig.level", "power", "alternative", "method"],
          ["power.htest", "h", "n", "sig.level", "power", "alternative", "method", "note"],
          ["power.htest", "k", "n", "f", "sig.level", "power", "note", "method"],
          ["power.htest", "w", "N", "df", "sig.level", "power", "method", "note"],
          ["power.htest", "u", "v", "f2", "sig.level", "power", "method"],
          ["power.htest", "n", "r", "sig.level", "power", "alternative", "method"],
        ],
        "exactly one of n, d, power, and sig.level must be NULL",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public VennDiagram 1.8.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["VennDiagram"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "VennDiagram",
    );
    expect(artifact).toMatchObject({
      package: { name: "VennDiagram", version: "1.8.2" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: { algorithm: "sha256" },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("VennDiagram")
          futile.logger::flog.threshold(futile.logger::FATAL)
          sets <- list(A = 1:5, B = 4:8, C = c(2, 4, 6, 8))
          overlap <- calculate.overlap(sets)
          partitions <- get.venn.partitions(
            sets, force.unique = TRUE, keep.elements = TRUE
          )
          single <- draw.single.venn(5, "A", ind = FALSE)
          pair <- draw.pairwise.venn(5, 5, 2, c("A", "B"), ind = FALSE)
          triple <- draw.triple.venn(
            5, 5, 4, 2, 2, 2, 1, c("A", "B", "C"), ind = FALSE
          )
          diagram <- venn.diagram(sets, filename = NULL, disable.logging = TRUE)
          ellipse.grob <- ellipse(.5, .5, .2, .1, 30, grid::gpar(col = "red"))
          polygon <- ell2poly(.5, .5, .2, .1, 30, 8)
          list(
            exports = sort(getNamespaceExports("VennDiagram")),
            formals = lapply(
              c("calculate.overlap", "get.venn.partitions", "ellipse", "venn.diagram"),
              function(name) names(formals(getExportedValue("VennDiagram", name)))
            ),
            overlap = c(names(overlap), as.character(unlist(overlap, use.names = FALSE))),
            partitions = c(
              as.character(dim(partitions)), names(partitions),
              as.character(partitions$..count..),
              as.character(lengths(partitions$..values..)),
              as.character(unlist(partitions$..values.., use.names = FALSE))
            ),
            geometry = round(c(
              find.dist(5, 5, 2, FALSE), find.intersect(1, 2, 2),
              unlist(find.cat.pos(.5, .5, 45, .1, .2), use.names = FALSE),
              unlist(polygon, use.names = FALSE)
            ), 9),
            shapes = lapply(
              list(single, pair, triple, diagram),
              function(value) c(
                class(value), as.character(length(value)),
                vapply(value, function(item) class(item)[1], "")
              )
            ),
            ellipse = c(class(ellipse.grob), names(ellipse.grob))
          )
        `),
      ).resolves.toEqual([
        [
          "add.title",
          "adjust.venn",
          "calculate.overlap",
          "decide.special.case",
          "draw.pairwise.venn",
          "draw.quad.venn",
          "draw.quintuple.venn",
          "draw.single.venn",
          "draw.sp.case",
          "draw.sp.case.preprocess",
          "draw.sp.case.scaled",
          "draw.triple.venn",
          "ell2poly",
          "ellipse",
          "find.cat.pos",
          "find.dist",
          "find.intersect",
          "flip.venn",
          "get.venn.partitions",
          "make.truth.table",
          "rotate",
          "rotate.sp",
          "rotate.venn.degrees",
          "venn.diagram",
        ],
        [
          "x",
          ["x", "force.unique", "keep.elements", "hierarchical"],
          ["x", "y", "a", "b", "rotation", "gp"],
          [
            "x",
            "filename",
            "disable.logging",
            "height",
            "width",
            "resolution",
            "imagetype",
            "units",
            "compression",
            "na",
            "main",
            "sub",
            "main.pos",
            "main.fontface",
            "main.fontfamily",
            "main.col",
            "main.cex",
            "main.just",
            "sub.pos",
            "sub.fontface",
            "sub.fontfamily",
            "sub.col",
            "sub.cex",
            "sub.just",
            "category.names",
            "force.unique",
            "print.mode",
            "sigdigs",
            "direct.area",
            "area.vector",
            "hyper.test",
            "total.population",
            "lower.tail",
            "...",
          ],
        ],
        ["a5", "a2", "a4", "a6", "a1", "a3", "a7", "4", "5", "2", "6", "8", "1", "3", "7"],
        [
          "7",
          "6",
          "A",
          "B",
          "C",
          "..set..",
          "..values..",
          "..count..",
          "1",
          "2",
          "1",
          "0",
          "1",
          "1",
          "2",
          "1",
          "2",
          "1",
          "0",
          "1",
          "1",
          "2",
          "4",
          "6",
          "8",
          "2",
          "5",
          "7",
          "1",
          "3",
        ],
        [
          1.241, 8.6084369, 0.712132034, 0.712132034, 0.673205081, 0.587119148, 0.45, 0.342170174,
          0.326794919, 0.412880852, 0.55, 0.657829826, 0.673205081, 0.6, 0.631947922, 0.58660254,
          0.490526565, 0.4, 0.368052078, 0.41339746, 0.509473435, 0.6,
        ],
        [
          ["VennDiagram", "gList", "4", "polygon", "polygon", "text", "text"],
          [
            "VennDiagram",
            "gList",
            "9",
            "polygon",
            "polygon",
            "polygon",
            "polygon",
            "text",
            "text",
            "text",
            "text",
            "text",
          ],
          [
            "VennDiagram",
            "gList",
            "16",
            "polygon",
            "polygon",
            "polygon",
            "polygon",
            "polygon",
            "polygon",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
          ],
          [
            "VennDiagram",
            "gList",
            "15",
            "polygon",
            "polygon",
            "polygon",
            "polygon",
            "polygon",
            "polygon",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
          ],
        ],
        ["polygon", "grob", "gDesc", "x", "y", "id", "id.lengths", "name", "gp", "vp", "params"],
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public httpcode 0.3.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["httpcode"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "httpcode");
    expect(artifact).toMatchObject({
      package: { name: "httpcode", version: "0.3.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "37d84badc02d8edaeb7805c47705c5f2a51d3a051cfa1fab14e6528a6e2db77d",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("httpcode")
          exports <- sort(getNamespaceExports("httpcode"))
          formal.names <- unlist(lapply(
            exports, function(name) names(formals(getExportedValue("httpcode", name)))
          ), use.names = FALSE)
          ok <- http_code(200)
          found <- http_search("not found")
          invalid <- tryCatch(http_code(999), error = conditionMessage)
          vector.error <- tryCatch(http_code(c(200, 404)), error = conditionMessage)
          c(
            exports, formal.names, class(ok),
            as.character(unlist(unclass(ok), use.names = FALSE)),
            vapply(found, function(value) value$status_code, ""),
            invalid, vector.error,
            cat_for_status(404, browse = FALSE), dog_for_status(404, browse = FALSE)
          )
        `),
      ).resolves.toEqual([
        "cat_for_status",
        "dog_for_status",
        "http_code",
        "http_search",
        "code",
        "browse",
        "code",
        "browse",
        "code",
        "verbose",
        "text",
        "verbose",
        "http_code",
        "200",
        "OK",
        "Request fulfilled, document follows",
        "403",
        "404",
        "410",
        "No description found for code: 999\n",
        "length(code) == 1 is not TRUE",
        "https://http.cat/404",
        "https://httpstatusdogs.com/wp-content/uploads/404.jpg",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public shades 1.5.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["shades"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "shades");
    expect(artifact).toMatchObject({
      package: { name: "shades", version: "1.5.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "3e67f4610e761b2b5049b807baf08a332f425922e57885f7978e79e4e3114e88",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("shades")
          sort(getNamespaceExports("shades"))
        `),
      ).resolves.toEqual([
        "%.)%",
        "%_/%",
        "addmix",
        "brightness",
        "chroma",
        "complement",
        "contrast",
        "coords",
        "delta",
        "dichromat",
        "distance",
        "expect_equal_shades",
        "gradient",
        "hue",
        "lightness",
        "luminance",
        "opacity",
        "recycle",
        "saturation",
        "scalefac",
        "shade",
        "shades",
        "space",
        "submix",
        "swatch",
        "warp",
      ]);
      await expect(
        runtime.eval(`
          s <- shade(c(primary = "red", leaf = "green", ocean = "#0000FF80"))
          s2 <- s
          s2[2] <- "pink"
          c(
            unname(as.character(s)), names(s), class(s), space(s),
            unname(as.character(s2)), unname(as.character(c(s[1], "white"))),
            unname(as.character(gradient(c("red", "blue"), 5))),
            unname(as.character(gradient(c("red", "blue"), 5, space = "Lab"))),
            unname(as.character(saturation(c("red", "green"), recycle(0.4, 0.6)))),
            space(warp("red", "HSV"))
          )
        `),
      ).resolves.toEqual([
        "#FF0000FF",
        "#00FF00FF",
        "#0000FF80",
        "primary",
        "leaf",
        "ocean",
        "shade",
        "sRGB",
        "#FF0000FF",
        "#FFC0CBFF",
        "#0000FF80",
        "#FF0000FF",
        "#FFFFFF",
        "#FF0000",
        "#BF0040",
        "#800080",
        "#4000BF",
        "#0000FF",
        "#FF0000",
        "#E80050",
        "#C90089",
        "#9A00C3",
        "#0000FF",
        "#FF9999",
        "#66FF66",
        "HSV",
      ]);
      await expect(
        runtime.eval(`
          s <- shade(c("red", "green", "#0000FF80"))
          round(c(
            unname(coords(s)), opacity(s), unname(coords(warp("red", "HSV"))),
            contrast(c("black", "white", "red"), "white"),
            distance(c("red", "green", "blue"), "red")
          ), 8)
        `),
      ).resolves.toEqual([
        1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0.50196078, 0, 1, 1, 21, 1, 3.96340824, 0, 86.5238546,
        53.07649384,
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public relimp 1.0-5 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["relimp"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "relimp");
    expect(artifact).toMatchObject({
      package: { name: "relimp", version: "1.0-5" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "9384901bcd3072a55a52f4c94ad3cf0f8662b4aebd523d37ac879377ea06a894",
      },
    });
    try {
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
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("relimp")
          sort(getNamespaceExports("relimp"))
        `),
      ).resolves.toEqual(["R.to.Tcl", "Tcl.to.R", "pickFrom", "relimp", "relrelimp", "showData"]);
      await expect(
        runtime.eval(`
          d <- data.frame(
            y = c(1, 3, 2, 5, 7, 8, 7, 10),
            x1 = c(0, 1, 0, 2, 3, 3, 4, 5),
            x2 = c(1, 0, 2, 1, 2, 4, 3, 5),
            x3 = c(0, 1, 1, 0, 1, 0, 2, 2)
          )
          fit <- lm(y ~ x1 + x2 + x3, d)
          one <- relimp(fit, 2, 3, label1 = "first", label2 = "second")
          grouped <- relimp(fit, 2, 3:4, label1 = "first", label2 = "others")
          c(
            class(one), names(one), unlist(one$sets),
            round(one$log.ratio, 12), round(one$se.log.ratio, 12),
            unlist(grouped$sets), round(grouped$log.ratio, 12),
            round(grouped$se.log.ratio, 12)
          )
        `),
      ).resolves.toEqual([
        "relimp",
        "model",
        "response.category",
        "dispersion",
        "sets",
        "log.ratio",
        "se.log.ratio",
        "x1",
        "x2",
        "1.678651956979",
        "0.912595798347",
        "x1",
        "x2",
        "x3",
        "1.640653520622",
        "0.58971737634",
      ]);
      await expect(
        runtime.eval(`
          c(
            R.to.Tcl(c("apple", "two words", "")),
            Tcl.to.R("{apple} {two words} {}")
          )
        `),
      ).resolves.toEqual(["{apple} {two words} {}", "apple", "two words"]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public codetools 0.2-20 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["codetools"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "codetools",
    );
    expect(artifact).toMatchObject({
      package: { name: "codetools", version: "0.2-20" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "8ae46174e686b5083d2d034caaf26f59beab0e3b69990cfc52f7a5302580794e",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library("codetools")
          c(names(formals(checkUsage)), findFuncLocals(formals(checkUsage), body(checkUsage)))
        `),
      ).resolves.toEqual([
        "fun",
        "name",
        "report",
        "all",
        "suppressLocal",
        "suppressParamAssigns",
        "suppressParamUnused",
        "suppressFundefMismatch",
        "suppressLocalUnused",
        "suppressNoLocalFun",
        "skipWith",
        "suppressUndefined",
        "suppressPartialMatchArgs",
        "oldOpts",
      ]);
      await expect(
        runtime.eval(`
          capture.output(checkUsage(checkUsage))
        `),
      ).resolves.toEqual([]);
      await expect(
        runtime.eval(`
          e0 <- quote(break)
          e1 <- quote(f())
          e2 <- quote(f(a))
          c(is.null(e0[-1]), is.null(e1[-1]), length(e2[-1]), deparse(e2[-1]))
        `),
      ).resolves.toEqual(["TRUE", "TRUE", "1", "a()"]);
      await expect(
        runtime.eval(`
          c(
            callCC(function(exit) 1 + exit(42)),
            getFromNamespace("constantFoldEnv", "codetools")(quote(TRUE)),
            is.null(getFromNamespace("constantFoldEnv", "codetools")(quote(unknown)))
          )
        `),
      ).resolves.toEqual([42, 1, 1]);
      await expect(
        runtime.eval(`
          flattened <- flattenAssignment(quote(f(x, 1)))
          expected <- list(list(quote(x)), list(quote("f<-"(x, 1, value = \`*tmpv*\`))))
          matched_bquote <- match.call(base::bquote, quote(bquote(.(s) * y)))
          c(
            identical(flattened, expected),
            identical(names(matched_bquote), c("", "expr")),
            length(capture.output(checkUsage(function() { s <- as.symbol("y"); bquote(.(s) * y) })))
          )
        `),
      ).resolves.toEqual([1, 1, 0]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("codetools")
          sort(getNamespaceExports("codetools"))
        `),
      ).resolves.toEqual([
        "checkUsage",
        "checkUsageEnv",
        "checkUsagePackage",
        "collectLocals",
        "collectUsage",
        "constantFold",
        "findFuncLocals",
        "findGlobals",
        "findLocals",
        "findLocalsList",
        "flattenAssignment",
        "getAssignedVar",
        "isConstantValue",
        "makeCodeWalker",
        "makeConstantFolder",
        "makeLocalsCollector",
        "makeUsageCollector",
        "showTree",
        "walkCode",
      ]);
      await expect(
        runtime.eval(`
          global_value <- 10
          helper <- function(v) v * 2
          f <- function(x, y = 2) {
            z <- x + y
            helper(z) + global_value
          }
          globals <- findGlobals(f, merge = FALSE)
          expression <- quote({
            a <- 1
            b <- a + external
            c <<- b
            for (i in seq_len(n)) d <- i
          })
          c(
            globals$functions, globals$variables, findGlobals(f, merge = TRUE),
            findFuncLocals(formals(f), body(f)), sort(findLocals(expression)),
            getAssignedVar(quote(x <- 1)), getAssignedVar(quote(obj$field[[i]] <- value)),
            capture.output(showTree(quote(f(a + b, x <- 2))))
          )
        `),
      ).resolves.toEqual([
        "+",
        "<-",
        "helper",
        "{",
        "global_value",
        "+",
        "<-",
        "global_value",
        "helper",
        "{",
        "z",
        "a",
        "b",
        "d",
        "i",
        "x",
        "obj",
        "(f (+ a b) (<- x 2))",
      ]);
      await expect(
        runtime.eval(`
          bad <- function(x, unused) {
            local <- 1
            x + missing_global
          }
          capture.output(checkUsage(bad, name = "bad"))
        `),
      ).resolves.toEqual([
        "bad: no visible binding for global variable 'missing_global'",
        "bad: local variable 'local' assigned but may not be used",
      ]);
      await expect(
        runtime.eval(`
          c(
            isConstantValue(NULL), isConstantValue(NA), isConstantValue(quote(x)),
            isConstantValue(quote(1L)), isConstantValue(pairlist(a = 1))
          )
        `),
      ).resolves.toEqual([true, true, false, true, false]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public stinepack 1.5 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["stinepack"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "stinepack",
    );
    expect(artifact).toMatchObject({
      package: { name: "stinepack", version: "1.5" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "9c23ae1de366e04d575ac4954d08d540b51e646ef2f19ac29cb50b17818d33bc",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library("stinepack")
          sort(getNamespaceExports("stinepack"))
        `),
      ).resolves.toEqual([
        "na.stinterp",
        "na.stinterp.default",
        "parabolaSlopes",
        "stinemanSlopes",
        "stinterp",
      ]);
      await expect(
        runtime.eval(`
          c(
            names(formals(na.stinterp)),
            names(formals(na.stinterp.default)),
            names(formals(parabolaSlopes)),
            names(formals(stinemanSlopes)),
            names(formals(stinterp))
          )
        `),
      ).resolves.toEqual([
        "object",
        "...",
        "object",
        "along",
        "na.rm",
        "...",
        "x",
        "y",
        "x",
        "y",
        "scale",
        "x",
        "y",
        "xout",
        "yp",
        "method",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("stinepack")
          p <- parabolaSlopes(c(0, 1, 2, 4), c(0, 1, 4, 16))
          s <- stinemanSlopes(c(0, 1, 2, 4), c(0, 1, 4, 16))
          a <- stinterp(c(0, 1, 2, 4), c(0, 1, 4, 16),
                        xout = c(-1, .5, 1.5, 3, 5))
          b <- stinterp(c(0, 1, 2, 4), c(0, 1, 4, 16),
                        xout = c(-1, .5, 1.5, 3, 5), method = "parabola")
          c(p, s, a$x, a$y, b$y)
        `),
      ).resolves.toEqual([
        0,
        2,
        4,
        8,
        0.75,
        1.3333333333333333,
        3.357142857142857,
        8.642857142857142,
        -1,
        0.5,
        1.5,
        3,
        5,
        NA,
        0.3559322033898305,
        2.3046875,
        8.790697674418604,
        NA,
        NA,
        0.25,
        2.25,
        9,
        NA,
      ]);
      await expect(
        runtime.eval(`
          z <- structure(c(1, NA, 3), class = "stine-probe")
          out <- na.stinterp(z, along = 1:3)
          c(unclass(out), class(out))
        `),
      ).resolves.toEqual(["1", "2", "3", "stine-probe"]);
      await expect(
        runtime.eval("stinterp(c(0, 0, 1), c(1, 2, 3), xout = .5)"),
      ).rejects.toMatchObject({ message: "The values of x must strictly increasing" });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public qvcalc 1.0.4 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["qvcalc"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "qvcalc");
    expect(artifact).toMatchObject({
      package: { name: "qvcalc", version: "1.0.4" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "34400402c98126098ef2f914d55f5946fbd9d0ea24a7d91489ff603e97cb2146",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library("qvcalc")
          sort(getNamespaceExports("qvcalc"))
        `),
      ).resolves.toEqual([
        "indentPrint",
        "qvcalc",
        "qvcalc.coxph",
        "qvcalc.default",
        "qvcalc.itempar",
        "qvcalc.lm",
        "qvcalc.survreg",
        "worstErrors",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("qvcalc")
          d <- data.frame(
            y = c(1, 2, 3, 4, 6, 8, 2, 5, 7),
            g = factor(rep(c("a", "b", "c"), each = 3))
          )
          q <- qvcalc(lm(y ~ g, d), "g")
          c(
            class(q), names(q), row.names(q$qvframe),
            round(unclass(q$qvframe$estimate), 12), round(q$qvframe$SE, 12),
            round(q$qvframe$quasiSE, 12), round(q$qvframe$quasiVar, 12),
            names(q$relerrs), round(q$relerrs, 12)
          )
        `),
      ).resolves.toEqual([
        "qv",
        "covmat",
        "qvframe",
        "dispersion",
        "relerrs",
        "factorname",
        "coef.indices",
        "modelcall",
        "a",
        "b",
        "c",
        "0",
        "4",
        "2.666666666667",
        "0",
        "1.586984095232",
        "1.586984095232",
        "1.122167215374",
        "1.122167215374",
        "1.122167215374",
        "1.259259259259",
        "1.259259259259",
        "1.259259259259",
        "a,b",
        "a,c",
        "b,c",
        "0",
        "0",
        "0",
      ]);
      await expect(runtime.eval("qvcalc(matrix(1, 2, 3))")).rejects.toMatchObject({
        message: "qvcalc works only for factors with 3 or more levels",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public aod 1.3.3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["aod"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "aod");
    expect(artifact).toMatchObject({
      package: { name: "aod", version: "1.3.3" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "a5b3429016dd237589f80a64ade844ce1ae3c2e659ec7e4cceb9a9cf03403900",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          library("aod")
          sort(getNamespaceExports("aod"))
        `),
      ).resolves.toEqual([
        ".__C__aic",
        ".__C__anova.glimML",
        ".__C__drs",
        ".__C__geeglm",
        ".__C__geese",
        ".__C__glimML",
        ".__C__glimQL",
        ".__C__iccbin",
        ".__C__summary.glimML",
        ".__C__varbin",
        ".__T__$:base",
        ".__T__$<-:base",
        ".__T__AIC:stats",
        ".__T__[:base",
        ".__T__[<-:base",
        ".__T__[[<-:base",
        ".__T__anova:stats",
        ".__T__coef:stats",
        ".__T__deviance:stats",
        ".__T__df.residual:stats",
        ".__T__fitted:stats",
        ".__T__logLik:stats",
        ".__T__predict:stats",
        ".__T__residuals:stats",
        ".__T__summary:base",
        ".__T__vcov:stats",
        "AIC",
        "anova",
        "betabin",
        "coef",
        "deviance",
        "df.residual",
        "donner",
        "fitted",
        "iccbin",
        "invlink",
        "link",
        "logLik",
        "negbin",
        "predict",
        "print.wald.test",
        "quasibin",
        "quasipois",
        "raoscott",
        "residuals",
        "splitbin",
        "summary",
        "varbin",
        "vcov",
        "wald.test",
      ]);

      await runtime.reset();
      await runtime.eval('library("aod"); data(orob2)');
      await runtime.eval("fm1 <- betabin(cbind(y, n - y) ~ seed, ~ 1, data = orob2); NULL");
      await runtime.eval("fm2 <- betabin(cbind(y, n - y) ~ seed + root, ~ 1, data = orob2); NULL");
      await runtime.eval("anova(fm1, fm2)");
      await runtime.eval(
        "fm3 <- betabin(cbind(y, n - y) ~ seed * root, ~ 1, data = orob2); New <- expand.grid(seed = levels(orob2$seed), root = levels(orob2$root)); NULL",
      );
      await runtime.eval("data(dja); d1 <- betabin(cbind(y, n - y) ~ group, ~ 1, dja); NULL");
      await runtime.eval(
        "d2 <- betabin(cbind(y, n - y) ~ group, ~ group, dja, control = list(maxit = 1000)); NULL",
      );
      await runtime.eval(
        "data(rats); donner(formula = cbind(y, n - y) ~ group, data = rats); NULL",
      );

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();

      await runtime.reset();
      await expect(
        runtime.eval(`
          library("aod")
          c(
            round(link(c(.1, .5, .9), "logit"), 12),
            round(link(c(.1, .5, .9), "cloglog"), 12),
            round(link(c(1, 2, 4), "log"), 12),
            round(invlink(c(-2, 0, 2), "logit"), 12)
          )
        `),
      ).resolves.toEqual([
        -2.197224577336, 0, 2.197224577336, -2.250367327312, -0.366512920582, 0.834032445248, 0,
        0.69314718056, 1.38629436112, 0.119202922022, 0.5, 0.880797077978,
      ]);
      await expect(
        runtime.eval(`
          w <- wald.test(
            Sigma = matrix(c(2, .5, .5, 1), 2),
            b = c(1, -2),
            Terms = 1:2
          )
          c(class(w), names(w), round(unname(w$result$chi2), 12))
        `),
      ).resolves.toEqual([
        "wald.test",
        "Sigma",
        "b",
        "Terms",
        "H0",
        "L",
        "result",
        "verbose",
        "df",
        "6.285714285714",
        "2",
        "0.043159309261",
      ]);
      await expect(
        runtime.eval(`
          d <- data.frame(y = c(2, 3, 7, 9, 12, 18), dose = c(0, 0, 1, 1, 2, 2))
          q <- quasipois(y ~ dose, data = d, phi = .1)
          c(
            class(q), slotNames(q), q@phi, class(q@fm),
            round(unname(coef(q)), 12), round(unname(fitted(q)), 12),
            round(unname(residuals(q)), 12), round(q@fm$deviance, 12),
            df.residual(q), round(unname(vcov(q)), 12)
          )
        `),
      ).resolves.toEqual([
        "glimQL",
        "CALL",
        "fm",
        "phi",
        "0.1",
        "glm",
        "lm",
        "1.080222091754",
        "0.84275423152",
        "2.945333612739",
        "2.945333612739",
        "6.841290088456",
        "6.841290088456",
        "15.890644737825",
        "15.890644737825",
        "-0.48412753966",
        "0.027995940491",
        "0.046757077295",
        "0.635971409788",
        "-0.60657322621",
        "0.328860256543",
        "1.140936694136",
        "4",
        "0.158903279086",
        "-0.090731437213",
        "-0.090731437213",
        "0.069280859646",
      ]);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public trust 0.1-9 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["trust"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "trust");
    expect(artifact).toMatchObject({
      package: { name: "trust", version: "0.1-9" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "303df0c340588d989a4e5a71d496a5535466fea3a17007c0546c2dc323649053",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("trust", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval('library("trust"); as.character(packageVersion("trust"))'),
      ).resolves.toBe("0.1.9");

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
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
          value: "6912fcb92677a3393af6484a98ed1acb8c9de4b2b0f9243d8aa869d1df131d0d",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "find_root",
        "find_root_file",
        "root_criterion",
        "rprojroot-package",
        "thisfile",
      ]);
      expect(
        examples.topics.every((topic) => topic.blocks.some((block) => block.kind === "run")),
      ).toBe(true);
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
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "rprojroot", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`rprojroot example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
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
          value: "a2a8d501e898d81bfe2e72a5640187fc2163787ed527f481feb416ea99086392",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "askForPassword",
        "callFun",
        "findOAuthIntegration",
        "getDelegatedAzureToken",
        "getOAuthCredentials",
        "getOAuthIntegration",
        "getOAuthIntegrations",
        "hasColorConsole",
        "hasFun",
        "highlightUi",
        "isAvailable",
        "previewRd",
        "readRStudioPreference",
        "registerCommandCallback",
        "registerCommandStreamCallback",
        "sendToConsole",
        "showDialog",
        "showEditSuggestion",
        "terminalActivate",
        "terminalBusy",
        "terminalClear",
        "terminalContext",
        "terminalCreate",
        "terminalExecute",
        "terminalRunning",
        "terminalSend",
        "versionInfo",
        "viewer",
        "writeRStudioPreference",
      ]);
      expect(
        examples.topics.every((topic) => topic.blocks.some((block) => block.kind === "run")),
      ).toBe(true);
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
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "rstudioapi", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`rstudioapi example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
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
          value: "f333f4289bbd09d9108bea7f5d13c0f1c53cb545057a893a93596d376ed7d4c7",
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
          value: "1fc0026adf5806cf1753f3c781beee252833bda043eb7ef3712484da53a9867c",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual(["re_match"]);
      expect(
        examples.topics.every((topic) => topic.blocks.some((block) => block.kind === "run")),
      ).toBe(true);
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
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "rematch", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`rematch example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
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
          value: "34510070bdbf7e2feb1fc23d88a82cff6c68625a18f48a3d3eedf898e1049c44",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "iteratelist",
        "rowSplit",
        "whisker-package",
        "whisker.render",
      ]);
      expect(
        examples.topics.every((topic) => topic.blocks.some((block) => block.kind === "run")),
      ).toBe(true);
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
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "whisker", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`whisker example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public zeallot 0.2.0 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["zeallot"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "zeallot", version: "0.2.0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "ea726c2e4018c9d32db69caaa3f894b5ff82a495f7110a018a003b01dc233b3d",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "destructure",
        "operator",
        "zeallous",
      ]);
      expect(
        examples.topics.every((topic) => topic.blocks.some((block) => block.kind === "run")),
      ).toBe(true);
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
      await expect(runtime.eval('requireNamespace("zeallot", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("zeallot"))')).resolves.toBe("0.2.0");
      await expect(runtime.eval('sort(getNamespaceExports("zeallot"))')).resolves.toEqual([
        "%->%",
        "%<-%",
        "destructure",
        "zeallous",
      ]);
      await expect(
        runtime.eval(`
          library(zeallot)
          c(first, second) %<-% list(1, 2)
          c(first, second, "package:zeallot" %in% search())
        `),
      ).resolves.toEqual([1, 2, 1]);
      await expect(
        runtime.eval(`
          c(head, c(middle, tail)) %<-% list("a", list("b", "c"))
          c(head, middle, tail)
        `),
      ).resolves.toEqual(["a", "b", "c"]);
      await expect(
        runtime.eval(`
          c(first, ..rest) %<-% as.list(1:4)
          c(first, unlist(rest))
        `),
      ).resolves.toEqual([1, 2, 3, 4]);
      await expect(
        runtime.eval(`
          c(alpha, ., omega) %<-% list(1, 2, 3)
          c(required, fallback = "default") %<-% list("set")
          c(second=) %<-% list(first = 1, second = 2, third = 3)
          c(alpha, omega, required, fallback, second)
        `),
      ).resolves.toEqual(["1", "3", "set", "default", "2"]);
      await expect(
        runtime.eval(`
          list(1, 2, "a", "b") %->% c(x, y, ..z)
          shape <- function(sides = 4, color = "red") {
            structure(list(sides = sides, color = color), class = "shape")
          }
          destructure.shape <- function(x) unclass(x)
          c(sides, color) %<-% shape(3, "green")
          c(x, y, unlist(z), sides, color)
        `),
      ).resolves.toEqual(["1", "2", "a", "b", "3", "green"]);
      await expect(
        runtime.eval(`
          c(numbers, letters) %<-% data.frame(
            numbers = 1:2, letters = c("a", "b"), stringsAsFactors = FALSE
          )
          c(numbers, letters)
        `),
      ).resolves.toEqual(["1", "2", "a", "b"]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "zeallot", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`zeallot example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public ini 0.3.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["ini"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "ini", version: "0.3.1" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "1405d05cd658168f5c2d03c2056dbb1a3c95e91a2e714aa121da552802e42b53",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual(["read.ini", "write.ini"]);
      expect(
        examples.topics.every((topic) => topic.blocks.some((block) => block.kind === "run")),
      ).toBe(true);
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
      await expect(runtime.eval('requireNamespace("ini", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("ini"))')).resolves.toBe("0.3.1");
      await expect(runtime.eval('sort(getNamespaceExports("ini"))')).resolves.toEqual([
        "read.ini",
        "write.ini",
      ]);
      await expect(
        runtime.eval(`
          writeLines(c(
            "; comment", "[  Hello World]", " Foo = Bar ", "Foo1=Bar=345", "",
            "[second]", "answer=42", "empty="
          ), "input.ini")
          parsed <- ini::read.ini("input.ini")
          c(names(parsed), names(parsed[[1]]), unname(unlist(parsed)))
        `),
      ).resolves.toEqual(["Hello World", "second", "Foo", "Foo1", "Bar", "Bar=345", "42"]);
      await expect(
        runtime.eval(`
          parsed <- list(
            "Hello World" = list(Foo = "Bar", Foo1 = "Bar=345"),
            second = list(answer = "42", empty = "")
          )
          returned <- ini::write.ini(parsed, "output.ini")
          c(is.null(returned), readLines("output.ini"))
        `),
      ).resolves.toEqual([
        "TRUE",
        "[Hello World]",
        "Foo=Bar",
        "Foo1=Bar=345",
        "",
        "[second]",
        "answer=42",
        "empty=",
        "",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "ini", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`ini example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public cpp11 0.5.5 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["cpp11"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "cpp11", version: "0.5.5" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "c99886e246d5835743367f7a0e5e49145dec47c5ef62b946c6fbb38fafbca5bb",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "cpp_register",
        "cpp_source",
        "cpp_vendor",
      ]);
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
      await expect(runtime.eval('requireNamespace("cpp11", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("cpp11"))')).resolves.toBe("0.5.5");
      await expect(runtime.eval('sort(getNamespaceExports("cpp11"))')).resolves.toEqual([
        "cpp_eval",
        "cpp_function",
        "cpp_register",
        "cpp_source",
        "cpp_vendor",
      ]);
      await expect(
        runtime.eval(`
          dir.create("vendor-target")
          copied <- cpp11::cpp_vendor("vendor-target")
          c(
            copied,
            length(list.files("vendor-target", recursive = TRUE)),
            file.exists(file.path(dirname(copied), "cpp11.hpp"))
          )
        `),
      ).resolves.toEqual(["vendor-target/inst/include/cpp11", "24", "TRUE"]);
      await expect(
        runtime.evalDetailed(
          'utils::example("cpp_register", package = "cpp11", echo = FALSE); invisible(NULL)',
        ),
      ).rejects.toMatchObject({
        code: "NRE2300",
        message:
          "The brio, cli, decor, desc, glue, tibble,\nvctrs package(s) are required for this functionality",
      });
      await runtime.reset();
      await expect(
        runtime.evalDetailed(
          'utils::example("cpp_source", package = "cpp11", echo = FALSE); invisible(NULL)',
        ),
      ).rejects.toMatchObject({
        code: "NRE2300",
        message:
          "The brio, callr, cli, decor, desc, glue package(s) are required for this functionality",
      });
      await runtime.reset();
      await runtime.evalDetailed(
        'utils::example("cpp_vendor", package = "cpp11", echo = FALSE); invisible(NULL)',
      );
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs, loads, and exercises the unchanged public otel 0.2.0 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["otel"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "otel", version: "0.2.0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "623815dfb55441a7fa85a7965a096a55dfaebca7b50f7df77c9ec43ca83ab7b0",
        },
      });
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "as_attributes",
        "counter_add",
        "default_tracer_name",
        "end_span",
        "Environment Variables",
        "extract_http_context",
        "gauge_record",
        "get_active_span",
        "get_active_span_context",
        "get_default_logger_provider",
        "get_default_meter_provider",
        "get_default_tracer_provider",
        "get_logger",
        "get_meter",
        "get_tracer",
        "Getting Started",
        "histogram_record",
        "is_logging_enabled",
        "is_measuring_enabled",
        "is_tracing_enabled",
        "local_active_span",
        "log",
        "log_severity_levels",
        "logger_provider_noop",
        "meter_provider_noop",
        "otel_counter",
        "otel_gauge",
        "otel_histogram",
        "otel_logger",
        "otel_logger_provider",
        "otel_meter",
        "otel_meter_provider",
        "otel_span",
        "otel_span_context",
        "otel_tracer",
        "otel_tracer_provider",
        "otel_up_down_counter",
        "pack_http_context",
        "start_local_active_span",
        "start_span",
        "tracer_provider_noop",
        "tracing-constants",
        "up_down_counter_add",
        "with_active_span",
        "Zero Code Instrumentation",
      ]);
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
      await expect(runtime.eval('requireNamespace("otel", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("otel"))')).resolves.toBe("0.2.0");
      await expect(runtime.eval('length(getNamespaceExports("otel"))')).resolves.toBe(39);
      await expect(
        runtime.eval(`
          c(
            class(otel::get_default_tracer_provider()),
            class(otel::get_tracer("probe")),
            class(otel::start_span("work")),
            class(otel::get_active_span_context())
          )
        `),
      ).resolves.toEqual([
        "otel_tracer_provider_noop",
        "otel_tracer_provider",
        "otel_tracer_noop",
        "otel_tracer",
        "otel_span_noop",
        "otel_span",
        "otel_span_context_noop",
        "otel_span_context",
      ]);
      await expect(
        runtime.eval(`c(
          tracing = otel::is_tracing_enabled(),
          measuring = otel::is_measuring_enabled(),
          logging = otel::is_logging_enabled()
        )`),
      ).resolves.toEqual([false, false, false]);
      await expect(
        runtime.eval(`
          tracer_name <- otel::default_tracer_name("custom")
          attrs <- otel::as_attributes(list(a = 1L, b = TRUE, c = "x"))
          c(unlist(tracer_name), unlist(attrs))
        `),
      ).resolves.toEqual(["custom", NA, "TRUE", "1", "TRUE", "x"]);
      await expect(runtime.eval("otel::pack_http_context()")).resolves.toEqual([]);
      await expect(
        runtime.eval(`c(
          class(otel::counter_add("requests", 1)),
          class(otel::gauge_record("load", 2)),
          class(otel::histogram_record("latency", 3)),
          class(otel::up_down_counter_add("queue", -1)),
          class(otel::log_info("hello"))
        )`),
      ).resolves.toEqual([
        "otel_counter_noop",
        "otel_counter",
        "otel_gauge_noop",
        "otel_gauge",
        "otel_histogram_noop",
        "otel_histogram",
        "otel_up_down_counter_noop",
        "otel_up_down_counter",
        "otel_logger_noop",
        "otel_logger",
      ]);
      await expect(
        runtime.eval(`
          span <- otel::start_span("work", attributes = list(a = 1L))
          context <- span$get_context()
          returned <- c(
            identical(span$set_attribute("b", 2L), span),
            identical(span$add_event("event", list(c = 3L)), span),
            identical(span$set_status("ok"), span),
            identical(span$update_name("renamed"), span),
            identical(otel::end_span(span), span)
          )
          c(
            span$is_valid(), span$is_recording(), returned,
            class(context), class(otel::extract_http_context(character()))
          )
        `),
      ).resolves.toEqual([
        "FALSE",
        "FALSE",
        "TRUE",
        "TRUE",
        "TRUE",
        "TRUE",
        "TRUE",
        "otel_span_context_noop",
        "otel_span_context",
        "otel_span_context_noop",
        "otel_span_context",
      ]);
      await expect(
        runtime.eval(`c(
          unname(otel::span_kinds), unname(otel::span_status_codes),
          otel::invalid_span_id, otel::invalid_trace_id
        )`),
      ).resolves.toEqual([
        "internal",
        "server",
        "client",
        "producer",
        "consumer",
        "unset",
        "ok",
        "error",
        "0000000000000000",
        "00000000000000000000000000000000",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "otel", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          throw new Error(`otel example ${topic.name} failed`, { cause: error });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  120_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind public docopt 0.7.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["docopt"]);
      const artifact = installed.artifacts[0];
      expect(artifact).toMatchObject({
        package: { name: "docopt", version: "0.7.2", license: "MIT + file LICENSE" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "983b23f95cdc6db681668f7f80005829a13e0769ef635705708e82a342b8d93e",
        },
      });
      expect(installed.lock.packages).toEqual([
        {
          name: "docopt",
          version: "0.7.2",
          integrity: "sha256-983b23f95cdc6db681668f7f80005829a13e0769ef635705708e82a342b8d93e",
          dependencies: [],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("docopt", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(docopt); "package:docopt" %in% search()')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('sort(getNamespaceExports("docopt"))')).resolves.toBe("docopt");
      await expect(
        runtime.eval(`
          doc <- "Usage: my_program.R [-hso FILE] [--quiet | --verbose] [INPUT ...]\n\n-h --help    show this\n-s --sorted  sorted output\n-o FILE      specify output file [default: ./test.txt]\n--quiet      print less text\n--verbose    print more text"
          parsed <- docopt::docopt(doc, "-s --quiet")
          c(
            class(parsed),
            names(parsed),
            unlist(parsed),
            names(formals(docopt::docopt))
          )
        `),
      ).resolves.toEqual([
        "docopt",
        "list",
        "--help",
        "--sorted",
        "-o",
        "--quiet",
        "--verbose",
        "INPUT",
        "help",
        "sorted",
        "o",
        "quiet",
        "verbose",
        "FALSE",
        "TRUE",
        "./test.txt",
        "TRUE",
        "FALSE",
        "FALSE",
        "TRUE",
        "./test.txt",
        "TRUE",
        "FALSE",
        "doc",
        "args",
        "name",
        "help",
        "version",
        "strict",
        "strip_names",
        "quoted_args",
      ]);
      await expect(
        runtime.evalDetailed('utils::example("docopt", package = "docopt", echo = FALSE)'),
      ).resolves.toMatchObject({ warnings: [] });
    } finally {
      await runtime?.dispose();
    }
  },
  30_000,
);

it.runIf(runExternal)(
  "packs and loads the unchanged public BH 1.90.0-1 header package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["BH"]);
      const artifact = installed.artifacts[0];
      expect(artifact?.package).toEqual({
        name: "BH",
        version: "1.90.0-1",
        license: "BSL-1.0",
      });
      expect(artifact).toMatchObject({
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "3f70ea3572c3e20f712697d6d9fa2544dc72216d97a06d5f11c0af844d893fb8",
        },
      });
      expect(artifact?.bundle.resources).toHaveLength(12_557);
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
      await expect(runtime.eval('requireNamespace("BH", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("BH"))')).resolves.toBe("1.90.0.1");
      await expect(runtime.eval('length(getNamespaceExports("BH"))')).resolves.toBe(0);
      await expect(
        runtime.eval(`
          include <- system.file("include", package = "BH")
          files <- list.files(include, recursive = TRUE, full.names = TRUE)
          info <- file.info(files)
          c(
            dir.exists(include),
            file.exists(file.path(include, "boost", "version.hpp")),
            length(files),
            sum(info$size)
          )
        `),
      ).resolves.toEqual([1, 1, 12_554, 128_040_580]);
      await expect(runtime.eval('library(BH); "package:BH" %in% search()')).resolves.toBe(true);
    } finally {
      await runtime?.dispose();
    }
  },
  240_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind public getopt 1.21.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["getopt"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "getopt", version: "1.21.1", license: "GPL (>= 2)" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "37e25406c7e5137657290b46a9f438b377f36930b2efa78e3591bffad07b557b",
        },
      });
      expect(installed.lock.packages).toEqual([
        {
          name: "getopt",
          version: "1.21.1",
          integrity: "sha256-37e25406c7e5137657290b46a9f438b377f36930b2efa78e3591bffad07b557b",
          dependencies: [],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("getopt", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval(`
          library(getopt)
          exports <- getNamespaceExports("getopt")
          c(
            "package:getopt" %in% search(),
            length(exports) == 6L,
            all(c(
              "get_Rscript_filename", "getfile", "getoperand",
              "getopt", "getusage", "sort_list"
            ) %in% exports)
          )
        `),
      ).resolves.toEqual([true, true, true]);
      await expect(
        runtime.eval(`
          spec <- matrix(c(
            "verbose", "v", 0, "logical",
            "count", "c", 1, "integer",
            "mean", "m", 1, "double"
          ), byrow = TRUE, ncol = 4)
          opt <- getopt::getopt(
            spec,
            c("--verbose", "--count=3", "-m", "2.5", "--", "file1", "file2")
          )
          list(opt$verbose, opt$count, opt$mean, getopt::getoperand(opt))
        `),
      ).resolves.toEqual([true, 3, 2.5, ["file1", "file2"]]);
      await expect(runtime.eval("names(getopt::sort_list(list(b = 2, a = 1)))")).resolves.toEqual([
        "a",
        "b",
      ]);
      await expect(runtime.eval('getopt::getusage(spec, command = "myscript")')).resolves.toBe(
        "Usage: myscript [-[-verbose|v]] [-[-count|c] <integer>] [-[-mean|m] <double>]\n",
      );
      for (const topic of ["getoperand", "getusage", "sort_list", "getopt"]) {
        await expect(
          runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic)}, package = "getopt", echo = FALSE)`,
          ),
        ).resolves.toMatchObject({ warnings: [] });
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind public optparse 1.8.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["optparse"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "optparse", version: "1.8.2", license: "GPL (>= 2)" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "6d0ddbcc193eae67685c496a177621bdc2fe3b0a5f28c5094ac9527f2f321d64",
        },
      });
      expect(installed.lock.packages).toEqual([
        {
          name: "optparse",
          version: "1.8.2",
          integrity: "sha256-6d0ddbcc193eae67685c496a177621bdc2fe3b0a5f28c5094ac9527f2f321d64",
          dependencies: [],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("optparse", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library(optparse); "package:optparse" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          exports <- getNamespaceExports("optparse")
          all(c(
            "OptionParser", "OptionParserOption", "make_option", "add_option",
            "parse_args", "parse_args2", "print_help", "IndentedHelpFormatter",
            "TitledHelpFormatter", ".__C__OptionParser", ".__C__OptionParserOption"
          ) %in% exports)
        `),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          options <- list(
            make_option(c("-v", "--verbose"), action = "store_true", default = FALSE),
            make_option(c("-c", "--count"), type = "integer", default = 5L),
            make_option("--mean", type = "double", default = 0)
          )
          parser <- OptionParser(option_list = options, add_help_option = FALSE, prog = "myscript")
          parsed <- parse_args(
            parser,
            args = c("--verbose", "--count=3", "--mean", "2.5")
          )
          list(parsed$verbose, parsed$count, parsed$mean)
        `),
      ).resolves.toEqual([true, 3, 2.5]);
      await expect(
        runtime.eval(`
          parsed <- parse_args(
            parser,
            args = c("--count=4", "file1", "file2"),
            positional_arguments = TRUE
          )
          list(parsed$options$count, parsed$args)
        `),
      ).resolves.toEqual([4, ["file1", "file2"]]);
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "make_option",
        "IndentedHelpFormatter",
        "optparse-package",
        "parse_args",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "optparse", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`optparse example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind public argparser 0.7.3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["argparser"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: { name: "argparser", version: "0.7.3", license: "GPL (>= 3)" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "bc9564eff35a8ea0721c201d976bbf75682d20be07710a11ff2d2520f681490a",
        },
      });
      expect(installed.lock.packages).toEqual([
        {
          name: "argparser",
          version: "0.7.3",
          integrity: "sha256-bc9564eff35a8ea0721c201d976bbf75682d20be07710a11ff2d2520f681490a",
          dependencies: [],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("argparser", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library(argparser); "package:argparser" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          exports <- getNamespaceExports("argparser")
          sort(exports)
        `),
      ).resolves.toEqual([
        "add.argument",
        "add_argument",
        "arg.parser",
        "arg_parser",
        "include",
        "parse.args",
        "parse_args",
      ]);
      await expect(
        runtime.eval(`
          parser <- arg_parser("demo", name = "prog", hide.opts = TRUE)
          parser <- add_argument(parser, "input", help = "input file")
          parser <- add_argument(parser, "--count", help = "count", default = 2L)
          parser <- add_argument(parser, "--verbose", help = "verbose", flag = TRUE)
          parsed <- parse_args(parser, c("--verbose", "--count", "3", "file.txt"))
          list(parsed[[1]], parsed$help, parsed$verbose, parsed$count, parsed$input)
        `),
      ).resolves.toEqual([false, false, true, 3, "file.txt"]);
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "add_argument",
        "arg_parser",
        "parse_args",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "argparser", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`argparser example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind public iterators 1.0.14 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["iterators"]);
      expect(installed.artifacts[0]).toMatchObject({
        package: {
          name: "iterators",
          version: "1.0.14",
          license: "Apache License (== 2.0)",
        },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "04c78a0af14ab44ef400a8dfa75d2aaa560b0604ddd3dfcf9e2834b35b46806c",
        },
      });
      expect(installed.lock.packages).toEqual([
        {
          name: "iterators",
          version: "1.0.14",
          integrity: "sha256-04c78a0af14ab44ef400a8dfa75d2aaa560b0604ddd3dfcf9e2834b35b46806c",
          dependencies: [],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("iterators", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library(iterators); "package:iterators" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('sort(getNamespaceExports("iterators"))')).resolves.toEqual([
        "iapply",
        "icount",
        "icountn",
        "idiv",
        "irbinom",
        "iread.table",
        "ireadLines",
        "irnbinom",
        "irnorm",
        "irpois",
        "irunif",
        "isample",
        "isplit",
        "iter",
        "makeIwrapper",
        "nextElem",
      ]);
      await expect(
        runtime.eval(`
          iterator <- iter(setNames(1:3, c("a", "b", "c")))
          values <- as.list(iterator)
          exhausted <- tryCatch(nextElem(iterator), error = conditionMessage)
          chunks <- as.list(idiv(10, chunks = 3))
          list(values, exhausted, chunks)
        `),
      ).resolves.toEqual([[1, 2, 3], "StopIteration", [4, 3, 3]]);
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "iapply",
        "icount",
        "idiv",
        "ireadLines",
        "irnorm",
        "isplit",
        "iter",
        "makeIwrapper",
        "nextElem",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "iterators", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`iterators example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "installs and loads the source-blind public foreach 1.5.2 dependency closure",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["foreach"]);
      expect(
        installed.artifacts.map((artifact) => ({
          name: artifact.package.name,
          version: artifact.package.version,
          integrity: artifact.integrity.value,
          compatibility: artifact.compatibility,
        })),
      ).toEqual([
        {
          name: "codetools",
          version: "0.2-20",
          integrity: "f81ec9e456e415b994b2206fef5062c79e2b16baa465e2c8ab5d5d119b202092",
          compatibility: { packaging: "ready", execution: "unchecked", issues: [] },
        },
        {
          name: "iterators",
          version: "1.0.14",
          integrity: "04c78a0af14ab44ef400a8dfa75d2aaa560b0604ddd3dfcf9e2834b35b46806c",
          compatibility: { packaging: "ready", execution: "unchecked", issues: [] },
        },
        {
          name: "foreach",
          version: "1.5.2",
          integrity: "9273c0162a6e6501b643b470263a2473716c7cf54e821673a9be1959424d4d03",
          compatibility: { packaging: "ready", execution: "unchecked", issues: [] },
        },
      ]);
      expect(installed.lock.packages).toEqual([
        {
          name: "codetools",
          version: "0.2-20",
          integrity: "sha256-f81ec9e456e415b994b2206fef5062c79e2b16baa465e2c8ab5d5d119b202092",
          dependencies: [],
        },
        {
          name: "iterators",
          version: "1.0.14",
          integrity: "sha256-04c78a0af14ab44ef400a8dfa75d2aaa560b0604ddd3dfcf9e2834b35b46806c",
          dependencies: [],
        },
        {
          name: "foreach",
          version: "1.5.2",
          integrity: "sha256-9273c0162a6e6501b643b470263a2473716c7cf54e821673a9be1959424d4d03",
          dependencies: ["codetools", "iterators"],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("foreach", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(foreach); "package:foreach" %in% search()')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('sort(getNamespaceExports("foreach"))')).resolves.toEqual([
        "%:%",
        "%do%",
        "%dopar%",
        "accumulate",
        "foreach",
        "getDoParName",
        "getDoParRegistered",
        "getDoParVersion",
        "getDoParWorkers",
        "getDoSeqName",
        "getDoSeqRegistered",
        "getDoSeqVersion",
        "getDoSeqWorkers",
        "getErrorIndex",
        "getErrorValue",
        "getResult",
        "getexports",
        "makeAccum",
        "registerDoSEQ",
        "setDoPar",
        "setDoSeq",
        "times",
        "when",
      ]);
      await expect(
        runtime.eval(`
          probe <- iterators::iter(foreach(i = 1:3))
          args <- iterators::nextElem(probe)
          list(typeof(args), length(args), names(args),
               typeof(names(args)), length(names(args)))
        `),
      ).resolves.toEqual(["list", 1, "i", "character", 1]);
      await expect(
        runtime.eval(`
          squares <- foreach(i = 1:3, .combine = "c") %do% i ^ 2
          nested <- foreach(i = 1:2, .combine = "c") %:%
            foreach(j = 1:2, .combine = "c") %do% paste(i, j, sep = "-")
          list(squares, nested, getDoSeqRegistered(), getDoSeqWorkers())
        `),
      ).resolves.toEqual([[1, 4, 9], ["1-1", "1-2", "2-1", "2-2"], false, 1]);
      const foreachArtifact = installed.artifacts.find(
        (artifact) => artifact.package.name === "foreach",
      );
      const exampleResource = foreachArtifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "foreach",
        "getDoParWorkers",
        "getDoSeqWorkers",
        "registerDoSEQ",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "foreach", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`foreach example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "installs and runs the source-blind public doParallel 1.0.17 dependency closure",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["doParallel"]);
      expect(
        installed.artifacts.map((artifact) => ({
          name: artifact.package.name,
          version: artifact.package.version,
          integrity: artifact.integrity.value,
          dependencies: installed.lock.packages.find(
            (entry) => entry.name === artifact.package.name,
          )?.dependencies,
        })),
      ).toEqual([
        {
          name: "codetools",
          version: "0.2-20",
          integrity: "f81ec9e456e415b994b2206fef5062c79e2b16baa465e2c8ab5d5d119b202092",
          dependencies: [],
        },
        {
          name: "iterators",
          version: "1.0.14",
          integrity: "04c78a0af14ab44ef400a8dfa75d2aaa560b0604ddd3dfcf9e2834b35b46806c",
          dependencies: [],
        },
        {
          name: "foreach",
          version: "1.5.2",
          integrity: "9273c0162a6e6501b643b470263a2473716c7cf54e821673a9be1959424d4d03",
          dependencies: ["codetools", "iterators"],
        },
        {
          name: "doParallel",
          version: "1.0.17",
          integrity: "c7b7cdf32c906a7011aa5579ba84c049a99041a8493fdc022efbe8d412f9620c",
          dependencies: ["foreach", "iterators"],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("doParallel", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library(doParallel); "package:doParallel" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          registerDoParallel(cores = 1L)
          values <- foreach(i = 1:4, .combine = "c") %dopar% i ^ 2
          list(values, getDoParRegistered(), getDoParWorkers(), getDoParName())
        `),
      ).resolves.toEqual([[1, 4, 9, 16], true, 1, "doParallelMC"]);
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "doParallel",
      );
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual(["registerDoParallel"]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "doParallel", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`doParallel example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "installs and runs the source-blind public pbapply 1.7-4 package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["pbapply"]);
      expect(
        installed.artifacts.map((artifact) => ({
          name: artifact.package.name,
          version: artifact.package.version,
          integrity: artifact.integrity.value,
          dependencies: installed.lock.packages.find(
            (entry) => entry.name === artifact.package.name,
          )?.dependencies,
        })),
      ).toEqual([
        {
          name: "pbapply",
          version: "1.7-4",
          integrity: "811dd8f01c8ea4177caf5624c116d64e3427cee70522e4162463713e025605f3",
          dependencies: [],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("pbapply", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(pbapply); "package:pbapply" %in% search()')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval(`
          sequential <- pblapply(1:4, function(value) value ^ 2)
          simplified <- pbsapply(1:4, function(value) value + 10)
          cluster <- parallel::makePSOCKcluster(1)
          clustered <- pblapply(1:4, function(value) value * 3, cl = cluster)
          parallel::stopCluster(cluster)
          list(sequential, simplified, clustered, pboptions()$type)
        `),
      ).resolves.toEqual([[1, 4, 9, 16], [11, 12, 13, 14], [3, 6, 9, 12], "none"]);
      await expect(
        runtime.eval(`
          i39 <- sapply(3:9, seq)
          dim(pbvapply(i39, fivenum, numeric(5)))
        `),
      ).resolves.toEqual([5, 7]);
      await expect(
        runtime.eval(`
          v <- structure(10 * (5:8), names = LETTERS[1:4])
          f2 <- function(x, y) outer(rep(x, length.out = 3), y)
          c(typeof(outer(1:3, 1:5)), sapply(v, function(x) typeof(f2(x, 2 * (1:5)))))
        `),
      ).resolves.toEqual(["double", "double", "double", "double", "double"]);
      await expect(
        runtime.eval(`
          dim(pbvapply(v, f2, outer(1:3, 1:5), y = 2 * (1:5)))
        `),
      ).resolves.toEqual([3, 5, 4]);
      await expect(
        runtime.eval(`
          x <- cbind(x1 = 3, x2 = c(4:1, 2:5))
          col.sums <- pbapply(x, 2, sum)
          row.sums <- pbapply(x, 1, sum)
          c(typeof(x), typeof(col.sums), typeof(row.sums), col.sums)
        `),
      ).resolves.toEqual(["double", "double", "double", "24", "24"]);
      await expect(
        runtime.eval(`
          n <- 17
          fac <- factor(rep_len(1:3, n), levels = 1:5)
          pbtapply(1:n, fac, sum)
          pbtapply(1:n, fac, sum, default = 0)
          pbtapply(1:n, fac, sum, simplify = FALSE)
          pbtapply(1:n, fac, range)
          pbtapply(1:n, fac, quantile)
          pbtapply(1:n, fac, length)
          pbtapply(1:n, fac, length, default = 0)
          nq <- names(quantile(1:5))
          actual <- pbtapply(1:n, fac, quantile)[-1]
          expected <- array(list(
            structure(c(2, 5.75, 9.5, 13.25, 17), .Names = nq),
            structure(c(3, 6, 9, 12, 15), .Names = nq), NULL, NULL
          ), dim = 4, dimnames = list(as.character(2:5)))
          identical(actual, expected)
        `),
      ).resolves.toBe(true);
      const artifact = installed.artifacts[0];
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "pbapply",
        "pboptions",
        "splitpb",
        "timerProgressBar",
      ]);
      for (const topic of examples.topics) {
        try {
          await runtime.eval(
            `utils::example(${JSON.stringify(topic.name)}, package = "pbapply", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`pbapply example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind public globals 0.19.1 dependency closure",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["globals"]);
      expect(
        installed.artifacts.map((artifact) => ({
          name: artifact.package.name,
          version: artifact.package.version,
          integrity: artifact.integrity.value,
          dependencies: installed.lock.packages.find(
            (entry) => entry.name === artifact.package.name,
          )?.dependencies,
        })),
      ).toEqual([
        {
          name: "codetools",
          version: "0.2-20",
          integrity: "f81ec9e456e415b994b2206fef5062c79e2b16baa465e2c8ab5d5d119b202092",
          dependencies: [],
        },
        {
          name: "globals",
          version: "0.19.1",
          integrity: "ddf3aae1439cb48c614a7769eb83bd44fe1d189e3297010cd0ed15def9fbfb87",
          dependencies: ["codetools"],
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("globals", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(globals); "package:globals" %in% search()')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval(`
          x <- 42L
          by_name <- globalsByName("x", envir = environment())
          c(names(by_name), unlist(by_name), findGlobals(quote(a + b), method = "dfs"))
        `),
      ).resolves.toEqual(["x", "42", "+", "a", "b"]);
      await expect(
        runtime.eval(`
          expr <- substitute({ a <- b; b <- 1 })
          c(codetools:::getAssignedVar(expr[[2L]]), codetools:::getAssignedVar(expr[[3L]]))
        `),
      ).resolves.toEqual(["a", "b"]);
      await expect(
        runtime.eval(`
          localStopFuns <- c("expression", "quote", "Quote", "local")
          envir <- baseenv()
          locals <- localStopFuns[!sapply(localStopFuns, codetools:::isBaseVar, envir)]
          sf <- unique(c(locals, localStopFuns))
          env <- new.env()
          collect <- function(v, e, w) assign(v, TRUE, envir = env)
          isLocal <- function(v, w) as.character(v) %in% sf
          w <- codetools:::makeLocalsCollector(collect = collect, isLocal = isLocal)
          codetools:::walkCode(expr[[2L]], w)
          isloc <- sapply(sf, exists, envir = env, inherits = FALSE)
          c(locals, sf, ls(env, all.names = TRUE), typeof(isloc), is.list(isloc), length(isloc), unlist(isloc), sf[isloc])
        `),
      ).resolves.toEqual([
        "Quote",
        "Quote",
        "expression",
        "quote",
        "local",
        "a",
        "logical",
        "FALSE",
        "4",
        "FALSE",
        "FALSE",
        "FALSE",
        "FALSE",
      ]);
      await expect(runtime.eval("codetools:::findLocalsList(list(expr[[2L]]))")).resolves.toEqual(
        "a",
      );
      await expect(runtime.eval("codetools:::findLocalsList(list(expr[[3L]]))")).resolves.toEqual(
        "b",
      );
      await expect(runtime.eval("codetools:::findLocalsList(list(expr))")).resolves.toEqual([
        "a",
        "b",
      ]);
      const artifact = installed.artifacts.find(
        (candidate) => candidate.package.name === "globals",
      );
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual(["globalsByName", "findGlobals"]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "globals", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`globals example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind public listenv 1.0.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["listenv"]);
      expect(installed.artifacts.map((artifact) => artifact.package)).toMatchObject([
        { name: "listenv", version: "1.0.0" },
      ]);
      expect(installed.artifacts[0]?.integrity).toEqual({
        algorithm: "sha256",
        value: "dbe8c845c8cf2844545475d0ea724f84a9b1a78d1a6cdac2e402fd44e837902b",
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
      await expect(runtime.eval('requireNamespace("listenv", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(listenv); "package:listenv" %in% search()')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval(`
          x <- listenv(a = 1, b = 2)
          for (i in seq_along(x)) x[[i]] <- x[[i]] ^ 2
          values <- as.list(x)
          c(names(values), unlist(values), length(x), inherits(x, "listenv"))
        `),
      ).resolves.toEqual(["a", "b", "1", "4", "2", "TRUE"]);
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "aperm.listenv",
        "dim_na",
        "listenv",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "listenv", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`listenv example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind public R.methodsS3 1.8.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["R.methodsS3"]);
      expect(installed.artifacts.map((artifact) => artifact.package)).toMatchObject([
        { name: "R.methodsS3", version: "1.8.2" },
      ]);
      expect(installed.artifacts[0]?.integrity).toEqual({
        algorithm: "sha256",
        value: "79b2dbec6e65cfe58fede0368b4f6560c1d62b6b9a20b275bb829ab3e73edc03",
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
      await expect(runtime.eval('requireNamespace("R.methodsS3", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library(R.methodsS3); "package:R.methodsS3" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          setMethodS3("nativrProbe", "default", function(x, ...) "default")
          setMethodS3("nativrProbe", "character", function(x, ...) "character")
          c(nativrProbe(123), nativrProbe("123"), isGenericS3("nativrProbe"))
        `),
      ).resolves.toEqual(["default", "character", "TRUE"]);
      const exampleResource = installed.artifacts[0]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "setGenericS3",
        "setMethodS3",
        "throw",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "R.methodsS3", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`R.methodsS3 example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the unchanged public R.oo 1.27.1 pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["R.oo"]);
      expect(
        installed.artifacts.map((artifact) => ({
          name: artifact.package.name,
          version: artifact.package.version,
          integrity: artifact.integrity.value,
        })),
      ).toEqual([
        {
          name: "R.methodsS3",
          version: "1.8.2",
          integrity: "79b2dbec6e65cfe58fede0368b4f6560c1d62b6b9a20b275bb829ab3e73edc03",
        },
        {
          name: "R.oo",
          version: "1.27.1",
          integrity: "cf79fcaeae429eda84ee84d71529f575041b2659b0b2ab70398b48c9934af8d5",
        },
      ]);
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        // R.oo's unchanged clearCache example deliberately creates several
        // million-element cache vectors. Keep the evidence run finite without
        // weakening the interactive-safe or named package-test defaults.
        limits: { maxSteps: 100_000_000 },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      await expect(runtime.eval('requireNamespace("R.oo", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(R.oo); "package:R.oo" %in% search()')).resolves.toBe(true);
      await expect(
        runtime.eval(`
          object <- Object()
          c(class(object), inherits(object, "Object"))
        `),
      ).resolves.toEqual(["Object", "TRUE"]);
      const exampleResource = installed.artifacts[1]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics).toHaveLength(90);
      expect(examples.topics[0]?.name).toBe("ASCII");
      expect(examples.topics.at(-1)?.name).toBe("unload.Package");
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "R.oo", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`R.oo example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  // The P5 evidence deliberately executes all 90 installed Rd topics in isolated
  // reset sessions. Namespace reloading is part of that isolation contract, so
  // keep a bounded but realistic wall-clock allowance on slower Windows hosts.
  180_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind R.utils 2.13.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["R.utils"]);
      expect(
        installed.artifacts.map((artifact) => ({
          package: artifact.package.name,
          version: artifact.package.version,
          integrity: artifact.integrity.value,
        })),
      ).toEqual([
        {
          package: "R.methodsS3",
          version: "1.8.2",
          integrity: "79b2dbec6e65cfe58fede0368b4f6560c1d62b6b9a20b275bb829ab3e73edc03",
        },
        {
          package: "R.oo",
          version: "1.27.1",
          integrity: "cf79fcaeae429eda84ee84d71529f575041b2659b0b2ab70398b48c9934af8d5",
        },
        {
          package: "R.utils",
          version: "2.13.0",
          integrity: "3c9500efb85b97c1fa180426627909cf961bc3c6d77ed582272fb8f723230196",
        },
      ]);
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "package-test",
        limits: { maxSteps: 100_000_000 },
        // R.utils' GString example explicitly asks for a host name. The default
        // browser runtime correctly exposes no host process environment; admit
        // only the inert value required by this host-dependent example path.
        environmentVariables: { HOSTNAME: "browser" },
        assets: {
          treeSitterRuntimeWasm: new URL(
            "../../parser/assets/web-tree-sitter.wasm",
            import.meta.url,
          ),
          rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
        },
        packages: installed.bundles,
      });
      await expect(runtime.eval('requireNamespace("R.utils", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval(`
        library(R.utils)
        c(capitalize("browser"), "package:R.utils" %in% search())
      `),
      ).resolves.toEqual(["Browser", "TRUE"]);
      await expect(
        runtime.eval('who <- "world"; as.character(GString("Hello ${who}"))'),
      ).resolves.toBe("Hello world");
      await expect(
        runtime.eval(
          'x <- 1:5; y <- c("hello", "world"); as.character(GString("(x,y)=(${x},${y})"))',
        ),
      ).resolves.toEqual([
        "(x,y)=(1,hello)",
        "(x,y)=(2,world)",
        "(x,y)=(3,hello)",
        "(x,y)=(4,world)",
        "(x,y)=(5,hello)",
      ]);
      await expect(runtime.eval('as.character(GString("${username}"))')).resolves.toBeTypeOf(
        "string",
      );
      await expect(runtime.eval('as.character(GString("${hostname}"))')).resolves.toBe("browser");
      await expect(runtime.eval('as.character(GString("${date}"))')).resolves.toBeTypeOf("string");
      await expect(runtime.eval('as.character(GString("${`1+1`}"))')).resolves.toBe("2");
      await expect(runtime.eval('as.character(GString("$[n=1]{rnorm}"))')).resolves.toBeTypeOf(
        "string",
      );
      const exampleResource = installed.artifacts[2]?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.length).toBeGreaterThan(0);
      const browserNonApplicableExamples = new Map([
        [
          "systemR",
          {
            code: "NRU6194",
            contract:
              "launching a separate R executable requires an explicit host systemCommand capability",
          },
        ],
        [
          "touchFile",
          {
            code: "NRE2210",
            contract:
              "the unchanged example requires the optional native-code digest package outside the pure-R dependency closure",
          },
        ],
      ]);
      await runtime.reset();
      await expect(
        runtime.eval(`
        library(R.utils)
        path <- tmpfile("Hello world!")
        before.time <- file.info(path)$mtime
        before.md5 <- tools::md5sum(path)
        Sys.sleep(0.01)
        previous <- touchFile(path)
        after.time <- file.info(path)$mtime
        after.md5 <- tools::md5sum(path)
        c(after.time > before.time, identical(before.md5, after.md5), previous == before.time)
      `),
      ).resolves.toEqual([true, true, true]);
      for (const topic of examples.topics) {
        await runtime.reset();
        const runnableSource = topic.blocks
          .filter((block) => block.kind === "run")
          .map((block) => block.source)
          .join("\n");
        const exclusion = browserNonApplicableExamples.get(topic.name);
        if (exclusion !== undefined) {
          await expect(
            runtime.evalDetailed(`library(R.utils)\n${runnableSource}`),
          ).rejects.toMatchObject({ code: exclusion.code });
          continue;
        }
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "R.utils", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          throw new Error(`R.utils example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  180_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind here 1.0.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["here"]);
      expect(
        installed.artifacts.map((artifact) => ({
          package: artifact.package.name,
          version: artifact.package.version,
          integrity: artifact.integrity.value,
        })),
      ).toEqual([
        {
          package: "rprojroot",
          version: "2.1.1",
          integrity: "6912fcb92677a3393af6484a98ed1acb8c9de4b2b0f9243d8aa869d1df131d0d",
        },
        {
          package: "here",
          version: "1.0.2",
          integrity: "7d3262b5b1d1547c73c5f22ab0b79282bb81142ab2ee6c4d84c891255a9f361b",
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("here", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(here); "package:here" %in% search()')).resolves.toBe(true);
      await expect(runtime.eval("here::here()")).resolves.toBeTypeOf("string");
      const exampleResource = installed.artifacts
        .at(-1)
        ?.bundle.resources.find((resource) => resource.path === ".nativr/examples-v1.json");
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual(["dr_here", "here", "i_am"]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "here", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`here example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind R.matlab 3.7.0 pure-R dependency closure",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["R.matlab"]);
      const fingerprints = installed.artifacts.map((artifact) => ({
        package: artifact.package.name,
        version: artifact.package.version,
        integrity: artifact.integrity.value,
      }));
      expect(fingerprints).toEqual([
        {
          package: "R.methodsS3",
          version: "1.8.2",
          integrity: "79b2dbec6e65cfe58fede0368b4f6560c1d62b6b9a20b275bb829ab3e73edc03",
        },
        {
          package: "R.oo",
          version: "1.27.1",
          integrity: "cf79fcaeae429eda84ee84d71529f575041b2659b0b2ab70398b48c9934af8d5",
        },
        {
          package: "R.utils",
          version: "2.13.0",
          integrity: "3c9500efb85b97c1fa180426627909cf961bc3c6d77ed582272fb8f723230196",
        },
        {
          package: "R.matlab",
          version: "3.7.0",
          integrity: "523e1ab1d7a43fafdf4a4779e7562d105e24bf06cc876247a38007c963377dff",
        },
      ]);
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
      await expect(runtime.eval('requireNamespace("R.matlab", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library(R.matlab); "package:R.matlab" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval("R.utils::isFile(tempfile())")).resolves.toBe(false);
      await expect(
        runtime.eval(`
          path <- tempfile(fileext = ".mat")
          payload <- matrix(c(1, 2, 3, 4), nrow = 2)
          writeMat(
            path,
            scalar = 42,
            values = c(1, 2, 3),
            payload = payload,
            verbose = FALSE
          )
          decoded <- readMat(path)
          c(
            decoded$scalar,
            decoded$values,
            dim(decoded$payload),
            as.vector(decoded$payload),
            file.size(path) > 0
          )
        `),
      ).resolves.toEqual([42, 1, 2, 3, 2, 2, 1, 2, 3, 4, 1]);
      const exampleResource = installed.artifacts
        .at(-1)
        ?.bundle.resources.find((resource) => resource.path === ".nativr/examples-v1.json");
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "Matlab",
        "readMat",
        "setFunction.Matlab",
        "writeMat",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "R.matlab", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`R.matlab example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind combinat 0.0-8 dependency-free pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["combinat"]);
      const artifact = installed.artifacts[0];
      expect(artifact).toMatchObject({
        package: { name: "combinat", version: "0.0-8" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "5d9c23c0589105289ae4e8b374e11e3873ba7f12475bbbfada6db7cb05406a97",
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
      await expect(runtime.eval('requireNamespace("combinat", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library(combinat); "package:combinat" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("combinat"))')).resolves.toBe("0.0.8");
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "combn",
        "dmnom",
        "nsimplex",
        "permn",
        "rmultinomial",
        "xsimplex",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "combinat", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`combinat example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind matrixcalc 1.0-6 dependency-free pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["matrixcalc"]);
      const artifact = installed.artifacts[0];
      expect(artifact).toMatchObject({
        package: { name: "matrixcalc", version: "1.0-6" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "d64cb82cebe99ded95ffe6c849ec665fc77a3f0438f76400872b56c050a3011e",
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
      await expect(runtime.eval('requireNamespace("matrixcalc", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library(matrixcalc); "package:matrixcalc" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("matrixcalc"))')).resolves.toBe(
        "1.0.6",
      );
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "D.matrix",
        "E.matrices",
        "H.matrices",
        "K.matrix",
        "L.matrix",
        "N.matrix",
        "T.matrices",
        "commutation.matrix",
        "creation.matrix",
        "direct.prod",
        "direct.sum",
        "duplication.matrix",
        "elimination.matrix",
        "entrywise.norm",
        "fibonacci.matrix",
        "frobenius.matrix",
        "frobenius.norm",
        "frobenius.prod",
        "hadamard.prod",
        "hankel.matrix",
        "hilbert.matrix",
        "hilbert.schmidt.norm",
        "inf.norm",
        "is.diagonal.matrix",
        "is.idempotent.matrix",
        "is.indefinite",
        "is.negative.definite",
        "is.negative.semi.definite",
        "is.non.singular.matrix",
        "is.positive.definite",
        "is.positive.semi.definite",
        "is.singular.matrix",
        "is.skew.symmetric.matrix",
        "is.square.matrix",
        "is.symmetric.matrix",
        "lower.triangle",
        "lu.decomposition",
        "matrix.inverse",
        "matrix.power",
        "matrix.rank",
        "matrix.trace",
        "maximum.norm",
        "one.norm",
        "pascal.matrix",
        "%s%",
        "set.submatrix",
        "shift.down",
        "shift.left",
        "shift.right",
        "shift.up",
        "spectral.norm",
        "stirling.matrix",
        "svd.inverse",
        "symmetric.pascal.matrix",
        "toeplitz.matrix",
        "u.vectors",
        "upper.triangle",
        "vandermonde.matrix",
        "vec",
        "vech",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "matrixcalc", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`matrixcalc example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind Formula 1.2-6 core-only pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["Formula"]);
      const artifact = installed.artifacts[0];
      expect(artifact).toMatchObject({
        package: { name: "Formula", version: "1.2-6" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "c2c65ec4d007ebd4c304e43a0e2c402ca047e0ae38d8667bbf79aaa918007b0b",
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
      await expect(runtime.eval('requireNamespace("Formula", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(Formula); "package:Formula" %in% search()')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("Formula"))')).resolves.toBe("1.2.6");
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "Formula",
        "model.frame.Formula",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "Formula", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`Formula example ${topic.name} failed:\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind DBI 1.3.0 core-only pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["DBI"]);
      const artifact = installed.artifacts[0];
      expect(artifact).toMatchObject({
        package: { name: "DBI", version: "1.3.0" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "d55fa587203e850bd7a7403a96aaa559bf9686c060816290904d1f4d7b9b6997",
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
      await expect(runtime.eval('requireNamespace("DBI", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(DBI); "package:DBI" %in% search()')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("DBI"))')).resolves.toBe("1.3.0");
      await expect(runtime.eval("class(ANSI())")).resolves.toBe("AnsiConnection");
      await expect(
        runtime.eval('identifier <- Id("dbo", "Customer"); class(identifier)'),
      ).resolves.toBe("Id");
      await expect(
        runtime.eval("as.character(dbQuoteIdentifier(ANSI(), identifier))"),
      ).resolves.toBe('"dbo"."Customer"');
      await expect(runtime.eval('as.character(dbQuoteString(ANSI(), "SELECT"))')).resolves.toBe(
        "'SELECT'",
      );
      await expect(
        runtime.eval(
          'as.character(sqlInterpolate(ANSI(), "SELECT * FROM X WHERE name = ?name", name = "Hadley"))',
        ),
      ).resolves.toBe("SELECT * FROM X WHERE name = 'Hadley'");
      await expect(runtime.eval('toString(SQL(c("a", "b")))')).resolves.toBe("a, b");
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "ANSI",
        "DBI-package",
        "DBIConnection-class",
        "DBIConnector-class",
        "DBIObject-class",
        "Id-class",
        "SQL",
        "dbAppendTable",
        "dbAppendTableArrow",
        "dbBind",
        "dbCanConnect",
        "dbClearResult",
        "dbColumnInfo",
        "dbConnect",
        "dbCreateTable",
        "dbCreateTableArrow",
        "dbDataType",
        "dbDisconnect",
        "dbDriver",
        "dbExecute",
        "dbExistsTable",
        "dbFetch",
        "dbFetchArrow",
        "dbFetchArrowChunk",
        "dbGetConnectArgs",
        "dbGetInfo",
        "dbGetQuery",
        "dbGetQueryArrow",
        "dbGetRowCount",
        "dbGetRowsAffected",
        "dbGetStatement",
        "dbHasCompleted",
        "dbIsReadOnly",
        "dbIsValid",
        "dbListFields",
        "dbListObjects",
        "dbListTables",
        "dbQuoteIdentifier",
        "dbQuoteLiteral",
        "dbQuoteString",
        "dbReadTable",
        "dbReadTableArrow",
        "dbRemoveTable",
        "dbSendQuery",
        "dbSendQueryArrow",
        "dbSendStatement",
        "dbUnquoteIdentifier",
        "dbWithTransaction",
        "dbWriteTable",
        "dbWriteTableArrow",
        ".SQL92Keywords",
        "rownames",
        "sqlAppendTable",
        "sqlCreateTable",
        "sqlData",
        "sqlInterpolate",
        "sqlCommentSpec",
        "dbBegin",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "DBI", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          throw new Error(`DBI example ${topic.name} failed:\n${runnableSource}`, { cause: error });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "evaluates the source-blind xtable 1.8-8 core-only pure-R package",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    try {
      const installed = await installPackagesFromRepository(["xtable"], {
        repository: "https://cloud.r-project.org/",
      });
      const artifact = installed.artifacts[0];
      expect(artifact).toMatchObject({
        package: { name: "xtable", version: "1.8-8" },
        compatibility: { packaging: "ready", execution: "unchecked" },
        integrity: {
          algorithm: "sha256",
          value: "bd7c22a70c628bd2a3655583b983884e962c4deebc4858db892361ed537e806b",
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
      await expect(runtime.eval('requireNamespace("xtable", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('library(xtable); "package:xtable" %in% search()')).resolves.toBe(
        true,
      );
      await expect(runtime.eval('as.character(packageVersion("xtable"))')).resolves.toBe("1.8.8");
      await expect(
        runtime.eval(`
          data(tli)
          fit <- glm(disadvg ~ ethnicty * grade, data = tli, family = binomial())
          c(class(fit), class(summary(fit)), class(xtable(fit)), class(xtable(anova(fit))))
        `),
      ).resolves.toEqual([
        "glm",
        "lm",
        "summary.glm",
        "xtable",
        "data.frame",
        "xtable",
        "data.frame",
      ]);
      await expect(
        runtime.eval(`
          counts <- c(18,17,15,20,10,20,25,13,12)
          outcome <- gl(3,1,9)
          treatment <- gl(3,3)
          fit <- glm(counts ~ outcome + treatment, family = poisson())
          c(class(xtable(fit)), class(xtable(anova(fit))))
        `),
      ).resolves.toEqual(["xtable", "data.frame", "xtable", "data.frame"]);
      await expect(
        runtime.eval(`
          data(USArrests)
          fit <- prcomp(USArrests)
          c(class(fit), class(summary(fit)), class(xtable(fit)), class(xtable(summary(fit))))
        `),
      ).resolves.toEqual([
        "prcomp",
        "summary.prcomp",
        "xtable",
        "data.frame",
        "xtable",
        "data.frame",
      ]);
      await expect(
        runtime.eval(`
          N <- c(0,1,0,1,1,1,0,0,0,1,1,0,1,1,0,0,1,0,1,0,1,1,0,0)
          P <- c(1,1,0,0,0,1,0,1,1,1,0,0,0,1,0,1,1,0,0,1,0,1,1,0)
          K <- c(1,0,0,1,0,1,1,0,0,1,0,1,0,1,1,0,0,0,1,1,1,0,1,0)
          yield <- c(49.5,62.8,46.8,57.0,59.8,58.5,55.5,56.0,62.8,55.8,69.5,55.0,
                     62.0,48.8,45.5,44.2,52.0,51.5,49.8,48.8,57.2,59.0,53.2,56.0)
          npk <- data.frame(block = gl(6,4), N = factor(N), P = factor(P),
                            K = factor(K), yield = yield)
          fit <- aov(yield ~ N*P*K + Error(block), npk)
          c(class(fit), class(summary(fit)), class(xtable(fit)), class(xtable(summary(fit))))
        `),
      ).resolves.toEqual([
        "aovlist",
        "listof",
        "summary.aovlist",
        "xtable",
        "data.frame",
        "xtable",
        "data.frame",
      ]);
      const exampleResource = artifact?.bundle.resources.find(
        (resource) => resource.path === ".nativr/examples-v1.json",
      );
      const examples = JSON.parse(
        Buffer.from(exampleResource?.data ?? "", "base64").toString("utf8"),
      ) as { topics: { name: string; blocks: { kind: string; source: string }[] }[] };
      expect(examples.topics.map((topic) => topic.name)).toEqual([
        "autoformat",
        "print.xtable",
        "print.xtableMatharray",
        "sanitize",
        "xtable",
        "xtableFtable",
        "xtableList",
        "xtableMatharray",
      ]);
      for (const topic of examples.topics) {
        await runtime.reset();
        try {
          await runtime.evalDetailed(
            `utils::example(${JSON.stringify(topic.name)}, package = "xtable", echo = FALSE); invisible(NULL)`,
          );
        } catch (error) {
          const runnableSource = topic.blocks
            .filter((block) => block.kind === "run")
            .map((block) => block.source)
            .join("\n");
          let diagnostic = "";
          try {
            await runtime.reset();
            await runtime.eval("library(xtable)");
            await runtime.evalDetailed(`
              local({
                .nativr_example_exprs <- parse(text = ${JSON.stringify(runnableSource)})
                for (.nativr_example_i in seq_along(.nativr_example_exprs)) {
                  tryCatch(
                    eval(.nativr_example_exprs[[.nativr_example_i]], envir = .GlobalEnv),
                    error = function(e) stop(paste0(
                      "top-level expression ", .nativr_example_i, ": ", conditionMessage(e)
                    ))
                  )
                }
              })
            `);
          } catch (diagnosticError) {
            diagnostic = `\nDiagnostic replay: ${String(diagnosticError)}`;
          }
          throw new Error(`xtable example ${topic.name} failed:${diagnostic}\n${runnableSource}`, {
            cause: error,
          });
        }
      }
    } finally {
      await runtime?.dispose();
    }
  },
  60_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public itertools 0.1-3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["itertools"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "itertools",
    );
    expect(artifact).toMatchObject({
      package: { name: "itertools", version: "0.1-3" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "bf2fe6d71b785b1a65004649de200dc79295af74f67020537d58a42feade80ae",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("itertools", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library("itertools"); as.character(packageVersion("itertools"))'),
      ).resolves.toBe("0.1.3");
      await expect(
        runtime.eval(`
          p <- product(letter = c("a", "b"), number = 1:2)
          z <- izip(left = 1:2, right = c("x", "y"))
          rng <- iRNGStream(313)
          list(
            product = list(nextElem(p), nextElem(p), nextElem(p), nextElem(p)),
            zip = list(nextElem(z), nextElem(z)),
            rng = list(nextElem(rng), nextElem(rng))
          )
        `),
      ).resolves.toEqual([
        [
          ["a", 1],
          ["a", 2],
          ["b", 1],
          ["b", 2],
        ],
        [
          [1, "x"],
          [2, "y"],
        ],
        [
          [10407, -148706266, 816896415, -423200657, 64647451, -1536586263, 64930425],
          [10407, 147611069, 397195254, 280483519, -1571776966, -1788649533, -335749277],
        ],
      ]);

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public optimParallel 1.0-3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["optimParallel"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "optimParallel",
    );
    expect(artifact).toMatchObject({
      package: { name: "optimParallel", version: "1.0-3" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "9230df11e2f6dceb5f8424d296062e416408bd22708e481cc24b188921e2c1cd",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("optimParallel", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library("optimParallel"); as.character(packageVersion("optimParallel"))'),
      ).resolves.toBe("1.0.3");

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public tictoc 1.2.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["tictoc"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "tictoc");
    expect(artifact).toMatchObject({
      package: { name: "tictoc", version: "1.2.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "02a0f5f2303a0fb641a8e404986608d415ab49917d3fae4eee1c5d39c8497fd7",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("tictoc", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval('library("tictoc"); as.character(packageVersion("tictoc"))'),
      ).resolves.toBe("1.2.1");
      await expect(
        runtime.eval(`
          s <- Stack()
          push(s, c(1L, 2L)); push(s, 3L)
          s.before <- c(
            class(s), size(s), first_element(s), last_element(s),
            paste(as.vector(s), collapse = ",")
          )
          s.pop <- pop(s); s.shift <- shift(s)
          s.after <- c(size(s), paste(as.vector(s), collapse = ","))

          sl <- StackList()
          push(sl, list(tag = "alpha", values = 1:2)); push(sl, "omega")
          sl.first <- first_element(sl); sl.list <- as.list(sl)
          sl.before <- c(
            class(sl), size(sl), sl.first$tag, paste(sl.first$values, collapse = ","),
            last_element(sl), length(sl.list)
          )
          sl.pop <- pop(sl); sl.shift <- shift(sl)
          sl.after <- c(size(sl), is.na(first_element(sl)), is.na(last_element(sl)))

          tic.clear(); tic.clearlog()
          tic("outer", quiet = TRUE); tic("inner", quiet = TRUE)
          inner <- toc(
            log = TRUE, quiet = TRUE,
            func.toc = function(tic, toc, msg, prefix) paste(prefix, msg),
            prefix = "done"
          )
          outer <- toc(log = TRUE, quiet = TRUE, func.toc = NULL)
          log <- tic.log(format = FALSE)

          as.character(c(
            s.before, s.pop, s.shift, s.after,
            sl.before, sl.pop, sl.shift$tag, paste(sl.shift$values, collapse = ","), sl.after,
            paste(names(inner), collapse = ","), inner$msg, inner$callback_msg,
            outer$msg, outer$callback_msg, length(log),
            paste(vapply(log, function(x) x$msg, ""), collapse = ","),
            inner$toc >= inner$tic && outer$toc >= outer$tic && outer$toc >= inner$toc,
            is.null(toc())
          ))
        `),
      ).resolves.toEqual([
        "Stack",
        "3",
        "1",
        "3",
        "1,2,3",
        "3",
        "1",
        "1",
        "2",
        "StackList",
        "2",
        "alpha",
        "1,2",
        "omega",
        "2",
        "omega",
        "alpha",
        "1,2",
        "0",
        "1",
        "1",
        "tic,toc,msg,callback_msg",
        "inner",
        "done inner",
        "outer",
        "",
        "2",
        "inner,outer",
        "TRUE",
        "TRUE",
      ]);

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public dfoptim 2023.1.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["dfoptim"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "dfoptim");
    expect(artifact).toMatchObject({
      package: { name: "dfoptim", version: "2023.1.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "7247194cefd1075cf7c8c4ca1356123abf21c307217ad7c8cf58776e4b85f3fa",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("dfoptim", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval('library("dfoptim"); as.character(packageVersion("dfoptim"))'),
      ).resolves.toBe("2023.1.0");
      await expect(
        runtime.eval(`
          sphere <- function(x, center = c(1, -2), weight = 1)
            sum(weight * (x - center) ^ 2)
          set.seed(42)
          h <- hjk(
            c(4, -5), sphere,
            control = list(tol = 2 ^ -8, maxfeval = 200), center = c(1, -2)
          )
          hb <- hjkb(
            c(0, 0), sphere, lower = c(-1, -1), upper = c(2, 3),
            control = list(tol = 2 ^ -8, maxfeval = 200), center = c(1, 2)
          )
          n <- nmk(
            c(4, -5), sphere,
            control = list(tol = 1e-8, maxfeval = 300), center = c(1, -2)
          )
          nb <- nmkb(
            c(0, -1), sphere, lower = c(-1, -3), upper = c(3, 1),
            control = list(tol = 1e-8, maxfeval = 300), center = c(1, -2)
          )
          m <- mads(
            c(0, -1), sphere, lower = c(-1, -3), upper = c(3, 1),
            control = list(
              trace = FALSE, tol = .01, maxfeval = 100,
              deltaInit = .1, lineSearch = 5, seed = 17
            ),
            center = c(1, -2)
          )
          c(
            round(h$par * 1e6), round(h$value * 1e10), h$convergence, h$feval, h$niter,
            round(hb$par * 1e6), round(hb$value * 1e10), hb$convergence,
            round((n$par - c(1, -2)) * 1e6), round(n$value * 1e10),
            n$convergence, n$feval, n$restarts,
            round((nb$par - c(1, -2)) * 1e6), round(nb$value * 1e10),
            nb$convergence, nb$feval, nb$restarts,
            round(m$par * 1e6), round(m$value * 1e10), m$feval,
            round(m$convergence * 1e10), is.na(m$iterlog)
          )
        `),
      ).resolves.toEqual([
        1_000_000, -2_000_000, 0, 0, 53, 8, 1_000_000, 2_000_000, 0, 0, 8, 151, 228, 0, 71, 0, 2,
        -42, 18, 0, 67, 0, 1_108_000, -2_100_000, 216_640_000, 57, 78_125_000, 1,
      ]);
      await expect(
        runtime.eval(`
          objective <- function(x) sum(x ^ 2)
          capture <- function(expression)
            tryCatch(force(expression), error = function(error) conditionMessage(error))
          c(
            vapply(
              c("hjk", "hjkb", "nmk", "nmkb", "mads"),
              function(name) paste(names(formals(get(name))), collapse = ","), ""
            ),
            capture(hjk(1, objective)),
            capture(hjkb(c(0, 0), objective, lower = 1, upper = 2)),
            capture(nmk(1, objective)),
            capture(nmkb(c(0, 0), objective)),
            capture(mads(
              c(0, 0), objective, lower = c(0, -Inf), upper = c(1, Inf),
              control = list(trace = FALSE)
            ))
          )
        `),
      ).resolves.toEqual([
        "par,fn,control,...",
        "par,fn,lower,upper,control,...",
        "par,fn,control,...",
        "par,fn,lower,upper,control,...",
        "par,fn,lower,upper,scale,control,...",
        "For univariate functions use some different method.",
        "Infeasible starting values -- check limits.",
        "Use `optimize' for univariate optimization",
        "Use `nmk()' for unconstrained optimization!",
        "Bounds must be all finite or all infinite, but not partially finite.",
      ]);

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public DFBA 0.1.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["DFBA"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "DFBA");
    expect(artifact).toMatchObject({
      package: { name: "DFBA", version: "0.1.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "d1b0d0223c1b5dac43641247af38a01a2cde0e08dc8085e4cf33d53cf185cf5e",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("DFBA", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval('library("DFBA"); as.character(packageVersion("DFBA"))'),
      ).resolves.toBe("0.1.0");

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public lm.beta 1.7-3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["lm.beta"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "lm.beta");
    expect(artifact).toMatchObject({
      package: { name: "lm.beta", version: "1.7-3" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "1c13aeb2a45d1790e851ad5f0a4cdbeeb4bfa6f66c39898e47b023f784aa2201",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("lm.beta", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval('library("lm.beta"); as.character(packageVersion("lm.beta"))'),
      ).resolves.toBe("1.7.3");
      await expect(
        runtime.eval(`
          d <- data.frame(
            y = c(2, 4, 5, 8, 10, 13),
            x = c(1, 2, 4, 5, 7, 9),
            z = c(0, 1, 0, 1, 0, 1),
            w = c(1, 2, 1, 3, 2, 1)
          )
          weighted <- lm.beta(lm(y ~ x + z, data = d, weights = w))
          plain <- lm.beta(lm(y ~ 0 + x + z, data = d))
          complete <- lm.beta(
            lm(y ~ 0 + x + z, data = d), complete.standardization = TRUE
          )
          summarized <- summary(weighted)
          table <- xtable::xtable(weighted)
          c(
            round(coef(weighted)[2:3] * 1e10), is.na(coef(weighted)[1]),
            round(coef(weighted, standardized = FALSE) * 1e10),
            dim(summarized$coefficients), is.na(summarized$coefficients[1, 2]),
            round(summarized$coefficients[2:3, 2] * 1e10),
            round(coef(plain) * 1e10), round(coef(complete) * 1e10), dim(table),
            inherits(try(lm.beta(1:3), silent = TRUE), "try-error")
          )
        `),
      ).resolves.toEqual([
        9_895_438_422, 1_309_128_123, 1, 4_734_576_758, 13_213_773_314, 8_601_147_776, 3, 5, 1,
        9_895_438_422, 1_309_128_123, 9_307_122_703, 943_274_971, 10_020_149_227, 1_414_912_457, 3,
        5, 1,
      ]);
      await expect(
        runtime.eval(
          "c(class(weighted), class(summarized), colnames(summarized$coefficients), class(table))",
        ),
      ).resolves.toEqual([
        "lm.beta",
        "lm",
        "summary.lm.beta",
        "summary.lm",
        "Estimate",
        "Standardized",
        "Std. Error",
        "t value",
        "Pr(>|t|)",
        "xtable",
        "data.frame",
      ]);

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public alabama 2025.1.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["alabama"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "alabama");
    expect(artifact).toMatchObject({
      package: { name: "alabama", version: "2025.1.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "d436014a3bd2e86072dffe66e9aeabe9bf3d63ba16822c99c0291c1a0610bed6",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("alabama", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval('library("alabama"); as.character(packageVersion("alabama"))'),
      ).resolves.toBe("2025.1.0");
      await expect(
        runtime.eval(`
          target <- c(.2, .3, .5)
          fn <- function(x) sum((x - target) ^ 2)
          gr <- function(x) 2 * (x - target)
          heq <- function(x) sum(x) - 1
          heq.jac <- function(x) matrix(1, 1, 3)
          hin <- function(x) x
          hin.jac <- function(x) diag(3)
          constrained <- constrOptim.nl(
            c(.25, .25, .5), fn, gr,
            hin = hin, hin.jac = hin.jac, heq = heq, heq.jac = heq.jac,
            control.outer = list(trace = FALSE, itmax = 20)
          )
          direct <- stats::nlminb(
            c(a = 3, b = -3),
            function(x) (x[1] - 1) ^ 2 + (x[2] - 2) ^ 2,
            function(x) 2 * (x - c(1, 2)),
            lower = c(0, 0), upper = c(2, 3)
          )
          list(
            constrained = unname(round(c(
              constrained$par, constrained$value, constrained$convergence,
              constrained$outer.iterations
            ) * 1e5)),
            direct = list(
              par = unname(round(direct$par * 1e8)),
              objective = round(direct$objective * 1e12),
              convergence = direct$convergence,
              names = names(direct),
              evaluation.names = names(direct$evaluations)
            )
          )
        `),
      ).resolves.toEqual([
        [20_000, 30_000, 50_000, 0, 0, 400_000],
        [
          [100_000_000, 200_000_000],
          0,
          0,
          ["par", "objective", "convergence", "iterations", "evaluations", "message"],
          ["function", "gradient"],
        ],
      ]);

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public logging 0.10-111 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["logging"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "logging");
    expect(artifact).toMatchObject({
      package: { name: "logging", version: "0.10-111" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "25cf50ea3597f6fb657a33d2b58169dbcd34972612adb3b809abb4b805c72431",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("logging", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval('library("logging"); as.character(packageVersion("logging"))'),
      ).resolves.toBe("0.10.111");
      await expect(
        runtime.eval(`
          logReset()
          captured <- character()
          capture <- function(msg, handler, record = NULL, dry = FALSE) {
            if (dry) return(TRUE)
            captured <<- c(
              captured,
              paste(record$levelname, record$logger, msg, sep = "|")
            )
            TRUE
          }
          formatter <- function(record) record$msg
          addHandler("capture", capture, formatter = formatter, level = "INFO")
          setLevel("DEBUG")
          setMsgComposer(
            function(msg, ...) paste0("C:", sprintf(msg, ...)),
            "branch"
          )
          logdebug("skip %d", 1, logger = "branch")
          loginfo("value=%d", 7, logger = "branch")
          logwarn("root")
          levels <- c(getLogger()$getLevel(), getLogger("branch")$.deducelevel())
          handler.level <- getHandler("capture")$level
          removeHandler("capture")
          logerror("removed")
          c(captured, levels, handler.level, identical(length(captured), 2L))
        `),
      ).resolves.toEqual(["INFO|branch|C:value=7", "WARNING||root", "10", "10", "20", "TRUE"]);

      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public latex2exp 0.9.8 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["latex2exp"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "latex2exp",
    );
    expect(artifact).toMatchObject({
      package: { name: "latex2exp", version: "0.9.8" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "c3b0426b7d6621ac5dc270e5f78ea389e2129b326d1322cd3691ae5270c93fdc",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("latex2exp", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval(`
          library(latex2exp)
          slash <- intToUtf8(92)
          inputs <- c(
            paste0("$", slash, "alpha + ", slash, "beta$"),
            paste0("Area = $", slash, "pi r^2$"),
            paste0("$", slash, "frac{x_1}{", slash, "sqrt{y}}$")
          )
          converted <- unname(TeX(inputs, output = "character"))
          custom <- TeX(
            paste0("$", slash, "variance{X} = 10$"),
            user_defined = setNames(
              list("sigma[$arg1]^2"),
              paste0(slash, "variance")
            ),
            output = "character"
          )
          styled <- c(
            TeX("$x + y$", bold = TRUE, output = "character"),
            TeX("$x + y$", italic = TRUE, output = "character")
          )
          expression_value <- TeX(inputs[[1]])
          invalid <- tryCatch(
            TeX("\${x$", output = "character"),
            error = conditionMessage
          )
          as.character(c(
            converted,
            custom,
            styled,
            typeof(expression_value),
            class(expression_value),
            length(expression_value),
            paste(deparse(expression_value[[1]]), collapse = " "),
            invalid,
            nrow(latex2exp_supported()),
            ncol(latex2exp_supported())
          ))
        `),
      ).resolves.toEqual([
        "alpha + beta",
        "'Area = '*pi*r^{2}",
        "frac(x[1], sqrt(y, ))",
        "sigma[X]^2 * {phantom() == phantom()} * 10",
        "bold(x + y)",
        "italic(x + y)",
        "expression",
        "latexexpression",
        "expression",
        "1",
        "alpha + beta",
        "Mismatched number of braces in '${x$' (1 { opened, 0 } closed)",
        "213",
        "3",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed, JSON.stringify(packageCheck, null, 2)).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public enrichwith 0.5.0 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["enrichwith"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "enrichwith",
    );
    expect(artifact).toMatchObject({
      package: { name: "enrichwith", version: "0.5.0" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "dfc212f4de8a92c44a6a009bbd134c094193edaa033bbbbb48d89eb98ee34612",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("enrichwith", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval(`
          library(enrichwith)
          enriched_link <- enrich(
            stats::make.link("logit"),
            with = "inverse link derivatives"
          )
          enriched_family <- enrich(stats::poisson(link = "sqrt"), with = "all")
          model_data <- data.frame(
            x = c(-1, 0, 1, 2),
            y = c(1, 2, 4, 5)
          )
          fit <- enrich(lm(y ~ x, model_data), with = "all")
          auxiliary <- get_auxiliary_functions(fit)
          information <- auxiliary$information()
          score <- auxiliary$score()
          bias <- auxiliary$bias()
          link_options <- get_enrichment_options(enriched_link, all_options = TRUE)
          family_options <- get_enrichment_options(enriched_family, all_options = TRUE)
          as.character(c(
            class(enriched_link),
            tail(names(enriched_link), 2),
            round(enriched_link$d2mu.deta(c(-2, 0, 2)), 12),
            round(enriched_link$d3mu.deta(c(-2, 0, 2)), 12),
            class(enriched_family),
            tail(names(enriched_family), 11),
            round(enriched_family$theta(c(.25, 1, 4)), 12),
            enriched_family$d1variance(c(.25, 1, 4)),
            enriched_family$d2variance(c(.25, 1, 4)),
            class(fit),
            tail(names(fit), 6),
            names(auxiliary),
            unlist(lapply(auxiliary, function(fun) names(formals(fun)))),
            round(unname(score), 12),
            dim(information),
            round(unname(information), 10),
            round(unname(bias), 12),
            round(unname(coef(fit)), 12),
            round(unname(fit$dispersion_mle), 12),
            class(link_options),
            class(family_options)
          ))
        `),
      ).resolves.toEqual([
        "enriched_link-glm",
        "link-glm",
        "d2mu.deta",
        "d3mu.deta",
        "0.079962501056",
        "0",
        "-0.079962501056",
        "0.038851667548",
        "-0.125",
        "0.038851667548",
        "enriched_family",
        "family",
        "theta",
        "bfun",
        "c1fun",
        "c2fun",
        "d1variance",
        "d2variance",
        "afun",
        "d1afun",
        "d2afun",
        "d3afun",
        "d4afun",
        "-1.38629436112",
        "0",
        "1.38629436112",
        "1",
        "1",
        "1",
        "0",
        "0",
        "0",
        "enriched_lm",
        "lm",
        "auxiliary_functions",
        "score_mle",
        "dispersion_mle",
        "expected_information_mle",
        "observed_information_mle",
        "bias_mle",
        "score",
        "information",
        "bias",
        "simulate",
        "coefficients",
        "dispersion",
        "contributions",
        "coefficients",
        "dispersion",
        "type",
        "QR",
        "CHOL",
        "coefficients",
        "dispersion",
        "coefficients",
        "dispersion",
        "nsim",
        "seed",
        "0",
        "0",
        "0",
        "3",
        "3",
        "80",
        "40",
        "0",
        "40",
        "120",
        "0",
        "0",
        "0",
        "800",
        "0",
        "0",
        "-0.025",
        "2.3",
        "1.4",
        "0.05",
        "enrichment_options",
        "enrichment_options",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(
        packageCheck.passed,
        JSON.stringify({ integrity: artifact?.integrity, packageCheck }, null, 2),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public diagram 1.6.5 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["diagram"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "diagram");
    expect(artifact).toMatchObject({
      package: { name: "diagram", version: "1.6.5" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "1d4c58cfd389fe81f399f0640f05f981877012361ffde007ffc4d78836674251",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("diagram", quietly = TRUE)')).resolves.toBe(true);
      const scenario = await runtime.evalDetailed(`
        library(diagram)
        A <- matrix(c(0, 1, 2, 0), nrow = 2)
        drawn <- plotmat(A, name = c("source", "sink"), main = "independent scenario")
        identical(names(drawn), c("arr", "comp", "radii", "rect")) &&
          nrow(drawn$arr) == 2L &&
          identical(dim(drawn$comp), c(2L, 2L)) &&
          identical(dim(drawn$rect), c(2L, 4L))
      `);
      expect(scenario.value).toBe(true);
      expect(scenario.graphics.some((event) => event.kind === "segments")).toBe(true);
      expect(scenario.graphics.some((event) => event.kind === "text")).toBe(true);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(
        packageCheck.passed,
        JSON.stringify({ integrity: artifact?.integrity, packageCheck }, null, 2),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public plotmo 3.7.1 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["plotmo"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "plotmo");
    expect(artifact).toMatchObject({
      package: { name: "plotmo", version: "3.7.1" },
      compatibility: { packaging: "ready", execution: "unchecked" },
      integrity: {
        algorithm: "sha256",
        value: "b14ec30d18a30e3e802d5650ef5b9e9b744e18051cde38d5db4acb886c1f5d21",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("plotmo", quietly = TRUE)')).resolves.toBe(true);
      const scenario = await runtime.evalDetailed(`
        library(plotmo)
        model <- lm(Volume ~ Girth + Height, data = trees)
        residual.plot <- plotres(
          model, which = 3, id.n = 0, smooth.col = 0, do.par = FALSE
        )
        identical(length(residual.plot$x), nrow(trees)) &&
          identical(length(residual.plot$y), nrow(trees)) &&
          isTRUE(all.equal(as.numeric(residual.plot$x), as.numeric(fitted(model)))) &&
          isTRUE(all.equal(as.numeric(residual.plot$y), as.numeric(residuals(model))))
      `);
      expect(scenario.value).toBe(true);
      expect(scenario.graphics.some((event) => event.kind === "segments")).toBe(true);
      expect(scenario.graphics.some((event) => event.kind === "points")).toBe(true);
      const predictorPlot = await runtime.evalDetailed(`
          plotted <- withVisible(plotmo(
            model,
            degree1 = c("Girth", "Height"),
            degree2 = FALSE,
            ngrid1 = 7,
            pt.col = 0,
            do.par = FALSE
          ))
          identical(class(plotted$value), "data.frame") &&
            identical(dim(plotted$value), c(nrow(trees), 2L)) &&
            identical(names(plotted$value), c("Girth", "Height")) &&
            isTRUE(all.equal(plotted$value, trees[c("Girth", "Height")])) &&
            identical(plotted$visible, FALSE)
        `);
      expect(predictorPlot.value).toBe(true);
      expect(predictorPlot.graphics.some((event) => event.kind === "new-page")).toBe(true);
      expect(predictorPlot.graphics.some((event) => event.kind === "segments")).toBe(true);
      expect(predictorPlot.graphics.some((event) => event.kind === "text")).toBe(true);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(
        packageCheck.passed,
        JSON.stringify({ integrity: artifact?.integrity, packageCheck }, null, 2),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public invgamma 1.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["invgamma"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "invgamma");
    expect(artifact).toMatchObject({
      package: { name: "invgamma", version: "1.2" },
      compatibility: { packaging: "ready", execution: "unchecked", issues: [] },
      integrity: {
        algorithm: "sha256",
        value: "81de2a62801f13dc10a39a362104c1dc2b379d52a70cfa158d68ff31007d3f24",
      },
    });
    try {
      runtime = await createR({
        execution: "inline",
        runtimeProfile: "large-browser",
        limits: { maxSteps: 100_000_000 },
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
        runtime.eval(`
          c(
            requireNamespace("invgamma", quietly = TRUE),
            as.character(packageVersion("invgamma")),
            length(getNamespaceExports("invgamma"))
          )
        `),
      ).resolves.toEqual(["TRUE", "1.2", "12"]);
      await expect(
        runtime.eval(`
          observed <- c(
            invgamma::dinvexp(3, 2), invgamma::pinvexp(3, 2),
            invgamma::qinvexp(.75, 2), invgamma::dinvgamma(2, 7, 10),
            invgamma::pinvgamma(2, 7, 10), invgamma::qinvgamma(.75, 7, 10),
            invgamma::dinvchisq(1.5, 3, 2), invgamma::pinvchisq(1.5, 3, 2),
            invgamma::qinvchisq(.75, 3, 2)
          )
          expected <- c(
            0.114092693118354, 0.513417119032592, 6.95211899356441,
            0.365557020349689, 0.762183462972939, 1.96747492334381,
            0.0472251655919197, 0.950349016493759, 0.4522481694628
          )
          c(max(abs(observed - expected)) < 1e-12,
            abs(invgamma::qinvgamma(invgamma::pinvgamma(2, 7, scale = .1),
              7, scale = .1) - 2) < 1e-10,
            identical(sort(getNamespaceExports("invgamma")), sort(c(
              "dinvchisq", "dinvexp", "dinvgamma", "pinvchisq", "pinvexp", "pinvgamma",
              "qinvchisq", "qinvexp", "qinvgamma", "rinvchisq", "rinvexp", "rinvgamma"
            ))))
        `),
      ).resolves.toEqual([true, true, true]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(true);
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public entropy 1.3.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["entropy"], {
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "entropy");
    expect(artifact).toMatchObject({
      package: { name: "entropy", version: "1.3.2" },
      compatibility: { packaging: "ready", execution: "unchecked", issues: [] },
      integrity: {
        algorithm: "sha256",
        value: "97bfc1652049169c7bad395597d12df5eb392dabcd3e798f7a920522a67e57c5",
      },
    });
    try {
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
      await expect(
        runtime.eval(`
          counts <- c(4, 2, 3, 1, 6, 4)
          counts2 <- c(3, 3, 2, 2, 5, 5)
          joint <- matrix(c(4, 5, 1, 2, 4, 4), nrow = 3)
          probabilities <- c(.1, .15, .35, .05, .2, .15)
          g <- entropy::Gstat(counts, probabilities)
          chi <- entropy::chi2stat(counts, probabilities)
          gi <- entropy::Gstatindep(joint)
          chii <- entropy::chi2statindep(joint)
          observed <- c(
            entropy::freqs.empirical(counts),
            entropy::freqs.shrink(counts, lambda.freqs = .25, verbose = FALSE),
            entropy::entropy.plugin(entropy::freqs.empirical(counts)),
            entropy::entropy.empirical(counts),
            entropy::entropy.MillerMadow(counts),
            entropy::entropy.shrink(counts, lambda.freqs = .25, verbose = FALSE),
            g[[1]], g[[2]], g[[3]], chi[[1]], chi[[2]], chi[[3]],
            entropy::mi.empirical(joint),
            gi[[1]], gi[[2]], gi[[3]], chii[[1]], chii[[2]], chii[[3]],
            entropy::KL.empirical(counts, counts2),
            entropy::chi2.empirical(counts, counts2)
          )
          expected <- c(
            .2, .1, .15, .05, .3, .2,
            .19166666666666668, .11666666666666667, .15416666666666665,
            .079166666666666663, .26666666666666666, .19166666666666668,
            1.6695801269814072, 1.6695801269814072, 1.7945801269814072,
            1.7254157755548241, 6.006567726635903, 5, .30558037462127419,
            5.9523809523809526, 5, .31088007518905469,
            .06795961471815902, 2.7183845887263609, 2, .25686816705365323,
            2.5777777777777775, 2, .27557680949859509,
            .053220067643111581, .10333333333333332
          )
          x <- c(-2, -1, -.5, 0, .25, .75, 1.5, 2)
          d1 <- entropy::discretize(x, numBins = 4, r = c(-2, 2))
          d2 <- entropy::discretize2d(
            x, rev(x), numBins1 = 4, numBins2 = 4, r1 = c(-2, 2), r2 = c(-2, 2)
          )
          c(
            max(abs(observed - expected)) < 1e-11,
            length(d1) == 4 && all(d1 == c(2, 2, 2, 2)),
            length(d2) == 16 && all(
              as.vector(d2) == c(0, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 0)
            ),
            length(getNamespaceExports("entropy")) == 34
          )
        `),
      ).resolves.toEqual([true, true, true, true]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(
        packageCheck.passed,
        JSON.stringify({ integrity: artifact?.integrity, packageCheck }, null, 2),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public profileModel 0.6.2 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["profileModel"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find(
      (candidate) => candidate.package.name === "profileModel",
    );
    expect(artifact).toMatchObject({
      package: { name: "profileModel", version: "0.6.2" },
      compatibility: { packaging: "ready", execution: "unchecked", issues: [] },
      integrity: {
        algorithm: "sha256",
        value: "92b39003801686260fc4b3ddcd32c307aedd1cdca401576839b7386b9693041d",
      },
    });
    try {
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
      await expect(runtime.eval('requireNamespace("profileModel", quietly = TRUE)')).resolves.toBe(
        true,
      );
      await expect(
        runtime.eval('library("profileModel"); "package:profileModel" %in% search()'),
      ).resolves.toBe(true);
      await expect(
        runtime.eval(`
          x <- c(-2, -1, 0, 1, 2, 3)
          y <- c(0, 0, 1, 0, 1, 1)
          fit <- glm(y ~ x, family = binomial)
          bounds <- cbind(coef(fit) - 1.5, coef(fit) + 1.5)
          profiled <- profileModel(
            fit,
            gridsize = 5,
            grid.bounds = bounds,
            objective = "ordinaryDeviance",
            verbose = FALSE,
            profTraces = TRUE
          )
          expected.intercept <- c(
            -2.10701379, -1.35701379, -0.60701379, 0.14298621, 0.89298621,
            1.10995515, 0.3258146, 0, 0.42235041, 1.74716145,
            1.86783334, 1.49376362, 1.21402759, 1.09727567, 1.20102684
          )
          expected.slope <- c(
            -0.28597241, 0.46402759, 1.21402759, 1.96402759, 2.71402759,
            5.71541817, 1.01617631, 0, 0.47883746, 1.46053862,
            0.14298621, -0.23201379, -0.60701379, -0.98201379, -1.35701379
          )
          round(c(profiled$profiles[[1]], profiled$profiles[[2]]), 8)
        `),
      ).resolves.toEqual([
        -2.10701379, -1.35701379, -0.60701379, 0.14298621, 0.89298621, 1.10995515, 0.3258146, 0,
        0.42235041, 1.74716145, 1.86783334, 1.49376362, 1.21402759, 1.09727567, 1.20102684,
        -0.28597241, 0.46402759, 1.21402759, 1.96402759, 2.71402759, 5.71541817, 1.01617631, 0,
        0.47883746, 1.46053862, 0.14298621, -0.23201379, -0.60701379, -0.98201379, -1.35701379,
      ]);
      await expect(
        runtime.eval(`
          c(
            identical(class(profiled), "profileModel"),
            identical(dim(profiled$profiles[[1]]), c(5L, 3L)),
            identical(dim(profiled$profiles[[2]]), c(5L, 3L)),
            identical(colnames(profiled$profiles[[1]]), c("(Intercept)", "Differences", "x")),
            identical(colnames(profiled$profiles[[2]]), c("x", "Differences", "(Intercept)")),
            identical(attr(profiled, "includes.traces"), TRUE),
            identical(profiled$agreement, TRUE),
            length(getNamespaceExports("profileModel")) == 16
          )
        `),
      ).resolves.toEqual([true, true, true, true, true, true, true, true]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(
        packageCheck.passed,
        JSON.stringify({ integrity: artifact?.integrity, packageCheck }, null, 2),
      ).toBe(true);
      expect(packageCheck.firstBlocker).toBeUndefined();
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public aplpack 1.3.5 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["aplpack"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "aplpack");
    expect(artifact).toMatchObject({
      package: { name: "aplpack", version: "1.3.5" },
      compatibility: { packaging: "ready", execution: "unchecked", issues: [] },
    });
    expect(artifact?.integrity).toEqual({
      algorithm: "sha256",
      value: "1bf3afaae279ae0abc7e023c85167f25c9dcff876ccb23d564a7c6974ead224f",
    });
    try {
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
      await expect(
        runtime.eval('library("aplpack"); "package:aplpack" %in% search()'),
      ).rejects.toMatchObject({
        code: "NRE2221",
        message: "There is no installed package called 'tcltk'.",
      });
      await expect(runtime.eval('requireNamespace("aplpack", quietly = TRUE)')).resolves.toBe(
        false,
      );
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(false);
      expect(packageCheck.firstBlocker).toEqual({
        id: "namespace",
        kind: "namespace",
        message: "There is no installed package called 'tcltk'.",
        status: "failed",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);

it.runIf(runExternal)(
  "source-blind evaluates the unchanged public nor1mix 1.3-3 pure-R holdout",
  async () => {
    let runtime: Awaited<ReturnType<typeof createR>> | undefined;
    const installed = await installPackagesFromRepository(["nor1mix"], {
      repository: "https://cloud.r-project.org/",
      pack: { includeTests: true },
    });
    const artifact = installed.artifacts.find((candidate) => candidate.package.name === "nor1mix");
    expect(artifact).toMatchObject({
      package: { name: "nor1mix", version: "1.3-3" },
      compatibility: { packaging: "ready", execution: "unchecked", issues: [] },
    });
    expect(artifact?.integrity).toEqual({
      algorithm: "sha256",
      value: "4e0737231bf2e00e1e10206a958c0045f9c757084595e7f3d16ce6fed092be9f",
    });
    try {
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
      await expect(
        runtime.eval('library("nor1mix"); "package:nor1mix" %in% search()'),
      ).resolves.toBe(true);
      await expect(runtime.eval('requireNamespace("nor1mix", quietly = TRUE)')).resolves.toBe(true);
      await expect(
        runtime.eval(`
          asserted <- tools::assertWarning(
            deprecated <- norMix(mu=c(-1,2,5), sig2=c(1,.5,3))
          )
          c(inherits(deprecated, "norMix"), class(asserted[[1]]),
            conditionMessage(asserted[[1]]))
        `),
      ).resolves.toEqual([
        "TRUE",
        "deprecatedWarning",
        "warning",
        "condition",
        "The use of 'sig2' is deprecated; do specify 'sigma' (= sqrt(sig2)) instead",
      ]);
      await expect(
        runtime.eval(`
          nm <- norMix(mu=c(0,2), sigma=c(1,.5), w=c(.25,.75), name="probe")
          as.character(c(
            dim(nm), class(nm), round(dnorMix(c(0,1,2),nm),12),
            round(pnorMix(c(0,1,2),nm),12), mean(nm), var.norMix(nm),
            length(getNamespaceExports("nor1mix"))
          ))
        `),
      ).resolves.toEqual([
        "2",
        "3",
        "norMix",
        "0.099936315439",
        "0.1414791309",
        "0.61191116223",
        "0.125023753431",
        "0.227398785478",
        "0.619312467013",
        "1.5",
        "1.1875",
        "38",
      ]);
      const packageCheck = await runPackageChecks(artifact!, runtime);
      expect(packageCheck.passed).toBe(false);
      expect(packageCheck.steps.find((step) => step.id === "example:clus2norMix")).toEqual({
        id: "example:clus2norMix",
        kind: "examples",
        status: "not-applicable",
        message: "Example requires unavailable suggested package 'cluster'.",
      });
      expect(packageCheck.firstBlocker).toEqual({
        id: "example:norMixFit",
        kind: "examples",
        status: "failed",
        message: "density.default(bw='sj') is outside the initial nrd0 selector.",
      });
    } finally {
      await runtime?.dispose();
    }
  },
  300_000,
);
