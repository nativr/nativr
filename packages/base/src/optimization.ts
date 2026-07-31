import {
  REvaluationError,
  R_NULL,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  characterVector,
  createForcedPromise,
  doubleVector,
  integerVector,
  isMissing,
  listValue,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

export interface OptimizationBuiltinSpec {
  readonly name: "nlm" | "optim";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

const NLM_PARAMETERS = [
  "f",
  "p",
  "...",
  "hessian",
  "typsize",
  "fscale",
  "print.level",
  "ndigit",
  "gradtol",
  "stepmax",
  "steptol",
  "iterlim",
  "check.analyticals",
] as const;

const NLM_CONTROLS = new Set<string>(NLM_PARAMETERS.slice(3));
const OPTIM_PARAMETERS = [
  "par",
  "fn",
  "gr",
  "...",
  "method",
  "lower",
  "upper",
  "control",
  "hessian",
] as const;
const OPTIM_CONTROLS = new Set<string>(OPTIM_PARAMETERS.slice(4));

export const OPTIMIZATION_BUILTIN_SPECS: readonly OptimizationBuiltinSpec[] = [
  {
    name: "nlm",
    parameters: NLM_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinNlm,
  },
  {
    name: "optim",
    parameters: OPTIM_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinOptim,
  },
];

interface MatchedNlmArguments {
  readonly matched: ReadonlyMap<string, BuiltinCallArgument>;
  readonly dots: readonly BuiltinCallArgument[];
}

interface ObjectiveEvaluation {
  readonly value: number;
  readonly gradient?: readonly number[];
  readonly hessian?: readonly number[];
}

interface NlmControls {
  readonly returnHessian: boolean;
  readonly typicalSize: readonly number[];
  readonly functionScale: number;
  readonly significantDigits: number;
  readonly gradientTolerance: number;
  readonly maximumStep: number;
  readonly stepTolerance: number;
  readonly iterationLimit: number;
  readonly checkAnalyticals: boolean;
}

interface OptimControls {
  readonly functionScale: number;
  readonly parameterScale: readonly number[];
  readonly derivativeSteps: readonly number[];
  readonly iterationLimit: number;
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
}

interface OptimEvaluation {
  readonly value: number;
  readonly scaledValue: number;
}

async function builtinNlm(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchNlmArguments(invocation);
  const callable = await forceRequired(invocation, matched.get("f"), "f");
  if (callable.type !== "closure" && callable.type !== "builtin") {
    throw new RTypeMismatchError("NRT3291", "nlm() 'f' must be a function.");
  }
  const initial = numericParameters(await forceRequired(invocation, matched.get("p"), "p"));
  const controls = await nlmControls(invocation, matched, initial);
  const evaluate = async (point: readonly number[]): Promise<ObjectiveEvaluation> => {
    invocation.context.checkpoint();
    const result = await invocation.invokeLazy(callable, [
      {
        promise: createForcedPromise(doubleVector(point), invocation.currentEnvironment()),
      },
      ...dots,
    ]);
    return objectiveEvaluation(result, point.length);
  };

  let point = [...initial];
  let evaluation = await evaluate(point);
  let gradient = await objectiveGradient(point, evaluation, evaluate, controls, invocation, true);
  let inverseHessian = identityMatrix(point.length);
  let code = 4;
  let iterations = 0;
  let maximumStepCount = 0;

  for (; iterations < controls.iterationLimit;) {
    invocation.context.checkpoint();
    if (scaledGradient(gradient, point, evaluation.value, controls) <= controls.gradientTolerance) {
      code = 1;
      break;
    }

    let direction = negate(matrixVectorProduct(inverseHessian, gradient));
    if (dot(direction, gradient) >= 0 || direction.some((value) => !Number.isFinite(value))) {
      direction = negate(gradient);
      inverseHessian = identityMatrix(point.length);
    }
    const scaledLength = parameterScaledLength(direction, controls.typicalSize);
    if (scaledLength > controls.maximumStep) {
      const ratio = controls.maximumStep / scaledLength;
      direction = direction.map((value) => value * ratio);
      maximumStepCount += 1;
    } else {
      maximumStepCount = 0;
    }
    if (maximumStepCount >= 5) {
      code = 5;
      break;
    }

    const directionalDerivative = dot(gradient, direction);
    let step = 1;
    let candidate: readonly number[] | undefined;
    let candidateEvaluation: ObjectiveEvaluation | undefined;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const proposed = point.map((value, index) => value + step * (direction[index] ?? 0));
      try {
        const proposedEvaluation = await evaluate(proposed);
        if (proposedEvaluation.value <= evaluation.value + 1e-4 * step * directionalDerivative) {
          candidate = proposed;
          candidateEvaluation = proposedEvaluation;
          break;
        }
      } catch (error) {
        if (!(error instanceof RTypeMismatchError) || error.code !== "NRT3291") throw error;
      }
      step *= 0.5;
    }
    if (candidate === undefined || candidateEvaluation === undefined) {
      code = 3;
      break;
    }

    const nextGradient = await objectiveGradient(
      candidate,
      candidateEvaluation,
      evaluate,
      controls,
      invocation,
      false,
    );
    const displacement = candidate.map((value, index) => value - (point[index] ?? 0));
    const gradientChange = nextGradient.map((value, index) => value - (gradient[index] ?? 0));
    inverseHessian = bfgsInverseUpdate(inverseHessian, displacement, gradientChange);
    point = [...candidate];
    evaluation = candidateEvaluation;
    gradient = nextGradient;
    iterations += 1;

    if (relativeStep(displacement, point, controls.typicalSize) <= controls.stepTolerance) {
      code = 2;
      break;
    }
  }

  const values: RValue[] = [
    doubleVector([evaluation.value]),
    doubleVector(point),
    doubleVector(gradient),
  ];
  const names = ["minimum", "estimate", "gradient"];
  if (controls.returnHessian) {
    const hessian =
      evaluation.hessian ??
      (await numericalHessian(point, evaluation, evaluate, controls, invocation));
    values.push(withDimensions(doubleVector(hessian), [point.length, point.length]));
    names.push("hessian");
  }
  values.push(integerVector([code]), integerVector([iterations]));
  names.push("code", "iterations");
  return listValue(values, names);
}

async function builtinOptim(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchOptimArguments(invocation);
  const parameterValue = await forceRequiredOptim(invocation, matched.get("par"), "par");
  const initial = optimNumericParameters(parameterValue);
  const parameterNames =
    parameterValue.type === "logical" ||
    parameterValue.type === "integer" ||
    parameterValue.type === "double"
      ? vectorNames(parameterValue)
      : undefined;
  const objective = await forceRequiredOptim(invocation, matched.get("fn"), "fn");
  if (objective.type !== "closure" && objective.type !== "builtin") {
    throw new RTypeMismatchError("NRT3292", "optim() 'fn' must be a function.");
  }
  const gradientValue =
    matched.get("gr") === undefined ? R_NULL : await invocation.force(matched.get("gr")!.promise);
  const gradientFunction =
    gradientValue.type === "closure" || gradientValue.type === "builtin"
      ? gradientValue
      : undefined;
  if (gradientValue.type !== "null" && gradientFunction === undefined) {
    throw new RTypeMismatchError("NRT3292", "optim() 'gr' must be NULL or a function.");
  }
  const method = await optimMethod(invocation, matched.get("method"));
  if (method !== "BFGS") {
    throw new RUnsupportedFeatureError(
      "NRU6145",
      `optim(method = "${method}") is outside the frequency-ranked BFGS slice.`,
    );
  }
  if (matched.has("lower") || matched.has("upper")) {
    throw new RUnsupportedFeatureError(
      "NRU6145",
      "optim() box bounds require the unimplemented L-BFGS-B or Brent method.",
    );
  }
  const controls = await optimControls(invocation, matched.get("control"), initial.length);
  const returnHessian = await logicalControl(invocation, matched.get("hessian"), false, "hessian");
  let functionCount = 0;
  let gradientCount = 0;
  const parameterVector = (scaled: readonly number[]): RValue => {
    const value = doubleVector(
      scaled.map((item, index) => item * (controls.parameterScale[index] ?? 1)),
    );
    return parameterNames === undefined ? value : withNames(value, parameterNames);
  };
  const evaluate = async (scaled: readonly number[], count: boolean): Promise<OptimEvaluation> => {
    invocation.context.checkpoint();
    const result = await invocation.invokeLazy(objective, [
      {
        promise: createForcedPromise(parameterVector(scaled), invocation.currentEnvironment()),
      },
      ...dots,
    ]);
    const evaluation = objectiveEvaluation(result, scaled.length);
    if (count) functionCount += 1;
    return {
      value: evaluation.value,
      scaledValue: evaluation.value / controls.functionScale,
    };
  };
  const gradient = async (scaled: readonly number[]): Promise<readonly number[]> => {
    gradientCount += 1;
    if (gradientFunction !== undefined) {
      const result = await invocation.invokeLazy(gradientFunction, [
        {
          promise: createForcedPromise(parameterVector(scaled), invocation.currentEnvironment()),
        },
        ...dots,
      ]);
      const values = numericAttribute(result, scaled.length);
      if (values === undefined) {
        throw new RTypeMismatchError(
          "NRT3292",
          `optim() gradient must return ${String(scaled.length)} finite values.`,
        );
      }
      return values.map(
        (item, index) => (item * (controls.parameterScale[index] ?? 1)) / controls.functionScale,
      );
    }
    const values = new Array<number>(scaled.length);
    for (let index = 0; index < scaled.length; index += 1) {
      invocation.context.checkpoint();
      const step = controls.derivativeSteps[index] ?? 1e-3;
      const highPoint = [...scaled];
      const lowPoint = [...scaled];
      highPoint[index] = (highPoint[index] ?? 0) + step;
      lowPoint[index] = (lowPoint[index] ?? 0) - step;
      const high = await evaluate(highPoint, false);
      const low = await evaluate(lowPoint, false);
      values[index] = (high.scaledValue - low.scaledValue) / (2 * step);
    }
    return values;
  };

  let scaledPoint = initial.map((item, index) => item / (controls.parameterScale[index] ?? 1));
  let evaluation = await evaluate(scaledPoint, true);
  if (scaledPoint.length === 0) {
    gradientCount = 1;
    return optimResult(
      initial,
      parameterNames,
      evaluation.value,
      functionCount,
      gradientCount,
      0,
      returnHessian ? [] : undefined,
    );
  }
  let currentGradient = await gradient(scaledPoint);
  let inverseHessian = identityMatrix(scaledPoint.length);
  let convergence = 1;

  for (let iteration = 0; iteration < controls.iterationLimit; iteration += 1) {
    invocation.context.checkpoint();
    if (Math.max(...currentGradient.map(Math.abs)) <= controls.relativeTolerance) {
      convergence = 0;
      break;
    }
    let direction = negate(matrixVectorProduct(inverseHessian, currentGradient));
    if (dot(direction, currentGradient) >= 0 || direction.some((item) => !Number.isFinite(item))) {
      direction = negate(currentGradient);
      inverseHessian = identityMatrix(scaledPoint.length);
    }
    const directionalDerivative = dot(currentGradient, direction);
    let step = 1;
    let candidate: readonly number[] | undefined;
    let candidateEvaluation: OptimEvaluation | undefined;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const proposed = scaledPoint.map((item, index) => item + step * (direction[index] ?? 0));
      try {
        const proposedEvaluation = await evaluate(proposed, true);
        if (
          proposedEvaluation.scaledValue <=
          evaluation.scaledValue + 1e-4 * step * directionalDerivative
        ) {
          candidate = proposed;
          candidateEvaluation = proposedEvaluation;
          break;
        }
      } catch (error) {
        if (!(error instanceof RTypeMismatchError) || error.code !== "NRT3291") throw error;
      }
      step *= 0.5;
    }
    if (candidate === undefined || candidateEvaluation === undefined) break;
    const nextGradient = await gradient(candidate);
    const displacement = candidate.map((item, index) => item - (scaledPoint[index] ?? 0));
    const gradientChange = nextGradient.map((item, index) => item - (currentGradient[index] ?? 0));
    inverseHessian = bfgsInverseUpdate(inverseHessian, displacement, gradientChange);
    const previousScaledValue = evaluation.scaledValue;
    scaledPoint = [...candidate];
    evaluation = candidateEvaluation;
    currentGradient = nextGradient;
    if (
      evaluation.scaledValue <= controls.absoluteTolerance ||
      Math.abs(previousScaledValue - evaluation.scaledValue) <=
        controls.relativeTolerance * (Math.abs(previousScaledValue) + controls.relativeTolerance)
    ) {
      convergence = 0;
      break;
    }
  }

  const resultParameters = scaledPoint.map(
    (item, index) => item * (controls.parameterScale[index] ?? 1),
  );
  let hessian: readonly number[] | undefined;
  if (returnHessian) {
    const hessianControls: NlmControls = {
      returnHessian: true,
      typicalSize: controls.parameterScale,
      functionScale: Math.max(Math.abs(evaluation.value), 1),
      significantDigits: 12,
      gradientTolerance: controls.relativeTolerance,
      maximumStep: 1,
      stepTolerance: controls.relativeTolerance,
      iterationLimit: controls.iterationLimit,
      checkAnalyticals: false,
    };
    const evaluateOriginal = async (point: readonly number[]): Promise<ObjectiveEvaluation> => {
      const scaled = point.map((item, index) => item / (controls.parameterScale[index] ?? 1));
      const result = await evaluate(scaled, false);
      return { value: result.value };
    };
    hessian = await numericalHessian(
      resultParameters,
      { value: evaluation.value },
      evaluateOriginal,
      hessianControls,
      invocation,
    );
  }
  return optimResult(
    resultParameters,
    parameterNames,
    evaluation.value,
    functionCount,
    gradientCount,
    convergence,
    hessian,
  );
}

