# Owned GNU R 4.6.1 observations outside direct UseMethod completion.
# These context restrictions and direct NextMethod visibility remain gaps; no exact credit.
failures<-0L
check<-function(name,expr){ok<-tryCatch(isTRUE(force(expr)),error=function(e)FALSE);cat(if(ok)"PASS" else "FAIL",name,"\n");if(!ok)failures<<-failures+1L}
check("for-body-context-error-remains-separate",local({
    trace<-integer();g<-function(x){for(i in 1:3){trace<<-c(trace,i);UseMethod("g")};99L};g.default<-function(x)7L
    identical(tryCatch(g(1L),error=function(e)conditionMessage(e)),"'UseMethod' used in an inappropriate fashion")&&identical(trace,1L)
  }))
check("repeat-body-context-error-remains-separate",local({
    trace<-integer();g<-function(x){repeat{trace<<-c(trace,1L);UseMethod("g");break};99L};g.default<-function(x)7L
    identical(tryCatch(g(1L),error=function(e)conditionMessage(e)),"'UseMethod' used in an inappropriate fashion")&&identical(trace,1L)
  }))
check("evalq-context-error-remains-separate",local({
    g<-function(x){evalq(UseMethod("g"));99L};g.default<-function(x)7L
    identical(tryCatch(g(1L),error=function(e)conditionMessage(e)),"generic 'function' is not a function")
  }))
check("trycatch-context-error-and-finally-remain-separate",local({
    trace<-character();g<-function(x){on.exit(trace<<-c(trace,"generic"));tryCatch(UseMethod("g"),finally=trace<<-c(trace,"finally"));99L}
    g.default<-function(x)7L;v<-tryCatch(g(1L),error=function(e)conditionMessage(e))
    identical(v,"'UseMethod' used in an inappropriate fashion")&&identical(trace,c("finally","generic"))
  }))
check("nextmethod-direct-visibility-separate",local({
    g<-function(x)UseMethod("g");g.a<-function(x)NextMethod();g.default<-function(x)invisible(7L)
    identical(withVisible(g(structure(1L,class="a"))),list(value=7L,visible=FALSE))
  }))
check("forced-builtin-argument-context-error-remains-separate",local({
    g<-function(x){identity(UseMethod("g"));99L};g.default<-function(x)7L
    identical(tryCatch(g(1L),error=function(e)conditionMessage(e)),"'UseMethod' used in an inappropriate fashion")
  }))
check("usemethod-inside-withvisible-context-error-remains-separate",local({
    g<-function(x){withVisible(UseMethod("g"));99L};g.default<-function(x)invisible(7L)
    identical(tryCatch(g(1L),error=function(e)conditionMessage(e)),"'UseMethod' used in an inappropriate fashion")
  }))
if(failures>0L)quit(status=1L)
