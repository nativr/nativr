import type { AstNode, FunctionParameter, ProgramNode } from "@nativr/ast";

import { RTypeMismatchError } from "./errors.js";

/** Browser-owned library containing source-only package bundles supplied by the host. */
export const NATIVR_PACKAGE_LIBRARY_PATH = "nativr://package";

/** Browser-owned library containing the runtime's registered base and recommended namespaces. */
export const NATIVR_SYSTEM_LIBRARY_PATH = "nativr://runtime/library";

/** Attribute storage prepared for names, dimensions, class, and later extensions. */
export type RAttributes = ReadonlyMap<string, RValue>;

/** Shared fields for immutable atomic vectors. */
export interface RVectorBase {
  readonly attributes: RAttributes;
  readonly length: number;
  readonly missing?: Uint8Array;
}

/** A logical vector with 0/1 values and an independent missing mask. */
export interface RLogicalVector extends RVectorBase {
  readonly type: "logical";
  readonly values: Uint8Array;
  readonly missing?: Uint8Array;
}

/** A signed 32-bit integer vector. */
export interface RIntegerVector extends RVectorBase {
  readonly type: "integer";
  readonly values: Int32Array;
  readonly missing?: Uint8Array;
}

/** A double vector that keeps ordinary NaN distinct from R NA. */
export interface RDoubleVector extends RVectorBase {
  readonly type: "double";
  readonly values: Float64Array;
  readonly missing?: Uint8Array;
}

/** A complex vector stored as parallel real and imaginary double arrays. */
export interface RComplexVector extends RVectorBase {
  readonly type: "complex";
  readonly real: Float64Array;
  readonly imaginary: Float64Array;
  readonly missing?: Uint8Array;
}

/** A byte vector. Raw values never carry R missing values. */
export interface RRawVector extends RVectorBase {
  readonly type: "raw";
  readonly values: Uint8Array;
}

/** A character vector with an independent missing mask. */
export type RCharacterEncoding = "unknown" | "latin1" | "UTF-8" | "bytes";

export interface RCharacterVector extends RVectorBase {
  readonly type: "character";
  readonly values: readonly string[];
  readonly missing?: Uint8Array;
  /** Per-element declared encoding marks; ASCII and missing strings are always `unknown`. */
  readonly encodings: readonly RCharacterEncoding[];
  /** Exact encoded bytes retained across declarative encoding changes and serialization. */
  readonly byteValues: readonly Uint8Array[];
}

/** The singleton R NULL value. */
export interface RNull {
  readonly type: "null";
}

/** A generic R list used internally and by future language features. */
export interface RList extends RVectorBase {
  readonly type: "list";
  readonly values: readonly RValue[];
  /** Internal distinction matching R's compact automatic data-frame row names. */
  readonly automaticRowNames?: boolean;
}

/** A dotted-pair sequence kept distinct from ordinary vector/list storage. */
export interface RPairlist extends RVectorBase {
  readonly type: "pairlist";
  readonly values: readonly RValue[];
}

/** Any indexable one-dimensional R value supported by the runtime. */
export type RVector =
  | RLogicalVector
  | RIntegerVector
  | RDoubleVector
  | RComplexVector
  | RRawVector
  | RCharacterVector
  | RList;

/** A lexical environment with mutable bindings and an immutable parent link. */
export interface REnvironment {
  readonly type: "environment";
  readonly id: number;
  readonly parent: REnvironment | null;
  /** Whether unordered binding enumeration follows hashed-environment insertion order. */
  readonly hashed: boolean;
  readonly bindings: Map<string, RBinding>;
}

/** A user-defined closure. */
export interface RClosure {
  readonly type: "closure";
  readonly parameters: readonly FunctionParameter[];
  readonly body: AstNode;
  readonly environment: REnvironment;
}

/** A normalized, intentionally small formula value independent of parser internals. */
export interface RFormula {
  readonly type: "formula";
  readonly response?: string;
  readonly terms: readonly string[];
  readonly variables: readonly string[];
  readonly intercept: boolean;
  readonly environment: REnvironment | null;
}

/** An interned-style R name represented independently from JavaScript identifiers. */
export interface RSymbol {
  readonly type: "symbol";
  readonly name: string;
}

/** A quoted normalized NativR expression. */
export interface RLanguage {
  readonly type: "language";
  readonly expression: AstNode;
}

/** An R expression vector containing unevaluated normalized syntax. */
export interface RExpression {
  readonly type: "expression";
  readonly values: readonly AstNode[];
}

