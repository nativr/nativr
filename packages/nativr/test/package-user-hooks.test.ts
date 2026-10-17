import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
const packages = [
  {
    description: "Package: fixture\nVersion: 1.0\n",
    namespace: "export(value)",
    rSources: [{ path: "R/main.R", source: "value <- 42" }],
  },
];

it.each(["onLoad", "attach", "detach", "onUnload"])(
  "preserves recoverable state after a %s user hook exceeds its work limit",
  async (event) => {
    const runtime = await createR({
      execution: "inline",
      assets,
      packages,
      limits: { maxSteps: 1000 },
    });
    try {
      await runtime.eval(
        `setHook(packageEvent("fixture","${event}"),function(...) while(TRUE) {})`,
      );
      if (event === "detach" || event === "onUnload") await runtime.eval("library(fixture)");
      const code =
        event === "detach"
          ? 'detach("package:fixture")'
          : event === "onUnload"
            ? 'unloadNamespace("fixture")'
            : "library(fixture)";
      await expect(runtime.eval(code)).rejects.toMatchObject({ code: "NRL4001" });
      expect(
        await runtime.eval('c("fixture" %in% loadedNamespaces(),"package:fixture" %in% search())'),
      ).toEqual([true, event === "detach"]);
      await runtime.eval(
        `setHook(packageEvent("fixture","${event}"),NULL,"replace"); unloadNamespace("fixture"); library(fixture)`,
      );
      expect(await runtime.eval("value")).toBe(42);
    } finally {
      await runtime.dispose();
    }
  },
);

it("runs ordered function lists past non-callable entries, then clears hooks on reset", async () => {
  const runtime = await createR({ execution: "inline", assets, packages });
  try {
    expect(
      await runtime.eval(
        'events <- character(); named <- function(pkgname,pkgpath) events <<- c(events,pkgname,basename(pkgpath)); key <- packageEvent("fixture","onLoad"); setHook(key,list("named",named)); setHook(key,list(function(...) events <<- c(events,"first"),function(...) events <<- c(events,"second")),"prepend"); library(fixture); events',
      ),
    ).toEqual(["first", "second", "fixture", "fixture"]);
    await runtime.reset();
    expect(await runtime.eval('length(getHook(packageEvent("fixture","onLoad")))')).toBe(0);
    expect(await runtime.eval("library(fixture); value")).toBe(42);
  } finally {
    await runtime.dispose();
  }
});
