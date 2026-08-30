import type {
  RGraphicsEvent,
  RGraphicsPoint,
  RGraphicsPolygon,
  RGraphicsText,
} from "@nativr/runtime";

export interface SvgRenderOptions {
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly pointsize: number;
  readonly family: string;
  readonly events: readonly RGraphicsEvent[];
  readonly checkpoint: () => void;
  readonly unsupported?: (message: string) => never;
}

interface SvgWindow {
  xlim: readonly [number, number];
  ylim: readonly [number, number];
  viewport?: readonly [number, number, number, number];
}

/** Encode the owned graphics journal as a standalone UTF-8 SVG document. */
export function renderGraphicsSvg(options: SvgRenderOptions): Uint8Array {
  const body: string[] = [];
  let window: SvgWindow = { xlim: [0, 1], ylim: [0, 1] };
  const x = (value: number): number => {
    const viewport = window.viewport ?? [0, 1, 0, 1];
    return (
      (viewport[0] +
        ((value - window.xlim[0]) / (window.xlim[1] - window.xlim[0])) *
          (viewport[1] - viewport[0])) *
      options.width
    );
  };
  const y = (value: number): number => {
    const viewport = window.viewport ?? [0, 1, 0, 1];
    return (
      (1 -
        viewport[2] -
        ((value - window.ylim[0]) / (window.ylim[1] - window.ylim[0])) *
          (viewport[3] - viewport[2])) *
      options.height
    );
  };

  const background = svgPaint(options.background);
  if (background.opacity > 0) {
    body.push(
      `<rect x="0" y="0" width="${fixed(options.width)}" height="${fixed(options.height)}" fill="${background.colour}"${opacityAttribute("fill", background.opacity)}/>`,
    );
  }

  for (const event of options.events) {
    options.checkpoint();
    switch (event.kind) {
      case "new-page":
        break;
      case "window":
        window = event;
        break;
      case "segments":
        for (const segment of event.segments) {
          const stroke = svgPaint(segment.color);
          if (stroke.opacity === 0 || segment.lineType === "blank") continue;
          body.push(
            `<line x1="${fixed(x(segment.x0))}" y1="${fixed(y(segment.y0))}" x2="${fixed(x(segment.x1))}" y2="${fixed(y(segment.y1))}" ${strokeAttributes(stroke, segment.lineWidth, segment.lineType, segment.lineCap)}/>`,
          );
        }
        break;
      case "points":
        for (const point of event.points) body.push(renderPoint(point, x, y, options));
        break;
      case "text":
        for (const label of event.labels) body.push(renderText(label, x, y, options));
        break;
      case "polygon":
        for (const polygon of event.polygons) body.push(renderPolygon(polygon, x, y, options));
        break;
      case "box": {
        const [x0, x1] = window.xlim;
        const [y0, y1] = window.ylim;
        const edges = new Map([
          ["top", [x0, y1, x1, y1]],
          ["right", [x1, y0, x1, y1]],
          ["bottom", [x0, y0, x1, y0]],
          ["left", [x0, y0, x0, y1]],
        ] as const);
        const stroke = svgPaint(event.color);
        if (stroke.opacity === 0 || event.lineType === "blank") break;
        for (const edge of event.edges) {
          const coordinates = edges.get(edge)!;
          body.push(
            `<line x1="${fixed(x(coordinates[0]))}" y1="${fixed(y(coordinates[1]))}" x2="${fixed(x(coordinates[2]))}" y2="${fixed(y(coordinates[3]))}" ${strokeAttributes(stroke, event.lineWidth, event.lineType)}/>`,
          );
        }
        break;
      }
      case "raster":
        return unsupported(
          options,
          "svg() raster embedding is outside the current browser vector-device subset.",
        );
      case "boxplot":
      case "legend":
        return unsupported(
          options,
          `svg() ${event.kind} journal commands await the wider browser vector-device subset.`,
        );
    }
  }

  const document = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fixed(options.width / 72)}in" height="${fixed(options.height / 72)}in" viewBox="0 0 ${fixed(options.width)} ${fixed(options.height)}">`,
    ...body,
    "</svg>",
    "",
  ].join("\n");
  return encodeUtf8(document);
}

function encodeUtf8(source: string): Uint8Array {
  const Encoder = (
    globalThis as typeof globalThis & {
      readonly TextEncoder: new () => { readonly encode: (input: string) => Uint8Array };
    }
  ).TextEncoder;
  return new Encoder().encode(source);
}

interface SvgPaint {
  readonly colour: string;
  readonly opacity: number;
}

function svgPaint(source: string): SvgPaint {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})$/iu.exec(source);
  if (match === null) return { colour: source, opacity: source === "transparent" ? 0 : 1 };
  return {
    colour: `#${match[1]}`,
    opacity: Number.parseInt(match[2] ?? "ff", 16) / 255,
  };
}

function opacityAttribute(target: "fill" | "stroke", opacity: number): string {
  return opacity >= 1 ? "" : ` ${target}-opacity="${fixed(opacity)}"`;
}

