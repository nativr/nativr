import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  R_NULL,
  characterVector,
  createForcedPromise,
  doubleVector,
  isMissing,
  listValue,
  logicalVector,
  lookupBinding,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RList,
  RValue,
  RVector,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";
import {
  BOX_OPTIMIZATION_BACKEND_STATE_KEY,
  type BoxOptimizationBackend,
} from "./box-optimization.js";
import { symmetricEigenDecomposition } from "./eigen.js";
import { regularizedGammaProbability } from "./student-t.js";

export interface FactorAnalysisBuiltinSpec {
  readonly name: "factanal" | "loadings" | "varimax";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly formals: NonNullable<BuiltinDefinition["formals"]>;
}

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});
const missingFormal = (name: string) => ({ name, span: SPAN });
const nullFormal = (name: string) => ({
  name,
  defaultValue: { kind: "NullLiteral" as const, span: SPAN },
  span: SPAN,
});
const stringFormal = (name: string, value: string) => ({
  name,
  defaultValue: { kind: "StringLiteral" as const, value, span: SPAN },
  span: SPAN,
});

const PARAMETERS = [
  "x",
  "factors",
  "data",
  "covmat",
  "n.obs",
  "subset",
  "na.action",
  "start",
  "scores",
  "rotation",
  "control",
  "...",
] as const;

export const FACTOR_ANALYSIS_BUILTIN_SPECS: readonly FactorAnalysisBuiltinSpec[] = [
  {
    name: "factanal",
    parameters: PARAMETERS,
    compatibility: "numeric",
    implementation: builtinFactanal,
    formals: [
      missingFormal("x"),
      missingFormal("factors"),
      nullFormal("data"),
      nullFormal("covmat"),
      {
        name: "n.obs",
        defaultValue: { kind: "Identifier" as const, name: "NA", span: SPAN },
        span: SPAN,
      },
      missingFormal("subset"),
      missingFormal("na.action"),
      nullFormal("start"),
      stringFormal("scores", "none"),
      stringFormal("rotation", "varimax"),
      nullFormal("control"),
      missingFormal("..."),
    ],
  },
  {
    name: "loadings",
    parameters: ["x", "..."],
    compatibility: "numeric",
    implementation: builtinLoadings,
    formals: [missingFormal("x"), missingFormal("...")],
  },
  {
    name: "varimax",
    parameters: ["x", "normalize", "eps"],
    compatibility: "numeric",
    implementation: builtinVarimax,
    formals: [
      missingFormal("x"),
      {
        name: "normalize",
        defaultValue: { kind: "LogicalLiteral" as const, value: true, span: SPAN },
        span: SPAN,
      },
      {
        name: "eps",
        defaultValue: { kind: "DoubleLiteral" as const, value: 1e-5, span: SPAN },
        span: SPAN,
      },
    ],
  },
];

interface NumericMatrix {
  readonly values: Float64Array;
  readonly rows: number;
  readonly columns: number;
  readonly rowNames: readonly string[] | undefined;
  readonly columnNames: readonly string[] | undefined;
}

interface FitResult {
  readonly uniquenesses: Float64Array;
  readonly objective: number;
  readonly loadings: Float64Array;
  readonly functionCount: number;
  readonly gradientCount: number;
  readonly converged: boolean;
}

