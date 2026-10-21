import type { AstNode, CallArgument, FunctionParameter } from "@nativr/ast";

import {
  deparseAst,
  deparseOperation,
  expressionPrecedence,
  operandNeedsGrouping,
  validateDeparseSyntax,
} from "./language.js";
import type { DeparseOperation } from "./language.js";
import type { RClosure, RValue } from "./values.js";
import { displayValueWithoutAttributes } from "./language-subset.js";

/** Layout controls for source-independent R syntax rendering. */
export interface DeparseLinesOptions {
  readonly widthCutoff?: number;
  readonly maxLines?: number;
  readonly checkWork?: () => void;
  /** Static language primitive classification supplied by the composing base layer. */
  readonly isPrimitive?: (name: string) => boolean;
  /** Closure attributes rendered as named structure() arguments; ignored for bare ASTs. */
  readonly attributes?: readonly CallArgument[];
}

/** Render a closure's formals and body; environment and attributes belong to its value printer. */
export function deparseClosureLines(
  closure: RClosure,
  options: DeparseLinesOptions = {},
): readonly string[] {
  const renderer = new SyntaxRenderer(options);
  renderer.validate([
    ...closure.parameters.flatMap((parameter) =>
      parameter.defaultValue === undefined ? [] : [parameter.defaultValue],
    ),
    closure.body,
    ...(options.attributes?.map((attribute) => attribute.value) ?? []),
  ]);
  renderer.closure(closure, options.attributes ?? []);
  return renderer.lines();
}

/** Render normalized syntax with structural indentation and token-boundary continuation lines. */
export function deparseAstLines(
  node: AstNode,
  options: DeparseLinesOptions = {},
): readonly string[] {
  const renderer = new SyntaxRenderer(options);
  renderer.validate([node]);
  renderer.render(node, 0, false);
  return renderer.lines();
}

class SyntaxRenderer {
  readonly #width: number;
  readonly #maxLines: number;
  readonly #checkWork: () => void;
  readonly #isPrimitive: (name: string) => boolean;
  readonly #lines: string[] = [];
  #line = "";
  #complete = false;
  #omitValueAttributes = false;

  public constructor(options: DeparseLinesOptions) {
    this.#width = options.widthCutoff ?? 60;
    this.#maxLines =
      options.maxLines !== undefined && options.maxLines > 0
        ? Math.trunc(options.maxLines)
        : Number.POSITIVE_INFINITY;
    this.#checkWork = options.checkWork ?? (() => undefined);
    this.#isPrimitive = options.isPrimitive ?? (() => false);
  }

  /** Bound recursive rendering before entering shared compact precedence helpers. */
  public validate(roots: readonly AstNode[]): void {
    validateDeparseSyntax(roots, this.#checkWork);
  }

  public lines(): readonly string[] {
    return this.#complete ? this.#lines : [...this.#lines, this.#line];
  }

  #write(text: string): void {
    if (this.#complete) return;
    // Check long literal/name formatting as well as AST traversal.
    for (let offset = 0; offset < text.length; offset += 4096) this.#checkWork();
    this.#line += text;
  }

  public newline(indent: number): void {
    if (this.#complete) return;
    this.#checkWork();
    this.#lines.push(this.#line);
    if (this.#lines.length >= this.#maxLines) {
      this.#complete = true;
      return;
    }
    this.#line = " ".repeat(indent);
  }

  #softBreak(indent: number): boolean {
    if (this.#line.length <= this.#width) return false;
    this.newline(indent);
    return true;
  }

  #name(name: string, reference: AstNode): void {
    this.#write(deparseAst({ kind: "Identifier", name, span: reference.span }));
  }

  public closure(closure: RClosure, attributes: readonly CallArgument[]): void {
    if (attributes.length > 0) this.#write("structure(");
    this.#functionSyntax(closure.parameters, closure.body, true, 0, false, true);
    if (attributes.length > 0) {
      this.#arguments(attributes, 0, false, true);
      this.#write(")");
    }
  }

  #functionSyntax(
    parameters: readonly FunctionParameter[],
    body: AstNode,
    root: boolean,
    indent: number,
    inBlock: boolean,
    separateBody: boolean,
  ): void {
    const previous = this.#omitValueAttributes;
    this.#omitValueAttributes = true;
    try {
      this.formals(parameters, root, indent, inBlock);
      if (separateBody) this.newline(indent);
      this.render(body, indent, inBlock);
    } finally {
      this.#omitValueAttributes = previous;
    }
  }

  public formals(
    parameters: readonly FunctionParameter[],
    root: boolean,
    indent: number,
    inBlock: boolean,
  ): void {
    this.#write(root ? "function (" : "function(");
    const continuation = indent + 4;
    let argumentIndent = indent;
    for (let index = 0; index < parameters.length && !this.#complete; index += 1) {
      const parameter = parameters[index];
      if (parameter === undefined) continue;
      if (index > 0) {
        this.#write(", ");
        if (this.#softBreak(continuation)) argumentIndent = continuation;
      }
      this.#name(parameter.name, { kind: "NullLiteral", span: parameter.span });
      if (parameter.defaultValue !== undefined) {
        this.#write(" = ");
        this.render(parameter.defaultValue, argumentIndent, inBlock);
      }
    }
    this.#write(") ");
  }

  #arguments(
    arguments_: readonly CallArgument[],
    indent: number,
    inBlock: boolean,
    leadingComma = false,
  ): void {
    const continuation = indent + 4;
    let argumentIndent = indent;
    for (let index = 0; index < arguments_.length && !this.#complete; index += 1) {
      const argument = arguments_[index];
      if (argument === undefined) continue;
      if (index > 0 || leadingComma) {
        this.#write(", ");
        if (this.#softBreak(continuation)) argumentIndent = continuation;
      }
      if (argument.name !== undefined) {
        this.#name(argument.name, argument.value);
        this.#write(" = ");
      }
      const grouped = deparseOperation(argument.value)?.operator === "=";
      if (grouped) this.#write("(");
      this.render(argument.value, argumentIndent, inBlock);
      if (grouped) this.#write(")");
    }
  }

  #target(node: AstNode, indent: number, inBlock: boolean): void {
    const grouped = expressionPrecedence(node) < 16;
    if (grouped) this.#write("(");
    this.render(node, indent, inBlock);
    if (grouped) this.#write(")");
  }

