import { PROTOCOL_VERSION, isWorkerResponse } from "@nativr/protocol";
import type {
  CapabilityManifest,
  PublicBrowseEvent,
  PublicDataViewEvent,
  PublicGraphicsEvent,
  PublicOutputEvent,
  PublicReadlineRequest,
  PublicRWarning,
  PublicSocketRequest,
  PublicSocketResult,
  PublicSystemCommandRequest,
  PublicSystemCommandResult,
  PublicUrlRequest,
  PublicUrlResult,
  PureRPackageBundle,
  RValueSnapshot,
  WireEvaluationResult,
  WorkerRequest,
  WorkerResponse,
  WorkerSuccessPayload,
  SystemCommandResultRequest,
  ReadlineResultRequest,
  SocketResultRequest,
  UrlResultRequest,
} from "@nativr/protocol";
import {
  DEFAULT_RUNTIME_LIMITS,
  NativRError,
  RResourceLimitError,
  RRuntimeDisposedError,
} from "@nativr/runtime";
import type { RuntimeLimits } from "@nativr/runtime";

import {
  deserializeError,
  inputToSnapshot,
  snapshotToJs,
  snapshotTransferables,
  valueToSnapshot,
} from "./conversion.js";
import type { JsInputValue, JsValue } from "./conversion.js";
import type { RuntimeHost } from "./runtime-host.js";

export type {
  PublicBrowseEvent,
  PublicDataViewEvent,
  PublicGraphicsEvent,
  PublicOutputEvent,
  PublicReadlineRequest,
  PublicSocketRequest,
  PublicSocketResult,
  PublicSystemCommandRequest,
  PublicSystemCommandRedirection,
  PublicSystemCommandResult,
  PublicUrlRequest,
  PublicUrlResult,
} from "@nativr/protocol";
export type { PureRPackageBundle, PureRPackageResource } from "@nativr/protocol";

/** Optional asset overrides for CDNs, unusual bundlers, or tests. */
export interface CreateRAssets {
  readonly worker?: string | URL;
  readonly treeSitterRuntimeWasm?: string | URL;
  readonly rGrammarWasm?: string | URL;
}

/** Options used to create one independent NativR session. */
export interface CreateROptions {
  /** Default: Worker. Inline mode may block the calling thread. */
  readonly execution?: "worker" | "inline";
  readonly assets?: CreateRAssets;
  readonly limits?: Partial<RuntimeLimits>;
  /** Audited source-only package bundles available to this isolated session. */
  readonly packages?: readonly PureRPackageBundle[];
  /** Initial session-owned environment variables; host process variables are never read implicitly. */
  readonly environmentVariables?: Readonly<Record<string, string>>;
  /** Explicit executable-name allow-list used by Sys.which(); no host PATH is read implicitly. */
  readonly executablePaths?: Readonly<Record<string, string>>;
  /** Explicit allow-list seam for system(), system2(), and pipe(); omitted sessions have no process capability. */
  readonly systemCommand?: SystemCommandHandler;
  /** Host-owned line input for R and graphics prompts; omitted sessions remain non-interactive. */
  readonly readline?: ReadlineHandler;
  /** Explicit byte transport for url() connections; omitted sessions have no network capability. */
  readonly url?: UrlHandler;
  /** Explicit duplex socket transport; omitted sessions cannot open network sockets. */
  readonly socket?: SocketHandler;
  readonly timeoutMs?: number;
  readonly debug?: boolean;
  readonly onWarning?: (warning: PublicRWarning) => void;
  readonly onOutput?: (event: PublicOutputEvent) => void;
  readonly onDataView?: (event: PublicDataViewEvent) => void;
  /** Receives inert navigation requests; the host decides whether and how to open them. */
  readonly onBrowse?: (event: PublicBrowseEvent) => void;
  readonly onGraphics?: (event: PublicGraphicsEvent) => void;
}

/** Host-owned policy used only when R code executes system(), system2(), or a pipe() connection. */
export type SystemCommandHandler = (
  request: PublicSystemCommandRequest,
) => PublicSystemCommandResult | Promise<PublicSystemCommandResult>;

/** Host-owned line input used only for explicit R/debug/browser-graphics prompts. */
export type ReadlineHandler = (request: PublicReadlineRequest) => string | Promise<string>;

/** Host-owned, policy-enforcing byte transport used only when R reads a url() connection. */
export type UrlHandler = (request: PublicUrlRequest) => PublicUrlResult | Promise<PublicUrlResult>;

/** Host-owned, policy-enforcing transport for one socket lifecycle operation. */
export type SocketHandler = (
  request: PublicSocketRequest,
) => PublicSocketResult | Promise<PublicSocketResult>;

/** Options for one evaluation. */
export interface EvalOptions {
  readonly timeoutMs?: number;
}

