export function evaluateCubicSpline(
  point: number,
  positions: readonly number[],
  values: readonly number[],
  secondDerivatives: Float64Array,
): number {
  if (values.length === 0) return Number.NaN;
  if (values.length === 1) return values[0]!;
  const left = splineInterval(point, positions);
  const start = positions[left] ?? 0;
  const end = positions[left + 1] ?? start;
  const width = end - start;
  if (width === 0) return values[left] ?? 0;
  const before = (end - point) / width;
  const after = (point - start) / width;
  return (
    before * (values[left] ?? 0) +
    after * (values[left + 1] ?? 0) +
    (((before ** 3 - before) * (secondDerivatives[left] ?? 0) +
      (after ** 3 - after) * (secondDerivatives[left + 1] ?? 0)) *
      width ** 2) /
      6
  );
}

export function evaluateCubicHermite(
  point: number,
  positions: readonly number[],
  values: readonly number[],
  tangents: Float64Array,
): number {
  if (values.length === 0) return Number.NaN;
  if (values.length === 1) return values[0]!;
  const left = splineInterval(point, positions);
  const start = positions[left] ?? 0;
  const end = positions[left + 1] ?? start;
  const width = end - start;
  if (width === 0) return values[left] ?? 0;
  const t = (point - start) / width;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * (values[left] ?? 0) +
    (t3 - 2 * t2 + t) * width * (tangents[left] ?? 0) +
    (-2 * t3 + 3 * t2) * (values[left + 1] ?? 0) +
    (t3 - t2) * width * (tangents[left + 1] ?? 0)
  );
}

export function evaluateCubicHermiteDerivative(
  point: number,
  positions: readonly number[],
  values: readonly number[],
  tangents: Float64Array,
  derivative: 0 | 1 | 2 | 3,
): number {
  if (derivative === 0) return evaluateCubicHermite(point, positions, values, tangents);
  if (values.length === 0) return Number.NaN;
  if (values.length === 1) return 0;
  const left = splineInterval(point, positions);
  const start = positions[left] ?? 0;
  const end = positions[left + 1] ?? start;
  const width = end - start;
  if (width === 0) return 0;
  const t = (point - start) / width;
  const y0 = values[left] ?? 0;
  const y1 = values[left + 1] ?? 0;
  const m0 = tangents[left] ?? 0;
  const m1 = tangents[left + 1] ?? 0;
  if (derivative === 1) {
    return (
      ((6 * t * t - 6 * t) * y0 + (-6 * t * t + 6 * t) * y1) / width +
      (3 * t * t - 4 * t + 1) * m0 +
      (3 * t * t - 2 * t) * m1
    );
  }
  if (derivative === 2) {
    return (
      ((12 * t - 6) * y0 + (-12 * t + 6) * y1) / (width * width) +
      ((6 * t - 4) * m0 + (6 * t - 2) * m1) / width
    );
  }
  return (12 * y0 - 12 * y1) / width ** 3 + (6 * m0 + 6 * m1) / width ** 2;
}

export function fmmSecondDerivatives(
  positions: readonly number[],
  values: readonly number[],
): Float64Array {
  const count = values.length;
  const result = new Float64Array(count);
  if (count <= 2) return result;
  if (count === 3) {
    const left = (positions[1] ?? 0) - (positions[0] ?? 0);
    const right = (positions[2] ?? 0) - (positions[1] ?? 0);
    const curvature =
      (2 *
        (((values[2] ?? 0) - (values[1] ?? 0)) / right -
          ((values[1] ?? 0) - (values[0] ?? 0)) / left)) /
      (left + right);
    result.fill(curvature);
    return result;
  }
  if (count === 4) return fourPointNotAKnotSecondDerivatives(positions, values);

  const lower = new Float64Array(count);
  const diagonal = new Float64Array(count);
  const upper = new Float64Array(count);
  const rhs = new Float64Array(count);
  const first = (positions[1] ?? 0) - (positions[0] ?? 0);
  diagonal[0] = -1;
  upper[0] = 1;
  rhs[0] = first * cubicThirdDerivative(positions, values, 0);
  for (let index = 1; index < count - 1; index += 1) {
    const before = (positions[index] ?? 0) - (positions[index - 1] ?? 0);
    const after = (positions[index + 1] ?? 0) - (positions[index] ?? 0);
    lower[index] = before;
    diagonal[index] = 2 * (before + after);
    upper[index] = after;
    rhs[index] =
      6 *
      (((values[index + 1] ?? 0) - (values[index] ?? 0)) / after -
        ((values[index] ?? 0) - (values[index - 1] ?? 0)) / before);
  }
  const last = (positions[count - 1] ?? 0) - (positions[count - 2] ?? 0);
  lower[count - 1] = -1;
  diagonal[count - 1] = 1;
  rhs[count - 1] = last * cubicThirdDerivative(positions, values, count - 4);
  return solveTridiagonal(lower, diagonal, upper, rhs);
}

