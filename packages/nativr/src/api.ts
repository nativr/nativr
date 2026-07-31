import { PROTOCOL_VERSION, isWorkerResponse } from "@nativr/protocol";
import type {
  CapabilityManifest,
  PublicDataViewEvent,
  PublicGraphicsEvent,
  PublicOutputEvent,
  PublicRWarning,
  RValueSnapshot,
  WireEvaluationResult,
  WorkerRequest,
  WorkerResponse,
  WorkerSuccessPayload,
} from "@nativr/protocol";
import { NativRError, RRuntimeDisposedError } from "@nativr/runtime";
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

export type { PublicDataViewEvent, PublicGraphicsEvent, PublicOutputEvent } from "@nativr/protocol";

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
  readonly timeoutMs?: number;
  readonly debug?: boolean;
  readonly onWarning?: (warning: PublicRWarning) => void;
  readonly onOutput?: (event: PublicOutputEvent) => void;
  readonly onDataView?: (event: PublicDataViewEvent) => void;
  readonly onGraphics?: (event: PublicGraphicsEvent) => void;
}

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

/** Create one inline or Worker-first NativR session. */
export async function createR(options: CreateROptions = {}): Promise<NativRSession> {
  const assets = resolveAssets(options.assets);
  if (options.execution === "inline") {
    const { RuntimeHost: InlineRuntimeHost } = await import("./runtime-host.js");
    const host = await InlineRuntimeHost.create(
      {
        treeSitterRuntimeWasm: assets.treeSitterRuntimeWasm,
        rGrammarWasm: assets.rGrammarWasm,
      },
      options.limits,
    );
    return new InlineSession(host, options);
  }
  if (typeof Worker === "undefined") {
    throw new NativRError(
      "NRS5002",
      "Worker execution is unavailable in this host; use execution: 'inline' explicitly.",
    );
  }
  return WorkerSession.create(assets, options);
}

class InlineSession implements NativRSession {
  readonly #host: RuntimeHost;
  readonly #options: CreateROptions;
  #disposed = false;
  #queue: Promise<void> = Promise.resolve();

  public constructor(host: RuntimeHost, options: CreateROptions) {
    this.#host = host;
    this.#options = options;
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
      for (const event of result.graphics) this.#options.onGraphics?.(event);
      return {
        value: snapshotToJs(raw),
        raw,
        visible: result.visible,
        warnings: result.warnings,
        output: result.output,
        dataViews: result.dataViews,
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
    return this.#enqueue(() => {
      this.#host.reset();
      return Promise.resolve();
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
      this.#host.dispose();
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
  #worker: Worker;
  #pending = new Map<string, PendingRequest>();
  #nextId = 1;
  #disposed = false;
  #queue: Promise<void> = Promise.resolve();

  private constructor(worker: Worker, assets: ResolvedAssets, options: CreateROptions) {
    this.#worker = worker;
    this.#assets = assets;
    this.#options = options;
    this.#attachWorker(worker);
  }

  public static async create(
    assets: ResolvedAssets,
    options: CreateROptions,
  ): Promise<WorkerSession> {
    const worker = createRuntimeWorker(assets.worker);
    const session = new WorkerSession(worker, assets, options);
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
      const payload = await this.#request({ kind: "reset" });
      if (payload.kind !== "void") throw protocolPayloadError("void", payload.kind);
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
        assets: {
          treeSitterRuntimeWasm: String(this.#assets.treeSitterRuntimeWasm),
          rGrammarWasm: String(this.#assets.rGrammarWasm),
        },
        ...(this.#options.limits === undefined ? {} : { limits: this.#options.limits }),
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
      this.#handleResponse(response);
    });
    worker.addEventListener("error", () => {
      this.#rejectPending(new NativRError("NRW7002", "NativR Worker failed."));
    });
    worker.addEventListener("messageerror", () => {
      this.#rejectPending(new NativRError("NRW7003", "NativR Worker message cloning failed."));
    });
  }

  #handleResponse(response: WorkerResponse): void {
    if (response.kind === "warning") {
      this.#options.onWarning?.(response.warning);
      return;
    }
    if (response.kind === "output") {
      this.#options.onOutput?.({ stream: response.stream, text: response.text });
      return;
    }
    const pending = this.#pending.get(response.id);
    if (pending === undefined) return;
    this.#pending.delete(response.id);
    if (pending.timer !== undefined) clearTimeout(pending.timer);
    if (response.kind === "error") pending.reject(deserializeError(response.error));
    else pending.resolve(response.payload);
  }

  async #restart(reason: NativRError): Promise<void> {
    if (this.#disposed) return;
    const previous = this.#worker;
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
