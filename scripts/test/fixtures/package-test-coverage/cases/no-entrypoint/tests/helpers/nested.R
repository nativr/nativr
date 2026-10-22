.probe$events <- c(.probe$events, "nested")
.probe$nestedCount <- .probe$nestedCount + 1L
stopifnot(identical(2L + 3L, 5L))
