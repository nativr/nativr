import {
  matchArguments,
  matchArgumentsWithWarnings,
  partialMatchWarning,
  partialMatchWarningsEnabled,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation } from "@nativr/runtime";

export interface MatchedBuiltinArguments {
  readonly matched: Map<string, BuiltinCallArgument>;
  readonly dots: readonly BuiltinCallArgument[];
}

/** Use closure matching for builtins that declare named formals, without forcing arguments. */
export async function matchBuiltinArguments(
  invocation: BuiltinInvocation,
  parameters: readonly string[],
): Promise<MatchedBuiltinArguments> {
  const options = {
    codes: { duplicate: "NRE2102", ambiguous: "NRE2104", unused: "NRE2101" },
    checkWork: () => invocation.context.checkpoint(),
  };
  return partialMatchWarningsEnabled(invocation.state)
    ? matchArgumentsWithWarnings(
        invocation.arguments,
        parameters,
        async (match) => {
          if (!partialMatchWarningsEnabled(invocation.state)) return;
          const { condition, warning } = partialMatchWarning(match, invocation.currentCall(), () =>
            invocation.context.checkpoint(),
          );
          await invocation.signalWarning(condition, warning);
        },
        options,
      )
    : matchArguments(invocation.arguments, parameters, options);
}

/** Match exact-only trailing formals after ellipsis, such as those on system.file. */
export function matchLeadingDotsArguments(
  invocation: BuiltinInvocation,
  trailingParameters: readonly string[],
): MatchedBuiltinArguments {
  return matchArguments(invocation.arguments, ["...", ...trailingParameters], {
    codes: { duplicate: "NRE2102", ambiguous: "NRE2104", unused: "NRE2101" },
    checkWork: () => invocation.context.checkpoint(),
  });
}
