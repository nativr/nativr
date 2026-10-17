import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("observes numeric dimension methods, concatenation and product before array construction", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      methods<-c("dim.gateitem","is.numeric.gatedim","c.gatedim","Summary.gatedim","Summary.gatesize")
      on.exit(rm(list=methods,envir=globalenv()))
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      x<-list(structure(1:4,class="gateitem"),structure(5:8,class="gateitem"))
      d<-c(NA_real_,2);dim.gateitem<<-function(x)d
      missing<-capture(simplify2array(x))
      classes<-lapply(c("factor","Date","POSIXt","difftime"),function(cl){
        d<<-if(cl=="factor")factor(c("b","b"),levels=c("a","b"))else structure(c(2L,2L),class=cl)
        identical(dim(simplify2array(x)),c(4L,2L))
      })
      events<-character();d<-structure(c(2L,2L),class="gatedim")
      is.numeric.gatedim<<-function(x){events<<-c(events,"numeric");FALSE}
      declined<-simplify2array(x,higher=NA);declined_events<-events
      events<-character();is.numeric.gatedim<<-function(x){events<<-c(events,"numeric");TRUE}
      Summary.gatedim<<-function(...,na.rm=FALSE)stop("dimension class must be dropped")
      ordinary<-simplify2array(x);ordinary_events<-events
      events<-character()
      c.gatedim<<-function(...,recursive=FALSE){events<<-c(events,"combine");structure(c(2L,2L,2L),class="gatesize")}
      Summary.gatesize<<-function(...,na.rm=FALSE){events<<-c(events,paste(.Generic,.Group,na.rm,sep=":"));7}
      rejected<-simplify2array(x);product_events<-events
      unknown_higher_false<-simplify2array(x,higher=NA)
      Summary.gatesize<<-function(...,na.rm=FALSE)stop("product rejected")
      product_error<-capture(simplify2array(x))
      unknown_higher_error<-capture(simplify2array(x,higher=NA))
      events<-character();is.numeric.gatedim<<-function(x){events<<-c(events,"numeric");NA}
      unknown<-capture(simplify2array(x));unknown_events<-events
      c(identical(missing,"missing value where TRUE/FALSE needed"),unlist(classes),
        identical(product_error,"product rejected"),
        identical(dim(declined),c(4L,2L)),identical(declined_events,"numeric"),
        identical(dim(ordinary),c(2L,2L,2L)),identical(ordinary_events,"numeric"),
        identical(dim(rejected),c(4L,2L)),identical(product_events,c("numeric","combine","prod:Summary:FALSE")),
        identical(dim(unknown_higher_false),c(4L,2L)),identical(unknown_higher_error,"product rejected"),
        identical(unknown,"product rejected"),identical(unknown_events,c("numeric","combine")))
    })`),
    ).toEqual(Array(16).fill(true));
  } finally {
    await r.dispose();
  }
});
