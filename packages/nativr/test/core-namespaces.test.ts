import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("keeps core attachment consistent when user callbacks exhaust resources", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxSteps: 1000 } });
  try {
    await runtime.eval('setHook(packageEvent("stats","detach"),function(...) while(TRUE) {})');
    await expect(runtime.eval('detach("package:stats")')).rejects.toMatchObject({
      code: "NRL4001",
    });
    expect(await runtime.eval('"package:stats" %in% search()')).toBe(true);
    await runtime.eval(
      'setHook(packageEvent("stats","detach"),NULL,"replace"); detach("package:stats"); setHook(packageEvent("stats","attach"),function(...) while(TRUE) {})',
    );
    await expect(runtime.eval("library(stats)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(
      await runtime.eval(
        'c("package:stats" %in% search(),exists("median",globalenv()),"stats" %in% loadedNamespaces())',
      ),
    ).toEqual([false, false, true]);
    await runtime.eval('setHook(packageEvent("stats","attach"),NULL,"replace"); library(stats)');
    expect(await runtime.eval("median(1:3)")).toBe(2);
  } finally {
    await runtime.dispose();
  }
});

it("preserves distinct base identities through serialization and session reset", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    for (let iteration = 0; iteration < 2; iteration++) {
      expect(
        await runtime.eval(`local({
        ns <- asNamespace("base")
        restored <- unserialize(serialize(list(baseenv(),ns,ns),NULL))
        c(!identical(baseenv(),ns),identical(parent.env(ns),globalenv()),
          identical(restored[[1]],baseenv()),identical(restored[[2]],ns),
          identical(restored[[2]],restored[[3]]),
          identical(parent.env(baseenv()),emptyenv()),
          identical(environmentName(parent.env(asNamespace("stats"))),"imports:stats"))
      })`),
      ).toEqual([true, true, true, true, true, true, true]);
      await runtime.reset();
    }
  } finally {
    await runtime.dispose();
  }
});
