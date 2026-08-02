import type {
  RGraphicsBoxplotGroup,
  RGraphicsEvent,
  RGraphicsLegendPosition,
  RGraphicsPoint,
  RGraphicsPolygon,
  RGraphicsText,
} from "@nativr/runtime";

export interface PngRenderOptions {
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly pointsize: number;
  readonly events: readonly RGraphicsEvent[];
  readonly checkpoint: () => void;
}

interface PixelWindow {
  xlim: readonly [number, number];
  ylim: readonly [number, number];
}

type Rgba = readonly [number, number, number, number];

/** Render the owned graphics command vocabulary and encode one standards-compliant RGBA PNG. */
export async function renderGraphicsPng(options: PngRenderOptions): Promise<Uint8Array> {
  const pixels = new Uint8Array(options.width * options.height * 4);
  const canvas = new SoftwareCanvas(
    options.width,
    options.height,
    pixels,
    parseCssColour(options.background),
    options.checkpoint,
  );
  let window: PixelWindow = { xlim: [0, 1], ylim: [0, 1] };
  for (const event of options.events) {
    options.checkpoint();
    if (event.kind === "new-page") {
      canvas.clear(parseCssColour(options.background));
      window = { xlim: [0, 1], ylim: [0, 1] };
    } else if (event.kind === "window") {
      window = event;
    } else if (event.kind === "segments") {
      for (const segment of event.segments) {
        canvas.line(
          pixelX(segment.x0, window, options.width),
          pixelY(segment.y0, window, options.height),
          pixelX(segment.x1, window, options.width),
          pixelY(segment.y1, window, options.height),
          parseCssColour(segment.color),
          segment.lineWidth,
          segment.lineType,
        );
      }
    } else if (event.kind === "points") {
      for (const point of event.points) drawPoint(canvas, point, window, options.pointsize);
    } else if (event.kind === "text") {
      for (const label of event.labels) drawText(canvas, label, window, options.pointsize);
    } else if (event.kind === "polygon") {
      for (const polygon of event.polygons) drawPolygon(canvas, polygon, window);
    } else if (event.kind === "raster") {
      drawRaster(canvas, event, window);
    } else if (event.kind === "box") {
      drawBox(canvas, event);
    } else if (event.kind === "boxplot") {
      for (const group of event.groups)
        drawBoxplot(canvas, event.horizontal, event.notch, group, window);
    } else {
      drawLegend(canvas, event, window, options.pointsize);
    }
  }
  return encodePng(options.width, options.height, pixels);
}

class SoftwareCanvas {
  public constructor(
    public readonly width: number,
    public readonly height: number,
    private readonly pixels: Uint8Array,
    background: Rgba,
    private readonly checkpoint: () => void,
  ) {
    this.clear(background);
  }

  public clear(colour: Rgba): void {
    for (let offset = 0; offset < this.pixels.length; offset += 4) {
      this.pixels[offset] = colour[0];
      this.pixels[offset + 1] = colour[1];
      this.pixels[offset + 2] = colour[2];
      this.pixels[offset + 3] = colour[3];
    }
  }

  public pixel(x: number, y: number, colour: Rgba): void {
    const column = Math.round(x);
    const row = Math.round(y);
    if (column < 0 || row < 0 || column >= this.width || row >= this.height || colour[3] === 0) {
      return;
    }
    const offset = (row * this.width + column) * 4;
    const alpha = colour[3] / 255;
    const destinationAlpha = (this.pixels[offset + 3] ?? 0) / 255;
    const outputAlpha = alpha + destinationAlpha * (1 - alpha);
    if (outputAlpha === 0) return;
    for (let channel = 0; channel < 3; channel += 1) {
      const source = colour[channel] ?? 0;
      const destination = this.pixels[offset + channel] ?? 0;
      this.pixels[offset + channel] = Math.round(
        (source * alpha + destination * destinationAlpha * (1 - alpha)) / outputAlpha,
      );
    }
    this.pixels[offset + 3] = Math.round(outputAlpha * 255);
  }

