import {
  REvaluationError,
  RTypeMismatchError,
  R_NULL,
  characterVector,
  dataFrameRowCount,
  doubleVector,
  factorLevels,
  integerVector,
  isAtomic,
  isDataFrame,
  isFactor,
  isMissing,
  listValue,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  RList,
  RValue,
  RVector,
} from "@nativr/runtime";
import { matchBuiltinArguments } from "./arguments.js";
import { nextRandom, randomState } from "./random.js";

export interface ClusteringBuiltinSpec {
  readonly name: string;
  readonly parameters: readonly string[];
  readonly compatibility: "numeric" | "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

export const CLUSTERING_BUILTIN_SPECS: readonly ClusteringBuiltinSpec[] = [
  {
    name: "kmeans",
    parameters: ["x", "centers", "iter.max", "nstart", "algorithm", "trace"],
    compatibility: "numeric",
    implementation: builtinKmeans,
  },
];

type KmeansAlgorithm = "Hartigan-Wong" | "Lloyd" | "Forgy" | "MacQueen";

const KMEANS_ALGORITHMS: readonly KmeansAlgorithm[] = [
  "Hartigan-Wong",
  "Lloyd",
  "Forgy",
  "MacQueen",
];

interface NumericMatrix {
  readonly values: Float64Array;
  readonly rows: number;
  readonly columns: number;
  readonly rowNames?: readonly string[];
  readonly columnNames?: readonly string[];
}

interface KmeansFit {
  readonly cluster: Int32Array;
  readonly centers: Float64Array;
  readonly withinss: Float64Array;
  readonly size: Int32Array;
  readonly totalWithinss: number;
  readonly iterations: number;
  readonly ifault?: number;
}

async function builtinKmeans(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, [
    "x",
    "centers",
    "iter.max",
    "nstart",
    "algorithm",
    "trace",
  ]);
  const xArgument = matched.get("x");
  const centersArgument = matched.get("centers");
  if (xArgument === undefined || xArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'x' is missing in kmeans().");
  }
  if (centersArgument === undefined || centersArgument.promise.missing) {
    throw new REvaluationError("NRE2103", "Argument 'centers' is missing in kmeans().");
  }
  const x = numericMatrix(await invocation.force(xArgument.promise), "x", invocation);
  if (x.rows === 0) {
    throw new RTypeMismatchError("NRT3268", "kmeans() requires at least one observation.");
  }
  validateFiniteMatrix(x, "x");
  const iterationLimit = await kmeansPositiveInteger(
    invocation,
    matched.get("iter.max"),
    10,
    "iter.max",
  );
  const startCount = await kmeansPositiveInteger(invocation, matched.get("nstart"), 1, "nstart");
  const algorithm = await kmeansAlgorithm(invocation, matched.get("algorithm"));
  const trace = await kmeansFlag(invocation, matched.get("trace"), false, "trace");
  const centersValue = await invocation.force(centersArgument.promise);
  const scalarCenterCount = kmeansCenterCount(centersValue);
  const distinctRows = distinctDataRows(x);

  let clusterCount: number;
  let explicitCenters: Float64Array | undefined;
  let starts: number;
  if (scalarCenterCount !== undefined) {
    clusterCount = scalarCenterCount;
    if (clusterCount > x.rows) {
      throw new RTypeMismatchError(
        "NRT3268",
        "cannot take a sample larger than the population without replacement.",
      );
    }
    if (clusterCount > distinctRows.length) {
      throw new RTypeMismatchError("NRT3268", "more cluster centers than distinct data points.");
    }
    starts = startCount;
  } else {
    const supplied = numericMatrix(centersValue, "centers", invocation);
    validateFiniteMatrix(supplied, "centers");
    if (supplied.columns !== x.columns) {
      throw new RTypeMismatchError(
        "NRT3268",
        "kmeans() centers must have the same number of columns as x.",
      );
    }
    if (supplied.rows === 0 || supplied.rows > x.rows) {
      throw new RTypeMismatchError("NRT3268", "kmeans() has an invalid number of centers.");
    }
    if (distinctDataRows(supplied).length !== supplied.rows) {
      throw new RTypeMismatchError("NRT3268", "initial centers are not distinct.");
    }
    clusterCount = supplied.rows;
    explicitCenters = Float64Array.from(supplied.values);
    starts = 1;
  }

