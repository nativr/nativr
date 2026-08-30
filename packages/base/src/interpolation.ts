import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  doubleVector,
  integerVector,
  isFactor,
  isMissing,
  listValue,
  vectorDimensions,
  vectorNames,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RBuiltin,
  RDoubleVector,
  RIntegerVector,
  RLogicalVector,
  RValue,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";
import {
  evaluateCubicHermite,
  evaluateCubicHermiteDerivative,
  evaluateCubicSpline,
  fmmSecondDerivatives,
  fritschCarlsonTangents,
  hymanFilterTangents,
  naturalSecondDerivatives,
  periodicSecondDerivatives,
  splineTangentsFromSecondDerivatives,
} from "./cubic-spline.js";

export interface InterpolationBuiltinSpec {
  readonly name: "approx" | "approxfun" | "spline" | "splinefun";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly formals?: NonNullable<BuiltinDefinition["formals"]>;
}

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

const APPROX_PARAMETERS = [
  "x",
  "y",
  "xout",
  "method",
  "n",
  "yleft",
  "yright",
  "rule",
  "f",
  "ties",
  "na.rm",
] as const;

const APPROXFUN_PARAMETERS = [
  "x",
  "y",
  "method",
  "yleft",
  "yright",
  "rule",
  "f",
  "ties",
  "na.rm",
] as const;

const SPLINE_PARAMETERS = ["x", "y", "n", "method", "xmin", "xmax", "xout", "ties"] as const;
const SPLINEFUN_PARAMETERS = ["x", "y", "method", "ties"] as const;

export const INTERPOLATION_BUILTIN_SPECS: readonly InterpolationBuiltinSpec[] = [
  {
    name: "approx",
    parameters: APPROX_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinApprox,
  },
  {
    name: "approxfun",
    parameters: APPROXFUN_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinApproxFunction,
    formals: [
      { name: "x", span: SPAN },
      { name: "y", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      {
        name: "method",
        defaultValue: { kind: "StringLiteral", value: "linear", span: SPAN },
        span: SPAN,
      },
      { name: "yleft", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      { name: "yright", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      { name: "rule", defaultValue: { kind: "IntegerLiteral", value: 1, span: SPAN }, span: SPAN },
      { name: "f", defaultValue: { kind: "DoubleLiteral", value: 0, span: SPAN }, span: SPAN },
      { name: "ties", defaultValue: { kind: "Identifier", name: "mean", span: SPAN }, span: SPAN },
      {
        name: "na.rm",
        defaultValue: { kind: "LogicalLiteral", value: true, span: SPAN },
        span: SPAN,
      },
    ],
  },
  {
    name: "spline",
    parameters: SPLINE_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinSpline,
    formals: [
      { name: "x", span: SPAN },
      { name: "y", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      {
        name: "n",
        defaultValue: {
          kind: "BinaryExpression",
          operator: "*",
          left: { kind: "IntegerLiteral", value: 3, span: SPAN },
          right: {
            kind: "CallExpression",
            callee: { kind: "Identifier", name: "length", span: SPAN },
            arguments: [{ value: { kind: "Identifier", name: "x", span: SPAN }, span: SPAN }],
            span: SPAN,
          },
          span: SPAN,
        },
        span: SPAN,
      },
      {
        name: "method",
        defaultValue: { kind: "StringLiteral", value: "fmm", span: SPAN },
        span: SPAN,
      },
      {
        name: "xmin",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "min", span: SPAN },
          arguments: [{ value: { kind: "Identifier", name: "x", span: SPAN }, span: SPAN }],
          span: SPAN,
        },
        span: SPAN,
      },
      {
        name: "xmax",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "max", span: SPAN },
          arguments: [{ value: { kind: "Identifier", name: "x", span: SPAN }, span: SPAN }],
          span: SPAN,
        },
        span: SPAN,
      },
      { name: "xout", span: SPAN },
      {
        name: "ties",
        defaultValue: { kind: "Identifier", name: "mean", span: SPAN },
        span: SPAN,
      },
    ],
  },
  {
    name: "splinefun",
    parameters: SPLINEFUN_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinSplineFunction,
    formals: [
      { name: "x", span: SPAN },
      { name: "y", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      {
        name: "method",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "c", span: SPAN },
          arguments: ["fmm", "periodic", "natural", "monoH.FC", "hyman"].map((value) => ({
            value: { kind: "StringLiteral", value, span: SPAN },
            span: SPAN,
          })),
          span: SPAN,
        },
        span: SPAN,
      },
      { name: "ties", defaultValue: { kind: "Identifier", name: "mean", span: SPAN }, span: SPAN },
    ],
  },
];