  public disc(x: number, y: number, radius: number, colour: Rgba): void {
    const bounded = Math.max(0.5, radius);
    const lowerX = Math.floor(x - bounded);
    const upperX = Math.ceil(x + bounded);
    const lowerY = Math.floor(y - bounded);
    const upperY = Math.ceil(y + bounded);
    const squared = bounded * bounded;
    for (let row = lowerY; row <= upperY; row += 1) {
      for (let column = lowerX; column <= upperX; column += 1) {
        if ((column - x) ** 2 + (row - y) ** 2 <= squared) this.pixel(column, row, colour);
      }
    }
  }

  public line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    colour: Rgba,
    width = 1,
    lineType = "solid",
  ): void {
    if (lineType === "blank" || colour[3] === 0) return;
    const distance = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(distance));
    const dashes =
      lineType === "solid"
        ? []
        : [...lineType].map((digit) => Number.parseInt(digit, 16) * Math.max(1, width));
    const period = dashes.reduce((sum, length) => sum + length, 0);
    for (let step = 0; step <= steps; step += 1) {
      if ((step & 1023) === 0) this.checkpoint();
      const along = (step / steps) * distance;
      if (period > 0) {
        let cursor = along % period;
        let visible = true;
        for (const dash of dashes) {
          if (cursor <= dash) break;
          cursor -= dash;
          visible = !visible;
        }
        if (!visible) continue;
      }
      const fraction = step / steps;
      this.disc(x0 + (x1 - x0) * fraction, y0 + (y1 - y0) * fraction, width / 2, colour);
    }
  }

  public fillPolygon(points: readonly (readonly [number, number])[], colour: Rgba): void {
    if (points.length < 3 || colour[3] === 0) return;
    const minimumY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
    const maximumY = Math.min(
      this.height - 1,
      Math.ceil(Math.max(...points.map((point) => point[1]))),
    );
    for (let row = minimumY; row <= maximumY; row += 1) {
      this.checkpoint();
      const intersections: number[] = [];
      for (let index = 0; index < points.length; index += 1) {
        const first = points[index];
        const second = points[(index + 1) % points.length];
        if (first === undefined || second === undefined || first[1] === second[1]) continue;
        const lower = first[1] < second[1] ? first : second;
        const upper = first[1] < second[1] ? second : first;
        if (row < lower[1] || row >= upper[1]) continue;
        intersections.push(
          lower[0] + ((row - lower[1]) * (upper[0] - lower[0])) / (upper[1] - lower[1]),
        );
      }
      intersections.sort((left, right) => left - right);
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        const start = Math.max(0, Math.ceil(intersections[index] ?? 0));
        const end = Math.min(this.width - 1, Math.floor(intersections[index + 1] ?? -1));
        for (let column = start; column <= end; column += 1) this.pixel(column, row, colour);
      }
    }
  }

  public strokePolygon(
    points: readonly (readonly [number, number])[],
    colour: Rgba,
    width: number,
    lineType: string,
  ): void {
    for (let index = 0; index < points.length; index += 1) {
      const first = points[index];
      const second = points[(index + 1) % points.length];
      if (first !== undefined && second !== undefined) {
        this.line(first[0], first[1], second[0], second[1], colour, width, lineType);
      }
    }
  }
}

function pixelX(value: number, window: PixelWindow, width: number): number {
  return ((value - window.xlim[0]) / (window.xlim[1] - window.xlim[0])) * (width - 1);
}

function pixelY(value: number, window: PixelWindow, height: number): number {
  return height - 1 - ((value - window.ylim[0]) / (window.ylim[1] - window.ylim[0])) * (height - 1);
}

function parseCssColour(source: string): Rgba {
  const match = /^#([0-9a-f]{8})$/iu.exec(source);
  if (match === null) return [0, 0, 0, 255];
  const value = match[1] ?? "000000FF";
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    Number.parseInt(value.slice(6, 8), 16),
  ];
}

