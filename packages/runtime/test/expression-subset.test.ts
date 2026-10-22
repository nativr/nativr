import type { AstNode } from "@nativr/ast";
import { describe, expect, it } from "vitest";

import { DEFAULT_RUNTIME_LIMITS, EvaluationContext } from "../src/context.js";
import { createEnvironment } from "../src/environment.js";
import {
  extractExpressionElement,
  replaceExpressionElement,
  replaceExpressionMember,
  replaceExpressionSubset,
  subsetExpression,
} from "../src/expression-subset.js";
import { censusRuntimeMemory, estimateRObjectSize } from "../src/memory.js";
import {
  R_NULL,
  characterVector,
  expressionValue,
  integerVector,
  isVector,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "../src/values.js";
import type { RValue } from "../src/values.js";

const span = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};
const literal = (value: number): AstNode => ({ kind: "IntegerLiteral", value, span });
const context = () => new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: false });

describe("expression storage and shared selection", () => {
  it("copies container metadata while retaining embedded value references", () => {
    const owner = createEnvironment(null);
    const node: AstNode = {
      kind: "ConstantExpression",
      value: owner,
      display: { kind: "Identifier", name: "owned", span },
      span,
    };
    const nodes: AstNode[] = [node];
    const attributes = new Map<string, RValue>([["owner", owner]]);
    const value = expressionValue(nodes, attributes);
    nodes.push(literal(2));
    attributes.clear();
    expect(value.length).toBe(1);
    expect(Object.isFrozen(value.values)).toBe(true);
    expect(value.values[0]).toBe(node);
    expect(value.attributes.get("owner")).toBe(owner);
    expect(isVector(value)).toBe(false);
    expect(extractExpressionElement(value, integerVector([1]), context())).toBe(owner);
  });

  it("preserves exact names encoding and missing masks while selecting original syntax", () => {
    const source = expressionValue(
      [literal(1), literal(2)],
      new Map([
        ["names", characterVector(["é", ""], [0, 1], ["latin1", "unknown"])],
        ["note", characterVector(["drop"])],
      ]),
    );
    const selected = subsetExpression(source, integerVector([2, 1, 1]), context());
    expect(selected.values).toEqual([source.values[1], source.values[0], source.values[0]]);
    expect(selected.values[0]).toBe(source.values[1]);
    expect([...selected.attributes.keys()]).toEqual(["names"]);
    expect(selected.attributes.get("names")).toEqual(
      characterVector(["", "é", "é"], [1, 0, 0], ["unknown", "latin1", "latin1"]),
    );
    expect(source.attributes.has("note")).toBe(true);
  });

  it("keeps dimensions and notes for an empty subscript while removing explicit class", () => {
    const source = withClasses(
      withAttribute(
        withDimensions(expressionValue([literal(1), literal(2)]), [1, 2]),
        "note",
        characterVector(["keep"]),
      ),
      ["owned"],
    );
    const selected = subsetExpression(source, undefined, context());
    expect(selected.attributes.has("class")).toBe(false);
    expect(selected.attributes.get("dim")).toBe(source.attributes.get("dim"));
    expect(selected.attributes.get("note")).toBe(source.attributes.get("note"));
    expect(source.attributes.has("class")).toBe(true);
    expect(subsetExpression(source, integerVector([1]), context()).attributes.size).toBe(0);
  });

  it("returns typed empty and missing-cell selections", () => {
    const source = withNames(expressionValue([literal(1)]), ["a"]);
    expect(subsetExpression(source, integerVector([]), context())).toMatchObject({
      type: "expression",
      length: 0,
    });
    const selected = subsetExpression(source, integerVector([0, 1], [1, 0]), context());
    expect(extractExpressionElement(selected, integerVector([1]), context())).toBe(R_NULL);
    expect(extractExpressionElement(selected, integerVector([2]), context())).toEqual(
      integerVector([1]),
    );
  });

  it("retains opaque replacement identity, metadata and the untouched source", () => {
    const owner = createEnvironment(null);
    const source = withAttribute(
      withNames(expressionValue([literal(1), literal(2)]), ["a", "b"]),
      "owner",
      owner,
    );
    const result = replaceExpressionMember(source, "a", owner, context());
    if (result.type !== "expression") throw new Error("Expected expression storage.");
    expect(extractExpressionElement(result, integerVector([1]), context())).toBe(owner);
    expect(result.attributes.get("owner")).toBe(owner);
    expect(extractExpressionElement(source, integerVector([1]), context())).toEqual(
      integerVector([1]),
    );
    const replacement = expressionValue([{ kind: "Identifier", name: "unbound", span }]);
    expect(
      replaceExpressionSubset(source, integerVector([2]), replacement, context()).values[1],
    ).toBe(replacement.values[0]);
  });

  it("drops dimensions on deletion and retains notes and expression storage", () => {
    const source = withAttribute(
      withDimensions(expressionValue([literal(1), literal(2)]), [1, 2]),
      "note",
      characterVector(["keep"]),
    );
    const sameLength = replaceExpressionElement(
      source,
      integerVector([1]),
      integerVector([7]),
      context(),
    );
    expect(sameLength.attributes.get("dim")).toBe(source.attributes.get("dim"));
    const removed = replaceExpressionElement(source, integerVector([1]), R_NULL, context());
    expect(removed.type).toBe("expression");
    expect(removed.length).toBe(1);
    expect([...removed.attributes.keys()]).toEqual(["note"]);
  });

  it("keeps existing named members as expressions and uses lists for append", () => {
    const source = withNames(expressionValue([literal(1)]), ["a"]);
    const owner = createEnvironment(null);
    const changed = replaceExpressionMember(source, "a", owner, context());
    expect(changed.type).toBe("expression");
    const appended = replaceExpressionMember(source, "b", owner, context());
    expect(appended.type).toBe("list");
    if (appended.type !== "list") throw new Error("Expected list storage.");
    expect(appended.values[1]).toBe(owner);
    expect(replaceExpressionMember(source, "absent", R_NULL, context())).toBe(source);
    expect(replaceExpressionMember(source, "a", R_NULL, context())).toMatchObject({
      type: "expression",
      length: 0,
    });
  });

  it("rejects extension before allocating a huge list and leaves the input usable", () => {
    const source = expressionValue([literal(1)]);
    const bounded = new EvaluationContext(
      { ...DEFAULT_RUNTIME_LIMITS, maxVectorLength: 8 },
      { cancelled: false },
    );
    expect(() =>
      replaceExpressionElement(source, integerVector([1_000_000_000]), integerVector([2]), bounded),
    ).toThrowError(expect.objectContaining({ code: "NRL4002" }));
    expect(source.length).toBe(1);
    expect(extractExpressionElement(source, integerVector([1]), context())).toEqual(
      integerVector([1]),
    );
  });

  it("places new member names before notes only when appending to list storage", () => {
    const source = withAttribute(
      expressionValue([literal(1), literal(2)]),
      "note",
      characterVector(["keep"]),
    );
    const member = replaceExpressionMember(source, "a", integerVector([3]), context());
    if (member.type !== "list") throw new Error("Expected list storage.");
    expect([...member.attributes.keys()]).toEqual(["names", "note"]);
    const element = replaceExpressionElement(
      source,
      characterVector(["a"]),
      integerVector([3]),
      context(),
    );
    expect([...element.attributes.keys()]).toEqual(["note", "names"]);
    expect([...source.attributes.keys()]).toEqual(["note"]);
  });

  it("allows an existing name at the vector limit but rejects a real extension", () => {
    const source = withNames(
      expressionValue(Array.from({ length: 8 }, (_, index) => literal(index))),
      Array.from({ length: 8 }, (_, index) => `owned${index}`),
    );
    const bounded = () =>
      new EvaluationContext(
        { ...DEFAULT_RUNTIME_LIMITS, maxVectorLength: 8 },
        { cancelled: false },
      );
    const same = replaceExpressionElement(
      source,
      characterVector(["owned7"]),
      integerVector([23]),
      bounded(),
    );
    expect(same.length).toBe(8);
    expect(extractExpressionElement(same, integerVector([8]), context())).toEqual(
      integerVector([23]),
    );
    expect(
      replaceExpressionSubset(
        source,
        characterVector(["owned7", "owned7"]),
        integerVector([4]),
        bounded(),
      ).length,
    ).toBe(8);
    expect(() =>
      replaceExpressionElement(source, characterVector(["new"]), integerVector([4]), bounded()),
    ).toThrowError(expect.objectContaining({ code: "NRL4002" }));
    expect(extractExpressionElement(source, integerVector([8]), context())).toEqual(
      integerVector([7]),
    );
  });

  it("checks cancellation before quoting cells or returning an empty subscript", () => {
    const stopped = new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: true });
    const source = expressionValue([literal(1)]);
    expect(() => subsetExpression(source, undefined, stopped)).toThrowError(
      expect.objectContaining({ code: "NRL4005" }),
    );
    expect(() => extractExpressionElement(source, integerVector([1]), stopped)).toThrowError(
      expect.objectContaining({ code: "NRL4005" }),
    );
  });

  it("accounts for expression attributes and terminates on an attributed environment cycle", () => {
    const bare = expressionValue([literal(1)]);
    const note = withAttribute(bare, "note", integerVector(new Int32Array(128)));
    expect(estimateRObjectSize(note, () => undefined)).toBeGreaterThan(
      estimateRObjectSize(bare, () => undefined),
    );
    const owner = createEnvironment(null);
    const cyclic = withAttribute(bare, "owner", owner);
    owner.bindings.set("value", cyclic);
    expect(censusRuntimeMemory([cyclic], () => undefined).nodeCells).toBeGreaterThan(1);
    expect(censusRuntimeMemory([note], () => undefined).vectorCells).toBeGreaterThan(
      censusRuntimeMemory([bare], () => undefined).vectorCells,
    );
  });

  it("counts objects retained only through expression cells once, including environment cycles", () => {
    const owner = createEnvironment(null);
    owner.bindings.set("payload", integerVector(new Int32Array(256)));
    const node: AstNode = {
      kind: "ConstantExpression",
      value: owner,
      display: { kind: "Identifier", name: "owned", span },
      span,
    };
    const value = expressionValue([node, node]);
    owner.bindings.set("cycle", value);
    const census = censusRuntimeMemory([value], () => undefined);
    expect(census.vectorCells).toBeGreaterThanOrEqual(128);
    expect(census).toEqual(censusRuntimeMemory([value, owner], () => undefined));
  });

  it("walks long embedded-expression chains iteratively and checkpoints traversal", () => {
    let value = expressionValue([literal(1)]);
    for (let index = 0; index < 2_000; index += 1) {
      value = expressionValue([
        {
          kind: "ConstantExpression",
          value,
          display: { kind: "Identifier", name: "owned", span },
          span,
        },
      ]);
    }
    let checkpoints = 0;
    const census = censusRuntimeMemory([value], () => {
      checkpoints += 1;
    });
    expect(census.nodeCells).toBe(2_001);
    expect(checkpoints).toBeGreaterThan(30);
  });
});
