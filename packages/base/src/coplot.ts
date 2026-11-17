export function numericRange(values: readonly number[]): readonly [number, number] | undefined {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return undefined;
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  return minimum === maximum ? [minimum - 0.5, maximum + 0.5] : [minimum, maximum];
}

export function numericIntervals(
  values: readonly number[],
  number: number,
  overlap: number,
): readonly (readonly [number, number])[] {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return [];
  const width = Math.max(1, Math.ceil(sorted.length / (number - (number - 1) * overlap)));
  const step = number === 1 ? 0 : Math.max(0, (sorted.length - width) / (number - 1));
  return Array.from({ length: number }, (_, panel) => {
    const start = Math.min(sorted.length - 1, Math.floor(panel * step));
    const end = Math.min(sorted.length - 1, Math.ceil(start + width - 1));
    const first = sorted[start] ?? 0;
    const last = sorted[end] ?? first;
    const previous =
      start > 0 ? (sorted[start - 1] ?? first) : first - ((sorted[start + 1] ?? first + 1) - first);
    const next =
      end + 1 < sorted.length
        ? (sorted[end + 1] ?? last)
        : last + (last - (sorted[end - 1] ?? last - 1));
    return [(previous + first) / 2, (last + next) / 2] as const;
  });
}

export function panelEvents(options: {
  readonly response: readonly number[];
  readonly predictor: readonly number[];
  readonly given: readonly number[];
  readonly intervals: readonly (readonly [number, number])[];
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number];
  readonly rows: number;
  readonly columns: number;
  readonly showGiven: boolean;
  readonly givenName: string;
  readonly symbols: readonly (number | string | undefined)[];
  readonly colors: readonly (string | undefined)[];
  readonly fills: readonly (string | undefined)[];
  readonly checkpoint: () => void;
}): {
  readonly borders: readonly RGraphicsSegment[];
  readonly points: readonly RGraphicsPoint[];
  readonly labels: readonly RGraphicsText[];
} {
  const borders: RGraphicsSegment[] = [];
  const points: RGraphicsPoint[] = [];
  const labels: RGraphicsText[] = [];
  for (let panel = 0; panel < options.intervals.length; panel += 1) {
    const interval = options.intervals[panel];
    if (interval === undefined) continue;
    const left = panel % options.columns;
    const right = left + 1;
    const bottom = options.rows - Math.floor(panel / options.columns) - 1;
    const top = bottom + 1;
    borders.push(
      border(left, bottom, right, bottom),
      border(right, bottom, right, top),
      border(right, top, left, top),
      border(left, top, left, bottom),
    );
    for (let index = 0; index < options.response.length; index += 1) {
      options.checkpoint();
      const condition = options.given[index] ?? Number.NaN;
      const x = options.predictor[index] ?? Number.NaN;
      const y = options.response[index] ?? Number.NaN;
      if (
        !Number.isFinite(condition) ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        condition < interval[0] ||
        condition > interval[1]
      ) {
        continue;
      }
      const symbol = options.symbols[index % options.symbols.length];
      const color = options.colors[index % options.colors.length];
      const fill = options.fills[index % options.fills.length];
      if (symbol === undefined || color === undefined || fill === undefined) continue;
      points.push({
        x: coordinate(x, options.xRange, left, right),
        y: coordinate(y, options.yRange, bottom, top),
        symbol,
        color,
        fill,
        size: 1,
        lineWidth: 1,
      });
    }
    if (options.showGiven) {
      labels.push({
        x: left + 0.5,
        y: top,
        label: `${options.givenName}: ${labelNumber(interval[0])}–${labelNumber(interval[1])}`,
        color: "#000000FF",
        size: 0.8,
        font: 1,
        family: "",
        rotation: 0,
        horizontalAdjustment: 0.5,
        verticalAdjustment: 1,
        offset: 0.5,
      });
    }
  }
  return { borders, points, labels };
}

function coordinate(
  value: number,
  range: readonly [number, number],
  minimum: number,
  maximum: number,
): number {
  return minimum + 0.08 + ((value - range[0]) / (range[1] - range[0])) * (maximum - minimum - 0.16);
}

function border(x0: number, y0: number, x1: number, y1: number): RGraphicsSegment {
  return { x0, y0, x1, y1, color: "#000000FF", lineType: "solid", lineWidth: 1 };
}

function labelNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(6)));
}
import type { RGraphicsPoint, RGraphicsSegment, RGraphicsText } from "@nativr/runtime";