type NumericVector = RLogicalVector | RIntegerVector | RDoubleVector;
type SampleStatus = "value" | "missing" | "nan";

interface Sample {
  readonly x: number;
  readonly y: number;
  readonly status: SampleStatus;
}

interface CoordinatePair {
  readonly x: NumericVector;
  readonly y: NumericVector;
}

async function builtinApprox(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, APPROX_PARAMETERS);
  const coordinates = await approxCoordinates(invocation, matched);
  const method = await approxChoice(
    invocation,
    matched.get("method"),
    ["linear", "constant"],
    "linear",
    "method",
  );
  const removeMissing = await approxFlag(invocation, matched.get("na.rm"), true, "na.rm");
  const tieMethod = await approxTies(invocation, matched.get("ties"));
  const samples = await regularizeSamples(
    invocation,
    coordinates,
    removeMissing,
    tieMethod,
    matched.has("ties"),
  );
  const minimumSamples = method === "linear" ? 2 : 1;
  if (samples.length < minimumSamples) {
    throw new RTypeMismatchError(
      "NRT3290",
      `need at least ${minimumSamples === 2 ? "two" : "one"} non-NA values to interpolate`,
    );
  }

  const xout = await approxOutputCoordinates(
    invocation,
    matched.get("xout"),
    matched.get("n"),
    samples,
  );
  const rules = await approxRules(invocation, matched.get("rule"));
  const left = await approxBoundary(invocation, matched.get("yleft"));
  const right = await approxBoundary(invocation, matched.get("yright"));
  const fraction = await approxFraction(invocation, matched.get("f"));
  invocation.context.allocate(xout.length);
  const output = new Float64Array(xout.length);
  const missing = new Uint8Array(xout.length);
  for (let index = 0; index < xout.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(xout, index)) {
      missing[index] = 1;
      continue;
    }
    const coordinate = xout.values[index] ?? Number.NaN;
    if (Number.isNaN(coordinate)) {
      output[index] = Number.NaN;
      continue;
    }
    const interpolated = interpolateAt(
      coordinate,
      samples,
      method,
      fraction,
      left ?? boundaryFromRule(samples[0]!, rules[0]),
      right ?? boundaryFromRule(samples[samples.length - 1]!, rules[1]),
    );
    output[index] = interpolated.y;
    if (interpolated.status === "missing") missing[index] = 1;
    else if (interpolated.status === "nan") output[index] = Number.NaN;
  }
  return listValue(
    [xout, doubleVector(output, missing.some((entry) => entry === 1) ? missing : undefined)],
    ["x", "y"],
  );
}

