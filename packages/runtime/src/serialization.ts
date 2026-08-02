import { REvaluationError, RResourceLimitError, RUnsupportedFeatureError } from "./errors.js";
import {
  R_NULL,
  characterBytesAt,
  characterEncodingAt,
  characterVector,
  complexVector,
  doubleVector,
  integerVector,
  isMissing,
  listValue,
  logicalVector,
  pairlistValue,
  rawVector,
  vectorNames,
} from "./values.js";
import type {
  RAttributes,
  RCharacterEncoding,
  RCharacterVector,
  REnvironment,
  RList,
  OperatorContext,
  RPairlist,
  RValue,
  RVector,
} from "./values.js";

const SERIALIZATION_HEADER_BYTES = 2;
const WORKSPACE_HEADER_BYTES = 5;
const INTEGER_NA = -2_147_483_648;
const XDR_NA_HIGH = 0x7ff0_0000;
const XDR_NA_LOW = 0x0000_07a2;

const NILVALUE_SXP = 254;
const GLOBALENV_SXP = 253;
const UNBOUNDVALUE_SXP = 252;
const MISSINGARG_SXP = 251;
const BASENAMESPACE_SXP = 250;
const NAMESPACE_SXP = 249;
const PACKAGES_SXP = 248;
const EMPTYENV_SXP = 242;
const BASEENV_SXP = 241;
const REFSXP = 255;
const ALTREP_SXP = 238;

const SYMSXP = 1;
const LISTSXP = 2;
const LANGSXP = 6;
const CHARSXP = 9;
const LGLSXP = 10;
const INTSXP = 13;
const REALSXP = 14;
const CPLXSXP = 15;
const STRSXP = 16;
const VECSXP = 19;
const EXPRSXP = 20;
const RAWSXP = 24;

const OBJECT_BIT = 1 << 8;
const ATTRIBUTE_BIT = 1 << 9;
const TAG_BIT = 1 << 10;

export interface RSerializationEnvironments {
  readonly global?: REnvironment;
  readonly base?: REnvironment;
  readonly baseNamespace?: REnvironment;
  readonly empty?: REnvironment;
}

export interface RSerializationMetadata {
  readonly format: "xdr" | "binary" | "ascii";
  readonly version: 2 | 3;
  readonly writerVersion: string;
  readonly minimumReaderVersion: string;
  readonly nativeEncoding?: string;
  readonly workspace: boolean;
}

export interface RDecodedSerialization {
  readonly value: RValue;
  readonly metadata: RSerializationMetadata;
}

export interface RWorkspaceEntry {
  readonly name: string;
  readonly value: RValue;
}

export interface RSerializationWriteOptions {
  readonly version?: 2 | 3;
  readonly workspace?: boolean;
}

/** Decode one uncompressed GNU R version-2 or version-3 XDR serialization. */
export function decodeRSerialization(
  bytes: Uint8Array,
  context: OperatorContext,
  environments: RSerializationEnvironments = {},
): RDecodedSerialization {
  if (bytes.byteLength > context.limits.maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "Serialized input byte limit exceeded.", {
      details: { maxOutputBytes: context.limits.maxOutputBytes, outputBytes: bytes.byteLength },
    });
  }
  const reader = new XdrSerializationReader(bytes, context, environments);
  return reader.read();
}

/** Encode the supported owned value graph as a GNU R-compatible XDR serialization. */
export function encodeRSerialization(
  value: RValue,
  context: OperatorContext,
  environments: RSerializationEnvironments = {},
  options: RSerializationWriteOptions = {},
): Uint8Array {
  return new XdrSerializationWriter(
    context,
    environments,
    options.version ?? 3,
    options.workspace ?? false,
  ).write(value);
}

/** Encode and optionally gzip one R serialization using browser-standard streams. */
export async function encodeRSerializationFile(
  value: RValue,
  context: OperatorContext,
  environments: RSerializationEnvironments = {},
  options: RSerializationWriteOptions & { readonly compress?: boolean } = {},
): Promise<Uint8Array> {
  const bytes = encodeRSerialization(value, context, environments, options);
  return options.compress === true ? compressGzipBytes(bytes, context) : bytes;
}

/** Decompress a supported file wrapper and decode its serialized object. */
export async function decodeRSerializationFile(
  bytes: Uint8Array,
  context: OperatorContext,
  environments: RSerializationEnvironments = {},
): Promise<RDecodedSerialization> {
  return decodeRSerialization(await unwrapRCompression(bytes, context), context, environments);
}

