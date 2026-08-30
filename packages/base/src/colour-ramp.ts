import type { SourceSpan } from "@nativr/ast";
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
  withClasses,
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
import { evaluateCubicSpline, fmmSecondDerivatives } from "./cubic-spline.js";

const COLOUR_SYNTHETIC_SPAN: SourceSpan = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});
const COLOUR_CONVERTER_ARGUMENTS = ["color", "white"] as const;
const COLOUR_CONVERTER_FORMALS = COLOUR_CONVERTER_ARGUMENTS.map((name) => ({
  name,
  span: COLOUR_SYNTHETIC_SPAN,
}));

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

export const COLOR_CONVERTER_BUILTIN_SPEC = {
  name: "colorConverter",
  parameters: ["toXYZ", "fromXYZ", "name", "white", "vectorized"],
  compatibility: "behavioral",
  implementation: builtinColorConverter,
} as const;

export const RGB_TO_HSV_BUILTIN_SPEC = {
  name: "rgb2hsv",
  parameters: ["r", "g", "b", "maxColorValue"],
  compatibility: "behavioral",
  implementation: builtinRgbToHsv,
} as const;

export const COLOUR_SPACE_BINDINGS = Object.freeze([
  {
    package: "grDevices",
    name: "colorspaces",
    value: colourSpacesValue(),
    compatibility: "behavioral" as const,
  },
]);

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
type ConversionTarget =
  | { readonly kind: "builtin"; readonly space: ConversionSpace }
  | {
      readonly kind: "custom";
      readonly name: string;
      readonly toXYZ: RValue;
      readonly fromXYZ: RValue;
      readonly referenceWhite: RValue;
    };

async function builtinColorConverter(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, COLOR_CONVERTER_BUILTIN_SPEC.parameters);
  const required = async (name: "toXYZ" | "fromXYZ" | "name") => {
    const argument = matched.get(name);
    if (argument === undefined || argument.promise.missing) {
      throw new REvaluationError("NRE2144", `argument "${name}" is missing, with no default`);
    }
    return invocation.force(argument.promise);
  };
  const toXYZ = await required("toXYZ");
  const fromXYZ = await required("fromXYZ");
  const name = await required("name");
  const whiteArgument = matched.get("white");
  const white =
    whiteArgument === undefined ? R_NULL : await invocation.force(whiteArgument.promise);
  const vectorized = await rampFlag(invocation, matched.get("vectorized"), false, "vectorized");
  return withClasses(
    listValue(
      [
        converterFunction(toXYZ, vectorized, "toXYZ"),
        converterFunction(fromXYZ, vectorized, "fromXYZ"),
        name,
        white,
        white,
      ],
      ["toXYZ", "fromXYZ", "name", "white", "reference.white"],
    ),
    ["colorConverter"],
  );
}

function converterFunction(
  callable: RValue,
  vectorized: boolean,
  direction: "toXYZ" | "fromXYZ",
): RBuiltin {
  return colourConverterFunction(`colorConverter.${direction}`, "behavioral", async (call) => {
    const { matched } = matchBuiltinArguments(call, COLOUR_CONVERTER_ARGUMENTS);
    const colorArgument = matched.get("color");
    const whiteArgument = matched.get("white");
    if (colorArgument === undefined || colorArgument.promise.missing) {
      throw new REvaluationError("NRE2144", 'argument "color" is missing, with no default');
    }
    if (whiteArgument === undefined || whiteArgument.promise.missing) {
      throw new REvaluationError("NRE2144", 'argument "white" is missing, with no default');
    }
    const color = await call.force(colorArgument.promise);
    const white = await call.force(whiteArgument.promise);
    if (vectorized) return call.invoke(callable, [{ value: color }, { value: white }]);
    return invokeConverterByRow(call, callable, color, white);
  });
}

