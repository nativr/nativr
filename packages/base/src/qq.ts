import {
  createForcedPromise,
  REvaluationError,
  RTypeMismatchError,
  characterVector,
  doubleVector,
  integerVector,
  isMissing,
  listValue,
  logicalVector,
  lookupBinding,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RValue,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";
import { normalQuantile } from "./student-t.js";

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

const QQNORM_DEFAULT_PARAMETERS = [
  "y",
  "ylim",
  "main",
  "xlab",
  "ylab",
  "plot.it",
  "datax",
  "...",
] as const;

const QQPLOT_PARAMETERS = [
  "x",
  "y",
  "plot.it",
  "xlab",
  "ylab",
  "...",
  "conf.level",
  "conf.args",
] as const;

const QQLINE_PARAMETERS = ["y", "datax", "distribution", "probs", "qtype", "..."] as const;

export interface QqBuiltinSpec {
  readonly name: "qqline" | "qqnorm" | "qqnorm.default" | "qqplot";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly formals: NonNullable<BuiltinDefinition["formals"]>;
}

export const QQ_BUILTIN_SPECS: readonly QqBuiltinSpec[] = [
  {
    name: "qqline",
    parameters: QQLINE_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinQqline,
    formals: [
      { name: "y", span: SPAN },
      {
        name: "datax",
        defaultValue: { kind: "LogicalLiteral", value: false, span: SPAN },
        span: SPAN,
      },
      {
        name: "distribution",
        defaultValue: { kind: "Identifier", name: "qnorm", span: SPAN },
        span: SPAN,
      },
      {
        name: "probs",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "c", span: SPAN },
          arguments: [
            { value: { kind: "DoubleLiteral", value: 0.25, span: SPAN }, span: SPAN },
            { value: { kind: "DoubleLiteral", value: 0.75, span: SPAN }, span: SPAN },
          ],
          span: SPAN,
        },
        span: SPAN,
      },
      {
        name: "qtype",
        defaultValue: { kind: "IntegerLiteral", value: 7, span: SPAN },
        span: SPAN,
      },
      { name: "...", span: SPAN },
    ],
  },
  {
    name: "qqnorm",
    parameters: ["y", "..."],
    compatibility: "numeric",
    implementation: builtinQqnorm,
    formals: [
      { name: "y", span: SPAN },
      { name: "...", span: SPAN },
    ],
  },
  {
    name: "qqnorm.default",
    parameters: QQNORM_DEFAULT_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinQqnormDefault,
    formals: [
      { name: "y", span: SPAN },
      { name: "ylim", span: SPAN },
      {
        name: "main",
        defaultValue: { kind: "StringLiteral", value: "Normal Q-Q Plot", span: SPAN },
        span: SPAN,
      },
      {
        name: "xlab",
        defaultValue: { kind: "StringLiteral", value: "Theoretical Quantiles", span: SPAN },
        span: SPAN,
      },
      {
        name: "ylab",
        defaultValue: { kind: "StringLiteral", value: "Sample Quantiles", span: SPAN },
        span: SPAN,
      },
      {
        name: "plot.it",
        defaultValue: { kind: "LogicalLiteral", value: true, span: SPAN },
        span: SPAN,
      },
      {
        name: "datax",
        defaultValue: { kind: "LogicalLiteral", value: false, span: SPAN },
        span: SPAN,
      },
      { name: "...", span: SPAN },
    ],
  },
  {
    name: "qqplot",
    parameters: QQPLOT_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinQqplot,
    formals: [
      { name: "x", span: SPAN },
      { name: "y", span: SPAN },
      {
        name: "plot.it",
        defaultValue: { kind: "LogicalLiteral", value: true, span: SPAN },
        span: SPAN,
      },
      {
        name: "xlab",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "deparse1", span: SPAN },
          arguments: [
            {
              value: {
                kind: "CallExpression",
                callee: { kind: "Identifier", name: "substitute", span: SPAN },
                arguments: [{ value: { kind: "Identifier", name: "x", span: SPAN }, span: SPAN }],
                span: SPAN,
              },
              span: SPAN,
            },
          ],
          span: SPAN,
        },
        span: SPAN,
      },
      {
        name: "ylab",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "deparse1", span: SPAN },
          arguments: [
            {
              value: {
                kind: "CallExpression",
                callee: { kind: "Identifier", name: "substitute", span: SPAN },
                arguments: [{ value: { kind: "Identifier", name: "y", span: SPAN }, span: SPAN }],
                span: SPAN,
              },
              span: SPAN,
            },
          ],
          span: SPAN,
        },
        span: SPAN,
      },
      { name: "...", span: SPAN },
      { name: "conf.level", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      {
        name: "conf.args",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "list", span: SPAN },
          arguments: [],
          span: SPAN,
        },
        span: SPAN,
      },
    ],
  },
];

