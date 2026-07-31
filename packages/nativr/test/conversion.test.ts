import {
  NativRError,
  RTypeMismatchError,
  R_NULL,
  characterVector,
  complexVector,
  createEnvironment,
  doubleVector,
  integerVector,
  listValue,
  logicalVector,
  pairlistValue,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import { describe, expect, it } from "vitest";

import {
  NA,
  deserializeError,
  inputToSnapshot,
  isComplex,
  isExpression,
  isLanguage,
  isNA,
  isRaw,
  isSymbol,
  serializeError,
  snapshotToJs,
  snapshotToValue,
  snapshotTransferables,
  valueToSnapshot,
} from "../src/conversion.js";

describe("public value conversion boundary", () => {
  it("recognizes only the canonical NA shape", () => {
    expect(isNA(NA)).toBe(true);
    expect(isNA({ __nativr__: "NA" })).toBe(true);
    expect(isNA({ __nativr__: "other" })).toBe(false);
    expect(isNA(null)).toBe(false);
  });

  it("recognizes, encodes, and decodes complex scalar values", () => {
    const value = { __nativr__: "complex" as const, real: 2, imaginary: -3 };
    expect(isComplex(value)).toBe(true);
    const snapshot = inputToSnapshot(value);
    expect(snapshot).toMatchObject({
      type: "complex",
      real: new Float64Array([2]),
      imaginary: new Float64Array([-3]),
    });
    expect(snapshotToJs(snapshot)).toEqual(value);
    expect(
      inputToSnapshot([value, NA, { __nativr__: "complex", real: -1, imaginary: 4 }]),
    ).toMatchObject({
      type: "complex",
      real: new Float64Array([2, 0, -1]),
      imaginary: new Float64Array([-3, 0, 4]),
      missing: new Uint8Array([0, 1, 0]),
    });
    expectErrorCode(() => inputToSnapshot([value, 2] as never), "NRT3204");
  });

  it("recognizes, encodes, decodes, and transfers raw vectors", () => {
    const value = { __nativr__: "raw" as const, bytes: new Uint8Array([0, 1, 255]) };
    expect(isRaw(value)).toBe(true);
    const snapshot = inputToSnapshot(value);
    expect(snapshot).toMatchObject({ type: "raw", values: new Uint8Array([0, 1, 255]) });
    expect(snapshotToJs(snapshot)).toEqual(value);
    if (snapshot.type !== "raw") throw new Error("Expected a raw snapshot.");
    expect(snapshotTransferables(snapshot)).toEqual([snapshot.values.buffer]);
  });

  it("encodes scalar JavaScript inputs", () => {
    expect(inputToSnapshot(null)).toEqual({ version: 1, type: "null" });
    expect(inputToSnapshot(2)).toMatchObject({
      version: 1,
      type: "double",
      values: new Float64Array([2]),
    });
    expect(inputToSnapshot(true)).toMatchObject({
      version: 1,
      type: "logical",
      values: new Uint8Array([1]),
    });
    expect(inputToSnapshot("two")).toEqual({
      version: 1,
      type: "character",
      values: ["two"],
    });
    expect(inputToSnapshot(NA)).toMatchObject({
      type: "logical",
      missing: new Uint8Array([1]),
    });
  });

  it("encodes typed arrays without unintended buffer aliasing", () => {
    const doubles = new Float64Array([1, 2]);
    const copiedDoubles = inputToSnapshot(doubles);
    const preservedDoubles = inputToSnapshot(doubles, true);
    expect(copiedDoubles.type).toBe("double");
    expect(preservedDoubles.type).toBe("double");
    if (copiedDoubles.type !== "double" || preservedDoubles.type !== "double") {
      throw new Error("Float64Array inputs must produce double snapshots.");
    }
    expect(copiedDoubles.values).not.toBe(doubles);
    expect(preservedDoubles.values).toBe(doubles);
    expect(inputToSnapshot(new Float32Array([1.5]))).toMatchObject({
      type: "double",
      values: new Float64Array([1.5]),
    });
    expect(inputToSnapshot(new Int16Array([1, 2]))).toMatchObject({
      type: "integer",
      values: new Int32Array([1, 2]),
    });
    const integers = new Int32Array([3]);
    const preservedIntegers = inputToSnapshot(integers, true);
    expect(preservedIntegers.type).toBe("integer");
    if (preservedIntegers.type !== "integer") {
      throw new Error("Int32Array inputs must produce integer snapshots.");
    }
    expect(preservedIntegers.values).toBe(integers);
  });

  it("rejects out-of-range and heterogeneous JavaScript inputs", () => {
    expectErrorCode(() => inputToSnapshot(new Uint32Array([2_147_483_648])), "NRT3202");
    expectErrorCode(() => inputToSnapshot([1, "two"] as never), "NRT3204");
    expectErrorCode(() => inputToSnapshot({ value: 1 } as never), "NRT3203");
  });

  it("encodes homogeneous arrays and explicit missing masks", () => {
    expect(inputToSnapshot([1, NA, 3])).toMatchObject({
      type: "double",
      values: new Float64Array([1, 0, 3]),
      missing: new Uint8Array([0, 1, 0]),
    });
    expect(inputToSnapshot([true, NA])).toMatchObject({
      type: "logical",
      values: new Uint8Array([1, 0]),
      missing: new Uint8Array([0, 1]),
    });
    expect(inputToSnapshot(["one", NA])).toMatchObject({
      type: "character",
      values: ["one", ""],
      missing: new Uint8Array([0, 1]),
    });
    expect(inputToSnapshot([NA])).toMatchObject({ type: "logical" });
  });

  it("round-trips every transportable runtime value", () => {
    const values = [
      R_NULL,
      logicalVector([1, 0]),
      integerVector([1, 2]),
      doubleVector([1, Number.NaN], [0, 1]),
      complexVector([1, 2], [3, 4], [0, 1]),
      characterVector(["one", ""], [0, 1]),
      listValue([integerVector([1]), characterVector(["two"])]),
      pairlistValue([integerVector([1]), characterVector(["two"])], ["first", "second"]),
    ] as const;
    for (const value of values) {
      expect(valueToSnapshot(snapshotToValue(valueToSnapshot(value)))).toEqual(
        valueToSnapshot(value),
      );
    }
    expectErrorCode(() => valueToSnapshot(createEnvironment(null)), "NRT3201");
  });

  it("round-trips exact names on atomic vectors and lists", () => {
    const atomic = withNames(doubleVector([10, 20]), ["a", "b"]);
    const list = listValue([atomic, integerVector([3])], ["values", "count"]);
    const pairlist = pairlistValue([integerVector([1]), integerVector([2])], ["first", "second"]);
    expect(valueToSnapshot(atomic)).toMatchObject({ names: ["a", "b"] });
    expect(valueToSnapshot(list)).toMatchObject({ names: ["values", "count"] });
    expect(valueToSnapshot(pairlist)).toMatchObject({
      type: "pairlist",
      names: ["first", "second"],
    });
    expect(snapshotToJs(valueToSnapshot(pairlist))).toEqual([1, 2]);
    expect(valueToSnapshot(snapshotToValue(valueToSnapshot(list)))).toEqual(valueToSnapshot(list));
  });

  it("round-trips validated dimensions without changing friendly values", () => {
    const matrix = withDimensions(doubleVector([1, 2, 3, 4]), [2, 2]);
    const snapshot = valueToSnapshot(matrix);
    expect(snapshot).toMatchObject({ dim: [2, 2] });
    expect(valueToSnapshot(snapshotToValue(snapshot))).toEqual(snapshot);
    expect(snapshotToJs(snapshot)).toEqual([1, 2, 3, 4]);

    const pairlistMatrix = withDimensions(
      pairlistValue(
        [integerVector([1]), integerVector([2]), integerVector([3]), integerVector([4])],
        ["a", "b", "c", "d"],
      ),
      [2, 2],
    );
    const pairlistSnapshot = valueToSnapshot(pairlistMatrix);
    expect(pairlistSnapshot).toMatchObject({ type: "pairlist", dim: [2, 2] });
    expect(valueToSnapshot(snapshotToValue(pairlistSnapshot))).toEqual(pairlistSnapshot);
    expect(snapshotToJs(pairlistSnapshot)).toEqual([1, 2, 3, 4]);
  });

  it("round-trips normalized formulas without parser implementation details", () => {
    const formula = {
      type: "formula" as const,
      response: "y",
      terms: ["x", "z"],
      variables: ["y", "x", "z"],
      intercept: false,
      environment: null,
    };
    const snapshot = valueToSnapshot(formula);
    expect(snapshot).toEqual({
      version: 1,
      type: "formula",
      response: "y",
      terms: ["x", "z"],
      variables: ["y", "x", "z"],
      intercept: false,
    });
    expect(valueToSnapshot(snapshotToValue(snapshot))).toEqual(snapshot);
    expect(snapshotToJs(snapshot)).toEqual({
      __nativr__: "formula",
      response: "y",
      terms: ["x", "z"],
      variables: ["y", "x", "z"],
      intercept: false,
    });
    expect(snapshotTransferables(snapshot)).toEqual([]);
  });

  it("transports symbols and quoted language without exposing normalized AST nodes", () => {
    const symbol = { version: 1, type: "symbol" as const, name: "alpha" };
    const language = { version: 1, type: "language" as const, source: "(1 + alpha)" };
    const symbolValue = snapshotToJs(symbol);
    const languageValue = snapshotToJs(language);
    expect(symbolValue).toEqual({ __nativr__: "symbol", name: "alpha" });
    expect(languageValue).toEqual({ __nativr__: "language", source: "(1 + alpha)" });
    expect(isSymbol(symbolValue)).toBe(true);
    expect(isLanguage(languageValue)).toBe(true);
    expect(isSymbol(languageValue)).toBe(false);
    expect(isLanguage(symbolValue)).toBe(false);
    expect(inputToSnapshot(symbolValue)).toEqual(symbol);
    expect(inputToSnapshot(languageValue)).toEqual(language);
    expect(valueToSnapshot(snapshotToValue(symbol))).toEqual(symbol);
    expectErrorCode(() => snapshotToValue(language), "NRT3206");
    expect(snapshotTransferables(symbol)).toEqual([]);
    expect(snapshotTransferables(language)).toEqual([]);
  });

  it("transports expression vectors as immutable diagnostic source arrays", () => {
    const snapshot = {
      version: 1,
      type: "expression" as const,
      sources: ["x", "(1 + y)"],
    };
    const value = snapshotToJs(snapshot);
    expect(value).toEqual({
      __nativr__: "expression",
      sources: ["x", "(1 + y)"],
    });
    expect(isExpression(value)).toBe(true);
    expect(isExpression({ __nativr__: "expression", sources: ["x", 1] })).toBe(false);
    expect(inputToSnapshot(value)).toEqual(snapshot);
    expectErrorCode(() => snapshotToValue(snapshot), "NRT3206");
    expect(snapshotTransferables(snapshot)).toEqual([]);
  });

  it("decodes friendly scalar, vector, list, logical, and missing values", () => {
    expect(snapshotToJs({ version: 1, type: "null" })).toBeNull();
    expect(snapshotToJs({ version: 1, type: "logical", values: new Uint8Array([1, 0]) })).toEqual([
      true,
      false,
    ]);
    expect(snapshotToJs({ version: 1, type: "integer", values: new Int32Array([2]) })).toBe(2);
    expect(
      snapshotToJs({
        version: 1,
        type: "character",
        values: ["", "two"],
        missing: new Uint8Array([1, 0]),
      }),
    ).toEqual([NA, "two"]);
    expect(
      snapshotToJs({
        version: 1,
        type: "list",
        values: [
          { version: 1, type: "double", values: new Float64Array([1]) },
          { version: 1, type: "null" },
        ],
      }),
    ).toEqual([1, null]);
  });

  it("collects the exact transferable buffers", () => {
    expect(snapshotTransferables({ version: 1, type: "null" })).toEqual([]);
    expect(snapshotTransferables({ version: 1, type: "character", values: ["one"] })).toEqual([]);
    const missing = new Uint8Array([1]);
    expect(
      snapshotTransferables({
        version: 1,
        type: "character",
        values: [""],
        missing,
      }),
    ).toEqual([missing.buffer]);
    const values = new Float64Array([1]);
    expect(
      snapshotTransferables({
        version: 1,
        type: "list",
        values: [{ version: 1, type: "double", values }],
      }),
    ).toEqual([values.buffer]);
    const real = new Float64Array([1]);
    const imaginary = new Float64Array([2]);
    expect(
      snapshotTransferables({
        version: 1,
        type: "complex",
        real,
        imaginary,
      }),
    ).toEqual([real.buffer, imaginary.buffer]);
  });

  it("serializes stable errors with opt-in debug stacks", () => {
    const internal = new RTypeMismatchError("NRT3999", "bad input", {
      details: { type: "object" },
    });
    const release = serializeError(internal, false);
    expect(release).toMatchObject({
      name: "RTypeMismatchError",
      code: "NRT3999",
      message: "bad input",
      details: { type: "object" },
    });
    expect(release).not.toHaveProperty("stack");
    expect(serializeError(internal, true)).toHaveProperty("stack");
    expect(serializeError("plain failure", false)).toMatchObject({
      name: "Error",
      code: "NRI9001",
      message: "plain failure",
    });
  });

  it("deserializes the public error contract", () => {
    const restored = deserializeError({
      name: "RemoteError",
      code: "NRE2999",
      message: "remote failure",
      details: { operation: "eval" },
      stack: "remote stack",
    });
    expect(restored).toBeInstanceOf(NativRError);
    expect(restored).toMatchObject({
      name: "RemoteError",
      code: "NRE2999",
      message: "remote failure",
      details: { operation: "eval" },
      stack: "remote stack",
    });
  });
});

function expectErrorCode(operation: () => unknown, code: string): void {
  try {
    operation();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected operation to throw ${code}.`);
}
