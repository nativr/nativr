import { assertNever } from "@nativr/ast";
import type { AstNode, ParseDataDiagnostic, RetainedParseResult } from "@nativr/ast";
import {
  RParseError,
  REvaluationError,
  RUnsupportedFeatureError,
  characterVector,
  createEnvironment,
  embeddedValueAst,
  expressionValue,
  integerVector,
  isMissing,
  listValue,
  setBinding,
  withAttribute,
  withClasses,
  withDimensions,
  withFunctionSourceCellPresence,
  withLanguageSyntaxMetadata,
} from "@nativr/runtime";
import type {
  BuiltinInvocation,
  RAttributes,
  REnvironment,
  RExpression,
  RIntegerVector,
  RValue,
} from "@nativr/runtime";
import { SourceReferenceMap } from "./source-reference-map.js";

/** Materialize source objects only after the parser has returned its partial event stream. */
export async function retainParsedSource(
  source: string,
  sourceFile: REnvironment,
  parsed: RetainedParseResult,
  keepData: boolean,
  invocation: BuiltinInvocation,
): Promise<RExpression> {
  const effective = `${source}\n`;
  const filenameBinding = sourceFile.bindings.get("filename");
  const filename =
    filenameBinding === undefined ? undefined : await invocation.force(filenameBinding);
  const originalFilename =
    filename?.type === "character" && filename.length === 1 && !isMissing(filename, 0)
      ? filename.values[0]
      : undefined;
  const map = new SourceReferenceMap(effective.slice(0, parsed.data.consumedOffset), {
    directives: parsed.data.sourceDirectives,
    checkpoint: () => invocation.context.checkpoint(),
    allocate: (elements) => invocation.context.allocate(elements),
    ...(originalFilename === undefined ? {} : { originalFilename }),
  });
  const sources = [sourceFile];
  for (const alias of map.sources.slice(1)) {
    invocation.context.allocate(5);
    const environment = createEnvironment(invocation.emptyEnvironment(), true);
    setBinding(environment, "filename", characterVector([alias.filename!]));
    setBinding(environment, "original", sourceFile);
    environment.attributes.set("class", characterVector(["srcfilealias", "srcfile"]));
    sources.push(environment);
  }
  const sourceAt = (end: number): REnvironment => sources[map.sourceIndexAt(end)]!;
  const reference = (
    tuple: readonly (number | null)[],
    environment: REnvironment,
  ): RIntegerVector => {
    invocation.context.allocate(11);
    return withClasses(
      withAttribute(
        integerVector(
          tuple.map((cell) => cell ?? 0),
          tuple.map((cell) => (cell === null ? 1 : 0)),
        ),
        "srcfile",
        environment,
      ),
      ["srcref"],
    );
  };
  const spanReference = (node: AstNode): RIntegerVector =>
    reference(
      map.span(node.span.start.offset, node.span.end.offset),
      sourceAt(node.span.end.offset),
    );
  if (keepData) {
    const records = parsed.data.records;
    invocation.context.allocate(records.length * 8);
    invocation.context.allocate(records.length * 2 + 3);
    const cells: number[] = [];
    const tokens: string[] = [];
    const texts: string[] = [];
    for (const record of records) {
      invocation.context.checkpoint();
      const span = map.span(record.startOffset, record.endOffset);
      cells.push(
        span[6],
        span[4],
        span[7],
        span[5],
        Number(record.terminal),
        record.tokenCode,
        record.id,
        record.parent,
      );
      tokens.push(record.token);
      texts.push(
        record.terminal && record.token !== "LINE_DIRECTIVE"
          ? (record.text ?? effective.slice(record.startOffset, record.endOffset))
          : "",
      );
    }
    const data = withClasses(
      withAttribute(
        withAttribute(
          withDimensions(integerVector(cells), [8, records.length]),
          "tokens",
          characterVector(tokens),
        ),
        "text",
        characterVector(texts),
      ),
      ["parseData"],
    );
    if (sourceFile.lockedBindings.has("parseData")) {
      throw new REvaluationError(
        "NRE2012",
        "cannot change value of locked binding for 'parseData'",
      );
    }
    if (sourceFile.locked && !sourceFile.bindings.has("parseData")) {
      throw new REvaluationError("NRE2012", "cannot add bindings to a locked environment");
    }
    await invocation.assignBinding(sourceFile, "parseData", data);
  }
  if (parsed.data.diagnostic !== undefined) {
    const diagnostic = parsed.data.diagnostic;
    if (diagnostic.kind === "disabled-feature") {
      throw new RUnsupportedFeatureError(
        "NRU6134",
        "Retained parse-data evidence is unavailable for this syntax.",
      );
    }
    throw new RParseError(
      "NRP1001",
      retainedParseErrorMessage(
        effective,
        diagnostic,
        map,
        map.sources[map.sourceIndexAt(parsed.data.consumedOffset)]?.filename ??
          originalFilename ??
          "<text>",
      ),
    );
  }
  const diagnostic = parsed.diagnostics.find((item) => item.severity === "error");
  if (diagnostic !== undefined) {
    throw new RParseError(diagnostic.code, diagnostic.message, {
      ...(diagnostic.span === undefined ? {} : { span: diagnostic.span }),
    });
  }
  const attributes = (nodes: readonly AstNode[], end: number, brace?: AstNode): RAttributes => {
    const environment = sourceAt(end);
    invocation.context.allocate(nodes.length + (brace === undefined ? 0 : 1) + 3);
    const references: RValue[] = nodes.map(spanReference);
    if (brace !== undefined) {
      references.unshift(
        reference(map.span(brace.span.start.offset, brace.span.start.offset + 1), environment),
      );
    }
    return new Map<string, RValue>([
      ["srcref", listValue(references)],
      ["srcfile", environment],
      ["wholeSrcref", reference(map.whole(end), environment)],
    ]);
  };
  // An explicit post-order stack bounds work without consuming the JavaScript call stack for
  // deeply nested language. Every queued node and retained node is charged before allocation.
  const decorated = new Map<AstNode, AstNode>();
  invocation.context.allocate(parsed.ast.body.length);
  const stack = parsed.ast.body.map((node) => ({ node, visited: false }));
  while (stack.length > 0) {
    invocation.context.checkpoint();
    const { node, visited } = stack.pop()!;
    if (visited) {
      let retained = mapChildren(node, (child) => decorated.get(child)!);
      if (node.kind === "Block") {
        retained = withLanguageSyntaxMetadata(retained, {
          attributes: attributes(node.body, node.span.end.offset, node),
        });
      } else if (node.kind === "FunctionExpression") {
        retained = withFunctionSourceCellPresence(
          retained,
          true,
          embeddedValueAst(spanReference(node)),
        );
      }
      decorated.set(node, retained);
    } else {
      invocation.context.allocate(2);
      stack.push({ node, visited: true });
      mapChildren(node, (child) => {
        invocation.context.allocate(1);
        stack.push({ node: child, visited: false });
        return child;
      });
    }
  }
  invocation.context.allocate(parsed.ast.body.length);
  const result = expressionValue(
    parsed.ast.body.map((node) => decorated.get(node)!),
    attributes(parsed.ast.body, parsed.data.consumedOffset),
  );
  invocation.setResultVisibility("visible");
  return result;
}