  invocation.context.allocate(
    x.rows * 3 + x.columns * Math.max(1, clusterCount) * 3 + clusterCount * 3,
  );
  let best: KmeansFit | undefined;
  for (let start = 0; start < starts; start += 1) {
    invocation.context.checkpoint();
    const initial =
      explicitCenters === undefined
        ? sampleInitialCenters(x, distinctRows, clusterCount, invocation)
        : Float64Array.from(explicitCenters);
    const fit =
      clusterCount === 1
        ? fitSingleCluster(x)
        : algorithm === "Hartigan-Wong"
          ? fitHartiganWong(x, initial, clusterCount, iterationLimit, trace, invocation)
          : algorithm === "MacQueen"
            ? fitMacQueen(x, initial, clusterCount, iterationLimit, invocation)
            : fitLloyd(x, initial, clusterCount, iterationLimit, invocation);
    if (best === undefined || fit.totalWithinss < best.totalWithinss) best = fit;
  }
  if (best === undefined) throw new Error("Internal kmeans start invariant failed.");
  if (best.ifault === 2) {
    invocation.context.warn({
      code: "NRW1102",
      message: `did not converge in ${iterationLimit} iteration${iterationLimit === 1 ? "" : "s"}`,
    });
  }
  return kmeansResult(x, best, invocation);
}

function numericMatrix(
  value: RValue,
  role: "x" | "centers",
  invocation: BuiltinInvocation,
): NumericMatrix {
  if (value.type === "list" && isDataFrame(value)) {
    const rows = dataFrameRowCount(value);
    const columns = value.length;
    invocation.context.allocate(rows * columns);
    const output = new Float64Array(rows * columns);
    let coercionWarning = false;
    for (let column = 0; column < columns; column += 1) {
      const input = value.values[column];
      if (input === undefined || !isAtomic(input) || input.type === "complex") {
        throw new RTypeMismatchError(
          "NRT3268",
          `kmeans() ${role} data-frame columns must be coercible atomic vectors.`,
        );
      }
      for (let row = 0; row < rows; row += 1) {
        const converted = matrixCell(input, row);
        output[row + column * rows] = converted.value;
        coercionWarning ||= converted.warned;
      }
    }
    if (coercionWarning) {
      invocation.context.warn({ code: "NRW1006", message: "NAs introduced by coercion" });
    }
    const rowNames = dataFrameRowNames(value);
    const columnNames = vectorNames(value);
    return {
      values: output,
      rows,
      columns,
      ...(rowNames === undefined ? {} : { rowNames }),
      ...(columnNames === undefined ? {} : { columnNames }),
    };
  }
  if (!isAtomic(value) || value.type === "complex") {
    throw new RTypeMismatchError(
      "NRT3268",
      `kmeans() ${role} must be a real atomic vector, matrix, or numeric data frame.`,
    );
  }
  const dimensions = vectorDimensions(value);
  if (dimensions !== undefined && dimensions.length !== 2) {
    throw new RTypeMismatchError("NRT3268", `kmeans() ${role} must be two-dimensional.`);
  }
  const rows = dimensions?.[0] ?? value.length;
  const columns = dimensions?.[1] ?? 1;
  invocation.context.allocate(value.length);
  const output = new Float64Array(value.length);
  let coercionWarning = false;
  for (let index = 0; index < value.length; index += 1) {
    const converted = matrixCell(value, index);
    output[index] = converted.value;
    coercionWarning ||= converted.warned;
  }
  if (coercionWarning) {
    invocation.context.warn({ code: "NRW1006", message: "NAs introduced by coercion" });
  }
  const dimensionNames = matrixDimensionNames(value);
  const vectorRowNames = dimensions === undefined ? vectorNames(value) : dimensionNames.row;
  return {
    values: output,
    rows,
    columns,
    ...(vectorRowNames === undefined ? {} : { rowNames: vectorRowNames }),
    ...(dimensions === undefined || dimensionNames.column === undefined
      ? {}
      : { columnNames: dimensionNames.column }),
  };
}

