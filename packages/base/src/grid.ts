import {
  REvaluationError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  R_NULL,
  characterVector,
  deparseSourceAst,
  doubleVector,
  integerVector,
  isMissing,
  listValue,
  logicalVector,
  objectAttributes,
  objectClasses,
  vectorNames,
  withAttribute,
  withClasses,
} from "@nativr/runtime";
import type { AstNode } from "@nativr/ast";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RDoubleVector,
  RList,
  RValue,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});
const GRID_STATE_KEY = "base.grid.state";
let openGridGraphicsDevice: ((invocation: BuiltinInvocation) => void) | undefined;

export function configureGridGraphicsDeviceOpener(
  opener: (invocation: BuiltinInvocation) => void,
): void {
  openGridGraphicsDevice = opener;
}
const UNIT_CODES = new Map<string, number>([
  ["npc", 0],
  ["cm", 1],
  ["inches", 2],
  ["inch", 2],
  ["in", 2],
  ["lines", 3],
  ["native", 4],
  ["null", 5],
  ["mm", 7],
  ["points", 8],
  ["point", 8],
  ["char", 18],
]);
const UNIT_NAMES = new Map<number, string>([
  [0, "npc"],
  [1, "cm"],
  [2, "inches"],
  [3, "lines"],
  [4, "native"],
  [5, "null"],
  [7, "mm"],
  [8, "points"],
  [18, "char"],
  [21, "grobwidth"],
  [22, "grobheight"],
]);

interface GridState {
  readonly viewports: RList[];
  readonly viewportPaths: RList[][];
  grobCounter: number;
}

interface GridBuiltinSpec {
  readonly name:
    | "unit"
    | "gpar"
    | "get.gpar"
    | "viewport"
    | "pushViewport"
    | "popViewport"
    | "upViewport"
    | "downViewport"
    | "current.viewport"
    | "current.transform"
    | "vpPath"
    | "grid.newpage"
    | "makeContent"
    | "makeContent.default"
    | "makeContext"
    | "makeContext.default"
    | "gList"
    | "grid.draw"
    | "rectGrob"
    | "grid.rect"
    | "polygonGrob"
    | "grid.polygon"
    | "segmentsGrob"
    | "grid.segments"
    | "linesGrob"
    | "grid.lines"
    | "pointsGrob"
    | "grid.points"
    | "textGrob"
    | "grobWidth"
    | "grobHeight"
    | "convertWidth"
    | "convertHeight"
    | "grid.text";
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral" | "shape";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue> | RValue;
  readonly formals: NonNullable<BuiltinDefinition["formals"]>;
  readonly visibility?: "visible" | "invisible";
}

const unitCall = (value: number, units: string): AstNode =>
  call("unit", [double(value), string(units)]);
const unitCallVector = (values: readonly number[], units: string): AstNode =>
  call("unit", [call("c", values.map(double)), string(units)]);
const gparCall = (): AstNode => call("gpar", []);

export const GRID_BUILTIN_SPECS: readonly GridBuiltinSpec[] = Object.freeze([
  spec("unit", ["x", "units", "data"], "behavioral", builtinUnit, [
    formal("x"),
    formal("units"),
    formal("data", nil()),
  ]),
  spec("gpar", ["..."], "behavioral", builtinGpar, [formal("...")]),
  spec("get.gpar", ["names"], "behavioral", builtinGetGpar, [formal("names", nil())]),
  spec(
    "viewport",
    [
      "x",
      "y",
      "width",
      "height",
      "default.units",
      "just",
      "gp",
      "clip",
      "mask",
      "xscale",
      "yscale",
      "angle",
      "layout",
      "layout.pos.row",
      "layout.pos.col",
      "name",
    ],
    "behavioral",
    builtinViewport,
    [
      formal("x", unitCall(0.5, "npc")),
      formal("y", unitCall(0.5, "npc")),
      formal("width", unitCall(1, "npc")),
      formal("height", unitCall(1, "npc")),
      formal("default.units", string("npc")),
      formal("just", string("centre")),
      formal("gp", gparCall()),
      formal("clip", string("inherit")),
      formal("mask", string("inherit")),
      formal("xscale", call("c", [double(0), double(1)])),
      formal("yscale", call("c", [double(0), double(1)])),
      formal("angle", double(0)),
      formal("layout", nil()),
      formal("layout.pos.row", nil()),
      formal("layout.pos.col", nil()),
      formal("name", nil()),
    ],
  ),
  spec(
    "pushViewport",
    ["...", "recording"],
    "behavioral",
    builtinPushViewport,
    [formal("..."), formal("recording", logical(true))],
    "invisible",
  ),
  spec(
    "popViewport",
    ["n", "recording"],
    "behavioral",
    builtinPopViewport,
    [formal("n", double(1)), formal("recording", logical(true))],
    "invisible",
  ),
  spec(
    "upViewport",
    ["n", "recording"],
    "behavioral",
    builtinUpViewport,
    [formal("n", double(1)), formal("recording", logical(true))],
    "invisible",
  ),
  spec(
    "downViewport",
    ["name", "strict", "recording"],
    "behavioral",
    builtinDownViewport,
    [formal("name"), formal("strict", logical(false)), formal("recording", logical(true))],
    "invisible",
  ),
  spec("current.viewport", [], "behavioral", builtinCurrentViewport, []),
  spec("current.transform", [], "behavioral", builtinCurrentTransform, []),
  spec("vpPath", ["..."], "behavioral", builtinViewportPath, [formal("...")]),
  spec(
    "grid.newpage",
    ["recording", "clearGroups"],
    "behavioral",
    builtinGridNewPage,
    [formal("recording", logical(true)), formal("clearGroups", logical(true))],
    "invisible",
  ),
  spec(
    "makeContent",
    ["x"],
    "behavioral",
    (invocation) => builtinGrobLifecycle(invocation, "makeContent", true),
    [formal("x")],
  ),
  spec(
    "makeContent.default",
    ["x"],
    "behavioral",
    (invocation) => builtinGrobLifecycle(invocation, "makeContent", false),
    [formal("x")],
  ),
  spec(
    "makeContext",
    ["x"],
    "behavioral",
    (invocation) => builtinGrobLifecycle(invocation, "makeContext", true),
    [formal("x")],
  ),
  spec(
    "makeContext.default",
    ["x"],
    "behavioral",
    (invocation) => builtinGrobLifecycle(invocation, "makeContext", false),
    [formal("x")],
  ),
  spec("gList", ["..."], "behavioral", builtinGList, [formal("...")]),
  spec(
    "grid.draw",
    ["x", "recording"],
    "behavioral",
    builtinGridDraw,
    [formal("x"), formal("recording", logical(true))],
    "invisible",
  ),
  spec("rectGrob", rectParameters(false), "behavioral", builtinRectGrob, rectFormals(false)),
  spec(
    "grid.rect",
    rectParameters(true),
    "behavioral",
    builtinGridRect,
    rectFormals(true),
    "invisible",
  ),
  spec(
    "polygonGrob",
    polygonParameters(false),
    "behavioral",
    builtinPolygonGrob,
    polygonFormals(false),
  ),
  spec(
    "grid.polygon",
    polygonParameters(true),
    "behavioral",
    builtinGridPolygon,
    polygonFormals(true),
    "invisible",
  ),
  spec(
    "segmentsGrob",
    segmentParameters(false),
    "behavioral",
    builtinSegmentsGrob,
    segmentFormals(false),
  ),
  spec(
    "grid.segments",
    segmentParameters(true),
    "behavioral",
    builtinGridSegments,
    segmentFormals(true),
    "invisible",
  ),
  spec("linesGrob", lineParameters(false), "behavioral", builtinLinesGrob, lineFormals(false)),
  spec(
    "grid.lines",
    lineParameters(true),
    "behavioral",
    builtinGridLines,
    lineFormals(true),
    "invisible",
  ),
  spec("pointsGrob", pointParameters(false), "behavioral", builtinPointsGrob, pointFormals(false)),
  spec(
    "grid.points",
    pointParameters(true),
    "behavioral",
    builtinGridPoints,
    pointFormals(true),
    "invisible",
  ),
  spec("textGrob", textParameters(false), "behavioral", builtinTextGrob, textFormals(false)),
  spec("grobWidth", ["x"], "behavioral", (invocation) => builtinGrobExtent(invocation, 21), [
    formal("x"),
  ]),
  spec("grobHeight", ["x"], "behavioral", (invocation) => builtinGrobExtent(invocation, 22), [
    formal("x"),
  ]),
  spec(
    "convertWidth",
    ["x", "unitTo", "valueOnly"],
    "numeric",
    (invocation) => builtinConvertUnit(invocation, "width"),
    [formal("x"), formal("unitTo"), formal("valueOnly", logical(false))],
  ),
  spec(
    "convertHeight",
    ["x", "unitTo", "valueOnly"],
    "numeric",
    (invocation) => builtinConvertUnit(invocation, "height"),
    [formal("x"), formal("unitTo"), formal("valueOnly", logical(false))],
  ),
  spec(
    "grid.text",
    textParameters(true),
    "behavioral",
    builtinGridText,
    textFormals(true),
    "invisible",
  ),
]);

