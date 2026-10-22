.probe$events <- c(.probe$events, "top-enter")
.probe$runnerAvailable <- requireNamespace("nativrOwnedMissingRunnerClosure0a393", quietly = TRUE)
if (.probe$runnerAvailable) {
  source("tests/helpers/nested.R", local = .GlobalEnv)
}
.probe$events <- c(.probe$events, "top-exit")
