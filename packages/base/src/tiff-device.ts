import type { RGraphicsEvent } from "@nativr/runtime";

import { renderGraphicsRgba } from "./png-device.js";

export interface TiffRenderOptions {
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly pointsize: number;
  readonly resolution: number;
  readonly compression: "none" | "lzw";
  readonly events: readonly RGraphicsEvent[];
  readonly checkpoint: () => void;
}

interface TiffEntry {
  readonly tag: number;
  readonly type: 3 | 4 | 5;
  readonly count: number;
  readonly value: number;
}

/** Render one baseline little-endian RGBA TIFF using the shared bitmap journal. */
export function renderGraphicsTiff(options: TiffRenderOptions): Uint8Array {
  const rendered = renderGraphicsRgba(options);
  const strip =
    options.compression === "lzw"
      ? encodeTiffLzw(rendered.pixels, options.checkpoint)
      : rendered.pixels;
  const entryCount = 14;
  const ifdOffset = 8;
  const ifdBytes = 2 + entryCount * 12 + 4;
  const bitsOffset = ifdOffset + ifdBytes;
  const xResolutionOffset = bitsOffset + 8;
  const yResolutionOffset = xResolutionOffset + 8;
  const pixelOffset = yResolutionOffset + 8;
  const output = new Uint8Array(pixelOffset + strip.byteLength);
  const view = new DataView(output.buffer);

  output.set([0x49, 0x49]);
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOffset, true);
  view.setUint16(ifdOffset, entryCount, true);

  const entries: readonly TiffEntry[] = [
    { tag: 256, type: 4, count: 1, value: rendered.width },
    { tag: 257, type: 4, count: 1, value: rendered.height },
    { tag: 258, type: 3, count: 4, value: bitsOffset },
    { tag: 259, type: 3, count: 1, value: options.compression === "lzw" ? 5 : 1 },
    { tag: 262, type: 3, count: 1, value: 2 },
    { tag: 273, type: 4, count: 1, value: pixelOffset },
    { tag: 277, type: 3, count: 1, value: 4 },
    { tag: 278, type: 4, count: 1, value: rendered.height },
    { tag: 279, type: 4, count: 1, value: strip.byteLength },
    { tag: 282, type: 5, count: 1, value: xResolutionOffset },
    { tag: 283, type: 5, count: 1, value: yResolutionOffset },
    { tag: 284, type: 3, count: 1, value: 1 },
    { tag: 296, type: 3, count: 1, value: 2 },
    { tag: 338, type: 3, count: 1, value: 2 },
  ];
  for (let index = 0; index < entries.length; index += 1) {
    options.checkpoint();
    const entry = entries[index]!;
    const offset = ifdOffset + 2 + index * 12;
    view.setUint16(offset, entry.tag, true);
    view.setUint16(offset + 2, entry.type, true);
    view.setUint32(offset + 4, entry.count, true);
    if (entry.type === 3 && entry.count === 1) view.setUint16(offset + 8, entry.value, true);
    else view.setUint32(offset + 8, entry.value, true);
  }
  view.setUint32(ifdOffset + 2 + entryCount * 12, 0, true);
  for (let index = 0; index < 4; index += 1) view.setUint16(bitsOffset + index * 2, 8, true);
  const resolution = Math.max(1, Math.round(options.resolution * 1000));
  view.setUint32(xResolutionOffset, resolution, true);
  view.setUint32(xResolutionOffset + 4, 1000, true);
  view.setUint32(yResolutionOffset, resolution, true);
  view.setUint32(yResolutionOffset + 4, 1000, true);
  output.set(strip, pixelOffset);
  return output;
}

/** TIFF 6.0 LZW: MSB-first codes with the TIFF early-change width transition. */
export function encodeTiffLzw(input: Uint8Array, checkpoint: () => void): Uint8Array {
  const clearCode = 256;
  const endCode = 257;
  const maximumCode = 4095;
  const output: number[] = [];
  let accumulator = 0;
  let accumulatorBits = 0;
  let codeWidth = 9;
  let nextCode = 258;
  let dictionary = new Map<string, number>();

  const writeCode = (code: number): void => {
    accumulator = accumulator * 2 ** codeWidth + code;
    accumulatorBits += codeWidth;
    while (accumulatorBits >= 8) {
      accumulatorBits -= 8;
      const divisor = 2 ** accumulatorBits;
      output.push(Math.floor(accumulator / divisor) & 0xff);
      accumulator %= divisor;
    }
  };
  const reset = (): void => {
    dictionary = new Map<string, number>();
    codeWidth = 9;
    nextCode = 258;
  };

  writeCode(clearCode);
  if (input.byteLength === 0) {
    writeCode(endCode);
  } else {
    let prefix = input[0]!;
    for (let index = 1; index < input.byteLength; index += 1) {
      if ((index & 0x3fff) === 0) checkpoint();
      const suffix = input[index]!;
      const candidate = `${prefix},${suffix}`;
      const known = dictionary.get(candidate);
      if (known !== undefined) {
        prefix = known;
        continue;
      }
      writeCode(prefix);
      if (nextCode <= maximumCode) {
        dictionary.set(candidate, nextCode);
        nextCode += 1;
        if (codeWidth < 12 && nextCode === 2 ** codeWidth - 1) codeWidth += 1;
      } else {
        writeCode(clearCode);
        reset();
      }
      prefix = suffix;
    }
    writeCode(prefix);
    writeCode(endCode);
  }
  if (accumulatorBits > 0) output.push((accumulator * 2 ** (8 - accumulatorBits)) & 0xff);
  checkpoint();
  return Uint8Array.from(output);
}
