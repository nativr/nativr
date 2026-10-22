import type { AstNode, CallArgument, SourceSpan } from "@nativr/ast";

import { languageAstEntries } from "./language.js";
import { RResourceLimitError } from "./errors.js";
import {
  extractListMember,
  extractVectorElement,
  replaceListMember,
  replaceVectorElement,
  replaceVectorSubset,
  subsetVector,
} from "./subset.js";
import {
  R_NULL,
  characterLiteralValue,
  characterBytesAt,
  characterEncodingAt,
  complexVector,
  doubleVector,
  integerVector,
  isAtomic,
  isMissing,
  listValue,
  logicalVector,
  missingValue,
  vectorNames,
} from "./values.js";
import type { OperatorContext, RLanguage, RList, RValue } from "./values.js";

const SYNTHETIC_SPAN: SourceSpan = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

interface LanguageEntries {
  readonly values: RList;
  readonly originalNodes: ReadonlyMap<RValue, AstNode>;
}

/** Select language-call elements while retaining a call result for `[`. */
export function subsetLanguage(
  target: RLanguage,
  index: RValue | undefined,
  context: OperatorContext,
): RValue {
  const entries = languageEntries(target, context);
  const selected = subsetVector(entries.values, index, context);
  if (selected.type !== "list") throw new Error("Language selection must remain list shaped.");
  return languageFromValues(selected, entries.originalNodes, context);
}

/** Extract one quoted call element for `[[`. */
export function extractLanguageElement(
  target: RLanguage,
  index: RValue,
  context: OperatorContext,
  exact: boolean | null = true,
): RValue {
  return extractVectorElement(languageEntries(target, context).values, index, context, exact);
}

/** Apply `$` name lookup to the ordinary named arguments of a call. */
export function extractLanguageMember(
  target: RLanguage,
  name: string,
  context: OperatorContext,
): RValue {
  return extractListMember(languageEntries(target, context).values, name, context);
}

/** Replace selected call elements without evaluating their syntax. */
export function replaceLanguageSubset(
  target: RLanguage,
  index: RValue | undefined,
  replacement: RValue,
  context: OperatorContext,
): RValue {
  const entries = languageEntries(target, context);
  const updated = replaceVectorSubset(entries.values, index, replacement, context);
  if (updated.type !== "list") throw new Error("Language replacement must remain list shaped.");
  return languageFromValues(updated, entries.originalNodes, context);
}

/** Replace or remove one call element. */
export function replaceLanguageElement(
  target: RLanguage,
  index: RValue,
  replacement: RValue,
  context: OperatorContext,
): RValue {
  const entries = languageEntries(target, context);
  const updated = replaceVectorElement(entries.values, index, replacement, context);
  if (updated.type !== "list") throw new Error("Language replacement must remain list shaped.");
  return languageFromValues(updated, entries.originalNodes, context);
}

/** Replace or append one named call argument. */
export function replaceLanguageMember(
  target: RLanguage,
  name: string | undefined,
  replacement: RValue,
  context: OperatorContext,
): RValue {
  const entries = languageEntries(target, context);
  const updated = replaceListMember(entries.values, name, replacement, context);
  if (updated.type !== "list") throw new Error("Language replacement must remain list shaped.");
  return languageFromValues(updated, entries.originalNodes, context);
}

function languageEntries(target: RLanguage, context: OperatorContext): LanguageEntries {
  const source = languageAstEntries(target.expression);
  const nodes = source?.nodes ?? [target.expression];
  context.allocate(nodes.length);
  const values = nodes.map((node) => {
    context.checkpoint();
    return quoteLanguageNode(node);
  });
  const originalNodes = new Map<RValue, AstNode>();
  for (const [index, value] of values.entries()) originalNodes.set(value, nodes[index] as AstNode);
  return {
    values: listValue(values, source?.names),
    originalNodes,
  };
}

function languageFromValues(
  values: RList,
  originalNodes: ReadonlyMap<RValue, AstNode>,
  context: OperatorContext,
): RValue {
  if (values.length === 0) return R_NULL;
  context.allocate(values.length);
  const nodes = values.values.map((value) => {
    context.checkpoint();
    return originalNodes.get(value) ?? embeddedValueAst(value, () => context.checkpoint());
  });
  const names = vectorNames(values);
  const head = nodes[0] as AstNode;
  if (
    head.kind === "Identifier" &&
    (head.name === "[" || head.name === "[[" || head.name === "$" || head.name === "@") &&
    nodes.length >= 2
  ) {
    const arguments_ = nodes
      .slice(2)
      .map((value, index) => callArgument(value, names?.[index + 2]));
    return {
      type: "language",
      expression: {
        kind: "SubsetExpression",
        operator: head.name,
        target: nodes[1] as AstNode,
        arguments: arguments_,
        span: SYNTHETIC_SPAN,
      },
    };
  }
  return {
    type: "language",
    expression: {
      kind: "CallExpression",
      callee: head,
      arguments: nodes.slice(1).map((value, index) => callArgument(value, names?.[index + 1])),
      span: SYNTHETIC_SPAN,
    },
  };
}

