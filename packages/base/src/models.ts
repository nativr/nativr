import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  R_NULL,
  characterVector,
  createEnvironment,
  dataFrameRowCount,
  dataFrameValue,
  doubleVector,
  factorLevels,
  factorValue,
  integerVector,
  isAtomic,
  isDataFrame,
  isFactor,
  isMissing,
  listValue,
  logicalVector,
  lookupBinding,
  setBinding,
  subsetVector,
  vectorClasses,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";
import { studentTQuantile } from "./student-t.js";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  RCharacterVector,
  RDoubleVector,
  REnvironment,
  RFormula,
  RIntegerVector,
  RList,
  RLogicalVector,
  RValue,
  RVector,
} from "@nativr/runtime";

type AtomicVector = RLogicalVector | RIntegerVector | RDoubleVector | RCharacterVector;
type RealVector = RLogicalVector | RIntegerVector | RDoubleVector;

export interface ModelBuiltinSpec {
  readonly name: string;
  readonly parameters: readonly string[];
  readonly compatibility: "numeric" | "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

export const MODEL_BUILTIN_SPECS: readonly ModelBuiltinSpec[] = [
  {
    name: "lm",
    parameters: [
      "formula",
      "data",
      "subset",
      "weights",
      "na.action",
      "method",
      "model",
      "x",
      "y",
      "qr",
      "singular.ok",
      "contrasts",
      "offset",
      "...",
    ],
    compatibility: "behavioral",
    implementation: (invocation) => builtinLinearModel(invocation, false),
  },
  {
    name: "aov",
    parameters: ["formula", "data", "projections", "qr", "contrasts", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinLinearModel(invocation, true),
  },
  {
    name: "coef",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelAccessor(invocation, "coef"),
  },
  {
    name: "coefficients",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelAccessor(invocation, "coef"),
  },
  {
    name: "fitted",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelAccessor(invocation, "fitted"),
  },
  {
    name: "fitted.values",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelAccessor(invocation, "fitted"),
  },
  {
    name: "residuals",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelAccessor(invocation, "residuals"),
  },
  {
    name: "resid",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelAccessor(invocation, "residuals"),
  },
  {
    name: "weights",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinModelWeights,
  },
  {
    name: "predict",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinModelPredict,
  },
  {
    name: "model.matrix",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinModelMatrix,
  },
  {
    name: "xtabs",
    parameters: [
      "formula",
      "data",
      "subset",
      "sparse",
      "na.action",
      "na.rm",
      "addNA",
      "exclude",
      "drop.unused.levels",
    ],
    compatibility: "behavioral",
    implementation: builtinCrossTabulation,
  },
  {
    name: "vcov",
    parameters: ["object", "..."],
    compatibility: "numeric",
    implementation: builtinModelCovariance,
  },
  {
    name: "confint",
    parameters: ["object", "parm", "level", "..."],
    compatibility: "numeric",
    implementation: builtinModelConfidenceIntervals,
  },
  {
    name: "df.residual",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinModelResidualDegreesOfFreedom,
  },
  {
    name: "lsfit",
    parameters: ["x", "y", "wt", "intercept", "tolerance", "yname"],
    compatibility: "numeric",
    implementation: builtinLeastSquaresFit,
  },
];

async function requiredFormula(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  call: string,
): Promise<RFormula> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument 'formula' is missing in ${call}().`);
  }
  const value = await invocation.force(argument.promise);
  if (value.type !== "formula" || value.response === undefined) {
    throw new RTypeMismatchError("NRT3265", `${call}() requires a two-sided normalized formula.`);
  }
  return value;
}

interface LinearModelOptions {
  readonly formula: RFormula;
  readonly data?: RValue;
  readonly dataEnvironment: REnvironment;
  readonly subset?: RValue;
  readonly weights?: RealVector;
  readonly offset?: RealVector;
  readonly keepModel: boolean;
  readonly keepX: boolean;
  readonly keepY: boolean;
  readonly keepQr: boolean;
  readonly singularOk: boolean;
  readonly aov: boolean;
  readonly call: RValue;
}

async function builtinLinearModel(invocation: BuiltinInvocation, aov: boolean): Promise<RValue> {
  const parameters = aov
    ? ["formula", "data", "projections", "qr", "contrasts", "..."]
    : [
        "formula",
        "data",
        "subset",
        "weights",
        "na.action",
        "method",
        "model",
        "x",
        "y",
        "qr",
        "singular.ok",
        "contrasts",
        "offset",
        "...",
      ];
  const parsed = matchBuiltinArguments(invocation, parameters);
  const formula = await requiredFormula(
    invocation,
    parsed.matched.get("formula"),
    aov ? "aov" : "lm",
  );
  const dataArgument = parsed.matched.get("data");
  const data =
    dataArgument === undefined || dataArgument.promise.missing
      ? undefined
      : await invocation.force(dataArgument.promise);
  const parent =
    formula.environment ??
    parsed.matched.get("formula")?.promise.environment ??
    invocation.currentEnvironment();
  const dataEnvironment = modelDataEnvironment(data, parent);

  if (parsed.matched.has("na.action")) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "lm()/aov() currently use the deterministic na.omit model-frame policy.",
    );
  }
  if (!aov && parsed.matched.has("method")) {
    const method = await invocation.force(parsed.matched.get("method")!.promise);
    if (
      method.type !== "character" ||
      method.length !== 1 ||
      isMissing(method, 0) ||
      method.values[0] !== "qr"
    ) {
      throw new RUnsupportedFeatureError("NRU6130", "lm() currently supports method = 'qr'.");
    }
  }
  const contrastsArgument = parsed.matched.get("contrasts");
  if (contrastsArgument !== undefined) {
    const contrasts = await invocation.force(contrastsArgument.promise);
    if (contrasts.type !== "null") {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        "Custom model contrast specifications are not implemented.",
      );
    }
  }

  let subsetArgument = parsed.matched.get("subset");
  let weightsArgument = parsed.matched.get("weights");
  let offsetArgument = parsed.matched.get("offset");
  if (aov) {
    for (const argument of parsed.dots) {
      if (argument.name === "subset")
        subsetArgument = uniqueModelArgument(subsetArgument, argument);
      else if (argument.name === "weights") {
        weightsArgument = uniqueModelArgument(weightsArgument, argument);
      } else if (argument.name === "offset") {
        offsetArgument = uniqueModelArgument(offsetArgument, argument);
      } else if (argument.name === "na.action") {
        throw new RUnsupportedFeatureError(
          "NRU6130",
          "aov() currently uses the deterministic na.omit model-frame policy.",
        );
      } else {
        throw new REvaluationError("NRE2101", "Unused argument.");
      }
    }
  } else if (parsed.dots.length > 0) {
    throw new REvaluationError("NRE2101", "Unused argument.");
  }

  const subset =
    subsetArgument === undefined
      ? undefined
      : await evaluateModelArgument(invocation, subsetArgument, dataEnvironment);
  const weights =
    weightsArgument === undefined
      ? undefined
      : modelRealVector(
          await evaluateModelArgument(invocation, weightsArgument, dataEnvironment),
          "weights",
        );
  const offset =
    offsetArgument === undefined
      ? undefined
      : modelRealVector(
          await evaluateModelArgument(invocation, offsetArgument, dataEnvironment),
          "offset",
        );
  if (aov && parsed.matched.has("projections")) {
    const projections = await invocation.force(parsed.matched.get("projections")!.promise);
    if (modelLogicalFlag(projections, false, "projections")) {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        "aov(projections = TRUE) is not implemented yet.",
      );
    }
  }

  const keepModel = aov
    ? true
    : await optionalModelFlag(invocation, parsed.matched.get("model"), true, "model");
  const keepX = aov
    ? false
    : await optionalModelFlag(invocation, parsed.matched.get("x"), false, "x");
  const keepY = aov
    ? false
    : await optionalModelFlag(invocation, parsed.matched.get("y"), false, "y");
  const keepQr = await optionalModelFlag(invocation, parsed.matched.get("qr"), true, "qr");
  const singularOk = aov
    ? true
    : await optionalModelFlag(invocation, parsed.matched.get("singular.ok"), true, "singular.ok");
  return fitLinearModel(
    {
      formula,
      ...(data === undefined ? {} : { data }),
      dataEnvironment,
      ...(subset === undefined ? {} : { subset }),
      ...(weights === undefined ? {} : { weights }),
      ...(offset === undefined ? {} : { offset }),
      keepModel,
      keepX,
      keepY,
      keepQr,
      singularOk,
      aov,
      call: invocation.currentCall(),
    },
    invocation,
  );
}

function uniqueModelArgument(
  existing: BuiltinCallArgument | undefined,
  supplied: BuiltinCallArgument,
): BuiltinCallArgument {
  if (existing !== undefined) {
    throw new REvaluationError(
      "NRE2102",
      `Argument '${supplied.name ?? ""}' matched more than once.`,
    );
  }
  return supplied;
}

async function optionalModelFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  return argument === undefined
    ? fallback
    : modelLogicalFlag(await invocation.force(argument.promise), fallback, name);
}

function modelLogicalFlag(value: RValue, fallback: boolean, name: string): boolean {
  if (value.type === "null") return fallback;
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3265", `${name} must be one non-missing logical value.`);
  }
  return value.values[0] === 1;
}

async function builtinLeastSquaresFit(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "x",
    "y",
    "wt",
    "intercept",
    "tolerance",
    "yname",
  ]);
  const xArgument = parsed.matched.get("x");
  const yArgument = parsed.matched.get("y");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in lsfit().");
  }
  if (yArgument === undefined || yArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'y' is missing in lsfit().");
  }
  const x = leastSquaresRealInput(await invocation.force(xArgument.promise), "x");
  const y = leastSquaresRealInput(await invocation.force(yArgument.promise), "y");
  const xDimensions = vectorDimensions(x);
  const yDimensions = vectorDimensions(y);
  if (xDimensions !== undefined && xDimensions.length !== 2) {
    throw new RTypeMismatchError("NRT3295", "lsfit() 'x' must be a vector or matrix.");
  }
  if (yDimensions !== undefined && (yDimensions.length !== 2 || yDimensions[1] !== 1)) {
    throw new RUnsupportedFeatureError(
      "NRU6147",
      "lsfit() multiple-response matrices require the wider multi-response QR slice.",
    );
  }
  const rows = xDimensions?.[0] ?? x.length;
  const sourceColumns = xDimensions?.[1] ?? 1;
  const yRows = yDimensions?.[0] ?? y.length;
  if (rows !== yRows || rows === 0 || sourceColumns === 0) {
    throw new RTypeMismatchError(
      "NRT3295",
      "lsfit() requires non-empty 'x' and 'y' inputs with the same number of rows.",
    );
  }
  const intercept = await optionalModelFlag(
    invocation,
    parsed.matched.get("intercept"),
    true,
    "intercept",
  );
  const toleranceArgument = parsed.matched.get("tolerance");
  const tolerance =
    toleranceArgument === undefined
      ? 1e-7
      : leastSquaresPositiveScalar(await invocation.force(toleranceArgument.promise), "tolerance");
  const ynameArgument = parsed.matched.get("yname");
  if (ynameArgument !== undefined) {
    const yname = await invocation.force(ynameArgument.promise);
    if (yname.type !== "null") {
      throw new RUnsupportedFeatureError(
        "NRU6147",
        "lsfit() yname requires the wider multi-response result-shaping slice.",
      );
    }
  }
  const weightArgument = parsed.matched.get("wt");
  const weights =
    weightArgument === undefined
      ? undefined
      : leastSquaresRealInput(await invocation.force(weightArgument.promise), "wt");
  if (weights !== undefined && weights.length !== rows) {
    throw new RTypeMismatchError("NRT3295", "lsfit() weights must match the number of rows.");
  }

  const completeRows: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    invocation.context.checkpoint();
    let complete = !leastSquaresMissing(y, row);
    for (let column = 0; complete && column < sourceColumns; column += 1) {
      complete = !leastSquaresMissing(x, row + column * rows);
    }
    if (complete && weights !== undefined) complete = !leastSquaresMissing(weights, row);
    if (complete) completeRows.push(row);
  }
  if (completeRows.length === 0) {
    throw new RTypeMismatchError("NRT3295", "lsfit() has no complete observations.");
  }
  const omitted = rows - completeRows.length;
  if (omitted > 0) {
    invocation.context.warn({
      code: "NRW1112",
      message: `${omitted} missing value${omitted === 1 ? "" : "s"} deleted`,
    });
  }

  const columns = sourceColumns + (intercept ? 1 : 0);
  const matrixValues = new Float64Array(completeRows.length * columns);
  const response = new Float64Array(completeRows.length);
  const fittedWeights = weights === undefined ? undefined : new Float64Array(completeRows.length);
  for (let targetRow = 0; targetRow < completeRows.length; targetRow += 1) {
    const sourceRow = completeRows[targetRow] ?? 0;
    response[targetRow] = realAt(y, sourceRow);
    if (intercept) matrixValues[targetRow] = 1;
    for (let column = 0; column < sourceColumns; column += 1) {
      matrixValues[targetRow + (column + (intercept ? 1 : 0)) * completeRows.length] = realAt(
        x,
        sourceRow + column * rows,
      );
    }
    if (fittedWeights !== undefined) {
      const weight = realAt(weights!, sourceRow);
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RTypeMismatchError("NRT3295", "lsfit() does not allow negative weights.");
      }
      fittedWeights[targetRow] = weight;
    }
  }
  if (
    matrixValues.some((value) => !Number.isFinite(value)) ||
    response.some((value) => !Number.isFinite(value))
  ) {
    throw new RTypeMismatchError("NRT3295", "lsfit() requires finite complete observations.");
  }

  const xDimensionNames = x.attributes.get("dimnames");
  const xColumnNames =
    xDimensionNames?.type === "list" && xDimensionNames.values[1]?.type === "character"
      ? xDimensionNames.values[1].values
      : undefined;
  const columnNames = [
    ...(intercept ? ["Intercept"] : []),
    ...Array.from({ length: sourceColumns }, (_, column) =>
      xColumnNames?.[column] !== undefined && xColumnNames[column] !== ""
        ? (xColumnNames[column] ?? "")
        : sourceColumns === 1
          ? "X"
          : `X${column + 1}`,
    ),
  ];
  const xRowNames =
    xDimensions === undefined
      ? vectorNames(x)
      : xDimensionNames?.type === "list" && xDimensionNames.values[0]?.type === "character"
        ? xDimensionNames.values[0].values
        : undefined;
  let designMatrix = withDimensions(doubleVector(matrixValues), [completeRows.length, columns]);
  designMatrix = withAttribute(
    designMatrix,
    "dimnames",
    listValue([
      xRowNames === undefined
        ? R_NULL
        : characterVector(completeRows.map((row) => xRowNames[row] ?? "")),
      characterVector(columnNames),
    ]),
  );
  const design: ModelMatrixResult = {
    matrix: designMatrix,
    rows: completeRows.length,
    columns,
    columnNames,
    assign: Array.from({ length: columns }, (_, index) => index),
    xlevels: new Map(),
    contrasts: new Set(),
  };
  const solved = solveLeastSquares(
    matrixValues,
    completeRows.length,
    columns,
    response,
    fittedWeights,
    undefined,
    invocation,
    tolerance,
  );
  if (solved.rank < columns) {
    invocation.context.warn({ code: "NRW1113", message: "'X' matrix was collinear" });
  }
  const coefficients = withNames(doubleVector(solved.coefficients), columnNames);
  const residualValues = new Float64Array(rows);
  const residualMissing = new Uint8Array(rows);
  residualMissing.fill(1);
  completeRows.forEach((sourceRow, index) => {
    residualValues[sourceRow] = solved.residuals[index] ?? 0;
    residualMissing[sourceRow] = 0;
  });
  const residuals = doubleVector(residualValues, compactModelMask(residualMissing));
  const qr = leastSquaresFitQr(design, solved, tolerance);
  const fields: { readonly name: string; readonly value: RValue }[] = [
    { name: "coefficients", value: coefficients },
    { name: "residuals", value: residuals },
  ];
  if (weights !== undefined) fields.push({ name: "wt", value: weights });
  fields.push({ name: "intercept", value: logicalVector([intercept]) }, { name: "qr", value: qr });
  invocation.context.allocate(fields.length);
  return listValue(
    fields.map((field) => field.value),
    fields.map((field) => field.name),
  );
}

function leastSquaresRealInput(value: RValue, name: string): RealVector {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3295", `lsfit() '${name}' must be real numeric.`);
  }
  if (isFactor(value)) {
    throw new RTypeMismatchError("NRT3295", `lsfit() '${name}' must be real numeric.`);
  }
  return value;
}

function leastSquaresPositiveScalar(value: RValue, name: string): number {
  const input = leastSquaresRealInput(value, name);
  if (input.length !== 1 || isMissing(input, 0)) {
    throw new RTypeMismatchError("NRT3295", `lsfit() '${name}' must be one positive number.`);
  }
  const result = realAt(input, 0);
  if (!Number.isFinite(result) || result <= 0) {
    throw new RTypeMismatchError("NRT3295", `lsfit() '${name}' must be one positive number.`);
  }
  return result;
}

function leastSquaresMissing(value: RealVector, index: number): boolean {
  return isMissing(value, index) || (value.type === "double" && Number.isNaN(value.values[index]));
}

function modelRealVector(value: RValue, name: string): RealVector {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3265", `lm() ${name} must be a real numeric vector.`);
  }
  return value;
}

async function evaluateModelArgument(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument,
  environment: REnvironment,
): Promise<RValue> {
  if (argument.promise.expression === null) return invocation.force(argument.promise);
  return invocation.evaluate(
    { type: "language", expression: argument.promise.expression },
    environment,
  );
}

function modelDataEnvironment(
  data: RValue | undefined,
  parent: REnvironment,
  call = "lm()/aov()",
): REnvironment {
  if (data?.type === "environment") return data;
  const environment = createEnvironment(parent);
  if (data === undefined || data.type === "null") return environment;
  if (data.type !== "list") {
    throw new RTypeMismatchError(
      "NRT3265",
      `${call} data must be a data frame, named list, environment, or NULL.`,
    );
  }
  const names = vectorNames(data);
  if (names === undefined || names.some((name) => name === "")) {
    throw new RTypeMismatchError("NRT3265", `${call} data-list columns must all be named.`);
  }
  data.values.forEach((value, index) => setBinding(environment, names[index] ?? "", value));
  return environment;
}

async function builtinModelAccessor(
  invocation: BuiltinInvocation,
  accessor: "coef" | "fitted" | "residuals",
): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument 'object' is missing in ${accessor}().`);
  }
  const object = await invocation.force(objectArgument.promise);
  const dispatched = await invocation.dispatchS3IfPresent(
    accessor === "residuals" ? "residuals" : accessor,
    object,
    invocation.arguments,
  );
  if (dispatched !== undefined) return dispatched;
  if (object.type !== "list") {
    throw new RTypeMismatchError("NRT3265", `${accessor}() requires a fitted model object.`);
  }
  const field =
    accessor === "coef"
      ? modelField(object, "coefficients")
      : accessor === "fitted"
        ? modelField(object, "fitted.values")
        : modelField(object, "residuals");
  if (field === undefined) {
    throw new RTypeMismatchError(
      "NRT3265",
      `${accessor}() could not find the corresponding model component.`,
    );
  }
  if (accessor === "coef") {
    const completeArgument = parsed.dots.find((argument) => argument.name === "complete");
    if (completeArgument !== undefined) {
      const complete = modelLogicalFlag(
        await invocation.force(completeArgument.promise),
        true,
        "complete",
      );
      if (!complete && isAtomic(field)) {
        const indices = Array.from({ length: field.length }, (_, index) =>
          isMissing(field, index) ? undefined : index + 1,
        ).filter((index): index is number => index !== undefined);
        return subsetVector(field, integerVector(indices), invocation.context);
      }
    }
  }
  return field;
}

