import type { RGraphicsEvent, RGraphicsPolygon } from "@nativr/runtime";
import {
  asciiBytes as ascii,
  fixedGraphicsNumber as fixed,
  type GraphicsRgba as Rgba,
  hexBytes as hex,
  parseGraphicsColour as parseColour,
  polygonHatchSegments,
  postscriptString as psString,
} from "./graphics-device-utils.js";
import { VectorGraphicsCanvas } from "./vector-device.js";

export interface PostScriptRenderOptions {
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
  readonly colorModel: "srgb" | "gray" | "cmyk";
  readonly fillOddEven: boolean;
  readonly pages: readonly (readonly RGraphicsEvent[])[];
  readonly checkpoint: () => void;
  readonly unsupported?: (message: string) => never;
}

/** Encode the owned graphics journal as a self-contained DSC PostScript Level 2 document. */
export function renderGraphicsPostScript(options: PostScriptRenderOptions): Uint8Array {
  const fontNames =
    options.family === "serif"
      ? ["Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"]
      : options.family === "mono"
        ? ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"]
        : ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"];
  const width = Math.ceil(options.pageWidth);
  const height = Math.ceil(options.pageHeight);
  const lines = [
    "%!PS-Adobe-3.0",
    `%%DocumentNeededResources: font ${fontNames[0]}`,
    ...fontNames.slice(1).map((font) => `%%+ font ${font}`),
    `%%DocumentMedia: nativr ${width} ${height} 0 () ()`,
    `%%Title: ${dscText(options.title)}`,
    "%%Creator: NativR browser-native PostScript device",
    "%%Pages: (atend)",
    `%%BoundingBox: 0 0 ${width} ${height}`,
    "%%LanguageLevel: 2",
    "%%EndComments",
    "%%BeginProlog",
    ...fontNames.map((font, index) => `/F${index + 1} /${font} def`),
    "/NRM { moveto } bind def",
    "/NRL { lineto } bind def",
    "%%EndProlog",
  ];
  for (let page = 0; page < options.pages.length; page += 1) {
    options.checkpoint();
    const canvas = new PostScriptCanvas(options);
    canvas.render(options.pages[page] ?? []);
    lines.push(
      `%%Page: ${page + 1} ${page + 1}`,
      "%%BeginPageSetup",
      "gsave",
      "%%EndPageSetup",
      canvas.finish(),
      "grestore",
      "showpage",
      "%%PageTrailer",
    );
  }
  lines.push("%%Trailer", `%%Pages: ${options.pages.length}`, "%%EOF", "");
  return ascii(lines.join("\n"));
}

class PostScriptCanvas extends VectorGraphicsCanvas {
  readonly #commands: string[] = [];