async function builtinFactanal(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, PARAMETERS);
  rejectSupplied(matched.get("data"), "factanal(data=) formula evaluation is not implemented yet.");
  rejectSupplied(matched.get("subset"), "factanal(subset=) is not implemented yet.");
  rejectSupplied(matched.get("na.action"), "factanal(na.action=) is not implemented yet.");

  const factors = integerScalar(
    await forceRequired(invocation, matched.get("factors"), "factors"),
    "factors",
  );
  const scores = await optionalCharacter(invocation, matched.get("scores"), "none", "scores");
  if (scores !== "none") {
    throw new RUnsupportedFeatureError(
      "NRU6240",
      "factanal() factor scores are not implemented yet.",
    );
  }
  const rotation = await rotationTarget(invocation, matched.get("rotation"));

  const covarianceArgument = await forceOptional(invocation, matched.get("covmat"));
  let correlation: NumericMatrix;
  let observations: number | undefined;
  if (covarianceArgument !== undefined && covarianceArgument.type !== "null") {
    const covarianceValue =
      covarianceArgument.type === "list"
        ? namedListElement(covarianceArgument, "cov")
        : covarianceArgument;
    if (covarianceValue === undefined) {
      throw new RTypeMismatchError("NRT3450", "covmat does not contain a covariance matrix");
    }
    const covariance = numericMatrix(covarianceValue, "covmat", invocation);
    if (covariance.rows !== covariance.columns) {
      throw new RTypeMismatchError("NRT3450", "covmat is not a square matrix");
    }
    correlation = covarianceToCorrelation(covariance, invocation);
    if (covarianceArgument.type === "list") {
      const listObservations = namedListElement(covarianceArgument, "n.obs");
      if (listObservations !== undefined) {
        const candidate = numericScalar(listObservations, "covmat$n.obs", true);
        if (Number.isFinite(candidate)) observations = candidate;
      }
    }
  } else {
    const x = await forceRequired(invocation, matched.get("x"), "x");
    const data = numericMatrix(x, "x", invocation);
    correlation = dataCorrelation(data, invocation);
    observations = data.rows;
  }

  const order = correlation.rows;
  if (factors < 1 || factors >= order) {
    throw new REvaluationError("NRE2270", "invalid number of factors");
  }
  const degreesOfFreedom = ((order - factors) ** 2 - order - factors) / 2;
  if (degreesOfFreedom < 0) {
    throw new REvaluationError("NRE2270", "too many factors for the number of variables");
  }

  const suppliedObservations = await forceOptional(invocation, matched.get("n.obs"));
  if (suppliedObservations !== undefined && suppliedObservations.type !== "null") {
    const candidate = numericScalar(suppliedObservations, "n.obs", true);
    if (Number.isFinite(candidate)) observations = candidate;
  }
  const lower = await controlLower(invocation, matched.get("control"));
  const start = await startingUniquenesses(
    invocation,
    matched.get("start"),
    correlation.values,
    order,
    factors,
    lower,
  );
  const fit = await fitFactorModel(correlation.values, order, factors, start, lower, invocation);
  let loadings =
    rotation.name === "varimax" && factors > 1
      ? rotateVarimax(fit.loadings, order, factors, invocation)
      : fit.loadings;
  if (rotation.name !== "none" && rotation.name !== "varimax") {
    loadings = await rotateWithCallable(invocation, rotation, loadings, correlation, factors);
  }
  loadings = orientLoadingColumns(loadings, order, factors);

  return factorAnalysisValue(
    correlation,
    factors,
    degreesOfFreedom,
    observations,
    { ...fit, loadings },
    invocation,
  );
}

interface RotationTarget {
  readonly name: string;
  readonly callable?: RValue;
}

async function rotationTarget(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RotationTarget> {
  const supplied = await forceOptional(invocation, argument);
  if (supplied === undefined) return { name: "varimax" };
  if (supplied.type === "builtin" || supplied.type === "closure") {
    return { name: "", callable: supplied };
  }
  if (supplied.type !== "character" || supplied.length < 1 || isMissing(supplied, 0)) {
    throw new RTypeMismatchError("NRT3450", "invalid 'rotation' value");
  }
  return { name: supplied.values[0] ?? "" };
}

async function rotateWithCallable(
  invocation: BuiltinInvocation,
  target: RotationTarget,
  source: Float64Array,
  correlation: NumericMatrix,
  factors: number,
): Promise<Float64Array> {
  let callable = target.callable;
  if (callable === undefined) {
    const binding = lookupBinding(invocation.currentEnvironment(), target.name);
    if (binding === undefined) {
      throw new REvaluationError("NRE2001", `could not find function "${target.name}"`);
    }
    callable = await invocation.force(binding);
  }
  if (callable.type !== "builtin" && callable.type !== "closure") {
    throw new RTypeMismatchError("NRT3450", "'rotation' is not a function");
  }
  const environment = invocation.currentEnvironment();
  const result = await invocation.invokeLazy(callable, [
    {
      promise: createForcedPromise(factorLoadingsValue(source, correlation, factors), environment),
    },
  ]);
  const rotated =
    result.type === "list" ? (namedListElement(result, "loadings") ?? result) : result;
  if (rotated.type !== "logical" && rotated.type !== "integer" && rotated.type !== "double") {
    throw new RTypeMismatchError("NRT3450", "rotation function returned invalid loadings");
  }
  const dimensions = vectorDimensions(rotated);
  if (
    dimensions === undefined ||
    dimensions.length !== 2 ||
    dimensions[0] !== correlation.rows ||
    dimensions[1] !== factors
  ) {
    throw new RTypeMismatchError(
      "NRT3450",
      "rotation function returned loadings of the wrong size",
    );
  }
  return Float64Array.from({ length: rotated.length }, (_, index) => {
    if (isMissing(rotated, index)) {
      throw new RTypeMismatchError("NRT3450", "rotation function returned missing loadings");
    }
    return Number(rotated.values[index]);
  });
}

async function builtinLoadings(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "..."]);
  const value = await forceRequired(invocation, matched.get("x"), "x");
  if (value.type !== "list") {
    throw new RTypeMismatchError("NRT3450", "$ operator is invalid for atomic vectors");
  }
  return namedListElement(value, "loadings") ?? R_NULL;
}