export function naturalSecondDerivatives(
  positions: readonly number[],
  values: readonly number[],
): Float64Array {
  const count = values.length;
  const lower = new Float64Array(count);
  const diagonal = new Float64Array(count);
  const upper = new Float64Array(count);
  const rhs = new Float64Array(count);
  diagonal[0] = 1;
  if (count > 1) diagonal[count - 1] = 1;
  for (let index = 1; index < count - 1; index += 1) {
    const before = (positions[index] ?? 0) - (positions[index - 1] ?? 0);
    const after = (positions[index + 1] ?? 0) - (positions[index] ?? 0);
    lower[index] = before;
    diagonal[index] = 2 * (before + after);
    upper[index] = after;
    rhs[index] =
      6 *
      (((values[index + 1] ?? 0) - (values[index] ?? 0)) / after -
        ((values[index] ?? 0) - (values[index - 1] ?? 0)) / before);
  }
  return solveTridiagonal(lower, diagonal, upper, rhs);
}

export function periodicSecondDerivatives(
  positions: readonly number[],
  values: readonly number[],
): Float64Array {
  const count = values.length;
  const result = new Float64Array(count);
  if (count <= 2) return result;
  const uniqueCount = count - 1;
  if (uniqueCount === 1) return result;
  const interval = new Float64Array(uniqueCount);
  const slope = new Float64Array(uniqueCount);
  for (let index = 0; index < uniqueCount; index += 1) {
    interval[index] = (positions[index + 1] ?? 0) - (positions[index] ?? 0);
    slope[index] = ((values[index + 1] ?? 0) - (values[index] ?? 0)) / interval[index]!;
  }
  const matrix = Array.from({ length: uniqueCount }, () => new Float64Array(uniqueCount));
  const rhs = new Float64Array(uniqueCount);
  for (let index = 0; index < uniqueCount; index += 1) {
    const previous = (index + uniqueCount - 1) % uniqueCount;
    const next = (index + 1) % uniqueCount;
    matrix[index]![previous] = (matrix[index]![previous] ?? 0) + interval[previous]!;
    matrix[index]![index] =
      (matrix[index]![index] ?? 0) + 2 * (interval[previous]! + interval[index]!);
    matrix[index]![next] = (matrix[index]![next] ?? 0) + interval[index]!;
    rhs[index] = 6 * (slope[index]! - slope[previous]!);
  }
  const solved = solveDenseSystem(matrix, rhs);
  result.set(solved, 0);
  result[count - 1] = solved[0] ?? 0;
  return result;
}

export function splineTangentsFromSecondDerivatives(
  positions: readonly number[],
  values: readonly number[],
  secondDerivatives: Float64Array,
): Float64Array {
  const tangents = new Float64Array(values.length);
  if (values.length <= 1) return tangents;
  for (let index = 0; index < values.length - 1; index += 1) {
    const width = (positions[index + 1] ?? 0) - (positions[index] ?? 0);
    const slope = ((values[index + 1] ?? 0) - (values[index] ?? 0)) / width;
    tangents[index] =
      slope - (width * (2 * secondDerivatives[index]! + secondDerivatives[index + 1]!)) / 6;
  }
  const last = values.length - 1;
  const width = (positions[last] ?? 0) - (positions[last - 1] ?? 0);
  const slope = ((values[last] ?? 0) - (values[last - 1] ?? 0)) / width;
  tangents[last] =
    slope + (width * (secondDerivatives[last - 1]! + 2 * secondDerivatives[last]!)) / 6;
  return tangents;
}