function spec(
  name: GridBuiltinSpec["name"],
  parameters: readonly string[],
  compatibility: GridBuiltinSpec["compatibility"] | "numeric",
  implementation: GridBuiltinSpec["implementation"],
  formals: NonNullable<BuiltinDefinition["formals"]>,
  visibility?: "visible" | "invisible",
): GridBuiltinSpec {
  return {
    name,
    parameters,
    compatibility: compatibility === "numeric" ? "behavioral" : compatibility,
    implementation,
    formals,
    ...(visibility === undefined ? {} : { visibility }),
  };
}

function textParameters(draw: boolean): readonly string[] {
  return [
    "label",
    "x",
    "y",
    "just",
    "hjust",
    "vjust",
    "rot",
    "check.overlap",
    "default.units",
    "name",
    "gp",
    ...(draw ? ["draw"] : []),
    "vp",
  ];
}

function polygonParameters(draw: boolean): readonly string[] {
  return [
    "x",
    "y",
    "id",
    "id.lengths",
    "default.units",
    "name",
    "gp",
    ...(draw ? ["draw"] : []),
    "vp",
  ];
}

function rectParameters(draw: boolean): readonly string[] {
  return [
    "x",
    "y",
    "width",
    "height",
    "just",
    "hjust",
    "vjust",
    "default.units",
    "name",
    "gp",
    ...(draw ? ["draw"] : []),
    "vp",
  ];
}

function rectFormals(draw: boolean): NonNullable<BuiltinDefinition["formals"]> {
  return [
    formal("x", unitCall(0.5, "npc")),
    formal("y", unitCall(0.5, "npc")),
    formal("width", unitCall(1, "npc")),
    formal("height", unitCall(1, "npc")),
    formal("just", string("centre")),
    formal("hjust", nil()),
    formal("vjust", nil()),
    formal("default.units", string("npc")),
    formal("name", nil()),
    formal("gp", gparCall()),
    ...(draw ? [formal("draw", logical(true))] : []),
    formal("vp", nil()),
  ];
}

function polygonFormals(draw: boolean): NonNullable<BuiltinDefinition["formals"]> {
  return [
    formal("x", unitCallVector([0, 0.5, 1, 0.5], "npc")),
    formal("y", unitCallVector([0.5, 1, 0.5, 0], "npc")),
    formal("id", nil()),
    formal("id.lengths", nil()),
    formal("default.units", string("npc")),
    formal("name", nil()),
    formal("gp", gparCall()),
    ...(draw ? [formal("draw", logical(true))] : []),
    formal("vp", nil()),
  ];
}

function segmentParameters(draw: boolean): readonly string[] {
  return [
    "x0",
    "y0",
    "x1",
    "y1",
    "default.units",
    "arrow",
    "name",
    "gp",
    ...(draw ? ["draw"] : []),
    "vp",
  ];
}

function segmentFormals(draw: boolean): NonNullable<BuiltinDefinition["formals"]> {
  return [
    formal("x0", unitCall(0, "npc")),
    formal("y0", unitCall(0, "npc")),
    formal("x1", unitCall(1, "npc")),
    formal("y1", unitCall(1, "npc")),
    formal("default.units", string("npc")),
    formal("arrow", nil()),
    formal("name", nil()),
    formal("gp", gparCall()),
    ...(draw ? [formal("draw", logical(true))] : []),
    formal("vp", nil()),
  ];
}

function lineParameters(draw: boolean): readonly string[] {
  return ["x", "y", "default.units", "arrow", "name", "gp", ...(draw ? ["draw"] : []), "vp"];
}

function lineFormals(draw: boolean): NonNullable<BuiltinDefinition["formals"]> {
  return [
    formal("x", unitCallVector([0, 1], "npc")),
    formal("y", unitCallVector([0, 1], "npc")),
    formal("default.units", string("npc")),
    formal("arrow", nil()),
    formal("name", nil()),
    formal("gp", gparCall()),
    ...(draw ? [formal("draw", logical(true))] : []),
    formal("vp", nil()),
  ];
}

function pointParameters(draw: boolean): readonly string[] {
  return ["x", "y", "pch", "size", "default.units", "name", "gp", ...(draw ? ["draw"] : []), "vp"];
}

function pointFormals(draw: boolean): NonNullable<BuiltinDefinition["formals"]> {
  return [
    formal("x", unitCall(0.5, "npc")),
    formal("y", unitCall(0.5, "npc")),
    formal("pch", double(1)),
    formal("size", unitCall(1, "char")),
    formal("default.units", string("npc")),
    formal("name", nil()),
    formal("gp", gparCall()),
    ...(draw ? [formal("draw", logical(true))] : []),
    formal("vp", nil()),
  ];
}

function textFormals(draw: boolean): NonNullable<BuiltinDefinition["formals"]> {
  return [
    formal("label"),
    formal("x", unitCall(0.5, "npc")),
    formal("y", unitCall(0.5, "npc")),
    formal("just", string("centre")),
    formal("hjust", nil()),
    formal("vjust", nil()),
    formal("rot", double(0)),
    formal("check.overlap", logical(false)),
    formal("default.units", string("npc")),
    formal("name", nil()),
    formal("gp", gparCall()),
    ...(draw ? [formal("draw", logical(true))] : []),
    formal("vp", nil()),
  ];
}

async function builtinUnit(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "units", "data"]);
  const input = await required(invocation, matched.get("x"), "x", "unit");
  const unitInput = await required(invocation, matched.get("units"), "units", "unit");
  const values = numericValues(input, "unit(x=)");
  const units = characterValues(unitInput, "unit(units=)");
  if (units.length === 0 && values.length > 0) {
    throw new RTypeMismatchError("NRT3380", "'units' must be of length > 0");
  }
  const data = matched.get("data");
  if (data !== undefined && !data.promise.missing) {
    const value = await invocation.force(data.promise);
    if (value.type !== "null") {
      throw new RUnsupportedFeatureError(
        "NRU6180",
        "grid::unit(data=) is reserved for grob- and string-dependent units in this profile.",
      );
    }
  }
  const codes = values.map((_, index) => unitCode(units[index % units.length] ?? ""));
  if (codes.every((code) => code === codes[0])) return simpleUnit(values, codes[0] ?? 0);
  const elements = values.map((value, index) =>
    listValue([doubleVector([value]), R_NULL, integerVector([codes[index] ?? 0])]),
  );
  return withClasses(listValue(elements), ["unit", "unit_v2"]);
}

async function builtinGpar(invocation: BuiltinInvocation): Promise<RList> {
  const { dots } = matchBuiltinArguments(invocation, ["..."]);
  const values: RValue[] = [];
  const names: string[] = [];
  for (const argument of dots) {
    if (argument.name === undefined || argument.name.length === 0) {
      throw new RTypeMismatchError("NRT3381", "gpar() arguments must be named.");
    }
    if (names.includes(argument.name)) {
      throw new REvaluationError("NRE2102", `Argument '${argument.name}' matched more than once.`);
    }
    names.push(argument.name);
    values.push(await invocation.force(argument.promise));
  }
  return withClasses(listValue(values, names), ["gpar"]);
}

async function builtinGList(invocation: BuiltinInvocation): Promise<RList> {
  const { dots } = matchBuiltinArguments(invocation, ["..."]);
  const values: RValue[] = [];
  const names: string[] = [];
  for (const argument of dots) {
    const value = await invocation.force(argument.promise);
    flattenGListValue(value, argument.name ?? "", values, names);
  }
  return withClasses(listValue(values, names.some((name) => name.length > 0) ? names : undefined), [
    "gList",
  ]);
}

function flattenGListValue(value: RValue, prefix: string, output: RValue[], names: string[]): void {
  if (value.type === "list" && objectClasses(value)?.includes("gList")) {
    const innerNames = vectorNames(value);
    for (let index = 0; index < value.values.length; index += 1) {
      const inner = value.values[index];
      if (inner === undefined) continue;
      const innerName = innerNames?.[index] ?? "";
      const combined =
        prefix.length === 0
          ? innerName
          : innerName.length > 0
            ? `${prefix}.${innerName}`
            : `${prefix}${index + 1}`;
      flattenGListValue(inner, combined, output, names);
    }
    return;
  }
  if (value.type !== "list" || !objectClasses(value)?.includes("grob")) {
    throw new RTypeMismatchError("NRT3383", "only 'grobs' allowed in \"gList\"");
  }
  output.push(value);
  names.push(prefix);
}

async function builtinGridDraw(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "recording"]);
  const object = await required(invocation, matched.get("x"), "x", "grid.draw");
  await optionalLogical(invocation, matched.get("recording"), true, "recording");
  if (object.type === "null") return R_NULL;
  openGridGraphicsDevice?.(invocation);

  const dispatched = await invocation.dispatchS3IfPresent(
    "grid.draw",
    object,
    invocation.arguments,
  );
  if (dispatched !== undefined) return dispatched;

  if (object.type === "list" && objectClasses(object)?.includes("gList")) {
    for (const child of object.values) drawGridObject(invocation, child);
    return R_NULL;
  }
  if (object.type === "list" && objectClasses(object)?.includes("grob")) {
    drawGridObject(invocation, object);
    return R_NULL;
  }
  throw new RTypeMismatchError(
    "NRT3384",
    `no applicable method for 'grid.draw' applied to an object of class ${gridDrawClassLabel(object)}`,
  );
}

