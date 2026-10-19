# Black-box catalog of Rd topic aliases for the base and recommended packages.
# Reads only help-index aliases and public Rd filenames; no implementation code is read.
ip <- installed.packages(priority = c("base", "recommended"))
packages <- sort(unique(rownames(ip)))
cat("META\tversion\t", utils::URLencode(R.version.string, reserved = TRUE), "\n", sep = "")
cat("META\tplatform\t", utils::URLencode(R.version$platform, reserved = TRUE), "\n", sep = "")
for (pkg in packages) {
  path <- system.file("help", "aliases.rds", package = pkg)
  if (!nzchar(path)) next
  aliases <- sort(unique(names(readRDS(path))))
  files <- sort(unique(sub("\\.[Rr]d$", "", names(tools::Rd_db(pkg)))))
  cat("PACKAGE\t", pkg, "\t", length(aliases), "\t", length(files), "\n", sep = "")
  for (alias in aliases) cat("ALIAS\t", pkg, "\t", utils::URLencode(alias, reserved = TRUE), "\n", sep = "")
  for (file in files) cat("FILE\t", pkg, "\t", utils::URLencode(file, reserved = TRUE), "\n", sep = "")
}
