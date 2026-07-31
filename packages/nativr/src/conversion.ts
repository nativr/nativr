import {
  NativRError,
  RTypeMismatchError,
  R_NULL,
  characterVector,
  complexVector,
  deparseAst,
  doubleVector,
  integerVector,
  listValue,
  logicalVector,
  pairlistValue,
  rawVector,
  vectorDimensions,
  vectorNames,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import type { RPairlist, RValue, RVector } from "@nativr/runtime";
import type { ProgramNode } from "@nativr/ast";
import type { RValueSnapshot, SerializedNativRError } from "@nativr/protocol";

/** Stable JavaScript marker used for every R NA produced by the friendly API. */
export interface NativRNAValue {
  readonly __nativr__: "NA";
}

/** Friendly immutable representation of one R complex scalar. */
export interface NativRComplexValue {
  readonly __nativr__: "complex";
  readonly real: number;
  readonly imaginary: number;
}

/** Friendly representation of one R raw vector. */
export interface NativRRawValue {
  readonly __nativr__: "raw";
  readonly bytes: Uint8Array;
}

/** Friendly, immutable representation of the supported normalized formula subset. */
export interface NativRFormulaValue {
  readonly __nativr__: "formula";
  readonly response?: string;
  readonly terms: readonly string[];
  readonly variables: readonly string[];
  readonly intercept: boolean;
}

/** Friendly immutable representation of an R symbol. */
export interface NativRSymbolValue {
  readonly __nativr__: "symbol";
  readonly name: string;
}

/** Friendly immutable representation of a quoted R language object. */
export interface NativRLanguageValue {
  readonly __nativr__: "language";
  readonly source: string;
}

/** Friendly immutable representation of an R expression vector. */
export interface NativRExpressionValue {
  readonly __nativr__: "expression";
  readonly sources: readonly string[];
}

/** Canonical public missing-value marker. */
export const NA: NativRNAValue = Object.freeze({ __nativr__: "NA" });

/** Test whether a JavaScript value is the NativR missing marker. */
export function isNA(value: unknown): value is NativRNAValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "__nativr__" in value &&
    (value as { readonly __nativr__?: unknown }).__nativr__ === "NA"
  );
}

/** Test whether a JavaScript value is the NativR complex scalar representation. */
export function isComplex(value: unknown): value is NativRComplexValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "__nativr__" in value &&
    (value as { readonly __nativr__?: unknown }).__nativr__ === "complex" &&
    "real" in value &&
    typeof value.real === "number" &&
    "imaginary" in value &&
    typeof value.imaginary === "number"
  );
}

/** Test whether a JavaScript value is the NativR raw-vector representation. */
export function isRaw(value: unknown): value is NativRRawValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "__nativr__" in value &&
    (value as { readonly __nativr__?: unknown }).__nativr__ === "raw" &&
    "bytes" in value &&
    value.bytes instanceof Uint8Array
  );
}

/** Test whether a JavaScript value is the public R symbol representation. */
export function isSymbol(value: unknown): value is NativRSymbolValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "__nativr__" in value &&
    value.__nativr__ === "symbol" &&
    "name" in value &&
    typeof value.name === "string"
  );
}

/** Test whether a JavaScript value is the public quoted-language representation. */
export function isLanguage(value: unknown): value is NativRLanguageValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "__nativr__" in value &&
    value.__nativr__ === "language" &&
    "source" in value &&
    typeof value.source === "string"
  );
}

/** Test whether a JavaScript value is the public R expression-vector representation. */
export function isExpression(value: unknown): value is NativRExpressionValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "__nativr__" in value &&
    value.__nativr__ === "expression" &&
    "sources" in value &&
    Array.isArray(value.sources) &&
    value.sources.every((item) => typeof item === "string")
  );
}

/** Natural JavaScript values accepted by assign() and call(). */
export type JsInputValue =
  | number
  | boolean
  | string
  | null
  | NativRNAValue
  | NativRComplexValue
  | NativRRawValue
  | NativRSymbolValue
  | NativRLanguageValue
  | NativRExpressionValue
  | readonly (number | NativRNAValue)[]
  | readonly (boolean | NativRNAValue)[]
  | readonly (string | NativRNAValue)[]
  | readonly (NativRComplexValue | NativRNAValue)[]
  | Float64Array
  | Float32Array
  | Int32Array
  | Int16Array
  | Int8Array
  | Uint32Array
  | Uint16Array
  | Uint8Array;

