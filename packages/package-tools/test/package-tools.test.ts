import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { c as createTar } from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { createR } from "@nativr/nativr";

import {
  DEFAULT_PACKAGE_PACK_LIMITS,
  PackageCompatibilityError,
  comparePackageVersions,
  createPackageCheckPlan,
  inspectPackage,
  installPackagesFromRepository,
  normalizePackageCheckOutput,
  packPackage,
  resolvePackageArtifacts,
  runPackageChecks,
  verifyPackageArtifact,
} from "../src/index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("pure-R package packager", () => {
  it("keeps normalized package files bounded beneath the aggregate resource ceiling", () => {
    expect(DEFAULT_PACKAGE_PACK_LIMITS).toMatchObject({
      maxFileBytes: 64 * 1024 * 1024,
      maxTotalBytes: 192 * 1024 * 1024,
    });
    expect(DEFAULT_PACKAGE_PACK_LIMITS.maxFileBytes).toBeLessThan(
      DEFAULT_PACKAGE_PACK_LIMITS.maxTotalBytes,
    );
  });

  it("builds deterministic JSON artifacts with metadata, source, resources, and integrity", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(path.join(packageRoot, "NEWS.md"), "# Changes\n\nPortable release notes.\n");
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
      "NEWS.md",
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

  it("maps documented LazyData object names to differently-cased data resources", async () => {
    const packageRoot = await fixturePackage();
    const descriptionPath = path.join(packageRoot, "DESCRIPTION");
    await writeFile(descriptionPath, `${await readFile(descriptionPath, "utf8")}LazyData: yes\n`);
    await writeFile(path.join(packageRoot, "data", "lower.R"), "Lower <- 4:6\n");
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "Lower.Rd"),
      [
        "\\name{Lower}",
        "\\docType{data}",
        "\\alias{Lower}",
        "\\title{Differently-cased public data}",
        "\\usage{Lower}",
        "\\examples{stopifnot(identical(Lower, 4:6))}",
        "",
      ].join("\n"),
    );
    const artifact = await packPackage(packageRoot);
    const manifest = artifact.bundle.resources.find(
      (resource) => resource.path === ".nativr/datasets-v1.json",
    );
    expect(JSON.parse(Buffer.from(manifest?.data ?? "", "base64").toString("utf8"))).toEqual({
      format: "nativr-package-datasets",
      formatVersion: 1,
      datasets: [{ name: "Lower", resource: "lower" }],
    });

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
        runtime.eval(`
          library(demopkg)
          c(
            "Lower" %in% ls("package:demopkg"),
            "lower" %in% ls("package:demopkg"),
            identical(Lower, 4:6)
          )
        `),
      ).resolves.toEqual([true, false, true]);
    } finally {
      await runtime.dispose();
    }
  });

  it("preserves source-package tests as inert resources for explicit P6 execution", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "tests"));
    await writeFile(path.join(packageRoot, "tests", "fixture.txt"), "portable fixture\n");
    await writeFile(
      path.join(packageRoot, "tests", "package.R"),
      [
        'fixture <- readLines("fixture.txt")',
        'stopifnot(identical(square(4), 16), identical(fixture, "portable fixture"))',
        "c(value = square(3), fixture = fixture)",
        "",
      ].join("\n"),
    );
    await writeFile(path.join(packageRoot, "tests", "package.Rout.save"), "reference output\n");

    const defaultArtifact = await packPackage(packageRoot);
    expect(defaultArtifact.bundle.resources.map((resource) => resource.path)).not.toContain(
      ".nativr/tests-v1.json",
    );
    const artifact = await packPackage(packageRoot, { includeTests: true });
    const manifestResource = artifact.bundle.resources.find(
      (resource) => resource.path === ".nativr/tests-v1.json",
    );
    expect(manifestResource).toBeDefined();
    expect(
      JSON.parse(Buffer.from(manifestResource?.data ?? "", "base64").toString("utf8")),
    ).toEqual({
      format: "nativr-package-tests",
      formatVersion: 1,
      scripts: [{ path: "package.R", expectedOutput: "package.Rout.save" }],
    });
    expect(artifact.bundle.resources.map((resource) => resource.path)).toEqual(
      expect.arrayContaining([
        ".nativr/tests/fixture.txt",
        ".nativr/tests/package.R",
        ".nativr/tests/package.Rout.save",
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
        runtime.eval(`
          library(demopkg)
          tests <- system.file(".nativr", "tests", package = "demopkg")
          source(file.path(tests, "package.R"), chdir = TRUE)$value
        `),
      ).resolves.toEqual(["9", "portable fixture"]);
    } finally {
      await runtime.dispose();
    }
  });

  it("classifies GNU R session-bound saved output without skipping its retained test", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        "",
      ].join("\n"),
    );
    await mkdir(path.join(packageRoot, "tests"));
    await writeFile(path.join(packageRoot, "tests", "package.R"), "stopifnot(square(4) == 16)\n");
    await writeFile(
      path.join(packageRoot, "tests", "package.Rout.save"),
      [
        'R version 4.5.0 (2025-04-11) -- "How About a Twenty-Six"',
        "Copyright (C) 2025 The R Foundation for Statistical Computing",
        "Platform: x86_64-pc-linux-gnu",
        "",
        "> stopifnot(square(4) == 16)",
        "> proc.time()",
        "   user  system elapsed",
        "  0.318   0.035   0.343",
        "",
      ].join("\n"),
    );
    const artifact = await packPackage(packageRoot, { includeTests: true });
    const plan = createPackageCheckPlan(artifact);
    const savedOutput = plan.steps.find((step) => step.id === "saved-output:package.R");
    expect(savedOutput).toEqual({
      id: "saved-output:package.R",
      kind: "saved-output",
      label: "saved output package.Rout.save",
      notApplicableReason:
        "The saved output contains a GNU R version/platform session header and is host-bound; the corresponding retained test remains applicable.",
    });

    for (const historicalHeader of [
      [
        'R Under development (unstable) (2019-04-24 r76419) -- "Unsuffered Consequences"',
        "Copyright (C) 2019 The R Foundation for Statistical Computing",
        "Platform: x86_64-pc-linux-gnu (64-bit)",
      ],
      [
        "R : Copyright 2004, The R Foundation for Statistical Computing",
        "Version 2.0.0 beta (2004-09-27), ISBN 3-900051-07-0",
      ],
    ]) {
      await writeFile(
        path.join(packageRoot, "tests", "package.Rout.save"),
        [...historicalHeader, "", "> stopifnot(square(4) == 16)", ""].join("\n"),
      );
      const historicalArtifact = await packPackage(packageRoot, { includeTests: true });
      expect(
        createPackageCheckPlan(historicalArtifact).steps.find(
          (step) => step.id === "saved-output:package.R",
        ),
      ).toMatchObject({
        kind: "saved-output",
        notApplicableReason:
          "The saved output contains a GNU R version/platform session header and is host-bound; the corresponding retained test remains applicable.",
      });
    }

    const executed: string[] = [];
    const result = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) => {
        executed.push(code);
        return Promise.resolve({ value: null, warnings: [], output: [] });
      },
    });
    expect(result.steps.find((step) => step.id === "test:package.R")).toMatchObject({
      status: "passed",
    });
    expect(result.steps.find((step) => step.id === "saved-output:package.R")).toEqual({
      id: "saved-output:package.R",
      kind: "saved-output",
      status: "not-applicable",
      message:
        "The saved output contains a GNU R version/platform session header and is host-bound; the corresponding retained test remains applicable.",
    });
    expect(executed.some((code) => code.includes("expressions[[expression_index]]"))).toBe(true);
    expect(executed.some((code) => code.includes("withVisible"))).toBe(false);
  });

  it("runs package tests from an isolated writable browser-memory copy", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "tests"));
    await writeFile(path.join(packageRoot, "tests", "fixture.txt"), "portable fixture\n");
    await writeFile(
      path.join(packageRoot, "tests", "sandbox.R"),
      [
        'fixture <- readLines("fixture.txt")',
        'writeLines(c(fixture, "generated"), "generated.txt")',
        'stopifnot(identical(readLines("generated.txt"), c("portable fixture", "generated")))',
        "",
      ].join("\n"),
    );
    const artifact = await packPackage(packageRoot, { includeTests: true });
    const runtime = await createR({
      execution: "inline",
      assets: {
        treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
        rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
      },
      packages: [artifact.bundle],
    });
    try {
      const result = await runPackageChecks(artifact, runtime);
      expect(result.steps.find((step) => step.id === "test:sandbox.R")).toEqual({
        id: "test:sandbox.R",
        kind: "tests",
        status: "passed",
      });
      await expect(
        runtime.eval(`
          tests <- system.file(".nativr", "tests", package = "demopkg")
          c(
            startsWith(getwd(), tempdir()),
            file.exists("fixture.txt"),
            file.exists("generated.txt"),
            file.exists(file.path(tests, "generated.txt"))
          )
        `),
      ).resolves.toEqual([true, true, true, false]);
    } finally {
      await runtime.dispose();
    }
  });

  it("plans and runs isolated browser-admissible P7 package checks generically", async () => {
    expect(normalizePackageCheckOutput("\r\n> value <- 1\r\n+ value\r\n[1] 1  \r\n")).toBe("[1] 1");
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        "\\examples{stopifnot(identical(square(3), 9))}",
        "",
      ].join("\n"),
    );
    await mkdir(path.join(packageRoot, "tests"));
    await writeFile(path.join(packageRoot, "tests", "square.R"), "stopifnot(square(4) == 16)\n");
    const artifact = await packPackage(packageRoot, { includeTests: true });
    const plan = createPackageCheckPlan(artifact);

    expect(plan).toMatchObject({
      format: "nativr-package-check-plan",
      formatVersion: 1,
      package: { name: "demopkg", version: "1.2.3" },
    });
    expect(plan.steps.map((step) => step.id)).toEqual([
      "metadata",
      "namespace",
      "attachment",
      "documentation:exports",
      "documentation:square",
      "example:square",
      "test:square.R",
      "vignettes",
    ]);
    const executed: string[] = [];
    let resets = 0;
    const result = await runPackageChecks(artifact, {
      reset() {
        resets += 1;
        return Promise.resolve();
      },
      evalDetailed(code) {
        executed.push(code);
        return Promise.resolve({
          value: code.includes(".nativr_package_check_expressions <-") ? 1 : null,
          warnings: [],
          output: [],
        });
      },
    });
    expect(result.passed).toBe(true);
    expect(result.firstBlocker).toBeUndefined();
    expect(result.steps.map((step) => step.status)).toEqual([
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "not-applicable",
    ]);
    expect(resets).toBe(7);
    expect(executed).toHaveLength(8);
    expect(executed.at(-2)).toContain(".nativr_package_check_expressions <- parse");
    expect(executed.at(-2)).toContain('tempfile("nativr-package-check-")');
    expect(executed.at(-2)).toContain("file.copy(.nativr_package_check_entries");
    expect(executed.at(-1)).toContain("[[1L]]");
  });

  it("maps standard S4 class and method Rd aliases to namespace exports", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      [
        "export(square)",
        "exportClasses(DemoClass)",
        'exportMethods(show, "[", "+", "-", Ops)',
        "",
      ].join("\n"),
    );
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "DemoClass.Rd"),
      [
        "\\name{DemoClass-class}",
        "\\alias{DemoClass-class}",
        "\\alias{show,DemoClass-method}",
        "\\alias{[,DemoClass,ANY-method}",
        "\\alias{Ops,DemoClass,DemoClass-method}",
        "\\alias{square}",
        "\\title{A documented S4 class}",
        "",
      ].join("\n"),
    );

    const plan = createPackageCheckPlan(await packPackage(packageRoot));
    const documentation = plan.steps.find((step) => step.id === "documentation:exports");
    expect(documentation?.code).toContain('".__C__DemoClass"');
    expect(documentation?.code).toContain('"show"');
    expect(documentation?.code).toContain('"["');
    expect(documentation?.code).toContain('"square"');
    expect(documentation?.code).toContain('"+"');
    expect(documentation?.code).toContain('"-"');
    expect(documentation?.code).toContain('!startsWith(undocumented, ".__T__")');
  });

  it("classifies standard package lifecycle hooks outside ordinary export documentation", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      ["export(square)", "export(.onAttach)", "export(.onUnload)", ""].join("\n"),
    );
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        "",
      ].join("\n"),
    );

    const plan = createPackageCheckPlan(await packPackage(packageRoot));
    const documentation = plan.steps.find((step) => step.id === "documentation:exports");
    expect(documentation?.code).toContain('".onAttach"');
    expect(documentation?.code).toContain('".onUnload"');
    expect(documentation?.code).toContain('"square"');
  });

  it("does not fail guarded examples for unavailable declared Suggests", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        "\\examples{if (!require(helper)) return(); square(3)}",
        "",
      ].join("\n"),
    );
    const artifact = await packPackage(packageRoot);
    const result = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        Promise.resolve({
          warnings: code.includes('utils::example("square"')
            ? [{ code: "NRW1115", message: "there is no package called 'helper'" }]
            : [],
          output: [],
        }),
    });
    expect(result.passed).toBe(true);

    const actionable = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        Promise.resolve({
          warnings: code.includes('utils::example("square"')
            ? [
                { code: "NRW1115", message: "there is no package called 'helper'" },
                { code: "NRW1999", message: "real semantic warning" },
              ]
            : [],
          output: [],
        }),
    });
    expect(actionable.firstBlocker).toBeUndefined();
    expect(actionable.steps.find((step) => step.id === "example:square")).toMatchObject({
      id: "example:square",
      status: "passed",
      warningCount: 1,
    });
  });

  it("marks examples with a top-level unavailable optional require as not applicable", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        "\\examples{square(2)",
        'require("helper")',
        "helper_fit(square(3))}",
        "",
      ].join("\n"),
    );
    const artifact = await packPackage(packageRoot);
    const result = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: () => Promise.resolve({ value: null, warnings: [], output: [] }),
    });
    expect(result.steps.find((step) => step.id === "example:square")).toEqual({
      id: "example:square",
      kind: "examples",
      status: "not-applicable",
      message: "Example requires unavailable suggested package 'helper'.",
    });
  });

  it("marks retained tests as not applicable when their declared suggested framework is absent", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        "",
      ].join("\n"),
    );
    await mkdir(path.join(packageRoot, "tests"));
    await writeFile(path.join(packageRoot, "tests", "helper.R"), 'library("helper")\n');
    const artifact = await packPackage(packageRoot, { includeTests: true });
    const result = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) => {
        if (code.includes(".nativr_package_check_expressions <-")) {
          return Promise.resolve({ value: 1, warnings: [], output: [] });
        }
        if (code.includes("[[1L]]")) {
          return Promise.reject(
            new Error("expression 1: There is no installed package called 'helper'."),
          );
        }
        return Promise.resolve({ value: null, warnings: [], output: [] });
      },
    });
    expect(result.passed).toBe(true);
    expect(result.firstBlocker).toBeUndefined();
    expect(result.steps.find((step) => step.id === "test:helper.R")).toEqual({
      id: "test:helper.R",
      kind: "tests",
      status: "not-applicable",
      message: "Test requires unavailable suggested package 'helper'.",
    });
  });

  it("classifies saved-output execution consistently when its retained test needs Suggests", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "tests"));
    await writeFile(path.join(packageRoot, "tests", "helper.R"), 'library("helper")\n');
    await writeFile(path.join(packageRoot, "tests", "helper.Rout.save"), '> library("helper")\n');
    const artifact = await packPackage(packageRoot, { includeTests: true });
    const result = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        code.includes("withVisible")
          ? Promise.reject(
              new Error("expression 1: There is no installed package called 'helper'."),
            )
          : Promise.resolve({ value: 1, warnings: [], output: [] }),
    });
    expect(result.steps.find((step) => step.id === "saved-output:helper.R")).toEqual({
      id: "saved-output:helper.R",
      kind: "saved-output",
      status: "not-applicable",
      message: "Saved-output test requires unavailable suggested package 'helper'.",
    });
  });

  it("marks examples as not applicable only when errors name a declared unavailable Suggests", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        "\\examples{stop(\"Package 'helper' missing -- install from CRAN.\")}",
        "",
      ].join("\n"),
    );
    const artifact = await packPackage(packageRoot);
    const result = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        code.includes('utils::example("square"')
          ? Promise.reject(new Error("Package 'helper' missing -- install from CRAN."))
          : Promise.resolve({ value: null, warnings: [], output: [] }),
    });
    expect(result.passed).toBe(true);
    expect(result.firstBlocker).toBeUndefined();
    expect(result.steps.find((step) => step.id === "example:square")).toEqual({
      id: "example:square",
      kind: "examples",
      status: "not-applicable",
      message: "Example requires unavailable suggested package 'helper'.",
    });

    const needed = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        code.includes('utils::example("square"')
          ? Promise.reject(new Error("helper needed for this function to work. Please install it."))
          : Promise.resolve({ value: null, warnings: [], output: [] }),
    });
    expect(needed.passed).toBe(true);
    expect(needed.steps.find((step) => step.id === "example:square")).toEqual({
      id: "example:square",
      kind: "examples",
      status: "not-applicable",
      message: "Example requires unavailable suggested package 'helper'.",
    });

    for (const message of [
      "This function requires the package 'helper'. You can install it from CRAN.",
      "This function requires the recommended package dQuote(helper).",
      "Namespace 'helper' is not registered.",
      "Please install the `helper` package.",
    ]) {
      const guarded = await runPackageChecks(artifact, {
        reset: () => Promise.resolve(),
        evalDetailed: (code) =>
          code.includes('utils::example("square"')
            ? Promise.reject(new Error(message))
            : Promise.resolve({ value: null, warnings: [], output: [] }),
      });
      expect(guarded.passed).toBe(true);
      expect(guarded.steps.find((step) => step.id === "example:square")).toEqual({
        id: "example:square",
        kind: "examples",
        status: "not-applicable",
        message: "Example requires unavailable suggested package 'helper'.",
      });
    }

    const unavailableResource = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        code.includes('utils::example("square"')
          ? Promise.reject(
              Object.assign(new Error("no file found"), {
                code: "NRE2234",
                details: {
                  operation: "system.file",
                  package: "helper",
                  packageInstalled: false,
                },
              }),
            )
          : Promise.resolve({ value: null, warnings: [], output: [] }),
    });
    expect(unavailableResource.steps.find((step) => step.id === "example:square")).toEqual({
      id: "example:square",
      kind: "examples",
      status: "not-applicable",
      message: "Example requires unavailable suggested package 'helper'.",
    });

    for (const details of [
      { operation: "system.file", package: "helper", packageInstalled: true },
      { operation: "system.file", package: "undeclared", packageInstalled: false },
    ]) {
      const retainedFailure = await runPackageChecks(artifact, {
        reset: () => Promise.resolve(),
        evalDetailed: (code) =>
          code.includes('utils::example("square"')
            ? Promise.reject(
                Object.assign(new Error("no file found"), {
                  code: "NRE2234",
                  details,
                }),
              )
            : Promise.resolve({ value: null, warnings: [], output: [] }),
      });
      expect(retainedFailure.firstBlocker).toMatchObject({
        id: "example:square",
        status: "failed",
        message: "no file found",
      });
    }

    const unrelated = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        code.includes('utils::example("square"')
          ? Promise.reject(new Error("Package 'undeclared' missing -- install from CRAN."))
          : Promise.resolve({ value: null, warnings: [], output: [] }),
    });
    expect(unrelated.firstBlocker).toMatchObject({
      id: "example:square",
      status: "failed",
      message: "Package 'undeclared' missing -- install from CRAN.",
    });
    const unrelatedNeeded = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        code.includes('utils::example("square"')
          ? Promise.reject(
              new Error("undeclared needed for this function to work. Please install it."),
            )
          : Promise.resolve({ value: null, warnings: [], output: [] }),
    });
    expect(unrelatedNeeded.firstBlocker).toMatchObject({
      id: "example:square",
      status: "failed",
      message: "undeclared needed for this function to work. Please install it.",
    });
  });

  it("classifies explicit system-command host requirements without granting ambient authority", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        '\\examples{system("viewer output.ps")}',
        "",
      ].join("\n"),
    );
    const artifact = await packPackage(packageRoot);
    const result = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        code.includes('utils::example("square"')
          ? Promise.reject(
              new Error(
                "system()/system2()/pipe() requires an explicit createR({ systemCommand }) host capability.",
              ),
            )
          : Promise.resolve({ value: null, warnings: [], output: [] }),
    });

    expect(result.passed).toBe(true);
    expect(result.firstBlocker).toBeUndefined();
    expect(result.steps.find((step) => step.id === "example:square")).toEqual({
      id: "example:square",
      kind: "examples",
      status: "not-applicable",
      message:
        "Example requires an explicit system-command host adapter outside the default browser-admissible runtime.",
    });
  });

  it("marks examples as not applicable when they require an unavailable Enhances package", async () => {
    const packageRoot = await fixturePackage();
    const descriptionPath = path.join(packageRoot, "DESCRIPTION");
    const description = await readFile(descriptionPath, "utf8");
    await writeFile(
      descriptionPath,
      description.replace("NeedsCompilation: no", "Enhances: enhancer\nNeedsCompilation: no"),
    );
    await mkdir(path.join(packageRoot, "man"));
    await writeFile(
      path.join(packageRoot, "man", "square.Rd"),
      [
        "\\name{square}",
        "\\alias{square}",
        "\\title{Square a value}",
        "\\usage{square(x)}",
        "\\examples{enhancer::enabled(); square(3)}",
        "",
      ].join("\n"),
    );
    const artifact = await packPackage(packageRoot);
    expect(artifact.dependencies).toContainEqual({ name: "enhancer", kind: "Enhances" });
    const result = await runPackageChecks(artifact, {
      reset: () => Promise.resolve(),
      evalDetailed: (code) =>
        code.includes('utils::example("square"')
          ? Promise.reject(new Error("Namespace 'enhancer' is not registered."))
          : Promise.resolve({ value: null, warnings: [], output: [] }),
    });
    expect(result.passed).toBe(true);
    expect(result.firstBlocker).toBeUndefined();
    expect(result.steps.find((step) => step.id === "example:square")).toEqual({
      id: "example:square",
      kind: "examples",
      status: "not-applicable",
      message: "Example requires unavailable optional package 'enhancer' declared in Enhances.",
    });
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
        "%\\examples{",
        "% commented <- stop('not executable')",
        "%}",
        "\\examples{",
        "ordinary <- square(3)",
        "% ignored <- stop('not executable')",
        'percent <- "\\%"',
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
    const runBlock = manifest.topics[0]?.blocks.find((block) => block.kind === "run");
    expect(runBlock?.source).toContain('percent <- "%"');
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
    expect(
      createPackageCheckPlan(artifact).steps.find((step) => step.kind === "vignettes")?.code,
    ).toContain("$File");
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

  it("normalizes xz-compressed sysdata before it enters a browser bundle", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "R", "sysdata.rda"),
      Buffer.from(
        "fd377a585a000004e6d6b4460200210116000000742fe5a3e000f2007b5d00291107545722e46e52ca9f92d92521b606e1fa1daec87daa872c1abc22c3010f8e4bba95c3f132fd6da68dcb6074c4aaeb1466816a3bc7e7631c45dcf4a1e3a9311e2c1705bcf95027064a66fabe8e81bf34d95fe1481dabe8a8d97fb6aa7a0252eb300f429c0e95dc0d25c5b850bfc01a08038dd97ee51f0060000000bba18fc79d2a2c6100019701f3010000e808476bb1c467fb020000000004595a",
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
    expect(normalized.subarray(0, 6).toString("hex")).not.toBe("fd377a585a00");
    expect(normalized.subarray(0, 4).toString("ascii")).toBe("RDX2");

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

  it("discovers every standard R package source-file extension", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(path.join(packageRoot, "R", "legacy.q"), "legacy_q <- 1\n");
    await writeFile(path.join(packageRoot, "R", "upper.S"), "upper_s <- 2\n");
    await writeFile(path.join(packageRoot, "R", "lower.r"), "lower_r <- 3\n");
    await writeFile(path.join(packageRoot, "R", "lower.s"), "lower_s <- 4\n");
    await writeFile(path.join(packageRoot, "R", "ignored.txt"), "ignored <- 5\n");
    const originalDescription = await readFile(path.join(packageRoot, "DESCRIPTION"), "utf8");
    await writeFile(
      path.join(packageRoot, "DESCRIPTION"),
      `${originalDescription.trimEnd()}\nCollate: 'legacy.q' 'upper.S' 'lower.r' 'lower.s' 'main.R'\n`,
    );

    const artifact = await packPackage(packageRoot);
    expect(artifact.bundle.rSources.map((entry) => entry.path)).toEqual([
      "R/legacy.q",
      "R/upper.S",
      "R/lower.r",
      "R/lower.s",
      "R/main.R",
    ]);
    expect(artifact.bundle.rSources.map((entry) => entry.source)).not.toContain("ignored <- 5\n");
  });

  it("selects safe platform-conditional NAMESPACE declarations at packaging time", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      [
        'if (Sys.getenv("R_OSTYPE") == "windows" || .Platform$OS.type == "windows") {',
        "  importFrom(utils, winProgressBar)",
        "} else {",
        "  importFrom(utils, txtProgressBar)",
        "}",
        "export(square)",
        "",
      ].join("\n"),
    );

    const unix = await packPackage(packageRoot);
    const windows = await packPackage(packageRoot, { sourcePlatform: "windows" });
    expect(unix.bundle.namespace).toBe("importFrom(utils, txtProgressBar)\nexport(square)\n");
    expect(windows.bundle.namespace).toBe("importFrom(utils, winProgressBar)\nexport(square)\n");
  });

  it("selects versioned core-namespace conditionals for the target R contract", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      [
        'if (getRversion() < "4.5.0") { importFrom(methods, getMethods) }',
        'if (getRversion() >= "2.14.0") { importFrom(stats, getCall) }',
        'if (getRversion() >= "3.3.0" && "getSource" %in% getNamespaceExports("utils")) {',
        "  importFrom(utils, getSource)",
        "}",
        'if (getRversion() >= "3.3.0" && "packageDescription" %in% getNamespaceExports("utils")) {',
        "  importFrom(utils, packageDescription)",
        "}",
        'if (getRversion() >= "5.0.0") { importFrom(utils, neverSelected) }',
        "export(square)",
        "",
      ].join("\n"),
    );

    const artifact = await packPackage(packageRoot);
    expect(artifact.bundle.namespace).toBe(
      [
        "importFrom(stats, getCall)",
        "importFrom(utils, packageDescription)",
        "export(square)",
        "",
      ].join("\n"),
    );
  });

  it("selects safe unbraced and nested target-platform NAMESPACE conditionals", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      [
        'if (getRversion() < "4.0.0")',
        "  importFrom(graphics, plot)",
        'if (tools:::.OStype() == "unix") {',
        "  export(unixOnly)",
        '  if (identical(1L, grep("linux", R.version[["os"]]))) {',
        "    export(linuxOnly)",
        "  }",
        "}",
        "export(square)",
        "",
      ].join("\n"),
    );

    const unix = await packPackage(packageRoot);
    const windows = await packPackage(packageRoot, { sourcePlatform: "windows" });
    expect(unix.bundle.namespace).toBe("export(unixOnly)\nexport(square)\n");
    expect(windows.bundle.namespace).toBe("export(square)\n");
  });

  it("rejects NAMESPACE conditionals outside the safe platform-expression subset", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      'if (file.exists("host-secret")) { export(square) }\n',
    );

    const inspected = await inspectPackage(packageRoot);
    expect(inspected.compatibility).toMatchObject({
      packaging: "blocked",
      issues: [{ code: "NRPKG1015", path: "NAMESPACE" }],
    });
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

  it("admits cleanup-only hooks without executing host shell code", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "cleanup"),
      "#!/bin/sh\nrm -f ./R/*~ ./tests/*.ps ./DEADJOE\n",
    );

    const artifact = await packPackage(packageRoot);
    expect(artifact.compatibility).toMatchObject({
      packaging: "ready",
      execution: "unchecked",
      issues: [
        {
          code: "NRPKG1015",
          severity: "warning",
          path: "cleanup",
        },
      ],
    });
    expect(artifact.bundle.resources.some((resource) => resource.path === "cleanup")).toBe(false);
  });

  it("admits inert JVM assets without claiming JVM execution", async () => {
    const packageRoot = await fixturePackage();
    await mkdir(path.join(packageRoot, "java"));
    await mkdir(path.join(packageRoot, "inst", "java"));
    await writeFile(
      path.join(packageRoot, "java", "ExternalHelper.java"),
      "final class ExternalHelper {}\n",
    );
    await writeFile(path.join(packageRoot, "inst", "java", "external-helper.jar"), "inert");

    const inspected = await inspectPackage(packageRoot);
    expect(inspected.compatibility).toMatchObject({
      packaging: "ready",
      issues: [
        { code: "NRPKG1002", severity: "warning", path: "inst/java/external-helper.jar" },
        { code: "NRPKG1002", severity: "warning", path: "java/ExternalHelper.java" },
      ],
    });
    expect(inspected.bundle.resources).toContainEqual({
      path: "java/external-helper.jar",
      data: Buffer.from("inert").toString("base64"),
    });
    await expect(packPackage(packageRoot)).resolves.toMatchObject({
      compatibility: { packaging: "ready" },
    });
  });

  it("admits standard S4 class and method export directives for the runtime loader", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      "export(square)\nexportClasses(DemoClass)\nexportMethods(print, code)\n",
    );
    const inspected = await inspectPackage(packageRoot);
    expect(inspected.compatibility.packaging).toBe("ready");
    await expect(packPackage(packageRoot)).resolves.toMatchObject({
      bundle: {
        namespace: "export(square)\nexportClasses(DemoClass)\nexportMethods(print, code)\n",
      },
    });
  });

  it("admits standard S4 method import directives for the runtime loader", async () => {
    const packageRoot = await fixturePackage();
    await writeFile(
      path.join(packageRoot, "NAMESPACE"),
      'importMethodsFrom(methodprovider, show, "[")\nexport(square)\n',
    );
    const inspected = await inspectPackage(packageRoot);
    expect(inspected.compatibility.packaging).toBe("ready");
    await expect(packPackage(packageRoot)).resolves.toMatchObject({
      bundle: {
        namespace: 'importMethodsFrom(methodprovider, show, "[")\nexport(square)\n',
      },
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
      formatVersion: 2,
      roots: ["demopkg"],
      suggests: { mode: "none", packages: [] },
      packages: [
        { name: "helper", version: "2.1.0", dependencies: [] },
        { name: "demopkg", version: "1.2.3", dependencies: ["helper"] },
      ],
    });
    expect(() => resolvePackageArtifacts([consumer], { roots: ["demopkg"] })).toThrow(
      "requires missing package 'helper'",
    );
  });

  it("keeps Suggests optional, checks requested optional edges, and compares R package versions", async () => {
    const artifact = await packPackage(await fixturePackage());
    const helper = await packPackage(await fixturePackage("helper", "2.1.0"));
    expect(resolvePackageArtifacts([artifact]).artifacts).toHaveLength(1);
    expect(() => resolvePackageArtifacts([artifact], { includeSuggests: true })).toThrow(
      "requires missing package 'helper'",
    );
    const selected = resolvePackageArtifacts([artifact, helper], {
      roots: ["demopkg"],
      selectedSuggests: ["helper"],
    });
    expect(selected.artifacts.map((candidate) => candidate.package.name)).toEqual([
      "helper",
      "demopkg",
    ]);
    expect(selected.lock).toMatchObject({
      formatVersion: 2,
      suggests: { mode: "selected", packages: ["helper"] },
      packages: [
        { name: "helper", dependencies: [] },
        { name: "demopkg", dependencies: ["helper"] },
      ],
    });
    expect(() =>
      resolvePackageArtifacts([artifact], {
        roots: ["demopkg"],
        selectedSuggests: ["helper"],
      }),
    ).toThrow("requires missing package 'helper'");
    expect(() =>
      resolvePackageArtifacts([artifact, helper], {
        roots: ["demopkg"],
        selectedSuggests: ["undeclared"],
      }),
    ).toThrow("not declared by the resolved package closure: undeclared");
    expect(() =>
      resolvePackageArtifacts([artifact, helper], {
        roots: ["demopkg"],
        includeSuggests: true,
        selectedSuggests: ["helper"],
      }),
    ).toThrow("cannot be used together");
    expect(comparePackageVersions("1.2", "1.2.0")).toBe(0);
    expect(comparePackageVersions("1.10", "1.9.9")).toBe(1);
    expect(comparePackageVersions("1.0-2", "1.0.3")).toBe(-1);
  });

  it("installs a dependency closure from a bounded CRAN-like repository", async () => {
    const consumerRoot = await fixturePackage();
    await writeFile(
      path.join(consumerRoot, "DESCRIPTION"),
      "Package: demopkg\nVersion: 1.2.3\nImports: stats, grid, helper (>= 2.1)\nNeedsCompilation: no\n",
    );
    const helperRoot = await fixturePackage("helper", "2.1.0");
    const consumerArchive = await archivePackage(consumerRoot);
    const helperArchive = await archivePackage(helperRoot);
    const consumerMd5 = createHash("md5").update(consumerArchive).digest("hex");
    const helperMd5 = createHash("md5").update(helperArchive).digest("hex");
    const index = [
      "Package: demopkg",
      "Version: 1.2.3",
      "Imports: stats, grid, helper (>= 2.1)",
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

    const installed = await installPackagesFromRepository(["demopkg"], {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
    });
    expect(installed.repository).toBe("https://packages.example.test/cran/");
    expect(installed.indexIntegrity).toMatch(/^sha256-[a-f0-9]{64}$/u);
    expect(installed.artifacts.map((artifact) => artifact.package.name)).toEqual([
      "helper",
      "demopkg",
    ]);
    expect(installed.lock.roots).toEqual(["demopkg"]);
    expect(installed.lock.providedPackages).toMatchObject({
      compiler: "4.6.1",
      datasets: "4.6.1",
      grid: "4.6.1",
      parallel: "4.6.1",
    });
  });

  it("installs only selected Suggests and records the optional closure in the lock", async () => {
    const consumerRoot = await fixturePackage();
    const helperRoot = await fixturePackage("helper", "2.1.0");
    const consumerArchive = await archivePackage(consumerRoot);
    const helperArchive = await archivePackage(helperRoot);
    const index = [
      "Package: demopkg",
      "Version: 1.2.3",
      "Imports: stats",
      "Suggests: helper (>= 2.1)",
      "NeedsCompilation: no",
      `MD5sum: ${createHash("md5").update(consumerArchive).digest("hex")}`,
      "",
      "Package: helper",
      "Version: 2.1.0",
      "Imports: stats",
      "NeedsCompilation: no",
      `MD5sum: ${createHash("md5").update(helperArchive).digest("hex")}`,
      "",
    ].join("\n");
    const requests: string[] = [];
    const fetch_: typeof fetch = (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      requests.push(url.pathname);
      if (url.pathname.endsWith("/PACKAGES.gz"))
        return Promise.resolve(new Response(gzipSync(index)));
      if (url.pathname.endsWith("/demopkg_1.2.3.tar.gz"))
        return Promise.resolve(new Response(consumerArchive));
      if (url.pathname.endsWith("/helper_2.1.0.tar.gz"))
        return Promise.resolve(new Response(helperArchive));
      return Promise.resolve(new Response("missing", { status: 404 }));
    };

    const defaultInstall = await installPackagesFromRepository(["demopkg"], {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
    });
    expect(defaultInstall.artifacts.map((artifact) => artifact.package.name)).toEqual(["demopkg"]);
    expect(requests.some((request) => request.endsWith("/helper_2.1.0.tar.gz"))).toBe(false);

    requests.length = 0;
    const selectedInstall = await installPackagesFromRepository(["demopkg"], {
      repository: "https://packages.example.test/cran/",
      fetch: fetch_,
      selectedSuggests: ["helper"],
    });
    expect(selectedInstall.artifacts.map((artifact) => artifact.package.name)).toEqual([
      "helper",
      "demopkg",
    ]);
    expect(requests.some((request) => request.endsWith("/PACKAGES.gz"))).toBe(false);
    expect(requests.some((request) => request.endsWith("/helper_2.1.0.tar.gz"))).toBe(true);
    expect(selectedInstall.lock.suggests).toEqual({ mode: "selected", packages: ["helper"] });
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
      ...(name === "demopkg" ? ["Suggests: helper (>= 2.1)"] : []),
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
