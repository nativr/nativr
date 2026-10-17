import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
function bundle(name: string, namespace: string, source: string) {
  return {
    description: `Package: ${name}\nVersion: 1.0\n`,
    namespace,
    rSources: [{ path: "R/main.R", source }],
  };
}

it.each([false, true])(
  "rolls back failed attachment while preserving other attachments (nested=%s)",
  async (nested) => {
    const runtime = await createR({
      execution: "inline",
      assets,
      packages: [
        bundle("fallbackfixture", "export(marker)", "marker <- function() 11"),
        bundle(
          "nestedfixture",
          "export(marker,other)",
          "marker <- function() 33; other <- function() 99",
        ),
        bundle(
          "brokenfixture",
          "export(marker,transient)",
          `marker <- function() 22; transient <- function() 44
      .onAttach <- function(libname,pkgname) {
        options(hook.value=get("marker",envir=globalenv())(), hook.search="package:brokenfixture" %in% search())
        ${nested ? "library(nestedfixture)" : "invisible(NULL)"}
        stop("fixture")
      }`,
        ),
      ],
    });
    try {
      expect(
        await runtime.eval(`library(fallbackfixture)
      saved <- as.environment("package:fallbackfixture")
      failed <- inherits(try(library(brokenfixture), silent=TRUE),"try-error")
      c(failed, marker(), exists("transient",envir=globalenv(),inherits=TRUE),
        "brokenfixture" %in% loadedNamespaces(), "package:brokenfixture" %in% search(),
        identical(saved,as.environment("package:fallbackfixture")), getOption("hook.value"),getOption("hook.search"),brokenfixture::transient())`),
      ).toEqual([1, nested ? 33 : 11, 0, 1, 0, 1, 22, 1, 44]);
      if (nested)
        expect(
          await runtime.eval(
            'c(other(), identical(parent.env(as.environment("package:nestedfixture")),saved))',
          ),
        ).toEqual([99, 1]);
    } finally {
      await runtime.dispose();
    }
  },
);

it("rolls back attachment after a work limit and can retry", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000 },
    packages: [
      bundle(
        "limitfixture",
        "export(value)",
        'value <- 42; .onAttach <- function(libname,pkgname) if(isTRUE(getOption("fixture.loop",FALSE))) while(TRUE) {}',
      ),
    ],
  });
  try {
    await expect(
      runtime.eval("options(fixture.loop=TRUE); library(limitfixture)"),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(
      await runtime.eval(
        'c("limitfixture" %in% loadedNamespaces(), "package:limitfixture" %in% search(), exists("value",envir=globalenv(),inherits=TRUE))',
      ),
    ).toEqual([true, false, false]);
    expect(await runtime.eval("options(fixture.loop=FALSE); library(limitfixture); value")).toBe(
      42,
    );
  } finally {
    await runtime.dispose();
  }
});
