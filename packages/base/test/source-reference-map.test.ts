import type { ParseSourceDirective } from "@nativr/ast";
import { describe, expect, it } from "vitest";
import { SourceReferenceMap } from "../src/source-reference-map.js";

const noWork = (): void => {};
const makeMap = (source: string, directives: readonly ParseSourceDirective[] = []) =>
  new SourceReferenceMap(source, {
    directives,
    originalFilename: "owned.R",
    checkpoint: noWork,
    allocate: noWork,
  });

function directive(
  source: string,
  text: string,
  nextLogicalLine: number,
  filename?: string,
): ParseSourceDirective {
  const startOffset = source.indexOf(text);
  expect(startOffset).toBeGreaterThanOrEqual(0);
  return {
    startOffset,
    endOffset: source.indexOf("\n", startOffset),
    nextLogicalLine,
    ...(filename === undefined ? {} : { filename }),
  };
}

describe("retained source-reference coordinates", () => {
  // Independently authored GNU R 4.6.1 observations: retained-parse-next's UTF-8/tab and
  // nested-block candidates, plus the separate source-reference-map-next directive probes.
  it("distinguishes UTF-8 bytes, codepoints, UTF-16 offsets and tab columns", () => {
    const source = '"é😀"; 17L\n\t"é";29L\n';
    const map = makeMap(source);
    const ranges = [
      [0, source.indexOf(";")],
      [source.indexOf("17L"), source.indexOf("17L") + 3],
      [source.indexOf('"é"'), source.indexOf('"é"') + 3],
      [source.indexOf("29L"), source.indexOf("29L") + 3],
    ];
    expect(ranges.map(([start, end]) => map.span(start!, end!))).toEqual([
      [1, 1, 1, 8, 1, 4, 1, 1],
      [1, 11, 1, 13, 7, 9, 1, 1],
      [2, 2, 2, 5, 9, 11, 2, 2],
      [2, 7, 2, 9, 13, 15, 2, 2],
    ]);
    expect(() => map.position(3)).toThrow("splits a Unicode codepoint");
  });

  it("starts a nested block whole reference at the global input origin", () => {
    const source = "{\n  17L; {29L; 31L}\n  37L\n}\n";
    const map = makeMap(source);
    const start = source.indexOf("{", 1);
    const end = source.indexOf("}") + 1;
    expect(map.span(start, end)).toEqual([2, 8, 2, 17, 8, 17, 2, 2]);
    expect(map.whole(end)).toEqual([1, 0, 2, 17, 0, 17, 1, 2]);
  });

  it.each([
    { source: "17L  ; 29L\n", consumed: 6, expected: [1, 0, 1, 6, 0, 6, 1, 1] },
    { source: "17L # comment\n29L\n", consumed: 14, expected: [1, 0, 2, 0, 0, 0, 1, 2] },
    { source: "17L\n", consumed: 4, expected: [1, 0, 2, 0, 0, 0, 1, 2] },
    { source: "17L\n\n", consumed: 5, expected: [1, 0, 3, 0, 0, 0, 1, 3] },
    { source: "\n", consumed: 1, expected: [1, 0, 2, 0, 0, 0, 1, 2] },
  ])("uses the supplied consumed endpoint for $source", ({ source, consumed, expected }) => {
    expect(makeMap(source).whole(consumed)).toEqual(expected);
  });

  it("keeps physical lines while a directive changes logical lines and source identity", () => {
    const source = '{17L\n#line 41 "a.R"\n29L}\n';
    const map = makeMap(source, [directive(source, '#line 41 "a.R"', 41, "a.R")]);
    const firstEnd = source.indexOf("17L") + 3;
    const lastStart = source.indexOf("29L");
    const blockEnd = source.indexOf("}") + 1;
    expect(map.span(0, blockEnd)).toEqual([1, 1, 41, 4, 1, 4, 1, 3]);
    expect(map.span(lastStart, lastStart + 3)).toEqual([41, 1, 41, 3, 1, 3, 3, 3]);
    expect(map.whole(blockEnd)).toEqual([1, 0, 41, 4, 0, 4, 1, 3]);
    expect(map.whole(source.length)).toEqual([1, 0, 42, 0, 0, 0, 1, 4]);
    expect(map.sourceIndexAt(firstEnd)).toBe(0);
    expect(map.sourceIndexAt(blockEnd)).toBe(1);
    expect(map.sources).toEqual([
      { index: 0, filename: "owned.R" },
      { index: 1, filename: "a.R" },
    ]);
  });

  it("reuses only the current filename and preserves each newly created alias identity", () => {
    const source = [
      '#line 41 "owned.R"',
      "17L",
      '#line 8 "a.R"',
      "29L",
      '#line 12 "a.R"',
      "31L",
      "#line 18",
      "37L",
      '#line 21 "b.R"',
      "41L",
      '#line 24 "a.R"',
      "43L",
      "",
    ].join("\n");
    const map = makeMap(source, [
      directive(source, '#line 41 "owned.R"', 41, "owned.R"),
      directive(source, '#line 8 "a.R"', 8, "a.R"),
      directive(source, '#line 12 "a.R"', 12, "a.R"),
      directive(source, "#line 18", 18),
      directive(source, '#line 21 "b.R"', 21, "b.R"),
      directive(source, '#line 24 "a.R"', 24, "a.R"),
    ]);
    expect(
      ["17L", "29L", "31L", "37L", "41L", "43L"].map((text) =>
        map.sourceIndexAt(source.indexOf(text) + 3),
      ),
    ).toEqual([0, 1, 1, 1, 2, 3]);
    expect(map.sources).toEqual([
      { index: 0, filename: "owned.R" },
      { index: 1, filename: "a.R" },
      { index: 2, filename: "b.R" },
      { index: 3, filename: "a.R" },
    ]);
  });

  it("represents logical integer overflow as missing without changing physical coordinates", () => {
    const source = '#line 2147483648 "a.R"\n17L\n';
    const map = makeMap(source, [directive(source, '#line 2147483648 "a.R"', 2147483647, "a.R")]);
    const start = source.indexOf("17L");
    expect(map.span(start, start + 3)).toEqual([2147483647, 1, 2147483647, 3, 1, 3, 2, 2]);
    expect(map.whole(source.length)).toEqual([1, 0, null, 0, 0, 0, 1, 3]);
  });

  it("does not interpret directive-looking text without lexical directive facts", () => {
    const source = 'r"(first\n#line 41 "a.R"\nlast)";17L\n';
    const map = makeMap(source);
    const start = source.indexOf("17L");
    expect(map.span(start, start + 3)).toEqual([3, 8, 3, 10, 8, 10, 3, 3]);
    expect(map.sourceIndexAt(source.length)).toBe(0);
    expect(map.sources).toEqual([{ index: 0, filename: "owned.R" }]);
  });
});

