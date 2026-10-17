import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("coerces replicate counts and delays expression and simplify forcing", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      events<-character()
      result<-replicate({events<-c(events,"n");2},{events<<-c(events,"expr");1L},
                        simplify={events<-c(events,"simplify");TRUE})
      order<-events;events<-character()
      failed<-capture(replicate(2,{events<<-c(events,"expr");stop("expr")},simplify=stop("control")))
      failed_events<-events;events<-character()
      empty<-capture(replicate(0,stop("expr"),simplify={events<-c(events,"simplify");stop("control")}))
      caught<-tryCatch(replicate("bad",stop("expr"),simplify=stop("control")),
                       warning=function(w)list(class(w),conditionMessage(w)))
      c(identical(formals(replicate),formals(function(n,expr,simplify="array")NULL)),
        identical(result,c(1L,1L)),identical(order,c("n","expr","expr","simplify")),
        identical(failed,"expr"),identical(failed_events,"expr"),identical(empty,"control"),identical(events,"simplify"),
        identical(replicate("2",11L),c(11L,11L)),identical(replicate(-0.9,11L),list()),
        identical(replicate(factor("b",levels=c("a","b")),11L),c(11L,11L)),
        identical(capture(replicate(TRUE,11L)),"invalid 'length' argument"),
        identical(capture(replicate(c(1L,2L),11L)),"invalid 'length' argument"),
        identical(capture(replicate(NA_integer_,11L)),"vector size cannot be NA"),
        identical(capture(replicate(NA_real_,11L)),"vector size cannot be NA/NaN"),
        identical(capture(replicate(Inf,11L)),"vector size cannot be infinite"),
        identical(capture(replicate(-1L,11L)),"invalid 'length' argument"),
        identical(capture(replicate(,11L)),"argument \\"n\\" is missing, with no default"),
        identical(replicate(0,),list()),identical(replicate(0),list()),
        identical(capture(replicate(1,)),"argument is missing, with no default"),
        identical(replicate(2,11L,simplify=),c(11L,11L)),
        identical(caught,list(c("simpleWarning","warning","condition"),"NAs introduced by coercion")),
        identical(capture(suppressWarnings(replicate("bad",11L))),"vector size cannot be NA/NaN"))
    })`),
    ).toEqual(Array(23).fill(true));
    const warning = await r.evalDetailed(
      `tryCatch(replicate("bad",stop("expr")),error=conditionMessage)`,
    );
    expect(warning.value).toBe("vector size cannot be NA/NaN");
    expect(warning.warnings.map((item) => item.message)).toEqual(["NAs introduced by coercion"]);
  } finally {
    await r.dispose();
  }
});

it("gives each expression a fresh lexical frame with return, dots and exit cleanup", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      x<-0L;ordinary<-replicate(3,{x<-x+1L;x});ordinary_x<-x
      changed<-replicate(3,{x<<-x+1L;x})
      fresh<-replicate(3,{present<-exists("scratch",inherits=FALSE);scratch<-1L;present})
      caller<-environment();parents<-replicate(2,identical(parent.env(environment()),caller))
      returned<-local({out<-replicate(2,{return(7L);stop("after")});list(out,"outer")})
      events<-character();replicate(2,{on.exit(events<<-c(events,"exit"));events<<-c(events,"expr");1L})
      exits<-events;events<-character()
      error<-tryCatch(replicate(2,{on.exit(events<<-c(events,"exit"));stop("expr")}),error=conditionMessage)
      counter<-0L;closures<-replicate(3,{i<-counter;counter<<-counter+1L;function()i},FALSE)
      i<-0L;forward<-function(expr)replicate(3,expr);forwarded<-forward({i<-i+1L;i})
      c(identical(ordinary,c(1L,1L,1L)),identical(ordinary_x,0L),identical(changed,1:3),identical(x,3L),
        identical(fresh,c(FALSE,FALSE,FALSE)),all(parents),identical(returned,list(c(7L,7L),"outer")),
        identical(exits,c("expr","exit","expr","exit")),identical(error,"expr"),identical(events,"exit"),
        identical(lapply(closures,function(f)f()),list(0L,1L,2L)),
        !identical(environment(closures[[1]]),environment(closures[[2]])),
        identical(forwarded,c(1L,1L,1L)),identical(i,1L),
        identical(replicate(3,..1),c(0L,0L,0L)),identical(replicate(3,list(...)),list(0L,0L,0L)),
        withVisible(replicate(2,invisible(1L)))$visible,
        withVisible(replicate(2,invisible(1L),FALSE))$visible,withVisible(replicate(0,1L))$visible)
    })`),
    ).toEqual(Array(19).fill(true));
  } finally {
    await r.dispose();
  }
});

