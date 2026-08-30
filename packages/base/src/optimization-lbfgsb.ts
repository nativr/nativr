import type { BoxOptimizationBackend, BoxOptimizationResult } from "./box-optimization.js";

interface NumericBoundValue {
  readonly type: string;
  readonly length: number;
  readonly values: ArrayLike<number>;
  readonly missing?: ArrayLike<number>;
}

export async function runLbfgsbOptimization(
  backend: BoxOptimizationBackend,
  initial: readonly number[],
  lowerValue: unknown,
  upperValue: unknown,
  parameterScale: readonly number[],
  evaluate: (point: readonly number[], count: boolean) => Promise<{ readonly scaledValue: number }>,
  gradient: (point: readonly number[]) => Promise<readonly number[]>,
  memory: number,
  relativeReductionFactor: number,
  projectedGradientTolerance: number,
  maxIterations: number,
  invalid: (message: string) => never,
): Promise<{ readonly optimized: BoxOptimizationResult; readonly message: string }> {
  const lower = bounds(
    lowerValue,
    initial.length,
    Number.NEGATIVE_INFINITY,
    "lower",
    parameterScale,
    invalid,
  );
  const upper = bounds(
    upperValue,
    initial.length,
    Number.POSITIVE_INFINITY,
    "upper",
    parameterScale,
    invalid,
  );
  const point = Float64Array.from(initial);
  for (let index = 0; index < point.length; index += 1) {
    if ((lower[index] ?? 0) > (upper[index] ?? 0)) invalid("optim() requires lower <= upper.");
    point[index] = Math.max(lower[index] ?? 0, Math.min(upper[index] ?? 0, point[index] ?? 0));
  }
  const optimized = await backend.minimize(
    point,
    lower,
    upper,
    async (candidate) => {
      const values = Array.from(candidate);
      return {
        value: (await evaluate(values, false)).scaledValue,
        gradient: Float64Array.from(await gradient(values)),
      };
    },
    {
      memory,
      relativeReductionFactor,
      projectedGradientTolerance,
      maxIterations: Math.max(1, maxIterations),
      maxEvaluations: 100_000,
    },
  );
  return { optimized, message: message(optimized.reason) };
}

function bounds(
  value: unknown,
  length: number,
  fallback: number,
  name: "lower" | "upper",
  parameterScale: readonly number[],
  invalid: (message: string) => never,
): Float64Array {
  if (value === undefined) return new Float64Array(length).fill(fallback);
  if (
    !isNumericBoundValue(value) ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0
  ) {
    invalid(`optim() '${name}' must be a numeric vector.`);
  }
  return Float64Array.from({ length }, (_, index) => {
    const source = index % value.length;
    if (value.missing?.[source] === 1) return fallback;
    const bound = value.values[source] ?? fallback;
    return Number.isNaN(bound) ? fallback : bound / (parameterScale[index] ?? 1);
  });
}

function isNumericBoundValue(value: unknown): value is NumericBoundValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "length" in value &&
    "values" in value
  );
}

function message(reason: BoxOptimizationResult["reason"]): string {
  switch (reason) {
    case "projected-gradient":
      return "CONVERGENCE: NORM OF PROJECTED GRADIENT <= PGTOL";
    case "relative-reduction":
      return "CONVERGENCE: REL_REDUCTION_OF_F <= FACTR*EPSMCH";
    case "iteration-limit":
      return "STOP: TOTAL NO. OF ITERATIONS REACHED LIMIT";
    case "evaluation-limit":
      return "STOP: TOTAL NO. OF F,G EVALUATIONS EXCEEDS LIMIT";
    default:
      return "ERROR: ABNORMAL_TERMINATION_IN_LNSRCH";
  }
}
