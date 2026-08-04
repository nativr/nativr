import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  R_NULL,
  characterVector,
  doubleVector,
  isMissing,
  listValue,
  withAttribute,
  withDimensions,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  RBuiltin,
  RCharacterVector,
  RValue,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";
import { parseRColour } from "./colours.js";

export interface ColourRampBuiltinSpec {
  readonly name: "colorRamp" | "colorRampPalette";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

export const COLOUR_RAMP_BUILTIN_SPECS: readonly ColourRampBuiltinSpec[] = [
  {
    name: "colorRamp",
    parameters: ["colors", "bias", "space", "interpolate", "alpha"],
    compatibility: "numeric",
    implementation: builtinColorRamp,
  },
  {
    name: "colorRampPalette",
    parameters: ["colors", "..."],
    compatibility: "numeric",
    implementation: builtinColorRampPalette,
  },
];

export const CONVERT_COLOUR_BUILTIN_SPEC = {
  name: "convertColor",
  parameters: [
    "color",
    "from",
    "to",
    "from.ref.white",
    "to.ref.white",
    "scale.in",
    "scale.out",
    "clip",
  ],
  compatibility: "numeric",
  implementation: builtinConvertColor,
} as const;

type Rgba = readonly [number, number, number, number];
type Triple = readonly [number, number, number];

const RAMP_ARGUMENTS = ["colors", "bias", "space", "interpolate", "alpha"] as const;
type RampSpace = "rgb" | "Lab";
type RampInterpolation = "linear" | "spline";
// Measured through the documented convertColor() boundary. R is used only as a black-box oracle.
const SRGB_TO_XYZ: readonly Triple[] = [
  [0.41682134188531705, 0.35657671707797467, 0.17980765358608541],
  [0.2149235044096166, 0.7131534341559493, 0.07192306143443417],
  [0.01953850040087425, 0.11885890569265833, 0.9469869755533833],
];
const XYZ_TO_SRGB: readonly Triple[] = [
  [3.2065205, -1.5210418, -0.4933108],
  [-0.9719825, 1.8812687, 0.0416725],
  [0.0558383, -0.2047406, 1.0609284],
];
const D65 = SRGB_TO_XYZ.map((row) => row[0] + row[1] + row[2]) as unknown as Triple;

type ConversionSpace = "sRGB" | "Lab" | "XYZ";

async function builtinConvertColor(invocation: BuiltinInvocation): Promise<RValue> {
  const parameters = CONVERT_COLOUR_BUILTIN_SPEC.parameters;
  const { matched } = matchBuiltinArguments(invocation, parameters);
  const requirePromise = (name: "color" | "from" | "to") => {
    const argument = matched.get(name);
    if (argument === undefined || argument.promise.missing) {
      throw new REvaluationError("NRE2144", `Argument '${name}' is missing in convertColor().`);
    }
    return argument.promise;
  };
  const color = await invocation.force(requirePromise("color"));
  const from = conversionSpace(await invocation.force(requirePromise("from")), "from");
  const to = conversionSpace(await invocation.force(requirePromise("to")), "to");
  for (const name of ["from.ref.white", "to.ref.white"] as const) {
    const argument = matched.get(name);
    if (argument !== undefined && (await invocation.force(argument.promise)).type !== "null") {
      throw new RUnsupportedFeatureError(
        "NRU6149",
        `convertColor(${name}=) is outside the current numeric contract.`,
      );
    }
  }
  const scaleIn = await rampNumber(invocation, matched.get("scale.in"), 1, "scale.in");
  const scaleOut = await rampNumber(invocation, matched.get("scale.out"), 1, "scale.out");
  if (scaleIn === 0) {
    throw new RTypeMismatchError("NRT3292", "'scale.in' must be non-zero.");
  }
  const clip = await rampFlag(invocation, matched.get("clip"), true, "clip");
  if (color.type !== "logical" && color.type !== "integer" && color.type !== "double") {
    throw new RTypeMismatchError("NRT3292", "'color' must be a numeric three-column matrix.");
  }
  const dimensions = color.attributes.get("dim");
  const matrix = dimensions?.type === "integer" && dimensions.length === 2;
  const rows = matrix ? (dimensions.values[0] ?? 0) : color.length === 3 ? 1 : -1;
  if (rows < 0 || (matrix && dimensions.values[1] !== 3) || rows * 3 !== color.length) {
    throw new RTypeMismatchError("NRT3292", "'color' must have exactly three columns.");
  }
  const values = new Float64Array(rows * 3);
  const missing = new Uint8Array(rows * 3);
  for (let row = 0; row < rows; row += 1) {
    invocation.context.checkpoint();
    const source = [0, 1, 2].map((column) => row + column * rows);
    if (source.some((index) => isMissing(color, index))) {
      for (const index of source) missing[index] = 1;
      continue;
    }
    const input = source.map(
      (index) => (color.values[index] ?? Number.NaN) / scaleIn,
    ) as unknown as Triple;
    const xyz = conversionToXyz(input, from);
    const converted = conversionFromXyz(xyz, to, clip);
    for (let column = 0; column < 3; column += 1) {
      values[row + column * rows] = (converted[column] ?? Number.NaN) * scaleOut;
    }
  }
  invocation.context.allocate(values.length);
  let output = withDimensions(
    doubleVector(values, missing.some((entry) => entry === 1) ? missing : undefined),
    [rows, 3],
  );
  if (to === "Lab") {
    output = withAttribute(
      output,
      "dimnames",
      listValue([R_NULL, characterVector(["L", "a", "b"])]),
    );
  }
  return output;
}

function conversionSpace(value: RValue, name: "from" | "to"): ConversionSpace {
  if (value.type !== "character" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3292", `'${name}' must name one colour space.`);
  }
  const input = value.values[0] ?? "";
  if (input === "sRGB" || input === "Lab" || input === "XYZ") return input;
  throw new RUnsupportedFeatureError(
    "NRU6149",
    `convertColor() does not support colour space '${input}'.`,
  );
}

function conversionToXyz(value: Triple, space: ConversionSpace): Triple {
  if (space === "XYZ") return value;
  return space === "sRGB" ? srgbToXyz(value) : labToXyz(value);
}

function conversionFromXyz(value: Triple, space: ConversionSpace, clip: boolean): Triple {
  if (space === "XYZ") return value;
  return space === "sRGB" ? xyzToSrgb(value, clip) : xyzToLab(value);
}

async function builtinColorRamp(invocation: BuiltinInvocation): Promise<RValue> {
  const settings = await rampSettings(invocation, "colorRamp");
  const ramp: RBuiltin = {
    type: "builtin",
    definition: {
      package: "grDevices",
      name: "colorRamp",
      kind: "regular",
      metadata: {
        package: "grDevices",
        name: "colorRamp",
        compatibilityLevel: "numeric",
        referenceVersion: "R 4.6.x documented behavior",
        supportedArguments: ["x"],
      },
      implementation: async (call) => {
        const { matched } = matchBuiltinArguments(call, ["x"]);
        const xArgument = matched.get("x");
        if (xArgument === undefined || xArgument.promise.missing) {
          throw new REvaluationError("NRE2144", "Argument 'x' is missing in a colorRamp function.");
        }
        const points = rampPoints(await call.force(xArgument.promise));
        const rows = points.values.length;
        const columns = rows === 0 ? 4 : settings.alpha ? 4 : 3;
        call.context.allocate(rows * columns);
        const values = new Float64Array(rows * columns);
        const missing = new Uint8Array(rows * columns);
        for (let row = 0; row < rows; row += 1) {
          call.context.checkpoint();
          const point = points.values[row] ?? Number.NaN;
          if (points.missing[row] === 1 || !Number.isFinite(point) || point < 0 || point > 1) {
            for (let column = 0; column < columns; column += 1) {
              const offset = row + column * rows;
              if (Number.isNaN(point) && points.missing[row] !== 1) values[offset] = Number.NaN;
              else missing[offset] = 1;
            }
            continue;
          }
          const interpolated = interpolateRamp(
            point,
            settings.positions,
            settings.coordinates,
            settings.interpolate,
            settings.channelCoordinates,
            settings.secondDerivatives,
          );
          const channels =
            settings.space === "Lab"
              ? [...labToSrgb(interpolated as Triple).map((channel) => channel * 255), 255]
              : interpolated;
          for (let column = 0; column < columns; column += 1) {
            values[row + column * rows] = Math.max(
              0,
              Math.min(255, channels[column] ?? (column === 3 ? 255 : 0)),
            );
          }
        }
        let result = withDimensions(
          doubleVector(values, missing.some((entry) => entry === 1) ? missing : undefined),
          [rows, columns],
        );
        if (rows === 0) {
          result = withAttribute(result, "dimnames", listValue([R_NULL, R_NULL]));
        }
        return result;
      },
    },
  };
  invocation.context.allocate(1);
  return ramp;
}

async function builtinColorRampPalette(invocation: BuiltinInvocation): Promise<RValue> {
  const settings = await rampSettings(invocation, "colorRampPalette");

  const palette: RBuiltin = {
    type: "builtin",
    definition: {
      package: "grDevices",
      name: "colorRampPalette",
      kind: "regular",
      metadata: {
        package: "grDevices",
        name: "colorRampPalette",
        compatibilityLevel: "numeric",
        referenceVersion: "R 4.6.x documented behavior",
        supportedArguments: ["n"],
      },
      implementation: async (call) => {
        const { matched: paletteArguments } = matchBuiltinArguments(call, ["n"]);
        const nArgument = paletteArguments.get("n");
        if (nArgument === undefined || nArgument.promise.missing) {
          throw new REvaluationError(
            "NRE2144",
            "Argument 'n' is missing in a colorRampPalette() function.",
          );
        }
        const n = Math.ceil(rampCount(await call.force(nArgument.promise)));
        if (n < 0) {
          throw new RTypeMismatchError("NRT3291", "'length.out' must be a non-negative number.");
        }
        call.context.allocate(n);
        return characterVector(
          Array.from({ length: n }, (_, index) => {
            call.context.checkpoint();
            const point = n === 1 ? 0 : index / (n - 1);
            const interpolated = interpolateRamp(
              point,
              settings.positions,
              settings.coordinates,
              settings.interpolate,
              settings.channelCoordinates,
              settings.secondDerivatives,
            );
            const rgba =
              settings.space === "Lab"
                ? [...labToSrgb(interpolated as Triple).map((channel) => channel * 255), 255]
                : interpolated;
            return formatRampColour(rgba, settings.alpha);
          }),
        );
      },
    },
  };
  invocation.context.allocate(1);
  return palette;
}

interface RampSettings {
  readonly alpha: boolean;
  readonly space: RampSpace;
  readonly interpolate: RampInterpolation;
  readonly positions: readonly number[];
  readonly coordinates: readonly (readonly number[])[];
  readonly channelCoordinates: readonly (readonly number[])[];
  readonly secondDerivatives: readonly Float64Array[] | undefined;
}

async function rampSettings(
  invocation: BuiltinInvocation,
  call: "colorRamp" | "colorRampPalette",
): Promise<RampSettings> {
  const { matched } = matchBuiltinArguments(invocation, RAMP_ARGUMENTS);
  const colorsArgument = matched.get("colors");
  if (colorsArgument === undefined || colorsArgument.promise.missing) {
    throw new REvaluationError("NRE2144", `Argument 'colors' is missing in ${call}().`);
  }
  const colors = rampColors(await invocation.force(colorsArgument.promise), call);
  const bias = await rampNumber(invocation, matched.get("bias"), 1, "bias");
  if (bias <= 0) {
    throw new RTypeMismatchError("NRT3291", "'bias' must be positive.");
  }
  const alpha = await rampFlag(invocation, matched.get("alpha"), false, "alpha");
  if (alpha && matched.has("space")) {
    throw new RTypeMismatchError("NRT3291", "'alpha' must be false if 'space' is specified.");
  }
  const space = await rampChoice(invocation, matched.get("space"), ["rgb", "Lab"], "rgb");
  const interpolate = await rampChoice(
    invocation,
    matched.get("interpolate"),
    ["linear", "spline"],
    "linear",
  );
  const coordinates: readonly (readonly number[])[] =
    space === "Lab"
      ? colors.map((color) => srgbToLab([color[0] / 255, color[1] / 255, color[2] / 255]))
      : colors.map((color) => (alpha ? color : color.slice(0, 3)));
  const positions =
    colors.length === 1
      ? [0]
      : colors.map((_color, index) => (index / (colors.length - 1)) ** bias);
  const channelCoordinates = coordinates[0]!.map((_value, channel) =>
    coordinates.map((coordinate) => coordinate[channel] ?? 0),
  );
  const secondDerivatives =
    interpolate === "spline" && coordinates.length > 1
      ? channelCoordinates.map((values) => splineSecondDerivatives(positions, values))
      : undefined;
  return {
    alpha,
    space,
    interpolate,
    positions,
    coordinates,
    channelCoordinates,
    secondDerivatives,
  };
}

function rampColors(value: RValue, call: "colorRamp" | "colorRampPalette"): readonly Rgba[] {
  if (value.type !== "character") {
    throw new RTypeMismatchError("NRT3291", `${call}(colors=) requires a character vector.`);
  }
  if (value.length === 0) {
    throw new RTypeMismatchError("NRT3291", "need at least two non-NA values to interpolate.");
  }
  return Array.from({ length: value.length }, (_, index) =>
    isMissing(value, index) ? ([255, 255, 255, 255] as const) : parseRampColour(value, index, call),
  );
}

function parseRampColour(
  value: RCharacterVector,
  index: number,
  call: "colorRamp" | "colorRampPalette",
): Rgba {
  const input = value.values[index] ?? "";
  const colour = parseRColour(input);
  if (colour === undefined) {
    throw new RUnsupportedFeatureError(
      "NRU6148",
      `${call}() does not yet recognize color '${input}'.`,
    );
  }
  return colour;
}

interface RampPoints {
  readonly values: readonly number[];
  readonly missing: readonly number[];
}

function rampPoints(value: RValue): RampPoints {
  if (value.type === "null") return { values: [], missing: [] };
  if (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "character"
  ) {
    const values = Array.from({ length: value.length }, (_, index) =>
      value.type === "character"
        ? Number(value.values[index] ?? "")
        : (value.values[index] ?? Number.NaN),
    );
    const missing = values.map((_entry, index) => (isMissing(value, index) ? 1 : 0));
    return { values, missing };
  }
  if (value.type === "list" || value.type === "pairlist") {
    const values: number[] = [];
    const missing: number[] = [];
    for (const entry of value.values) {
      if (
        (entry.type === "logical" ||
          entry.type === "integer" ||
          entry.type === "double" ||
          entry.type === "character") &&
        entry.length === 1
      ) {
        values.push(
          entry.type === "character"
            ? Number(entry.values[0] ?? "")
            : (entry.values[0] ?? Number.NaN),
        );
        missing.push(isMissing(entry, 0) ? 1 : 0);
      } else {
        throw new RTypeMismatchError("NRT3291", "colorRamp input must be coercible to numeric.");
      }
    }
    return { values, missing };
  }
  throw new RTypeMismatchError("NRT3291", "colorRamp input must be coercible to numeric.");
}

async function rampNumber(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  if (argument === undefined) return fallback;
  return rampCount(await invocation.force(argument.promise), name);
}

function rampCount(value: RValue, name = "n"): number {
  if (
    (value.type !== "logical" &&
      value.type !== "integer" &&
      value.type !== "double" &&
      value.type !== "character") ||
    value.length !== 1 ||
    isMissing(value, 0)
  ) {
    throw new RTypeMismatchError("NRT3291", `'${name}' must be one finite number.`);
  }
  const result =
    value.type === "character" ? Number(value.values[0] ?? "") : (value.values[0] ?? Number.NaN);
  if (!Number.isFinite(result)) {
    throw new RTypeMismatchError("NRT3291", `'${name}' must be one finite number.`);
  }
  return result;
}

async function rampFlag(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3291", `'${name}' must be one non-missing logical value.`);
  }
  return value.values[0] === 1;
}

