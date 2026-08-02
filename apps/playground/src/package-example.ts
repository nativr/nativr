import type { PureRPackageBundle } from "@nativr/nativr";

/** Tiny source-only package used by the public playground's package-loading example. */
export const playgroundPackage: PureRPackageBundle = {
  description: `Package: nativrdemo
Version: 0.1.0
NeedsCompilation: no`,
  namespace: "export(twice_mean)",
  rSources: [
    {
      path: "R/twice-mean.R",
      source: "twice_mean <- function(x) 2 * mean(x)",
    },
  ],
  resources: [
    { path: "extdata/demo.json", data: "eyJkZW1vIjp0cnVlfQo=" },
    {
      path: ".nativr/examples-v1.json",
      data: "eyJmb3JtYXQiOiJuYXRpdnItcGFja2FnZS1leGFtcGxlcyIsImZvcm1hdFZlcnNpb24iOjEsInRvcGljcyI6W3sibmFtZSI6InR3aWNlX21lYW4iLCJ0aXRsZSI6IkRvdWJsZSBhIG1lYW4iLCJhbGlhc2VzIjpbInR3aWNlX21lYW4iXSwiYmxvY2tzIjpbeyJraW5kIjoicnVuIiwic291cmNlIjoiZXhhbXBsZV92YWx1ZSA8LSB0d2ljZV9tZWFuKGMoMSwgMiwgNikpXG5leGFtcGxlX3ZhbHVlXG4ifV19XX0=",
    },
  ],
};
