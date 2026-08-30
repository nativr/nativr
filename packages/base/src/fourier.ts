import {
  REvaluationError,
  RTypeMismatchError,
  complexVector,
  isMissing,
  vectorDimensions,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  OperatorContext,
  RComplexVector,
  RDoubleVector,
  RIntegerVector,
  RLogicalVector,
  RValue,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";

type FourierInput = RLogicalVector | RIntegerVector | RDoubleVector | RComplexVector;

export const FFT_BUILTIN_SPEC = {
  name: "fft",
  parameters: ["z", "inverse"],
  compatibility: "numeric" as const,
  implementation: builtinFft,
};

async function builtinFft(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["z", "inverse"]);
  const inputArgument = matched.get("z");
  if (inputArgument === undefined || inputArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'z' is missing in fft().");
  }
  const input = fourierInput(await invocation.force(inputArgument.promise));
  const inverse = await fourierInverseFlag(invocation, matched.get("inverse"));
  invocation.context.allocate(input.length);
  invocation.context.allocate(input.length);
  const real = new Float64Array(input.length);
  const imaginary = new Float64Array(input.length);
  if (input.type === "complex") {
    real.set(input.real);
    imaginary.set(input.imaginary);
  } else {
    real.set(input.values);
  }

  if (hasFourierMissing(input)) {
    const output = complexVector(real, imaginary, new Uint8Array(input.length).fill(1));
    return { ...output, attributes: new Map(input.attributes) };
  }

  const dimensions = vectorDimensions(input);
  if (dimensions === undefined) {
    transformFourier(real, imaginary, inverse, invocation.context);
  } else {
    transformFourierAxes(real, imaginary, dimensions, inverse, invocation.context);
  }
  if (inverse) {
    for (let index = 0; index < input.length; index += 1) {
      real[index] = real[index]! * input.length;
      imaginary[index] = imaginary[index]! * input.length;
    }
  }
  const output = complexVector(real, imaginary);
  return { ...output, attributes: new Map(input.attributes) };
}

function fourierInput(value: RValue): FourierInput {
  if (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "complex"
  ) {
    return value;
  }
  throw new RTypeMismatchError("NRT3466", "non-numeric argument");
}

function hasFourierMissing(input: FourierInput): boolean {
  for (let index = 0; index < input.length; index += 1) {
    if (isMissing(input, index)) return true;
  }
  return false;
}

async function fourierInverseFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return false;
  const value = await invocation.force(argument.promise);
  if (!("length" in value) || value.length === 0 || isMissing(value, 0)) return false;
  switch (value.type) {
    case "logical":
    case "integer":
    case "double":
    case "raw":
      return (value.values[0] ?? 0) !== 0 && !Number.isNaN(value.values[0] ?? 0);
    case "complex":
      return (
        (!Number.isNaN(value.real[0] ?? 0) || !Number.isNaN(value.imaginary[0] ?? 0)) &&
        ((value.real[0] ?? 0) !== 0 || (value.imaginary[0] ?? 0) !== 0)
      );
    case "character": {
      const text = (value.values[0] ?? "").toUpperCase();
      return text === "TRUE" || text === "T";
    }
    default:
      return false;
  }
}

function transformFourierAxes(
  real: Float64Array,
  imaginary: Float64Array,
  dimensions: readonly number[],
  inverse: boolean,
  context: OperatorContext,
): void {
  let stride = 1;
  for (const axisLength of dimensions) {
    if (axisLength > 1) {
      const blockLength = stride * axisLength;
      const blockCount = real.length / blockLength;
      context.allocate(axisLength);
      context.allocate(axisLength);
      const axisReal = new Float64Array(axisLength);
      const axisImaginary = new Float64Array(axisLength);
      for (let block = 0; block < blockCount; block += 1) {
        const blockStart = block * blockLength;
        for (let offset = 0; offset < stride; offset += 1) {
          for (let coordinate = 0; coordinate < axisLength; coordinate += 1) {
            const index = blockStart + offset + coordinate * stride;
            axisReal[coordinate] = real[index]!;
            axisImaginary[coordinate] = imaginary[index]!;
          }
          transformFourier(axisReal, axisImaginary, inverse, context);
          for (let coordinate = 0; coordinate < axisLength; coordinate += 1) {
            const index = blockStart + offset + coordinate * stride;
            real[index] = axisReal[coordinate]!;
            imaginary[index] = axisImaginary[coordinate]!;
          }
        }
      }
    }
    stride *= axisLength;
  }
}

