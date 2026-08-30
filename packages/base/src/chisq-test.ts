import {
  REvaluationError,
  RTypeMismatchError,
  characterVector,
  deparseAst,
  deparseSourceAst,
  doubleVector,
  integerVector,
  isFactor,
  isMissing,
  languageValueAst,
  listValue,
  logicalVector,
  subsetVector,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withClasses,
  withDimensions,
  withNames,
  withoutAttribute,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  RDoubleVector,
  RIntegerVector,
  RLogicalVector,
  RValue,
  RVector,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";
import { sampleFixedMarginTable } from "./conditional-table.js";
import { nextRandom, randomState, withDeferredRandomSeedSync } from "./random.js";
import { regularizedGammaProbability } from "./student-t.js";

const PARAMETERS = ["x", "y", "correct", "p", "rescale.p", "simulate.p.value", "B"] as const;
type NumericVector = RLogicalVector | RIntegerVector | RDoubleVector;

export async function builtinChiSquareTest(invocation: BuiltinInvocation): Promise<RValue> {
  const parsed = matchBuiltinArguments(invocation, PARAMETERS);
  const xArgument = parsed.matched.get("x");
  const x = await forceRequired(invocation, xArgument, "x");
  const yArgument = parsed.matched.get("y");
  const y =
    yArgument === undefined || yArgument.promise.missing
      ? undefined
      : await invocation.force(yArgument.promise);
  const correct = await scalarFlag(invocation, parsed.matched.get("correct"), true, "correct");
  const rescale = await scalarFlag(invocation, parsed.matched.get("rescale.p"), false, "rescale.p");
  const simulate = await scalarFlag(
    invocation,
    parsed.matched.get("simulate.p.value"),
    false,
    "simulate.p.value",
  );
  const replicates = simulate
    ? await simulationReplicates(invocation, parsed.matched.get("B"))
    : undefined;

  if (y !== undefined) {
    const table = await invocation.namespaceBinding("base", "table");
    if (table === undefined) throw new REvaluationError("NRE2001", "Object 'table' not found.");
    const xLabel = argumentLabel(xArgument, "x");
    const yLabel = argumentLabel(yArgument, "y");
    let observed = numericCounts(await invocation.invoke(table, [{ value: x }, { value: y }]), "x");
    const dimnames = observed.attributes.get("dimnames");
    if (dimnames?.type === "list" && dimnames.length === 2) {
      observed = withAttribute(observed, "dimnames", withNames(dimnames, [xLabel, yLabel]));
    }
    return contingencyTest(invocation, observed, `${xLabel} and ${yLabel}`, correct, replicates);
  }

  const observed = numericCounts(x, "x");
  const dimensions = vectorDimensions(observed);
  if (dimensions !== undefined && dimensions.length === 2) {
    return contingencyTest(
      invocation,
      observed,
      argumentLabel(xArgument, "x"),
      correct,
      replicates,
    );
  }
  if (dimensions !== undefined) {
    throw new RTypeMismatchError("NRT3423", "invalid 'x'");
  }
  return goodnessOfFitTest(
    invocation,
    observed,
    argumentLabel(xArgument, "x"),
    parsed.matched.get("p"),
    rescale,
    replicates,
  );
}

async function goodnessOfFitTest(
  invocation: BuiltinInvocation,
  observed: NumericVector,
  dataName: string,
  probabilityArgument: BuiltinCallArgument | undefined,
  rescale: boolean,
  replicates: number | undefined,
): Promise<RValue> {
  if (observed.length < 2) {
    throw new RTypeMismatchError("NRT3423", "'x' must at least have 2 elements");
  }
  const values = finiteNonnegativeCounts(observed);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0))
    throw new RTypeMismatchError("NRT3423", "at least one entry of 'x' must be positive");

  const probability =
    probabilityArgument === undefined || probabilityArgument.promise.missing
      ? new Array<number>(observed.length).fill(1 / observed.length)
      : finiteProbabilities(await invocation.force(probabilityArgument.promise));
  if (probability.length !== observed.length) {
    throw new RTypeMismatchError("NRT3423", "'x' and 'p' must have the same number of elements");
  }
  const probabilityTotal = probability.reduce((sum, value) => sum + value, 0);
  if (!(probabilityTotal > 0)) {
    throw new RTypeMismatchError("NRT3423", "probabilities must be non-negative");
  }
  if (!rescale && Math.abs(probabilityTotal - 1) > Math.sqrt(Number.EPSILON)) {
    throw new RTypeMismatchError("NRT3423", "probabilities must sum to 1.");
  }
  const normalized = probability.map((value) => value / probabilityTotal);
  if (normalized.some((value, index) => value === 0 && (values[index] ?? 0) > 0)) {
    throw new RTypeMismatchError("NRT3423", "some probabilities are zero");
  }
  const expected = normalized.map((value) => total * value);
  const residuals = values.map((value, index) =>
    expected[index] === 0
      ? Number.NaN
      : (value - (expected[index] ?? 0)) / Math.sqrt(expected[index] ?? 0),
  );
  const stdres = residuals.map((value, index) =>
    expected[index] === 0
      ? Number.NaN
      : value / Math.sqrt(Math.max(0, 1 - (normalized[index] ?? 0))),
  );
  let statistic = 0;
  let degrees = -1;
  for (let index = 0; index < values.length; index += 1) {
    if ((expected[index] ?? 0) === 0) continue;
    statistic += ((values[index] ?? 0) - (expected[index] ?? 0)) ** 2 / (expected[index] ?? 1);
    degrees += 1;
  }
  const pValue =
    replicates === undefined
      ? chiSquareUpperTail(statistic, degrees)
      : simulatedGoodnessPValue(invocation, total, normalized, expected, statistic, replicates);
  if (replicates === undefined && expected.some((value) => value < 5)) {
    warnApproximation(invocation);
  }
  invocation.context.allocate(values.length * 4 + 20);
  return htest(
    statistic,
    replicates === undefined ? doubleVector([degrees]) : missingParameter(),
    pValue,
    replicates === undefined
      ? "Chi-squared test for given probabilities"
      : simulatedMethod("Chi-squared test for given probabilities", replicates),
    dataName,
    observed,
    shapedDouble(expected, observed, false),
    shapedDouble(residuals, observed, true),
    shapedDouble(stdres, observed, true),
  );
}

