import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildParseData, RetainedParserResourceError } from "../src/parse-data.js";

type NativeRow = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  string,
];
interface NativeCase {
  readonly id: string;
  readonly source: string;
  readonly n?: number;
  readonly error: boolean;
  readonly expressions: number | null;
  readonly whole: readonly number[] | null;
  readonly events: readonly NativeRow[];
}
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/parse-data-native.json", import.meta.url), "utf8"),
) as { readonly cases: readonly NativeCase[] };

/** Test-only coordinates derived from the authored text, independent of the event scanner. */
function positions(source: string): readonly (readonly [number, number])[] {
  const result: [number, number][] = [];
  let line = 1;
  let column = 1;
  for (let offset = 0; offset < source.length; offset++) {
    result.push([line, column]);
    if (source[offset] === "\n") {
      line++;
      column = 1;
    } else if (source[offset] === "\t") {
      column = (Math.floor((column - 1) / 8) + 1) * 8 + 1;
    } else {
      column++;
    }
  }
  result.push([line, column]);
  return result;
}

describe("independently observed retained-parser metadata", () => {
  it.each(fixture.cases)("$id", (testCase) => {
    const effective = `${testCase.source}\n`;
    const result = buildParseData(testCase.source, {
      ...(testCase.n === undefined ? {} : { maxExpressions: testCase.n }),
    });
    const coordinates = positions(effective);
    expect(
      result.records.map((record) => [
        ...coordinates[record.startOffset]!,
        ...coordinates[record.endOffset - 1]!,
        Number(record.terminal),
        record.tokenCode,
        record.id,
        record.parent,
        record.token,
        record.text ??
          (record.terminal && record.token !== "LINE_DIRECTIVE"
            ? effective.slice(record.startOffset, record.endOffset)
            : ""),
      ]),
    ).toEqual(testCase.events);
    expect(result.diagnostic !== undefined).toBe(testCase.error);
    if (!testCase.error) expect(result.selectedCount).toBe(testCase.expressions);
    if (testCase.whole?.length) {
      expect(coordinates[result.consumedOffset]).toEqual([
        testCase.whole[7],
        testCase.whole[5]! + 1,
      ]);
    }
  });
});

describe("retained-parser resource boundaries", () => {
  it("accounts for comment-association storage before constructing it", () => {
    const marker = new Error("owned association allocation limit");
    expect(() =>
      buildParseData("17L # owned\n".repeat(2000), {
        allocate: (elements) => {
          if (elements > 512) throw marker;
        },
      }),
    ).toThrow(marker);
  });

  it("permits cancellation during comment association", () => {
    const marker = new Error("owned association cancellation");
    let metadataStarted = false;
    expect(() =>
      buildParseData("17L # owned\n".repeat(2000), {
        allocate: (elements) => {
          if (elements > 512) metadataStarted = true;
        },
        checkpoint: () => {
          if (metadataStarted) throw marker;
        },
      }),
    ).toThrow(marker);
    expect(metadataStarted).toBe(true);
  });
  it("bounds lexical work for a long flat arithmetic expression", () => {
    let work = 0;
    const result = buildParseData(Array.from({ length: 2000 }, () => "17L").join("+"), {
      checkpoint: () => {
        if (++work > 25_000) throw new Error("repeated numeric suffix scanning");
      },
    });
    expect(result.diagnostic).toBeUndefined();
    expect(result.selectedCount).toBe(1);
  });
  it("uses a parser resource error before exhausting the JavaScript stack", () => {
    expect(() => buildParseData("(".repeat(10_000))).toThrow(RetainedParserResourceError);
    expect(() => buildParseData("x=".repeat(10_000))).toThrow(RetainedParserResourceError);
  });

  it("uses the caller's depth failure without rewriting it as a syntax error", () => {
    const marker = new Error("owned depth marker");
    expect(() =>
      buildParseData("((x))", {
        maxDepth: 2,
        onDepthExceeded: () => {
          throw marker;
        },
      }),
    ).toThrow(marker);
  });

  it("allows cancellation and allocation failures to escape unchanged", () => {
    const cancellation = new Error("owned cancellation marker");
    const allocation = new Error("owned allocation marker");
    expect(() =>
      buildParseData("17L", {
        checkpoint: () => {
          throw cancellation;
        },
      }),
    ).toThrow(cancellation);
    expect(() =>
      buildParseData("17L", {
        allocate: () => {
          throw allocation;
        },
      }),
    ).toThrow(allocation);
  });

  it("stops scanning at a finite expression delimiter", () => {
    let work = 0;
    const result = buildParseData(`17L;${"(".repeat(100_000)}`, {
      maxExpressions: 1,
      checkpoint: () => {
        if (++work > 30) throw new Error("scanned beyond the owned prefix");
      },
    });
    expect(result.consumedOffset).toBe(4);
    expect(result.selectedCount).toBe(1);
    expect(result.diagnostic).toBeUndefined();
    expect(result.records.map((record) => record.id)).toEqual([1, 2, 3]);
  });
});
