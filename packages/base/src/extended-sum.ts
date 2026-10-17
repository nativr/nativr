/** Binary summation with a 64-bit significand and round-to-nearest, ties-to-even.
 * Independently implemented from floating-point arithmetic, without host long doubles.
 * Finite binary64 inputs cannot exhaust the extended exponent range under runtime limits.
 */
export class ExtendedSum {
  readonly #view = new DataView(new ArrayBuffer(8));
  #mantissa = 0n;
  #exponent = 0;
  #special: number | undefined;

  add(value: number): void {
    if (!Number.isFinite(value)) {
      this.#special = this.#special === undefined ? value : this.#special + value;
      return;
    }
    if (this.#special !== undefined || value === 0) return;
    this.#view.setFloat64(0, value);
    const high = this.#view.getUint32(0);
    const low = this.#view.getUint32(4);
    const encodedExponent = (high >>> 20) & 0x7ff;
    let mantissa = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
    if (encodedExponent !== 0) mantissa |= 1n << 52n;
    if (high >>> 31 !== 0) mantissa = -mantissa;
    const exponent = encodedExponent === 0 ? -1074 : encodedExponent - 1075;
    this.#addParts(mantissa, exponent);
  }

  addExtended(value: ExtendedSum, sign = 1): void {
    if (value.#special !== undefined) {
      this.add(sign * value.#special);
      return;
    }
    if (this.#special !== undefined) return;
    this.#addParts(sign < 0 ? -value.#mantissa : value.#mantissa, value.#exponent);
  }

  #addParts(mantissa: bigint, exponent: number): void {
    if (mantissa === 0n) return;
    if (this.#mantissa === 0n) {
      this.#mantissa = mantissa;
      this.#exponent = exponent;
    } else {
      const common = Math.min(this.#exponent, exponent);
      this.#mantissa =
        (this.#mantissa << BigInt(this.#exponent - common)) +
        (mantissa << BigInt(exponent - common));
      this.#exponent = common;
    }
    const negative = this.#mantissa < 0n;
    const magnitude = negative ? -this.#mantissa : this.#mantissa;
    const shift = magnitude.toString(2).length - 64;
    if (shift <= 0) return;
    const bits = BigInt(shift);
    let rounded = magnitude >> bits;
    const remainder = magnitude - (rounded << bits);
    const half = 1n << (bits - 1n);
    if (remainder > half || (remainder === half && (rounded & 1n) !== 0n)) rounded += 1n;
    this.#mantissa = negative ? -rounded : rounded;
    this.#exponent += shift;
  }

  divided(divisor: number): ExtendedSum {
    const result = new ExtendedSum();
    if (this.#special !== undefined) {
      result.#special = this.#special / divisor;
      return result;
    }
    if (divisor === 0) {
      result.#special = Number.NaN;
      return result;
    }
    if (this.#mantissa === 0n) return result;
    const negative = this.#mantissa < 0n;
    const magnitude = negative ? -this.#mantissa : this.#mantissa;
    const denominator = BigInt(divisor);
    let shift = 64 + denominator.toString(2).length - magnitude.toString(2).length;
    let numerator = magnitude << BigInt(shift);
    if ((numerator / denominator).toString(2).length > 64) {
      shift -= 1;
      numerator = magnitude << BigInt(shift);
    }
    const quotient = roundQuotient(numerator, denominator);
    result.#mantissa = negative ? -quotient : quotient;
    result.#exponent = this.#exponent - shift;
    return result;
  }

  value(divisor = 1): number {
    if (divisor !== 1) return this.divided(divisor).value();
    if (this.#special !== undefined) return this.#special;
    if (this.#mantissa === 0n) return 0;
    const negative = this.#mantissa < 0n;
    const magnitude = negative ? -this.#mantissa : this.#mantissa;
    const exponent = this.#exponent;
    const outputExponent = Math.max(-1074, exponent + magnitude.toString(2).length - 53);
    const discarded = outputExponent - exponent;
    const rounded = discarded > 0 ? roundQuotient(magnitude, 1n << BigInt(discarded)) : magnitude;
    const result = Number(rounded) * 2 ** (discarded > 0 ? outputExponent : exponent);
    return negative ? -result : result;
  }
}

function roundQuotient(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const twiceRemainder = (numerator % denominator) * 2n;
  return twiceRemainder > denominator || (twiceRemainder === denominator && (quotient & 1n) !== 0n)
    ? quotient + 1n
    : quotient;
}
