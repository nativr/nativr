/// <reference lib="webworker" />

import { PROTOCOL_VERSION, isWorkerRequest } from "@nativr/protocol";
import type {
  ErrorResponse,
  OutputEvent,
  ReadlineEvent,
  ReadlineResultRequest,
  SocketEvent,
  SocketResultRequest,
  UrlEvent,
  UrlResultRequest,
  SuccessResponse,
  SystemCommandEvent,
  SystemCommandResultRequest,
  NativeCallEvent,
  NativeCallResultRequest,
  WarningEvent,
  WorkerRequest,
  WorkerSuccessPayload,
  PublicSystemCommandRequest,
  PublicSystemCommandResult,
  PublicNativeCallRequest,
  PublicNativeCallResult,
  PublicSocketRequest,
  PublicSocketResult,
  PublicUrlRequest,
  PublicUrlResult,
} from "@nativr/protocol";
import { NativRError } from "@nativr/runtime";

import { serializeError, snapshotTransferables, valueToSnapshot } from "./conversion.js";
import { RuntimeHost } from "./runtime-host.js";

const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope;
let host: RuntimeHost | undefined;
let debug = false;
let queue: Promise<void> = Promise.resolve();
let nextSystemCommandId = 1;
let nextNativeCallId = 1;
let nextReadlineId = 1;
let nextUrlId = 1;
let nextSocketId = 1;
const pendingSystemCommands = new Map<
  string,
  {
    readonly resolve: (result: PublicSystemCommandResult) => void;
    readonly reject: (error: unknown) => void;
  }
>();
const pendingNativeCalls = new Map<
  string,
  {
    readonly resolve: (result: PublicNativeCallResult) => void;
    readonly reject: (error: unknown) => void;
  }
>();
const pendingReadlines = new Map<
  string,
  {
    readonly resolve: (value: string) => void;
    readonly reject: (error: unknown) => void;
  }
>();
const pendingUrls = new Map<
  string,
  {
    readonly resolve: (result: PublicUrlResult) => void;
    readonly reject: (error: unknown) => void;
  }
>();
const pendingSockets = new Map<
  string,
  {
    readonly resolve: (result: PublicSocketResult) => void;
    readonly reject: (error: unknown) => void;
  }
>();

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  const immediate = event.data;
  if (isWorkerRequest(immediate) && immediate.kind === "system-command-result") {
    resolveSystemCommand(immediate);
    return;
  }
  if (isWorkerRequest(immediate) && immediate.kind === "native-call-result") {
    resolveNativeCall(immediate);
    return;
  }
  if (isWorkerRequest(immediate) && immediate.kind === "readline-result") {
    resolveReadline(immediate);
    return;
  }
  if (isWorkerRequest(immediate) && immediate.kind === "url-result") {
    resolveUrl(immediate);
    return;
  }
  if (isWorkerRequest(immediate) && immediate.kind === "socket-result") {
    resolveSocket(immediate);
    return;
  }
  queue = queue.then(async () => {
    const request = immediate;
    if (!isWorkerRequest(request)) {
      postError("invalid", new NativRError("NRW7005", "Malformed Worker protocol request."));
      return;
    }
    await handleRequest(request);
  });
});

async function handleRequest(request: WorkerRequest): Promise<void> {
  try {
    if (request.kind === "init") {
      host?.dispose();
      debug = request.debug;
      host = await RuntimeHost.create(
        request.assets,
        request.sessionProcessId,
        request.limits,
        request.packages,
        request.environmentVariables,
        request.executablePaths,
        request.nativeModules,
        requestSystemCommand,
        requestNativeCall,
        request.readline === true ? requestReadline : undefined,
        request.url === true ? requestUrl : undefined,
        request.socket === true ? requestSocket : undefined,
      );
      postSuccess(request.id, { kind: "ready" });
      return;
    }
    const runtime = requireHost();
    switch (request.kind) {
      case "eval": {
        const result = await runtime.eval(request.code);
        for (const warning of result.warnings) {
          const event: WarningEvent = {
            protocolVersion: PROTOCOL_VERSION,
            id: request.id,
            kind: "warning",
            warning,
          };
          workerScope.postMessage(event);
        }
        for (const output of result.output) {
          const event: OutputEvent = {
            protocolVersion: PROTOCOL_VERSION,
            id: request.id,
            kind: "output",
            stream: output.stream,
            text: output.text,
          };
          workerScope.postMessage(event);
        }
        const raw = valueToSnapshot(result.value);
        postSuccess(
          request.id,
          {
            kind: "evaluation",
            result: {
              raw,
              visible: result.visible,
              warnings: result.warnings,
              output: result.output,
              dataViews: result.dataViews,
              browseRequests: result.browseRequests,
              graphics: result.graphics,
              elapsedMs: result.elapsedMs,
              runtimeReset: false,
            },
          },
          [
            ...snapshotTransferables(raw),
            ...result.browseRequests.flatMap((event) =>
              event.kind === "file" ? [event.bytes.buffer as ArrayBuffer] : [],
            ),
            ...result.graphics.flatMap((event) =>
              event.kind === "raster" ? [event.rgba.buffer as ArrayBuffer] : [],
            ),
          ],
        );
        return;
      }
      case "assign":
        await runtime.assign(request.name, request.value);
        postSuccess(request.id, { kind: "void" });
        return;
      case "get": {
        const value = valueToSnapshot(await runtime.get(request.name));
        postSuccess(request.id, { kind: "value", value }, snapshotTransferables(value));
        return;
      }
      case "call": {
        const value = valueToSnapshot(await runtime.call(request.name, request.arguments));
        postSuccess(request.id, { kind: "value", value }, snapshotTransferables(value));
        return;
      }
      case "capabilities":
        postSuccess(request.id, { kind: "capabilities", value: runtime.capabilities() });
        return;
      case "reset":
        runtime.reset();
        postSuccess(request.id, { kind: "void" });
        return;
      case "dispose":
        runtime.dispose();
        host = undefined;
        postSuccess(request.id, { kind: "void" });
        setTimeout(() => workerScope.close(), 0);
        return;
    }
  } catch (error) {
    postError(request.id, error);
  }
}

