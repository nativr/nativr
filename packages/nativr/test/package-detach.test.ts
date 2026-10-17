import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
function bundle(name: string, source: string, fields = "") {
  return {
    description: `Package: ${name}\nVersion: 1.0\n${fields}`,
    namespace: "export(value)",
    rSources: [{ path: "R/main.R", source }],
  };
}

it.each(["2", "pos=2", '"package:topfixture"', "target, character.only=TRUE"])(
  "restores masking and preserves escaped exports using %s",
  async (argument) => {
    const runtime = await createR({
      execution: "inline",
      assets,
      packages: [bundle("bottomfixture", "value <- 11"), bundle("topfixture", "value <- 22")],
    });
    try {
      await runtime.eval(
        'library(bottomfixture); lower <- as.environment(2); unlockBinding("value",lower); assign("value",12,lower); library(topfixture); saved <- as.environment(2); target <- "package:topfixture"',
      );
      expect(
        await runtime.eval(
          `detach(${argument}); c(value, get("value",saved), topfixture::value, identical(parent.env(globalenv()),lower), identical(parent.env(saved),baseenv()))`,
        ),
      ).toEqual([12, 22, 22, 1, 1]);
      await expect(runtime.eval('detach("package:topfixture")')).rejects.toMatchObject({
        code: "NRE2300",
      });
    } finally {
      await runtime.dispose();
    }
  },
);

it.each(["Depends", "Imports"])(
  "guards attached %s dependents and supports force",
  async (field) => {
    const runtime = await createR({
      execution: "inline",
      assets,
      packages: [
        bundle("depfixture", "value <- 11"),
        bundle("userfixture", "value <- 22", `${field}: depfixture (>= 1.0)\n`),
      ],
    });
    try {
      await runtime.eval("library(depfixture); library(userfixture)");
      if (field === "Depends")
        await expect(runtime.eval('detach("package:depfixture")')).rejects.toMatchObject({
          code: "NRE2280",
        });
      else await runtime.eval('detach("package:depfixture")');
      if (field === "Depends") await runtime.eval('detach("package:depfixture",force=TRUE)');
      expect(
        await runtime.eval(
          'c("package:depfixture" %in% search(),"depfixture" %in% loadedNamespaces(),value,depfixture::value)',
        ),
      ).toEqual([0, 1, 22, 11]);
    } finally {
      await runtime.dispose();
    }
  },
);

it("leaves attachment intact after a resource failure", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000 },
    packages: [
      bundle(
        "limitfixture",
        'value <- 42; .onDetach <- function(libpath) if(isTRUE(getOption("loop",FALSE))) while(TRUE) {}',
      ),
    ],
  });
  try {
    await runtime.eval("library(limitfixture)");

    await expect(
      runtime.eval('options(loop=TRUE); detach("package:limitfixture")'),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await runtime.eval('c(value,"package:limitfixture" %in% search())')).toEqual([42, 1]);
    await runtime.eval('options(loop=FALSE); detach("package:limitfixture")');
    expect(await runtime.eval('"package:limitfixture" %in% search()')).toBe(false);
  } finally {
    await runtime.dispose();
  }
});
