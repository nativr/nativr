import {
  REvaluationError,
  R_NULL,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  characterVector,
  createEnvironment,
  doubleVector,
  integerVector,
  isDataFrame,
  isMissing,
  listValue,
  logicalVector,
  objectAttributes,
  objectClasses,
  setBinding,
  subsetTwoDimensions,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import type {
  BuiltinDefinition,
  BuiltinCallArgument,
  BuiltinInvocation,
  RBuiltin,
  RAttributes,
  REnvironment,
  RFormula,
  RList,
  RValue,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

export interface NlsBuiltinSpec {
  readonly name:
    | "getInitial"
    | "nls"
    | "nls.control"
    | "plot.profile.nls"
    | "predict.nls"
    | "profile"
    | "profile.nls"
    | "SSfol"
    | "summary.nls";
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral" | "numeric";
  readonly attributes?: RAttributes;
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

const NLS_PARAMETERS = [
  "formula",
  "data",
  "start",
  "control",
  "algorithm",
  "trace",
  "subset",
  "weights",
  "na.action",
  "model",
  "lower",
  "upper",
  "...",
] as const;

const NLS_MODEL_ENVIRONMENTS_STATE_KEY = "stats.nls.modelEnvironments";
const NLS_MODEL_SOLUTIONS_STATE_KEY = "stats.nls.modelSolutions";

const NLS_SYNTHETIC_SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

const SSFOL_INITIAL_DEFINITION: BuiltinDefinition = {
  package: "stats",
  name: "SSfol.initial",
  kind: "regular",
  formals: ["mCall", "data", "LHS", "..."].map((name) => ({
    name,
    span: NLS_SYNTHETIC_SPAN,
  })),
  metadata: {
    compatibilityLevel: "numeric",
    supportedArguments: ["mCall", "data", "LHS", "..."],
  },
  implementation: builtinSsFolInitial,
};

const SSFOL_INITIAL: RValue = {
  type: "builtin",
  definition: SSFOL_INITIAL_DEFINITION,
};

export const NLS_BUILTIN_SPECS: readonly NlsBuiltinSpec[] = [
  {
    name: "getInitial",
    parameters: ["object", "data", "..."],
    compatibility: "numeric",
    implementation: builtinGetInitial,
  },
  {
    name: "SSfol",
    parameters: ["Dose", "input", "lKe", "lKa", "lCl"],
    compatibility: "numeric",
    attributes: new Map<string, RValue>([
      ["initial", SSFOL_INITIAL],
      ["pnames", characterVector(["lKe", "lKa", "lCl"])],
      ["class", characterVector(["selfStart"])],
    ]),
    implementation: builtinSsFol,
  },
  {
    name: "nls.control",
    parameters: [
      "maxiter",
      "tol",
      "minFactor",
      "printEval",
      "warnOnly",
      "scaleOffset",
      "nDcentral",
    ],
    compatibility: "behavioral",
    implementation: builtinNlsControl,
  },
  { name: "nls", parameters: NLS_PARAMETERS, compatibility: "numeric", implementation: builtinNls },
  {
    name: "profile",
    parameters: ["fitted", "..."],
    compatibility: "behavioral",
    implementation: builtinProfile,
  },
  {
    name: "profile.nls",
    parameters: ["fitted", "which", "alpha", "maxpts", "delta.t", "..."],
    compatibility: "numeric",
    implementation: builtinProfileNls,
  },
  {
    name: "summary.nls",
    parameters: ["object", "correlation", "symbolic.cor", "..."],
    compatibility: "numeric",
    implementation: builtinSummaryNls,
  },
  {
    name: "plot.profile.nls",
    parameters: ["x", "y", "..."],
    compatibility: "behavioral",
    implementation: builtinPlotProfileNls,
  },
  {
    name: "predict.nls",
    parameters: ["object", "newdata", "se.fit", "scale", "df", "interval", "level", "..."],
    compatibility: "numeric",
    implementation: builtinPredictNls,
  },
];

interface NlsControls {
  readonly maxiter: number;
  readonly tol: number;
  readonly minFactor: number;
  readonly printEval: boolean;
  readonly warnOnly: boolean;
  readonly scaleOffset: number;
  readonly nDcentral: boolean;
}

interface NlsProblem {
  readonly formula: RFormula;
  readonly environment: REnvironment;
  readonly response: readonly number[];
  readonly names: readonly string[];
  readonly invocation: BuiltinInvocation;
}

interface NlsSolution {
  readonly parameters: readonly number[];
  readonly fitted: readonly number[];
  readonly residuals: readonly number[];
  readonly sumSquares: number;
  readonly iterations: number;
  readonly tolerance: number;
  readonly converged: boolean;
  readonly jacobian: readonly (readonly number[])[];
}

interface NumericInput {
  readonly values: readonly (number | undefined)[];
  readonly length: number;
}

async function builtinGetInitial(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["object", "data", "..."]);
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in getInitial().");
  const formula = await requiredInitialFormula(invocation, parsed.matched.get("object"));
  const parent =
    formula.environment ??
    parsed.matched.get("object")?.promise.environment ??
    invocation.currentEnvironment();
  const dataArgument = parsed.matched.get("data");
  const data =
    dataArgument === undefined || dataArgument.promise.missing
      ? undefined
      : await invocation.force(dataArgument.promise);
  const environment = nlsDataEnvironment(data, parent);
  const response = realValues(
    await evaluateFormulaSide(formula, "left", environment, invocation),
    "getInitial response",
  );
  const start = await automaticNlsStart(invocation, formula, environment, data, response);
  return withNames(doubleVector(start.values), start.names);
}

async function builtinSsFol(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["Dose", "input", "lKe", "lKa", "lCl"]);
  const inputs: NumericInput[] = [];
  for (const name of ["Dose", "input", "lKe", "lKa", "lCl"] as const) {
    const argument = matched.get(name);
    if (argument === undefined || argument.promise.missing)
      throw new REvaluationError("NRE2103", `Argument '${name}' is missing in SSfol().`);
    inputs.push(numericInput(await invocation.force(argument.promise), name));
  }
  const length = Math.max(...inputs.map((input) => input.length));
  if (inputs.some((input) => input.length === 0)) return doubleVector([]);
  const values = new Float64Array(length);
  const missing = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    invocation.context.checkpoint();
    const selected = inputs.map((input) => input.values[index % input.length]);
    if (selected.some((value) => value === undefined)) {
      missing[index] = 1;
      continue;
    }
    values[index] = ssFolValue(
      selected[0]!,
      selected[1]!,
      selected[2]!,
      selected[3]!,
      selected[4]!,
    );
  }
  invocation.context.allocate(length);
  return doubleVector(values, missing.some((value) => value === 1) ? missing : undefined);
}