/** Friendly values returned by eval(), get(), and call(). */
export type JsValue =
  | number
  | boolean
  | string
  | null
  | NativRNAValue
  | NativRComplexValue
  | NativRRawValue
  | NativRFormulaValue
  | NativRSymbolValue
  | NativRLanguageValue
  | NativRExpressionValue
  | readonly (number | boolean | string | NativRNAValue | NativRComplexValue)[]
  | readonly JsValue[];

/** Encode one internal value as a structured-cloneable lossless snapshot. */
export function valueToSnapshot(value: RValue): RValueSnapshot {
  switch (value.type) {
    case "null":
      return { version: 1, type: "null" };
    case "logical":
      return withSnapshotDimensions(
        withSnapshotNames(
          withSnapshotMask(
            { version: 1, type: "logical", values: new Uint8Array(value.values) },
            value.missing,
          ),
          vectorNames(value),
        ),
        vectorDimensions(value),
      );
    case "integer":
      return withSnapshotDimensions(
        withSnapshotNames(
          withSnapshotMask(
            { version: 1, type: "integer", values: new Int32Array(value.values) },
            value.missing,
          ),
          vectorNames(value),
        ),
        vectorDimensions(value),
      );
    case "double":
      return withSnapshotDimensions(
        withSnapshotNames(
          withSnapshotMask(
            { version: 1, type: "double", values: new Float64Array(value.values) },
            value.missing,
          ),
          vectorNames(value),
        ),
        vectorDimensions(value),
      );
    case "complex":
      return withSnapshotDimensions(
        withSnapshotNames(
          withSnapshotMask(
            {
              version: 1,
              type: "complex",
              real: new Float64Array(value.real),
              imaginary: new Float64Array(value.imaginary),
            },
            value.missing,
          ),
          vectorNames(value),
        ),
        vectorDimensions(value),
      );
    case "raw":
      return withSnapshotDimensions(
        withSnapshotNames(
          { version: 1, type: "raw", values: new Uint8Array(value.values) },
          vectorNames(value),
        ),
        vectorDimensions(value),
      );
    case "character":
      return withSnapshotDimensions(
        withSnapshotNames(
          withSnapshotMask(
            { version: 1, type: "character", values: [...value.values] },
            value.missing,
          ),
          vectorNames(value),
        ),
        vectorDimensions(value),
      );
    case "list":
      return withSnapshotDimensions(
        withSnapshotNames(
          { version: 1, type: "list", values: value.values.map(valueToSnapshot) },
          vectorNames(value),
        ),
        vectorDimensions(value),
      );
    case "pairlist": {
      return withSnapshotDimensions(
        withSnapshotNames(
          {
            version: 1,
            type: "pairlist",
            values: value.values.map(valueToSnapshot),
          },
          vectorNames(value),
        ),
        vectorDimensions(value),
      );
    }
    case "formula":
      return {
        version: 1,
        type: "formula",
        ...(value.response === undefined ? {} : { response: value.response }),
        terms: [...value.terms],
        variables: [...value.variables],
        intercept: value.intercept,
      };
    case "symbol":
      return { version: 1, type: "symbol", name: value.name };
    case "language":
      return { version: 1, type: "language", source: deparseAst(value.expression) };
    case "expression":
      return {
        version: 1,
        type: "expression",
        sources: value.values.map(deparseAst),
      };
    case "builtin":
    case "closure":
    case "dots":
    case "environment":
      throw new RTypeMismatchError(
        "NRT3201",
        `Values of type '${value.type}' cannot cross the public data boundary.`,
      );
  }
}

