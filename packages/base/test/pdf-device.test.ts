import { describe, expect, it, vi } from "vitest";

import type { RGraphicsEvent, RGraphicsLegendPosition } from "@nativr/runtime";
import { renderGraphicsPdf, type PdfRenderOptions } from "../src/pdf-device.js";

describe("browser-owned PDF renderer", () => {
  it("serializes every owned graphics event into a valid multi-page PDF", async () => {
    const checkpoint = vi.fn();
    const pdf = await renderGraphicsPdf(
      options({
        family: "sans",
        colorModel: "srgb",
        background: "#FFFFFFFF",
        title: "NativR (PDF) \\ é 你",
        author: "browser",
        producer: true,
        timestamp: true,
        compress: false,
        pages: [graphicsEvents(), [{ kind: "new-page" }]],
        checkpoint,
      }),
    );
    const text = new TextDecoder("windows-1252").decode(pdf);
    expect(text.startsWith("%PDF-1.4\n%NativR\n")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("/BaseFont /Helvetica-BoldOblique");
    expect(text).toContain("/MediaBox [0 0 216 144]");
    expect(text).toContain("/Title (NativR \\(PDF\\) \\\\ \\351 ?)");
    expect(text).toContain("/Author (browser)");
    expect(text).toContain("/Producer (NativR browser-native PDF device)");
    expect(text).toContain("/CreationDate (D:");
    expect(text).toContain("/ExtGState");
    expect(text).toContain("BI /W 2 /H 2 /CS /RGB /BPC 8 /F /AHx ID");
    expect(text).toContain("B*");
    expect(text).toContain("xref\n");
    expect(text.endsWith("%%EOF\n")).toBe(true);
    const xrefOffset = Number(/startxref\n(\d+)\n%%EOF\n$/u.exec(text)?.[1]);
    expect(text.slice(xrefOffset, xrefOffset + 4)).toBe("xref");
    expect(checkpoint).toHaveBeenCalled();
  });

  it("selects standard serif and mono fonts, color models, and compressed streams", async () => {
    const serif = await renderGraphicsPdf(
      options({
        family: "serif",
        colorModel: "gray",
        background: "not-a-colour",
        title: "",
        author: "",
        producer: false,
        timestamp: false,
        compress: true,
        pages: [graphicsEvents().slice(0, 5)],
      }),
    );
    const serifText = new TextDecoder("windows-1252").decode(serif);
    expect(serifText).toContain("/BaseFont /Times-Roman");
    expect(serifText).toContain("/Filter /FlateDecode");
    expect(serifText).not.toContain("/Title");
    expect(serifText).not.toContain("/Author");
    expect(serifText).not.toContain("/Producer");
    expect(serifText).not.toContain("/CreationDate");
    const stream = await inflateFirstStream(serif);
    expect(stream).toContain(" G");

    const mono = new TextDecoder().decode(
      await renderGraphicsPdf(
        options({
          family: "mono",
          colorModel: "cmyk",
          background: "#00000000",
          compress: false,
          pages: [graphicsEvents().slice(0, 7)],
        }),
      ),
    );
    expect(mono).toContain("/BaseFont /Courier");
    expect(mono).toMatch(/\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? K/u);
  });
});

function options(overrides: Partial<PdfRenderOptions>): PdfRenderOptions {
  return {
    pageWidth: 216,
    pageHeight: 144,
    region: { x: 12, y: 10, width: 192, height: 124 },
    background: "#FFFFFF00",
    pointsize: 12,
    family: "sans",
    title: "R Graphics Output",
    author: "",
    version: "1.4",
    colorModel: "srgb",
    compress: false,
    timestamp: false,
    producer: false,
    pages: [[]],
    checkpoint: () => undefined,
    ...overrides,
  };
}

function graphicsEvents(): RGraphicsEvent[] {
  const points = Array.from({ length: 26 }, (_, symbol) => ({
    x: 0.05 + (symbol % 13) * 0.07,
    y: symbol < 13 ? 0.82 : 0.68,
    symbol,
    color: "#102030FF",
    fill: "#80C040C0",
    size: 0.7,
    lineWidth: 1,
  }));
  const legendPositions: RGraphicsLegendPosition[] = [
    { kind: "keyword", value: "topleft", inset: [0.01, 0.01] },
    { kind: "keyword", value: "top", inset: [0.01, 0.01] },
    { kind: "keyword", value: "topright", inset: [0.01, 0.01] },
    { kind: "keyword", value: "bottomleft", inset: [0.01, 0.01] },
    { kind: "keyword", value: "bottom", inset: [0.01, 0.01] },
    { kind: "keyword", value: "bottomright", inset: [0.01, 0.01] },
    { kind: "keyword", value: "left", inset: [0.01, 0.01] },
    { kind: "keyword", value: "center", inset: [0.01, 0.01] },
    { kind: "keyword", value: "right", inset: [0.01, 0.01] },
    { kind: "coordinates", x: 0.05, y: 0.45 },
  ];
  return [
    { kind: "new-page" },
    { kind: "window", xlim: [0, 1], ylim: [0, 1] },
    {
      kind: "segments",
      segments: [
        { x0: 0, y0: 0, x1: 1, y1: 1, color: "#FF0000FF", lineType: "44", lineWidth: 2 },
        { x0: 0, y0: 1, x1: 1, y1: 0, color: "#00000000", lineType: "blank", lineWidth: 1 },
      ],
    },
    { kind: "points", points: [...points, { ...points[0]!, symbol: "A", x: 0.95 }] },
    {
      kind: "text",
      labels: [1, 2, 3, 4].map((font, index) => ({
        x: 0.25 + index * 0.15,
        y: 0.52,
        label: index === 0 ? "" : `font ${font}`,
        color: index === 0 ? "#00000000" : "#000000FF",
        size: 0.8,
        font: font as 1 | 2 | 3 | 4,
        family: "sans",
        rotation: index * 15,
        horizontalAdjustment: 0.5,
        verticalAdjustment: 0.5,
        offset: 0.5,
      })),
    },
    {
      kind: "polygon",
      polygons: [
        {
          x: [0.3, 0.5, 0.7],
          y: [0.1, 0.35, 0.1],
          fill: "#0080FF80",
          border: "#002040FF",
          lineType: "13",
          lineWidth: 1.5,
          fillRule: "evenodd",
        },
        {
          x: [0.1, 0.2, 0.15],
          y: [0.3, 0.3, 0.4],
          fill: "#00000000",
          border: "#202020FF",
          lineType: "solid",
          lineWidth: 1,
          fillRule: "nonzero",
        },
      ],
    },
    {
      kind: "raster",
      rgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 180, 0, 0, 255, 0, 255, 255, 0, 255]),
      width: 2,
      height: 2,
      xleft: 0.05,
      ybottom: 0.05,
      xright: 0.25,
      ytop: 0.25,
      angle: 15,
      interpolate: false,
    },
    {
      kind: "box",
      edges: ["top", "right", "bottom", "left"],
      color: "#202020FF",
      lineType: "solid",
      lineWidth: 1,
    },
    { kind: "boxplot", horizontal: false, notch: true, groups: [boxplotGroup(0.82)] },
    { kind: "boxplot", horizontal: true, notch: false, groups: [boxplotGroup(0.18)] },
    ...legendPositions.map((position, index): RGraphicsEvent => ({
      kind: "legend",
      position,
      entries: [
        {
          label: "line",
          textColor: "#000000FF",
          color: "#FF00FFFF",
          lineType: index % 2 === 0 ? "44" : undefined,
          lineWidth: 1,
          pointSymbol: index % 2 === 0 ? "1" : undefined,
        },
      ],
      box: index % 2 === 0,
      background: index % 2 === 0 ? "#FFFFFFFF" : "#00000000",
      columns: 1,
      cex: 0.6,
      title: index === 0 ? "Key" : undefined,
    })),
  ];
}

function boxplotGroup(center: number) {
  return {
    label: "g",
    center,
    width: 0.12,
    stats: [0.1, 0.25, 0.45, 0.65, 0.9] as const,
    confidence: [0.38, 0.52] as const,
    outliers: [0.02, 0.97],
    border: "#202020FF",
    fill: "#C0C0C080",
    lineType: "solid",
    lineWidth: 1,
  };
}

async function inflateFirstStream(pdf: Uint8Array): Promise<string> {
  const streamMarker = new TextEncoder().encode("stream\n");
  const endMarker = new TextEncoder().encode("\nendstream");
  const start = findBytes(pdf, streamMarker);
  const end = findBytes(pdf, endMarker, start + streamMarker.length);
  const bytes = new Uint8Array(
    await new Response(
      new Blob([pdf.slice(start + streamMarker.length, end)])
        .stream()
        .pipeThrough(new DecompressionStream("deflate")),
    ).arrayBuffer(),
  );
  return new TextDecoder().decode(bytes);
}

function findBytes(source: Uint8Array, needle: Uint8Array, start = 0): number {
  outer: for (let index = start; index <= source.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (source[index + offset] !== needle[offset]) continue outer;
    }
    return index;
  }
  return -1;
}