function optimResult(
  parameters: readonly number[],
  parameterNames: readonly string[] | undefined,
  value: number,
  functionCount: number,
  gradientCount: number,
  convergence: number,
  hessian: readonly number[] | undefined,
): RValue {
  const parameterVector = doubleVector(parameters);
  const values: RValue[] = [
    parameterNames === undefined ? parameterVector : withNames(parameterVector, parameterNames),
    doubleVector([value]),
    withNames(integerVector([functionCount, gradientCount]), ["function", "gradient"]),
    integerVector([convergence]),
    R_NULL,
  ];
  const names = ["par", "value", "counts", "convergence", "message"];
  if (hessian !== undefined) {
    let matrix = withDimensions(doubleVector(hessian), [parameters.length, parameters.length]);
    if (parameterNames !== undefined) {
      matrix = withAttribute(
        matrix,
        "dimnames",
        listValue([characterVector(parameterNames), characterVector(parameterNames)]),
      );
    }
    values.push(matrix);
    names.push("hessian");
  }
  return listValue(values, names);
}

function matchOptimArguments(invocation: BuiltinInvocation): MatchedNlmArguments {
  const matched = new Map<string, BuiltinCallArgument>();
  const resolved = new Set<number>();
  const claim = (name: string, argument: BuiltinCallArgument, index: number): void => {
    if (matched.has(name)) {
      throw new REvaluationError("NRE2102", `Argument '${name}' matched more than once.`);
    }
    matched.set(name, argument);
    resolved.add(index);
  };
  for (const [index, argument] of invocation.arguments.entries()) {
    if (
      argument.name === "par" ||
      argument.name === "fn" ||
      argument.name === "gr" ||
      OPTIM_CONTROLS.has(argument.name ?? "")
    ) {
      claim(argument.name!, argument, index);
    }
  }
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index) || argument.name === undefined) continue;
    const candidates = ["par", "fn", "gr"].filter((name) => name.startsWith(argument.name ?? ""));
    if (candidates.length === 1) claim(candidates[0]!, argument, index);
  }
  let positional = 0;
  const dots: BuiltinCallArgument[] = [];
  const positionalNames = ["par", "fn", "gr"];
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index)) continue;
    if (argument.name !== undefined) {
      dots.push(argument);
      continue;
    }
    while (positional < positionalNames.length && matched.has(positionalNames[positional]!)) {
      positional += 1;
    }
    const name = positionalNames[positional];
    if (name !== undefined) {
      claim(name, argument, index);
      positional += 1;
    } else {
      dots.push(argument);
    }
  }
  return { matched, dots };
}

