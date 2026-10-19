import type { CallExpressionNode, SourceSpan } from "@nativr/ast";
import type { RList } from "./values.js";

/** Optional structured fields accepted by NativR runtime errors. */
export interface NativRErrorOptions {
  readonly span?: SourceSpan;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

/** Base class for stable, serializable NativR failures. */
export class NativRError extends Error {
  public readonly code: string;
  public readonly span: SourceSpan | undefined;
  public readonly details: Readonly<Record<string, unknown>> | undefined;
  #conditionCall: CallExpressionNode | undefined;

  /** In-process condition metadata; never included in serializable diagnostic details. */
  public get conditionCall(): CallExpressionNode | undefined {
    return this.#conditionCall;
  }

  /** Keep the innermost known origin while an error unwinds through outer calls. */
  public recordConditionCall(call: CallExpressionNode): void {
    this.#conditionCall ??= call;
  }

  public constructor(code: string, message: string, options: NativRErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.span = options.span;
    this.details = options.details;
  }
}

/** A source parsing failure. */
export class RParseError extends NativRError {}

/** A general evaluation failure. */
export class REvaluationError extends NativRError {}

/** An R condition supplied to stop(), preserved for calling and exiting handlers. */
export class RSignalledConditionError extends REvaluationError {
  public constructor(
    message: string,
    public readonly condition: RList,
  ) {
    super("NRE2300", message);
  }
}

/** A value failed a documented type or shape requirement. */
export class RTypeMismatchError extends NativRError {}

/** Valid R syntax is outside the current compatibility subset. */
export class RUnsupportedFeatureError extends NativRError {}

/** An evaluation exceeded a configured resource limit. */
export class RResourceLimitError extends NativRError {}

/** A public session or internal runtime has already been disposed. */
export class RRuntimeDisposedError extends NativRError {}
