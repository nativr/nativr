import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("dispatches public unlist globally after forcing controls in native order", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      seen<-character()
      x<-structure(list(1,2),class="fixture")
      unlist.fixture<-function(x,recursive=TRUE,use.names=TRUE){seen<<-c(seen,"method");list(.Generic,.Method,recursive,use.names)}
      result<-unlist({seen<<-c(seen,"x");x},recursive={seen<<-c(seen,"recursive");"FALSE"},use.names={seen<<-c(seen,"names");0L})
      c(identical(result,list("unlist","unlist.fixture","FALSE",0L)),
        identical(seen,c("recursive","x","names","method")),
        identical(local({unlist.fixture<-function(...)stop("local method");unlist(x)}),list("unlist","unlist.fixture",TRUE,TRUE)))
    `),
    ).toEqual([true, true, true]);
    expect(
      await r.eval(`
      unlist.fixture<-function(x,recursive=TRUE,use.names=TRUE)invisible(c(missing(recursive),missing(use.names)))
      result<-withVisible(unlist(x,recursive=,use.names=))
      rm(unlist.fixture)
      c(identical(result$value,c(FALSE,FALSE)),result$visible,
        identical(local({unlist.fixture<-function(...)stop("local method");unlist(x)}),c(1,2)),
        identical(local({unlist.list<-function(...)stop("implicit method");unlist(list(1,2))}),c(1,2)))
    `),
    ).toEqual([true, true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("validates recursive before x while leaving names validation to the selected method", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      x<-structure(list(a=1,b=2),class="fixture")
      unlist.fixture<-function(...)stop("method")
      c(identical(capture(unlist(x,recursive=stop("recursive"))),"recursive"),
        identical(capture(unlist(x,use.names=stop("names"))),"names"),
        identical(capture(unlist(stop("x"),recursive=NULL)),"'recursive' must be a length-1 vector"),
        identical(capture(unlist(x,recursive=c(TRUE,FALSE))),"'recursive' must be a length-1 vector"),
        identical(capture(unlist(x,recursive=NA)),"'recursive' is NA"),
        identical(capture(unlist(x,recursive=NA_character_)),"'recursive' is NA"),
        identical(capture(unlist(x,recursive="yes")),"NA in coercion to boolean"),
        identical(capture(unlist(x,recursive=list(TRUE))),"NA in coercion to boolean"),
        identical(capture(unlist(x,use.names=NULL)),"method"),
        identical(capture(unlist(x,use.names=c(TRUE,FALSE))),"method"),
        identical(capture(unlist(recursive=stop("recursive"))),"recursive"))
    `),
    ).toEqual(Array(11).fill(true));
    expect(
      await r.eval(`
      rm(unlist.fixture)
      c(identical(capture(unlist(x,use.names=NULL)),"NA in coercion to boolean"),
        identical(capture(unlist(x,use.names=c(TRUE,FALSE))),"'length = 2' in coercion to 'logical(1)'"),
        identical(formals(unlist),formals(function(x,recursive=TRUE,use.names=TRUE)NULL)))
    `),
    ).toEqual([true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("observes recursive length and missingness through global methods", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      seen<-character()
      length.control<-function(x){seen<<-c(seen,"length");1L}
      is.na.control<-function(x){seen<<-c(seen,"is.na");FALSE}
      as.logical.control<-function(x,...)stop("coercion method")
      unlist.fixture<-function(x,recursive=TRUE,use.names=TRUE){seen<<-c(seen,"unlist");list(recursive,use.names)}
      x<-structure(list(1,2),class="fixture")
      control<-structure(FALSE,class="control")
      result<-unlist({seen<<-c(seen,"x");x},recursive=control,use.names={seen<<-c(seen,"names");control})
      trace<-seen
      localResult<-local({length.control<-function(x)stop("local length");is.na.control<-function(x)stop("local is.na");unlist(x,recursive=control)})
      c(identical(result,list(control,control)),identical(trace,c("length","is.na","x","names","unlist")),
        identical(localResult,list(control,TRUE)))
    `),
    ).toEqual([true, true, true]);
  } finally {
    await r.dispose();
  }
});
