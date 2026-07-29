/** Current Worker wire protocol version. */
export const PROTOCOL_VERSION = 1 as const;

/** Atomic or list value schema transported through structured clone. */
export type RValueSnapshot =
  | { readonly version: 1; readonly type: "null" }
  | {
      readonly version: 1;
      readonly type: "logical";
      readonly values: Uint8Array;
      readonly missing?: Uint8Array;
    }
  | {
      readonly version: 1;
      readonly type: "integer";
      readonly values: Int32Array;
      readonly missing?: Uint8Array;
    }
  | {
      readonly version: 1;
      readonly type: "double";
      readonly values: Float64Array;
      readonly missing?: Uint8Array;
    }
  | {
      readonly version: 1;
      readonly type: "character";
      readonly values: readonly string[];
      readonly missing?: Uint8Array;
    }
  | {
      readonly version: 1;
      readonly type: "list";
      readonly values: readonly RValueSnapshot[];
    };

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
export interface OutputEvent extends ProtocolEnvelope {
  readonly kind: "output";
  readonly stream: "stdout" | "stderr" | "message";
  readonly text: string;
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
      return value.values instanceof Uint8Array && validMask(value.missing, value.values.length);
    case "integer":
      return value.values instanceof Int32Array && validMask(value.missing, value.values.length);
    case "double":
      return value.values instanceof Float64Array && validMask(value.missing, value.values.length);
    case "character":
      return (
        Array.isArray(value.values) &&
        value.values.every((item) => typeof item === "string") &&
        validMask(value.missing, value.values.length)
      );
    case "list":
      return Array.isArray(value.values) && value.values.every(isRValueSnapshot);
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
