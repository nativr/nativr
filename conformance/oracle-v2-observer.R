# Independent canonical observation graph used by the live GNU R oracle and NativR harness.
# It records public object behavior only and never reads implementation bodies or private memory.
nativr_oracle_observe_graph <- function(value, max_depth = 64L) {
  state <- new.env(parent = emptyenv())
  state$next_id <- 1L
  state$nodes <- list()
  state$environments <- list()
  state$environment_ids <- integer()

  scalar_token <- function(x, index) {
    type <- typeof(x)
    item <- as.vector(x, mode = type)[[index]]
    if (type == "double") {
      if (is.nan(item)) return(list(kind = "double-nan"))
      if (is.na(item)) return(list(kind = "double-na"))
      if (item == Inf || item == -Inf) {
        return(list(kind = if (item > 0) "double-positive-infinity" else "double-negative-infinity"))
      }
      if (item == 0 && identical(1 / item, -Inf)) {
        return(list(kind = "double-negative-zero"))
      }
      return(list(kind = "double", value = item))
    }
    if (type == "integer") {
      if (is.na(item)) return(list(kind = "integer-na"))
      return(list(kind = "integer", value = item))
    }
    if (type == "logical") {
      if (is.na(item)) return(list(kind = "logical-na"))
      return(list(kind = "logical", value = item))
    }
    if (type == "character") {
      if (is.na(item)) return(list(kind = "character-na"))
      return(list(kind = "character", value = item))
    }
    if (type == "raw") {
      return(list(kind = "raw", value = as.integer(item)))
    }
    if (type == "complex") {
      if (is.na(item)) return(list(kind = "complex-na"))
      return(list(kind = "complex", real = Re(item), imaginary = Im(item)))
    }
    stop(paste0("Unsupported atomic oracle type: ", type), call. = FALSE)
  }

  walk <- NULL
  walk <- function(x, depth = 0L) {
    if (depth > max_depth) stop("Oracle observation depth limit exceeded.", call. = FALSE)
    type <- typeof(x)

    if (type == "environment") {
      if (length(state$environments) > 0L) {
        for (index in seq_along(state$environments)) {
          if (identical(state$environments[[index]], x)) return(state$environment_ids[[index]])
        }
      }
    }

    id <- state$next_id
    state$next_id <- state$next_id + 1L
    state$nodes[[id]] <- list(id = id, typeof = "pending", length = 0L)

    if (type == "environment") {
      state$environments[[length(state$environments) + 1L]] <- x
      state$environment_ids[[length(state$environment_ids) + 1L]] <- id
    }

    attrs <- attributes(x)
    observed_attributes <- list()
    if (!is.null(attrs)) {
      observed_attributes <- lapply(seq_along(attrs), function(index) {
        list(name = names(attrs)[[index]], node = walk(attrs[[index]], depth + 1L))
      })
    }

    node <- list(
      id = id,
      typeof = type,
      length = length(x),
      attributes = observed_attributes
    )

    if (type %in% c("logical", "integer", "double", "complex", "character", "raw")) {
      node$values <- lapply(seq_along(x), function(index) scalar_token(x, index))
    } else if (type %in% c("list", "pairlist", "language", "expression")) {
      items <- if (type == "language") {
        as.list(x)
      } else {
        lapply(seq_len(length(x)), function(index) x[[index]])
      }
      node$elements <- lapply(items, function(item) walk(item, depth + 1L))
      source_names <- names(x)
      node$tags <- if (is.null(source_names)) rep(list(NULL), length(items)) else as.list(source_names)
    } else if (type == "symbol") {
      node$name <- as.character(x)
    } else if (type == "closure") {
      node$formals <- walk(formals(x), depth + 1L)
      node$body <- walk(body(x), depth + 1L)
      node$environment <- walk(environment(x), depth + 1L)
    } else if (type == "environment") {
      node$name <- environmentName(x)
    } else if (type == "NULL") {
      # NULL has no additional payload.
    } else {
      node$representation <- paste(deparse(x), collapse = "\n")
    }

    state$nodes[[id]] <- node
    id
  }

  root <- walk(value)
  list(root = root, graph = state$nodes)
}
