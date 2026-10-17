// Opt-in reference test for elementary.wasm (RFC-0007 step 2). Not part of `pnpm check`.
//
//   node scripts/build-elementary-wasm.mjs
//   NATIVR_MPMATH=<dir containing the mpmath package> node scripts/test-elementary-reference.mjs
//
// Every export is compared bit for bit with the correctly rounded binary64 result computed by
// mpmath, run as a separate black-box process, on CORE-MATH's published hard-to-round inputs and on
// seeded random samples. IEEE 754 / ISO C Annex F special values are checked against a table below.
// The vector exports must reproduce the scalar exports. Options:
//   NATIVR_PYTHON             Python 3 executable (default: python)
//   NATIVR_ELEMENTARY_SAMPLES random samples per function (default: 2000)
//   NATIVR_ELEMENTARY_SEED    random seed (default: 20261017)
//   --update-fixture          regenerate scripts/elementary/hard-cases.json from the first 64 KiB
//                             of each upstream .wc file in <NATIVR_CORE_MATH_DIR>/wc-head
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import prettierOptions from "../prettier.config.mjs";
import { run } from "./lib/commands.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pinRoot = path.join(root, "scripts", "elementary");
const lock = JSON.parse(await readFile(path.join(pinRoot, "core-math.json"), "utf8"));
const fixtureFile = path.join(pinRoot, "hard-cases.json");
const binary = new Set(["pow", "atan2", "hypot"]);
const hardCasesPerFunction = 96;
const view = new DataView(new ArrayBuffer(8));

if (process.argv.includes("--update-fixture")) {
  await updateFixture();
  process.exit(0);
}

const mpmathDirectory = process.env.NATIVR_MPMATH;
if (mpmathDirectory === undefined) {
  throw new Error("Set NATIVR_MPMATH to a directory that contains the mpmath package.");
}
const samples = Number(process.env.NATIVR_ELEMENTARY_SAMPLES ?? 2000);
const seed = BigInt(process.env.NATIVR_ELEMENTARY_SEED ?? 20261017);

const bytes = await readFile(path.join(root, ".tmp", "elementary", lock.output.file));
const library = await instantiate(bytes);
const fixture = JSON.parse(await readFile(fixtureFile, "utf8"));

const failures = [];
const summary = [];

// 1. Special values (no reference tool involved).
let specialCount = 0;
for (const [name, args, expected] of specialValues()) {
  specialCount += 1;
  const actual = library[name](...args);
  if (!sameValue(actual, expected)) {
    failures.push(
      `special ${name}(${args.map(show).join(", ")}) = ${show(actual)}, expected ${show(expected)}`,
    );
  }
}