async function builtinVarimax(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "normalize", "eps"]);
  const source = numericMatrix(
    await forceRequired(invocation, matched.get("x"), "x"),
    "x",
    invocation,
  );
  const normalizeValue = await forceOptional(invocation, matched.get("normalize"));
  const normalize =
    normalizeValue === undefined ? true : logicalScalar(normalizeValue, "normalize");
  const epsValue = await forceOptional(invocation, matched.get("eps"));
  const eps = epsValue === undefined ? 1e-5 : numericScalar(epsValue, "eps");
  if (!(eps > 0)) throw new RTypeMismatchError("NRT3450", "'eps' must be positive");
  const rotated = varimaxRotation(
    source.values,
    source.rows,
    source.columns,
    normalize,
    eps,
    invocation,
  );
  let loadings = withDimensions(doubleVector(rotated.loadings), [source.rows, source.columns]);
  if (source.rowNames !== undefined || source.columnNames !== undefined) {
    loadings = withAttribute(
      loadings,
      "dimnames",
      listValue([
        source.rowNames === undefined ? R_NULL : characterVector(source.rowNames),
        source.columnNames === undefined ? R_NULL : characterVector(source.columnNames),
      ]),
    );
  }
  return listValue(
    [
      withClasses(loadings, ["loadings"]),
      withDimensions(doubleVector(rotated.rotation), [source.columns, source.columns]),
    ],
    ["loadings", "rotmat"],
  );
}

function rejectSupplied(argument: BuiltinCallArgument | undefined, message: string): void {
  if (argument !== undefined && !argument.promise.missing) {
    throw new RUnsupportedFeatureError("NRU6240", message);
  }
}

async function forceRequired(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `argument "${name}" is missing, with no default`);
  }
  return invocation.force(argument.promise);
}

async function forceOptional(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RValue | undefined> {
  if (argument === undefined || argument.promise.missing) return undefined;
  return invocation.force(argument.promise);
}

async function optionalCharacter(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: string,
  name: string,
): Promise<string> {
  const value = await forceOptional(invocation, argument);
  if (value === undefined) return fallback;
  if (value.type !== "character" || value.length < 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3450", `'${name}' must be a character string`);
  }
  return value.values[0] ?? "";
}

function numericScalar(value: RValue, name: string, allowMissing = false): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length < 1 ||
    isMissing(value, 0)
  ) {
    if (allowMissing) return Number.NaN;
    throw new RTypeMismatchError("NRT3450", `'${name}' must be numeric`);
  }
  const result = Number(value.values[0]);
  if (!Number.isFinite(result) && !allowMissing) {
    throw new RTypeMismatchError("NRT3450", `'${name}' must be finite`);
  }
  return result;
}

function logicalScalar(value: RValue, name: string): boolean {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length < 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3450", `'${name}' must be TRUE or FALSE`);
  }
  return Number(value.values[0]) !== 0;
}

function integerScalar(value: RValue, name: string): number {
  const result = Math.trunc(numericScalar(value, name));
  if (!Number.isSafeInteger(result)) {
    throw new RTypeMismatchError("NRT3450", `'${name}' must be an integer`);
  }
  return result;
}

function numericMatrix(value: RValue, name: string, invocation: BuiltinInvocation): NumericMatrix {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3450", `'${name}' must be a numeric matrix`);
  }
  const dimensions = vectorDimensions(value);
  if (dimensions === undefined || dimensions.length !== 2) {
    throw new RTypeMismatchError("NRT3450", `'${name}' must be a numeric matrix`);
  }
  const rows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  invocation.context.allocate(rows * columns);
  const values = new Float64Array(rows * columns);
  for (let index = 0; index < values.length; index += 1) {
    invocation.context.checkpoint();
    const candidate = Number(value.values[index]);
    if (isMissing(value, index) || !Number.isFinite(candidate)) {
      throw new RTypeMismatchError("NRT3450", `'${name}' contains missing or infinite values`);
    }
    values[index] = candidate;
  }
  const [rowNames, columnNames] = matrixDimNames(value);
  return { values, rows, columns, rowNames, columnNames };
}

function matrixDimNames(
  value: RVector,
): [readonly string[] | undefined, readonly string[] | undefined] {
  const dimnames = value.attributes.get("dimnames");
  if (dimnames?.type !== "list") return [undefined, undefined];
  return [characterValues(dimnames.values[0]), characterValues(dimnames.values[1])];
}

function characterValues(value: RValue | undefined): readonly string[] | undefined {
  if (value?.type !== "character") return undefined;
  return value.values.map((item, index) => (isMissing(value, index) ? "" : item));
}

