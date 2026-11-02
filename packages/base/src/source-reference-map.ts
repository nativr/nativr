import type { ParseSourceDirective } from "@nativr/ast";

/** A consumed-prefix position; the first byte and column of a line are still zero. */
export interface RetainedSourcePosition {
  readonly physicalLine: number;
  readonly logicalLine: number | null;
  readonly byte: number;
  readonly column: number;
}

/** Inclusive native source coordinates. A null logical line represents integer NA. */
export type SourceReferenceTuple = readonly [
  number | null,
  number,
  number | null,
  number,
  number,
  number,
  number,
  number,
];

export interface SourceReferenceMapOptions {
  readonly directives: readonly ParseSourceDirective[];
  readonly originalFilename?: string;
  readonly checkpoint: () => void;
  readonly allocate: (elements: number) => void;
}

interface PositionAnchor {
  readonly offset: number;
  readonly physicalLine: number;
  readonly byte: number;
  readonly column: number;
}

interface DirectiveAnchor {
  readonly offset: number;
  readonly logicalDelta: number;
  readonly sourceIndex: number;
}

export interface RetainedSourceAlias {
  readonly index: number;
  readonly filename?: string;
}

/**
 * Indexes effective parser input, including its final synthetic newline. Lexically recognized
 * directives are supplied by the parser event pass, so strings cannot become directives here.
 * Sparse anchors preserve UTF-8 bytes, codepoint columns and eight-column tab stops without
 * rescanning each node's source line or changing public AST diagnostic coordinates.
 */
export class SourceReferenceMap {
  readonly #source: string;
  readonly #checkpoint: () => void;
  readonly #positions: readonly PositionAnchor[];
  readonly #directives: readonly DirectiveAnchor[];
  public readonly sources: readonly RetainedSourceAlias[];

  public constructor(source: string, options: SourceReferenceMapOptions) {
    this.#source = source;
    this.#checkpoint = options.checkpoint;

    // Count before allocating: long ASCII runs need no additional anchors, while dense Unicode,
    // tabs or newlines must not grow an unchecked intermediate array.
    let anchorCount = 1;
    let nextCheckpoint = 0;
    for (let offset = 0; offset < source.length;) {
      if (offset >= nextCheckpoint) {
        options.checkpoint();
        nextCheckpoint = offset + 1024;
      }
      const point = source.codePointAt(offset) as number;
      if (needsAnchor(point)) anchorCount += 1;
      offset += point > 0xffff ? 2 : 1;
    }
    options.checkpoint();
    for (let field = 0; field < 4; field += 1) options.allocate(anchorCount);
    for (let field = 0; field < 3; field += 1) options.allocate(options.directives.length);
    options.allocate(options.directives.length + 1);

    const positions: PositionAnchor[] = [{ offset: 0, physicalLine: 1, byte: 0, column: 0 }];
    let physicalLine = 1;
    let byte = 0;
    let column = 0;
    nextCheckpoint = 0;
    for (let offset = 0; offset < source.length;) {
      if (offset >= nextCheckpoint) {
        options.checkpoint();
        nextCheckpoint = offset + 1024;
      }
      const point = source.codePointAt(offset) as number;
      offset += point > 0xffff ? 2 : 1;
      if (point === 0x0a) {
        physicalLine += 1;
        byte = 0;
        column = 0;
      } else {
        byte += utf8Width(point);
        column = point === 0x09 ? (Math.floor(column / 8) + 1) * 8 : column + 1;
      }
      if (needsAnchor(point)) positions.push({ offset, physicalLine, byte, column });
    }
    this.#positions = positions;

    const directives: DirectiveAnchor[] = [];
    const sources: RetainedSourceAlias[] = [
      {
        index: 0,
        ...(options.originalFilename === undefined ? {} : { filename: options.originalFilename }),
      },
    ];
    let currentFilename = options.originalFilename;
    let sourceIndex = 0;
    let previousEnd = -1;
    for (const directive of options.directives) {
      options.checkpoint();
      this.#validateOffset(directive.startOffset);
      this.#validateOffset(directive.endOffset);
      if (
        directive.startOffset <= previousEnd ||
        directive.endOffset < directive.startOffset ||
        source[directive.endOffset] !== "\n" ||
        !Number.isInteger(directive.nextLogicalLine) ||
        directive.nextLogicalLine < 0 ||
        directive.nextLogicalLine > 0x7fffffff
      ) {
        throw new RangeError("Invalid retained-source directive range or logical line.");
      }
      previousEnd = directive.endOffset;
      const offset = directive.endOffset + 1;
      const nextLine = this.#physicalPosition(offset).physicalLine;
      if (directive.filename !== undefined && directive.filename !== currentFilename) {
        currentFilename = directive.filename;
        sourceIndex = sources.length;
        sources.push({ index: sourceIndex, filename: directive.filename });
      }
      directives.push({
        offset,
        logicalDelta: directive.nextLogicalLine - nextLine,
        sourceIndex,
      });
    }
    this.#directives = directives;
    this.sources = sources;
  }