async function builtinQqline(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchBuiltinArguments(invocation, QQLINE_PARAMETERS);
  const sample = await required(invocation, matched.get("y"), "y");
  const datax = await logicalControl(
    invocation,
    matched.get("datax"),
    false,
    "datax",
    "missing value where TRUE/FALSE needed",
  );
  const probabilities = await optionalValue(
    invocation,
    matched.get("probs"),
    doubleVector([0.25, 0.75]),
  );
  if (!isNumericVector(probabilities) || probabilities.length !== 2) {
    throw new RTypeMismatchError("NRT3422", "length(probs) == 2 is not TRUE");
  }
  const quantileType = await optionalValue(invocation, matched.get("qtype"), integerVector([7]));
  const distribution = await distributionCallable(invocation, matched.get("distribution"));
  const theoretical = await invocation.invoke(distribution, [{ value: probabilities }]);
  const quantile = await callableByName(invocation, "quantile");
  const observed = await invocation.invoke(quantile, [
    { value: sample },
    { value: probabilities },
    { name: "names", value: logicalVector([0]) },
    { name: "type", value: quantileType },
    { name: "na.rm", value: logicalVector([1]) },
  ]);
  if (!isNumericVector(theoretical) || !isNumericVector(observed)) {
    throw new RTypeMismatchError("NRT3422", "non-numeric argument to binary operator");
  }
  const horizontal = datax ? observed : theoretical;
  const vertical = datax ? theoretical : observed;
  const slope = dividedDifferences(vertical, horizontal);
  const intercept = lineIntercept(vertical, horizontal, slope);
  const abline = await callableByName(invocation, "abline");
  const environment = invocation.currentEnvironment();
  const result = await invocation.invokeLazy(abline, [
    { promise: createForcedPromise(intercept, environment) },
    { promise: createForcedPromise(slope, environment) },
    ...dots,
  ]);
  invocation.setResultVisibility("invisible");
  return result;
}

async function builtinQqnorm(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["y", "..."]);
  const argument = parsed.matched.get("y");
  const input = await required(invocation, argument, "y");
  const dispatched = await invocation.dispatchS3IfPresent("qqnorm", input, invocation.arguments);
  return dispatched ?? builtinQqnormDefault(invocation);
}

async function builtinQqnormDefault(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchBuiltinArguments(invocation, QQNORM_DEFAULT_PARAMETERS);
  const input = await required(invocation, matched.get("y"), "y");
  const values = numericWithMissing(input, "y");
  const present = values
    .map((value, index) => ({ value, index }))
    .filter((entry) => entry.value !== undefined)
    .sort((left, right) => left.value! - right.value!);
  if (present.length === 0) throw new RTypeMismatchError("NRT3422", "y is empty or has only NAs");
  const probabilities = plottingPositions(present.length);
  const theoretical = Array<number | undefined>(values.length).fill(undefined);
  for (let rank = 0; rank < present.length; rank += 1) {
    theoretical[present[rank]!.index] = normalQuantile(probabilities[rank] ?? 0.5);
  }
  const datax = await logicalControl(invocation, matched.get("datax"), false, "datax");
  const plot = await logicalControl(invocation, matched.get("plot.it"), true, "plot.it");
  const data = listValue(
    datax
      ? [optionalDoubleVector(values), optionalDoubleVector(theoretical)]
      : [optionalDoubleVector(theoretical), optionalDoubleVector(values)],
    ["x", "y"],
  );
  if (plot) {
    await plotPoints(
      invocation,
      data.values[0]!,
      data.values[1]!,
      matched,
      dots,
      "Normal Q-Q Plot",
      "Theoretical Quantiles",
      "Sample Quantiles",
    );
  }
  invocation.setResultVisibility("invisible");
  return data;
}

