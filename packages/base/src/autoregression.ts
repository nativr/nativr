import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  characterVector,
  doubleVector,
  integerVector,
  isMissing,
  listValue,
  logicalVector,
  lookupBinding,
  vectorDimensions,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RDoubleVector,
  RList,
  RValue,
} from "@nativr/runtime";

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

export interface AutoregressionBuiltinSpec {
  readonly name: "ar" | "arima.sim" | "arima0";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly formals: NonNullable<BuiltinDefinition["formals"]>;
}

const METHOD_NAMES = ["yule-walker", "burg", "ols", "mle", "yw"] as const;

export const AUTOREGRESSION_BUILTIN_SPECS: readonly AutoregressionBuiltinSpec[] = [
  {
    name: "ar",
    parameters: ["x", "aic", "order.max", "method", "na.action", "series", "..."],
    compatibility: "numeric",
    implementation: builtinAutoregression,
    formals: [
      { name: "x", span: SPAN },
      {
        name: "aic",
        defaultValue: { kind: "LogicalLiteral", value: true, span: SPAN },
        span: SPAN,
      },
      { name: "order.max", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      {
        name: "method",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "c", span: SPAN },
          arguments: METHOD_NAMES.map((value) => ({
            value: { kind: "StringLiteral" as const, value, span: SPAN },
            span: SPAN,
          })),
          span: SPAN,
        },
        span: SPAN,
      },
      {
        name: "na.action",
        defaultValue: { kind: "Identifier", name: "na.fail", span: SPAN },
        span: SPAN,
      },
      {
        name: "series",
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
      { name: "...", span: SPAN },
    ],
  },
  {
    name: "arima.sim",
    parameters: ["model", "n", "rand.gen", "innov", "n.start", "start.innov", "..."],
    compatibility: "numeric",
    implementation: builtinArimaSimulation,
    formals: [
      { name: "model", span: SPAN },
      { name: "n", span: SPAN },
      {
        name: "rand.gen",
        defaultValue: { kind: "Identifier", name: "rnorm", span: SPAN },
        span: SPAN,
      },
      {
        name: "innov",
        defaultValue: callWithEllipsis("rand.gen", "n"),
        span: SPAN,
      },
      {
        name: "n.start",
        defaultValue: { kind: "Identifier", name: "NA", span: SPAN },
        span: SPAN,
      },
      {
        name: "start.innov",
        defaultValue: callWithEllipsis("rand.gen", "n.start"),
        span: SPAN,
      },
      { name: "...", span: SPAN },
    ],
  },
  {
    name: "arima0",
    parameters: [
      "x",
      "order",
      "seasonal",
      "xreg",
      "include.mean",
      "delta",
      "transform.pars",
      "fixed",
      "init",
      "method",
      "n.cond",
      "optim.control",
    ],
    compatibility: "numeric",
    implementation: builtinArimaZero,
    formals: [
      { name: "x", span: SPAN },
      { name: "order", defaultValue: integerCall([0, 0, 0]), span: SPAN },
      { name: "seasonal", defaultValue: seasonalDefaultAst(), span: SPAN },
      { name: "xreg", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      {
        name: "include.mean",
        defaultValue: { kind: "LogicalLiteral", value: true, span: SPAN },
        span: SPAN,
      },
      {
        name: "delta",
        defaultValue: { kind: "DoubleLiteral", value: 0.01, span: SPAN },
        span: SPAN,
      },
      {
        name: "transform.pars",
        defaultValue: { kind: "LogicalLiteral", value: true, span: SPAN },
        span: SPAN,
      },
      { name: "fixed", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      { name: "init", defaultValue: { kind: "NullLiteral", span: SPAN }, span: SPAN },
      {
        name: "method",
        defaultValue: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "c", span: SPAN },
          arguments: ["ML", "CSS"].map((value) => ({
            value: { kind: "StringLiteral" as const, value, span: SPAN },
            span: SPAN,
          })),
          span: SPAN,
        },
        span: SPAN,
      },
      { name: "n.cond", span: SPAN },
      {
        name: "optim.control",
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

function integerCall(values: readonly number[]) {
  return {
    kind: "CallExpression" as const,
    callee: { kind: "Identifier" as const, name: "c", span: SPAN },
    arguments: values.map((value) => ({
      value: { kind: "IntegerLiteral" as const, value, span: SPAN },
      span: SPAN,
    })),
    span: SPAN,
  };
}

function seasonalDefaultAst() {
  return {
    kind: "CallExpression" as const,
    callee: { kind: "Identifier" as const, name: "list", span: SPAN },
    arguments: [
      { name: "order", value: integerCall([0, 0, 0]), span: SPAN },
      {
        name: "period",
        value: { kind: "Identifier" as const, name: "NA", span: SPAN },
        span: SPAN,
      },
    ],
    span: SPAN,
  };
}

function callWithEllipsis(callee: string, count: string) {
  return {
    kind: "CallExpression" as const,
    callee: { kind: "Identifier" as const, name: callee, span: SPAN },
    arguments: [
      { value: { kind: "Identifier" as const, name: count, span: SPAN }, span: SPAN },
      { value: { kind: "Identifier" as const, name: "...", span: SPAN }, span: SPAN },
    ],
    span: SPAN,
  };
}

async function builtinAutoregression(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchBuiltinArguments(invocation, [
    "x",
    "aic",
    "order.max",
    "method",
    "na.action",
    "series",
    "...",
  ]);
  if (dots.length > 0) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "Additional ar() method controls are not implemented for the Yule-Walker profile.",
    );
  }
  const input = await requiredValue(invocation, matched.get("x"), "x");
  if (
    (input.type !== "logical" && input.type !== "integer" && input.type !== "double") ||
    (vectorDimensions(input)?.length ?? 1) > 1
  ) {
    throw new RTypeMismatchError("NRT3265", "ar() currently requires a univariate numeric series.");
  }
  if (input.length < 2) {
    throw new RTypeMismatchError("NRT3265", "'order.max' must be < 'n.used'");
  }
  const values = new Float64Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(input, index) || !Number.isFinite(Number(input.values[index]))) {
      throw new REvaluationError("NRE2255", "missing values in object");
    }
    values[index] = Number(input.values[index]);
  }

  const method = await characterScalar(invocation, matched.get("method"), "yule-walker", "method");
  const normalizedMethod = method === "yw" ? "yule-walker" : method;
  if (normalizedMethod !== "yule-walker") {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      `ar(method = '${method}') is outside the current Yule-Walker compatibility profile.`,
    );
  }
  const useAic = await logicalScalar(invocation, matched.get("aic"), true, "aic");
  const defaultOrder = Math.min(values.length - 1, Math.floor(10 * Math.log10(values.length)));
  const orderMaximum = await nonnegativeIntegerScalar(
    invocation,
    matched.get("order.max"),
    defaultOrder,
    "order.max",
  );
  if (orderMaximum >= values.length) {
    throw new RTypeMismatchError("NRT3265", "'order.max' must be < 'n.used'");
  }
  const series = await characterScalar(invocation, matched.get("series"), "x", "series");

  let mean = 0;
  for (const value of values) mean += value;
  mean /= values.length;
  const centered = Float64Array.from(values, (value) => value - mean);
  const covariance = new Float64Array(orderMaximum + 1);
  for (let lag = 0; lag <= orderMaximum; lag += 1) {
    let total = 0;
    for (let index = lag; index < centered.length; index += 1) {
      total += centered[index]! * centered[index - lag]!;
    }
    covariance[lag] = total / centered.length;
  }
  if (!(covariance[0]! > 0)) {
    throw new REvaluationError("NRE2255", "zero-variance series");
  }

  const coefficientsByOrder: Float64Array[] = [new Float64Array(0)];
  const partial = new Float64Array(orderMaximum);
  const predictionVariances = new Float64Array(orderMaximum + 1);
  const aic = new Float64Array(orderMaximum + 1);
  predictionVariances[0] = covariance[0]!;
  for (let order = 1; order <= orderMaximum; order += 1) {
    const previous = coefficientsByOrder[order - 1]!;
    let numerator = covariance[order]!;
    for (let index = 1; index < order; index += 1) {
      numerator -= previous[index - 1]! * covariance[order - index]!;
    }
    const reflection = numerator / predictionVariances[order - 1]!;
    partial[order - 1] = reflection;
    const current = new Float64Array(order);
    for (let index = 1; index < order; index += 1) {
      current[index - 1] = previous[index - 1]! - reflection * previous[order - index - 1]!;
    }
    current[order - 1] = reflection;
    coefficientsByOrder.push(current);
    predictionVariances[order] = predictionVariances[order - 1]! * (1 - reflection * reflection);
    aic[order] =
      values.length * Math.log(predictionVariances[order]! / predictionVariances[0]) + 2 * order;
  }

  let selectedOrder = orderMaximum;
  if (useAic) {
    selectedOrder = 0;
    for (let order = 1; order <= orderMaximum; order += 1) {
      if (aic[order]! < aic[selectedOrder]!) selectedOrder = order;
    }
  }
  const coefficients = coefficientsByOrder[selectedOrder]!;
  const residualValues = new Float64Array(values.length);
  const residualMissing = new Uint8Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    if (index < selectedOrder) {
      residualMissing[index] = 1;
      continue;
    }
    let prediction = 0;
    for (let lag = 1; lag <= selectedOrder; lag += 1) {
      prediction += coefficients[lag - 1]! * centered[index - lag]!;
    }
    residualValues[index] = centered[index]! - prediction;
  }

  let residuals: RDoubleVector = doubleVector(residualValues, compactMask(residualMissing));
  const tsp = input.attributes.get("tsp");
  if (tsp !== undefined) {
    residuals = withAttribute(residuals, "tsp", tsp);
    residuals = withAttribute(residuals, "class", characterVector(["ts"]));
  }

  const selectedPredictionVariance =
    (predictionVariances[selectedOrder]! * values.length) / (values.length - selectedOrder - 1);

  const partialValue = withDimensions(doubleVector(partial), [orderMaximum, 1, 1]);
  const fields: RValue[] = [
    useAic ? integerVector([selectedOrder]) : doubleVector([selectedOrder]),
    doubleVector(coefficients),
    doubleVector([selectedPredictionVariance]),
    doubleVector([mean]),
    withNames(
      doubleVector(aic),
      Array.from({ length: aic.length }, (_, index) => String(index)),
    ),
    integerVector([values.length]),
    integerVector([values.length]),
    doubleVector([orderMaximum]),
    partialValue,
    residuals,
    characterVector(["Yule-Walker"]),
    characterVector([series]),
    doubleVector([seriesFrequency(input)]),
    invocation.currentCall(),
  ];
  const names = [
    "order",
    "ar",
    "var.pred",
    "x.mean",
    "aic",
    "n.used",
    "n.obs",
    "order.max",
    "partialacf",
    "resid",
    "method",
    "series",
    "frequency",
    "call",
  ];
  if (selectedOrder > 0) {
    fields.push(
      asymptoticCoefficientVariance(
        covariance,
        selectedOrder,
        values.length,
        selectedPredictionVariance,
      ),
    );
    names.push("asy.var.coef");
  }
  return withClasses(listValue(fields, names), ["ar"]);
}