function drawPoint(
  canvas: SoftwareCanvas,
  point: RGraphicsPoint,
  window: PixelWindow,
  pointsize: number,
): void {
  const x = pixelX(point.x, window, canvas.width);
  const y = pixelY(point.y, window, canvas.height);
  const radius = Math.max(1, 4 * point.size * (pointsize / 12));
  const border = parseCssColour(point.color);
  const fill = parseCssColour(point.fill);
  const symbol = point.symbol;
  if (typeof symbol === "string") {
    drawBitmapText(
      canvas,
      symbol,
      x,
      y,
      Math.max(1, Math.round(point.size * (pointsize / 12))),
      border,
      0,
      0.5,
      0.5,
    );
    return;
  }
  const circle = [1, 10, 13, 16, 19, 20, 21].includes(symbol);
  const filled = symbol >= 15;
  if (circle) {
    if (filled) canvas.disc(x, y, radius, symbol >= 21 ? fill : border);
    strokeCircle(canvas, x, y, radius, border, point.lineWidth);
    return;
  }
  if (symbol === 3 || symbol === 8 || symbol === 9 || symbol === 10 || symbol === 12) {
    canvas.line(x - radius, y, x + radius, y, border, point.lineWidth);
    canvas.line(x, y - radius, x, y + radius, border, point.lineWidth);
  }
  if (symbol === 4 || symbol === 7 || symbol === 8 || symbol === 13) {
    canvas.line(x - radius, y - radius, x + radius, y + radius, border, point.lineWidth);
    canvas.line(x - radius, y + radius, x + radius, y - radius, border, point.lineWidth);
  }
  if ([3, 4, 8].includes(symbol)) return;
  const points = pointVertices(symbol, x, y, radius);
  if (points.length === 0) return;
  if (filled) canvas.fillPolygon(points, symbol >= 21 ? fill : border);
  canvas.strokePolygon(points, border, point.lineWidth, "solid");
}

function pointVertices(
  symbol: number,
  x: number,
  y: number,
  radius: number,
): readonly (readonly [number, number])[] {
  if ([2, 17, 24].includes(symbol))
    return [
      [x, y - radius],
      [x + radius, y + radius],
      [x - radius, y + radius],
    ];
  if ([6, 25].includes(symbol))
    return [
      [x, y + radius],
      [x + radius, y - radius],
      [x - radius, y - radius],
    ];
  if ([5, 9, 18, 23].includes(symbol))
    return [
      [x, y - radius],
      [x + radius, y],
      [x, y + radius],
      [x - radius, y],
    ];
  return [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x + radius, y + radius],
    [x - radius, y + radius],
  ];
}

function strokeCircle(
  canvas: SoftwareCanvas,
  x: number,
  y: number,
  radius: number,
  colour: Rgba,
  width: number,
): void {
  let previous: readonly [number, number] = [x + radius, y];
  for (let step = 1; step <= 48; step += 1) {
    const angle = (step / 48) * Math.PI * 2;
    const next: readonly [number, number] = [
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
    ];
    canvas.line(previous[0], previous[1], next[0], next[1], colour, width);
    previous = next;
  }
}

function drawPolygon(canvas: SoftwareCanvas, polygon: RGraphicsPolygon, window: PixelWindow): void {
  const points = polygon.x.flatMap((x, index) => {
    const y = polygon.y[index];
    return y === undefined
      ? []
      : [[pixelX(x, window, canvas.width), pixelY(y, window, canvas.height)] as const];
  });
  canvas.fillPolygon(points, parseCssColour(polygon.fill));
  canvas.strokePolygon(points, parseCssColour(polygon.border), polygon.lineWidth, polygon.lineType);
}

function drawRaster(
  canvas: SoftwareCanvas,
  event: Extract<RGraphicsEvent, { readonly kind: "raster" }>,
  window: PixelWindow,
): void {
  const x0 = pixelX(event.xleft, window, canvas.width);
  const y0 = pixelY(event.ybottom, window, canvas.height);
  const x1 = pixelX(event.xright, window, canvas.width);
  const y1 = pixelY(event.ytop, window, canvas.height);
  const radians = (event.angle * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const minimumX = Math.floor(Math.min(x0, x1));
  const maximumX = Math.ceil(Math.max(x0, x1));
  const minimumY = Math.floor(Math.min(y0, y1));
  const maximumY = Math.ceil(Math.max(y0, y1));
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const normalizedX = (x - x0) / (x1 - x0 || 1);
      const normalizedY = (y - y0) / (y1 - y0 || 1);
      const u = normalizedX * cosine + normalizedY * sine;
      const v = -normalizedX * sine + normalizedY * cosine;
      const sourceX = Math.min(event.width - 1, Math.max(0, Math.floor(u * event.width)));
      const sourceY = Math.min(event.height - 1, Math.max(0, Math.floor((1 - v) * event.height)));
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const offset = (sourceY * event.width + sourceX) * 4;
      canvas.pixel(x, y, [
        event.rgba[offset] ?? 0,
        event.rgba[offset + 1] ?? 0,
        event.rgba[offset + 2] ?? 0,
        event.rgba[offset + 3] ?? 255,
      ]);
    }
  }
}

