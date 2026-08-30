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
  missingValue,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

import {
  BOX_OPTIMIZATION_BACKEND_STATE_KEY,
  type BoxOptimizationBackend,
} from "./box-optimization.js";
import type { OptimControls } from "./optimization-controls.js";
import { nextNormal, nextRandom, randomState } from "./random.js";

export interface OptimizationBuiltinSpec {
  readonly name: "integrate" | "nlm" | "nlminb" | "optim" | "optimise" | "optimize" | "uniroot";
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
const NLMINB_PARAMETERS = [
  "start",
  "objective",
  "gradient",
  "hessian",
  "...",
  "scale",
  "control",
  "lower",
  "upper",
] as const;
const NLMINB_CONTROLS = new Set<string>(NLMINB_PARAMETERS.slice(5));
const OPTIM_CONTROLS = new Set<string>(OPTIM_PARAMETERS.slice(4));
const OPTIMIZE_PARAMETERS = ["f", "interval", "...", "lower", "upper", "maximum", "tol"] as const;
const OPTIMIZE_CONTROLS = new Set<string>(OPTIMIZE_PARAMETERS.slice(3));
const UNIROOT_PARAMETERS = [
  "f",
  "interval",
  "...",
  "lower",
  "upper",
  "f.lower",
  "f.upper",
  "extendInt",
  "check.conv",
  "tol",
  "maxiter",
  "trace",
] as const;
const UNIROOT_CONTROLS = new Set<string>(UNIROOT_PARAMETERS.slice(3));
const INTEGRATE_PARAMETERS = [
  "f",
  "lower",
  "upper",
  "...",
  "subdivisions",
  "rel.tol",
  "abs.tol",
  "stop.on.error",
  "keep.xy",
  "aux",
] as const;
const INTEGRATE_CONTROLS = new Set<string>(INTEGRATE_PARAMETERS.slice(4));

export const OPTIMIZATION_BUILTIN_SPECS: readonly OptimizationBuiltinSpec[] = [
  {
    name: "integrate",
    parameters: INTEGRATE_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinIntegrate,
  },
  {
    name: "nlm",
    parameters: NLM_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinNlm,
  },
  {
    name: "nlminb",
    parameters: NLMINB_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinNlminb,
  },
  {
    name: "optim",
    parameters: OPTIM_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinOptim,
  },
  {
    name: "optimise",
    parameters: OPTIMIZE_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinOptimize,
  },
  {
    name: "optimize",
    parameters: OPTIMIZE_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinOptimize,
  },
  {
    name: "uniroot",
    parameters: UNIROOT_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinUniroot,
  },
];

interface IntegrationInterval {
  readonly lower: number;
  readonly upper: number;
  readonly value: number;
  readonly error: number;
}

const KRONROD_NODES = [
  0.9914553711208126, 0.9491079123427585, 0.8648644233597691, 0.7415311855993945,
  0.5860872354676911, 0.4058451513773972, 0.2077849550078985,
] as const;
const KRONROD_WEIGHTS = [
  Number("0.02293532201052922"),
  Number("0.06309209262997855"),
  Number("0.1047900103222502"),
  Number("0.1406532597155259"),
  Number("0.1690047266392679"),
  Number("0.1903505780647854"),
  Number("0.2044329400752989"),
  Number("0.2094821410847278"),
] as const;
const GAUSS_WEIGHTS = [
  0.1294849661688697, 0.2797053914892766, 0.3818300505051189, 0.4179591836734694,
] as const;

async function builtinIntegrate(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchIntegrateArguments(invocation);
  const callable = await forceRequiredIntegration(invocation, matched.get("f"), "f");
  if (callable.type !== "closure" && callable.type !== "builtin") {
    throw new RTypeMismatchError("NRT3468", "integrate() 'f' must be a function.");
  }
  let lower = integrationBound(
    await forceRequiredIntegration(invocation, matched.get("lower"), "lower"),
    "lower",
  );
  let upper = integrationBound(
    await forceRequiredIntegration(invocation, matched.get("upper"), "upper"),
    "upper",
  );
  const subdivisions = Math.trunc(
    await integrationOptionalScalar(invocation, matched.get("subdivisions"), 100, "subdivisions"),
  );
  if (subdivisions < 1 || subdivisions > 1_000_000) {
    throw new RTypeMismatchError(
      "NRT3468",
      "integrate() 'subdivisions' must be a positive integer.",
    );
  }
  const relativeTolerance = await integrationOptionalScalar(
    invocation,
    matched.get("rel.tol"),
    Number.EPSILON ** 0.25,
    "rel.tol",
  );
  const absoluteTolerance = await integrationOptionalScalar(
    invocation,
    matched.get("abs.tol"),
    relativeTolerance,
    "abs.tol",
  );
  if (
    relativeTolerance < 0 ||
    absoluteTolerance < 0 ||
    relativeTolerance + absoluteTolerance <= 0
  ) {
    throw new RTypeMismatchError("NRT3468", "integrate() tolerances must be non-negative.");
  }
  const stopOnError = await logicalControl(
    invocation,
    matched.get("stop.on.error"),
    true,
    "stop.on.error",
  );

  if (lower === upper) {
    return integrationResult(0, 0, 1, "OK");
  }
  let sign = 1;
  if (lower > upper) {
    [lower, upper] = [upper, lower];
    sign = -1;
  }

  const transformed = integrationTransform(lower, upper);
  const evaluate = async (points: readonly number[]): Promise<readonly number[]> => {
    invocation.context.checkpoint();
    invocation.context.allocate(points.length);
    const original = new Float64Array(points.length);
    const jacobian = new Float64Array(points.length);
    for (let index = 0; index < points.length; index += 1) {
      const mapped = transformed.map(points[index] ?? 0);
      original[index] = mapped.value;
      jacobian[index] = mapped.jacobian;
    }
    const result = await invocation.invokeLazy(callable, [
      {
        promise: createForcedPromise(doubleVector(original), invocation.currentEnvironment()),
      },
      ...dots,
    ]);
    if (
      (result.type !== "logical" && result.type !== "integer" && result.type !== "double") ||
      result.length !== points.length
    ) {
      throw new RTypeMismatchError(
        "NRT3468",
        "integrate() f() must return a numeric vector with the same length as its input.",
      );
    }
    return Array.from({ length: result.length }, (_, index) => {
      if (isMissing(result, index)) {
        throw new RTypeMismatchError("NRT3468", "non-finite function value in integrate().");
      }
      const value = (result.values[index] ?? Number.NaN) * (jacobian[index] ?? 1);
      if (!Number.isFinite(value)) {
        throw new RTypeMismatchError("NRT3468", "non-finite function value in integrate().");
      }
      return value;
    });
  };

  try {
    const initial = await gaussKronrodInterval(
      transformed.lower,
      transformed.upper,
      evaluate,
      invocation,
    );
    const intervals: IntegrationInterval[] = [initial];
    let value = initial.value;
    let error = initial.error;
    while (
      intervals.length < subdivisions &&
      error > Math.max(absoluteTolerance, relativeTolerance * Math.abs(value))
    ) {
      invocation.context.checkpoint();
      let selected = 0;
      for (let index = 1; index < intervals.length; index += 1) {
        if ((intervals[index]?.error ?? 0) > (intervals[selected]?.error ?? 0)) selected = index;
      }
      const current = intervals[selected]!;
      const midpoint = (current.lower + current.upper) / 2;
      const left = await gaussKronrodInterval(current.lower, midpoint, evaluate, invocation);
      const right = await gaussKronrodInterval(midpoint, current.upper, evaluate, invocation);
      intervals.splice(selected, 1, left, right);
      value += left.value + right.value - current.value;
      error += left.error + right.error - current.error;
    }
    const converged = error <= Math.max(absoluteTolerance, relativeTolerance * Math.abs(value));
    const message = converged ? "OK" : "maximum number of subdivisions reached";
    if (!converged && stopOnError) throw new REvaluationError("NRE2267", message);
    return integrationResult(sign * value, error, intervals.length, message);
  } catch (error) {
    if (stopOnError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return integrationResult(Number.NaN, Number.NaN, 0, message);
  }
}

async function gaussKronrodInterval(
  lower: number,
  upper: number,
  evaluate: (points: readonly number[]) => Promise<readonly number[]>,
  invocation: BuiltinInvocation,
): Promise<IntegrationInterval> {
  const midpoint = (lower + upper) / 2;
  const halfWidth = (upper - lower) / 2;
  const points = [midpoint];
  for (const node of KRONROD_NODES) {
    points.push(midpoint - halfWidth * node, midpoint + halfWidth * node);
  }
  const values = await evaluate(points);
  let kronrod = (values[0] ?? 0) * KRONROD_WEIGHTS[7];
  let gauss = (values[0] ?? 0) * GAUSS_WEIGHTS[3];
  for (let node = 0; node < KRONROD_NODES.length; node += 1) {
    invocation.context.checkpoint();
    const pair = (values[1 + node * 2] ?? 0) + (values[2 + node * 2] ?? 0);
    kronrod += pair * KRONROD_WEIGHTS[node]!;
    if (node % 2 === 1) gauss += pair * GAUSS_WEIGHTS[(node - 1) / 2]!;
  }
  const value = kronrod * halfWidth;
  const gaussValue = gauss * halfWidth;
  return { lower, upper, value, error: Math.abs(value - gaussValue) };
}

function integrationTransform(
  lower: number,
  upper: number,
): {
  readonly lower: number;
  readonly upper: number;
  readonly map: (point: number) => { readonly value: number; readonly jacobian: number };
} {
  if (Number.isFinite(lower) && Number.isFinite(upper)) {
    return { lower, upper, map: (value) => ({ value, jacobian: 1 }) };
  }
  if (!Number.isFinite(lower) && !Number.isFinite(upper)) {
    return {
      lower: 0,
      upper: 1,
      map: (point) => {
        const angle = Math.PI * (point - 0.5);
        const cosine = Math.cos(angle);
        return { value: Math.tan(angle), jacobian: Math.PI / (cosine * cosine) };
      },
    };
  }
  if (Number.isFinite(lower)) {
    return {
      lower: 0,
      upper: 1,
      map: (point) => ({
        value: lower + point / (1 - point),
        jacobian: 1 / ((1 - point) * (1 - point)),
      }),
    };
  }
  return {
    lower: 0,
    upper: 1,
    map: (point) => ({
      value: upper + 1 - 1 / point,
      jacobian: 1 / (point * point),
    }),
  };
}

function integrationResult(
  value: number,
  error: number,
  subdivisions: number,
  message: string,
): RValue {
  return withClasses(
    listValue(
      [
        doubleVector([value]),
        doubleVector([error]),
        integerVector([subdivisions]),
        characterVector([message]),
        R_NULL,
      ],
      ["value", "abs.error", "subdivisions", "message", "call"],
    ),
    ["integrate"],
  );
}

function matchIntegrateArguments(invocation: BuiltinInvocation): MatchedNlmArguments {
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
      ["f", "lower", "upper"].includes(argument.name ?? "") ||
      INTEGRATE_CONTROLS.has(argument.name ?? "")
    ) {
      claim(argument.name!, argument, index);
    }
  }
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index) || argument.name === undefined) continue;
    const candidates = ["f", "lower", "upper"].filter((name) =>
      name.startsWith(argument.name ?? ""),
    );
    if (candidates.length === 1) claim(candidates[0]!, argument, index);
  }
  let positional = 0;
  const dots: BuiltinCallArgument[] = [];
  const positionalNames = ["f", "lower", "upper"] as const;
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index)) continue;
    if (argument.name !== undefined) {
      dots.push(argument);
      continue;
    }
    while (positional < positionalNames.length && matched.has(positionalNames[positional]!))
      positional += 1;
    const name = positionalNames[positional];
    if (name === undefined) dots.push(argument);
    else {
      claim(name, argument, index);
      positional += 1;
    }
  }
  return { matched, dots };
}

