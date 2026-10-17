import { PROTOCOL_VERSION, type WorkerRequest } from "@nativr/protocol";
import { expect, it, vi } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("prints condition calls and closure traces for continued errors", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await runtime.eval(`
      options(error = function() NULL)
      f <- function(x) g(x)
      g <- function(x) stop("boom")
      h <- function() stop("hidden", call. = FALSE)
      long <- function() stop(paste(rep("x", 60), collapse = ""))
      invisible(NULL)
    `);
    const result = await runtime.evalDetailed(
      `
      f(2)
      h()
      long()
      stop(simpleError("explicit", call = quote(probe(3L))))
      7L
    `,
      { topLevelErrorHandling: "option" },
    );
    expect(result.value).toBe(7);
    expect(result.output).toEqual([
      { stream: "stderr", text: "Error in g(x) : boom\nCalls: f -> g\n" },
      { stream: "stderr", text: "Error: hidden\n" },
      { stream: "stderr", text: `Error in long() : \n  ${"x".repeat(60)}\n` },
      { stream: "stderr", text: "Error in probe(3L) : explicit\n" },
    ]);
  } finally {
    await runtime.dispose();
  }
});

it("continues only in opt-in top-level mode with a callable error option", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const normal = await runtime.evalDetailed("marker <- 1L\nmarker");
    expect(normal.topLevelErrors).toEqual([]);
    await expect(
      runtime.evalDetailed("1L", { printVisibleTopLevel: "yes" as never }),
    ).rejects.toThrow("printVisibleTopLevel must be a boolean");
    const printed = await runtime.evalDetailed("1L\ninvisible(2L)\nprint(3L)", {
      printVisibleTopLevel: true,
    });
    expect(printed.output).toEqual([
      { stream: "stdout", text: "[1] 1\n" },
      { stream: "stdout", text: "[1] 3\n" },
    ]);
    await runtime.eval("handled <- 0L; options(error=function() handled <<- handled + 1L)");
    await expect(runtime.evalDetailed('stop("ordinary")\nmarker <- 2L')).rejects.toThrow(
      "ordinary",
    );
    expect(await runtime.eval("c(marker, handled)")).toEqual([1, 0]);

    const script = await runtime.evalDetailed(
      'stop("first", call. = FALSE)\nstop("second", call. = FALSE)\nmarker <- 3L\nmarker',
      { topLevelErrorHandling: "option" },
    );
    expect(script.value).toBe(3);
    expect(script.topLevelErrors).toEqual([
      { expressionIndex: 1, code: "NRE2300", message: "first" },
      { expressionIndex: 2, code: "NRE2300", message: "second" },
    ]);
    expect(script.output).toEqual([
      { stream: "stderr", text: "Error: first\n" },
      { stream: "stderr", text: "Error: second\n" },
    ]);
    expect(await runtime.eval("c(marker, handled)")).toEqual([3, 2]);

    await runtime.eval("options(error=NULL); invisible(NULL)");
    await expect(
      runtime.evalDetailed('stop("unhandled")\nmarker <- 4L', {
        topLevelErrorHandling: "option",
      }),
    ).rejects.toThrow("unhandled");
    expect(await runtime.eval("marker")).toBe(3);
    await runtime.eval("options(error=1L); invisible(NULL)");
    await expect(
      runtime.evalDetailed('stop("noncallable")\nmarker <- 5L', {
        topLevelErrorHandling: "option",
      }),
    ).rejects.toThrow("noncallable");
    expect(await runtime.eval("marker")).toBe(3);
  } finally {
    await runtime.dispose();
  }
});

it("uses base print for implicit output while explicit print remains lexical", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(
      'print <- function(x) cat("CUSTOM\\n")\n1L\nprint(2L)',
      { printVisibleTopLevel: true },
    );
    expect(result.output).toEqual([
      { stream: "stdout", text: "[1] 1\n" },
      { stream: "stdout", text: "CUSTOM\n" },
    ]);
    expect(result.topLevelErrors).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});

it("prints parenthesized assignment results and preserves their language call", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed("x <- 1:3\n(x[2:3] <- 9L)\n(invisible(3L))", {
      printVisibleTopLevel: true,
    });
    expect(result.output).toEqual([
      { stream: "stdout", text: "[1] 9\n" },
      { stream: "stdout", text: "[1] 3\n" },
    ]);
    expect(await runtime.eval("as.character(quote((x))[[1L]])")).toBe("(");
  } finally {
    await runtime.dispose();
  }
});

it("carries opt-in evaluation flags and structured errors through the Worker API", async () => {
  const sent: WorkerRequest[] = [];
  class FakeWorker {
    readonly #messageListeners: ((event: MessageEvent<unknown>) => void)[] = [];

    public addEventListener(type: string, listener: (event: MessageEvent<unknown>) => void): void {
      if (type === "message") this.#messageListeners.push(listener);
    }

    public postMessage(request: WorkerRequest): void {
      sent.push(request);
      const payload =
        request.kind === "init"
          ? { kind: "ready" }
          : request.kind === "eval"
            ? {
                kind: "evaluation",
                result: {
                  raw: { version: 1, type: "integer", values: new Int32Array([5]) },
                  visible: true,
                  ...(request.code === "old"
                    ? {}
                    : {
                        topLevelErrors: [
                          { expressionIndex: 2, code: "NRE2300", message: "handled in worker" },
                        ],
                      }),
                  warnings: [],
                  output: [{ stream: "stderr", text: "Error : handled in worker\n" }],
                  elapsedMs: 1,
                  runtimeReset: false,
                },
              }
            : { kind: "void" };
      queueMicrotask(() => {
        const event = {
          data: { protocolVersion: PROTOCOL_VERSION, id: request.id, kind: "success", payload },
        };
        for (const listener of this.#messageListeners) listener(event as MessageEvent<unknown>);
      });
    }

    public terminate(): void {}
  }
  vi.stubGlobal("Worker", FakeWorker);
  try {
    const runtime = await createR({ assets });
    try {
      const result = await runtime.evalDetailed("5L", {
        topLevelErrorHandling: "option",
        printVisibleTopLevel: true,
      });
      expect(sent.find((request) => request.kind === "eval")).toMatchObject({
        kind: "eval",
        code: "5L",
        topLevelErrorHandling: "option",
        printVisibleTopLevel: true,
      });
      expect(result.value).toBe(5);
      expect(result.topLevelErrors).toEqual([
        { expressionIndex: 2, code: "NRE2300", message: "handled in worker" },
      ]);
      expect(result.output).toEqual([{ stream: "stderr", text: "Error : handled in worker\n" }]);
      const olderWorkerResult = await runtime.evalDetailed("old");
      expect(olderWorkerResult.topLevelErrors).toEqual([]);
      const sentBeforeInvalidOption = sent.length;
      await expect(
        runtime.evalDetailed("5L", { topLevelErrorHandling: "always" as never }),
      ).rejects.toThrow('topLevelErrorHandling must be "option"');
      expect(sent).toHaveLength(sentBeforeInvalidOption);
    } finally {
      await runtime.dispose();
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