describe("source-reference index resource guards", () => {
  it("checks dense index allocation before constructing its retained arrays", () => {
    const failure = new Error("owned index allocation limit");
    let allocated = 0;
    expect(
      () =>
        new SourceReferenceMap("\n".repeat(4096), {
          directives: [],
          checkpoint: noWork,
          allocate: (length) => {
            if (length > 64) throw failure;
            allocated += length;
          },
        }),
    ).toThrow(failure);
    expect(allocated).toBe(0);
    expect(makeMap("17L\n").whole(4)).toEqual([1, 0, 2, 0, 0, 0, 1, 2]);
  });

  it("bounds work in long ASCII runs and recovers after interrupted indexing", () => {
    const failure = new Error("owned source-index cancellation");
    let checkpoints = 0;
    let allocations = 0;
    expect(
      () =>
        new SourceReferenceMap("a".repeat(600_000) + "\n", {
          directives: [],
          checkpoint: () => {
            if (++checkpoints === 8) throw failure;
          },
          allocate: () => {
            allocations += 1;
          },
        }),
    ).toThrow(failure);
    expect(allocations).toBe(0);
    expect(makeMap("29L\n").span(0, 3)).toEqual([1, 1, 1, 3, 1, 3, 1, 1]);
  });

  it("does not allocate per ASCII character and checks cancellation on later lookups", () => {
    const failure = new Error("owned lookup cancellation");
    let cancelled = false;
    let allocation = 0;
    const map = new SourceReferenceMap("a".repeat(600_000) + "\n", {
      directives: [],
      checkpoint: () => {
        if (cancelled) throw failure;
      },
      allocate: (length) => {
        allocation += length;
      },
    });
    expect(allocation).toBeLessThan(100);
    expect(map.span(599_997, 600_000)).toEqual([1, 599998, 1, 600000, 599998, 600000, 1, 1]);
    cancelled = true;
    expect(() => map.whole(600_001)).toThrow(failure);
  });
});