/** A lazily evaluated, memoized argument. */
export interface RPromise {
  readonly type: "promise";
  readonly expression: AstNode | null;
  readonly environment: REnvironment;
  /** Whether this promise originated from an omitted actual argument. */
  readonly missing: boolean;
  state: "unforced" | "forcing" | "forced";
  value: RValue | undefined;
}

/** Lazily forwarded ellipsis arguments inside one closure frame. */
export interface RDots {
  readonly type: "dots";
  readonly arguments: readonly BuiltinCallArgument[];
}

/** One call argument passed to a registered builtin. */
export interface BuiltinCallArgument {
  readonly name?: string;
  readonly promise: RPromise;
}

/** Metadata used for capability reporting and compatibility review. */
export interface BuiltinMetadata {
  readonly package: string;
  readonly name: string;
  readonly compatibilityLevel: "api" | "shape" | "numeric" | "behavioral";
  readonly referenceVersion?: string;
  readonly supportedArguments: readonly string[];
  readonly unsupportedBehavior?: readonly string[];
}

/** Data-only URL connection request delegated to an explicitly configured host. */
export interface RUrlRequest {
  readonly url: string;
  readonly method: "default" | "internal" | "libcurl" | "wininet";
  readonly headers: readonly { readonly name: string; readonly value: string }[];
}

/** Bounded response bytes returned by the URL connection host. */
export interface RUrlResult {
  readonly body: Uint8Array;
}

/** Builtin execution kind. */
export type BuiltinKind = "regular" | "special" | "primitive";

/** Operations made available to a builtin for one call. */
export interface BuiltinInvocation {
  readonly arguments: readonly BuiltinCallArgument[];
  readonly context: OperatorContext;
  readonly state: Map<string, unknown>;
  /** Stable positive identity for this evaluator session; it is not a host operating-system PID. */
  readonly sessionProcessId: number;
  memoryStatistics(reset: boolean, full: boolean): RuntimeMemoryStatistics;
  setResultVisibility(visibility: "visible" | "invisible"): void;
  force(promise: RPromise): Promise<RValue>;
  forceDetailed(promise: RPromise): Promise<{ readonly value: RValue; readonly visible: boolean }>;
  invoke(
    callable: RValue,
    arguments_: readonly { readonly name?: string; readonly value: RValue }[],
  ): Promise<RValue>;
  invokeDetailed(
    callable: RValue,
    arguments_: readonly { readonly name?: string; readonly value: RValue }[],
  ): Promise<{ readonly value: RValue; readonly visible: boolean }>;
  invokeLazy(callable: RValue, arguments_: readonly BuiltinCallArgument[]): Promise<RValue>;
  parse(source: string, maxExpressions?: number): ProgramNode;
  evaluate(value: RValue, environment: REnvironment): Promise<RValue>;
  evaluateDetailed(
    value: RValue,
    environment: REnvironment,
  ): Promise<{ readonly value: RValue; readonly visible: boolean }>;
  signalCondition(classes: readonly string[], condition: RValue): Promise<void>;
  configureOnExit(
    expression: AstNode | null,
    environment: REnvironment,
    add: boolean,
    after: boolean,
  ): void;
  isGlobalEnvironment(environment: REnvironment): boolean;
  currentEnvironment(): REnvironment;
  parentFrame(offset: number): REnvironment;
  currentCall(): RLanguage | RNull;
  systemCall(which: number): RLanguage | RNull;
  isInteractive(): boolean;
  readline(prompt: string): Promise<string>;
  urlRequest(request: RUrlRequest): Promise<RUrlResult>;
  systemCommand(request: RSystemCommandRequest): Promise<RSystemCommandResult>;
  searchPath(): readonly string[];
  libraryPaths(): readonly string[];
  setLibraryPaths(paths: readonly string[]): void;
  searchEnvironment(identifier: number | string): REnvironment | undefined;
  environmentName(environment: REnvironment): string | undefined;
  loadPackage(
    name: string,
    attach: boolean,
    libraryPaths?: readonly string[],
  ): Promise<{ readonly name: string; readonly version: string }>;
  installedPackageVersion(name: string, libraryPaths?: readonly string[]): string | undefined;
  installedPackageDescription(
    name: string,
    libraryPaths?: readonly string[],
  ):
    | {
        readonly fields: readonly { readonly name: string; readonly value: string }[];
        readonly file: string;
      }
    | undefined;
  installedPackageNames(libraryPaths?: readonly string[]): readonly string[];
  isNamespaceLoaded(name: string): boolean;
  loadedNamespaces(): readonly string[];
  namespaceExports(name: string): Promise<readonly string[]>;
  packageResourcePath(
    name: string,
    path: string,
    libraryPaths?: readonly string[],
  ): string | undefined;
  packageResourcePaths(name: string, prefix: string): readonly string[] | undefined;
  packageFile(path: string):
    | {
        readonly encoding: "text" | "base64";
        readonly data: string;
        readonly textEncoding: "utf8" | "latin1";
      }
    | undefined;
  packageName(environment: REnvironment): string | undefined;
  globalEnvironment(): REnvironment;
  baseEnvironment(): REnvironment;
  emptyEnvironment(): REnvironment;
  matchCall(expandDots: boolean): RLanguage;
  callerFormalDefault(name: string): Promise<RValue | undefined>;
  define(name: string, value: RValue): void;
  registerS3Method(
    generic: string,
    className: string,
    method: RValue,
    environment: REnvironment,
  ): Promise<void>;
  dispatchS3(generic: string, object?: RValue): Promise<RValue>;
  dispatchS3IfPresent(
    generic: string,
    object: RValue,
    arguments_: readonly BuiltinCallArgument[],
    includeDefault?: boolean,
  ): Promise<RValue | undefined>;
  nextMethod(generic?: string): Promise<RValue>;
}

