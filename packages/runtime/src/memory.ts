import type { RAttributes, RBinding, RPromise, RValue } from "./values.js";

/** Browser-owned memory represented in GNU R's two reporting cell families. */
export interface RuntimeMemoryCensus {
  readonly nodeCells: number;
  readonly vectorCells: number;
}

const RUNTIME_OBJECT_TYPES = new Set([
  "builtin",
  "character",
  "closure",
  "complex",
  "dots",
  "double",
  "environment",
  "expression",
  "formula",
  "integer",
  "language",
  "list",
  "logical",
  "null",
  "pairlist",
  "promise",
  "raw",
  "symbol",
]);

/**
 * Count the reachable NativR value graph without consulting or pretending to control the host heap.
 * A node cell is one runtime object or binding/attribute link. Vector cells are eight-byte units of
 * owned payload storage, matching the unit used by gc() rather than JavaScript engine heap bytes.
 */
export function censusRuntimeMemory(
  roots: readonly unknown[],
  checkpoint: () => void,
): RuntimeMemoryCensus {
  const seen = new WeakSet<object>();
  let nodeCells = 0;
  let vectorBytes = 0;
  let visits = 0;

  const accountVisit = (): void => {
    visits += 1;
    if (visits % 64 === 1) checkpoint();
  };

  const textBytes = (value: string): number => {
    const Encoder = (
      globalThis as unknown as {
        readonly TextEncoder: new () => { readonly encode: (input: string) => Uint8Array };
      }
    ).TextEncoder;
    return new Encoder().encode(value).byteLength;
  };

  const visitAttributes = (attributes: RAttributes): void => {
    for (const [name, value] of attributes) {
      nodeCells += 1;
      vectorBytes += 8 + textBytes(name);
      visitValue(value);
    }
  };

  const visitPromise = (promise: RPromise): void => {
    if (seen.has(promise)) return;
    accountVisit();
    seen.add(promise);
    nodeCells += 1;
    visitValue(promise.environment);
    if (promise.value !== undefined) visitValue(promise.value);
  };

  const visitBinding = (binding: RBinding): void => {
    if (binding.type === "promise") visitPromise(binding);
    else visitValue(binding);
  };

  const visitValue = (value: RValue): void => {
    if (seen.has(value)) return;
    accountVisit();
    seen.add(value);
    nodeCells += 1;

    switch (value.type) {
      case "null":
      case "builtin":
      case "language":
        return;
      case "logical":
      case "integer":
      case "double":
        vectorBytes += value.values.byteLength + (value.missing?.byteLength ?? 0);
        visitAttributes(value.attributes);
        return;
      case "raw":
        vectorBytes += value.values.byteLength;
        visitAttributes(value.attributes);
        return;
      case "complex":
        vectorBytes +=
          value.real.byteLength + value.imaginary.byteLength + (value.missing?.byteLength ?? 0);
        visitAttributes(value.attributes);
        return;
      case "character":
        vectorBytes +=
          value.length * 8 +
          value.byteValues.reduce((total, bytes) => total + bytes.byteLength, 0) +
          (value.missing?.byteLength ?? 0);
        visitAttributes(value.attributes);
        return;
      case "list":
      case "pairlist":
        vectorBytes += value.length * 8 + (value.missing?.byteLength ?? 0);
        for (const entry of value.values) visitValue(entry);
        visitAttributes(value.attributes);
        return;
      case "environment":
        if (value.parent !== null) visitValue(value.parent);
        for (const [name, binding] of value.bindings) {
          nodeCells += 1;
          vectorBytes += 8 + textBytes(name);
          visitBinding(binding);
        }
        return;
      case "closure":
        visitValue(value.environment);
        return;
      case "formula":
        vectorBytes +=
          (value.response === undefined ? 0 : textBytes(value.response)) +
          value.terms.reduce((total, term) => total + 8 + textBytes(term), 0) +
          value.variables.reduce((total, variable) => total + 8 + textBytes(variable), 0);
        if (value.environment !== null) visitValue(value.environment);
        return;
      case "symbol":
        vectorBytes += textBytes(value.name);
        return;
      case "expression":
        vectorBytes += value.values.length * 8;
        return;
      case "dots":
        vectorBytes += value.arguments.length * 8;
        for (const argument of value.arguments) visitPromise(argument.promise);
        return;
    }
  };

  const visitUnknown = (value: unknown): void => {
    if (typeof value !== "object" || value === null || ArrayBuffer.isView(value)) return;
    if (seen.has(value)) return;
    accountVisit();
    if ("type" in value && typeof value.type === "string" && RUNTIME_OBJECT_TYPES.has(value.type)) {
      if (value.type === "promise") visitPromise(value as RPromise);
      else visitValue(value as RValue);
      return;
    }
    seen.add(value);
    if (value instanceof Map || value instanceof Set) {
      for (const entry of value.values()) visitUnknown(entry);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visitUnknown(entry);
      return;
    }
    for (const entry of Object.values(value)) visitUnknown(entry);
  };

  for (const root of roots) visitUnknown(root);
  return Object.freeze({ nodeCells, vectorCells: Math.ceil(vectorBytes / 8) });
}
