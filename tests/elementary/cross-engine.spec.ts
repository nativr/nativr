// RFC-0007 step 3: elementary.wasm must return identical bits in Chromium, Firefox and WebKit.
// Opt-in; run after `node scripts/build-elementary-wasm.mjs` with
//   pnpm exec playwright test -c playwright.elementary.config.ts
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { BrowserType } from "@playwright/test";
import { chromium, expect, firefox, test, webkit } from "@playwright/test";

interface Lock {
  readonly functions: readonly string[];
  readonly output: { readonly file: string; readonly sha256: string };
}

interface Fixture {
  readonly functions: Readonly<Record<string, readonly (readonly string[])[]>>;
}

interface Job {
  readonly name: string;
  readonly arity: number;
  readonly inputs: readonly (readonly string[])[];
}

type Results = Record<string, { scalar: string[]; vector: string[] }>;

const root = process.cwd();
const binary = new Set(["pow", "atan2", "hypot"]);
const randomPerFunction = 4000;
const specials = [
  "0000000000000000", // +0
  "8000000000000000", // -0
  "7ff0000000000000", // +Inf
  "fff0000000000000", // -Inf
  "7ff8000000000000", // quiet NaN
  "7ff0000000000001", // signalling NaN
  "0000000000000001", // smallest subnormal
  "800fffffffffffff", // largest negative subnormal
  "0010000000000000", // smallest normal
  "7fefffffffffffff", // largest finite
  "3ff0000000000000", // 1
  "bff0000000000000", // -1
  "3fe0000000000000", // 0.5
  "4000000000000000", // 2
  "c000000000000000", // -2
  "400921fb54442d18", // pi
];

test("elementary.wasm returns identical bits in Chromium, Firefox and WebKit", async () => {
  test.setTimeout(300_000);
  const lock = JSON.parse(
    await readFile(path.join(root, "scripts", "elementary", "core-math.json"), "utf8"),
  ) as Lock;
  const fixture = JSON.parse(
    await readFile(path.join(root, "scripts", "elementary", "hard-cases.json"), "utf8"),
  ) as Fixture;
  const wasm = await readFile(path.join(root, ".tmp", "elementary", lock.output.file));
  const jobs = buildJobs(lock.functions, fixture);
  const input: [string, readonly Job[]] = [wasm.toString("base64"), jobs];
  const total = jobs.reduce((sum, job) => sum + job.inputs.length, 0);

  const node = await evaluateElementary(input);
  const engines: [string, BrowserType][] = [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ];
  const results = new Map<string, Results>([["node", node]]);
  for (const [label, type] of engines) {
    const browser = await type.launch();
    try {
      const page = await browser.newPage();
      results.set(label, await page.evaluate(evaluateElementary, input));
    } finally {
      await browser.close();
    }
  }

  const mismatches: string[] = [];
  for (const job of jobs) {
    for (const [label, result] of results) {
      const own = result[job.name];
      if (own === undefined) throw new Error(`${label} returned no results for ${job.name}`);
      for (const [index, args] of job.inputs.entries()) {
        const expected = node[job.name]?.scalar[index];
        if (own.scalar[index] !== expected || own.vector[index] !== expected) {
          mismatches.push(
            `${label} ${job.name}(${args.join(", ")}): scalar ${own.scalar[index]}, ` +
              `vector ${own.vector[index]}, node ${expected}`,
          );
        }
      }
    }
  }
  console.log(
    `${total} inputs over ${lock.functions.length} functions checked in node, ` +
      `${engines.map(([label]) => label).join(", ")}; mismatches ${mismatches.length}`,
  );
  expect(mismatches.slice(0, 20)).toEqual([]);
});

function buildJobs(functions: readonly string[], fixture: Fixture): Job[] {
  let state = 0x9e3779b97f4a7c15n;
  const next = (): string => {
    state ^= (state << 13n) & 0xffffffffffffffffn;
    state ^= state >> 7n;
    state ^= (state << 17n) & 0xffffffffffffffffn;
    return state.toString(16).padStart(16, "0");
  };
  return functions.map((name) => {
    const arity = binary.has(name) ? 2 : 1;
    const inputs: string[][] = (fixture.functions[name] ?? []).map((args) => [...args]);
    if (arity === 1) {
      for (const special of specials) inputs.push([special]);
    } else {
      for (const x of specials) for (const y of specials) inputs.push([x, y]);
    }
    for (let index = 0; index < randomPerFunction; index += 1) {
      inputs.push(arity === 1 ? [next()] : [next(), next()]);
    }
    return { name, arity, inputs };
  });
}

// Runs in Node and, serialized, in each browser page; it must stay self-contained. NaN results
// are reported as "nan" because WebAssembly lets engines choose NaN payloads.
async function evaluateElementary([base64, jobs]: [string, readonly Job[]]): Promise<Results> {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const exports = instance.exports as Record<string, unknown>;
  const memory = exports.memory as WebAssembly.Memory;
  const reserve = exports.reserve as (bytes: number) => number;
  const view = new DataView(new ArrayBuffer(8));
  const fromBits = (bits: string): number => {
    view.setBigUint64(0, BigInt(`0x${bits}`));
    return view.getFloat64(0);
  };
  const toBits = (value: number): string => {
    if (Number.isNaN(value)) return "nan";
    view.setFloat64(0, value);
    return view.getBigUint64(0).toString(16).padStart(16, "0");
  };
  const results: Results = {};
  for (const job of jobs) {
    const scalarFunction = exports[job.name] as (...args: number[]) => number;
    const vectorFunction = exports[`v_${job.name}`] as (...args: number[]) => void;
    const args = job.inputs.map((row) => row.map(fromBits));
    const scalar = args.map((row) => toBits(scalarFunction(...row)));
    const n = args.length;
    const base = reserve(8 * n * (job.arity + 1));
    const buffer = new Float64Array(memory.buffer, base, n * (job.arity + 1));
    for (const [index, row] of args.entries()) {
      for (const [argument, value] of row.entries()) buffer[argument * n + index] = value;
    }
    const pointers = Array.from(
      { length: job.arity + 1 },
      (_, argument) => base + 8 * n * argument,
    );
    vectorFunction(...pointers, n);
    const vector = Array.from(buffer.subarray(job.arity * n), toBits);
    results[job.name] = { scalar, vector };
  }
  return results;
}
