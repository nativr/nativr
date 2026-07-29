import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@nativr/ast": `${root}/packages/ast/src/index.ts` } },
  test: { name: "runtime", include: ["packages/runtime/test/**/*.test.ts"] },
});