/** Options for one JavaScript assignment. */
export interface AssignOptions {
  readonly transfer?: boolean;
}

/** Detailed public result with ergonomic and lossless representations. */
export interface PublicEvaluationResult {
  readonly value: JsValue;
  readonly raw: RValueSnapshot;
  readonly visible: boolean;
  readonly warnings: readonly PublicRWarning[];
  readonly output: readonly PublicOutputEvent[];
  readonly dataViews: readonly PublicDataViewEvent[];
  readonly browseRequests: readonly PublicBrowseEvent[];
  readonly graphics: readonly PublicGraphicsEvent[];
  readonly elapsedMs: number;
  readonly runtimeReset: boolean;
}

/** The public mutable session contract. */
export interface NativRSession {
  eval(code: string, options?: EvalOptions): Promise<JsValue>;
  evalDetailed(code: string, options?: EvalOptions): Promise<PublicEvaluationResult>;
  evalRaw(code: string, options?: EvalOptions): Promise<RValueSnapshot>;
  assign(name: string, value: JsInputValue, options?: AssignOptions): Promise<void>;
  get(name: string): Promise<JsValue>;
  call(name: string, ...args: readonly JsInputValue[]): Promise<JsValue>;
  capabilities(): Promise<CapabilityManifest>;
  reset(): Promise<void>;
  interrupt(): Promise<void>;
  dispose(): Promise<void>;
}

interface ResolvedAssets {
  readonly worker?: URL;
  readonly treeSitterRuntimeWasm: URL;
  readonly rGrammarWasm: URL;
}

let nextSessionProcessId = 1;

function allocateSessionProcessId(): number {
  const processId = nextSessionProcessId;
  nextSessionProcessId = processId === 2_147_483_647 ? 1 : processId + 1;
  return processId;
}

/** Create one inline or Worker-first NativR session. */
export async function createR(options: CreateROptions = {}): Promise<NativRSession> {
  const assets = resolveAssets(options.assets);
  const sessionProcessId = allocateSessionProcessId();
  const sessionOptions: CreateROptions = {
    ...options,
    ...(options.packages === undefined
      ? {}
      : { packages: snapshotPackageBundles(options.packages) }),
    ...(options.environmentVariables === undefined
      ? {}
      : { environmentVariables: snapshotEnvironmentVariables(options.environmentVariables) }),
    ...(options.executablePaths === undefined
      ? {}
      : { executablePaths: snapshotExecutablePaths(options.executablePaths) }),
  };
  if (sessionOptions.execution === "inline") {
    const { RuntimeHost: InlineRuntimeHost } = await import("./runtime-host.js");
    const systemCommand = sessionOptions.systemCommand;
    const readline = sessionOptions.readline;
    const url = sessionOptions.url;
    const socket = sessionOptions.socket;
    const host = await InlineRuntimeHost.create(
      {
        treeSitterRuntimeWasm: assets.treeSitterRuntimeWasm,
        rGrammarWasm: assets.rGrammarWasm,
      },
      sessionProcessId,
      sessionOptions.limits,
      sessionOptions.packages,
      sessionOptions.environmentVariables,
      sessionOptions.executablePaths,
      systemCommand === undefined
        ? undefined
        : async (request) =>
            executeSystemCommandHandler(
              systemCommand,
              request,
              sessionOptions.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
            ),
      readline === undefined
        ? undefined
        : async (prompt) =>
            executeReadlineHandler(
              readline,
              { prompt },
              sessionOptions.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
            ),
      url === undefined
        ? undefined
        : async (request) =>
            executeUrlHandler(
              url,
              request,
              sessionOptions.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
            ),
      socket === undefined
        ? undefined
        : async (request) =>
            executeSocketHandler(
              socket,
              request,
              sessionOptions.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
            ),
    );
    return new InlineSession(host, sessionOptions, sessionProcessId);
  }
  if (typeof Worker === "undefined") {
    throw new NativRError(
      "NRS5002",
      "Worker execution is unavailable in this host; use execution: 'inline' explicitly.",
    );
  }
  return WorkerSession.create(assets, sessionOptions, sessionProcessId);
}

function snapshotEnvironmentVariables(
  environmentVariables: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  if (!isUnknownRecord(environmentVariables) || Array.isArray(environmentVariables)) {
    throw new NativRError(
      "NRS5004",
      "createR(environmentVariables=) requires a string-valued record.",
    );
  }
  const snapshot: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [name, value] of Object.entries(environmentVariables)) {
    if (
      name.length === 0 ||
      name.includes("\0") ||
      typeof value !== "string" ||
      value.includes("\0")
    ) {
      throw new NativRError(
        "NRS5004",
        "Environment-variable names must be non-empty and names and values must be NUL-free strings.",
      );
    }
    snapshot[name] = value;
  }
  return Object.freeze(snapshot);
}