async function builtinSsFolInitial(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["mCall", "data", "LHS", "..."]);
  const modelCallArgument = parsed.matched.get("mCall");
  const lhsArgument = parsed.matched.get("LHS");
  if (modelCallArgument === undefined || modelCallArgument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'mCall' is missing in SSfol initialization.");
  if (lhsArgument === undefined || lhsArgument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'LHS' is missing in SSfol initialization.");
  const modelCall = await invocation.force(modelCallArgument.promise);
  if (modelCall.type !== "language" || modelCall.expression.kind !== "CallExpression")
    throw new RTypeMismatchError("NRT3265", "SSfol initialization requires a model call.");
  if (modelCall.expression.arguments.length < 2)
    throw new RTypeMismatchError("NRT3265", "SSfol initialization requires Dose and input.");
  const dataArgument = parsed.matched.get("data");
  const data =
    dataArgument === undefined || dataArgument.promise.missing
      ? undefined
      : await invocation.force(dataArgument.promise);
  const environment = nlsDataEnvironment(data, invocation.currentEnvironment());
  const dose = realValues(
    await invocation.evaluate(
      { type: "language", expression: modelCall.expression.arguments[0]!.value },
      environment,
    ),
    "SSfol Dose",
  );
  const input = realValues(
    await invocation.evaluate(
      { type: "language", expression: modelCall.expression.arguments[1]!.value },
      environment,
    ),
    "SSfol input",
  );
  const lhs = realValues(await invocation.force(lhsArgument.promise), "SSfol response");
  const initial = fitSsFolStart(dose, input, lhs, invocation);
  return withNames(doubleVector(initial), ["lKe", "lKa", "lCl"]);
}

async function builtinNlsControl(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, [
    "maxiter",
    "tol",
    "minFactor",
    "printEval",
    "warnOnly",
    "scaleOffset",
    "nDcentral",
  ]);
  const controls: NlsControls = {
    maxiter: await scalarNumber(invocation, matched.get("maxiter"), 50, "maxiter", true),
    tol: await scalarNumber(invocation, matched.get("tol"), 1e-5, "tol"),
    minFactor: await scalarNumber(invocation, matched.get("minFactor"), 1 / 1024, "minFactor"),
    printEval: await scalarLogical(invocation, matched.get("printEval"), false, "printEval"),
    warnOnly: await scalarLogical(invocation, matched.get("warnOnly"), false, "warnOnly"),
    scaleOffset: await scalarNumber(
      invocation,
      matched.get("scaleOffset"),
      0,
      "scaleOffset",
      false,
    ),
    nDcentral: await scalarLogical(invocation, matched.get("nDcentral"), false, "nDcentral"),
  };
  return nlsControlValue(controls);
}

async function builtinNls(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, NLS_PARAMETERS);
  if (parsed.dots.length > 0) throw new REvaluationError("NRE2101", "Unused argument in nls().");
  const formula = await requiredNlsFormula(invocation, parsed.matched.get("formula"));
  const parent =
    formula.environment ??
    parsed.matched.get("formula")?.promise.environment ??
    invocation.currentEnvironment();
  const dataArgument = parsed.matched.get("data");
  let data =
    dataArgument === undefined || dataArgument.promise.missing
      ? undefined
      : await invocation.force(dataArgument.promise);
  let environment = nlsDataEnvironment(data, parent);
  const subsetArgument = parsed.matched.get("subset");
  if (subsetArgument !== undefined && !subsetArgument.promise.missing) {
    if (data === undefined || !isDataFrame(data)) {
      throw new RUnsupportedFeatureError(
        "NRU6210",
        "nls(subset =) currently requires a data-frame data argument.",
      );
    }
    const subset =
      subsetArgument.promise.expression === null
        ? await invocation.force(subsetArgument.promise)
        : await invocation.evaluate(
            { type: "language", expression: subsetArgument.promise.expression },
            environment,
          );
    data = subsetTwoDimensions(data, subset, undefined, false, invocation.context);
    environment = nlsDataEnvironment(data, parent);
  }
  const response = realValues(
    await evaluateFormulaSide(formula, "left", environment, invocation),
    "nls response",
  );
  const start = await nlsStart(
    invocation,
    parsed.matched.get("start"),
    formula,
    environment,
    data,
    response,
  );
  const controls = await nlsControls(invocation, parsed.matched.get("control"));
  await requireDefaultAlgorithm(invocation, parsed.matched.get("algorithm"));
  if (await scalarLogical(invocation, parsed.matched.get("trace"), false, "trace")) {
    throw new RUnsupportedFeatureError(
      "NRU6210",
      "nls(trace = TRUE) diagnostic output is not implemented.",
    );
  }
  for (const name of ["weights", "na.action"] as const) {
    const argument = parsed.matched.get(name);
    if (argument !== undefined && !argument.promise.missing) {
      throw new RUnsupportedFeatureError(
        "NRU6210",
        `nls(${name} =) awaits the reusable model-frame slice.`,
      );
    }
  }
  const keepModel = await scalarLogical(invocation, parsed.matched.get("model"), false, "model");
  await requireUnbounded(
    invocation,
    parsed.matched.get("lower"),
    Number.NEGATIVE_INFINITY,
    "lower",
  );
  await requireUnbounded(
    invocation,
    parsed.matched.get("upper"),
    Number.POSITIVE_INFINITY,
    "upper",
  );
  const problem: NlsProblem = { formula, environment, response, names: start.names, invocation };
  const solution = await solveNls(problem, start.values, controls);
  if (!solution.converged && !controls.warnOnly) {
    throw new REvaluationError("NRE2260", "number of iterations exceeded maximum of nls control.");
  }
  if (!solution.converged)
    invocation.context.warn({ code: "NRW1101", message: "nls did not converge" });
  return nlsResult(problem, solution, data, controls, keepModel, invocation);
}

