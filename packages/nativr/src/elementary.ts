import { NativRError } from "@nativr/runtime";
import type {
  ElementaryBinaryFunction,
  ElementaryMath,
  ElementaryUnaryFunction,
} from "@nativr/runtime";

/**
 * The correctly rounded elementary-function module (RFC-0007), as pinned in
 * scripts/elementary/core-math.json. scripts/copy-elementary-assets.mjs refuses to ship a module
 * whose digest or size differs from these values, and the loader below refuses to run one.
 */
export const ELEMENTARY_WASM = Object.freeze({
  file: "elementary.wasm",
  sha256: "0467e7c1a694e4b0eb86343457cfe733d9220132385dfe73f7845d1261837a0a",
  bytes: 318690,
  unary: Object.freeze([
    "exp",
    "expm1",
    "log",
    "log1p",
    "log2",
    "log10",
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "sinh",
    "cosh",
    "tanh",
    "asinh",
    "acosh",
    "atanh",
    "cbrt",
  ] as const),
  binary: Object.freeze(["pow", "atan2", "hypot"] as const),
});

export interface ElementaryModulePin {
  readonly sha256: string;
  readonly bytes: number;
  readonly unary: readonly string[];
  readonly binary: readonly string[];
}

/** One session's verified instance; createElementaryMath adapts it for the evaluator. */
export interface ElementaryModule {
  readonly instance: WebAssembly.Instance;
  readonly memory: WebAssembly.Memory;
}

/** Fetch, verify and instantiate the module once for one session. */
export async function loadElementaryModule(asset: string | URL): Promise<ElementaryModule> {
  let bytes: Uint8Array;
  try {
    const response = await fetch(asset);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (cause) {
    throw new NativRError("NRS5012", "Unable to load the elementary-function Wasm asset.", {
      cause,
    });
  }
  return instantiateElementaryModule(bytes);
}

/** Verify the pinned digest, the empty import list and the exact export set, then instantiate. */
export async function instantiateElementaryModule(
  bytes: Uint8Array,
  pin: ElementaryModulePin = ELEMENTARY_WASM,
): Promise<ElementaryModule> {
  const digest = sha256Hex(bytes);
  if (bytes.byteLength !== pin.bytes || digest !== pin.sha256) {
    throw new NativRError(
      "NRS5013",
      `The elementary-function Wasm asset does not match its pinned SHA-256 (${pin.sha256}).`,
      { details: { sha256: digest, bytes: bytes.byteLength } },
    );
  }
  // Copy into a fresh ArrayBuffer so a shared or resizable source buffer cannot change after the
  // digest was checked.
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  const module = await WebAssembly.compile(owned.buffer);
  const imports = WebAssembly.Module.imports(module);
  const exported = new Set(WebAssembly.Module.exports(module).map((entry) => entry.name));
  const expected = [
    "memory",
    "reserve",
    ...[...pin.unary, ...pin.binary].flatMap((name) => [name, `v_${name}`]),
  ];
  if (
    imports.length > 0 ||
    exported.size !== expected.length ||
    expected.some((name) => !exported.has(name))
  ) {
    throw new NativRError(
      "NRS5014",
      "The elementary-function Wasm asset must have no imports and exactly the pinned exports.",
    );
  }
  const instance = await WebAssembly.instantiate(module, {});
  const memory = instance.exports.memory;
  if (!(memory instanceof WebAssembly.Memory)) {
    throw new NativRError("NRS5014", "The elementary-function Wasm asset must export its memory.");
  }
  return Object.freeze({ instance, memory });
}

/**
 * Correctly rounded elementary functions for one session (RFC-0007). CORE-MATH guarantees correct
 * rounding for regular inputs; non-finite and zero arguments take the engine's Math path, whose
 * IEEE 754 special values are exact. NA is carried by the caller's missing mask, so NaN payloads
 * returned by the module are never interpreted.
 */
export function createElementaryMath(module: ElementaryModule): ElementaryMath {
  const exports = module.instance.exports as Record<string, unknown>;
  const unary = new Map<ElementaryUnaryFunction, (x: number) => number>();
  for (const name of ELEMENTARY_WASM.unary) unary.set(name, exports[name] as (x: number) => number);
  const binary = new Map<ElementaryBinaryFunction, (x: number, y: number) => number>();
  for (const name of ELEMENTARY_WASM.binary)
    binary.set(name, exports[name] as (x: number, y: number) => number);
  const regular = (value: number) => Number.isFinite(value) && value !== 0;
  return Object.freeze({
    backend: "correctly-rounded" as const,
    unary: (name: ElementaryUnaryFunction, x: number) => {
      const fn = unary.get(name);
      return fn !== undefined && regular(x) ? fn(x) : Math[name](x);
    },
    binary: (name: ElementaryBinaryFunction, x: number, y: number) => {
      const fn = binary.get(name);
      if (fn !== undefined && regular(x) && regular(y)) return fn(x, y);
      return name === "pow" ? x ** y : Math[name](x, y);
    },
  });
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * FIPS 180-4 SHA-256. A synchronous in-tree digest keeps verification identical in every engine
 * and context, including insecure origins where `crypto.subtle` is unavailable.
 */
export function sha256Hex(bytes: Uint8Array): string {
  const length = bytes.byteLength;
  const padded = new Uint8Array((((length + 8) >>> 6) + 1) << 6);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000), false);
  view.setUint32(padded.length - 4, (length << 3) >>> 0, false);
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15] ?? 0;
      const b = w[i - 2] ?? 0;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }
    let a = hash[0] ?? 0;
    let b = hash[1] ?? 0;
    let c = hash[2] ?? 0;
    let d = hash[3] ?? 0;
    let e = hash[4] ?? 0;
    let f = hash[5] ?? 0;
    let g = hash[6] ?? 0;
    let h = hash[7] ?? 0;
    for (let i = 0; i < 64; i += 1) {
      const t1 =
        (h +
          (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) +
          ((e & f) ^ (~e & g)) +
          (SHA256_K[i] ?? 0) +
          (w[i] ?? 0)) >>>
        0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }
  return Array.from(hash, (word) => word.toString(16).padStart(8, "0")).join("");
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}