function snapshotExecutablePaths(
  executablePaths: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  if (!isUnknownRecord(executablePaths) || Array.isArray(executablePaths)) {
    throw new NativRError("NRS5008", "createR(executablePaths=) requires a string-valued record.");
  }
  const snapshot: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [name, value] of Object.entries(executablePaths)) {
    if (
      name.length === 0 ||
      name.includes("\0") ||
      typeof value !== "string" ||
      value.length === 0 ||
      value.includes("\0")
    ) {
      throw new NativRError(
        "NRS5008",
        "Executable names and paths must be non-empty, NUL-free strings.",
      );
    }
    snapshot[name] = value;
  }
  return Object.freeze(snapshot);
}

function snapshotPackageBundles(
  packages: readonly PureRPackageBundle[],
): readonly PureRPackageBundle[] {
  const packageInputs = asUnknownArray(packages);
  if (packageInputs === undefined) {
    throw new NativRError("NRS5003", "createR(packages=) requires an array of package bundles.");
  }
  return Object.freeze(
    packageInputs.map((bundle, bundleIndex) => {
      if (!isUnknownRecord(bundle)) {
        throw new NativRError(
          "NRS5003",
          `Package bundle at index ${bundleIndex} has an invalid shape.`,
        );
      }
      const description = bundle["description"];
      const namespace = bundle["namespace"];
      const sourceInputs = asUnknownArray(bundle["rSources"]);
      const resourceInputs =
        bundle["resources"] === undefined ? [] : asUnknownArray(bundle["resources"]);
      if (
        typeof description !== "string" ||
        typeof namespace !== "string" ||
        sourceInputs === undefined ||
        resourceInputs === undefined
      ) {
        throw new NativRError(
          "NRS5003",
          `Package bundle at index ${bundleIndex} has an invalid shape.`,
        );
      }
      return Object.freeze({
        description,
        namespace,
        rSources: Object.freeze(
          sourceInputs.map((entry, sourceIndex) => {
            if (!isUnknownRecord(entry)) {
              throw new NativRError(
                "NRS5003",
                `Package source at index ${bundleIndex}:${sourceIndex} has an invalid shape.`,
              );
            }
            const path = entry["path"];
            const source = entry["source"];
            if (typeof path !== "string" || typeof source !== "string") {
              throw new NativRError(
                "NRS5003",
                `Package source at index ${bundleIndex}:${sourceIndex} has an invalid shape.`,
              );
            }
            return Object.freeze({ path, source });
          }),
        ),
        resources: Object.freeze(
          resourceInputs.map((entry, resourceIndex) => {
            if (!isUnknownRecord(entry)) {
              throw new NativRError(
                "NRS5003",
                `Package resource at index ${bundleIndex}:${resourceIndex} has an invalid shape.`,
              );
            }
            const path = entry["path"];
            const data = entry["data"];
            if (typeof path !== "string" || typeof data !== "string") {
              throw new NativRError(
                "NRS5003",
                `Package resource at index ${bundleIndex}:${resourceIndex} has an invalid shape.`,
              );
            }
            return Object.freeze({ path, data });
          }),
        ),
      });
    }),
  );
}

function asUnknownArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? (value as readonly unknown[]) : undefined;
}

function isUnknownRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function validateSystemCommandResult(
  value: unknown,
  maxOutputBytes = DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
): PublicSystemCommandResult {
  if (!isUnknownRecord(value)) throw invalidSystemCommandResult();
  const { status, stdout, stderr, errorMessage, failedToStart, timedOut } = value;
  if (
    typeof status !== "number" ||
    !Number.isSafeInteger(status) ||
    status < 0 ||
    status > 2_147_483_647 ||
    (stdout !== undefined && typeof stdout !== "string") ||
    (stderr !== undefined && typeof stderr !== "string") ||
    (errorMessage !== undefined && typeof errorMessage !== "string") ||
    (failedToStart !== undefined && typeof failedToStart !== "boolean") ||
    (timedOut !== undefined && typeof timedOut !== "boolean")
  ) {
    throw invalidSystemCommandResult();
  }
  const result = {
    status,
    ...(stdout === undefined ? {} : { stdout }),
    ...(stderr === undefined ? {} : { stderr }),
    ...(errorMessage === undefined ? {} : { errorMessage }),
    ...(failedToStart === undefined ? {} : { failedToStart }),
    ...(timedOut === undefined ? {} : { timedOut }),
  };
  const outputBytes = [result.stdout, result.stderr, result.errorMessage].reduce(
    (total, text) => total + (text === undefined ? 0 : new TextEncoder().encode(text).byteLength),
    0,
  );
  if (outputBytes > maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "System-command output size limit exceeded.", {
      details: { maxOutputBytes, outputBytes },
    });
  }
  return result;
}

