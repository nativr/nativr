import { expect, it } from "vitest";
import {
  embeddedValueAst,
  integerVector,
  RResourceLimitError,
  withAttribute,
} from "../src/index.js";
import type { RValue } from "../src/index.js";

it("bounds recursive attribute display before exhausting the host stack", () => {
  let value: RValue = integerVector([1]);
  for (let depth = 0; depth < 600; depth += 1)
    value = withAttribute(integerVector([1]), "nested", value);
  expect(() => embeddedValueAst(value)).toThrow(RResourceLimitError);
});

it("honors a work budget while converting a wide embedded value", () => {
  const value = integerVector(Array.from({ length: 1000 }, (_, index) => index * 2));
  let remaining = 20;
  expect(() =>
    embeddedValueAst(value, () => {
      if (--remaining === 0) throw new Error("work exhausted");
    }),
  ).toThrow("work exhausted");
  expect(value.length).toBe(1000);
});
