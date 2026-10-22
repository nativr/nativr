stopifnot(identical(as.character(getRversion()), "4.6.1"))
arguments <- commandArgs(trailingOnly = TRUE)
stopifnot(length(arguments) == 1L)
setwd(arguments[[1L]])
.probe <- new.env(parent = emptyenv())
.probe$events <- character()
.probe$nestedCount <- 0L
.probe$runnerAvailable <- NA
entrypoints <- sort(list.files("tests", pattern = "\\.[Rr]$", recursive = FALSE, full.names = TRUE))
allR <- sort(list.files("tests", pattern = "\\.[Rr]$", recursive = TRUE, full.names = TRUE))
nested <- allR[!allR %in% entrypoints]
attempted <- character()
outcome <- if (length(entrypoints)) "completed" else "no-entrypoint"
errorMessage <- ""
errorClasses <- character()
for (entrypoint in entrypoints) {
  attempted <- c(attempted, entrypoint)
  passed <- tryCatch({
    source(entrypoint, local = .GlobalEnv)
    TRUE
  }, error = function(condition) {
    errorMessage <<- conditionMessage(condition)
    errorClasses <<- class(condition)
    FALSE
  })
  if (!passed) {
    outcome <- "failed"
    break
  }
}
emit <- function(key, values) cat(paste0(key, "\t", paste(values, collapse = ","), "\n"))
emit("rVersion", as.character(getRversion()))
emit("outcome", outcome)
emit("entrypoints", entrypoints)
emit("nestedRFiles", nested)
emit("attemptedEntrypoints", attempted)
emit("events", .probe$events)
emit("nestedCount", as.character(.probe$nestedCount))
emit("runnerAvailable", as.character(.probe$runnerAvailable))
emit("errorMessage", errorMessage)
emit("errorClasses", errorClasses)
