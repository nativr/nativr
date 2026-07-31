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
  resources: [{ path: "extdata/demo.json", data: "eyJkZW1vIjp0cnVlfQo=" }],
};
