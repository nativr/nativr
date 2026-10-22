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

// Independently authored observations of values, metadata and conditions, never oracle bodies.
const cases = [
  [
    "logical",
    "exact logical spellings and missing values",
    `x<-c("T","TRUE","True","true","F","FALSE","False","false","tRuE"," TRUE ","t","f",NA_character_);identical(as.logical(x),c(rep(TRUE,4),rep(FALSE,4),rep(NA,5)))`,
  ],
  [
    "logical",
    "atomic conversion drops container attributes",
    `x<-structure(c(0,1,NA_real_,NaN,Inf),names=letters[1:5],note="owned");identical(as.logical(x),c(FALSE,TRUE,NA,NA,TRUE))&&is.null(attributes(as.logical(x)))`,
  ],
  [
    "logical",
    "empty and scalar list coercion",
    `identical(as.logical(NULL),logical())&&identical(as.logical(list()),logical())&&identical(as.logical(list(TRUE,0L,"False",logical(),list(1L))),c(TRUE,FALSE,FALSE,NA,NA))`,
  ],
  [
    "logical",
    "list errors distinguish non scalar and non vector objects",
    `items<-list(NULL,1:2,quote(x),new.env(),function()1L,quote(f()),pairlist(a=1L));all(vapply(items,function(x)identical(tryCatch(as.logical(list(x)),error=conditionMessage),"'list' object cannot be coerced to type 'logical'"),logical(1)))`,
  ],
  [
    "logical",
    "expression conversion rejects even an empty expression",
    `all(vapply(list(expression(),expression(TRUE)),function(x)identical(tryCatch(as.logical(x),error=conditionMessage),"'list' object cannot be coerced to type 'logical'"),logical(1)))`,
  ],
  [
    "logical",
    "pairlist values and factor labels",
    `identical(as.logical(pairlist(a=TRUE,b="False",c=logical())),c(TRUE,FALSE,NA))&&identical(as.logical(factor(c("FALSE","TRUE",NA))),c(FALSE,TRUE,NA))&&identical(as.logical(list(factor("FALSE"))),TRUE)`,
  ],
  [
    "logical-dispatch",
    "methods receive extra arguments",
    `as.logical.owned<-function(x,offset,...)offset;identical(as.logical(structure(1L,class="owned"),offset=7L),7L)`,
  ],
  [
    "logical-dispatch",
    "factor method can override default labels",
    `as.logical.factor<-function(x,...)"method";identical(as.logical(factor("FALSE")),"method")`,
  ],
  [
    "logical-forcing",
    "unused primitive arguments are forced in source order",
    `seen<-character();v<-as.logical({seen<-c(seen,"x");0L},{seen<-c(seen,"extra");1L});identical(v,FALSE)&&identical(seen,c("x","extra"))&&identical(tryCatch(as.logical(TRUE,stop("extra")),error=conditionMessage),"extra")`,
  ],
  [
    "logical-forcing",
    "empty actuals and positional names",
    `identical(as.logical(),logical())&&identical(tryCatch(as.logical(x=),error=conditionMessage),"argument 1 is empty")&&identical(tryCatch(as.logical(y=TRUE),error=conditionMessage),"supplied argument name 'y' does not match 'x'")`,
  ],
  [
    "logical-flags",
    "conditions use the same exact spellings",
    `identical(if("True")1L else 0L,1L)&&identical(if("False")1L else 0L,0L)&&identical(tryCatch(if("tRuE")1L,error=conditionMessage),"argument is not interpretable as logical")`,
  ],
  [
    "logical-flags",
    "recursive flag validated for list input only",
    `identical(anyNA(1,recursive="tRuE"),FALSE)&&identical(anyNA(list(list(NA)),recursive="True"),TRUE)&&identical(tryCatch(anyNA(list(NA),recursive="tRuE"),error=conditionMessage),"NA in coercion to boolean")`,
  ],
  [
    "logical-flags",
    "boolean flags read factor codes",
    `identical(sum(c(1,NA),na.rm=factor("FALSE")),1)&&identical(anyNA(list(list(NA)),recursive=factor("FALSE")),TRUE)`,
  ],
  [
    "logical-flags",
    "type conversion keeps its narrower logical grammar",
    `identical(type.convert(c("True","False"),as.is=TRUE),c("True","False"))&&identical(type.convert(c("T","FALSE"),as.is=TRUE),c(TRUE,FALSE))`,
  ],
  [
    "metadata",
    "mode and conversion closure signatures",
    `n<-c("mode","storage.mode","as.name","as.symbol");all(vapply(n,function(s){f<-get(s);typeof(f)=="closure"&&identical(names(formals(f)),"x")},logical(1)))&&identical(names(formals(get("mode<-"))),c("x","value"))&&typeof(get("storage.mode<-"))=="builtin"&&identical(names(formals(args(get("storage.mode<-")))),c("x","value"))`,
  ],
  [
    "metadata",
    "single and function generic signatures",
    `n<-c("as.single","as.single.default","as.function");all(vapply(n,function(s){f<-get(s);typeof(f)=="closure"&&identical(names(formals(f)),c("x","..."))},logical(1)))&&identical(names(formals(as.function.default)),c("x","envir","..."))&&identical(formals(as.function.default)$envir,quote(parent.frame()))`,
  ],
  [
    "mode-read",
    "mode and storage mode distinguish integer and language",
    `x<-list(1L,1,NULL,quote(x),quote(f()),expression(x),pairlist(a=1),function()1,get("if"));identical(vapply(x,mode,""),c("numeric","numeric","NULL","name","call","expression","pairlist","function","function"))&&identical(vapply(x,storage.mode,""),c("integer","double","NULL","symbol","language","expression","pairlist","function","function"))`,
  ],
  [
    "mode-read",
    "getters ignore class methods",
    `mode.owned<-function(x)"bad";storage.mode.owned<-mode.owned;x<-structure(1L,class="owned");identical(mode(x),"numeric")&&identical(storage.mode(x),"integer")`,
  ],
  [
    "storage-write",
    "storage conversion preserves attributes",
    `x<-structure(c("True","False",NA_character_),names=c("a","b","c"),note="owned");a<-attributes(x);storage.mode(x)<-"logical";identical(unname(unclass(x)),structure(c(TRUE,FALSE,NA),note="owned"))&&identical(attributes(x),a)`,
  ],
  [
    "storage-write",
    "numeric mode aliases double",
    `x<-c(a=1L,b=2L);storage.mode(x)<-"numeric";identical(x,c(a=1,b=2))&&identical(storage.mode(x),"double")`,
  ],
  [
    "storage-write",
    "list pairlist and expression conversion",
    `x<-c(a=1L,b=2L);storage.mode(x)<-"list";y<-1:2;storage.mode(y)<-"expression";z<-1:2;storage.mode(z)<-"pairlist";identical(x,list(a=1L,b=2L))&&identical(y,expression(1L,2L))&&identical(z,pairlist(1L,2L))`,
  ],
  [
    "storage-write",
    "same type preserves factor and environment identity",
    `x<-factor(c("a","b"));old<-x;storage.mode(x)<-"integer";e<-new.env();oldE<-e;storage.mode(e)<-"environment";identical(x,old)&&identical(e,oldE)&&identical(tryCatch({storage.mode(x)<-"character"},error=conditionMessage),"invalid to change the storage mode of a factor")`,
  ],
  [
    "storage-write",
    "replacement bypasses S3 coercion methods",
    `as.logical.owned<-function(x,...)stop("method");x<-structure(c(0L,1L),class="owned");storage.mode(x)<-"logical";identical(x,structure(c(FALSE,TRUE),class="owned"))`,
  ],
  [
    "storage-input",
    "first character selects storage type",
    `x<-1L;storage.mode(x)<-c("double","logical");identical(x,1)&&identical(tryCatch(\`storage.mode<-\`(1L,NA_character_),error=conditionMessage),"'value' must be non-null character string")&&identical(tryCatch(\`storage.mode<-\`(1L,1L),error=conditionMessage),"'value' must be non-null character string")`,
  ],
  [
    "storage-input",
    "defunct and unknown modes retain diagnostics",
    `identical(tryCatch(\`storage.mode<-\`(1,"real"),error=conditionMessage),"use of 'real' is defunct: use 'double' instead")&&identical(tryCatch(\`storage.mode<-\`(1,"single"),error=conditionMessage),"use of 'single' is defunct: use mode<- instead")&&identical(tryCatch(\`storage.mode<-\`(1,"owned"),error=conditionMessage),"invalid value")`,
  ],
  [
    "storage-forcing",
    "source order precedes positional tag validation",
    `valid<-\`storage.mode<-\`(1L,"double");seen<-character();msg<-tryCatch(\`storage.mode<-\`(value={seen<-c(seen,"value");"double"},x={seen<-c(seen,"x");1L}),error=conditionMessage);identical(valid,1)&&identical(seen,c("value","x"))&&identical(msg,"supplied argument name 'value' does not match 'x'")`,
  ],
  [
    "storage-forcing",
    "extra arguments are forced before arity",
    `identical(tryCatch(\`storage.mode<-\`(1L,"double",stop("extra")),error=conditionMessage),"extra")&&identical(tryCatch(\`storage.mode<-\`(1L,"double",TRUE),error=conditionMessage),"3 arguments passed to 'storage.mode<-' which requires 2")`,
  ],
  [
    "mode-write",
    "mode conversion preserves original attributes",
    `x<-structure(c(0L,1L),names=c("a","b"),note="owned");a<-attributes(x);mode(x)<-"logical";identical(attributes(x),a)&&identical(as.logical(x),c(FALSE,TRUE))`,
  ],
  [
    "mode-write",
    "caller converter sees attributes and result retains originals",
    `seen<-NULL;as.owned<-function(x){seen<<-attributes(x);structure(c(7L,8L),note="new")};x<-structure(c(1L,2L),note="original");a<-attributes(x);mode(x)<-"owned";identical(seen,a)&&identical(x,structure(c(7L,8L),note="original"))`,
  ],
  [
    "mode-write",
    "same storage type skips converter",
    `as.integer<-function(x)stop("called");x<-1L;mode(x)<-"integer";identical(x,1L)`,
  ],
  [
    "mode-write",
    "numeric selects caller as.numeric",
    `as.numeric<-function(x)7L;as.double<-function(x)stop("wrong converter");x<-1L;mode(x)<-"numeric";identical(x,7L)`,
  ],
  [
    "mode-write",
    "library conversion does not see caller local S3 method",
    `as.logical.owned<-function(x,...)stop("method");x<-structure(1L,class="owned");mode(x)<-"logical";identical(x,structure(TRUE,class="owned"))`,
  ],
  [
    "mode-write",
    "failed replacement leaves original target",
    `x<-1L;msg<-tryCatch({mode(x)<-"ownedAbsent"},error=conditionMessage);identical(x,1L)&&identical(msg,"object 'as.ownedAbsent' of mode 'function' was not found")`,
  ],
  [
    "mode-input",
    "invalid mode length and missing values",
    `identical(tryCatch(\`mode<-\`(1L,character()),error=conditionMessage),"argument is of length zero")&&identical(tryCatch(\`mode<-\`(1L,c("double","logical")),error=conditionMessage),"the condition has length > 1")&&identical(tryCatch(\`mode<-\`(1L,NA_character_),error=conditionMessage),"missing value where TRUE/FALSE needed")`,
  ],
  [
    "mode-input",
    "closure tags reorder and x is forced before value",
    `seen<-character();x<-\`mode<-\`(value={seen<-c(seen,"value");"double"},x={seen<-c(seen,"x");1L});identical(x,1)&&identical(seen,c("x","value"))`,
  ],
  [
    "single",
    "single is an unrounded double with marker",
    `x<-structure(c(1.23456789012345,NA_real_),note="old");v<-as.single(x);identical(as.double(v),as.double(x))&&identical(attributes(v),list(Csingle=TRUE))&&identical(as.single.default(1L),structure(1,Csingle=TRUE))`,
  ],
  [
    "single",
    "single dispatch and default bypass",
    `as.single.owned<-function(x,...)"method";x<-structure(1L,class="owned");identical(as.single(x),"method")&&identical(as.single.default(x),structure(1,Csingle=TRUE))`,
  ],
  [
    "single-mode",
    "mode single preserves original marker",
    `x<-structure(1L,Csingle=FALSE,note="owned");mode(x)<-"single";identical(x,structure(1,Csingle=FALSE,note="owned"))`,
  ],
  [
    "single-mode",
    "custom single converter gets marker",
    `as.single<-function(x)"owned";x<-1L;mode(x)<-"single";identical(x,structure("owned",Csingle=TRUE))`,
  ],
  [
    "symbol",
    "symbols take the first atomic value without dispatch",
    `as.character.owned<-function(x,...)"wrong";identical(as.name(structure(1L,class="owned")),quote(\`1\`))&&identical(as.symbol(c("a","b")),quote(a))&&identical(as.name(NA_character_),quote(\`NA\`))&&identical(as.name(as.raw(10L)),quote(\`0a\`))`,
  ],
  [
    "symbol",
    "symbol identity and constructor diagnostics",
    `s<-quote(x);identical(as.name(s),s)&&identical(tryCatch(as.name(""),error=conditionMessage),"attempt to use zero-length variable name")&&identical(tryCatch(as.name(character()),error=conditionMessage),"invalid data of mode 'character' (too short)")&&identical(tryCatch(as.name(list("x")),error=conditionMessage),"invalid type/length (symbol/1) in vector allocation")`,
  ],
  [
    "symbol-mode",
    "mode and storage mode symbol conversion",
    `x<-1L;mode(x)<-"name";y<-"owned";storage.mode(y)<-"symbol";identical(x,quote(\`1\`))&&identical(y,quote(owned))`,
  ],
  [
    "symbol-mode",
    "mode symbol rejects original attributes",
    `x<-structure("owned",note="original");identical(tryCatch({mode(x)<-"name"},error=conditionMessage),"cannot set an attribute on a 'symbol'")&&identical(attr(x,"note"),"original")`,
  ],
  [
    "function",
    "constructed function captures caller and lazy defaults",
    `a<-4L;f<-as.function(alist(x=,y=a,x+y));identical(environment(f),environment())&&identical(f(3L),7L)&&identical(names(formals(f)),c("x","y"))&&identical(formals(f)$y,quote(a))`,
  ],
  [
    "function",
    "explicit environment and ellipsis",
    `e<-new.env();e$a<-9L;f<-as.function(alist(x=2L,a+x),envir=e);g<-as.function(alist(...=,list(...)));v<-list(2L,1L);names(v)<-c(NA_character_,"");h<-as.function(v);identical(environment(f),e)&&identical(f(),11L)&&identical(g(a=1L),list(a=1L))&&identical(names(formals(h)),"NA")&&identical(h(),1L)`,
  ],
  [
    "function",
    "function and primitive identity ignore environment",
    `f<-function()1L;identical(as.function(f,envir=stop("unused")),f)&&identical(as.function.default(sum,envir=NULL),sum)`,
  ],
  [
    "function",
    "symbol expression and list bodies remain owned objects",
    `x<-8L;identical(as.function(list(quote(x)))(),8L)&&identical(as.function(list(expression(x)))(),expression(x))&&identical(as.function(list(list(a=1L)))(),list(a=1L))`,
  ],
  [
    "function",
    "function generic dispatch and default bypass",
    `as.function.owned<-function(x,...)function()9L;x<-structure(list(1L),class="owned");identical(as.function(x)(),9L)&&identical(as.function.default(x)(),1L)`,
  ],
  [
    "function-errors",
    "list formal environment and body validation",
    `identical(tryCatch(as.function(1L),error=conditionMessage),"list argument expected")&&identical(tryCatch(as.function(list()),error=conditionMessage),"argument must have length at least 1")&&identical(tryCatch(as.function(list(1L,quote(x))),error=conditionMessage),'invalid formal argument list for "as.function"')&&identical(tryCatch(as.function(list(1L),envir=NULL),error=conditionMessage),"use of NULL environment is defunct")&&identical(tryCatch(as.function(list(new.env())),error=conditionMessage),"invalid body for function")`,
  ],
  [
    "function-errors",
    "environment forcing precedes list validation",
    `identical(as.function.default(list(2L))(),2L)&&identical(tryCatch(as.function.default(1L,envir=stop("environment")),error=conditionMessage),"environment")&&identical(tryCatch(as.function.default(1L,envir=NULL),error=conditionMessage),"list argument expected")&&identical(as.function(list(1L),unused=stop("unused"))(),1L)`,
  ],
  [
    "function-mode",
    "mode function uses shared constructor",
    `x<-list(1L);mode(x)<-"function";identical(x(),1L)&&is.null(formals(x))`,
  ],
  [
    "function-mode",
    "mode function validates original names before assignment",
    `x<-alist(a=2L,a+1L);old<-x;msg<-tryCatch({mode(x)<-"function"},error=conditionMessage);identical(msg,"names() applied to a non-vector")&&identical(x,old)`,
  ],
  [
    "call",
    "as.call preserves existing call and invalid input diagnostics",
    `x<-quote(sum(1L,2L));identical(as.call(x),x)&&identical(eval(as.call(x)),3L)&&identical(tryCatch(as.call(list()),error=conditionMessage),"invalid length 0 argument")&&identical(tryCatch(as.call(1L),error=conditionMessage),"invalid argument list")`,
  ],
] as const;

it.each(cases)("%s: %s", async (_group, _name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("reports attributed symbol mode results as unsupported", async () => {
  await expect(
    runtime.eval('x<-structure("owned",note="original");storage.mode(x)<-"symbol"'),
  ).rejects.toMatchObject({ code: "NRU6250" });
  expect(await runtime.eval('identical(x,structure("owned",note="original"))')).toBe(true);
});
// Independently verified GNU R 4.6.1 follow-up for the expression attribute carrier.
it("retains metadata when storage.mode converts an owned character value to expression", async () => {
  expect(
    await runtime.eval(
      'local({observed<-local({x<-structure("owned",note="original");before<-x;storage.mode(x)<-"expression";list(value=x,original=before,kind=typeof(x),note=attr(x,"note"))});identical(observed,list(value=structure(expression("owned"),note="original"),original=structure("owned",note="original"),kind="expression",note="original"))&&identical(names(attributes(observed$value)),"note")})',
    ),
  ).toBe(true);
});