/** Reconstruct an internal value from a validated snapshot. */
export function snapshotToValue(
  snapshot: RValueSnapshot,
  parseSource?: (source: string) => ProgramNode,
): RValue {
  switch (snapshot.type) {
    case "null":
      return R_NULL;
    case "logical":
      return withOptionalAttributes(
        logicalVector(snapshot.values, snapshot.missing),
        snapshot.names,
        snapshot.dim,
      );
    case "integer":
      return withOptionalAttributes(
        integerVector(snapshot.values, snapshot.missing),
        snapshot.names,
        snapshot.dim,
      );
    case "double":
      return withOptionalAttributes(
        doubleVector(snapshot.values, snapshot.missing),
        snapshot.names,
        snapshot.dim,
      );
    case "complex":
      return withOptionalAttributes(
        complexVector(snapshot.real, snapshot.imaginary, snapshot.missing),
        snapshot.names,
        snapshot.dim,
      );
    case "raw":
      return withOptionalAttributes(rawVector(snapshot.values), snapshot.names, snapshot.dim);
    case "character":
      return withOptionalAttributes(
        characterVector(snapshot.values, snapshot.missing),
        snapshot.names,
        snapshot.dim,
      );
    case "list":
      return withOptionalDimensions(
        listValue(
          snapshot.values.map((value) => snapshotToValue(value, parseSource)),
          snapshot.names,
        ),
        snapshot.dim,
      );
    case "pairlist":
      return withOptionalDimensions(
        pairlistValue(
          snapshot.values.map((value) => snapshotToValue(value, parseSource)),
          snapshot.names,
        ),
        snapshot.dim,
      );
    case "formula":
      return {
        type: "formula",
        ...(snapshot.response === undefined ? {} : { response: snapshot.response }),
        terms: [...snapshot.terms],
        variables: [...snapshot.variables],
        intercept: snapshot.intercept,
        environment: null,
      };
    case "symbol":
      return { type: "symbol", name: snapshot.name };
    case "language":
      return {
        type: "language",
        expression: parseSnapshotExpression(snapshot.source, parseSource),
      };
    case "expression":
      return {
        type: "expression",
        values: Object.freeze(
          snapshot.sources.map((source) => parseSnapshotExpression(source, parseSource)),
        ),
      };
  }
}

/** Convert a lossless snapshot into the ergonomic public JavaScript representation. */
export function snapshotToJs(snapshot: RValueSnapshot): JsValue {
  if (snapshot.type === "null") return null;
  if (snapshot.type === "list" || snapshot.type === "pairlist") {
    return snapshot.values.map(snapshotToJs);
  }
  if (snapshot.type === "formula") {
    return Object.freeze({
      __nativr__: "formula" as const,
      ...(snapshot.response === undefined ? {} : { response: snapshot.response }),
      terms: Object.freeze([...snapshot.terms]),
      variables: Object.freeze([...snapshot.variables]),
      intercept: snapshot.intercept,
    });
  }
  if (snapshot.type === "symbol") {
    return Object.freeze({ __nativr__: "symbol" as const, name: snapshot.name });
  }
  if (snapshot.type === "language") {
    return Object.freeze({ __nativr__: "language" as const, source: snapshot.source });
  }
  if (snapshot.type === "expression") {
    return Object.freeze({
      __nativr__: "expression" as const,
      sources: Object.freeze([...snapshot.sources]),
    });
  }
  if (snapshot.type === "complex") {
    const values: (NativRComplexValue | NativRNAValue)[] = [];
    for (let index = 0; index < snapshot.real.length; index += 1) {
      values.push(
        snapshot.missing?.[index] === 1
          ? NA
          : Object.freeze({
              __nativr__: "complex" as const,
              real: snapshot.real[index] ?? 0,
              imaginary: snapshot.imaginary[index] ?? 0,
            }),
      );
    }
    return values.length === 1 ? (values[0] ?? null) : values;
  }
  if (snapshot.type === "raw") {
    return Object.freeze({
      __nativr__: "raw" as const,
      bytes: new Uint8Array(snapshot.values),
    });
  }

  const values: (number | boolean | string | NativRNAValue)[] = [];
  for (let index = 0; index < snapshot.values.length; index += 1) {
    if (snapshot.missing?.[index] === 1) {
      values.push(NA);
    } else if (snapshot.type === "logical") {
      values.push(snapshot.values[index] === 1);
    } else {
      values.push(snapshot.values[index] ?? (snapshot.type === "character" ? "" : 0));
    }
  }
  return values.length === 1 ? (values[0] ?? null) : values;
}

