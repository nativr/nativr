import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("evaluates real inverse trigonometric vectors with GNU R domain warnings", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(`
      x <- structure(c(-1, -0.5, 0, 0.5, 1, 2, NA_real_, NaN), marker="kept")
      a <- asin(x)
      b <- acos(x)
      t <- atan(x)
      c(round(a[1:5], 12), round(b[1:5], 12), round(t[1:5], 12),
        is.nan(a[6]), is.nan(b[6]), is.na(t[7]), is.nan(t[8]),
        identical(attr(a, "marker"), "kept"),
        identical(attr(b, "marker"), "kept"),
        identical(attr(t, "marker"), "kept"))
    `);
    expect(result.value).toEqual([
      -1.570796326795, -0.523598775598, 0, 0.523598775598, 1.570796326795, 3.14159265359,
      2.094395102393, 1.570796326795, 1.047197551197, 0, -0.785398163397, -0.463647609001, 0,
      0.463647609001, 0.785398163397, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(result.warnings).toEqual([
      { code: "NRW1003", message: "NaNs produced" },
      { code: "NRW1003", message: "NaNs produced" },
    ]);
  } finally {
    await runtime.dispose();
  }
});

it("follows GNU R complex inverse trigonometric branches and missingness", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const values = await runtime.eval(`
      z <- c(-2+0i, 2+0i, 1+1i, -1-1i, 0+2i)
      a <- asin(z); b <- acos(z); t <- atan(z)
      c(round(Re(a), 12), round(Im(a), 12),
        round(Re(b), 12), round(Im(b), 12),
        round(Re(t), 12), round(Im(t), 12),
        is.na(asin(NA_complex_)), is.nan(Re(asin(NaN+0i))),
        is.na(acos(NA_complex_)), is.nan(Re(atan(NaN+0i))))
    `);
    expect(values).toEqual([
      -1.570796326795, 1.570796326795, 0.666239432493, -0.666239432493, 0, 1.316957896925,
      -1.316957896925, 1.061275061905, -1.061275061905, 1.443635475179, 3.14159265359, 0,
      0.904556894302, 2.237035759287, 1.570796326795, -1.316957896925, 1.316957896925,
      -1.061275061905, 1.061275061905, -1.443635475179, -1.107148717794, 1.107148717794,
      1.017221967898, -1.017221967898, 1.570796326795, 0, 0, 0.402359478109, -0.402359478109,
      0.549306144334, 1, 1, 1, 1,
    ]);
    const infinite = await runtime.evalDetailed("asin(complex(real = Inf, imaginary = 0))");
    expect(infinite.value).toEqual({
      __nativr__: "complex",
      real: Number.NaN,
      imaginary: Number.NEGATIVE_INFINITY,
    });
    expect(infinite.warnings).toEqual([
      { code: "NRW1003", message: 'NaNs produced in function "asin"' },
    ]);
  } finally {
    await runtime.dispose();
  }
});

it("rejects factor and nonnumeric inverse trigonometric inputs", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(runtime.eval("asin(factor('a'))")).rejects.toMatchObject({ code: "NRT3430" });
    await expect(runtime.eval("acos(factor('a'))")).rejects.toMatchObject({ code: "NRT3430" });
    await expect(runtime.eval("atan(factor('a'))")).rejects.toMatchObject({ code: "NRT3430" });
    await expect(runtime.eval("asin('1')")).rejects.toMatchObject({ code: "NRT3102" });
  } finally {
    await runtime.dispose();
  }
});