function strokeAttributes(
  paint: SvgPaint,
  width: number,
  lineType: string,
  lineCap?: "round" | "butt" | "square",
): string {
  const dash = svgDash(lineType, width);
  const cap = lineCap === undefined ? "" : ` stroke-linecap="${lineCap}"`;
  return `stroke="${paint.colour}"${opacityAttribute("stroke", paint.opacity)} stroke-width="${fixed(Math.max(0.01, width * 0.75))}"${cap}${dash} fill="none"`;
}

function svgDash(lineType: string, width: number): string {
  if (lineType === "solid") return "";
  const digits = [...lineType].map((digit) => Number.parseInt(digit, 16));
  if (digits.some((digit) => !Number.isFinite(digit))) return "";
  return ` stroke-dasharray="${digits.map((digit) => fixed(Math.max(1, digit) * Math.max(0.75, width))).join(" ")}"`;
}

function renderPolygon(
  polygon: RGraphicsPolygon,
  x: (value: number) => number,
  y: (value: number) => number,
  options: SvgRenderOptions,
): string {
  if (polygon.hatch !== undefined) {
    unsupported(options, "svg() density hatching awaits the wider browser vector-device subset.");
  }
  const fill = svgPaint(polygon.fill);
  const stroke = svgPaint(polygon.border);
  const rings: string[][] = [[]];
  for (let index = 0; index < Math.min(polygon.x.length, polygon.y.length); index += 1) {
    const sourceX = polygon.x[index]!;
    const sourceY = polygon.y[index]!;
    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
      if ((rings.at(-1)?.length ?? 0) > 0) rings.push([]);
      continue;
    }
    rings.at(-1)!.push(`${fixed(x(sourceX))},${fixed(y(sourceY))}`);
  }
  const path = rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => `M ${ring.join(" L ")} Z`)
    .join(" ");
  const strokePart =
    stroke.opacity === 0 || polygon.lineType === "blank"
      ? 'stroke="none"'
      : strokeAttributes(stroke, polygon.lineWidth, polygon.lineType).replace(' fill="none"', "");
  return `<path d="${path}" fill="${fill.colour}"${opacityAttribute("fill", fill.opacity)} ${strokePart} fill-rule="${polygon.fillRule}"/>`;
}

function unsupported(options: SvgRenderOptions, message: string): never {
  if (options.unsupported !== undefined) return options.unsupported(message);
  throw new Error(message);
}

function renderPoint(
  point: RGraphicsPoint,
  x: (value: number) => number,
  y: (value: number) => number,
  options: SvgRenderOptions,
): string {
  const px = x(point.x);
  const py = y(point.y);
  const stroke = svgPaint(point.color);
  const fill = svgPaint(point.fill);
  const radius = Math.max(1, point.size * options.pointsize * 0.22);
  if (typeof point.symbol === "string") {
    return `<text x="${fixed(px)}" y="${fixed(py)}" text-anchor="middle" dominant-baseline="middle" fill="${stroke.colour}"${opacityAttribute("fill", stroke.opacity)} font-family="${xml(options.family)}" font-size="${fixed(point.size * options.pointsize)}">${xml(point.symbol)}</text>`;
  }
  if (point.symbol === 21 || point.symbol === 19 || point.symbol === 16 || point.symbol === 1) {
    const selectedFill =
      point.symbol === 1 ? { colour: "none", opacity: 1 } : point.symbol === 21 ? fill : stroke;
    return `<circle cx="${fixed(px)}" cy="${fixed(py)}" r="${fixed(radius)}" fill="${selectedFill.colour}"${opacityAttribute("fill", selectedFill.opacity)} stroke="${stroke.colour}"${opacityAttribute("stroke", stroke.opacity)} stroke-width="${fixed(Math.max(0.01, point.lineWidth * 0.75))}"/>`;
  }
  const size = radius * 1.8;
  return `<path d="M ${fixed(px - size)} ${fixed(py)} L ${fixed(px + size)} ${fixed(py)} M ${fixed(px)} ${fixed(py - size)} L ${fixed(px)} ${fixed(py + size)}" ${strokeAttributes(stroke, point.lineWidth, "solid")}/>`;
}

function renderText(
  label: RGraphicsText,
  x: (value: number) => number,
  y: (value: number) => number,
  options: SvgRenderOptions,
): string {
  const paint = svgPaint(label.color);
  const anchor =
    label.horizontalAdjustment <= 0.25
      ? "start"
      : label.horizontalAdjustment >= 0.75
        ? "end"
        : "middle";
  const style =
    label.font === 2
      ? ' font-weight="bold"'
      : label.font === 3
        ? ' font-style="italic"'
        : label.font === 4
          ? ' font-weight="bold" font-style="italic"'
          : "";
  const px = x(label.x);
  const py = y(label.y);
  const transform =
    label.rotation === 0
      ? ""
      : ` transform="rotate(${fixed(-label.rotation)} ${fixed(px)} ${fixed(py)})"`;
  return `<text x="${fixed(px)}" y="${fixed(py)}" text-anchor="${anchor}" dominant-baseline="middle" fill="${paint.colour}"${opacityAttribute("fill", paint.opacity)} font-family="${xml(label.family || options.family)}" font-size="${fixed(label.size * options.pointsize)}"${style}${transform}>${xml(label.label)}</text>`;
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fixed(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
