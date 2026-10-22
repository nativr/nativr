import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independent GNU R 4.6.1 observations of UseMethod generic-name admission and precedence.
// These exact 48 inputs were frozen before implementation: 33 baseline mismatches and 15 guards.
// General method-search diagnostics and native-wrapper/evaluation admission remain separate.
const cases = [
  [
    "direct-character-scalar",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic","g"),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = c("generic", "selector", \n"method")), warnings = character(0)))})',
  ],
  [
    "direct-character-empty-vector",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",character()),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-character-multiple",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",c("g","other")),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-character-multiple-leading-na",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",c(NA_character_,"g")),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-null",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",NULL),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-logical",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",TRUE),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-integer",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",1L),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-double",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",1),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-complex",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",1+2i),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-raw",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",as.raw(1L)),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-list",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",list("g")),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-symbol",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",quote(g)),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-closure",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",function()NULL),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-builtin",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",sum),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "direct-attributed-character",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",structure("g",names="owned",note="kept")),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = c("generic", "selector", \n"method")), warnings = character(0)))})',
  ],
  [
    "direct-classed-character",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",structure("g",class="owned")),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = c("generic", "selector", \n"method")), warnings = character(0)))})',
  ],
  [
    "direct-matrix-character",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",structure("g",dim=c(1L,1L))),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = c("generic", "selector", \n"method")), warnings = character(0)))})',
  ],
  [
    "direct-factor",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){UseMethod(mark("generic",factor("g")),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "missing-absent",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x)UseMethod();g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "there must be a \'generic\' argument"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "missing-object-only",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x)UseMethod(object=mark("selector",1L));g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "there must be a \'generic\' argument"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "missing-literal",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x)UseMethod(,mark("selector",1L));g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "there must be a \'generic\' argument"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "missing-named-literal",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x)UseMethod(generic=,object=mark("selector",1L));g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "there must be a \'generic\' argument"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "missing-forwarded",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(name)UseMethod(name,mark("selector",1L));g()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "argument \\"name\\" is missing, with no default"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "missing-forwarded-two-frames",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({outer<-function(name){g<-function()UseMethod(name,mark("selector",1L));g()};outer()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "argument \\"name\\" is missing, with no default"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "loop-missing-forwarded",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(name){for(i in 1L)UseMethod(name,mark("selector",1L));99L};g()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "argument \\"name\\" is missing, with no default"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "interpreted-missing-forwarded",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(name){helper(UseMethod(name,mark("selector",1L)));99L};g()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "argument \\"name\\" is missing, with no default"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "default-valid-name",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(name="g")UseMethod(name,mark("selector",1L));g()},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = c("selector", "method")), \n    warnings = character(0)))})',
  ],
  [
    "supplied-name-error",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x)UseMethod(stop("owned generic"),mark("selector",1L));g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "owned generic"), trace = character(0)), \n    warnings = character(0)))})',
  ],
  [
    "named-selector-before-invalid",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x)UseMethod(object=mark("selector",1L),generic=mark("generic",1L));g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "na-name-owned-method",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({NA.integer<-function(...) {trace<<-c(trace,"NA method");17L};g<-function(x)UseMethod(NA_character_,mark("selector",1L));g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 17L, trace = c("selector", "NA method"\n)), warnings = character(0)))})',
  ],
  [
    "empty-name-owned-method",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({.integer<-function(...) {trace<<-c(trace,"empty method");19L};g<-function(x)UseMethod("",mark("selector",1L));g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 19L, trace = c("selector", "empty method"\n)), warnings = character(0)))})',
  ],
  [
    "classed-name-no-coercion",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({as.character.owned<-function(x)stop("name coercion");g<-function(x)UseMethod(structure("g",class="owned"),mark("selector",1L));g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = 7L, trace = c("selector", "method")), \n    warnings = character(0)))})',
  ],
  [
    "loop-missing-absent",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){for(i in 1L)UseMethod();99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "there must be a \'generic\' argument"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "interpreted-missing-absent",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(x){helper(UseMethod());99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "there must be a \'generic\' argument"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "loop-missing-literal",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){for(i in 1L)UseMethod(,mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "there must be a \'generic\' argument"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "interpreted-missing-literal",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(x){helper(UseMethod(,mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "there must be a \'generic\' argument"), \n    trace = character(0)), warnings = character(0)))})',
  ],
  [
    "loop-noncharacter",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){for(i in 1L)UseMethod(mark("generic",1L),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "interpreted-noncharacter",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(x){helper(UseMethod(mark("generic",1L),mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "loop-character-empty-vector",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){for(i in 1L)UseMethod(mark("generic",character()),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "interpreted-character-empty-vector",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(x){helper(UseMethod(mark("generic",character()),mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "loop-character-multiple",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){for(i in 1L)UseMethod(mark("generic",c("g","other")),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "interpreted-character-multiple",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(x){helper(UseMethod(mark("generic",c("g","other")),mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'generic\' argument must be a character string"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "loop-na-name",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){for(i in 1L)UseMethod(mark("generic",NA_character_),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "interpreted-na-name",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(x){helper(UseMethod(mark("generic",NA_character_),mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "loop-empty-name",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){for(i in 1L)UseMethod(mark("generic",""),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "interpreted-empty-name",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(x){helper(UseMethod(mark("generic",""),mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "loop-valid-name",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({g<-function(x){for(i in 1L)UseMethod(mark("generic","g"),mark("selector",1L));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \n    trace = "generic"), warnings = character(0)))})',
  ],
  [
    "interpreted-valid-name",
    'local({warnings<-character();value<-withCallingHandlers({local({trace<-character();mark<-function(k,value){trace<<-c(trace,k);value};g.default<-function(...) {trace<<-c(trace,"method");7L};value<-tryCatch({helper<-function(y)y;g<-function(x){helper(UseMethod(mark("generic","g"),mark("selector",1L)));99L};g(1L)},error=function(e)list(error=conditionMessage(e)));list(value=value,trace=trace)})},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(value = list(error = "\'UseMethod\' used in an inappropriate fashion"), \n    trace = "generic"), warnings = character(0)))})',
  ],
] as const;

it.each(cases)("UseMethod generic-name validation: %s", async (_name, code) => {
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
