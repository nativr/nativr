import type { AstNode } from "@nativr/ast";

import { RTypeMismatchError } from "./errors.js";
import { embeddedValueAst, quoteLanguageNode } from "./language-subset.js";
import {
  extractListMember,
  extractVectorElement,
  replaceListMember,
  replaceVectorElement,
  replaceVectorSubset,
  subsetVector,
} from "./subset.js";
import {
  characterBytesFromValue,
  characterVector,
  expressionValue,
  integerVector,
  isMissing,
  listValue,
  vectorNames,
  withoutClasses,
} from "./values.js";
import type { OperatorContext, RExpression, RList, RValue } from "./values.js";

interface ExpressionEntries {
  readonly values: RList;
  readonly nodes: ReadonlyMap<RValue, AstNode>;
}

/** Select expression cells as syntax, preserving the selected names metadata. */
export function subsetExpression(
  target: RExpression,
  index: RValue | undefined,
  context: OperatorContext,
): RExpression {
  context.checkpoint();
  if (index === undefined) return withoutClasses(target);
  const entries = expressionEntries(target, context);
  const selected = subsetVector(entries.values, index, context);
  if (selected.type !== "list") throw new Error("Expression selection must remain list shaped.");
  return fromEntries(selected, entries.nodes, context);
}

/** Extract one quoted cell without evaluating its syntax or copying embedded references. */
export function extractExpressionElement(
  target: RExpression,
  index: RValue,
  context: OperatorContext,
  exact: boolean | null = true,
): RValue {
  return extractVectorElement(expressionEntries(target, context).values, index, context, exact);
}

/** Apply the existing unique partial member lookup to expression names. */
export function extractExpressionMember(
  target: RExpression,
  name: string,
  context: OperatorContext,
): RValue {
  return extractListMember(expressionEntries(target, context).values, name, context);
}

/** Replace expression cells using the shared list index and recycling rules. */
export function replaceExpressionSubset(
  target: RExpression,
  index: RValue | undefined,
  replacement: RValue,
  context: OperatorContext,
): RExpression {
  assertReplacementType(replacement, false, context);
  const entries = expressionEntries(target, context);
  const replacementEntries =
    replacement.type === "expression" ? expressionEntries(replacement, context) : undefined;
  const nodes = new Map(entries.nodes);
  if (replacementEntries !== undefined)
    for (const [value, node] of replacementEntries.nodes) nodes.set(value, node);
  preflightReplacement(target, index, context);
  const result = replaceVectorSubset(
    entries.values,
    index,
    replacementEntries?.values ?? replacement,
    context,
  );
  if (result.type !== "list") throw new Error("Expression replacement must remain list shaped.");
  return fromEntries(withReplacementMetadata(target, result), nodes, context);
}

/** Replace or delete one expression cell, retaining unrelated attributes. */
export function replaceExpressionElement(
  target: RExpression,
  index: RValue,
  replacement: RValue,
  context: OperatorContext,
): RExpression {
  assertReplacementType(replacement, true, context);
  const entries = expressionEntries(target, context);
  preflightReplacement(target, index, context, true);
  const result = replaceVectorElement(entries.values, index, replacement, context);
  if (result.type !== "list") throw new Error("Expression replacement must remain list shaped.");
  return fromEntries(withReplacementMetadata(target, result), entries.nodes, context);
}

/** Existing member replacement retains expression storage; appending uses list storage. */
export function replaceExpressionMember(
  target: RExpression,
  name: string | undefined,
  replacement: RValue,
  context: OperatorContext,
): RValue {
  context.checkpoint();
  const names = vectorNames(target);
  const attribute = target.attributes.get("names");
  let position = -1;
  if (name !== undefined && names !== undefined) {
    for (let index = 0; index < names.length; index += 1) {
      context.checkpoint();
      if (
        names[index] === name &&
        !(attribute?.type === "character" && isMissing(attribute, index))
      ) {
        position = index;
        break;
      }
    }
  }
  const existing = position >= 0;
  if (!existing && replacement.type === "null") return target;
  const entries = expressionEntries(target, context);
  context.allocate(target.length + (existing ? 0 : 1));
  let result = existing
    ? replaceVectorElement(entries.values, integerVector([position + 1]), replacement, context)
    : replaceListMember(entries.values, undefined, replacement, context);
  if (result.type !== "list") throw new Error("Expression member replacement must be list shaped.");
  if (!existing && name !== undefined) {
    const resultNames = result.attributes.get("names");
    if (resultNames?.type !== "character") throw new Error("Expression append must produce names.");
    const values = [...resultNames.values];
    values[values.length - 1] = name;
    const encodings = [...resultNames.encodings];
    const bytes = [...resultNames.byteValues];
    encodings[encodings.length - 1] = "unknown";
    bytes[bytes.length - 1] = characterBytesFromValue(name);
    const attributes = new Map(result.attributes);
    attributes.set("names", characterVector(values, resultNames.missing, encodings, bytes));
    result = { ...result, attributes };
  }
  let updated = withReplacementMetadata(target, result);
  if (!existing && !target.attributes.has("names")) {
    const resultNames = updated.attributes.get("names");
    if (resultNames !== undefined) {
      const attributes = new Map<string, RValue>([["names", resultNames]]);
      for (const [key, value] of updated.attributes) {
        context.checkpoint();
        if (key !== "names") attributes.set(key, value);
      }
      updated = { ...updated, attributes };
    }
  }
  return existing ? fromEntries(updated, entries.nodes, context) : updated;
}