function mapChildren(node: AstNode, map: (child: AstNode) => AstNode): AstNode {
  switch (node.kind) {
    case "Program":
    case "Block":
      return { ...node, body: node.body.map(map) };
    case "UnaryExpression":
      return { ...node, operand: map(node.operand) };
    case "BinaryExpression":
    case "PipeExpression":
      return { ...node, left: map(node.left), right: map(node.right) };
    case "AssignmentExpression":
      return { ...node, value: map(node.value) };
    case "ReplacementExpression":
      return { ...node, target: map(node.target) as typeof node.target, value: map(node.value) };
    case "CallExpression":
      return {
        ...node,
        callee: map(node.callee),
        arguments: node.arguments.map((argument) => ({ ...argument, value: map(argument.value) })),
      };
    case "FunctionExpression":
      return {
        ...node,
        parameters: node.parameters.map((parameter) =>
          parameter.defaultValue === undefined
            ? parameter
            : { ...parameter, defaultValue: map(parameter.defaultValue) },
        ),
        body: map(node.body),
      };
    case "IfExpression":
      return {
        ...node,
        condition: map(node.condition),
        consequence: map(node.consequence),
        ...(node.alternative === undefined ? {} : { alternative: map(node.alternative) }),
      };
    case "ForExpression":
      return { ...node, sequence: map(node.sequence), body: map(node.body) };
    case "WhileExpression":
      return { ...node, condition: map(node.condition), body: map(node.body) };
    case "RepeatExpression":
      return { ...node, body: map(node.body) };
    case "ReturnExpression":
      return { ...node, ...(node.value === undefined ? {} : { value: map(node.value) }) };
    case "SubsetExpression":
      return {
        ...node,
        target: map(node.target),
        arguments: node.arguments.map((argument) => ({ ...argument, value: map(argument.value) })),
      };
    case "NamespaceExpression":
      return { ...node, namespace: map(node.namespace), member: map(node.member) };
    case "FormulaExpression":
      return {
        ...node,
        ...(node.left === undefined ? {} : { left: map(node.left) }),
        right: map(node.right),
      };
    case "ConstantExpression":
    case "Identifier":
    case "DoubleLiteral":
    case "ComplexLiteral":
    case "IntegerLiteral":
    case "StringLiteral":
    case "LogicalLiteral":
    case "NullLiteral":
    case "MissingLiteral":
    case "BreakExpression":
    case "NextExpression":
    case "UnsupportedExpression":
      return node;
    default:
      return assertNever(node);
  }
}

function retainedParseErrorMessage(
  source: string,
  diagnostic: ParseDataDiagnostic,
  map: SourceReferenceMap,
  filename: string,
): string {
  const incomplete = diagnostic.kind === "incomplete";
  const offset = Math.min(source.length, diagnostic.offset);
  const position = map.position(
    incomplete ? offset : offset + ((source.codePointAt(offset) ?? 0) > 0xffff ? 2 : 1),
  );
  const line = position.physicalLine;
  const lines = source
    .slice(
      0,
      incomplete
        ? offset
        : source.indexOf("\n", offset) < 0
          ? source.length
          : source.indexOf("\n", offset),
    )
    .split("\n");
  if (incomplete && lines.at(-1) === "") lines.pop();
  const start = Math.max(1, line - (incomplete ? 2 : 1));
  const contextLines = lines.slice(start - 1, line);
  const excerpt = contextLines
    .map((text, index) => {
      let expanded = "";
      let column = 0;
      for (const point of text) {
        if (point === "\t") {
          const spaces = 8 - (column % 8);
          expanded += " ".repeat(spaces);
          column += spaces;
        } else {
          expanded += point;
          column += 1;
        }
      }
      return `${start + index}: ${expanded}`;
    })
    .join("\n");
  const description = incomplete
    ? "end of input"
    : diagnostic.token === "INCOMPLETE_STRING"
      ? "INCOMPLETE_STRING"
      : `'${diagnostic.token ?? "input"}'`;
  const padding = String(line).length + 1 + position.column + (contextLines.length === 1 ? 1 : 0);
  return `${filename}:${position.logicalLine}:${position.column}: unexpected ${description}\n${excerpt}\n${" ".repeat(padding)}^`;
}
