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
  const formal = parameters.filter((name) => name !== "...");
  const resolved: (string | undefined)[] = invocation.arguments.map(() => undefined);
  const used = new Set<string>();
  for (const [index, argument] of invocation.arguments.entries()) {
    if (argument.name === undefined || !formal.includes(argument.name)) continue;
    if (used.has(argument.name)) {
      throw new REvaluationError("NRE2102", `Argument '${argument.name}' matched more than once.`);
    }
    resolved[index] = argument.name;
    used.add(argument.name);
  }
  for (const [index, argument] of invocation.arguments.entries()) {
    if (argument.name === undefined || resolved[index] !== undefined) continue;
    const candidates = formal.filter((name) => name.startsWith(argument.name ?? ""));
    if (candidates.length > 1) {
      throw new REvaluationError(
        "NRE2104",
        `Argument '${argument.name}' matches multiple formal arguments.`,
      );
    }
    const candidate = candidates[0];
    if (candidate === undefined) continue;
    if (used.has(candidate)) {
      throw new REvaluationError("NRE2102", `Argument '${candidate}' matched more than once.`);
    }
    resolved[index] = candidate;
    used.add(candidate);
  }
  const matched = new Map<string, BuiltinCallArgument>();
  const dots: BuiltinCallArgument[] = [];
  let positional = 0;
  for (const [index, argument] of invocation.arguments.entries()) {
    let name = resolved[index];
    if (argument.name === undefined) {
      while (positional < formal.length && used.has(formal[positional] ?? "")) positional += 1;
      name = formal[positional++];
      if (name !== undefined) used.add(name);
    }
    if (name === undefined) {
      if (parameters.includes("...")) dots.push(argument);
      else throw new REvaluationError("NRE2101", "Unused argument.");
    } else {
      matched.set(name, argument);
    }
  }
  return { matched, dots };
}