async function builtinSummaryNls(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, [
    "object",
    "correlation",
    "symbolic.cor",
    "...",
  ]);
  const argument = matched.get("object");
  if (argument === undefined || argument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in summary.nls().");
  const model = await invocation.force(argument.promise);
  if (model.type !== "list" || !modelClasses(model).includes("nls"))
    throw new RTypeMismatchError("NRT3265", "summary.nls() requires an nls fit.");
  const solution = nlsModelSolutions(invocation).get(model);
  const coefficients = modelField(model, "coefficients");
  if (
    solution === undefined ||
    (coefficients?.type !== "logical" &&
      coefficients?.type !== "integer" &&
      coefficients?.type !== "double")
  )
    throw new RTypeMismatchError("NRT3265", "summary.nls() received a malformed nls fit.");
  const estimates = realValues(coefficients, "nls coefficients");
  const names = vectorNames(coefficients) ?? estimates.map((_, index) => `p${index + 1}`);
  const residualDegrees = Math.max(0, solution.residuals.length - estimates.length);
  const variance = solution.sumSquares / Math.max(1, residualDegrees);
  const unscaledRows = inverseMatrix(crossProduct(solution.jacobian));
  const unscaled = withAttribute(
    withDimensions(doubleVector(columnMajor(unscaledRows)), [estimates.length, estimates.length]),
    "dimnames",
    listValue([characterVector(names), characterVector(names)]),
  );
  const coefficientRows = estimates.map((estimate, index) => {
    const standardError = Math.sqrt(Math.max(0, (unscaledRows[index]?.[index] ?? 0) * variance));
    return [estimate, standardError, estimate / standardError, Number.NaN];
  });
  const coefficientTable = withAttribute(
    withDimensions(doubleVector(columnMajor(coefficientRows)), [estimates.length, 4]),
    "dimnames",
    listValue([
      characterVector(names),
      characterVector(["Estimate", "Std. Error", "t value", "Pr(>|t|)"]),
    ]),
  );
  return withClasses(
    listValue(
      [
        modelField(model, "formula") ?? R_NULL,
        modelField(model, "residuals") ?? R_NULL,
        doubleVector([Math.sqrt(variance)]),
        integerVector([estimates.length, residualDegrees]),
        unscaled,
        modelField(model, "call") ?? R_NULL,
        modelField(model, "convInfo") ?? R_NULL,
        modelField(model, "control") ?? R_NULL,
        R_NULL,
        coefficientTable,
        coefficientTable,
      ],
      [
        "formula",
        "residuals",
        "sigma",
        "df",
        "cov.unscaled",
        "call",
        "convInfo",
        "control",
        "na.action",
        "coefficients",
        "parameters",
      ],
    ),
    ["summary.nls"],
  );
}

async function builtinProfile(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["fitted", "..."]);
  const argument = matched.get("fitted");
  if (argument === undefined || argument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'fitted' is missing in profile().");
  const fitted = await invocation.force(argument.promise);
  const dispatched = await invocation.dispatchS3IfPresent("profile", fitted, invocation.arguments);
  if (dispatched !== undefined) return dispatched;
  throw new RTypeMismatchError("NRT3265", "no applicable method for 'profile'.");
}

async function builtinProfileNls(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "fitted",
    "which",
    "alpha",
    "maxpts",
    "delta.t",
    "...",
  ]);
  const argument = parsed.matched.get("fitted");
  if (argument === undefined || argument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'fitted' is missing in profile.nls().");
  const model = await invocation.force(argument.promise);
  if (model.type !== "list" || !modelClasses(model).includes("nls"))
    throw new RTypeMismatchError("NRT3265", "profile.nls() requires an nls fit.");
  const formula = modelField(model, "formula");
  const data = modelField(model, "data");
  const coefficients = modelField(model, "coefficients");
  const residuals = modelField(model, "residuals");
  if (
    formula?.type !== "formula" ||
    data === undefined ||
    coefficients === undefined ||
    residuals === undefined
  )
    throw new RTypeMismatchError("NRT3265", "profile.nls() received a malformed nls fit.");
  if (
    coefficients.type !== "logical" &&
    coefficients.type !== "integer" &&
    coefficients.type !== "double"
  )
    throw new RTypeMismatchError("NRT3265", "profile.nls() requires numeric coefficients.");
  const names = vectorNames(coefficients);
  if (names === undefined)
    throw new RTypeMismatchError("NRT3265", "profile.nls() requires named coefficients.");
  const estimates = realValues(coefficients, "nls coefficients");
  const parent = formula.environment ?? invocation.currentEnvironment();
  const environment = nlsDataEnvironment(data, parent);
  const response = realValues(
    await evaluateFormulaSide(formula, "left", environment, invocation),
    "nls response",
  );
  const problem: NlsProblem = { formula, environment, response, names, invocation };
  const base = await solveNls(problem, estimates, defaultNlsControls());
  const sigma2 = base.sumSquares / Math.max(1, response.length - estimates.length);
  const covariance = inverseMatrix(crossProduct(base.jacobian));
  const selected = await profileSelection(invocation, parsed.matched.get("which"), names);
  const maxpts = Math.max(
    3,
    Math.min(
      100,
      Math.trunc(await scalarNumber(invocation, parsed.matched.get("maxpts"), 100, "maxpts", true)),
    ),
  );
  const points = Math.min(12, maxpts);
  const elements: RValue[] = [];
  const elementNames: string[] = [];
  for (const index of selected) {
    const standardError = Math.sqrt(Math.max(0, (covariance[index]?.[index] ?? 0) * sigma2));
    const values: number[][] = [];
    const tau: number[] = [];
    const center = Math.floor((points - 1) / 2);
    for (let point = 0; point < points; point += 1) {
      const scale = (point - center) * 0.65;
      const fixedValue = estimates[index]! + scale * standardError;
      const profiled = await solveNls(
        problem,
        estimates.map((value, position) => (position === index ? fixedValue : value)),
        defaultNlsControls(),
        index,
      );
      values.push([...profiled.parameters]);
      const signed = Math.sign(fixedValue - estimates[index]!);
      tau.push(
        signed *
          Math.sqrt(
            Math.max(0, (profiled.sumSquares - base.sumSquares) / Math.max(sigma2, Number.EPSILON)),
          ),
      );
    }
    const matrix = withAttribute(
      withDimensions(doubleVector(columnMajor(values)), [points, names.length]),
      "dimnames",
      listValue([R_NULL, characterVector(names)]),
    );
    elements.push(
      withClasses(listValue([doubleVector(tau), matrix], ["tau", "par.vals"]), ["data.frame"]),
    );
    elementNames.push(names[index]!);
  }
  let result: RValue = withClasses(listValue(elements, elementNames), ["profile.nls", "profile"]);
  result = withAttribute(result, "original.fit", model);
  result = withAttribute(
    result,
    "summary",
    withClasses(
      listValue(
        [formula, integerVector([names.length, response.length - names.length])],
        ["formula", "df"],
      ),
      ["summary.nls"],
    ),
  );
  return result;
}

