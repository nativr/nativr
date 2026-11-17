import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const changesetDirectory = fileURLToPath(new URL("../.changeset/", import.meta.url));
const pendingChangesets = readdirSync(changesetDirectory)
  .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
  .sort();

if (pendingChangesets.length > 0) {
  const preview = pendingChangesets.slice(0, 10).map((name) => `- .changeset/${name}`);
  const remainder = pendingChangesets.length - preview.length;
  console.error(
    [
      `Release is not ready: ${pendingChangesets.length} pending changeset(s) require a human-authored version commit.`,
      "",
      ...preview,
      ...(remainder > 0 ? [`- ...and ${remainder} more`] : []),
      "",
      "Run `pnpm version-packages` locally, review the result, and commit it under a verified human identity.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Release readiness passed: no pending changesets remain.");
