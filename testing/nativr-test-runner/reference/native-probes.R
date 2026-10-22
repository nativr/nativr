# Independently authored API observations. No function bodies or condition calls are read.
stopifnot(as.character(getRversion()) == "4.6.1")
stopifnot(as.character(utils::packageVersion("testthat")) == "3.3.2")
options(width = 80, crayon.enabled = FALSE, cli.unicode = FALSE)
Sys.setenv(TESTTHAT_PROBLEMS = "false", NOT_CRAN = "true")

safe_condition <- function(e) list(classes = class(e), message = conditionMessage(e))
safe_value <- function(x) {
  if (inherits(x, "condition")) return(list(kind = "condition", condition = safe_condition(x)))
  if (is.null(x)) return(list(kind = "NULL"))
  if (is.atomic(x) && length(x) <= 24L && !is.complex(x) && !is.raw(x)) {
    return(list(kind = typeof(x), values = as.vector(x), names = names(x),
                attributeNames = names(attributes(x))))
  }
  list(kind = typeof(x), classes = class(x), length = length(x))
}

observe <- function(id, expression, capture_expectations = TRUE) {
  testthat::local_edition(3)
  events <- list()
  outcome <- NULL
  error <- NULL
  append_condition <- function(kind, e) {
    events[[length(events) + 1L]] <<- list(kind = kind, condition = safe_condition(e))
  }
  output <- utils::capture.output({
    outcome <- tryCatch(withCallingHandlers(withVisible(force(expression)),
      expectation = function(e) {
        if (!capture_expectations) return(invisible(NULL))
        append_condition("expectation", e)
        restart <- findRestart("muffle_expectation")
        if (!is.null(restart)) invokeRestart(restart)
      },
      warning = function(e) { append_condition("warning", e); invokeRestart("muffleWarning") },
      message = function(e) { append_condition("message", e); invokeRestart("muffleMessage") }
    ), error = function(e) { error <<- safe_condition(e); NULL },
       condition = function(e) { error <<- safe_condition(e); NULL })
  })
  list(id = id, edition = testthat::edition_get(), events = events, termination = error,
       value = if (is.null(outcome)) NULL else safe_value(outcome$value),
       visible = if (is.null(outcome)) NULL else outcome$visible,
       capturedOutputLines = length(output))
}

records <- list(
  observe("true-attributed", testthat::expect_true(structure(TRUE, note = "owned", names = "flag"))),
  observe("false-attributed", testthat::expect_false(structure(FALSE, note = "owned"))),
  observe("true-integer", testthat::expect_true(1L)),
  observe("true-missing", testthat::expect_true(NA)),
  observe("true-empty", testthat::expect_true(logical())),
  observe("true-vector", testthat::expect_true(c(TRUE, TRUE))),
  observe("identical-storage", testthat::expect_identical(73L, 73)),
  observe("identical-names", testthat::expect_identical(c(a = 73L), c(b = 73L))),
  observe("identical-attributes", testthat::expect_identical(structure(73L, a = 1, b = 2), structure(73L, b = 2, a = 1))),
  observe("error-captured", testthat::expect_error(stop("owned-73"), "owned-73", fixed = TRUE)),
  observe("error-absent", testthat::expect_error(73L)),
  observe("error-none-result", testthat::expect_error(73L, NA)),
  observe("warning-two", testthat::expect_warning({warning("owned-first"); warning("owned-second"); 73L}, "owned-first", fixed = TRUE)),
  observe("message-unmatched-first", testthat::expect_message({message("owned-other"); message("owned-selected"); 73L}, "owned-selected", fixed = TRUE)),
  observe("warning-class-and-pattern", testthat::expect_warning(warning(structure(list(message = "owned-class", call = NULL), class = c("owned_warning", "warning", "condition"))), "owned-class", class = "owned_warning", fixed = TRUE)),
  observe("failure-observed", testthat::fail("owned explicit failure")),
  observe("failure-without-handler", testthat::fail("owned explicit failure"), FALSE),
  observe("pass-observed", testthat::pass()),
  observe("legacy-succeed", testthat::succeed()),
  observe("skip-true", testthat::skip_if(TRUE, "owned skip")),
  observe("skip-false", testthat::skip_if(FALSE, "owned skip")),
  observe("skip-missing", testthat::skip_if(NA, "owned skip")),
  observe("skip-vector", testthat::skip_if(c(TRUE, FALSE), "owned skip")),
  observe("skip-not-missing", testthat::skip_if_not(NA, "owned skip")),
  observe("skip-not-vector", testthat::skip_if_not(c(TRUE, FALSE), "owned skip")),
  observe("true-return-reference-attribute", local({
    ref <- new.env(parent = emptyenv()); x <- structure(TRUE, note = ref)
    returned <- testthat::expect_true(x)
    identical(attr(returned, "note"), ref)
  })),
  observe("warning-return-identity", local({
    warning_object <- simpleWarning("owned identity")
    returned <- testthat::expect_warning(warning(warning_object), "owned identity", fixed = TRUE)
    identical(returned, warning_object)
  }))
)

force_counts <- local({
  testthat::local_edition(3)
  counts <- new.env(parent = emptyenv()); counts$actual <- counts$expected <- 0L
  observed <- observe("identical-single-forcing", testthat::expect_identical(
    { counts$actual <- counts$actual + 1L; 73L }, { counts$expected <- counts$expected + 1L; 73L }))
  list(actual = counts$actual, expected = counts$expected, observation = observed)
})