async function builtinApproxFunction(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, APPROXFUN_PARAMETERS);
  const coordinates = await approxCoordinates(invocation, matched);
  const method = await approxChoice(
    invocation,
    matched.get("method"),
    ["linear", "constant"],
    "linear",
    "method",
  );
  const removeMissing = await approxFlag(invocation, matched.get("na.rm"), true, "na.rm");
  const tieMethod = await approxTies(invocation, matched.get("ties"));
  const samples = await regularizeSamples(
    invocation,
    coordinates,
    removeMissing,
    tieMethod,
    matched.has("ties"),
  );
  const minimumSamples = method === "linear" ? 2 : 1;
  if (samples.length < minimumSamples) {
    throw new RTypeMismatchError(
      "NRT3290",
      `need at least ${minimumSamples === 2 ? "two" : "one"} non-NA values to interpolate`,
    );
  }
  const rules = await approxRules(invocation, matched.get("rule"));
  const left = await approxBoundary(invocation, matched.get("yleft"));
  const right = await approxBoundary(invocation, matched.get("yright"));
  const fraction = await approxFraction(invocation, matched.get("f"));
  const interpolator: RBuiltin = {
    type: "builtin",
    definition: {
      package: "stats",
      name: "approxfun",
      kind: "regular",
      formals: [{ name: "v", span: SPAN }],
      metadata: {
        compatibilityLevel: "numeric",
        supportedArguments: ["v"],
      },
      implementation: async (call) => {
        const { matched: callArguments } = matchBuiltinArguments(call, ["v"]);
        const argument = callArguments.get("v");
        if (argument === undefined || argument.promise.missing) {
          throw new REvaluationError("NRE2143", 'argument "v" is missing, with no default');
        }
        const points = approxNumericVector(await call.force(argument.promise), "v");
        call.context.allocate(points.length);
        const output = new Float64Array(points.length);
        const missing = new Uint8Array(points.length);
        for (let index = 0; index < points.length; index += 1) {
          call.context.checkpoint();
          if (isMissing(points, index)) {
            missing[index] = 1;
            continue;
          }
          const coordinate = points.values[index] ?? Number.NaN;
          if (Number.isNaN(coordinate)) {
            output[index] = Number.NaN;
            continue;
          }
          const interpolated = interpolateAt(
            coordinate,
            samples,
            method,
            fraction,
            left ?? boundaryFromRule(samples[0]!, rules[0]),
            right ?? boundaryFromRule(samples[samples.length - 1]!, rules[1]),
          );
          output[index] = interpolated.y;
          if (interpolated.status === "missing") missing[index] = 1;
          else if (interpolated.status === "nan") output[index] = Number.NaN;
        }
        return doubleVector(output, missing.some((entry) => entry === 1) ? missing : undefined);
      },
    },
  };
  invocation.context.allocate(1);
  return interpolator;
}

async function builtinSpline(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, SPLINE_PARAMETERS);
  const coordinates = await approxCoordinates(invocation, matched);
  const tieMethod = await approxTies(invocation, matched.get("ties"));
  let samples = await regularizeSamples(
    invocation,
    coordinates,
    true,
    tieMethod,
    matched.has("ties"),
  );
  if (samples.length === 0) {
    throw new RTypeMismatchError("NRT3290", "zero non-NA points");
  }
  const method = await approxChoice(
    invocation,
    matched.get("method"),
    ["periodic", "natural", "fmm", "hyman"],
    "fmm",
    "method",
  );
  if (method === "periodic" && samples[0]!.y !== samples[samples.length - 1]!.y) {
    invocation.context.warn({
      code: "NRW1105",
      message: "spline: first and last y values differ - using y[1] for both",
    });
    samples = samples.map((sample, index) =>
      index === samples.length - 1 ? { ...sample, y: samples[0]!.y } : sample,
    );
  }
  if (method === "hyman") {
    const differences = samples.slice(1).map((sample, index) => sample.y - samples[index]!.y);
    if (!differences.every((value) => value >= 0) && !differences.every((value) => value <= 0)) {
      throw new RTypeMismatchError("NRT3290", "'y' must be increasing or decreasing");
    }
  }

  const xout = await splineOutputCoordinates(invocation, matched, samples);
  invocation.context.allocate(xout.length);
  const positions = samples.map((sample) => sample.x);
  const values = samples.map((sample) => sample.y);
  const secondDerivatives =
    method === "natural"
      ? naturalSecondDerivatives(positions, values)
      : method === "periodic"
        ? periodicSecondDerivatives(positions, values)
        : fmmSecondDerivatives(positions, values);
  const tangents =
    method === "hyman"
      ? hymanFilterTangents(
          positions,
          values,
          splineTangentsFromSecondDerivatives(positions, values, secondDerivatives),
        )
      : undefined;
  const naturalTangents =
    method === "natural"
      ? splineTangentsFromSecondDerivatives(positions, values, secondDerivatives)
      : undefined;
  const output = new Float64Array(xout.length);
  const missing = new Uint8Array(xout.length);
  const period = (positions[positions.length - 1] ?? 0) - (positions[0] ?? 0);
  for (let index = 0; index < xout.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(xout, index)) {
      missing[index] = 1;
      continue;
    }
    let point = xout.values[index] ?? Number.NaN;
    if (Number.isNaN(point)) {
      output[index] = Number.NaN;
      continue;
    }
    if (method === "periodic" && period > 0) {
      point = (positions[0] ?? 0) + ((((point - (positions[0] ?? 0)) % period) + period) % period);
    }
    if (naturalTangents !== undefined && point < positions[0]!) {
      output[index] = values[0]! + (point - positions[0]!) * naturalTangents[0]!;
    } else if (naturalTangents !== undefined && point > positions[positions.length - 1]!) {
      const last = positions.length - 1;
      output[index] = values[last]! + (point - positions[last]!) * naturalTangents[last]!;
    } else {
      output[index] =
        tangents === undefined
          ? evaluateCubicSpline(point, positions, values, secondDerivatives)
          : evaluateCubicHermite(point, positions, values, tangents);
    }
  }
  return listValue(
    [xout, doubleVector(output, missing.some((entry) => entry === 1) ? missing : undefined)],
    ["x", "y"],
  );
}

