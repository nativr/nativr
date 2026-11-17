import type {
  AstNode,
  CallArgument,
  Diagnostic,
  FunctionParameter,
  IdentifierNode,
  ProgramNode,
  ParseWorkCallbacks,
  SourceSpan,
} from "@nativr/ast";
import type { Node } from "web-tree-sitter";

import { Utf8SourceMap } from "./source-map.js";
import { decodeStringLiteral, StringLiteralError } from "./string-literal.js";

interface NormalizationSession {
  readonly values: Map<number, AstNode>;
  readonly work: ParseWorkCallbacks | undefined;
  composing: number | undefined;
}
// Scoped to one mapper/tree and removed even when decoding fails. CST identities are internal
// memoization keys only; they never supply observable parseData IDs.
const normalizationSessions = new WeakMap<Utf8SourceMap, NormalizationSession>();

/** Normalize a Tree-sitter R concrete tree without leaking its node model. */
export function normalizeProgram(
  root: Node,
  source: string,
  work?: ParseWorkCallbacks,
): { readonly ast: ProgramNode; readonly diagnostics: readonly Diagnostic[] } {
  const mapper = new Utf8SourceMap(source, work);
  const diagnostics = [...collectSyntaxDiagnostics(root, mapper, source.length, work)];
  const body: AstNode[] = [];

  work?.allocate(root.namedChildCount);
  for (const child of root.namedChildren) {
    work?.checkpoint();
    if (child.type !== "comment" && !child.hasError && !child.isError && !child.isMissing) {
      try {
        work?.allocate(1);
        body.push(normalizeTree(child, mapper, work));
      } catch (error) {
        if (!(error instanceof StringLiteralError)) throw error;
        diagnostics.push({
          code: "NRP1003",
          severity: "error",
          message: error.message,
          span: mapper.span(child.startIndex, child.endIndex),
        });
      }
    }
  }

  return {
    ast: {
      kind: "Program",
      body,
      span: mapper.span(root.startIndex, root.endIndex),
      parseData: normalizeParseData(root, mapper, source),
    },
    diagnostics,
  };
}

function normalizeTree(root: Node, mapper: Utf8SourceMap, work?: ParseWorkCallbacks): AstNode {
  const session: NormalizationSession = { values: new Map(), work, composing: undefined };
  normalizationSessions.set(mapper, session);
  const pending: { node: Node; visited: boolean }[] = [];
  try {
    work?.allocate(1);
    pending.push({ node: root, visited: false });
    while (pending.length > 0) {
      work?.checkpoint();
      const { node, visited } = pending.pop()!;
      if (visited) {
        session.composing = node.id;
        work?.allocate(1);
        session.values.set(node.id, normalizeNode(node, mapper));
      } else {
        work?.allocate(node.namedChildCount + 1);
        const children = normalizationChildren(node, work);
        pending.push({ node, visited: true });
        for (let index = children.length - 1; index >= 0; index--) {
          work?.checkpoint();
          pending.push({ node: children[index]!, visited: false });
        }
      }
    }
    return session.values.get(root.id)!;
  } finally {
    normalizationSessions.delete(mapper);
  }
}

/** Only dependencies the existing composers actually normalize; unsupported syntax stays opaque. */
function normalizationChildren(node: Node, work?: ParseWorkCallbacks): readonly Node[] {
  const field = (name: string): Node => requiredField(node, name);
  const arguments_ = (): Node[] => {
    const argumentsNode = field("arguments");
    for (let copy = 0; copy < 3; copy++) work?.allocate(argumentsNode.namedChildCount);
    return argumentsNode.childrenForFieldName("argument").flatMap((argument) => {
      work?.checkpoint();
      const value = argument.childForFieldName("value");
      return value === null ? [] : [value];
    });
  };
  switch (node.type) {
    case "parenthesized_expression":
    case "repeat_statement":
      return [field("body")];
    case "braced_expression":
      return node.childrenForFieldName("body");
    case "unary_operator":
      return [field("rhs")];
    case "binary_operator":
    case "namespace_operator":
      return [field("lhs"), field("rhs")];
    case "extract_operator": {
      const member = field("rhs");
      return member.type === "dots" ? [field("lhs")] : [field("lhs"), member];
    }
    case "call":
    case "subset":
    case "subset2":
      return [field("function"), ...arguments_()];
    case "function_definition": {
      const parameters = field("parameters");
      for (let copy = 0; copy < 3; copy++) work?.allocate(parameters.namedChildCount);
      return [
        ...parameters.childrenForFieldName("parameter").flatMap((parameter) => {
          work?.checkpoint();
          const value = parameter.childForFieldName("default");
          return value === null ? [] : [value];
        }),
        field("body"),
      ];
    }
    case "if_statement": {
      const alternative = node.childForFieldName("alternative");
      return [
        field("condition"),
        field("consequence"),
        ...(alternative === null ? [] : [alternative]),
      ];
    }
    case "for_statement":
      return [field("variable"), field("sequence"), field("body")];
    case "while_statement":
      return [field("condition"), field("body")];
    default:
      return [];
  }
}

