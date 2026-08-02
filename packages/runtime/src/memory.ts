import type { AstNode, CallArgument, FunctionParameter } from "@nativr/ast";
import type { RAttributes, RBinding, RCharacterVector, RPromise, RValue } from "./values.js";

/** Browser-owned memory represented in GNU R's two reporting cell families. */
export interface RuntimeMemoryCensus {
  readonly nodeCells: number;
  readonly vectorCells: number;
}

const SEXP_HEADER_BYTES = 48;
const NODE_BYTES = 56;

/**
 * Estimate one NativR object's attributable bytes using GNU R's documented 64-bit object model.
 * This is intentionally an R-object estimate, not a measurement of the host JavaScript heap.
 * Environment bindings and closure environments are excluded; repeated list children are counted
 * repeatedly, while equal strings share storage only inside the same character vector.
 */
export function estimateRObjectSize(value: RValue, checkpoint: () => void): number {
  const active = new WeakSet<object>();
  let visits = 0;

  const accountVisit = (): void => {
    visits += 1;
    if (visits % 64 === 1) checkpoint();
  };

  const vectorPayloadBytes = (bytes: number): number => {
    if (bytes === 0) return 0;
    if (bytes <= 8) return 8;
    if (bytes <= 16) return 16;
    if (bytes <= 32) return 32;
    if (bytes <= 48) return 48;
    if (bytes <= 64) return 64;
    if (bytes <= 128) return 128;
    return Math.ceil(bytes / 8) * 8;
  };

  const atomicVectorBytes = (length: number, bytesPerElement: number): number =>
    SEXP_HEADER_BYTES + vectorPayloadBytes(length * bytesPerElement);

  const utf8ByteLength = (text: string): number => {
    const Encoder = (
      globalThis as unknown as {
        readonly TextEncoder: new () => { readonly encode: (input: string) => Uint8Array };
      }
    ).TextEncoder;
    return new Encoder().encode(text).byteLength;
  };

  const characterScalarBytes = (text: string): number =>
    atomicVectorBytes(1, 8) + SEXP_HEADER_BYTES + vectorPayloadBytes(utf8ByteLength(text) + 1);

  const characterBytes = (vector: RCharacterVector): number => {
    let bytes = atomicVectorBytes(vector.length, 8);
    const strings = new Set<string>();
    for (let index = 0; index < vector.length; index += 1) {
      accountVisit();
      if (vector.missing?.[index] === 1) continue;
      const encoding = vector.encodings[index] ?? "unknown";
      const text = vector.values[index] ?? "";
      const key = `${encoding}\u0000${text}`;
      if (strings.has(key)) continue;
      strings.add(key);
      bytes +=
        SEXP_HEADER_BYTES + vectorPayloadBytes((vector.byteValues[index]?.byteLength ?? 0) + 1);
    }
    return bytes;
  };

  const attributeBytes = (
    attributes: RAttributes,
    omittedNames: ReadonlySet<string> = new Set(),
  ): number => {
    let bytes = 0;
    for (const [name, attribute] of attributes) {
      accountVisit();
      if (omittedNames.has(name)) continue;
      bytes += NODE_BYTES + NODE_BYTES + visitValue(attribute);
    }
    return bytes;
  };

  const taggedPairlistBytes = (
    values: readonly RValue[],
    names: readonly string[] | undefined,
  ): number => {
    let bytes = 0;
    for (let index = 0; index < values.length; index += 1) {
      accountVisit();
      bytes += NODE_BYTES + visitValue(values[index]!);
      if ((names?.[index] ?? "") !== "") bytes += NODE_BYTES;
    }
    return bytes;
  };

  const parameterBytes = (parameters: readonly FunctionParameter[]): number => {
    let bytes = 0;
    for (const parameter of parameters) {
      accountVisit();
      bytes += NODE_BYTES + NODE_BYTES;
      bytes += parameter.defaultValue === undefined ? NODE_BYTES : visitAst(parameter.defaultValue);
    }
    return bytes;
  };

  const languageCallBytes = (callee: AstNode, arguments_: readonly CallArgument[]): number => {
    let bytes = NODE_BYTES * (arguments_.length + 1) + visitAst(callee);
    for (const argument of arguments_) {
      bytes += visitAst(argument.value);
      if ((argument.name ?? "") !== "") bytes += NODE_BYTES;
    }
    return bytes;
  };

  const syntheticCallBytes = (
    operator: string,
    values: readonly AstNode[],
    names: readonly (string | undefined)[] = [],
  ): number => {
    let bytes = NODE_BYTES * (values.length + 1) + NODE_BYTES;
    for (let index = 0; index < values.length; index += 1) {
      bytes += visitAst(values[index]!);
      if ((names[index] ?? "") !== "") bytes += NODE_BYTES;
    }
    return bytes;
  };

  const visitAst = (node: AstNode): number => {
    accountVisit();
    switch (node.kind) {
      case "Program":
        return (
          atomicVectorBytes(node.body.length, 8) +
          node.body.reduce((n, item) => n + visitAst(item), 0)
        );
      case "Block":
        return syntheticCallBytes("{", node.body);
      case "Identifier":
      case "UnsupportedExpression":
      case "BreakExpression":
      case "NextExpression":
        return NODE_BYTES;
      case "DoubleLiteral":
      case "IntegerLiteral":
      case "LogicalLiteral":
        return atomicVectorBytes(1, node.kind === "DoubleLiteral" ? 8 : 4);
      case "ComplexLiteral":
        return atomicVectorBytes(1, 16);
      case "StringLiteral":
        return characterScalarBytes(node.value);
      case "NullLiteral":
        return 0;
      case "MissingLiteral":
        return atomicVectorBytes(
          1,
          node.declaredType === "complex"
            ? 16
            : node.declaredType === "double"
              ? 8
              : node.declaredType === "character"
                ? 8
                : 4,
        );
      case "UnaryExpression":
        return syntheticCallBytes(node.operator, [node.operand]);
      case "BinaryExpression":
        return syntheticCallBytes(node.operator, [node.left, node.right]);
      case "AssignmentExpression":
      case "ReplacementExpression":
        return syntheticCallBytes(node.operator, [node.target, node.value]);
      case "CallExpression":
        return languageCallBytes(node.callee, node.arguments);
      case "FunctionExpression":
        return NODE_BYTES * 3 + NODE_BYTES + parameterBytes(node.parameters) + visitAst(node.body);
      case "IfExpression":
        return syntheticCallBytes(
          "if",
          node.alternative === undefined
            ? [node.condition, node.consequence]
            : [node.condition, node.consequence, node.alternative],
        );
      case "ForExpression":
        return syntheticCallBytes("for", [node.variable, node.sequence, node.body]);
      case "WhileExpression":
        return syntheticCallBytes("while", [node.condition, node.body]);
      case "RepeatExpression":
        return syntheticCallBytes("repeat", [node.body]);
      case "ReturnExpression":
        return syntheticCallBytes("return", node.value === undefined ? [] : [node.value]);
      case "SubsetExpression":
        return syntheticCallBytes(
          node.operator,
          [node.target, ...node.arguments.map((argument) => argument.value)],
          [undefined, ...node.arguments.map((argument) => argument.name)],
        );
      case "NamespaceExpression":
        return syntheticCallBytes(node.operator, [node.namespace, node.member]);
      case "FormulaExpression":
        return syntheticCallBytes(
          "~",
          node.left === undefined ? [node.right] : [node.left, node.right],
        );
      case "PipeExpression":
        return syntheticCallBytes(node.operator, [node.left, node.right]);
    }
  };

  const visitValue = (item: RValue): number => {
    accountVisit();
    if (item.type === "null") return 0;
    if (active.has(item)) return 0;
    active.add(item);
    try {
      switch (item.type) {
        case "logical":
        case "integer":
          return atomicVectorBytes(item.length, 4) + attributeBytes(item.attributes);
        case "double":
          return atomicVectorBytes(item.length, 8) + attributeBytes(item.attributes);
        case "complex":
          return atomicVectorBytes(item.length, 16) + attributeBytes(item.attributes);
        case "raw":
          return atomicVectorBytes(item.length, 1) + attributeBytes(item.attributes);
        case "character":
          return characterBytes(item) + attributeBytes(item.attributes);
        case "list": {
          let bytes = atomicVectorBytes(item.length, 8);
          for (const child of item.values) bytes += visitValue(child);
          for (const [name, attribute] of item.attributes) {
            accountVisit();
            bytes += NODE_BYTES + NODE_BYTES;
            bytes +=
              name === "row.names" && item.automaticRowNames
                ? atomicVectorBytes(2, 4)
                : visitValue(attribute);
          }
          return bytes;
        }
        case "pairlist": {
          const names = item.attributes.get("names");
          const tags = names?.type === "character" ? names.values : undefined;
          return (
            taggedPairlistBytes(item.values, tags) +
            attributeBytes(item.attributes, new Set(["names"]))
          );
        }
        case "environment":
        case "builtin":
        case "symbol":
        case "dots":
          return NODE_BYTES;
        case "closure":
          return NODE_BYTES + parameterBytes(item.parameters) + visitAst(item.body);
        case "language":
          return visitAst(item.expression);
        case "expression":
          return (
            atomicVectorBytes(item.values.length, 8) +
            item.values.reduce((n, node) => n + visitAst(node), 0)
          );
        case "formula": {
          const termNodes: AstNode[] = item.terms.map((name) => ({
            kind: "Identifier",
            name,
            span: {
              start: { offset: 0, line: 1, column: 1 },
              end: { offset: 0, line: 1, column: 1 },
            },
          }));
          let right =
            termNodes[0] ??
            ({
              kind: "DoubleLiteral",
              value: 1,
              span: {
                start: { offset: 0, line: 1, column: 1 },
                end: { offset: 0, line: 1, column: 1 },
              },
            } satisfies AstNode);
          for (const term of termNodes.slice(1)) {
            right = {
              kind: "BinaryExpression",
              operator: "+",
              left: right,
              right: term,
              span: right.span,
            };
          }
          const response =
            item.response === undefined
              ? undefined
              : ({ kind: "Identifier", name: item.response, span: right.span } satisfies AstNode);
          let bytes = syntheticCallBytes("~", response === undefined ? [right] : [response, right]);
          bytes += NODE_BYTES + NODE_BYTES + characterScalarBytes("formula");
          if (item.environment !== null) bytes += NODE_BYTES + NODE_BYTES + NODE_BYTES;
          return bytes;
        }
      }
    } finally {
      active.delete(item);
    }
  };

  return visitValue(value);
}

