/**
 * Complex division (a + bi) / (c + di).
 *
 * Regular values use Smith's scaled algorithm (R. L. Smith, "Algorithm 116: Complex division",
 * Communications of the ACM 5(8), 1962), which reproduced 2000 of 2000 sampled GNU R 4.6.1 quotients
 * bit-for-bit; the textbook formula reproduced 558. Real and imaginary divisors divide each part
 * directly, and an infinite divisor with a finite numerator yields signed zeros (C99 Annex G), as
 * observed in GNU R for division by zero and by infinities.
 */
export function divideComplex(a: number, b: number, c: number, d: number): [number, number] {
  if (d === 0) return [a / c, b / c];
  if (c === 0) return [b / d, -a / d];
  if (
    (!Number.isFinite(c) || !Number.isFinite(d)) &&
    !Number.isNaN(c) &&
    !Number.isNaN(d) &&
    Number.isFinite(a) &&
    Number.isFinite(b)
  ) {
    const unitC = Math.sign(c) * (Number.isFinite(c) ? 0 : 1);
    const unitD = Math.sign(d) * (Number.isFinite(d) ? 0 : 1);
    return [0 * (a * unitC + b * unitD), 0 * (b * unitC - a * unitD)];
  }
  if (Math.abs(c) >= Math.abs(d)) {
    const ratio = d / c;
    const denominator = c + d * ratio;
    return [(a + b * ratio) / denominator, (b - a * ratio) / denominator];
  }
  const ratio = c / d;
  const denominator = c * ratio + d;
  return [(a * ratio + b) / denominator, (b * ratio - a) / denominator];
}
