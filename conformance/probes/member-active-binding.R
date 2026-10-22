# Independently authored black-box probe, GNU R 4.6.1 / NativR profile 0.379.
# This is an open-gap reproduction, not a passing conformance case.
# Native events: rhs, get, get, set, method, set.
# NativR events: rhs, get, method, set. The final object agrees in this probe.
# Only owned values are printed; no native implementation or closure body is read.
local({
  events <- character()
  obj <- structure(list(a = 1L), class = "owned")
  `$<-.owned` <- function(x, name, value) {
    events <<- c(events, "method")
    attr(x, "note") <- value
    x
  }
  e <- new.env()
  makeActiveBinding("x", function(value) {
    if (missing(value)) {
      events <<- c(events, "get")
      obj
    } else {
      events <<- c(events, "set")
      obj <<- value
    }
  }, e)
  eval(quote(x$a <- { events <<- c(events, "rhs"); 2L }), e)
  print(list(events = events, value = obj))
})
