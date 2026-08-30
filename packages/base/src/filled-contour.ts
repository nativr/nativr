import type { RGraphicsPolygon } from "@nativr/runtime";

export interface FilledContourGrid {
  readonly rows: number;
  readonly columns: number;
  readonly x: readonly number[];
  readonly y: readonly number[];
  /** Column-major scalar values; undefined values make the containing cell unavailable. */
  readonly z: readonly (number | undefined)[];
}

export interface FilledContourBand {
  readonly levelIndex: number;
  /** Rings are separated by NaN so an even-odd device path can preserve holes. */
  readonly x: readonly number[];
  readonly y: readonly number[];
}

export interface FilledContourPanelLayout {
  readonly mainViewport: readonly [number, number, number, number];
  readonly keyViewport: readonly [number, number, number, number];
  readonly mainFigure: readonly [number, number, number, number];
  readonly keyFigure: readonly [number, number, number, number];
  readonly mainPlot: readonly [number, number, number, number];
  readonly keyPlot: readonly [number, number, number, number];
  readonly mainMargins: readonly [number, number, number, number];
  readonly keyMargins: readonly [number, number, number, number];
  readonly mainPin: readonly [number, number];
  readonly keyPin: readonly [number, number];
}

export function v(levels: readonly number[]): boolean {
  return (
    levels.length >= 2 &&
    levels.every(Number.isFinite) &&
    levels.every((level, index) => index === 0 || level > levels[index - 1]!)
  );
}

export function c(count: number, palette: readonly string[]): readonly string[] {
  return Array.from(
    { length: count },
    (_, index) =>
      palette[
        count <= 1
          ? Math.floor((palette.length - 1) / 2)
          : Math.round((index / (count - 1)) * (palette.length - 1))
      ] ?? "#000000",
  );
}

export function l(
  dimensions: readonly number[],
  margins: readonly number[],
  csi: number,
): FilledContourPanelLayout {
  const width = Math.max(dimensions[0] ?? 7, csi * 10);
  const height = Math.max(dimensions[1] ?? 7, csi * 10);
  const bottomMargin = (margins[0] ?? 5.1) * csi;
  const leftMargin = (margins[1] ?? 4.1) * csi;
  const topMargin = (margins[2] ?? 4.1) * csi;
  const keyFigureWidth = Math.min(width * 0.4, (3 + (margins[1] ?? 4.1)) * csi);
  const mainFigureWidth = width - keyFigureWidth;
  const plotBottom = Math.min(0.49, bottomMargin / height);
  const plotTop = Math.max(plotBottom + 0.01, 1 - topMargin / height);
  const mainLeft = Math.min(0.49, leftMargin / width);
  const mainRight = Math.max(mainLeft + 0.01, (mainFigureWidth - csi) / width);
  const keyLeft = Math.min(0.98, (mainFigureWidth + csi) / width);
  const keyRight = Math.max(keyLeft + 0.01, (width - leftMargin) / width);
  return {
    mainViewport: [mainLeft, mainRight, plotBottom, plotTop],
    keyViewport: [keyLeft, Math.min(1, keyRight), plotBottom, plotTop],
    mainFigure: [0, mainFigureWidth / width, 0, 1],
    keyFigure: [mainFigureWidth / width, 1, 0, 1],
    mainPlot: [
      leftMargin / mainFigureWidth,
      (mainFigureWidth - csi) / mainFigureWidth,
      plotBottom,
      plotTop,
    ],
    keyPlot: [
      csi / keyFigureWidth,
      (keyFigureWidth - leftMargin) / keyFigureWidth,
      plotBottom,
      plotTop,
    ],
    mainMargins: [margins[0] ?? 5.1, margins[1] ?? 4.1, margins[2] ?? 4.1, 1],
    keyMargins: [margins[0] ?? 5.1, 1, margins[2] ?? 4.1, margins[1] ?? 4.1],
    mainPin: [
      Math.max(csi, mainFigureWidth - leftMargin - csi),
      Math.max(csi, height - bottomMargin - topMargin),
    ],
    keyPin: [
      Math.max(csi, keyFigureWidth - csi - leftMargin),
      Math.max(csi, height - bottomMargin - topMargin),
    ],
  };
}