async function builtinSplineFunction(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, SPLINEFUN_PARAMETERS);
  const coordinates = await approxCoordinates(invocation, matched);
  const tieMethod = await approxTies(invocation, matched.get("ties"));
  let samples = await regularizeSamples(
    invocation,
    coordinates,
    true,
    tieMethod,
    matched.has("ties"),
  );
  if (samples.length === 0) {
    throw new RTypeMismatchError("NRT3290", "zero non-NA points");
  }
  const method = await approxChoice(
    invocation,
    matched.get("method"),
    ["fmm", "periodic", "natural", "monoH.FC", "hyman"],
    "fmm",
    "method",
  );
  if (method === "periodic" && samples[0]!.y !== samples[samples.length - 1]!.y) {
    invocation.context.warn({
      code: "NRW1105",
      message: "splinefun: first and last y values differ - using y[1] for both",
    });
    samples = samples.map((sample, index) =>
      index === samples.length - 1 ? { ...sample, y: samples[0]!.y } : sample,
    );
  }
  if (method === "hyman") {
    const differences = samples.slice(1).map((sample, index) => sample.y - samples[index]!.y);
    if (!differences.every((value) => value >= 0) && !differences.every((value) => value <= 0)) {
      throw new RTypeMismatchError("NRT3290", "'y' must be increasing or decreasing");
    }
  }
  const positions = samples.map((sample) => sample.x);
  const values = samples.map((sample) => sample.y);
  const secondDerivatives =
    method === "natural"
      ? naturalSecondDerivatives(positions, values)
      : method === "periodic"
        ? periodicSecondDerivatives(positions, values)
        : fmmSecondDerivatives(positions, values);
  const baseTangents = splineTangentsFromSecondDerivatives(positions, values, secondDerivatives);
  const tangents =
    method === "hyman"
      ? hymanFilterTangents(positions, values, baseTangents)
      : method === "monoH.FC"
        ? fritschCarlsonTangents(positions, values)
        : baseTangents;
  const period = (positions[positions.length - 1] ?? 0) - (positions[0] ?? 0);
  const interpolator: RBuiltin = {
    type: "builtin",
    definition: {
      package: "stats",
      name: "splinefun",
      kind: "regular",
      formals: [
        { name: "x", span: SPAN },
        {
          name: "deriv",
          defaultValue: { kind: "IntegerLiteral", value: 0, span: SPAN },
          span: SPAN,
        },
      ],
      metadata: {
        compatibilityLevel: "numeric",
        supportedArguments: ["x", "deriv"],
      },
      implementation: async (call) => {
        const { matched: callArguments } = matchBuiltinArguments(call, ["x", "deriv"]);
        const xArgument = callArguments.get("x");
        if (xArgument === undefined || xArgument.promise.missing) {
          throw new REvaluationError("NRE2143", 'argument "x" is missing, with no default');
        }
        const points = approxNumericVector(await call.force(xArgument.promise), "x");
        const derivativeArgument = callArguments.get("deriv");
        const derivativeValue =
          derivativeArgument === undefined
            ? 0
            : approxScalarValue(await call.force(derivativeArgument.promise), "deriv").y;
        const derivative = Math.trunc(derivativeValue);
        if (
          !Number.isFinite(derivativeValue) ||
          derivative !== derivativeValue ||
          derivative < 0 ||
          derivative > 3
        ) {
          throw new RTypeMismatchError("NRT3290", "deriv must be between 0 and 3");
        }
        call.context.allocate(points.length);
        const output = new Float64Array(points.length);
        const missing = new Uint8Array(points.length);
        for (let index = 0; index < points.length; index += 1) {
          call.context.checkpoint();
          if (isMissing(points, index)) {
            missing[index] = 1;
            continue;
          }
          let point = points.values[index] ?? Number.NaN;
          if (Number.isNaN(point)) {
            output[index] = Number.NaN;
            continue;
          }
          if (method === "periodic" && period > 0) {
            point =
              (positions[0] ?? 0) + ((((point - (positions[0] ?? 0)) % period) + period) % period);
          }
          if (method === "natural" && point < positions[0]!) {
            output[index] =
              derivative === 0
                ? values[0]! + (point - positions[0]!) * tangents[0]!
                : derivative === 1
                  ? tangents[0]!
                  : 0;
          } else if (method === "natural" && point > positions[positions.length - 1]!) {
            const last = positions.length - 1;
            output[index] =
              derivative === 0
                ? values[last]! + (point - positions[last]!) * tangents[last]!
                : derivative === 1
                  ? tangents[last]!
                  : 0;
          } else {
            output[index] = evaluateCubicHermiteDerivative(
              point,
              positions,
              values,
              tangents,
              derivative as 0 | 1 | 2 | 3,
            );
          }
        }
        return doubleVector(output, missing.some((entry) => entry === 1) ? missing : undefined);
      },
    },
  };
  invocation.context.allocate(1);
  return interpolator;
}

