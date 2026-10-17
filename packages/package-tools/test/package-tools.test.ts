import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { c as createTar } from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { createR } from "@nativr/nativr";

import {
  PackageCompatibilityError,
  comparePackageVersions,
  inspectPackage,
  installPackagesFromRepository,
  packPackage,
  preflightPackagesFromRepository,
  resolvePackageArtifacts,
  runPackageExamples,
  runPackageTests,
  verifyPackageArtifact,
} from "../src/index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("pure-R package packager", () => {
  it("rejects DESCRIPTION identity assembled from separate records", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "DESCRIPTION"),
      "Package: demopkg\n \t\nVersion: 1.2.3\n",
    );
    await expect(packPackage(packageRoot)).rejects.toThrow("exactly one DCF record");
    await expect(inspectPackage(packageRoot)).rejects.toThrow("exactly one DCF record");
  });

  it("runs every default-applicable Rd example topic and reports explicit exclusions and first failure", async () => {
    const packageRoot = await fixturePackage();
    const man = path.join(packageRoot, "man");
    await mkdir(man);
    await writeFile(
      path.join(man, "a.Rd"),
      [
        "\\name{a}",
        "\\title{First}",
        "\\examples{",
        "x <- 1",
        "\\dontrun{stop('excluded dontrun')}",
        "y <- x + 1",
        "\\donttest{stop('excluded donttest')}",
        "stopifnot(y == 2)",
        "}",
      ].join("\n"),
    );
    await writeFile(
      path.join(man, "b.Rd"),
      "\\name{b}\n\\title{Second}\n\\examples{\\dontrun{stop('not applicable')}}\n",
    );
    await writeFile(
      path.join(man, "c.Rd"),
      "\\name{c}\n\\title{Third}\n\\examples{stop('first blocker')}\n",
    );
    const archive = path.join(path.dirname(packageRoot), "demopkg-examples.tar.gz");
    await createTar({ gzip: true, file: archive, cwd: path.dirname(packageRoot) }, [
      path.basename(packageRoot),
    ]);
    const digest = createHash("sha256")
      .update(await readFile(archive))
      .digest("hex");
    const seen: string[] = [];
    const report = await runPackageExamples(
      archive,
      (script) => {
        seen.push(script.path);
        expect(script.source).not.toContain("excluded dontrun");
        expect(script.source).not.toContain("excluded donttest");
        if (script.path === "man/c.Rd") throw new Error("first blocker");
        return Promise.resolve();
      },
      {
        expectedSourceSha256: digest,
        expectedPackage: { name: "demopkg", version: "1.2.3" },
      },
    );
    expect(seen).toEqual(["man/a.Rd", "man/c.Rd"]);
    expect(report).toMatchObject({
      package: { name: "demopkg", version: "1.2.3" },
      sourceSha256: digest,
      entrypoints: [
        {
          path: "man/a.Rd",
          topic: "a",
          applicableBlocks: 3,
          excludedDontrunBlocks: 1,
          excludedDonttestBlocks: 1,
        },
        { path: "man/b.Rd", topic: "b", applicableBlocks: 0, excludedDontrunBlocks: 1 },
        { path: "man/c.Rd", topic: "c", applicableBlocks: 1 },
      ],
      executed: [
        { path: "man/a.Rd", topic: "a", status: "completed" },
        { path: "man/c.Rd", topic: "c", status: "failed" },
      ],
      outcome: "failed",
      firstBlocker: {
        code: "example-error",
        path: "man/c.Rd",
        topic: "c",
        message: "first blocker",
      },
    });
    const selected = await runPackageExamples(archive, () => Promise.resolve(), {
      expectedSourceSha256: digest,
      paths: ["man/a.Rd"],
    });
    expect(selected).toMatchObject({ outcome: "partial", executed: [{ path: "man/a.Rd" }] });
    const complete = await runPackageExamples(archive, () => Promise.resolve(), {
      expectedSourceSha256: digest,
    });
    expect(complete).toMatchObject({
      outcome: "completed",
      executed: [{ path: "man/a.Rd" }, { path: "man/c.Rd" }],
      firstBlocker: null,
    });
    await expect(
      runPackageExamples(archive, () => Promise.resolve(), {
        expectedSourceSha256: "0".repeat(64),
      }),
    ).rejects.toThrow("Package source SHA-256 mismatch");
  });

  it("distinguishes absent examples from Rd topics with no default-applicable blocks", async () => {
    const packageRoot = await fixturePackage();
    const none = await runPackageExamples(packageRoot, () =>
      Promise.reject(new Error("No example should run.")),
    );
    expect(none).toMatchObject({ outcome: "no-examples", entrypoints: [], executed: [] });
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "only.Rd"),
      "\\name{only}\n\\title{Only}\n\\examples{\\donttest{stop('excluded')}}\n",
    );
    const excluded = await runPackageExamples(packageRoot, () =>
      Promise.reject(new Error("No example should run.")),
    );
    expect(excluded).toMatchObject({
      outcome: "no-applicable",
      entrypoints: [{ path: "man/only.Rd", topic: "only", excludedDonttestBlocks: 1 }],
      executed: [],
    });
  });

  it("runs unchanged top-level source-package test scripts in order and reports the first failure", async () => {
    const packageRoot = await fixturePackage();
    const testsRoot = path.join(packageRoot, "tests");
    await mkdir(path.join(testsRoot, "testthat"), { recursive: true });
    await writeFile(path.join(testsRoot, "a.R"), "stopifnot(1 + 1 == 2)\n");
    await writeFile(path.join(testsRoot, "b.r"), "stop('package assertion failed')\n");
    await writeFile(path.join(testsRoot, "c.R"), "stop('must not run')\n");
    await writeFile(path.join(testsRoot, "a.Rout.save"), "saved output\n");
    await writeFile(path.join(testsRoot, "testthat", "test-internal.R"), "TRUE\n");
    const archive = path.join(path.dirname(packageRoot), "demopkg-tests.tar.gz");
    await createTar({ gzip: true, file: archive, cwd: path.dirname(packageRoot) }, [
      path.basename(packageRoot),
    ]);
    const digest = createHash("sha256")
      .update(await readFile(archive))
      .digest("hex");
    const seen: string[] = [];
    const report = await runPackageTests(
      archive,
      (script) => {
        seen.push(script.path);
        if (script.path === "tests/b.r") throw new Error("package assertion failed");
        expect(script.source).toBe("stopifnot(1 + 1 == 2)\n");
        expect(script.expectedOutput).toEqual({
          path: "tests/a.Rout.save",
          source: "saved output\n",
        });
        return Promise.resolve();
      },
      {
        expectedSourceSha256: digest,
        expectedPackage: { name: "demopkg", version: "1.2.3" },
      },
    );
    expect(seen).toEqual(["tests/a.R", "tests/b.r"]);
    expect(report).toMatchObject({
      package: { name: "demopkg", version: "1.2.3" },
      sourceSha256: digest,
      entrypoints: ["tests/a.R", "tests/b.r", "tests/c.R"],
      nestedRFiles: ["tests/testthat/test-internal.R"],
      outputExpectations: ["tests/a.Rout.save"],
      executed: [
        { path: "tests/a.R", status: "completed" },
        { path: "tests/b.r", status: "failed" },
      ],
      outcome: "failed",
      firstBlocker: {
        code: "test-error",
        path: "tests/b.r",
        message: "package assertion failed",
      },
    });
    await expect(
      runPackageTests(archive, () => Promise.resolve(), {
        expectedSourceSha256: "0".repeat(64),
      }),
    ).rejects.toThrow("Package source SHA-256 mismatch");
  });

  it("distinguishes absent package tests from nested files without a runnable entrypoint", async () => {
    const packageRoot = await fixturePackage();
    const noTests = await runPackageTests(packageRoot, () =>
      Promise.reject(new Error("no tests should run")),
    );
    expect(noTests).toMatchObject({ outcome: "no-tests", firstBlocker: null, entrypoints: [] });
    await mkdir(path.join(packageRoot, "tests", "testthat"), { recursive: true });
    await writeFile(path.join(packageRoot, "tests", "testthat", "test-one.R"), "TRUE\n");
    const nestedOnly = await runPackageTests(packageRoot, () =>
      Promise.reject(new Error("nested files must not run independently")),
    );
    expect(nestedOnly).toMatchObject({
      outcome: "no-entrypoint",
      firstBlocker: { code: "no-entrypoint" },
      nestedRFiles: ["tests/testthat/test-one.R"],
    });
  });
  it("builds deterministic JSON artifacts with metadata, source, resources, and integrity", async () => {
    const packageRoot = await fixturePackage();
    const first = await inspectPackage(packageRoot);
    const second = await inspectPackage(packageRoot);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      format: "nativr-pure-r-package",
      formatVersion: 1,
      package: { name: "demopkg", version: "1.2.3", license: "MIT + file LICENSE" },
      compatibility: { packaging: "ready", execution: "unchecked" },
    });
    expect(first.dependencies).toEqual([
      { name: "R", kind: "Depends", constraint: { operator: ">=", version: "4.0.0" } },
      { name: "stats", kind: "Imports" },
      { name: "helper", kind: "Suggests", constraint: { operator: ">=", version: "2.1" } },
    ]);
    expect(first.bundle.rSources).toEqual([
      { path: "R/main.R", source: "square <- function(x) x ^ 2\n" },
    ]);
    expect(first.bundle.resources.map((resource) => resource.path)).toEqual([
      "data/example.R",
      "extdata/config.json",
      "LICENSE",
    ]);
    expect(first.compatibility.issues).not.toContainEqual(
      expect.objectContaining({ path: "data/example.R" }),
    );
    expect(verifyPackageArtifact(first)).toBe(true);
    expect(
      verifyPackageArtifact({
        ...first,
        package: { ...first.package, version: "9.9.9" },
      }),
    ).toBe(false);
  });

  it("loads an unchanged packaged data script through the runtime data seam", async () => {
    const artifact = await packPackage(await fixturePackage());
    const runtime = await createR({
      execution: "inline",
      assets: {
        treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
        rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
      },
      packages: [artifact.bundle],
    });
    try {
      await expect(runtime.eval('data("example", package = "demopkg"); example')).resolves.toEqual([
        1, 2, 3,
      ]);
    } finally {
      await runtime.dispose();
    }
  });

  it("evaluates retained tools resources in a hidden read-only source context", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "tools"));
    await writeFile(path.join(packageRoot, "tools", "palette.txt"), "red\nblue\n");
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      "importFrom(stats, median)\nexport(square, source_lines, hidden_source_path)\n",
    );
    await writeFile(
      path.join(packageRoot, "R", "main.R"),
      [
        'source_lines <- readLines("tools/palette.txt")',
        'hidden_source_path <- system.file(".nativr", "source", "tools", "palette.txt", package = "demopkg")',
        "square <- function(x) x ^ 2",
        "",
      ].join("\n"),
    );

    const artifact = await packPackage(packageRoot);
    expect(artifact.bundle.resources.map((resource) => resource.path)).toContain(
      ".nativr/source/tools/palette.txt",
    );
    const resolved = resolvePackageArtifacts([artifact]);
    expect(resolved.lock.providedPackages.tools).toBe("4.6.1");

    const runtime = await createR({
      execution: "inline",
      assets: {
        treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
        rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
      },
      packages: [artifact.bundle],
    });
    try {
      await expect(runtime.eval("demopkg::source_lines")).resolves.toEqual(["red", "blue"]);
      await expect(runtime.eval("demopkg::hidden_source_path")).resolves.toBe("");
      await expect(runtime.eval('requireNamespace("tools", quietly = TRUE)')).resolves.toBe(true);
      await expect(runtime.eval('as.character(packageVersion("tools"))')).resolves.toBe("4.6.1");
    } finally {
      await runtime.dispose();
    }
  });

  it("extracts Rd examples into a deterministic package manifest and executes their controls", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\alias{square-alias}",
        "\\title{Square a value}",
        "\\description{An independently authored example fixture.}",
        "\\examples{",
        "ordinary <- square(3)",
        "\\out{illustrative output, not R code}",
        "\\dontshow{hidden <- ordinary + 1}",
        "\\testonly{tested <- hidden + 1}",
        "\\donttest{slow <- tested + 1}",
        "\\dontrun{never <- 999}",
        "final <- tested + 10",
        "}",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(packageRoot, "man", "demopkg-package.Rd"),
      [
        "\\name{demopkg-package}",
        "\\alias{demopkg}",
        "\\title{Demo package overview}",
        "\\description{Documentation without an examples section must still be searchable.}",
        "",
      ].join("\n"),
    );

    const artifact = await packPackage(packageRoot);
    const manifestResource = artifact.bundle.resources.find(
      (resource) => resource.path === ".nativr/examples-v1.json",
    );
    expect(manifestResource).toBeDefined();
    const manifest = JSON.parse(
      Buffer.from(manifestResource?.data ?? "", "base64").toString("utf8"),
    ) as { topics: { blocks: unknown[] }[] };
    expect(manifest).toMatchObject({
      format: "nativr-package-examples",
      formatVersion: 1,
    });
    expect(manifest.topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "square",
          title: "Square a value",
          aliases: ["square", "square-alias"],
        }),
      ]),
    );
    expect(manifest.topics[0]?.blocks).toEqual(
      expect.arrayContaining([
        { kind: "donttest", source: "slow <- tested + 1" },
        { kind: "dontrun", source: "never <- 999" },
      ]),
    );
    const helpResource = artifact.bundle.resources.find(
      (resource) => resource.path === ".nativr/help-v1.json",
    );
    expect(helpResource).toBeDefined();
    const helpManifest = JSON.parse(
      Buffer.from(helpResource?.data ?? "", "base64").toString("utf8"),
    ) as { topics: { aliases: string[]; sections: { name: string; text: string }[] }[] };
    expect(helpManifest).toMatchObject({
      format: "nativr-package-help",
      formatVersion: 1,
    });
    const squareHelp = helpManifest.topics.find((topic) => topic.aliases.includes("square"));
    expect(squareHelp).toMatchObject({
      title: "Square a value",
      aliases: ["square", "square-alias"],
    });
    expect(squareHelp?.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "description",
          text: "An independently authored example fixture.",
        }),
        expect.objectContaining({ name: "examples" }),
      ]),
    );
    expect(helpManifest.topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "demopkg-package",
          aliases: ["demopkg-package", "demopkg"],
        }),
      ]),
    );

    const runtime = await createR({
      execution: "inline",
      assets: {
        treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
        rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
      },
      packages: [artifact.bundle],
    });
    try {
      await expect(
        runtime.eval('utils::example("square-alias", package = "demopkg", echo = FALSE)'),
      ).resolves.toEqual([21, false]);
      await expect(runtime.eval("c(ordinary, hidden, tested, final)")).resolves.toEqual([
        9, 10, 11, 21,
      ]);
      await expect(runtime.eval("exists('slow') || exists('never')")).resolves.toBe(false);
      await expect(
        runtime.eval(`
          h <- utils::help("square-alias", package = "demopkg")
          c(
            class(h), length(h), attr(h, "topic"), attr(h, "type"),
            grepl("nativr://package/demopkg/help/square", h, fixed = TRUE)
          )
        `),
      ).resolves.toEqual(["help_files_with_topic", "1", "square-alias", "text", "TRUE"]);
      await expect(
        runtime.eval(`
          info <- utils::help(package = demopkg)
          c(class(info), info$name, info$path, length(info$info[[2]]))
        `),
      ).resolves.toEqual(["packageInfo", "demopkg", "nativr://package/demopkg", "2"]);
      const browsed = await runtime.evalDetailed(
        'print(utils::help("demopkg", package = "demopkg", help_type = "html"))',
      );
      expect(browsed.visible).toBe(false);
      expect(browsed.browseRequests).toHaveLength(1);
      const request = browsed.browseRequests[0];
      expect(request).toMatchObject({ kind: "file", mimeType: "text/html;charset=utf-8" });
      if (request?.kind === "file") {
        const html = new TextDecoder().decode(request.bytes);
        expect(html).toContain("Demo package overview");
        expect(html).toContain("Documentation without an examples section");
        expect(html).not.toContain("<script");
      }
      await expect(
        runtime.eval(
          "utils::example(square, package = 'demopkg', echo = FALSE, run.dontrun = TRUE, run.donttest = TRUE)",
        ),
      ).resolves.toEqual([21, false]);
      await expect(runtime.eval("c(slow, never)")).resolves.toEqual([12, 999]);
      const lines = await runtime.eval<string[]>(
        "utils::example(square, package = 'demopkg', give.lines = TRUE, echo = FALSE)",
      );
      expect(lines).toEqual(
        expect.arrayContaining([
          "### Name: square",
          "### Title: Square a value",
          "### Aliases: square square-alias",
        ]),
      );
      await runtime.eval("rm(ordinary, hidden, tested, slow, never, final)");
      await expect(
        runtime.eval("utils::example(square, package = 'demopkg', echo = FALSE, local = TRUE)"),
      ).resolves.toEqual([21, false]);
      await expect(
        runtime.eval(
          "exists('ordinary') || exists('hidden') || exists('tested') || exists('final')",
        ),
      ).resolves.toBe(false);

      await runtime.reset();
      await runtime.eval(".libPaths(character(), include.site = FALSE)");
      await expect(
        runtime.eval("utils::example(square, package = 'demopkg', echo = FALSE)"),
      ).rejects.toMatchObject({ code: "NRE2221" });
      await expect(
        runtime.eval(
          "utils::example(square, package = 'demopkg', lib.loc = 'nativr://package', echo = FALSE)",
        ),
      ).resolves.toEqual([21, false]);
    } finally {
      await runtime.dispose();
    }
  });

  it("indexes installed R Markdown vignettes and exposes GNU R-shaped discovery", async () => {
    const packageRoot = await fixturePackage();
    const docRoot = path.join(packageRoot, "inst", "doc");
    await mkdir(docRoot, { recursive: true });
    await writeFile(
      path.join(docRoot, "browser-guide.Rmd"),
      [
        "---",
        'title: "Using demopkg in a browser"',
        "output: html_document",
        "---",
        "",
        "This independently authored fixture documents `square()`.",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(docRoot, "browser-guide.html"),
      "<!doctype html><title>Using demopkg in a browser</title><p>Guide</p>\n",
    );
    await writeFile(path.join(docRoot, "browser-guide.R"), "square(4)\n");

    const artifact = await packPackage(packageRoot);
    const manifestResource = artifact.bundle.resources.find(
      (resource) => resource.path === ".nativr/vignettes-v1.json",
    );
    expect(manifestResource).toBeDefined();
    expect(
      JSON.parse(Buffer.from(manifestResource?.data ?? "", "base64").toString("utf8")),
    ).toEqual({
      format: "nativr-package-vignettes",
      formatVersion: 1,
      vignettes: [
        {
          topic: "browser-guide",
          title: "Using demopkg in a browser",
          file: "browser-guide.Rmd",
          r: "browser-guide.R",
          output: "browser-guide.html",
        },
      ],
    });
    expect(artifact.bundle.resources.map((resource) => resource.path)).toEqual(
      expect.arrayContaining([
        "doc/browser-guide.Rmd",
        "doc/browser-guide.R",
        "doc/browser-guide.html",
      ]),
    );

    const runtime = await createR({
      execution: "inline",
      assets: {
        treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
        rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
      },
      packages: [artifact.bundle],
    });
    try {
      await expect(runtime.eval("dim(utils::vignette(all = FALSE)$results)")).resolves.toEqual([
        0, 4,
      ]);
      await expect(
        runtime.eval('class(utils::vignette("browser-guide", package = "demopkg"))'),
      ).resolves.toBe("vignette");
      await expect(
        runtime.eval(
          'v <- utils::vignette("browser-guide", package = "demopkg"); c(v$Package, v$Dir, v$Topic, v$File, v$Title, v$R, v$PDF)',
        ),
      ).resolves.toEqual([
        "demopkg",
        "nativr://package/demopkg",
        "browser-guide",
        "browser-guide.Rmd",
        "Using demopkg in a browser",
        "browser-guide.R",
        "browser-guide.html",
      ]);
      await expect(
        runtime.eval(
          "v <- utils::vignette(demopkg::`browser-guide`); c(v$Topic, v$Title, class(v))",
        ),
      ).resolves.toEqual(["browser-guide", "Using demopkg in a browser", "vignette"]);
      await expect(
        runtime.eval(
          'x <- utils::vignette(package = "demopkg"); c(class(x), x$type, x$title, dim(x$results))',
        ),
      ).resolves.toEqual(["packageIQR", "vignette", "Vignettes", "1", "4"]);
      await expect(
        runtime.eval('x <- utils::vignette(package = "demopkg"); c(x$results)'),
      ).resolves.toEqual([
        "demopkg",
        "nativr://package",
        "browser-guide",
        "Using demopkg in a browser (source, html)",
      ]);
      await runtime.eval("library(demopkg)");
      await expect(runtime.eval("dim(utils::vignette(all = FALSE)$results)")).resolves.toEqual([
        1, 4,
      ]);
      await expect(
        runtime.eval('utils::vignette("definitely-missing", package = "demopkg")'),
      ).resolves.toBe("vignette 'definitely-missing' not found");
    } finally {
      await runtime.dispose();
    }
  });

  it("reserves generated package documentation manifest paths", async () => {
    for (const name of ["examples-v1.json", "help-v1.json", "vignettes-v1.json"]) {
      const packageRoot = await fixturePackage();
      const metadataRoot = path.join(packageRoot, "inst", ".nativr");
      await mkdir(metadataRoot, { recursive: true });
      await writeFile(path.join(metadataRoot, name), "{}\n");
      await expect(inspectPackage(packageRoot)).rejects.toThrow(
        `Package resource path '.nativr/${name}' is reserved.`,
      );
    }
  });

  it("indexes Sweave and prebuilt PDF-as-is vignette source shapes", async () => {
    const packageRoot = await fixturePackage();
    const docRoot = path.join(packageRoot, "inst", "doc");
    await mkdir(docRoot, { recursive: true });
    await writeFile(
      path.join(docRoot, "sweave-guide.Rnw"),
      "%\\VignetteIndexEntry{A Sweave guide}\n\\documentclass{article}\n",
    );
    await writeFile(path.join(docRoot, "sweave-guide.pdf"), "%PDF fixture\n");
    await writeFile(path.join(docRoot, "prebuilt-reference.pdf.asis"), "% prebuilt\n");
    await writeFile(path.join(docRoot, "prebuilt-reference.pdf"), "%PDF fixture\n");

    const artifact = await inspectPackage(packageRoot);
    const resource = artifact.bundle.resources.find(
      (candidate) => candidate.path === ".nativr/vignettes-v1.json",
    );
    expect(JSON.parse(Buffer.from(resource?.data ?? "", "base64").toString("utf8"))).toMatchObject({
      vignettes: [
        {
          topic: "sweave-guide",
          title: "A Sweave guide",
          file: "sweave-guide.Rnw",
          output: "sweave-guide.pdf",
        },
        {
          topic: "prebuilt-reference",
          title: "prebuilt-reference",
          file: "prebuilt-reference.pdf.asis",
          output: "prebuilt-reference.pdf",
        },
      ],
    });
  });

  it("retains GNU R sysdata workspaces and loads them into the package namespace", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "R", "sysdata.rda"),
      Buffer.from(
        "1f8b08000000000000060b728930e28ae0626060606260610392cc40260b139060646061e004d2eca91589b90539a90c0cccc260650c0c0210e56069c64418230948f04255304268148358f31273538bd1b4b3e62426a5e6c038658939a5a9e8da9273128b61da60825c298925897a69454013d1947316e597ebc16c023ba70148fcffffff1f90026300638b5ebdf3000000",
        "hex",
      ),
    );
    await writeFile(
      path.join(packageRoot, "R", "main.R"),
      "square <- function(x) x ^ 2\nsysdata_total <- function() sum(example$value)\n",
    );
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      "importFrom(stats, median)\nexport(square)\nexport(sysdata_total)\n",
    );

    const artifact = await packPackage(packageRoot);
    expect(artifact.compatibility.packaging).toBe("ready");
    expect(artifact.compatibility.issues).toContainEqual(
      expect.objectContaining({ code: "NRPKG1004", severity: "warning", path: "R/sysdata.rda" }),
    );
    const sysdata = artifact.bundle.resources.find((resource) => resource.path === "R/sysdata.rda");
    expect(sysdata?.data).toMatch(/^[A-Za-z0-9+/]+=*$/u);

    const runtime = await createR({
      execution: "inline",
      assets: {
        treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
        rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
      },
      packages: [artifact.bundle],
    });
    try {
      await expect(runtime.eval("demopkg::sysdata_total()")).resolves.toBe(3);
    } finally {
      await runtime.dispose();
    }
  });

  it("normalizes bzip2-compressed sysdata before it enters a browser bundle", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "R", "sysdata.rda"),
      Buffer.from(
        "425a6839314159265359ab3e0de30000347f80ffb1480000020840c500164022074b404001200054354f4d200d340683d41a6d41a6a4641a3d4d00d00037dba457295954854a7adbe680c290c1810072181416a100104018903200c804d581fbb60638e5e9766928aafd28aacd6b528362c07e2ee48a70a121567c1bc6",
        "hex",
      ),
    );
    await writeFile(
      path.join(packageRoot, "R", "main.R"),
      "sysdata_total <- function() sum(example$value)\n",
    );
    await writeFile(path.join(packageRoot, "NAMESPACE"), "export(sysdata_total)\n");

    const artifact = await packPackage(packageRoot);
    const sysdata = artifact.bundle.resources.find((resource) => resource.path === "R/sysdata.rda");
    const normalized = Buffer.from(sysdata?.data ?? "", "base64");
    expect(normalized.subarray(0, 3).toString("ascii")).not.toBe("BZh");
    expect(normalized.subarray(0, 4).toString("ascii")).toBe("RDX3");

    const runtime = await createR({
      execution: "inline",
      assets: {
        treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
        rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
      },
      packages: [artifact.bundle],
    });
    try {
      await expect(runtime.eval("demopkg::sysdata_total()")).resolves.toBe(3);
    } finally {
      await runtime.dispose();
    }
  });

  it("reads the canonical one-directory source tarball shape without extracting links", async () => {
    const packageRoot = await fixturePackage();
    const parent = path.dirname(packageRoot);
    const archive = path.join(parent, "demopkg_1.2.3.tar.gz");
    await createTar({ gzip: true, file: archive, cwd: parent }, [path.basename(packageRoot)]);

    const artifact = await packPackage(archive);
    expect(artifact.package).toMatchObject({ name: "demopkg", version: "1.2.3" });
    expect(
      artifact.bundle.resources.find((resource) => resource.path === "extdata/config.json")?.data,
    ).toBe(Buffer.from('{"scale":2}\n').toString("base64"));
  });

  it("honors Collate order and selects one explicit platform source variant", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(path.join(packageRoot, "R", "a.R"), "a <- z + 1\n");
    await writeFile(path.join(packageRoot, "R", "z.R"), "z <- 1\n");
    await mkdir(path.join(packageRoot, "R", "unix"));
    await mkdir(path.join(packageRoot, "R", "windows"));
    await writeFile(path.join(packageRoot, "R", "unix", "platform.R"), "platform <- 'unix'\n");
    await writeFile(
      path.join(packageRoot, "R", "windows", "platform.R"),
      "platform <- 'windows'\n",
    );
    const originalDescription = await readFile(path.join(packageRoot, "DESCRIPTION"), "utf8");
    await writeFile(
      path.join(packageRoot, "DESCRIPTION"),
      `${originalDescription.trimEnd()}\nCollate.unix: 'z.R' 'a.R' 'main.R' 'unix/platform.R'\nCollate.windows: 'windows/platform.R' 'main.R' 'z.R' 'a.R'\n`,
    );

    const unix = await packPackage(packageRoot);
    const windows = await packPackage(packageRoot, { sourcePlatform: "windows" });
    expect(unix.sourcePlatform).toBe("unix");
    expect(unix.bundle.rSources.map((entry) => entry.path)).toEqual([
      "R/z.R",
      "R/a.R",
      "R/main.R",
      "R/unix/platform.R",
    ]);
    expect(windows.sourcePlatform).toBe("windows");
    expect(windows.bundle.rSources.map((entry) => entry.path)).toEqual([
      "R/windows/platform.R",
      "R/main.R",
      "R/z.R",
      "R/a.R",
    ]);
  });

  it("decodes portable latin1 package metadata, namespace, and R sources", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "DESCRIPTION"),
      Buffer.from(
        "Package: demopkg\nVersion: 1.2.3\nLicense: MIT\nEncoding: latin1\nDescription: caf\xe9\nNeedsCompilation: no\n",
        "latin1",
      ),
    );
    await writeFile(
      path.join(packageRoot, "R", "main.R"),
      Buffer.from("label <- 'caf\xe9'\n", "latin1"),
    );

    const artifact = await packPackage(packageRoot);
    expect(artifact.bundle.description).toContain("Description: café");
    expect(artifact.bundle.rSources[0]?.source).toContain("'café'");
  });

  it("reports native code and install hooks, then refuses to produce a load candidate", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "src"));
    await writeFile(path.join(packageRoot, "src", "native.c"), "int demo(void) { return 1; }\n");
    await writeFile(path.join(packageRoot, "configure"), "#!/bin/sh\n");
    await writeFile(path.join(packageRoot, "NAMESPACE"), "useDynLib(demopkg)\nexport(square)\n");

    const inspected = await inspectPackage(packageRoot);
    expect(inspected.compatibility.packaging).toBe("blocked");
    expect(inspected.compatibility.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["NRPKG1001", "NRPKG1003", "NRPKG1011"]),
    );
    await expect(packPackage(packageRoot)).rejects.toBeInstanceOf(PackageCompatibilityError);
  });

  it("admits standard S4 method export directives for the runtime loader", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      "export(square)\nexportMethods(print, code)\n",
    );
    const inspected = await inspectPackage(packageRoot);
    expect(inspected.compatibility.packaging).toBe("ready");
    await expect(packPackage(packageRoot)).resolves.toMatchObject({
      bundle: { namespace: "export(square)\nexportMethods(print, code)\n" },
    });
  });

  it("enforces bounded input before constructing an artifact", async () => {
    const packageRoot = await fixturePackage();
    await expect(inspectPackage(packageRoot, { limits: { maxFiles: 2 } })).rejects.toThrow(
      "configured file or byte limits",
    );

    const archive = path.join(path.dirname(packageRoot), "bounded-input.tar.gz");
    await createTar({ gzip: true, file: archive, cwd: path.dirname(packageRoot) }, [
      path.basename(packageRoot),
    ]);
    await expect(inspectPackage(archive, { limits: { maxFiles: 2 } })).rejects.toThrow(
      "configured file or byte limits",
    );
  });

  it("aborts archive decompression at the first limit error", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(path.join(packageRoot, "a-too-big.bin"), Buffer.alloc(8192));
    await writeFile(path.join(packageRoot, "z-late.bin"), randomBytes(256 * 1024));
    const archive = path.join(path.dirname(packageRoot), "abort-limit.tar.gz");
    await createTar({ gzip: true, file: archive, cwd: packageRoot }, [
      "a-too-big.bin",
      "z-late.bin",
    ]);
    const corrupted = await readFile(archive);
    // A reader that drains to the later entry reaches the corrupt gzip trailer.
    corrupted[corrupted.length - 8] ^= 0xff;
    await writeFile(archive, corrupted);

    await expect(inspectPackage(archive, { limits: { maxFileBytes: 8 } })).rejects.toThrow(
      "Archive entry 'a-too-big.bin' exceeds the per-file byte limit.",
    );
  });

  it("resolves required dependencies in deterministic load order and emits a lock", async () => {
    const consumerRoot = await fixturePackage();
    await writeFile(
      path.join(consumerRoot, "DESCRIPTION"),
      [
        "Package: demopkg",
        "Version: 1.2.3",
        "License: MIT + file LICENSE",
        "Depends: R (>= 4.0.0)",
        "Imports: stats, helper (>= 2.1)",
        "NeedsCompilation: no",
        "",
      ].join("\n"),
    );
    const helperRoot = await fixturePackage("helper", "2.1.0");
    const consumer = await packPackage(consumerRoot);
    const helper = await packPackage(helperRoot);

    const resolved = resolvePackageArtifacts([consumer, helper], { roots: ["demopkg"] });
    expect(resolved.artifacts.map((artifact) => artifact.package.name)).toEqual([
      "helper",
      "demopkg",
    ]);
    expect(resolved.bundles).toEqual([helper.bundle, consumer.bundle]);
    expect(resolved.lock).toMatchObject({
      format: "nativr-package-lock",
      formatVersion: 1,
      roots: ["demopkg"],
      packages: [
        { name: "helper", version: "2.1.0", dependencies: [] },
        { name: "demopkg", version: "1.2.3", dependencies: ["helper"] },
      ],
    });
    expect(() => resolvePackageArtifacts([consumer], { roots: ["demopkg"] })).toThrow(
      "requires missing package 'helper'",
    );
  });

  it.each(["Imports", "Suggests"] as const)(
    "does not satisfy %s: R with the runtime version",
    async (kind) => {
      const root = await fixturePackage();
      const description = `Package: demopkg\nVersion: 1.0\nDepends: R (>= 4.6)\n${kind}: R (>= 4.0)\nNeedsCompilation: no\n`;
      await writeFile(path.join(root, "DESCRIPTION"), description);
      const artifact = await packPackage(root);
      const resolveOptions = { includeSuggests: true, providedPackages: { R: "4.6.1" } };
      expect(() => resolvePackageArtifacts([artifact], resolveOptions)).toThrow(
        "requires missing package 'R'",
      );
      expect(() => resolvePackageArtifacts([], { roots: ["R"] })).toThrow(
        "Root package 'R' was not supplied",
      );
      if (kind === "Suggests")
        expect(resolvePackageArtifacts([artifact]).artifacts).toEqual([artifact]);
      const archive = await archivePackage(root);
      const requested: string[] = [];
      const fetch_: typeof fetch = (input) => {
        const file = new URL(input instanceof Request ? input.url : input).pathname
          .split("/")
          .at(-1)!;
        requested.push(file);
        if (file === "PACKAGES.gz") return Promise.resolve(new Response(gzipSync(description)));
        if (file === "demopkg_1.0.tar.gz") return Promise.resolve(new Response(archive));
        throw new Error(`Unexpected download: ${file}`);
      };
      const options = {
        ...resolveOptions,
        repository: "https://packages.example.test/cran/",
        fetch: fetch_,
      };
      const plan = await preflightPackagesFromRepository(["demopkg"], options);
      expect(plan.blockers).toMatchObject([
        { code: "missing-package", package: "R", requiredBy: "demopkg" },
      ]);
      const rootPlan = await preflightPackagesFromRepository(["R"], options);
      expect(rootPlan.firstBlocker).toMatchObject({ code: "missing-package", package: "R" });
      await expect(installPackagesFromRepository(["R"], options)).rejects.toThrow(
        "Package 'R' is not present",
      );
      requested.length = 0;
      await expect(installPackagesFromRepository(["demopkg"], options)).rejects.toThrow(
        "requires 'R', which is absent",
      );
      expect(requested).toEqual(["PACKAGES.gz", "demopkg_1.0.tar.gz"]);
    },
  );

  it("keeps a package named R separate from runtime requirements and lock edges", async () => {
    const root = await fixturePackage();
    const description =
      "Package: demopkg\nVersion: 1.0\nDepends: R (>= 4.6)\nImports: R (>= 1.0)\nNeedsCompilation: no\n";
    await writeFile(path.join(root, "DESCRIPTION"), description);
    const namedRRoot = await fixturePackage("R", "1.0");
    const artifact = await packPackage(root);
    const namedR = await packPackage(namedRRoot);
    const resolved = resolvePackageArtifacts([artifact, namedR], { roots: ["demopkg"] });
    expect(
      resolved.lock.packages.map(({ name, dependencies }) => ({ name, dependencies })),
    ).toEqual([
      { name: "R", dependencies: [] },
      { name: "demopkg", dependencies: ["R"] },
    ]);
    const index = gzipSync(
      `${description}\n${await readFile(path.join(namedRRoot, "DESCRIPTION"), "utf8")}`,
    );
    const archives = new Map([
      ["demopkg_1.0.tar.gz", await archivePackage(root)],
      ["R_1.0.tar.gz", await archivePackage(namedRRoot)],
    ]);
    const requested: string[] = [];
    const fetch_: typeof fetch = (input) => {
      const file = new URL(input instanceof Request ? input.url : input).pathname
        .split("/")
        .at(-1)!;
      requested.push(file);
      if (file === "PACKAGES.gz") return Promise.resolve(new Response(index));
      const bytes = archives.get(file);
      if (bytes === undefined) throw new Error(`Unexpected download: ${file}`);
      return Promise.resolve(new Response(bytes));
    };
    const options = {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
      maxPackages: 2,
    };
    const plan = await preflightPackagesFromRepository(["demopkg"], options);
    expect(plan.blockers).toEqual([]);
    expect(plan.packages.map(({ name }) => name)).toEqual(["R", "demopkg"]);
    requested.length = 0;
    const installed = await installPackagesFromRepository(["demopkg"], options);
    expect(installed.lock).toEqual(resolved.lock);
    expect(requested).toEqual(["PACKAGES.gz", "demopkg_1.0.tar.gz", "R_1.0.tar.gz"]);

    // A package version constraint must also remain independent of the runtime version.
    await writeFile(
      path.join(root, "DESCRIPTION"),
      description.replace("Imports: R (>= 1.0)", "Imports: R (>= 4.0)"),
    );
    const incompatible = await packPackage(root);
    expect(() => resolvePackageArtifacts([incompatible, namedR], { roots: ["demopkg"] })).toThrow(
      "requires 'R' >= 4.0, but 1.0 is available",
    );
    archives.set("demopkg_1.0.tar.gz", await archivePackage(root));
    requested.length = 0;
    await expect(installPackagesFromRepository(["demopkg"], options)).rejects.toThrow(
      "requires 'R' >= 4.0, but 1.0 is available",
    );
    expect(requested).toEqual(["PACKAGES.gz", "demopkg_1.0.tar.gz"]);
  });

  it.each(["4.5", "4.6.1"])(
    "checks Depends: R against runtime %s even when a newer package named R exists",
    async (version) => {
      const root = await fixturePackage();
      const description =
        "Package: demopkg\nVersion: 1.0\nDepends: R (>= 4.6)\nNeedsCompilation: no\n";
      await writeFile(path.join(root, "DESCRIPTION"), description);
      const artifact = await packPackage(root);
      const namedR = await packPackage(await fixturePackage("R", "100.0"));
      const resolveOptions = { roots: ["demopkg"], providedPackages: { R: version } };
      if (version === "4.5")
        expect(() => resolvePackageArtifacts([artifact, namedR], resolveOptions)).toThrow(
          "requires 'R' >= 4.6, but 4.5 is available",
        );
      else {
        const resolved = resolvePackageArtifacts([artifact, namedR], resolveOptions);
        expect(resolved.artifacts).toEqual([artifact]);
        expect(resolved.lock.packages[0]?.dependencies).toEqual([]);
      }
      const archive = await archivePackage(root);
      const requested: string[] = [];
      const fetch_: typeof fetch = (input) => {
        const file = new URL(input instanceof Request ? input.url : input).pathname
          .split("/")
          .at(-1)!;
        requested.push(file);
        if (file === "PACKAGES.gz")
          return Promise.resolve(
            new Response(gzipSync(`${description}\nPackage: R\nVersion: 100.0\n`)),
          );
        if (file === "demopkg_1.0.tar.gz") return Promise.resolve(new Response(archive));
        throw new Error(`Unexpected download: ${file}`);
      };
      const options = {
        ...resolveOptions,
        repository: "https://packages.example.test/cran/",
        fetch: fetch_,
        maxPackages: 1,
      };
      const plan = await preflightPackagesFromRepository(["demopkg"], options);
      expect(plan.packages.map(({ name }) => name)).toEqual(["demopkg"]);
      expect(plan.blockers.map(({ code }) => code)).toEqual(
        version === "4.5" ? ["version-mismatch"] : [],
      );
      requested.length = 0;
      const install = installPackagesFromRepository(["demopkg"], options);
      if (version === "4.5")
        await expect(install).rejects.toThrow("requires 'R' >= 4.6, but 4.5 is available");
      else
        expect((await install).artifacts.map(({ package: identity }) => identity.name)).toEqual([
          "demopkg",
        ]);
      expect(requested).toEqual(["PACKAGES.gz", "demopkg_1.0.tar.gz"]);
    },
  );

  it.each(["constructor", "toString", "hasOwnProperty"])(
    "requires explicit availability for prototype-named package %s",
    async (name) => {
      expect(() => resolvePackageArtifacts([], { roots: [name] })).toThrow(
        `Root package '${name}' was not supplied.`,
      );
      expect(
        resolvePackageArtifacts([], { roots: [name], providedPackages: { [name]: "1.0" } })
          .artifacts,
      ).toEqual([]);
      const root = await fixturePackage();
      await writeFile(
        path.join(root, "DESCRIPTION"),
        `Package: demopkg\nVersion: 1.0\nImports: ${name} (>= 1.0)\nNeedsCompilation: no\n`,
      );
      const consumer = await packPackage(root);
      expect(() => resolvePackageArtifacts([consumer])).toThrow(
        `requires missing package '${name}'`,
      );
      const dependency = await packPackage(await fixturePackage(name, "1.0"));
      expect(
        resolvePackageArtifacts([consumer, dependency], { roots: ["demopkg"] }).artifacts.map(
          (artifact) => artifact.package.name,
        ),
      ).toEqual([name, "demopkg"]);
      const index = gzipSync(
        `Package: demopkg\nVersion: 1.0\nImports: ${name} (>= 1.0)\nNeedsCompilation: no\n`,
      );
      const fetch_: typeof fetch = () => Promise.resolve(new Response(index));
      const options = { repository: "https://packages.example.test/cran/", fetch: fetch_ };
      const plan = await preflightPackagesFromRepository(["demopkg"], options);
      expect(plan.firstBlocker).toMatchObject({
        code: "missing-package",
        package: name,
        requiredBy: "demopkg",
      });
      const supplied = await preflightPackagesFromRepository(["demopkg"], {
        ...options,
        providedPackages: { [name]: "1.0" },
      });
      expect(supplied.blockers).toEqual([]);
      await expect(installPackagesFromRepository([name], options)).rejects.toThrow(name);
    },
  );

  it("rejects changed or malformed installation index pins before archive requests", async () => {
    const requested: string[] = [];
    const fetch_: typeof fetch = (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      requested.push(url.href);
      if (!url.pathname.endsWith("PACKAGES.gz")) throw new Error("Unexpected archive request");
      return Promise.resolve(
        new Response(gzipSync("Package: fixture\nVersion: 1.0\nNeedsCompilation: no\n")),
      );
    };
    const options = { repository: "https://packages.example.test/cran/", fetch: fetch_ };
    await expect(
      installPackagesFromRepository(["fixture"], {
        ...options,
        expectedIndexIntegrity: `sha256-${"0".repeat(64)}`,
      }),
    ).rejects.toThrow("Repository index integrity mismatch");
    expect(requested).toEqual(["https://packages.example.test/cran/src/contrib/PACKAGES.gz"]);
    requested.length = 0;
    await expect(
      installPackagesFromRepository(["fixture"], { ...options, expectedIndexIntegrity: "bad-pin" }),
    ).rejects.toThrow("Expected repository index integrity");
    expect(requested).toEqual([]);
  });

  it.each(["cycle", "version", "limit"] as const)(
    "stops repository traversal at the first %s blocker",
    async (mode) => {
      const root = await fixturePackage();
      await writeFile(
        path.join(root, "DESCRIPTION"),
        `Package: demopkg\nVersion: 1.0\nImports: helper${mode === "version" ? " (>= 2.0)" : ""}, unused\nNeedsCompilation: no\n`,
      );
      const helperRoot = await fixturePackage("helper", "1.0");
      await writeFile(
        path.join(helperRoot, "DESCRIPTION"),
        "Package: helper\nVersion: 1.0\nImports: demopkg\nNeedsCompilation: no\n",
      );
      const archives = new Map([
        ["demopkg_1.0.tar.gz", await archivePackage(root)],
        ["helper_1.0.tar.gz", await archivePackage(helperRoot)],
      ]);
      const requested: string[] = [];
      const index = gzipSync(
        "Package: demopkg\nVersion: 1.0\n\nPackage: helper\nVersion: 1.0\n\nPackage: unused\nVersion: 1.0\n",
      );
      const fetch_: typeof fetch = (input) => {
        const url = new URL(input instanceof Request ? input.url : input);
        const file = url.pathname.split("/").at(-1)!;
        requested.push(file);
        if (file === "PACKAGES.gz") return Promise.resolve(new Response(index));
        const bytes = archives.get(file);
        if (bytes === undefined) throw new Error(`Unexpected download: ${file}`);
        return Promise.resolve(new Response(bytes));
      };
      await expect(
        installPackagesFromRepository(["demopkg"], {
          repository: "https://packages.example.test/cran/",
          fetch: fetch_,
          maxPackages: mode === "limit" ? 1 : 3,
        }),
      ).rejects.toThrow(
        mode === "cycle"
          ? "Package dependency cycle includes 'demopkg'"
          : mode === "version"
            ? "requires 'helper' >= 2.0, but 1.0 is available"
            : "exceeds the 1-package limit",
      );
      expect(requested).toEqual([
        "PACKAGES.gz",
        "demopkg_1.0.tar.gz",
        ...(mode === "cycle" ? ["helper_1.0.tar.gz"] : []),
      ]);
    },
  );

  it.each(["hidden", "stale", "constraint"] as const)(
    "uses archive dependency declarations when repository metadata is %s",
    async (mode) => {
      const root = await fixturePackage();
      const sourceImports =
        mode === "stale" ? "stats" : `helper${mode === "constraint" ? " (>= 2.0)" : ""}`;
      await writeFile(
        path.join(root, "DESCRIPTION"),
        `Package: demopkg\nVersion: 1.0\nImports: ${sourceImports}\nNeedsCompilation: no\n`,
      );
      const helperRoot = await fixturePackage("helper", "1.0");
      await writeFile(
        path.join(helperRoot, "DESCRIPTION"),
        "Package: helper\nVersion: 1.0\nImports: stats\nNeedsCompilation: no\n",
      );
      const archives = new Map([
        ["demopkg_1.0.tar.gz", await archivePackage(root)],
        ["helper_1.0.tar.gz", await archivePackage(helperRoot)],
      ]);
      const index = gzipSync(
        `Package: demopkg\nVersion: 1.0\nImports: ${mode === "stale" ? "absent" : "stats"}\nNeedsCompilation: no\n\nPackage: helper\nVersion: 1.0\nNeedsCompilation: no\n`,
      );
      const requested: string[] = [];
      const fetch_: typeof fetch = (input) => {
        const url = new URL(input instanceof Request ? input.url : input);
        const file = url.pathname.split("/").at(-1)!;
        requested.push(file);
        if (file === "PACKAGES.gz") return Promise.resolve(new Response(index));
        const bytes = archives.get(file);
        if (bytes === undefined) throw new Error(`Unexpected download: ${file}`);
        return Promise.resolve(new Response(bytes));
      };
      const options = { repository: "https://packages.example.test/cran/", fetch: fetch_ };
      const plan = await preflightPackagesFromRepository(["demopkg"], options);
      expect(plan.blockers.map((blocker) => blocker.code)).toEqual(
        mode === "stale" ? ["missing-package"] : [],
      );
      requested.length = 0;
      const install = installPackagesFromRepository(["demopkg"], {
        ...options,
        expectedIndexIntegrity: plan.indexIntegrity,
      });
      if (mode === "constraint")
        await expect(install).rejects.toThrow("requires 'helper' >= 2.0, but 1.0 is available");
      else {
        const result = await install;
        expect(result.artifacts.map((artifact) => artifact.package.name)).toEqual(
          mode === "hidden" ? ["helper", "demopkg"] : ["demopkg"],
        );
        expect(result.lock.packages.at(-1)?.dependencies).toEqual(
          mode === "hidden" ? ["helper"] : [],
        );
      }
      expect(requested).toEqual([
        "PACKAGES.gz",
        "demopkg_1.0.tar.gz",
        ...(mode === "hidden" ? ["helper_1.0.tar.gz"] : []),
      ]);
    },
  );

  it("keeps Suggests optional, checks requested optional edges, and compares R package versions", async () => {
    const artifact = await packPackage(await fixturePackage());
    expect(resolvePackageArtifacts([artifact]).artifacts).toHaveLength(1);
    expect(() => resolvePackageArtifacts([artifact], { includeSuggests: true })).toThrow(
      "requires missing package 'helper'",
    );
    expect(comparePackageVersions("1.2", "1.2.0")).toBe(0);
    expect(comparePackageVersions("1.10", "1.9.9")).toBe(1);
    expect(comparePackageVersions("1.0-2", "1.0.3")).toBe(-1);
  });

  it("installs a dependency closure from a bounded CRAN-like repository", async () => {
    const consumerRoot = await fixturePackage();
    await writeFile(
      path.join(consumerRoot, "DESCRIPTION"),
      "Package: demopkg\nVersion: 1.2.3\nImports: stats, helper (>= 2.1)\nNeedsCompilation: no\n",
    );
    const helperRoot = await fixturePackage("helper", "2.1.0");
    const consumerArchive = await archivePackage(consumerRoot);
    const helperArchive = await archivePackage(helperRoot);
    const consumerMd5 = createHash("md5").update(consumerArchive).digest("hex");
    const helperMd5 = createHash("md5").update(helperArchive).digest("hex");
    const index = [
      "Package: demopkg",
      "Version: 1.2.3",
      "Imports: stats, helper (>= 2.1)",
      "NeedsCompilation: no",
      `MD5sum: ${consumerMd5}`,
      "",
      "Package: helper",
      "Version: 2.1.0",
      "Imports: stats",
      "NeedsCompilation: no",
      `MD5sum: ${helperMd5}`,
      "",
    ].join("\n");
    const fetch_: typeof fetch = (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith("/PACKAGES.gz"))
        return Promise.resolve(new Response(gzipSync(index)));
      if (url.pathname.endsWith("/demopkg_1.2.3.tar.gz"))
        return Promise.resolve(new Response(consumerArchive));
      if (url.pathname.endsWith("/helper_2.1.0.tar.gz"))
        return Promise.resolve(new Response(helperArchive));
      return Promise.resolve(new Response("missing", { status: 404 }));
    };

    const plan = await preflightPackagesFromRepository(["demopkg"], {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
    });
    const installed = await installPackagesFromRepository(["demopkg"], {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
      expectedIndexIntegrity: plan.indexIntegrity,
      maxPackages: 2,
    });
    expect(installed.repository).toBe("https://packages.example.test/cran/");
    expect(installed.indexIntegrity).toMatch(/^sha256-[a-f0-9]{64}$/u);
    expect(installed.artifacts.map((artifact) => artifact.package.name)).toEqual([
      "helper",
      "demopkg",
    ]);
    expect(installed.lock.roots).toEqual(["demopkg"]);
  });

  it("preflights a dependency closure from index metadata without fetching archives", async () => {
    const index = [
      "Package: lifecycle",
      "Version: 1.0.5",
      "Depends: R (>= 3.6)",
      "Imports: cli (>= 3.4.0), rlang (>= 1.1.0)",
      "Suggests: optionalpkg",
      "NeedsCompilation: no",
      "",
      "Package: cli",
      "Version: 3.6.6",
      "Imports: utils",
      "NeedsCompilation: yes",
      "",
      "Package: rlang",
      "Version: 1.3.0",
      "Imports: utils",
      "NeedsCompilation: yes",
      "",
    ].join("\n");
    const compressed = gzipSync(index);
    const requested: string[] = [];
    const fetch_: typeof fetch = (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      requested.push(url.href);
      if (url.pathname.endsWith("/PACKAGES.gz")) {
        return Promise.resolve(new Response(compressed));
      }
      throw new Error(`Preflight requested a package archive: ${url.href}`);
    };

    const plan = await preflightPackagesFromRepository(["lifecycle"], {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
    });
    expect(requested).toEqual(["https://packages.example.test/cran/src/contrib/PACKAGES.gz"]);
    expect(plan.indexIntegrity).toBe(
      `sha256-${createHash("sha256").update(compressed).digest("hex")}`,
    );
    expect(plan.sourceArchiveIntegrity).toBe("unverified");
    expect(plan.roots).toEqual(["lifecycle"]);
    expect(plan.packages.map((entry) => entry.name)).toEqual(["cli", "rlang", "lifecycle"]);
    expect(plan.packages[2]).toMatchObject({
      version: "1.0.5",
      sourceUrl: "https://packages.example.test/cran/src/contrib/lifecycle_1.0.5.tar.gz",
    });
    expect(plan.blockers.map((blocker) => blocker.code)).toEqual([
      "needs-compilation",
      "needs-compilation",
    ]);
    expect(plan.firstBlocker).toMatchObject({
      code: "needs-compilation",
      package: "cli",
      requiredBy: "lifecycle",
    });
    expect(plan.packages[2]?.requirements.map((dependency) => dependency.name)).toEqual([
      "R",
      "cli",
      "rlang",
    ]);

    const withSuggests = await preflightPackagesFromRepository(["lifecycle"], {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
      includeSuggests: true,
      expectedIndexIntegrity: plan.indexIntegrity,
    });
    expect(withSuggests.blockers.at(-1)).toMatchObject({
      code: "missing-package",
      package: "optionalpkg",
      requiredBy: "lifecycle",
    });
  });

  it("rejects a changed index pin and reports metadata version blockers", async () => {
    const index = [
      "Package: consumer",
      "Version: 1.0.0",
      "Imports: helper (>= 2.1), absent",
      "NeedsCompilation: no",
      "",
      "Package: helper",
      "Version: 2.0.0",
      "NeedsCompilation: no",
      "",
    ].join("\n");
    const fetch_: typeof fetch = (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith("/PACKAGES.gz")) return Promise.resolve(new Response(index));
      throw new Error(`Preflight requested a package archive: ${url.href}`);
    };
    const plan = await preflightPackagesFromRepository(["consumer"], {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
    });
    expect(plan.packages.map((entry) => entry.name)).toEqual(["helper", "consumer"]);
    expect(plan.firstBlocker).toMatchObject({
      code: "version-mismatch",
      package: "helper",
      requiredBy: "consumer",
    });
    expect(plan.blockers[1]).toMatchObject({
      code: "missing-package",
      package: "absent",
      requiredBy: "consumer",
    });
    await expect(
      preflightPackagesFromRepository(["consumer"], {
        repository: "https://packages.example.test/cran/",
        fetch: fetch_,
        expectedIndexIntegrity: `sha256-${"0".repeat(64)}`,
      }),
    ).rejects.toThrow("Repository index integrity mismatch");
  });

  it("stops reading an unbounded repository index stream at the configured byte limit", async () => {
    let cancelled = false;
    const fetch_: typeof fetch = (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (!url.pathname.endsWith("/PACKAGES.gz")) {
        throw new Error(`Preflight requested a package archive: ${url.href}`);
      }
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("x".repeat(20)));
        },
        cancel() {
          cancelled = true;
        },
      });
      return Promise.resolve(new Response(body));
    };
    await expect(
      preflightPackagesFromRepository(["consumer"], {
        repository: "https://packages.example.test/cran/",
        fetch: fetch_,
        maxDownloadBytes: 10,
      }),
    ).rejects.toThrow("exceeds the 10-byte limit");
    expect(cancelled).toBe(true);
  });

  it("rejects a repository archive that does not match its index digest", async () => {
    const packageRoot = await fixturePackage();
    const archive = await archivePackage(packageRoot);
    const index = [
      "Package: demopkg",
      "Version: 1.2.3",
      "MD5sum: 00000000000000000000000000000000",
      "",
    ].join("\n");
    const fetch_: typeof fetch = (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith("/PACKAGES.gz")) return Promise.resolve(new Response(index));
      if (url.pathname.endsWith("/demopkg_1.2.3.tar.gz"))
        return Promise.resolve(new Response(archive));
      return Promise.resolve(new Response("missing", { status: 404 }));
    };

    await expect(
      installPackagesFromRepository(["demopkg"], {
        repository: "https://packages.example.test/cran/",
        fetch: fetch_,
      }),
    ).rejects.toThrow("Repository digest mismatch");
  });
});

