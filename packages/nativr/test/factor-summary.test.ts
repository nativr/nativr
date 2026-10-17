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

it("reduces ordered levels and preserves factor identity without incidental attributes", async () => {
  expect(
    await r.eval(
      `local({x<-ordered(c("middle","low",NA),levels=c("low","middle","high"));names(x)<-c("a","b","c");attr(x,"note")<-"fixture";c(identical(max(x,na.rm=TRUE),ordered("middle",levels=levels(x))),identical(range(x,na.rm=TRUE),ordered(c("low","middle"),levels=levels(x))),identical(min(x),ordered(NA,levels=levels(x))))})`,
    ),
  ).toEqual([true, true, true]);
});

it.each(["sum", "prod", "min", "max", "any", "all", "range"])(
  "rejects %s on unordered factors",
  async (generic) => {
    await expect(r.eval(`${generic}(factor("a"))`)).rejects.toThrow(
      `'${generic}' not meaningful for factors`,
    );
  },
);

it("requires ordered arguments with identical ordered levels", async () => {
  await expect(
    r.eval('min(ordered("a",levels=c("a","b")),ordered("b",levels=c("b","a")))'),
  ).rejects.toThrow("same level sets");
  await expect(r.eval('min(ordered("a"),factor("a"))')).rejects.toThrow("same level sets");
  await expect(r.eval('min(ordered("a"),NULL)')).rejects.toThrow("same level sets");
  await expect(r.eval('sum(ordered("a"))')).rejects.toThrow("not defined for ordered factors");
});

it("returns missing ordered extrema and warns in order for empty inputs", async () => {
  const result = await r.evalDetailed('range(ordered(character(),levels=c("low","high")))');
  expect(result.warnings.map((warning) => warning.message)).toEqual([
    "no non-missing arguments to min; returning Inf",
    "no non-missing arguments to max; returning -Inf",
  ]);
  expect(
    await r.eval(
      'identical(suppressWarnings(range(ordered(character(),levels=c("low","high")))),ordered(c(NA,NA),levels=c("low","high")))',
    ),
  ).toBe(true);
});

it("retains registered methods after reset and exposes native formals", async () => {
  await r.reset();
  expect(await r.eval('as.character(max(ordered(c("a","b"))))')).toBe("b");
  expect(await r.eval("names(formals(Summary.ordered))")).toEqual(["...", "na.rm"]);
});