async function forceRequiredOptim(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2145", `Argument '${name}' is missing in optim().`);
  }
  return invocation.force(argument.promise);
}

function optimNumericParameters(value: RValue): readonly number[] {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3292", "optim() requires a numeric parameter vector.");
  }
  if (value.length > 64) {
    throw new RTypeMismatchError("NRT3292", "optim() currently supports at most 64 parameters.");
  }
  return Array.from({ length: value.length }, (_, index) => {
    if (isMissing(value, index) || !Number.isFinite(value.values[index] ?? Number.NaN)) {
      throw new RTypeMismatchError("NRT3292", "optim() parameter values must be finite.");
    }
    return value.values[index] ?? 0;
  });
}

async function optimMethod(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<string> {
  if (argument === undefined) return "Nelder-Mead";
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3292", "optim() 'method' must be one character choice.");
  }
  const requested = value.values[0] ?? "";
  const choices = ["Nelder-Mead", "BFGS", "CG", "L-BFGS-B", "SANN", "Brent"];
  const exact = choices.find((choice) => choice === requested);
  if (exact !== undefined) return exact;
  const matches = choices.filter((choice) => choice.startsWith(requested));
  if (matches.length === 1) return matches[0]!;
  throw new RTypeMismatchError("NRT3292", `optim() method '${requested}' is not unambiguous.`);
}

