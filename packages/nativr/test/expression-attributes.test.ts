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
// 45 byte-exact independently authored GNU R 4.6.1 assertions: 42 original passing rows and 3 separate conversion controls.
// Shared attributes<- and public expression metadata round-trip remain outside this bounded acceptance.
const cases = [
  {
    id: "empty-expression",
    group: "constructor",
    code: 'local({x<-expression();is.expression(x)&&identical(typeof(x),"expression")&&identical(length(x),0L)&&is.null(attributes(x))})',
  },
  {
    id: "ordinary-cells",
    group: "constructor",
    code: "local({x<-expression(1L,owned,owned(2L));identical(x[[1L]],1L)&&identical(x[[2L]],quote(owned))&&identical(x[[3L]],quote(owned(2L)))&&is.null(names(x))})",
  },
  {
    id: "named-cells-not-assignments",
    group: "constructor",
    code: 'local({x<-expression(a=1L,b=owned+2L);identical(names(x),c("a","b"))&&identical(x[[1L]],1L)&&identical(x[[2L]],quote(owned+2L))})',
  },
  {
    id: "mixed-named-unnamed-cells",
    group: "constructor",
    code: 'local({x<-expression(1L,a=2L,3L);identical(names(x),c("","a",""))&&identical(as.list(x),list(1L,a=2L,3L))})',
  },
  {
    id: "duplicate-constructor-names",
    group: "constructor",
    code: 'local({x<-expression(a=1L,a=2L);identical(names(x),c("a","a"))&&identical(x[["a"]],1L)&&identical(x[[2L]],2L)})',
  },
  {
    id: "non-syntactic-constructor-names",
    group: "constructor",
    code: 'local({x<-expression(`owned name`=1L,`if`=2L);identical(names(x),c("owned name","if"))&&identical(x[[1L]],1L)&&identical(x[[2L]],2L)})',
  },
  {
    id: "constructor-does-not-force",
    group: "evaluation",
    code: 'local({events<-0L;x<-expression(a={events<-events+1L;3L},b=stop("owned unforced"));identical(events,0L)&&identical(names(x),c("a","b"))&&identical(x[[1L]],quote({events<-events+1L;3L}))})',
  },
  {
    id: "names-replacement-copy",
    group: "names",
    code: 'local({x<-expression(1L,2L);y<-x;names(y)<-c("left","right");is.null(names(x))&&identical(names(y),c("left","right"))&&identical(y[[1L]],1L)})',
  },
  {
    id: "missing-and-empty-names",
    group: "names",
    code: 'local({x<-expression(1L,2L,3L);names(x)<-c("a",NA_character_,"");identical(names(x),c("a",NA_character_,""))&&identical(x[[2L]],2L)})',
  },
  {
    id: "short-names-pad-missing",
    group: "names",
    code: 'local({x<-expression(1L,2L,3L);names(x)<-"a";identical(names(x),c("a",NA_character_,NA_character_))})',
  },
  {
    id: "empty-names-pad-missing",
    group: "names",
    code: "local({x<-expression(1L,2L);names(x)<-character();identical(names(x),c(NA_character_,NA_character_))})",
  },
  {
    id: "numeric-names-coercion",
    group: "names",
    code: 'local({x<-expression(1L,2L);names(x)<-c(7L,8L);identical(names(x),c("7","8"))})',
  },
  {
    id: "remove-names",
    group: "names",
    code: 'local({x<-expression(a=1L);attr(x,"note")<-"keep";names(x)<-NULL;is.null(names(x))&&identical(attr(x,"note"),"keep")&&identical(x[[1L]],1L)})',
  },
  {
    id: "overlong-names-error-nonmutation",
    group: "names",
    code: 'local({x<-expression(a=1L);before<-x;error<-tryCatch({names(x)<-c("a","b");NULL},error=function(e)e);inherits(error,"error")&&identical(x,before)})',
  },
  {
    id: "arbitrary-attributes",
    group: "attributes",
    code: 'local({x<-expression(a=1L);attr(x,"note")<-c("owned","metadata");attr(x,"count")<-2L;identical(names(attributes(x)),c("names","note","count"))&&identical(attr(x,"note"),c("owned","metadata"))&&identical(attr(x,"count"),2L)})',
  },
  {
    id: "environment-attribute-reference",
    group: "attributes",
    code: 'local({e<-new.env(parent=emptyenv());e$token<-1L;x<-expression(a=1L);attr(x,"owner")<-e;y<-x;attr(y,"note")<-"new";e$token<-2L;identical(attr(x,"owner"),e)&&identical(attr(y,"owner"),e)&&identical(attr(y,"owner")$token,2L)&&is.null(attr(x,"note"))})',
  },
  {
    id: "attribute-replacement-copy",
    group: "attributes",
    code: 'local({x<-expression(a=1L);attr(x,"note")<-"old";y<-x;attr(y,"note")<-"new";identical(attr(x,"note"),"old")&&identical(attr(y,"note"),"new")&&!identical(x,y)&&identical(x[[1L]],y[[1L]])})',
  },
  {
    id: "attribute-partial-lookup",
    group: "attributes",
    code: 'local({x<-expression(1L);attr(x,"ownedNote")<-7L;identical(attr(x,"owned"),7L)&&is.null(attr(x,"owned",exact=TRUE))})',
  },
  {
    id: "class-preserves-expression-storage",
    group: "attributes",
    code: 'local({x<-expression(a=1L);class(x)<-"owned";is.expression(x)&&identical(typeof(x),"expression")&&identical(class(x),"owned")&&identical(names(x),"a")&&identical(unclass(x),expression(a=1L))})',
  },
  {
    id: "dimension-attribute-storage",
    group: "attributes",
    code: 'local({x<-expression(1L,2L,3L,4L);dim(x)<-c(2L,2L);dimnames(x)<-list(c("r1","r2"),c("c1","c2"));is.expression(x)&&is.matrix(x)&&identical(dim(x),c(2L,2L))&&identical(x[[2L]],2L)})',
  },
  {
    id: "single-bracket-reorders-names",
    group: "subset",
    code: 'local({x<-expression(a=1L,b=owned,c=owned(3L));y<-x[c(3L,1L,1L)];is.expression(y)&&identical(names(y),c("c","a","a"))&&identical(y[[1L]],quote(owned(3L)))&&identical(y[[3L]],1L)&&identical(names(x),c("a","b","c"))})',
  },
  {
    id: "subset-drops-arbitrary-attributes",
    group: "subset",
    code: 'local({x<-expression(a=1L,b=2L);attr(x,"note")<-"owned";y<-x[2:1];identical(names(attributes(y)),"names")&&identical(names(y),c("b","a"))&&identical(attr(x,"note"),"owned")})',
  },
  {
    id: "empty-subset-typed",
    group: "subset",
    code: "local({x<-expression(a=1L);y<-x[integer()];is.expression(y)&&identical(length(y),0L)&&identical(names(y),character())})",
  },
  {
    id: "missing-index-null-cell",
    group: "subset",
    code: 'local({x<-expression(a=1L,b=2L);y<-x[c(NA_integer_,1L)];is.expression(y)&&is.null(y[[1L]])&&identical(y[[2L]],1L)&&identical(names(y),c(NA_character_,"a"))})',
  },
  {
    id: "double-bracket-name-exact",
    group: "subset",
    code: 'local({x<-expression(alpha=1L,beta=2L);identical(x[["alpha"]],1L)&&is.null(x[["al"]])&&identical(x[["al",exact=FALSE]],1L)})',
  },
  {
    id: "double-bracket-replacement-copy",
    group: "replacement",
    code: 'local({x<-expression(a=1L,b=2L);attr(x,"note")<-"owned";y<-x;y[[1L]]<-quote(owned+3L);identical(x[[1L]],1L)&&identical(y[[1L]],quote(owned+3L))&&identical(names(y),c("a","b"))&&identical(attr(y,"note"),"owned")})',
  },
  {
    id: "bracket-replacement-expression",
    group: "replacement",
    code: "local({x<-expression(a=1L,b=2L);y<-x;y[2L]<-expression(owned+3L);identical(y,expression(a=1L,b=owned+3L))&&identical(x,expression(a=1L,b=2L))})",
  },
  {
    id: "double-bracket-null-deletion",
    group: "replacement",
    code: "local({x<-expression(a=1L,b=2L);x[[1L]]<-NULL;identical(x,expression(b=2L))})",
  },
  {
    id: "as-list-retains-names",
    group: "conversion",
    code: "local({x<-expression(a=1L,b=owned+2L);y<-as.list(x);is.list(y)&&identical(y,list(a=1L,b=quote(owned+2L)))&&identical(x,expression(a=1L,b=owned+2L))})",
  },
  {
    id: "as-expression-same-attributed-value",
    group: "conversion",
    code: 'local({e<-new.env(parent=emptyenv());x<-expression(a=1L);attr(x,"owner")<-e;attr(x,"note")<-"owned";y<-as.expression(x);identical(x,y)&&identical(attr(y,"owner"),e)})',
  },
  {
    id: "list-to-expression-names-reference",
    group: "conversion",
    code: "local({e<-new.env(parent=emptyenv());e$token<-7L;f<-function(x)x+1L;x<-list(env=e,fn=f,call=quote(owned(1L)));y<-as.expression(x);is.expression(y)&&identical(names(y),names(x))&&identical(y[[1L]],e)&&identical(y[[2L]],f)&&identical(y[[3L]],quote(owned(1L)))})",
  },
  {
    id: "list-cell-attributes-preserved",
    group: "conversion",
    code: 'local({v<-structure(1L,note="cell");y<-as.expression(list(a=v));identical(y[[1L]],v)&&identical(attr(y[[1L]],"note"),"cell")&&identical(names(y),"a")})',
  },
  {
    id: "unlist-expression-input-unchanged",
    group: "unlist",
    code: 'local({x<-expression(a=1L,b=owned+2L);attr(x,"note")<-"keep";identical(unlist(x),x)})',
  },
  {
    id: "unlist-named-expression-in-list",
    group: "unlist",
    code: 'local({f<-function(x)x;y<-unlist(list(outer=expression(a=1L,b=2L),f=f));is.list(y)&&identical(names(y),c("outer.a","outer.b","f"))&&identical(y[[1L]],1L)&&identical(y[[2L]],2L)&&identical(y[[3L]],f)})',
  },
  {
    id: "unlist-expression-atomic-result",
    group: "unlist",
    code: "local({y<-unlist(list(outer=expression(a=1L,b=2L)));identical(y,c(outer.a=1L,outer.b=2L))})",
  },
  {
    id: "unlist-no-names-preserves-reference",
    group: "unlist",
    code: "local({e<-new.env(parent=emptyenv());x<-as.expression(list(env=e,value=2L));y<-unlist(list(outer=x),use.names=FALSE);is.list(y)&&is.null(names(y))&&identical(y[[1L]],e)&&identical(y[[2L]],2L)})",
  },
  {
    id: "named-expression-eval-no-name-assignment",
    group: "evaluation",
    code: 'local({e<-new.env(parent=baseenv());e$owned<-10L;x<-expression(a=owned+1L,b=owned+2L);v<-eval(x,e);identical(v,12L)&&!exists("a",e,inherits=FALSE)&&!exists("b",e,inherits=FALSE)&&identical(e$owned,10L)})',
  },
  {
    id: "eval-sideeffects-once-in-order",
    group: "evaluation",
    code: 'local({e<-new.env(parent=baseenv());e$events<-integer();x<-expression(first={events<-c(events,1L);5L},second={events<-c(events,2L);9L});v<-eval(x,e);identical(v,9L)&&identical(e$events,c(1L,2L))&&!exists("first",e,inherits=FALSE)})',
  },
  {
    id: "eval-final-invisibility",
    group: "evaluation",
    code: "local({x<-expression(a=1L,b=invisible(2L));v<-withVisible(eval(x));identical(v,list(value=2L,visible=FALSE))})",
  },
  {
    id: "print-named-expression",
    group: "display",
    code: 'local({x<-expression(a=1L,b=owned+2L);identical(capture.output(print(x)),"expression(a = 1L, b = owned + 2L)")&&identical(names(x),c("a","b"))})',
  },
  {
    id: "print-invisible-expression-return",
    group: "display",
    code: 'local({x<-expression(a=1L);out<-capture.output(v<-withVisible(print(x)));identical(out,"expression(a = 1L)")&&identical(v$value,x)&&identical(v$visible,FALSE)})',
  },
  {
    id: "deparse-named-expression",
    group: "display",
    code: 'identical(deparse(expression(a=1L,b=owned+2L)),"expression(a = 1L, b = owned + 2L)")',
  },
  {
    id: "as-list-preserves-attributes-and-reference",
    group: "conversion",
    code: 'local({e<-new.env(parent=emptyenv());x<-expression(a=1L);attr(x,"note")<-"owned";attr(x,"owner")<-e;y<-as.list(x);attr(y,"note")<-"changed";identical(names(attributes(y)),c("names","note","owner"))&&identical(names(y),"a")&&identical(y[[1L]],1L)&&identical(attr(y,"owner"),e)&&identical(attr(x,"note"),"owned")})',
  },
  {
    id: "atomic-as-expression-strips-all-attributes",
    group: "conversion",
    code: 'local({x<-structure(c(a=1L,b=2L),note="owned");y<-as.expression(x);identical(y,expression(1L,2L))&&is.null(attributes(y))&&identical(names(x),c("a","b"))&&identical(attr(x,"note"),"owned")})',
  },
  {
    id: "list-as-expression-preserves-attributes-reference",
    group: "conversion",
    code: 'local({e<-new.env(parent=emptyenv());x<-list(a=1L,b=quote(owned));attr(x,"note")<-"owned";attr(x,"owner")<-e;y<-as.expression(x);attr(y,"note")<-"changed";identical(names(attributes(y)),c("names","note","owner"))&&identical(names(y),c("a","b"))&&identical(y[[1L]],1L)&&identical(y[[2L]],quote(owned))&&identical(attr(y,"owner"),e)&&identical(attr(x,"note"),"owned")})',
  },
];
it.each(cases)("expression metadata: $id", async ({ code }) => {
  await runtime.reset();
  expect(await runtime.eval(code)).toEqual(true);
});

