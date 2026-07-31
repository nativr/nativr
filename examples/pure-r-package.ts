import { createR } from "@nativr/nativr";
import type { PureRPackageBundle } from "@nativr/nativr";

// A build step can create this object from an audited source package. NativR receives only
// browser-safe package metadata and R source; it never searches a host R installation.
const packageBundle: PureRPackageBundle = {
  description: `Package: browserstats
Version: 0.1.0
Imports: stats
NeedsCompilation: no`,
  namespace: `
importFrom(stats, median)
export(center, new_score, describe)
S3method(describe, score)
`,
  rSources: [
    {
      path: "R/browserstats.R",
      source: `
center <- function(x) x - median(x)
new_score <- function(x) structure(x, class = c("score", "numeric"))
describe <- function(x, ...) UseMethod("describe")
describe.score <- function(x, ...) paste0("total=", sum(x))
`,
    },
  ],
};

const r = await createR({ packages: [packageBundle] });

console.log(await r.eval("browserstats::center(c(1, 4, 10))")); // [-3, 0, 6]
await r.eval("library(browserstats)");
console.log(await r.eval("describe(new_score(1:3))")); // "total=6"

await r.dispose();