function covarianceToCorrelation(
  covariance: NumericMatrix,
  invocation: BuiltinInvocation,
): NumericMatrix {
  const order = covariance.rows;
  const standardDeviations = new Float64Array(order);
  for (let index = 0; index < order; index += 1) {
    const variance = covariance.values[index + index * order] ?? Number.NaN;
    if (!(variance > 0))
      throw new RTypeMismatchError("NRT3450", "covariance matrix is not positive");
    standardDeviations[index] = Math.sqrt(variance);
  }
  invocation.context.allocate(order * order);
  const values = new Float64Array(order * order);
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row < order; row += 1) {
      invocation.context.checkpoint();
      const left = covariance.values[row + column * order] ?? 0;
      const right = covariance.values[column + row * order] ?? 0;
      const scale = Math.max(1, Math.abs(left), Math.abs(right));
      if (Math.abs(left - right) > Math.sqrt(Number.EPSILON) * order * scale) {
        throw new RTypeMismatchError("NRT3450", "covariance matrix is not symmetric");
      }
      values[row + column * order] =
        (left + right) / 2 / ((standardDeviations[row] ?? 1) * (standardDeviations[column] ?? 1));
    }
  }
  return {
    values,
    rows: order,
    columns: order,
    rowNames: covariance.rowNames ?? covariance.columnNames,
    columnNames: covariance.columnNames ?? covariance.rowNames,
  };
}

function dataCorrelation(data: NumericMatrix, invocation: BuiltinInvocation): NumericMatrix {
  if (data.rows < 2 || data.columns < 2) {
    throw new RTypeMismatchError(
      "NRT3450",
      "factor analysis requires at least two observations and variables",
    );
  }
  const means = new Float64Array(data.columns);
  for (let column = 0; column < data.columns; column += 1) {
    for (let row = 0; row < data.rows; row += 1) {
      means[column] = (means[column] ?? 0) + (data.values[row + column * data.rows] ?? 0);
    }
    means[column] = (means[column] ?? 0) / data.rows;
  }
  const values = new Float64Array(data.columns * data.columns);
  const scales = new Float64Array(data.columns);
  for (let column = 0; column < data.columns; column += 1) {
    for (let row = 0; row < data.rows; row += 1) {
      const centered = (data.values[row + column * data.rows] ?? 0) - (means[column] ?? 0);
      scales[column] = (scales[column] ?? 0) + centered * centered;
    }
    if (!(scales[column]! > 0)) throw new RTypeMismatchError("NRT3450", "zero variance variable");
  }
  for (let column = 0; column < data.columns; column += 1) {
    for (let rowVariable = 0; rowVariable < data.columns; rowVariable += 1) {
      let product = 0;
      for (let row = 0; row < data.rows; row += 1) {
        invocation.context.checkpoint();
        product +=
          ((data.values[row + rowVariable * data.rows] ?? 0) - (means[rowVariable] ?? 0)) *
          ((data.values[row + column * data.rows] ?? 0) - (means[column] ?? 0));
      }
      values[rowVariable + column * data.columns] =
        product / Math.sqrt((scales[rowVariable] ?? 1) * (scales[column] ?? 1));
    }
  }
  return {
    values,
    rows: data.columns,
    columns: data.columns,
    rowNames: data.columnNames,
    columnNames: data.columnNames,
  };
}

