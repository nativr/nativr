import type {
  AstNode,
  CallArgument,
  Diagnostic,
  FunctionParameter,
  IdentifierNode,
  ProgramNode,
  SourceSpan,
} from "@nativr/ast";
import type { Node } from "web-tree-sitter";

import { Utf8SourceMap } from "./source-map.js";

/** Normalize a Tree-sitter R concrete tree without leaking its node model. */
export function normalizeProgram(
  root: Node,
  source: string,
): { readonly ast: ProgramNode; readonly diagnostics: readonly Diagnostic[] } {
  const mapper = new Utf8SourceMap(source);
  const diagnostics = collectSyntaxDiagnostics(root, mapper, source.length);
  const body: AstNode[] = [];

  for (const child of root.namedChildren) {
    if (child.type !== "comment" && !child.hasError && !child.isError && !child.isMissing) {
      body.push(normalizeNode(child, mapper));
    }
  }

  return {
    ast: { kind: "Program", body, span: mapper.span(root.startIndex, root.endIndex) },
    diagnostics,
  };
}

function normalizeNode(node: Node, mapper: Utf8SourceMap): AstNode {
  const span = mapper.span(node.startIndex, node.endIndex);
  switch (node.type) {
    case "float":
      return { kind: "DoubleLiteral", value: Number(node.text), span };
    case "integer": {
      const value = Number(node.text.replace(/[Ll]$/u, ""));
      return { kind: "IntegerLiteral", value, span };
    }
    case "inf":
      return { kind: "DoubleLiteral", value: Number.POSITIVE_INFINITY, span };
    case "nan":
      return { kind: "DoubleLiteral", value: Number.NaN, span };
    case "complex":
      return {
        kind: "ComplexLiteral",
        imaginary: Number(node.text.slice(0, -1)),
        span,
      };
    case "true":
      return { kind: "LogicalLiteral", value: true, span };
    case "false":
      return { kind: "LogicalLiteral", value: false, span };
    case "null":
      return { kind: "NullLiteral", span };
    case "na":
      return {
        kind: "MissingLiteral",
        declaredType: missingType(node.text),
        span,
      };
    case "identifier":
      return { kind: "Identifier", name: decodeRIdentifier(node.text), span };
    case "string":
      return { kind: "StringLiteral", value: decodeRString(node.text), span };
    case "parenthesized_expression":
      return normalizeNode(requiredField(node, "body"), mapper);
    case "braced_expression":
      return {
        kind: "Block",
        body: node.childrenForFieldName("body").map((child) => normalizeNode(child, mapper)),
        span,
      };
    case "unary_operator":
      return normalizeUnary(node, mapper, span);
    case "binary_operator":
      return normalizeBinary(node, mapper, span);
    case "call":
      return normalizeCall(node, mapper, span);
    case "function_definition":
      return normalizeFunction(node, mapper, span);
    case "if_statement":
      return normalizeIf(node, mapper, span);
    case "for_statement":
      return {
        kind: "ForExpression",
        variable: normalizeIdentifier(requiredField(node, "variable"), mapper),
        sequence: normalizeNode(requiredField(node, "sequence"), mapper),
        body: normalizeNode(requiredField(node, "body"), mapper),
        span,
      };
    case "while_statement":
      return {
        kind: "WhileExpression",
        condition: normalizeNode(requiredField(node, "condition"), mapper),
        body: normalizeNode(requiredField(node, "body"), mapper),
        span,
      };
    case "repeat_statement":
      return {
        kind: "RepeatExpression",
        body: normalizeNode(requiredField(node, "body"), mapper),
        span,
      };
    case "break":
      return { kind: "BreakExpression", span };
    case "next":
      return { kind: "NextExpression", span };
    case "subset":
    case "subset2":
      return {
        kind: "SubsetExpression",
        operator: node.type === "subset" ? "[" : "[[",
        target: normalizeNode(requiredField(node, "function"), mapper),
        arguments: normalizeArguments(requiredField(node, "arguments"), mapper),
        span,
      };
    case "extract_operator":
      return {
        kind: "SubsetExpression",
        operator: requiredField(node, "operator").text as "$" | "@",
        target: normalizeNode(requiredField(node, "lhs"), mapper),
        arguments: [
          {
            value: normalizeNode(requiredField(node, "rhs"), mapper),
            span: mapper.span(
              requiredField(node, "rhs").startIndex,
              requiredField(node, "rhs").endIndex,
            ),
          },
        ],
        span,
      };
    case "namespace_operator":
      return {
        kind: "NamespaceExpression",
        operator: requiredField(node, "operator").text as "::" | ":::",
        namespace: normalizeNode(requiredField(node, "lhs"), mapper),
        member: normalizeNode(requiredField(node, "rhs"), mapper),
        span,
      };
    case "dots":
    case "dot_dot_i":
      return { kind: "UnsupportedExpression", feature: node.type, span };
    default:
      return { kind: "UnsupportedExpression", feature: node.type, span };
  }
}