function colourConverterFunction(
  name: string,
  compatibilityLevel: "api" | "numeric" | "behavioral",
  implementation: RBuiltin["definition"]["implementation"],
): RBuiltin {
  return {
    type: "builtin",
    definition: {
      package: "grDevices",
      name,
      kind: "regular",
      formals: COLOUR_CONVERTER_FORMALS,
      metadata: {
        compatibilityLevel,
        supportedArguments: COLOUR_CONVERTER_ARGUMENTS,
      },
      implementation,
    },
  };
}

async function builtinRgbToHsv(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, RGB_TO_HSV_BUILTIN_SPEC.parameters);
  const rArgument = matched.get("r");
  if (rArgument === undefined || rArgument.promise.missing) {
    throw new REvaluationError("NRE2144", 'argument "r" is missing, with no default');
  }
  const r = await invocation.force(rArgument.promise);
  const gArgument = matched.get("g");
  const bArgument = matched.get("b");
  const g = gArgument === undefined ? R_NULL : await invocation.force(gArgument.promise);
  const b = bArgument === undefined ? R_NULL : await invocation.force(bArgument.promise);
  const maximum = await rampNumber(invocation, matched.get("maxColorValue"), 255, "maxColorValue");
  if (!(maximum > 0)) {
    throw new RTypeMismatchError("NRT3292", "maxColorValue must be positive");
  }

  let red: number[];
  let green: number[];
  let blue: number[];
  let columnNames: RValue = R_NULL;
  if (g.type === "null" && b.type === "null") {
    if (r.type !== "logical" && r.type !== "integer" && r.type !== "double") {
      throw new RTypeMismatchError("NRT3292", "rgb matrix must have 3 rows");
    }
    const dimensions = r.attributes.get("dim");
    if (dimensions?.type !== "integer" || dimensions.length !== 2 || dimensions.values[0] !== 3) {
      throw new RTypeMismatchError("NRT3292", "rgb matrix must have 3 rows");
    }
    const columns = dimensions.values[1] ?? 0;
    red = Array.from({ length: columns }, (_, column) => numericColourEntry(r, column * 3));
    green = Array.from({ length: columns }, (_, column) => numericColourEntry(r, column * 3 + 1));
    blue = Array.from({ length: columns }, (_, column) => numericColourEntry(r, column * 3 + 2));
    const dimnames = r.attributes.get("dimnames");
    if (dimnames?.type === "list") columnNames = dimnames.values[1] ?? R_NULL;
  } else {
    if (g.type === "null" || b.type === "null") {
      throw new RTypeMismatchError("NRT3292", "arguments 'g' and 'b' must be supplied together");
    }
    if (!isNumericColourVector(r) || !isNumericColourVector(g) || !isNumericColourVector(b)) {
      throw new RTypeMismatchError("NRT3292", "rgb values must be numeric");
    }
    const vectors = [r, g, b];
    const length = Math.max(...vectors.map((value) => value.length));
    red = Array.from({ length }, (_, index) => numericColourEntry(r, index % r.length));
    green = Array.from({ length }, (_, index) => numericColourEntry(g, index % g.length));
    blue = Array.from({ length }, (_, index) => numericColourEntry(b, index % b.length));
  }
  const columns = red.length;
  const values = new Float64Array(columns * 3);
  for (let column = 0; column < columns; column += 1) {
    const channels = [red[column]!, green[column]!, blue[column]!];
    if (channels.some((value) => !Number.isFinite(value) || value < 0 || value > maximum)) {
      throw new RTypeMismatchError("NRT3292", "rgb values must be in [0, maxColorValue]");
    }
    const high = Math.max(...channels);
    const low = Math.min(...channels);
    const delta = high - low;
    let hue = 0;
    if (delta !== 0) {
      if (high === channels[0]) hue = ((channels[1]! - channels[2]!) / delta) % 6;
      else if (high === channels[1]) hue = (channels[2]! - channels[0]!) / delta + 2;
      else hue = (channels[0]! - channels[1]!) / delta + 4;
      hue = (((hue / 6) % 1) + 1) % 1;
    }
    values[column * 3] = hue;
    values[column * 3 + 1] = high === 0 ? 0 : delta / high;
    values[column * 3 + 2] = high / maximum;
  }
  let output = withDimensions(doubleVector(values), [3, columns]);
  output = withAttribute(
    output,
    "dimnames",
    listValue([characterVector(["h", "s", "v"]), columnNames]),
  );
  return output;
}

