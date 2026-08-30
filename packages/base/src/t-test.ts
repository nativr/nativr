import {
  REvaluationError,
  RTypeMismatchError,
  characterVector,
  deparseAst,
  doubleVector,
  factorLevels,
  integerVector,
  isDataFrame,
  isFactor,
  isMissing,
  listValue,
  subsetVector,
  vectorNames,
  withAttribute,
  withClasses,
  withNames,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";
import { studentTProbability, studentTQuantile } from "./student-t.js";

export interface TTestBuiltinSpec {
  readonly name: "t.test" | "t.test.default" | "t.test.formula";
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral" | "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

const T_TEST_PARAMETERS = [
  "x",
  "y",
  "alternative",
  "mu",
  "paired",
  "var.equal",
  "conf.level",
  "...",
] as const;

export const T_TEST_BUILTIN_SPECS: readonly TTestBuiltinSpec[] = [
  {
    name: "t.test",
    parameters: ["x", "..."],
    compatibility: "behavioral",
    implementation: builtinTTest,
  },
  {
    name: "t.test.default",
    parameters: T_TEST_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinTTestDefault,
  },
  {
    name: "t.test.formula",
    parameters: ["formula", "data", "subset", "na.action", "..."],
    compatibility: "behavioral",
    implementation: builtinTTestFormula,
  },
];

async function builtinTTest(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, T_TEST_PARAMETERS);
  const argument = parsed.matched.get("x");
  const x = await forceRequired(invocation, argument, "x");
  const dispatched = await invocation.dispatchS3IfPresent("t.test", x, invocation.arguments);
  return dispatched ?? builtinTTestDefault(invocation);
}

async function builtinTTestDefault(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, T_TEST_PARAMETERS);
  const xArgument = parsed.matched.get("x");
  const yArgument = parsed.matched.get("y");
  const xInput = await numericInput(invocation, xArgument, "x");
  const yInput =
    yArgument === undefined || yArgument.promise.missing
      ? undefined
      : await numericInput(invocation, yArgument, "y");
  const alternative = await matchedChoice(
    invocation,
    parsed.matched.get("alternative"),
    ["two.sided", "less", "greater"],
    "two.sided",
    "alternative",
  );
  const mu = await scalarNumber(invocation, parsed.matched.get("mu"), 0, "mu");
  const paired = await scalarFlag(invocation, parsed.matched.get("paired"), false, "paired");
  const equalVariance = await scalarFlag(
    invocation,
    parsed.matched.get("var.equal"),
    false,
    "var.equal",
  );
  const confidence = await confidenceLevel(invocation, parsed.matched.get("conf.level"));

  let x: number[];
  let y: number[] | undefined;
  if (paired) {
    if (yInput === undefined || xInput.length !== yInput.length) {
      throw new RTypeMismatchError("NRT3423", "not all arguments have the same length");
    }
    x = [];
    for (let index = 0; index < xInput.length; index += 1) {
      const left = finiteElement(xInput, index);
      const right = finiteElement(yInput, index);
      if (left !== undefined && right !== undefined) x.push(left - right);
    }
    y = undefined;
  } else {
    x = finiteValues(xInput);
    y = yInput === undefined ? undefined : finiteValues(yInput);
  }

  let estimate: RValue;
  let method: string;
  let statistic: number;
  let degrees: number;
  let standardError: number;
  let center: number;
  if (y === undefined) {
    if (x.length < 2) throw new RTypeMismatchError("NRT3423", "not enough 'x' observations");
    center = mean(x);
    standardError = Math.sqrt(sampleVariance(x) / x.length);
    degrees = x.length - 1;
    statistic = (center - mu) / standardError;
    estimate = withNames(doubleVector([center]), [paired ? "mean difference" : "mean of x"]);
    method = paired ? "Paired t-test" : "One Sample t-test";
  } else {
    if (x.length < 2 || y.length < 2) {
      throw new RTypeMismatchError("NRT3423", "not enough observations");
    }
    const xMean = mean(x);
    const yMean = mean(y);
    const xVariance = sampleVariance(x);
    const yVariance = sampleVariance(y);
    center = xMean - yMean;
    if (equalVariance) {
      degrees = x.length + y.length - 2;
      const pooled = ((x.length - 1) * xVariance + (y.length - 1) * yVariance) / degrees;
      standardError = Math.sqrt(pooled * (1 / x.length + 1 / y.length));
      method = "Two Sample t-test";
    } else {
      const xTerm = xVariance / x.length;
      const yTerm = yVariance / y.length;
      standardError = Math.sqrt(xTerm + yTerm);
      degrees = (xTerm + yTerm) ** 2 / (xTerm ** 2 / (x.length - 1) + yTerm ** 2 / (y.length - 1));
      method = "Welch Two Sample t-test";
    }
    statistic = (center - mu) / standardError;
    estimate = withNames(doubleVector([xMean, yMean]), ["mean of x", "mean of y"]);
  }
  if (!Number.isFinite(standardError) || standardError < 10 * Number.EPSILON) {
    throw new RTypeMismatchError("NRT3423", "data are essentially constant");
  }
  const pValue =
    alternative === "two.sided"
      ? Math.min(1, 2 * studentTProbability(Math.abs(statistic), degrees, false))
      : studentTProbability(statistic, degrees, alternative === "less");
  const probability = alternative === "two.sided" ? (1 + confidence) / 2 : confidence;
  const critical = studentTQuantile(probability, degrees) * standardError;
  const interval =
    alternative === "less"
      ? [Number.NEGATIVE_INFINITY, center - mu + critical]
      : alternative === "greater"
        ? [center - mu - critical, Number.POSITIVE_INFINITY]
        : [center - mu - critical, center - mu + critical];
  const dataName =
    yArgument === undefined
      ? argumentLabel(xArgument, "x")
      : `${argumentLabel(xArgument, "x")} and ${argumentLabel(yArgument, "y")}`;
  invocation.context.allocate(x.length + (y?.length ?? 0) + 20);
  return withClasses(
    listValue(
      [
        withNames(doubleVector([statistic]), ["t"]),
        withNames(doubleVector([degrees]), ["df"]),
        doubleVector([pValue]),
        withAttribute(doubleVector(interval), "conf.level", doubleVector([confidence])),
        estimate,
        withNames(doubleVector([mu]), [y === undefined ? "mean" : "difference in means"]),
        doubleVector([standardError]),
        characterVector([alternative]),
        characterVector([method]),
        characterVector([dataName]),
      ],
      [
        "statistic",
        "parameter",
        "p.value",
        "conf.int",
        "estimate",
        "null.value",
        "stderr",
        "alternative",
        "method",
        "data.name",
      ],
    ),
    ["htest"],
  );
}

