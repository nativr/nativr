import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("replaces matrix diagonals with exact length or scalar recycling", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        x <- matrix(1:6, 2, 3, dimnames = list(c("a", "b"), c("A", "B", "C")))
        attr(x, "tag") <- "kept"
        diag(x) <- c(9L, 8L)
        y <- matrix(1:4, 2, 2)
        diag(y) <- 0.5
        z <- matrix(numeric(), 0, 2)
        diag(z) <- numeric()
        c(
          identical(c(x), c(9L, 2L, 3L, 8L, 5L, 6L)),
          identical(dim(x), c(2L, 3L)),
          identical(dimnames(x), list(c("a", "b"), c("A", "B", "C"))),
          identical(attr(x, "tag"), "kept"),
          identical(y, matrix(c(0.5, 2, 3, 0.5), 2, 2)),
          identical(z, matrix(numeric(), 0, 2)),
          identical(names(formals(get("diag<-"))), c("x", "value"))
        )
      `),
    ).resolves.toEqual([true, true, true, true, true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("promotes diagonal replacements and supports list matrices and data frames", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        x <- matrix(1:4, 2, 2)
        diag(x) <- c("a", "b")
        y <- matrix(list(1, 2, 3, 4), 2, 2)
        diag(y) <- list(9, 8)
        z <- data.frame(a = 1:2, b = 3:4)
        diag(z) <- 9
        c(
          identical(x, matrix(c("a", "2", "3", "b"), 2, 2)),
          identical(y, matrix(list(9, 2, 3, 8), 2, 2)),
          identical(z, data.frame(a = c(9, 2), b = c(3, 9)))
        )
      `),
    ).resolves.toEqual([true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("rejects non-matrices and mismatched diagonal lengths", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(runtime.eval("x <- 1:4; diag(x) <- 9")).rejects.toMatchObject({
      code: "NRT3248",
      message: "only matrix diagonals can be replaced",
    });
    await expect(runtime.eval("x <- matrix(1:6, 2, 3); diag(x) <- 1:3")).rejects.toMatchObject({
      code: "NRE2213",
      message: "replacement diagonal has wrong length",
    });
  } finally {
    await runtime.dispose();
  }
});
