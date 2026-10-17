import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("partially matches all.equal method controls before its ellipsis", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        c(
          identical(all.equal(1, 1.01, tol = 0.02), TRUE),
          is.character(all.equal(1, 1.01, tol = 0.001)),
          identical(all.equal(1, 1.01, to = 0.02), TRUE),
          identical(all.equal(1, 1.01, sc = 1, tol = 0.02), TRUE)
        )
      `),
    ).resolves.toEqual([true, true, true, true]);
  } finally {
    await runtime.dispose();
  }
});
