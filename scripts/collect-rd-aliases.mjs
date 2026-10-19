import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
import { run } from "./lib/commands.mjs";

// Collect the Rd topic aliases of GNU R's base and recommended packages for cross-reference checks
// (RFC-0008). Only installed help-index aliases and public Rd filenames are observed.
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const oraclePath = path.join(root, "scripts", "r-rd-alias-oracle.R");
const outputPath = path.join(root, "compatibility", "gnu-r", "rd-aliases.json");
const result = await run(process.env.NATIVR_RSCRIPT ?? "Rscript", ["--vanilla", oraclePath], {
  cwd: root,
  capture: true,
});

const metadata = {};
const packages = new Map();
for (const line of result.stdout.split(/\r?\n/u)) {
  if (line.length === 0) continue;
  const fields = line.split("\t");
  if (fields[0] === "META") metadata[fields[1] ?? ""] = decode(fields[2] ?? "");
  else if (fields[0] === "PACKAGE")
    packages.set(fields[1] ?? "", {
      reported: Number(fields[2]),
      reportedFiles: Number(fields[3]),
      aliases: [],
      files: [],
    });
  else if (fields[0] === "ALIAS")
    packages.get(fields[1] ?? "")?.aliases.push(decode(fields[2] ?? ""));
  else if (fields[0] === "FILE") packages.get(fields[1] ?? "")?.files.push(decode(fields[2] ?? ""));
  else throw new Error(`Unexpected Rd alias record: ${line}`);
}
for (const [name, record] of packages) {
  if (record.aliases.length !== record.reported || record.files.length !== record.reportedFiles)
    throw new Error(`${name} emitted an incomplete help catalog.`);
  // Canonical ordering does not depend on the oracle process's collation locale.
  record.aliases.sort();
  record.files.sort();
}

const snapshot = {
  schemaVersion: 2,
  provenance: {
    kind: "black-box-help-index-observation",
    policy: "docs/clean-room.md",
    implementationBodiesCollected: false,
  },
  reference: {
    version: metadata.version ?? "unknown",
    platform: metadata.platform ?? "unknown",
  },
  packages: Object.fromEntries(
    [...packages]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, record]) => [name, record.aliases]),
  ),
  files: Object.fromEntries(
    [...packages]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, record]) => [name, record.files]),
  ),
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  await format(JSON.stringify(snapshot), { ...prettierOptions, filepath: outputPath }),
);
console.log(
  `Collected ${[...packages.values()].reduce((total, record) => total + record.aliases.length, 0)} Rd aliases from ${packages.size} GNU R packages.`,
);

function decode(value) {
  return decodeURIComponent(value);
}
