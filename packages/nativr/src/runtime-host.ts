import { baseBuiltins, jsReferenceOperators } from "@nativr/base";
import { createParser } from "@nativr/parser";
import type { NativRParser, ParserAssets } from "@nativr/parser";
import { Evaluator, RParseError } from "@nativr/runtime";
import type { DetailedEvaluationResult, RuntimeLimits, RValue } from "@nativr/runtime";

import { CAPABILITIES } from "./capabilities.js";
import { snapshotToValue } from "./conversion.js";
import type { CapabilityManifest, RValueSnapshot } from "@nativr/protocol";

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
    limits?: Partial<RuntimeLimits>,
  ): Promise<RuntimeHost> {
    const parser = await createParser(assets);
    const evaluator = new Evaluator(jsReferenceOperators, baseBuiltins, {
      ...(limits === undefined ? {} : { limits }),
    });
    return new RuntimeHost(parser, evaluator);
  }

  public async eval(code: string): Promise<DetailedEvaluationResult> {
    const parsed = this.#parser.parse(code);
    const diagnostic = parsed.diagnostics.find((item) => item.severity === "error");
    if (diagnostic !== undefined) {
      throw new RParseError(diagnostic.code, diagnostic.message, {
        ...(diagnostic.span === undefined ? {} : { span: diagnostic.span }),
        details: { hint: diagnostic.hint ?? "" },
      });
    }
    return this.#evaluator.evaluate(parsed.ast);
  }

  public assign(name: string, snapshot: RValueSnapshot): void {
    this.#evaluator.assign(name, snapshotToValue(snapshot));
  }

  public get(name: string): Promise<RValue> {
    return this.#evaluator.get(name);
  }

  public call(name: string, values: readonly RValueSnapshot[]): Promise<RValue> {
    return this.#evaluator.call(name, values.map(snapshotToValue));
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