function modelField(model: RList, name: string): RValue | undefined {
  const names = vectorNames(model);
  const index = names?.indexOf(name) ?? -1;
  return index < 0 ? undefined : model.values[index];
}

async function builtinModelWeights(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in weights().");
  }
  const object = await invocation.force(objectArgument.promise);
  const dispatched = await invocation.dispatchS3IfPresent("weights", object, invocation.arguments);
  if (dispatched !== undefined) return dispatched;
  if (object.type !== "list" && object.type !== "pairlist") {
    throw new RTypeMismatchError(
      "NRT3265",
      `$ operator is invalid for ${object.type === "null" ? "NULL" : "atomic vectors"}`,
    );
  }
  const field = modelComponent(object, "weights");
  if (field === undefined || field.type === "null") return R_NULL;
  const action = modelComponent(object, "na.action");
  if (
    action?.type !== "integer" ||
    !vectorClasses(action)?.includes("exclude") ||
    action.length === 0
  ) {
    return field;
  }
  if (!isAtomic(field) && field.type !== "list" && field.type !== "pairlist") {
    throw new RTypeMismatchError("NRT3265", "weights() cannot apply na.exclude to this component.");
  }
  const omitted = new Set<number>();
  for (let index = 0; index < action.length; index += 1) {
    if (isMissing(action, index)) continue;
    const position = action.values[index] ?? 0;
    if (Number.isSafeInteger(position) && position > 0) omitted.add(position);
  }
  const outputLength = field.length + omitted.size;
  const indices = new Int32Array(outputLength);
  const missing = new Uint8Array(outputLength);
  let source = 1;
  for (let position = 1; position <= outputLength; position += 1) {
    invocation.context.checkpoint();
    if (omitted.has(position)) missing[position - 1] = 1;
    else {
      indices[position - 1] = source;
      source += 1;
    }
  }
  return subsetVector(
    field,
    integerVector(indices, missing.some((value) => value === 1) ? missing : undefined),
    invocation.context,
  );
}