function expressionEntries(target: RExpression, context: OperatorContext): ExpressionEntries {
  context.checkpoint();
  context.allocate(target.length);
  const nodes = new Map<RValue, AstNode>();
  const values = target.values.map((node) => {
    context.checkpoint();
    const value = quoteLanguageNode(node);
    nodes.set(value, node);
    return value;
  });
  // The adapter carries structural metadata only: classed expression storage is never a
  // data-frame list, and shared list operations must not select data-frame special paths.
  const attributes = new Map<string, RValue>();
  const names = target.attributes.get("names");
  if (names !== undefined) attributes.set("names", names);
  return { values: { ...listValue(values), attributes }, nodes };
}

function assertReplacementType(
  replacement: RValue,
  single: boolean,
  context: OperatorContext,
): void {
  context.checkpoint();
  if (single && replacement.type === "list") {
    throw new RTypeMismatchError(
      "NRT3396",
      "incompatible types (from expression to list) in [[ assignment",
    );
  }
  let incompatible: string | undefined;
  if (replacement.type === "environment" || replacement.type === "closure") {
    incompatible = replacement.type;
  } else if (single && replacement.type === "builtin") {
    if (replacement.definition.formals !== undefined) incompatible = "closure";
    else if (replacement.definition.kind !== "special") incompatible = "builtin";
  }
  if (incompatible !== undefined) {
    throw new RTypeMismatchError(
      "NRT3396",
      `incompatible types (from expression to ${incompatible}) in subassignment type fix`,
    );
  }
}

function fromEntries(
  source: RList,
  originals: ReadonlyMap<RValue, AstNode>,
  context: OperatorContext,
): RExpression {
  context.allocate(source.length);
  const values = source.values.map((value) => {
    context.checkpoint();
    return originals.get(value) ?? embeddedValueAst(value, () => context.checkpoint());
  });
  return expressionValue(values, source.attributes);
}

function withReplacementMetadata(target: RExpression, result: RList): RList {
  const attributes = new Map(target.attributes);
  if (result.length !== target.length) {
    attributes.delete("dim");
    attributes.delete("dimnames");
  }
  const names = result.attributes.get("names");
  if (names === undefined) attributes.delete("names");
  else attributes.set("names", names);
  return { ...result, attributes };
}

function preflightReplacement(
  target: RExpression,
  index: RValue | undefined,
  context: OperatorContext,
  single = false,
): void {
  // Shared list replacement builds its result before its final allocation accounting.
  // Reserve the result extent before an expression can request a large extension.
  let length = target.length;
  if (index?.type === "integer" || index?.type === "double") {
    for (let offset = 0; offset < index.length; offset += 1) {
      context.checkpoint();
      const position = index.values[offset] ?? 0;
      if (!isMissing(index, offset) && Number.isFinite(position) && position > length)
        length = Math.trunc(position);
    }
  } else if (index?.type === "logical") {
    length = Math.max(length, index.length);
  } else if (index?.type === "character") {
    const sourceNames = target.attributes.get("names");
    const available = new Set<string>();
    let singleNameMatched = false;
    const singleName = isMissing(index, 0) ? "NA" : (index.values[0] ?? "");
    if (sourceNames?.type === "character") {
      context.allocate(sourceNames.length);
      for (let offset = 0; offset < sourceNames.length; offset += 1) {
        context.checkpoint();
        const name = sourceNames.values[offset] ?? "";
        if (!isMissing(sourceNames, offset) && name !== "") available.add(name);
        if (
          single &&
          singleName !== "" &&
          (isMissing(sourceNames, offset) ? "NA" : name) === singleName
        )
          singleNameMatched = true;
      }
    }
    if (!singleNameMatched) {
      for (let offset = 0; offset < index.length; offset += 1) {
        context.checkpoint();
        const name = isMissing(index, offset) ? "" : (index.values[offset] ?? "");
        if (name === "" || !available.has(name)) {
          length += 1;
          if (name !== "") available.add(name);
        }
      }
    }
  }
  context.allocate(length);
}
