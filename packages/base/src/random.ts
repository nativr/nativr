import {
  integerVector,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  setBinding,
} from "@nativr/runtime";
import type { BuiltinInvocation, REnvironment, RIntegerVector } from "@nativr/runtime";
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
  readonly kind: "Mersenne-Twister" | "Marsaglia-Multicarry" | "Wichmann-Hill" | "L'Ecuyer-CMRG";
  readonly values: Uint32Array;
  index: number;
}

export interface RandomState {
  uniformKind: UniformRandomKind;
  normalKind: NormalRandomKind;
  sampleKind: SampleRandomKind;
  engine: RandomEngine;
  /** Box-Muller partner retained outside `.Random.seed`, matching GNU R's paired generator. */
  normalSpare?: number;
  /** Global seed storage is attached only for evaluator-owned streams. */
  seedEnvironment?: REnvironment;
  /** Last vector written by this stream, used to recognize an external R-level restore. */
  seedValue?: RIntegerVector;
  seedSyncDepth?: number;
  seedDirty?: boolean;
}

/** Return the evaluator-owned deterministic random stream, creating its default state if needed. */
export function randomState(invocation: BuiltinInvocation, restoreExternal = true): RandomState {
  const existing = invocation.state.get(RANDOM_STATE_KEY) as RandomState | undefined;
  if (existing !== undefined) {
    if (restoreExternal) restoreExternallyAssignedSeed(existing);
    return existing;
  }
  const created = createRandomState(DEFAULT_RANDOM_SEED);
  created.seedEnvironment = invocation.globalEnvironment();
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
    engine: createRandomEngine(normalizedSeed, uniformKind),
  };
}

/** Reinitialize the selected uniform engine from one signed/unsigned 32-bit seed. */
export function reseedRandomState(state: RandomState, seed: number): void {
  state.engine = createRandomEngine(seed >>> 0, state.uniformKind);
  delete state.normalSpare;
  syncRandomSeed(state);
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
  if (selection.uniformKind !== undefined || selection.normalKind !== undefined) {
    delete state.normalSpare;
  }
  if (selection.uniformKind !== undefined) {
    const transitionSeed = nextRandomUint32(state);
    state.uniformKind = selection.uniformKind;
    state.engine = createRandomEngine(transitionSeed, selection.uniformKind);
  }
  if (selection.normalKind !== undefined) state.normalKind = selection.normalKind;
  if (selection.sampleKind !== undefined) state.sampleKind = selection.sampleKind;
  syncRandomSeed(state);
}

/** Advance the selected stream and return one uniform value in [0, 1). */
export function nextRandom(state: RandomState): number {
  let value: number;
  switch (state.engine.kind) {
    case "Mersenne-Twister":
      value = fixUniform(nextMersenneWord(state.engine) / 4_294_967_296);
      break;
    case "Marsaglia-Multicarry":
      value = fixUniform(nextMarsagliaWord(state.engine) / 4_294_967_295);
      break;
    case "Wichmann-Hill":
      value = nextWichmannHill(state.engine);
      break;
    case "L'Ecuyer-CMRG":
      value = nextLEcuyerCMRG(state.engine);
      break;
  }
  state.seedDirty = true;
  if ((state.seedSyncDepth ?? 0) === 0) {
    syncRandomSeed(state);
    state.seedDirty = false;
  }
  return value;
}

/** Materialize `.Random.seed` once around a bulk generator while preserving stream semantics. */
export function withDeferredRandomSeedSync<T>(state: RandomState, generate: () => T): T {
  state.seedSyncDepth = (state.seedSyncDepth ?? 0) + 1;
  try {
    return generate();
  } finally {
    state.seedSyncDepth = Math.max(0, (state.seedSyncDepth ?? 1) - 1);
    if (state.seedSyncDepth === 0 && state.seedDirty === true) {
      syncRandomSeed(state);
      state.seedDirty = false;
    }
  }
}

/** Materialize the evaluator RNG as GNU R's ordinary `.GlobalEnv$.Random.seed` integer vector. */
function syncRandomSeed(state: RandomState): void {
  if (state.seedEnvironment === undefined) return;
  const engineValues = Array.from(state.engine.values, signedInt32);
  const seed = integerVector([
    randomKindCode(state),
    ...(state.engine.kind === "Mersenne-Twister" ? [state.engine.index] : []),
    ...engineValues,
  ]);
  setBinding(state.seedEnvironment, ".Random.seed", seed);
  state.seedValue = seed;
}

