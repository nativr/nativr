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
// Independently authored fixtures observe values, ordered conditions and owned method metadata.
const helper =
  'warnCapture<-function(expr){warnings<-character();value<-withCallingHandlers(expr,warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)};capture<-function(expr){warnings<-character();value<-tryCatch(withCallingHandlers(expr,warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)};same<-function(expr,value,warnings=character()){observed<-if(is.list(value)&&identical(names(value),"error"))capture(expr)else warnCapture(expr);identical(observed,list(value=value,warnings=warnings))};rm(list=intersect(ls(globalenv()),c("rep.owned","rep.default","rep.int.owned","rep_len.owned","rep.int.second","rep_len.second","rep.int.default","rep_len.default")),envir=globalenv());';
const cases = [
  [
    "metadata",
    "closure signatures",
    ' typeof(rep.int)=="closure"&&identical(names(formals(rep.int)),c("x","times"))&&typeof(rep_len)=="closure"&&identical(names(formals(rep_len)),c("x","length.out"))',
  ],
  ["int-controls", "rep.int negative fraction", " same(rep.int(1:2,-0.9),integer())"],
  ["int-controls", "rep.int fractional vector", " same(rep.int(1:2,c(-0.9,2.9)),c(2L,2L))"],
  [
    "int-controls",
    "rep.int blank coercion",
    ' same(rep.int(1:2,""),list(error="invalid \'times\' value"))',
  ],
  [
    "int-controls",
    "rep.int invalid coercion warning",
    ' same(rep.int(1:2,"bad"),list(error="invalid \'times\' value"),"NAs introduced by coercion")',
  ],
  [
    "int-controls",
    "rep.int raw scalar",
    " same(rep.int(1:2,as.raw(2)),list(error=\"unimplemented type 'raw' in 'asReal'\\n\"))",
  ],
  ["int-controls", "rep.int raw vector", " same(rep.int(1:2,as.raw(c(1,2))),c(1L,2L,2L))"],
  [
    "int-controls",
    "rep.int list scalar",
    " same(rep.int(1:2,list(2)),list(error=\"invalid 'times' value\"))",
  ],
  ["int-controls", "rep.int list vector", " same(rep.int(1:2,list(1,2)),c(1L,2L,2L))"],
  [
    "int-controls",
    "rep.int NULL input",
    " same(rep.int(NULL,0L),list(error=\"unimplemented type 'NULL' in 'rep3'\\n\"))",
  ],
  [
    "int-controls",
    "rep.int NULL control",
    " same(rep.int(1:2,NULL),list(error=\"invalid type (NULL) for 'times' (must be a vector)\"))",
  ],
  [
    "int-controls",
    "rep.int missing input",
    " same(rep.int(),list(error='argument \"x\" is missing, with no default'))",
  ],
  [
    "int-controls",
    "rep.int missing times",
    " same(rep.int(1L),list(error='argument \"times\" is missing, with no default'))",
  ],
  [
    "int-controls",
    "rep.int x forced before missing times",
    ' same(rep.int(stop("x")),list(error="x"))',
  ],
  [
    "int-controls",
    "rep.int invalid input before control coercion",
    ' same(rep.int(new.env(),"bad"),list(error="attempt to replicate an object of type \'environment\'"))',
  ],
  [
    "int-controls",
    "rep.int wrong vector size before coercion",
    ' same(rep.int(integer(),c("bad","bad")),list(error="invalid \'times\' value"))',
  ],
  ["length-controls", "rep_len negative fraction", " same(rep_len(1:2,-0.9),integer())"],
  ["length-controls", "rep_len positive fraction", " same(rep_len(1:2,1.9),1L)"],
  ["length-controls", "rep_len numeric text", ' same(rep_len(1:2,"3"),c(1L,2L,1L))'],
  [
    "length-controls",
    "rep_len invalid text",
    ' same(rep_len(1:2,"bad"),list(error="invalid \'length.out\' value"),"NAs introduced by coercion")',
  ],
  [
    "length-controls",
    "rep_len long control",
    " same(rep_len(1:2,c(1,2)),list(error=\"invalid 'length.out' value\"))",
  ],
  [
    "length-controls",
    "rep_len raw control",
    " same(rep_len(1:2,as.raw(2)),list(error=\"unimplemented type 'raw' in 'asReal'\\n\"))",
  ],
  [
    "length-controls",
    "rep_len complex control",
    ' same(rep_len(1:2,1+2i),1L,"imaginary parts discarded in coercion")',
  ],
  [
    "length-controls",
    "rep_len NULL lengthening",
    ' same(rep_len(NULL,1L),list(error="cannot replicate NULL to a non-zero length"))&&same(rep_len(NULL,0L),NULL)',
  ],
  [
    "length-controls",
    "rep_len empty integer fill",
    " same(rep_len(integer(),2L),c(NA_integer_,NA_integer_))",
  ],
  [
    "length-controls",
    "rep_len empty expression fill",
    " same(rep_len(expression(),2L),expression(NULL,NULL))",
  ],
  [
    "length-controls",
    "rep_len expression cycle",
    " same(rep_len(expression(x,y),3L),expression(x,y,x))",
  ],
  [
    "length-controls",
    "rep_len ordinary attribute stripping",
    ' same(rep_len(structure(1:2,names=c("a","b"),note="owned"),3L),c(1L,2L,1L))',
  ],
  [
    "length-controls",
    "rep_len invalid input before control coercion",
    ' same(rep_len(new.env(),"bad"),list(error="attempt to replicate non-vector"))',
  ],
  [
    "length-controls",
    "rep_len missing input",
    " same(rep_len(),list(error='argument \"x\" is missing, with no default'))",
  ],
  [
    "length-controls",
    "rep_len missing length",
    " same(rep_len(1L),list(error='argument \"length.out\" is missing, with no default'))",
  ],
  [
    "length-controls",
    "rep_len x forced before missing length",
    ' same(rep_len(stop("x")),list(error="x"))',
  ],
  [
    "dispatch",
    "rep.int global dispatch",
    'assign("rep.int.owned",function(x,times)42L,globalenv());assign("rep_len.owned",function(x,length.out)43L,globalenv()); same(rep.int(structure(1L,class="owned"),2L),42L)',
  ],
  [
    "dispatch",
    "rep.int force before dispatch",
    'assign("rep.int.owned",function(x,times)42L,globalenv());assign("rep_len.owned",function(x,length.out)43L,globalenv()); same(rep.int(structure(1L,class="owned"),stop("times")),list(error="times"))',
  ],
  [
    "dispatch",
    "rep_len global dispatch",
    'assign("rep.int.owned",function(x,times)42L,globalenv());assign("rep_len.owned",function(x,length.out)43L,globalenv()); same(rep_len(structure(1L,class="owned"),2L),43L)',
  ],
  [
    "dispatch",
    "rep_len force before dispatch",
    'assign("rep.int.owned",function(x,times)42L,globalenv());assign("rep_len.owned",function(x,length.out)43L,globalenv()); same(rep_len(structure(1L,class="owned"),stop("length")),list(error="length"))',
  ],
  [
    "values",
    "ordinary values and expression identity",
    'e<-new.env();x<-list(e,structure(2L,note="owned"));y<-rep.int(x,c(1L,2L));identical(y[[1]],e)&&identical(y[[2]],x[[2]])&&same(rep.int(expression(x,y),2L),expression(x,y,x,y))',
  ],
  [
    "values",
    "atomic NA NaN complex raw and encoding",
    'x<-c("caf\\u00e9","a");Encoding(x)<-c("UTF-8","unknown");same(rep.int(c(NA_real_,NaN),2L),c(NA_real_,NaN,NA_real_,NaN))&&same(rep_len(c(1+2i,NA_complex_),3L),c(1+2i,NA_complex_,1+2i))&&same(rep_len(as.raw(c(1,2)),3L),as.raw(c(1,2,1)))&&identical(Encoding(rep.int(x,2L)),c(Encoding(x),Encoding(x)))',
  ],
  [
    "attributes",
    "factor classes normalize and names drop",
    'x<-structure(factor(c("b","a")),class=c("owned","ordered","factor"),names=c("x","y"),note="owned");expected<-structure(c(2L,1L,2L),class=c("ordered","factor"),levels=c("a","b"));same(rep_len(x,3L),expected)&&same(rep.int(x,1L),structure(c(2L,1L),class=c("ordered","factor"),levels=c("a","b")))',
  ],
  [
    "empty",
    "empty zero length preserves attributes",
    'x<-structure(integer(),names=character(),note="owned",class="owned");same(rep_len(x,0L),x)&&same(rep_len(x,2L),setNames(c(NA_integer_,NA_integer_),c("","")))',
  ],
  [
    "empty",
    "empty factors lose class only when lengthened",
    'x<-structure(factor(),names=character(),note="owned");same(rep_len(x,0L),x)&&same(rep_len(x,2L),setNames(c(NA_integer_,NA_integer_),c("","")))&&same(rep.int(x,2L),structure(integer(),class="factor",levels=character()))',
  ],
  [
    "empty",
    "huge scalar times with zero output",
    'same(rep.int(integer(),1e100),integer())&&same(rep.int(list(),.Machine$double.xmax),list())&&same(rep_len(NULL,2^52),list(error="cannot replicate NULL to a non-zero length"))&&same(rep_len(NULL,2^52+1),list(error="invalid \'length.out\' value"))',
  ],
  [
    "empty",
    "empty list and raw filling",
    'x<-structure(list(),names=character(),note="owned");same(rep_len(x,0L),x)&&same(rep_len(x,2L),setNames(list(NULL,NULL),c("","")))&&same(rep_len(raw(),2L),raw(2L))',
  ],
  [
    "ordering",
    "declaration forcing order",
    'events<-character();r<-rep.int(times={events<-c(events,"times");2L},x={events<-c(events,"x");1L});identical(list(r,events),list(c(1L,1L),c("x","times")))&&{events<-character();r<-rep_len(length.out={events<-c(events,"length");2L},x={events<-c(events,"x");1L});identical(list(r,events),list(c(1L,1L),c("x","length")))}',
  ],
  [
    "ordering",
    "matching precedes forcing",
    'same(rep.int(stop("forced"),2L,3),list(error="unused argument (3)"))&&same(rep_len(stop("forced"),2L,extra=3),list(error="unused argument (extra = 3)"))&&same(rep.int(1L,t=2L),c(1L,1L))',
  ],
  [
    "warnings",
    "atomic versus list warning multiplicity",
    'same(rep.int(1:2,c("bad","bad")),list(error="invalid \'times\' value"),"NAs introduced by coercion")&&same(rep.int(1:2,list("bad","bad")),list(error="invalid \'times\' value"),c("NAs introduced by coercion","NAs introduced by coercion"))&&same(rep.int(1:2,c(1+2i,2+3i)),c(1L,2L,2L),"imaginary parts discarded in coercion")',
  ],
  [
    "warnings",
    "hex and missing components",
    'same(rep.int(1:2,c("0x1.8p1","2")),c(1L,1L,1L,2L,2L))&&same(rep_len(1:2,complex(real=2,imaginary=NaN)),list(error="invalid \'length.out\' value"))',
  ],
  [
    "diagnostics",
    "count type and element errors",
    "same(rep.int(1:2,pairlist(1,2)),list(error=\"invalid type (pairlist) for 'times' (must be a vector)\"))&&same(rep.int(1:2,list(NULL,1)),list(error=\"'list' object cannot be coerced to type 'double'\"))&&same(rep.int(integer(),expression()),list(error=\"'list' object cannot be coerced to type 'double'\"))&&same(rep.int(NULL,integer()),list(error=\"unimplemented type 'NULL' in 'rep2'\\n\"))",
  ],
  [
    "dispatch",
    "visible results despite invisible methods",
    'assign("rep.int.owned",function(x,times)invisible(42L),globalenv());assign("rep_len.owned",function(x,length.out)invisible(43L),globalenv());identical(withVisible(rep.int(structure(1,class="owned"),2L)),list(value=42L,visible=TRUE))&&identical(withVisible(rep_len(structure(1,class="owned"),2L)),list(value=43L,visible=TRUE))',
  ],
  [
    "dispatch",
    "namespace lookup ignores local method",
    'rep.int.owned<-function(x,times)42L;rep_len.owned<-function(x,length.out)43L;same(rep.int(structure(1L,class="owned"),2L),c(1L,1L))&&same(rep_len(structure(1L,class="owned"),2L),c(1L,1L))',
  ],
  [
    "dispatch",
    "fallback rep arguments and metadata",
    'assign("rep.owned",function(x,...)list(.Generic,.Method,list(...),substitute(x),substitute(list(...)),deparse(match.call())),globalenv());x<-structure(1L,class="owned");same(rep.int(x,2L),list("rep","rep.owned",list(2L),x,quote(list(2L)),"rep.owned(x = x, times)"))&&same(rep_len(x,3L),list("rep","rep.owned",list(length.out=3L),x,quote(list(length.out=3L)),"rep.owned(x = x, length.out = length.out)"))',
  ],
  [
    "dispatch",
    "primary generic before fallback",
    'assign("rep.owned",function(x,...)91L,globalenv());assign("rep.int.second",function(x,times)21L,globalenv());assign("rep_len.second",function(x,length.out)22L,globalenv());x<-structure(1,class=c("owned","second"));same(rep.int(x,2L),21L)&&same(rep_len(x,2L),22L)',
  ],
  [
    "dispatch",
    "primary default before fallback class",
    'assign("rep.owned",function(x,...)91L,globalenv());assign("rep.int.default",function(x,times)11L,globalenv());assign("rep_len.default",function(x,length.out)12L,globalenv());x<-structure(1,class="owned");same(rep.int(x,2L),11L)&&same(rep_len(x,2L),12L)&&same(rep.int(1L,2L),c(1L,1L))',
  ],
  [
    "dispatch",
    "fallback default class only",
    'assign("rep.default",function(x,...)31L,globalenv());same(rep.int(structure(1,class="owned"),2L),31L)&&same(rep_len(structure(1,class="owned"),2L),31L)&&same(rep_len(1L,2L),c(1L,1L))',
  ],
  [
    "dispatch",
    "factor bypasses rep fallback",
    'assign("rep.owned",function(x,...)91L,globalenv());x<-structure(factor("a"),class=c("owned","factor"));same(rep.int(x,2L),factor(c("a","a")))&&same(rep_len(x,2L),factor(c("a","a")))',
  ],
  [
    "classes",
    "Date names and class survive fallback",
    'x<-structure(1L,names="a",class=c("owned","Date"),note="owned");same(rep.int(x,2L),structure(c(a=1L,a=1L),class=c("owned","Date")))&&same(rep_len(x,2L),structure(c(a=1L,a=1L),class=c("owned","Date")))',
  ],
  [
    "classes",
    "time attributes survive fallback",
    'x<-structure(1,names="a",class=c("POSIXct","POSIXt"),tzone="UTC",note="owned");d<-structure(1L,class="difftime",units="hours");same(rep.int(x,2L),structure(c(a=1,a=1),class=c("POSIXct","POSIXt"),tzone="UTC"))&&same(rep_len(d,2L),structure(c(1L,1L),class="difftime",units="hours"))',
  ],
  [
    "reflection",
    "forced values and forwarded call syntax",
    'assign("rep.int.owned",function(x,times)list(substitute(x),substitute(times),deparse(match.call())),globalenv());x<-structure(1L,class="owned");same(rep.int(times=1L+1L,x=x),list(x,2L,"rep.int.owned(x = x, times = times)"))',
  ],
  [
    "reflection",
    "method frames and generic environments",
    'assign("rep_len.owned",function(x,length.out)list(sys.nframe(),sys.parent(),identical(.GenericCallEnv,parent.frame()),exists("x",.GenericCallEnv,inherits=FALSE),environmentName(.GenericDefEnv),deparse(sys.call()),deparse(sys.call(-1))),globalenv());n<-sys.nframe();r<-rep_len(structure(1L,class="owned"),2L);identical(r,list(n+3L,n+1L,TRUE,TRUE,"base","rep_len.owned(x, length.out)","rep_len(x, length.out)"))',
  ],
  [
    "next-method",
    "rep.int default uses reassigned control",
    'assign("rep.int.owned",function(x,times){times<-3L;NextMethod()},globalenv());same(rep.int(structure(1L,class="owned"),2L),c(1L,1L,1L))',
  ],
  [
    "next-method",
    "rep_len default uses reassigned control",
    'assign("rep_len.owned",function(x,length.out){length.out<-3L;NextMethod()},globalenv());same(rep_len(structure(1L,class="owned"),2L),c(1L,1L,1L))',
  ],
  [
    "next-method",
    "different primitive defaults retain fallback distinction",
    'assign("rep.owned",function(x,...)91L,globalenv());assign("rep.int.owned",function(x,times)NextMethod(),globalenv());assign("rep_len.owned",function(x,length.out)NextMethod(),globalenv());x<-structure(1L,class="owned");same(rep.int(x,2L),c(1L,1L))&&same(rep_len(x,2L),91L)',
  ],
  [
    "shared-s3",
    "ordinary S3 methods retain empty group metadata",
    'c.owned<-function(...)identical(.Group,"");gen<-function(x)UseMethod("gen");gen.first<-function(x)identical(.Group,"");identical(c(structure(1L,class="owned")),TRUE)&&identical(gen(structure(1L,class="first")),TRUE)',
  ],
  [
    "shared-s3",
    "owned generic forwards reassigned positional and named formals",
    'gen<-function(x,y)UseMethod("gen");gen.first<-function(x,y){x<-structure(4L,class=c("first","second"));y<-7L;NextMethod()};gen.second<-function(x,y)unclass(x)+y;identical(gen(structure(1L,class=c("first","second")),2L),11L)&&identical(gen(y=2L,x=structure(1L,class=c("first","second"))),11L)',
  ],
  [
    "shared-s3",
    "owned generic retains unforced arguments until next method",
    'gen<-function(x,y)UseMethod("gen");gen.first<-function(x,y)NextMethod();gen.second<-function(x,y)1L;identical(gen(structure(1L,class=c("first","second")),stop("must stay lazy")),1L)',
  ],
  [
    "shared-s3",
    "owned methods expose generic call and definition environments",
    'scope<-environment();gen<-function(x)UseMethod("gen");gen.first<-function(x)c(identical(.GenericCallEnv,scope),identical(.GenericDefEnv,globalenv()),identical(.GenericCallEnv,parent.frame()));identical(gen(structure(1L,class="first")),c(TRUE,TRUE,TRUE))',
  ],
] as const;
it.each(cases)("%s: %s", async (_group, _name, code) => {
  await runtime.reset();
  expect(await runtime.eval("local({" + helper + "\n" + code + "})")).toBe(true);
});
it("guards final allocation and steps, including empty huge counts", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 64, maxSteps: 400 },
  });
  try {
    for (const code of [
      "rep.int(1L,1e12)",
      "rep_len(1L,1e12)",
      "rep_len(expression(x),1e12)",
      "rep.int(structure(1,class='Date'),1e12)",
    ]) {
      await expect(limited.eval(code)).rejects.toMatchObject({ code: "NRL4002" });
      expect(await limited.eval("1+1")).toBe(2);
    }
    expect(await limited.eval("rep.int(integer(),1e100)")).toEqual([]);
  } finally {
    await limited.dispose();
  }
  const stepped = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 1024, maxSteps: 100 },
  });
  try {
    await expect(stepped.eval("rep_len(1L,500L)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await stepped.eval("sys.nframe()")).toBe(0);
  } finally {
    await stepped.dispose();
  }
});
