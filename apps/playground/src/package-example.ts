import type { PureRPackageBundle } from "@nativr/nativr";

/** Tiny source-only package used by the public playground's package-loading example. */
export const playgroundPackage: PureRPackageBundle = {
  description: `Package: nativrdemo
Version: 0.1.0
Title: Browser-Native R Demo
Description: Demonstrates unchanged pure R package code in a Web Worker.
Maintainer: NativR Demo <demo@nativr.dev>
License: Apache-2.0
URL: https://github.com/nativr/nativr
Encoding: UTF-8
NeedsCompilation: no`,
  namespace:
    "export(twice_mean, signature_names, dynamic_summary, resource_size, archive_lines, event_colours, classic_palettes, usage_rectangles, plot_series, annotated_plot, find_tools, create_file, remove_files, fixed_text, custom_axis, sourced_value, ask_user, remote_lines, download_resource, repository_versions, pipe_lines, socket_exchange, filtered_flow, package_summary, standard_output, sink_lines, write_sass_variable)",
  rSources: [
    {
      path: "R/twice-mean.R",
      source:
        'twice_mean <- function(x) 2 * mean(x)\nsignature_names <- function(fun = twice_mean) names(formals(args(fun)))\ndynamic_summary <- function(x, ...) UseMethod("dynamic_summary")\ndynamic_summary.demo <- function(x, ...) paste0("worker-dynamic:", sum(x))\nresource_size <- function() file.size(system.file("extdata", "demo.json", package = "nativrdemo"))\narchive_lines <- function(member = "notes.txt") { con <- unz(system.file("extdata", "archive.zip", package = "nativrdemo"), member); on.exit(close(con)); readLines(con) }\nevent_colours <- function() grDevices::hcl(c(0, 0, 260), c = c(100, 0, 100), l = c(50, 90, 50), alpha = .3)\nclassic_palettes <- function(n = 3) c(grDevices::rainbow(n), grDevices::terrain.colors(n), grDevices::topo.colors(n), grDevices::cm.colors(n))\nusage_rectangles <- function() { graphics::plot.new(); graphics::plot.window(c(0, 1), c(0, 1)); graphics::rect(c(0, .5), c(0, .5), c(.5, 1), c(.5, 1), col = "#00000044", border = NA) }\nplot_series <- function(z) { stats::ts.plot(z); invisible(length(z)) }\nannotated_plot <- function(label = "package title") { graphics::plot.new(); graphics::plot.window(c(0, 1), c(0, 1)); graphics::title(label, col.main = "red"); invisible(label) }\nfind_tools <- function(names) Sys.which(names)\ncreate_file <- function() { path <- tempfile(); created <- file.create(path); c(created, file.exists(path), file.size(path), unlink(path)) }\nremove_files <- function() { paths <- c(tempfile(), tempfile()); writeLines("package", paths[1]); writeLines("cleanup", paths[2]); c(file.exists(paths), file.remove(paths), file.exists(paths)) }\nfixed_text <- function() { resource <- system.file("extdata", "demo.json", package = "nativrdemo"); bookmark <- tempfile(); cat("bookmarked", file = bookmark); result <- c(readChar(resource, file.info(resource)$size), readChar(bookmark, 1000L)); file.remove(bookmark); result }\ncustom_axis <- function() { graphics::plot.new(); graphics::plot.window(c(0, 4), c(0, 4)); graphics::axis(1, at = 1:3, labels = c("one", "two", "three")) }\nsourced_value <- function() { con <- textConnection("value <- 40L; value + 2L"); on.exit(close(con)); source(con, local = TRUE)$value }\nask_user <- function(prompt = "Value: ") readline(prompt)\nremote_lines <- function(address) { con <- url(address); on.exit(close(con)); readLines(con) }\ndownload_resource <- function(address) { path <- tempfile(fileext = ".txt"); on.exit(unlink(path)); status <- utils::download.file(address, path, quiet = TRUE, mode = "wb"); c(status, readLines(path)) }\nrepository_versions <- function(mirror) { db <- utils::available.packages(repos = mirror, type = "source"); c(rownames(db), db[, "Version"]) }\npipe_lines <- function(command) { con <- pipe(command); on.exit(close(con)); readLines(con) }\nsocket_exchange <- function(host, port) { con <- socketConnection(host, port, blocking = TRUE, open = "a+b", encoding = "UTF-8", timeout = 5, options = "no-delay"); on.exit(close(con)); writeLines(c("ping", "package"), con); c(readLines(con, n = 2L), isIncomplete(con), socketTimeout(con)) }\nfiltered_flow <- function(x, coefficient = .8) stats::filter(x, coefficient, method = "r")\npackage_summary <- function() { description <- utils::packageDescription("nativrdemo"); fields <- unclass(description); c(fields$Package, fields$Version, fields$Title, fields$License, basename(dirname(attr(description, "file")))) }\nstandard_output <- function() { out <- stdout(); writeLines("package-worker-output", out); c(class(out), summary(out)$class, isOpen(out, "write"), isatty(out), identical(out, getConnection(1L))) }\n.onLoad <- function(...) registerS3method("dynamic_summary", "demo", "dynamic_summary.demo")',
    },
    {
      path: "R/sink-lines.R",
      source:
        'sink_lines <- function() { path <- tempfile(); sink(path); cat("package-worker-sink\\n"); sink(); readLines(path) }\nwrite_sass_variable <- function() { path <- tempfile(); write(\'$color: "red";\', path); readLines(path) }',
    },
  ],
  resources: [
    { path: "extdata/demo.json", data: "eyJkZW1vIjp0cnVlfQo=" },
    {
      path: "extdata/archive.zip",
      data: "UEsDBAoAAAAAAOuOAl1uUDBuCwAAAAsAAAAJAAAAbm90ZXMudHh0YWxwaGEKYmV0YQpQSwMEFAAAAAgA644CXYPf7MgpAAAAHAIAAAwAAAByZXBlYXRlZC50eHRLLErOyCxLVUjOzy1ILMlMyszJLKlUSEksSVRIpLIUF7UNHLWLtnYBAFBLAQIeAwoAAAAAAOuOAl1uUDBuCwAAAAsAAAAJAAAAAAAAAAEAAACkgQAAAABub3Rlcy50eHRQSwECHgMUAAAACADrjgJdg9/syCkAAAAcAgAADAAAAAAAAAABAAAApIEyAAAAcmVwZWF0ZWQudHh0UEsFBgAAAAACAAIAcQAAAIUAAAAAAA==",
    },
    {
      path: ".nativr/examples-v1.json",
      data: "eyJmb3JtYXQiOiJuYXRpdnItcGFja2FnZS1leGFtcGxlcyIsImZvcm1hdFZlcnNpb24iOjEsInRvcGljcyI6W3sibmFtZSI6InR3aWNlX21lYW4iLCJ0aXRsZSI6IkRvdWJsZSBhIG1lYW4iLCJhbGlhc2VzIjpbInR3aWNlX21lYW4iXSwiYmxvY2tzIjpbeyJraW5kIjoicnVuIiwic291cmNlIjoiZXhhbXBsZV92YWx1ZSA8LSB0d2ljZV9tZWFuKGMoMSwgMiwgNikpXG5leGFtcGxlX3ZhbHVlXG4ifV19XX0=",
    },
    {
      path: ".nativr/vignettes-v1.json",
      data: "eyJmb3JtYXQiOiJuYXRpdnItcGFja2FnZS12aWduZXR0ZXMiLCJmb3JtYXRWZXJzaW9uIjoxLCJ2aWduZXR0ZXMiOlt7InRvcGljIjoiYnJvd3Nlci1ydW50aW1lIiwidGl0bGUiOiJSdW5uaW5nIFIgaW4gYSBicm93c2VyIFdvcmtlciIsImZpbGUiOiJicm93c2VyLXJ1bnRpbWUuUm1kIiwiciI6ImJyb3dzZXItcnVudGltZS5SIiwib3V0cHV0IjoiYnJvd3Nlci1ydW50aW1lLmh0bWwifV19",
    },
    {
      path: "doc/browser-runtime.Rmd",
      data: "LS0tCnRpdGxlOiBSdW5uaW5nIFIgaW4gYSBicm93c2VyIFdvcmtlcgotLS0KClRoaXMgdmlnbmV0dGUgaXMgYnVuZGxlZCB3aXRoIHRoZSBwbGF5Z3JvdW5kIHBhY2thZ2UuCg==",
    },
    { path: "doc/browser-runtime.R", data: "dHdpY2VfbWVhbihjKDEsIDIsIDYpKQo=" },
    {
      path: "doc/browser-runtime.html",
      data: "PCFkb2N0eXBlIGh0bWw+PHRpdGxlPlJ1bm5pbmcgUiBpbiBhIGJyb3dzZXIgV29ya2VyPC90aXRsZT48cD5OYXRpdlIgcGxheWdyb3VuZCB2aWduZXR0ZS48L3A+",
    },
  ],
};
