import type { AstNode } from "@nativr/ast";
import { describe, expect, it } from "vitest";

import {
  EvaluationContext,
  REvaluationError,
  RResourceLimitError,
  createEnvironment,
  createPromise,
  doubleVector,
  forcePromise,
  integerVector,
  lookupBinding,
  setBinding,
} from "../src/index.js";

const span = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 1, line: 1, column: 2 },
};
const expression: AstNode = { kind: "DoubleLiteral", value: 1, span };

describe("runtime foundations", () => {
  it("validates missing-mask invariants", () => {
    expect(() => doubleVector([1, 2], [1])).toThrow(/missing mask/u);
    expect(doubleVector([1, Number.NaN], [1, 0]).missing).toEqual(new Uint8Array([1, 0]));
  });

  it("resolves lexical environments with shadowing", () => {
    const parent = createEnvironment(null);
    const child = createEnvironment(parent);
    setBinding(parent, "x", integerVector([1]));
    setBinding(child, "x", integerVector([2]));
    expect(lookupBinding(child, "x")).toMatchObject({
      type: "integer",
      values: new Int32Array([2]),
    });
  });

  it("forces and memoizes a promise once", async () => {
    const environment = createEnvironment(null);
    const promise = createPromise(expression, environment);
    let calls = 0;
    const evaluate = () => {
      calls += 1;
      return Promise.resolve(doubleVector([42]));
    };
    await expect(forcePromise(promise, evaluate)).resolves.toMatchObject({ type: "double" });
    await expect(forcePromise(promise, evaluate)).resolves.toMatchObject({ type: "double" });
    expect(calls).toBe(1);
  });

  it("detects recursive promise forcing", async () => {
    const environment = createEnvironment(null);
    const promise = createPromise(expression, environment);
    await expect(
      forcePromise(promise, () => forcePromise(promise, () => Promise.resolve(doubleVector([1])))),
    ).rejects.toBeInstanceOf(REvaluationError);
  });

  it("enforces step and vector limits", () => {
    const context = new EvaluationContext(
      { maxSteps: 1, maxCallDepth: 1, maxVectorLength: 2, maxOutputBytes: 100 },
      { cancelled: false },
    );
    context.checkpoint();
    expect(() => context.checkpoint()).toThrow(RResourceLimitError);
    expect(() => context.allocate(3)).toThrow(RResourceLimitError);
  });
});
