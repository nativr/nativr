import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "ast", include: ["packages/ast/test/**/*.test.ts"] },
});