function normalizeUnary(node: Node, mapper: Utf8SourceMap, span: SourceSpan): AstNode {
  const operator = requiredField(node, "operator").text;
  const operand = normalizeNode(requiredField(node, "rhs"), mapper);
  if (operator === "~") {
    return { kind: "FormulaExpression", right: operand, span };
  }
  return { kind: "UnaryExpression", operator, operand, span };
}

function normalizeBinary(node: Node, mapper: Utf8SourceMap, span: SourceSpan): AstNode {
  const operator = requiredField(node, "operator").text;
  const left = normalizeNode(requiredField(node, "lhs"), mapper);
  const right = normalizeNode(requiredField(node, "rhs"), mapper);
  const leftTarget = assignmentIdentifier(left);
  const rightTarget = assignmentIdentifier(right);

  if ((operator === "<-" || operator === "=" || operator === "<<-") && leftTarget !== undefined) {
    return { kind: "AssignmentExpression", operator, target: leftTarget, value: right, span };
  }
  if (
    (operator === "<-" || operator === "=" || operator === "<<-") &&
    (left.kind === "SubsetExpression" || left.kind === "CallExpression")
  ) {
    return { kind: "ReplacementExpression", operator, target: left, value: right, span };
  }
  if ((operator === "->" || operator === "->>") && rightTarget !== undefined) {
    return { kind: "AssignmentExpression", operator, target: rightTarget, value: left, span };
  }
  if (
    (operator === "->" || operator === "->>") &&
    (right.kind === "SubsetExpression" || right.kind === "CallExpression")
  ) {
    return { kind: "ReplacementExpression", operator, target: right, value: left, span };
  }
  if (operator === "<-" || operator === "=" || operator === "<<-") {
    return {
      kind: "UnsupportedExpression",
      feature: `${left.kind} assignment target`,
      span,
    };
  }
  if (operator === "->" || operator === "->>") {
    return {
      kind: "UnsupportedExpression",
      feature: `${right.kind} assignment target`,
      span,
    };
  }
  if (operator === "|>" || operator === "%>%") {
    return { kind: "PipeExpression", operator, left, right, span };
  }
  if (operator === "~") {
    return { kind: "FormulaExpression", left, right, span };
  }
  if (
    operator.startsWith("%") &&
    operator.endsWith("%") &&
    !["%%", "%/%", "%in%"].includes(operator)
  ) {
    return {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: operator, span },
      arguments: [
        { value: left, span: left.span },
        { value: right, span: right.span },
      ],
      span,
    };
  }
  if (operator === ":=") {
    return { kind: "UnsupportedExpression", feature: `assignment operator ${operator}`, span };
  }
  return { kind: "BinaryExpression", operator, left, right, span };
}

function assignmentIdentifier(node: AstNode): IdentifierNode | undefined {
  if (node.kind === "Identifier") return node;
  if (node.kind === "StringLiteral") {
    return { kind: "Identifier", name: node.value, span: node.span };
  }
  return undefined;
}

function normalizeCall(node: Node, mapper: Utf8SourceMap, span: SourceSpan): AstNode {
  const callee = normalizeNode(requiredField(node, "function"), mapper);
  const args = normalizeArguments(requiredField(node, "arguments"), mapper);
  if (callee.kind === "Identifier" && callee.name === "return") {
    const first = args[0];
    return first === undefined
      ? { kind: "ReturnExpression", span }
      : { kind: "ReturnExpression", value: first.value, span };
  }
  return { kind: "CallExpression", callee, arguments: args, span };
}

function normalizeArguments(node: Node, mapper: Utf8SourceMap): readonly CallArgument[] {
  const separators = node.children
    .filter((child) => child.type === "comma")
    .map((child) => child.startIndex);
  const argumentNodes = node.childrenForFieldName("argument");
  const arguments_ = argumentNodes.map((argument): CallArgument => {
    const name = argument.childForFieldName("name");
    const value = argument.childForFieldName("value");
    const span = mapper.span(argument.startIndex, argument.endIndex);
    if (value === null) {
      const missing: AstNode = {
        kind: "UnsupportedExpression",
        feature: "missing argument",
        span,
      };
      return name === null
        ? { value: missing, span }
        : { name: decodeRIdentifier(name.text), value: missing, span };
    }
    const normalized = normalizeNode(value, mapper);
    return name === null
      ? { value: normalized, span }
      : { name: decodeRIdentifier(name.text), value: normalized, span };
  });
  if (separators.length === 0) return arguments_;
  const slots: (CallArgument | undefined)[] = Array.from(
    { length: separators.length + 1 },
    () => undefined,
  );
  for (let argumentIndex = 0; argumentIndex < arguments_.length; argumentIndex += 1) {
    const argument = arguments_[argumentIndex] as CallArgument;
    const startIndex = argumentNodes[argumentIndex]?.startIndex ?? node.startIndex;
    const slot = separators.filter((separator) => separator < startIndex).length;
    slots[slot] = argument;
  }
  return slots.map((argument, index): CallArgument => {
    if (argument !== undefined) return argument;
    const offset =
      index === 0
        ? (separators[0] ?? node.startIndex)
        : (separators[index - 1] ?? node.endIndex) + 1;
    const span = mapper.span(offset, offset);
    const value: AstNode = {
      kind: "UnsupportedExpression",
      feature: "missing argument",
      span,
    };
    return { value, span };
  });
}

