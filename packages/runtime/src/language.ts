import { assertNever } from "@nativr/ast";
import type { AstNode, CallArgument, SourceSpan } from "@nativr/ast";

import { RResourceLimitError } from "./errors.js";
import { functionSourceCellPresent } from "./language-metadata.js";

import {
  characterVector,
  complexVector,
  doubleVector,
  integerVector,
  languageValue,
  listValue,
  logicalVector,
  missingValue,
  pairlistValue,
  R_NULL,
  vectorNames,
} from "./values.js";
import type { RLanguage, RList, RPairlist, RValue, RVector } from "./values.js";

type AtomicVector = Exclude<RVector, RList>;

const SYNTHETIC_SPAN: SourceSpan = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

/** Inspect call shape without projecting a function's formal pairlist. */
export function languageValueLength(value: RLanguage): number {
  if (value.expression.kind === "FunctionExpression")
    return functionSourceCellPresent(value.expression) ? 4 : 3;
  return languageAstEntries(value.expression)?.nodes.length ?? 1;
}

/** Inspect structural tags without quoting defaults or allocating their pairlist. */
export function languageValueNames(value: RLanguage): readonly string[] | undefined {
  if (value.expression.kind !== "FunctionExpression") return languageValueEntries(value)?.names;
  if (value.headTag === undefined) return undefined;
  return [value.headTag, ...Array<string>(languageValueLength(value) - 1).fill("")];
}

/** Expose call cells and structural tags without mixing tags into ordinary attributes. */
export function languageValueEntries(
  value: RLanguage,
): { readonly nodes: readonly AstNode[]; readonly names?: readonly string[] } | undefined {
  const entries = languageAstEntries(value.expression);
  if (entries === undefined || value.headTag === undefined) return entries;
  return {
    nodes: entries.nodes,
    names: [
      value.headTag,
      ...entries.nodes.slice(1).map((_, index) => entries.names?.[index + 1] ?? ""),
    ],
  };
}
const LANGUAGE_OPERATOR_NAMES = new Set([
  "+",
  "-",
  "*",
  "/",
  "^",
  "%%",
  "%/%",
  ":",
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "&",
  "&&",
  "|",
  "||",
  "!",
  "~",
  "<-",
  "<<-",
  "=",
  "->",
  "->>",
  "[",
  "[[",
  "$",
  "@",
  "{",
  "(",
  "::",
  ":::",
]);

/** Render normalized syntax into a stable R-like diagnostic representation. */
export function deparseAst(node: AstNode, checkWork?: () => void): string {
  validateDeparseSyntax([node], checkWork);
  return deparseWithFollowing(node, 0);
}

/** Error display omits structure attributes of embedded values; stored calls retain them. */
export function deparseDiagnosticAst(node: AstNode, checkWork?: () => void): string {
  validateDeparseSyntax([node], checkWork);
  return deparseWithFollowing(node, 0, true);
}

function diagnosticNode(node: AstNode): AstNode {
  if (
    node.kind === "ConstantExpression" &&
    node.display.kind === "CallExpression" &&
    node.display.callee.kind === "Identifier" &&
    node.display.callee.name === "structure"
  )
    return node.display.arguments[0]?.value ?? node.display;
  return node;
}

function deparseWithFollowing(
  node: AstNode,
  followingPrecedence: number,
  diagnostic = false,
): string {
  if (diagnostic) node = diagnosticNode(node);
  const render = (child: AstNode): string => deparseWithFollowing(child, 0, diagnostic);
  const operation = deparseOperation(node);
  if (operation !== undefined) {
    const right = deparseOperand(
      operation.right,
      operation,
      "right",
      followingPrecedence,
      diagnostic,
    );
    if (operation.left === undefined) return `${operation.operator}${right}`;
    const left = deparseOperand(
      operation.left,
      operation,
      "left",
      operation.precedence,
      diagnostic,
    );
    const separator = [":", "^", "/", "%%", "%/%"].includes(operation.operator) ? "" : " ";
    return `${left}${separator}${operation.operator}${separator}${right}`;
  }
  switch (node.kind) {
    case "Program":
      return node.body.map(render).join("\n");
    case "Block":
      return `{ ${node.body.map(render).join("; ")} }`;
    case "Identifier":
      return deparseName(node.name);
    case "DoubleLiteral":
      return formatNumber(node.value);
    case "ComplexLiteral":
      return `0${node.imaginary < 0 ? "" : "+"}${formatNumber(node.imaginary)}i`;
    case "IntegerLiteral":
      return `${String(node.value)}L`;
    case "StringLiteral":
      if (node.encoding === "unknown" && node.bytes?.some((byte) => byte > 127)) {
        return `"${node.bytes.map((byte) => `\\x${byte.toString(16).padStart(2, "0")}`).join("")}"`;
      }
      return JSON.stringify(node.value);
    case "LogicalLiteral":
      return node.value ? "TRUE" : "FALSE";
    case "NullLiteral":
      return "NULL";
    case "MissingLiteral":
      return node.declaredType === "logical" ? "NA" : `NA_${node.declaredType}_`;
    case "UnaryExpression":
      return `${node.operator}(${render(node.operand)})`;
    case "BinaryExpression":
      return `(${render(node.left)} ${node.operator} ${render(node.right)})`;
    case "AssignmentExpression":
    case "ReplacementExpression":
      return `(${render(node.target)} ${node.operator} ${render(node.value)})`;
    case "CallExpression": {
      if (
        node.callee.kind === "Identifier" &&
        node.callee.name === "(" &&
        node.arguments.length === 1
      ) {
        const argument = node.arguments[0];
        if (argument !== undefined) return `(${render(argument.value)})`;
      }
      return `${deparseTarget(node.callee, 16, diagnostic)}(${node.arguments.map((argument) => deparseArgument(argument, diagnostic)).join(", ")})`;
    }
    case "FunctionExpression":
      return `function(${node.parameters
        .map((parameter) =>
          parameter.defaultValue === undefined
            ? deparseName(parameter.name)
            : `${deparseName(parameter.name)} = ${render(parameter.defaultValue)}`,
        )
        .join(", ")}) ${render(node.body)}`;
    case "IfExpression":
      return `if (${render(node.condition)}) ${render(node.consequence)}${
        node.alternative === undefined ? "" : ` else ${render(node.alternative)}`
      }`;
    case "ForExpression":
      return `for (${
        node.variable.kind === "Identifier"
          ? deparseName(node.variable.name)
          : render(node.variable)
      } in ${render(node.sequence)}) ${render(node.body)}`;
    case "WhileExpression":
      return `while (${render(node.condition)}) ${render(node.body)}`;
    case "RepeatExpression":
      return `repeat ${render(node.body)}`;
    case "BreakExpression":
      return "break";
    case "NextExpression":
      return "next";
    case "ReturnExpression":
      return node.value === undefined ? "return()" : `return(${render(node.value)})`;
    case "SubsetExpression": {
      if (node.operator === "$" || node.operator === "@") {
        const member = node.arguments[0];
        return `${deparseTarget(node.target, 16, diagnostic)}${node.operator}${
          member === undefined ? "" : render(member.value)
        }`;
      }
      const close = node.operator === "[[" ? "]]" : "]";
      return `${deparseTarget(node.target, 16, diagnostic)}${node.operator}${node.arguments
        .map((argument) => deparseArgument(argument, diagnostic))
        .join(", ")}${close}`;
    }
    case "NamespaceExpression":
      return `${render(node.namespace)}${node.operator}${render(node.member)}`;
    case "FormulaExpression":
      return node.left === undefined
        ? `~${render(node.right)}`
        : `${render(node.left)} ~ ${render(node.right)}`;
    case "PipeExpression":
      return `(${render(node.left)} ${node.operator} ${render(node.right)})`;
    case "ConstantExpression":
      return render(node.display);
    case "UnsupportedExpression":
      if (node.feature === "missing argument") return "";
      if (node.feature === "dots") return "...";
      return `<${node.feature}>`;
    default:
      return assertNever(node);
  }
}

