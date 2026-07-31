import {
  REvaluationError,
  RTypeMismatchError,
  dataFrameRowCount,
  doubleVector,
  factorLevels,
  isAtomic,
  isDataFrame,
  isFactor,
  isMissing,
  vectorDimensions,
  vectorNames,
} from "@nativr/runtime";
import type { BuiltinCallArgument, BuiltinInvocation, RValue } from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

export interface ConditionNumberBuiltinSpec {
  readonly name: string;
  readonly parameters: readonly string[];
  readonly compatibility: "numeric" | "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

export const CONDITION_NUMBER_BUILTIN_SPECS: readonly ConditionNumberBuiltinSpec[] = [
  {
    name: "kappa",
    parameters: ["z", "..."],
    compatibility: "numeric",
    implementation: builtinKappa,
  },
  {
    name: "kappa.default",
    parameters: ["z", "exact", "norm", "method", "inv_z", "triangular", "uplo", "..."],
    compatibility: "numeric",
    implementation: (invocation) => builtinKappaMethod(invocation, "default"),
  },
  {
    name: "kappa.qr",
    parameters: ["z", "..."],
    compatibility: "numeric",
    implementation: (invocation) => builtinKappaMethod(invocation, "qr"),
  },
  {
    name: "kappa.lm",
    parameters: ["z", "..."],
    compatibility: "numeric",
    implementation: (invocation) => builtinKappaMethod(invocation, "lm"),
  },
];

interface RealMatrix {
  readonly values: Float64Array;
  readonly rows: number;
  readonly columns: number;
}

type KappaMethod = "qr" | "direct";
type KappaNorm = "1" | "I" | "2";
type Triangle = "U" | "L";

const KAPPA_PARAMETERS = [
  "z",
  "exact",
  "norm",
  "method",
  "inv_z",
  "triangular",
  "uplo",
  "...",
] as const;

async function builtinKappa(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["z", "..."]);
  const inputArgument = requiredArgument(matched.get("z"), "z", "kappa");
  const input = await invocation.force(inputArgument.promise);
  const dispatchArguments = [
    inputArgument,
    ...invocation.arguments.filter((argument) => argument !== inputArgument),
  ];
  const dispatched = await invocation.dispatchS3IfPresent("kappa", input, dispatchArguments);
  if (dispatched !== undefined) return dispatched;
  throw new REvaluationError("NRE2216", "No applicable method for 'kappa'.");
}

async function builtinKappaMethod(
  invocation: BuiltinInvocation,
  source: "default" | "qr" | "lm",
): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, KAPPA_PARAMETERS);
  const inputArgument = requiredArgument(matched.get("z"), "z", `kappa.${source}`);
  const input = await invocation.force(inputArgument.promise);
  const exact = await kappaFlag(invocation, matched.get("exact"), false, "exact");
  const triangular =
    source === "default"
      ? await kappaFlag(invocation, matched.get("triangular"), false, "triangular")
      : false;
  const uplo = await kappaTriangle(invocation, matched.get("uplo"));
  const matrix =
    source === "default"
      ? numericMatrix(input, invocation)
      : qrMatrix(source === "lm" ? listField(input, "qr", "kappa.lm") : input, invocation);

  let value: number;
  if (exact) {
    const target = triangular ? triangularMatrix(matrix, uplo) : matrix;
    value = singularConditionNumber(target, invocation);
  } else {
    const method = await kappaMethod(invocation, matched.get("method"));
    const norm = await kappaNorm(invocation, matched.get("norm"), method);
    if (method === "direct") {
      const target = triangular ? triangularMatrix(matrix, uplo) : matrix;
      const inverseArgument = matched.get("inv_z");
      const inverse =
        inverseArgument === undefined
          ? invertSquareMatrix(target, invocation)
          : numericMatrix(await invocation.force(inverseArgument.promise), invocation);
      value = directConditionNumber(target, inverse, norm, invocation);
    } else {
      const target = triangular ? triangularMatrix(matrix, uplo) : matrix;
      const factor = source === "default" ? qrFactor(target, invocation) : target;
      value = estimatedTriangularCondition(factor, norm === "I" ? "L" : "U", norm, invocation);
    }
  }
  invocation.context.allocate(1);
  return doubleVector([value]);
}