interface ArimaOrder {
  readonly ar: number;
  readonly diff: number;
  readonly ma: number;
}

interface ArimaProfile {
  readonly objective: number;
  readonly sigma2: number;
  readonly logLikelihood: number;
  readonly residuals: Float64Array;
}

async function builtinArimaZero(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, [
    "x",
    "order",
    "seasonal",
    "xreg",
    "include.mean",
    "delta",
    "transform.pars",
    "fixed",
    "init",
    "method",
    "n.cond",
    "optim.control",
  ]);
  const input = await requiredValue(invocation, matched.get("x"), "x");
  if (
    (input.type !== "logical" && input.type !== "integer" && input.type !== "double") ||
    (vectorDimensions(input)?.length ?? 1) > 1
  ) {
    throw new RTypeMismatchError("NRT3266", "arima0() requires one univariate numeric series.");
  }
  const source = finiteNumericValues(input, "x", invocation);
  const order = await arimaOrderArgument(invocation, matched.get("order"), "order");
  const seasonal = await arimaSeasonalArgument(
    invocation,
    matched.get("seasonal"),
    seriesFrequency(input),
  );
  const period = seasonal.period;
  if ((seasonal.order.ar > 0 || seasonal.order.diff > 0 || seasonal.order.ma > 0) && period < 1) {
    throw new RTypeMismatchError("NRT3266", "invalid seasonal period");
  }
  await requireNullArgument(invocation, matched.get("xreg"), "xreg");
  await requireNullArgument(invocation, matched.get("fixed"), "fixed");
  const includeMean = await logicalScalar(
    invocation,
    matched.get("include.mean"),
    true,
    "include.mean",
  );
  await logicalScalar(invocation, matched.get("transform.pars"), true, "transform.pars");
  const delta = await positiveNumericScalar(invocation, matched.get("delta"), 0.01, "delta");
  const method = await characterScalar(invocation, matched.get("method"), "ML", "method");
  if (method !== "ML" && method !== "CSS") {
    throw new RTypeMismatchError("NRT3266", `'arg' should be one of "ML", "CSS"`);
  }
  const optimControl = matched.get("optim.control");
  if (optimControl !== undefined && !optimControl.promise.missing) {
    const value = await invocation.force(optimControl.promise);
    if (value.type !== "list" || value.length !== 0) {
      throw new RUnsupportedFeatureError(
        "NRU6132",
        "Non-empty arima0(optim.control=) is outside the current browser fitting profile.",
      );
    }
  }

  const differencingLoss = order.diff + seasonal.order.diff * period;
  let values: Float64Array = Float64Array.from(source);
  for (let index = 0; index < order.diff; index += 1) values = differenceValues(values, 1);
  for (let index = 0; index < seasonal.order.diff; index += 1) {
    values = differenceValues(values, period);
  }
  if (values.length < 3) {
    throw new RTypeMismatchError("NRT3266", "not enough non-missing observations");
  }
  const fitMean = includeMean && order.diff === 0 && seasonal.order.diff === 0;
  const parameterNames = arimaParameterNames(order, seasonal.order, fitMean);
  const parameterCount = parameterNames.length;
  const suppliedInitial = await optionalNumericVector(invocation, matched.get("init"), "init");
  if (suppliedInitial !== undefined && suppliedInitial.length !== parameterCount) {
    throw new RTypeMismatchError("NRT3266", "wrong length for 'init'");
  }
  const initial = suppliedInitial ?? new Float64Array(parameterCount);
  if (fitMean && suppliedInitial === undefined) {
    initial[parameterCount - 1] = values.reduce((total, value) => total + value, 0) / values.length;
  }
  const requestedConditioning = await optionalNonnegativeIntegerScalar(
    invocation,
    matched.get("n.cond"),
    differencingLoss,
    "n.cond",
  );
  if (method === "ML" && requestedConditioning !== differencingLoss) {
    throw new RUnsupportedFeatureError(
      "NRU6132",
      "Explicit arima0(n.cond=) is supported only by the CSS fitting profile.",
    );
  }

  const evaluate = (parameters: Float64Array): ArimaProfile =>
    arimaProfileLikelihood(
      values,
      parameters,
      order,
      seasonal.order,
      period,
      fitMean,
      method,
      requestedConditioning,
      invocation,
    );
  const optimized =
    parameterCount === 0
      ? initial
      : nelderMead(initial, (candidate) => evaluate(candidate).objective, invocation);
  const profile = evaluate(optimized);
  const covariance =
    parameterCount === 0
      ? withDimensions(doubleVector([]), [0, 0])
      : namedCovarianceMatrix(
          invertSymmetricHessian(numericHessian(optimized, delta, evaluate, invocation)),
          parameterNames,
        );
  const coefficients = withNames(doubleVector(optimized), parameterNames);
  const mask = withNames(
    logicalVector(Array.from({ length: parameterCount }, () => true)),
    parameterNames,
  );
  const residualStart = seriesStart(input) + differencingLoss / seriesFrequency(input);
  let residuals: RValue = doubleVector(profile.residuals);
  if (input.attributes.get("tsp") !== undefined) {
    residuals = withAttribute(
      residuals,
      "tsp",
      doubleVector([
        residualStart,
        residualStart + (profile.residuals.length - 1) / seriesFrequency(input),
        seriesFrequency(input),
      ]),
    );
    residuals = withClasses(residuals, ["ts"]);
  }
  const arma = withNames(
    doubleVector([
      order.ar,
      order.ma,
      seasonal.order.ar,
      seasonal.order.ma,
      period,
      order.diff,
      seasonal.order.diff,
    ]),
    ["ar", "ma", "sar", "sma", "period", "diff", "sdiff"],
  );
  const aic = -2 * profile.logLikelihood + 2 * (parameterCount + 1);
  return withClasses(
    listValue(
      [
        coefficients,
        doubleVector([profile.sigma2]),
        covariance,
        mask,
        doubleVector([profile.logLikelihood]),
        doubleVector([aic]),
        arma,
        residuals,
        invocation.currentCall(),
        characterVector(["x"]),
        integerVector([0]),
        integerVector([requestedConditioning]),
      ],
      [
        "coef",
        "sigma2",
        "var.coef",
        "mask",
        "loglik",
        "aic",
        "arma",
        "residuals",
        "call",
        "series",
        "code",
        "n.cond",
      ],
    ),
    ["arima0"],
  );
}

