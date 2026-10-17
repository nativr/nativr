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

it("preserves numeric types and gives NA precedence over NaN", async () => {
  expect(
    await r.eval(
      "c(identical(min(1L,2L),1L),identical(max(TRUE,FALSE),1L),identical(range(3L,1L),c(1L,3L)),identical(min(NA_integer_),NA_integer_),identical(min(NA_integer_,numeric()),NA_real_),identical(min(NaN,NA_real_),NA_real_),identical(min(x=2L,NULL,y=1L),1L),identical(range(1L,Inf,finite=TRUE),c(1,1)))",
    ),
  ).toEqual(Array(8).fill(true));
});
it("handles text, named data and scalar missing controls", async () => {
  expect(await r.eval('c(min("b","a"),min("b",1L),min(NA,"z",na.rm="TRUE"))')).toEqual([
    "a",
    "1",
    "z",
  ]);
  expect(await r.eval("min(1L,na.r=2L)")).toBe(1);
});
it("warns for empty numeric and character inputs", async () => {
  const result = await r.evalDetailed("range(integer())");
  expect(result.warnings.map((w) => w.message)).toEqual([
    "no non-missing arguments to min; returning Inf",
    "no non-missing arguments to max; returning -Inf",
  ]);
  const text = await r.evalDetailed("min(character())");
  expect(text.warnings.map((w) => w.message)).toEqual(["no non-missing arguments, returning NA"]);
});
it("rejects unsupported types and malformed primitive controls", async () => {
  await expect(r.eval("min(1+2i)")).rejects.toThrow("invalid 'type' (complex) of argument");
  await expect(r.eval("max(as.raw(1))")).rejects.toThrow("invalid 'type' (raw) of argument");
  await expect(r.eval("min(1L,na.rm=NA)")).rejects.toThrow("NA in coercion to boolean");
  await expect(r.eval("max(1L,na.rm=c(TRUE,FALSE))")).rejects.toThrow(
    "'length = 2' in coercion to 'logical(1)'",
  );
});
it("drops attributes and skips nonfinite numbers when requested", async () => {
  expect(
    await r.eval(
      "c(identical(min(c(a=1L,b=2L)),1L),identical(range(NA,NaN,Inf,-Inf,2L,finite=TRUE),c(2,2)))",
    ),
  ).toEqual([true, true]);
});
