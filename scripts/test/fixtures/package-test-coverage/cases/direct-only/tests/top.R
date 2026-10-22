.probe$events <- c(.probe$events, "top-enter")
stopifnot(identical(2L + 3L, 5L))
.probe$events <- c(.probe$events, "top-exit")
