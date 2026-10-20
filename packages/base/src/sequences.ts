import type { AstNode, SourceSpan } from "@nativr/ast";
import {
  R_NULL,
  REvaluationError,
  RResourceLimitError,
  RTypeMismatchError,
  characterVector,
  complexVector,
  deparseDiagnosticAst,
  doubleVector,
  integerVector,
  isFactor,
  isMissing,
  isVector,
  listValue,
  recordErrorConditionCall,
  withClasses,
} from "@nativr/runtime";
import type { BuiltinInvocation, RValue } from "@nativr/runtime";
import { matchBuiltinDefaults } from "./arguments.js";
import type { BuiltinDefaultParameter } from "./arguments.js";

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};
const number = (value: number): AstNode => ({ kind: "DoubleLiteral", value, span });
const identifier = (name: string): AstNode => ({ kind: "Identifier", name, span });
const binary = (operator: string, left: AstNode, right: AstNode): AstNode => ({
  kind: "BinaryExpression",
  operator,
  left,
  right,
  span,
});
const parenthesize = (value: AstNode): AstNode => ({
  kind: "CallExpression",
  callee: identifier("("),
  arguments: [{ value, span }],
  span,
});

/** Public signature metadata observed through args(), without reading implementation bodies. */
export const SEQUENCE_DEFAULT_FORMALS: readonly BuiltinDefaultParameter[] = [
  { name: "from", defaultValue: number(1) },
  { name: "to", defaultValue: number(1) },
  {
    name: "by",
    defaultValue: parenthesize(
      binary(
        "/",
        parenthesize(binary("-", identifier("to"), identifier("from"))),
        parenthesize(binary("-", identifier("length.out"), number(1))),
      ),
    ),
  },
  { name: "length.out", defaultValue: { kind: "NullLiteral", span } },
  { name: "along.with", defaultValue: { kind: "NullLiteral", span } },
  { name: "..." },
];

export async function sequenceDefault(invocation: BuiltinInvocation): Promise<RValue> {
  const bound = await matchBuiltinDefaults(invocation, SEQUENCE_DEFAULT_FORMALS);
  if (bound.dots.length > 0) {
    const call = invocation.currentCall();
    const names = bound.dots.map((argument) => `'${argument.name ?? ""}'`).join(", ");
    const message = `In ${call.type === "language" ? deparseDiagnosticAst(call.expression, () => invocation.context.checkpoint()) : "seq.default()"} :\n extra argument${bound.dots.length === 1 ? "" : "s"} ${names} will be disregarded`;
    await warn(invocation, message, false);
  }
  const fromSupplied = bound.supplied.has("from");
  const toSupplied = bound.supplied.has("to");
  const bySupplied = bound.supplied.has("by");
  const one = invocation.arguments.length === 1;
  const lengthSupplied = bound.supplied.has("length.out");
  const alongSupplied = bound.supplied.has("along.with");

  if (one && fromSupplied) {
    const value = await bound.force("from");
    if (
      (value.type !== "integer" && value.type !== "double") ||
      value.length !== 1 ||
      isFactor(value)
    ) {
      return sequenceValues(
        invocation,
        await dispatchedLength(value, invocation),
        (i) => i + 1,
        true,
      );
    }
    const end = scalar(value, "from");
    return colonSequence(invocation, 1, end);
  }

  let length: number | undefined;
  if (alongSupplied) {
    const along = await bound.force("along.with");
    // length() is a dispatch point for independently supplied classes.
    length = await dispatchedLength(along, invocation);
  } else if (lengthSupplied) {
    const value = await bound.force("length.out");
    const size = valueLength(value);
    if (size === 0) throw new RTypeMismatchError("NRT3322", "'length.out' must be of length 1");
    if (size > 1) await warn(invocation, "first element used of 'length.out' argument");
    length = outputLength(value);
  }
  if (one && (lengthSupplied || alongSupplied))
    return sequenceValues(invocation, length ?? 0, (i) => i + 1, true);

  // Endpoint promises are forced in formal order even when a zero length makes their values unused.
  const fromValue = await bound.force("from");
  const toValue = await bound.force("to");
  const from = scalar(fromValue, "from");
  const to = scalar(toValue, "to");
  if (length !== undefined) {
    if (length === 0) return integerVector([]);
    if (bySupplied && fromSupplied && toSupplied)
      throw new REvaluationError("NRE2160", "too many arguments");
    const byValue = bySupplied ? await bound.force("by") : undefined;
    const by = byValue === undefined ? 1 : scalar(byValue, "by");
    const start = fromSupplied || !toSupplied ? from : to - (length - 1) * by;
    const step =
      !bySupplied && fromSupplied && toSupplied && length > 1 ? (to - from) / (length - 1) : by;
    if (fromValue.type === "complex" || toValue.type === "complex" || byValue?.type === "complex") {
      const imaginaryFrom = imaginaryPart(fromValue);
      const imaginaryTo = imaginaryPart(toValue);
      const imaginaryBy = byValue === undefined ? 0 : imaginaryPart(byValue);
      const imaginaryStart =
        fromSupplied || !toSupplied ? imaginaryFrom : imaginaryTo - (length - 1) * imaginaryBy;
      const imaginaryStep =
        !bySupplied && fromSupplied && toSupplied && length > 1
          ? (imaginaryTo - imaginaryFrom) / (length - 1)
          : imaginaryBy;
      const interpolate = !bySupplied && fromSupplied && toSupplied && length > 1;
      invocation.context.allocate(length);
      const real = Array.from({ length }, (_, i) => {
        invocation.context.checkpoint();
        return interpolate && i === length - 1 ? to : start + step * i;
      });
      const imaginary = Array.from({ length }, (_, i) => {
        invocation.context.checkpoint();
        return interpolate && i === length - 1 ? imaginaryTo : imaginaryStart + imaginaryStep * i;
      });
      return complexVector(real, imaginary);
    }
    const integer =
      byValue?.type === "integer" &&
      (fromSupplied ? fromValue.type === "integer" : toSupplied && toValue.type === "integer");
    return sequenceValues(
      invocation,
      length,
      (i) =>
        !bySupplied && fromSupplied && toSupplied && length > 1 && i === length - 1
          ? to
          : start + step * i,
      integer,
    );
  }
  if (!bySupplied) {
    for (const value of [fromValue, toValue]) {
      if (value.type === "complex" && imaginaryPart(value) !== 0)
        await warn(invocation, "imaginary parts discarded in coercion");
    }
    return colonSequence(invocation, from, to);
  }
  const byValue = await bound.force("by");
  if (fromValue.type === "complex" || toValue.type === "complex" || byValue.type === "complex") {
    const error = new REvaluationError("NRE2160", "invalid comparison with complex values");
    recordErrorConditionCall(
      error,
      binary("<", identifier("n"), { kind: "IntegerLiteral", value: 0, span }),
    );
    throw error;
  }
  const by = scalar(byValue, "by", false);
  const delta = to - from;
  if (Number.isNaN(by)) throw new REvaluationError("NRE2160", "invalid '(to - from)/by'");
  if (delta === 0) return fromValue;
  const quotient = delta / by;
  if (!Number.isFinite(quotient)) throw new REvaluationError("NRE2160", "invalid '(to - from)/by'");
  if (quotient < 0) throw new REvaluationError("NRE2160", "wrong sign in 'by' argument");
  const count = Math.floor(quotient + 1e-10) + 1;
  const integer =
    fromValue.type === "integer" && toValue.type === "integer" && byValue.type === "integer";
  return sequenceValues(
    invocation,
    count,
    (i) => {
      const value = from + i * by;
      return i === count - 1 && Math.abs(value - to) <= Math.abs(delta) * 1e-10 ? to : value;
    },
    integer,
  );
}