function drawGridObject(invocation: BuiltinInvocation, object: RValue): void {
  if (object.type !== "list") {
    throw new RTypeMismatchError("NRT3384", "invalid object in 'gList'");
  }
  const classes = objectClasses(object) ?? [];
  if (classes.includes("gList")) {
    for (const child of object.values) drawGridObject(invocation, child);
    return;
  }
  if (classes.includes("rect")) return drawRectGrob(invocation, object);
  if (classes.includes("polygon")) return drawPolygonGrob(invocation, object);
  if (classes.includes("segments")) return drawSegmentsGrob(invocation, object);
  if (classes.includes("lines")) return drawLinesGrob(invocation, object);
  if (classes.includes("points")) return drawPointsGrob(invocation, object);
  if (classes.includes("text")) return drawTextGrob(invocation, object);
  throw new RUnsupportedFeatureError(
    "NRU6215",
    `grid.draw() does not yet render grob class '${classes[0] ?? "grob"}'.`,
  );
}

function gridDrawClassLabel(value: RValue): string {
  const explicit = objectClasses(value);
  const classes =
    explicit ??
    (value.type === "double"
      ? ["double", "numeric"]
      : value.type === "integer"
        ? ["integer", "numeric"]
        : [value.type]);
  return classes.length === 1
    ? `"${classes[0] ?? value.type}"`
    : `"c(${classes.map((entry) => `'${entry}'`).join(", ")})"`;
}

const gridGparDefault = (name: string, value: RValue): readonly [string, RValue] =>
  Object.freeze([name, value]);
const GRID_GPAR_DEFAULTS: readonly (readonly [string, RValue])[] = Object.freeze([
  gridGparDefault("fill", characterVector(["transparent"])),
  gridGparDefault("col", characterVector(["black"])),
  gridGparDefault("lty", characterVector(["solid"])),
  gridGparDefault("lwd", doubleVector([1])),
  gridGparDefault("cex", doubleVector([1])),
  gridGparDefault("fontsize", doubleVector([12])),
  gridGparDefault("lineheight", doubleVector([1.2])),
  gridGparDefault("font", integerVector([1])),
  gridGparDefault("fontfamily", characterVector([""])),
  gridGparDefault("alpha", doubleVector([1])),
  gridGparDefault("lineend", characterVector(["round"])),
  gridGparDefault("linejoin", characterVector(["round"])),
  gridGparDefault("linemitre", doubleVector([10])),
  gridGparDefault("lex", doubleVector([1])),
]);
const GRID_GPAR_NAMES = new Set(GRID_GPAR_DEFAULTS.map(([name]) => name));
const GRID_GPAR_CUMULATIVE = new Set(["alpha", "cex", "lex"]);

async function builtinGetGpar(invocation: BuiltinInvocation): Promise<RList> {
  const { matched } = matchBuiltinArguments(invocation, ["names"]);
  const namesInput = await optionalValue(invocation, matched.get("names"), R_NULL);
  const requested =
    namesInput.type === "null"
      ? GRID_GPAR_DEFAULTS.map(([name]) => name)
      : characterValues(namesInput, "get.gpar(names=)");
  if (requested.some((name) => !GRID_GPAR_NAMES.has(name))) {
    throw new RTypeMismatchError("NRT3381", "must specify only valid 'gpar' names");
  }

  const resolved = new Map<string, RValue>(GRID_GPAR_DEFAULTS);
  for (const viewport of gridState(invocation).viewports) {
    const gp = listMember(viewport, "gp");
    if (gp.type !== "list") continue;
    const names = vectorNames(gp) ?? [];
    for (let index = 0; index < gp.values.length; index += 1) {
      const name = names[index];
      const value = gp.values[index];
      if (name === undefined || value === undefined || !GRID_GPAR_NAMES.has(name)) continue;
      const parent = resolved.get(name);
      resolved.set(
        name,
        GRID_GPAR_CUMULATIVE.has(name) && parent !== undefined
          ? multiplyGridGpar(parent, value, name)
          : value,
      );
    }
  }
  return withClasses(
    listValue(
      requested.map((name) => resolved.get(name) ?? R_NULL),
      requested,
    ),
    ["gpar"],
  );
}

function multiplyGridGpar(parent: RValue, child: RValue, name: string): RDoubleVector {
  const left = numericValues(parent, `gpar(${name}=)`);
  const right = numericValues(child, `gpar(${name}=)`);
  const length = Math.max(left.length, right.length);
  if (length === 0) return doubleVector([]);
  return doubleVector(
    Array.from(
      { length },
      (_, index) =>
        (left[index % left.length] ?? Number.NaN) * (right[index % right.length] ?? Number.NaN),
    ),
  );
}

async function builtinViewport(invocation: BuiltinInvocation): Promise<RList> {
  const parameters = [
    "x",
    "y",
    "width",
    "height",
    "default.units",
    "just",
    "gp",
    "clip",
    "mask",
    "xscale",
    "yscale",
    "angle",
    "layout",
    "layout.pos.row",
    "layout.pos.col",
    "name",
  ];
  const { matched } = matchBuiltinArguments(invocation, parameters);
  const defaultUnits = await optionalCharacter(invocation, matched.get("default.units"), "npc");
  const x = await coordinateUnit(invocation, matched.get("x"), 0.5, defaultUnits);
  const y = await coordinateUnit(invocation, matched.get("y"), 0.5, defaultUnits);
  const width = await coordinateUnit(invocation, matched.get("width"), 1, defaultUnits);
  const height = await coordinateUnit(invocation, matched.get("height"), 1, defaultUnits);
  const just = await viewportJustification(invocation, matched.get("just"));
  const gp = await optionalGpar(invocation, matched.get("gp"));
  const clipInput = await optionalValue(
    invocation,
    matched.get("clip"),
    characterVector(["inherit"]),
  );
  const clip =
    clipInput.type === "logical"
      ? clipInput
      : logicalVector([characterValues(clipInput, "viewport(clip=)")[0] === "on"]);
  const xscale = await optionalNumeric(invocation, matched.get("xscale"), [0, 1], "xscale");
  const yscale = await optionalNumeric(invocation, matched.get("yscale"), [0, 1], "yscale");
  const angle = await optionalNumeric(invocation, matched.get("angle"), [0], "angle");
  const nameInput = await optionalValue(invocation, matched.get("name"), R_NULL);
  const name =
    nameInput.type === "null"
      ? characterVector([`GRID.VP.${gridState(invocation).grobCounter + 1}`])
      : characterVector([characterValues(nameInput, "viewport(name=)")[0] ?? ""]);
  const supplied = async (field: string): Promise<RValue> =>
    optionalValue(invocation, matched.get(field), R_NULL);
  const names = [
    "x",
    "y",
    "width",
    "height",
    "justification",
    "gp",
    "clip",
    "xscale",
    "yscale",
    "angle",
    "layout",
    "layout.pos.row",
    "layout.pos.col",
    "valid.just",
    "valid.pos.row",
    "valid.pos.col",
    "name",
    "parentgpar",
    "gpar",
    "trans",
    "widths",
    "heights",
    "width.cm",
    "height.cm",
    "rotation",
    "cliprect",
    "parent",
    "children",
    "devwidth",
    "devheight",
    "clippath",
    "mask",
    "resolvedmask",
  ];
  const values: RValue[] = [
    x,
    y,
    width,
    height,
    doubleVector(just),
    gp,
    clip,
    doubleVector(xscale),
    doubleVector(yscale),
    doubleVector(angle),
    await supplied("layout"),
    await supplied("layout.pos.row"),
    await supplied("layout.pos.col"),
    doubleVector(just),
    R_NULL,
    R_NULL,
    name,
    R_NULL,
    R_NULL,
    R_NULL,
    R_NULL,
    R_NULL,
    R_NULL,
    R_NULL,
    R_NULL,
    R_NULL,
    R_NULL,
    listValue([]),
    R_NULL,
    R_NULL,
    R_NULL,
    await supplied("mask"),
    R_NULL,
  ];
  return withClasses(listValue(values, names), ["viewport"]);
}

async function builtinPushViewport(invocation: BuiltinInvocation): Promise<RValue> {
  const { dots } = matchBuiltinArguments(invocation, ["...", "recording"]);
  if (dots.length === 0)
    throw new RTypeMismatchError("NRT3382", "must specify at least one viewport");
  const state = gridState(invocation);
  for (const argument of dots) {
    const value = await invocation.force(argument.promise);
    if (value.type !== "list" || !objectClasses(value)?.includes("viewport")) {
      throw new RTypeMismatchError("NRT3382", "only viewports are allowed in 'vpList'");
    }
    state.viewports.push(value);
    state.viewportPaths.push([...state.viewports]);
  }
  return R_NULL;
}

async function builtinPopViewport(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["n", "recording"]);
  const count = await optionalInteger(invocation, matched.get("n"), 1, "popViewport(n=)");
  const state = gridState(invocation);
  if (count < 0 || count > state.viewports.length) {
    throw new RTypeMismatchError(
      "NRT3382",
      "cannot pop the top-level viewport ('grid' and 'graphics' output mixed?)",
    );
  }
  if (count > 0) {
    const removedRoot = state.viewports.slice(0, state.viewports.length - count + 1);
    state.viewportPaths.splice(
      0,
      state.viewportPaths.length,
      ...state.viewportPaths.filter((path) => !viewportPathStartsWith(path, removedRoot)),
    );
  }
  state.viewports.splice(state.viewports.length - count, count);
  return R_NULL;
}

