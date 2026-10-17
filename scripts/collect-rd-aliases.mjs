import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
import { run } from "./lib/commands.mjs";

// Collect the Rd topic aliases of GNU R's base and recommended packages for cross-reference checks
// (RFC-0008). Only installed help-index metadata is observed.
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
    packages.set(fields[1] ?? "", { reported: Number(fields[2] ?? 0), aliases: [] });
  else if (fields[0] === "ALIAS")
    packages.get(fields[1] ?? "")?.aliases.push(decode(fields[2] ?? ""));
  else throw new Error(`Unexpected Rd alias record: ${line}`);
}
for (const [name, record] of packages)
  if (record.aliases.length !== record.reported)
    throw new Error(
      `${name} reported ${record.reported} aliases but emitted ${record.aliases.length}.`,
    );

const snapshot = {
  schemaVersion: 1,
  provenance: {
    kind: "black-box-help-index-observation",
    policy: "docs/clean-room.md",
    implementationBodiesCollected: false,
  },
  reference: {
    version: metadata.version ?? "unknown",
    platform: metadata.platform ?? "unknown",
  },
  packages: Object.fromEntries([...packages].map(([name, record]) => [name, record.aliases])),
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
