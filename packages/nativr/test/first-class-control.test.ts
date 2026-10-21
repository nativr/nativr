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

// Independent black-box fixtures. GNU R implementation bodies are never inputs or outputs.
const cases = [
  [
    "control callable metadata",
    `r<-get("return");p<-get("if");identical(c(typeof(r),typeof(p)),c("special","special"))&&is.primitive(r)&&is.primitive(p)&&is.null(formals(r))&&is.null(args(r))&&is.null(formals(p))&&is.null(args(p))`,
  ],
  [
    "return aliases leave their owner",
    `r<-get("return");f<-function(){r(7L);9L};identical(f(),7L)`,
  ],
  [
    "return constructed calls leave their owner",
    `f<-function(){do.call("return",list(7L));9L};identical(f(),7L)`,
  ],
  [
    "return ignores its argument tag",
    `r<-get("return");f<-function(){r(unknown=7L);9L};identical(f(),7L)`,
  ],
  [
    "empty return is visible null",
    `r<-get("return");f<-function(){r();9L};identical(withVisible(f()),list(value=NULL,visible=TRUE))`,
  ],
  [
    "return preserves invisible values",
    `r<-get("return");f<-function(){r(invisible(7L));9L};identical(withVisible(f()),list(value=7L,visible=FALSE))`,
  ],
  [
    "surplus return arguments are not forced",
    `r<-get("return");e<-new.env();e$x<-0L;f<-function()r({e$x<-1L;1L},{e$x<-2L;2L});m<-tryCatch(f(),error=conditionMessage);identical(e$x,0L)&&identical(m,"multi-argument returns are not permitted")`,
  ],
  [
    "syntax preserves surplus return arguments",
    `e<-new.env();e$x<-0L;f<-function()return({e$x<-1L;1L},2L);m<-tryCatch(f(),error=conditionMessage);identical(e$x,0L)&&identical(m,"multi-argument returns are not permitted")`,
  ],
  [
    "missing return values retain their diagnostics",
    `r<-get("return");f<-function()r(x=);g<-function(x)r(x);identical(c(tryCatch(f(),error=conditionMessage),tryCatch(g(),error=conditionMessage)),c("argument is missing, with no default",'argument "x" is missing, with no default'))`,
  ],
  [
    "named missing syntax retains the caller",
    `f<-function()return(x=);identical(tryCatch(f(),error=function(e)c(conditionMessage(e),deparse1(conditionCall(e)))),c("argument is missing, with no default","f()"))`,
  ],
  [
    "forwarded return promises retain their owner",
    `r<-get("return");pass<-function(x)x;f<-function(){pass(r(7L));9L};identical(f(),7L)`,
  ],
  [
    "return inside eval ends only that evaluation",
    `r<-get("return");f<-function(){a<-evalq(r(7L));c(a,9L)};identical(f(),c(7L,9L))`,
  ],
  [
    "return preserves owner cleanup",
    `r<-get("return");e<-new.env();e$n<-0L;f<-function(){on.exit(e$n<-e$n+1L);r(7L)};value<-f();identical(c(value,e$n),c(7L,1L))`,
  ],
  [
    "cleanup can replace a return value",
    `r<-get("return");f<-function(){on.exit(r(9L));r(7L)};identical(f(),9L)`,
  ],
  [
    "return preserves identity and attributes",
    `r<-get("return");e<-new.env();f<-function(x)r(x);v<-structure(7L,marker="owned");identical(f(e),e)&&identical(f(v),v)&&identical(f(f),f)`,
  ],
  [
    "literal return ellipsis is not expanded",
    `r<-get("return");f<-function(...)r(...);identical(tryCatch(f(7L),error=conditionMessage),"'...' used in an incorrect context")`,
  ],
  [
    "if selects one branch",
    `p<-get("if");identical(c(p(TRUE,7L,stop("unused")),p(FALSE,stop("unused"),9L)),c(7L,9L))`,
  ],
  [
    "if constructed calls retain language laziness",
    `identical(do.call("if",list(FALSE,quote(stop("unused")),9L)),9L)`,
  ],
  [
    "if ignores tags and surplus arguments",
    `p<-get("if");identical(c(p(no=TRUE,condition=7L,yes=stop("unused")),p(FALSE,7L,9L,stop("extra"))),c(7L,9L))`,
  ],
  [
    "if retains branch visibility",
    `p<-get("if");identical(withVisible(p(TRUE,invisible(7L),9L)),list(value=7L,visible=FALSE))&&identical(withVisible(p(FALSE,7L)),list(value=NULL,visible=FALSE))`,
  ],
  [
    "if without a consequence distinguishes visibility",
    `p<-get("if");identical(withVisible(p(TRUE)),list(value=NULL,visible=TRUE))&&identical(withVisible(p(FALSE)),list(value=NULL,visible=FALSE))`,
  ],
  [
    "if absent condition has zero length",
    `p<-get("if");identical(tryCatch(p(),error=conditionMessage),"argument is of length zero")`,
  ],
  [
    "if missing selected arguments fail",
    `p<-get("if");identical(c(tryCatch(p(TRUE,,3L),error=conditionMessage),tryCatch(p(FALSE,3L,),error=conditionMessage)),rep("argument is missing, with no default",2L))`,
  ],
  [
    "if conditions and branches run once",
    `p<-get("if");e<-new.env();e$n<-0L;v<-p({e$n<-e$n+1L;TRUE},{e$n<-e$n+1L;e},stop("unused"));identical(v,e)&&identical(e$n,2L)`,
  ],
  [
    "if aliases retain the error call",
    `p<-get("if");identical(tryCatch(p(NA,1L,2L),error=function(e)deparse1(conditionCall(e))),"p(NA, 1L, 2L)")`,
  ],
  [
    "logical missing has its specific diagnostic",
    `p<-get("if");identical(tryCatch(p(NA,1L,2L),error=conditionMessage),"missing value where TRUE/FALSE needed")`,
  ],
  [
    "nonlogical missing conditions are not interpretable",
    `p<-get("if");values<-list(NA_integer_,NA_real_,NaN,NA_character_,NA_complex_,complex(real=NaN,imaginary=1));messages<-vapply(values,function(x)tryCatch(p(x,1L,2L),error=conditionMessage),character(1));identical(unname(messages),rep("argument is not interpretable as logical",6L))`,
  ],
  [
    "empty conditions fail before coercion",
    `p<-get("if");values<-list(NULL,logical(),list(),expression(),new.env());messages<-vapply(values,function(x)tryCatch(p(x,1L,2L),error=conditionMessage),character(1));identical(unname(messages),rep("argument is of length zero",5L))`,
  ],
  [
    "long conditions fail before coercion",
    `p<-get("if");e<-new.env();e$a<-1L;e$b<-2L;values<-list(c(NA,TRUE),c("unknown","TRUE"),list(1,2),pairlist(1,2),expression(1,2),quote(f(1)),~x,e);messages<-vapply(values,function(x)tryCatch(p(x,1L,2L),error=conditionMessage),character(1));identical(unname(messages),rep("the condition has length > 1",8L))`,
  ],
  [
    "character conditions accept documented spellings",
    `p<-get("if");values<-c("T","TRUE","True","true","F","FALSE","False","false");observed<-vapply(values,function(x)p(x,1L,2L),integer(1));identical(unname(observed),c(rep(1L,4L),rep(2L,4L)))`,
  ],
  [
    "character conditions reject extra normalization",
    `p<-get("if");values<-c("t","f","tRuE"," TRUE ","unknown");messages<-vapply(values,function(x)tryCatch(p(x,1L,2L),error=conditionMessage),character(1));identical(unname(messages),rep("argument is not interpretable as logical",5L))`,
  ],
  [
    "raw complex and numeric conditions coerce without dispatch",
    `p<-get("if");as.logical.owned<-function(x)stop("not dispatched");identical(c(p(as.raw(1),1L,2L),p(0+1i,1L,2L),p(Inf,1L,2L),p(structure(0L,class="owned"),1L,2L)),c(1L,1L,1L,2L))`,
  ],
  [
    "non-atomic scalar conditions reject interpretation",
    `p<-get("if");e<-new.env();e$a<-TRUE;values<-list(list(TRUE),pairlist(TRUE),expression(TRUE),quote(x),function()TRUE,e);messages<-vapply(values,function(x)tryCatch(p(x,1L,2L),error=conditionMessage),character(1));identical(unname(messages),rep("argument is not interpretable as logical",6L))`,
  ],
  [
    "direct syntax shares character and missing coercion",
    `observed<-c(if("True")1L else 2L,if("false")1L else 2L);identical(observed,c(1L,2L))&&identical(tryCatch(if(NA_real_)1L,error=conditionMessage),"argument is not interpretable as logical")`,
  ],
  [
    "while shares conditional coercion",
    `n<-0L;while("true"){n<-n+1L;break};identical(n,1L)&&identical(tryCatch(while(NA)break,error=conditionMessage),"missing value where TRUE/FALSE needed")`,
  ],
  [
    "syntax honors replaced return bindings",
    "`return`<-function(x)x+1L;f<-function(){return(7L);9L};identical(f(),9L)",
  ],
  [
    "syntax honors replaced if bindings",
    "`if`<-function(cond,yes,no)42L;identical(if(TRUE)7L else 9L,42L)",
  ],
  [
    "named return syntax retains replacement argument matching",
    "`return`<-function(value,other)other;f<-function(){return(other=7L,value=9L)};identical(f(),7L)",
  ],
  [
    "if ellipsis stays literal",
    `p<-get("if");f<-function(...)p(...,7L,9L);g<-function(...)p(TRUE,...,9L);identical(c(tryCatch(f(TRUE),error=conditionMessage),tryCatch(g(7L),error=conditionMessage)),rep("'...' used in an incorrect context",2L))`,
  ],
  [
    "mapping preserves special-call ellipsis",
    `r<-get("return");p<-get("if");identical(c(tryCatch(lapply(1:2,r),error=conditionMessage),tryCatch(sapply(1:2,r),error=conditionMessage),tryCatch(vapply(1:2,r,integer(1)),error=conditionMessage)),rep("multi-argument returns are not permitted",3L))&&identical(tryCatch(lapply(TRUE,p,7L,9L),error=conditionMessage),"'...' used in an incorrect context")`,
  ],
  [
    "mapping skips an unselected literal ellipsis",
    `p<-get("if");identical(lapply(c(FALSE,FALSE),p),list(NULL,NULL))`,
  ],
  [
    "control syntax forces active bindings once per lookup",
    `e<-new.env();e$n<-0L;makeActiveBinding("if",function(){e$n<-e$n+1L;get("if",baseenv())},environment());v<-if(TRUE)7L else stop("unused");identical(c(v,e$n),c(7L,1L))`,
  ],
  [
    "return syntax retains active lookup effects",
    `e<-new.env();e$n<-0L;makeActiveBinding("return",function(){e$n<-e$n+1L;get("return",baseenv())},environment());f<-function(){return(7L);9L};v<-f();identical(c(v,e$n),c(7L,1L))`,
  ],
  [
    "syntax skips noncallable masks and forces callable defaults",
    'f<-function(`if`=get("if",baseenv()),`return`=get("return",baseenv())){if(TRUE)return(7L);9L};g<-function(){`if`<-1L;`return`<-2L;if(TRUE)return(8L);9L};identical(c(f(),g()),c(7L,8L))',
  ],
  [
    "special extraction expands dots in callbacks and direct calls",
    `f<-function(...)\`[[\`(list(a=7L),...);g<-function(...)\`[\`(c(a=7L,b=9L),...);identical(unlist(lapply(list(list(a=1L),list(a=2L)),\`[[\`,"a")),1:2)&&identical(f("a"),7L)&&identical(g("a"),c(a=7L))`,
  ],
  [
    "dollar retains a literal ellipsis name",
    `f<-function(...)\`$\`(list(a=7L),...);g<-function(...)\`$\`(list("..."=7L),...);identical(lapply(list(list(a=1L)),\`$\`,"a"),list(NULL))&&is.null(f("a"))&&identical(g("ignored"),7L)`,
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("evaluates a return value before reporting no global owner", async () => {
  // Verified in an independent native top-level script; an oracle eval wrapper is a return owner.
  expect(
    await runtime.eval(
      `r<-get("return");owned_events<-0L;message<-tryCatch(r({owned_events<-1L;7L}),error=conditionMessage);identical(owned_events,1L)&&identical(message,"no function to return from, jumping to top level")`,
    ),
  ).toBe(true);
  expect(
    await runtime.eval(
      `owned_events<-0L;message<-tryCatch(return({owned_events<-1L;7L}),error=conditionMessage);identical(owned_events,1L)&&identical(message,"no function to return from, jumping to top level")`,
    ),
  ).toBe(true);
  expect(
    await runtime.eval(
      `identical(tryCatch(r(stop("owned value error")),error=conditionMessage),"owned value error")`,
    ),
  ).toBe(true);
});

it("retains limits and recovers after callable control exhaustion", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1200, maxCallDepth: 8 },
  });
  try {
    await expect(
      limited.eval('p<-get("if");repeat{p(TRUE,1L,stop("unused"))}'),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await limited.eval('p(FALSE,stop("unused"),7L)')).toBe(7);
    await expect(
      limited.eval('r<-get("return");f<-function(){on.exit(r(99L));f()};f()'),
    ).rejects.toMatchObject({ code: "NRL4004" });
    expect(await limited.eval("f<-function(){r(7L);9L};f()")).toBe(7);
    expect(await limited.eval("sys.nframe()")).toBe(0);
  } finally {
    await limited.dispose();
  }
});
