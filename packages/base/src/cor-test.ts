import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  characterVector,
  deparseAst,
  doubleVector,
  integerVector,
  isFactor,
  isMissing,
  listValue,
  withAttribute,
  withClasses,
  withNames,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";
import { normalQuantile, studentTProbability } from "./student-t.js";

export interface CorTestBuiltinSpec {
  readonly name: "cor.test" | "cor.test.default";
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral" | "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

const COR_TEST_DEFAULT_PARAMETERS = [
  "x",
  "y",
  "alternative",
  "method",
  "exact",
  "conf.level",
  "continuity",
  "...",
] as const;

export const COR_TEST_BUILTIN_SPECS: readonly CorTestBuiltinSpec[] = [
  {
    name: "cor.test",
    parameters: ["x", "..."],
    compatibility: "behavioral",
    implementation: builtinCorTest,
  },
  {
    name: "cor.test.default",
    parameters: COR_TEST_DEFAULT_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinCorTestDefault,
  },
];

async function builtinCorTest(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, COR_TEST_DEFAULT_PARAMETERS);
  const xArgument = parsed.matched.get("x");
  const x = await forceRequired(invocation, xArgument, "x");
  const dispatched = await invocation.dispatchS3IfPresent("cor.test", x, invocation.arguments);
  return (
    dispatched ??
    builtinCorTestDefault(invocation, {
      x: callArgumentName(invocation, "x", 0, argumentName(xArgument, "x")),
      y: callArgumentName(invocation, "y", 1, argumentName(parsed.matched.get("y"), "y")),
    })
  );
}

async function builtinCorTestDefault(
  invocation: BuiltinInvocation,
  dataNames?: { readonly x: string; readonly y: string },
): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, COR_TEST_DEFAULT_PARAMETERS);
  const xArgument = parsed.matched.get("x");
  const yArgument = parsed.matched.get("y");
  const x = await numericInput(invocation, xArgument, "x");
  const y = await numericInput(invocation, yArgument, "y");
  if (x.length !== y.length) {
    throw new RTypeMismatchError("NRT3423", "'x' and 'y' must have the same length");
  }

  const method = await matchedChoice(
    invocation,
    parsed.matched.get("method"),
    ["pearson", "kendall", "spearman"],
    "pearson",
    "method",
  );
  if (method !== "pearson") {
    throw new RUnsupportedFeatureError(
      "NRU6202",
      `cor.test(method = '${method}') awaits its reusable rank-test path.`,
    );
  }
  const alternative = await matchedChoice(
    invocation,
    parsed.matched.get("alternative"),
    ["two.sided", "less", "greater"],
    "two.sided",
    "alternative",
  );
  const confidence = await confidenceLevel(invocation, parsed.matched.get("conf.level"));

  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < x.length; index += 1) {
    invocation.context.checkpoint();
    const xValue = x.values[index] ?? Number.NaN;
    const yValue = y.values[index] ?? Number.NaN;
    if (
      isMissing(x, index) ||
      isMissing(y, index) ||
      Number.isNaN(xValue) ||
      Number.isNaN(yValue)
    ) {
      continue;
    }
    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      throw new RTypeMismatchError("NRT3423", "'x' and 'y' must contain finite values");
    }
    xs.push(xValue);
    ys.push(yValue);
  }
  if (xs.length < 3) {
    throw new RTypeMismatchError("NRT3423", "not enough finite observations");
  }
  invocation.context.allocate(xs.length * 2 + 16);

  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let cross = 0;
  let xSquares = 0;
  let ySquares = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const xCentered = (xs[index] ?? 0) - xMean;
    const yCentered = (ys[index] ?? 0) - yMean;
    cross += xCentered * yCentered;
    xSquares += xCentered * xCentered;
    ySquares += yCentered * yCentered;
  }
  if (xSquares === 0 || ySquares === 0) {
    throw new RTypeMismatchError("NRT3423", "not enough finite observations");
  }
  const estimate = Math.max(-1, Math.min(1, cross / Math.sqrt(xSquares * ySquares)));
  const degreesOfFreedom = xs.length - 2;
  const statistic =
    Math.abs(estimate) === 1
      ? Math.sign(estimate) * Number.POSITIVE_INFINITY
      : estimate * Math.sqrt(degreesOfFreedom / ((1 + estimate) * (1 - estimate)));
  const probability =
    alternative === "two.sided"
      ? Math.min(1, 2 * studentTProbability(Math.abs(statistic), degreesOfFreedom, false))
      : studentTProbability(statistic, degreesOfFreedom, alternative === "less");

  const confidenceInterval = pearsonConfidenceInterval(
    estimate,
    xs.length,
    confidence,
    alternative,
  );
  const dataName = `${dataNames?.x ?? argumentName(xArgument, "x")} and ${dataNames?.y ?? argumentName(yArgument, "y")}`;
  return withClasses(
    listValue(
      [
        withNames(doubleVector([statistic]), ["t"]),
        withNames(integerVector([degreesOfFreedom]), ["df"]),
        doubleVector([probability]),
        withNames(doubleVector([estimate]), ["cor"]),
        withNames(doubleVector([0]), ["correlation"]),
        characterVector([alternative]),
        characterVector(["Pearson's product-moment correlation"]),
        characterVector([dataName]),
        withAttribute(doubleVector(confidenceInterval), "conf.level", doubleVector([confidence])),
      ],
      [
        "statistic",
        "parameter",
        "p.value",
        "estimate",
        "null.value",
        "alternative",
        "method",
        "data.name",
        "conf.int",
      ],
    ),
    ["htest"],
  );
}