function isNumericColourVector(
  value: RValue,
): value is Extract<RValue, { type: "logical" | "integer" | "double" }> {
  return value.type === "logical" || value.type === "integer" || value.type === "double";
}

function numericColourEntry(value: RValue, index: number): number {
  if (
    (value.type !== "logical" && value.type !== "integer" && value.type !== "double") ||
    value.length === 0 ||
    isMissing(value, index)
  ) {
    return Number.NaN;
  }
  return value.values[index] ?? Number.NaN;
}

async function invokeConverterByRow(
  invocation: BuiltinInvocation,
  callable: RValue,
  color: RValue,
  white: RValue,
): Promise<RValue> {
  if (color.type !== "logical" && color.type !== "integer" && color.type !== "double") {
    throw new RTypeMismatchError("NRT3292", "color converter input must be a numeric matrix.");
  }
  const dimensions = color.attributes.get("dim");
  if (dimensions?.type !== "integer" || dimensions.length < 1) {
    throw new REvaluationError("NRE2144", "dim(X) must have a positive length");
  }
  const rows = dimensions.values[0] ?? 0;
  const columns = dimensions.length === 1 ? 1 : (dimensions.values[1] ?? 0);
  if (dimensions.length !== 2 || rows * columns !== color.length) {
    throw new RTypeMismatchError("NRT3292", "color converter input must be a numeric matrix.");
  }
  if (rows === 0) return withDimensions(doubleVector([]), [0, 0]);

  type ConverterNumeric = Extract<RValue, { type: "logical" | "integer" | "double" }>;
  const rowResults: ConverterNumeric[] = [];
  for (let row = 0; row < rows; row += 1) {
    invocation.context.checkpoint();
    const values = new Float64Array(columns);
    const missing = new Uint8Array(columns);
    for (let column = 0; column < columns; column += 1) {
      const source = row + column * rows;
      if (isMissing(color, source)) missing[column] = 1;
      else values[column] = color.values[source] ?? Number.NaN;
    }
    const result = await invocation.invoke(callable, [
      { value: doubleVector(values, missing.some((entry) => entry === 1) ? missing : undefined) },
      { value: white },
    ]);
    if (result.type !== "logical" && result.type !== "integer" && result.type !== "double") {
      throw new RTypeMismatchError("NRT3292", "color converter results must be numeric vectors.");
    }
    rowResults.push(result);
  }
  const resultColumns = rowResults[0]?.length ?? 0;
  const values = new Float64Array(rows * resultColumns);
  const missing = new Uint8Array(rows * resultColumns);
  for (let row = 0; row < rows; row += 1) {
    const result = rowResults[row]!;
    if (result.length !== resultColumns) {
      throw new RTypeMismatchError(
        "NRT3292",
        "color converter results must be equal-length numeric vectors.",
      );
    }
    for (let column = 0; column < resultColumns; column += 1) {
      const target = row + column * rows;
      if (isMissing(result, column)) missing[target] = 1;
      else values[target] = result.values[column] ?? Number.NaN;
    }
  }
  let output = withDimensions(
    doubleVector(values, missing.some((entry) => entry === 1) ? missing : undefined),
    [rows, resultColumns],
  );
  const inputDimnames = color.attributes.get("dimnames");
  const rowNames = inputDimnames?.type === "list" ? (inputDimnames.values[0] ?? R_NULL) : R_NULL;
  const firstNames = rowResults[0]?.attributes.get("names") ?? R_NULL;
  if (rowNames.type !== "null" || firstNames.type !== "null") {
    output = withAttribute(output, "dimnames", listValue([rowNames, firstNames]));
  }
  return output;
}

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
  const from = conversionTarget(await invocation.force(requirePromise("from")), "from");
  const to = conversionTarget(await invocation.force(requirePromise("to")), "to");
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
  let current = normalizedConversionMatrix(color, rows, scaleIn);
  current =
    from.kind === "builtin"
      ? applyBuiltinConversion(
          current,
          rows,
          (value) => conversionToXyz(value, from.space),
          () => invocation.context.checkpoint(),
        )
      : await invokeCustomConversion(
          invocation,
          from.toXYZ,
          current,
          from.referenceWhite,
          rows,
          `${from.name}$toXYZ`,
        );
  current =
    to.kind === "builtin"
      ? applyBuiltinConversion(
          current,
          rows,
          (value) => conversionFromXyz(value, to.space, clip),
          () => invocation.context.checkpoint(),
        )
      : await invokeCustomConversion(
          invocation,
          to.fromXYZ,
          current,
          to.referenceWhite,
          rows,
          `${to.name}$fromXYZ`,
        );
  const scaled = Float64Array.from(current.values, (value) => value * scaleOut);
  invocation.context.allocate(scaled.length);
  let output = withDimensions(doubleVector(scaled, current.missing), [rows, 3]);
  if (to.kind === "builtin" && to.space === "Lab") {
    output = withAttribute(
      output,
      "dimnames",
      listValue([R_NULL, characterVector(["L", "a", "b"])]),
    );
  }
  return output;
}

