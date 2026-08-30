import { REvaluationError } from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation } from "@nativr/runtime";

export interface MatchedBuiltinArguments {
  readonly matched: Map<string, BuiltinCallArgument>;
  readonly dots: readonly BuiltinCallArgument[];
}

/** Match exact, unique-partial, positional, and trailing-dot arguments without forcing promises. */
export function matchBuiltinArguments(
  invocation: BuiltinInvocation,
  parameters: readonly string[],
): MatchedBuiltinArguments {
  const call = invocation.currentCall();
  const callName =
    call.type === "language" &&
    call.expression.kind === "CallExpression" &&
    call.expression.callee.kind === "Identifier"
      ? call.expression.callee.name
      : undefined;
  return matchBuiltinCallArguments(invocation.arguments, parameters, callName);
}

/** Match an already-selected argument list against one callable's ordinary formals. */
export function matchBuiltinCallArguments(
  arguments_: readonly BuiltinCallArgument[],
  parameters: readonly string[],
  callName?: string,
): MatchedBuiltinArguments {
  const formal = parameters.filter((name) => name !== "...");
  const dotsIndex = parameters.indexOf("...");
  const leading = dotsIndex < 0 ? formal : parameters.slice(0, dotsIndex);
  const resolved: (string | undefined)[] = arguments_.map(() => undefined);
  const named = new Set<string>();
  const reserved = new Set<string>();
  const exactlyUsed = new Set<string>();
  for (const [index, argument] of arguments_.entries()) {
    if (argument.name === undefined || !formal.includes(argument.name)) continue;
    if (named.has(argument.name)) {
      throw new REvaluationError("NRE2102", `Argument '${argument.name}' matched more than once.`);
    }
    resolved[index] = argument.name;
    named.add(argument.name);
    if (!argument.promise.missing) reserved.add(argument.name);
    exactlyUsed.add(argument.name);
  }
  for (const [index, argument] of arguments_.entries()) {
    if (argument.name === undefined || resolved[index] !== undefined) continue;
    const candidates = leading.filter(
      (name) => !exactlyUsed.has(name) && name.startsWith(argument.name ?? ""),
    );
    if (candidates.length > 1) {
      throw new REvaluationError(
        "NRE2104",
        `Argument '${argument.name}' matches multiple formal arguments.`,
      );
    }
    const candidate = candidates[0];
    if (candidate === undefined) continue;
    if (named.has(candidate)) {
      throw new REvaluationError("NRE2102", `Argument '${candidate}' matched more than once.`);
    }
    resolved[index] = candidate;
    named.add(candidate);
    if (!argument.promise.missing) reserved.add(candidate);
  }

  const positionalResolved: (string | undefined)[] = arguments_.map(() => undefined);
  const positionallyConsumed = new Set<string>();
  const positionallyFilled = new Set<string>();
  let positional = 0;
  for (const [index, argument] of arguments_.entries()) {
    if (argument.name !== undefined) continue;
    while (
      positional < leading.length &&
      (reserved.has(leading[positional] ?? "") ||
        positionallyConsumed.has(leading[positional] ?? ""))
    ) {
      positional += 1;
    }
    const name = leading[positional++];
    if (name === undefined) continue;
    positionalResolved[index] = name;
    positionallyConsumed.add(name);
    if (!argument.promise.missing) positionallyFilled.add(name);
  }

  const matched = new Map<string, BuiltinCallArgument>();
  const dots: BuiltinCallArgument[] = [];
  for (const [index, argument] of arguments_.entries()) {
    const name = argument.name === undefined ? positionalResolved[index] : resolved[index];
    if (
      argument.name !== undefined &&
      argument.promise.missing &&
      name !== undefined &&
      positionallyFilled.has(name)
    ) {
      continue;
    }
    if (name === undefined) {
      if (parameters.includes("...")) dots.push(argument);
      else {
        throw new REvaluationError(
          "NRE2101",
          `Unused argument '${argument.name ?? "<unnamed>"}' for (${parameters.join(", ")})${callName === undefined ? "" : ` in ${callName}()`}.`,
          {
            details: { name: argument.name, parameters },
          },
        );
      }
    } else if (!argument.promise.missing || argument.name !== undefined) {
      matched.set(name, argument);
    }
  }
  return { matched, dots };
}

/** Match exact-only trailing formals after `...`, such as those on `system.file`. */
export function matchLeadingDotsArguments(
  invocation: BuiltinInvocation,
  trailingParameters: readonly string[],
): MatchedBuiltinArguments {
  const matched = new Map<string, BuiltinCallArgument>();
  const dots: BuiltinCallArgument[] = [];
  for (const argument of invocation.arguments) {
    if (argument.name === undefined) {
      dots.push(argument);
      continue;
    }
    const candidate = trailingParameters.includes(argument.name) ? argument.name : undefined;
    if (candidate === undefined) {
      dots.push(argument);
      continue;
    }
    if (matched.has(candidate)) {
      throw new REvaluationError("NRE2102", `Argument '${candidate}' matched more than once.`);
    }
    matched.set(candidate, argument);
  }
  return { matched, dots };
}