async function optimControls(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  length: number,
): Promise<OptimControls> {
  let functionScale = 1;
  let parameterScale = Array.from({ length }, () => 1);
  let derivativeSteps = Array.from({ length }, () => 1e-3);
  let iterationLimit = 100;
  let absoluteTolerance = Number.NEGATIVE_INFINITY;
  let relativeTolerance = Math.sqrt(Number.EPSILON);
  if (argument !== undefined) {
    const value = await invocation.force(argument.promise);
    if (value.type !== "list") {
      throw new RTypeMismatchError("NRT3292", "optim() 'control' must be a list.");
    }
    const names = vectorNames(value);
    if (value.length > 0 && names === undefined) {
      throw new RTypeMismatchError("NRT3292", "optim() control entries must be named.");
    }
    for (let index = 0; index < value.length; index += 1) {
      const name = names?.[index] ?? "";
      const entry = value.values[index] ?? R_NULL;
      switch (name) {
        case "fnscale":
          functionScale = optimControlScalar(entry, name);
          if (functionScale === 0) {
            throw new RTypeMismatchError("NRT3292", "optim() control 'fnscale' must be nonzero.");
          }
          break;
        case "parscale":
          parameterScale = optimControlVector(entry, name, length);
          if (parameterScale.some((item) => item <= 0)) {
            throw new RTypeMismatchError(
              "NRT3292",
              "optim() control 'parscale' values must be positive.",
            );
          }
          break;
        case "ndeps":
          derivativeSteps = optimControlVector(entry, name, length);
          if (derivativeSteps.some((item) => item <= 0)) {
            throw new RTypeMismatchError(
              "NRT3292",
              "optim() control 'ndeps' values must be positive.",
            );
          }
          break;
        case "maxit":
          iterationLimit = optimControlScalar(entry, name);
          if (!Number.isInteger(iterationLimit) || iterationLimit < 0 || iterationLimit > 10_000) {
            throw new RTypeMismatchError(
              "NRT3292",
              "optim() control 'maxit' must be a bounded non-negative integer.",
            );
          }
          break;
        case "abstol":
          absoluteTolerance = optimControlScalar(entry, name, true);
          break;
        case "reltol":
          relativeTolerance = optimControlScalar(entry, name);
          if (relativeTolerance <= 0) {
            throw new RTypeMismatchError("NRT3292", "optim() control 'reltol' must be positive.");
          }
          break;
        case "trace": {
          const trace = optimControlScalar(entry, name);
          if (trace !== 0) {
            throw new RUnsupportedFeatureError(
              "NRU6145",
              "optim(control = list(trace > 0)) output is outside the browser-safe slice.",
            );
          }
          break;
        }
        case "":
          throw new RTypeMismatchError("NRT3292", "optim() control names must be non-empty.");
        default:
          throw new RUnsupportedFeatureError(
            "NRU6145",
            `optim() control '${name}' is outside the BFGS slice.`,
          );
      }
    }
  }
  return {
    functionScale,
    parameterScale,
    derivativeSteps,
    iterationLimit,
    absoluteTolerance,
    relativeTolerance,
  };
}

