import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  characterVector,
  deparseAst,
  doubleVector,
  integerVector,
  isFactor,
  isMissing,
  listValue,
  logicalVector,
  withClasses,
  withNames,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

export interface DensityBuiltinSpec {
  readonly name: "density" | "density.default";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric" | "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

const DENSITY_DEFAULT_PARAMETERS = [
  "x",
  "bw",
  "adjust",
  "kernel",
  "weights",
  "window",
  "width",
  "give.Rkern",
  "subdensity",
  "warnWbw",
  "n",
  "from",
  "to",
  "cut",
  "ext",
  "old.coords",
  "na.rm",
  "...",
] as const;

export const DENSITY_BUILTIN_SPECS: readonly DensityBuiltinSpec[] = [
  {
    name: "density",
    parameters: ["x", "..."],
    compatibility: "behavioral",
    implementation: builtinDensity,
  },
  {
    name: "density.default",
    parameters: DENSITY_DEFAULT_PARAMETERS,
    compatibility: "numeric",
    implementation: builtinDensityDefault,
  },
];

async function builtinDensity(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x", "..."]);
  const inputArgument = parsed.matched.get("x");
  if (inputArgument === undefined || inputArgument.promise.missing) {
    throw new REvaluationError("NRE2143", "Argument 'x' is missing in density().");
  }
  const input = await invocation.force(inputArgument.promise);
  const dispatched = await invocation.dispatchS3IfPresent("density", input, invocation.arguments);
  return dispatched ?? builtinDensityDefault(invocation);
}

async function builtinDensityDefault(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, DENSITY_DEFAULT_PARAMETERS);
  const inputArgument = parsed.matched.get("x");
  const input = await forceRequired(invocation, inputArgument, "x");
  if (input.type !== "logical" && input.type !== "integer" && input.type !== "double") {
    throw new RTypeMismatchError("NRT3281", "density.default() requires a numeric vector.");
  }
  if (isFactor(input)) {
    throw new RTypeMismatchError("NRT3281", "density.default() requires a numeric vector.");
  }