export interface DeparseOperation {
  readonly operator: string;
  readonly precedence: number;
  readonly left?: AstNode;
  readonly right: AstNode;
}

// Precedence follows the public base::Syntax documentation. Constructed calls
// receive the parentheses needed to preserve their expression structure.
function binaryPrecedence(operator: string): number | undefined {
  if (operator === "=") return 2;
  if (operator === "<-" || operator === "<<-") return 3;
  if (operator === "~") return 5;
  if (operator === "|" || operator === "||") return 6;
  if (operator === "&" || operator === "&&") return 7;
  if (["<", ">", "<=", ">=", "==", "!="].includes(operator)) return 9;
  if (operator === "+" || operator === "-") return 10;
  if (operator === "*" || operator === "/") return 11;
  if (operator === "|>" || /^%.*%$/u.test(operator)) return 12;
  if (operator === ":") return 13;
  if (operator === "^") return 15;
  return undefined;
}

function unaryPrecedence(operator: string): number | undefined {
  if (operator === "~") return 5;
  if (operator === "!") return 8;
  if (operator === "+" || operator === "-") return 14;
  return undefined;
}

export function deparseOperation(node: AstNode): DeparseOperation | undefined {
  let operator: string;
  let left: AstNode | undefined;
  let right: AstNode;
  switch (node.kind) {
    case "BinaryExpression":
    case "PipeExpression":
      ({ operator, left, right } = node);
      break;
    case "UnaryExpression":
      operator = node.operator;
      right = node.operand;
      break;
    case "FormulaExpression":
      operator = "~";
      ({ left, right } = node);
      break;
    case "AssignmentExpression":
    case "ReplacementExpression":
      // R's parsed language representation normalizes rightward assignment.
      operator = node.operator === "->" ? "<-" : node.operator === "->>" ? "<<-" : node.operator;
      left = node.target;
      right = node.value;
      break;
    case "CallExpression": {
      if (node.callee.kind !== "Identifier") return undefined;
      operator = node.callee.name;
      const [first, second] = node.arguments;
      if (first === undefined) return undefined;
      if (node.arguments.length === 1) right = first.value;
      else if (node.arguments.length === 2 && second !== undefined) {
        left = first.value;
        right = second.value;
      } else return undefined;
      break;
    }
    case "ConstantExpression":
      return deparseOperation(node.display);
    default:
      return undefined;
  }
  const precedence = left === undefined ? unaryPrecedence(operator) : binaryPrecedence(operator);
  return precedence === undefined
    ? undefined
    : { operator, precedence, ...(left === undefined ? {} : { left }), right };
}

export function expressionPrecedence(node: AstNode): number {
  const operation = deparseOperation(node);
  if (operation !== undefined) return operation.precedence;
  if (node.kind === "ConstantExpression")
    return (node.value as RValue | null)?.type === "closure"
      ? 0
      : expressionPrecedence(node.display);
  if (node.kind === "NamespaceExpression") return 17;
  if (node.kind === "SubsetExpression" || node.kind === "CallExpression") return 16;
  if (
    [
      "FunctionExpression",
      "IfExpression",
      "ForExpression",
      "WhileExpression",
      "RepeatExpression",
    ].includes(node.kind)
  )
    return 0;
  // A synthesized negative numeric literal parses as a unary minus expression.
  if ((node.kind === "DoubleLiteral" || node.kind === "IntegerLiteral") && node.value < 0)
    return 14;
  if (node.kind === "ComplexLiteral") return 10;
  return 20;
}

function deparseOperand(
  node: AstNode,
  operation: DeparseOperation,
  side: "left" | "right",
  followingPrecedence: number,
  diagnostic = false,
): string {
  if (diagnostic) node = diagnosticNode(node);
  const grouped = operandNeedsGrouping(node, operation, side, followingPrecedence);
  const source = deparseWithFollowing(node, grouped ? 0 : followingPrecedence, diagnostic);
  return grouped ? `(${source})` : source;
}

/** Shared grouping decision for compact diagnostics and multiline syntax output. */
export function operandNeedsGrouping(
  node: AstNode,
  operation: DeparseOperation,
  side: "left" | "right",
  followingPrecedence: number,
): boolean {
  const childOperation = deparseOperation(node);
  const precedence = expressionPrecedence(node);
  // Prefix operators on a right operand bind to their own following expression,
  // including x^-2. A later operator can still require grouping: a * (!b) + c.
  const prefixRight =
    side === "right" &&
    ((childOperation !== undefined && childOperation.left === undefined) ||
      precedence === 0 ||
      (precedence === 14 && childOperation === undefined));
  const equalNeedsGrouping =
    operation.left !== undefined &&
    (operation.precedence === 9 ||
      (operation.operator === "^" ||
      operation.operator === "<-" ||
      operation.operator === "<<-" ||
      operation.operator === "="
        ? side === "left"
        : side === "right"));
  return prefixRight
    ? followingPrecedence > precedence
    : precedence < operation.precedence ||
        (precedence === operation.precedence && equalNeedsGrouping);
}