arguments <- commandArgs(trailingOnly = TRUE)
if (length(arguments) != 1L) stop("supply one fresh output directory", call. = FALSE)
if (file.exists(arguments[[1L]])) stop("output directory must not exist", call. = FALSE)
if (!dir.create(arguments[[1L]], recursive = TRUE)) stop("unable to create output directory", call. = FALSE)
fixture_root <- normalizePath(arguments[[1L]], winslash = "/", mustWork = TRUE)
suite_root <- file.path(fixture_root, "owned-suite")
dir.create(suite_root, showWarnings = FALSE)
writeLines('.owned_trace$events <- c(.owned_trace$events, "helper")', file.path(suite_root, "helper-owned.R"))
writeLines('.owned_trace$events <- c(.owned_trace$events, "setup-file")', file.path(suite_root, "setup-owned.R"))
writeLines('.owned_trace$events <- c(.owned_trace$events, "teardown-file")', file.path(suite_root, "teardown-owned.R"))
writeLines('stop("unrelated fixture must not execute")', file.path(suite_root, "fixture.R"))
writeLines(c(
  'testthat::local_edition(3)',
  'testthat::setup(.owned_trace$events <- c(.owned_trace$events, "setup-block"))',
  'testthat::teardown(.owned_trace$events <- c(.owned_trace$events, "cleanup-one"))',
  'testthat::teardown(.owned_trace$events <- c(.owned_trace$events, "cleanup-two"))',
  'testthat::test_that("owned failure continues", {',
  '  .owned_local_73 <- 73L',
  '  on.exit(.owned_trace$events <- c(.owned_trace$events, "on-exit-failure"))',
  '  testthat::fail("owned failure")',
  '  .owned_trace$events <- c(.owned_trace$events, "after-failure")',
  '  testthat::pass()',
  '})',
  'testthat::test_that("owned isolated skip", {',
  '  testthat::expect_false(exists(".owned_local_73", inherits = FALSE))',
  '  on.exit(.owned_trace$events <- c(.owned_trace$events, "on-exit-skip"))',
  '  testthat::skip("owned skip")',
  '  .owned_trace$events <- c(.owned_trace$events, "after-skip-must-not-run")',
  '})',
  'testthat::test_that("owned ordinary error", {',
  '  on.exit(.owned_trace$events <- c(.owned_trace$events, "on-exit-error"))',
  '  stop("owned ordinary error")',
  '  testthat::pass()',
  '})'
), file.path(suite_root, "test-a-owned.R"))
writeLines(c(
  'testthat::local_edition(3)',
  '.owned_trace$events <- c(.owned_trace$events, "second-file")',
  'testthat::test_that("owned later success", { testthat::expect_true(TRUE) })',
  'testthat::test_that("owned empty test", { 73L })'
), file.path(suite_root, "test-z-owned.R"))

suite <- local({
  testthat::local_edition(3)
  env <- new.env(parent = globalenv())
  env$.owned_trace <- new.env(parent = emptyenv())
  env$.owned_trace$events <- character()
  captured_warnings <- list()
  result <- NULL
  error <- NULL
  output <- utils::capture.output({
    result <- tryCatch(withCallingHandlers(testthat::test_dir(
      suite_root, reporter = "list", env = env, stop_on_failure = FALSE,
      stop_on_warning = FALSE, load_helpers = TRUE, shuffle = FALSE),
      warning = function(e) {
        captured_warnings[[length(captured_warnings) + 1L]] <<- safe_condition(e)
        invokeRestart("muffleWarning")
      }), error = function(e) { error <<- safe_condition(e); NULL })
  })
  summaries <- lapply(result, function(entry) list(
    file = entry$file, test = entry$test,
    results = lapply(entry$results, safe_condition)
  ))
  list(events = env$.owned_trace$events, error = error, warnings = captured_warnings,
       results = summaries, capturedOutputLines = length(output))
})

# JSON encoder for the deliberately restricted observation shape only.
json <- function(x) {
  if (is.null(x)) return("null")
  if (is.list(x)) {
    pieces <- vapply(x, json, "")
    if (is.null(names(x))) return(paste0("[", paste(pieces, collapse = ","), "]"))
    return(paste0("{", paste(paste0(vapply(names(x), json, ""), ":", pieces), collapse = ","), "}"))
  }
  if (length(x) != 1L) return(paste0("[", paste(vapply(as.list(x), json, ""), collapse = ","), "]"))
  if (is.na(x)) return("null")
  if (is.logical(x)) return(if (x) "true" else "false")
  if (is.numeric(x)) return(as.character(x))
  stopifnot(is.character(x))
  encodeString(x, quote = '"')
}
api_names <- c("test_that", "expect_true", "expect_false", "expect_identical", "expect_error", "expect_warning", "expect_message", "skip", "skip_if", "skip_if_not", "fail", "pass", "succeed", "setup", "teardown")
signatures <- lapply(api_names, function(name) {
  f <- getExportedValue("testthat", name)
  list(name = name, callableType = typeof(f), formalNames = as.list(names(formals(f))))
})
report <- list(reference = list(R = as.character(getRversion()), testthat = as.character(utils::packageVersion("testthat")), edition = 3L),
               signatures = signatures, records = records, forcing = force_counts, suite = suite)
writeLines(json(report), file.path(fixture_root, "native-api-observations.json"), useBytes = TRUE)
cat("OWNED_OBSERVATIONS", length(records), "API cases;", length(suite$results), "suite test records\n")
