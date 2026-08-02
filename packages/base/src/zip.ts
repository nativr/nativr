import {
  NativRError,
  REvaluationError,
  RResourceLimitError,
  RUnsupportedFeatureError,
  decompressDeflateRawBytes,
} from "@nativr/runtime";
import type { OperatorContext } from "@nativr/runtime";

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;

/** Extract one exact member from a bounded single-disk ZIP archive. */
export async function extractZipMember(
  archive: Uint8Array,
  filename: string,
  context: OperatorContext,
): Promise<Uint8Array> {
  if (archive.byteLength > context.limits.maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "ZIP archive input limit exceeded.", {
      details: {
        maxOutputBytes: context.limits.maxOutputBytes,
        outputBytes: archive.byteLength,
      },
    });
  }
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const endOffset = findEndOfCentralDirectory(view);
  const disk = uint16(view, endOffset + 4);
  const centralDisk = uint16(view, endOffset + 6);
  const entriesOnDisk = uint16(view, endOffset + 8);
  const entryCount = uint16(view, endOffset + 10);
  const centralSize = uint32(view, endOffset + 12);
  const centralOffset = uint32(view, endOffset + 16);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === ZIP64_SENTINEL_16 ||
    centralSize === ZIP64_SENTINEL_32 ||
    centralOffset === ZIP64_SENTINEL_32
  ) {
    throw new RUnsupportedFeatureError(
      "NRU6207",
      "unz() currently supports bounded single-disk non-ZIP64 archives.",
    );
  }
  if (entryCount > context.limits.maxVectorLength) {
    throw new RResourceLimitError("NRL4002", "ZIP member-count limit exceeded.", {
      details: { maxVectorLength: context.limits.maxVectorLength, requested: entryCount },
    });
  }
  requireRange(archive, centralOffset, centralSize, "Invalid ZIP central directory.");
  const centralEnd = centralOffset + centralSize;

  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    context.checkpoint();
    if (offset + 46 > centralEnd) {
      throw invalidZip("Invalid ZIP central-directory bounds.");
    }
    requireRange(archive, offset, 46, "Invalid ZIP central-directory entry.");
    if (uint32(view, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw invalidZip("Invalid ZIP central-directory signature.");
    }
    const flags = uint16(view, offset + 8);
    const method = uint16(view, offset + 10);
    const expectedCrc = uint32(view, offset + 16);
    const compressedSize = uint32(view, offset + 20);
    const uncompressedSize = uint32(view, offset + 24);
    const nameLength = uint16(view, offset + 28);
    const extraLength = uint16(view, offset + 30);
    const commentLength = uint16(view, offset + 32);
    const diskStart = uint16(view, offset + 34);
    const localOffset = uint32(view, offset + 42);
    if (
      compressedSize === ZIP64_SENTINEL_32 ||
      uncompressedSize === ZIP64_SENTINEL_32 ||
      localOffset === ZIP64_SENTINEL_32 ||
      diskStart !== 0
    ) {
      throw new RUnsupportedFeatureError(
        "NRU6207",
        "unz() ZIP64 or multi-disk members are not yet supported.",
      );
    }
    const variableLength = nameLength + extraLength + commentLength;
    if (offset + 46 + variableLength > centralEnd) {
      throw invalidZip("Invalid ZIP central-directory entry bounds.");
    }
    requireRange(archive, offset + 46, variableLength, "Invalid ZIP entry metadata.");
    const nameBytes = archive.subarray(offset + 46, offset + 46 + nameLength);
    const extraBytes = archive.subarray(
      offset + 46 + nameLength,
      offset + 46 + nameLength + extraLength,
    );
    const memberName = decodeZipFilename(nameBytes, extraBytes, flags);
    if (memberName === filename) {
      return extractLocatedMember(
        archive,
        view,
        {
          compressedSize,
          expectedCrc,
          flags,
          localOffset,
          method,
          uncompressedSize,
        },
        context,
      );
    }
    offset += 46 + variableLength;
  }
  throw new NativRError("NRE2257", `Cannot locate ZIP member '${filename}'.`);
}

interface LocatedZipMember {
  readonly compressedSize: number;
  readonly expectedCrc: number;
  readonly flags: number;
  readonly localOffset: number;
  readonly method: number;
  readonly uncompressedSize: number;
}