function deparseTarget(node: AstNode, precedence: number, diagnostic = false): string {
  if (diagnostic) node = diagnosticNode(node);
  const source = deparseWithFollowing(node, 0, diagnostic);
  return expressionPrecedence(node) < precedence ? `(${source})` : source;
}

/** Render normalized syntax as reparsable R source with operator precedence preserved. */
export function deparseSourceAst(node: AstNode): string {
  return deparseSourceNode(node, 0);
}

/** Render normalized syntax into GNU-R-shaped source lines for width-sensitive deparse(). */
export function deparseSourceLinesAst(
  node: AstNode,
  widthCutoff = 60,
  splitTopLevelFunctionBody = false,
): readonly string[] {
  const width = Math.max(20, Math.min(500, Math.trunc(widthCutoff)));
  return Object.freeze(prettySourceLines(node, 0, width, splitTopLevelFunctionBody));
}

function prettySourceLines(
  node: AstNode,
  indentation: number,
  width: number,
  splitFunctionBody = false,
  continuationIndentation?: number,
): string[] {
  const padding = " ".repeat(indentation);
  const oneLine = `${padding}${deparseSourceAst(node)}`;
  const softWidth = Math.min(500, width + (continuationIndentation === undefined ? 10 : 5));
  switch (node.kind) {
    case "Program":
      return node.body.flatMap((entry) => prettySourceLines(entry, indentation, width));
    case "Block":
      return [
        `${padding}{`,
        ...node.body.flatMap((entry) => prettySourceLines(entry, indentation + 4, width)),
        `${padding}}`,
      ];
    case "FunctionExpression": {
      const keyword = node.syntax === "lambda" ? "\\" : "function";
      const headerWidth = node.syntax === "lambda" ? width : Math.min(500, width + 4);
      const headerLines = prettyFunctionHeaderLines(node.parameters, padding, keyword, headerWidth);
      const header = `${headerLines.at(-1) ?? ""} `;
      if (node.body.kind === "Block") {
        return [
          ...headerLines.slice(0, -1),
          ...combinePrettyHeader(header, prettySourceLines(node.body, indentation, width)),
        ];
      }
      const body = prettySourceLines(node.body, indentation, width);
      if (
        !splitFunctionBody &&
        headerLines.length === 1 &&
        body.length === 1 &&
        header.length + (body[0]?.trimStart().length ?? 0) <= width
      ) {
        return combinePrettyHeader(header, body);
      }
      return [...headerLines.slice(0, -1), header, ...body];
    }
    case "IfExpression": {
      const header = `${padding}if (${deparseSourceAst(node.condition)}) `;
      const consequence = prettySourceLines(node.consequence, indentation, width);
      let lines = combinePrettyHeader(header, consequence);
      if (node.alternative === undefined) return lines;
      const alternative = prettySourceLines(node.alternative, indentation, width);
      if (lines.length === 0) return alternative;
      const last = lines.at(-1) ?? "";
      const firstAlternative = alternative[0]?.trimStart() ?? "";
      if (last.trim() === "}" || node.consequence.kind !== "Block") {
        lines = [
          ...lines.slice(0, -1),
          `${last} else ${firstAlternative}`,
          ...alternative.slice(1),
        ];
      } else {
        lines.push(`${padding}else ${firstAlternative}`, ...alternative.slice(1));
      }
      return lines;
    }
    case "FormulaExpression":
      return prettyFormulaLines(
        node,
        indentation,
        width,
        continuationIndentation ?? indentation + 4,
      );
    case "AssignmentExpression":
    case "ReplacementExpression": {
      if (node.value.kind !== "FunctionExpression" && node.value.kind !== "Block") return [oneLine];
      const header = `${padding}${deparseSourceAst(node.target)} ${node.operator} `;
      return combinePrettyHeader(header, prettySourceLines(node.value, indentation, width));
    }
    case "CallExpression": {
      if (
        isSpecialInfixCall(node) &&
        (node.arguments[0]?.value.kind === "Block" || node.arguments[1]?.value.kind === "Block")
      ) {
        return prettyInfixLines(
          node.arguments[0]?.value as AstNode,
          node.callee.name,
          node.arguments[1]?.value as AstNode,
          indentation,
          width,
        );
      }
      if (oneLine.length <= softWidth || node.arguments.length <= 1) return [oneLine];
      if (isSpecialInfixCall(node)) {
        return prettyInfixLines(
          node.arguments[0]?.value as AstNode,
          node.callee.name,
          node.arguments[1]?.value as AstNode,
          indentation,
          width,
        );
      }
      const callee = deparseSourceAst(node.callee);
      const childIndentation = continuationIndentation ?? indentation + 4;
      const childPadding = " ".repeat(childIndentation);
      const preservesControlMarkerDepth = node.arguments.some(
        (argument) => argument.value.kind === "Identifier" && argument.value.name.includes("\b"),
      );
      const renderedArguments = node.arguments.map((argument) => {
        const value = prettySourceLines(
          argument.value,
          childIndentation,
          width,
          false,
          preservesControlMarkerDepth ? undefined : childIndentation,
        ).map((line) => (line.startsWith(childPadding) ? line.slice(childPadding.length) : line));
        const name = argument.name === undefined ? "" : `${argument.name} = `;
        return { value, name, node: argument.value };
      });
      if (renderedArguments.every((argument) => argument.value.length === 1)) {
        const continuation = " ".repeat(childIndentation);
        const lines: string[] = [];
        let current = `${padding}${callee}(`;
        renderedArguments.forEach((argument, index) => {
          const token = `${argument.name}${argument.value[0] ?? ""}${
            index < renderedArguments.length - 1 ? "," : ""
          }`;
          const separator = index === 0 ? "" : " ";
          if (index === 0 || current.length + separator.length + token.length <= softWidth) {
            current += `${separator}${token}`;
          } else {
            lines.push(current.endsWith(",") ? `${current} ` : current);
            current = `${continuation}${token}`;
          }
        });
        lines.push(`${current})`);
        return lines;
      }
      const continuation = " ".repeat(childIndentation);
      const lines: string[] = [];
      renderedArguments.forEach((argument, index) => {
        const previous = index === 0 ? undefined : renderedArguments[index - 1];
        if (
          previous?.node.kind === "FormulaExpression" &&
          argument.value.length > 1 &&
          (!preservesControlMarkerDepth || previous.value.length >= 3)
        ) {
          lines[lines.length - 1] += ` ${argument.name}${argument.value[0]?.trimStart() ?? ""}`;
          lines.push(...argument.value.slice(1).map((line) => `${continuation}${line}`));
        } else {
          const prefix = index === 0 ? `${padding}${callee}(` : continuation;
          lines.push(
            `${prefix}${argument.name}${argument.value[0]?.trimStart() ?? ""}`,
            ...argument.value.slice(1).map((line) => `${continuation}${line}`),
          );
        }
        if (index < renderedArguments.length - 1) lines[lines.length - 1] += ",";
      });
      if (lines.length === 0) lines.push(`${padding}${callee}()`);
      else lines[lines.length - 1] = `${lines.at(-1) ?? ""})`;
      return lines;
    }
    case "PipeExpression":
      return oneLine.length <= width
        ? [oneLine]
        : prettyInfixLines(node.left, node.operator, node.right, indentation, width);
    case "BinaryExpression":
      return oneLine.length <= width
        ? [oneLine]
        : prettyInfixLines(node.left, node.operator, node.right, indentation, width);
    default:
      return [oneLine];
  }
}