function arimaProfileLikelihood(
  values: Float64Array,
  parameters: Float64Array,
  order: ArimaOrder,
  seasonal: ArimaOrder,
  period: number,
  fitMean: boolean,
  method: string,
  conditioning: number,
  invocation: BuiltinInvocation,
): ArimaProfile {
  const parsed = arimaPolynomials(parameters, order, seasonal, period, fitMean);
  if (
    !isStationaryAutoregression(parsed.nonseasonalAr) ||
    !isStationaryAutoregression(parsed.seasonalAr)
  ) {
    return {
      objective: 1e100,
      sigma2: Number.POSITIVE_INFINITY,
      logLikelihood: Number.NEGATIVE_INFINITY,
      residuals: new Float64Array(values.length),
    };
  }
  const centered = Float64Array.from(values, (value) => value - parsed.mean);
  const residuals = conditionalArmaResiduals(centered, parsed.ar, parsed.ma, invocation);
  if (method === "CSS") {
    const start = Math.min(Math.max(0, conditioning), residuals.length - 1);
    let sumSquares = 0;
    for (let index = start; index < residuals.length; index += 1) {
      sumSquares += residuals[index]! * residuals[index]!;
    }
    const count = residuals.length - start;
    const sigma2 = sumSquares / count;
    const logLikelihood = -0.5 * count * (Math.log(2 * Math.PI * sigma2) + 1);
    return { objective: -logLikelihood, sigma2, logLikelihood, residuals };
  }
  const psi = armaImpulseWeights(parsed.ar, parsed.ma, values.length + 512, invocation);
  const covariance = armaCorrelationMatrix(psi, values.length, invocation);
  const factor = choleskyFactor(covariance);
  if (factor === undefined) {
    return {
      objective: 1e100,
      sigma2: Number.POSITIVE_INFINITY,
      logLikelihood: Number.NEGATIVE_INFINITY,
      residuals,
    };
  }
  const whitened = solveLower(factor, centered);
  let quadratic = 0;
  let logDeterminant = 0;
  for (let index = 0; index < whitened.length; index += 1) {
    quadratic += whitened[index]! * whitened[index]!;
    logDeterminant += 2 * Math.log(factor[index]![index]!);
  }
  const sigma2 = quadratic / values.length;
  const logLikelihood =
    -0.5 * (values.length * (Math.log(2 * Math.PI) + 1 + Math.log(sigma2)) + logDeterminant);
  return { objective: -logLikelihood, sigma2, logLikelihood, residuals };
}