function optimControlScalar(value: RValue, name: string, allowInfinity = false): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3292", `optim() control '${name}' must be one numeric value.`);
  }
  const result = value.values[0] ?? Number.NaN;
  if (Number.isNaN(result) || (!allowInfinity && !Number.isFinite(result))) {
    throw new RTypeMismatchError(
      "NRT3292",
      `optim() control '${name}' must be one valid numeric value.`,
    );
  }
  return result;
}

function optimControlVector(value: RValue, name: string, length: number): number[] {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== length
  ) {
    throw new RTypeMismatchError(
      "NRT3292",
      `optim() control '${name}' must match the parameter length.`,
    );
  }
  const output = Array.from({ length }, (_, index) =>
    isMissing(value, index) ? Number.NaN : (value.values[index] ?? Number.NaN),
  );
  if (!output.every(Number.isFinite)) {
    throw new RTypeMismatchError("NRT3292", `optim() control '${name}' values must be finite.`);
  }
  return output;
}

function matchNlmArguments(invocation: BuiltinInvocation): MatchedNlmArguments {
  const matched = new Map<string, BuiltinCallArgument>();
  const resolved = new Set<number>();
  const claim = (name: string, argument: BuiltinCallArgument, index: number): void => {
    if (matched.has(name)) {
      throw new REvaluationError("NRE2102", `Argument '${name}' matched more than once.`);
    }
    matched.set(name, argument);
    resolved.add(index);
  };

  for (const [index, argument] of invocation.arguments.entries()) {
    if (argument.name === "f" || argument.name === "p" || NLM_CONTROLS.has(argument.name ?? "")) {
      claim(argument.name!, argument, index);
    }
  }
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index) || argument.name === undefined) continue;
    const candidates = ["f", "p"].filter((name) => name.startsWith(argument.name ?? ""));
    if (candidates.length === 1) claim(candidates[0]!, argument, index);
  }

  let positional = 0;
  const dots: BuiltinCallArgument[] = [];
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index)) continue;
    if (argument.name !== undefined) {
      dots.push(argument);
      continue;
    }
    while (positional < 2 && matched.has(positional === 0 ? "f" : "p")) positional += 1;
    if (positional < 2) {
      claim(positional++ === 0 ? "f" : "p", argument, index);
    } else {
      dots.push(argument);
    }
  }
  return { matched, dots };
}

