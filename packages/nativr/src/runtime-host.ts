import {
  baseBuiltinBindings,
  baseBuiltins,
  BOX_OPTIMIZATION_BACKEND_STATE_KEY,
  ENVIRONMENT_VARIABLES_STATE_KEY,
  EXECUTABLE_PATHS_STATE_KEY,
  initializeBaseEnvironment,
  jsReferenceOperators,
  preloadBaseRuntimeAssets,
  SYMMETRIC_EIGEN_BACKEND_STATE_KEY,
} from "@nativr/base";
import type { BoxOptimizationBackend } from "@nativr/base";
import { createParser } from "@nativr/parser";
import type { NativRParser, ParserAssets } from "@nativr/parser";
import { DEFAULT_RUNTIME_LIMITS, Evaluator, RParseError } from "@nativr/runtime";
import type {
  DetailedEvaluationResult,
  RSystemCommandRequest,
  RSystemCommandResult,
  RNativeModuleDefinition,
  RSocketRequest,
  RSocketResult,
  RUrlRequest,
  RUrlResult,
  RuntimeLimits,
  RValue,
} from "@nativr/runtime";
import type { ProgramNode } from "@nativr/ast";

import { CAPABILITIES } from "./capabilities.js";
import { snapshotToValue, valueToSnapshot } from "./conversion.js";
import { compilePureRPackages } from "./pure-r-package.js";
import type {
  CapabilityManifest,
  PublicNativeCallRequest,
  PublicNativeCallResult,
  PureRPackageBundle,
  RValueSnapshot,
} from "@nativr/protocol";

/** Shared semantic host used unchanged by inline and Worker execution modes. */
export class RuntimeHost {
  readonly #parser: NativRParser;
  readonly #evaluator: Evaluator;

  private constructor(parser: NativRParser, evaluator: Evaluator) {
    this.#parser = parser;
    this.#evaluator = evaluator;
  }

  /** Initialize the parser assets and one independent evaluator. */
  public static async create(
    assets: ParserAssets,
    sessionProcessId: number | undefined,
    limits?: Partial<RuntimeLimits>,
    packages: readonly PureRPackageBundle[] = [],
    environmentVariables: Readonly<Record<string, string>> = {},
    executablePaths: Readonly<Record<string, string>> = {},
    nativeModules: readonly RNativeModuleDefinition[] = [],
    systemCommand?: (
      request: RSystemCommandRequest,
    ) => Promise<RSystemCommandResult> | RSystemCommandResult,
    nativeCall?: (
      request: PublicNativeCallRequest,
    ) => Promise<PublicNativeCallResult> | PublicNativeCallResult,
    readline?: (prompt: string) => Promise<string> | string,
    urlRequest?: (request: RUrlRequest) => Promise<RUrlResult> | RUrlResult,
    socketRequest?: (request: RSocketRequest) => Promise<RSocketResult> | RSocketResult,
  ): Promise<RuntimeHost> {
    // Core package definitions contain browser-owned data/resources but no evaluator behavior.
    // Load that one-way support module beside parser and renderer startup so optional data does not
    // force semantic modules to import a second copy of the Worker entry.
    const [parser, , corePackages] = await Promise.all([
      createParser(assets),
      preloadBaseRuntimeAssets(),
      import("@nativr/base/core-packages"),
    ]);
    try {
      const effectiveLimits = {
        ...DEFAULT_RUNTIME_LIMITS,
        ...limits,
        maxAllocatedElements:
          limits?.maxAllocatedElements ??
          (limits?.maxVectorLength === undefined
            ? DEFAULT_RUNTIME_LIMITS.maxAllocatedElements
            : limits.maxVectorLength * 10),
      };
      const { createLapackDsyevrBackend } = await import("./lapack-dsyevr.js");
      const symmetricEigenBackend = await createLapackDsyevrBackend();
      const boxOptimizationBackend = createLazyLbfgsbBackend();
      const packageDefinitions = compilePureRPackages(
        packages,
        (source) => parseProgram(parser, source),
        effectiveLimits,
      );
      const evaluator = new Evaluator(jsReferenceOperators, baseBuiltins, {
        limits: effectiveLimits,
        ...(sessionProcessId === undefined ? {} : { sessionProcessId }),
        parseSource: (source, maxExpressions) => parseProgram(parser, source, maxExpressions),
        packages: packageDefinitions,
        staticPackages: corePackages.corePackageDefinitions,
        builtinBindings: baseBuiltinBindings,
        runtimeTextResources: corePackages.coreRuntimeTextResources,
        nativeModules,
        ...(systemCommand === undefined ? {} : { systemCommand }),
        ...(nativeCall === undefined
          ? {}
          : {
              nativeCall: async (request) => {
                const result = await nativeCall({
                  module: request.module,
                  routine: request.routine,
                  arguments: request.arguments.map(valueToSnapshot),
                });
                return snapshotToValue(result.value, (source) => parseProgram(parser, source));
              },
            }),
        ...(readline === undefined ? {} : { readline }),
        ...(urlRequest === undefined ? {} : { urlRequest }),
        ...(socketRequest === undefined ? {} : { socketRequest }),
        initializeBuiltinState: (state) => {
          state.set(ENVIRONMENT_VARIABLES_STATE_KEY, new Map(Object.entries(environmentVariables)));
          state.set(EXECUTABLE_PATHS_STATE_KEY, new Map(Object.entries(executablePaths)));
          state.set(SYMMETRIC_EIGEN_BACKEND_STATE_KEY, symmetricEigenBackend);
          state.set(BOX_OPTIMIZATION_BACKEND_STATE_KEY, boxOptimizationBackend);
        },
        initializeBaseEnvironment,
      });
      await evaluator.initialize();
      return new RuntimeHost(parser, evaluator);
    } catch (error) {
      parser.dispose();
      throw error;
    }
  }

