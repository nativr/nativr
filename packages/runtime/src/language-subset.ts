import type { AstNode, CallArgument, FunctionParameter, SourceSpan } from "@nativr/ast";

import { languageValueEntries, languageValueLength, languageValueNames } from "./language.js";
import { withFunctionSourceCellPresence } from "./language-metadata.js";
import { RResourceLimitError, RTypeMismatchError, RUnsupportedFeatureError } from "./errors.js";
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
  languageValue,
  listValue,
  logicalVector,
  missingValue,
  pairlistValue,
  vectorNames,
} from "./values.js";
import type {
  OperatorContext,
  RAttributes,
  RLanguage,
  RList,
  RNull,
  RPairlist,
  RValue,
} from "./values.js";

const SYNTHETIC_SPAN: SourceSpan = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

interface LanguageEntries {
  readonly values: RList;
  readonly originalNodes: ReadonlyMap<RValue, AstNode>;
}

/** Project stored formal defaults without evaluating them or rendering their syntax. */
export function functionParametersValue(
  parameters: readonly FunctionParameter[],
  context: OperatorContext,
): RPairlist | RNull {
  context.checkpoint();
  if (parameters.length === 0) return R_NULL;
  context.allocate(parameters.length);
  const values: RValue[] = [];
  const names: string[] = [];
  for (const parameter of parameters) {
    context.checkpoint();
    values.push(
      parameter.defaultValue === undefined
        ? { type: "symbol", name: "" }
        : parameter.defaultValue.kind === "UnsupportedExpression" &&
            parameter.defaultValue.feature === "dots"
          ? { type: "symbol", name: "..." }
          : quoteLanguageNode(parameter.defaultValue),
    );
    names.push(parameter.name);
  }
  return pairlistValue(values, names);
}

/** Materialize function cells only on value-conversion paths with an allocation context. */
export function materializeLanguageEntries(
  value: RLanguage,
  context: OperatorContext,
): { readonly nodes: readonly AstNode[]; readonly names?: readonly string[] } | undefined {
  context.checkpoint();
  const expression = value.expression;
  if (expression.kind !== "FunctionExpression") return languageValueEntries(value);
  const length = languageValueLength(value);
  context.allocate(length);
  const formals = functionParametersValue(expression.parameters, context);
  const formalNode: AstNode =
    formals.type === "null"
      ? { kind: "NullLiteral", span: SYNTHETIC_SPAN }
      : {
          kind: "ConstantExpression",
          value: formals,
          // Preserve a shallow display tree without recursively formatting defaults.
          display: callAst(
            "pairlist",
            expression.parameters.map((parameter) => {
              context.checkpoint();
              return callArgument(
                parameter.defaultValue ?? {
                  kind: "UnsupportedExpression",
                  feature: "missing argument",
                  span: parameter.span,
                },
                parameter.name,
              );
            }),
          ),
          span: SYNTHETIC_SPAN,
        };
  const nodes: AstNode[] = [
    { kind: "Identifier", name: "function", span: SYNTHETIC_SPAN },
    formalNode,
    expression.body,
  ];
  if (length === 4) nodes.push({ kind: "NullLiteral", span: SYNTHETIC_SPAN });
  const names = languageValueNames(value);
  return { nodes, ...(names === undefined ? {} : { names }) };
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
  preflightLanguageReplacement(entries.values, index, context);
  const updated = replaceVectorSubset(entries.values, index, replacement, context);
  if (updated.type !== "list") throw new Error("Language replacement must remain list shaped.");
  return languageFromValues(updated, entries.originalNodes, context, target.attributes);
}

/** Replace or remove one call element. */
export function replaceLanguageElement(
  target: RLanguage,
  index: RValue,
  replacement: RValue,
  context: OperatorContext,
): RValue {
  const entries = languageEntries(target, context);
  if (replacement.type === "null") {
    // Element deletion cannot grow the result. Avoid a huge temporary names extension for
    // a valid out-of-range numeric no-op; all other indices keep the shared diagnostics.
    if (
      (index.type === "integer" || index.type === "double") &&
      index.length === 1 &&
      !isMissing(index, 0) &&
      Number.isFinite(index.values[0]) &&
      Math.trunc(index.values[0]!) > entries.values.length
    )
      return target;
  } else preflightLanguageReplacement(entries.values, index, context);
  const updated = replaceVectorElement(entries.values, index, replacement, context);
  if (updated.type !== "list") throw new Error("Language replacement must remain list shaped.");
  return languageFromValues(updated, entries.originalNodes, context, target.attributes);
}

/** Replace or append one named call argument. */
export function replaceLanguageMember(
  target: RLanguage,
  name: string | undefined,
  replacement: RValue,
  context: OperatorContext,
): RValue {
  const entries = languageEntries(target, context);
  const existing = name !== undefined && name !== "" && vectorNames(entries.values)?.includes(name);
  context.allocate(entries.values.length + (existing || replacement.type === "null" ? 0 : 1));
  const updated = replaceListMember(entries.values, name, replacement, context);
  if (updated.type !== "list") throw new Error("Language replacement must remain list shaped.");
  return languageFromValues(updated, entries.originalNodes, context, target.attributes);
}

