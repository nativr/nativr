import { describe, expect, it } from "vitest";

import { filledContourBands } from "../src/filled-contour.js";

describe("filled contour band geometry", () => {
  it("clips a planar cell into GNU-compatible diagonal bands", () => {
    const bands = filledContourBands(
      {
        rows: 2,
        columns: 2,
        x: [0, 1],
        y: [0, 1],
        z: [0, 1, 1, 2],
      },
      [0, 0.5, 1, 1.5, 2],
    );

    expect(bands.map((band) => band.levelIndex)).toEqual([0, 1, 2, 3]);
    expect(bands.map((band) => band.x.length)).toEqual([4, 6, 6, 4]);
    expect(bands[0]?.x.every((value) => value >= 0 && value <= 0.5)).toBe(true);
    expect(bands[0]?.y.every((value) => value >= 0 && value <= 0.5)).toBe(true);
    expect(bands[3]?.x.every((value) => value >= 0.5 && value <= 1)).toBe(true);
    expect(bands[3]?.y.every((value) => value >= 0.5 && value <= 1)).toBe(true);
  });

  it("uses the lower-left to upper-right diagonal for a saddle", () => {
    const bands = filledContourBands(
      {
        rows: 2,
        columns: 2,
        x: [0, 1],
        y: [0, 1],
        z: [0, 2, 2, 0],
      },
      [0, 0.5, 1, 1.5, 2],
    );

    expect(bands).toHaveLength(4);
    expect(bands[0]?.x).toEqual([0, 0.25, 1, 1, 0.75, 0]);
    expect(bands[0]?.y).toEqual([0, 0, 0.75, 1, 1, 0.25]);
  });

  it("preserves holes as NaN-separated rings and omits unavailable cells", () => {
    const ring = filledContourBands(
      {
        rows: 3,
        columns: 3,
        x: [0, 1, 2],
        y: [0, 1, 2],
        z: [0, 2, 0, 2, 0, 2, 0, 2, 0],
      },
      [0, 1, 2],
    );
    expect(ring.some((band) => band.x.some(Number.isNaN))).toBe(true);

    const missing = filledContourBands(
      {
        rows: 2,
        columns: 2,
        x: [0, 1],
        y: [0, 1],
        z: [0, 1, undefined, 2],
      },
      [0, 1, 2],
    );
    expect(missing).toEqual([]);
  });
});
