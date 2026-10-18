import { HOST_ELEMENTARY_MATH } from "@nativr/runtime";
import type { ElementaryMath } from "@nativr/runtime";
/**
 * Standard-normal quantile and tail probabilities.
 *
 * Provenance (clean-room): the quantile is Algorithm AS 241 (PPND16) from M. J. Wichura, "The
 * Percentage Points of the Normal Distribution", Applied Statistics 37(3), 1988, 477-484. The tail
 * probabilities follow W. J. Cody's rational Chebyshev approximations as published in Cody (1969),
 * Mathematics of Computation 23, 631-637, and the public-domain SPECFUN ANORM routine (Cody 1993,
 * ACM TOMS Algorithm 715). GNU R documents both algorithms for qnorm/pnorm; its source was not used.
 * Coefficients are the published constants, written as the nearest IEEE 754 double. Results were compared bit-for-bit with GNU R 4.6.1;
 * residual last-place differences come from the host's elementary log/exp functions.
 */

const CENTRAL_NUMERATOR = [
  3.3871328727963665, 133.14166789178438, 1971.5909503065513, 13731.69376550946, 45921.95393154987,
  67265.7709270087, 33430.57558358813, 2509.0809287301227,
] as const;
const CENTRAL_DENOMINATOR = [
  1, 42.31333070160091, 687.1870074920579, 5394.196021424751, 21213.794301586597, 39307.89580009271,
  28729.085735721943, 5226.495278852854,
] as const;
const INTERMEDIATE_NUMERATOR = [
  1.4234371107496835, 4.630337846156546, 5.769497221460691, 3.6478483247632045, 1.2704582524523684,
  0.2417807251774506, 0.022723844989269184, 0.0007745450142783414,
] as const;
const INTERMEDIATE_DENOMINATOR = [
  1, 2.053191626637759, 1.6763848301838038, 0.6897673349851, 0.14810397642748008,
  0.015198666563616457, 0.0005475938084995345, 1.0507500716444169e-9,
] as const;
const TAIL_NUMERATOR = [
  6.657904643501103, 5.463784911164114, 1.7848265399172913, 0.29656057182850487,
  0.026532189526576124, 0.0012426609473880784, 0.000027115555687434876, 2.0103343992922881e-7,
] as const;
const TAIL_DENOMINATOR = [
  1, 0.599832206555888, 0.1369298809227358, 0.014875361290850615, 0.0007868691311456133,
  0.000018463183175100548, 1.421511758316446e-7, 2.0442631033899397e-15,
] as const;

const SMALL_NUMERATOR = [
  2.2352520354606837, 161.02823106855587, 1067.6894854603709, 18154.98125334356,
  0.06568233791820745,
] as const;
const SMALL_DENOMINATOR = [
  47.202581904688245, 976.0985517377767, 10260.932208618979, 45507.78933502673,
] as const;
const MIDDLE_NUMERATOR = [
  0.39894151208813466, 8.883149794388377, 93.50665613217785, 597.2702763948002, 2494.5375852903726,
  6848.190450536283, 11602.65143764735, 9842.714838383978, 1.0765576773720192e-8,
] as const;
const MIDDLE_DENOMINATOR = [
  22.266688044328117, 235.387901782625, 1519.3775994075547, 6485.558298266761, 18615.571640885097,
  34900.95272114598, 38912.00328609327, 19685.429676859992,
] as const;
const LARGE_NUMERATOR = [
  0.215898534057957, 0.12740116116024736, 0.022235277870649807, 0.0014216191932278934,
  0.000029112874951168793, 0.023073441764940174,
] as const;
const LARGE_DENOMINATOR = [
  1.284260096144911, 0.4682382124808651, 0.06598813786892856, 0.0037823963320275824,
  0.00007297515550839662,
] as const;

const SQRT_32 = 5.656854249492381;
const ONE_OVER_SQRT_TWO_PI = 0.3989422804014327;
const HALF_EPSILON = 2 ** -54;

/** Evaluate c[0] + c[1] x + ... with Horner's rule, highest coefficient first. */
function horner(coefficients: readonly number[], x: number): number {
  let result = coefficients[coefficients.length - 1] ?? 0;
  for (let index = coefficients.length - 2; index >= 0; index -= 1) {
    result = result * x + (coefficients[index] ?? 0);
  }
  return result;
}

/**
 * AS 241 lower-tail quantile for a probability in [0, 1]. `logSmallTail`, when supplied, is the
 * logarithm of min(p, 1 - p) and avoids rounding that tail through a probability.
 */