/** Decode a save()/data() workspace into its named object bindings. */
export async function decodeRWorkspaceFile(
  bytes: Uint8Array,
  context: OperatorContext,
  environments: RSerializationEnvironments = {},
): Promise<{
  readonly entries: readonly RWorkspaceEntry[];
  readonly metadata: RSerializationMetadata;
}> {
  const decoded = await decodeRSerializationFile(bytes, context, environments);
  if (!decoded.metadata.workspace) {
    throw new REvaluationError("NRE2248", "The input is not an R workspace serialization.");
  }
  const value = decoded.value;
  if (value.type !== "pairlist" && value.type !== "list") {
    throw new REvaluationError("NRE2248", "An R workspace must contain a named pairlist or list.");
  }
  const names = vectorNames(value);
  if (
    names === undefined ||
    names.length !== value.length ||
    names.some((name) => name.length === 0)
  ) {
    throw new REvaluationError("NRE2248", "An R workspace contains an unnamed object.");
  }
  context.allocate(value.length);
  return {
    entries: Object.freeze(
      value.values.map((entry, index) => ({ name: names[index] ?? "", value: entry })),
    ),
    metadata: decoded.metadata,
  };
}

/** Decode a bounded base64 package resource without using a Node API. */
export function decodeRBase64Resource(source: string, context: OperatorContext): Uint8Array {
  if (
    source.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(source)
  ) {
    throw new REvaluationError("NRE2247", "Package serialization has invalid base64 data.");
  }
  const padding = source.endsWith("==") ? 2 : source.endsWith("=") ? 1 : 0;
  const length = (source.length / 4) * 3 - padding;
  if (length > context.limits.maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "Serialized input byte limit exceeded.", {
      details: { maxOutputBytes: context.limits.maxOutputBytes, outputBytes: length },
    });
  }
  context.allocate(length);
  let binary: string;
  try {
    binary = (globalThis as unknown as { readonly atob: (input: string) => string }).atob(source);
  } catch {
    throw new REvaluationError("NRE2247", "Package serialization has invalid base64 data.");
  }
  const output = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    if (index % 4_096 === 0) context.checkpoint();
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

async function unwrapRCompression(
  bytes: Uint8Array,
  context: OperatorContext,
): Promise<Uint8Array> {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return decompressGzipBytes(bytes, context);
  if (bytes[0] === 0x42 && bytes[1] === 0x5a && bytes[2] === 0x68) {
    throw new RUnsupportedFeatureError(
      "NRU6192",
      "bzip2-compressed R serialization is not yet available in the browser runtime.",
    );
  }
  if (
    bytes[0] === 0xfd &&
    bytes[1] === 0x37 &&
    bytes[2] === 0x7a &&
    bytes[3] === 0x58 &&
    bytes[4] === 0x5a
  ) {
    throw new RUnsupportedFeatureError(
      "NRU6192",
      "xz-compressed R serialization is not yet available in the browser runtime.",
    );
  }
  if (bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd) {
    throw new RUnsupportedFeatureError(
      "NRU6192",
      "zstd-compressed R serialization is not yet available in the browser runtime.",
    );
  }
  return bytes;
}

/** Decompress a bounded gzip byte stream using the browser-standard stream API. */
export async function decompressGzipBytes(
  bytes: Uint8Array,
  context: OperatorContext,
): Promise<Uint8Array> {
  if (bytes.byteLength > context.limits.maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "Compressed gzip input limit exceeded.", {
      details: { maxOutputBytes: context.limits.maxOutputBytes, outputBytes: bytes.byteLength },
    });
  }
  type Reader = {
    read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }>;
    cancel(reason?: unknown): Promise<void>;
  };
  type ByteStream = {
    pipeThrough(transform: unknown): { getReader(): Reader };
  };
  const host = globalThis as unknown as {
    readonly Blob?: new (parts: readonly Uint8Array[]) => { stream(): ByteStream };
    readonly DecompressionStream?: new (format: string) => unknown;
  };
  if (host.Blob === undefined || host.DecompressionStream === undefined) {
    throw new RUnsupportedFeatureError(
      "NRU6192",
      "gzip decompression requires the browser DecompressionStream API.",
    );
  }
  let reader: Reader;
  try {
    reader = new host.Blob([bytes])
      .stream()
      .pipeThrough(new host.DecompressionStream("gzip"))
      .getReader();
  } catch {
    throw new REvaluationError("NRE2247", "Cannot open gzip-compressed data.");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      context.checkpoint();
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value === undefined) continue;
      length += chunk.value.byteLength;
      if (length > context.limits.maxOutputBytes) {
        await reader.cancel("limit");
        throw new RResourceLimitError("NRL4007", "Decompressed gzip data limit exceeded.", {
          details: { maxOutputBytes: context.limits.maxOutputBytes, outputBytes: length },
        });
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    if (error instanceof RResourceLimitError) throw error;
    throw new REvaluationError("NRE2247", "Invalid gzip-compressed data.");
  }
  context.allocate(length);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