function drawBox(
  canvas: SoftwareCanvas,
  event: Extract<RGraphicsEvent, { readonly kind: "box" }>,
): void {
  const colour = parseCssColour(event.color);
  const inset = event.lineWidth / 2;
  const edges = {
    top: [inset, inset, canvas.width - inset, inset],
    right: [canvas.width - inset, inset, canvas.width - inset, canvas.height - inset],
    bottom: [canvas.width - inset, canvas.height - inset, inset, canvas.height - inset],
    left: [inset, canvas.height - inset, inset, inset],
  } as const;
  for (const edge of event.edges) {
    const line = edges[edge];
    canvas.line(line[0], line[1], line[2], line[3], colour, event.lineWidth, event.lineType);
  }
}

function drawBoxplot(
  canvas: SoftwareCanvas,
  horizontal: boolean,
  notch: boolean,
  group: RGraphicsBoxplotGroup,
  window: PixelWindow,
): void {
  const [minimum, lower, median, upper, maximum] = group.stats;
  const [lowerConfidence, upperConfidence] = group.confidence;
  const half = group.width / 2;
  const inner = half / 2;
  const point = (category: number, value: number): readonly [number, number] =>
    horizontal
      ? [pixelX(value, window, canvas.width), pixelY(category, window, canvas.height)]
      : [pixelX(category, window, canvas.width), pixelY(value, window, canvas.height)];
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
  const border = parseCssColour(group.border);
  canvas.fillPolygon(body, parseCssColour(group.fill));
  canvas.strokePolygon(body, border, group.lineWidth, group.lineType);
  const line = (first: readonly [number, number], second: readonly [number, number]): void =>
    canvas.line(first[0], first[1], second[0], second[1], border, group.lineWidth, group.lineType);
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
    strokeCircle(canvas, x, y, Math.max(2.5, group.lineWidth * 1.5), border, group.lineWidth);
  }
}

function drawLegend(
  canvas: SoftwareCanvas,
  event: Extract<RGraphicsEvent, { readonly kind: "legend" }>,
  window: PixelWindow,
  pointsize: number,
): void {
  const fontSize = Math.max(8, Math.round(pointsize * event.cex));
  const rowHeight = fontSize * 1.5;
  const symbolWidth = fontSize * 2.4;
  const padding = fontSize * 0.55;
  const rows = Math.ceil(event.entries.length / event.columns);
  const maximumTextWidth = Math.max(
    1,
    ...event.entries.map((entry) => entry.label.length * fontSize * 0.65),
    (event.title?.length ?? 0) * fontSize * 0.65,
  );
  const columnWidth = symbolWidth + maximumTextWidth + padding;
  const width = event.columns * columnWidth + padding * 2;
  const height = (rows + (event.title === undefined ? 0 : 1)) * rowHeight + padding * 2;
  const [left, top] = legendTopLeft(event.position, width, height, canvas, window);
  if (event.box) {
    const rectangle = [
      [left, top],
      [left + width, top],
      [left + width, top + height],
      [left, top + height],
    ] as const;
    canvas.fillPolygon(rectangle, parseCssColour(event.background));
    canvas.strokePolygon(rectangle, [0, 0, 0, 255], 1, "solid");
  }
  if (event.title !== undefined) {
    drawBitmapText(
      canvas,
      event.title,
      left + width / 2,
      top + padding + rowHeight / 2,
      Math.max(1, Math.round(fontSize / 8)),
      parseCssColour(event.entries[0]?.textColor ?? "#000000FF"),
      0,
      0.5,
      0.5,
    );
  }
  const titleRows = event.title === undefined ? 0 : 1;
  for (let index = 0; index < event.entries.length; index += 1) {
    const entry = event.entries[index];
    if (entry === undefined) continue;
    const column = Math.floor(index / rows);
    const row = index % rows;
    const x = left + padding + column * columnWidth;
    const y = top + padding + (titleRows + row + 0.5) * rowHeight;
    if (entry.lineType !== undefined && entry.lineWidth !== undefined) {
      canvas.line(
        x,
        y,
        x + symbolWidth * 0.72,
        y,
        parseCssColour(entry.color),
        entry.lineWidth,
        entry.lineType,
      );
    }
    if (entry.pointSymbol !== undefined) {
      drawBitmapText(
        canvas,
        entry.pointSymbol,
        x + symbolWidth * 0.36,
        y,
        Math.max(1, Math.round(fontSize / 8)),
        parseCssColour(entry.color),
        0,
        0.5,
        0.5,
      );
    }
    drawBitmapText(
      canvas,
      entry.label,
      x + symbolWidth,
      y,
      Math.max(1, Math.round(fontSize / 8)),
      parseCssColour(entry.textColor),
      0,
      0,
      0.5,
    );
  }
}

