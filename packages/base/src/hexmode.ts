import {
  REvaluationError,
  RTypeMismatchError,
  characterVector,
  integerVector,
  isMissing,
  lookupBinding,
  subsetVector,
  vectorClasses,
  vectorNames,
  withClasses,
  withNames,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  OperatorContext,
  RCharacterVector,
  RIntegerVector,
  RValue,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";

export interface HexmodeBuiltinSpec {
  readonly name: string;
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly resultVisibility?: "visible" | "invisible";
}

export const HEXMODE_BUILTIN_SPECS: readonly HexmodeBuiltinSpec[] = [
  {
    name: "as.hexmode",
    parameters: ["x"],
    compatibility: "behavioral",
    implementation: builtinAsHexmode,
  },
  {
    name: "as.character.hexmode",
    parameters: ["x", "keepStr", "..."],
    compatibility: "behavioral",
    implementation: builtinAsCharacterHexmode,
  },
  {
    name: "format.hexmode",
    parameters: ["x", "width", "upper.case", "..."],
    compatibility: "behavioral",
    implementation: builtinFormatHexmode,
  },
  {
    name: "print.hexmode",
    parameters: ["x", "..."],
    compatibility: "behavioral",
    implementation: builtinPrintHexmode,
    resultVisibility: "invisible",
  },
  {
    name: "[.hexmode",
    parameters: ["x", "i"],
    compatibility: "behavioral",
    implementation: builtinSubsetHexmode,
  },
  {
    name: "!.hexmode",
    parameters: ["a"],
    compatibility: "behavioral",
    implementation: builtinNotHexmode,
  },
  {
    name: "&.hexmode",
    parameters: ["a", "b"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinBitwiseHexmode(invocation, "&"),
  },
  {
    name: "|.hexmode",
    parameters: ["a", "b"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinBitwiseHexmode(invocation, "|"),
  },
];

/** Return true for the concrete integer representation used by base hexmode objects. */
export function isHexmodeValue(value: RValue): value is RIntegerVector {
  return value.type === "integer" && vectorClasses(value)?.includes("hexmode") === true;
}

/** Apply the hexmode bitwise complement used by both `!` and `!.hexmode`. */
export function notHexmodeValue(value: RValue, context: OperatorContext): RIntegerVector {
  const input = coerceHexmode(value, context);
  const output = new Int32Array(input.length);
  const missing = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    context.checkpoint();
    if (isMissing(input, index)) {
      missing[index] = 1;
    } else {
      output[index] = ~(input.values[index] ?? 0);
    }
  }
  context.allocate(input.length);
  return withClasses(integerVector(output, compactMask(missing)), ["hexmode"]);
}

/** Apply the recycling 32-bit bitwise operation used by hexmode `&` and `|`. */
export function bitwiseHexmodeValues(
  leftValue: RValue,
  rightValue: RValue,
  operation: "&" | "|",
  context: OperatorContext,
): RIntegerVector {
  const left = coerceHexmode(leftValue, context);
  const right = coerceHexmode(rightValue, context);
  const length = left.length === 0 || right.length === 0 ? 0 : Math.max(left.length, right.length);
  const output = new Int32Array(length);
  const missing = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    context.checkpoint();
    const leftIndex = index % left.length;
    const rightIndex = index % right.length;
    if (isMissing(left, leftIndex) || isMissing(right, rightIndex)) {
      missing[index] = 1;
    } else {
      const lhs = left.values[leftIndex] ?? 0;
      const rhs = right.values[rightIndex] ?? 0;
      output[index] = operation === "&" ? lhs & rhs : lhs | rhs;
    }
  }
  context.allocate(length);
  return withClasses(integerVector(output, compactMask(missing)), ["hexmode"]);
}

/** Run `as.character.hexmode` semantics after a generic has recognized the class. */
export async function asCharacterHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  return builtinAsCharacterHexmode(invocation);
}

/** Run `format.hexmode` semantics after a generic has recognized the class. */
export async function formatHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  return builtinFormatHexmode(invocation);
}

/** Run `print.hexmode` semantics after a generic has recognized the class. */
export async function printHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  return builtinPrintHexmode(invocation);
}