function arimaPolynomials(
  parameters: Float64Array,
  order: ArimaOrder,
  seasonal: ArimaOrder,
  period: number,
  fitMean: boolean,
) {
  let offset = 0;
  const nonseasonalAr = parameters.slice(offset, (offset += order.ar));
  const nonseasonalMa = parameters.slice(offset, (offset += order.ma));
  const seasonalAr = parameters.slice(offset, (offset += seasonal.ar));
  const seasonalMa = parameters.slice(offset, (offset += seasonal.ma));
  const ar = multipliedLagPolynomial(nonseasonalAr, seasonalAr, period, -1);
  const ma = multipliedLagPolynomial(nonseasonalMa, seasonalMa, period, 1);
  return {
    nonseasonalAr,
    seasonalAr,
    ar: Float64Array.from(ar.slice(1), (value) => -value),
    ma: Float64Array.from(ma.slice(1)),
    mean: fitMean ? (parameters[offset] ?? 0) : 0,
  };
}

function multipliedLagPolynomial(
  ordinary: Float64Array,
  seasonal: Float64Array,
  period: number,
  sign: -1 | 1,
): Float64Array {
  const left = new Float64Array(ordinary.length + 1);
  left[0] = 1;
  for (let index = 0; index < ordinary.length; index += 1)
    left[index + 1] = sign * ordinary[index]!;
  const right = new Float64Array(seasonal.length * period + 1);
  right[0] = 1;
  for (let index = 0; index < seasonal.length; index += 1) {
    right[(index + 1) * period] = sign * seasonal[index]!;
  }
  const result = new Float64Array(left.length + right.length - 1);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const resultIndex = leftIndex + rightIndex;
      result[resultIndex] = (result[resultIndex] ?? 0) + left[leftIndex]! * right[rightIndex]!;
    }
  }
  return result;
}