async function rampChoice<T extends string>(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  choices: readonly T[],
  fallback: T,
): Promise<T> {
  if (argument === undefined) return fallback;
  const value = await invocation.force(argument.promise);
  if (value.type !== "character" || value.length < 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3291", `'arg' must be a non-missing character value.`);
  }
  const input = value.values[0] ?? "";
  const matches = choices.filter((choice) => choice.startsWith(input));
  if (matches.length !== 1) {
    throw new RTypeMismatchError(
      "NRT3291",
      `'arg' should be one of ${choices.map((choice) => `"${choice}"`).join(", ")}.`,
    );
  }
  return matches[0]!;
}

function interpolateRamp(
  point: number,
  positions: readonly number[],
  coordinates: readonly (readonly number[])[],
  method: RampInterpolation,
  channelCoordinates?: readonly (readonly number[])[],
  secondDerivatives?: readonly Float64Array[],
): readonly number[] {
  if (coordinates.length === 1) return coordinates[0]!.slice();
  if (method === "spline") {
    return (channelCoordinates ?? []).map((values, channel) =>
      interpolateSpline(point, positions, values, secondDerivatives?.[channel]),
    );
  }
  const left = rampInterval(point, positions);
  const start = positions[left] ?? 0;
  const end = positions[left + 1] ?? 1;
  const fraction = end === start ? 0 : (point - start) / (end - start);
  return coordinates[left]!.map(
    (value, channel) => value + ((coordinates[left + 1]?.[channel] ?? value) - value) * fraction,
  );
}

