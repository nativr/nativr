# Independently authored remaining-gap observations. Not passing compatibility claims.
check<-function(label,expr){result<-tryCatch(expr,error=function(e)conditionMessage(e));print(list(case=label,result=result))}
check("NA real plus infinite imaginary remains infinite",identical(is.infinite(complex(real=NA_real_,imaginary=Inf)),TRUE))
check("infinite real plus NA imaginary remains infinite",identical(is.infinite(complex(real=Inf,imaginary=NA_real_)),TRUE))
check("NA real plus NaN imaginary remains NaN",identical(is.nan(complex(real=NA_real_,imaginary=NaN)),TRUE))
check("NaN real plus NA imaginary remains NaN",identical(is.nan(complex(real=NaN,imaginary=NA_real_)),TRUE))
check("mixed NA complex retains other component",local({x<-complex(real=NA_real_,imaginary=Inf);identical(Re(x),NA_real_)&&identical(Im(x),Inf)}))
check("POSIXlt methods produce named classification",local({x<-as.POSIXlt(c("2000-01-01",NA_character_),tz="UTC");names(x)<-c("a","b");identical(list(is.finite(x),is.infinite(x),is.nan(x)),list(c(a=TRUE,b=FALSE),c(a=FALSE,b=FALSE),c(a=FALSE,b=FALSE)))}))
