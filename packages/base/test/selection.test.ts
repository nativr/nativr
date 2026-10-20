import { expect, it } from "vitest";
import { selectRanks } from "../src/selection.js";

it("preserves the multiset and both sides of every requested rank", () => {
  let state = 367;
  const random = (limit: number): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  for (let trial = 0; trial < 600; trial += 1) {
    const length = 2 + random(49);
    const values = Array.from({ length }, () => (random(3) === 0 ? random(7) : random(101) - 50));
    const ranks = Array.from({ length: 1 + random(Math.min(10, length)) }, () => random(length));
    const indices = values.map((_, index) => index);
    let work = 0;
    selectRanks(
      indices,
      ranks,
      (a, b) => values[a]! - values[b]!,
      () => {
        if (++work > 10000) throw new Error("selection did not converge");
      },
    );
    const actual = indices.map((index) => values[index]!);
    const sorted = [...values].sort((a, b) => a - b);
    expect([...actual].sort((a, b) => a - b)).toEqual(sorted);
    for (const rank of ranks) {
      expect(actual[rank]).toBe(sorted[rank]);
      expect(actual.slice(0, rank).every((value) => value <= actual[rank]!)).toBe(true);
      expect(actual.slice(rank + 1).every((value) => value >= actual[rank]!)).toBe(true);
    }
  }
});
