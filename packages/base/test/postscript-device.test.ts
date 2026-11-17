import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { RGraphicsEvent } from "@nativr/runtime";
import {
  renderGraphicsPostScript,
  type PostScriptRenderOptions,
} from "../src/postscript-device.js";

describe("browser-owned PostScript renderer", () => {
  it("serializes every owned graphics event into genuine multi-page DSC PostScript", () => {
    const checkpoint = vi.fn();
    const bytes = renderGraphicsPostScript(
      options({
        title: "NativR (PS) é 你\nplot",
        background: "#FFFFFFFF",
        pages: [graphicsEvents(), [{ kind: "new-page" }]],
        checkpoint,
      }),
    );
    const text = new TextDecoder().decode(bytes);

    expect(text.startsWith("%!PS-Adobe-3.0\n")).toBe(true);
    expect(text).toContain("%%LanguageLevel: 2");
    expect(text).toContain("%%BoundingBox: 0 0 216 144");
    expect(text).toContain("%%Title: NativR (PS) ? ? plot");
    expect(text).toContain("/F1 /Helvetica def");
    expect(text).toContain("/F4 /Helvetica-BoldOblique def");
    expect(text).toContain("%%Page: 1 1");
    expect(text).toContain("%%Page: 2 2");
    expect(text).toContain("setrgbcolor");
    expect(text).toContain("setdash");
    expect(text).toContain("eofill");
    expect(text).toContain("eoclip");
    expect(text).toContain("colorimage");
    expect(text).toContain("(font 4) show");
    expect(text).toContain("showpage");
    expect(text).toContain("%%Trailer\n%%Pages: 2\n%%EOF\n");
    expect(checkpoint).toHaveBeenCalled();
  });

  it("selects standard serif and mono fonts and supported color models", () => {
    const serif = new TextDecoder().decode(
      renderGraphicsPostScript(
        options({
          family: "serif",
          colorModel: "gray",
          pages: [graphicsEvents().slice(0, 5)],
        }),
      ),
    );
    expect(serif).toContain("/F1 /Times-Roman def");
    expect(serif).toContain("setgray");

    const mono = new TextDecoder().decode(
      renderGraphicsPostScript(
        options({
          family: "mono",
          colorModel: "cmyk",
          pages: [graphicsEvents().slice(0, 5)],
        }),
      ),
    );
    expect(mono).toContain("/F1 /Courier def");
    expect(mono).toContain("setcmykcolor");
  });

  it("fails deterministically for vector alpha that PostScript cannot represent", () => {
    expect(() =>
      renderGraphicsPostScript(
        options({
          pages: [
            [
              { kind: "new-page" },
              { kind: "window", xlim: [0, 1], ylim: [0, 1] },
              {
                kind: "segments",
                segments: [
                  {
                    x0: 0,
                    y0: 0,
                    x1: 1,
                    y1: 1,
                    color: "#FF000080",
                    lineType: "solid",
                    lineWidth: 1,
                  },
                ],
              },
            ],
          ],
        }),
      ),
    ).toThrow(/PostScript has no alpha channel/u);
  });

  it.runIf(process.env.NATIVR_PS2PDF !== undefined)(
    "is accepted by an independent PostScript interpreter when explicitly available",
    () => {
      const directory = mkdtempSync(path.join(tmpdir(), "nativr-postscript-"));
      const source = path.join(directory, "probe.ps");
      const output = path.join(directory, "probe.pdf");
      try {
        writeFileSync(
          source,
          renderGraphicsPostScript(options({ background: "#FFFFFFFF", pages: [graphicsEvents()] })),
        );
        const result = spawnSync(process.env.NATIVR_PS2PDF, [source, output], {
          encoding: "utf8",
        });
        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
        expect(existsSync(output)).toBe(true);
        expect(readFileSync(output).subarray(0, 5).toString("ascii")).toBe("%PDF-");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});

function options(overrides: Partial<PostScriptRenderOptions>): PostScriptRenderOptions {
  return {
    pageWidth: 216,
    pageHeight: 144,
    region: { x: 12, y: 10, width: 192, height: 124 },
    background: "#FFFFFF00",
    pointsize: 12,
    family: "sans",
    title: "R Graphics Output",
    colorModel: "srgb",
    fillOddEven: false,
    pages: [[]],
    checkpoint: () => undefined,
    ...overrides,
  };
}

function graphicsEvents(): RGraphicsEvent[] {
  return [
    { kind: "new-page" },
    { kind: "window", xlim: [0, 1], ylim: [0, 1] },
    {
      kind: "segments",
      segments: [{ x0: 0, y0: 0, x1: 1, y1: 1, color: "#FF0000FF", lineType: "44", lineWidth: 2 }],
    },
    {
      kind: "points",
      points: [
        {
          x: 0.2,
          y: 0.8,
          symbol: 16,
          color: "#102030FF",
          fill: "#80C040FF",
          size: 1,
          lineWidth: 1,
        },
        {
          x: 0.3,
          y: 0.8,
          symbol: 17,
          color: "#102030FF",
          fill: "#80C040FF",
          size: 1,
          lineWidth: 1,
        },
        {
          x: 0.4,
          y: 0.8,
          symbol: "A",
          color: "#102030FF",
          fill: "#80C040FF",
          size: 1,
          lineWidth: 1,
        },
      ],
    },
    {
      kind: "text",
      labels: [1, 2, 3, 4].map((font, index) => ({
        x: 0.2 + index * 0.15,
        y: 0.6,
        label: `font ${font}`,
        color: "#000000FF",
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
          y: [0.1, 0.4, 0.1],
          fill: "#0080FFFF",
          border: "#002040FF",
          lineType: "13",
          lineWidth: 1.5,
          fillRule: "evenodd",
          hatch: { color: "#FF0000FF", density: 10, angle: 30 },
        },
      ],
    },
    {
      kind: "raster",
      rgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]),
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
    {
      kind: "boxplot",
      horizontal: false,
      notch: true,
      groups: [
        {
          label: "g",
          center: 0.8,
          width: 0.12,
          stats: [0.1, 0.25, 0.45, 0.65, 0.9],
          confidence: [0.38, 0.52],
          outliers: [0.02, 0.97],
          border: "#202020FF",
          fill: "#C0C0C0FF",
          lineType: "solid",
          lineWidth: 1,
        },
      ],
    },
    {
      kind: "legend",
      position: { kind: "keyword", value: "topleft", inset: [0.01, 0.01] },
      entries: [
        {
          label: "line",
          textColor: "#000000FF",
          color: "#FF00FFFF",
          fill: "#FF0000FF",
          border: "#000000FF",
          lineType: "44",
          lineWidth: 1,
          pointSymbol: "1",
        },
      ],
      box: true,
      background: "#FFFFFFFF",
      columns: 1,
      cex: 0.6,
      textAdjustment: [0.25, 0.75],
      title: "Key",
    },
  ];
}
