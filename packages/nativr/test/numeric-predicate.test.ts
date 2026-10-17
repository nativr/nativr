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

it("classifies storage and registered time classes", async () => {
  expect(
    await r.eval(
      'c(is.numeric(1L),is.numeric(1),is.numeric(1i),is.numeric(TRUE),is.numeric(factor("a")),is.numeric(as.Date("2000-01-01")),is.numeric(as.POSIXct("2000-01-01",tz="UTC")),is.numeric(as.difftime(1,units="secs")))',
    ),
  ).toEqual([true, true, false, false, false, false, false, false]);
});
it("dispatches explicit classes with primitive continuation", async () => {
  expect(
    await r.eval(
      'local({is.numeric.fixture<-function(x)NextMethod();c(is.numeric(structure(1L,class="fixture")),is.numeric(structure("a",class="fixture")))})',
    ),
  ).toEqual([true, false]);
});
it("uses default methods only for classed inputs", async () => {
  expect(
    await r.eval(
      'local({is.numeric.default<-function(x)FALSE;c(is.numeric(structure(1L,class="unknown")),is.numeric(1L))})',
    ),
  ).toEqual([false, true]);
});
it("does not force arguments of the direct time methods", async () => {
  expect(
    await r.eval(
      'c(is.numeric.Date(stop("unused")),is.numeric.POSIXt(stop("unused")),is.numeric.difftime(stop("unused")))',
    ),
  ).toEqual([false, false, false]);
});
it("uses namespace lookup for data-frame validation", async () => {
  expect(await r.eval("local({is.numeric.AsIs<-function(x)FALSE;sum(data.frame(a=I(1:2)))})")).toBe(
    3,
  );
  await expect(
    r.eval("is.numeric.AsIs<-function(x)FALSE;sum(data.frame(a=I(1:2)))"),
  ).rejects.toThrow("all numeric-alike variables");
  await r.eval("rm(is.numeric.AsIs)");
});
