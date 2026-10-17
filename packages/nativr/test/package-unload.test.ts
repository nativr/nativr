import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
function bundle(name: string, source: string, namespace = "export(value)", fields = "") {
  return {
    description: `Package: ${name}\nVersion: 1.0\n${fields}`,
    namespace,
    rSources: [{ path: "R/main.R", source }],
  };
}
it.each([false, true])(
  "protects imported namespaces after detachment (viaDetach=%s)",
  async (viaDetach) => {
    const runtime = await createR({
      execution: "inline",
      assets,
      packages: [
        bundle("depfixture", "value <- function() 42"),
        bundle(
          "importfixture",
          "value <- function() depfixture::value()",
          "export(value)\nimport(depfixture)",
          "Imports: depfixture\n",
        ),
      ],
    });
    try {
      await runtime.eval(
        'asNamespace("importfixture"); library(depfixture); saved <- asNamespace("depfixture"); NULL',
      );
      if (viaDetach) {
        const result = await runtime.evalDetailed('detach("package:depfixture",unload=TRUE)');
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]?.message).toContain("is imported by 'importfixture'");
      } else
        await expect(runtime.eval('unloadNamespace("depfixture")')).rejects.toMatchObject({
          code: "NRE2281",
        });
      expect(
        await runtime.eval(
          'c("package:depfixture" %in% search(),"depfixture" %in% loadedNamespaces(),identical(saved,asNamespace("depfixture")),importfixture::value())',
        ),
      ).toEqual([0, 1, 1, 42]);
      await runtime.eval('unloadNamespace("importfixture"); unloadNamespace("depfixture")');
      expect(
        await runtime.eval('c("depfixture" %in% loadedNamespaces(),get("value",saved)())'),
      ).toEqual([0, 42]);
    } finally {
      await runtime.dispose();
    }
  },
);

it("does not treat DESCRIPTION-only Imports as namespace imports", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    packages: [
      bundle("depfixture", "value <- 42"),
      bundle("userfixture", "value <- 7", "export(value)", "Imports: depfixture\n"),
    ],
  });
  try {
    await runtime.eval('asNamespace("userfixture"); unloadNamespace("depfixture")');
    expect(
      await runtime.eval(
        'c("depfixture" %in% loadedNamespaces(),"userfixture" %in% loadedNamespaces())',
      ),
    ).toEqual([false, true]);
  } finally {
    await runtime.dispose();
  }
});

it("preserves the namespace after an unload hook hits a work limit", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000 },
    packages: [
      bundle(
        "limitfixture",
        'value <- 42; .onUnload <- function(libpath) if(isTRUE(getOption("loop",FALSE))) while(TRUE) {}',
      ),
    ],
  });
  try {
    await runtime.eval('library(limitfixture); saved <- asNamespace("limitfixture"); NULL');
    await expect(
      runtime.eval('options(loop=TRUE); unloadNamespace("limitfixture")'),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(
      await runtime.eval(
        'c("package:limitfixture" %in% search(),"limitfixture" %in% loadedNamespaces(),get("value",saved))',
      ),
    ).toEqual([0, 1, 42]);
    await runtime.eval('options(loop=FALSE); unloadNamespace("limitfixture")');
    expect(
      await runtime.eval(
        'c("limitfixture" %in% loadedNamespaces(),identical(saved,asNamespace("limitfixture")),environmentName(saved)=="limitfixture")',
      ),
    ).toEqual([false, false, true]);
  } finally {
    await runtime.dispose();
  }
});

it("returns invisible NULL for an absent namespace and rejects static unloading", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed('unloadNamespace("nativr.nonexistent")');
    expect(result.value).toBeNull();
    expect(result.visible).toBe(false);
    await expect(runtime.eval('unloadNamespace("stats")')).rejects.toMatchObject({
      code: "NRU6311",
    });
  } finally {
    await runtime.dispose();
  }
});
