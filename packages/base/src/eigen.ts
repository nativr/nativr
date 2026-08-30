import {
  REvaluationError,
  RTypeMismatchError,
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
  readonly compatibility: "behavioral";
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

export interface SymmetricEigenDecomposition {
  readonly values: Float64Array;
  /** Column-major eigenvectors ordered with the descending eigenvalues. */
  readonly vectors: Float64Array;
}

export interface SymmetricEigenBackend {
  readonly implementation: "lapack-dsyevr-wasm";
  decompose(source: Float64Array, order: number): SymmetricEigenDecomposition;
}

export const SYMMETRIC_EIGEN_BACKEND_STATE_KEY = "base.symmetricEigenBackend";

export function symmetricEigenDecomposition(
  source: Float64Array,
  order: number,
  invocation: BuiltinInvocation,
): SymmetricEigenDecomposition {
  invocation.context.allocate(order * order * 2 + order * 32);
  invocation.context.checkpoint();
  const backend = invocation.state.get(SYMMETRIC_EIGEN_BACKEND_STATE_KEY) as
    SymmetricEigenBackend | undefined;
  if (backend !== undefined) {
    const result = backend.decompose(source, order);
    invocation.context.checkpoint();
    return result;
  }
  const result = symmetricEigen(source, order, invocation);
  const values = Float64Array.from(result.values, (value) => value.real);
  const vectors = new Float64Array(order * order);
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row < order; row += 1) {
      vectors[row + column * order] = result.vectors[column]?.[row]?.real ?? 0;
    }
  }
  return { values, vectors };
}

export const EIGEN_BUILTIN_SPECS: readonly EigenBuiltinSpec[] = [
  {
    name: "eigen",
    parameters: ["x", "symmetric", "only.values", "EISPACK"],
    compatibility: "behavioral",
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
    (input.type !== "logical" &&
      input.type !== "integer" &&
      input.type !== "double" &&
      input.type !== "complex") ||
    isFactor(input)
  ) {
    throw new RTypeMismatchError("NRT3282", "eigen() requires a square numeric matrix.");
  }
  const dimensions = vectorDimensions(input);
  if (dimensions === undefined || dimensions.length !== 2 || dimensions[0] !== dimensions[1]) {
    throw new RTypeMismatchError("NRT3282", "eigen() requires a square numeric matrix.");
  }
  const order = dimensions[0] ?? 0;
  if (order === 0) {
    throw new RTypeMismatchError("NRT3282", "eigen() requires a non-empty square matrix.");
  }
  invocation.context.allocate(order * order);
  const matrix = new Float64Array(order * order);
  const complexMatrix: ComplexNumber[] | undefined =
    input.type === "complex" ? Array.from({ length: order * order }, () => complex(0)) : undefined;
  for (let index = 0; index < matrix.length; index += 1) {
    invocation.context.checkpoint();
    const real =
      input.type === "complex"
        ? (input.real[index] ?? Number.NaN)
        : (input.values[index] ?? Number.NaN);
    const imaginary = input.type === "complex" ? (input.imaginary[index] ?? Number.NaN) : 0;
    if (isMissing(input, index) || !Number.isFinite(real) || !Number.isFinite(imaginary)) {
      throw new RTypeMismatchError("NRT3282", "infinite or missing values in 'x' are not allowed");
    }
    matrix[index] = real;
    if (complexMatrix !== undefined) complexMatrix[index] = complex(real, imaginary);
  }

  const symmetricArgument = matched.get("symmetric");
  const symmetric =
    symmetricArgument === undefined || symmetricArgument.promise.missing
      ? complexMatrix === undefined
        ? matrixIsSymmetric(matrix, order)
        : complexMatrixIsHermitian(complexMatrix, order)
      : await eigenFlag(invocation, symmetricArgument, "symmetric");
  const onlyValues = await eigenFlag(invocation, matched.get("only.values"), "only.values", false);
  await eigenFlag(invocation, matched.get("EISPACK"), "EISPACK", false);

  const result =
    complexMatrix === undefined
      ? symmetric
        ? symmetricSpectralResult(matrix, order, invocation)
        : generalEigen(matrix, order, invocation)
      : generalComplexEigen(complexMatrix, order, invocation);
  const values = eigenValueVector(result.values, invocation);
  const vectors = onlyValues
    ? R_NULL
    : eigenVectorMatrix(result.vectors, result.values, order, invocation);
  const output = listValue([values, vectors], ["values", "vectors"]);
  return onlyValues ? output : withClasses(output, ["eigen"]);
}