async function splineOutputCoordinates(
  invocation: BuiltinInvocation,
  matched: ReadonlyMap<string, BuiltinCallArgument>,
  samples: readonly Sample[],
): Promise<RDoubleVector> {
  const supplied = matched.get("xout");
  if (supplied !== undefined && !supplied.promise.missing) {
    const input = approxNumericVector(await invocation.force(supplied.promise), "xout");
    if (input.length === 0) {
      throw new RTypeMismatchError("NRT3290", "'spline' requires n >= 1");
    }
    const values = new Float64Array(input.length);
    const missing = new Uint8Array(input.length);
    for (let index = 0; index < input.length; index += 1) {
      values[index] = input.values[index] ?? Number.NaN;
      if (isMissing(input, index)) missing[index] = 1;
    }
    return doubleVector(values, missing.some((entry) => entry === 1) ? missing : undefined);
  }
  const countArgument = matched.get("n");
  const count =
    countArgument === undefined
      ? 3 * samples.length
      : Math.trunc(approxScalarValue(await invocation.force(countArgument.promise), "n").y);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RTypeMismatchError("NRT3290", "'spline' requires n >= 1");
  }
  const minimum = await splineBoundary(invocation, matched.get("xmin"), samples[0]!.x, "from");
  const maximum = await splineBoundary(
    invocation,
    matched.get("xmax"),
    samples[samples.length - 1]!.x,
    "to",
  );
  invocation.context.allocate(count);
  const values = new Float64Array(count);
  if (count === 1) values[0] = minimum;
  else {
    for (let index = 0; index < count; index += 1) {
      values[index] = minimum + ((maximum - minimum) * index) / (count - 1);
    }
  }
  return doubleVector(values);
}