async function forceRequiredIntegration(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2146", `Argument '${name}' is missing in integrate().`);
  }
  return invocation.force(argument.promise);
}

function integrationBound(value: RValue, name: string): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    Number.isNaN(value.values[0] ?? Number.NaN)
  ) {
    throw new RTypeMismatchError("NRT3468", `integrate() '${name}' must be one numeric value.`);
  }
  return value.values[0] ?? Number.NaN;
}

async function integrationOptionalScalar(
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
    throw new RTypeMismatchError("NRT3468", `integrate() '${name}' must be one finite value.`);
  }
  return value.values[0] ?? fallback;
}

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

interface OptimEvaluation {
  readonly value: number;
  readonly scaledValue: number;
}

async function builtinOptimize(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchOptimizeArguments(invocation);
  const callable = await forceRequiredOptimize(invocation, matched.get("f"), "f");
  if (callable.type !== "closure" && callable.type !== "builtin") {
    throw new RTypeMismatchError("NRT3294", "optimize() 'f' must be a function.");
  }

  let interval: readonly number[] | undefined;
  if (!matched.has("lower") || !matched.has("upper")) {
    interval = optimizeInterval(
      await forceRequiredOptimize(invocation, matched.get("interval"), "interval"),
    );
  }
  const lower = matched.has("lower")
    ? await optimizeScalar(invocation, matched.get("lower"), "lower")
    : Math.min(...interval!);
  const upper = matched.has("upper")
    ? await optimizeScalar(invocation, matched.get("upper"), "upper")
    : Math.max(...interval!);
  if (!Number.isFinite(lower)) {
    throw new RTypeMismatchError("NRT3294", "invalid 'xmin' value");
  }
  if (!Number.isFinite(upper)) {
    throw new RTypeMismatchError("NRT3294", "invalid 'xmax' value");
  }
  if (!(lower < upper)) {
    throw new RTypeMismatchError("NRT3294", "'xmin' not less than 'xmax'");
  }
  const maximum = await optimizeMaximum(invocation, matched.get("maximum"));
  const tolerance = await optimizeTolerance(invocation, matched.get("tol"));

  const invoke = async (point: number): Promise<RValue> => {
    invocation.context.checkpoint();
    return invocation.invokeLazy(callable, [
      {
        promise: createForcedPromise(doubleVector([point]), invocation.currentEnvironment()),
      },
      ...dots,
    ]);
  };
  const evaluate = async (point: number): Promise<number> => {
    const result = await invoke(point);
    if ((result.type !== "integer" && result.type !== "double") || result.length !== 1) {
      throw new RTypeMismatchError("NRT3294", "invalid function value in 'optimize'");
    }
    let value = isMissing(result, 0) ? Number.NaN : (result.values[0] ?? Number.NaN);
    if (maximum) value = -value;
    if (Number.isNaN(value)) {
      invocation.context.warn({
        code: "NRW1149",
        message: "NA/NaN replaced by maximum positive value",
      });
      return Number.MAX_VALUE;
    }
    if (value === Number.POSITIVE_INFINITY) {
      invocation.context.warn({
        code: "NRW1150",
        message: "Inf replaced by maximum positive value",
      });
      return Number.MAX_VALUE;
    }
    if (value === Number.NEGATIVE_INFINITY) {
      invocation.context.warn({
        code: "NRW1151",
        message: "-Inf replaced by maximally negative value",
      });
      return -Number.MAX_VALUE;
    }
    return value;
  };

  const point = await brentMinimum(lower, upper, tolerance, evaluate, invocation);
  const objective = await invoke(point);
  if ((objective.type !== "integer" && objective.type !== "double") || objective.length !== 1) {
    throw new RTypeMismatchError("NRT3294", "invalid function value in 'optimize'");
  }
  return listValue(
    [doubleVector([point]), objective],
    [maximum ? "maximum" : "minimum", "objective"],
  );
}

