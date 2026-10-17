import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
it("corrects floating means in extended precision without changing integer means", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        `c(mean(c(1e16,1,-1e16)),mean(c(1e19,1,-1e19)),mean(c(1e308,1e308)),mean(c(2147483647L,1L,-2147483647L)))`,
      ),
    ).toEqual([0.3336588541666667, 2 / 3, 1e308, 1 / 3]);
    expect(
      await r.eval(
        `c(identical(mean(c(1e19+1i,1+2i,-1e19+3i)),2/3+2i),identical(mean(c(1e19,NA,1,-1e19),na.rm=TRUE),2/3),is.nan(mean(numeric())),is.nan(mean(c(Inf,-Inf))),identical(mean(c(Inf,1)),Inf))`,
      ),
    ).toEqual(Array(5).fill(true));
  } finally {
    await r.dispose();
  }
});