/**
 * Evaluate the not-a-knot cubic used by GNU R's default FMM spline path.
 * The banded solve is linear in the number of colour anchors and keeps palette creation bounded.
 */
function interpolateSpline(
  point: number,
  positions: readonly number[],
  values: readonly number[],
  preparedSecond?: Float64Array,
): number {
  if (values.length === 2) {
    return interpolateRamp(
      point,
      positions,
      values.map((value) => [value]),
      "linear",
      undefined,
    )[0]!;
  }
  const second = preparedSecond ?? splineSecondDerivatives(positions, values);
  const left = rampInterval(point, positions);
  const start = positions[left] ?? 0;
  const end = positions[left + 1] ?? 1;
  const width = end - start;
  if (width === 0) return values[left] ?? 0;
  const before = (end - point) / width;
  const after = (point - start) / width;
  return (
    before * (values[left] ?? 0) +
    after * (values[left + 1] ?? 0) +
    (((before ** 3 - before) * (second[left] ?? 0) +
      (after ** 3 - after) * (second[left + 1] ?? 0)) *
      width ** 2) /
      6
  );
}

function rampInterval(point: number, positions: readonly number[]): number {
  let low = 0;
  let high = positions.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (point > (positions[middle] ?? 1)) low = middle;
    else high = middle;
  }
  return Math.min(low, positions.length - 2);
}

