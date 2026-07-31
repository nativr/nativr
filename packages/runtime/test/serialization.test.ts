import { describe, expect, it } from "vitest";

import {
  EvaluationContext,
  RResourceLimitError,
  RUnsupportedFeatureError,
  characterVector,
  decodeRSerialization,
  decodeRSerializationFile,
  decodeRWorkspaceFile,
  encodeRSerialization,
  encodeRSerializationFile,
  integerVector,
  isMissing,
  listValue,
  pairlistValue,
  vectorClasses,
  vectorNames,
} from "../src/index.js";

// These byte sequences are observable outputs from GNU R 4.6.0 serialize()/save(), generated
// without inspecting implementation source. Their structure is documented by R Internals 1.8.
const FIXTURES = {
  logical: "580a0000000200040600000203000000000a00000003000000010000000080000000",
  double:
    "580a0000000200040600000203000000000e000000053ff80000000000007ff00000000007a27ff80000000000007ff0000000000000fff0000000000000",
  character:
    "580a00000002000406000002030000000010000000030004000900000001610000800900000002c3a900000009ffffffff",
  list: "580a00000002000406000002030000000213000000020000000d00000001000000010000001000000001000400090000000178000004020000000100040009000000056e616d65730000001000000002000400090000000161000400090000000162000000fe",
  dataFrame:
    "580a00000002000406000002030000000313000000020000000d0000000200000001000000020000001000000002000400090000000178000400090000000179000004020000000100040009000000056e616d6573000000100000000200040009000000016100040009000000016200000402000000010004000900000005636c6173730000001000000001000400090000000a646174612e6672616d6500000402000000010004000900000009726f772e6e616d65730000000d0000000280000000fffffffe000000fe",
  workspace:
    "524458320a580a00000002000406000002030000000402000000010004000900000001610000000d00000002000000010000000200000402000000010004000900000001620000001000000001000400090000000178000000fe",
  compactIntegerSequence:
    "580a000000030004060000030500000000055554462d38000000ee0000000200000001000400090000000e636f6d706163745f696e747365710000000200000001000400090000000462617365000000020000000d000000010000000d000000fe0000000e0000000340080000000000003ff00000000000003ff0000000000000000000fe",
  compressedWorkspace:
    "1f8b08000000000000060b728930e28ae0626060606260610392cc40260b139060646061e004d2eca91589b90539a90c0cccc260650c0c0210e56069c64418230948f04255304268148358f31273538bd1b4b3e62426a5e6c038658939a5a9e8da9273128b61da60825c298925897a69454013d1947316e597ebc16c023ba70148fcffffff1f90026300638b5ebdf3000000",
} as const;

describe("GNU R serialization decoder", () => {
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
