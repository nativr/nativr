args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 1L) stop("Expected the oracle observer path.", call. = FALSE)
source(args[[1]], local = TRUE)

invisible(suppressWarnings(Sys.setlocale("LC_ALL", "C")))
options(device = function(...) pdf(NULL))

json_string <- function(value) {
  encodeString(enc2utf8(value), quote = '"', na.encode = FALSE)
}

json_encode <- function(value) {
  if (is.null(value)) return("null")
  if (is.list(value)) {
    keys <- names(value)
    if (!is.null(keys) && length(keys) == length(value) && all(nzchar(keys)) && !anyDuplicated(keys)) {
      fields <- vapply(seq_along(value), function(index) {
        paste0(json_string(keys[[index]]), ":", json_encode(value[[index]]))
      }, character(1))
      return(paste0("{", paste(fields, collapse = ","), "}"))
    }
    items <- vapply(value, json_encode, character(1))
    return(paste0("[", paste(items, collapse = ","), "]"))
  }
  if (length(value) != 1L || is.na(value)) stop("Oracle JSON received a non-scalar value.", call. = FALSE)
  if (typeof(value) == "character") return(json_string(value))
  if (typeof(value) == "logical") return(if (value) "true" else "false")
  if (typeof(value) == "integer") return(as.character(value))
  if (typeof(value) == "double") {
    if (!is.finite(value)) stop("Oracle JSON received an untagged non-finite value.", call. = FALSE)
    return(format(value, digits = 17L, scientific = FALSE, trim = TRUE))
  }
  stop(paste0("Unsupported oracle JSON type: ", typeof(value)), call. = FALSE)
}

warnings_seen <- list()
output_path <- tempfile()
message_path <- tempfile()
output_connection <- file(output_path, open = "wt", encoding = "UTF-8")
message_connection <- file(message_path, open = "wt", encoding = "UTF-8")
sink(output_connection, type = "output")
sink(message_connection, type = "message")

result <- tryCatch(
  withCallingHandlers(
    withVisible(eval(parse(text = Sys.getenv("NATIVR_CASE")), envir = new.env(parent = globalenv()))),
    warning = function(condition) {
      warnings_seen[[length(warnings_seen) + 1L]] <<- list(
        kind = "warning",
        classes = as.list(class(condition)),
        message = conditionMessage(condition),
        call = if (is.null(condition$call)) NULL else paste(deparse(condition$call), collapse = "\n"),
        order = length(warnings_seen) + 1L
      )
      invokeRestart("muffleWarning")
    }
  ),
  error = function(condition) condition
)

sink(type = "message")
sink(type = "output")
close(message_connection)
close(output_connection)
stdout <- readChar(output_path, nchars = file.info(output_path)$size, useBytes = TRUE)
messages <- readChar(message_path, nchars = file.info(message_path)$size, useBytes = TRUE)
unlink(c(output_path, message_path))
stdout <- gsub("\r\n", "\n", stdout, fixed = TRUE)
messages <- gsub("\r\n", "\n", messages, fixed = TRUE)

if (inherits(result, "condition")) {
  observation <- list(
    schemaVersion = 2L,
    outcome = "error",
    root = NULL,
    graph = list(),
    conditions = c(warnings_seen, list(list(
      kind = "error",
      classes = as.list(class(result)),
      message = conditionMessage(result),
      call = if (is.null(result$call)) NULL else paste(deparse(result$call), collapse = "\n"),
      order = length(warnings_seen) + 1L
    ))),
    streams = list(stdout = stdout, stderr = "", messages = messages),
    visible = FALSE
  )
} else {
  graph <- nativr_oracle_observe_graph(result$value)
  observation <- list(
    schemaVersion = 2L,
    outcome = "value",
    root = graph$root,
    graph = graph$graph,
    conditions = warnings_seen,
    streams = list(stdout = stdout, stderr = "", messages = messages),
    visible = result$visible
  )
}

cat(json_encode(observation))