function prettyFormulaLines(
  node: Extract<AstNode, { readonly kind: "FormulaExpression" }>,
  indentation: number,
  width: number,
  continuationIndentation: number,
): string[] {
  const padding = " ".repeat(indentation);
  const prefix =
    node.left === undefined ? `${padding}~` : `${padding}${deparseSourceAst(node.left)} ~ `;
  const operands = flattenAssociativeBinary(node.right, "+");
  if (operands.length < 2) return [`${prefix}${deparseSourceAst(node.right)}`];
  const limit = Math.min(500, width + 5);
  const continuation = " ".repeat(continuationIndentation);
  const lines: string[] = [];
  let current = `${prefix}${deparseSourceAst(operands[0] as AstNode)}`;
  for (let index = 1; index < operands.length; index += 1) {
    const operand = deparseSourceAst(operands[index] as AstNode);
    const candidate = `${current} + ${operand}`;
    const candidateWithContinuation = index < operands.length - 1 ? `${candidate} +` : candidate;
    if (candidateWithContinuation.length <= limit) {
      current = candidate;
      continue;
    }
    lines.push(`${current} + `);
    current = `${continuation}${operand}`;
  }
  lines.push(current);
  return lines;
}

function flattenAssociativeBinary(node: AstNode, operator: string): readonly AstNode[] {
  if (node.kind !== "BinaryExpression" || node.operator !== operator) return [node];
  return [
    ...flattenAssociativeBinary(node.left, operator),
    ...flattenAssociativeBinary(node.right, operator),
  ];
}

function combinePrettyHeader(header: string, body: readonly string[]): string[] {
  if (body.length === 0) return [header.trimEnd()];
  return [`${header}${body[0]?.trimStart() ?? ""}`, ...body.slice(1)];
}

function prettyFunctionHeaderLines(
  parameters: readonly { readonly name: string; readonly defaultValue?: AstNode }[],
  padding: string,
  keyword: string,
  width: number,
): string[] {
  const rendered = parameters.map((parameter) =>
    parameter.defaultValue === undefined
      ? deparseIdentifier(parameter.name)
      : `${deparseIdentifier(parameter.name)} = ${deparseSourceAst(parameter.defaultValue)}`,
  );
  if (rendered.length === 0) return [`${padding}${keyword}()`];
  const continuation = `${padding}    `;
  const lines: string[] = [];
  let current = `${padding}${keyword}(`;
  rendered.forEach((parameter, index) => {
    const token = `${parameter}${index < rendered.length - 1 ? "," : ")"}`;
    const separator = current.endsWith("(") ? "" : " ";
    if (current.endsWith("(") || current.length + separator.length + token.length <= width) {
      current += `${separator}${token}`;
    } else {
      lines.push(current.endsWith(",") ? `${current} ` : current);
      current = `${continuation}${token}`;
    }
  });
  lines.push(current);
  return lines;
}

function prettyInfixLines(
  left: AstNode,
  operator: string,
  right: AstNode,
  indentation: number,
  width: number,
): string[] {
  const leftLines = prettySourceLines(left, indentation, width);
  if (right.kind === "Block") {
    const header = `${leftLines.at(-1) ?? ""} ${operator} `;
    return [
      ...leftLines.slice(0, -1),
      ...combinePrettyHeader(header, prettySourceLines(right, indentation, width)),
    ];
  }
  leftLines[leftLines.length - 1] = `${leftLines.at(-1) ?? ""} ${operator}`;
  return [...leftLines, ...prettySourceLines(right, indentation + 4, width)];
}

