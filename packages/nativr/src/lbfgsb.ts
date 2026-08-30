import type {
  BoxOptimizationBackend,
  BoxOptimizationEvaluation,
  BoxOptimizationOptions,
  BoxOptimizationResult,
} from "@nativr/base";

import { LBFGSB_WASM_BASE64, LBFGSB_WASM_SHA256 } from "./lbfgsb-bytes.js";

const PAGE_BYTES = 65_536;
const TASK_LENGTH = 60;

interface LbfgsbExports extends WebAssembly.Exports {
  readonly memory: WebAssembly.Memory;
  readonly __wasm_call_ctors: () => void;
  readonly malloc: (bytes: number) => number;
  readonly free: (pointer: number) => void;
  readonly setulb_: (...arguments_: number[]) => void;
}

let compiledModule: Promise<WebAssembly.Module> | undefined;

export async function createLbfgsbBackend(): Promise<BoxOptimizationBackend> {
  const module = await (compiledModule ??= WebAssembly.compile(decodeBase64(LBFGSB_WASM_BASE64)));
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
  const wasm = instance.exports as unknown as LbfgsbExports;
  memoryHolder.current = wasm.memory;
  wasm.__wasm_call_ctors();
  return new LbfgsbBackend(wasm);
}

export { LBFGSB_WASM_SHA256 };

class LbfgsbBackend implements BoxOptimizationBackend {
  public readonly implementation = "lbfgsb-2.1-wasm" as const;

  public constructor(private readonly wasm: LbfgsbExports) {}

  public async minimize(
    initial: Float64Array,
    lower: Float64Array,
    upper: Float64Array,
    evaluate: (
      point: Float64Array,
    ) => BoxOptimizationEvaluation | Promise<BoxOptimizationEvaluation>,
    options: BoxOptimizationOptions,
  ): Promise<BoxOptimizationResult> {
    validateInputs(initial, lower, upper, options);
    const length = initial.length;
    const memory = options.memory;
    const pointers: number[] = [];
    const allocate = (bytes: number): number => {
      const pointer = this.wasm.malloc(Math.max(1, bytes));
      if (pointer === 0) throw new Error("L-BFGS-B Wasm allocation failed.");
      pointers.push(pointer);
      return pointer;
    };

    try {
      const pn = allocate(4);
      const pm = allocate(4);
      const px = allocate(length * 8);
      const pl = allocate(length * 8);
      const pu = allocate(length * 8);
      const pnbd = allocate(length * 4);
      const pf = allocate(8);
      const pg = allocate(length * 8);
      const pfactr = allocate(8);
      const ppgtol = allocate(8);
      const pwa = allocate(((2 * memory + 4) * length + 12 * memory * memory + 12 * memory) * 8);
      const piwa = allocate(3 * length * 4);
      const ptask = allocate(TASK_LENGTH);
      const piprint = allocate(4);
      const pcsave = allocate(TASK_LENGTH);
      const plsave = allocate(4 * 4);
      const pisave = allocate(44 * 4);
      const pdsave = allocate(29 * 8);
      let views = memoryViews(this.wasm.memory);
      views.i32[pn >> 2] = length;
      views.i32[pm >> 2] = memory;
      views.f64.set(initial, px >> 3);
      views.f64.set(lower, pl >> 3);
      views.f64.set(upper, pu >> 3);
      for (let index = 0; index < length; index += 1) {
        const hasLower = Number.isFinite(lower[index]);
        const hasUpper = Number.isFinite(upper[index]);
        views.i32[(pnbd >> 2) + index] = hasLower ? (hasUpper ? 2 : 1) : hasUpper ? 3 : 0;
      }
      views.f64[pf >> 3] = 0;
      views.f64[pfactr >> 3] = options.relativeReductionFactor;
      views.f64[ppgtol >> 3] = options.projectedGradientTolerance;
      writeTask(views.i8, ptask, "START");
      views.i32[piprint >> 2] = -1;
      views.i8.fill(32, pcsave, pcsave + TASK_LENGTH);
      views.i32.fill(0, plsave >> 2, (plsave >> 2) + 4);
      views.i32.fill(0, pisave >> 2, (pisave >> 2) + 44);
      views.f64.fill(0, pdsave >> 3, (pdsave >> 3) + 29);

      let functionCount = 0;
      let gradientCount = 0;
      let iterations = 0;
      let lastPoint = Float64Array.from(initial);
      let lastValue = Number.NaN;
      let lastGradient = new Float64Array(length);
      while (true) {
        this.wasm.setulb_(
          pn,
          pm,
          px,
          pl,
          pu,
          pnbd,
          pf,
          pg,
          pfactr,
          ppgtol,
          pwa,
          piwa,
          ptask,
          piprint,
          pcsave,
          plsave,
          pisave,
          pdsave,
          TASK_LENGTH,
          TASK_LENGTH,
        );
        views = memoryViews(this.wasm.memory);
        const task = readTask(views.i8, ptask);
        if (task.startsWith("FG")) {
          if (functionCount >= options.maxEvaluations) {
            return limitedResult(
              lastPoint,
              lastValue,
              lastGradient,
              functionCount,
              gradientCount,
              iterations,
              "evaluation-limit",
            );
          }
          const point = Float64Array.from(views.f64.subarray(px >> 3, (px >> 3) + length));
          const result = await evaluate(point);
          if (result.gradient.length !== length || !Number.isFinite(result.value)) {
            throw new Error("L-BFGS-B objective returned an invalid value or gradient shape.");
          }
          for (const component of result.gradient) {
            if (!Number.isFinite(component)) {
              throw new Error("L-BFGS-B objective returned a non-finite gradient.");
            }
          }
          views = memoryViews(this.wasm.memory);
          views.f64[pf >> 3] = result.value;
          views.f64.set(result.gradient, pg >> 3);
          functionCount += 1;
          gradientCount += 1;
          lastPoint = point;
          lastValue = result.value;
          lastGradient = Float64Array.from(result.gradient);
          continue;
        }
        if (task.startsWith("NEW_X")) {
          iterations += 1;
          if (iterations >= options.maxIterations) {
            return limitedResult(
              lastPoint,
              lastValue,
              lastGradient,
              functionCount,
              gradientCount,
              iterations,
              "iteration-limit",
            );
          }
          continue;
        }
        if (task.startsWith("CONV")) {
          return {
            point: lastPoint,
            value: lastValue,
            gradient: lastGradient,
            functionCount,
            gradientCount,
            iterations,
            converged: true,
            reason: task.includes("PROJECTED GRADIENT")
              ? "projected-gradient"
              : "relative-reduction",
          };
        }
        return limitedResult(
          lastPoint,
          lastValue,
          lastGradient,
          functionCount,
          gradientCount,
          iterations,
          "abnormal-termination",
        );
      }
    } finally {
      for (let index = pointers.length - 1; index >= 0; index -= 1) {
        this.wasm.free(pointers[index] ?? 0);
      }
    }
  }
}

