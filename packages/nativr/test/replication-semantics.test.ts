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

// Owned fixtures record observable values and ordered warning messages, not oracle bodies.
const helper = `warnCapture<-function(expr){warnings<-character();value<-withCallingHandlers(expr,warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)};capture<-function(expr){warnings<-character();value<-tryCatch(withCallingHandlers(expr,warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)};same<-function(expr,value,warnings=character()){observed<-if(is.list(value)&&identical(names(value),"error"))capture(expr)else warnCapture(expr);identical(observed,list(value=value,warnings=warnings))};`;
const cases = [
  [
    "metadata",
    "special primitive and method signatures",
    `is.primitive(rep)&&typeof(rep)=="special"&&is.null(formals(rep))&&identical(names(formals(args(rep))),c("x","..."))&&all(vapply(c("Date","POSIXct","POSIXlt","difftime","factor","numeric_version"),function(n){f<-get(paste0("rep.",n));typeof(f)=="closure"&&identical(names(formals(f)),c("x","..."))},logical(1)))`,
  ],
  [
    "values",
    "cycles and per element counts retain names",
    `same(rep(c(a=1L,b=2L),2L),c(a=1L,b=2L,a=1L,b=2L))&&same(rep(c(a=1L,b=2L),c(1L,2L)),c(a=1L,b=2L,b=2L))`,
  ],
  [
    "values",
    "each expands before vector times",
    `same(rep(1:2,each=2L,times=c(1L,2L,3L,4L)),c(1L,1L,1L,2L,2L,2L,2L,2L,2L,2L))&&same(rep(1:2,each=2L,times=c(1L,2L)),list(error="invalid 'times' argument, given the value of 'each'"))`,
  ],
  [
    "values",
    "length takes precedence over times after forcing",
    `same(rep(1:2,times="bad",length.out=3L),c(1L,2L,1L))&&same(rep(1:2,times=0L,each=2L,length.out=5L),c(1L,1L,2L,2L,1L))&&same(rep(1:2,times=stop("times"),length.out=2L),list(error="times"))`,
  ],
  [
    "values",
    "negative fractions truncate to zero",
    `same(rep(1L,each=-0.9),integer())&&same(rep(1L,length.out=-0.9),integer())&&same(rep(1L,times=-0.9),integer())&&same(rep(1:2,times=1.9),1:2)`,
  ],
  [
    "values",
    "expressions preserve quoted elements",
    `same(rep(expression(x,y),each=2L),expression(x,x,y,y))&&same(rep(expression(x,y),length.out=3L),expression(x,y,x))`,
  ],
  [
    "values",
    "list element identity and attributes",
    `e<-new.env();v<-structure(1L,note="owned");x<-rep(list(e,v),2L);identical(x[[1]],e)&&identical(x[[3]],e)&&identical(x[[2]],v)&&identical(x[[4]],v)`,
  ],
  [
    "values",
    "atomic missingness and complex components",
    `same(rep(c(NA_real_,NaN,Inf),2L),c(NA_real_,NaN,Inf,NA_real_,NaN,Inf))&&same(rep(c(1+2i,NA_complex_),each=2L),c(1+2i,1+2i,NA_complex_,NA_complex_))&&same(rep(as.raw(1:2),2L),as.raw(c(1,2,1,2)))`,
  ],
  [
    "values",
    "encoding marks survive replication",
    `x<-c("caf\u00e9","a");Encoding(x)<-c("UTF-8","unknown");y<-rep(x,2L);identical(y,c(x,x))&&identical(Encoding(y),c(Encoding(x),Encoding(x)))`,
  ],
  [
    "attributes",
    "default drops class dimensions and extra attributes",
    `x<-structure(1:2,names=c("a","b"),note="owned",class="owned");same(rep(x,2L),c(a=1L,b=2L,a=1L,b=2L))&&same(rep(matrix(1:4,2L),2L),c(1:4,1:4))&&is.null(attributes(rep(structure(list(1L),class="owned",note="x"),2L)))`,
  ],
  [
    "empty",
    "empty values fill with typed missing values",
    `same(rep(integer(),length.out=2L),c(NA_integer_,NA_integer_))&&same(rep(character(),length.out=2L),c(NA_character_,NA_character_))&&same(rep(logical(),length.out=2L),c(NA,NA))&&same(rep(raw(),length.out=2L),raw(2L))`,
  ],
  [
    "empty",
    "empty lists and expressions fill with NULL",
    `same(rep(list(),length.out=2L),list(NULL,NULL))&&same(rep(expression(),length.out=2L),expression(NULL,NULL))&&same(rep(double(),length.out=2L),c(NA_real_,NA_real_))`,
  ],
  [
    "empty",
    "empty names fill with empty strings",
    `x<-integer();names(x)<-character();same(rep(x,length.out=2L),setNames(c(NA_integer_,NA_integer_),c("","")))`,
  ],
  [
    "empty",
    "empty input ignores times but validates each",
    `same(rep(integer(),times="bad"),integer())&&same(rep(integer(),times=-1L),integer())&&same(rep(integer(),each=0L,length.out=2L),c(NA_integer_,NA_integer_))&&same(rep(integer(),each=-1L),list(error="invalid 'each' argument"))`,
  ],
  [
    "empty",
    "NULL explicit positive length warns",
    `same(rep(NULL,length.out=2L),NULL,"'x' is NULL so the result will be NULL")&&same(rep(NULL,length.out=0L),NULL)&&same(rep(NULL,times=-1L),NULL)&&same(rep(),NULL)`,
  ],
  [
    "empty",
    "empty environment keeps identity or rejects lengthening",
    `e<-new.env();identical(rep(e),e)&&identical(rep(e,length.out=0L),e)&&same(rep(e,length.out=2L),list(error="cannot set length of non-(vector or list)"))`,
  ],
  [
    "scalar",
    "missing and nonfinite controls use defaults",
    `all(vapply(list(NA,NaN,Inf,-Inf),function(v)same(rep(1:2,each=v,times=2L),c(1L,2L,1L,2L))&&same(rep(1:2,length.out=v,times=2L),c(1L,2L,1L,2L)),logical(1)))`,
  ],
  [
    "scalar",
    "empty and long controls warn about first element",
    `same(rep(1:2,each=NULL),1:2,"first element used of 'each' argument")&&same(rep(1:2,length.out=integer()),1:2,"first element used of 'length.out' argument")&&same(rep(1:2,each=c(1L,2L)),1:2,"first element used of 'each' argument")`,
  ],
  [
    "scalar",
    "numeric strings and fractional controls",
    `same(rep(1L,each="2"),c(1L,1L))&&same(rep(1L,each="0x2p1"),c(1L,1L,1L,1L))&&same(rep(1:2,length.out=1.9),1L)`,
  ],
  [
    "scalar",
    "invalid strings warn and fall back",
    `same(rep(1:2,each="tRuE"),1:2,"NAs introduced by coercion")&&same(rep(1:2,length.out="bad",times=2L),c(1L,2L,1L,2L),"NAs introduced by coercion")&&same(rep(integer(),each="bad"),integer(),"NAs introduced by coercion")`,
  ],
  [
    "scalar",
    "blank and NaN strings silently fall back",
    `same(rep(1:2,each=""),1:2)&&same(rep(1:2,each=" "),1:2)&&same(rep(1:2,each="NaN"),1:2)&&same(rep(1:2,each="Inf"),1:2)`,
  ],
  [
    "scalar",
    "factor codes and nonvector controls",
    `same(rep(1:2,each=factor("2")),1:2)&&same(rep(1:2,each=list(2L)),1:2)&&same(rep(1:2,each=quote(x)),1:2)&&same(rep(1:2,each=quote(f(x))),1:2,"first element used of 'each' argument")`,
  ],
  [
    "scalar",
    "complex warnings precede length warnings",
    `same(rep(1L,each=c(2+1i,3+2i)),c(1L,1L),c("imaginary parts discarded in coercion","first element used of 'each' argument"))&&same(rep(1:2,each=complex(real=2,imaginary=NaN)),1:2)`,
  ],
  [
    "scalar",
    "raw scalar controls keep native diagnostics",
    `same(rep(1L,each=as.raw(2L)),list(error="unimplemented type 'raw' in 'asReal'\n"))&&same(rep(1L,length.out=as.raw(2L)),list(error="unimplemented type 'raw' in 'asReal'\n"))`,
  ],
  [
    "scalar",
    "native scalar bound is separate from output budget",
    `same(rep(1L,each=2^52,length.out=0L),integer())&&same(rep(1L,each=2^53,length.out=0L),list(error="invalid 'each' argument"))&&same(rep(1L,each=1e12,length.out=1L),1L)`,
  ],
  [
    "times",
    "times accepts scalar list and raw numeric values",
    `same(rep(1:2,times=list(2L)),c(1L,2L,1L,2L))&&same(rep(1:2,times=as.raw(2L)),c(1L,2L,1L,2L))&&same(rep(1:2,times=c("1","2")),c(1L,2L,2L))`,
  ],
  [
    "times",
    "pairlist counts keep their own coercion diagnostics",
    `same(rep(1:2,times=pairlist(1L,2L)),c(1L,2L,2L))&&same(rep(1L,times=pairlist(NULL)),list(error="'pairlist' object cannot be coerced to type 'double'"))&&same(rep(1L,times=list(integer())),list(error="invalid 'times' argument"))`,
  ],
  [
    "times",
    "list warnings retain element order while atomic coercion warns once",
    `same(rep(1:2,times=list("bad","bad")),list(error="invalid 'times' argument"),c("NAs introduced by coercion","NAs introduced by coercion"))&&same(rep(1:2,times=c("bad","bad")),list(error="invalid 'times' argument"),"NAs introduced by coercion")&&same(rep(1:2,times=list("bad",2+1i)),list(error="invalid 'times' argument"),c("NAs introduced by coercion","imaginary parts discarded in coercion"))`,
  ],
  [
    "times",
    "invalid times diagnose after coercion",
    `same(rep(1:2,times="bad"),list(error="invalid 'times' argument"),"NAs introduced by coercion")&&same(rep(1:2,times=NA),list(error="invalid 'times' argument"))&&same(rep(1:2,times=NULL),list(error="invalid 'times' argument"))`,
  ],
  [
    "times",
    "list and expression coercion boundaries",
    `same(rep(1:2,times=list(list(2L))),list(error="invalid 'times' argument"))&&same(rep(1:2,times=list(NULL)),list(error="'list' object cannot be coerced to type 'double'"))&&same(rep(1:2,times=expression(2L)),list(error="'list' object cannot be coerced to type 'double'"))`,
  ],
  [
    "times",
    "complex conversion retains warning and missingness",
    `same(rep(1:2,times=2+1i),c(1L,2L,1L,2L),"imaginary parts discarded in coercion")&&same(rep(1:2,times=complex(real=2,imaginary=NaN)),list(error="invalid 'times' argument"))`,
  ],
  [
    "times",
    "zero each and vector count lengths",
    `same(rep(1:2,each=0L,times=NULL),integer())&&same(rep(1:2,each=0L,times=-1L),list(error="invalid 'times' argument"))&&same(rep(1:2,each=0L,times=c(-1L,-2L)),list(error="invalid 'times' argument, given the value of 'each'"))`,
  ],
  [
    "ordering",
    "actual expressions force in source order",
    `seen<-character();v<-rep({seen<-c(seen,"x");1:2},each={seen<-c(seen,"each");1L},times={seen<-c(seen,"times");2L},length.out={seen<-c(seen,"length");3L});identical(v,c(1L,2L,1L))&&identical(seen,c("x","each","times","length"))`,
  ],
  [
    "ordering",
    "forcing precedes duplicate matching",
    `same(rep(times=stop("first"),x=stop("second"),times=stop("third")),list(error="first"))&&same(rep(1L,unused=stop("extra")),list(error="extra"))`,
  ],
  [
    "ordering",
    "length validation precedes each conversion",
    `same(rep(1:2,length.out=-1L,each="bad"),list(error="invalid 'length.out' argument"))&&same(rep(1:2,each=c(1L,2L),length.out=-1L),list(error="invalid 'length.out' argument"))`,
  ],
  [
    "ordering",
    "coercion warnings precede times validation",
    `same(rep(1:2,each="badEach",length.out="badLength",times="badTimes"),list(error="invalid 'times' argument"),c("NAs introduced by coercion","NAs introduced by coercion","NAs introduced by coercion"))&&same(rep(NULL,each="bad",length.out="bad",times="bad"),NULL,c("NAs introduced by coercion","NAs introduced by coercion"))`,
  ],
  [
    "ordering",
    "handlers can stop before later conversion",
    `seen<-0L;msg<-tryCatch(withCallingHandlers(rep(1L,each="bad",length.out="bad"),warning=function(w){seen<<-seen+1L;stop("handler")}),error=conditionMessage);identical(msg,"handler")&&identical(seen,1L)`,
  ],
  [
    "matching",
    "default matching includes partial and later exact names",
    `same(rep(1:2,t=2L),c(1L,2L,1L,2L))&&same(rep(times=2L,x=1:2),c(1L,2L,1L,2L))&&same(rep(1L,x=2L),2L)&&same(rep(1L,2L,3L,1L,4L),c(1L,1L,1L))`,
  ],
  [
    "matching",
    "partial matching warning option",
    `old<-options(warnPartialMatchArgs=TRUE);on.exit(options(old));same(rep(1L,t=2L),c(1L,1L),"partial argument match of 't' to 'times'")`,
  ],
  [
    "matching",
    "duplicate and missing object diagnostics",
    `same(rep(1L,times=2L,times=3L),list(error='formal argument "times" matched by multiple actual arguments'))&&same(rep(y=1:2),list(error="attempt to replicate an object of type 'symbol'"))&&same(rep(times=2L,x=),list(error="attempt to replicate an object of type 'symbol'"))`,
  ],
  [
    "matching",
    "explicit missing first argument and empty controls",
    `same(rep(,2L),list(error="argument is missing, with no default"))&&same(rep(x=),list(error="argument is missing, with no default"))&&same(rep(1:2,each=,length.out=),1:2)&&same(rep(1L,extra=),1L)`,
  ],
  [
    "dispatch",
    "dispatch precedes forcing unused actuals",
    `rep.owned<-function(x,...)42L;same(rep(structure(1L,class="owned"),times=stop("unused")),42L)&&same(rep(structure(1L,class="owned"),extra=),42L)`,
  ],
  [
    "dispatch",
    "first actual selects dispatch before default matching",
    `rep.owned<-function(x,...)42L;same(rep(times=structure(2L,class="owned"),x=1L),42L)&&same(rep(times=2L,x=structure(1L,class="owned")),c(1L,1L))&&same(rep(y=structure(1L,class="owned")),42L)`,
  ],
  [
    "dispatch",
    "implicit scalar classes do not dispatch",
    `rep.integer<-function(x,...)42L;same(rep(1L,2L),c(1L,1L))`,
  ],
  [
    "dispatch",
    "NextMethod reaches default without redispatch",
    `rep.owned<-function(x,...){v<-NextMethod();attr(v,"method")<-"owned";v};same(rep(structure(1:2,class="owned"),2L),structure(c(1L,2L,1L,2L),method="owned"))`,
  ],
  [
    "dispatch",
    "primitive makes dispatched results visible",
    `rep.owned<-function(x,...)invisible(42L);v<-withVisible(rep(structure(1L,class="owned")));identical(v,list(value=42L,visible=TRUE))&&identical(withVisible(rep(1L)),list(value=1L,visible=TRUE))`,
  ],
  [
    "factor",
    "factor method retains ordered classes and levels",
    `x<-ordered(c("b","a",NA));attr(x,"note")<-"owned";names(x)<-c("B","A","N");y<-rep(x,2L);identical(as.integer(y),c(2L,1L,NA_integer_,2L,1L,NA_integer_))&&identical(attributes(y),list(names=c("B","A","N","B","A","N"),class=c("ordered","factor"),levels=c("a","b")))`,
  ],
  [
    "factor",
    "empty factors retain levels while filling",
    `x<-factor(character(),levels=c("a","b"));y<-rep(x,length.out=2L);identical(as.integer(y),c(NA_integer_,NA_integer_))&&identical(attributes(y),list(class="factor",levels=c("a","b")))`,
  ],
  [
    "factor",
    "factor next method retains other result attributes",
    `rep.owned<-function(x,...)structure(c(1L,2L),note="next");x<-structure(1:2,class=c("factor","owned"),levels=c("a","b"));same(rep(x,2L),structure(1:2,note="next",class=c("factor","owned"),levels=c("a","b")))`,
  ],
  [
    "classes",
    "Date restores the original class vector",
    `x<-structure(c(1,2),class=c("owned","Date"),note="old",names=c("a","b"));same(rep(x,2L),structure(c(a=1,b=2,a=1,b=2),class=c("owned","Date")))`,
  ],
  [
    "classes",
    "POSIXct and difftime keep their specific attributes",
    `x<-structure(c(1,2),class=c("POSIXct","POSIXt"),tzone="UTC",note="old");d<-structure(c(1,2),class="difftime",units="hours",note="old");same(rep(x,2L),structure(c(1,2,1,2),class=c("POSIXct","POSIXt"),tzone="UTC"))&&same(rep(d,2L),structure(c(1,2,1,2),class="difftime",units="hours"))`,
  ],
  [
    "classes",
    "class method preserves attributes from next method",
    `rep.POSIXt<-function(x,...)structure(c(9,8),note="next");x<-structure(1,class=c("POSIXct","POSIXt"),tzone="UTC");same(rep(x,2L),structure(c(9,8),note="next",class=c("POSIXct","POSIXt"),tzone="UTC"))`,
  ],
  [
    "classes",
    "numeric version entries remain integer vectors",
    `x<-numeric_version(c("1.2","2.3"));names(x)<-c("a","b");attr(x,"note")<-"old";same(rep(x,2L),structure(list(a=1:2,b=2:3,a=1:2,b=2:3),class="numeric_version"))`,
  ],
  [
    "method-errors",
    "direct methods require a generic context",
    `same(rep.Date(1:2,2L),list(error="object not specified"))&&same(rep.factor(factor("a"),2L),list(error="generic function not specified"))&&same(rep.Date(factor("a"),2L),list(error="generic function not specified"))&&same(rep(structure(1,class="Date"),2L),structure(c(1,1),class="Date"))`,
  ],
  [
    "method-errors",
    "aliases retain direct method diagnostic",
    `f<-rep.Date;same(f(structure(1,class="Date"),2L),list(error="generic function not specified"))&&same(rep(structure(1,class="Date"),2L),structure(c(1,1),class="Date"))`,
  ],
  [
    "posixlt",
    "componentwise repetition and row names",
    `x<-as.POSIXlt(c("2000-01-01","2000-01-02"),tz="UTC");names(x)<-c("a","b");attr(x,"note")<-"old";y<-rep(x,each=2L);v<-unclass(y);identical(v$mday,c(1L,1L,2L,2L))&&identical(v$year,c(a=100L,a=100L,b=100L,b=100L))&&identical(names(y),c("a","a","b","b"))&&is.null(attr(y,"note"))&&identical(attr(y,"tzone"),"UTC")&&is.na(attr(y,"balanced"))`,
  ],
  [
    "posixlt",
    "component controls force once but warnings repeat",
    `x<-as.POSIXlt(c("2000-01-01","2000-01-02"),tz="UTC");seen<-0L;y<-rep(x,times={seen<-seen+1L;2L});v<-capture(rep(x,each="bad"));identical(c(length(y),seen),c(4L,1L))&&identical(v$warnings,rep("NAs introduced by coercion",11L))`,
  ],
  [
    "posixlt",
    "ragged components replicate independently",
    `x<-as.POSIXlt(c("2000-01-01","2000-01-02"),tz="UTC");v<-unclass(x);v$sec<-0;x<-structure(v,class=c("POSIXlt","POSIXt"));y<-rep(x,2L);identical(length(y),4L)&&identical(length(unclass(y)$sec),2L)&&identical(length(unclass(y)$year),4L)`,
  ],
  [
    "posixlt",
    "POSIXlt does not delegate to POSIXt",
    `rep.POSIXt<-function(x,...)stop("wrong");x<-as.POSIXlt("2000-01-01",tz="UTC");identical(length(rep(x,2L)),2L)&&identical(length(rep.POSIXlt(x,2L)),2L)`,
  ],
  [
    "posixlt",
    "unclassed direct calls retain component metadata",
    `x<-unclass(as.POSIXlt("2000-01-01",tz="UTC"));y<-rep.POSIXlt(x,2L);is.null(attr(y,"class"))&&identical(attr(y,"tzone"),"UTC")&&identical(attr(y,"balanced"),TRUE)&&identical(names(y),names(x))&&identical(y$year,c(100L,100L))`,
  ],
  [
    "posixlt",
    "short input fails before forcing controls",
    `same(rep.POSIXlt(1:2,times=stop("unused")),list(error='a valid "POSIXlt" object is a list of at least 9 elements'))&&same(rep.POSIXlt(structure(list(1L),class="POSIXlt"),2L),list(error='a valid "POSIXlt" object is a list of at least 9 elements'))`,
  ],
  [
    "posixlt",
    "seconds are real and absent balance is unknown",
    `x<-setNames(rep(list(1L),9L),c("sec","min","hour","mday","mon","year","wday","yday","isdst"));y<-rep.POSIXlt(x,2L);identical(y$sec,c(1,1))&&identical(y$min,c(1L,1L))&&is.na(attr(y,"balanced"))&&is.null(attr(y,"class"))`,
  ],
  [
    "posixlt-names",
    "names belong to year and reset balance",
    `x<-as.POSIXlt(c("2000-01-01","2000-01-02"),tz="UTC");fields<-names(unclass(x));names(x)<-"a";identical(names(x),c("a",NA_character_))&&identical(names(unclass(x)),fields)&&identical(names(unclass(x)$year),c("a",NA_character_))&&is.null(names(unclass(x)$sec))&&is.na(attr(x,"balanced"))`,
  ],
  [
    "posixlt-names",
    "NULL names remove row names and repeated edits clear balance",
    `x<-as.POSIXlt("2000-01-01",tz="UTC");names(x)<-"a";first<-attr(x,"balanced");names(x)<-NULL;is.null(names(x))&&is.na(first)&&is.null(attr(x,"balanced"))`,
  ],
  [
    "posixlt-length",
    "length uses longest component",
    `x<-unclass(as.POSIXlt(c("2000-01-01","2000-01-02"),tz="UTC"));x$zone<-rep("UTC",5L);class(x)<-c("POSIXlt","POSIXt");identical(length(x),5L)&&identical(length(rep(x,2L)),10L)`,
  ],
  [
    "diagnostics",
    "bad object types fail after controls",
    `e<-new.env();e$x<-1L;f<-function()1L;same(rep(e),list(error="attempt to replicate an object of type 'environment'"))&&same(rep(f,times=-1L),list(error="attempt to replicate an object of type 'closure'"))&&same(rep(f,each=-1L),list(error="invalid 'each' argument"))&&same(rep(pairlist(a=1L),2L),list(error="replication of pairlists is defunct"))`,
  ],
  [
    "diagnostics",
    "zero each with positive length rejects",
    `same(rep(1:2,each=0L,length.out=3L),list(error="invalid 'each' argument"))&&same(rep(1:2,each=0L,length.out=0L),integer())`,
  ],
] as const;

it.each(cases)("%s: %s", async (_group, _name, code) => {
  const result = await runtime.evalDetailed(`(function(){${helper}${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("checks final allocation and step limits before expanding repetition", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 64, maxSteps: 400 },
  });
  try {
    await expect(limited.eval("rep(1L,1e12)")).rejects.toMatchObject({ code: "NRL4002" });
    expect(await limited.eval("rep(1L,each=1e12,length.out=1L)")).toBe(1);
    await expect(limited.eval("rep(expression(x),1e12)")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await expect(limited.eval('rep(structure(1,class="Date"),1e12)')).rejects.toMatchObject({
      code: "NRL4002",
    });
    expect(await limited.eval("rep(2L,1L)")).toBe(2);
    expect(await limited.eval("sys.nframe()")).toBe(0);
  } finally {
    await limited.dispose();
  }
  const stepped = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 1024, maxSteps: 100 },
  });
  try {
    await expect(stepped.eval("rep(1L,500L)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await stepped.eval("rep(2L)")).toBe(2);
  } finally {
    await stepped.dispose();
  }
});