export function hymanFilterTangents(
  positions: readonly number[],
  values: readonly number[],
  tangents: Float64Array,
): Float64Array {
  if (values.length <= 1) return tangents;
  const slopes = new Float64Array(values.length - 1);
  for (let index = 0; index < slopes.length; index += 1) {
    slopes[index] =
      ((values[index + 1] ?? 0) - (values[index] ?? 0)) /
      ((positions[index + 1] ?? 0) - (positions[index] ?? 0));
  }
  for (let index = 0; index < tangents.length; index += 1) {
    const before = slopes[Math.max(0, index - 1)] ?? 0;
    const after = slopes[Math.min(slopes.length - 1, index)] ?? 0;
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) {
      tangents[index] = 0;
      continue;
    }
    const bound = 3 * Math.min(Math.abs(before), Math.abs(after));
    tangents[index] = Math.sign(before) * Math.min(Math.abs(tangents[index]!), bound);
  }
  return tangents;
}

export function fritschCarlsonTangents(
  positions: readonly number[],
  values: readonly number[],
): Float64Array {
  const count = values.length;
  const tangents = new Float64Array(count);
  if (count <= 1) return tangents;
  const slopes = new Float64Array(count - 1);
  for (let index = 0; index < slopes.length; index += 1) {
    slopes[index] =
      ((values[index + 1] ?? 0) - (values[index] ?? 0)) /
      ((positions[index + 1] ?? 0) - (positions[index] ?? 0));
  }
  tangents[0] = slopes[0] ?? 0;
  tangents[count - 1] = slopes[count - 2] ?? 0;
  for (let index = 1; index < count - 1; index += 1) {
    tangents[index] = ((slopes[index - 1] ?? 0) + (slopes[index] ?? 0)) / 2;
  }
  for (let index = 0; index < slopes.length; index += 1) {
    const slope = slopes[index] ?? 0;
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const left = tangents[index]! / slope;
    const right = tangents[index + 1]! / slope;
    const magnitude = Math.hypot(left, right);
    if (magnitude <= 3) continue;
    const scale = 3 / magnitude;
    tangents[index] = scale * left * slope;
    tangents[index + 1] = scale * right * slope;
  }
  return tangents;
}

function splineInterval(point: number, positions: readonly number[]): number {
  if (point <= (positions[0] ?? 0)) return 0;
  const last = positions.length - 1;
  if (point >= (positions[last] ?? 0)) return Math.max(0, last - 1);
  let low = 0;
  let high = last;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (point > (positions[middle] ?? 0)) low = middle;
    else high = middle;
  }
  return low;
}

function solveTridiagonal(
  lower: Float64Array,
  diagonal: Float64Array,
  upper: Float64Array,
  rhs: Float64Array,
): Float64Array {
  const count = diagonal.length;
  for (let index = 1; index < count; index += 1) {
    const factor = lower[index]! / diagonal[index - 1]!;
    diagonal[index] = diagonal[index]! - factor * upper[index - 1]!;
    rhs[index] = rhs[index]! - factor * rhs[index - 1]!;
  }
  const result = new Float64Array(count);
  if (count === 0) return result;
  result[count - 1] = rhs[count - 1]! / diagonal[count - 1]!;
  for (let index = count - 2; index >= 0; index -= 1) {
    result[index] = (rhs[index]! - upper[index]! * result[index + 1]!) / diagonal[index]!;
  }
  return result;
}

function cubicThirdDerivative(
  positions: readonly number[],
  values: readonly number[],
  start: number,
): number {
  const x0 = positions[start]!;
  const x1 = positions[start + 1]!;
  const x2 = positions[start + 2]!;
  const x3 = positions[start + 3]!;
  const first0 = (values[start + 1]! - values[start]!) / (x1 - x0);
  const first1 = (values[start + 2]! - values[start + 1]!) / (x2 - x1);
  const first2 = (values[start + 3]! - values[start + 2]!) / (x3 - x2);
  const second0 = (first1 - first0) / (x2 - x0);
  const second1 = (first2 - first1) / (x3 - x1);
  return (6 * (second1 - second0)) / (x3 - x0);
}