function normalizeFunction(node: Node, mapper: Utf8SourceMap, span: SourceSpan): AstNode {
  const parametersNode = requiredField(node, "parameters");
  const parameters: FunctionParameter[] = parametersNode
    .childrenForFieldName("parameter")
    .map((parameter) => {
      const name = requiredField(parameter, "name");
      const defaultNode = parameter.childForFieldName("default");
      const parameterSpan = mapper.span(parameter.startIndex, parameter.endIndex);
      return defaultNode === null
        ? { name: name.text, span: parameterSpan }
        : {
            name: name.text,
            defaultValue: normalizeNode(defaultNode, mapper),
            span: parameterSpan,
          };
    });
  return {
    kind: "FunctionExpression",
    parameters,
    body: normalizeNode(requiredField(node, "body"), mapper),
    span,
  };
}

function normalizeIf(node: Node, mapper: Utf8SourceMap, span: SourceSpan): AstNode {
  const alternative = node.childForFieldName("alternative");
  const base = {
    kind: "IfExpression" as const,
    condition: normalizeNode(requiredField(node, "condition"), mapper),
    consequence: normalizeNode(requiredField(node, "consequence"), mapper),
    span,
  };
  return alternative === null ? base : { ...base, alternative: normalizeNode(alternative, mapper) };
}

function normalizeIdentifier(node: Node, mapper: Utf8SourceMap): IdentifierNode {
  const normalized = normalizeNode(node, mapper);
  if (normalized.kind !== "Identifier") {
    throw new Error(`Expected identifier, received ${normalized.kind}`);
  }
  return normalized;
}

function requiredField(node: Node, field: string): Node {
  const child = node.childForFieldName(field);
  if (child === null) {
    throw new Error(`Tree-sitter R invariant failed: ${node.type}.${field} is absent`);
  }
  return child;
}

function missingType(text: string): "logical" | "integer" | "double" | "character" | "complex" {
  if (text === "NA_integer_") return "integer";
  if (text === "NA_real_") return "double";
  if (text === "NA_character_") return "character";
  if (text === "NA_complex_") return "complex";
  return "logical";
}

function decodeRString(text: string): string {
  const body = text.slice(1, -1);
  let result = "";
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index] ?? "";
    if (character !== "\\") {
      result += character;
      continue;
    }
    index += 1;
    const escaped = body[index] ?? "";
    const simple: Readonly<Record<string, string>> = {
      a: "\u0007",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\u000b",
      "\\": "\\",
      "'": "'",
      '"': '"',
    };
    if (escaped in simple) {
      result += simple[escaped];
      continue;
    }
    if (escaped === "x" || escaped === "u" || escaped === "U") {
      const width = escaped === "x" ? 2 : escaped === "u" ? 4 : 8;
      const digits = body.slice(index + 1, index + 1 + width);
      if (/^[0-9a-f]+$/iu.test(digits) && digits.length === width) {
        result += String.fromCodePoint(Number.parseInt(digits, 16));
        index += width;
        continue;
      }
    }
    result += escaped;
  }
  return result;
}

function decodeRIdentifier(text: string): string {
  if (!text.startsWith("`") || !text.endsWith("`")) return text;
  return text.slice(1, -1).replace(/\\([\\`])/gu, "$1");
}

function collectSyntaxDiagnostics(
  root: Node,
  mapper: Utf8SourceMap,
  sourceLength: number,
): readonly Diagnostic[] {
  if (!root.hasError) return [];
  const diagnostics: Diagnostic[] = [];
  visit(root, (node) => {
    if (!node.isError && !node.isMissing) return;
    const span = mapper.span(node.startIndex, node.endIndex);
    const incomplete = node.isMissing && span.start.offset >= sourceLength;
    diagnostics.push({
      code: incomplete ? "NRP1002" : "NRP1001",
      severity: "error",
      message: incomplete ? "Incomplete R expression." : "Invalid R syntax.",
      span,
      hint: incomplete
        ? "Complete the expression and try again."
        : "Inspect the highlighted source range.",
    });
  });
  if (diagnostics.length === 0) {
    diagnostics.push({
      code: "NRP1001",
      severity: "error",
      message: "Invalid R syntax.",
      span: mapper.span(root.startIndex, root.endIndex),
    });
  }
  return diagnostics;
}

function visit(node: Node, callback: (node: Node) => void): void {
  callback(node);
  for (const child of node.children) {
    visit(child, callback);
  }
}