function matrixCell(
  value: Exclude<RVector, RList> & { readonly type: string },
  index: number,
): { readonly value: number; readonly warned: boolean } {
  if (isMissing(value, index)) return { value: Number.NaN, warned: false };
  if (isFactor(value)) {
    const label = factorLevels(value)[(value.values[index] ?? 0) - 1] ?? "";
    const number = numericText(label);
    return { value: number, warned: Number.isNaN(number) };
  }
  if (value.type === "character") {
    const number = numericText(value.values[index] ?? "");
    return { value: number, warned: Number.isNaN(number) };
  }
  if (value.type === "complex") return { value: Number.NaN, warned: false };
  return { value: value.values[index] ?? 0, warned: false };
}

function numericText(value: string): number {
  if (value.trim() === "") return Number.NaN;
  const result = Number(value);
  return Number.isFinite(result) ? result : Number.NaN;
}

function dataFrameRowNames(value: RList): readonly string[] | undefined {
  const rowNames = value.attributes.get("row.names");
  return rowNames?.type === "character" && rowNames.missing === undefined
    ? rowNames.values
    : undefined;
}

function matrixDimensionNames(value: RVector): {
  readonly row?: readonly string[];
  readonly column?: readonly string[];
} {
  const dimnames = value.attributes.get("dimnames");
  if (dimnames?.type !== "list" || dimnames.length !== 2) return {};
  const row = dimnames.values[0];
  const column = dimnames.values[1];
  return {
    ...(row?.type === "character" && row.missing === undefined ? { row: row.values } : {}),
    ...(column?.type === "character" && column.missing === undefined
      ? { column: column.values }
      : {}),
  };
}

function validateFiniteMatrix(value: NumericMatrix, role: "x" | "centers"): void {
  if ([...value.values].some((entry) => !Number.isFinite(entry))) {
    throw new RTypeMismatchError("NRT3268", `NA/NaN/Inf in kmeans() ${role}.`);
  }
}

function kmeansCenterCount(value: RValue): number | undefined {
  if (!isAtomic(value) || value.length !== 1) return undefined;
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    isMissing(value, 0)
  ) {
    return undefined;
  }
  const count = Math.trunc(value.values[0] ?? 0);
  if (!Number.isFinite(count) || count < 1) {
    throw new RTypeMismatchError("NRT3268", "kmeans() centers must be a positive number.");
  }
  return count;
}

async function kmeansPositiveInteger(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: "iter.max" | "nstart",
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (
    !isAtomic(value) ||
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3268", `'${name}' must be positive.`);
  }
  const result = Math.trunc(value.values[0] ?? 0);
  if (!Number.isFinite(result) || result < 1) {
    throw new RTypeMismatchError("NRT3268", `'${name}' must be positive.`);
  }
  return result;
}

async function kmeansAlgorithm(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<KmeansAlgorithm> {
  if (argument === undefined || argument.promise.missing) return "Hartigan-Wong";
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length === 0 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3268", "kmeans() algorithm must be one character choice.");
  }
  const choice = value.values[0] ?? "";
  const exact = KMEANS_ALGORITHMS.find((candidate) => candidate === choice);
  if (exact !== undefined) return exact;
  const partial = KMEANS_ALGORITHMS.filter((candidate) => candidate.startsWith(choice));
  if (partial.length === 1) return partial[0] as KmeansAlgorithm;
  throw new REvaluationError(
    "NRE2139",
    `'algorithm' should be one of ${KMEANS_ALGORITHMS.map((item) => `"${item}"`).join(", ")}`,
  );
}

async function kmeansFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (!isAtomic(value) || value.length === 0 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3268", `kmeans() ${name} must be logical.`);
  }
  if (value.type === "character") {
    const text = (value.values[0] ?? "").toLowerCase();
    if (text === "true" || text === "t") return true;
    if (text === "false" || text === "f") return false;
    throw new RTypeMismatchError("NRT3268", `kmeans() ${name} must be logical.`);
  }
  if (value.type === "complex") {
    const real = value.real[0] ?? 0;
    const imaginary = value.imaginary[0] ?? 0;
    return real !== 0 || imaginary !== 0;
  }
  return (value.values[0] ?? 0) !== 0;
}

function distinctDataRows(value: NumericMatrix): readonly number[] {
  const firstByKey = new Map<string, number>();
  for (let row = 0; row < value.rows; row += 1) {
    const key = matrixRowKey(value, row);
    if (!firstByKey.has(key)) firstByKey.set(key, row);
  }
  return [...firstByKey.values()];
}