async function splineBoundary(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  label: "from" | "to",
): Promise<number> {
  if (argument === undefined) return fallback;
  const scalar = approxScalarValue(await invocation.force(argument.promise), label);
  if (scalar.status !== "value" || !Number.isFinite(scalar.y)) {
    throw new RTypeMismatchError("NRT3290", `'${label}' must be a finite number`);
  }
  return scalar.y;
}

async function approxCoordinates(
  invocation: BuiltinInvocation,
  matched: ReadonlyMap<string, BuiltinCallArgument>,
): Promise<CoordinatePair> {
  const xArgument = matched.get("x");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2143", "Argument 'x' is missing in approx().");
  }
  const xInput = await invocation.force(xArgument.promise);
  const yArgument = matched.get("y");
  if (yArgument !== undefined && !yArgument.promise.missing) {
    const yInput = await invocation.force(yArgument.promise);
    if (yInput.type === "null") {
      const y = approxNumericVector(xInput, "x");
      return { x: integerVector(Array.from({ length: y.length }, (_, index) => index + 1)), y };
    }
    const x = approxNumericVector(xInput, "x");
    const y = approxNumericVector(yInput, "y");
    assertCoordinateLengths(x, y);
    return { x, y };
  }
  if (xInput.type === "list") {
    const names = vectorNames(xInput);
    const xIndex = names?.indexOf("x") ?? -1;
    const yIndex = names?.indexOf("y") ?? -1;
    if (xIndex >= 0 && yIndex >= 0) {
      const x = approxNumericVector(xInput.values[xIndex]!, "x");
      const y = approxNumericVector(xInput.values[yIndex]!, "y");
      assertCoordinateLengths(x, y);
      return { x, y };
    }
  }
  if (
    (xInput.type === "logical" || xInput.type === "integer" || xInput.type === "double") &&
    vectorDimensions(xInput)?.length === 2
  ) {
    const dimensions = vectorDimensions(xInput)!;
    if (dimensions[1] === 2) {
      const rows = dimensions[0] ?? 0;
      const x = numericSlice(xInput, 0, rows);
      const y = numericSlice(xInput, rows, rows);
      return { x, y };
    }
  }
  const y = approxNumericVector(xInput, "x");
  return { x: integerVector(Array.from({ length: y.length }, (_, index) => index + 1)), y };
}

function approxNumericVector(value: RValue, name: string): NumericVector {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    isFactor(value)
  ) {
    throw new RTypeMismatchError("NRT3290", `approx() '${name}' must be numeric.`);
  }
  return value;
}

function numericSlice(input: NumericVector, start: number, length: number): NumericVector {
  const values = Array.from({ length }, (_, index) => input.values[start + index] ?? 0);
  const missing = Array.from({ length }, (_, index) => (isMissing(input, start + index) ? 1 : 0));
  return doubleVector(values, missing.some((entry) => entry === 1) ? missing : undefined);
}

function assertCoordinateLengths(x: NumericVector, y: NumericVector): void {
  if (x.length !== y.length || x.length === 0) {
    throw new RTypeMismatchError(
      "NRT3290",
      "approx() requires non-empty 'x' and 'y' of equal length.",
    );
  }
}

type TieMethod =
  | { readonly kind: "mean" | "min" | "max" | "ordered" }
  | { readonly kind: "callable"; readonly value: RValue };

