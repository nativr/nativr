# Independently authored scalar-token contract probes for the owned observer.
args<-commandArgs(trailingOnly=TRUE)
source(args[[1]],local=TRUE)
labels<-c("finite","positive-zero","negative-zero","na","nan","positive-infinity","negative-infinity")
values<-c(3.25,0,-0,NA_real_,NaN,Inf,-Inf)
token<-function(label){
  if(label=="finite")return(list(kind="double",value=3.25))
  if(label=="positive-zero")return(list(kind="double",value=0))
  list(kind=paste0("double-",label))
}
expected<-function(real,imaginary){
  if(real=="na"&&imaginary=="na")return(list(kind="complex-na"))
  r<-token(real);i<-token(imaginary)
  if(r$kind=="double"&&i$kind=="double")return(list(kind="complex",real=r$value,imaginary=i$value))
  list(kind="complex-components",real=r,imaginary=i)
}
passed<-0L
failed<-0L
for(r in seq_along(labels))for(i in seq_along(labels)){
  observed<-nativr_oracle_observe_graph(complex(real=values[[r]],imaginary=values[[i]]))$graph[[1]]$values[[1]]
  if(identical(observed,expected(labels[[r]],labels[[i]]))){passed<-passed+1L}else{
    failed<-failed+1L;cat("FAIL ",labels[[r]]," / ",labels[[i]],"\n",sep="")
  }
}
whole<-identical(nativr_oracle_observe_graph(NA_complex_)$graph[[1]]$values[[1]],list(kind="complex-na"))
if(failed != 0L || !whole) stop("Complex component-token observer fixture failed.",call.=FALSE)
cat("PASS complex component-token preflight (49 pairs; whole NA retained)\n")