function conditionalArmaResiduals(
  values: Float64Array,
  ar: Float64Array,
  ma: Float64Array,
  invocation: BuiltinInvocation,
): Float64Array {
  const residuals = new Float64Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    invocation.context.checkpoint();
    let fitted = 0;
    for (let lag = 1; lag <= ar.length && lag <= index; lag += 1) {
      fitted += ar[lag - 1]! * values[index - lag]!;
    }
    for (let lag = 1; lag <= ma.length && lag <= index; lag += 1) {
      fitted += ma[lag - 1]! * residuals[index - lag]!;
    }
    residuals[index] = values[index]! - fitted;
  }
  return residuals;
}

function armaImpulseWeights(
  ar: Float64Array,
  ma: Float64Array,
  length: number,
  invocation: BuiltinInvocation,
): Float64Array {
  const psi = new Float64Array(length);
  psi[0] = 1;
  for (let index = 1; index < length; index += 1) {
    invocation.context.checkpoint();
    let value = index <= ma.length ? ma[index - 1]! : 0;
    for (let lag = 1; lag <= ar.length && lag <= index; lag += 1)
      value += ar[lag - 1]! * psi[index - lag]!;
    psi[index] = value;
  }
  return psi;
}

function armaCorrelationMatrix(
  psi: Float64Array,
  size: number,
  invocation: BuiltinInvocation,
): number[][] {
  const covariance = new Float64Array(size);
  for (let lag = 0; lag < size; lag += 1) {
    let value = 0;
    for (let index = 0; index + lag < psi.length; index += 1)
      value += psi[index]! * psi[index + lag]!;
    covariance[lag] = value;
  }
  return Array.from({ length: size }, (_, row) => {
    invocation.context.checkpoint();
    return Array.from({ length: size }, (_, column) => covariance[Math.abs(row - column)]!);
  });
}

function choleskyFactor(matrix: readonly (readonly number[])[]): number[][] | undefined {
  const size = matrix.length;
  const factor = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let value = matrix[row]![column]!;
      for (let index = 0; index < column; index += 1)
        value -= factor[row]![index]! * factor[column]![index]!;
      if (row === column) {
        if (!(value > 1e-12) || !Number.isFinite(value)) return undefined;
        factor[row]![column] = Math.sqrt(value);
      } else {
        factor[row]![column] = value / factor[column]![column]!;
      }
    }
  }
  return factor;
}

function solveLower(factor: readonly (readonly number[])[], values: Float64Array): Float64Array {
  const output = new Float64Array(values.length);
  for (let row = 0; row < values.length; row += 1) {
    let value = values[row]!;
    for (let column = 0; column < row; column += 1)
      value -= factor[row]![column]! * output[column]!;
    output[row] = value / factor[row]![row]!;
  }
  return output;
}

function nelderMead(
  initial: Float64Array,
  objective: (parameters: Float64Array) => number,
  invocation: BuiltinInvocation,
): Float64Array {
  const dimension = initial.length;
  const simplex = [Float64Array.from(initial)];
  for (let index = 0; index < dimension; index += 1) {
    const point = Float64Array.from(initial);
    point[index] =
      (point[index] ?? 0) + (Math.abs(point[index]!) > 1e-8 ? 0.1 * Math.abs(point[index]!) : 0.1);
    simplex.push(point);
  }
  let scores = simplex.map(objective);
  for (let iteration = 0; iteration < 600; iteration += 1) {
    invocation.context.checkpoint();
    const order = simplex
      .map((_, index) => index)
      .sort((left, right) => scores[left]! - scores[right]!);
    const sorted = order.map((index) => simplex[index]!);
    scores = order.map((index) => scores[index]!);
    simplex.splice(0, simplex.length, ...sorted);
    const spread = Math.max(...scores.map((score) => Math.abs(score - scores[0]!)));
    if (spread <= 1e-10 * Math.max(1, Math.abs(scores[0]!))) break;
    const centroid = new Float64Array(dimension);
    for (let point = 0; point < dimension; point += 1) {
      for (let axis = 0; axis < dimension; axis += 1)
        centroid[axis] = (centroid[axis] ?? 0) + simplex[point]![axis]! / dimension;
    }
    const trial = (scale: number) =>
      Float64Array.from(
        centroid,
        (value, axis) => value + scale * (value - simplex[dimension]![axis]!),
      );
    const reflected = trial(1);
    const reflectedScore = objective(reflected);
    if (reflectedScore < scores[0]!) {
      const expanded = trial(2);
      const expandedScore = objective(expanded);
      simplex[dimension] = expandedScore < reflectedScore ? expanded : reflected;
      scores[dimension] = Math.min(expandedScore, reflectedScore);
      continue;
    }
    if (reflectedScore < scores[dimension - 1]!) {
      simplex[dimension] = reflected;
      scores[dimension] = reflectedScore;
      continue;
    }
    const contracted = trial(0.5);
    const contractedScore = objective(contracted);
    if (contractedScore < scores[dimension]!) {
      simplex[dimension] = contracted;
      scores[dimension] = contractedScore;
      continue;
    }
    for (let point = 1; point <= dimension; point += 1) {
      simplex[point] = Float64Array.from(
        simplex[0]!,
        (value, axis) => value + 0.5 * (simplex[point]![axis]! - value),
      );
      scores[point] = objective(simplex[point]!);
    }
  }
  const best = scores.indexOf(Math.min(...scores));
  return Float64Array.from(simplex[best]!);
}

