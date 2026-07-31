import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  R_NULL,
  complexVector,
  doubleVector,
  isFactor,
  isMissing,
  listValue,
  vectorDimensions,
  withClasses,
  withDimensions,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue, RVector } from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

export interface EigenBuiltinSpec {
  readonly name: "eigen";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

interface ComplexNumber {
  readonly real: number;
  readonly imaginary: number;
}

interface SpectralResult {
  readonly values: readonly ComplexNumber[];
  readonly vectors: readonly (readonly ComplexNumber[])[];
}

export const EIGEN_BUILTIN_SPECS: readonly EigenBuiltinSpec[] = [
  {
    name: "eigen",
    parameters: ["x", "symmetric", "only.values", "EISPACK"],
    compatibility: "numeric",
    implementation: builtinEigen,
  },
];

async function builtinEigen(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, [
    "x",
    "symmetric",
    "only.values",
    "EISPACK",
  ]);
  const inputArgument = requiredEigenArgument(matched.get("x"));
  const input = await invocation.force(inputArgument.promise);
  if (
    (input.type !== "logical" && input.type !== "integer" && input.type !== "double") ||
    isFactor(input)
  ) {
    throw new RTypeMismatchError("NRT3282", "eigen() requires a square real numeric matrix.");
  }
  const dimensions = vectorDimensions(input);
  if (dimensions === undefined || dimensions.length !== 2 || dimensions[0] !== dimensions[1]) {
    throw new RTypeMismatchError("NRT3282", "eigen() requires a square real numeric matrix.");
  }
  const order = dimensions[0] ?? 0;
  if (order === 0) {
    throw new RTypeMismatchError("NRT3282", "eigen() requires a non-empty square matrix.");
  }
  invocation.context.allocate(order * order);
  const matrix = new Float64Array(order * order);
  for (let index = 0; index < matrix.length; index += 1) {
    invocation.context.checkpoint();
    const value = input.values[index] ?? Number.NaN;
    if (isMissing(input, index) || !Number.isFinite(value)) {
      throw new RTypeMismatchError("NRT3282", "infinite or missing values in 'x' are not allowed");
    }
    matrix[index] = value;
  }

  const symmetricArgument = matched.get("symmetric");
  const symmetric =
    symmetricArgument === undefined || symmetricArgument.promise.missing
      ? matrixIsSymmetric(matrix, order)
      : await eigenFlag(invocation, symmetricArgument, "symmetric");
  const onlyValues = await eigenFlag(invocation, matched.get("only.values"), "only.values", false);
  await eigenFlag(invocation, matched.get("EISPACK"), "EISPACK", false);

  const result = symmetric
    ? symmetricEigen(matrix, order, invocation)
    : generalEigen(matrix, order, invocation);
  const values = eigenValueVector(result.values, invocation);
  const vectors = onlyValues
    ? R_NULL
    : eigenVectorMatrix(result.vectors, result.values, order, invocation);
  const output = listValue([values, vectors], ["values", "vectors"]);
  return onlyValues ? output : withClasses(output, ["eigen"]);
}

function requiredEigenArgument(argument: BuiltinCallArgument | undefined): BuiltinCallArgument {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in eigen().");
  }
  return argument;
}

async function eigenFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
  fallback?: boolean,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback ?? false;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length < 1 ||
    isMissing(value, 0) ||
    Number.isNaN(value.values[0] ?? Number.NaN)
  ) {
    throw new RTypeMismatchError("NRT3282", `eigen() '${name}' must be one logical value.`);
  }
  return (value.values[0] ?? 0) !== 0;
}

function matrixIsSymmetric(matrix: Float64Array, order: number): boolean {
  let scale = 1;
  for (const value of matrix) scale = Math.max(scale, Math.abs(value));
  const tolerance = Math.sqrt(Number.EPSILON) * scale * Math.max(1, order);
  for (let column = 0; column < order; column += 1) {
    for (let row = column + 1; row < order; row += 1) {
      if (
        Math.abs((matrix[row + column * order] ?? 0) - (matrix[column + row * order] ?? 0)) >
        tolerance
      ) {
        return false;
      }
    }
  }
  return true;
}

