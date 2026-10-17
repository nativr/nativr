import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("uses classed as.list and extraction methods across apply and quoted do.call", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      seen<-character()
      as.list.fixture<-function(x,...){seen<<-c(seen,"as.list");x}
      length.fixture<-function(x)stop("unused length method")
      \`[[.fixture\`<-function(x,i,...){seen<<-c(seen,paste0("[[",i));unclass(x)[[i]]+10L}
      x<-structure(list(a=1L,b=2L),class="fixture")
      result<-list(lapply(x,identity),sapply(x,identity),vapply(x,identity,integer(1)),do.call(list,x,quote=TRUE))
      c(identical(result[[1]],list(a=11L,b=12L)),identical(result[[2]],c(a=11L,b=12L)),identical(result[[3]],c(a=11L,b=12L)),identical(result[[4]],list(a=11L,b=12L)),identical(seen,rep(c("as.list","[[1","[[2"),4)),identical(do.call(list,x),list(a=1L,b=2L)))
    `),
    ).toEqual(Array(6).fill(true));
    expect(
      await r.eval(
        `local({as.list.localfixture<-function(x,...)stop("local conversion");\`[[.localfixture\`<-function(x,...)stop("local extraction");lapply(structure(list(1,2),class="localfixture"),identity)})`,
      ),
    ).toEqual([1, 2]);
  } finally {
    await r.dispose();
  }
});

it("preserves lazy forwarded arguments, function lookup, names, and conversion results", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        `local({n<-0;f<-function(x,unused)x;c(identical(lapply(1:2,f,unused=stop("unused")),list(1L,2L)),identical(sapply(1:2,f,unused=stop("unused")),1:2),identical(vapply(1:2,f,integer(1),unused=stop("unused")),1:2),identical(lapply(1:2,function(x,y)y,y={n<-n+1;n}),list(1,1)),n==1,identical(lapply(1:2,"identity"),list(1L,2L)),identical(names(lapply(structure(1:2,names=c(NA,"x")),identity)),c(NA,"x")),identical(sapply(c(a=1,b=2),identity,USE.NAMES=FALSE),c(a=1,b=2)),identical(names(sapply(c("a","b"),identity)),c("a","b")))})`,
      ),
    ).toEqual(Array(9).fill(true));
    expect(
      await r.eval(
        `local({x<-structure(list(a=1),class="other",tag=2);c(identical(as.list(x),x),identical(as.list(data.frame(a=1)),list(a=1)),identical(lapply(expression(a,1+2),typeof),list("symbol","language")),identical(lapply(quote(a+b),typeof),list("symbol","symbol","symbol")))})`,
      ),
    ).toEqual(Array(4).fill(true));
    expect(
      await r.eval(
        `local({seen<-character();f<-function(n,v){seen<<-c(seen,n);v};sapply(f("X",1:2),f("FUN",identity),simplify=f("simplify",TRUE),USE.NAMES=f("NAMES",TRUE));seen})`,
      ),
    ).toEqual(["FUN", "X", "NAMES", "simplify"]);
  } finally {
    await r.dispose();
  }
});
