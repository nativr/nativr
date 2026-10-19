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

// Independently authored GNU R 4.6.1 fixtures; no implementation bodies are read.
const cases = [
  [
    "retains builtin default method calls in partial warnings",
    `identical(tryCatch(mean(1:3,tr=0),warning=conditionCall),quote(mean.default(1:3,tr=0)))`,
  ],
  [
    "retains class method calls in partial warnings",
    `identical(tryCatch(print(factor("a"),max.l=TRUE),warning=conditionCall),quote(print.factor(factor("a"),max.l=TRUE)))`,
  ],
  [
    "exposes argument and formal symbols to a partialMatchWarning handler",
    `f<-function(alpha)alpha;value<-tryCatch(f(al=1),partialMatchWarning=function(w)list(names(w),w$argument,w$formal,conditionCall(w)));identical(value,list(c("message","call","argument","formal"),quote(al),quote(alpha),quote(f(al=1))))`,
  ],
  [
    "reports partial matches in formal order with the originating call",
    `seen<-list();f<-function(alpha,beta)c(alpha,beta);value<-withCallingHandlers(f(be=2,al=1),warning=function(w){seen[[length(seen)+1]]<<-list(conditionMessage(w),conditionCall(w),class(w));invokeRestart("muffleWarning")});identical(value,c(1,2))&&identical(seen,list(list("partial argument match of 'al' to 'alpha'",quote(f(be=2,al=1)),c("partialMatchWarning","warning","condition")),list("partial argument match of 'be' to 'beta'",quote(f(be=2,al=1)),c("partialMatchWarning","warning","condition"))))`,
  ],
  [
    "reserves exact matches without warning for an unused partial name",
    `seen<-character();f<-function(alpha)alpha;message<-withCallingHandlers(tryCatch(f(alpha=1,al=2),error=conditionMessage),warning=function(w){seen<<-c(seen,conditionMessage(w));invokeRestart("muffleWarning")});identical(seen,character())&&identical(message,"unused argument (al = 2)")`,
  ],
  [
    "warns before a partial duplicate error",
    `seen<-character();f<-function(alpha)NULL;message<-withCallingHandlers(tryCatch(f(al=1,a=2),error=conditionMessage),warning=function(w){seen<<-c(seen,conditionMessage(w));invokeRestart("muffleWarning")});identical(seen,"partial argument match of 'al' to 'alpha'")&&identical(message,'formal argument "alpha" matched by multiple actual arguments')`,
  ],
  [
    "warns before a partial ambiguity error",
    `seen<-character();f<-function(alpha,alpine,beta)NULL;message<-withCallingHandlers(tryCatch(f(be=1,b=2,al=3),error=conditionMessage),warning=function(w){seen<<-c(seen,conditionMessage(w));invokeRestart("muffleWarning")});identical(seen,"partial argument match of 'al' to 'alpha'")&&identical(message,"argument 3 matches multiple formal arguments")`,
  ],
  [
    "checks exact duplicates before partial warnings",
    `seen<-character();f<-function(alpha,beta)NULL;message<-withCallingHandlers(tryCatch(f(al=1,beta=2,beta=3),error=conditionMessage),warning=function(w){seen<<-c(seen,conditionMessage(w));invokeRestart("muffleWarning")});identical(seen,character())&&identical(message,'formal argument "beta" matched by multiple actual arguments')`,
  ],
  [
    "lets a calling handler disable later partial warnings",
    `seen<-character();f<-function(alpha,beta)c(alpha,beta);value<-withCallingHandlers(f(al=1,be=2),warning=function(w){seen<<-c(seen,conditionMessage(w));options(warnPartialMatchArgs=FALSE);invokeRestart("muffleWarning")});identical(value,c(1,2))&&identical(seen,"partial argument match of 'al' to 'alpha'")`,
  ],
  [
    "runs handlers before argument forcing or the function body",
    `seen<-character();f<-function(alpha){seen<<-c(seen,"body");alpha};value<-withCallingHandlers(f(al={seen<-c(seen,"force");7}),warning=function(w){seen<<-c(seen,"warning");invokeRestart("muffleWarning")});identical(value,7)&&identical(seen,c("warning","body","force"))`,
  ],
  [
    "promotes warnings before closure side effects",
    `options(warn=2);n<-0;f<-function(alpha){n<<-1;alpha};value<-tryCatch(f(al={n<<-2;3}),error=function(e)list(conditionMessage(e),conditionCall(e)));identical(n,0)&&identical(value,list("(converted from warning) partial argument match of 'al' to 'alpha'",quote(f(al={n<<-2;3}))))`,
  ],
  [
    "promotes warnings before builtin argument forcing",
    `options(warn=2);n<-0;value<-tryCatch(person(giv={n<-1;"Ada"}),error=function(e)list(conditionMessage(e),conditionCall(e)));identical(n,0)&&identical(value,list("(converted from warning) partial argument match of 'giv' to 'given'",quote(person(giv={n<-1;"Ada"}))))`,
  ],
  [
    "lets muffling precede warn two promotion",
    `options(warn=2);seen<-character();f<-function(alpha,beta)c(alpha,beta);value<-withCallingHandlers(f(al=1,be=2),warning=function(w){seen<<-c(seen,conditionMessage(w));invokeRestart("muffleWarning")});identical(value,c(1,2))&&length(seen)==2L`,
  ],
  [
    "delivers calling handlers even when warn suppresses output",
    `options(warn=-1);seen<-character();f<-function(alpha)alpha;value<-withCallingHandlers(f(al=1),warning=function(w)seen<<-c(seen,conditionMessage(w)));identical(value,1)&&identical(seen,"partial argument match of 'al' to 'alpha'")`,
  ],
  [
    "lets an exiting warning handler stop matching before the body",
    `n<-0;f<-function(alpha,beta){n<<-1;alpha+beta};value<-tryCatch(f(al=1,be=2),warning=conditionMessage);identical(n,0)&&identical(value,"partial argument match of 'al' to 'alpha'")`,
  ],
  [
    "excludes partial names after dots",
    `seen<-character();f<-function(alpha,...,beta)list(alpha,...,beta=beta);value<-withCallingHandlers(f(al=1,be=2,beta=3),warning=function(w){seen<<-c(seen,conditionMessage(w));invokeRestart("muffleWarning")});identical(value,list(1,be=2,beta=3))&&identical(seen,"partial argument match of 'al' to 'alpha'")`,
  ],
  [
    "reports builtin partial matches with its original call",
    `seen<-list();withCallingHandlers(person(fam="Example",giv="Ada"),warning=function(w){seen[[length(seen)+1]]<<-list(conditionMessage(w),conditionCall(w));invokeRestart("muffleWarning")});identical(seen,list(list("partial argument match of 'giv' to 'given'",quote(person(fam="Example",giv="Ada"))),list("partial argument match of 'fam' to 'family'",quote(person(fam="Example",giv="Ada")))))`,
  ],
  [
    "matches the primitive rep controls with warnings",
    `seen<-list();value<-withCallingHandlers(rep(1,t=2),warning=function(w){seen[[length(seen)+1]]<<-list(conditionMessage(w),conditionCall(w));invokeRestart("muffleWarning")});identical(value,c(1,1))&&identical(seen,list(list("partial argument match of 't' to 'times'",quote(rep(1,t=2)))))`,
  ],
  [
    "does not partially match sapply formals after dots",
    `seen<-character();value<-withCallingHandlers(tryCatch(sapply(list(1,2),identity,sim=FALSE),error=conditionMessage),warning=function(w){seen<<-c(seen,conditionMessage(w));invokeRestart("muffleWarning")});identical(seen,character())&&identical(value,"unused argument (sim = FALSE)")`,
  ],
  [
    "rematches an implicit match.call and warns again",
    `seen<-list();f<-function(alpha,beta)match.call();value<-withCallingHandlers(f(al=1,be=2),warning=function(w){seen[[length(seen)+1]]<<-conditionCall(w);invokeRestart("muffleWarning")});identical(value,quote(f(alpha=1,beta=2)))&&identical(seen,list(quote(f(al=1,be=2)),quote(f(al=1,be=2)),quote(match.call(definition,call,expand.dots,envir)),quote(match.call(definition,call,expand.dots,envir))))`,
  ],
  [
    "distinguishes match.call argument matching from definition matching",
    `seen<-list();f<-function(alpha,beta)NULL;value<-withCallingHandlers(match.call(def=f,call=quote(f(al=1,beta=2))),warning=function(w){seen[[length(seen)+1]]<<-list(conditionMessage(w),conditionCall(w));invokeRestart("muffleWarning")});identical(value,quote(f(alpha=1,beta=2)))&&identical(seen,list(list("partial argument match of 'def' to 'definition'",quote(match.call(def=f,call=quote(f(al=1,beta=2))))),list("partial argument match of 'al' to 'alpha'",quote(match.call(definition,call,expand.dots,envir)))))`,
  ],
  [
    "retains the inner match.call warning call for an alias",
    `seen<-list();f<-function(alpha)NULL;h<-match.call;value<-withCallingHandlers(h(f,quote(f(al=1))),warning=function(w){seen[[length(seen)+1]]<<-conditionCall(w);invokeRestart("muffleWarning")});identical(value,quote(f(alpha=1)))&&identical(seen,list(quote(match.call(definition,call,expand.dots,envir))))`,
  ],
  [
    "retains the inner match.call warning call for a namespace lookup",
    `seen<-list();f<-function(alpha)NULL;value<-withCallingHandlers(base::match.call(f,quote(f(al=1))),warning=function(w){seen[[length(seen)+1]]<<-conditionCall(w);invokeRestart("muffleWarning")});identical(value,quote(f(alpha=1)))&&identical(seen,list(quote(match.call(definition,call,expand.dots,envir))))`,
  ],
  [
    "promotes match.call warnings before returning a matched call",
    `options(warn=2);f<-function(alpha)NULL;value<-tryCatch(match.call(f,quote(f(al=1))),error=function(e)list(conditionMessage(e),conditionCall(e)));identical(value,list("(converted from warning) partial argument match of 'al' to 'alpha'",quote(match.call(definition,call,expand.dots,envir))))`,
  ],
  [
    "rejects invalid option values without changing the previous value",
    `valid<-TRUE;for(value in list(1,0,NA,NA_real_,logical(),c(TRUE,FALSE),"TRUE",list(TRUE))){message<-tryCatch({options(warnPartialMatchArgs=value);"accepted"},error=conditionMessage);valid<-valid&&identical(message,"invalid value for 'warnPartialMatchArgs'")&&identical(getOption("warnPartialMatchArgs"),TRUE)};valid`,
  ],
  [
    "rejects deletion of the partial warning option",
    `message<-tryCatch({options(warnPartialMatchArgs=NULL);"accepted"},error=conditionMessage);identical(message,"option 'warnPartialMatchArgs' cannot be deleted")&&identical(getOption("warnPartialMatchArgs"),TRUE)`,
  ],
  [
    "returns and restores the previous logical option",
    `previous<-options(warnPartialMatchArgs=FALSE);identical(previous,list(warnPartialMatchArgs=TRUE))&&identical(getOption("warnPartialMatchArgs"),FALSE)&&identical(options(previous),list(warnPartialMatchArgs=FALSE))&&identical(getOption("warnPartialMatchArgs"),TRUE)`,
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(
    `(function(){old<-options(warnPartialMatchArgs=TRUE,warn=0);on.exit(options(old));${code}})()`,
  );
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("defaults to silent partial matching", async () => {
  const result = await runtime.evalDetailed(
    "identical(getOption('warnPartialMatchArgs'),FALSE)&&identical((function(alpha)alpha)(al=1),1)",
  );
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("records each unhandled warning once with transport-safe call metadata", async () => {
  const result = await runtime.evalDetailed(
    "(function(){old<-options(warnPartialMatchArgs=TRUE);on.exit(options(old));f<-function(alpha,beta)alpha+beta;f(al=1,be=2)})()",
  );
  expect(result.value).toBe(3);
  expect(result.warnings).toEqual([
    {
      code: "NRW1200",
      message: "partial argument match of 'al' to 'alpha'",
      call: "f(al = 1, be = 2)",
    },
    {
      code: "NRW1200",
      message: "partial argument match of 'be' to 'beta'",
      call: "f(al = 1, be = 2)",
    },
  ]);
});

it("writes warn one output before function body output", async () => {
  const result = await runtime.evalDetailed(
    `(function(){old<-options(warnPartialMatchArgs=TRUE,warn=1);on.exit(options(old));f<-function(alpha){cat("body\\n");alpha};f(al=1)})()`,
  );
  expect(result.value).toBe(1);
  expect(result.warnings).toEqual([]);
  expect(result.output).toEqual([
    {
      stream: "message",
      text: "Warning in f(al = 1) : partial argument match of 'al' to 'alpha'\n",
    },
    { stream: "stdout", text: "body\n" },
  ]);
});