async function controlLower(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number> {
  const control = await forceOptional(invocation, argument);
  if (control === undefined || control.type === "null") return 0.005;
  if (control.type !== "list") throw new RTypeMismatchError("NRT3450", "control must be a list");
  const lower = namedListElement(control, "lower");
  if (lower === undefined) return 0.005;
  const result = numericScalar(lower, "control$lower");
  if (!(result > 0 && result < 1)) {
    throw new RTypeMismatchError("NRT3450", "control$lower must be between zero and one");
  }
  return result;
}

function namedListElement(value: RList, name: string): RValue | undefined {
  const names = vectorNames(value);
  const index = names?.indexOf(name) ?? -1;
  return index < 0 ? undefined : value.values[index];
}

async function startingUniquenesses(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  correlation: Float64Array,
  order: number,
  factors: number,
  lower: number,
): Promise<Float64Array> {
  const supplied = await forceOptional(invocation, argument);
  if (supplied !== undefined && supplied.type !== "null") {
    if (supplied.type !== "logical" && supplied.type !== "integer" && supplied.type !== "double") {
      throw new RTypeMismatchError("NRT3450", "start must be a numeric vector or matrix");
    }
    const dimensions = vectorDimensions(supplied);
    const length = dimensions === undefined ? supplied.length : (dimensions[0] ?? 0);
    if (length !== order) throw new RTypeMismatchError("NRT3450", "start has the wrong length");
    return Float64Array.from({ length: order }, (_, index) => {
      const candidate = Number(supplied.values[index]);
      if (isMissing(supplied, index) || !Number.isFinite(candidate)) {
        throw new RTypeMismatchError("NRT3450", "start contains invalid uniquenesses");
      }
      return clamp(candidate, lower, 1 - 1e-8);
    });
  }

  const inverse = invertSymmetric(correlation, order, invocation);
  const defaultScale = 1 - factors / (2 * order);
  return Float64Array.from({ length: order }, (_, index) => {
    const diagonal = inverse?.[index + index * order] ?? 2;
    const estimate = diagonal > 0 ? defaultScale / diagonal : 0.5;
    return clamp(estimate, lower, 1 - 1e-8);
  });
}

async function fitFactorModel(
  correlation: Float64Array,
  order: number,
  factors: number,
  start: Float64Array,
  lower: number,
  invocation: BuiltinInvocation,
): Promise<FitResult> {
  const backend = invocation.state.get(BOX_OPTIMIZATION_BACKEND_STATE_KEY) as
    BoxOptimizationBackend | undefined;
  if (backend === undefined) {
    return fitFactorModelFallback(correlation, order, factors, start, lower, invocation);
  }
  const initial = Float64Array.from(start, (value) => value * 100);
  const lowerBounds = new Float64Array(order).fill(lower * 100);
  const upperBounds = new Float64Array(order).fill(100);
  const optimized = await backend.minimize(
    initial,
    lowerBounds,
    upperBounds,
    (point) => ({
      value: scaledFactorObjective(point, correlation, order, factors, invocation),
      gradient: scaledFactorGradient(point, correlation, order, factors, invocation),
    }),
    {
      memory: 5,
      relativeReductionFactor: 1e7,
      projectedGradientTolerance: 0,
      maxIterations: 400,
      maxEvaluations: 1_000,
    },
  );
  const uniquenesses = Float64Array.from(optimized.point, (value) => value / 100);
  return factorFitResult(
    uniquenesses,
    correlation,
    order,
    factors,
    optimized.value,
    optimized.functionCount,
    optimized.gradientCount,
    optimized.converged,
    invocation,
  );
}

function fitFactorModelFallback(
  correlation: Float64Array,
  order: number,
  factors: number,
  start: Float64Array,
  lower: number,
  invocation: BuiltinInvocation,
): FitResult {
  let point = Float64Array.from(start, (value) => value * 100);
  let current = scaledFactorObjective(point, correlation, order, factors, invocation);
  let functionCount = 1;
  let gradientCount = 0;
  let gradient = scaledFactorGradient(point, correlation, order, factors, invocation);
  gradientCount += 1;
  const corrections: { readonly step: Float64Array; readonly change: Float64Array }[] = [];
  let converged = false;

  for (let iteration = 0; iteration < 400; iteration += 1) {
    invocation.context.checkpoint();
    if (maximumAbsolute(gradient) < 2e-10) {
      converged = true;
      break;
    }
    let direction = limitedMemoryDirection(gradient, corrections);
    if (dot(direction, gradient) >= 0) {
      direction = Float64Array.from(gradient, (value) => -value);
      corrections.length = 0;
    }
    const slope = dot(gradient, direction);
    let step = 1;
    let candidate = point;
    let candidateValue = current;
    let nextGradient = gradient;
    let lineSearchAccepted = false;
    for (let trial = 0; trial < 40; trial += 1) {
      candidate = Float64Array.from(point, (value, index) =>
        clamp(value + step * (direction[index] ?? 0), lower * 100, 100 - 1e-6),
      );
      candidateValue = scaledFactorObjective(candidate, correlation, order, factors, invocation);
      functionCount += 1;
      nextGradient = scaledFactorGradient(candidate, correlation, order, factors, invocation);
      gradientCount += 1;
      const armijo = candidateValue <= current + 1e-4 * step * slope;
      if (armijo) {
        lineSearchAccepted = true;
        break;
      }
      step /= 2;
      if (step < 1e-13) break;
    }
    if (!lineSearchAccepted || maximumDifference(point, candidate) < 1e-14) {
      converged = maximumAbsolute(gradient) < 1e-8;
      break;
    }
    const displacement = subtract(candidate, point);
    const gradientChange = subtract(nextGradient, gradient);
    if (dot(displacement, gradientChange) > 0) {
      corrections.push({ step: displacement, change: gradientChange });
      if (corrections.length > 5) corrections.shift();
    }
    point = candidate;
    gradient = nextGradient;
    if (
      Math.abs(current - candidateValue) <=
      2.220446049250313e-9 * Math.max(1, Math.abs(current))
    ) {
      converged = true;
      current = candidateValue;
      break;
    }
    current = candidateValue;
  }

  const uniquenesses = Float64Array.from(point, (value) => value / 100);
  return factorFitResult(
    uniquenesses,
    correlation,
    order,
    factors,
    current,
    functionCount,
    gradientCount,
    converged,
    invocation,
  );
}

function factorFitResult(
  uniquenesses: Float64Array,
  correlation: Float64Array,
  order: number,
  factors: number,
  objective: number,
  functionCount: number,
  gradientCount: number,
  converged: boolean,
  invocation: BuiltinInvocation,
): FitResult {
  const spectral = scaledSpectral(uniquenesses, correlation, order, invocation);
  const loadings = new Float64Array(order * factors);
  for (let factor = 0; factor < factors; factor += 1) {
    const scale = Math.sqrt(Math.max((spectral.values[factor] ?? 0) - 1, 0));
    for (let row = 0; row < order; row += 1) {
      loadings[row + factor * order] =
        Math.sqrt(uniquenesses[row] ?? 0) * (spectral.vectors[row + factor * order] ?? 0) * scale;
    }
  }
  return {
    uniquenesses,
    objective,
    loadings,
    functionCount,
    gradientCount,
    converged,
  };
}

function scaledFactorObjective(
  point: Float64Array,
  correlation: Float64Array,
  order: number,
  factors: number,
  invocation: BuiltinInvocation,
): number {
  return factorObjective(
    Float64Array.from(point, (value) => value / 100),
    correlation,
    order,
    factors,
    invocation,
  );
}

function scaledFactorGradient(
  point: Float64Array,
  correlation: Float64Array,
  order: number,
  factors: number,
  invocation: BuiltinInvocation,
): Float64Array {
  return Float64Array.from(
    factorGradient(
      Float64Array.from(point, (value) => value / 100),
      correlation,
      order,
      factors,
      invocation,
    ),
    (value) => value / 100,
  );
}

function factorObjective(
  uniquenesses: Float64Array,
  correlation: Float64Array,
  order: number,
  factors: number,
  invocation: BuiltinInvocation,
): number {
  const spectral = scaledSpectral(uniquenesses, correlation, order, invocation);
  let sum = 0;
  for (let index = factors; index < order; index += 1) {
    const value = spectral.values[index] ?? 0;
    if (!(value > 0) || !Number.isFinite(value)) return Number.MAX_VALUE / 1e100;
    sum += Math.log(value) - value;
  }
  return factors - order - sum;
}

function scaledSpectral(
  uniquenesses: Float64Array,
  correlation: Float64Array,
  order: number,
  invocation: BuiltinInvocation,
) {
  const scaled = new Float64Array(order * order);
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row < order; row += 1) {
      scaled[row + column * order] =
        (correlation[row + column * order] ?? 0) /
        Math.sqrt((uniquenesses[row] ?? 1) * (uniquenesses[column] ?? 1));
    }
  }
  return symmetricEigenDecomposition(scaled, order, invocation);
}