// 2. Hard-to-round and random inputs against mpmath.
const random = xorshift(seed);
const cases = [];
for (const name of lock.functions) {
  const hard = fixture.functions[name] ?? [];
  for (const args of hard) cases.push({ name, args, kind: "hard" });
  for (let index = 0; index < samples; index += 1) {
    cases.push({ name, args: sampleArguments(name, random).map(toBits), kind: "random" });
  }
}
const work = await mkdtemp(path.join(os.tmpdir(), "nativr-elementary-reference-"));
let reference;
try {
  const input = path.join(work, "input.json");
  const output = path.join(work, "output.json");
  await writeFile(input, JSON.stringify({ cases: cases.map((entry) => [entry.name, entry.args]) }));
  const python = process.env.NATIVR_PYTHON ?? "python";
  const started = Date.now();
  await run(
    python,
    ["-I", path.join(pinRoot, "mpmath-reference.py"), mpmathDirectory, input, output],
    {
      cwd: work,
      capture: true,
    },
  );
  reference = JSON.parse(await readFile(output, "utf8"));
  console.log(
    `mpmath ${reference.mpmath} evaluated ${cases.length} cases in ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
} finally {
  await rm(work, { recursive: true, force: true });
}

const counts = new Map(
  lock.functions.map((name) => [name, { hard: 0, random: 0, hostDiffers: 0 }]),
);
for (const [index, entry] of cases.entries()) {
  const args = entry.args.map(fromBits);
  const actual = library[entry.name](...args);
  const expectedBits = reference.results[index];
  const ok =
    expectedBits === "nan"
      ? Number.isNaN(actual)
      : !Number.isNaN(actual) && toBits(actual) === expectedBits;
  const count = counts.get(entry.name);
  count[entry.kind] += 1;
  if (!ok) {
    failures.push(
      `${entry.kind} ${entry.name}(${args.map(show).join(", ")}) = ${show(actual)}, mpmath ${
        expectedBits === "nan" ? "NaN" : show(fromBits(expectedBits))
      }`,
    );
  }
  const host = hostFunction(entry.name)(...args);
  if (expectedBits !== "nan" && (Number.isNaN(host) || toBits(host) !== expectedBits))
    count.hostDiffers += 1;
}

// 3. Vector exports must reproduce the scalar exports bit for bit.
let vectorCount = 0;
for (const name of lock.functions) {
  const inputs = cases
    .filter((entry) => entry.name === name)
    .map((entry) => entry.args.map(fromBits));
  const vector = library.vector(name, inputs);
  for (const [index, args] of inputs.entries()) {
    vectorCount += 1;
    const scalar = library[name](...args);
    if (!sameValue(vector[index], scalar)) {
      failures.push(
        `vector v_${name}(${args.map(show).join(", ")}) = ${show(vector[index])}, scalar ${show(scalar)}`,
      );
    }
  }
}

for (const [name, count] of counts) {
  summary.push(
    `${name.padEnd(6)} hard ${String(count.hard).padStart(4)}  random ${String(count.random).padStart(5)}  ` +
      `host Math differs ${count.hostDiffers}`,
  );
}
console.log(summary.join("\n"));
console.log(
  `special values ${specialCount}, reference cases ${cases.length}, vector checks ${vectorCount}, failures ${failures.length}`,
);
if (failures.length > 0) {
  console.error(failures.slice(0, 50).join("\n"));
  process.exitCode = 1;
}

async function instantiate(moduleBytes) {
  const { instance } = await WebAssembly.instantiate(moduleBytes, {});
  const exports = instance.exports;
  const api = { vector };
  for (const name of lock.functions) api[name] = exports[name];
  return api;

  function vector(name, inputs) {
    const arity = binary.has(name) ? 2 : 1;
    const n = inputs.length;
    const base = exports.reserve(8 * n * (arity + 1));
    const memory = new Float64Array(exports.memory.buffer, base, n * (arity + 1));
    for (let index = 0; index < n; index += 1) {
      for (let argument = 0; argument < arity; argument += 1) {
        memory[argument * n + index] = inputs[index][argument];
      }
    }
    const pointers = Array.from({ length: arity + 1 }, (_, argument) => base + 8 * n * argument);
    exports[`v_${name}`](...pointers, n);
    return Array.from(memory.subarray(arity * n));
  }
}

function hostFunction(name) {
  if (name === "pow") return Math.pow;
  return Math[name];
}

// Domain-aware samplers: half the samples are uniform over the function's interesting range, half
// are uniformly random finite bit patterns (which exercise huge and tiny arguments).
function sampleArguments(name, random) {
  const any = () => randomFinite(random);
  const uniform = (low, high) => low + (high - low) * unit(random);
  const pick = unit(random) < 0.5;
  switch (name) {
    case "exp":
      return [pick ? uniform(-746, 710) : any()];
    case "expm1":
      return [pick ? uniform(-40, 710) : any()];
    case "log":
    case "log2":
    case "log10":
      return [pick ? Math.exp(uniform(-745, 709)) : Math.abs(any())];
    case "log1p":
      return [pick ? uniform(-1, 4) : Math.abs(any())];
    case "pow": {
      if (pick) return [Math.exp(uniform(-10, 10)), uniform(-60, 60)];
      if (unit(random) < 0.25) return [-Math.abs(uniform(0, 30)), Math.round(uniform(-40, 40))];
      return [Math.abs(any()), uniform(-4, 4)];
    }
    case "sin":
    case "cos":
    case "tan":
      return [pick ? uniform(-20, 20) : any()];
    case "asin":
    case "acos":
    case "atanh":
      return [uniform(-1, 1)];
    case "atan":
    case "sinh":
    case "tanh":
    case "asinh":
    case "cbrt":
      return [pick ? uniform(-40, 40) : any()];
    case "cosh":
      return [pick ? uniform(-710, 710) : any()];
    case "acosh":
      return [pick ? 1 + Math.exp(uniform(-40, 10)) : Math.abs(any())];
    case "atan2":
    case "hypot":
      return pick ? [uniform(-10, 10), uniform(-10, 10)] : [any(), any()];
    default:
      throw new Error(`No sampler for ${name}`);
  }
}

function xorshift(state) {
  let s = state === 0n ? 1n : state;
  return () => {
    s ^= (s << 13n) & 0xffffffffffffffffn;
    s ^= s >> 7n;
    s ^= (s << 17n) & 0xffffffffffffffffn;
    return s;
  };
}

function unit(random) {
  return Number(random() >> 11n) / 2 ** 53;
}

function randomFinite(random) {
  for (;;) {
    const value = fromBits(random().toString(16).padStart(16, "0"));
    if (Number.isFinite(value) && value !== 0) return value;
  }
}

function toBits(value) {
  view.setFloat64(0, value);
  return view.getBigUint64(0).toString(16).padStart(16, "0");
}

function fromBits(bits) {
  view.setBigUint64(0, BigInt(`0x${bits}`));
  return view.getFloat64(0);
}

function sameValue(actual, expected) {
  return Number.isNaN(expected) ? Number.isNaN(actual) : toBits(actual) === toBits(expected);
}

function show(value) {
  if (Object.is(value, -0)) return "-0";
  return Number.isFinite(value) ? `${value} [${toBits(value)}]` : String(value);
}

// IEEE 754-2019 section 9.2 and ISO C Annex F (F.10) special cases. Rounded constants are the
// correctly rounded binary64 values of pi, pi/2, pi/4 and 3pi/4.
function specialValues() {
  const nan = Number.NaN;
  const inf = Number.POSITIVE_INFINITY;
  const pi = fromBits("400921fb54442d18");
  const halfPi = fromBits("3ff921fb54442d18");
  const quarterPi = fromBits("3fe921fb54442d18");
  const threeQuarterPi = fromBits("4002d97c7f3321d2");
  const rows = [];
  const unaryNan = lock.functions.filter((name) => !binary.has(name));
  for (const name of unaryNan) rows.push([name, [nan], nan]);
  for (const name of [
    "sin",
    "tan",
    "asin",
    "atan",
    "sinh",
    "tanh",
    "asinh",
    "atanh",
    "cbrt",
    "expm1",
    "log1p",
  ]) {
    rows.push([name, [0], 0], [name, [-0], -0]);
  }
  rows.push(
    ["exp", [0], 1],
    ["exp", [-0], 1],
    ["exp", [inf], inf],
    ["exp", [-inf], 0],
    ["exp", [710], inf],
    ["exp", [-746], 0],
    ["expm1", [inf], inf],
    ["expm1", [-inf], -1],
    ["expm1", [710], inf],
    ["log", [0], -inf],
    ["log", [-0], -inf],
    ["log", [1], 0],
    ["log", [-1], nan],
    ["log", [-inf], nan],
    ["log", [inf], inf],
    ["log2", [0], -inf],
    ["log2", [-0], -inf],
    ["log2", [1], 0],
    ["log2", [-1], nan],
    ["log2", [inf], inf],
    ["log2", [8], 3],
    ["log2", [fromBits("0000000000000001")], -1074],
    ["log10", [0], -inf],
    ["log10", [-0], -inf],
    ["log10", [1], 0],
    ["log10", [-1], nan],
    ["log10", [inf], inf],
    ["log10", [1000], 3],
    ["log10", [1e22], 22],
    ["log1p", [-1], -inf],
    ["log1p", [-2], nan],
    ["log1p", [inf], inf],
    ["log1p", [-inf], nan],
    ["sin", [inf], nan],
    ["sin", [-inf], nan],
    ["cos", [inf], nan],
    ["cos", [-inf], nan],
    ["tan", [inf], nan],
    ["cos", [0], 1],
    ["cos", [-0], 1],
    ["asin", [1], halfPi],
    ["asin", [-1], -halfPi],
    ["asin", [1.5], nan],
    ["asin", [-inf], nan],
    ["acos", [1], 0],
    ["acos", [-1], pi],
    ["acos", [0], halfPi],
    ["acos", [1.5], nan],
    ["acos", [inf], nan],
    ["atan", [inf], halfPi],
    ["atan", [-inf], -halfPi],
    ["sinh", [inf], inf],
    ["sinh", [-inf], -inf],
    ["sinh", [711], inf],
    ["sinh", [-711], -inf],
    ["cosh", [0], 1],
    ["cosh", [-0], 1],
    ["cosh", [inf], inf],
    ["cosh", [-inf], inf],
    ["cosh", [-711], inf],
    ["tanh", [inf], 1],
    ["tanh", [-inf], -1],
    ["asinh", [inf], inf],
    ["asinh", [-inf], -inf],
    ["acosh", [1], 0],
    ["acosh", [0.5], nan],
    ["acosh", [-inf], nan],
    ["acosh", [inf], inf],
    ["atanh", [1], inf],
    ["atanh", [-1], -inf],
    ["atanh", [1.5], nan],
    ["atanh", [inf], nan],
    ["cbrt", [inf], inf],
    ["cbrt", [-inf], -inf],
    ["cbrt", [-27], -3],
    ["cbrt", [8], 2],
  );
  // pow, ISO C F.10.4.4.
  rows.push(
    ["pow", [0, -3], inf],
    ["pow", [-0, -3], -inf],
    ["pow", [0, -2], inf],
    ["pow", [-0, -2], inf],
    ["pow", [-0, -0.5], inf],
    ["pow", [0, -inf], inf],
    ["pow", [-0, -inf], inf],
    ["pow", [0, 3], 0],
    ["pow", [-0, 3], -0],
    ["pow", [-0, 2], 0],
    ["pow", [-0, 0.5], 0],
    ["pow", [-0, inf], 0],
    ["pow", [-1, inf], 1],
    ["pow", [-1, -inf], 1],
    ["pow", [1, nan], 1],
    ["pow", [1, inf], 1],
    ["pow", [1, -3.5], 1],
    ["pow", [nan, 0], 1],
    ["pow", [nan, -0], 1],
    ["pow", [inf, 0], 1],
    ["pow", [-2, -0], 1],
    ["pow", [-2, 0.5], nan],
    ["pow", [-inf, 0.5], inf],
    ["pow", [nan, 1], nan],
    ["pow", [2, nan], nan],
    ["pow", [0.5, -inf], inf],
    ["pow", [-0.5, -inf], inf],
    ["pow", [2, -inf], 0],
    ["pow", [-2, -inf], 0],
    ["pow", [0.5, inf], 0],
    ["pow", [-0.5, inf], 0],
    ["pow", [2, inf], inf],
    ["pow", [-2, inf], inf],
    ["pow", [-inf, -3], -0],
    ["pow", [-inf, -2], 0],
    ["pow", [-inf, -0.5], 0],
    ["pow", [-inf, 3], -inf],
    ["pow", [-inf, 2], inf],
    ["pow", [inf, -1], 0],
    ["pow", [inf, 0.5], inf],
    ["pow", [-2, 3], -8],
    ["pow", [2, 1024], inf],
    ["pow", [-2, 1025], -inf],
    ["pow", [2, -1075], 0],
    ["pow", [-2, -1075], -0],
    ["pow", [2, -1074], fromBits("0000000000000001")],
  );
  // atan2(y, x), ISO C F.10.1.4.
  rows.push(
    ["atan2", [0, -0], pi],
    ["atan2", [-0, -0], -pi],
    ["atan2", [0, 0], 0],
    ["atan2", [-0, 0], -0],
    ["atan2", [0, -1], pi],
    ["atan2", [-0, -1], -pi],
    ["atan2", [0, 1], 0],
    ["atan2", [-0, 1], -0],
    ["atan2", [-1, 0], -halfPi],
    ["atan2", [-1, -0], -halfPi],
    ["atan2", [1, 0], halfPi],
    ["atan2", [1, -0], halfPi],
    ["atan2", [1, -inf], pi],
    ["atan2", [-1, -inf], -pi],
    ["atan2", [1, inf], 0],
    ["atan2", [-1, inf], -0],
    ["atan2", [inf, 1], halfPi],
    ["atan2", [-inf, 1], -halfPi],
    ["atan2", [inf, -inf], threeQuarterPi],
    ["atan2", [-inf, -inf], -threeQuarterPi],
    ["atan2", [inf, inf], quarterPi],
    ["atan2", [-inf, inf], -quarterPi],
    ["atan2", [nan, 1], nan],
    ["atan2", [1, nan], nan],
  );
  // hypot, ISO C F.10.4.3.
  rows.push(
    ["hypot", [inf, nan], inf],
    ["hypot", [nan, -inf], inf],
    ["hypot", [-3, 0], 3],
    ["hypot", [-0, -3], 3],
    ["hypot", [0, -0], 0],
    ["hypot", [nan, 1], nan],
    ["hypot", [3, 4], 5],
    ["hypot", [fromBits("7fefffffffffffff"), fromBits("7fefffffffffffff")], inf],
  );
  return rows;
}

async function updateFixture() {
  const directory =
    process.env.NATIVR_CORE_MATH_DIR ??
    path.join(
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".cache"),
      "NativR",
      "core-math",
      lock.source.commit,
    );
  const headRoot = path.join(directory, "wc-head");
  const available = new Set(await readdir(headRoot));
  const functions = {};
  for (const name of lock.functions) {
    if (!available.has(`${name}.wc`)) throw new Error(`Missing ${name}.wc in ${headRoot}`);
    const text = await readFile(path.join(headRoot, `${name}.wc`), "utf8");
    const lines = text.split(/\r?\n/u);
    lines.pop(); // The 64 KiB prefix may end inside a line.
    const rows = [];
    const seen = new Set();
    for (const line of lines) {
      const content = line.split("#")[0].trim();
      if (content === "") continue;
      const fields = content.split(",").map((field) => field.trim().split(/\s+/u)[0]);
      if (fields.length !== (binary.has(name) ? 2 : 1)) continue;
      const values = fields.map(parseHexFloat);
      if (values.some((value) => value === undefined || !Number.isFinite(value) || value === 0))
        continue;
      const bits = values.map(toBits);
      const key = bits.join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(bits);
      if (rows.length === hardCasesPerFunction) break;
    }
    functions[name] = rows;
  }
  const fixture = {
    description:
      "Hard-to-round binary64 inputs for RFC-0007: the first finite, nonzero inputs (at most " +
      `${hardCasesPerFunction} per function) in the first 64 KiB of each CORE-MATH worst-case file ` +
      "src/binary64/<function>/<function>.wc. Arguments are binary64 bit patterns in hex.",
    source: `${lock.source.repository} at ${lock.source.commit} (MIT License)`,
    functions,
  };
  await writeFile(
    fixtureFile,
    await format(JSON.stringify(fixture), { ...prettierOptions, filepath: fixtureFile }),
    "utf8",
  );
  console.log(`Wrote ${path.relative(root, fixtureFile)}`);
}

function parseHexFloat(text) {
  const match = /^([+-]?)0x([0-9a-f]*)(?:\.([0-9a-f]*))?p([+-]?\d+)$/iu.exec(text);
  if (match === null) return undefined;
  const [, sign, whole, fraction = "", exponent] = match;
  const digits = `${whole}${fraction}`;
  if (digits === "") return undefined;
  let value = Number(BigInt(`0x${digits}`));
  if (!Number.isSafeInteger(value) && BigInt(value) !== BigInt(`0x${digits}`)) return undefined;
  let scale = Number(exponent) - 4 * fraction.length;
  while (scale > 1000) {
    value *= 2 ** 1000;
    scale -= 1000;
  }
  while (scale < -1000) {
    value *= 2 ** -1000;
    scale += 1000;
  }
  value *= 2 ** scale;
  return sign === "-" ? -value : value;
}