async function forceRequired(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2144", `Argument '${name}' is missing in nlm().`);
  }
  return invocation.force(argument.promise);
}

function numericParameters(value: RValue): readonly number[] {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0
  ) {
    throw new RTypeMismatchError("NRT3291", "nlm() requires a non-empty numeric parameter vector.");
  }
  if (value.length > 64) {
    throw new RTypeMismatchError("NRT3291", "nlm() currently supports at most 64 parameters.");
  }
  return Array.from({ length: value.length }, (_, index) => {
    if (isMissing(value, index)) {
      throw new RTypeMismatchError("NRT3291", "nlm() parameter values must be finite.");
    }
    const parameter = value.values[index] ?? Number.NaN;
    if (!Number.isFinite(parameter)) {
      throw new RTypeMismatchError("NRT3291", "nlm() parameter values must be finite.");
    }
    return parameter;
  });
}

async function nlmControls(
  invocation: BuiltinInvocation,
  matched: ReadonlyMap<string, BuiltinCallArgument>,
  initial: readonly number[],
): Promise<NlmControls> {
  const returnHessian = await logicalControl(invocation, matched.get("hessian"), false, "hessian");
  const typicalSize = await vectorControl(
    invocation,
    matched.get("typsize"),
    Array.from({ length: initial.length }, () => 1),
    "typsize",
    initial.length,
  );
  if (typicalSize.some((value) => value <= 0)) {
    throw new RTypeMismatchError("NRT3291", "nlm() 'typsize' values must be positive.");
  }
  const functionScale = await scalarControl(invocation, matched.get("fscale"), 1, "fscale");
  const printLevel = await integerControl(invocation, matched.get("print.level"), 0, "print.level");
  if (printLevel !== 0) {
    throw new RUnsupportedFeatureError(
      "NRU6144",
      "nlm(print.level > 0) trace output is outside the browser-safe optimization slice.",
    );
  }
  const significantDigits = await integerControl(invocation, matched.get("ndigit"), 12, "ndigit");
  if (significantDigits < 1 || significantDigits > 22) {
    throw new RTypeMismatchError("NRT3291", "nlm() 'ndigit' must be between 1 and 22.");
  }
  const gradientTolerance = await positiveControl(
    invocation,
    matched.get("gradtol"),
    1e-6,
    "gradtol",
  );
  const defaultStep = Math.max(
    1000 *
      Math.sqrt(
        initial.reduce((sum, value, index) => sum + (value / (typicalSize[index] ?? 1)) ** 2, 0),
      ),
    1000,
  );
  const maximumStep = await positiveControl(
    invocation,
    matched.get("stepmax"),
    defaultStep,
    "stepmax",
  );
  const stepTolerance = await positiveControl(invocation, matched.get("steptol"), 1e-6, "steptol");
  const iterationLimit = await integerControl(invocation, matched.get("iterlim"), 100, "iterlim");
  if (iterationLimit < 1 || iterationLimit > 10_000) {
    throw new RTypeMismatchError("NRT3291", "nlm() 'iterlim' must be a positive bounded integer.");
  }
  const checkAnalyticals = await logicalControl(
    invocation,
    matched.get("check.analyticals"),
    true,
    "check.analyticals",
  );
  return {
    returnHessian,
    typicalSize,
    functionScale: Math.max(Math.abs(functionScale), Number.EPSILON),
    significantDigits,
    gradientTolerance,
    maximumStep,
    stepTolerance,
    iterationLimit,
    checkAnalyticals,
  };
}

async function objectiveGradient(
  point: readonly number[],
  evaluation: ObjectiveEvaluation,
  evaluate: (point: readonly number[]) => Promise<ObjectiveEvaluation>,
  controls: NlmControls,
  invocation: BuiltinInvocation,
  initial: boolean,
): Promise<readonly number[]> {
  if (evaluation.gradient === undefined) {
    return numericalGradient(point, evaluation.value, evaluate, controls, invocation);
  }
  if (initial && controls.checkAnalyticals) {
    const numerical = await numericalGradient(
      point,
      evaluation.value,
      evaluate,
      controls,
      invocation,
    );
    const mismatch = numerical.some(
      (value, index) =>
        Math.abs(value - (evaluation.gradient?.[index] ?? 0)) > 1e-4 * Math.max(1, Math.abs(value)),
    );
    if (mismatch) {
      invocation.context.warn({
        code: "NRW1016",
        message: "nlm() analytic gradient check failed; numerical derivatives are used.",
      });
      return numerical;
    }
  }
  return evaluation.gradient;
}

