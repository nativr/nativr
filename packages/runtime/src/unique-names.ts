import { characterVector, isMissing } from "./values.js";
import type { OperatorContext, RCharacterVector } from "./values.js";

/** Owned name repair shared by make.unique and data-frame row selection. */
export function makeUniqueNames(
  input: RCharacterVector,
  separator: string,
  context: OperatorContext,
): RCharacterVector {
  for (let buffer = 0; buffer < 5; buffer++) context.allocate(input.length);
  const used = new Set<string>();
  for (let index = 0; index < input.length; index++) {
    context.checkpoint();
    if (!isMissing(input, index)) used.add(input.values[index]!);
  }
  const seen = new Set<string>(),
    nextSuffix = new Map<string, number>();
  const values = new Array<string>(input.length),
    missing = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index++) {
    context.checkpoint();
    const absent = isMissing(input, index),
      value = absent ? "NA" : input.values[index]!;
    const key = absent ? "\u0000NA" : `\u0001${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      values[index] = value;
      missing[index] = Number(absent);
      continue;
    }
    let suffix = nextSuffix.get(key) ?? 1;
    let candidate = `${value}${separator}${suffix}`;
    while (used.has(candidate)) {
      context.checkpoint();
      candidate = `${value}${separator}${++suffix}`;
    }
    nextSuffix.set(key, suffix + 1);
    used.add(candidate);
    values[index] = candidate;
  }
  return characterVector(values, missing);
}
