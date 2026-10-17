import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("extracts custom as.list results without converting them a second time", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
        e<-new.env();e$a<-1
        as.list.fixture<-function(x,...)e
        x<-structure(list(9),class="fixture")
        list(
          tryCatch(lapply(x,identity),error=function(e)conditionMessage(e)),
          tryCatch(sapply(x,identity),error=function(e)conditionMessage(e)),
          tryCatch(vapply(x,identity,numeric(1)),error=function(e)conditionMessage(e)),
          tryCatch(do.call(list,x,quote=TRUE),error=function(e)conditionMessage(e))
        )
      `),
    ).toEqual(Array(4).fill("wrong arguments for subsetting an environment"));
    expect(
      await r.eval(`
        value<-NULL
        as.list.fixture<-function(x,...)value
        empty<-c(identical(lapply(x,identity),list()),identical(sapply(x,identity),list()),identical(vapply(x,identity,numeric(1)),numeric()),identical(do.call(list,x,quote=TRUE),list()))
        value<-expression(a,1+2)
        expressions<-c(identical(lapply(x,typeof),list("symbol","language")),identical(do.call(list,x,quote=TRUE),list(quote(a),quote(1+2))))
        value<-quote(f(a=1,b=2))
        calls<-identical(lapply(x,typeof),list("symbol",a="double",b="double"))
        value<-pairlist(a=1L,b=2L)
        pairs<-identical(lapply(x,identity),list(a=1L,b=2L))
        c(empty,expressions,calls,pairs)
      `),
    ).toEqual(Array(8).fill(true));
  } finally {
    await r.dispose();
  }
});

it("pads automatic sapply names after conversion and rejects excess names before simplify", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
        as.list.fixture<-function(x,...)list(1L,2L,3L)
        x<-structure(c("a","b"),class="fixture")
        c(identical(sapply(x,identity),structure(1:3,names=c("a","b",NA))),identical(sapply(x,identity,simplify=FALSE),structure(list(1L,2L,3L),names=c("a","b",NA))))
      `),
    ).toEqual([true, true]);
    expect(
      await r.eval(`
        as.list.fixture<-function(x,...)list(1L)
        tryCatch(sapply(x,identity,simplify=stop("simplify forced")),error=function(e)conditionMessage(e))
      `),
    ).toBe("'names' attribute [2] must be the same length as the vector [1]");
  } finally {
    await r.dispose();
  }
});