/** Set structural call tags while leaving ordinary attributes and child values intact. */
export function replaceLanguageNames(
  target: RLanguage,
  names: readonly string[] | undefined,
  context: OperatorContext,
): RLanguage {
  context.checkpoint();
  const entries = languageValueEntries(target);
  if (entries === undefined)
    throw new RTypeMismatchError("NRT3198", "names() applied to unsupported language syntax");
  if (names !== undefined && names.length > entries.nodes.length)
    throw new RTypeMismatchError(
      "NRT3199",
      `'names' attribute [${names.length}] must be the same length as the vector [${entries.nodes.length}]`,
    );
  context.allocate(entries.nodes.length);
  return languageFromCallEntries(entries.nodes, names, context, target.attributes);
}

function languageEntries(target: RLanguage, context: OperatorContext): LanguageEntries {
  context.checkpoint();
  const source = materializeLanguageEntries(target, context);
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
  attributes: RAttributes = new Map(),
): RValue {
  if (values.length === 0) return R_NULL;
  context.allocate(values.length);
  const nodes = values.values.map((value) => {
    context.checkpoint();
    return originalNodes.get(value) ?? embeddedValueAst(value, () => context.checkpoint());
  });
  const names = vectorNames(values);
  return languageFromCallEntries(nodes, names, context, attributes);
}

/** Rebuild admitted call cells while preserving executable function syntax and shared bodies. */
export function languageFromCallEntries(
  nodes: readonly AstNode[],
  names: readonly string[] | undefined,
  context: OperatorContext,
  attributes: RAttributes = new Map(),
  headTag = names?.[0] ?? "",
): RLanguage {
  context.checkpoint();
  if (nodes.length === 0) throw new RTypeMismatchError("NRT3208", "invalid length 0 argument");
  context.allocate(nodes.length);
  const head = nodes[0] as AstNode;
  if (
    head.kind === "Identifier" &&
    head.name === "function" &&
    (nodes.length === 3 || nodes.length === 4) &&
    !names?.slice(1).some((name) => name !== "")
  ) {
    const parameters = functionParametersFromNode(nodes[1]!, context);
    if (parameters !== undefined) {
      const sourceCell = nodes[3];
      if (
        sourceCell !== undefined &&
        sourceCell.kind !== "NullLiteral" &&
        !(sourceCell.kind === "ConstantExpression" && (sourceCell.value as RValue).type === "null")
      )
        throw new RUnsupportedFeatureError(
          "NRU6261",
          "Non-NULL function source cells require retained-source support.",
        );
      return languageValue(
        withFunctionSourceCellPresence(
          {
            kind: "FunctionExpression",
            parameters,
            body: nodes[2]!,
            span: SYNTHETIC_SPAN,
          },
          nodes.length === 4,
        ),
        attributes,
        headTag,
      );
    }
  }
  if (
    head.kind === "Identifier" &&
    (head.name === "[" || head.name === "[[" || head.name === "$" || head.name === "@") &&
    nodes.length >= 2
  ) {
    const arguments_ = nodes.slice(2).map((value, index) => {
      context.checkpoint();
      return callArgument(value, names?.[index + 2]);
    });
    return languageValue(
      {
        kind: "SubsetExpression",
        operator: head.name,
        target: nodes[1] as AstNode,
        arguments: arguments_,
        span: SYNTHETIC_SPAN,
      },
      attributes,
      headTag,
    );
  }
  return languageValue(
    {
      kind: "CallExpression",
      callee: head,
      arguments: nodes.slice(1).map((value, index) => {
        context.checkpoint();
        return callArgument(value, names?.[index + 1]);
      }),
      span: SYNTHETIC_SPAN,
    },
    attributes,
    headTag,
  );
}

function functionParametersFromNode(
  node: AstNode,
  context: OperatorContext,
): readonly FunctionParameter[] | undefined {
  const value =
    node.kind === "NullLiteral"
      ? R_NULL
      : node.kind === "ConstantExpression"
        ? (node.value as RValue)
        : undefined;
  if (value?.type === "null") return Object.freeze([]);
  if (value?.type !== "pairlist") return undefined;
  const names = value.attributes.get("names");
  if (
    names?.type !== "character" ||
    names.length !== value.length ||
    [...value.attributes.keys()].some((name) => name !== "names")
  )
    return undefined;
  context.allocate(value.length);
  const seenNames = new Set<string>();
  const parameters: FunctionParameter[] = [];
  for (let index = 0; index < value.length; index += 1) {
    context.checkpoint();
    const name = names.values[index] ?? "";
    if (isMissing(names, index) || name === "" || seenNames.has(name)) return undefined;
    seenNames.add(name);
    const entry = value.values[index]!;
    parameters.push({
      name,
      ...(entry.type === "symbol" && entry.name === ""
        ? {}
        : { defaultValue: embeddedValueAst(entry, () => context.checkpoint()) }),
      span: SYNTHETIC_SPAN,
    });
  }
  return Object.freeze(parameters);
}

function preflightLanguageReplacement(
  target: RList,
  index: RValue | undefined,
  context: OperatorContext,
): void {
  // Shared list replacement allocates after constructing its result. Bound extensions first.
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
    const available = new Set(vectorNames(target)?.filter((name) => name !== "") ?? []);
    for (let offset = 0; offset < index.length; offset += 1) {
      context.checkpoint();
      const name = isMissing(index, offset) ? "" : (index.values[offset] ?? "");
      if (name === "" || !available.has(name)) {
        length += 1;
        if (name !== "") available.add(name);
      }
    }
  }
  context.allocate(length);
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
        : languageValue(node);
    default:
      return languageValue(node);
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