function deparseSourceNode(
  node: AstNode,
  parentPrecedence: number,
  side?: "left" | "right",
  parentOperator?: string,
): string {
  switch (node.kind) {
    case "Program":
      return node.body.map((entry) => deparseSourceNode(entry, 0)).join("\n");
    case "Block":
      return `{ ${node.body.map((entry) => deparseSourceNode(entry, 0)).join("; ")} }`;
    case "Identifier":
      return deparseIdentifier(node.name);
    case "DoubleLiteral":
      return formatNumber(node.value);
    case "ComplexLiteral":
      return `${formatNumber(node.imaginary)}i`;
    case "IntegerLiteral":
      return `${String(node.value)}L`;
    case "StringLiteral":
      return JSON.stringify(node.value);
    case "LogicalLiteral":
      return node.value ? "TRUE" : "FALSE";
    case "NullLiteral":
      return "NULL";
    case "MissingLiteral":
      return node.declaredType === "logical" ? "NA" : `NA_${node.declaredType}_`;
    case "UnaryExpression": {
      const precedence = 85;
      const rendered = `${node.operator}${deparseSourceNode(node.operand, precedence, "right", node.operator)}`;
      const exponentOperand = parentOperator === "^" && side === "right";
      return precedence < parentPrecedence && !exponentOperand ? `(${rendered})` : rendered;
    }
    case "BinaryExpression": {
      const precedence = sourceOperatorPrecedence(node.operator);
      const left = deparseSourceNode(node.left, precedence, "left", node.operator);
      const right = deparseSourceNode(node.right, precedence, "right", node.operator);
      const separator = sourceOperatorSeparator(node.operator);
      const rendered = `${left}${separator}${right}`;
      const equalPrecedenceNeedsParentheses =
        precedence === parentPrecedence &&
        parentOperator !== undefined &&
        ((parentOperator === "^" && side === "left") ||
          (side === "right" &&
            !(
              parentOperator === node.operator &&
              (parentOperator === "+" || parentOperator === "*")
            )));
      return precedence < parentPrecedence || equalPrecedenceNeedsParentheses
        ? `(${rendered})`
        : rendered;
    }
    case "AssignmentExpression":
    case "ReplacementExpression": {
      const precedence = 10;
      const rendered = `${deparseSourceNode(node.target, precedence, "left", node.operator)} ${node.operator} ${deparseSourceNode(node.value, precedence, "right", node.operator)}`;
      return precedence < parentPrecedence ? `(${rendered})` : rendered;
    }
    case "CallExpression":
      if (isSpecialInfixCall(node)) {
        const precedence = sourceOperatorPrecedence(node.callee.name);
        const left = deparseSourceNode(
          node.arguments[0]?.value as AstNode,
          precedence,
          "left",
          node.callee.name,
        );
        const right = deparseSourceNode(
          node.arguments[1]?.value as AstNode,
          precedence,
          "right",
          node.callee.name,
        );
        const rendered = `${left} ${node.callee.name} ${right}`;
        return precedence < parentPrecedence ? `(${rendered})` : rendered;
      }
      if (
        node.callee.kind === "Identifier" &&
        node.callee.name === "(" &&
        node.arguments.length === 1
      ) {
        return `(${deparseSourceNode(node.arguments[0]?.value as AstNode, 0)})`;
      }
      return `${deparseSourceNode(node.callee, 100)}(${node.arguments
        .map((argument) => {
          const value = deparseSourceNode(argument.value, 0);
          return argument.name === undefined ? value : `${argument.name} = ${value}`;
        })
        .join(", ")})`;
    case "FunctionExpression":
      return `${node.syntax === "lambda" ? "\\" : "function"}(${node.parameters
        .map((parameter) =>
          parameter.defaultValue === undefined
            ? deparseIdentifier(parameter.name)
            : `${deparseIdentifier(parameter.name)} = ${deparseSourceNode(parameter.defaultValue, 0)}`,
        )
        .join(", ")}) ${deparseSourceNode(node.body, 0)}`;
    case "IfExpression":
      return `if (${deparseSourceNode(node.condition, 0)}) ${deparseSourceNode(node.consequence, 0)}${
        node.alternative === undefined ? "" : ` else ${deparseSourceNode(node.alternative, 0)}`
      }`;
    case "ForExpression":
      return `for (${deparseSourceNode(node.variable, 0)} in ${deparseSourceNode(node.sequence, 0)}) ${deparseSourceNode(node.body, 0)}`;
    case "WhileExpression":
      return `while (${deparseSourceNode(node.condition, 0)}) ${deparseSourceNode(node.body, 0)}`;
    case "RepeatExpression":
      return `repeat ${deparseSourceNode(node.body, 0)}`;
    case "BreakExpression":
      return "break";
    case "NextExpression":
      return "next";
    case "ReturnExpression":
      return node.value === undefined ? "return()" : `return(${deparseSourceNode(node.value, 0)})`;
    case "SubsetExpression": {
      if (node.operator === "$" || node.operator === "@") {
        const member = node.arguments[0];
        return `${deparseSourceNode(node.target, 100)}${node.operator}${
          member === undefined ? "" : deparseSourceNode(member.value, 100)
        }`;
      }
      const close = node.operator === "[[" ? "]]" : "]";
      return `${deparseSourceNode(node.target, 100)}${node.operator}${node.arguments
        .map((argument) => {
          const value = deparseSourceNode(argument.value, 0);
          return argument.name === undefined ? value : `${argument.name} = ${value}`;
        })
        .join(", ")}${close}`;
    }
    case "NamespaceExpression":
      return `${deparseSourceNode(node.namespace, 100)}${node.operator}${deparseSourceNode(node.member, 100)}`;
    case "FormulaExpression": {
      const precedence = 20;
      const rendered =
        node.left === undefined
          ? `~${deparseSourceNode(node.right, precedence)}`
          : `${deparseSourceNode(node.left, precedence)} ~ ${deparseSourceNode(node.right, precedence)}`;
      return precedence < parentPrecedence ? `(${rendered})` : rendered;
    }
    case "PipeExpression": {
      const precedence = 25;
      const rendered = `${deparseSourceNode(node.left, precedence, "left", node.operator)} ${node.operator} ${deparseSourceNode(node.right, precedence, "right", node.operator)}`;
      return precedence < parentPrecedence ? `(${rendered})` : rendered;
    }
    case "ConstantExpression":
      return deparseSourceNode(node.display, parentPrecedence, side, parentOperator);
    case "UnsupportedExpression":
      if (node.feature === "missing argument") return "";
      if (node.feature === "dots") return "...";
      return `<${node.feature}>`;
    default:
      return assertNever(node);
  }
}

function sourceOperatorSeparator(operator: string): string {
  // GNU deparse omits surrounding whitespace for the compact arithmetic operators while
  // retaining spaces around multiplication, comparisons, logical operators, and custom infix
  // calls. This distinction is observable when packages turn language objects into text.
  return [":", "^", "/", "%%", "%/%"].includes(operator) ? operator : ` ${operator} `;
}

function isSpecialInfixCall(
  node: Extract<AstNode, { readonly kind: "CallExpression" }>,
): node is Extract<AstNode, { readonly kind: "CallExpression" }> & {
  readonly callee: Extract<AstNode, { readonly kind: "Identifier" }>;
} {
  return (
    node.callee.kind === "Identifier" &&
    /^%.*%$/u.test(node.callee.name) &&
    node.arguments.length === 2 &&
    node.arguments.every((argument) => argument.name === undefined)
  );
}