async function brentMinimum(
  lower: number,
  upper: number,
  tolerance: number,
  evaluate: (point: number) => Promise<number>,
  invocation: BuiltinInvocation,
): Promise<number> {
  const goldenSection = (3 - Math.sqrt(5)) / 2;
  const squareRootEpsilon = Math.sqrt(Number.EPSILON);
  const toleranceThird = tolerance / 3;
  let a = lower;
  let b = upper;
  let v = a + goldenSection * (b - a);
  let w = v;
  let x = v;
  let displacement = 0;
  let previousDisplacement = 0;
  let fx = await evaluate(x);
  let fv = fx;
  let fw = fx;

  for (;;) {
    invocation.context.checkpoint();
    const midpoint = (a + b) / 2;
    const pointTolerance = squareRootEpsilon * Math.abs(x) + toleranceThird;
    const twiceTolerance = 2 * pointTolerance;
    if (Math.abs(x - midpoint) <= twiceTolerance - (b - a) / 2) return x;

    let numerator = 0;
    let denominator = 0;
    let previousStep = 0;
    if (Math.abs(previousDisplacement) > pointTolerance) {
      const first = (x - w) * (fx - fv);
      const second = (x - v) * (fx - fw);
      numerator = (x - v) * second - (x - w) * first;
      denominator = 2 * (second - first);
      if (denominator > 0) numerator = -numerator;
      else denominator = -denominator;
      previousStep = previousDisplacement;
      previousDisplacement = displacement;
    }
    if (
      Math.abs(numerator) >= Math.abs((denominator * previousStep) / 2) ||
      numerator <= denominator * (a - x) ||
      numerator >= denominator * (b - x)
    ) {
      previousDisplacement = x < midpoint ? b - x : a - x;
      displacement = goldenSection * previousDisplacement;
    } else {
      displacement = numerator / denominator;
      const proposed = x + displacement;
      if (proposed - a < twiceTolerance || b - proposed < twiceTolerance) {
        displacement = x < midpoint ? pointTolerance : -pointTolerance;
      }
    }
    const candidate =
      Math.abs(displacement) >= pointTolerance
        ? x + displacement
        : x + (displacement > 0 ? pointTolerance : -pointTolerance);
    const candidateValue = await evaluate(candidate);
    if (candidateValue <= fx) {
      if (candidate < x) b = x;
      else a = x;
      v = w;
      fv = fw;
      w = x;
      fw = fx;
      x = candidate;
      fx = candidateValue;
    } else {
      if (candidate < x) a = candidate;
      else b = candidate;
      if (candidateValue <= fw || w === x) {
        v = w;
        fv = fw;
        w = candidate;
        fw = candidateValue;
      } else if (candidateValue <= fv || v === x || v === w) {
        v = candidate;
        fv = candidateValue;
      }
    }
  }
}

async function builtinUniroot(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchUnirootArguments(invocation);
  const callable = await forceRequiredUniroot(invocation, matched.get("f"), "f");
  if (callable.type !== "closure" && callable.type !== "builtin") {
    throw new RTypeMismatchError("NRT3293", "uniroot() 'f' must be a function.");
  }
  const intervalArgument = matched.get("interval");
  const interval =
    intervalArgument === undefined
      ? undefined
      : unirootInterval(await invocation.force(intervalArgument.promise));
  if (
    interval === undefined &&
    (matched.get("lower") === undefined || matched.get("upper") === undefined)
  ) {
    throw new REvaluationError("NRE2146", "Argument 'interval' is missing in uniroot().");
  }
  let lower = await unirootOptionalScalar(
    invocation,
    matched.get("lower"),
    interval === undefined ? 0 : Math.min(...interval),
    "lower",
  );
  let upper = await unirootOptionalScalar(
    invocation,
    matched.get("upper"),
    interval === undefined ? 0 : Math.max(...interval),
    "upper",
  );
  if (!(lower < upper)) {
    throw new RTypeMismatchError("NRT3293", "uniroot() requires lower < upper.");
  }
  const tolerance = await unirootOptionalScalar(
    invocation,
    matched.get("tol"),
    Number.EPSILON ** 0.25,
    "tol",
  );
  if (!(tolerance > 0)) {
    throw new RTypeMismatchError("NRT3293", "uniroot() 'tol' must be positive.");
  }
  const maxiter = Math.trunc(
    await unirootOptionalScalar(invocation, matched.get("maxiter"), 1000, "maxiter"),
  );
  if (maxiter < 1 || maxiter > 1_000_000) {
    throw new RTypeMismatchError("NRT3293", "uniroot() 'maxiter' must be a positive integer.");
  }
  const trace = await unirootOptionalScalar(invocation, matched.get("trace"), 0, "trace");
  if (trace !== 0) {
    throw new RUnsupportedFeatureError(
      "NRU6207",
      "uniroot(trace > 0) diagnostic output is outside the browser-safe numeric slice.",
    );
  }
  const checkConvergence = await unirootLogical(invocation, matched.get("check.conv"), false);
  const extend = await unirootExtend(invocation, matched.get("extendInt"));
  const evaluate = async (point: number): Promise<number> => {
    invocation.context.checkpoint();
    const result = await invocation.invokeLazy(callable, [
      {
        promise: createForcedPromise(doubleVector([point]), invocation.currentEnvironment()),
      },
      ...dots,
    ]);
    return unirootFunctionValue(result);
  };

  let fLower = await unirootEndpointValue(invocation, matched.get("f.lower"), lower, evaluate);
  let fUpper = await unirootEndpointValue(invocation, matched.get("f.upper"), upper, evaluate);
  let initialIterations = 0;
  if (fLower * fUpper > 0 && extend !== "no") {
    let step = Math.max(Math.abs(upper - lower) * 0.01, 0.01);
    for (; initialIterations < maxiter && fLower * fUpper > 0; initialIterations += 1) {
      invocation.context.checkpoint();
      if (extend === "yes" || extend === "downX") {
        lower -= step;
        fLower = await evaluate(lower);
      }
      if (fLower * fUpper <= 0) break;
      if (extend === "yes" || extend === "upX") {
        upper += step;
        fUpper = await evaluate(upper);
      }
      step *= 2;
    }
  }
  if (fLower * fUpper > 0) {
    throw new RTypeMismatchError("NRT3293", "f() values at end points not of opposite sign");
  }

  const solved = await brentRoot(
    lower,
    upper,
    fLower,
    fUpper,
    tolerance,
    maxiter,
    evaluate,
    invocation,
  );
  if (!solved.converged) {
    const message = `uniroot() did not converge in ${String(maxiter)} iterations`;
    if (checkConvergence) throw new REvaluationError("NRE2264", message);
    invocation.context.warn({ code: "NRW1145", message });
  }
  // The public contract includes one final evaluation at the selected root. Besides supplying the
  // reported f.root value, this is observable when the callback records calls or has side effects.
  const finalValue = await evaluate(solved.root);
  return listValue(
    [
      doubleVector([solved.root]),
      doubleVector([finalValue]),
      integerVector([solved.iterations]),
      initialIterations === 0 ? missingValue("integer") : integerVector([initialIterations]),
      doubleVector([solved.precision]),
    ],
    ["root", "f.root", "iter", "init.it", "estim.prec"],
  );
}

