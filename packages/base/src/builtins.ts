import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  R_NULL,
  characterVector,
  doubleVector,
  integerVector,
  isAtomic,
  isMissing,
  logicalVector,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RCharacterVector,
  RDoubleVector,
  RIntegerVector,
  RLogicalVector,
  RValue,
} from "@nativr/runtime";

type AtomicVector = RLogicalVector | RIntegerVector | RDoubleVector | RCharacterVector;
type NumericVector = RLogicalVector | RIntegerVector | RDoubleVector;

/** Required base builtins for language-subset version 0.1. */
export const baseBuiltins: readonly BuiltinDefinition[] = [
  defineBuiltin("c", [], "behavioral", builtinC),
  defineBuiltin("length", ["x"], "behavioral", builtinLength),
  defineBuiltin("sum", ["...", "na.rm"], "numeric", builtinSum),
  defineBuiltin("mean", ["x", "na.rm"], "behavioral", builtinMean),
  defineBuiltin("sqrt", ["x"], "numeric", (invocation) => builtinMath(invocation, "sqrt")),
  defineBuiltin("abs", ["x"], "numeric", (invocation) => builtinMath(invocation, "abs")),
  defineBuiltin("is.na", ["x"], "behavioral", builtinIsNa),
  defineBuiltin("is.nan", ["x"], "behavioral", builtinIsNan),
];

function defineBuiltin(
  name: string,
  supportedArguments: readonly string[],
  compatibilityLevel: "api" | "shape" | "numeric" | "behavioral",
  implementation: BuiltinDefinition["implementation"],
): BuiltinDefinition {
  return {
    package: "base",
    name,
    kind: "regular",
    metadata: {
      package: "base",
      name,
      compatibilityLevel,
      referenceVersion: "R 4.6.x documented behavior",
      supportedArguments,
      unsupportedBehavior: ["partial argument matching", "attributes beyond basic type/length"],
    },
    implementation,
  };
}

async function builtinC(invocation: BuiltinInvocation): Promise<RValue> {
  rejectNamed(invocation.arguments, "c");
  const values = await forceAll(invocation);
  const atomic = values.filter((value) => value.type !== "null");
  if (atomic.length === 0) return R_NULL;
  if (!atomic.every(isAtomic)) {
    throw new RUnsupportedFeatureError("NRU6101", "c() currently combines atomic vectors only.");
  }

  const vectors = atomic as AtomicVector[];
  const type = commonType(vectors);
  const length = vectors.reduce((total, vector) => total + vector.length, 0);
  invocation.context.allocate(length);
  const mask = new Uint8Array(length);
  let offset = 0;

  if (type === "character") {
    const output: string[] = [];
    for (const vector of vectors) {
      for (let index = 0; index < vector.length; index += 1) {
        invocation.context.checkpoint();
        if (isMissing(vector, index)) mask[offset] = 1;
        output.push(stringAt(vector, index));
        offset += 1;
      }
    }
    return characterVector(output, compactMask(mask));
  }
  if (type === "double") {
    const output = new Float64Array(length);
    for (const vector of vectors) {
      for (let index = 0; index < vector.length; index += 1) {
        invocation.context.checkpoint();
        if (isMissing(vector, index)) mask[offset] = 1;
        output[offset] = numberAt(vector, index);
        offset += 1;
      }
    }
    return doubleVector(output, compactMask(mask));
  }
  if (type === "integer") {
    const output = new Int32Array(length);
    for (const vector of vectors) {
      for (let index = 0; index < vector.length; index += 1) {
        invocation.context.checkpoint();
        if (isMissing(vector, index)) mask[offset] = 1;
        output[offset] = numberAt(vector, index);
        offset += 1;
      }
    }
    return integerVector(output, compactMask(mask));
  }

  const output = new Uint8Array(length);
  for (const vector of vectors) {
    for (let index = 0; index < vector.length; index += 1) {
      invocation.context.checkpoint();
      if (isMissing(vector, index)) mask[offset] = 1;
      output[offset] = numberAt(vector, index) === 0 ? 0 : 1;
      offset += 1;
    }
  }
  return logicalVector(output, compactMask(mask));
}