function modelComponent(
  model: RList | Extract<RValue, { readonly type: "pairlist" }>,
  name: string,
) {
  const names = vectorNames(model);
  const exact = names?.indexOf(name) ?? -1;
  if (exact >= 0) return model.values[exact];
  const partial = names
    ?.map((candidate, index) => (candidate.startsWith(name) ? index : -1))
    .filter((index) => index >= 0);
  return partial?.length === 1 ? model.values[partial[0] ?? -1] : undefined;
}

async function builtinModelPredict(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in predict().");
  }
  const object = await invocation.force(objectArgument.promise);
  const dispatched = await invocation.dispatchS3IfPresent("predict", object, invocation.arguments);
  if (dispatched !== undefined) return dispatched;
  if (object.type !== "list" || !isLinearModel(object)) {
    throw new RTypeMismatchError("NRT3265", "predict() requires an lm/aov object.");
  }
  const newDataArgument =
    parsed.dots.find((argument) => argument.name === "newdata") ??
    parsed.dots.find((argument) => argument.name === undefined);
  if (parsed.dots.some((argument) => argument !== newDataArgument)) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "predict.lm() currently supports fitted predictions and newdata only.",
    );
  }
  if (newDataArgument === undefined) {
    const fitted = modelField(object, "fitted.values");
    if (fitted === undefined) {
      throw new RTypeMismatchError("NRT3265", "The fitted model has no fitted.values component.");
    }
    return fitted;
  }
  const formula = modelField(object, "terms");
  const coefficients = modelField(object, "coefficients");
  if (formula?.type !== "formula" || coefficients?.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed terms or coefficients.");
  }
  const newData = await invocation.force(newDataArgument.promise);
  const parent = formula.environment ?? newDataArgument.promise.environment;
  const environment = modelDataEnvironment(newData, parent);
  const xlevels = modelXLevels(object);
  const prepared = await prepareModelData(
    {
      formula,
      data: newData,
      environment,
      requireResponse: false,
      omitMissing: false,
      xlevels,
    },
    invocation,
  );
  const design = buildModelMatrix(prepared, formula, xlevels, invocation);
  if (coefficients.length !== design.columns) {
    throw new RTypeMismatchError(
      "NRT3265",
      "The new model matrix does not match the fitted coefficient shape.",
    );
  }
  invocation.context.allocate(design.rows);
  const values = new Float64Array(design.rows);
  const missing = new Uint8Array(design.rows);
  for (let row = 0; row < design.rows; row += 1) {
    let total = 0;
    for (let column = 0; column < design.columns; column += 1) {
      const index = row + column * design.rows;
      if (design.matrix.missing?.[index] === 1) {
        missing[row] = 1;
        break;
      }
      if (!isMissing(coefficients, column)) {
        total += (design.matrix.values[index] ?? 0) * (coefficients.values[column] ?? 0);
      }
    }
    values[row] = total;
  }
  return withNames(doubleVector(values, compactModelMask(missing)), prepared.rowNames);
}

async function builtinModelMatrix(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in model.matrix().");
  }
  const object = await invocation.force(objectArgument.promise);
  const dispatched = await invocation.dispatchS3IfPresent(
    "model.matrix",
    object,
    invocation.arguments,
  );
  if (dispatched !== undefined) return dispatched;

  if (object.type === "list" && isLinearModel(object)) {
    const stored = modelField(object, "x");
    if (stored?.type === "double" && vectorDimensions(stored)?.length === 2) return stored;
    const formula = modelField(object, "terms");
    const model = modelField(object, "model");
    if (formula?.type !== "formula" || model?.type !== "list") {
      throw new RTypeMismatchError("NRT3265", "The lm object cannot reconstruct its model matrix.");
    }
    return modelMatrixFromFormula(formula, model, modelXLevels(object), invocation);
  }
  if (object.type !== "formula") {
    throw new RTypeMismatchError(
      "NRT3265",
      "model.matrix() requires a formula or fitted lm/aov object.",
    );
  }
  const dataArgument =
    parsed.dots.find((argument) => argument.name === "data") ??
    parsed.dots.find((argument) => argument.name === undefined);
  if (dataArgument === undefined) {
    return modelMatrixFromFormula(object, undefined, new Map(), invocation);
  }
  if (parsed.dots.some((argument) => argument !== dataArgument)) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "model.matrix() currently supports only formula and data.",
    );
  }
  const data = await invocation.force(dataArgument.promise);
  return modelMatrixFromFormula(object, data, new Map(), invocation);
}

async function modelMatrixFromFormula(
  formula: RFormula,
  data: RValue | undefined,
  xlevels: ReadonlyMap<string, readonly string[]>,
  invocation: BuiltinInvocation,
): Promise<RDoubleVector> {
  const environment = modelDataEnvironment(
    data,
    formula.environment ?? invocation.currentEnvironment(),
  );
  const prepared = await prepareModelData(
    {
      formula,
      ...(data === undefined ? {} : { data }),
      environment,
      requireResponse: false,
      omitMissing: true,
      xlevels,
    },
    invocation,
  );
  return buildModelMatrix(prepared, formula, xlevels, invocation).matrix;
}

interface XtabsLevel {
  readonly key: string;
  readonly label: string;
  readonly missing: boolean;
}

interface XtabsAxis {
  readonly name: string;
  readonly value: AtomicVector;
  readonly levels: readonly XtabsLevel[];
  readonly positions: ReadonlyMap<string, number>;
}

type XtabsResponse = RLogicalVector | RIntegerVector | RDoubleVector;

async function builtinCrossTabulation(invocation: BuiltinInvocation): Promise<RValue> {
  const parameters = [
    "formula",
    "data",
    "subset",
    "sparse",
    "na.action",
    "na.rm",
    "addNA",
    "exclude",
    "drop.unused.levels",
  ] as const;
  const parsed = matchBuiltinArguments(invocation, parameters);
  if (parsed.dots.length > 0) {
    throw new REvaluationError("NRE2101", "Unused argument.");
  }

  const formulaArgument = parsed.matched.get("formula");
  const formula =
    formulaArgument === undefined || formulaArgument.promise.missing
      ? ({
          type: "formula",
          terms: ["."],
          variables: [],
          intercept: true,
          environment: invocation.currentEnvironment(),
        } satisfies RFormula)
      : await xtabsFormula(invocation, formulaArgument);
  if (formula.terms.length === 0) {
    throw new REvaluationError("NRE2139", "'INDEX' is of length zero");
  }
  if (formula.terms.some((term) => term.includes(":"))) {
    throw new RTypeMismatchError("NRT3265", "interactions are not allowed");
  }

  const dataArgument = parsed.matched.get("data");
  const data =
    dataArgument === undefined || dataArgument.promise.missing
      ? undefined
      : await invocation.force(dataArgument.promise);
  const parent =
    formula.environment ?? formulaArgument?.promise.environment ?? invocation.currentEnvironment();
  const environment = modelDataEnvironment(data, parent, "xtabs()");
  const terms = expandDotTerms(formula, data);
  if (terms.length === 0) {
    throw new REvaluationError("NRE2139", "'INDEX' is of length zero");
  }
  const variables = await Promise.all(
    terms.map(async (term) => ({
      name: term,
      value: await evaluateModelLabel(term, environment, invocation),
    })),
  );
  const response =
    formula.response === undefined
      ? undefined
      : xtabsResponse(
          await evaluateModelExpression(formula.response, environment, invocation),
          formula.response,
        );
  const responseDimensions = response === undefined ? undefined : vectorDimensions(response);
  const responseRows = responseDimensions?.[0] ?? response?.length;
  const lengths = [
    ...variables.map(({ value }) => value.length),
    ...(responseRows === undefined ? [] : [responseRows]),
  ];
  const dataRows = data !== undefined && isDataFrame(data) ? dataFrameRowCount(data) : undefined;
  const rows = lengths[0] ?? dataRows ?? 0;
  if (lengths.some((length) => length !== rows)) {
    throw new RTypeMismatchError("NRT3265", "variable lengths differ");
  }

  const subsetArgument = parsed.matched.get("subset");
  const subset =
    subsetArgument === undefined
      ? undefined
      : await evaluateModelArgument(invocation, subsetArgument, environment);
  const rowNames = modelRowNames(data, undefined, rows);
  let selected = [...resolveModelSubset(subset, rows, rowNames)];
  const naAction = await xtabsNaAction(invocation, parsed.matched.get("na.action"));
  if (naAction === "omit") {
    selected = selected.filter(
      (row) =>
        variables.every(({ value }) => modelCellComplete(value, row)) &&
        (response === undefined || xtabsResponseRowComplete(response, row, responseRows ?? rows)),
    );
  }

  const sparse = await xtabsFlag(invocation, parsed.matched.get("sparse"), false, "sparse");
  if (sparse) {
    throw new RUnsupportedFeatureError(
      "NRU6131",
      "xtabs(sparse = TRUE) requires the external Matrix sparse-class architecture.",
    );
  }
  const removeMissing = await xtabsFlag(invocation, parsed.matched.get("na.rm"), false, "na.rm");
  const addMissing = await xtabsFlag(invocation, parsed.matched.get("addNA"), false, "addNA");
  const dropUnused = await xtabsFlag(
    invocation,
    parsed.matched.get("drop.unused.levels"),
    false,
    "drop.unused.levels",
  );
  const excluded = await xtabsExcludedLabels(invocation, parsed.matched.get("exclude"));
  const axes = variables.map(({ name, value }) =>
    xtabsAxis(name, value, selected, addMissing, dropUnused, excluded),
  );
  const responseColumns = responseDimensions?.[1] ?? 1;
  const responseLabels =
    responseColumns > 1
      ? xtabsResponseLabels(response!, responseColumns, formula.response ?? "")
      : undefined;
  const dimensions = [
    ...axes.map((axis) => axis.levels.length),
    ...(responseLabels === undefined ? [] : [responseLabels.length]),
  ];
  const axisCellCount = axes.reduce((product, axis) => product * axis.levels.length, 1);
  const length = dimensions.reduce((product, dimension) => product * dimension, 1);
  invocation.context.allocate(length + axes.reduce((sum, axis) => sum + axis.levels.length, 0));

  let output: RVector;
  if (response === undefined) {
    const counts = new Int32Array(length);
    for (const row of selected) {
      invocation.context.checkpoint();
      const offset = xtabsOffset(axes, row);
      if (offset !== undefined) counts[offset] = (counts[offset] ?? 0) + 1;
    }
    output = integerVector(counts);
  } else {
    const integerResult = response.type !== "double";
    const values = integerResult ? new Int32Array(length) : new Float64Array(length);
    const missing = new Uint8Array(length);
    const sourceRows = responseRows ?? rows;
    for (const row of selected) {
      invocation.context.checkpoint();
      const offset = xtabsOffset(axes, row);
      if (offset === undefined) continue;
      for (let column = 0; column < responseColumns; column += 1) {
        const source = row + column * sourceRows;
        const target = offset + column * axisCellCount;
        if (isMissing(response, source) || Number.isNaN(response.values[source] ?? 0)) {
          if (!removeMissing) missing[target] = 1;
          continue;
        }
        values[target] = (values[target] ?? 0) + (response.values[source] ?? 0);
      }
    }
    output =
      response.type === "double"
        ? doubleVector(values, compactModelMask(missing))
        : integerVector(values, compactModelMask(missing));
  }

  output = withDimensions(output, dimensions);
  const dimensionNames = axes.map((axis) => xtabsLevelNames(axis.levels));
  if (responseLabels !== undefined) dimensionNames.push(responseLabels);
  output = withAttribute(
    output,
    "dimnames",
    listValue(dimensionNames, [
      ...axes.map((axis) => axis.name),
      ...(responseLabels === undefined ? [] : [""]),
    ]),
  );
  output = withClasses(output, ["xtabs", "table"]);
  return withAttribute(output, "call", invocation.currentCall());
}

