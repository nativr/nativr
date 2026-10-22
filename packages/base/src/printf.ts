/**
 * C99 floating-point conversions (%f, %e, %g and upper-case forms) for sprintf().
 *
 * Digits come from the exact decimal value of the binary double, rounded half to even. This matches
 * the observed GNU R 4.6.1 sprintf() results, for example "%.2f" of 0.125 giving "0.12" and "%.0f"
 * of 2.5 giving "2". JavaScript's toFixed/toExponential round such ties away from zero and switch
 * to exponent notation at 1e21, so they are not used.
 */

/** A finite non-negative double as the exact integer `digits` scaled by 10^`exponent`. */
interface ExactDecimal {
  readonly digits: bigint;
  readonly exponent: number;
}

/** Optional ASCII length preflight supplied by resource-aware callers; no runtime dependency. */
export type FloatingLengthGuard = (length: number) => void;

const VIEW = new DataView(new ArrayBuffer(8));

function exactDecimal(value: number): ExactDecimal {
  VIEW.setFloat64(0, value);
  const high = VIEW.getUint32(0);
  const low = VIEW.getUint32(4);
  const biased = (high >>> 20) & 0x7ff;
  let mantissa = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
  let binaryExponent: number;
  if (biased === 0) {
    binaryExponent = -1074;
  } else {
    mantissa |= 1n << 52n;
    binaryExponent = biased - 1075;
  }
  if (binaryExponent >= 0) return { digits: mantissa << BigInt(binaryExponent), exponent: 0 };
  // m / 2^k equals m * 5^k / 10^k exactly.
  const scale = -binaryExponent;
  return { digits: mantissa * 5n ** BigInt(scale), exponent: -scale };
}

/** Round digits * 10^exponent to an integer count of units of 10^-places, half to even. */
function roundToPlaces(decimal: ExactDecimal, places: number): bigint {
  const shift = decimal.exponent + places;
  if (shift >= 0) return decimal.digits * 10n ** BigInt(shift);
  const divisor = 10n ** BigInt(-shift);
  const quotient = decimal.digits / divisor;
  const twiceRemainder = (decimal.digits % divisor) * 2n;
  if (twiceRemainder > divisor || (twiceRemainder === divisor && quotient % 2n === 1n)) {
    return quotient + 1n;
  }
  return quotient;
}

function decimalExponent(decimal: ExactDecimal): number {
  return decimal.digits === 0n ? 0 : decimal.digits.toString().length - 1 + decimal.exponent;
}

function fixedDigits(
  value: number,
  precision: number,
  alternate: boolean,
  guard?: FloatingLengthGuard,
): string {
  guard?.(precision > 0 ? precision + 2 : alternate ? 2 : 1);
  // Every finite binary64 fractional expansion terminates by decimal place 1,074. Additional
  // requested digits are zeros; keeping them out of BigInt arithmetic preserves exact rounding.
  const arithmeticPrecision = Math.min(precision, 1_074);
  const text = roundToPlaces(exactDecimal(value), arithmeticPrecision)
    .toString()
    .padStart(arithmeticPrecision + 1, "0");
  const extraZeros = precision - arithmeticPrecision;
  const length = text.length + (precision > 0 || alternate ? 1 : 0) + extraZeros;
  guard?.(length);
  if (precision === 0) return alternate ? `${text}.` : text;
  const prefix = `${text.slice(0, -arithmeticPrecision)}.${text.slice(-arithmeticPrecision)}`;
  return extraZeros === 0 ? prefix : prefix + "0".repeat(extraZeros);
}

/** Significand digits (precision + 1 of them) and the decimal exponent after rounding. */
function exponentialParts(value: number, precision: number): { digits: string; exponent: number } {
  const decimal = exactDecimal(value);
  if (decimal.digits === 0n) return { digits: "0".repeat(precision + 1), exponent: 0 };
  let exponent = decimalExponent(decimal);
  let digits = roundToPlaces(decimal, precision - exponent).toString();
  if (digits.length > precision + 1) {
    // Rounding carried into a new leading digit, e.g. 9.99 -> 10.0.
    exponent += 1;
    digits = digits.slice(0, precision + 1);
  }
  return { digits, exponent };
}