function conversionTarget(value: RValue, name: "from" | "to"): ConversionTarget {
  if (value.type === "list" && hasClass(value, "colorConverter")) {
    const toXYZ = converterMember(value, "toXYZ");
    const fromXYZ = converterMember(value, "fromXYZ");
    const converterName = converterMember(value, "name");
    const referenceWhite = converterMember(value, "reference.white");
    return {
      kind: "custom",
      name:
        converterName.type === "character" &&
        converterName.length > 0 &&
        !isMissing(converterName, 0)
          ? (converterName.values[0] ?? "custom")
          : "custom",
      toXYZ,
      fromXYZ,
      referenceWhite,
    };
  }
  if (value.type !== "character" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3292", `'${name}' must name one colour space.`);
  }
  const input = value.values[0] ?? "";
  if (input === "sRGB" || input === "Lab" || input === "XYZ") {
    return { kind: "builtin", space: input };
  }
  throw new RUnsupportedFeatureError(
    "NRU6149",
    `convertColor() does not support colour space '${input}'.`,
  );
}

function hasClass(value: RValue, className: string): boolean {
  if (!("attributes" in value)) return false;
  const classes = value.attributes.get("class");
  return (
    classes?.type === "character" &&
    classes.values.some((entry, index) => !isMissing(classes, index) && entry === className)
  );
}

function converterMember(value: Extract<RValue, { type: "list" }>, name: string): RValue {
  const names = value.attributes.get("names");
  const index =
    names?.type === "character"
      ? names.values.findIndex((entry, position) => !isMissing(names, position) && entry === name)
      : -1;
  if (index < 0) {
    throw new RTypeMismatchError("NRT3292", `invalid colorConverter object: missing '${name}'.`);
  }
  return value.values[index] ?? R_NULL;
}

function normalizedConversionMatrix(
  color: Extract<RValue, { type: "logical" | "integer" | "double" }>,
  rows: number,
  scaleIn: number,
): { readonly values: Float64Array; readonly missing?: Uint8Array } {
  const values = new Float64Array(rows * 3);
  const missing = new Uint8Array(rows * 3);
  for (let index = 0; index < values.length; index += 1) {
    if (isMissing(color, index)) missing[index] = 1;
    else values[index] = (color.values[index] ?? Number.NaN) / scaleIn;
  }
  return { values, ...(missing.some((entry) => entry === 1) ? { missing } : {}) };
}

