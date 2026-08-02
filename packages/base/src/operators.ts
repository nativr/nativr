import {
  RTypeMismatchError,
  RUnsupportedFeatureError,
  complexVector,
  doubleVector,
  integerVector,
  isAtomic,
  isMissing,
  logicalVector,
  rawVector,
  vectorClasses,
  vectorNames,
  withNames,
} from "@nativr/runtime";
import type {
  OperatorContext,
  RCharacterVector,
  RComplexVector,
  RDoubleVector,
  RIntegerVector,
  RLogicalVector,
  RList,
  RRawVector,
  RuntimeOperators,
  RValue,
} from "@nativr/runtime";
import { bitwiseHexmodeValues, isHexmodeValue, notHexmodeValue } from "./hexmode.js";

type NumericVector = RLogicalVector | RIntegerVector | RDoubleVector | RComplexVector;
type AtomicVector = NumericVector | RRawVector | RCharacterVector;

/** Stable metadata for JavaScript reference operators used by capability reporting. */
export const REFERENCE_OPERATOR_MANIFEST = Object.freeze([
  { id: "base.unary", backend: "js", deterministic: true },
  { id: "base.arithmetic", backend: "js", deterministic: true },
  { id: "base.recycling", backend: "js", deterministic: true },
  { id: "base.sequence", backend: "js", deterministic: true },
  { id: "base.comparison", backend: "js", deterministic: true },
  { id: "base.logical", backend: "js", deterministic: true },
  { id: "base.matching", backend: "js", deterministic: true },
]);

