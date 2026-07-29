import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const researchDirectory = path.join(root, "research", "package-usage");
const figureDirectory = path.join(root, "docs", "figures");
const snapshotPath = path.join(researchDirectory, "snapshot.json");
const packageCsvPath = path.join(researchDirectory, "package-downloads.csv");
const featureCsvPath = path.join(researchDirectory, "feature-reach.csv");
const packageFigurePath = path.join(figureDirectory, "package-downloads.svg");
const featureFigurePath = path.join(figureDirectory, "feature-priority.svg");

const TOP_PACKAGES_URL = "https://cranlogs.r-pkg.org/top/last-month/100";
const MANUAL_URL = (packageName) =>
  `https://cran.r-project.org/web/packages/${encodeURIComponent(packageName)}/refman/${encodeURIComponent(packageName)}.html`;
const USER_AGENT = "NativR package-usage research (https://github.com/nativr/nativr)";

const FEATURES = [
  {
    id: "comparisons",
    label: "Comparison operators",
    status: "unsupported",
    patterns: [/<=|>=|==|!=|(?<!<)<(?![-<=])|(?<![-|%>])>(?![=>])/u],
  },
  {
    id: "logical-operators",
    label: "Logical operators",
    status: "partial",
    patterns: [/&&|\|\||(?<![|])\|(?![|>])|(?<!&)&(?!&)|!(?!=)/u],
  },
  {
    id: "subsetting",
    label: "Vector/list subsetting [",
    status: "parsed",
    patterns: [/[A-Za-z0-9_.)\]]\s*\[(?!\[)/u],
  },
  {
    id: "extraction",
    label: "Element/member extraction [[ and $",
    status: "parsed",
    patterns: [/\[\[|\$(?:[A-Za-z._]|`)/u],
  },
  {
    id: "conditionals",
    label: "if / else",
    status: "parsed",
    patterns: [/\bif\s*\(|\belse\b/u],
  },
  {
    id: "return",
    label: "return",
    status: "parsed",
    patterns: [/\breturn\s*\(/u],
  },
  {
    id: "loops",
    label: "for / while / repeat",
    status: "parsed",
    patterns: [/\b(?:for|while)\s*\(|\brepeat\b/u],
  },
  {
    id: "lists",
    label: "Lists",
    status: "unsupported",
    patterns: [/\b(?:list|as\.list|pairlist)\s*\(/u],
  },
  {
    id: "names-attributes",
    label: "Names and attributes",
    status: "unsupported",
    patterns: [
      /\b(?:names|setNames|unname|attr|attributes|structure|class|unclass|rownames|colnames|dimnames)\s*\(/u,
    ],
  },
  {
    id: "sequences-repetition",
    label: "Sequences and repetition",
    status: "unsupported",
    patterns: [/\b(?:seq|seq_along|seq_len|rep|rep_len)\s*\(/u, /(?<!:):(?!:)/u],
  },
  {
    id: "pipes",
    label: "Native and magrittr pipes",
    status: "parsed",
    patterns: [/\|>|%>%/u],
  },
  {
    id: "formulas",
    label: "Formulas",
    status: "parsed",
    patterns: [/(?<![%~])~(?![%~])/u],
  },
  {
    id: "data-frames",
    label: "Data frames",
    status: "unsupported",
    patterns: [/\b(?:data\.frame|as\.data\.frame|tibble|tribble)\s*\(/u],
  },
  {
    id: "matrices-arrays",
    label: "Matrices, arrays, and dimensions",
    status: "unsupported",
    patterns: [/\b(?:matrix|array|as\.matrix|dim|nrow|ncol|rbind|cbind)\s*\(/u],
  },
  {
    id: "factors",
    label: "Factors",
    status: "unsupported",
    patterns: [/\b(?:factor|ordered|levels|droplevels)\s*\(/u],
  },
  {
    id: "string-helpers",
    label: "String helpers",
    status: "unsupported",
    patterns: [
      /\b(?:paste|paste0|sprintf|format|grep|grepl|gsub|sub|strsplit|substring|substr|nchar|tolower|toupper|chartr)\s*\(/u,
    ],
  },
  {
    id: "sorting-matching",
    label: "Sorting and matching",
    status: "unsupported",
    patterns: [/\b(?:sort|order|rank|unique|duplicated|match|which|which\.max|which\.min)\s*\(/u],
  },
  {
    id: "apply-family",
    label: "Apply/map family",
    status: "unsupported",
    patterns: [/\b(?:apply|lapply|sapply|vapply|mapply|Map|Reduce|Filter|by|aggregate)\s*\(/u],
  },
  {
    id: "statistics",
    label: "Descriptive statistics",
    status: "partial",
    patterns: [
      /\b(?:mean|sum|sd|var|median|quantile|cor|cov|min|max|range|summary|table|prop\.table)\s*\(/u,
    ],
  },
  {
    id: "random-numbers",
    label: "Random numbers and sampling",
    status: "unsupported",
    patterns: [/\b(?:set\.seed|sample|runif|rnorm|rbinom|rpois|rchisq|rt|rexp)\s*\(/u],
  },
  {
    id: "dates-times",
    label: "Dates and times",
    status: "unsupported",
    patterns: [/\b(?:as\.Date|as\.POSIXct|strptime|difftime|Sys\.Date|Sys\.time)\s*\(/u],
  },
  {
    id: "namespaces",
    label: "Namespace access",
    status: "parsed",
    patterns: [/:::{0,1}/u],
  },
  {
    id: "ellipsis",
    label: "Ellipsis arguments",
    status: "unsupported",
    patterns: [/\.\.\./u],
  },
  {
    id: "replacement",
    label: "Replacement assignment",
    status: "unsupported",
    patterns: [/(?:\[[^\n\]]+\]|\$[A-Za-z._][\w.]*)\s*<-/u],
  },
  {
    id: "object-systems",
    label: "S3/S4/R6/S7 object systems",
    status: "unsupported",
    patterns: [
      /\b(?:UseMethod|NextMethod|setClass|setGeneric|setMethod|R6Class|new_class|new_vctr)\s*\(/u,
    ],
  },
];

const arguments_ = new Set(process.argv.slice(2));
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
  const artifacts = [
    [packageCsvPath, renderPackageCsv(snapshot)],
    [featureCsvPath, renderFeatureCsv(snapshot)],
    [packageFigurePath, renderPackageFigure(snapshot)],
    [featureFigurePath, renderFeatureFigure(snapshot)],
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

async function collectSnapshot() {
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
    };
  });

  const packages = await mapLimit(rankedPackages, 4, async (entry) => {
    try {
      const manual = await fetchText(entry.manualUrl);
      const exampleBlocks = extractExamples(manual);
      if (exampleBlocks.length === 0) {
        return {
          ...entry,
          manualStatus: "no-examples",
          exampleBlockCount: 0,
          exampleCharacters: 0,
          featureIds: [],
        };
      }
      const examples = exampleBlocks.join("\n");
      return {
        ...entry,
        manualStatus: "analyzed",
        exampleBlockCount: exampleBlocks.length,
        exampleCharacters: examples.length,
        featureIds: detectFeatures(examples),
      };
    } catch (error) {
      console.warn(
        `Skipping ${entry.package}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ...entry,
        manualStatus: "unavailable",
        exampleBlockCount: 0,
        exampleCharacters: 0,
        featureIds: [],
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

  return {
    schemaVersion: 1,
    detectorFingerprint: featureDetectorFingerprint(),
    collectedAt: new Date().toISOString(),
    sample: {
      source: TOP_PACKAGES_URL,
      manualSourceTemplate:
        "https://cran.r-project.org/web/packages/{package}/refman/{package}.html",
      start: top.start.slice(0, 10),
      end: top.end.slice(0, 10),
      requestedPackageCount: 100,
      packageCount: packages.length,
      analyzedPackageCount: analyzedPackages.length,
      totalDownloads,
      analyzedDownloads,
      method:
        "Download-weighted package reach across language features detected in CRAN-generated reference-manual example blocks.",
    },
    packages,
    features,
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

function detectFeatures(source) {
  const code = stripCommentsAndStrings(source);
  return FEATURES.filter((feature) => feature.patterns.some((pattern) => pattern.test(code))).map(
    (feature) => feature.id,
  );
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
    ["rank", "package", "downloads", "manual_status", "example_blocks", "features_detected"],
    ...snapshot.packages.map((entry) => [
      entry.rank,
      entry.package,
      entry.downloads,
      entry.manualStatus,
      entry.exampleBlockCount,
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
  const entries = snapshot.features.filter((entry) => entry.status !== "supported").slice(0, 15);
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
        `<text x="${left - 18}" y="${y + 34}" text-anchor="end" class="meta">${entry.priority} · ${entry.status}</text>`,
        `<rect x="${left}" y="${y}" width="${downloadWidth.toFixed(1)}" height="14" rx="2" fill="#2563eb"/>`,
        `<rect x="${left}" y="${y + 20}" width="${packageWidth.toFixed(1)}" height="9" rx="2" fill="#f59e0b"/>`,
        `<text x="${Math.min(left + downloadWidth + 8, width - right + 4).toFixed(1)}" y="${y + 12}" class="value">${formatPercent(entry.downloadReach)}%</text>`,
      ].join("\n");
    })
    .join("\n");

  return svgDocument({
    width,
    height,
    title: "Data-backed NativR feature priorities",
    description:
      "The fifteen highest-reach R feature gaps found in CRAN reference-manual examples, ranked by download-weighted package reach, with unweighted package reach as a secondary measure.",
    body: `
<text x="60" y="60" class="title">R feature-gap priority by documented usage</text>
<text x="60" y="94" class="subtitle">${snapshot.sample.analyzedPackageCount} analyzable manuals among the top ${snapshot.sample.packageCount} downloads; ${snapshot.sample.start} through ${snapshot.sample.end}</text>
<rect x="60" y="121" width="18" height="12" rx="2" fill="#2563eb"/><text x="88" y="132" class="legend">Download-weighted package reach</text>
<rect x="355" y="123" width="18" height="8" rx="2" fill="#f59e0b"/><text x="383" y="132" class="legend">Unweighted package reach</text>
${grid}
${bars}
<text x="60" y="${height - 54}" class="note">P0 ≥ 65%, P1 ≥ 40%, P2 ≥ 20%, P3 &lt; 20% weighted reach. Frequency guides sequencing; architecture and prerequisites still constrain implementation order.</text>`,
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
    snapshot?.schemaVersion !== 1 ||
    snapshot.detectorFingerprint !== featureDetectorFingerprint() ||
    !Array.isArray(snapshot.packages) ||
    !Array.isArray(snapshot.features)
  ) {
    throw new Error(
      `Unsupported, invalid, or detector-stale package-usage snapshot at ${snapshotPath}. Run "pnpm research:usage".`,
    );
  }
}

function featureDetectorFingerprint() {
  const serialized = FEATURES.map(({ id, label, status, patterns }) => ({
    id,
    label,
    status,
    patterns: patterns.map((pattern) => pattern.toString()),
  }));
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
