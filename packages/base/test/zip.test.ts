import { EvaluationContext, decodeRBase64Resource } from "@nativr/runtime";
import { describe, expect, it } from "vitest";

import { extractZipMember } from "../src/zip.js";

const DEFLATED_ARCHIVE =
  "UEsDBAoAAAAAAOuOAl1uUDBuCwAAAAsAAAAJAAAAbm90ZXMudHh0YWxwaGEKYmV0YQpQSwMEFAAAAAgA644CXYPf7MgpAAAAHAIAAAwAAAByZXBlYXRlZC50eHRLLErOyCxLVUjOzy1ILMlMyszJLKlUSEksSVRIpLIUF7UNHLWLtnYBAFBLAQIeAwoAAAAAAOuOAl1uUDBuCwAAAAsAAAAJAAAAAAAAAAEAAACkgQAAAABub3Rlcy50eHRQSwECHgMUAAAACADrjgJdg9/syCkAAAAcAgAADAAAAAAAAAABAAAApIEyAAAAcmVwZWF0ZWQudHh0UEsFBgAAAAACAAIAcQAAAIUAAAAAAA==";
const STORED_ARCHIVE =
  "UEsDBAoAAAAAAOuOAl1uUDBuCwAAAAsAAAAJAAAAbm90ZXMudHh0YWxwaGEKYmV0YQpQSwECHgMKAAAAAADrjgJdblAwbgsAAAALAAAACQAAAAAAAAAAAAAApIEAAAAAbm90ZXMudHh0UEsFBgAAAAABAAEANwAAADIAAAAAAA==";

function context(maxOutputBytes = 10_000): EvaluationContext {
  return new EvaluationContext(
    {
      maxSteps: 10_000,
      maxCallDepth: 10,
      maxVectorLength: 1_000,
      maxOutputBytes,
    },
    { cancelled: false },
  );
}

function archive(source: string, state = context()): Uint8Array {
  return decodeRBase64Resource(source, state);
}

function utf8(source: Uint8Array): string {
  const Decoder = (
    globalThis as unknown as {
      readonly TextDecoder: new () => { readonly decode: (input: Uint8Array) => string };
    }
  ).TextDecoder;
  return new Decoder().decode(source);
}

function signatureOffset(source: Uint8Array, signature: readonly number[], occurrence = 0): number {
  let matched = 0;
  for (let offset = 0; offset <= source.length - signature.length; offset += 1) {
    if (signature.every((byte, index) => source[offset + index] === byte)) {
      if (matched === occurrence) return offset;
      matched += 1;
    }
  }
  throw new Error("ZIP signature not found in fixture");
}

describe("bounded ZIP member extraction", () => {
  it("extracts stored and raw-DEFLATE members by exact name", async () => {
    const storedState = context();
    const stored = await extractZipMember(
      archive(STORED_ARCHIVE, storedState),
      "notes.txt",
      storedState,
    );
    expect(utf8(stored)).toBe("alpha\nbeta\n");

    const deflatedState = context();
    const deflated = await extractZipMember(
      archive(DEFLATED_ARCHIVE, deflatedState),
      "repeated.txt",
      deflatedState,
    );
    expect(utf8(deflated)).toBe(`${"archive compatibility data ".repeat(4).trimEnd()}\n`.repeat(5));
  });

  it("rejects missing members and malformed archives with stable codes", async () => {
    const state = context();
    await expect(
      extractZipMember(archive(STORED_ARCHIVE, state), "missing.txt", state),
    ).rejects.toMatchObject({ code: "NRE2257" });
    await expect(extractZipMember(new Uint8Array([1, 2, 3]), "x", context())).rejects.toMatchObject(
      { code: "NRE2258" },
    );
  });

  it("checks CRC metadata and rejects unsupported compression methods", async () => {
    const crcState = context();
    const corruptCrc = archive(STORED_ARCHIVE, crcState);
    const central = signatureOffset(corruptCrc, [0x50, 0x4b, 0x01, 0x02]);
    corruptCrc[central + 16] = (corruptCrc[central + 16] ?? 0) ^ 0xff;
    await expect(extractZipMember(corruptCrc, "notes.txt", crcState)).rejects.toMatchObject({
      code: "NRE2258",
    });

    const methodState = context();
    const unknownMethod = archive(STORED_ARCHIVE, methodState);
    const local = signatureOffset(unknownMethod, [0x50, 0x4b, 0x03, 0x04]);
    const methodCentral = signatureOffset(unknownMethod, [0x50, 0x4b, 0x01, 0x02]);
    unknownMethod[local + 8] = 99;
    unknownMethod[methodCentral + 10] = 99;
    await expect(extractZipMember(unknownMethod, "notes.txt", methodState)).rejects.toMatchObject({
      code: "NRU6207",
    });
  });

  it("enforces the declared uncompressed output bound before inflation", async () => {
    const state = context(300);
    await expect(
      extractZipMember(archive(DEFLATED_ARCHIVE, state), "repeated.txt", state),
    ).rejects.toMatchObject({ code: "NRL4007" });
  });
});
