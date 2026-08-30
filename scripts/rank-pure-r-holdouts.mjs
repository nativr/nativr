import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const [start = "2026-07-12", end = "2026-08-10", limitText = "40"] = process.argv.slice(2);
const limit = Number(limitText);
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
  throw new Error("Usage: node scripts/rank-pure-r-holdouts.mjs START END [LIMIT]");
}
if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("LIMIT must be a positive integer.");

const corpus = JSON.parse(
  await readFile(path.join(root, "compatibility", "package-corpus.json"), "utf8"),
);
const corpusNames = new Set(corpus.packages.map((entry) => entry.package));
const passingNames = new Set(
  corpus.packages.filter((entry) => entry.status === "passing").map((entry) => entry.package),
);
const corePackages = new Set([
  "base",
  "compiler",
  "datasets",
  "graphics",
  "grDevices",
  "grid",
  "methods",
  "parallel",
  "splines",
  "stats",
  "stats4",
  "tcltk",
  "tools",
  "utils",
]);
const availableDependencies = new Set([...corePackages, ...passingNames]);

const metadataResponse = await fetch("https://cloud.r-project.org/src/contrib/PACKAGES.gz");
if (!metadataResponse.ok) {
  throw new Error(`CRAN metadata request failed: ${metadataResponse.status}`);
}
const metadataRecords = parseDcf(
  gunzipSync(Buffer.from(await metadataResponse.arrayBuffer())).toString(),
);
const records = [...new Map(metadataRecords.map((record) => [record.Package, record])).values()];
const candidates = records.filter((record) => {
  if (record.Package === undefined || corpusNames.has(record.Package)) return false;
  if (record.NeedsCompilation?.trim().toLowerCase() === "yes") return false;
  if (record.OS_type?.trim()) return false;
  if (record.LinkingTo?.trim()) return false;
  const mandatory = [...dependencyNames(record.Depends), ...dependencyNames(record.Imports)];
  return mandatory.every((name) => availableDependencies.has(name));
});

const downloads = new Map();
for (let index = 0; index < candidates.length; index += 40) {
  const names = candidates
    .slice(index, index + 40)
    .map((record) => encodeURIComponent(record.Package))
    .join(",");
  const response = await fetch(
    `https://cranlogs.r-pkg.org/downloads/total/${start}:${end}/${names}`,
  );
  if (!response.ok) throw new Error(`cranlogs request failed: ${response.status}`);
  for (const row of await response.json()) downloads.set(row.package, row.downloads);
}

const ranked = candidates
  .map((record) => ({
    package: record.Package,
    version: record.Version,
    downloads: downloads.get(record.Package) ?? 0,
    depends: dependencyNames(record.Depends),
    imports: dependencyNames(record.Imports),
    suggests: dependencyNames(record.Suggests),
    license: record.License,
    description: record.Description,
    publication: record["Date/Publication"],
    needsCompilation: record.NeedsCompilation,
  }))
  .sort(
    (left, right) => right.downloads - left.downloads || left.package.localeCompare(right.package),
  );

console.log(
  JSON.stringify(
    {
      metadataUrl: "https://cloud.r-project.org/src/contrib/PACKAGES.gz",
      downloadWindow: { start, end },
      filteredCandidateCount: candidates.length,
      excludedExistingCorpusCount: records.filter((record) => corpusNames.has(record.Package))
        .length,
      candidates: ranked.slice(0, limit),
    },
    null,
    2,
  ),
);

function parseDcf(text) {
  return text
    .split(/\r?\n\r?\n/u)
    .map((block) => {
      const record = {};
      let field;
      for (const line of block.split(/\r?\n/u)) {
        if (/^\s/u.test(line) && field !== undefined) {
          record[field] = `${record[field]} ${line.trim()}`;
          continue;
        }
        const separator = line.indexOf(":");
        if (separator < 1) continue;
        field = line.slice(0, separator);
        record[field] = line.slice(separator + 1).trim();
      }
      return record;
    })
    .filter((record) => record.Package !== undefined);
}

function dependencyNames(value) {
  if (value === undefined || value.trim().length === 0) return [];
  return value
    .split(",")
    .map((entry) => entry.trim().replace(/\s*\(.*$/u, ""))
    .filter((name) => name.length > 0 && name !== "R");
}
