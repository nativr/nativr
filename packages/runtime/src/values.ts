import type { AstNode, FunctionParameter } from "@nativr/ast";

import { RTypeMismatchError } from "./errors.js";

/** Attribute storage prepared for names, dimensions, class, and later extensions. */
export type RAttributes = ReadonlyMap<string, RValue>;

/** Shared fields for immutable atomic vectors. */
export interface RVectorBase {
  readonly attributes: RAttributes;
  readonly length: number;
  readonly missing?: Uint8Array;
}

/** A logical vector with 0/1 values and an independent missing mask. */
export interface RLogicalVector extends RVectorBase {
  readonly type: "logical";
  readonly values: Uint8Array;
  readonly missing?: Uint8Array;
}

/** A signed 32-bit integer vector. */
export interface RIntegerVector extends RVectorBase {
  readonly type: "integer";
  readonly values: Int32Array;
  readonly missing?: Uint8Array;
}

/** A double vector that keeps ordinary NaN distinct from R NA. */
export interface RDoubleVector extends RVectorBase {
  readonly type: "double";
  readonly values: Float64Array;
  readonly missing?: Uint8Array;
}

/** A character vector with an independent missing mask. */
export interface RCharacterVector extends RVectorBase {
  readonly type: "character";
  readonly values: readonly string[];
  readonly missing?: Uint8Array;
}

/** The singleton R NULL value. */
export interface RNull {
  readonly type: "null";
}

/** A generic R list used internally and by future language features. */
export interface RList extends RVectorBase {
  readonly type: "list";
  readonly values: readonly RValue[];
}

/** A lexical environment with mutable bindings and an immutable parent link. */
export interface REnvironment {
  readonly type: "environment";
  readonly id: number;
  readonly parent: REnvironment | null;
  readonly bindings: Map<string, RBinding>;
}

/** A user-defined closure. */
export interface RClosure {
  readonly type: "closure";
  readonly parameters: readonly FunctionParameter[];
  readonly body: AstNode;
  readonly environment: REnvironment;
}

/** A lazily evaluated, memoized argument. */
export interface RPromise {
  readonly type: "promise";
  readonly expression: AstNode | null;
  readonly environment: REnvironment;
  state: "unforced" | "forcing" | "forced";
  value: RValue | undefined;
}

/** One call argument passed to a registered builtin. */
export interface BuiltinCallArgument {
  readonly name?: string;
  readonly promise: RPromise;
}

/** Metadata used for capability reporting and compatibility review. */
export interface BuiltinMetadata {
  readonly package: string;
  readonly name: string;
  readonly compatibilityLevel: "api" | "shape" | "numeric" | "behavioral";
  readonly referenceVersion?: string;
  readonly supportedArguments: readonly string[];
  readonly unsupportedBehavior?: readonly string[];
}

/** Builtin execution kind. */
export type BuiltinKind = "regular" | "special" | "primitive";

/** Operations made available to a builtin for one call. */
export interface BuiltinInvocation {
  readonly arguments: readonly BuiltinCallArgument[];
  readonly context: OperatorContext;
  force(promise: RPromise): Promise<RValue>;
}

/** One independently registered base-language builtin. */
export interface BuiltinDefinition {
  readonly package: string;
  readonly name: string;
  readonly kind: BuiltinKind;
  readonly metadata: BuiltinMetadata;
  implementation(invocation: BuiltinInvocation): RValue | Promise<RValue>;
}

/** A builtin installed as a first-class runtime value. */
export interface RBuiltin {
  readonly type: "builtin";
  readonly definition: BuiltinDefinition;
}

/** A cancellation flag shared by evaluator and reference operators. */
export interface CancellationToken {
  readonly cancelled: boolean;
}

/** Configurable safety limits for one runtime session. */
export interface RuntimeLimits {
  readonly maxSteps: number;
  readonly maxCallDepth: number;
  readonly maxVectorLength: number;
  readonly maxOutputBytes: number;
}

/** A structured warning collected in evaluation order. */
export interface RWarning {
  readonly code: string;
  readonly message: string;
  readonly span?: SourceSpan;
  readonly call?: string;
}

