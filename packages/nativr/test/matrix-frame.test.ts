import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("round-trips a named matrix through a data frame and preserves automatic row names", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        x <- matrix(1:6, 2, 3, dimnames = list(c("r1", "r2"), c("A", "B", "C")))
        f <- as.data.frame(x)
        m <- as.matrix(f)
        g <- as.data.frame(matrix(1:6, 2, 3))
        c(dim(f), names(f), rownames(f), identical(m, x),
          is.null(rownames(as.matrix(g))), names(g))
      `),
    ).resolves.toEqual(["2", "3", "A", "B", "C", "r1", "r2", "TRUE", "TRUE", "V1", "V2", "V3"]);
  } finally {
    await runtime.dispose();
  }
});

it("coerces factor columns when creating a matrix from a data frame", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        z <- data.frame(a = factor(c("x", "y")), b = 1:2)
        c(typeof(as.matrix(z)), as.vector(as.matrix(z)))
      `),
    ).resolves.toEqual(["character", "x", "y", "1", "2"]);
  } finally {
    await runtime.dispose();
  }
});

it("uses vector length as the default one-dimensional array extent", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        x <- array(1:3, dimnames = list(letters[1:3]))
        c(dim(x), dimnames(x)[[1]], is.null(dimnames(NULL)),
          length(LETTERS), LETTERS[1], LETTERS[26])
      `),
    ).resolves.toEqual(["3", "a", "b", "c", "TRUE", "26", "A", "Z"]);
  } finally {
    await runtime.dispose();
  }
});