function contingencyTest(
  invocation: BuiltinInvocation,
  supplied: NumericVector,
  dataName: string,
  correct: boolean,
  replicates: number | undefined,
): RValue {
  const dimensions = vectorDimensions(supplied);
  if (dimensions === undefined || dimensions.length !== 2) {
    throw new RTypeMismatchError(
      "NRT3423",
      "'x' must be a matrix with at least two rows and columns",
    );
  }
  let rows = dimensions[0] ?? 0;
  let columns = dimensions[1] ?? 0;
  if (rows < 2 || columns < 2) {
    throw new RTypeMismatchError("NRT3423", "'x' must at least have 2 elements");
  }
  let observed = supplied;
  let values = finiteNonnegativeCounts(observed);
  let margins = tableMargins(values, rows, columns);
  const retainedRows = margins.rows
    .map((value, index) => (value > 0 ? index : -1))
    .filter((index) => index >= 0);
  const retainedColumns = margins.columns
    .map((value, index) => (value > 0 ? index : -1))
    .filter((index) => index >= 0);
  if (retainedRows.length !== rows || retainedColumns.length !== columns) {
    observed = subsetMatrix(observed, rows, columns, retainedRows, retainedColumns, invocation);
    rows = retainedRows.length;
    columns = retainedColumns.length;
    if (rows < 2 || columns < 2) {
      throw new RTypeMismatchError("NRT3423", "'x' must at least have 2 elements");
    }
    values = finiteNonnegativeCounts(observed);
    margins = tableMargins(values, rows, columns);
  }
  const total = margins.rows.reduce((sum, value) => sum + value, 0);
  if (!(total > 0))
    throw new RTypeMismatchError("NRT3423", "at least one entry of 'x' must be positive");
  const expected = new Array<number>(values.length);
  const residuals = new Array<number>(values.length);
  const stdres = new Array<number>(values.length);
  const yates = replicates === undefined && correct && rows === 2 && columns === 2;
  let statistic = 0;
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      invocation.context.checkpoint();
      const index = row + column * rows;
      const fitted = ((margins.rows[row] ?? 0) * (margins.columns[column] ?? 0)) / total;
      const difference = (values[index] ?? 0) - fitted;
      const adjusted = yates
        ? Math.max(0, Math.abs(difference) - Math.min(0.5, Math.abs(difference)))
        : difference;
      expected[index] = fitted;
      residuals[index] = difference / Math.sqrt(fitted);
      stdres[index] =
        difference /
        Math.sqrt(
          fitted *
            (1 - (margins.rows[row] ?? 0) / total) *
            (1 - (margins.columns[column] ?? 0) / total),
        );
      statistic += (adjusted * adjusted) / fitted;
    }
  }
  const degrees = (rows - 1) * (columns - 1);
  const pValue =
    replicates === undefined
      ? chiSquareUpperTail(statistic, degrees)
      : simulatedContingencyPValue(
          invocation,
          margins.rows,
          margins.columns,
          expected,
          statistic,
          replicates,
        );
  if (replicates === undefined && expected.some((value) => value < 5)) {
    warnApproximation(invocation);
  }
  invocation.context.allocate(values.length * 4 + 20);
  return htest(
    statistic,
    replicates === undefined ? integerVector([degrees]) : missingParameter(),
    pValue,
    replicates !== undefined
      ? simulatedMethod("Pearson's Chi-squared test", replicates)
      : yates
        ? "Pearson's Chi-squared test with Yates' continuity correction"
        : "Pearson's Chi-squared test",
    dataName,
    observed,
    shapedDouble(expected, observed, false),
    shapedDouble(residuals, observed, true),
    shapedDouble(stdres, observed, true),
  );
}