async function builtinQqplot(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchBuiltinArguments(invocation, QQPLOT_PARAMETERS);
  const left = compactNumeric(await required(invocation, matched.get("x"), "x"), "x");
  const right = compactNumeric(await required(invocation, matched.get("y"), "y"), "y");
  if (left.length === 0 || right.length === 0) {
    throw new RTypeMismatchError("NRT3422", "x and y must have at least one non-missing value");
  }
  left.sort((a, b) => a - b);
  right.sort((a, b) => a - b);
  const count = Math.min(left.length, right.length);
  const probabilities = Array.from({ length: count }, (_, index) =>
    count === 1 ? 0.5 : index / (count - 1),
  );
  const x =
    left.length === count ? left : probabilities.map((probability) => quantile(left, probability));
  const y =
    right.length === count
      ? right
      : probabilities.map((probability) => quantile(right, probability));
  const data = listValue([doubleVector(x), doubleVector(y)], ["x", "y"]);
  if (await logicalControl(invocation, matched.get("plot.it"), true, "plot.it")) {
    await plotPoints(invocation, data.values[0]!, data.values[1]!, matched, dots, "", "x", "y");
  }
  invocation.setResultVisibility("invisible");
  return data;
}

function plottingPositions(count: number): number[] {
  const adjustment = count <= 10 ? 3 / 8 : 1 / 2;
  return Array.from(
    { length: count },
    (_, index) => (index + 1 - adjustment) / (count + 1 - 2 * adjustment),
  );
}

function quantile(sorted: readonly number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return (
    (sorted[lower] ?? 0) + fraction * ((sorted[Math.ceil(position)] ?? 0) - (sorted[lower] ?? 0))
  );
}

function numericWithMissing(value: RValue, name: string): (number | undefined)[] {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3422", `'${name}' must be numeric`);
  }
  return Array.from({ length: value.length }, (_, index) =>
    isMissing(value, index) ? undefined : (value.values[index] ?? Number.NaN),
  );
}

function compactNumeric(value: RValue, name: string): number[] {
  return numericWithMissing(value, name).filter(
    (entry): entry is number => entry !== undefined && Number.isFinite(entry),
  );
}

function optionalDoubleVector(values: readonly (number | undefined)[]) {
  const missing = Uint8Array.from(values, (value) => (value === undefined ? 1 : 0));
  return doubleVector(
    values.map((value) => value ?? 0),
    missing.some((value) => value === 1) ? missing : undefined,
  );
}

function isNumericVector(
  value: RValue,
): value is Extract<RValue, { readonly type: "logical" | "integer" | "double" }> {
  return value.type === "logical" || value.type === "integer" || value.type === "double";
}

function dividedDifferences(numerator: RValue, denominator: RValue) {
  const numeratorValues = numericWithMissing(numerator, "numerator");
  const denominatorValues = numericWithMissing(denominator, "denominator");
  const numeratorDiff = adjacentDifferences(numeratorValues);
  const denominatorDiff = adjacentDifferences(denominatorValues);
  const length = Math.max(numeratorDiff.length, denominatorDiff.length);
  if (numeratorDiff.length === 0 || denominatorDiff.length === 0) return doubleVector([]);
  return optionalDoubleVector(
    Array.from({ length }, (_, index) =>
      divideOptional(
        numeratorDiff[index % numeratorDiff.length],
        denominatorDiff[index % denominatorDiff.length],
      ),
    ),
  );
}

