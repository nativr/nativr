import type { AstNode, CallExpressionNode, SourceSpan } from "@nativr/ast";
import type { RList, RValue } from "./values.js";

// Internal language origins include operator/control syntax and an explicit top-level NULL.
// Keep this outside the public error instance's serializable fields and existing direct-call API.
const conditionOrigins = new WeakMap<NativRError, AstNode | null>();
const conditionClasses = new WeakMap<NativRError, readonly string[]>();

export function errorConditionClasses(error: NativRError): readonly string[] {
  return conditionClasses.get(error) ?? ["simpleError", "error", "condition"];
}

export function recordErrorConditionClasses(error: NativRError, classes: readonly string[]): void {
  if (!conditionClasses.has(error)) conditionClasses.set(error, classes);
}

export function errorConditionCall(error: NativRError): AstNode | null | undefined {
  return conditionOrigins.get(error);
}

export function recordErrorConditionCall(error: NativRError, call: AstNode | null): void {
  if (!conditionOrigins.has(error)) conditionOrigins.set(error, call);
}

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

  /** In-process condition metadata; never included in serializable diagnostic details. */
  public get conditionCall(): CallExpressionNode | undefined {
    const call = errorConditionCall(this);
    return call?.kind === "CallExpression" ? call : undefined;
  }

  /** Keep the innermost known origin while an error unwinds through outer calls. */
  public recordConditionCall(call: CallExpressionNode): void {
    recordErrorConditionCall(this, call);
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

/** A catchable R condition raised with stop(condition), retaining its original S3 classes. */
export class RConditionError extends REvaluationError {
  public readonly condition: RValue;

  public constructor(
    code: string,
    message: string,
    condition: RValue,
    options: NativRErrorOptions = {},
  ) {
    super(code, message, options);
    this.condition = condition;
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