async function xtabsFormula(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument,
): Promise<RFormula> {
  const value = await invocation.force(argument.promise);
  if (value.type !== "formula") {
    throw new RTypeMismatchError("NRT3265", "xtabs() requires a normalized formula.");
  }
  return value;
}

function xtabsResponse(value: RValue, label: string): XtabsResponse {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3265", `xtabs() left-hand side '${label}' must be numeric.`);
  }
  const dimensions = vectorDimensions(value);
  if (dimensions !== undefined && dimensions.length !== 2) {
    throw new RTypeMismatchError(
      "NRT3265",
      "xtabs() left-hand side must be a vector or two-dimensional matrix.",
    );
  }
  return value;
}

async function xtabsFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0 ||
    isMissing(value, 0) ||
    Number.isNaN(value.values[0] ?? Number.NaN)
  ) {
    throw new RTypeMismatchError(
      "NRT3265",
      `xtabs(${name}=) requires one non-missing logical value.`,
    );
  }
  return (value.values[0] ?? 0) !== 0;
}

async function xtabsNaAction(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<"pass" | "omit"> {
  if (argument === undefined) return "pass";
  const expression = argument.promise.expression;
  if (expression?.kind === "Identifier") {
    if (expression.name === "na.pass") return "pass";
    if (expression.name === "na.omit") return "omit";
  }
  const value = await invocation.force(argument.promise);
  if (value.type === "null") return "pass";
  throw new RUnsupportedFeatureError(
    "NRU6131",
    "xtabs(na.action=) currently supports na.pass, na.omit, and NULL.",
  );
}

async function xtabsExcludedLabels(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<ReadonlySet<string>> {
  if (argument === undefined) return new Set();
  const value = await invocation.force(argument.promise);
  if (!isAtomic(value) || value.type === "complex" || value.type === "raw") {
    throw new RTypeMismatchError("NRT3265", "xtabs(exclude=) must be an atomic vector.");
  }
  const output = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    if (!isMissing(value, index)) output.add(xtabsLabel(value, index));
  }
  return output;
}

function xtabsAxis(
  name: string,
  value: AtomicVector,
  selected: readonly number[],
  addMissing: boolean,
  dropUnused: boolean,
  excluded: ReadonlySet<string>,
): XtabsAxis {
  const observed = new Set<string>();
  let hasMissing = false;
  for (const row of selected) {
    if (xtabsCellMissing(value, row)) hasMissing = true;
    else observed.add(xtabsLabel(value, row));
  }
  let labels: string[];
  if (isFactor(value)) {
    labels = factorLevels(value).filter(
      (label) => !excluded.has(label) && (!dropUnused || observed.has(label)),
    );
  } else {
    labels = [...observed].filter((label) => !excluded.has(label));
    labels.sort((left, right) => xtabsCompareLabels(value, left, right));
  }
  const levels: XtabsLevel[] = labels.map((label) => ({
    key: `value:${label}`,
    label,
    missing: false,
  }));
  if (addMissing && hasMissing) {
    levels.push({ key: "missing", label: "", missing: true });
  }
  return {
    name,
    value,
    levels,
    positions: new Map(levels.map((level, index) => [level.key, index])),
  };
}

function xtabsCellMissing(value: AtomicVector | XtabsResponse, index: number): boolean {
  return (
    isMissing(value, index) ||
    (value.type === "double" && Number.isNaN(value.values[index] ?? Number.NaN))
  );
}

function xtabsLabel(value: AtomicVector, index: number): string {
  if (isFactor(value)) {
    return factorLevels(value)[(value.values[index] ?? 0) - 1] ?? "";
  }
  if (value.type === "character") return value.values[index] ?? "";
  if (value.type === "logical") return value.values[index] === 1 ? "TRUE" : "FALSE";
  const item = value.values[index] ?? 0;
  if (item === Number.POSITIVE_INFINITY) return "Inf";
  if (item === Number.NEGATIVE_INFINITY) return "-Inf";
  if (Object.is(item, -0)) return "0";
  return String(item);
}

function xtabsCompareLabels(value: AtomicVector, left: string, right: string): number {
  if (value.type === "logical") {
    return Number(left === "TRUE") - Number(right === "TRUE");
  }
  if (value.type === "integer" || value.type === "double") {
    const numericLabel = (label: string): number =>
      label === "Inf"
        ? Number.POSITIVE_INFINITY
        : label === "-Inf"
          ? Number.NEGATIVE_INFINITY
          : Number(label);
    return numericLabel(left) - numericLabel(right);
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

function xtabsOffset(axes: readonly XtabsAxis[], row: number): number | undefined {
  let offset = 0;
  let stride = 1;
  for (const axis of axes) {
    const key = xtabsCellMissing(axis.value, row)
      ? "missing"
      : `value:${xtabsLabel(axis.value, row)}`;
    const position = axis.positions.get(key);
    if (position === undefined) return undefined;
    offset += position * stride;
    stride *= axis.levels.length;
  }
  return offset;
}

function xtabsLevelNames(levels: readonly XtabsLevel[]): RCharacterVector {
  const missing = Uint8Array.from(levels, (level) => (level.missing ? 1 : 0));
  return characterVector(
    levels.map((level) => level.label),
    compactModelMask(missing),
  );
}

function xtabsResponseRowComplete(response: XtabsResponse, row: number, rows: number): boolean {
  const columns = vectorDimensions(response)?.[1] ?? 1;
  for (let column = 0; column < columns; column += 1) {
    if (xtabsCellMissing(response, row + column * rows)) return false;
  }
  return true;
}

function xtabsResponseLabels(
  response: XtabsResponse,
  columns: number,
  expression: string,
): RCharacterVector {
  const dimensionNames = response.attributes.get("dimnames");
  const columnNames = dimensionNames?.type === "list" ? dimensionNames.values[1] : undefined;
  if (
    columnNames?.type === "character" &&
    columnNames.length === columns &&
    columnNames.missing === undefined
  ) {
    return columnNames;
  }
  const match = /^cbind\((.*)\)$/u.exec(expression.trim());
  const labels =
    match === null
      ? []
      : (match[1] ?? "")
          .split(",")
          .map((label) => label.trim())
          .filter((label) => label.length > 0);
  return characterVector(
    labels.length === columns
      ? labels
      : Array.from({ length: columns }, (_, index) => String(index + 1)),
  );
}

function isLinearModel(value: RList): boolean {
  const classes = vectorClasses(value);
  return classes?.includes("lm") ?? false;
}

async function builtinModelResidualDegreesOfFreedom(
  invocation: BuiltinInvocation,
): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in df.residual().");
  }
  const object = await invocation.force(argument.promise);
  const dispatched = await invocation.dispatchS3IfPresent(
    "df.residual",
    object,
    invocation.arguments,
  );
  if (dispatched !== undefined) return dispatched;
  if (object.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "df.residual() requires a fitted model object.");
  }
  const value = modelField(object, "df.residual");
  if (value === undefined) {
    throw new RTypeMismatchError("NRT3265", "The model has no residual degrees of freedom.");
  }
  return value;
}

async function builtinModelCovariance(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in vcov().");
  }
  const object = await invocation.force(argument.promise);
  const dispatched = await invocation.dispatchS3IfPresent("vcov", object, invocation.arguments);
  if (dispatched !== undefined) return dispatched;
  if (object.type !== "list" || !isLinearModel(object)) {
    throw new RTypeMismatchError("NRT3265", "vcov() requires an lm/aov object.");
  }
  let complete = true;
  for (const dot of parsed.dots) {
    if (dot.name !== "complete") {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        "vcov.lm() currently supports only the complete control.",
      );
    }
    complete = modelLogicalFlag(await invocation.force(dot.promise), true, "complete");
  }
  return linearModelCovariance(object, complete, invocation);
}

