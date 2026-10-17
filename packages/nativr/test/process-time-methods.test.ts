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

it("combines child times independently and preserves missing parent times", async () => {
  expect(
    await runtime.eval("identical(summary.proc_time(TRUE),c(user=TRUE,system=NA,elapsed=NA))"),
  ).toBe(true);
  expect(
    await runtime.eval(
      "identical(summary.proc_time(c(NA,TRUE,TRUE,FALSE,NA)),c(user=NA_integer_,system=1L,elapsed=1L))",
    ),
  ).toBe(true);
  expect(
    await runtime.eval(
      `identical(summary(structure(1:5,class="proc_time")),c(user=5L,system=7L,elapsed=3L))`,
    ),
  ).toBe(true);
  expect(
    await runtime.eval(
      `identical(summary(structure(c(1,2,3,NA,5),class="proc_time")),c(user=1,system=7,elapsed=3))`,
    ),
  ).toBe(true);
  expect(
    await runtime.eval(
      `identical(summary(structure(c(NA,2,NaN,4,NaN),class="proc_time")),c(user=NA_real_,system=2,elapsed=NaN))`,
    ),
  ).toBe(true);
  expect(
    await runtime.eval(
      `identical(summary.proc_time(integer()),c(user=NA_integer_,system=NA_integer_,elapsed=NA_integer_))`,
    ),
  ).toBe(true);
});

it("prints three totals and invisibly returns the original object", async () => {
  const result = await runtime.evalDetailed(
    `x<-structure(1:5,class="proc_time",note="fixture"); print(x,digits=stop("unused"))`,
  );
  expect(result.visible).toBe(false);
  expect(result.output.map((event) => event.text).join("")).toBe(
    "   user  system elapsed \n      5       7       3 \n",
  );
  expect(await runtime.eval("identical(withVisible(print(x))$value,x)")).toBe(true);
});

it("supports summary S3 dispatch with lazy dots and one evaluation", async () => {
  expect(
    await runtime.eval(
      `local({ calls<-0L; summary.fixture<-function(object,...) c(custom=object[1]+1); result<-summary({calls<-calls+1L;structure(2,class="fixture")},unused=stop("unused"));c(result,calls) })`,
    ),
  ).toEqual([3, 1]);
  expect(
    await runtime.eval(
      'identical(summary.proc_time(1:5,unused=stop("unused")),c(user=5L,system=7L,elapsed=3L))',
    ),
  ).toBe(true);
});

it("retains proc_time methods after resetting the session", async () => {
  await runtime.reset();
  expect(await runtime.eval('unname(summary(structure(1:5,class="proc_time")))')).toEqual([
    5, 7, 3,
  ]);
});