export function as241Quantile(
  probability: number,
  logSmallTail?: number,
  math: ElementaryMath = HOST_ELEMENTARY_MATH,
): number {
  if (Number.isNaN(probability) || probability < 0 || probability > 1) return Number.NaN;
  if (probability === 0) return Number.NEGATIVE_INFINITY;
  if (probability === 1) return Number.POSITIVE_INFINITY;
  const centered = probability - 0.5;
  if (Math.abs(centered) <= 0.425) {
    const r = 0.180625 - centered * centered;
    return (centered * horner(CENTRAL_NUMERATOR, r)) / horner(CENTRAL_DENOMINATOR, r);
  }
  let r = Math.sqrt(
    -(logSmallTail ?? math.unary("log", centered < 0 ? probability : 1 - probability)),
  );
  let value: number;
  if (r <= 5) {
    r -= 1.6;
    value = horner(INTERMEDIATE_NUMERATOR, r) / horner(INTERMEDIATE_DENOMINATOR, r);
  } else {
    r -= 5;
    value = horner(TAIL_NUMERATOR, r) / horner(TAIL_DENOMINATOR, r);
  }
  return centered < 0 ? -value : value;
}

/**
 * Cody's standard-normal tails for a finite value. Returns [lower, upper]; with `logarithmic`,
 * both are natural logarithms computed without first underflowing the small tail.
 */
export function codyNormalTails(
  value: number,
  logarithmic: boolean,
  math: ElementaryMath = HOST_ELEMENTARY_MATH,
): readonly [number, number] {
  const absolute = Math.abs(value);
  if (absolute <= 0.67448975) {
    let numerator = 0;
    let denominator = 0;
    if (absolute > HALF_EPSILON) {
      const square = value * value;
      numerator = (SMALL_NUMERATOR[4] ?? 0) * square;
      denominator = square;
      for (let index = 0; index < 3; index += 1) {
        numerator = (numerator + (SMALL_NUMERATOR[index] ?? 0)) * square;
        denominator = (denominator + (SMALL_DENOMINATOR[index] ?? 0)) * square;
      }
    }
    const temp =
      (value * (numerator + (SMALL_NUMERATOR[3] ?? 0))) /
      (denominator + (SMALL_DENOMINATOR[3] ?? 0));
    const lower = 0.5 + temp;
    const upper = 0.5 - temp;
    return logarithmic ? [math.unary("log", lower), math.unary("log", upper)] : [lower, upper];
  }
  let temp: number;
  let truncated: number;
  if (absolute <= SQRT_32) {
    let numerator = (MIDDLE_NUMERATOR[8] ?? 0) * absolute;
    let denominator = absolute;
    for (let index = 0; index < 7; index += 1) {
      numerator = (numerator + (MIDDLE_NUMERATOR[index] ?? 0)) * absolute;
      denominator = (denominator + (MIDDLE_DENOMINATOR[index] ?? 0)) * absolute;
    }
    temp = (numerator + (MIDDLE_NUMERATOR[7] ?? 0)) / (denominator + (MIDDLE_DENOMINATOR[7] ?? 0));
    truncated = Math.trunc(absolute * 16) / 16;
  } else {
    const inverseSquare = 1 / (value * value);
    let numerator = (LARGE_NUMERATOR[5] ?? 0) * inverseSquare;
    let denominator = inverseSquare;
    for (let index = 0; index < 4; index += 1) {
      numerator = (numerator + (LARGE_NUMERATOR[index] ?? 0)) * inverseSquare;
      denominator = (denominator + (LARGE_DENOMINATOR[index] ?? 0)) * inverseSquare;
    }
    temp =
      (inverseSquare * (numerator + (LARGE_NUMERATOR[4] ?? 0))) /
      (denominator + (LARGE_DENOMINATOR[4] ?? 0));
    temp = (ONE_OVER_SQRT_TWO_PI - temp) / absolute;
    truncated = Math.trunc(value * 16) / 16;
  }
  // Split x^2 / 2 into an exactly representable part and a small correction for accuracy.
  const difference = (absolute - Math.abs(truncated)) * (absolute + Math.abs(truncated));
  let small: number;
  let large: number;
  if (logarithmic) {
    small = -truncated * truncated * 0.5 - difference * 0.5 + math.unary("log", temp);
    large = math.unary(
      "log1p",
      -math.unary("exp", -truncated * truncated * 0.5) *
        math.unary("exp", -difference * 0.5) *
        temp,
    );
  } else {
    small =
      math.unary("exp", -truncated * truncated * 0.5) * math.unary("exp", -difference * 0.5) * temp;
    large = 1 - small;
  }
  return value > 0 ? [large, small] : [small, large];
}