function lineIntercept(vertical: RValue, horizontal: RValue, slope: RValue) {
  const verticalValues = numericWithMissing(vertical, "vertical");
  const horizontalValues = numericWithMissing(horizontal, "horizontal");
  const slopeValues = numericWithMissing(slope, "slope");
  if (verticalValues.length === 0 || horizontalValues.length === 0 || slopeValues.length === 0) {
    return doubleVector([]);
  }
  return optionalDoubleVector(
    slopeValues.map((value) => {
      const y = verticalValues[0];
      const x = horizontalValues[0];
      return value === undefined || y === undefined || x === undefined ? undefined : y - value * x;
    }),
  );
}

function adjacentDifferences(values: readonly (number | undefined)[]): (number | undefined)[] {
  return Array.from({ length: Math.max(0, values.length - 1) }, (_, index) => {
    const left = values[index];
    const right = values[index + 1];
    return left === undefined || right === undefined ? undefined : right - left;
  });
}

function divideOptional(
  numerator: number | undefined,
  denominator: number | undefined,
): number | undefined {
  return numerator === undefined || denominator === undefined ? undefined : numerator / denominator;
}

async function optionalValue(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: RValue,
): Promise<RValue> {
  return argument === undefined || argument.promise.missing
    ? fallback
    : invocation.force(argument.promise);
}

async function distributionCallable(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RValue> {
  const callable =
    argument === undefined || argument.promise.missing
      ? await callableByName(invocation, "qnorm")
      : await invocation.force(argument.promise);
  if (callable.type !== "builtin" && callable.type !== "closure") {
    throw new RTypeMismatchError("NRT3422", "is.function(distribution) is not TRUE");
  }
  return callable;
}

async function callableByName(invocation: BuiltinInvocation, name: string): Promise<RValue> {
  const binding = lookupBinding(invocation.currentEnvironment(), name);
  if (binding === undefined)
    throw new REvaluationError("NRE2001", `could not find function '${name}'`);
  const callable = await invocation.force(binding);
  if (callable.type !== "builtin" && callable.type !== "closure") {
    throw new RTypeMismatchError("NRT3422", `'${name}' is not a function`);
  }
  return callable;
}

async function logicalControl(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
  missingMessage?: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    missingMessage !== undefined &&
    (value.type === "logical" || value.type === "integer" || value.type === "double") &&
    value.length === 1 &&
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3422", missingMessage);
  }
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3422", `'${name}' must be one non-missing logical value`);
  }
  return (value.values[0] ?? 0) !== 0;
}

async function plotPoints(
  invocation: BuiltinInvocation,
  x: RValue,
  y: RValue,
  matched: ReadonlyMap<string, BuiltinCallArgument>,
  dots: readonly BuiltinCallArgument[],
  defaultMain: string,
  defaultXlab: string,
  defaultYlab: string,
): Promise<void> {
  const binding = lookupBinding(invocation.currentEnvironment(), "plot");
  if (binding === undefined)
    throw new REvaluationError("NRE2001", "could not find function 'plot'");
  const callable = await invocation.force(binding);
  const arguments_: { readonly name?: string; readonly value: RValue }[] = [
    { value: x },
    { value: y },
    { name: "main", value: await textControl(invocation, matched.get("main"), defaultMain) },
    { name: "xlab", value: await textControl(invocation, matched.get("xlab"), defaultXlab) },
    { name: "ylab", value: await textControl(invocation, matched.get("ylab"), defaultYlab) },
  ];
  const ylim = matched.get("ylim");
  if (ylim !== undefined && !ylim.promise.missing)
    arguments_.push({ name: "ylim", value: await invocation.force(ylim.promise) });
  for (const argument of dots) {
    const value = await invocation.force(argument.promise);
    arguments_.push(argument.name === undefined ? { value } : { name: argument.name, value });
  }
  await invocation.invoke(callable, arguments_);
}

async function textControl(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) return characterVector([fallback]);
  return invocation.force(argument.promise);
}

async function required(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing.`);
  }
  return invocation.force(argument.promise);
}
