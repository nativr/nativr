import {
  REvaluationError,
  RTypeMismatchError,
  doubleVector,
  isAtomic,
  isMissing,
  listValue,
  vectorDimensions,
  vectorNames,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

type RealVector = Extract<RValue, { readonly type: "logical" | "integer" | "double" }>;

export interface LowessBuiltinSpec {
  readonly name: "lowess";
  readonly parameters: readonly ["x", "y", "f", "iter", "delta"];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

export const LOWESS_BUILTIN_SPEC: LowessBuiltinSpec = {
  name: "lowess",
  parameters: ["x", "y", "f", "iter", "delta"],
  compatibility: "numeric",
  implementation: builtinLowess,
};

async function builtinLowess(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, ["x", "y", "f", "iter", "delta"]);
  const xArgument = parsed.matched.get("x");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in lowess().");
  }
  const xValue = await invocation.force(xArgument.promise);
  const yArgument = parsed.matched.get("y");
  const yValue =
    yArgument === undefined || yArgument.promise.missing
      ? undefined
      : await invocation.force(yArgument.promise);
  const coordinates = lowessCoordinates(xValue, yValue);
  const order = Array.from({ length: coordinates.x.length }, (_, index) => index).sort(
    (left, right) =>
      compareLowessCoordinates(coordinates.x[left]!, coordinates.x[right]!, left, right),
  );
  const x = Float64Array.from(order, (index) => coordinates.x[index]!);
  const y = Float64Array.from(order, (index) => coordinates.y[index]!);

  const f = await lowessScalarArgument(invocation, parsed.matched.get("f"), 2 / 3, "f");
  if (!Number.isFinite(f) || f <= 0) {
    throw new RTypeMismatchError("NRT3453", "'f' must be finite and > 0");
  }
  const rawIterations = await lowessScalarArgument(
    invocation,
    parsed.matched.get("iter"),
    3,
    "iter",
  );
  if (!Number.isFinite(rawIterations) || rawIterations < 0) {
    throw new RTypeMismatchError("NRT3453", "'iter' must be finite and >= 0");
  }
  const iterations = Math.trunc(rawIterations);
  const defaultDelta = lowessDefaultDelta(x);
  const delta = await lowessScalarArgument(
    invocation,
    parsed.matched.get("delta"),
    defaultDelta,
    "delta",
  );
  if (!Number.isFinite(delta) || delta < 0) {
    throw new RTypeMismatchError("NRT3453", "'delta' must be finite and > 0");
  }

  invocation.context.allocate(Math.max(1, x.length * 5));
  const fitted = lowessFit(x, y, f, iterations, delta, invocation);
  return listValue([doubleVector(x), doubleVector(fitted)], ["x", "y"]);
}

function lowessCoordinates(
  xValue: RValue,
  yValue: RValue | undefined,
): { readonly x: Float64Array; readonly y: Float64Array } {
  if (yValue !== undefined && yValue.type !== "null") {
    const x = lowessRealVector(xValue, "x");
    const y = lowessRealVector(yValue, "y");
    if (x.length !== y.length) {
      throw new RTypeMismatchError("NRT3453", "'x' and 'y' lengths differ");
    }
    return { x: lowessNumbers(x), y: lowessNumbers(y) };
  }

  if (xValue.type === "list") {
    const names = vectorNames(xValue) ?? [];
    const xIndex = names.indexOf("x");
    const yIndex = names.indexOf("y");
    if (xIndex !== -1 && yIndex !== -1) {
      const x = lowessRealVector(xValue.values[xIndex]!, "x$x");
      const y = lowessRealVector(xValue.values[yIndex]!, "x$y");
      if (x.length !== y.length) {
        throw new RTypeMismatchError("NRT3453", "'x' and 'y' lengths differ");
      }
      return { x: lowessNumbers(x), y: lowessNumbers(y) };
    }
  }

  const input = lowessRealVector(xValue, "x");
  const dimensions = vectorDimensions(input);
  if (dimensions?.length === 2 && (dimensions[1] ?? 0) >= 2) {
    const rows = dimensions[0] ?? 0;
    return {
      x: Float64Array.from({ length: rows }, (_, row) => lowessNumberAt(input, row)),
      y: Float64Array.from({ length: rows }, (_, row) => lowessNumberAt(input, row + rows)),
    };
  }
  return {
    x: Float64Array.from({ length: input.length }, (_, index) => index + 1),
    y: lowessNumbers(input),
  };
}