async function builtinUpViewport(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["n", "recording"]);
  const requested = await optionalInteger(invocation, matched.get("n"), 1, "upViewport(n=)");
  if (requested < 0) {
    throw new RTypeMismatchError("NRT3382", "must navigate up at least one viewport");
  }
  const state = gridState(invocation);
  const count = requested === 0 ? state.viewports.length : requested;
  if (count === 0 || count > state.viewports.length) {
    throw new RTypeMismatchError(
      "NRT3382",
      "cannot pop the top-level viewport ('grid' and 'graphics' output mixed?)",
    );
  }
  const removed = state.viewports.splice(state.viewports.length - count, count);
  const names = removed.map(viewportName);
  const path = names.length > 1 ? characterVector([names.slice(0, -1).join("::")]) : R_NULL;
  return withClasses(
    listValue(
      [path, characterVector([names.at(-1) ?? ""]), integerVector([count])],
      ["path", "name", "n"],
    ),
    ["vpPath", "path"],
  );
}

function viewportName(viewport: RList): string {
  const names = vectorNames(viewport) ?? [];
  const index = names.indexOf("name");
  const value = index < 0 ? undefined : viewport.values[index];
  return value?.type === "character" && value.length > 0 && !isMissing(value, 0)
    ? (value.values[0] ?? "")
    : "";
}

async function builtinDownViewport(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["name", "strict", "recording"]);
  const value = await required(invocation, matched.get("name"), "name", "downViewport");
  const requested = viewportPathNames(value, "downViewport");
  const strict = await optionalLogical(invocation, matched.get("strict"), false, "strict");
  const state = gridState(invocation);
  const currentLength = state.viewports.length;
  const candidates = state.viewportPaths.filter(
    (path) => path.length > currentLength && viewportPathStartsWith(path, state.viewports),
  );
  const target = candidates.find((path) => {
    const descendants = path.slice(currentLength).map(viewportName);
    if (strict) {
      return (
        descendants.length === requested.length &&
        requested.every((name, index) => descendants[index] === name)
      );
    }
    return viewportNameSequenceIndex(descendants, requested) >= 0;
  });
  if (target === undefined) {
    throw new REvaluationError("NRE2283", `Viewport '${requested.join("::")}' was not found`);
  }
  const depth = target.length - currentLength;
  state.viewports.splice(0, state.viewports.length, ...target);
  return integerVector([depth]);
}

function builtinCurrentViewport(invocation: BuiltinInvocation): RValue {
  matchBuiltinArguments(invocation, []);
  return gridState(invocation).viewports.at(-1) ?? rootViewport();
}

function builtinCurrentTransform(invocation: BuiltinInvocation): RValue {
  matchBuiltinArguments(invocation, []);
  const geometry = currentViewportGeometry(invocation);
  return withAttribute(doubleVector(geometry.transform), "dim", integerVector([3, 3]));
}

async function builtinViewportPath(invocation: BuiltinInvocation): Promise<RValue> {
  const { dots } = matchBuiltinArguments(invocation, ["..."]);
  const names: string[] = [];
  for (const argument of dots) {
    const value = await invocation.force(argument.promise);
    names.push(...viewportPathNames(value, "vpPath"));
  }
  if (names.length === 0) {
    throw new RTypeMismatchError("NRT3382", "must specify at least one viewport name");
  }
  return viewportPathValue(names);
}

function viewportPathNames(value: RValue, call: string): string[] {
  if (value.type === "character") {
    const values = characterValues(value, `${call}()`);
    if (values.length === 0) {
      throw new RTypeMismatchError("NRT3382", `${call}() requires a viewport name`);
    }
    return values;
  }
  if (value.type === "list" && objectClasses(value)?.includes("vpPath")) {
    const path = optionalListMember(value, "path");
    const name = optionalListMember(value, "name");
    const prefix =
      path?.type === "character" && path.length > 0 && !isMissing(path, 0)
        ? (path.values[0] ?? "").split("::").filter(Boolean)
        : [];
    if (name?.type !== "character" || name.length !== 1 || isMissing(name, 0)) {
      throw new RTypeMismatchError("NRT3382", `invalid ${call} viewport path`);
    }
    return [...prefix, name.values[0] ?? ""];
  }
  throw new RTypeMismatchError("NRT3382", `${call}() requires character viewport names`);
}

function viewportPathValue(names: readonly string[]): RList {
  return withClasses(
    listValue(
      [
        names.length > 1 ? characterVector([names.slice(0, -1).join("::")]) : R_NULL,
        characterVector([names.at(-1) ?? ""]),
        integerVector([names.length]),
      ],
      ["path", "name", "n"],
    ),
    ["vpPath", "path"],
  );
}

function viewportPathStartsWith(path: readonly RList[], prefix: readonly RList[]): boolean {
  return prefix.every((viewport, index) => path[index] === viewport);
}

function viewportNameSequenceIndex(
  available: readonly string[],
  requested: readonly string[],
): number {
  for (let start = 0; start <= available.length - requested.length; start += 1) {
    if (requested.every((name, index) => available[start + index] === name)) return start;
  }
  return -1;
}

function rootViewport(): RList {
  return withClasses(
    listValue(
      [
        doubleVector([0, 1]),
        doubleVector([0, 1]),
        doubleVector([0.5, 0.5]),
        characterVector(["ROOT"]),
      ],
      ["xscale", "yscale", "valid.just", "name"],
    ),
    ["viewport"],
  );
}

function builtinGridNewPage(invocation: BuiltinInvocation): RValue {
  matchBuiltinArguments(invocation, ["recording", "clearGroups"]);
  openGridGraphicsDevice?.(invocation);
  const state = gridState(invocation);
  state.viewports.length = 0;
  state.viewportPaths.length = 0;
  invocation.context.writeGraphics({ kind: "new-page" });
  return R_NULL;
}

async function builtinGrobLifecycle(
  invocation: BuiltinInvocation,
  generic: "makeContent" | "makeContext",
  dispatch: boolean,
): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x"]);
  const argument = matched.get("x");
  const object = await required(invocation, argument, "x", generic);
  if (dispatch) {
    const dispatched = await invocation.dispatchS3IfPresent(generic, object, invocation.arguments);
    if (dispatched !== undefined) return dispatched;
  }
  return object;
}

async function builtinRectGrob(invocation: BuiltinInvocation): Promise<RList> {
  const parameters = rectParameters(false);
  const { matched } = matchBuiltinArguments(invocation, parameters);
  const defaultUnits = await optionalCharacter(invocation, matched.get("default.units"), "npc");
  const x = await coordinateUnit(invocation, matched.get("x"), 0.5, defaultUnits);
  const y = await coordinateUnit(invocation, matched.get("y"), 0.5, defaultUnits);
  const width = await coordinateUnit(invocation, matched.get("width"), 1, defaultUnits);
  const height = await coordinateUnit(invocation, matched.get("height"), 1, defaultUnits);
  const just = await optionalValue(invocation, matched.get("just"), characterVector(["centre"]));
  const hjust = await optionalValue(invocation, matched.get("hjust"), R_NULL);
  const vjust = await optionalValue(invocation, matched.get("vjust"), R_NULL);
  const { name, gp, vp } = await gridGrobControls(invocation, matched, "rect");
  return withClasses(
    listValue(
      [x, y, width, height, just, hjust, vjust, name, gp, vp],
      ["x", "y", "width", "height", "just", "hjust", "vjust", "name", "gp", "vp"],
    ),
    ["rect", "grob", "gDesc"],
  );
}

async function builtinGridRect(invocation: BuiltinInvocation): Promise<RValue> {
  const parameters = rectParameters(true);
  const { matched } = matchBuiltinArguments(invocation, parameters);
  const grobArguments = invocation.arguments.filter((argument) => argument.name !== "draw");
  const grob = await builtinRectGrob({ ...invocation, arguments: grobArguments });
  const draw = await optionalLogical(invocation, matched.get("draw"), true, "draw");
  if (draw) drawRectGrob(invocation, grob);
  return grob;
}

function drawRectGrob(invocation: BuiltinInvocation, grob: RList): void {
  const x = unitNumeric(listMember(grob, "x"));
  const y = unitNumeric(listMember(grob, "y"));
  const width = unitNumeric(listMember(grob, "width"));
  const height = unitNumeric(listMember(grob, "height"));
  const count = Math.max(x.length, y.length, width.length, height.length);
  if (count === 0) return;
  const just = rectJustification(grob);
  const gp = listMember(grob, "gp");
  const fill = gridGparColour(gp, "fill", "transparent");
  const border = gridGparColour(gp, "col", "black");
  const lineType = gridGparLineType(gp);
  const lineWidth = gridGparNumber(gp, "lwd", 1);
  invocation.context.allocate(count * 16);
  const polygons = Array.from({ length: count }, (_, index) => {
    const anchorX = x[index % x.length] ?? 0.5;
    const anchorY = y[index % y.length] ?? 0.5;
    const rectWidth = width[index % width.length] ?? 1;
    const rectHeight = height[index % height.length] ?? 1;
    const left = anchorX - just[0] * rectWidth;
    const bottom = anchorY - just[1] * rectHeight;
    return {
      x: [left, left + rectWidth, left + rectWidth, left],
      y: [bottom, bottom, bottom + rectHeight, bottom + rectHeight],
      fill,
      border,
      lineType,
      lineWidth,
      fillRule: "nonzero" as const,
    };
  });
  invocation.context.writeGraphics({ kind: "polygon", polygons });
}

