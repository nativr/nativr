import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";

// Reduce a full local package-check report to a redacted, checked-in summary: provenance, stage
// outcomes with inventory counts, and comparison outcomes. No output text, condition text, source
// or check-item identifiers that embed source positions are retained (policy sha256-no-output-v1).
const [input, output] = process.argv.slice(2);
if (input === undefined || output === undefined)
  throw new Error("Usage: node scripts/redact-package-check.mjs REPORT.json SUMMARY.json");
const raw = await readFile(input);
const report = JSON.parse(raw.toString("utf8"));
const outcomes = {};
for (const observation of report.observations)
  outcomes[observation.comparison.outcome] = (outcomes[observation.comparison.outcome] ?? 0) + 1;
const summary = {
  schemaVersion: 1,
  kind: "nativr-package-check-summary",
  rawReportSha256: createHash("sha256").update(raw).digest("hex"),
  redaction: {
    policy: "sha256-no-output-v1",
    rawOutputIncluded: false,
    rawConditionsIncluded: false,
    sourceIncluded: false,
  },
  package: report.package,
  provenance: report.provenance,
  executionProfile: {
    rng: report.executionProfile?.rng,
    oracleRepeat: report.executionProfile?.oracleRepeat,
    runtimeProfile: report.executionProfile?.runtimeProfile,
    capture: report.executionProfile?.capture,
  },
  p7Eligible: report.p7Eligible,
  firstBlocker: report.firstBlocker,
  stages: report.stages.map((stage) => ({
    id: stage.id,
    status: stage.status,
    reason: stage.reason,
    discovered: stage.discovered.length,
    executed: stage.executed.length,
  })),
  comparisons: {
    total: report.observations.length,
    outcomes,
    repeatable: report.observations.every(
      (observation) => observation.expected?.repeatable !== false,
    ),
  },
};
await writeFile(
  output,
  await format(JSON.stringify(summary), { ...prettierOptions, filepath: output }),
);
console.log(`Wrote ${output} (p7Eligible: ${summary.p7Eligible}).`);