/** Compress a bounded byte stream as gzip using the browser-standard stream API. */
export async function compressGzipBytes(
  bytes: Uint8Array,
  context: OperatorContext,
): Promise<Uint8Array> {
  if (bytes.byteLength > context.limits.maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "Uncompressed gzip input limit exceeded.", {
      details: { maxOutputBytes: context.limits.maxOutputBytes, outputBytes: bytes.byteLength },
    });
  }
  type Reader = {
    read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }>;
    cancel(reason?: unknown): Promise<void>;
  };
  type ByteStream = {
    pipeThrough(transform: unknown): { getReader(): Reader };
  };
  const host = globalThis as unknown as {
    readonly Blob?: new (parts: readonly Uint8Array[]) => { stream(): ByteStream };
    readonly CompressionStream?: new (format: string) => unknown;
  };
  if (host.Blob === undefined || host.CompressionStream === undefined) {
    throw new RUnsupportedFeatureError(
      "NRU6192",
      "gzip compression requires the browser CompressionStream API.",
    );
  }
  const reader = new host.Blob([bytes])
    .stream()
    .pipeThrough(new host.CompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    context.checkpoint();
    const chunk = await reader.read();
    if (chunk.done) break;
    if (chunk.value === undefined) continue;
    length += chunk.value.byteLength;
    if (length > context.limits.maxOutputBytes) {
      await reader.cancel("limit");
      throw new RResourceLimitError("NRL4007", "Compressed gzip data limit exceeded.", {
        details: { maxOutputBytes: context.limits.maxOutputBytes, outputBytes: length },
      });
    }
    chunks.push(chunk.value);
  }
  context.allocate(length);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function encodeUtf8(source: string): Uint8Array {
  const Encoder = (
    globalThis as unknown as {
      readonly TextEncoder: new () => { readonly encode: (input: string) => Uint8Array };
    }
  ).TextEncoder;
  return new Encoder().encode(source);
}

class XdrSerializationWriter {
  readonly #context: OperatorContext;
  readonly #environments: RSerializationEnvironments;
  readonly #version: 2 | 3;
  readonly #workspace: boolean;
  readonly #output: number[] = [];

  public constructor(
    context: OperatorContext,
    environments: RSerializationEnvironments,
    version: 2 | 3,
    workspace: boolean,
  ) {
    this.#context = context;
    this.#environments = environments;
    this.#version = version;
    this.#workspace = workspace;
  }

  public write(value: RValue): Uint8Array {
    if (this.#workspace) this.#writeAscii(`RDX${String(this.#version)}\n`);
    this.#writeAscii("X\n");
    this.#writeInt32(this.#version);
    this.#writeUint32(0x0004_0600);
    this.#writeUint32(this.#version === 2 ? 0x0002_0300 : 0x0003_0500);
    if (this.#version === 3) {
      const encoding = encodeUtf8("UTF-8");
      this.#writeInt32(encoding.byteLength);
      this.#writeBytes(encoding);
    }
    this.#writeItem(value, 0);
    this.#context.allocate(this.#output.length);
    return Uint8Array.from(this.#output);
  }

  #writeItem(value: RValue, depth: number): void {
    this.#context.checkpoint();
    if (depth > this.#context.limits.maxCallDepth) {
      throw new RResourceLimitError("NRL4004", "Serialized object nesting limit exceeded.");
    }
    if (value.type === "null") {
      this.#writeUint32(NILVALUE_SXP);
      return;
    }
    if (value.type === "environment") {
      if (value === this.#environments.global) this.#writeUint32(GLOBALENV_SXP);
      else if (value === this.#environments.empty) this.#writeUint32(EMPTYENV_SXP);
      else if (value === this.#environments.baseNamespace) this.#writeUint32(BASENAMESPACE_SXP);
      else if (value === this.#environments.base) this.#writeUint32(BASEENV_SXP);
      else {
        throw new RUnsupportedFeatureError(
          "NRU6192",
          "Serialization of ordinary environments is not yet supported.",
        );
      }
      return;
    }
    if (value.type === "symbol") {
      this.#writeUint32(SYMSXP);
      this.#writeCharacterScalar(value.name, false);
      return;
    }
    if (value.type === "pairlist") {
      this.#writePairlist(value, depth + 1);
      return;
    }
    if (value.type === "logical" || value.type === "integer") {
      this.#writeVectorHeader(value.type === "logical" ? LGLSXP : INTSXP, value);
      this.#writeLength(value.length);
      for (let index = 0; index < value.length; index += 1) {
        this.#writeInt32(isMissing(value, index) ? INTEGER_NA : (value.values[index] ?? 0));
      }
      this.#writeTrailingAttributes(value, depth + 1);
      return;
    }
    if (value.type === "double") {
      this.#writeVectorHeader(REALSXP, value);
      this.#writeLength(value.length);
      for (let index = 0; index < value.length; index += 1) {
        if (isMissing(value, index)) this.#writeMissingDouble();
        else this.#writeDouble(value.values[index] ?? 0);
      }
      this.#writeTrailingAttributes(value, depth + 1);
      return;
    }
    if (value.type === "complex") {
      this.#writeVectorHeader(CPLXSXP, value);
      this.#writeLength(value.length);
      for (let index = 0; index < value.length; index += 1) {
        if (isMissing(value, index)) {
          this.#writeMissingDouble();
          this.#writeMissingDouble();
        } else {
          this.#writeDouble(value.real[index] ?? 0);
          this.#writeDouble(value.imaginary[index] ?? 0);
        }
      }
      this.#writeTrailingAttributes(value, depth + 1);
      return;
    }
    if (value.type === "character") {
      this.#writeVectorHeader(STRSXP, value);
      this.#writeLength(value.length);
      for (let index = 0; index < value.length; index += 1) {
        this.#writeCharacterScalar(
          value.values[index] ?? "",
          isMissing(value, index),
          characterEncodingAt(value, index),
          characterBytesAt(value, index),
        );
      }
      this.#writeTrailingAttributes(value, depth + 1);
      return;
    }
    if (value.type === "raw") {
      this.#writeVectorHeader(RAWSXP, value);
      this.#writeLength(value.length);
      this.#writeBytes(value.values);
      this.#writeTrailingAttributes(value, depth + 1);
      return;
    }
    if (value.type === "list") {
      this.#writeVectorHeader(VECSXP, value);
      this.#writeLength(value.length);
      for (const entry of value.values) this.#writeItem(entry, depth + 1);
      this.#writeTrailingAttributes(value, depth + 1);
      return;
    }
    throw new RUnsupportedFeatureError(
      "NRU6192",
      `Serialization of NativR value type '${value.type}' is not yet supported.`,
    );
  }

  #writeVectorHeader(type: number, value: RVector): void {
    const attributes = this.#serializedAttributes(value);
    const object = attributes.has("class") ? OBJECT_BIT : 0;
    this.#writeUint32(type | object | (attributes.size > 0 ? ATTRIBUTE_BIT : 0));
  }

  #writeTrailingAttributes(value: RVector, depth: number): void {
    const attributes = this.#serializedAttributes(value);
    if (attributes.size > 0) this.#writeAttributePairlist(attributes, depth);
  }

  #serializedAttributes(value: RVector | RPairlist): ReadonlyMap<string, RValue> {
    if (value.attributes.size === 0) return value.attributes;
    const attributes = new Map(value.attributes);
    if (value.type === "pairlist") attributes.delete("names");
    if (value.type === "list" && value.automaticRowNames === true) {
      const rowNames = attributes.get("row.names");
      if (rowNames?.type === "character") {
        attributes.set("row.names", integerVector([0, -rowNames.length], [1, 0]));
      }
    }
    return attributes;
  }

  #writePairlist(value: RPairlist, depth: number): void {
    const names = vectorNames(value);
    const attributes = this.#serializedAttributes(value);
    this.#writePairlistNode(value.values, names, attributes, 0, depth);
  }

