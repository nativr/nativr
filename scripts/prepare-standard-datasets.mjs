import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// This is a build-time, offline transform of the independently licensed UCI Iris data.
// The browser runtime does not run this script or access the network.
const source = new URL("../packages/nativr/src/datasets/bezdekIris.data", import.meta.url);
const output = new URL("../packages/nativr/src/datasets/iris.txt", import.meta.url);
const expectedSourceSha256 = "0fed2a99db77ec533a62dc66894d3ec6df3b58b6a8f3cf4a6b47e4086b7f97dc";
const expectedOutputSha256 = "80a45375d65c8b97d79544ab8b575a0604c747463142d0ef8093c45f99432042";

const bytes = await readFile(source);
const sourceSha256 = sha256(bytes);
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(`UCI Iris source integrity mismatch: ${sourceSha256}`);
}

const lines = bytes.toString("ascii").trimEnd().split(/\r?\n/u);
if (lines.length !== 150) throw new Error(`Expected 150 Iris observations, found ${lines.length}.`);
const speciesCounts = new Map([
  ["setosa", 0],
  ["versicolor", 0],
  ["virginica", 0],
]);
const rows = lines.map((line, index) => {
  const fields = line.split(",");
  if (fields.length !== 5 || fields.slice(0, 4).some((field) => !/^\d+(?:\.\d+)?$/u.test(field))) {
    throw new Error(`Unexpected UCI Iris record ${index + 1}.`);
  }
  const label = fields[4]?.replace(/^Iris-/u, "");
  if (label === undefined || !speciesCounts.has(label)) {
    throw new Error(`Unexpected UCI Iris species at record ${index + 1}.`);
  }
  speciesCounts.set(label, (speciesCounts.get(label) ?? 0) + 1);
  return [...fields.slice(0, 4), label].join("\t");
});
if ([...speciesCounts.values()].some((count) => count !== 50)) {
  throw new Error("Expected 50 observations of each Iris species.");
}

const text = ["Sepal.Length\tSepal.Width\tPetal.Length\tPetal.Width\tSpecies", ...rows, ""].join(
  "\n",
);
const outputSha256 = sha256(Buffer.from(text, "utf8"));
if (outputSha256 !== expectedOutputSha256) {
  throw new Error(`Transformed Iris data integrity mismatch: ${outputSha256}`);
}
await writeFile(output, text, "utf8");
process.stdout.write(`iris.txt sha256 ${outputSha256}\n`);

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