function splineSecondDerivatives(
  positions: readonly number[],
  values: readonly number[],
): Float64Array {
  const count = values.length;
  const result = new Float64Array(count);
  if (count <= 2) return result;
  if (count === 3) {
    const left = (positions[1] ?? 0) - (positions[0] ?? 0);
    const right = (positions[2] ?? 0) - (positions[1] ?? 0);
    const curvature =
      (2 *
        (((values[2] ?? 0) - (values[1] ?? 0)) / right -
          ((values[1] ?? 0) - (values[0] ?? 0)) / left)) /
      (left + right);
    result.fill(curvature);
    return result;
  }

  const lower2 = new Float64Array(count);
  const lower1 = new Float64Array(count);
  const diagonal = new Float64Array(count);
  const upper1 = new Float64Array(count);
  const upper2 = new Float64Array(count);
  const right = new Float64Array(count);
  const first = (positions[1] ?? 0) - (positions[0] ?? 0);
  const second = (positions[2] ?? 0) - (positions[1] ?? 0);
  diagonal[0] = -second;
  upper1[0] = first + second;
  upper2[0] = -first;
  for (let index = 1; index < count - 1; index += 1) {
    const before = (positions[index] ?? 0) - (positions[index - 1] ?? 0);
    const after = (positions[index + 1] ?? 0) - (positions[index] ?? 0);
    lower1[index] = before;
    diagonal[index] = 2 * (before + after);
    upper1[index] = after;
    right[index] =
      6 *
      (((values[index + 1] ?? 0) - (values[index] ?? 0)) / after -
        ((values[index] ?? 0) - (values[index - 1] ?? 0)) / before);
  }
  const penultimate = (positions[count - 2] ?? 0) - (positions[count - 3] ?? 0);
  const last = (positions[count - 1] ?? 0) - (positions[count - 2] ?? 0);
  lower2[count - 1] = -last;
  lower1[count - 1] = penultimate + last;
  diagonal[count - 1] = -penultimate;

  for (let pivot = 0; pivot < count; pivot += 1) {
    if (pivot + 1 < count) {
      const factor = lower1[pivot + 1]! / diagonal[pivot]!;
      lower1[pivot + 1] = 0;
      diagonal[pivot + 1] = diagonal[pivot + 1]! - factor * upper1[pivot]!;
      upper1[pivot + 1] = upper1[pivot + 1]! - factor * upper2[pivot]!;
      right[pivot + 1] = right[pivot + 1]! - factor * right[pivot]!;
    }
    if (pivot + 2 < count) {
      const factor = lower2[pivot + 2]! / diagonal[pivot]!;
      lower2[pivot + 2] = 0;
      lower1[pivot + 2] = lower1[pivot + 2]! - factor * upper1[pivot]!;
      diagonal[pivot + 2] = diagonal[pivot + 2]! - factor * upper2[pivot]!;
      right[pivot + 2] = right[pivot + 2]! - factor * right[pivot]!;
    }
  }
  for (let index = count - 1; index >= 0; index -= 1) {
    result[index] =
      (right[index]! -
        upper1[index]! * (result[index + 1] ?? 0) -
        upper2[index]! * (result[index + 2] ?? 0)) /
      diagonal[index]!;
  }
  return result;
}