function simulatedContingencyPValue(
  invocation: BuiltinInvocation,
  rowMargins: readonly number[],
  columnMargins: readonly number[],
  expected: readonly number[],
  observedStatistic: number,
  replicates: number,
): number {
  requireIntegralMargins(rowMargins, columnMargins);
  const count = Math.floor(replicates);
  invocation.context.allocate(
    rowMargins.reduce((sum, value) => sum + value, 0) + expected.length + count,
  );
  const random = randomState(invocation);
  let extreme = 0;
  withDeferredRandomSeedSync(random, () => {
    for (let replicate = 0; replicate < count; replicate += 1) {
      invocation.context.checkpoint();
      const table = sampleFixedMarginTable(rowMargins, columnMargins, random, invocation);
      let statistic = 0;
      for (let index = 0; index < table.length; index += 1) {
        const fitted = expected[index] ?? 0;
        if (fitted > 0) statistic += ((table[index] ?? 0) - fitted) ** 2 / fitted;
      }
      if (statistic >= observedStatistic * (1 - 64 * Number.EPSILON)) extreme += 1;
    }
  });
  return (extreme + 1) / (replicates + 1);
}

function simulatedGoodnessPValue(
  invocation: BuiltinInvocation,
  total: number,
  probabilities: readonly number[],
  expected: readonly number[],
  observedStatistic: number,
  replicates: number,
): number {
  if (!Number.isSafeInteger(total)) {
    throw new RTypeMismatchError(
      "NRT3423",
      "simulated chi-squared tests require an integer total count",
    );
  }
  const count = Math.floor(replicates);
  invocation.context.allocate(total + probabilities.length + count);
  const ordered = probabilities
    .map((probability, index) => ({ probability, index }))
    .sort((left, right) => right.probability - left.probability);
  const random = randomState(invocation);
  let extreme = 0;
  withDeferredRandomSeedSync(random, () => {
    for (let replicate = 0; replicate < count; replicate += 1) {
      invocation.context.checkpoint();
      const counts = new Array<number>(probabilities.length).fill(0);
      for (let draw = 0; draw < total; draw += 1) {
        let threshold = nextRandom(random);
        let selected = ordered[ordered.length - 1]?.index ?? 0;
        for (const entry of ordered) {
          threshold -= entry.probability;
          if (threshold < 0) {
            selected = entry.index;
            break;
          }
        }
        counts[selected] = (counts[selected] ?? 0) + 1;
      }
      let statistic = 0;
      for (let index = 0; index < counts.length; index += 1) {
        const fitted = expected[index] ?? 0;
        if (fitted > 0) statistic += ((counts[index] ?? 0) - fitted) ** 2 / fitted;
      }
      if (statistic >= observedStatistic * (1 - 64 * Number.EPSILON)) extreme += 1;
    }
  });
  return (extreme + 1) / (replicates + 1);
}

