import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const artifactRoot = process.env.CI ? undefined : path.join(os.tmpdir(), "nativr-playwright");

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: artifactRoot === undefined ? "test-results" : path.join(artifactRoot, "test-results"),
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder:
          artifactRoot === undefined ? "playwright-report" : path.join(artifactRoot, "report"),
      },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "node scripts/serve-e2e.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