function symmetricEigen(
  source: Float64Array,
  order: number,
  invocation: BuiltinInvocation,
): SpectralResult {
  invocation.context.allocate(order * order * 2);
  const matrix = new Float64Array(order * order);
  const vectors = new Float64Array(order * order);
  for (let row = 0; row < order; row += 1) {
    for (let column = 0; column < order; column += 1) {
      matrix[row * order + column] =
        row >= column ? (source[row + column * order] ?? 0) : (source[column + row * order] ?? 0);
    }
    vectors[row * order + row] = 1;
  }

  const maxIterations = Math.max(1, order * order * 100);
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    invocation.context.checkpoint();
    let pivotRow = 0;
    let pivotColumn = 0;
    let largestOffDiagonal = 0;
    let largestDiagonal = 0;
    for (let row = 0; row < order; row += 1) {
      largestDiagonal = Math.max(largestDiagonal, Math.abs(matrix[row * order + row] ?? 0));
      for (let column = row + 1; column < order; column += 1) {
        const candidate = Math.abs(matrix[row * order + column] ?? 0);
        if (candidate > largestOffDiagonal) {
          largestOffDiagonal = candidate;
          pivotRow = row;
          pivotColumn = column;
        }
      }
    }
    if (largestOffDiagonal <= Number.EPSILON * Math.max(1, largestDiagonal) * order) break;
    const app = matrix[pivotRow * order + pivotRow] ?? 0;
    const aqq = matrix[pivotColumn * order + pivotColumn] ?? 0;
    const apq = matrix[pivotRow * order + pivotColumn] ?? 0;
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let index = 0; index < order; index += 1) {
      if (index !== pivotRow && index !== pivotColumn) {
        const aip = matrix[index * order + pivotRow] ?? 0;
        const aiq = matrix[index * order + pivotColumn] ?? 0;
        const rotatedP = cosine * aip - sine * aiq;
        const rotatedQ = sine * aip + cosine * aiq;
        matrix[index * order + pivotRow] = rotatedP;
        matrix[pivotRow * order + index] = rotatedP;
        matrix[index * order + pivotColumn] = rotatedQ;
        matrix[pivotColumn * order + index] = rotatedQ;
      }
      const vip = vectors[index * order + pivotRow] ?? 0;
      const viq = vectors[index * order + pivotColumn] ?? 0;
      vectors[index * order + pivotRow] = cosine * vip - sine * viq;
      vectors[index * order + pivotColumn] = sine * vip + cosine * viq;
    }
    matrix[pivotRow * order + pivotRow] =
      cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq;
    matrix[pivotColumn * order + pivotColumn] =
      sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq;
    matrix[pivotRow * order + pivotColumn] = 0;
    matrix[pivotColumn * order + pivotRow] = 0;
  }

  const sorted = Array.from({ length: order }, (_, index) => index).sort(
    (left, right) => (matrix[right * order + right] ?? 0) - (matrix[left * order + left] ?? 0),
  );
  return {
    values: sorted.map((index) => complex(matrix[index * order + index] ?? 0)),
    vectors: sorted.map((column) =>
      Array.from({ length: order }, (_, row) => complex(vectors[row * order + column] ?? 0)),
    ),
  };
}

function generalEigen(
  matrix: Float64Array,
  order: number,
  invocation: BuiltinInvocation,
): SpectralResult {
  if (order > 3) {
    throw new RUnsupportedFeatureError(
      "NRU6137",
      "eigen() non-symmetric matrices are currently bounded to order 3.",
    );
  }
  const values = smallRealMatrixEigenvalues(matrix, order).sort(
    (left, right) => complexModulus(right) - complexModulus(left),
  );
  return {
    values,
    vectors: values.map((value) => smallRightEigenvector(matrix, order, value, invocation)),
  };
}

