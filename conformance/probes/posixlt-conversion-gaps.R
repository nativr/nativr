# Independently authored optional GNU R black-box gap controls.
# These known gaps receive no passing foundation, recursive or matrix credit.
# Only scalar/small-vector allocations occur, including the integer field boundaries.
# Timezone changes below are process-local and restored by on.exit.
# No function bodies, conditionCall objects or foreign package source are observed.
check<-function(name,expr){tryCatch(cat(if(isTRUE(force(expr)))"PASS" else "FAIL",name,"\n"),error=function(e)cat("ERROR",name,"\n"))}
check("character direct default GMT",identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {
    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};
put <- function(x, n, v) {
    u <- unclass(x)
    u[n] <- list(v)
    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.default(c("2000-02-29 12:34:56", "1970-01-01"), tz = "GMT"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(951782400, 0), class = c("POSIXct",
"POSIXt"), tzone = "GMT"), warnings = character(0))))
check("character invalid parse",identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {
    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};
put <- function(x, n, v) {
    u <- unclass(x)
    u[n] <- list(v)
    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.default("not-a-date", tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "character string is not in a standard unambiguous format"),
    warnings = character(0))))
check("existing ISO T/Z input",identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {
    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};
put <- function(x, n, v) {
    u <- unclass(x)
    u[n] <- list(v)
    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct("1970-01-01T00:00:01Z", tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(0, class = c("POSIXct", "POSIXt"), tzone = "UTC"),
    warnings = character(0))))
check("numeric vector origin",identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {
    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};
put <- function(x, n, v) {
    u <- unclass(x)
    u[n] <- list(v)
    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.numeric(c(a = 0, b = 1, c = 2), origin = c(0, 10), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(a = 0, b = 11, c = 2), class = c("POSIXct",
"POSIXt"), tzone = "UTC"), warnings = "longer object length is not a multiple of shorter object length")))
check("numeric empty origin",identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {
    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};
put <- function(x, n, v) {
    u <- unclass(x)
    u[n] <- list(v)
    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.numeric(c(0, 1), origin = numeric(), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(numeric(0), class = c("POSIXct", "POSIXt"
), tzone = "UTC"), warnings = character(0))))
check("numeric NULL origin",identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {
    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};
put <- function(x, n, v) {
    u <- unclass(x)
    u[n] <- list(v)
    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")
};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.numeric(c(0, 1), origin = NULL, tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(numeric(0), class = c("POSIXct", "POSIXt"
), tzone = "UTC"), warnings = character(0))))
check("integer numeric method",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(1L,tz=stop("tz"))}),17L)}))
check("integer before numeric",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.integer<-function(x,...)18L;as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(1L)}),18L)}))
check("integer NextMethod numeric",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({events<-character();as.POSIXct.integer<-function(x,...){events<<-c(events,"integer");NextMethod()};as.POSIXct.numeric<-function(x,...){events<<-c(events,"numeric");17L};list(as.POSIXct(1L),events)}),list(17L,c("integer","numeric")))}))
check("double method precedence",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.double<-function(x,...)18L;as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(1)}),18L)}))
check("matrix storage fallback",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(matrix(1L,1))}),17L)}))
check("classed numeric no method",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(as.POSIXct(structure(1,class="owned_no_method"),tz="UTC")),"do not know how to convert 'structure(1, class = \"owned_no_method\")' to class \"POSIXct\"")}))
check("classed numeric default method",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.default<-function(x,...)19L;as.POSIXct(structure(1,class="owned_no_method"),tz="UTC")}),19L)}))
check("classed numeric methods do not use implicit storage",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(local({as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(structure(1,class="owned_no_method"),tz="UTC")})),"do not know how to convert 'structure(1, class = \"owned_no_method\")' to class \"POSIXct\"")}))
check("classed numeric explicit numeric superclass",local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(structure(1,class=c("owned_no_method","numeric")),tz="UTC")}),17L)}))
check("native named-zone offset",local({lt<-function(sec=0,tz="UTC"){structure(list(sec=sec,min=0L,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(c(UTC=as.numeric(as.POSIXct(lt(0,"UTC"))),NewYork=as.numeric(as.POSIXct(lt(0,"America/New_York")))) ,c(UTC=0,NewYork=18000))}))
check("native empty-zone host dependency",local({lt<-function(sec=0,tz="UTC"){structure(list(sec=sec,min=0L,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};old<-Sys.getenv("TZ",unset=NA_character_);on.exit(if(is.na(old))Sys.unsetenv("TZ")else Sys.setenv(TZ=old));Sys.setenv(TZ="UTC");a<-as.numeric(as.POSIXct(lt(0,"")));Sys.setenv(TZ="America/New_York");b<-as.numeric(as.POSIXct(lt(0,"")));identical(c(UTC=a,NewYork=b),c(UTC=0,NewYork=18000))}))
check("native maximum integer min",local({lt<-function(sec=0,tz="UTC"){structure(list(sec=sec,min=0L,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();x<-put(lt(),"min",2147483647);value<-withCallingHandlers(list(is.finite(x),is.infinite(x),is.nan(x)),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(list(FALSE,FALSE,FALSE),character()))}))
check("native maximum integer hour",local({lt<-function(sec=0,tz="UTC"){structure(list(sec=sec,min=0L,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();x<-put(lt(),"hour",2147483647);value<-withCallingHandlers(list(is.finite(x),is.infinite(x),is.nan(x)),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(list(FALSE,FALSE,FALSE),character()))}))
check("native maximum integer mday",local({lt<-function(sec=0,tz="UTC"){structure(list(sec=sec,min=0L,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();x<-put(lt(),"mday",2147483647);value<-withCallingHandlers(list(is.finite(x),is.infinite(x),is.nan(x)),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(list(FALSE,FALSE,FALSE),character()))}))
check("native maximum integer mon",local({lt<-function(sec=0,tz="UTC"){structure(list(sec=sec,min=0L,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();x<-put(lt(),"mon",2147483647);value<-withCallingHandlers(list(is.finite(x),is.infinite(x),is.nan(x)),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(list(TRUE,FALSE,FALSE),character()))}))
check("native maximum integer year",local({lt<-function(sec=0,tz="UTC"){structure(list(sec=sec,min=0L,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();x<-put(lt(),"year",2147483647);value<-withCallingHandlers(list(is.finite(x),is.infinite(x),is.nan(x)),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(list(FALSE,FALSE,FALSE),character()))}))
