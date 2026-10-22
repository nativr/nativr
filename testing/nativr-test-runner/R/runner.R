# Independent optional nativrTest runner, version 0.1.0.
# Specification: ../behavior-contract.md and ../reference/ observable evidence.
# No original testthat dependency closure, exact diagnostics, waldo or reporter compatibility.
.nr_state <- new.env(parent = emptyenv())
.nr_state$active <- FALSE

.nr_condition <- function(message, classes) {
  structure(list(message = message, call = NULL), class = c(classes, "condition"))
}
.nr_limit <- function(message) {
  .nr_state$aborted <- TRUE
  stop(.nr_condition(message, c("nativr_runner_limit", "error")))
}
.nr_emit <- function(type, fields = list()) {
  if (isTRUE(.nr_state$aborted)) .nr_limit("runner capture is already incomplete")
  if (length(.nr_state$events) >= .nr_state$max_events) .nr_limit("runner event limit reached")
  for (value in fields) {
    if (is.character(value)) {
      if (length(value) > 64L || anyNA(value) || any(nchar(value) > .nr_state$max_text_bytes)) .nr_limit("runner text limit reached")
      for (text in value) if (length(charToRaw(enc2utf8(text))) > .nr_state$max_text_bytes) .nr_limit("runner text limit reached")
    }
  }
  event <- c(list(sequence = length(.nr_state$events), type = type), fields)
  .nr_state$events[[length(.nr_state$events) + 1L]] <- event
  invisible(NULL)
}
.nr_active <- function() {
  if (!isTRUE(.nr_state$active)) stop("nativrTest runner is not active", call. = FALSE)
  if (isTRUE(.nr_state$aborted)) .nr_limit("runner capture is already incomplete")
}
.nr_issue <- function(code, message, api = NULL) {
  if (isTRUE(.nr_state$aborted)) return(invisible(NULL))
  .nr_emit("issue", list(path = .nr_state$path, testId = .nr_state$test_id,
                         code = code, api = api, message = message))
}
.nr_unsupported <- function(api) {
  if (isTRUE(.nr_state$active)) {
    .nr_state$unsupported <- TRUE
    .nr_issue("unsupported-api", paste0("unsupported runner API: ", api), api)
  }
  stop(.nr_condition(paste0("unsupported runner API: ", api), c("nativr_runner_unsupported", "error")))
}
.nr_text <- function(x, label) {
  if (!is.character(x) || length(x) != 1L || is.na(x)) stop(paste0(label, " must be one string"), call. = FALSE)
  x
}
.nr_controls <- function(info, label) {
  if (!is.null(info) || !is.null(label)) .nr_unsupported("diagnostic labels/info")
}
.nr_signal <- function(condition) {
  if (isTRUE(.nr_state$active) && is.null(.nr_state$test_id)) .nr_unsupported("expectation outside test")
  withRestarts({
    signalCondition(condition)
    if (inherits(condition, "error")) stop(condition)
    invisible(NULL)
  }, muffle_expectation = function() invisible(NULL))
}
pass <- function() {
  .nr_signal(.nr_condition("success", c("expectation_success", "expectation")))
  invisible(NULL)
}
fail <- function(message = "Failure has been forced", info = NULL, srcref = NULL,
                 trace_env = parent.frame(), trace = NULL) {
  if (!is.null(info) || !is.null(srcref) || !missing(trace_env) || !is.null(trace)) .nr_unsupported("fail diagnostic controls")
  .nr_signal(.nr_condition(.nr_text(message, "message"), c("expectation_failure", "expectation", "error")))
  invisible(NULL)
}
succeed <- function(message = "Success has been forced", info = NULL) {
  if (!is.null(info)) .nr_unsupported("succeed info")
  condition <- .nr_condition(.nr_text(message, "message"), c("expectation_success", "expectation"))
  .nr_signal(condition)
  invisible(condition)
}
expect_true <- function(object, info = NULL, label = NULL) {
  .nr_controls(info, label)
  actual <- object
  if (isTRUE(actual)) pass() else fail("expected one TRUE logical value")
  invisible(actual)
}
expect_false <- function(object, info = NULL, label = NULL) {
  .nr_controls(info, label)
  actual <- object
  if (isFALSE(actual)) pass() else fail("expected one FALSE logical value")
  invisible(actual)
}
expect_identical <- function(...) .nr_unsupported("expect_identical: waldo comparison")
expect_equal <- function(...) .nr_unsupported("expect_equal: waldo comparison")
expect_snapshot <- function(...) .nr_unsupported("expect_snapshot")

