import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  characterVector,
  isMissing,
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
  readonly name: "colorRampPalette";
  readonly parameters: readonly ["colors", "..."];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

export const COLOUR_RAMP_BUILTIN_SPECS: readonly ColourRampBuiltinSpec[] = [
  {
    name: "colorRampPalette",
    parameters: ["colors", "..."],
    compatibility: "numeric",
    implementation: builtinColorRampPalette,
  },
];

type Rgba = readonly [number, number, number, number];
type Triple = readonly [number, number, number];

const RAMP_ARGUMENTS = ["colors", "bias", "space", "interpolate", "alpha"] as const;
// Measured through the documented convertColor() boundary. R is used only as a black-box oracle.
const SRGB_TO_XYZ: readonly Triple[] = [
  [0.4168213, 0.3565767, 0.1798077],
  [0.2149235, 0.7131534, 0.0719231],
  [0.0195385, 0.1188589, 0.946987],
];
const XYZ_TO_SRGB: readonly Triple[] = [
  [3.2065205, -1.5210418, -0.4933108],
  [-0.9719825, 1.8812687, 0.0416725],
  [0.0558383, -0.2047406, 1.0609284],
];
const D65 = SRGB_TO_XYZ.map((row) => row[0] + row[1] + row[2]) as unknown as Triple;

async function builtinColorRampPalette(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, RAMP_ARGUMENTS);
  const colorsArgument = matched.get("colors");
  if (colorsArgument === undefined || colorsArgument.promise.missing) {
    throw new REvaluationError("NRE2144", "Argument 'colors' is missing in colorRampPalette().");
  }
  const colors = rampColors(await invocation.force(colorsArgument.promise));
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
  if (interpolate === "spline") {
    throw new RUnsupportedFeatureError(
      "NRU6147",
      "colorRampPalette() currently supports linear interpolation.",
    );
  }
  const coordinates: readonly (readonly number[])[] =
    space === "Lab"
      ? colors.map((color) => srgbToLab([color[0] / 255, color[1] / 255, color[2] / 255]))
      : colors;
  const positions =
    colors.length === 1
      ? [0]
      : colors.map((_color, index) => (index / (colors.length - 1)) ** bias);

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
            const interpolated = interpolateRamp(point, positions, coordinates);
            const rgba =
              space === "Lab"
                ? [...labToSrgb(interpolated as Triple).map((channel) => channel * 255), 255]
                : interpolated;
            return formatRampColour(rgba, alpha);
          }),
        );
      },
    },
  };
  invocation.context.allocate(1);
  return palette;
}

function rampColors(value: RValue): readonly Rgba[] {
  if (value.type !== "character") {
    throw new RTypeMismatchError(
      "NRT3291",
      "colorRampPalette(colors=) requires a character vector.",
    );
  }
  if (value.length === 0) {
    throw new RTypeMismatchError("NRT3291", "need at least two non-NA values to interpolate.");
  }
  return Array.from({ length: value.length }, (_, index) =>
    isMissing(value, index) ? ([255, 255, 255, 255] as const) : parseRampColour(value, index),
  );
}

function parseRampColour(value: RCharacterVector, index: number): Rgba {
  const input = value.values[index] ?? "";
  const colour = parseRColour(input);
  if (colour === undefined) {
    throw new RUnsupportedFeatureError(
      "NRU6148",
      `colorRampPalette() does not yet recognize color '${input}'.`,
    );
  }
  return colour;
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
): readonly number[] {
  if (coordinates.length === 1) return coordinates[0]!.slice();
  let left = 0;
  while (left + 1 < positions.length - 1 && point > (positions[left + 1] ?? 1)) left += 1;
  const start = positions[left] ?? 0;
  const end = positions[left + 1] ?? 1;
  const fraction = end === start ? 0 : (point - start) / (end - start);
  return coordinates[left]!.map(
    (value, channel) => value + ((coordinates[left + 1]?.[channel] ?? value) - value) * fraction,
  );
}

function srgbToLab(rgb: Triple): Triple {
  const xyz = multiplyMatrix(
    SRGB_TO_XYZ,
    rgb.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    ) as unknown as Triple,
  );
  const scaled = xyz.map((value, index) => labForward(value / D65[index]!)) as unknown as Triple;
  return [116 * scaled[1] - 16, 500 * (scaled[0] - scaled[1]), 200 * (scaled[1] - scaled[2])];
}

function labToSrgb(lab: Triple): Triple {
  const y = (lab[0] + 16) / 116;
  const xyz: Triple = [
    D65[0] * labInverse(y + lab[1] / 500),
    D65[1] * labInverse(y),
    D65[2] * labInverse(y - lab[2] / 200),
  ];
  return multiplyMatrix(XYZ_TO_SRGB, xyz).map((channel) => {
    const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, encoded)) * 100_000) / 100_000;
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