interface BrentRootResult {
  readonly root: number;
  readonly value: number;
  readonly iterations: number;
  readonly precision: number;
  readonly converged: boolean;
}

async function brentRoot(
  lower: number,
  upper: number,
  fLower: number,
  fUpper: number,
  tolerance: number,
  maxiter: number,
  evaluate: (point: number) => Promise<number>,
  invocation: BuiltinInvocation,
): Promise<BrentRootResult> {
  let a = lower;
  let b = upper;
  let fa = fLower;
  let fb = fUpper;
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  let precision = Math.abs(d);
  for (let iteration = 0; iteration <= maxiter; iteration += 1) {
    invocation.context.checkpoint();
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      const oldB = b;
      const oldFb = fb;
      a = b;
      fa = fb;
      b = c;
      fb = fc;
      c = oldB;
      fc = oldFb;
    }
    const machineTolerance = 2 * Number.EPSILON * Math.abs(b) + tolerance / 2;
    const midpoint = (c - b) / 2;
    precision = Math.abs(c - b);
    if (Math.abs(midpoint) <= machineTolerance || fb === 0) {
      return { root: b, value: fb, iterations: iteration, precision, converged: true };
    }
    if (Math.abs(e) >= machineTolerance && Math.abs(fa) > Math.abs(fb)) {
      const ratio = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * midpoint * ratio;
        q = 1 - ratio;
      } else {
        const q0 = fa / fc;
        const r = fb / fc;
        p = ratio * (2 * midpoint * q0 * (q0 - r) - (b - a) * (r - 1));
        q = (q0 - 1) * (r - 1) * (ratio - 1);
      }
      if (p > 0) q = -q;
      else p = -p;
      const previous = e;
      if (
        2 * p <
        Math.min(3 * midpoint * q - Math.abs(machineTolerance * q), Math.abs(previous * q))
      ) {
        d = p / q;
      } else {
        d = midpoint;
      }
    } else {
      d = midpoint;
    }
    a = b;
    fa = fb;
    const step =
      Math.abs(d) > machineTolerance ? d : midpoint > 0 ? machineTolerance : -machineTolerance;
    b += step;
    // Brent's interpolation safeguard compares against the step actually taken on the preceding
    // iteration. Retaining the pre-interpolation bracket width admits inverse-quadratic steps that
    // the GNU-observed zeroin contract rejects and produces package-visible root drift.
    e = step;
    fb = await evaluate(b);
  }
  return { root: b, value: fb, iterations: maxiter, precision, converged: false };
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

async function builtinNlminb(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchNlminbArguments(invocation);
  const startArgument = requiredNlminbArgument(matched.get("start"), "start");
  const objectiveArgument = requiredNlminbArgument(matched.get("objective"), "objective");
  const start = await invocation.force(startArgument.promise);
  const initial = optimNumericParameters(start);
  const control = await nlminbOptimControl(
    invocation,
    matched.get("control"),
    matched.get("scale"),
    initial.length,
  );
  const environment = invocation.currentEnvironment();
  const arguments_: BuiltinCallArgument[] = [
    { name: "par", promise: startArgument.promise },
    { name: "fn", promise: objectiveArgument.promise },
  ];
  const gradient = matched.get("gradient");
  if (gradient !== undefined) arguments_.push({ name: "gr", promise: gradient.promise });
  arguments_.push(...dots);
  arguments_.push({
    name: "method",
    promise: createForcedPromise(characterVector(["L-BFGS-B"]), environment),
  });
  const lower = matched.get("lower");
  const upper = matched.get("upper");
  if (lower !== undefined) arguments_.push({ name: "lower", promise: lower.promise });
  if (upper !== undefined) arguments_.push({ name: "upper", promise: upper.promise });
  arguments_.push({ name: "control", promise: createForcedPromise(control, environment) });
  const optimInvocation = Object.create(invocation, {
    arguments: { configurable: false, enumerable: true, value: arguments_ },
  }) as BuiltinInvocation;
  const result = await builtinOptim(optimInvocation);
  if (result.type !== "list") {
    throw new REvaluationError("NRE2264", "internal nlminb() optimization result is invalid");
  }
  const names = vectorNames(result) ?? [];
  const element = (name: string): RValue => {
    const index = names.indexOf(name);
    return index < 0 ? R_NULL : (result.values[index] ?? R_NULL);
  };
  const counts = element("counts");
  const iterations =
    counts.type === "integer" || counts.type === "double"
      ? Math.max(0, Math.trunc(counts.values[0] ?? 0))
      : 0;
  return listValue(
    [
      element("par"),
      element("value"),
      element("convergence"),
      integerVector([iterations]),
      counts,
      element("message"),
    ],
    ["par", "objective", "convergence", "iterations", "evaluations", "message"],
  );
}