function numericHessian(
  parameters: Float64Array,
  delta: number,
  evaluate: (parameters: Float64Array) => ArimaProfile,
  invocation: BuiltinInvocation,
): number[][] {
  const size = parameters.length;
  const output = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  const center = evaluate(parameters).objective;
  for (let row = 0; row < size; row += 1) {
    invocation.context.checkpoint();
    const rowStep = delta * Math.max(1, Math.abs(parameters[row]!));
    const plus = Float64Array.from(parameters);
    const minus = Float64Array.from(parameters);
    plus[row] = (plus[row] ?? 0) + rowStep;
    minus[row] = (minus[row] ?? 0) - rowStep;
    output[row]![row] =
      (evaluate(plus).objective - 2 * center + evaluate(minus).objective) / (rowStep * rowStep);
    for (let column = 0; column < row; column += 1) {
      const columnStep = delta * Math.max(1, Math.abs(parameters[column]!));
      const pp = Float64Array.from(parameters);
      const pm = Float64Array.from(parameters);
      const mp = Float64Array.from(parameters);
      const mm = Float64Array.from(parameters);
      pp[row] = (pp[row] ?? 0) + rowStep;
      pp[column] = (pp[column] ?? 0) + columnStep;
      pm[row] = (pm[row] ?? 0) + rowStep;
      pm[column] = (pm[column] ?? 0) - columnStep;
      mp[row] = (mp[row] ?? 0) - rowStep;
      mp[column] = (mp[column] ?? 0) + columnStep;
      mm[row] = (mm[row] ?? 0) - rowStep;
      mm[column] = (mm[column] ?? 0) - columnStep;
      const value =
        (evaluate(pp).objective -
          evaluate(pm).objective -
          evaluate(mp).objective +
          evaluate(mm).objective) /
        (4 * rowStep * columnStep);
      output[row]![column] = value;
      output[column]![row] = value;
    }
  }
  return output;
}

function invertSymmetricHessian(matrix: readonly (readonly number[])[]): number[][] {
  try {
    return invertMatrix(matrix);
  } catch {
    throw new REvaluationError("NRE2256", "arima0() Hessian is singular");
  }
}

function namedCovarianceMatrix(
  values: readonly (readonly number[])[],
  names: readonly string[],
): RValue {
  const flattened = new Float64Array(names.length * names.length);
  for (let column = 0; column < names.length; column += 1) {
    for (let row = 0; row < names.length; row += 1)
      flattened[column * names.length + row] = values[row]![column]!;
  }
  let output: RValue = withDimensions(doubleVector(flattened), [names.length, names.length]);
  output = withAttribute(
    output,
    "dimnames",
    listValue([characterVector(names), characterVector(names)]),
  );
  return output;
}

function differenceValues(values: Float64Array, lag: number): Float64Array {
  if (lag < 1 || lag >= values.length) return new Float64Array(0);
  return Float64Array.from(
    { length: values.length - lag },
    (_, index) => values[index + lag]! - values[index]!,
  );
}

function arimaParameterNames(order: ArimaOrder, seasonal: ArimaOrder, mean: boolean): string[] {
  return [
    ...Array.from({ length: order.ar }, (_, index) => `ar${index + 1}`),
    ...Array.from({ length: order.ma }, (_, index) => `ma${index + 1}`),
    ...Array.from({ length: seasonal.ar }, (_, index) => `sar${index + 1}`),
    ...Array.from({ length: seasonal.ma }, (_, index) => `sma${index + 1}`),
    ...(mean ? ["intercept"] : []),
  ];
}

async function arimaOrderArgument(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<ArimaOrder> {
  if (argument === undefined || argument.promise.missing) return { ar: 0, diff: 0, ma: 0 };
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "integer" && value.type !== "double" && value.type !== "logical") ||
    value.length !== 3
  ) {
    throw new RTypeMismatchError(
      "NRT3266",
      `'${name}' must be a non-negative integer vector of length 3`,
    );
  }
  const parsed = Array.from({ length: 3 }, (_, index) => {
    if (isMissing(value, index)) return -1;
    const item = Number(value.values[index]);
    return Number.isInteger(item) && item >= 0 ? item : -1;
  });
  if (parsed.some((item) => item < 0)) {
    throw new RTypeMismatchError(
      "NRT3266",
      `'${name}' must be a non-negative integer vector of length 3`,
    );
  }
  return { ar: parsed[0]!, diff: parsed[1]!, ma: parsed[2]! };
}

async function arimaSeasonalArgument(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallbackPeriod: number,
): Promise<{ readonly order: ArimaOrder; readonly period: number }> {
  if (argument === undefined || argument.promise.missing) {
    return { order: { ar: 0, diff: 0, ma: 0 }, period: Math.max(1, Math.trunc(fallbackPeriod)) };
  }
  const value = await invocation.force(argument.promise);
  if (value.type !== "list") throw new RTypeMismatchError("NRT3266", "'seasonal' must be a list");
  const names = value.attributes.get("names");
  const orderIndex = names?.type === "character" ? names.values.indexOf("order") : -1;
  const periodIndex = names?.type === "character" ? names.values.indexOf("period") : -1;
  const orderValue = orderIndex >= 0 ? value.values[orderIndex] : undefined;
  const order = arimaOrderValue(orderValue, "seasonal$order");
  let period = Math.max(1, Math.trunc(fallbackPeriod));
  const periodValue = periodIndex >= 0 ? value.values[periodIndex] : undefined;
  if (periodValue !== undefined && periodValue.type !== "null") {
    if (
      (periodValue.type !== "logical" &&
        periodValue.type !== "integer" &&
        periodValue.type !== "double") ||
      periodValue.length !== 1
    )
      throw new RTypeMismatchError("NRT3266", "invalid seasonal period");
    if (!isMissing(periodValue, 0)) period = Math.trunc(Number(periodValue.values[0]));
  }
  return { order, period };
}