/** One row of browser-owned memory statistics exposed through base::gc(). */
export interface RuntimeMemoryAreaStatistics {
  readonly used: number;
  readonly trigger: number;
  readonly maxUsed: number;
}

/** A deterministic census of the runtime-owned R graph, never the host JavaScript heap. */
export interface RuntimeMemoryStatistics {
  readonly nodeCells: RuntimeMemoryAreaStatistics;
  readonly vectorCells: RuntimeMemoryAreaStatistics;
  readonly collection: number;
  readonly fullCollections: number;
  readonly level: 0 | 2;
}

/** One independently registered base-language builtin. */
export interface BuiltinDefinition {
  readonly package: string;
  readonly name: string;
  readonly kind: BuiltinKind;
  /** Optional R-level formals for builtins that model an ordinary closure. */
  readonly formals?: readonly FunctionParameter[];
  readonly resultVisibility?: "visible" | "invisible";
  readonly metadata: BuiltinMetadata;
  implementation(invocation: BuiltinInvocation): RValue | Promise<RValue>;
}

/** A builtin installed as a first-class runtime value. */
export interface RBuiltin {
  readonly type: "builtin";
  readonly definition: BuiltinDefinition;
}

/** A cancellation flag shared by evaluator and reference operators. */
export interface CancellationToken {
  readonly cancelled: boolean;
}

/** Configurable safety limits for one runtime session. */
export interface RuntimeLimits {
  readonly maxSteps: number;
  readonly maxCallDepth: number;
  readonly maxVectorLength: number;
  readonly maxOutputBytes: number;
}

/** A structured warning collected in evaluation order. */
export interface RWarning {
  readonly code: string;
  readonly message: string;
  readonly span?: SourceSpan;
  readonly call?: string;
}

/** Text emitted by an evaluation without depending on a host console. */
export interface ROutput {
  readonly stream: "stdout" | "stderr" | "message";
  readonly text: string;
}

/** One explicit request to an embedding host for an operating-system command. */
export interface RSystemCommandRequest {
  readonly command: string;
  readonly intern: boolean;
  readonly ignoreStdout: boolean;
  readonly ignoreStderr: boolean;
  readonly wait: boolean;
  readonly input: readonly string[] | null;
  readonly showOutputOnConsole: boolean;
  readonly minimized: boolean;
  readonly invisible: boolean;
  readonly timeoutSeconds: number;
  readonly receiveConsoleSignals: boolean;
}

/** Sanitized command outcome supplied by an embedding host. */
export interface RSystemCommandResult {
  readonly status: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly errorMessage?: string;
  readonly failedToStart?: boolean;
  readonly timedOut?: boolean;
}

/** One character-formatted column sent to a host data viewer. */
export interface RDataViewColumn {
  readonly name: string;
  readonly values: readonly string[];
}

/** Spreadsheet-style data emitted without depending on a DOM or desktop viewer. */
export interface RDataViewEvent {
  readonly title: string;
  readonly columns: readonly RDataViewColumn[];
  readonly rowNames?: readonly string[];
}

/** One browser-navigation request emitted for an explicit host decision. */
export type RBrowseEvent =
  | {
      readonly kind: "url";
      readonly url: string;
    }
  | {
      readonly kind: "file";
      /** Canonical browser-memory path retained for diagnostics and filenames. */
      readonly url: string;
      readonly mimeType: string;
      /** Immutable snapshot of the virtual file at evaluation time. */
      readonly bytes: Uint8Array;
    };