function callArgument(value: AstNode, name: string | undefined): CallArgument {
  return {
    ...(name === undefined || name.length === 0 ? {} : { name }),
    value,
    span: value.span,
  };
}

/** Preserve the value shape of syntax stored inside a language call. */
export function quoteLanguageNode(node: AstNode): RValue {
  switch (node.kind) {
    case "ConstantExpression":
      return node.value as RValue;
    case "Identifier":
      return { type: "symbol", name: node.name };
    case "DoubleLiteral":
      return doubleVector([node.value]);
    case "IntegerLiteral":
      return integerVector([node.value]);
    case "ComplexLiteral":
      return complexVector([0], [node.imaginary]);
    case "StringLiteral":
      return characterLiteralValue(node);
    case "LogicalLiteral":
      return logicalVector([node.value]);
    case "NullLiteral":
      return R_NULL;
    case "MissingLiteral":
      return missingValue(node.declaredType);
    case "UnsupportedExpression":
      return node.feature === "missing argument"
        ? { type: "symbol", name: "" }
        : { type: "language", expression: node };
    default:
      return { type: "language", expression: node };
  }
}

/** Keep an already computed R value in language syntax without re-evaluating it. */
export function embeddedValueAst(value: RValue, checkWork?: () => void): AstNode {
  if (value.type === "symbol") {
    if (value.name === "") {
      return { kind: "UnsupportedExpression", feature: "missing argument", span: SYNTHETIC_SPAN };
    }
    return { kind: "Identifier", name: value.name, span: SYNTHETIC_SPAN };
  }
  if (value.type === "language") return value.expression;
  if (value.type === "null") return { kind: "NullLiteral", span: SYNTHETIC_SPAN };
  return {
    kind: "ConstantExpression",
    value,
    display: displayValueAst(value, checkWork, 0),
    span: SYNTHETIC_SPAN,
  };
}

/** Function syntax omits value attributes, retaining names that fit ordinary argument tags. */
export function displayValueWithoutAttributes(value: RValue, checkWork?: () => void): AstNode {
  return displayValueAst(value, checkWork, 0, false);
}

function displayValueAst(
  value: RValue,
  checkWork: (() => void) | undefined,
  depth: number,
  includeAttributes = true,
): AstNode {
  if (depth > 512)
    throw new RResourceLimitError("NRL4004", "Maximum value deparse depth exceeded.");
  checkWork?.();
  let display = displayStorageAst(value, checkWork, depth, includeAttributes);
  if (includeAttributes && value.type === "closure" && value.attributes.size > 0) {
    // Keep the value itself intact; only its display has an attribute-free function operand.
    const bare: AstNode = {
      kind: "ConstantExpression",
      value: { ...value, attributes: new Map() },
      display,
      span: SYNTHETIC_SPAN,
    };
    return callAst("structure", [
      callArgument(bare, undefined),
      ...Array.from(value.attributes, ([name, attribute]) => {
        checkWork?.();
        return callArgument(displayValueAst(attribute, checkWork, depth + 1), name);
      }),
    ]);
  }
  if (!isAtomic(value) && value.type !== "list" && value.type !== "pairlist") return display;
  const names = value.attributes.get("names");
  const canNameArguments =
    names?.type === "character" &&
    names.length === value.length &&
    !names.missing?.some(Boolean) &&
    names.values.some((name) => name.length > 0) &&
    (display.kind !== "BinaryExpression" || display.operator !== ":");
  if (canNameArguments && names?.type === "character") {
    if (isAtomic(value) && (value.length === 1 || display.kind !== "CallExpression")) {
      display = callAst("c", [callArgument(display, names.values[0])]);
    } else if (display.kind === "CallExpression") {
      display = {
        ...display,
        arguments: display.arguments.map((argument, index) =>
          callArgument(argument.value, names.values[index]),
        ),
      };
    }
  }
  if (!includeAttributes) return display;
  const attributes: CallArgument[] = [];
  for (const [name, attribute] of value.attributes) {
    checkWork?.();
    if (name === "names" && canNameArguments) continue;
    attributes.push(callArgument(displayValueAst(attribute, checkWork, depth + 1), name));
  }
  return attributes.length === 0
    ? display
    : callAst("structure", [callArgument(display, undefined), ...attributes]);
}

