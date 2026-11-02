import {
  baseBuiltins,
  ENVIRONMENT_VARIABLES_STATE_KEY,
  EXECUTABLE_PATHS_STATE_KEY,
  jsReferenceOperators,
} from "@nativr/base";
import { createParser } from "@nativr/parser";
import type { NativRParser, ParserAssets } from "@nativr/parser";
import { DEFAULT_RUNTIME_LIMITS, Evaluator, RParseError } from "@nativr/runtime";
import type {
  DetailedEvaluationResult,
  EvaluationOptions,
  RSystemCommandRequest,
  RSystemCommandResult,
  RNativeModuleDefinition,
  RSocketRequest,
  RSocketResult,
  RUrlRequest,
  RUrlResult,
  RuntimeLimits,
  RuntimeSystemPackageTextResource,
  RValue,
} from "@nativr/runtime";
import type { ProgramNode } from "@nativr/ast";

import { CAPABILITIES } from "./capabilities.js";
import { snapshotToValue, valueToSnapshot } from "./conversion.js";
import { createElementaryMath, loadElementaryModule } from "./elementary.js";
import type { ElementaryModule } from "./elementary.js";
import { compilePureRPackages } from "./pure-r-package.js";
import type {
  CapabilityManifest,
  PublicNativeCallRequest,
  PublicNativeCallResult,
  PureRPackageBundle,
  RValueSnapshot,
} from "@nativr/protocol";

/** Parser assets plus the optional correctly rounded elementary-function module (RFC-0007). */
export interface RuntimeHostAssets extends ParserAssets {
  readonly elementaryWasm?: string | URL;
}

/** Shared semantic host used unchanged by inline and Worker execution modes. */
export class RuntimeHost {
  readonly #parser: NativRParser;
  readonly #evaluator: Evaluator;
  /** This session's verified elementary-function instance, when its asset was configured. */
  public readonly elementary: ElementaryModule | undefined;

  private constructor(
    parser: NativRParser,
    evaluator: Evaluator,
    elementary: ElementaryModule | undefined,
  ) {
    this.#parser = parser;
    this.#evaluator = evaluator;
    this.elementary = elementary;
  }

  /** Initialize the parser assets, the elementary module, and one independent evaluator. */
  public static async create(
    assets: RuntimeHostAssets,
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
    systemPackageResources: readonly RuntimeSystemPackageTextResource[] = [],
  ): Promise<RuntimeHost> {
    // One instance per session, verified against its pinned digest before the parser starts.
    const elementary =
      assets.elementaryWasm === undefined
        ? undefined
        : await loadElementaryModule(assets.elementaryWasm);
    const parser = await createParser({
      treeSitterRuntimeWasm: assets.treeSitterRuntimeWasm,
      rGrammarWasm: assets.rGrammarWasm,
    });
    try {
      const effectiveLimits = { ...DEFAULT_RUNTIME_LIMITS, ...limits };
      const packageDefinitions = compilePureRPackages(
        packages,
        (source) => parseProgram(parser, source),
        effectiveLimits,
      );
      const evaluator = new Evaluator(jsReferenceOperators, baseBuiltins, {
        limits: effectiveLimits,
        // RFC-0007: correctly rounded elementary functions when this session loaded the module.
        ...(elementary === undefined ? {} : { elementaryMath: createElementaryMath(elementary) }),
        ...(sessionProcessId === undefined ? {} : { sessionProcessId }),
        parseSource: (source, maxExpressions) => parseProgram(parser, source, maxExpressions),
        parseSourceDetailed: (source, maxExpressions, work) =>
          parser.parseDetailed(source, maxExpressions, work),
        packages: packageDefinitions,
        systemPackageResources,
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
        },
      });
      return new RuntimeHost(parser, evaluator, elementary);
    } catch (error) {
      parser.dispose();
      throw error;
    }
  }

  public async eval(
    code: string,
    options: EvaluationOptions = {},
  ): Promise<DetailedEvaluationResult> {
    return this.#evaluator.evaluate(parseProgram(this.#parser, code), options);
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

  public reset(): void {
    this.#evaluator.reset();
  }

  public interrupt(): void {
    this.#evaluator.interrupt();
  }

  public dispose(): void {
    this.#evaluator.dispose();
    this.#parser.dispose();
  }
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
