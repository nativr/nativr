import { describe, expect, it } from "vitest";

import { renderGraphicsSvg } from "../src/svg-device.js";

describe("browser-owned SVG renderer", () => {
  it("renders the resolved R line-end style on open segments", () => {
    const svg = new TextDecoder().decode(
      renderGraphicsSvg({
        width: 100,
        height: 100,
        background: "#FFFFFF00",
        pointsize: 12,
        family: "sans",
        checkpoint: () => undefined,
        events: [
          { kind: "window", xlim: [0, 1], ylim: [0, 1] },
          {
            kind: "segments",
            segments: [
              {
                x0: 0,
                y0: 0,
                x1: 1,
                y1: 1,
                color: "#000000FF",
                lineType: "solid",
                lineWidth: 2,
                lineCap: "butt",
              },
            ],
          },
        ],
      }),
    );
    expect(svg).toContain('stroke-linecap="butt"');
  });

  it("maps compound even-odd polygons into the active normalized viewport", () => {
    const svg = new TextDecoder().decode(
      renderGraphicsSvg({
        width: 100,
        height: 100,
        background: "#FFFFFF00",
        pointsize: 12,
        family: "sans",
        checkpoint: () => undefined,
        events: [
          { kind: "window", xlim: [0, 1], ylim: [0, 1], viewport: [0.2, 0.4, 0.3, 0.6] },
          {
            kind: "polygon",
            polygons: [
              {
                x: [0, 1, 1, 0, Number.NaN, 0.25, 0.75, 0.75, 0.25],
                y: [0, 0, 1, 1, Number.NaN, 0.25, 0.25, 0.75, 0.75],
                fill: "#FF0000FF",
                border: "#FFFFFF00",
                lineType: "blank",
                lineWidth: 1,
                fillRule: "evenodd",
              },
            ],
          },
        ],
      }),
    );
    expect(svg).toContain(
      'd="M 20,70 L 40,70 L 40,40 L 20,40 Z M 25,62.5 L 35,62.5 L 35,47.5 L 25,47.5 Z"',
    );
    expect(svg).toContain('fill="#FF0000"');
    expect(svg).toContain('fill-rule="evenodd"');
  });
});