async function builtinLength(invocation: BuiltinInvocation): Promise<RValue> {
  const matched = await matchExact(invocation, ["x"]);
  const value = required(matched, "x", "length");
  let length: number;
  switch (value.type) {
    case "null":
      length = 0;
      break;
    case "logical":
    case "integer":
    case "double":
    case "character":
    case "list":
      length = value.length;
      break;
    default:
      throw new RUnsupportedFeatureError(
        "NRU6102",
        `length() does not yet support values of type '${value.type}'.`,
      );
  }
  invocation.context.allocate(1);
  return integerVector([length]);
}

async function builtinMean(invocation: BuiltinInvocation): Promise<RValue> {
  const matched = await matchExact(invocation, ["x", "na.rm"]);
  const value = requireNumeric(required(matched, "x", "mean"), "mean");
  const removeMissing = logicalFlag(matched.get("na.rm"), false, "na.rm");
  let total = 0;
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    invocation.context.checkpoint();
    const item = numberAt(value, index);
    const missing = isMissing(value, index);
    const nan = Number.isNaN(item);
    if (missing) {
      if (!removeMissing) return doubleVector([0], [1]);
    } else if (nan) {
      if (!removeMissing) return doubleVector([Number.NaN]);
    } else {
      total += item;
      count += 1;
    }
  }
  invocation.context.allocate(1);
  return doubleVector([count === 0 ? Number.NaN : total / count]);
}

async function builtinSum(invocation: BuiltinInvocation): Promise<RValue> {
  const named = invocation.arguments.filter((argument) => argument.name !== undefined);
  for (const argument of named) {
    if (argument.name !== "na.rm") {
      throw new REvaluationError("NRE2101", `Unused argument '${argument.name ?? ""}' in sum().`);
    }
  }
  if (named.length > 1) {
    throw new REvaluationError("NRE2102", "Argument 'na.rm' matched more than once in sum().");
  }
  const firstNamed = named[0];
  const removeMissing =
    firstNamed === undefined
      ? false
      : logicalFlag(await invocation.force(firstNamed.promise), false, "na.rm");
  const inputs: NumericVector[] = [];
  for (const argument of invocation.arguments.filter((item) => item.name === undefined)) {
    inputs.push(requireNumeric(await invocation.force(argument.promise), "sum"));
  }
  let total = 0;
  for (const input of inputs) {
    for (let index = 0; index < input.length; index += 1) {
      invocation.context.checkpoint();
      const item = numberAt(input, index);
      if (isMissing(input, index)) {
        if (!removeMissing) return doubleVector([0], [1]);
      } else if (Number.isNaN(item)) {
        if (!removeMissing) return doubleVector([Number.NaN]);
      } else {
        total += item;
      }
    }
  }
  invocation.context.allocate(1);
  return doubleVector([total]);
}

async function builtinMath(
  invocation: BuiltinInvocation,
  operation: "sqrt" | "abs",
): Promise<RValue> {
  const matched = await matchExact(invocation, ["x"]);
  const input = requireNumeric(required(matched, "x", operation), operation);
  invocation.context.allocate(input.length);
  const output = new Float64Array(input.length);
  let producedNaN = false;
  for (let index = 0; index < input.length; index += 1) {
    invocation.context.checkpoint();
    const item = numberAt(input, index);
    const result = operation === "sqrt" ? Math.sqrt(item) : Math.abs(item);
    if (!Number.isNaN(item) && Number.isNaN(result) && !isMissing(input, index)) producedNaN = true;
    output[index] = result;
  }
  if (producedNaN) {
    invocation.context.warn({ code: "NRW1003", message: "NaNs produced." });
  }
  return doubleVector(output, input.missing);
}

