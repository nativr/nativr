import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("removes internal warnings from the deferred list only when a handler consumes them", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    const caught = await r.evalDetailed(
      'tryCatch(as.integer("a"), warning = function(w) "caught")',
    );
    expect(caught.value).toBe("caught");
    expect(caught.warnings).toEqual([]);

    const muffled = await r.evalDetailed('suppressWarnings(as.integer("a"))');
    expect(muffled.value).toEqual({ __nativr__: "NA" });
    expect(muffled.warnings).toEqual([]);

    // A handler for another class leaves the warning pending for top-level reporting.
    const unhandled = await r.evalDetailed('tryCatch(sqrt(-1), error = function(e) "error")');
    expect(unhandled.value).toBeNaN();
    expect(unhandled.warnings).toHaveLength(1);
    expect(unhandled.warnings[0]?.code).toBe("NRW1003");

    // A class filter that does not match keeps the warning, and warning() records it once.
    const filtered = await r.evalDetailed(
      'suppressWarnings(warning("plain", call. = FALSE), classes = "fixture")',
    );
    expect(filtered.warnings).toEqual([{ code: "NRW1100", message: "plain" }]);
  } finally {
    await r.dispose();
  }
});

it("delivers internal warnings and startup messages to session calling handlers", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    const result = await r.evalDetailed(`local({
      seen <- character()
      globalCallingHandlers(
        warning = function(w) seen <<- c(seen, conditionMessage(w)),
        packageStartupMessage = function(m) seen <<- c(seen, "startup"))
      log(-1)
      suppressWarnings(log(-1))
      packageStartupMessage("hello")
      suppressPackageStartupMessages(packageStartupMessage("hidden"))
      globalCallingHandlers(NULL)
      seen
    })`);
    // Muffled conditions never reach the outermost (session) handlers.
    expect(result.value).toEqual(["NaNs produced", "startup"]);
    expect(result.output).toEqual([{ stream: "message", text: "hello\n" }]);
  } finally {
    await r.dispose();
  }
});

it("emits the require() startup message before attaching and only once", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    const first = await r.evalDetailed("require(tools)");
    expect(first.value).toBe(true);
    expect(first.visible).toBe(false);
    expect(first.output).toEqual([
      { stream: "message", text: "Loading required package: tools\n" },
    ]);

    const repeated = await r.evalDetailed("require(tools)");
    expect(repeated.output).toEqual([]);

    const quiet = await r.evalDetailed("require(splines, quietly = TRUE)");
    expect(quiet.output).toEqual([]);
  } finally {
    await r.dispose();
  }
});