  #writeAttributePairlist(attributes: ReadonlyMap<string, RValue>, depth: number): void {
    const entries = [...attributes.entries()];
    this.#writePairlistNode(
      entries.map((entry) => entry[1]),
      entries.map((entry) => entry[0]),
      new Map(),
      0,
      depth,
    );
  }

  #writePairlistNode(
    values: readonly RValue[],
    names: readonly string[] | undefined,
    attributes: ReadonlyMap<string, RValue>,
    index: number,
    depth: number,
  ): void {
    if (index >= values.length) {
      this.#writeUint32(NILVALUE_SXP);
      return;
    }
    const name = names?.[index] ?? "";
    const firstAttributes = index === 0 ? attributes : new Map<string, RValue>();
    this.#writeUint32(
      LISTSXP | (firstAttributes.size > 0 ? ATTRIBUTE_BIT : 0) | (name.length > 0 ? TAG_BIT : 0),
    );
    if (firstAttributes.size > 0) this.#writeAttributePairlist(firstAttributes, depth + 1);
    if (name.length > 0) this.#writeItem({ type: "symbol", name }, depth + 1);
    this.#writeItem(values[index] ?? R_NULL, depth + 1);
    this.#writePairlistNode(values, names, attributes, index + 1, depth + 1);
  }

  #writeCharacterScalar(
    value: string,
    missing: boolean,
    encoding: RCharacterEncoding = "UTF-8",
    encodedBytes?: Uint8Array,
  ): void {
    if (missing) {
      this.#writeUint32(CHARSXP);
      this.#writeInt32(-1);
      return;
    }
    const bytes = encodedBytes ?? encodeUtf8(value);
    const ascii = bytes.every((byte) => byte <= 0x7f);
    const gp =
      ascii || encoding === "unknown"
        ? ascii
          ? 64
          : 0
        : encoding === "UTF-8"
          ? 8
          : encoding === "latin1"
            ? 4
            : 2;
    this.#writeUint32(CHARSXP | (gp << 12));
    this.#writeLength(bytes.byteLength);
    this.#writeBytes(bytes);
  }

  #writeLength(length: number): void {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > this.#context.limits.maxVectorLength
    ) {
      throw new RResourceLimitError("NRL4002", "Serialized vector length limit exceeded.");
    }
    this.#writeInt32(length);
  }

  #writeMissingDouble(): void {
    this.#writeUint32(XDR_NA_HIGH);
    this.#writeUint32(XDR_NA_LOW);
  }

  #writeDouble(value: number): void {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, false);
    this.#writeBytes(new Uint8Array(buffer));
  }

  #writeInt32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setInt32(0, value, false);
    this.#writeBytes(new Uint8Array(buffer));
  }

  #writeUint32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, value >>> 0, false);
    this.#writeBytes(new Uint8Array(buffer));
  }

  #writeAscii(value: string): void {
    this.#writeBytes(Uint8Array.from(value, (character) => character.codePointAt(0) ?? 0));
  }

  #writeBytes(bytes: Uint8Array): void {
    const requested = this.#output.length + bytes.byteLength;
    if (requested > this.#context.limits.maxOutputBytes) {
      throw new RResourceLimitError("NRL4007", "Serialized output byte limit exceeded.", {
        details: { maxOutputBytes: this.#context.limits.maxOutputBytes, outputBytes: requested },
      });
    }
    for (const byte of bytes) this.#output.push(byte);
  }
}

