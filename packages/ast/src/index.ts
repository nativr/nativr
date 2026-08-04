/**
 * A zero-based UTF-16 offset paired with one-based user-facing line and column numbers.
 */
export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

/** A half-open source range in the original JavaScript string. */
export interface SourceSpan {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

/** Related context attached to a parser or compatibility diagnostic. */
export interface DiagnosticRelatedInformation {
  readonly message: string;
  readonly span?: SourceSpan;
}

/** A stable, machine-readable parser diagnostic. */
export interface Diagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly span?: SourceSpan;
  readonly hint?: string;
  readonly related?: readonly DiagnosticRelatedInformation[];
}

/** Common fields owned by every normalized NativR syntax node. */
export interface AstNodeBase {
  readonly kind: string;
  readonly span: SourceSpan;
}

/** A complete R source input. */
export interface ProgramNode extends AstNodeBase {
  readonly kind: "Program";
  readonly body: readonly AstNode[];
}

/** A braced sequence of expressions. */
export interface BlockNode extends AstNodeBase {
  readonly kind: "Block";
  readonly body: readonly AstNode[];
}

/** A symbol reference. */
export interface IdentifierNode extends AstNodeBase {
  readonly kind: "Identifier";
  readonly name: string;
}

/** A double-precision numeric literal, including Inf and NaN. */
export interface DoubleLiteralNode extends AstNodeBase {
  readonly kind: "DoubleLiteral";
  readonly value: number;
}

/** A purely imaginary numeric literal such as 2i. */
export interface ComplexLiteralNode extends AstNodeBase {
  readonly kind: "ComplexLiteral";
  readonly imaginary: number;
}

/** An R integer literal with the L suffix. */
export interface IntegerLiteralNode extends AstNodeBase {
  readonly kind: "IntegerLiteral";
  readonly value: number;
}

/** A quoted character literal. */
export interface StringLiteralNode extends AstNodeBase {
  readonly kind: "StringLiteral";
  readonly value: string;
}

/** A TRUE or FALSE literal. */
export interface LogicalLiteralNode extends AstNodeBase {
  readonly kind: "LogicalLiteral";
  readonly value: boolean;
}

/** The NULL literal. */
export interface NullLiteralNode extends AstNodeBase {
  readonly kind: "NullLiteral";
}

/** An R missing literal such as NA or NA_real_. */
export interface MissingLiteralNode extends AstNodeBase {
  readonly kind: "MissingLiteral";
  readonly declaredType: "logical" | "integer" | "double" | "character" | "complex";
}

/** A prefix operator expression. */
export interface UnaryExpressionNode extends AstNodeBase {
  readonly kind: "UnaryExpression";
  readonly operator: string;
  readonly operand: AstNode;
}

/** A binary operator expression. */
export interface BinaryExpressionNode extends AstNodeBase {
  readonly kind: "BinaryExpression";
  readonly operator: string;
  readonly left: AstNode;
  readonly right: AstNode;
}

/** A direct identifier assignment in either direction, optionally non-local. */
export interface AssignmentExpressionNode extends AstNodeBase {
  readonly kind: "AssignmentExpression";
  readonly operator: "<-" | "=" | "<<-" | "->" | "->>";
  readonly target: IdentifierNode;
  readonly value: AstNode;
}

/** A direct-binding replacement assignment such as x[i] <- value or names(x) <- value. */
export interface ReplacementExpressionNode extends AstNodeBase {
  readonly kind: "ReplacementExpression";
  readonly operator: "<-" | "=" | "<<-" | "->" | "->>";
  readonly target: SubsetExpressionNode | CallExpressionNode;
  readonly value: AstNode;
}

/** One supplied call argument. */
export interface CallArgument {
  readonly name?: string;
  readonly value: AstNode;
  readonly span: SourceSpan;
}

/** An ordinary function call. */
export interface CallExpressionNode extends AstNodeBase {
  readonly kind: "CallExpression";
  readonly callee: AstNode;
  readonly arguments: readonly CallArgument[];
}

/** One formal function parameter. */
export interface FunctionParameter {
  readonly name: string;
  readonly defaultValue?: AstNode;
  readonly span: SourceSpan;
}