async function builtinModelConfidenceIntervals(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "parm", "level", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in confint().");
  }
  const object = await invocation.force(argument.promise);
  const dispatched = await invocation.dispatchS3IfPresent("confint", object, invocation.arguments);
  if (dispatched !== undefined) return dispatched;
  if (object.type !== "list" || !isLinearModel(object)) {
    throw new RTypeMismatchError("NRT3265", "confint() requires an lm/aov object.");
  }
  if (parsed.dots.length > 0) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "confint.lm() does not yet accept additional method controls.",
    );
  }
  const coefficientValue = modelField(object, "coefficients");
  if (coefficientValue?.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The model has malformed coefficients.");
  }
  const coefficientNames =
    vectorNames(coefficientValue) ??
    Array.from({ length: coefficientValue.length }, (_, index) => String(index + 1));
  const parameterArgument = parsed.matched.get("parm");
  const parameters =
    parameterArgument === undefined || parameterArgument.promise.missing
      ? defaultModelParameterSelection(coefficientNames)
      : selectModelParameters(await invocation.force(parameterArgument.promise), coefficientNames);
  const levelArgument = parsed.matched.get("level");
  const level =
    levelArgument === undefined || levelArgument.promise.missing
      ? 0.95
      : modelProbability(await invocation.force(levelArgument.promise), "level");
  const covariance = linearModelCovariance(object, true, invocation);
  const degrees = modelIntegerField(object, "df.residual");
  const tail = (1 - level) / 2;
  const critical = studentTQuantile(1 - tail, degrees);
  const rows = parameters.indices.length;
  invocation.context.allocate(rows * 2);
  const values = new Float64Array(rows * 2);
  const missing = new Uint8Array(rows * 2);
  for (let row = 0; row < rows; row += 1) {
    invocation.context.checkpoint();
    const coefficientIndex = parameters.indices[row];
    if (
      coefficientIndex === undefined ||
      isMissing(coefficientValue, coefficientIndex) ||
      isMissing(covariance, coefficientIndex + coefficientIndex * coefficientValue.length)
    ) {
      missing[row] = 1;
      missing[row + rows] = 1;
      continue;
    }
    const estimate = coefficientValue.values[coefficientIndex] ?? 0;
    const variance =
      covariance.values[coefficientIndex + coefficientIndex * coefficientValue.length] ?? 0;
    const margin = critical * Math.sqrt(Math.max(0, variance));
    values[row] = estimate - margin;
    values[row + rows] = estimate + margin;
  }
  let result = withDimensions(doubleVector(values, compactModelMask(missing)), [rows, 2]);
  const rowNames =
    rows === 0
      ? R_NULL
      : characterVector(parameters.labels, compactModelMask(parameters.labelMissing));
  result = withAttribute(
    result,
    "dimnames",
    listValue([
      rowNames,
      characterVector([
        `${modelPercentLabel(tail * 100)} %`,
        `${modelPercentLabel((1 - tail) * 100)} %`,
      ]),
    ]),
  );
  return result;
}

function linearModelCovariance(
  object: RList,
  complete: boolean,
  invocation: BuiltinInvocation,
): RDoubleVector {
  const coefficients = modelField(object, "coefficients");
  const residuals = modelField(object, "residuals");
  const qr = modelField(object, "qr");
  if (coefficients?.type !== "double" || residuals?.type !== "double" || qr?.type !== "list") {
    throw new RTypeMismatchError(
      "NRT3265",
      "The lm object requires coefficients, residuals, and QR metadata for covariance.",
    );
  }
  const coefficientNames =
    vectorNames(coefficients) ??
    Array.from({ length: coefficients.length }, (_, index) => String(index + 1));
  const qrMatrix = modelField(qr, "qr");
  const pivotValue = modelField(qr, "pivot");
  const rankValue = modelField(qr, "rank");
  const dimensions = qrMatrix?.type === "double" ? vectorDimensions(qrMatrix) : undefined;
  if (
    qrMatrix?.type !== "double" ||
    dimensions?.length !== 2 ||
    pivotValue?.type !== "integer" ||
    rankValue?.type !== "integer" ||
    rankValue.length !== 1
  ) {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed QR metadata.");
  }
  const rank = rankValue.values[0] ?? 0;
  const matrixRows = dimensions[0] ?? 0;
  const columns = coefficients.length;
  if (rank < 0 || rank > columns || pivotValue.length < columns) {
    throw new RTypeMismatchError("NRT3265", "The lm object has inconsistent QR rank metadata.");
  }
  const degrees = modelIntegerField(object, "df.residual");
  const weights = modelField(object, "weights");
  const fitted = modelField(object, "fitted.values");
  if (weights !== undefined && weights.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed weights.");
  }
  if (fitted?.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed fitted values.");
  }
  let residualSumSquares = 0;
  let fittedScale = 0;
  for (let index = 0; index < residuals.length; index += 1) {
    invocation.context.checkpoint();
    const residual = residuals.values[index] ?? 0;
    const weight = weights?.values[index] ?? 1;
    residualSumSquares += residual * residual * weight;
    const fittedValue = fitted.values[index] ?? 0;
    fittedScale += fittedValue * fittedValue * weight;
  }
  if (residualSumSquares < 1e-30 * Math.max(Number.MIN_VALUE, fittedScale)) {
    invocation.context.warn({
      code: "NRW1101",
      message: "essentially perfect fit: summary may be unreliable",
    });
  }
  const residualVariance = residualSumSquares / degrees;
  const inverse = invertUpperTriangular(qrMatrix, matrixRows, rank);
  const fullValues = new Float64Array(columns * columns);
  const fullMissing = new Uint8Array(columns * columns).fill(1);
  for (let left = 0; left < rank; left += 1) {
    const originalLeft = (pivotValue.values[left] ?? 1) - 1;
    for (let right = 0; right < rank; right += 1) {
      const originalRight = (pivotValue.values[right] ?? 1) - 1;
      let value = 0;
      for (let index = 0; index < rank; index += 1) {
        value += (inverse[left + index * rank] ?? 0) * (inverse[right + index * rank] ?? 0);
      }
      const destination = originalLeft + originalRight * columns;
      const covariance = value * residualVariance;
      fullValues[destination] = covariance === 0 ? 0 : covariance;
      fullMissing[destination] = 0;
    }
  }
  const selected = complete
    ? Array.from({ length: columns }, (_, index) => index)
    : Array.from({ length: columns }, (_, index) => index).filter(
        (index) => !isMissing(coefficients, index),
      );
  const size = selected.length;
  invocation.context.allocate(size * size);
  const output = new Float64Array(size * size);
  const outputMissing = new Uint8Array(size * size);
  for (let column = 0; column < size; column += 1) {
    for (let row = 0; row < size; row += 1) {
      const source = (selected[row] ?? 0) + (selected[column] ?? 0) * columns;
      const destination = row + column * size;
      output[destination] = fullValues[source] ?? 0;
      outputMissing[destination] = fullMissing[source] ?? 1;
    }
  }
  let result = withDimensions(doubleVector(output, compactModelMask(outputMissing)), [size, size]);
  const names = characterVector(selected.map((index) => coefficientNames[index] ?? ""));
  result = withAttribute(result, "dimnames", listValue([names, names]));
  return result;
}

function invertUpperTriangular(matrix: RDoubleVector, rows: number, rank: number): Float64Array {
  const inverse = new Float64Array(rank * rank);
  for (let column = 0; column < rank; column += 1) {
    for (let row = rank - 1; row >= 0; row -= 1) {
      let value = row === column ? 1 : 0;
      for (let inner = row + 1; inner < rank; inner += 1) {
        value -= (matrix.values[row + inner * rows] ?? 0) * (inverse[inner + column * rank] ?? 0);
      }
      const diagonal = matrix.values[row + row * rows] ?? 0;
      if (diagonal === 0 || !Number.isFinite(diagonal)) {
        throw new RTypeMismatchError("NRT3265", "The model QR factor is singular.");
      }
      inverse[row + column * rank] = value / diagonal;
    }
  }
  return inverse;
}

function modelIntegerField(object: RList, name: string): number {
  const value = modelField(object, name);
  if (
    value?.type !== "integer" ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    (value.values[0] ?? -1) < 0
  ) {
    throw new RTypeMismatchError("NRT3265", `The model has malformed ${name}.`);
  }
  return value.values[0] ?? 0;
}

interface ModelParameterSelection {
  readonly indices: readonly (number | undefined)[];
  readonly labels: readonly string[];
  readonly labelMissing: Uint8Array;
}

function defaultModelParameterSelection(names: readonly string[]): ModelParameterSelection {
  return {
    indices: names.map((_name, index) => index),
    labels: [...names],
    labelMissing: new Uint8Array(names.length),
  };
}

function selectModelParameters(value: RValue, names: readonly string[]): ModelParameterSelection {
  if (value.type === "null") return defaultModelParameterSelection(names);
  if (value.type === "character") {
    const labelMissing = new Uint8Array(value.length);
    const labels = Array.from({ length: value.length }, (_, index) => {
      if (isMissing(value, index)) {
        labelMissing[index] = 1;
        return "";
      }
      return value.values[index] ?? "";
    });
    return {
      indices: labels.map((label, index) =>
        labelMissing[index] === 1
          ? undefined
          : (() => {
              const match = names.indexOf(label);
              return match < 0 ? undefined : match;
            })(),
      ),
      labels,
      labelMissing,
    };
  }
  if (value.type === "logical") {
    const indices: (number | undefined)[] = [];
    const labels: string[] = [];
    const labelMissing: number[] = [];
    if (value.length === 0) {
      return { indices, labels, labelMissing: new Uint8Array() };
    }
    for (let index = 0; index < names.length; index += 1) {
      const selector = index % value.length;
      if (isMissing(value, selector)) {
        indices.push(undefined);
        labels.push("");
        labelMissing.push(1);
      } else if (value.values[selector] === 1) {
        indices.push(index);
        labels.push(names[index] ?? "");
        labelMissing.push(0);
      }
    }
    return { indices, labels, labelMissing: Uint8Array.from(labelMissing) };
  }
  if (value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError(
      "NRT3265",
      "confint() parm must be a numeric, logical, or character subscript.",
    );
  }
  const supplied = Array.from({ length: value.length }, (_, index) =>
    isMissing(value, index) || Number.isNaN(value.values[index] ?? 0)
      ? undefined
      : Math.trunc(value.values[index] ?? 0),
  );
  const hasNegative = supplied.some((index) => index !== undefined && index < 0);
  const hasPositive = supplied.some((index) => index !== undefined && index > 0);
  if (hasNegative && hasPositive) {
    throw new REvaluationError("NRE2138", "Only 0's may be mixed with negative subscripts.");
  }
  if (hasNegative) {
    const excluded = new Set(
      supplied
        .filter((index): index is number => index !== undefined && index < 0)
        .map((index) => Math.abs(index) - 1),
    );
    const selected = names.map((_name, index) => index).filter((index) => !excluded.has(index));
    return {
      indices: selected,
      labels: selected.map((index) => names[index] ?? ""),
      labelMissing: new Uint8Array(selected.length),
    };
  }
  const indices = supplied
    .filter((index) => index !== 0)
    .map((index) =>
      index === undefined || index < 1 || index > names.length ? undefined : index - 1,
    );
  const labelMissing = Uint8Array.from(indices, (index) => (index === undefined ? 1 : 0));
  return {
    indices,
    labels: indices.map((index) => (index === undefined ? "" : (names[index] ?? ""))),
    labelMissing,
  };
}

function modelProbability(value: RValue, name: string): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3265", `${name} must be one non-missing probability.`);
  }
  const result = value.values[0] ?? Number.NaN;
  if (!Number.isFinite(result) || result < 0 || result > 1) {
    throw new RTypeMismatchError("NRT3265", `${name} must be between zero and one.`);
  }
  return result;
}

function modelPercentLabel(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(12).replace(/0+$/u, "").replace(/\.$/u, "");
}

