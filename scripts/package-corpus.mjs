import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const corpusPath = path.join(root, "compatibility", "package-corpus.json");
const profilesPath = path.join(root, "compatibility", "profiles.json");
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
const profiles = JSON.parse(await readFile(profilesPath, "utf8"));

const partitions = new Set(["development", "regression", "holdout"]);
const statuses = new Set(["passing", "blocked", "unevaluated"]);
const tiers = Object.keys(corpus.tiers);
const names = new Set();

assert(corpus.schemaVersion === 1, "Unsupported package-corpus schemaVersion.");
assert(
  corpus.targetR === profiles.normative.version,
  "Package corpus targetR must match the normative profile.",
);
assert(
  Array.isArray(corpus.packages) && corpus.packages.length > 0,
  "Package corpus must not be empty.",
);

for (const entry of corpus.packages) {
  const key = `${entry.package}@${entry.version}`;
  assert(!names.has(key), `Duplicate package-corpus entry: ${key}.`);
  names.add(key);
  assert(partitions.has(entry.partition), `${key} has an unknown partition.`);
  assert(statuses.has(entry.status), `${key} has an unknown status.`);
  assert(tiers.includes(entry.tier), `${key} has an unknown validation tier.`);
  assert(
    entry.sourceUrl ===
      `${corpus.snapshot.repository}/src/contrib/${entry.package}_${entry.version}.tar.gz`,
    `${key} sourceUrl is not the pinned canonical source URL.`,
  );
  assert(/^[0-9a-f]{64}$/.test(entry.sourceSha256), `${key} has an invalid SHA-256 digest.`);
  assert(typeof entry.evidence === "string" && entry.evidence.length > 0, `${key} lacks evidence.`);
  if (entry.status === "blocked") {
    assert(entry.firstBlocker !== null, `${key} is blocked but has no firstBlocker.`);
  } else {
    assert(entry.firstBlocker === null, `${key} has a blocker while status is ${entry.status}.`);
  }
  if (entry.partition === "holdout") {
    assert(
      entry.status === "unevaluated",
      `${key} holdout was evaluated without a corpus revision.`,
    );
    assert(entry.tier === "P0", `${key} holdout must remain at P0 until its scheduled evaluation.`);
  }
}

for (const partition of partitions) {
  assert(
    corpus.packages.some((entry) => entry.partition === partition),
    `Package corpus partition '${partition}' is empty.`,
  );
}

console.log(
  `Package corpus is valid: ${corpus.packages.length} pinned releases (${[...partitions]
    .map(
      (partition) =>
        `${partition}=${corpus.packages.filter((entry) => entry.partition === partition).length}`,
    )
    .join(", ")}).`,
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
