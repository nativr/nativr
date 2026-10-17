import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let r: NativRSession;
beforeAll(async () => {
  r = await createR({ execution: "inline", assets });
});
afterAll(async () => r.dispose());

it("reduces all Summary members and preserves integer argument boundaries", async () => {
  expect(
    await r.eval(
      "local({x<-data.frame(a=1:2,b=3:4);c(identical(sum(x),10L),identical(prod(x),24),identical(min(x),1L),identical(max(x),4L),identical(range(x),c(1L,4L)),any(x),all(x),identical(sum(data.frame(a=2147483647L,b=1L,c=-1L)),2147483647L))})",
    ),
  ).toEqual(Array(8).fill(true));
});
it("admits matrix columns, logical columns and multiple data frames", async () => {
  expect(
    await r.eval(
      "c(sum(data.frame(a=I(matrix(1:4,2)))),sum(data.frame(a=c(TRUE,FALSE))),sum(data.frame(a=1:2),2L,data.frame(b=3:4)))",
    ),
  ).toEqual([10, 1, 12]);
});
it("rejects nonnumeric columns and only dispatches on the first argument", async () => {
  for (const code of [
    'sum(data.frame(a="x"))',
    'min(data.frame(a=factor("x")))',
    'sum(data.frame(a=as.Date("2000-01-01")))',
    "sum(data.frame(a=1L),list(1L))",
  ])
    await expect(r.eval(code)).rejects.toThrow(
      "only defined on a data frame with all numeric-alike variables",
    );
  await expect(r.eval("prod(1,data.frame(a=1L))")).rejects.toThrow(
    "invalid 'type' (list) of argument",
  );
});
it("handles missing, empty and non-scalar controls", async () => {
  expect(
    await r.eval(
      "c(identical(sum(data.frame()),0L),identical(min(data.frame(a=NA_integer_)),NA_integer_),identical(sum(data.frame(a=c(1L,NA_integer_)),na.rm=TRUE),1L),identical(sum(data.frame(a=1L),na.rm=c(TRUE,FALSE)),2L))",
    ),
  ).toEqual([true, true, true, true]);
  const result = await r.evalDetailed("range(data.frame())");
  expect(result.warnings.map((w) => w.message)).toEqual([
    "no non-missing arguments to min; returning Inf",
    "no non-missing arguments to max; returning -Inf",
  ]);
});
it("registers the method after reset", async () => {
  await r.reset();
  expect(await r.eval("sum(data.frame(a=1:2))")).toBe(3);
  expect(await r.eval("names(formals(Summary.data.frame))")).toEqual(["...", "na.rm"]);
});
