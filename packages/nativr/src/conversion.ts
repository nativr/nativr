import {
  NativRError,
  RTypeMismatchError,
  R_NULL,
  characterVector,
  doubleVector,
  integerVector,
  listValue,
  logicalVector,
} from "@nativr/runtime";
import type { RValue } from "@nativr/runtime";
import type { RValueSnapshot, SerializedNativRError } from "@nativr/protocol";

/** Stable JavaScript marker used for every R NA produced by the friendly API. */
export interface NativRNAValue {
  readonly __nativr__: "NA";
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

/** Natural JavaScript values accepted by assign() and call(). */
export type JsInputValue =
  | number
  | boolean
  | string
  | null
  | NativRNAValue
  | readonly (number | NativRNAValue)[]
  | readonly (boolean | NativRNAValue)[]
  | readonly (string | NativRNAValue)[]
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
  | readonly (number | boolean | string | NativRNAValue)[]
  | readonly JsValue[];

/** Encode one internal value as a structured-cloneable lossless snapshot. */
export function valueToSnapshot(value: RValue): RValueSnapshot {
  switch (value.type) {
    case "null":
      return { version: 1, type: "null" };
    case "logical":
      return withSnapshotMask(
        { version: 1, type: "logical", values: new Uint8Array(value.values) },
        value.missing,
      );
    case "integer":
      return withSnapshotMask(
        { version: 1, type: "integer", values: new Int32Array(value.values) },
        value.missing,
      );
    case "double":
      return withSnapshotMask(
        { version: 1, type: "double", values: new Float64Array(value.values) },
        value.missing,
      );
    case "character":
      return withSnapshotMask(
        { version: 1, type: "character", values: [...value.values] },
        value.missing,
      );
    case "list":
      return { version: 1, type: "list", values: value.values.map(valueToSnapshot) };
    case "builtin":
    case "closure":
    case "environment":
      throw new RTypeMismatchError(
        "NRT3201",
        `Values of type '${value.type}' cannot cross the public data boundary.`,
      );
  }
}

/** Reconstruct an internal value from a validated snapshot. */
export function snapshotToValue(snapshot: RValueSnapshot): RValue {
  switch (snapshot.type) {
    case "null":
      return R_NULL;
    case "logical":
      return logicalVector(snapshot.values, snapshot.missing);
    case "integer":
      return integerVector(snapshot.values, snapshot.missing);
    case "double":
      return doubleVector(snapshot.values, snapshot.missing);
    case "character":
      return characterVector(snapshot.values, snapshot.missing);
    case "list":
      return listValue(snapshot.values.map(snapshotToValue));
  }
}

/** Convert a lossless snapshot into the ergonomic public JavaScript representation. */
export function snapshotToJs(snapshot: RValueSnapshot): JsValue {
  if (snapshot.type === "null") return null;
  if (snapshot.type === "list") {
    return snapshot.values.map(snapshotToJs);
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
      return [];
    case "character":
      return snapshot.missing === undefined ? [] : [snapshot.missing.buffer];
    case "list":
      return snapshot.values.flatMap(snapshotTransferables);
    case "logical":
    case "integer":
    case "double":
      return [
        snapshot.values.buffer,
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
  value: readonly (number | boolean | string | NativRNAValue)[],
): RValueSnapshot {
  const nonMissing = value.filter((item) => !isNA(item));
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

function withSnapshotMask<T extends RValueSnapshot>(
  snapshot: T,
  missing: Uint8Array | undefined,
): T {
  if (missing !== undefined && missing.some((item) => item === 1)) {
    return { ...snapshot, missing: new Uint8Array(missing) };
  }
  return snapshot;
}