async function builtinPlotProfileNls(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "y", "..."]);
  const argument = matched.get("x");
  if (argument === undefined || argument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in plot.profile.nls().");
  const profile = await invocation.force(argument.promise);
  if (profile.type !== "list")
    throw new RTypeMismatchError("NRT3265", "plot.profile.nls() requires a profile object.");
  const plot = await invocation.namespaceBinding("graphics", "plot.default");
  if (plot === undefined) throw new REvaluationError("NRE2001", "Object 'plot.default' not found.");
  const names = vectorNames(profile) ?? [];
  for (let index = 0; index < profile.length; index += 1) {
    const component = profile.values[index];
    if (component?.type !== "list") continue;
    const tau = modelField(component, "tau");
    const parameters = modelField(component, "par.vals");
    if (tau === undefined || parameters === undefined) continue;
    if (
      parameters.type !== "logical" &&
      parameters.type !== "integer" &&
      parameters.type !== "double"
    )
      continue;
    const dimensions = vectorDimensions(parameters);
    if (dimensions === undefined) continue;
    const column = subsetMatrixColumn(parameters, dimensions[0] ?? 0, index, invocation);
    await invocation.invoke(plot, [
      { name: "x", value: column },
      { name: "y", value: tau },
      { name: "type", value: characterVector(["l"]) },
      { name: "xlab", value: characterVector([names[index] ?? ""]) },
      { name: "ylab", value: characterVector(["tau"]) },
    ]);
  }
  invocation.setResultVisibility("invisible");
  return R_NULL;
}

async function builtinPredictNls(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, [
    "object",
    "newdata",
    "se.fit",
    "scale",
    "df",
    "interval",
    "level",
    "...",
  ]);
  const objectArgument = parsed.matched.get("object");
  if (objectArgument === undefined || objectArgument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in predict.nls().");
  const model = await invocation.force(objectArgument.promise);
  if (model.type !== "list" || !modelClasses(model).includes("nls"))
    throw new RTypeMismatchError("NRT3265", "predict.nls() requires an nls object.");
  if (parsed.dots.length > 0)
    throw new REvaluationError("NRE2101", "Unused argument in predict.nls().");
  const seFit = parsed.matched.get("se.fit");
  if (seFit !== undefined && !seFit.promise.missing) {
    if (await scalarLogical(invocation, seFit, false, "se.fit"))
      throw new RUnsupportedFeatureError(
        "NRU6210",
        "predict.nls(se.fit = TRUE) awaits reusable uncertainty propagation.",
      );
  }
  const scale = parsed.matched.get("scale");
  if (scale !== undefined && !scale.promise.missing) {
    const value = await invocation.force(scale.promise);
    if (value.type !== "null")
      throw new RUnsupportedFeatureError(
        "NRU6210",
        "predict.nls(scale =) awaits reusable uncertainty propagation.",
      );
  }
  const df = parsed.matched.get("df");
  if (df !== undefined && !df.promise.missing) {
    const value = realValues(await invocation.force(df.promise), "df");
    if (value.length !== 1 || value[0] !== Number.POSITIVE_INFINITY)
      throw new RUnsupportedFeatureError(
        "NRU6210",
        "predict.nls(df =) awaits reusable uncertainty propagation.",
      );
  }
  const interval = parsed.matched.get("interval");
  if (interval !== undefined && !interval.promise.missing) {
    const value = await invocation.force(interval.promise);
    if (
      value.type !== "character" ||
      value.length === 0 ||
      isMissing(value, 0) ||
      !(value.values[0] ?? "none").startsWith("none")
    )
      throw new RUnsupportedFeatureError(
        "NRU6210",
        "predict.nls() confidence and prediction intervals are not implemented.",
      );
  }
  const level = parsed.matched.get("level");
  if (level !== undefined && !level.promise.missing) {
    const value = realValues(await invocation.force(level.promise), "level");
    if (value.length !== 1 || value[0] !== 0.95)
      throw new RUnsupportedFeatureError(
        "NRU6210",
        "predict.nls(level =) awaits reusable uncertainty propagation.",
      );
  }
  const newDataArgument = parsed.matched.get("newdata");
  if (newDataArgument === undefined || newDataArgument.promise.missing) {
    const fitted = modelField(model, "fitted.values");
    if (fitted === undefined)
      throw new RTypeMismatchError("NRT3265", "The nls object has no fitted.values component.");
    return fitted;
  }
  const formula = modelField(model, "formula");
  const coefficients = modelField(model, "coefficients");
  if (formula?.type !== "formula" || coefficients === undefined)
    throw new RTypeMismatchError(
      "NRT3265",
      "The nls object has malformed formula or coefficients.",
    );
  const names =
    coefficients.type === "logical" ||
    coefficients.type === "integer" ||
    coefficients.type === "double"
      ? vectorNames(coefficients)
      : undefined;
  if (names === undefined)
    throw new RTypeMismatchError("NRT3265", "The nls object has unnamed coefficients.");
  const newData = await invocation.force(newDataArgument.promise);
  const retainedEnvironment = nlsModelEnvironments(invocation).get(model);
  const environment = nlsDataEnvironment(
    newData,
    retainedEnvironment ?? formula.environment ?? newDataArgument.promise.environment,
  );
  const values = realValues(coefficients, "nls coefficients");
  names.forEach((name, index) => setBinding(environment, name, doubleVector([values[index]!])));
  return evaluateFormulaSide(formula, "right", environment, invocation);
}