async function approxTies(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<TieMethod> {
  if (argument === undefined) return { kind: "mean" };
  const value = await invocation.force(argument.promise);
  if (value.type === "character" && value.length === 1 && !isMissing(value, 0)) {
    const choice = value.values[0] ?? "";
    if (choice === "ordered" || choice === "mean" || choice === "min" || choice === "max") {
      return { kind: choice };
    }
  }
  if (value.type === "builtin" || value.type === "closure") return { kind: "callable", value };
  throw new RUnsupportedFeatureError(
    "NRU6142",
    "approx() supports ties='ordered', mean/min/max, or a callable reducer.",
  );
}

async function regularizeSamples(
  invocation: BuiltinInvocation,
  coordinates: CoordinatePair,
  removeMissing: boolean,
  ties: TieMethod,
  tiesExplicit: boolean,
): Promise<Sample[]> {
  const samples: Sample[] = [];
  for (let index = 0; index < coordinates.x.length; index += 1) {
    invocation.context.checkpoint();
    const x = coordinates.x.values[index] ?? Number.NaN;
    const xMissing = isMissing(coordinates.x, index) || Number.isNaN(x);
    const y = coordinates.y.values[index] ?? Number.NaN;
    const status: SampleStatus = isMissing(coordinates.y, index)
      ? "missing"
      : Number.isNaN(y)
        ? "nan"
        : "value";
    if (xMissing) {
      if (removeMissing) continue;
      throw new RTypeMismatchError(
        "NRT3290",
        "approx(x,y, .., na.rm=FALSE): NA values in x are not allowed",
      );
    }
    if (status !== "value" && removeMissing) continue;
    samples.push({ x, y, status });
  }
  samples.sort((left, right) => left.x - right.x);
  const output: Sample[] = [];
  let index = 0;
  let collapsed = false;
  while (index < samples.length) {
    let end = index + 1;
    while (end < samples.length && samples[end]!.x === samples[index]!.x) end += 1;
    const group = samples.slice(index, end);
    collapsed ||= group.length > 1;
    output.push(await collapseTies(invocation, group, ties));
    index = end;
  }
  if (collapsed && !tiesExplicit) {
    invocation.context.warn({
      code: "NRW1104",
      message: "collapsing to unique 'x' values",
    });
  }
  return output;
}

async function collapseTies(
  invocation: BuiltinInvocation,
  group: readonly Sample[],
  ties: TieMethod,
): Promise<Sample> {
  const first = group[0]!;
  if (group.length === 1) return first;
  if (ties.kind === "ordered") return group[group.length - 1]!;
  if (ties.kind === "callable") {
    const values = new Float64Array(group.length);
    const missing = new Uint8Array(group.length);
    for (const [index, sample] of group.entries()) {
      values[index] = sample.y;
      if (sample.status === "missing") missing[index] = 1;
      else if (sample.status === "nan") values[index] = Number.NaN;
    }
    const reduced = await invocation.invoke(ties.value, [
      {
        value: doubleVector(values, missing.some((entry) => entry === 1) ? missing : undefined),
      },
    ]);
    const scalar = approxScalarValue(reduced, "ties");
    return { x: first.x, ...scalar };
  }
  if (group.some((sample) => sample.status === "missing")) {
    return { x: first.x, y: 0, status: "missing" };
  }
  if (group.some((sample) => sample.status === "nan")) {
    return { x: first.x, y: Number.NaN, status: "nan" };
  }
  const values = group.map((sample) => sample.y);
  const y =
    ties.kind === "min"
      ? Math.min(...values)
      : ties.kind === "max"
        ? Math.max(...values)
        : values.reduce((sum, value) => sum + value, 0) / values.length;
  return { x: first.x, y, status: "value" };
}

async function approxOutputCoordinates(
  invocation: BuiltinInvocation,
  xoutArgument: BuiltinCallArgument | undefined,
  nArgument: BuiltinCallArgument | undefined,
  samples: readonly Sample[],
): Promise<NumericVector> {
  if (xoutArgument !== undefined && !xoutArgument.promise.missing) {
    return approxNumericVector(await invocation.force(xoutArgument.promise), "xout");
  }
  const count = await approxCount(invocation, nArgument);
  invocation.context.allocate(count);
  const minimum = samples[0]!.x;
  const maximum = samples[samples.length - 1]!.x;
  if (count === 1) return doubleVector([minimum]);
  const values = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    values[index] = minimum + ((maximum - minimum) * index) / (count - 1);
  }
  return doubleVector(values);
}