function fourPointNotAKnotSecondDerivatives(
  positions: readonly number[],
  values: readonly number[],
): Float64Array {
  const count = 4;
  const result = new Float64Array(count);
  const lower2 = new Float64Array(count);
  const lower1 = new Float64Array(count);
  const diagonal = new Float64Array(count);
  const upper1 = new Float64Array(count);
  const upper2 = new Float64Array(count);
  const rhs = new Float64Array(count);
  const first = positions[1]! - positions[0]!;
  const second = positions[2]! - positions[1]!;
  diagonal[0] = -second;
  upper1[0] = first + second;
  upper2[0] = -first;
  for (let index = 1; index < count - 1; index += 1) {
    const before = positions[index]! - positions[index - 1]!;
    const after = positions[index + 1]! - positions[index]!;
    lower1[index] = before;
    diagonal[index] = 2 * (before + after);
    upper1[index] = after;
    rhs[index] =
      6 *
      ((values[index + 1]! - values[index]!) / after -
        (values[index]! - values[index - 1]!) / before);
  }
  const penultimate = positions[2]! - positions[1]!;
  const last = positions[3]! - positions[2]!;
  lower2[3] = -last;
  lower1[3] = penultimate + last;
  diagonal[3] = -penultimate;
  for (let pivot = 0; pivot < count; pivot += 1) {
    if (pivot + 1 < count) {
      const factor = lower1[pivot + 1]! / diagonal[pivot]!;
      diagonal[pivot + 1] = diagonal[pivot + 1]! - factor * upper1[pivot]!;
      upper1[pivot + 1] = upper1[pivot + 1]! - factor * upper2[pivot]!;
      rhs[pivot + 1] = rhs[pivot + 1]! - factor * rhs[pivot]!;
    }
    if (pivot + 2 < count) {
      const factor = lower2[pivot + 2]! / diagonal[pivot]!;
      lower1[pivot + 2] = lower1[pivot + 2]! - factor * upper1[pivot]!;
      diagonal[pivot + 2] = diagonal[pivot + 2]! - factor * upper2[pivot]!;
      rhs[pivot + 2] = rhs[pivot + 2]! - factor * rhs[pivot]!;
    }
  }
  for (let index = count - 1; index >= 0; index -= 1) {
    result[index] =
      (rhs[index]! -
        upper1[index]! * (result[index + 1] ?? 0) -
        upper2[index]! * (result[index + 2] ?? 0)) /
      diagonal[index]!;
  }
  return result;
}

function solveDenseSystem(matrix: Float64Array[], rhs: Float64Array): Float64Array {
  const count = rhs.length;
  for (let pivot = 0; pivot < count; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < count; row += 1) {
      if (Math.abs(matrix[row]![pivot]!) > Math.abs(matrix[best]![pivot]!)) best = row;
    }
    if (best !== pivot) {
      [matrix[pivot], matrix[best]] = [matrix[best]!, matrix[pivot]!];
      [rhs[pivot], rhs[best]] = [rhs[best]!, rhs[pivot]!];
    }
    for (let row = pivot + 1; row < count; row += 1) {
      const factor = matrix[row]![pivot]! / matrix[pivot]![pivot]!;
      for (let column = pivot; column < count; column += 1) {
        matrix[row]![column] = matrix[row]![column]! - factor * matrix[pivot]![column]!;
      }
      rhs[row] = rhs[row]! - factor * rhs[pivot]!;
    }
  }
  const result = new Float64Array(count);
  for (let row = count - 1; row >= 0; row -= 1) {
    let value = rhs[row]!;
    for (let column = row + 1; column < count; column += 1) {
      value -= matrix[row]![column]! * result[column]!;
    }
    result[row] = value / matrix[row]![row]!;
  }
  return result;
}