function requiredArgument(
  argument: BuiltinCallArgument | undefined,
  name: string,
  call: string,
): BuiltinCallArgument {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in ${call}().`);
  }
  return argument;
}

async function kappaFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (!isAtomic(value) || value.length === 0 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3270", `kappa(${name}=) requires one logical value.`);
  }
  if (value.type === "character") {
    const normalized = (value.values[0] ?? "").trim().toUpperCase();
    if (normalized === "TRUE" || normalized === "T") return true;
    if (normalized === "FALSE" || normalized === "F") return false;
    throw new RTypeMismatchError("NRT3270", `kappa(${name}=) requires one logical value.`);
  }
  if (value.type === "complex") {
    const real = value.real[0] ?? Number.NaN;
    const imaginary = value.imaginary[0] ?? Number.NaN;
    if (Number.isNaN(real) || Number.isNaN(imaginary)) {
      throw new RTypeMismatchError("NRT3270", `kappa(${name}=) requires one logical value.`);
    }
    return real !== 0 || imaginary !== 0;
  }
  const scalar = value.values[0] ?? Number.NaN;
  if (Number.isNaN(scalar)) {
    throw new RTypeMismatchError("NRT3270", `kappa(${name}=) requires one logical value.`);
  }
  return scalar !== 0;
}

async function kappaMethod(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<KappaMethod> {
  if (argument === undefined) return "qr";
  const value = await invocation.force(argument.promise);
  const selected = scalarString(value, "method").toLowerCase();
  if ("qr".startsWith(selected) && selected.length > 0) return "qr";
  if ("direct".startsWith(selected) && selected.length > 0) return "direct";
  throw new RTypeMismatchError("NRT3270", "kappa(method=) must select 'qr' or 'direct'.");
}

async function kappaNorm(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  method: KappaMethod,
): Promise<KappaNorm> {
  if (argument === undefined) return "1";
  const value = await invocation.force(argument.promise);
  const selected = scalarString(value, "norm").toUpperCase();
  if (selected === "1" || selected === "O") return "1";
  if (selected === "I") return "I";
  if (method === "qr") {
    invocation.context.warn({
      code: "NRW1105",
      message: `norm="${selected}" not available here; using norm="1"`,
    });
    return "1";
  }
  throw new RTypeMismatchError(
    "NRT3270",
    "kappa(norm=) with method='direct' must be one of '1', 'O', or 'I'.",
  );
}

async function kappaTriangle(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<Triangle> {
  if (argument === undefined) return "U";
  const value = await invocation.force(argument.promise);
  const selected = scalarString(value, "uplo").toUpperCase();
  if ("UPPER".startsWith(selected) && selected.length > 0) return "U";
  if ("LOWER".startsWith(selected) && selected.length > 0) return "L";
  throw new RTypeMismatchError("NRT3270", "kappa(uplo=) must select 'U' or 'L'.");
}

function scalarString(value: RValue, name: string): string {
  if (
    value.type !== "character" ||
    value.length === 0 ||
    isMissing(value, 0) ||
    (value.values[0] ?? "").length === 0
  ) {
    throw new RTypeMismatchError("NRT3270", `kappa(${name}=) requires one character value.`);
  }
  return value.values[0] ?? "";
}

function numericMatrix(value: RValue, invocation: BuiltinInvocation): RealMatrix {
  if (value.type === "list" && isDataFrame(value)) {
    const rows = dataFrameRowCount(value);
    const columns = value.length;
    invocation.context.allocate(rows * columns);
    const output = new Float64Array(rows * columns);
    for (let column = 0; column < columns; column += 1) {
      const input = value.values[column];
      if (input === undefined || !isAtomic(input) || input.type === "complex") {
        throw new RTypeMismatchError(
          "NRT3270",
          "kappa() data-frame columns must be real atomic vectors.",
        );
      }
      for (let row = 0; row < rows; row += 1) {
        output[row + column * rows] = realCell(input, row);
      }
    }
    validateFinite(output);
    return { values: output, rows, columns };
  }
  if (!isAtomic(value) || value.type === "complex") {
    throw new RTypeMismatchError(
      "NRT3270",
      "kappa() requires a real atomic vector, matrix, data frame, QR object, or lm object.",
    );
  }
  const dimensions = vectorDimensions(value);
  if (dimensions !== undefined && dimensions.length !== 2) {
    throw new RTypeMismatchError("NRT3270", "kappa() input must be two-dimensional.");
  }
  const rows = dimensions?.[0] ?? value.length;
  const columns = dimensions?.[1] ?? 1;
  invocation.context.allocate(value.length);
  const output = new Float64Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    output[index] = realCell(value, index);
  }
  validateFinite(output);
  return { values: output, rows, columns };
}

function realCell(value: RValue, index: number): number {
  if (!isAtomic(value) || value.type === "complex" || isMissing(value, index)) return Number.NaN;
  if (isFactor(value)) {
    return Number(factorLevels(value)[(value.values[index] ?? 0) - 1] ?? Number.NaN);
  }
  if (value.type === "character") return Number(value.values[index] ?? Number.NaN);
  return value.values[index] ?? Number.NaN;
}

function validateFinite(values: Float64Array): void {
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new RTypeMismatchError("NRT3270", "kappa() input contains NA, NaN, or infinity.");
    }
  }
}

function listField(value: RValue, name: string, call: string): RValue {
  if (value.type !== "list") {
    throw new RTypeMismatchError("NRT3270", `${call}() requires a list-like object.`);
  }
  const names = vectorNames(value);
  const index = names?.indexOf(name) ?? -1;
  const field = index < 0 ? undefined : value.values[index];
  if (field === undefined) {
    throw new RTypeMismatchError("NRT3270", `${call}() object has no '${name}' component.`);
  }
  return field;
}

function qrMatrix(value: RValue, invocation: BuiltinInvocation): RealMatrix {
  const matrixValue = value.type === "list" ? listField(value, "qr", "kappa.qr") : value;
  const matrix = numericMatrix(matrixValue, invocation);
  const order = Math.min(matrix.rows, matrix.columns);
  const output = new Float64Array(order * order);
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      output[row + column * order] = matrix.values[row + column * matrix.rows] ?? 0;
    }
  }
  return { values: output, rows: order, columns: order };
}

function triangularMatrix(matrix: RealMatrix, uplo: Triangle): RealMatrix {
  if (matrix.rows !== matrix.columns) {
    throw new RTypeMismatchError("NRT3270", "kappa(triangular=TRUE) requires a square matrix.");
  }
  const output = Float64Array.from(matrix.values);
  for (let column = 0; column < matrix.columns; column += 1) {
    for (let row = 0; row < matrix.rows; row += 1) {
      if ((uplo === "U" && row > column) || (uplo === "L" && row < column)) {
        output[row + column * matrix.rows] = 0;
      }
    }
  }
  return { ...matrix, values: output };
}

function qrFactor(matrix: RealMatrix, invocation: BuiltinInvocation): RealMatrix {
  const source = matrix.rows < matrix.columns ? transposeMatrix(matrix) : matrix;
  const rows = source.rows;
  const columns = source.columns;
  const order = Math.min(rows, columns);
  if (order === 0) return { values: new Float64Array(0), rows: 0, columns: 0 };
  const working = matrixToRows(source);
  invocation.context.allocate(rows * columns + order * order);
  for (let step = 0; step < order; step += 1) {
    invocation.context.checkpoint();
    if (step === rows - 1) continue;
    let norm = 0;
    for (let row = step; row < rows; row += 1) {
      norm = Math.hypot(norm, working[row]?.[step] ?? 0);
    }
    if (norm === 0) continue;
    const diagonal = working[step]?.[step] ?? 0;
    if (diagonal < 0) norm = -norm;
    for (let row = step; row < rows; row += 1) {
      working[row]![step] = (working[row]?.[step] ?? 0) / norm;
    }
    working[step]![step] = 1 + (working[step]?.[step] ?? 0);
    for (let column = step + 1; column < columns; column += 1) {
      let projection = 0;
      for (let row = step; row < rows; row += 1) {
        projection += (working[row]?.[step] ?? 0) * (working[row]?.[column] ?? 0);
      }
      projection = -projection / (working[step]?.[step] ?? 1);
      for (let row = step; row < rows; row += 1) {
        working[row]![column] =
          (working[row]?.[column] ?? 0) + projection * (working[row]?.[step] ?? 0);
      }
    }
    working[step]![step] = -norm;
  }

  const output = new Float64Array(order * order);
  const firstDiagonal = Math.abs(working[0]?.[0] ?? 0);
  const threshold = firstDiagonal * 1e-7;
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      const value = working[row]?.[column] ?? 0;
      output[row + column * order] = row === column && Math.abs(value) <= threshold ? 0 : value;
    }
  }
  return { values: output, rows: order, columns: order };
}

function matrixToRows(matrix: RealMatrix): number[][] {
  return Array.from({ length: matrix.rows }, (_, row) =>
    Array.from(
      { length: matrix.columns },
      (_, column) => matrix.values[row + column * matrix.rows] ?? 0,
    ),
  );
}

function singularConditionNumber(matrix: RealMatrix, invocation: BuiltinInvocation): number {
  const order = Math.min(matrix.rows, matrix.columns);
  if (order === 0) return 0;
  let scale = 0;
  for (const value of matrix.values) scale = Math.max(scale, Math.abs(value));
  if (scale === 0) return Number.POSITIVE_INFINITY;
  invocation.context.allocate(order * order);
  const gram = Array.from({ length: order }, () => new Float64Array(order));
  if (matrix.rows >= matrix.columns) {
    for (let left = 0; left < order; left += 1) {
      for (let right = left; right < order; right += 1) {
        let sum = 0;
        for (let row = 0; row < matrix.rows; row += 1) {
          sum +=
            ((matrix.values[row + left * matrix.rows] ?? 0) / scale) *
            ((matrix.values[row + right * matrix.rows] ?? 0) / scale);
        }
        gram[left]![right] = sum;
        gram[right]![left] = sum;
      }
    }
  } else {
    for (let left = 0; left < order; left += 1) {
      for (let right = left; right < order; right += 1) {
        let sum = 0;
        for (let column = 0; column < matrix.columns; column += 1) {
          sum +=
            ((matrix.values[left + column * matrix.rows] ?? 0) / scale) *
            ((matrix.values[right + column * matrix.rows] ?? 0) / scale);
        }
        gram[left]![right] = sum;
        gram[right]![left] = sum;
      }
    }
  }
  jacobiEigenvalues(gram, invocation);
  let largest = 0;
  let smallest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < order; index += 1) {
    const eigenvalue = Math.max(0, gram[index]?.[index] ?? 0);
    largest = Math.max(largest, eigenvalue);
    smallest = Math.min(smallest, eigenvalue);
  }
  if (largest === 0 || smallest === 0) return Number.POSITIVE_INFINITY;
  return Math.sqrt(largest / smallest);
}

function jacobiEigenvalues(matrix: Float64Array[], invocation: BuiltinInvocation): void {
  const order = matrix.length;
  const maxIterations = Math.max(1, order * order * 100);
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    invocation.context.checkpoint();
    let pivotRow = 0;
    let pivotColumn = 0;
    let largestOffDiagonal = 0;
    let largestDiagonal = 0;
    for (let row = 0; row < order; row += 1) {
      largestDiagonal = Math.max(largestDiagonal, Math.abs(matrix[row]?.[row] ?? 0));
      for (let column = row + 1; column < order; column += 1) {
        const candidate = Math.abs(matrix[row]?.[column] ?? 0);
        if (candidate > largestOffDiagonal) {
          largestOffDiagonal = candidate;
          pivotRow = row;
          pivotColumn = column;
        }
      }
    }
    if (largestOffDiagonal <= Number.EPSILON * Math.max(1, largestDiagonal) * Math.max(1, order)) {
      return;
    }
    const app = matrix[pivotRow]?.[pivotRow] ?? 0;
    const aqq = matrix[pivotColumn]?.[pivotColumn] ?? 0;
    const apq = matrix[pivotRow]?.[pivotColumn] ?? 0;
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let index = 0; index < order; index += 1) {
      if (index === pivotRow || index === pivotColumn) continue;
      const aip = matrix[index]?.[pivotRow] ?? 0;
      const aiq = matrix[index]?.[pivotColumn] ?? 0;
      const rotatedP = cosine * aip - sine * aiq;
      const rotatedQ = sine * aip + cosine * aiq;
      matrix[index]![pivotRow] = rotatedP;
      matrix[pivotRow]![index] = rotatedP;
      matrix[index]![pivotColumn] = rotatedQ;
      matrix[pivotColumn]![index] = rotatedQ;
    }
    matrix[pivotRow]![pivotRow] =
      cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq;
    matrix[pivotColumn]![pivotColumn] =
      sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq;
    matrix[pivotRow]![pivotColumn] = 0;
    matrix[pivotColumn]![pivotRow] = 0;
  }
}

function estimatedTriangularCondition(
  matrix: RealMatrix,
  uplo: Triangle,
  norm: KappaNorm,
  invocation: BuiltinInvocation,
): number {
  if (matrix.rows !== matrix.columns) {
    throw new RTypeMismatchError("NRT3270", "kappa() QR factor must be square.");
  }
  if (matrix.rows === 0) return 0;
  if (norm === "2") return singularConditionNumber(matrix, invocation);
  return linpackTriangularEstimate(matrix, uplo);
}

function linpackTriangularEstimate(matrix: RealMatrix, uplo: Triangle): number {
  const order = matrix.rows;
  let matrixNorm = 0;
  for (let column = 0; column < order; column += 1) {
    let sum = 0;
    const start = uplo === "U" ? 0 : column;
    const end = uplo === "U" ? column : order - 1;
    for (let row = start; row <= end; row += 1) {
      sum += Math.abs(matrix.values[row + column * order] ?? 0);
    }
    matrixNorm = Math.max(matrixNorm, sum);
  }
  if (matrixNorm === 0) return Number.POSITIVE_INFINITY;

  const work = new Float64Array(order);
  let growthSign = 1;
  const scaleWork = (scale: number): void => {
    for (let index = 0; index < order; index += 1) {
      work[index] = (work[index] ?? 0) * scale;
    }
  };

  for (let iteration = 0; iteration < order; iteration += 1) {
    const pivot = uplo === "U" ? iteration : order - 1 - iteration;
    const current = work[pivot] ?? 0;
    if (current !== 0) growthSign = current <= 0 ? Math.abs(growthSign) : -Math.abs(growthSign);
    const diagonal = matrix.values[pivot + pivot * order] ?? 0;
    const candidateDistance = Math.abs(growthSign - current);
    if (candidateDistance > Math.abs(diagonal)) {
      const scale = Math.abs(diagonal) / candidateDistance;
      scaleWork(scale);
      growthSign *= scale;
    }
    let positive = growthSign - (work[pivot] ?? 0);
    let negative = -growthSign - (work[pivot] ?? 0);
    let positiveGrowth = Math.abs(positive);
    let negativeGrowth = Math.abs(negative);
    if (diagonal !== 0) {
      positive /= diagonal;
      negative /= diagonal;
    } else {
      positive = 1;
      negative = 1;
    }
    const start = uplo === "U" ? pivot + 1 : 0;
    const end = uplo === "U" ? order - 1 : pivot - 1;
    for (let index = start; index <= end; index += 1) {
      const coefficient =
        uplo === "U"
          ? (matrix.values[pivot + index * order] ?? 0)
          : (matrix.values[pivot + index * order] ?? 0);
      negativeGrowth += Math.abs((work[index] ?? 0) + negative * coefficient);
      work[index] = (work[index] ?? 0) + positive * coefficient;
      positiveGrowth += Math.abs(work[index] ?? 0);
    }
    if (positiveGrowth < negativeGrowth) {
      const correction = negative - positive;
      positive = negative;
      for (let index = start; index <= end; index += 1) {
        const coefficient = matrix.values[pivot + index * order] ?? 0;
        work[index] = (work[index] ?? 0) + correction * coefficient;
      }
    }
    work[pivot] = positive;
  }

  let scale = reciprocalAbsoluteSum(work);
  scaleWork(scale);
  let inverseScale = 1;
  for (let iteration = 0; iteration < order; iteration += 1) {
    const pivot = uplo === "U" ? order - 1 - iteration : iteration;
    const diagonal = matrix.values[pivot + pivot * order] ?? 0;
    if (Math.abs(work[pivot] ?? 0) > Math.abs(diagonal)) {
      const rescale = Math.abs(diagonal) / Math.abs(work[pivot] ?? 0);
      scaleWork(rescale);
      inverseScale *= rescale;
    }
    work[pivot] = diagonal === 0 ? 1 : (work[pivot] ?? 0) / diagonal;
    if (uplo === "U") {
      for (let row = 0; row < pivot; row += 1) {
        work[row] =
          (work[row] ?? 0) - (work[pivot] ?? 0) * (matrix.values[row + pivot * order] ?? 0);
      }
    } else {
      for (let row = pivot + 1; row < order; row += 1) {
        work[row] =
          (work[row] ?? 0) - (work[pivot] ?? 0) * (matrix.values[row + pivot * order] ?? 0);
      }
    }
  }
  scale = reciprocalAbsoluteSum(work);
  inverseScale *= scale;
  return inverseScale === 0 ? Number.POSITIVE_INFINITY : matrixNorm / inverseScale;
}

function reciprocalAbsoluteSum(values: Float64Array): number {
  let sum = 0;
  for (const value of values) sum += Math.abs(value);
  return sum === 0 ? 1 : 1 / sum;
}

function transposeMatrix(matrix: RealMatrix): RealMatrix {
  const output = new Float64Array(matrix.values.length);
  for (let column = 0; column < matrix.columns; column += 1) {
    for (let row = 0; row < matrix.rows; row += 1) {
      output[column + row * matrix.columns] = matrix.values[row + column * matrix.rows] ?? 0;
    }
  }
  return {
    values: output,
    rows: matrix.columns,
    columns: matrix.rows,
  };
}

function directConditionNumber(
  matrix: RealMatrix,
  inverse: RealMatrix | undefined,
  norm: KappaNorm,
  invocation: BuiltinInvocation,
): number {
  if (matrix.rows === 0 && matrix.columns === 0) return 0;
  if (
    matrix.rows !== matrix.columns ||
    inverse === undefined ||
    inverse.rows !== matrix.rows ||
    inverse.columns !== matrix.columns
  ) {
    return Number.POSITIVE_INFINITY;
  }
  if (norm === "2") return singularConditionNumber(matrix, invocation);
  return matrixNorm(matrix, norm) * matrixNorm(inverse, norm);
}

function matrixNorm(matrix: RealMatrix, norm: "1" | "I"): number {
  let maximum = 0;
  if (norm === "1") {
    for (let column = 0; column < matrix.columns; column += 1) {
      let sum = 0;
      for (let row = 0; row < matrix.rows; row += 1) {
        sum += Math.abs(matrix.values[row + column * matrix.rows] ?? 0);
      }
      maximum = Math.max(maximum, sum);
    }
  } else {
    for (let row = 0; row < matrix.rows; row += 1) {
      let sum = 0;
      for (let column = 0; column < matrix.columns; column += 1) {
        sum += Math.abs(matrix.values[row + column * matrix.rows] ?? 0);
      }
      maximum = Math.max(maximum, sum);
    }
  }
  return maximum;
}

function invertSquareMatrix(
  matrix: RealMatrix,
  invocation: BuiltinInvocation,
): RealMatrix | undefined {
  if (matrix.rows !== matrix.columns) return undefined;
  const order = matrix.rows;
  invocation.context.allocate(order * order * 2);
  const working = matrixToRows(matrix);
  const inverse: number[][] = Array.from({ length: order }, (_, row) =>
    Array.from({ length: order }, (_, column) => (row === column ? 1 : 0)),
  );
  for (let pivot = 0; pivot < order; pivot += 1) {
    invocation.context.checkpoint();
    let selected = pivot;
    for (let row = pivot + 1; row < order; row += 1) {
      if (Math.abs(working[row]?.[pivot] ?? 0) > Math.abs(working[selected]?.[pivot] ?? 0)) {
        selected = row;
      }
    }
    const pivotValue = working[selected]?.[pivot] ?? 0;
    if (pivotValue === 0) return undefined;
    [working[pivot], working[selected]] = [working[selected]!, working[pivot]!];
    [inverse[pivot], inverse[selected]] = [inverse[selected]!, inverse[pivot]!];
    for (let column = 0; column < order; column += 1) {
      working[pivot]![column] = (working[pivot]?.[column] ?? 0) / pivotValue;
      inverse[pivot]![column] = (inverse[pivot]?.[column] ?? 0) / pivotValue;
    }
    for (let row = 0; row < order; row += 1) {
      if (row === pivot) continue;
      const factor = working[row]?.[pivot] ?? 0;
      for (let column = 0; column < order; column += 1) {
        working[row]![column] =
          (working[row]?.[column] ?? 0) - factor * (working[pivot]?.[column] ?? 0);
        inverse[row]![column] =
          (inverse[row]?.[column] ?? 0) - factor * (inverse[pivot]?.[column] ?? 0);
      }
    }
  }
  const values = new Float64Array(order * order);
  for (let column = 0; column < order; column += 1) {
    for (let row = 0; row < order; row += 1) {
      values[row + column * order] = inverse[row]?.[column] ?? 0;
    }
  }
  return { values, rows: order, columns: order };
}
