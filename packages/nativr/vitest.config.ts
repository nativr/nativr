import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@nativr/ast": `${root}/packages/ast/src/index.ts`,
      "@nativr/parser": `${root}/packages/parser/src/index.ts`,
      "@nativr/runtime": `${root}/packages/runtime/src/index.ts`,
      "@nativr/base": `${root}/packages/base/src/index.ts`,
      "@nativr/protocol": `${root}/packages/protocol/src/index.ts`,
    },
  },
  test: { name: "nativr", include: ["packages/nativr/test/**/*.test.ts"] },
});
