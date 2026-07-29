import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createR, isNA, NA, RRuntimeDisposedError } from "../src/index.js";

const assetRoot = fileURLToPath(new URL("../../parser/assets/", import.meta.url));

async function session() {
  return createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: `${assetRoot}/web-tree-sitter.wasm`,
      rGrammarWasm: `${assetRoot}/tree-sitter-r.wasm`,
    },
  });
}

describe("complete inline source-to-result vertical slice", () => {
  it.each([
    ["1 + 1", 2],
    ["x <- c(1, 2, 3, 4, 5)\nmean(x)", 3],
    ["x <- c(1, NA, 3)\nmean(x, na.rm = TRUE)", 2],
    ["f <- function(x) x ^ 2\nf(4)", 16],
    ["c(1, 2, 3) + 10", [11, 12, 13]],
    ["c(1, 2, 3, 4) + c(10, 20)", [11, 22, 13, 24]],
  ])("evaluates %s", async (code, expected) => {
    const runtime = await session();
    await expect(runtime.eval(code)).resolves.toEqual(expected);
    await runtime.dispose();
  });

  it("returns the canonical NA marker and distinguishes NaN", async () => {
    const runtime = await session();
    const missing = await runtime.eval("mean(c(1, NA, 3))");
    expect(isNA(missing)).toBe(true);
    expect(await runtime.eval("is.na(c(1, NA, NaN))")).toEqual([false, true, true]);
    expect(await runtime.eval("is.nan(c(1, NA, NaN))")).toEqual([false, false, true]);
    await runtime.dispose();
  });

  it("collects one non-multiple recycling warning", async () => {
    const runtime = await session();
    const result = await runtime.evalDetailed("c(1, 2, 3) + c(10, 20)");
    expect(result.value).toEqual([11, 22, 13]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe("NRW1001");
    await runtime.dispose();
  });

  it("assigns typed arrays and supports get and call", async () => {
    const runtime = await session();
    await runtime.assign("x", new Float64Array([1, 2, 3, 4]));
    expect(await runtime.eval("mean(x)")).toBe(2.5);
    expect(await runtime.get("x")).toEqual([1, 2, 3, 4]);
    expect(await runtime.call("mean", [2, 4])).toBe(3);
    await runtime.assign("missing", [1, NA, 3]);
    expect(await runtime.eval("mean(missing, na.rm = TRUE)")).toBe(2);
    await runtime.dispose();
  });

  it("uses lexical closure capture, defaults, and lazy supplied promises", async () => {
    const runtime = await session();
    expect(await runtime.eval("y <- 3\nf <- function(x = y) x ^ 2\ny <- 4\nf()")).toBe(16);
    expect(await runtime.eval("f <- function(x) 2\nf(not.bound)")).toBe(2);
    await runtime.dispose();
  });

  it("exposes visibility, raw snapshots, reset, and capabilities", async () => {
    const runtime = await session();
    const assignment = await runtime.evalDetailed("x <- 2");
    expect(assignment.visible).toBe(false);
    expect(await runtime.evalRaw("x")).toMatchObject({
      version: 1,
      type: "double",
      values: new Float64Array([2]),
    });
    expect((await runtime.capabilities()).languageSubsetVersion).toBe("0.1.0");
    await runtime.reset();
    await expect(runtime.get("x")).rejects.toMatchObject({ code: "NRE2001" });
    await runtime.dispose();
  });

  it("rejects future operations after disposal", async () => {
    const runtime = await session();
    await runtime.dispose();
    await expect(runtime.eval("1 + 1")).rejects.toBeInstanceOf(RRuntimeDisposedError);
  });

  it("enforces configured output limits", async () => {
    const runtime = await createR({
      execution: "inline",
      assets: {
        treeSitterRuntimeWasm: `${assetRoot}/web-tree-sitter.wasm`,
        rGrammarWasm: `${assetRoot}/tree-sitter-r.wasm`,
      },
      limits: { maxOutputBytes: 4 },
    });
    await expect(runtime.eval("c(1, 2)")).rejects.toMatchObject({ code: "NRL4007" });
    await runtime.dispose();
  });

  it("covers the supported base builtin surface", async () => {
    const runtime = await session();
    await expect(runtime.eval("length(NULL)")).resolves.toBe(0);
    await expect(runtime.eval("length(c(1, 2, 3))")).resolves.toBe(3);
    await expect(runtime.eval("sum(1, 2, 3)")).resolves.toBe(6);
    await expect(runtime.eval("sum(c(1, NA, 3), na.rm = TRUE)")).resolves.toBe(4);
    await expect(runtime.eval("abs(c(-2, 3))")).resolves.toEqual([2, 3]);
    await expect(runtime.eval("sqrt(c(4, 9))")).resolves.toEqual([2, 3]);
    await runtime.dispose();
  });

  it("coerces c() inputs through the documented atomic type ladder", async () => {
    const runtime = await session();
    await expect(runtime.eval("c(TRUE, FALSE)")).resolves.toEqual([true, false]);
    await expect(runtime.eval("c(TRUE, 2L)")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("c(1L, 2.5)")).resolves.toEqual([1, 2.5]);
    await expect(runtime.eval('c(TRUE, 2, "three")')).resolves.toEqual(["TRUE", "2", "three"]);
    await runtime.dispose();
  });

  it("preserves NA and NaN behavior across reductions and math", async () => {
    const runtime = await session();
    expect(isNA(await runtime.eval("sum(c(1, NA, 3))"))).toBe(true);
    expect(await runtime.eval("sum(c(1, NaN, 3))")).toBeNaN();
    expect(await runtime.eval("mean(c(NA, NaN), na.rm = TRUE)")).toBeNaN();
    const squareRoot = await runtime.evalDetailed("sqrt(c(-1, NA))");
    expect(squareRoot.value).toEqual([Number.NaN, NA]);
    expect(squareRoot.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced." }]);
    await runtime.dispose();
  });

  it("returns stable argument and type errors for invalid builtin calls", async () => {
    const runtime = await session();
    await expect(runtime.eval("mean()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval('mean("x")')).rejects.toMatchObject({ code: "NRT3102" });
    await expect(runtime.eval("mean(1, na.rm = NA)")).rejects.toMatchObject({ code: "NRT3103" });
    await expect(runtime.eval("mean(1, extra = TRUE)")).rejects.toMatchObject({
      code: "NRE2101",
    });
    await expect(runtime.eval("sum(1, nope = TRUE)")).rejects.toMatchObject({
      code: "NRE2101",
    });
    await expect(runtime.eval("sum(1, na.rm = TRUE, na.rm = FALSE)")).rejects.toMatchObject({
      code: "NRE2102",
    });
    await expect(runtime.eval("c(x = 1)")).rejects.toMatchObject({ code: "NRU6105" });
    await runtime.dispose();
  });

  it("evaluates supported unary and arithmetic operators and rejects the rest", async () => {
    const runtime = await session();
    await expect(runtime.eval("-c(1, 2)")).resolves.toEqual([-1, -2]);
    await expect(runtime.eval("!c(TRUE, FALSE)")).resolves.toEqual([false, true]);
    await expect(runtime.eval("c(2, 4) / 2")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("c(2L, 3L) * 2L")).resolves.toEqual([4, 6]);
    await expect(runtime.eval("c(2, 3) - 1")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("1 <= 2")).rejects.toMatchObject({ code: "NRU6003" });
    await expect(runtime.eval('"one" + 2')).rejects.toMatchObject({ code: "NRT3101" });
    await runtime.dispose();
  });
});
