import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
import { run } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const oraclePath = path.join(root, "scripts", "r-surface-oracle.R");
const outputPath = path.join(root, "compatibility", "gnu-r", "surface.json");
const result = await run("Rscript", ["--vanilla", oraclePath], {
  cwd: root,
  capture: true,
});

const metadata = {};
const packages = new Map();
for (const line of result.stdout.split(/\r?\n/u)) {
  if (line.length === 0) continue;
  const fields = line.split("\t");
  if (fields[0] === "META") {
    metadata[fields[1] ?? ""] = decode(fields[2] ?? "");
    continue;
  }
  if (fields[0] === "PACKAGE") {
    packages.set(fields[1] ?? "", {
      name: fields[1] ?? "",
      reportedExportCount: Number(fields[2] ?? 0),
      exports: [],
    });
    continue;
  }
  if (fields[0] !== "SYMBOL") {
    throw new Error(`Unexpected R surface record: ${line}`);
  }
  const packageName = fields[1] ?? "";
  const packageRecord = packages.get(packageName);
  if (packageRecord === undefined) {
    throw new Error(`R surface symbol appeared before package '${packageName}'.`);
  }
  packageRecord.exports.push({
    name: decode(fields[2] ?? ""),
    type: fields[3] ?? "unknown",
    callable: fields[4] === "1",
    formals:
      fields[5] === undefined || fields[5] === ""
        ? []
        : fields[5].split(",").map((field) => decode(field)),
  });
}

for (const packageRecord of packages.values()) {
  if (packageRecord.exports.length !== packageRecord.reportedExportCount) {
    throw new Error(
      `${packageRecord.name} reported ${packageRecord.reportedExportCount} exports but emitted ${packageRecord.exports.length}.`,
    );
  }
}

const snapshot = {
  schemaVersion: 1,
  provenance: {
    kind: "black-box-interface-observation",
    policy: "docs/clean-room.md",
    implementationBodiesCollected: false,
  },
  reference: {
    version: metadata.version ?? "unknown",
    platform: metadata.platform ?? "unknown",
  },
  packages: [...packages.values()],
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  await format(JSON.stringify(snapshot), {
    ...prettierOptions,
    filepath: outputPath,
  }),
);
console.log(
  `Collected ${snapshot.packages.reduce((total, entry) => total + entry.exports.length, 0)} exported symbols from ${snapshot.packages.length} GNU R core namespaces.`,
);

function decode(value) {
  return decodeURIComponent(value.replaceAll("+", "%20"));
}
