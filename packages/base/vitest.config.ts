import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@nativr/ast": `${root}/packages/ast/src/index.ts`,
      "@nativr/runtime": `${root}/packages/runtime/src/index.ts`,
    },
  },
  test: { name: "base", include: ["packages/base/test/**/*.test.ts"] },
});