/** The correctness-oriented JavaScript implementation of vector operators. */
export const jsReferenceOperators: RuntimeOperators = {
  unary(context, operator, value) {
    if (operator === "!" && isHexmodeValue(value)) {
      return notHexmodeValue(value, context);
    }
    if (value.type === "raw") {
      if (operator !== "!") {
        throw new RTypeMismatchError(
          "NRT3101",
          `Operator '${operator}' requires numeric operands.`,
        );
      }
      context.allocate(value.length);
      return {
        ...rawVector(Array.from(value.values, (item) => 0xff ^ item)),
        attributes: new Map(value.attributes),
      };
    }
    const input = requireNumeric(value, operator);
    context.allocate(input.length);
    if (operator === "!") {
      const values = new Uint8Array(input.length);
      const missing = new Uint8Array(input.length);
      for (let index = 0; index < input.length; index += 1) {
        context.checkpoint();
        const item = logicalAt(input, index);
        if (item === undefined) {
          missing[index] = 1;
        } else {
          values[index] = item ? 0 : 1;
        }
      }
      return {
        ...logicalVector(values, compactMask(missing)),
        attributes: new Map(input.attributes),
      };
    }
    if (operator !== "+" && operator !== "-") {
      throw new RUnsupportedFeatureError(
        "NRU6002",
        `The current NativR subset does not support unary operator '${operator}'.`,
      );
    }
    if (input.type === "double") {
      const output = new Float64Array(input.length);
      for (let index = 0; index < input.length; index += 1) {
        context.checkpoint();
        const item = input.values[index] ?? 0;
        output[index] = operator === "-" ? -item : item;
      }
      return {
        ...doubleVector(output, input.missing),
        attributes: new Map(input.attributes),
      };
    }
    if (input.type === "complex") {
      const real = new Float64Array(input.length);
      const imaginary = new Float64Array(input.length);
      for (let index = 0; index < input.length; index += 1) {
        context.checkpoint();
        real[index] = operator === "-" ? -(input.real[index] ?? 0) : (input.real[index] ?? 0);
        imaginary[index] =
          operator === "-" ? -(input.imaginary[index] ?? 0) : (input.imaginary[index] ?? 0);
      }
      return {
        ...complexVector(real, imaginary, input.missing),
        attributes: new Map(input.attributes),
      };
    }
    const output = new Int32Array(input.length);
    for (let index = 0; index < input.length; index += 1) {
      context.checkpoint();
      const item = numericAt(input, index);
      output[index] = operator === "-" ? -item : item;
    }
    return {
      ...integerVector(output, input.missing),
      attributes: new Map(input.attributes),
    };
  },

  binary(context, operator, left, right) {
    if ((operator === "&" || operator === "|") && (isHexmodeValue(left) || isHexmodeValue(right))) {
      return bitwiseHexmodeValues(left, right, operator, context);
    }
    if (operator === ":") return createUnitSequence(context, left, right);
    if (["<", "<=", ">", ">=", "==", "!="].includes(operator)) {
      if (isNumericVersionValue(left) || isNumericVersionValue(right)) {
        return compareNumericVersionVectors(context, operator, left, right);
      }
      return compareVectors(context, operator, left, right);
    }
    if (operator === "&" || operator === "|") {
      if (left.type === "raw" && right.type === "raw") {
        const length = recycledLength(context, left.length, right.length);
        context.allocate(length);
        return rawVector(
          Array.from({ length }, (_, index) => {
            context.checkpoint();
            const lhs = left.values[index % left.length] ?? 0;
            const rhs = right.values[index % right.length] ?? 0;
            return operator === "&" ? lhs & rhs : lhs | rhs;
          }),
        );
      }
      return logicalVectors(context, operator, left, right);
    }
    if (operator === "%in%") return membershipVector(context, left, right);
    if (!["+", "-", "*", "/", "^", "%%", "%/%"].includes(operator)) {
      throw new RUnsupportedFeatureError(
        "NRU6003",
        `The current NativR subset does not support binary operator '${operator}'.`,
      );
    }
    const lhs = requireNumeric(left, operator);
    const rhs = requireNumeric(right, operator);
    const length = recycledLength(context, lhs.length, rhs.length);
    context.allocate(length);
    const missing = new Uint8Array(length);
    if (lhs.type === "complex" || rhs.type === "complex") {
      if (operator === "%%" || operator === "%/%") {
        throw new RUnsupportedFeatureError(
          "NRU6004",
          `Complex operation '${operator}' is not implemented by GNU R.`,
        );
      }
      const real = new Float64Array(length);
      const imaginary = new Float64Array(length);
      for (let index = 0; index < length; index += 1) {
        context.checkpoint();
        const leftIndex = index % lhs.length;
        const rightIndex = index % rhs.length;
        if (isMissing(lhs, leftIndex) || isMissing(rhs, rightIndex)) {
          missing[index] = 1;
          continue;
        }
        const result = applyComplexArithmetic(
          operator,
          complexAt(lhs, leftIndex),
          complexAt(rhs, rightIndex),
        );
        real[index] = result.real;
        imaginary[index] = result.imaginary;
      }
      return complexVector(real, imaginary, compactMask(missing));
    }
    const returnsDouble = lhs.type === "double" || rhs.type === "double" || "/^".includes(operator);

    if (returnsDouble) {
      const values = new Float64Array(length);
      for (let index = 0; index < length; index += 1) {
        context.checkpoint();
        const leftIndex = index % lhs.length;
        const rightIndex = index % rhs.length;
        if (isMissing(lhs, leftIndex) || isMissing(rhs, rightIndex)) {
          missing[index] = 1;
          continue;
        }
        values[index] = applyArithmetic(
          operator,
          numericAt(lhs, leftIndex),
          numericAt(rhs, rightIndex),
        );
      }
      return doubleVector(values, compactMask(missing));
    }

    const values = new Int32Array(length);
    for (let index = 0; index < length; index += 1) {
      context.checkpoint();
      const leftIndex = index % lhs.length;
      const rightIndex = index % rhs.length;
      if (isMissing(lhs, leftIndex) || isMissing(rhs, rightIndex)) {
        missing[index] = 1;
        continue;
      }
      const result = applyArithmetic(
        operator,
        numericAt(lhs, leftIndex),
        numericAt(rhs, rightIndex),
      );
      if (!Number.isInteger(result) || result > 2_147_483_647 || result < -2_147_483_648) {
        missing[index] = 1;
        context.warn({ code: "NRW1002", message: "NAs produced by integer overflow." });
      } else {
        values[index] = result;
      }
    }
    return integerVector(values, compactMask(missing));
  },
};

function isNumericVersionValue(value: RValue): value is RList {
  return value.type === "list" && (vectorClasses(value) ?? []).includes("numeric_version");
}

function numericVersionParts(
  value: RValue,
  context: OperatorContext,
): readonly (readonly number[] | undefined)[] {
  if (isNumericVersionValue(value)) {
    return value.values.map((entry) => {
      context.checkpoint();
      if (entry.type !== "integer" || entry.length === 0) return undefined;
      return [...entry.values];
    });
  }
  if (value.type !== "character") {
    throw new RTypeMismatchError("NRT3355", `invalid version specification (type: ${value.type})`);
  }
  return Array.from({ length: value.length }, (_, index) => {
    context.checkpoint();
    if (isMissing(value, index)) return undefined;
    const text = value.values[index] ?? "";
    if (!/^[0-9]+(?:[.-][0-9]+)*$/u.test(text)) {
      throw new RTypeMismatchError("NRT3355", `invalid version specification '${text}'`);
    }
    return text.split(/[.-]/u).map(Number);
  });
}

