const LANCZOS_COEFFICIENTS = [
  0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
  12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
] as const;

const LOG_SQRT_TWO_PI = 0.9189385332046727;
const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);

/**
 * Central Student-t lower-tail probability.
 *
 * This implementation is NativR-owned and uses the regularized incomplete beta identity rather
 * than a host statistics library.
 */
export function studentTCdf(value: number, degreesOfFreedom: number): number {
  return studentTProbability(value, degreesOfFreedom, true);
}

/** Central Student-t lower- or upper-tail probability without avoidable tail cancellation. */
export function studentTProbability(
  value: number,
  degreesOfFreedom: number,
  lowerTail: boolean,
): number {
  if (Number.isNaN(value) || degreesOfFreedom <= 0 || Number.isNaN(degreesOfFreedom)) {
    return Number.NaN;
  }
  if (value === Number.NEGATIVE_INFINITY) return lowerTail ? 0 : 1;
  if (value === Number.POSITIVE_INFINITY) return lowerTail ? 1 : 0;
  if (degreesOfFreedom === Number.POSITIVE_INFINITY) {
    return normalProbability(value, lowerTail);
  }
  if (value === 0) return 0.5;
  const tail = studentTUpperTail(Math.abs(value), degreesOfFreedom);
  return lowerTail === value > 0 ? 1 - tail : tail;
}

/** Non-central chi-square probability from its Poisson mixture of central chi-square laws. */
export function noncentralChiSquareProbability(
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
    degreesOfFreedom < 0 ||
    noncentrality < 0
  ) {
    return Number.NaN;
  }
  if (noncentrality === 0) {
    if (value <= 0) return lowerTail ? 0 : 1;
    if (value === Number.POSITIVE_INFINITY) return lowerTail ? 1 : 0;
    if (degreesOfFreedom === 0) return lowerTail ? 1 : 0;
    if (!Number.isFinite(degreesOfFreedom)) return Number.NaN;
    return regularizedGammaProbability(value / 2, degreesOfFreedom / 2, lowerTail);
  }
  if (!Number.isFinite(noncentrality) || !Number.isFinite(degreesOfFreedom)) return Number.NaN;
  if (value < 0) return lowerTail ? 0 : 1;
  if (value === Number.POSITIVE_INFINITY) return lowerTail ? 1 : 0;
  return poissonMixtureProbability(
    noncentrality / 2,
    (index) => {
      const degree = degreesOfFreedom + 2 * index;
      if (value === 0 && degree === 0) return lowerTail ? 1 : 0;
      if (value <= 0) return lowerTail ? 0 : 1;
      return regularizedGammaProbability(value / 2, degree / 2, lowerTail);
    },
    checkpoint,
  );
}

/** Non-central chi-square density from the same bounded Poisson mixture. */
export function noncentralChiSquareDensity(
  value: number,
  degreesOfFreedom: number,
  noncentrality: number,
  checkpoint?: () => void,
): number {
  if (
    Number.isNaN(value) ||
    Number.isNaN(degreesOfFreedom) ||
    Number.isNaN(noncentrality) ||
    degreesOfFreedom < 0 ||
    noncentrality < 0 ||
    !Number.isFinite(noncentrality)
  ) {
    return Number.NaN;
  }
  if (value < 0 || value === Number.POSITIVE_INFINITY) return 0;
  if (!Number.isFinite(degreesOfFreedom)) return Number.NaN;
  return poissonMixtureValue(
    noncentrality / 2,
    (index) => centralChiSquareDensity(value, degreesOfFreedom + 2 * index),
    checkpoint,
  );
}