function modelXLevels(model: RList): ReadonlyMap<string, readonly string[]> {
  const value = modelField(model, "xlevels");
  if (value?.type !== "list") return new Map();
  const names = vectorNames(value);
  const output = new Map<string, readonly string[]>();
  value.values.forEach((entry, index) => {
    const name = names?.[index];
    if (name !== undefined && entry.type === "character" && entry.missing === undefined) {
      output.set(name, entry.values);
    }
  });
  return output;
}

function compactModelMask(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((value) => value === 1) ? mask : undefined;
}

interface PrepareModelOptions {
  readonly formula: RFormula;
  readonly data?: RValue;
  readonly environment: REnvironment;
  readonly requireResponse: boolean;
  readonly omitMissing: boolean;
  readonly subset?: RValue;
  readonly weights?: RealVector;
  readonly offset?: RealVector;
  readonly xlevels: ReadonlyMap<string, readonly string[]>;
}

interface PreparedModelData {
  readonly terms: readonly string[];
  readonly variables: ReadonlyMap<string, AtomicVector>;
  readonly response?: RealVector;
  readonly responseName?: string;
  readonly rows: number;
  readonly rowNames: readonly string[];
  readonly originalRows: number;
  readonly selectedIndices: readonly number[];
  readonly omittedIndices: readonly number[];
  readonly weights?: Float64Array;
  readonly offset?: Float64Array;
}

async function prepareModelData(
  options: PrepareModelOptions,
  invocation: BuiltinInvocation,
): Promise<PreparedModelData> {
  const terms = expandDotTerms(options.formula, options.data);
  const labels = new Set<string>();
  for (const term of terms) {
    for (const component of modelTermComponents(term)) labels.add(component);
  }
  const variables = new Map<string, AtomicVector>();
  for (const label of labels) {
    variables.set(label, await evaluateModelLabel(label, options.environment, invocation));
  }

  let response: RealVector | undefined;
  if (options.requireResponse && options.formula.response !== undefined) {
    const value = await evaluateModelLabel(
      options.formula.response,
      options.environment,
      invocation,
    );
    response = modelRealVector(value, "response");
  } else if (options.requireResponse) {
    throw new RTypeMismatchError("NRT3265", "A fitted linear model requires a response.");
  }
  const lengths = [
    ...(response === undefined ? [] : [response.length]),
    ...[...variables.values()].map((value) => value.length),
  ];
  const dataRows =
    options.data !== undefined && isDataFrame(options.data)
      ? dataFrameRowCount(options.data)
      : undefined;
  const originalRows = lengths[0] ?? dataRows ?? 0;
  if (lengths.some((length) => length !== originalRows)) {
    throw new RTypeMismatchError("NRT3265", "Model variables have different row counts.");
  }
  validateModelAuxiliaryLength(options.weights, originalRows, "weights");
  validateModelAuxiliaryLength(options.offset, originalRows, "offset");

  const rowNames = modelRowNames(options.data, response, originalRows);
  const subsetIndices = resolveModelSubset(options.subset, originalRows, rowNames);
  const kept: number[] = [];
  const omitted: number[] = [];
  for (const index of subsetIndices) {
    invocation.context.checkpoint();
    const complete =
      (response === undefined || modelCellComplete(response, index)) &&
      [...variables.values()].every((value) => modelCellComplete(value, index)) &&
      (options.weights === undefined || modelCellComplete(options.weights, index)) &&
      (options.offset === undefined || modelCellComplete(options.offset, index));
    if (!complete && options.omitMissing) omitted.push(index);
    else kept.push(index);
  }
  if (options.requireResponse && kept.length === 0) {
    throw new REvaluationError("NRE2136", "0 (non-NA) cases");
  }
  if (options.weights !== undefined) {
    for (const index of kept) {
      const weight = realAt(options.weights, index);
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RTypeMismatchError("NRT3265", "lm() weights must be finite and non-negative.");
      }
    }
  }

  const oneBased = integerVector(kept.map((index) => index + 1));
  const filteredVariables = new Map<string, AtomicVector>();
  for (const [label, value] of variables) {
    filteredVariables.set(label, subsetVector(value, oneBased, invocation.context) as AtomicVector);
  }
  const filteredResponse =
    response === undefined
      ? undefined
      : (subsetVector(response, oneBased, invocation.context) as RealVector);
  return {
    terms,
    variables: filteredVariables,
    ...(filteredResponse === undefined ? {} : { response: filteredResponse }),
    ...(options.formula.response === undefined ? {} : { responseName: options.formula.response }),
    rows: kept.length,
    rowNames: kept.map((index) => rowNames[index] ?? String(index + 1)),
    originalRows,
    selectedIndices: kept,
    omittedIndices: omitted,
    ...(options.weights === undefined
      ? {}
      : { weights: Float64Array.from(kept, (index) => realAt(options.weights!, index)) }),
    ...(options.offset === undefined
      ? {}
      : { offset: Float64Array.from(kept, (index) => realAt(options.offset!, index)) }),
  };
}

function expandDotTerms(formula: RFormula, data: RValue | undefined): readonly string[] {
  if (!formula.terms.includes(".")) return formula.terms;
  if (data?.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "The '.' formula term requires named model data.");
  }
  const names = vectorNames(data);
  if (names === undefined) {
    throw new RTypeMismatchError("NRT3265", "The '.' formula term requires named model data.");
  }
  const expanded = names.filter((name) => name !== formula.response);
  return formula.terms.flatMap((term) => (term === "." ? expanded : [term]));
}

function modelTermComponents(term: string): readonly string[] {
  return term.split(":").map((component) => component.trim());
}

async function evaluateModelLabel(
  label: string,
  environment: REnvironment,
  invocation: BuiltinInvocation,
): Promise<AtomicVector> {
  const binding = /^[A-Za-z_.][A-Za-z0-9._]*$/u.test(label)
    ? lookupBinding(environment, label)
    : undefined;
  const value =
    binding === undefined
      ? await evaluateModelExpression(label, environment, invocation)
      : binding.type === "promise"
        ? await invocation.force(binding)
        : binding;
  if (
    value.type !== "logical" &&
    value.type !== "integer" &&
    value.type !== "double" &&
    value.type !== "character"
  ) {
    throw new RTypeMismatchError(
      "NRT3265",
      `Model term '${label}' must evaluate to a real atomic vector.`,
    );
  }
  if (vectorDimensions(value) !== undefined) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      `Matrix-valued model term '${label}' is not implemented yet.`,
    );
  }
  return value;
}

async function evaluateModelExpression(
  label: string,
  environment: REnvironment,
  invocation: BuiltinInvocation,
): Promise<RValue> {
  let program;
  try {
    program = invocation.parse(label, 1);
  } catch {
    throw new RTypeMismatchError("NRT3265", `Model term '${label}' cannot be evaluated.`);
  }
  const expression = program.body[0];
  if (expression === undefined) {
    throw new RTypeMismatchError("NRT3265", `Model term '${label}' is empty.`);
  }
  return invocation.evaluate({ type: "language", expression }, environment);
}

function validateModelAuxiliaryLength(
  value: RealVector | undefined,
  rows: number,
  name: string,
): void {
  if (value !== undefined && value.length !== rows) {
    throw new RTypeMismatchError(
      "NRT3265",
      `${name} has length ${value.length}, but the model frame has ${rows} rows.`,
    );
  }
}

function modelRowNames(
  data: RValue | undefined,
  response: RealVector | undefined,
  rows: number,
): readonly string[] {
  if (data !== undefined && isDataFrame(data)) {
    const rowNames = data.attributes.get("row.names");
    if (rowNames?.type === "character" && rowNames.length === rows) return rowNames.values;
  }
  const names = response === undefined ? undefined : vectorNames(response);
  return names ?? Array.from({ length: rows }, (_, index) => String(index + 1));
}

function resolveModelSubset(
  subset: RValue | undefined,
  rows: number,
  rowNames: readonly string[],
): readonly number[] {
  if (subset === undefined || subset.type === "null") {
    return Array.from({ length: rows }, (_, index) => index);
  }
  if (subset.type === "logical") {
    if (subset.length === 0) return [];
    return Array.from({ length: rows }, (_, index) => index).filter((index) => {
      const source = index % subset.length;
      return !isMissing(subset, source) && subset.values[source] === 1;
    });
  }
  if (subset.type === "character") {
    return subset.values.flatMap((name, index) => {
      if (isMissing(subset, index)) return [];
      const position = rowNames.indexOf(name);
      return position < 0 ? [] : [position];
    });
  }
  if (subset.type !== "integer" && subset.type !== "double") {
    throw new RTypeMismatchError(
      "NRT3265",
      "Model subset must be logical, numeric, character, or NULL.",
    );
  }
  const values = Array.from({ length: subset.length }, (_, index) =>
    isMissing(subset, index) ? 0 : Math.trunc(realAt(subset, index)),
  );
  const negative = values.some((value) => value < 0);
  if (negative && values.some((value) => value > 0)) {
    throw new RTypeMismatchError("NRT3265", "Only 0's may be mixed with negative subscripts.");
  }
  if (negative) {
    const excluded = new Set(values.filter((value) => value < 0).map((value) => -value - 1));
    return Array.from({ length: rows }, (_, index) => index).filter(
      (index) => !excluded.has(index),
    );
  }
  return values.filter((value) => value > 0 && value <= rows).map((value) => value - 1);
}

function modelCellComplete(value: AtomicVector | RealVector, index: number): boolean {
  if (isMissing(value, index)) return false;
  if (value.type === "double") return !Number.isNaN(value.values[index]);
  return true;
}

function realAt(value: RealVector, index: number): number {
  return value.values[index] ?? 0;
}

interface EncodedModelColumn {
  readonly name: string;
  readonly values: Float64Array;
  readonly missing?: Uint8Array;
}

interface EncodedModelTerm {
  readonly columns: readonly EncodedModelColumn[];
  readonly factorLevels: ReadonlyMap<string, readonly string[]>;
  readonly contrasts: ReadonlySet<string>;
}

interface ModelMatrixResult {
  readonly matrix: RDoubleVector;
  readonly rows: number;
  readonly columns: number;
  readonly columnNames: readonly string[];
  readonly assign: readonly number[];
  readonly xlevels: ReadonlyMap<string, readonly string[]>;
  readonly contrasts: ReadonlySet<string>;
}