/** Convert one JavaScript input into a lossless wire snapshot. */
export function inputToSnapshot(value: JsInputValue, preserveBuffer = false): RValueSnapshot {
  if (value === null) return { version: 1, type: "null" };
  if (isNA(value)) {
    return {
      version: 1,
      type: "logical",
      values: new Uint8Array([0]),
      missing: new Uint8Array([1]),
    };
  }
  if (isComplex(value)) {
    return {
      version: 1,
      type: "complex",
      real: new Float64Array([value.real]),
      imaginary: new Float64Array([value.imaginary]),
    };
  }
  if (isRaw(value)) {
    return {
      version: 1,
      type: "raw",
      values: new Uint8Array(value.bytes),
    };
  }
  if (isSymbol(value)) {
    return { version: 1, type: "symbol", name: value.name };
  }
  if (isLanguage(value)) {
    return { version: 1, type: "language", source: value.source };
  }
  if (isExpression(value)) {
    return { version: 1, type: "expression", sources: [...value.sources] };
  }
  if (typeof value === "number") {
    return { version: 1, type: "double", values: new Float64Array([value]) };
  }
  if (typeof value === "boolean") {
    return { version: 1, type: "logical", values: new Uint8Array([value ? 1 : 0]) };
  }
  if (typeof value === "string") {
    return { version: 1, type: "character", values: [value] };
  }
  if (value instanceof Float64Array) {
    return {
      version: 1,
      type: "double",
      values: preserveBuffer ? value : new Float64Array(value),
    };
  }
  if (value instanceof Float32Array) {
    return { version: 1, type: "double", values: Float64Array.from(value) };
  }
  if (
    value instanceof Int32Array ||
    value instanceof Int16Array ||
    value instanceof Int8Array ||
    value instanceof Uint16Array ||
    value instanceof Uint8Array
  ) {
    return {
      version: 1,
      type: "integer",
      values: preserveBuffer && value instanceof Int32Array ? value : Int32Array.from(value),
    };
  }
  if (value instanceof Uint32Array) {
    if (value.some((item) => item > 2_147_483_647)) {
      throw new RTypeMismatchError(
        "NRT3202",
        "Uint32Array contains values outside R integer range.",
      );
    }
    return { version: 1, type: "integer", values: Int32Array.from(value) };
  }
  if (Array.isArray(value)) {
    return arrayInputToSnapshot(value);
  }
  throw new RTypeMismatchError("NRT3203", "Unsupported JavaScript input value.");
}

/** Collect transferable buffers contained in one snapshot. */
export function snapshotTransferables(snapshot: RValueSnapshot): Transferable[] {
  switch (snapshot.type) {
    case "null":
    case "formula":
    case "symbol":
    case "language":
    case "expression":
      return [];
    case "character":
      return snapshot.missing === undefined ? [] : [snapshot.missing.buffer];
    case "list":
    case "pairlist":
      return snapshot.values.flatMap(snapshotTransferables);
    case "logical":
    case "integer":
    case "double":
      return [
        snapshot.values.buffer,
        ...(snapshot.missing === undefined ? [] : [snapshot.missing.buffer]),
      ];
    case "raw":
      return [snapshot.values.buffer];
    case "complex":
      return [
        snapshot.real.buffer,
        snapshot.imaginary.buffer,
        ...(snapshot.missing === undefined ? [] : [snapshot.missing.buffer]),
      ];
  }
}

/** Serialize an internal error while keeping debug stacks opt-in. */
export function serializeError(error: unknown, debug: boolean): SerializedNativRError {
  if (error instanceof NativRError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      ...(error.span === undefined ? {} : { span: error.span }),
      ...(error.details === undefined ? {} : { details: error.details }),
      ...(debug && error.stack !== undefined ? { stack: error.stack } : {}),
    };
  }
  const fallback = error instanceof Error ? error : new Error(String(error));
  return {
    name: fallback.name,
    code: "NRI9001",
    message: fallback.message,
    ...(debug && fallback.stack !== undefined ? { stack: fallback.stack } : {}),
  };
}

