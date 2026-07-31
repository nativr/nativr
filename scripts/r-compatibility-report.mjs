import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const surfacePath = path.join(root, "compatibility", "gnu-r", "surface.json");
const capabilityPath = path.join(root, "docs", "compatibility-manifest.json");
const reportPath = path.join(root, "compatibility", "gnu-r", "name-coverage.json");
const surface = JSON.parse(await readFile(surfacePath, "utf8"));
const capabilities = JSON.parse(await readFile(capabilityPath, "utf8"));
const nativrNames = new Set(
  capabilities.packages.flatMap((entry) => entry.functions.map((item) => item.name)),
);
const referenceCallableNames = new Set(
  surface.packages.flatMap((entry) =>
    entry.exports.filter((item) => item.callable).map((item) => item.name),
  ),
);
const matched = [...referenceCallableNames].filter((name) => nativrNames.has(name)).sort();
const missing = [...referenceCallableNames].filter((name) => !nativrNames.has(name)).sort();
const extra = [...nativrNames].filter((name) => !referenceCallableNames.has(name)).sort();
const report = {
  schemaVersion: 1,
  referenceVersion: surface.reference.version,
  warning:
    "Name overlap is an inventory metric only. It is not evidence of behavioral compatibility.",
  totals: {
    referenceCoreCallableNames: referenceCallableNames.size,
    nativrRegisteredNames: nativrNames.size,
    overlappingNames: matched.length,
    missingReferenceNames: missing.length,
    nativrExtensionNames: extra.length,
    nameCoverage: Number((matched.length / referenceCallableNames.size).toFixed(6)),
  },
  byPackage: surface.packages.map((entry) => {
    const callableNames = [
      ...new Set(entry.exports.filter((item) => item.callable).map((item) => item.name)),
    ];
    const packageMatched = callableNames.filter((name) => nativrNames.has(name)).sort();
    return {
      package: entry.name,
      callableNames: callableNames.length,
      overlappingNames: packageMatched.length,
      nameCoverage:
        callableNames.length === 0
          ? 1
          : Number((packageMatched.length / callableNames.length).toFixed(6)),
    };
  }),
  matched,
  missing,
  extra,
};
const expected = await format(JSON.stringify(report), {
  ...prettierOptions,
  filepath: reportPath,
});

if (process.argv.includes("--check")) {
  const actual = await readFile(reportPath, "utf8");
  if (actual !== expected) {
    throw new Error('GNU R name-coverage report is stale. Run "pnpm compatibility:report".');
  }
  console.log(
    `GNU R name inventory report is current: ${matched.length}/${referenceCallableNames.size} names overlap.`,
  );
} else {
  await writeFile(reportPath, expected);
  console.log(
    `Rendered GNU R name inventory report: ${matched.length}/${referenceCallableNames.size} names overlap.`,
  );
}