function pearsonConfidenceInterval(
  estimate: number,
  observationCount: number,
  confidence: number,
  alternative: string,
): readonly number[] {
  if (observationCount < 4) return [];
  const criticalProbability = alternative === "two.sided" ? (1 + confidence) / 2 : confidence;
  const critical = normalQuantile(criticalProbability) / Math.sqrt(observationCount - 3);
  const transformed = Math.atanh(estimate);
  const lower = alternative === "less" ? -1 : Math.tanh(transformed - critical);
  const upper = alternative === "greater" ? 1 : Math.tanh(transformed + critical);
  return [lower, upper];
}

async function numericInput(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
) {
  const value = await forceRequired(invocation, argument, name);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    isFactor(value)
  ) {
    throw new RTypeMismatchError("NRT3423", `'${name}' must be a numeric vector`);
  }
  return value;
}

async function forceRequired(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in cor.test().`);
  }
  return invocation.force(argument.promise);
}

async function matchedChoice<T extends string>(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  choices: readonly T[],
  fallback: T,
  name: string,
): Promise<T> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length < 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3423", `'${name}' must be a character value`);
  }
  const supplied = value.values[0] ?? "";
  const matches = choices.filter((choice) => choice.startsWith(supplied));
  if (matches.length !== 1) {
    throw new RTypeMismatchError("NRT3423", `'${name}' should be one of ${choices.join(", ")}`);
  }
  return matches[0] ?? fallback;
}

async function confidenceLevel(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return 0.95;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3423", "'conf.level' must be a single number");
  }
  const result = value.values[0] ?? Number.NaN;
  if (!Number.isFinite(result) || result < 0 || result > 1) {
    throw new RTypeMismatchError("NRT3423", "'conf.level' must be between 0 and 1");
  }
  return result;
}

function argumentName(argument: BuiltinCallArgument | undefined, fallback: string): string {
  return argument?.promise.expression === null || argument?.promise.expression === undefined
    ? fallback
    : deparseAst(argument.promise.expression);
}

function callArgumentName(
  invocation: BuiltinInvocation,
  name: string,
  positionalIndex: number,
  fallback: string,
): string {
  const call = invocation.currentCall();
  if (call.type !== "language" || call.expression.kind !== "CallExpression") return fallback;
  const named = call.expression.arguments.find((argument) => argument.name === name);
  if (named !== undefined) return deparseAst(named.value);
  const positional = call.expression.arguments.filter((argument) => argument.name === undefined)[
    positionalIndex
  ];
  return positional === undefined ? fallback : deparseAst(positional.value);
}