function arimaOrderValue(value: RValue | undefined, name: string): ArimaOrder {
  if (value === undefined || value.type === "null") return { ar: 0, diff: 0, ma: 0 };
  if (
    (value.type !== "integer" && value.type !== "double" && value.type !== "logical") ||
    value.length !== 3
  ) {
    throw new RTypeMismatchError("NRT3266", `'${name}' must have length 3`);
  }
  const parsed = Array.from({ length: 3 }, (_, index) =>
    isMissing(value, index) ? -1 : Math.trunc(Number(value.values[index])),
  );
  if (parsed.some((item) => !Number.isFinite(item) || item < 0)) {
    throw new RTypeMismatchError("NRT3266", `'${name}' must contain non-negative integers`);
  }
  return { ar: parsed[0]!, diff: parsed[1]!, ma: parsed[2]! };
}

function finiteNumericValues(
  value: Extract<RValue, { readonly type: "logical" | "integer" | "double" }>,
  name: string,
  invocation: BuiltinInvocation,
): Float64Array {
  const output = new Float64Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    invocation.context.checkpoint();
    const item = Number(value.values[index]);
    if (isMissing(value, index) || !Number.isFinite(item)) {
      throw new REvaluationError("NRE2256", `missing values in '${name}'`);
    }
    output[index] = item;
  }
  return output;
}

async function requireNullArgument(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<void> {
  if (argument === undefined || argument.promise.missing) return;
  const value = await invocation.force(argument.promise);
  if (value.type !== "null") {
    throw new RUnsupportedFeatureError(
      "NRU6132",
      `arima0(${name}=) is outside the current browser fitting profile.`,
    );
  }
}

async function optionalNumericVector(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<Float64Array | undefined> {
  if (argument === undefined || argument.promise.missing) return undefined;
  const value = await invocation.force(argument.promise);
  if (value.type === "null") return undefined;
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3266", `'${name}' must be numeric`);
  }
  return finiteNumericValues(value, name, invocation);
}

async function positiveNumericScalar(
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
    !(Number(value.values[0]) > 0)
  )
    throw new RTypeMismatchError("NRT3266", `'${name}' must be positive`);
  return Number(value.values[0]);
}

function seriesStart(value: { readonly attributes: ReadonlyMap<string, RValue> }): number {
  const tsp = value.attributes.get("tsp");
  if (tsp?.type === "double" && tsp.length >= 1) return tsp.values[0] ?? 1;
  return 1;
}

async function builtinArimaSimulation(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchBuiltinArguments(invocation, [
    "model",
    "n",
    "rand.gen",
    "innov",
    "n.start",
    "start.innov",
    "...",
  ]);
  const model = await requiredValue(invocation, matched.get("model"), "model");
  if (model.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "'model' must be a list");
  }
  const count = await nonnegativeIntegerScalar(invocation, matched.get("n"), -1, "n");
  if (count < 1) throw new RTypeMismatchError("NRT3265", "'n' must be a strictly positive integer");
  const autoregressive = modelNumericField(model, "ar");
  const movingAverage = modelNumericField(model, "ma");
  if (!isStationaryAutoregression(autoregressive)) {
    throw new REvaluationError("NRE2255", "'ar' part of model is not stationary");
  }
  const declaredOrder = modelNumericField(model, "order");
  const differencing = declaredOrder.length >= 2 ? Math.trunc(declaredOrder[1] ?? 0) : 0;
  if (differencing < 0) throw new RTypeMismatchError("NRT3265", "invalid 'model' order");
  if (differencing !== 0) {
    throw new RUnsupportedFeatureError(
      "NRU6131",
      "arima.sim() integrated models are outside the current stationary ARMA profile.",
    );
  }
  const minimumStart = autoregressive.length + movingAverage.length;
  const defaultStart = minimumStart + (autoregressive.length > 0 ? 100 : 0);
  const startCount = await optionalNonnegativeIntegerScalar(
    invocation,
    matched.get("n.start"),
    defaultStart,
    "n.start",
  );
  if (startCount < minimumStart) {
    throw new RTypeMismatchError("NRT3265", "burn-in 'n.start' must be as long as 'ar + ma'");
  }
  const generator = await randomGenerator(invocation, matched.get("rand.gen"));
  const forwarded: { readonly name?: string; readonly value: RValue }[] = [];
  for (const argument of dots) {
    forwarded.push({
      ...(argument.name === undefined ? {} : { name: argument.name }),
      value: await invocation.force(argument.promise),
    });
  }
  const innovations = await simulationInnovations(
    invocation,
    matched.get("innov"),
    generator,
    count,
    forwarded,
    "innov",
  );
  const startInnovations = await simulationInnovations(
    invocation,
    matched.get("start.innov"),
    generator,
    startCount,
    forwarded,
    "start.innov",
  );
  const total = startCount + count;
  const allInnovations = new Float64Array(total);
  allInnovations.set(startInnovations, 0);
  allInnovations.set(innovations, startCount);
  const simulated = new Float64Array(total);
  for (let index = 0; index < total; index += 1) {
    invocation.context.checkpoint();
    let value = allInnovations[index]!;
    for (let lag = 1; lag <= autoregressive.length; lag += 1) {
      if (index >= lag) value += autoregressive[lag - 1]! * simulated[index - lag]!;
    }
    for (let lag = 1; lag <= movingAverage.length; lag += 1) {
      if (index >= lag) value += movingAverage[lag - 1]! * allInnovations[index - lag]!;
    }
    simulated[index] = value;
  }
  const output = simulated.slice(startCount);
  let result = withAttribute(doubleVector(output), "tsp", doubleVector([1, count, 1]));
  result = withAttribute(result, "class", characterVector(["ts"]));
  return result;
}

