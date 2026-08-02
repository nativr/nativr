import type { PureRPackageBundle } from "@nativr/nativr";

/** Tiny source-only package used by the public playground's package-loading example. */
export const playgroundPackage: PureRPackageBundle = {
  description: `Package: nativrdemo
Version: 0.1.0
NeedsCompilation: no`,
  namespace:
    "export(twice_mean, signature_names, dynamic_summary, resource_size, event_colours, custom_axis, sourced_value)",
  rSources: [
    {
      path: "R/twice-mean.R",
      source:
        'twice_mean <- function(x) 2 * mean(x)\nsignature_names <- function(fun = twice_mean) names(formals(args(fun)))\ndynamic_summary <- function(x, ...) UseMethod("dynamic_summary")\ndynamic_summary.demo <- function(x, ...) paste0("worker-dynamic:", sum(x))\nresource_size <- function() file.size(system.file("extdata", "demo.json", package = "nativrdemo"))\nevent_colours <- function() grDevices::hcl(c(0, 0, 260), c = c(100, 0, 100), l = c(50, 90, 50), alpha = .3)\ncustom_axis <- function() { graphics::plot.new(); graphics::plot.window(c(0, 4), c(0, 4)); graphics::axis(1, at = 1:3, labels = c("one", "two", "three")) }\nsourced_value <- function() { con <- textConnection("value <- 40L; value + 2L"); on.exit(close(con)); source(con, local = TRUE)$value }\n.onLoad <- function(...) registerS3method("dynamic_summary", "demo", "dynamic_summary.demo")',
    },
  ],
  resources: [
    { path: "extdata/demo.json", data: "eyJkZW1vIjp0cnVlfQo=" },
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
