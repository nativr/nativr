import { expect, it } from "vitest";
import {
  characterVector,
  dataFrameRowCount,
  integerVector,
  isDataFrame,
  listValue,
  withAttribute,
} from "../src/index.js";

it("recognizes explicit integer row names and counts their rows", () => {
  const frame = withAttribute(
    withAttribute(
      listValue([integerVector([17, 29])], ["value"]),
      "row.names",
      integerVector([7, 1]),
    ),
    "class",
    characterVector(["data.frame"]),
  );
  expect(isDataFrame(frame)).toBe(true);
  expect(dataFrameRowCount(frame)).toBe(2);
});

it("recognizes integer row names on a zero-row data frame", () => {
  const frame = withAttribute(
    withAttribute(listValue([integerVector([])], ["value"]), "row.names", integerVector([])),
    "class",
    characterVector(["data.frame"]),
  );
  expect(isDataFrame(frame)).toBe(true);
  expect(dataFrameRowCount(frame)).toBe(0);
});

it("counts compact automatic integer row names", () => {
  const frame = withAttribute(
    withAttribute(
      listValue([integerVector([1, 2, 3, 4])], ["value"]),
      "row.names",
      integerVector([0, -4], [1, 0]),
    ),
    "class",
    characterVector(["data.frame"]),
  );
  expect(dataFrameRowCount(frame)).toBe(4);
});