/** An R function expression. */
export interface FunctionExpressionNode extends AstNodeBase {
  readonly kind: "FunctionExpression";
  readonly parameters: readonly FunctionParameter[];
  readonly body: AstNode;
}

/** A parsed if expression. */
export interface IfExpressionNode extends AstNodeBase {
  readonly kind: "IfExpression";
  readonly condition: AstNode;
  readonly consequence: AstNode;
  readonly alternative?: AstNode;
}

/** A parsed for expression. */
export interface ForExpressionNode extends AstNodeBase {
  readonly kind: "ForExpression";
  readonly variable: IdentifierNode;
  readonly sequence: AstNode;
  readonly body: AstNode;
}

/** A parsed while expression. */
export interface WhileExpressionNode extends AstNodeBase {
  readonly kind: "WhileExpression";
  readonly condition: AstNode;
  readonly body: AstNode;
}

/** A parsed repeat expression. */
export interface RepeatExpressionNode extends AstNodeBase {
  readonly kind: "RepeatExpression";
  readonly body: AstNode;
}

/** A loop-local break expression. */
export interface BreakExpressionNode extends AstNodeBase {
  readonly kind: "BreakExpression";
}

/** A loop-local next expression. */
export interface NextExpressionNode extends AstNodeBase {
  readonly kind: "NextExpression";
}

/** A parsed return call represented as a language form. */
export interface ReturnExpressionNode extends AstNodeBase {
  readonly kind: "ReturnExpression";
  readonly value?: AstNode;
}

/** A parsed subset, subset2, dollar, or slot expression. */
export interface SubsetExpressionNode extends AstNodeBase {
  readonly kind: "SubsetExpression";
  readonly operator: "[" | "[[" | "$" | "@";
  readonly target: AstNode;
  readonly arguments: readonly CallArgument[];
}

/** A parsed namespace expression. */
export interface NamespaceExpressionNode extends AstNodeBase {
  readonly kind: "NamespaceExpression";
  readonly operator: "::" | ":::";
  readonly namespace: AstNode;
  readonly member: AstNode;
}

/** A parsed formula expression. */
export interface FormulaExpressionNode extends AstNodeBase {
  readonly kind: "FormulaExpression";
  readonly left?: AstNode;
  readonly right: AstNode;
}

/** A parsed native pipe expression. */
export interface PipeExpressionNode extends AstNodeBase {
  readonly kind: "PipeExpression";
  readonly operator: "|>" | "%>%";
  readonly left: AstNode;
  readonly right: AstNode;
}

/** Valid R syntax retained for an evaluator-level unsupported-feature diagnostic. */
export interface UnsupportedExpressionNode extends AstNodeBase {
  readonly kind: "UnsupportedExpression";
  readonly feature: string;
}

/** A runtime-created constant embedded in a language object, with syntax used only for display. */
export interface ConstantExpressionNode extends AstNodeBase {
  readonly kind: "ConstantExpression";
  readonly value: unknown;
  readonly display: AstNode;
}

/** The normalized syntax union exposed by the parser package. */
export type AstNode =
  | ProgramNode
  | BlockNode
  | IdentifierNode
  | DoubleLiteralNode
  | ComplexLiteralNode
  | IntegerLiteralNode
  | StringLiteralNode
  | LogicalLiteralNode
  | NullLiteralNode
  | MissingLiteralNode
  | UnaryExpressionNode
  | BinaryExpressionNode
  | AssignmentExpressionNode
  | ReplacementExpressionNode
  | CallExpressionNode
  | FunctionExpressionNode
  | IfExpressionNode
  | ForExpressionNode
  | WhileExpressionNode
  | RepeatExpressionNode
  | BreakExpressionNode
  | NextExpressionNode
  | ReturnExpressionNode
  | SubsetExpressionNode
  | NamespaceExpressionNode
  | FormulaExpressionNode
  | PipeExpressionNode
  | ConstantExpressionNode
  | UnsupportedExpressionNode;

/** Assert exhaustiveness in discriminated-union switches. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected discriminated-union member: ${String(value)}`);
}
