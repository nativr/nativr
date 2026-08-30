import type { BuiltinInvocation } from "@nativr/runtime";

import { nextRandom, type RandomState } from "./random.js";

/**
 * Draw one contingency table from the fixed-margin conditional distribution.
 *
 * This is an independently written implementation of the mode-centred inversion described by
 * Patefield's published Algorithm AS 159. Each non-terminal cell consumes one uniform variate;
 * terminal row/column cells are fixed by the remaining margins.
 */
export function sampleFixedMarginTable(
  rowMargins: readonly number[],
  columnMargins: readonly number[],
  random: RandomState,
  invocation: BuiltinInvocation,
): number[] {
  const rows = rowMargins.length;
  const columns = columnMargins.length;
  const total = rowMargins.reduce((sum, value) => sum + value, 0);
  const logFactorials = new Float64Array(total + 1);
  for (let value = 1; value <= total; value += 1) {
    if ((value & 255) === 0) invocation.context.checkpoint();
    logFactorials[value] = (logFactorials[value - 1] ?? 0) + Math.log(value);
  }

  const table = new Array<number>(rows * columns).fill(0);
  const remainingColumns = [...columnMargins];
  let remainingTotal = total;

  for (let row = 0; row < rows - 1; row += 1) {
    let remainingRow = rowMargins[row] ?? 0;
    let remainingAcrossColumns = remainingTotal;
    remainingTotal -= remainingRow;

    for (let column = 0; column < columns - 1; column += 1) {
      invocation.context.checkpoint();
      const columnTotal = remainingColumns[column] ?? 0;
      const population = remainingAcrossColumns;
      remainingAcrossColumns -= columnTotal;
      const outsideRow = population - remainingRow;
      const outsideBoth = outsideRow - columnTotal;
      const cell = sampleConditionalCell(
        remainingRow,
        columnTotal,
        population,
        outsideRow,
        remainingAcrossColumns,
        outsideBoth,
        logFactorials,
        random,
      );
      table[row + column * rows] = cell;
      remainingRow -= cell;
      remainingColumns[column] = columnTotal - cell;
    }
    table[row + (columns - 1) * rows] = remainingRow;
  }

  const finalRow = rows - 1;
  let finalRemainder = rowMargins[finalRow] ?? 0;
  for (let column = 0; column < columns - 1; column += 1) {
    const cell = remainingColumns[column] ?? 0;
    table[finalRow + column * rows] = cell;
    finalRemainder -= cell;
  }
  table[finalRow + (columns - 1) * rows] = finalRemainder;
  return table;
}

function sampleConditionalCell(
  rowTotal: number,
  columnTotal: number,
  population: number,
  outsideRow: number,
  outsideColumn: number,
  outsideBoth: number,
  logFactorials: Float64Array,
  random: RandomState,
): number {
  if (population === 0 || rowTotal === 0 || columnTotal === 0) return 0;

  let threshold = nextRandom(random);
  while (true) {
    const candidate = Math.floor((rowTotal * columnTotal) / population + 0.5);
    const modeProbability = Math.exp(
      factorialLog(logFactorials, rowTotal) +
        factorialLog(logFactorials, outsideRow) +
        factorialLog(logFactorials, outsideColumn) +
        factorialLog(logFactorials, columnTotal) -
        factorialLog(logFactorials, population) -
        factorialLog(logFactorials, candidate) -
        factorialLog(logFactorials, columnTotal - candidate) -
        factorialLog(logFactorials, rowTotal - candidate) -
        factorialLog(logFactorials, outsideBoth + candidate),
    );
    if (threshold <= modeProbability) return candidate;

    let cumulative = modeProbability;
    let upperProbability = modeProbability;
    let lowerProbability = modeProbability;
    let upper = candidate;
    let lower = candidate;
    let upperExhausted = false;
    let lowerExhausted = false;

    while (!upperExhausted || !lowerExhausted) {
      if (!upperExhausted) {
        const numerator = (columnTotal - upper) * (rowTotal - upper);
        if (numerator === 0) {
          upperExhausted = true;
        } else {
          upper += 1;
          upperProbability *= numerator / (upper * (outsideBoth + upper));
          cumulative += upperProbability;
          if (threshold <= cumulative) return upper;
        }
      }

      if (!lowerExhausted) {
        const numerator = lower * (outsideBoth + lower);
        if (numerator === 0) {
          lowerExhausted = true;
        } else {
          lower -= 1;
          lowerProbability *= numerator / ((columnTotal - lower) * (rowTotal - lower));
          cumulative += lowerProbability;
          if (threshold <= cumulative) return lower;
        }
      }
    }

    // Rounding can leave the accumulated mass infinitesimally below one. Rescale a fresh uniform
    // into the represented mass, as AS 159 prescribes, instead of biasing either boundary.
    threshold = cumulative * nextRandom(random);
  }
}

function factorialLog(values: Float64Array, value: number): number {
  return values[value] ?? Number.NaN;
}
