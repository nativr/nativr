import { expect, it } from "vitest";
import { Utf8SourceMap } from "../src/source-map.js";

it("indexes long ASCII input with bounded charged storage", () => {
  const allocations: number[] = [];
  const map = new Utf8SourceMap("a".repeat(100000), {
    allocate: (elements) => {
      allocations.push(elements);
      if (elements > 4) throw new Error("dense source index");
    },
  });
  expect(allocations.length).toBeGreaterThan(0);
  expect(map.positionAtByte(99999)).toEqual({ offset: 99999, line: 1, column: 100000 });
});

it("checks cancellation during source indexing", () => {
  const marker = new Error("owned source-index cancellation");
  expect(
    () =>
      new Utf8SourceMap("a".repeat(100000), {
        checkpoint: () => {
          throw marker;
        },
      }),
  ).toThrow(marker);
});

it("reserves Unicode index storage before allocation", () => {
  const marker = new Error("owned source-index allocation limit");
  expect(
    () =>
      new Utf8SourceMap("é".repeat(10000), {
        allocate: (elements) => {
          if (elements > 256) throw marker;
        },
      }),
  ).toThrow(marker);
});

it("floors recovered UTF-8 offsets to complete codepoints across sparse ASCII runs", () => {
  const source = "abcé\n😀z\ud800";
  const map = new Utf8SourceMap(source);
  const boundaries = [{ byte: 0, offset: 0 }];
  let bytes = 0,
    offset = 0;
  for (const point of source) {
    bytes += new TextEncoder().encode(point).length;
    offset += point.length;
    boundaries.push({ byte: bytes, offset });
  }
  for (let byte = -1; byte <= bytes + 2; byte += 0.5) {
    const expected = boundaries.filter((x) => x.byte <= byte).at(-1)?.offset ?? 0;
    expect(map.positionAtByte(byte)).toEqual(map.positionAtUtf16(expected));
  }
  expect(map.positionAtByte(Number.NaN)).toEqual(map.positionAtUtf16(0));
  expect(map.positionAtByte(Infinity)).toEqual(map.positionAtUtf16(source.length));
});