/** One resolved, device-independent line segment. */
export interface RGraphicsSegment {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** CSS-compatible #RRGGBBAA color resolved before crossing the host boundary. */
  readonly color: string;
  /** A normalized R line-type pattern: solid or an even-length hexadecimal dash sequence. */
  readonly lineType: string;
  readonly lineWidth: number;
}

/** One resolved point symbol sent to a browser graphics host. */
export interface RGraphicsPoint {
  readonly x: number;
  readonly y: number;
  /** An R plotting-symbol code or one literal Unicode character. */
  readonly symbol: number | string;
  /** CSS-compatible #RRGGBBAA border/text color resolved before crossing the host boundary. */
  readonly color: string;
  /** CSS-compatible #RRGGBBAA fill color for symbols 21 through 25. */
  readonly fill: string;
  /** Device-independent `cex` multiplier interpreted by the browser renderer. */
  readonly size: number;
  readonly lineWidth: number;
}

/** One resolved text label sent to a browser graphics host. */
export interface RGraphicsText {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  /** CSS-compatible #RRGGBBAA color resolved before crossing the host boundary. */
  readonly color: string;
  /** Device-independent `cex` multiplier interpreted by the browser renderer. */
  readonly size: number;
  /** R's plain, bold, italic, or bold-italic font face code. */
  readonly font: 1 | 2 | 3 | 4;
  readonly family: string;
  /** Counter-clockwise rotation in degrees. */
  readonly rotation: number;
  readonly horizontalAdjustment: number;
  readonly verticalAdjustment: number;
  readonly position?: 1 | 2 | 3 | 4;
  /** Character-width offset used when `position` is present. */
  readonly offset: number;
}

/** One resolved closed polygon sent to a browser graphics host. */
export interface RGraphicsPolygon {
  readonly x: readonly number[];
  readonly y: readonly number[];
  /** CSS-compatible #RRGGBBAA solid fill color. */
  readonly fill: string;
  /** CSS-compatible #RRGGBBAA border color. */
  readonly border: string;
  /** A normalized R line-type pattern, including `blank`. */
  readonly lineType: string;
  readonly lineWidth: number;
  readonly fillRule: "nonzero" | "evenodd";
}

/** One resolved box-and-whisker group sent to a browser graphics host. */
export interface RGraphicsBoxplotGroup {
  readonly label: string;
  readonly center: number;
  readonly width: number;
  readonly stats: readonly [number, number, number, number, number];
  readonly confidence: readonly [number, number];
  readonly outliers: readonly number[];
  readonly border: string;
  readonly fill: string;
  readonly lineType: string;
  readonly lineWidth: number;
}

/** One resolved legend row sent to a browser graphics host. */
export interface RGraphicsLegendEntry {
  readonly label: string;
  readonly textColor: string;
  readonly color: string;
  readonly lineType?: string;
  readonly lineWidth?: number;
  readonly pointSymbol?: string;
}

/** A device-independent legend anchor. */
export type RGraphicsLegendPosition =
  | {
      readonly kind: "keyword";
      readonly value:
        | "bottomright"
        | "bottom"
        | "bottomleft"
        | "left"
        | "topleft"
        | "top"
        | "topright"
        | "right"
        | "center";
      readonly inset: readonly [number, number];
    }
  | { readonly kind: "coordinates"; readonly x: number; readonly y: number };

/** Device-independent graphics commands collected for a browser host. */
export type RGraphicsEvent =
  | { readonly kind: "new-page" }
  | {
      readonly kind: "window";
      readonly xlim: readonly [number, number];
      readonly ylim: readonly [number, number];
    }
  | {
      readonly kind: "raster";
      readonly rgba: Uint8Array;
      readonly width: number;
      readonly height: number;
      readonly xleft: number;
      readonly ybottom: number;
      readonly xright: number;
      readonly ytop: number;
      readonly angle: number;
      readonly interpolate: boolean;
    }
  | {
      readonly kind: "segments";
      readonly segments: readonly RGraphicsSegment[];
    }
  | {
      readonly kind: "points";
      readonly points: readonly RGraphicsPoint[];
    }
  | {
      readonly kind: "text";
      readonly labels: readonly RGraphicsText[];
    }
  | {
      readonly kind: "polygon";
      readonly polygons: readonly RGraphicsPolygon[];
    }
  | {
      readonly kind: "box";
      readonly edges: readonly ("top" | "right" | "bottom" | "left")[];
      /** CSS-compatible #RRGGBBAA color resolved before crossing the host boundary. */
      readonly color: string;
      /** A normalized R line-type pattern: solid or an even-length hexadecimal dash sequence. */
      readonly lineType: string;
      readonly lineWidth: number;
    }
  | {
      readonly kind: "boxplot";
      readonly horizontal: boolean;
      readonly notch: boolean;
      readonly groups: readonly RGraphicsBoxplotGroup[];
    }
  | {
      readonly kind: "legend";
      readonly position: RGraphicsLegendPosition;
      readonly entries: readonly RGraphicsLegendEntry[];
      readonly box: boolean;
      readonly background: string;
      readonly columns: number;
      readonly cex: number;
      readonly title?: string;
    };

