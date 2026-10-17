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

function fixedDigits(value: number, precision: number, alternate: boolean): string {
  const text = roundToPlaces(exactDecimal(value), precision)
    .toString()
    .padStart(precision + 1, "0");
  if (precision === 0) return alternate ? `${text}.` : text;
  return `${text.slice(0, -precision)}.${text.slice(-precision)}`;
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
): string {
  const significand =
    digits.length === 1 ? (alternate ? `${digits}.` : digits) : `${digits[0]}.${digits.slice(1)}`;
  const magnitude = String(Math.abs(exponent)).padStart(2, "0");
  return `${significand}${upper ? "E" : "e"}${exponent < 0 ? "-" : "+"}${magnitude}`;
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
): string {
  const magnitude = Math.abs(value);
  const precision = precisionOrDefault ?? 6;
  if (conversion === "f" || conversion === "F") return fixedDigits(magnitude, precision, alternate);
  if (conversion === "e" || conversion === "E") {
    const parts = exponentialParts(magnitude, precision);
    return exponentialText(parts.digits, parts.exponent, conversion === "E", alternate);
  }
  const significant = precision === 0 ? 1 : precision;
  const parts = exponentialParts(magnitude, significant - 1);
  let text =
    significant > parts.exponent && parts.exponent >= -4
      ? fixedDigits(magnitude, significant - 1 - parts.exponent, alternate)
      : exponentialText(parts.digits, parts.exponent, conversion === "G", alternate);
  if (!alternate) {
    // %g removes trailing fractional zeros and a then-bare decimal point.
    text = text.replace(/\.(\d*?)0+(?=$|[eE])/u, (_, kept: string) =>
      kept.length > 0 ? `.${kept}` : "",
    );
  }
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