async function nlminbOptimControl(
  invocation: BuiltinInvocation,
  controlArgument: BuiltinCallArgument | undefined,
  scaleArgument: BuiltinCallArgument | undefined,
  parameterCount: number,
): Promise<RValue> {
  const values: RValue[] = [];
  const names: string[] = [];
  const add = (name: string, value: RValue): void => {
    values.push(value);
    names.push(name);
  };
  if (scaleArgument !== undefined) {
    const scale = await invocation.force(scaleArgument.promise);
    if (
      (scale.type !== "logical" && scale.type !== "integer" && scale.type !== "double") ||
      (scale.length !== 1 && scale.length !== parameterCount)
    ) {
      throw new RTypeMismatchError(
        "NRT3292",
        "nlminb() 'scale' must have length 1 or length(start)",
      );
    }
    const expanded = Array.from({ length: parameterCount }, (_, index) => {
      const sourceIndex = scale.length === 1 ? 0 : index;
      const item = scale.values[sourceIndex] ?? Number.NaN;
      if (isMissing(scale, sourceIndex) || !Number.isFinite(item) || item <= 0) {
        throw new RTypeMismatchError(
          "NRT3292",
          "nlminb() 'scale' must contain positive finite values",
        );
      }
      return item;
    });
    add("parscale", doubleVector(expanded));
  }
  if (controlArgument !== undefined) {
    const control = await invocation.force(controlArgument.promise);
    if (control.type !== "list") {
      throw new RTypeMismatchError("NRT3292", "nlminb() 'control' must be a list");
    }
    const controlNames = vectorNames(control);
    if (control.length > 0 && controlNames === undefined) {
      throw new RTypeMismatchError("NRT3292", "nlminb() control entries must be named");
    }
    for (let index = 0; index < control.length; index += 1) {
      const name = controlNames?.[index] ?? "";
      const value = control.values[index] ?? R_NULL;
      if (name === "iter.max") add("maxit", value);
      else if (name === "rel.tol") {
        const tolerance = nlminbControlScalar(value, name);
        add("factr", doubleVector([tolerance / Number.EPSILON]));
      } else if (name === "trace") add("trace", value);
      else if (
        name === "eval.max" ||
        name === "abs.tol" ||
        name === "x.tol" ||
        name === "xf.tol" ||
        name === "step.min" ||
        name === "step.max" ||
        name === "sing.tol"
      ) {
        continue;
      } else if (name.length > 0) {
        throw new RUnsupportedFeatureError("NRU6145", `nlminb() control '${name}' is unsupported.`);
      }
    }
  }
  return listValue(values, names);
}

function nlminbControlScalar(value: RValue, name: string): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    !Number.isFinite(value.values[0] ?? Number.NaN) ||
    (value.values[0] ?? 0) < 0
  ) {
    throw new RTypeMismatchError("NRT3292", `invalid nlminb() control '${name}'`);
  }
  return value.values[0] ?? 0;
}