/** Lazily apply an R-level `.Random.seed <- saved_seed` before the next RNG operation. */
function restoreExternallyAssignedSeed(state: RandomState): void {
  const binding = state.seedEnvironment?.bindings.get(".Random.seed");
  if (binding === undefined || binding === state.seedValue) return;
  if (binding.type !== "integer") {
    throw new RTypeMismatchError("NRT3275", "'.Random.seed' must be an integer vector");
  }
  const decoded = decodeRandomSeed(binding);
  state.uniformKind = decoded.uniformKind;
  state.normalKind = decoded.normalKind;
  state.sampleKind = decoded.sampleKind;
  state.engine = decoded.engine;
  state.seedValue = binding;
}

function decodeRandomSeed(seed: RIntegerVector): RandomState {
  if (seed.length === 0) {
    throw new RTypeMismatchError("NRT3275", "'.Random.seed' has wrong length");
  }
  const code = seed.values[0] ?? -1;
  const uniformCode = code % 100;
  const normalCode = Math.floor(code / 100) % 100;
  const sampleCode = Math.floor(code / 10_000) % 100;
  const uniformKind = UNIFORM_RANDOM_KINDS[uniformCode];
  const normalKind = NORMAL_RANDOM_KINDS[normalCode];
  const sampleKind = SAMPLE_RANDOM_KINDS[sampleCode];
  if (
    uniformKind === undefined ||
    normalKind === undefined ||
    sampleKind === undefined ||
    (uniformKind !== "Mersenne-Twister" &&
      uniformKind !== "Marsaglia-Multicarry" &&
      uniformKind !== "Wichmann-Hill" &&
      uniformKind !== "L'Ecuyer-CMRG")
  ) {
    throw new RTypeMismatchError("NRT3275", "'.Random.seed' contains an unsupported RNG kind");
  }
  const expectedLength =
    uniformKind === "Mersenne-Twister"
      ? 626
      : uniformKind === "Marsaglia-Multicarry"
        ? 3
        : uniformKind === "Wichmann-Hill"
          ? 4
          : 7;
  if (seed.length !== expectedLength) {
    throw new RTypeMismatchError("NRT3275", "'.Random.seed' has wrong length");
  }
  const index = uniformKind === "Mersenne-Twister" ? (seed.values[1] ?? -1) : 0;
  if (uniformKind === "Mersenne-Twister" && (index < 0 || index > 624)) {
    throw new RTypeMismatchError("NRT3275", "'.Random.seed' contains an invalid position");
  }
  const offset = uniformKind === "Mersenne-Twister" ? 2 : 1;
  const values = Uint32Array.from({ length: seed.length - offset }, (_, index) =>
    seed.missing?.[offset + index] === 1
      ? 0x80_00_00_00
      : unsignedInt32(seed.values[offset + index] ?? 0),
  );
  return {
    uniformKind,
    normalKind,
    sampleKind,
    engine: { kind: uniformKind, values, index },
  };
}

function randomKindCode(state: RandomState): number {
  return (
    UNIFORM_RANDOM_KINDS.indexOf(state.uniformKind) +
    100 * NORMAL_RANDOM_KINDS.indexOf(state.normalKind) +
    10_000 * SAMPLE_RANDOM_KINDS.indexOf(state.sampleKind)
  );
}

function signedInt32(value: number): number {
  return value | 0;
}

function unsignedInt32(value: number): number {
  return value >>> 0;
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
  if (state.normalKind === "Buggy Kinderman-Ramage") {
    return nextKindermanRamage(state, true);
  }
  if (state.normalKind === "Kinderman-Ramage") {
    return nextKindermanRamage(state, false);
  }
  if (state.normalKind === "Inversion") {
    const precision = 134_217_728;
    const probability = (Math.floor(precision * nextRandom(state)) + nextRandom(state)) / precision;
    return normalQuantile(probability);
  }
  if (state.normalKind === "Box-Muller") {
    const spare = state.normalSpare;
    if (spare !== undefined && spare !== 0) {
      delete state.normalSpare;
      return spare;
    }
    const angle = 2 * Math.PI * nextRandom(state);
    const radius = Math.sqrt(-2 * Math.log(nextRandom(state))) + 10 * Number.MIN_VALUE;
    state.normalSpare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  }
  throw new RUnsupportedFeatureError(
    "NRU6143",
    `Normal RNG kind '${state.normalKind}' requires an unimplemented browser-native generator.`,
  );
}

