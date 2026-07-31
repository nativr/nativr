/** Current Worker wire protocol version. */
export const PROTOCOL_VERSION = 1 as const;

/** Optional exact vector names transported alongside one-dimensional values. */
export interface RSnapshotNames {
  readonly names?: readonly string[];
  readonly dim?: readonly number[];
}

/** Atomic or list value schema transported through structured clone. */
export type RValueSnapshot =
  | { readonly version: 1; readonly type: "null" }
  | (RSnapshotNames & {
      readonly version: 1;
      readonly type: "logical";
      readonly values: Uint8Array;
      readonly missing?: Uint8Array;
    })
  | (RSnapshotNames & {
      readonly version: 1;
      readonly type: "integer";
      readonly values: Int32Array;
      readonly missing?: Uint8Array;
    })
  | (RSnapshotNames & {
      readonly version: 1;
      readonly type: "double";
      readonly values: Float64Array;
      readonly missing?: Uint8Array;
    })
  | (RSnapshotNames & {
      readonly version: 1;
      readonly type: "complex";
      readonly real: Float64Array;
      readonly imaginary: Float64Array;
      readonly missing?: Uint8Array;
    })
  | (RSnapshotNames & {
      readonly version: 1;
      readonly type: "raw";
      readonly values: Uint8Array;
    })
  | (RSnapshotNames & {
      readonly version: 1;
      readonly type: "character";
      readonly values: readonly string[];
      readonly missing?: Uint8Array;
    })
  | (RSnapshotNames & {
      readonly version: 1;
      readonly type: "list";
      readonly values: readonly RValueSnapshot[];
    })
  | (RSnapshotNames & {
      readonly version: 1;
      readonly type: "pairlist";
      readonly values: readonly RValueSnapshot[];
    })
  | {
      readonly version: 1;
      readonly type: "formula";
      readonly response?: string;
      readonly terms: readonly string[];
      readonly variables: readonly string[];
      readonly intercept: boolean;
    }
  | { readonly version: 1; readonly type: "symbol"; readonly name: string }
  | { readonly version: 1; readonly type: "language"; readonly source: string }
  | { readonly version: 1; readonly type: "expression"; readonly sources: readonly string[] };

/** Runtime limits repeated here to keep the wire package standalone. */
export interface ProtocolRuntimeLimits {
  readonly maxSteps: number;
  readonly maxCallDepth: number;
  readonly maxVectorLength: number;
  readonly maxOutputBytes: number;
}

/** A structured warning crossing the Worker boundary. */
export interface PublicRWarning {
  readonly code: string;
  readonly message: string;
  readonly span?: PublicSourceSpan;
  readonly call?: string;
}

/** Text emitted by an evaluation across inline and Worker hosts. */
export interface PublicOutputEvent {
  readonly stream: "stdout" | "stderr" | "message";
  readonly text: string;
}

/** Character-formatted table emitted for a browser or other host data viewer. */
export interface PublicDataViewEvent {
  readonly title: string;
  readonly columns: readonly {
    readonly name: string;
    readonly values: readonly string[];
  }[];
  readonly rowNames?: readonly string[];
}

/** Device-independent drawing command returned to a browser graphics host. */
export type PublicGraphicsEvent =
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
      readonly segments: readonly {
        readonly x0: number;
        readonly y0: number;
        readonly x1: number;
        readonly y1: number;
        /** CSS-compatible #RRGGBBAA color. */
        readonly color: string;
        /** `solid` or an even-length hexadecimal dash sequence. */
        readonly lineType: string;
        readonly lineWidth: number;
      }[];
    };

/** Source positions are wire-only plain records. */
export interface PublicSourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

/** A half-open source range. */
export interface PublicSourceSpan {
  readonly start: PublicSourcePosition;
  readonly end: PublicSourcePosition;
}

/** Serializable NativR error contract. */
export interface SerializedNativRError {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  readonly span?: PublicSourceSpan;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly stack?: string;
}

/** Capability status for one syntax family. */
export type SyntaxCapability = "supported" | "parsed" | "unsupported";