function lowessRealVector(value: RValue, name: string): RealVector {
  if (
    !isAtomic(value) ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double")
  ) {
    throw new RTypeMismatchError("NRT3453", `lowess() requires '${name}' to be numeric`);
  }
  return value;
}

function lowessNumbers(value: RealVector): Float64Array {
  return Float64Array.from({ length: value.length }, (_, index) => lowessNumberAt(value, index));
}

function lowessNumberAt(value: RealVector, index: number): number {
  if (isMissing(value, index)) return Number.NaN;
  const entry = value.values[index];
  if (value.type === "logical") return (entry ?? 0) !== 0 ? 1 : 0;
  return entry ?? Number.NaN;
}

async function lowessScalarArgument(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = lowessRealVector(await invocation.force(argument.promise), name);
  if (value.length === 0 || isMissing(value, 0)) return Number.NaN;
  return lowessNumberAt(value, 0);
}

function compareLowessCoordinates(
  left: number,
  right: number,
  leftIndex: number,
  rightIndex: number,
) {
  const leftFinite = Number.isFinite(left);
  const rightFinite = Number.isFinite(right);
  if (leftFinite && rightFinite) return left - right || leftIndex - rightIndex;
  if (leftFinite) return -1;
  if (rightFinite) return 1;
  if (Number.isNaN(left) && !Number.isNaN(right)) return 1;
  if (!Number.isNaN(left) && Number.isNaN(right)) return -1;
  return leftIndex - rightIndex;
}

function lowessDefaultDelta(x: Float64Array): number {
  if (x.length === 0) return Number.NaN;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const value of x) {
    if (Number.isNaN(value)) return Number.NaN;
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  return 0.01 * (maximum - minimum);
}

function lowessFit(
  x: Float64Array,
  y: Float64Array,
  f: number,
  iterations: number,
  delta: number,
  invocation: BuiltinInvocation,
): Float64Array<ArrayBuffer> {
  const count = x.length;
  if (count <= 1) return y.slice();
  const neighborhood = Math.max(2, Math.min(count, Math.floor(f * count + 1e-7)));
  let robustWeights = Float64Array.from({ length: count }, () => 1);
  let fitted = y.slice();
  const residualTolerance =
    1e-12 * Math.max(1, ...Array.from(y, (value) => Math.abs(value)).filter(Number.isFinite));
  for (let iteration = 0; iteration <= iterations; iteration += 1) {
    fitted = lowessIteration(x, y, neighborhood, robustWeights, delta, invocation);
    if (iteration === iterations) break;
    const residuals = Float64Array.from({ length: count }, (_, index) => {
      const residual = Math.abs((y[index] ?? Number.NaN) - (fitted[index] ?? Number.NaN));
      return residual <= residualTolerance ? 0 : residual;
    });
    const ordered = Array.from(residuals).sort((left, right) => left - right);
    const middle = Math.floor(count / 2);
    const median =
      count % 2 === 1
        ? (ordered[middle] ?? Number.NaN)
        : ((ordered[middle - 1] ?? Number.NaN) + (ordered[middle] ?? Number.NaN)) / 2;
    const scale = 6 * median;
    if (!(scale > 0)) break;
    robustWeights = Float64Array.from(residuals, (residual) => {
      if (Number.isNaN(residual) || Number.isNaN(scale)) return 0;
      if (residual <= 0.001 * scale) return 1;
      if (residual > 0.999 * scale) return 0;
      const ratio = residual / scale;
      return (1 - ratio * ratio) ** 2;
    });
  }
  return fitted;
}