  public constructor(private readonly options: PostScriptRenderOptions) {
    super(options);
    const background = parseColour(options.background);
    if (background[3] > 0) {
      this.requireOpaque(background, "page background");
      this.#commands.push(
        `gsave ${psColour(background, options.colorModel)} newpath 0 0 moveto ${fixed(options.pageWidth)} 0 lineto ${fixed(options.pageWidth)} ${fixed(options.pageHeight)} lineto 0 ${fixed(options.pageHeight)} lineto closepath fill grestore`,
      );
    }
  }

  public finish(): string {
    return this.#commands.join("\n");
  }

  private requireOpaque(colour: Rgba, surface: string): void {
    if (colour[3] !== 0 && colour[3] !== 255) {
      unsupported(
        this.options,
        `postscript() cannot encode semi-transparent ${surface}; PostScript has no alpha channel.`,
      );
    }
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
    this.requireOpaque(colour, "stroke");
    this.#commands.push(
      `gsave ${psColour(colour, this.options.colorModel)} ${fixed(Math.max(0.01, width * 0.75))} setlinewidth ${psLineCap(lineCap)} setlinecap ${psDash(lineType, width)} newpath ${fixed(x0)} ${fixed(y0)} moveto ${fixed(x1)} ${fixed(y1)} lineto stroke grestore`,
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
    if (points.length < 2) return;
    const fill = parseColour(fillSource);
    const border = parseColour(borderSource);
    this.requireOpaque(fill, "fill");
    this.requireOpaque(border, "stroke");
    const path = psPath(points);
    const commands = ["gsave", "newpath", path];
    if (fill[3] > 0) {
      commands.push(
        "gsave",
        psColour(fill, this.options.colorModel),
        fillRule === "evenodd" || this.options.fillOddEven ? "eofill" : "fill",
        "grestore",
      );
    }
    if (border[3] > 0 && lineType !== "blank") {
      commands.push(
        psColour(border, this.options.colorModel),
        `${fixed(Math.max(0.01, width * 0.75))} setlinewidth`,
        psDash(lineType, width),
        "stroke",
      );
    } else {
      commands.push("newpath");
    }
    commands.push("grestore");
    this.#commands.push(commands.join(" "));
  }

  protected circle(
    x: number,
    y: number,
    radius: number,
    fillSource: string,
    borderSource: string,
    width: number,
  ): void {
    const fill = parseColour(fillSource);
    const border = parseColour(borderSource);
    this.requireOpaque(fill, "fill");
    this.requireOpaque(border, "stroke");
    if (fill[3] === 0 && border[3] === 0) return;
    const commands = [
      "gsave",
      `newpath ${fixed(x)} ${fixed(y)} ${fixed(radius)} 0 360 arc closepath`,
    ];
    if (fill[3] > 0) {
      commands.push("gsave", psColour(fill, this.options.colorModel), "fill", "grestore");
    }
    if (border[3] > 0) {
      commands.push(
        psColour(border, this.options.colorModel),
        `${fixed(Math.max(0.01, width * 0.75))} setlinewidth stroke`,
      );
    }
    commands.push("grestore");
    this.#commands.push(commands.join(" "));
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
    this.requireOpaque(colour, "text");
    const size = Math.max(0.1, this.options.pointsize * scale);
    const width = label.length * size * 0.52;
    const originX = -horizontalAdjustment * width;
    const originY = -verticalAdjustment * size * 0.8;
    this.#commands.push(
      `gsave ${psColour(colour, this.options.colorModel)} ${fixed(x)} ${fixed(y)} translate ${fixed(rotation)} rotate F${font} findfont ${fixed(size)} scalefont setfont ${fixed(originX)} ${fixed(originY)} moveto ${psString(label)} show grestore`,
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
    const hatch = parseColour(polygon.hatch.color);
    this.requireOpaque(hatch, "hatch");
    if (hatch[3] > 0 && points.length >= 3) {
      const lines = polygonHatchSegments(points, polygon.hatch.density, polygon.hatch.angle, 72)
        .map(
          ([start, end]) =>
            `${fixed(start[0])} ${fixed(start[1])} moveto ${fixed(end[0])} ${fixed(end[1])} lineto`,
        )
        .join(" ");
      this.#commands.push(
        `gsave newpath ${psPath(points)} ${polygon.fillRule === "evenodd" || this.options.fillOddEven ? "eoclip" : "clip"} newpath ${psColour(hatch, this.options.colorModel)} ${fixed(Math.max(0.01, polygon.lineWidth * 0.75))} setlinewidth [] 0 setdash ${lines} stroke grestore`,
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
    const background = parseColour(this.options.background);
    const rgb = new Uint8Array(event.width * event.height * 3);
    for (let pixel = 0; pixel < event.width * event.height; pixel += 1) {
      if ((pixel & 1023) === 0) this.options.checkpoint();
      const source = pixel * 4;
      const target = pixel * 3;
      const alphaByte = event.rgba[source + 3] ?? 255;
      if (alphaByte !== 255 && background[3] !== 255) {
        unsupported(
          this.options,
          "postscript() cannot encode a semi-transparent raster over a transparent page.",
        );
      }
      const alpha = alphaByte / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        rgb[target + channel] = Math.round(
          (event.rgba[source + channel] ?? 0) * alpha + (background[channel] ?? 0) * (1 - alpha),
        );
      }
    }
    this.#commands.push(
      [
        "gsave",
        `[${fixed(width * cosine)} ${fixed(width * sine)} ${fixed(-height * sine)} ${fixed(height * cosine)} ${fixed(x0)} ${fixed(y0)}] concat`,
        `/NRpicstr ${event.width * 3} string def`,
        `${event.width} ${event.height} 8 [${event.width} 0 0 -${event.height} 0 ${event.height}]`,
        "{ currentfile NRpicstr readhexstring pop } false 3 colorimage",
        hex(rgb),
        "grestore",
      ].join("\n"),
    );
  }
}

function unsupported(options: PostScriptRenderOptions, message: string): never {
  if (options.unsupported !== undefined) return options.unsupported(message);
  throw new Error(message);
}

function psPath(points: readonly (readonly [number, number])[]): string {
  const paths: Array<Array<readonly [number, number]>> = [[]];
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      if ((paths.at(-1)?.length ?? 0) > 0) paths.push([]);
      continue;
    }
    paths.at(-1)!.push(point);
  }
  return paths
    .filter((path) => path.length >= 2)
    .flatMap((path) => [
      `${fixed(path[0]?.[0] ?? 0)} ${fixed(path[0]?.[1] ?? 0)} moveto`,
      ...path.slice(1).map(([x, y]) => `${fixed(x)} ${fixed(y)} lineto`),
      "closepath",
    ])
    .join(" ");
}

function psColour(colour: Rgba, model: PostScriptRenderOptions["colorModel"]): string {
  const red = colour[0] / 255;
  const green = colour[1] / 255;
  const blue = colour[2] / 255;
  if (model === "gray") {
    return `${fixed(red * 0.2126 + green * 0.7152 + blue * 0.0722)} setgray`;
  }
  if (model === "cmyk") {
    const black = 1 - Math.max(red, green, blue);
    const denominator = 1 - black;
    const cyan = denominator === 0 ? 0 : (1 - red - black) / denominator;
    const magenta = denominator === 0 ? 0 : (1 - green - black) / denominator;
    const yellow = denominator === 0 ? 0 : (1 - blue - black) / denominator;
    return `${fixed(cyan)} ${fixed(magenta)} ${fixed(yellow)} ${fixed(black)} setcmykcolor`;
  }
  return `${fixed(red)} ${fixed(green)} ${fixed(blue)} setrgbcolor`;
}

function psDash(lineType: string, width: number): string {
  if (lineType === "solid" || lineType === "blank") return "[] 0 setdash";
  const pattern = [...lineType].map(
    (digit) => Number.parseInt(digit, 16) * Math.max(0.75, width * 0.75),
  );
  return `[${pattern.map(fixed).join(" ")}] 0 setdash`;
}

function psLineCap(lineCap: "round" | "butt" | "square"): number {
  return lineCap === "butt" ? 0 : lineCap === "round" ? 1 : 2;
}

function dscText(value: string): string {
  return value.replace(/[\r\n\f]/gu, " ").replace(/[^\x20-\x7e]/gu, "?");
}
