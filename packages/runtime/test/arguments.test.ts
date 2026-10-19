import { expect, it } from "vitest";
import {
  createEnvironment,
  createMissingPromise,
  EvaluationContext,
  DEFAULT_RUNTIME_LIMITS,
  matchArguments,
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