async function fixturePackage(name = "demopkg", version = "1.2.3"): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-package-test-"));
  temporaryRoots.push(temporaryRoot);
  const packageRoot = path.join(temporaryRoot, name);
  await mkdir(path.join(packageRoot, "R"), { recursive: true });
  await mkdir(path.join(packageRoot, "inst", "extdata"), { recursive: true });
  await mkdir(path.join(packageRoot, "data"), { recursive: true });
  await writeFile(
    path.join(packageRoot, "DESCRIPTION"),
    [
      `Package: ${name}`,
      `Version: ${version}`,
      "License: MIT + file LICENSE",
      "Depends: R (>= 4.0.0)",
      "Imports: stats",
      "Suggests: helper (>= 2.1)",
      "NeedsCompilation: no",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(packageRoot, "NAMESPACE"),
    "importFrom(stats, median)\nexport(square)\n",
  );
  await writeFile(path.join(packageRoot, "R", "main.R"), "square <- function(x) x ^ 2\n");
  await writeFile(path.join(packageRoot, "inst", "extdata", "config.json"), '{"scale":2}\n');
  await writeFile(path.join(packageRoot, "data", "example.R"), "example <- 1:3\n");
  await writeFile(path.join(packageRoot, "LICENSE"), "YEAR: 2026\nCOPYRIGHT HOLDER: Example\n");
  return packageRoot;
}

async function archivePackage(packageRoot: string): Promise<Uint8Array> {
  const archive = path.join(
    path.dirname(packageRoot),
    `${path.basename(packageRoot)}_${randomUUID()}.tar.gz`,
  );
  await createTar({ gzip: true, file: archive, cwd: path.dirname(packageRoot) }, [
    path.basename(packageRoot),
  ]);
  return readFile(archive);
}
