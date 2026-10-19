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

// Independently authored cases observed with GNU R 4.6.1 as a black-box oracle.
const cases = [
  [
    "reserves exact matches before partial matches",
    "f<-function(alpha,alpine,beta)c(alpha,alpine,beta);identical(f(alpha=1,al=2,beta=3),c(1,2,3))",
  ],
  [
    "diagnoses leftover partial names as unused",
    'f<-function(alpha,beta)NULL;identical(tryCatch(f(alpha=1,al=2),error=conditionMessage),"unused argument (al = 2)")',
  ],
  [
    "checks exact duplicates in formal order",
    "f<-function(alpha,beta)NULL;identical(tryCatch(f(beta=1,beta=2,alpha=3,alpha=4),error=conditionMessage),'formal argument \"alpha\" matched by multiple actual arguments')",
  ],
  [
    "checks partial duplicates in formal order",
    "f<-function(alpha,beta)NULL;identical(tryCatch(f(be=1,b=2,al=3,a=4),error=conditionMessage),'formal argument \"alpha\" matched by multiple actual arguments')",
  ],
  [
    "reports partial ambiguity before a later formal duplicate",
    'f<-function(alpha,alpine,beta)NULL;identical(tryCatch(f(be=1,b=2,al=3),error=conditionMessage),"argument 3 matches multiple formal arguments")',
  ],
  [
    "finishes exact matching before partial ambiguity",
    "f<-function(alpha,alpine,beta)NULL;identical(tryCatch(f(al=1,beta=2,beta=3),error=conditionMessage),'formal argument \"beta\" matched by multiple actual arguments')",
  ],
  [
    "collects unused actuals in their original order",
    'f<-function(alpha,beta)NULL;identical(tryCatch(f(extra=4,1,2,3),error=conditionMessage),"unused arguments (extra = 4, 3)")',
  ],
  [
    "renders a named missing unused argument",
    'identical(tryCatch((function()NULL)(other=),error=conditionMessage),"unused argument (alist(other = ))")',
  ],
  [
    "renders multiple missing unused arguments",
    'identical(tryCatch((function()NULL)(,),error=conditionMessage),"unused arguments (alist(, ))")',
  ],
  [
    "quotes nonsyntactic unused names",
    'identical(tryCatch((function()NULL)("not a name"=3),error=conditionMessage),"unused argument (`not a name` = 3)")',
  ],
  [
    "renders an unused block without evaluating it",
    'n<-0;message<-tryCatch((function(x)x)(1,extra={n<-1;n+2}),error=conditionMessage);identical(n,0)&&identical(message,"unused argument (extra = {\\n    n <- 1\\n    n + 2\\n})")',
  ],
  [
    "renders an unused function without evaluating it",
    'identical(tryCatch((function()NULL)(extra=function(x){x+1}),error=conditionMessage),"unused argument (extra = function(x) {\\n    x + 1\\n})")',
  ],
  [
    "does not force unused arguments for closure-like builtins",
    'n<-0;message<-tryCatch(as.factor(1,extra={n<-1;stop("forced")}),error=conditionMessage);identical(n,0)&&startsWith(message,"unused argument (extra = {")',
  ],
  [
    "reports builtin duplicate formals without forcing",
    'n<-0;message<-tryCatch(as.factor(x=1,x={n<-1;stop("forced")}),error=conditionMessage);identical(n,0)&&identical(message,\'formal argument "x" matched by multiple actual arguments\')',
  ],
  [
    "matches trailing formals exactly and leaves partial names in dots",
    "f<-function(alpha,...,beta)list(alpha,...,beta=beta);identical(f(al=1,be=2,beta=3),list(1,be=2,beta=3))",
  ],
  [
    "treats empty call tags as unnamed",
    'f<-function(alpha,beta)c(alpha,beta);identical(do.call(f,setNames(list(1,2),c("",""))),c(1,2))',
  ],
  [
    "uses the same matching policy in match.call",
    "f<-function(alpha,alpine,beta)match.call();identical(f(alpha=1,al=2,beta=3),quote(f(alpha=1,alpine=2,beta=3)))",
  ],
  [
    "rematches an explicit call with match.call",
    "f<-function(alpha,alpine,beta)NULL;identical(match.call(f,quote(f(alpha=1,al=2,beta=3))),quote(f(alpha=1,alpine=2,beta=3)))",
  ],
  [
    "retains unused diagnostic calls",
    "f<-function(alpha,beta)NULL;identical(tryCatch(f(1,2,other=3),error=conditionCall),quote(f(1,2,other=3)))",
  ],
  [
    "retains duplicate builtin diagnostic calls",
    "identical(tryCatch(as.factor(x=1,x=2),error=conditionCall),quote(as.factor(x=1,x=2)))",
  ],
  [
    "selects an explicit missing actual default without losing missingness",
    "f<-function(x=1)c(before=missing(x),value=x,after=missing(x));identical(f(x=),c(before=1,value=1,after=1))",
  ],
  [
    "evaluates the default once",
    "n<-0;f<-function(x={n<<-n+1;4})c(missing(x),x,x,n);identical(f(x=),c(1,4,4,1))",
  ],
  [
    "leaves unused defaults unforced",
    'f<-function(x=stop("forced"))missing(x);identical(f(x=),TRUE)',
  ],
  [
    "selects a default for an empty argument forwarded through dots",
    "f<-function(x=1)x;g<-function(...)f(...);identical(g(x=),1)",
  ],
  ["selects a trailing default after dots", "identical((function(...,x=1)x)(x=),1)"],
  [
    "preserves the name of a forwarded missing argument",
    "f<-function(x=1)x;g<-function(y)f(y);identical(tryCatch(g(),error=conditionMessage),'argument \"y\" is missing, with no default')",
  ],
  [
    "does not propagate missingness through a defaulted promise",
    "f<-function(x=1)c(missing=missing(x),value=x);g<-function(y=2)f(y);identical(g(),c(missing=0,value=2))",
  ],
  [
    "keeps forwarded symbol lookup deferred",
    "g<-function(y){h<-function(x=1){y<<-2;x};h(y)};identical(g(),2)",
  ],
  [
    "names a required missing formal",
    "f<-function(alpha,beta)alpha+beta;identical(tryCatch(f(,2),error=conditionMessage),'argument \"alpha\" is missing, with no default')",
  ],
  [
    "retains the missing argument call",
    "f<-function(alpha,beta)alpha+beta;identical(tryCatch(f(,2),error=conditionCall),quote(f(,2)))",
  ],
  [
    "does not name an anonymous missing dots argument",
    'identical(tryCatch((function(...)sum(...))(1,,2),error=conditionMessage),"argument is missing, with no default")',
  ],
  [
    "uses person defaults for empty named and positional actuals",
    'expected<-person("Ada","Example",role="aut");identical(person("Ada","Example",,role="aut"),expected)&&identical(person("Ada","Example",email=,role="aut"),expected)',
  ],
  [
    "omits empty formal actuals from match.call",
    "f<-function(x=1)match.call();identical(f(x=),quote(f()))&&identical(match.call(f,quote(f(x=))),quote(f()))",
  ],
  [
    "uses alist for a mixture of empty and valued unused actuals",
    'identical(tryCatch((function()NULL)(extra=1,other=),error=conditionMessage),"unused arguments (alist(extra = 1, other = ))")',
  ],
  [
    "names omitted and empty builtin required arguments",
    "expected<-'argument \"x\" is missing, with no default';identical(tryCatch(as.factor(),error=conditionMessage),expected)&&identical(tryCatch(as.factor(x=),error=conditionMessage),expected)",
  ],
  [
    "retains the empty builtin argument call",
    "identical(tryCatch(as.factor(x=),error=conditionCall),quote(as.factor(x=)))",
  ],
  [
    "forces excess primitive arguments before checking arity",
    'n<-0;message<-tryCatch(sqrt(1,extra={n<-1;stop("forced")}),error=conditionMessage);identical(n,1)&&identical(message,"forced")',
  ],
  [
    "evaluates primitive arguments in actual order",
    "n<-0;message<-tryCatch(abs({n<-n+1;1},{n<-n+10;2}),error=conditionMessage);identical(n,11)&&identical(message,\"2 arguments passed to 'abs' which requires 1\")",
  ],
  [
    "reports primitive empty arguments",
    'identical(tryCatch(sqrt(x=),error=conditionMessage),"argument 1 is empty")',
  ],
  [
    "reports primitive arity instead of duplicate names",
    "identical(tryCatch(abs(x=1,x=2),error=conditionMessage),\"2 arguments passed to 'abs' which requires 1\")",
  ],
  [
    "checks primitive names after evaluation",
    "n<-0;message<-tryCatch(sqrt(other={n<-1;4}),error=conditionMessage);identical(n,1)&&identical(message,\"supplied argument name 'other' does not match 'x'\")",
  ],
  [
    "retains primitive arity diagnostic calls",
    "identical(tryCatch(sqrt(),error=conditionCall),quote(sqrt()))&&identical(tryCatch(sqrt(),error=conditionMessage),\"0 arguments passed to 'sqrt' which requires 1\")",
  ],
  [
    "retains the originating call for forwarded missing arguments",
    "h<-function(y){inner<-function(x=1)x;inner(y)};identical(tryCatch(h(),error=conditionCall),quote(h()))",
  ],
  [
    "uses the active caller when a missing origin frame has returned",
    "h<-function(y)function()y;g<-h();identical(tryCatch(g(),error=conditionCall),quote(g()))",
  ],
  [
    "preserves origin across several forwarding frames",
    "a<-function(z)b(z);b<-function(y)cc(y);cc<-function(x)x;identical(tryCatch(a(),error=conditionCall),quote(a()))",
  ],
  [
    "exposes an empty call argument as a symbol",
    'x<-as.list(quote(sqrt(x=)));identical(length(x),2L)&&is.symbol(x[[2]])&&identical(as.character(x[[2]]),"")',
  ],
  [
    "reconstructs empty call arguments without turning them into identifiers",
    "f<-function(x=2)x;a<-quote(f(x=));b<-as.call(as.list(a));identical(a,b)&&identical(eval(b),2)",
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`local({${code}})`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});
