import type { AstNode } from "@nativr/ast";
import { describe, expect, it } from "vitest";

import { DEFAULT_RUNTIME_LIMITS, EvaluationContext } from "../src/context.js";
import { createEnvironment, createPromise } from "../src/environment.js";
import { deparseAst, languageValueEntries } from "../src/language.js";
import {
  embeddedValueAst,
  extractLanguageElement,
  quoteLanguageNode,
  replaceLanguageElement,
  replaceLanguageMember,
  replaceLanguageNames,
  replaceLanguageSubset,
  subsetLanguage,
} from "../src/language-subset.js";
import { censusRuntimeMemory, estimateRObjectSize } from "../src/memory.js";
import {
  R_NULL,
  characterVector,
  expressionValue,
  integerVector,
  languageValue,
  listValue,
} from "../src/values.js";
import type { RClosure, RLanguage, RPromise, RValue } from "../src/values.js";

const span = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 1, line: 1, column: 2 },
};
const literal = (value: number): AstNode => ({ kind: "IntegerLiteral", value, span });
const call = (value: AstNode = literal(1)): AstNode => ({
  kind: "CallExpression",
  callee: { kind: "Identifier", name: "owned", span },
  arguments: [{ name: "a", value, span }],
  span,
});
const context = () => new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: false });
const language = (value: RValue): RLanguage => {
  if (value.type !== "language") throw new Error("Expected language storage.");
  return value;
};