/** Non-central F probability from the non-central beta Poisson mixture. */
export function noncentralFProbability(
  value: number,
  numeratorDegrees: number,
  denominatorDegrees: number,
  noncentrality: number,
  lowerTail: boolean,
  checkpoint?: () => void,
): number {
  if (
    Number.isNaN(value) ||
    Number.isNaN(numeratorDegrees) ||
    Number.isNaN(denominatorDegrees) ||
    Number.isNaN(noncentrality) ||
    numeratorDegrees <= 0 ||
    denominatorDegrees <= 0 ||
    noncentrality < 0
  ) {
    return Number.NaN;
  }
  if (value <= 0) return lowerTail ? 0 : 1;
  if (value === Number.POSITIVE_INFINITY) return lowerTail ? 1 : 0;
  if (!Number.isFinite(noncentrality) || numeratorDegrees === Number.POSITIVE_INFINITY) {
    return Number.NaN;
  }
  if (denominatorDegrees === Number.POSITIVE_INFINITY) {
    return noncentralChiSquareProbability(
      value * numeratorDegrees,
      numeratorDegrees,
      noncentrality,
      lowerTail,
      checkpoint,
    );
  }
  const ratio = (value * numeratorDegrees) / denominatorDegrees;
  const betaArgument = ratio === Number.POSITIVE_INFINITY ? 1 : ratio / (1 + ratio);
  return poissonMixtureProbability(
    noncentrality / 2,
    (index) =>
      lowerTail
        ? regularizedBeta(betaArgument, numeratorDegrees / 2 + index, denominatorDegrees / 2)
        : regularizedBeta(1 - betaArgument, denominatorDegrees / 2, numeratorDegrees / 2 + index),
    checkpoint,
  );
}

function poissonMixtureProbability(
  mean: number,
  component: (index: number) => number,
  checkpoint?: () => void,
): number {
  return clampProbability(poissonMixtureValue(mean, component, checkpoint));
}

function poissonMixtureValue(
  mean: number,
  component: (index: number) => number,
  checkpoint?: () => void,
): number {
  if (mean === 0) return component(0);
  const mode = Math.floor(mean);
  const modeWeight = Math.exp(-mean + mode * Math.log(mean) - logGamma(mode + 1));
  let probability = modeWeight * component(mode);
  let mass = modeWeight;
  let lowerIndex = mode;
  let upperIndex = mode;
  let lowerWeight = modeWeight;
  let upperWeight = modeWeight;
  const maximum = Math.max(100, Math.ceil(18 * Math.sqrt(mean + 1) + 50));
  for (let step = 1; step <= maximum; step += 1) {
    checkpoint?.();
    if (lowerIndex > 0) {
      lowerWeight *= lowerIndex / mean;
      lowerIndex -= 1;
      mass += lowerWeight;
      probability += lowerWeight * component(lowerIndex);
    } else {
      lowerWeight = 0;
    }
    upperIndex += 1;
    upperWeight *= mean / upperIndex;
    mass += upperWeight;
    probability += upperWeight * component(upperIndex);
    if (mass >= 1 - 8 * Number.EPSILON && lowerWeight + upperWeight < 8 * Number.EPSILON) break;
  }
  return probability;
}

function centralChiSquareDensity(value: number, degreesOfFreedom: number): number {
  if (value === 0) {
    if (degreesOfFreedom < 2) return Number.POSITIVE_INFINITY;
    if (degreesOfFreedom === 2) return 0.5;
    return 0;
  }
  if (degreesOfFreedom === 0) return 0;
  const shape = degreesOfFreedom / 2;
  const logDensity = (shape - 1) * Math.log(value) - value / 2 - shape * Math.LN2 - logGamma(shape);
  return Math.exp(logDensity);
}

/**
 * Central Student-t quantile from a lower-tail probability.
 *
 * A monotone bracket over the incomplete-beta CDF avoids unstable closed-form approximations for
 * small degrees of freedom and extreme, but representable, probabilities.
 */
export function studentTQuantile(probability: number, degreesOfFreedom: number): number {
  if (
    Number.isNaN(probability) ||
    probability < 0 ||
    probability > 1 ||
    degreesOfFreedom <= 0 ||
    Number.isNaN(degreesOfFreedom)
  ) {
    return Number.NaN;
  }
  if (probability === 0) return Number.NEGATIVE_INFINITY;
  if (probability === 1) return Number.POSITIVE_INFINITY;
  if (probability === 0.5) return 0;
  if (degreesOfFreedom === Number.POSITIVE_INFINITY) return normalQuantile(probability);

  const lowerHalf = probability < 0.5;
  const targetTail = lowerHalf ? probability : 1 - probability;
  let low = 0;
  let high = Math.max(1, Math.abs(normalQuantile(targetTail)));
  while (studentTUpperTail(high, degreesOfFreedom) > targetTail && high < Number.MAX_VALUE / 2) {
    low = high;
    high *= 2;
  }
  if (!Number.isFinite(high))
    return lowerHalf ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (let iteration = 0; iteration < 160; iteration += 1) {
    const middle = low + (high - low) / 2;
    const tail = studentTUpperTail(middle, degreesOfFreedom);
    if (tail > targetTail) low = middle;
    else high = middle;
    if (high - low <= 8 * Number.EPSILON * Math.max(1, middle)) break;
  }
  const magnitude = low + (high - low) / 2;
  return lowerHalf ? -magnitude : magnitude;
}