function factorGradient(
  point: Float64Array,
  correlation: Float64Array,
  order: number,
  factors: number,
  invocation: BuiltinInvocation,
): Float64Array {
  const spectral = scaledSpectral(point, correlation, order, invocation);
  const gradient = new Float64Array(order);
  for (let index = 0; index < order; index += 1) {
    let componentSum = 0;
    for (let component = factors; component < order; component += 1) {
      const vector = spectral.vectors[index + component * order] ?? 0;
      componentSum += (1 - (spectral.values[component] ?? 0)) * vector * vector;
    }
    gradient[index] = componentSum / (point[index] ?? 1);
  }
  return gradient;
}

function limitedMemoryDirection(
  gradient: Float64Array,
  corrections: readonly { readonly step: Float64Array; readonly change: Float64Array }[],
): Float64Array {
  const working = Float64Array.from(gradient);
  const alpha = new Float64Array(corrections.length);
  const rho = new Float64Array(corrections.length);
  for (let index = corrections.length - 1; index >= 0; index -= 1) {
    const correction = corrections[index];
    if (correction === undefined) continue;
    rho[index] = 1 / dot(correction.step, correction.change);
    alpha[index] = (rho[index] ?? 0) * dot(correction.step, working);
    for (let item = 0; item < working.length; item += 1) {
      working[item] = (working[item] ?? 0) - (alpha[index] ?? 0) * (correction.change[item] ?? 0);
    }
  }
  const latest = corrections[corrections.length - 1];
  const scale =
    latest === undefined
      ? 1
      : dot(latest.step, latest.change) / Math.max(dot(latest.change, latest.change), 1e-30);
  for (let item = 0; item < working.length; item += 1) working[item] = (working[item] ?? 0) * scale;
  for (let index = 0; index < corrections.length; index += 1) {
    const correction = corrections[index];
    if (correction === undefined) continue;
    const beta = (rho[index] ?? 0) * dot(correction.change, working);
    for (let item = 0; item < working.length; item += 1) {
      working[item] =
        (working[item] ?? 0) + ((alpha[index] ?? 0) - beta) * (correction.step[item] ?? 0);
    }
  }
  return Float64Array.from(working, (value) => -value);
}

function rotateVarimax(
  source: Float64Array,
  rows: number,
  columns: number,
  invocation: BuiltinInvocation,
): Float64Array {
  return varimaxRotation(source, rows, columns, true, 1e-5, invocation).loadings;
}

