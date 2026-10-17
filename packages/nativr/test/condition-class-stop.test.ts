import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("preserves caller expressions and custom warnings in condition handlers", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
      caught <- NULL
      globalCallingHandlers(warning = function(w) caught <<- w)
      f <- function() warning("nested warning")
      f()
      warningCall <- caught$call
      custom <- warningCondition("custom", call = quote(probe(2L)), detail = 2L, class = "probe_warning")
      warning(custom)
      customPreserved <- identical(caught, custom)
      g <- function() stop("nested failure")
      h <- function() stop("hidden", call. = FALSE)
      c(identical(warningCall, quote(f())), customPreserved,
        tryCatch(g(), error = function(e) identical(e$call, quote(g()))),
        tryCatch(h(), error = function(e) is.null(e$call)))
    `),
    ).toEqual([true, true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("preserves a signalled condition and selects the first matching class handler", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        cond <- structure(
          list(message = "oops", call = NULL, code = 7L),
          class = c("assertError", "error", "condition")
        )
        c(
          tryCatch(stop(cond), assertError = function(e) identical(class(e), c("assertError", "error", "condition")), error = function(e) FALSE),
          tryCatch(stop(cond), assertError = function(e) identical(conditionMessage(e), "oops"), error = function(e) FALSE),
          tryCatch(stop(cond), assertError = function(e) identical(e$code, 7L), error = function(e) FALSE),
          identical(tryCatch(stop(cond), error = function(e) "error", assertError = function(e) "assert"), "error"),
          identical(tryCatch(stop(cond), assertError = function(e) "assert", error = function(e) "error"), "assert"),
          identical(tryCatch(stop("bad"), assertError = function(e) "assert", error = function(e) "error"), "error")
        )
      `),
    ).resolves.toEqual([true, true, true, true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("preserves custom condition classes in global handlers for ordinary and continued errors", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await runtime.eval(`
      seen <- character()
      globalCallingHandlers(error = function(e) seen <<- c(seen, paste(class(e), collapse = ",")))
    `);
    const stopCustom = `stop(structure(
      list(message = "oops", call = NULL),
      class = c("customError", "error", "condition")
    ))`;
    await expect(runtime.eval(stopCustom)).rejects.toMatchObject({
      code: "NRE2300",
      message: "oops",
    });
    expect(await runtime.eval("seen")).toBe("customError,error,condition");

    await runtime.eval("options(error = function() NULL)");
    const result = await runtime.evalDetailed(`${stopCustom}\nmarker <- 7L\nmarker`, {
      topLevelErrorHandling: "option",
    });
    expect(result.value).toBe(7);
    expect(result.topLevelErrors).toEqual([
      { expressionIndex: 1, code: "NRE2300", message: "oops" },
    ]);
    expect(await runtime.eval('paste(seen, collapse = ";")')).toBe(
      "customError,error,condition;customError,error,condition",
    );
  } finally {
    await runtime.dispose();
  }
});