/**
 * Kinderman-Ramage normal variates in the notation of the published algorithm.
 *
 * The legacy stream is intentionally distinct from the corrected algorithm: its triangular branch
 * uses the historical coefficient and its near-zero branch omits the second density acceptance
 * test. Those two observable defects are retained only to reproduce pre-1.7 results.
 */
function nextKindermanRamage(state: RandomState, buggy: boolean): number {
  const normalDensityAtZero = 1 / Math.sqrt(2 * Math.PI);
  const triangleDensity = 0.180_025_191_068_563;
  const xi = normalDensityAtZero / triangleDensity;
  const xiSquaredOverTwo = (xi * xi) / 2;
  const differenceDensity = (value: number): number =>
    normalDensityAtZero * Math.exp((-value * value) / 2) -
    triangleDensity * Math.max(xi - Math.abs(value), 0);

  const region = nextRandom(state);
  if (region < 0.884_070_402_298_758) {
    const triangularCoefficient = buggy ? 1.131_131_635_441_8 : 1.131_131_635_444_18;
    return xi * (triangularCoefficient * region + nextRandom(state) - 1);
  }

  if (region >= 0.973_310_954_173_898) {
    while (true) {
      const first = nextRandom(state);
      const second = nextRandom(state);
      const candidateSquaredOverTwo = xiSquaredOverTwo - Math.log(second);
      if (first * first * candidateSquaredOverTwo > xiSquaredOverTwo) continue;
      const candidate = Math.sqrt(2 * candidateSquaredOverTwo);
      return region < 0.986_655_477_086_949 ? candidate : -candidate;
    }
  }

  if (region >= 0.958_720_824_790_463) {
    while (true) {
      const first = nextRandom(state);
      const second = nextRandom(state);
      const difference = first - second;
      const candidate = xi - 0.630_834_801_921_96 * Math.min(first, second);
      if (
        Math.max(first, second) <= 0.755_591_531_667_601 ||
        0.034_240_503_750_111 * Math.abs(difference) <= differenceDensity(candidate)
      ) {
        return difference < 0 ? candidate : -candidate;
      }
    }
  }

  if (region >= 0.911_312_780_288_703) {
    while (true) {
      const first = nextRandom(state);
      const second = nextRandom(state);
      const difference = first - second;
      const candidate = 0.479_727_404_222_441 + 1.105_473_661_022_07 * Math.min(first, second);
      if (
        Math.max(first, second) <= 0.872_834_976_671_79 ||
        0.049_264_496_373_128 * Math.abs(difference) <= differenceDensity(candidate)
      ) {
        return difference < 0 ? candidate : -candidate;
      }
    }
  }

  while (true) {
    const first = nextRandom(state);
    const second = nextRandom(state);
    const difference = first - second;
    const candidate = 0.479_727_404_222_441 - 0.595_507_138_015_94 * Math.min(first, second);
    if (buggy) {
      if (Math.max(first, second) <= 0.805_577_924_423_817) {
        return difference < 0 ? candidate : -candidate;
      }
      continue;
    }
    if (candidate < 0) continue;
    if (
      Math.max(first, second) <= 0.805_577_924_423_817 ||
      0.053_377_549_506_886 * Math.abs(difference) <= differenceDensity(candidate)
    ) {
      return difference < 0 ? candidate : -candidate;
    }
  }
}

