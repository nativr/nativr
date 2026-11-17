import {
  createEnvironment,
  createMissingPromise,
  createPromise,
  matchArguments,
  matchArgumentsWithWarnings,
  NativRError,
  partialMatchWarning,
  partialMatchWarningsEnabled,
  recordErrorConditionClasses,
  setBinding,
} from "@nativr/runtime";
import type { AstNode } from "@nativr/ast";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

export interface BuiltinDefaultParameter {
  readonly name: string;
  readonly defaultValue?: AstNode;
}

/** Bind declared defaults lazily in a base lexical frame, retaining the original actual promises. */
export async function matchBuiltinDefaults(
  invocation: BuiltinInvocation,
  parameters: readonly BuiltinDefaultParameter[],
): Promise<
  MatchedBuiltinArguments & {
    readonly supplied: ReadonlySet<string>;
    force(name: string): Promise<RValue>;
  }
> {
  const result = await matchBuiltinArguments(
    invocation,
    parameters.map(({ name }) => name),
  );
  const environment = createEnvironment(invocation.baseEnvironment());
  const matched = new Map<string, BuiltinCallArgument>();
  const supplied = new Set<string>();
  for (const parameter of parameters) {
    invocation.context.checkpoint();
    if (parameter.name === "...") {
      setBinding(environment, "...", { type: "dots", arguments: result.dots });
      continue;
    }
    const actual = result.matched.get(parameter.name);
    const present =
      actual !== undefined && !(actual.promise.expression === null && actual.promise.missing);
    const promise = present
      ? actual.promise
      : parameter.defaultValue === undefined
        ? createMissingPromise(environment, parameter.name)
        : createPromise(parameter.defaultValue, environment, true);
    if (present) supplied.add(parameter.name);
    matched.set(parameter.name, { name: parameter.name, promise });
    setBinding(environment, parameter.name, promise);
  }
  return {
    matched,
    dots: result.dots,
    supplied,
    async force(name) {
      const argument = matched.get(name);
      if (argument === undefined) throw new Error(`Unknown declared builtin formal: ${name}`);
      try {
        return await invocation.force(argument.promise);
      } catch (error) {
        // A missing declared library default is a variable-access condition. Errors from an
        // actual expression keep their own classification while propagating through this frame.
        if (
          !supplied.has(name) &&
          argument.promise.expression === null &&
          error instanceof NativRError &&
          error.code === "NRE2006"
        ) {
          recordErrorConditionClasses(error, [
            "getvarError",
            "missingArgError",
            "error",
            "condition",
          ]);
        }
        throw error;
      }
    },
  };
}

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

/** Match an already-selected argument list against one callable's ordinary formals. */
export function matchBuiltinCallArguments(
  arguments_: readonly BuiltinCallArgument[],
  parameters: readonly string[],
): MatchedBuiltinArguments {
  return matchArguments(arguments_, parameters, {
    codes: { duplicate: "NRE2102", ambiguous: "NRE2104", unused: "NRE2101" },
  });
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
