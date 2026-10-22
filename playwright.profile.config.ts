import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import original from "./playwright.config.js";

// Run only after a serial build, with no other preview server or dist consumer.
if (process.env.NATIVR_E2E_SKIP_BUILD !== "1") {
  throw new Error("Profiling requires an existing serial build; set NATIVR_E2E_SKIP_BUILD=1.");
}
process.env.NATIVR_PROFILE_REQUIRED_EXAMPLES = "1";
if (!original.webServer || Array.isArray(original.webServer)) {
  throw new Error("Profiling requires the existing single preview server configuration.");
}
const inheritedRunId = process.env.NATIVR_REQUIRED_EXAMPLE_PROFILE_RUN;
const runId = inheritedRunId ?? `${Date.now()}-${process.pid}`;
if (!/^\d{13}-\d{1,10}$/u.test(runId)) throw new Error("Invalid profiling run identifier.");
process.env.NATIVR_REQUIRED_EXAMPLE_PROFILE_RUN = runId;
const artifacts = path.join(os.tmpdir(), "nativr-required-example-profile", runId);
if (inheritedRunId === undefined) console.log(`Required-example profiling artifacts: ${artifacts}`);

export default defineConfig({
  ...original,
  testMatch: "playground.spec.ts",
  grep: /runs the required Worker examples without evaluation network traffic$/u,
  workers: 1,
  retries: 0,
  outputDir: path.join(artifacts, "results"),
  use: { ...original.use, trace: "off", screenshot: "off", video: "off" },
  webServer: { ...original.webServer, reuseExistingServer: false },
  reporter: [["list"], ["json", { outputFile: path.join(artifacts, "report.json") }]],
});