/** Context exposed to deterministic computational operators. */
export interface OperatorContext {
  readonly limits: RuntimeLimits;
  readonly cancellation: CancellationToken;
  warn(warning: RWarning): void;
  writeOutput(output: ROutput): void;
  beginOutputCapture(streams: readonly ROutput["stream"][]): void;
  endOutputCapture(): readonly ROutput[];
  writeDataView(event: RDataViewEvent): void;
  writeBrowse(event: RBrowseEvent): void;
  writeGraphics(event: RGraphicsEvent): void;
  pushWarningSuppression(): void;
  popWarningSuppression(): void;
  isWarningSuppressed(): boolean;
  pushOutputSuppression(stream: ROutput["stream"]): void;
  popOutputSuppression(stream: ROutput["stream"]): void;
  isOutputSuppressed(stream: ROutput["stream"]): boolean;
  checkpoint(cost?: number): void;
  allocate(elements: number): void;
}

/** Session-state slot shared by the evaluator and the base condition builtins. */
export const GLOBAL_CALLING_HANDLERS_STATE_KEY = "runtime.globalCallingHandlers";

/** Replaceable arithmetic seam implemented by the JavaScript reference backend. */
export interface RuntimeOperators {
  unary(context: OperatorContext, operator: string, value: RValue): RValue;
  binary(context: OperatorContext, operator: string, left: RValue, right: RValue): RValue;
}

/** All ordinary runtime values. Promises appear only in bindings and call frames. */
export type RValue =
  | RNull
  | RLogicalVector
  | RIntegerVector
  | RDoubleVector
  | RComplexVector
  | RRawVector
  | RCharacterVector
  | RList
  | RPairlist
  | RFormula
  | RSymbol
  | RLanguage
  | RExpression
  | REnvironment
  | RClosure
  | RDots
  | RBuiltin;

/** An environment binding is either an ordinary value or a lazy promise. */
export type RBinding = RValue | RPromise;

/** The R NULL singleton. */
export const R_NULL: RNull = Object.freeze({ type: "null" });

const EMPTY_ATTRIBUTES: RAttributes = new Map();

/** Construct and validate an immutable logical vector. */
export function logicalVector(
  values: ArrayLike<number | boolean>,
  missing?: ArrayLike<number>,
): RLogicalVector {
  const storage = Uint8Array.from(values, (value) => (value === true || value === 1 ? 1 : 0));
  return withMask({ type: "logical", values: storage, length: storage.length }, missing);
}

/** Construct and validate an immutable integer vector. */
export function integerVector(
  values: ArrayLike<number>,
  missing?: ArrayLike<number>,
): RIntegerVector {
  const storage = Int32Array.from(values);
  return withMask({ type: "integer", values: storage, length: storage.length }, missing);
}

/** Construct and validate an immutable double vector. */
export function doubleVector(
  values: ArrayLike<number>,
  missing?: ArrayLike<number>,
): RDoubleVector {
  const storage = Float64Array.from(values);
  return withMask({ type: "double", values: storage, length: storage.length }, missing);
}

/** Construct and validate an immutable complex vector. */
export function complexVector(
  real: ArrayLike<number>,
  imaginary: ArrayLike<number>,
  missing?: ArrayLike<number>,
): RComplexVector {
  const realStorage = Float64Array.from(real);
  const imaginaryStorage = Float64Array.from(imaginary);
  if (realStorage.length !== imaginaryStorage.length) {
    throw new RTypeMismatchError("NRT3012", "Complex real and imaginary arrays must match.");
  }
  return withMask(
    {
      type: "complex",
      real: realStorage,
      imaginary: imaginaryStorage,
      length: realStorage.length,
    },
    missing,
  );
}