async function builtinAsHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x"]);
  const input = await requiredArgument(invocation, matched.get("x"), "x", "as.hexmode");
  return coerceHexmode(input, invocation.context);
}

function coerceHexmode(value: RValue, context: OperatorContext): RIntegerVector {
  if (value.type === "integer") return withClasses(value, ["hexmode"]);
  if (value.type === "double") {
    const output = new Int32Array(value.length);
    const missing = new Uint8Array(value.length);
    let outsideIntegerRange = false;
    let invalid = false;
    for (let index = 0; index < value.length; index += 1) {
      context.checkpoint();
      if (isMissing(value, index) || Number.isNaN(value.values[index] ?? Number.NaN)) {
        missing[index] = 1;
        continue;
      }
      const item = value.values[index] ?? 0;
      if (!Number.isFinite(item) || item < -2_147_483_647 || item > 2_147_483_647) {
        outsideIntegerRange = true;
        missing[index] = 1;
      } else if (!Number.isInteger(item)) {
        invalid = true;
      } else {
        output[index] = item;
      }
    }
    if (outsideIntegerRange) {
      context.warn({
        code: "NRW1104",
        message: "NAs introduced by coercion to integer range",
      });
      throw new REvaluationError("NRE2141", "missing value where TRUE/FALSE needed");
    }
    if (invalid) throw cannotCoerceHexmode();
    context.allocate(value.length);
    return withClasses(integerVector(output, compactMask(missing)), ["hexmode"]);
  }
  if (value.type === "character") {
    const output = new Int32Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      context.checkpoint();
      if (isMissing(value, index)) throw cannotCoerceHexmode();
      const parsed = parseHexmodeString(value.values[index] ?? "");
      if (parsed === undefined) throw cannotCoerceHexmode();
      output[index] = parsed;
    }
    context.allocate(value.length);
    return withClasses(integerVector(output), ["hexmode"]);
  }
  throw cannotCoerceHexmode();
}

function parseHexmodeString(value: string): number | undefined {
  if (!/^[\t\n\v\f\r ]*\+?(?:0[xX])?[0-9a-fA-F]+$/u.test(value)) return undefined;
  const normalized = value.trimStart().replace(/^\+/u, "");
  const digits = normalized.replace(/^0[xX]/u, "");
  const parsed = Number.parseInt(digits, 16);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647 ? parsed : undefined;
}

function cannotCoerceHexmode(): REvaluationError {
  return new REvaluationError("NRE2142", `'x' cannot be coerced to class "hexmode"`);
}

async function builtinAsCharacterHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "keepStr", "..."]);
  const input = requireHexmode(
    await requiredArgument(invocation, matched.get("x"), "x", "as.character.hexmode"),
    "as.character.hexmode",
  );
  const keepString = matched.get("keepStr");
  if (keepString !== undefined) {
    logicalScalar(await invocation.force(keepString.promise), "keepStr");
  }
  const output = new Array<string>(input.length);
  const missing = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    invocation.context.checkpoint();
    if (isMissing(input, index)) {
      missing[index] = 1;
      output[index] = "";
    } else {
      output[index] = hexmodeToken(input.values[index] ?? 0, false);
    }
  }
  invocation.context.allocate(input.length);
  return characterVector(output, compactMask(missing));
}

async function builtinFormatHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "width", "upper.case", "..."]);
  const input = requireHexmode(
    await requiredArgument(invocation, matched.get("x"), "x", "format.hexmode"),
    "format.hexmode",
  );
  const upperArgument = matched.get("upper.case");
  const upper =
    upperArgument === undefined
      ? false
      : logicalScalar(await invocation.force(upperArgument.promise), "upper.case");
  const tokens = Array.from({ length: input.length }, (_, index) => {
    invocation.context.checkpoint();
    return isMissing(input, index) ? "" : hexmodeToken(input.values[index] ?? 0, upper);
  });
  const widthArgument = matched.get("width");
  const width =
    widthArgument === undefined
      ? tokens.reduce((maximum, token) => Math.max(maximum, token.length), 0)
      : nonNegativeIntegerScalar(await invocation.force(widthArgument.promise), "width");
  const missing = new Uint8Array(input.length);
  const output = tokens.map((token, index) => {
    if (isMissing(input, index)) {
      missing[index] = 1;
      return "";
    }
    return token.padStart(width, "0");
  });
  invocation.context.allocate(input.length);
  let result: RCharacterVector = characterVector(output, compactMask(missing));
  const names = vectorNames(input);
  if (names !== undefined) result = withNames(result, names);
  return result;
}

