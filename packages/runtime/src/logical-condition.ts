import { RTypeMismatchError } from "./errors.js";
import { languageAstEntries } from "./language.js";
import { isAtomic, isMissing } from "./values.js";
import type { RValue } from "./values.js";

/** Observable character spellings accepted by logical coercion, without whitespace folding. */
export function parseLogicalString(text: string): boolean | undefined {
  if (text === "T" || text === "TRUE" || text === "True" || text === "true") return true;
  if (text === "F" || text === "FALSE" || text === "False" || text === "false") return false;
  return undefined;
}

/** Scalar conditional coercion; class conversion methods are not dispatched. */
export function logicalCondition(value: RValue): boolean {
  const length =
    value.type === "null"
      ? 0
      : "length" in value
        ? value.length
        : value.type === "environment"
          ? value.bindings.size
          : value.type === "language"
            ? (languageAstEntries(value.expression)?.nodes.length ?? 1)
            : value.type === "formula"
              ? value.response === undefined
                ? 2
                : 3
              : 1;
  const invalid = (message: string): never => {
    throw new RTypeMismatchError("NRT3399", message);
  };
  if (length === 0) return invalid("argument is of length zero");
  if (length > 1) return invalid("the condition has length > 1");
  if (!isAtomic(value)) return invalid("argument is not interpretable as logical");
  if (isMissing(value, 0)) {
    return invalid(
      value.type === "logical"
        ? "missing value where TRUE/FALSE needed"
        : "argument is not interpretable as logical",
    );
  }
  if (value.type === "character") {
    return (
      parseLogicalString(value.values[0] ?? "") ??
      invalid("argument is not interpretable as logical")
    );
  }
  if (value.type === "complex") {
    const real = value.real[0] ?? 0,
      imaginary = value.imaginary[0] ?? 0;
    if (Number.isNaN(real) || Number.isNaN(imaginary))
      return invalid("argument is not interpretable as logical");
    return real !== 0 || imaginary !== 0;
  }
  const scalar = value.values[0] ?? 0;
  if (Number.isNaN(scalar)) return invalid("argument is not interpretable as logical");
  return scalar !== 0;
}