/** In-place browser-native complex DFT. Inverse transforms include the 1/n normalization. */
export function transformFourier(
  real: Float64Array,
  imaginary: Float64Array,
  inverse: boolean,
  context: OperatorContext,
): void {
  if (real.length !== imaginary.length) throw new Error();
  if (real.length <= 1) return;
  if (inverse) {
    for (let index = 0; index < imaginary.length; index += 1) imaginary[index] = -imaginary[index]!;
    transformFourier(real, imaginary, false, context);
    for (let index = 0; index < real.length; index += 1) {
      real[index] = real[index]! / real.length;
      imaginary[index] = -imaginary[index]! / real.length;
    }
    return;
  }
  if ((real.length & (real.length - 1)) === 0) transformRadixTwo(real, imaginary, context);
  else transformBluestein(real, imaginary, context);
}

function transformRadixTwo(
  real: Float64Array,
  imaginary: Float64Array,
  context: OperatorContext,
): void {
  const length = real.length;
  for (let index = 1, reversed = 0; index < length; index += 1) {
    let bit = length >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed]!, real[index]!];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed]!, imaginary[index]!];
    }
  }
  for (let size = 2; size <= length; size *= 2) {
    const angle = (-2 * Math.PI) / size;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let offset = 0; offset < size / 2; offset += 1) {
        context.checkpoint();
        const even = start + offset;
        const odd = even + size / 2;
        const oddReal = twiddleReal * real[odd]! - twiddleImaginary * imaginary[odd]!;
        const oddImaginary = twiddleReal * imaginary[odd]! + twiddleImaginary * real[odd]!;
        const evenReal = real[even]!;
        const evenImaginary = imaginary[even]!;
        real[even] = evenReal + oddReal;
        imaginary[even] = evenImaginary + oddImaginary;
        real[odd] = evenReal - oddReal;
        imaginary[odd] = evenImaginary - oddImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
}

function transformBluestein(
  real: Float64Array,
  imaginary: Float64Array,
  context: OperatorContext,
): void {
  const length = real.length;
  let convolutionLength = 1;
  while (convolutionLength < length * 2 - 1) convolutionLength *= 2;
  context.allocate(convolutionLength);
  context.allocate(convolutionLength);
  context.allocate(convolutionLength);
  context.allocate(convolutionLength);
  const leftReal = new Float64Array(convolutionLength);
  const leftImaginary = new Float64Array(convolutionLength);
  const rightReal = new Float64Array(convolutionLength);
  const rightImaginary = new Float64Array(convolutionLength);
  for (let index = 0; index < length; index += 1) {
    const angle = (Math.PI * ((index * index) % (length * 2))) / length;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    leftReal[index] = real[index]! * cosine + imaginary[index]! * sine;
    leftImaginary[index] = imaginary[index]! * cosine - real[index]! * sine;
    rightReal[index] = cosine;
    rightImaginary[index] = sine;
    if (index > 0) {
      rightReal[convolutionLength - index] = cosine;
      rightImaginary[convolutionLength - index] = sine;
    }
  }
  transformRadixTwo(leftReal, leftImaginary, context);
  transformRadixTwo(rightReal, rightImaginary, context);
  for (let index = 0; index < convolutionLength; index += 1) {
    const nextReal =
      leftReal[index]! * rightReal[index]! - leftImaginary[index]! * rightImaginary[index]!;
    leftImaginary[index] =
      leftReal[index]! * rightImaginary[index]! + leftImaginary[index]! * rightReal[index]!;
    leftReal[index] = nextReal;
  }
  transformFourier(leftReal, leftImaginary, true, context);
  for (let index = 0; index < length; index += 1) {
    const angle = (Math.PI * ((index * index) % (length * 2))) / length;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    real[index] = leftReal[index]! * cosine + leftImaginary[index]! * sine;
    imaginary[index] = leftImaginary[index]! * cosine - leftReal[index]! * sine;
  }
}
