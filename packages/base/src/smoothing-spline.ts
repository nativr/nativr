import {
  REvaluationError,
  RTypeMismatchError,
  R_NULL,
  doubleVector,
  integerVector,
  isMissing,
  isVector,
  listValue,
  logicalVector,
  vectorDimensions,
  vectorNames,
  withClasses,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RList,
  RValue,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";
import {
  evaluateCubicSpline,
  naturalSecondDerivatives,
  splineTangentsFromSecondDerivatives,
} from "./cubic-spline.js";

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

const SMOOTH_SPLINE_PARAMETERS = [
  "x",
  "y",
  "w",
  "df",
  "spar",
  "lambda",
  "cv",
  "all.knots",
  "nknots",
  "keep.data",
  "df.offset",
  "penalty",
  "control.spar",
  "tol",
  "keep.stuff",
] as const;

const PREDICT_SMOOTH_SPLINE_PARAMETERS = ["object", "x", "deriv"] as const;

export interface SmoothingSplineBuiltinSpec {
  readonly name: "smooth.spline" | "predict.smooth.spline";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly formals: NonNullable<BuiltinDefinition["formals"]>;
}

export const SMOOTHING_SPLINE_BUILTIN_SPECS: readonly SmoothingSplineBuiltinSpec[] = [
  {
    name: "smooth.spline",
    parameters: SMOOTH_SPLINE_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinSmoothSpline,
    formals: [
      { name: "x", span: SPAN },
      { name: "y", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      { name: "w", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      { name: "df", span: SPAN },
      { name: "spar", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      { name: "lambda", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      {
        name: "cv",
        defaultValue: { kind: "LogicalLiteral", value: false, span: SPAN },
        span: SPAN,
      },
      {
        name: "all.knots",
        defaultValue: { kind: "LogicalLiteral", value: false, span: SPAN },
        span: SPAN,
      },
      {
        name: "nknots",
        defaultValue: { kind: "Identifier", name: ".nknots.smspl", span: SPAN },
        span: SPAN,
      },
      {
        name: "keep.data",
        defaultValue: { kind: "LogicalLiteral", value: true, span: SPAN },
        span: SPAN,
      },
      {
        name: "df.offset",
        defaultValue: { kind: "DoubleLiteral", value: 0, span: SPAN },
        span: SPAN,
      },
      {
        name: "penalty",
        defaultValue: { kind: "DoubleLiteral", value: 1, span: SPAN },
        span: SPAN,
      },
      {
        name: "control.spar",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "list", span: SPAN },
          arguments: [],
          span: SPAN,
        },
        span: SPAN,
      },
      {
        name: "tol",
        defaultValue: {
          kind: "BinaryExpression",
          operator: "*",
          left: { kind: "DoubleLiteral", value: 1e-6, span: SPAN },
          right: {
            kind: "CallExpression",
            callee: { kind: "Identifier", name: "IQR", span: SPAN },
            arguments: [{ value: { kind: "Identifier", name: "x", span: SPAN }, span: SPAN }],
            span: SPAN,
          },
          span: SPAN,
        },
        span: SPAN,
      },
      {
        name: "keep.stuff",
        defaultValue: { kind: "LogicalLiteral", value: false, span: SPAN },
        span: SPAN,
      },
    ],
  },
  {
    name: "predict.smooth.spline",
    parameters: PREDICT_SMOOTH_SPLINE_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinPredictSmoothSpline,
    formals: [
      { name: "object", span: SPAN },
      { name: "x", span: SPAN },
      { name: "deriv", defaultValue: { kind: "IntegerLiteral", value: 0, span: SPAN }, span: SPAN },
    ],
  },
];

interface SplineSamples {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly w: Float64Array;
  readonly weighted: boolean;
}

interface SplineFit {
  readonly y: Float64Array;
  readonly leverage: Float64Array;
  readonly df: number;
  readonly rss: number;
  readonly cv: number;
}

type NumericArray = readonly number[] | Float64Array;

async function builtinSmoothSpline(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, SMOOTH_SPLINE_PARAMETERS);
  const samples = await smoothingSamples(invocation, matched);
  if (samples.x.length < 4) {
    throw new RTypeMismatchError("NRT3420", "need at least four unique 'x' values");
  }
  const allKnots = await optionalLogical(invocation, matched.get("all.knots"), false, "all.knots");
  const requestedKnots = await optionalScalar(invocation, matched.get("nknots"), "nknots");
  const knotCount = smoothingKnotCount(samples.x.length, allKnots, requestedKnots);
  if (knotCount > 256) {
    throw new RTypeMismatchError(
      "NRT3420",
      "smooth.spline() currently admits at most 256 spline knots per browser call.",
    );
  }
  const fittingSamples = selectSmoothingKnots(samples, knotCount);
  const normalized = normalizeCoordinates(fittingSamples.x);
  const penalty = naturalSplinePenalty(normalized);
  const requestedDf = await optionalScalar(invocation, matched.get("df"), "df");
  const requestedSpar = await optionalScalar(invocation, matched.get("spar"), "spar");
  const requestedLambda = await optionalScalar(invocation, matched.get("lambda"), "lambda");
  if (
    [requestedDf, requestedSpar, requestedLambda].filter((value) => value !== undefined).length > 1
  ) {
    throw new REvaluationError(
      "NRE2290",
      "must not specify more than one of 'df', 'spar', or 'lambda'",
    );
  }
  const leaveOneOut = await optionalLogical(invocation, matched.get("cv"), false, "cv");
  const ratio = smoothingRatio(fittingSamples.w, penalty);
  let lambda: number;
  if (requestedLambda !== undefined) {
    if (!(requestedLambda >= 0) || !Number.isFinite(requestedLambda)) {
      throw new RTypeMismatchError("NRT3420", "'lambda' must be finite and non-negative");
    }
    lambda = requestedLambda;
  } else if (requestedDf !== undefined) {
    const target = requestedDf;
    if (!(target >= 2 && target <= fittingSamples.x.length)) {
      throw new RTypeMismatchError(
        "NRT3420",
        "'df' must be between 2 and the number of unique x values",
      );
    }
    lambda = lambdaForDegreesOfFreedom(fittingSamples, penalty, target, invocation);
  } else if (requestedSpar !== undefined) {
    if (!Number.isFinite(requestedSpar)) {
      throw new RTypeMismatchError("NRT3420", "'spar' must be finite");
    }
    lambda = ratio * 256 ** (3 * requestedSpar - 1);
  } else {
    lambda = optimizeSmoothingParameter(fittingSamples, penalty, leaveOneOut, invocation);
  }
  const reducedFit = fitAtLambda(fittingSamples, penalty, lambda, leaveOneOut, invocation);
  const fit = expandSplineFit(samples, fittingSamples, reducedFit);
  const spar = requestedSpar ?? (Math.log(lambda / ratio) / Math.log(256) + 1) / 3;
  const tol = await optionalScalar(invocation, matched.get("tol"), "tol");
  const tolerance = tol ?? 1e-6 * interquartileRange(samples.x);
  const keepData = await optionalLogical(invocation, matched.get("keep.data"), true, "keep.data");
  const data = keepData
    ? listValue(
        [doubleVector(samples.x), doubleVector(samples.y), doubleVector(samples.w)],
        ["x", "y", "w"],
      )
    : R_NULL;
  const values: RValue[] = [
    doubleVector(samples.x),
    doubleVector(fit.y),
    doubleVector(samples.w),
    doubleVector(samples.y),
    doubleVector([tolerance]),
    data,
    logicalVector([!samples.weighted]),
    integerVector([samples.x.length]),
    doubleVector(fit.leverage),
    logicalVector([leaveOneOut]),
    doubleVector([fit.cv]),
    doubleVector([fit.rss]),
    doubleVector([fit.cv]),
    doubleVector([fit.df]),
    doubleVector([spar]),
    doubleVector([ratio]),
    doubleVector([lambda]),
    integerVector([0, 0, 0]),
    R_NULL,
    listValue([], []),
    invocation.currentCall(),
  ];
  invocation.context.allocate(values.length + samples.x.length * 5);
  return withClasses(
    listValue(values, [
      "x",
      "y",
      "w",
      "yin",
      "tol",
      "data",
      "no.weights",
      "n",
      "lev",
      "cv",
      "cv.crit",
      "pen.crit",
      "crit",
      "df",
      "spar",
      "ratio",
      "lambda",
      "iparms",
      "auxM",
      "fit",
      "call",
    ]),
    ["smooth.spline"],
  );
}

function smoothingKnotCount(
  observationCount: number,
  allKnots: boolean,
  requestedKnots: number | undefined,
): number {
  if (allKnots) return observationCount;
  if (requestedKnots !== undefined) {
    const count = Math.trunc(requestedKnots);
    if (!Number.isFinite(requestedKnots) || count < 4) {
      throw new RTypeMismatchError("NRT3420", "'nknots' must be at least four");
    }
    return Math.min(observationCount, count);
  }
  if (observationCount < 50) return observationCount;
  const anchors = [
    [50, 49],
    [100, 62],
    [200, 99],
    [500, 118],
    [1_000, 144],
    [3_200, 200],
    [12_800, 206],
  ] as const;
  for (let index = 1; index < anchors.length; index += 1) {
    const upper = anchors[index]!;
    if (observationCount > upper[0]) continue;
    const lower = anchors[index - 1]!;
    const fraction =
      (Math.log(observationCount) - Math.log(lower[0])) / (Math.log(upper[0]) - Math.log(lower[0]));
    return Math.round(lower[1] + fraction * (upper[1] - lower[1]));
  }
  return anchors.at(-1)![1];
}

function selectSmoothingKnots(samples: SplineSamples, knotCount: number): SplineSamples {
  if (knotCount >= samples.x.length) return samples;
  const indices = Array.from({ length: knotCount }, (_, index) =>
    Math.round((index * (samples.x.length - 1)) / (knotCount - 1)),
  );
  const weights = Float64Array.from(indices, (index) => samples.w[index] ?? 0);
  const weightScale = weights.length / weights.reduce((sum, value) => sum + value, 0);
  return {
    x: Float64Array.from(indices, (index) => samples.x[index] ?? 0),
    y: Float64Array.from(indices, (index) => samples.y[index] ?? 0),
    w: Float64Array.from(weights, (value) => value * weightScale),
    weighted: samples.weighted,
  };
}

function expandSplineFit(
  samples: SplineSamples,
  fittingSamples: SplineSamples,
  fit: SplineFit,
): SplineFit {
  if (samples.x.length === fittingSamples.x.length) return fit;
  const coordinates = Array.from(fittingSamples.x);
  const fitted = Array.from(fit.y);
  const second = naturalSecondDerivatives(coordinates, fitted);
  const tangents = splineTangentsFromSecondDerivatives(coordinates, fitted, second);
  const y = Float64Array.from(samples.x, (point) =>
    naturalSplineValue(point, coordinates, fitted, second, tangents),
  );
  const leverage = Float64Array.from(samples.x, (point) =>
    linearInterpolate(point, coordinates, fit.leverage),
  );
  return { ...fit, y, leverage };
}

function linearInterpolate(point: number, x: NumericArray, y: NumericArray): number {
  const interval = splineInterval(point, x);
  const left = x[interval] ?? point;
  const right = x[interval + 1] ?? left;
  if (!(right > left)) return y[interval] ?? 0;
  const fraction = Math.min(1, Math.max(0, (point - left) / (right - left)));
  return (y[interval] ?? 0) + fraction * ((y[interval + 1] ?? 0) - (y[interval] ?? 0));
}

async function builtinPredictSmoothSpline(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, PREDICT_SMOOTH_SPLINE_PARAMETERS);
  const object = await requiredValue(invocation, matched.get("object"), "object");
  if (object.type !== "list") {
    throw new RTypeMismatchError("NRT3421", "'object' must inherit from smooth.spline");
  }
  const sourceX = numericListComponent(object, "x");
  const sourceY = numericListComponent(object, "y");
  if (sourceX.length !== sourceY.length || sourceX.length < 2) {
    throw new RTypeMismatchError("NRT3421", "malformed smooth.spline object");
  }
  const query = numericValues(await requiredValue(invocation, matched.get("x"), "x"), "x");
  const derivative = Math.trunc(
    (await optionalScalar(invocation, matched.get("deriv"), "deriv")) ?? 0,
  );
  if (derivative < 0 || derivative > 2) {
    throw new RTypeMismatchError("NRT3421", "'deriv' must be 0, 1, or 2");
  }
  const sourceCoordinates = [...sourceX];
  const sourceValues = [...sourceY];
  const second = naturalSecondDerivatives(sourceCoordinates, sourceValues);
  const tangent = splineTangentsFromSecondDerivatives(sourceCoordinates, sourceValues, second);
  const output = new Float64Array(query.length);
  for (let index = 0; index < query.length; index += 1) {
    invocation.context.checkpoint();
    const point = query[index] ?? Number.NaN;
    if (derivative === 0)
      output[index] = naturalSplineValue(point, sourceCoordinates, sourceValues, second, tangent);
    else if (derivative === 1)
      output[index] = naturalSplineDerivative(
        point,
        sourceCoordinates,
        sourceValues,
        second,
        tangent,
      );
    else output[index] = naturalSplineSecondDerivative(point, sourceCoordinates, second);
  }
  return listValue([doubleVector(query), doubleVector(output)], ["x", "y"]);
}

async function smoothingSamples(
  invocation: BuiltinInvocation,
  matched: ReadonlyMap<string, BuiltinCallArgument>,
): Promise<SplineSamples> {
  const xInput = await requiredValue(invocation, matched.get("x"), "x");
  let x: Float64Array;
  let y: Float64Array;
  const yArgument = matched.get("y");
  if (yArgument === undefined || yArgument.promise.missing) {
    ({ x, y } = implicitSmoothingSamples(xInput));
  } else {
    x = numericValues(xInput, "x");
    const yValue = await invocation.force(yArgument.promise);
    if (yValue.type === "null") {
      ({ x, y } = implicitSmoothingSamples(xInput));
    } else y = numericValues(yValue, "y");
  }
  if (x.length !== y.length || x.length === 0) {
    throw new RTypeMismatchError("NRT3420", "'x' and 'y' must have the same positive length");
  }
  const weightArgument = matched.get("w");
  const weightValue =
    weightArgument === undefined || weightArgument.promise.missing
      ? undefined
      : await invocation.force(weightArgument.promise);
  const weighted = weightValue !== undefined && weightValue.type !== "null";
  const weights = weighted ? numericValues(weightValue, "w") : Float64Array.from(x, () => 1);
  if (weights.length !== x.length) {
    throw new RTypeMismatchError("NRT3420", "'w' must have the same length as 'x'");
  }
  const rows = Array.from(x, (coordinate, index) => ({
    x: coordinate,
    y: y[index] ?? Number.NaN,
    w: weights[index] ?? Number.NaN,
  }));
  if (rows.some((row) => !Number.isFinite(row.x) || !Number.isFinite(row.y) || !(row.w > 0))) {
    throw new RTypeMismatchError(
      "NRT3420",
      "'x', 'y', and 'w' must be finite and weights positive",
    );
  }
  rows.sort((left, right) => left.x - right.x);
  const unique: { x: number; y: number; w: number }[] = [];
  for (const row of rows) {
    const previous = unique[unique.length - 1];
    if (previous !== undefined && previous.x === row.x) {
      previous.y = (previous.y * previous.w + row.y * row.w) / (previous.w + row.w);
      previous.w += row.w;
    } else unique.push({ ...row });
  }
  const totalWeight = unique.reduce((sum, row) => sum + row.w, 0);
  const scale = unique.length / totalWeight;
  return {
    x: Float64Array.from(unique, (row) => row.x),
    y: Float64Array.from(unique, (row) => row.y),
    w: Float64Array.from(unique, (row) => row.w * scale),
    weighted,
  };
}

function implicitSmoothingSamples(value: RValue): {
  readonly x: Float64Array;
  readonly y: Float64Array;
} {
  if (value.type === "list") {
    return {
      x: numericListComponent(value, "x"),
      y: numericListComponent(value, "y"),
    };
  }
  const input = numericValues(value, "x");
  const dimensions = isVector(value) ? vectorDimensions(value) : undefined;
  if (dimensions?.length === 2 && (dimensions[1] ?? 0) >= 2) {
    const rows = dimensions[0] ?? 0;
    return {
      x: input.slice(0, rows),
      y: input.slice(rows, rows * 2),
    };
  }
  return {
    x: Float64Array.from({ length: input.length }, (_, index) => index + 1),
    y: input,
  };
}

function normalizeCoordinates(x: Float64Array): Float64Array {
  const minimum = x[0] ?? 0;
  const range = (x[x.length - 1] ?? minimum) - minimum;
  if (!(range > 0)) throw new RTypeMismatchError("NRT3420", "'x' must contain distinct values");
  return Float64Array.from(x, (value) => (value - minimum) / range);
}

function naturalSplinePenalty(x: Float64Array): Float64Array[] {
  const count = x.length;
  const interior = count - 2;
  const q = Array.from({ length: count }, () => new Float64Array(interior));
  const r = Array.from({ length: interior }, () => new Float64Array(interior));
  for (let column = 0; column < interior; column += 1) {
    const left = (x[column + 1] ?? 0) - (x[column] ?? 0);
    const right = (x[column + 2] ?? 0) - (x[column + 1] ?? 0);
    q[column]![column] = 1 / left;
    q[column + 1]![column] = -(1 / left + 1 / right);
    q[column + 2]![column] = 1 / right;
    r[column]![column] = (left + right) / 3;
    if (column + 1 < interior) {
      r[column]![column + 1] = right / 6;
      r[column + 1]![column] = right / 6;
    }
  }
  const inverseR = invertMatrix(r);
  return Array.from({ length: count }, (_, row) =>
    Float64Array.from({ length: count }, (_, column) => {
      let value = 0;
      for (let first = 0; first < interior; first += 1) {
        for (let second = 0; second < interior; second += 1) {
          value += q[row]![first]! * inverseR[first]![second]! * q[column]![second]!;
        }
      }
      return value;
    }),
  );
}

function fitAtLambda(
  samples: SplineSamples,
  penalty: readonly Float64Array[],
  lambda: number,
  leaveOneOut: boolean,
  invocation: BuiltinInvocation,
): SplineFit {
  const count = samples.x.length;
  const system = Array.from({ length: count }, (_, row) =>
    Float64Array.from({ length: count }, (_, column) =>
      row === column
        ? (samples.w[row] ?? 0) + lambda * (penalty[row]![column] ?? 0)
        : lambda * (penalty[row]![column] ?? 0),
    ),
  );
  const inverse = invertMatrix(system);
  const fitted = new Float64Array(count);
  const leverage = new Float64Array(count);
  let degrees = 0;
  let rss = 0;
  let loo = 0;
  for (let row = 0; row < count; row += 1) {
    invocation.context.checkpoint();
    leverage[row] = (inverse[row]![row] ?? 0) * (samples.w[row] ?? 0);
    degrees += leverage[row] ?? 0;
    let value = 0;
    for (let column = 0; column < count; column += 1) {
      value += (inverse[row]![column] ?? 0) * (samples.w[column] ?? 0) * (samples.y[column] ?? 0);
    }
    fitted[row] = value;
    const residual = (samples.y[row] ?? 0) - value;
    rss += (samples.w[row] ?? 0) * residual * residual;
    const denominator = Math.max(1e-12, 1 - (leverage[row] ?? 0));
    loo += (residual / denominator) ** 2;
  }
  const denominator = Math.max(1e-12, 1 - degrees / count);
  return {
    y: fitted,
    leverage,
    df: degrees,
    rss,
    cv: leaveOneOut ? loo / count : rss / count / (denominator * denominator),
  };
}

function lambdaForDegreesOfFreedom(
  samples: SplineSamples,
  penalty: readonly Float64Array[],
  target: number,
  invocation: BuiltinInvocation,
): number {
  if (target >= samples.x.length - 1e-10) return 0;
  let low = 1e-14;
  let high = 1;
  while (fitAtLambda(samples, penalty, high, false, invocation).df > target && high < 1e20)
    high *= 10;
  for (let iteration = 0; iteration < 56; iteration += 1) {
    const middle = Math.sqrt(low * high);
    if (fitAtLambda(samples, penalty, middle, false, invocation).df > target) low = middle;
    else high = middle;
  }
  return high;
}

function optimizeSmoothingParameter(
  samples: SplineSamples,
  penalty: readonly Float64Array[],
  leaveOneOut: boolean,
  invocation: BuiltinInvocation,
): number {
  let left = -14 * Math.LN10;
  let right = 14 * Math.LN10;
  const golden = (Math.sqrt(5) - 1) / 2;
  let first = right - golden * (right - left);
  let second = left + golden * (right - left);
  let firstScore = fitAtLambda(samples, penalty, Math.exp(first), leaveOneOut, invocation).cv;
  let secondScore = fitAtLambda(samples, penalty, Math.exp(second), leaveOneOut, invocation).cv;
  for (let iteration = 0; iteration < 42; iteration += 1) {
    if (firstScore <= secondScore) {
      right = second;
      second = first;
      secondScore = firstScore;
      first = right - golden * (right - left);
      firstScore = fitAtLambda(samples, penalty, Math.exp(first), leaveOneOut, invocation).cv;
    } else {
      left = first;
      first = second;
      firstScore = secondScore;
      second = left + golden * (right - left);
      secondScore = fitAtLambda(samples, penalty, Math.exp(second), leaveOneOut, invocation).cv;
    }
  }
  return Math.exp((left + right) / 2);
}

function smoothingRatio(weights: Float64Array, penalty: readonly Float64Array[]): number {
  const weightTrace = weights.reduce((sum, value) => sum + value, 0);
  const penaltyTrace = penalty.reduce((sum, row, index) => sum + (row[index] ?? 0), 0);
  return weightTrace / penaltyTrace;
}

function invertMatrix(input: readonly Float64Array[]): Float64Array[] {
  const count = input.length;
  const rows = Array.from({ length: count }, (_, row) => {
    const output = new Float64Array(count * 2);
    output.set(input[row] ?? new Float64Array(count));
    output[count + row] = 1;
    return output;
  });
  for (let pivot = 0; pivot < count; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < count; row += 1) {
      if (Math.abs(rows[row]![pivot] ?? 0) > Math.abs(rows[best]![pivot] ?? 0)) best = row;
    }
    if (Math.abs(rows[best]![pivot] ?? 0) < 1e-14) {
      throw new RTypeMismatchError("NRT3420", "singular smoothing-spline system");
    }
    [rows[pivot], rows[best]] = [rows[best]!, rows[pivot]!];
    const divisor = rows[pivot]![pivot] ?? 1;
    for (let column = 0; column < count * 2; column += 1) {
      rows[pivot]![column] = (rows[pivot]![column] ?? 0) / divisor;
    }
    for (let row = 0; row < count; row += 1) {
      if (row === pivot) continue;
      const factor = rows[row]![pivot] ?? 0;
      if (factor === 0) continue;
      for (let column = 0; column < count * 2; column += 1) {
        rows[row]![column] = (rows[row]![column] ?? 0) - factor * (rows[pivot]![column] ?? 0);
      }
    }
  }
  return rows.map((row) => row.slice(count));
}