  const removeMissing = await densityFlag(invocation, parsed.matched.get("na.rm"), false, "na.rm");
  const observations: number[] = [];
  const retainedIndices: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    invocation.context.checkpoint();
    const value = input.values[index] ?? 0;
    if (isMissing(input, index) || Number.isNaN(value)) {
      if (!removeMissing) {
        throw new RTypeMismatchError("NRT3281", "'x' contains missing values.");
      }
      continue;
    }
    if (!Number.isFinite(value)) {
      throw new RUnsupportedFeatureError(
        "NRU6136",
        "density.default() infinite point masses are outside the current numeric path.",
      );
    }
    observations.push(value);
    retainedIndices.push(index);
  }
  if (observations.length === 0) {
    throw new RTypeMismatchError("NRT3281", "density.default() has no finite observations.");
  }

  const kernel = await densityKernel(invocation, parsed.matched);
  const giveKernel = await densityFlag(
    invocation,
    parsed.matched.get("give.Rkern"),
    false,
    "give.Rkern",
  );
  if (giveKernel) {
    invocation.context.allocate(1);
    return doubleVector([densityKernelRoughness(kernel)]);
  }
  if (kernel !== "gaussian" && kernel !== "epanechnikov") {
    throw new RUnsupportedFeatureError(
      "NRU6136",
      `density.default(kernel='${kernel}') is outside the current Gaussian and Epanechnikov paths.`,
    );
  }

  const adjust = await densityPositiveScalar(invocation, parsed.matched.get("adjust"), 1, "adjust");
  const bandwidth =
    (await densityBandwidth(invocation, parsed.matched.get("bw"), observations)) * adjust;
  const pointCount = await densityPointCount(invocation, parsed.matched.get("n"));
  const cut = await densityNonNegativeScalar(invocation, parsed.matched.get("cut"), 3, "cut");
  const minimum = Math.min(...observations);
  const maximum = Math.max(...observations);
  const from = await densityFiniteScalar(
    invocation,
    parsed.matched.get("from"),
    minimum - cut * bandwidth,
    "from",
  );
  const to = await densityFiniteScalar(
    invocation,
    parsed.matched.get("to"),
    maximum + cut * bandwidth,
    "to",
  );
  if (!(from < to)) {
    throw new RTypeMismatchError("NRT3281", "density.default() requires 'from' < 'to'.");
  }

  const weights = await densityWeights(
    invocation,
    parsed.matched.get("weights"),
    input.length,
    retainedIndices,
    observations.length,
  );
  const subdensity = await densityFlag(
    invocation,
    parsed.matched.get("subdensity"),
    false,
    "subdensity",
  );
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  if (!subdensity && Math.abs(weightSum - 1) > 1e-7) {
    invocation.context.warn({
      code: "NRW1014",
      message: "sum(weights) != 1 -- will not get true density",
    });
  }

  invocation.context.allocate(pointCount * 2);
  const x = new Float64Array(pointCount);
  const y = new Float64Array(pointCount);
  const spacing = pointCount === 1 ? 0 : (to - from) / (pointCount - 1);
  const normalizer = bandwidth * (kernel === "gaussian" ? Math.sqrt(2 * Math.PI) : 1);
  for (let point = 0; point < pointCount; point += 1) {
    const coordinate = from + point * spacing;
    x[point] = coordinate;
    let estimate = 0;
    for (let index = 0; index < observations.length; index += 1) {
      invocation.context.checkpoint();
      const standardized = (coordinate - (observations[index] ?? 0)) / bandwidth;
      estimate +=
        (weights[index] ?? 0) *
        (kernel === "gaussian"
          ? Math.exp(-0.5 * standardized * standardized)
          : epanechnikovKernelValue(standardized));
    }
    y[point] = estimate / normalizer;
  }

  const call = invocation.currentCall();
  const dataName =
    inputArgument?.promise.expression === null || inputArgument?.promise.expression === undefined
      ? "x"
      : deparseAst(inputArgument.promise.expression);
  return withClasses(
    withNames(
      listValue([
        doubleVector(x),
        doubleVector(y),
        doubleVector([bandwidth]),
        integerVector([observations.length]),
        call,
        characterVector([dataName]),
        logicalVector([false]),
      ]),
      ["x", "y", "bw", "n", "call", "data.name", "has.na"],
    ),
    ["density"],
  );
}

function epanechnikovKernelValue(standardized: number): number {
  const radius = Math.sqrt(5);
  if (Math.abs(standardized) >= radius) return 0;
  return (3 / (4 * radius)) * (1 - (standardized * standardized) / 5);
}

function densityKernelRoughness(kernel: string): number {
  switch (kernel) {
    case "gaussian":
      return 1 / (2 * Math.sqrt(Math.PI));
    case "epanechnikov":
      return 3 / (5 * Math.sqrt(5));
    default:
      throw new RUnsupportedFeatureError(
        "NRU6136",
        `density.default(kernel='${kernel}', give.Rkern=TRUE) is outside the current Gaussian and Epanechnikov paths.`,
      );
  }
}

async function forceRequired(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2143", `Argument '${name}' is missing in density.default().`);
  }
  return invocation.force(argument.promise);
}

async function densityKernel(
  invocation: BuiltinInvocation,
  matched: ReadonlyMap<string, BuiltinCallArgument>,
): Promise<string> {
  const argument = matched.get("window") ?? matched.get("kernel");
  if (argument === undefined) return "gaussian";
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length < 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3281", "density.default() kernel must be character.");
  }
  const requested = value.values[0] ?? "";
  const kernels = [
    "gaussian",
    "epanechnikov",
    "rectangular",
    "triangular",
    "biweight",
    "cosine",
    "optcosine",
  ];
  const matches = kernels.filter((candidate) => candidate.startsWith(requested));
  if (matches.length !== 1) {
    throw new RTypeMismatchError("NRT3281", "density.default() kernel is not a unique choice.");
  }
  return matches[0] ?? "gaussian";
}