// Separately native-verified reference controls; these do not alter the frozen 45-case pool.
it.each([
  "local({e<-new.env(parent=emptyenv());x<-as.expression(list(e));y<-as.expression(list(e));identical(x,y)})",
  "local({a<-new.env(parent=emptyenv());b<-new.env(parent=emptyenv());x<-as.expression(list(a));y<-as.expression(list(b));!identical(x,y)})",
  "local({f<-local({n<-1L;function()n});g<-local({n<-2L;function()n});!identical(as.expression(list(f)),as.expression(list(g)))})",
])("expression cell identity: %s", async (code) => {
  await runtime.reset();
  expect(await runtime.eval(code)).toBe(true);
});

// Separately native-verified metadata queries, with six independently asserted values.
it("keeps vector-mode classification and stored expression dimnames distinct", async () => {
  await runtime.reset();
  expect(
    await runtime.eval(`local({
   plain<-expression(1L,2L);named<-expression(a=1L,b=2L)
   noted<-plain;attr(noted,"note")<-"owned"
   classed<-plain;class(classed)<-"owned"
   matrix<-plain;dim(matrix)<-c(1L,2L);dimnames(matrix)<-list("row",c("a","b"))
   c(is.vector(plain),is.vector(named),!is.vector(noted),!is.vector(classed),!is.vector(matrix),
     identical(dimnames(matrix),list("row",c("a","b"))))
 })`),
  ).toEqual([true, true, true, true, true, true]);
});

