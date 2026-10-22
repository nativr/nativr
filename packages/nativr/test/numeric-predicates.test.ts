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
// Independently authored GNU R 4.6.1 black-box observations. Success-path errors escape.
const cases = [
  {
    group: "metadata",
    name: "primitive metadata",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(vapply(list(is.finite,is.infinite,is.nan),typeof,""),rep("builtin",3))&&identical(lapply(list(is.finite,is.infinite,is.nan),function(f)names(formals(args(f)))),rep(list("x"),3))})',
  },
  {
    group: "values",
    name: "real finite infinite NA NaN",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-c(0,-Inf,Inf,NA_real_,NaN);identical(list(is.finite(x),is.infinite(x),is.nan(x)),list(c(TRUE,FALSE,FALSE,FALSE,FALSE),c(FALSE,TRUE,TRUE,FALSE,FALSE),c(FALSE,FALSE,FALSE,FALSE,TRUE)))})})",
  },
  {
    group: "values",
    name: "integer and logical missing",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({a<-c(0L,1L,NA_integer_);b<-c(FALSE,TRUE,NA);expected<-list(c(TRUE,TRUE,FALSE),rep(FALSE,3),rep(FALSE,3));identical(list(is.finite(a),is.infinite(a),is.nan(a)),expected)&&identical(list(is.finite(b),is.infinite(b),is.nan(b)),expected)})})",
  },
  {
    group: "values",
    name: "character is never numeric finite",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-c("0","Inf","NaN",NA_character_);identical(list(is.finite(x),is.infinite(x),is.nan(x)),rep(list(rep(FALSE,4)),3))})})',
  },
  {
    group: "values",
    name: "raw is never numeric finite",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-as.raw(0:2);identical(list(is.finite(x),is.infinite(x),is.nan(x)),rep(list(rep(FALSE,3)),3))})})",
  },
  {
    group: "values",
    name: "NULL and empty",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(list(is.finite(NULL),is.infinite(NULL),is.nan(NULL),is.finite(numeric()),is.infinite(integer()),is.nan(character())),rep(list(logical()),6))})",
  },
  {
    group: "values",
    name: "factor codes and missing",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-factor(c("a",NA));identical(list(is.finite(x),is.infinite(x),is.nan(x)),list(c(TRUE,FALSE),c(FALSE,FALSE),c(FALSE,FALSE)))})})',
  },
  {
    group: "values",
    name: "Date underlying values",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-structure(c(0,Inf,NA_real_,NaN),class="Date");identical(list(is.finite(x),is.infinite(x),is.nan(x)),list(c(TRUE,FALSE,FALSE,FALSE),c(FALSE,TRUE,FALSE,FALSE),c(FALSE,FALSE,FALSE,TRUE)))})})',
  },
  {
    group: "complex",
    name: "complex non-NA component grid",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({v<-c(1,Inf,-Inf,NaN);x<-complex(real=rep(v,each=4),imaginary=rep(v,times=4));identical(list(is.finite(x),is.infinite(x),is.nan(x)),list(c(TRUE,rep(FALSE,15)),c(FALSE,TRUE,TRUE,FALSE,rep(TRUE,8),FALSE,TRUE,TRUE,FALSE),c(FALSE,FALSE,FALSE,TRUE,FALSE,FALSE,FALSE,TRUE,FALSE,FALSE,FALSE,TRUE,TRUE,TRUE,TRUE,TRUE)))})})",
  },
  {
    group: "complex",
    name: "whole missing complex",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(list(is.finite(NA_complex_),is.infinite(NA_complex_),is.nan(NA_complex_)),list(FALSE,FALSE,FALSE))})",
  },
  {
    group: "attributes",
    name: "vector names preserve missing mask",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({nm<-c("one",NA,"","four");x<-structure(c(1,Inf,NaN,NA_real_),names=nm,note="drop");identical(list(is.finite(x),is.infinite(x),is.nan(x)),list(structure(c(TRUE,FALSE,FALSE,FALSE),names=nm),structure(c(FALSE,TRUE,FALSE,FALSE),names=nm),structure(c(FALSE,FALSE,TRUE,FALSE),names=nm)))})})',
  },
  {
    group: "attributes",
    name: "matrix dimensions suppress names",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-structure(matrix(c(0,Inf,NA_real_,NaN),2,dimnames=list(c("a","b"),c("c","d"))),names=c("one",NA,"","four"),note="drop");expected<-list(dim=c(2L,2L),dimnames=list(c("a","b"),c("c","d")));identical(attributes(is.finite(x)),expected)&&identical(attributes(is.infinite(x)),expected)&&identical(attributes(is.nan(x)),expected)})})',
  },
  {
    group: "attributes",
    name: "empty names retained",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-structure(numeric(),names=character(),note="drop");identical(attributes(is.finite(x)),list(names=character()))&&identical(attributes(is.nan(x)),list(names=character()))})})',
  },
  {
    group: "attributes",
    name: "empty dimension metadata retained",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-structure(numeric(),dim=c(0L,2L),dimnames=list(NULL,c("a","b")),note="drop");expected<-list(dim=c(0L,2L),dimnames=list(NULL,c("a","b")));identical(attributes(is.finite(x)),expected)&&identical(attributes(is.infinite(x)),expected)&&identical(attributes(is.nan(x)),expected)})})',
  },
  {
    group: "diagnostics",
    name: "unsupported list",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(list(1))),\"default method not implemented for type 'list'\")})",
  },
  {
    group: "diagnostics",
    name: "unsupported expression",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(expression(1))),\"default method not implemented for type 'expression'\")})",
  },
  {
    group: "diagnostics",
    name: "unsupported pairlist",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(pairlist(a=1))),\"default method not implemented for type 'pairlist'\")})",
  },
  {
    group: "diagnostics",
    name: "unsupported symbol",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(quote(x))),\"default method not implemented for type 'symbol'\")})",
  },
  {
    group: "diagnostics",
    name: "unsupported language",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(quote(f(x)))),\"default method not implemented for type 'language'\")})",
  },
  {
    group: "diagnostics",
    name: "unsupported closure",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(function(x)x)),\"default method not implemented for type 'closure'\")})",
  },
  {
    group: "diagnostics",
    name: "unsupported environment",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(new.env())),\"default method not implemented for type 'environment'\")})",
  },
  {
    group: "diagnostics",
    name: "unsupported builtin",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(sqrt)),\"default method not implemented for type 'builtin'\")})",
  },
  {
    group: "diagnostics",
    name: "unsupported special",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(`if`)),\"default method not implemented for type 'special'\")})",
  },
  {
    group: "diagnostics",
    name: "all predicates list unsupported",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(c(err(is.finite(list(1))),err(is.infinite(list(1))),err(is.nan(list(1)))),rep(\"default method not implemented for type 'list'\",3))})",
  },
  {
    group: "diagnostics",
    name: "is.finite zero arity",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite()),\"0 arguments passed to 'is.finite' which requires 1\")})",
  },
  {
    group: "diagnostics",
    name: "is.finite missing actual",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(x=)),"argument 1 is empty")})',
  },
  {
    group: "diagnostics",
    name: "is.finite exact tag required",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(other=Inf)),\"supplied argument name 'other' does not match 'x'\")})",
  },
  {
    group: "forcing",
    name: "is.finite all actuals before arity",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();message<-err(is.finite({events<-c(events,"x");1},{events<-c(events,"extra");2}));identical(list(events,message),list(c("x","extra"),"2 arguments passed to \'is.finite\' which requires 1"))})})',
  },
  {
    group: "dispatch",
    name: "is.finite class method visible",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.finite.owned<-function(x)invisible("owned");identical(withVisible(is.finite(structure(Inf,class="owned"))),list(value="owned",visible=TRUE))})})',
  },
  {
    group: "dispatch",
    name: "is.finite default class only",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.finite.default<-function(x)"default";identical(is.finite(structure(Inf,class="owned")),"default")&&identical(is.finite(Inf),FALSE)})})',
  },
  {
    group: "dispatch",
    name: "is.finite NextMethod fallback",
    code: 'local({seen<-FALSE;is.finite.owned<-function(x){seen<<-TRUE;NextMethod()};result<-is.finite(structure(c(1,Inf,NaN,NA_real_),class="owned"));seen&&identical(result,c(TRUE,FALSE,FALSE,FALSE))})',
  },
  {
    group: "diagnostics",
    name: "is.infinite zero arity",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.infinite()),\"0 arguments passed to 'is.infinite' which requires 1\")})",
  },
  {
    group: "diagnostics",
    name: "is.infinite missing actual",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.infinite(x=)),"argument 1 is empty")})',
  },
  {
    group: "diagnostics",
    name: "is.infinite exact tag required",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.infinite(other=Inf)),\"supplied argument name 'other' does not match 'x'\")})",
  },
  {
    group: "forcing",
    name: "is.infinite all actuals before arity",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();message<-err(is.infinite({events<-c(events,"x");1},{events<-c(events,"extra");2}));identical(list(events,message),list(c("x","extra"),"2 arguments passed to \'is.infinite\' which requires 1"))})})',
  },
  {
    group: "dispatch",
    name: "is.infinite class method visible",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.infinite.owned<-function(x)invisible("owned");identical(withVisible(is.infinite(structure(Inf,class="owned"))),list(value="owned",visible=TRUE))})})',
  },
  {
    group: "dispatch",
    name: "is.infinite default class only",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.infinite.default<-function(x)"default";identical(is.infinite(structure(Inf,class="owned")),"default")&&identical(is.infinite(Inf),TRUE)})})',
  },
  {
    group: "dispatch",
    name: "is.infinite NextMethod fallback",
    code: 'local({seen<-FALSE;is.infinite.owned<-function(x){seen<<-TRUE;NextMethod()};result<-is.infinite(structure(c(1,Inf,NaN,NA_real_),class="owned"));seen&&identical(result,c(FALSE,TRUE,FALSE,FALSE))})',
  },
  {
    group: "diagnostics",
    name: "is.nan zero arity",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.nan()),\"0 arguments passed to 'is.nan' which requires 1\")})",
  },
  {
    group: "diagnostics",
    name: "is.nan missing actual",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.nan(x=)),"argument 1 is empty")})',
  },
  {
    group: "diagnostics",
    name: "is.nan exact tag required",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.nan(other=Inf)),\"supplied argument name 'other' does not match 'x'\")})",
  },
  {
    group: "forcing",
    name: "is.nan all actuals before arity",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();message<-err(is.nan({events<-c(events,"x");1},{events<-c(events,"extra");2}));identical(list(events,message),list(c("x","extra"),"2 arguments passed to \'is.nan\' which requires 1"))})})',
  },
  {
    group: "dispatch",
    name: "is.nan class method visible",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.nan.owned<-function(x)invisible("owned");identical(withVisible(is.nan(structure(Inf,class="owned"))),list(value="owned",visible=TRUE))})})',
  },
  {
    group: "dispatch",
    name: "is.nan default class only",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.nan.default<-function(x)"default";identical(is.nan(structure(Inf,class="owned")),"default")&&identical(is.nan(Inf),FALSE)})})',
  },
  {
    group: "dispatch",
    name: "is.nan NextMethod fallback",
    code: 'local({seen<-FALSE;is.nan.owned<-function(x){seen<<-TRUE;NextMethod()};result<-is.nan(structure(c(1,Inf,NaN,NA_real_),class="owned"));seen&&identical(result,c(FALSE,FALSE,TRUE,FALSE))})',
  },
  {
    group: "forcing",
    name: "input failure before arity",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(stop("input"),stop("extra"))),"input")})',
  },
  {
    group: "forcing",
    name: "empty second before arity",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(1,)),"argument 2 is empty")})',
  },
  {
    group: "forcing",
    name: "arity before invalid tag",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(is.finite(other=1,2)),\"2 arguments passed to 'is.finite' which requires 1\")})",
  },
  {
    group: "forcing",
    name: "force before invalid tag",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();message<-err(is.infinite(other={events<-c(events,"x");Inf}));identical(list(events,message),list("x","supplied argument name \'other\' does not match \'x\'"))})})',
  },
  {
    group: "dispatch",
    name: "classed list dispatch before storage error",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.finite.owned<-function(x)42L;identical(is.finite(structure(list(1),class="owned")),42L)})})',
  },
  {
    group: "dispatch",
    name: "invalid tag before method",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.finite.owned<-function(x)42L;identical(err(is.finite(other=structure(Inf,class=\"owned\"))),\"supplied argument name 'other' does not match 'x'\")})})",
  },
  {
    group: "dispatch",
    name: "method input forced once",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({count<-0L;is.nan.owned<-function(x){x;x;count};identical(is.nan({count<-count+1L;structure(NaN,class="owned")}),1L)})})',
  },
  {
    group: "dispatch",
    name: "method output reference identity",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({e<-new.env();is.finite.owned<-function(x)e;identical(is.finite(structure(Inf,class="owned")),e)})})',
  },
  {
    group: "dispatch",
    name: "method substitution and matched call",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.finite.owned<-function(x)list(substitute(x),match.call(),.Generic,.Method,.Class,.Group);x<-structure(Inf,class="owned");identical(is.finite(x),list(x,quote(is.finite.owned(x=x)),"is.finite","is.finite.owned","owned",""))})})',
  },
  {
    group: "dispatch",
    name: "NextMethod reassigned input",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({is.finite.owned<-function(x){x<-c(2,Inf);NextMethod()};identical(is.finite(structure(c(1,Inf,NA_real_),class="owned")),c(TRUE,FALSE))})})',
  },
  {
    group: "independent",
    name: "is.nan classifies NaN independently and retains vector names",
    code: 'local({x<-structure(c(NaN,NA_real_,Inf,-Inf,1),names=c("nan","na","pos","neg","one"),note="drop");identical(is.nan(x),c(nan=TRUE,na=FALSE,pos=FALSE,neg=FALSE,one=FALSE))&&identical(is.nan(complex(real=c(NaN,1,NaN,Inf),imaginary=c(1,NaN,NaN,1))),c(TRUE,TRUE,TRUE,FALSE))})',
  },
  {
    group: "identity",
    name: "all predicate methods retain the same environment reference",
    code: 'local({shared<-new.env(parent=emptyenv());is.finite.owned<-function(x)shared;is.infinite.owned<-function(x)shared;is.nan.owned<-function(x)shared;x<-structure(1,class="owned");identical(shared,is.finite(x))&&identical(shared,is.infinite(x))&&identical(shared,is.nan(x))})',
  },
  {
    group: "review-dispatch",
    name: "multiclass chain",
    code: 'local({events<-character();is.finite.first<-function(x){events<<-c(events,"first");NextMethod()};is.finite.second<-function(x){events<<-c(events,"second");NextMethod()};y<-is.finite(structure(c(1,Inf,NA_real_),class=c("first","second")));identical(list(events,y),list(c("first","second"),c(TRUE,FALSE,FALSE)))})',
  },
  {
    group: "review-dispatch",
    name: "classed environment dispatch",
    code: 'local({is.nan.owned<-function(x)identical(x,e);e<-new.env();class(e)<-"owned";identical(is.nan(e),TRUE)})',
  },
  {
    group: "review-dispatch",
    name: "classed closure dispatch",
    code: 'local({is.infinite.owned<-function(x)identical(x,f);f<-function(x)x;attr(f,"class")<-"owned";identical(is.infinite(f),TRUE)})',
  },
  {
    group: "review-dispatch",
    name: "dots active binding forced once",
    code: 'local({count<-0L;makeActiveBinding("a",function(value){count<<-count+1L;structure(NaN,class="owned")},environment());is.nan.owned<-function(x){x;x;TRUE};f<-function(...)is.nan(...);y<-f(a);identical(list(y,count),list(TRUE,1L))})',
  },
  {
    group: "review-dispatch",
    name: "input chooses current method",
    code: 'local({is.finite.owned<-function(x)FALSE;y<-is.finite({is.finite.owned<-function(x)TRUE;structure(Inf,class="owned")});identical(y,TRUE)})',
  },
  {
    group: "review-dispatch",
    name: "NextMethod input storage validation",
    code: 'local({is.nan.owned<-function(x){x<-list(1);NextMethod()};message<-tryCatch(is.nan(structure(NaN,class="owned")),error=conditionMessage);identical(message,"default method not implemented for type \'list\'")})',
  },
  {
    group: "review-dispatch",
    name: "NextMethod second class keeps changed input",
    code: 'local({is.finite.first<-function(x){x<-c(Inf,1);NextMethod()};is.finite.second<-function(x){stopifnot(identical(x,c(Inf,1)));NextMethod()};identical(is.finite(structure(1,class=c("first","second"))),c(FALSE,TRUE))})',
  },
  {
    group: "review-dispatch",
    name: "method partial formal warning",
    code: 'local({old<-options(warnPartialMatchArgs=TRUE);on.exit(options(old));warnings<-character();is.finite.owned<-function(xx)TRUE;y<-withCallingHandlers(is.finite(x=structure(Inf,class="owned")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(y,warnings),list(TRUE,"partial argument match of \'x\' to \'xx\'"))})',
  },
  {
    group: "review-dispatch",
    name: "method altered structural attributes",
    code: 'local({is.finite.owned<-function(x){names(x)<-c("changed","other");attr(x,"note")<-"discard";NextMethod()};x<-structure(c(1,Inf),class="owned",names=c("a","b"));y<-is.finite(x);identical(y,c(changed=TRUE,other=FALSE))&&identical(names(x),c("a","b"))})',
  },
  {
    group: "review-dispatch",
    name: "attributed dims metadata",
    code: 'local({x<-structure(c(1,Inf),dim=2L,dimnames=structure(list(c("a","b")),names="axis",note="keep"));a<-attributes(x);identical(attributes(is.finite(x)),a)&&identical(attributes(is.infinite(x)),a)&&identical(attributes(is.nan(x)),a)})',
  },
] as const;
it.each(cases)("$name", async ({ code }) => {
  await runtime.reset();
  expect(await runtime.eval(code)).toBe(true);
});
it("bounds predicate work and recursive dispatch and recovers the session", async () => {
  const r = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 1024, maxSteps: 300, maxCallDepth: 1000 },
  });
  try {
    await r.assign("x", new Float64Array(500).fill(1));
    await expect(r.eval("is.finite(x)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await r.eval("length(x)")).toBe(500);
    await expect(
      r.eval('is.finite.owned<-function(x)is.finite(x);is.finite(structure(1,class="owned"))'),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await r.eval("sys.nframe()")).toBe(0);
    expect(await r.eval("1+1")).toBe(2);
  } finally {
    await r.dispose();
  }
});
