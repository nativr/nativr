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
  exports <- sort(getNamespaceExports(package_name))
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
    formals <- if (callable && kind == "closure") {
      paste(vapply(names(formals(value)), encode_field, character(1)), collapse = ",")
    } else {
      ""
    }
    cat(
      "SYMBOL\t", package_name, "\t", encode_field(export_name), "\t",
      kind, "\t", if (callable) "1" else "0", "\t", formals, "\n",
      sep = ""
    )
  }
}