async function approxCount(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number> {
  if (argument === undefined) return 50;
  const value = approxScalarValue(await invocation.force(argument.promise), "n");
  const count = Math.trunc(value.y);
  if (value.status !== "value" || !Number.isSafeInteger(count) || count < 1) {
    throw new RTypeMismatchError("NRT3290", "approx() 'n' must be a positive integer.");
  }
  return count;
}

async function approxRules(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<readonly [1 | 2, 1 | 2]> {
  if (argument === undefined) return [1, 1];
  const value = approxNumericVector(await invocation.force(argument.promise), "rule");
  if (value.length < 1 || value.length > 2) {
    throw new RTypeMismatchError("NRT3290", "approx() 'rule' must have length one or two.");
  }
  const left = approxRuleAt(value, 0);
  return [left, value.length === 1 ? left : approxRuleAt(value, 1)];
}

function approxRuleAt(value: NumericVector, index: number): 1 | 2 {
  const rule = value.values[index] ?? 0;
  if (isMissing(value, index) || (rule !== 1 && rule !== 2)) {
    throw new RTypeMismatchError("NRT3290", "approx() 'rule' must contain 1 or 2.");
  }
  return rule;
}

async function approxBoundary(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<Omit<Sample, "x"> | undefined> {
  if (argument === undefined) return undefined;
  const scalar = approxScalarValue(await invocation.force(argument.promise), "boundary");
  return { y: scalar.y, status: scalar.status };
}

async function approxFraction(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number> {
  if (argument === undefined) return 0;
  const scalar = approxScalarValue(await invocation.force(argument.promise), "f");
  if (scalar.status !== "value" || !Number.isFinite(scalar.y) || scalar.y < 0 || scalar.y > 1) {
    throw new RTypeMismatchError("NRT3290", "approx() 'f' must be between zero and one.");
  }
  return scalar.y;
}

async function approxChoice<T extends string>(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  choices: readonly T[],
  fallback: T,
  name: string,
): Promise<T> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length < 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3290", `approx() '${name}' must be character.`);
  }
  const requested = value.values[0] ?? "";
  const matches = choices.filter((choice) => choice.startsWith(requested));
  if (matches.length !== 1) {
    throw new RTypeMismatchError("NRT3290", `approx() '${name}' is not a unique choice.`);
  }
  return matches[0]!;
}

async function approxFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3290", `approx() '${name}' must be one logical value.`);
  }
  return value.values[0] === 1;
}

function approxScalarValue(
  value: RValue,
  name: string,
): { readonly y: number; readonly status: SampleStatus } {
  const numeric = approxNumericVector(value, name);
  if (numeric.length !== 1) {
    throw new RTypeMismatchError("NRT3290", `approx() '${name}' must be one numeric value.`);
  }
  const y = numeric.values[0] ?? Number.NaN;
  return {
    y,
    status: isMissing(numeric, 0) ? "missing" : Number.isNaN(y) ? "nan" : "value",
  };
}

function boundaryFromRule(sample: Sample, rule: 1 | 2): Omit<Sample, "x"> {
  return rule === 2 ? { y: sample.y, status: sample.status } : { y: 0, status: "missing" };
}

function interpolateAt(
  coordinate: number,
  samples: readonly Sample[],
  method: "linear" | "constant",
  fraction: number,
  left: Omit<Sample, "x">,
  right: Omit<Sample, "x">,
): Omit<Sample, "x"> {
  if (coordinate < samples[0]!.x) return left;
  if (coordinate > samples[samples.length - 1]!.x) return right;
  let low = 0;
  let high = samples.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const sample = samples[middle]!;
    if (coordinate === sample.x) return { y: sample.y, status: sample.status };
    if (coordinate < sample.x) high = middle - 1;
    else low = middle + 1;
  }
  const before = samples[Math.max(0, high)]!;
  const after = samples[Math.min(samples.length - 1, low)]!;
  if (before.status === "missing" || after.status === "missing") {
    return { y: 0, status: "missing" };
  }
  if (before.status === "nan" || after.status === "nan") {
    return { y: Number.NaN, status: "nan" };
  }
  const ratio = (coordinate - before.x) / (after.x - before.x);
  if (method === "constant") {
    return {
      y: (1 - fraction) * before.y + fraction * after.y,
      status: "value",
    };
  }
  return { y: before.y + ratio * (after.y - before.y), status: "value" };
}