function varimaxRotation(
  source: Float64Array,
  rows: number,
  columns: number,
  normalizeRows: boolean,
  eps: number,
  invocation: BuiltinInvocation,
): { readonly loadings: Float64Array; readonly rotation: Float64Array } {
  const normalized = Float64Array.from(source);
  const rowScales = new Float64Array(rows);
  for (let row = 0; row < rows; row += 1) {
    if (!normalizeRows) {
      rowScales[row] = 1;
      continue;
    }
    let squared = 0;
    for (let column = 0; column < columns; column += 1) {
      squared += (source[row + column * rows] ?? 0) ** 2;
    }
    const scale = Math.sqrt(squared);
    rowScales[row] = scale;
    if (scale === 0) continue;
    for (let column = 0; column < columns; column += 1) {
      const index = row + column * rows;
      normalized[index] = (normalized[index] ?? 0) / scale;
    }
  }
  let rotation = identityMatrix(columns);
  let previous = 0;
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const rotated = multiplyMatrices(normalized, rotation, rows, columns, columns);
    const target = new Float64Array(rows * columns);
    for (let column = 0; column < columns; column += 1) {
      let squared = 0;
      for (let row = 0; row < rows; row += 1) squared += (rotated[row + column * rows] ?? 0) ** 2;
      for (let row = 0; row < rows; row += 1) {
        const value = rotated[row + column * rows] ?? 0;
        target[row + column * rows] = value ** 3 - value * (squared / rows);
      }
    }
    const cross = transposeMultiply(normalized, target, rows, columns);
    const singular = polarRotation(cross, columns, invocation);
    rotation = singular.rotation;
    if (singular.sum < previous * (1 + eps)) break;
    previous = singular.sum;
  }
  const result = multiplyMatrices(normalized, rotation, rows, columns, columns);
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const index = row + column * rows;
      result[index] = (result[index] ?? 0) * (rowScales[row] ?? 0);
    }
  }
  return { loadings: result, rotation };
}

function orientLoadingColumns(source: Float64Array, rows: number, columns: number): Float64Array {
  const result = Float64Array.from(source);
  for (let column = 0; column < columns; column += 1) {
    let sum = 0;
    for (let row = 0; row < rows; row += 1) sum += result[row + column * rows] ?? 0;
    if (sum >= 0) continue;
    for (let row = 0; row < rows; row += 1) {
      const index = row + column * rows;
      result[index] = -(result[index] ?? 0);
    }
  }
  return result;
}

function polarRotation(
  matrix: Float64Array,
  order: number,
  invocation: BuiltinInvocation,
): { readonly rotation: Float64Array; readonly sum: number } {
  const gram = transposeMultiply(matrix, matrix, order, order);
  const spectral = symmetricEigenDecomposition(gram, order, invocation);
  const rotation = new Float64Array(order * order);
  let sum = 0;
  for (let component = 0; component < order; component += 1) {
    const singular = Math.sqrt(Math.max(spectral.values[component] ?? 0, 0));
    sum += singular;
    if (singular <= 1e-12) continue;
    for (let row = 0; row < order; row += 1) {
      let left = 0;
      for (let inner = 0; inner < order; inner += 1) {
        left +=
          (matrix[row + inner * order] ?? 0) * (spectral.vectors[inner + component * order] ?? 0);
      }
      left /= singular;
      for (let column = 0; column < order; column += 1) {
        const index = row + column * order;
        rotation[index] =
          (rotation[index] ?? 0) + left * (spectral.vectors[column + component * order] ?? 0);
      }
    }
  }
  return { rotation, sum };
}

function factorAnalysisValue(
  correlation: NumericMatrix,
  factors: number,
  degreesOfFreedom: number,
  observations: number | undefined,
  fit: FitResult,
  invocation: BuiltinInvocation,
): RValue {
  const variableNames = factorVariableNames(correlation);
  const loadings = factorLoadingsValue(fit.loadings, correlation, factors);
  const correlationDimNames = listValue([
    characterVector(variableNames),
    characterVector(correlation.columnNames ?? variableNames),
  ]);
  const correlationValue = withAttribute(
    withDimensions(doubleVector(correlation.values), [correlation.rows, correlation.columns]),
    "dimnames",
    correlationDimNames,
  );
  const criteria = withNames(doubleVector([fit.objective, fit.functionCount, fit.gradientCount]), [
    "objective",
    "counts.function",
    "counts.gradient",
  ]);
  const values: RValue[] = [
    logicalVector([fit.converged]),
    loadings,
    withNames(doubleVector(fit.uniquenesses), variableNames),
    correlationValue,
    criteria,
    doubleVector([factors]),
    doubleVector([degreesOfFreedom]),
    characterVector(["mle"]),
  ];
  const names = [
    "converged",
    "loadings",
    "uniquenesses",
    "correlation",
    "criteria",
    "factors",
    "dof",
    "method",
  ];
  if (observations !== undefined && Number.isFinite(observations)) {
    const statistic =
      (observations - 1 - (2 * correlation.rows + 5) / 6 - (2 * factors) / 3) * fit.objective;
    const probability = regularizedGammaProbability(statistic / 2, degreesOfFreedom / 2, false);
    values.push(withNames(doubleVector([statistic]), ["objective"]));
    names.push("STATISTIC");
    values.push(withNames(doubleVector([probability]), ["objective"]));
    names.push("PVAL");
    values.push(doubleVector([observations]));
    names.push("n.obs");
  }
  values.push(invocation.currentCall() ?? R_NULL);
  names.push("call");
  invocation.context.allocate(values.length);
  return withClasses(listValue(values, names), ["factanal"]);
}