function requireIntegralMargins(
  rowMargins: readonly number[],
  columnMargins: readonly number[],
): void {
  if (![...rowMargins, ...columnMargins].every(Number.isSafeInteger)) {
    throw new RTypeMismatchError(
      "NRT3423",
      "simulated contingency tests require integer marginal totals",
    );
  }
}

function missingParameter(): RVector {
  return withNames(logicalVector([false], [1]), ["df"]);
}

function simulatedMethod(base: string, replicates: number): string {
  return `${base} with simulated p-value\n\t (based on ${String(replicates)} replicates)`;
}

async function simulationReplicates(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<number> {
  if (argument === undefined || argument.promise.missing) return 2000;
  const value = await invocation.force(argument.promise);
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    isFactor(value) ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3423", "'B' must be one non-negative finite number");
  }
  const result = Number(value.values[0] ?? 0);
  if (!Number.isFinite(result) || result < 0 || result > Number.MAX_SAFE_INTEGER) {
    throw new RTypeMismatchError("NRT3423", "'B' must be one non-negative finite number");
  }
  return result;
}

function htest(
  statistic: number,
  parameter: RVector,
  pValue: number,
  method: string,
  dataName: string,
  observed: RValue,
  expected: RValue,
  residuals: RValue,
  stdres: RValue,
): RValue {
  return withClasses(
    listValue(
      [
        withNames(doubleVector([statistic]), ["X-squared"]),
        withNames(parameter, ["df"]),
        doubleVector([pValue]),
        characterVector([method]),
        characterVector([dataName]),
        observed,
        expected,
        residuals,
        stdres,
      ],
      [
        "statistic",
        "parameter",
        "p.value",
        "method",
        "data.name",
        "observed",
        "expected",
        "residuals",
        "stdres",
      ],
    ),
    ["htest"],
  );
}

function numericCounts(value: RValue, name: string): NumericVector {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    isFactor(value)
  ) {
    throw new RTypeMismatchError("NRT3423", `'${name}' must be a numeric vector or matrix`);
  }
  return value;
}

function finiteNonnegativeCounts(value: NumericVector): number[] {
  const output = new Array<number>(value.length);
  for (let index = 0; index < value.length; index += 1) {
    if (isMissing(value, index))
      throw new RTypeMismatchError("NRT3423", "all entries of 'x' must be nonnegative and finite");
    const item = Number(value.values[index] ?? 0);
    if (!Number.isFinite(item) || item < 0) {
      throw new RTypeMismatchError("NRT3423", "all entries of 'x' must be nonnegative and finite");
    }
    output[index] = item;
  }
  return output;
}