function buildModelMatrix(
  data: PreparedModelData,
  formula: RFormula,
  knownLevels: ReadonlyMap<string, readonly string[]>,
  invocation: BuiltinInvocation,
): ModelMatrixResult {
  const columns: EncodedModelColumn[] = [];
  const assign: number[] = [];
  const xlevels = new Map<string, readonly string[]>(knownLevels);
  const contrasts = new Set<string>();
  if (formula.intercept) {
    columns.push({ name: "(Intercept)", values: new Float64Array(data.rows).fill(1) });
    assign.push(0);
  }
  for (const [termIndex, term] of data.terms.entries()) {
    const encoded = encodeModelTerm(
      term,
      data,
      knownLevels,
      !formula.intercept && termIndex === 0,
      invocation,
    );
    for (const [name, levels] of encoded.factorLevels) xlevels.set(name, levels);
    for (const name of encoded.contrasts) contrasts.add(name);
    columns.push(...encoded.columns);
    assign.push(...encoded.columns.map(() => termIndex + 1));
  }
  invocation.context.allocate(data.rows * columns.length + columns.length);
  const values = new Float64Array(data.rows * columns.length);
  const missing = new Uint8Array(values.length);
  for (const [columnIndex, column] of columns.entries()) {
    for (let row = 0; row < data.rows; row += 1) {
      invocation.context.checkpoint();
      const index = row + columnIndex * data.rows;
      values[index] = column.values[row] ?? 0;
      if (column.missing?.[row] === 1) missing[index] = 1;
    }
  }
  const columnNames = columns.map((column) => column.name);
  let matrix = withDimensions(doubleVector(values, compactModelMask(missing)), [
    data.rows,
    columns.length,
  ]);
  matrix = withAttribute(
    matrix,
    "dimnames",
    listValue([characterVector(data.rowNames), characterVector(columnNames)]),
  );
  matrix = withAttribute(matrix, "assign", integerVector(assign));
  if (contrasts.size > 0) {
    matrix = withAttribute(
      matrix,
      "contrasts",
      listValue(
        [...contrasts].map(() => characterVector(["contr.treatment"])),
        [...contrasts],
      ),
    );
  }
  return {
    matrix,
    rows: data.rows,
    columns: columns.length,
    columnNames,
    assign,
    xlevels,
    contrasts,
  };
}

function encodeModelTerm(
  term: string,
  data: PreparedModelData,
  knownLevels: ReadonlyMap<string, readonly string[]>,
  fullFactor: boolean,
  invocation: BuiltinInvocation,
): EncodedModelTerm {
  const components = modelTermComponents(term);
  let current = encodeModelComponent(
    components[0] ?? term,
    data,
    knownLevels,
    fullFactor,
    invocation,
  );
  for (const component of components.slice(1)) {
    const right = encodeModelComponent(component, data, knownLevels, false, invocation);
    const combined: EncodedModelColumn[] = [];
    for (const leftColumn of current.columns) {
      for (const rightColumn of right.columns) {
        const values = new Float64Array(data.rows);
        const missing = new Uint8Array(data.rows);
        for (let row = 0; row < data.rows; row += 1) {
          if (leftColumn.missing?.[row] === 1 || rightColumn.missing?.[row] === 1) {
            missing[row] = 1;
          } else {
            values[row] = (leftColumn.values[row] ?? 0) * (rightColumn.values[row] ?? 0);
          }
        }
        combined.push({
          name: `${leftColumn.name}:${rightColumn.name}`,
          values,
          ...(compactModelMask(missing) === undefined ? {} : { missing }),
        });
      }
    }
    current = {
      columns: combined,
      factorLevels: new Map([...current.factorLevels, ...right.factorLevels]),
      contrasts: new Set([...current.contrasts, ...right.contrasts]),
    };
  }
  return current;
}

function encodeModelComponent(
  label: string,
  data: PreparedModelData,
  knownLevels: ReadonlyMap<string, readonly string[]>,
  fullFactor: boolean,
  invocation: BuiltinInvocation,
): EncodedModelTerm {
  const value = data.variables.get(label);
  if (value === undefined) {
    throw new RTypeMismatchError("NRT3265", `Model term '${label}' is unavailable.`);
  }
  if (value.type === "integer" && isFactor(value)) {
    return encodeFactorComponent(
      label,
      value,
      factorLevels(value),
      knownLevels.get(label),
      fullFactor,
      invocation,
    );
  }
  if (value.type === "character") {
    const observed = knownLevels.get(label) ?? modelCharacterLevels(value);
    const codes = new Int32Array(value.length);
    const missing = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (isMissing(value, index)) {
        missing[index] = 1;
        continue;
      }
      const level = value.values[index] ?? "";
      const position = observed.indexOf(level);
      if (position < 0) {
        throw new RTypeMismatchError("NRT3265", `factor '${label}' has new level '${level}'`);
      }
      codes[index] = position + 1;
    }
    return encodeFactorComponent(
      label,
      factorValue(codes, observed, compactModelMask(missing)),
      observed,
      observed,
      fullFactor,
      invocation,
    );
  }
  if (value.type === "logical") {
    const observedLogical = new Set<string>(
      Array.from({ length: value.length }, (_, index) =>
        isMissing(value, index) ? undefined : value.values[index] === 1 ? "TRUE" : "FALSE",
      ).filter((entry): entry is "TRUE" | "FALSE" => entry !== undefined),
    );
    const levels = ["FALSE", "TRUE"].filter((level) => observedLogical.has(level));
    const codes = Int32Array.from(
      value.values,
      (entry) => levels.indexOf(entry === 1 ? "TRUE" : "FALSE") + 1,
    );
    return encodeFactorComponent(
      label,
      factorValue(codes, levels, value.missing),
      levels,
      knownLevels.get(label),
      fullFactor,
      invocation,
    );
  }
  const values = Float64Array.from(value.values);
  return {
    columns: [
      {
        name: label,
        values,
        ...(value.missing === undefined ? {} : { missing: Uint8Array.from(value.missing) }),
      },
    ],
    factorLevels: new Map(),
    contrasts: new Set(),
  };
}

function modelCharacterLevels(value: RCharacterVector): readonly string[] {
  return [...new Set(value.values.filter((_entry, index) => !isMissing(value, index)))].sort();
}

function encodeFactorComponent(
  label: string,
  value: RIntegerVector,
  observedLevels: readonly string[],
  expectedLevels: readonly string[] | undefined,
  fullFactor: boolean,
  invocation: BuiltinInvocation,
): EncodedModelTerm {
  const levels = expectedLevels ?? observedLevels;
  if (levels.length < 2 && !fullFactor) {
    throw new RTypeMismatchError(
      "NRT3265",
      "contrasts can be applied only to factors with 2 or more levels",
    );
  }
  const selected = fullFactor ? levels : levels.slice(1);
  const columns = selected.map((level) => {
    const values = new Float64Array(value.length);
    const missing = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      invocation.context.checkpoint();
      if (isMissing(value, index)) {
        missing[index] = 1;
        continue;
      }
      const sourceLevel = observedLevels[(value.values[index] ?? 0) - 1];
      const position = sourceLevel === undefined ? -1 : levels.indexOf(sourceLevel);
      if (position < 0) {
        throw new RTypeMismatchError(
          "NRT3265",
          `factor '${label}' has new level '${sourceLevel ?? ""}'`,
        );
      }
      values[index] = sourceLevel === level ? 1 : 0;
    }
    return {
      name: `${label}${level}`,
      values,
      ...(compactModelMask(missing) === undefined ? {} : { missing }),
    };
  });
  return {
    columns,
    factorLevels: new Map([[label, levels]]),
    contrasts: new Set([label]),
  };
}

interface LeastSquaresResult {
  readonly coefficients: Float64Array;
  readonly coefficientMissing?: Uint8Array;
  readonly fitted: Float64Array;
  readonly residuals: Float64Array;
  readonly effects: Float64Array;
  readonly rank: number;
  readonly pivot: readonly number[];
  readonly r: readonly Float64Array[];
  readonly qraux: Float64Array;
}

async function fitLinearModel(
  options: LinearModelOptions,
  invocation: BuiltinInvocation,
): Promise<RValue> {
  const prepared = await prepareModelData(
    {
      formula: options.formula,
      ...(options.data === undefined ? {} : { data: options.data }),
      environment: options.dataEnvironment,
      requireResponse: true,
      omitMissing: true,
      ...(options.subset === undefined ? {} : { subset: options.subset }),
      ...(options.weights === undefined ? {} : { weights: options.weights }),
      ...(options.offset === undefined ? {} : { offset: options.offset }),
      xlevels: new Map(),
    },
    invocation,
  );
  const response = prepared.response;
  if (response === undefined) {
    throw new Error("Internal linear-model response invariant failed.");
  }
  for (let index = 0; index < response.length; index += 1) {
    const value = realAt(response, index);
    if (!Number.isFinite(value)) {
      throw new RTypeMismatchError("NRT3265", "NA/NaN/Inf in the response.");
    }
  }
  const modelFormula: RFormula = {
    ...options.formula,
    terms: prepared.terms,
    variables: [
      ...(options.formula.response === undefined ? [] : [options.formula.response]),
      ...new Set(prepared.terms.flatMap(modelTermComponents)),
    ],
  };
  const design = buildModelMatrix(prepared, modelFormula, new Map(), invocation);
  if (design.columns === 0) {
    throw new RTypeMismatchError("NRT3265", "The model matrix has no columns.");
  }
  const responseValues = Float64Array.from({ length: response.length }, (_, index) =>
    realAt(response, index),
  );
  const solved = solveLeastSquares(
    design.matrix.values,
    design.rows,
    design.columns,
    responseValues,
    prepared.weights,
    prepared.offset,
    invocation,
  );
  if (!options.singularOk && solved.rank < design.columns) {
    throw new REvaluationError("NRE2137", "singular fit encountered");
  }

  const coefficients = withNames(
    doubleVector(solved.coefficients, solved.coefficientMissing),
    design.columnNames,
  );
  const fitted = withNames(doubleVector(solved.fitted), prepared.rowNames);
  const residuals = withNames(doubleVector(solved.residuals), prepared.rowNames);
  const effectNames = Array.from({ length: design.rows }, (_, index) =>
    index < design.columnNames.length ? (design.columnNames[index] ?? "") : "",
  );
  const effects = withNames(doubleVector(solved.effects), effectNames);
  const assign = integerVector(design.assign);
  const qr = linearModelQr(design, solved);
  const xlevels = listValue(
    [...design.xlevels.values()].map((levels) => characterVector(levels)),
    [...design.xlevels.keys()],
  );
  const contrasts =
    design.contrasts.size === 0
      ? undefined
      : listValue(
          [...design.contrasts].map(() => characterVector(["contr.treatment"])),
          [...design.contrasts],
        );
  const naAction =
    prepared.omittedIndices.length === 0
      ? undefined
      : withClasses(
          withNames(
            integerVector(prepared.omittedIndices.map((index) => index + 1)),
            prepared.omittedIndices.map(
              (index) =>
                modelRowNames(options.data, undefined, prepared.originalRows)[index] ??
                String(index + 1),
            ),
          ),
          ["omit"],
        );
  const model = buildModelFrame(prepared, modelFormula, design.xlevels, naAction, invocation);

  const fields: { readonly name: string; readonly value: RValue }[] = [
    { name: "coefficients", value: coefficients },
    { name: "residuals", value: residuals },
    { name: "effects", value: effects },
    { name: "rank", value: integerVector([solved.rank]) },
    { name: "fitted.values", value: fitted },
    { name: "assign", value: assign },
  ];
  if (options.keepQr) fields.push({ name: "qr", value: qr });
  fields.push({ name: "df.residual", value: integerVector([design.rows - solved.rank]) });
  if (contrasts !== undefined) fields.push({ name: "contrasts", value: contrasts });
  fields.push(
    { name: "xlevels", value: xlevels },
    { name: "call", value: options.call },
    { name: "terms", value: modelFormula },
  );
  if (options.keepModel) fields.push({ name: "model", value: model });
  if (options.keepX) fields.push({ name: "x", value: design.matrix });
  if (options.keepY) fields.push({ name: "y", value: response });
  if (naAction !== undefined) fields.push({ name: "na.action", value: naAction });
  if (prepared.weights !== undefined) {
    fields.push({ name: "weights", value: doubleVector(prepared.weights) });
  }
  if (prepared.offset !== undefined) {
    fields.push({ name: "offset", value: doubleVector(prepared.offset) });
  }
  invocation.context.allocate(fields.length);
  return withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    options.aov ? ["aov", "lm"] : ["lm"],
  );
}