async function solveNls(
  problem: NlsProblem,
  initial: readonly number[],
  controls: NlsControls,
  fixed?: number,
): Promise<NlsSolution> {
  let parameters = [...initial];
  let fitted = await nlsFitted(problem, parameters);
  let residuals = problem.response.map((value, index) => value - fitted[index]!);
  let sumSquares = sumSquaresOf(residuals);
  let lambda = 1e-4;
  let tolerance = Number.POSITIVE_INFINITY;
  let jacobian = await numericalJacobian(problem, parameters, fitted, controls.nDcentral);
  for (let iteration = 0; iteration < controls.maxiter; iteration += 1) {
    jacobian = await numericalJacobian(problem, parameters, fitted, controls.nDcentral);
    const normal = crossProduct(jacobian);
    const gradient = transposeProduct(jacobian, residuals);
    if (fixed !== undefined) {
      normal[fixed] = normal[fixed]!.map(() => 0);
      for (const row of normal) row[fixed] = 0;
      normal[fixed][fixed] = 1;
      gradient[fixed] = 0;
    }
    for (let index = 0; index < normal.length; index += 1) {
      const diagonal = normal[index]![index] ?? 0;
      normal[index]![index] = diagonal + lambda * Math.max(1, diagonal);
    }
    const step = solveLinear(normal, gradient);
    const candidate = parameters.map((value, index) =>
      fixed === index ? value : value + (step[index] ?? 0),
    );
    const candidateFitted = await nlsFitted(problem, candidate);
    const candidateResiduals = problem.response.map(
      (value, index) => value - candidateFitted[index]!,
    );
    const candidateSum = sumSquaresOf(candidateResiduals);
    tolerance = Math.max(
      ...step.map((value, index) => Math.abs(value) / (Math.abs(parameters[index]!) + 1)),
    );
    if (candidateSum < sumSquares) {
      parameters = candidate;
      fitted = candidateFitted;
      residuals = candidateResiduals;
      sumSquares = candidateSum;
      lambda = Math.max(1e-12, lambda / 4);
      if (tolerance <= controls.tol * 0.01)
        return {
          parameters,
          fitted,
          residuals,
          sumSquares,
          iterations: iteration + 1,
          tolerance,
          converged: true,
          jacobian,
        };
    } else {
      lambda = Math.min(1e12, lambda * 10);
      if (lambda >= 1e12 || tolerance <= controls.tol * controls.minFactor)
        return {
          parameters,
          fitted,
          residuals,
          sumSquares,
          iterations: iteration + 1,
          tolerance,
          converged: true,
          jacobian,
        };
    }
  }
  return {
    parameters,
    fitted,
    residuals,
    sumSquares,
    iterations: controls.maxiter,
    tolerance,
    converged: false,
    jacobian,
  };
}

async function numericalJacobian(
  problem: NlsProblem,
  parameters: readonly number[],
  base: readonly number[],
  central: boolean,
): Promise<number[][]> {
  const result = Array.from({ length: base.length }, () =>
    Array.from({ length: parameters.length }, () => 0),
  );
  for (let column = 0; column < parameters.length; column += 1) {
    const step = Math.cbrt(Number.EPSILON) * Math.max(1, Math.abs(parameters[column]!));
    const highParameters = parameters.map((value, index) =>
      index === column ? value + step : value,
    );
    const high = await nlsFitted(problem, highParameters);
    const low = central
      ? await nlsFitted(
          problem,
          parameters.map((value, index) => (index === column ? value - step : value)),
        )
      : base;
    const denominator = central ? 2 * step : step;
    for (let row = 0; row < base.length; row += 1)
      result[row]![column] = (high[row]! - low[row]!) / denominator;
  }
  return result;
}

async function nlsFitted(problem: NlsProblem, parameters: readonly number[]): Promise<number[]> {
  problem.names.forEach((name, index) =>
    setBinding(problem.environment, name, doubleVector([parameters[index]!])),
  );
  const value = await evaluateFormulaSide(
    problem.formula,
    "right",
    problem.environment,
    problem.invocation,
  );
  const fitted = realValues(value, "nls fitted values");
  if (fitted.length !== problem.response.length)
    throw new RTypeMismatchError(
      "NRT3265",
      "nls model expression returned an incompatible length.",
    );
  if (fitted.some((entry) => !Number.isFinite(entry)))
    throw new RTypeMismatchError("NRT3265", "nls model expression produced a non-finite value.");
  return fitted;
}

