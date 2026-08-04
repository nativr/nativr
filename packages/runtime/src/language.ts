import { assertNever } from "@nativr/ast";
import type { AstNode, CallArgument } from "@nativr/ast";

/** Render normalized syntax into a stable R-like diagnostic representation. */
export function deparseAst(node: AstNode): string {
  switch (node.kind) {
    case "Program":
      return node.body.map(deparseAst).join("\n");
    case "Block":
      return `{ ${node.body.map(deparseAst).join("; ")} }`;
    case "Identifier":
      return node.name;
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
      return `(${deparseAst(node.left)} ${node.operator} ${deparseAst(node.right)})`;
    case "AssignmentExpression":
    case "ReplacementExpression":
      return `(${deparseAst(node.target)} ${node.operator} ${deparseAst(node.value)})`;
    case "CallExpression":
      return `${deparseAst(node.callee)}(${node.arguments.map(deparseArgument).join(", ")})`;
    case "FunctionExpression":
      return `function(${node.parameters
        .map((parameter) =>
          parameter.defaultValue === undefined
            ? parameter.name
            : `${parameter.name} = ${deparseAst(parameter.defaultValue)}`,
        )
        .join(", ")}) ${deparseAst(node.body)}`;
    case "IfExpression":
      return `if (${deparseAst(node.condition)}) ${deparseAst(node.consequence)}${
        node.alternative === undefined ? "" : ` else ${deparseAst(node.alternative)}`
      }`;
    case "ForExpression":
      return `for (${node.variable.name} in ${deparseAst(node.sequence)}) ${deparseAst(node.body)}`;
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

function deparseArgument(argument: CallArgument): string {
  const value = deparseAst(argument.value);
  return argument.name === undefined ? value : `${argument.name} = ${value}`;
}

function formatNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Number.POSITIVE_INFINITY) return "Inf";
  if (value === Number.NEGATIVE_INFINITY) return "-Inf";
  if (Object.is(value, -0)) return "0";
  return String(value);
}