function normalizeParseData(root: Node, mapper: Utf8SourceMap, source: string) {
  const output: {
    id: number;
    parent: number;
    type: string;
    parentType?: string;
    terminal: boolean;
    text: string;
    span: SourceSpan;
  }[] = [];
  let nextId = 1;
  const addTerminal = (text: string, start: number, parent: number, parentType: string): void => {
    output.push({
      id: nextId++,
      parent,
      type: text,
      parentType,
      terminal: true,
      text,
      span: mapper.span(start, start + text.length),
    });
  };
  const addGapTerminals = (
    start: number,
    end: number,
    parent: number,
    parentType: string,
  ): void => {
    for (let offset = source.indexOf(";", start); offset >= 0 && offset < end;) {
      addTerminal(";", offset, parent, parentType);
      offset = source.indexOf(";", offset + 1);
    }
  };
  type Task =
    | { node: Node; parent: number; parentType?: string }
    | { start: number; end: number; parent: number; parentType: string };
  const pending: Task[] = [];
  const topLevel = root.children;
  for (let index = topLevel.length - 1; index >= 0; index--) {
    pending.push({ node: topLevel[index]!, parent: 0, parentType: root.type });
  }
  while (pending.length > 0) {
    const task = pending.pop()!;
    if (!("node" in task)) {
      addGapTerminals(task.start, task.end, task.parent, task.parentType);
      continue;
    }
    const { node, parent, parentType } = task;
    const id = nextId++;
    const terminal = node.childCount === 0 || node.type === "string";
    output.push({
      id,
      parent,
      type: node.type,
      ...(parentType === undefined ? {} : { parentType }),
      terminal,
      text: source.slice(node.startIndex, node.endIndex),
      span: mapper.span(node.startIndex, node.endIndex),
    });
    if (node.type === "string") continue;
    // tree-sitter-r treats explicit semicolons as separators rather than concrete children.
    // Recover them from gaps between owned nodes so getParseData() can expose the terminal
    // token, including the enclosing expression parent used by source-transforming packages.
    const ordered: Task[] = [];
    let cursor = node.startIndex;
    for (const child of node.children) {
      ordered.push({ start: cursor, end: child.startIndex, parent: id, parentType: node.type });
      ordered.push({ node: child, parent: id, parentType: node.type });
      cursor = child.endIndex;
    }
    ordered.push({ start: cursor, end: node.endIndex, parent: id, parentType: node.type });
    for (let index = ordered.length - 1; index >= 0; index--) pending.push(ordered[index]!);
  }
  return Object.freeze(output);
}

