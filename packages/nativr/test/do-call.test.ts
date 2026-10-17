import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
it("evaluates do.call language arguments with quoting, laziness, and visibility", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({a<-7;c(identical(do.call(identity,list(quote(a))),7),identical(do.call(identity,list(quote(a)),quote=TRUE),quote(a)),identical(do.call(function(x)42,list(quote(stop("unused")))),42),!withVisible(do.call(invisible,list(1)))$visible)})',
      ),
    ).toEqual([true, true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("forces do.call controls in native order and accepts conditional quote coercion", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        `local({seen<-character();f<-function(n,v){seen<<-c(seen,n);v};do.call(f("what",identity),f("args",list(1)),quote=f("quote",FALSE),envir=f("envir",globalenv()));seen})`,
      ),
    ).toEqual(["args", "quote", "what", "envir"]);
    expect(
      await r.eval(
        `local({a<-9;c(sapply(list(1,1L,1i,as.raw(1),"TRUE","T"),function(q)identical(do.call(identity,list(quote(a)),quote=q),quote(a))),sapply(list(0,0L,0i,as.raw(0),"FALSE","F"),function(q)identical(do.call(identity,list(quote(a)),quote=q),9)),identical(do.call(identity,pairlist(quote(a)),quote=TRUE),quote(a)),identical(do.call(wh=identity,ar=list(42),qu=FALSE),42),identical(do.call(identity,list(1),quote=),1))})`,
      ),
    ).toEqual(Array(15).fill(true));
    expect(await r.eval("local({`NA`<-function(x)x+1;do.call(NA_character_,list(3))})")).toBe(4);
  } finally {
    await r.dispose();
  }
});

it("reports do.call control failures before forcing later arguments", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        `lapply(list(quote(do.call(stop("what"),stop("args"),quote=stop("quote"),envir=stop("envir"))),quote(do.call(stop("what"),list(1),quote=stop("quote"))),quote(do.call(stop("what"),1,quote=stop("quote"))),quote(do.call(1,list(1),envir=stop("envir"))),quote(do.call(identity,pairlist(1))),quote(do.call(identity,NULL)),quote(do.call(identity,list(1),quote=NA)),quote(do.call(identity,list(1),quote=list())),quote(do.call(identity,list(1),quote=list(TRUE,FALSE))),quote(do.call(identity,list(1),quote=list(TRUE))),quote(do.call(identity,list(1),quote=NaN)),quote(do.call(identity,list(1),quote=complex(real=NaN,imaginary=1)))),function(e)tryCatch(eval(e),error=function(e)conditionMessage(e)))`,
      ),
    ).toEqual([
      "args",
      "quote",
      "second argument must be a list",
      "envir",
      "'args' must be a list",
      "second argument must be a list",
      "missing value where TRUE/FALSE needed",
      "argument is of length zero",
      "the condition has length > 1",
      "argument is not interpretable as logical",
      "argument is not interpretable as logical",
      "argument is not interpretable as logical",
    ]);
  } finally {
    await r.dispose();
  }
});
