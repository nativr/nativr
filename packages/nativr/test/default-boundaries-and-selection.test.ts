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

// Owned inputs and observable oracle results; no implementation bodies are inputs.
const support = `capture<-function(expr){warnings<-list();value<-withCallingHandlers(expr,warning=function(e){warnings[[length(warnings)+1L]]<<-list(message=conditionMessage(e),call=conditionCall(e),class=class(e));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)};error<-function(expr)tryCatch(expr,error=conditionMessage);`;
const cases = [
  [
    "preserves attributes attached to factor levels and class vectors",
    `levels<-structure(c("a","b"),tag="levels");classes<-structure(c("ordered","factor"),tag="class");x<-structure(c(2L,1L),levels=levels,class=classes);identical(x[[1]],structure(2L,levels=levels,class=classes))`,
  ],
  [
    "filters ranks in retained missing regions before bounds checks",
    `identical(sort.int(c(NA,3,1,2),partial=1e100,na.last=TRUE),c(3,1,2,NA))&&identical(sort.int(c(NA,3,1,2),partial=-1e100,na.last=FALSE),c(NA,3,1,2))&&identical(error(sort.int(c(NA,3,1,2),partial=5,na.last=FALSE)),"'partial' index 4 outside bounds")`,
  ],
  [
    "validates finiteness before the large-rank-list fallback",
    `identical(sort.int(c(3,1,2),partial=rep(4,11)),c(1,2,3))&&identical(error(sort.int(c(3,1,2),partial=c(rep(4,11),Inf))),"non-finite 'partial'")`,
  ],
  [
    "signals integer overflow before invalid rank errors",
    `x<-capture(error(sort.int(c(3,1,2),partial=1e100)));identical(x$value,"NA index")&&length(x$warnings)==1L&&identical(x$warnings[[1]]$message,"NAs introduced by coercion to integer range")&&identical(x$warnings[[1]]$call,quote(sort.int(c(3,1,2),partial=1e100)))`,
  ],
  [
    "reports empty and multiple atomic subscripts",
    `identical(error((1:3)[[integer()]]),"attempt to select less than one element in get1index")&&identical(error((1:3)[[c(1,2)]]),"attempt to select more than one element in vectorIndex")&&identical(error((1:3)[[c("a","b")]]),"attempt to select more than one element in vectorIndex")`,
  ],
  [
    "distinguishes direct S3 method names from aliases and anonymous calls",
    `x<-factor(c("a","b"));f<-get("[[.factor",envir=baseenv());identical(error(f(x,1)),"wrong value for .Method")&&identical(error(base::\x60[[.factor\x60(x,1)),"'NextMethod' called from an anonymous function")`,
  ],
  [
    "distinguishes local next-method lookup from direct method calls",
    `\x60[[.owned\x60<-function(x,...)structure(1L,owned="next");x<-factor(c("a","b"));class(x)<-c("factor","owned");expected<-structure(1L,owned="next",levels=c("a","b"),class=c("factor","owned"));direct<-structure(1L,levels=c("a","b"),class=c("factor","owned"));identical(x[[1]],expected)&&identical(\x60[[.factor\x60(x,1),direct)`,
  ],
  [
    "continues direct method calls through a globally visible next method",
    `assign("[[.owned",function(x,...)structure(1L,owned="next"),envir=.GlobalEnv);on.exit(rm(list="[[.owned",envir=.GlobalEnv));x<-factor(c("a","b"));class(x)<-c("factor","owned");expected<-structure(1L,owned="next",levels=c("a","b"),class=c("factor","owned"));identical(x[[1]],expected)&&identical(\x60[[.factor\x60(x,1),expected)`,
  ],
  [
    "retains argument order for direct primitive fallback",
    `x<-factor(c("b","a"));identical(error(\x60[[.factor\x60(i=2,x=x)),"attempt to select more than one element in vectorIndex")`,
  ],
  [
    "extracts atomic leaves at the final recursive subscript",
    `identical(list(1:3)[[c(1,2)]],2L)&&identical(list(list(c(a="x",b="y")))[[c(1,1,2)]],"y")`,
  ],
  [
    "warns when colon endpoints discard imaginary parts",
    `x<-capture(seq.default(from=1+2i,to=3+4i));identical(x$value,1:3)&&length(x$warnings)==2L&&all(vapply(x$warnings,function(w)identical(w$message,"imaginary parts discarded in coercion")&&identical(w$call,quote(seq.default(from=1+2i,to=3+4i)))&&identical(w$class,c("simpleWarning","warning","condition")),logical(1)))`,
  ],
  [
    "does not warn for complex endpoints with zero imaginary parts",
    `x<-capture(seq.default(from=1+0i,to=3+0i));identical(x$value,1:3)&&length(x$warnings)==0L`,
  ],
  [
    "interpolates both components with a requested length",
    `identical(seq.default(from=1+2i,to=3+4i,length.out=3),c(1+2i,2+3i,3+4i))`,
  ],
  [
    "extends a complex starting point without losing its imaginary part",
    `identical(seq.default(from=1+2i,length.out=3),c(1+2i,2+2i,3+2i))`,
  ],
  [
    "extends backwards from a complex endpoint",
    `identical(seq.default(to=3+4i,length.out=3),c(1+4i,2+4i,3+4i))`,
  ],
  [
    "uses both components of an explicit increment",
    `identical(seq.default(from=1+2i,by=2+3i,length.out=3),c(1+2i,3+5i,5+8i))&&identical(seq.default(to=5+8i,by=2+3i,length.out=3),c(1+2i,3+5i,5+8i))`,
  ],
  [
    "retains complex storage for length-one output",
    `identical(seq.default(from=1+2i,to=3+4i,length.out=1),1+2i)&&identical(seq.default(from=1,by=2+3i,length.out=1),1+0i)`,
  ],
  [
    "returns empty integer storage without complex coercion warnings",
    `x<-capture(seq.default(from=1+2i,to=3+4i,length.out=0));identical(x$value,integer())&&length(x$warnings)==0L`,
  ],
  [
    "rejects step comparisons on complex values",
    `identical(error(seq.default(from=1,to=3,by=1+2i)),"invalid comparison with complex values")&&identical(tryCatch(seq.default(from=1+2i,to=3,by=1),error=conditionCall),quote(n<0L))`,
  ],
  [
    "rejects nonfinite imaginary endpoints",
    `identical(error(seq.default(from=complex(real=1,imaginary=Inf),to=3,length.out=3)),"'from' must be a finite number")`,
  ],
  [
    "signals one zero truncation warning per formatting operation",
    `x<-capture(format.default(c(0,0,1),zero.print="zero"));identical(x$value,c("z","z","1"))&&length(x$warnings)==1L&&identical(x$warnings[[1]]$message,"'zero.print' is truncated to fit into formatted zeros; consider 'replace=TRUE'")&&identical(x$warnings[[1]]$call,quote(.format.zeros(x,zero.print,replace=replace.zero)))`,
  ],
  [
    "positions zero replacement within the formatted field",
    `identical(format.default(c(0,1),zero.print="zero",width=5),c(" zero","    1"))&&identical(format.default(c(0,1),zero.print="x",nsmall=2),c("x   ","1.00"))&&identical(format.default(c(-1,0,2),zero.print="x"),c("-1"," x"," 2"))`,
  ],
  [
    "combines zero replacement with grouping and trailing-zero removal",
    `identical(format.default(c(0,10000),big.mark=",",zero.print="x"),c("     x","10,000"))&&identical(format.default(c(0,1.2),zero.print="x",drop0trailing=TRUE),c("x","1.2"))`,
  ],
  [
    "uses logical zero controls",
    `identical(format.default(c(0,1),zero.print=FALSE,nsmall=2),c("    ","1.00"))&&identical(format.default(c(0,1),zero.print=TRUE),c("0","1"))`,
  ],
  [
    "validates zero controls only when a numeric zero is present",
    `identical(format.default(c(1,2),zero.print=7),c("1","2"))&&identical(format.default(numeric(),zero.print=7),character())&&identical(error(format.default(c(0,1),zero.print=7)),"'zero.print' must be character, logical or NULL")`,
  ],
  [
    "reports empty, missing and multiple zero controls",
    `identical(error(format.default(c(0,1),zero.print=character())),"invalid substring arguments")&&identical(error(format.default(c(0,1),zero.print=logical())),"argument is of length zero")&&identical(error(format.default(c(0,1),zero.print=NA_character_)),"missing value where TRUE/FALSE needed")&&identical(error(format.default(c(0,1),zero.print=c("x","y"))),"'zero.print' has length > 1")`,
  ],
  [
    "leaves logical and complex zeros unchanged",
    `identical(format.default(c(FALSE,TRUE),zero.print=7),c("FALSE"," TRUE"))&&identical(format.default(c(0+0i,1+2i),zero.print=7),c("0+0i","1+2i"))`,
  ],
  [
    "restores ordered factor extraction attributes and missingness",
    `x<-ordered(c("b",NA,"a"));names(x)<-c("B","M","A");attr(x,"owned")<-7L;y<-x[[1]];identical(y,structure(2L,levels=c("a","b"),class=c("ordered","factor")))&&identical(x[[2]],structure(NA_integer_,levels=c("a","b"),class=c("ordered","factor")))&&identical(names(attributes(y)),c("levels","class"))`,
  ],
  [
    "dispatches factor extraction through first-class calls",
    `x<-factor(c("b","a"));identical(do.call("[[",list(x,2)),structure(1L,levels=c("a","b"),class="factor"))&&identical(\x60[[.factor\x60(x,1),x[[1]])`,
  ],
  [
    "preserves the factor extraction signature",
    `identical(names(formals(base::\x60[[.factor\x60)),c("x","..."))`,
  ],
  [
    "keeps internal extraction free of factor attributes",
    `x<-factor(c(a="b",b="a"));identical(.subset(x,1),c(a=2L))&&identical(.subset2(x,1),2L)&&identical(list(x)[[c(1,2)]],1L)`,
  ],
  [
    "forces and ignores the double-extraction drop control",
    `x<-factor(c("a","b"));identical(x[[1,drop=NA]],x[[1]])&&identical(error(x[[1,drop=stop("drop")]]),"drop")`,
  ],
  [
    "allows an owned extraction method to continue through factor dispatch",
    `\x60[[.owned\x60<-function(x,...)NextMethod();x<-factor(c("b","a"));class(x)<-c("owned","factor");identical(x[[1]],structure(2L,levels=c("a","b"),class=c("owned","factor")))`,
  ],
  [
    "uses bounded partial selection for one rank",
    `identical(sort.int(c(9,1,7,2,8,3,6,4,5),partial=5),c(3,1,4,2,5,6,7,8,9))`,
  ],
  [
    "selects several ranks independently of index order and duplicates",
    `x<-c(9,1,7,2,8,3,6,4,5);wanted<-c(2,1,3,4,5,6,7,8,9);identical(sort.int(x,partial=c(3,5)),wanted)&&identical(sort.int(x,partial=c(5,5,3)),wanted)&&identical(sort.int(x,partial=c(3,5,7)),wanted)`,
  ],
  [
    "drops names and other attributes for partial selection",
    `x<-setNames(c(3,1,2),c("c","a","b"));attr(x,"owned")<-7;identical(sort.int(x,partial=2),c(1,2,3))&&identical(sort.int(x,partial=integer()),c(3,1,2))`,
  ],
  [
    "selects complex, character and logical ranks",
    `identical(sort.int(c(3+1i,1+2i,2+3i),partial=2),c(1+2i,2+3i,3+1i))&&identical(sort.int(c("i","a","g","b","h","c","f","d","e"),partial=5),c("c","a","d","b","e","f","g","h","i"))&&identical(sort.int(c(TRUE,FALSE,TRUE,FALSE),partial=2),c(FALSE,FALSE,TRUE,TRUE))`,
  ],
  [
    "separates retained missing values before rank selection",
    `identical(sort.int(c(NA,3,1,2),partial=1,na.last=FALSE),c(NA,3,1,2))&&identical(sort.int(c(NA,3,1,2),partial=4,na.last=TRUE),c(3,1,2,NA))&&identical(sort.int(c(NA,3,1,NaN,2),partial=2),c(1,2,3))`,
  ],
  [
    "fully sorts larger partial requests",
    `identical(sort.int(c(9,1,7,2,8,3,6,4,5),partial=rep(5,11)),as.double(1:9))`,
  ],
  [
    "validates partial rank finiteness and bounds",
    `x<-c(3,1,2);identical(error(sort.int(x,partial="2")),"non-finite 'partial'")&&identical(error(sort.int(x,partial=NA)),"non-finite 'partial'")&&identical(error(sort.int(x,partial=0)),"'partial' index 0 outside bounds")&&identical(error(sort.int(x,partial=4)),"'partial' index 4 outside bounds")&&identical(sort.int(x,partial=2.9),c(1,2,3))`,
  ],
  [
    "rejects unsupported partial options before rank validation",
    `x<-c(3,1,2);identical(error(sort.int(x,partial=0,decreasing=TRUE)),"unsupported options for partial sorting")&&identical(error(sort.int(x,partial=2,index.return=TRUE)),"unsupported options for partial sorting")&&identical(error(sort.int(x,partial=2,method="quick")),"unsupported options for partial sorting")&&identical(error(sort.int(factor(c("b","a")),partial=1)),"unsupported options for partial sorting")`,
  ],
  [
    "rejects radix partial selection without forcing x",
    `identical(error(sort.int(stop("x"),partial=2,method="radix")),"'partial' sorting not supported by radix method")`,
  ],
  [
    "forces partial controls before the data and missing-value control",
    `seen<-character();mark<-function(name,value){seen<<-c(seen,name);value};value<-sort.int(mark("x",c(3,1,2)),partial=mark("partial",2),decreasing=mark("decreasing",FALSE),na.last=mark("na.last",NA),method=mark("method","auto"),index.return=mark("index.return",FALSE));identical(value,c(1,2,3))&&identical(seen,c("decreasing","partial","method","x","index.return","na.last"))`,
  ],
  [
    "preserves the full-sort forcing path",
    `seen<-character();mark<-function(name,value){seen<<-c(seen,name);value};value<-sort.int(mark("x",c(3,1,2)),partial=mark("partial",NULL),decreasing=mark("decreasing",FALSE),na.last=mark("na.last",NA),method=mark("method","auto"),index.return=mark("index.return",FALSE));identical(value,c(1,2,3))&&identical(seen,c("decreasing","partial","index.return","x","na.last","method"))`,
  ],
  [
    "handles NULL and empty partial input separately",
    `identical(sort.int(NULL,partial=1),NULL)&&identical(error(sort.int(numeric(),partial=1)),"'partial' index 1 outside bounds")&&identical(error(sort.int(NULL,partial=stop("partial"))),"partial")`,
  ],
] as const;
it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${support}${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("bounds scanning even when every sorting value is missing", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 500, maxVectorLength: 5000 },
  });
  try {
    await limited.assign("x", new Float64Array(2000).fill(NaN));
    await expect(
      limited.eval('tryCatch(sort.int(x,partial=integer()),error=function(e)"caught")'),
    ).rejects.toMatchObject({ code: "NRL4001" });
  } finally {
    await limited.dispose();
  }
});