function nlsResult(
  problem: NlsProblem,
  solution: NlsSolution,
  data: RValue | undefined,
  controls: NlsControls,
  keepModel: boolean,
  invocation: BuiltinInvocation,
): RValue {
  const coefficients = withNames(doubleVector(solution.parameters), problem.names);
  const getPars: RBuiltin = {
    type: "builtin",
    definition: {
      package: "stats",
      name: "nlsModel.getPars",
      kind: "regular",
      formals: [],
      metadata: { compatibilityLevel: "behavioral", supportedArguments: [] },
      implementation: () => coefficients,
    },
  };
  const modelInterface = listValue([getPars], ["getPars"]);
  const fitted = withAttribute(
    doubleVector(solution.fitted),
    "label",
    characterVector(["Fitted values"]),
  );
  const residuals = withAttribute(
    doubleVector(solution.residuals),
    "label",
    characterVector(["Residuals"]),
  );
  const convInfo = listValue(
    [
      logicalVector([solution.converged]),
      integerVector([solution.iterations]),
      doubleVector([solution.tolerance]),
      integerVector([solution.converged ? 0 : 3]),
      characterVector([solution.converged ? "converged" : "number of iterations exceeded maximum"]),
    ],
    ["isConv", "finIter", "finTol", "stopCode", "stopMessage"],
  );
  const fields: { readonly name: string; readonly value: RValue }[] = [
    { name: "m", value: modelInterface },
    { name: "convInfo", value: convInfo },
    { name: "data", value: data ?? R_NULL },
    { name: "call", value: invocation.matchBuiltinCall(NLS_PARAMETERS, true) },
    { name: "dataClasses", value: characterVector([]) },
    { name: "control", value: nlsControlValue(controls) },
    { name: "coefficients", value: coefficients },
    { name: "fitted.values", value: fitted },
    { name: "residuals", value: residuals },
    { name: "deviance", value: doubleVector([solution.sumSquares]) },
    { name: "df.residual", value: integerVector([problem.response.length - problem.names.length]) },
    { name: "formula", value: problem.formula },
  ];
  if (keepModel) fields.push({ name: "model", value: data ?? R_NULL });
  const result = withClasses(
    listValue(
      fields.map((field) => field.value),
      fields.map((field) => field.name),
    ),
    ["nls"],
  );
  nlsModelEnvironments(invocation).set(result, problem.environment);
  nlsModelSolutions(invocation).set(result, solution);
  return result;
}

function nlsModelEnvironments(invocation: BuiltinInvocation): WeakMap<RList, REnvironment> {
  const existing = invocation.state.get(NLS_MODEL_ENVIRONMENTS_STATE_KEY);
  if (existing instanceof WeakMap) return existing as WeakMap<RList, REnvironment>;
  const created = new WeakMap<RList, REnvironment>();
  invocation.state.set(NLS_MODEL_ENVIRONMENTS_STATE_KEY, created);
  return created;
}

function nlsModelSolutions(invocation: BuiltinInvocation): WeakMap<RList, NlsSolution> {
  const existing = invocation.state.get(NLS_MODEL_SOLUTIONS_STATE_KEY);
  if (existing instanceof WeakMap) return existing as WeakMap<RList, NlsSolution>;
  const created = new WeakMap<RList, NlsSolution>();
  invocation.state.set(NLS_MODEL_SOLUTIONS_STATE_KEY, created);
  return created;
}

async function requiredNlsFormula(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RFormula> {
  if (argument === undefined || argument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'formula' is missing in nls().");
  let value = await invocation.force(argument.promise);
  if (value.type === "language" && value.expression.kind === "FormulaExpression")
    value = await invocation.evaluate(value, argument.promise.environment);
  if (value.type !== "formula" || value.expression?.left === undefined)
    throw new RTypeMismatchError("NRT3265", "nls() requires a two-sided formula.");
  return value;
}

async function requiredInitialFormula(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RFormula> {
  if (argument === undefined || argument.promise.missing)
    throw new REvaluationError("NRE2103", "Argument 'object' is missing in getInitial().");
  let value = await invocation.force(argument.promise);
  if (value.type === "language" && value.expression.kind === "FormulaExpression")
    value = await invocation.evaluate(value, argument.promise.environment);
  if (value.type !== "formula" || value.expression?.left === undefined)
    throw new RTypeMismatchError("NRT3265", "getInitial() requires a two-sided formula.");
  return value;
}

async function evaluateFormulaSide(
  formula: RFormula,
  side: "left" | "right",
  environment: REnvironment,
  invocation: BuiltinInvocation,
): Promise<RValue> {
  const expression = side === "left" ? formula.expression?.left : formula.expression?.right;
  if (expression === undefined)
    throw new RTypeMismatchError("NRT3265", "nls() formula is incomplete.");
  return invocation.evaluate({ type: "language", expression }, environment);
}

function nlsDataEnvironment(data: RValue | undefined, parent: REnvironment): REnvironment {
  if (data?.type === "environment") return data;
  const environment = createEnvironment(parent);
  if (data === undefined || data.type === "null") return environment;
  if (data.type !== "list")
    throw new RTypeMismatchError(
      "NRT3265",
      "nls() data must be a data frame, named list, environment, or NULL.",
    );
  const names = vectorNames(data);
  if (names === undefined || names.some((name) => name === ""))
    throw new RTypeMismatchError("NRT3265", "nls() data-list columns must all be named.");
  data.values.forEach((value, index) => setBinding(environment, names[index]!, value));
  return environment;
}

async function nlsStart(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  formula: RFormula,
  environment: REnvironment,
  data: RValue | undefined,
  response: readonly number[],
): Promise<{ readonly names: readonly string[]; readonly values: readonly number[] }> {
  if (argument === undefined || argument.promise.missing)
    return automaticNlsStart(invocation, formula, environment, data, response);
  const value = await invocation.force(argument.promise);
  const names =
    value.type === "list" ||
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double"
      ? vectorNames(value)
      : undefined;
  if (names === undefined || names.some((name) => name === ""))
    throw new RTypeMismatchError("NRT3265", "nls() start must be a named list or numeric vector.");
  return {
    names,
    values:
      value.type === "list"
        ? value.values.map((entry, index) => scalarReal(entry, `start.${names[index] ?? ""}`))
        : realValues(value, "nls start"),
  };
}

async function automaticNlsStart(
  invocation: BuiltinInvocation,
  formula: RFormula,
  environment: REnvironment,
  data: RValue | undefined,
  response: readonly number[],
): Promise<{ readonly names: readonly string[]; readonly values: readonly number[] }> {
  const modelExpression = formula.expression?.right;
  if (modelExpression?.kind !== "CallExpression")
    throw new RTypeMismatchError(
      "NRT3265",
      "no starting values specified and the model expression is not self-starting",
    );
  const callable = await invocation.evaluate(
    { type: "language", expression: modelExpression.callee },
    environment,
  );
  const initial = objectAttributes(callable)?.get("initial");
  if (initial?.type !== "closure" && initial?.type !== "builtin")
    throw new RTypeMismatchError(
      "NRT3265",
      "no starting values specified and the model function has no 'initial' attribute",
    );
  const value = await invocation.invoke(
    initial,
    [
      { name: "mCall", value: { type: "language", expression: modelExpression } },
      { name: "data", value: data ?? environment },
      { name: "LHS", value: doubleVector(response) },
    ],
    environment,
  );
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double")
    throw new RTypeMismatchError("NRT3265", "self-start initialization must return numeric values");
  const names = vectorNames(value);
  if (names === undefined || names.some((name) => name === ""))
    throw new RTypeMismatchError(
      "NRT3265",
      "self-start initialization must return named numeric values",
    );
  return { names, values: realValues(value, "self-start initialization") };
}

async function nlsControls(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<NlsControls> {
  if (argument === undefined || argument.promise.missing) return defaultNlsControls();
  const value = await invocation.force(argument.promise);
  if (value.type !== "list")
    throw new RTypeMismatchError("NRT3265", "nls() control must be a list.");
  const fallback = defaultNlsControls();
  return {
    maxiter: Math.trunc(optionalListNumber(value, "maxiter", fallback.maxiter)),
    tol: optionalListNumber(value, "tol", fallback.tol),
    minFactor: optionalListNumber(value, "minFactor", fallback.minFactor),
    printEval: optionalListLogical(value, "printEval", fallback.printEval),
    warnOnly: optionalListLogical(value, "warnOnly", fallback.warnOnly),
    scaleOffset: optionalListNumber(value, "scaleOffset", fallback.scaleOffset),
    nDcentral: optionalListLogical(value, "nDcentral", fallback.nDcentral),
  };
}

function defaultNlsControls(): NlsControls {
  return {
    maxiter: 50,
    tol: 1e-5,
    minFactor: 1 / 1024,
    printEval: false,
    warnOnly: false,
    scaleOffset: 0,
    nDcentral: false,
  };
}
function nlsControlValue(value: NlsControls): RList {
  return listValue(
    [
      integerVector([value.maxiter]),
      doubleVector([value.tol]),
      doubleVector([value.minFactor]),
      logicalVector([value.printEval]),
      logicalVector([value.warnOnly]),
      doubleVector([value.scaleOffset]),
      logicalVector([value.nDcentral]),
    ],
    ["maxiter", "tol", "minFactor", "printEval", "warnOnly", "scaleOffset", "nDcentral"],
  );
}

async function requireDefaultAlgorithm(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<void> {
  if (argument === undefined || argument.promise.missing) return;
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length === 0 || isMissing(value, 0))
    throw new RTypeMismatchError("NRT3265", "nls() algorithm must be a string.");
  if (value.values[0] !== "default")
    throw new RUnsupportedFeatureError(
      "NRU6210",
      `nls(algorithm = '${value.values[0] ?? ""}') is not implemented.`,
    );
}

async function requireUnbounded(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  expected: number,
  name: string,
): Promise<void> {
  if (argument === undefined || argument.promise.missing) return;
  const values = realValues(await invocation.force(argument.promise), name);
  if (values.some((value) => value !== expected))
    throw new RUnsupportedFeatureError(
      "NRU6210",
      `nls(${name} =) bounds require algorithm = 'port'.`,
    );
}

async function scalarNumber(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
  integer = false,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = scalarReal(await invocation.force(argument.promise), name);
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value)))
    throw new RTypeMismatchError("NRT3265", `nls control '${name}' is invalid.`);
  return value;
}

async function scalarLogical(
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
  )
    throw new RTypeMismatchError("NRT3265", `${name} must be one logical value.`);
  return Number(value.values[0]) !== 0;
}

