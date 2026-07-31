import {
  REvaluationError,
  RTypeMismatchError,
  complexVector,
  doubleVector,
  isFactor,
  isMissing,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  RComplexVector,
  RDoubleVector,
  RIntegerVector,
  RLogicalVector,
  RValue,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

type NumericVector = RLogicalVector | RIntegerVector | RDoubleVector | RComplexVector;

export interface WeightedMeanBuiltinSpec {
  readonly name: "weighted.mean" | "weighted.mean.default";
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral" | "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

const DEFAULT_PARAMETERS = ["x", "w", "...", "na.rm"] as const;

export const WEIGHTED_MEAN_BUILTIN_SPECS: readonly WeightedMeanBuiltinSpec[] = [
  {
    name: "weighted.mean",
    parameters: ["x", "w", "..."],
    compatibility: "behavioral",
    implementation: builtinWeightedMean,
  },
  {
    name: "weighted.mean.default",
    parameters: DEFAULT_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinWeightedMeanDefault,
  },
];

async function builtinWeightedMean(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "w", "..."]);
  const xArgument = requiredArgument(matched.get("x"), "weighted.mean");
  const x = await invocation.force(xArgument.promise);
  const dispatched = await invocation.dispatchS3IfPresent("weighted.mean", x, invocation.arguments);
  return dispatched ?? builtinWeightedMeanDefault(invocation);
}

async function builtinWeightedMeanDefault(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, DEFAULT_PARAMETERS);
  const x = numericVector(
    await invocation.force(requiredArgument(matched.get("x"), "weighted.mean.default").promise),
    "x",
  );
  const wArgument = matched.get("w");
  const weights =
    wArgument === undefined || wArgument.promise.missing
      ? undefined
      : numericVector(await invocation.force(wArgument.promise), "w");
  if (weights !== undefined && weights.length !== x.length) {
    throw new RTypeMismatchError("NRT3306", "'x' and 'w' must have the same length");
  }
  const removeMissing = await logicalFlag(invocation, matched.get("na.rm"));
  const complex = x.type === "complex" || weights?.type === "complex";
  if (isFactor(x)) {
    invocation.context.warn({ code: "NRW1114", message: "'*' not meaningful for factors" });
    return missingResult(complex);
  }

  let numeratorReal = 0;
  let numeratorImaginary = 0;
  let weightReal = 0;
  let weightImaginary = 0;
  for (let index = 0; index < x.length; index += 1) {
    invocation.context.checkpoint();
    const xValue = complexAt(x, index);
    const xMissing = isMissing(x, index);
    const xNaN = Number.isNaN(xValue.real) || Number.isNaN(xValue.imaginary);
    if (removeMissing && (xMissing || xNaN)) continue;

    const weightValue =
      weights === undefined ? { real: 1, imaginary: 0 } : complexAt(weights, index);
    if (weights !== undefined && isMissing(weights, index)) return missingResult(complex);
    if (Number.isNaN(weightValue.real) || Number.isNaN(weightValue.imaginary)) {
      return missingResult(complex);
    }
    if (weightValue.real === 0 && weightValue.imaginary === 0) continue;
    if (xMissing) return missingResult(complex);

    numeratorReal += xValue.real * weightValue.real - xValue.imaginary * weightValue.imaginary;
    numeratorImaginary += xValue.real * weightValue.imaginary + xValue.imaginary * weightValue.real;
    weightReal += weightValue.real;
    weightImaginary += weightValue.imaginary;
  }
  invocation.context.allocate(1);
  if (!complex) return doubleVector([numeratorReal / weightReal]);
  const denominator = weightReal * weightReal + weightImaginary * weightImaginary;
  return complexVector(
    [(numeratorReal * weightReal + numeratorImaginary * weightImaginary) / denominator],
    [(numeratorImaginary * weightReal - numeratorReal * weightImaginary) / denominator],
  );
}

function requiredArgument(
  argument: BuiltinCallArgument | undefined,
  call: string,
): BuiltinCallArgument {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument 'x' is missing in ${call}().`);
  }
  return argument;
}

function numericVector(value: RValue, argument: "x" | "w"): NumericVector {
  if (
    value.type !== "logical" &&
    value.type !== "integer" &&
    value.type !== "double" &&
    value.type !== "complex"
  ) {
    throw new RTypeMismatchError(
      "NRT3306",
      `weighted.mean.default() '${argument}' must be numeric.`,
    );
  }
  return value;
}

async function logicalFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return false;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    Number.isNaN(value.values[0] ?? Number.NaN)
  ) {
    throw new RTypeMismatchError(
      "NRT3306",
      "weighted.mean.default() 'na.rm' must be one non-missing logical value.",
    );
  }
  return value.values[0] !== 0;
}

function complexAt(
  value: NumericVector,
  index: number,
): { readonly real: number; readonly imaginary: number } {
  return value.type === "complex"
    ? { real: value.real[index] ?? 0, imaginary: value.imaginary[index] ?? 0 }
    : { real: value.values[index] ?? 0, imaginary: 0 };
}

function missingResult(complex: boolean): RDoubleVector | RComplexVector {
  return complex ? complexVector([0], [0], [1]) : doubleVector([0], [1]);
}