function matrixRowKey(value: NumericMatrix, row: number): string {
  return Array.from({ length: value.columns }, (_unused, column) => {
    const item = value.values[row + column * value.rows] ?? 0;
    return Object.is(item, -0) ? "0" : String(item);
  }).join("\u0000");
}

function sampleInitialCenters(
  x: NumericMatrix,
  distinctRows: readonly number[],
  clusterCount: number,
  invocation: BuiltinInvocation,
): Float64Array {
  const pool = [...distinctRows];
  const random = randomState(invocation);
  for (let index = 0; index < clusterCount; index += 1) {
    const selected = index + Math.floor(nextRandom(random) * (pool.length - index));
    [pool[index], pool[selected]] = [pool[selected] ?? 0, pool[index] ?? 0];
  }
  const centers = new Float64Array(clusterCount * x.columns);
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const row = pool[cluster] ?? 0;
    for (let column = 0; column < x.columns; column += 1) {
      centers[cluster + column * clusterCount] = x.values[row + column * x.rows] ?? 0;
    }
  }
  return centers;
}

function fitSingleCluster(x: NumericMatrix): KmeansFit {
  const cluster = new Int32Array(x.rows);
  const centers = recomputeCenters(x, cluster, 1).centers;
  const summary = summarizeClusters(x, cluster, centers, 1);
  return {
    cluster,
    centers,
    withinss: summary.withinss,
    size: summary.size,
    totalWithinss: summary.totalWithinss,
    iterations: 1,
  };
}

function fitLloyd(
  x: NumericMatrix,
  initial: Float64Array,
  clusterCount: number,
  iterationLimit: number,
  invocation: BuiltinInvocation,
): KmeansFit {
  let centers: Float64Array<ArrayBufferLike> = Float64Array.from(initial);
  let previous: Int32Array<ArrayBufferLike> = new Int32Array(x.rows).fill(-1);
  let latest: Int32Array<ArrayBufferLike> = previous;
  for (let iteration = 1; iteration <= iterationLimit; iteration += 1) {
    latest = assignClusters(x, centers, clusterCount, invocation);
    const changed = !sameAssignments(latest, previous);
    const recomputed = recomputeCenters(x, latest, clusterCount);
    requireNonemptyClusters(recomputed.size);
    centers = recomputed.centers;
    if (!changed) return finishKmeans(x, latest, centers, clusterCount, iteration);
    previous = latest;
  }
  return finishKmeans(x, latest, centers, clusterCount, iterationLimit + 1, 2);
}

function fitMacQueen(
  x: NumericMatrix,
  initial: Float64Array,
  clusterCount: number,
  iterationLimit: number,
  invocation: BuiltinInvocation,
): KmeansFit {
  const cluster = assignClusters(x, initial, clusterCount, invocation);
  let recomputed = recomputeCenters(x, cluster, clusterCount);
  requireNonemptyClusters(recomputed.size);
  let centers = recomputed.centers;
  let size = recomputed.size;
  for (let iteration = 1; iteration <= iterationLimit; iteration += 1) {
    let changed = false;
    for (let row = 0; row < x.rows; row += 1) {
      invocation.context.checkpoint();
      const current = cluster[row] ?? 0;
      const selected = nearestCenter(x, row, centers, clusterCount);
      if (selected === current || (size[current] ?? 0) <= 1) continue;
      transferPoint(x, row, current, selected, centers, size);
      cluster[row] = selected;
      changed = true;
    }
    if (!changed) return finishKmeans(x, cluster, centers, clusterCount, iteration);
  }
  recomputed = recomputeCenters(x, cluster, clusterCount);
  centers = recomputed.centers;
  size = recomputed.size;
  requireNonemptyClusters(size);
  return finishKmeans(x, cluster, centers, clusterCount, iterationLimit + 1, 2);
}

