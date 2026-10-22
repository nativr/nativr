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
// Independently authored GNU R 4.6.1 assertions: 41 unchanged frozen rows plus one revised native-verified root-attribute row.
// Named expression storage and source-constructor attribute order remain separately preserved gaps.
const cases = [
  {
    id: "single-closure",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=f);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],f),source=identical(x[[1L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "a", types = c(a = "closure")), same = TRUE, source = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "single-builtin",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=b);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],b),source=identical(x[[1L]],b))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "a", types = c(a = "builtin")), same = TRUE, source = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "single-special",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=s);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],s),source=identical(x[[1L]],s))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "a", types = c(a = "special")), same = TRUE, source = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "single-environment",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=e);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],e),source=identical(x[[1L]],e))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "a", types = c(a = "environment")), same = TRUE, \n    source = TRUE), warnings = character(0)))})',
  },
  {
    id: "single-symbol",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=sym);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],sym),source=identical(x[[1L]],sym))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "a", types = c(a = "symbol")), same = TRUE, source = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "single-call",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=cl);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],cl),source=identical(x[[1L]],cl))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "a", types = c(a = "language")), same = TRUE, source = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "mixed-callable-references",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(f=f,b=b,s=s);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],b),identical(y[[3L]],s)),capture=y[[1L]](2L))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 3L, \n    names = c("f", "b", "s"), types = c(f = "closure", b = "builtin", \n    s = "special")), same = c(TRUE, TRUE, TRUE), capture = 9L), \n    warnings = character(0)))})',
  },
  {
    id: "nested-all-leaf-kinds",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=list(f=f,b=b,s=s,e=e,q=sym,c=cl));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],b),identical(y[[3L]],s),identical(y[[4L]],e),identical(y[[5L]],sym),identical(y[[6L]],cl)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 6L, \n    names = c("outer.f", "outer.b", "outer.s", "outer.e", "outer.q", \n    "outer.c"), types = c(outer.f = "closure", outer.b = "builtin", \n    outer.s = "special", outer.e = "environment", outer.q = "symbol", \n    outer.c = "language")), same = c(TRUE, TRUE, TRUE, TRUE, \nTRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "nested-numeric-leaves",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=list(f=f,n=c(u=1L,v=2L)),b=list(e=e,z=3));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],1L),identical(y[[3L]],2L),identical(y[[4L]],e),identical(y[[5L]],3)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 5L, \n    names = c("a.f", "a.n.u", "a.n.v", "b.e", "b.z"), types = c(a.f = "closure", \n    a.n.u = "integer", a.n.v = "integer", b.e = "environment", \n    b.z = "double")), same = c(TRUE, TRUE, TRUE, TRUE, TRUE)), \n    warnings = character(0)))})',
  },
  {
    id: "atomic-types-with-callable",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(raw=as.raw(2L),logical=TRUE,integer=3L,double=4,complex=1+2i,text="owned",fun=f);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],as.raw(2L)),identical(y[[2L]],TRUE),identical(y[[3L]],3L),identical(y[[4L]],4),identical(y[[5L]],1+2i),identical(y[[6L]],"owned"),identical(y[[7L]],f)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 7L, \n    names = c("raw", "logical", "integer", "double", "complex", \n    "text", "fun"), types = c(raw = "raw", logical = "logical", \n    integer = "integer", double = "double", complex = "complex", \n    text = "character", fun = "closure")), same = c(TRUE, TRUE, \nTRUE, TRUE, TRUE, TRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "null-empty-and-callable",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=NULL,b=list(),c=integer(),d=list(z=NULL,f=f),e=character());y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "d.f", types = c(d.f = "closure")), same = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "pairlist-root",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-pairlist(a=f,b=pairlist(c=e,d=1:2));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],e),identical(y[[3L]],1L),identical(y[[4L]],2L)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 4L, \n    names = c("a", "b.c", "b.d1", "b.d2"), types = c(a = "closure", \n    b.c = "environment", b.d1 = "integer", b.d2 = "integer")), \n    same = c(TRUE, TRUE, TRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "pairlist-nested",
    group: "recursive-leaves",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=pairlist(f=f,e=e),tail=4L);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],e),identical(y[[3L]],4L)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 3L, \n    names = c("outer.f", "outer.e", "tail"), types = c(outer.f = "closure", \n    outer.e = "environment", tail = "integer")), same = c(TRUE, \nTRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "unnamed-nested",
    group: "names",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(list(f,e),list(list(sym,cl)));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],e),identical(y[[3L]],sym),identical(y[[4L]],cl)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 4L, \n    names = NULL, types = c("closure", "environment", "symbol", \n    "language")), same = c(TRUE, TRUE, TRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "named-parent-unnamed-children",
    group: "names",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=list(f,1:2,e),tail=cl);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[4L]],e),identical(y[[5L]],cl)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 5L, \n    names = c("outer1", "outer2", "outer3", "outer4", "tail"), \n    types = c(outer1 = "closure", outer2 = "integer", outer3 = "integer", \n    outer4 = "environment", tail = "language")), same = c(TRUE, \nTRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "empty-and-duplicate-names",
    group: "names",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-structure(list(f,e,list(q=sym,cl)),names=c("","same","same"));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],e),identical(y[[3L]],sym),identical(y[[4L]],cl)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 4L, \n    names = c("", "same", "same.q", "same"), types = c("closure", \n    same = "environment", same.q = "symbol", same = "language"\n    )), same = c(TRUE, TRUE, TRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "missing-root-name",
    group: "names",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-structure(list(f,e),names=c(NA_character_,"NA"));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),nameMissing=is.na(names(y)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 2L, \n    names = c(NA, "NA"), types = structure(c("closure", "environment"\n    ), names = c(NA, "NA"))), nameMissing = c(TRUE, FALSE)), \n    warnings = character(0)))})',
  },
  {
    id: "missing-nested-name",
    group: "names",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=structure(list(f,e),names=c(NA_character_,"")));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),nameMissing=is.na(names(y)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 2L, \n    names = c("outer.NA", "outer"), types = c(outer.NA = "closure", \n    outer = "environment")), nameMissing = c(FALSE, FALSE)), \n    warnings = character(0)))})',
  },
  {
    id: "use-names-false",
    group: "names",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=list(f=f,n=c(u=1L,v=2L)),b=e);y<-unlist(x,use.names=FALSE);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],1L),identical(y[[4L]],e)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 4L, \n    names = NULL, types = c("closure", "integer", "integer", \n    "environment")), same = c(TRUE, TRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "closure-reference-attributes",
    group: "identity-attributes",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));attr(f,"note")<-e;attr(f,"class")<-"owned";x<-list(a=list(f=f));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],f),note=identical(attr(y[[1L]],"note"),e),class=class(y[[1L]]),capture=y[[1L]](5L))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "a.f", types = c(a.f = "closure")), same = TRUE, \n    note = TRUE, class = "owned", capture = 12L), warnings = character(0)))})',
  },
  {
    id: "environment-alias-mutation",
    group: "identity-attributes",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(a=list(first=e,second=e));y<-unlist(x);y[[1L]]$token<-19L;list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],e),identical(y[[1L]],y[[2L]])),values=c(e$token,y[[2L]]$token,x[[1L]][[2L]]$token))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 2L, \n    names = c("a.first", "a.second"), types = c(a.first = "environment", \n    a.second = "environment")), same = c(TRUE, TRUE), values = c(19L, \n19L, 19L)), warnings = character(0)))})',
  },
  {
    id: "root-list-attrs-drop",
    group: "identity-attributes",
    code: 'local({warnings<-character();value<-withCallingHandlers(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-structure(list(f=f,e=e),note="root",dim=c(1L,2L),class="owned");before<-attributes(x);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),attributes=names(attributes(y)),sourceUnchanged=identical(attributes(x),before),same=c(identical(y[[1L]],f),identical(y[[2L]],e)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value=list(summary=list(type="list",length=2L,names=c("f","e"),types=c(f="closure",e="environment")),attributes="names",sourceUnchanged=TRUE,same=c(TRUE,TRUE)),warnings=character(0)))})',
  },
  {
    id: "atomic-leaf-attrs-drop",
    group: "identity-attributes",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));v<-structure(c(a=1L,b=2L),note=e,class="owned");x<-list(v=v,f=f);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),attributes=list(attributes(y[[1L]]),attributes(y[[2L]])),source=identical(attr(v,"note"),e),same=identical(y[[3L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 3L, \n    names = c("v.a", "v.b", "f"), types = c(v.a = "integer", \n    v.b = "integer", f = "closure")), attributes = list(NULL, \n    NULL), source = TRUE, same = TRUE), warnings = character(0)))})',
  },
  {
    id: "factor-with-callable",
    group: "identity-attributes",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));v<-factor(c("b","a","b"));y<-unlist(list(v=v,f=f));list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),values=c(y[[1L]],y[[2L]],y[[3L]]),classes=vapply(y[1:3],function(z)paste(class(z),collapse=":"),""),attributes=lapply(y[1:3],attributes),same=identical(y[[4L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 4L, \n    names = c("v1", "v2", "v3", "f"), types = c(v1 = "integer", \n    v2 = "integer", v3 = "integer", f = "closure")), values = c(2L, \n1L, 2L), classes = c(v1 = "integer", v2 = "integer", v3 = "integer"\n), attributes = list(v1 = NULL, v2 = NULL, v3 = NULL), same = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "expression-root-identity",
    group: "expression",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-expression(a,1+2);y<-unlist(x);list(type=typeof(y),length=length(y),names=names(y),same=identical(y,x))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(type = "expression", length = 2L, names = NULL, \n    same = TRUE), warnings = character(0)))})',
  },
  {
    id: "expression-nested",
    group: "expression",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=list(expr=expression(a,1+2)),tail=3L);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],quote(a)),identical(y[[2L]],quote(1+2)),identical(y[[3L]],3L)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 3L, \n    names = c("outer.expr1", "outer.expr2", "tail"), types = c(outer.expr1 = "symbol", \n    outer.expr2 = "language", tail = "integer")), same = c(TRUE, \nTRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "expression-with-callable",
    group: "expression",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(expr=expression(a,1+2),f=f,e=e);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],quote(a)),identical(y[[2L]],quote(1+2)),identical(y[[3L]],f),identical(y[[4L]],e)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 4L, \n    names = c("expr1", "expr2", "f", "e"), types = c(expr1 = "symbol", \n    expr2 = "language", f = "closure", e = "environment")), same = c(TRUE, \nTRUE, TRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "empty-expression-precedence",
    group: "expression",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));y<-unlist(list(expression(),list(f=f),NULL));list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "f", types = c(f = "closure")), same = TRUE), warnings = character(0)))})',
  },
  {
    id: "expression-only-empty",
    group: "expression",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));y<-unlist(list(expression(),integer(),NULL));list(type=typeof(y),length=length(y),names=names(y))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(type = "integer", length = 0L, names = NULL), \n    warnings = character(0)))})',
  },
  {
    id: "shallow-callable-leaves",
    group: "preservation",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=list(f=f,n=1:2),e=e);y<-unlist(x,recursive=FALSE);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],1:2),identical(y[[3L]],e)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 3L, \n    names = c("outer.f", "outer.n", "e"), types = c(outer.f = "closure", \n    outer.n = "integer", e = "environment")), same = c(TRUE, \nTRUE, TRUE)), warnings = character(0)))})',
  },
  {
    id: "shallow-deeper-list",
    group: "preservation",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=list(inner=list(f=f)),tail=1:2);y<-unlist(x,recursive=FALSE);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],x[[1L]][[1L]]),identical(y[[2L]],1L),identical(y[[3L]],2L)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 3L, \n    names = c("outer.inner", "tail1", "tail2"), types = c(outer.inner = "list", \n    tail1 = "integer", tail2 = "integer")), same = c(TRUE, TRUE, \nTRUE)), warnings = character(0)))})',
  },
  {
    id: "top-level-nonlists",
    group: "preservation",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));list(functionSame=identical(unlist(f),f),builtinSame=identical(unlist(b),b),specialSame=identical(unlist(s),s),environmentSame=identical(unlist(e),e),symbolSame=identical(unlist(sym),sym),callSame=identical(unlist(cl),cl))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(functionSame = TRUE, builtinSame = TRUE, specialSame = TRUE, \n    environmentSame = TRUE, symbolSame = TRUE, callSame = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "atomic-promotion",
    group: "preservation",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));unlist(list(a=TRUE,b=1L,c=2,d=1+2i,e="x"))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = c(a = "TRUE", b = "1", c = "2", d = "1+2i", e = "x"\n), warnings = character(0)))})',
  },
  {
    id: "factor-only",
    group: "preservation",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));y<-unlist(list(a=factor(c("b","a")),b=factor("c")));list(type=typeof(y),class=class(y),names=names(y),levels=levels(y),labels=as.character(y))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(type = "integer", class = "factor", names = c("a1", \n"a2", "b"), levels = c("a", "b", "c"), labels = c("b", "a", "c"\n)), warnings = character(0)))})',
  },
  {
    id: "empty-roots",
    group: "preservation",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));list(null=unlist(NULL),list=unlist(list()),pairlist=unlist(pairlist()),nested=unlist(list(list(),NULL)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(null = NULL, list = NULL, pairlist = NULL, \n    nested = NULL), warnings = character(0)))})',
  },
  {
    id: "atomic-identity",
    group: "preservation",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-structure(c(a=1L,b=2L),note=e);list(same=identical(unlist(x),x),note=identical(attr(unlist(x),"note"),e),unnamedSame=identical(unlist(x,use.names=FALSE),x))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(same = TRUE, note = TRUE, unnamedSame = TRUE), \n    warnings = character(0)))})',
  },
  {
    id: "forcing-order-once",
    group: "controls",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));trace<-character();y<-unlist({trace<-c(trace,"x");list(f=f)},recursive={trace<-c(trace,"recursive");TRUE},use.names={trace<-c(trace,"names");FALSE});list(trace=trace,summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(trace = c("recursive", "x", "names"), summary = list(\n    type = "list", length = 1L, names = NULL, types = "closure"), \n    same = TRUE), warnings = character(0)))})',
  },
  {
    id: "literal-missing-controls",
    group: "controls",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));y<-unlist(list(f=f),recursive=,use.names=);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = "f", types = c(f = "closure")), same = TRUE), warnings = character(0)))})',
  },
  {
    id: "coerced-controls",
    group: "controls",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));y<-unlist(list(outer=list(f=f)),recursive=0L,use.names=0L);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=identical(y[[1L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 1L, \n    names = NULL, types = "closure"), same = TRUE), warnings = character(0)))})',
  },
  {
    id: "visible-return",
    group: "controls",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));v<-withVisible(unlist(list(f=f)));list(visible=v$visible,same=identical(v$value[[1L]],f))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(visible = TRUE, same = TRUE), warnings = character(0)))})',
  },
  {
    id: "recursive-error-before-input",
    group: "controls",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));unlist(stop("owned x"),recursive=stop("owned recursive"),use.names=stop("owned names"))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(error = "owned recursive"), warnings = character(0)))})',
  },
  {
    id: "names-error-before-flattening",
    group: "controls",
    code: 'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));unlist(list(f=f),use.names=stop("owned names"))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(error = "owned names"), warnings = character(0)))})',
  },
] as const;
it.each(cases)("$id", async ({ code }) => {
  await runtime.reset();
  expect(await runtime.eval(code)).toBe(true);
});