/** Construct an immutable raw byte vector. */
export function rawVector(values: ArrayLike<number>): RRawVector {
  const storage = Uint8Array.from(values);
  return { type: "raw", values: storage, length: storage.length, attributes: EMPTY_ATTRIBUTES };
}

/** Construct and validate an immutable character vector. */
export function characterVector(
  values: readonly string[],
  missing?: ArrayLike<number>,
  encodings?: readonly RCharacterEncoding[],
  byteValues?: readonly Uint8Array[],
): RCharacterVector {
  const storage = Object.freeze([...values]);
  if (encodings !== undefined && encodings.length !== storage.length) {
    throw new RTypeMismatchError("NRT3013", "Character encodings must match vector length.", {
      details: { vectorLength: storage.length, encodingLength: encodings.length },
    });
  }
  if (byteValues !== undefined && byteValues.length !== storage.length) {
    throw new RTypeMismatchError("NRT3013", "Character byte values must match vector length.", {
      details: { vectorLength: storage.length, byteValueLength: byteValues.length },
    });
  }
  const mask =
    missing === undefined ? undefined : Uint8Array.from(missing, (value) => (value ? 1 : 0));
  if (mask !== undefined && mask.length !== storage.length) {
    throw new RTypeMismatchError("NRT3001", "A missing mask must match vector length.", {
      details: { vectorLength: storage.length, maskLength: mask.length },
    });
  }
  const marks = Object.freeze(
    storage.map((value, index): RCharacterEncoding => {
      if (mask?.[index] === 1 || isAsciiString(value)) return "unknown";
      return encodings?.[index] ?? "UTF-8";
    }),
  );
  const bytes = Object.freeze(
    storage.map((value, index) => {
      if (mask?.[index] === 1) return new Uint8Array();
      const supplied = byteValues?.[index];
      if (supplied !== undefined) return Uint8Array.from(supplied);
      return characterBytesFromValue(value, marks[index] ?? "unknown");
    }),
  );
  return {
    type: "character",
    values: storage,
    encodings: marks,
    byteValues: bytes,
    length: storage.length,
    ...(mask === undefined ? {} : { missing: mask }),
    attributes: EMPTY_ATTRIBUTES,
  };
}

/** Read one canonical declared encoding mark. */
export function characterEncodingAt(value: RCharacterVector, index: number): RCharacterEncoding {
  return value.encodings[index] ?? "unknown";
}

/** Return a defensive copy of one string's exact encoded bytes. */
export function characterBytesAt(value: RCharacterVector, index: number): Uint8Array {
  return Uint8Array.from(value.byteValues[index] ?? new Uint8Array());
}

/** Encode one semantic string under the browser runtime's owned UTF-8/single-byte model. */
export function characterBytesFromValue(
  value: string,
  encoding: RCharacterEncoding = "unknown",
): Uint8Array {
  if (encoding === "latin1" || encoding === "bytes") return encodeSingleByteString(value);
  const Encoder = (
    globalThis as unknown as {
      readonly TextEncoder: new () => { readonly encode: (input: string) => Uint8Array };
    }
  ).TextEncoder;
  return new Encoder().encode(value);
}

/** Interpret exact bytes under one of R's declared encoding marks in the browser's UTF-8 locale. */
export function characterValueFromBytes(bytes: Uint8Array, encoding: RCharacterEncoding): string {
  if (encoding === "latin1" || encoding === "bytes") {
    let output = "";
    for (let offset = 0; offset < bytes.length; offset += 8_192) {
      output += String.fromCodePoint(...bytes.subarray(offset, offset + 8_192));
    }
    return output;
  }
  const Decoder = (
    globalThis as unknown as {
      readonly TextDecoder: new (
        label: string,
        options: { readonly fatal: boolean },
      ) => { readonly decode: (input: Uint8Array) => string };
    }
  ).TextDecoder;
  return new Decoder("utf-8", { fatal: false }).decode(bytes);
}

function isAsciiString(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) return false;
  }
  return true;
}

function encodeSingleByteString(value: string): Uint8Array {
  return Uint8Array.from(Array.from(value, (character) => character.codePointAt(0) ?? 0));
}

/** Construct an immutable R list with optional exact element names. */
export function listValue(values: readonly RValue[], names?: readonly string[]): RList {
  const list: RList = {
    type: "list",
    values: Object.freeze([...values]),
    length: values.length,
    attributes: EMPTY_ATTRIBUTES,
  };
  return names === undefined ? list : withNames(list, names);
}