.nr_expect_condition <- function(code, environment, kind, regexp, class, controls, inherit, info, label) {
  .nr_controls(info, label)
  if (!isTRUE(inherit)) .nr_unsupported("condition ancestry controls")
  if (length(controls) > 1L || (length(controls) == 1L && !identical(names(controls), "fixed"))) .nr_unsupported("condition matching controls")
  fixed <- length(controls) == 1L && isTRUE(controls[[1L]])
  absent <- is.logical(regexp) && length(regexp) == 1L && is.na(regexp)
  if (!is.null(regexp) && !absent) {
    .nr_text(regexp, "regexp")
    if (!fixed) .nr_unsupported("regular-expression condition matching")
  }
  if (!is.null(class)) .nr_text(class, "class")
  if (absent && !is.null(class)) .nr_unsupported("absence with class matching")
  if (absent && kind != "error") .nr_unsupported("warning/message absence form")
  captured <- NULL
  result <- NULL
  matches <- function(condition) {
    if (!is.null(condition$parent)) .nr_unsupported("chained condition ancestry")
    (is.null(class) || inherits(condition, class)) &&
      (is.null(regexp) || absent || grepl(regexp, conditionMessage(condition), fixed = TRUE))
  }
  handler <- function(condition) {
    if (!is.null(captured) || !matches(condition)) return(invisible(NULL))
    captured <<- condition
    invokeRestart(if (kind == "warning") "muffleWarning" else "muffleMessage")
  }
  if (kind == "error") {
    result <- tryCatch(eval(code, envir = environment), error = function(condition) {
      if (!matches(condition)) stop(condition)
      captured <<- condition
      NULL
    })
  } else if (kind == "warning") {
    result <- withCallingHandlers(eval(code, envir = environment), warning = handler)
  } else {
    result <- withCallingHandlers(eval(code, envir = environment), message = handler)
  }
  if (absent) {
    if (is.null(captured)) pass() else fail("unexpected error")
    return(invisible(result))
  }
  if (is.null(captured)) fail(paste0("expected a matching ", kind)) else pass()
  invisible(captured)
}
expect_error <- function(object, regexp = NULL, class = NULL, ..., inherit = TRUE, info = NULL, label = NULL) {
  .nr_expect_condition(substitute(object), parent.frame(), "error", regexp, class, list(...), inherit, info, label)
}
expect_warning <- function(object, regexp = NULL, class = NULL, ..., inherit = TRUE, all = FALSE, info = NULL, label = NULL) {
  if (!identical(all, FALSE)) .nr_unsupported("expect_warning all")
  .nr_expect_condition(substitute(object), parent.frame(), "warning", regexp, class, list(...), inherit, info, label)
}
expect_message <- function(object, regexp = NULL, class = NULL, ..., inherit = TRUE, all = FALSE, info = NULL, label = NULL) {
  if (!identical(all, FALSE)) .nr_unsupported("expect_message all")
  .nr_expect_condition(substitute(object), parent.frame(), "message", regexp, class, list(...), inherit, info, label)
}
skip <- function(message = "Skipping") {
  if (isTRUE(.nr_state$active) && is.null(.nr_state$test_id)) .nr_unsupported("skip outside test")
  stop(.nr_condition(paste0("Reason: ", .nr_text(message, "message")), "skip"))
}
skip_if <- function(condition, message = NULL) {
  if (isTRUE(condition)) skip(if (is.null(message)) "condition is TRUE" else message)
  invisible(NULL)
}
skip_if_not <- function(condition, message = NULL) {
  if (!isTRUE(condition)) skip(if (is.null(message)) "condition is not TRUE" else message)
  invisible(NULL)
}