function invalidSystemCommandResult(): NativRError {
  return new NativRError(
    "NRS5005",
    "createR({ systemCommand }) must return a non-negative integer status and optional string output fields.",
  );
}

async function executeSystemCommandHandler(
  handler: SystemCommandHandler,
  request: PublicSystemCommandRequest,
  maxOutputBytes: number,
): Promise<PublicSystemCommandResult> {
  try {
    return validateSystemCommandResult(await handler(request), maxOutputBytes);
  } catch (error) {
    if (error instanceof NativRError) throw error;
    throw new NativRError("NRE2250", error instanceof Error ? error.message : String(error));
  }
}

function validateReadlineResult(
  value: unknown,
  maxOutputBytes = DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    throw new NativRError(
      "NRS5006",
      "createR({ readline }) must return one NUL-free line without newline characters.",
    );
  }
  const inputBytes = new TextEncoder().encode(value).byteLength;
  if (inputBytes > maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "Readline input size limit exceeded.", {
      details: { maxOutputBytes, inputBytes },
    });
  }
  return value;
}

async function executeReadlineHandler(
  handler: ReadlineHandler,
  request: PublicReadlineRequest,
  maxOutputBytes: number,
): Promise<string> {
  try {
    return validateReadlineResult(await handler(request), maxOutputBytes);
  } catch (error) {
    if (error instanceof NativRError) throw error;
    throw new NativRError("NRE2254", error instanceof Error ? error.message : String(error));
  }
}

function validateUrlResult(
  value: unknown,
  maxOutputBytes = DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
): PublicUrlResult {
  if (!isUnknownRecord(value) || !(value["body"] instanceof Uint8Array)) {
    throw new NativRError(
      "NRS5007",
      "createR({ url }) must return an object containing a Uint8Array body.",
    );
  }
  const body = Uint8Array.from(value["body"]);
  if (body.byteLength > maxOutputBytes) {
    throw new RResourceLimitError("NRL4007", "URL response size limit exceeded.", {
      details: { maxOutputBytes, outputBytes: body.byteLength },
    });
  }
  return { body };
}

async function executeUrlHandler(
  handler: UrlHandler,
  request: PublicUrlRequest,
  maxOutputBytes: number,
): Promise<PublicUrlResult> {
  try {
    const snapshot: PublicUrlRequest = {
      url: request.url,
      method: request.method,
      headers: request.headers.map(({ name, value }) => ({ name, value })),
    };
    return validateUrlResult(await handler(snapshot), maxOutputBytes);
  } catch (error) {
    if (error instanceof NativRError) throw error;
    throw new NativRError("NRE2255", error instanceof Error ? error.message : String(error));
  }
}

function validateSocketResult(
  value: unknown,
  request: PublicSocketRequest,
  maxOutputBytes = DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
): PublicSocketResult {
  if (!isUnknownRecord(value)) throw invalidSocketResult();
  if (Object.keys(value).some((key) => key !== "body" && key !== "incomplete")) {
    throw invalidSocketResult();
  }
  const body = value["body"];
  const incomplete = value["incomplete"];
  if (request.operation === "read") {
    if (!(body instanceof Uint8Array) || typeof incomplete !== "boolean") {
      throw invalidSocketResult();
    }
    if (body.byteLength > request.maxBytes || body.byteLength > maxOutputBytes) {
      throw new RResourceLimitError("NRL4007", "Socket response size limit exceeded.", {
        details: {
          maxOutputBytes: Math.min(request.maxBytes, maxOutputBytes),
          outputBytes: body.byteLength,
        },
      });
    }
    return { body: Uint8Array.from(body), incomplete };
  }
  if (body !== undefined || incomplete !== undefined) throw invalidSocketResult();
  return {};
}

function invalidSocketResult(): NativRError {
  return new NativRError(
    "NRS5009",
    "createR({ socket }) must return { body: Uint8Array, incomplete: boolean } for reads and {} for lifecycle operations.",
  );
}

async function executeSocketHandler(
  handler: SocketHandler,
  request: PublicSocketRequest,
  maxOutputBytes: number,
): Promise<PublicSocketResult> {
  try {
    if (request.operation === "write" && request.bytes.byteLength > maxOutputBytes) {
      throw new RResourceLimitError("NRL4007", "Socket write size limit exceeded.", {
        details: { maxOutputBytes, outputBytes: request.bytes.byteLength },
      });
    }
    const snapshot: PublicSocketRequest =
      request.operation === "open"
        ? { ...request, options: [...request.options] }
        : request.operation === "write"
          ? { ...request, bytes: Uint8Array.from(request.bytes) }
          : { ...request };
    return validateSocketResult(await handler(snapshot), request, maxOutputBytes);
  } catch (error) {
    if (error instanceof NativRError) throw error;
    throw new NativRError("NRE2256", error instanceof Error ? error.message : String(error));
  }
}

