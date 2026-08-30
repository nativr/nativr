import {
  REvaluationError,
  RTypeMismatchError,
  doubleVector,
  isAtomic,
  isMissing,
  listValue,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

type RealVector = Extract<RValue, { readonly type: "logical" | "integer" | "double" }>;

export const SUPSMU_BUILTIN_SPEC = {
  name: "supsmu",
  parameters: ["x", "y", "wt", "span", "periodic", "bass", "trace"] as const,
  compatibility: "numeric" as const,
  implementation: builtinSupsmu,
};

async function builtinSupsmu(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, SUPSMU_BUILTIN_SPEC.parameters);
  const x = numbers(await requiredArgument(invocation, parsed.matched.get("x"), "x"), "x");
  const y = numbers(await requiredArgument(invocation, parsed.matched.get("y"), "y"), "y");
  if (x.length !== y.length || x.length < 5) {
    throw new RTypeMismatchError("NRT3454", "supsmu() requires at least five paired observations");
  }
  const weightArgument = parsed.matched.get("wt");
  const weights =
    weightArgument === undefined || weightArgument.promise.missing
      ? Float64Array.from(x, () => 1)
      : numbers(await invocation.force(weightArgument.promise), "wt");
  if (weights.length !== x.length) {
    throw new RTypeMismatchError("NRT3454", "'wt' must have the same length as 'x'");
  }
  const periodic = await logicalScalar(
    invocation,
    parsed.matched.get("periodic"),
    false,
    "periodic",
  );
  if (periodic) {
    throw new REvaluationError(
      "NRE2291",
      "supsmu(periodic = TRUE) is outside the current browser-admissible numeric contract",
    );
  }
  const bass = await numericScalar(invocation, parsed.matched.get("bass"), 0, "bass");
  if (!Number.isFinite(bass) || bass < 0 || bass > 10) {
    throw new RTypeMismatchError("NRT3454", "'bass' must be finite and between 0 and 10");
  }
  // trace affects diagnostic output in GNU R; force it even though NativR does not expose the
  // implementation's internal iteration transcript.
  await logicalScalar(invocation, parsed.matched.get("trace"), false, "trace");

  const rows = Array.from(x, (coordinate, index) => ({
    x: coordinate,
    y: y[index] ?? Number.NaN,
    weight: weights[index] ?? Number.NaN,
    index,
  }));
  if (rows.some((row) => !Number.isFinite(row.x) || !Number.isFinite(row.y) || !(row.weight > 0))) {
    throw new RTypeMismatchError(
      "NRT3454",
      "supsmu() requires finite coordinates, finite responses, and positive weights",
    );
  }
  rows.sort((left, right) => left.x - right.x || left.index - right.index);
  const sortedX = Float64Array.from(rows, (row) => row.x);
  const sortedY = Float64Array.from(rows, (row) => row.y);
  const sortedWeights = Float64Array.from(rows, (row) => row.weight);
  const span = await supsmuSpan(invocation, parsed.matched.get("span"));
  const fitted =
    span === "cv"
      ? superSmooth(sortedX, sortedY, sortedWeights, bass, invocation)
      : runningLineSmooth(sortedX, sortedY, sortedWeights, span, invocation);
  invocation.context.allocate(Math.max(1, sortedX.length * 5));
  return listValue([doubleVector(sortedX), doubleVector(fitted)], ["x", "y"]);
}

