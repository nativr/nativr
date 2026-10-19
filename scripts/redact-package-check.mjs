import { readFile, writeFile } from "node:fs/promises";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
import { redactPackageCheck } from "./lib/package-check-summary.mjs";

// Reduce a full local package-check report to a redacted, checked-in summary: provenance, stage
// outcomes with inventory counts, and comparison outcomes. Diagnostic strings are hashed;
// arbitrary nested fields and check-item identifiers are not retained.
const [input, output] = process.argv.slice(2);
if (input === undefined || output === undefined)
  throw new Error("Usage: node scripts/redact-package-check.mjs REPORT.json SUMMARY.json");
const raw = await readFile(input);
const summary = redactPackageCheck(raw);
await writeFile(
  output,
  await format(JSON.stringify(summary), { ...prettierOptions, filepath: output }),
);
console.log(`Wrote ${output} (p7Eligible: ${summary.p7Eligible}).`);