async function builtinTTestFormula(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "formula",
    "data",
    "subset",
    "na.action",
    "...",
  ]);
  const formulaArgument = parsed.matched.get("formula");
  const formula = await forceRequired(invocation, formulaArgument, "formula");
  if (formula.type !== "formula") {
    throw new RTypeMismatchError("NRT3423", "'formula' missing or incorrect");
  }
  if (parsed.dots.some((argument) => argument.name === "paired")) {
    throw new REvaluationError("NRE2148", "cannot use 'paired' in formula method");
  }
  const modelFrame = await invocation.namespaceBinding("stats", "model.frame");
  if (modelFrame === undefined)
    throw new REvaluationError("NRE2001", "Object 'model.frame' not found.");
  const modelArguments: { readonly name?: string; readonly value: RValue }[] = [
    { name: "formula", value: formula },
  ];
  const dataArgument = parsed.matched.get("data");
  if (dataArgument !== undefined && !dataArgument.promise.missing) {
    modelArguments.push({ name: "data", value: await invocation.force(dataArgument.promise) });
  }
  const subsetArgument = parsed.matched.get("subset");
  if (subsetArgument !== undefined && !subsetArgument.promise.missing) {
    throw new REvaluationError(
      "NRE2148",
      "t.test.formula(subset=) requires the wider model-frame subset.",
    );
  }
  const naActionArgument = parsed.matched.get("na.action");
  modelArguments.push({
    name: "na.action",
    value:
      naActionArgument === undefined || naActionArgument.promise.missing
        ? { type: "null" }
        : await invocation.force(naActionArgument.promise),
  });
  const model = await invocation.invoke(
    modelFrame,
    modelArguments,
    formula.environment ?? formulaArgument?.promise.environment,
  );
  if (!isDataFrame(model) || model.values.length !== 2) {
    throw new RTypeMismatchError("NRT3423", "'formula' missing or incorrect");
  }
  const response = model.values[0];
  const grouping = model.values[1];
  if (
    response === undefined ||
    (response.type !== "logical" && response.type !== "integer" && response.type !== "double") ||
    isFactor(response) ||
    grouping?.type !== "integer" ||
    !isFactor(grouping)
  ) {
    throw new RTypeMismatchError(
      "NRT3423",
      "t.test.formula() requires a numeric response and a two-level grouping factor",
    );
  }
  const levels = factorLevels(grouping);
  if (levels.length !== 2) {
    throw new RTypeMismatchError("NRT3423", "grouping factor must have exactly 2 levels");
  }
  const indices = levels.map((_level, levelIndex) => {
    const selected: number[] = [];
    for (let index = 0; index < grouping.length; index += 1) {
      invocation.context.checkpoint();
      if (!isMissing(grouping, index) && (grouping.values[index] ?? 0) === levelIndex + 1) {
        selected.push(index + 1);
      }
    }
    return integerVector(selected);
  });
  const target = await invocation.namespaceBinding("stats", "t.test.default");
  if (target === undefined)
    throw new REvaluationError("NRE2001", "Object 't.test.default' not found.");
  const testArguments: { readonly name?: string; readonly value: RValue }[] = [
    { name: "x", value: subsetVector(response, indices[0], invocation.context) },
    { name: "y", value: subsetVector(response, indices[1], invocation.context) },
  ];
  for (const argument of parsed.dots) {
    if (argument.promise.missing) continue;
    testArguments.push({
      ...(argument.name === undefined ? {} : { name: argument.name }),
      value: await invocation.force(argument.promise),
    });
  }
  const result = await invocation.invoke(target, testArguments, invocation.currentEnvironment());
  if (result.type !== "list") return result;
  const values = [...result.values];
  const estimate = values[4];
  if (estimate?.type === "double" && estimate.length === 2) {
    values[4] = withNames(
      estimate,
      levels.map((level) => `mean in group ${level}`),
    );
  }
  const nullValue = values[5];
  if (nullValue?.type === "double" && nullValue.length === 1) {
    values[5] = withNames(nullValue, [
      `difference in means between group ${levels[0] ?? ""} and group ${levels[1] ?? ""}`,
    ]);
  }
  const modelNames = vectorNames(model) ?? ["response", "group"];
  values[9] = characterVector([modelNames.join(" by ")]);
  return { ...result, values: Object.freeze(values) };
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
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in t.test().`);
  }
  return invocation.force(argument.promise);
}

function finiteValues(value: Awaited<ReturnType<typeof numericInput>>): number[] {
  const output: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const element = finiteElement(value, index);
    if (element !== undefined) output.push(element);
  }
  return output;
}

function finiteElement(
  value: Awaited<ReturnType<typeof numericInput>>,
  index: number,
): number | undefined {
  if (isMissing(value, index)) return undefined;
  const element = value.values[index] ?? Number.NaN;
  if (Number.isNaN(element)) return undefined;
  if (!Number.isFinite(element)) {
    throw new RTypeMismatchError("NRT3423", "missing value where TRUE/FALSE needed");
  }
  return element;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleVariance(values: readonly number[]): number {
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
}

async function scalarNumber(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    !Number.isFinite(value.values[0] ?? Number.NaN)
  ) {
    throw new RTypeMismatchError("NRT3423", `'${name}' must be a single number`);
  }
  return value.values[0] ?? fallback;
}

async function scalarFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3423", `'${name}' must be TRUE or FALSE`);
  }
  return value.values[0] === 1;
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
    throw new RTypeMismatchError("NRT3423", `'${name}' must be a character choice`);
  }
  const requested = value.values[0] ?? "";
  const matches = choices.filter((choice) => choice.startsWith(requested));
  if (matches.length !== 1) throw new REvaluationError("NRE2131", `invalid '${name}' argument`);
  return matches[0]!;
}

async function confidenceLevel(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number> {
  const value = await scalarNumber(invocation, argument, 0.95, "conf.level");
  if (!(value > 0 && value < 1)) {
    throw new RTypeMismatchError("NRT3423", "'conf.level' must be a single number between 0 and 1");
  }
  return value;
}

function argumentLabel(argument: BuiltinCallArgument | undefined, fallback: string): string {
  if (argument?.promise.expression === null || argument?.promise.expression === undefined) {
    return fallback;
  }
  return deparseAst(argument.promise.expression);
}