function requiredNlminbArgument(
  argument: BuiltinCallArgument | undefined,
  name: "start" | "objective",
): BuiltinCallArgument {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2145", `Argument '${name}' is missing in nlminb().`);
  }
  return argument;
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
  if (
    method !== "BFGS" &&
    method !== "CG" &&
    method !== "L-BFGS-B" &&
    method !== "Nelder-Mead" &&
    method !== "SANN"
  ) {
    throw new RUnsupportedFeatureError(
      "NRU6145",
      `optim(method = "${method}") is outside the BFGS, L-BFGS-B, conjugate-gradient, Nelder-Mead, and simulated-annealing slice.`,
    );
  }
  if (method !== "L-BFGS-B" && (matched.has("lower") || matched.has("upper"))) {
    throw new RUnsupportedFeatureError(
      "NRU6145",
      "optim() box bounds require the unimplemented L-BFGS-B or Brent method.",
    );
  }
  const controlArgument = matched.get("control");
  const { parseOptimControls } = await import("./optimization-controls.js");
  const controls = parseOptimControls(
    controlArgument === undefined ? undefined : await invocation.force(controlArgument.promise),
    initial.length,
    method,
    (value) => vectorNames(value as Parameters<typeof vectorNames>[0]),
    (message) => {
      throw new RTypeMismatchError("NRT3292", message);
    },
    (message) => {
      throw new RUnsupportedFeatureError("NRU6145", message);
    },
  );
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
    const evaluation = objectiveEvaluation(result, scaled.length, true);
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
  if (method === "L-BFGS-B") {
    const backend = invocation.state.get(BOX_OPTIMIZATION_BACKEND_STATE_KEY) as
      BoxOptimizationBackend | undefined;
    if (backend === undefined) {
      throw new RUnsupportedFeatureError(
        "NRU6145",
        'optim(method = "L-BFGS-B") requires the browser L-BFGS-B backend.',
      );
    }
    const lower = matched.get("lower");
    const upper = matched.get("upper");
    const { runLbfgsbOptimization } = await import("./optimization-lbfgsb.js");
    const { optimized, message } = await runLbfgsbOptimization(
      backend,
      scaledPoint,
      lower === undefined ? undefined : await invocation.force(lower.promise),
      upper === undefined ? undefined : await invocation.force(upper.promise),
      controls.parameterScale,
      evaluate,
      gradient,
      controls.lbfgsbMemory,
      controls.lbfgsbReductionFactor,
      controls.lbfgsbProjectedGradientTolerance,
      controls.iterationLimit,
      (message) => {
        throw new RTypeMismatchError("NRT3292", message);
      },
    );
    functionCount = optimized.functionCount;
    gradientCount = optimized.gradientCount;
    const resultParameters = Array.from(
      optimized.point,
      (item, index) => item * (controls.parameterScale[index] ?? 1),
    );
    let hessian: readonly number[] | undefined;
    if (returnHessian) {
      hessian = await optimGradientHessian(
        Array.from(optimized.point),
        gradient,
        controls,
        invocation,
      );
    }
    return optimResult(
      resultParameters,
      parameterNames,
      optimized.value * controls.functionScale,
      functionCount,
      gradientCount,
      optimized.converged ? 0 : 1,
      hessian,
      message,
    );
  }
  let evaluation = await evaluate(scaledPoint, true);
  if (!Number.isFinite(evaluation.value)) {
    throw new RTypeMismatchError("NRT3292", "initial value in 'vmmin' is not finite");
  }
  if (method === "SANN") {
    const optimized = await simulatedAnnealing(
      scaledPoint,
      evaluation,
      evaluate,
      gradientFunction,
      dots,
      parameterVector,
      controls,
      invocation,
    );
    scaledPoint = [...optimized.point];
    evaluation = optimized.evaluation;
    const resultParameters = scaledPoint.map(
      (item, index) => item * (controls.parameterScale[index] ?? 1),
    );
    let hessian: readonly number[] | undefined;
    if (returnHessian) {
      hessian =
        gradientFunction === undefined
          ? await optimNumericalHessian(
              resultParameters,
              evaluation.value,
              evaluate,
              controls,
              invocation,
            )
          : await optimGradientHessian(scaledPoint, gradient, controls, invocation);
    }
    return optimResult(
      resultParameters,
      parameterNames,
      evaluation.value,
      controls.iterationLimit === 0 ? 0 : functionCount,
      undefined,
      0,
      hessian,
    );
  }
  if (method === "Nelder-Mead") {
    if (scaledPoint.length === 1) {
      invocation.context.warn({
        code: "NRW1148",
        message:
          'one-dimensional optimization by Nelder-Mead is unreliable:\nuse "Brent" or optimize() directly',
      });
    }
    const optimized = await nelderMead(scaledPoint, evaluation, evaluate, controls, invocation);
    const resultParameters = optimized.point.map(
      (item, index) => item * (controls.parameterScale[index] ?? 1),
    );
    let hessian: readonly number[] | undefined;
    if (returnHessian) {
      hessian = await optimNumericalHessian(
        resultParameters,
        optimized.evaluation.value,
        evaluate,
        controls,
        invocation,
      );
    }
    return optimResult(
      resultParameters,
      parameterNames,
      optimized.evaluation.value,
      functionCount,
      undefined,
      optimized.convergence,
      hessian,
    );
  }
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
  if (method === "CG") {
    const optimized = await conjugateGradient(
      scaledPoint,
      evaluation,
      evaluate,
      gradient,
      controls,
      invocation,
    );
    scaledPoint = [...optimized.point];
    evaluation = optimized.evaluation;
    const resultParameters = scaledPoint.map(
      (item, index) => item * (controls.parameterScale[index] ?? 1),
    );
    let hessian: readonly number[] | undefined;
    if (returnHessian) {
      hessian = await optimNumericalHessian(
        resultParameters,
        evaluation.value,
        evaluate,
        controls,
        invocation,
      );
    }
    return optimResult(
      resultParameters,
      parameterNames,
      evaluation.value,
      functionCount,
      gradientCount,
      optimized.convergence,
      hessian,
    );
  }
  let currentGradient = await gradient(scaledPoint);
  let inverseHessian = identityMatrix(scaledPoint.length);
  let convergence = 1;
  let completedIterations = 0;
  if (controls.trace > 0) {
    invocation.context.writeOutput({
      stream: "stdout",
      text: `initial  value ${evaluation.value.toFixed(6)} \n`,
    });
  }

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
    completedIterations = iteration + 1;
    if (controls.trace > 0 && completedIterations % controls.report === 0) {
      invocation.context.writeOutput({
        stream: "stdout",
        text: `iter ${String(completedIterations + 1).padStart(3)} value ${evaluation.value.toFixed(6)}\n`,
      });
    }
    if (
      evaluation.scaledValue <= controls.absoluteTolerance ||
      Math.abs(previousScaledValue - evaluation.scaledValue) <=
        controls.relativeTolerance * (Math.abs(previousScaledValue) + controls.relativeTolerance)
    ) {
      convergence = 0;
      break;
    }
  }

  if (controls.trace > 0) {
    invocation.context.writeOutput({
      stream: "stdout",
      text: `final  value ${evaluation.value.toFixed(6)} \n${
        convergence === 0 ? "converged" : `stopped after ${String(completedIterations)} iterations`
      }\n`,
    });
  }

  const resultParameters = scaledPoint.map(
    (item, index) => item * (controls.parameterScale[index] ?? 1),
  );
  let hessian: readonly number[] | undefined;
  if (returnHessian) {
    hessian = await optimNumericalHessian(
      resultParameters,
      evaluation.value,
      evaluate,
      controls,
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

interface SimulatedAnnealingResult {
  readonly point: readonly number[];
  readonly evaluation: OptimEvaluation;
}

async function simulatedAnnealing(
  initial: readonly number[],
  initialEvaluation: OptimEvaluation,
  evaluate: (point: readonly number[], count: boolean) => Promise<OptimEvaluation>,
  proposalFunction: RValue | undefined,
  dots: readonly BuiltinCallArgument[],
  parameterVector: (scaled: readonly number[]) => RValue,
  controls: OptimControls,
  invocation: BuiltinInvocation,
): Promise<SimulatedAnnealingResult> {
  let point = [...initial];
  let evaluation = initialEvaluation;
  const random = randomState(invocation);
  const temperatureBlock = Math.max(1, Math.trunc(controls.temperatureIterations));
  for (let iteration = 1; iteration < controls.iterationLimit; iteration += 1) {
    invocation.context.checkpoint();
    const temperature =
      controls.temperature /
      Math.log(Math.floor((iteration - 1) / temperatureBlock) * temperatureBlock + Math.E);
    let candidate: readonly number[];
    if (proposalFunction !== undefined) {
      const proposed = await invocation.invokeLazy(proposalFunction, [
        {
          promise: createForcedPromise(parameterVector(point), invocation.currentEnvironment()),
        },
        ...dots,
      ]);
      const values = numericAttribute(proposed, point.length);
      if (values === undefined) {
        throw new RTypeMismatchError(
          "NRT3292",
          `optim() SANN candidate must return ${String(point.length)} finite values.`,
        );
      }
      candidate = values.map((item, index) => item / (controls.parameterScale[index] ?? 1));
    } else {
      candidate = point.map((item) => item + temperature * nextNormal(random));
    }
    const candidateEvaluation = await evaluate(candidate, true);
    const increase = candidateEvaluation.scaledValue - evaluation.scaledValue;
    if (increase <= 0 || nextRandom(random) < Math.exp(-increase / temperature)) {
      point = [...candidate];
      evaluation = candidateEvaluation;
    }
  }
  return { point, evaluation };
}

interface ConjugateGradientResult {
  readonly point: readonly number[];
  readonly evaluation: OptimEvaluation;
  readonly convergence: number;
}

async function conjugateGradient(
  initial: readonly number[],
  initialEvaluation: OptimEvaluation,
  evaluate: (point: readonly number[], count: boolean) => Promise<OptimEvaluation>,
  gradient: (point: readonly number[]) => Promise<readonly number[]>,
  controls: OptimControls,
  invocation: BuiltinInvocation,
): Promise<ConjugateGradientResult> {
  let point = [...initial];
  let evaluation = initialEvaluation;
  let currentGradient = await gradient(point);
  let direction = negate(currentGradient);
  let convergence = 1;
  for (let iteration = 0; iteration < controls.iterationLimit; iteration += 1) {
    invocation.context.checkpoint();
    if (Math.max(...currentGradient.map(Math.abs)) <= controls.relativeTolerance) {
      convergence = 0;
      break;
    }
    let directionalDerivative = dot(currentGradient, direction);
    if (directionalDerivative >= 0 || !Number.isFinite(directionalDerivative)) {
      direction = negate(currentGradient);
      directionalDerivative = -dot(currentGradient, currentGradient);
    }
    let step = 1;
    let candidate: readonly number[] | undefined;
    let candidateEvaluation: OptimEvaluation | undefined;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const proposed = point.map((item, index) => item + step * (direction[index] ?? 0));
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
    const previousValue = evaluation.scaledValue;
    const denominator = dot(currentGradient, currentGradient);
    const gradientChange = nextGradient.map((item, index) => item - (currentGradient[index] ?? 0));
    let beta = 0;
    if (denominator > 0 && Number.isFinite(denominator)) {
      if (controls.conjugateGradientType === 1) {
        beta = dot(nextGradient, nextGradient) / denominator;
      } else if (controls.conjugateGradientType === 2) {
        beta = dot(nextGradient, gradientChange) / denominator;
      } else {
        const bealeSorensonDenominator = dot(direction, gradientChange);
        beta =
          bealeSorensonDenominator === 0
            ? 0
            : dot(nextGradient, gradientChange) / bealeSorensonDenominator;
      }
    }
    if (!Number.isFinite(beta) || beta < 0 || (iteration + 1) % Math.max(point.length, 1) === 0) {
      beta = 0;
    }
    const nextDirection = nextGradient.map((item, index) => -item + beta * (direction[index] ?? 0));
    point = [...candidate];
    evaluation = candidateEvaluation;
    currentGradient = nextGradient;
    direction = dot(nextDirection, currentGradient) < 0 ? nextDirection : negate(currentGradient);
    if (
      evaluation.scaledValue <= controls.absoluteTolerance ||
      Math.abs(previousValue - evaluation.scaledValue) <=
        controls.relativeTolerance * (Math.abs(previousValue) + controls.relativeTolerance)
    ) {
      convergence = 0;
      break;
    }
  }
  return { point, evaluation, convergence };
}

function optimResult(
  parameters: readonly number[],
  parameterNames: readonly string[] | undefined,
  value: number,
  functionCount: number,
  gradientCount: number | undefined,
  convergence: number,
  hessian: readonly number[] | undefined,
  message: string | undefined = undefined,
): RValue {
  const parameterVector = doubleVector(parameters);
  const values: RValue[] = [
    parameterNames === undefined ? parameterVector : withNames(parameterVector, parameterNames),
    doubleVector([value]),
    withNames(
      integerVector(
        [functionCount, gradientCount ?? 0],
        gradientCount === undefined ? new Uint8Array([0, 1]) : undefined,
      ),
      ["function", "gradient"],
    ),
    integerVector([convergence]),
    message === undefined ? R_NULL : characterVector([message]),
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

interface NelderMeadResult {
  readonly point: readonly number[];
  readonly evaluation: OptimEvaluation;
  readonly convergence: number;
}

async function nelderMead(
  initial: readonly number[],
  initialEvaluation: OptimEvaluation,
  evaluate: (point: readonly number[], count: boolean) => Promise<OptimEvaluation>,
  controls: OptimControls,
  invocation: BuiltinInvocation,
): Promise<NelderMeadResult> {
  if (initial.length === 0 || controls.iterationLimit === 0) {
    return { point: initial, evaluation: initialEvaluation, convergence: 0 };
  }
  const simplex: { point: number[]; evaluation: OptimEvaluation }[] = [
    { point: [...initial], evaluation: initialEvaluation },
  ];
  for (let axis = 0; axis < initial.length; axis += 1) {
    const point = [...initial];
    const coordinate = point[axis] ?? 0;
    point[axis] = coordinate + (coordinate === 0 ? 0.1 : 0.1 * Math.abs(coordinate));
    simplex.push({ point, evaluation: await optimSafeEvaluation(point, evaluate) });
  }

  let convergence = 1;
  for (let iteration = 0; iteration < controls.iterationLimit; iteration += 1) {
    invocation.context.checkpoint();
    simplex.sort((left, right) => left.evaluation.scaledValue - right.evaluation.scaledValue);
    const best = simplex[0]!;
    const worst = simplex[simplex.length - 1]!;
    const spread = worst.evaluation.scaledValue - best.evaluation.scaledValue;
    if (
      best.evaluation.scaledValue <= controls.absoluteTolerance ||
      spread <=
        controls.relativeTolerance *
          (Math.abs(best.evaluation.scaledValue) + controls.relativeTolerance)
    ) {
      convergence = 0;
      break;
    }

    const centroid = Array.from(
      { length: initial.length },
      (_, axis) =>
        simplex.slice(0, -1).reduce((total, vertex) => total + (vertex.point[axis] ?? 0), 0) /
        initial.length,
    );
    const reflected = centroid.map(
      (value, axis) => value + controls.reflection * (value - (worst.point[axis] ?? 0)),
    );
    const reflectedEvaluation = await optimSafeEvaluation(reflected, evaluate);
    if (reflectedEvaluation.scaledValue < best.evaluation.scaledValue) {
      const expanded = centroid.map(
        (value, axis) => value + controls.expansion * (reflected[axis]! - value),
      );
      const expandedEvaluation = await optimSafeEvaluation(expanded, evaluate);
      simplex[simplex.length - 1] =
        expandedEvaluation.scaledValue < reflectedEvaluation.scaledValue
          ? { point: expanded, evaluation: expandedEvaluation }
          : { point: reflected, evaluation: reflectedEvaluation };
      continue;
    }

    const secondWorst = simplex[simplex.length - 2]!;
    if (reflectedEvaluation.scaledValue < secondWorst.evaluation.scaledValue) {
      simplex[simplex.length - 1] = { point: reflected, evaluation: reflectedEvaluation };
      continue;
    }

    const outside = reflectedEvaluation.scaledValue < worst.evaluation.scaledValue;
    const contracted = outside
      ? centroid.map((value, axis) => value + controls.contraction * (reflected[axis]! - value))
      : centroid.map(
          (value, axis) => value + controls.contraction * ((worst.point[axis] ?? 0) - value),
        );
    const contractedEvaluation = await optimSafeEvaluation(contracted, evaluate);
    const contractionLimit = outside
      ? reflectedEvaluation.scaledValue
      : worst.evaluation.scaledValue;
    if (contractedEvaluation.scaledValue < contractionLimit) {
      simplex[simplex.length - 1] = { point: contracted, evaluation: contractedEvaluation };
      continue;
    }

    for (let index = 1; index < simplex.length; index += 1) {
      const shrunk = best.point.map(
        (value, axis) =>
          value + controls.contraction * ((simplex[index]!.point[axis] ?? 0) - value),
      );
      simplex[index] = { point: shrunk, evaluation: await optimSafeEvaluation(shrunk, evaluate) };
    }
  }
  simplex.sort((left, right) => left.evaluation.scaledValue - right.evaluation.scaledValue);
  return { point: simplex[0]!.point, evaluation: simplex[0]!.evaluation, convergence };
}

async function optimSafeEvaluation(
  point: readonly number[],
  evaluate: (point: readonly number[], count: boolean) => Promise<OptimEvaluation>,
): Promise<OptimEvaluation> {
  try {
    return await evaluate(point, true);
  } catch (error) {
    if (!(error instanceof RTypeMismatchError) || error.code !== "NRT3291") throw error;
    return { value: Number.POSITIVE_INFINITY, scaledValue: Number.POSITIVE_INFINITY };
  }
}

async function optimNumericalHessian(
  parameters: readonly number[],
  value: number,
  evaluate: (point: readonly number[], count: boolean) => Promise<OptimEvaluation>,
  controls: OptimControls,
  invocation: BuiltinInvocation,
): Promise<readonly number[]> {
  const hessianControls: NlmControls = {
    returnHessian: true,
    typicalSize: controls.parameterScale,
    functionScale: Math.max(Math.abs(value), 1),
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
  return numericalHessian(parameters, { value }, evaluateOriginal, hessianControls, invocation);
}

async function optimGradientHessian(
  scaledParameters: readonly number[],
  gradient: (point: readonly number[]) => Promise<readonly number[]>,
  controls: OptimControls,
  invocation: BuiltinInvocation,
): Promise<readonly number[]> {
  const length = scaledParameters.length;
  const hessian = new Array<number>(length * length).fill(0);
  for (let column = 0; column < length; column += 1) {
    invocation.context.checkpoint();
    const step = controls.derivativeSteps[column] ?? 1e-3;
    const high = [...scaledParameters];
    const low = [...scaledParameters];
    high[column] = (high[column] ?? 0) + step;
    low[column] = (low[column] ?? 0) - step;
    const highGradient = await gradient(high);
    const lowGradient = await gradient(low);
    for (let row = 0; row < length; row += 1) {
      const scaledDerivative = ((highGradient[row] ?? 0) - (lowGradient[row] ?? 0)) / (2 * step);
      hessian[row + column * length] =
        (scaledDerivative * controls.functionScale) /
        ((controls.parameterScale[row] ?? 1) * (controls.parameterScale[column] ?? 1));
    }
  }
  for (let column = 0; column < length; column += 1) {
    for (let row = column + 1; row < length; row += 1) {
      const symmetric =
        ((hessian[row + column * length] ?? 0) + (hessian[column + row * length] ?? 0)) / 2;
      hessian[row + column * length] = symmetric;
      hessian[column + row * length] = symmetric;
    }
  }
  return hessian;
}

function matchUnirootArguments(invocation: BuiltinInvocation): MatchedNlmArguments {
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
      argument.name === "f" ||
      argument.name === "interval" ||
      UNIROOT_CONTROLS.has(argument.name ?? "")
    ) {
      claim(argument.name!, argument, index);
    }
  }
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index) || argument.name === undefined) continue;
    const candidates = ["f", "interval"].filter((name) => name.startsWith(argument.name ?? ""));
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
    const positionalNames = ["f", "interval"] as const;
    while (positional < positionalNames.length && matched.has(positionalNames[positional]!)) {
      positional += 1;
    }
    const name = positionalNames[positional];
    if (name === undefined) dots.push(argument);
    else {
      claim(name, argument, index);
      positional += 1;
    }
  }
  return { matched, dots };
}

