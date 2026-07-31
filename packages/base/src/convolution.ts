import {
  REvaluationError,
  RTypeMismatchError,
  complexVector,
  doubleVector,
  isFactor,
  isMissing,
  vectorDimensions,
  vectorNames,
  withNames,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  RComplexVector,
  RDoubleVector,
  RIntegerVector,
  RLogicalVector,
  RValue,
  RVector,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";
import { transformFourier } from "./fourier.js";

export interface ConvolutionBuiltinSpec {
  readonly name: string;
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

export const CONVOLUTION_BUILTIN_SPECS: readonly ConvolutionBuiltinSpec[] = [
  {
    name: "convolve",
    parameters: ["x", "y", "conj", "type"],
    compatibility: "numeric",
    implementation: builtinConvolve,
  },
];

type ConvolutionInput = RLogicalVector | RIntegerVector | RDoubleVector | RComplexVector;
type ConvolutionType = "circular" | "open" | "filter";

async function builtinConvolve(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "y", "conj", "type"]);
  const type = await convolutionType(invocation, matched.get("type"));
  const xArgument = matched.get("x");
  const yArgument = matched.get("y");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in convolve().");
  }
  if (yArgument === undefined || yArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'y' is missing in convolve().");
  }
  const xValue = await invocation.force(xArgument.promise);
  const yValue = await invocation.force(yArgument.promise);
  const xLength = vectorLength(xValue);
  const yLength = vectorLength(yValue);
  if (type === "circular" && xLength !== yLength) {
    throw new RTypeMismatchError("NRT3269", "length mismatch in convolution");
  }
  if (type !== "circular" && (xLength === 0 || yLength === 0)) {
    throw new RTypeMismatchError("NRT3269", "invalid 'times' value");
  }
  const x = convolutionInput(xValue);
  const y = convolutionInput(yValue);
  const conjugate = await convolutionFlag(invocation, matched.get("conj"));
  const outputLength =
    type === "circular"
      ? x.length
      : type === "open"
        ? x.length + y.length - 1
        : Math.max(0, x.length - y.length + 1);
  invocation.context.allocate(outputLength);
  const realOutput = isRealConvolutionInput(x) && isRealConvolutionInput(y);
  if (isFactor(x) || isFactor(y)) {
    invocation.context.warn({
      code: "NRW1103",
      message: "'*' not meaningful for factors",
    });
    return attachConvolutionAttributes(
      complexVector(
        new Float64Array(outputLength),
        new Float64Array(outputLength),
        missingMask(outputLength),
      ),
      x,
      y,
      type,
    );
  }
  if (hasMissing(x) || hasMissing(y)) {
    const output = realOutput
      ? doubleVector(new Float64Array(outputLength), missingMask(outputLength))
      : complexVector(
          new Float64Array(outputLength),
          new Float64Array(outputLength),
          missingMask(outputLength),
        );
    return attachConvolutionAttributes(output, x, y, type);
  }
  if (hasNan(x) || hasNan(y)) {
    const nan = new Float64Array(outputLength).fill(Number.NaN);
    const output = realOutput ? doubleVector(nan) : complexVector(nan, nan);
    return attachConvolutionAttributes(output, x, y, type);
  }
  const real = new Float64Array(outputLength);
  const imaginary = new Float64Array(outputLength);
  const attributeSource = x.attributes.size > 0 ? x : y;
  const dimensions = type === "circular" ? vectorDimensions(attributeSource) : undefined;
  if (dimensions === undefined && x.length * y.length > 4096) {
    fastConvolution(x, y, type, conjugate, real, imaginary, invocation);
  } else {
    for (let xIndex = 0; xIndex < x.length; xIndex += 1) {
      const left = complexAt(x, xIndex);
      for (let yIndex = 0; yIndex < y.length; yIndex += 1) {
        invocation.context.checkpoint();
        let outputIndex: number;
        if (type === "circular") {
          outputIndex = circularIndex(xIndex, yIndex, dimensions, !conjugate, outputLength);
        } else if (conjugate) {
          outputIndex = xIndex - yIndex + (type === "open" ? y.length - 1 : 0);
        } else {
          outputIndex =
            type === "open" ? (xIndex + yIndex + y.length - 1) % outputLength : xIndex + yIndex;
        }
        if (outputIndex < 0 || outputIndex >= outputLength) continue;
        accumulateProduct(real, imaginary, outputIndex, left, complexAt(y, yIndex), conjugate);
      }
    }
  }
  const output = realOutput ? doubleVector(real) : complexVector(real, imaginary);
  return attachConvolutionAttributes(output, x, y, type);
}

