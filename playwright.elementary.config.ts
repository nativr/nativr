import os from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

// RFC-0007 cross-engine identity check for elementary.wasm. It launches Chromium, Firefox and
// WebKit itself inside one test, so it needs no web server and no NativR build.
const artifactRoot = process.env.CI ? undefined : path.join(os.tmpdir(), "nativr-playwright");

export default defineConfig({
  testDir: "./tests/elementary",
  outputDir:
    artifactRoot === undefined
      ? "test-results/elementary"
      : path.join(artifactRoot, "elementary-results"),
  fullyParallel: false,
  reporter: [["list"]],
});
