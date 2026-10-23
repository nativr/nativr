import type { AstNode, FunctionExpressionNode, FunctionParameter } from "@nativr/ast";
import { describe, expect, it } from "vitest";

import { DEFAULT_RUNTIME_LIMITS, EvaluationContext } from "../src/context.js";
import { createEnvironment } from "../src/environment.js";
import { languageValueLength, languageValueNames } from "../src/language.js";
import {
  embeddedValueAst,
  extractLanguageElement,
  functionParametersValue,
  languageFromCallEntries,
  materializeLanguageEntries,
  quoteLanguageNode,
  replaceLanguageElement,
} from "../src/language-subset.js";
import { censusRuntimeMemory, estimateRObjectSize } from "../src/memory.js";
import { R_NULL, integerVector, languageValue, pairlistValue } from "../src/values.js";
import type { RLanguage, RValue } from "../src/values.js";

const span = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 1, line: 1, column: 2 },
};
const literal = (value: number): AstNode => ({ kind: "IntegerLiteral", value, span });
const call = (value: AstNode): AstNode => ({
  kind: "CallExpression",
  callee: { kind: "Identifier", name: "owned", span },
  arguments: [{ value, span }],
  span,
});
const syntax = (
  parameters: readonly FunctionParameter[] = [],
  body: AstNode = literal(7),
): FunctionExpressionNode => ({ kind: "FunctionExpression", parameters, body, span });
const context = () => new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: false });
const language = (value: RValue): RLanguage => {
  if (value.type !== "language") throw new Error("Expected language storage.");
  return value;
};