function smallRealMatrixEigenvalues(matrix: Float64Array, order: number): ComplexNumber[] {
  if (order === 1) return [complex(matrix[0] ?? 0)];
  if (order === 2) {
    const a = matrix[0] ?? 0;
    const c = matrix[1] ?? 0;
    const b = matrix[2] ?? 0;
    const d = matrix[3] ?? 0;
    const trace = a + d;
    const discriminant = trace * trace - 4 * (a * d - b * c);
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      return [complex((trace + root) / 2), complex((trace - root) / 2)];
    }
    const imaginary = Math.sqrt(-discriminant) / 2;
    return [
      { real: trace / 2, imaginary },
      { real: trace / 2, imaginary: -imaginary },
    ];
  }

  const a = matrix[0] ?? 0;
  const d = matrix[1] ?? 0;
  const g = matrix[2] ?? 0;
  const b = matrix[3] ?? 0;
  const e = matrix[4] ?? 0;
  const h = matrix[5] ?? 0;
  const c = matrix[6] ?? 0;
  const f = matrix[7] ?? 0;
  const i = matrix[8] ?? 0;
  const trace = a + e + i;
  const second = a * e + a * i + e * i - b * d - c * g - f * h;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const p = second - (trace * trace) / 3;
  const q = (-2 * trace * trace * trace) / 27 + (trace * second) / 3 - determinant;
  const discriminant = (q * q) / 4 + (p * p * p) / 27;
  const scale = Math.max(1, Math.abs(trace), Math.abs(second), Math.abs(determinant));
  const tolerance = Number.EPSILON * scale * scale * 64;
  if (discriminant >= -tolerance) {
    const root = Math.sqrt(Math.max(0, discriminant));
    const u = Math.cbrt(-q / 2 + root);
    const v = Math.cbrt(-q / 2 - root);
    const realRoot = u + v + trace / 3;
    const pairReal = -(u + v) / 2 + trace / 3;
    const pairImaginary = (Math.sqrt(3) / 2) * (u - v);
    return [
      complex(realRoot),
      { real: pairReal, imaginary: pairImaginary },
      { real: pairReal, imaginary: -pairImaginary },
    ];
  }
  const radius = 2 * Math.sqrt(-p / 3);
  const denominator = 2 * Math.sqrt(-(p * p * p) / 27);
  const angle = Math.acos(Math.max(-1, Math.min(1, -q / denominator)));
  return [0, 1, 2].map((index) =>
    complex(radius * Math.cos((angle + 2 * Math.PI * index) / 3) + trace / 3),
  );
}

function smallRightEigenvector(
  matrix: Float64Array,
  order: number,
  value: ComplexNumber,
  invocation: BuiltinInvocation,
): readonly ComplexNumber[] {
  if (order === 1) return [complex(1)];
  const rows = Array.from({ length: order }, (_, row) =>
    Array.from({ length: order }, (_, column) => ({
      real: (matrix[row + column * order] ?? 0) - (row === column ? value.real : 0),
      imaginary: row === column ? -value.imaginary : 0,
    })),
  );
  let candidate: ComplexNumber[];
  if (order === 2) {
    const firstNorm = rowNorm(rows[0] ?? []);
    const row = firstNorm >= rowNorm(rows[1] ?? []) ? (rows[0] ?? []) : (rows[1] ?? []);
    candidate = [complexNegate(row[1] ?? complex(0)), row[0] ?? complex(0)];
  } else {
    const candidates = [
      complexCross(rows[0] ?? [], rows[1] ?? []),
      complexCross(rows[0] ?? [], rows[2] ?? []),
      complexCross(rows[1] ?? [], rows[2] ?? []),
    ];
    candidate = candidates.reduce((best, current) =>
      rowNorm(current) > rowNorm(best) ? current : best,
    );
  }
  invocation.context.checkpoint();
  const norm = Math.sqrt(rowNorm(candidate));
  if (!(norm > Number.EPSILON)) {
    return Array.from({ length: order }, (_, index) => complex(index === 0 ? 1 : 0));
  }
  const normalized = candidate.map((item) => ({
    real: item.real / norm,
    imaginary: item.imaginary / norm,
  }));
  let pivot = normalized[0] ?? complex(1);
  for (const item of normalized) {
    if (complexModulus(item) > complexModulus(pivot)) pivot = item;
  }
  const pivotModulus = complexModulus(pivot);
  const phase =
    pivotModulus === 0
      ? complex(1)
      : { real: pivot.real / pivotModulus, imaginary: -pivot.imaginary / pivotModulus };
  return normalized.map((item) => complexMultiply(item, phase));
}

