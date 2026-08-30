import { describe, expect, it } from "vitest";

import {
  EvaluationContext,
  RResourceLimitError,
  RUnsupportedFeatureError,
  characterBytesAt,
  characterEncodingAt,
  characterVector,
  decodeRBase64Resource,
  decodeRSerialization,
  decodeRSerializationFile,
  decodeRWorkspaceFile,
  encodeRSerialization,
  encodeRSerializationFile,
  integerVector,
  isCanonicalBase64,
  isMissing,
  listValue,
  pairlistValue,
  vectorClasses,
  vectorNames,
} from "../src/index.js";

describe("canonical base64 validation", () => {
  it("accepts canonical padding and validates large resources without recursive matching", () => {
    expect(["", "AA==", "AAA=", "AAAA"].map(isCanonicalBase64)).toEqual([true, true, true, true]);
    expect(isCanonicalBase64("A".repeat(1_000_000))).toBe(true);
  });

  it("rejects malformed alphabets, padding, and non-zero unused bits", () => {
    expect(["A", "AB==", "AAB=", "AA=A", "AA==AAAA", "AAAA茅"].map(isCanonicalBase64)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("bounds transport bytes independently from the R vector-length budget", () => {
    const transportContext = new EvaluationContext(
      { maxSteps: 100, maxCallDepth: 10, maxVectorLength: 1, maxOutputBytes: 100 },
      { cancelled: false },
    );
    expect(decodeRBase64Resource("AAAA", transportContext)).toEqual(new Uint8Array(3));
  });

  it("accepts a distinct reviewed input ceiling for immutable package resources", () => {
    const context = new EvaluationContext(
      { maxSteps: 100, maxCallDepth: 10, maxVectorLength: 10, maxOutputBytes: 2 },
      { cancelled: false },
    );
    expect(() => decodeRBase64Resource("AAAA", context)).toThrow(RResourceLimitError);
    expect(decodeRBase64Resource("AAAA", context, 3)).toEqual(new Uint8Array(3));
  });
});

// These byte sequences are observable outputs from GNU R 4.6.0 serialize()/save(), generated
// without inspecting implementation source. Their structure is documented by R Internals 1.8.
const FIXTURES = {
  logical: "580a0000000200040600000203000000000a00000003000000010000000080000000",
  double:
    "580a0000000200040600000203000000000e000000053ff80000000000007ff00000000007a27ff80000000000007ff0000000000000fff0000000000000",
  character:
    "580a00000002000406000002030000000010000000030004000900000001610000800900000002c3a900000009ffffffff",
  characterEncodings:
    "580a00000002000406000002030000000010000000040000800900000002c3a90000400900000002c3a90000200900000002c3a90000000900000002c3a9",
  list: "580a00000002000406000002030000000213000000020000000d00000001000000010000001000000001000400090000000178000004020000000100040009000000056e616d65730000001000000002000400090000000161000400090000000162000000fe",
  dataFrame:
    "580a00000002000406000002030000000313000000020000000d0000000200000001000000020000001000000002000400090000000178000400090000000179000004020000000100040009000000056e616d6573000000100000000200040009000000016100040009000000016200000402000000010004000900000005636c6173730000001000000001000400090000000a646174612e6672616d6500000402000000010004000900000009726f772e6e616d65730000000d0000000280000000fffffffe000000fe",
  workspace:
    "524458320a580a00000002000406000002030000000402000000010004000900000001610000000d00000002000000010000000200000402000000010004000900000001620000001000000001000400090000000178000000fe",
  externalPointer: "580a000000030004060000030500000000055554462d3800000016000000fe000000fe",
  attributedExternalPointer:
    "580a000000030004060000030500000000055554462d3800000216000000fe000000fe00000402000000010004000900000003666f6f0000000d0000000100000001000000fe",
  compactIntegerSequence:
    "580a000000030004060000030500000000055554462d38000000ee0000000200000001000400090000000e636f6d706163745f696e747365710000000200000001000400090000000462617365000000020000000d000000010000000d000000fe0000000e0000000340080000000000003ff00000000000003ff0000000000000000000fe",
  compressedWorkspace:
    "1f8b08000000000000060b728930e28ae0626060606260610392cc40260b139060646061e004d2eca91589b90539a90c0cccc260650c0c0210e56069c64418230948f04255304268148358f31273538bd1b4b3e62426a5e6c038658939a5a9e8da9273128b61da60825c298925897a69454013d1947316e597ebc16c023ba70148fcffffff1f90026300638b5ebdf3000000",
  s4Object:
    "580a000000030004060000030500000000055554462d38000103190000040200000001000400090000000576616c75650000000e000000023ff80000000000004004000000000000000004020000000100040009000000056c6162656c0000001000000001000400090000000355544300000402000000010004000900000005636c617373000002100000000100040009000000104e6174697652436c6f636b50726f6265000004020000000100040009000000077061636b6167650000001000000001000400090000000a2e476c6f62616c456e76000000fe000000fe",
} as const;

describe("GNU R serialization decoder", () => {
  it("round-trips browser-safe null-address external pointers and attributes", () => {
    const plain = decodeRSerialization(hex(FIXTURES.externalPointer), context()).value;
    expect(plain).toMatchObject({
      type: "externalptr",
      protectedValue: { type: "null" },
      tag: { type: "null" },
    });
    const attributed = decodeRSerialization(
      hex(FIXTURES.attributedExternalPointer),
      context(),
    ).value;
    expect(attributed.type).toBe("externalptr");
    if (attributed.type !== "externalptr") throw new Error("Expected an external pointer.");
    expect(attributed.attributes.get("foo")).toMatchObject({ type: "integer", length: 1 });
    expect(encodeRSerialization(plain, context())).toEqual(hex(FIXTURES.externalPointer));
    expect(encodeRSerialization(attributed, context())).toEqual(
      hex(FIXTURES.attributedExternalPointer),
    );
  });
  it("decodes atomic vectors while preserving R NA separately from NaN", () => {
    const logical = decodeRSerialization(hex(FIXTURES.logical), context()).value;
    expect(logical).toMatchObject({ type: "logical", values: new Uint8Array([1, 0, 0]) });
    expect(logical.type === "logical" && isMissing(logical, 2)).toBe(true);

    const doubles = decodeRSerialization(hex(FIXTURES.double), context()).value;
    expect(doubles.type).toBe("double");
    if (doubles.type !== "double") return;
    expect(doubles.values[0]).toBe(1.5);
    expect(isMissing(doubles, 1)).toBe(true);
    expect(Number.isNaN(doubles.values[2])).toBe(true);
    expect(doubles.values[3]).toBe(Number.POSITIVE_INFINITY);
    expect(doubles.values[4]).toBe(Number.NEGATIVE_INFINITY);

    const characters = decodeRSerialization(hex(FIXTURES.character), context()).value;
    expect(characters).toMatchObject({ type: "character", values: ["a", "é", ""] });
    expect(characters.type === "character" && isMissing(characters, 2)).toBe(true);
  });

  it("decodes named lists, attributes, and compact data-frame row names", () => {
    const list = decodeRSerialization(hex(FIXTURES.list), context()).value;
    expect(list.type).toBe("list");
    if (list.type !== "list") return;
    expect(vectorNames(list)).toEqual(["a", "b"]);
    expect(list.values[0]).toMatchObject({ type: "integer", values: new Int32Array([1]) });

    const frame = decodeRSerialization(hex(FIXTURES.dataFrame), context()).value;
    expect(frame.type).toBe("list");
    if (frame.type !== "list") return;
    expect(vectorClasses(frame)).toEqual(["data.frame"]);
    expect(frame.automaticRowNames).toBe(true);
    expect(frame.attributes.get("row.names")).toMatchObject({
      type: "character",
      values: ["1", "2"],
    });
  });

  it("preserves observable UTF-8, latin1, bytes, and native character marks", () => {
    const observed = decodeRSerialization(hex(FIXTURES.characterEncodings), context()).value;
    expect(observed.type).toBe("character");
    if (observed.type !== "character") return;
    expect(
      Array.from({ length: observed.length }, (_, index) => characterEncodingAt(observed, index)),
    ).toEqual(["UTF-8", "latin1", "bytes", "unknown"]);
    for (let index = 0; index < observed.length; index += 1) {
      expect(Array.from(characterBytesAt(observed, index))).toEqual([0xc3, 0xa9]);
    }
    expect(toHex(encodeRSerialization(observed, context(), {}, { version: 2 }))).toBe(
      FIXTURES.characterEncodings,
    );
  });

  it("decodes named save() workspaces and version-3 compact integer ALTREP", async () => {
    const workspace = await decodeRWorkspaceFile(hex(FIXTURES.workspace), context());
    expect(workspace.metadata).toMatchObject({ version: 2, format: "xdr", workspace: true });
    expect(workspace.entries.map((entry) => entry.name)).toEqual(["a", "b"]);

    const sequence = decodeRSerialization(hex(FIXTURES.compactIntegerSequence), context());
    expect(sequence.metadata).toMatchObject({
      version: 3,
      nativeEncoding: "UTF-8",
      workspace: false,
    });
    expect(sequence.value).toMatchObject({
      type: "integer",
      values: new Int32Array([1, 2, 3]),
    });
  });

  it("decodes ASCII native-encoding aliases and rejects non-ASCII native bytes", () => {
    for (const encoding of ["ASCII", "US-ASCII", "ANSI_X3.4-1968", "646", "ISO646-US"]) {
      const fixture = withVersion3NativeEncoding(
        encodeRSerialization(characterVector(["ascii"]), context(), {}, { version: 3 }),
        encoding,
      );
      const decoded = decodeRSerialization(fixture, context());
      expect(decoded.metadata.nativeEncoding).toBe(encoding);
      expect(decoded.value).toMatchObject({ type: "character", values: ["ascii"] });
    }

    const invalid = withVersion3NativeEncoding(
      encodeRSerialization(characterVector(["ascii"]), context(), {}, { version: 3 }),
      "ANSI_X3.4-1968",
    );
    invalid[invalid.length - 1] = 0xe9;
    expect(() => decodeRSerialization(invalid, context())).toThrowError(
      "Serialized character data is not valid ANSI_X3.4-1968.",
    );
  });

  it("decodes and re-encodes GNU R S4 objects without package-specific knowledge", () => {
    const decoded = decodeRSerialization(hex(FIXTURES.s4Object), context());
    expect(decoded.value.type).toBe("list");
    if (decoded.value.type !== "list") return;
    expect(decoded.value.s4).toBe(true);
    expect(vectorNames(decoded.value)).toEqual(["value", "label"]);
    expect(vectorClasses(decoded.value)).toEqual(["NativRClockProbe"]);
    expect(decoded.value.values[0]).toMatchObject({
      type: "double",
      values: new Float64Array([1.5, 2.5]),
    });
    expect(decoded.value.values[1]).toMatchObject({ type: "character", values: ["UTC"] });
    expect(toHex(encodeRSerialization(decoded.value, context()))).toBe(FIXTURES.s4Object);
  });

  it("unwraps default gzip-compressed package data and enforces limits", async () => {
    const workspace = await decodeRWorkspaceFile(hex(FIXTURES.compressedWorkspace), context());
    expect(workspace.entries).toHaveLength(1);
    expect(workspace.entries[0]?.name).toBe("example");
    expect(workspace.entries[0]?.value).toMatchObject({ type: "list", automaticRowNames: true });

    await expect(
      decodeRSerializationFile(
        hex(FIXTURES.compressedWorkspace),
        new EvaluationContext(
          { maxSteps: 100, maxCallDepth: 10, maxVectorLength: 1_000, maxOutputBytes: 32 },
          { cancelled: false },
        ),
      ),
    ).rejects.toBeInstanceOf(RResourceLimitError);
    expect(() =>
      decodeRSerialization(hex("410a000000020004060000020300000000fe"), context()),
    ).toThrow(RUnsupportedFeatureError);
  });

  it("writes GNU R XDR v2/v3 objects and gzip workspace files", async () => {
    const observedList = listValue([integerVector([1]), characterVector(["x"])], ["a", "b"]);
    expect(toHex(encodeRSerialization(observedList, context(), {}, { version: 2 }))).toBe(
      FIXTURES.list,
    );

    const value = listValue([integerVector([1, 2]), characterVector(["x"])], ["a", "b"]);
    for (const version of [2, 3] as const) {
      const encoded = encodeRSerialization(value, context(), {}, { version });
      const decoded = decodeRSerialization(encoded, context());
      expect(decoded.metadata).toMatchObject({ version, format: "xdr", workspace: false });
      expect(decoded.value).toEqual(value);
    }

    const workspace = pairlistValue([integerVector([1, 2])], ["answer"]);
    const encoded = await encodeRSerializationFile(
      workspace,
      context(),
      {},
      {
        version: 3,
        workspace: true,
        compress: true,
      },
    );
    expect(Array.from(encoded.slice(0, 2))).toEqual([0x1f, 0x8b]);
    await expect(decodeRWorkspaceFile(encoded, context())).resolves.toMatchObject({
      entries: [{ name: "answer", value: { type: "integer", values: new Int32Array([1, 2]) } }],
    });
  });
});

function context(): EvaluationContext {
  return new EvaluationContext(
    { maxSteps: 10_000, maxCallDepth: 100, maxVectorLength: 10_000, maxOutputBytes: 100_000 },
    { cancelled: false },
  );
}

function hex(source: string): Uint8Array {
  return Uint8Array.from(source.match(/../gu) ?? [], (byte) => Number.parseInt(byte, 16));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function withVersion3NativeEncoding(bytes: Uint8Array, encoding: string): Uint8Array {
  const headerLength = 14;
  const sourceLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    headerLength,
  );
  const encodedName = Uint8Array.from(encoding, (character) => character.charCodeAt(0));
  const output = new Uint8Array(bytes.byteLength - sourceLength + encodedName.byteLength);
  output.set(bytes.subarray(0, headerLength), 0);
  new DataView(output.buffer).setUint32(headerLength, encodedName.byteLength);
  output.set(encodedName, headerLength + 4);
  output.set(
    bytes.subarray(headerLength + 4 + sourceLength),
    headerLength + 4 + encodedName.length,
  );
  return output;
}
