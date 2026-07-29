import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [
    cspSafeTreeSitter(),
    dts({
      entryRoot: "src",
      rollupTypes: true,
      tsconfigPath: "tsconfig.json",
    }),
  ],
  worker: {
    format: "es",
    plugins: () => [cspSafeTreeSitter()],
  },
  build: {
    target: "es2022",
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});

function cspSafeTreeSitter() {
  return {
    name: "nativr-csp-safe-tree-sitter",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.replaceAll("\\", "/").endsWith("/web-tree-sitter/web-tree-sitter.js")) return;
      const patched = code
        .replace(
          `    } else if (globalThis.process?.versions.node) {
      const fs2 = await import("fs/promises");
      binary2 = await fs2.readFile(input);
    } else {`,
          "    } else {",
        )
        .replace(
          `  var ENVIRONMENT_IS_NODE = typeof process == "object" && process.versions?.node && process.type != "renderer";
  if (ENVIRONMENT_IS_NODE) {
    const { createRequire } = await import("module");
    var require = createRequire(import.meta.url);
  }`,
          `  var ENVIRONMENT_IS_NODE = false;
  var require;`,
        )
        .replace("  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {", "  } else {")
        .replace("  } else {\n  }\n  var out =", "  }\n  var out =")
        .replace(
          "var func = `(${args}) => { ${body} };`;\n          ASM_CONSTS[start] = eval(func);",
          'throw new Error("NativR CSP guard: EM_ASM grammar modules are unsupported.");',
        )
        .replace(
          "var func = `(${jsArgs}) => ${body};`;\n          moduleExports[name] = eval(func);",
          'throw new Error("NativR CSP guard: EM_JS grammar modules are unsupported.");',
        );
      if (
        patched === code ||
        patched.includes('import("fs/promises")') ||
        patched.includes('import("module")') ||
        patched.includes("ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER") ||
        patched.includes("eval(func)")
      ) {
        throw new Error("Unable to apply the reviewed web-tree-sitter CSP patch.");
      }
      return { code: patched, map: null };
    },
  };
}
