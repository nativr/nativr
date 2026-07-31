import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const researchDirectory = path.join(root, "research", "package-usage");
const figureDirectory = path.join(root, "docs", "figures");
const snapshotPath = path.join(researchDirectory, "snapshot.json");
const packageCsvPath = path.join(researchDirectory, "package-downloads.csv");
const featureCsvPath = path.join(researchDirectory, "feature-reach.csv");
const callableCsvPath = path.join(researchDirectory, "core-callable-reach.csv");
const packageFigurePath = path.join(figureDirectory, "package-downloads.svg");
const featureFigurePath = path.join(figureDirectory, "feature-priority.svg");
const callableFigurePath = path.join(figureDirectory, "core-callable-priority.svg");
const compatibilityManifestPath = path.join(root, "docs", "compatibility-manifest.json");
const gnuSurfacePath = path.join(root, "compatibility", "gnu-r", "surface.json");

const TOP_PACKAGES_URL = "https://cranlogs.r-pkg.org/top/last-month/100";
const MANUAL_URL = (packageName) =>
  `https://cran.r-project.org/web/packages/${encodeURIComponent(packageName)}/refman/${encodeURIComponent(packageName)}.html`;
const NAMESPACE_URL = (packageName) =>
  `https://cran.r-project.org/web/packages/${encodeURIComponent(packageName)}/NAMESPACE`;