/** Construct an immutable pairlist with optional exact tag names. */
export function pairlistValue(values: readonly RValue[], names?: readonly string[]): RPairlist {
  const pairlist: RPairlist = {
    type: "pairlist",
    values: Object.freeze([...values]),
    length: values.length,
    attributes: EMPTY_ATTRIBUTES,
  };
  return names === undefined ? pairlist : withNames(pairlist, names);
}

/** Construct the documented data-frame subset as a named list of equal-length columns. */
export function dataFrameValue(
  columns: readonly RVector[],
  names: readonly string[],
  rowNames: readonly string[],
  automaticRowNames = false,
): RList {
  const list = listValue(columns, names);
  const attributes = new Map(list.attributes);
  attributes.set("class", characterVector(["data.frame"]));
  attributes.set("row.names", characterVector(rowNames));
  return { ...list, attributes, automaticRowNames };
}

/** Construct an integer factor with exact levels and optional ordering. */
export function factorValue(
  codes: ArrayLike<number>,
  levels: readonly string[],
  missing?: ArrayLike<number>,
  ordered = false,
): RIntegerVector {
  const value = integerVector(codes, missing);
  const attributes = new Map(value.attributes);
  attributes.set("levels", characterVector(levels));
  attributes.set("class", characterVector(ordered ? ["ordered", "factor"] : ["factor"]));
  return { ...value, attributes };
}

/** Return true when a vector element is an explicit R missing value. */
export function isMissing(value: RVectorBase, index: number): boolean {
  return value.missing?.[index] === 1;
}

/** Return true for atomic vector values. */
export function isAtomic(
  value: RValue,
): value is
  RLogicalVector | RIntegerVector | RDoubleVector | RComplexVector | RRawVector | RCharacterVector {
  return (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "complex" ||
    value.type === "raw" ||
    value.type === "character"
  );
}

/** Return true for an atomic vector or list. */
export function isVector(value: RValue): value is RVector {
  return isAtomic(value) || value.type === "list";
}

/** Return true for values created by the NativR data-frame constructor. */
export function isDataFrame(value: RValue): value is RList {
  if (value.type !== "list") return false;
  const classes = value.attributes.get("class");
  const rowNames = value.attributes.get("row.names");
  return (
    classes?.type === "character" &&
    classes.values.includes("data.frame") &&
    rowNames?.type === "character"
  );
}

/** Return true for integer vectors carrying the factor class and levels. */
export function isFactor(value: RValue): value is RIntegerVector {
  if (value.type !== "integer") return false;
  const classes = value.attributes.get("class");
  const levels = value.attributes.get("levels");
  return (
    classes?.type === "character" &&
    classes.values.includes("factor") &&
    levels?.type === "character" &&
    levels.missing === undefined
  );
}

/** Read exact factor levels. */
export function factorLevels(value: RIntegerVector): readonly string[] {
  if (!isFactor(value)) {
    throw new RTypeMismatchError("NRT3008", "The value is not a factor.");
  }
  const levels = value.attributes.get("levels");
  return levels?.type === "character" ? levels.values : [];
}

/** Read the validated row count of a NativR data frame. */
export function dataFrameRowCount(value: RList): number {
  if (!isDataFrame(value)) {
    throw new RTypeMismatchError("NRT3007", "The value is not a data frame.");
  }
  const rowNames = value.attributes.get("row.names");
  return rowNames?.type === "character" ? rowNames.length : 0;
}

/** Read an exact, non-missing names attribute when present. */
export function vectorNames(value: RVector | RPairlist): readonly string[] | undefined {
  const names = value.attributes.get("names");
  if (names === undefined) return undefined;
  if (names.type !== "character" || names.length !== value.length || names.missing !== undefined) {
    throw new RTypeMismatchError("NRT3003", "The names attribute is malformed.", {
      details: { valueLength: value.length },
    });
  }
  return names.values;
}

/** Read validated dimensions from a vector when present. */
export function vectorDimensions(value: RVector | RPairlist): readonly number[] | undefined {
  const dimensions = value.attributes.get("dim");
  if (dimensions === undefined) return undefined;
  if (dimensions.type !== "integer" || dimensions.missing !== undefined) {
    throw new RTypeMismatchError("NRT3005", "The dim attribute is malformed.");
  }
  const values = [...dimensions.values];
  if (
    values.some((dimension) => dimension < 0) ||
    values.reduce((product, dimension) => product * dimension, 1) !== value.length
  ) {
    throw new RTypeMismatchError("NRT3005", "Dimensions must be non-negative and match length.", {
      details: { valueLength: value.length, dimensions: values },
    });
  }
  return values;
}

