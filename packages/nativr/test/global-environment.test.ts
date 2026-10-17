import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("exposes a locked ordinary base binding with lexical shadowing", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`c(
      exists(".GlobalEnv", globalenv(), inherits=FALSE),
      exists(".GlobalEnv", baseenv(), inherits=FALSE),
      bindingIsLocked(".GlobalEnv", baseenv()), bindingIsActive(".GlobalEnv", baseenv()),
      identical(base::.GlobalEnv, globalenv()),
      identical(get(".GlobalEnv", asNamespace("base")), globalenv()))`),
    ).toEqual([false, true, true, false, true, true]);
    expect(await runtime.eval("local({ .GlobalEnv <- 42; .GlobalEnv })")).toBe(42);
    expect(
      await runtime.eval(
        'inherits(try(assign(".GlobalEnv", 42, baseenv()), silent=TRUE), "try-error")',
      ),
    ).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it("refreshes the base binding after reset and isolates sessions", async () => {
  const first = await createR({ execution: "inline", assets });
  const second = await createR({ execution: "inline", assets });
  try {
    await first.eval('assign("marker", 7, .GlobalEnv)');
    expect(await second.eval('exists("marker", .GlobalEnv, inherits=FALSE)')).toBe(false);
    await first.reset();
    expect(await first.eval("identical(parent.env(globalenv()), as.environment(2))")).toBe(true);
    expect(
      await first.eval(
        'c(identical(.GlobalEnv, globalenv()), exists("marker", .GlobalEnv, inherits=FALSE), bindingIsLocked(".GlobalEnv", baseenv()))',
      ),
    ).toEqual([true, false, true]);
    await first.eval('assign("fresh", 9, .GlobalEnv)');
    expect(await first.eval("fresh")).toBe(9);
  } finally {
    await first.dispose();
    await second.dispose();
  }
});

it("resolves the session global environment from package namespaces after reset", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    packages: [
      {
        description: "Package: globalfixture\nVersion: 1.0\n",
        namespace: "export(readGlobal)",
        rSources: [
          {
            path: "R/main.R",
            source: 'readGlobal <- function() get("marker", .GlobalEnv, inherits=FALSE)',
          },
        ],
      },
    ],
  });
  try {
    for (const value of [7, 9]) {
      await runtime.eval(`marker <- ${value}`);
      expect(await runtime.eval("globalfixture::readGlobal()")).toBe(value);
      await runtime.reset();
    }
  } finally {
    await runtime.dispose();
  }
});