function rectJustification(grob: RList): readonly [number, number] {
  const just = listMember(grob, "just");
  const base =
    just.type === "character"
      ? characterRectJustification(characterValues(just, "rectGrob(just=)"))
      : numericRectJustification(numericValues(just, "rectGrob(just=)"));
  const hjust = listMember(grob, "hjust");
  const vjust = listMember(grob, "vjust");
  return [
    hjust.type === "null" ? base[0] : (numericValues(hjust, "rectGrob(hjust=)")[0] ?? base[0]),
    vjust.type === "null" ? base[1] : (numericValues(vjust, "rectGrob(vjust=)")[0] ?? base[1]),
  ];
}

function characterRectJustification(values: readonly string[]): readonly [number, number] {
  if (values.length === 0) return [0.5, 0.5];
  if (values.length === 1) return singleViewportJustification(values[0] ?? "centre");
  return [
    horizontalJustification(values[0] ?? "centre"),
    verticalJustification(values[1] ?? "centre"),
  ];
}

function numericRectJustification(values: readonly number[]): readonly [number, number] {
  return [values[0] ?? 0.5, values[1] ?? values[0] ?? 0.5];
}

async function builtinPolygonGrob(invocation: BuiltinInvocation): Promise<RList> {
  const parameters = polygonParameters(false);
  const { matched } = matchBuiltinArguments(invocation, parameters);
  const defaultUnits = await optionalCharacter(invocation, matched.get("default.units"), "npc");
  const x = await coordinateUnit(invocation, matched.get("x"), 0, defaultUnits);
  const y = await coordinateUnit(invocation, matched.get("y"), 0, defaultUnits);
  const id = await optionalPolygonIndex(invocation, matched.get("id"), "id");
  const idLengths = await optionalPolygonIndex(invocation, matched.get("id.lengths"), "id.lengths");
  if (id.type !== "null" && idLengths.type !== "null") {
    throw new RTypeMismatchError("NRT3385", "it is invalid to specify both 'id' and 'id.lengths'");
  }
  const nameInput = await optionalValue(invocation, matched.get("name"), R_NULL);
  const state = gridState(invocation);
  state.grobCounter += 1;
  const name =
    nameInput.type === "null"
      ? characterVector([`GRID.polygon.${state.grobCounter}`])
      : characterVector([characterValues(nameInput, "polygonGrob(name=)")[0] ?? ""]);
  const gp = await optionalGpar(invocation, matched.get("gp"));
  const vpInput = await optionalValue(invocation, matched.get("vp"), R_NULL);
  const vp =
    vpInput.type === "character"
      ? viewportPathValue(viewportPathNames(vpInput, "polygonGrob"))
      : vpInput;
  return withClasses(
    listValue(
      [x, y, id, idLengths, name, gp, vp],
      ["x", "y", "id", "id.lengths", "name", "gp", "vp"],
    ),
    ["polygon", "grob", "gDesc"],
  );
}

async function optionalPolygonIndex(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  const value = await optionalValue(invocation, argument, R_NULL);
  if (value.type === "null") return value;
  const entries = numericValues(value, `polygonGrob(${name}=)`);
  if (entries.some((entry) => !Number.isInteger(entry) || entry < 1)) {
    throw new RTypeMismatchError("NRT3385", `'${name}' must contain positive integers`);
  }
  return integerVector(entries);
}

async function builtinGridPolygon(invocation: BuiltinInvocation): Promise<RValue> {
  const parameters = polygonParameters(true);
  const { matched } = matchBuiltinArguments(invocation, parameters);
  const grobArguments = invocation.arguments.filter((argument) => argument.name !== "draw");
  const grob = await builtinPolygonGrob({ ...invocation, arguments: grobArguments });
  const draw = await optionalLogical(invocation, matched.get("draw"), true, "draw");
  if (draw) drawPolygonGrob(invocation, grob);
  return grob;
}

function drawPolygonGrob(invocation: BuiltinInvocation, grob: RList): void {
  const x = unitNumeric(listMember(grob, "x"));
  const y = unitNumeric(listMember(grob, "y"));
  const count = Math.max(x.length, y.length);
  if (count === 0) return;
  const id = listMember(grob, "id");
  const idLengths = listMember(grob, "id.lengths");
  const groups = polygonGroups(count, id, idLengths);
  const gp = listMember(grob, "gp");
  const fill = gridGparColour(gp, "fill", "transparent");
  const border = gridGparColour(gp, "col", "black");
  const lineType = gridGparLineType(gp);
  const lineWidth = gridGparNumber(gp, "lwd", 1);
  invocation.context.allocate(count * 4);
  const polygons = groups.map((indices) => ({
    x: indices.map((index) => x[index % x.length] ?? 0),
    y: indices.map((index) => y[index % y.length] ?? 0),
    fill,
    border,
    lineType,
    lineWidth,
    fillRule: "nonzero" as const,
  }));
  if (polygons.length > 0) invocation.context.writeGraphics({ kind: "polygon", polygons });
}

function polygonGroups(count: number, id: RValue, idLengths: RValue): number[][] {
  if (id.type === "integer") {
    const groups = new Map<number, number[]>();
    for (let index = 0; index < count; index += 1) {
      const key = id.values[index % id.length] ?? 1;
      const group = groups.get(key) ?? [];
      group.push(index);
      groups.set(key, group);
    }
    return [...groups.values()];
  }
  if (idLengths.type === "integer") {
    const groups: number[][] = [];
    let offset = 0;
    for (const length of idLengths.values) {
      groups.push(
        Array.from({ length }, (_, index) => offset + index).filter((index) => index < count),
      );
      offset += length;
    }
    return groups.filter((group) => group.length > 0);
  }
  return [Array.from({ length: count }, (_, index) => index)];
}

function gridGparColour(gp: RValue, name: string, fallback: string): string {
  if (gp.type !== "list") return cssColour(fallback);
  const value = optionalListMember(gp, name);
  if (value === undefined || value.type === "null") return cssColour(fallback);
  if (
    value.type !== "character" &&
    value.type !== "logical" &&
    value.type !== "integer" &&
    value.type !== "double"
  ) {
    throw new RTypeMismatchError("NRT3381", `gpar(${name}=) must be an atomic vector.`);
  }
  if (value.length === 0) return cssColour(fallback);
  if (isMissing(value, 0)) return cssColour("transparent");
  return cssColour(characterValues(value, `gpar(${name}=)`)[0] ?? fallback);
}

function gridGparNumber(gp: RValue, name: string, fallback: number): number {
  if (gp.type !== "list") return fallback;
  const value = optionalListMember(gp, name);
  if (value === undefined || value.type === "null") return fallback;
  return numericValues(value, `gpar(${name}=)`)[0] ?? fallback;
}

function gridGparLineType(gp: RValue): string {
  if (gp.type !== "list") return "solid";
  const value = optionalListMember(gp, "lty");
  if (value === undefined || value.type === "null") return "solid";
  if (
    value.type !== "character" &&
    value.type !== "logical" &&
    value.type !== "integer" &&
    value.type !== "double"
  ) {
    throw new RTypeMismatchError("NRT3381", "gpar(lty=) must be an atomic vector.");
  }
  if (value.length === 0) return "solid";
  const entry =
    value.type === "character" ? value.values[0] : numericValues(value, "gpar(lty=)")[0];
  const key = String(entry ?? "solid").toLowerCase();
  return (
    new Map([
      ["1", "solid"],
      ["solid", "solid"],
      ["2", "44"],
      ["dashed", "44"],
      ["3", "13"],
      ["dotted", "13"],
      ["4", "1343"],
      ["dotdash", "1343"],
      ["5", "73"],
      ["longdash", "73"],
      ["6", "2262"],
      ["twodash", "2262"],
      ["0", "blank"],
      ["blank", "blank"],
    ]).get(key) ?? key
  );
}

async function builtinSegmentsGrob(invocation: BuiltinInvocation): Promise<RList> {
  const { matched } = matchBuiltinArguments(invocation, segmentParameters(false));
  const units = await optionalCharacter(invocation, matched.get("default.units"), "npc");
  const x0 = await coordinateUnit(invocation, matched.get("x0"), 0, units);
  const y0 = await coordinateUnit(invocation, matched.get("y0"), 0, units);
  const x1 = await coordinateUnit(invocation, matched.get("x1"), 1, units);
  const y1 = await coordinateUnit(invocation, matched.get("y1"), 1, units);
  const arrow = await optionalValue(invocation, matched.get("arrow"), R_NULL);
  const { name, gp, vp } = await gridGrobControls(invocation, matched, "segments");
  return withClasses(
    listValue(
      [x0, y0, x1, y1, arrow, name, gp, vp],
      ["x0", "y0", "x1", "y1", "arrow", "name", "gp", "vp"],
    ),
    ["segments", "grob", "gDesc"],
  );
}

async function builtinGridSegments(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, segmentParameters(true));
  const grob = await builtinSegmentsGrob({
    ...invocation,
    arguments: invocation.arguments.filter((argument) => argument.name !== "draw"),
  });
  if (await optionalLogical(invocation, matched.get("draw"), true, "draw"))
    drawSegmentsGrob(invocation, grob);
  return grob;
}

