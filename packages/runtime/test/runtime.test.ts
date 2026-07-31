import type { AstNode } from "@nativr/ast";
import { describe, expect, it } from "vitest";

import {
  EvaluationContext,
  REvaluationError,
  RResourceLimitError,
  createEnvironment,
  createPromise,
  complexVector,
  deparseAst,
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

  it("validates parallel complex storage", () => {
    expect(() => complexVector([1, 2], [3])).toThrow(/must match/u);
    expect(complexVector([1], [2], [1])).toMatchObject({
      type: "complex",
      real: new Float64Array([1]),
      imaginary: new Float64Array([2]),
      missing: new Uint8Array([1]),
    });
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

  it("captures selected output streams with nesting and independent size bounds", () => {
    const context = new EvaluationContext(
      { maxSteps: 100, maxCallDepth: 10, maxVectorLength: 100, maxOutputBytes: 10 },
      { cancelled: false },
    );
    context.beginOutputCapture(["stdout"]);
    context.writeOutput({ stream: "stdout", text: "outer" });
    context.beginOutputCapture(["message"]);
    context.writeOutput({ stream: "stdout", text: "more" });
    context.writeOutput({ stream: "message", text: "note" });
    expect(context.endOutputCapture()).toEqual([{ stream: "message", text: "note" }]);
    expect(context.endOutputCapture()).toEqual([
      { stream: "stdout", text: "outer" },
      { stream: "stdout", text: "more" },
    ]);
    expect(context.output).toEqual([]);
    context.beginOutputCapture(["stdout"]);
    expect(() => context.writeOutput({ stream: "stdout", text: "12345678901" })).toThrow(
      RResourceLimitError,
    );
    expect(context.endOutputCapture()).toEqual([]);
  });

  it("deparses every normalized language form without parser implementation details", () => {
    const identifier = (name: string): AstNode => ({ kind: "Identifier", name, span });
    const number = (value: number): AstNode => ({ kind: "DoubleLiteral", value, span });
    const argument = (value: AstNode, name?: string) => ({
      ...(name === undefined ? {} : { name }),
      value,
      span,
    });
    const subset: AstNode = {
      kind: "SubsetExpression",
      operator: "[",
      target: identifier("x"),
      arguments: [argument(number(1))],
      span,
    };
    const call: AstNode = {
      kind: "CallExpression",
      callee: identifier("f"),
      arguments: [argument(number(1)), argument(identifier("x"), "value")],
      span,
    };
    const cases: readonly (readonly [AstNode, string])[] = [
      [{ kind: "Program", body: [number(1), identifier("x")], span }, "1\nx"],
      [{ kind: "Block", body: [number(1), identifier("x")], span }, "{ 1; x }"],
      [identifier("alpha"), "alpha"],
      [number(Number.NaN), "NaN"],
      [number(Number.POSITIVE_INFINITY), "Inf"],
      [number(Number.NEGATIVE_INFINITY), "-Inf"],
      [number(-0), "0"],
      [{ kind: "ComplexLiteral", imaginary: -2, span }, "-2i"],
      [{ kind: "IntegerLiteral", value: 3, span }, "3L"],
      [{ kind: "StringLiteral", value: "a\nb", span }, '"a\\nb"'],
      [{ kind: "LogicalLiteral", value: true, span }, "TRUE"],
      [{ kind: "LogicalLiteral", value: false, span }, "FALSE"],
      [{ kind: "NullLiteral", span }, "NULL"],
      [{ kind: "MissingLiteral", declaredType: "logical", span }, "NA"],
      [{ kind: "MissingLiteral", declaredType: "double", span }, "NA_double_"],
      [{ kind: "UnaryExpression", operator: "-", operand: number(1), span }, "-(1)"],
      [
        {
          kind: "BinaryExpression",
          operator: "+",
          left: number(1),
          right: identifier("x"),
          span,
        },
        "(1 + x)",
      ],
      [
        {
          kind: "AssignmentExpression",
          operator: "<-",
          target: identifier("x") as Extract<AstNode, { kind: "Identifier" }>,
          value: number(1),
          span,
        },
        "(x <- 1)",
      ],
      [
        {
          kind: "ReplacementExpression",
          operator: "<-",
          target: subset,
          value: number(2),
          span,
        },
        "(x[1] <- 2)",
      ],
      [call, "f(1, value = x)"],
      [
        {
          kind: "FunctionExpression",
          parameters: [
            { name: "x", span },
            { name: "y", defaultValue: number(2), span },
          ],
          body: identifier("x"),
          span,
        },
        "function(x, y = 2) x",
      ],
      [
        {
          kind: "IfExpression",
          condition: identifier("ok"),
          consequence: number(1),
          span,
        },
        "if (ok) 1",
      ],
      [
        {
          kind: "IfExpression",
          condition: identifier("ok"),
          consequence: number(1),
          alternative: number(2),
          span,
        },
        "if (ok) 1 else 2",
      ],
      [
        {
          kind: "ForExpression",
          variable: identifier("i") as Extract<AstNode, { kind: "Identifier" }>,
          sequence: identifier("x"),
          body: identifier("i"),
          span,
        },
        "for (i in x) i",
      ],
      [
        {
          kind: "WhileExpression",
          condition: identifier("ok"),
          body: identifier("x"),
          span,
        },
        "while (ok) x",
      ],
      [{ kind: "RepeatExpression", body: identifier("x"), span }, "repeat x"],
      [{ kind: "BreakExpression", span }, "break"],
      [{ kind: "NextExpression", span }, "next"],
      [{ kind: "ReturnExpression", span }, "return()"],
      [{ kind: "ReturnExpression", value: number(1), span }, "return(1)"],
      [subset, "x[1]"],
      [
        {
          kind: "SubsetExpression",
          operator: "[[",
          target: identifier("x"),
          arguments: [argument(number(1))],
          span,
        },
        "x[[1]]",
      ],
      [
        {
          kind: "SubsetExpression",
          operator: "$",
          target: identifier("x"),
          arguments: [argument(identifier("member"))],
          span,
        },
        "x$member",
      ],
      [
        {
          kind: "SubsetExpression",
          operator: "@",
          target: identifier("x"),
          arguments: [],
          span,
        },
        "x@",
      ],
      [
        {
          kind: "NamespaceExpression",
          operator: ":::",
          namespace: identifier("base"),
          member: identifier("mean"),
          span,
        },
        "base:::mean",
      ],
      [{ kind: "FormulaExpression", right: identifier("x"), span }, "~x"],
      [
        {
          kind: "FormulaExpression",
          left: identifier("y"),
          right: identifier("x"),
          span,
        },
        "y ~ x",
      ],
      [
        {
          kind: "PipeExpression",
          operator: "|>",
          left: identifier("x"),
          right: call,
          span,
        },
        "(x |> f(1, value = x))",
      ],
      [{ kind: "UnsupportedExpression", feature: "missing argument", span }, ""],
      [{ kind: "UnsupportedExpression", feature: "future syntax", span }, "<future syntax>"],
    ];

    for (const [node, expected] of cases) {
      expect(deparseAst(node)).toBe(expected);
    }
  });
});