async function numericalGradient(
  point: readonly number[],
  centerValue: number,
  evaluate: (point: readonly number[]) => Promise<ObjectiveEvaluation>,
  controls: NlmControls,
  invocation: BuiltinInvocation,
): Promise<readonly number[]> {
  const output = new Array<number>(point.length);
  const epsilon = Math.max(10 ** (-controls.significantDigits / 2), 1e-7);
  for (let index = 0; index < point.length; index += 1) {
    invocation.context.checkpoint();
    const scale = Math.max(Math.abs(point[index] ?? 0), controls.typicalSize[index] ?? 1);
    const step = epsilon * scale;
    const forward = [...point];
    const backward = [...point];
    forward[index] = (forward[index] ?? 0) + step;
    backward[index] = (backward[index] ?? 0) - step;
    try {
      const high = await evaluate(forward);
      const low = await evaluate(backward);
      output[index] = (high.value - low.value) / (2 * step);
    } catch (error) {
      if (!(error instanceof RTypeMismatchError) || error.code !== "NRT3291") throw error;
      const high = await evaluate(forward);
      output[index] = (high.value - centerValue) / step;
    }
  }
  return output;
}

async function numericalHessian(
  point: readonly number[],
  center: ObjectiveEvaluation,
  evaluate: (point: readonly number[]) => Promise<ObjectiveEvaluation>,
  controls: NlmControls,
  invocation: BuiltinInvocation,
): Promise<readonly number[]> {
  const length = point.length;
  const result = new Array<number>(length * length).fill(0);
  const epsilon = Math.max(10 ** (-controls.significantDigits / 3), 1e-4);
  for (let column = 0; column < length; column += 1) {
    invocation.context.checkpoint();
    const step =
      epsilon * Math.max(Math.abs(point[column] ?? 0), controls.typicalSize[column] ?? 1);
    const highPoint = [...point];
    const lowPoint = [...point];
    highPoint[column] = (highPoint[column] ?? 0) + step;
    lowPoint[column] = (lowPoint[column] ?? 0) - step;
    const highEvaluation = await evaluate(highPoint);
    const lowEvaluation = await evaluate(lowPoint);
    const highGradient = await objectiveGradient(
      highPoint,
      highEvaluation,
      evaluate,
      { ...controls, checkAnalyticals: false },
      invocation,
      false,
    );
    const lowGradient = await objectiveGradient(
      lowPoint,
      lowEvaluation,
      evaluate,
      { ...controls, checkAnalyticals: false },
      invocation,
      false,
    );
    for (let row = 0; row < length; row += 1) {
      result[row + column * length] =
        ((highGradient[row] ?? 0) - (lowGradient[row] ?? 0)) / (2 * step);
    }
  }
  for (let row = 0; row < length; row += 1) {
    for (let column = row + 1; column < length; column += 1) {
      const average =
        ((result[row + column * length] ?? 0) + (result[column + row * length] ?? 0)) / 2;
      result[row + column * length] = average;
      result[column + row * length] = average;
    }
  }
  void center;
  return result;
}

function objectiveEvaluation(value: RValue, parameterCount: number): ObjectiveEvaluation {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3291", "nlm() objective must return one numeric value.");
  }
  const objective = value.values[0] ?? Number.NaN;
  if (!Number.isFinite(objective)) {
    throw new RTypeMismatchError("NRT3291", "nlm() objective must return a finite value.");
  }
  const gradient = numericAttribute(value.attributes.get("gradient"), parameterCount);
  const hessian = numericHessianAttribute(value.attributes.get("hessian"), parameterCount);
  return {
    value: objective,
    ...(gradient === undefined ? {} : { gradient }),
    ...(hessian === undefined ? {} : { hessian }),
  };
}

function numericHessianAttribute(
  value: RValue | undefined,
  parameterCount: number,
): readonly number[] | undefined {
  if (
    value === undefined ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double")
  ) {
    return undefined;
  }
  const dimensions = vectorDimensions(value);
  if (
    dimensions?.length !== 2 ||
    dimensions[0] !== parameterCount ||
    dimensions[1] !== parameterCount
  ) {
    return undefined;
  }
  return numericAttribute(value, parameterCount * parameterCount);
}