class InlineSession implements NativRSession {
  readonly #host: RuntimeHost;
  readonly #options: CreateROptions;
  readonly #sessionProcessId: number;
  #disposed = false;
  #queue: Promise<void> = Promise.resolve();

  public constructor(host: RuntimeHost, options: CreateROptions, sessionProcessId: number) {
    this.#host = host;
    this.#options = options;
    this.#sessionProcessId = sessionProcessId;
  }

  public async eval(code: string, options?: EvalOptions): Promise<JsValue> {
    return (await this.evalDetailed(code, options)).value;
  }

  public async evalDetailed(code: string, _options?: EvalOptions): Promise<PublicEvaluationResult> {
    return this.#enqueue(async () => {
      const result = await this.#host.eval(code);
      const raw = valueToSnapshot(result.value);
      for (const warning of result.warnings) this.#options.onWarning?.(warning);
      for (const output of result.output) this.#options.onOutput?.(output);
      for (const event of result.dataViews) this.#options.onDataView?.(event);
      for (const event of result.browseRequests) this.#options.onBrowse?.(event);
      for (const event of result.graphics) this.#options.onGraphics?.(event);
      return {
        value: snapshotToJs(raw),
        raw,
        visible: result.visible,
        warnings: result.warnings,
        output: result.output,
        dataViews: result.dataViews,
        browseRequests: result.browseRequests,
        graphics: result.graphics,
        elapsedMs: result.elapsedMs,
        runtimeReset: false,
      };
    });
  }

  public async evalRaw(code: string, options?: EvalOptions): Promise<RValueSnapshot> {
    return (await this.evalDetailed(code, options)).raw;
  }

  public assign(name: string, value: JsInputValue, _options?: AssignOptions): Promise<void> {
    return this.#enqueue(() => {
      this.#host.assign(name, inputToSnapshot(value));
      return Promise.resolve();
    });
  }

  public get(name: string): Promise<JsValue> {
    return this.#enqueue(async () => snapshotToJs(valueToSnapshot(await this.#host.get(name))));
  }

  public call(name: string, ...args: readonly JsInputValue[]): Promise<JsValue> {
    return this.#enqueue(async () =>
      snapshotToJs(
        valueToSnapshot(
          await this.#host.call(
            name,
            args.map((value) => inputToSnapshot(value)),
          ),
        ),
      ),
    );
  }

  public capabilities(): Promise<CapabilityManifest> {
    return this.#enqueue(() => Promise.resolve(this.#host.capabilities()));
  }

  public reset(): Promise<void> {
    return this.#enqueue(async () => {
      let cleanupError: Error | undefined;
      try {
        await closeSocketSession(this.#options, this.#sessionProcessId);
      } catch (error) {
        cleanupError = error instanceof Error ? error : new NativRError("NRE2256", String(error));
      }
      this.#host.reset();
      if (cleanupError !== undefined) throw cleanupError;
    });
  }

  public interrupt(): Promise<void> {
    this.#ensureActive();
    this.#host.interrupt();
    return Promise.resolve();
  }

  public async dispose(): Promise<void> {
    if (!this.#disposed) {
      this.#disposed = true;
      await this.#queue.catch(() => undefined);
      try {
        await closeSocketSession(this.#options, this.#sessionProcessId);
      } finally {
        this.#host.dispose();
      }
    }
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    this.#ensureActive();
    const result = this.#queue.then(operation);
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #ensureActive(): void {
    if (this.#disposed) {
      throw new RRuntimeDisposedError("NRS5001", "The NativR session has been disposed.");
    }
  }
}

interface PendingRequest {
  readonly resolve: (payload: WorkerSuccessPayload) => void;
  readonly reject: (error: unknown) => void;
  readonly timer?: ReturnType<typeof setTimeout>;
}

type WorkerRequestBody = WorkerRequest extends infer Request
  ? Request extends WorkerRequest
    ? Omit<Request, "protocolVersion" | "id">
    : never
  : never;

class WorkerSession implements NativRSession {
  readonly #assets: ResolvedAssets;
  readonly #options: CreateROptions;
  readonly #sessionProcessId: number;
  #worker: Worker;
  #pending = new Map<string, PendingRequest>();
  #nextId = 1;
  #disposed = false;
  #queue: Promise<void> = Promise.resolve();

  private constructor(
    worker: Worker,
    assets: ResolvedAssets,
    options: CreateROptions,
    sessionProcessId: number,
  ) {
    this.#worker = worker;
    this.#assets = assets;
    this.#options = options;
    this.#sessionProcessId = sessionProcessId;
    this.#attachWorker(worker);
  }

