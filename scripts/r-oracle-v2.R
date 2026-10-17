args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 1L) stop("Expected the oracle observer path.", call. = FALSE)
source(args[[1]], local = TRUE)

invisible(suppressWarnings(Sys.setlocale("LC_ALL", "C")))
options(device = function(...) pdf(NULL))

json_string <- function(value) {
  # Emit ASCII JSON so C-locale printing cannot replace Unicode with <U+...>.
  points <- utf8ToInt(enc2utf8(value))
  if (anyNA(points)) stop("Oracle JSON received invalid UTF-8.", call. = FALSE)
  escaped <- vapply(points, function(point) {
    if (point > 65535L) {
      offset <- point - 65536L
      return(sprintf("\\u%04x\\u%04x", 55296L + offset %/% 1024L,
                     56320L + offset %% 1024L))
    }
    sprintf("\\u%04x", point)
  }, character(1))
  paste0('"', paste0(escaped, collapse = ""), '"')
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

error_seen <- NULL
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
  error = function(condition) {
    error_seen <<- condition
    NULL
  }
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

if (!is.null(error_seen)) {
  observation <- list(
    schemaVersion = 2L,
    outcome = "error",
    root = NULL,
    graph = list(),
    conditions = c(warnings_seen, list(list(
      kind = "error",
      classes = as.list(class(error_seen)),
      message = conditionMessage(error_seen),
      call = if (is.null(error_seen$call)) NULL else paste(deparse(error_seen$call), collapse = "\n"),
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