function finiteProbabilities(value: RValue): number[] {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    isFactor(value)
  ) {
    throw new RTypeMismatchError("NRT3423", "probabilities must be non-negative");
  }
  const output = new Array<number>(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const item = isMissing(value, index) ? Number.NaN : Number(value.values[index] ?? 0);
    if (!Number.isFinite(item) || item < 0) {
      throw new RTypeMismatchError("NRT3423", "probabilities must be non-negative");
    }
    output[index] = item;
  }
  return output;
}

function tableMargins(values: readonly number[], rows: number, columns: number) {
  const rowMargins = new Array<number>(rows).fill(0);
  const columnMargins = new Array<number>(columns).fill(0);
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const value = values[row + column * rows] ?? 0;
      rowMargins[row] = (rowMargins[row] ?? 0) + value;
      columnMargins[column] = (columnMargins[column] ?? 0) + value;
    }
  }
  return { rows: rowMargins, columns: columnMargins };
}

function subsetMatrix(
  value: NumericVector,
  rows: number,
  _columns: number,
  retainedRows: readonly number[],
  retainedColumns: readonly number[],
  invocation: BuiltinInvocation,
): NumericVector {
  const indices: number[] = [];
  for (const column of retainedColumns) {
    for (const row of retainedRows) indices.push(row + column * rows + 1);
  }
  let output: NumericVector = withDimensions(
    numericCounts(subsetVector(value, integerVector(indices), invocation.context), "x"),
    [retainedRows.length, retainedColumns.length],
  );
  const dimnames = value.attributes.get("dimnames");
  if (dimnames?.type === "list" && dimnames.values.length === 2) {
    const rowNames = dimnames.values[0];
    const columnNames = dimnames.values[1];
    if (rowNames?.type === "character" && columnNames?.type === "character") {
      output = withAttribute(
        output,
        "dimnames",
        listValue(
          [
            subsetVector(
              rowNames,
              integerVector(retainedRows.map((index) => index + 1)),
              invocation.context,
            ),
            subsetVector(
              columnNames,
              integerVector(retainedColumns.map((index) => index + 1)),
              invocation.context,
            ),
          ],
          vectorNames(dimnames),
        ),
      );
    }
  }
  return output;
}

function shapedDouble(
  values: readonly number[],
  template: NumericVector,
  preserveClass: boolean,
): RVector {
  let output: RVector = doubleVector(values);
  const names = vectorNames(template);
  if (names !== undefined) output = withNames(output, names);
  const dimensions = vectorDimensions(template);
  if (dimensions !== undefined) output = withDimensions(output, dimensions);
  const classes = template.attributes.get("class");
  if (preserveClass && classes !== undefined) output = withAttribute(output, "class", classes);
  else output = withoutAttribute(output, "class");
  const dimnames = template.attributes.get("dimnames");
  if (dimnames !== undefined) output = withAttribute(output, "dimnames", dimnames);
  return output;
}

function chiSquareUpperTail(statistic: number, degrees: number): number {
  if (statistic === Number.POSITIVE_INFINITY) return 0;
  return regularizedGammaProbability(statistic / 2, degrees / 2, false);
}

async function forceRequired(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in chisq.test().`);
  }
  return invocation.force(argument.promise);
}

async function scalarFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined || argument.promise.missing) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3423", `'${name}' must be a single non-missing logical value`);
  }
  return value.values[0] === 1;
}

function argumentLabel(argument: BuiltinCallArgument | undefined, fallback: string): string {
  return argument?.promise.expression === null || argument?.promise.expression === undefined
    ? fallback
    : deparseAst(argument.promise.expression);
}

function warnApproximation(invocation: BuiltinInvocation): void {
  const currentCall = invocation.currentCall();
  invocation.context.warn({
    code: "NRW1014",
    message: "Chi-squared approximation may be incorrect",
    ...(currentCall.type === "null"
      ? {}
      : { call: deparseSourceAst(languageValueAst(currentCall)) }),
  });
}