async function profileSelection(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  names: readonly string[],
): Promise<number[]> {
  if (argument === undefined || argument.promise.missing) return names.map((_, index) => index);
  const value = await invocation.force(argument.promise);
  if (value.type === "character")
    return value.values.map((name) => names.indexOf(name)).filter((index) => index >= 0);
  return realValues(value, "which")
    .map((index) => Math.trunc(index) - 1)
    .filter((index) => index >= 0 && index < names.length);
}

function realValues(value: RValue, name: string): number[] {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double")
    throw new RTypeMismatchError("NRT3265", `${name} must be numeric.`);
  const result: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (isMissing(value, index))
      throw new RTypeMismatchError("NRT3265", `${name} contains missing values.`);
    result.push(Number(value.values[index]));
  }
  return result;
}

function numericInput(value: RValue, name: string): NumericInput {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double")
    throw new RTypeMismatchError("NRT3265", `${name} must be numeric.`);
  return {
    length: value.length,
    values: Array.from({ length: value.length }, (_, index) =>
      isMissing(value, index) ? undefined : Number(value.values[index]),
    ),
  };
}

function ssFolValue(dose: number, input: number, lKe: number, lKa: number, lCl: number): number {
  if (![dose, input, lKe, lKa, lCl].every(Number.isFinite)) return Number.NaN;
  const ke = Math.exp(lKe);
  const ka = Math.exp(lKa);
  const clearance = Math.exp(lCl);
  if (!Number.isFinite(ke) || !Number.isFinite(ka) || !Number.isFinite(clearance))
    return Number.NaN;
  const scale = Math.max(ke, ka, Number.MIN_VALUE);
  const quotient =
    Math.abs(ka - ke) <= 1e-10 * scale
      ? input * Math.exp(-ke * input)
      : (Math.exp(-ke * input) - Math.exp(-ka * input)) / (ka - ke);
  return (dose * ke * ka * quotient) / clearance;
}