function sourceOperatorPrecedence(operator: string): number {
  if (operator === "^") return 90;
  if (operator === ":") return 80;
  if (operator.startsWith("%") && operator.endsWith("%")) return 75;
  if (operator === "*" || operator === "/") return 70;
  if (operator === "+" || operator === "-") return 60;
  if (["<", ">", "<=", ">=", "==", "!="].includes(operator)) return 50;
  if (operator === "&" || operator === "&&") return 40;
  if (operator === "|" || operator === "||") return 30;
  return 55;
}

/** Expose one language object through R's pairlist-like call-entry model. */
export function languageEntries(input: RLanguage): RList {
  const entries = languageValueEntries(input) ?? { nodes: [input.expression] };
  const values = entries.nodes.map(quoteLanguageAst);
  const names = entries.names;
  return names === undefined
    ? listValue(values)
    : listValue(
        values,
        Array.from({ length: values.length }, (_, index) => names[index] ?? ""),
      );
}

/** Rebuild a language object after generic list-like call entry selection or replacement. */
export function languageFromEntries(input: RVector | RPairlist): RLanguage | typeof R_NULL {
  if (input.type !== "list" && input.type !== "pairlist") {
    throw new TypeError("Language entry operations must preserve list-like storage.");
  }
  if (input.length === 0) return R_NULL;
  const suppliedNames = vectorNames(input);
  const names = suppliedNames?.some((name) => name.length > 0) ? suppliedNames : undefined;
  const nodes = input.values.map(languageValueAst);
  const callee = nodes[0] as AstNode;
  const rebuilt = rebuildStructuredLanguage(callee, nodes);
  if (rebuilt !== undefined) {
    return {
      type: "language",
      expression: rebuilt,
      attributes: new Map(),
      ...(names?.[0] ? { headTag: names[0] } : {}),
    };
  }
  if (
    callee.kind === "Identifier" &&
    (callee.name === "[" || callee.name === "[[" || callee.name === "$" || callee.name === "@") &&
    nodes.length >= 2
  ) {
    const arguments_ = nodes.slice(2).map((value, index): CallArgument => {
      const name = names?.[index + 2];
      return {
        ...(name === undefined || name.length === 0 ? {} : { name }),
        value,
        span: value.span,
      };
    });
    return {
      type: "language",
      expression: {
        kind: "SubsetExpression",
        operator: callee.name,
        target: nodes[1] as AstNode,
        arguments: Object.freeze(arguments_),
        span: SYNTHETIC_SPAN,
      },
      attributes: new Map(),
      ...(names?.[0] ? { headTag: names[0] } : {}),
    };
  }
  const arguments_ = nodes.slice(1).map((expression, index): CallArgument => {
    const name = names?.[index + 1];
    return {
      ...(name === undefined || name.length === 0 ? {} : { name }),
      value: expression,
      span: expression.span,
    };
  });
  return {
    type: "language",
    expression: {
      kind: "CallExpression",
      callee,
      arguments: Object.freeze(arguments_),
      span: SYNTHETIC_SPAN,
    },
    attributes: new Map(),
    ...(names?.[0] ? { headTag: names[0] } : {}),
  };
}

function rebuildStructuredLanguage(
  callee: AstNode,
  nodes: readonly AstNode[],
): AstNode | undefined {
  if (callee.kind !== "Identifier") return undefined;
  const operands = nodes.slice(1);
  const binaryOperators = new Set([
    "+",
    "-",
    "*",
    "/",
    "^",
    "%%",
    "%/%",
    ":",
    "==",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "&",
    "&&",
    "|",
    "||",
  ]);
  if (callee.name === "{") {
    return { kind: "Block", body: Object.freeze([...operands]), span: SYNTHETIC_SPAN };
  }
  const formals =
    operands[0]?.kind === "ConstantExpression" ? (operands[0].value as RValue) : undefined;
  if (
    callee.name === "function" &&
    operands.length === 2 &&
    (formals?.type === "pairlist" || formals?.type === "null")
  ) {
    const names = formals.type === "pairlist" ? (vectorNames(formals) ?? []) : [];
    return {
      kind: "FunctionExpression",
      parameters: Object.freeze(
        (formals.type === "pairlist" ? formals.values : []).map((value, index) => ({
          name: names[index] ?? "",
          ...(value.type === "symbol" && value.name === ""
            ? {}
            : { defaultValue: languageValueAst(value) }),
          span: SYNTHETIC_SPAN,
        })),
      ),
      body: operands[1] as AstNode,
      span: SYNTHETIC_SPAN,
    };
  }
  if (callee.name === "if" && (operands.length === 2 || operands.length === 3)) {
    return {
      kind: "IfExpression",
      condition: operands[0] as AstNode,
      consequence: operands[1] as AstNode,
      ...(operands[2] === undefined ? {} : { alternative: operands[2] }),
      span: SYNTHETIC_SPAN,
    };
  }
  if (callee.name === "for" && operands.length === 3) {
    return {
      kind: "ForExpression",
      variable: operands[0] as AstNode,
      sequence: operands[1] as AstNode,
      body: operands[2] as AstNode,
      span: SYNTHETIC_SPAN,
    };
  }
  if (callee.name === "while" && operands.length === 2) {
    return {
      kind: "WhileExpression",
      condition: operands[0] as AstNode,
      body: operands[1] as AstNode,
      span: SYNTHETIC_SPAN,
    };
  }
  if (callee.name === "repeat" && operands.length === 1) {
    return { kind: "RepeatExpression", body: operands[0] as AstNode, span: SYNTHETIC_SPAN };
  }
  if (callee.name === "return" && operands.length <= 1) {
    return {
      kind: "ReturnExpression",
      ...(operands[0] === undefined ? {} : { value: operands[0] }),
      span: SYNTHETIC_SPAN,
    };
  }
  if (callee.name === "break" && operands.length === 0) {
    return { kind: "BreakExpression", span: SYNTHETIC_SPAN };
  }
  if (callee.name === "next" && operands.length === 0) {
    return { kind: "NextExpression", span: SYNTHETIC_SPAN };
  }
  if (callee.name === "~" && (operands.length === 1 || operands.length === 2)) {
    return {
      kind: "FormulaExpression",
      ...(operands.length === 1 ? {} : { left: operands[0] }),
      right: operands[operands.length - 1] as AstNode,
      span: SYNTHETIC_SPAN,
    };
  }
  if (callee.name === "|>" && operands.length === 2) {
    return {
      kind: "PipeExpression",
      operator: "|>",
      left: operands[0] as AstNode,
      right: operands[1] as AstNode,
      span: SYNTHETIC_SPAN,
    };
  }
  if (["<-", "=", "<<-", "->", "->>"].includes(callee.name) && operands.length === 2) {
    const target = operands[0];
    const value = operands[1];
    if (target?.kind === "Identifier") {
      return {
        kind: "AssignmentExpression",
        operator: callee.name as "<-" | "=" | "<<-" | "->" | "->>",
        target,
        value: value as AstNode,
        span: SYNTHETIC_SPAN,
      };
    }
    if (target?.kind === "SubsetExpression" || target?.kind === "CallExpression") {
      return {
        kind: "ReplacementExpression",
        operator: callee.name as "<-" | "=" | "<<-" | "->" | "->>",
        target,
        value: value as AstNode,
        span: SYNTHETIC_SPAN,
      };
    }
  }
  if (["::", ":::"].includes(callee.name) && operands.length === 2) {
    return {
      kind: "NamespaceExpression",
      operator: callee.name as "::" | ":::",
      namespace: operands[0] as AstNode,
      member: operands[1] as AstNode,
      span: SYNTHETIC_SPAN,
    };
  }
  if (["+", "-", "!"].includes(callee.name) && operands.length === 1) {
    return {
      kind: "UnaryExpression",
      operator: callee.name,
      operand: operands[0] as AstNode,
      span: SYNTHETIC_SPAN,
    };
  }
  if (operands.length === 2 && (binaryOperators.has(callee.name) || /^%.*%$/u.test(callee.name))) {
    return {
      kind: "BinaryExpression",
      operator: callee.name,
      left: operands[0] as AstNode,
      right: operands[1] as AstNode,
      span: SYNTHETIC_SPAN,
    };
  }
  return undefined;
}

