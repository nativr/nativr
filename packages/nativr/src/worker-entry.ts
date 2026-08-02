/// <reference lib="webworker" />

import { PROTOCOL_VERSION, isWorkerRequest } from "@nativr/protocol";
import type {
  ErrorResponse,
  OutputEvent,
  ReadlineEvent,
  ReadlineResultRequest,
  SuccessResponse,
  SystemCommandEvent,
  SystemCommandResultRequest,
  WarningEvent,
  WorkerRequest,
  WorkerSuccessPayload,
  PublicSystemCommandRequest,
  PublicSystemCommandResult,
} from "@nativr/protocol";
import { NativRError } from "@nativr/runtime";

import { serializeError, snapshotTransferables, valueToSnapshot } from "./conversion.js";
import { RuntimeHost } from "./runtime-host.js";

const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope;
let host: RuntimeHost | undefined;
let debug = false;
let queue: Promise<void> = Promise.resolve();
let nextSystemCommandId = 1;
let nextReadlineId = 1;
const pendingSystemCommands = new Map<
  string,
  {
    readonly resolve: (result: PublicSystemCommandResult) => void;
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

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  const immediate = event.data;
  if (isWorkerRequest(immediate) && immediate.kind === "system-command-result") {
    resolveSystemCommand(immediate);
    return;
  }
  if (isWorkerRequest(immediate) && immediate.kind === "readline-result") {
    resolveReadline(immediate);
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
        requestSystemCommand,
        request.readline === true ? requestReadline : undefined,
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
        runtime.assign(request.name, request.value);
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
