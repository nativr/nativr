import type { OperatorContext } from "@nativr/runtime";

/** In-place browser-native complex DFT. Inverse transforms include the 1/n normalization. */
export function transformFourier(
  real: Float64Array,
  imaginary: Float64Array,
  inverse: boolean,
  context: OperatorContext,
): void {
  if (real.length !== imaginary.length) throw new Error("Fourier storage length mismatch.");
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