function drawSegmentsGrob(invocation: BuiltinInvocation, grob: RList): void {
  const x0 = unitNumeric(listMember(grob, "x0"));
  const y0 = unitNumeric(listMember(grob, "y0"));
  const x1 = unitNumeric(listMember(grob, "x1"));
  const y1 = unitNumeric(listMember(grob, "y1"));
  const count = Math.max(x0.length, y0.length, x1.length, y1.length);
  const gp = listMember(grob, "gp");
  const color = gridGparColour(gp, "col", "black");
  const lineType = gridGparLineType(gp);
  const lineWidth = gridGparNumber(gp, "lwd", 1);
  const segments = Array.from({ length: count }, (_, index) => ({
    x0: x0[index % x0.length] ?? 0,
    y0: y0[index % y0.length] ?? 0,
    x1: x1[index % x1.length] ?? 1,
    y1: y1[index % y1.length] ?? 1,
    color,
    lineType,
    lineWidth,
  }));
  if (segments.length > 0) invocation.context.writeGraphics({ kind: "segments", segments });
}

async function builtinLinesGrob(invocation: BuiltinInvocation): Promise<RList> {
  const { matched } = matchBuiltinArguments(invocation, lineParameters(false));
  const units = await optionalCharacter(invocation, matched.get("default.units"), "npc");
  const x = await coordinateUnit(invocation, matched.get("x"), 0, units);
  const y = await coordinateUnit(invocation, matched.get("y"), 0, units);
  const arrow = await optionalValue(invocation, matched.get("arrow"), R_NULL);
  const { name, gp, vp } = await gridGrobControls(invocation, matched, "lines");
  return withClasses(
    listValue([x, y, arrow, name, gp, vp], ["x", "y", "arrow", "name", "gp", "vp"]),
    ["lines", "grob", "gDesc"],
  );
}

async function builtinGridLines(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, lineParameters(true));
  const grob = await builtinLinesGrob({
    ...invocation,
    arguments: invocation.arguments.filter((argument) => argument.name !== "draw"),
  });
  if (await optionalLogical(invocation, matched.get("draw"), true, "draw"))
    drawLinesGrob(invocation, grob);
  return grob;
}

function drawLinesGrob(invocation: BuiltinInvocation, grob: RList): void {
  const x = unitNumeric(listMember(grob, "x"));
  const y = unitNumeric(listMember(grob, "y"));
  const count = Math.max(x.length, y.length);
  const gp = listMember(grob, "gp");
  const color = gridGparColour(gp, "col", "black");
  const lineType = gridGparLineType(gp);
  const lineWidth = gridGparNumber(gp, "lwd", 1);
  const segments = [];
  for (let index = 1; index < count; index += 1)
    segments.push({
      x0: x[(index - 1) % x.length] ?? 0,
      y0: y[(index - 1) % y.length] ?? 0,
      x1: x[index % x.length] ?? 0,
      y1: y[index % y.length] ?? 0,
      color,
      lineType,
      lineWidth,
    });
  if (segments.length > 0) invocation.context.writeGraphics({ kind: "segments", segments });
}

async function builtinPointsGrob(invocation: BuiltinInvocation): Promise<RList> {
  const { matched } = matchBuiltinArguments(invocation, pointParameters(false));
  const units = await optionalCharacter(invocation, matched.get("default.units"), "npc");
  const x = await coordinateUnit(invocation, matched.get("x"), 0.5, units);
  const y = await coordinateUnit(invocation, matched.get("y"), 0.5, units);
  const pch = await optionalValue(invocation, matched.get("pch"), doubleVector([1]));
  const size = await optionalValue(
    invocation,
    matched.get("size"),
    simpleUnit([1], unitCode("char")),
  );
  const { name, gp, vp } = await gridGrobControls(invocation, matched, "points");
  return withClasses(
    listValue([x, y, pch, size, name, gp, vp], ["x", "y", "pch", "size", "name", "gp", "vp"]),
    ["points", "grob", "gDesc"],
  );
}

async function builtinGridPoints(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, pointParameters(true));
  const grob = await builtinPointsGrob({
    ...invocation,
    arguments: invocation.arguments.filter((argument) => argument.name !== "draw"),
  });
  if (await optionalLogical(invocation, matched.get("draw"), true, "draw"))
    drawPointsGrob(invocation, grob);
  return grob;
}

function drawPointsGrob(invocation: BuiltinInvocation, grob: RList): void {
  const x = unitNumeric(listMember(grob, "x"));
  const y = unitNumeric(listMember(grob, "y"));
  const pch = listMember(grob, "pch");
  const symbols = pch.type === "character" ? pch.values : numericValues(pch, "pointsGrob(pch=)");
  const sizes = unitNumeric(listMember(grob, "size"));
  const gp = listMember(grob, "gp");
  const color = gridGparColour(gp, "col", "black");
  const fill = gridGparColour(gp, "fill", "transparent");
  const lineWidth = gridGparNumber(gp, "lwd", 1);
  const count = Math.max(x.length, y.length, symbols.length);
  const points = Array.from({ length: count }, (_, index) => ({
    x: x[index % x.length] ?? 0.5,
    y: y[index % y.length] ?? 0.5,
    symbol: symbols[index % symbols.length] ?? 1,
    color,
    fill,
    size: sizes[index % sizes.length] ?? 1,
    lineWidth,
  }));
  if (points.length > 0) invocation.context.writeGraphics({ kind: "points", points });
}

async function gridGrobControls(
  invocation: BuiltinInvocation,
  matched: ReadonlyMap<string, BuiltinCallArgument>,
  prefix: string,
): Promise<{ name: RValue; gp: RList; vp: RValue }> {
  const state = gridState(invocation);
  state.grobCounter += 1;
  const nameInput = await optionalValue(invocation, matched.get("name"), R_NULL);
  const name =
    nameInput.type === "null"
      ? characterVector([`GRID.${prefix}.${state.grobCounter}`])
      : characterVector([characterValues(nameInput, `${prefix}Grob(name=)`)[0] ?? ""]);
  const gp = await optionalGpar(invocation, matched.get("gp"));
  const vpInput = await optionalValue(invocation, matched.get("vp"), R_NULL);
  const vp =
    vpInput.type === "character"
      ? viewportPathValue(viewportPathNames(vpInput, `${prefix}Grob`))
      : vpInput;
  return { name, gp, vp };
}

async function builtinTextGrob(invocation: BuiltinInvocation): Promise<RList> {
  const parameters = textParameters(false);
  const { matched } = matchBuiltinArguments(invocation, parameters);
  const suppliedLabel = await required(invocation, matched.get("label"), "label", "textGrob");
  const label = normalizeGraphicsAnnotation(suppliedLabel);
  const defaultUnits = await optionalCharacter(invocation, matched.get("default.units"), "npc");
  const x = await coordinateUnit(invocation, matched.get("x"), 0.5, defaultUnits);
  const y = await coordinateUnit(invocation, matched.get("y"), 0.5, defaultUnits);
  const just = await optionalValue(invocation, matched.get("just"), characterVector(["centre"]));
  const hjust = await optionalValue(invocation, matched.get("hjust"), R_NULL);
  const vjust = await optionalValue(invocation, matched.get("vjust"), R_NULL);
  const rot = doubleVector(await optionalNumeric(invocation, matched.get("rot"), [0], "rot"));
  const overlap = logicalVector([
    await optionalLogical(invocation, matched.get("check.overlap"), false, "check.overlap"),
  ]);
  const nameInput = await optionalValue(invocation, matched.get("name"), R_NULL);
  const state = gridState(invocation);
  state.grobCounter += 1;
  const name =
    nameInput.type === "null"
      ? characterVector([`GRID.text.${state.grobCounter}`])
      : characterVector([characterValues(nameInput, "textGrob(name=)")[0] ?? ""]);
  const gp = await optionalGpar(invocation, matched.get("gp"));
  const vp = await optionalValue(invocation, matched.get("vp"), R_NULL);
  return withClasses(
    listValue(
      [label, x, y, just, hjust, vjust, rot, overlap, name, gp, vp],
      ["label", "x", "y", "just", "hjust", "vjust", "rot", "check.overlap", "name", "gp", "vp"],
    ),
    ["text", "grob", "gDesc"],
  );
}

async function builtinGrobExtent(invocation: BuiltinInvocation, code: 21 | 22): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x"]);
  const grob = await required(
    invocation,
    matched.get("x"),
    "x",
    code === 21 ? "grobWidth" : "grobHeight",
  );
  if (grob.type !== "list" || !objectClasses(grob)?.includes("grob")) {
    throw new RTypeMismatchError("NRT3383", "invalid 'grob' argument");
  }
  const entry = listValue([doubleVector([1]), grob, integerVector([code])]);
  return withClasses(listValue([entry]), ["unit", "unit_v2"]);
}

async function builtinConvertUnit(
  invocation: BuiltinInvocation,
  axis: "width" | "height",
): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, ["x", "unitTo", "valueOnly"]);
  const input = await required(invocation, matched.get("x"), "x", `convert${axis}`);
  const target = await optionalCharacter(invocation, matched.get("unitTo"), "");
  const valueOnly = await optionalLogical(invocation, matched.get("valueOnly"), false, "valueOnly");
  const targetCode = unitCode(target);
  const extent = currentViewportGeometry(invocation)[axis];
  const values = unitInches(input, axis, extent).map((value) =>
    fromInches(value, targetCode, axis, extent),
  );
  return valueOnly ? doubleVector(values) : simpleUnit(values, targetCode);
}

