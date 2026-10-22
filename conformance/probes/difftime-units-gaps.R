# Independently authored GNU R 4.6.1 black-box probes.
# Explicit remaining gaps; outside the bounded units compatibility claim.
# Native observations establish TRUE for these owned assertions. No foreign bodies are inspected.
check<-function(label,expr){result<-tryCatch(expr,error=function(e)conditionMessage(e));print(list(case=label,result=result))}
check("classed old units global comparison dispatch",local({events<-character();owned<-function(e1,e2){events<<-c(events,.Generic);NextMethod()};assign("Ops.owned",owned,.GlobalEnv);on.exit(rm("Ops.owned",envir=.GlobalEnv));x<-structure(120,class="difftime",units=structure("secs",class="owned"));y<-`units<-`(x,"mins");identical(list(events,as.numeric(y),attr(y,"units")),list("==",2,"mins"))}))
check("classed replacement global comparison dispatch",local({events<-character();owned<-function(e1,e2){events<<-c(events,.Generic);NextMethod()};assign("Ops.owned",owned,.GlobalEnv);on.exit(rm("Ops.owned",envir=.GlobalEnv));x<-structure(120,class="difftime",units="secs");label<-structure("mins",class="owned");y<-`units<-`(x,label);identical(list(events,as.numeric(y),attr(y,"units")),list("==",2,label))}))
check("classed label equality controls same branch",local({events<-character();owned<-function(e1,e2){events<<-c(events,.Generic);TRUE};assign("Ops.owned",owned,.GlobalEnv);on.exit(rm("Ops.owned",envir=.GlobalEnv));x<-structure(120,class="difftime",units=structure("secs",class="owned"));y<-`units<-`(x,"invalid");identical(events,"==")&&identical(x,y)}))
check("numeric source units indexing",local({x<-structure(120,class="difftime",units=2);y<-`units<-`(x,"mins");identical(as.numeric(y),120)&&identical(attr(y,"units"),"mins")}))
check("logical source units expand",local({x<-structure(120,class="difftime",units=TRUE);y<-`units<-`(x,"mins");identical(as.numeric(y),c(2,120,7200,172800,1209600))&&identical(attr(y,"units"),"mins")}))
check("factor replacement units retain factor and code scale",local({label<-factor("mins",levels=c("secs","mins"));x<-structure(120,class="difftime",units="secs");y<-`units<-`(x,label);identical(as.numeric(y),2)&&identical(attr(y,"units"),label)}))
check("integer implicit numeric fallback",local({units.numeric<-function(x)list("numeric",typeof(x),class(x));identical(units(1L),list("numeric","integer","integer"))}))
check("double implicit double method",local({units.double<-function(x)list("double",typeof(x),class(x));identical(units(1),list("double","double","numeric"))}))
check("integer matrix implicit numeric fallback",local({units.numeric<-function(x)list("numeric",typeof(x),class(x));identical(units(matrix(1:4,2)),list("numeric","integer",c("matrix","array")))}))
check("integer matrix storage precedence",local({units.numeric<-function(x)"numeric";units.integer<-function(x)"integer";identical(units(matrix(1:4,2)),"integer")}))
check("double array storage fallback",local({units.double<-function(x)"double";identical(units(array(1,c(1,1,1))),"double")}))