function solveLeastSquares(
  matrix: Float64Array,
  rows: number,
  columns: number,
  response: Float64Array,
  weights: Float64Array | undefined,
  offset: Float64Array | undefined,
  invocation: BuiltinInvocation,
  tolerance = 1e-7,
): LeastSquaresResult {
  invocation.context.allocate(rows * columns * 2 + rows * 5 + columns * columns);
  const work = Array.from({ length: columns }, (_, column) =>
    Float64Array.from({ length: rows }, (_unused, row) => {
      const weight = Math.sqrt(weights?.[row] ?? 1);
      return (matrix[row + column * rows] ?? 0) * weight;
    }),
  );
  const weightedResponse = Float64Array.from({ length: rows }, (_unused, row) => {
    const weight = Math.sqrt(weights?.[row] ?? 1);
    return ((response[row] ?? 0) - (offset?.[row] ?? 0)) * weight;
  });
  const pivot = Array.from({ length: columns }, (_, index) => index);
  const r = Array.from({ length: columns }, () => new Float64Array(columns));
  const q: Float64Array[] = [];
  const effects = new Float64Array(rows);
  const qraux = new Float64Array(columns);
  let rank = 0;
  let referenceNorm = 0;

  for (let step = 0; step < columns; step += 1) {
    let selected = step;
    let selectedNorm = vectorNorm(work[step] ?? new Float64Array());
    const threshold = tolerance * Math.max(1, referenceNorm);
    if ((step === 0 && selectedNorm === 0) || (step > 0 && selectedNorm <= threshold)) {
      for (let candidate = step + 1; candidate < columns; candidate += 1) {
        const norm = vectorNorm(work[candidate] ?? new Float64Array());
        if (norm > selectedNorm) {
          selectedNorm = norm;
          selected = candidate;
        }
      }
    }
    if (selected !== step) {
      [work[step], work[selected]] = [work[selected]!, work[step]!];
      [pivot[step], pivot[selected]] = [pivot[selected]!, pivot[step]!];
      for (let previous = 0; previous < step; previous += 1) {
        const row = r[previous]!;
        [row[step], row[selected]] = [row[selected] ?? 0, row[step] ?? 0];
      }
    }
    if (step === 0) referenceNorm = selectedNorm;
    if (!Number.isFinite(selectedNorm) || selectedNorm <= tolerance * Math.max(1, referenceNorm)) {
      break;
    }
    const vector = work[step]!;
    const unit = Float64Array.from(vector, (value) => value / selectedNorm);
    q.push(unit);
    r[step]![step] = selectedNorm;
    qraux[step] = selectedNorm;
    effects[step] = dotProduct(unit, weightedResponse);
    for (let candidate = step + 1; candidate < columns; candidate += 1) {
      const candidateVector = work[candidate]!;
      const projection = dotProduct(unit, candidateVector);
      r[step]![candidate] = projection;
      for (let row = 0; row < rows; row += 1) {
        candidateVector[row] = (candidateVector[row] ?? 0) - projection * (unit[row] ?? 0);
      }
    }
    rank += 1;
  }

  const pivoted = new Float64Array(columns);
  for (let row = rank - 1; row >= 0; row -= 1) {
    let value = effects[row] ?? 0;
    for (let column = row + 1; column < rank; column += 1) {
      value -= (r[row]?.[column] ?? 0) * (pivoted[column] ?? 0);
    }
    pivoted[row] = value / (r[row]?.[row] ?? 1);
  }
  const coefficients = new Float64Array(columns);
  const coefficientMissing = new Uint8Array(columns);
  for (let index = 0; index < columns; index += 1) {
    const original = pivot[index] ?? index;
    if (index < rank) coefficients[original] = pivoted[index] ?? 0;
    else coefficientMissing[original] = 1;
  }

  const fitted = new Float64Array(rows);
  const residuals = new Float64Array(rows);
  for (let row = 0; row < rows; row += 1) {
    invocation.context.checkpoint();
    let prediction = offset?.[row] ?? 0;
    for (let column = 0; column < columns; column += 1) {
      if (coefficientMissing[column] === 1) continue;
      prediction += (matrix[row + column * rows] ?? 0) * (coefficients[column] ?? 0);
    }
    fitted[row] = prediction;
    const residual = (response[row] ?? 0) - prediction;
    const zeroTolerance =
      8 * Number.EPSILON * Math.max(1, Math.abs(response[row] ?? 0), Math.abs(prediction));
    residuals[row] = Math.abs(residual) <= zeroTolerance ? 0 : residual;
  }
  for (let index = rank; index < rows; index += 1) {
    effects[index] = (residuals[index] ?? 0) * Math.sqrt(weights?.[index] ?? 1);
  }
  const compactCoefficientMissing = compactModelMask(coefficientMissing);
  return {
    coefficients,
    ...(compactCoefficientMissing === undefined
      ? {}
      : { coefficientMissing: compactCoefficientMissing }),
    fitted,
    residuals,
    effects,
    rank,
    pivot,
    r,
    qraux,
  };
}

function vectorNorm(value: Float64Array): number {
  let scale = 0;
  let sum = 1;
  for (const item of value) {
    const absolute = Math.abs(item);
    if (absolute === 0) continue;
    if (scale < absolute) {
      sum = 1 + sum * (scale / absolute) ** 2;
      scale = absolute;
    } else {
      sum += (absolute / scale) ** 2;
    }
  }
  return scale === 0 ? 0 : scale * Math.sqrt(sum);
}

function dotProduct(left: Float64Array, right: Float64Array): number {
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return result;
}

function linearModelQr(design: ModelMatrixResult, solved: LeastSquaresResult): RList {
  const qrValues = new Float64Array(design.rows * design.columns);
  for (let pivotColumn = 0; pivotColumn < design.columns; pivotColumn += 1) {
    for (let row = 0; row <= Math.min(pivotColumn, solved.rank - 1); row += 1) {
      qrValues[row + pivotColumn * design.rows] = solved.r[row]?.[pivotColumn] ?? 0;
    }
  }
  let qrMatrix = withDimensions(doubleVector(qrValues), [design.rows, design.columns]);
  const dimensionNames = design.matrix.attributes.get("dimnames");
  const rowNames = dimensionNames?.type === "list" ? (dimensionNames.values[0] ?? R_NULL) : R_NULL;
  qrMatrix = withAttribute(
    qrMatrix,
    "dimnames",
    listValue([
      rowNames,
      characterVector(solved.pivot.map((index) => design.columnNames[index] ?? "")),
    ]),
  );
  return withClasses(
    listValue(
      [
        qrMatrix,
        doubleVector(solved.qraux),
        integerVector(solved.pivot.map((index) => index + 1)),
        doubleVector([1e-7]),
        integerVector([solved.rank]),
      ],
      ["qr", "qraux", "pivot", "tol", "rank"],
    ),
    ["qr"],
  );
}

function leastSquaresFitQr(
  design: ModelMatrixResult,
  solved: LeastSquaresResult,
  tolerance: number,
): RList {
  const qrValues = new Float64Array(design.rows * design.columns);
  for (let pivotColumn = 0; pivotColumn < design.columns; pivotColumn += 1) {
    for (let row = 0; row <= Math.min(pivotColumn, solved.rank - 1); row += 1) {
      qrValues[row + pivotColumn * design.rows] = solved.r[row]?.[pivotColumn] ?? 0;
    }
  }
  let qrMatrix = withDimensions(doubleVector(qrValues), [design.rows, design.columns]);
  qrMatrix = withAttribute(
    qrMatrix,
    "dimnames",
    design.matrix.attributes.get("dimnames") ?? R_NULL,
  );
  return withClasses(
    listValue(
      [
        doubleVector(solved.effects),
        qrMatrix,
        doubleVector(solved.qraux),
        integerVector([solved.rank]),
        integerVector(solved.pivot.map((index) => index + 1)),
        doubleVector([tolerance]),
      ],
      ["qt", "qr", "qraux", "rank", "pivot", "tol"],
    ),
    ["qr"],
  );
}

function buildModelFrame(
  prepared: PreparedModelData,
  formula: RFormula,
  xlevels: ReadonlyMap<string, readonly string[]>,
  naAction: RIntegerVector | undefined,
  invocation: BuiltinInvocation,
): RList {
  const names: string[] = [];
  const columns: RVector[] = [];
  if (prepared.response !== undefined && prepared.responseName !== undefined) {
    names.push(prepared.responseName);
    columns.push(prepared.response);
  }
  for (const label of new Set(prepared.terms.flatMap(modelTermComponents))) {
    const value = prepared.variables.get(label);
    if (value === undefined) continue;
    names.push(label);
    columns.push(modelFrameColumn(label, value, xlevels, invocation));
  }
  let frame = dataFrameValue(columns, names, prepared.rowNames);
  frame = withAttribute(frame, "terms", formula);
  if (naAction !== undefined) frame = withAttribute(frame, "na.action", naAction);
  return frame;
}

function modelFrameColumn(
  label: string,
  value: AtomicVector,
  xlevels: ReadonlyMap<string, readonly string[]>,
  invocation: BuiltinInvocation,
): RVector {
  if (value.type !== "character") return value;
  const levels = xlevels.get(label) ?? modelCharacterLevels(value);
  const codes = new Int32Array(value.length);
  const missing = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(value, index)) {
      missing[index] = 1;
      continue;
    }
    codes[index] = levels.indexOf(value.values[index] ?? "") + 1;
  }
  return factorValue(codes, levels, compactModelMask(missing));
}