function applyBuiltinConversion(
  input: { readonly values: Float64Array; readonly missing?: Uint8Array },
  rows: number,
  convert: (value: Triple) => Triple,
  checkpoint?: () => void,
): { readonly values: Float64Array; readonly missing?: Uint8Array } {
  const values = new Float64Array(rows * 3);
  const missing = input.missing === undefined ? undefined : new Uint8Array(input.missing);
  for (let row = 0; row < rows; row += 1) {
    checkpoint?.();
    const indices = [row, row + rows, row + 2 * rows];
    if (indices.some((index) => input.missing?.[index] === 1)) continue;
    const converted = convert(
      indices.map((index) => input.values[index] ?? Number.NaN) as unknown as Triple,
    );
    for (let column = 0; column < 3; column += 1) values[row + column * rows] = converted[column]!;
  }
  return { values, ...(missing === undefined ? {} : { missing }) };
}

async function invokeCustomConversion(
  invocation: BuiltinInvocation,
  callable: RValue,
  input: { readonly values: Float64Array; readonly missing?: Uint8Array },
  white: RValue,
  rows: number,
  label: string,
): Promise<{ readonly values: Float64Array; readonly missing?: Uint8Array }> {
  const matrix = withDimensions(doubleVector(input.values, input.missing), [rows, 3]);
  const converted = await invocation.invoke(callable, [{ value: matrix }, { value: white }]);
  if (converted.type !== "logical" && converted.type !== "integer" && converted.type !== "double") {
    throw new RTypeMismatchError("NRT3292", `${label} must return a numeric three-column matrix.`);
  }
  const dimensions = converted.attributes.get("dim");
  if (
    dimensions?.type !== "integer" ||
    dimensions.length !== 2 ||
    dimensions.values[0] !== rows ||
    dimensions.values[1] !== 3 ||
    converted.length !== rows * 3
  ) {
    throw new RTypeMismatchError("NRT3292", `${label} must return a numeric three-column matrix.`);
  }
  const values = new Float64Array(converted.length);
  const missing = new Uint8Array(converted.length);
  for (let index = 0; index < converted.length; index += 1) {
    if (isMissing(converted, index)) missing[index] = 1;
    else values[index] = converted.values[index] ?? Number.NaN;
  }
  return { values, ...(missing.some((entry) => entry === 1) ? { missing } : {}) };
}

function conversionToXyz(value: Triple, space: ConversionSpace): Triple {
  if (space === "XYZ") return value;
  return space === "sRGB" ? srgbToXyz(value) : labToXyz(value);
}

function conversionFromXyz(value: Triple, space: ConversionSpace, clip: boolean): Triple {
  if (space === "XYZ") return value;
  return space === "sRGB" ? xyzToSrgb(value, clip) : xyzToLab(value);
}

function colourSpacesValue(): RValue {
  const names = ["XYZ", "Apple RGB", "sRGB", "CIE RGB", "Lab", "Luv"] as const;
  return listValue(
    names.map((name) => {
      if (name === "XYZ") return builtinColourConverter(name, "XYZ", R_NULL);
      if (name === "sRGB") {
        return builtinColourConverter(
          name,
          "sRGB",
          characterVector(["D65"]),
          ["RGBcolorConverter", "colorConverter"],
          characterVector(["sRGB"]),
        );
      }
      if (name === "Lab") return builtinColourConverter(name, "Lab", R_NULL);
      const white = characterVector([name === "CIE RGB" ? "E" : "D65"]);
      const gamma = doubleVector([name === "Apple RGB" ? 1.8 : 2.2]);
      return unavailableColourConverter(name, white, name === "Luv" ? undefined : gamma);
    }),
    names,
  );
}

