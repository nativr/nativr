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

// Owned cases checked against the optional GNU R 4.6.1 black-box oracle.
const cases = [
  [
    "dispatches seq on the first actual including named controls",
    `seq.owned<-function(...)list(call=sys.call(),values=list(...));x<-structure(4,class="owned");identical(seq(to=x,from=1),list(call=quote(seq.owned(to=x,from=1)),values=list(to=x,from=1)))`,
  ],
  [
    "preserves empty and NULL actual lists in seq dispatch",
    `seq.NULL<-function(...)list(sys.call(),list(...));identical(seq(),list(quote(seq.NULL()),list()))&&identical(seq(NULL),list(quote(seq.NULL(NULL)),list(NULL)))`,
  ],
  [
    "uses only the default method for a missing seq dispatch object",
    `seq.NULL<-function(...)stop("null");seq.numeric<-function(...)stop("numeric");seq.default<-function(...)list(sys.call(),missing(..1));identical(seq(from=),list(quote(seq.default(from=)),TRUE))`,
  ],
  [
    "distinguishes seq.int primitive dispatch from seq",
    `seq.numeric<-function(...)"numeric";seq.default<-function(...)"default";identical(seq(3),"numeric")&&identical(seq.int(3),1:3)&&identical(seq.int(structure(3,class="owned")),"default")&&identical(seq.int(),1L)`,
  ],
  [
    "matches sort before selecting the x actual for dispatch",
    `sort.owned<-function(x,decreasing=FALSE,...)list(call=sys.call(),decreasing=decreasing,dots=list(...));x<-structure(3:1,class="owned");identical(sort(decreasing=TRUE,x=x),list(call=quote(sort.owned(decreasing=TRUE,x=x)),decreasing=TRUE,dots=list()))`,
  ],
  [
    "leaves absent and explicitly missing defaults to the selected method",
    `sort.owned<-function(x,decreasing=7,...)c(missing=missing(decreasing),value=decreasing);x<-structure(3:1,class="owned");identical(sort(x),c(missing=1,value=7))&&identical(sort(x,decreasing=),c(missing=1,value=7))`,
  ],
  [
    "forces sort decreasing before x and preserves method laziness",
    `seen<-character();mark<-function(name,value){seen<<-c(seen,name);value};sort.owned<-function(x,decreasing=FALSE,...)7;x<-structure(3:1,class="owned");identical(sort(mark("x",x),decreasing=mark("decreasing",TRUE),unused=stop("forced")),7)&&identical(seen,c("decreasing","x"))`,
  ],
  [
    "retains format actual order in the selected method call",
    `format.owned<-function(x,...)list(call=sys.call(),dots=list(...));x<-structure(3.14,class="owned");identical(format(digits=2,x=x),list(call=quote(format.owned(digits=2,x=x)),dots=list(digits=2)))`,
  ],
  [
    "retains invisible method results",
    `seq.owned<-function(...)invisible(7);sort.owned<-function(...)invisible(8);format.owned<-function(...)invisible(9);x<-structure(1,class="owned");identical(withVisible(seq(x)),list(value=7,visible=FALSE))&&identical(withVisible(sort(x)),list(value=8,visible=FALSE))&&identical(withVisible(format(x)),list(value=9,visible=FALSE))`,
  ],
  [
    "records generic and default sort warning calls",
    `old<-options(warnPartialMatchArgs=TRUE);on.exit(options(old));seen<-list();value<-withCallingHandlers(sort(c(3,1,2),decr=TRUE),warning=function(w){seen[[length(seen)+1]]<<-conditionCall(w);invokeRestart("muffleWarning")});identical(value,c(3,2,1))&&identical(seen,list(quote(sort(c(3,1,2),decr=TRUE)),quote(sort.default(c(3,1,2),decr=TRUE))))`,
  ],
  [
    "records sequence and format default warning calls",
    `old<-options(warnPartialMatchArgs=TRUE);on.exit(options(old));identical(tryCatch(seq(f=1,t=3),warning=conditionCall),quote(seq.default(f=1,t=3)))&&identical(tryCatch(format(1.234,dig=2),warning=conditionCall),quote(format.default(1.234,dig=2)))`,
  ],
  [
    "retains generic and default signatures",
    `identical(formals(seq),formals(function(...)NULL))&&identical(formals(seq.default),formals(function(from=1,to=1,by=((to-from)/(length.out-1)),length.out=NULL,along.with=NULL,...)NULL))&&identical(formals(sort),formals(function(x,decreasing=FALSE,...)NULL))&&identical(formals(sort.default),formals(function(x,decreasing=FALSE,na.last=NA,...)NULL))&&identical(formals(format),formals(function(x,...)NULL))`,
  ],
  [
    "retains format default signature metadata",
    `identical(formals(format.default),formals(function(x,trim=FALSE,digits=NULL,nsmall=0L,justify=c("left","right","centre","none"),width=NULL,na.encode=TRUE,scientific=NA,big.mark="",big.interval=3L,small.mark="",small.interval=5L,decimal.mark=getOption("OutDec"),zero.print=NULL,drop0trailing=FALSE,...)NULL))`,
  ],
  [
    "uses sequence defaults for absent and empty slots",
    `identical(seq(),1L)&&identical(seq(from=),1L)&&identical(seq(from=,to=3),1:3)&&identical(seq.default(from=3,to=),3:1)`,
  ],
  [
    "uses length for one nonnumeric sequence input",
    `identical(seq(NULL),integer())&&identical(seq(character()),integer())&&identical(seq(letters[1:3]),1:3)&&identical(seq(FALSE),1L)&&identical(seq(NA),1L)&&identical(seq.default("3"),1L)`,
  ],
  [
    "retains sequence integer and double storage",
    `identical(seq(3),1:3)&&identical(seq(from=1,to=3.5),1:3)&&identical(seq(from=1,to=3,by=1),c(1,2,3))&&identical(seq(from=1L,to=3L,by=1L),1:3)&&identical(seq(from=1.5,to=3.5),c(1.5,2.5,3.5))`,
  ],
  [
    "handles sequence endpoint and length combinations",
    `identical(seq(to=5,length.out=3),c(3,4,5))&&identical(seq(from=3,length.out=3),c(3,4,5))&&identical(seq(from=3,by=2,length.out=3),c(3,5,7))&&identical(seq(from=0,to=1,length.out=3),c(0,0.5,1))&&identical(seq(length.out=2.2),1:3)`,
  ],
  [
    "lets along.with take precedence without forcing length.out",
    `identical(seq.default(along.with=1:4,length.out=stop("unused")),c(1,2,3,4))&&identical(seq.default(along.with=NULL),integer())`,
  ],
  [
    "forces sequence controls and endpoints before zero-length return",
    `seen<-character();mark<-function(name,value){seen<<-c(seen,name);value};value<-seq.default(to=mark("to",3),from=mark("from",1),length.out=mark("length",0),by=stop("unused"));identical(value,integer())&&identical(seen,c("length","from","to"))`,
  ],
  [
    "returns an equal stepped endpoint with its attributes",
    `x<-structure(2,tag=7);identical(seq.default(from=x,to=2,by=0),x)&&identical(seq.default(from=1L,to=1L,by=0L),1L)`,
  ],
  [
    "reports sequence control boundary errors",
    `identical(tryCatch(seq.default(3,length.out=NULL),error=conditionMessage),"'length.out' must be of length 1")&&identical(tryCatch(seq.default(length.out=NA),error=conditionMessage),"'length.out' must be a non-negative number")&&identical(tryCatch(seq.default(from=1,to=3,by=-1),error=conditionMessage),"wrong sign in 'by' argument")&&identical(tryCatch(seq.default(from=1,to=3,by=1,length.out=3),error=conditionMessage),"too many arguments")`,
  ],
  [
    "warns about extra sequence arguments without forcing them",
    `seen<-NULL;value<-withCallingHandlers(seq.default(from=1,other=stop("forced")),warning=function(w){seen<<-list(conditionMessage(w),conditionCall(w));invokeRestart("muffleWarning")});identical(value,1L)&&identical(seen,list(paste0('In seq.default(from = 1, other = stop("forced")) :',intToUtf8(10)," extra argument 'other' will be disregarded"),NULL))`,
  ],
  [
    "warns before using the first length element",
    `seen<-NULL;value<-withCallingHandlers(seq.default(length.out=c(2,3)),warning=function(w){seen<<-list(conditionMessage(w),conditionCall(w));invokeRestart("muffleWarning")});identical(value,1:2)&&identical(seen,list("first element used of 'length.out' argument",quote(seq.default(length.out=c(2,3)))))`,
  ],
  [
    "uses declared sort defaults for empty actuals",
    `identical(sort(c(2,1),decreasing=),c(1,2))&&identical(sort(c(2,NA,1),na.last=),c(1,2))&&identical(sort(NULL),NULL)`,
  ],
  [
    "retains names and drops incidental sort attributes",
    `identical(sort(structure(c(z=2,a=1),tag=7)),c(a=1,z=2))&&identical(sort.default(structure(c(z=2,a=1),class="owned",tag=7)),c(a=1,z=2))`,
  ],
  [
    "sorts complex values by real then imaginary parts",
    `identical(sort(c(2+1i,1+3i,1+2i)),c(1+2i,1+3i,2+1i))`,
  ],
  [
    "returns sort indices relative to the filtered input",
    `identical(sort(c(z=4,m=NA,a=1,b=4),index.return=TRUE),list(x=c(a=1,z=4,b=4),ix=c(2L,1L,3L)))&&identical(sort(c(4,NA,1),na.last=TRUE,index.return=TRUE),list(x=c(1,4,NA),ix=c(3L,1L,2L)))`,
  ],
  [
    "preserves factor levels while dropping incidental sort attributes",
    `x<-structure(factor(c("b","a")),tag=7);identical(sort.default(x),factor(c("a","b")))`,
  ],
  [
    "validates generic decreasing before forcing x",
    `seen<-FALSE;message<-tryCatch(sort({seen<-TRUE;1},decreasing=1),error=conditionMessage);!seen&&identical(message,"'decreasing' must be a length-1 logical vector.\nDid you intend to set 'partial'?")`,
  ],
  [
    "applies format defaults to explicitly empty controls",
    `identical(format.default(1.234,digits=,trim=,width=),"1.234")&&identical(format.default(1.234,scientific=NA),"1.234")&&identical(format.default(1,width=NULL),"1")`,
  ],
  [
    "left justifies character input by default and accepts partial choices",
    `identical(format.default(c("a","bb")),c("a ","bb"))&&identical(format.default("x",justify="l",width=3),"x  ")&&identical(format.default(character()),character())`,
  ],
  [
    "does not force extra format arguments",
    `identical(format.default(1.234,other=stop("unused")),"1.234")`,
  ],
  [
    "formats grouping, trailing zeros and zero replacement",
    `identical(format.default(12345.6789,big.mark=",",small.mark="_"),"12,345.68")&&identical(format.default(c(1,1.2),drop0trailing=TRUE),c("1","1.2"))&&identical(format.default(c(0,1),zero.print="."),c(".","1"))`,
  ],
  [
    "retains sort.int signature and explicit empty defaults",
    'identical(formals(sort.int),formals(function(x,partial=NULL,na.last=NA,decreasing=FALSE,method=c("auto","shell","quick","radix"),index.return=FALSE)NULL))&&identical(sort.int(c(2,NA,1),decreasing=,na.last=,method=),c(1,2))',
  ],
  [
    "distinguishes unused argument forcing in sort.default and sort.int",
    'n<-0;unused<-function(){n<<-2;stop("unused")};a<-tryCatch(sort.default(c(2,1),other={n<-1;stop("forced")}),error=conditionMessage);b<-tryCatch(sort.int(c(2,1),other=unused()),error=conditionMessage);identical(a,"forced")&&identical(n,1)&&identical(b,\'unused argument (other = unused())\')',
  ],
  [
    "retains the delegated sort.int diagnostic call",
    "identical(tryCatch(sort(c(2,1),other=1),error=conditionCall),quote(sort.int(x,na.last=na.last,decreasing=decreasing,...)))",
  ],
  [
    "accepts partial method choices in sort.int",
    'identical(sort.int(c(3,1,2),method="r"),c(1,2,3))&&identical(sort.int(c(3,1,2),method="quick",index.return=TRUE),list(x=c(1,2,3),ix=c(2L,3L,1L)))',
  ],
  [
    "uses dispatched lengths for sequence shape inputs",
    'length.owned<-function(x)5L;assign("length.owned",length.owned,.GlobalEnv);on.exit(rm("length.owned",envir=.GlobalEnv));identical(seq.default(structure(c(3,4),class="owned")),1:5)&&identical(seq.default(along.with=structure(3,class="owned")),1:5)&&identical(seq.default(quote(f(a,b))),1:3)&&identical(seq.default(new.env()),integer())',
  ],
  [
    "keeps forwarded default promises for generic and default calls",
    "n<-0;f<-function(x={n<<-n+1;c(2,1)},decreasing=TRUE)sort(x,decreasing);value<-f();identical(value,c(2,1))&&identical(n,1)",
  ],
  [
    "forces format choices before the input and formatting controls",
    'seen<-character();mark<-function(name,value){seen<<-c(seen,name);value};value<-format.default(x=mark("x",1.2),trim=mark("trim",FALSE),justify=mark("justify","left"),digits=mark("digits",3));identical(value,"1.2")&&identical(seen,c("justify","x","trim","digits"))',
  ],
  [
    "does not force numeric decoration controls for character input",
    'identical(format.default(c("a","bb"),decimal.mark=stop("unused"),big.mark=stop("unused"),small.mark=stop("unused"),zero.print=stop("unused"),drop0trailing=stop("unused")),c("a ","bb"))',
  ],
  [
    "does not force inactive grouping intervals",
    'identical(format.default(1.2,big.interval=stop("unused"),small.interval=stop("unused")),"1.2")',
  ],
  [
    "does not force scalar formatting controls for raw and NULL",
    'identical(format.default(as.raw(1:2),trim=stop("unused"),digits=stop("unused")),c("01","02"))&&identical(format.default(NULL,trim=stop("unused")),"NULL")',
  ],
  [
    "pads zero replacements and preserves complex strings",
    'identical(format.default(c(0,1.2),zero.print="."),c(".  ","1.2"))&&identical(format.default(c(0,1.2),zero.print=FALSE),c("   ","1.2"))&&identical(format.default(c(0+0i,1+2i),zero.print="."),c("0+0i","1+2i"))',
  ],
  [
    "accepts default-equivalent format choices and NULL",
    'identical(format.default("x",justify=c("left","right","centre","none")),"x")&&identical(format.default("x",justify=NULL),"x")',
  ],
  [
    "distinguishes absent and empty dispatch objects",
    "format.NULL<-function(...)list(sys.call(),list(...));sort.NULL<-function(...)list(sys.call(),list(...));identical(format(),list(quote(format.NULL()),list()))&&identical(sort(),list(quote(sort.NULL()),list()))&&identical(tryCatch(format(x=),error=conditionCall),quote(format.default(x=)))&&identical(tryCatch(sort(x=),error=conditionCall),quote(sort.default(x=)))&&identical(tryCatch(format(x=),error=conditionMessage),'argument \"x\" is missing, with no default')",
  ],
  [
    "retains observable factor attribute order and extra-argument warning classes",
    'x<-factor(c("b","a"));names(x)<-c("first","second");identical(names(attributes(sort(x))),c("names","levels","class"))&&identical(class(tryCatch(seq.default(from=1,other=1),warning=function(w)w)),c("chkDotsWarning","simpleWarning","warning","condition"))',
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it.each(["seq.default(length.out=1000000000)", "format.default('x',width=1000000000)"])(
  "bounds allocation before materializing %s",
  async (code) => {
    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 1000 },
    });
    try {
      await expect(limited.eval(code)).rejects.toMatchObject({ code: "NRL4002" });
    } finally {
      await limited.dispose();
    }
  },
);
