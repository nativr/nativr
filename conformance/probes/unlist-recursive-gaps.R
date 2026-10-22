# Independently authored GNU R 4.6.1 black-box observations; no native implementation body.
# Original gap observations retained without changing their assertions. Both native expectations are TRUE
# with no warnings. The original 43-row survey remains unchanged.
# Frozen hashes below identify original assertions before trailing-space normalization.
# Named expression: list names outer.a, outer.b, f; values 1L, 2L and the owned closure.
# Constructor order: source attribute names dim, names, note, class.
# The revised unlist fixture checks input nonmutation without claiming that order fixed.
# Profile 0.394 also verifies the exact named-expression assertion in expression-attributes.test.ts.
# That bounded named-expression gap is closed; the constructor-order assertion remains unfinished.

# named-expression
# Frozen assertion SHA-256: b58e4945746d1b3bb12afba8d5454ca3c61b477af542576152cb9391f06bf1f2
stopifnot(isTRUE(
local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=expression(a=1L,b=2L),f=f);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],1L),identical(y[[2L]],2L),identical(y[[3L]],f)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 3L,
    names = c("outer.a", "outer.b", "f"), types = c(outer.a = "integer",
    outer.b = "integer", f = "closure")), same = c(TRUE, TRUE,
TRUE)), warnings = character(0)))})
))

# root-list-attrs-drop
# Frozen assertion SHA-256: f618c90f693296b402f7eebf442fe90dea78697031f9316e864af3420fff1d7d
stopifnot(isTRUE(
local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-structure(list(f=f,e=e),note="root",dim=c(1L,2L),class="owned");y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),attributes=names(attributes(y)),sourceAttrs=names(attributes(x)),same=c(identical(y[[1L]],f),identical(y[[2L]],e)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 2L,
    names = c("f", "e"), types = c(f = "closure", e = "environment"
    )), attributes = "names", sourceAttrs = c("dim", "names",
"note", "class"), same = c(TRUE, TRUE)), warnings = character(0)))})
))
