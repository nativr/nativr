import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createR, type NativRSession } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

let runtime: NativRSession;

beforeEach(async () => {
  runtime = await createR({ execution: "inline", assets });
});

afterEach(async () => {
  await runtime.dispose();
});

async function output(code: string): Promise<string> {
  const result = await runtime.evalDetailed(code);
  return result.output.map((event) => event.text).join("");
}

describe("local calling handlers", () => {
  it("runs handlers innermost first in place and resumes the signalling code", async () => {
    await expect(
      runtime.eval(`local({
        tr <- character()
        value <- withCallingHandlers(
          withCallingHandlers({ warning("w"); tr <- c(tr, "resumed"); 1L },
            warning = function(w) tr <<- c(tr, "inner")),
          warning = function(w) { tr <<- c(tr, "outer"); invokeRestart("muffleWarning") })
        c(tr, value)
      })`),
    ).resolves.toEqual(["inner", "outer", "resumed", "1"]);
  });

  it("offers a condition to the handlers of one call in argument order", async () => {
    await expect(
      runtime.eval(`local({
        tr <- character()
        withCallingHandlers(message("m"),
          condition = function(c) tr <<- c(tr, "condition"),
          message = function(m) { tr <<- c(tr, "message"); invokeRestart("muffleMessage") })
        tr
      })`),
    ).resolves.toEqual(["condition", "message"]);
  });

  it("hides the handler's own frame and the frames above it while it runs", async () => {
    await expect(
      runtime.eval(`local({
        tr <- character()
        withCallingHandlers(
          withCallingHandlers(warning("first"), warning = function(w) {
            tr <<- c(tr, paste("inner", conditionMessage(w)))
            if (conditionMessage(w) == "first") warning("second")
            invokeRestart("muffleWarning")
          }),
          warning = function(w) { tr <<- c(tr, paste("outer", conditionMessage(w))); invokeRestart("muffleWarning") })
        tr
      })`),
    ).resolves.toEqual(["inner first", "outer second"]);
  });

  it("keeps the default action when a handler returns", async () => {
    await expect(
      output('withCallingHandlers(message("hi"), message = function(m) cat("saw "))'),
    ).resolves.toBe("saw hi\n");
    const result = await runtime.evalDetailed(
      'f <- function() { withCallingHandlers(warning("kept"), warning = function(w) NULL); 1 }; f()',
    );
    expect(result.warnings.map((warning) => warning.message)).toEqual(["kept"]);
  });

  it("nests with exiting handlers and suppression frames by stack position", async () => {
    await expect(
      runtime.eval(`c(
        tryCatch(withCallingHandlers(stop("e"), error = function(e) NULL), error = function(e) "exited"),
        local({ tr <- "none"; withCallingHandlers(tryCatch(stop("x"), error = function(e) NULL),
          error = function(e) tr <<- "saw"); tr }),
        local({ tr <- "none"; suppressWarnings(withCallingHandlers(warning("q"),
          warning = function(w) tr <<- "ran")); tr }),
        local({ tr <- "none"; withCallingHandlers(suppressWarnings(warning("q")),
          warning = function(w) tr <<- "ran"); tr }))`),
    ).resolves.toEqual(["exited", "none", "ran", "none"]);
  });

  it("runs an error handler for stop() before on.exit cleanup", async () => {
    await expect(
      output(`f <- function() { on.exit(cat("cleanup\\n")); stop("boom") }
        invisible(try(withCallingHandlers(f(), error = function(e) cat("handler\\n")), silent = TRUE))`),
    ).resolves.toBe("handler\ncleanup\n");
  });

  it("delivers builtin errors to local handlers as they unwind", async () => {
    await expect(
      runtime.eval(`local({
        seen <- NULL
        try(withCallingHandlers(log("a"), error = function(e) seen <<- class(e)[[2L]]), silent = TRUE)
        seen
      })`),
    ).resolves.toBe("error");
  });

  it("signals custom conditions through signalCondition()", async () => {
    await expect(
      runtime.eval(`local({
        cnd <- structure(class = c("custom", "condition"), list(message = "hello", call = NULL))
        tr <- character()
        value <- withCallingHandlers(signalCondition(cnd), custom = function(c) tr <<- conditionMessage(c))
        c(tr, is.null(value), tryCatch(signalCondition(cnd), custom = function(c) "exited"))
      })`),
    ).resolves.toEqual(["hello", "TRUE", "exited"]);
  });

  it("rejects unnamed handlers", async () => {
    await expect(runtime.eval("withCallingHandlers(1, 2)")).rejects.toThrow(
      "condition handlers must be specified with a condition class",
    );
  });
});

