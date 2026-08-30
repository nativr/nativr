import {
  REvaluationError,
  RTypeMismatchError,
  R_NULL,
  characterVector,
  complexVector,
  dataFrameRowCount,
  doubleVector,
  isDataFrame,
  isFactor,
  isMissing,
  listValue,
  vectorDimensions,
  vectorNames,
  withAttribute,
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

export interface MatrixSummaryBuiltinSpec {
  readonly name: "rowSums" | "colSums" | "rowMeans" | "colMeans";
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

interface NumericElement {
  readonly real: number;
  readonly imaginary: number;
  readonly missing: boolean;
}

interface ColumnSummaryInput {
  readonly dimensions: readonly number[];
  readonly complex: boolean;
  readonly dimensionNames?: RList;
  readonly element: (index: number) => NumericElement;
}

export const MATRIX_SUMMARY_BUILTIN_SPECS: readonly MatrixSummaryBuiltinSpec[] = [
  {
    name: "rowSums",
    parameters: ["x", "na.rm", "dims"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinMatrixSummary(invocation, "row", "sum"),
  },
  {
    name: "colSums",
    parameters: ["x", "na.rm", "dims"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinMatrixSummary(invocation, "column", "sum"),
  },
  {
    name: "rowMeans",
    parameters: ["x", "na.rm", "dims"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinMatrixSummary(invocation, "row", "mean"),
  },
  {
    name: "colMeans",
    parameters: ["x", "na.rm", "dims"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinMatrixSummary(invocation, "column", "mean"),
  },
];

async function builtinMatrixSummary(
  invocation: BuiltinInvocation,
  direction: "row" | "column",
  operation: "sum" | "mean",
): Promise<RValue> {
  const call =
    operation === "sum"
      ? direction === "row"
        ? "rowSums"
        : "colSums"
      : direction === "row"
        ? "rowMeans"
        : "colMeans";
  const { matched } = matchBuiltinArguments(invocation, ["x", "na.rm", "dims"]);
  const inputArgument = requiredArgument(matched.get("x"), call);
  const value = await invocation.force(inputArgument.promise);
  const input = columnSummaryInput(value);
  const removeMissing = await logicalFlag(invocation, matched.get("na.rm"), "na.rm", false, call);
  const dimensions = await dimensionCount(
    invocation,
    matched.get("dims"),
    input.dimensions.length,
    call,
  );
  const outputDimensions =
    direction === "column"
      ? input.dimensions.slice(dimensions)
      : input.dimensions.slice(0, dimensions);
  const outputLength = product(outputDimensions);
  const groupSize = product(
    direction === "column"
      ? input.dimensions.slice(0, dimensions)
      : input.dimensions.slice(dimensions),
  );
  invocation.context.allocate(outputLength * (input.complex ? 3 : 2));

  const real = new Float64Array(outputLength);
  const imaginary = input.complex ? new Float64Array(outputLength) : undefined;
  const missing = new Uint8Array(outputLength);
  for (let group = 0; group < outputLength; group += 1) {
    let realTotal = 0;
    let imaginaryTotal = 0;
    let hasMissing = false;
    let present = 0;
    for (let offset = 0; offset < groupSize; offset += 1) {
      invocation.context.checkpoint();
      const inputIndex =
        direction === "column" ? group * groupSize + offset : group + offset * outputLength;
      const item = input.element(inputIndex);
      const nan = Number.isNaN(item.real) || Number.isNaN(item.imaginary);
      if (item.missing) {
        if (!removeMissing) hasMissing = true;
      } else if (!removeMissing || !nan) {
        realTotal += item.real;
        imaginaryTotal += item.imaginary;
        present += 1;
      }
    }
    const divisor = operation === "mean" ? (removeMissing ? present : groupSize) : 1;
    real[group] = realTotal / divisor;
    if (imaginary !== undefined) imaginary[group] = imaginaryTotal / divisor;
    if (hasMissing) missing[group] = 1;
  }

  const mask = missing.some((entry) => entry === 1) ? missing : undefined;
  const result =
    imaginary === undefined ? doubleVector(real, mask) : complexVector(real, imaginary, mask);
  return attachSummaryDimensions(result, input, direction, dimensions, outputDimensions);
}

function requiredArgument(
  argument: BuiltinCallArgument | undefined,
  call: string,
): BuiltinCallArgument {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument 'x' is missing in ${call}().`);
  }
  return argument;
}

async function logicalFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
  fallback: boolean,
  call: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError(
      "NRT3283",
      `${call}() '${name}' must be one non-missing logical value.`,
    );
  }
  return value.values[0] === 1;
}

async function dimensionCount(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  rank: number,
  call: string,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return 1;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3283", `${call}() invalid 'dims'`);
  }
  const dimensions = value.values[0] ?? Number.NaN;
  if (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions >= rank) {
    throw new RTypeMismatchError("NRT3283", `${call}() invalid 'dims'`);
  }
  return dimensions;
}

function columnSummaryInput(value: RValue): ColumnSummaryInput {
  if (isDataFrame(value)) return dataFrameSummaryInput(value);
  if (
    (value.type !== "logical" &&
      value.type !== "integer" &&
      value.type !== "double" &&
      value.type !== "complex") ||
    isFactor(value)
  ) {
    throw new RTypeMismatchError("NRT3283", "'x' must be numeric or complex");
  }
  const dimensions = vectorDimensions(value);
  if (dimensions === undefined || dimensions.length < 2) {
    throw new RTypeMismatchError("NRT3283", "'x' must be an array of at least two dimensions");
  }
  const dimensionNames = validDimensionNames(value, dimensions);
  return {
    dimensions,
    complex: value.type === "complex",
    ...(dimensionNames === undefined ? {} : { dimensionNames }),
    element: (index) =>
      value.type === "complex"
        ? {
            real: value.real[index] ?? 0,
            imaginary: value.imaginary[index] ?? 0,
            missing: isMissing(value, index),
          }
        : {
            real: value.values[index] ?? 0,
            imaginary: 0,
            missing: isMissing(value, index),
          },
  };
}

function dataFrameSummaryInput(value: RList): ColumnSummaryInput {
  const rows = dataFrameRowCount(value);
  const columns = value.values.map((column) => {
    if (
      (column.type !== "logical" &&
        column.type !== "integer" &&
        column.type !== "double" &&
        column.type !== "complex") ||
      isFactor(column) ||
      column.length !== rows
    ) {
      throw new RTypeMismatchError("NRT3283", "'x' must be numeric or complex");
    }
    return column;
  });
  const names = vectorNames(value);
  const rowNames = value.attributes.get("row.names");
  return {
    dimensions: [rows, columns.length],
    complex: columns.some((column) => column.type === "complex"),
    dimensionNames: listValue([
      rowNames?.type === "character" && value.automaticRowNames !== true ? rowNames : R_NULL,
      names === undefined ? R_NULL : characterVector(names),
    ]),
    element: (index) => {
      const column = columns[Math.floor(index / rows)];
      const row = rows === 0 ? 0 : index % rows;
      if (column === undefined) return { real: 0, imaginary: 0, missing: false };
      if (column.type === "complex") {
        return {
          real: column.real[row] ?? 0,
          imaginary: column.imaginary[row] ?? 0,
          missing: isMissing(column, row),
        };
      }
      return {
        real: column.values[row] ?? 0,
        imaginary: 0,
        missing: isMissing(column, row),
      };
    },
  };
}

function validDimensionNames(value: RVector, dimensions: readonly number[]): RList | undefined {
  const names = value.attributes.get("dimnames");
  if (names === undefined) return undefined;
  if (names.type !== "list" || names.length !== dimensions.length) {
    throw new RTypeMismatchError("NRT3283", "malformed 'dimnames' attribute");
  }
  for (const [index, labels] of names.values.entries()) {
    if (
      labels.type !== "null" &&
      (labels.type !== "character" ||
        labels.length !== dimensions[index] ||
        labels.missing !== undefined)
    ) {
      throw new RTypeMismatchError("NRT3283", "malformed 'dimnames' attribute");
    }
  }
  return names;
}

function attachSummaryDimensions<T extends RVector>(
  value: T,
  input: ColumnSummaryInput,
  direction: "row" | "column",
  dimensions: number,
  outputDimensions: readonly number[],
): T {
  const start = direction === "column" ? dimensions : 0;
  const names = input.dimensionNames?.values[start];
  if (outputDimensions.length === 1) {
    return names?.type === "character" ? withNames(value, names.values) : value;
  }
  let result = withDimensions(value, outputDimensions);
  if (input.dimensionNames === undefined) return result;
  const values = input.dimensionNames.values.slice(start, start + outputDimensions.length);
  const labels = vectorNames(input.dimensionNames)?.slice(start, start + outputDimensions.length);
  result = withAttribute(
    result,
    "dimnames",
    labels === undefined ? listValue(values) : listValue(values, labels),
  );
  return result;
}

function product(values: readonly number[]): number {
  return values.reduce((total, value) => total * value, 1);
}