function exponentialText(
  digits: string,
  exponent: number,
  upper: boolean,
  alternate: boolean,
  extraZeros = 0,
  guard?: FloatingLengthGuard,
): string {
  const magnitude = String(Math.abs(exponent)).padStart(2, "0");
  const hasDecimal = digits.length + extraZeros > 1 || alternate;
  guard?.(digits.length + extraZeros + (hasDecimal ? 1 : 0) + magnitude.length + 2);
  const significand =
    digits.length === 1 ? (hasDecimal ? `${digits}.` : digits) : `${digits[0]}.${digits.slice(1)}`;
  return `${significand}${extraZeros > 0 ? "0".repeat(extraZeros) : ""}${upper ? "E" : "e"}${exponent < 0 ? "-" : "+"}${magnitude}`;
}

/**
 * Format the magnitude of a finite double for one of f, F, e, E, g, G. The caller applies sign,
 * flags, and width.
 */
export function formatFloatingMagnitude(
  value: number,
  conversion: "f" | "F" | "e" | "E" | "g" | "G",
  precisionOrDefault: number | undefined,
  alternate: boolean,
  guard?: FloatingLengthGuard,
): string {
  const magnitude = Math.abs(value);
  const precision = precisionOrDefault ?? 6;
  if (conversion === "f" || conversion === "F")
    return fixedDigits(magnitude, precision, alternate, guard);
  if (conversion === "e" || conversion === "E") {
    guard?.(precision > 0 ? precision + 6 : alternate ? 6 : 5);
    const arithmeticPrecision = Math.min(precision, 1_074);
    const parts = exponentialParts(magnitude, arithmeticPrecision);
    return exponentialText(
      parts.digits,
      parts.exponent,
      conversion === "E",
      alternate,
      precision - arithmeticPrecision,
      guard,
    );
  }
  // Without alternate form, extra exact zeros are removed. 1,075 significant digits retain every
  // binary64 digit and exceed its maximum decimal exponent, so the notation decision is unchanged.
  const significant = alternate
    ? precision === 0
      ? 1
      : precision
    : Math.min(precision === 0 ? 1 : precision, 1_075);
  if (alternate) guard?.(significant);
  const arithmeticSignificant = Math.min(significant, 1_075);
  const parts = exponentialParts(magnitude, arithmeticSignificant - 1);
  let text =
    significant > parts.exponent && parts.exponent >= -4
      ? fixedDigits(
          magnitude,
          significant - 1 - parts.exponent,
          alternate,
          alternate ? guard : undefined,
        )
      : exponentialText(
          parts.digits,
          parts.exponent,
          conversion === "G",
          alternate,
          significant - arithmeticSignificant,
          alternate ? guard : undefined,
        );
  if (!alternate) {
    // %g removes trailing fractional zeros and a then-bare decimal point.
    text = text.replace(/\.(\d*?)0+(?=$|[eE])/u, (_, kept: string) =>
      kept.length > 0 ? `.${kept}` : "",
    );
  }
  guard?.(text.length);
  return text;
}

/**
 * Character form of a finite double for as.character(), paste() and character coercion: at most 15
 * significant digits (R documents DBL_DIG), trailing zeros removed, in fixed notation unless the
 * scientific form is strictly narrower. Non-finite values are handled by the caller.
 */
export function doubleToCharacter(value: number): string {
  if (value === 0) return "0";
  const parts = exponentialParts(Math.abs(value), 14);
  const digits = parts.digits.replace(/0+$/u, "") || "0";
  const exponent = parts.exponent;
  const sign = value < 0 ? "-" : "";
  const scientific = `${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ""}e${
    exponent < 0 ? "-" : "+"
  }${String(Math.abs(exponent)).padStart(2, "0")}`;
  // The notation choice uses the 15-digit form; fixed notation then formats the exact value with
  // that many decimals, so integers wider than 15 digits keep all of their exact digits.
  const decimals = Math.max(0, digits.length - 1 - exponent);
  const fixedWidth = (exponent >= 0 ? exponent + 1 : 1) + (decimals > 0 ? decimals + 1 : 0);
  if (fixedWidth > scientific.length) return sign + scientific;
  return sign + fixedDigits(Math.abs(value), decimals, false);
}
