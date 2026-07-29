import type { SourceSpan } from "@nativr/ast";

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

/** A value failed a documented type or shape requirement. */
export class RTypeMismatchError extends NativRError {}

/** Valid R syntax is outside the current compatibility subset. */
export class RUnsupportedFeatureError extends NativRError {}

/** An evaluation exceeded a configured resource limit. */
export class RResourceLimitError extends NativRError {}

/** A public session or internal runtime has already been disposed. */
export class RRuntimeDisposedError extends NativRError {}
