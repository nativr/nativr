.probe$events <- c(.probe$events, "top-enter")
source("tests/helpers/nested.R", local = .GlobalEnv)
.probe$events <- c(.probe$events, "top-exit")
