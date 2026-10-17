import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("preserves a two-parameter complex-step derivative through vector replacement", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const gradient = await runtime.eval(`
      eps <- .Machine$double.eps
      f <- function(z) (z[1]^2 - z[2])^2
      x <- c(0.2, 0.3)
      h <- c(0, 0)
      h[1] <- eps * 1i
      g1 <- Im(f(x + h)) / eps
      h[1] <- 0
      h[2] <- eps * 1i
      g2 <- Im(f(x + h)) / eps
      c(g1, g2)
    `);
    expect(Array.isArray(gradient)).toBe(true);
    if (!Array.isArray(gradient)) return;
    expect(gradient[0]).toBeCloseTo(-0.208, 12);
    expect(gradient[1]).toBeCloseTo(0.52, 12);
  } finally {
    await runtime.dispose();
  }
});
