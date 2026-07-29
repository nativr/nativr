import { EvaluationContext, doubleVector, integerVector } from "@nativr/runtime";
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
});