/** Read exact class names from a vector when present. */
export function vectorClasses(value: RVector | RPairlist): readonly string[] | undefined {
  const classes = value.attributes.get("class");
  if (classes === undefined) return undefined;
  if (classes.type !== "character" || classes.missing !== undefined) {
    throw new RTypeMismatchError("NRT3009", "The class attribute is malformed.");
  }
  return classes.values;
}

/** Return an immutable vector clone with an exact names attribute. */
export function withNames<T extends RVector | RPairlist>(value: T, names: readonly string[]): T {
  if (names.length !== value.length) {
    throw new RTypeMismatchError("NRT3004", "Names must match vector length.", {
      details: { valueLength: value.length, namesLength: names.length },
    });
  }
  const attributes = new Map(value.attributes);
  attributes.set("names", characterVector(names));
  return { ...value, attributes };
}

/** Return an immutable vector clone with validated dimensions. */
export function withDimensions<T extends RVector | RPairlist>(
  value: T,
  dimensions: readonly number[],
): T {
  if (
    dimensions.length === 0 ||
    dimensions.some((dimension) => !Number.isInteger(dimension) || dimension < 0) ||
    dimensions.reduce((product, dimension) => product * dimension, 1) !== value.length
  ) {
    throw new RTypeMismatchError(
      "NRT3006",
      "Dimensions must be non-negative integers matching length.",
      { details: { valueLength: value.length, dimensions } },
    );
  }
  const attributes = new Map(value.attributes);
  attributes.set("dim", integerVector(dimensions));
  return { ...value, attributes };
}

/** Return an immutable vector clone with exact class names. */
export function withClasses<T extends RVector | RPairlist>(
  value: T,
  classes: readonly string[],
): T {
  if (classes.length === 0 || classes.some((className) => className === "")) {
    throw new RTypeMismatchError("NRT3010", "Class names must be non-empty.");
  }
  const attributes = new Map(value.attributes);
  attributes.set("class", characterVector(classes));
  return { ...value, attributes };
}

/** Return an immutable vector clone with one validated runtime attribute. */
export function withAttribute<T extends RVector | RPairlist>(
  value: T,
  name: string,
  attribute: RValue,
): T {
  if (name.length === 0) {
    throw new RTypeMismatchError("NRT3011", "Attribute names must be non-empty.");
  }
  const attributes = new Map(value.attributes);
  attributes.set(name, attribute);
  return {
    ...value,
    attributes,
    ...(value.type === "list" && name === "row.names" ? { automaticRowNames: false } : {}),
  };
}

/** Return an immutable vector clone without one named runtime attribute. */
export function withoutAttribute<T extends RVector | RPairlist>(value: T, name: string): T {
  if (!value.attributes.has(name)) return value;
  const attributes = new Map(value.attributes);
  attributes.delete(name);
  return { ...value, attributes };
}

/** Return an immutable vector clone without an explicit class attribute. */
export function withoutClasses<T extends RVector | RPairlist>(value: T): T {
  return withoutAttribute(value, "class");
}

/** Create a typed length-one missing vector. */
export function missingValue(
  type: "logical" | "integer" | "double" | "complex" | "character" = "logical",
): RLogicalVector | RIntegerVector | RDoubleVector | RComplexVector | RCharacterVector {
  switch (type) {
    case "logical":
      return logicalVector([0], [1]);
    case "integer":
      return integerVector([0], [1]);
    case "double":
      return doubleVector([0], [1]);
    case "complex":
      return complexVector([0], [0], [1]);
    case "character":
      return characterVector([""], [1]);
  }
}

function withMask<
  T extends
    | Omit<RLogicalVector, "attributes" | "missing">
    | Omit<RIntegerVector, "attributes" | "missing">
    | Omit<RDoubleVector, "attributes" | "missing">
    | Omit<RComplexVector, "attributes" | "missing">
    | Omit<RRawVector, "attributes" | "missing">
    | Omit<RCharacterVector, "attributes" | "missing">,
>(
  vector: T,
  missing: ArrayLike<number> | undefined,
): T & { readonly attributes: RAttributes; readonly missing?: Uint8Array } {
  if (missing === undefined) {
    return { ...vector, attributes: EMPTY_ATTRIBUTES };
  }
  const mask = Uint8Array.from(missing, (value) => (value === 0 ? 0 : 1));
  if (mask.length !== vector.length) {
    throw new RTypeMismatchError("NRT3001", "A missing mask must match vector length.", {
      details: { vectorLength: vector.length, maskLength: mask.length },
    });
  }
  return { ...vector, missing: mask, attributes: EMPTY_ATTRIBUTES };
}
import type { SourceSpan } from "@nativr/ast";
