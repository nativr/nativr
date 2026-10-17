import { as241Quantile, codyNormalTails } from "./normal.js";

const LANCZOS_COEFFICIENTS = [
  0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
  12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
] as const;

const LOG_SQRT_TWO_PI = 0.9189385332046727;

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

/**
 * Standard-normal lower- or upper-tail probability using Cody's published approximations. The
 * logarithmic path evaluates the requested tail directly, without first underflowing to zero.
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
  const [lower, upper] = codyNormalTails(value, logarithmic);
  return lowerTail ? lower : upper;
}

/** Standard-normal lower-tail quantile (AS 241) for a probability in [0, 1]. */
export function normalQuantile(probability: number): number {
  return as241Quantile(probability);
}

function logGamma(value: number): number {
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
