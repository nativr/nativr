import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FEATURES } from "./package-usage.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const testPath = path.join(root, "packages", "nativr", "test", "feature-priority.test.ts");
const source = await readFile(testPath, "utf8");
const caseSection = source.match(/const featureCases = \[(?<cases>[\s\S]+?)\] as const;/u)?.groups
  ?.cases;

if (caseSection === undefined) {
  throw new Error("Unable to locate the feature-priority acceptance catalog.");
}

const acceptance = [
  ...caseSection.matchAll(/id:\s*"(?<id>[^"]+)",\s*surfaces:\s*(?:\n\s*)?"(?<surface>[^"]+)"/gu),
].map((match) => ({
  id: match.groups?.id,
  surface: match.groups?.surface,
}));
const expected = FEATURES.map(({ id, surface }) => ({ id, surface }));

if (FEATURES.some((feature) => feature.status !== "supported")) {
  throw new Error("Every measured feature must be supported before the acceptance check can pass.");
}
if (JSON.stringify(acceptance) !== JSON.stringify(expected)) {
  throw new Error(
    `Feature acceptance catalog does not match the usage detector.\nExpected ${JSON.stringify(expected)}\nReceived ${JSON.stringify(acceptance)}`,
  );
}

console.log(
  `Feature acceptance catalog matches all ${FEATURES.length} supported usage-detector groups.`,
);
