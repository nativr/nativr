import type { AstNode, SourceSpan } from "@nativr/ast";
import { REvaluationError } from "./errors.js";
import { deparseAstLines } from "./language-deparse.js";
import { embeddedValueAst } from "./language-subset.js";
import type { BuiltinCallArgument } from "./values.js";

interface ArgumentMatchOptions {
  readonly codes?: {
    readonly duplicate: string;
    readonly ambiguous: string;
    readonly unused: string;
  };
  readonly checkWork?: () => void;
}

const SYNTHETIC_SPAN: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

/** Match promises without forcing them, in formal order for each named matching pass. */
export function matchArguments<T extends BuiltinCallArgument & { readonly span?: SourceSpan }>(
  arguments_: readonly T[],
  parameters: readonly string[],
  options: ArgumentMatchOptions = {},
): { readonly matched: Map<string, T>; readonly dots: T[] } {
  const codes = options.codes ?? { duplicate: "NRE2004", ambiguous: "NRE2007", unused: "NRE2005" };
  const checkWork = options.checkWork ?? (() => undefined);
  const dotsIndex = parameters.indexOf("...");
  const leading = dotsIndex < 0 ? parameters : parameters.slice(0, dotsIndex);
  const resolved = new Map<number, string>();
  const exact = new Set<number>();
  const matched = new Map<string, T>();
  const duplicate = (name: string, argument: T): never => {
    throw new REvaluationError(
      codes.duplicate,
      `formal argument "${name}" matched by multiple actual arguments`,
      argument.span === undefined ? {} : { span: argument.span },
    );
  };
  for (const name of parameters) {
    if (name === "...") continue;
    for (const [index, argument] of arguments_.entries()) {
      checkWork();
      if (argument.name !== name) continue;
      if (matched.has(name)) duplicate(name, argument);
      matched.set(name, argument);
      resolved.set(index, name);
      exact.add(index);
    }
  }
  const exactFormals = new Set(matched.keys());
  for (const name of leading) {
    if (exactFormals.has(name)) continue;
    for (const [index, argument] of arguments_.entries()) {
      checkWork();
      if (exact.has(index) || !argument.name || !name.startsWith(argument.name)) continue;
      if (resolved.has(index)) {
        throw new REvaluationError(
          codes.ambiguous,
          `argument ${index + 1} matches multiple formal arguments`,
          argument.span === undefined ? {} : { span: argument.span },
        );
      }
      if (matched.has(name)) duplicate(name, argument);
      matched.set(name, argument);
      resolved.set(index, name);
    }
  }
  let position = 0;
  const dots: T[] = [];
  for (const [index, argument] of arguments_.entries()) {
    checkWork();
    if (resolved.has(index)) continue;
    if (!argument.name) {
      while (position < leading.length && matched.has(leading[position] ?? "")) position += 1;
      const name = leading[position++];
      if (name !== undefined) {
        matched.set(name, argument);
        resolved.set(index, name);
        continue;
      }
    }
    dots.push(argument);
  }
  if (dotsIndex < 0 && dots.length > 0) {
    throw new REvaluationError(
      codes.unused,
      unusedArgumentsMessage(dots, checkWork),
      dots[0]?.span === undefined ? {} : { span: dots[0].span },
    );
  }
  // Preserve actual order for callers that subsequently force matched promises.
  return {
    matched: new Map(
      arguments_.flatMap((argument, index) => {
        const name = resolved.get(index);
        return name === undefined ? [] : [[name, argument] as const];
      }),
    ),
    dots,
  };
}

function unusedArgumentsMessage(
  arguments_: readonly BuiltinCallArgument[],
  checkWork: () => void,
): string {
  const missing = arguments_.some(({ promise }) => promise.expression === null && promise.missing);
  const node: AstNode = {
    kind: "CallExpression",
    callee: { kind: "Identifier", name: missing ? "alist" : "list", span: SYNTHETIC_SPAN },
    arguments: arguments_.map(({ name, promise }) => ({
      ...(name ? { name } : {}),
      value:
        promise.expression ??
        (promise.value === undefined
          ? { kind: "UnsupportedExpression", feature: "missing argument", span: SYNTHETIC_SPAN }
          : embeddedValueAst(promise.value, checkWork)),
      span: SYNTHETIC_SPAN,
    })),
    span: SYNTHETIC_SPAN,
  };
  const rendered = deparseAstLines(node, { checkWork }).join("\n");
  return `unused argument${arguments_.length === 1 ? "" : "s"} (${missing ? rendered : rendered.slice(5, -1)})`;
}
