import {
  RTypeMismatchError,
  RUnsupportedFeatureError,
  doubleVector,
  integerVector,
  isAtomic,
  isMissing,
  logicalVector,
} from "@nativr/runtime";
import type {
  OperatorContext,
  RDoubleVector,
  RIntegerVector,
  RLogicalVector,
  RuntimeOperators,
  RValue,
} from "@nativr/runtime";

type NumericVector = RLogicalVector | RIntegerVector | RDoubleVector;

/** Stable metadata for JavaScript reference operators used by capability reporting. */
export const REFERENCE_OPERATOR_MANIFEST = Object.freeze([
  { id: "base.unary", backend: "js", deterministic: true },
  { id: "base.arithmetic", backend: "js", deterministic: true },
  { id: "base.recycling", backend: "js", deterministic: true },
]);

/** The correctness-oriented JavaScript implementation of vector operators. */
export const jsReferenceOperators: RuntimeOperators = {
  unary(context, operator, value) {
    const input = requireNumeric(value, operator);
    context.allocate(input.length);
    if (operator === "!") {
      const values = new Uint8Array(input.length);
      const missing = input.missing === undefined ? undefined : new Uint8Array(input.missing);
      for (let index = 0; index < input.length; index += 1) {
        context.checkpoint();
        values[index] = numericAt(input, index) === 0 ? 1 : 0;
      }
      return logicalVector(values, missing);
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
      return doubleVector(output, input.missing);
    }
    const output = new Int32Array(input.length);
    for (let index = 0; index < input.length; index += 1) {
      context.checkpoint();
      const item = numericAt(input, index);
      output[index] = operator === "-" ? -item : item;
    }
    return integerVector(output, input.missing);
  },

  binary(context, operator, left, right) {
    if (!["+", "-", "*", "/", "^"].includes(operator)) {
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
  if (!isAtomic(value) || value.type === "character") {
    throw new RTypeMismatchError("NRT3101", `Operator '${operator}' requires numeric operands.`, {
      details: { type: value.type },
    });
  }
  return value;
}

function numericAt(vector: NumericVector, index: number): number {
  return vector.values[index] ?? 0;
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
    default:
      throw new RUnsupportedFeatureError("NRU6003", `Unsupported operator '${operator}'.`);
  }
}

function compactMask(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((item) => item === 1) ? mask : undefined;
}
