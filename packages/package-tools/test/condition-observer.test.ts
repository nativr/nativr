import { afterEach, describe, expect, it } from "vitest";

import { createR, type NativRSession } from "../../nativr/src/index.js";
import {
  decodePackageConditions,
  packageConditionObserverRead,
  packageConditionObserverSetup,
} from "../../../scripts/lib/package-condition-observer.mjs";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession | undefined;
afterEach(async () => runtime?.dispose());

async function capture(source: string) {
  runtime = await createR({ execution: "inline", assets });
  await runtime.eval(packageConditionObserverSetup);
  const result = await runtime.evalDetailed(source, { topLevelErrorHandling: "option" });
  return {
    result,
    ...decodePackageConditions(await runtime.evalRaw(packageConditionObserverRead), true),
  };
}

const ordered = [
  "options(error = function() invisible(NULL))",
  'warning("before", call. = FALSE)',
  'fail <- function() stop("handled")',
  "fail()",
  'warning("after", call. = FALSE)',
  "invisible(NULL)",
].join("\n");
const expected = [
  {
    kind: "warning",
    classes: ["simpleWarning", "warning", "condition"],
    message: "before",
    call: null,
  },
  {
    kind: "error",
    classes: ["simpleError", "error", "condition"],
    message: "handled",
    call: "fail()",
    handled: true,
  },
  {
    kind: "warning",
    classes: ["simpleWarning", "warning", "condition"],
    message: "after",
    call: null,
  },
];

it("retains condition order, classes, calls and returning error-handler evidence", async () => {
  const observed = await capture(ordered);
  expect(observed.conditionsComplete).toBe(true);
  expect(observed.conditions).toEqual(expected);
  expect(observed.result.topLevelErrors).toHaveLength(1);
});

it("does not add global bindings or observe conditions consumed by source handlers", async () => {
  const observed = await capture(`
    stopifnot(length(ls(all.names = TRUE)) == 0L)
    suppressWarnings(warning("muffled"))
    invisible(tryCatch(stop("caught"), error = function(e) NULL))
  `);
  expect(observed.conditions).toEqual([]);
  expect(observed.conditionsComplete).toBe(true);
});

it("preserves custom condition classes and supplied calls", async () => {
  const observed = await capture(`
    options(error = function() invisible(NULL))
    stop(structure(list(message = "custom", call = quote(origin(1))), class = c("fixture", "error", "condition")))
  `);
  expect(observed.conditions).toEqual([
    {
      kind: "error",
      classes: ["fixture", "error", "condition"],
      message: "custom",
      call: "origin(1)",
      handled: true,
    },
  ]);
  expect(observed.conditionsComplete).toBe(true);
});

it("does not claim complete observation when source removes the observers", async () => {
  const observed = await capture("globalCallingHandlers(NULL); invisible(NULL)");
  expect(observed.conditionsComplete).toBe(false);
});

it("retains an unhandled error without claiming a complete failed evaluation", async () => {
  runtime = await createR({ execution: "inline", assets });
  await runtime.eval(packageConditionObserverSetup);
  await expect(runtime.eval('fail <- function() stop("unhandled"); fail()')).rejects.toThrow(
    "unhandled",
  );
  const observed = decodePackageConditions(
    await runtime.evalRaw(packageConditionObserverRead),
    false,
  );
  expect(observed.conditionsComplete).toBe(false);
  expect(observed.conditions).toEqual([
    {
      kind: "error",
      classes: ["simpleError", "error", "condition"],
      message: "unhandled",
      call: "fail()",
      handled: false,
    },
  ]);
});

describe.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")("native condition parity", () => {
  it("matches independently observed ordered conditions in GNU R 4.6.1", async () => {
    const native = await capturePackageOracleScript({
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      source: ordered,
    });
    const actual = await capture(ordered);
    expect(native.status).toBe("completed");
    expect(native.conditions).toEqual(expected);
    expect(actual.conditions).toEqual(native.conditions);
  });
});

const accessorCases = [
  {
    id: "condition-accessors-basic",
    code: 'local({ e<-simpleError("text",quote(origin(1))); c(names(formals(conditionCall)),names(formals(conditionMessage)),deparse(conditionCall(e)),conditionMessage(e),is.null(conditionCall(simpleWarning("w")))) })',
    expected: ["c", "c", "origin(1)", "text", "TRUE"],
  },
  {
    id: "condition-accessors-fields",
    code: 'local({ e<-structure(list(message=1,call="text"),class="condition"); empty<-structure(list(),class="condition"); c(identical(conditionMessage(e),1),identical(conditionCall(e),"text"),is.null(conditionMessage(empty)),is.null(conditionCall(empty))) })',
    expected: [true, true, true, true],
  },
  {
    id: "condition-accessors-s3",
    code: 'local({ conditionCall.fixture<-function(c) invisible(quote(overridden(2))); conditionMessage.fixture<-function(c) paste0("custom:",c$message); e<-structure(list(message="text",call=NULL),class=c("fixture","condition")); v<-withVisible(conditionCall(e)); c(deparse(v$value),v$visible,conditionMessage(e)) })',
    expected: ["overridden(2)", "FALSE", "custom:text"],
  },
  {
    id: "condition-accessors-reject-unclassed",
    code: 'c(tryCatch(conditionCall(list(call=quote(x()))),error=function(e)conditionMessage(e)),tryCatch(conditionMessage("text"),error=function(e)conditionMessage(e)))',
    expected: [
      "no applicable method for 'conditionCall' applied to an object of class \"list\"",
      "no applicable method for 'conditionMessage' applied to an object of class \"character\"",
    ],
  },
];
it.each(accessorCases)("$id", async ({ code, expected }) => {
  runtime = await createR({ execution: "inline", assets });
  expect(await runtime.eval(code)).toEqual(expected);
});
