import type {
  RGraphicsBoxplotGroup,
  RGraphicsEvent,
  RGraphicsLegendPosition,
  RGraphicsPoint,
  RGraphicsPolygon,
  RGraphicsText,
} from "@nativr/runtime";
import { pointVertices } from "./graphics-device-utils.js";

export interface VectorGraphicsOptions {
  readonly region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly pointsize: number;
  readonly checkpoint: () => void;
}

interface VectorWindow {
  readonly xlim: readonly [number, number];
  readonly ylim: readonly [number, number];
  readonly viewport?: readonly [number, number, number, number];
}

/** Shared device-independent geometry for the owned PDF and PostScript encoders. */
export abstract class VectorGraphicsCanvas {
  #window: VectorWindow = { xlim: [0, 1], ylim: [0, 1] };

  protected constructor(protected readonly vectorOptions: VectorGraphicsOptions) {}

  public render(events: readonly RGraphicsEvent[]): void {
    for (const event of events) {
      this.vectorOptions.checkpoint();
      switch (event.kind) {
        case "new-page":
          break;
        case "window":
          this.#window = event;
          break;
        case "segments":
          for (const segment of event.segments) {
            this.line(
              this.x(segment.x0),
              this.y(segment.y0),
              this.x(segment.x1),
              this.y(segment.y1),
              segment.color,
              segment.lineWidth,
              segment.lineType,
              segment.lineCap,
            );
          }
          break;
        case "points":
          for (const point of event.points) this.point(point);
          break;
        case "text":
          for (const label of event.labels) this.text(label);
          break;
        case "polygon":
          for (const polygon of event.polygons) this.polygon(polygon);
          break;
        case "raster":
          this.raster(event);
          break;
        case "box":
          this.box(event);
          break;
        case "boxplot":
          for (const group of event.groups) this.boxplot(event.horizontal, event.notch, group);
          break;
        case "legend":
          this.legend(event);
          break;
      }
    }
  }