function fitHartiganWong(
  x: NumericMatrix,
  initial: Float64Array,
  clusterCount: number,
  iterationLimit: number,
  trace: boolean,
  invocation: BuiltinInvocation,
): KmeansFit {
  const cluster = assignClusters(x, initial, clusterCount, invocation);
  const recomputed = recomputeCenters(x, cluster, clusterCount);
  requireNonemptyClusters(recomputed.size);
  const centers = recomputed.centers;
  const size = recomputed.size;
  for (let iteration = 1; iteration <= iterationLimit; iteration += 1) {
    let transferred = false;
    for (let row = 0; row < x.rows; row += 1) {
      invocation.context.checkpoint();
      const current = cluster[row] ?? 0;
      if ((size[current] ?? 0) <= 1) continue;
      const removal =
        ((size[current] ?? 0) / ((size[current] ?? 0) - 1)) *
        squaredDistance(x, row, centers, current, clusterCount);
      let selected = current;
      let bestAddition = removal;
      for (let candidate = 0; candidate < clusterCount; candidate += 1) {
        if (candidate === current) continue;
        const addition =
          ((size[candidate] ?? 0) / ((size[candidate] ?? 0) + 1)) *
          squaredDistance(x, row, centers, candidate, clusterCount);
        if (addition < bestAddition) {
          bestAddition = addition;
          selected = candidate;
        }
      }
      if (selected === current) continue;
      transferPoint(x, row, current, selected, centers, size);
      cluster[row] = selected;
      transferred = true;
    }
    const summary = summarizeClusters(x, cluster, centers, clusterCount);
    traceKmeans(trace, iteration, summary, invocation);
    if (!transferred) return finishKmeans(x, cluster, centers, clusterCount, iteration, 0);
  }
  return finishKmeans(x, cluster, centers, clusterCount, iterationLimit + 1, 2);
}

function assignClusters(
  x: NumericMatrix,
  centers: Float64Array,
  clusterCount: number,
  invocation: BuiltinInvocation,
): Int32Array {
  const output = new Int32Array(x.rows);
  for (let row = 0; row < x.rows; row += 1) {
    invocation.context.checkpoint();
    output[row] = nearestCenter(x, row, centers, clusterCount);
  }
  return output;
}

function nearestCenter(
  x: NumericMatrix,
  row: number,
  centers: Float64Array,
  clusterCount: number,
): number {
  let selected = 0;
  let best = squaredDistance(x, row, centers, 0, clusterCount);
  for (let cluster = 1; cluster < clusterCount; cluster += 1) {
    const distance = squaredDistance(x, row, centers, cluster, clusterCount);
    if (distance < best) {
      best = distance;
      selected = cluster;
    }
  }
  return selected;
}

function squaredDistance(
  x: NumericMatrix,
  row: number,
  centers: Float64Array,
  cluster: number,
  clusterCount: number,
): number {
  let total = 0;
  for (let column = 0; column < x.columns; column += 1) {
    const difference =
      (x.values[row + column * x.rows] ?? 0) - (centers[cluster + column * clusterCount] ?? 0);
    total += difference * difference;
  }
  return total;
}

function recomputeCenters(
  x: NumericMatrix,
  cluster: Int32Array,
  clusterCount: number,
): { readonly centers: Float64Array; readonly size: Int32Array } {
  const centers = new Float64Array(clusterCount * x.columns);
  const size = new Int32Array(clusterCount);
  for (let row = 0; row < x.rows; row += 1) {
    const selected = cluster[row] ?? 0;
    size[selected] = (size[selected] ?? 0) + 1;
    for (let column = 0; column < x.columns; column += 1) {
      const index = selected + column * clusterCount;
      centers[index] = (centers[index] ?? 0) + (x.values[row + column * x.rows] ?? 0);
    }
  }
  for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
    if (size[clusterIndex] === 0) continue;
    for (let column = 0; column < x.columns; column += 1) {
      const index = clusterIndex + column * clusterCount;
      centers[index] = (centers[index] ?? 0) / (size[clusterIndex] ?? 1);
    }
  }
  return { centers, size };
}

function transferPoint(
  x: NumericMatrix,
  row: number,
  from: number,
  to: number,
  centers: Float64Array,
  size: Int32Array,
): void {
  const fromSize = size[from] ?? 0;
  const toSize = size[to] ?? 0;
  for (let column = 0; column < x.columns; column += 1) {
    const value = x.values[row + column * x.rows] ?? 0;
    const fromIndex = from + column * size.length;
    const toIndex = to + column * size.length;
    centers[fromIndex] = ((centers[fromIndex] ?? 0) * fromSize - value) / (fromSize - 1);
    centers[toIndex] = ((centers[toIndex] ?? 0) * toSize + value) / (toSize + 1);
  }
  size[from] = (size[from] ?? 0) - 1;
  size[to] = (size[to] ?? 0) + 1;
}

