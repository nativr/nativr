# Independently written black-box interface inventory. This records exported names, callable kinds,
# and formal argument names only; it does not inspect or serialize implementation bodies.
packages <- c("base", "stats", "methods", "utils", "grDevices", "graphics", "datasets")

encode_field <- function(value) {
  utils::URLencode(enc2utf8(value), reserved = TRUE)
}

cat("META\tversion\t", encode_field(R.version.string), "\n", sep = "")
cat("META\tplatform\t", encode_field(R.version$platform), "\n", sep = "")

for (package_name in packages) {
  suppressPackageStartupMessages(
    library(package_name, character.only = TRUE, quietly = TRUE, warn.conflicts = FALSE)
  )
  # Radix sorting is locale-independent (C collation), keeping the snapshot order stable.
  exports <- sort(getNamespaceExports(package_name), method = "radix")
  cat("PACKAGE\t", package_name, "\t", length(exports), "\n", sep = "")
  for (export_name in exports) {
    value <- tryCatch(
      getExportedValue(package_name, export_name),
      error = function(condition) condition
    )
    if (inherits(value, "condition")) {
      cat(
        "SYMBOL\t", package_name, "\t", encode_field(export_name),
        "\terror\t0\t\n",
        sep = ""
      )
      next
    }
    callable <- is.function(value)
    kind <- typeof(value)
    # Closures report formals(); primitives report the documented args() signature when it exists.
    signature <- if (!callable) {
      NULL
    } else if (kind == "closure") {
      value
    } else {
      args(value)
    }
    source <- if (!callable) {
      "none"
    } else if (kind == "closure") {
      "formals"
    } else if (is.function(signature)) {
      "args"
    } else {
      "unknown"
    }
    formals <- if (is.function(signature)) {
      paste(vapply(names(formals(signature)), encode_field, character(1)), collapse = ",")
    } else {
      ""
    }
    cat(
      "SYMBOL\t", package_name, "\t", encode_field(export_name), "\t",
      kind, "\t", if (callable) "1" else "0", "\t", formals, "\t", source, "\n",
      sep = ""
    )
  }
}
