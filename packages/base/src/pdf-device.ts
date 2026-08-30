import type { RGraphicsEvent, RGraphicsPolygon } from "@nativr/runtime";
import {
  asciiBytes as ascii,
  fixedGraphicsNumber as fixed,
  type GraphicsRgba as Rgba,
  hexBytes as hex,
  parseGraphicsColour as parseColour,
  polygonHatchSegments,
  postscriptString as pdfString,
} from "./graphics-device-utils.js";
import { deflateZlib } from "./png-device.js";
import { VectorGraphicsCanvas } from "./vector-device.js";

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

class PdfCanvas extends VectorGraphicsCanvas {
  readonly #commands: string[] = [];

  public constructor(
    private readonly options: PdfRenderOptions,
    private readonly alphas: Set<number>,
  ) {
    super(options);
    const background = parseColour(options.background);
    if (background[3] > 0) {
      this.#commands.push(
        `q ${this.fillColour(background)} 0 0 ${fixed(options.pageWidth)} ${fixed(options.pageHeight)} re f Q`,
      );
    }
  }

  public finish(): string {
    return this.#commands.join("\n");
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

  protected line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    colourSource: string,
    width: number,
    lineType: string,
    lineCap: "round" | "butt" | "square" = "round",
  ): void {
    const colour = parseColour(colourSource);
    if (colour[3] === 0 || lineType === "blank") return;
    this.#commands.push(
      `q ${this.strokeColour(colour)} ${fixed(Math.max(0.01, width * 0.75))} w ${pdfLineCap(lineCap)} J ${pdfDash(lineType, width)} ${fixed(x0)} ${fixed(y0)} m ${fixed(x1)} ${fixed(y1)} l S Q`,
    );
  }

  protected path(
    points: readonly (readonly [number, number])[],
    fillSource: string,
    borderSource: string,
    width: number,
    lineType: string,
    fillRule: "nonzero" | "evenodd" = "nonzero",
  ): void {
    const paths = splitPdfPaths(points);
    if (paths.length === 0) return;
    const fill = parseColour(fillSource);
    const border = parseColour(borderSource);
    const operations = [
      "q",
      fill[3] === 0 ? "" : this.fillColour(fill),
      border[3] === 0 || lineType === "blank"
        ? ""
        : `${this.strokeColour(border)} ${fixed(Math.max(0.01, width * 0.75))} w ${pdfDash(lineType, width)}`,
      ...paths.flatMap((path) => [
        `${fixed(path[0]?.[0] ?? 0)} ${fixed(path[0]?.[1] ?? 0)} m`,
        ...path.slice(1).map(([x, y]) => `${fixed(x)} ${fixed(y)} l`),
        "h",
      ]),
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

  protected circle(
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

  protected drawText(
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

  protected polygon(polygon: RGraphicsPolygon): void {
    const points = polygon.x.flatMap((x, index) => {
      const y = polygon.y[index];
      return y === undefined
        ? []
        : !Number.isFinite(x) || !Number.isFinite(y)
          ? ([[Number.NaN, Number.NaN]] as const)
          : ([[this.x(x), this.y(y)]] as const);
    });
    if (polygon.hatch === undefined) {
      this.path(
        points,
        polygon.fill,
        polygon.border,
        polygon.lineWidth,
        polygon.lineType,
        polygon.fillRule,
      );
      return;
    }
    this.path(points, polygon.fill, "#00000000", polygon.lineWidth, "solid", polygon.fillRule);
    const hatchColour = parseColour(polygon.hatch.color);
    if (hatchColour[3] > 0 && points.length >= 3) {
      const path = [
        `${fixed(points[0]?.[0] ?? 0)} ${fixed(points[0]?.[1] ?? 0)} m`,
        ...points.slice(1).map(([x, y]) => `${fixed(x)} ${fixed(y)} l`),
        "h",
      ];
      const lines = polygonHatchSegments(
        points,
        polygon.hatch.density,
        polygon.hatch.angle,
        72,
      ).flatMap(([start, end]) => [
        `${fixed(start[0])} ${fixed(start[1])} m`,
        `${fixed(end[0])} ${fixed(end[1])} l`,
      ]);
      this.#commands.push(
        [
          "q",
          this.strokeColour(hatchColour),
          `${fixed(Math.max(0.01, polygon.lineWidth * 0.75))} w [] 0 d`,
          ...path,
          polygon.fillRule === "evenodd" ? "W* n" : "W n",
          ...lines,
          "S Q",
        ].join(" "),
      );
    }
    this.path(
      points,
      "#00000000",
      polygon.border,
      polygon.lineWidth,
      polygon.lineType,
      polygon.fillRule,
    );
  }

  protected raster(event: Extract<RGraphicsEvent, { readonly kind: "raster" }>): void {
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
}

function splitPdfPaths(
  points: readonly (readonly [number, number])[],
): readonly (readonly (readonly [number, number])[])[] {
  const paths: Array<Array<readonly [number, number]>> = [[]];
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      if ((paths.at(-1)?.length ?? 0) > 0) paths.push([]);
      continue;
    }
    paths.at(-1)!.push(point);
  }
  return paths.filter((path) => path.length >= 2);
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

function pdfLineCap(lineCap: "round" | "butt" | "square"): number {
  return lineCap === "butt" ? 0 : lineCap === "round" ? 1 : 2;
}

function pdfDate(value: Date): string {
  const field = (input: number): string => String(input).padStart(2, "0");
  return `D:${value.getUTCFullYear()}${field(value.getUTCMonth() + 1)}${field(value.getUTCDate())}${field(value.getUTCHours())}${field(value.getUTCMinutes())}${field(value.getUTCSeconds())}Z`;
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