/** Expose the ordered head and arguments of any normalized call-shaped value. */
export function languageAstEntries(
  expression: AstNode,
): { readonly nodes: readonly AstNode[]; readonly names?: readonly string[] } | undefined {
  const operator = (name: string): AstNode => ({
    kind: "Identifier",
    name,
    span: SYNTHETIC_SPAN,
  });
  switch (expression.kind) {
    case "CallExpression": {
      const names = expression.arguments.some((argument) => argument.name !== undefined)
        ? ["", ...expression.arguments.map((argument) => argument.name ?? "")]
        : undefined;
      return {
        nodes: [expression.callee, ...expression.arguments.map((argument) => argument.value)],
        ...(names === undefined ? {} : { names }),
      };
    }
    case "UnaryExpression":
      return { nodes: [operator(expression.operator), expression.operand] };
    case "BinaryExpression":
    case "PipeExpression":
      return { nodes: [operator(expression.operator), expression.left, expression.right] };
    case "AssignmentExpression":
    case "ReplacementExpression":
      return { nodes: [operator(expression.operator), expression.target, expression.value] };
    case "SubsetExpression": {
      const names = expression.arguments.some((argument) => argument.name !== undefined)
        ? ["", "", ...expression.arguments.map((argument) => argument.name ?? "")]
        : undefined;
      return {
        nodes: [
          operator(expression.operator),
          expression.target,
          ...expression.arguments.map((argument) => argument.value),
        ],
        ...(names === undefined ? {} : { names }),
      };
    }
    case "NamespaceExpression":
      return { nodes: [operator(expression.operator), expression.namespace, expression.member] };
    case "FormulaExpression":
      return {
        nodes:
          expression.left === undefined
            ? [operator("~"), expression.right]
            : [operator("~"), expression.left, expression.right],
      };
    case "IfExpression":
      return {
        nodes: [
          operator("if"),
          expression.condition,
          expression.consequence,
          ...(expression.alternative === undefined ? [] : [expression.alternative]),
        ],
      };
    case "ForExpression":
      return {
        nodes: [operator("for"), expression.variable, expression.sequence, expression.body],
      };
    case "WhileExpression":
      return { nodes: [operator("while"), expression.condition, expression.body] };
    case "RepeatExpression":
      return { nodes: [operator("repeat"), expression.body] };
    case "ReturnExpression":
      return {
        nodes: [operator("return"), ...(expression.value === undefined ? [] : [expression.value])],
      };
    case "Block":
    case "Program":
      return { nodes: [operator("{"), ...expression.body] };
    default:
      return undefined;
  }
}

/** Validate every display node before recursive syntax formatting. */
export function validateDeparseSyntax(roots: readonly AstNode[], checkWork?: () => void): void {
  const stack = roots.map((node) => ({ node, depth: 0 }));
  while (stack.length > 0) {
    checkWork?.();
    const entry = stack.pop();
    if (entry === undefined) break;
    if (entry.depth > 512) {
      throw new RResourceLimitError("NRL4004", "Maximum syntax deparse depth exceeded.");
    }
    const { node, depth } = entry;
    const children =
      node.kind === "FunctionExpression"
        ? [
            ...node.parameters.flatMap((parameter) =>
              parameter.defaultValue === undefined ? [] : [parameter.defaultValue],
            ),
            node.body,
          ]
        : node.kind === "ConstantExpression"
          ? [node.display]
          : (languageAstEntries(node)?.nodes ?? []);
    for (const child of children) stack.push({ node: child, depth: depth + 1 });
  }
}

/** Convert normalized syntax to the corresponding unevaluated R language entry. */
export function quoteLanguageAst(node: AstNode): RValue {
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
      return characterVector([node.value]);
    case "LogicalLiteral":
      return logicalVector([node.value]);
    case "NullLiteral":
      return R_NULL;
    case "MissingLiteral":
      return missingValue(node.declaredType);
    case "UnsupportedExpression":
      if (node.feature === "dots") return { type: "symbol", name: "..." };
      if (node.feature === "missing argument") return { type: "symbol", name: "" };
      return languageValue(node);
    default:
      return languageValue(node);
  }
}

/** Embed one unevaluated R value back into normalized language syntax. */
export function languageValueAst(value: RValue): AstNode {
  if (value.type === "symbol") {
    if (value.name === "") {
      return {
        kind: "UnsupportedExpression",
        feature: "missing argument",
        span: SYNTHETIC_SPAN,
      };
    }
    return { kind: "Identifier", name: value.name, span: SYNTHETIC_SPAN };
  }
  if (value.type === "language") return value.expression;
  const display = languageValueDisplayAst(value);
  return { kind: "ConstantExpression", value, display, span: SYNTHETIC_SPAN };
}

