import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("exits warning and message expressions with ordered handlers and eager handler promises", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    const result = await r.evalDetailed(`local({
      seen<-character()
      value<-tryCatch({seen<-c(seen,"expr");warning("warn",call.=FALSE);stop("after warning")},
        warning={seen<-c(seen,"force warning");function(w){seen<<-c(seen,"handler");conditionMessage(w)}},
        error={seen<-c(seen,"force error");function(e)"error"},
        finally={seen<-c(seen,"finally")})
      custom<-warningCondition("custom",detail=3L,class="fixture")
      customMessage<-structure(list(message="custom",call=NULL,detail=4L),class=c("fixture","message","condition"))
      c(identical(value,"warn"),
        identical(seen,c("force warning","force error","expr","handler","finally")),
        identical(tryCatch(message("message"),message=conditionMessage),"message\\n"),
        identical(tryCatch(message("bare",appendLF=FALSE),message=conditionMessage),"bare"),
        identical(tryCatch(message(customMessage),fixture=identity),customMessage),
        identical(tryCatch(warning(custom),fixture=identity,warning=function(w)NULL),custom),
        identical(tryCatch(warning("a",call.=FALSE),condition=function(c)"condition",warning=function(w)"warning"),"condition"),
        identical(tryCatch(warning("a",call.=FALSE),warning=function(w)"warning",condition=function(c)"condition"),"warning"))
    })`);
    expect(result.value).toEqual(Array(8).fill(true));
    expect(result.warnings).toEqual([]);
    expect(result.output).toEqual([]);
  } finally {
    await r.dispose();
  }
});

it("keeps pending resource failures uncatchable through finally and on.exit conditions", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 1000 } });
  try {
    for (const source of [
      'tryCatch(tryCatch(rep(1,2000),finally=warning("cleanup",call.=FALSE)),warning=function(w)42)',
      'tryCatch((function(){on.exit(message("cleanup"));rep(1,2000)})(),message=function(m)42)',
      'tryCatch(tryCatch(rep(1,2000),finally=stop("cleanup",call.=FALSE)),error=function(e)42)',
    ]) {
      await expect(r.eval(source)).rejects.toMatchObject({ code: "NRL4002" });
    }
    expect(await r.eval('tryCatch(warning("fresh",call.=FALSE),warning=conditionMessage)')).toBe(
      "fresh",
    );
  } finally {
    await r.dispose();
  }
});

it("retains later handlers while unwinding callbacks and runs finally after handlers", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      seen<-character()
      value<-tryCatch(tryCatch(warning("first",call.=FALSE),
        warning=function(w){seen<<-c(seen,"inner");warning("second",call.=FALSE);2},
        finally={seen<-c(seen,"finally")}),
        warning=function(w){seen<<-c(seen,conditionMessage(w));3})
      forced<-tryCatch(tryCatch(1,warning={warning("force",call.=FALSE);function(w)2},
        finally={seen<-c(seen,"force finally")}),warning=conditionMessage)
      c(identical(value,3),identical(seen,c("inner","finally","second","force finally")),
        identical(forced,"force"),
        identical(tryCatch(warning("a",call.=FALSE),warning=function(w)stop("raised",call.=FALSE),error=conditionMessage),"raised"),
        identical(tryCatch(tryCatch(warning("a",call.=FALSE),error=function(e)"bad",warning=function(w)stop("raised",call.=FALSE)),error=conditionMessage),"raised"),
        identical(tryCatch(warning("a",call.=FALSE),warning=function(w)warning("b",call.=FALSE),warning=conditionMessage),"b"),
        identical(tryCatch(tryCatch(warning("a",call.=FALSE),warning=NULL),error=conditionMessage),"attempt to apply non-function"))
    })`),
    ).toEqual(Array(7).fill(true));
  } finally {
    await r.dispose();
  }
});

it("preserves visibility and removes condition frames after success, errors, and return", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      f<-function()tryCatch(return(7L),warning=function(w)"stale",finally=NULL)
      c(!withVisible(tryCatch(invisible(1),warning=function(w)2))$visible,
        !withVisible(tryCatch(warning("a",call.=FALSE),warning=function(w)invisible(2)))$visible,
        !withVisible(tryCatch(invisible(3),finally=4))$visible,
        identical(f(),7L),
        identical(tryCatch(warning("new",call.=FALSE),warning=conditionMessage),"new"),
        identical(tryCatch(tryCatch(stop("error",call.=FALSE),warning=function(w)"stale"),error=conditionMessage),"error"),
        identical(tryCatch(message("new"),message=conditionMessage),"new\\n"))
    })`),
    ).toEqual(Array(7).fill(true));
    const after = await r.evalDetailed('warning("uncaught",call.=FALSE)');
    expect(after.warnings).toEqual([{ code: "NRW1100", message: "uncaught" }]);
  } finally {
    await r.dispose();
  }
});

it("keeps pending handlers available until inner finally and on.exit cleanup finish", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      pending<-tryCatch(tryCatch(warning("first",call.=FALSE),finally=warning("second",call.=FALSE)),
        warning=function(w)paste0("warning:",conditionMessage(w)),condition=function(c)"wrong handler")
      f<-function(){on.exit(message("cleanup"));warning("first",call.=FALSE)}
      inner<-tryCatch(tryCatch(f(),message=function(m)paste0("inner:",conditionMessage(m))),
        warning=function(w)"wrong handler")
      g<-function(){on.exit(stop("cleanup",call.=FALSE));warning("first",call.=FALSE)}
      errored<-tryCatch(tryCatch(g(),error=function(e)paste0("inner:",conditionMessage(e))),
        warning=function(w)"wrong handler")
      c(identical(pending,"warning:second"),identical(inner,"inner:cleanup\\n"),
        identical(errored,"inner:cleanup"))
    })`),
    ).toEqual(Array(3).fill(true));
  } finally {
    await r.dispose();
  }
});