function srgbToLab(rgb: Triple): Triple {
  return xyzToLab(srgbToXyz(rgb));
}

function srgbToXyz(rgb: Triple): Triple {
  return multiplyMatrix(
    SRGB_TO_XYZ,
    rgb.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    ) as unknown as Triple,
  );
}

function xyzToLab(xyz: Triple): Triple {
  const scaled = xyz.map((value, index) => labForward(value / D65[index]!)) as unknown as Triple;
  return [116 * scaled[1] - 16, 500 * (scaled[0] - scaled[1]), 200 * (scaled[1] - scaled[2])];
}

function labToSrgb(lab: Triple): Triple {
  return xyzToSrgb(labToXyz(lab), true).map(
    (channel) => Math.round(channel * 100_000) / 100_000,
  ) as unknown as Triple;
}

function labToXyz(lab: Triple): Triple {
  const y = (lab[0] + 16) / 116;
  return [
    D65[0] * labInverse(y + lab[1] / 500),
    D65[1] * labInverse(y),
    D65[2] * labInverse(y - lab[2] / 200),
  ];
}

function xyzToSrgb(xyz: Triple, clip: boolean): Triple {
  return multiplyMatrix(XYZ_TO_SRGB, xyz).map((channel) => {
    const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    return clip ? Math.max(0, Math.min(1, encoded)) : encoded;
  }) as unknown as Triple;
}

function labForward(value: number): number {
  return value > 216 / 24_389 ? Math.cbrt(value) : ((24_389 / 27) * value + 16) / 116;
}

function labInverse(value: number): number {
  return value ** 3 > 216 / 24_389 ? value ** 3 : (116 * value - 16) / (24_389 / 27);
}

function multiplyMatrix(matrix: readonly Triple[], value: Triple): Triple {
  return matrix.map(
    (row) => row[0] * value[0] + row[1] * value[1] + row[2] * value[2],
  ) as unknown as Triple;
}

function formatRampColour(channels: readonly number[], alpha: boolean): string {
  return `#${channels
    .slice(0, alpha ? 4 : 3)
    .map((channel) =>
      Math.max(0, Math.min(255, Math.floor(channel)))
        .toString(16)
        .padStart(2, "0")
        .toUpperCase(),
    )
    .join("")}`;
}