.nr_run_code <- function(code, environment) {
  thunk <- eval(substitute(function() BODY, list(BODY = code)), envir = environment)
  thunk()
}
.nr_condition_event <- function(kind, condition) {
  .nr_emit("condition", list(testId = .nr_state$test_id, conditionKind = kind,
                             classNames = class(condition), message = conditionMessage(condition), handled = TRUE))
}
test_that <- function(desc, code) {
  .nr_active()
  if (is.null(.nr_state$path)) .nr_unsupported("test_that outside run_file")
  if (!is.null(.nr_state$test_id)) .nr_unsupported("nested test_that")
  description <- .nr_text(desc, "description")
  .nr_state$next_test <- .nr_state$next_test + 1L
  .nr_state$test_id <- .nr_state$next_test
  on.exit(.nr_state$test_id <- NULL)
  .nr_emit("test-start", list(path = .nr_state$path, testId = .nr_state$test_id, description = description))
  successes <- failures <- 0L
  outcome <- "passed"
  tryCatch(withCallingHandlers(.nr_run_code(substitute(code), new.env(parent = parent.frame())),
    expectation = function(condition) {
      ok <- inherits(condition, "expectation_success")
      if (!ok && !inherits(condition, "expectation_failure")) .nr_unsupported("custom expectation condition")
      if (ok) successes <<- successes + 1L else failures <<- failures + 1L
      .nr_emit("expectation", list(testId = .nr_state$test_id, api = "expectation",
                                   outcome = if (ok) "passed" else "failed", message = conditionMessage(condition)))
      invokeRestart("muffle_expectation")
    },
    warning = function(condition) { .nr_condition_event("warning", condition); invokeRestart("muffleWarning") },
    message = function(condition) { .nr_condition_event("message", condition); invokeRestart("muffleMessage") }
  ), skip = function(condition) {
    outcome <<- "skipped"
    .nr_emit("skip", list(testId = .nr_state$test_id, message = conditionMessage(condition)))
  }, error = function(condition) {
    if (inherits(condition, "nativr_runner_limit")) {
      outcome <<- "aborted"
    } else if (inherits(condition, "nativr_runner_unsupported")) {
      outcome <<- "unsupported"
    } else {
      outcome <<- "error"
      .nr_condition_event("error", condition)
      .nr_issue("unexpected-error", conditionMessage(condition))
    }
  })
  if (outcome == "passed" && failures > 0L) outcome <- "failed"
  if (outcome == "passed" && successes + failures == 0L) {
    outcome <- "skipped"
    .nr_issue("no-expectations", "empty test")
  }
  if (failures > 0L || outcome %in% c("failed", "error")) .nr_state$failed <- TRUE
  if (!isTRUE(.nr_state$aborted)) .nr_emit("test-end", list(testId = .nr_state$test_id, outcome = outcome))
  invisible(NULL)
}
setup <- function(code, env = parent.frame()) {
  .nr_active()
  if (is.null(.nr_state$path) || !is.null(.nr_state$test_id)) .nr_unsupported("setup outside file scope")
  .nr_emit("lifecycle", list(path = .nr_state$path, testId = NULL, phase = "setup", outcome = "started"))
  tryCatch(eval(substitute(code), envir = new.env(parent = env)), error = function(condition) {
    .nr_state$failed <- TRUE
    .nr_issue("setup-failed", conditionMessage(condition))
    if (!isTRUE(.nr_state$aborted)) .nr_emit("lifecycle", list(path = .nr_state$path, testId = NULL, phase = "setup", outcome = "failed"))
    stop(condition)
  })
  .nr_emit("lifecycle", list(path = .nr_state$path, testId = NULL, phase = "setup", outcome = "completed"))
  invisible(NULL)
}
teardown <- function(code, env = parent.frame()) {
  .nr_active()
  if (is.null(.nr_state$path) || !is.null(.nr_state$test_id)) .nr_unsupported("teardown outside file scope")
  .nr_state$cleanups[[length(.nr_state$cleanups) + 1L]] <- list(code = substitute(code), environment = env)
  invisible(NULL)
}
run_file <- function(path, code) {
  .nr_active()
  if (!is.null(.nr_state$path)) .nr_unsupported("nested run_file")
  path <- .nr_text(path, "path")
  .nr_state$path <- path
  .nr_state$cleanups <- list()
  on.exit({ .nr_state$path <- NULL; .nr_state$cleanups <- list() })
  .nr_emit("file-start", list(path = path))
  tryCatch(eval(substitute(code), envir = new.env(parent = parent.frame())), error = function(condition) {
    if (!inherits(condition, "nativr_runner_unsupported") && !inherits(condition, "nativr_runner_limit")) {
      .nr_state$failed <- TRUE
      .nr_issue("unexpected-error", conditionMessage(condition))
    }
  })
  for (cleanup in .nr_state$cleanups) {
    if (isTRUE(.nr_state$aborted)) break
    .nr_emit("lifecycle", list(path = path, testId = NULL, phase = "cleanup", outcome = "started"))
    ok <- TRUE
    tryCatch(eval(cleanup$code, envir = cleanup$environment), error = function(condition) {
      ok <<- FALSE
      .nr_state$failed <- TRUE
      .nr_issue("cleanup-failed", conditionMessage(condition))
    })
    if (!isTRUE(.nr_state$aborted)) .nr_emit("lifecycle", list(path = path, testId = NULL, phase = "cleanup", outcome = if (ok) "completed" else "failed"))
  }
  if (!isTRUE(.nr_state$aborted)) .nr_emit("file-end", list(path = path))
  invisible(NULL)
}
run_tests <- function(code, max_events = 1000L, max_text_bytes = 8192L) {
  if (isTRUE(.nr_state$active)) .nr_unsupported("nested run_tests")
  if (!is.numeric(max_events) || length(max_events) != 1L || is.na(max_events) || max_events < 2 || max_events > 10000 || max_events != as.integer(max_events)) stop("invalid runner event limit", call. = FALSE)
  if (!is.numeric(max_text_bytes) || length(max_text_bytes) != 1L || is.na(max_text_bytes) || max_text_bytes < 1 || max_text_bytes > 65536 || max_text_bytes != as.integer(max_text_bytes)) stop("invalid runner text limit", call. = FALSE)
  .nr_state$active <- TRUE
  .nr_state$events <- list()
  .nr_state$path <- .nr_state$test_id <- NULL
  .nr_state$next_test <- 0L
  .nr_state$failed <- .nr_state$unsupported <- .nr_state$aborted <- FALSE
  .nr_state$max_events <- max_events
  .nr_state$max_text_bytes <- max_text_bytes
  on.exit(.nr_state$active <- FALSE)
  .nr_emit("run-start")
  tryCatch(eval(substitute(code), envir = parent.frame()), error = function(condition) {
    if (!inherits(condition, "nativr_runner_limit") && !inherits(condition, "nativr_runner_unsupported")) {
      .nr_state$failed <- TRUE
      tryCatch(.nr_issue("unexpected-error", conditionMessage(condition)),
               nativr_runner_limit = function(limit) invisible(NULL))
    }
  })
  if (!isTRUE(.nr_state$aborted)) tryCatch(.nr_emit("run-end"), nativr_runner_limit = function(condition) invisible(NULL))
  outcome <- if (.nr_state$aborted) "aborted" else if (.nr_state$unsupported) "partial" else if (.nr_state$failed) "failed" else if (.nr_state$next_test == 0L) "no-tests" else "completed"
  list(kind = "nativr-test-core-events", schemaVersion = 1L,
       runner = list(id = "nativr-cleanroom-test-runner", package = "nativrTest", version = "0.1.0"),
       normativeTierCredit = FALSE, originalDependencyClosureSatisfied = FALSE,
       outcome = outcome, eventsComplete = !.nr_state$aborted, events = .nr_state$events)
}
runner_info <- function() list(
  id = "nativr-cleanroom-test-runner", package = "nativrTest", version = "0.1.0",
  documentationTarget = "testthat 3.3.2 edition 3", normativeTierCredit = FALSE,
  unsupported = c("waldo comparisons", "exact failure diagnostics", "regex condition matching",
                  "condition ancestry", "warning/message absence", "nested tests", "snapshots",
                  "custom reporters", "automatic file discovery", "parallel tests", "withr lifecycle")
)
