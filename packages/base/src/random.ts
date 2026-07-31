import type { BuiltinInvocation } from "@nativr/runtime";
import { normalQuantile } from "./student-t.js";

export const RANDOM_STATE_KEY = "base.random";
export const DEFAULT_RANDOM_SEED = 0x6d_2b_79_f5;

export const UNIFORM_RANDOM_KINDS = [
  "Wichmann-Hill",
  "Marsaglia-Multicarry",
  "Super-Duper",
  "Mersenne-Twister",
  "Knuth-TAOCP",
  "user-supplied",
  "Knuth-TAOCP-2002",
  "L'Ecuyer-CMRG",
] as const;

export const NORMAL_RANDOM_KINDS = [
  "Buggy Kinderman-Ramage",
  "Ahrens-Dieter",
  "Box-Muller",
  "user-supplied",
  "Inversion",
  "Kinderman-Ramage",
] as const;

export const SAMPLE_RANDOM_KINDS = ["Rounding", "Rejection"] as const;

export type UniformRandomKind = (typeof UNIFORM_RANDOM_KINDS)[number];
export type NormalRandomKind = (typeof NORMAL_RANDOM_KINDS)[number];
export type SampleRandomKind = (typeof SAMPLE_RANDOM_KINDS)[number];

export const DEFAULT_UNIFORM_RANDOM_KIND: UniformRandomKind = "Mersenne-Twister";
export const DEFAULT_NORMAL_RANDOM_KIND: NormalRandomKind = "Inversion";
export const DEFAULT_SAMPLE_RANDOM_KIND: SampleRandomKind = "Rejection";

interface RandomEngine {
  readonly values: Uint32Array;
  index: number;
}

export interface RandomState {
  uniformKind: UniformRandomKind;
  normalKind: NormalRandomKind;
  sampleKind: SampleRandomKind;
  engine: RandomEngine;
}

/** Return the evaluator-owned deterministic random stream, creating its default state if needed. */
export function randomState(invocation: BuiltinInvocation): RandomState {
  const existing = invocation.state.get(RANDOM_STATE_KEY) as RandomState | undefined;
  if (existing !== undefined) return existing;
  const created = createRandomState(DEFAULT_RANDOM_SEED);
  invocation.state.set(RANDOM_STATE_KEY, created);
  return created;
}

/** Construct one session stream with explicit R-compatible kind labels. */
export function createRandomState(
  seed: number,
  uniformKind: UniformRandomKind = DEFAULT_UNIFORM_RANDOM_KIND,
  normalKind: NormalRandomKind = DEFAULT_NORMAL_RANDOM_KIND,
  sampleKind: SampleRandomKind = DEFAULT_SAMPLE_RANDOM_KIND,
): RandomState {
  const normalizedSeed = seed >>> 0;
  return {
    uniformKind,
    normalKind,
    sampleKind,
    engine: createRandomEngine(normalizedSeed),
  };
}

/** Reinitialize the selected uniform engine from one signed/unsigned 32-bit seed. */
export function reseedRandomState(state: RandomState, seed: number): void {
  state.engine = createRandomEngine(seed >>> 0);
}

/**
 * Apply already-validated kind selections.
 *
 * Selecting a uniform kind, including the current kind, deterministically derives a fresh seed from
 * the old stream before rebuilding the engine.
 */
export function configureRandomState(
  state: RandomState,
  selection: {
    readonly uniformKind?: UniformRandomKind;
    readonly normalKind?: NormalRandomKind;
    readonly sampleKind?: SampleRandomKind;
  },
): void {
  if (selection.uniformKind !== undefined) {
    const transitionSeed = nextRandomUint32(state);
    state.uniformKind = selection.uniformKind;
    state.engine = createRandomEngine(transitionSeed);
  }
  if (selection.normalKind !== undefined) state.normalKind = selection.normalKind;
  if (selection.sampleKind !== undefined) state.sampleKind = selection.sampleKind;
}

/** Advance the selected stream and return one uniform value in [0, 1). */
export function nextRandom(state: RandomState): number {
  return fixUniform(nextMersenneWord(state.engine) / 4_294_967_296);
}

/** Return an unbiased zero-based index according to the selected discrete-uniform sampler. */
export function nextRandomIndex(state: RandomState, upperExclusive: number): number {
  if (
    !Number.isInteger(upperExclusive) ||
    upperExclusive <= 0 ||
    upperExclusive > 4_500_000_000_000_000
  ) {
    throw new RangeError("Random-index upper bound is outside the supported integer range.");
  }
  if (state.sampleKind === "Rounding") {
    return Math.floor(nextRandom(state) * upperExclusive);
  }
  const bits = Math.ceil(Math.log2(upperExclusive));
  while (true) {
    const candidate = nextRandomBits(state, bits);
    if (candidate < upperExclusive) return candidate;
  }
}

/** Advance the selected normal generator. */
export function nextNormal(state: RandomState): number {
  const precision = 134_217_728;
  const probability = (Math.floor(precision * nextRandom(state)) + nextRandom(state)) / precision;
  return normalQuantile(probability);
}

function createRandomEngine(seed: number): RandomEngine {
  const seeds = lcgSeeds(seed);
  return {
    values: Uint32Array.from(seeds.slice(1)),
    index: 624,
  };
}

function lcgSeeds(seed: number): number[] {
  let value = seed >>> 0;
  for (let index = 0; index < 50; index += 1) {
    value = (Math.imul(69_069, value) + 1) >>> 0;
  }
  return Array.from({ length: 625 }, () => {
    value = (Math.imul(69_069, value) + 1) >>> 0;
    return value;
  });
}

function nextMersenneWord(engine: RandomEngine): number {
  if (engine.index >= 624) {
    for (let index = 0; index < 624; index += 1) {
      const word =
        ((engine.values[index] ?? 0) & 0x80_00_00_00) |
        ((engine.values[(index + 1) % 624] ?? 0) & 0x7f_ff_ff_ff);
      engine.values[index] =
        ((engine.values[(index + 397) % 624] ?? 0) ^
          (word >>> 1) ^
          ((word & 1) === 1 ? 0x99_08_b0_df : 0)) >>>
        0;
    }
    engine.index = 0;
  }
  let word = engine.values[engine.index] ?? 0;
  engine.index += 1;
  word ^= word >>> 11;
  word ^= (word << 7) & 0x9d_2c_56_80;
  word ^= (word << 15) & 0xef_c6_00_00;
  word ^= word >>> 18;
  return word >>> 0;
}

function nextRandomUint32(state: RandomState): number {
  return Math.floor(nextRandom(state) * 4_294_967_296) >>> 0;
}

function nextRandomBits(state: RandomState, bits: number): number {
  const chunks = Math.ceil(bits / 16);
  const leadingBits = bits - (chunks - 1) * 16;
  let value = 0;
  for (let chunk = 0; chunk < chunks; chunk += 1) {
    const word = Math.floor(nextRandom(state) * 65_536);
    value = value * 65_536 + (chunk === 0 && leadingBits < 16 ? word % 2 ** leadingBits : word);
  }
  return value;
}

function fixUniform(value: number): number {
  if (value <= 0) return 0.5 / 4_294_967_296;
  if (value >= 1) return 1 - 0.5 / 4_294_967_296;
  return value;
}