async function builtinPrintHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched, dots } = matchBuiltinArguments(invocation, ["x", "..."]);
  const input = requireHexmode(
    await requiredArgument(invocation, matched.get("x"), "x", "print.hexmode"),
    "print.hexmode",
  );
  const formatted = formatHexmodeValue(input, invocation);
  const printBinding = lookupBinding(invocation.baseEnvironment(), "print");
  if (printBinding === undefined || printBinding.type !== "builtin") {
    throw new REvaluationError("NRE2001", "Could not find base print().");
  }
  const arguments_: { readonly name?: string; readonly value: RValue }[] = [{ value: formatted }];
  for (const argument of dots) {
    const value = await invocation.force(argument.promise);
    arguments_.push(argument.name === undefined ? { value } : { name: argument.name, value });
  }
  await invocation.invoke(printBinding, arguments_);
  invocation.setResultVisibility("invisible");
  return input;
}

function formatHexmodeValue(
  input: RIntegerVector,
  invocation: BuiltinInvocation,
): RCharacterVector {
  const tokens = Array.from({ length: input.length }, (_, index) => {
    invocation.context.checkpoint();
    return isMissing(input, index) ? "" : hexmodeToken(input.values[index] ?? 0, false);
  });
  const width = tokens.reduce((maximum, token) => Math.max(maximum, token.length), 0);
  const missing = new Uint8Array(input.length);
  const output = tokens.map((token, index) => {
    if (isMissing(input, index)) {
      missing[index] = 1;
      return "";
    }
    return token.padStart(width, "0");
  });
  invocation.context.allocate(input.length);
  let result: RCharacterVector = characterVector(output, compactMask(missing));
  const names = vectorNames(input);
  if (names !== undefined) result = withNames(result, names);
  return result;
}

async function builtinSubsetHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "i"]);
  const input = requireHexmode(
    await requiredArgument(invocation, matched.get("x"), "x", "[.hexmode"),
    "[.hexmode",
  );
  const indexArgument = matched.get("i");
  const index =
    indexArgument === undefined || indexArgument.promise.missing
      ? undefined
      : await invocation.force(indexArgument.promise);
  return subsetVector(input, index, invocation.context);
}

async function builtinNotHexmode(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["a"]);
  const input = await requiredArgument(invocation, matched.get("a"), "a", "!.hexmode");
  return notHexmodeValue(input, invocation.context);
}

async function builtinBitwiseHexmode(
  invocation: BuiltinInvocation,
  operation: "&" | "|",
): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["a", "b"]);
  const left = await requiredArgument(invocation, matched.get("a"), "a", `${operation}.hexmode`);
  const right = await requiredArgument(invocation, matched.get("b"), "b", `${operation}.hexmode`);
  return bitwiseHexmodeValues(left, right, operation, invocation.context);
}

function requireHexmode(value: RValue, call: string): RIntegerVector {
  if (!isHexmodeValue(value)) {
    throw new RTypeMismatchError("NRT3270", `${call}() requires a hexmode integer vector.`);
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

function logicalScalar(value: RValue, name: string): boolean {
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3271", `'${name}' must be one non-missing logical value.`);
  }
  return value.values[0] === 1;
}

function nonNegativeIntegerScalar(value: RValue, name: string): number {
  if (
    (value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3272", `'${name}' must be one non-negative integer.`);
  }
  const item = value.values[0] ?? Number.NaN;
  if (!Number.isInteger(item) || item < 0 || !Number.isFinite(item)) {
    throw new RTypeMismatchError("NRT3272", `'${name}' must be one non-negative integer.`);
  }
  return item;
}

function hexmodeToken(value: number, upper: boolean): string {
  const token = (value >>> 0).toString(16);
  return upper ? token.toUpperCase() : token;
}

function compactMask(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((value) => value === 1) ? mask : undefined;
}
