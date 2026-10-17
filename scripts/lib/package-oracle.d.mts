import type { OrderedOutputEvent, OrderedOutputStatus } from "./package-output-order.mjs";

export interface OraclePackageIdentity {
  readonly name: string;
  readonly version: string;
}

export interface OracleProcessOptions {
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
}

export interface OracleProcessResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly reason: "exited" | "timed-out" | "output-limit";
}

export interface OracleCondition {
  readonly kind: "warning" | "error";
  readonly message: string;
  readonly call: string | null;
  readonly classes: readonly string[];
  /** Omitted if the process failed before handler return could be established. */
  readonly handled?: boolean;
}

export interface OracleScript {
  readonly source: string;
  readonly path?: string;
  readonly files?: readonly { readonly path: string; readonly data: Uint8Array }[];
  /** Also capture native cross-stream order in a second fresh session sharing one output handle. */
  readonly outputOrder?: boolean;
}

export interface OracleCapture extends OracleProcessResult {
  readonly status: "completed" | "failed";
  readonly version: string | null;
  readonly packageVersion: string | null;
  readonly sourceSha256: string;
  readonly freshSession: true;
  readonly runtimeSettings: {
    readonly keepSource: boolean;
    readonly keepSourcePackages: boolean;
    readonly jitEnvironment: string;
    readonly osType: string;
    readonly newlineTransport: "identity" | "lf-to-crlf" | "unknown" | "unprobed";
  } | null;
  readonly conditions: readonly OracleCondition[];
  /** Present only when the order was requested and uniquely recovered from complete captures. */
  readonly outputOrder?: readonly OrderedOutputEvent[];
  readonly limitations: {
    readonly sourcePrefixLines: number;
    readonly conditionObservation: "globalCallingHandlers-after-source-handlers";
    readonly crossStreamOrder: "unobserved" | "merged-handle-unique-alignment-v1";
    readonly outputOrder: OrderedOutputStatus | "unrequested";
    readonly outputOrderReason?: string;
    readonly incompleteHandlerReturn: boolean;
    readonly nativeLineEndings: "preserved";
    readonly conditionObserversPresentAtCompletion: boolean;
  };
}

export interface OracleCaptureOptions extends OracleScript {
  readonly rscript: string;
  readonly library?: string;
  readonly newlineTransport?: "identity" | "lf-to-crlf" | "unknown";
  readonly expectedPackage?: OraclePackageIdentity;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

export interface PackageOracleOptions {
  readonly rscript: string;
  readonly archive: string;
  readonly expectedPackage: OraclePackageIdentity;
  readonly expectedSourceSha256: string;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

export interface PackageOracle {
  readonly version: string;
  readonly packageVersion: string;
  readonly sourceSha256: string;
  readonly newlineTransport: {
    readonly kind: "identity" | "lf-to-crlf" | "unknown";
    readonly probeLiteralHex: string;
    readonly stdoutHex: string;
    readonly stderrHex: string;
  };
  readonly installation: OracleProcessResult;
  capture(script: OracleScript): Promise<OracleCapture>;
  dispose(): Promise<void>;
}

export function createPackageOracle(options: PackageOracleOptions): Promise<PackageOracle>;
export function capturePackageOracleScript(options: OracleCaptureOptions): Promise<OracleCapture>;
export function runPackageOracleProcess(
  command: string,
  arguments_: readonly string[],
  options?: OracleProcessOptions,
): Promise<OracleProcessResult>;
export function runMergedProcess(
  command: string,
  arguments_: readonly string[],
  options: OracleProcessOptions & { readonly outputPath: string },
): Promise<{
  readonly output: Buffer;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly reason: "exited" | "timed-out" | "output-limit";
}>;