function lowessIteration(
  x: Float64Array,
  y: Float64Array,
  neighborhood: number,
  robustWeights: Float64Array,
  delta: number,
  invocation: BuiltinInvocation,
): Float64Array<ArrayBuffer> {
  const count = x.length;
  const fitted = new Float64Array(count);
  let left = 0;
  let right = neighborhood - 1;
  let last = -1;
  let current = 0;
  while (true) {
    invocation.context.checkpoint();
    while (
      right < count - 1 &&
      (x[current] ?? Number.NaN) - (x[left] ?? Number.NaN) >
        (x[right + 1] ?? Number.NaN) - (x[current] ?? Number.NaN)
    ) {
      left += 1;
      right += 1;
    }
    fitted[current] = lowessLocalEstimate(x, y, robustWeights, current, left, right);
    if (last >= 0 && last < current - 1) {
      const denominator = (x[current] ?? Number.NaN) - (x[last] ?? Number.NaN);
      for (let index = last + 1; index < current; index += 1) {
        const alpha =
          denominator === 0
            ? 0
            : ((x[index] ?? Number.NaN) - (x[last] ?? Number.NaN)) / denominator;
        fitted[index] = alpha * (fitted[current] ?? 0) + (1 - alpha) * (fitted[last] ?? 0);
      }
    }
    last = current;
    if (last >= count - 1) break;
    const cut = (x[last] ?? Number.NaN) + delta;
    current = last + 1;
    while (current < count && (x[current] ?? Number.NaN) <= cut) {
      if (x[current] === x[last]) {
        fitted[current] = fitted[last] ?? Number.NaN;
        last = current;
      }
      current += 1;
    }
    current = Math.max(last + 1, current - 1);
  }
  return fitted;
}

function lowessLocalEstimate(
  x: Float64Array,
  y: Float64Array,
  robustWeights: Float64Array,
  target: number,
  left: number,
  right: number,
): number {
  const targetX = x[target] ?? Number.NaN;
  if (!Number.isFinite(targetX)) return y[target] ?? Number.NaN;
  const radius = Math.max(targetX - (x[left] ?? targetX), (x[right] ?? targetX) - targetX);
  const weights = new Float64Array(x.length);
  let total = 0;
  for (let index = left; index < x.length; index += 1) {
    const distance = Math.abs((x[index] ?? Number.NaN) - targetX);
    if (!Number.isFinite(distance) || distance > radius) break;
    const kernel =
      radius === 0 || distance <= 0.001 * radius
        ? 1
        : distance > 0.999 * radius
          ? 0
          : (1 - (distance / radius) ** 3) ** 3;
    const weight = kernel * (robustWeights[index] ?? 0);
    weights[index] = weight;
    total += weight;
  }
  if (!(total > 0)) return y[target] ?? Number.NaN;
  for (let index = left; index < x.length; index += 1) {
    if ((weights[index] ?? 0) === 0) continue;
    weights[index] = (weights[index] ?? 0) / total;
  }
  let meanX = 0;
  for (let index = left; index < x.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight === 0) continue;
    meanX += weight * (x[index] ?? 0);
  }
  let variance = 0;
  for (let index = left; index < x.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight === 0) continue;
    const centered = (x[index] ?? 0) - meanX;
    variance += weight * centered * centered;
  }
  const range = (x[x.length - 1] ?? Number.NaN) - (x[0] ?? Number.NaN);
  if (Math.sqrt(variance) > 0.001 * Math.abs(range)) {
    const slopeFactor = (targetX - meanX) / variance;
    for (let index = left; index < x.length; index += 1) {
      if ((weights[index] ?? 0) === 0) continue;
      weights[index] = (weights[index] ?? 0) * (1 + slopeFactor * ((x[index] ?? 0) - meanX));
    }
  }
  let estimate = 0;
  for (let index = left; index < x.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight === 0) continue;
    estimate += weight * (y[index] ?? Number.NaN);
  }
  return estimate;
}
