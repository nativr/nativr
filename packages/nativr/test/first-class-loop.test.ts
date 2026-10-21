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

// Independently authored black-box fixtures; no GNU R implementation bodies are inputs/outputs.
const cases = [
  [
    "metadata",
    "loop and block callable metadata",
    `names<-c("break","next","while","for","repeat","{");all(vapply(names,function(n){p<-get(n,baseenv());typeof(p)=="special"&&is.primitive(p)&&is.null(args(p))&&is.null(formals(p))},logical(1)))`,
  ],
  [
    "transfer",
    "break alias owns an explicitly evaluated loop",
    `b<-get("break");n<-0L;evalq(for(i in 1:3){n<-n+1L;b()});identical(n,1L)`,
  ],
  [
    "transfer",
    "next alias skips an explicitly evaluated body",
    `n<-get("next");s<-0L;evalq(for(i in 1:3){if(i==2L)n();s<-s+i});identical(s,4L)`,
  ],
  [
    "transfer",
    "transfer arity precedes forcing",
    `b<-get("break");n<-get("next");identical(c(tryCatch(b(stop("unused")),error=conditionMessage),tryCatch(n(ignored=,stop("unused")),error=conditionMessage)),c("1 argument passed to 'break' which requires 0","2 arguments passed to 'next' which requires 0"))`,
  ],
  [
    "transfer",
    "missing loop owner errors",
    `b<-get("break");n<-get("next");identical(c(tryCatch(b(),error=conditionMessage),tryCatch(n(),error=conditionMessage)),rep("no loop for break/next, jumping to top level",2L))`,
  ],
  [
    "transfer",
    "ordinary closures cannot jump into caller loops",
    `b<-get("break");f<-function()b();message<-NULL;for(i in 1:2){message<-tryCatch(f(),error=conditionMessage)};identical(i,2L)&&identical(message,"no loop for break/next, jumping to top level")`,
  ],
  [
    "transfer",
    "forwarded transfer keeps promise origin",
    `b<-get("break");pass<-function(x)x;s<-0L;evalq(for(i in 1:3){s<-s+1L;pass(b())});identical(s,1L)`,
  ],
  [
    "transfer",
    "eval transfer finds the loop environment",
    `b<-get("break");s<-0L;for(i in 1:3){s<-s+1L;evalq(b())};identical(s,1L)`,
  ],
  [
    "transfer",
    "mapped special transfer retains literal dots",
    `b<-get("break");identical(tryCatch(for(i in 1:2)lapply(1L,b),error=conditionMessage),"2 arguments passed to 'break' which requires 0")`,
  ],
  [
    "while",
    "while alias reevaluates condition and body",
    `w<-get("while");i<-0L;s<-0L;w(i<3L,{i<-i+1L;s<-s+i});identical(c(i,s),c(3L,6L))`,
  ],
  [
    "while",
    "while names are positional",
    `w<-get("while");i<-0L;w(body=i<3L,cond=i<-i+1L);identical(i,3L)`,
  ],
  [
    "while",
    "while arity is exact and lazy",
    `w<-get("while");identical(c(tryCatch(w(),error=conditionMessage),tryCatch(w(FALSE),error=conditionMessage),tryCatch(w(stop("unused"),NULL,stop("extra")),error=conditionMessage)),c("0 arguments passed to 'while' which requires 2","1 argument passed to 'while' which requires 2","3 arguments passed to 'while' which requires 2"))`,
  ],
  [
    "while",
    "while missing body is selected lazily",
    `w<-get("while");identical(withVisible(w(FALSE,)),list(value=NULL,visible=FALSE))&&identical(tryCatch(w(TRUE,),error=conditionMessage),"argument is missing, with no default")`,
  ],
  [
    "while",
    "break in while condition terminates",
    `i<-0L;while({i<-i+1L;break})i<-99L;identical(i,1L)`,
  ],
  [
    "while",
    "next in while condition restarts",
    `w<-get("while");i<-0L;w({i<-i+1L;if(i<3L)next;i<4L},NULL);identical(i,4L)`,
  ],
  [
    "while",
    "while retains referenced formal memoization",
    `w<-get("while");e<-new.env();e$n<-0L;f<-function(body){i<-0L;w(i<3L,{i<-i+1L;body});i};v<-f(e$n<-e$n+1L);identical(c(v,e$n),c(3L,1L))`,
  ],
  [
    "while",
    "while dots remain literal",
    `w<-get("while");f<-function(...)w(...,NULL);identical(tryCatch(f(FALSE),error=conditionMessage),"'...' used in an incorrect context")`,
  ],
  [
    "while",
    "while uses scalar condition diagnostics",
    `w<-get("while");identical(c(tryCatch(w(NA,NULL),error=conditionMessage),tryCatch(w(1:2,NULL),error=conditionMessage)),c("missing value where TRUE/FALSE needed","the condition has length > 1"))`,
  ],
  [
    "repeat",
    "repeat alias reevaluates its body",
    `p<-get("repeat");i<-0L;p({i<-i+1L;if(i<3L)next;break});identical(i,3L)`,
  ],
  [
    "repeat",
    "repeat arity and missing body",
    `p<-get("repeat");identical(c(tryCatch(p(),error=conditionMessage),tryCatch(p(stop("unused"),NULL),error=conditionMessage),tryCatch(p(body=),error=conditionMessage)),c("0 arguments passed to 'repeat' which requires 1","2 arguments passed to 'repeat' which requires 1","argument is missing, with no default"))`,
  ],
  [
    "repeat",
    "nested loops use the nearest owner",
    `p<-get("repeat");b<-get("break");n<-0L;for(i in 1:3)p({n<-n+1L;b()});identical(n,3L)`,
  ],
  [
    "repeat",
    "loop cleanup and return remain ordered",
    `p<-get("repeat");e<-new.env();e$n<-0L;f<-function(){on.exit(e$n<-e$n+1L);p(return(7L))};v<-f();identical(c(v,e$n),c(7L,1L))`,
  ],
  [
    "for",
    "for alias evaluates sequence once",
    `p<-get("for");e<-new.env();e$n<-0L;s<-0L;p(i,{e$n<-e$n+1L;1:3},s<-s+i);identical(c(s,e$n,i),c(6L,1L,3L))`,
  ],
  [
    "for",
    "for tags are ignored",
    `p<-get("for");s<-0L;p(body=i,var=1:3,seq=s<-s+i);identical(s,6L)`,
  ],
  [
    "for",
    "for arity precedes evaluation",
    `p<-get("for");identical(c(tryCatch(p(),error=conditionMessage),tryCatch(p(i,stop("unused"),NULL,stop("extra")),error=conditionMessage)),c("0 arguments passed to 'for' which requires 3","4 arguments passed to 'for' which requires 3"))`,
  ],
  [
    "for",
    "for variable must be a literal symbol",
    `p<-get("for");identical(c(tryCatch(p(1L,stop("unused"),NULL),error=conditionMessage),tryCatch(p("i",stop("unused"),NULL),error=conditionMessage)),rep("non-symbol loop variable",2L))`,
  ],
  [
    "for",
    "for empty sequence resets its binding",
    `p<-get("for");i<-99L;p(i,NULL,stop("unused"));a<-i;for(j in integer())stop("unused");identical(list(a,j),list(NULL,NULL))`,
  ],
  [
    "for",
    "for invalid sequence resets its binding",
    `p<-get("for");i<-99L;m<-tryCatch(p(i,quote(f()),NULL),error=conditionMessage);is.null(i)&&identical(m,"invalid for() loop sequence")`,
  ],
  [
    "for",
    "for sequence transfers precede the inner loop",
    `i<-99L;s<-0L;for(j in 1:2){s<-s+1L;for(i in {break;1:2})NULL};identical(c(i,s),c(99L,1L))`,
  ],
  [
    "for",
    "for sequence side effects precede null initialization",
    `i<-99L;for(i in {i<-77L;integer()})NULL;is.null(i)`,
  ],
  [
    "for-values",
    "for iterates expression and pairlist values",
    `p<-get("for");x<-list();p(i,expression(a,1L),x[[length(x)+1L]]<-i);y<-list();p(i,pairlist(a=1L,b=2L),y[[length(y)+1L]]<-i);identical(x,list(quote(a),1L))&&identical(y,list(1L,2L))`,
  ],
  [
    "for-values",
    "for preserves list element identity and attributes",
    `p<-get("for");e<-new.env();v<-structure(7L,note="owned");x<-list();p(i,list(e,v),x[[length(x)+1L]]<-i);identical(x[[1L]],e)&&identical(x[[2L]],v)`,
  ],
  [
    "for-values",
    "for drops atomic element attributes",
    `x<-list();for(i in structure(1:2,names=c("a","b"),class="owned",note=7L))x[[length(x)+1L]]<-i;identical(x,list(1L,2L))`,
  ],
  [
    "for-values",
    "for factors yield labels and missing values",
    `p<-get("for");x<-list();p(i,ordered(c("b","a",NA)),x[[length(x)+1L]]<-i);identical(x,list("b","a",NA_character_))`,
  ],
  [
    "for-values",
    "for factor conversion does not dispatch",
    `as.character.factor<-function(x)rep("wrong",length(x));x<-list();for(i in factor(c("b","a")))x[[length(x)+1L]]<-i;identical(x,list("b","a"))`,
  ],
  [
    "for-values",
    "malformed factor fails before binding changes",
    `i<-99L;e<-0L;x<-structure(c(1L,4L),levels=c("a","b"),class="factor");m<-tryCatch(for(i in x)e<-e+1L,error=conditionMessage);identical(list(i,e,m),list(99L,0L,"malformed factor"))`,
  ],
  [
    "for-values",
    "factor iteration retains character encoding",
    `s<-rawToChar(as.raw(233));Encoding(s)<-"latin1";x<-structure(1L,levels=s,class="factor");for(i in x)NULL;identical(Encoding(i),"latin1")&&identical(charToRaw(i),as.raw(233))`,
  ],
  [
    "for-bindings",
    "for initialization invokes an active binding",
    `e<-new.env();e$v<-list();makeActiveBinding("i",function(x){if(!missing(x))e$v[[length(e$v)+1L]]<-list(x);invisible(NULL)},environment());for(i in 1:2)NULL;identical(e$v,list(list(NULL),list(1L),list(2L)))`,
  ],
  [
    "for-bindings",
    "empty iteration still invokes an active binding",
    `e<-new.env();e$v<-list();makeActiveBinding("i",function(x){if(!missing(x))e$v[[length(e$v)+1L]]<-list(x);invisible(NULL)},environment());for(i in integer())NULL;identical(e$v,list(list(NULL)))`,
  ],
  [
    "for-bindings",
    "locked loop binding fails after sequence effects",
    `i<-9L;lockBinding("i",environment());e<-0L;m<-tryCatch(for(i in {e<-1L;1:2})NULL,error=conditionMessage);identical(list(e,i,m),list(1L,9L,"cannot change value of locked binding for 'i'"))`,
  ],
  [
    "for-bindings",
    "missing and dots loop symbols are retained",
    `p<-get("for");p(,1:2,NULL);p(...,1:2,NULL);all(c("","...")%in%ls(all.names=TRUE))`,
  ],
  [
    "blocks",
    "empty block is visible null",
    `b<-get("{");identical(withVisible(b()),list(value=NULL,visible=TRUE))&&identical(withVisible({}),list(value=NULL,visible=TRUE))`,
  ],
  [
    "blocks",
    "block retains final visibility and identity",
    `b<-get("{");e<-new.env();e$n<-0L;r<-withVisible(b(e$n<-e$n+1L,invisible(e)));identical(r,list(value=e,visible=FALSE))&&identical(e$n,1L)`,
  ],
  [
    "blocks",
    "block missing argument retains its caller",
    `f<-function(){b<-get("{");b(1L,,3L)};identical(tryCatch(f(),error=function(e)c(conditionMessage(e),deparse1(conditionCall(e)))),c("argument is missing, with no default","f()"))`,
  ],
  [
    "blocks",
    "block dots are literal",
    `b<-get("{");f<-function(...)b(...);identical(tryCatch(f(1L,2L),error=conditionMessage),"'...' used in an incorrect context")`,
  ],
  [
    "constructed",
    "constructed loops preserve expressions",
    `s<-0L;do.call("for",list(quote(i),1:3,quote(s<-s+i)));w<-withVisible(do.call("while",list(FALSE,quote(stop("unused")))));p<-withVisible(do.call("repeat",list(quote(break))));identical(s,6L)&&identical(w,list(value=NULL,visible=FALSE))&&identical(p,w)`,
  ],
  [
    "constructed",
    "constructed block evaluates in requested environment",
    `e<-new.env();e$x<-0L;r<-do.call("{",list(quote(x<-1L),quote(x+6L)),envir=e);identical(c(r,e$x),c(7L,1L))`,
  ],
  [
    "shadowing",
    "syntax honors replaced transfer bindings",
    "`break`<-function()NULL;`next`<-function()NULL;s<-0L;for(i in 1:3){break;next;s<-s+i};identical(s,6L)",
  ],
  [
    "shadowing",
    "syntax honors replaced loop and block bindings",
    '`for`<-function(...)7L;`while`<-function(...)8L;`repeat`<-function(...)9L;v<-c(for(i in stop("unused"))NULL,while(stop("unused"))NULL,repeat stop("unused"));`{`<-function(...)42L;identical(v,c(7L,8L,9L))&&identical({1L;2L},42L)',
  ],
  [
    "shadowing",
    "evaluated syntax observes active control lookup once",
    `e<-new.env();e$n<-0L;makeActiveBinding("while",function(){e$n<-e$n+1L;get("while",baseenv())},environment());i<-0L;evalq(while(i<3L)i<-i+1L);identical(c(i,e$n),c(3L,1L))`,
  ],
  [
    "shadowing",
    "noncallable masks and lazy defaults retain lookup",
    'f<-function(`while`=get("while",baseenv())){`for`<-1L;`{`<-2L;s<-0L;for(i in 1:3){s<-s+i};while(s<7L)s<-s+1L;s};identical(f(),7L)',
  ],
] as const;

it.each(cases)("%s: %s", async (_group, _name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("enforces finite limits for callable loops and recovers", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1200, maxCallDepth: 8 },
  });
  try {
    for (const code of ['get("while")(TRUE,NULL)', 'do.call("repeat",list(NULL))', "repeat {}"]) {
      await expect(limited.eval(code)).rejects.toMatchObject({ code: "NRL4001" });
      expect(await limited.eval('i<-0L;get("while")(i<2L,i<-i+1L);i')).toBe(2);
      expect(await limited.eval("sys.nframe()")).toBe(0);
    }
    await expect(
      limited.eval('f<-function(){on.exit(get("break")());for(i in 1:2)f()};f()'),
    ).rejects.toMatchObject({ code: "NRL4004" });
    expect(await limited.eval('get("{")(7L)')).toBe(7);
  } finally {
    await limited.dispose();
  }
});
