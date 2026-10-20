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
// Independently authored closures and public signature metadata only. Never inspect library bodies.
const support = `capture<-function(expr){warnings<-list();value<-withCallingHandlers(expr,warning=function(e){warnings[[length(warnings)+1L]]<<-list(message=conditionMessage(e),call=conditionCall(e),class=class(e));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)};error<-function(expr)tryCatch(expr,error=conditionMessage);`;
const cases = [
  [
    "preserves the current environment for explicit NULL",
    `identical(environment(NULL),environment())`,
  ],
  [
    "forces active function bindings when resolving named accessors",
    `seen<-0L;e<-new.env();makeActiveBinding("owned",function(){seen<<-seen+1L;function(x=2)x+1},e);identical(names(formals("owned",envir=e)),"x")&&identical(seen,1L)`,
  ],
  [
    "constructs a function from NULL with a default enclosure",
    `x<-capture(\x60body<-\x60(NULL,value=2));identical(x$value(),2)&&is.environment(environment(x$value))&&identical(vapply(x$warnings,function(w)w$message,character(1)),c("'fun' is not a function","argument is not a function"))`,
  ],
  [
    "distinguishes unknown primitive signatures from zero-argument closures",
    `all(vapply(c("$","(",":","[","[["),function(name)is.null(args(get(name,envir=baseenv()))),logical(1)))&&is.function(args(function()NULL))&&is.null(formals(args(function()NULL)))`,
  ],
  [
    "retains repeated positional formals in matched calls and missingness",
    `f<-function()match.call();formals(f)<-pairlist(x=1,x=2);first<-identical(f(9,8),quote(f(x=9,x=8)))&&identical(match.call(f,quote(f(9,8))),quote(f(x=9,x=8)));body(f)<-quote(missing(x));first&&identical(c(f(),f(9),f(,8)),c(TRUE,FALSE,TRUE))`,
  ],
  [
    "uses the caller evaluation frame for accessors inside forced promises",
    `g<-function(z=2){h<-function(x)x;identical(h(body()),body(g))&&identical(h(formals()),formals(g))};g()`,
  ],
  [
    "preserves closure identity in constructed defaults",
    `default<-function()7;f<-function(x)x;formals(f)<-pairlist(x=default);identical(formals(f)$x,default)&&identical(f(),default)`,
  ],
  [
    "looks up args names globally while preserving direct owned arguments",
    `assign("owned_args_fixture",function(global=1)NULL,envir=.GlobalEnv);on.exit(rm(list="owned_args_fixture",envir=.GlobalEnv));owned_args_fixture<-function(local=2)NULL;identical(names(formals(args("owned_args_fixture"))),"global")&&identical(names(formals(args(owned_args_fixture))),"local")`,
  ],
  [
    "validates args name lookup independently of accessor lookup",
    `is.null(args(character()))&&is.null(args(c("abs","mean")))&&is.null(args(1))&&identical(error(args("")),"attempt to use zero-length variable name")&&identical(error(args(NA_character_)),'could not find function "NA"')`,
  ],
  [
    "returns owned atomic and symbol bodies in their value types",
    `identical(body(function()1),1)&&identical(body(function()1L),1L)&&identical(body(function()TRUE),TRUE)&&identical(body(function()"owned"),"owned")&&identical(body(function()NA_integer_),NA_integer_)&&identical(body(function()x),quote(x))&&identical(body(function()NULL),NULL)`,
  ],
  [
    "returns owned call and complex bodies",
    `identical(body(function(x){x+1}),quote({x+1}))&&identical(body(function()1i),1i)&&identical(body(function()quote(x)),quote(quote(x)))`,
  ],
  [
    "finds local functions by name",
    `owned<-function(x=2,...)x+1;identical(formals("owned"),formals(owned))&&identical(body("owned"),body(owned))`,
  ],
  [
    "skips non-function bindings during named lookup",
    `owned<-function(x=2)x+1;(function(){owned<-7;identical(names(formals("owned")),"x")&&identical(body("owned"),quote(x+1))})()`,
  ],
  [
    "resolves lazy function and non-function bindings",
    `seen<-character();mark<-function(){seen<<-c(seen,"forced");1};outer<-new.env();outer$owned<-function(z=4)z;inner<-new.env(parent=outer);delayedAssign("owned",mark(),assign.env=inner);identical(names(formals("owned",envir=inner)),"z")&&identical(seen,"forced")`,
  ],
  [
    "uses an explicit lookup environment",
    `owned<-function(x)NULL;e<-new.env();e$owned<-function(y=3)NULL;identical(names(formals("owned",envir=e)),"y")`,
  ],
  [
    "does not force unused lookup environments",
    `owned<-function(x)NULL;identical(names(formals(owned,envir=stop("unused"))),"x")&&is.null(capture(formals(1,envir=stop("unused")))$value)`,
  ],
  [
    "validates named lookup lengths and missing labels",
    `identical(error(formals(character())),"invalid first argument")&&identical(error(body("")),"invalid first argument")&&identical(error(formals(c("a","b"))),"first argument has length > 1")&&identical(error(body(NA_character_)),"object 'NA' of mode 'function' was not found")`,
  ],
  [
    "validates lookup environment values",
    `identical(error(formals("owned",envir=NULL)),"use of NULL environment is defunct")&&identical(error(formals("owned",envir=list())),"invalid 'envir' argument")&&identical(error(formals("owned",envir=NA)),"invalid 'envir' argument")`,
  ],
  [
    "uses the current owned closure for omitted accessors",
    `f<-function(x=2,...){identical(formals(),formals(f))&&identical(body(),body(f))};f()`,
  ],
  [
    "uses accessor defaults for explicitly empty arguments",
    `f<-function(x=2){identical(formals(fun=),formals(f))&&identical(body(fun=),body(f))};f()`,
  ],
  [
    "exposes the documented reflection signatures",
    `identical(formals(body),formals(function(fun=sys.function(sys.parent()))NULL))&&identical(formals(formals),formals(function(fun=sys.function(sys.parent()),envir=parent.frame())NULL))&&identical(formals(get("body<-")),formals(function(fun,envir=environment(fun),value)NULL))&&identical(formals(get("formals<-")),formals(function(fun,envir=environment(fun),value)NULL))&&identical(formals(base::args),formals(function(name)NULL))`,
  ],
  [
    "signals getter warnings through calling handlers",
    `a<-capture(body(1));b<-capture(formals(1));is.null(a$value)&&is.null(b$value)&&identical(a$warnings[[1]]$message,"argument is not a function")&&identical(a$warnings[[1]]$call,quote(body(fun)))&&identical(b$warnings[[1]]$call,quote(formals(fun)))&&identical(a$warnings[[1]]$class,c("simpleWarning","warning","condition"))`,
  ],
  [
    "keeps primitive formals absent and primitive bodies null",
    `is.null(formals(abs))&&is.null(formals("abs"))&&is.null(body(abs))&&is.primitive(abs)&&!is.primitive(body)&&is.function(body)`,
  ],
  [
    "keeps an args result detached from the owned body",
    `f<-function(x=2,...){stop("unused")};a<-args(f);identical(formals(a),formals(f))&&is.null(body(a))&&identical(environment(a),.GlobalEnv)&&is.null(a())`,
  ],
  [
    "replaces owned bodies without mutating aliases",
    `f<-local({bias<-40;function(x=2)x+bias});g<-f;body(f)<-quote(x+1);identical(f(),3)&&identical(g(),42)&&identical(environment(f),environment(g))&&identical(body(g),quote(x+bias))`,
  ],
  [
    "retains vector bodies and their attributes",
    `f<-function()NULL;value<-structure(1:3,names=c("a","b","c"),tag="body");body(f)<-value;identical(body(f),value)&&identical(f(),value)&&identical(typeof(body(f)),"integer")`,
  ],
  [
    "retains empty atomic and NULL bodies",
    `f<-function()1;body(f)<-integer();identical(body(f),integer())&&identical(f(),integer())&&{body(f)<-NULL;is.null(body(f))&&is.null(f())}`,
  ],
  [
    "retains nested identity in list bodies",
    `e<-new.env();value<-list(e=e,values=structure(c(1,2),tag="values"));f<-function()NULL;body(f)<-value;identical(body(f),value)&&identical(f()$e,e)&&identical(f(),value)`,
  ],
  [
    "retains pairlist bodies",
    `value<-pairlist(x=structure(2,tag="value"));f<-function()NULL;body(f)<-value;identical(body(f),value)&&identical(f(),value)`,
  ],
  [
    "evaluates replacement symbols and calls in the closure environment",
    `f<-function(x=4)NULL;body(f)<-quote(x);identical(f(),4)&&{body(f)<-quote(x+1);identical(f(),5)}`,
  ],
  [
    "changes the closure environment explicitly",
    `f<-function(x=2)NULL;e<-new.env();e$bias<-7;g<-\x60body<-\x60(f,envir=e,value=quote(x+bias));identical(g(),9)&&identical(environment(g),e)&&is.null(f())`,
  ],
  [
    "drops function attributes when replacing components",
    `f<-function(x=2)x+1;attr(f,"owned")<-7;g<-\x60body<-\x60(f,value=2);h<-\x60formals<-\x60(f,value=pairlist(x=4));is.null(attributes(g))&&is.null(attributes(h))&&identical(attr(f,"owned"),7)`,
  ],
  [
    "selects an expression body's first element and warns only for multiple elements",
    `f<-function(x=2)NULL;a<-capture(\x60body<-\x60(f,value=expression(x+1)));b<-capture(\x60body<-\x60(f,value=expression(x+1,stop("unused"))));identical(a$value(),3)&&length(a$warnings)==0L&&identical(b$value(),3)&&length(b$warnings)==1L&&identical(b$warnings[[1]]$message,"using the first element of 'value' of type \\"expression\\"")`,
  ],
  [
    "rejects empty expression bodies before forcing the environment",
    `f<-function()NULL;identical(error(\x60body<-\x60(f,envir=stop("env"),value=expression())),"subscript out of bounds")`,
  ],
  [
    "forces environments before rejecting inadmissible bodies",
    `f<-function()NULL;identical(error(\x60body<-\x60(f,envir=stop("env"),value=function()1)),"env")&&identical(error(\x60body<-\x60(f,value=function()1)),"invalid body for function")&&identical(error(\x60body<-\x60(f,value=new.env())),"invalid body for function")`,
  ],
  [
    "rejects NULL and non-environment replacement enclosures",
    `f<-function()NULL;identical(error(\x60body<-\x60(f,envir=NULL,value=1)),"use of NULL environment is defunct")&&identical(error(\x60formals<-\x60(f,envir=1,value=pairlist(x=1))),"invalid environment")`,
  ],
  [
    "forces replacement arguments in semantic order",
    `f<-function(x=2)x;seen<-character();mark<-function(name,value){seen<<-c(seen,name);value};g<-\x60body<-\x60(mark("fun",f),envir=mark("envir",environment(f)),value=mark("value",quote(x+1)));first<-seen;seen<-character();h<-\x60formals<-\x60(mark("fun",f),envir=mark("envir",environment(f)),value=mark("value",pairlist(x=4)));identical(first,c("fun","value","envir"))&&identical(seen,first)&&identical(g(),3)&&identical(h(),4)`,
  ],
  [
    "replaces formals with attributed constant defaults",
    `f<-function(x) x;value<-structure(1:2,tag="default");formals(f)<-pairlist(x=value);identical(formals(f)$x,value)&&identical(f(),value)`,
  ],
  [
    "preserves lazy expression defaults and trailing dots formals",
    `f<-function()c(x,y);formals(f)<-alist(x=stop("unused"),...=,y=3);identical(f(x=2),c(2,3))&&identical(names(formals(f)),c("x","...","y"))`,
  ],
  [
    "converts named atomic formal defaults",
    `f<-function()c(a,b);formals(f)<-c(a=1L,b=2L);identical(f(),1:2)&&identical(formals(f),pairlist(a=1L,b=2L))`,
  ],
  [
    "accepts empty formal lists and missing name labels",
    `f<-function()1;formals(f)<-list();first<-is.null(formals(f));formals(f)<-structure(list(2),names=NA_character_);first&&identical(names(formals(f)),"NA")&&identical(formals(f)[[1]],2)`,
  ],
  [
    "retains the first duplicate default when constructed formals contain repeated names",
    `f<-function()x;formals(f)<-pairlist(x=1,x=2);identical(names(formals(f)),c("x","x"))&&identical(f(),1)&&identical(f(9,stop("unused")),9)&&identical(error(f(x=9)),"argument 1 matches multiple formal arguments")&&identical(error(f(9,8,7)),"unused argument (7)")`,
  ],
  [
    "rejects invalid formal lists after forcing the environment",
    `f<-function()NULL;identical(error(\x60formals<-\x60(f,value=list(1))),"invalid formal argument list for \\"as.function\\"")&&identical(error(\x60formals<-\x60(f,value=expression(1))),"list argument expected")&&identical(error(\x60formals<-\x60(f,envir=stop("env"),value=list(1))),"env")`,
  ],
  [
    "uses the explicit environment for replaced formal defaults",
    `f<-function(x)x;e<-new.env();e$owned<-8;g<-\x60formals<-\x60(f,envir=e,value=alist(x=owned));identical(g(),8)&&identical(environment(g),e)`,
  ],
  [
    "retains raw, complex, logical and character body values",
    `values<-list(as.raw(c(1,2)),c(1+2i,3+4i),c(TRUE,NA),c("a",NA_character_));all(vapply(values,function(value){f<-function()NULL;body(f)<-value;identical(body(f),value)&&identical(f(),value)},logical(1)))`,
  ],
  [
    "can construct a closure from a primitive with an explicit environment",
    `e<-new.env();g<-\x60body<-\x60(abs,envir=e,value=2);h<-\x60formals<-\x60(abs,envir=e,value=pairlist(x=2));is.null(formals(g))&&identical(g(),2)&&is.null(h())&&identical(names(formals(h)),"x")&&identical(environment(g),e)`,
  ],
  [
    "warns before forcing a replacement on non-function input",
    `seen<-character();mark<-function(name,value){seen<<-c(seen,name);value};x<-capture(error(\x60body<-\x60(mark("fun",1),envir=mark("env",stop("env")),value=mark("value",stop("value")))));identical(seen,c("fun","value"))&&identical(x$value,"value")&&identical(x$warnings[[1]]$message,"'fun' is not a function")`,
  ],
  [
    "constructs a body from non-function input with observed warnings",
    `e<-new.env();x<-capture(\x60body<-\x60(1,envir=e,value=2));identical(x$value(),2)&&identical(vapply(x$warnings,function(w)w$message,character(1)),c("'fun' is not a function","argument is not a function"))&&identical(environment(x$value),e)`,
  ],
  [
    "matches partial reflection arguments before forcing values",
    `f<-function(x=2)x;identical(formals(fu=f),formals(f))&&identical(body(fu=f),quote(x))&&identical(\x60body<-\x60(fu=f,va=3)(),3)`,
  ],
] as const;
it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${support}${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});
it("bounds embedded function-body materialization even inside an R error handler", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 500, maxVectorLength: 5000 },
  });
  try {
    await limited.assign("owned", new Float64Array(2000));
    await expect(
      limited.eval('f<-function()NULL;tryCatch({body(f)<-owned},error=function(e)"caught")'),
    ).rejects.toMatchObject({ code: "NRL4001" });
  } finally {
    await limited.dispose();
  }
});
