import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independent GNU R 4.6.1 observations of interpreted-closure promise-origin admission.
// These exact 22 inputs were frozen before implementation: 10 baseline mismatches and 12 guards.
// Native wrappers, library/evaluation frames and arbitrary generic diagnostics remain separate.
const cases = [
  [
    "actual-one-hop",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)y;g<-function(x){h(UseMethod("g"));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "actual-two-hop",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({k<-function(z)z;h<-function(y)k(y);g<-function(x){h(UseMethod("g"));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "actual-explicit-selector",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)y;g<-function(x){h(UseMethod("g",1L));99L};g("original")},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "actual-name-before-rejection",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)y;g<-function(x){h(UseMethod(mark("generic","g"),mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "actual-named-selector-first",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)y;g<-function(x){h(UseMethod(object=mark("selector",1L),generic=mark("generic","g")));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "actual-generic-error",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)y;g<-function(x){h(UseMethod(stop("owned generic"),mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "owned generic"), trace = character(0)), \r\n    warnings = character(0)))})',
  ],
  [
    "actual-original-unforced",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)y;g<-function(x){h(UseMethod("g"));99L};g(mark("original",stop("owned original")))},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "actual-selector-error-unforced",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)y;g<-function(x){h(UseMethod("g",stop("owned selector")));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "actual-cleanup-order",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y){on.exit(trace<<-c(trace,"helper cleanup"));y};g<-function(x){on.exit(trace<<-c(trace,"generic cleanup"));h(UseMethod("g"));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = c("helper cleanup", "generic cleanup")), warnings = character(0)))})',
  ],
  [
    "actual-no-force",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)17L;g<-function(x){v<-h(UseMethod("g"));v+1L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 18L, trace = character(0)), warnings = character(0)))})',
  ],
  [
    "actual-in-helper-loop",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y){for(i in 1L)y};g<-function(x){h(UseMethod("g"));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "inner-generic-as-actual",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y)y;g<-function(x){UseMethod("g");99L};h(g(1L))},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = "g method"), warnings = character(0)))})',
  ],
  [
    "inner-generic-two-hop",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({k<-function(z)z;h<-function(y)k(y);g<-function(x){UseMethod("g");99L};h(g(1L))},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = "g method"), warnings = character(0)))})',
  ],
  [
    "inner-generic-in-helper-loop",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y){v<-0L;for(i in 1L)v<-y;v};g<-function(x){UseMethod("g");99L};h(g(1L))},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = "g method"), warnings = character(0)))})',
  ],
  [
    "inner-generic-original-identity",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({token<-new.env();token$v<-13L;h<-function(y)y;g<-function(x){UseMethod("g");99L};g.environment<-function(x){trace<<-c(trace,"environment method");identical(x,token)};h(g(token))},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = TRUE, trace = "environment method"), \r\n    warnings = character(0)))})',
  ],
  [
    "default-own-frame",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y=UseMethod("h")){y;99L};h.default<-function(...) {trace<<-c(trace,"h method");7L};h()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = "h method"), warnings = character(0)))})',
  ],
  [
    "default-own-frame-explicit",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y=UseMethod("h",1L)){y;99L};h.default<-function(...) {trace<<-c(trace,"h method");7L};h()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = "h method"), warnings = character(0)))})',
  ],
  [
    "default-own-frame-name-order",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y=UseMethod(mark("generic","h"),mark("selector",1L))){y;99L};h.default<-function(...) {trace<<-c(trace,"h method");7L};h()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = c("generic", "selector", \r\n"h method")), warnings = character(0)))})',
  ],
  [
    "default-forwarded-to-helper",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({k<-function(z)z;h<-function(y=UseMethod("h")){k(y);99L};h.default<-function(...) {trace<<-c(trace,"h method");7L};h()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "default-generic-call",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y=g(1L))y;g<-function(x){UseMethod("g");99L};h()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = "g method"), warnings = character(0)))})',
  ],
  [
    "default-nested-generic",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({h<-function(y={inner<-function(x){UseMethod("g");99L};inner(1L)})y;h()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = "g method"), warnings = character(0)))})',
  ],
  [
    "retained-actual-after-origin-return",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"g method");7L};value<-tryCatch({maker<-function(x)function()x;g<-function(x)maker(UseMethod("g",1L));thunk<-g(1L);thunk()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = character(0)), warnings = character(0)))})',
  ],
] as const;

it.each(cases)("UseMethod interpreted promise context: %s", async (_name, code) => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000000, maxCallDepth: 128, maxVectorLength: 10000, maxOutputBytes: 65536 },
  });
  try {
    const result = await runtime.evalDetailed(code);
    expect(result.value).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.topLevelErrors).toEqual([]);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

// NativR-only session regression: this is not native interrupted-promise warning parity evidence.
// Retry-warning behavior is deliberately not asserted; the state reset, cache and cleanup are.
it("resets a rejected retained promise before retry, caching and invisible generic recovery", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 100000, maxCallDepth: 128, maxVectorLength: 10000, maxOutputBytes: 65536 },
  });
  try {
    await runtime.eval(
      'state<-new.env(parent=emptyenv());state$allow<-FALSE;state$forced<-0L;trace<-character();maker<-function(x)function(){on.exit(trace<<-c(trace,"thunk-cleanup"));x};origin<-function(){on.exit(trace<<-c(trace,"origin-cleanup"));maker({state$forced<-state$forced+1L;if(!state$allow)UseMethod("origin",1L);23L})};origin.default<-function(...){trace<<-c(trace,"forbidden-method");7L};retained<-origin();NULL',
    );
    await expect(runtime.eval("retained()")).rejects.toThrow(
      "'UseMethod' used in an inappropriate fashion",
    );
    expect(await runtime.eval("sys.nframe()")).toBe(0);
    expect(
      await runtime.eval(
        'identical(trace,c("origin-cleanup","thunk-cleanup"))&&identical(state$forced,1L)',
      ),
    ).toBe(true);

    await runtime.eval("state$allow<-TRUE;NULL");
    const retried = await runtime.evalDetailed("retained()");
    expect(retried.value).toBe(23);
    expect(retried.topLevelErrors).toEqual([]);
    expect(await runtime.eval("state$forced")).toBe(2);
    expect(await runtime.eval("sys.nframe()")).toBe(0);

    // The same promise now has a value: its expression must not run a third time.
    expect(await runtime.eval("retained()")).toBe(23);
    expect(await runtime.eval("state$forced")).toBe(2);
    expect(
      await runtime.eval(
        'identical(trace,c("origin-cleanup","thunk-cleanup","thunk-cleanup","thunk-cleanup"))',
      ),
    ).toBe(true);
    expect(await runtime.eval("sys.nframe()")).toBe(0);

    await runtime.eval(
      'good<-function(x){on.exit(trace<<-c(trace,"good-cleanup"));UseMethod("good");stop("continued")};good.default<-function(x)invisible(7L);NULL',
    );
    const recovered = await runtime.evalDetailed("good(1L)");
    expect(recovered.value).toBe(7);
    expect(recovered.visible).toBe(false);
    expect(recovered.warnings).toEqual([]);
    expect(recovered.topLevelErrors).toEqual([]);
    expect(
      await runtime.eval(
        'identical(trace,c("origin-cleanup","thunk-cleanup","thunk-cleanup","thunk-cleanup","good-cleanup"))',
      ),
    ).toBe(true);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});
