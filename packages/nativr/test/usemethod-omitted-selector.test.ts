import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independently authored GNU R 4.6.1 observations of omitted-selector argument selection.
// Forwarded missing diagnostics are preservation guards; nonlocal return and visibility are separate.
const cases = [
  [
    "zero-actuals: zero-formal generic selects NULL method",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function()UseMethod("g");g.NULL<-function(...)list(dots=list(...),classes=.Class,method=.Method);g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(dots = list(), classes = "NULL", method = "g.NULL"), \n    warnings = character(0)))',
  ],
  [
    "zero-actuals: zero actual default sees NULL metadata and empty dots",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.default<-function(...)list(dots=list(...),classes=.Class,method=.Method);g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(dots = list(), classes = NULL, method = "g.default"), \n    warnings = character(0)))',
  ],
  [
    "zero-actuals: unused generic default does not select dispatch class",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();g<-function(x={events<<-c(events,"generic default");1L})UseMethod("g");g.NULL<-function(x=7L)list(missing=missing(x),value=x,events=events,classes=.Class);g.integer<-function(x)stop("generic default selected");g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, value = 7L, events = character(0), \n    classes = "NULL"), warnings = character(0)))',
  ],
  [
    "zero-actuals: forced generic default still leaves zero supplied actuals",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();g<-function(x={events<<-c(events,"generic default");1L}){x;UseMethod("g")};g.NULL<-function(x=7L)list(missing=missing(x),value=x,events=events,classes=.Class);g.integer<-function(x)stop("generic default selected");g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, value = 7L, events = "generic default", \n    classes = "NULL"), warnings = character(0)))',
  ],
  [
    "zero-actuals: zero-actual local reassignment does not supply an actual",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x=stop("generic default forced")){x<-1L;UseMethod("g")};g.NULL<-function(x=7L)list(missing=missing(x),value=x,classes=.Class);g.integer<-function(x)stop("local assigned value selected");g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, value = 7L, classes = "NULL"), \n    warnings = character(0)))',
  ],
  [
    "literal-missing: explicit missing first actual selects name",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.name<-function(x)list(missing=missing(x),classes=.Class,method=.Method);g(x=)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, classes = "name", method = "g.name"), \n    warnings = character(0)))',
  ],
  [
    "literal-missing: explicit missing first actual does not select second",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,y)UseMethod("g");g.name<-function(x,y)list(missing=missing(x),y=y,classes=.Class);g.integer<-function(x,y)stop("second selected");g(x=,y=1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, y = 1L, classes = "name"), \n    warnings = character(0)))',
  ],
  [
    "literal-missing: explicit missing original with method default",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.name<-function(x=7L)list(missing=missing(x),value=x,classes=.Class);g(x=)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missing = TRUE, value = 7L, classes = "name"), \n    warnings = character(0)))',
  ],
  [
    "forwarded-missing: forwarded missing first actual dispatch observation",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.name<-function(x)list(method="name",missing=missing(x));g.NULL<-function(x)list(method="NULL",missing=missing(x));g.default<-function(x)list(method="default",missing=missing(x));h<-function(x)g(x);h()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "argument \\"x\\" is missing, with no default"), \n    warnings = character(0)))',
  ],
  [
    "forwarded-missing: two-hop missing first actual dispatch observation",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.name<-function(x)list(method="name",missing=missing(x));g.NULL<-function(x)list(method="NULL",missing=missing(x));g.default<-function(x)list(method="default",missing=missing(x));h<-function(x)g(x);j<-function(x)h(x);j()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(error = "argument \\"x\\" is missing, with no default"), \n    warnings = character(0)))',
  ],
  [
    "actual-selection: absent first formal uses first supplied named actual",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,y)UseMethod("g");g.integer<-function(x,y)list(missingX=missing(x),y=y,classes=.Class);g.NULL<-function(x,y)list(method="NULL",missingX=missing(x),y=y);g(y=1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missingX = TRUE, y = 1L, classes = c("integer", \n"numeric")), warnings = character(0)))',
  ],
  [
    "actual-selection: absent defaulted first formal uses supplied named actual",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();g<-function(x={events<<-c(events,"default");"default"},y)UseMethod("g");g.integer<-function(x=7L,y)list(missingX=missing(x),x=x,y=y,events=events,classes=.Class);g.character<-function(x,y)stop("default selected");g(y=1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(missingX = TRUE, x = 7L, y = 1L, events = character(0), \n    classes = c("integer", "numeric")), warnings = character(0)))',
  ],
  [
    "actual-selection: matched first formal precedes earlier named actual",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,y)UseMethod("g");g.character<-function(x,y)list(x=x,y=y,classes=.Class);g.integer<-function(x,y)stop("earlier second selected");g(y=1L,x="original")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = "original", y = 1L, classes = "character"), \n    warnings = character(0)))',
  ],
  [
    "actual-selection: partially matched first formal controls dispatch",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(alpha,beta)UseMethod("g");g.character<-function(alpha,beta)list(alpha=alpha,beta=beta,classes=.Class);g.integer<-function(alpha,beta)stop("earlier second selected");g(be=1L,al="original")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(alpha = "original", beta = 1L, classes = "character"), \n    warnings = character(0)))',
  ],
  [
    "actual-selection: missing second actual remains unforced",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,y)UseMethod("g");g.integer<-function(x,y)list(x=x,missingY=missing(y),classes=.Class);g(y=,x=1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = 1L, missingY = TRUE, classes = c("integer", \n"numeric")), warnings = character(0)))',
  ],
  [
    "actual-selection: ellipsis generic selects first supplied actual",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(...)UseMethod("g");g.integer<-function(...)list(dots=list(...),classes=.Class);g(y=1L,"second")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(dots = list(y = 1L, "second"), classes = c("integer", \n"numeric")), warnings = character(0)))',
  ],
  [
    "actual-selection: empty ellipsis generic selects NULL",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(...)UseMethod("g");g.NULL<-function(...)list(dots=list(...),classes=.Class);g()}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(dots = list(), classes = "NULL"), warnings = character(0)))',
  ],
  [
    "local-reassignment: local first formal reassignment does not replace original",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x){x<-1L;UseMethod("g")};g.character<-function(x)list(x=x,classes=.Class);g.integer<-function(x)stop("local replacement selected");g("original")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = "original", classes = "character"), warnings = character(0)))',
  ],
  [
    "local-reassignment: replacement evaluated before original dispatch promise",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();mark<-function(k,v){events<<-c(events,k);v};g<-function(x){x<-mark("replacement",1L);UseMethod("g")};g.character<-function(x)list(x=x,events=events,classes=.Class);g.integer<-function(x)stop("local replacement selected");g(mark("original","value"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = "value", events = c("replacement", "original"\n), classes = "character"), warnings = character(0)))',
  ],
  [
    "local-reassignment: forced original remains memoized after reassignment",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();mark<-function(k,v){events<<-c(events,k);v};g<-function(x){x;x<-mark("replacement",1L);UseMethod("g")};g.character<-function(x)list(x=x,events=events,classes=.Class);g.integer<-function(x)stop("local replacement selected");g(mark("original","value"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = "value", events = c("original", "replacement"\n), classes = "character"), warnings = character(0)))',
  ],
  [
    "local-reassignment: local reference rebinding retains original identity",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({shared<-new.env(parent=emptyenv());shared$marker<-53L;replacement<-new.env(parent=emptyenv());replacement$marker<-59L;g<-function(x){x<-replacement;UseMethod("g")};g.environment<-function(x)list(same=identical(x,shared),marker=x$marker,classes=.Class);g(shared)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(same = TRUE, marker = 53L, classes = "environment"), \n    warnings = character(0)))',
  ],
] as const;

it.each(cases)("UseMethod omitted selector: %s", async (_name, code) => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(code);
    expect(result.value).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.topLevelErrors).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});
