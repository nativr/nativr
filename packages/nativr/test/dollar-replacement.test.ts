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
// Independently authored GNU R 4.6.1 black-box observations; success-path errors escape.
const cases = [
  {
    name: "primitive metadata",
    code: 'identical(typeof(`$<-`),"special")&&is.primitive(`$<-`)&&is.null(args(`$<-`))',
  },
  {
    name: "literal member",
    code: "identical(`$<-`(list(a=1L),a,2L),list(a=2L))",
  },
  {
    name: "literal string",
    code: 'identical(`$<-`(list(a=1L),"a",2L),list(a=2L))',
  },
  {
    name: "identifier not evaluated",
    code: 'local({a<-"b";identical(`$<-`(list(a=1L),a,2L),list(a=2L))})',
  },
  {
    name: "unbound identifier name",
    code: "identical(`$<-`(list(a=1L),unbound,2L),list(a=1L,unbound=2L))",
  },
  {
    name: "computed name invalid",
    code: 'identical(err(`$<-`(list(a=1L),paste0("a"),2L)),"invalid subscript type \'language\'")',
  },
  {
    name: "quoted name invalid",
    code: "identical(err(`$<-`(list(a=1L),quote(a),2L)),\"invalid subscript type 'language'\")",
  },
  {
    name: "do.call symbol",
    code: "identical(do.call(`$<-`,list(list(a=1L),quote(a),2L)),list(a=2L))",
  },
  {
    name: "do.call character",
    code: 'identical(do.call(`$<-`,list(list(a=1L),"a",2L)),list(a=2L))',
  },
  {
    name: "do.call character empty",
    code: 'identical(err(do.call(`$<-`,list(list(a=1L),character(),2L))),"invalid subscript length")',
  },
  {
    name: "do.call character multiple",
    code: 'identical(err(do.call(`$<-`,list(list(a=1L),c("a","b"),2L))),"invalid subscript length")',
  },
  {
    name: "do.call character NA",
    code: 'identical(do.call(`$<-`,list(list(a=1L),NA_character_,2L)),structure(list(1L,2L),names=c("a","NA")))',
  },
  {
    name: "do.call logical invalid",
    code: "identical(err(do.call(`$<-`,list(list(a=1L),NA,2L))),\"invalid subscript type 'logical'\")",
  },
  {
    name: "do.call double invalid",
    code: "identical(err(do.call(`$<-`,list(list(a=1L),1,2L))),\"invalid subscript type 'double'\")",
  },
  {
    name: "do.call NULL invalid",
    code: "identical(err(do.call(`$<-`,list(list(a=1L),NULL,2L))),\"invalid subscript type 'NULL'\")",
  },
  {
    name: "empty string default invalid",
    code: 'identical(err(`$<-`(list(a=1L),"",2L)),"attempt to use zero-length variable name")',
  },
  {
    name: "default ignores tags",
    code: "identical(`$<-`(value=list(a=1L),x=a,name=2L),list(a=2L))",
  },
  {
    name: "default ignores unknown tags",
    code: "identical(`$<-`(u=list(a=1L),v=a,w=2L),list(a=2L))",
  },
  {
    name: "arity0",
    code: "identical(err(`$<-`()),\"0 arguments passed to '$<-' which requires 3\")",
  },
  {
    name: "arity1 singular",
    code: "identical(err(`$<-`(list(a=1L))),\"1 argument passed to '$<-' which requires 3\")",
  },
  {
    name: "arity2",
    code: "identical(err(`$<-`(list(a=1L),a)),\"2 arguments passed to '$<-' which requires 3\")",
  },
  {
    name: "arity4",
    code: "identical(err(`$<-`(list(a=1L),a,2L,3L)),\"4 arguments passed to '$<-' which requires 3\")",
  },
  {
    name: "missing target",
    code: 'identical(err(`$<-`(,a,2L)),"argument is missing, with no default")',
  },
  {
    name: "missing member appends unnamed",
    code: 'identical(`$<-`(list(a=1L),,2L),structure(list(1L,2L),names=c("a","")))',
  },
  {
    name: "missing replacement retained",
    code: "identical(`$<-`(list(a=1L),a,),alist(a=))",
  },
  {
    name: "arity before forces",
    code: 'local({events<-character();message<-err(`$<-`({events<-c(events,"x");1L},a,{events<-c(events,"v");2L},{events<-c(events,"extra");3L}));identical(list(events,message),list(character(),"4 arguments passed to \'$<-\' which requires 3"))})',
  },
  {
    name: "name syntax before forces",
    code: 'local({events<-character();message<-err(`$<-`({events<-c(events,"x");1L},{events<-c(events,"n");"a"},{events<-c(events,"v");2L}));identical(list(events,message),list(character(),"invalid subscript type \'language\'"))})',
  },
  {
    name: "default x before value",
    code: 'local({events<-character();ans<-`$<-`({events<-c(events,"x");list(a=1L)},a,{events<-c(events,"v");2L});identical(list(events,ans),list(c("x","v"),list(a=2L)))})',
  },
  {
    name: "empty name after forces",
    code: 'local({events<-character();message<-err(`$<-`({events<-c(events,"x");NULL},"",{events<-c(events,"v");2L}));identical(list(events,message),list(c("x","v"),"attempt to use zero-length variable name"))})',
  },
  {
    name: "NULL create",
    code: "identical(`$<-`(NULL,a,2L),list(a=2L))",
  },
  {
    name: "NULL delete",
    code: "is.null(`$<-`(NULL,a,NULL))",
  },
  {
    name: "exact replacement only",
    code: "identical(`$<-`(list(alpha=1L),al,2L),list(alpha=1L,al=2L))",
  },
  {
    name: "first duplicate replacement",
    code: "identical(`$<-`(list(a=1L,a=2L),a,3L),list(a=3L,a=2L))",
  },
  {
    name: "first duplicate delete",
    code: "identical(`$<-`(list(a=1L,a=2L,b=3L),a,NULL),list(a=2L,b=3L))",
  },
  {
    name: "absent delete unchanged",
    code: "identical(`$<-`(list(a=1L),b,NULL),list(a=1L))",
  },
  {
    name: "atomic coercion warning",
    code: 'local({messages<-character();ans<-withCallingHandlers(`$<-`(c(a=1L,b=2L),a,3L),warning=function(w){messages<<-c(messages,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(ans,messages),list(list(a=3L,b=2L),"Coercing LHS to a list"))})',
  },
  {
    name: "atomic coercion drops attrs",
    code: 'local({messages<-character();ans<-withCallingHandlers(`$<-`(structure(c(a=1L,b=2L),note="drop"),c,3L),warning=function(w){messages<<-c(messages,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(ans,messages),list(list(a=1L,b=2L,c=3L),"Coercing LHS to a list"))})',
  },
  {
    name: "pairlist replace",
    code: "identical(`$<-`(pairlist(a=1L,b=2L),a,3L),pairlist(a=3L,b=2L))",
  },
  {
    name: "pairlist append",
    code: "identical(`$<-`(pairlist(a=1L,b=2L),c,3L),pairlist(a=1L,b=2L,c=3L))",
  },
  {
    name: "pairlist delete",
    code: "identical(`$<-`(pairlist(a=1L,b=2L),a,NULL),pairlist(b=2L))",
  },
  {
    name: "language replace",
    code: "identical(`$<-`(quote(f(a=1L,b=2L)),a,3L),quote(f(a=3L,b=2L)))",
  },
  {
    name: "language append",
    code: "identical(`$<-`(quote(f(a=1L,b=2L)),c,3L),quote(f(a=1L,b=2L,c=3L)))",
  },
  {
    name: "language delete",
    code: "identical(`$<-`(quote(f(a=1L,b=2L)),a,NULL),quote(f(b=2L)))",
  },
  {
    name: "symbol target diagnostic",
    code: "identical(err(`$<-`(quote(x),a,3L)),\"object of type 'symbol' is not subsettable\")",
  },
  {
    name: "environment identity",
    code: "local({x<-new.env(parent=emptyenv());x$a<-1L;y<-`$<-`(x,a,3L);identical(x,y)&&identical(x$a,3L)})",
  },
  {
    name: "environment NULL retains binding",
    code: 'local({x<-new.env(parent=emptyenv());x$a<-1L;y<-`$<-`(x,a,NULL);identical(x,y)&&exists("a",x,inherits=FALSE)&&is.null(x$a)})',
  },
  {
    name: "list references and copy",
    code: "local({e<-new.env();x<-list(a=e);y<-`$<-`(x,b,e);identical(x,list(a=e))&&identical(y$a,e)&&identical(y$b,e)})",
  },
  {
    name: "visible default result",
    code: "identical(withVisible(`$<-`(list(a=1L),a,2L)),list(value=list(a=2L),visible=TRUE))",
  },
  {
    name: "S3 local method",
    code: 'local({`$<-.owned`<-function(x,name,value)list(class(x),name,value);identical(`$<-`(structure(list(a=1L),class="owned"),a,2L),list("owned","a",2L))})',
  },
  {
    name: "S3 visible method result",
    code: 'local({`$<-.owned`<-function(x,name,value)invisible(value);identical(withVisible(`$<-`(structure(list(a=1L),class="owned"),a,2L)),list(value=2L,visible=TRUE))})',
  },
  {
    name: "S3 value lazy",
    code: 'local({`$<-.owned`<-function(x,name,value)42L;identical(`$<-`(structure(list(a=1L),class="owned"),a,stop("value")),42L)})',
  },
  {
    name: "S3 force order",
    code: 'local({events<-character();`$<-.owned`<-function(x,name,value){events<<-c(events,"method");value};ans<-`$<-`({events<-c(events,"x");structure(list(a=1L),class="owned")},a,{events<-c(events,"value");2L});identical(list(events,ans),list(c("x","method","value"),2L))})',
  },
  {
    name: "S3 empty name allowed",
    code: 'local({`$<-.owned`<-function(x,name,value)name;identical(`$<-`(structure(list(a=1L),class="owned"),"",stop("value")),"")})',
  },
  {
    name: "S3 metadata",
    code: 'local({`$<-.owned`<-function(x,name,value)list(substitute(x),substitute(name),substitute(value),match.call(),.Generic,.Method,.Class,.Group);x<-structure(list(a=1L),class="owned");identical(`$<-`(x,a,1L+2L),list(quote(x),"a",quote(1L+2L),quote(`$<-.owned`(x=x,name=a,value=1L+2L)),"$<-","$<-.owned","owned",""))})',
  },
  {
    name: "S3 retained tags",
    code: 'local({`$<-.owned`<-function(x,name,value)list(x,name,value);x<-structure(list(a=1L),class="owned");identical(`$<-`(value=x,x=a,name=3L),list("a",3L,x))})',
  },
  {
    name: "S3 class default",
    code: 'local({`$<-.default`<-function(x,name,value)list(name,value);identical(`$<-`(structure(list(a=1L),class="owned"),a,2L),list("a",2L))})',
  },
  {
    name: "S3 plain bypasses default",
    code: "local({`$<-.default`<-function(x,name,value)42L;identical(`$<-`(list(a=1L),a,2L),list(a=2L))})",
  },
  {
    name: "S3 second class",
    code: 'local({`$<-.second`<-function(x,name,value)42L;identical(`$<-`(structure(list(a=1L),class=c("first","second")),a,2L),42L)})',
  },
  {
    name: "S3 NextMethod fallback",
    code: 'local({`$<-.owned`<-function(x,name,value)NextMethod();identical(`$<-`(structure(list(a=1L),class="owned"),a,2L),structure(list(a=2L),class="owned"))})',
  },
  {
    name: "S3 NextMethod reassign",
    code: 'local({`$<-.owned`<-function(x,name,value){name<-"b";value<-value+1L;NextMethod()};identical(`$<-`(structure(list(a=1L),class="owned"),a,2L),structure(list(a=1L,b=3L),class="owned"))})',
  },
  {
    name: "S3 NextMethod symbol",
    code: 'local({`$<-.owned`<-function(x,name,value){name<-quote(a);NextMethod()};identical(`$<-`(structure(list(a=1L),class="owned"),b,2L),structure(list(a=2L),class="owned"))})',
  },
  {
    name: "S3 NextMethod NA character",
    code: 'local({`$<-.owned`<-function(x,name,value){name<-NA_character_;NextMethod()};identical(`$<-`(structure(list(a=1L),class="owned"),a,2L),structure(list(a=1L,`NA`=2L),class="owned"))})',
  },
  {
    name: "S3 NextMethod multi name diagnostic",
    code: 'local({`$<-.owned`<-function(x,name,value){name<-c("a","b");NextMethod()};identical(err(`$<-`(structure(list(a=1L),class="owned"),a,2L)),"invalid subscript length")})',
  },
  {
    name: "S3 NextMethod NULL name diagnostic",
    code: 'local({`$<-.owned`<-function(x,name,value){name<-NULL;NextMethod()};identical(err(`$<-`(structure(list(a=1L),class="owned"),a,2L)),"invalid subscript type \'NULL\'")})',
  },
  {
    name: "S3 class environment",
    code: 'local({`$<-.owned`<-function(x,name,value)42L;x<-new.env(parent=emptyenv());class(x)<-"owned";y<-`$<-`(x,a,2L);identical(y,42L)&&!exists("a",x,inherits=FALSE)})',
  },
  {
    name: "S3 missing value",
    code: 'local({`$<-.owned`<-function(x,name,value)list(missing(name),missing(value),substitute(name));identical(`$<-`(structure(list(a=1L),class="owned"),a,),list(FALSE,TRUE,"a"))})',
  },
  {
    name: "S3 missing member empty character",
    code: 'local({`$<-.owned`<-function(x,name,value)list(missing(name),name);identical(`$<-`(structure(list(a=1L),class="owned"),,2L),list(FALSE,""))})',
  },
  {
    name: "S3 alias call metadata",
    code: 'local({`$<-.owned`<-function(x,name,value)match.call();f<-`$<-`;x<-structure(list(a=1L),class="owned");identical(f(x,a,2L),quote(`$<-.owned`(x=x,name=a,value=2L)))})',
  },
  {
    name: "S3 dots member spelling",
    code: 'local({`$<-.owned`<-function(x,name,value)name;identical(`$<-`(structure(list(a=1L),class="owned"),...,2L),"...")})',
  },
  {
    name: "missing member existing unnamed appends",
    code: 'identical(`$<-`(list(1L,a=2L,3L),,4L),structure(list(1L,2L,3L,4L),names=c("","a","","")))',
  },
  {
    name: "missing member deletion no-op",
    code: "local({x<-list(1L,a=2L,3L);identical(`$<-`(x,,NULL),x)})",
  },
  {
    name: "explicit empty member on unnamed errors",
    code: 'identical(err(`$<-`(list(1L,2L),"",3L)),"attempt to use zero-length variable name")',
  },
  {
    name: "missing member pairlist appends",
    code: 'local({x<-pairlist(1L,a=2L,3L);y<-`$<-`(x,,4L);identical(typeof(y),"pairlist")&&identical(length(y),4L)&&identical(as.list(y),structure(list(1L,2L,3L,4L),names=c("","a","","")))})',
  },
  {
    name: "missing member pairlist delete no-op",
    code: "local({x<-pairlist(1L,a=2L,3L);identical(`$<-`(x,,NULL),x)})",
  },
  {
    name: "missing member language appends",
    code: 'local({y<-`$<-`(quote(f(1L,a=2L,3L)),,4L);identical(typeof(y),"language")&&identical(as.list(y),structure(list(quote(f),1L,2L,3L,4L),names=c("","","a","","")))})',
  },
  {
    name: "missing member language delete no-op",
    code: "local({x<-quote(f(1L,a=2L,3L));identical(`$<-`(x,,NULL),x)})",
  },
  {
    name: "missing member environment empty binding",
    code: 'local({x<-new.env(parent=emptyenv());y<-`$<-`(x,,3L);identical(x,y)&&identical(ls(x,all.names=TRUE),"")})',
  },
  {
    name: "missing value environment binding",
    code: 'local({x<-new.env(parent=emptyenv());`$<-`(x,a,);exists("a",x,inherits=FALSE)&&identical(err(get("a",x)),"argument \\"a\\" is missing, with no default")})',
  },
  {
    name: "S3 missing name NextMethod empty diagnostic",
    code: 'local({`$<-.owned`<-function(x,name,value)NextMethod();identical(err(`$<-`(structure(list(a=1L),class="owned"),,2L)),"attempt to use zero-length variable name")})',
  },
  {
    name: "S3 missing name reassigned NextMethod empty diagnostic",
    code: 'local({`$<-.owned`<-function(x,name,value){name<-"";NextMethod()};identical(err(`$<-`(structure(list(a=1L),class="owned"),,2L)),"attempt to use zero-length variable name")})',
  },
  {
    name: "S3 missing value NextMethod preserved",
    code: 'local({`$<-.owned`<-function(x,name,value)NextMethod();identical(`$<-`(structure(list(a=1L),class="owned"),a,),structure(alist(a=),class="owned"))})',
  },
  {
    name: "S3 missing value NextMethod class forwarded",
    code: 'local({`$<-.first`<-function(x,name,value)NextMethod();`$<-.second`<-function(x,name,value)missing(value);identical(`$<-`(structure(list(a=1L),class=c("first","second")),a,),TRUE)})',
  },
  {
    name: "S3 missing value reassigned NextMethod",
    code: 'local({`$<-.owned`<-function(x,name,value){value<-3L;NextMethod()};identical(`$<-`(structure(list(a=1L),class="owned"),a,),structure(list(a=3L),class="owned"))})',
  },
  {
    name: "S3 missing target no method",
    code: 'local({called<-FALSE;`$<-.owned`<-function(x,name,value){called<<-TRUE;42L};message<-err(`$<-`(,a,2L));identical(list(called,message),list(FALSE,"argument is missing, with no default"))})',
  },
  {
    name: "pairlist dims append retained",
    code: 'local({x<-structure(pairlist(a=1L,b=2L),dim=c(1L,2L),note="keep");y<-`$<-`(x,c,3L);identical(attributes(y),list(names=c("a","b","c"),dim=c(1L,2L),note="keep"))})',
  },
  {
    name: "pairlist dims delete retained",
    code: 'local({x<-structure(pairlist(a=1L,b=2L),dim=c(1L,2L),note="keep");y<-`$<-`(x,a,NULL);identical(attributes(y),list(names="b",dim=c(1L,2L),note="keep"))})',
  },
  {
    name: "pairlist last deletion NULL",
    code: "identical(`$<-`(pairlist(a=1L),a,NULL),NULL)",
  },
  {
    name: "list dims append removed",
    code: 'local({x<-structure(as.list(1:4),dim=c(2L,2L),dimnames=list(c("a","b"),c("c","d")),note="keep");y<-`$<-`(x,e,5L);identical(y,structure(list(1L,2L,3L,4L,e=5L),note="keep"))})',
  },
  {
    name: "list dims deletion removed",
    code: 'local({x<-structure(as.list(1:4),names=c("a","b","c","d"),dim=c(2L,2L),dimnames=list(c("a","b"),c("c","d")),note="keep");y<-`$<-`(x,a,NULL);identical(y,structure(list(b=2L,c=3L,d=4L),note="keep"))})',
  },
  {
    name: "list dims replacement preserved",
    code: 'local({x<-structure(as.list(1:4),names=c("a","b","c","d"),dim=c(2L,2L),dimnames=list(c("a","b"),c("c","d")),note="keep");y<-`$<-`(x,a,5L);identical(y,structure(list(a=5L,b=2L,c=3L,d=4L),dim=c(2L,2L),dimnames=list(c("a","b"),c("c","d")),note="keep"))})',
  },
  {
    name: "expression plain append list no warning",
    code: 'local({messages<-character();ans<-withCallingHandlers(`$<-`(expression(1L,2L),c,3L),warning=function(w){messages<<-c(messages,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(ans,messages),list(list(1L,2L,c=3L),character()))})',
  },
  {
    name: "expression plain missing delete unchanged",
    code: "local({x<-expression(1L,2L);identical(`$<-`(x,,NULL),x)})",
  },
] as const;
it.each(cases)("$name", async ({ code }) => {
  await runtime.reset();
  expect(
    await runtime.eval(
      "local({" + "err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);" + code + "})",
    ),
  ).toBe(true);
});
it("bounds member growth and recursive dispatch and recovers the session", async () => {
  const r = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 64, maxSteps: 2500, maxCallDepth: 1000 },
  });
  try {
    await r.eval("x<-as.list(seq_len(64))");
    await expect(r.eval("`$<-`(x,new,1L)")).rejects.toMatchObject({ code: "NRL4002" });
    expect(await r.eval("length(x)")).toBe(64);
    await expect(
      r.eval(
        '`$<-.owned`<-function(x,name,value)`$<-`(x,name,value);`$<-`(structure(list(),class="owned"),a,1L)',
      ),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await r.eval("sys.nframe()")).toBe(0);
    expect(await r.eval("1+1")).toBe(2);
  } finally {
    await r.dispose();
  }
});
