import {
  NativRError,
  RTypeMismatchError,
  R_NULL,
  characterVector,
  createEnvironment,
  doubleVector,
  integerVector,
  listValue,
  logicalVector,
} from "@nativr/runtime";
import { describe, expect, it } from "vitest";

import {
  NA,
  deserializeError,
  inputToSnapshot,
  isNA,
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
      characterVector(["one", ""], [0, 1]),
      listValue([integerVector([1]), characterVector(["two"])]),
    ] as const;
    for (const value of values) {
      expect(valueToSnapshot(snapshotToValue(valueToSnapshot(value)))).toEqual(
        valueToSnapshot(value),
      );
    }
    expectErrorCode(() => valueToSnapshot(createEnvironment(null)), "NRT3201");
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
