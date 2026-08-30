import { minify } from "terser";
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
    plugins: () => [cspSafeTreeSitter(), compactWorkerOutput()],
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

function compactWorkerOutput() {
  const nameCache = {};
  return {
    name: "nativr-compact-worker-output",
    enforce: "post" as const,
    async renderChunk(code: string, chunk: { readonly fileName: string }) {
      const result = await minify(code, {
        ecma: 2022,
        module: true,
        // Worker entry and lazy Worker chunks share internal property contracts. A common cache
        // keeps their reviewed property mappings identical regardless of chunk boundaries.
        nameCache,
        // R call signatures are represented by NativR value metadata, never JavaScript
        // Function.length. Removing unused JavaScript parameters therefore reduces the Worker
        // payload without changing observable R formals or callback argument matching.
        compress: {
          passes: 10,
          keep_fargs: false,
          unsafe_arrows: true,
        },
        // These methods belong exclusively to NativR's internal evaluator/context contracts. They
        // never cross the Worker protocol or public API boundary, and no internal caller addresses
        // them through a string key. Restrict property mangling to this reviewed closed set so the
        // large number of resource-accounting and dispatch calls do not consume public payload.
        mangle: {
          toplevel: true,
          properties: {
            regex:
              /^(?:absoluteTolerance|allocate|allowCategoricalResponse|alternative|assignBinding|attachSearchEnvironment|attributes|automaticRowNames|baseEnvironment|binaryFiles|bindings|boundary|callbacks|callee|callerFormalDefault|channelCoordinates|checkpoint|coefficientMissing|coefficients|collectGarbage|columnNames|compatibilityLevel|configureOnExit|connections|conjugateGradientType|consequence|context|contraction|contrastSpecifications|converged|currentArgumentCount|currentCall|currentEnvironment|dataEnvironment|defaultValue|definition|derivativeSteps|design|detachSearchEnvironment|deviance|devianceResiduals|directories|dispatchS3|dispatchS3IfPresent|dots|effects|emptyEnvironment|engine|environmentName|epsilon|evaluateDetailed|evaluateEval|evaluateScoped|evaluateSource|expansion|expression|factorLevels|fitted|fixedDispersion|force|forceDetailed|formals|frame|functionScale|globalEnvironment|hasMissing|hasSocketCapability|implementation|installedPackageDescription|installedPackageNames|installedPackageVersion|invoke|invokeDetailed|invokeLazy|isGlobalEnvironment|isInteractive|isNamespaceLoaded|iterationLimit|iterations|lbfgsbMemory|lbfgsbProjectedGradientTolerance|lbfgsbReductionFactor|left|libraryPaths|linkfun|linkinv|loadPackage|loadedNamespaces|lockedBindings|matchBuiltinCall|matchCall|matched|matrix|maxit|memoryStatistics|metadata|muEta|namespaceBinding|namespaceEnvironment|namespaceExports|namespaceName|nextConnectionId|nextMethod|normalKind|normalSpare|object|omittedIndices|operand|operator|originalRows|package|packageFile|packageName|packageResourcePath|packageResourcePaths|parameterScale|parameters|parentFrame|pivot|positions|primitive|primitiveKind|promise|qraux|rank|reflection|registerEnvironmentFinalizer|registerS3Method|relativeTolerance|requireResponse|residuals|responseName|resultLength|resultVisibility|right|sampleKind|scaledValue|searchEnvironment|searchPath|secondDerivatives|seedEnvironment|seedValue|selectedIndices|sequence|sessionProcessId|setLibraryPaths|setResultVisibility|signalCondition|skippedRows|solved|state|systemCall|systemCalls|systemFrames|systemFunction|systemParents|target|temperature|temperatureIterations|terms|tolerance|trace|uniformKind|validEta|validMu|variable|variables|variance|visibility|workingDirectory|workingResiduals|workingWeights|xlevels)$/,
            keep_quoted: "strict",
          },
        },
        format: { comments: false },
        sourceMap: { filename: chunk.fileName, asObject: true },
      });
      if (result.code === undefined) throw new Error(`Unable to minify ${chunk.fileName}.`);
      return { code: result.code, map: result.map ?? null };
    },
  };
}

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