function complexMatrixIsHermitian(matrix: readonly ComplexNumber[], order: number): boolean {
  let scale = 1;
  for (const value of matrix) scale = Math.max(scale, complexModulus(value));
  const tolerance = Math.sqrt(Number.EPSILON) * scale * Math.max(1, order);
  for (let column = 0; column < order; column += 1) {
    const diagonal = matrix[column + column * order] ?? complex(0);
    if (Math.abs(diagonal.imaginary) > tolerance) return false;
    for (let row = column + 1; row < order; row += 1) {
      const left = matrix[row + column * order] ?? complex(0);
      const right = matrix[column + row * order] ?? complex(0);
      if (
        Math.abs(left.real - right.real) > tolerance ||
        Math.abs(left.imaginary + right.imaginary) > tolerance
      ) {
        return false;
      }
    }
  }
  return true;
}

function generalComplexEigen(
  matrix: readonly ComplexNumber[],
  order: number,
  invocation: BuiltinInvocation,
): SpectralResult {
  invocation.context.allocate(order * order * 6 + order * 24);
  let work = Array.from({ length: order * order }, (_, index) =>
    complex(index % (order + 1) === 0 ? 1 : 0),
  );
  const coefficients = Array.from({ length: order + 1 }, () => complex(0));
  coefficients[0] = complex(1);
  for (let degree = 1; degree <= order; degree += 1) {
    invocation.context.checkpoint();
    const product = multiplyComplexMatrices(matrix, work, order);
    let trace = complex(0);
    for (let index = 0; index < order; index += 1) {
      trace = complexAdd(trace, product[index + index * order] ?? complex(0));
    }
    const coefficient = complex(-trace.real / degree, -trace.imaginary / degree);
    coefficients[degree] = coefficient;
    for (let index = 0; index < order; index += 1) {
      product[index + index * order] = complexAdd(
        product[index + index * order] ?? complex(0),
        coefficient,
      );
    }
    work = product;
  }
  const values = durandKernerComplexRoots(coefficients, invocation).sort(
    (left, right) => complexModulus(right) - complexModulus(left),
  );
  return {
    values,
    vectors: values.map((value) => complexRightEigenvector(matrix, order, value, invocation)),
  };
}

function multiplyComplexMatrices(
  left: readonly ComplexNumber[],
  right: readonly ComplexNumber[],
  order: number,
): ComplexNumber[] {
  const output = Array.from({ length: order * order }, () => complex(0));
  for (let column = 0; column < order; column += 1) {
    for (let inner = 0; inner < order; inner += 1) {
      const factor = right[inner + column * order] ?? complex(0);
      if (complexModulus(factor) === 0) continue;
      for (let row = 0; row < order; row += 1) {
        const index = row + column * order;
        output[index] = complexAdd(
          output[index] ?? complex(0),
          complexMultiply(left[row + inner * order] ?? complex(0), factor),
        );
      }
    }
  }
  return output;
}

function durandKernerComplexRoots(
  coefficients: readonly ComplexNumber[],
  invocation: BuiltinInvocation,
): ComplexNumber[] {
  const order = coefficients.length - 1;
  if (order === 1) return [complexNegate(coefficients[1] ?? complex(0))];
  const radius = 1 + Math.max(0, ...coefficients.slice(1).map(complexModulus));
  let roots = Array.from({ length: order }, (_, index) => {
    const angle = (2 * Math.PI * (index + 0.5)) / order;
    return complex(radius * Math.cos(angle), radius * Math.sin(angle));
  });
  for (let iteration = 0; iteration < Math.max(256, order * 128); iteration += 1) {
    invocation.context.checkpoint();
    let maximumChange = 0;
    const next = roots.map((root, index) => {
      let denominator = complex(1);
      for (let other = 0; other < order; other += 1) {
        if (other !== index) {
          denominator = complexMultiply(
            denominator,
            complexSubtract(root, roots[other] ?? complex(0)),
          );
        }
      }
      if (complexModulus(denominator) <= Number.MIN_VALUE) {
        denominator = complex(Number.EPSILON, Number.EPSILON * (index + 1));
      }
      let polynomial = coefficients[0] ?? complex(1);
      for (let coefficient = 1; coefficient < coefficients.length; coefficient += 1) {
        polynomial = complexAdd(
          complexMultiply(polynomial, root),
          coefficients[coefficient] ?? complex(0),
        );
      }
      const change = complexDivide(polynomial, denominator);
      maximumChange = Math.max(maximumChange, complexModulus(change));
      return complexSubtract(root, change);
    });
    roots = next;
    if (maximumChange <= 1e-13 * Math.max(1, ...roots.map(complexModulus))) break;
  }
  return roots.map(cleanComplexRoundoff);
}