export function d(
  grid: FilledContourGrid,
  levels: readonly number[],
  zlim: readonly [number, number],
  colors: readonly string[],
  keyBorders: readonly string[],
): { readonly key: readonly RGraphicsPolygon[]; readonly main: readonly RGraphicsPolygon[] } {
  const key = levels.slice(0, -1).flatMap((lower, index) => {
    const bottom = Math.max(Math.min(...zlim), lower);
    const top = Math.min(Math.max(...zlim), levels[index + 1]!);
    return top <= bottom
      ? []
      : [
          {
            x: [0, 1, 1, 0],
            y: [bottom, bottom, top, top],
            fill: colors[index % colors.length]!,
            border: keyBorders.length === 0 ? "#FFFFFF00" : keyBorders[index % keyBorders.length]!,
            lineType: keyBorders.length === 0 ? ("blank" as const) : ("solid" as const),
            lineWidth: 1,
            fillRule: "nonzero" as const,
          },
        ];
  });
  const main = filledContourBands(grid, levels).map((band) => ({
    x: band.x,
    y: band.y,
    fill: colors[band.levelIndex % colors.length]!,
    border: "#FFFFFF00",
    lineType: "blank" as const,
    lineWidth: 0.01,
    fillRule: "evenodd" as const,
  }));
  return { key, main };
}

export function p(
  layout: FilledContourPanelLayout,
  key: boolean,
): readonly (readonly [string, readonly number[], boolean])[] {
  const column = key ? 2 : 1;
  return [
    ["fig", key ? layout.keyFigure : layout.mainFigure, false],
    ["plt", key ? layout.keyPlot : layout.mainPlot, false],
    ["mar", key ? layout.keyMargins : layout.mainMargins, false],
    ["pin", key ? layout.keyPin : layout.mainPin, false],
    ["mfrow", [1, 2], true],
    ["mfcol", [1, 2], true],
    ["mfg", [1, column, 1, 2], true],
  ];
}

interface ScalarPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface BoundaryEdge {
  readonly start: ScalarPoint;
  readonly end: ScalarPoint;
  readonly startKey: string;
  readonly endKey: string;
}

/**
 * Construct piecewise-linear filled-contour bands on a regular rectangular topology.
 * Every cell uses the lower-left to upper-right diagonal, matching the measured GNU R 4.6.1
 * saddle convention. Interior triangle edges are cancelled before rings are emitted, keeping the
 * graphics journal proportional to contour boundaries instead of grid area.
 */
export function filledContourBands(
  grid: FilledContourGrid,
  levels: readonly number[],
): readonly FilledContourBand[] {
  const boundaries = Array.from(
    { length: Math.max(0, levels.length - 1) },
    () => new Map<string, BoundaryEdge>(),
  );
  const offset = (row: number, column: number): number => row + grid.rows * column;

  for (let column = 0; column < grid.columns - 1; column += 1) {
    for (let row = 0; row < grid.rows - 1; row += 1) {
      const bottomLeft = scalarPoint(grid, row, column, offset(row, column));
      const bottomRight = scalarPoint(grid, row + 1, column, offset(row + 1, column));
      const topRight = scalarPoint(grid, row + 1, column + 1, offset(row + 1, column + 1));
      const topLeft = scalarPoint(grid, row, column + 1, offset(row, column + 1));
      if (
        bottomLeft === undefined ||
        bottomRight === undefined ||
        topRight === undefined ||
        topLeft === undefined
      ) {
        continue;
      }
      const triangles = [
        [bottomLeft, bottomRight, topRight],
        [bottomLeft, topRight, topLeft],
      ] as const;
      const cellMinimum = Math.min(bottomLeft.z, bottomRight.z, topRight.z, topLeft.z);
      const cellMaximum = Math.max(bottomLeft.z, bottomRight.z, topRight.z, topLeft.z);
      for (let levelIndex = 0; levelIndex < boundaries.length; levelIndex += 1) {
        const lower = levels[levelIndex]!;
        const upper = levels[levelIndex + 1]!;
        if (upper < cellMinimum || lower > cellMaximum) continue;
        for (const triangle of triangles) {
          const clipped = clipScalarPolygon(clipScalarPolygon(triangle, lower, true), upper, false);
          if (clipped.length >= 3) addBoundaryPolygon(boundaries[levelIndex]!, clipped);
        }
      }
    }
  }

  return boundaries.flatMap((edges, levelIndex) => {
    const rings = joinBoundaryRings(edges);
    if (rings.length === 0) return [];
    const x: number[] = [];
    const y: number[] = [];
    for (const [ringIndex, ring] of rings.entries()) {
      if (ringIndex > 0) {
        x.push(Number.NaN);
        y.push(Number.NaN);
      }
      for (const point of ring) {
        x.push(point.x);
        y.push(point.y);
      }
    }
    return [{ levelIndex, x, y }];
  });
}

