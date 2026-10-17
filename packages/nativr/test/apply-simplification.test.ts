import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("shares scalar, matrix, higher-array, factor and zero-length simplification", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      a<-array(1:4,c(2,2),dimnames=structure(list(c(NA,"r2"),c("c1","")),names=c("rows",NA)))
      x<-structure(list(a,a+4L),names=c(NA,""))
      y<-sapply(x,identity,simplify="array")
      scalar<-simplify2array(structure(list(setNames(1,NA_character_),c(inner=2)),names=c(NA,"")))
      cells<-simplify2array(list(a=list(first=structure(1,tag="cell"),second=quote(z)),b=list(2,NULL)))
      f<-simplify2array(list(a=ordered("x",levels=c("x","y")),b=ordered("y",levels=c("x","y"))))
      fm<-simplify2array(list(a=factor(c("x","y")),b=factor(c("y","x"))))
      c(identical(dim(y),c(2L,2L,2L)),identical(names(dimnames(y)),c("rows",NA,"")),
        identical(dimnames(y)[[3]],c(NA,"")),identical(y,simplify2array(x)),
        identical(dim(sapply(x,identity)),c(4L,2L)),identical(names(scalar),c("NA.NA","inner")),
        identical(dim(cells),c(2L,2L)),identical(attr(cells[[1]],"tag"),"cell"),identical(cells[[2]],quote(z)),is.null(cells[[4]]),
        identical(class(f),"factor"),identical(levels(f),c("x","y")),identical(typeof(fm),"character"),
        identical(sapply(1:2,function(i)integer()),list(integer(),integer())),
        identical(dim(simplify2array(list(integer(),double()),except=NULL)),c(0L,2L)),
        identical(typeof(simplify2array(list(integer(),double()),except=NULL)),"double"),
        identical(typeof(simplify2array(list(list(),list()),except=NULL)),"list"))
    })`),
    ).toEqual(Array(17).fill(true));
  } finally {
    await r.dispose();
  }
});

it("keeps controls lazy and preserves native missing higher and exception behavior", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      capture<-function(x)tryCatch(x,error=conditionMessage)
      c(identical(simplify2array(list(),higher=stop("higher"),except=stop("except")),list()),
        identical(simplify2array(list(1,1:2),higher=stop("higher"),except=stop("except")),list(1,1:2)),
        identical(simplify2array(list(1,2),higher=stop("higher")),c(1,2)),
        identical(simplify2array(list(NULL,NULL),except=NULL,higher=stop("higher")),list(NULL,NULL)),
        identical(dim(simplify2array(list(1:2,3:4),higher=NA)),c(2L,2L)),
        identical(capture(simplify2array(list(matrix(1:4,2),matrix(5:8,2)),higher=NA)),"missing value where TRUE/FALSE needed"),
        identical(simplify2array(list(1,2),except=list(1)),c(1,2)),
        identical(dim(simplify2array(list(1:2,3:4),except=2)),c(2L,2L)),
        identical(capture(simplify2array(list(1,2),except=list(NULL))),"'list' object cannot be coerced to type 'integer'"),
        identical(capture(simplify2array(pairlist(a=1,b=2))),"'x' must be a list or atomic vector"),
        identical(simplify2array(c(a=1,b=2)),c(a=1,b=2)),
        identical(dim(simplify2array(c(a=1,b=2),except=NULL)),c(1L,2L)))
    })`),
    ).toEqual(Array(12).fill(true));
  } finally {
    await r.dispose();
  }
});

it("dispatches shared lengths and integer coercion and observes classed flattening", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`{
      seen<-character()
      length.item<-function(x){seen<<-c(seen,"length.item");2L}
      lengths.outer<-function(x,use.names=TRUE){seen<<-c(seen,"lengths.outer");lengths(unclass(x),use.names=use.names)}
      as.integer.exception<-function(x){seen<<-c(seen,"integer");integer()}
      x<-structure(list(a=structure(1:2,class="item"),b=structure(3:4,class="item")),class="outer")
      y<-simplify2array(x,except=structure(1,class="exception"))
      trace<-seen
      unlist.outer<-function(x,recursive=TRUE,use.names=TRUE)structure(1:3,class="flat")
      length.flat<-function(x)4L
      as.vector.flat<-function(x,mode="any")unclass(x)
      z<-simplify2array(x)
      c(identical(trace,c("lengths.outer","length.item","length.item","integer")),
        identical(unname(y),matrix(1:4,2)),identical(unname(z),matrix(c(1L,2L,3L,1L),2)),
        identical(as.integer(list(1,TRUE,"2")),c(1L,1L,2L)),
        identical(dim(lengths(matrix(1:4,2))),c(2L,2L)))
    }`),
    ).toEqual(Array(5).fill(true));
  } finally {
    await r.dispose();
  }
});