function complexRightEigenvector(
  matrix: readonly ComplexNumber[],
  order: number,
  value: ComplexNumber,
  invocation: BuiltinInvocation,
): readonly ComplexNumber[] {
  const rows = Array.from({ length: order }, (_, row) =>
    Array.from({ length: order }, (_, column) =>
      complexSubtract(
        matrix[row + column * order] ?? complex(0),
        row === column ? value : complex(0),
      ),
    ),
  );
  const scale = Math.max(1, ...rows.flat().map(complexModulus));
  const tolerance = scale * 1e-8;
  const pivotColumns: number[] = [];
  let pivotRow = 0;
  for (let column = 0; column < order && pivotRow < order; column += 1) {
    invocation.context.checkpoint();
    let selected = pivotRow;
    for (let row = pivotRow + 1; row < order; row += 1) {
      if (
        complexModulus(rows[row]?.[column] ?? complex(0)) >
        complexModulus(rows[selected]?.[column] ?? complex(0))
      )
        selected = row;
    }
    const pivot = rows[selected]?.[column] ?? complex(0);
    if (complexModulus(pivot) <= tolerance) continue;
    [rows[pivotRow], rows[selected]] = [rows[selected] ?? [], rows[pivotRow] ?? []];
    for (let entry = column; entry < order; entry += 1)
      rows[pivotRow]![entry] = complexDivide(rows[pivotRow]?.[entry] ?? complex(0), pivot);
    for (let row = pivotRow + 1; row < order; row += 1) {
      const factor = rows[row]?.[column] ?? complex(0);
      for (let entry = column; entry < order; entry += 1) {
        rows[row]![entry] = complexSubtract(
          rows[row]?.[entry] ?? complex(0),
          complexMultiply(factor, rows[pivotRow]?.[entry] ?? complex(0)),
        );
      }
    }
    pivotColumns.push(column);
    pivotRow += 1;
  }
  if (pivotColumns.length === order) pivotColumns.pop();
  const pivotSet = new Set(pivotColumns);
  let freeColumn = order - 1;
  while (freeColumn > 0 && pivotSet.has(freeColumn)) freeColumn -= 1;
  const vector = Array.from({ length: order }, () => complex(0));
  vector[freeColumn] = complex(1);
  for (let row = pivotColumns.length - 1; row >= 0; row -= 1) {
    const column = pivotColumns[row] ?? 0;
    let total = complex(0);
    for (let entry = column + 1; entry < order; entry += 1)
      total = complexAdd(
        total,
        complexMultiply(rows[row]?.[entry] ?? complex(0), vector[entry] ?? complex(0)),
      );
    vector[column] = complexNegate(total);
  }
  const norm = Math.sqrt(rowNorm(vector));
  if (!(norm > Number.EPSILON)) return vector;
  const normalized = vector.map((entry) => complex(entry.real / norm, entry.imaginary / norm));
  let pivot = normalized[0] ?? complex(1);
  for (const entry of normalized) if (complexModulus(entry) > complexModulus(pivot)) pivot = entry;
  const modulus = complexModulus(pivot);
  const phase =
    modulus === 0 ? complex(1) : complex(pivot.real / modulus, -pivot.imaginary / modulus);
  return normalized.map((entry) => cleanComplexRoundoff(complexMultiply(entry, phase)));
}