describe("plain function-language bridge", () => {
  it("inspects function shape without reading or materializing formals", () => {
    const node: FunctionExpressionNode = {
      ...syntax(),
      get parameters(): readonly FunctionParameter[] {
        throw new Error("Formal projection must not run for cheap shape queries.");
      },
    };
    const value = languageValue(node);
    expect(languageValueLength(value)).toBe(4);
    expect(languageValueNames(value)).toBeUndefined();
    const tagged = languageValue(syntax(), new Map(), "head");
    expect(languageValueLength(tagged)).toBe(4);
    expect(languageValueNames(tagged)).toEqual(["head", "", "", ""]);
  });

  it("projects missing, NULL, dots and reference defaults without evaluating them", () => {
    const owner = createEnvironment(null);
    const parameters: FunctionParameter[] = [
      { name: "missing", span },
      { name: "null", defaultValue: { kind: "NullLiteral", span }, span },
      { name: "...", span },
      {
        name: "forward",
        defaultValue: { kind: "UnsupportedExpression", feature: "dots", span },
        span,
      },
      { name: "owner", defaultValue: embeddedValueAst(owner), span },
    ];
    const projected = functionParametersValue(parameters, context());
    expect(projected.type).toBe("pairlist");
    if (projected.type !== "pairlist") throw new Error("Expected formal pairlist.");
    expect(projected.values.slice(0, 4)).toEqual([
      { type: "symbol", name: "" },
      R_NULL,
      { type: "symbol", name: "" },
      { type: "symbol", name: "..." },
    ]);
    expect(projected.values[4]).toBe(owner);
    expect(projected.attributes.get("names")).toMatchObject({
      values: ["missing", "null", "...", "forward", "owner"],
    });
    expect(functionParametersValue([], context())).toBe(R_NULL);
    expect(owner.bindings.size).toBe(0);
  });

  it("roundtrips executable bodies and default metadata without copying references", () => {
    const owner = createEnvironment(null);
    owner.bindings.set("payload", integerVector(new Int32Array(256)));
    const defaultNode = languageValue(call(literal(3)), new Map([["owner", owner]])).expression;
    const body = languageValue(call(literal(5)), new Map([["owner", owner]])).expression;
    const source = languageValue(syntax([{ name: "x", defaultValue: defaultNode, span }], body));
    const cells = materializeLanguageEntries(source, context())!;
    expect(cells.nodes).toHaveLength(4);
    expect(cells.nodes[2]).toBe(body);
    expect(quoteLanguageNode(cells.nodes[3]!)).toBe(R_NULL);
    const rebuilt = languageFromCallEntries(cells.nodes, cells.names, context());
    expect(rebuilt.expression.kind).toBe("FunctionExpression");
    if (rebuilt.expression.kind !== "FunctionExpression") throw new Error("Expected function.");
    expect(rebuilt.expression.parameters[0]?.defaultValue).toBe(defaultNode);
    expect(rebuilt.expression.body).toBe(body);
    expect(
      language(extractLanguageElement(rebuilt, integerVector([3]), context())).attributes.get(
        "owner",
      ),
    ).toBe(owner);
    const retained = censusRuntimeMemory([rebuilt], () => undefined);
    expect(retained.vectorCells).toBeGreaterThanOrEqual(128);
    expect(retained).toEqual(censusRuntimeMemory([rebuilt, owner], () => undefined));
  });

  it("retains explicit fourth-cell absence through metadata changes and nested extraction", () => {
    const owner = createEnvironment(null);
    const source = languageValue(syntax(), new Map([["owner", owner]]));
    const shorter = language(replaceLanguageElement(source, integerVector([4]), R_NULL, context()));
    expect(shorter.expression.kind).toBe("FunctionExpression");
    expect(languageValueLength(shorter)).toBe(3);
    expect(languageValueLength(source)).toBe(4);
    expect(shorter.attributes.get("owner")).toBe(owner);
    const cleared = languageValue(shorter.expression, new Map(), "");
    expect(cleared.attributes.size).toBe(0);
    expect(languageValueLength(cleared)).toBe(3);
    const outer = languageValue(call(embeddedValueAst(cleared)));
    const nested = language(extractLanguageElement(outer, integerVector([2]), context()));
    expect(languageValueLength(nested)).toBe(3);
    expect(materializeLanguageEntries(nested, context())?.nodes).toHaveLength(3);
    const plain = languageValue(syntax());
    expect(
      estimateRObjectSize(plain, () => undefined) - estimateRObjectSize(cleared, () => undefined),
    ).toBe(56);
  });

  it("keeps unadmitted function construction ordinary and rejects retained source explicitly", () => {
    const head: AstNode = { kind: "Identifier", name: "function", span };
    expect(
      languageFromCallEntries([head, literal(1), literal(2)], undefined, context()).expression.kind,
    ).toBe("CallExpression");
    const formals = embeddedValueAst(pairlistValue([integerVector([1])], ["x"]));
    expect(() =>
      languageFromCallEntries([head, formals, literal(2), literal(9)], undefined, context()),
    ).toThrowError(
      expect.objectContaining({
        code: "NRU6261",
        message: "Non-NULL function source cells require retained-source support.",
      }),
    );
    expect(
      languageValueLength(
        languageFromCallEntries([head, formals, literal(2)], undefined, context()),
      ),
    ).toBe(3);
  });

  it("reserves formal vectors before reading defaults and permits separate exact-cap cells", () => {
    const parameters: FunctionParameter[] = Array.from({ length: 33 }, (_, index) => ({
      name: `x${index}`,
      get defaultValue(): AstNode {
        throw new Error("Allocation must fail before reading defaults.");
      },
      span,
    }));
    const bounded = new EvaluationContext(
      { ...DEFAULT_RUNTIME_LIMITS, maxVectorLength: 32 },
      { cancelled: false },
    );
    expect(() =>
      materializeLanguageEntries(languageValue(syntax(parameters)), bounded),
    ).toThrowError(
      expect.objectContaining({ code: "NRL4002", details: { maxVectorLength: 32, requested: 33 } }),
    );
    const exact = new EvaluationContext(
      { ...DEFAULT_RUNTIME_LIMITS, maxVectorLength: 4 },
      { cancelled: false },
    );
    const cells = materializeLanguageEntries(
      languageValue(syntax(Array.from({ length: 4 }, (_, index) => ({ name: `x${index}`, span })))),
      exact,
    )!;
    expect(cells.nodes).toHaveLength(4);
    expect(quoteLanguageNode(cells.nodes[1]!)).toMatchObject({ type: "pairlist", length: 4 });
  });

  it("checks cancellation and work limits before conversion and supports a later bounded operation", () => {
    const source = languageValue(
      syntax(Array.from({ length: 100 }, (_, index) => ({ name: `x${index}`, span }))),
    );
    const cancelled = new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: true });
    expect(() => materializeLanguageEntries(source, cancelled)).toThrowError(
      expect.objectContaining({ code: "NRL4005" }),
    );
    const limited = new EvaluationContext(
      { ...DEFAULT_RUNTIME_LIMITS, maxSteps: 8 },
      { cancelled: false },
    );
    expect(() => materializeLanguageEntries(source, limited)).toThrowError(
      expect.objectContaining({ code: "NRL4001" }),
    );
    expect(materializeLanguageEntries(languageValue(syntax()), context())?.nodes).toHaveLength(4);
    expect(languageValueLength(source)).toBe(4);
  });

  it("projects and reconstructs deep unchanged default/body syntax without rendering it", () => {
    let node: AstNode = literal(1);
    for (let index = 0; index < 2_000; index += 1) node = call(node);
    const source = languageValue(syntax([{ name: "x", defaultValue: node, span }], node));
    const bounded = new EvaluationContext(
      { ...DEFAULT_RUNTIME_LIMITS, maxSteps: 64 },
      { cancelled: false },
    );
    const cells = materializeLanguageEntries(source, bounded)!;
    const rebuilt = languageFromCallEntries(cells.nodes, cells.names, bounded);
    if (rebuilt.expression.kind !== "FunctionExpression") throw new Error("Expected function.");
    expect(rebuilt.expression.body).toBe(node);
    expect(rebuilt.expression.parameters[0]?.defaultValue).toBe(node);
  });
});