function compareNumericVersionParts(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const lhs = left[index] ?? 0;
    const rhs = right[index] ?? 0;
    if (lhs < rhs) return -1;
    if (lhs > rhs) return 1;
  }
  return 0;
}

function compareNumericVersionVectors(
  context: OperatorContext,
  operator: string,
  left: RValue,
  right: RValue,
): RLogicalVector {
  const lhs = numericVersionParts(left, context);
  const rhs = numericVersionParts(right, context);
  const length = recycledLength(context, lhs.length, rhs.length);
  const values = new Uint8Array(length);
  const missing = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    context.checkpoint();
    const leftParts = lhs[index % lhs.length];
    const rightParts = rhs[index % rhs.length];
    if (leftParts === undefined || rightParts === undefined) {
      missing[index] = 1;
      continue;
    }
    const comparison = compareNumericVersionParts(leftParts, rightParts);
    const result =
      operator === "<"
        ? comparison < 0
        : operator === "<="
          ? comparison <= 0
          : operator === ">"
            ? comparison > 0
            : operator === ">="
              ? comparison >= 0
              : operator === "=="
                ? comparison === 0
                : comparison !== 0;
    values[index] = result ? 1 : 0;
  }
  context.allocate(length);
  const mask = missing.some((item) => item !== 0) ? missing : undefined;
  const output = logicalVector(values, mask);
  const names =
    isNumericVersionValue(left) && left.length === length
      ? vectorNames(left)
      : isNumericVersionValue(right) && right.length === length
        ? vectorNames(right)
        : undefined;
  return names === undefined ? output : withNames(output, names);
}

function compareVectors(
  context: OperatorContext,
  operator: string,
  left: RValue,
  right: RValue,
): RLogicalVector {
  const lhs = requireComparable(left, operator);
  const rhs = requireComparable(right, operator);
  const length = recycledLength(context, lhs.length, rhs.length);
  context.allocate(length);
  const values = new Uint8Array(length);
  const missing = new Uint8Array(length);
  const characterMode = lhs.type === "character" || rhs.type === "character";
  const complexMode = lhs.type === "complex" || rhs.type === "complex";
  if (complexMode && !characterMode && !["==", "!="].includes(operator)) {
    throw new RTypeMismatchError("NRT3115", "Invalid comparison with complex values.");
  }

  for (let index = 0; index < length; index += 1) {
    context.checkpoint();
    const leftIndex = index % lhs.length;
    const rightIndex = index % rhs.length;
    if (comparisonMissing(lhs, leftIndex) || comparisonMissing(rhs, rightIndex)) {
      missing[index] = 1;
      continue;
    }
    if (complexMode && !characterMode) {
      const leftValue = complexAt(lhs, leftIndex);
      const rightValue = complexAt(rhs, rightIndex);
      const equal =
        leftValue.real === rightValue.real && leftValue.imaginary === rightValue.imaginary;
      values[index] = operator === "==" ? (equal ? 1 : 0) : equal ? 0 : 1;
    } else {
      const leftValue = characterMode
        ? comparableString(lhs, leftIndex)
        : comparableNumber(lhs, leftIndex);
      const rightValue = characterMode
        ? comparableString(rhs, rightIndex)
        : comparableNumber(rhs, rightIndex);
      values[index] = applyComparison(operator, leftValue, rightValue) ? 1 : 0;
    }
  }
  return logicalVector(values, compactMask(missing));
}

function logicalVectors(
  context: OperatorContext,
  operator: "&" | "|",
  left: RValue,
  right: RValue,
): RLogicalVector {
  const lhs = requireNumeric(left, operator);
  const rhs = requireNumeric(right, operator);
  const length = recycledLength(context, lhs.length, rhs.length);
  context.allocate(length);
  const values = new Uint8Array(length);
  const missing = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    context.checkpoint();
    const leftState = logicalAt(lhs, index % lhs.length);
    const rightState = logicalAt(rhs, index % rhs.length);
    const result =
      operator === "&"
        ? leftState === false || rightState === false
          ? false
          : leftState === true && rightState === true
            ? true
            : undefined
        : leftState === true || rightState === true
          ? true
          : leftState === false && rightState === false
            ? false
            : undefined;
    if (result === undefined) missing[index] = 1;
    else values[index] = result ? 1 : 0;
  }
  return logicalVector(values, compactMask(missing));
}

