# Independently authored black-box probes. No compatibility credit.
# Native GNU R 4.6.1 dimension order depends on the owned expression context.
check <- function(name, expr) {
  tryCatch(cat(if (isTRUE(force(expr))) "PASS" else "FAIL", name, "\n"),
           error=function(e) cat("ERROR", name, conditionMessage(e), "\n"))
}
check("dimensioned attribute order contexts", local({
  x <- structure(matrix(c(0,1), 1, dimnames=list("r",c("a","b"))), note="keep")
  identical(names(attributes(10+structure(matrix(c(0,1), 1,
            dimnames=list("r",c("a","b"))), note="keep"))),
            c("dim","note","dimnames")) &&
  identical(names(attributes(10+x)), c("note","dim","dimnames")) &&
  identical(names(attributes(as.POSIXct.numeric(x, origin=10, tz="UTC"))),
            c("note","dim","dimnames","class","tzone"))
}))
check("equal length vector versus matrix ordinary attribute precedence", local({
  x <- structure(matrix(c(0,1), 1, dimnames=list("r",c("a","b"))), note="right")
  y <- structure(c(10,20), names=c("x","y"), note="left")
  identical(attr(y+x,"note"),"left")
}))
check("as.complex strips attributes from existing complex input", local({
  x <- structure(c(a=1+2i,b=3-4i),note="keep")
  y <- as.complex(x)
  is.null(attributes(y)) && identical(y,c(1+2i,3-4i)) &&
    identical(names(attributes(x)),c("names","note"))
}))
