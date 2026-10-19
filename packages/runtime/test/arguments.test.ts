import { expect, it } from "vitest";
import {
  createEnvironment,
  createMissingPromise,
  EvaluationContext,
  DEFAULT_RUNTIME_LIMITS,
  matchArguments,
  matchArgumentsWithWarnings,
  partialMatchWarning,
  RResourceLimitError,
} from "../src/index.js";

it("bounds named matching and diagnostic traversal without forcing promises", () => {
  const environment = createEnvironment(null);
  const arguments_ = Array.from({ length: 50 }, (_, index) => ({
    name: `actual${index}`,
    promise: createMissingPromise(environment),
  }));
  const context = new EvaluationContext(
    { ...DEFAULT_RUNTIME_LIMITS, maxSteps: 20 },
    { cancelled: false },
  );
  expect(() =>
    matchArguments(arguments_, ["a", "b", "..."], { checkWork: () => context.checkpoint() }),
  ).toThrow(RResourceLimitError);
  expect(arguments_.every(({ promise }) => promise.state === "unforced")).toBe(true);
  const cancelled = new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: true });
  expect(() => matchArguments(arguments_, [], { checkWork: () => cancelled.checkpoint() })).toThrow(
    "interrupted",
  );
});

it("checks cancellation when a partial-match warning handler returns", async () => {
  const environment = createEnvironment(null);
  const arguments_ = ["al", "be"].map((name) => ({
    name,
    promise: createMissingPromise(environment),
  }));
  const cancellation = { cancelled: false };
  const context = new EvaluationContext(DEFAULT_RUNTIME_LIMITS, cancellation);
  const seen: string[] = [];
  await expect(
    matchArgumentsWithWarnings(
      arguments_,
      ["alpha", "beta"],
      ({ actual }) => {
        seen.push(actual);
        cancellation.cancelled = true;
        return Promise.resolve();
      },
      { checkWork: () => context.checkpoint() },
    ),
  ).rejects.toThrow("interrupted");
  expect(seen).toEqual(["al"]);
  expect(arguments_.every(({ promise }) => promise.state === "unforced")).toBe(true);
});

it("bounds partial warning call traversal", () => {
  const span = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } };
  const context = new EvaluationContext(
    { ...DEFAULT_RUNTIME_LIMITS, maxSteps: 20 },
    { cancelled: false },
  );
  expect(() =>
    partialMatchWarning(
      { actual: "al", formal: "alpha" },
      {
        type: "language",
        expression: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "f", span },
          span,
          arguments: Array.from({ length: 100 }, () => ({
            value: { kind: "Identifier", name: "owned", span },
            span,
          })),
        },
      },
      () => context.checkpoint(),
    ),
  ).toThrow(RResourceLimitError);
});