function membershipVector(context: OperatorContext, left: RValue, right: RValue): RLogicalVector {
  const lhs = requireComparable(left, "%in%");
  const rhs = requireComparable(right, "%in%");
  const characterMode = lhs.type === "character" || rhs.type === "character";
  context.allocate(lhs.length + rhs.length);
  const table = new Set<string>();
  for (let index = 0; index < rhs.length; index += 1) {
    context.checkpoint();
    table.add(comparisonKey(rhs, index, characterMode));
  }
  const values = new Uint8Array(lhs.length);
  for (let index = 0; index < lhs.length; index += 1) {
    context.checkpoint();
    values[index] = table.has(comparisonKey(lhs, index, characterMode)) ? 1 : 0;
  }
  return logicalVector(values);
}

/** Construct the finite scalar numeric sequence used by R's colon operator. */
export function createUnitSequence(
  context: OperatorContext,
  fromValue: RValue,
  toValue: RValue,
): RValue {
  const from = requireFiniteScalar(fromValue, ":");
  const to = requireFiniteScalar(toValue, ":");
  const step = to >= from ? 1 : -1;
  const length = Math.floor(Math.abs(to - from) + 1 + 1e-12);
  context.allocate(length);
  const values = Array.from({ length }, (_, index) => {
    context.checkpoint();
    return from + step * index;
  });
  const integer =
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    values.every((value) => value >= -2_147_483_648 && value <= 2_147_483_647);
  return integer ? integerVector(values) : doubleVector(values);
}

/** Centralized R-style recycling length and warning behavior. */
export function recycledLength(
  context: OperatorContext,
  leftLength: number,
  rightLength: number,
): number {
  if (leftLength === 0 || rightLength === 0) return 0;
  const longer = Math.max(leftLength, rightLength);
  const shorter = Math.min(leftLength, rightLength);
  if (longer % shorter !== 0) {
    context.warn({
      code: "NRW1001",
      message: "Longer object length is not a multiple of shorter object length.",
    });
  }
  return longer;
}

function requireNumeric(value: RValue, operator: string): NumericVector {
  if (!isAtomic(value) || value.type === "character" || value.type === "raw") {
    throw new RTypeMismatchError("NRT3101", `Operator '${operator}' requires numeric operands.`, {
      details: { type: value.type },
    });
  }
  return value;
}

function requireComparable(value: RValue, operator: string): AtomicVector {
  if (!isAtomic(value)) {
    throw new RTypeMismatchError(
      "NRT3114",
      `Operator '${operator}' requires atomic vector operands.`,
      { details: { type: value.type } },
    );
  }
  return value;
}

function requireFiniteScalar(value: RValue, operator: string): number {
  const numeric = requireNumeric(value, operator);
  if (numeric.type === "complex") {
    throw new RTypeMismatchError("NRT3105", `Operator '${operator}' requires real values.`);
  }
  if (numeric.length !== 1 || isMissing(numeric, 0)) {
    throw new RTypeMismatchError(
      "NRT3104",
      `Operator '${operator}' requires one non-missing numeric value on each side.`,
    );
  }
  const result = numericAt(numeric, 0);
  if (!Number.isFinite(result)) {
    throw new RTypeMismatchError("NRT3105", `Operator '${operator}' requires finite values.`);
  }
  return result;
}

function numericAt(vector: NumericVector, index: number): number {
  if (vector.type === "complex") {
    throw new RTypeMismatchError(
      "NRT3101",
      "A complex value cannot be coerced to real implicitly.",
    );
  }
  return vector.values[index] ?? 0;
}

function logicalAt(vector: NumericVector, index: number): boolean | undefined {
  if (isMissing(vector, index)) return undefined;
  if (vector.type === "complex") {
    const real = vector.real[index] ?? 0;
    const imaginary = vector.imaginary[index] ?? 0;
    if (Number.isNaN(real) || Number.isNaN(imaginary)) return undefined;
    return real !== 0 || imaginary !== 0;
  }
  const value = numericAt(vector, index);
  if (Number.isNaN(value)) return undefined;
  return value !== 0;
}

function comparisonMissing(vector: AtomicVector, index: number): boolean {
  return (
    isMissing(vector, index) ||
    (vector.type === "double" && Number.isNaN(vector.values[index])) ||
    (vector.type === "complex" &&
      (Number.isNaN(vector.real[index]) || Number.isNaN(vector.imaginary[index])))
  );
}

