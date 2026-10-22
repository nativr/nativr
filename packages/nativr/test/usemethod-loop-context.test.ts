import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independent GNU R 4.6.1 observations of same-closure active-loop admission.
// These exact 38 inputs were frozen before implementation: 16 baseline mismatches and 22 guards.
// Forced-argument/evaluation admission and malformed generic diagnostics remain separate gaps.
// Existing step/depth regressions remain in usemethod-control-flow.test.ts.
const cases = [
  [
    "body-for-body: body for body",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){for(i in 1:2){UseMethod("g");98L};99L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "body-while-body: body while body",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){i<-0L;while(i<1L){i<-i+1L;UseMethod("g")};99L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "body-while-condition: body while condition",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){while(UseMethod("g")){break};99L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "body-repeat-body: body repeat body",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){repeat{UseMethod("g");break};99L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "for-alias-body: for alias body",
    'identical(tryCatch({local({loop<-`for`;g<-function(x){loop(i,1L,UseMethod("g"));99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "while-alias-condition: while alias condition",
    'identical(tryCatch({local({loop<-`while`;g<-function(x){loop(UseMethod("g"),break);99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "repeat-alias-body: repeat alias body",
    'identical(tryCatch({local({loop<-`repeat`;g<-function(x){loop({UseMethod("g");break});99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "usemethod-alias-loop-body: usemethod alias loop body",
    'identical(tryCatch({local({dispatch<-UseMethod;g<-function(x){for(i in 1L)dispatch("g");99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "nested-loops-reject: nested loops reject",
    'identical(tryCatch({local({g<-function(x){for(i in 1L){for(j in 1L)NULL;UseMethod("g")};99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),list(error = "\'UseMethod\' used in an inappropriate fashion"))',
  ],
  [
    "order-loop-ordinary-selector: order loop ordinary selector",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){for(i in 1L){UseMethod(mark("generic","g"),mark("selector",1L))};99L};v<-tryCatch(g(1L),error=function(e)list(error=conditionMessage(e)));list(value=v,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = "generic"))',
  ],
  [
    "order-loop-selector-error: order loop selector error",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){for(i in 1L){UseMethod(mark("generic","g"),stop("owned selector"))};99L};v<-tryCatch(g(1L),error=function(e)list(error=conditionMessage(e)));list(value=v,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = "generic"))',
  ],
  [
    "order-loop-missing-method: order loop missing method",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){for(i in 1L){UseMethod(mark("generic","owned_absent"),mark("selector",1L))};99L};v<-tryCatch(g(1L),error=function(e)list(error=conditionMessage(e)));list(value=v,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \r\n    trace = "generic"))',
  ],
  [
    "loop-rejects-before-original-promise: loop rejects before original promise",
    'identical(tryCatch({local({trace<-character();g<-function(x){for(i in 1L)UseMethod("g");99L};g.default<-function(x){trace<<-c(trace,"method");7L};v<-tryCatch(g({trace<<-c(trace,"original");stop("owned original")}),error=function(e)conditionMessage(e));list(value=v,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = "\'UseMethod\' used in an inappropriate fashion", \r\n    trace = character(0)))',
  ],
  [
    "invalid-loop-runs-generic-cleanup: invalid loop runs generic cleanup",
    'identical(tryCatch({local({trace<-character();g<-function(x){on.exit(trace<<-c(trace,"cleanup"));for(i in 1L)UseMethod("g");99L};g.default<-function(x){trace<<-c(trace,"method");7L};value<-tryCatch(g(1L),error=function(e)conditionMessage(e));list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = "\'UseMethod\' used in an inappropriate fashion", \r\n    trace = "cleanup"))',
  ],
  [
    "loop-supplied-selector-named-first: loop supplied selector named first",
    'identical(tryCatch({local({trace<-character();mark<-function(k,v){trace<<-c(trace,k);v};g<-function(x){for(i in 1L)UseMethod(object=mark("selector",1L),generic=mark("generic","g"));99L};g.default<-function(x)7L;value<-tryCatch(g(1L),error=function(e)conditionMessage(e));list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = "\'UseMethod\' used in an inappropriate fashion", \r\n    trace = "generic"))',
  ],
  [
    "body-direct: body direct",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = "method"))',
  ],
  [
    "body-for-sequence: body for sequence",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){for(i in UseMethod("g")){trace<<-c(trace,"loop")};99L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = "method"))',
  ],
  [
    "for-alias-sequence: for alias sequence",
    'identical(tryCatch({local({loop<-`for`;g<-function(x){loop(i,UseMethod("g"),NULL);99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),7L)',
  ],
  [
    "caller-loop-for: caller loop for",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({for(i in 1:2)trace<-c(trace,as.character(g(1L)));trace});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = c("7", "7"), trace = c("method", "method")))',
  ],
  [
    "caller-loop-while: caller loop while",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({i<-0L;while(i<1L){i<-i+1L;trace<-c(trace,as.character(g(1L)))};trace});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = "7", trace = "method"))',
  ],
  [
    "caller-loop-repeat: caller loop repeat",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({repeat{trace<-c(trace,as.character(g(1L)));break};trace});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = "7", trace = "method"))',
  ],
  [
    "caller-tryCatch: caller tryCatch",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({tryCatch(g(1L),finally=trace<-c(trace,"finally"))});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = "method"))',
  ],
  [
    "caller-withCallingHandlers: caller withCallingHandlers",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({withCallingHandlers(g(1L),warning=function(w)NULL)});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = "method"))',
  ],
  [
    "caller-evalq: caller evalq",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({evalq(g(1L))});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = "method"))',
  ],
  [
    "caller-eval: caller eval",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({eval(quote(g(1L)))});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = "method"))',
  ],
  [
    "caller-local: caller local",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({local(g(1L))});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = "method"))',
  ],
  [
    "caller-owned-closure: caller owned closure",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({h<-function(y)y;h(g(1L))});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = "method"))',
  ],
  [
    "caller-withVisible: caller withVisible",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){UseMethod("g");99L};value<-local({withVisible(g(1L))});list(value=value,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = list(value = 7L, visible = TRUE), trace = "method"))',
  ],
  [
    "order-loop-generic-error: order loop generic error",
    'identical(tryCatch({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(x,...) {trace<<-c(trace,"method");7L};g<-function(x){for(i in 1L){UseMethod(stop("owned generic"),mark("selector",1L))};99L};v<-tryCatch(g(1L),error=function(e)list(error=conditionMessage(e)));list(value=v,trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = list(error = "owned generic"), trace = character(0)))',
  ],
  [
    "empty-for-completed-before-dispatch: empty for completed before dispatch",
    'identical(tryCatch({local({g<-function(x){for(i in integer())NULL;UseMethod("g");99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),7L)',
  ],
  [
    "break-exits-before-dispatch: break exits before dispatch",
    'identical(tryCatch({local({g<-function(x){for(i in 1L)break;UseMethod("g");99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),7L)',
  ],
  [
    "false-while-completed-before-dispatch: false while completed before dispatch",
    'identical(tryCatch({local({g<-function(x){while(FALSE)NULL;UseMethod("g");99L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),7L)',
  ],
  [
    "helper-generic-from-loop: helper generic from loop",
    'identical(tryCatch({local({helper<-function(x){UseMethod("g");99L};g<-function(x){value<-0L;for(i in 1L)value<-helper(x);value+1L};g.default<-function(x)7L;g(1L)})},error=function(e)list(error=conditionMessage(e))),8L)',
  ],
  [
    "generic-called-in-while-condition: generic called in while condition",
    'identical(tryCatch({local({trace<-character();g<-function(x){UseMethod("g");99L};g.default<-function(x){trace<<-c(trace,"method");FALSE};while(g(1L))NULL;trace})},error=function(e)list(error=conditionMessage(e))),"method")',
  ],
  [
    "generic-called-in-for-sequence: generic called in for sequence",
    'identical(tryCatch({local({g<-function(x){UseMethod("g");99L};g.default<-function(x)1:2;seen<-integer();for(i in g(1L))seen<-c(seen,i);seen})},error=function(e)list(error=conditionMessage(e))),1:2)',
  ],
  [
    "direct-supplied-selector-named-first: direct supplied selector named first",
    'identical(tryCatch({local({trace<-character();mark<-function(k,v){trace<<-c(trace,k);v};g<-function(x){UseMethod(object=mark("selector",1L),generic=mark("generic","g"));99L};g.default<-function(x){trace<<-c(trace,"method");7L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = c("generic", "selector", "method")))',
  ],
  [
    "generic-expression-finishes-loop-before-admission: generic expression finishes loop before admission",
    'identical(tryCatch({local({trace<-character();g<-function(x){UseMethod({for(i in 1L)trace<<-c(trace,"name-loop");"g"},1L);99L};g.default<-function(x){trace<<-c(trace,"method");7L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = c("name-loop", "method")))',
  ],
  [
    "selector-expression-finishes-loop-before-dispatch: selector expression finishes loop before dispatch",
    'identical(tryCatch({local({trace<-character();g<-function(x){UseMethod("g",{for(i in 1L)trace<<-c(trace,"selector-loop");1L});99L};g.default<-function(x){trace<<-c(trace,"method");7L};list(value=g(1L),trace=trace)})},error=function(e)list(error=conditionMessage(e))),list(value = 7L, trace = c("selector-loop", "method")))',
  ],
] as const;

