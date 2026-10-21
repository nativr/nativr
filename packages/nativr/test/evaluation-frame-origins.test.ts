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

// Owned relative observations only. Native eval/wrapper frame counts remain a separate gap.
const cases = [
  [
    "eval with a fresh environment",
    `eval(quote({base<-sys.nframe();g<-function(x)h(x);h<-function(x)x;observed<-g(sys.nframe());identical(observed,base)}),new.env())`,
  ],
  [
    "evalq with a fresh environment",
    `evalq({base<-sys.nframe();g<-function(x)h(x);h<-function(x)x;observed<-g(sys.nframe());identical(observed,base)},new.env())`,
  ],
  [
    "local forwarding",
    `local({base<-sys.nframe();g<-function(x)h(x);h<-function(x)x;observed<-g(sys.nframe());identical(observed,base)})`,
  ],
  [
    "list evaluation",
    `eval(quote({base<-sys.nframe();g<-function(x)x;observed<-g(sys.nframe());identical(observed,base)}),list())`,
  ],
  [
    "with evaluation",
    `with(list(marker=7L),{base<-sys.nframe();g<-function(x)x;observed<-g(sys.nframe());identical(observed,base)&&identical(marker,7L)})`,
  ],
  [
    "reused owned environment",
    `evalq({base<-sys.nframe();g<-function(x)x;observed<-g(sys.nframe());identical(observed,base)},environment())`,
  ],
  [
    "expression vector evaluation",
    `e<-new.env();eval(expression(base<-sys.nframe(),g<-function(x)x,observed<-g(sys.nframe()),identical(observed,base)),e)`,
  ],
  [
    "preserves supplied expression laziness",
    `local({calls<-0L;g<-function(x)17L;result<-g({calls<-calls+1L;sys.nframe()});identical(calls,0L)&&identical(result,17L)})`,
  ],
  [
    "memoizes a forwarded promise once",
    `local({base<-sys.nframe();calls<-0L;h<-function(x)c(x,x);g<-function(x)h(x);result<-g({calls<-calls+1L;sys.nframe()});identical(result,c(base,base))&&identical(calls,1L)})`,
  ],
  [
    "preserves call identity while forwarding",
    `local({before<-sys.call();g<-function(x)x;observed<-g(sys.call());identical(observed,before)})`,
  ],
  [
    "preserves function identity while forwarding",
    `local({before<-sys.function();g<-function(x)x;observed<-g(sys.function());identical(observed,before)})`,
  ],
  [
    "default promise in the reused evaluation environment",
    `f<-function(x=sys.nframe())evalq({before<-sys.nframe();observed<-x;identical(observed,before)},environment());f()`,
  ],
  [
    "default promise outside a distinct evaluation environment",
    `f<-function(x=sys.nframe()){before<-sys.nframe();evalq(identical(x,before),new.env())};f()`,
  ],
  [
    "nested reused evaluation origins restore",
    `local({e<-environment();before<-sys.nframe();f<-function()evalq({inside<-sys.nframe();g<-function(x)x;observed<-g(sys.nframe());identical(inside,observed)},e);ok<-f();ok&&identical(sys.nframe(),before)})`,
  ],
  [
    "restores after an owned error",
    `local({before<-sys.nframe();tryCatch(evalq(stop("owned"),new.env()),error=function(e)NULL);g<-function(x)x;observed<-g(sys.nframe());identical(observed,before)})`,
  ],
  [
    "restores after an owned function return",
    `local({before<-sys.nframe();result<-evalq((function()return(7L))(),new.env());g<-function(x)x;observed<-g(sys.nframe());identical(result,7L)&&identical(observed,before)})`,
  ],
  [
    "preserves invisible results",
    `e<-new.env();result<-withVisible(evalq(invisible(7L),e));identical(result,list(value=7L,visible=FALSE))`,
  ],
  [
    "preserves assigned object identity",
    `local({object<-new.env();g<-function(x)x;observed<-g(object);identical(observed,object)})`,
  ],
  [
    "escaped delayed frame count is global",
    `e<-new.env();evalq(delayedAssign("owned",sys.nframe()),e);f<-function()e$owned;observed<-f();identical(observed,0L)`,
  ],
  [
    "escaped delayed call is global",
    `e<-new.env();evalq(delayedAssign("owned",sys.call()),e);f<-function()e$owned;is.null(f())`,
  ],
  [
    "escaped delayed function is global",
    `e<-new.env();evalq(delayedAssign("owned",sys.function()),e);f<-function()e$owned;is.null(f())`,
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("restores evaluation origins after the call-depth limit", async () => {
  const limited = await createR({ execution: "inline", assets, limits: { maxCallDepth: 8 } });
  try {
    await limited.eval("e<-new.env();e$recur<-quote(eval(recur,e));invisible(NULL)");
    await expect(limited.eval("eval(e$recur,e)")).rejects.toMatchObject({ code: "NRL4004" });
    expect(await limited.eval("sys.nframe()")).toBe(0);
    expect(
      await limited.eval(
        "local({g<-function(x)x;base<-sys.nframe();identical(g(sys.nframe()),base)})",
      ),
    ).toBe(true);
  } finally {
    await limited.dispose();
  }
});