function factorVariableNames(correlation: NumericMatrix): readonly string[] {
  return (
    correlation.rowNames ?? Array.from({ length: correlation.rows }, (_, index) => `V${index + 1}`)
  );
}

function factorLoadingsValue(
  values: Float64Array,
  correlation: NumericMatrix,
  factors: number,
): RVector {
  const variableNames = factorVariableNames(correlation);
  const factorNames = Array.from({ length: factors }, (_, index) => `Factor${index + 1}`);
  return withClasses(
    withAttribute(
      withDimensions(doubleVector(values), [correlation.rows, factors]),
      "dimnames",
      listValue([characterVector(variableNames), characterVector(factorNames)]),
    ),
    ["loadings"],
  );
}

function invertSymmetric(
  source: Float64Array,
  order: number,
  invocation: BuiltinInvocation,
): Float64Array | undefined {
  const width = order * 2;
  const augmented = new Float64Array(order * width);
  for (let row = 0; row < order; row += 1) {
    for (let column = 0; column < order; column += 1) {
      augmented[row * width + column] = source[row + column * order] ?? 0;
    }
    augmented[row * width + order + row] = 1;
  }
  for (let pivot = 0; pivot < order; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < order; row += 1) {
      if (
        Math.abs(augmented[row * width + pivot] ?? 0) >
        Math.abs(augmented[best * width + pivot] ?? 0)
      )
        best = row;
    }
    if (Math.abs(augmented[best * width + pivot] ?? 0) <= 1e-12) return undefined;
    if (best !== pivot) {
      for (let column = 0; column < width; column += 1) {
        const temporary = augmented[pivot * width + column] ?? 0;
        augmented[pivot * width + column] = augmented[best * width + column] ?? 0;
        augmented[best * width + column] = temporary;
      }
    }
    const diagonal = augmented[pivot * width + pivot] ?? 1;
    for (let column = 0; column < width; column += 1)
      augmented[pivot * width + column]! /= diagonal;
    for (let row = 0; row < order; row += 1) {
      if (row === pivot) continue;
      const scale = augmented[row * width + pivot] ?? 0;
      for (let column = 0; column < width; column += 1) {
        invocation.context.checkpoint();
        augmented[row * width + column] =
          (augmented[row * width + column] ?? 0) - scale * (augmented[pivot * width + column] ?? 0);
      }
    }
  }
  const inverse = new Float64Array(order * order);
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row < order; row += 1)
      inverse[row + column * order] = augmented[row * width + order + column] ?? 0;
  }
  return inverse;
}

function identityMatrix(order: number): Float64Array {
  const result = new Float64Array(order * order);
  for (let index = 0; index < order; index += 1) result[index + index * order] = 1;
  return result;
}

function multiplyMatrices(
  left: Float64Array,
  right: Float64Array,
  rows: number,
  inner: number,
  columns: number,
): Float64Array {
  const result = new Float64Array(rows * columns);
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      let sum = 0;
      for (let index = 0; index < inner; index += 1) {
        sum += (left[row + index * rows] ?? 0) * (right[index + column * inner] ?? 0);
      }
      result[row + column * rows] = sum;
    }
  }
  return result;
}

function transposeMultiply(
  left: Float64Array,
  right: Float64Array,
  rows: number,
  columns: number,
): Float64Array {
  const result = new Float64Array(columns * columns);
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < columns; row += 1) {
      let sum = 0;
      for (let index = 0; index < rows; index += 1) {
        sum += (left[index + row * rows] ?? 0) * (right[index + column * rows] ?? 0);
      }
      result[row + column * columns] = sum;
    }
  }
  return result;
}

function subtract(left: Float64Array, right: Float64Array): Float64Array {
  return Float64Array.from(left, (value, index) => value - (right[index] ?? 0));
}

function dot(left: Float64Array, right: Float64Array): number {
  let result = 0;
  for (let index = 0; index < left.length; index += 1)
    result += (left[index] ?? 0) * (right[index] ?? 0);
  return result;
}

function maximumAbsolute(values: Float64Array): number {
  let result = 0;
  for (const value of values) result = Math.max(result, Math.abs(value));
  return result;
}

function maximumDifference(left: Float64Array, right: Float64Array): number {
  let result = 0;
  for (let index = 0; index < left.length; index += 1)
    result = Math.max(result, Math.abs((left[index] ?? 0) - (right[index] ?? 0)));
  return result;
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}
