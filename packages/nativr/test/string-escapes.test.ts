import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
let r: NativRSession;
beforeAll(async () => {
  r = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    },
  });
});
afterAll(async () => r.dispose());
it.each([
  ['as.integer(charToRaw("\\1\\12\\1017"))', [1, 10, 65, 55]],
  ['as.integer(charToRaw("\\xff\\xfe"))', [255, 254]],
  ['as.integer(charToRaw("\\xc3\\xa9"))', [195, 169]],
  ['as.integer(charToRaw(quote("\\xff")))', 255],
  ['as.integer(charToRaw(eval(parse(text=deparse(quote("\\xff"))))))', 255],
  ['c("\\u41","\\u{42}","\\U{1f642}")', ["A", "B", "🙂"]],
  ['r"--(a\\q\\n)--"', "a\\q\\n"],
  ['local({`a\\n b`<-3L;get("a\\n b")})', 3],
])("evaluates escape semantics for %s", async (source, expected) => {
  expect(await r.eval(source)).toEqual(expected);
});
it("does not execute a program containing an invalid string escape", async () => {
  await expect(r.eval('escape_side_effect<-1L;"\\q"')).rejects.toMatchObject({ code: "NRP1003" });
  expect(await r.eval('exists("escape_side_effect")')).toBe(false);
});
