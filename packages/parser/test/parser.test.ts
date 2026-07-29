import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createParser, Utf8SourceMap } from "../src/index.js";
import type { NativRParser } from "../src/index.js";

const assetRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets");
let parser: NativRParser;

beforeAll(async () => {
  parser = await createParser({
    treeSitterRuntimeWasm: path.join(assetRoot, "web-tree-sitter.wasm"),
    rGrammarWasm: path.join(assetRoot, "tree-sitter-r.wasm"),
  });
});

afterAll(() => parser.dispose());

describe("Tree-sitter normalization", () => {
  it("normalizes scalar arithmetic with stable spans", () => {
    const result = parser.parse("1 + 1");
    expect(result.diagnostics).toEqual([]);
    expect(result.ast.body[0]).toMatchObject({
      kind: "BinaryExpression",
      operator: "+",
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 5, line: 1, column: 6 },
      },
    });
  });

  it("preserves Unicode UTF-16 positions from the web parser", () => {
    const result = parser.parse('"é"\n1 + 1');
    expect(result.ast.body).toHaveLength(2);
    expect(result.ast.body[0]).toMatchObject({ kind: "StringLiteral", value: "é" });
    expect(result.ast.body[1]?.span.start).toEqual({ offset: 4, line: 2, column: 1 });
  });

  it("maps byte-oriented parser offsets when a UTF-8 callback is used", () => {
    const mapper = new Utf8SourceMap('"é"\n');
    expect(mapper.positionAtByte(5)).toEqual({ offset: 4, line: 2, column: 1 });
  });

  it("normalizes named arguments, functions, and integer literals", () => {
    const result = parser.parse("f <- function(x = 2L) mean(c(x, 4), na.rm = TRUE)");
    expect(result.diagnostics).toEqual([]);
    expect(result.ast.body[0]).toMatchObject({
      kind: "AssignmentExpression",
      value: {
        kind: "FunctionExpression",
        parameters: [{ name: "x", defaultValue: { kind: "IntegerLiteral", value: 2 } }],
      },
    });
  });

  it("retains parsed-but-unsupported syntax as owned AST nodes", () => {
    expect(parser.parse("x[1]").ast.body[0]?.kind).toBe("SubsetExpression");
    expect(parser.parse("x |> mean()").ast.body[0]?.kind).toBe("PipeExpression");
    expect(parser.parse("~ x").ast.body[0]?.kind).toBe("FormulaExpression");
  });

  it("returns structured syntax diagnostics", () => {
    const result = parser.parse("1 +");
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
    });
    expect(result.diagnostics[0]?.code).toMatch(/^NRP100[12]$/u);
    expect(result.diagnostics[0]?.span).toBeDefined();
  });
});