  #operand(
    node: AstNode,
    operation: DeparseOperation,
    side: "left" | "right",
    followingPrecedence: number,
    indent: number,
    inBlock: boolean,
  ): void {
    const grouped = operandNeedsGrouping(node, operation, side, followingPrecedence);
    if (grouped) this.#write("(");
    this.render(node, indent, inBlock, grouped ? 0 : followingPrecedence);
    if (grouped) this.#write(")");
  }

  public render(node: AstNode, indent: number, inBlock: boolean, followingPrecedence = 0): void {
    if (this.#complete) return;
    this.#checkWork();
    if (node.kind === "ConstantExpression") {
      const value = node.value as RValue;
      const display = this.#omitValueAttributes
        ? displayValueWithoutAttributes(value, this.#checkWork)
        : node.display;
      // An embedded closure value deparses like deparse(f): "function (x) ", a line break, the body.
      if (value.type === "closure" && display.kind === "FunctionExpression") {
        this.#functionSyntax(value.parameters, value.body, true, indent, inBlock, true);
        return;
      }
      this.render(display, indent, inBlock, followingPrecedence);
      return;
    }
    const operation = deparseOperation(node);
    if (operation !== undefined) {
      const continuation = indent + 4;
      let rightIndent = indent;
      if (operation.left !== undefined) {
        this.#operand(operation.left, operation, "left", operation.precedence, indent, inBlock);
        const separator = [":", "^", "/", "%%", "%/%"].includes(operation.operator) ? "" : " ";
        this.#write(`${separator}${operation.operator}${separator}`);
        if (
          separator !== "" &&
          !["<-", "<<-", "="].includes(operation.operator) &&
          this.#softBreak(continuation)
        )
          rightIndent = continuation;
      } else this.#write(operation.operator);
      this.#operand(operation.right, operation, "right", followingPrecedence, rightIndent, inBlock);
      return;
    }
    switch (node.kind) {
      case "Program":
        for (let index = 0; index < node.body.length && !this.#complete; index += 1) {
          const child = node.body[index];
          if (child === undefined) continue;
          if (index > 0) this.newline(indent);
          this.render(child, indent, false);
        }
        return;
      case "Block":
        this.#write("{");
        for (const child of node.body) {
          if (this.#complete) break;
          this.newline(indent + 4);
          this.render(child, indent + 4, true);
        }
        this.newline(indent);
        this.#write("}");
        return;
      case "FunctionExpression":
        this.#functionSyntax(node.parameters, node.body, false, indent, inBlock, false);
        return;
      case "IfExpression":
        this.#write("if (");
        this.render(node.condition, indent, inBlock);
        this.#write(") ");
        if (inBlock && node.consequence.kind !== "Block") {
          this.newline(indent + 4);
          this.render(node.consequence, indent + 4, true);
        } else this.render(node.consequence, indent, inBlock);
        if (node.alternative !== undefined) {
          if (inBlock) this.newline(indent);
          else this.#write(" ");
          this.#write("else ");
          this.render(node.alternative, indent, inBlock);
        }
        return;
      case "ForExpression":
        this.#write("for (");
        this.#name(node.variable.name, node.variable);
        this.#write(" in ");
        this.render(node.sequence, indent, inBlock);
        this.#write(") ");
        this.render(node.body, indent, inBlock);
        return;
      case "WhileExpression":
        this.#write("while (");
        this.render(node.condition, indent, inBlock);
        this.#write(") ");
        this.render(node.body, indent, inBlock);
        return;
      case "RepeatExpression":
        this.#write("repeat ");
        this.render(node.body, indent, inBlock);
        return;
      case "ReturnExpression":
        this.#write("return(");
        if (node.value !== undefined) this.render(node.value, indent, false);
        this.#write(")");
        return;
      case "CallExpression":
        if (
          node.callee.kind === "Identifier" &&
          node.callee.name === "(" &&
          node.arguments.length === 1
        ) {
          this.#write("(");
          const argument = node.arguments[0];
          if (argument !== undefined) this.render(argument.value, indent, inBlock);
          this.#write(")");
        } else {
          this.#target(node.callee, indent, inBlock);
          this.#write("(");
          this.#arguments(
            node.arguments,
            indent,
            inBlock && !(node.callee.kind === "Identifier" && this.#isPrimitive(node.callee.name)),
          );
          this.#write(")");
        }
        return;
      case "SubsetExpression":
        this.#target(node.target, indent, inBlock);
        this.#write(node.operator);
        if (node.operator === "$" || node.operator === "@") {
          const member = node.arguments[0];
          if (member !== undefined) this.render(member.value, indent, false);
        } else {
          this.#arguments(node.arguments, indent, inBlock);
          this.#write(node.operator === "[[" ? "]]" : "]");
        }
        return;
      case "NamespaceExpression":
        this.render(node.namespace, indent, false);
        this.#write(node.operator);
        this.render(node.member, indent, false);
        return;
      default:
        this.#write(deparseAst(node));
    }
  }
}