function createRandomEngine(seed: number, kind: UniformRandomKind): RandomEngine {
  const seeds = lcgSeeds(seed);
  switch (kind) {
    case "Mersenne-Twister":
      return { kind, values: Uint32Array.from(seeds.slice(1)), index: 624 };
    case "Marsaglia-Multicarry":
      return { kind, values: Uint32Array.from(seeds.slice(0, 2)), index: 0 };
    case "Wichmann-Hill":
      return {
        kind,
        values: Uint32Array.from([
          (seeds[0] ?? 0) % 30_269,
          (seeds[1] ?? 0) % 30_307,
          (seeds[2] ?? 0) % 30_323,
        ]),
        index: 0,
      };
    case "L'Ecuyer-CMRG":
      return { kind, values: Uint32Array.from(seeds.slice(0, 6)), index: 0 };
    default:
      throw new RUnsupportedFeatureError(
        "NRU6143",
        `RNG kind '${kind}' requires an unimplemented browser-native generator.`,
      );
  }
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

function nextMarsagliaWord(engine: RandomEngine): number {
  const first = engine.values[0] ?? 0;
  const second = engine.values[1] ?? 0;
  const nextFirst = (Math.imul(36_969, first & 0xff_ff) + (first >>> 16)) >>> 0;
  const nextSecond = (Math.imul(18_000, second & 0xff_ff) + (second >>> 16)) >>> 0;
  engine.values[0] = nextFirst;
  engine.values[1] = nextSecond;
  return ((nextFirst << 16) ^ (nextSecond & 0xff_ff)) >>> 0;
}

function nextWichmannHill(engine: RandomEngine): number {
  const first = (171 * (engine.values[0] ?? 0)) % 30_269;
  const second = (172 * (engine.values[1] ?? 0)) % 30_307;
  const third = (170 * (engine.values[2] ?? 0)) % 30_323;
  engine.values[0] = first;
  engine.values[1] = second;
  engine.values[2] = third;
  return fixUniform((first / 30_269 + second / 30_307 + third / 30_323) % 1);
}

const LECUYER_MODULUS_1 = 4_294_967_087;
const LECUYER_MODULUS_2 = 4_294_944_443;

/** Advance one GNU-shaped L'Ecuyer-CMRG seed by a stream or substream jump. */
export function advanceLEcuyerSeed(seed: RIntegerVector, substream: boolean): RIntegerVector {
  if (seed.length !== 7 || (seed.values[0] ?? 0) % 100 !== 7) {
    throw new RTypeMismatchError("NRT3276", "invalid value of 'seed'");
  }
  const values = Array.from({ length: 6 }, (_, index) =>
    seed.missing?.[index + 1] === 1 ? 0x80_00_00_00 : unsignedInt32(seed.values[index + 1] ?? 0),
  );
  const power = substream ? 76 : 127;
  const first = jumpLEcuyerComponent(
    values.slice(0, 3),
    LECUYER_MODULUS_1,
    [LECUYER_MODULUS_1 - 810_728, 1_403_580, 0],
    power,
  );
  const second = jumpLEcuyerComponent(
    values.slice(3),
    LECUYER_MODULUS_2,
    [LECUYER_MODULUS_2 - 1_370_589, 0, 527_612],
    power,
  );
  return integerVector([seed.values[0] ?? 0, ...first, ...second].map(signedInt32));
}

function nextLEcuyerCMRG(engine: RandomEngine): number {
  let first =
    (1_403_580 * (engine.values[1] ?? 0) - 810_728 * (engine.values[0] ?? 0)) % LECUYER_MODULUS_1;
  let second =
    (527_612 * (engine.values[5] ?? 0) - 1_370_589 * (engine.values[3] ?? 0)) % LECUYER_MODULUS_2;
  if (first < 0) first += LECUYER_MODULUS_1;
  if (second < 0) second += LECUYER_MODULUS_2;
  engine.values.copyWithin(0, 1, 3);
  engine.values[2] = first;
  engine.values.copyWithin(3, 4, 6);
  engine.values[5] = second;
  const difference = first - second;
  return fixUniform(
    (difference > 0 ? difference : difference + LECUYER_MODULUS_1) / (LECUYER_MODULUS_1 + 1),
  );
}

function jumpLEcuyerComponent(
  state: readonly number[],
  modulus: number,
  lastRow: readonly number[],
  power: number,
): number[] {
  const divisor = BigInt(modulus);
  let matrix = [0, 1, 0, 0, 0, 1, ...lastRow].map(BigInt);
  for (let index = 0; index < power; index += 1) {
    matrix = Array.from({ length: 9 }, (_, cell) => {
      let value = 0n;
      for (let inner = 0; inner < 3; inner += 1) {
        value += matrix[Math.floor(cell / 3) * 3 + inner]! * matrix[inner * 3 + (cell % 3)]!;
      }
      return value % divisor;
    });
  }
  return Array.from({ length: 3 }, (_, row) =>
    Number(
      state.reduce((sum, value, column) => sum + matrix[row * 3 + column]! * BigInt(value), 0n) %
        divisor,
    ),
  );
}

function nextRandomUint32(state: RandomState): number {
  return Math.floor(nextRandom(state) * 4_294_967_296) >>> 0;
}

function nextRandomBits(state: RandomState, bits: number): number {
  // GNU R advances the uniform stream even when discrete rejection sampling has only one possible
  // result. This matters for every full permutation because its final singleton draw is observable
  // through the following RNG state.
  if (bits === 0) {
    nextRandom(state);
    return 0;
  }
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
