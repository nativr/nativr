import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independently authored GNU R 4.6.1 black-box observations. Unsupported native ranges/zones
// and broader implicit S3 fallback remain outside these bounded parity claims.
const parityCases = [
  [
    "method signatures",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};all(vapply(c("is.finite.POSIXlt","is.infinite.POSIXlt","is.nan.POSIXlt"),function(n)identical(typeof(get(n)),"closure")&&identical(formals(get(n)),as.pairlist(alist(x=))),logical(1)))})',
  ],
  [
    "ordinary seconds missing and nonfinite",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(lt(c(0,60,NA_real_,NaN,Inf,-Inf))),list(c(TRUE,TRUE,FALSE,FALSE,FALSE,FALSE),c(FALSE,FALSE,FALSE,FALSE,TRUE,TRUE),c(FALSE,FALSE,FALSE,TRUE,FALSE,FALSE)))})',
  ],
  [
    "empty",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(lt(numeric())),rep(list(logical()),3))})',
  ],
  [
    "is.finite direct and generic agreement",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite.POSIXlt(lt()),c(TRUE,FALSE,FALSE))&&identical(is.finite(lt()),c(TRUE,FALSE,FALSE))})',
  ],
  [
    "is.finite direct numeric conversion",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite.POSIXlt(c(0,Inf,NaN)),c(TRUE,FALSE,FALSE))})',
  ],
  [
    "is.finite direct NULL conversion",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite.POSIXlt(NULL),logical())})',
  ],
  [
    "is.finite missing",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite.POSIXlt()),\'argument "x" is missing, with no default\')&&identical(err(is.finite.POSIXlt(x=)),\'argument "x" is missing, with no default\')})',
  ],
  [
    "is.finite unused stays lazy",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};events<-character();message<-err(is.finite.POSIXlt({events<-c(events,"x");lt(0)},stop("extra forced")));identical(events,character())&&identical(message,\'unused argument (stop("extra forced"))\')})',
  ],
  [
    "is.finite duplicate stays lazy",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite.POSIXlt(x=stop("x"),x=stop("second"))),\'formal argument "x" matched by multiple actual arguments\')})',
  ],
  [
    "is.finite input once",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};count<-0L;y<-is.finite.POSIXlt({count<-count+1L;lt()});identical(count,1L)&&identical(y,c(TRUE,FALSE,FALSE))})',
  ],
  [
    "is.finite direct return visible",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(withVisible(is.finite.POSIXlt(lt())),list(value=c(TRUE,FALSE,FALSE),visible=TRUE))})',
  ],
  [
    "is.infinite direct and generic agreement",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.infinite.POSIXlt(lt()),c(FALSE,TRUE,FALSE))&&identical(is.infinite(lt()),c(FALSE,TRUE,FALSE))})',
  ],
  [
    "is.infinite direct numeric conversion",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.infinite.POSIXlt(c(0,Inf,NaN)),c(FALSE,TRUE,FALSE))})',
  ],
  [
    "is.infinite direct NULL conversion",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.infinite.POSIXlt(NULL),logical())})',
  ],
  [
    "is.infinite missing",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.infinite.POSIXlt()),\'argument "x" is missing, with no default\')&&identical(err(is.infinite.POSIXlt(x=)),\'argument "x" is missing, with no default\')})',
  ],
  [
    "is.infinite unused stays lazy",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};events<-character();message<-err(is.infinite.POSIXlt({events<-c(events,"x");lt(0)},stop("extra forced")));identical(events,character())&&identical(message,\'unused argument (stop("extra forced"))\')})',
  ],
  [
    "is.infinite duplicate stays lazy",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.infinite.POSIXlt(x=stop("x"),x=stop("second"))),\'formal argument "x" matched by multiple actual arguments\')})',
  ],
  [
    "is.infinite input once",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};count<-0L;y<-is.infinite.POSIXlt({count<-count+1L;lt()});identical(count,1L)&&identical(y,c(FALSE,TRUE,FALSE))})',
  ],
  [
    "is.infinite direct return visible",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(withVisible(is.infinite.POSIXlt(lt())),list(value=c(FALSE,TRUE,FALSE),visible=TRUE))})',
  ],
  [
    "is.nan direct and generic agreement",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.nan.POSIXlt(lt()),c(FALSE,FALSE,TRUE))&&identical(is.nan(lt()),c(FALSE,FALSE,TRUE))})',
  ],
  [
    "is.nan direct numeric conversion",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.nan.POSIXlt(c(0,Inf,NaN)),c(FALSE,FALSE,TRUE))})',
  ],
  [
    "is.nan direct NULL conversion",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.nan.POSIXlt(NULL),logical())})',
  ],
  [
    "is.nan missing",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.nan.POSIXlt()),\'argument "x" is missing, with no default\')&&identical(err(is.nan.POSIXlt(x=)),\'argument "x" is missing, with no default\')})',
  ],
  [
    "is.nan unused stays lazy",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};events<-character();message<-err(is.nan.POSIXlt({events<-c(events,"x");lt(0)},stop("extra forced")));identical(events,character())&&identical(message,\'unused argument (stop("extra forced"))\')})',
  ],
  [
    "is.nan duplicate stays lazy",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.nan.POSIXlt(x=stop("x"),x=stop("second"))),\'formal argument "x" matched by multiple actual arguments\')})',
  ],
  [
    "is.nan input once",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};count<-0L;y<-is.nan.POSIXlt({count<-count+1L;lt()});identical(count,1L)&&identical(y,c(FALSE,FALSE,TRUE))})',
  ],
  [
    "is.nan direct return visible",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(withVisible(is.nan.POSIXlt(lt())),list(value=c(FALSE,FALSE,TRUE),visible=TRUE))})',
  ],
  [
    "missing sec",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"sec",c(0,NA_real_))),list(c(TRUE,FALSE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "missing min",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"min",c(0,NA_real_))),list(c(TRUE,FALSE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "missing hour",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"hour",c(0,NA_real_))),list(c(TRUE,FALSE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "missing mday",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"mday",c(0,NA_real_))),list(c(TRUE,FALSE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "missing mon",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"mon",c(0,NA_real_))),list(c(TRUE,FALSE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "missing year",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"year",c(0,NA_real_))),list(c(TRUE,FALSE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "missing wday",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"wday",c(0,NA_real_))),list(c(TRUE,TRUE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "missing yday",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"yday",c(0,NA_real_))),list(c(TRUE,TRUE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "missing isdst",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(0,0)),"isdst",c(0,NA_real_))),list(c(TRUE,TRUE),c(FALSE,FALSE),c(FALSE,FALSE)))})',
  ],
  [
    "nonfinite seconds override other missing fields",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(put(lt(c(Inf,NaN,NA_real_)),"min",rep(NA_integer_,3))),list(rep(FALSE,3),c(TRUE,FALSE,FALSE),c(FALSE,TRUE,FALSE)))})',
  ],
  [
    "min out of range or fractional remains finite",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};all(is.finite(put(lt(c(0,0,0)),"min",c(-1,1.5,100))))})',
  ],
  [
    "hour out of range or fractional remains finite",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};all(is.finite(put(lt(c(0,0,0)),"hour",c(-1,1.5,100))))})',
  ],
  [
    "mday out of range or fractional remains finite",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};all(is.finite(put(lt(c(0,0,0)),"mday",c(-1,1.5,100))))})',
  ],
  [
    "mon out of range or fractional remains finite",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};all(is.finite(put(lt(c(0,0,0)),"mon",c(-1,1.5,100))))})',
  ],
  [
    "year out of range or fractional remains finite",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};all(is.finite(put(lt(c(0,0,0)),"year",c(-1,1.5,100))))})',
  ],
  [
    "year names missing mask and class removal",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};x<-lt(c(0,NaN));names(x)<-c(NA_character_,"two");attr(x,"note")<-"drop";identical(pred(x),list(setNames(c(TRUE,FALSE),c(NA_character_,"two")),setNames(c(FALSE,FALSE),c(NA_character_,"two")),setNames(c(FALSE,TRUE),c(NA_character_,"two"))))})',
  ],
  [
    "seconds names ignored",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};u<-unclass(lt(c(0,NaN)));names(u$sec)<-c("one","two");x<-structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC");identical(pred(x),list(c(TRUE,FALSE),c(FALSE,FALSE),c(FALSE,TRUE)))})',
  ],
  [
    "short year names padded missing",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};x<-put(lt(),"year",c(owned=70L));expectedNames<-c("owned",NA_character_,NA_character_);identical(pred(x),list(setNames(c(TRUE,FALSE,FALSE),expectedNames),setNames(c(FALSE,TRUE,FALSE),expectedNames),setNames(c(FALSE,FALSE,TRUE),expectedNames)))})',
  ],
  [
    "longer year determines length",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};x<-put(lt(0),"year",c(a=70L,b=71L,c=NA_integer_));identical(pred(x),list(c(a=TRUE,b=TRUE,c=FALSE),c(a=FALSE,b=FALSE,c=FALSE),c(a=FALSE,b=FALSE,c=FALSE)))})',
  ],
  [
    "seconds dimensions dropped",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};x<-put(lt(c(0,Inf)),"sec",matrix(c(0,Inf),1,dimnames=list("r",c("c1","c2"))));identical(pred(x),list(c(TRUE,FALSE),c(FALSE,TRUE),c(FALSE,FALSE)))})',
  ],
  [
    "too few fields",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(structure(list(sec=0),class=c("POSIXlt","POSIXt"),tzone="UTC"))),\'a valid "POSIXlt" object is a list of at least 9 elements\')})',
  ],
  [
    "component names required",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};u<-unclass(lt(0));names(u)<-NULL;identical(err(is.finite(structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC"))),\'a valid "POSIXlt" object has names\')})',
  ],
  [
    "partial field name rejected",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};u<-unclass(lt(0));names(u)[1]<-"s";identical(err(is.finite(structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC"))),"a valid \\"POSIXlt\\" object has element 1 with name \'s\' which should be \'sec\'")})',
  ],
  [
    "sec requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"sec","0"))),\'a valid "POSIXlt" object has a numeric element sec\')})',
  ],
  [
    "sec empty in nonempty object",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"sec",numeric()))),\'zero-length component [[1]] in non-empty "POSIXlt" structure\')})',
  ],
  [
    "min requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"min","0"))),\'a valid "POSIXlt" object has a numeric element min\')})',
  ],
  [
    "hour requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"hour","0"))),\'a valid "POSIXlt" object has a numeric element hour\')})',
  ],
  [
    "mday requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"mday","0"))),\'a valid "POSIXlt" object has a numeric element mday\')})',
  ],
  [
    "mon requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"mon","0"))),\'a valid "POSIXlt" object has a numeric element mon\')})',
  ],
  [
    "year requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"year","0"))),\'a valid "POSIXlt" object has a numeric element year\')})',
  ],
  [
    "year empty in nonempty object",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"year",numeric()))),\'zero-length component [[6]] in non-empty "POSIXlt" structure\')})',
  ],
  [
    "wday requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"wday","0"))),\'a valid "POSIXlt" object has a numeric element wday\')})',
  ],
  [
    "yday requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"yday","0"))),\'a valid "POSIXlt" object has a numeric element yday\')})',
  ],
  [
    "isdst requires numeric storage",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"isdst","0"))),\'a valid "POSIXlt" object has a numeric element isdst\')})',
  ],
  [
    "isdst empty in nonempty object",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"isdst",numeric()))),\'zero-length component [[9]] in non-empty "POSIXlt" structure\')})',
  ],
  [
    "direct unclassed list rejected",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite.POSIXlt(list(sec=0))),"do not know how to convert \'x\' to class \\"POSIXct\\"")})',
  ],
  [
    "UTC and GMT",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(pred(lt(0,"UTC")),list(TRUE,FALSE,FALSE))&&identical(pred(lt(0,"GMT")),list(TRUE,FALSE,FALSE))})',
  ],
  [
    "malformed timezone length",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(lt(0,c("UTC","GMT")))),\'attr(x, "tzone") should have length 1 or 3\')})',
  ],
  [
    "malformed timezone type",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(lt(0,1))),"invalid \'attr(x, \\"tzone\\")\'")})',
  ],
  [
    "subclass NextMethod",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};events<-character();is.finite.owned<-function(x){events<<-c(events,"method");NextMethod()};x<-lt(c(0,Inf));class(x)<-c("owned","POSIXlt","POSIXt");identical(list(is.finite(x),events),list(c(TRUE,FALSE),"method"))})',
  ],
  [
    "direct method bypasses input predicate",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};is.finite.owned<-function(x)stop("input predicate");x<-lt(0);class(x)<-c("owned","POSIXlt","POSIXt");identical(is.finite.POSIXlt(x),TRUE)})',
  ],
  [
    "local conversion method invisible to base closure",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};as.POSIXct.owned<-function(x,...)Inf;identical(err(is.finite.POSIXlt(structure(list(),class="owned"))),"do not know how to convert \'x\' to class \\"POSIXct\\"")})',
  ],
  [
    "local generic shadows ignored",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};as.POSIXct<-function(...)stop("local conversion");is.finite<-function(...)stop("local predicate");identical(is.finite.POSIXlt(lt(0)),TRUE)})',
  ],
  [
    "global conversion methods and names",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};events<-character();f<-function(x,...){events<<-c(events,"convert");structure(c(Inf,NaN,NA_real_),names=c("i","n","a"))};assign("as.POSIXct.owned_posix_pred",f,.GlobalEnv);on.exit(rm("as.POSIXct.owned_posix_pred",envir=.GlobalEnv));x<-structure(list(),class="owned_posix_pred");identical(list(is.finite.POSIXlt(x),is.infinite.POSIXlt(x),is.nan.POSIXlt(x),events),list(c(i=FALSE,n=FALSE,a=FALSE),c(i=TRUE,n=FALSE,a=FALSE),c(i=FALSE,n=TRUE,a=FALSE),rep("convert",3)))})',
  ],
  [
    "converted object redispatch and visibility",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};events<-character();f<-function(x,...){events<<-c(events,"convert");structure(Inf,class="converted_posix_pred")};p<-function(x){events<<-c(events,"predicate");invisible(17L)};assign("as.POSIXct.owned_posix_pred",f,.GlobalEnv);assign("is.finite.converted_posix_pred",p,.GlobalEnv);on.exit(rm(list=c("as.POSIXct.owned_posix_pred","is.finite.converted_posix_pred"),envir=.GlobalEnv));identical(list(withVisible(is.finite.POSIXlt(structure(list(),class="owned_posix_pred"))),events),list(list(value=17L,visible=TRUE),c("convert","predicate")))})',
  ],
  [
    "converted result reference identity",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};shared<-new.env();convert<-function(x,...)structure(1,class="converted_posix_pred");p<-function(x)shared;assign("as.POSIXct.owned_posix_pred",convert,.GlobalEnv);assign("is.nan.converted_posix_pred",p,.GlobalEnv);on.exit(rm(list=c("as.POSIXct.owned_posix_pred","is.nan.converted_posix_pred"),envir=.GlobalEnv));identical(is.nan.POSIXlt(structure(list(),class="owned_posix_pred")),shared)})',
  ],
  [
    "wday does not extend output",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite(put(lt(0),"wday",rep(0L,3))),TRUE)})',
  ],
  [
    "yday does not extend output",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite(put(lt(0),"yday",rep(0L,3))),TRUE)})',
  ],
  [
    "zone does not extend output",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite(put(lt(0),"zone",rep(0L,3))),TRUE)})',
  ],
  [
    "gmtoff does not extend output",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite(put(lt(0),"gmtoff",rep(0L,3))),TRUE)})',
  ],
  [
    "ignored does not extend output",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite(put(lt(0),"ignored",rep(0L,3))),TRUE)})',
  ],
  [
    "isdst extends output",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite(put(lt(0),"isdst",rep(0L,3))),rep(TRUE,3))})',
  ],
  [
    "extra zone components do not make empty input nonempty",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};u<-unclass(lt(numeric()));u$zone<-rep("UTC",3);u$gmtoff<-rep(0L,3);identical(is.finite(structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")),logical())})',
  ],
  [
    "empty timezone vector rejected",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(lt(0,character()))),\'attr(x, "tzone") should have length 1 or 3\')})',
  ],
  [
    "triple UTC timezone accepted",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite(lt(0,c("UTC","standard","summer"))),TRUE)})',
  ],
  [
    "sec logical storage rejected",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"sec",TRUE))),\'a valid "POSIXlt" object has a numeric element sec\')})',
  ],
  [
    "min logical storage rejected",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"min",TRUE))),\'a valid "POSIXlt" object has a numeric element min\')})',
  ],
  [
    "year logical storage rejected",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(err(is.finite(put(lt(0),"year",TRUE))),\'a valid "POSIXlt" object has a numeric element year\')})',
  ],
  [
    "factor field uses stored integer",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(is.finite(put(lt(0),"min",factor("a"))),TRUE)})',
  ],
  [
    "integer range coercion warning once",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();x<-put(lt(c(0,0,0)),"min",c(Inf,-Inf,NaN));y<-withCallingHandlers(is.finite(x),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(y,warnings),list(rep(FALSE,3),"NAs introduced by coercion to integer range"))})',
  ],
  [
    "unused weekday coerces and warns",
    'local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};pred<-function(x)list(is.finite(x),is.infinite(x),is.nan(x));err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();x<-put(lt(c(0,0,0)),"wday",c(Inf,-Inf,NaN));y<-withCallingHandlers(is.nan(x),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(y,warnings),list(rep(FALSE,3),"NAs introduced by coercion to integer range"))})',
  ],
  [
    "epoch seconds preserve fractions and nonfinite",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(as.numeric(as.POSIXct(lt(c(0,1.25,60,NA_real_,NaN,Inf,-Inf)))),c(0,1.25,60,NA_real_,NaN,Inf,-Inf))})',
  ],
  [
    "minute normalization",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(as.numeric(as.POSIXct(put(lt(c(0,0,0)),"min",c(-1,1.5,61)))),c(-60,60,3660))})',
  ],
  [
    "hour normalization",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(as.numeric(as.POSIXct(put(lt(c(0,0)),"hour",c(-1,25)))),c(-3600,90000))})',
  ],
  [
    "day normalization",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(as.numeric(as.POSIXct(put(lt(c(0,0)),"mday",c(0,32)))),c(-86400,2678400))})',
  ],
  [
    "month normalization",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(as.numeric(as.POSIXct(put(lt(c(0,0)),"mon",c(-1,12)))),c(-2678400,31536000))})',
  ],
  [
    "years before epoch",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(as.numeric(as.POSIXct(put(lt(c(0,0)),"year",c(69,0)))),c(-31536000,-2208988800))})',
  ],
  [
    "calendar missing becomes NA",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(as.numeric(as.POSIXct(put(lt(c(0,Inf,NaN)),"year",rep(NA_integer_,3)))),c(NA_real_,Inf,NaN))})',
  ],
  [
    "seconds recycled across years",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(as.numeric(as.POSIXct(put(lt(0.5),"year",c(70L,71L)))),c(0.5,31536000.5))})',
  ],
  [
    "conversion class and timezone",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};identical(class(as.POSIXct(lt(0))),c("POSIXct","POSIXt"))&&identical(attr(as.POSIXct(lt(0)),"tzone"),"UTC")})',
  ],
  [
    "conversion does not mutate input",
    'local({lt<-function(sec=c(0,Inf,NaN)){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone="UTC")};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};local({x<-put(lt(0),"min",61L);before<-x;y<-as.POSIXct(x);identical(x,before)&&identical(as.numeric(y),3660)})})',
  ],
  [
    "as.POSIXct full formals",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(type=typeof(as.POSIXct),formals=formals(as.POSIXct))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(type = "closure", formals = as.pairlist(alist(x = , tz = "", ... = ))), \n    warnings = character(0)))',
  ],
  [
    "as.POSIXct.POSIXlt full formals",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(type=typeof(as.POSIXct.POSIXlt),formals=formals(as.POSIXct.POSIXlt))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(type = "closure", formals = as.pairlist(alist(x = , tz = "", ... = ))), \n    warnings = character(0)))',
  ],
  [
    "as.POSIXct.numeric full formals",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(type=typeof(as.POSIXct.numeric),formals=formals(as.POSIXct.numeric))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(type = "closure", formals = as.pairlist(alist(x = , tz = "", origin = , ... = ))), \n    warnings = character(0)))',
  ],
  [
    "as.POSIXct.default full formals",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(type=typeof(as.POSIXct.default),formals=formals(as.POSIXct.default))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(type = "closure", formals = as.pairlist(alist(x = , tz = "", ... = ))), \n    warnings = character(0)))',
  ],
  [
    "as.POSIXct double no origin UTC",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(c(a=0,b=1.25,c=NA_real_,d=NaN,e=Inf,f=-Inf),tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(a = 0, b = 1.25, c = NA, d = NaN, e = Inf, \nf = -Inf), class = c("POSIXct", "POSIXt"), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "as.POSIXct integer no origin GMT",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(c(a=0L,b=1L,c=NA_integer_),tz="GMT")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(a = 0L, b = 1L, c = NA), class = c("POSIXct", \n"POSIXt"), tzone = "GMT"), warnings = character(0)))',
  ],
  [
    "as.POSIXct empty numeric UTC",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(numeric(),tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(numeric(0), class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "as.POSIXct string origin",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(c(0,1.25),tz="UTC",origin="2000-01-01")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(946684800, 946684801.25), class = c("POSIXct", \n"POSIXt"), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "as.POSIXct numeric origin",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(c(0,1.25),tz="UTC",origin=10)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(10, 11.25), class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "as.POSIXct explicit missing origin",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(1,tz="UTC",origin=)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(1, class = c("POSIXct", "POSIXt"), tzone = "UTC"), \n    warnings = character(0)))',
  ],
  [
    "as.POSIXct unused dots lazy",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(1,tz="UTC",owned=stop("dot"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(1, class = c("POSIXct", "POSIXt"), tzone = "UTC"), \n    warnings = character(0)))',
  ],
  [
    "as.POSIXct.numeric double no origin UTC",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(c(a=0,b=1.25,c=NA_real_,d=NaN,e=Inf,f=-Inf),tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(a = 0, b = 1.25, c = NA, d = NaN, e = Inf, \nf = -Inf), class = c("POSIXct", "POSIXt"), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "as.POSIXct.numeric integer no origin GMT",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(c(a=0L,b=1L,c=NA_integer_),tz="GMT")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(a = 0L, b = 1L, c = NA), class = c("POSIXct", \n"POSIXt"), tzone = "GMT"), warnings = character(0)))',
  ],
  [
    "as.POSIXct.numeric empty numeric UTC",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(numeric(),tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(numeric(0), class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "as.POSIXct.numeric string origin",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(c(0,1.25),tz="UTC",origin="2000-01-01")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(946684800, 946684801.25), class = c("POSIXct", \n"POSIXt"), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "as.POSIXct.numeric numeric origin",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(c(0,1.25),tz="UTC",origin=10)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(10, 11.25), class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "as.POSIXct.numeric explicit missing origin",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(1,tz="UTC",origin=)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(1, class = c("POSIXct", "POSIXt"), tzone = "UTC"), \n    warnings = character(0)))',
  ],
  [
    "as.POSIXct.numeric unused dots lazy",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(1,tz="UTC",owned=stop("dot"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(1, class = c("POSIXct", "POSIXt"), tzone = "UTC"), \n    warnings = character(0)))',
  ],
  [
    "generic NULL UTC",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(NULL,tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(integer(0), class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "default NULL UTC",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.default(NULL,tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(integer(0), class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "numeric method NULL rejects attribute",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(as.POSIXct.numeric(NULL,tz="UTC"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "attempt to set an attribute on NULL", warnings = character(0)))',
  ],
  [
    "default method numeric rejected",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(as.POSIXct.default(0,tz="UTC"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "do not know how to convert \'0\' to class \\"POSIXct\\"", \n    warnings = character(0)))',
  ],
  [
    "numeric existing attributes",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(structure(c(0,1),names=c(NA_character_,""),note="keep",class="owned"),tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(0, 1), names = c(NA, ""), note = "keep", class = c("POSIXct", \n"POSIXt"), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "numeric origin selected timezone",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.numeric(c(a=0,b=1),tz="GMT",origin=structure(10,class=c("POSIXct","POSIXt"),tzone="UTC"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(a = 10, b = 11), class = c("POSIXct", \n"POSIXt"), tzone = "GMT"), warnings = character(0)))',
  ],
  [
    "omitted timezone labels",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(attributes(as.POSIXct(NULL)),attributes(as.POSIXct(0)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(list(class = c("POSIXct", "POSIXt"), tzone = ""), \n    list(class = c("POSIXct", "POSIXt"), tzone = "")), warnings = character(0)))',
  ],
  [
    "origin before input and timezone",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({events<-character();mark<-function(k,v){events<<-c(events,k);v};value<-as.POSIXct.numeric(mark("x",1),tz=mark("tz","UTC"),origin=mark("origin",0),owned=mark("dot",1));list(value,events)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(structure(1, tzone = "UTC", class = c("POSIXct", \n"POSIXt")), c("origin", "x", "tz")), warnings = character(0)))',
  ],
  [
    "no origin input before timezone",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({events<-character();mark<-function(k,v){events<<-c(events,k);v};value<-as.POSIXct.numeric(mark("x",1),tz=mark("tz","UTC"),owned=mark("dot",1));list(value,events)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(structure(1, class = c("POSIXct", "POSIXt"), tzone = "UTC"), \n    c("x", "tz")), warnings = character(0)))',
  ],
  [
    "generic owned method leaves controls lazy",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.owned<-function(x,...){x;17L};as.POSIXct(structure(1,class="owned"),tz=stop("tz"),origin=stop("origin"),owned=stop("dot"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = 17L, warnings = character(0)))',
  ],
  [
    "POSIXlt unused origin and dots lazy",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.POSIXlt(lt(0),tz="UTC",origin=stop("origin"),owned=stop("dot"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(0, class = c("POSIXct", "POSIXt"), tzone = "UTC"), \n    warnings = character(0)))',
  ],
  [
    "explicit timezone overrides GMT metadata",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct.POSIXlt(lt(0,"GMT"),tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(0, class = c("POSIXct", "POSIXt"), tzone = "UTC"), \n    warnings = character(0)))',
  ],
  [
    "three overflowing vectors three warnings",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({u<-unclass(lt(c(0,0,0)));u$min<-c(Inf,-Inf,NaN);u$hour<-c(Inf,-Inf,NaN);u$wday<-c(Inf,-Inf,NaN);as.POSIXct(structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(NA_real_, NA_real_, NA_real_), class = c("POSIXct", \n"POSIXt"), tzone = "UTC"), warnings = c("NAs introduced by coercion to integer range", \n"NAs introduced by coercion to integer range", "NAs introduced by coercion to integer range"\n)))',
  ],
  [
    "eight overflowing vectors eight warnings",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({u<-unclass(lt(c(0,0)));for(i in 2:9)u[[i]]<-c(Inf,NaN);as.POSIXct(structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(NA_real_, NA_real_), class = c("POSIXct", \n"POSIXt"), tzone = "UTC"), warnings = c("NAs introduced by coercion to integer range", \n"NAs introduced by coercion to integer range", "NAs introduced by coercion to integer range", \n"NAs introduced by coercion to integer range", "NAs introduced by coercion to integer range", \n"NAs introduced by coercion to integer range", "NAs introduced by coercion to integer range", \n"NAs introduced by coercion to integer range")))',
  ],
  [
    "NaN without overflow is silent",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({u<-unclass(lt(0));u$min<-NaN;u$hour<-NaN;u$wday<-NaN;as.POSIXct(structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(NA_real_, class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "coercion warning before component length error",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({u<-unclass(lt(0));u$min<-Inf;u$hour<-numeric();err(as.POSIXct(structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "zero-length component [[3]] in non-empty \\"POSIXlt\\" structure", \n    warnings = "NAs introduced by coercion to integer range"))',
  ],
  [
    "Gregorian century leap normalization",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({x<-lt(c(0,0,0));x<-put(x,"year",c(0L,100L,200L));x<-put(x,"mon",rep(1L,3));x<-put(x,"mday",rep(29L,3));as.numeric(as.POSIXct(x,tz="UTC"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c(-2203891200, 951782400, 4107542400), warnings = character(0)))',
  ],
  [
    "negative month and day crossing year",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.numeric(as.POSIXct(put(put(lt(0),"mon",-1L),"mday",0L),tz="UTC"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = -2764800, warnings = character(0)))',
  ],
  [
    "uneven recycling without warning",
    'identical(local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.POSIXct(put(put(lt(c(0,1,2)),"min",c(0L,1L)),"year",c(a=70L,b=71L)),tz="UTC")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(0, 31536061, 2), names = c("a", "b", \nNA), class = c("POSIXct", "POSIXt"), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "year endpoints",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=0.125,year=c(-1000,1000000)),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(c(-33765897599.875,31554743011200.125),character()))})',
  ],
  [
    "month endpoints",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=0.125,mon=c(-1200,1200)),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(c(-3155673599.875,3155760000.125),character()))})',
  ],
  [
    "day endpoints",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=0.125,mday=c(-3660,3660)),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(c(-316310399.875,316137600.125),character()))})',
  ],
  [
    "hour endpoints",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=0.125,hour=c(-10000,10000)),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(c(-35999999.875,36000000.125),character()))})',
  ],
  [
    "minute endpoints",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=0.125,min=c(-10000,10000)),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(c(-599999.875,600000.125),character()))})',
  ],
  [
    "seconds endpoints",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=c(-1000000,1000000)),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(c(-1000000,1000000),character()))})',
  ],
  [
    "combined lower",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=-1000000,year=-1000,mon=-1200,mday=-3660,hour=-10000,min=-10000),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(-37275568000,character()))})',
  ],
  [
    "combined upper",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=1000000,year=1000000,mon=1200,mday=3660,hour=10000,min=10000),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(31558252422400,character()))})',
  ],
  [
    "leap centuries",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=0,year=c(0,100,200),mon=1,mday=29),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(c(-2203891200,951782400,4107542400),character()))})',
  ],
  [
    "wide years mixed months",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=0.125,year=c(999998,999999,1000000),mon=c(1,1,1),mday=29),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(c(31554685036800.125,31554716572800.125,31554748108800.125),character()))})',
  ],
  [
    "wide years negative fractional second",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=-0.125,year=1000000),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(31554743011199.875,character()))})',
  ],
  [
    "wide years positive fractional second",
    'local({lt<-function(sec=0,year=70,mon=0,mday=1,hour=0,min=0){structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")};warnings<-character();value<-withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec=0.125,year=1000000),tz="UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value,warnings),list(31554743011200.125,character()))})',
  ],
  [
    "all predicate methods retain returned reference",
    'local({ans<-local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);capture<-function(expr){warnings<-character();value<-withCallingHandlers(expr,warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)};shared<-new.env(parent=emptyenv());shared$marker<-23L;convert<-function(x,...)structure(1,class="converted_posix_evidence");p<-function(x)shared;assign("as.POSIXct.owned_posix_evidence",convert,.GlobalEnv);assign("is.finite.converted_posix_evidence",p,.GlobalEnv);assign("is.infinite.converted_posix_evidence",p,.GlobalEnv);assign("is.nan.converted_posix_evidence",p,.GlobalEnv);on.exit(rm(list=c("as.POSIXct.owned_posix_evidence","is.finite.converted_posix_evidence","is.infinite.converted_posix_evidence","is.nan.converted_posix_evidence"),envir=.GlobalEnv));x<-structure(list(),class="owned_posix_evidence");list(shared=shared,finite=is.finite.POSIXlt(x),infinite=is.infinite.POSIXlt(x),nan=is.nan.POSIXlt(x))});identical(ans$shared,ans$finite)&&identical(ans$shared,ans$infinite)&&identical(ans$shared,ans$nan)&&identical(ans$shared$marker,23L)})',
  ],
  [
    "numeric conversion preserves source and reference attribute",
    'local({ans<-local({lt<-function(sec=c(0,Inf,NaN),tz="UTC"){n<-length(sec);structure(list(sec=sec,min=rep(0L,n),hour=rep(0L,n),mday=rep(1L,n),mon=rep(0L,n),year=rep(70L,n),wday=rep(4L,n),yday=rep(0L,n),isdst=rep(0L,n)),class=c("POSIXlt","POSIXt"),tzone=tz)};put<-function(x,field,value){u<-unclass(x);u[field]<-list(value);structure(u,class=c("POSIXlt","POSIXt"),tzone="UTC")};err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);capture<-function(expr){warnings<-character();value<-withCallingHandlers(expr,warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)};shared<-new.env(parent=emptyenv());shared$marker<-29L;x<-structure(c(a=0,b=1.25),class="owned",note=shared);y<-as.POSIXct.numeric(x,tz="UTC");list(shared=shared,original=list(value=x,note=attr(x,"note")),converted=list(value=y,note=attr(y,"note")))});identical(ans$shared,ans$original$note)&&identical(ans$shared,ans$converted$note)&&identical(class(ans$original$value),"owned")&&identical(class(ans$converted$value),c("POSIXct","POSIXt"))&&identical(ans$shared$marker,29L)})',
  ],
  [
    "warning before later bad storage",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(put(lt(), "min", Inf), "hour", "bad"), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "a valid \\"POSIXlt\\" object has a numeric element hour"), \n    warnings = character(0)))',
  ],
  [
    "early empty before later warning",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(put(lt(), "min", numeric()), "hour", Inf), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "zero-length component [[2]] in non-empty \\"POSIXlt\\" structure"), \n    warnings = "NAs introduced by coercion to integer range"))',
  ],
  [
    "empty sec before later warning",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(numeric()), "min", Inf), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "zero-length component [[1]] in non-empty \\"POSIXlt\\" structure"), \n    warnings = "NAs introduced by coercion to integer range"))',
  ],
  [
    "nonfinite sec with integer overflow",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(c(Inf, -Inf, NaN, NA_real_)), "min", Inf), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(Inf, -Inf, NaN, NA), class = c("POSIXct", \n"POSIXt"), tzone = "UTC"), warnings = "NAs introduced by coercion to integer range"))',
  ],
  [
    "nonfinite sec with empty component",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(c(Inf, NaN)), "hour", numeric()), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "zero-length component [[3]] in non-empty \\"POSIXlt\\" structure"), \n    warnings = character(0)))',
  ],
  [
    "nonfinite sec with bad storage",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(c(Inf, NaN)), "hour", "bad"), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "a valid \\"POSIXlt\\" object has a numeric element hour"), \n    warnings = character(0)))',
  ],
  [
    "warning before bad timezone",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(structure(unclass(put(lt(), "min", Inf)), class = c("POSIXlt", "POSIXt"), tzone = 1)),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "invalid \'attr(x, \\"tzone\\")\'"), warnings = "NAs introduced by coercion to integer range"))',
  ],
  [
    "all primary empty auxiliary overflow",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(structure(list(sec = numeric(), min = integer(), hour = integer(), mday = integer(), mon = integer(), year = integer(), wday = Inf, yday = integer(), isdst = integer()), class = c("POSIXlt", "POSIXt"), tzone = "UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(numeric(0), class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = "NAs introduced by coercion to integer range"))',
  ],
  [
    "POSIXlt force input and timezone",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    events <- character()\n    m <- function(k, v) {\n        events <<- c(events, k)\n        v\n    }\n    value <- as.POSIXct.POSIXlt(m("x", lt()), tz = m("tz", "UTC"))\n    list(value = value, events = events)\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(value = structure(0, class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), events = c("x", "tz")), warnings = character(0)))',
  ],
  [
    "bad component and timezone promise",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    events <- character()\n    m <- function(k, v) {\n        events <<- c(events, k)\n        v\n    }\n    value <- tryCatch(as.POSIXct.POSIXlt(m("x", put(lt(), "hour", "bad")), tz = m("tz", stop("tz forced"))), error = conditionMessage)\n    list(value = value, events = events)\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(value = "tz forced", events = c("x", "tz")), \n    warnings = character(0)))',
  ],
  [
    "existing POSIXct direct default omitted tz",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    x <- structure(c(a = 0, b = 1.25), class = c("POSIXct", "POSIXt"), tzone = "GMT", note = "keep")\n    list(value = as.POSIXct.default(x), same = identical(as.POSIXct.default(x), x))\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(value = structure(c(a = 0, b = 1.25), class = c("POSIXct", \n"POSIXt"), tzone = "GMT", note = "keep"), same = TRUE), warnings = character(0)))',
  ],
  [
    "existing POSIXct generic explicit UTC",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    x <- structure(c(a = 0, b = 1.25), class = c("POSIXct", "POSIXt"), tzone = "GMT", note = "keep")\n    as.POSIXct(x, tz = "UTC")\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(a = 0, b = 1.25), class = c("POSIXct", \n"POSIXt"), tzone = "UTC", note = "keep"), warnings = character(0)))',
  ],
  [
    "existing POSIXct direct default lazy controls",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    x <- structure(1, class = c("POSIXct", "POSIXt"), tzone = "GMT")\n    as.POSIXct.default(x, tz = stop("tz forced"), origin = stop("origin forced"), unused = stop("dots forced"))\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "tz forced"), warnings = character(0)))',
  ],
  [
    "existing POSIXct integer storage",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    x <- structure(c(a = 0L, b = NA_integer_), class = c("POSIXct", "POSIXt"), tzone = "GMT", note = "keep")\n    as.POSIXct.default(x, tz = "UTC")\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(a = 0L, b = NA), class = c("POSIXct", \n"POSIXt"), tzone = "UTC", note = "keep"), warnings = character(0)))',
  ],
  [
    "character generic UTC names and attributes",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct(structure(c(a = "1970-01-01 00:00:01", b = NA_character_), note = "drop"), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(a = 1, b = NA), class = c("POSIXct", \n"POSIXt"), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "uniform character direct default GMT",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.default(c("2000-02-29 12:34:56", "1970-01-01 00:00:00"), tz = "GMT"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(951827696, 0), class = c("POSIXct", \n"POSIXt"), tzone = "GMT"), warnings = character(0)))',
  ],
  [
    "character direct default ignores origin and unrelated dots",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.default("1970-01-01 00:00:01", tz = "UTC", origin = stop("origin forced"), unused = stop("dots forced")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(1, class = c("POSIXct", "POSIXt"), tzone = "UTC"), \n    warnings = character(0)))',
  ],
  [
    "wide year half ULP",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec = c(2^-9, 2^-9 + 2^-30, -2^-9, -2^-9 - 2^-30), year = 1e+06), tz = "UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = c(31554743011200, 31554743011200.004, 31554743011200, \n31554743011199.996), warnings = character(0)))',
  ],
  [
    "wide year carried fractional seconds",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.numeric(as.POSIXct.POSIXlt(lt(sec = c(59.999, 60.001, -59.999, -60.001), year = 1e+06, min = -10000, hour = 10000), tz = "UTC")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = c(31554778411260, 31554778411260, 31554778411140, \n31554778411140), warnings = character(0)))',
  ],
  [
    "numeric scalar origin preserves x attributes",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.numeric(structure(c(a = 0, b = 1), note = "keep"), origin = 10, tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(a = 10, b = 11), note = "keep", class = c("POSIXct", \n"POSIXt"), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "numeric owned origin conversion",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    assign("as.POSIXct.originOwned", function(x, ...) structure(10, class = c("POSIXct", "POSIXt"), tzone = "UTC"), globalenv())\n    on.exit(rm("as.POSIXct.originOwned", envir = globalenv()))\n    as.POSIXct.numeric(c(0, 1), origin = structure(5, class = "originOwned"), tz = "UTC")\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(c(10, 11), class = c("POSIXct", "POSIXt"\n), tzone = "UTC"), warnings = character(0)))',
  ],
  [
    "all names versus early storage",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    x <- unclass(put(lt(), "sec", "bad"))\n    names(x)[9] <- "oops"\n    as.POSIXct.POSIXlt(structure(x, class = c("POSIXlt", "POSIXt"), tzone = "UTC"), tz = "UTC")\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "a valid \\"POSIXlt\\" object has element 9 with name \'oops\' which should be \'isdst\'"), \n    warnings = character(0)))',
  ],
  [
    "bad storage versus numeric tz",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(), "hour", "bad"), tz = 1),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "a valid \\"POSIXlt\\" object has a numeric element hour"), \n    warnings = character(0)))',
  ],
  [
    "warning versus numeric tz",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(), "min", Inf), tz = 1),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "invalid \'tz\' value"), warnings = "NAs introduced by coercion to integer range"))',
  ],
  [
    "bad storage versus multi tz",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(), "hour", "bad"), tz = c("UTC", "GMT")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "a valid \\"POSIXlt\\" object has a numeric element hour"), \n    warnings = character(0)))',
  ],
  [
    "warning versus multi tz",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(), "min", Inf), tz = c("UTC", "GMT")),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "invalid \'tz\' value"), warnings = "NAs introduced by coercion to integer range"))',
  ],
  [
    "POSIXct default empty tz and lazy dots",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(local({\n    x <- structure(1, class = c("POSIXct", "POSIXt"), tzone = "GMT")\n    as.POSIXct.default(x, tz = "", origin = stop("origin forced"), unused = stop("dots forced"))\n}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = structure(1, class = c("POSIXct", "POSIXt"), tzone = ""), \n    warnings = character(0)))',
  ],
  [
    "empty component versus numeric tz",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(put(lt(), "hour", numeric()), tz = 1),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "invalid \'tz\' value"), warnings = character(0)))',
  ],
  [
    "explicit UTC with malformed tzone attribute",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(structure(unclass(lt()), class = c("POSIXlt", "POSIXt"), tzone = 1), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "invalid \'attr(x, \\"tzone\\")\'"), warnings = character(0)))',
  ],
  [
    "explicit UTC with multielement tzone attribute",
    'identical(local({lt <- function(sec = 0, year = 70, mon = 0, mday = 1, hour = 0, min = 0) {\n    structure(list(sec = sec, min = min, hour = hour, mday = mday, mon = mon, year = year, wday = 0L, yday = 0L, isdst = 0L), class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};\nput <- function(x, n, v) {\n    u <- unclass(x)\n    u[n] <- list(v)\n    structure(u, class = c("POSIXlt", "POSIXt"), tzone = "UTC")\n};warnings<-character();value<-tryCatch(withCallingHandlers(as.POSIXct.POSIXlt(structure(unclass(lt()), class = c("POSIXlt", "POSIXt"), tzone = c("UTC", "GMT")), tz = "UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "attr(x, \\"tzone\\") should have length 1 or 3"), \n    warnings = character(0)))',
  ],
  [
    "integer scalar origin",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(as.POSIXct.numeric(1L,origin=0L,tz="UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(1L,class=c("POSIXct","POSIXt"),tzone="UTC"),warnings=character()))',
  ],
  [
    "integer max plus one origin",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(as.POSIXct.numeric(2147483647L,origin=1L,tz="UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(NA_integer_,class=c("POSIXct","POSIXt"),tzone="UTC"),warnings="NAs produced by integer overflow"))',
  ],
  [
    "integer input note",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(as.POSIXct.numeric(structure(1L,note="keep"),origin=10L,tz="UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(11L,note="keep",class=c("POSIXct","POSIXt"),tzone="UTC"),warnings=character()))',
  ],
  [
    "integer origin note",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(as.POSIXct.numeric(structure(1L,note="input"),origin=structure(10L,note="origin"),tz="UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(11L,note="origin",class=c("POSIXct","POSIXt"),tzone="UTC"),warnings=character()))',
  ],
  [
    "positive integer boundary .1",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(as.POSIXct.POSIXlt(lt(2147483647.1),tz="UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(Inf,class=c("POSIXct","POSIXt"),tzone="UTC"),warnings=character()))',
  ],
  [
    "positive integer boundary .9",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(as.POSIXct.POSIXlt(lt(2147483647.9),tz="UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(Inf,class=c("POSIXct","POSIXt"),tzone="UTC"),warnings=character()))',
  ],
  [
    "negative integer boundary .1",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(as.POSIXct.POSIXlt(lt(-2147483647.1),tz="UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(Inf,class=c("POSIXct","POSIXt"),tzone="UTC"),warnings=character()))',
  ],
  [
    "negative integer boundary .9",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(as.POSIXct.POSIXlt(lt(-2147483647.9),tz="UTC"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(Inf,class=c("POSIXct","POSIXt"),tzone="UTC"),warnings=character()))',
  ],
  [
    "forwarded missing origin",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(local({f<-function(origin)as.POSIXct.numeric(1L,origin=origin,tz="UTC");f()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(1L,class=c("POSIXct","POSIXt"),tzone="UTC"),warnings=character()))',
  ],
  [
    "forwarded missing default timezone",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(local({f<-function(tz)as.POSIXct.default(structure(1,class=c("POSIXct","POSIXt"),tzone="GMT"),tz=tz);f()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=structure(1,class=c("POSIXct","POSIXt"),tzone="GMT"),warnings=character()))',
  ],
  [
    "POSIXlt omitted timezone label",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(attr(as.POSIXct.POSIXlt(lt(0,sec=0,tz="GMT")),"tzone"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value="GMT",warnings=character()))',
  ],
  [
    "POSIXlt explicit empty timezone label",
    'identical(local({lt<-function(min=0,sec=Inf,tz="UTC"){structure(list(sec=sec,min=min,hour=0L,mday=1L,mon=0L,year=70L,wday=4L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone=tz)};warnings<-character();value<-withCallingHandlers(attr(as.POSIXct.POSIXlt(lt(0,sec=0,tz="GMT"),tz=""),"tzone"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value="",warnings=character()))',
  ],
  [
    "numeric conversion replaces existing class without moving its attribute slot",
    'local({shared<-new.env(parent=emptyenv());x<-structure(c(a=0,b=1.25),class="owned",note=shared);y<-as.POSIXct.numeric(x,tz="UTC");identical(names(attributes(x)),c("names","class","note"))&&identical(names(attributes(y)),c("names","class","note","tzone"))&&identical(attr(x,"note"),shared)&&identical(attr(y,"note"),shared)&&identical(class(x),"owned")&&identical(class(y),c("POSIXct","POSIXt"))})',
  ],
  [
    "numeric origin vector adds class before its new timezone attribute",
    'local({y<-as.POSIXct.numeric(c(0,1),origin=10,tz="UTC");identical(names(attributes(y)),c("class","tzone"))&&identical(as.numeric(y),c(10,11))})',
  ],
  [
    "integer scalar origin retains the inherited timezone attribute slot",
    'local({y<-as.POSIXct.numeric(1L,origin=0L,tz="UTC");identical(names(attributes(y)),c("tzone","class"))&&identical(unclass(y),structure(1L,tzone="UTC"))})',
  ],
  [
    "numeric origin arithmetic restores names after ordinary attributes",
    'local({x<-structure(c(a=0,b=1),note="keep");y<-as.POSIXct.numeric(x,origin=10,tz="UTC");identical(names(attributes(x)),c("names","note"))&&identical(names(attributes(y)),c("note","names","class","tzone"))&&identical(names(y),c("a","b"))&&identical(attr(y,"note"),"keep")&&identical(as.numeric(y),c(10,11))})',
  ],
] as const;

it.each(parityCases)("POSIXlt: %s", async (_name, code) => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(code);
    expect(result.value).toBe(true);
    expect(result.warnings).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});

const ownedLt = `lt<-function(sec=0,min=0L,hour=0L,mday=1L,mon=0L,year=70L)structure(list(sec=sec,min=min,hour=hour,mday=mday,mon=mon,year=year,wday=0L,yday=0L,isdst=0L),class=c("POSIXlt","POSIXt"),tzone="UTC")`;

it("rejects unsupported calendar ranges and zones while preserving nonfinite precedence", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await runtime.eval(`${ownedLt};NULL`);
    for (const [field, value] of [
      ["year", -1001],
      ["year", 1000001],
      ["mon", -1201],
      ["mon", 1201],
      ["mday", -3661],
      ["mday", 3661],
      ["hour", -10001],
      ["hour", 10001],
      ["min", -10001],
      ["min", 10001],
      ["sec", -1000001],
      ["sec", 1000001],
    ] as const) {
      await expect(runtime.eval(`as.POSIXct(lt(${field}=${value}))`)).rejects.toMatchObject({
        code: "NRU6257",
      });
      expect(await runtime.eval("as.numeric(as.POSIXct(lt()))")).toBe(0);
    }
    await expect(runtime.eval('as.POSIXct(lt(),tz="America/New_York")')).rejects.toMatchObject({
      code: "NRU6113",
    });
    expect(
      await runtime.eval(
        "identical(as.numeric(as.POSIXct(lt(sec=c(NA_real_,NaN,Inf,-Inf),year=1000001L))),c(NA_real_,NaN,Inf,-Inf))",
      ),
    ).toBe(true);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("bounds recycled output and component coercion work and recovers without mutating aliases", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 2000, maxVectorLength: 20000 },
  });
  try {
    await runtime.assign("v", new Float64Array(10000));
    await runtime.eval(`${ownedLt};rows<-lt(sec=v);coercions<-lt(min=v);NULL`);
    for (const input of ["rows", "coercions"]) {
      await expect(runtime.eval(`is.finite(${input})`)).rejects.toMatchObject({ code: "NRL4001" });
      expect(
        await runtime.eval(`length(unclass(${input})$${input === "rows" ? "sec" : "min"})`),
      ).toBe(10000);
      expect(await runtime.eval("as.numeric(as.POSIXct(lt(sec=.125)))")).toBe(0.125);
      expect(await runtime.eval("sys.nframe()")).toBe(0);
    }
    await expect(
      runtime.eval(
        'as.POSIXct.owned<-function(x,...)as.POSIXct(x);as.POSIXct(structure(1,class="owned"))',
      ),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await runtime.eval("1+1")).toBe(2);
  } finally {
    await runtime.dispose();
  }
});

it("checks aggregate conversion allocation before repeated component buffers", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 100000, maxVectorLength: 1000 },
  });
  try {
    await runtime.assign("v", new Float64Array(1000));
    await runtime.eval(
      'x<-structure(list(sec=v,min=v,hour=v,mday=v+1,mon=v,year=v+70,wday=v,yday=v,isdst=v),class=c("POSIXlt","POSIXt"),tzone="UTC");NULL',
    );
    await expect(runtime.eval("as.POSIXct(x);as.POSIXct(x)")).rejects.toMatchObject({
      code: "NRL4003",
    });
    expect(await runtime.eval("length(unclass(x)$year)")).toBe(1000);
    expect(await runtime.eval("unclass(x)$year[[1]]")).toBe(70);
    expect(await runtime.eval('as.numeric(as.POSIXct(0,tz="UTC"))')).toBe(0);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});
