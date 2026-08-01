import { describe, expect, it, vi } from "vitest";

import type { RGraphicsEvent } from "@nativr/runtime";
import { renderGraphicsPng } from "../src/png-device.js";

describe("browser-owned PNG renderer", () => {
  it("renders every owned graphics event kind into a decodable RGBA image", async () => {
    const points = Array.from({ length: 26 }, (_, symbol) => ({
      x: 0.05 + (symbol % 13) * 0.07,
      y: symbol < 13 ? 0.82 : 0.68,
      symbol,
      color: "#102030FF",
      fill: "#80C040C0",
      size: 0.7,
      lineWidth: 1,
    }));
    const events: RGraphicsEvent[] = [
      { kind: "new-page" },
      { kind: "window", xlim: [0, 1], ylim: [0, 1] },
      {
        kind: "raster",
        rgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 180, 0, 0, 255, 255, 255, 255, 0, 255]),
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
        kind: "segments",
        segments: [
          { x0: 0, y0: 0, x1: 1, y1: 1, color: "#FF0000FF", lineType: "44", lineWidth: 2 },
          { x0: 0, y0: 1, x1: 1, y1: 0, color: "#00000000", lineType: "blank", lineWidth: 1 },
        ],
      },
      { kind: "points", points: [...points, { ...points[0]!, symbol: "A", x: 0.95 }] },
      {
        kind: "text",
        labels: [
          {
            x: 0.5,
            y: 0.52,
            label: "NativR 0.207!",
            color: "#000000FF",
            size: 0.8,
            font: 2,
            family: "sans",
            rotation: 22,
            horizontalAdjustment: 0.5,
            verticalAdjustment: 0.5,
            offset: 0.5,
          },
        ],
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
        ],
      },
      {
        kind: "box",
        edges: ["top", "right", "bottom", "left"],
        color: "#202020FF",
        lineType: "solid",
        lineWidth: 1,
      },
      {
        kind: "boxplot",
        horizontal: false,
        notch: true,
        groups: [boxplotGroup(0.82)],
      },
      {
        kind: "boxplot",
        horizontal: true,
        notch: false,
        groups: [boxplotGroup(0.18)],
      },
      {
        kind: "legend",
        position: { kind: "keyword", value: "topright", inset: [0.01, 0.01] },
        entries: [
          {
            label: "line",
            textColor: "#000000FF",
            color: "#FF00FFFF",
            lineType: "44",
            lineWidth: 1,
            pointSymbol: "1",
          },
        ],
        box: true,
        background: "#FFFFFFFF",
        columns: 1,
        cex: 0.6,
        title: "Key",
      },
      {
        kind: "legend",
        position: { kind: "coordinates", x: 0.05, y: 0.45 },
        entries: [{ label: "x", textColor: "#000000FF", color: "#00FFFFFF", pointSymbol: "A" }],
        box: false,
        background: "#00000000",
        columns: 1,
        cex: 0.5,
      },
    ];

    const png = await renderGraphicsPng({
      width: 96,
      height: 72,
      background: "#FFFFFF00",
      pointsize: 12,
      events,
      checkpoint: () => undefined,
    });
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(readUint32(png, 16)).toBe(96);
    expect(readUint32(png, 20)).toBe(72);
    const pixels = await decodeScanlines(png);
    expect(pixels).toHaveLength(72 * (96 * 4 + 1));
    expect(alphaValues(pixels, 96, 72).some((alpha) => alpha > 0)).toBe(true);
  });

  it("uses a valid stored-DEFLATE fallback when CompressionStream is unavailable", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    try {
      const png = await renderGraphicsPng({
        width: 3,
        height: 2,
        background: "not-a-css-colour",
        pointsize: 12,
        events: [{ kind: "new-page" }],
        checkpoint: () => undefined,
      });
      expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      const idat = pngChunks(png).filter((chunk) => chunk.type === "IDAT")[0]?.data;
      expect(idat?.slice(0, 2)).toEqual(new Uint8Array([0x78, 0x01]));
      expect(await decodeScanlines(png)).toHaveLength(2 * (3 * 4 + 1));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

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

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

function pngChunks(
  png: Uint8Array,
): readonly { readonly type: string; readonly data: Uint8Array }[] {
  const chunks: { type: string; data: Uint8Array }[] = [];
  let offset = 8;
  while (offset + 12 <= png.byteLength) {
    const length = readUint32(png, offset);
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: png.slice(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

async function decodeScanlines(png: Uint8Array): Promise<Uint8Array> {
  const chunks = pngChunks(png)
    .filter((chunk) => chunk.type === "IDAT")
    .map((chunk) => chunk.data);
  const compressed = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }
  return new Uint8Array(
    await new Response(
      new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate")),
    ).arrayBuffer(),
  );
}

function alphaValues(scanlines: Uint8Array, width: number, height: number): readonly number[] {
  return Array.from(
    { length: width * height },
    (_, index) => scanlines[index * 4 + Math.floor(index / width) + 4] ?? 0,
  );
}