function displayStorageAst(
  value: RValue,
  checkWork: (() => void) | undefined,
  depth: number,
  includeAttributes: boolean,
): AstNode {
  if (value.type === "null") return { kind: "NullLiteral", span: SYNTHETIC_SPAN };
  if (value.type === "symbol")
    return { kind: "Identifier", name: value.name, span: SYNTHETIC_SPAN };
  if (value.type === "language") return value.expression;
  if (isAtomic(value)) {
    if (value.type === "integer" && value.length > 1) {
      const first = value.values[0] ?? 0;
      const step = (value.values[1] ?? 0) - first;
      if (
        Math.abs(step) === 1 &&
        value.values.every((element, index) => {
          checkWork?.();
          return !isMissing(value, index) && element === first + index * step;
        })
      ) {
        return {
          kind: "BinaryExpression",
          operator: ":",
          left: { kind: "DoubleLiteral", value: first, span: SYNTHETIC_SPAN },
          right: {
            kind: "DoubleLiteral",
            value: value.values[value.length - 1] ?? 0,
            span: SYNTHETIC_SPAN,
          },
          span: SYNTHETIC_SPAN,
        };
      }
    }
    const untypedCharacterNA =
      value.type === "character" && value.values.some((_, index) => !isMissing(value, index));
    const elements = Array.from({ length: value.length }, (_, index): AstNode => {
      checkWork?.();
      if (isMissing(value, index)) {
        return {
          kind: "MissingLiteral",
          declaredType: value.type === "raw" || untypedCharacterNA ? "logical" : value.type,
          span: SYNTHETIC_SPAN,
        };
      }
      switch (value.type) {
        case "logical":
          return { kind: "LogicalLiteral", value: value.values[index] === 1, span: SYNTHETIC_SPAN };
        case "integer":
          return { kind: "IntegerLiteral", value: value.values[index] ?? 0, span: SYNTHETIC_SPAN };
        case "double":
          return { kind: "DoubleLiteral", value: value.values[index] ?? 0, span: SYNTHETIC_SPAN };
        case "character":
          return {
            kind: "StringLiteral",
            value: value.values[index] ?? "",
            bytes: Array.from(characterBytesAt(value, index)),
            encoding: characterEncodingAt(value, index),
            span: SYNTHETIC_SPAN,
          };
        case "complex":
          return {
            kind: "BinaryExpression",
            operator: "+",
            left: { kind: "DoubleLiteral", value: value.real[index] ?? 0, span: SYNTHETIC_SPAN },
            right: {
              kind: "ComplexLiteral",
              imaginary: value.imaginary[index] ?? 0,
              span: SYNTHETIC_SPAN,
            },
            span: SYNTHETIC_SPAN,
          };
        case "raw":
          return callAst("as.raw", [
            callArgument(
              { kind: "IntegerLiteral", value: value.values[index] ?? 0, span: SYNTHETIC_SPAN },
              undefined,
            ),
          ]);
      }
    });
    if (elements.length === 0)
      return callAst(value.type === "double" ? "numeric" : value.type, [
        callArgument({ kind: "DoubleLiteral", value: 0, span: SYNTHETIC_SPAN }, undefined),
      ]);
    if (elements.length === 1) return elements[0] as AstNode;
    return callAst(
      "c",
      elements.map((element) => callArgument(element, undefined)),
    );
  }
  if (value.type === "list" || value.type === "pairlist") {
    return callAst(
      value.type === "list" ? "list" : "pairlist",
      value.values.map((entry) => {
        const display = displayValueAst(entry, checkWork, depth + 1, includeAttributes);
        const embedded: AstNode =
          entry.type === "language" || entry.type === "symbol"
            ? display
            : {
                kind: "ConstantExpression",
                value: entry,
                display,
                span: SYNTHETIC_SPAN,
              };
        return callArgument(embedded, undefined);
      }),
    );
  }
  // GNU R deparses an embedded closure from its formals and body, and a builtin as .Primitive().
  if (value.type === "closure") {
    return {
      kind: "FunctionExpression",
      parameters: value.parameters,
      body: value.body,
      span: SYNTHETIC_SPAN,
    };
  }
  if (value.type === "builtin") {
    return callAst(".Primitive", [
      callArgument(
        { kind: "StringLiteral", value: value.definition.name, span: SYNTHETIC_SPAN },
        undefined,
      ),
    ]);
  }
  return { kind: "UnsupportedExpression", feature: `embedded ${value.type}`, span: SYNTHETIC_SPAN };
}

function callAst(name: string, arguments_: readonly CallArgument[]): AstNode {
  return {
    kind: "CallExpression",
    callee: { kind: "Identifier", name, span: SYNTHETIC_SPAN },
    arguments: arguments_,
    span: SYNTHETIC_SPAN,
  };
}