function symmetricSpectralResult(
  source: Float64Array,
  order: number,
  invocation: BuiltinInvocation,
): SpectralResult {
  const result = symmetricEigenDecomposition(source, order, invocation);
  return {
    values: Array.from(result.values, (value) => complex(value)),
    vectors: Array.from({ length: order }, (_, column) =>
      Array.from({ length: order }, (_, row) => complex(result.vectors[row + column * order] ?? 0)),
    ),
  };
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
  const values = (
    order <= 3
      ? smallRealMatrixEigenvalues(matrix, order)
      : generalRealMatrixEigenvalues(matrix, order, invocation)
  ).sort((left, right) => complexModulus(right) - complexModulus(left));
  return {
    values,
    vectors: values.map((value) =>
      order <= 3
        ? smallRightEigenvector(matrix, order, value, invocation)
        : generalRightEigenvector(matrix, order, value, invocation),
    ),
  };
}

function generalRealMatrixEigenvalues(
  matrix: Float64Array,
  order: number,
  invocation: BuiltinInvocation,
): ComplexNumber[] {
  invocation.context.allocate(order * order * 3 + order * 16);
  let work: Float64Array = new Float64Array(order * order);
  for (let index = 0; index < order; index += 1) work[index + index * order] = 1;
  const coefficients = new Float64Array(order + 1);
  coefficients[0] = 1;
  for (let degree = 1; degree <= order; degree += 1) {
    invocation.context.checkpoint();
    const product = multiplyRealMatrices(matrix, work, order);
    let trace = 0;
    for (let index = 0; index < order; index += 1) trace += product[index + index * order] ?? 0;
    const coefficient = -trace / degree;
    coefficients[degree] = coefficient;
    for (let index = 0; index < order; index += 1) {
      product[index + index * order] = (product[index + index * order] ?? 0) + coefficient;
    }
    work = product;
  }
  return durandKernerRoots(coefficients, invocation);
}

function multiplyRealMatrices(
  left: Float64Array,
  right: Float64Array,
  order: number,
): Float64Array {
  const output = new Float64Array(order * order);
  for (let column = 0; column < order; column += 1) {
    for (let inner = 0; inner < order; inner += 1) {
      const factor = right[inner + column * order] ?? 0;
      if (factor === 0) continue;
      for (let row = 0; row < order; row += 1) {
        const outputIndex = row + column * order;
        output[outputIndex] =
          (output[outputIndex] ?? 0) + (left[row + inner * order] ?? 0) * factor;
      }
    }
  }
  return output;
}

function durandKernerRoots(
  coefficients: Float64Array,
  invocation: BuiltinInvocation,
): ComplexNumber[] {
  const order = coefficients.length - 1;
  const radius = 1 + Math.max(0, ...Array.from(coefficients.slice(1), (value) => Math.abs(value)));
  let roots = Array.from({ length: order }, (_, index) => {
    const angle = (2 * Math.PI * (index + 0.5)) / order;
    return complex(radius * Math.cos(angle), radius * Math.sin(angle));
  });
  const tolerance = 1e-13;
  const maxIterations = Math.max(256, order * 128);
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    invocation.context.checkpoint();
    let maximumChange = 0;
    const next = roots.map((root, index) => {
      let denominator = complex(1);
      for (let other = 0; other < order; other += 1) {
        if (other === index) continue;
        denominator = complexMultiply(
          denominator,
          complexSubtract(root, roots[other] ?? complex(0)),
        );
      }
      if (complexModulus(denominator) <= Number.MIN_VALUE) {
        denominator = complex(Number.EPSILON, Number.EPSILON * (index + 1));
      }
      const change = complexDivide(evaluateRealPolynomial(coefficients, root), denominator);
      maximumChange = Math.max(maximumChange, complexModulus(change));
      return complexSubtract(root, change);
    });
    roots = next;
    const scale = Math.max(1, ...roots.map(complexModulus));
    if (maximumChange <= tolerance * scale) return roots.map(cleanComplexRoundoff);
  }
  return roots.map(cleanComplexRoundoff);
}

function evaluateRealPolynomial(coefficients: Float64Array, value: ComplexNumber): ComplexNumber {
  let result = complex(coefficients[0] ?? 0);
  for (let index = 1; index < coefficients.length; index += 1) {
    result = complexAdd(complexMultiply(result, value), complex(coefficients[index] ?? 0));
  }
  return result;
}