  public static async create(
    assets: ResolvedAssets,
    options: CreateROptions,
    sessionProcessId: number,
  ): Promise<WorkerSession> {
    const worker = createRuntimeWorker(assets.worker);
    const session = new WorkerSession(worker, assets, options, sessionProcessId);
    await session.#initialize();
    return session;
  }

  public async eval(code: string, options?: EvalOptions): Promise<JsValue> {
    return (await this.evalDetailed(code, options)).value;
  }

  public evalDetailed(code: string, options?: EvalOptions): Promise<PublicEvaluationResult> {
    return this.#enqueue(async () => {
      const payload = await this.#request(
        { kind: "eval", code },
        [],
        options?.timeoutMs ?? this.#options.timeoutMs,
      );
      if (payload.kind !== "evaluation") throw protocolPayloadError("evaluation", payload.kind);
      const result = publicResult(payload.result);
      for (const event of result.dataViews) this.#options.onDataView?.(event);
      for (const event of result.browseRequests) this.#options.onBrowse?.(event);
      for (const event of result.graphics) this.#options.onGraphics?.(event);
      return result;
    });
  }

  public async evalRaw(code: string, options?: EvalOptions): Promise<RValueSnapshot> {
    return (await this.evalDetailed(code, options)).raw;
  }

  public assign(name: string, value: JsInputValue, options?: AssignOptions): Promise<void> {
    return this.#enqueue(async () => {
      const transfer = options?.transfer === true;
      const snapshot = inputToSnapshot(value, transfer);
      const payload = await this.#request(
        { kind: "assign", name, value: snapshot },
        transfer ? snapshotTransferables(snapshot) : [],
      );
      if (payload.kind !== "void") throw protocolPayloadError("void", payload.kind);
    });
  }

  public get(name: string): Promise<JsValue> {
    return this.#enqueue(async () => {
      const payload = await this.#request({ kind: "get", name });
      if (payload.kind !== "value") throw protocolPayloadError("value", payload.kind);
      return snapshotToJs(payload.value);
    });
  }

  public call(name: string, ...args: readonly JsInputValue[]): Promise<JsValue> {
    return this.#enqueue(async () => {
      const payload = await this.#request({
        kind: "call",
        name,
        arguments: args.map((value) => inputToSnapshot(value)),
      });
      if (payload.kind !== "value") throw protocolPayloadError("value", payload.kind);
      return snapshotToJs(payload.value);
    });
  }

  public capabilities(): Promise<CapabilityManifest> {
    return this.#enqueue(async () => {
      const payload = await this.#request({ kind: "capabilities" });
      if (payload.kind !== "capabilities") {
        throw protocolPayloadError("capabilities", payload.kind);
      }
      return payload.value;
    });
  }

  public reset(): Promise<void> {
    return this.#enqueue(async () => {
      let cleanupError: Error | undefined;
      try {
        await closeSocketSession(this.#options, this.#sessionProcessId);
      } catch (error) {
        cleanupError = error instanceof Error ? error : new NativRError("NRE2256", String(error));
      }
      const payload = await this.#request({ kind: "reset" });
      if (payload.kind !== "void") throw protocolPayloadError("void", payload.kind);
      if (cleanupError !== undefined) throw cleanupError;
    });
  }

  public async interrupt(): Promise<void> {
    this.#ensureActive();
    await this.#restart(
      new NativRError("NRL4005", "Evaluation interrupted; Worker state was reset.", {
        details: { runtimeReset: true },
      }),
    );
  }

  public async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    try {
      await closeSocketSession(this.#options, this.#sessionProcessId);
      await this.#request({ kind: "dispose" });
    } catch {
      // Termination below remains authoritative when the Worker is already unhealthy.
    }
    this.#rejectPending(new RRuntimeDisposedError("NRS5001", "The session was disposed."));
    this.#worker.terminate();
  }

  async #initialize(): Promise<void> {
    const payload = await this.#request(
      {
        kind: "init",
        sessionProcessId: this.#sessionProcessId,
        assets: {
          treeSitterRuntimeWasm: String(this.#assets.treeSitterRuntimeWasm),
          rGrammarWasm: String(this.#assets.rGrammarWasm),
        },
        ...(this.#options.limits === undefined ? {} : { limits: this.#options.limits }),
        ...(this.#options.packages === undefined ? {} : { packages: this.#options.packages }),
        ...(this.#options.environmentVariables === undefined
          ? {}
          : { environmentVariables: this.#options.environmentVariables }),
        ...(this.#options.executablePaths === undefined
          ? {}
          : { executablePaths: this.#options.executablePaths }),
        ...(this.#options.readline === undefined ? {} : { readline: true }),
        ...(this.#options.url === undefined ? {} : { url: true }),
        ...(this.#options.socket === undefined ? {} : { socket: true }),
        debug: this.#options.debug === true,
      },
      [],
      this.#options.timeoutMs ?? 10_000,
    );
    if (payload.kind !== "ready") throw protocolPayloadError("ready", payload.kind);
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    this.#ensureActive();
    const result = this.#queue.then(operation);
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #request(
    body: WorkerRequestBody,
    transferables: Transferable[] = [],
    timeoutMs?: number,
  ): Promise<WorkerSuccessPayload> {
    if (this.#disposed && body.kind !== "dispose") {
      return Promise.reject(
        new RRuntimeDisposedError("NRS5001", "The NativR session has been disposed."),
      );
    }
    const id = `nr-${this.#nextId++}`;
    const request = { ...body, protocolVersion: PROTOCOL_VERSION, id } as WorkerRequest;
    return new Promise<WorkerSuccessPayload>((resolve, reject) => {
      const pending: PendingRequest =
        timeoutMs === undefined
          ? { resolve, reject }
          : {
              resolve,
              reject,
              timer: setTimeout(() => {
                void this.#restart(
                  new NativRError(
                    "NRL4006",
                    `Evaluation timed out after ${timeoutMs} ms; Worker state was reset.`,
                    { details: { timeoutMs, runtimeReset: true } },
                  ),
                );
              }, timeoutMs),
            };
      this.#pending.set(id, pending);
      this.#worker.postMessage(request, transferables);
    });
  }

  #attachWorker(worker: Worker): void {
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const response = event.data;
      if (!isWorkerResponse(response)) {
        this.#rejectPending(new NativRError("NRW7001", "Malformed Worker protocol response."));
        return;
      }
      this.#handleResponse(worker, response);
    });
    worker.addEventListener("error", () => {
      this.#rejectPending(new NativRError("NRW7002", "NativR Worker failed."));
    });
    worker.addEventListener("messageerror", () => {
      this.#rejectPending(new NativRError("NRW7003", "NativR Worker message cloning failed."));
    });
  }

  #handleResponse(worker: Worker, response: WorkerResponse): void {
    if (response.kind === "warning") {
      this.#options.onWarning?.(response.warning);
      return;
    }
    if (response.kind === "output") {
      this.#options.onOutput?.({ stream: response.stream, text: response.text });
      return;
    }
    if (response.kind === "system-command") {
      void this.#handleSystemCommand(worker, response.id, response.request);
      return;
    }
    if (response.kind === "readline") {
      void this.#handleReadline(worker, response.id, response.request);
      return;
    }
    if (response.kind === "url") {
      void this.#handleUrl(worker, response.id, response.request);
      return;
    }
    if (response.kind === "socket") {
      void this.#handleSocket(worker, response.id, response.request);
      return;
    }
    const pending = this.#pending.get(response.id);
    if (pending === undefined) return;
    this.#pending.delete(response.id);
    if (pending.timer !== undefined) clearTimeout(pending.timer);
    if (response.kind === "error") pending.reject(deserializeError(response.error));
    else pending.resolve(response.payload);
  }

  async #handleSystemCommand(
    worker: Worker,
    id: string,
    request: PublicSystemCommandRequest,
  ): Promise<void> {
    let response: SystemCommandResultRequest;
    try {
      const handler = this.#options.systemCommand;
      if (handler === undefined) {
        throw new NativRError(
          "NRU6194",
          "system()/system2()/pipe() requires an explicit createR({ systemCommand }) host capability.",
        );
      }
      response = {
        protocolVersion: PROTOCOL_VERSION,
        id,
        kind: "system-command-result",
        result: await executeSystemCommandHandler(
          handler,
          request,
          this.#options.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
        ),
      };
    } catch (error) {
      response = {
        protocolVersion: PROTOCOL_VERSION,
        id,
        kind: "system-command-result",
        error: {
          code: error instanceof NativRError ? error.code : "NRE2250",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    worker.postMessage(response);
  }

  async #handleReadline(worker: Worker, id: string, request: PublicReadlineRequest): Promise<void> {
    let response: ReadlineResultRequest;
    try {
      const handler = this.#options.readline;
      if (handler === undefined) {
        throw new NativRError(
          "NRU6195",
          "readline() requires an explicit createR({ readline }) host capability.",
        );
      }
      response = {
        protocolVersion: PROTOCOL_VERSION,
        id,
        kind: "readline-result",
        value: await executeReadlineHandler(
          handler,
          request,
          this.#options.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
        ),
      };
    } catch (error) {
      response = {
        protocolVersion: PROTOCOL_VERSION,
        id,
        kind: "readline-result",
        error: {
          code: error instanceof NativRError ? error.code : "NRE2254",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    worker.postMessage(response);
  }

  async #handleUrl(worker: Worker, id: string, request: PublicUrlRequest): Promise<void> {
    let response: UrlResultRequest;
    try {
      const handler = this.#options.url;
      if (handler === undefined) {
        throw new NativRError(
          "NRU6196",
          "url() I/O requires an explicit createR({ url }) host capability.",
        );
      }
      response = {
        protocolVersion: PROTOCOL_VERSION,
        id,
        kind: "url-result",
        result: await executeUrlHandler(
          handler,
          request,
          this.#options.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
        ),
      };
    } catch (error) {
      response = {
        protocolVersion: PROTOCOL_VERSION,
        id,
        kind: "url-result",
        error: {
          code: error instanceof NativRError ? error.code : "NRE2255",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    worker.postMessage(
      response,
      "result" in response ? [response.result.body.buffer as ArrayBuffer] : [],
    );
  }

  async #handleSocket(worker: Worker, id: string, request: PublicSocketRequest): Promise<void> {
    let response: SocketResultRequest;
    try {
      const handler = this.#options.socket;
      if (handler === undefined) {
        throw new NativRError(
          "NRU6207",
          "socketConnection() I/O requires an explicit createR({ socket }) host capability.",
        );
      }
      response = {
        protocolVersion: PROTOCOL_VERSION,
        id,
        kind: "socket-result",
        result: await executeSocketHandler(
          handler,
          request,
          this.#options.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
        ),
      };
    } catch (error) {
      response = {
        protocolVersion: PROTOCOL_VERSION,
        id,
        kind: "socket-result",
        error: {
          code: error instanceof NativRError ? error.code : "NRE2256",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    const transferables =
      "result" in response && response.result.body !== undefined
        ? [response.result.body.buffer as ArrayBuffer]
        : [];
    worker.postMessage(response, transferables);
  }

  async #restart(reason: NativRError): Promise<void> {
    if (this.#disposed) return;
    const previous = this.#worker;
    await closeSocketSession(this.#options, this.#sessionProcessId).catch(() => undefined);
    this.#rejectPending(reason);
    previous.terminate();
    const worker = createRuntimeWorker(this.#assets.worker);
    this.#worker = worker;
    this.#attachWorker(worker);
    await this.#initialize();
  }

  #rejectPending(error: unknown): void {
    for (const pending of this.#pending.values()) {
      if (pending.timer !== undefined) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #ensureActive(): void {
    if (this.#disposed) {
      throw new RRuntimeDisposedError("NRS5001", "The NativR session has been disposed.");
    }
  }
}

async function closeSocketSession(options: CreateROptions, sessionId: number): Promise<void> {
  if (options.socket === undefined) return;
  await executeSocketHandler(
    options.socket,
    { operation: "close-all", sessionId },
    options.limits?.maxOutputBytes ?? DEFAULT_RUNTIME_LIMITS.maxOutputBytes,
  );
}

function resolveAssets(overrides: CreateRAssets | undefined): ResolvedAssets {
  return {
    ...(overrides?.worker === undefined
      ? {}
      : { worker: toUrl(overrides.worker, moduleRelativeUrl(".")) }),
    treeSitterRuntimeWasm: toUrl(
      overrides?.treeSitterRuntimeWasm,
      moduleRelativeUrl("./web-tree-sitter.wasm"),
    ),
    rGrammarWasm: toUrl(overrides?.rGrammarWasm, moduleRelativeUrl("./tree-sitter-r.wasm")),
  };
}

function createRuntimeWorker(override: URL | undefined): Worker {
  return override === undefined
    ? new Worker(new URL("./worker-entry.ts", import.meta.url), {
        type: "module",
        name: "nativr-runtime",
      })
    : new Worker(override, { type: "module", name: "nativr-runtime" });
}

function toUrl(value: string | URL | undefined, fallback: URL): URL {
  return value === undefined ? fallback : value instanceof URL ? value : new URL(value, fallback);
}

function moduleRelativeUrl(relativePath: string): URL {
  return new URL(relativePath, import.meta.url);
}

function publicResult(result: WireEvaluationResult): PublicEvaluationResult {
  return {
    value: snapshotToJs(result.raw),
    raw: result.raw,
    visible: result.visible,
    warnings: result.warnings,
    output: result.output ?? [],
    dataViews: result.dataViews ?? [],
    browseRequests: result.browseRequests ?? [],
    graphics: result.graphics ?? [],
    elapsedMs: result.elapsedMs,
    runtimeReset: result.runtimeReset,
  };
}

function protocolPayloadError(expected: string, received: string): NativRError {
  return new NativRError(
    "NRW7004",
    `Unexpected Worker response payload '${received}', expected '${expected}'.`,
  );
}
