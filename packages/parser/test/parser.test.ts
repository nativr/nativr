import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createParser, Utf8SourceMap } from "../src/index.js";
import type { NativRParser } from "../src/index.js";

let parser: NativRParser;

beforeAll(async () => {
  parser = await createParser({
    treeSitterRuntimeWasm: new URL("../assets/web-tree-sitter.wasm", import.meta.url),
    rGrammarWasm: new URL("../assets/tree-sitter-r.wasm", import.meta.url).href,
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

  it("normalizes imaginary literals without retaining grammar nodes", () => {
    expect(parser.parse("2.5i").ast.body[0]).toMatchObject({
      kind: "ComplexLiteral",
      imaginary: 2.5,
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

  it("decodes backtick-delimited identifiers into their R binding names", () => {
    expect(parser.parse("`+`(1, 2)").ast.body[0]).toMatchObject({
      kind: "CallExpression",
      callee: { kind: "Identifier", name: "+" },
    });
    expect(parser.parse("`a b` <- 1").ast.body[0]).toMatchObject({
      kind: "AssignmentExpression",
      target: { kind: "Identifier", name: "a b" },
    });
    expect(parser.parse("`a\\`b`").ast.body[0]).toMatchObject({
      kind: "Identifier",
      name: "a`b",
    });
    expect(parser.parse("list(`slot name` = 1)").ast.body[0]).toMatchObject({
      kind: "CallExpression",
      arguments: [{ name: "slot name", value: { kind: "DoubleLiteral", value: 1 } }],
    });
    expect(parser.parse("list(\"quoted name\" = 1, 'single' = 2)").ast.body[0]).toMatchObject({
      kind: "CallExpression",
      arguments: [
        { name: "quoted name", value: { kind: "DoubleLiteral", value: 1 } },
        { name: "single", value: { kind: "DoubleLiteral", value: 2 } },
      ],
    });
    expect(parser.parse("x %o% y").ast.body[0]).toMatchObject({
      kind: "CallExpression",
      callee: { kind: "Identifier", name: "%o%" },
      arguments: [
        { value: { kind: "Identifier", name: "x" } },
        { value: { kind: "Identifier", name: "y" } },
      ],
    });
    expect(parser.parse("x %% y").ast.body[0]).toMatchObject({
      kind: "BinaryExpression",
      operator: "%%",
    });
  });

  it("retains parsed-but-unsupported syntax as owned AST nodes", () => {
    expect(parser.parse("x[1]").ast.body[0]?.kind).toBe("SubsetExpression");
    expect(parser.parse("x |> mean()").ast.body[0]).toMatchObject({
      kind: "PipeExpression",
      operator: "|>",
    });
    expect(parser.parse("x %>% mean()").ast.body[0]).toMatchObject({
      kind: "PipeExpression",
      operator: "%>%",
    });
    expect(parser.parse("~ x").ast.body[0]?.kind).toBe("FormulaExpression");
  });

  it("preserves leading and trailing missing multidimensional subscripts", () => {
    const trailing = parser.parse("m[1, ]").ast.body[0];
    const leading = parser.parse("m[, 2]").ast.body[0];
    expect(trailing).toMatchObject({
      kind: "SubsetExpression",
      arguments: [
        { value: { kind: "DoubleLiteral", value: 1 } },
        { value: { kind: "UnsupportedExpression", feature: "missing argument" } },
      ],
    });
    expect(leading).toMatchObject({
      kind: "SubsetExpression",
      arguments: [
        { value: { kind: "UnsupportedExpression", feature: "missing argument" } },
        { value: { kind: "DoubleLiteral", value: 2 } },
      ],
    });
  });

  it("retains names on explicitly missing call arguments", () => {
    expect(parser.parse("f(x = )").ast.body[0]).toMatchObject({
      kind: "CallExpression",
      arguments: [
        {
          name: "x",
          value: { kind: "UnsupportedExpression", feature: "missing argument" },
        },
      ],
    });
  });

  it("normalizes every control-flow form into owned AST nodes", () => {
    expect(parser.parse("if (TRUE) 1 else 2").ast.body[0]?.kind).toBe("IfExpression");
    expect(parser.parse("for (x in 1:2) x").ast.body[0]?.kind).toBe("ForExpression");
    expect(parser.parse("while (FALSE) 1").ast.body[0]?.kind).toBe("WhileExpression");
    expect(parser.parse("repeat { break }").ast.body[0]).toMatchObject({
      kind: "RepeatExpression",
      body: { kind: "Block", body: [{ kind: "BreakExpression" }] },
    });
    expect(parser.parse("next").ast.body[0]?.kind).toBe("NextExpression");
    expect(parser.parse("return(1)").ast.body[0]?.kind).toBe("ReturnExpression");
  });

  it("normalizes direct subset replacement separately from ordinary assignment", () => {
    expect(parser.parse("x[1] <- 2").ast.body[0]).toMatchObject({
      kind: "ReplacementExpression",
      target: { kind: "SubsetExpression", operator: "[", target: { name: "x" } },
    });
    expect(parser.parse("x$name <- 2").ast.body[0]).toMatchObject({
      kind: "ReplacementExpression",
      target: { operator: "$" },
    });
    expect(parser.parse('attr(x, "tag") <- 2').ast.body[0]).toMatchObject({
      kind: "ReplacementExpression",
      target: {
        kind: "CallExpression",
        callee: { kind: "Identifier", name: "attr" },
        arguments: [
          { value: { kind: "Identifier", name: "x" } },
          { value: { kind: "StringLiteral", value: "tag" } },
        ],
      },
    });
  });

  it("normalizes rightward and non-local assignment targets", () => {
    expect(parser.parse("1 -> x").ast.body[0]).toMatchObject({
      kind: "AssignmentExpression",
      operator: "->",
      target: { kind: "Identifier", name: "x" },
      value: { kind: "DoubleLiteral", value: 1 },
    });
    expect(parser.parse("2 ->> x").ast.body[0]).toMatchObject({
      kind: "AssignmentExpression",
      operator: "->>",
      target: { kind: "Identifier", name: "x" },
    });
    expect(parser.parse("x[1] <<- 3").ast.body[0]).toMatchObject({
      kind: "ReplacementExpression",
      operator: "<<-",
      target: { kind: "SubsetExpression" },
    });
    expect(parser.parse("4 -> x[2]").ast.body[0]).toMatchObject({
      kind: "ReplacementExpression",
      operator: "->",
      target: { kind: "SubsetExpression" },
    });
    expect(parser.parse('c("a", "b") -> names(x)').ast.body[0]).toMatchObject({
      kind: "ReplacementExpression",
      operator: "->",
      target: { kind: "CallExpression" },
    });
  });

  it("normalizes quoted assignment names as direct bindings", () => {
    expect(parser.parse('"quoted name" <- 1').ast.body[0]).toMatchObject({
      kind: "AssignmentExpression",
      target: { kind: "Identifier", name: "quoted name" },
      value: { kind: "DoubleLiteral", value: 1 },
    });
    expect(parser.parse('2 -> "right name"').ast.body[0]).toMatchObject({
      kind: "AssignmentExpression",
      operator: "->",
      target: { kind: "Identifier", name: "right name" },
    });
  });

  it("returns structured syntax diagnostics", () => {
    const result = parser.parse("1 +");
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
    });
    expect(result.diagnostics[0]?.code).toMatch(/^NRP100[12]$/u);
    expect(result.diagnostics[0]?.span).toBeDefined();
  });

  it("retains complete top-level expressions before a trailing syntax error", () => {
    const result = parser.parse("1; x +");
    expect(result.ast.body).toHaveLength(1);
    expect(result.ast.body[0]).toMatchObject({ kind: "DoubleLiteral", value: 1 });
    expect(result.diagnostics[0]).toMatchObject({
      code: "NRP1002",
      severity: "error",
    });
  });
});