// NativR-only resource/recovery checks; these are not GNU R conformance evidence.
it("does not impose an internal length-two requirement on a scalar result", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 1 } });
  try {
    await r.eval("f<-function(x)x;x<-list(f);NULL");
    expect(await r.eval("identical(unlist(x)[[1L]],f)")).toBe(true);
  } finally {
    await r.dispose();
  }
});

it("bounds mixed recursive output before allocation and preserves the source", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 64 } });
  try {
    await r.eval("f<-function(x)x;x<-list(f=f,n=1:64);NULL");
    await expect(r.eval("unlist(x)")).rejects.toMatchObject({ code: "NRL4002" });
    expect(await r.eval("identical(x$f,f)&&length(x$n)==64L&&sys.nframe()==0L")).toBe(true);
    expect(await r.eval("identical(unlist(list(f=f))[[1L]],f)")).toBe(true);
  } finally {
    await r.dispose();
  }
});

it("checkpoints atomic cells in mixed output and recovers the session", async () => {
  const r = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 1024, maxSteps: 300 },
  });
  try {
    await r.assign("v", new Float64Array(500).fill(1));
    await r.eval("f<-function(x)x;x<-list(f=f,n=v);NULL");
    await expect(r.eval("unlist(x)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await r.eval("length(v)==500L&&sys.nframe()==0L&&identical(x$f,f)")).toBe(true);
    expect(await r.eval("identical(unlist(list(f=f))[[1L]],f)")).toBe(true);
  } finally {
    await r.dispose();
  }
});