function fitSsFolStart(
  dose: readonly number[],
  input: readonly number[],
  response: readonly number[],
  invocation: BuiltinInvocation,
): readonly [number, number, number] {
  if (dose.length === 0 || input.length === 0 || response.length === 0)
    throw new RTypeMismatchError("NRT3265", "SSfol initialization requires non-empty data.");
  const rows = response
    .map((value, index) => ({
      dose: dose[index % dose.length]!,
      input: input[index % input.length]!,
      response: value,
    }))
    .filter(
      (row) =>
        Number.isFinite(row.dose) &&
        row.dose > 0 &&
        Number.isFinite(row.input) &&
        row.input >= 0 &&
        Number.isFinite(row.response),
    );
  if (rows.length < 4)
    throw new RTypeMismatchError(
      "NRT3265",
      "SSfol initialization requires at least four finite observations.",
    );

  const evaluate = (lKe: number, lKa: number) => {
    if (!(lKa > lKe + 1e-6)) return { sumSquares: Number.POSITIVE_INFINITY, lCl: Number.NaN };
    let cross = 0;
    let square = 0;
    const bases: number[] = [];
    for (const row of rows) {
      const base = ssFolValue(row.dose, row.input, lKe, lKa, 0);
      if (!Number.isFinite(base)) return { sumSquares: Number.POSITIVE_INFINITY, lCl: Number.NaN };
      bases.push(base);
      cross += row.response * base;
      square += base * base;
    }
    const amplitude = cross / square;
    if (!(amplitude > 0) || !Number.isFinite(amplitude))
      return { sumSquares: Number.POSITIVE_INFINITY, lCl: Number.NaN };
    const lCl = -Math.log(amplitude);
    let sumSquares = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const residual = rows[index]!.response - bases[index]! * amplitude;
      sumSquares += residual * residual;
    }
    return { sumSquares, lCl };
  };

  let best = {
    lKe: -2.5,
    lKa: 0,
    ...evaluate(-2.5, 0),
  };
  for (let lKe = -8; lKe <= 2.75; lKe += 0.25) {
    for (let lKa = lKe + 0.25; lKa <= 3; lKa += 0.25) {
      invocation.context.checkpoint();
      const candidate = evaluate(lKe, lKa);
      if (candidate.sumSquares < best.sumSquares) best = { lKe, lKa, ...candidate };
    }
  }
  let step = 0.25;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    let improved = false;
    for (const deltaKe of [-step, 0, step]) {
      for (const deltaKa of [-step, 0, step]) {
        if (deltaKe === 0 && deltaKa === 0) continue;
        const lKe = best.lKe + deltaKe;
        const lKa = best.lKa + deltaKa;
        const candidate = evaluate(lKe, lKa);
        if (candidate.sumSquares < best.sumSquares) {
          best = { lKe, lKa, ...candidate };
          improved = true;
        }
      }
    }
    if (!improved) step /= 2;
    if (step < 1e-7) break;
  }
  if (![best.lKe, best.lKa, best.lCl].every(Number.isFinite))
    throw new RTypeMismatchError("NRT3265", "SSfol initialization could not find finite values.");
  return [best.lKe, best.lKa, best.lCl];
}

function scalarReal(value: RValue, name: string): number {
  const values = realValues(value, name);
  if (values.length !== 1 || !Number.isFinite(values[0]))
    throw new RTypeMismatchError("NRT3265", `${name} must be one finite number.`);
  return values[0]!;
}

function optionalListNumber(value: RList, name: string, fallback: number): number {
  const field = modelField(value, name);
  return field === undefined ? fallback : scalarReal(field, name);
}
function optionalListLogical(value: RList, name: string, fallback: boolean): boolean {
  const field = modelField(value, name);
  if (field === undefined) return fallback;
  const scalar = scalarReal(field, name);
  return scalar !== 0;
}
function modelField(model: RList, name: string): RValue | undefined {
  const index = vectorNames(model)?.indexOf(name) ?? -1;
  return index < 0 ? undefined : model.values[index];
}
function modelClasses(value: RValue): readonly string[] {
  return objectClasses(value) ?? [];
}
function sumSquaresOf(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value * value, 0);
}
function transposeProduct(
  matrix: readonly (readonly number[])[],
  vector: readonly number[],
): number[] {
  return Array.from({ length: matrix[0]?.length ?? 0 }, (_, column) =>
    matrix.reduce((sum, row, index) => sum + (row[column] ?? 0) * (vector[index] ?? 0), 0),
  );
}
function crossProduct(matrix: readonly (readonly number[])[]): number[][] {
  const columns = matrix[0]?.length ?? 0;
  return Array.from({ length: columns }, (_, row) =>
    Array.from({ length: columns }, (_, column) =>
      matrix.reduce((sum, values) => sum + (values[row] ?? 0) * (values[column] ?? 0), 0),
    ),
  );
}
function inverseMatrix(matrix: readonly (readonly number[])[]): number[][] {
  return matrix.map((_, column) =>
    solveLinear(
      matrix.map((row) => [...row]),
      matrix.map((__, row) => (row === column ? 1 : 0)),
    ),
  );
}
function solveLinear(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  const rows = matrix.map((row, index) => [...row, vector[index] ?? 0]);
  for (let pivot = 0; pivot < rows.length; pivot += 1) {
    let selected = pivot;
    for (let row = pivot + 1; row < rows.length; row += 1)
      if (Math.abs(rows[row]![pivot] ?? 0) > Math.abs(rows[selected]![pivot] ?? 0)) selected = row;
    [rows[pivot], rows[selected]] = [rows[selected]!, rows[pivot]!];
    const divisor = rows[pivot]![pivot] ?? 0;
    if (Math.abs(divisor) < 1e-14) continue;
    for (let column = pivot; column <= rows.length; column += 1)
      rows[pivot]![column] = (rows[pivot]![column] ?? 0) / divisor;
    for (let row = 0; row < rows.length; row += 1)
      if (row !== pivot) {
        const factor = rows[row]![pivot] ?? 0;
        for (let column = pivot; column <= rows.length; column += 1)
          rows[row]![column] = (rows[row]![column] ?? 0) - factor * (rows[pivot]![column] ?? 0);
      }
  }
  return rows.map((row) => row[rows.length] ?? 0);
}
function columnMajor(rows: readonly (readonly number[])[]): number[] {
  const columns = rows[0]?.length ?? 0;
  return Array.from(
    { length: rows.length * columns },
    (_, index) => rows[index % rows.length]?.[Math.floor(index / rows.length)] ?? 0,
  );
}
function subsetMatrixColumn(
  value: RValue,
  rows: number,
  column: number,
  invocation: BuiltinInvocation,
): RValue {
  const values = realValues(value, "profile parameter matrix");
  invocation.context.allocate(rows);
  return doubleVector(values.slice(column * rows, column * rows + rows));
}