function requestSystemCommand(
  request: PublicSystemCommandRequest,
): Promise<PublicSystemCommandResult> {
  const id = `system-${nextSystemCommandId++}`;
  return new Promise((resolve, reject) => {
    pendingSystemCommands.set(id, { resolve, reject });
    const event: SystemCommandEvent = {
      protocolVersion: PROTOCOL_VERSION,
      id,
      kind: "system-command",
      request,
    };
    workerScope.postMessage(event);
  });
}

function resolveSystemCommand(response: SystemCommandResultRequest): void {
  const pending = pendingSystemCommands.get(response.id);
  if (pending === undefined) return;
  pendingSystemCommands.delete(response.id);
  if ("error" in response) {
    pending.reject(new NativRError(response.error.code, response.error.message));
  } else {
    pending.resolve(response.result);
  }
}

function requestNativeCall(request: PublicNativeCallRequest): Promise<PublicNativeCallResult> {
  const id = `native-${nextNativeCallId++}`;
  return new Promise((resolve, reject) => {
    pendingNativeCalls.set(id, { resolve, reject });
    const event: NativeCallEvent = {
      protocolVersion: PROTOCOL_VERSION,
      id,
      kind: "native-call",
      request,
    };
    workerScope.postMessage(event);
  });
}

function resolveNativeCall(response: NativeCallResultRequest): void {
  const pending = pendingNativeCalls.get(response.id);
  if (pending === undefined) return;
  pendingNativeCalls.delete(response.id);
  if ("error" in response) {
    pending.reject(new NativRError(response.error.code, response.error.message));
  } else {
    pending.resolve(response.result);
  }
}

function requestReadline(prompt: string): Promise<string> {
  const id = `readline-${nextReadlineId++}`;
  return new Promise((resolve, reject) => {
    pendingReadlines.set(id, { resolve, reject });
    const event: ReadlineEvent = {
      protocolVersion: PROTOCOL_VERSION,
      id,
      kind: "readline",
      request: { prompt },
    };
    workerScope.postMessage(event);
  });
}

function resolveReadline(response: ReadlineResultRequest): void {
  const pending = pendingReadlines.get(response.id);
  if (pending === undefined) return;
  pendingReadlines.delete(response.id);
  if ("error" in response) {
    pending.reject(new NativRError(response.error.code, response.error.message));
  } else {
    pending.resolve(response.value);
  }
}

function requestUrl(request: PublicUrlRequest): Promise<PublicUrlResult> {
  const id = `url-${nextUrlId++}`;
  return new Promise((resolve, reject) => {
    pendingUrls.set(id, { resolve, reject });
    const event: UrlEvent = {
      protocolVersion: PROTOCOL_VERSION,
      id,
      kind: "url",
      request,
    };
    workerScope.postMessage(event);
  });
}

function resolveUrl(response: UrlResultRequest): void {
  const pending = pendingUrls.get(response.id);
  if (pending === undefined) return;
  pendingUrls.delete(response.id);
  if ("error" in response) {
    pending.reject(new NativRError(response.error.code, response.error.message));
  } else {
    pending.resolve(response.result);
  }
}

function requestSocket(request: PublicSocketRequest): Promise<PublicSocketResult> {
  const id = `socket-${nextSocketId++}`;
  return new Promise((resolve, reject) => {
    pendingSockets.set(id, { resolve, reject });
    const event: SocketEvent = {
      protocolVersion: PROTOCOL_VERSION,
      id,
      kind: "socket",
      request,
    };
    workerScope.postMessage(event, request.operation === "write" ? [request.bytes.buffer] : []);
  });
}

function resolveSocket(response: SocketResultRequest): void {
  const pending = pendingSockets.get(response.id);
  if (pending === undefined) return;
  pendingSockets.delete(response.id);
  if ("error" in response) {
    pending.reject(new NativRError(response.error.code, response.error.message));
  } else {
    pending.resolve(response.result);
  }
}

function requireHost(): RuntimeHost {
  if (host === undefined) {
    throw new NativRError("NRW7006", "Worker runtime has not been initialized.");
  }
  return host;
}

function postSuccess(
  id: string,
  payload: WorkerSuccessPayload,
  transferables: Transferable[] = [],
): void {
  const response: SuccessResponse = {
    protocolVersion: PROTOCOL_VERSION,
    id,
    kind: "success",
    payload,
  };
  workerScope.postMessage(response, transferables);
}

function postError(id: string, error: unknown): void {
  const response: ErrorResponse = {
    protocolVersion: PROTOCOL_VERSION,
    id,
    kind: "error",
    error: serializeError(error, debug),
  };
  workerScope.postMessage(response);
}
