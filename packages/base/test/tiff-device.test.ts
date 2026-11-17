import { describe, expect, it, vi } from "vitest";

import { renderGraphicsTiff } from "../src/tiff-device.js";

describe("browser-owned TIFF renderer", () => {
  it("encodes a standards-shaped uncompressed RGBA image and shared graphics journal", () => {
    const checkpoint = vi.fn();
    const tiff = renderGraphicsTiff({
      width: 16,
      height: 12,
      background: "#FFFFFFFF",
      pointsize: 12,
      resolution: 96,
      compression: "none",
      events: [
        { kind: "new-page" },
        { kind: "window", xlim: [0, 1], ylim: [0, 1] },
        {
          kind: "segments",
          segments: [
            { x0: 0, y0: 0, x1: 1, y1: 1, color: "#FF0000FF", lineType: "solid", lineWidth: 2 },
          ],
        },
      ],
      checkpoint,
    });

    expect([...tiff.slice(0, 4)]).toEqual([0x49, 0x49, 42, 0]);
    const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
    const ifd = view.getUint32(4, true);
    const entries = readEntries(view, ifd);
    expect(entries.get(256)).toMatchObject({ type: 4, count: 1, value: 16 });
    expect(entries.get(257)).toMatchObject({ type: 4, count: 1, value: 12 });
    expect(entries.get(258)).toMatchObject({ type: 3, count: 4 });
    expect(entries.get(259)).toMatchObject({ type: 3, count: 1, value: 1 });
    expect(entries.get(262)).toMatchObject({ type: 3, count: 1, value: 2 });
    expect(entries.get(277)).toMatchObject({ type: 3, count: 1, value: 4 });
    expect(entries.get(279)?.value).toBe(16 * 12 * 4);
    expect(entries.get(284)).toMatchObject({ type: 3, count: 1, value: 1 });
    expect(entries.get(296)).toMatchObject({ type: 3, count: 1, value: 2 });
    expect(entries.get(338)).toMatchObject({ type: 3, count: 1, value: 2 });
    const stripOffset = entries.get(273)?.value ?? 0;
    expect(tiff.byteLength - stripOffset).toBe(16 * 12 * 4);
    expect(
      Array.from({ length: 16 * 12 }, (_, index) => stripOffset + index * 4).some(
        (offset) =>
          tiff[offset] === 255 &&
          tiff[offset + 1] === 0 &&
          tiff[offset + 2] === 0 &&
          tiff[offset + 3] === 255,
      ),
    ).toBe(true);
    expect(checkpoint).toHaveBeenCalled();
  });

  it("encodes a TIFF LZW strip that independently decodes to the shared RGBA pixels", () => {
    const options = {
      width: 32,
      height: 24,
      background: "#FFFFFFFF",
      pointsize: 12,
      resolution: 72,
      events: [
        { kind: "new-page" as const },
        { kind: "window" as const, xlim: [0, 1] as const, ylim: [0, 1] as const },
        {
          kind: "segments" as const,
          segments: [
            {
              x0: 0,
              y0: 0,
              x1: 1,
              y1: 1,
              color: "#FF0000FF",
              lineType: "solid",
              lineWidth: 2,
            },
          ],
        },
      ],
      checkpoint: vi.fn(),
    };
    const uncompressed = renderGraphicsTiff({ ...options, compression: "none" });
    const compressed = renderGraphicsTiff({ ...options, compression: "lzw" });
    const plainEntries = readEntries(
      new DataView(uncompressed.buffer, uncompressed.byteOffset, uncompressed.byteLength),
      8,
    );
    const compressedView = new DataView(
      compressed.buffer,
      compressed.byteOffset,
      compressed.byteLength,
    );
    const compressedEntries = readEntries(compressedView, 8);
    expect(compressedEntries.get(259)?.value).toBe(5);
    const plainOffset = plainEntries.get(273)?.value ?? 0;
    const stripOffset = compressedEntries.get(273)?.value ?? 0;
    const stripLength = compressedEntries.get(279)?.value ?? 0;
    const decoded = decodeTiffLzw(compressed.slice(stripOffset, stripOffset + stripLength));
    expect(decoded).toEqual(uncompressed.slice(plainOffset));
    expect(stripLength).toBeLessThan(decoded.byteLength);
  });
});

function decodeTiffLzw(input: Uint8Array): Uint8Array {
  let bitOffset = 0;
  let codeWidth = 9;
  let nextCode = 258;
  let dictionary: Uint8Array[] = [];
  let previous: Uint8Array | undefined;
  const output: number[] = [];
  const reset = (): void => {
    dictionary = Array.from({ length: 256 }, (_, value) => Uint8Array.of(value));
    codeWidth = 9;
    nextCode = 258;
    previous = undefined;
  };
  const readCode = (): number => {
    let code = 0;
    for (let bit = 0; bit < codeWidth; bit += 1) {
      const position = bitOffset + bit;
      code = code * 2 + ((input[position >> 3]! >> (7 - (position & 7))) & 1);
    }
    bitOffset += codeWidth;
    return code;
  };
  reset();
  while (bitOffset + codeWidth <= input.byteLength * 8) {
    const code = readCode();
    if (code === 256) {
      reset();
      continue;
    }
    if (code === 257) break;
    const entry =
      dictionary[code] ??
      (code === nextCode && previous !== undefined
        ? Uint8Array.from([...previous, previous[0]!])
        : undefined);
    if (entry === undefined) throw new Error(`invalid TIFF LZW code ${code}`);
    output.push(...entry);
    if (previous !== undefined && nextCode <= 4095) {
      dictionary[nextCode] = Uint8Array.from([...previous, entry[0]!]);
      nextCode += 1;
      if (codeWidth < 12 && nextCode === 2 ** codeWidth - 1) codeWidth += 1;
    }
    previous = entry;
  }
  return Uint8Array.from(output);
}

interface Entry {
  readonly type: number;
  readonly count: number;
  readonly value: number;
}

function readEntries(view: DataView, ifd: number): ReadonlyMap<number, Entry> {
  const count = view.getUint16(ifd, true);
  const entries = new Map<number, Entry>();
  for (let index = 0; index < count; index += 1) {
    const offset = ifd + 2 + index * 12;
    const tag = view.getUint16(offset, true);
    const type = view.getUint16(offset + 2, true);
    const itemCount = view.getUint32(offset + 4, true);
    const value =
      type === 3 && itemCount === 1
        ? view.getUint16(offset + 8, true)
        : view.getUint32(offset + 8, true);
    entries.set(tag, { type, count: itemCount, value });
  }
  return entries;
}
