import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
it("retains cancellation terms in matrix sums and divides extended means before narrowing", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        `c(colSums(matrix(c(1e16,1,-1e16),ncol=1)),colMeans(matrix(c(1e16,1,-1e16),ncol=1)),rowMeans(matrix(c(1e16,1,-1e16),nrow=1)),colMeans(matrix(c(1e308,1e308),ncol=1)),rowMeans(matrix(c(1e308,1e308),nrow=1)),colMeans(matrix(c(5e-324,5e-324),ncol=1)))`,
      ),
    ).toEqual([1, 1 / 3, 1 / 3, 1e308, 1e308, Number.MIN_VALUE]);
    expect(
      await r.eval(
        `c(identical(colMeans(matrix(c(5e-324,0),ncol=1)),0),identical(colMeans(matrix(c(-5e-324,0),ncol=1)),0),is.nan(colMeans(matrix(numeric(),nrow=0,ncol=1))),identical(colMeans(matrix(c(1e16,NA,1,-1e16),ncol=1),na.rm=TRUE),1/3))`,
      ),
    ).toEqual(Array(4).fill(true));
  } finally {
    await r.dispose();
  }
});
