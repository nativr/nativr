# Independently authored native observations for preexisting unfinished behavior.
# These are excluded from the resource-fix parity claim. No large fields are executed.
check<-function(name,expr){tryCatch(cat(if(isTRUE(force(expr)))"PASS" else "FAIL",name,"\n"),error=function(e)cat("ERROR",name,conditionMessage(e),"\n"))}
check("byte-based multibyte precision",identical(sprintf("%.2s","\u00e9a"),"\u00e9"))
check("byte-based supplementary precision",identical(sprintf("%.4s","\U0001f600a"),"\U0001f600"))
check("byte-based width",identical(sprintf("[%5s]","\u00e9"),"[   \u00e9]"))
check("unknown directive rejected",identical(tryCatch(sprintf("%q",1L),error=conditionMessage),"unrecognised format specification '%q'"))
check("unused value warning",local({warnings<-character();value<-withCallingHandlers(sprintf("plain",1L),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list("plain","one argument not used by format 'plain'"))}))
check("missing format becomes text",local({warnings<-character();value<-withCallingHandlers(sprintf(NA_character_,1L),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list("NA","one argument not used by format 'NA'"))}))
# Huge-field parser behavior, unknown-directive passthrough, resource errors and cancellation are
# NativR-only safety/adaptation tests. Do not run huge native width or precision allocations.
