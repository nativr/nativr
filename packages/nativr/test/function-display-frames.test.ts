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
// Independently authored owned functions only; no library implementation bodies are inspected.
const cases = [
  [
    "retains observed operator display for attributed constants",
    `value<-structure(1:3,tag="owned");f<-function()NULL;body(f)<-as.call(list(as.name("^"),value,2));a<-identical(deparse(f),c("function () ","1:3^2"))&&identical(as.numeric(f()),c(1,4,9));body(f)<-as.call(list(as.name("-"),value));b<-identical(deparse(f),c("function () ","-1:3"));a&&b`,
  ],
  [
    "rejects frame positions beyond the evaluation frame",
    `err<-function(expr)tryCatch(expr,error=conditionMessage);identical(err(sys.call(-1e6)),"not that many frames on the stack")&&identical(err(sys.function(1e6)),"not that many frames on the stack")`,
  ],
  [
    "omits attributes on sequence bodies while retaining values",
    `f<-function()NULL;value<-structure(1:3,names=c("a","b","c"),tag="owned");body(f)<-value;identical(deparse(f),c("function () ","1:3"))&&identical(body(f),value)&&identical(f(),value)`,
  ],
  [
    "preserves non-sequence names in body syntax",
    `f<-function()NULL;value<-structure(c(2,4),names=c("a","b"),tag="owned");body(f)<-value;identical(deparse(f),c("function () ","c(a = 2, b = 4)"))&&identical(f(),value)`,
  ],
  [
    "omits nested list attributes in function syntax",
    `f<-function()NULL;value<-structure(list(a=structure(2,tag="inner")),tag="outer");body(f)<-value;identical(deparse(f),c("function () ","list(a = 2)"))&&identical(body(f),value)&&identical(f(),value)`,
  ],
  [
    "omits nested pairlist attributes in function syntax",
    `f<-function()NULL;value<-structure(pairlist(a=structure(2,tag="inner")),tag="outer");body(f)<-value;identical(deparse(f),c("function () ","pairlist(a = 2)"))&&identical(f(),value)`,
  ],
  [
    "shows factor body storage without changing its class",
    `f<-function()NULL;value<-factor(c("b","a"));body(f)<-value;identical(deparse(f),c("function () ","2:1"))&&identical(f(),value)`,
  ],
  [
    "shows matrix body storage without losing dimensions",
    `f<-function()NULL;value<-matrix(1:4,2);body(f)<-value;identical(deparse(f),c("function () ","1:4"))&&identical(f(),value)`,
  ],
  [
    "omits attributes from constant defaults",
    `f<-function(x)x;value<-structure(c(2,4),names=c("a","b"),tag="owned");formals(f)<-list(x=value);identical(deparse(f),c("function (x = c(a = 2, b = 4)) ","x"))&&identical(f(),value)&&identical(formals(f)$x,value)`,
  ],
  [
    "omits nested default attributes",
    `f<-function(x)x;value<-structure(list(a=structure(2,tag="inner")),tag="outer");formals(f)<-list(x=value);identical(deparse(f),c("function (x = list(a = 2)) ","x"))&&identical(f(),value)`,
  ],
  [
    "limits omission to function syntax",
    `f<-function()NULL;value<-structure(c(2,4),names=c("a","b"),tag="owned");body(f)<-as.call(list(as.name("identity"),value));identical(deparse(f),c("function () ","identity(c(a = 2, b = 4))"))&&grepl("structure",deparse(body(f)),fixed=TRUE)&&identical(f(),value)`,
  ],
  [
    "retains explicit structure calls in owned syntax",
    `f<-function()structure(1:3,tag="owned");identical(deparse(f),c("function () ",'structure(1:3, tag = "owned")'))&&identical(attr(f(),"tag"),"owned")`,
  ],
  [
    "retains closure attributes outside its function syntax",
    `f<-function()NULL;body(f)<-structure(1:3,tag="body");attr(f,"owned")<-structure(1:2,tag="attribute");identical(deparse(f),c("structure(function () ",'1:3, owned = structure(1:2, tag = "attribute"))'))`,
  ],
  [
    "uses identical syntax for printing an owned function",
    `f<-function()NULL;body(f)<-structure(1:3,tag="owned");environment(f)<-.GlobalEnv;plain<-identical(capture.output(print(f)),c("function () ","1:3"));attr(f,"owned")<-structure(1:2,tag="attribute");plain&&identical(capture.output(print(f)),c("function () ","1:3",'attr(,"owned")',"[1] 1 2",'attr(,"owned")attr(,"tag")','[1] "attribute"'))`,
  ],
  [
    "counts owned nested frames relative to their caller",
    `base<-sys.nframe();f<-function(){g<-function()sys.nframe();g()};observed<-f();identical(observed,base+2L)`,
  ],
  [
    "uses the caller frame while forcing forwarded expressions",
    `base<-sys.nframe();g<-function(x)h(x);h<-function(x)x;identical(g(sys.nframe()),base)&&identical(g(sys.call()),sys.call())`,
  ],
  [
    "uses the defining call frame for defaults",
    `base<-sys.nframe();h<-function(x)x;f<-function(x=sys.nframe())h(x);observed<-f();identical(observed,base+1L)&&identical(f(sys.nframe()),base)`,
  ],
  [
    "finds the owned caller function through a forwarded promise",
    `owner<-function(){h<-function(x)x;h(identical(sys.function(),owner))};owner()`,
  ],
  [
    "preserves relative call indexing in forwarded promises",
    `base<-sys.nframe();owner<-function(){h<-function(x)x;h(identical(sys.call(),quote(owner()))&&identical(sys.call(-1),sys.call(base)))};owner()`,
  ],
  [
    "uses a default promise's call and function",
    `h<-function(x)x;f<-function(x=c(call=identical(sys.call(),quote(f())),fun=identical(sys.function(),f)))h(x);all(f())`,
  ],
  [
    "supports explicit missing frame index defaults",
    `f<-function(){identical(sys.call(which=),sys.call())&&identical(sys.function(which=),f)};f()`,
  ],
  [
    "publishes frame accessor signatures",
    `identical(formals(sys.call),pairlist(which=0L))&&identical(formals(sys.function),pairlist(which=0L))&&is.null(formals(sys.nframe))&&identical(typeof(sys.nframe),"closure")&&is.function(args(sys.nframe))`,
  ],
  [
    "restores frame state after an owned error",
    `before<-sys.nframe();tryCatch((function(){stop("owned")})(),error=function(e)NULL);identical(sys.nframe(),before)`,
  ],
  [
    "restores frame state after an explicit return",
    `before<-sys.nframe();f<-function(){g<-function()return(7);g()};identical(f(),7)&&identical(sys.nframe(),before)`,
  ],
] as const;
it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});
it("observes the global frame through forwarded promises", async () => {
  await runtime.eval("g<-function(x)h(x);h<-function(x)x;invisible(NULL)");
  expect(await runtime.eval("g(sys.call())")).toBeNull();
  expect(await runtime.eval("g(sys.nframe())")).toBe(0);
  expect(await runtime.eval("g(is.null(sys.function()))")).toBe(true);
});