function builtinColourConverter(
  name: string,
  space: ConversionSpace,
  white: RValue,
  classes: readonly string[] = ["colorConverter"],
  gamma?: RValue,
): RValue {
  const values = [
    builtinColourSpaceFunction(name, space, "toXYZ"),
    builtinColourSpaceFunction(name, space, "fromXYZ"),
    characterVector([name]),
    white,
    white,
    ...(gamma === undefined ? [] : [gamma]),
  ];
  const names = [
    "toXYZ",
    "fromXYZ",
    "name",
    "white",
    "reference.white",
    ...(gamma === undefined ? [] : ["gamma"]),
  ];
  return withClasses(listValue(values, names), classes);
}

function unavailableColourConverter(name: string, white: RValue, gamma?: RValue): RValue {
  const unavailable = (direction: "toXYZ" | "fromXYZ") =>
    colourConverterFunction(`colorspaces.${name}.${direction}`, "api", () => {
      throw new RUnsupportedFeatureError(
        "NRU6149",
        `The ${name} colour-space converter is outside the current numeric contract.`,
      );
    });
  const values = [
    unavailable("toXYZ"),
    unavailable("fromXYZ"),
    characterVector([name]),
    white,
    white,
    ...(gamma === undefined ? [] : [gamma]),
  ];
  const names = [
    "toXYZ",
    "fromXYZ",
    "name",
    "white",
    "reference.white",
    ...(gamma === undefined ? [] : ["gamma"]),
  ];
  return withClasses(
    listValue(values, names),
    gamma === undefined ? ["colorConverter"] : ["RGBcolorConverter", "colorConverter"],
  );
}

function builtinColourSpaceFunction(
  name: string,
  space: ConversionSpace,
  direction: "toXYZ" | "fromXYZ",
): RBuiltin {
  return colourConverterFunction(
    `colorspaces.${name}.${direction}`,
    "numeric",
    async (invocation) => {
      const { matched } = matchBuiltinArguments(invocation, COLOUR_CONVERTER_ARGUMENTS);
      const argument = matched.get("color");
      if (argument === undefined || argument.promise.missing) {
        throw new REvaluationError("NRE2144", 'argument "color" is missing, with no default');
      }
      const color = await invocation.force(argument.promise);
      if (color.type !== "logical" && color.type !== "integer" && color.type !== "double") {
        throw new RTypeMismatchError("NRT3292", "colour converter input must be numeric.");
      }
      const dimensions = color.attributes.get("dim");
      const rows =
        dimensions?.type === "integer" && dimensions.length === 2
          ? (dimensions.values[0] ?? 0)
          : color.length === 3
            ? 1
            : -1;
      if (
        rows < 0 ||
        (dimensions?.type === "integer" && dimensions.values[1] !== 3) ||
        rows * 3 !== color.length
      ) {
        throw new RTypeMismatchError("NRT3292", "colour converter input must have three columns.");
      }
      const normalized = normalizedConversionMatrix(color, rows, 1);
      const converted = applyBuiltinConversion(
        normalized,
        rows,
        direction === "toXYZ"
          ? (value) => conversionToXyz(value, space)
          : (value) => conversionFromXyz(value, space, false),
      );
      let output = withDimensions(doubleVector(converted.values, converted.missing), [rows, 3]);
      const columnNames =
        direction === "toXYZ"
          ? ["X", "Y", "Z"]
          : space === "Lab"
            ? ["L", "a", "b"]
            : space === "sRGB"
              ? ["R", "G", "B"]
              : ["X", "Y", "Z"];
      output = withAttribute(output, "dimnames", listValue([R_NULL, characterVector(columnNames)]));
      return output;
    },
  );
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
        compatibilityLevel: "numeric",
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
        compatibilityLevel: "numeric",
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
      ? channelCoordinates.map((values) => fmmSecondDerivatives(positions, values))
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
      evaluateCubicSpline(
        point,
        positions,
        values,
        secondDerivatives?.[channel] ?? fmmSecondDerivatives(positions, values),
      ),
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