  /** Coordinates after consuming source[0:offset], including a consumed newline reset. */
  public position(offset: number): RetainedSourcePosition {
    this.#checkpoint();
    this.#validateOffset(offset);
    const physical = this.#physicalPosition(offset);
    const directive = this.#directives[lowerAnchor(this.#directives, offset)];
    return {
      physicalLine: physical.physicalLine,
      logicalLine: nativeLogicalLine(physical.physicalLine + (directive?.logicalDelta ?? 0)),
      byte: physical.byte,
      column: physical.column,
    };
  }

  /** Convert a nonempty half-open syntax range into inclusive eight-element coordinates. */
  public span(start: number, end: number): SourceReferenceTuple {
    if (end <= start) throw new RangeError("A source-reference syntax range must be nonempty.");
    const first = this.position(start);
    const last = this.position(end);
    return [
      first.logicalLine,
      first.byte + 1,
      last.logicalLine,
      last.byte,
      first.column + 1,
      last.column,
      first.physicalLine,
      last.physicalLine,
    ];
  }

  /** Root and block whole references begin at the global input origin, including nested blocks. */
  public whole(end: number): SourceReferenceTuple {
    const last = this.position(end);
    return [1, 0, last.logicalLine, last.byte, 0, last.column, 1, last.physicalLine];
  }

  /** Source identity active at completion; block opening-brace references use the block's end. */
  public sourceIndexAt(offset: number): number {
    this.#checkpoint();
    this.#validateOffset(offset);
    return this.#directives[lowerAnchor(this.#directives, offset)]?.sourceIndex ?? 0;
  }

  #physicalPosition(offset: number): PositionAnchor {
    const anchor = this.#positions[lowerAnchor(this.#positions, offset)] as PositionAnchor;
    const distance = offset - anchor.offset;
    return {
      offset,
      physicalLine: anchor.physicalLine,
      byte: anchor.byte + distance,
      column: anchor.column + distance,
    };
  }

  #validateOffset(offset: number): void {
    if (!Number.isInteger(offset) || offset < 0 || offset > this.#source.length) {
      throw new RangeError("Source-reference offset is outside the effective input.");
    }
    const unit = this.#source.charCodeAt(offset);
    const previous = this.#source.charCodeAt(offset - 1);
    if (unit >= 0xdc00 && unit <= 0xdfff && previous >= 0xd800 && previous <= 0xdbff) {
      throw new RangeError("Source-reference offset splits a Unicode codepoint.");
    }
  }
}

function needsAnchor(point: number): boolean {
  return point > 0x7f || point === 0x09 || point === 0x0a;
}

function utf8Width(point: number): number {
  if (point <= 0x7f) return 1;
  if (point <= 0x7ff) return 2;
  return point <= 0xffff ? 3 : 4;
}

function nativeLogicalLine(line: number): number | null {
  const signed = line | 0;
  return signed === -0x80000000 ? null : signed;
}

function lowerAnchor<T extends { readonly offset: number }>(
  values: readonly T[],
  offset: number,
): number {
  let low = 0;
  let high = values.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if ((values[middle] as T).offset <= offset) low = middle + 1;
    else high = middle - 1;
  }
  return high;
}