/** Machine-readable compatibility manifest. */
export interface CapabilityManifest {
  readonly nativrVersion: string;
  readonly protocolVersion: 1;
  readonly languageSubsetVersion: string;
  readonly syntax: Readonly<Record<string, SyntaxCapability>>;
  readonly packages: readonly {
    readonly name: string;
    readonly referenceVersion?: string;
    readonly functions: readonly {
      readonly name: string;
      readonly compatibility: "api" | "shape" | "numeric" | "behavioral";
    }[];
  }[];
  readonly backends: readonly string[];
}

/** Shared envelope for every request and response. */
export interface ProtocolEnvelope {
  readonly protocolVersion: 1;
  readonly id: string;
}

/** Worker initialization request. */
export interface InitRequest extends ProtocolEnvelope {
  readonly kind: "init";
  readonly assets: {
    readonly treeSitterRuntimeWasm: string;
    readonly rGrammarWasm: string;
  };
  readonly limits?: Partial<ProtocolRuntimeLimits>;
  readonly debug: boolean;
}

/** Evaluate source code. */
export interface EvalRequest extends ProtocolEnvelope {
  readonly kind: "eval";
  readonly code: string;
}

/** Assign one lossless runtime snapshot. */
export interface AssignRequest extends ProtocolEnvelope {
  readonly kind: "assign";
  readonly name: string;
  readonly value: RValueSnapshot;
}

/** Get one global binding. */
export interface GetRequest extends ProtocolEnvelope {
  readonly kind: "get";
  readonly name: string;
}

/** Call one named function with positional values. */
export interface CallRequest extends ProtocolEnvelope {
  readonly kind: "call";
  readonly name: string;
  readonly arguments: readonly RValueSnapshot[];
}

/** Query capabilities. */
export interface CapabilitiesRequest extends ProtocolEnvelope {
  readonly kind: "capabilities";
}

/** Reset mutable session state. */
export interface ResetRequest extends ProtocolEnvelope {
  readonly kind: "reset";
}

/** Dispose the runtime. */
export interface DisposeRequest extends ProtocolEnvelope {
  readonly kind: "dispose";
}

/** All valid Worker requests. */
export type WorkerRequest =
  | InitRequest
  | EvalRequest
  | AssignRequest
  | GetRequest
  | CallRequest
  | CapabilitiesRequest
  | ResetRequest
  | DisposeRequest;

/** Evaluation data returned internally to the public facade. */
export interface WireEvaluationResult {
  readonly raw: RValueSnapshot;
  readonly visible: boolean;
  readonly warnings: readonly PublicRWarning[];
  readonly output?: readonly PublicOutputEvent[];
  readonly dataViews?: readonly PublicDataViewEvent[];
  readonly graphics?: readonly PublicGraphicsEvent[];
  readonly elapsedMs: number;
  readonly runtimeReset: boolean;
}

/** Success payloads keyed by their originating operation. */
export type WorkerSuccessPayload =
  | { readonly kind: "ready" }
  | { readonly kind: "evaluation"; readonly result: WireEvaluationResult }
  | { readonly kind: "value"; readonly value: RValueSnapshot }
  | { readonly kind: "capabilities"; readonly value: CapabilityManifest }
  | { readonly kind: "void" };

/** A correlated successful response. */
export interface SuccessResponse extends ProtocolEnvelope {
  readonly kind: "success";
  readonly payload: WorkerSuccessPayload;
}

/** A correlated failed response. */
export interface ErrorResponse extends ProtocolEnvelope {
  readonly kind: "error";
  readonly error: SerializedNativRError;
}

/** A warning event emitted before the final response. */
export interface WarningEvent extends ProtocolEnvelope {
  readonly kind: "warning";
  readonly warning: PublicRWarning;
}

/** Future-ready textual output event. */
export interface OutputEvent extends ProtocolEnvelope, PublicOutputEvent {
  readonly kind: "output";
}

/** All valid Worker responses and events. */
export type WorkerResponse = SuccessResponse | ErrorResponse | WarningEvent | OutputEvent;

/** Guard a finite protocol request before dispatch. */
export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (!isEnvelope(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "init":
      return (
        isRecord(value.assets) &&
        typeof value.assets.treeSitterRuntimeWasm === "string" &&
        typeof value.assets.rGrammarWasm === "string" &&
        typeof value.debug === "boolean"
      );
    case "eval":
      return typeof value.code === "string";
    case "assign":
      return typeof value.name === "string" && isRValueSnapshot(value.value);
    case "get":
      return typeof value.name === "string";
    case "call":
      return (
        typeof value.name === "string" &&
        Array.isArray(value.arguments) &&
        value.arguments.every(isRValueSnapshot)
      );
    case "capabilities":
    case "reset":
    case "dispose":
      return true;
    default:
      return false;
  }
}

