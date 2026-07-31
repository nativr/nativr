import {
  REvaluationError,
  RTypeMismatchError,
  characterVector,
  integerVector,
  isMissing,
  vectorClasses,
  vectorDimensions,
  withAttribute,
  withClasses,
  withDimensions,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  RCharacterVector,
  RIntegerVector,
  RValue,
  RVector,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";

export interface RomanBuiltinSpec {
  readonly name: string;
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

const ROMAN_TOKENS = Object.freeze([
  ["M", 1000],
  ["CM", 900],
  ["D", 500],
  ["CD", 400],
  ["C", 100],
  ["XC", 90],
  ["L", 50],
  ["XL", 40],
  ["X", 10],
  ["IX", 9],
  ["V", 5],
  ["IV", 4],
  ["I", 1],
] as const);

export const ROMAN_BUILTIN_SPECS: readonly RomanBuiltinSpec[] = [
  {
    name: "as.roman",
    parameters: ["x"],
    compatibility: "behavioral",
    implementation: builtinAsRoman,
  },
];

/** Return true for the integer representation used by documented roman values. */
export function isRomanValue(value: RValue): value is RIntegerVector {
  return value.type === "integer" && vectorClasses(value)?.includes("roman") === true;
}

/** Format a roman value for `as.character()` without retaining class or shape metadata. */
export async function asCharacterRoman(invocation: BuiltinInvocation): Promise<RCharacterVector> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "..."]);
  const input = requireRoman(
    await requiredArgument(invocation, matched.get("x"), "x", "as.character.roman"),
    "as.character.roman",
  );
  const output = new Array<string>(input.length);
  const missing = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(input, index)) {
      missing[index] = 1;
      output[index] = "";
    } else {
      output[index] = formatRomanNumeral(input.values[index] ?? 0);
    }
  }
  invocation.context.allocate(input.length);
  return characterVector(output, compactMask(missing));
}

/** Format a roman value for `format()` using the documented left-justified width. */
export async function formatRoman(invocation: BuiltinInvocation): Promise<RCharacterVector> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "width", "..."]);
  const input = requireRoman(
    await requiredArgument(invocation, matched.get("x"), "x", "format.roman"),
    "format.roman",
  );
  const tokens = Array.from({ length: input.length }, (_, index) => {
    invocation.context.checkpoint();
    return isMissing(input, index) ? "NA" : formatRomanNumeral(input.values[index] ?? 0);
  });
  const widthArgument = matched.get("width");
  const width =
    widthArgument === undefined
      ? tokens.reduce((maximum, token) => Math.max(maximum, token.length), 0)
      : nonNegativeIntegerScalar(await invocation.force(widthArgument.promise), "width");
  invocation.context.allocate(input.length);
  return characterVector(tokens.map((token) => token.padEnd(Math.max(width, token.length), " ")));
}

async function builtinAsRoman(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x"]);
  const input = await requiredArgument(invocation, matched.get("x"), "x", "as.roman");
  if (input.type === "integer" && vectorClasses(input)?.includes("roman") === true) return input;
  if (
    input.type !== "logical" &&
    input.type !== "integer" &&
    input.type !== "double" &&
    input.type !== "character"
  ) {
    throw cannotCoerceRoman();
  }
  const classes = vectorClasses(input);
  if (classes !== undefined) throw cannotCoerceRoman();

  const output = new Int32Array(input.length);
  const missing = new Uint8Array(input.length);
  const invalidStrings: string[] = [];
  let outsideIntegerRange = false;
  for (let index = 0; index < input.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(input, index)) {
      missing[index] = 1;
      continue;
    }
    if (input.type === "character") {
      const text = input.values[index] ?? "";
      const parsed = parseRomanInput(text);
      if (parsed.kind === "valid") {
        output[index] = parsed.value;
      } else {
        missing[index] = 1;
        if (parsed.kind === "invalid") invalidStrings.push(text);
      }
      continue;
    }
    const value = input.values[index] ?? 0;
    if (!Number.isFinite(value)) {
      outsideIntegerRange = true;
      missing[index] = 1;
      continue;
    }
    const integer = Math.trunc(value);
    if (integer < 1 || integer > 4999) {
      missing[index] = 1;
    } else {
      output[index] = integer;
    }
  }
  if (outsideIntegerRange) {
    invocation.context.warn({
      code: "NRW1110",
      message: "NAs introduced by coercion to integer range",
    });
  }
  if (invalidStrings.length > 0) {
    invocation.context.warn({
      code: "NRW1111",
      message: `invalid roman numeral${invalidStrings.length === 1 ? "" : "s"}: ${invalidStrings.join(" ")}`,
    });
  }
  invocation.context.allocate(input.length);
  let result = withClasses(integerVector(output, compactMask(missing)), ["roman"]);
  result = retainMatrixShape(input, result);
  return result;
}