function studentTUpperTail(absoluteValue: number, degreesOfFreedom: number): number {
  if (absoluteValue === Number.POSITIVE_INFINITY) return 0;
  const squared = absoluteValue * absoluteValue;
  const betaArgument = Number.isFinite(squared)
    ? degreesOfFreedom / (degreesOfFreedom + squared)
    : 0;
  return 0.5 * regularizedBeta(betaArgument, degreesOfFreedom / 2, 0.5);
}

export function regularizedBeta(value: number, alpha: number, beta: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  const logarithm =
    logGamma(alpha + beta) -
    logGamma(alpha) -
    logGamma(beta) +
    alpha * Math.log(value) +
    beta * Math.log1p(-value);
  const factor = Math.exp(logarithm);
  if (value < (alpha + 1) / (alpha + beta + 2)) {
    return clampProbability((factor * betaContinuedFraction(value, alpha, beta)) / alpha);
  }
  return clampProbability(1 - (factor * betaContinuedFraction(1 - value, beta, alpha)) / beta);
}

function betaContinuedFraction(value: number, alpha: number, beta: number): number {
  const maximumIterations = 300;
  const minimum = 1e-300;
  const epsilon = 4 * Number.EPSILON;
  const sum = alpha + beta;
  const alphaPlusOne = alpha + 1;
  const alphaMinusOne = alpha - 1;
  let c = 1;
  let d = 1 - (sum * value) / alphaPlusOne;
  if (Math.abs(d) < minimum) d = minimum;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const twice = 2 * iteration;
    let numerator =
      (iteration * (beta - iteration) * value) / ((alphaMinusOne + twice) * (alpha + twice));
    d = 1 + numerator * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + numerator / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    result *= d * c;

    numerator =
      -((alpha + iteration) * (sum + iteration) * value) /
      ((alpha + twice) * (alphaPlusOne + twice));
    d = 1 + numerator * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + numerator / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) <= epsilon) break;
  }
  return result;
}

function normalCdf(value: number): number {
  return normalProbability(value, true);
}

/**
 * Standard-normal lower- or upper-tail probability.
 *
 * The logarithmic path evaluates the requested tail directly. In particular, a large probability
 * is formed with log1p from the opposite small tail, and the far small tail uses an independently
 * authored Mills-ratio expansion instead of first underflowing a browser double to zero.
 */
export function normalProbability(value: number, lowerTail: boolean, logarithmic = false): number {
  if (Number.isNaN(value)) return Number.NaN;
  if (value === Number.NEGATIVE_INFINITY || value === Number.POSITIVE_INFINITY) {
    const requestsVanishingTail =
      (value === Number.NEGATIVE_INFINITY && lowerTail) ||
      (value === Number.POSITIVE_INFINITY && !lowerTail);
    const probability = requestsVanishingTail ? 0 : 1;
    return logarithmic ? (probability === 0 ? Number.NEGATIVE_INFINITY : 0) : probability;
  }
  if (logarithmic) {
    if (value === 0) return -Math.LN2;
    const logTail = normalLogUpperTail(Math.abs(value));
    const requestsSmallTail = lowerTail === value < 0;
    return requestsSmallTail ? logTail : Math.log1p(-Math.exp(logTail));
  }
  const halfTail = 0.5 * regularizedGammaQ(0.5, (value * value) / 2);
  return lowerTail === value > 0 ? 1 - halfTail : halfTail;
}