it("uses shared simplification for arrays, factors, lists and lazy global methods", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      methods<-c("length.repitem","dim.repitem","dimnames.repitem","==.repcontrol")
      on.exit(rm(list=methods,envir=globalenv()))
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      x<-matrix(1:4,2,dimnames=list(rows=c("r1","r2"),cols=c("c1","c2")))
      a<-replicate(2,x);f<-replicate(2,factor("b",levels=c("a","b")))
      events<-character()
      length.repitem<<-function(x){events<<-c(events,"length");4L}
      dim.repitem<<-function(x){events<<-c(events,"dim");c(2L,2L)}
      dimnames.repitem<<-function(x){events<<-c(events,"dimnames");list(c("r1","r2"),c("c1","c2"))}
      observed<-replicate(2,structure(1:4,class="repitem"));observed_events<-events
      \`==.repcontrol\`<<-function(e1,e2){events<<-c(events,paste(.Generic,.Group,sep=":"));TRUE}
      events<-character();controlled<-replicate(2,x,simplify=structure("other",class="repcontrol"));control_events<-events
      events<-character();scalar<-replicate(2,1L,simplify=structure("other",class="repcontrol"))
      c(identical(dim(a),c(2L,2L,2L)),identical(names(dimnames(a)),c("rows","cols","")),
        identical(dim(replicate(2,x,TRUE)),c(4L,2L)),identical(f,factor(c("b","b"),levels=c("a","b"))),
        identical(replicate(2,factor(c("a","b"))),matrix(c("a","b","a","b"),2)),
        identical(replicate(2,c(value=1L)),c(value=1L,value=1L)),
        identical(replicate(2,NULL),list(NULL,NULL)),identical(replicate(2,integer()),list(integer(),integer())),
        identical(replicate(2,1L,structure(FALSE,tag=1L)),list(1L,1L)),
        identical(replicate(2,1L,NULL),c(1L,1L)),
        identical(capture(replicate(2,x,NULL)),"missing value where TRUE/FALSE needed"),
        identical(dim(replicate(2,x,list("array"))),c(2L,2L,2L)),
        identical(observed_events,c("length","length","dim","dim","dimnames")),
        identical(dim(observed),c(2L,2L,2L)),identical(controlled,a),identical(control_events,"==:"),
        identical(scalar,c(1L,1L)),identical(events,character()))
    })`),
    ).toEqual(Array(18).fill(true));
  } finally {
    await r.dispose();
  }
});

it("accepts hexadecimal floating counts and keeps forced symbols and calls as values", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    const result = await r.evalDetailed(`local({
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      x<-17L
      c(identical(replicate("0x1p1",1L),c(1L,1L)),
        identical(replicate("0x1.8p1",1L),c(1L,1L,1L)),
        identical(replicate("0x.8p1",1L),1L),identical(replicate("0x1.p1",1L),c(1L,1L)),
        identical(replicate("0x1.8",1L),1L),identical(replicate("-0x1p-1",1L),list()),
        identical(capture(replicate("inf",1L)),"vector size cannot be infinite"),
        identical(capture(replicate("infinity",1L)),"vector size cannot be infinite"),
        identical(capture(replicate("nan",1L)),"vector size cannot be NA/NaN"),
        identical(replicate("0x0p1024",stop("unused")),list()),
        identical(replicate("0x0p999999",stop("unused")),list()),
        identical(replicate("-0x0p1024",stop("unused")),list()),
        identical(replicate("0x0p-999999",stop("unused")),list()),
        identical(replicate("0x0.000p999999",stop("unused")),list()),
        identical(mapply(replicate,2L,list(quote(x)),SIMPLIFY=FALSE),list(list(quote(x),quote(x)))),
        identical(mapply(replicate,2L,list(quote(no_such_object)),SIMPLIFY=FALSE),list(list(quote(no_such_object),quote(no_such_object)))),
        identical(mapply(replicate,2L,list(quote(1L+2L)),SIMPLIFY=FALSE),list(list(quote(1L+2L),quote(1L+2L)))),
        identical(do.call(replicate,list(2L,quote(x))),c(17L,17L)),
        identical(do.call(replicate,list(2L,quote(1L+2L))),c(3L,3L)))
    })`);
    expect(result.value).toEqual(Array(19).fill(true));
    expect(result.warnings).toEqual([]);
  } finally {
    await r.dispose();
  }
});

it("charges work while embedding a forced expression value", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxSteps: 1000 } });
  try {
    await r.eval("x<-list(1L);for(i in 1:12)x<-list(x,x);NULL");
    await expect(r.eval("mapply(replicate,1L,list(x),SIMPLIFY=FALSE)")).rejects.toMatchObject({
      code: "NRL4001",
    });
  } finally {
    await r.dispose();
  }
});