/** Guard a finite protocol response before resolving client promises. */
export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isEnvelope(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "success":
      return isRecord(value.payload) && typeof value.payload.kind === "string";
    case "error":
      return (
        isRecord(value.error) &&
        typeof value.error.name === "string" &&
        typeof value.error.code === "string" &&
        typeof value.error.message === "string"
      );
    case "warning":
      return (
        isRecord(value.warning) &&
        typeof value.warning.code === "string" &&
        typeof value.warning.message === "string"
      );
    case "output":
      return typeof value.text === "string" && typeof value.stream === "string";
    default:
      return false;
  }
}

/** Guard a lossless snapshot before reconstructing runtime values. */
export function isRValueSnapshot(value: unknown): value is RValueSnapshot {
  if (!isRecord(value) || value.version !== 1 || typeof value.type !== "string") return false;
  switch (value.type) {
    case "null":
      return true;
    case "logical":
      return (
        value.values instanceof Uint8Array &&
        validMask(value.missing, value.values.length) &&
        validNames(value.names, value.values.length) &&
        validDimensions(value.dim, value.values.length)
      );
    case "integer":
      return (
        value.values instanceof Int32Array &&
        validMask(value.missing, value.values.length) &&
        validNames(value.names, value.values.length) &&
        validDimensions(value.dim, value.values.length)
      );
    case "double":
      return (
        value.values instanceof Float64Array &&
        validMask(value.missing, value.values.length) &&
        validNames(value.names, value.values.length) &&
        validDimensions(value.dim, value.values.length)
      );
    case "complex":
      return (
        value.real instanceof Float64Array &&
        value.imaginary instanceof Float64Array &&
        value.real.length === value.imaginary.length &&
        validMask(value.missing, value.real.length) &&
        validNames(value.names, value.real.length) &&
        validDimensions(value.dim, value.real.length)
      );
    case "raw":
      return (
        value.values instanceof Uint8Array &&
        validNames(value.names, value.values.length) &&
        validDimensions(value.dim, value.values.length)
      );
    case "character":
      return (
        Array.isArray(value.values) &&
        value.values.every((item) => typeof item === "string") &&
        validMask(value.missing, value.values.length) &&
        validNames(value.names, value.values.length) &&
        validDimensions(value.dim, value.values.length)
      );
    case "list":
      return (
        Array.isArray(value.values) &&
        value.values.every(isRValueSnapshot) &&
        validNames(value.names, value.values.length) &&
        validDimensions(value.dim, value.values.length)
      );
    case "pairlist":
      return (
        Array.isArray(value.values) &&
        value.values.every(isRValueSnapshot) &&
        validNames(value.names, value.values.length) &&
        validDimensions(value.dim, value.values.length)
      );
    case "formula":
      return (
        (value.response === undefined || validFormulaName(value.response)) &&
        Array.isArray(value.terms) &&
        value.terms.every(validFormulaName) &&
        new Set(value.terms).size === value.terms.length &&
        Array.isArray(value.variables) &&
        value.variables.every(validFormulaName) &&
        new Set(value.variables).size === value.variables.length &&
        typeof value.intercept === "boolean"
      );
    case "symbol":
      return typeof value.name === "string" && value.name.length > 0;
    case "language":
      return typeof value.source === "string" && value.source.length > 0;
    case "expression":
      return (
        Array.isArray(value.sources) && value.sources.every((item) => typeof item === "string")
      );
    default:
      return false;
  }
}

function isEnvelope(value: unknown): value is Record<string, unknown> & ProtocolEnvelope {
  return (
    isRecord(value) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    typeof value.id === "string" &&
    value.id.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validMask(value: unknown, length: number): boolean {
  return value === undefined || (value instanceof Uint8Array && value.length === length);
}

function validNames(value: unknown, length: number): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length === length &&
      value.every((item) => typeof item === "string"))
  );
}

function validDimensions(value: unknown, length: number): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every((dimension) => Number.isSafeInteger(dimension) && (dimension as number) >= 0) &&
      value.reduce((product, dimension) => product * (dimension as number), 1) === length)
  );
}

function validFormulaName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
