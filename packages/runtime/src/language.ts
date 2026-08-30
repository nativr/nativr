import { assertNever } from "@nativr/ast";
import type { AstNode, CallArgument } from "@nativr/ast";

import {
  characterVector,
  complexVector,
  doubleVector,
  integerVector,
  listValue,
  logicalVector,
  missingValue,
  pairlistValue,
  R_NULL,
  vectorNames,
} from "./values.js";
import type { RLanguage, RList, RPairlist, RValue, RVector } from "./values.js";

type AtomicVector = Exclude<RVector, RList>;

const SYNTHETIC_SPAN = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
} as const;
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
export function deparseAst(node: AstNode): string {
  switch (node.kind) {
    case "Program":
      return node.body.map(deparseAst).join("\n");
    case "Block":
      return `{ ${node.body.map(deparseAst).join("; ")} }`;
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
    case "UnaryExpression":
      return `${node.operator}(${deparseAst(node.operand)})`;
    case "BinaryExpression":
      return node.operator === ":"
        ? `${deparseAst(node.left)}:${deparseAst(node.right)}`
        : `(${deparseAst(node.left)} ${node.operator} ${deparseAst(node.right)})`;
    case "AssignmentExpression":
    case "ReplacementExpression":
      return `(${deparseAst(node.target)} ${node.operator} ${deparseAst(node.value)})`;
    case "CallExpression":
      if (isSpecialInfixCall(node)) {
        return `(${deparseAst(node.arguments[0]?.value as AstNode)} ${node.callee.name} ${deparseAst(node.arguments[1]?.value as AstNode)})`;
      }
      return node.callee.kind === "Identifier" &&
        node.callee.name === "(" &&
        node.arguments.length === 1
        ? `(${deparseAst(node.arguments[0]?.value as AstNode)})`
        : `${deparseAst(node.callee)}(${node.arguments
            .map(
              node.callee.kind === "Identifier" && node.callee.name === "expression"
                ? deparseExpressionArgument
                : deparseArgument,
            )
            .join(", ")})`;
    case "FunctionExpression":
      return `${node.syntax === "lambda" ? "\\" : "function"}(${node.parameters
        .map((parameter) =>
          parameter.defaultValue === undefined
            ? deparseIdentifier(parameter.name)
            : `${deparseIdentifier(parameter.name)} = ${deparseAst(parameter.defaultValue)}`,
        )
        .join(", ")}) ${deparseAst(node.body)}`;
    case "IfExpression":
      return `if (${deparseAst(node.condition)}) ${deparseAst(node.consequence)}${
        node.alternative === undefined ? "" : ` else ${deparseAst(node.alternative)}`
      }`;
    case "ForExpression":
      return `for (${deparseAst(node.variable)} in ${deparseAst(node.sequence)}) ${deparseAst(node.body)}`;
    case "WhileExpression":
      return `while (${deparseAst(node.condition)}) ${deparseAst(node.body)}`;
    case "RepeatExpression":
      return `repeat ${deparseAst(node.body)}`;
    case "BreakExpression":
      return "break";
    case "NextExpression":
      return "next";
    case "ReturnExpression":
      return node.value === undefined ? "return()" : `return(${deparseAst(node.value)})`;
    case "SubsetExpression": {
      if (node.operator === "$" || node.operator === "@") {
        const member = node.arguments[0];
        return `${deparseAst(node.target)}${node.operator}${
          member === undefined ? "" : deparseAst(member.value)
        }`;
      }
      const close = node.operator === "[[" ? "]]" : "]";
      return `${deparseAst(node.target)}${node.operator}${node.arguments
        .map(deparseArgument)
        .join(", ")}${close}`;
    }
    case "NamespaceExpression":
      return `${deparseAst(node.namespace)}${node.operator}${deparseAst(node.member)}`;
    case "FormulaExpression":
      return node.left === undefined
        ? `~${deparseAst(node.right)}`
        : `${deparseAst(node.left)} ~ ${deparseAst(node.right)}`;
    case "PipeExpression":
      return `(${deparseAst(node.left)} ${node.operator} ${deparseAst(node.right)})`;
    case "ConstantExpression":
      return deparseAst(node.display);
    case "UnsupportedExpression":
      if (node.feature === "missing argument") return "";
      if (node.feature === "dots") return "...";
      return `<${node.feature}>`;
    default:
      return assertNever(node);
  }
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
  const entries = languageAstEntries(input.expression);
  const values = entries.nodes.map(quoteLanguageAst);
  const names = input.entryNames ?? entries.names;
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
      ...(names === undefined ? {} : { entryNames: Object.freeze([...names]) }),
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
      ...(names === undefined ? {} : { entryNames: Object.freeze([...names]) }),
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
    ...(names === undefined ? {} : { entryNames: Object.freeze([...names]) }),
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

function languageAstEntries(expression: AstNode): {
  readonly nodes: readonly AstNode[];
  readonly names?: readonly string[];
} {
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
    case "BreakExpression":
      return { nodes: [operator("break")] };
    case "NextExpression":
      return { nodes: [operator("next")] };
    case "FunctionExpression": {
      const formals = pairlistValue(
        expression.parameters.map((parameter) =>
          parameter.defaultValue === undefined
            ? { type: "symbol" as const, name: "" }
            : quoteLanguageAst(parameter.defaultValue),
        ),
        expression.parameters.map((parameter) => parameter.name),
      );
      return {
        nodes: [operator("function"), languageValueAst(formals), expression.body],
      };
    }
    case "Block":
    case "Program":
      return { nodes: [operator("{"), ...expression.body] };
    default:
      return { nodes: [expression] };
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
      return { type: "language", expression: node };
    default:
      return { type: "language", expression: node };
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

function deparseArgument(argument: CallArgument): string {
  const value = deparseAst(argument.value);
  return argument.name === undefined ? value : `${argument.name} = ${value}`;
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
