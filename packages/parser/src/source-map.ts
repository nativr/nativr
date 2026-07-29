import type { SourcePosition, SourceSpan } from "@nativr/ast";

/**
 * Converts Tree-sitter UTF-8 byte offsets into JavaScript UTF-16 offsets and user-facing
 * one-based line/column positions.
 */
export class Utf8SourceMap {
  readonly #source: string;
  readonly #byteBoundaries: readonly number[];
  readonly #utf16Boundaries: readonly number[];
  readonly #lineStarts: readonly number[];

  public constructor(source: string) {
    this.#source = source;
    const byteBoundaries: number[] = [0];
    const utf16Boundaries: number[] = [0];
    const lineStarts: number[] = [0];
    let bytes = 0;

    for (let offset = 0; offset < source.length;) {
      const point = source.codePointAt(offset);
      if (point === undefined) {
        break;
      }
      const utf16Width = point > 0xffff ? 2 : 1;
      bytes += utf8Width(point);
      offset += utf16Width;
      byteBoundaries.push(bytes);
      utf16Boundaries.push(offset);
      if (point === 0x0a) {
        lineStarts.push(offset);
      }
    }

    this.#byteBoundaries = byteBoundaries;
    this.#utf16Boundaries = utf16Boundaries;
    this.#lineStarts = lineStarts;
  }

  /** Convert one exact or recovered UTF-8 byte offset into a source position. */
  public positionAtByte(byteOffset: number): SourcePosition {
    const boundary = greatestLessThanOrEqual(this.#byteBoundaries, byteOffset);
    const offset = this.#utf16Boundaries[boundary] ?? this.#source.length;
    return this.positionAtUtf16(offset);
  }

  /** Convert one UTF-16 offset into a source position. */
  public positionAtUtf16(offset: number): SourcePosition {
    const safeOffset = Math.max(0, Math.min(offset, this.#source.length));
    const lineIndex = greatestLessThanOrEqual(this.#lineStarts, safeOffset);
    const lineStart = this.#lineStarts[lineIndex] ?? 0;
    return {
      offset: safeOffset,
      line: lineIndex + 1,
      column: safeOffset - lineStart + 1,
    };
  }

  /**
   * Convert the UTF-16 indices produced by web-tree-sitter's JavaScript string callback into a
   * NativR source span.
   */
  public span(startOffset: number, endOffset: number): SourceSpan {
    return {
      start: this.positionAtUtf16(startOffset),
      end: this.positionAtUtf16(endOffset),
    };
  }

  /** Convert a half-open UTF-8 byte range when a byte-oriented parser callback is used. */
  public byteSpan(startByte: number, endByte: number): SourceSpan {
    return {
      start: this.positionAtByte(startByte),
      end: this.positionAtByte(endByte),
    };
  }
}

function utf8Width(point: number): number {
  if (point <= 0x7f) return 1;
  if (point <= 0x7ff) return 2;
  if (point <= 0xffff) return 3;
  return 4;
}

function greatestLessThanOrEqual(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const value = values[middle] ?? 0;
    if (value <= target) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return Math.max(0, high);
}
