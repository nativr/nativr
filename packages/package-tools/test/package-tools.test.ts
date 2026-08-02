import { createHash, randomUUID } from "node:crypto";
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
  resolvePackageArtifacts,
  verifyPackageArtifact,
} from "../src/index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("pure-R package packager", () => {
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
      topics: [
        {
          name: "square",
          title: "Square a value",
          aliases: ["square", "square-alias"],
        },
      ],
    });
    expect(manifest.topics[0]?.blocks).toEqual(
      expect.arrayContaining([
        { kind: "donttest", source: "slow <- tested + 1" },
        { kind: "dontrun", source: "never <- 999" },
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

  it("enforces bounded input before constructing an artifact", async () => {
    const packageRoot = await fixturePackage();
    await expect(inspectPackage(packageRoot, { limits: { maxFiles: 2 } })).rejects.toThrow(
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
