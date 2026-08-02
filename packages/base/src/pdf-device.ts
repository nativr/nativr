import type {
  RGraphicsBoxplotGroup,
  RGraphicsEvent,
  RGraphicsLegendPosition,
  RGraphicsPoint,
  RGraphicsPolygon,
  RGraphicsText,
} from "@nativr/runtime";
import { deflateZlib } from "./png-device.js";

export interface PdfRenderOptions {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly background: string;
  readonly pointsize: number;
  readonly family: "sans" | "serif" | "mono";
  readonly title: string;
  readonly author: string;
  readonly version: string;
  readonly colorModel: "srgb" | "gray" | "cmyk";
  readonly compress: boolean;
  readonly timestamp: boolean;
  readonly producer: boolean;
  readonly pages: readonly (readonly RGraphicsEvent[])[];
  readonly checkpoint: () => void;
}

interface PdfWindow {
  xlim: readonly [number, number];
  ylim: readonly [number, number];
}

type Rgba = readonly [number, number, number, number];

/** Encode the owned graphics journal as a self-contained PDF 1.x document. */
export async function renderGraphicsPdf(options: PdfRenderOptions): Promise<Uint8Array> {
  const alphas = new Set<number>();
  const contents = options.pages.map((events) => {
    const canvas = new PdfCanvas(options, alphas);
    canvas.render(events);
    return canvas.finish();
  });

  const objects: (Uint8Array | undefined)[] = [undefined];
  const reserve = (): number => {
    objects.push(undefined);
    return objects.length - 1;
  };
  const assign = (id: number, value: string | Uint8Array): void => {
    objects[id] = typeof value === "string" ? ascii(value) : value;
  };

  const catalogId = reserve();
  const pagesId = reserve();
  const fontIds = [reserve(), reserve(), reserve(), reserve()];
  const fontNames =
    options.family === "serif"
      ? ["Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"]
      : options.family === "mono"
        ? ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"]
        : ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"];
  for (let index = 0; index < fontIds.length; index += 1) {
    assign(
      fontIds[index] ?? 0,
      `<< /Type /Font /Subtype /Type1 /BaseFont /${fontNames[index]} /Encoding /WinAnsiEncoding >>`,
    );
  }

  const alphaIds = new Map<number, number>();
  for (const alpha of [...alphas].sort((left, right) => left - right)) {
    const id = reserve();
    alphaIds.set(alpha, id);
    const opacity = fixed(alpha / 255);
    assign(id, `<< /Type /ExtGState /CA ${opacity} /ca ${opacity} >>`);
  }

  const pageIds: number[] = [];
  for (const source of contents) {
    const pageId = reserve();
    const contentId = reserve();
    pageIds.push(pageId);
    const plain = ascii(source);
    const stream = options.compress ? await deflateZlib(plain) : plain;
    assign(
      contentId,
      concatBytes([
        ascii(
          `<< /Length ${stream.byteLength}${options.compress ? " /Filter /FlateDecode" : ""} >>\nstream\n`,
        ),
        stream,
        ascii("\nendstream"),
      ]),
    );
    const alphaResources = [...alphaIds].map(([alpha, id]) => `/GS${alpha} ${id} 0 R`).join(" ");
    assign(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${fixed(options.pageWidth)} ${fixed(options.pageHeight)}] /Resources << /Font << /F1 ${fontIds[0]} 0 R /F2 ${fontIds[1]} 0 R /F3 ${fontIds[2]} 0 R /F4 ${fontIds[3]} 0 R >>${alphaResources === "" ? "" : ` /ExtGState << ${alphaResources} >>`} >> /Contents ${contentId} 0 R >>`,
    );
  }

  assign(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  assign(
    pagesId,
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`,
  );

  const infoId = reserve();
  const metadata = [
    options.title === "" ? "" : `/Title ${pdfString(options.title)}`,
    options.author === "" ? "" : `/Author ${pdfString(options.author)}`,
    options.producer ? "/Producer (NativR browser-native PDF device)" : "",
    options.timestamp
      ? `/CreationDate (${pdfDate(new Date())}) /ModDate (${pdfDate(new Date())})`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  assign(infoId, `<< ${metadata} >>`);

  const header = ascii(`%PDF-${options.version}\n%NativR\n`);
  const chunks: Uint8Array[] = [header];
  const offsets = [0];
  let offset = header.byteLength;
  for (let id = 1; id < objects.length; id += 1) {
    const body = objects[id];
    if (body === undefined) throw new Error(`Internal PDF object ${id} was not assigned.`);
    const object = concatBytes([ascii(`${id} 0 obj\n`), body, ascii("\nendobj\n")]);
    offsets[id] = offset;
    chunks.push(object);
    offset += object.byteLength;
  }
  const xrefOffset = offset;
  const xref = ["xref", `0 ${objects.length}`, "0000000000 65535 f "];
  for (let id = 1; id < objects.length; id += 1) {
    xref.push(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n `);
  }
  chunks.push(
    ascii(
      `${xref.join("\n")}\ntrailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    ),
  );
  return concatBytes(chunks);
}

class PdfCanvas {
  readonly #commands: string[] = [];
  #window: PdfWindow = { xlim: [0, 1], ylim: [0, 1] };

  public constructor(
    private readonly options: PdfRenderOptions,
    private readonly alphas: Set<number>,
  ) {
    const background = parseColour(options.background);
    if (background[3] > 0) {
      this.#commands.push(
        `q ${this.fillColour(background)} 0 0 ${fixed(options.pageWidth)} ${fixed(options.pageHeight)} re f Q`,
      );
    }
  }

  public render(events: readonly RGraphicsEvent[]): void {
    for (const event of events) {
      this.options.checkpoint();
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

  public finish(): string {
    return this.#commands.join("\n");
  }

  private x(value: number): number {
    return (
      this.options.region.x +
      ((value - this.#window.xlim[0]) / (this.#window.xlim[1] - this.#window.xlim[0])) *
        this.options.region.width
    );
  }

  private y(value: number): number {
    return (
      this.options.region.y +
      ((value - this.#window.ylim[0]) / (this.#window.ylim[1] - this.#window.ylim[0])) *
        this.options.region.height
    );
  }

  private alpha(colour: Rgba): string {
    this.alphas.add(colour[3]);
    return `/GS${colour[3]} gs`;
  }

  private strokeColour(colour: Rgba): string {
    return `${this.alpha(colour)} ${pdfColour(colour, this.options.colorModel, true)}`;
  }

  private fillColour(colour: Rgba): string {
    return `${this.alpha(colour)} ${pdfColour(colour, this.options.colorModel, false)}`;
  }

  private line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    colourSource: string,
    width: number,
    lineType: string,
  ): void {
    const colour = parseColour(colourSource);
    if (colour[3] === 0 || lineType === "blank") return;
    this.#commands.push(
      `q ${this.strokeColour(colour)} ${fixed(Math.max(0.01, width * 0.75))} w ${pdfDash(lineType, width)} ${fixed(x0)} ${fixed(y0)} m ${fixed(x1)} ${fixed(y1)} l S Q`,
    );
  }

  private path(
    points: readonly (readonly [number, number])[],
    fillSource: string,
    borderSource: string,
    width: number,
    lineType: string,
    fillRule: "nonzero" | "evenodd" = "nonzero",
  ): void {
    if (points.length < 2) return;
    const fill = parseColour(fillSource);
    const border = parseColour(borderSource);
    const operations = [
      "q",
      fill[3] === 0 ? "" : this.fillColour(fill),
      border[3] === 0 || lineType === "blank"
        ? ""
        : `${this.strokeColour(border)} ${fixed(Math.max(0.01, width * 0.75))} w ${pdfDash(lineType, width)}`,
      `${fixed(points[0]?.[0] ?? 0)} ${fixed(points[0]?.[1] ?? 0)} m`,
      ...points.slice(1).map(([x, y]) => `${fixed(x)} ${fixed(y)} l`),
      "h",
      fill[3] > 0 && border[3] > 0 && lineType !== "blank"
        ? fillRule === "evenodd"
          ? "B*"
          : "B"
        : fill[3] > 0
          ? fillRule === "evenodd"
            ? "f*"
            : "f"
          : border[3] > 0 && lineType !== "blank"
            ? "S"
            : "n",
      "Q",
    ];
    this.#commands.push(operations.filter(Boolean).join(" "));
  }

  private circle(
    x: number,
    y: number,
    radius: number,
    fill: string,
    border: string,
    width: number,
  ): void {
    const kappa = 0.5522847498 * radius;
    const fillColour = parseColour(fill);
    const borderColour = parseColour(border);
    const paint = fillColour[3] > 0 && borderColour[3] > 0 ? "B" : fillColour[3] > 0 ? "f" : "S";
    if (fillColour[3] === 0 && borderColour[3] === 0) return;
    this.#commands.push(
      [
        "q",
        fillColour[3] > 0 ? this.fillColour(fillColour) : "",
        borderColour[3] > 0
          ? `${this.strokeColour(borderColour)} ${fixed(Math.max(0.01, width * 0.75))} w`
          : "",
        `${fixed(x + radius)} ${fixed(y)} m`,
        `${fixed(x + radius)} ${fixed(y + kappa)} ${fixed(x + kappa)} ${fixed(y + radius)} ${fixed(x)} ${fixed(y + radius)} c`,
        `${fixed(x - kappa)} ${fixed(y + radius)} ${fixed(x - radius)} ${fixed(y + kappa)} ${fixed(x - radius)} ${fixed(y)} c`,
        `${fixed(x - radius)} ${fixed(y - kappa)} ${fixed(x - kappa)} ${fixed(y - radius)} ${fixed(x)} ${fixed(y - radius)} c`,
        `${fixed(x + kappa)} ${fixed(y - radius)} ${fixed(x + radius)} ${fixed(y - kappa)} ${fixed(x + radius)} ${fixed(y)} c`,
        paint,
        "Q",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  private point(point: RGraphicsPoint): void {
    const x = this.x(point.x);
    const y = this.y(point.y);
    const radius = Math.max(1, 3 * point.size * (this.options.pointsize / 12));
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
    const vertices = pointVertices(symbol, x, y, radius);
    this.path(
      vertices,
      filled ? (symbol >= 21 ? point.fill : point.color) : "#00000000",
      point.color,
      point.lineWidth,
      "solid",
    );
  }

  private text(label: RGraphicsText): void {
    let x = this.x(label.x);
    let y = this.y(label.y);
    const size = Math.max(0.1, this.options.pointsize * label.size);
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

  private drawText(
    x: number,
    y: number,
    label: string,
    colourSource: string,
    scale: number,
    font: 1 | 2 | 3 | 4,
    rotation: number,
    horizontalAdjustment: number,
    verticalAdjustment: number,
  ): void {
    const colour = parseColour(colourSource);
    if (colour[3] === 0 || label === "") return;
    const size = Math.max(0.1, this.options.pointsize * scale);
    const width = label.length * size * 0.52;
    const radians = (rotation * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const originX = x - horizontalAdjustment * width;
    const originY = y - verticalAdjustment * size * 0.8;
    this.#commands.push(
      `q ${this.fillColour(colour)} BT /F${font} ${fixed(size)} Tf ${fixed(cosine)} ${fixed(sine)} ${fixed(-sine)} ${fixed(cosine)} ${fixed(originX)} ${fixed(originY)} Tm ${pdfString(label)} Tj ET Q`,
    );
  }

  private polygon(polygon: RGraphicsPolygon): void {
    const points = polygon.x.flatMap((x, index) => {
      const y = polygon.y[index];
      return y === undefined ? [] : [[this.x(x), this.y(y)] as const];
    });
    this.path(
      points,
      polygon.fill,
      polygon.border,
      polygon.lineWidth,
      polygon.lineType,
      polygon.fillRule,
    );
  }

  private raster(event: Extract<RGraphicsEvent, { readonly kind: "raster" }>): void {
    const x0 = this.x(event.xleft);
    const y0 = this.y(event.ybottom);
    const x1 = this.x(event.xright);
    const y1 = this.y(event.ytop);
    const radians = (event.angle * Math.PI) / 180;
    const width = x1 - x0;
    const height = y1 - y0;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const rgb = new Uint8Array(event.width * event.height * 3);
    for (let pixel = 0; pixel < event.width * event.height; pixel += 1) {
      if ((pixel & 1023) === 0) this.options.checkpoint();
      const source = pixel * 4;
      const target = pixel * 3;
      const alpha = (event.rgba[source + 3] ?? 255) / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        rgb[target + channel] = Math.round(
          (event.rgba[source + channel] ?? 0) * alpha + 255 * (1 - alpha),
        );
      }
    }
    this.#commands.push(
      `q ${fixed(width * cosine)} ${fixed(width * sine)} ${fixed(-height * sine)} ${fixed(height * cosine)} ${fixed(x0)} ${fixed(y0)} cm BI /W ${event.width} /H ${event.height} /CS /RGB /BPC 8 /F /AHx ID\n${hex(rgb)}>\nEI Q`,
    );
  }

  private box(event: Extract<RGraphicsEvent, { readonly kind: "box" }>): void {
    const left = this.options.region.x;
    const right = left + this.options.region.width;
    const bottom = this.options.region.y;
    const top = bottom + this.options.region.height;
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
    const rowHeight = this.options.pointsize * event.cex * 1.3;
    const columnWidth = this.options.pointsize * event.cex * 8;
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
      this.drawText(x + rowHeight * 1.3, y, entry.label, entry.textColor, event.cex, 1, 0, 0, 0.5);
      index += 1;
    }
  }

  private legendTopLeft(
    position: RGraphicsLegendPosition,
    width: number,
    height: number,
  ): readonly [number, number] {
    if (position.kind === "coordinates") return [this.x(position.x), this.y(position.y)];
    const region = this.options.region;
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

function pointVertices(
  symbol: number,
  x: number,
  y: number,
  radius: number,
): readonly (readonly [number, number])[] {
  if ([2, 17, 24].includes(symbol))
    return [
      [x, y + radius],
      [x + radius, y - radius],
      [x - radius, y - radius],
    ];
  if ([6, 25].includes(symbol))
    return [
      [x, y - radius],
      [x + radius, y + radius],
      [x - radius, y + radius],
    ];
  if ([5, 9, 18, 23].includes(symbol))
    return [
      [x, y + radius],
      [x + radius, y],
      [x, y - radius],
      [x - radius, y],
    ];
  return [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x + radius, y + radius],
    [x - radius, y + radius],
  ];
}

function parseColour(source: string): Rgba {
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

function pdfColour(colour: Rgba, model: PdfRenderOptions["colorModel"], stroke: boolean): string {
  const red = colour[0] / 255;
  const green = colour[1] / 255;
  const blue = colour[2] / 255;
  if (model === "gray") {
    return `${fixed(red * 0.2126 + green * 0.7152 + blue * 0.0722)} ${stroke ? "G" : "g"}`;
  }
  if (model === "cmyk") {
    const black = 1 - Math.max(red, green, blue);
    const denominator = 1 - black;
    const cyan = denominator === 0 ? 0 : (1 - red - black) / denominator;
    const magenta = denominator === 0 ? 0 : (1 - green - black) / denominator;
    const yellow = denominator === 0 ? 0 : (1 - blue - black) / denominator;
    return `${fixed(cyan)} ${fixed(magenta)} ${fixed(yellow)} ${fixed(black)} ${stroke ? "K" : "k"}`;
  }
  return `${fixed(red)} ${fixed(green)} ${fixed(blue)} ${stroke ? "RG" : "rg"}`;
}

function pdfDash(lineType: string, width: number): string {
  if (lineType === "solid" || lineType === "blank") return "[] 0 d";
  const pattern = [...lineType].map(
    (digit) => Number.parseInt(digit, 16) * Math.max(0.75, width * 0.75),
  );
  return `[${pattern.map(fixed).join(" ")}] 0 d`;
}

function pdfString(value: string): string {
  let output = "(";
  for (const character of value) {
    const point = character.codePointAt(0) ?? 63;
    if (character === "(" || character === ")" || character === "\\") output += `\\${character}`;
    else if (point >= 32 && point <= 126) output += character;
    else if (point <= 255) output += `\\${point.toString(8).padStart(3, "0")}`;
    else output += "?";
  }
  return `${output})`;
}

function pdfDate(value: Date): string {
  const field = (input: number): string => String(input).padStart(2, "0");
  return `D:${value.getUTCFullYear()}${field(value.getUTCMonth() + 1)}${field(value.getUTCDate())}${field(value.getUTCHours())}${field(value.getUTCMinutes())}${field(value.getUTCSeconds())}Z`;
}

function fixed(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function hex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0").toUpperCase();
  return output;
}

function ascii(value: string): Uint8Array {
  const output = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    output[index] = value.charCodeAt(index) & 0x7f;
  }
  return output;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
