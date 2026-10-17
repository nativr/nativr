import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession;
beforeAll(async () => {
  runtime = await createR({ execution: "inline", assets });
});
afterAll(async () => runtime.dispose());

it("keeps integer/logical sums integral and admits named and NULL inputs", async () => {
  expect(
    await runtime.eval(
      `c(identical(sum(),0L),identical(sum(NULL),0L),identical(sum(TRUE,FALSE),1L),identical(sum(x=1L,y=2L),3L),identical(sum(1L,na.r=2L),3L),identical(sum(numeric()),0),identical(sum(integer(),logical()),0L))`,
    ),
  ).toEqual(Array(7).fill(true));
});

it("promotes across argument boundaries without integer overflow warnings", async () => {
  const result = await runtime.evalDetailed(
    `c(identical(sum(c(2147483647L,1L,-1L)),2147483647L),identical(sum(2147483647L,1L,-1L),2147483647),identical(sum(-1L,c(2147483647L,1L)),2147483647L),identical(sum(-2147483647L,-1L),-2147483648))`,
  );
  expect(result.value).toEqual(Array(4).fill(true));
  expect(result.warnings).toEqual([]);
});

it("retains the missing result type and NA/NaN encounter order", async () => {
  expect(
    await runtime.eval(
      `c(identical(sum(NA_integer_),NA_integer_),identical(sum(NA_integer_,numeric()),NA_real_),identical(sum(NA_integer_,2147483647L,1L),NA_integer_),identical(sum(2147483647L,1L,NA_integer_),NA_real_),identical(sum(NA_integer_,na.rm=TRUE),0L),is.nan(sum(NaN,NA_real_)),identical(sum(NA_real_,NaN),NA_real_))`,
    ),
  ).toEqual(Array(7).fill(true));
});

it("forces all arguments in order and validates the exact na.rm control", async () => {
  expect(
    await runtime.eval(
      `local({trace<-character();sum({trace<-c(trace,"first");1L},na.rm={trace<-c(trace,"control");TRUE},last={trace<-c(trace,"last");2L});trace})`,
    ),
  ).toEqual(["first", "control", "last"]);
  await expect(runtime.eval("sum(1,na.rm=NA)")).rejects.toThrow("NA in coercion to boolean");
  await expect(runtime.eval("sum(1,na.rm=c(FALSE,TRUE))")).rejects.toThrow("length = 2");
  await expect(runtime.eval('sum(factor("a"))')).rejects.toThrow("not meaningful for factors");
});

it("uses extended precision within vectors and double rounding between arguments", async () => {
  expect(
    await runtime.eval(
      `c(sum(c(1e16,1,-1e16)),sum(1e16,1,-1e16),sum(c(1e20,1,-1e20)),sum(c(1e19,1,-1e19)),sum(c(1,2^-64,-1)),sum(c(1,2^-63,-1)),sum(c(1,2^-64,2^-64,-1)))`,
    ),
  ).toEqual([1, 0, 0, 1, 0, 2 ** -63, 0]);
  expect(
    await runtime.eval(
      `c(identical(sum(c(1e308,1e308,-1e308)),1e308),identical(sum(1e308,1e308,-1e308),Inf),is.nan(sum(c(Inf,-Inf,1))),identical(sum(c(1e16+1i,1+1i,-1e16-1i)),1+1i),identical(sum(c(5e-324,5e-324)),1e-323))`,
    ),
  ).toEqual(Array(5).fill(true));
});
