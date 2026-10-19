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

// Independently authored input/output cases. No foreign implementation bodies are observed.
const cases = [
  [
    "preserves missing declared default classes and handler selection",
    `expected<-c("getvarError","missingArgError","error","condition");identical(tryCatch(match.arg(,c("a","b")),error=class),expected)&&identical(tryCatch(format.default(),error=class),expected)&&identical(tryCatch(match.arg(,c("a","b")),missingArgError=function(e)"missing",error=function(e)"other"),"missing")`,
  ],
  [
    "retains factor subset attribute order through argument selection",
    `x<-factor(c("b","a"));names(x)<-c("B","A");attr(x,"owned")<-7L;expected<-c("names","levels","class");identical(names(attributes(x[1])),expected)&&identical(names(attributes(x[integer()])),expected)&&identical(names(attributes(match.arg("b",x))),expected)&&identical(levels(match.arg("b",x)),levels(x))`,
  ],
  [
    "retains builtin error origins through forced promises",
    `probe<-function(expr)tryCatch(force(expr),error=conditionCall);identical(probe(abs("x")),quote(abs("x")))&&identical(probe(format.default("x",justify="bad")),quote(match.arg(justify)))`,
  ],
  [
    "retains aliased and namespace-qualified callable origins",
    `f<-abs;identical(tryCatch(f("x"),error=conditionCall),quote(f("x")))&&identical(tryCatch(base::abs("x"),error=conditionCall),quote(base::abs("x")))`,
  ],
  [
    "retains errors from closure bodies and default promises",
    `f<-function()abs("x");g<-function(x=abs("x"))x;identical(tryCatch(f(),error=conditionCall),quote(abs("x")))&&identical(tryCatch(g(),error=conditionCall),quote(abs("x")))`,
  ],
  [
    "retains binary and unary syntax as error calls",
    `identical(tryCatch("x"+1,error=conditionCall),quote("x"+1))&&identical(tryCatch(1/"x",error=conditionCall),quote(1/"x"))&&identical(tryCatch(!"x",error=conditionCall),quote(!"x"))`,
  ],
  [
    "retains subsetting and owned control syntax as error calls",
    `identical(tryCatch(1[[2]],error=conditionCall),quote(1[[2]]))&&identical(tryCatch(if(NA)1,error=conditionCall),quote(if(NA)1))`,
  ],
  [
    "retains global missing-object NULL origins through enclosing calls",
    `delayedAssign("owned_global_missing",owned_missing,eval.env=.GlobalEnv);g<-function(x)x;a<-tryCatch(owned_global_missing,error=conditionCall);b<-suppressWarnings(tryCatch(g(owned_global_missing),error=conditionCall));cc<-suppressWarnings(tryCatch(owned_global_missing+1,error=conditionCall));is.null(a)&&is.null(b)&&is.null(cc)`,
  ],
  [
    "uses the evaluation frame for missing-object origins",
    `f<-function()owned_missing;g<-function(x)x;h<-function()g(owned_missing);identical(tryCatch(f(),error=conditionCall),quote(f()))&&identical(tryCatch(h(),error=conditionCall),quote(h()))`,
  ],
  [
    "reports missing object and callable diagnostics separately",
    `x<-1;identical(tryCatch(owned_missing,error=conditionMessage),"object 'owned_missing' not found")&&identical(tryCatch(owned_missing(),error=conditionMessage),'could not find function "owned_missing"')&&identical(tryCatch(x(),error=conditionMessage),'could not find function "x"')&&identical(tryCatch(x(),error=conditionCall),quote(x()))`,
  ],
  [
    "retains calls for evaluated and embedded builtin heads",
    `a<-tryCatch(eval(quote(abs("x"))),error=conditionCall);b<-tryCatch(do.call(abs,list("x")),error=conditionCall);identical(a,quote(abs("x")))&&identical(b[[1]],abs)&&identical(b[[2]],"x")`,
  ],
  [
    "preserves explicit NULL calls in supplied conditions",
    `f<-function()stop(simpleError("owned",call=NULL));g<-function()stop("owned",call.=FALSE);is.null(tryCatch(f(),error=conditionCall))&&is.null(tryCatch(g(),error=conditionCall))`,
  ],
  [
    "preserves a supplied condition call through rethrowing",
    `condition<-simpleError("owned",call=quote(owned(7)));f<-function()tryCatch(stop(condition),error=function(e)stop(e));identical(tryCatch(f(),error=identity),condition)`,
  ],
  [
    "delivers origins to calling handlers before exiting handlers",
    `seen<-list();value<-tryCatch(withCallingHandlers(abs("x"),error=function(e)seen[[length(seen)+1]]<<-conditionCall(e)),error=conditionCall);identical(seen,list(quote(abs("x"))))&&identical(value,quote(abs("x")))`,
  ],
  [
    "retains failed delayed-expression origins on another force",
    `delayedAssign("x",abs("bad"));a<-tryCatch(x,error=conditionCall);b<-suppressWarnings(tryCatch(x,error=conditionCall));identical(a,quote(abs("bad")))&&identical(a,b)`,
  ],
  [
    "retains match.arg signature metadata",
    `identical(formals(match.arg),formals(function(arg,choices,several.ok=FALSE)NULL))`,
  ],
  [
    "reports exact shared choice messages and calls",
    `a<-tryCatch(match.arg("bad",c("a","b")),error=function(e)list(conditionMessage(e),conditionCall(e)));identical(a,list('\\'arg\\' should be one of "a", "b"',quote(match.arg("bad",c("a","b")))))&&identical(tryCatch(format.default("x",justify="bad"),error=conditionCall),quote(match.arg(justify)))`,
  ],
  [
    "reports choice type, scalar length and missing-argument diagnostics",
    `identical(tryCatch(match.arg(1,c("1","2")),error=conditionMessage),"'arg' must be NULL or a character vector")&&identical(tryCatch(match.arg(character(),c("a","b")),error=conditionMessage),"'arg' must be of length 1")&&identical(tryCatch(match.arg(,c("a","b")),error=conditionMessage),'argument "arg" is missing, with no default')`,
  ],
  [
    "uses empty several.ok defaults",
    `identical(match.arg("a",c("alpha","beta"),several.ok=),"alpha")`,
  ],
  [
    "distinguishes several.some filtering from all-required matching",
    `identical(match.arg(c("a","bad"),c("alpha","beta"),TRUE),"alpha")&&identical(tryCatch(match.arg(c("a","bad"),c("alpha","beta"),"all"),error=conditionMessage),'\\'arg\\' should be one of "alpha", "beta"')`,
  ],
  [
    "rejects several matching with no selected choices",
    `identical(tryCatch(match.arg("bad",c("a","b"),TRUE),error=conditionMessage),'\\'arg\\' should be one of "a", "b"')&&identical(tryCatch(match.arg(character(),c("a","b"),TRUE),error=conditionMessage),"'arg' must be of length >= 1")`,
  ],
  [
    "retains duplicate argument selections and rejects ambiguous prefixes",
    `identical(match.arg(c("a","a"),c("alpha","beta"),TRUE),c("alpha","alpha"))&&identical(match.arg(c("a","a"),c("alpha","beta"),"all choices"),c("alpha","alpha"))&&identical(tryCatch(match.arg("a",c("alpha","alpha","beta")),error=conditionMessage),'\\'arg\\' should be one of "alpha", "beta"')`,
  ],
  [
    "preserves missing choice masks and matches their character label",
    `identical(match.arg(NA_character_,c(NA_character_,"a")),NA_character_)&&identical(match.arg("NA",c(NA_character_,"a")),NA_character_)&&identical(tryCatch(match.arg("bad",c(NA_character_,"")),error=conditionMessage),'\\'arg\\' should be "NA"')`,
  ],
  [
    "treats empty labels as unmatched except identical default vectors",
    `identical(match.arg("",""),"")&&identical(tryCatch(match.arg("",c("","a")),error=conditionMessage),'\\'arg\\' should be "a"')`,
  ],
  [
    "retains empty and NULL choice result types",
    `identical(match.arg(character(),character()),NA_character_)&&identical(match.arg(NULL,character()),NA_character_)&&identical(match.arg(NULL,NULL),NULL)&&identical(match.arg(NULL,list()),list(NULL))`,
  ],
  [
    "matches list, factor and integer choices without dropping result types",
    `identical(match.arg("a",list("alpha","beta")),list("alpha"))&&identical(match.arg("1",1:2),1L)&&identical(match.arg("a",factor(c("a","b"))),factor("a",levels=c("a","b")))`,
  ],
  [
    "formats zero and one unique alternative correctly",
    `identical(tryCatch(match.arg("bad",c("a","a","")),error=conditionMessage),'\\'arg\\' should be "a"')&&identical(tryCatch(match.arg("bad",character()),error=conditionMessage),"'arg' should be one of ")`,
  ],
  [
    "returns NULL-selected choices without forcing several.ok",
    `identical(match.arg(NULL,c("a","b"),stop("unused")),"a")`,
  ],
  [
    "forces explicit argument controls and choices in order",
    `seen<-character();mark<-function(name,value){seen<<-c(seen,name);value};value<-match.arg(mark("arg","a"),mark("choices",c("a","b")),mark("several",FALSE));identical(value,"a")&&identical(seen,c("arg","several","choices"))`,
  ],
  [
    "rejects wrong argument types before forcing choice controls",
    `identical(tryCatch(match.arg(1,stop("choices"),stop("several")),error=conditionMessage),"'arg' must be NULL or a character vector")`,
  ],
  [
    "evaluates implicit formal choices before the actual promise",
    `seen<-character();f<-function(arg={seen<<-c(seen,"default");c("a","b")})match.arg(arg);value<-f({seen<-c(seen,"actual");"b"});identical(value,"b")&&identical(seen,c("default","actual"))`,
  ],
  [
    "evaluates default choices independently from the default actual",
    `seen<-0;f<-function(arg={seen<<-seen+1;c("a","b")})match.arg(arg);identical(f(),"a")&&identical(seen,2)`,
  ],
  [
    "does not force a compound implicit-choice actual before rejecting lookup",
    `seen<-FALSE;f<-function(arg=c("a","b"))match.arg({seen<<-TRUE;arg});message<-tryCatch(f(),error=conditionMessage);identical(message,"no such index at level 1\n")&&!seen`,
  ],
  [
    "reports missing implicit defaults without body metadata",
    `f<-function(arg)match.arg(arg);identical(tryCatch(f("a"),error=conditionMessage),"argument is missing, with no default")`,
  ],
  [
    "validates several.ok input types and logical shape",
    `messages<-lapply(list(1,"yes",NA,logical(),c(TRUE,FALSE),c("all","yes")),function(value)tryCatch(match.arg("a",c("a","b"),value),error=conditionMessage));identical(messages,list('\\'several.ok\\' must be logical or a string starting with "all"','\\'several.ok\\' must be logical or a string starting with "all"',"missing value where TRUE/FALSE needed","argument is of length zero","the condition has length > 1","'length = 2' in coercion to 'logical(1)'"))`,
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("bounds choice scanning and does not turn a resource failure into an R condition", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 500, maxVectorLength: 5000 },
  });
  try {
    await limited.assign(
      "choices",
      Array.from({ length: 2000 }, (_, index) => `owned${index}`),
    );
    await expect(
      limited.eval('tryCatch(match.arg("absent",choices),error=function(e)"caught")'),
    ).rejects.toMatchObject({ code: "NRL4001" });
  } finally {
    await limited.dispose();
  }
});
