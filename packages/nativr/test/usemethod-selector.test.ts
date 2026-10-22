import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independently authored GNU R 4.6.1 observations of explicit-selector argument forwarding.
// Omitted-selector defaults/missingness, nonlocal return, visibility and broader S3 remain separate.
const cases = [
  [
    "selection-forcing: selector determines class without replacing original",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g",1L);g.integer<-function(x)list(value=x,type=typeof(x),classes=.Class,method=.Method);g("original")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(value = "original", type = "character", classes = c("integer", \n"numeric"), method = "g.integer"), warnings = character(0)))',
  ],
  [
    "selection-forcing: NULL selector selects NULL method with original",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g",NULL);g.NULL<-function(x)list(value=x,classes=.Class,method=.Method);g("original")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(value = "original", classes = "NULL", method = "g.NULL"), \n    warnings = character(0)))',
  ],
  [
    "selection-forcing: unused original promise remains lazy",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();selector<-function(){events<<-c(events,"selector");1L};g<-function(x)UseMethod("g",selector());g.integer<-function(x)list(missing=missing(x),events=events,classes=.Class);g(stop("original forced"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = FALSE, events = "selector", classes = c("integer", \n"numeric")), warnings = character(0)))',
  ],
  [
    "selection-forcing: selector aliases second promise without double forcing",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();mark<-function(k,v){events<<-c(events,k);v};g<-function(x,y)UseMethod("g",y);g.integer<-function(x,y)list(x=x,y=y,events=events,classes=.Class);g(mark("x","original"),mark("y",1L))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = "original", y = 1L, events = c("y", "x"\n), classes = c("integer", "numeric")), warnings = character(0)))',
  ],
  [
    "selection-forcing: generic name selector and original force in native order",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();mark<-function(k,v){events<<-c(events,k);v};g<-function(x)UseMethod(mark("generic","g"),mark("selector",1L));g.integer<-function(x)list(x=x,events=events);g(mark("original","value"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = "value", events = c("generic", "selector", \n"original")), warnings = character(0)))',
  ],
  [
    "arguments: named reordered actuals preserve positions and names",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(alpha,beta)UseMethod("g",1L);g.integer<-function(alpha,beta)list(alpha=alpha,beta=beta,call=match.call(),actual=sys.call());g(beta=2L,alpha="original")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(alpha = "original", beta = 2L, call = quote(g.integer(alpha = "original", \n    beta = 2L)), actual = quote(g.integer(beta = 2L, alpha = "original"))), \n    warnings = character(0)))',
  ],
  [
    "arguments: partial actual names preserve matching",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(alpha,beta)UseMethod("g",1L);g.integer<-function(alpha,beta)list(alpha=alpha,beta=beta,call=match.call(),actual=sys.call());g(be=2L,al="original")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(alpha = "original", beta = 2L, call = quote(g.integer(alpha = "original", \n    beta = 2L)), actual = quote(g.integer(be = 2L, al = "original"))), \n    warnings = character(0)))',
  ],
  [
    "arguments: method reordered formals use original positional actuals",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(alpha,beta)UseMethod("g",1L);g.integer<-function(beta,alpha)list(alpha=alpha,beta=beta,call=match.call());g(10L,20L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(alpha = 20L, beta = 10L, call = quote(g.integer(beta = 10L, \n    alpha = 20L))), warnings = character(0)))',
  ],
  [
    "arguments: method reordered formals use original named actuals",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(alpha,beta)UseMethod("g",1L);g.integer<-function(beta,alpha)list(alpha=alpha,beta=beta,call=match.call());g(alpha=10L,beta=20L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(alpha = 10L, beta = 20L, call = quote(g.integer(beta = 20L, \n    alpha = 10L))), warnings = character(0)))',
  ],
  [
    "arguments: dots retain names and order",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g",1L);g.integer<-function(x,...)list(x=x,dots=list(...),call=match.call());g("original",z=3L,2L,a=1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = "original", dots = list(z = 3L, 2L, a = 1L), \n    call = quote(g.integer(x = "original", z = 3L, 2L, a = 1L))), \n    warnings = character(0)))',
  ],
  [
    "arguments: substitute retains original source expression",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();mark<-function(k,v){events<<-c(events,k);v};g<-function(x)UseMethod("g",1L);g.integer<-function(x)list(source=substitute(x),events=events,missing=missing(x));g(mark("original","value"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(source = quote(mark("original", "value")), \n    events = character(0), missing = FALSE), warnings = character(0)))',
  ],
  [
    "missing-original: zero actual generic does not inject into dots",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function()UseMethod("g",1L);g.integer<-function(...)list(dots=list(...),call=match.call(),classes=.Class);g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(dots = list(), call = quote(g.integer()), classes = c("integer", \n"numeric")), warnings = character(0)))',
  ],
  [
    "missing-original: omitted original remains missing after explicit selector",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g",1L);g.integer<-function(x)list(missing=missing(x),call=match.call(),classes=.Class);g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, call = quote(g.integer()), \n    classes = c("integer", "numeric")), warnings = character(0)))',
  ],
  [
    "missing-original: method default applies without forcing generic default",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();g<-function(x=stop("generic default forced"))UseMethod("g",1L);g.integer<-function(x={events<<-c(events,"method default");7L})list(missing=missing(x),value=x,events=events);g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, value = 7L, events = "method default"), \n    warnings = character(0)))',
  ],
  [
    "missing-original: forwarded missing original remains missing",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g",1L);g.integer<-function(x)list(missing=missing(x),classes=.Class);h<-function(x)g(x);h()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, classes = c("integer", "numeric"\n)), warnings = character(0)))',
  ],
  [
    "missing-original: explicit missing original remains missing",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g",1L);g.integer<-function(x)list(missing=missing(x),classes=.Class);g(x=)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, classes = c("integer", "numeric"\n)), warnings = character(0)))',
  ],
  [
    "missing-original: zero actual default dispatch adds no argument",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function()UseMethod("g",structure(1,class="owned_absent"));g.default<-function(...)list(dots=list(...),call=match.call(),classes=.Class,method=.Method);g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(dots = list(), call = quote(g.default()), classes = NULL, \n    method = "g.default"), warnings = character(0)))',
  ],
  [
    "continuation: NextMethod keeps selector chain and original value",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,y)UseMethod("g",1L);g.integer<-function(x,y)list(first=list(x=x,y=y,classes=.Class),tail=NextMethod());g.numeric<-function(x,y)list(x=x,y=y,classes=.Class,method=.Method);g("original",2L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(x = "original", y = 2L, classes = c("integer", \n"numeric")), tail = list(x = "original", y = 2L, classes = structure("numeric", previous = c("integer", \n"numeric")), method = "g.numeric")), warnings = character(0)))',
  ],
  [
    "continuation: NextMethod forwards method changes without changing selector chain",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,y)UseMethod("g",1L);g.integer<-function(x,y){x<-"changed";y<-9L;NextMethod()};g.numeric<-function(x,y)list(x=x,y=y,classes=.Class,method=.Method);g("original",2L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = "changed", y = 9L, classes = structure("numeric", previous = c("integer", \n"numeric")), method = "g.numeric"), warnings = character(0)))',
  ],
  [
    "reference: selector continuation preserves original reference",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({shared<-new.env(parent=emptyenv());shared$marker<-43L;g<-function(x)UseMethod("g",1L);g.integer<-function(x)list(first=x,tail=NextMethod());g.numeric<-function(x)x;a<-g(shared);list(firstSame=identical(a$first,shared),lastSame=identical(a$tail,shared),marker=a$tail$marker)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(firstSame = TRUE, lastSame = TRUE, marker = 43L), \n    warnings = character(0)))',
  ],
  [
    "reference: selector continuation preserves changed reference",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({first<-new.env(parent=emptyenv());first$marker<-43L;second<-new.env(parent=emptyenv());second$marker<-47L;g<-function(x)UseMethod("g",1L);g.integer<-function(x){x<-second;NextMethod()};g.numeric<-function(x)x;a<-g(first);list(same=identical(a,second),firstMarker=first$marker,lastMarker=a$marker)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(same = TRUE, firstMarker = 43L, lastMarker = 47L), \n    warnings = character(0)))',
  ],
] as const;

it.each(cases)("UseMethod explicit selector: %s", async (_name, code) => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(code);
    expect(result.value).toBe(true);
    expect(result.warnings).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});