function sameAssignments(left: Int32Array, right: Int32Array): boolean {
  return left.every((value, index) => value === right[index]);
}

function requireNonemptyClusters(size: Int32Array): void {
  if ([...size].some((value) => value === 0)) {
    throw new REvaluationError("NRE2141", "empty cluster: try a better set of initial centers.");
  }
}

function finishKmeans(
  x: NumericMatrix,
  cluster: Int32Array,
  centers: Float64Array,
  clusterCount: number,
  iterations: number,
  ifault?: number,
): KmeansFit {
  const recomputed = recomputeCenters(x, cluster, clusterCount);
  requireNonemptyClusters(recomputed.size);
  const summary = summarizeClusters(x, cluster, recomputed.centers, clusterCount);
  return {
    cluster: Int32Array.from(cluster),
    centers: recomputed.centers,
    withinss: summary.withinss,
    size: summary.size,
    totalWithinss: summary.totalWithinss,
    iterations,
    ...(ifault === undefined ? {} : { ifault }),
  };
}

function summarizeClusters(
  x: NumericMatrix,
  cluster: Int32Array,
  centers: Float64Array,
  clusterCount: number,
): { readonly withinss: Float64Array; readonly size: Int32Array; readonly totalWithinss: number } {
  const withinss = new Float64Array(clusterCount);
  const size = new Int32Array(clusterCount);
  for (let row = 0; row < x.rows; row += 1) {
    const selected = cluster[row] ?? 0;
    size[selected] = (size[selected] ?? 0) + 1;
    withinss[selected] =
      (withinss[selected] ?? 0) + squaredDistance(x, row, centers, selected, clusterCount);
  }
  return {
    withinss,
    size,
    totalWithinss: withinss.reduce((sum, value) => sum + value, 0),
  };
}

function traceKmeans(
  trace: boolean,
  iteration: number,
  summary: { readonly totalWithinss: number },
  invocation: BuiltinInvocation,
): void {
  if (!trace) return;
  invocation.context.writeOutput({
    stream: "stdout",
    text: `kmeans iteration ${iteration}: withinss = ${String(summary.totalWithinss)}\n`,
  });
}

function kmeansResult(x: NumericMatrix, fit: KmeansFit, invocation: BuiltinInvocation): RList {
  const clusterCount = fit.size.length;
  let cluster = integerVector(Array.from(fit.cluster, (value) => value + 1));
  if (x.rowNames !== undefined) cluster = withNames(cluster, x.rowNames);
  let centers = withDimensions(doubleVector(fit.centers), [clusterCount, x.columns]);
  centers = withAttribute(
    centers,
    "dimnames",
    listValue([
      characterVector(Array.from({ length: clusterCount }, (_unused, index) => String(index + 1))),
      x.columnNames === undefined ? R_NULL : characterVector(x.columnNames),
    ]),
  );
  const totalSumSquares = kmeansTotalSumSquares(x);
  const betweenSumSquares = totalSumSquares - fit.totalWithinss;
  const ifault = fit.ifault === undefined ? R_NULL : integerVector([fit.ifault]);
  invocation.context.allocate(9);
  return withClasses(
    listValue(
      [
        cluster,
        centers,
        doubleVector([totalSumSquares]),
        doubleVector(fit.withinss),
        doubleVector([fit.totalWithinss]),
        doubleVector([betweenSumSquares]),
        integerVector(fit.size),
        integerVector([fit.iterations]),
        ifault,
      ],
      [
        "cluster",
        "centers",
        "totss",
        "withinss",
        "tot.withinss",
        "betweenss",
        "size",
        "iter",
        "ifault",
      ],
    ),
    ["kmeans"],
  );
}

function kmeansTotalSumSquares(x: NumericMatrix): number {
  let total = 0;
  for (let column = 0; column < x.columns; column += 1) {
    let mean = 0;
    for (let row = 0; row < x.rows; row += 1) {
      mean += x.values[row + column * x.rows] ?? 0;
    }
    mean /= x.rows;
    for (let row = 0; row < x.rows; row += 1) {
      const difference = (x.values[row + column * x.rows] ?? 0) - mean;
      total += difference * difference;
    }
  }
  return total;
}