/** Context exposed to deterministic computational operators. */
export interface OperatorContext {
  readonly limits: RuntimeLimits;
  readonly cancellation: CancellationToken;
  warn(warning: RWarning): void;
  checkpoint(cost?: number): void;
  allocate(elements: number): void;
}

/** Replaceable arithmetic seam implemented by the JavaScript reference backend. */
export interface RuntimeOperators {
  unary(context: OperatorContext, operator: string, value: RValue): RValue;
  binary(context: OperatorContext, operator: string, left: RValue, right: RValue): RValue;
}

/** All ordinary runtime values. Promises appear only in bindings and call frames. */
export type RValue =
  | RNull
  | RLogicalVector
  | RIntegerVector
  | RDoubleVector
  | RCharacterVector
  | RList
  | REnvironment
  | RClosure
  | RBuiltin;

/** An environment binding is either an ordinary value or a lazy promise. */
export type RBinding = RValue | RPromise;

/** The R NULL singleton. */
export const R_NULL: RNull = Object.freeze({ type: "null" });

const EMPTY_ATTRIBUTES: RAttributes = new Map();

/** Construct and validate an immutable logical vector. */
export function logicalVector(
  values: ArrayLike<number | boolean>,
  missing?: ArrayLike<number>,
): RLogicalVector {
  const storage = Uint8Array.from(values, (value) => (value === true || value === 1 ? 1 : 0));
  return withMask({ type: "logical", values: storage, length: storage.length }, missing);
}

/** Construct and validate an immutable integer vector. */
export function integerVector(
  values: ArrayLike<number>,
  missing?: ArrayLike<number>,
): RIntegerVector {
  const storage = Int32Array.from(values);
  return withMask({ type: "integer", values: storage, length: storage.length }, missing);
}

/** Construct and validate an immutable double vector. */
export function doubleVector(
  values: ArrayLike<number>,
  missing?: ArrayLike<number>,
): RDoubleVector {
  const storage = Float64Array.from(values);
  return withMask({ type: "double", values: storage, length: storage.length }, missing);
}

/** Construct and validate an immutable character vector. */
export function characterVector(
  values: readonly string[],
  missing?: ArrayLike<number>,
): RCharacterVector {
  const storage = Object.freeze([...values]);
  return withMask({ type: "character", values: storage, length: storage.length }, missing);
}

/** Construct an immutable R list. */
export function listValue(values: readonly RValue[]): RList {
  return {
    type: "list",
    values: Object.freeze([...values]),
    length: values.length,
    attributes: EMPTY_ATTRIBUTES,
  };
}

/** Return true when a vector element is an explicit R missing value. */
export function isMissing(value: RVectorBase, index: number): boolean {
  return value.missing?.[index] === 1;
}

/** Return true for atomic vector values. */
export function isAtomic(
  value: RValue,
): value is RLogicalVector | RIntegerVector | RDoubleVector | RCharacterVector {
  return (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "character"
  );
}

/** Create a typed length-one missing vector. */
export function missingValue(
  type: "logical" | "integer" | "double" | "character" = "logical",
): RLogicalVector | RIntegerVector | RDoubleVector | RCharacterVector {
  switch (type) {
    case "logical":
      return logicalVector([0], [1]);
    case "integer":
      return integerVector([0], [1]);
    case "double":
      return doubleVector([0], [1]);
    case "character":
      return characterVector([""], [1]);
  }
}

function withMask<
  T extends
    | Omit<RLogicalVector, "attributes" | "missing">
    | Omit<RIntegerVector, "attributes" | "missing">
    | Omit<RDoubleVector, "attributes" | "missing">
    | Omit<RCharacterVector, "attributes" | "missing">,
>(
  vector: T,
  missing: ArrayLike<number> | undefined,
): T & { readonly attributes: RAttributes; readonly missing?: Uint8Array } {
  if (missing === undefined) {
    return { ...vector, attributes: EMPTY_ATTRIBUTES };
  }
  const mask = Uint8Array.from(missing, (value) => (value === 0 ? 0 : 1));
  if (mask.length !== vector.length) {
    throw new RTypeMismatchError("NRT3001", "A missing mask must match vector length.", {
      details: { vectorLength: vector.length, maskLength: mask.length },
    });
  }
  return { ...vector, missing: mask, attributes: EMPTY_ATTRIBUTES };
}
import type { SourceSpan } from "@nativr/ast";
