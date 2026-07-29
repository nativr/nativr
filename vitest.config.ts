import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url)).replaceAll("\\", "/");

export default defineConfig({
  cacheDir: process.env.CI
    ? "node_modules/.vite/vitest"
    : path.join(os.tmpdir(), "nativr-vitest-cache"),
  resolve: {
    alias: {
      "@nativr/ast": `${root}packages/ast/src/index.ts`,
      "@nativr/parser": `${root}packages/parser/src/index.ts`,
      "@nativr/runtime": `${root}packages/runtime/src/index.ts`,
      "@nativr/base": `${root}packages/base/src/index.ts`,
      "@nativr/protocol": `${root}packages/protocol/src/index.ts`,
      "@nativr/nativr": `${root}packages/nativr/src/index.ts`,
    },
  },
  test: {
    name: "core",
    include: ["packages/*/test/**/*.test.ts"],
    exclude: ["tests/e2e/**", "**/node_modules/**", "**/dist/**"],
    pool: "threads",
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: process.env.CI ? "coverage" : path.join(os.tmpdir(), "nativr-coverage"),
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "packages/ast/src/index.ts",
        "packages/nativr/src/api.ts",
        "packages/nativr/src/worker-entry.ts",
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
});