function limitedResult(
  point: Float64Array,
  value: number,
  gradient: Float64Array,
  functionCount: number,
  gradientCount: number,
  iterations: number,
  reason: "iteration-limit" | "evaluation-limit" | "abnormal-termination",
): BoxOptimizationResult {
  return {
    point,
    value,
    gradient,
    functionCount,
    gradientCount,
    iterations,
    converged: false,
    reason,
  };
}

function validateInputs(
  initial: Float64Array,
  lower: Float64Array,
  upper: Float64Array,
  options: BoxOptimizationOptions,
): void {
  if (initial.length === 0 || lower.length !== initial.length || upper.length !== initial.length) {
    throw new Error("L-BFGS-B requires non-empty, equally sized point and bound vectors.");
  }
  if (!Number.isInteger(options.memory) || options.memory < 1) {
    throw new Error("L-BFGS-B memory must be a positive integer.");
  }
  if (
    !Number.isFinite(options.relativeReductionFactor) ||
    options.relativeReductionFactor < 0 ||
    !Number.isFinite(options.projectedGradientTolerance) ||
    options.projectedGradientTolerance < 0 ||
    !Number.isInteger(options.maxIterations) ||
    options.maxIterations < 1 ||
    !Number.isInteger(options.maxEvaluations) ||
    options.maxEvaluations < 1
  ) {
    throw new Error("L-BFGS-B received invalid stopping controls.");
  }
  for (let index = 0; index < initial.length; index += 1) {
    const point = initial[index] ?? Number.NaN;
    const minimum = lower[index] ?? Number.NEGATIVE_INFINITY;
    const maximum = upper[index] ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(point) || minimum > maximum || point < minimum || point > maximum) {
      throw new Error("L-BFGS-B received an invalid initial point or bounds.");
    }
  }
}

function memoryViews(memory: WebAssembly.Memory): {
  readonly i8: Uint8Array;
  readonly i32: Int32Array;
  readonly f64: Float64Array;
} {
  return {
    i8: new Uint8Array(memory.buffer),
    i32: new Int32Array(memory.buffer),
    f64: new Float64Array(memory.buffer),
  };
}

function writeTask(memory: Uint8Array, pointer: number, value: string): void {
  memory.fill(32, pointer, pointer + TASK_LENGTH);
  for (let index = 0; index < value.length; index += 1) {
    memory[pointer + index] = value.charCodeAt(index);
  }
}

function readTask(memory: Uint8Array, pointer: number): string {
  let value = "";
  for (let index = 0; index < TASK_LENGTH; index += 1) {
    value += String.fromCharCode(memory[pointer + index] ?? 32);
  }
  return value.trimEnd();
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