function generalRightEigenvector(
  matrix: Float64Array,
  order: number,
  value: ComplexNumber,
  invocation: BuiltinInvocation,
): readonly ComplexNumber[] {
  invocation.context.allocate(order * order * 4);
  const rows = Array.from({ length: order }, (_, row) =>
    Array.from({ length: order }, (_, column) => ({
      real: (matrix[row + column * order] ?? 0) - (row === column ? value.real : 0),
      imaginary: row === column ? -value.imaginary : 0,
    })),
  );
  const scale = Math.max(1, ...rows.flat().map(complexModulus));
  const tolerance = scale * 1e-8;
  const pivotColumns: number[] = [];
  let pivotRow = 0;
  for (let column = 0; column < order && pivotRow < order; column += 1) {
    invocation.context.checkpoint();
    let selected = pivotRow;
    for (let row = pivotRow + 1; row < order; row += 1) {
      if (
        complexModulus(rows[row]?.[column] ?? complex(0)) >
        complexModulus(rows[selected]?.[column] ?? complex(0))
      ) {
        selected = row;
      }
    }
    const pivot = rows[selected]?.[column] ?? complex(0);
    if (complexModulus(pivot) <= tolerance) continue;
    [rows[pivotRow], rows[selected]] = [rows[selected] ?? [], rows[pivotRow] ?? []];
    for (let entry = column; entry < order; entry += 1) {
      rows[pivotRow]![entry] = complexDivide(rows[pivotRow]?.[entry] ?? complex(0), pivot);
    }
    for (let row = pivotRow + 1; row < order; row += 1) {
      const factor = rows[row]?.[column] ?? complex(0);
      if (complexModulus(factor) <= tolerance) continue;
      for (let entry = column; entry < order; entry += 1) {
        rows[row]![entry] = complexSubtract(
          rows[row]?.[entry] ?? complex(0),
          complexMultiply(factor, rows[pivotRow]?.[entry] ?? complex(0)),
        );
      }
    }
    pivotColumns.push(column);
    pivotRow += 1;
  }
  if (pivotColumns.length === order) pivotColumns.pop();
  const pivotSet = new Set(pivotColumns);
  let freeColumn = order - 1;
  while (freeColumn > 0 && pivotSet.has(freeColumn)) freeColumn -= 1;
  const vector = Array.from({ length: order }, () => complex(0));
  vector[freeColumn] = complex(1);
  for (let row = pivotColumns.length - 1; row >= 0; row -= 1) {
    const column = pivotColumns[row] ?? 0;
    let total = complex(0);
    for (let entry = column + 1; entry < order; entry += 1) {
      total = complexAdd(
        total,
        complexMultiply(rows[row]?.[entry] ?? complex(0), vector[entry] ?? complex(0)),
      );
    }
    vector[column] = complexNegate(total);
  }
  const norm = Math.sqrt(rowNorm(vector));
  if (!(norm > Number.EPSILON)) {
    return Array.from({ length: order }, (_, index) => complex(index === freeColumn ? 1 : 0));
  }
  const normalized = vector.map((entry) => complex(entry.real / norm, entry.imaginary / norm));
  let phasePivot = normalized[0] ?? complex(1);
  for (const entry of normalized) {
    if (complexModulus(entry) > complexModulus(phasePivot)) phasePivot = entry;
  }
  const modulus = complexModulus(phasePivot);
  const phase =
    modulus === 0
      ? complex(1)
      : complex(phasePivot.real / modulus, -phasePivot.imaginary / modulus);
  return normalized.map((entry) => cleanComplexRoundoff(complexMultiply(entry, phase)));
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

function complexAdd(left: ComplexNumber, right: ComplexNumber): ComplexNumber {
  return { real: left.real + right.real, imaginary: left.imaginary + right.imaginary };
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

function complexDivide(left: ComplexNumber, right: ComplexNumber): ComplexNumber {
  const denominator = right.real * right.real + right.imaginary * right.imaginary;
  return {
    real: (left.real * right.real + left.imaginary * right.imaginary) / denominator,
    imaginary: (left.imaginary * right.real - left.real * right.imaginary) / denominator,
  };
}

function cleanComplexRoundoff(value: ComplexNumber): ComplexNumber {
  const scale = Math.max(1, Math.abs(value.real), Math.abs(value.imaginary));
  return {
    real: Math.abs(value.real) <= 1e-14 * scale ? 0 : value.real,
    imaginary: Math.abs(value.imaginary) <= 1e-14 * scale ? 0 : value.imaginary,
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