function matchOptimizeArguments(invocation: BuiltinInvocation): MatchedNlmArguments {
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
      argument.name === "f" ||
      argument.name === "interval" ||
      OPTIMIZE_CONTROLS.has(argument.name ?? "")
    ) {
      claim(argument.name!, argument, index);
    }
  }
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index) || argument.name === undefined) continue;
    const candidates = ["f", "interval"].filter((name) => name.startsWith(argument.name ?? ""));
    if (candidates.length === 1) claim(candidates[0]!, argument, index);
  }
  let positional = 0;
  const dots: BuiltinCallArgument[] = [];
  const positionalNames = ["f", "interval"] as const;
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
    if (name === undefined) dots.push(argument);
    else {
      claim(name, argument, index);
      positional += 1;
    }
  }
  return { matched, dots };
}

async function forceRequiredOptimize(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2146", `Argument '${name}' is missing in optimize().`);
  }
  return invocation.force(argument.promise);
}

function optimizeInterval(value: RValue): readonly number[] {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0
  ) {
    throw new RTypeMismatchError("NRT3294", "optimize() 'interval' must be numeric.");
  }
  return Array.from({ length: value.length }, (_, index) =>
    isMissing(value, index) ? Number.NaN : (value.values[index] ?? Number.NaN),
  );
}