async function densityBandwidth(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  observations: readonly number[],
): Promise<number> {
  if (argument === undefined) return normalReferenceBandwidth(observations);
  const value = await invocation.force(argument.promise);
  if (value.type === "character") {
    if (value.length < 1 || isMissing(value, 0)) {
      throw new RTypeMismatchError("NRT3281", "density.default() has an invalid bandwidth.");
    }
    const selector = (value.values[0] ?? "").toLowerCase();
    if (!"nrd0".startsWith(selector) || selector.length === 0) {
      throw new RUnsupportedFeatureError(
        "NRU6136",
        `density.default(bw='${selector}') is outside the initial nrd0 selector.`,
      );
    }
    return normalReferenceBandwidth(observations);
  }
  return densityPositiveValue(value, "bw");
}

function normalReferenceBandwidth(observations: readonly number[]): number {
  const sorted = [...observations].sort((left, right) => left - right);
  const mean = observations.reduce((sum, value) => sum + value, 0) / observations.length;
  const variance =
    observations.length < 2
      ? Number.NaN
      : observations.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        (observations.length - 1);
  const high = Math.sqrt(variance);
  let low = Math.min(high, (quantileType7(sorted, 0.75) - quantileType7(sorted, 0.25)) / 1.34);
  if (!(low > 0)) {
    low = high > 0 ? high : Math.abs(observations[0] ?? 0) || 1;
  }
  return 0.9 * low * observations.length ** -0.2;
}

function quantileType7(sorted: readonly number[], probability: number): number {
  if (sorted.length === 1) return sorted[0] ?? 0;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return (
    (sorted[lower] ?? 0) +
    fraction * ((sorted[Math.min(lower + 1, sorted.length - 1)] ?? 0) - (sorted[lower] ?? 0))
  );
}

async function densityWeights(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  inputLength: number,
  retainedIndices: readonly number[],
  retainedLength: number,
): Promise<number[]> {
  if (argument === undefined) {
    return Array.from({ length: retainedLength }, () => 1 / retainedLength);
  }
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== inputLength
  ) {
    throw new RTypeMismatchError(
      "NRT3281",
      "density.default() weights must be numeric and match 'x'.",
    );
  }
  return retainedIndices.map((index) => {
    if (isMissing(value, index)) {
      throw new RTypeMismatchError("NRT3281", "density.default() weights contain missing values.");
    }
    const weight = value.values[index] ?? 0;
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RTypeMismatchError(
        "NRT3281",
        "density.default() weights must be finite and non-negative.",
      );
    }
    return weight;
  });
}

async function densityPointCount(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number> {
  if (argument === undefined) return 512;
  const value = await invocation.force(argument.promise);
  const count = densityNumericFirst(value, "n");
  const truncated = Math.trunc(count);
  if (!Number.isSafeInteger(truncated) || truncated < 2) {
    throw new RTypeMismatchError("NRT3281", "density.default() 'n' must be at least 2.");
  }
  return truncated;
}

async function densityFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError(
      "NRT3281",
      `density.default() '${name}' must be one logical value.`,
    );
  }
  return value.values[0] === 1;
}

async function densityPositiveScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined) return fallback;
  return densityPositiveValue(await invocation.force(argument.promise), name);
}

function densityPositiveValue(value: RValue, name: string): number {
  const result = densityNumericFirst(value, name);
  if (!Number.isFinite(result) || result <= 0) {
    throw new RTypeMismatchError(
      "NRT3281",
      `density.default() '${name}' must be finite and positive.`,
    );
  }
  return result;
}

async function densityNonNegativeScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined) return fallback;
  const result = densityNumericFirst(await invocation.force(argument.promise), name);
  if (!Number.isFinite(result) || result < 0) {
    throw new RTypeMismatchError(
      "NRT3281",
      `density.default() '${name}' must be finite and non-negative.`,
    );
  }
  return result;
}

async function densityFiniteScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined) return fallback;
  const result = densityNumericFirst(await invocation.force(argument.promise), name);
  if (!Number.isFinite(result)) {
    throw new RTypeMismatchError(
      "NRT3281",
      `density.default() '${name}' must be one finite value.`,
    );
  }
  return result;
}

function densityNumericFirst(value: RValue, name: string): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length < 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError(
      "NRT3281",
      `density.default() '${name}' must be numeric and non-missing.`,
    );
  }
  return value.values[0] ?? Number.NaN;
}