const RUNTIME_OBJECT_TYPES = new Set([
  "builtin",
  "character",
  "closure",
  "complex",
  "dots",
  "double",
  "environment",
  "expression",
  "formula",
  "integer",
  "language",
  "list",
  "logical",
  "null",
  "pairlist",
  "promise",
  "raw",
  "symbol",
]);

/**
 * Count the reachable NativR value graph without consulting or pretending to control the host heap.
 * A node cell is one runtime object or binding/attribute link. Vector cells are eight-byte units of
 * owned payload storage, matching the unit used by gc() rather than JavaScript engine heap bytes.
 */
export function censusRuntimeMemory(
  roots: readonly unknown[],
  checkpoint: () => void,
): RuntimeMemoryCensus {
  const seen = new WeakSet<object>();
  let nodeCells = 0;
  let vectorBytes = 0;
  let visits = 0;

  const accountVisit = (): void => {
    visits += 1;
    if (visits % 64 === 1) checkpoint();
  };

  const textBytes = (value: string): number => {
    const Encoder = (
      globalThis as unknown as {
        readonly TextEncoder: new () => { readonly encode: (input: string) => Uint8Array };
      }
    ).TextEncoder;
    return new Encoder().encode(value).byteLength;
  };

  const visitAttributes = (attributes: RAttributes): void => {
    for (const [name, value] of attributes) {
      nodeCells += 1;
      vectorBytes += 8 + textBytes(name);
      visitValue(value);
    }
  };

  const visitPromise = (promise: RPromise): void => {
    if (seen.has(promise)) return;
    accountVisit();
    seen.add(promise);
    nodeCells += 1;
    visitValue(promise.environment);
    if (promise.value !== undefined) visitValue(promise.value);
  };

  const visitBinding = (binding: RBinding): void => {
    if (binding.type === "promise") visitPromise(binding);
    else visitValue(binding);
  };

  const visitValue = (value: RValue): void => {
    if (seen.has(value)) return;
    accountVisit();
    seen.add(value);
    nodeCells += 1;

    switch (value.type) {
      case "null":
      case "builtin":
      case "language":
        return;
      case "logical":
      case "integer":
      case "double":
        vectorBytes += value.values.byteLength + (value.missing?.byteLength ?? 0);
        visitAttributes(value.attributes);
        return;
      case "raw":
        vectorBytes += value.values.byteLength;
        visitAttributes(value.attributes);
        return;
      case "complex":
        vectorBytes +=
          value.real.byteLength + value.imaginary.byteLength + (value.missing?.byteLength ?? 0);
        visitAttributes(value.attributes);
        return;
      case "character":
        vectorBytes +=
          value.length * 8 +
          value.byteValues.reduce((total, bytes) => total + bytes.byteLength, 0) +
          (value.missing?.byteLength ?? 0);
        visitAttributes(value.attributes);
        return;
      case "list":
      case "pairlist":
        vectorBytes += value.length * 8 + (value.missing?.byteLength ?? 0);
        for (const entry of value.values) visitValue(entry);
        visitAttributes(value.attributes);
        return;
      case "environment":
        if (value.parent !== null) visitValue(value.parent);
        for (const [name, binding] of value.bindings) {
          nodeCells += 1;
          vectorBytes += 8 + textBytes(name);
          visitBinding(binding);
        }
        return;
      case "closure":
        visitValue(value.environment);
        return;
      case "formula":
        vectorBytes +=
          (value.response === undefined ? 0 : textBytes(value.response)) +
          value.terms.reduce((total, term) => total + 8 + textBytes(term), 0) +
          value.variables.reduce((total, variable) => total + 8 + textBytes(variable), 0);
        if (value.environment !== null) visitValue(value.environment);
        return;
      case "symbol":
        vectorBytes += textBytes(value.name);
        return;
      case "expression":
        vectorBytes += value.values.length * 8;
        return;
      case "dots":
        vectorBytes += value.arguments.length * 8;
        for (const argument of value.arguments) visitPromise(argument.promise);
        return;
    }
  };

  const visitUnknown = (value: unknown): void => {
    if (typeof value !== "object" || value === null || ArrayBuffer.isView(value)) return;
    if (seen.has(value)) return;
    accountVisit();
    if ("type" in value && typeof value.type === "string" && RUNTIME_OBJECT_TYPES.has(value.type)) {
      if (value.type === "promise") visitPromise(value as RPromise);
      else visitValue(value as RValue);
      return;
    }
    seen.add(value);
    if (value instanceof Map || value instanceof Set) {
      for (const entry of value.values()) visitUnknown(entry);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visitUnknown(entry);
      return;
    }
    for (const entry of Object.values(value)) visitUnknown(entry);
  };

  for (const root of roots) visitUnknown(root);
  return Object.freeze({ nodeCells, vectorCells: Math.ceil(vectorBytes / 8) });
}