async function builtinGridText(invocation: BuiltinInvocation): Promise<RValue> {
  const parameters = textParameters(true);
  const { matched } = matchBuiltinArguments(invocation, parameters);
  const textArguments = invocation.arguments.filter((argument) => argument.name !== "draw");
  const grob = await builtinTextGrob({ ...invocation, arguments: textArguments });
  const draw = await optionalLogical(invocation, matched.get("draw"), true, "draw");
  if (draw) drawTextGrob(invocation, grob);
  return grob;
}

function drawTextGrob(invocation: BuiltinInvocation, grob: RList): void {
  const label = listMember(grob, "label");
  const labels = graphicsAnnotationLabels(label, "grid.text(label=)");
  const x = unitNumeric(listMember(grob, "x"));
  const y = unitNumeric(listMember(grob, "y"));
  const rotation = numericValues(listMember(grob, "rot"), "grid.text(rot=)")[0] ?? 0;
  const gp = listMember(grob, "gp");
  const colorValue = gp.type === "list" ? optionalListMember(gp, "col") : undefined;
  const colors = colorValue === undefined ? ["black"] : characterValues(colorValue, "gpar(col=)");
  const fontsizeValue = gp.type === "list" ? optionalListMember(gp, "fontsize") : undefined;
  const fontSizes =
    fontsizeValue === undefined ? [12] : numericValues(fontsizeValue, "gpar(fontsize=)");
  const count = Math.max(labels.length, x.length, y.length);
  const resolved = [];
  invocation.context.allocate(count * 11);
  for (let index = 0; index < count; index += 1) {
    invocation.context.checkpoint();
    resolved.push({
      x: x[index % x.length] ?? 0.5,
      y: y[index % y.length] ?? 0.5,
      label: labels[index % labels.length] ?? "",
      color: cssColour(colors[index % colors.length] ?? "black"),
      size: (fontSizes[index % fontSizes.length] ?? 12) / 12,
      font: 1 as const,
      family: "",
      rotation,
      horizontalAdjustment: 0.5,
      verticalAdjustment: 0.5,
      offset: 0.5,
    });
  }
  if (resolved.length > 0) invocation.context.writeGraphics({ kind: "text", labels: resolved });
}

function gridState(invocation: BuiltinInvocation): GridState {
  const existing = invocation.state.get(GRID_STATE_KEY) as GridState | undefined;
  if (existing !== undefined) return existing;
  const created: GridState = { viewports: [], viewportPaths: [], grobCounter: 0 };
  invocation.state.set(GRID_STATE_KEY, created);
  return created;
}

function simpleUnit(values: readonly number[], code: number): RDoubleVector {
  return withClasses(withAttribute(doubleVector(values), "unit", integerVector([code])), [
    "simpleUnit",
    "unit",
    "unit_v2",
  ]);
}

function unitCode(name: string): number {
  const normalized = name.toLowerCase();
  const code = UNIT_CODES.get(normalized);
  if (code === undefined) throw new RTypeMismatchError("NRT3380", `Invalid unit '${name}'`);
  return code;
}

function unitNumeric(value: RValue): readonly number[] {
  if (value.type === "double" && objectClasses(value)?.includes("unit")) return [...value.values];
  return numericValues(value, "grid unit coordinate");
}

function unitInches(
  value: RValue,
  axis: "width" | "height",
  viewportExtent: number,
): readonly number[] {
  if (value.type === "double" && objectClasses(value)?.includes("unit")) {
    const unit = objectAttributes(value)?.get("unit");
    const code = unit?.type === "integer" ? (unit.values[0] ?? 0) : 0;
    return [...value.values].map((entry) => toInches(entry, code, axis, viewportExtent));
  }
  if (value.type === "list" && objectClasses(value)?.includes("unit")) {
    return value.values.map((entry) => {
      if (entry.type !== "list" || entry.values.length < 3) {
        throw new RTypeMismatchError("NRT3380", "Malformed grid unit object.");
      }
      const amount = numericValues(entry.values[0] ?? R_NULL, "grid unit")[0] ?? 0;
      const codeValue = entry.values[2];
      const code = codeValue?.type === "integer" ? (codeValue.values[0] ?? 0) : 0;
      if (code === 21 || code === 22) {
        const grob = entry.values[1];
        if (grob?.type !== "list") throw new RTypeMismatchError("NRT3383", "Malformed grob unit.");
        return amount * textGrobInches(grob, code === 21 ? "width" : "height");
      }
      return toInches(amount, code, axis, viewportExtent);
    });
  }
  throw new RTypeMismatchError("NRT3380", "Expected a grid unit object.");
}

function textGrobInches(grob: RList, axis: "width" | "height"): number {
  const labels = graphicsAnnotationLabels(listMember(grob, "label"), "text grob label");
  const gp = listMember(grob, "gp");
  const fontSizeValue = gp.type === "list" ? optionalListMember(gp, "fontsize") : undefined;
  const fontSize =
    fontSizeValue === undefined ? 12 : (numericValues(fontSizeValue, "fontsize")[0] ?? 12);
  const width = (Math.max(0, ...labels.map((label) => [...label].length)) * fontSize * 0.6) / 72;
  const height = (fontSize * 1.2) / 72;
  const rotation = numericValues(listMember(grob, "rot"), "text grob rotation")[0] ?? 0;
  const quarterTurn = Math.abs(Math.sin((rotation * Math.PI) / 180));
  return axis === "width"
    ? width * (1 - quarterTurn) + height * quarterTurn
    : height * (1 - quarterTurn) + width * quarterTurn;
}

function toInches(
  value: number,
  code: number,
  axis: "width" | "height",
  viewportExtent: number,
): number {
  switch (UNIT_NAMES.get(code)) {
    case "npc":
    case "native":
    case "null":
      return value * viewportExtent;
    case "cm":
      return value / 2.54;
    case "inches":
      return value;
    case "lines":
      return (value * 14.4) / 72;
    case "mm":
      return value / 25.4;
    case "points":
      return value / 72;
    case "char":
      return (value * 7.2) / 72;
    default:
      throw new RUnsupportedFeatureError("NRU6180", `Grid unit code ${code} is not convertible.`);
  }
}

function fromInches(
  value: number,
  code: number,
  axis: "width" | "height",
  viewportExtent: number,
): number {
  switch (UNIT_NAMES.get(code)) {
    case "npc":
    case "native":
    case "null":
      return value / viewportExtent;
    case "cm":
      return value * 2.54;
    case "inches":
      return value;
    case "lines":
      return (value * 72) / 14.4;
    case "mm":
      return value * 25.4;
    case "points":
      return value * 72;
    case "char":
      return (value * 72) / 7.2;
    default:
      throw new RUnsupportedFeatureError("NRU6180", `Grid unit code ${code} is not convertible.`);
  }
}

interface ViewportGeometry {
  readonly transform: readonly number[];
  readonly width: number;
  readonly height: number;
  readonly xscale: readonly [number, number];
  readonly yscale: readonly [number, number];
}

function currentViewportGeometry(invocation: BuiltinInvocation): ViewportGeometry {
  const device = gridDeviceInches(invocation);
  let geometry: ViewportGeometry = {
    transform: Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    width: device[0],
    height: device[1],
    xscale: [0, 1],
    yscale: [0, 1],
  };
  for (const viewport of gridState(invocation).viewports) {
    geometry = childViewportGeometry(viewport, geometry);
  }
  return geometry;
}

function gridDeviceInches(invocation: BuiltinInvocation): readonly [number, number] {
  const parameters = invocation.state.get("graphics.parameters");
  if (parameters instanceof Map) {
    const din = parameters.get("din") as RValue | undefined;
    if (din?.type === "double" && din.length >= 2) {
      const width = din.values[0] ?? 7;
      const height = din.values[1] ?? 7;
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return [width, height];
      }
    }
  }
  return [7, 7];
}

