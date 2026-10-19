import { assertNever } from "@nativr/ast";
import type { AstNode, CallArgument, SourceSpan } from "@nativr/ast";

import { RResourceLimitError } from "./errors.js";
import type { RValue } from "./values.js";

const SYNTHETIC_SPAN: SourceSpan = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

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
      return `for (${deparseName(node.variable.name)} in ${render(node.sequence)}) ${render(node.body)}`;
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

function formatNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Number.POSITIVE_INFINITY) return "Inf";
  if (value === Number.NEGATIVE_INFINITY) return "-Inf";
  if (Object.is(value, -0)) return "0";
  return String(value);
}