function comparableString(vector: AtomicVector, index: number): string {
  if (vector.type === "character") return vector.values[index] ?? "";
  if (vector.type === "logical") return numericAt(vector, index) === 0 ? "FALSE" : "TRUE";
  if (vector.type === "raw") return (vector.values[index] ?? 0).toString(16).padStart(2, "0");
  if (vector.type === "complex") {
    const value = complexAt(vector, index);
    return `${String(value.real)}${value.imaginary < 0 ? "" : "+"}${String(value.imaginary)}i`;
  }
  return String(numericAt(vector, index));
}

function comparisonKey(vector: AtomicVector, index: number, characterMode: boolean): string {
  if (isMissing(vector, index)) return "NA";
  if (vector.type === "double" && Number.isNaN(vector.values[index])) return "NaN";
  if (
    vector.type === "complex" &&
    (Number.isNaN(vector.real[index]) || Number.isNaN(vector.imaginary[index]))
  ) {
    return "NaN";
  }
  if (vector.type === "complex") {
    const value = complexAt(vector, index);
    return `z:${String(value.real)}:${String(value.imaginary)}`;
  }
  if (vector.type === "raw") return `r:${String(vector.values[index] ?? 0)}`;
  return characterMode
    ? `s:${comparableString(vector, index)}`
    : `n:${String(vector.type === "character" ? Number(vector.values[index] ?? "") : comparableNumber(vector, index))}`;
}

function comparableNumber(vector: AtomicVector, index: number): number {
  if (vector.type === "raw") return vector.values[index] ?? 0;
  if (vector.type === "character" || vector.type === "complex") {
    throw new RTypeMismatchError("NRT3114", "Value is not a comparable real number.");
  }
  return numericAt(vector, index);
}

function applyComparison(operator: string, left: number | string, right: number | string): boolean {
  switch (operator) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      throw new RUnsupportedFeatureError("NRU6003", `Unsupported operator '${operator}'.`);
  }
}

function applyArithmetic(operator: string, left: number, right: number): number {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "^":
      return left ** right;
    case "%%":
      return left - right * Math.floor(left / right);
    case "%/%":
      return Math.floor(left / right);
    default:
      throw new RUnsupportedFeatureError("NRU6003", `Unsupported operator '${operator}'.`);
  }
}

interface ComplexNumber {
  readonly real: number;
  readonly imaginary: number;
}

function complexAt(vector: AtomicVector, index: number): ComplexNumber {
  if (vector.type === "complex") {
    return { real: vector.real[index] ?? 0, imaginary: vector.imaginary[index] ?? 0 };
  }
  return {
    real:
      vector.type === "character"
        ? Number(vector.values[index] ?? "")
        : (vector.values[index] ?? 0),
    imaginary: 0,
  };
}

function applyComplexArithmetic(
  operator: string,
  left: ComplexNumber,
  right: ComplexNumber,
): ComplexNumber {
  switch (operator) {
    case "+":
      return {
        real: left.real + right.real,
        imaginary: left.imaginary + right.imaginary,
      };
    case "-":
      return {
        real: left.real - right.real,
        imaginary: left.imaginary - right.imaginary,
      };
    case "*":
      return {
        real: left.real * right.real - left.imaginary * right.imaginary,
        imaginary: left.real * right.imaginary + left.imaginary * right.real,
      };
    case "/": {
      const denominator = right.real ** 2 + right.imaginary ** 2;
      return {
        real: (left.real * right.real + left.imaginary * right.imaginary) / denominator,
        imaginary: (left.imaginary * right.real - left.real * right.imaginary) / denominator,
      };
    }
    case "^": {
      if (right.real === 0 && right.imaginary === 0) return { real: 1, imaginary: 0 };
      const magnitude = Math.hypot(left.real, left.imaginary);
      const angle = Math.atan2(left.imaginary, left.real);
      const logReal = Math.log(magnitude);
      const exponentReal = right.real * logReal - right.imaginary * angle;
      const exponentImaginary = right.real * angle + right.imaginary * logReal;
      const scale = Math.exp(exponentReal);
      return {
        real: scale * Math.cos(exponentImaginary),
        imaginary: scale * Math.sin(exponentImaginary),
      };
    }
    default:
      throw new RUnsupportedFeatureError("NRU6003", `Unsupported operator '${operator}'.`);
  }
}

function compactMask(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((item) => item === 1) ? mask : undefined;
}