  protected x(value: number): number {
    const { region } = this.vectorOptions;
    const viewport = this.#window.viewport ?? [0, 1, 0, 1];
    return (
      region.x +
      (viewport[0] +
        ((value - this.#window.xlim[0]) / (this.#window.xlim[1] - this.#window.xlim[0])) *
          (viewport[1] - viewport[0])) *
        region.width
    );
  }

  protected y(value: number): number {
    const { region } = this.vectorOptions;
    const viewport = this.#window.viewport ?? [0, 1, 0, 1];
    return (
      region.y +
      (viewport[2] +
        ((value - this.#window.ylim[0]) / (this.#window.ylim[1] - this.#window.ylim[0])) *
          (viewport[3] - viewport[2])) *
        region.height
    );
  }

  protected abstract line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    colourSource: string,
    width: number,
    lineType: string,
    lineCap?: "round" | "butt" | "square",
  ): void;

  protected abstract path(
    points: readonly (readonly [number, number])[],
    fillSource: string,
    borderSource: string,
    width: number,
    lineType: string,
    fillRule?: "nonzero" | "evenodd",
  ): void;

  protected abstract circle(
    x: number,
    y: number,
    radius: number,
    fillSource: string,
    borderSource: string,
    width: number,
  ): void;

  protected abstract drawText(
    x: number,
    y: number,
    label: string,
    colourSource: string,
    scale: number,
    font: 1 | 2 | 3 | 4,
    rotation: number,
    horizontalAdjustment: number,
    verticalAdjustment: number,
  ): void;

  protected abstract polygon(polygon: RGraphicsPolygon): void;
  protected abstract raster(event: Extract<RGraphicsEvent, { readonly kind: "raster" }>): void;

  private point(point: RGraphicsPoint): void {
    const x = this.x(point.x);
    const y = this.y(point.y);
    const radius = Math.max(1, 3 * point.size * (this.vectorOptions.pointsize / 12));
    if (typeof point.symbol === "string") {
      this.drawText(x, y, point.symbol, point.color, point.size, 1, 0, 0.5, 0.5);
      return;
    }
    const symbol = point.symbol;
    const filled = symbol >= 15;
    if ([1, 10, 13, 16, 19, 20, 21].includes(symbol)) {
      this.circle(
        x,
        y,
        radius,
        filled ? (symbol >= 21 ? point.fill : point.color) : "#00000000",
        point.color,
        point.lineWidth,
      );
      return;
    }
    if ([3, 8, 9, 10, 12].includes(symbol)) {
      this.line(x - radius, y, x + radius, y, point.color, point.lineWidth, "solid");
      this.line(x, y - radius, x, y + radius, point.color, point.lineWidth, "solid");
    }
    if ([4, 7, 8, 13].includes(symbol)) {
      this.line(
        x - radius,
        y - radius,
        x + radius,
        y + radius,
        point.color,
        point.lineWidth,
        "solid",
      );
      this.line(
        x - radius,
        y + radius,
        x + radius,
        y - radius,
        point.color,
        point.lineWidth,
        "solid",
      );
    }
    if ([3, 4, 8].includes(symbol)) return;
    this.path(
      pointVertices(symbol, x, y, radius),
      filled ? (symbol >= 21 ? point.fill : point.color) : "#00000000",
      point.color,
      point.lineWidth,
      "solid",
    );
  }

  private text(label: RGraphicsText): void {
    let x = this.x(label.x);
    let y = this.y(label.y);
    const size = Math.max(0.1, this.vectorOptions.pointsize * label.size);
    const width = label.label.length * size * 0.52;
    if (label.position === 1) y -= size * label.offset;
    else if (label.position === 2) x -= width + size * label.offset;
    else if (label.position === 3) y += size * label.offset;
    else if (label.position === 4) x += size * label.offset;
    this.drawText(
      x,
      y,
      label.label,
      label.color,
      label.size,
      label.font,
      label.rotation,
      label.horizontalAdjustment,
      label.verticalAdjustment,
    );
  }

  private box(event: Extract<RGraphicsEvent, { readonly kind: "box" }>): void {
    const { region } = this.vectorOptions;
    const viewport = this.#window.viewport ?? [0, 1, 0, 1];
    const left = region.x + viewport[0] * region.width;
    const right = region.x + viewport[1] * region.width;
    const bottom = region.y + viewport[2] * region.height;
    const top = region.y + viewport[3] * region.height;
    const edges = {
      top: [left, top, right, top],
      right: [right, top, right, bottom],
      bottom: [right, bottom, left, bottom],
      left: [left, bottom, left, top],
    } as const;
    for (const edge of event.edges) {
      const line = edges[edge];
      this.line(line[0], line[1], line[2], line[3], event.color, event.lineWidth, event.lineType);
    }
  }

  private boxplot(horizontal: boolean, notch: boolean, group: RGraphicsBoxplotGroup): void {
    const [minimum, lower, median, upper, maximum] = group.stats;
    const [lowerConfidence, upperConfidence] = group.confidence;
    const half = group.width / 2;
    const inner = half / 2;
    const point = (category: number, value: number): readonly [number, number] =>
      horizontal ? [this.x(value), this.y(category)] : [this.x(category), this.y(value)];
    const body = notch
      ? [
          point(group.center - half, lower),
          point(group.center - half, lowerConfidence),
          point(group.center - inner, median),
          point(group.center - half, upperConfidence),
          point(group.center - half, upper),
          point(group.center + half, upper),
          point(group.center + half, upperConfidence),
          point(group.center + inner, median),
          point(group.center + half, lowerConfidence),
          point(group.center + half, lower),
        ]
      : [
          point(group.center - half, lower),
          point(group.center - half, upper),
          point(group.center + half, upper),
          point(group.center + half, lower),
        ];
    this.path(body, group.fill, group.border, group.lineWidth, group.lineType);
    const line = (first: readonly [number, number], second: readonly [number, number]): void =>
      this.line(
        first[0],
        first[1],
        second[0],
        second[1],
        group.border,
        group.lineWidth,
        group.lineType,
      );
    line(point(group.center, minimum), point(group.center, lower));
    line(point(group.center, upper), point(group.center, maximum));
    line(point(group.center - inner, minimum), point(group.center + inner, minimum));
    line(point(group.center - inner, maximum), point(group.center + inner, maximum));
    line(
      point(group.center - (notch ? inner : half), median),
      point(group.center + (notch ? inner : half), median),
    );
    for (const outlier of group.outliers) {
      const [x, y] = point(group.center, outlier);
      this.circle(
        x,
        y,
        Math.max(2.5, group.lineWidth * 1.5),
        "#00000000",
        group.border,
        group.lineWidth,
      );
    }
  }

  private legend(event: Extract<RGraphicsEvent, { readonly kind: "legend" }>): void {
    const rowHeight = this.vectorOptions.pointsize * event.cex * 1.3;
    const columnWidth = this.vectorOptions.pointsize * event.cex * 8;
    const rows = Math.ceil(
      (event.entries.length + (event.title === undefined ? 0 : 1)) / event.columns,
    );
    const width = columnWidth * event.columns;
    const height = rowHeight * rows;
    const [left, top] = this.legendTopLeft(event.position, width, height);
    if (event.background !== "#00000000") {
      this.path(
        [
          [left, top - height],
          [left + width, top - height],
          [left + width, top],
          [left, top],
        ],
        event.background,
        event.box ? "#000000FF" : "#00000000",
        1,
        "solid",
      );
    }
    let index = 0;
    if (event.title !== undefined) {
      this.drawText(
        left + 4,
        top - rowHeight * 0.8,
        event.title,
        "#000000FF",
        event.cex,
        2,
        0,
        0,
        0.5,
      );
      index += 1;
    }
    for (const entry of event.entries) {
      const column = index % event.columns;
      const row = Math.floor(index / event.columns);
      const x = left + column * columnWidth;
      const y = top - (row + 0.8) * rowHeight;
      if (entry.fill !== undefined) {
        const swatchWidth = rowHeight * 0.85;
        const swatchHeight = rowHeight * 0.62;
        this.path(
          [
            [x + 4, y - swatchHeight / 2],
            [x + 4 + swatchWidth, y - swatchHeight / 2],
            [x + 4 + swatchWidth, y + swatchHeight / 2],
            [x + 4, y + swatchHeight / 2],
          ],
          entry.fill,
          entry.border ?? "#00000000",
          1,
          "solid",
        );
      }
      if (entry.lineType !== undefined) {
        this.line(x + 4, y, x + rowHeight, y, entry.color, entry.lineWidth ?? 1, entry.lineType);
      }
      if (entry.pointSymbol !== undefined) {
        this.drawText(
          x + rowHeight / 2,
          y,
          entry.pointSymbol,
          entry.color,
          event.cex,
          1,
          0,
          0.5,
          0.5,
        );
      }
      this.drawText(
        x + rowHeight * 1.3,
        y,
        entry.label,
        entry.textColor,
        event.cex,
        1,
        0,
        event.textAdjustment[0],
        event.textAdjustment[1],
      );
      index += 1;
    }
  }

  private legendTopLeft(
    position: RGraphicsLegendPosition,
    width: number,
    height: number,
  ): readonly [number, number] {
    if (position.kind === "coordinates") {
      return [
        this.x(position.x) - position.xJust * width,
        this.y(position.y) + (1 - position.yJust) * height,
      ];
    }
    const { region } = this.vectorOptions;
    const horizontalInset = position.inset[0] * region.width;
    const verticalInset = position.inset[1] * region.height;
    const left = position.value.endsWith("left")
      ? region.x + horizontalInset
      : position.value.endsWith("right")
        ? region.x + region.width - horizontalInset - width
        : region.x + (region.width - width) / 2;
    const top = position.value.startsWith("bottom")
      ? region.y + verticalInset + height
      : position.value.startsWith("top")
        ? region.y + region.height - verticalInset
        : region.y + (region.height + height) / 2;
    return [left, top];
  }
}