function normalizeNode(node: Node, mapper: Utf8SourceMap): AstNode {
  const session = normalizationSessions.get(mapper);
  if (session !== undefined) {
    const normalized = session.values.get(node.id);
    if (normalized !== undefined) return normalized;
    if (session.composing !== node.id)
      throw new Error("Missing iterative normalization dependency.");
  }
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
      return { kind: "StringLiteral", ...decodeStringLiteral(node.text), span };
    case "parenthesized_expression":
      return {
        kind: "CallExpression",
        callee: { kind: "Identifier", name: "(", span },
        arguments: [{ value: normalizeNode(requiredField(node, "body"), mapper), span }],
        span,
      };
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
        variable: normalizeNode(requiredField(node, "variable"), mapper),
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
    case "extract_operator": {
      const member = requiredField(node, "rhs");
      return {
        kind: "SubsetExpression",
        operator: requiredField(node, "operator").text as "$" | "@",
        target: normalizeNode(requiredField(node, "lhs"), mapper),
        arguments: [
          {
            value:
              member.type === "dots"
                ? {
                    kind: "Identifier",
                    name: "...",
                    span: mapper.span(member.startIndex, member.endIndex),
                  }
                : normalizeNode(member, mapper),
            span: mapper.span(member.startIndex, member.endIndex),
          },
        ],
        span,
      };
    }
    case "namespace_operator":
      return {
        kind: "NamespaceExpression",
        operator: requiredField(node, "operator").text as "::" | ":::",
        namespace: normalizeNode(requiredField(node, "lhs"), mapper),
        member: normalizeNode(requiredField(node, "rhs"), mapper),
        span,
      };
    case "dots":
      return { kind: "UnsupportedExpression", feature: node.type, span };
    case "dot_dot_i":
      return { kind: "Identifier", name: node.text, span };
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
  const parsedCallee = normalizeNode(requiredField(node, "function"), mapper);
  // GNU R canonicalizes a character-literal call head to a symbol in the language object.
  // This keeps `"f"(x)` executable while making quote/as.list/identical observe the same call
  // representation as `f(x)`.
  const callee =
    parsedCallee.kind === "StringLiteral"
      ? ({ kind: "Identifier", name: parsedCallee.value, span: parsedCallee.span } as const)
      : parsedCallee;
  const args = normalizeArguments(requiredField(node, "arguments"), mapper);
  if (
    callee.kind === "Identifier" &&
    callee.name === "return" &&
    args.length <= 1 &&
    args.every(
      (argument) =>
        argument.name === undefined &&
        !(
          argument.value.kind === "UnsupportedExpression" &&
          argument.value.feature === "missing argument"
        ),
    )
  ) {
    const first = args[0];
    return first === undefined
      ? { kind: "ReturnExpression", span }
      : { kind: "ReturnExpression", value: first.value, span };
  }
  return { kind: "CallExpression", callee, arguments: args, span };
}

function normalizeArguments(node: Node, mapper: Utf8SourceMap): readonly CallArgument[] {
  const work = normalizationSessions.get(mapper)?.work;
  work?.allocate(node.childCount);
  work?.allocate(node.childCount);
  const separators: number[] = [];
  for (const child of node.children) {
    work?.checkpoint();
    if (child.type === "comma") separators.push(child.startIndex);
  }
  work?.allocate(node.namedChildCount);
  const argumentNodes = node.childrenForFieldName("argument");
  work?.allocate(argumentNodes.length);
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
  work?.allocate(separators.length + 1);
  const slots: (CallArgument | undefined)[] = Array.from(
    { length: separators.length + 1 },
    () => undefined,
  );
  let slot = 0;
  for (let argumentIndex = 0; argumentIndex < arguments_.length; argumentIndex += 1) {
    work?.checkpoint();
    const argument = arguments_[argumentIndex] as CallArgument;
    const startIndex = argumentNodes[argumentIndex]?.startIndex ?? node.startIndex;
    while (slot < separators.length && separators[slot]! < startIndex) {
      work?.checkpoint();
      slot++;
    }
    slots[slot] = argument;
  }
  work?.allocate(slots.length);
  return slots.map((argument, index): CallArgument => {
    work?.checkpoint();
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
        ? { name: decodeRIdentifier(name.text), span: parameterSpan }
        : {
            name: decodeRIdentifier(name.text),
            defaultValue: normalizeNode(defaultNode, mapper),
            span: parameterSpan,
          };
    });
  return {
    kind: "FunctionExpression",
    ...(requiredField(node, "name").text === "\\" ? { syntax: "lambda" as const } : {}),
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

function decodeRIdentifier(text: string): string {
  if (text.startsWith("`") && text.endsWith("`")) {
    return decodeStringLiteral(text, true).value;
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return decodeStringLiteral(text).value;
  }
  return text;
}

function collectSyntaxDiagnostics(
  root: Node,
  mapper: Utf8SourceMap,
  sourceLength: number,
  work?: ParseWorkCallbacks,
): readonly Diagnostic[] {
  if (!root.hasError) return [];
  const diagnostics: Diagnostic[] = [];
  visit(
    root,
    (node) => {
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
    },
    work,
  );
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

function visit(node: Node, callback: (node: Node) => void, work?: ParseWorkCallbacks): void {
  work?.allocate(1);
  const pending = [node];
  while (pending.length > 0) {
    work?.checkpoint();
    const current = pending.pop()!;
    callback(current);
    work?.allocate(current.childCount);
    const children = current.children;
    for (let index = children.length - 1; index >= 0; index--) {
      work?.checkpoint();
      pending.push(children[index]!);
    }
  }
}