function scalar(value: RValue, name: string, finite = true): number {
  if (!isVector(value) || value.length !== 1)
    throw new RTypeMismatchError("NRT3322", `'${name}' must be of length 1`);
  const result = isMissing(value, 0)
    ? Number.NaN
    : value.type === "character"
      ? Number(value.values[0])
      : value.type === "complex"
        ? (value.real[0] ?? Number.NaN)
        : value.type === "logical" ||
            value.type === "integer" ||
            value.type === "double" ||
            value.type === "raw"
          ? (value.values[0] ?? Number.NaN)
          : Number.NaN;
  if (finite && (!Number.isFinite(result) || !Number.isFinite(imaginaryPart(value))))
    throw new RTypeMismatchError("NRT3322", `'${name}' must be a finite number`);
  return result;
}

function imaginaryPart(value: RValue): number {
  return value.type === "complex" ? (value.imaginary[0] ?? Number.NaN) : 0;
}

function outputLength(value: RValue): number {
  if (value.type !== "integer" && value.type !== "double" && value.type !== "logical")
    throw new RTypeMismatchError("NRT3322", "non-numeric argument to mathematical function");
  const result = isMissing(value, 0) ? Number.NaN : (value.values[0] ?? Number.NaN);
  if (Number.isNaN(result) || result < 0)
    throw new RTypeMismatchError("NRT3322", "'length.out' must be a non-negative number");
  return Math.ceil(result);
}

function valueLength(value: RValue): number {
  if (isVector(value)) return value.length;
  if (value.type === "expression" || value.type === "pairlist") return value.values.length;
  return value.type === "null" ? 0 : 1;
}

async function dispatchedLength(value: RValue, invocation: BuiltinInvocation): Promise<number> {
  const callable = await invocation.namespaceBinding("base", "length");
  if (callable === undefined) throw new Error("The base length binding is unavailable.");
  return outputLength(await invocation.invoke(callable, [{ value }]));
}

function colonSequence(invocation: BuiltinInvocation, from: number, to: number): RValue {
  const count = Math.floor(Math.abs(to - from) + 1e-7) + 1;
  return sequenceValues(
    invocation,
    count,
    (i) => from + (to < from ? -i : i),
    Number.isInteger(from),
  );
}

function sequenceValues(
  invocation: BuiltinInvocation,
  count: number,
  at: (index: number) => number,
  integer: boolean,
): RValue {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new RResourceLimitError("NRL4010", "seq.default() requested an oversized sequence.");
  invocation.context.allocate(count);
  const values = Array.from({ length: count }, (_, index) => {
    invocation.context.checkpoint();
    return at(index);
  });
  return integer &&
    values.every((value) => Number.isInteger(value) && value > -2147483648 && value <= 2147483647)
    ? integerVector(values)
    : doubleVector(values);
}

async function warn(
  invocation: BuiltinInvocation,
  message: string,
  includeCall = true,
): Promise<void> {
  const call = includeCall ? invocation.currentCall() : R_NULL;
  await invocation.signalWarning(
    withClasses(listValue([characterVector([message]), call], ["message", "call"]), [
      ...(includeCall ? [] : ["chkDotsWarning"]),
      "simpleWarning",
      "warning",
      "condition",
    ]),
    {
      code: "NRW1201",
      message,
      ...(call.type === "language"
        ? { call: deparseDiagnosticAst(call.expression, () => invocation.context.checkpoint()) }
        : {}),
    },
  );
}
