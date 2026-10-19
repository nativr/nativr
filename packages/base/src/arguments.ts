import { matchArguments } from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation } from "@nativr/runtime";

export interface MatchedBuiltinArguments {
  readonly matched: Map<string, BuiltinCallArgument>;
  readonly dots: readonly BuiltinCallArgument[];
}

/** Use closure matching for builtins that declare named formals, without forcing arguments. */
export function matchBuiltinArguments(
  invocation: BuiltinInvocation,
  parameters: readonly string[],
): MatchedBuiltinArguments {
  return matchArguments(invocation.arguments, parameters, {
    codes: { duplicate: "NRE2102", ambiguous: "NRE2104", unused: "NRE2101" },
    checkWork: () => invocation.context.checkpoint(),
  });
}

/** Match exact-only trailing formals after ellipsis, such as those on system.file. */
export function matchLeadingDotsArguments(
  invocation: BuiltinInvocation,
  trailingParameters: readonly string[],
): MatchedBuiltinArguments {
  return matchBuiltinArguments(invocation, ["...", ...trailingParameters]);
}
