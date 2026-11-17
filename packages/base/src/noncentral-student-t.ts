type TailProbability = (value: number, lowerTail: boolean) => number;

/** Non-central Student-t probability from an adaptive expectation over its chi-square scale. */
export function noncentralStudentTProbability(
  studentTProbability: (value: number, degreesOfFreedom: number, lowerTail: boolean) => number,
  normalProbability: TailProbability,
  logGamma: (value: number) => number,
  value: number,
  degreesOfFreedom: number,
  noncentrality: number,
  lowerTail: boolean,
  checkpoint?: () => void,
): number {
  if (
    Number.isNaN(value) ||
    Number.isNaN(degreesOfFreedom) ||
    Number.isNaN(noncentrality) ||
    degreesOfFreedom <= 0
  ) {
    return Number.NaN;
  }
  if (value === Number.NEGATIVE_INFINITY) return lowerTail ? 0 : 1;
  if (value === Number.POSITIVE_INFINITY) return lowerTail ? 1 : 0;
  if (noncentrality === Number.POSITIVE_INFINITY) return lowerTail ? 0 : 1;
  if (noncentrality === Number.NEGATIVE_INFINITY) return lowerTail ? 1 : 0;
  if (noncentrality === 0) return studentTProbability(value, degreesOfFreedom, lowerTail);
  if (degreesOfFreedom === Number.POSITIVE_INFINITY || degreesOfFreedom >= 1e4) {
    return normalProbability(value - noncentrality, lowerTail);
  }
  if (value === 0) return normalProbability(-noncentrality, lowerTail);

  const shape = degreesOfFreedom / 2;
  const logNormalizer = shape * Math.LN2 + logGamma(shape);
  const integrand = (point: number): number => {
    const complement = 1 - point;
    const chiSquare = (degreesOfFreedom * point) / complement;
    const logDensity = (shape - 1) * Math.log(chiSquare) - chiSquare / 2 - logNormalizer;
    const logJacobian = Math.log(degreesOfFreedom) - 2 * Math.log(complement);
    const normal = normalProbability(
      value * Math.sqrt(chiSquare / degreesOfFreedom) - noncentrality,
      lowerTail,
    );
    return normal === 0 ? 0 : Math.exp(logDensity + logJacobian) * normal;
  };
  return Math.max(0, Math.min(1, adaptiveUnitIntegral(integrand, checkpoint)));
}

interface NumericIntegrationInterval {
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
  0.0229353220105292, 0.0630920926299785, 0.1047900103222502, 0.1406532597155259,
  0.1690047266392679, 0.1903505780647854, 0.2044329400752989, 0.2094821410847278,
] as const;
const GAUSS_WEIGHTS = [
  0.1294849661688697, 0.2797053914892766, 0.3818300505051189, 0.4179591836734694,
] as const;

function adaptiveUnitIntegral(
  integrand: (point: number) => number,
  checkpoint?: () => void,
): number {
  const initial = gaussKronrodInterval(0, 1, integrand);
  const intervals: NumericIntegrationInterval[] = [initial];
  let value = initial.value;
  let error = initial.error;
  while (intervals.length < 512 && error > Math.max(2e-13, 2e-12 * Math.abs(value))) {
    checkpoint?.();
    let selected = 0;
    for (let index = 1; index < intervals.length; index += 1) {
      if ((intervals[index]?.error ?? 0) > (intervals[selected]?.error ?? 0)) selected = index;
    }
    const current = intervals[selected]!;
    const midpoint = current.lower + (current.upper - current.lower) / 2;
    const left = gaussKronrodInterval(current.lower, midpoint, integrand);
    const right = gaussKronrodInterval(midpoint, current.upper, integrand);
    intervals.splice(selected, 1, left, right);
    value += left.value + right.value - current.value;
    error += left.error + right.error - current.error;
  }
  return value;
}

function gaussKronrodInterval(
  lower: number,
  upper: number,
  integrand: (point: number) => number,
): NumericIntegrationInterval {
  const midpoint = lower + (upper - lower) / 2;
  const halfWidth = (upper - lower) / 2;
  const center = integrand(midpoint);
  let kronrod = center * KRONROD_WEIGHTS[7];
  let gauss = center * GAUSS_WEIGHTS[3];
  for (let index = 0; index < KRONROD_NODES.length; index += 1) {
    const offset = halfWidth * KRONROD_NODES[index]!;
    const pair = integrand(midpoint - offset) + integrand(midpoint + offset);
    kronrod += pair * KRONROD_WEIGHTS[index]!;
    if (index % 2 === 1) gauss += pair * GAUSS_WEIGHTS[(index - 1) / 2]!;
  }
  const value = kronrod * halfWidth;
  return { lower, upper, value, error: Math.abs(value - gauss * halfWidth) };
}
