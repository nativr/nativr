import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const statusPath = path.join(root, "compatibility", "status.json");
const capabilities = JSON.parse(
  await readFile(path.join(root, "docs", "compatibility-manifest.json"), "utf8"),
);
const profiles = JSON.parse(
  await readFile(path.join(root, "compatibility", "profiles.json"), "utf8"),
);
const names = JSON.parse(
  await readFile(path.join(root, "compatibility", "gnu-r", "name-coverage.json"), "utf8"),
);
const corpus = JSON.parse(
  await readFile(path.join(root, "compatibility", "package-corpus.json"), "utf8"),
);
const foundation = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "foundation.json"), "utf8"),
);
const oracleV2 = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "oracle-v2.json"), "utf8"),
);
const manifestCanonical = JSON.stringify(capabilities);
const tierNumber = (tier) => Number(tier.slice(1));
const packageCounts = Object.fromEntries(
  Object.keys(corpus.tiers).map((tier) => [
    tier,
    corpus.packages.filter((entry) => tierNumber(entry.tier) >= tierNumber(tier)).length,
  ]),
);

const status = {
  schemaVersion: 1,
  targetRVersion: profiles.normative.version,
  compatibilityProfile: profiles.normative.id,
  platformProfile: profiles.platformProfile.id,
  nativrVersion: capabilities.nativrVersion,
  protocolVersion: capabilities.protocolVersion,
  semanticProfileVersion: capabilities.semanticProfileVersion,
  capabilityManifestHash: createHash("sha256").update(manifestCanonical).digest("hex"),
  evidence: {
    checkedInConformanceCases: foundation.length,
    liveREligibleCases: foundation.filter((entry) => entry.rOracle !== false).length,
    recursiveOracleV2Cases: oracleV2.length,
    recursiveBehaviorallyProvenBindings: null,
    note: "Recursive behavioral binding counts remain null until oracle-v2 cases are associated with registry bindings; name overlap is inventory only.",
  },
  nameInventory: {
    referenceVersion: names.referenceVersion,
    registeredBindings: names.totals.nativrRegisteredNames,
    gnuRNameOverlaps: names.totals.overlappingNames,
    referenceCoreCallableNames: names.totals.referenceCoreCallableNames,
  },
  packageCorpus: {
    total: corpus.packages.length,
    partitions: Object.fromEntries(
      ["development", "regression", "holdout"].map((partition) => [
        partition,
        corpus.packages.filter((entry) => entry.partition === partition).length,
      ]),
    ),
    statuses: Object.fromEntries(
      ["passing", "blocked", "unevaluated"].map((status) => [
        status,
        corpus.packages.filter((entry) => entry.status === status).length,
      ]),
    ),
    completedAtLeast: packageCounts,
  },
};
const expected = await format(JSON.stringify(status), {
  ...prettierOptions,
  filepath: statusPath,
});

if (process.argv.includes("--check")) {
  const actual = await readFile(statusPath, "utf8");
  if (actual !== expected) {
    throw new Error('Compatibility status is stale. Run "pnpm status:render".');
  }
  console.log("Canonical compatibility status matches its generated inputs.");
} else {
  await writeFile(statusPath, expected);
  console.log("Rendered compatibility/status.json from compatibility evidence.");
}
