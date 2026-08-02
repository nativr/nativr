import { baseBuiltins, ENVIRONMENT_VARIABLES_STATE_KEY, jsReferenceOperators } from "@nativr/base";
import { createParser } from "@nativr/parser";
import type { NativRParser, ParserAssets } from "@nativr/parser";
import { DEFAULT_RUNTIME_LIMITS, Evaluator, RParseError } from "@nativr/runtime";
import type {
  DetailedEvaluationResult,
  RSystemCommandRequest,
  RSystemCommandResult,
  RuntimeLimits,
  RValue,
} from "@nativr/runtime";
import type { ProgramNode } from "@nativr/ast";

import { CAPABILITIES } from "./capabilities.js";
import { snapshotToValue } from "./conversion.js";
import { compilePureRPackages } from "./pure-r-package.js";
import type { CapabilityManifest, PureRPackageBundle, RValueSnapshot } from "@nativr/protocol";

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
    systemCommand?: (
      request: RSystemCommandRequest,
    ) => Promise<RSystemCommandResult> | RSystemCommandResult,
    readline?: (prompt: string) => Promise<string> | string,
  ): Promise<RuntimeHost> {
    const parser = await createParser(assets);
    try {
      const effectiveLimits = { ...DEFAULT_RUNTIME_LIMITS, ...limits };
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
        ...(systemCommand === undefined ? {} : { systemCommand }),
        ...(readline === undefined ? {} : { readline }),
        initializeBuiltinState: (state) => {
          state.set(ENVIRONMENT_VARIABLES_STATE_KEY, new Map(Object.entries(environmentVariables)));
        },
      });
      return new RuntimeHost(parser, evaluator);
    } catch (error) {
      parser.dispose();
      throw error;
    }
  }

  public async eval(code: string): Promise<DetailedEvaluationResult> {
    return this.#evaluator.evaluate(parseProgram(this.#parser, code));
  }

  public assign(name: string, snapshot: RValueSnapshot): void {
    this.#evaluator.assign(
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