const USER_AGENT = "NativR package-usage research (https://github.com/nativr/nativr)";
const CALL_PATTERN =
  /(?<![A-Za-z0-9._$@])(?:(?<namespace>[A-Za-z.][A-Za-z0-9._]*)\s*:::{0,1}\s*)?(?<name>[A-Za-z.][A-Za-z0-9._]*)(?=\s*\()/gu;
const LOCAL_FUNCTION_PATTERN =
  /(?<![A-Za-z0-9._])([A-Za-z.][A-Za-z0-9._]*)\s*(?:<-|=)\s*function\s*\(/gu;
const NAMESPACE_EXPORT_PATTERN = /(?<![A-Za-z0-9.])export\s*\(([^)]*)\)/gu;
const NON_CALL_KEYWORDS = new Set(["for", "function", "if", "while"]);
const LANGUAGE_CALLABLE_NAMES = new Set(["return"]);

export const FEATURES = [
  {
    id: "comparisons",
    label: "Comparison operators",
    surface: "< <= > >= == !=",
    status: "supported",
    patterns: [/<=|>=|==|!=|(?<!<)<(?![-<=])|(?<![-|%>])>(?![=>])/u],
  },
  {
    id: "logical-operators",
    label: "Logical operators",
    surface: "! & | && ||",
    status: "supported",
    patterns: [/&&|\|\||(?<![|])\|(?![|>])|(?<!&)&(?!&)|!(?!=)/u],
  },
  {
    id: "subsetting",
    label: "Vector/list subsetting [",
    surface: "[",
    status: "supported",
    patterns: [/[A-Za-z0-9_.)\]]\s*\[(?!\[)/u],
  },
  {
    id: "extraction",
    label: "Element/member extraction [[ and $",
    surface: "[[ $",
    status: "supported",
    patterns: [/\[\[|\$(?:[A-Za-z._]|`)/u],
  },
  {
    id: "conditionals",
    label: "if / else",
    surface: "if else",
    status: "supported",
    patterns: [/\bif\s*\(|\belse\b/u],
  },
  {
    id: "return",
    label: "return",
    surface: "return",
    status: "supported",
    patterns: [/\breturn\s*\(/u],
  },
  {
    id: "loops",
    label: "for / while / repeat",
    surface: "for while repeat break next",
    status: "supported",
    patterns: [/\b(?:for|while)\s*\(|\brepeat\b/u],
  },
  {
    id: "lists",
    label: "Lists",
    surface: "list as.list pairlist",
    status: "supported",
    patterns: [/\b(?:list|as\.list|pairlist)\s*\(/u],
  },
  {
    id: "names-attributes",
    label: "Names and attributes",
    surface:
      "names setNames unname attr attributes structure class unclass rownames colnames dimnames",
    status: "supported",
    patterns: [
      /\b(?:names|setNames|unname|attr|attributes|structure|class|unclass|rownames|colnames|dimnames)\s*\(/u,
    ],
  },
  {
    id: "sequences-repetition",
    label: "Sequences and repetition",
    surface: ": seq seq_along seq_len rep rep_len",
    status: "supported",
    patterns: [/\b(?:seq|seq_along|seq_len|rep|rep_len)\s*\(/u, /(?<!:):(?!:)/u],
  },
  {
    id: "pipes",
    label: "Native and magrittr pipes",
    surface: "|> %>%",
    status: "supported",
    patterns: [/\|>|%>%/u],
  },
  {
    id: "formulas",
    label: "Formulas",
    surface: "~ formula all.vars",
    status: "supported",
    patterns: [/(?<![%~])~(?![%~])/u],
  },
  {
    id: "data-frames",
    label: "Data frames",
    surface: "data.frame as.data.frame tibble tribble",
    status: "supported",
    patterns: [/\b(?:data\.frame|as\.data\.frame|tibble|tribble)\s*\(/u],
  },
  {
    id: "matrices-arrays",
    label: "Matrices, arrays, and dimensions",
    surface: "matrix array as.matrix dim nrow ncol rbind cbind",
    status: "supported",
    patterns: [/\b(?:matrix|array|as\.matrix|dim|nrow|ncol|rbind|cbind)\s*\(/u],
  },
  {
    id: "factors",
    label: "Factors",
    surface: "factor ordered levels droplevels",
    status: "supported",
    patterns: [/\b(?:factor|ordered|levels|droplevels)\s*\(/u],
  },
  {
    id: "string-helpers",
    label: "String helpers",
    surface:
      "paste paste0 sprintf format grep grepl gsub sub strsplit substring substr nchar tolower toupper chartr",
    status: "supported",
    patterns: [
      /\b(?:paste|paste0|sprintf|format|grep|grepl|gsub|sub|strsplit|substring|substr|nchar|tolower|toupper|chartr)\s*\(/u,
    ],
  },
  {
    id: "sorting-matching",
    label: "Sorting and matching",
    surface: "sort order rank unique duplicated match which which.max which.min",
    status: "supported",
    patterns: [/\b(?:sort|order|rank|unique|duplicated|match|which|which\.max|which\.min)\s*\(/u],
  },
  {
    id: "apply-family",
    label: "Apply/map family",
    surface: "apply lapply sapply vapply mapply Map Reduce Filter by aggregate",
    status: "supported",
    patterns: [/\b(?:apply|lapply|sapply|vapply|mapply|Map|Reduce|Filter|by|aggregate)\s*\(/u],
  },
  {
    id: "statistics",
    label: "Descriptive statistics",
    surface: "mean sum sd var median quantile cor cov min max range summary table prop.table",
    status: "supported",
    patterns: [
      /\b(?:mean|sum|sd|var|median|quantile|cor|cov|min|max|range|summary|table|prop\.table)\s*\(/u,
    ],
  },
  {
    id: "random-numbers",
    label: "Random numbers and sampling",
    surface: "set.seed sample runif rnorm rbinom rpois rchisq rt rexp",
    status: "supported",
    patterns: [/\b(?:set\.seed|sample|runif|rnorm|rbinom|rpois|rchisq|rt|rexp)\s*\(/u],
  },
  {
    id: "dates-times",
    label: "Dates and times",
    surface: "as.Date as.POSIXct strptime strftime difftime Sys.Date Sys.time",
    status: "supported",
    patterns: [/\b(?:as\.Date|as\.POSIXct|strptime|strftime|difftime|Sys\.Date|Sys\.time)\s*\(/u],
  },
  {
    id: "namespaces",
    label: "Namespace access",
    surface: ":: :::",
    status: "supported",
    patterns: [/:::{0,1}/u],
  },
  {
    id: "ellipsis",
    label: "Ellipsis arguments",
    surface: "... before and after named formals",
    status: "supported",
    patterns: [/\.\.\./u],
  },
  {
    id: "replacement",
    label: "Replacement assignment",
    surface: "[<- [[<- $<-",
    status: "supported",
    patterns: [/(?:\[[^\n\]]+\]|\$[A-Za-z._][\w.]*)\s*<-/u],
  },
  {
    id: "object-systems",
    label: "S3/S4/R6/S7 object systems",
    surface: "UseMethod NextMethod setClass setGeneric setMethod R6Class new_class new_vctr",
    status: "supported",
    patterns: [
      /\b(?:UseMethod|NextMethod|setClass|setGeneric|setMethod|R6Class|new_class|new_vctr)\s*\(/u,
    ],
  },
];

export async function main(arguments_ = new Set(process.argv.slice(2))) {
  const collect = arguments_.size === 0 || arguments_.has("--collect");
  const render = arguments_.size === 0 || arguments_.has("--render");
  const check = arguments_.has("--check");

  verifyFeatureDetector();

  if (collect) {
    const snapshot = await collectSnapshot();
    await mkdir(researchDirectory, { recursive: true });
    const snapshotJson = await format(JSON.stringify(snapshot), {
      ...prettierOptions,
      filepath: snapshotPath,
    });
    await writeFile(snapshotPath, snapshotJson);
    console.log(
      `Collected ${snapshot.sample.analyzedPackageCount}/${snapshot.sample.packageCount} package manuals for ${snapshot.sample.start} through ${snapshot.sample.end}.`,
    );
  }

  if (render || check) {
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
    validateSnapshot(snapshot);
    const availableNames = await loadAvailableNames();
    const artifacts = [
      [packageCsvPath, renderPackageCsv(snapshot)],
      [featureCsvPath, renderFeatureCsv(snapshot)],
      [callableCsvPath, renderCallableCsv(snapshot, availableNames)],
      [packageFigurePath, renderPackageFigure(snapshot)],
      [featureFigurePath, renderFeatureFigure(snapshot)],
      [callableFigurePath, renderCallableFigure(snapshot, availableNames)],
    ];
    if (render) {
      await Promise.all([
        mkdir(researchDirectory, { recursive: true }),
        mkdir(figureDirectory, { recursive: true }),
      ]);
      await Promise.all(artifacts.map(([file, contents]) => writeFile(file, contents)));
      console.log("Rendered package-usage CSV and SVG artifacts from the committed snapshot.");
    }
    if (check) {
      await Promise.all(artifacts.map(([file, contents]) => checkArtifact(file, contents)));
      console.log("Package-usage CSV and SVG artifacts match the committed snapshot.");
    }
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}

async function collectSnapshot() {
  const { packageNames: corePackageNames, callableNames: coreCallableNames } =
    await loadCoreSurface();
  const top = await fetchJson(TOP_PACKAGES_URL);
  if (
    typeof top !== "object" ||
    top === null ||
    !Array.isArray(top.downloads) ||
    typeof top.start !== "string" ||
    typeof top.end !== "string"
  ) {
    throw new Error("Unexpected response from the cranlogs top-packages endpoint.");
  }

  const rankedPackages = top.downloads.map((entry, index) => {
    const downloads = Number(entry.downloads);
    if (typeof entry.package !== "string" || !Number.isSafeInteger(downloads) || downloads < 0) {
      throw new Error(`Invalid cranlogs package entry at rank ${index + 1}.`);
    }
    return {
      rank: index + 1,
      package: entry.package,
      downloads,
      manualUrl: MANUAL_URL(entry.package),
      namespaceUrl: NAMESPACE_URL(entry.package),
    };
  });

  const packages = await mapLimit(rankedPackages, 4, async (entry) => {
    try {
      const manual = await fetchText(entry.manualUrl);
      let namespaceStatus = "analyzed";
      let packageExports = new Set();
      try {
        packageExports = extractNamespaceExports(await fetchText(entry.namespaceUrl));
      } catch (error) {
        namespaceStatus = "unavailable";
        console.warn(
          `Could not attribute ${entry.package} exports: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      const exampleBlocks = extractExamples(manual);
      if (exampleBlocks.length === 0) {
        return {
          ...entry,
          manualStatus: "no-examples",
          namespaceStatus,
          exampleBlockCount: 0,
          exampleCharacters: 0,
          exportedNameCount: packageExports.size,
          excludedPackageCallCount: 0,
          excludedPackageCallables: [],
          featureIds: [],
          callCounts: {},
        };
      }
      const examples = exampleBlocks.join("\n");
      const calls = mergeCallCounts(exampleBlocks, packageExports, corePackageNames);
      return {
        ...entry,
        manualStatus: "analyzed",
        namespaceStatus,
        exampleBlockCount: exampleBlocks.length,
        exampleCharacters: examples.length,
        exportedNameCount: packageExports.size,
        excludedPackageCallCount: sum(Object.values(calls.packageOwned)),
        excludedPackageCallables: Object.entries(calls.packageOwned).map(
          ([name, occurrenceCount]) => ({ name, occurrenceCount }),
        ),
        featureIds: detectFeatures(examples),
        callCounts: calls.core,
      };
    } catch (error) {
      console.warn(
        `Skipping ${entry.package}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ...entry,
        manualStatus: "unavailable",
        namespaceStatus: "not-requested",
        exampleBlockCount: 0,
        exampleCharacters: 0,
        exportedNameCount: 0,
        excludedPackageCallCount: 0,
        excludedPackageCallables: [],
        featureIds: [],
        callCounts: {},
      };
    }
  });

  const analyzedPackages = packages.filter((entry) => entry.manualStatus === "analyzed");
  const analyzedDownloads = sum(analyzedPackages.map((entry) => entry.downloads));
  const totalDownloads = sum(packages.map((entry) => entry.downloads));
  const features = FEATURES.map((feature) => {
    const matchingPackages = analyzedPackages.filter((entry) =>
      entry.featureIds.includes(feature.id),
    );
    const downloadCount = sum(matchingPackages.map((entry) => entry.downloads));
    const packageReach = matchingPackages.length / analyzedPackages.length;
    const downloadReach = downloadCount / analyzedDownloads;
    return {
      id: feature.id,
      label: feature.label,
      status: feature.status,
      packageCount: matchingPackages.length,
      downloadCount,
      packageReach: round(packageReach, 6),
      downloadReach: round(downloadReach, 6),
      priority: priorityBand(downloadReach),
    };
  }).sort(
    (left, right) =>
      right.downloadReach - left.downloadReach ||
      right.packageReach - left.packageReach ||
      left.label.localeCompare(right.label),
  );
  const calls = aggregateCallableReach(analyzedPackages, coreCallableNames);
  const snapshotPackages = packages.map((entry) => {
    const snapshotEntry = { ...entry };
    delete snapshotEntry.callCounts;
    return snapshotEntry;
  });

  return {
    schemaVersion: 3,
    detectorFingerprint: featureDetectorFingerprint(),
    collectedAt: new Date().toISOString(),
    sample: {
      source: TOP_PACKAGES_URL,
      manualSourceTemplate:
        "https://cran.r-project.org/web/packages/{package}/refman/{package}.html",
      namespaceSourceTemplate: "https://cran.r-project.org/web/packages/{package}/NAMESPACE",
      start: top.start.slice(0, 10),
      end: top.end.slice(0, 10),
      requestedPackageCount: 100,
      packageCount: packages.length,
      analyzedPackageCount: analyzedPackages.length,
      totalDownloads,
      analyzedDownloads,
      method:
        "Download-weighted package reach across language features and GNU R core callable names detected in CRAN-generated reference-manual example blocks, excluding exact package exports declared by CRAN NAMESPACE files and non-core namespace-qualified calls.",
    },
    packages: snapshotPackages,
    features,
    calls,
  };
}

function extractExamples(html) {
  const blocks = [];
  const pattern =
    /<h3[^>]*>\s*Examples\s*<\/h3>\s*<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/giu;
  for (const match of html.matchAll(pattern)) {
    const source = match[1];
    if (source !== undefined) blocks.push(decodeHtml(source));
  }
  return blocks;
}

function extractNamespaceExports(source) {
  const names = new Set();
  const uncommented = source
    .split(/\r?\n/u)
    .map((line) => line.replace(/#.*$/u, ""))
    .join("\n");
  for (const directive of uncommented.matchAll(NAMESPACE_EXPORT_PATTERN)) {
    const arguments_ = directive[1];
    if (arguments_ === undefined) continue;
    for (const argument of arguments_.split(",")) {
      const name = argument.trim().replace(/^(["'`])([\s\S]*)\1$/u, "$2");
      if (name.length > 0) names.add(name);
    }
  }
  return names;
}

function detectFeatures(source) {
  const code = stripCommentsAndStrings(source);
  return FEATURES.filter((feature) => feature.patterns.some((pattern) => pattern.test(code))).map(
    (feature) => feature.id,
  );
}

function detectCallCounts(source, packageCallables = new Set(), corePackageNames = new Set()) {
  const code = stripCommentsAndStrings(source);
  const localDefinitions = [...code.matchAll(LOCAL_FUNCTION_PATTERN)].map((match) => ({
    name: match[1],
    index: match.index,
  }));
  const core = new Map();
  const packageOwned = new Map();
  for (const match of code.matchAll(CALL_PATTERN)) {
    const name = match.groups?.name;
    const namespace = match.groups?.namespace;
    if (name === undefined || NON_CALL_KEYWORDS.has(name)) continue;
    if (
      localDefinitions.some(
        (definition) => definition.name === name && definition.index < match.index,
      )
    ) {
      continue;
    }
    if (namespace !== undefined && !corePackageNames.has(namespace)) continue;
    const target = namespace === undefined && packageCallables.has(name) ? packageOwned : core;
    target.set(name, (target.get(name) ?? 0) + 1);
  }
  return {
    core: Object.fromEntries([...core].sort(([left], [right]) => left.localeCompare(right))),
    packageOwned: Object.fromEntries(
      [...packageOwned].sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

function mergeCallCounts(exampleBlocks, packageCallables, corePackageNames) {
  const core = new Map();
  const packageOwned = new Map();
  for (const block of exampleBlocks) {
    const blockCounts = detectCallCounts(block, packageCallables, corePackageNames);
    for (const [name, occurrences] of Object.entries(blockCounts.core)) {
      core.set(name, (core.get(name) ?? 0) + occurrences);
    }
    for (const [name, occurrences] of Object.entries(blockCounts.packageOwned)) {
      packageOwned.set(name, (packageOwned.get(name) ?? 0) + occurrences);
    }
  }
  return {
    core: Object.fromEntries([...core].sort(([left], [right]) => left.localeCompare(right))),
    packageOwned: Object.fromEntries(
      [...packageOwned].sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

function aggregateCallableReach(packages, coreCallableNames) {
  const calls = new Map();
  for (const packageEntry of packages) {
    for (const [name, occurrenceCount] of Object.entries(packageEntry.callCounts)) {
      if (!coreCallableNames.has(name)) continue;
      const current = calls.get(name) ?? {
        name,
        packageCount: 0,
        packageNames: [],
        downloadCount: 0,
        occurrenceCount: 0,
      };
      current.packageCount += 1;
      current.packageNames.push(packageEntry.package);
      current.downloadCount += packageEntry.downloads;
      current.occurrenceCount += occurrenceCount;
      calls.set(name, current);
    }
  }
  const analyzedDownloads = sum(packages.map((entry) => entry.downloads));
  return [...calls.values()]
    .map((entry) => ({
      ...entry,
      packageReach: round(entry.packageCount / packages.length, 6),
      downloadReach: round(entry.downloadCount / analyzedDownloads, 6),
    }))
    .sort(
      (left, right) =>
        right.downloadReach - left.downloadReach ||
        right.packageCount - left.packageCount ||
        right.occurrenceCount - left.occurrenceCount ||
        left.name.localeCompare(right.name),
    );
}

async function loadCoreSurface() {
  const surface = JSON.parse(await readFile(gnuSurfacePath, "utf8"));
  if (!Array.isArray(surface.packages)) {
    throw new Error(`Invalid GNU R callable inventory at ${gnuSurfacePath}.`);
  }
  return {
    packageNames: new Set(surface.packages.map((packageEntry) => packageEntry.name)),
    callableNames: new Set(
      surface.packages.flatMap((packageEntry) =>
        Array.isArray(packageEntry.exports)
          ? packageEntry.exports
              .filter((entry) => entry.callable === true && typeof entry.name === "string")
              .map((entry) => entry.name)
          : [],
      ),
    ),
  };
}

async function loadAvailableNames() {
  const manifest = JSON.parse(await readFile(compatibilityManifestPath, "utf8"));
  if (!Array.isArray(manifest.packages)) {
    throw new Error(`Invalid NativR capability manifest at ${compatibilityManifestPath}.`);
  }
  return new Set([
    ...LANGUAGE_CALLABLE_NAMES,
    ...manifest.packages.flatMap((packageEntry) =>
      Array.isArray(packageEntry.functions)
        ? packageEntry.functions
            .filter((entry) => typeof entry.name === "string")
            .map((entry) => entry.name)
        : [],
    ),
  ]);
}

function verifyFeatureDetector() {
  const assignmentFeatures = detectFeatures(
    "assigned <- value\nvalue |> transform()\nvalue %>% next()",
  );
  if (assignmentFeatures.includes("comparisons") || !assignmentFeatures.includes("pipes")) {
    throw new Error("Feature detector invariant failed for assignment and pipe operators.");
  }

  const controlFeatures = detectFeatures("if (value >= 2) result[[1]] else list(value)");
  for (const expected of ["comparisons", "conditionals", "extraction", "lists"]) {
    if (!controlFeatures.includes(expected)) {
      throw new Error(`Feature detector invariant failed to recognize ${expected}.`);
    }
  }

  const ignoredFeatures = detectFeatures('# if (x > 1) y[1]\n"list(x) |> transform()"');
  if (ignoredFeatures.length !== 0) {
    throw new Error("Feature detector invariant failed to ignore comments and strings.");
  }

  const packageExports = extractNamespaceExports(
    '# generated\nS3method(aperm, integer64)\nexport(hashtab, "is.element")\nexport(`%in%`)',
  );
  if (
    !packageExports.has("hashtab") ||
    !packageExports.has("is.element") ||
    !packageExports.has("%in%") ||
    packageExports.has("aperm")
  ) {
    throw new Error("NAMESPACE export detector invariant failed.");
  }

  const calls = detectCallCounts(
    'mean(x)\nmean(y)\nstats::median(x)\ntagQ$find("a")\nobject@show()\nif (ok) print("ignored text()")\nfunction(x) x\nlocal <- function(x) x\nlocal(1)',
    new Set(),
    new Set(["stats"]),
  );
  if (
    calls.core.mean !== 2 ||
    calls.core.median !== 1 ||
    calls.core.print !== 1 ||
    calls.core.if !== undefined ||
    calls.core.function !== undefined ||
    calls.core.local !== undefined ||
    calls.core.text !== undefined ||
    calls.core.find !== undefined ||
    calls.core.show !== undefined
  ) {
    throw new Error("Core callable detector invariant failed.");
  }

  const attributedCalls = detectCallCounts(
    "hashtab(cache)\nmean(x)\nbase::mean(x)\nexternal::mean(x)",
    packageExports,
    new Set(["base"]),
  );
  if (
    attributedCalls.packageOwned.hashtab !== 1 ||
    attributedCalls.core.mean !== 2 ||
    Object.keys(attributedCalls.core).length !== 1
  ) {
    throw new Error("Callable ownership detector invariant failed.");
  }
}

function stripCommentsAndStrings(source) {
  let output = "";
  let quote;
  let escaped = false;
  let comment = false;
  for (const character of source) {
    if (comment) {
      if (character === "\n") {
        comment = false;
        output += "\n";
      } else {
        output += " ";
      }
      continue;
    }
    if (quote !== undefined) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      output += character === "\n" ? "\n" : " ";
      continue;
    }
    if (character === "#") {
      comment = true;
      output += " ";
    } else if (character === '"' || character === "'" || character === "`") {
      quote = character;
      output += " ";
    } else {
      output += character;
    }
  }
  return output;
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, body) => {
    if (body.startsWith("#x")) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return named[body.toLowerCase()] ?? entity;
  });
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "text/html,application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 500);
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, task) {
  const output = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

function renderPackageCsv(snapshot) {
  const rows = [
    [
      "rank",
      "package",
      "downloads",
      "manual_status",
      "namespace_status",
      "example_blocks",
      "exported_names",
      "excluded_package_owned_calls",
      "features_detected",
    ],
    ...snapshot.packages.map((entry) => [
      entry.rank,
      entry.package,
      entry.downloads,
      entry.manualStatus,
      entry.namespaceStatus,
      entry.exampleBlockCount,
      entry.exportedNameCount,
      entry.excludedPackageCallCount,
      entry.featureIds.join("|"),
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function renderFeatureCsv(snapshot) {
  const rows = [
    [
      "rank",
      "priority",
      "feature_id",
      "feature",
      "nativr_status",
      "packages",
      "package_reach_percent",
      "download_weighted_reach_percent",
    ],
    ...snapshot.features.map((entry, index) => [
      index + 1,
      entry.priority,
      entry.id,
      entry.label,
      entry.status,
      entry.packageCount,
      formatPercent(entry.packageReach),
      formatPercent(entry.downloadReach),
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function renderCallableCsv(snapshot, availableNames) {
  const rows = [
    [
      "rank",
      "callable",
      "nativr_available",
      "packages",
      "source_packages",
      "occurrences",
      "package_reach_percent",
      "download_weighted_reach_percent",
    ],
    ...snapshot.calls.map((entry, index) => [
      index + 1,
      entry.name,
      availableNames.has(entry.name),
      entry.packageCount,
      entry.packageNames.join("|"),
      entry.occurrenceCount,
      formatPercent(entry.packageReach),
      formatPercent(entry.downloadReach),
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function renderPackageFigure(snapshot) {
  const entries = snapshot.packages.slice(0, 20);
  const width = 1200;
  const height = 1010;
  const left = 225;
  const right = 150;
  const top = 150;
  const rowHeight = 39;
  const plotWidth = width - left - right;
  const maximum = Math.max(...entries.map((entry) => entry.downloads));
  const bars = entries
    .map((entry, index) => {
      const y = top + index * rowHeight;
      const barWidth = (entry.downloads / maximum) * plotWidth;
      return [
        `<text x="${left - 16}" y="${y + 19}" text-anchor="end" class="label">${escapeXml(entry.package)}</text>`,
        `<rect x="${left}" y="${y}" width="${barWidth.toFixed(1)}" height="24" rx="3" fill="#2563eb"/>`,
        `<text x="${Math.min(left + barWidth + 10, width - right + 4).toFixed(1)}" y="${y + 18}" class="value">${formatCompact(entry.downloads)}</text>`,
      ].join("\n");
    })
    .join("\n");

  return svgDocument({
    width,
    height,
    title: "Top CRAN package downloads in the sampled 30-day window",
    description: `The twenty most downloaded packages from ${snapshot.sample.start} through ${snapshot.sample.end}, using cranlogs data from the RStudio CRAN mirror.`,
    body: `
<text x="60" y="60" class="title">Top CRAN package downloads</text>
<text x="60" y="94" class="subtitle">${snapshot.sample.start} through ${snapshot.sample.end}; RStudio CRAN mirror via cranlogs</text>
<line x1="${left}" y1="${top - 20}" x2="${left}" y2="${top + entries.length * rowHeight - 12}" stroke="#94a3b8"/>
${bars}
<text x="60" y="${height - 45}" class="note">Counts include direct installs and dependency installs; they measure mirror downloads, not unique users.</text>`,
  });
}

function renderFeatureFigure(snapshot) {
  const entries = snapshot.features.slice(0, 15);
  const width = 1200;
  const height = 1070;
  const left = 310;
  const right = 135;
  const top = 190;
  const rowHeight = 54;
  const plotWidth = width - left - right;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const grid = ticks
    .map((tick) => {
      const x = left + tick * plotWidth;
      return `<line x1="${x}" y1="${top - 18}" x2="${x}" y2="${top + entries.length * rowHeight - 16}" stroke="#e2e8f0"/><text x="${x}" y="${top - 28}" text-anchor="middle" class="tick">${formatPercent(tick)}%</text>`;
    })
    .join("\n");
  const bars = entries
    .map((entry, index) => {
      const y = top + index * rowHeight;
      const downloadWidth = entry.downloadReach * plotWidth;
      const packageWidth = entry.packageReach * plotWidth;
      return [
        `<text x="${left - 18}" y="${y + 15}" text-anchor="end" class="label">${escapeXml(entry.label)}</text>`,
        `<text x="${left - 18}" y="${y + 34}" text-anchor="end" class="meta">${entry.priority} - ${entry.status}</text>`,
        `<rect x="${left}" y="${y}" width="${downloadWidth.toFixed(1)}" height="14" rx="2" fill="#2563eb"/>`,
        `<rect x="${left}" y="${y + 20}" width="${packageWidth.toFixed(1)}" height="9" rx="2" fill="#f59e0b"/>`,
        `<text x="${Math.min(left + downloadWidth + 8, width - right + 4).toFixed(1)}" y="${y + 12}" class="value">${formatPercent(entry.downloadReach)}%</text>`,
      ].join("\n");
    })
    .join("\n");

  return svgDocument({
    width,
    height,
    title: "Data-backed R feature reach and NativR implementation status",
    description:
      "The fifteen highest-reach measured R feature groups found in CRAN reference-manual examples, ranked by download-weighted package reach, with NativR implementation status and unweighted package reach.",
    body: `
<text x="60" y="60" class="title">R feature reach and NativR support</text>
<text x="60" y="94" class="subtitle">${snapshot.sample.analyzedPackageCount} analyzable manuals among the top ${snapshot.sample.packageCount} downloads; ${snapshot.sample.start} through ${snapshot.sample.end}</text>
<rect x="60" y="121" width="18" height="12" rx="2" fill="#2563eb"/><text x="88" y="132" class="legend">Download-weighted package reach</text>
<rect x="355" y="123" width="18" height="8" rx="2" fill="#f59e0b"/><text x="383" y="132" class="legend">Unweighted package reach</text>
${grid}
${bars}
<text x="60" y="${height - 54}" class="note">P0 &gt;= 65%, P1 &gt;= 40%, P2 &gt;= 20%, P3 &lt; 20% weighted reach. Frequency guides sequencing; architecture and prerequisites still constrain implementation order.</text>`,
  });
}

function renderCallableFigure(snapshot, availableNames) {
  const entries = snapshot.calls.filter((entry) => !availableNames.has(entry.name)).slice(0, 20);
  const width = 1200;
  const height = 1120;
  const left = 250;
  const right = 155;
  const top = 170;
  const rowHeight = 43;
  const plotWidth = width - left - right;
  const maximum = Math.max(...entries.map((entry) => entry.downloadReach), 0.01);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const grid = ticks
    .map((tick) => {
      const x = left + tick * plotWidth;
      return `<line x1="${x}" y1="${top - 18}" x2="${x}" y2="${top + entries.length * rowHeight - 12}" stroke="#e2e8f0"/><text x="${x}" y="${top - 28}" text-anchor="middle" class="tick">${formatPercent(tick * maximum)}%</text>`;
    })
    .join("\n");
  const bars = entries
    .map((entry, index) => {
      const y = top + index * rowHeight;
      const barWidth = (entry.downloadReach / maximum) * plotWidth;
      return [
        `<text x="${left - 16}" y="${y + 16}" text-anchor="end" class="label">${escapeXml(entry.name)}</text>`,
        `<rect x="${left}" y="${y}" width="${barWidth.toFixed(1)}" height="20" rx="3" fill="#dc2626"/>`,
        `<text x="${Math.min(left + barWidth + 8, width - right + 4).toFixed(1)}" y="${y + 15}" class="value">${formatPercent(entry.downloadReach)}%</text>`,
        `<text x="${left}" y="${y + 36}" class="meta">${entry.packageCount} packages; ${entry.occurrenceCount} observed calls</text>`,
      ].join("\n");
    })
    .join("\n");

  return svgDocument({
    width,
    height,
    title: "Highest-reach GNU R core callables not available in NativR",
    description:
      "The twenty highest download-weighted GNU R core callable names detected in CRAN reference-manual examples that are not present as NativR builtins or evaluator-native callable language forms.",
    body: `
<text x="60" y="60" class="title">Highest-reach missing GNU R callables</text>
<text x="60" y="94" class="subtitle">${snapshot.sample.analyzedPackageCount} analyzable manuals; ranked by download-weighted package reach</text>
<text x="60" y="122" class="legend">Red means the callable is absent from NativR builtins and evaluator-native callable language forms; behavioral completeness is stricter than availability.</text>
${grid}
${bars}
<text x="60" y="${height - 48}" class="note">Named-call syntax only; operators and indirect calls are measured elsewhere. Counts are aggregate observations, and no example source is retained.</text>`,
  });
}

function svgDocument({ width, height, title, description, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
<title id="title">${escapeXml(title)}</title>
<desc id="description">${escapeXml(description)}</desc>
<rect width="${width}" height="${height}" fill="#ffffff"/>
<style>
  text { font-family: Inter, "Segoe UI", Arial, sans-serif; fill: #0f172a; }
  .title { font-size: 30px; font-weight: 600; }
  .subtitle { font-size: 16px; fill: #475569; }
  .label { font-size: 16px; font-weight: 600; }
  .value { font-size: 14px; font-variant-numeric: tabular-nums; }
  .meta, .tick { font-size: 12px; fill: #64748b; }
  .legend { font-size: 14px; fill: #334155; }
  .note { font-size: 14px; fill: #475569; }
</style>
${body}
</svg>
`;
}

function validateSnapshot(snapshot) {
  if (
    snapshot?.schemaVersion !== 3 ||
    snapshot.detectorFingerprint !== featureDetectorFingerprint() ||
    !Array.isArray(snapshot.packages) ||
    !Array.isArray(snapshot.features) ||
    !Array.isArray(snapshot.calls)
  ) {
    throw new Error(
      `Unsupported, invalid, or detector-stale package-usage snapshot at ${snapshotPath}. Run "pnpm research:usage".`,
    );
  }
}

function featureDetectorFingerprint() {
  const serialized = {
    features: FEATURES.map(({ id, label, surface, status, patterns }) => ({
      id,
      label,
      surface,
      status,
      patterns: patterns.map((pattern) => pattern.toString()),
    })),
    callPattern: CALL_PATTERN.toString(),
    localFunctionPattern: LOCAL_FUNCTION_PATTERN.toString(),
    namespaceExportPattern: NAMESPACE_EXPORT_PATTERN.toString(),
    nonCallKeywords: [...NON_CALL_KEYWORDS].sort(),
  };
  return createHash("sha256").update(JSON.stringify(serialized)).digest("hex");
}

async function checkArtifact(file, expected) {
  const actual = await readFile(file, "utf8");
  if (actual !== expected) {
    throw new Error(
      `${path.relative(root, file)} is stale. Run "pnpm research:usage:render" and commit the result.`,
    );
  }
}

function priorityBand(downloadReach) {
  if (downloadReach >= 0.65) return "P0";
  if (downloadReach >= 0.4) return "P1";
  if (downloadReach >= 0.2) return "P2";
  return "P3";
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatPercent(value) {
  return (value * 100).toFixed(1);
}

function formatCompact(value) {
  return value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}M`
    : `${(value / 1_000).toFixed(0)}k`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