async function optimizeScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2146", `Argument '${name}' is missing in optimize().`);
  }
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError(
      "NRT3294",
      `invalid '${name === "lower" ? "xmin" : "xmax"}' value`,
    );
  }
  return value.values[0] ?? Number.NaN;
}

async function optimizeMaximum(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return false;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0
  ) {
    throw new RTypeMismatchError("NRT3294", "argument is not interpretable as logical");
  }
  if (isMissing(value, 0) || Number.isNaN(value.values[0] ?? Number.NaN)) {
    throw new RTypeMismatchError("NRT3294", "missing value where TRUE/FALSE needed");
  }
  return (value.values[0] ?? 0) !== 0;
}

async function optimizeTolerance(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return Number.EPSILON ** 0.25;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3294", "invalid 'tol' value");
  }
  const tolerance = value.values[0] ?? Number.NaN;
  if (!(tolerance > 0) || !Number.isFinite(tolerance)) {
    throw new RTypeMismatchError("NRT3294", "invalid 'tol' value");
  }
  return tolerance;
}

async function forceRequiredUniroot(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2146", `Argument '${name}' is missing in uniroot().`);
  }
  return invocation.force(argument.promise);
}

function unirootInterval(value: RValue): readonly [number, number] {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 2 ||
    isMissing(value, 0) ||
    isMissing(value, 1)
  ) {
    throw new RTypeMismatchError("NRT3293", "uniroot() 'interval' must be two finite values.");
  }
  const lower = value.values[0] ?? Number.NaN;
  const upper = value.values[1] ?? Number.NaN;
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    throw new RTypeMismatchError("NRT3293", "uniroot() 'interval' must be two finite values.");
  }
  return [lower, upper];
}

async function unirootOptionalScalar(
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
    throw new RTypeMismatchError("NRT3293", `uniroot() '${name}' must be one finite value.`);
  }
  return value.values[0] ?? fallback;
}

async function unirootLogical(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
): Promise<boolean> {
  return logicalControl(invocation, argument, fallback, "check.conv");
}

async function unirootExtend(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<"no" | "yes" | "downX" | "upX"> {
  if (argument === undefined || argument.promise.missing) return "no";
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length === 0 || isMissing(value, 0)) {
    throw new RTypeMismatchError(
      "NRT3293",
      "uniroot() 'extendInt' must select one character value.",
    );
  }
  const requested = value.values[0] ?? "";
  const choices = ["no", "yes", "downX", "upX"] as const;
  const exact = choices.find((choice) => choice === requested);
  if (exact !== undefined) return exact;
  const matches = choices.filter((choice) => choice.startsWith(requested));
  if (matches.length === 1) return matches[0]!;
  throw new RTypeMismatchError("NRT3293", `uniroot() has invalid extendInt value '${requested}'.`);
}

async function unirootEndpointValue(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  point: number,
  evaluate: (point: number) => Promise<number>,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return evaluate(point);
  return unirootFunctionValue(await invocation.force(argument.promise));
}

function unirootFunctionValue(value: RValue): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3293", "uniroot() f() must return one numeric value.");
  }
  const result = value.values[0] ?? Number.NaN;
  if (Number.isNaN(result)) {
    throw new RTypeMismatchError("NRT3293", "uniroot() f() returned a missing value.");
  }
  return result;
}

function matchNlminbArguments(invocation: BuiltinInvocation): MatchedNlmArguments {
  const matched = new Map<string, BuiltinCallArgument>();
  const resolved = new Set<number>();
  const leading = ["start", "objective", "gradient", "hessian"] as const;
  const claim = (name: string, argument: BuiltinCallArgument, index: number): void => {
    if (matched.has(name)) {
      throw new REvaluationError("NRE2102", `Argument '${name}' matched more than once.`);
    }
    matched.set(name, argument);
    resolved.add(index);
  };
  for (const [index, argument] of invocation.arguments.entries()) {
    if (
      leading.includes(argument.name as (typeof leading)[number]) ||
      NLMINB_CONTROLS.has(argument.name ?? "")
    ) {
      claim(argument.name!, argument, index);
    }
  }
  for (const [index, argument] of invocation.arguments.entries()) {
    if (resolved.has(index) || argument.name === undefined) continue;
    const candidates = [...leading, ...NLMINB_CONTROLS].filter((name) =>
      name.startsWith(argument.name ?? ""),
    );
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
    while (positional < leading.length && matched.has(leading[positional]!)) positional += 1;
    const name = leading[positional];
    if (name === undefined) dots.push(argument);
    else {
      claim(name, argument, index);
      positional += 1;
    }
  }
  return { matched, dots };
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

function objectiveEvaluation(
  value: RValue,
  parameterCount: number,
  allowNonFinite = false,
): ObjectiveEvaluation {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3291", "nlm() objective must return one numeric value.");
  }
  const objective = value.values[0] ?? Number.NaN;
  if (!allowNonFinite && !Number.isFinite(objective)) {
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