function legendTopLeft(
  position: RGraphicsLegendPosition,
  width: number,
  height: number,
  canvas: SoftwareCanvas,
  window: PixelWindow,
): readonly [number, number] {
  if (position.kind === "coordinates")
    return [pixelX(position.x, window, canvas.width), pixelY(position.y, window, canvas.height)];
  const insetX = position.inset[0] * canvas.width;
  const insetY = position.inset[1] * canvas.height;
  const left = position.value.endsWith("left")
    ? insetX
    : position.value.endsWith("right")
      ? canvas.width - insetX - width
      : (canvas.width - width) / 2;
  const top = position.value.startsWith("bottom")
    ? canvas.height - insetY - height
    : position.value.startsWith("top")
      ? insetY
      : (canvas.height - height) / 2;
  return [left, top];
}

function drawText(
  canvas: SoftwareCanvas,
  label: RGraphicsText,
  window: PixelWindow,
  pointsize: number,
): void {
  drawBitmapText(
    canvas,
    label.label,
    pixelX(label.x, window, canvas.width),
    pixelY(label.y, window, canvas.height),
    Math.max(1, Math.round((pointsize / 6) * label.size)),
    parseCssColour(label.color),
    label.rotation,
    label.horizontalAdjustment,
    label.verticalAdjustment,
  );
}

const GLYPHS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  "-": ["000", "000", "000", "111", "000", "000", "000"],
  ".": ["000", "000", "000", "000", "000", "110", "110"],
  ",": ["000", "000", "000", "000", "110", "010", "100"],
  ":": ["000", "110", "110", "000", "110", "110", "000"],
  "(": ["010", "100", "100", "100", "100", "100", "010"],
  ")": ["010", "001", "001", "001", "001", "001", "010"],
  "0": ["111", "101", "101", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["111", "001", "001", "111", "100", "100", "111"],
  "3": ["111", "001", "001", "111", "001", "001", "111"],
  "4": ["101", "101", "101", "111", "001", "001", "001"],
  "5": ["111", "100", "100", "111", "001", "001", "111"],
  "6": ["111", "100", "100", "111", "101", "101", "111"],
  "7": ["111", "001", "001", "010", "010", "100", "100"],
  "8": ["111", "101", "101", "111", "101", "101", "111"],
  "9": ["111", "101", "101", "111", "001", "001", "111"],
  A: ["010", "101", "101", "111", "101", "101", "101"],
  B: ["110", "101", "101", "110", "101", "101", "110"],
  C: ["011", "100", "100", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "101", "101", "110"],
  E: ["111", "100", "100", "110", "100", "100", "111"],
  F: ["111", "100", "100", "110", "100", "100", "100"],
  G: ["011", "100", "100", "101", "101", "101", "011"],
  H: ["101", "101", "101", "111", "101", "101", "101"],
  I: ["111", "010", "010", "010", "010", "010", "111"],
  J: ["001", "001", "001", "001", "101", "101", "010"],
  K: ["101", "101", "110", "100", "110", "101", "101"],
  L: ["100", "100", "100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101", "101", "101"],
  N: ["101", "111", "111", "111", "101", "101", "101"],
  O: ["010", "101", "101", "101", "101", "101", "010"],
  P: ["110", "101", "101", "110", "100", "100", "100"],
  Q: ["010", "101", "101", "101", "111", "011", "001"],
  R: ["110", "101", "101", "110", "110", "101", "101"],
  S: ["011", "100", "100", "010", "001", "001", "110"],
  T: ["111", "010", "010", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "101", "101", "010"],
  W: ["101", "101", "101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "010", "010", "101", "101"],
  Y: ["101", "101", "101", "010", "010", "010", "010"],
  Z: ["111", "001", "001", "010", "100", "100", "111"],
});