function scalarPoint(
  grid: FilledContourGrid,
  row: number,
  column: number,
  index: number,
): ScalarPoint | undefined {
  const z = grid.z[index];
  const x = grid.x[row];
  const y = grid.y[column];
  return z === undefined || x === undefined || y === undefined || !Number.isFinite(z)
    ? undefined
    : { x, y, z };
}

function clipScalarPolygon(
  source: readonly ScalarPoint[],
  threshold: number,
  keepAbove: boolean,
): readonly ScalarPoint[] {
  if (source.length === 0) return source;
  const output: ScalarPoint[] = [];
  let previous = source[source.length - 1]!;
  let previousInside = keepAbove ? previous.z >= threshold : previous.z <= threshold;
  for (const current of source) {
    const currentInside = keepAbove ? current.z >= threshold : current.z <= threshold;
    if (currentInside !== previousInside) {
      const fraction = (threshold - previous.z) / (current.z - previous.z);
      output.push({
        x: previous.x + (current.x - previous.x) * fraction,
        y: previous.y + (current.y - previous.y) * fraction,
        z: threshold,
      });
    }
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
}

function coordinateKey(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toPrecision(15);
}

function pointKey(point: ScalarPoint): string {
  return `${coordinateKey(point.x)},${coordinateKey(point.y)}`;
}

function addBoundaryPolygon(
  edges: Map<string, BoundaryEdge>,
  points: readonly ScalarPoint[],
): void {
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    const startKey = pointKey(start);
    const endKey = pointKey(end);
    if (startKey === endKey) continue;
    const key = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
    if (edges.has(key)) edges.delete(key);
    else edges.set(key, { start, end, startKey, endKey });
  }
}

function joinBoundaryRings(edges: ReadonlyMap<string, BoundaryEdge>): readonly ScalarPoint[][] {
  const outgoing = new Map<string, BoundaryEdge[]>();
  for (const edge of edges.values()) {
    const candidates = outgoing.get(edge.startKey);
    if (candidates === undefined) outgoing.set(edge.startKey, [edge]);
    else candidates.push(edge);
  }
  const unused = new Set(edges.values());
  const rings: ScalarPoint[][] = [];
  while (unused.size > 0) {
    const first = unused.values().next().value as BoundaryEdge;
    const ring: ScalarPoint[] = [];
    let edge: BoundaryEdge | undefined = first;
    while (edge !== undefined && unused.delete(edge)) {
      ring.push(edge.start);
      if (edge.endKey === first.startKey) break;
      edge = outgoing.get(edge.endKey)?.find((candidate) => unused.has(candidate));
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}
export const e = Object.freeze({
  levels: "invalid contour levels: must be strictly increasing",
  palette: "'color.palette' must be a function",
  colors: "'col' must specify at least one colour",
  unnamed: "unnamed graphical arguments are not supported",
  finite: "no finite or non-missing values in 'z'",
  axes: "filled.contour(axes=)",
  frame: "filled.contour(frame.plot=)",
});
