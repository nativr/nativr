import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { PROTOCOL_VERSION, type WorkerRequest } from "@nativr/protocol";
import { describe, expect, it, vi } from "vitest";

import { ELEMENTARY_WASM, instantiateElementaryModule, sha256Hex } from "../src/elementary.js";
import { createR } from "../src/index.js";
import { RuntimeHost } from "../src/runtime-host.js";

const parserAssets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
const lock = JSON.parse(
  readFileSync(new URL("../../../scripts/elementary/core-math.json", import.meta.url), "utf8"),
) as {
  readonly functions: readonly string[];
  readonly output: { readonly sha256: string; readonly bytes: number };
};
// Built by `node scripts/build-elementary-wasm.mjs`; CI runs unit tests before the build.
const builtModule = new URL("../../../.tmp/elementary/elementary.wasm", import.meta.url);
const hasBuiltModule = existsSync(builtModule);

describe("elementary-function asset", () => {
  it("pins the digest, size and exports recorded by the build lock", () => {
    expect(ELEMENTARY_WASM.sha256).toBe(lock.output.sha256);
    expect(ELEMENTARY_WASM.bytes).toBe(lock.output.bytes);
    expect([...ELEMENTARY_WASM.unary, ...ELEMENTARY_WASM.binary].sort()).toEqual(
      [...lock.functions].sort(),
    );
  });

  it("computes FIPS 180-4 SHA-256 across block boundaries", () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    for (let length = 0; length <= 200; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 151 + length) & 0xff);
      expect(sha256Hex(bytes)).toBe(createHash("sha256").update(bytes).digest("hex"));
    }
  });

  it("rejects bytes that do not match the pinned digest", async () => {
    const bytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    await expect(instantiateElementaryModule(bytes)).rejects.toMatchObject({ code: "NRS5013" });
  });

  it("rejects a module with imports even when its digest is pinned", async () => {
    // (module (import "m" "f" (func)))
    const bytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x02,
      0x07, 0x01, 0x01, 0x6d, 0x01, 0x66, 0x00, 0x00,
    ]);
    const pin = {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.byteLength,
      unary: [],
      binary: [],
    };
    await expect(instantiateElementaryModule(bytes, pin)).rejects.toMatchObject({
      code: "NRS5014",
    });
  });

  it.skipIf(!hasBuiltModule)("instantiates the built module once per inline session", async () => {
    const bytes = readFileSync(builtModule);
    const elementaryWasm = `data:application/wasm;base64,${bytes.toString("base64")}`;
    const host = await RuntimeHost.create({ ...parserAssets, elementaryWasm }, 1);
    try {
      expect(host.elementary?.memory).toBeInstanceOf(WebAssembly.Memory);
      const exports = host.elementary?.instance.exports as Record<string, (x: number) => number>;
      expect(exports.exp?.(0)).toBe(1);
      expect(await host.eval("exp(1)")).toBeDefined();
    } finally {
      host.dispose();
    }

    const tampered = Uint8Array.from(bytes);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    await expect(
      createR({
        execution: "inline",
        assets: {
          ...parserAssets,
          elementaryWasm: `data:application/wasm;base64,${Buffer.from(tampered).toString("base64")}`,
        },
      }),
    ).rejects.toMatchObject({ code: "NRS5013" });
  });

  it("loads no module when parser assets are overridden without elementaryWasm", async () => {
    const host = await RuntimeHost.create(parserAssets, 1);
    try {
      expect(host.elementary).toBeUndefined();
    } finally {
      host.dispose();
    }
  });

  it("sends the resolved asset URL in the Worker init request", async () => {
    const sent: WorkerRequest[] = [];
    class FakeWorker {
      readonly #listeners: ((event: MessageEvent<unknown>) => void)[] = [];

      public addEventListener(type: string, listener: (event: MessageEvent<unknown>) => void) {
        if (type === "message") this.#listeners.push(listener);
      }

      public postMessage(request: WorkerRequest): void {
        sent.push(request);
        const payload = request.kind === "init" ? { kind: "ready" } : { kind: "void" };
        queueMicrotask(() => {
          const event = {
            data: { protocolVersion: PROTOCOL_VERSION, id: request.id, kind: "success", payload },
          };
          for (const listener of this.#listeners) listener(event as MessageEvent<unknown>);
        });
      }

      public terminate(): void {}
    }
    const initAssets = () => {
      const init = sent.filter((request) => request.kind === "init").at(-1);
      return init?.kind === "init" ? init.assets : undefined;
    };
    vi.stubGlobal("Worker", FakeWorker);
    try {
      await (await createR()).dispose();
      expect(new URL(initAssets()?.elementaryWasm ?? "").pathname).toMatch(/\/elementary\.wasm$/u);

      await (await createR({ assets: parserAssets })).dispose();
      expect(initAssets()).not.toHaveProperty("elementaryWasm");

      await (
        await createR({
          assets: { ...parserAssets, elementaryWasm: "https://cdn.example/elementary.wasm" },
        })
      ).dispose();
      expect(initAssets()?.elementaryWasm).toBe("https://cdn.example/elementary.wasm");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