function drawBitmapText(
  canvas: SoftwareCanvas,
  text: string,
  anchorX: number,
  anchorY: number,
  scale: number,
  colour: Rgba,
  rotation: number,
  horizontalAdjustment: number,
  verticalAdjustment: number,
): void {
  const characters = [...text];
  const advance = 4 * scale;
  const width = Math.max(0, characters.length * advance - scale);
  const height = 7 * scale;
  const radians = (-rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const originX = -width * horizontalAdjustment;
  const originY = -height * (1 - verticalAdjustment);
  characters.forEach((character, characterIndex) => {
    const glyph = GLYPHS[character.toUpperCase()] ?? [
      "111",
      "101",
      "001",
      "010",
      "000",
      "010",
      "000",
    ];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((bit, columnIndex) => {
        if (bit !== "1") return;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const localX = originX + characterIndex * advance + columnIndex * scale + dx;
            const localY = originY + rowIndex * scale + dy;
            canvas.pixel(
              anchorX + localX * cosine - localY * sine,
              anchorY + localX * sine + localY * cosine,
              colour,
            );
          }
        }
      });
    });
  });
}

async function encodePng(width: number, height: number, rgba: Uint8Array): Promise<Uint8Array> {
  const scanlines = new Uint8Array(height * (width * 4 + 1));
  for (let row = 0; row < height; row += 1) {
    const destination = row * (width * 4 + 1);
    scanlines[destination] = 0;
    scanlines.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), destination + 1);
  }
  const compressed = await deflateZlib(scanlines);
  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return concatenate([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

export async function deflateZlib(source: Uint8Array): Promise<Uint8Array> {
  type Reader = { read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }> };
  type Compression = {
    readonly readable: { getReader(): Reader };
    readonly writable: {
      getWriter(): { write(value: Uint8Array): Promise<void>; close(): Promise<void> };
    };
  };
  const Constructor = (
    globalThis as unknown as { readonly CompressionStream?: new (format: "deflate") => Compression }
  ).CompressionStream;
  if (Constructor !== undefined) {
    try {
      const stream = new Constructor("deflate");
      const reader = stream.readable.getReader();
      const reading = (async (): Promise<Uint8Array> => {
        const chunks: Uint8Array[] = [];
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          if (next.value !== undefined) chunks.push(next.value);
        }
        return concatenate(chunks);
      })();
      const writer = stream.writable.getWriter();
      await writer.write(source);
      await writer.close();
      return await reading;
    } catch {
      // Older browser engines may expose the constructor without the deflate format.
    }
  }
  return uncompressedZlib(source);
}

function uncompressedZlib(source: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(source.byteLength / 65_535));
  const output = new Uint8Array(2 + source.byteLength + blocks * 5 + 4);
  output.set([0x78, 0x01]);
  let inputOffset = 0;
  let outputOffset = 2;
  while (inputOffset < source.byteLength || (source.byteLength === 0 && inputOffset === 0)) {
    const length = Math.min(65_535, source.byteLength - inputOffset);
    const final = inputOffset + length >= source.byteLength;
    output[outputOffset] = final ? 1 : 0;
    output[outputOffset + 1] = length & 0xff;
    output[outputOffset + 2] = (length >>> 8) & 0xff;
    const complement = ~length & 0xffff;
    output[outputOffset + 3] = complement & 0xff;
    output[outputOffset + 4] = (complement >>> 8) & 0xff;
    output.set(source.subarray(inputOffset, inputOffset + length), outputOffset + 5);
    outputOffset += length + 5;
    inputOffset += length;
    if (final) break;
  }
  writeUint32(output, outputOffset, adler32(source));
  return output;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from([...type].map((character) => character.charCodeAt(0)));
  const output = new Uint8Array(12 + data.byteLength);
  writeUint32(output, 0, data.byteLength);
  output.set(typeBytes, 4);
  output.set(data, 8);
  writeUint32(output, 8 + data.byteLength, crc32(concatenate([typeBytes, data])));
  return output;
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function crc32(source: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of source) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(source: Uint8Array): number {
  let first = 1;
  let second = 0;
  for (const byte of source) {
    first = (first + byte) % 65_521;
    second = (second + first) % 65_521;
  }
  return ((second << 16) | first) >>> 0;
}
