import type { ParseWorkCallbacks, SourcePosition, SourceSpan } from "@nativr/ast";

/**
 * Converts Tree-sitter UTF-8 byte offsets into JavaScript UTF-16 offsets and user-facing
 * one-based line/column positions.
 */
export class Utf8SourceMap {
  readonly #source: string;
  readonly #byteStarts: readonly number[];
  readonly #byteEnds: readonly number[];
  readonly #utf16Starts: readonly number[];
  readonly #utf16Ends: readonly number[];
  readonly #lineStarts: readonly number[];
  readonly #totalBytes: number;
  readonly #checkpoint: (() => void) | undefined;

  public constructor(
    source: string,
    work: Partial<Pick<ParseWorkCallbacks, "checkpoint" | "allocate">> = {},
  ) {
    this.#source = source;
    this.#checkpoint = work.checkpoint;
    let unicodeCount = 0,
      lineCount = 1,
      nextCheckpoint = 0;
    for (let offset = 0; offset < source.length;) {
      if (offset >= nextCheckpoint) {
        work.checkpoint?.();
        nextCheckpoint = offset + 1024;
      }
      const point = source.codePointAt(offset)!;
      if (point > 0x7f) unicodeCount++;
      if (point === 0x0a) lineCount++;
      offset += point > 0xffff ? 2 : 1;
    }
    work.checkpoint?.();
    for (let field = 0; field < 4; field++) work.allocate?.(unicodeCount);
    work.allocate?.(lineCount);
    // ASCII byte and UTF-16 offsets advance together. Only non-ASCII codepoints need anchors;
    // both ends let recovered offsets inside a UTF-8 sequence floor to its opening boundary.
    const byteStarts: number[] = [],
      byteEnds: number[] = [];
    const utf16Starts: number[] = [],
      utf16Ends: number[] = [];
    const lineStarts: number[] = [0];
    let bytes = 0;
    nextCheckpoint = 0;
    for (let offset = 0; offset < source.length;) {
      if (offset >= nextCheckpoint) {
        work.checkpoint?.();
        nextCheckpoint = offset + 1024;
      }
      const point = source.codePointAt(offset);
      if (point === undefined) {
        break;
      }
      const utf16Width = point > 0xffff ? 2 : 1;
      if (point > 0x7f) {
        byteStarts.push(bytes);
        utf16Starts.push(offset);
      }
      bytes += utf8Width(point);
      offset += utf16Width;
      if (point > 0x7f) {
        byteEnds.push(bytes);
        utf16Ends.push(offset);
      }
      if (point === 0x0a) {
        lineStarts.push(offset);
      }
    }

    this.#byteStarts = byteStarts;
    this.#byteEnds = byteEnds;
    this.#utf16Starts = utf16Starts;
    this.#utf16Ends = utf16Ends;
    this.#lineStarts = lineStarts;
    this.#totalBytes = bytes;
  }

  /** Convert one exact or recovered UTF-8 byte offset into a source position. */
  public positionAtByte(byteOffset: number): SourcePosition {
    this.#checkpoint?.();
    const safeByte = Number.isNaN(byteOffset)
      ? 0
      : Math.max(0, Math.min(this.#totalBytes, Math.floor(byteOffset)));
    const boundary = greatestLessThanOrEqual(this.#byteStarts, safeByte);
    const start = this.#byteStarts[boundary];
    const end = this.#byteEnds[boundary];
    const offset =
      start === undefined || start > safeByte
        ? safeByte
        : safeByte < end!
          ? this.#utf16Starts[boundary]!
          : this.#utf16Ends[boundary]! + safeByte - end!;
    return this.positionAtUtf16(offset);
  }

  /** Convert one UTF-16 offset into a source position. */
  public positionAtUtf16(offset: number): SourcePosition {
    this.#checkpoint?.();
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
