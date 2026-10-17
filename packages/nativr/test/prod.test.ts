import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("multiplies numeric, logical, complex, and data-frame inputs", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        z <- prod(c(1+2i, 3-1i))
        c(
          prod(), prod(NULL), typeof(prod(1:3)), prod(1:10),
          prod(1:3, 2:4, 5), prod(TRUE, FALSE),
          Re(z), Im(z), typeof(z), prod(data.frame(a=1:2, b=3:4)),
          prod(x=2, y=3), identical(formals(prod), NULL)
        )
      `),
    ).resolves.toEqual([
      "1",
      "1",
      "double",
      "3628800",
      "720",
      "0",
      "5",
      "5",
      "complex",
      "24",
      "6",
      "TRUE",
    ]);
  } finally {
    await runtime.dispose();
  }
});

it("distinguishes NA, NaN, and removal across real and complex products", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        c(
          identical(prod(c(2, NA_real_, 3)), NA_real_),
          identical(prod(c(2, NA_real_, 3), na.rm=TRUE), 6),
          is.nan(prod(c(2, NaN, 3))),
          identical(prod(c(2, NaN, 3), na.rm=TRUE), 6),
          identical(prod(c(NA_real_, NaN)), NA_real_),
          is.nan(prod(c(NaN, NA_real_))),
          identical(prod(NA_real_, na.rm=TRUE), 1),
          identical(prod(complex()), 1+0i),
          identical(prod(c(1+1i, NA_complex_), na.rm=TRUE), 1+1i)
        )
      `),
    ).resolves.toEqual([true, true, true, true, true, true, true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("rejects invalid input types and malformed na.rm controls", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(runtime.eval('prod("2")')).rejects.toMatchObject({
      message: "invalid 'type' (character) of argument",
    });
    await expect(runtime.eval("prod(factor(c('a', 'b'))) ")).rejects.toMatchObject({
      message: "'prod' not meaningful for factors",
    });
    await expect(runtime.eval("prod(1:3, na.rm=NA)")).rejects.toMatchObject({
      message: "NA in coercion to boolean",
    });
  } finally {
    await runtime.dispose();
  }
});
