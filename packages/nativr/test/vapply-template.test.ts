import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("validates each vapply result before executing the next callback", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
        seen<-integer()
        message<-tryCatch(vapply(1:3,function(i){seen<<-c(seen,i);if(i==2)"bad" else 1L},integer(1)),error=function(e)conditionMessage(e))
        list(seen,message,
          tryCatch(vapply(1,function(i)c("a","b"),integer(1)),error=function(e)conditionMessage(e)),
          tryCatch(vapply(1,identity,NULL,USE.NAMES=stop("unused")),error=function(e)conditionMessage(e)),
          tryCatch(vapply(1,identity,expression(),USE.NAMES=NA),error=function(e)conditionMessage(e)))
      })`),
    ).toEqual([
      [1, 2],
      "values must be type 'integer',\n but FUN(X[[2]]) result is type 'character'",
      "values must be length 1,\n but FUN(X[[1]]) result is length 2",
      "'FUN.VALUE' must be a vector",
      "invalid 'USE.NAMES' value",
    ]);
  } finally {
    await r.dispose();
  }
});

it("assembles atomic and list vapply results from the template shape and names", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
        template<-array(0L,c(2L,2L),list(row=c("r1","r2"),col=c("c1","c2")))
        result<-vapply(list(a=1,b=2),function(x)1:4,template)
        unnamed<-vapply(list(a=1,b=2),function(x)1:4,template,USE.NAMES=FALSE)
        c(identical(result,array(rep(1:4,2),c(2L,2L,2L),list(c("r1","r2"),c("c1","c2"),c("a","b")))),
          identical(unnamed,array(rep(1:4,2),c(2L,2L,2L))),
          identical(vapply(list(a=1,b=2),function(x)list(x,NULL),list(NULL,NULL)),structure(list(1,NULL,2,NULL),dim=c(2L,2L),dimnames=list(NULL,c("a","b")))),
          identical(vapply(1:2,function(x)c(z=x,w=x+1),c(q=0,r=0)),matrix(c(1,2,2,3),2,dimnames=list(c("q","r"),NULL))),
          identical(vapply(1:2,function(x)setNames(c(x,x),c(NA,"")),integer(2)),matrix(c(1L,1L,2L,2L),2,dimnames=list(c(NA,""),NULL))),
          identical(vapply(NULL,identity,template),array(integer(),c(2L,2L,0L),list(c("r1","r2"),c("c1","c2"),NULL))),
          identical(vapply(1:2,function(x)numeric(),numeric()),matrix(numeric(),0,2)),
          identical(vapply(1:2,identity,numeric(1)),c(1,2)),
          identical(vapply(1:2,function(x)TRUE,complex(1)),c(1+0i,1+0i)),
          identical(vapply(c("a","b"),identity,character(1),USE.NAMES=c(TRUE,FALSE)),c(a="a",b="b")))
      })`),
    ).toEqual(Array(10).fill(true));
  } finally {
    await r.dispose();
  }
});