it.each(cases)("UseMethod loop context: %s", async (_name, code) => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: {
      maxSteps: 1000000,
      maxCallDepth: 128,
      maxVectorLength: 10000,
      maxOutputBytes: 65536,
    },
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

it("restores cleanup and frames after a rejected loop before an invisible generic call", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: {
      maxSteps: 100000,
      maxCallDepth: 128,
      maxVectorLength: 10000,
      maxOutputBytes: 65536,
    },
  });
  try {
    await runtime.eval(
      'trace<-character();bad<-function(x){on.exit(trace<<-c(trace,"rejected-cleanup"));for(i in 1L)UseMethod("bad");stop("continued")};bad.default<-function(x){trace<<-c(trace,"forbidden-method");7L};NULL',
    );
    await expect(runtime.eval("bad(1L)")).rejects.toThrow(
      "'UseMethod' used in an inappropriate fashion",
    );
    expect(await runtime.eval("sys.nframe()")).toBe(0);
    expect(await runtime.eval('identical(trace,"rejected-cleanup")')).toBe(true);
    await runtime.eval(
      'good<-function(x){on.exit(trace<<-c(trace,"recovered-cleanup"));UseMethod("good");stop("continued")};good.default<-function(x)invisible(7L);NULL',
    );
    const recovered = await runtime.evalDetailed("good(1L)");
    expect(recovered.value).toBe(7);
    expect(recovered.visible).toBe(false);
    expect(recovered.warnings).toEqual([]);
    expect(recovered.topLevelErrors).toEqual([]);
    expect(await runtime.eval('identical(trace,c("rejected-cleanup","recovered-cleanup"))')).toBe(
      true,
    );
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});