it("traverses deep mixed containers without consuming the R call-depth budget", async () => {
  const r = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 8192, maxSteps: 1000000, maxCallDepth: 32 },
  });
  try {
    await r.eval("f<-function(x)x+1L;x<-list(f);for(i in seq_len(2000L))x<-list(x)");
    expect(
      await r.eval("identical(unlist(x)[[1L]],f)&&unlist(x)[[1L]](2L)==3L&&sys.nframe()==0L"),
    ).toBe(true);
  } finally {
    await r.dispose();
  }
});

it("bounds recursive name-prefix bytes and recovers without generated names", async () => {
  const r = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 1024, maxSteps: 100000, maxOutputBytes: 128 },
  });
  try {
    await r.eval("f<-function(x)x;x<-list(f);for(i in seq_len(16L))x<-list(ownedprefix=x);NULL");
    await expect(r.eval("unlist(x)")).rejects.toMatchObject({
      code: "NRL4007",
      message: "unlist() name byte budget exceeded.",
    });
    expect(await r.eval("sys.nframe()==0L&&identical(unlist(x,use.names=FALSE)[[1L]],f)")).toBe(
      true,
    );
    expect(await r.eval("identical(unlist(list(f=f))[[1L]],f)")).toBe(true);
  } finally {
    await r.dispose();
  }
});
