import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
import { readCallableDomainSources } from "./lib/callable-domain-inputs.mjs";
import {
  buildCallableDomainInventory,
  checkCallableDomainInventory,
  serializeCallableDomainInventory,
} from "./lib/callable-domain-inventory.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
if (args.some((argument) => argument !== "--check"))
  throw new Error("Only --check is supported by the callable inventory command.");
const check = args.includes("--check");
const report = buildCallableDomainInventory(await readCallableDomainSources(root));
const output = path.join(root, "compatibility/callable-domain-inventory.json");
const expected = await format(serializeCallableDomainInventory(report), {
  ...prettierOptions,
  filepath: output,
});
if (check) checkCallableDomainInventory(await readFile(output, "utf8"), expected);
else await writeFile(output, expected);
console.log(
  JSON.stringify({
    action: check ? "checked" : "rendered",
    semanticProfileVersion: report.semanticProfileVersion,
    ...report.totals,
  }),
);