function childViewportGeometry(viewport: RList, parent: ViewportGeometry): ViewportGeometry {
  const x = viewportUnitScalar(listMember(viewport, "x"), "width", "location", parent);
  const y = viewportUnitScalar(listMember(viewport, "y"), "height", "location", parent);
  const width = viewportUnitScalar(listMember(viewport, "width"), "width", "dimension", parent);
  const height = viewportUnitScalar(listMember(viewport, "height"), "height", "dimension", parent);
  const justification = numericValues(listMember(viewport, "justification"), "viewport just");
  const justX = justification[0] ?? 0.5;
  const justY = justification[1] ?? 0.5;
  const angle = numericValues(listMember(viewport, "angle"), "viewport angle")[0] ?? 0;
  const radians = (angle * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const offsetX = -justX * width;
  const offsetY = -justY * height;
  const translatedX = x + offsetX * cosine - offsetY * sine;
  const translatedY = y + offsetX * sine + offsetY * cosine;
  const local = [cosine, -sine, translatedX, sine, cosine, translatedY, 0, 0, 1];
  return {
    transform: multiplyTransform(local, parent.transform),
    width,
    height,
    xscale: viewportScale(viewport, "xscale"),
    yscale: viewportScale(viewport, "yscale"),
  };
}

function viewportScale(viewport: RList, name: "xscale" | "yscale"): readonly [number, number] {
  const values = numericValues(listMember(viewport, name), `viewport ${name}`);
  return [values[0] ?? 0, values[1] ?? 1];
}

function viewportUnitScalar(
  value: RValue,
  axis: "width" | "height",
  purpose: "location" | "dimension",
  parent: ViewportGeometry,
): number {
  if (value.type !== "double" || !objectClasses(value)?.includes("unit") || value.length === 0) {
    throw new RUnsupportedFeatureError(
      "NRU6180",
      "current.transform() requires scalar simple-unit viewport geometry in this profile.",
    );
  }
  const amount = value.values[0] ?? 0;
  const unit = objectAttributes(value)?.get("unit");
  const code = unit?.type === "integer" ? (unit.values[0] ?? 0) : 0;
  const extent = axis === "width" ? parent.width : parent.height;
  if (UNIT_NAMES.get(code) === "native") {
    const scale = axis === "width" ? parent.xscale : parent.yscale;
    const span = (scale[1] ?? 1) - (scale[0] ?? 0);
    if (span === 0) return 0;
    return purpose === "location"
      ? ((amount - (scale[0] ?? 0)) / span) * extent
      : (amount / Math.abs(span)) * extent;
  }
  return toInches(amount, code, axis, extent);
}

function multiplyTransform(left: readonly number[], right: readonly number[]): readonly number[] {
  const output = Array.from({ length: 9 }, () => 0);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      let total = 0;
      for (let inner = 0; inner < 3; inner += 1) {
        total += (left[row + inner * 3] ?? 0) * (right[inner + column * 3] ?? 0);
      }
      output[row + column * 3] = total;
    }
  }
  return output;
}

async function coordinateUnit(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  units: string,
): Promise<RValue> {
  const value = await optionalValue(invocation, argument, doubleVector([fallback]));
  return objectClasses(value)?.includes("unit")
    ? value
    : simpleUnit(numericValues(value, "grid coordinate"), unitCode(units));
}

async function optionalGpar(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RList> {
  const value = await optionalValue(invocation, argument, withClasses(listValue([]), ["gpar"]));
  if (value.type !== "list" || !objectClasses(value)?.includes("gpar")) {
    throw new RTypeMismatchError("NRT3381", "Expected a 'gpar' object.");
  }
  return value;
}

async function required(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
  callName: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in ${callName}().`);
  }
  return invocation.force(argument.promise);
}

async function optionalValue(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: RValue,
): Promise<RValue> {
  return argument === undefined || argument.promise.missing
    ? fallback
    : invocation.force(argument.promise);
}

async function optionalCharacter(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: string,
): Promise<string> {
  const value = await optionalValue(invocation, argument, characterVector([fallback]));
  const values = characterValues(value, "grid character argument");
  if (values.length !== 1) throw new RTypeMismatchError("NRT3384", "Expected one character value.");
  return values[0] ?? fallback;
}

async function optionalNumeric(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: readonly number[],
  name: string,
): Promise<readonly number[]> {
  const value = await optionalValue(invocation, argument, doubleVector(fallback));
  return numericValues(value, `grid ${name}`);
}

async function optionalInteger(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: number,
  name: string,
): Promise<number> {
  const values = await optionalNumeric(invocation, argument, [fallback], name);
  const value = values[0] ?? fallback;
  if (!Number.isInteger(value))
    throw new RTypeMismatchError("NRT3384", `${name} must be an integer.`);
  return value;
}

async function optionalLogical(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  fallback: boolean,
  name: string,
): Promise<boolean> {
  const value = await optionalValue(invocation, argument, logicalVector([fallback]));
  if (value.type !== "logical" || value.length !== 1 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3384", `grid ${name} must be one non-missing logical value.`);
  }
  return value.values[0] === 1;
}

function numericValues(value: RValue, label: string): number[] {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3384", `${label} must be numeric.`);
  }
  const values: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    values.push(isMissing(value, index) ? Number.NaN : Number(value.values[index]));
  }
  return values;
}

function characterValues(value: RValue, label: string): string[] {
  if (value.type === "character") {
    return value.values.map((entry, index) => (isMissing(value, index) ? "NA" : entry));
  }
  if (value.type === "logical" || value.type === "integer" || value.type === "double") {
    return numericValues(value, label).map(String);
  }
  throw new RTypeMismatchError("NRT3384", `${label} must be coercible to character.`);
}

function normalizeGraphicsAnnotation(value: RValue): RValue {
  if (
    value.type === "character" ||
    value.type === "expression" ||
    value.type === "language" ||
    value.type === "symbol"
  ) {
    return value;
  }
  if (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "raw"
  ) {
    const missing = new Uint8Array(value.length);
    const labels = Array.from({ length: value.length }, (_, index) => {
      if (isMissing(value, index)) {
        missing[index] = 1;
        return "";
      }
      if (value.type === "logical") return value.values[index] === 1 ? "TRUE" : "FALSE";
      if (value.type === "raw") return (value.values[index] ?? 0).toString(16).padStart(2, "0");
      return String(value.values[index] ?? 0);
    });
    return characterVector(labels, missing.some((entry) => entry === 1) ? missing : undefined);
  }
  throw new RTypeMismatchError("NRT3384", "textGrob(label=) must be a graphics annotation.");
}

function graphicsAnnotationLabels(value: RValue, label: string): string[] {
  if (value.type === "expression") return value.values.map(deparseSourceAst);
  if (value.type === "language") return [deparseSourceAst(value.expression)];
  if (value.type === "symbol") return [value.name];
  return characterValues(value, label);
}

function listMember(value: RList, name: string): RValue {
  const member = optionalListMember(value, name);
  if (member === undefined)
    throw new RTypeMismatchError("NRT3383", `Malformed grob field '${name}'.`);
  return member;
}

function optionalListMember(value: RList, name: string): RValue | undefined {
  const names = vectorNames(value);
  const index = names?.indexOf(name) ?? -1;
  return index < 0 ? undefined : value.values[index];
}

async function viewportJustification(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<readonly number[]> {
  const value = await optionalValue(invocation, argument, characterVector(["centre"]));
  if (value.type === "character") {
    const supplied = characterValues(value, "viewport(just=)");
    if (supplied.length === 0) return [0.5, 0.5];
    if (supplied.length === 1) return singleViewportJustification(supplied[0] ?? "");
    return [horizontalJustification(supplied[0] ?? ""), verticalJustification(supplied[1] ?? "")];
  }
  if (value.type === "logical" || value.type === "integer" || value.type === "double") {
    const supplied = numericValues(value, "viewport(just=)");
    if (supplied.length === 0) return [0.5, 0.5];
    if (supplied.length === 1) return [supplied[0] ?? 0.5, 0.5];
    return supplied;
  }
  throw new RTypeMismatchError("NRT3384", "invalid justification");
}

function singleViewportJustification(value: string): readonly [number, number] {
  switch (value.toLowerCase()) {
    case "left":
      return [0, 0.5];
    case "right":
      return [1, 0.5];
    case "bottom":
      return [0.5, 0];
    case "top":
      return [0.5, 1];
    case "centre":
    case "center":
      return [0.5, 0.5];
    default:
      throw new RTypeMismatchError("NRT3384", "invalid justification");
  }
}

function horizontalJustification(value: string): number {
  switch (value.toLowerCase()) {
    case "left":
      return 0;
    case "right":
      return 1;
    case "centre":
    case "center":
      return 0.5;
    default:
      throw new RTypeMismatchError("NRT3384", "invalid horizontal justification");
  }
}

function verticalJustification(value: string): number {
  switch (value.toLowerCase()) {
    case "bottom":
      return 0;
    case "top":
      return 1;
    case "centre":
    case "center":
      return 0.5;
    default:
      throw new RTypeMismatchError("NRT3384", "invalid vertical justification");
  }
}

function cssColour(value: string): string {
  const normalized = value.toLowerCase();
  if (/^#[0-9a-f]{6}$/iu.test(value)) return `${value}ff`;
  if (/^#[0-9a-f]{8}$/iu.test(value)) return value;
  return (
    new Map([
      ["black", "#000000ff"],
      ["white", "#ffffffff"],
      ["red", "#ff0000ff"],
      ["green", "#00ff00ff"],
      ["blue", "#0000ffff"],
      ["grey", "#bebebeff"],
      ["gray", "#bebebeff"],
      ["transparent", "#00000000"],
    ]).get(normalized) ?? "#000000ff"
  );
}

function formal(name: string, defaultValue?: AstNode) {
  return { name, ...(defaultValue === undefined ? {} : { defaultValue }), span: SPAN };
}

function nil(): AstNode {
  return { kind: "NullLiteral", span: SPAN };
}

function double(value: number): AstNode {
  return { kind: "DoubleLiteral", value, span: SPAN };
}

function string(value: string): AstNode {
  return { kind: "StringLiteral", value, span: SPAN };
}

function logical(value: boolean): AstNode {
  return { kind: "LogicalLiteral", value, span: SPAN };
}

function call(name: string, values: readonly AstNode[]): AstNode {
  return {
    kind: "CallExpression",
    callee: { kind: "Identifier", name, span: SPAN },
    arguments: values.map((value) => ({ value, span: SPAN })),
    span: SPAN,
  };
}
