# Independent canonical observation graph used by the live GNU R oracle and NativR harness.
# It records public object behavior only and never reads implementation bodies or private memory.
nativr_oracle_observe_graph <- function(value, max_depth = 64L, max_bindings = 128L) {
  state <- new.env(parent = emptyenv())
  state$next_id <- 1L
  state$nodes <- list()
  state$environments <- list()
  state$environment_ids <- integer()

  character_bytes <- function(item) {
    list(kind = "character-bytes", encoding = "bytes", bytes = as.list(as.integer(charToRaw(item))))
  }

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
      if (Encoding(item) == "bytes") return(character_bytes(item))
      return(list(kind = "character", value = item))
    }
    if (type == "raw") {
      return(list(kind = "raw", value = as.integer(item)))
    }
    if (type == "complex") {
      real <- scalar_token(Re(item), 1L)
      imaginary <- scalar_token(Im(item), 1L)
      if (real$kind == "double-na" && imaginary$kind == "double-na") return(list(kind = "complex-na"))
      if (real$kind != "double" || imaginary$kind != "double") {
        return(list(kind = "complex-components", real = real, imaginary = imaginary))
      }
      return(list(kind = "complex", real = Re(item), imaginary = Im(item)))
    }
    stop(paste0("Unsupported atomic oracle type: ", type), call. = FALSE)
  }

  walk <- NULL
  walk <- function(x, depth = 0L) {
    if (depth > max_depth) stop("Oracle observation depth limit exceeded.", call. = FALSE)
    type <- typeof(x)
    if (type == "promise") {
      stop("Unsupported oracle type: promise; raw promise payloads require an explicit observation contract.", call. = FALSE)
    }

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
    # Inspect stored vector/list payloads without invoking user class methods.
    stored <- type %in% c("logical", "integer", "double", "complex", "character", "raw", "list", "pairlist", "expression")
    plain <- if (stored) { if (!is.null(attr(x, "class"))) unclass(x) else x } else NULL
    observed_attributes <- list()
    if (!is.null(attrs)) {
      observed_attributes <- lapply(seq_along(attrs), function(index) {
        list(name = names(attrs)[[index]], node = walk(attrs[[index]], depth + 1L))
      })
    }

    node <- list(
      id = id,
      typeof = type,
      length = if (stored) length(plain) else length(x),
      attributes = observed_attributes
    )

    if (type %in% c("logical", "integer", "double", "complex", "character", "raw")) {
      node$values <- lapply(seq_along(plain), function(index) scalar_token(plain, index))
    } else if (type %in% c("list", "pairlist", "language", "expression")) {
      items <- if (type == "language") {
        as.list(x)
      } else if (type == "expression") {
        as.vector(plain, mode = "list")
      } else {
        lapply(seq_len(length(plain)), function(index) plain[[index]])
      }
      # Element edges are ordered arrays; names are represented separately by tags and attributes.
      node$elements <- unname(lapply(items, function(item) walk(item, depth + 1L)))
      source_names <- if (stored) names(plain) else names(x)
      node$tags <- if (is.null(source_names)) rep(list(NULL), length(items)) else lapply(source_names, function(tag) {
        if (is.na(tag)) NULL else if (Encoding(tag) == "bytes") character_bytes(tag) else tag
      })
    } else if (type == "symbol") {
      node$name <- as.character(x)
    } else if (type == "closure") {
      node$formals <- walk(formals(x), depth + 1L)
      node$body <- walk(body(x), depth + 1L)
      node$environment <- walk(environment(x), depth + 1L)
    } else if (type == "environment") {
      node$name <- environmentName(x)
      binding_names <- ls(envir = x, all.names = TRUE, sorted = TRUE)
      if (length(binding_names) > max_bindings) {
        stop("Oracle observation binding limit exceeded.", call. = FALSE)
      }
      node$bindings <- lapply(binding_names, function(name) {
        active <- bindingIsActive(name, x)
        list(
          name = name,
          active = active,
          node = if (active) NULL else walk(get(name, envir = x, inherits = FALSE), depth + 1L)
        )
      })
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