describe("restarts", () => {
  it("lists muffle restarts innermost first and transfers control with values", async () => {
    await expect(
      runtime.eval(`local({
        nm <- function(r) unclass(r)[[1L]]
        seen <- NULL
        withCallingHandlers(warning("w"), warning = function(w) {
          seen <<- vapply(computeRestarts(w), nm, "")
          invokeRestart(computeRestarts(w)[[1L]])
        })
        c(seen,
          vapply(withRestarts(withRestarts(computeRestarts(), a = function() 1), b = function() 2), nm, ""),
          withRestarts(invokeRestart("add", 1, 2), add = function(x, y) as.character(x + y)),
          withRestarts(withCallingHandlers(stop("boom"),
            error = function(e) invokeRestart("recover", conditionMessage(e))),
            recover = function(m) m))
      })`),
    ).resolves.toEqual(["muffleWarning", "abort", "a", "b", "abort", "3", "boom"]);
  });

  it("builds restart objects and finds them by name", async () => {
    await expect(
      runtime.eval(`withRestarts({
        r <- findRestart("mine")
        c(names(unclass(r)), r$description, isRestart(r), is.null(findRestart("absent")))
      }, mine = list(handler = function() 1, description = "described"))`),
    ).resolves.toEqual([
      "name",
      "exit",
      "handler",
      "description",
      "test",
      "interactive",
      "described",
      "TRUE",
      "TRUE",
    ]);
    await expect(
      output("withRestarts({ print(computeRestarts()[[1L]]); NULL }, mine = function() 1)"),
    ).resolves.toBe("<restart: mine >\n");
  });

  it("reports missing restarts and restarts that left the stack", async () => {
    await expect(runtime.eval('invokeRestart("muffleWarning")')).rejects.toThrow(
      "no 'restart' 'muffleWarning' found",
    );
    await expect(
      runtime.eval(`local({
        saved <- withRestarts(computeRestarts()[[1L]], gone = function() 1)
        invokeRestart(saved)
      })`),
    ).rejects.toThrow("restart not on stack");
    await expect(
      runtime.eval(
        'c(is.null(tryInvokeRestart("absent")), withRestarts(tryInvokeRestart("r", 2), r = function(x) x + 1))',
      ),
    ).resolves.toEqual([1, 3]);
    await expect(runtime.eval("withRestarts(1, 2)")).rejects.toThrow(
      "not a valid restart specification",
    );
  });
});

describe("options(warn)", () => {
  it("reports warnings immediately at level 1", async () => {
    const result = await runtime.evalDetailed(`local({
      op <- options(warn = 1)
      f <- function() { warning("now"); cat("after\\n") }
      f()
      g <- function() warning(strrep("x", 60))
      g()
      options(op)
    })`);
    expect(result.output.map((event) => event.text).join("")).toBe(
      `Warning in f() : now\nafter\nWarning in g() :\n  ${"x".repeat(60)}\n`,
    );
    expect(result.warnings).toEqual([]);
  });

  it("converts unhandled warnings to errors at level 2 after handlers run", async () => {
    await expect(
      runtime.eval(`local({
        op <- options(warn = 2)
        f <- function() { warning("bad"); "unreached" }
        r <- c(
          tryCatch(f(), error = function(e) paste(conditionMessage(e), deparse(conditionCall(e)))),
          tryCatch(f(), warning = function(w) "warning handler"),
          tryCatch(suppressWarnings(f()), error = function(e) "error"),
          tryCatch(as.integer("x"), error = function(e) class(e)[[1L]]))
        options(op)
        r
      })`),
    ).resolves.toEqual([
      "(converted from warning) bad f()",
      "warning handler",
      "unreached",
      "simpleError",
    ]);
  });

  it("drops warnings at negative levels and validates the option", async () => {
    const result = await runtime.evalDetailed(
      'local({ op <- options(warn = -1); warning("gone"); options(warn = 1.9); v <- getOption("warn"); options(op); v })',
    );
    expect(result.value).toBe(1);
    expect(result.warnings).toEqual([]);
    await expect(runtime.eval('options(warn = "a")')).rejects.toThrow("invalid value for 'warn'");
  });
});