function complexCross(
  left: readonly ComplexNumber[],
  right: readonly ComplexNumber[],
): ComplexNumber[] {
  return [
    complexSubtract(
      complexMultiply(left[1] ?? complex(0), right[2] ?? complex(0)),
      complexMultiply(left[2] ?? complex(0), right[1] ?? complex(0)),
    ),
    complexSubtract(
      complexMultiply(left[2] ?? complex(0), right[0] ?? complex(0)),
      complexMultiply(left[0] ?? complex(0), right[2] ?? complex(0)),
    ),
    complexSubtract(
      complexMultiply(left[0] ?? complex(0), right[1] ?? complex(0)),
      complexMultiply(left[1] ?? complex(0), right[0] ?? complex(0)),
    ),
  ];
}

function complex(real: number, imaginary = 0): ComplexNumber {
  return { real, imaginary };
}

function complexNegate(value: ComplexNumber): ComplexNumber {
  return { real: -value.real, imaginary: -value.imaginary };
}

function complexSubtract(left: ComplexNumber, right: ComplexNumber): ComplexNumber {
  return {
    real: left.real - right.real,
    imaginary: left.imaginary - right.imaginary,
  };
}

function complexMultiply(left: ComplexNumber, right: ComplexNumber): ComplexNumber {
  return {
    real: left.real * right.real - left.imaginary * right.imaginary,
    imaginary: left.real * right.imaginary + left.imaginary * right.real,
  };
}

function complexModulus(value: ComplexNumber): number {
  return Math.hypot(value.real, value.imaginary);
}

function rowNorm(values: readonly ComplexNumber[]): number {
  return values.reduce(
    (sum, value) => sum + value.real * value.real + value.imaginary * value.imaginary,
    0,
  );
}

function eigenValueVector(
  values: readonly ComplexNumber[],
  invocation: BuiltinInvocation,
): RVector {
  invocation.context.allocate(values.length);
  if (
    values.every((value) => Math.abs(value.imaginary) <= 1e-12 * Math.max(1, Math.abs(value.real)))
  ) {
    return doubleVector(values.map((value) => value.real));
  }
  return complexVector(
    values.map((value) => value.real),
    values.map((value) => value.imaginary),
  );
}

function eigenVectorMatrix(
  columns: readonly (readonly ComplexNumber[])[],
  values: readonly ComplexNumber[],
  order: number,
  invocation: BuiltinInvocation,
): RVector {
  invocation.context.allocate(order * order);
  const real = new Float64Array(order * order);
  const imaginary = new Float64Array(order * order);
  let hasComplex = values.some(
    (value) => Math.abs(value.imaginary) > 1e-12 * Math.max(1, Math.abs(value.real)),
  );
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row < order; row += 1) {
      const value = columns[column]?.[row] ?? complex(0);
      real[row + column * order] = value.real;
      imaginary[row + column * order] = value.imaginary;
      if (Math.abs(value.imaginary) > 1e-12) hasComplex = true;
    }
  }
  return withDimensions(hasComplex ? complexVector(real, imaginary) : doubleVector(real), [
    order,
    order,
  ]);
}
