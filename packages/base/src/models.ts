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
  objectClasses,
  pairlistValue,
  setBinding,
  subsetDimensions,
  subsetVector,
  vectorClasses,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
  withoutAttribute,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";
import { symmetricEigenDecomposition } from "./eigen.js";
import {
  logGamma,
  normalProbability,
  normalQuantile,
  regularizedBeta,
  regularizedGammaProbability,
  studentTProbability,
  studentTQuantile,
} from "./student-t.js";
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
    name: "is.empty.model",
    parameters: ["x"],
    compatibility: "behavioral",
    implementation: builtinIsEmptyModel,
  },
  {
    name: "glm.control",
    parameters: ["epsilon", "maxit", "trace"],
    compatibility: "behavioral",
    implementation: builtinGlmControl,
  },
  {
    name: "make.link",
    parameters: ["link"],
    compatibility: "behavioral",
    implementation: builtinMakeLink,
  },
  {
    name: "contrasts",
    parameters: ["x", "contrasts", "sparse"],
    compatibility: "behavioral",
    implementation: builtinContrasts,
  },
  {
    name: "contr.sum",
    parameters: ["n", "contrasts", "sparse"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinContrastGenerator(invocation, "sum"),
  },
  {
    name: "contr.treatment",
    parameters: ["n", "base", "contrasts", "sparse"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinContrastGenerator(invocation, "treatment"),
  },
  {
    name: "contr.helmert",
    parameters: ["n", "contrasts", "sparse"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinContrastGenerator(invocation, "helmert"),
  },
  {
    name: "gaussian",
    parameters: ["link"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinGlmFamily(invocation, "gaussian"),
  },
  {
    name: "binomial",
    parameters: ["link"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinGlmFamily(invocation, "binomial"),
  },
  {
    name: "quasibinomial",
    parameters: ["link"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinGlmFamily(invocation, "quasibinomial"),
  },
  {
    name: "poisson",
    parameters: ["link"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinGlmFamily(invocation, "poisson"),
  },
  {
    name: "quasipoisson",
    parameters: ["link"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinGlmFamily(invocation, "quasipoisson"),
  },
  {
    name: "Gamma",
    parameters: ["link"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinGlmFamily(invocation, "Gamma"),
  },
  {
    name: "glm",
    parameters: [
      "formula",
      "family",
      "data",
      "weights",
      "subset",
      "na.action",
      "start",
      "etastart",
      "mustart",
      "offset",
      "control",
      "model",
      "method",
      "x",
      "y",
      "singular.ok",
      "contrasts",
      "...",
    ],
    compatibility: "behavioral",
    implementation: builtinGeneralizedLinearModel,
  },
  {
    name: "glm.fit",
    parameters: [
      "x",
      "y",
      "weights",
      "start",
      "etastart",
      "mustart",
      "offset",
      "family",
      "control",
      "intercept",
      "singular.ok",
    ],
    compatibility: "numeric",
    implementation: builtinGeneralizedLinearModelFit,
  },
  {
    name: "summary.glm",
    parameters: ["object", "dispersion", "correlation", "symbolic.cor", "..."],
    compatibility: "behavioral",
    implementation: builtinGlmSummary,
  },
  {
    name: "anova.glm",
    parameters: ["object", "...", "dispersion", "test"],
    compatibility: "behavioral",
    implementation: builtinGlmAnova,
  },
  {
    name: "residuals.glm",
    parameters: ["object", "type", "..."],
    compatibility: "behavioral",
    implementation: builtinGlmResiduals,
  },
  {
    name: "logLik.glm",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinGlmLogLikelihood,
  },
  {
    name: "family.glm",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinGlmFamilyAccessor,
  },
  {
    name: "family.lm",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => buildGlmFamilyObject("gaussian", "identity", invocation),
  },
  {
    name: "nobs",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelNobs(invocation, true),
  },
  {
    name: "nobs.default",
    parameters: ["object", "use.fallback", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelNobs(invocation, false),
  },
  {
    name: "nobs.lm",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinLinearModelNobs,
  },
  {
    name: "deviance",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelDeviance(invocation, true),
  },
  {
    name: "deviance.glm",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelDeviance(invocation, false),
  },
  {
    name: "prcomp",
    parameters: ["x", "retx", "center", "scale.", "tol", "rank.", "..."],
    compatibility: "numeric",
    implementation: builtinPrincipalComponents,
  },
  {
    name: "summary.prcomp",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinPrincipalComponentsSummary,
  },
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
    name: "lm.fit",
    parameters: ["x", "y", "offset", "method", "tol", "singular.ok", "..."],
    compatibility: "numeric",
    implementation: builtinLinearModelFit,
  },
  {
    name: "lm.influence",
    parameters: ["model", "do.coef"],
    compatibility: "numeric",
    implementation: builtinLinearModelInfluence,
  },
  {
    name: "hatvalues.lm",
    parameters: ["model", "infl", "..."],
    compatibility: "numeric",
    implementation: builtinHatValuesLm,
  },
  {
    name: "summary.lm",
    parameters: ["object", "correlation", "symbolic.cor", "..."],
    compatibility: "behavioral",
    implementation: builtinLinearModelSummary,
  },
  {
    name: "dummy.coef.lm",
    parameters: ["object", "use.na", "..."],
    compatibility: "behavioral",
    implementation: builtinDummyCoefLm,
  },
  {
    name: "aov",
    parameters: ["formula", "data", "projections", "qr", "contrasts", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinLinearModel(invocation, true),
  },
  {
    name: "TukeyHSD",
    parameters: ["x", "which", "ordered", "conf.level", "..."],
    compatibility: "numeric",
    implementation: builtinTukeyHsdGeneric,
  },
  {
    name: "TukeyHSD.aov",
    parameters: ["x", "which", "ordered", "conf.level", "..."],
    compatibility: "numeric",
    implementation: builtinTukeyHsdAov,
  },
  {
    name: "anova.lm",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinLinearModelAnova,
  },
  {
    name: "anova.aov",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinLinearModelAnova,
  },
  {
    name: "summary.aov",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinAovSummary,
  },
  {
    name: "summary.aovlist",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: builtinAovListSummary,
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
    name: "predict.loess",
    parameters: ["object", "newdata", "se", "na.action", "..."],
    compatibility: "numeric",
    implementation: builtinPredictLoess,
  },
  {
    name: "model.matrix",
    parameters: ["object", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelMatrix(invocation, true),
  },
  {
    name: "model.matrix.default",
    parameters: ["object", "data", "contrasts.arg", "xlev", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinModelMatrix(invocation, false),
  },
  {
    name: "model.frame",
    parameters: ["formula", "..."],
    compatibility: "behavioral",
    implementation: builtinModelFrame,
  },
  {
    name: "model.response",
    parameters: ["data", "type"],
    compatibility: "behavioral",
    implementation: builtinModelResponse,
  },
  {
    name: "model.weights",
    parameters: ["x"],
    compatibility: "behavioral",
    implementation: builtinModelFrameWeights,
  },
  {
    name: "terms",
    parameters: ["x", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinTerms(invocation, true),
  },
  {
    name: "terms.formula",
    parameters: [
      "x",
      "specials",
      "abb",
      "data",
      "neg.out",
      "keep.order",
      "simplify",
      "...",
      "allowDotAsName",
    ],
    compatibility: "behavioral",
    implementation: builtinTermsFormula,
  },
  {
    name: "terms.default",
    parameters: ["x", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinTerms(invocation, false),
  },
  {
    name: "delete.response",
    parameters: ["termobj"],
    compatibility: "behavioral",
    implementation: builtinDeleteResponse,
  },
  {
    name: "drop.terms",
    parameters: ["termobj", "dropx", "keep.response"],
    compatibility: "behavioral",
    implementation: builtinDropTerms,
  },
  {
    name: "offset",
    parameters: ["object"],
    compatibility: "behavioral",
    implementation: builtinOffset,
  },
  {
    name: "model.offset",
    parameters: ["x"],
    compatibility: "behavioral",
    implementation: builtinModelOffset,
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
    name: "vcov.glm",
    parameters: ["object", "complete", "..."],
    compatibility: "numeric",
    implementation: (invocation) => builtinModelCovariance(invocation, "glm"),
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

async function builtinIsEmptyModel(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x"]);
  const argument = parsed.matched.get("x");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in is.empty.model().");
  }
  const input = await invocation.force(argument.promise);
  if (input.type === "formula") return logicalVector([isEmptyFormulaModel(input) ? 1 : 0]);
  if (input.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "$ operator is invalid for atomic vectors");
  }
  const terms = modelField(input, "terms") ?? input.attributes.get("terms");
  if (terms === undefined || terms.type === "null") {
    throw new REvaluationError("NRE2001", "no terms component nor attribute");
  }
  if (terms.type !== "formula" || objectClasses(terms)?.includes("terms") !== true) {
    return logicalVector([]);
  }
  return logicalVector([isEmptyFormulaModel(terms) ? 1 : 0]);
}

function isEmptyFormulaModel(formula: RFormula): boolean {
  return formula.terms.length === 0 && !formula.intercept;
}

async function builtinGlmControl(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["epsilon", "maxit", "trace"]);
  const epsilonArgument = matched.get("epsilon");
  const maxitArgument = matched.get("maxit");
  const traceArgument = matched.get("trace");
  const epsilon =
    epsilonArgument === undefined || epsilonArgument.promise.missing
      ? doubleVector([1e-8])
      : await invocation.force(epsilonArgument.promise);
  const maxit =
    maxitArgument === undefined || maxitArgument.promise.missing
      ? doubleVector([25])
      : await invocation.force(maxitArgument.promise);
  const trace =
    traceArgument === undefined || traceArgument.promise.missing
      ? logicalVector([false])
      : await invocation.force(traceArgument.promise);
  if (modelScalarValue(epsilon, "epsilon") <= 0) {
    throw new RTypeMismatchError("NRT3265", "value of 'epsilon' must be > 0");
  }
  if (modelScalarValue(maxit, "maxit") <= 0) {
    throw new RTypeMismatchError("NRT3265", "maximum number of iterations must be > 0");
  }
  if (
    (trace.type !== "logical" && trace.type !== "integer" && trace.type !== "double") ||
    trace.length !== 1
  ) {
    throw new RTypeMismatchError("NRT3265", "'trace' must be one logical value");
  }
  return listValue([epsilon, maxit, trace], ["epsilon", "maxit", "trace"]);
}

async function builtinContrasts(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x", "contrasts", "sparse"]);
  const argument = parsed.matched.get("x");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in contrasts().");
  }
  const value = await invocation.force(argument.promise);
  if (!isFactor(value)) {
    throw new RTypeMismatchError("NRT3265", "contrasts apply only to factors");
  }
  const levels = factorLevels(value);
  if (levels.length < 2) {
    throw new REvaluationError("NRE2255", "contrasts not defined for 0 degrees of freedom");
  }
  const useContrasts = await contrastLogicalArgument(
    invocation,
    parsed.matched.get("contrasts"),
    true,
    "contrasts",
  );
  await rejectSparseContrasts(invocation, parsed.matched.get("sparse"));
  if (!useContrasts) return contrastIdentity(levels);

  const declared = value.attributes.get("contrasts");
  if (declared !== undefined) {
    if (
      (declared.type === "logical" || declared.type === "integer" || declared.type === "double") &&
      vectorDimensions(declared)?.length === 2
    ) {
      return declared;
    }
    if (declared.type === "character" && declared.length === 1 && !isMissing(declared, 0)) {
      const generator = declared.values[0];
      if (generator === "contr.sum") return contrastSum(levels, true);
      if (generator === "contr.treatment") return contrastTreatment(levels, 1, true);
      if (generator === "contr.helmert") return contrastHelmert(levels, true);
      throw new RUnsupportedFeatureError(
        "NRU6130",
        `Factor contrast generator '${generator}' is not implemented.`,
      );
    }
    throw new RTypeMismatchError("NRT3265", "invalid contrasts attribute");
  }
  if (vectorClasses(value)?.includes("ordered") === true) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "Default polynomial contrasts for ordered factors are not implemented.",
    );
  }
  return contrastTreatment(levels, 1, true);
}

async function builtinContrastGenerator(
  invocation: BuiltinInvocation,
  kind: "sum" | "treatment" | "helmert",
): Promise<RValue> {
  const parameters =
    kind === "sum" ? ["n", "contrasts", "sparse"] : ["n", "base", "contrasts", "sparse"];
  const parsed = matchBuiltinArguments(invocation, parameters);
  const nArgument = parsed.matched.get("n");
  if (nArgument === undefined || nArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'n' is missing in contrast generator.");
  }
  const levels = contrastLevels(await invocation.force(nArgument.promise));
  if (levels.length < 2) {
    throw new REvaluationError("NRE2255", "not enough degrees of freedom to define contrasts");
  }
  const useContrasts = await contrastLogicalArgument(
    invocation,
    parsed.matched.get("contrasts"),
    true,
    "contrasts",
  );
  await rejectSparseContrasts(invocation, parsed.matched.get("sparse"));
  if (kind === "sum") return contrastSum(levels, useContrasts);
  if (kind === "helmert") return contrastHelmert(levels, useContrasts);
  const baseArgument = parsed.matched.get("base");
  const base =
    baseArgument === undefined || baseArgument.promise.missing
      ? 1
      : contrastBase(await invocation.force(baseArgument.promise), levels);
  return contrastTreatment(levels, base, useContrasts);
}

function contrastLevels(value: RValue): readonly string[] {
  if (value.type === "character") {
    if (value.length < 2 || value.missing !== undefined) {
      throw new RTypeMismatchError("NRT3265", "invalid contrast level names");
    }
    return value.values;
  }
  if (
    (value.type === "logical" || value.type === "integer" || value.type === "double") &&
    value.length === 1 &&
    !isMissing(value, 0)
  ) {
    const count = Number(value.values[0]);
    if (Number.isSafeInteger(count) && count >= 2) {
      return Array.from({ length: count }, (_, index) => String(index + 1));
    }
  }
  throw new RTypeMismatchError("NRT3265", "invalid number of contrast levels");
}

function contrastBase(value: RValue, levels: readonly string[]): number {
  if (
    (value.type === "logical" || value.type === "integer" || value.type === "double") &&
    value.length === 1 &&
    !isMissing(value, 0)
  ) {
    const base = Number(value.values[0]);
    if (Number.isSafeInteger(base) && base >= 1 && base <= levels.length) return base;
  }
  throw new RTypeMismatchError("NRT3265", "baseline group number out of range");
}

async function contrastLogicalArgument(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3265", `${name} must be TRUE or FALSE`);
  }
  return value.values[0] === 1;
}

async function rejectSparseContrasts(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<void> {
  if ((await contrastLogicalArgument(invocation, argument, false, "sparse")) === true) {
    throw new RUnsupportedFeatureError("NRU6130", "Sparse contrast matrices are not implemented.");
  }
}

function contrastIdentity(levels: readonly string[]): RValue {
  const size = levels.length;
  const values = new Float64Array(size * size);
  for (let index = 0; index < size; index += 1) values[index * size + index] = 1;
  let matrix = withDimensions(doubleVector(values), [size, size]);
  matrix = withAttribute(
    matrix,
    "dimnames",
    listValue([characterVector(levels), characterVector(levels)]),
  );
  return matrix;
}

function contrastSum(levels: readonly string[], contrasts: boolean): RValue {
  if (!contrasts) return contrastIdentity(levels);
  const rows = levels.length;
  const columns = rows - 1;
  const values = new Float64Array(rows * columns);
  for (let column = 0; column < columns; column += 1) {
    values[column * rows + column] = 1;
    values[column * rows + rows - 1] = -1;
  }
  let matrix = withDimensions(doubleVector(values), [rows, columns]);
  matrix = withAttribute(matrix, "dimnames", listValue([characterVector(levels), R_NULL]));
  return matrix;
}

function contrastTreatment(levels: readonly string[], base: number, contrasts: boolean): RValue {
  if (!contrasts) return contrastIdentity(levels);
  const rows = levels.length;
  const selected = levels.map((_, index) => index + 1).filter((index) => index !== base);
  const values = new Float64Array(rows * selected.length);
  for (const [column, row] of selected.entries()) values[column * rows + row - 1] = 1;
  let matrix = withDimensions(doubleVector(values), [rows, selected.length]);
  matrix = withAttribute(
    matrix,
    "dimnames",
    listValue([
      characterVector(levels),
      characterVector(selected.map((index) => levels[index - 1] ?? "")),
    ]),
  );
  return matrix;
}

function contrastHelmert(levels: readonly string[], contrasts: boolean): RValue {
  if (!contrasts) return contrastIdentity(levels);
  const rows = levels.length;
  const columns = rows - 1;
  const values = new Float64Array(rows * columns);
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row <= column; row += 1) values[column * rows + row] = -1;
    values[column * rows + column + 1] = column + 1;
  }
  let matrix = withDimensions(doubleVector(values), [rows, columns]);
  matrix = withAttribute(matrix, "dimnames", listValue([characterVector(levels), R_NULL]));
  return matrix;
}

async function requiredFormula(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  call: string,
): Promise<RFormula> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument 'formula' is missing in ${call}().`);
  }
  let value = await invocation.force(argument.promise);
  if (value.type === "language" && value.expression.kind === "FormulaExpression") {
    value = await invocation.evaluate(value, argument.promise.environment);
  }
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
  readonly contrasts: ReadonlyMap<string, RValue>;
  readonly aov: boolean;
  readonly naAction: "pass" | "omit" | "fail";
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

  let naActionArgument = parsed.matched.get("na.action");
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
  const contrasts =
    contrastsArgument === undefined || contrastsArgument.promise.missing
      ? new Map<string, RValue>()
      : modelContrastSpecifications(await invocation.force(contrastsArgument.promise));

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
        naActionArgument = uniqueModelArgument(naActionArgument, argument);
      } else {
        throw new REvaluationError("NRE2101", "Unused argument.");
      }
    }
  } else if (parsed.dots.length > 0) {
    throw new REvaluationError(
      "NRE2101",
      `Unused argument${parsed.dots.length === 1 ? "" : "s"}: ${parsed.dots
        .map((argument) => argument.name ?? "<unnamed>")
        .join(", ")}.`,
    );
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
  const naAction = await modelFrameNaAction(invocation, naActionArgument);
  const options: LinearModelOptions = {
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
    contrasts,
    aov,
    naAction,
    call: invocation.matchBuiltinCall(parameters, true),
  };
  const errorTerm = aov ? stratifiedAovErrorTerm(formula) : undefined;
  if (errorTerm !== undefined) return fitStratifiedAov(options, errorTerm, invocation);
  return fitLinearModel(options, invocation);
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

type GlmFamilyName =
  "gaussian" | "binomial" | "quasibinomial" | "poisson" | "quasipoisson" | "Gamma";

const STANDARD_GLM_LINKS = [
  "logit",
  "probit",
  "cauchit",
  "cloglog",
  "identity",
  "log",
  "sqrt",
  "1/mu^2",
  "inverse",
] as const;

type StandardGlmLink = (typeof STANDARD_GLM_LINKS)[number];

interface GlmFamilyDescriptor {
  readonly name: string;
  readonly link: string;
  readonly object: RList;
  readonly fixedDispersion: number | undefined;
  readonly callbacks?: {
    readonly linkfun: RValue;
    readonly linkinv: RValue;
    readonly variance: RValue;
    readonly deviance: RValue;
    readonly aic: RValue;
    readonly muEta: RValue;
    readonly initialize: RValue;
    readonly validMu: RValue | undefined;
    readonly validEta: RValue | undefined;
  };
}

const GLM_FAMILY_LINKS: Readonly<Record<GlmFamilyName, readonly string[]>> = {
  gaussian: ["identity", "log", "inverse"],
  binomial: ["logit", "probit", "cloglog", "cauchit", "log", "identity"],
  quasibinomial: ["logit", "probit", "cloglog", "cauchit", "log", "identity"],
  poisson: ["log", "identity", "sqrt"],
  quasipoisson: ["log", "identity", "sqrt"],
  Gamma: ["inverse", "identity", "log"],
};

const GLM_DEFAULT_LINK: Readonly<Record<GlmFamilyName, string>> = {
  gaussian: "identity",
  binomial: "logit",
  quasibinomial: "logit",
  poisson: "log",
  quasipoisson: "log",
  Gamma: "inverse",
};

function isBinomialFamilyName(name: string): boolean {
  return name === "binomial" || name === "quasibinomial";
}

function isPoissonFamilyName(name: string): boolean {
  return name === "poisson" || name === "quasipoisson";
}

function isQuasiFamilyName(name: string): boolean {
  return name === "quasibinomial" || name === "quasipoisson";
}

function isGlmFamilyName(name: string): name is GlmFamilyName {
  return name in GLM_FAMILY_LINKS;
}

function isStandardGlmLink(name: string): name is StandardGlmLink {
  return (STANDARD_GLM_LINKS as readonly string[]).includes(name);
}

async function builtinMakeLink(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["link"]);
  const argument = parsed.matched.get("link");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'link' is missing in make.link().");
  }
  const value = await invocation.force(argument.promise);
  const selected = standardGlmLinkSelection(value);
  return buildGlmLinkObject(selected.link, value, invocation);
}

function standardGlmLinkSelection(value: RValue): { readonly link: StandardGlmLink } {
  if (value.type === "character") {
    if (value.length !== 1) {
      throw new REvaluationError("NRE2001", "EXPR must be a length 1 vector");
    }
    const link = isMissing(value, 0) ? "NA" : (value.values[0] ?? "");
    if (isStandardGlmLink(link)) return { link };
    throw new REvaluationError("NRE2001", `'${link}' link not recognised`);
  }
  if (value.type === "logical" || value.type === "integer" || value.type === "double") {
    if (value.length !== 1) {
      throw new REvaluationError("NRE2001", "EXPR must be a length 1 vector");
    }
    const numeric = isMissing(value, 0) ? Number.NaN : Number(value.values[0]);
    const index = Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
    const link = STANDARD_GLM_LINKS[index - 1];
    if (link !== undefined) return { link };
    const label = Number.isNaN(numeric) ? "NA" : String(numeric);
    throw new REvaluationError("NRE2001", `'${label}' link not recognised`);
  }
  throw new REvaluationError("NRE2001", "EXPR must be a length 1 vector");
}

async function builtinGlmFamily(
  invocation: BuiltinInvocation,
  familyName: GlmFamilyName,
): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["link"]);
  const linkArgument = parsed.matched.get("link");
  let link = GLM_DEFAULT_LINK[familyName];
  if (linkArgument !== undefined && !linkArgument.promise.missing) {
    const expression = linkArgument.promise.expression;
    if (
      expression?.kind === "Identifier" &&
      GLM_FAMILY_LINKS[familyName].includes(expression.name)
    ) {
      link = expression.name;
    } else {
      const value = await invocation.force(linkArgument.promise);
      if (
        value.type !== "character" ||
        value.length !== 1 ||
        isMissing(value, 0) ||
        (value.values[0]?.length ?? 0) === 0
      ) {
        throw new RTypeMismatchError("NRT3265", `${familyName}() link must be one string.`);
      }
      link = value.values[0] ?? link;
    }
  }
  if (!GLM_FAMILY_LINKS[familyName].includes(link)) {
    throw new REvaluationError(
      "NRE2131",
      `link '${link}' not available for ${familyName} family; available links are ${GLM_FAMILY_LINKS[
        familyName
      ].join(", ")}`,
    );
  }
  return buildGlmFamilyObject(familyName, link, invocation);
}

async function buildGlmFamilyObject(
  familyName: GlmFamilyName,
  link: string,
  invocation: BuiltinInvocation,
): Promise<RList> {
  if (!isStandardGlmLink(link)) {
    throw new Error(`Internal unsupported GLM link '${link}'.`);
  }
  const environment = invocation.currentEnvironment();
  const linkComponents = await buildGlmLinkComponents(link, invocation);
  const variance = await modelSourceValue(glmVarianceSource(familyName), environment, invocation);
  const deviance = await modelSourceValue(
    glmDevianceResidualSource(familyName),
    environment,
    invocation,
  );
  const aic = await modelSourceValue(glmAicSource(familyName), environment, invocation);
  const initialize = await modelSourceValue(
    glmInitializeSource(familyName),
    environment,
    invocation,
  );
  const validmu = await modelSourceValue(glmValidMuSource(familyName), environment, invocation);
  const fields: { readonly name: string; readonly value: RValue }[] = [
    { name: "family", value: characterVector([familyName]) },
    { name: "link", value: characterVector([link]) },
    { name: "linkfun", value: linkComponents.linkfun },
    { name: "linkinv", value: linkComponents.linkinv },
    { name: "variance", value: variance },
    { name: "dev.resids", value: deviance },
    { name: "aic", value: aic },
    { name: "mu.eta", value: linkComponents.muEta },
    { name: "initialize", value: initialize },
    { name: "validmu", value: validmu },
    { name: "valideta", value: linkComponents.valideta },
  ];
  if (familyName !== "gaussian") {
    fields.push({
      name: "simulate",
      value: await modelSourceValue(
        "function(object, nsim) stop('family simulation is not implemented in this browser subset')",
        environment,
        invocation,
      ),
    });
  }
  fields.push({
    name: "dispersion",
    value:
      familyName === "gaussian" || familyName === "Gamma"
        ? doubleVector([0], Uint8Array.of(1))
        : isQuasiFamilyName(familyName)
          ? doubleVector([0], Uint8Array.of(1))
          : doubleVector([1]),
  });
  invocation.context.allocate(fields.length);
  return withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    ["family"],
  );
}

interface GlmLinkComponents {
  readonly linkfun: RValue;
  readonly linkinv: RValue;
  readonly muEta: RValue;
  readonly valideta: RValue;
}

async function buildGlmLinkComponents(
  link: StandardGlmLink,
  invocation: BuiltinInvocation,
): Promise<GlmLinkComponents> {
  const environment = invocation.currentEnvironment();
  return {
    linkfun: await modelSourceValue(glmLinkFunctionSource(link, false), environment, invocation),
    linkinv: await modelSourceValue(glmLinkFunctionSource(link, true), environment, invocation),
    muEta: await modelSourceValue(glmMuEtaSource(link), environment, invocation),
    valideta: await modelSourceValue(glmValidEtaSource(link), environment, invocation),
  };
}

async function buildGlmLinkObject(
  link: StandardGlmLink,
  name: RValue,
  invocation: BuiltinInvocation,
): Promise<RList> {
  const components = await buildGlmLinkComponents(link, invocation);
  invocation.context.allocate(5);
  return withClasses(
    listValue(
      [components.linkfun, components.linkinv, components.muEta, components.valideta, name],
      ["linkfun", "linkinv", "mu.eta", "valideta", "name"],
    ),
    ["link-glm"],
  );
}

async function modelSourceValue(
  source: string,
  environment: REnvironment,
  invocation: BuiltinInvocation,
): Promise<RValue> {
  const program = invocation.parse(source, 1);
  const expression = program.body[0];
  if (expression === undefined) throw new Error();
  return invocation.evaluate({ type: "language", expression }, environment);
}

function glmLinkFunctionSource(link: StandardGlmLink, inverse: boolean): string {
  if (!inverse) {
    if (link === "identity") return "function(mu) mu";
    if (link === "log") return "function(mu) log(mu)";
    if (link === "inverse") return "function(mu) 1/mu";
    if (link === "sqrt") return "function(mu) sqrt(mu)";
    if (link === "logit") {
      return "function(mu) { bad <- mu[!is.na(mu) & (mu < 0 | mu > 1)]; if (length(bad) > 0) stop('Value ', bad[1], ' out of range (0, 1)'); log(mu/(1-mu)) }";
    }
    if (link === "probit") return "function(mu) qnorm(mu)";
    if (link === "cauchit") return "function(mu) qcauchy(mu)";
    if (link === "cloglog") return "function(mu) log(-log(1-mu))";
    if (link === "1/mu^2") return "function(mu) 1/(mu^2)";
  } else {
    if (link === "identity") return "function(eta) eta";
    if (link === "log") return "function(eta) pmax(.Machine$double.eps, exp(eta))";
    if (link === "inverse") return "function(eta) 1/eta";
    if (link === "sqrt") return "function(eta) eta^2";
    if (link === "logit") {
      return "function(eta) pmax(.Machine$double.eps, pmin(1-.Machine$double.eps, 1/(1+exp(-eta))))";
    }
    if (link === "probit") {
      return "function(eta) pmax(.Machine$double.eps, pmin(1-.Machine$double.eps, pnorm(eta)))";
    }
    if (link === "cauchit") {
      return "function(eta) pmax(.Machine$double.eps, pmin(1-.Machine$double.eps, pcauchy(eta)))";
    }
    if (link === "cloglog") {
      return "function(eta) pmax(.Machine$double.eps, pmin(1-.Machine$double.eps, -expm1(-exp(eta))))";
    }
    if (link === "1/mu^2") return "function(eta) 1/sqrt(eta)";
  }
  throw new Error("Internal unsupported GLM link.");
}

function glmMuEtaSource(link: StandardGlmLink): string {
  if (link === "identity") return "function(eta) rep(1, length(eta))";
  if (link === "log") return "function(eta) pmax(.Machine$double.eps, exp(eta))";
  if (link === "inverse") return "function(eta) -1/(eta^2)";
  if (link === "sqrt") return "function(eta) 2*eta";
  if (link === "logit") {
    return "function(eta) { mu <- 1/(1+exp(-eta)); pmax(.Machine$double.eps, mu*(1-mu)) }";
  }
  if (link === "probit") return "function(eta) pmax(.Machine$double.eps, dnorm(eta))";
  if (link === "cauchit") return "function(eta) pmax(.Machine$double.eps, dcauchy(eta))";
  if (link === "cloglog") {
    return "function(eta) pmax(.Machine$double.eps, exp(eta-exp(eta)))";
  }
  if (link === "1/mu^2") return "function(eta) -1/(2*eta*sqrt(eta))";
  throw new Error("Internal unsupported GLM link.");
}

function glmValidEtaSource(link: StandardGlmLink): string {
  if (link === "sqrt" || link === "1/mu^2") {
    return "function(eta) all(is.finite(eta)) && all(eta > 0)";
  }
  if (link === "inverse") {
    return "function(eta) all(is.finite(eta)) && all(eta != 0)";
  }
  return "function(eta) TRUE";
}

function glmVarianceSource(familyName: GlmFamilyName): string {
  if (familyName === "gaussian") return "function(mu) rep(1, length(mu))";
  if (isBinomialFamilyName(familyName)) return "function(mu) mu*(1-mu)";
  if (familyName === "Gamma") return "function(mu) mu^2";
  return "function(mu) mu";
}

function glmDevianceResidualSource(familyName: GlmFamilyName): string {
  if (familyName === "gaussian") return "function(y, mu, wt) wt*(y-mu)^2";
  if (isBinomialFamilyName(familyName)) {
    return "function(y, mu, wt) 2*wt*(ifelse(y==0,0,y*log(y/mu))+ifelse(y==1,0,(1-y)*log((1-y)/(1-mu))))";
  }
  if (familyName === "Gamma") {
    return "function(y, mu, wt) 2*wt*((y-mu)/mu-log(y/mu))";
  }
  return "function(y, mu, wt) 2*wt*ifelse(y==0,mu,y*log(y/mu)-(y-mu))";
}

function glmAicSource(familyName: GlmFamilyName): string {
  if (isQuasiFamilyName(familyName)) return "function(y, n, mu, wt, dev) NA";
  if (familyName === "gaussian") {
    return "function(y, n, mu, wt, dev) { nobs <- length(y); nobs*(log(dev/nobs*2*pi)+1)+2 }";
  }
  if (isBinomialFamilyName(familyName)) {
    return "function(y, n, mu, wt, dev) -2*sum(wt*(y*log(mu)+(1-y)*log(1-mu)))";
  }
  if (familyName === "Gamma") {
    return "function(y, n, mu, wt, dev) { dispersion <- dev/length(y); shape <- 1/dispersion; -2*sum(wt*((shape-1)*log(y)-y/(mu*dispersion)-lgamma(shape)-shape*log(mu*dispersion)))+2 }";
  }
  return "function(y, n, mu, wt, dev) -2*sum(wt*(y*log(mu)-mu-lgamma(y+1)))";
}

function glmInitializeSource(familyName: GlmFamilyName): string {
  if (familyName === "gaussian") return "expression({ n <- rep(1, nobs); mustart <- y })";
  if (isBinomialFamilyName(familyName)) {
    return "expression({ n <- rep(1, nobs); mustart <- (weights*y+0.5)/(weights+1) })";
  }
  if (familyName === "Gamma") return "expression({ n <- rep(1, nobs); mustart <- y })";
  return "expression({ n <- rep(1, nobs); mustart <- y+0.1 })";
}

function glmValidMuSource(familyName: GlmFamilyName): string {
  if (familyName === "gaussian") return "function(mu) all(is.finite(mu))";
  if (isBinomialFamilyName(familyName)) {
    return "function(mu) all(is.finite(mu)) && all(mu > 0 & mu < 1)";
  }
  return "function(mu) all(is.finite(mu)) && all(mu > 0)";
}

interface GlmControl {
  readonly epsilon: number;
  readonly maxit: number;
  readonly trace: boolean;
}

interface GlmFitResult {
  readonly solved: LeastSquaresResult;
  readonly mu: Float64Array;
  readonly eta: Float64Array;
  readonly workingWeights: Float64Array;
  readonly workingResiduals: Float64Array;
  readonly devianceResiduals: Float64Array;
  readonly deviance: number;
  readonly iterations: number;
  readonly converged: boolean;
  readonly boundary: boolean;
}

async function builtinGeneralizedLinearModelFit(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "x",
    "y",
    "weights",
    "start",
    "etastart",
    "mustart",
    "offset",
    "family",
    "control",
    "intercept",
    "singular.ok",
  ]);
  const xArgument = parsed.matched.get("x");
  const yArgument = parsed.matched.get("y");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in glm.fit().");
  }
  if (yArgument === undefined || yArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'y' is missing in glm.fit().");
  }
  const x = await invocation.force(xArgument.promise);
  if (x.type !== "logical" && x.type !== "integer" && x.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "glm.fit() requires a numeric matrix for 'x'.");
  }
  const dimensions = vectorDimensions(x);
  if (dimensions?.length !== 2) {
    throw new RTypeMismatchError("NRT3265", "'x' must be a matrix");
  }
  const rows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  if (rows === 0 || columns === 0) {
    throw new RTypeMismatchError("NRT3265", "glm.fit() requires a non-empty model matrix.");
  }
  const matrixValues = new Float64Array(x.length);
  for (let index = 0; index < x.length; index += 1) {
    const value = realAt(x, index);
    if (isMissing(x, index) || !Number.isFinite(value)) {
      throw new REvaluationError("NRE2136", "NA/NaN/Inf in 'x'");
    }
    matrixValues[index] = value;
  }
  const dimensionNames = x.attributes.get("dimnames");
  const rowNamesValue =
    dimensionNames?.type === "list" && dimensionNames.values[0]?.type === "character"
      ? dimensionNames.values[0]
      : undefined;
  const columnNamesValue =
    dimensionNames?.type === "list" && dimensionNames.values[1]?.type === "character"
      ? dimensionNames.values[1]
      : undefined;
  let matrix = withDimensions(doubleVector(matrixValues), [rows, columns]);
  if (dimensionNames?.type === "list") matrix = withAttribute(matrix, "dimnames", dimensionNames);
  const design: ModelMatrixResult = {
    matrix,
    rows,
    columns,
    columnNames: columnNamesValue?.values ?? Array.from({ length: columns }, () => ""),
    assign: Array.from({ length: columns }, () => 0),
    xlevels: new Map(),
    contrasts: new Set(),
    contrastSpecifications: new Map(),
  };

  const family = await resolveGlmFamily(parsed.matched.get("family"), invocation);
  const y = modelAtomicResponse(await invocation.force(yArgument.promise));
  const response = glmResponseValues(y, family, invocation);
  if (response.values.length !== rows) {
    throw new RTypeMismatchError(
      "NRT3265",
      `NAs in V(mu): n = ${rows}, nrow(x) = ${rows}, length(y) = ${response.values.length}`,
    );
  }
  const weights = await glmFitNumericArgument(
    parsed.matched.get("weights"),
    rows,
    1,
    "weights",
    invocation,
  );
  if (response.trials !== undefined) {
    for (let index = 0; index < rows; index += 1) {
      weights[index] = (weights[index] ?? 1) * (response.trials[index] ?? 1);
    }
  }
  const offset = await glmFitNumericArgument(
    parsed.matched.get("offset"),
    rows,
    0,
    "offset",
    invocation,
  );
  const control = await glmControlValue(parsed.matched.get("control"), invocation);
  const intercept = await optionalModelFlag(
    invocation,
    parsed.matched.get("intercept"),
    true,
    "intercept",
  );
  const singularOk = await optionalModelFlag(
    invocation,
    parsed.matched.get("singular.ok"),
    true,
    "singular.ok",
  );
  const start = await optionalGlmStart(
    parsed.matched.get("start"),
    invocation.currentEnvironment(),
    invocation,
  );
  const etaStart = await optionalGlmStart(
    parsed.matched.get("etastart"),
    invocation.currentEnvironment(),
    invocation,
  );
  const muStart = await optionalGlmStart(
    parsed.matched.get("mustart"),
    invocation.currentEnvironment(),
    invocation,
  );
  if ([start, etaStart, muStart].filter((value) => value !== undefined).length > 1) {
    throw new REvaluationError(
      "NRE2102",
      "glm.fit() may specify only one of start, etastart, and mustart.",
    );
  }
  if (start !== undefined && start.length !== columns) {
    throw new RTypeMismatchError(
      "NRT3265",
      "length of 'start' should equal the number of columns of 'x'",
    );
  }
  for (const [name, value] of [
    ["etastart", etaStart],
    ["mustart", muStart],
  ] as const) {
    if (value !== undefined && value.length !== rows) {
      throw new RTypeMismatchError(
        "NRT3265",
        `length of '${name}' must equal the number of rows in 'x'`,
      );
    }
  }

  const fitted = await fitGlmIrls(
    design,
    response.values,
    weights,
    offset,
    family,
    control,
    start,
    etaStart,
    muStart,
    invocation,
  );
  if (!singularOk && fitted.solved.rank < columns) {
    throw new REvaluationError("NRE2137", "singular fit encountered");
  }
  reportGlmFitWarnings(fitted, family, invocation);

  const observationNames = vectorNames(y) ?? rowNamesValue?.values;
  const hasColumnNames = columnNamesValue !== undefined;
  const coefficientValue = doubleVector(
    fitted.solved.coefficients,
    fitted.solved.coefficientMissing,
  );
  const coefficients = hasColumnNames
    ? withNames(coefficientValue, design.columnNames)
    : coefficientValue;
  const effectsValue = doubleVector(fitted.solved.effects);
  const effects = hasColumnNames
    ? withNames(
        effectsValue,
        Array.from({ length: rows }, (_unused, index) => design.columnNames[index] ?? ""),
      )
    : effectsValue;
  const positiveRows = weights.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
  const nullDeviance = intercept
    ? (await fitGlmNullModel(response.values, weights, offset, family, control, invocation))
        .deviance
    : await glmDeviance(
        family,
        response.values,
        await glmFamilyTransform(offset, family, "linkinv", invocation),
        weights,
        invocation,
      );
  const aic =
    (await glmAic(family, response.values, fitted.mu, weights, fitted.deviance, invocation)) +
    2 * fitted.solved.rank;
  const named = (value: RDoubleVector): RDoubleVector =>
    observationNames === undefined ? value : withNames(value, observationNames);
  const fields = glmFitFields(
    coefficients,
    named(doubleVector(fitted.workingResiduals)),
    named(doubleVector(fitted.mu)),
    effects,
    glmRMatrix(design, fitted.solved),
    linearModelQr(design, fitted.solved, 1e-11),
    family,
    fitted,
    named(doubleVector(fitted.eta)),
    aic,
    nullDeviance,
    named(doubleVector(weights)),
    positiveRows - fitted.solved.rank,
    positiveRows - (intercept ? 1 : 0),
  );
  fields.push(
    { name: "y", value: named(doubleVector(response.values)) },
    { name: "converged", value: logicalVector([fitted.converged]) },
    { name: "boundary", value: logicalVector([fitted.boundary]) },
  );
  invocation.context.allocate(fields.length);
  return listValue(
    fields.map((field) => field.value),
    fields.map((field) => field.name),
  );
}

function glmFitFields(
  coefficients: RValue,
  residuals: RValue,
  fittedValues: RValue,
  effects: RValue,
  rMatrix: RValue,
  qr: RValue,
  family: GlmFamilyDescriptor,
  fitted: GlmFitResult,
  linearPredictors: RValue,
  aic: number,
  nullDeviance: number,
  priorWeights: RValue,
  dfResidual: number,
  dfNull: number,
): { readonly name: string; readonly value: RValue }[] {
  return [
    { name: "coefficients", value: coefficients },
    { name: "residuals", value: residuals },
    { name: "fitted.values", value: fittedValues },
    { name: "effects", value: effects },
    { name: "R", value: rMatrix },
    { name: "rank", value: integerVector([fitted.solved.rank]) },
    { name: "qr", value: qr },
    { name: "family", value: family.object },
    { name: "linear.predictors", value: linearPredictors },
    { name: "deviance", value: doubleVector([fitted.deviance]) },
    {
      name: "aic",
      value: isQuasiFamilyName(family.name)
        ? doubleVector([0], Uint8Array.of(1))
        : doubleVector([aic]),
    },
    { name: "null.deviance", value: doubleVector([nullDeviance]) },
    { name: "iter", value: integerVector([fitted.iterations]) },
    { name: "weights", value: doubleVector(fitted.workingWeights) },
    { name: "prior.weights", value: priorWeights },
    { name: "df.residual", value: integerVector([dfResidual]) },
    { name: "df.null", value: integerVector([dfNull]) },
  ];
}

async function glmFitNumericArgument(
  argument: BuiltinCallArgument | undefined,
  length: number,
  fallback: number,
  name: "weights" | "offset",
  invocation: BuiltinInvocation,
): Promise<Float64Array> {
  if (argument === undefined || argument.promise.missing)
    return new Float64Array(length).fill(fallback);
  const value = modelRealVector(await invocation.force(argument.promise), name);
  if (value.length !== length) {
    throw new RTypeMismatchError("NRT3265", `variable lengths differ (found for '${name}')`);
  }
  const output = new Float64Array(length);
  for (let index = 0; index < length; index += 1) {
    const item = realAt(value, index);
    if (isMissing(value, index) || !Number.isFinite(item) || (name === "weights" && item < 0)) {
      throw new RTypeMismatchError(
        "NRT3265",
        `${name} must be finite${name === "weights" ? " and non-negative" : ""}`,
      );
    }
    output[index] = item;
  }
  return output;
}

async function builtinGeneralizedLinearModel(invocation: BuiltinInvocation): Promise<RValue> {
  const parameters = [
    "formula",
    "family",
    "data",
    "weights",
    "subset",
    "na.action",
    "start",
    "etastart",
    "mustart",
    "offset",
    "control",
    "model",
    "method",
    "x",
    "y",
    "singular.ok",
    "contrasts",
    "...",
  ] as const;
  const parsed = matchBuiltinArguments(invocation, parameters);
  const formula = await requiredFormula(invocation, parsed.matched.get("formula"), "glm");
  const dataArgument = parsed.matched.get("data");
  const data =
    dataArgument === undefined || dataArgument.promise.missing
      ? undefined
      : await invocation.force(dataArgument.promise);
  const parent =
    formula.environment ??
    parsed.matched.get("formula")?.promise.environment ??
    invocation.currentEnvironment();
  const dataEnvironment = modelDataEnvironment(data, parent, "glm()");
  const naActionPolicy = await modelFrameNaAction(invocation, parsed.matched.get("na.action"));
  if (parsed.dots.length > 0) throw new REvaluationError("NRE2101", "Unused argument in glm().");
  const methodArgument = parsed.matched.get("method");
  if (methodArgument !== undefined && !methodArgument.promise.missing) {
    const method = await invocation.force(methodArgument.promise);
    if (
      method.type !== "character" ||
      method.length !== 1 ||
      isMissing(method, 0) ||
      method.values[0] !== "glm.fit"
    ) {
      throw new RUnsupportedFeatureError("NRU6130", "glm() currently supports method = 'glm.fit'.");
    }
  }
  const contrastsArgument = parsed.matched.get("contrasts");
  if (contrastsArgument !== undefined && !contrastsArgument.promise.missing) {
    const contrasts = await invocation.force(contrastsArgument.promise);
    if (contrasts.type !== "null") {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        "Custom GLM contrast specifications are not implemented.",
      );
    }
  }

  const family = await resolveGlmFamily(parsed.matched.get("family"), invocation);
  const subsetArgument = parsed.matched.get("subset");
  const weightsArgument = parsed.matched.get("weights");
  const offsetArgument = parsed.matched.get("offset");
  const subset =
    subsetArgument === undefined || subsetArgument.promise.missing
      ? undefined
      : await evaluateModelArgument(invocation, subsetArgument, dataEnvironment);
  const weights =
    weightsArgument === undefined || weightsArgument.promise.missing
      ? undefined
      : modelRealVector(
          await evaluateModelArgument(invocation, weightsArgument, dataEnvironment),
          "weights",
        );
  const offset =
    offsetArgument === undefined || offsetArgument.promise.missing
      ? undefined
      : modelRealVector(
          await evaluateModelArgument(invocation, offsetArgument, dataEnvironment),
          "offset",
        );
  const control = await glmControlValue(parsed.matched.get("control"), invocation);
  const keepModel = await optionalModelFlag(invocation, parsed.matched.get("model"), true, "model");
  const keepX = await optionalModelFlag(invocation, parsed.matched.get("x"), false, "x");
  const keepY = await optionalModelFlag(invocation, parsed.matched.get("y"), true, "y");
  const singularOk = await optionalModelFlag(
    invocation,
    parsed.matched.get("singular.ok"),
    true,
    "singular.ok",
  );

  const prepared = await prepareModelData(
    {
      formula,
      ...(data === undefined ? {} : { data }),
      environment: dataEnvironment,
      requireResponse: true,
      allowCategoricalResponse: true,
      omitMissing: naActionPolicy !== "pass",
      ...(subset === undefined ? {} : { subset }),
      ...(weights === undefined ? {} : { weights }),
      ...(offset === undefined ? {} : { offset }),
      xlevels: new Map(),
    },
    invocation,
  );
  if (naActionPolicy === "fail" && prepared.omittedIndices.length > 0) {
    throw new REvaluationError("NRE2148", "missing values in object");
  }
  const response = prepared.response;
  if (response === undefined) throw new Error();
  const glmResponse = glmResponseValues(response, family, invocation);
  const responseValues = glmResponse.values;
  const priorWeights = Float64Array.from(
    { length: prepared.rows },
    (_unused, index) => (prepared.weights?.[index] ?? 1) * (glmResponse.trials?.[index] ?? 1),
  );
  const modelFormula = termsFromFormula(
    {
      ...formula,
      terms: prepared.terms,
      variables: [
        ...(formula.response === undefined ? [] : [formula.response]),
        ...new Set(prepared.terms.flatMap(modelTermComponents)),
      ],
    },
    invocation,
  );
  const design = await buildModelMatrix(prepared, modelFormula, new Map(), invocation);
  if (design.columns === 0) {
    throw new RTypeMismatchError("NRT3265", "The model matrix has no columns.");
  }
  const start = await optionalGlmStart(parsed.matched.get("start"), dataEnvironment, invocation);
  const etaStart = await optionalGlmStart(
    parsed.matched.get("etastart"),
    dataEnvironment,
    invocation,
  );
  const muStart = await optionalGlmStart(
    parsed.matched.get("mustart"),
    dataEnvironment,
    invocation,
  );
  if ([start, etaStart, muStart].filter((value) => value !== undefined).length > 1) {
    throw new REvaluationError(
      "NRE2102",
      "glm() may specify only one of start, etastart, and mustart.",
    );
  }
  const filteredEtaStart = filterGlmStart(etaStart, prepared, "etastart");
  const filteredMuStart = filterGlmStart(muStart, prepared, "mustart");
  if (start !== undefined && start.length !== design.columns) {
    throw new RTypeMismatchError(
      "NRT3265",
      `start has length ${start.length}, but the model matrix has ${design.columns} columns.`,
    );
  }
  const fitted = await fitGlmIrls(
    design,
    responseValues,
    priorWeights,
    prepared.offset,
    family,
    control,
    start,
    filteredEtaStart,
    filteredMuStart,
    invocation,
  );
  if (!singularOk && fitted.solved.rank < design.columns) {
    throw new REvaluationError("NRE2137", "singular fit encountered");
  }
  reportGlmFitWarnings(fitted, family, invocation);

  const nullFit = await fitGlmNullModel(
    responseValues,
    priorWeights,
    prepared.offset,
    family,
    control,
    invocation,
  );
  const coefficients = withNames(
    doubleVector(fitted.solved.coefficients, fitted.solved.coefficientMissing),
    design.columnNames,
  );
  const fittedValues = withNames(doubleVector(fitted.mu), prepared.rowNames);
  const residuals = withNames(doubleVector(fitted.workingResiduals), prepared.rowNames);
  const linearPredictors = withNames(doubleVector(fitted.eta), prepared.rowNames);
  const effectNames = Array.from({ length: design.rows }, (_, index) =>
    index < design.columnNames.length ? (design.columnNames[index] ?? "") : "",
  );
  const effects = withNames(doubleVector(fitted.solved.effects), effectNames);
  const qr = linearModelQr(design, fitted.solved);
  const rMatrix = glmRMatrix(design, fitted.solved);
  const xlevels = listValue(
    [...design.xlevels.values()].map((levels) => characterVector(levels)),
    [...design.xlevels.keys()],
  );
  const contrasts = modelContrastsValue(design);
  const naAction =
    prepared.omittedIndices.length === 0
      ? undefined
      : withClasses(
          withNames(
            integerVector(prepared.omittedIndices.map((index) => index + 1)),
            prepared.omittedIndices.map(
              (index) =>
                modelRowNames(data, undefined, prepared.originalRows)[index] ?? String(index + 1),
            ),
          ),
          ["omit"],
        );
  const model = buildModelFrame(prepared, modelFormula, new Map(), naAction, invocation);
  const positiveRows = priorWeights.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
  const dfResidual = positiveRows - fitted.solved.rank;
  const dfNull = positiveRows - (modelFormula.intercept ? 1 : 0);
  const aic =
    (await glmAic(family, responseValues, fitted.mu, priorWeights, fitted.deviance, invocation)) +
    2 * fitted.solved.rank;
  const fields = glmFitFields(
    coefficients,
    residuals,
    fittedValues,
    effects,
    rMatrix,
    qr,
    family,
    fitted,
    linearPredictors,
    aic,
    nullFit.deviance,
    withNames(doubleVector(priorWeights), prepared.rowNames),
    dfResidual,
    dfNull,
  );
  if (keepY)
    fields.push({ name: "y", value: withNames(doubleVector(responseValues), prepared.rowNames) });
  fields.push(
    { name: "converged", value: logicalVector([fitted.converged]) },
    { name: "boundary", value: logicalVector([fitted.boundary]) },
  );
  if (keepModel) fields.push({ name: "model", value: model });
  fields.push(
    { name: "call", value: invocation.matchBuiltinCall(parameters, true) },
    { name: "formula", value: formula },
    { name: "terms", value: modelFormula },
  );
  if (data !== undefined) fields.push({ name: "data", value: data });
  fields.push({
    name: "offset",
    value: doubleVector(prepared.offset ?? new Float64Array(design.rows)),
  });
  fields.push({ name: "control", value: glmControlObject(control) });
  fields.push({ name: "method", value: characterVector(["glm.fit"]) });
  if (contrasts !== undefined) fields.push({ name: "contrasts", value: contrasts });
  fields.push({ name: "xlevels", value: xlevels });
  if (keepX) fields.push({ name: "x", value: design.matrix });
  if (naAction !== undefined) fields.push({ name: "na.action", value: naAction });
  invocation.context.allocate(fields.length);
  const output = withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    ["glm", "lm"],
  );
  MODEL_INFLUENCE_STATES.set(output, { design });
  return output;
}

function reportGlmFitWarnings(
  fitted: GlmFitResult,
  family: GlmFamilyDescriptor,
  invocation: BuiltinInvocation,
): void {
  if (!fitted.converged) {
    invocation.context.warn({ code: "NRW1101", message: "glm.fit: algorithm did not converge" });
  }
  if (fitted.boundary) {
    invocation.context.warn({
      code: "NRW1101",
      message: isBinomialFamilyName(family.name)
        ? "glm.fit: fitted probabilities numerically 0 or 1 occurred"
        : "glm.fit: fitted rates numerically 0 occurred",
    });
  }
}

async function resolveGlmFamily(
  argument: BuiltinCallArgument | undefined,
  invocation: BuiltinInvocation,
): Promise<GlmFamilyDescriptor> {
  let value: RValue;
  if (argument === undefined || argument.promise.missing) {
    value = await buildGlmFamilyObject("gaussian", "identity", invocation);
  } else {
    value = await invocation.force(argument.promise);
    if (value.type === "builtin" || value.type === "closure") {
      value = await invocation.invoke(value, []);
    } else if (
      value.type === "character" &&
      value.length === 1 &&
      !isMissing(value, 0) &&
      isGlmFamilyName(value.values[0] ?? "")
    ) {
      const familyName = value.values[0] as GlmFamilyName;
      value = await buildGlmFamilyObject(familyName, GLM_DEFAULT_LINK[familyName], invocation);
    }
  }
  if (value.type !== "list" || !vectorClasses(value)?.includes("family")) {
    throw new RTypeMismatchError("NRT3265", "'family' must be a family function or family object");
  }
  return glmFamilyDescriptor(value);
}

function glmFamilyDescriptor(value: RList): GlmFamilyDescriptor {
  const nameValue = modelField(value, "family");
  const linkValue = modelField(value, "link");
  const name = nameValue?.type === "character" ? nameValue.values[0] : undefined;
  const link = linkValue?.type === "character" ? linkValue.values[0] : undefined;
  if (name === undefined || link === undefined || name.length === 0 || link.length === 0) {
    throw new RTypeMismatchError("NRT3265", "'family' has malformed family or link metadata");
  }
  if (isGlmFamilyName(name)) {
    if (!GLM_FAMILY_LINKS[name].includes(link)) {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        `glm() does not support link '${link}' for the ${name} family.`,
      );
    }
    return {
      name,
      link,
      object: value,
      fixedDispersion: name === "binomial" || name === "poisson" ? 1 : undefined,
    };
  }
  const linkfun = requiredGlmFamilyCallable(value, "linkfun");
  const linkinv = requiredGlmFamilyCallable(value, "linkinv");
  const variance = requiredGlmFamilyCallable(value, "variance");
  const deviance = requiredGlmFamilyCallable(value, "dev.resids");
  const aic = requiredGlmFamilyCallable(value, "aic");
  const muEta = requiredGlmFamilyCallable(value, "mu.eta");
  const initialize = modelField(value, "initialize");
  if (initialize?.type !== "expression" && initialize?.type !== "language") {
    throw new RTypeMismatchError(
      "NRT3265",
      "custom family 'initialize' must be an expression or language object",
    );
  }
  const validMuValue = modelField(value, "validmu");
  const validEtaValue = modelField(value, "valideta");
  const validMu = isGlmFamilyCallable(validMuValue) ? validMuValue : undefined;
  const validEta = isGlmFamilyCallable(validEtaValue) ? validEtaValue : undefined;
  const dispersionValue = modelField(value, "dispersion");
  const fixedDispersion = glmFamilyDispersion(dispersionValue);
  return {
    name,
    link,
    object: value,
    fixedDispersion,
    callbacks: {
      linkfun,
      linkinv,
      variance,
      deviance,
      aic,
      muEta,
      initialize,
      validMu,
      validEta,
    },
  };
}

function isGlmFamilyCallable(value: RValue | undefined): value is RValue {
  return value?.type === "builtin" || value?.type === "closure";
}

function requiredGlmFamilyCallable(family: RList, field: string): RValue {
  const value = modelField(family, field);
  if (!isGlmFamilyCallable(value)) {
    throw new RTypeMismatchError("NRT3265", `custom family '${field}' must be a function`);
  }
  return value;
}

function glmFamilyDispersion(value: RValue | undefined): number | undefined {
  if (
    value === undefined ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0 ||
    isMissing(value, 0)
  ) {
    return undefined;
  }
  const dispersion = realAt(value, 0);
  return Number.isFinite(dispersion) ? dispersion : undefined;
}

async function optionalGlmStart(
  argument: BuiltinCallArgument | undefined,
  environment: REnvironment,
  invocation: BuiltinInvocation,
): Promise<Float64Array | undefined> {
  if (argument === undefined || argument.promise.missing) return undefined;
  const supplied = await evaluateModelArgument(invocation, argument, environment);
  if (supplied.type === "null") return undefined;
  const value = modelRealVector(supplied, argument.name ?? "start");
  const output = new Float64Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    if (isMissing(value, index) || !Number.isFinite(realAt(value, index))) {
      throw new RTypeMismatchError("NRT3265", `${argument.name ?? "start"} must be finite.`);
    }
    output[index] = realAt(value, index);
  }
  return output;
}

function filterGlmStart(
  value: Float64Array | undefined,
  prepared: PreparedModelData,
  name: string,
): Float64Array | undefined {
  if (value === undefined) return undefined;
  if (value.length === prepared.rows) return value;
  if (value.length === prepared.originalRows) {
    return Float64Array.from(prepared.selectedIndices, (index) => value[index] ?? 0);
  }
  throw new RTypeMismatchError(
    "NRT3265",
    `${name} has length ${value.length}, but the model frame has ${prepared.originalRows} rows.`,
  );
}

async function glmControlValue(
  argument: BuiltinCallArgument | undefined,
  invocation: BuiltinInvocation,
): Promise<GlmControl> {
  if (argument === undefined || argument.promise.missing) {
    return { epsilon: 1e-8, maxit: 25, trace: false };
  }
  const value = await invocation.force(argument.promise);
  if (value.type === "null") return { epsilon: 1e-8, maxit: 25, trace: false };
  if (value.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "glm() control must be a named list.");
  }
  const epsilonValue = modelField(value, "epsilon");
  const maxitValue = modelField(value, "maxit");
  const traceValue = modelField(value, "trace");
  const epsilon = epsilonValue === undefined ? 1e-8 : modelScalarValue(epsilonValue, "epsilon");
  const maxit = maxitValue === undefined ? 25 : Math.trunc(modelScalarValue(maxitValue, "maxit"));
  const trace = traceValue === undefined ? false : modelLogicalFlag(traceValue, false, "trace");
  if (!Number.isFinite(epsilon) || epsilon <= 0 || maxit <= 0) {
    throw new RTypeMismatchError("NRT3265", "glm() control epsilon and maxit must be positive.");
  }
  return { epsilon, maxit, trace };
}

function modelScalarValue(value: RValue, name: string): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3265", `${name} must be one finite number.`);
  }
  const result = realAt(value, 0);
  if (!Number.isFinite(result)) {
    throw new RTypeMismatchError("NRT3265", `${name} must be one finite number.`);
  }
  return result;
}

function glmControlObject(control: GlmControl): RList {
  return listValue(
    [
      doubleVector([control.epsilon]),
      integerVector([control.maxit]),
      logicalVector([control.trace]),
    ],
    ["epsilon", "maxit", "trace"],
  );
}

function glmResponseValues(
  response: AtomicVector,
  family: GlmFamilyDescriptor,
  invocation: BuiltinInvocation,
): { readonly values: Float64Array; readonly trials?: Float64Array } {
  const dimensions = vectorDimensions(response);
  if (dimensions !== undefined) {
    if (
      dimensions.length !== 2 ||
      dimensions[1] !== 2 ||
      !isBinomialFamilyName(family.name) ||
      (response.type !== "logical" && response.type !== "integer" && response.type !== "double")
    ) {
      throw new RTypeMismatchError(
        "NRT3265",
        "A matrix response is supported only as a two-column binomial success/failure matrix.",
      );
    }
    const rows = dimensions[0] ?? 0;
    const values = new Float64Array(rows);
    const trials = new Float64Array(rows);
    for (let index = 0; index < rows; index += 1) {
      const success = realAt(response, index);
      const failure = realAt(response, index + rows);
      const total = success + failure;
      if (
        isMissing(response, index) ||
        isMissing(response, index + rows) ||
        !Number.isFinite(success) ||
        !Number.isFinite(failure) ||
        success < 0 ||
        failure < 0 ||
        total <= 0
      ) {
        throw new RTypeMismatchError(
          "NRT3265",
          "Binomial success and failure counts must be finite, non-negative, and have positive totals.",
        );
      }
      values[index] = success / total;
      trials[index] = total;
    }
    invocation.context.allocate(rows * 2);
    return { values, trials };
  }
  const output = new Float64Array(response.length);
  const factor = isFactor(response);
  const characterLevels =
    response.type === "character"
      ? [...new Set(response.values.filter((_value, index) => !isMissing(response, index)))].sort()
      : undefined;
  if (
    (factor || characterLevels !== undefined) &&
    isBinomialFamilyName(family.name) &&
    (factor ? factorLevels(response).length : characterLevels?.length) !== 2
  ) {
    throw new RTypeMismatchError("NRT3265", "binomial factor responses must have two levels.");
  }
  for (let index = 0; index < response.length; index += 1) {
    invocation.context.checkpoint();
    const value =
      response.type === "character"
        ? isBinomialFamilyName(family.name)
          ? (characterLevels?.indexOf(response.values[index] ?? "") ?? -1)
          : Number.NaN
        : factor && isBinomialFamilyName(family.name)
          ? realAt(response, index) - 1
          : realAt(response, index);
    if (!Number.isFinite(value)) throw new RTypeMismatchError("NRT3265", "NA/NaN/Inf in 'y'");
    if (isBinomialFamilyName(family.name) && (value < 0 || value > 1)) {
      throw new RTypeMismatchError("NRT3265", "y values must be 0 <= y <= 1");
    }
    if (isPoissonFamilyName(family.name) && value < 0) {
      throw new RTypeMismatchError(
        "NRT3265",
        "negative values not allowed for the 'Poisson' family",
      );
    }
    if (family.name === "Gamma" && value <= 0) {
      throw new RTypeMismatchError(
        "NRT3265",
        "non-positive values not allowed for the 'Gamma' family",
      );
    }
    output[index] = value;
  }
  return { values: output };
}

async function fitGlmIrls(
  design: ModelMatrixResult,
  response: Float64Array,
  suppliedWeights: Float64Array | undefined,
  suppliedOffset: Float64Array | undefined,
  family: GlmFamilyDescriptor,
  control: GlmControl,
  start: Float64Array | undefined,
  etaStart: Float64Array | undefined,
  muStart: Float64Array | undefined,
  invocation: BuiltinInvocation,
): Promise<GlmFitResult> {
  const rows = design.rows;
  const priorWeights = suppliedWeights ?? new Float64Array(rows).fill(1);
  const offset = suppliedOffset ?? new Float64Array(rows);
  let eta: Float64Array;
  let mu: Float64Array;
  if (etaStart !== undefined) {
    eta = Float64Array.from(etaStart);
    mu = await glmFamilyTransform(eta, family, "linkinv", invocation);
  } else if (muStart !== undefined) {
    mu = Float64Array.from(muStart);
    eta = await glmFamilyTransform(mu, family, "linkfun", invocation);
  } else if (start !== undefined) {
    eta = glmLinearPredictor(design, start, offset);
    mu = await glmFamilyTransform(eta, family, "linkinv", invocation);
  } else {
    mu = await glmInitialMu(response, priorWeights, family, invocation);
    eta = await glmFamilyTransform(mu, family, "linkfun", invocation);
  }
  let deviance = await glmDeviance(family, response, mu, priorWeights, invocation);
  let solved: LeastSquaresResult | undefined;
  const workingWeights = new Float64Array(rows);
  const workingResiduals = new Float64Array(rows);
  let iterations = 0;
  let converged = false;
  let boundary = false;
  for (let iteration = 1; iteration <= control.maxit; iteration += 1) {
    invocation.context.checkpoint();
    const workingResponse = new Float64Array(rows);
    const derivatives = await glmFamilyTransform(eta, family, "muEta", invocation);
    const variances = await glmFamilyTransform(mu, family, "variance", invocation);
    for (let row = 0; row < rows; row += 1) {
      const derivative = derivatives[row] ?? Number.NaN;
      const variance = variances[row] ?? Number.NaN;
      if (
        !Number.isFinite(derivative) ||
        derivative === 0 ||
        !Number.isFinite(variance) ||
        variance <= 0
      ) {
        throw new REvaluationError("NRE2136", "NA/NaN/Inf in 'x'");
      }
      workingResiduals[row] = ((response[row] ?? 0) - (mu[row] ?? 0)) / derivative;
      workingResponse[row] = (eta[row] ?? 0) + (workingResiduals[row] ?? 0);
      workingWeights[row] = ((priorWeights[row] ?? 1) * derivative * derivative) / variance;
    }
    solved = solveLeastSquares(
      design.matrix.values,
      rows,
      design.columns,
      workingResponse,
      workingWeights,
      offset,
      invocation,
    );
    const nextEta = Float64Array.from(solved.fitted);
    const nextMu = await glmFamilyTransform(nextEta, family, "linkinv", invocation);
    const nextDeviance = await glmDeviance(family, response, nextMu, priorWeights, invocation);
    iterations = iteration;
    eta = nextEta;
    mu = nextMu;
    if (Math.abs(nextDeviance - deviance) / (0.1 + Math.abs(nextDeviance)) < control.epsilon) {
      deviance = nextDeviance;
      converged = true;
      break;
    }
    deviance = nextDeviance;
  }
  if (solved === undefined) throw new Error();
  const finalDerivatives = await glmFamilyTransform(eta, family, "muEta", invocation);
  const finalVariances = await glmFamilyTransform(mu, family, "variance", invocation);
  for (let row = 0; row < rows; row += 1) {
    const derivative = finalDerivatives[row] ?? Number.NaN;
    const variance = finalVariances[row] ?? Number.NaN;
    workingResiduals[row] = ((response[row] ?? 0) - (mu[row] ?? 0)) / derivative;
    workingWeights[row] = ((priorWeights[row] ?? 1) * derivative * derivative) / variance;
    if (
      (isBinomialFamilyName(family.name) &&
        ((mu[row] ?? 0) < 10 * Number.EPSILON || (mu[row] ?? 0) > 1 - 10 * Number.EPSILON)) ||
      (isPoissonFamilyName(family.name) && (mu[row] ?? 0) < 10 * Number.EPSILON)
    ) {
      boundary = true;
    }
  }
  const devianceComponents = await glmDevianceComponents(
    family,
    response,
    mu,
    priorWeights,
    invocation,
  );
  const devianceResiduals = Float64Array.from(
    { length: rows },
    (_unused, row) =>
      Math.sign((response[row] ?? 0) - (mu[row] ?? 0)) *
      Math.sqrt(Math.max(0, devianceComponents[row] ?? 0)),
  );
  invocation.context.allocate(rows * 8);
  return {
    solved,
    mu,
    eta,
    workingWeights,
    workingResiduals,
    devianceResiduals,
    deviance,
    iterations,
    converged,
    boundary,
  };
}

async function fitGlmNullModel(
  response: Float64Array,
  weights: Float64Array,
  offset: Float64Array | undefined,
  family: GlmFamilyDescriptor,
  control: GlmControl,
  invocation: BuiltinInvocation,
): Promise<GlmFitResult> {
  const rows = response.length;
  let matrix = withDimensions(doubleVector(new Float64Array(rows).fill(1)), [rows, 1]);
  matrix = withAttribute(
    matrix,
    "dimnames",
    listValue([
      characterVector(Array.from({ length: rows }, (_unused, index) => String(index + 1))),
      characterVector(["(Intercept)"]),
    ]),
  );
  const design: ModelMatrixResult = {
    matrix,
    rows,
    columns: 1,
    columnNames: ["(Intercept)"],
    assign: [0],
    xlevels: new Map(),
    contrasts: new Set(),
    contrastSpecifications: new Map(),
  };
  return fitGlmIrls(
    design,
    response,
    weights,
    offset,
    family,
    control,
    undefined,
    undefined,
    undefined,
    invocation,
  );
}

async function glmInitialMu(
  response: Float64Array,
  weights: Float64Array,
  family: GlmFamilyDescriptor,
  invocation: BuiltinInvocation,
): Promise<Float64Array> {
  if (family.callbacks !== undefined) {
    const environment = createEnvironment(invocation.currentEnvironment());
    setBinding(environment, "y", doubleVector(response));
    setBinding(environment, "weights", doubleVector(weights));
    setBinding(environment, "nobs", integerVector([response.length]));
    const initialize = family.callbacks.initialize;
    if (initialize.type === "expression") {
      for (const expression of initialize.values) {
        await invocation.evaluate({ type: "language", expression }, environment);
      }
    } else if (initialize.type === "language") {
      await invocation.evaluate(initialize, environment);
    }
    const binding = lookupBinding(environment, "mustart");
    if (binding === undefined) {
      throw new RTypeMismatchError("NRT3265", "custom family initialize did not define 'mustart'");
    }
    const value = modelRealVector(await invocation.force(binding), "family mustart");
    const output = glmFamilyRealValues(value, response.length, "family mustart");
    await validateGlmFamilyValues(family.callbacks.validMu, output, "validmu", invocation);
    return output;
  }
  if (family.name === "gaussian") return Float64Array.from(response);
  if (isBinomialFamilyName(family.name)) {
    return Float64Array.from(response, (value, index) => {
      const weight = weights[index] ?? 1;
      return (weight * value + 0.5) / (weight + 1);
    });
  }
  if (family.name === "Gamma") return Float64Array.from(response);
  return Float64Array.from(response, (value) => value + 0.1);
}

function glmLinearPredictor(
  design: ModelMatrixResult,
  coefficients: Float64Array,
  offset: Float64Array,
): Float64Array {
  return Float64Array.from({ length: design.rows }, (_unused, row) => {
    let value = offset[row] ?? 0;
    for (let column = 0; column < design.columns; column += 1) {
      value +=
        (design.matrix.values[row + column * design.rows] ?? 0) * (coefficients[column] ?? 0);
    }
    return value;
  });
}

function glmLink(mu: number, family: GlmFamilyDescriptor): number {
  if (family.link === "identity") return mu;
  if (family.link === "log") return Math.log(mu);
  if (family.link === "inverse") return 1 / mu;
  if (family.link === "sqrt") return Math.sqrt(mu);
  if (family.link === "logit") return Math.log(mu / (1 - mu));
  if (family.link === "probit") return normalQuantile(mu);
  if (family.link === "cauchit") return Math.tan(Math.PI * (mu - 0.5));
  return Math.log(-Math.log(1 - mu));
}

function glmLinkInverse(eta: number, family: GlmFamilyDescriptor): number {
  let value: number;
  if (family.link === "identity") value = eta;
  else if (family.link === "log") value = Math.exp(eta);
  else if (family.link === "inverse") value = 1 / eta;
  else if (family.link === "sqrt") value = eta * eta;
  else if (family.link === "logit")
    value = eta >= 0 ? 1 / (1 + Math.exp(-eta)) : Math.exp(eta) / (1 + Math.exp(eta));
  else if (family.link === "probit") value = normalProbability(eta, true);
  else if (family.link === "cauchit") value = Math.atan(eta) / Math.PI + 0.5;
  else value = 1 - Math.exp(-Math.exp(eta));
  if (isBinomialFamilyName(family.name))
    return Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, value));
  if (isPoissonFamilyName(family.name)) return Math.max(Number.MIN_VALUE, value);
  if (family.name === "Gamma") return Math.max(Number.MIN_VALUE, value);
  return value;
}

function glmMuEta(eta: number, family: GlmFamilyDescriptor): number {
  if (family.link === "identity") return 1;
  if (family.link === "log") return Math.exp(eta);
  if (family.link === "inverse") return -1 / (eta * eta);
  if (family.link === "sqrt") return 2 * eta;
  if (family.link === "logit") {
    const mu = glmLinkInverse(eta, family);
    return Math.max(Number.EPSILON, mu * (1 - mu));
  }
  if (family.link === "probit") return Math.exp((-eta * eta) / 2) / Math.sqrt(2 * Math.PI);
  if (family.link === "cauchit") return 1 / (Math.PI * (1 + eta * eta));
  return Math.exp(eta - Math.exp(eta));
}

function glmVariance(mu: number, family: GlmFamilyDescriptor): number {
  if (family.name === "gaussian") return 1;
  if (isBinomialFamilyName(family.name)) return mu * (1 - mu);
  if (family.name === "Gamma") return mu * mu;
  return mu;
}

async function glmFamilyTransform(
  input: Float64Array,
  family: GlmFamilyDescriptor,
  field: "linkfun" | "linkinv" | "muEta" | "variance",
  invocation: BuiltinInvocation,
): Promise<Float64Array> {
  if (family.callbacks === undefined) {
    const transform =
      field === "linkfun"
        ? glmLink
        : field === "linkinv"
          ? glmLinkInverse
          : field === "muEta"
            ? glmMuEta
            : glmVariance;
    return Float64Array.from(input, (value) => transform(value, family));
  }
  const argument = field === "linkfun" || field === "variance" ? "mu" : "eta";
  const output = await invokeGlmFamilyVector(
    family.callbacks[field],
    [{ name: argument, value: doubleVector(input) }],
    input.length,
    field === "muEta" ? "mu.eta" : field,
    invocation,
  );
  if (field === "linkfun")
    await validateGlmFamilyValues(family.callbacks.validEta, output, "valideta", invocation);
  else if (field === "linkinv")
    await validateGlmFamilyValues(family.callbacks.validMu, output, "validmu", invocation);
  return output;
}

async function invokeGlmFamilyVector(
  callable: RValue,
  arguments_: readonly { readonly name: string; readonly value: RValue }[],
  length: number,
  field: string,
  invocation: BuiltinInvocation,
): Promise<Float64Array> {
  const value = await invocation.invoke(callable, arguments_);
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3265", `custom family '${field}' must return numeric values`);
  }
  return glmFamilyRealValues(value, length, `custom family '${field}'`);
}

function glmFamilyRealValues(value: RealVector, length: number, field: string): Float64Array {
  if (value.length !== length && value.length !== 1 && length !== 0) {
    throw new RTypeMismatchError(
      "NRT3265",
      `${field} returned length ${value.length}; expected 1 or ${length}`,
    );
  }
  if (value.length === 0 && length > 0) {
    throw new RTypeMismatchError("NRT3265", `${field} returned no values`);
  }
  return Float64Array.from({ length }, (_unused, index) => {
    const source = value.length === 1 ? 0 : index;
    return isMissing(value, source) ? Number.NaN : realAt(value, source);
  });
}

async function validateGlmFamilyValues(
  callable: RValue | undefined,
  values: Float64Array,
  field: string,
  invocation: BuiltinInvocation,
): Promise<void> {
  if (callable === undefined) return;
  const result = await invocation.invoke(callable, [
    { name: field === "validmu" ? "mu" : "eta", value: doubleVector(values) },
  ]);
  if (
    result.type !== "logical" ||
    result.length < 1 ||
    isMissing(result, 0) ||
    result.values[0] !== 1
  ) {
    throw new REvaluationError("NRE2136", `invalid values produced by custom family '${field}'`);
  }
}

async function glmDeviance(
  family: GlmFamilyDescriptor,
  response: Float64Array,
  mu: Float64Array,
  weights: Float64Array,
  invocation: BuiltinInvocation,
): Promise<number> {
  const components = await glmDevianceComponents(family, response, mu, weights, invocation);
  return components.reduce((sum, value) => sum + value, 0);
}

async function glmDevianceComponents(
  family: GlmFamilyDescriptor,
  response: Float64Array,
  mu: Float64Array,
  weights: Float64Array,
  invocation: BuiltinInvocation,
): Promise<Float64Array> {
  if (family.callbacks !== undefined) {
    return invokeGlmFamilyVector(
      family.callbacks.deviance,
      [
        { name: "y", value: doubleVector(response) },
        { name: "mu", value: doubleVector(mu) },
        { name: "wt", value: doubleVector(weights) },
      ],
      response.length,
      "dev.resids",
      invocation,
    );
  }
  return Float64Array.from({ length: response.length }, (_unused, index) =>
    glmDevianceComponent(family, response[index] ?? 0, mu[index] ?? 0, weights[index] ?? 1),
  );
}

function glmDevianceComponent(
  family: GlmFamilyDescriptor,
  y: number,
  mu: number,
  weight: number,
): number {
  if (family.name === "gaussian") return weight * (y - mu) ** 2;
  if (isBinomialFamilyName(family.name)) {
    const success = y === 0 ? 0 : y * Math.log(y / mu);
    const failure = y === 1 ? 0 : (1 - y) * Math.log((1 - y) / (1 - mu));
    return 2 * weight * (success + failure);
  }
  if (family.name === "Gamma") {
    return 2 * weight * ((y - mu) / mu - Math.log(y / mu));
  }
  return 2 * weight * (y === 0 ? mu : y * Math.log(y / mu) - (y - mu));
}

async function glmAic(
  family: GlmFamilyDescriptor,
  response: Float64Array,
  mu: Float64Array,
  weights: Float64Array,
  deviance: number,
  invocation: BuiltinInvocation,
): Promise<number> {
  if (family.callbacks !== undefined) {
    const value = await invocation.invoke(family.callbacks.aic, [
      { name: "y", value: doubleVector(response) },
      { name: "n", value: doubleVector(new Float64Array(response.length).fill(1)) },
      { name: "mu", value: doubleVector(mu) },
      { name: "wt", value: doubleVector(weights) },
      { name: "dev", value: doubleVector([deviance]) },
    ]);
    return modelScalarValue(value, "family aic");
  }
  if (isQuasiFamilyName(family.name)) return Number.NaN;
  if (family.name === "gaussian") {
    const positive = weights.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
    return positive * (Math.log((deviance / positive) * 2 * Math.PI) + 1) + 2;
  }
  if (family.name === "Gamma") {
    const positive = weights.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
    const dispersion = deviance / Math.max(1, positive);
    const shape = 1 / dispersion;
    let logLikelihood = 0;
    for (let index = 0; index < response.length; index += 1) {
      const y = response[index] ?? 0;
      const fitted = mu[index] ?? 0;
      const weight = weights[index] ?? 1;
      const scale = fitted * dispersion;
      logLikelihood +=
        weight *
        ((shape - 1) * Math.log(y) - y / scale - logGamma(shape) - shape * Math.log(scale));
    }
    return -2 * logLikelihood + 2;
  }
  let logLikelihood = 0;
  for (let index = 0; index < response.length; index += 1) {
    const y = response[index] ?? 0;
    const fitted = mu[index] ?? 0;
    const weight = weights[index] ?? 1;
    logLikelihood += isBinomialFamilyName(family.name)
      ? weight * (y * Math.log(fitted) + (1 - y) * Math.log(1 - fitted))
      : weight * (y * Math.log(fitted) - fitted - logGamma(y + 1));
  }
  return -2 * logLikelihood;
}

function glmRMatrix(design: ModelMatrixResult, solved: LeastSquaresResult): RDoubleVector {
  const values = new Float64Array(design.columns * design.columns);
  for (let column = 0; column < design.columns; column += 1) {
    for (let row = 0; row <= Math.min(column, solved.rank - 1); row += 1) {
      values[row + column * design.columns] = solved.r[row]?.[column] ?? 0;
    }
  }
  let matrix = withDimensions(doubleVector(values), [design.columns, design.columns]);
  if (design.columnNames.some((name) => name !== "")) {
    const names = characterVector(solved.pivot.map((index) => design.columnNames[index] ?? ""));
    matrix = withAttribute(matrix, "dimnames", listValue([names, names]));
  }
  return matrix;
}

async function builtinPrincipalComponents(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "x",
    "retx",
    "center",
    "scale.",
    "tol",
    "rank.",
    "...",
  ]);
  const argument = parsed.matched.get("x");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in prcomp().");
  }
  if (parsed.dots.length > 0) throw new REvaluationError("NRE2101", "Unused argument in prcomp().");
  const input = await invocation.force(argument.promise);
  const matrix = principalComponentInput(input);
  if (matrix.rows === 0 || matrix.columns === 0) {
    throw new RTypeMismatchError("NRT3265", "prcomp() requires a non-empty numeric matrix.");
  }
  const retx = await optionalModelFlag(invocation, parsed.matched.get("retx"), true, "retx");
  const center = await principalComponentTransform(
    parsed.matched.get("center"),
    true,
    matrix.columns,
    "center",
    invocation,
  );
  const scale = await principalComponentTransform(
    parsed.matched.get("scale."),
    false,
    matrix.columns,
    "scale.",
    invocation,
  );
  const centerValues = new Float64Array(matrix.columns);
  const scaleValues = new Float64Array(matrix.columns).fill(1);
  for (let column = 0; column < matrix.columns; column += 1) {
    if (center.kind === "vector") centerValues[column] = center.values[column] ?? 0;
    else if (center.enabled) {
      let sum = 0;
      for (let row = 0; row < matrix.rows; row += 1) {
        sum += matrix.values[row + column * matrix.rows] ?? 0;
      }
      centerValues[column] = sum / matrix.rows;
    }
  }
  const standardized = new Float64Array(matrix.values.length);
  for (let column = 0; column < matrix.columns; column += 1) {
    let sumSquares = 0;
    for (let row = 0; row < matrix.rows; row += 1) {
      const centered =
        (matrix.values[row + column * matrix.rows] ?? 0) - (centerValues[column] ?? 0);
      standardized[row + column * matrix.rows] = centered;
      sumSquares += centered * centered;
    }
    if (scale.kind === "vector") scaleValues[column] = scale.values[column] ?? 1;
    else if (scale.enabled)
      scaleValues[column] = Math.sqrt(sumSquares / Math.max(1, matrix.rows - 1));
    if (!Number.isFinite(scaleValues[column]) || scaleValues[column] === 0) {
      throw new RTypeMismatchError(
        "NRT3265",
        "cannot rescale a constant/zero column to unit variance",
      );
    }
    for (let row = 0; row < matrix.rows; row += 1) {
      const index = row + column * matrix.rows;
      standardized[index] = (standardized[index] ?? 0) / (scaleValues[column] ?? 1);
    }
  }
  const crossproduct = new Float64Array(matrix.columns * matrix.columns);
  for (let right = 0; right < matrix.columns; right += 1) {
    for (let left = 0; left <= right; left += 1) {
      let value = 0;
      for (let row = 0; row < matrix.rows; row += 1) {
        value +=
          (standardized[row + left * matrix.rows] ?? 0) *
          (standardized[row + right * matrix.rows] ?? 0);
      }
      crossproduct[left + right * matrix.columns] = value;
      crossproduct[right + left * matrix.columns] = value;
    }
  }
  const spectral = symmetricEigenDecomposition(crossproduct, matrix.columns, invocation);
  const singular = Float64Array.from(spectral.values, (value) => Math.sqrt(Math.max(0, value)));
  let rank = Math.min(matrix.rows, matrix.columns);
  const rankArgument = parsed.matched.get("rank.");
  if (rankArgument !== undefined && !rankArgument.promise.missing) {
    rank = Math.min(
      rank,
      Math.max(
        0,
        Math.trunc(modelScalarValue(await invocation.force(rankArgument.promise), "rank.")),
      ),
    );
  }
  const toleranceArgument = parsed.matched.get("tol");
  if (toleranceArgument !== undefined && !toleranceArgument.promise.missing) {
    const value = await invocation.force(toleranceArgument.promise);
    if (value.type !== "null") {
      const tolerance = modelScalarValue(value, "tol");
      const first = singular[0] ?? 0;
      rank = Math.min(rank, Array.from(singular).filter((item) => item > first * tolerance).length);
    }
  }
  const componentNames = Array.from({ length: rank }, (_unused, index) => `PC${index + 1}`);
  const sdev = doubleVector(
    Array.from(
      { length: rank },
      (_unused, index) => (singular[index] ?? 0) / Math.sqrt(Math.max(1, matrix.rows - 1)),
    ),
  );
  const rotationValues = new Float64Array(matrix.columns * rank);
  for (let column = 0; column < rank; column += 1) {
    for (let row = 0; row < matrix.columns; row += 1) {
      rotationValues[row + column * matrix.columns] =
        spectral.vectors[row + column * matrix.columns] ?? 0;
    }
  }
  let rotation = withDimensions(doubleVector(rotationValues), [matrix.columns, rank]);
  rotation = withAttribute(
    rotation,
    "dimnames",
    listValue([characterVector(matrix.columnNames), characterVector(componentNames)]),
  );
  const fields: { readonly name: string; readonly value: RValue }[] = [
    { name: "sdev", value: sdev },
    { name: "rotation", value: rotation },
    {
      name: "center",
      value: center.enabled
        ? withNames(doubleVector(centerValues), matrix.columnNames)
        : logicalVector([false]),
    },
    {
      name: "scale",
      value: scale.enabled
        ? withNames(doubleVector(scaleValues), matrix.columnNames)
        : logicalVector([false]),
    },
  ];
  if (retx) {
    const scores = new Float64Array(matrix.rows * rank);
    for (let column = 0; column < rank; column += 1) {
      for (let row = 0; row < matrix.rows; row += 1) {
        let value = 0;
        for (let source = 0; source < matrix.columns; source += 1) {
          value +=
            (standardized[row + source * matrix.rows] ?? 0) *
            (rotationValues[source + column * matrix.columns] ?? 0);
        }
        scores[row + column * matrix.rows] = value;
      }
    }
    let scoreMatrix = withDimensions(doubleVector(scores), [matrix.rows, rank]);
    scoreMatrix = withAttribute(
      scoreMatrix,
      "dimnames",
      listValue([characterVector(matrix.rowNames), characterVector(componentNames)]),
    );
    fields.push({ name: "x", value: scoreMatrix });
  }
  invocation.context.allocate(matrix.values.length * 2 + matrix.columns * matrix.columns);
  return withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    ["prcomp"],
  );
}

interface PrincipalComponentInput {
  readonly values: Float64Array;
  readonly rows: number;
  readonly columns: number;
  readonly rowNames: readonly string[];
  readonly columnNames: readonly string[];
}

function principalComponentInput(value: RValue): PrincipalComponentInput {
  if (isDataFrame(value)) {
    const rows = dataFrameRowCount(value);
    const names =
      vectorNames(value) ??
      Array.from({ length: value.length }, (_unused, index) => `V${index + 1}`);
    const values = new Float64Array(rows * value.length);
    value.values.forEach((column, columnIndex) => {
      if (column.type !== "logical" && column.type !== "integer" && column.type !== "double") {
        throw new RTypeMismatchError("NRT3265", "prcomp() data-frame columns must be numeric.");
      }
      for (let row = 0; row < rows; row += 1) {
        if (isMissing(column, row) || !Number.isFinite(realAt(column, row))) {
          throw new RTypeMismatchError("NRT3265", "infinite or missing values in 'x'");
        }
        values[row + columnIndex * rows] = realAt(column, row);
      }
    });
    return {
      values,
      rows,
      columns: value.length,
      rowNames: modelRowNames(value, undefined, rows),
      columnNames: names,
    };
  }
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "prcomp() requires a numeric matrix or data frame.");
  }
  const dimensions = vectorDimensions(value);
  if (dimensions?.length !== 2) {
    throw new RTypeMismatchError("NRT3265", "prcomp() requires a numeric matrix or data frame.");
  }
  const rows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  const values = new Float64Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    if (isMissing(value, index) || !Number.isFinite(realAt(value, index))) {
      throw new RTypeMismatchError("NRT3265", "infinite or missing values in 'x'");
    }
    values[index] = realAt(value, index);
  }
  const dimnames = value.attributes.get("dimnames");
  const rowNamesValue = dimnames?.type === "list" ? dimnames.values[0] : undefined;
  const columnNamesValue = dimnames?.type === "list" ? dimnames.values[1] : undefined;
  return {
    values,
    rows,
    columns,
    rowNames:
      rowNamesValue?.type === "character"
        ? rowNamesValue.values
        : Array.from({ length: rows }, (_unused, index) => String(index + 1)),
    columnNames:
      columnNamesValue?.type === "character"
        ? columnNamesValue.values
        : Array.from({ length: columns }, (_unused, index) => `PC${index + 1}`),
  };
}

type PrincipalComponentTransform =
  | { readonly kind: "logical"; readonly enabled: boolean }
  | { readonly kind: "vector"; readonly enabled: true; readonly values: Float64Array };

async function principalComponentTransform(
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  columns: number,
  name: string,
  invocation: BuiltinInvocation,
): Promise<PrincipalComponentTransform> {
  if (argument === undefined || argument.promise.missing)
    return { kind: "logical", enabled: fallback };
  const value = await invocation.force(argument.promise);
  if (value.type === "logical" && value.length === 1 && !isMissing(value, 0)) {
    return { kind: "logical", enabled: value.values[0] === 1 };
  }
  if (value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3265", `prcomp() ${name} must be logical or numeric.`);
  }
  if (value.length !== columns) {
    throw new RTypeMismatchError("NRT3265", `prcomp() ${name} has the wrong length.`);
  }
  const values = Float64Array.from({ length: columns }, (_unused, index) => {
    const item = realAt(value, index);
    if (isMissing(value, index) || !Number.isFinite(item)) {
      throw new RTypeMismatchError("NRT3265", `prcomp() ${name} must be finite.`);
    }
    return item;
  });
  return { kind: "vector", enabled: true, values };
}

async function builtinPrincipalComponentsSummary(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in summary.prcomp().");
  }
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in summary.prcomp().");
  const object = await invocation.force(argument.promise);
  if (object.type !== "list" || !vectorClasses(object)?.includes("prcomp")) {
    throw new RTypeMismatchError("NRT3265", "summary.prcomp() requires a prcomp object.");
  }
  const sdev = modelField(object, "sdev");
  if (sdev?.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The prcomp object has malformed standard deviations.");
  }
  const componentNames =
    vectorNames(sdev) ?? Array.from({ length: sdev.length }, (_unused, index) => `PC${index + 1}`);
  const variances = Array.from(sdev.values, (value) => value * value);
  const total = variances.reduce((sum, value) => sum + value, 0);
  const importance = new Float64Array(3 * sdev.length);
  let cumulative = 0;
  for (let column = 0; column < sdev.length; column += 1) {
    const proportion = total === 0 ? Number.NaN : (variances[column] ?? 0) / total;
    cumulative += proportion;
    importance[column * 3] = sdev.values[column] ?? 0;
    importance[1 + column * 3] = Math.round(proportion * 100000) / 100000;
    importance[2 + column * 3] = Math.round(cumulative * 100000) / 100000;
  }
  let importanceMatrix = withDimensions(doubleVector(importance), [3, sdev.length]);
  importanceMatrix = withAttribute(
    importanceMatrix,
    "dimnames",
    listValue([
      characterVector(["Standard deviation", "Proportion of Variance", "Cumulative Proportion"]),
      characterVector(componentNames),
    ]),
  );
  const names = vectorNames(object) ?? [];
  const fields = names.map((name, index) => ({ name, value: object.values[index] ?? R_NULL }));
  fields.push({ name: "importance", value: importanceMatrix });
  invocation.context.allocate(importance.length + fields.length);
  return withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    ["summary.prcomp"],
  );
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
    contrastSpecifications: new Map(),
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

async function builtinLinearModelFit(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "x",
    "y",
    "offset",
    "method",
    "tol",
    "singular.ok",
    "...",
  ]);
  const xArgument = parsed.matched.get("x");
  const yArgument = parsed.matched.get("y");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in lm.fit().");
  }
  if (yArgument === undefined || yArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'y' is missing in lm.fit().");
  }
  if (parsed.dots.length > 0) throw new REvaluationError("NRE2101", "Unused argument.");
  const xValue = await invocation.force(xArgument.promise);
  const yValue = await invocation.force(yArgument.promise);
  if (
    (xValue.type !== "logical" && xValue.type !== "integer" && xValue.type !== "double") ||
    isFactor(xValue)
  ) {
    throw new RTypeMismatchError("NRT3265", "'x' must be a numeric matrix");
  }
  if (
    (yValue.type !== "logical" && yValue.type !== "integer" && yValue.type !== "double") ||
    isFactor(yValue)
  ) {
    throw new RTypeMismatchError("NRT3265", "'y' must be numeric");
  }
  const dimensions = vectorDimensions(xValue);
  if (dimensions?.length !== 2) throw new RTypeMismatchError("NRT3265", "'x' must be a matrix");
  const rows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  const yDimensions = vectorDimensions(yValue);
  if (yDimensions !== undefined && yDimensions.length !== 2) {
    throw new RTypeMismatchError("NRT3265", "invalid dimensions for 'y'");
  }
  const responseColumns = yDimensions?.[1] ?? 1;
  if (
    rows === 0 ||
    columns === 0 ||
    responseColumns < 1 ||
    (yDimensions !== undefined && yDimensions[0] !== rows) ||
    yValue.length !== rows * responseColumns
  ) {
    throw new RTypeMismatchError("NRT3265", "incompatible dimensions");
  }
  const methodArgument = parsed.matched.get("method");
  if (methodArgument !== undefined && !methodArgument.promise.missing) {
    const method = await invocation.force(methodArgument.promise);
    if (
      method.type !== "character" ||
      method.length !== 1 ||
      isMissing(method, 0) ||
      method.values[0] !== "qr"
    ) {
      throw new RUnsupportedFeatureError("NRU6130", "lm.fit() currently supports method = 'qr'.");
    }
  }
  const toleranceArgument = parsed.matched.get("tol");
  const tolerance =
    toleranceArgument === undefined || toleranceArgument.promise.missing
      ? 1e-7
      : leastSquaresPositiveScalar(await invocation.force(toleranceArgument.promise), "tol");
  const singularOk = await optionalModelFlag(
    invocation,
    parsed.matched.get("singular.ok"),
    true,
    "singular.ok",
  );
  const offsetArgument = parsed.matched.get("offset");
  let offset: Float64Array | undefined;
  if (offsetArgument !== undefined && !offsetArgument.promise.missing) {
    const offsetValue = await invocation.force(offsetArgument.promise);
    if (offsetValue.type !== "null") {
      if (
        offsetValue.type !== "logical" &&
        offsetValue.type !== "integer" &&
        offsetValue.type !== "double"
      ) {
        throw new RTypeMismatchError("NRT3265", "'offset' must be numeric");
      }
      if (offsetValue.length !== rows) {
        throw new RTypeMismatchError("NRT3265", "incompatible dimensions");
      }
      offset = Float64Array.from({ length: rows }, (_unused, index) => {
        if (leastSquaresMissing(offsetValue, index)) {
          throw new RTypeMismatchError("NRT3265", "NA/NaN/Inf in 'y'");
        }
        return realAt(offsetValue, index);
      });
    }
  }
  const matrix = Float64Array.from({ length: xValue.length }, (_unused, index) => {
    if (leastSquaresMissing(xValue, index)) {
      throw new RTypeMismatchError("NRT3265", "NA/NaN/Inf in 'x'");
    }
    return realAt(xValue, index);
  });
  const responses = Array.from({ length: responseColumns }, (_unused, column) =>
    Float64Array.from({ length: rows }, (_unusedRow, row) => {
      const index = row + column * rows;
      if (leastSquaresMissing(yValue, index)) {
        throw new RTypeMismatchError("NRT3265", "NA/NaN/Inf in 'y'");
      }
      return realAt(yValue, index);
    }),
  );
  const dimnames = xValue.attributes.get("dimnames");
  const columnNames =
    dimnames?.type === "list" && dimnames.values[1]?.type === "character"
      ? dimnames.values[1].values
      : Array.from({ length: columns }, () => "");
  const designRowNames =
    dimnames?.type === "list" && dimnames.values[0]?.type === "character"
      ? dimnames.values[0].values
      : undefined;
  const yDimnames = yValue.attributes.get("dimnames");
  const outputRowNames =
    yDimnames?.type === "list" && yDimnames.values[0]?.type === "character"
      ? yDimnames.values[0].values
      : (vectorNames(yValue) ?? designRowNames);
  const responseNames =
    yDimnames?.type === "list" && yDimnames.values[1]?.type === "character"
      ? yDimnames.values[1].values
      : undefined;
  let designMatrix = withDimensions(doubleVector(matrix), [rows, columns]);
  designMatrix = withAttribute(
    designMatrix,
    "dimnames",
    listValue([
      designRowNames === undefined ? R_NULL : characterVector(designRowNames),
      columnNames.every((name) => name.length === 0) ? R_NULL : characterVector(columnNames),
    ]),
  );
  const assignValue = xValue.attributes.get("assign");
  const assign = assignValue?.type === "integer" ? Array.from(assignValue.values) : [];
  const design: ModelMatrixResult = {
    matrix: designMatrix,
    rows,
    columns,
    columnNames,
    assign,
    xlevels: new Map(),
    contrasts: new Set(),
    contrastSpecifications: new Map(),
  };
  const solutions = responses.map((response) =>
    solveLeastSquares(matrix, rows, columns, response, undefined, offset, invocation, tolerance),
  );
  const solved = solutions[0]!;
  if (!singularOk && solved.rank < columns) {
    throw new REvaluationError("NRE2137", "singular fit encountered");
  }
  const coefficientNames = columnNames.every((name) => name.length === 0) ? undefined : columnNames;
  const effectNames = Array.from(
    { length: rows },
    (_unused, index) => coefficientNames?.[index] ?? "",
  );
  const shapeResponseResult = (
    values: Float64Array,
    resultRows: number,
    rowLabels: readonly string[] | undefined,
    missing?: Uint8Array,
  ): RDoubleVector => {
    if (responseColumns === 1) {
      return rowLabels === undefined
        ? doubleVector(values, compactModelMask(missing ?? new Uint8Array()))
        : withNames(doubleVector(values, compactModelMask(missing ?? new Uint8Array())), rowLabels);
    }
    let result = withDimensions(
      doubleVector(values, compactModelMask(missing ?? new Uint8Array())),
      [resultRows, responseColumns],
    );
    result = withAttribute(
      result,
      "dimnames",
      listValue([
        rowLabels === undefined ? R_NULL : characterVector(rowLabels),
        responseNames === undefined ? R_NULL : characterVector(responseNames),
      ]),
    );
    return result;
  };
  const coefficientValues = new Float64Array(columns * responseColumns);
  const coefficientMissing = new Uint8Array(coefficientValues.length);
  const residualValues = new Float64Array(rows * responseColumns);
  const effectValues = new Float64Array(rows * responseColumns);
  const fittedValues = new Float64Array(rows * responseColumns);
  for (const [responseColumn, solution] of solutions.entries()) {
    coefficientValues.set(solution.coefficients, responseColumn * columns);
    if (solution.coefficientMissing !== undefined) {
      coefficientMissing.set(solution.coefficientMissing, responseColumn * columns);
    }
    residualValues.set(solution.residuals, responseColumn * rows);
    effectValues.set(solution.effects, responseColumn * rows);
    fittedValues.set(solution.fitted, responseColumn * rows);
  }
  const coefficients = shapeResponseResult(
    coefficientValues,
    columns,
    coefficientNames,
    coefficientMissing,
  );
  const residuals = shapeResponseResult(residualValues, rows, outputRowNames);
  const effects = shapeResponseResult(
    effectValues,
    rows,
    coefficientNames === undefined ? undefined : effectNames,
  );
  const fitted = shapeResponseResult(fittedValues, rows, outputRowNames);
  return listValue(
    [
      coefficients,
      residuals,
      effects,
      integerVector([solved.rank]),
      fitted,
      assignValue?.type === "integer" ? assignValue : R_NULL,
      linearModelQr(design, solved, tolerance),
      integerVector([rows - solved.rank]),
    ],
    [
      "coefficients",
      "residuals",
      "effects",
      "rank",
      "fitted.values",
      "assign",
      "qr",
      "df.residual",
    ],
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

function modelAtomicResponse(value: RValue): AtomicVector {
  if (
    value.type !== "logical" &&
    value.type !== "integer" &&
    value.type !== "double" &&
    value.type !== "character"
  ) {
    throw new RTypeMismatchError(
      "NRT3265",
      "glm() response must be a real, logical, factor, or character vector.",
    );
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
  if (data.length === 0) return environment;
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

async function builtinDummyCoefLm(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "use.na", "..."]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in dummy.coef.lm().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (object.type !== "list" || objectClasses(object)?.includes("lm") !== true) {
    throw new RTypeMismatchError("NRT3265", "dummy.coef.lm() requires an lm model object.");
  }
  const useNa = await optionalModelFlag(invocation, parsed.matched.get("use.na"), false, "use.na");
  const state = MODEL_INFLUENCE_STATES.get(object);
  const coefficients = modelField(object, "coefficients");
  const terms = modelField(object, "terms");
  if (
    state === undefined ||
    coefficients === undefined ||
    !isAtomic(coefficients) ||
    (coefficients.type !== "logical" &&
      coefficients.type !== "integer" &&
      coefficients.type !== "double") ||
    terms?.type !== "formula"
  ) {
    throw new RTypeMismatchError("NRT3265", "dummy.coef.lm() received a malformed lm object.");
  }

  const design = state.design;
  const values: RDoubleVector[] = [];
  const names: string[] = [];
  if (terms.intercept) {
    const interceptIndex = design.assign.indexOf(0);
    const missing = interceptIndex < 0 || isMissing(coefficients, interceptIndex);
    values.push(
      withNames(
        doubleVector(
          [missing ? 0 : realAt(coefficients, interceptIndex)],
          useNa && missing ? new Uint8Array([1]) : undefined,
        ),
        ["(Intercept)"],
      ),
    );
    names.push("(Intercept)");
  }

  const factorNames = new Set(design.xlevels.keys());
  for (const [termIndex, term] of terms.terms.entries()) {
    invocation.context.checkpoint();
    if (isOffsetModelTerm(term)) continue;
    const components = modelTermComponents(term);
    const factors = components.filter((component) => factorNames.has(component));
    const combinations = factors.reduce(
      (count, factor) => count * (design.xlevels.get(factor)?.length ?? 1),
      1,
    );
    const variables = new Map<string, AtomicVector>();
    for (const component of components) {
      const levels = design.xlevels.get(component);
      if (levels === undefined) {
        variables.set(component, doubleVector(new Float64Array(combinations).fill(1)));
        continue;
      }
      const factorPosition = factors.indexOf(component);
      const stride = factors
        .slice(0, factorPosition)
        .reduce((product, previous) => product * (design.xlevels.get(previous)?.length ?? 1), 1);
      variables.set(
        component,
        factorValue(
          Int32Array.from(
            { length: combinations },
            (_unused, row) => (Math.floor(row / stride) % levels.length) + 1,
          ),
          levels,
        ),
      );
    }
    const artificialData: PreparedModelData = {
      terms: [term],
      variables,
      rows: combinations,
      rowNames: Array.from({ length: combinations }, (_unused, row) => String(row + 1)),
      originalRows: combinations,
      selectedIndices: Array.from({ length: combinations }, (_unused, row) => row),
      omittedIndices: [],
    };
    const encoded = await encodeModelTerm(
      term,
      artificialData,
      design.xlevels,
      !terms.intercept && termIndex === 0,
      invocation,
      design.contrastSpecifications,
    );
    const coefficientIndices = design.assign.flatMap((assignment, index) =>
      assignment === termIndex + 1 ? [index] : [],
    );
    if (coefficientIndices.length !== encoded.columns.length) {
      throw new RTypeMismatchError("NRT3265", "dummy.coef.lm() found inconsistent model terms.");
    }
    const expanded = new Float64Array(combinations);
    const missing = new Uint8Array(combinations);
    for (let row = 0; row < combinations; row += 1) {
      for (const [column, encodedColumn] of encoded.columns.entries()) {
        const coefficientIndex = coefficientIndices[column];
        if (coefficientIndex === undefined) throw new Error();
        const weight = encodedColumn.values[row] ?? 0;
        if (isMissing(coefficients, coefficientIndex)) {
          if (useNa && weight !== 0) missing[row] = 1;
          continue;
        }
        expanded[row] = (expanded[row] ?? 0) + weight * realAt(coefficients, coefficientIndex);
      }
    }
    const expandedNames =
      factors.length === 0
        ? [term]
        : Array.from({ length: combinations }, (_unused, row) =>
            factors
              .map((factor, factorIndex) => {
                const levels = design.xlevels.get(factor) ?? [];
                const stride = factors
                  .slice(0, factorIndex)
                  .reduce(
                    (product, previous) => product * (design.xlevels.get(previous)?.length ?? 1),
                    1,
                  );
                return levels[Math.floor(row / stride) % levels.length] ?? "";
              })
              .join(":"),
          );
    values.push(withNames(doubleVector(expanded, compactModelMask(missing)), expandedNames));
    names.push(term);
  }
  invocation.context.allocate(values.length + values.reduce((sum, value) => sum + value.length, 0));
  const output = listValue(values, names);
  if (factorNames.size === 0) return output;
  return withAttribute(withClasses(output, ["dummy_coef"]), "matrix", logicalVector([0]));
}

async function builtinGlmFamilyAccessor(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in family.glm().");
  }
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in family.glm().");
  const object = await invocation.force(argument.promise);
  const model = requireGlmModel(object, "family.glm");
  const family = modelField(model, "family");
  if (family?.type !== "list" || !vectorClasses(family)?.includes("family")) {
    throw new RTypeMismatchError("NRT3265", "The glm object has a malformed family component.");
  }
  return family;
}

async function builtinModelNobs(invocation: BuiltinInvocation, dispatch: boolean): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "use.fallback", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in nobs().");
  }
  const object = await invocation.force(argument.promise);
  if (dispatch) {
    const dispatched = await invocation.dispatchS3IfPresent("nobs", object, invocation.arguments);
    if (dispatched !== undefined) return dispatched;
  }
  if (object.type === "list") {
    const explicit = modelField(object, "nobs");
    if (
      explicit !== undefined &&
      (explicit.type === "integer" || explicit.type === "double") &&
      explicit.length === 1 &&
      !isMissing(explicit, 0)
    ) {
      return integerVector([Math.trunc(realAt(explicit, 0))]);
    }
    const residuals = modelField(object, "residuals");
    if (residuals !== undefined && (isAtomic(residuals) || residuals.type === "list")) {
      return integerVector([residuals.length]);
    }
  }
  throw new REvaluationError("NRE2216", "no 'nobs' method is available");
}

async function builtinLinearModelNobs(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in nobs.lm().");
  }
  const object = await invocation.force(argument.promise);
  if (object.type !== "list" || !vectorClasses(object)?.includes("lm")) {
    throw new RTypeMismatchError("NRT3265", "nobs.lm() requires an lm object.");
  }
  const residuals = modelField(object, "residuals");
  if (residuals === undefined || (!isAtomic(residuals) && residuals.type !== "list")) {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed residuals.");
  }
  return integerVector([residuals.length]);
}

async function builtinModelDeviance(
  invocation: BuiltinInvocation,
  dispatch: boolean,
): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in deviance().");
  }
  const object = await invocation.force(argument.promise);
  if (dispatch) {
    const dispatched = await invocation.dispatchS3IfPresent(
      "deviance",
      object,
      invocation.arguments,
    );
    if (dispatched !== undefined) return dispatched;
  }
  if (object.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "deviance() requires a fitted model object.");
  }
  const value = modelField(object, "deviance");
  if (value !== undefined) return value;
  if (!isLinearModel(object)) return R_NULL;
  const residuals = modelField(object, "residuals");
  const weights = modelField(object, "weights");
  if (
    residuals === undefined ||
    (residuals.type !== "logical" && residuals.type !== "integer" && residuals.type !== "double")
  ) {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed residuals.");
  }
  const realWeights =
    weights === undefined || weights.type === "null"
      ? undefined
      : weights.type === "logical" || weights.type === "integer" || weights.type === "double"
        ? weights
        : null;
  if (
    realWeights === null ||
    (realWeights !== undefined && realWeights.length !== residuals.length)
  ) {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed weights.");
  }
  let sum = 0;
  for (let index = 0; index < residuals.length; index += 1) {
    invocation.context.checkpoint();
    if (
      isMissing(residuals, index) ||
      (realWeights !== undefined && isMissing(realWeights, index))
    ) {
      return doubleVector([0], new Uint8Array([1]));
    }
    const residual = realAt(residuals, index);
    const weight = realWeights === undefined ? 1 : realAt(realWeights, index);
    sum += weight * residual * residual;
  }
  return doubleVector([sum]);
}

async function builtinGlmResiduals(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "type", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in residuals.glm().");
  }
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in residuals.glm().");
  const model = requireGlmModel(await invocation.force(argument.promise), "residuals.glm");
  const typeArgument = parsed.matched.get("type");
  let type = "deviance";
  if (typeArgument !== undefined && !typeArgument.promise.missing) {
    const value = await invocation.force(typeArgument.promise);
    if (value.type !== "character" || value.length === 0 || isMissing(value, 0)) {
      throw new RTypeMismatchError("NRT3265", "residuals.glm() type must be a string.");
    }
    const requested = value.values[0] ?? "";
    const choices = ["deviance", "pearson", "working", "response", "partial"];
    const matches = choices.filter((choice) => choice.startsWith(requested));
    if (matches.length !== 1) {
      throw new REvaluationError("NRE2131", `invalid residual type '${requested}'`);
    }
    type = matches[0] ?? type;
  }
  const family = glmDescriptorFromObject(modelField(model, "family"));
  return glmResidualVector(model, family, type, invocation, "residuals.glm");
}

async function builtinGlmLogLikelihood(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in logLik.glm().");
  }
  if (parsed.dots.length > 0) {
    throw new REvaluationError("NRE2101", "Unused argument in logLik.glm().");
  }
  const model = requireGlmModel(await invocation.force(argument.promise), "logLik.glm");
  const family = glmDescriptorFromObject(modelField(model, "family"));
  const rank = modelIntegerField(model, "rank");
  const aic = modelScalar(model, "aic", "logLik.glm");
  const estimatesDispersion = family.name === "gaussian" || family.name === "Gamma";
  const degrees = rank + (estimatesDispersion ? 1 : 0);
  const residuals = requiredRealModelField(model, "residuals", "logLik.glm");
  let result = doubleVector([degrees - aic / 2]);
  result = withAttribute(result, "nobs", integerVector([residuals.length]));
  result = withAttribute(
    result,
    "df",
    estimatesDispersion ? doubleVector([degrees]) : integerVector([degrees]),
  );
  return withClasses(result, ["logLik"]);
}

async function glmResidualVector(
  model: RList,
  family: GlmFamilyDescriptor,
  type: string,
  invocation: BuiltinInvocation,
  call: string,
): Promise<RValue> {
  const response = requiredRealModelField(model, "y", call);
  const fitted = requiredRealModelField(model, "fitted.values", call);
  const working = requiredRealModelField(model, "residuals", call);
  const prior = requiredRealModelField(model, "prior.weights", call);
  const names = vectorNames(fitted);
  if (type === "working") return names === undefined ? working : withNames(working, names);
  const muValues = Float64Array.from({ length: fitted.length }, (_unused, index) =>
    realAt(fitted, index),
  );
  const responseValues = Float64Array.from({ length: response.length }, (_unused, index) =>
    realAt(response, index),
  );
  const priorValues = Float64Array.from({ length: prior.length }, (_unused, index) =>
    realAt(prior, index),
  );
  const variances =
    type === "pearson"
      ? await glmFamilyTransform(muValues, family, "variance", invocation)
      : undefined;
  const devianceComponents =
    type === "deviance"
      ? await glmDevianceComponents(family, responseValues, muValues, priorValues, invocation)
      : undefined;
  const output = new Float64Array(response.length);
  for (let index = 0; index < response.length; index += 1) {
    const y = realAt(response, index);
    const mu = realAt(fitted, index);
    const weight = realAt(prior, index);
    if (type === "response") output[index] = y - mu;
    else if (type === "pearson") {
      output[index] = ((y - mu) * Math.sqrt(weight)) / Math.sqrt(variances?.[index] ?? Number.NaN);
    } else if (type === "partial") {
      output[index] =
        realAt(working, index) +
        (modelField(model, "linear.predictors")?.type === "double"
          ? realAt(modelField(model, "linear.predictors") as RDoubleVector, index)
          : 0);
    } else {
      const component = devianceComponents?.[index] ?? Number.NaN;
      output[index] = Math.sign(y - mu) * Math.sqrt(Math.max(0, component));
    }
  }
  const result = doubleVector(output);
  return names === undefined ? result : withNames(result, names);
}

async function builtinGlmSummary(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "object",
    "dispersion",
    "correlation",
    "symbolic.cor",
    "...",
  ]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in summary.glm().");
  }
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in summary.glm().");
  const correlationArgument = parsed.matched.get("correlation");
  if (
    correlationArgument !== undefined &&
    !correlationArgument.promise.missing &&
    modelLogicalFlag(await invocation.force(correlationArgument.promise), false, "correlation")
  ) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "summary.glm(correlation = TRUE) is not implemented yet.",
    );
  }
  const symbolicArgument = parsed.matched.get("symbolic.cor");
  if (
    symbolicArgument !== undefined &&
    !symbolicArgument.promise.missing &&
    modelLogicalFlag(await invocation.force(symbolicArgument.promise), false, "symbolic.cor")
  ) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "summary.glm(symbolic.cor = TRUE) is not implemented yet.",
    );
  }
  const model = requireGlmModel(await invocation.force(argument.promise), "summary.glm");
  const family = glmDescriptorFromObject(modelField(model, "family"));
  const coefficients = modelField(model, "coefficients");
  if (coefficients?.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The glm object has malformed coefficients.");
  }
  const degrees = modelIntegerField(model, "df.residual");
  const dispersionArgument = parsed.matched.get("dispersion");
  let dispersion: number;
  if (dispersionArgument !== undefined && !dispersionArgument.promise.missing) {
    const value = await invocation.force(dispersionArgument.promise);
    dispersion = value.type === "null" ? Number.NaN : modelScalarValue(value, "dispersion");
  } else dispersion = Number.NaN;
  if (Number.isNaN(dispersion)) {
    dispersion =
      family.fixedDispersion ?? (await glmPearsonDispersion(model, family, invocation)) / degrees;
  }
  if (dispersion < 0) {
    throw new RTypeMismatchError("NRT3265", "dispersion must not be negative");
  }
  const { unscaled, scaled } = glmCovarianceMatrices(model, dispersion, invocation);
  const coefficientNames =
    vectorNames(coefficients) ??
    Array.from({ length: coefficients.length }, (_, index) => String(index + 1));
  const rows = coefficients.length;
  const table = new Float64Array(rows * 4);
  const missing = new Uint8Array(rows * 4);
  for (let row = 0; row < rows; row += 1) {
    if (isMissing(coefficients, row) || isMissing(scaled, row + row * rows)) {
      for (let column = 0; column < 4; column += 1) missing[row + column * rows] = 1;
      continue;
    }
    const estimate = coefficients.values[row] ?? 0;
    const standardError = Math.sqrt(Math.max(0, scaled.values[row + row * rows] ?? 0));
    const statistic = estimate / standardError;
    const probability =
      family.fixedDispersion !== undefined
        ? 2 * normalProbability(Math.abs(statistic), false)
        : 2 * studentTProbability(Math.abs(statistic), degrees, false);
    table[row] = estimate;
    table[row + rows] = standardError;
    table[row + 2 * rows] = statistic;
    table[row + 3 * rows] = probability;
  }
  let coefficientTable = withDimensions(doubleVector(table, compactModelMask(missing)), [rows, 4]);
  coefficientTable = withAttribute(
    coefficientTable,
    "dimnames",
    listValue([
      characterVector(coefficientNames),
      characterVector([
        "Estimate",
        "Std. Error",
        family.fixedDispersion !== undefined ? "z value" : "t value",
        family.fixedDispersion !== undefined ? "Pr(>|z|)" : "Pr(>|t|)",
      ]),
    ]),
  );
  const aliased = logicalVector(
    Array.from({ length: rows }, (_, index) => isMissing(coefficients, index)),
  );
  const devianceResiduals = await glmResidualVector(
    model,
    family,
    "deviance",
    invocation,
    "summary.glm",
  );
  const rank = modelIntegerField(model, "rank");
  const dfNull = modelIntegerField(model, "df.null");
  const fields: { readonly name: string; readonly value: RValue }[] = [
    { name: "call", value: modelField(model, "call") ?? R_NULL },
    { name: "terms", value: modelField(model, "terms") ?? R_NULL },
    { name: "family", value: family.object },
    { name: "deviance", value: modelField(model, "deviance") ?? R_NULL },
    { name: "aic", value: modelField(model, "aic") ?? R_NULL },
  ];
  const contrasts = modelField(model, "contrasts");
  if (contrasts !== undefined) fields.push({ name: "contrasts", value: contrasts });
  fields.push(
    { name: "df.residual", value: integerVector([degrees]) },
    { name: "null.deviance", value: modelField(model, "null.deviance") ?? R_NULL },
    { name: "df.null", value: integerVector([dfNull]) },
    { name: "iter", value: modelField(model, "iter") ?? R_NULL },
    { name: "deviance.resid", value: devianceResiduals },
    { name: "coefficients", value: coefficientTable },
    { name: "aliased", value: aliased },
    { name: "dispersion", value: doubleVector([dispersion]) },
    { name: "df", value: integerVector([rank, degrees, dfNull]) },
    { name: "cov.unscaled", value: unscaled },
    { name: "cov.scaled", value: scaled },
  );
  invocation.context.allocate(fields.length + rows * 4);
  return withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    ["summary.glm"],
  );
}

async function glmPearsonDispersion(
  model: RList,
  family: GlmFamilyDescriptor,
  invocation: BuiltinInvocation,
): Promise<number> {
  const response = requiredRealModelField(model, "y", "summary.glm");
  const fitted = requiredRealModelField(model, "fitted.values", "summary.glm");
  const prior = requiredRealModelField(model, "prior.weights", "summary.glm");
  const fittedValues = Float64Array.from({ length: fitted.length }, (_unused, index) =>
    realAt(fitted, index),
  );
  const variances = await glmFamilyTransform(fittedValues, family, "variance", invocation);
  let sum = 0;
  for (let index = 0; index < response.length; index += 1) {
    const difference = realAt(response, index) - realAt(fitted, index);
    sum += (realAt(prior, index) * difference * difference) / (variances[index] ?? Number.NaN);
  }
  return sum;
}

async function builtinGlmAnova(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "...", "dispersion", "test"]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in anova.glm().");
  }
  if (parsed.dots.some((entry) => entry.name === undefined)) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "Multiple-model anova.glm() comparisons are not implemented yet.",
    );
  }
  const model = requireGlmModel(await invocation.force(argument.promise), "anova.glm");
  const family = glmDescriptorFromObject(modelField(model, "family"));
  const formulaValue = modelField(model, "terms");
  const frame = modelField(model, "model");
  if (formulaValue?.type !== "formula" || frame?.type !== "list" || !isDataFrame(frame)) {
    throw new RTypeMismatchError(
      "NRT3265",
      "anova.glm() requires retained model terms and model frame.",
    );
  }
  const testArgument = parsed.matched.get("test");
  if (testArgument !== undefined && !testArgument.promise.missing) {
    const value = await invocation.force(testArgument.promise);
    if (value.type !== "null") {
      if (value.type !== "character" || value.length !== 1 || isMissing(value, 0)) {
        throw new RTypeMismatchError("NRT3265", "anova.glm() test must be a string or NULL.");
      }
      const test = (value.values[0] ?? "").toLowerCase();
      if (test !== "chisq" && test !== "chi" && test !== "lrt") {
        throw new RUnsupportedFeatureError(
          "NRU6130",
          "anova.glm() currently supports likelihood-ratio Chi-squared tests.",
        );
      }
    }
  }
  const environment = modelDataEnvironment(
    frame,
    formulaValue.environment ?? invocation.currentEnvironment(),
    "anova.glm()",
  );
  const prepared = await prepareModelData(
    {
      formula: formulaValue,
      data: frame,
      environment,
      requireResponse: true,
      allowCategoricalResponse: true,
      omitMissing: true,
      xlevels: modelXLevels(model),
    },
    invocation,
  );
  const response = prepared.response;
  if (response === undefined) throw new Error();
  const responseValues = glmResponseValues(response, family, invocation).values;
  const design = await buildModelMatrix(prepared, formulaValue, modelXLevels(model), invocation);
  const priorValue = requiredRealModelField(model, "prior.weights", "anova.glm");
  const offsetValue = requiredRealModelField(model, "offset", "anova.glm");
  const prior = Float64Array.from({ length: priorValue.length }, (_unused, index) =>
    realAt(priorValue, index),
  );
  const offset = Float64Array.from({ length: offsetValue.length }, (_unused, index) =>
    realAt(offsetValue, index),
  );
  const controlValue = modelField(model, "control");
  const control = glmControlFromObject(controlValue);
  const terms = prepared.terms.filter((term) => !isOffsetModelTerm(term));
  const residualDegrees = new Int32Array(terms.length + 1);
  const residualDeviance = new Float64Array(terms.length + 1);
  const ranks = new Int32Array(terms.length + 1);
  const positiveRows = prior.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
  for (let stage = 0; stage <= terms.length; stage += 1) {
    const stageDesign = selectGlmDesign(design, stage);
    const fit = await fitGlmIrls(
      stageDesign,
      responseValues,
      prior,
      offset,
      family,
      control,
      undefined,
      undefined,
      undefined,
      invocation,
    );
    ranks[stage] = fit.solved.rank;
    residualDegrees[stage] = positiveRows - fit.solved.rank;
    residualDeviance[stage] = fit.deviance;
  }
  const differences = new Int32Array(terms.length + 1);
  const differenceMissing = new Uint8Array(terms.length + 1);
  const deviances = new Float64Array(terms.length + 1);
  const devianceMissing = new Uint8Array(terms.length + 1);
  const probabilities = new Float64Array(terms.length + 1);
  const probabilityMissing = new Uint8Array(terms.length + 1);
  differenceMissing[0] = 1;
  devianceMissing[0] = 1;
  probabilityMissing[0] = 1;
  for (let stage = 1; stage <= terms.length; stage += 1) {
    differences[stage] = (ranks[stage] ?? 0) - (ranks[stage - 1] ?? 0);
    deviances[stage] = Math.max(
      0,
      (residualDeviance[stage - 1] ?? 0) - (residualDeviance[stage] ?? 0),
    );
    probabilities[stage] = regularizedGammaProbability(
      (deviances[stage] ?? 0) / 2,
      (differences[stage] ?? 0) / 2,
      false,
    );
  }
  const table = dataFrameValue(
    [
      integerVector(differences, differenceMissing),
      doubleVector(deviances, devianceMissing),
      integerVector(residualDegrees),
      doubleVector(residualDeviance),
      doubleVector(probabilities, probabilityMissing),
    ],
    ["Df", "Deviance", "Resid. Df", "Resid. Dev", "Pr(>Chi)"],
    ["NULL", ...terms],
    false,
  );
  const heading = `Analysis of Deviance Table\n\nModel: ${family.name}, link: ${family.link}\n\nResponse: ${
    formulaValue.response ?? ""
  }\n\nTerms added sequentially (first to last)\n\n`;
  invocation.context.allocate((terms.length + 1) * 5);
  return withAttribute(
    withClasses(table, ["anova", "data.frame"]),
    "heading",
    characterVector([heading]),
  );
}

function selectGlmDesign(design: ModelMatrixResult, stage: number): ModelMatrixResult {
  const selected = design.assign
    .map((assignment, index) => ({ assignment, index }))
    .filter(({ assignment }) => assignment === 0 || assignment <= stage);
  const values = new Float64Array(design.rows * selected.length);
  for (let column = 0; column < selected.length; column += 1) {
    const sourceColumn = selected[column]?.index ?? 0;
    for (let row = 0; row < design.rows; row += 1) {
      values[row + column * design.rows] =
        design.matrix.values[row + sourceColumn * design.rows] ?? 0;
    }
  }
  let matrix = withDimensions(doubleVector(values), [design.rows, selected.length]);
  const sourceDimnames = design.matrix.attributes.get("dimnames");
  const rowNames = sourceDimnames?.type === "list" ? (sourceDimnames.values[0] ?? R_NULL) : R_NULL;
  const columnNames = selected.map(({ index }) => design.columnNames[index] ?? "");
  matrix = withAttribute(matrix, "dimnames", listValue([rowNames, characterVector(columnNames)]));
  return {
    ...design,
    matrix,
    columns: selected.length,
    columnNames,
    assign: selected.map(({ assignment }) => assignment),
  };
}

function glmControlFromObject(value: RValue | undefined): GlmControl {
  if (value?.type !== "list") return { epsilon: 1e-8, maxit: 25, trace: false };
  const epsilonValue = modelField(value, "epsilon");
  const maxitValue = modelField(value, "maxit");
  const traceValue = modelField(value, "trace");
  return {
    epsilon: epsilonValue === undefined ? 1e-8 : modelScalarValue(epsilonValue, "epsilon"),
    maxit: maxitValue === undefined ? 25 : Math.trunc(modelScalarValue(maxitValue, "maxit")),
    trace: traceValue === undefined ? false : modelLogicalFlag(traceValue, false, "trace"),
  };
}

function requireGlmModel(value: RValue, call: string): RList {
  if (value.type !== "list" || !vectorClasses(value)?.includes("glm")) {
    throw new RTypeMismatchError("NRT3265", `${call}() requires a glm object.`);
  }
  return value;
}

function glmDescriptorFromObject(value: RValue | undefined): GlmFamilyDescriptor {
  if (value?.type !== "list" || !vectorClasses(value)?.includes("family")) {
    throw new RTypeMismatchError("NRT3265", "The glm object has a malformed family component.");
  }
  return glmFamilyDescriptor(value);
}

function glmCovarianceMatrices(
  model: RList,
  dispersion: number,
  invocation: BuiltinInvocation,
): { readonly unscaled: RDoubleVector; readonly scaled: RDoubleVector } {
  const coefficients = modelField(model, "coefficients");
  const qr = modelField(model, "qr");
  if (coefficients?.type !== "double" || qr?.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "The glm object has malformed QR metadata.");
  }
  const qrMatrix = modelField(qr, "qr");
  const pivot = modelField(qr, "pivot");
  const rankValue = modelField(qr, "rank");
  const dimensions = qrMatrix?.type === "double" ? vectorDimensions(qrMatrix) : undefined;
  if (
    qrMatrix?.type !== "double" ||
    dimensions?.length !== 2 ||
    pivot?.type !== "integer" ||
    rankValue?.type !== "integer"
  ) {
    throw new RTypeMismatchError("NRT3265", "The glm object has malformed QR metadata.");
  }
  const rank = rankValue.values[0] ?? 0;
  const columns = coefficients.length;
  const inverse = invertUpperTriangular(qrMatrix, dimensions[0] ?? 0, rank);
  const unscaledValues = new Float64Array(columns * columns);
  const scaledValues = new Float64Array(columns * columns);
  const missing = new Uint8Array(columns * columns).fill(1);
  for (let left = 0; left < rank; left += 1) {
    const originalLeft = (pivot.values[left] ?? 1) - 1;
    for (let right = 0; right < rank; right += 1) {
      const originalRight = (pivot.values[right] ?? 1) - 1;
      let covariance = 0;
      for (let index = 0; index < rank; index += 1) {
        covariance += (inverse[left + index * rank] ?? 0) * (inverse[right + index * rank] ?? 0);
      }
      const destination = originalLeft + originalRight * columns;
      unscaledValues[destination] = covariance;
      scaledValues[destination] = covariance * dispersion;
      missing[destination] = 0;
    }
  }
  const coefficientNames =
    vectorNames(coefficients) ?? Array.from({ length: columns }, (_, index) => String(index + 1));
  const dimnames = listValue([
    characterVector(coefficientNames),
    characterVector(coefficientNames),
  ]);
  let unscaled = withDimensions(doubleVector(unscaledValues, compactModelMask(missing)), [
    columns,
    columns,
  ]);
  unscaled = withAttribute(unscaled, "dimnames", dimnames);
  let scaled = withDimensions(doubleVector(scaledValues, compactModelMask(missing)), [
    columns,
    columns,
  ]);
  scaled = withAttribute(scaled, "dimnames", dimnames);
  invocation.context.allocate(columns * columns * 2);
  return { unscaled, scaled };
}

async function builtinLinearModelSummary(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "object",
    "correlation",
    "symbolic.cor",
    "...",
  ]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in summary.lm().");
  }
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in summary.lm().");
  for (const name of ["correlation", "symbolic.cor"] as const) {
    const control = parsed.matched.get(name);
    if (
      control !== undefined &&
      !control.promise.missing &&
      modelLogicalFlag(await invocation.force(control.promise), false, name)
    ) {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        `summary.lm(${name} = TRUE) is not implemented yet.`,
      );
    }
  }

  const model = requireLinearModel(await invocation.force(argument.promise), "summary.lm");
  const coefficients = modelField(model, "coefficients");
  const residuals = requiredRealModelField(model, "residuals", "summary.lm");
  const fitted = requiredRealModelField(model, "fitted.values", "summary.lm");
  const terms = modelField(model, "terms");
  if (coefficients?.type !== "double" || terms?.type !== "formula") {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed model metadata.");
  }
  const rank = modelIntegerField(model, "rank");
  const residualDegrees = modelIntegerField(model, "df.residual");
  const weightsValue = modelField(model, "weights");
  const weights =
    weightsValue === undefined
      ? undefined
      : weightsValue.type === "double"
        ? weightsValue
        : undefined;
  if (weightsValue !== undefined && weights === undefined) {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed weights.");
  }

  let residualSum = 0;
  let responseWeight = 0;
  let responseSum = 0;
  for (let index = 0; index < residuals.length; index += 1) {
    const weight = weights === undefined ? 1 : realAt(weights, index);
    const residual = realAt(residuals, index);
    const response = realAt(fitted, index) + residual;
    residualSum += weight * residual * residual;
    responseWeight += weight;
    responseSum += weight * response;
  }
  const responseMean = responseWeight === 0 ? 0 : responseSum / responseWeight;
  let totalSum = 0;
  for (let index = 0; index < residuals.length; index += 1) {
    const weight = weights === undefined ? 1 : realAt(weights, index);
    const response = realAt(fitted, index) + realAt(residuals, index);
    const centered = terms.intercept ? response - responseMean : response;
    totalSum += weight * centered * centered;
  }
  const sigmaSquared = residualDegrees > 0 ? residualSum / residualDegrees : Number.NaN;
  const sigma = Math.sqrt(sigmaSquared);
  const rSquared = totalSum > 0 ? 1 - residualSum / totalSum : 0;
  const modelDegrees = rank - (terms.intercept ? 1 : 0);
  const adjusted =
    residualDegrees > 0
      ? 1 - (1 - rSquared) * ((residualDegrees + modelDegrees) / residualDegrees)
      : Number.NaN;
  const { unscaled, scaled } = glmCovarianceMatrices(model, sigmaSquared, invocation);
  const coefficientNames =
    vectorNames(coefficients) ??
    Array.from({ length: coefficients.length }, (_, index) => String(index + 1));
  const included = Array.from({ length: coefficients.length }, (_, index) => index).filter(
    (index) => !isMissing(coefficients, index),
  );
  const tableRows = included.length;
  const table = new Float64Array(tableRows * 4);
  included.forEach((source, row) => {
    const estimate = coefficients.values[source] ?? 0;
    const standardError = Math.sqrt(
      Math.max(0, scaled.values[source + source * coefficients.length] ?? 0),
    );
    const statistic = estimate / standardError;
    table[row] = estimate;
    table[row + tableRows] = standardError;
    table[row + tableRows * 2] = statistic;
    table[row + tableRows * 3] =
      2 * studentTProbability(Math.abs(statistic), residualDegrees, false);
  });
  let coefficientTable = withDimensions(doubleVector(table), [tableRows, 4]);
  coefficientTable = withAttribute(
    coefficientTable,
    "dimnames",
    listValue([
      characterVector(included.map((index) => coefficientNames[index] ?? "")),
      characterVector(["Estimate", "Std. Error", "t value", "Pr(>|t|)"]),
    ]),
  );
  const aliased = withNames(
    logicalVector(
      Array.from({ length: coefficients.length }, (_, index) => isMissing(coefficients, index)),
    ),
    coefficientNames,
  );
  let fStatistic: RValue = R_NULL;
  if (modelDegrees > 0 && residualDegrees > 0 && residualSum > 0) {
    const explained = Math.max(0, totalSum - residualSum);
    fStatistic = withNames(
      doubleVector([
        explained / modelDegrees / (residualSum / residualDegrees),
        modelDegrees,
        residualDegrees,
      ]),
      ["value", "numdf", "dendf"],
    );
  }
  const fields: { readonly name: string; readonly value: RValue }[] = [
    { name: "call", value: modelField(model, "call") ?? R_NULL },
    { name: "terms", value: terms },
    { name: "residuals", value: residuals },
    { name: "coefficients", value: coefficientTable },
    { name: "aliased", value: aliased },
    { name: "sigma", value: doubleVector([sigma]) },
    {
      name: "df",
      value: integerVector([rank, residualDegrees, coefficients.length]),
    },
    { name: "r.squared", value: doubleVector([rSquared]) },
    { name: "adj.r.squared", value: doubleVector([adjusted]) },
    { name: "fstatistic", value: fStatistic },
    { name: "cov.unscaled", value: unscaled },
  ];
  const naAction = modelField(model, "na.action");
  if (naAction !== undefined) fields.push({ name: "na.action", value: naAction });
  invocation.context.allocate(fields.length + table.length);
  return withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    ["summary.lm"],
  );
}

async function builtinAovSummary(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in summary.aov().");
  }
  if (parsed.dots.length > 0) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "summary.aov() split and intercept controls are not implemented yet.",
    );
  }
  const model = requireLinearModel(await invocation.force(argument.promise), "summary.aov");
  if (!vectorClasses(model)?.includes("aov")) {
    throw new RTypeMismatchError("NRT3265", "summary.aov() requires an aov object.");
  }
  return aovSummaryValue(model, invocation);
}

async function builtinAovListSummary(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in summary.aovlist().");
  }
  if (parsed.dots.length > 0) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "summary.aovlist() split and intercept controls are not implemented yet.",
    );
  }
  const value = await invocation.force(argument.promise);
  if (value.type !== "list" || !vectorClasses(value)?.includes("aovlist")) {
    throw new RTypeMismatchError("NRT3265", "summary.aovlist() requires an aovlist object.");
  }
  const names = vectorNames(value);
  const summaries: RValue[] = [];
  const summaryNames: string[] = [];
  value.values.forEach((component, index) => {
    const name = names?.[index] ?? String(index + 1);
    if (name === "(Intercept)") return;
    const model = requireLinearModel(component, "summary.aovlist");
    if (!vectorClasses(model)?.includes("aov")) {
      throw new RTypeMismatchError("NRT3265", "summary.aovlist() contains a non-aov stratum.");
    }
    summaries.push(aovSummaryValue(model, invocation, true));
    summaryNames.push(`Error: ${name}`);
  });
  invocation.context.allocate(summaries.length);
  return withClasses(listValue(summaries, summaryNames), ["summary.aovlist"]);
}

async function builtinTukeyHsdGeneric(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x", "which", "ordered", "conf.level", "..."]);
  const argument = parsed.matched.get("x");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in TukeyHSD().");
  }
  const object = await invocation.force(argument.promise);
  const dispatched = await invocation.dispatchS3IfPresent("TukeyHSD", object, invocation.arguments);
  if (dispatched !== undefined) return dispatched;
  throw new RTypeMismatchError(
    "NRT3265",
    `no applicable method for 'TukeyHSD' applied to an object of class '${objectClasses(object)?.[0] ?? object.type}'`,
  );
}

async function builtinTukeyHsdAov(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x", "which", "ordered", "conf.level", "..."]);
  const argument = parsed.matched.get("x");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in TukeyHSD.aov().");
  }
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in TukeyHSD.aov().");
  const model = requireLinearModel(await invocation.force(argument.promise), "TukeyHSD");
  if (!vectorClasses(model)?.includes("aov")) {
    throw new RTypeMismatchError("NRT3265", "TukeyHSD() requires an aov object.");
  }
  const frame = modelField(model, "model");
  if (frame?.type !== "list" || !isDataFrame(frame) || frame.length < 2) {
    throw new RTypeMismatchError("NRT3265", "TukeyHSD() requires a fitted aov model frame.");
  }
  const frameNames = vectorNames(frame) ?? [];
  const response = frame.values[0];
  if (
    response === undefined ||
    (response.type !== "logical" && response.type !== "integer" && response.type !== "double")
  ) {
    throw new RTypeMismatchError("NRT3265", "TukeyHSD() requires a numeric response.");
  }
  const candidates = frame.values
    .slice(1)
    .map((value, index) => ({ name: frameNames[index + 1] ?? String(index + 1), value }))
    .filter(
      (entry): entry is { readonly name: string; readonly value: RIntegerVector } =>
        entry.value.type === "integer" && isFactor(entry.value),
    );
  const selected = await tukeySelectedFactors(invocation, parsed.matched.get("which"), candidates);
  if (selected.length === 0) {
    throw new RTypeMismatchError("NRT3265", "no factors in the fitted model");
  }
  const ordered =
    parsed.matched.get("ordered") === undefined
      ? false
      : modelLogicalFlag(
          await invocation.force(parsed.matched.get("ordered")!.promise),
          false,
          "ordered",
        );
  const confidence =
    parsed.matched.get("conf.level") === undefined
      ? 0.95
      : modelScalarValue(
          await invocation.force(parsed.matched.get("conf.level")!.promise),
          "conf.level",
        );
  if (!(confidence > 0 && confidence < 1)) {
    throw new RTypeMismatchError("NRT3265", "'conf.level' must be a single number between 0 and 1");
  }
  const residuals = requiredRealModelField(model, "residuals", "TukeyHSD");
  const residualDegrees = modelScalar(model, "df.residual", "TukeyHSD");
  if (!(residualDegrees > 0)) {
    throw new RTypeMismatchError(
      "NRT3265",
      "TukeyHSD() requires positive residual degrees of freedom.",
    );
  }
  let residualSum = 0;
  for (let index = 0; index < residuals.length; index += 1) {
    const value = realAt(residuals, index);
    residualSum += value * value;
  }
  const residualMeanSquare = residualSum / residualDegrees;
  const tables = selected.map((factor) =>
    tukeyFactorTable(
      response,
      factor.value,
      residualMeanSquare,
      residualDegrees,
      confidence,
      ordered,
      invocation,
    ),
  );
  let result = withClasses(
    listValue(
      tables,
      selected.map((factor) => factor.name),
    ),
    ["TukeyHSD", "multicomp"],
  );
  const call = modelField(model, "call");
  if (call !== undefined) result = withAttribute(result, "orig.call", call);
  result = withAttribute(result, "conf.level", doubleVector([confidence]));
  result = withAttribute(result, "ordered", logicalVector([ordered]));
  return result;
}

async function tukeySelectedFactors(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  candidates: readonly { readonly name: string; readonly value: RIntegerVector }[],
): Promise<readonly { readonly name: string; readonly value: RIntegerVector }[]> {
  if (argument === undefined || argument.promise.missing) return candidates;
  const value = await invocation.force(argument.promise);
  if (value.type === "character") {
    const names = value.values.filter((_name, index) => !isMissing(value, index));
    return names.map((name) => {
      const match = candidates.find((candidate) => candidate.name === name);
      if (match === undefined)
        throw new RTypeMismatchError("NRT3265", `'which' specified no factors`);
      return match;
    });
  }
  if (value.type === "logical" || value.type === "integer" || value.type === "double") {
    const selected: { readonly name: string; readonly value: RIntegerVector }[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const position = Math.trunc(realAt(value, index)) - 1;
      const candidate = candidates[position];
      if (candidate === undefined)
        throw new RTypeMismatchError("NRT3265", `'which' specified no factors`);
      selected.push(candidate);
    }
    return selected;
  }
  throw new RTypeMismatchError("NRT3265", "invalid 'which' argument");
}

function tukeyFactorTable(
  response: RealVector,
  factor: RIntegerVector,
  residualMeanSquare: number,
  residualDegrees: number,
  confidence: number,
  ordered: boolean,
  invocation: BuiltinInvocation,
): RDoubleVector {
  const levels = factorLevels(factor);
  if (levels === undefined || levels.length < 2 || factor.length !== response.length) {
    throw new RTypeMismatchError(
      "NRT3265",
      "TukeyHSD() requires a factor with at least two levels.",
    );
  }
  const sums = new Float64Array(levels.length);
  const counts = new Int32Array(levels.length);
  for (let index = 0; index < factor.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(factor, index) || isMissing(response, index)) continue;
    const level = (factor.values[index] ?? 0) - 1;
    if (level < 0 || level >= levels.length) continue;
    sums[level] = (sums[level] ?? 0) + realAt(response, index);
    counts[level] = (counts[level] ?? 0) + 1;
  }
  const groups = levels.map((label, index) => ({
    label,
    count: counts[index] ?? 0,
    mean: (sums[index] ?? 0) / (counts[index] ?? 0),
  }));
  if (groups.some((group) => group.count === 0)) {
    throw new RTypeMismatchError("NRT3265", "TukeyHSD() cannot compare an empty factor level.");
  }
  if (ordered) groups.sort((left, right) => left.mean - right.mean);
  const comparisons = (groups.length * (groups.length - 1)) / 2;
  const values = new Float64Array(comparisons * 4);
  const rowNames: string[] = [];
  const critical = studentizedRangeQuantile(confidence, groups.length, residualDegrees, invocation);
  let row = 0;
  for (let right = 1; right < groups.length; right += 1) {
    for (let left = 0; left < right; left += 1) {
      invocation.context.checkpoint();
      const a = groups[left]!;
      const b = groups[right]!;
      const difference = b.mean - a.mean;
      const standardError = Math.sqrt((residualMeanSquare / 2) * (1 / a.count + 1 / b.count));
      const interval = critical * standardError;
      const statistic =
        standardError === 0 ? Number.POSITIVE_INFINITY : Math.abs(difference) / standardError;
      const adjusted =
        1 - studentizedRangeProbability(statistic, groups.length, residualDegrees, invocation);
      values[row] = difference;
      values[row + comparisons] = difference - interval;
      values[row + comparisons * 2] = difference + interval;
      values[row + comparisons * 3] = Math.min(1, Math.max(0, adjusted));
      rowNames.push(`${b.label}-${a.label}`);
      row += 1;
    }
  }
  let table = withDimensions(doubleVector(values), [comparisons, 4]);
  table = withAttribute(
    table,
    "dimnames",
    listValue([characterVector(rowNames), characterVector(["diff", "lwr", "upr", "p adj"])]),
  );
  return table;
}

function studentizedRangeQuantile(
  probability: number,
  means: number,
  degrees: number,
  invocation: BuiltinInvocation,
): number {
  let lower = 0;
  let upper = 8;
  while (
    studentizedRangeProbability(upper, means, degrees, invocation) < probability &&
    upper < 64
  ) {
    upper *= 2;
  }
  for (let iteration = 0; iteration < 34; iteration += 1) {
    invocation.context.checkpoint();
    const middle = (lower + upper) / 2;
    if (studentizedRangeProbability(middle, means, degrees, invocation) < probability)
      lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}

function studentizedRangeProbability(
  statistic: number,
  means: number,
  degrees: number,
  invocation: BuiltinInvocation,
): number {
  if (statistic <= 0) return 0;
  if (!Number.isFinite(statistic)) return 1;
  const standardDeviation = 1 / Math.sqrt(2 * degrees);
  const lower = Math.max(0, 1 - 9 * standardDeviation);
  const upper = Math.max(2, 1 + 9 * standardDeviation);
  const intervals = 120;
  const step = (upper - lower) / intervals;
  let weighted = 0;
  let densityTotal = 0;
  for (let index = 0; index <= intervals; index += 1) {
    invocation.context.checkpoint();
    const scale = lower + step * index;
    const coefficient = index === 0 || index === intervals ? 1 : index % 2 === 0 ? 2 : 4;
    const density = chiScaleDensity(scale, degrees);
    densityTotal += coefficient * density;
    weighted += coefficient * density * normalRangeProbability(statistic * scale, means);
  }
  return Math.min(1, Math.max(0, weighted / densityTotal));
}

function chiScaleDensity(scale: number, degrees: number): number {
  if (scale <= 0) return 0;
  const half = degrees / 2;
  const logDensity =
    Math.log(2) +
    half * Math.log(half) -
    logGamma(half) +
    (degrees - 1) * Math.log(scale) -
    half * scale * scale;
  return Math.exp(logDensity);
}

function normalRangeProbability(range: number, means: number): number {
  if (range <= 0) return 0;
  if (range >= 16) return 1;
  const intervals = 160;
  const lower = -8;
  const upper = 8;
  const step = (upper - lower) / intervals;
  let sum = 0;
  for (let index = 0; index <= intervals; index += 1) {
    const x = lower + step * index;
    const coefficient = index === 0 || index === intervals ? 1 : index % 2 === 0 ? 2 : 4;
    const mass = Math.max(0, normalProbability(x + range, true) - normalProbability(x, true));
    const density = Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
    sum += coefficient * means * density * mass ** (means - 1);
  }
  return Math.min(1, Math.max(0, (sum * step) / 3));
}

function aovSummaryValue(model: RList, invocation: BuiltinInvocation, stratum = false): RValue {
  const table = singleLinearModelAnova(model, invocation);
  if (table.type !== "list") {
    throw new Error();
  }
  const degrees = table.values[0];
  const summaryTable: RList =
    degrees?.type === "integer"
      ? {
          ...withoutAttribute(table, "heading"),
          values: Object.freeze([
            { ...doubleVector(degrees.values), attributes: new Map(degrees.attributes) },
            ...table.values.slice(1),
          ]),
        }
      : withoutAttribute(table, "heading");
  const rowNames = table.attributes.get("row.names");
  const labels = rowNames?.type === "character" ? rowNames.values : [];
  const width =
    labels.reduce((maximum, label) => Math.max(maximum, label.length), 0) +
    (stratum || labels.length <= 1 ? 0 : 2);
  const padded = withAttribute(
    summaryTable,
    "row.names",
    characterVector(
      labels.map((label) =>
        width === 0 || (stratum && label === "Residuals") ? label : label.padEnd(width, " "),
      ),
    ),
  );
  return withClasses(listValue([padded]), ["summary.aov", "listof"]);
}

async function builtinLinearModelAnova(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in anova().");
  }
  const first = await invocation.force(argument.promise);
  const candidates = [first];
  for (const supplied of parsed.dots) {
    if (supplied.name !== undefined) {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        "anova.lm() named test, scale, and projection controls are not implemented yet.",
      );
    }
    candidates.push(await invocation.force(supplied.promise));
  }
  const models = candidates.map((candidate) => requireLinearModel(candidate, "anova"));
  return models.length === 1
    ? singleLinearModelAnova(models[0] as RList, invocation)
    : multipleLinearModelAnova(models, invocation);
}

function requireLinearModel(value: RValue, call: string): RList {
  if (value.type !== "list" || !isLinearModel(value)) {
    throw new RTypeMismatchError("NRT3265", `${call}() requires fitted lm/aov objects.`);
  }
  return value;
}

function singleLinearModelAnova(model: RList, invocation: BuiltinInvocation): RValue {
  const effects = requiredRealModelField(model, "effects", "anova");
  const assign = requiredRealModelField(model, "assign", "anova");
  const residuals = requiredRealModelField(model, "residuals", "anova");
  const residualDegrees = modelScalar(model, "df.residual", "anova");
  const rank = modelScalar(model, "rank", "anova");
  const qr = modelField(model, "qr");
  if (qr?.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "anova() requires the fitted model QR component.");
  }
  const pivot = requiredRealModelField(qr, "pivot", "anova");
  const formula = modelField(model, "terms");
  if (formula?.type !== "formula") {
    throw new RTypeMismatchError("NRT3265", "anova() requires fitted model terms.");
  }

  const termCount = formula.terms.length;
  const degrees = new Int32Array(termCount);
  const sums = new Float64Array(termCount);
  for (let step = 0; step < Math.min(rank, effects.length, pivot.length); step += 1) {
    const originalColumn = Math.trunc(realAt(pivot, step)) - 1;
    const term =
      originalColumn < 0 || originalColumn >= assign.length ? 0 : realAt(assign, originalColumn);
    if (!Number.isInteger(term) || term <= 0 || term > termCount) continue;
    degrees[term - 1] = (degrees[term - 1] ?? 0) + 1;
    const effect = realAt(effects, step);
    sums[term - 1] = (sums[term - 1] ?? 0) + effect * effect;
  }
  let residualSum = 0;
  for (let index = 0; index < residuals.length; index += 1) {
    if (isMissing(residuals, index)) continue;
    const residual = realAt(residuals, index);
    residualSum += residual * residual;
  }
  const residualMean = residualDegrees > 0 ? residualSum / residualDegrees : Number.NaN;
  const rows = termCount + 1;
  const meanSquares = new Float64Array(rows);
  const fValues = new Float64Array(rows);
  const probabilities = new Float64Array(rows);
  const missing = new Uint8Array(rows);
  missing[rows - 1] = 1;
  for (let term = 0; term < termCount; term += 1) {
    const termDegrees = degrees[term] ?? 0;
    const mean = termDegrees > 0 ? (sums[term] ?? 0) / termDegrees : Number.NaN;
    const statistic = residualMean > 0 ? mean / residualMean : Number.NaN;
    meanSquares[term] = mean;
    fValues[term] = statistic;
    probabilities[term] = fDistributionUpperTail(statistic, termDegrees, residualDegrees);
  }
  meanSquares[rows - 1] = residualMean;
  fValues[rows - 1] = 0;
  probabilities[rows - 1] = 0;
  const frame = dataFrameValue(
    [
      integerVector([...degrees, residualDegrees]),
      doubleVector([...sums, residualSum]),
      doubleVector(meanSquares),
      doubleVector(fValues, missing),
      doubleVector(probabilities, missing),
    ],
    ["Df", "Sum Sq", "Mean Sq", "F value", "Pr(>F)"],
    [...formula.terms, "Residuals"],
    false,
  );
  invocation.context.allocate(rows * 5);
  return withAttribute(
    withClasses(frame, ["anova", "data.frame"]),
    "heading",
    characterVector(["Analysis of Variance Table\n", `Response: ${formula.response ?? ""}`]),
  );
}

function multipleLinearModelAnova(models: readonly RList[], invocation: BuiltinInvocation): RValue {
  const residualDegrees = models.map((model) => modelScalar(model, "df.residual", "anova"));
  const residualSums = models.map((model) => {
    const residuals = requiredRealModelField(model, "residuals", "anova");
    let sum = 0;
    for (let index = 0; index < residuals.length; index += 1) {
      if (isMissing(residuals, index)) continue;
      const residual = realAt(residuals, index);
      sum += residual * residual;
    }
    return sum;
  });
  const comparisonDegrees = new Float64Array(models.length);
  const comparisonSums = new Float64Array(models.length);
  const statistics = new Float64Array(models.length);
  const probabilities = new Float64Array(models.length);
  const missing = new Uint8Array(models.length);
  missing[0] = 1;
  const referenceIndex = residualDegrees.reduce(
    (selected, degrees, index) =>
      degrees < (residualDegrees[selected] ?? Infinity) ? index : selected,
    0,
  );
  const referenceMean =
    (residualSums[referenceIndex] ?? Number.NaN) / (residualDegrees[referenceIndex] ?? Number.NaN);
  for (let index = 1; index < models.length; index += 1) {
    const degrees = (residualDegrees[index - 1] ?? 0) - (residualDegrees[index] ?? 0);
    const sum = (residualSums[index - 1] ?? 0) - (residualSums[index] ?? 0);
    const statistic =
      degrees === 0 || referenceMean <= 0 ? Number.NaN : sum / degrees / referenceMean;
    comparisonDegrees[index] = degrees;
    comparisonSums[index] = sum;
    statistics[index] = statistic;
    probabilities[index] = fDistributionUpperTail(
      statistic,
      Math.abs(degrees),
      residualDegrees[referenceIndex] ?? Number.NaN,
    );
  }
  const frame = dataFrameValue(
    [
      doubleVector(residualDegrees),
      doubleVector(residualSums),
      doubleVector(comparisonDegrees, missing),
      doubleVector(comparisonSums, missing),
      doubleVector(statistics, missing),
      doubleVector(probabilities, missing),
    ],
    ["Res.Df", "RSS", "Df", "Sum of Sq", "F", "Pr(>F)"],
    models.map((_model, index) => String(index + 1)),
    false,
  );
  const formulas = models.map((model, index) => {
    const formula = modelField(model, "terms");
    const label = formula?.type === "formula" ? modelFormulaLabel(formula) : "";
    return `Model ${index + 1}: ${label}`;
  });
  invocation.context.allocate(models.length * 6);
  return withAttribute(
    withClasses(frame, ["anova", "data.frame"]),
    "heading",
    characterVector(["Analysis of Variance Table\n", formulas.join("\n")]),
  );
}

function requiredRealModelField(model: RList, name: string, call: string): RealVector {
  const value = modelField(model, name);
  if (
    value === undefined ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double")
  ) {
    throw new RTypeMismatchError(
      "NRT3265",
      `${call}() requires numeric model component '${name}'.`,
    );
  }
  return value;
}

function modelScalar(model: RList, name: string, call: string): number {
  const value = requiredRealModelField(model, name, call);
  if (value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3265", `${call}() requires scalar model component '${name}'.`);
  }
  return realAt(value, 0);
}

function fDistributionUpperTail(
  statistic: number,
  numeratorDegrees: number,
  denominatorDegrees: number,
): number {
  if (
    Number.isNaN(statistic) ||
    statistic < 0 ||
    numeratorDegrees <= 0 ||
    denominatorDegrees <= 0
  ) {
    return Number.NaN;
  }
  if (statistic === Infinity) return 0;
  const betaArgument = denominatorDegrees / (denominatorDegrees + numeratorDegrees * statistic);
  return regularizedBeta(betaArgument, denominatorDegrees / 2, numeratorDegrees / 2);
}

function modelFormulaLabel(formula: RFormula): string {
  const right = formula.terms.length === 0 ? "1" : formula.terms.join(" + ");
  return `${formula.response ?? ""} ~ ${right}`;
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
  const classes = vectorClasses(object) ?? [];
  const isGlm = classes.includes("glm");
  const newDataArguments = parsed.dots.filter(
    (argument) =>
      argument.name === undefined ||
      argument.name === "newdata" ||
      (argument.name.length >= 2 && "newdata".startsWith(argument.name)),
  );
  if (newDataArguments.length > 1) {
    throw new REvaluationError(
      "NRE2102",
      'Formal argument "newdata" matched by multiple actual arguments.',
    );
  }
  const newDataArgument = newDataArguments[0];
  const typeArgument = parsed.dots.find((argument) => argument.name === "type");
  const rankDeficientArgument = parsed.dots.find((argument) => argument.name === "rankdeficient");
  const seFitArgument = parsed.dots.find(
    (argument) => argument.name === "se.fit" || argument.name === "se",
  );
  const dispersionArgument = parsed.dots.find((argument) => argument.name === "dispersion");
  const seFit =
    seFitArgument === undefined
      ? false
      : modelLogicalFlag(await invocation.force(seFitArgument.promise), false, "se.fit");
  const requestedDispersion =
    dispersionArgument === undefined
      ? undefined
      : modelScalarValue(await invocation.force(dispersionArgument.promise), "dispersion");
  let rankDeficientPolicy: "simple" | "NA" | "NAwarn" = "simple";
  if (rankDeficientArgument !== undefined) {
    const value = await invocation.force(rankDeficientArgument.promise);
    if (value.type !== "character" || value.length !== 1 || isMissing(value, 0)) {
      throw new RTypeMismatchError(
        "NRT3265",
        "predict.lm() rankdeficient must be one character string.",
      );
    }
    const requested = value.values[0] ?? "";
    if (requested !== "simple" && requested !== "NA" && requested !== "NAwarn") {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        "predict.lm(rankdeficient=) currently supports 'simple', 'NA', and 'NAwarn'.",
      );
    }
    rankDeficientPolicy = requested;
  }
  let predictionType = isGlm ? "link" : "response";
  if (typeArgument !== undefined) {
    const value = await invocation.force(typeArgument.promise);
    if (value.type !== "character" || value.length !== 1 || isMissing(value, 0)) {
      throw new RTypeMismatchError("NRT3265", "predict() type must be one character string.");
    }
    const requested = value.values[0] ?? "";
    const choices = isGlm ? ["link", "response", "terms"] : ["response", "terms"];
    const matches = choices.filter((choice) => choice.startsWith(requested));
    if (matches.length !== 1) {
      throw new REvaluationError("NRE2131", `invalid prediction type '${requested}'`);
    }
    predictionType = matches[0] ?? predictionType;
  }
  if (predictionType === "terms") {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "predict.lm() type = 'terms' is not implemented yet.",
    );
  }
  if (
    parsed.dots.some(
      (argument) =>
        argument !== newDataArgument &&
        argument !== typeArgument &&
        argument !== rankDeficientArgument &&
        argument !== seFitArgument &&
        argument !== dispersionArgument,
    )
  ) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "predict.lm() currently supports newdata, link/response type selection, and rankdeficient = 'simple', 'NA', or 'NAwarn'.",
    );
  }
  const newDataValue =
    newDataArgument === undefined ? undefined : await invocation.force(newDataArgument.promise);
  if (newDataArgument === undefined || newDataValue?.type === "null") {
    const fitted = modelField(
      object,
      isGlm && predictionType === "link" ? "linear.predictors" : "fitted.values",
    );
    if (fitted === undefined) {
      throw new RTypeMismatchError("NRT3265", "The fitted model has no fitted.values component.");
    }
    if (!seFit) return fitted;
    if (fitted.type !== "double") {
      throw new RTypeMismatchError("NRT3265", "The fitted model has malformed predictions.");
    }
    const trainingDesign = MODEL_INFLUENCE_STATES.get(object)?.design.matrix;
    if (trainingDesign === undefined) {
      throw new RTypeMismatchError("NRT3265", "The fitted model has no retained design matrix.");
    }
    return predictionWithStandardErrors(
      object,
      fitted,
      trainingDesign,
      isGlm,
      predictionType,
      requestedDispersion,
      invocation,
    );
  }
  const formula = modelField(object, "terms");
  const coefficients = modelField(object, "coefficients");
  if (formula?.type !== "formula" || coefficients?.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed terms or coefficients.");
  }
  const newData = newDataValue;
  if (newData === undefined) throw new Error();
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
  const design = await buildModelMatrix(
    prepared,
    formula,
    xlevels,
    invocation,
    modelContrastSpecifications(modelField(object, "contrasts")),
  );
  if (coefficients.length !== design.columns) {
    throw new RTypeMismatchError(
      "NRT3265",
      "The new model matrix does not match the fitted coefficient shape.",
    );
  }
  invocation.context.allocate(design.rows);
  const values = new Float64Array(design.rows);
  const missing = new Uint8Array(design.rows);
  const estimability =
    rankDeficientPolicy === "simple"
      ? undefined
      : modelPredictionEstimability(object, design.columns, invocation);
  let nonEstimable = 0;
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
    if (missing[row] !== 1 && estimability !== undefined && !estimability(design.matrix, row)) {
      missing[row] = 1;
      nonEstimable += 1;
    }
    values[row] = total;
  }
  if (rankDeficientPolicy === "NAwarn" && nonEstimable > 0) {
    invocation.context.warn({
      code: "NRW1144",
      message: `${nonEstimable} prediction${nonEstimable === 1 ? "" : "s"} from a rank-deficient fit were set to NA`,
    });
  }
  if (isGlm && predictionType === "response") {
    const family = glmDescriptorFromObject(modelField(object, "family"));
    const transformed = await glmFamilyTransform(values, family, "linkinv", invocation);
    values.set(transformed);
  }
  const prediction = withNames(doubleVector(values, compactModelMask(missing)), prepared.rowNames);
  if (!seFit) return prediction;
  return predictionWithStandardErrors(
    object,
    prediction,
    design.matrix,
    isGlm,
    predictionType,
    requestedDispersion,
    invocation,
  );
}

async function predictionWithStandardErrors(
  model: RList,
  fit: RDoubleVector,
  design: RDoubleVector,
  isGlm: boolean,
  predictionType: string,
  requestedDispersion: number | undefined,
  invocation: BuiltinInvocation,
): Promise<RValue> {
  const dimensions = vectorDimensions(design);
  const coefficients = modelField(model, "coefficients");
  if (dimensions?.length !== 2 || coefficients?.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The fitted model has malformed prediction metadata.");
  }
  const rows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  if (rows !== fit.length || columns !== coefficients.length) {
    throw new RTypeMismatchError(
      "NRT3265",
      "The fitted model has inconsistent prediction metadata.",
    );
  }
  let dispersion: number;
  let covariance: RDoubleVector;
  let family: GlmFamilyDescriptor | undefined;
  if (isGlm) {
    family = glmDescriptorFromObject(modelField(model, "family"));
    const degrees = modelIntegerField(model, "df.residual");
    dispersion =
      requestedDispersion ??
      family.fixedDispersion ??
      (await glmPearsonDispersion(model, family, invocation)) / degrees;
    covariance = glmCovarianceMatrices(model, dispersion, invocation).scaled;
  } else {
    const residuals = requiredRealModelField(model, "residuals", "predict.lm");
    const weights = modelField(model, "weights");
    const degrees = modelIntegerField(model, "df.residual");
    let sum = 0;
    for (let index = 0; index < residuals.length; index += 1) {
      sum +=
        realAt(residuals, index) ** 2 * (weights?.type === "double" ? realAt(weights, index) : 1);
    }
    dispersion = requestedDispersion ?? sum / degrees;
    covariance = linearModelCovariance(model, true, invocation);
    if (requestedDispersion !== undefined && sum / degrees !== 0) {
      const ratio = requestedDispersion / (sum / degrees);
      covariance = {
        ...covariance,
        values: Float64Array.from(covariance.values, (x) => x * ratio),
      };
    }
  }
  if (!Number.isFinite(dispersion) || dispersion < 0) {
    throw new RTypeMismatchError("NRT3265", "dispersion must be a finite non-negative number");
  }
  const standardErrors = new Float64Array(rows);
  const missing = new Uint8Array(rows);
  for (let row = 0; row < rows; row += 1) {
    let variance = 0;
    for (let left = 0; left < columns; left += 1) {
      const leftValue = design.values[row + left * rows] ?? 0;
      for (let right = 0; right < columns; right += 1) {
        const covarianceIndex = left + right * columns;
        if (isMissing(covariance, covarianceIndex)) continue;
        variance +=
          leftValue *
          (covariance.values[covarianceIndex] ?? 0) *
          (design.values[row + right * rows] ?? 0);
      }
    }
    standardErrors[row] = Math.sqrt(Math.max(0, variance));
  }
  if (isGlm && predictionType === "response" && family !== undefined) {
    const responseValues = Float64Array.from(fit.values);
    const eta = await glmFamilyTransform(responseValues, family, "linkfun", invocation);
    const derivatives = await glmFamilyTransform(eta, family, "muEta", invocation);
    for (let row = 0; row < rows; row += 1) {
      standardErrors[row] = (standardErrors[row] ?? 0) * Math.abs(derivatives[row] ?? 0);
    }
  }
  const names = vectorNames(fit);
  const se =
    names === undefined
      ? doubleVector(standardErrors, compactModelMask(missing))
      : withNames(doubleVector(standardErrors, compactModelMask(missing)), names);
  return listValue(
    [fit, se, doubleVector([Math.sqrt(dispersion)])],
    ["fit", "se.fit", "residual.scale"],
  );
}

async function builtinPredictLoess(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "newdata", "se", "na.action", "..."]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in predict.loess().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (object.type !== "list" || !vectorClasses(object)?.includes("loess")) {
    throw new RTypeMismatchError("NRT3265", "predict.loess() requires a loess object.");
  }
  const seArgument = parsed.matched.get("se");
  if (seArgument !== undefined && !seArgument.promise.missing) {
    const se = modelLogicalFlag(await invocation.force(seArgument.promise), false, "se");
    if (se) {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        "predict.loess(se=TRUE) is outside the current numeric contract.",
      );
    }
  }
  if (parsed.dots.length > 0) {
    throw new REvaluationError("NRE2101", "Unused argument in predict.loess().");
  }
  const newDataArgument = parsed.matched.get("newdata");
  if (newDataArgument === undefined || newDataArgument.promise.missing) {
    const fitted = modelField(object, "fitted");
    if (fitted === undefined) {
      throw new RTypeMismatchError("NRT3265", "The loess object has no fitted component.");
    }
    return fitted;
  }
  const newData = await invocation.force(newDataArgument.promise);
  if (
    !isAtomic(newData) ||
    newData.type === "character" ||
    newData.type === "complex" ||
    newData.type === "raw"
  ) {
    throw new RTypeMismatchError(
      "NRT3265",
      "predict.loess(newdata=) currently requires a numeric matrix.",
    );
  }
  const newDataDimensions = vectorDimensions(newData);
  if (newDataDimensions?.length !== 2) {
    throw new RTypeMismatchError(
      "NRT3265",
      "predict.loess(newdata=) currently requires a numeric matrix.",
    );
  }

  const training = loessRealField(object, "x");
  const response = loessRealField(object, "y");
  const divisor = loessRealField(object, "divisor");
  const observationWeights = loessRealField(object, "weights");
  const trainingDimensions = vectorDimensions(training);
  if (trainingDimensions?.length !== 2) {
    throw new RTypeMismatchError("NRT3265", "The loess object has a malformed x component.");
  }
  const rows = trainingDimensions[0] ?? 0;
  const predictors = trainingDimensions[1] ?? 0;
  const outputRows = newDataDimensions[0] ?? 0;
  if (
    rows === 0 ||
    predictors === 0 ||
    newDataDimensions[1] !== predictors ||
    response.length !== rows ||
    observationWeights.length !== rows ||
    divisor.length !== predictors
  ) {
    throw new RTypeMismatchError("NRT3265", "The loess object or newdata has incompatible shape.");
  }
  const parameters = modelField(object, "pars");
  if (parameters?.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "The loess object has no pars component.");
  }
  const span = modelScalar(parameters, "span", "predict.loess");
  const degree = Math.trunc(modelScalar(parameters, "degree", "predict.loess"));
  if (!(span > 0) || (degree !== 1 && degree !== 2)) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "predict.loess() currently supports positive spans and degree 1 or 2 fits.",
    );
  }
  const robustValue = modelField(parameters, "robust");
  const robust =
    robustValue !== undefined &&
    isAtomic(robustValue) &&
    robustValue.type !== "character" &&
    robustValue.type !== "complex" &&
    robustValue.type !== "raw"
      ? robustValue
      : undefined;
  const dropSquareValue = modelField(parameters, "drop.square");
  const dropSquare = Array.from({ length: predictors }, (_, index) =>
    dropSquareValue !== undefined &&
    isAtomic(dropSquareValue) &&
    dropSquareValue.type !== "character" &&
    dropSquareValue.type !== "complex" &&
    dropSquareValue.type !== "raw" &&
    index < dropSquareValue.length &&
    !isMissing(dropSquareValue, index)
      ? realAt(dropSquareValue, index) !== 0
      : false,
  );
  const linearTerms = predictors;
  const squareTerms = degree === 2 ? dropSquare.filter((drop) => !drop).length : 0;
  const interactionTerms = degree === 2 ? (predictors * (predictors - 1)) / 2 : 0;
  const termCount = 1 + linearTerms + squareTerms + interactionTerms;
  const neighborhood = Math.min(
    rows,
    Math.max(termCount + 1, Math.floor(rows * Math.min(span, 1))),
  );
  const normalizedTraining = new Float64Array(rows * predictors);
  for (let predictor = 0; predictor < predictors; predictor += 1) {
    const scale = realAt(divisor, predictor);
    if (!Number.isFinite(scale) || scale === 0) {
      throw new RTypeMismatchError("NRT3265", "The loess object has an invalid divisor.");
    }
    for (let row = 0; row < rows; row += 1) {
      normalizedTraining[row + predictor * rows] = realAt(training, row + predictor * rows) / scale;
    }
  }

  invocation.context.allocate(outputRows * (rows + termCount));
  const predictions = new Float64Array(outputRows);
  for (let outputRow = 0; outputRow < outputRows; outputRow += 1) {
    invocation.context.checkpoint();
    const offsets = new Float64Array(rows * predictors);
    const distances = new Float64Array(rows);
    for (let row = 0; row < rows; row += 1) {
      let squaredDistance = 0;
      for (let predictor = 0; predictor < predictors; predictor += 1) {
        const point = realAt(newData, outputRow + predictor * outputRows);
        const scale = realAt(divisor, predictor);
        const offset = (normalizedTraining[row + predictor * rows] ?? 0) - point / scale;
        offsets[row + predictor * rows] = offset;
        squaredDistance += offset * offset;
      }
      distances[row] = Math.sqrt(squaredDistance);
    }
    const orderedDistances = Array.from(distances).sort((left, right) => left - right);
    const radius = orderedDistances[neighborhood - 1] ?? 0;
    const localWeights = new Float64Array(rows);
    for (let row = 0; row < rows; row += 1) {
      const ratio = radius === 0 ? (distances[row] === 0 ? 0 : 1) : (distances[row] ?? 0) / radius;
      const kernel = ratio >= 1 ? 0 : (1 - ratio ** 3) ** 3;
      const robustWeight = robust === undefined || row >= robust.length ? 1 : realAt(robust, row);
      localWeights[row] = kernel * realAt(observationWeights, row) * robustWeight;
    }
    const design = new Float64Array(rows * termCount);
    for (let row = 0; row < rows; row += 1) {
      let column = 0;
      design[row + column * rows] = 1;
      column += 1;
      for (let predictor = 0; predictor < predictors; predictor += 1) {
        design[row + column * rows] = offsets[row + predictor * rows] ?? 0;
        column += 1;
      }
      if (degree === 2) {
        for (let predictor = 0; predictor < predictors; predictor += 1) {
          if (dropSquare[predictor]) continue;
          const offset = offsets[row + predictor * rows] ?? 0;
          design[row + column * rows] = offset * offset;
          column += 1;
        }
        for (let left = 0; left < predictors; left += 1) {
          for (let right = left + 1; right < predictors; right += 1) {
            design[row + column * rows] =
              (offsets[row + left * rows] ?? 0) * (offsets[row + right * rows] ?? 0);
            column += 1;
          }
        }
      }
    }
    const solved = solveLeastSquares(
      design,
      rows,
      termCount,
      Float64Array.from({ length: rows }, (_, row) => realAt(response, row)),
      localWeights,
      undefined,
      invocation,
      1e-10,
    );
    predictions[outputRow] = solved.coefficients[0] ?? Number.NaN;
  }
  let output = doubleVector(predictions);
  const dimensionNames = newData.attributes.get("dimnames");
  const rowNames = dimensionNames?.type === "list" ? dimensionNames.values[0] : undefined;
  if (rowNames?.type === "character" && rowNames.length === output.length) {
    output = withAttribute(output, "names", rowNames);
  }
  return output;
}

function loessRealField(model: RList, name: string): RealVector {
  const value = modelField(model, name);
  if (
    value === undefined ||
    !isAtomic(value) ||
    value.type === "character" ||
    value.type === "complex" ||
    value.type === "raw"
  ) {
    throw new RTypeMismatchError("NRT3265", `The loess object has a malformed ${name} component.`);
  }
  return value;
}

function modelPredictionEstimability(
  model: RList,
  columns: number,
  invocation: BuiltinInvocation,
): (matrix: RDoubleVector, row: number) => boolean {
  const qr = modelField(model, "qr");
  const rankValue = qr?.type === "list" ? modelField(qr, "rank") : undefined;
  const pivotValue = qr?.type === "list" ? modelField(qr, "pivot") : undefined;
  const qrMatrix = qr?.type === "list" ? modelField(qr, "qr") : undefined;
  const dimensions = qrMatrix?.type === "double" ? vectorDimensions(qrMatrix) : undefined;
  if (
    qr?.type !== "list" ||
    (rankValue?.type !== "integer" && rankValue?.type !== "double") ||
    pivotValue?.type !== "integer" ||
    qrMatrix?.type !== "double" ||
    dimensions?.length !== 2 ||
    pivotValue.length !== columns
  ) {
    throw new RTypeMismatchError(
      "NRT3265",
      "The rank-deficient lm object has a malformed QR decomposition.",
    );
  }
  const rank = Math.trunc(realAt(rankValue, 0));
  if (rank >= columns) return () => true;
  const rows = dimensions[0] ?? 0;
  const basis: Float64Array[] = [];
  for (let sourceRow = 0; sourceRow < rank; sourceRow += 1) {
    const vector = Float64Array.from(
      { length: columns },
      (_unused, column) => qrMatrix.values[sourceRow + column * rows] ?? 0,
    );
    for (const previous of basis) {
      const projection = dotProduct(vector, previous);
      for (let column = 0; column < columns; column += 1) {
        vector[column] = (vector[column] ?? 0) - projection * (previous[column] ?? 0);
      }
    }
    const norm = vectorNorm(vector);
    if (norm > Number.EPSILON) {
      for (let column = 0; column < columns; column += 1) {
        vector[column] = (vector[column] ?? 0) / norm;
      }
      basis.push(vector);
    }
  }
  invocation.context.allocate(basis.length * columns + columns);
  return (matrix, row) => {
    const matrixRows = vectorDimensions(matrix)?.[0] ?? matrix.length;
    const residual = Float64Array.from({ length: columns }, (_unused, column) => {
      const original = (pivotValue.values[column] ?? column + 1) - 1;
      return matrix.values[row + original * matrixRows] ?? 0;
    });
    const originalNorm = vectorNorm(residual);
    for (const vector of basis) {
      const projection = dotProduct(residual, vector);
      for (let column = 0; column < columns; column += 1) {
        residual[column] = (residual[column] ?? 0) - projection * (vector[column] ?? 0);
      }
    }
    return vectorNorm(residual) <= 1e-8 * Math.max(1, originalNorm);
  };
}

async function builtinModelMatrix(
  invocation: BuiltinInvocation,
  dispatch: boolean,
): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in model.matrix().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (dispatch) {
    const dispatched = await invocation.dispatchS3IfPresent(
      "model.matrix",
      object,
      invocation.arguments,
    );
    if (dispatched !== undefined) return dispatched;
  }

  if (object.type === "list" && isLinearModel(object)) {
    const stored = modelField(object, "x");
    if (stored?.type === "double" && vectorDimensions(stored)?.length === 2) return stored;
    const formula = modelField(object, "terms");
    const model = modelField(object, "model");
    if (formula?.type !== "formula" || model?.type !== "list") {
      throw new RTypeMismatchError("NRT3265", "The lm object cannot reconstruct its model matrix.");
    }
    return modelMatrixFromFormula(
      formula,
      model,
      modelXLevels(object),
      invocation,
      modelContrastSpecifications(modelField(object, "contrasts")),
    );
  }
  const formula =
    object.type === "formula"
      ? object
      : object.type === "list"
        ? (modelField(object, "terms") ?? object.attributes.get("terms"))
        : undefined;
  if (formula?.type !== "formula") {
    throw new RTypeMismatchError(
      "NRT3265",
      "model.matrix() requires a formula or fitted lm/aov object.",
    );
  }
  const dataArgument =
    parsed.dots.find((argument) => argument.name === "data") ??
    parsed.dots.find((argument) => argument.name === undefined);
  const contrastsArgument = parsed.dots.find((argument) => argument.name === "contrasts.arg");
  const contrastSpecifications =
    contrastsArgument === undefined || contrastsArgument.promise.missing
      ? new Map<string, RValue>()
      : modelContrastSpecifications(await invocation.force(contrastsArgument.promise));
  const xlevArgument = parsed.dots.find((argument) => argument.name === "xlev");
  const xlevels =
    xlevArgument === undefined || xlevArgument.promise.missing
      ? new Map<string, readonly string[]>()
      : modelXLevelsValue(await invocation.force(xlevArgument.promise));
  if (dataArgument === undefined) {
    return modelMatrixFromFormula(formula, undefined, xlevels, invocation, contrastSpecifications);
  }
  const data = await invocation.force(dataArgument.promise);
  // model.matrix.default documents ... and ignores unrelated named extensions. Packages use this
  // to forward constructor-specific controls (for example keep.subset) without changing the
  // design matrix contract.
  return modelMatrixFromFormula(formula, data, xlevels, invocation, contrastSpecifications);
}

async function builtinModelFrame(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["formula", "..."]);
  const objectArgument = parsed.matched.get("formula");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'formula' is missing in model.frame().");
  }
  const object = await invocation.force(objectArgument.promise);
  const dispatched = await invocation.dispatchS3IfPresent(
    "model.frame",
    object,
    invocation.arguments,
  );
  if (dispatched !== undefined) return dispatched;
  if (object.type === "list" && isLinearModel(object)) {
    const model = modelField(object, "model");
    if (model?.type !== "list" || !isDataFrame(model)) {
      throw new RTypeMismatchError("NRT3265", "The fitted model does not retain a model frame.");
    }
    return model;
  }
  if (object.type === "formula") {
    const dataArgument =
      parsed.dots.find((argument) => argument.name === "data") ??
      parsed.dots.find((argument) => argument.name === undefined);
    const data =
      dataArgument === undefined || dataArgument.promise.missing
        ? undefined
        : await invocation.force(dataArgument.promise);
    const naActionArgument = parsed.dots.find((argument) => argument.name === "na.action");
    const naActionPolicy = await modelFrameNaAction(invocation, naActionArgument);
    const xlevArgument = parsed.dots.find((argument) => argument.name === "xlev");
    const xlevels =
      xlevArgument === undefined || xlevArgument.promise.missing
        ? new Map<string, readonly string[]>()
        : modelXLevelsValue(await invocation.force(xlevArgument.promise));
    const subsetArgument = parsed.dots.find((argument) => argument.name === "subset");
    const unsupported = parsed.dots.find(
      (argument) =>
        argument !== dataArgument &&
        argument !== naActionArgument &&
        argument !== xlevArgument &&
        argument !== subsetArgument &&
        argument.name !== "drop.unused.levels",
    );
    if (unsupported !== undefined) {
      throw new RUnsupportedFeatureError(
        "NRU6130",
        `model.frame() argument '${unsupported.name ?? ""}' requires the wider model-frame slice.`,
      );
    }
    const environment = modelDataEnvironment(
      data,
      object.environment ?? objectArgument.promise.environment,
    );
    const subset =
      subsetArgument === undefined || subsetArgument.promise.missing
        ? undefined
        : await evaluateModelArgument(invocation, subsetArgument, environment);
    const modelTerms = termsFromFormula(object, invocation, data);
    const prepared = await prepareModelData(
      {
        formula: modelTerms,
        ...(data === undefined ? {} : { data }),
        environment,
        requireResponse: object.response !== undefined,
        allowCategoricalResponse: true,
        omitMissing: naActionPolicy !== "pass",
        ...(subset === undefined ? {} : { subset }),
        xlevels,
      },
      invocation,
    );
    if (naActionPolicy === "fail" && prepared.omittedIndices.length > 0) {
      throw new REvaluationError("NRE2148", "missing values in object");
    }
    const naAction =
      naActionPolicy !== "omit" || prepared.omittedIndices.length === 0
        ? undefined
        : withClasses(
            withNames(
              integerVector(prepared.omittedIndices.map((index) => index + 1)),
              prepared.omittedIndices.map((index) => String(index + 1)),
            ),
            ["omit"],
          );
    return buildModelFrame(prepared, modelTerms, xlevels, naAction, invocation);
  }
  throw new RUnsupportedFeatureError(
    "NRU6130",
    "model.frame() currently supports fitted lm and aov objects that retain their model frame.",
  );
}

async function modelFrameNaAction(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<"pass" | "omit" | "fail"> {
  if (argument === undefined) return "omit";
  const expression = argument.promise.expression;
  if (expression?.kind === "Identifier") {
    if (expression.name === "na.pass") return "pass";
    if (expression.name === "na.omit") return "omit";
    if (expression.name === "na.fail") return "fail";
  }
  const value = await invocation.force(argument.promise);
  if (value.type === "null") return "pass";
  if (value.type === "builtin") {
    if (value.definition.name === "na.pass") return "pass";
    if (value.definition.name === "na.omit") return "omit";
    if (value.definition.name === "na.fail") return "fail";
  }
  throw new RUnsupportedFeatureError(
    "NRU6130",
    "model.frame(na.action=) currently supports na.pass, na.omit, na.fail, and NULL.",
  );
}

async function builtinModelResponse(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["data", "type"]);
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in model.response().");
  const dataArgument = parsed.matched.get("data");
  if (dataArgument === undefined || dataArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'data' is missing in model.response().");
  }
  const data = await invocation.force(dataArgument.promise);
  if (data.type !== "list" || !isDataFrame(data)) {
    throw new RTypeMismatchError("NRT3265", "argument is of length zero");
  }

  const typeArgument = parsed.matched.get("type");
  const typeValue =
    typeArgument === undefined || typeArgument.promise.missing
      ? characterVector(["any"])
      : await invocation.force(typeArgument.promise);
  if (typeValue.type !== "character" || typeValue.length !== 1 || isMissing(typeValue, 0)) {
    throw new RTypeMismatchError("NRT3265", "invalid response type");
  }
  const responseType = typeValue.values[0] ?? "";
  if (responseType !== "any" && responseType !== "numeric" && responseType !== "double") {
    throw new RTypeMismatchError("NRT3265", "invalid response type");
  }

  const terms = data.attributes.get("terms");
  const responseAttribute =
    terms?.type === "formula" ? terms.attributes?.get("response") : undefined;
  const responseIndex =
    responseAttribute?.type === "integer" || responseAttribute?.type === "double"
      ? Math.trunc(responseAttribute.values[0] ?? 0)
      : responseAttribute?.type === "logical"
        ? (responseAttribute.values[0] ?? 0)
        : 0;
  if (responseIndex <= 0) return R_NULL;
  const response = data.values[responseIndex - 1];
  if (response === undefined || !isAtomic(response)) {
    throw new RTypeMismatchError("NRT3265", "invalid response variable");
  }

  let result: RVector = response;
  if (responseType !== "any" && (response.type === "logical" || response.type === "integer")) {
    if (isFactor(response)) {
      invocation.context.warn({
        code: "NRW1143",
        message: 'using type = "numeric" with a factor response will be ignored',
      });
    } else {
      result = {
        ...doubleVector(Array.from(response.values), response.missing),
        attributes: response.attributes,
      };
    }
  }

  if (vectorDimensions(result) !== undefined) return result;
  const rowNames = data.attributes.get("row.names");
  return rowNames?.type === "character" && rowNames.length === result.length
    ? withNames(result, rowNames.values)
    : result;
}

async function builtinModelFrameWeights(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x"]);
  const argument = parsed.matched.get("x");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in model.weights().");
  }
  const input = await invocation.force(argument.promise);
  if (input.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "subscript out of bounds");
  }
  return modelField(input, "(weights)") ?? R_NULL;
}

async function builtinTerms(invocation: BuiltinInvocation, dispatch: boolean): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x", "..."]);
  const objectArgument = parsed.matched.get("x");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in terms().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (dispatch) {
    const dispatched = await invocation.dispatchS3IfPresent("terms", object, invocation.arguments);
    if (dispatched !== undefined) return dispatched;
  }
  if (object.type === "list") {
    const retained = modelField(object, "terms") ?? object.attributes.get("terms");
    if (retained !== undefined) return retained;
  }
  if (object.type !== "formula") {
    throw new RTypeMismatchError(
      "NRT3265",
      "terms() requires a formula or supported model object.",
    );
  }
  const dataArgument = parsed.dots.find((argument) => argument.name === "data");
  const data =
    dataArgument === undefined || dataArgument.promise.missing
      ? undefined
      : await invocation.force(dataArgument.promise);
  return termsFromFormula(object, invocation, data);
}

async function builtinTermsFormula(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "x",
    "specials",
    "abb",
    "data",
    "neg.out",
    "keep.order",
    "simplify",
    "...",
    "allowDotAsName",
  ]);
  if (parsed.dots.length > 0) {
    throw new REvaluationError("NRE2101", "Unused argument in terms.formula().");
  }
  const objectArgument = parsed.matched.get("x");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in terms.formula().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (object.type !== "formula") {
    throw new RTypeMismatchError("NRT3265", "'x' is not a valid formula");
  }
  const specialsArgument = parsed.matched.get("specials");
  const specialsValue =
    specialsArgument === undefined || specialsArgument.promise.missing
      ? R_NULL
      : await invocation.force(specialsArgument.promise);
  if (
    specialsValue.type !== "null" &&
    (specialsValue.type !== "character" ||
      specialsValue.missing !== undefined ||
      specialsValue.values.some((name) => name.length === 0))
  ) {
    throw new RTypeMismatchError("NRT3265", "'specials' must be NULL or a character vector");
  }
  const abbArgument = parsed.matched.get("abb");
  if (abbArgument !== undefined && !abbArgument.promise.missing) {
    const abb = await invocation.force(abbArgument.promise);
    if (abb.type !== "null") {
      throw new RUnsupportedFeatureError(
        "NRU6312",
        "terms.formula(abb=) is outside the current browser-admissible contract.",
      );
    }
  }
  const negOut = await optionalModelFlag(
    invocation,
    parsed.matched.get("neg.out"),
    true,
    "neg.out",
  );
  const keepOrder = await optionalModelFlag(
    invocation,
    parsed.matched.get("keep.order"),
    false,
    "keep.order",
  );
  const simplify = await optionalModelFlag(
    invocation,
    parsed.matched.get("simplify"),
    false,
    "simplify",
  );
  const allowDotAsName = await optionalModelFlag(
    invocation,
    parsed.matched.get("allowDotAsName"),
    false,
    "allowDotAsName",
  );
  if (!negOut || simplify || allowDotAsName) {
    throw new RUnsupportedFeatureError(
      "NRU6312",
      "The requested terms.formula control is outside the current browser-admissible contract.",
    );
  }
  const dataArgument = parsed.matched.get("data");
  const data =
    dataArgument === undefined || dataArgument.promise.missing
      ? undefined
      : await invocation.force(dataArgument.promise);
  return termsFromFormula(object, invocation, data, {
    keepOrder,
    specials: specialsValue.type === "character" ? specialsValue.values : [],
  });
}

async function builtinDeleteResponse(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["termobj"]);
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in delete.response().");
  const objectArgument = parsed.matched.get("termobj");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'termobj' is missing in delete.response().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (object.type !== "formula") {
    throw new RTypeMismatchError("NRT3265", "invalid terms object");
  }
  const expression = object.expression;
  const responseFreeExpression =
    expression?.kind === "FormulaExpression"
      ? (({ left: _left, ...rightOnly }) => rightOnly)(expression)
      : expression;
  const responseFree: RFormula = {
    type: "formula",
    terms: object.terms,
    variables: object.variables.filter((name) => name !== object.response),
    intercept: object.intercept,
    environment: object.environment,
    ...(object.attributes === undefined ? {} : { attributes: object.attributes }),
    ...(responseFreeExpression === undefined ? {} : { expression: responseFreeExpression }),
  };
  const result = termsFromFormula(responseFree, invocation);
  const attributes = new Map(result.attributes ?? []);
  attributes.set("response", doubleVector([0]));
  return { ...result, attributes };
}

async function builtinDropTerms(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["termobj", "dropx", "keep.response"]);
  if (parsed.dots.length > 0) {
    throw new REvaluationError("NRE2101", "Unused argument in drop.terms().");
  }
  const objectArgument = parsed.matched.get("termobj");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'termobj' is missing in drop.terms().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (object.type !== "formula" || !objectClasses(object)?.includes("terms")) {
    throw new RTypeMismatchError("NRT3265", `'termobj' must be a object of class "terms"`);
  }

  const keepResponseArgument = parsed.matched.get("keep.response");
  const keepResponse =
    keepResponseArgument === undefined || keepResponseArgument.promise.missing
      ? false
      : dropTermsLogicalFlag(await invocation.force(keepResponseArgument.promise), "keep.response");
  const dropArgument = parsed.matched.get("dropx");
  const drop =
    dropArgument === undefined || dropArgument.promise.missing
      ? R_NULL
      : await invocation.force(dropArgument.promise);
  if (drop.type === "null" || (isAtomic(drop) && drop.length === 0)) {
    if (keepResponse) return object;
    return dropTermsDeleteResponse(object, invocation);
  }
  if (drop.type !== "logical" && drop.type !== "integer" && drop.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "invalid argument to unary operator");
  }

  const labelsValue = object.attributes?.get("term.labels");
  if (labelsValue?.type !== "character") {
    throw new RTypeMismatchError("NRT3265", "invalid terms object");
  }
  const negatedMissing = new Uint8Array(drop.length);
  const negatedValues = new Float64Array(drop.length);
  for (let index = 0; index < drop.length; index += 1) {
    if (isMissing(drop, index) || !Number.isFinite(drop.values[index] ?? Number.NaN)) {
      negatedMissing[index] = 1;
    } else {
      negatedValues[index] = -(drop.values[index] ?? 0);
    }
  }
  const selected = subsetVector(
    labelsValue,
    doubleVector(
      negatedValues,
      negatedMissing.some((entry) => entry !== 0) ? negatedMissing : undefined,
    ),
    invocation.context,
  );
  if (selected.type !== "character" || selected.missing?.some((entry) => entry !== 0)) {
    throw new RTypeMismatchError("NRT3265", "invalid model formula in ExtractVars");
  }

  const keptLabels = [...selected.values];
  const canonicalLabels = canonicalizeDroppedTermLabels(keptLabels);
  const offsets = object.terms.filter(isOffsetModelTerm);
  const rightTerms = [...keptLabels, ...offsets];
  const right =
    rightTerms.length === 0
      ? object.intercept
        ? "1"
        : "-1"
      : `${rightTerms.join(" + ")}${object.intercept ? "" : " - 1"}`;
  const response = keepResponse && object.response !== undefined ? `${object.response} ` : "";
  const rebuilt = await modelSourceValue(
    `${response}~ ${right}`,
    object.environment ?? invocation.currentEnvironment(),
    invocation,
  );
  if (rebuilt.type !== "formula") throw new Error();
  const result = termsFromFormula(rebuilt, invocation);
  const attributes = new Map(result.attributes ?? []);
  attributes.set("term.labels", characterVector(canonicalLabels));
  const factors = attributes.get("factors");
  if (factors?.type === "integer") {
    attributes.set(
      "factors",
      withAttribute(
        factors,
        "dimnames",
        listValue([characterVector(result.variables), characterVector(canonicalLabels)]),
      ),
    );
  }
  return { ...result, attributes };
}

function dropTermsLogicalFlag(value: RValue, name: string): boolean {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    Number.isNaN(value.values[0] ?? Number.NaN)
  ) {
    throw new RTypeMismatchError(
      "NRT3265",
      `${name} must be one non-missing logical or numeric value.`,
    );
  }
  return (value.values[0] ?? 0) !== 0;
}

function dropTermsDeleteResponse(object: RFormula, invocation: BuiltinInvocation): RFormula {
  const expression = object.expression;
  const responseFreeExpression =
    expression?.kind === "FormulaExpression"
      ? (({ left: _left, ...rightOnly }) => rightOnly)(expression)
      : expression;
  const responseFree: RFormula = {
    type: "formula",
    terms: object.terms,
    variables: object.variables.filter((name) => name !== object.response),
    intercept: object.intercept,
    environment: object.environment,
    ...(object.attributes === undefined ? {} : { attributes: object.attributes }),
    ...(responseFreeExpression === undefined ? {} : { expression: responseFreeExpression }),
  };
  const result = termsFromFormula(responseFree, invocation);
  const attributes = new Map(result.attributes ?? []);
  attributes.set("response", integerVector([0]));
  return { ...result, attributes };
}

function canonicalizeDroppedTermLabels(labels: readonly string[]): readonly string[] {
  const componentOrder = new Map<string, number>();
  for (const label of labels) {
    for (const component of modelTermComponents(label)) {
      if (!componentOrder.has(component)) componentOrder.set(component, componentOrder.size);
    }
  }
  return labels.map((label) =>
    [...modelTermComponents(label)]
      .sort(
        (left, right) =>
          (componentOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (componentOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
      )
      .join(":"),
  );
}

async function builtinOffset(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object"]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in offset().");
  }
  return invocation.force(objectArgument.promise);
}

async function builtinModelOffset(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x"]);
  const objectArgument = parsed.matched.get("x");
  if (objectArgument === undefined || objectArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in model.offset().");
  }
  const object = await invocation.force(objectArgument.promise);
  if (object.type !== "list" || !isDataFrame(object)) return R_NULL;
  const terms = object.attributes.get("terms");
  const offsetAttribute = terms?.type === "formula" ? terms.attributes?.get("offset") : undefined;
  if (offsetAttribute?.type !== "integer" || offsetAttribute.length === 0) return R_NULL;
  let result: Float64Array | undefined;
  let missing: Uint8Array | undefined;
  for (let index = 0; index < offsetAttribute.length; index += 1) {
    const column = object.values[(offsetAttribute.values[index] ?? 0) - 1];
    if (column?.type !== "logical" && column?.type !== "integer" && column?.type !== "double") {
      throw new RTypeMismatchError("NRT3265", "invalid model offset");
    }
    result ??= new Float64Array(column.length);
    missing ??= new Uint8Array(column.length);
    for (let row = 0; row < column.length; row += 1) {
      if (isMissing(column, row)) missing[row] = 1;
      else result[row] = (result[row] ?? 0) + (column.values[row] ?? 0);
    }
  }
  if (result === undefined) return R_NULL;
  return doubleVector(result, missing?.some((entry) => entry !== 0) ? missing : undefined);
}

function termsFromFormula(
  formula: RFormula,
  invocation: BuiltinInvocation,
  data?: RValue,
  options: {
    readonly keepOrder?: boolean;
    readonly specials?: readonly string[];
  } = {},
): RFormula {
  const allLabels = [...expandDotTerms(formula, data)];
  const sourceLabels = allLabels.filter((label) => !isOffsetModelTerm(label));
  const canonicalLabels = [...canonicalizeDroppedTermLabels(sourceLabels)];
  const labels = options.keepOrder
    ? canonicalLabels
    : canonicalLabels.sort((left, right) => left.split(":").length - right.split(":").length);
  const orderedSourceLabels = options.keepOrder
    ? [...sourceLabels]
    : [...sourceLabels].sort((left, right) => left.split(":").length - right.split(":").length);
  const termVariables = allLabels.flatMap(modelTermComponents);
  const variables = [
    ...(formula.response === undefined ? [] : [formula.response]),
    ...termVariables.filter(
      (name, index) => name !== formula.response && termVariables.indexOf(name) === index,
    ),
  ];
  const source = `list(${variables.join(", ")})`;
  const program = invocation.parse(source, 1);
  const variablesCall = program.body[0];
  if (variablesCall === undefined) {
    throw new Error();
  }
  const factorValues = new Int32Array(variables.length * labels.length);
  for (const [column, label] of labels.entries()) {
    for (const [row, variable] of variables.entries()) {
      if (label === variable || label.split(":").includes(variable)) {
        factorValues[row + column * variables.length] = 1;
      }
    }
  }
  let factors = withDimensions(integerVector(factorValues), [variables.length, labels.length]);
  factors = withAttribute(
    factors,
    "dimnames",
    listValue([characterVector(variables), characterVector(labels)]),
  );
  const attributes = new Map(formula.attributes ?? []);
  attributes.set("variables", { type: "language", expression: variablesCall });
  attributes.set("factors", factors);
  attributes.set("term.labels", characterVector(labels));
  attributes.set("order", integerVector(labels.map((label) => label.split(":").length)));
  attributes.set("intercept", integerVector([formula.intercept ? 1 : 0]));
  attributes.set("response", integerVector([formula.response === undefined ? 0 : 1]));
  if ((options.specials?.length ?? 0) > 0) {
    attributes.set(
      "specials",
      pairlistValue(
        (options.specials ?? []).map((special) =>
          integerVector(
            variables.flatMap((variable, index) =>
              new RegExp(`^${escapeModelRegex(special)}\\s*\\(`, "u").test(variable)
                ? [index + 1]
                : [],
            ),
          ),
        ),
        options.specials,
      ),
    );
  } else {
    attributes.delete("specials");
  }
  const offsetPositions = variables.flatMap((name, index) =>
    isOffsetModelTerm(name) ? [index + 1] : [],
  );
  if (offsetPositions.length > 0) attributes.set("offset", integerVector(offsetPositions));
  else attributes.delete("offset");
  attributes.set("class", characterVector(["terms", "formula"]));
  invocation.context.allocate(variables.length * labels.length + variables.length + labels.length);
  return {
    ...formula,
    terms: [...orderedSourceLabels, ...allLabels.filter(isOffsetModelTerm)],
    attributes,
  };
}

function isOffsetModelTerm(label: string): boolean {
  return /^offset\s*\(/u.test(label);
}

function escapeModelRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function modelMatrixFromFormula(
  formula: RFormula,
  data: RValue | undefined,
  xlevels: ReadonlyMap<string, readonly string[]>,
  invocation: BuiltinInvocation,
  contrastSpecifications: ReadonlyMap<string, RValue> = new Map(),
): Promise<RDoubleVector> {
  const effectiveFormula = modelMatrixFormula(formula);
  const environment = modelDataEnvironment(
    data,
    effectiveFormula.environment ?? invocation.currentEnvironment(),
  );
  const prepared = await prepareModelData(
    {
      formula: effectiveFormula,
      ...(data === undefined ? {} : { data }),
      environment,
      requireResponse: false,
      // A data frame carrying a terms attribute is already a model frame. GNU R preserves its
      // row set (including rows retained by na.pass) and lets model.matrix encode missing cells;
      // ordinary data frames still pass through the default omission policy.
      omitMissing: !(data?.type === "list" && isDataFrame(data) && data.attributes.has("terms")),
      xlevels,
    },
    invocation,
  );
  return (
    await buildModelMatrix(prepared, effectiveFormula, xlevels, invocation, contrastSpecifications)
  ).matrix;
}

function modelMatrixFormula(formula: RFormula): RFormula {
  const intercept = formula.attributes?.get("intercept");
  if (
    intercept === undefined ||
    (intercept.type !== "logical" && intercept.type !== "integer" && intercept.type !== "double") ||
    intercept.length !== 1 ||
    isMissing(intercept, 0)
  ) {
    return formula;
  }
  return { ...formula, intercept: realAt(intercept, 0) !== 0 };
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
    throw new REvaluationError("NRE2101", "Unused argument in xtabs().");
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

async function builtinModelCovariance(
  invocation: BuiltinInvocation,
  mode: "generic" | "glm" = "generic",
): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "..."]);
  const argument = parsed.matched.get("object");
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in vcov().");
  }
  const object = await invocation.force(argument.promise);
  if (mode === "generic") {
    const dispatched = await invocation.dispatchS3IfPresent("vcov", object, invocation.arguments);
    if (dispatched !== undefined) return dispatched;
  }
  if (object.type !== "list" || !isLinearModel(object)) {
    throw new RTypeMismatchError("NRT3265", "vcov() requires an lm/aov object.");
  }
  if (mode === "glm" && !vectorClasses(object)?.includes("glm")) {
    throw new RTypeMismatchError("NRT3265", "vcov.glm() requires a glm object.");
  }
  // The generic exposes object + ..., while vcov.lm() adds complete before its
  // own ellipsis. Match the method formals here so positional and partial
  // complete arguments retain ordinary R matching. Method dots are deliberately
  // unforced and ignored, as in GNU vcov.lm(); packages commonly forward
  // controls such as dispersion through this route.
  const methodArguments = matchBuiltinArguments(invocation, ["object", "complete", "..."]);
  const completeArgument = methodArguments.matched.get("complete");
  const complete =
    completeArgument === undefined || completeArgument.promise.missing
      ? true
      : modelLogicalFlag(await invocation.force(completeArgument.promise), true, "complete");
  if (vectorClasses(object)?.includes("glm")) {
    const family = glmDescriptorFromObject(modelField(object, "family"));
    const dispersionArgument = methodArguments.dots.find(
      (methodArgument) => methodArgument.name === "dispersion",
    );
    const requestedDispersion =
      dispersionArgument === undefined
        ? undefined
        : modelScalarValue(await invocation.force(dispersionArgument.promise), "dispersion");
    const degrees = modelIntegerField(object, "df.residual");
    const dispersion =
      requestedDispersion ??
      family.fixedDispersion ??
      (await glmPearsonDispersion(object, family, invocation)) / degrees;
    if (!Number.isFinite(dispersion) || dispersion < 0) {
      throw new RTypeMismatchError("NRT3265", "dispersion must be a finite non-negative number");
    }
    return selectGlmCovariance(
      glmCovarianceMatrices(object, dispersion, invocation).scaled,
      object,
      complete,
      invocation,
    );
  }
  return linearModelCovariance(object, complete, invocation);
}

function selectGlmCovariance(
  covariance: RDoubleVector,
  model: RList,
  complete: boolean,
  invocation: BuiltinInvocation,
): RDoubleVector {
  if (complete) return covariance;
  const coefficients = modelField(model, "coefficients");
  if (coefficients?.type !== "double") {
    throw new RTypeMismatchError("NRT3265", "The glm object has malformed coefficients.");
  }
  const indices = integerVector(
    Array.from({ length: coefficients.length }, (_, index) => index + 1).filter(
      (_, index) => !isMissing(coefficients, index),
    ),
  );
  return subsetDimensions(
    covariance,
    [indices, indices],
    false,
    invocation.context,
  ) as RDoubleVector;
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

async function builtinLinearModelInfluence(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["model", "do.coef"]);
  const modelArgument = parsed.matched.get("model");
  if (modelArgument === undefined || modelArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'model' is missing in lm.influence().");
  }
  const value = await invocation.force(modelArgument.promise);
  if (value.type !== "list" || !isLinearModel(value)) {
    throw new RTypeMismatchError("NRT3265", "lm.influence() requires an lm model object.");
  }
  const doCoefficients = await optionalModelFlag(
    invocation,
    parsed.matched.get("do.coef"),
    true,
    "do.coef",
  );
  const residuals = modelField(value, "residuals");
  const weights = modelField(value, "weights");
  const qr = modelField(value, "qr");
  const state = MODEL_INFLUENCE_STATES.get(value);
  const designValue = state?.design.matrix ?? modelField(value, "x");
  const designDimensions =
    designValue?.type === "double" ? vectorDimensions(designValue) : undefined;
  if (
    residuals?.type !== "double" ||
    (weights !== undefined && weights.type !== "double") ||
    qr?.type !== "list" ||
    designValue?.type !== "double" ||
    designDimensions?.length !== 2
  ) {
    throw new RTypeMismatchError(
      "NRT3265",
      "The lm object requires residuals, weights, QR metadata, and its fitted design matrix.",
    );
  }
  const rows = designDimensions[0] ?? 0;
  const columns = designDimensions[1] ?? 0;
  if (rows !== residuals.length || (weights !== undefined && weights.length !== rows)) {
    throw new RTypeMismatchError("NRT3265", "The lm object has inconsistent influence metadata.");
  }
  const qrMatrix = modelField(qr, "qr");
  const pivotValue = modelField(qr, "pivot");
  const rankValue = modelField(qr, "rank");
  const qrDimensions = qrMatrix?.type === "double" ? vectorDimensions(qrMatrix) : undefined;
  if (
    qrMatrix?.type !== "double" ||
    qrDimensions?.length !== 2 ||
    pivotValue?.type !== "integer" ||
    rankValue?.type !== "integer" ||
    rankValue.length !== 1
  ) {
    throw new RTypeMismatchError("NRT3265", "The lm object has malformed QR metadata.");
  }
  const rank = rankValue.values[0] ?? 0;
  if (rank < 0 || rank > columns || pivotValue.length < columns) {
    throw new RTypeMismatchError("NRT3265", "The lm object has inconsistent QR rank metadata.");
  }
  const selectedColumns = Array.from(
    { length: rank },
    (_unused, index) => (pivotValue.values[index] ?? 1) - 1,
  );
  if (selectedColumns.some((index) => index < 0 || index >= columns)) {
    throw new RTypeMismatchError("NRT3265", "The lm object has an invalid QR pivot.");
  }
  const inverse = invertUpperTriangular(qrMatrix, qrDimensions[0] ?? 0, rank);
  const positiveRows = Array.from({ length: rows }, (_unused, index) => index).filter(
    (index) => (weights?.values[index] ?? 1) > 0,
  );
  const outputRows = positiveRows.length;
  const hats = new Float64Array(outputRows);
  const coefficientChanges = new Float64Array(outputRows * rank);
  const sigmas = new Float64Array(outputRows);
  const weightedResiduals = new Float64Array(outputRows);
  let residualSumSquares = 0;
  for (let row = 0; row < rows; row += 1) {
    const residual = residuals.values[row] ?? 0;
    residualSumSquares += residual * residual * (weights?.values[row] ?? 1);
  }
  const degrees = modelIntegerField(value, "df.residual");
  for (let outputRow = 0; outputRow < outputRows; outputRow += 1) {
    invocation.context.checkpoint();
    const row = positiveRows[outputRow] ?? 0;
    const weight = weights?.values[row] ?? 1;
    const residual = residuals.values[row] ?? 0;
    const predictor = Float64Array.from(
      { length: rank },
      (_unused, index) => designValue.values[row + (selectedColumns[index] ?? 0) * rows] ?? 0,
    );
    const covarianceTimesPredictor = new Float64Array(rank);
    for (let left = 0; left < rank; left += 1) {
      let coordinate = 0;
      for (let right = 0; right < rank; right += 1) {
        let covariance = 0;
        for (let inner = 0; inner < rank; inner += 1) {
          covariance += (inverse[left + inner * rank] ?? 0) * (inverse[right + inner * rank] ?? 0);
        }
        coordinate += covariance * (predictor[right] ?? 0);
      }
      covarianceTimesPredictor[left] = coordinate;
    }
    let hat = 0;
    for (let index = 0; index < rank; index += 1) {
      hat += (predictor[index] ?? 0) * (covarianceTimesPredictor[index] ?? 0);
    }
    hat *= weight;
    hats[outputRow] = hat;
    const denominator = 1 - hat;
    for (let column = 0; column < rank; column += 1) {
      coefficientChanges[outputRow + column * outputRows] =
        ((covarianceTimesPredictor[column] ?? 0) * weight * residual) / denominator;
    }
    const weightedResidual = residual * Math.sqrt(weight);
    weightedResiduals[outputRow] = weightedResidual;
    sigmas[outputRow] = Math.sqrt(
      (residualSumSquares - (weightedResidual * weightedResidual) / denominator) / (degrees - 1),
    );
  }
  const residualNames = vectorNames(residuals);
  const rowNames = positiveRows.map((row) => residualNames?.[row] ?? String(row + 1));
  const coefficientValue = modelField(value, "coefficients");
  const coefficientNames =
    coefficientValue !== undefined && isAtomic(coefficientValue)
      ? vectorNames(coefficientValue)
      : undefined;
  let changes = withDimensions(doubleVector(coefficientChanges), [outputRows, rank]);
  changes = withAttribute(
    changes,
    "dimnames",
    listValue([
      characterVector(rowNames),
      characterVector(
        selectedColumns.map((column) => coefficientNames?.[column] ?? String(column + 1)),
      ),
    ]),
  );
  const fields = [
    withNames(doubleVector(hats), rowNames),
    doCoefficients ? changes : R_NULL,
    withNames(doubleVector(sigmas), rowNames),
    withNames(doubleVector(weightedResiduals), rowNames),
  ];
  invocation.context.allocate(outputRows * (rank + 3) + rank * rank * 2);
  if (doCoefficients) return listValue(fields, ["hat", "coefficients", "sigma", "wt.res"]);
  const output = listValue(fields);
  return withAttribute(
    output,
    "names",
    characterVector(["hat", "", "sigma", "wt.res"], Uint8Array.of(0, 1, 0, 0)),
  );
}

async function builtinHatValuesLm(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["model", "infl", "..."]);
  const modelArgument = parsed.matched.get("model");
  if (modelArgument === undefined || modelArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'model' is missing in hatvalues.lm().");
  }
  const model = await invocation.force(modelArgument.promise);
  let influence: RValue;
  const influenceArgument = parsed.matched.get("infl");
  if (influenceArgument !== undefined && !influenceArgument.promise.missing) {
    influence = await invocation.force(influenceArgument.promise);
  } else {
    const influenceFunction = await invocation.namespaceBinding("stats", "lm.influence");
    if (influenceFunction === undefined) {
      throw new REvaluationError("NRE2001", "Object 'lm.influence' not found.");
    }
    influence = await invocation.invoke(
      influenceFunction,
      [
        { name: "model", value: model },
        { name: "do.coef", value: logicalVector([false]) },
      ],
      invocation.currentEnvironment(),
    );
  }
  if (influence.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "hatvalues.lm() requires an influence result list.");
  }
  const hat = modelField(influence, "hat");
  if (hat === undefined) {
    throw new RTypeMismatchError("NRT3265", "hatvalues.lm() influence result has no 'hat' field.");
  }
  return hat;
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
  return modelXLevelsValue(modelField(model, "xlevels"));
}

function modelXLevelsValue(value: RValue | undefined): ReadonlyMap<string, readonly string[]> {
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

function modelContrastSpecifications(value: RValue | undefined): ReadonlyMap<string, RValue> {
  if (value === undefined || value.type === "null") return new Map();
  if (value.type !== "list") {
    throw new RTypeMismatchError("NRT3265", "contrasts must be a named list");
  }
  const names = vectorNames(value);
  if (
    names === undefined ||
    names.length !== value.values.length ||
    names.some((name) => name.length === 0)
  ) {
    throw new RTypeMismatchError("NRT3265", "contrasts must be a named list");
  }
  const output = new Map<string, RValue>();
  for (const [index, name] of names.entries()) {
    if (output.has(name)) {
      throw new RTypeMismatchError("NRT3265", `duplicate contrast specification for '${name}'`);
    }
    const specification = value.values[index];
    if (specification === undefined) throw new Error();
    output.set(name, specification);
  }
  return output;
}

function modelContrastsValue(design: ModelMatrixResult): RValue | undefined {
  if (design.contrasts.size === 0) return undefined;
  return listValue(
    [...design.contrasts].map(
      (name) => design.contrastSpecifications.get(name) ?? characterVector(["contr.treatment"]),
    ),
    [...design.contrasts],
  );
}

function compactModelMask(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((value) => value === 1) ? mask : undefined;
}

interface PrepareModelOptions {
  readonly formula: RFormula;
  readonly data?: RValue;
  readonly environment: REnvironment;
  readonly requireResponse: boolean;
  readonly allowCategoricalResponse?: boolean;
  readonly omitMissing: boolean;
  readonly subset?: RValue;
  readonly weights?: RealVector;
  readonly offset?: RealVector;
  readonly xlevels: ReadonlyMap<string, readonly string[]>;
}

interface PreparedModelData {
  readonly terms: readonly string[];
  readonly variables: ReadonlyMap<string, AtomicVector>;
  readonly response?: AtomicVector;
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

  let response: AtomicVector | undefined;
  if (options.requireResponse && options.formula.response !== undefined) {
    const value = await evaluateModelLabel(
      options.formula.response,
      options.environment,
      invocation,
    );
    response = options.allowCategoricalResponse
      ? modelAtomicResponse(value)
      : modelRealVector(value, "response");
  } else if (options.requireResponse) {
    throw new RTypeMismatchError("NRT3265", "A fitted linear model requires a response.");
  }
  const lengths = [
    ...(response === undefined ? [] : [modelResponseRows(response)]),
    ...[...variables.values()].map(modelVariableRows),
  ];
  const dataRows =
    options.data !== undefined && isDataFrame(options.data)
      ? dataFrameRowCount(options.data)
      : undefined;
  const originalRows = lengths[0] ?? dataRows ?? 0;
  if (lengths.some((length) => length !== originalRows)) {
    throw new RTypeMismatchError("NRT3265", "Model variables have different row counts.");
  }
  const formulaOffsets = terms.flatMap((term) => {
    if (!isOffsetModelTerm(term)) return [];
    const value = variables.get(term);
    if (
      value === undefined ||
      (value.type !== "logical" && value.type !== "integer" && value.type !== "double")
    ) {
      throw new RTypeMismatchError("NRT3265", "invalid model offset");
    }
    return [value];
  });
  validateModelAuxiliaryLength(options.weights, originalRows, "weights");
  validateModelAuxiliaryLength(options.offset, originalRows, "offset");

  const rowNames = modelRowNames(options.data, response, originalRows);
  const subsetIndices = resolveModelSubset(options.subset, originalRows, rowNames);
  const kept: number[] = [];
  const omitted: number[] = [];
  for (const index of subsetIndices) {
    invocation.context.checkpoint();
    const complete =
      (response === undefined || modelResponseCellComplete(response, index)) &&
      [...variables.values()].every((value) => modelVariableCellComplete(value, index)) &&
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

  const filteredVariables = new Map<string, AtomicVector>();
  for (const [label, value] of variables) {
    filteredVariables.set(label, subsetModelVariable(value, kept, invocation));
  }
  const filteredResponse =
    response === undefined ? undefined : subsetModelResponse(response, kept, invocation);
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
    ...(options.offset === undefined && formulaOffsets.length === 0
      ? {}
      : {
          offset: Float64Array.from(
            kept,
            (index) =>
              (options.offset === undefined ? 0 : realAt(options.offset, index)) +
              formulaOffsets.reduce((sum, value) => sum + realAt(value, index), 0),
          ),
        }),
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
  const referenced = new Set(formula.variables.filter((name) => name !== "."));
  const expanded = names.filter((name) => !referenced.has(name));
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
  const binding = lookupBinding(environment, label);
  const value =
    binding === undefined
      ? await evaluateModelExpression(label, environment, invocation)
      : await invocation.force(binding);
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
  const dimensions = vectorDimensions(value);
  if (dimensions !== undefined && dimensions.length > 2) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      `Model term '${label}' has more than two dimensions.`,
    );
  }
  return value;
}

function modelVariableRows(value: AtomicVector): number {
  return vectorDimensions(value)?.[0] ?? value.length;
}

function modelVariableCellComplete(value: AtomicVector, row: number): boolean {
  const dimensions = vectorDimensions(value);
  if (dimensions === undefined || dimensions.length === 1) return modelCellComplete(value, row);
  const rows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  for (let column = 0; column < columns; column += 1) {
    if (!modelCellComplete(value, row + column * rows)) return false;
  }
  return true;
}

function subsetModelVariable(
  value: AtomicVector,
  rows: readonly number[],
  invocation: BuiltinInvocation,
): AtomicVector {
  const dimensions = vectorDimensions(value);
  if (dimensions === undefined) {
    return modelAtomicVectorResult(
      subsetVector(value, integerVector(rows.map((index) => index + 1)), invocation.context),
    );
  }
  if (dimensions.length === 1) {
    return subsetOneDimensionalModelArray(value, rows, invocation);
  }
  const sourceRows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  const indices = integerVector(
    Array.from({ length: rows.length * columns }, (_unused, index) => {
      const column = Math.floor(index / rows.length);
      return (rows[index % rows.length] ?? 0) + column * sourceRows + 1;
    }),
  );
  let selected = modelAtomicVectorResult(
    withDimensions(subsetVector(value, indices, invocation.context), [rows.length, columns]),
  );
  const dimnames = value.attributes.get("dimnames");
  if (dimnames?.type === "list") {
    const rowNames = dimnames.values[0];
    const columnNames = dimnames.values[1] ?? R_NULL;
    const selectedRowNames =
      rowNames?.type === "character"
        ? subsetVector(rowNames, integerVector(rows.map((index) => index + 1)), invocation.context)
        : R_NULL;
    selected = modelAtomicVectorResult(
      withAttribute(selected, "dimnames", listValue([selectedRowNames, columnNames])),
    );
  }
  return selected;
}

function modelAtomicVectorResult(value: RValue): AtomicVector {
  if (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "character"
  ) {
    return value;
  }
  throw new RTypeMismatchError("NRT3265", "Model term subsetting produced a non-atomic value.");
}

function modelResponseRows(value: AtomicVector): number {
  const dimensions = vectorDimensions(value);
  return dimensions?.[0] ?? value.length;
}

function modelResponseCellComplete(value: AtomicVector, row: number): boolean {
  const dimensions = vectorDimensions(value);
  if (dimensions === undefined || dimensions.length === 1) return modelCellComplete(value, row);
  const rows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  for (let column = 0; column < columns; column += 1) {
    if (!modelCellComplete(value, row + column * rows)) return false;
  }
  return true;
}

function subsetModelResponse(
  value: AtomicVector,
  rows: readonly number[],
  invocation: BuiltinInvocation,
): AtomicVector {
  const dimensions = vectorDimensions(value);
  if (dimensions === undefined) {
    return subsetVector(
      value,
      integerVector(rows.map((index) => index + 1)),
      invocation.context,
    ) as AtomicVector;
  }
  if (dimensions.length === 1) {
    return subsetOneDimensionalModelArray(value, rows, invocation);
  }
  if (dimensions.length > 2) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "Model responses may have at most two dimensions.",
    );
  }
  const sourceRows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  const indices = integerVector(
    Array.from({ length: rows.length * columns }, (_unused, index) => {
      const column = Math.floor(index / rows.length);
      return (rows[index % rows.length] ?? 0) + column * sourceRows + 1;
    }),
  );
  const selected = subsetVector(value, indices, invocation.context) as AtomicVector;
  return withDimensions(selected, [rows.length, columns]);
}

function subsetOneDimensionalModelArray(
  value: AtomicVector,
  rows: readonly number[],
  invocation: BuiltinInvocation,
): AtomicVector {
  const indices = integerVector(rows.map((index) => index + 1));
  let selected = modelAtomicVectorResult(
    withDimensions(subsetVector(value, indices, invocation.context), [rows.length]),
  );
  const dimnames = value.attributes.get("dimnames");
  const rowNames = dimnames?.type === "list" ? dimnames.values[0] : undefined;
  if (rowNames?.type === "character") {
    selected = modelAtomicVectorResult(
      withAttribute(
        selected,
        "dimnames",
        listValue([subsetVector(rowNames, indices, invocation.context)]),
      ),
    );
  }
  return selected;
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
  response: AtomicVector | undefined,
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
  readonly contrastSpecifications: ReadonlyMap<string, RValue>;
}

interface ModelMatrixResult {
  readonly matrix: RDoubleVector;
  readonly rows: number;
  readonly columns: number;
  readonly columnNames: readonly string[];
  readonly assign: readonly number[];
  readonly xlevels: ReadonlyMap<string, readonly string[]>;
  readonly contrasts: ReadonlySet<string>;
  readonly contrastSpecifications: ReadonlyMap<string, RValue>;
}

async function buildModelMatrix(
  data: PreparedModelData,
  formula: RFormula,
  knownLevels: ReadonlyMap<string, readonly string[]>,
  invocation: BuiltinInvocation,
  contrastSpecifications: ReadonlyMap<string, RValue> = new Map(),
): Promise<ModelMatrixResult> {
  const columns: EncodedModelColumn[] = [];
  const assign: number[] = [];
  const xlevels = new Map<string, readonly string[]>(knownLevels);
  const contrasts = new Set<string>();
  const resolvedContrastSpecifications = new Map<string, RValue>();
  if (formula.intercept) {
    columns.push({ name: "(Intercept)", values: new Float64Array(data.rows).fill(1) });
    assign.push(0);
  }
  const designTerms = data.terms.filter((term) => !isOffsetModelTerm(term));
  for (const [termIndex, term] of designTerms.entries()) {
    const encoded = await encodeModelTerm(
      term,
      data,
      knownLevels,
      !formula.intercept && termIndex === 0,
      invocation,
      contrastSpecifications,
    );
    for (const [name, levels] of encoded.factorLevels) xlevels.set(name, levels);
    for (const name of encoded.contrasts) contrasts.add(name);
    for (const [name, specification] of encoded.contrastSpecifications) {
      resolvedContrastSpecifications.set(name, specification);
    }
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
        [...contrasts].map(
          (name) =>
            resolvedContrastSpecifications.get(name) ?? characterVector(["contr.treatment"]),
        ),
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
    contrastSpecifications: resolvedContrastSpecifications,
  };
}

async function encodeModelTerm(
  term: string,
  data: PreparedModelData,
  knownLevels: ReadonlyMap<string, readonly string[]>,
  fullFactor: boolean,
  invocation: BuiltinInvocation,
  contrastSpecifications: ReadonlyMap<string, RValue>,
): Promise<EncodedModelTerm> {
  const components = modelTermComponents(term);
  let current = await encodeModelComponent(
    components[0] ?? term,
    data,
    knownLevels,
    fullFactor,
    invocation,
    contrastSpecifications,
  );
  for (const component of components.slice(1)) {
    const right = await encodeModelComponent(
      component,
      data,
      knownLevels,
      false,
      invocation,
      contrastSpecifications,
    );
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
      contrastSpecifications: new Map([
        ...current.contrastSpecifications,
        ...right.contrastSpecifications,
      ]),
    };
  }
  return current;
}

async function encodeModelComponent(
  label: string,
  data: PreparedModelData,
  knownLevels: ReadonlyMap<string, readonly string[]>,
  fullFactor: boolean,
  invocation: BuiltinInvocation,
  contrastSpecifications: ReadonlyMap<string, RValue>,
): Promise<EncodedModelTerm> {
  const value = data.variables.get(label);
  if (value === undefined) {
    throw new RTypeMismatchError("NRT3265", `Model term '${label}' is unavailable.`);
  }
  const dimensions = vectorDimensions(value);
  if (dimensions !== undefined) return encodeMatrixModelComponent(label, value, dimensions);
  if (value.type === "integer" && isFactor(value)) {
    return encodeFactorComponent(
      label,
      value,
      factorLevels(value),
      knownLevels.get(label),
      fullFactor,
      invocation,
      contrastSpecifications.get(label),
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
      contrastSpecifications.get(label),
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
      contrastSpecifications.get(label),
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
    contrastSpecifications: new Map(),
  };
}

function encodeMatrixModelComponent(
  label: string,
  value: AtomicVector,
  dimensions: readonly number[],
): EncodedModelTerm {
  const rows = dimensions[0] ?? 0;
  const columns = dimensions[1] ?? 0;
  const dimnames = value.attributes.get("dimnames");
  const columnNames =
    dimnames?.type === "list" && dimnames.values[1]?.type === "character"
      ? dimnames.values[1].values
      : undefined;
  return {
    columns: Array.from({ length: columns }, (_unused, column) => {
      const values = new Float64Array(rows);
      const missing = new Uint8Array(rows);
      for (let row = 0; row < rows; row += 1) {
        const index = row + column * rows;
        if (isMissing(value, index)) {
          missing[row] = 1;
        } else if (value.type === "character") {
          throw new RUnsupportedFeatureError(
            "NRU6130",
            `Character matrix-valued model term '${label}' is not implemented yet.`,
          );
        } else {
          values[row] = value.values[index] ?? 0;
        }
      }
      const suffix = columnNames?.[column] ?? String(column + 1);
      return {
        name: `${label}${suffix}`,
        values,
        ...(compactModelMask(missing) === undefined ? {} : { missing }),
      };
    }),
    factorLevels: new Map(),
    contrasts: new Set(),
    contrastSpecifications: new Map(),
  };
}

function modelCharacterLevels(value: RCharacterVector): readonly string[] {
  return [...new Set(value.values.filter((_entry, index) => !isMissing(value, index)))].sort();
}

async function encodeFactorComponent(
  label: string,
  value: RIntegerVector,
  observedLevels: readonly string[],
  expectedLevels: readonly string[] | undefined,
  fullFactor: boolean,
  invocation: BuiltinInvocation,
  contrastSpecification?: RValue,
): Promise<EncodedModelTerm> {
  const levels = expectedLevels ?? observedLevels;
  if (levels.length < 2 && !fullFactor) {
    throw new RTypeMismatchError(
      "NRT3265",
      "contrasts can be applied only to factors with 2 or more levels",
    );
  }
  const contrast = await resolveModelContrast(
    levels,
    fullFactor,
    contrastSpecification,
    invocation,
  );
  const columns = contrast.columnNames.map((columnName, column) => {
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
      values[index] = contrast.values[position + column * levels.length] ?? 0;
    }
    return {
      name: `${label}${columnName}`,
      values,
      ...(compactModelMask(missing) === undefined ? {} : { missing }),
    };
  });
  return {
    columns,
    factorLevels: new Map([[label, levels]]),
    contrasts: new Set([label]),
    contrastSpecifications: new Map([[label, contrast.specification]]),
  };
}

async function resolveModelContrast(
  levels: readonly string[],
  fullFactor: boolean,
  specification: RValue | undefined,
  invocation: BuiltinInvocation,
): Promise<{
  readonly values: Float64Array;
  readonly columnNames: readonly string[];
  readonly specification: RValue;
}> {
  let resolvedSpecification = specification ?? characterVector(["contr.treatment"]);
  if (resolvedSpecification.type === "closure" || resolvedSpecification.type === "builtin") {
    const generated = await invocation.invoke(resolvedSpecification, [
      { name: "n", value: characterVector(levels) },
    ]);
    resolvedSpecification = completeCallableContrastMatrix(generated, levels, invocation);
  }
  const matrix = fullFactor
    ? contrastIdentity(levels)
    : modelContrastMatrix(resolvedSpecification, levels);
  if (
    (matrix.type !== "logical" && matrix.type !== "integer" && matrix.type !== "double") ||
    vectorDimensions(matrix)?.length !== 2
  ) {
    throw new RTypeMismatchError("NRT3265", "invalid contrast matrix");
  }
  const dimensions = vectorDimensions(matrix)!;
  if (dimensions[0] !== levels.length || (dimensions[1] ?? 0) < 1) {
    throw new RTypeMismatchError("NRT3265", "wrong number of contrast matrix rows");
  }
  const columns = dimensions[1] ?? 0;
  const dimnames = matrix.attributes?.get("dimnames");
  const columnNamesValue =
    dimnames?.type === "list" && dimnames.values[1]?.type === "character"
      ? dimnames.values[1]
      : undefined;
  return {
    values: Float64Array.from({ length: matrix.length }, (_unused, index) => {
      if (isMissing(matrix, index)) {
        throw new RTypeMismatchError("NRT3265", "contrast matrix cannot contain missing values");
      }
      return realAt(matrix, index);
    }),
    columnNames: Array.from(
      { length: columns },
      (_unused, index) => columnNamesValue?.values[index] ?? String(index + 1),
    ),
    specification: resolvedSpecification,
  };
}

function completeCallableContrastMatrix(
  value: RValue,
  levels: readonly string[],
  invocation: BuiltinInvocation,
): RValue {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    vectorDimensions(value)?.length !== 2
  ) {
    throw new RTypeMismatchError("NRT3265", "invalid contrast matrix");
  }
  const dimensions = vectorDimensions(value)!;
  const rows = dimensions[0] ?? 0;
  const suppliedColumns = dimensions[1] ?? 0;
  if (rows !== levels.length) {
    throw new RTypeMismatchError("NRT3265", "wrong number of contrast matrix rows");
  }
  if (suppliedColumns < 1 || suppliedColumns > Math.max(0, rows - 1)) {
    throw new RTypeMismatchError("NRT3265", "invalid contrast matrix");
  }
  const values = new Float64Array(rows * (rows - 1));
  for (let index = 0; index < value.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(value, index)) {
      throw new RTypeMismatchError("NRT3265", "contrast matrix cannot contain missing values");
    }
    values[index] = realAt(value, index);
  }

  const basis: Float64Array[] = [new Float64Array(rows).fill(1 / Math.sqrt(rows))];
  const addBasis = (source: Float64Array, required: boolean): boolean => {
    const residual = Float64Array.from(source);
    let sourceScale = 0;
    for (const entry of source) sourceScale += entry * entry;
    for (const vector of basis) {
      let projection = 0;
      for (let row = 0; row < rows; row += 1) projection += residual[row]! * vector[row]!;
      for (let row = 0; row < rows; row += 1) {
        residual[row] = (residual[row] ?? 0) - projection * vector[row]!;
      }
    }
    let normSquared = 0;
    for (const entry of residual) normSquared += entry * entry;
    const tolerance = 1e-12 * Math.max(1, Math.sqrt(sourceScale));
    if (Math.sqrt(normSquared) <= tolerance) {
      if (required) throw new RTypeMismatchError("NRT3265", "singular contrast matrix");
      return false;
    }
    const norm = Math.sqrt(normSquared);
    for (let row = 0; row < rows; row += 1) residual[row] = (residual[row] ?? 0) / norm;
    basis.push(residual);
    return true;
  };

  for (let column = 0; column < suppliedColumns; column += 1) {
    const source = values.slice(column * rows, (column + 1) * rows);
    addBasis(source, true);
  }
  let outputColumns = suppliedColumns;
  for (let candidate = 0; outputColumns < rows - 1 && candidate < rows; candidate += 1) {
    const source = new Float64Array(rows);
    source[candidate] = 1;
    if (!addBasis(source, false)) continue;
    values.set(basis[basis.length - 1]!, outputColumns * rows);
    outputColumns += 1;
  }
  if (outputColumns !== rows - 1) {
    throw new RTypeMismatchError("NRT3265", "singular contrast matrix");
  }

  const dimnames = value.attributes.get("dimnames");
  const suppliedNames =
    dimnames?.type === "list" && dimnames.values[1]?.type === "character"
      ? dimnames.values[1].values
      : undefined;
  let matrix = withDimensions(doubleVector(values), [rows, rows - 1]);
  matrix = withAttribute(
    matrix,
    "dimnames",
    listValue([
      characterVector(levels),
      suppliedNames === undefined
        ? R_NULL
        : characterVector([
            ...suppliedNames.slice(0, suppliedColumns),
            ...Array.from({ length: rows - 1 - suppliedColumns }, () => ""),
          ]),
    ]),
  );
  return matrix;
}

function modelContrastMatrix(specification: RValue, levels: readonly string[]): RValue {
  if (
    specification.type === "character" &&
    specification.length === 1 &&
    !isMissing(specification, 0)
  ) {
    const generator = specification.values[0];
    if (generator === "contr.treatment") return contrastTreatment(levels, 1, true);
    if (generator === "contr.sum") return contrastSum(levels, true);
    if (generator === "contr.helmert") return contrastHelmert(levels, true);
    throw new RUnsupportedFeatureError(
      "NRU6130",
      `Model contrast generator '${generator}' is not implemented.`,
    );
  }
  if (
    (specification.type === "logical" ||
      specification.type === "integer" ||
      specification.type === "double") &&
    vectorDimensions(specification)?.length === 2
  ) {
    return specification;
  }
  throw new RTypeMismatchError(
    "NRT3265",
    "Model contrasts must be named character generators, callable generators, or numeric matrices.",
  );
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

interface ModelInfluenceState {
  readonly design: ModelMatrixResult;
}

const MODEL_INFLUENCE_STATES = new WeakMap<RList, ModelInfluenceState>();

interface StratifiedAovTerm {
  readonly label: string;
  readonly expression: string;
}

interface AovStratumBasis {
  readonly name: string;
  readonly vectors: readonly Float64Array[];
}

function stratifiedAovErrorTerm(formula: RFormula): StratifiedAovTerm | undefined {
  const matches = formula.terms.flatMap((term) => {
    const match = /^Error\s*\(([\s\S]+)\)$/u.exec(term);
    return match?.[1] === undefined ? [] : [{ label: term, expression: match[1].trim() }];
  });
  if (matches.length > 1) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "aov() supports one Error() term; combine nested strata inside that term.",
    );
  }
  return matches[0];
}

async function fitStratifiedAov(
  options: LinearModelOptions,
  errorTerm: StratifiedAovTerm,
  invocation: BuiltinInvocation,
): Promise<RValue> {
  if (options.weights !== undefined) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "weights are not supported in a multistratum aov() fit.",
    );
  }
  if (options.offset !== undefined) {
    throw new RUnsupportedFeatureError(
      "NRU6130",
      "offsets are not supported in a multistratum aov() fit.",
    );
  }
  const errorValue = await evaluateModelExpression(
    `~ ${errorTerm.expression}`,
    options.dataEnvironment,
    invocation,
  );
  if (errorValue.type !== "formula" || errorValue.response !== undefined) {
    throw new RTypeMismatchError("NRT3265", "aov() Error() requires a one-sided formula term.");
  }
  const ordinaryTerms = options.formula.terms.filter((term) => term !== errorTerm.label);
  const ordinaryFormula: RFormula = {
    ...options.formula,
    terms: ordinaryTerms,
    variables: options.formula.variables.filter((variable) => variable !== errorTerm.label),
  };
  const combinedFormula: RFormula = {
    ...ordinaryFormula,
    terms: [...new Set([...ordinaryTerms, ...errorValue.terms])],
    variables: [...new Set([...ordinaryFormula.variables, ...errorValue.variables])],
  };
  const prepared = await prepareModelData(
    {
      formula: combinedFormula,
      ...(options.data === undefined ? {} : { data: options.data }),
      environment: options.dataEnvironment,
      requireResponse: true,
      omitMissing: options.naAction !== "pass",
      ...(options.subset === undefined ? {} : { subset: options.subset }),
      xlevels: new Map(),
    },
    invocation,
  );
  if (options.naAction === "fail" && prepared.omittedIndices.length > 0) {
    throw new REvaluationError("NRE2148", "missing values in object");
  }
  if (prepared.response === undefined) {
    throw new Error();
  }
  const numericResponse = modelRealVector(prepared.response, "response");
  const mainPrepared: PreparedModelData = { ...prepared, terms: ordinaryTerms };
  const errorPrepared: PreparedModelData = { ...prepared, terms: errorValue.terms };
  const mainDesign = await buildModelMatrix(mainPrepared, ordinaryFormula, new Map(), invocation);
  const errorDesign = await buildModelMatrix(errorPrepared, errorValue, new Map(), invocation);
  const response = Float64Array.from({ length: numericResponse.length }, (_, index) =>
    realAt(numericResponse, index),
  );
  const strata = stratifiedModelBases(errorDesign, errorValue.terms, invocation);
  const components: RValue[] = [];
  const componentNames: string[] = [];
  for (const stratum of strata) {
    invocation.context.checkpoint();
    components.push(
      fitProjectedAovStratum(stratum.vectors, response, mainDesign, ordinaryFormula, invocation),
    );
    componentNames.push(stratum.name);
  }

  const errorSolved = solveLeastSquares(
    errorDesign.matrix.values,
    errorDesign.rows,
    errorDesign.columns,
    response,
    undefined,
    undefined,
    invocation,
  );
  let output = withClasses(listValue(components, componentNames), ["aovlist", "listof"]);
  output = withAttribute(output, "error.qr", linearModelQr(errorDesign, errorSolved));
  output = withAttribute(output, "call", options.call);
  output = withAttribute(
    output,
    "terms",
    termsFromFormula(options.formula, invocation, options.data),
  );
  const levels = new Map([...errorDesign.xlevels, ...mainDesign.xlevels]);
  output = withAttribute(
    output,
    "xlevels",
    listValue(
      [...levels.values()].map((entries) => characterVector(entries)),
      [...levels.keys()],
    ),
  );
  const contrasts = new Set([...errorDesign.contrasts, ...mainDesign.contrasts]);
  if (contrasts.size > 0) {
    output = withAttribute(
      output,
      "contrasts",
      listValue(
        [...contrasts].map(() => characterVector(["contr.treatment"])),
        [...contrasts],
      ),
    );
  }
  return output;
}

function stratifiedModelBases(
  errorDesign: ModelMatrixResult,
  errorTerms: readonly string[],
  invocation: BuiltinInvocation,
): readonly AovStratumBasis[] {
  const accepted: Float64Array[] = [];
  const grouped = new Map<number, Float64Array[]>();
  const tolerance = 1e-10 * Math.max(1, Math.sqrt(errorDesign.rows));
  for (let column = 0; column < errorDesign.columns; column += 1) {
    invocation.context.checkpoint();
    const candidate = Float64Array.from(
      { length: errorDesign.rows },
      (_unused, row) => errorDesign.matrix.values[row + column * errorDesign.rows] ?? 0,
    );
    orthogonalizeModelVector(candidate, accepted);
    const norm = vectorNorm(candidate);
    if (!Number.isFinite(norm) || norm <= tolerance) continue;
    for (let row = 0; row < candidate.length; row += 1) {
      candidate[row] = (candidate[row] ?? 0) / norm;
    }
    accepted.push(candidate);
    const assignment = errorDesign.assign[column] ?? 0;
    const vectors = grouped.get(assignment) ?? [];
    vectors.push(candidate);
    grouped.set(assignment, vectors);
  }
  const strata: AovStratumBasis[] = [];
  for (const [assignment, vectors] of grouped) {
    strata.push({
      name:
        assignment === 0 ? "(Intercept)" : (errorTerms[assignment - 1] ?? `Error ${assignment}`),
      vectors,
    });
  }
  const within: Float64Array[] = [];
  for (let sourceRow = 0; sourceRow < errorDesign.rows; sourceRow += 1) {
    if (accepted.length === errorDesign.rows) break;
    invocation.context.checkpoint();
    const candidate = new Float64Array(errorDesign.rows);
    candidate[sourceRow] = 1;
    orthogonalizeModelVector(candidate, accepted);
    const norm = vectorNorm(candidate);
    if (!Number.isFinite(norm) || norm <= tolerance) continue;
    for (let row = 0; row < candidate.length; row += 1) {
      candidate[row] = (candidate[row] ?? 0) / norm;
    }
    accepted.push(candidate);
    within.push(candidate);
  }
  if (within.length > 0) strata.push({ name: "Within", vectors: within });
  invocation.context.allocate(errorDesign.rows * accepted.length);
  return strata;
}

function orthogonalizeModelVector(candidate: Float64Array, basis: readonly Float64Array[]): void {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const vector of basis) {
      const projection = dotProduct(candidate, vector);
      for (let row = 0; row < candidate.length; row += 1) {
        candidate[row] = (candidate[row] ?? 0) - projection * (vector[row] ?? 0);
      }
    }
  }
}

function fitProjectedAovStratum(
  basis: readonly Float64Array[],
  response: Float64Array,
  sourceDesign: ModelMatrixResult,
  sourceFormula: RFormula,
  invocation: BuiltinInvocation,
): RValue {
  const rows = basis.length;
  const values = new Float64Array(rows * sourceDesign.columns);
  const projectedResponse = new Float64Array(rows);
  for (let row = 0; row < rows; row += 1) {
    const vector = basis[row] ?? new Float64Array();
    projectedResponse[row] = dotProduct(vector, response);
    for (let column = 0; column < sourceDesign.columns; column += 1) {
      let coordinate = 0;
      for (let sourceRow = 0; sourceRow < sourceDesign.rows; sourceRow += 1) {
        coordinate +=
          (vector[sourceRow] ?? 0) *
          (sourceDesign.matrix.values[sourceRow + column * sourceDesign.rows] ?? 0);
      }
      values[row + column * rows] = coordinate;
    }
  }
  let matrix = withDimensions(doubleVector(values), [rows, sourceDesign.columns]);
  matrix = withAttribute(
    matrix,
    "dimnames",
    listValue([
      characterVector(Array.from({ length: rows }, (_unused, index) => String(index + 1))),
      characterVector(sourceDesign.columnNames),
    ]),
  );
  const projectedDesign: ModelMatrixResult = { ...sourceDesign, matrix, rows };
  const solved = solveLeastSquares(
    values,
    rows,
    sourceDesign.columns,
    projectedResponse,
    undefined,
    undefined,
    invocation,
  );
  const usedAssignments = new Set<number>();
  for (let step = 0; step < solved.rank; step += 1) {
    const original = solved.pivot[step] ?? step;
    const assignment = sourceDesign.assign[original] ?? 0;
    if (assignment > 0) usedAssignments.add(assignment);
  }
  const orderedAssignments = [...usedAssignments].sort((left, right) => left - right);
  const assignmentMap = new Map(
    orderedAssignments.map((assignment, index) => [assignment, index + 1] as const),
  );
  const assign = sourceDesign.assign.map((assignment) => assignmentMap.get(assignment) ?? 0);
  const formula = termsFromFormula(
    {
      ...sourceFormula,
      terms: orderedAssignments.flatMap((assignment) => {
        const term = sourceFormula.terms[assignment - 1];
        return term === undefined ? [] : [term];
      }),
    },
    invocation,
  );
  const qr = linearModelQr(projectedDesign, solved);
  const fields = [
    {
      name: "coefficients",
      value: withNames(
        doubleVector(solved.coefficients, solved.coefficientMissing),
        sourceDesign.columnNames,
      ),
    },
    { name: "residuals", value: doubleVector(solved.residuals) },
    { name: "effects", value: doubleVector(solved.effects) },
    { name: "rank", value: integerVector([solved.rank]) },
    { name: "fitted.values", value: doubleVector(solved.fitted) },
    { name: "assign", value: integerVector(assign) },
    { name: "qr", value: qr },
    { name: "df.residual", value: integerVector([rows - solved.rank]) },
    { name: "terms", value: formula },
  ];
  invocation.context.allocate(fields.length + rows * sourceDesign.columns);
  return withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    ["aov", "lm"],
  );
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
      omitMissing: options.naAction !== "pass",
      ...(options.subset === undefined ? {} : { subset: options.subset }),
      ...(options.weights === undefined ? {} : { weights: options.weights }),
      ...(options.offset === undefined ? {} : { offset: options.offset }),
      xlevels: new Map(),
    },
    invocation,
  );
  if (options.naAction === "fail" && prepared.omittedIndices.length > 0) {
    throw new REvaluationError("NRE2148", "missing values in object");
  }
  const responseValue = prepared.response;
  if (responseValue === undefined) {
    throw new Error();
  }
  const response = modelRealVector(responseValue, "response");
  for (let index = 0; index < response.length; index += 1) {
    const value = realAt(response, index);
    if (!Number.isFinite(value)) {
      throw new RTypeMismatchError("NRT3265", "NA/NaN/Inf in the response.");
    }
  }
  const modelFormula = termsFromFormula(
    {
      ...options.formula,
      terms: prepared.terms,
      variables: [
        ...(options.formula.response === undefined ? [] : [options.formula.response]),
        ...new Set(prepared.terms.flatMap(modelTermComponents)),
      ],
    },
    invocation,
  );
  const design = await buildModelMatrix(
    prepared,
    modelFormula,
    new Map(),
    invocation,
    options.contrasts,
  );
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
  const contrasts = modelContrastsValue(design);
  const naAction =
    options.naAction !== "omit" || prepared.omittedIndices.length === 0
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
  const model = buildModelFrame(prepared, modelFormula, new Map(), naAction, invocation);

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
  const output = withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    options.aov ? ["aov", "lm"] : ["lm"],
  );
  MODEL_INFLUENCE_STATES.set(output, { design });
  return output;
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
    if ((step === 0 && selectedNorm <= tolerance) || (step > 0 && selectedNorm <= threshold)) {
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

function linearModelQr(
  design: ModelMatrixResult,
  solved: LeastSquaresResult,
  tolerance = 1e-7,
): RList {
  const qrValues = new Float64Array(design.rows * design.columns);
  for (let pivotColumn = 0; pivotColumn < design.columns; pivotColumn += 1) {
    for (let row = 0; row <= Math.min(pivotColumn, solved.rank - 1); row += 1) {
      qrValues[row + pivotColumn * design.rows] = solved.r[row]?.[pivotColumn] ?? 0;
    }
  }
  let qrMatrix = withDimensions(doubleVector(qrValues), [design.rows, design.columns]);
  const dimensionNames = design.matrix.attributes.get("dimnames");
  const rowNames = dimensionNames?.type === "list" ? (dimensionNames.values[0] ?? R_NULL) : R_NULL;
  const columnNames = design.columnNames.some((name) => name !== "")
    ? characterVector(design.columnNames)
    : R_NULL;
  if (rowNames.type !== "null" || columnNames.type !== "null") {
    qrMatrix = withAttribute(qrMatrix, "dimnames", listValue([rowNames, columnNames]));
  }
  return withClasses(
    listValue(
      [
        qrMatrix,
        doubleVector(solved.qraux),
        integerVector(solved.pivot.map((index) => index + 1)),
        doubleVector([tolerance]),
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
  let frame = dataFrameValue(columns, names, uniqueModelRowNames(prepared.rowNames));
  frame = withAttribute(frame, "terms", formula);
  if (naAction !== undefined) frame = withAttribute(frame, "na.action", naAction);
  return frame;
}

function uniqueModelRowNames(rowNames: readonly string[]): readonly string[] {
  const reserved = new Set(rowNames);
  const seen = new Set<string>();
  const nextSuffix = new Map<string, number>();
  return rowNames.map((name) => {
    if (!seen.has(name)) {
      seen.add(name);
      return name;
    }
    let suffix = nextSuffix.get(name) ?? 1;
    let candidate = `${name}.${suffix}`;
    while (reserved.has(candidate)) {
      suffix += 1;
      candidate = `${name}.${suffix}`;
    }
    nextSuffix.set(name, suffix + 1);
    reserved.add(candidate);
    return candidate;
  });
}

function modelFrameColumn(
  label: string,
  value: AtomicVector,
  xlevels: ReadonlyMap<string, readonly string[]>,
  invocation: BuiltinInvocation,
): RVector {
  if (value.type !== "character") return value;
  const levels = xlevels.get(label);
  if (levels === undefined) return value;
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