// NativR-only allocation/checkpoint and recovery checks; no GNU R parity credit.
it("keeps a named scalar expression usable at vector length one", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 1 } });
  try {
    await r.eval("x<-expression(owned=1L);NULL");
    expect(await r.eval('identical(names(x),"owned")&&identical(x[[1L]],1L)')).toBe(true);
  } finally {
    await r.dispose();
  }
});

it("rejects oversized expression construction before replacing a binding", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 64 } });
  try {
    await r.eval("x<-expression(owned=1L);NULL");
    await expect(
      r.eval(`x<-expression(${Array.from({ length: 65 }, () => "1L").join(",")})`),
    ).rejects.toMatchObject({
      code: "NRL4002",
      message: "Vector length limit exceeded.",
    });
    expect(await r.eval("identical(x,expression(owned=1L))&&sys.nframe()==0L")).toBe(true);
    expect(await r.eval("as.expression(list(2L))[[1L]]")).toBe(2);
  } finally {
    await r.dispose();
  }
});

it("checkpoints atomic-to-expression cells and recovers without modifying the input", async () => {
  const r = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 1024, maxSteps: 300 },
  });
  try {
    await r.assign("v", new Float64Array(500).fill(1));
    await expect(r.eval("as.expression(v)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await r.eval("length(v)==500L&&v[[1L]]==1&&sys.nframe()==0L")).toBe(true);
    expect(await r.eval("as.expression(list(2L))[[1L]]")).toBe(2);
  } finally {
    await r.dispose();
  }
});

// Exact historical owned assertion; the source attribute-order neighbor remains open.
it("closes the original named-expression unlist observation", async () => {
  await runtime.reset();
  expect(
    await runtime.eval(
      'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=expression(a=1L,b=2L),f=f);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],1L),identical(y[[2L]],2L),identical(y[[3L]],f)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 3L, \n    names = c("outer.a", "outer.b", "f"), types = c(outer.a = "integer", \n    outer.b = "integer", f = "closure")), same = c(TRUE, TRUE, \nTRUE)), warnings = character(0)))})',
    ),
  ).toBe(true);
});
