import {
  REvaluationError,
  RTypeMismatchError,
  createForcedPromise,
  integerVector,
  isMissing,
  isVector,
  lookupBinding,
  subsetVector,
  vectorDimensions,
  withAttribute,
  withDimensions,
  withoutAttribute,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RValue,
  RVector,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

export interface SweepBuiltinSpec {
  readonly name: "sweep";
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly formals: NonNullable<BuiltinDefinition["formals"]>;
}

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

export const SWEEP_BUILTIN_SPECS: readonly SweepBuiltinSpec[] = [
  {
    name: "sweep",
    parameters: ["x", "MARGIN", "STATS", "FUN", "check.margin", "..."],
    compatibility: "behavioral",
    implementation: builtinSweep,
    formals: [
      { name: "x", span: SPAN },
      { name: "MARGIN", span: SPAN },
      { name: "STATS", span: SPAN },
      {
        name: "FUN",
        defaultValue: { kind: "StringLiteral", value: "-", span: SPAN },
        span: SPAN,
      },
      {
        name: "check.margin",
        defaultValue: { kind: "LogicalLiteral", value: true, span: SPAN },
        span: SPAN,
      },
      { name: "...", span: SPAN },
    ],
  },
];

async function builtinSweep(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchBuiltinArguments(invocation, [
    "x",
    "MARGIN",
    "STATS",
    "FUN",
    "check.margin",
    "...",
  ]);
  const input = await invocation.force(required(matched.get("x"), "x").promise);
  if (!isVector(input)) throw new RTypeMismatchError("NRT3451", "'x' must be an array");
  const dimensions = vectorDimensions(input) ?? [input.length];
  const marginValue = await invocation.force(required(matched.get("MARGIN"), "MARGIN").promise);
  const margins = sweepMargins(marginValue, dimensions.length);
  const stats = await invocation.force(required(matched.get("STATS"), "STATS").promise);
  if (!isVector(stats)) throw new RTypeMismatchError("NRT3451", "STATS must be a vector");
  if (stats.length === 0 && input.length > 0) {
    throw new RTypeMismatchError("NRT3451", "STATS is of length zero");
  }
  const checkMargin = await logicalFlag(invocation, matched.get("check.margin"), true);
  const marginLength = margins.reduce((product, margin) => product * (dimensions[margin] ?? 0), 1);
  if (checkMargin && stats.length > 0 && marginLength % stats.length !== 0) {
    invocation.context.warn({
      code: "NRW1145",
      message: "STATS does not recycle exactly across MARGIN",
    });
  }

  const indices = expandedStatsIndices(input.length, dimensions, margins, stats.length, invocation);
  let expanded = subsetVector(stats, integerVector(indices), invocation.context);
  expanded = withoutAttribute(
    withoutAttribute(withoutAttribute(expanded, "names"), "dimnames"),
    "dim",
  );
  const callable = await sweepCallable(invocation, matched.get("FUN"));
  const environment = invocation.currentEnvironment();
  const result = await invocation.invokeLazy(callable, [
    { promise: createForcedPromise(input, environment) },
    { promise: createForcedPromise(expanded, environment) },
    ...dots,
  ]);
  if (!isVector(result) || result.length !== input.length) {
    throw new RTypeMismatchError(
      "NRT3451",
      `sweep() FUN must return a vector of length ${input.length}`,
    );
  }
  return restoreArrayShape(result, input, dimensions);
}

function required(argument: BuiltinCallArgument | undefined, name: string): BuiltinCallArgument {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `argument "${name}" is missing, with no default`);
  }
  return argument;
}

function sweepMargins(value: RValue, rank: number): readonly number[] {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3451", "MARGIN must be numeric");
  }
  const margins: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (isMissing(value, index)) throw new RTypeMismatchError("NRT3451", "invalid MARGIN");
    const margin = Math.trunc(Number(value.values[index])) - 1;
    if (!Number.isSafeInteger(margin) || margin < 0 || margin >= rank) {
      throw new RTypeMismatchError("NRT3451", "invalid MARGIN");
    }
    if (!margins.includes(margin)) margins.push(margin);
  }
  if (margins.length === 0) throw new RTypeMismatchError("NRT3451", "MARGIN is empty");
  return margins;
}

async function logicalFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "logical" || value.length < 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3451", "'check.margin' must be TRUE or FALSE");
  }
  return value.values[0] === 1;
}

function expandedStatsIndices(
  length: number,
  dimensions: readonly number[],
  margins: readonly number[],
  statsLength: number,
  invocation: BuiltinInvocation,
): number[] {
  invocation.context.allocate(length);
  const dimensionStrides = new Array<number>(dimensions.length);
  let stride = 1;
  for (let axis = 0; axis < dimensions.length; axis += 1) {
    dimensionStrides[axis] = stride;
    stride *= dimensions[axis] ?? 0;
  }
  const marginStrides = new Array<number>(margins.length);
  stride = 1;
  for (let axis = 0; axis < margins.length; axis += 1) {
    marginStrides[axis] = stride;
    stride *= dimensions[margins[axis] ?? 0] ?? 0;
  }
  return Array.from({ length }, (_, index) => {
    invocation.context.checkpoint();
    let statsIndex = 0;
    for (let axis = 0; axis < margins.length; axis += 1) {
      const margin = margins[axis] ?? 0;
      const coordinate =
        Math.floor(index / (dimensionStrides[margin] ?? 1)) % (dimensions[margin] ?? 1);
      statsIndex += coordinate * (marginStrides[axis] ?? 1);
    }
    return statsLength === 0 ? 1 : (statsIndex % statsLength) + 1;
  });
}

async function sweepCallable(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RValue> {
  const supplied =
    argument === undefined || argument.promise.missing
      ? undefined
      : await invocation.force(argument.promise);
  if (supplied === undefined) return callableByName(invocation, "-");
  if (supplied.type === "builtin" || supplied.type === "closure") return supplied;
  if (supplied.type !== "character" || supplied.length < 1 || isMissing(supplied, 0)) {
    throw new RTypeMismatchError("NRT3451", "'FUN' is not a function or character string");
  }
  return callableByName(invocation, supplied.values[0] ?? "");
}

async function callableByName(invocation: BuiltinInvocation, name: string): Promise<RValue> {
  const binding = lookupBinding(invocation.currentEnvironment(), name);
  if (binding === undefined)
    throw new REvaluationError("NRE2001", `could not find function "${name}"`);
  const callable = await invocation.force(binding);
  if (callable.type !== "builtin" && callable.type !== "closure") {
    throw new RTypeMismatchError("NRT3451", `'${name}' is not a function`);
  }
  return callable;
}

function restoreArrayShape(
  result: RVector,
  input: RVector,
  dimensions: readonly number[],
): RVector {
  let shaped = withoutAttribute(
    withoutAttribute(withoutAttribute(result, "names"), "dimnames"),
    "dim",
  );
  shaped = withDimensions(shaped, dimensions);
  const dimnames = input.attributes.get("dimnames");
  if (dimnames !== undefined) shaped = withAttribute(shaped, "dimnames", dimnames);
  return shaped;
}