class XdrSerializationReader {
  readonly #bytes: Uint8Array;
  readonly #view: DataView;
  readonly #context: OperatorContext;
  readonly #environments: RSerializationEnvironments;
  readonly #references: RValue[] = [];
  #offset = 0;
  #nativeEncoding = "UTF-8";

  public constructor(
    bytes: Uint8Array,
    context: OperatorContext,
    environments: RSerializationEnvironments,
  ) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.#context = context;
    this.#environments = environments;
  }

  public read(): RDecodedSerialization {
    let workspace = false;
    if (this.#matchesAscii("RDX2\n") || this.#matchesAscii("RDX3\n")) {
      workspace = true;
      this.#offset += WORKSPACE_HEADER_BYTES;
    } else if (this.#matchesAscii("RDA2\n") || this.#matchesAscii("RDA3\n")) {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        "ASCII R workspace serialization is not yet available.",
      );
    }
    const marker = this.#readBytes(SERIALIZATION_HEADER_BYTES);
    const format =
      marker[0] === 0x58 && marker[1] === 0x0a
        ? "xdr"
        : marker[0] === 0x42 && marker[1] === 0x0a
          ? "binary"
          : marker[0] === 0x41 && marker[1] === 0x0a
            ? "ascii"
            : undefined;
    if (format !== "xdr") {
      if (format === "binary" || format === "ascii") {
        throw new RUnsupportedFeatureError(
          "NRU6192",
          `${format === "binary" ? "Native-endian" : "ASCII"} R serialization is not yet available.`,
        );
      }
      throw new REvaluationError("NRE2247", "Unknown R serialization header.");
    }
    const version = this.#readInt32();
    if (version !== 2 && version !== 3) {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        `R serialization version ${String(version)} is not supported.`,
      );
    }
    const writerVersion = unpackRVersion(this.#readUint32());
    const minimumReaderVersion = unpackRVersion(this.#readUint32());
    if (version === 3) {
      const encodingLength = this.#readLength("native encoding");
      this.#nativeEncoding = this.#decodeBytes(this.#readBytes(encodingLength), "native");
    }
    const value = this.#readItem(0);
    if (this.#offset !== this.#bytes.byteLength) {
      throw new REvaluationError("NRE2247", "Trailing bytes follow the serialized R object.");
    }
    return {
      value,
      metadata: {
        format,
        version,
        writerVersion,
        minimumReaderVersion,
        ...(version === 3 ? { nativeEncoding: this.#nativeEncoding } : {}),
        workspace,
      },
    };
  }

  #readItem(depth: number): RValue {
    this.#context.checkpoint();
    if (depth > this.#context.limits.maxCallDepth) {
      throw new RResourceLimitError("NRL4004", "Serialized object nesting limit exceeded.");
    }
    const flags = this.#readUint32();
    const type = flags & 0xff;
    if (type === NILVALUE_SXP) return R_NULL;
    if (type === GLOBALENV_SXP)
      return this.#requiredEnvironment("global", this.#environments.global);
    if (type === BASEENV_SXP) return this.#requiredEnvironment("base", this.#environments.base);
    if (type === BASENAMESPACE_SXP) {
      return this.#requiredEnvironment(
        "base namespace",
        this.#environments.baseNamespace ?? this.#environments.base,
      );
    }
    if (type === EMPTYENV_SXP) return this.#requiredEnvironment("empty", this.#environments.empty);
    if (type === MISSINGARG_SXP || type === UNBOUNDVALUE_SXP) {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        `${type === MISSINGARG_SXP ? "Missing-argument" : "Unbound"} serialization values are unavailable outside evaluator bindings.`,
      );
    }
    if (type === NAMESPACE_SXP || type === PACKAGES_SXP) {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        "Serialized package and namespace environment references are not yet available.",
      );
    }
    if (type === REFSXP) return this.#readReference(flags);
    if (type === ALTREP_SXP) return this.#readAltrep(depth + 1);
    if (type === SYMSXP) return this.#readSymbol(depth + 1);
    if (type === LISTSXP) return this.#readPairlist(flags, depth + 1);
    if (type === LANGSXP) {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        "Serialized language objects are not yet available in the normalized AST runtime.",
      );
    }
    if (type === CHARSXP) return this.#readCharacterScalar(flags);
    if (type === LGLSXP || type === INTSXP) return this.#readIntegerVector(type, flags, depth + 1);
    if (type === REALSXP) return this.#readDoubleVector(flags, depth + 1);
    if (type === CPLXSXP) return this.#readComplexVector(flags, depth + 1);
    if (type === STRSXP) return this.#readCharacterVector(flags, depth + 1);
    if (type === VECSXP) return this.#readList(flags, depth + 1);
    if (type === EXPRSXP) {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        "Serialized expression vectors are not yet available in the normalized AST runtime.",
      );
    }
    if (type === RAWSXP) return this.#readRawVector(flags, depth + 1);
    throw new RUnsupportedFeatureError(
      "NRU6192",
      `Serialized SEXPTYPE ${String(type)} is not yet supported.`,
      { details: { sexptype: type } },
    );
  }

  #readSymbol(depth: number): RValue {
    const printName = this.#readItem(depth);
    if (printName.type !== "character" || printName.length !== 1 || isMissing(printName, 0)) {
      throw new REvaluationError("NRE2247", "A serialized symbol has an invalid print name.");
    }
    const symbol = { type: "symbol" as const, name: printName.values[0] ?? "" };
    this.#references.push(symbol);
    return symbol;
  }

  #readReference(flags: number): RValue {
    let index = flags >>> 8;
    if (index === 0) index = this.#readUint32();
    const referenced = this.#references[index - 1];
    if (referenced === undefined) {
      throw new REvaluationError("NRE2247", "Serialized reference index is invalid.");
    }
    return referenced;
  }

  #readPairlist(flags: number, depth: number): RPairlist {
    const attributes = (flags & ATTRIBUTE_BIT) === 0 ? new Map() : this.#readAttributes(depth);
    const tag = (flags & TAG_BIT) === 0 ? undefined : this.#readItem(depth);
    if (tag !== undefined && tag.type !== "symbol") {
      throw new REvaluationError("NRE2247", "A serialized pairlist tag is not a symbol.");
    }
    const car = this.#readItem(depth);
    const cdr = this.#readItem(depth);
    if (cdr.type !== "null" && cdr.type !== "pairlist") {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        "Improper serialized pairlists are unavailable.",
      );
    }
    const tailValues = cdr.type === "pairlist" ? cdr.values : [];
    const tailNames = cdr.type === "pairlist" ? vectorNames(cdr) : undefined;
    const anyTags = tag !== undefined || tailNames !== undefined;
    const names = anyTags
      ? [
          tag?.name ?? "",
          ...Array.from({ length: tailValues.length }, (_, index) => tailNames?.[index] ?? ""),
        ]
      : undefined;
    let result = pairlistValue([car, ...tailValues], names);
    result = this.#applyAttributes(result, attributes) as RPairlist;
    return result;
  }

  #readCharacterScalar(flags: number): RCharacterVector {
    const length = this.#readInt32();
    if (length === -1) return characterVector([""], [1]);
    if (length < 0) throw new REvaluationError("NRE2247", "Invalid serialized string length.");
    this.#context.allocate(length);
    const gp = flags >>> 12;
    const encoding: RCharacterEncoding =
      (gp & 8) !== 0 ? "UTF-8" : (gp & 4) !== 0 ? "latin1" : (gp & 2) !== 0 ? "bytes" : "unknown";
    const decoder = encoding === "UTF-8" ? "utf8" : encoding === "unknown" ? "native" : encoding;
    const bytes = this.#readBytes(length);
    return characterVector([this.#decodeBytes(bytes, decoder)], undefined, [encoding], [bytes]);
  }

  #readIntegerVector(type: number, flags: number, depth: number): RVector {
    const length = this.#readLength("integer vector");
    this.#context.allocate(length);
    const values = new Int32Array(length);
    const missing = new Uint8Array(length);
    let hasMissing = false;
    for (let index = 0; index < length; index += 1) {
      if (index % 4_096 === 0) this.#context.checkpoint();
      const value = this.#readInt32();
      if (value === INTEGER_NA) {
        missing[index] = 1;
        hasMissing = true;
      } else {
        values[index] = value;
      }
    }
    const output =
      type === LGLSXP
        ? logicalVector(values, hasMissing ? missing : undefined)
        : integerVector(values, hasMissing ? missing : undefined);
    return this.#readTrailingAttributes(output, flags, depth);
  }

  #readDoubleVector(flags: number, depth: number): RVector {
    const length = this.#readLength("double vector");
    this.#context.allocate(length);
    const values = new Float64Array(length);
    const missing = new Uint8Array(length);
    let hasMissing = false;
    for (let index = 0; index < length; index += 1) {
      if (index % 4_096 === 0) this.#context.checkpoint();
      const value = this.#readXdrDouble();
      if (value.missing) {
        missing[index] = 1;
        hasMissing = true;
      } else {
        values[index] = value.value;
      }
    }
    return this.#readTrailingAttributes(
      doubleVector(values, hasMissing ? missing : undefined),
      flags,
      depth,
    );
  }

  #readComplexVector(flags: number, depth: number): RVector {
    const length = this.#readLength("complex vector");
    this.#context.allocate(length);
    const real = new Float64Array(length);
    const imaginary = new Float64Array(length);
    const missing = new Uint8Array(length);
    let hasMissing = false;
    for (let index = 0; index < length; index += 1) {
      if (index % 2_048 === 0) this.#context.checkpoint();
      const realPart = this.#readXdrDouble();
      const imaginaryPart = this.#readXdrDouble();
      if (realPart.missing || imaginaryPart.missing) {
        missing[index] = 1;
        hasMissing = true;
      } else {
        real[index] = realPart.value;
        imaginary[index] = imaginaryPart.value;
      }
    }
    return this.#readTrailingAttributes(
      complexVector(real, imaginary, hasMissing ? missing : undefined),
      flags,
      depth,
    );
  }

  #readCharacterVector(flags: number, depth: number): RVector {
    const length = this.#readLength("character vector");
    this.#context.allocate(length);
    const values: string[] = [];
    const encodings: RCharacterEncoding[] = [];
    const byteValues: Uint8Array[] = [];
    const missing = new Uint8Array(length);
    let hasMissing = false;
    for (let index = 0; index < length; index += 1) {
      const entry = this.#readItem(depth);
      if (entry.type !== "character" || entry.length !== 1) {
        throw new REvaluationError("NRE2247", "Invalid serialized character-vector element.");
      }
      if (isMissing(entry, 0)) {
        missing[index] = 1;
        hasMissing = true;
        values.push("");
        encodings.push("unknown");
        byteValues.push(new Uint8Array());
      } else {
        values.push(entry.values[0] ?? "");
        encodings.push(characterEncodingAt(entry, 0));
        byteValues.push(characterBytesAt(entry, 0));
      }
    }
    return this.#readTrailingAttributes(
      characterVector(values, hasMissing ? missing : undefined, encodings, byteValues),
      flags,
      depth,
    );
  }

  #readList(flags: number, depth: number): RList {
    const length = this.#readLength("list");
    this.#context.allocate(length);
    const values: RValue[] = [];
    for (let index = 0; index < length; index += 1) values.push(this.#readItem(depth));
    return this.#readTrailingAttributes(listValue(values), flags, depth) as RList;
  }

  #readRawVector(flags: number, depth: number): RVector {
    const length = this.#readLength("raw vector");
    this.#context.allocate(length);
    return this.#readTrailingAttributes(rawVector(this.#readBytes(length)), flags, depth);
  }

  #readAltrep(depth: number): RValue {
    const info = this.#readItem(depth);
    const state = this.#readItem(depth);
    const attributes = this.#readAttributesValue(this.#readItem(depth));
    if (info.type !== "pairlist" || info.length < 3) {
      throw new REvaluationError("NRE2247", "Serialized ALTREP class information is malformed.");
    }
    const className = info.values[0];
    const packageName = info.values[1];
    if (
      className?.type !== "symbol" ||
      packageName?.type !== "symbol" ||
      packageName.name !== "base" ||
      (className.name !== "compact_intseq" && className.name !== "compact_realseq") ||
      state.type !== "double" ||
      state.length !== 3 ||
      state.missing !== undefined
    ) {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        "This serialized ALTREP class is not yet supported.",
      );
    }
    const length = state.values[0] ?? -1;
    const start = state.values[1] ?? 0;
    const step = state.values[2] ?? 0;
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > this.#context.limits.maxVectorLength
    ) {
      throw new RResourceLimitError("NRL4002", "Serialized ALTREP length limit exceeded.");
    }
    this.#context.allocate(length);
    if (className.name === "compact_intseq") {
      const values = new Int32Array(length);
      for (let index = 0; index < length; index += 1) {
        const value = start + index * step;
        if (!Number.isInteger(value) || value < -2_147_483_647 || value > 2_147_483_647) {
          throw new REvaluationError("NRE2247", "Serialized compact integer sequence is invalid.");
        }
        values[index] = value;
      }
      return this.#applyAttributes(integerVector(values), attributes);
    }
    const values = new Float64Array(length);
    for (let index = 0; index < length; index += 1) values[index] = start + index * step;
    return this.#applyAttributes(doubleVector(values), attributes);
  }

  #readTrailingAttributes(value: RVector, flags: number, depth: number): RVector {
    return (flags & ATTRIBUTE_BIT) === 0
      ? value
      : (this.#applyAttributes(value, this.#readAttributes(depth)) as RVector);
  }

  #readAttributes(depth: number): RAttributes {
    return this.#readAttributesValue(this.#readItem(depth));
  }

  #readAttributesValue(value: RValue): RAttributes {
    if (value.type === "null") return new Map();
    if (value.type !== "pairlist") {
      throw new REvaluationError("NRE2247", "Serialized attributes are not a pairlist.");
    }
    const names = vectorNames(value);
    if (names === undefined || names.some((name) => name.length === 0)) {
      throw new REvaluationError("NRE2247", "Serialized attributes contain an unnamed entry.");
    }
    return new Map(value.values.map((entry, index) => [names[index] ?? "", entry]));
  }

  #applyAttributes(value: RVector | RPairlist, attributes: RAttributes): RVector | RPairlist {
    if (attributes.size === 0) return value;
    const normalized = new Map(attributes);
    let automaticRowNames = false;
    const classes = normalized.get("class");
    const rowNames = normalized.get("row.names");
    if (
      value.type === "list" &&
      classes?.type === "character" &&
      classes.values.includes("data.frame") &&
      rowNames?.type === "integer" &&
      rowNames.length === 2 &&
      isMissing(rowNames, 0) &&
      !isMissing(rowNames, 1) &&
      (rowNames.values[1] ?? 0) <= 0
    ) {
      const rowCount = -(rowNames.values[1] ?? 0);
      normalized.set(
        "row.names",
        characterVector(Array.from({ length: rowCount }, (_, index) => String(index + 1))),
      );
      automaticRowNames = true;
    }
    return {
      ...value,
      attributes: normalized,
      ...(value.type === "list" && automaticRowNames ? { automaticRowNames: true } : {}),
    };
  }

  #requiredEnvironment(name: string, value: REnvironment | undefined): REnvironment {
    if (value === undefined) {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        `Serialized ${name} environment references are unavailable in this context.`,
      );
    }
    return value;
  }

  #readLength(label: string): number {
    const length = this.#readInt32();
    if (length >= 0) {
      if (length > this.#context.limits.maxVectorLength) {
        throw new RResourceLimitError("NRL4002", `Serialized ${label} length limit exceeded.`, {
          details: { maxVectorLength: this.#context.limits.maxVectorLength, requested: length },
        });
      }
      return length;
    }
    if (length !== -1) throw new REvaluationError("NRE2247", `Invalid serialized ${label} length.`);
    const high = this.#readUint32();
    const low = this.#readUint32();
    const combined = high * 0x1_0000_0000 + low;
    if (!Number.isSafeInteger(combined) || combined > this.#context.limits.maxVectorLength) {
      throw new RResourceLimitError("NRL4002", `Serialized ${label} length limit exceeded.`, {
        details: { maxVectorLength: this.#context.limits.maxVectorLength, requested: combined },
      });
    }
    return combined;
  }

  #readXdrDouble(): { readonly value: number; readonly missing: boolean } {
    this.#requireBytes(8);
    const high = this.#view.getUint32(this.#offset, false);
    const low = this.#view.getUint32(this.#offset + 4, false);
    const value = this.#view.getFloat64(this.#offset, false);
    this.#offset += 8;
    return high === XDR_NA_HIGH && low === XDR_NA_LOW
      ? { value: 0, missing: true }
      : { value, missing: false };
  }

  #readInt32(): number {
    this.#requireBytes(4);
    const value = this.#view.getInt32(this.#offset, false);
    this.#offset += 4;
    return value;
  }

  #readUint32(): number {
    this.#requireBytes(4);
    const value = this.#view.getUint32(this.#offset, false);
    this.#offset += 4;
    return value;
  }

  #readBytes(length: number): Uint8Array {
    this.#requireBytes(length);
    const value = this.#bytes.subarray(this.#offset, this.#offset + length);
    this.#offset += length;
    return value;
  }

  #requireBytes(length: number): void {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      this.#offset + length > this.#bytes.byteLength
    ) {
      throw new REvaluationError("NRE2247", "Unexpected end of R serialization.");
    }
  }

  #matchesAscii(text: string): boolean {
    if (this.#offset + text.length > this.#bytes.byteLength) return false;
    for (let index = 0; index < text.length; index += 1) {
      if (this.#bytes[this.#offset + index] !== text.charCodeAt(index)) return false;
    }
    return true;
  }

  #decodeBytes(bytes: Uint8Array, encoding: "utf8" | "latin1" | "bytes" | "native"): string {
    const selected = encoding === "native" ? this.#nativeEncoding.toLowerCase() : encoding;
    if (selected === "latin1" || selected === "iso-8859-1" || selected === "bytes") {
      let output = "";
      for (let offset = 0; offset < bytes.length; offset += 8_192) {
        output += String.fromCodePoint(...bytes.subarray(offset, offset + 8_192));
      }
      return output;
    }
    if (selected !== "utf8" && selected !== "utf-8") {
      throw new RUnsupportedFeatureError(
        "NRU6192",
        `Serialized native encoding '${this.#nativeEncoding}' is not yet supported.`,
      );
    }
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
      throw new REvaluationError("NRE2247", "Serialized character data is not valid UTF-8.");
    }
  }
}

function unpackRVersion(packed: number): string {
  const major = packed >>> 16;
  const minor = (packed >>> 8) & 0xff;
  const patch = packed & 0xff;
  return `${String(major)}.${String(minor)}.${String(patch)}`;
}