async function builtinIsNa(invocation: BuiltinInvocation): Promise<RValue> {
  const matched = await matchExact(invocation, ["x"]);
  const input = required(matched, "x", "is.na");
  if (!isAtomic(input)) {
    throw new RUnsupportedFeatureError("NRU6103", "is.na() currently supports atomic vectors.");
  }
  invocation.context.allocate(input.length);
  const output = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    invocation.context.checkpoint();
    output[index] =
      isMissing(input, index) || (input.type === "double" && Number.isNaN(input.values[index]))
        ? 1
        : 0;
  }
  return logicalVector(output);
}

async function builtinIsNan(invocation: BuiltinInvocation): Promise<RValue> {
  const matched = await matchExact(invocation, ["x"]);
  const input = required(matched, "x", "is.nan");
  if (!isAtomic(input)) {
    throw new RUnsupportedFeatureError("NRU6104", "is.nan() currently supports atomic vectors.");
  }
  invocation.context.allocate(input.length);
  const output = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    invocation.context.checkpoint();
    output[index] =
      input.type === "double" && !isMissing(input, index) && Number.isNaN(input.values[index])
        ? 1
        : 0;
  }
  return logicalVector(output);
}

async function matchExact(
  invocation: BuiltinInvocation,
  parameterNames: readonly string[],
): Promise<Map<string, RValue>> {
  const matched = new Map<string, RValue>();
  let positionalIndex = 0;
  for (const argument of invocation.arguments) {
    const name = argument.name ?? parameterNames[positionalIndex++];
    if (name === undefined || !parameterNames.includes(name)) {
      throw new REvaluationError("NRE2101", "Unused argument.");
    }
    if (matched.has(name)) {
      throw new REvaluationError("NRE2102", `Argument '${name}' matched more than once.`);
    }
    matched.set(name, await invocation.force(argument.promise));
  }
  return matched;
}

async function forceAll(invocation: BuiltinInvocation): Promise<readonly RValue[]> {
  const values: RValue[] = [];
  for (const argument of invocation.arguments) {
    values.push(await invocation.force(argument.promise));
  }
  return values;
}

function rejectNamed(arguments_: readonly BuiltinCallArgument[], name: string): void {
  const named = arguments_.find((argument) => argument.name !== undefined);
  if (named !== undefined) {
    throw new RUnsupportedFeatureError(
      "NRU6105",
      `${name}() named arguments require attribute support and are not implemented.`,
    );
  }
}

function required(values: ReadonlyMap<string, RValue>, name: string, call: string): RValue {
  const value = values.get(name);
  if (value === undefined) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in ${call}().`);
  }
  return value;
}

function requireNumeric(value: RValue, call: string): NumericVector {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3102", `${call}() requires a numeric or logical vector.`, {
      details: { type: value.type },
    });
  }
  return value;
}

function logicalFlag(value: RValue | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3103", `'${name}' must be one non-missing logical value.`);
  }
  return value.values[0] === 1;
}

function commonType(vectors: readonly AtomicVector[]): AtomicVector["type"] {
  if (vectors.some((vector) => vector.type === "character")) return "character";
  if (vectors.some((vector) => vector.type === "double")) return "double";
  if (vectors.some((vector) => vector.type === "integer")) return "integer";
  return "logical";
}

function numberAt(vector: AtomicVector, index: number): number {
  if (vector.type === "character") return Number(vector.values[index] ?? "");
  return vector.values[index] ?? 0;
}

function stringAt(vector: AtomicVector, index: number): string {
  if (vector.type === "character") return vector.values[index] ?? "";
  if (vector.type === "logical") return vector.values[index] === 1 ? "TRUE" : "FALSE";
  return String(vector.values[index] ?? 0);
}

function compactMask(mask: Uint8Array): Uint8Array | undefined {
  return mask.some((item) => item === 1) ? mask : undefined;
}