describe("language metadata and executable syntax", () => {
  it("keeps bare syntax fast and copies attributed roots without mutating aliases", () => {
    const node = call();
    expect(languageValue(node).expression).toBe(node);
    const owner = createEnvironment(null);
    const attributes = new Map<string, RValue>([["owner", owner]]);
    const value = languageValue(node, attributes, "head");
    attributes.clear();
    expect(value.expression).not.toBe(node);
    expect(value.attributes.get("owner")).toBe(owner);
    expect(languageValue(node).attributes.size).toBe(0);
    expect(languageValue(node).headTag).toBeUndefined();
    const restored = language(quoteLanguageNode(embeddedValueAst(value)));
    expect(restored.expression).toBe(value.expression);
    expect(restored.attributes).toBe(value.attributes);
    expect(restored.headTag).toBe("head");
    const cleared = languageValue(value.expression, new Map(), "");
    expect(cleared.attributes.size).toBe(0);
    expect(cleared.headTag).toBeUndefined();
    expect(language(quoteLanguageNode(cleared.expression)).attributes.size).toBe(0);
    expect(value.attributes.get("owner")).toBe(owner);
  });

  it("keeps head tags out of ordinary attributes and changes only structural names", () => {
    const note = characterVector(["keep"]);
    const source = languageValue(call(), new Map([["note", note]]));
    const renamed = replaceLanguageNames(source, ["head", "renamed"], context());
    expect(languageValueEntries(renamed)?.names).toEqual(["head", "renamed"]);
    expect(deparseAst(renamed.expression)).toBe("owned(renamed = 1L)");
    expect([...renamed.attributes.keys()]).toEqual(["note"]);
    expect(renamed.attributes.get("note")).toBe(note);
    expect(languageValueEntries(source)?.names).toEqual(["", "a"]);
    const cleared = replaceLanguageNames(renamed, undefined, context());
    expect(languageValueEntries(cleared)?.names).toBeUndefined();
    expect(cleared.attributes.get("note")).toBe(note);
    const selected = language(subsetLanguage(renamed, undefined, context()));
    expect(languageValueEntries(selected)?.names).toEqual(["head", "renamed"]);
    expect(selected.attributes.size).toBe(0);
  });

  it("retains child attributes on executable nodes through extraction and replacement", () => {
    const owner = createEnvironment(null);
    const child = languageValue(
      { kind: "BinaryExpression", operator: "+", left: literal(1), right: literal(2), span },
      new Map([["owner", owner]]),
    );
    const syntax = embeddedValueAst(child);
    expect(syntax.kind).toBe("BinaryExpression");
    const parentNote = characterVector(["parent"]);
    const parent = languageValue(call(syntax), new Map([["note", parentNote]]));
    const extracted = language(extractLanguageElement(parent, integerVector([2]), context()));
    expect(extracted.attributes.get("owner")).toBe(owner);
    expect(extracted.attributes.has("note")).toBe(false);
    const replaced = language(replaceLanguageElement(parent, integerVector([2]), child, context()));
    expect(replaced.attributes.get("note")).toBe(parentNote);
    expect(
      language(extractLanguageElement(replaced, integerVector([2]), context())).expression,
    ).toBe(child.expression);
    const subsetReplaced = language(
      replaceLanguageSubset(parent, integerVector([2]), listValue([child]), context()),
    );
    expect(subsetReplaced.attributes.get("note")).toBe(parentNote);
    expect(
      language(
        extractLanguageElement(subsetReplaced, integerVector([2]), context()),
      ).attributes.get("owner"),
    ).toBe(owner);
  });

  it("preserves ordinary metadata and tags during deletion and named append", () => {
    const note = characterVector(["keep"]);
    const source = languageValue(call(), new Map([["note", note]]), "head");
    const removed = language(replaceLanguageElement(source, integerVector([2]), R_NULL, context()));
    expect(languageValueEntries(removed)?.names).toEqual(["head"]);
    expect(removed.attributes.get("note")).toBe(note);
    const appended = language(replaceLanguageMember(source, "b", integerVector([2]), context()));
    expect(languageValueEntries(appended)?.names).toEqual(["head", "a", "b"]);
    expect(appended.attributes.get("note")).toBe(note);
    expect(languageValueEntries(source)?.nodes.length).toBe(2);
  });

  it("bounds extensions before shared replacement allocation and permits exact-cap updates", () => {
    const source = languageValue(call());
    const bounded = () =>
      new EvaluationContext(
        { ...DEFAULT_RUNTIME_LIMITS, maxVectorLength: 2 },
        { cancelled: false },
      );
    expect(
      languageValueEntries(
        language(replaceLanguageMember(source, "a", integerVector([9]), bounded())),
      )?.nodes.length,
    ).toBe(2);
    expect(() =>
      replaceLanguageElement(source, integerVector([1_000_000_000]), integerVector([2]), bounded()),
    ).toThrowError(
      expect.objectContaining({
        code: "NRL4002",
        details: { maxVectorLength: 2, requested: 1_000_000_000 },
      }),
    );
    expect(() => replaceLanguageMember(source, "b", integerVector([2]), bounded())).toThrowError(
      expect.objectContaining({ code: "NRL4002" }),
    );
    expect(extractLanguageElement(source, integerVector([2]), context())).toEqual(
      integerVector([1]),
    );
  });

  it("checks cancellation before quoting cells or rebuilding tags", () => {
    const stopped = new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: true });
    const source = languageValue(call());
    expect(() => extractLanguageElement(source, integerVector([2]), stopped)).toThrowError(
      expect.objectContaining({ code: "NRL4005" }),
    );
    expect(() => replaceLanguageNames(source, undefined, stopped)).toThrowError(
      expect.objectContaining({ code: "NRL4005" }),
    );
  });

  it("does not reserve growth for absent element deletion at the exact vector cap", () => {
    const note = createEnvironment(null);
    const source = languageValue(call(), new Map([["note", note]]), "head");
    const bounded = () =>
      new EvaluationContext(
        { ...DEFAULT_RUNTIME_LIMITS, maxVectorLength: 2 },
        { cancelled: false },
      );
    expect(replaceLanguageElement(source, integerVector([1_000_000_000]), R_NULL, bounded())).toBe(
      source,
    );
    const absent = language(
      replaceLanguageElement(source, characterVector(["absent"]), R_NULL, bounded()),
    );
    expect(languageValueEntries(absent)?.names).toEqual(["head", "a"]);
    expect(absent.attributes.get("note")).toBe(note);
    expect(deparseAst(absent.expression)).toBe(deparseAst(source.expression));
    const removed = language(replaceLanguageElement(source, integerVector([2]), R_NULL, bounded()));
    expect(languageValueEntries(removed)?.nodes.length).toBe(1);
    expect(languageValueEntries(removed)?.names).toEqual(["head"]);
    expect(removed.attributes.get("note")).toBe(note);
    expect(languageValueEntries(source)?.nodes.length).toBe(2);
  });

  it("counts ordinary root and nested attributes once in the object-size estimate", () => {
    const note = integerVector(new Int32Array(128));
    const bare = languageValue(call());
    const attributed = languageValue(bare.expression, new Map([["note", note]]));
    const size = (value: RValue) => estimateRObjectSize(value, () => undefined);
    const delta = 112 + size(note);
    expect(size(attributed) - size(bare)).toBe(delta);
    expect(
      size(languageValue(call(attributed.expression))) - size(languageValue(call(bare.expression))),
    ).toBe(delta);
    expect(size(language(quoteLanguageNode(attributed.expression)))).toBe(size(attributed));
  });

  it("retains attribute-only and constant-cell environments without duplicate graph traversal", () => {
    const owner = createEnvironment(null);
    owner.bindings.set("payload", integerVector(new Int32Array(256)));
    const child = languageValue(call(embeddedValueAst(owner)), new Map([["owner", owner]]));
    const outer = languageValue(call(child.expression));
    owner.bindings.set("cycle", outer);
    const census = censusRuntimeMemory([outer], () => undefined);
    expect(census.vectorCells).toBeGreaterThanOrEqual(128);
    expect(census).toEqual(censusRuntimeMemory([outer, owner], () => undefined));
    const expression = expressionValue([outer.expression, outer.expression]);
    expect(censusRuntimeMemory([expression], () => undefined).vectorCells).toBeGreaterThanOrEqual(
      128,
    );
  });

  it("walks long attributed language chains iteratively and bounds recursive size estimates", () => {
    let value = languageValue(call());
    for (let index = 0; index < 2_000; index += 1)
      value = languageValue(call(value.expression), new Map([["index", integerVector([index])]]));
    let checkpoints = 0;
    const census = censusRuntimeMemory([value], () => {
      checkpoints += 1;
    });
    expect(census.nodeCells).toBeGreaterThanOrEqual(4_001);
    expect(checkpoints).toBeGreaterThan(30);
    expect(() => estimateRObjectSize(value, () => undefined)).toThrowError(
      expect.objectContaining({ code: "NRL4004" }),
    );
    const stopped = new EvaluationContext(
      { ...DEFAULT_RUNTIME_LIMITS, maxSteps: 3 },
      { cancelled: false },
    );
    expect(() => censusRuntimeMemory([value], () => stopped.checkpoint())).toThrowError(
      expect.objectContaining({ code: "NRL4001" }),
    );
    expect(estimateRObjectSize(languageValue(call()), () => undefined)).toBeGreaterThan(0);
  });

  it.each(["body", "default", "promise", "substitution"] as const)(
    "retains syntax-only references through %s without evaluating them",
    (route) => {
      const environment = createEnvironment(null);
      const attributeOwner = createEnvironment(null);
      const cellOwner = createEnvironment(null);
      attributeOwner.bindings.set("payload", integerVector(new Int32Array(256)));
      cellOwner.bindings.set("payload", integerVector(new Int32Array(512)));
      const syntax = languageValue(
        call(embeddedValueAst(cellOwner)),
        new Map([["owner", attributeOwner]]),
      ).expression;
      let root: RClosure | RPromise;
      if (route === "body" || route === "default") {
        root = {
          type: "closure",
          parameters: route === "default" ? [{ name: "x", defaultValue: syntax, span }] : [],
          body: route === "body" ? syntax : literal(1),
          environment,
          attributes: new Map(),
        };
      } else if (route === "promise") {
        root = createPromise(syntax, environment);
      } else {
        root = {
          type: "promise",
          expression: null,
          sourceExpression: syntax,
          environment,
          missing: false,
          state: "forced",
          value: integerVector([9]),
        };
      }
      attributeOwner.bindings.set("cycle", root);
      const census = censusRuntimeMemory([root], () => undefined);
      expect(census.vectorCells).toBeGreaterThanOrEqual(384);
      expect(census).toEqual(
        censusRuntimeMemory([root, attributeOwner, cellOwner], () => undefined),
      );
      if (root.type === "promise") {
        expect(root.state).toBe(route === "promise" ? "unforced" : "forced");
        expect(root.value).toEqual(route === "promise" ? undefined : integerVector([9]));
      }
    },
  );
});
