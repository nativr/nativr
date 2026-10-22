import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
import { collectOracleV2BindingEvidence } from "./lib/oracle-v2-binding-evidence.mjs";
import { readCallableDomainSources } from "./lib/callable-domain-inputs.mjs";
import {
  buildCallableDomainInventory,
  checkCallableDomainInventory,
  serializeCallableDomainInventory,
} from "./lib/callable-domain-inventory.mjs";

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
const surface = JSON.parse(
  await readFile(path.join(root, "compatibility", "gnu-r", "surface.json"), "utf8"),
);
const corpus = JSON.parse(
  await readFile(path.join(root, "compatibility", "package-corpus.json"), "utf8"),
);
const foundation = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "foundation.json"), "utf8"),
);
const packageLoader = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "package-loader.json"), "utf8"),
);
const oracleV2 = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "oracle-v2.json"), "utf8"),
);
const recursiveBindingEvidence = collectOracleV2BindingEvidence(oracleV2, capabilities, surface);
const inventoryPath = "compatibility/callable-domain-inventory.json";
const inventoryText = await readFile(path.join(root, inventoryPath), "utf8");
const inventory = buildCallableDomainInventory(await readCallableDomainSources(root));
checkCallableDomainInventory(
  inventoryText,
  await format(serializeCallableDomainInventory(inventory), {
    ...prettierOptions,
    filepath: inventoryPath,
  }),
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
    checkedInConformanceCases: foundation.length + packageLoader.length,
    liveREligibleCases: foundation.filter((entry) => entry.rOracle !== false).length,
    packageLoaderCases: packageLoader.length,
    recursiveOracleV2Cases: oracleV2.length,
    recursiveBehaviorallyProvenBindings: recursiveBindingEvidence.length,
    recursiveBindingEvidence,
    note: "This binding count covers listed exact Oracle v2 cases, conditional on a passing live GNU R 4.6.1 graph comparison and causal shadow controls. It is not general binding compatibility; name overlap is inventory only.",
  },
  nameInventory: {
    referenceVersion: names.referenceVersion,
    registeredBindings: names.totals.nativrRegisteredNames,
    gnuRNameOverlaps: names.totals.overlappingNames,
    referenceCoreCallableNames: names.totals.referenceCoreCallableNames,
  },
  callableInventory: {
    report: inventoryPath,
    sha256: createHash("sha256").update(inventoryText, "utf8").digest("hex"),
    ...inventory.totals,
    note: "Qualified bindings use exact package and name identity. Classification and causal links are declarations, not completed compatibility. All thirteen domain matrices remain incomplete.",
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