  public async eval(code: string): Promise<DetailedEvaluationResult> {
    return this.#evaluator.evaluate(parseProgram(this.#parser, code));
  }

  public assign(name: string, snapshot: RValueSnapshot): Promise<void> {
    return this.#evaluator.assign(
      name,
      snapshotToValue(snapshot, (source) => parseProgram(this.#parser, source)),
    );
  }

  public get(name: string): Promise<RValue> {
    return this.#evaluator.get(name);
  }

  public call(name: string, values: readonly RValueSnapshot[]): Promise<RValue> {
    return this.#evaluator.call(
      name,
      values.map((value) => snapshotToValue(value, (source) => parseProgram(this.#parser, source))),
    );
  }

  public capabilities(): CapabilityManifest {
    return CAPABILITIES;
  }

  public reset(): Promise<void> {
    return this.#evaluator.reset();
  }

  public interrupt(): void {
    this.#evaluator.interrupt();
  }

  public async dispose(): Promise<void> {
    try {
      await this.#evaluator.dispose();
    } finally {
      this.#parser.dispose();
    }
  }
}

function createLazyLbfgsbBackend(): BoxOptimizationBackend {
  let backend: Promise<BoxOptimizationBackend> | undefined;
  return {
    implementation: "lbfgsb-2.1-wasm",
    async minimize(initial, lower, upper, evaluate, options) {
      const loaded = await (backend ??= import("./lbfgsb.js").then(({ createLbfgsbBackend }) =>
        createLbfgsbBackend(),
      ));
      return loaded.minimize(initial, lower, upper, evaluate, options);
    },
  };
}

function parseProgram(parser: NativRParser, source: string, maxExpressions?: number): ProgramNode {
  if (maxExpressions === 0) return parser.parse("").ast;

  const parsed = parser.parse(source);
  const diagnostics = parsed.diagnostics.filter((item) => item.severity === "error");
  const firstDiagnostic = diagnostics.sort(
    (left, right) => (left.span?.start.offset ?? 0) - (right.span?.start.offset ?? 0),
  )[0];
  if (firstDiagnostic !== undefined) {
    const selected = maxExpressions === undefined ? [] : parsed.ast.body.slice(0, maxExpressions);
    const selectedEnd = selected.at(-1)?.span.end.offset;
    const diagnosticStart = firstDiagnostic.span?.start.offset;
    const canStopBeforeError =
      maxExpressions !== undefined &&
      maxExpressions > 0 &&
      selected.length === maxExpressions &&
      selectedEnd !== undefined &&
      diagnosticStart !== undefined &&
      selectedEnd <= diagnosticStart;
    if (!canStopBeforeError) {
      throw new RParseError(firstDiagnostic.code, firstDiagnostic.message, {
        ...(firstDiagnostic.span === undefined ? {} : { span: firstDiagnostic.span }),
        details: { hint: firstDiagnostic.hint ?? "" },
      });
    }
  }

  if (maxExpressions === undefined || parsed.ast.body.length <= maxExpressions) {
    return parsed.ast;
  }
  return {
    ...parsed.ast,
    body: Object.freeze(parsed.ast.body.slice(0, maxExpressions)),
  };
}