/** Reconstruct a stable public error from a Worker response. */
export function deserializeError(error: SerializedNativRError): NativRError {
  const value = new NativRError(error.code, error.message, {
    ...(error.span === undefined ? {} : { span: error.span }),
    ...(error.details === undefined ? {} : { details: error.details }),
  });
  value.name = error.name;
  if (error.stack !== undefined) value.stack = error.stack;
  return value;
}

function arrayInputToSnapshot(
  value: readonly (number | boolean | string | NativRNAValue | NativRComplexValue)[],
): RValueSnapshot {
  const nonMissing = value.filter((item) => !isNA(item));
  if (nonMissing.some(isComplex)) {
    if (!nonMissing.every(isComplex)) {
      throw new RTypeMismatchError("NRT3204", "JavaScript arrays must be homogeneous.");
    }
    const missing = Uint8Array.from(value, (item) => (isNA(item) ? 1 : 0));
    return withSnapshotMask(
      {
        version: 1,
        type: "complex",
        real: Float64Array.from(value, (item) => (isComplex(item) ? item.real : 0)),
        imaginary: Float64Array.from(value, (item) => (isComplex(item) ? item.imaginary : 0)),
      },
      missing,
    );
  }
  const kinds = new Set(nonMissing.map((item) => typeof item));
  if (
    kinds.size > 1 ||
    [...kinds].some((kind) => !["number", "boolean", "string"].includes(kind))
  ) {
    throw new RTypeMismatchError("NRT3204", "JavaScript arrays must be homogeneous.");
  }
  const kind = kinds.values().next().value as "number" | "boolean" | "string" | undefined;
  const missing = Uint8Array.from(value, (item) => (isNA(item) ? 1 : 0));
  if (kind === "string") {
    return withSnapshotMask(
      {
        version: 1,
        type: "character",
        values: value.map((item) => (typeof item === "string" ? item : "")),
      },
      missing,
    );
  }
  if (kind === "boolean" || kind === undefined) {
    return withSnapshotMask(
      {
        version: 1,
        type: "logical",
        values: Uint8Array.from(value, (item) => (item === true ? 1 : 0)),
      },
      missing,
    );
  }
  return withSnapshotMask(
    {
      version: 1,
      type: "double",
      values: Float64Array.from(value, (item) => (typeof item === "number" ? item : 0)),
    },
    missing,
  );
}

function parseSnapshotExpression(
  source: string,
  parseSource: ((source: string) => ProgramNode) | undefined,
) {
  if (parseSource === undefined) {
    throw new RTypeMismatchError(
      "NRT3206",
      "Quoted language and expression snapshots require a parser-enabled runtime host.",
    );
  }
  const program = parseSource(source);
  const expression = program.body[0];
  if (expression === undefined || program.body.length !== 1) {
    throw new RTypeMismatchError(
      "NRT3206",
      "Each quoted-language snapshot source must contain exactly one complete R expression.",
      { details: { expressionCount: program.body.length } },
    );
  }
  return expression;
}

function withSnapshotMask<T extends RValueSnapshot>(
  snapshot: T,
  missing: Uint8Array | undefined,
): T {
  if (missing !== undefined && missing.some((item) => item === 1)) {
    return { ...snapshot, missing: new Uint8Array(missing) };
  }
  return snapshot;
}

function withSnapshotNames<T extends RValueSnapshot>(
  snapshot: T,
  names: readonly string[] | undefined,
): T {
  return names === undefined ? snapshot : { ...snapshot, names: [...names] };
}

function withSnapshotDimensions<T extends RValueSnapshot>(
  snapshot: T,
  dimensions: readonly number[] | undefined,
): T {
  return dimensions === undefined ? snapshot : { ...snapshot, dim: [...dimensions] };
}

function withOptionalAttributes<T extends RVector>(
  value: T,
  names: readonly string[] | undefined,
  dimensions: readonly number[] | undefined,
): T {
  const named = names === undefined ? value : withNames(value, names);
  return withOptionalDimensions(named, dimensions);
}

function withOptionalDimensions<T extends RVector | RPairlist>(
  value: T,
  dimensions: readonly number[] | undefined,
): T {
  return dimensions === undefined ? value : withDimensions(value, dimensions);
}
