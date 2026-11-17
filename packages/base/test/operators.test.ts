import {
  DEFAULT_RUNTIME_LIMITS,
  EvaluationContext,
  characterVector,
  complexVector,
  doubleVector,
  integerVector,
  logicalVector,
  R_NULL,
} from "@nativr/runtime";
import { describe, expect, it } from "vitest";

import { jsReferenceOperators, recycledLength } from "../src/index.js";

function context(): EvaluationContext {
  return new EvaluationContext(
    {
      ...DEFAULT_RUNTIME_LIMITS,
      maxSteps: 1_000,
      maxCallDepth: 10,
      maxVectorLength: 1_000,
      maxOutputBytes: 1_000,
    },
    { cancelled: false },
  );
}

describe("JavaScript reference vector operators", () => {
  it("matches observed real cubic and quartic rounding without changing other powers", () => {
    const x = doubleVector([0.1741, 0.3, 0.0641, -0.1741, 1.123456789]);
    const expectations = [
      [3, [0.005277112021, 0.027, 0.00026337472100000008, -0.005277112021, 1.4179767796223608]],
      [
        4,
        [
          0.00091874520285609997, 0.0080999999999999996, 1.6882319616100007e-5,
          0.00091874520285609997, 1.5930356397110981,
        ],
      ],
      [
        5,
        [
          0.00015995353981724703, 0.0024299999999999994, 1.0821566873920103e-6,
          -0.00015995353981724703, 1.7897067045523911,
        ],
      ],
      [
        -3,
        [
          189.49758807858362, 37.037037037037038, 3796.8716063680226, -189.49758807858362,
          0.70523016622763213,
        ],
      ],
    ] as const;
    for (const [exponent, expected] of expectations) {
      expect(
        jsReferenceOperators.binary(context(), "^", x, doubleVector([exponent])),
      ).toMatchObject({
        type: "double",
        values: new Float64Array(expected),
      });
    }
    expect(
      jsReferenceOperators.binary(
        context(),
        "^",
        doubleVector([-0, Infinity, -Infinity, Number.NaN]),
        integerVector([3]),
      ),
    ).toMatchObject({
      type: "double",
      values: new Float64Array([-0, Infinity, -Infinity, Number.NaN]),
    });
  });

  it("centralizes non-multiple recycling and emits exactly one warning", () => {
    const state = context();
    expect(recycledLength(state, 3, 2)).toBe(3);
    expect(state.warnings).toEqual([
      {
        code: "NRW1001",
        message: "longer object length is not a multiple of shorter object length",
        classes: ["simpleWarning", "warning", "condition"],
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

  it("coerces NULL to a zero-length vector for binary arithmetic and logic", () => {
    expect(jsReferenceOperators.binary(context(), "+", R_NULL, integerVector([1]))).toMatchObject({
      type: "integer",
      length: 0,
    });
    expect(jsReferenceOperators.binary(context(), "/", R_NULL, integerVector([1]))).toMatchObject({
      type: "double",
      length: 0,
    });
    expect(
      jsReferenceOperators.binary(context(), "+", R_NULL, complexVector([1], [2])),
    ).toMatchObject({
      type: "complex",
      length: 0,
    });
    expect(jsReferenceOperators.binary(context(), "&", logicalVector([1]), R_NULL)).toMatchObject({
      type: "logical",
      length: 0,
    });
    expect(() => jsReferenceOperators.unary(context(), "+", R_NULL)).toThrow(/numeric operands/u);
    expect(() =>
      jsReferenceOperators.binary(context(), "+", R_NULL, characterVector(["x"])),
    ).toThrow(/numeric operands/u);
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

  it("checks large colon kernels in bounded chunks without disabling the step guard", () => {
    const limits = {
      maxSteps: 3,
      maxCallDepth: 10,
      maxVectorLength: 10_000,
      maxOutputBytes: 1_000,
    };
    const state = new EvaluationContext(limits, { cancelled: false });
    const output = jsReferenceOperators.binary(
      state,
      ":",
      integerVector([1]),
      integerVector([10_000]),
    );
    expect(output).toMatchObject({
      type: "integer",
      length: 10_000,
    });
    expect(output.type === "integer" ? [output.values[0], output.values[9_999]] : []).toEqual([
      1, 10_000,
    ]);
    expect(state.steps).toBe(3);

    const constrained = new EvaluationContext({ ...limits, maxSteps: 2 }, { cancelled: false });
    expect(() =>
      jsReferenceOperators.binary(constrained, ":", integerVector([1]), integerVector([10_000])),
    ).toThrow(/Evaluation step limit exceeded/u);
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

  it("keeps complex integer powers exact at a negative real branch cut", () => {
    const epsilon = Number.EPSILON;
    const squared = jsReferenceOperators.binary(
      context(),
      "^",
      complexVector([-1, -1, 0.5], [0, epsilon, epsilon]),
      integerVector([2]),
    );
    expect(squared.type).toBe("complex");
    if (squared.type !== "complex") return;
    expect(squared.imaginary[0]).toBe(0);
    expect((squared.imaginary[1] ?? 0) / epsilon).toBe(-2);
    expect((squared.imaginary[2] ?? 0) / epsilon).toBe(1);

    const squaredWithDoubleExponent = jsReferenceOperators.binary(
      context(),
      "^",
      complexVector([-1, 0], [epsilon, 0]),
      doubleVector([2.0]),
    );
    expect(squaredWithDoubleExponent.type).toBe("complex");
    if (squaredWithDoubleExponent.type !== "complex") return;
    expect((squaredWithDoubleExponent.imaginary[0] ?? 0) / epsilon).toBe(-2);
    expect(squaredWithDoubleExponent.real[1]).toBe(0);
    expect(squaredWithDoubleExponent.imaginary[1]).toBe(0);

    const fractional = jsReferenceOperators.binary(
      context(),
      "^",
      complexVector([-1], [0]),
      doubleVector([0.5]),
    );
    expect(fractional).toMatchObject({ type: "complex" });
    if (fractional.type !== "complex") return;
    expect(fractional.imaginary[0]).toBeCloseTo(1);

    const complexExponent = jsReferenceOperators.binary(
      context(),
      "^",
      complexVector([1], [1]),
      complexVector([1], [1]),
    );
    expect(complexExponent).toMatchObject({ type: "complex" });
    if (complexExponent.type !== "complex") return;
    expect(complexExponent.real[0]).toBeCloseTo(0.273957253830121);
    expect(complexExponent.imaginary[0]).toBeCloseTo(0.583700758758615);
  });
});
