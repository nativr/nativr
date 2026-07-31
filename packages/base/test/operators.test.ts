import {
  EvaluationContext,
  characterVector,
  complexVector,
  doubleVector,
  integerVector,
  logicalVector,
} from "@nativr/runtime";
import { describe, expect, it } from "vitest";

import { jsReferenceOperators, recycledLength } from "../src/index.js";

function context(): EvaluationContext {
  return new EvaluationContext(
    {
      maxSteps: 1_000,
      maxCallDepth: 10,
      maxVectorLength: 1_000,
      maxOutputBytes: 1_000,
    },
    { cancelled: false },
  );
}

describe("JavaScript reference vector operators", () => {
  it("centralizes non-multiple recycling and emits exactly one warning", () => {
    const state = context();
    expect(recycledLength(state, 3, 2)).toBe(3);
    expect(state.warnings).toEqual([
      {
        code: "NRW1001",
        message: "Longer object length is not a multiple of shorter object length.",
      },
    ]);
  });

  it("recycles a scalar without mutating inputs", () => {
    const left = doubleVector([1, 2, 3]);
    const right = doubleVector([10]);
    const leftBefore = new Float64Array(left.values);
    const output = jsReferenceOperators.binary(context(), "+", left, right);
    expect(output).toMatchObject({ type: "double", values: new Float64Array([11, 12, 13]) });
    expect(left.values).toEqual(leftBefore);
  });

  it("propagates explicit missing masks independently from NaN", () => {
    const output = jsReferenceOperators.binary(
      context(),
      "+",
      doubleVector([0, Number.NaN], [1, 0]),
      integerVector([1]),
    );
    expect(output).toMatchObject({
      type: "double",
      missing: new Uint8Array([1, 0]),
      values: new Float64Array([0, Number.NaN]),
    });
  });

  it("constructs ascending, descending, and fractional colon sequences", () => {
    expect(
      jsReferenceOperators.binary(context(), ":", doubleVector([1]), doubleVector([3])),
    ).toMatchObject({
      type: "integer",
      values: new Int32Array([1, 2, 3]),
    });
    expect(
      jsReferenceOperators.binary(context(), ":", integerVector([3]), integerVector([1])),
    ).toMatchObject({
      type: "integer",
      values: new Int32Array([3, 2, 1]),
    });
    expect(
      jsReferenceOperators.binary(context(), ":", doubleVector([1.5]), doubleVector([3.5])),
    ).toMatchObject({
      type: "double",
      values: new Float64Array([1.5, 2.5, 3.5]),
    });
  });

  it("compares recycled numeric and character vectors with missing propagation", () => {
    expect(
      jsReferenceOperators.binary(
        context(),
        "<=",
        doubleVector([1, 3, 0], [0, 0, 1]),
        integerVector([2]),
      ),
    ).toMatchObject({
      type: "logical",
      values: new Uint8Array([1, 0, 0]),
      missing: new Uint8Array([0, 0, 1]),
    });
    expect(
      jsReferenceOperators.binary(
        context(),
        ">",
        characterVector(["beta", "alpha"]),
        characterVector(["alpha"]),
      ),
    ).toMatchObject({
      type: "logical",
      values: new Uint8Array([1, 0]),
    });
    expect(
      jsReferenceOperators.binary(context(), "==", integerVector([1]), characterVector(["1"])),
    ).toMatchObject({ type: "logical", values: new Uint8Array([1]) });
  });

  it("implements three-valued vector logic and treats NaN as unknown", () => {
    expect(
      jsReferenceOperators.binary(
        context(),
        "&",
        logicalVector([0, 1, 0], [0, 0, 1]),
        logicalVector([1, 1, 0]),
      ),
    ).toMatchObject({
      type: "logical",
      values: new Uint8Array([0, 1, 0]),
    });
    expect(
      jsReferenceOperators.binary(
        context(),
        "|",
        doubleVector([Number.NaN, Number.NaN]),
        logicalVector([1, 0]),
      ),
    ).toMatchObject({
      type: "logical",
      values: new Uint8Array([1, 0]),
      missing: new Uint8Array([0, 1]),
    });
    expect(jsReferenceOperators.unary(context(), "!", doubleVector([0, Number.NaN]))).toMatchObject(
      {
        type: "logical",
        values: new Uint8Array([1, 0]),
        missing: new Uint8Array([0, 1]),
      },
    );
  });

  it("implements complex arithmetic, equality, logic, and invalid ordering", () => {
    expect(
      jsReferenceOperators.binary(
        context(),
        "/",
        complexVector([1], [2]),
        complexVector([3], [-4]),
      ),
    ).toMatchObject({
      type: "complex",
      real: new Float64Array([-0.2]),
      imaginary: new Float64Array([0.4]),
    });
    expect(
      jsReferenceOperators.binary(context(), "^", complexVector([0], [1]), integerVector([2])),
    ).toMatchObject({
      type: "complex",
      real: new Float64Array([-1]),
    });
    expect(
      jsReferenceOperators.binary(
        context(),
        "==",
        complexVector([1, 1], [2, 3]),
        complexVector([1], [2]),
      ),
    ).toMatchObject({ type: "logical", values: new Uint8Array([1, 0]) });
    expect(
      jsReferenceOperators.binary(
        context(),
        "&",
        complexVector([0, 1], [0, 0]),
        logicalVector([1]),
      ),
    ).toMatchObject({ type: "logical", values: new Uint8Array([0, 1]) });
    expect(jsReferenceOperators.unary(context(), "-", complexVector([1], [-2]))).toMatchObject({
      type: "complex",
      real: new Float64Array([-1]),
      imaginary: new Float64Array([2]),
    });
    expect(() =>
      jsReferenceOperators.binary(context(), "<", complexVector([1], [0]), complexVector([2], [0])),
    ).toThrow(/complex/u);
    expect(() =>
      jsReferenceOperators.binary(context(), "%%", complexVector([1], [1]), integerVector([2])),
    ).toThrow(/Complex operation/u);
  });
});
