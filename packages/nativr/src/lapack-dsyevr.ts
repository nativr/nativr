import type { SymmetricEigenBackend, SymmetricEigenDecomposition } from "@nativr/base";

import { LAPACK_DSYEVR_WASM_BASE64, LAPACK_DSYEVR_WASM_SHA256 } from "./lapack-dsyevr-bytes.js";

const PAGE_BYTES = 65_536;

interface LapackExports extends WebAssembly.Exports {
  readonly memory: WebAssembly.Memory;
  readonly __wasm_call_ctors: () => void;
  readonly malloc: (bytes: number) => number;
  readonly free: (pointer: number) => void;
  readonly dsyevr_: (...arguments_: number[]) => void;
}

let compiledModule: Promise<WebAssembly.Module> | undefined;

export async function createLapackDsyevrBackend(): Promise<SymmetricEigenBackend> {
  const module = await (compiledModule ??= WebAssembly.compile(
    decodeBase64(LAPACK_DSYEVR_WASM_BASE64),
  ));
  const memoryHolder: { current?: WebAssembly.Memory } = {};
  const instance = await WebAssembly.instantiate(module, {
    env: {
      emscripten_resize_heap: (requestedBytes: number): number => {
        if (memoryHolder.current === undefined) return 0;
        const currentPages = memoryHolder.current.buffer.byteLength / PAGE_BYTES;
        const requestedPages = Math.ceil(requestedBytes / PAGE_BYTES);
        if (requestedPages <= currentPages) return 1;
        try {
          memoryHolder.current.grow(requestedPages - currentPages);
          return 1;
        } catch {
          return 0;
        }
      },
    },
  });
  const wasm = instance.exports as unknown as LapackExports;
  memoryHolder.current = wasm.memory;
  wasm.__wasm_call_ctors();
  return new LapackDsyevrBackend(wasm);
}

export { LAPACK_DSYEVR_WASM_SHA256 };

class LapackDsyevrBackend implements SymmetricEigenBackend {
  public readonly implementation = "lapack-dsyevr-wasm" as const;

  public constructor(private readonly wasm: LapackExports) {}

  public decompose(source: Float64Array, order: number): SymmetricEigenDecomposition {
    const pointers: number[] = [];
    const allocate = (bytes: number): number => {
      const pointer = this.wasm.malloc(Math.max(1, bytes));
      if (pointer === 0) throw new Error("LAPACK DSYEVR Wasm allocation failed.");
      pointers.push(pointer);
      return pointer;
    };

    try {
      const pjobz = allocate(1);
      const prange = allocate(1);
      const puplo = allocate(1);
      const pn = allocate(4);
      const pa = allocate(order * order * 8);
      const plda = allocate(4);
      const pvl = allocate(8);
      const pvu = allocate(8);
      const pil = allocate(4);
      const piu = allocate(4);
      const pabstol = allocate(8);
      const pm = allocate(4);
      const pw = allocate(order * 8);
      const pz = allocate(order * order * 8);
      const pldz = allocate(4);
      const pisuppz = allocate(2 * order * 4);
      const pworkopt = allocate(8);
      const plwork = allocate(4);
      const piworkopt = allocate(4);
      const pliwork = allocate(4);
      const pinfo = allocate(4);
      let views = memoryViews(this.wasm.memory);
      views.i8[pjobz] = "V".charCodeAt(0);
      views.i8[prange] = "A".charCodeAt(0);
      views.i8[puplo] = "L".charCodeAt(0);
      views.i32[pn >> 2] = order;
      views.i32[plda >> 2] = order;
      views.f64[pvl >> 3] = 0;
      views.f64[pvu >> 3] = 0;
      views.i32[pil >> 2] = 0;
      views.i32[piu >> 2] = 0;
      views.f64[pabstol >> 3] = 0;
      views.i32[pldz >> 2] = order;
      views.i32[plwork >> 2] = -1;
      views.i32[pliwork >> 2] = -1;
      views.f64.set(source, pa >> 3);
      this.wasm.dsyevr_(
        pjobz,
        prange,
        puplo,
        pn,
        pa,
        plda,
        pvl,
        pvu,
        pil,
        piu,
        pabstol,
        pm,
        pw,
        pz,
        pldz,
        pisuppz,
        pworkopt,
        plwork,
        piworkopt,
        pliwork,
        pinfo,
        1,
        1,
        1,
      );
      const workLength = Math.ceil(views.f64[pworkopt >> 3] ?? 0);
      const integerWorkLength = views.i32[piworkopt >> 2] ?? 0;
      if (workLength <= 0 || integerWorkLength <= 0) {
        throw new Error("LAPACK DSYEVR returned an invalid workspace size.");
      }
      const pwork = allocate(workLength * 8);
      const piwork = allocate(integerWorkLength * 4);
      views = memoryViews(this.wasm.memory);
      views.i32[plwork >> 2] = workLength;
      views.i32[pliwork >> 2] = integerWorkLength;
      this.wasm.dsyevr_(
        pjobz,
        prange,
        puplo,
        pn,
        pa,
        plda,
        pvl,
        pvu,
        pil,
        piu,
        pabstol,
        pm,
        pw,
        pz,
        pldz,
        pisuppz,
        pwork,
        plwork,
        piwork,
        pliwork,
        pinfo,
        1,
        1,
        1,
      );
      views = memoryViews(this.wasm.memory);
      const info = views.i32[pinfo >> 2] ?? 0;
      if (info !== 0) throw new Error(`LAPACK DSYEVR failed with info=${info}.`);
      const values = new Float64Array(order);
      const vectors = new Float64Array(order * order);
      for (let column = 0; column < order; column += 1) {
        const ascendingColumn = order - column - 1;
        values[column] = views.f64[(pw >> 3) + ascendingColumn] ?? 0;
        for (let row = 0; row < order; row += 1) {
          vectors[row + column * order] = views.f64[(pz >> 3) + row + ascendingColumn * order] ?? 0;
        }
      }
      return { values, vectors };
    } finally {
      for (let index = pointers.length - 1; index >= 0; index -= 1) {
        this.wasm.free(pointers[index] ?? 0);
      }
    }
  }
}

function memoryViews(memory: WebAssembly.Memory): {
  readonly i8: Int8Array;
  readonly i32: Int32Array;
  readonly f64: Float64Array;
} {
  return {
    i8: new Int8Array(memory.buffer),
    i32: new Int32Array(memory.buffer),
    f64: new Float64Array(memory.buffer),
  };
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
