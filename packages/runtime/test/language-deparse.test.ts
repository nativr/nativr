import type { AstNode, FunctionExpressionNode } from "@nativr/ast";
import { deparseDiagnosticAst } from "../src/language.js";
import { createParser } from "@nativr/parser";
import type { NativRParser } from "@nativr/parser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createEnvironment,
  deparseAst,
  deparseAstLines,
  deparseClosureLines,
  RResourceLimitError,
} from "../src/index.js";

let parser: NativRParser;
beforeAll(async () => {
  parser = await createParser({
    treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
    rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
  });
});
afterAll(() => parser.dispose());

function expression(source: string): AstNode {
  const parsed = parser.parse(source);
  expect(parsed.diagnostics).toEqual([]);
  const node = parsed.ast.body[0];
  if (node === undefined) throw new Error("Expected one expression");
  return node;
}

function closure(source: string) {
  const node = expression(source) as FunctionExpressionNode;
  expect(node.kind).toBe("FunctionExpression");
  return {
    type: "closure" as const,
    parameters: node.parameters,
    body: node.body,
    environment: createEnvironment(null),
    attributes: new Map(),
  };
}

// Independently authored input/output observations from GNU R 4.6.1, keep.source=FALSE.
describe("structural R syntax layout", () => {
  it("bounds compact and diagnostic syntax before recursive precedence inspection", () => {
    let node = expression("x");
    for (let index = 0; index < 600; index += 1)
      node = { kind: "ConstantExpression", value: null, display: node, span: node.span };
    for (const render of [deparseAst, deparseDiagnosticAst])
      expect(() => render(node)).toThrowError(RResourceLimitError);
  });

  it("checks work across wide compact syntax and preserves shared subexpressions", () => {
    const leaf = expression("x + y");
    const node: AstNode = {
      kind: "CallExpression",
      callee: expression("f"),
      arguments: Array.from({ length: 1000 }, () => ({ value: leaf, span: leaf.span })),
      span: leaf.span,
    };
    let work = 0;
    expect(() =>
      deparseAst(node, () => {
        if (++work > 50) throw new Error("budget");
      }),
    ).toThrow("budget");
    expect(deparseAst({ ...node, arguments: node.arguments.slice(0, 2) })).toBe("f(x + y, x + y)");
  });

  it("separates closure headers and preserves structural blocks and nested functions", () => {
    expect(deparseClosureLines(closure("function(x, y = 1, ...) x + y"))).toEqual([
      "function (x, y = 1, ...) ",
      "x + y",
    ]);
    expect(deparseClosureLines(closure("function() {}"))).toEqual(["function () ", "{", "}"]);
    expect(deparseClosureLines(closure("function(x) function(y=2) {x+y}"))).toEqual([
      "function (x) ",
      "function(y = 2) {",
      "    x + y",
      "}",
    ]);
    expect(deparseClosureLines(closure("function(`odd name` = 1:3, ...) NULL"))).toEqual([
      "function (`odd name` = 1:3, ...) ",
      "NULL",
    ]);
  });

  it("lays out statement conditionals according to their surrounding block", () => {
    expect(deparseClosureLines(closure("function(x) if(x) {1;2} else {3;4}"))).toEqual([
      "function (x) ",
      "if (x) {",
      "    1",
      "    2",
      "} else {",
      "    3",
      "    4",
      "}",
    ]);
    expect(deparseClosureLines(closure("function(x) {if(x) {1;2} else {3;4}}"))).toEqual([
      "function (x) ",
      "{",
      "    if (x) {",
      "        1",
      "        2",
      "    }",
      "    else {",
      "        3",
      "        4",
      "    }",
      "}",
    ]);
    expect(
      deparseClosureLines(closure("function(x) {for(i in 1:3) {if(i>2) next; x<-x+i}; x}")),
    ).toEqual([
      "function (x) ",
      "{",
      "    for (i in 1:3) {",
      "        if (i > 2) ",
      "            next",
      "        x <- x + i",
      "    }",
      "    x",
      "}",
    ]);
    expect(
      deparseClosureLines(closure("function(x) {while(x>0) x<-x-1; repeat if(x) break}")),
    ).toEqual([
      "function (x) ",
      "{",
      "    while (x > 0) x <- x - 1",
      "    repeat if (x) ",
      "        break",
      "}",
    ]);
    expect(
      deparseClosureLines(closure("function(x) {list(a=if(x) 1 else 2,b=3)}"), {
        isPrimitive: (name) => name === "list",
      }),
    ).toEqual(["function (x) ", "{", "    list(a = if (x) 1 else 2, b = 3)", "}"]);
  });

  it("wraps call/formal separators and arithmetic tokens without splitting names", () => {
    expect(
      deparseClosureLines(
        closure(
          "function(x = 123456789, second_parameter_name = c(1,2,3), another_parameter = c(10,20,30), last_parameter = 4) x",
        ),
      ),
    ).toEqual([
      "function (x = 123456789, second_parameter_name = c(1, 2, 3), ",
      "    another_parameter = c(10, 20, 30), last_parameter = 4) ",
      "x",
    ]);
    expect(
      deparseClosureLines(
        closure(
          "function(x) { y <- list(first_argument=x+1, second_argument=x+2, third_argument=x+3, fourth_argument=x+4); y }",
        ),
      ),
    ).toEqual([
      "function (x) ",
      "{",
      "    y <- list(first_argument = x + 1, second_argument = x + 2, ",
      "        third_argument = x + 3, fourth_argument = x + 4)",
      "    y",
      "}",
    ]);
    expect(
      deparseAstLines(expression("f(aaaa,bbbb,cccc,dddd,eeee,ffff,gggg,hhhh,iiii,jjjj,kkkk)"), {
        widthCutoff: 20,
      }),
    ).toEqual([
      "f(aaaa, bbbb, cccc, dddd, ",
      "    eeee, ffff, gggg, ",
      "    hhhh, iiii, jjjj, ",
      "    kkkk)",
    ]);
    expect(
      deparseAstLines(expression("aaaaaaaaaaaaaaa <- bbbbbbbbbbbbbbb + ccccccccccccccc"), {
        widthCutoff: 20,
      }),
    ).toEqual(["aaaaaaaaaaaaaaa <- bbbbbbbbbbbbbbb + ", "    ccccccccccccccc"]);
    expect(
      deparseAstLines(expression("a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t"), { widthCutoff: 20 }),
    ).toEqual(["a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t"]);
  });

  it("retains compact precedence decisions and supports structured call arguments", () => {
    for (const source of [
      "a - (b - c)",
      "(a + b) * c",
      "a * (!b) + c",
      "(function(x) x)(2)",
      "x[(a + b), drop = FALSE]",
      "x$`odd name`",
      "stats::median(x)",
    ]) {
      const node = expression(source);
      expect(deparseAstLines(node)).toEqual([deparseAst(node)]);
    }
    expect(deparseClosureLines(closure("function(x) list(a=function(y) {x+y}, b={1;2})"))).toEqual([
      "function (x) ",
      "list(a = function(y) {",
      "    x + y",
      "}, b = {",
      "    1",
      "    2",
      "})",
    ]);
  });

  it("tracks continuation indentation and static primitive conditional layout", () => {
    expect(
      deparseClosureLines(closure("function(x) f(aaaaaaaaaaaaaaaaa,function(y){y;y})"), {
        widthCutoff: 20,
      }),
    ).toEqual([
      "function (x) ",
      "f(aaaaaaaaaaaaaaaaa, ",
      "    function(y) {",
      "        y",
      "        y",
      "    })",
    ]);
    expect(deparseClosureLines(closure("function(x) {foo(if(x) 1 else 2)}"))).toEqual([
      "function (x) ",
      "{",
      "    foo(if (x) ",
      "        1",
      "    else 2)",
      "}",
    ]);
    expect(
      deparseClosureLines(closure("function(x) {list(aaaaaaaaaaaaaa,if(x){1}else{2})}"), {
        widthCutoff: 20,
        isPrimitive: (name) => name === "list",
      }),
    ).toEqual([
      "function (x) ",
      "{",
      "    list(aaaaaaaaaaaaaa, ",
      "        if (x) {",
      "            1",
      "        } else {",
      "            2",
      "        })",
      "}",
    ]);
  });

  it("renders supplied closure attributes within the same structural layout", () => {
    const note = expression('"tag"');
    const options = { attributes: [{ name: "note", value: note, span: note.span }] };
    expect(deparseClosureLines(closure("function(x) x+1"), options)).toEqual([
      "structure(function (x) ",
      'x + 1, note = "tag")',
    ]);
    expect(deparseClosureLines(closure("function(x) {x+1;x}"), options)).toEqual([
      "structure(function (x) ",
      "{",
      "    x + 1",
      "    x",
      '}, note = "tag")',
    ]);
  });

  it("restores the surrounding continuation indent between sibling defaults", () => {
    expect(
      deparseClosureLines(
        closure(
          "function(x=123456789,second_parameter_name=c(1,2,3),another_parameter=c(10,20,30),last_parameter=4)x+second_parameter_name+another_parameter+last_parameter",
        ),
        { widthCutoff: 25 },
      ),
    ).toEqual([
      "function (x = 123456789, second_parameter_name = c(1, ",
      "    2, 3), another_parameter = c(10, ",
      "    20, 30), last_parameter = 4) ",
      "x + second_parameter_name + ",
      "    another_parameter + last_parameter",
    ]);
    expect(
      deparseClosureLines(closure("function(x) aaaaaaaaaaaaaaaaaaaa + f(aaaaaa,bbbbbb,cccccc)"), {
        widthCutoff: 20,
      }),
    ).toEqual([
      "function (x) ",
      "aaaaaaaaaaaaaaaaaaaa + ",
      "    f(aaaaaa, bbbbbb, ",
      "        cccccc)",
    ]);
    expect(
      deparseClosureLines(
        closure(
          "function(x) f(aaaaaaaaaaa+bbbbbbbbbbb+ccccccccccc,ddddddddddd+eeeeeeeeeee+fffffffffff)",
        ),
        { widthCutoff: 20 },
      ),
    ).toEqual([
      "function (x) ",
      "f(aaaaaaaaaaa + bbbbbbbbbbb + ",
      "    ccccccccccc, ddddddddddd + ",
      "    eeeeeeeeeee + fffffffffff)",
    ]);
  });

  it("retains statement conditional layout in nested headers and formal defaults", () => {
    expect(
      deparseClosureLines(
        closure(
          "function(x) {if(if(y) 1 else 2) 1; for(i in if(z) 1 else 2) i; while(if(z) 1 else 2) break}",
        ),
      ),
    ).toEqual([
      "function (x) ",
      "{",
      "    if (if (y) ",
      "        1",
      "    else 2) ",
      "        1",
      "    for (i in if (z) ",
      "        1",
      "    else 2) i",
      "    while (if (z) ",
      "        1",
      "    else 2) break",
      "}",
    ]);
    expect(deparseClosureLines(closure("function(x) {f<-function(y=if(z) 1 else 2) 0}"))).toEqual([
      "function (x) ",
      "{",
      "    f <- function(y = if (z) ",
      "        1",
      "    else 2) 0",
      "}",
    ]);
  });

  it("limits returned lines and checks traversal and formatting work", () => {
    const value = closure("function(x) { x<-x+1; if(x>2) x else 0 }");
    expect(deparseClosureLines(value, { maxLines: 3 })).toEqual([
      "function (x) ",
      "{",
      "    x <- x + 1",
    ]);
    let work = 0;
    expect(() =>
      deparseClosureLines(value, {
        checkWork: () => {
          work += 1;
          if (work > 3) throw new Error("budget");
        },
      }),
    ).toThrow("budget");
    let node = expression("x");
    for (let index = 0; index < 600; index += 1)
      node = { kind: "ConstantExpression", value: null, display: node, span: node.span };
    expect(() => deparseAstLines(node)).toThrowError(RResourceLimitError);
  });
});
