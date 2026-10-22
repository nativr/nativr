# Independently authored GNU R 4.6.1 black-box probes.
# These remain open gaps and are deliberately outside passing conformance claims.
# Contains only owned expressions and observable outcomes, no native bodies.
check<-function(label,expr) { result<-tryCatch(expr,error=function(e) conditionMessage(e)); print(list(case=label,result=result)) }
check("expression list no warning",local({messages<-character();ans<-withCallingHandlers(`$<-`(structure(expression(a=1L,b=2L),note="keep"),c,3L),warning=function(w){messages<<-c(messages,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(ans,messages),list(structure(list(a=1L,b=2L,c=3L),note="keep"),character()))}))
check("language attrs preserved",identical(`$<-`(structure(quote(f(a=1L,b=2L)),note="keep"),c,3L),structure(quote(f(a=1L,b=2L,c=3L)),note="keep")))
check("expression replace keeps type",identical(`$<-`(expression(a=1L,b=2L),a,3L),expression(a=3L,b=2L)))
check("expression delete keeps type",identical(`$<-`(expression(a=1L,b=2L),a,NULL),expression(b=2L)))
check("expression absent delete unchanged",identical(`$<-`(expression(a=1L,b=2L),c,NULL),expression(a=1L,b=2L)))
check("expression final deletion retains empty names",identical(`$<-`(expression(a=1L),a,NULL),structure(expression(),names=character())))
check("expression missing delete unchanged",local({x<-expression(1L,a=2L);identical(`$<-`(x,,NULL),x)}))
check("expression dims replacement preserved",local({x<-structure(expression(a=1L,b=2L),dim=c(1L,2L),note="keep");y<-`$<-`(x,a,3L);identical(y,structure(expression(a=3L,b=2L),dim=c(1L,2L),note="keep"))}))