async function requiredArgument(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in supsmu().`);
  }
  return invocation.force(argument.promise);
}

function realVector(value: RValue, name: string): RealVector {
  if (
    !isAtomic(value) ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double")
  ) {
    throw new RTypeMismatchError("NRT3454", `supsmu() requires '${name}' to be numeric`);
  }
  return value;
}

function numbers(value: RValue, name: string): Float64Array {
  const vector = realVector(value, name);
  return Float64Array.from({ length: vector.length }, (_, index) => {
    if (isMissing(vector, index)) return Number.NaN;
    const entry = vector.values[index];
    return vector.type === "logical" ? ((entry ?? 0) !== 0 ? 1 : 0) : (entry ?? Number.NaN);
  });
}

async function numericScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = numbers(await invocation.force(argument.promise), name);
  return value.length === 0 ? Number.NaN : (value[0] ?? Number.NaN);
}

async function logicalScalar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = numbers(await invocation.force(argument.promise), name);
  if (value.length === 0 || !Number.isFinite(value[0] ?? Number.NaN)) {
    throw new RTypeMismatchError("NRT3454", `'${name}' must be TRUE or FALSE`);
  }
  return value[0] !== 0;
}

async function supsmuSpan(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number | "cv"> {
  if (argument === undefined || argument.promise.missing) return "cv";
  const value = await invocation.force(argument.promise);
  if (value.type === "character") {
    if (value.length === 1 && value.missing === undefined && value.values[0] === "cv") return "cv";
    throw new RTypeMismatchError("NRT3454", `'span' must be "cv" or a number in (0, 1]`);
  }
  const span = numbers(value, "span")[0] ?? Number.NaN;
  if (!Number.isFinite(span) || span <= 0 || span > 1) {
    throw new RTypeMismatchError("NRT3454", `'span' must be "cv" or a number in (0, 1]`);
  }
  return span;
}

function superSmooth(
  x: Float64Array,
  y: Float64Array,
  weights: Float64Array,
  bass: number,
  invocation: BuiltinInvocation,
): Float64Array {
  const candidates = [0.05, 0.2, 0.5] as const;
  const fitted = candidates.map((span) => runningLineSmooth(x, y, weights, span, invocation));
  const errors = fitted.map((curve) =>
    Float64Array.from(curve, (estimate, index) => Math.abs((y[index] ?? 0) - estimate)),
  );
  const smoothedErrors = errors.map((error) =>
    runningLineSmooth(x, error, weights, 0.2, invocation),
  );
  const selectedSpans = Float64Array.from({ length: x.length }, (_, index) => {
    let best = 0;
    for (let candidate = 1; candidate < candidates.length; candidate += 1) {
      if (
        (smoothedErrors[candidate]?.[index] ?? Infinity) <
        (smoothedErrors[best]?.[index] ?? Infinity)
      ) {
        best = candidate;
      }
    }
    const selected = candidates[best] ?? 0.2;
    return selected + ((0.5 - selected) * bass) / 10;
  });
  const spanCurve = runningLineSmooth(x, selectedSpans, weights, 0.2, invocation);
  return Float64Array.from({ length: x.length }, (_, index) =>
    localLinearEstimate(x, y, weights, index, spanCurve[index] ?? 0.2),
  );
}

function runningLineSmooth(
  x: Float64Array,
  y: Float64Array,
  weights: Float64Array,
  span: number,
  invocation: BuiltinInvocation,
): Float64Array {
  return Float64Array.from({ length: x.length }, (_, index) => {
    invocation.context.checkpoint();
    return localLinearEstimate(x, y, weights, index, span);
  });
}

function localLinearEstimate(
  x: Float64Array,
  y: Float64Array,
  weights: Float64Array,
  target: number,
  span: number,
): number {
  const count = x.length;
  const window = Math.min(count, Math.max(5, Math.trunc(span * count + 0.5)));
  const half = Math.floor(window / 2);
  const left = Math.max(0, Math.min(target - half, count - window));
  const right = left + window;
  let totalWeight = 0;
  let meanX = 0;
  let meanY = 0;
  for (let index = left; index < right; index += 1) {
    const weight = weights[index] ?? 0;
    totalWeight += weight;
    meanX += weight * (x[index] ?? 0);
    meanY += weight * (y[index] ?? 0);
  }
  if (!(totalWeight > 0)) return y[target] ?? Number.NaN;
  meanX /= totalWeight;
  meanY /= totalWeight;
  let covariance = 0;
  let variance = 0;
  for (let index = left; index < right; index += 1) {
    const weight = weights[index] ?? 0;
    const centeredX = (x[index] ?? 0) - meanX;
    covariance += weight * centeredX * ((y[index] ?? 0) - meanY);
    variance += weight * centeredX * centeredX;
  }
  return variance > 0 ? meanY + (covariance / variance) * ((x[target] ?? meanX) - meanX) : meanY;
}