function fastConvolution(
  x: ConvolutionInput,
  y: ConvolutionInput,
  type: ConvolutionType,
  conjugate: boolean,
  outputReal: Float64Array,
  outputImaginary: Float64Array,
  invocation: BuiltinInvocation,
): void {
  const transformLength = type === "circular" ? x.length : x.length + y.length - 1;
  invocation.context.allocate(transformLength);
  invocation.context.allocate(transformLength);
  invocation.context.allocate(transformLength);
  invocation.context.allocate(transformLength);
  const xReal = new Float64Array(transformLength);
  const xImaginary = new Float64Array(transformLength);
  const yReal = new Float64Array(transformLength);
  const yImaginary = new Float64Array(transformLength);
  copyComplex(x, xReal, xImaginary);
  copyComplex(y, yReal, yImaginary);
  if (type !== "circular" && conjugate) {
    for (let index = 0; index < y.length; index += 1) {
      yReal[index] = complexAt(y, y.length - 1 - index).real;
      yImaginary[index] = -complexAt(y, y.length - 1 - index).imaginary;
    }
  }
  transformFourier(xReal, xImaginary, false, invocation.context);
  transformFourier(yReal, yImaginary, false, invocation.context);
  for (let index = 0; index < transformLength; index += 1) {
    const rightImaginary =
      type === "circular" && conjugate ? -yImaginary[index]! : yImaginary[index]!;
    const nextReal = xReal[index]! * yReal[index]! - xImaginary[index]! * rightImaginary;
    xImaginary[index] = xReal[index]! * rightImaginary + xImaginary[index]! * yReal[index]!;
    xReal[index] = nextReal;
  }
  transformFourier(xReal, xImaginary, true, invocation.context);
  for (let index = 0; index < outputReal.length; index += 1) {
    const source =
      type === "circular"
        ? index
        : conjugate
          ? index + (type === "filter" ? y.length - 1 : 0)
          : type === "open"
            ? (index - (y.length - 1) + transformLength) % transformLength
            : index;
    outputReal[index] = xReal[source]!;
    outputImaginary[index] = xImaginary[source]!;
  }
}

function copyComplex(input: ConvolutionInput, real: Float64Array, imaginary: Float64Array): void {
  if (input.type === "complex") {
    real.set(input.real);
    imaginary.set(input.imaginary);
  } else {
    real.set(input.values);
  }
}

function accumulateProduct(
  real: Float64Array,
  imaginary: Float64Array,
  index: number,
  left: { readonly real: number; readonly imaginary: number },
  right: { readonly real: number; readonly imaginary: number },
  conjugate: boolean,
): void {
  const rightImaginary = conjugate ? -right.imaginary : right.imaginary;
  real[index] = real[index]! + left.real * right.real - left.imaginary * rightImaginary;
  imaginary[index] = imaginary[index]! + left.real * rightImaginary + left.imaginary * right.real;
}

function circularIndex(
  left: number,
  right: number,
  dimensions: readonly number[] | undefined,
  add: boolean,
  length: number,
): number {
  if (dimensions === undefined) {
    return (left + (add ? right : -right) + length) % length;
  }
  let output = 0;
  let stride = 1;
  for (const dimension of dimensions) {
    const leftCoordinate = Math.floor(left / stride) % dimension;
    const rightCoordinate = Math.floor(right / stride) % dimension;
    output +=
      ((leftCoordinate + (add ? rightCoordinate : -rightCoordinate) + dimension) % dimension) *
      stride;
    stride *= dimension;
  }
  return output;
}