function numericAttribute(
  value: RValue | undefined,
  length: number,
): readonly number[] | undefined {
  if (
    value === undefined ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== length
  ) {
    return undefined;
  }
  const output = Array.from({ length }, (_, index) =>
    isMissing(value, index) ? Number.NaN : (value.values[index] ?? Number.NaN),
  );
  return output.every(Number.isFinite) ? output : undefined;
}

async function logicalControl(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    !Number.isFinite(value.values[0] ?? Number.NaN)
  ) {
    throw new RTypeMismatchError("NRT3291", `nlm() '${name}' must be one logical value.`);
  }
  return (value.values[0] ?? 0) !== 0;
}

async function scalarControl(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    !Number.isFinite(value.values[0] ?? Number.NaN)
  ) {
    throw new RTypeMismatchError("NRT3291", `nlm() '${name}' must be one finite numeric value.`);
  }
  return value.values[0] ?? 0;
}

async function positiveControl(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  const value = await scalarControl(invocation, argument, fallback, name);
  if (value <= 0) {
    throw new RTypeMismatchError("NRT3291", `nlm() '${name}' must be positive.`);
  }
  return value;
}

async function integerControl(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  const value = await scalarControl(invocation, argument, fallback, name);
  if (!Number.isInteger(value)) {
    throw new RTypeMismatchError("NRT3291", `nlm() '${name}' must be an integer.`);
  }
  return value;
}

async function vectorControl(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: readonly number[],
  name: string,
  length: number,
): Promise<readonly number[]> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== length
  ) {
    throw new RTypeMismatchError(
      "NRT3291",
      `nlm() '${name}' must be a numeric vector matching 'p'.`,
    );
  }
  const output = Array.from({ length }, (_, index) =>
    isMissing(value, index) ? Number.NaN : (value.values[index] ?? Number.NaN),
  );
  if (!output.every(Number.isFinite)) {
    throw new RTypeMismatchError("NRT3291", `nlm() '${name}' values must be finite.`);
  }
  return output;
}

function identityMatrix(length: number): readonly number[] {
  return Array.from({ length: length * length }, (_, index) =>
    Math.floor(index / length) === index % length ? 1 : 0,
  );
}

function matrixVectorProduct(matrix: readonly number[], vector: readonly number[]): number[] {
  const length = vector.length;
  return Array.from({ length }, (_, row) =>
    vector.reduce((sum, value, column) => sum + (matrix[row * length + column] ?? 0) * value, 0),
  );
}

function bfgsInverseUpdate(
  inverse: readonly number[],
  displacement: readonly number[],
  gradientChange: readonly number[],
): readonly number[] {
  const curvature = dot(displacement, gradientChange);
  if (
    !Number.isFinite(curvature) ||
    curvature <=
      1e-12 *
        Math.max(
          1,
          Math.sqrt(dot(displacement, displacement) * dot(gradientChange, gradientChange)),
        )
  ) {
    return identityMatrix(displacement.length);
  }
  const transformed = matrixVectorProduct(inverse, gradientChange);
  const transformedCurvature = dot(gradientChange, transformed);
  const length = displacement.length;
  return Array.from({ length: length * length }, (_, index) => {
    const row = Math.floor(index / length);
    const column = index % length;
    const left = displacement[row] ?? 0;
    const right = displacement[column] ?? 0;
    const transformedLeft = transformed[row] ?? 0;
    const transformedRight = transformed[column] ?? 0;
    return (
      (inverse[index] ?? 0) +
      ((curvature + transformedCurvature) / (curvature * curvature)) * left * right -
      (transformedLeft * right + left * transformedRight) / curvature
    );
  });
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function negate(values: readonly number[]): number[] {
  return values.map((value) => -value);
}

function parameterScaledLength(values: readonly number[], typicalSize: readonly number[]): number {
  return Math.sqrt(
    values.reduce((sum, value, index) => sum + (value / (typicalSize[index] ?? 1)) ** 2, 0),
  );
}

function scaledGradient(
  gradient: readonly number[],
  point: readonly number[],
  value: number,
  controls: NlmControls,
): number {
  const denominator = Math.max(Math.abs(value), controls.functionScale);
  return gradient.reduce(
    (maximum, item, index) =>
      Math.max(
        maximum,
        (Math.abs(item) * Math.max(Math.abs(point[index] ?? 0), controls.typicalSize[index] ?? 1)) /
          denominator,
      ),
    0,
  );
}

function relativeStep(
  displacement: readonly number[],
  point: readonly number[],
  typicalSize: readonly number[],
): number {
  return displacement.reduce(
    (maximum, value, index) =>
      Math.max(
        maximum,
        Math.abs(value) / Math.max(Math.abs(point[index] ?? 0), typicalSize[index] ?? 1),
      ),
    0,
  );
}
