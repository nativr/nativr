import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createElementaryMath, instantiateElementaryModule } from "../src/elementary.js";
import { createR } from "../src/index.js";

const parserAssets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
// Built by `node scripts/build-elementary-wasm.mjs`; CI runs unit tests before the build.
const builtModule = new URL("../../../.tmp/elementary/elementary.wasm", import.meta.url);
const hasBuiltModule = existsSync(builtModule);

describe.runIf(hasBuiltModule)("correctly rounded elementary functions (RFC-0007)", () => {
  const bytes = () => new Uint8Array(readFileSync(builtModule));

  it("uses the module for regular inputs and exact IEEE paths for special values", async () => {
    const math = createElementaryMath(await instantiateElementaryModule(bytes()));
    expect(math.backend).toBe("correctly-rounded");
    // The correctly rounded result differs from GNU R 4.6.1's Windows oracle (6.12303176911189e-17).
    expect(math.unary("cos", 1.5707963267948966)).toBe(6.123233995736766e-17);
    expect(math.unary("exp", 1)).toBe(Math.E);
    expect(math.unary("log", 0)).toBe(Number.NEGATIVE_INFINITY);
    expect(Object.is(math.unary("sin", -0), -0)).toBe(true);
    expect(math.unary("exp", Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(math.unary("log", -1)).toBeNaN();
    expect(math.binary("pow", 2, 0.5)).toBe(Math.SQRT2);
    expect(math.binary("pow", 0, -1)).toBe(Number.POSITIVE_INFINITY);
    expect(math.binary("hypot", 3, 4)).toBe(5);
  });

  it("routes a session's builtins and operators through the module", async () => {
    const runtime = await createR({
      execution: "inline",
      assets: {
        ...parserAssets,
        elementaryWasm: new URL(
          `data:application/wasm;base64,${Buffer.from(bytes()).toString("base64")}`,
        ),
      },
    });
    try {
      await expect(runtime.eval("cos(1.5707963267948966)")).resolves.toBe(6.123233995736766e-17);
      await expect(
        runtime.eval("c(identical(log(8, 10), log10(8)), identical(log(8, 2), log2(8)))"),
      ).resolves.toEqual([true, true]);
    } finally {
      await runtime.dispose();
    }
  });
});

it("applies the documented power rules on every backend", async () => {
  const runtime = await createR({ execution: "inline", assets: parserAssets });
  try {
    // ?Arithmetic: 1 ^ y and y ^ 0 are 1, always; (-1)^Inf stays NaN as in GNU R.
    const result = await runtime.eval(
      "c(1^NaN, NaN^0, 1^Inf, 1^NA_real_, NA_real_^0, NA_integer_^0L)",
    );
    expect(result).toEqual([1, 1, 1, 1, 1, 1]);
    await expect(runtime.eval("(-1)^Inf")).resolves.toBeNaN();
  } finally {
    await runtime.dispose();
  }
});