function attachConvolutionAttributes<T extends RVector>(
  output: T,
  x: ConvolutionInput,
  y: ConvolutionInput,
  type: ConvolutionType,
): T {
  if (output.length === 0) return output;
  if (type === "circular") {
    const attributes = x.attributes.size > 0 ? x.attributes : y.attributes;
    return attributes.size === 0 ? output : { ...output, attributes };
  }
  const xNames = vectorNames(x);
  const yNames = vectorNames(y);
  if (xNames === undefined && yNames === undefined) return output;
  const names =
    xNames === undefined
      ? [...(yNames ?? []), ...Array.from({ length: x.length - 1 }, () => "")]
      : [...Array.from({ length: y.length - 1 }, () => ""), ...xNames];
  return withNames(
    output,
    type === "filter" ? names.slice(y.length - 1, y.length - 1 + output.length) : names,
  );
}

function vectorLength(value: RValue): number {
  if ("length" in value && typeof value.length === "number") return value.length;
  throw new RTypeMismatchError("NRT3269", "non-numeric argument");
}

function convolutionInput(value: RValue): ConvolutionInput {
  if (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "complex"
  ) {
    return value;
  }
  throw new RTypeMismatchError("NRT3269", "non-numeric argument");
}

function isRealConvolutionInput(value: ConvolutionInput): boolean {
  return (value.type === "integer" || value.type === "double") && !isFactor(value);
}

function complexAt(
  value: ConvolutionInput,
  index: number,
): { readonly real: number; readonly imaginary: number } {
  return value.type === "complex"
    ? { real: value.real[index] ?? 0, imaginary: value.imaginary[index] ?? 0 }
    : { real: value.values[index] ?? 0, imaginary: 0 };
}

function hasMissing(value: ConvolutionInput): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (isMissing(value, index)) return true;
  }
  return false;
}

function hasNan(value: ConvolutionInput): boolean {
  if (value.type === "complex") {
    return value.real.some(Number.isNaN) || value.imaginary.some(Number.isNaN);
  }
  return value.type === "double" && value.values.some(Number.isNaN);
}

function missingMask(length: number): Uint8Array {
  return new Uint8Array(length).fill(1);
}

async function convolutionType(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<ConvolutionType> {
  if (argument === undefined || argument.promise.missing) return "circular";
  const value = await invocation.force(argument.promise);
  if (value.type === "null") return "circular";
  if (value.type !== "character" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3269", "'arg' must be one non-missing character value.");
  }
  const requested = value.values[0] ?? "";
  const choices: readonly ConvolutionType[] = ["circular", "open", "filter"];
  const matches = choices.filter((choice) => choice.startsWith(requested));
  if (matches.length !== 1) {
    throw new RTypeMismatchError("NRT3269", `'arg' should be one of "circular", "open", "filter"`);
  }
  return matches[0] ?? "circular";
}

async function convolutionFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return true;
  const value = await invocation.force(argument.promise);
  if (!("length" in value) || typeof value.length !== "number" || value.length === 0) {
    throw new RTypeMismatchError("NRT3269", "argument is of length zero");
  }
  if (value.length > 1) {
    throw new RTypeMismatchError("NRT3269", "the condition has length > 1");
  }
  if (
    (value.type === "logical" || value.type === "integer" || value.type === "double") &&
    !isFactor(value)
  ) {
    if (isMissing(value, 0)) {
      throw new RTypeMismatchError("NRT3269", "missing value where TRUE/FALSE needed");
    }
    const numeric = value.values[0] ?? 0;
    if (Number.isNaN(numeric)) {
      throw new RTypeMismatchError("NRT3269", "argument is not interpretable as logical");
    }
    return numeric !== 0;
  }
  if (value.type === "character" && !isMissing(value, 0)) {
    if (value.values[0] === "TRUE" || value.values[0] === "T") return true;
    if (value.values[0] === "FALSE" || value.values[0] === "F") return false;
  }
  throw new RTypeMismatchError("NRT3269", "argument is not interpretable as logical");
}