function languageValueDisplayAst(value: RValue): AstNode {
  if (value.type === "null") return { kind: "NullLiteral", span: SYNTHETIC_SPAN };
  if (value.type === "symbol") {
    return { kind: "Identifier", name: value.name, span: SYNTHETIC_SPAN };
  }
  if (value.type === "language") return value.expression;
  if (value.type === "expression") {
    return displayCall("expression", value.values);
  }
  if (isAtomicLanguageValue(value)) {
    if (
      (value.type === "integer" || value.type === "double") &&
      value.length > 1 &&
      value.missing === undefined
    ) {
      const first = value.values[0] ?? 0;
      const last = value.values[value.length - 1] ?? 0;
      const step = value.length > 1 ? (value.values[1] ?? first) - first : 0;
      if (
        (step === 1 || step === -1) &&
        Array.from(value.values).every((entry, index) => entry === first + index * step)
      ) {
        return {
          kind: "BinaryExpression",
          operator: ":",
          left: { kind: "DoubleLiteral", value: first, span: SYNTHETIC_SPAN },
          right: { kind: "DoubleLiteral", value: last, span: SYNTHETIC_SPAN },
          span: SYNTHETIC_SPAN,
        };
      }
    }
    const entries = Array.from({ length: value.length }, (_, index) =>
      atomicDisplayAst(value, index),
    );
    if (entries.length === 1) return entries[0] as AstNode;
    return displayCall("c", entries);
  }
  if (value.type === "list" || value.type === "pairlist") {
    return displayCall(
      value.type === "list" ? "list" : "pairlist",
      value.values.map(languageValueDisplayAst),
      vectorNames(value),
    );
  }
  return { kind: "StringLiteral", value: `<${value.type}>`, span: SYNTHETIC_SPAN };
}

function deparseIdentifier(name: string): string {
  if (/^(?:[A-Za-z]|\.(?![0-9]))[A-Za-z0-9._]*$/u.test(name)) return name;
  if (LANGUAGE_OPERATOR_NAMES.has(name)) {
    return name;
  }
  const escaped = name
    .replaceAll("\\", "\\\\")
    .replaceAll("\u0007", "\\a")
    .replaceAll("\b", "\\b")
    .replaceAll("\f", "\\f")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t")
    .replaceAll("\v", "\\v")
    .replaceAll("`", "\\`");
  return `\`${escaped}\``;
}

function displayCall(name: string, values: readonly AstNode[], names?: readonly string[]): AstNode {
  return {
    kind: "CallExpression",
    callee: { kind: "Identifier", name, span: SYNTHETIC_SPAN },
    arguments: Object.freeze(
      values.map((value, index) => ({
        ...(names?.[index] ? { name: names[index] } : {}),
        value,
        span: value.span,
      })),
    ),
    span: SYNTHETIC_SPAN,
  };
}

function isAtomicLanguageValue(value: RValue): value is AtomicVector {
  return (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "complex" ||
    value.type === "character" ||
    value.type === "raw"
  );
}

function atomicDisplayAst(value: AtomicVector, index: number): AstNode {
  if (value.missing?.[index] === 1) {
    return {
      kind: "MissingLiteral",
      declaredType: value.type === "raw" ? "logical" : value.type,
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
    case "complex": {
      const real = value.real[index] ?? 0;
      const imaginary = value.imaginary[index] ?? 0;
      if (real === 0) return { kind: "ComplexLiteral", imaginary, span: SYNTHETIC_SPAN };
      return {
        kind: "BinaryExpression",
        operator: imaginary < 0 ? "-" : "+",
        left: { kind: "DoubleLiteral", value: real, span: SYNTHETIC_SPAN },
        right: { kind: "ComplexLiteral", imaginary: Math.abs(imaginary), span: SYNTHETIC_SPAN },
        span: SYNTHETIC_SPAN,
      };
    }
    case "character":
      return {
        kind: "StringLiteral",
        value: value.values[index] ?? "",
        span: SYNTHETIC_SPAN,
      };
    case "raw":
      return {
        kind: "IntegerLiteral",
        value: value.values[index] ?? 0,
        span: SYNTHETIC_SPAN,
      };
    default:
      return assertNever(value);
  }
}

function deparseArgument(argument: CallArgument, diagnostic = false): string {
  const source = deparseWithFollowing(argument.value, 0, diagnostic);
  const value = deparseOperation(argument.value)?.operator === "=" ? `(${source})` : source;
  return argument.name === undefined ? value : `${deparseName(argument.name)} = ${value}`;
}

function deparseName(name: string): string {
  const reserved = [
    "if",
    "else",
    "repeat",
    "while",
    "function",
    "for",
    "in",
    "next",
    "break",
    "TRUE",
    "FALSE",
    "NULL",
    "Inf",
    "NaN",
    "NA",
    "NA_integer_",
    "NA_real_",
    "NA_complex_",
    "NA_character_",
  ];
  if (/^(?:\p{L}|\.(?!\d))[\p{L}\p{N}._]*$/u.test(name) && !reserved.includes(name)) return name;
  const escapes: Readonly<Record<string, string>> = {
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\b": "\\b",
    "\f": "\\f",
    "\v": "\\v",
    "\u0007": "\\a",
    "\\": "\\\\",
    "`": "\\`",
  };
  const escaped = Array.from(name, (character) => {
    const escape = escapes[character];
    if (escape !== undefined) return escape;
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? `\\${code.toString(8).padStart(3, "0")}` : character;
  }).join("");
  return `\`${escaped}\``;
}

function deparseExpressionArgument(argument: CallArgument): string {
  const value =
    argument.value.kind === "Identifier" && LANGUAGE_OPERATOR_NAMES.has(argument.value.name)
      ? `\`${argument.value.name.replaceAll("`", "\\`")}\``
      : deparseAst(argument.value);
  return argument.name === undefined ? value : `${argument.name} = ${value}`;
}

function formatNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Number.POSITIVE_INFINITY) return "Inf";
  if (value === Number.NEGATIVE_INFINITY) return "-Inf";
  if (Object.is(value, -0)) return "0";
  return String(value);
}