function modelNumericField(model: RList, name: string): Float64Array {
  const names = model.attributes.get("names");
  if (names?.type !== "character") return new Float64Array(0);
  const index = names.values.indexOf(name);
  if (index < 0) return new Float64Array(0);
  const value = model.values[index];
  if (value === undefined || value.type === "null") return new Float64Array(0);
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3265", `model component '${name}' must be numeric`);
  }
  const output = new Float64Array(value.length);
  for (let item = 0; item < value.length; item += 1) {
    if (isMissing(value, item) || !Number.isFinite(Number(value.values[item]))) {
      throw new RTypeMismatchError("NRT3265", `model component '${name}' must be finite`);
    }
    output[item] = Number(value.values[item]);
  }
  return output;
}

function isStationaryAutoregression(coefficients: Float64Array): boolean {
  let current = Float64Array.from(coefficients);
  for (let order = current.length; order > 0; order -= 1) {
    const reflection = current[order - 1]!;
    if (Math.abs(reflection) >= 1) return false;
    if (order === 1) return true;
    const denominator = 1 - reflection * reflection;
    const previous = new Float64Array(order - 1);
    for (let index = 0; index < order - 1; index += 1) {
      previous[index] = (current[index]! + reflection * current[order - index - 2]!) / denominator;
    }
    current = previous;
  }
  return true;
}

async function randomGenerator(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RValue> {
  if (argument !== undefined && !argument.promise.missing)
    return invocation.force(argument.promise);
  const binding = lookupBinding(invocation.currentEnvironment(), "rnorm");
  if (binding === undefined)
    throw new REvaluationError("NRE2255", "could not find function 'rnorm'");
  return invocation.force(binding);
}

async function simulationInnovations(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  generator: RValue,
  count: number,
  forwarded: readonly { readonly name?: string; readonly value: RValue }[],
  name: string,
): Promise<Float64Array> {
  const value =
    argument === undefined || argument.promise.missing
      ? await invocation.invoke(generator, [{ value: integerVector([count]) }, ...forwarded])
      : await invocation.force(argument.promise);
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3265", `'${name}' must be numeric`);
  }
  if (value.length < count) {
    throw new RTypeMismatchError("NRT3265", `'${name}' is too short`);
  }
  const output = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    if (isMissing(value, index) || !Number.isFinite(Number(value.values[index]))) {
      throw new RTypeMismatchError("NRT3265", `'${name}' must contain finite values`);
    }
    output[index] = Number(value.values[index]);
  }
  return output;
}

async function optionalNonnegativeIntegerScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1
  ) {
    throw new RTypeMismatchError("NRT3265", `'${name}' must be a non-negative integer`);
  }
  if (isMissing(value, 0)) return fallback;
  const parsed = Math.trunc(Number(value.values[0]));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RTypeMismatchError("NRT3265", `'${name}' must be a non-negative integer`);
  }
  return parsed;
}

async function requiredValue(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in ar().`);
  }
  return invocation.force(argument.promise);
}

async function logicalScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3265", `'${name}' must be one logical value`);
  }
  return Number(value.values[0]) !== 0;
}

async function characterScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: string,
  name: string,
): Promise<string> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length < 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3265", `'${name}' must be character`);
  }
  return value.values[0] ?? fallback;
}

async function nonnegativeIntegerScalar(
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
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3265", `'${name}' must be a non-negative integer`);
  }
  const parsed = Math.trunc(Number(value.values[0]));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RTypeMismatchError("NRT3265", `'${name}' must be a non-negative integer`);
  }
  return parsed;
}

function seriesFrequency(value: { readonly attributes: ReadonlyMap<string, RValue> }): number {
  const tsp = value.attributes.get("tsp");
  if (tsp?.type === "double" && tsp.length >= 3) return tsp.values[2] ?? 1;
  return 1;
}

function compactMask(mask: Uint8Array): Uint8Array | undefined {
  for (const value of mask) if (value !== 0) return mask;
  return undefined;
}

function asymptoticCoefficientVariance(
  covariance: Float64Array,
  order: number,
  observations: number,
  predictionVariance: number,
): RValue {
  const correlation = Array.from({ length: order }, (_, row) =>
    Array.from(
      { length: order },
      (_, column) => covariance[Math.abs(row - column)]! / covariance[0]!,
    ),
  );
  const inverse = invertMatrix(correlation);
  const values = new Float64Array(order * order);
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row < order; row += 1) {
      values[column * order + row] =
        (inverse[row]![column]! * predictionVariance) / covariance[0]! / observations;
    }
  }
  return withDimensions(doubleVector(values), [order, order]);
}

function invertMatrix(matrix: readonly (readonly number[])[]): number[][] {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    ...Array.from({ length: size }, (_, column) => (index === column ? 1 : 0)),
  ]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    let pivotRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![pivot]!) > Math.abs(augmented[pivotRow]![pivot]!))
        pivotRow = row;
    }
    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow]!, augmented[pivot]!];
    const divisor = augmented[pivot]![pivot]!;
    if (Math.abs(divisor) <= Number.EPSILON) {
      throw new REvaluationError("NRE2255", "singular autocorrelation matrix");
    }
    for (let column = 0; column < size * 2; column += 1) augmented[pivot]![column]! /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row]![pivot]!;
      for (let column = 0; column < size * 2; column += 1) {
        augmented[row]![column]! -= factor * augmented[pivot]![column]!;
      }
    }
  }
  return augmented.map((row) => row.slice(size));
}
