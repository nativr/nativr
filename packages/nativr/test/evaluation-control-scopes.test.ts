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

// Independent owned fixtures; GNU R is used only for their black-box observations.
const cases = [
  ["eval contains return", `f<-function(){eval(quote(return(7L)));9L};identical(f(),9L)`],
  ["evalq contains return", `f<-function(){evalq(return(7L));9L};identical(f(),9L)`],
  ["local contains return", `f<-function(){local(return(7L));9L};identical(f(),9L)`],
  ["with contains return", `f<-function(){with(list(),return(7L));9L};identical(f(),9L)`],
  [
    "expression vector stops at return",
    `f<-function(){result<-eval(expression(return(7L),stop("unreachable")));c(result,9L)};identical(f(),c(7L,9L))`,
  ],
  [
    "nested evaluation return stays in the inner scope",
    `identical(evalq({inside<-evalq(return(7L));c(inside,9L)}),c(7L,9L))`,
  ],
  [
    "owned closure return stays in its function",
    `identical(evalq({f<-function()return(7L);c(f(),9L)}),c(7L,9L))`,
  ],
  [
    "forwarded return reaches its owner",
    `g<-function(x)x;f<-function(){g(return(7L));9L};identical(f(),7L)`,
  ],
  [
    "forwarded return crosses a distinct eval scope",
    `g<-function(x)evalq(x);f<-function(){g(return(7L));9L};identical(f(),7L)`,
  ],
  [
    "default return uses a reused evaluation environment",
    `f<-function(x=return(7L)){evalq(x,environment());9L};identical(f(),9L)`,
  ],
  [
    "default return retains a distinct owning environment",
    `f<-function(x=return(7L)){evalq(x,new.env());9L};identical(f(),7L)`,
  ],
  [
    "eval return preserves invisibility",
    `identical(withVisible(evalq(return(invisible(7L)))),list(value=7L,visible=FALSE))`,
  ],
  [
    "empty return is visible in eval and owned functions",
    `identical(withVisible(evalq(return())),list(value=NULL,visible=TRUE))&&identical(withVisible((function()return())()),list(value=NULL,visible=TRUE))`,
  ],
  [
    "evaluation and owner exit handlers are separate",
    `e<-new.env();e$events<-character();f<-function(){on.exit(e$events<-c(e$events,"owner"));evalq(on.exit(e$events<-c(e$events,"eval")));e$events<-c(e$events,"after");invisible(NULL)};f();identical(e$events,c("eval","after","owner"))`,
  ],
  [
    "nested eval cleanup ordering",
    `e<-new.env();e$events<-character();evalq({on.exit(e$events<-c(e$events,"outer"));evalq({on.exit(e$events<-c(e$events,"inner"));7L});e$events<-c(e$events,"after")});identical(e$events,c("inner","after","outer"))`,
  ],
  [
    "forwarded on.exit registers with the expression owner",
    `e<-new.env();e$events<-character();g<-function(x){x;e$events<-c(e$events,"g.after")};f<-function(){g(on.exit(e$events<-c(e$events,"f.exit")));e$events<-c(e$events,"f.after")};f();identical(e$events,c("g.after","f.after","f.exit"))`,
  ],
  [
    "on.exit insertion replacement and clearing",
    `e<-new.env();e$events<-integer();evalq({on.exit(e$events<-c(e$events,9L));on.exit(NULL);on.exit(e$events<-c(e$events,2L));on.exit(e$events<-c(e$events,3L),add=TRUE);on.exit(e$events<-c(e$events,1L),add=TRUE,after=FALSE)});identical(e$events,1:3)`,
  ],
  [
    "exit expression leaves value and visibility intact",
    `identical(withVisible(evalq({on.exit(invisible(9L));7L})),list(value=7L,visible=TRUE))`,
  ],
  ["exit return replaces the evaluation result", `identical(evalq({on.exit(return(9L));7L}),9L)`],
  [
    "exit return preserves its visibility",
    `identical(withVisible(evalq({on.exit(return(invisible(9L)));7L})),list(value=9L,visible=FALSE))`,
  ],
  [
    "exit return overrides an ordinary body error",
    `identical(tryCatch(evalq({on.exit(return(9L));stop("body")}),error=conditionMessage),9L)`,
  ],
  [
    "all exit handlers run after an error",
    `e<-new.env();e$events<-character();message<-tryCatch(evalq({on.exit({e$events<-c(e$events,"one");stop("exit")});on.exit(e$events<-c(e$events,"two"),add=TRUE);stop("body")}),error=conditionMessage);identical(message,"exit")&&identical(e$events,c("one","two"))`,
  ],
  [
    "last exit error wins",
    `identical(tryCatch(evalq({on.exit(stop("one"));on.exit(stop("two"),add=TRUE);7L}),error=conditionMessage),"two")`,
  ],
  [
    "later exit return overrides an ordinary exit error",
    `identical(tryCatch(evalq({on.exit(stop("one"));on.exit(return(9L),add=TRUE);7L}),error=conditionMessage),9L)`,
  ],
  [
    "later exit error overrides an exit return",
    `identical(tryCatch(evalq({on.exit(return(9L));on.exit(stop("two"),add=TRUE);7L}),error=conditionMessage),"two")`,
  ],
  [
    "new handlers registered during cleanup are deferred",
    `e<-new.env();e$events<-character();evalq({on.exit({e$events<-c(e$events,"one");on.exit(e$events<-c(e$events,"new"),add=TRUE)});on.exit(e$events<-c(e$events,"two"),add=TRUE);7L});identical(e$events,c("one","two"))`,
  ],
  [
    "clearing during cleanup preserves the captured handlers",
    `e<-new.env();e$events<-character();evalq({on.exit({e$events<-c(e$events,"one");on.exit(NULL)});on.exit(e$events<-c(e$events,"two"),add=TRUE);7L});identical(e$events,c("one","two"))`,
  ],
  [
    "owned closure cleanup uses the same error ordering",
    `e<-new.env();e$events<-character();f<-function(){on.exit({e$events<-c(e$events,"one");stop("exit")});on.exit(e$events<-c(e$events,"two"),add=TRUE);stop("body")};message<-tryCatch(f(),error=conditionMessage);identical(message,"exit")&&identical(e$events,c("one","two"))`,
  ],
  [
    "owned closure exit return replaces its result",
    `f<-function(){on.exit(return(9L));7L};identical(f(),9L)`,
  ],
  [
    "break reaches the same environment loop through eval",
    `n<-0L;for(i in 1:3){evalq(break);n<-n+1L};identical(n,0L)`,
  ],
  [
    "next reaches the same environment loop through eval",
    `n<-0L;for(i in 1:3){evalq(next);n<-n+1L};identical(n,0L)&&identical(i,3L)`,
  ],
  [
    "forwarded break reaches its loop",
    `g<-function(x)force(x);n<-0L;for(i in 1:3){g(break);n<-n+1L};identical(n,0L)`,
  ],
  [
    "forwarded next reaches its loop",
    `g<-function(x)force(x);n<-0L;for(i in 1:3){g(next);n<-n+1L};identical(n,0L)&&identical(i,3L)`,
  ],
  [
    "distinct evaluation environments reject break",
    `message<-tryCatch({for(i in 1:3)evalq(break,new.env())},error=conditionMessage);identical(message,"no loop for break/next, jumping to top level")`,
  ],
  [
    "owned closures reject another environment's loop",
    `message<-tryCatch({for(i in 1:3)(function()break)()},error=conditionMessage);identical(message,"no loop for break/next, jumping to top level")`,
  ],
  [
    "exit handlers run before loop transfer",
    `e<-new.env();e$events<-integer();for(i in 1:3){evalq({on.exit(e$events<-c(e$events,i));next})};identical(e$events,1:3)`,
  ],
  [
    "transform return skips later additions",
    `x<-data.frame(a=1:2);identical(transform(x,a=return(c(3,4)),b=stop("unreachable")),x)`,
  ],
  [
    "transform consumes named returned additions",
    `identical(transform(data.frame(a=1:2),a=return(list(a=c(3,4)))),data.frame(a=c(3,4)))&&identical(transform(data.frame(a=1:2),return(c(a=3))),data.frame(a=c(3,3)))`,
  ],
  [
    "transform runs exit handlers after all additions",
    `e<-new.env();e$events<-character();result<-transform(data.frame(a=1:2),a={on.exit(e$events<-c(e$events,"exit"));e$events<-c(e$events,"a");a+1},b={e$events<-c(e$events,"b");a+2});identical(e$events,c("a","b","exit"))&&identical(result,data.frame(a=c(2,3),b=c(3,4)))`,
  ],
  [
    "transform evaluates unnamed expressions",
    `identical(tryCatch(transform(data.frame(a=1:2),stop("unnamed")),error=conditionMessage),"unnamed")`,
  ],
  [
    "transform respects visible list lookup",
    `list<-function(...)stop("masked");identical(tryCatch(transform(data.frame(a=1:2),a=a+1),error=conditionMessage),"masked")`,
  ],
  [
    "within retains mutations before its evaluation return",
    `identical(within(list(a=1L),{a<-2L;return(NULL);a<-3L}),list(a=2L))`,
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("supports return at a global evaluation boundary", async () => {
  expect(await runtime.eval("evalq(return(7L))")).toBe(7);
  await expect(runtime.eval("return(7L)")).rejects.toMatchObject({ code: "NRE2209" });
});

it("does not let exit handlers bypass resource exhaustion", async () => {
  const limited = await createR({ execution: "inline", assets, limits: { maxSteps: 500 } });
  try {
    await expect(limited.eval("evalq({on.exit(return(9L));repeat {1L}})")).rejects.toMatchObject({
      code: "NRL4001",
    });
    expect(await limited.eval("evalq(return(7L))")).toBe(7);
    expect(await limited.eval("sys.nframe()")).toBe(0);
  } finally {
    await limited.dispose();
  }
});