function normalLogUpperTail(absoluteValue: number): number {
  if (absoluteValue <= 10) {
    return Math.log(normalProbability(absoluteValue, false));
  }
  const inverseSquare = 1 / (absoluteValue * absoluteValue);
  let sum = 1;
  let term = 1;
  let previousMagnitude = Number.POSITIVE_INFINITY;
  for (let order = 1; order <= 200; order += 1) {
    term *= -(2 * order - 1) * inverseSquare;
    const magnitude = Math.abs(term);
    if (magnitude > previousMagnitude) break;
    const next = sum + term;
    if (next <= 0) break;
    sum = next;
    if (magnitude <= Math.abs(sum) * Number.EPSILON) break;
    previousMagnitude = magnitude;
  }
  return (
    -0.5 * absoluteValue * absoluteValue - Math.log(absoluteValue) - LOG_SQRT_TWO_PI + Math.log(sum)
  );
}

export function normalQuantile(probability: number): number {
  const lowerCoefficients = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ] as const;
  const lowerDenominator = [
    0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416, 1,
  ] as const;
  const centralCoefficients = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ] as const;
  const centralDenominator = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572, 1,
  ] as const;
  const boundary = 0.02425;
  let estimate: number;
  if (probability < boundary) {
    const root = Math.sqrt(-2 * Math.log(probability));
    estimate = polynomial(lowerCoefficients, root) / polynomial(lowerDenominator, root);
  } else if (probability > 1 - boundary) {
    const root = Math.sqrt(-2 * Math.log1p(-probability));
    estimate = -polynomial(lowerCoefficients, root) / polynomial(lowerDenominator, root);
  } else {
    const centered = probability - 0.5;
    const square = centered * centered;
    estimate =
      (polynomial(centralCoefficients, square) * centered) / polynomial(centralDenominator, square);
  }
  const error = normalCdf(estimate) - probability;
  return estimate - error * SQRT_TWO_PI * Math.exp((estimate * estimate) / 2);
}

function polynomial(coefficients: readonly number[], value: number): number {
  return coefficients.reduce((result, coefficient) => result * value + coefficient, 0);
}

/** Regularized incomplete-gamma probability evaluated in the requested tail. */
export function regularizedGammaProbability(
  value: number,
  alpha: number,
  lowerTail: boolean,
): number {
  if (Number.isNaN(value) || Number.isNaN(alpha) || alpha <= 0) return Number.NaN;
  if (value <= 0) return lowerTail ? 0 : 1;
  if (value === Number.POSITIVE_INFINITY) return lowerTail ? 1 : 0;
  if (lowerTail && value < alpha + 1) return regularizedGammaSeries(alpha, value);
  const upper = regularizedGammaQ(alpha, value);
  return lowerTail ? clampProbability(1 - upper) : upper;
}

function regularizedGammaQ(alpha: number, value: number): number {
  if (value <= 0) return 1;
  if (value < alpha + 1) return 1 - regularizedGammaSeries(alpha, value);
  const minimum = 1e-300;
  let b = value + 1 - alpha;
  let c = 1 / minimum;
  let d = 1 / b;
  let result = d;
  for (let iteration = 1; iteration <= 300; iteration += 1) {
    const numerator = -iteration * (iteration - alpha);
    b += 2;
    d = numerator * d + b;
    if (Math.abs(d) < minimum) d = minimum;
    c = b + numerator / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) <= 4 * Number.EPSILON) break;
  }
  return clampProbability(Math.exp(-value + alpha * Math.log(value) - logGamma(alpha)) * result);
}

function regularizedGammaSeries(alpha: number, value: number): number {
  let term = 1 / alpha;
  let sum = term;
  let denominator = alpha;
  for (let iteration = 1; iteration <= 300; iteration += 1) {
    denominator += 1;
    term *= value / denominator;
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 4 * Number.EPSILON) break;
  }
  return clampProbability(sum * Math.exp(-value + alpha * Math.log(value) - logGamma(alpha)));
}

export function logGamma(value: number): number {
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  const shifted = value - 1;
  let sum = LANCZOS_COEFFICIENTS[0];
  for (let index = 1; index < LANCZOS_COEFFICIENTS.length; index += 1) {
    sum += (LANCZOS_COEFFICIENTS[index] ?? 0) / (shifted + index);
  }
  const temporary = shifted + LANCZOS_COEFFICIENTS.length - 1.5;
  return LOG_SQRT_TWO_PI + (shifted + 0.5) * Math.log(temporary) - temporary + Math.log(sum);
}

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}