async function extractLocatedMember(
  archive: Uint8Array,
  view: DataView,
  member: LocatedZipMember,
  context: OperatorContext,
): Promise<Uint8Array> {
  if ((member.flags & 0x0001) !== 0) {
    throw new RUnsupportedFeatureError("NRU6207", "unz() encrypted members are not supported.");
  }
  if (member.uncompressedSize > context.limits.maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "ZIP member output limit exceeded.", {
      details: {
        maxOutputBytes: context.limits.maxOutputBytes,
        outputBytes: member.uncompressedSize,
      },
    });
  }
  requireRange(archive, member.localOffset, 30, "Invalid ZIP local-file header.");
  if (uint32(view, member.localOffset) !== LOCAL_FILE_SIGNATURE) {
    throw invalidZip("Invalid ZIP local-file signature.");
  }
  const localFlags = uint16(view, member.localOffset + 6);
  const localMethod = uint16(view, member.localOffset + 8);
  if ((localFlags & 0x0001) !== 0 || localMethod !== member.method) {
    throw invalidZip("ZIP local and central metadata do not agree.");
  }
  const localNameLength = uint16(view, member.localOffset + 26);
  const localExtraLength = uint16(view, member.localOffset + 28);
  const dataOffset = member.localOffset + 30 + localNameLength + localExtraLength;
  requireRange(archive, dataOffset, member.compressedSize, "Truncated ZIP member data.");
  const compressed = archive.subarray(dataOffset, dataOffset + member.compressedSize);
  let output: Uint8Array;
  if (member.method === 0) {
    if (member.compressedSize !== member.uncompressedSize) {
      throw invalidZip("Stored ZIP member has inconsistent sizes.");
    }
    context.allocate(member.uncompressedSize);
    output = Uint8Array.from(compressed);
  } else if (member.method === 8) {
    output = await decompressDeflateRawBytes(compressed, context);
  } else {
    throw new RUnsupportedFeatureError(
      "NRU6207",
      `unz() compression method ${member.method} is not supported.`,
    );
  }
  if (output.byteLength !== member.uncompressedSize || crc32(output) !== member.expectedCrc) {
    throw invalidZip("ZIP member size or CRC check failed.");
  }
  return output;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimum = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (uint32(view, offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = uint16(view, offset + 20);
    if (offset + 22 + commentLength === view.byteLength) return offset;
  }
  throw invalidZip("Cannot locate ZIP central directory.");
}

function decodeZipFilename(name: Uint8Array, extra: Uint8Array, flags: number): string {
  if ((flags & 0x0800) !== 0) return decodeUtf8(name, "Invalid UTF-8 ZIP filename.");
  const unicode = unicodePathExtra(extra, name);
  if (unicode !== undefined) return unicode;
  let result = "";
  for (const byte of name) {
    result += byte < 0x80 ? String.fromCodePoint(byte) : (CP437[byte - 0x80] ?? "�");
  }
  return result;
}

function unicodePathExtra(extra: Uint8Array, original: Uint8Array): string | undefined {
  let offset = 0;
  const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  while (offset + 4 <= extra.byteLength) {
    const tag = uint16(view, offset);
    const length = uint16(view, offset + 2);
    offset += 4;
    if (offset + length > extra.byteLength) throw invalidZip("Invalid ZIP extra field.");
    if (
      tag === 0x7075 &&
      length >= 5 &&
      extra[offset] === 1 &&
      uint32(view, offset + 1) === crc32(original)
    ) {
      return decodeUtf8(extra.subarray(offset + 5, offset + length), "Invalid Unicode ZIP path.");
    }
    offset += length;
  }
  if (offset !== extra.byteLength) throw invalidZip("Invalid ZIP extra-field trailer.");
  return undefined;
}

function decodeUtf8(bytes: Uint8Array, message: string): string {
  try {
    const Decoder = (
      globalThis as unknown as {
        readonly TextDecoder: new (
          label: string,
          options: { readonly fatal: boolean },
        ) => { readonly decode: (input: Uint8Array) => string };
      }
    ).TextDecoder;
    return new Decoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalidZip(message);
  }
}

function requireRange(source: Uint8Array, offset: number, length: number, message: string): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset > source.byteLength ||
    length > source.byteLength - offset
  ) {
    throw invalidZip(message);
  }
}

function uint16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) throw invalidZip("Truncated ZIP metadata.");
  return view.getUint16(offset, true);
}

function uint32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) throw invalidZip("Truncated ZIP metadata.");
  return view.getUint32(offset, true);
}

function invalidZip(message: string): REvaluationError {
  return new REvaluationError("NRE2258", message);
}

function crc32(source: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of source) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CP437 = Object.freeze(
  Array.from(
    "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5" +
      "\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00a2\u00a3\u00a5\u20a7\u0192" +
      "\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u2310\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb" +
      "\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510" +
      "\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567" +
      "\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580" +
      "\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229" +
      "\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0",
  ),
);
