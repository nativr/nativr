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

// Owned black-box observations; native library function bodies are never fixture inputs.
const cases = [
  [
    "eval adds a closure and evaluator frame",
    `base<-sys.nframe();observed<-eval(quote(sys.nframe()));identical(observed,base+2L)`,
  ],
  [
    "evalq adds a closure and evaluator frame",
    `base<-sys.nframe();observed<-evalq(sys.nframe());identical(observed,base+2L)`,
  ],
  [
    "nested evaluations retain all physical frames",
    `base<-sys.nframe();observed<-evalq(evalq(sys.nframe()));identical(observed,base+4L)`,
  ],
  [
    "an alias retains callable identity",
    `ev<-eval;base<-sys.nframe();observed<-ev(quote(sys.nframe()));identical(observed,base+2L)&&ev(quote(identical(sys.function(-1L),ev)))`,
  ],
  ["eval wrapper is the public function", `eval(quote(identical(sys.function(-1L),eval)))`],
  ["evalq wrapper is the public function", `evalq(identical(sys.function(-1L),evalq))`],
  [
    "internal evaluator is a distinct builtin",
    `evalq(typeof(sys.function())=="builtin"&&!identical(sys.function(),eval))`,
  ],
  [
    "eval and evalq share the internal evaluator",
    `identical(evalq(sys.function()),eval(quote(sys.function())))`,
  ],
  [
    "the internal evaluator remains callable",
    `kernel<-evalq(sys.function());identical(kernel(quote(1L+2L),environment(),baseenv()),3L)`,
  ],
  [
    "the internal evaluator has an unknown signature",
    `kernel<-evalq(sys.function());is.null(formals(kernel))&&is.null(args(kernel))`,
  ],
  [
    "internal evaluator arity is enforced",
    `kernel<-evalq(sys.function());identical(tryCatch(kernel(quote(1L)),error=conditionMessage),"1 argument passed to .Internal(eval) which requires 3")`,
  ],
  ["eval wrapper and kernel retain the call", `evalq(identical(sys.call(),sys.call(-1L)))`],
  [
    "an alias retains the original call head",
    `ev<-eval;identical(ev(quote(as.character(sys.call()[[1L]]))),"ev")`,
  ],
  [
    "parent frame is the evaluation wrapper",
    `target<-new.env();evalq(identical(parent.frame(),sys.frame(-1L)),target)`,
  ],
  [
    "the kernel frame holds the evaluation environment",
    `target<-new.env();evalq(identical(sys.frame(sys.nframe()),environment()),target)`,
  ],
  [
    "frame zero remains the global environment",
    `target<-new.env();evalq(identical(sys.frame(0L),globalenv())&&!identical(sys.frame(0L),environment()),target)`,
  ],
  [
    "wrapper formal bindings and enclosure are visible",
    `e<-evalq(parent.frame());identical(ls(e,all.names=TRUE),c("enclos","envir","expr"))&&identical(parent.env(e),asNamespace("base"))`,
  ],
  [
    "default environment is retained after evaluation",
    `owner<-environment();e<-evalq(parent.frame());identical(e$envir,owner)&&identical(e$enclos,baseenv())`,
  ],
  [
    "list default enclosure is the original caller",
    `owner<-environment();e<-evalq(parent.frame(),list());identical(e$enclos,owner)`,
  ],
  [
    "nested evaluation parents follow environments",
    `base<-sys.nframe();observed<-evalq(evalq(tail(sys.parents(),4L)));identical(observed,c(base,base+1L,base,base+3L))`,
  ],
  [
    "owned callees skip the evaluation context as parent",
    `owner<-environment();f<-function()identical(parent.frame(),owner);evalq(f())`,
  ],
  [
    "zero and negative parent counts retain the current frame",
    `f<-function(){n<-sys.nframe();identical(c(sys.parent(0),sys.parent(-1),sys.parent(-2)),rep(n,3))};f()`,
  ],
  ["parent counts follow the parent graph", `evalq(identical(sys.parent(),sys.nframe()-1L))`],
  [
    "forwarded inspection uses its original frame",
    `g<-function(x)x;f<-function(x)g(x);base<-sys.nframe();identical(f(sys.nframe()),base)&&identical(f(sys.parents()),sys.parents())`,
  ],
  [
    "bad frame indices have the native diagnostics",
    `identical(tryCatch(sys.frame(NA_integer_),error=conditionMessage),"invalid 'which' argument")&&identical(tryCatch(sys.frame(-1000L),error=conditionMessage),"not that many frames on the stack")`,
  ],
  [
    "bad parent counts have the native diagnostics",
    `identical(tryCatch(sys.parent(integer()),error=conditionMessage),"invalid 'n' argument")&&identical(tryCatch(sys.parent(NA_integer_),error=conditionMessage),"invalid 'n' argument")`,
  ],
  [
    "local executes its nested evaluation calls",
    `base<-sys.nframe();observed<-local(sys.nframe());identical(observed,base+6L)`,
  ],
  [
    "local default environment encloses the caller",
    `owner<-environment();local(identical(parent.env(environment()),owner))`,
  ],
  [
    "with executes generic method and evaluation frames",
    `base<-sys.nframe();observed<-with(list(),sys.nframe());identical(observed,base+4L)`,
  ],
  [
    "with mask encloses the original caller",
    `owner<-environment();with(list(),identical(parent.env(environment()),owner))`,
  ],
  [
    "with dispatches an owned S3 method",
    `with.owned<-function(data,expr,...)17L;identical(with(structure(list(),class="owned"),stop("not forced")),17L)`,
  ],
  [
    "calls and frames are pairlists of the visible stack",
    `n<-sys.nframe();calls<-sys.calls();frames<-sys.frames();identical(typeof(calls),"pairlist")&&identical(typeof(frames),"pairlist")&&length(calls)==n&&length(frames)==n&&identical(frames[[n]],environment())&&identical(calls[[n]],sys.call())`,
  ],
  [
    "forwarded lists retain the original visible stack",
    `f<-function(x)x;calls<-sys.calls();frames<-sys.frames();identical(f(sys.calls()),calls)&&identical(f(sys.frames()),frames)`,
  ],
  [
    "numeric evaluation selects global caller and wrapper frames",
    `owner<-environment();n<-sys.nframe();zero<-evalq(environment(),0L);previous<-evalq(environment(),-1L);wrapper<-evalq(environment(),n+1L);identical(zero,globalenv())&&identical(previous,owner)&&identical(parent.env(wrapper),asNamespace("base"))`,
  ],
  [
    "numeric evaluation validates length and missingness",
    `identical(tryCatch(evalq(1,integer()),error=conditionMessage),"numeric 'envir' arg not of length one")&&identical(tryCatch(evalq(1,c(0L,1L)),error=conditionMessage),"numeric 'envir' arg not of length one")&&identical(tryCatch(evalq(1,NA_integer_),error=conditionMessage),"invalid 'envir' argument of type 'integer'")`,
  ],
  [
    "evaluation rejects non-environment atomic types",
    `identical(tryCatch(evalq(1,TRUE),error=conditionMessage),"invalid 'envir' argument of type 'logical'")&&identical(tryCatch(evalq(1,"0"),error=conditionMessage),"invalid 'envir' argument of type 'character'")`,
  ],
  [
    "eval.parent selects the caller's ancestors",
    `f<-function(){x<-7L;g<-function(){x<-9L;eval.parent(quote(x))};g()};identical(f(),7L)`,
  ],
  [
    "zero eval.parent stays with the caller",
    `f<-function(){x<-7L;g<-function(){x<-9L;eval.parent(quote(x),0L)};g()};identical(f(),9L)`,
  ],
  [
    "with default has method metadata and caller identity",
    `owner<-environment();observed<-with(list(),{method<-sys.frame(sys.nframe()-2L);identical(c(method$.Generic,method$.Method,method$.Group),c("with","with.default",""))&&identical(method$.GenericCallEnv,owner)&&identical(method$.GenericDefEnv,asNamespace("base"))});observed`,
  ],
  [
    "direct with.default has its own method evaluation frames",
    `base<-sys.nframe();observed<-with.default(list(),sys.nframe());identical(observed,base+3L)`,
  ],
  [
    "numeric frame selection includes a promise's forcing stack",
    `e<-new.env();g<-function(x){e$frame<-environment();x};observed<-g(evalq(environment(),-1L));identical(observed,e$frame)`,
  ],
  [
    "internal evaluator arguments are forced in order",
    `kernel<-evalq(sys.function());e<-new.env();e$events<-character();value<-kernel({e$events<-c(e$events,"expr");quote(7L)},{e$events<-c(e$events,"envir");environment()},{e$events<-c(e$events,"enclos");baseenv()});identical(value,7L)&&identical(e$events,c("expr","envir","enclos"))`,
  ],
  [
    "fresh evaluation environments become the call parent",
    `target<-new.env();observed<-evalq({f<-function()identical(parent.frame(),target);f()},target);observed`,
  ],
  [
    "reused fresh environments retain their first active parent",
    `base<-sys.nframe();target<-new.env();observed<-evalq(evalq({f<-function()tail(sys.parents(),5L);f()}),target);identical(observed,c(base,base+1L,base+2L,base+3L,base+2L))`,
  ],
  [
    "eval inside local retains local bindings",
    `local({f<-function(x=2)x;a<-quote(f(x=));b<-as.call(as.list(a));identical(a,b)&&identical(eval(b),2)})`,
  ],
  [
    "eval reports its missing expression formal",
    `identical(tryCatch(eval(),error=conditionMessage),'argument "expr" is missing, with no default')`,
  ],
  [
    "evalq reports its missing quoted expression",
    `identical(tryCatch(evalq(),error=conditionMessage),"argument is missing, with no default")`,
  ],
  [
    "generated functions retain private environment helpers",
    `target<-new.env(parent=baseenv());evalq({helper<-function()17L;direct<-eval(quote(function()helper()));nested<-local(function()helper());parented<-eval.parent(quote(function()helper()),0L)},target);identical(c(target$direct(),target$nested(),target$parented()),rep(17L,3L))&&identical(environment(target$direct),target)&&identical(parent.env(environment(target$nested)),target)`,
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("has no reflective frames at the global boundary", async () => {
  expect(
    await runtime.eval("is.null(sys.calls())&&is.null(sys.frames())&&length(sys.parents())==0L"),
  ).toBe(true);
});

it("retains namespace callers while constructing package functions", async () => {
  const packaged = await createR({
    execution: "inline",
    assets,
    packages: [
      {
        description: "Package: ownedframes\nVersion: 1.0.0",
        namespace: "export(direct, nested, parented)",
        rSources: [
          {
            path: "R/owned.R",
            source: `
        helper <- function() 17L
        direct <- eval(quote(function() helper()))
        nested <- local(function() helper())
        parented <- eval.parent(quote(function() helper()), 0L)
      `,
          },
        ],
      },
    ],
  });
  try {
    expect(
      await packaged.eval("c(ownedframes::direct(),ownedframes::nested(),ownedframes::parented())"),
    ).toEqual([17, 17, 17]);
    expect(
      await packaged.eval(
        'identical(environment(ownedframes::direct),asNamespace("ownedframes"))&&identical(parent.env(environment(ownedframes::nested)),asNamespace("ownedframes"))',
      ),
    ).toBe(true);
  } finally {
    await packaged.dispose();
  }
});

it("restores reflective frames after resource exhaustion", async () => {
  const limited = await createR({ execution: "inline", assets, limits: { maxSteps: 1200 } });
  try {
    await expect(limited.eval("evalq({on.exit(return(9L));repeat {1L}})")).rejects.toMatchObject({
      code: "NRL4001",
    });
    expect(await limited.eval("sys.nframe()")).toBe(0);
    expect(await limited.eval("evalq(sys.nframe())")).toBe(2);
  } finally {
    await limited.dispose();
  }
});