async function requiredValue(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing.`);
  }
  return invocation.force(argument.promise);
}

async function optionalScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<number | undefined> {
  if (argument === undefined || argument.promise.missing) return undefined;
  const value = await invocation.force(argument.promise);
  if (value.type === "null") return undefined;
  const values = numericValues(value, name);
  if (values.length !== 1)
    throw new RTypeMismatchError("NRT3420", `'${name}' must have length one`);
  return values[0];
}

async function optionalLogical(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  const value = await optionalScalar(invocation, argument, name);
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) throw new RTypeMismatchError("NRT3420", `'${name}' must not be NA`);
  return value !== 0;
}

function numericValues(value: RValue, name: string): Float64Array {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3420", `'${name}' must be numeric`);
  }
  const output = new Float64Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    if (isMissing(value, index))
      throw new RTypeMismatchError("NRT3420", `'${name}' contains missing values`);
    output[index] = value.values[index] ?? Number.NaN;
  }
  return output;
}

function numericListComponent(value: RList, name: string): Float64Array {
  const names = vectorNames(value);
  const index = names?.indexOf(name) ?? -1;
  if (index < 0)
    throw new RTypeMismatchError("NRT3421", `smooth.spline object has no '${name}' component`);
  return numericValues(value.values[index] ?? R_NULL, name);
}

function interquartileRange(values: Float64Array): number {
  const quantile = (probability: number): number => {
    const index = (values.length - 1) * probability;
    const lower = Math.floor(index);
    const fraction = index - lower;
    return (
      (values[lower] ?? 0) + fraction * ((values[Math.ceil(index)] ?? 0) - (values[lower] ?? 0))
    );
  };
  return quantile(0.75) - quantile(0.25);
}

function naturalSplineValue(
  point: number,
  x: NumericArray,
  y: NumericArray,
  second: NumericArray,
  tangent: NumericArray,
): number {
  if (point < (x[0] ?? 0)) return (y[0] ?? 0) + (point - (x[0] ?? 0)) * (tangent[0] ?? 0);
  const last = x.length - 1;
  if (point > (x[last] ?? 0))
    return (y[last] ?? 0) + (point - (x[last] ?? 0)) * (tangent[last] ?? 0);
  return evaluateCubicSpline(point, Array.from(x), Array.from(y), Float64Array.from(second));
}

function splineInterval(point: number, x: NumericArray): number {
  if (point <= (x[0] ?? 0)) return 0;
  const last = x.length - 1;
  if (point >= (x[last] ?? 0)) return last - 1;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((x[middle] ?? 0) <= point) low = middle;
    else high = middle;
  }
  return low;
}

function naturalSplineDerivative(
  point: number,
  x: NumericArray,
  y: NumericArray,
  second: NumericArray,
  tangent: NumericArray,
): number {
  if (point <= (x[0] ?? 0)) return tangent[0] ?? 0;
  const last = x.length - 1;
  if (point >= (x[last] ?? 0)) return tangent[last] ?? 0;
  const index = splineInterval(point, x);
  const width = (x[index + 1] ?? 0) - (x[index] ?? 0);
  const left = ((x[index + 1] ?? 0) - point) / width;
  const right = (point - (x[index] ?? 0)) / width;
  return (
    ((y[index + 1] ?? 0) - (y[index] ?? 0)) / width +
    (width / 6) *
      ((1 - 3 * left * left) * (second[index] ?? 0) +
        (3 * right * right - 1) * (second[index + 1] ?? 0))
  );
}

function naturalSplineSecondDerivative(
  point: number,
  x: NumericArray,
  second: NumericArray,
): number {
  if (point <= (x[0] ?? 0) || point >= (x[x.length - 1] ?? 0)) return 0;
  const index = splineInterval(point, x);
  const width = (x[index + 1] ?? 0) - (x[index] ?? 0);
  const left = ((x[index + 1] ?? 0) - point) / width;
  const right = 1 - left;
  return left * (second[index] ?? 0) + right * (second[index + 1] ?? 0);
}
