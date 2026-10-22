import type { AstNode } from "@nativr/ast";
import { describe, expect, it } from "vitest";

import { DEFAULT_RUNTIME_LIMITS, EvaluationContext } from "../src/context.js";
import { createEnvironment } from "../src/environment.js";
import { quoteLanguageNode } from "../src/language-subset.js";
import { prepareListMemberTarget, replaceListMember } from "../src/subset.js";
import {
  R_NULL,
  characterVector,
  complexVector,
  doubleVector,
  integerVector,
  isMissing,
  listValue,
  logicalVector,
  pairlistValue,
  rawVector,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "../src/values.js";
import type { RBuiltin, RClosure, RValue } from "../src/values.js";

const span = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};
const context = () => new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: false });
const prepare = (value: RValue) => prepareListMemberTarget(value, context(), quoteLanguageNode);

describe("default member replacement storage", () => {
  it("coerces every atomic storage type into scalar list values without attaching source classes", () => {
    const values = [
      logicalVector([true, false]),
      integerVector([1, 2]),
      doubleVector([1.25, 2.5]),
      complexVector([1, 2], [3, 4]),
      characterVector(["one", "two"]),
      rawVector([10, 20]),
    ];
    for (const value of values) {
      const source = withAttribute(
        withClasses(withNames(value, ["a", "b"]), ["owned"]),
        "note",
        characterVector(["drop"]),
      );
      const result = prepare(source);
      expect(result.coercedAtomic).toBe(true);
      expect(result.target.type).toBe("list");
      expect(vectorNames(result.target)).toEqual(["a", "b"]);
      expect([...result.target.attributes.keys()]).toEqual(["names"]);
      expect(result.target.values.map((item) => item.type)).toEqual([value.type, value.type]);
      for (const item of result.target.values) {
        expect("length" in item && item.length).toBe(1);
        expect("attributes" in item && item.attributes.size).toBe(0);
      }
      expect(source.attributes.has("class")).toBe(true);
      expect(source.attributes.has("note")).toBe(true);
    }
  });

  it("retains missing values, character encoding, and exact names metadata during atomic coercion", () => {
    const names = characterVector(["", "b"], [1, 0]);
    const source = withAttribute(
      characterVector(["", "é"], [1, 0], ["unknown", "latin1"]),
      "names",
      names,
    );
    const result = prepare(source).target;
    expect(result.attributes.get("names")).toBe(names);
    expect(result.values[0]?.type).toBe("character");
    expect(result.values[1]?.type).toBe("character");
    if (result.values[0]?.type !== "character" || result.values[1]?.type !== "character")
      throw new Error("Expected character scalars.");
    expect(isMissing(result.values[0], 0)).toBe(true);
    expect(result.values[1].encodings?.[0]).toBe("latin1");
    expect(result.values[1].values).toEqual(["é"]);
  });

  it("quotes expression elements without evaluating them or changing embedded reference identity", () => {
    const environment = createEnvironment(null);
    const nodes: readonly AstNode[] = [
      { kind: "Identifier", name: "unbound", span },
      { kind: "IntegerLiteral", value: 2, span },
      {
        kind: "ConstantExpression",
        value: environment,
        display: { kind: "Identifier", name: "owned", span },
        span,
      },
    ];
    const result = prepare({ type: "expression", values: nodes });
    expect(result.coercedAtomic).toBe(false);
    expect(result.target.values[0]).toEqual({ type: "symbol", name: "unbound" });
    expect(result.target.values[1]).toEqual(integerVector([2]));
    expect(result.target.values[2]).toBe(environment);
  });

  it("returns existing list and pairlist targets unchanged before replacement", () => {
    for (const value of [listValue([integerVector([1])]), pairlistValue([integerVector([1])])]) {
      expect(prepare(value)).toEqual({ target: value, coercedAtomic: false });
      expect(prepare(value).target).toBe(value);
    }
  });

  it("appends an omitted member after existing unnamed entries and leaves omitted deletion unchanged", () => {
    for (const construct of [listValue, pairlistValue]) {
      const source = construct([integerVector([1]), integerVector([2])]);
      const result = replaceListMember(source, undefined, integerVector([3]), context());
      if (result.type !== "list" && result.type !== "pairlist")
        throw new Error("Expected list-shaped storage.");
      expect(result.values).toEqual([...source.values, integerVector([3])]);
      expect(vectorNames(result)).toEqual(["", "", ""]);
      expect(replaceListMember(source, undefined, R_NULL, context())).toBe(source);
      expect(source.attributes.has("names")).toBe(false);
    }
  });

  it("replaces or deletes only the first exact duplicate and preserves referenced values", () => {
    const environment = createEnvironment(null);
    const source = listValue(
      [integerVector([1]), environment, integerVector([3])],
      ["a", "a", "alpha"],
    );
    const replaced = replaceListMember(source, "a", environment, context());
    const deleted = replaceListMember(source, "a", R_NULL, context());
    const appended = replaceListMember(source, "al", environment, context());
    if (replaced.type !== "list" || deleted.type !== "list" || appended.type !== "list")
      throw new Error("Expected lists.");
    expect(replaced.values[0]).toBe(environment);
    expect(replaced.values[1]).toBe(environment);
    expect(deleted.values[0]).toBe(environment);
    expect(vectorNames(deleted)).toEqual(["a", "alpha"]);
    expect(vectorNames(appended)).toEqual(["a", "a", "alpha", "al"]);
    expect(source.values[0]).toEqual(integerVector([1]));
  });

  it("retains list dimensions on replacement and drops them on length-changing updates", () => {
    const source = withAttribute(
      withAttribute(
        withDimensions(listValue([integerVector([1]), integerVector([2])], ["a", "b"]), [2, 1]),
        "dimnames",
        listValue([characterVector(["r1", "r2"]), characterVector(["c"])]),
      ),
      "note",
      characterVector(["keep"]),
    );
    const same = replaceListMember(source, "a", integerVector([3]), context());
    expect(same.type === "list" && same.attributes.get("dim")).toBe(source.attributes.get("dim"));
    for (const result of [
      replaceListMember(source, "c", integerVector([3]), context()),
      replaceListMember(source, "a", R_NULL, context()),
    ]) {
      if (result.type !== "list") throw new Error("Expected list.");
      expect(result.attributes.has("dim")).toBe(false);
      expect(result.attributes.has("dimnames")).toBe(false);
      expect(result.attributes.get("note")).toBe(source.attributes.get("note"));
    }
  });

  it("preserves pairlist attributes when its member count changes, and deletes the final pairlist cell to NULL", () => {
    const source = withAttribute(
      withDimensions(pairlistValue([integerVector([1]), integerVector([2])], ["a", "b"]), [2, 1]),
      "note",
      characterVector(["keep"]),
    );
    for (const result of [
      replaceListMember(source, "c", integerVector([3]), context()),
      replaceListMember(source, "a", R_NULL, context()),
    ]) {
      if (result.type !== "pairlist") throw new Error("Expected pairlist.");
      expect(result.attributes.get("dim")).toBe(source.attributes.get("dim"));
      expect(result.attributes.get("note")).toBe(source.attributes.get("note"));
    }
    expect(
      replaceListMember(pairlistValue([integerVector([1])], ["a"]), "a", R_NULL, context()),
    ).toBe(R_NULL);
  });

  it("reports ordinary R callable and symbol type names for unsupported targets", () => {
    const closure: RClosure = {
      type: "closure",
      parameters: [],
      body: { kind: "NullLiteral", span },
      environment: createEnvironment(null),
      attributes: new Map(),
    };
    const builtin = (kind: "regular" | "special", formals?: []): RBuiltin => ({
      type: "builtin",
      definition: {
        package: "base",
        name: "owned",
        kind,
        ...(formals === undefined ? {} : { formals }),
        metadata: {
          package: "base",
          name: "owned",
          compatibilityLevel: "api",
          supportedArguments: [],
        },
        implementation: () => R_NULL,
      },
    });
    for (const [value, type] of [
      [{ type: "symbol", name: "x" }, "symbol"],
      [closure, "closure"],
      [builtin("regular"), "builtin"],
      [builtin("special"), "special"],
      [builtin("regular", []), "closure"],
    ] as const) {
      expect(() => prepare(value)).toThrow(`object of type '${type}' is not subsettable`);
    }
  });

  it("checks vector limits before expansion and cancellation before preparation", () => {
    const limited = new EvaluationContext(
      { ...DEFAULT_RUNTIME_LIMITS, maxVectorLength: 2 },
      { cancelled: false },
    );
    expect(() =>
      prepareListMemberTarget(integerVector([1, 2, 3]), limited, quoteLanguageNode),
    ).toThrow("Vector length limit exceeded.");
    const cancelled = new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: true });
    expect(() => prepareListMemberTarget(integerVector([]), cancelled, quoteLanguageNode)).toThrow(
      "Evaluation was interrupted.",
    );
  });
});
