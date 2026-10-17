import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("passes pairlist values and names through the core apply family", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        p <- pairlist(a = 1L, b = 2L)
        q <- pairlist(a = quote(1 + 2), b = quote(z))
        c(
          identical(lapply(p, identity), list(a = 1L, b = 2L)),
          identical(sapply(p, identity), c(a = 1L, b = 2L)),
          identical(vapply(p, identity, integer(1)), c(a = 1L, b = 2L)),
          identical(Map(identity, p), list(a = 1L, b = 2L)),
          identical(mapply(identity, p), c(a = 1L, b = 2L)),
          identical(sapply(q, typeof), c(a = "language", b = "symbol"))
        )
      `),
    ).resolves.toEqual([true, true, true, true, true, true]);
  } finally {
    await runtime.dispose();
  }
});