function parseRomanInput(
  input: string,
): { readonly kind: "valid"; readonly value: number } | { readonly kind: "absent" | "invalid" } {
  if (input.length === 0) return { kind: "absent" };
  if (/^[0-9]+$/u.test(input)) {
    const value = Number(input);
    return Number.isSafeInteger(value) && value >= 1 && value <= 4999
      ? { kind: "valid", value }
      : { kind: "absent" };
  }
  const normalized = input.toUpperCase();
  const value = parseCanonicalRoman(normalized);
  if (value !== undefined) return { kind: "valid", value };
  const repeatedOne = /^I{1,6}$/u.exec(normalized);
  if (repeatedOne !== null) return { kind: "valid", value: normalized.length };
  return { kind: "invalid" };
}

function parseCanonicalRoman(input: string): number | undefined {
  if (!/^[IVXLCDM]+$/u.test(input)) return undefined;
  let cursor = 0;
  let total = 0;
  for (const [token, value] of ROMAN_TOKENS) {
    while (input.startsWith(token, cursor)) {
      total += value;
      cursor += token.length;
    }
  }
  if (cursor !== input.length || total < 1 || total > 4999) return undefined;
  return formatRomanNumeral(total) === input ? total : undefined;
}

function formatRomanNumeral(value: number): string {
  let remaining = value;
  let output = "";
  for (const [token, amount] of ROMAN_TOKENS) {
    while (remaining >= amount) {
      output += token;
      remaining -= amount;
    }
  }
  return output;
}

function retainMatrixShape(input: RVector, output: RIntegerVector): RIntegerVector {
  const dimensions = vectorDimensions(input);
  if (dimensions === undefined) return output;
  let shaped = withDimensions(output, dimensions);
  const dimensionNames = input.attributes.get("dimnames");
  if (dimensionNames !== undefined) shaped = withAttribute(shaped, "dimnames", dimensionNames);
  return shaped;
}

function requireRoman(value: RValue, call: string): RIntegerVector {
  if (!isRomanValue(value)) {
    throw new RTypeMismatchError("NRT3273", `${call}() requires a roman integer vector.`);
  }
  return value;
}

async function requiredArgument(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
  call: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in ${call}().`);
  }
  return invocation.force(argument.promise);
}

function nonNegativeIntegerScalar(value: RValue, name: string): number {
  if (
    (value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3274", `'${name}' must be one non-negative integer.`);
  }
  const item = value.values[0] ?? Number.NaN;
  if (!Number.isInteger(item) || item < 0 || !Number.isFinite(item)) {
    throw new RTypeMismatchError("NRT3274", `'${name}' must be one non-negative integer.`);
  }
  return item;
}

function cannotCoerceRoman(): RTypeMismatchError {
  return new RTypeMismatchError("NRT3273", "cannot coerce 'x' to roman");
}

function compactMask(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((item) => item === 1) ? mask : undefined;
}
