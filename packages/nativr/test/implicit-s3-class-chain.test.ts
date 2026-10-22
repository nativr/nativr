import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independent GNU R 4.6.1 observations. Explicit dispatch selectors, omitted/missing
// generic actuals, direct builtin-method continuation and broader S3 behavior remain separate gaps.
const cases = [
  [
    "implicit-first-method: integer",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");for(k in c("integer","double","numeric","matrix","array","logical","complex","character","raw","list","NULL","pairlist","expression","environment","function","name","call"))assign(paste0("g.",k),function(x,...)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x)));g(1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = c("integer", "numeric"), method = "g.integer", \n    generic = "g", group = "", type = "integer", publicClass = "integer", \n    object = FALSE), warnings = character(0)))',
  ],
  [
    "implicit-first-method: double",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");for(k in c("integer","double","numeric","matrix","array","logical","complex","character","raw","list","NULL","pairlist","expression","environment","function","name","call"))assign(paste0("g.",k),function(x,...)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x)));g(1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = c("double", "numeric"), method = "g.double", \n    generic = "g", group = "", type = "double", publicClass = "numeric", \n    object = FALSE), warnings = character(0)))',
  ],
  [
    "implicit-first-method: integer matrix",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");for(k in c("integer","double","numeric","matrix","array","logical","complex","character","raw","list","NULL","pairlist","expression","environment","function","name","call"))assign(paste0("g.",k),function(x,...)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x)));g(matrix(1L,1,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = c("matrix", "array", "integer", "numeric"\n), method = "g.matrix", generic = "g", group = "", type = "integer", \n    publicClass = c("matrix", "array"), object = FALSE), warnings = character(0)))',
  ],
  [
    "implicit-first-method: double matrix",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");for(k in c("integer","double","numeric","matrix","array","logical","complex","character","raw","list","NULL","pairlist","expression","environment","function","name","call"))assign(paste0("g.",k),function(x,...)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x)));g(matrix(1,1,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = c("matrix", "array", "double", "numeric"\n), method = "g.matrix", generic = "g", group = "", type = "double", \n    publicClass = c("matrix", "array"), object = FALSE), warnings = character(0)))',
  ],
  [
    "implicit-first-method: integer one dimensional array",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");for(k in c("integer","double","numeric","matrix","array","logical","complex","character","raw","list","NULL","pairlist","expression","environment","function","name","call"))assign(paste0("g.",k),function(x,...)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x)));g(array(1L,2L))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = c("array", "integer", "numeric"), \n    method = "g.array", generic = "g", group = "", type = "integer", \n    publicClass = "array", object = FALSE), warnings = character(0)))',
  ],
  [
    "implicit-first-method: double three dimensional array",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");for(k in c("integer","double","numeric","matrix","array","logical","complex","character","raw","list","NULL","pairlist","expression","environment","function","name","call"))assign(paste0("g.",k),function(x,...)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x)));g(array(1,c(1L,1L,1L)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = c("array", "double", "numeric"), \n    method = "g.array", generic = "g", group = "", type = "double", \n    publicClass = "array", object = FALSE), warnings = character(0)))',
  ],
  [
    "implicit-first-method: list matrix",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");for(k in c("integer","double","numeric","matrix","array","logical","complex","character","raw","list","NULL","pairlist","expression","environment","function","name","call"))assign(paste0("g.",k),function(x,...)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x)));g(matrix(list(1),1,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = c("matrix", "array", "list"), method = "g.matrix", \n    generic = "g", group = "", type = "list", publicClass = c("matrix", \n    "array"), object = FALSE), warnings = character(0)))',
  ],
  [
    "chain-metadata: integer",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();step<-function(classes,method,previous){events[[length(events)+1L]]<<-list(classes=classes,method=method,previous=previous)};for(k in c("matrix","array","integer","double","numeric"))assign(paste0("g.",k),function(x,...){step(.Class,.Method,attr(.Class,"previous"));NextMethod()});g.default<-function(x,...){step(.Class,.Method,attr(.Class,"previous"));list(events=events,type=typeof(x),class=class(x),dim=dim(x))};g(1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list(classes = c("integer", "numeric"\n), method = "g.integer", previous = NULL), list(classes = structure("numeric", previous = c("integer", \n"numeric")), method = "g.numeric", previous = c("integer", "numeric"\n)), list(classes = structure(character(0), previous = structure("numeric", previous = c("integer", \n"numeric"))), method = "g.default", previous = structure("numeric", previous = c("integer", \n"numeric")))), type = "integer", class = "integer", dim = NULL), \n    warnings = character(0)))',
  ],
  [
    "chain-metadata: double",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();step<-function(classes,method,previous){events[[length(events)+1L]]<<-list(classes=classes,method=method,previous=previous)};for(k in c("matrix","array","integer","double","numeric"))assign(paste0("g.",k),function(x,...){step(.Class,.Method,attr(.Class,"previous"));NextMethod()});g.default<-function(x,...){step(.Class,.Method,attr(.Class,"previous"));list(events=events,type=typeof(x),class=class(x),dim=dim(x))};g(1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list(classes = c("double", "numeric"\n), method = "g.double", previous = NULL), list(classes = structure("numeric", previous = c("double", \n"numeric")), method = "g.numeric", previous = c("double", "numeric"\n)), list(classes = structure(character(0), previous = structure("numeric", previous = c("double", \n"numeric"))), method = "g.default", previous = structure("numeric", previous = c("double", \n"numeric")))), type = "double", class = "numeric", dim = NULL), \n    warnings = character(0)))',
  ],
  [
    "chain-metadata: integer matrix",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();step<-function(classes,method,previous){events[[length(events)+1L]]<<-list(classes=classes,method=method,previous=previous)};for(k in c("matrix","array","integer","double","numeric"))assign(paste0("g.",k),function(x,...){step(.Class,.Method,attr(.Class,"previous"));NextMethod()});g.default<-function(x,...){step(.Class,.Method,attr(.Class,"previous"));list(events=events,type=typeof(x),class=class(x),dim=dim(x))};g(matrix(1L,1,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list(classes = c("matrix", "array", \n"integer", "numeric"), method = "g.matrix", previous = NULL), \n    list(classes = structure(c("array", "integer", "numeric"), previous = c("matrix", \n    "array", "integer", "numeric")), method = "g.array", previous = c("matrix", \n    "array", "integer", "numeric")), list(classes = structure(c("integer", \n    "numeric"), previous = structure(c("array", "integer", "numeric"\n    ), previous = c("matrix", "array", "integer", "numeric"))), \n        method = "g.integer", previous = structure(c("array", \n        "integer", "numeric"), previous = c("matrix", "array", \n        "integer", "numeric"))), list(classes = structure("numeric", previous = structure(c("integer", \n    "numeric"), previous = structure(c("array", "integer", "numeric"\n    ), previous = c("matrix", "array", "integer", "numeric")))), \n        method = "g.numeric", previous = structure(c("integer", \n        "numeric"), previous = structure(c("array", "integer", \n        "numeric"), previous = c("matrix", "array", "integer", \n        "numeric")))), list(classes = structure(character(0), previous = structure("numeric", previous = structure(c("integer", \n    "numeric"), previous = structure(c("array", "integer", "numeric"\n    ), previous = c("matrix", "array", "integer", "numeric"))))), \n        method = "g.default", previous = structure("numeric", previous = structure(c("integer", \n        "numeric"), previous = structure(c("array", "integer", \n        "numeric"), previous = c("matrix", "array", "integer", \n        "numeric")))))), type = "integer", class = c("matrix", \n"array"), dim = c(1L, 1L)), warnings = character(0)))',
  ],
  [
    "chain-metadata: double three dimensional array",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();step<-function(classes,method,previous){events[[length(events)+1L]]<<-list(classes=classes,method=method,previous=previous)};for(k in c("matrix","array","integer","double","numeric"))assign(paste0("g.",k),function(x,...){step(.Class,.Method,attr(.Class,"previous"));NextMethod()});g.default<-function(x,...){step(.Class,.Method,attr(.Class,"previous"));list(events=events,type=typeof(x),class=class(x),dim=dim(x))};g(array(1,c(1L,1L,1L)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list(classes = c("array", "double", \n"numeric"), method = "g.array", previous = NULL), list(classes = structure(c("double", \n"numeric"), previous = c("array", "double", "numeric")), method = "g.double", \n    previous = c("array", "double", "numeric")), list(classes = structure("numeric", previous = structure(c("double", \n"numeric"), previous = c("array", "double", "numeric"))), method = "g.numeric", \n    previous = structure(c("double", "numeric"), previous = c("array", \n    "double", "numeric"))), list(classes = structure(character(0), previous = structure("numeric", previous = structure(c("double", \n"numeric"), previous = c("array", "double", "numeric")))), method = "g.default", \n    previous = structure("numeric", previous = structure(c("double", \n    "numeric"), previous = c("array", "double", "numeric"))))), \n    type = "double", class = "array", dim = c(1L, 1L, 1L)), warnings = character(0)))',
  ],
  [
    "chain-metadata: integer skips absent leading method",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.numeric<-function(x)list(.Class,.Method,attr(.Class,"previous"));g(1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(structure("numeric", previous = c("integer", \n"numeric")), "g.numeric", c("integer", "numeric")), warnings = character(0)))',
  ],
  [
    "chain-metadata: matrix skips absent matrix method",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.array<-function(x)list(.Class,.Method,attr(.Class,"previous"));g(matrix(1L,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(structure(c("array", "integer", "numeric"), previous = c("matrix", \n"array", "integer", "numeric")), "g.array", c("matrix", "array", \n"integer", "numeric")), warnings = character(0)))',
  ],
  [
    "chain-metadata: matrix skips to numeric method",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.numeric<-function(x)list(.Class,.Method,attr(.Class,"previous"));g(matrix(1L,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(structure("numeric", previous = c("matrix", \n"array", "integer", "numeric")), "g.numeric", c("matrix", "array", \n"integer", "numeric")), warnings = character(0)))',
  ],
  [
    "explicit-precedence: explicit owned integer",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();for(k in c("owned","integer","double","numeric","matrix","array"))assign(paste0("g.",k),function(x,...){events[[length(events)+1L]]<<-list(.Class,.Method);NextMethod()});g.default<-function(x,...)list(events=events,finalClass=.Class,attributes=attributes(x),type=typeof(x),object=is.object(x));g(structure(1L,class=c("owned","integer")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list(c("owned", "integer"), "g.owned"), \n    list(structure("integer", previous = c("owned", "integer"\n    )), "g.integer")), finalClass = structure(character(0), previous = structure("integer", previous = c("owned", \n"integer"))), attributes = list(class = c("owned", "integer")), \n    type = "integer", object = TRUE), warnings = character(0)))',
  ],
  [
    "explicit-precedence: explicit owned numeric",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();for(k in c("owned","integer","double","numeric","matrix","array"))assign(paste0("g.",k),function(x,...){events[[length(events)+1L]]<<-list(.Class,.Method);NextMethod()});g.default<-function(x,...)list(events=events,finalClass=.Class,attributes=attributes(x),type=typeof(x),object=is.object(x));g(structure(1,class=c("owned","numeric")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list(c("owned", "numeric"), "g.owned"), \n    list(structure("numeric", previous = c("owned", "numeric"\n    )), "g.numeric")), finalClass = structure(character(0), previous = structure("numeric", previous = c("owned", \n"numeric"))), attributes = list(class = c("owned", "numeric")), \n    type = "double", object = TRUE), warnings = character(0)))',
  ],
  [
    "explicit-precedence: explicit unknown",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();for(k in c("owned","integer","double","numeric","matrix","array"))assign(paste0("g.",k),function(x,...){events[[length(events)+1L]]<<-list(.Class,.Method);NextMethod()});g.default<-function(x,...)list(events=events,finalClass=.Class,attributes=attributes(x),type=typeof(x),object=is.object(x));g(structure(1,class="owned"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list("owned", "g.owned")), finalClass = structure(character(0), previous = "owned"), \n    attributes = list(class = "owned"), type = "double", object = TRUE), \n    warnings = character(0)))',
  ],
  [
    "explicit-precedence: explicit numeric singleton",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();for(k in c("owned","integer","double","numeric","matrix","array"))assign(paste0("g.",k),function(x,...){events[[length(events)+1L]]<<-list(.Class,.Method);NextMethod()});g.default<-function(x,...)list(events=events,finalClass=.Class,attributes=attributes(x),type=typeof(x),object=is.object(x));g(structure(1L,class="numeric"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list("numeric", "g.numeric")), \n    finalClass = structure(character(0), previous = "numeric"), \n    attributes = list(class = "numeric"), type = "integer", object = TRUE), \n    warnings = character(0)))',
  ],
  [
    "explicit-precedence: explicit integer singleton",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();for(k in c("owned","integer","double","numeric","matrix","array"))assign(paste0("g.",k),function(x,...){events[[length(events)+1L]]<<-list(.Class,.Method);NextMethod()});g.default<-function(x,...)list(events=events,finalClass=.Class,attributes=attributes(x),type=typeof(x),object=is.object(x));g(structure(1,class="integer"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list("integer", "g.integer")), \n    finalClass = structure(character(0), previous = "integer"), \n    attributes = list(class = "integer"), type = "double", object = TRUE), \n    warnings = character(0)))',
  ],
  [
    "explicit-precedence: explicit matrix class",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x,...)UseMethod("g");events<-list();for(k in c("owned","integer","double","numeric","matrix","array"))assign(paste0("g.",k),function(x,...){events[[length(events)+1L]]<<-list(.Class,.Method);NextMethod()});g.default<-function(x,...)list(events=events,finalClass=.Class,attributes=attributes(x),type=typeof(x),object=is.object(x));g(structure(matrix(1L,1),class="owned"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(events = list(list("owned", "g.owned")), finalClass = structure(character(0), previous = "owned"), \n    attributes = list(dim = c(1L, 1L), class = "owned"), type = "integer", \n    object = TRUE), warnings = character(0)))',
  ],
  [
    "explicit-precedence: unknown class does not use implicit numeric",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.numeric<-function(x)"numeric";g.default<-function(x)list(.Class,.Method,typeof(x),class(x));g(structure(1,class="owned"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(NULL, "g.default", "double", "owned"), warnings = character(0)))',
  ],
  [
    "explicit-precedence: explicit class preserves duplicate entries",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");events<-list();g.owned<-function(x){events[[length(events)+1L]]<<-list(.Class,.Method);NextMethod()};g.numeric<-function(x){events[[length(events)+1L]]<<-list(.Class,.Method);events};g(structure(1,class=c("owned","owned","numeric")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(list(c("owned", "owned", "numeric"), "g.owned"), \n    list(structure(c("owned", "numeric"), previous = c("owned", \n    "owned", "numeric")), "g.owned"), list(structure("numeric", previous = structure(c("owned", \n    "numeric"), previous = c("owned", "owned", "numeric"))), \n        "g.numeric")), warnings = character(0)))',
  ],
  [
    "forcing-identity: dispatch actual forced once",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();mark<-function(k,v){events<<-c(events,k);v};g<-function(x,y)UseMethod("g");g.integer<-function(x,y)list(x=x,y=y,events=events,classes=.Class);g(mark("x",1L),mark("y",2L))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = 1L, y = 2L, events = c("x", "y"), classes = c("integer", \n"numeric")), warnings = character(0)))',
  ],
  [
    "forcing-identity: method default supersedes generic default",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({events<-character();g<-function(x,y={events<<-c(events,"generic default");9L})UseMethod("g");g.integer<-function(x,y={events<<-c(events,"method default");2L})list(x=x,y=y,events=events);g(1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = 1L, y = 2L, events = "method default"), \n    warnings = character(0)))',
  ],
  [
    "forcing-identity: NextMethod keeps original class chain after mutation",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.integer<-function(x){x<-structure(3,class="changed");NextMethod()};g.numeric<-function(x)list(x=x,classes=.Class,method=.Method);g(1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(x = structure(3, class = "changed"), classes = structure("numeric", previous = c("integer", \n"numeric")), method = "g.numeric"), warnings = character(0)))',
  ],
  [
    "units-consequence: integer",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({units.numeric<-function(x)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x));units(1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = structure("numeric", previous = c("integer", \n"numeric")), method = "units.numeric", generic = "units", group = "", \n    type = "integer", publicClass = "integer", object = FALSE), \n    warnings = character(0)))',
  ],
  [
    "units-consequence: double",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({units.numeric<-function(x)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x));units(1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = structure("numeric", previous = c("double", \n"numeric")), method = "units.numeric", generic = "units", group = "", \n    type = "double", publicClass = "numeric", object = FALSE), \n    warnings = character(0)))',
  ],
  [
    "units-consequence: integer matrix",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({units.numeric<-function(x)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x));units(matrix(1L,1,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = structure("numeric", previous = c("matrix", \n"array", "integer", "numeric")), method = "units.numeric", generic = "units", \n    group = "", type = "integer", publicClass = c("matrix", "array"\n    ), object = FALSE), warnings = character(0)))',
  ],
  [
    "units-consequence: double array",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({units.numeric<-function(x)list(classes=.Class,method=.Method,generic=.Generic,group=.Group,type=typeof(x),publicClass=class(x),object=is.object(x));units(array(1,c(1L,1L,1L)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(classes = structure("numeric", previous = c("array", \n"double", "numeric")), method = "units.numeric", generic = "units", \n    group = "", type = "double", publicClass = "array", object = FALSE), \n    warnings = character(0)))',
  ],
  [
    "units-consequence: units integer NextMethod",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({units.integer<-function(x)list(first=list(.Class,.Method),tail=NextMethod());units.numeric<-function(x)list(.Class,.Method,type=typeof(x));units(1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(c("integer", "numeric"), "units.integer"), \n    tail = list(structure("numeric", previous = c("integer", \n    "numeric")), "units.numeric", type = "integer")), warnings = character(0)))',
  ],
  [
    "units-consequence: units setter chain preserves value lazy",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({`units<-.integer`<-function(x,value)list(first=list(.Class,.Method),tail=NextMethod());`units<-.numeric`<-function(x,value)list(.Class,.Method,missing(value));`units<-`(1L,stop("value forced"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(c("integer", "numeric"), "units<-.integer"), \n    tail = list(structure("numeric", previous = c("integer", \n    "numeric")), "units<-.numeric", FALSE)), warnings = character(0)))',
  ],
  [
    "units-consequence: units setter preserves reference value",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({shared<-new.env(parent=emptyenv());`units<-.numeric`<-function(x,value)list(same=identical(value,shared),classes=.Class,method=.Method,type=typeof(x));`units<-`(1L,shared)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(same = TRUE, classes = structure("numeric", previous = c("integer", \n"numeric")), method = "units<-.numeric", type = "integer"), warnings = character(0)))',
  ],
  [
    "posix-consequence: as.POSIXct double chain",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({as.POSIXct.double<-function(x,...)list(first=list(.Class,.Method),tail=NextMethod());as.POSIXct.numeric<-function(x,...)list(.Class,.Method,typeof(x));as.POSIXct(1,tz=stop("tz"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(c("double", "numeric"), "as.POSIXct.double"), \n    tail = list(structure("numeric", previous = c("double", "numeric"\n    )), "as.POSIXct.numeric", "double")), warnings = character(0)))',
  ],
  [
    "posix-consequence: as.POSIXct matrix complete chain",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({as.POSIXct.matrix<-function(x,...)list(first=list(.Class,.Method),tail=NextMethod());as.POSIXct.array<-function(x,...)list(first=list(.Class,.Method),tail=NextMethod());as.POSIXct.integer<-function(x,...)list(first=list(.Class,.Method),tail=NextMethod());as.POSIXct.numeric<-function(x,...)list(.Class,.Method,typeof(x),dim(x));as.POSIXct(matrix(1L,1),tz=stop("tz"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(c("matrix", "array", "integer", \n"numeric"), "as.POSIXct.matrix"), tail = list(first = list(structure(c("array", \n"integer", "numeric"), previous = c("matrix", "array", "integer", \n"numeric")), "as.POSIXct.array"), tail = list(first = list(structure(c("integer", \n"numeric"), previous = structure(c("array", "integer", "numeric"\n), previous = c("matrix", "array", "integer", "numeric"))), "as.POSIXct.integer"), \n    tail = list(structure("numeric", previous = structure(c("integer", \n    "numeric"), previous = structure(c("array", "integer", "numeric"\n    ), previous = c("matrix", "array", "integer", "numeric")))), \n        "as.POSIXct.numeric", "integer", c(1L, 1L))))), warnings = character(0)))',
  ],
  [
    "chain-metadata: matrix NextMethod skips middle classes",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.matrix<-function(x)list(first=list(.Class,.Method),tail=NextMethod());g.numeric<-function(x)list(.Class,.Method,attr(.Class,"previous"));g(matrix(1L,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(c("matrix", "array", "integer", \n"numeric"), "g.matrix"), tail = list(structure("numeric", previous = c("matrix", \n"array", "integer", "numeric")), "g.numeric", c("matrix", "array", \n"integer", "numeric"))), warnings = character(0)))',
  ],
  [
    "chain-metadata: array entry skips matrix then numeric skips storage",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({g<-function(x)UseMethod("g");g.array<-function(x)list(first=list(.Class,.Method),tail=NextMethod());g.numeric<-function(x)list(.Class,.Method,attr(.Class,"previous"));g(matrix(1L,1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(structure(c("array", "integer", \n"numeric"), previous = c("matrix", "array", "integer", "numeric"\n)), "g.array"), tail = list(structure("numeric", previous = structure(c("array", \n"integer", "numeric"), previous = c("matrix", "array", "integer", \n"numeric"))), "g.numeric", structure(c("array", "integer", "numeric"\n), previous = c("matrix", "array", "integer", "numeric")))), \n    warnings = character(0)))',
  ],
  [
    "public-label-guards: integer",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({inspect<-function(x)list(class=class(x),type=typeof(x),object=is.object(x),inherits=c(integer=inherits(x,"integer"),double=inherits(x,"double"),numeric=inherits(x,"numeric"),matrix=inherits(x,"matrix"),array=inherits(x,"array")));g<-function(x)UseMethod("g");g.numeric<-function(x)list(classes=.Class,labels=inspect(x));x<-1L;list(before=inspect(x),result=g(x),after=inspect(x))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(before = list(class = "integer", type = "integer", \n    object = FALSE, inherits = c(integer = TRUE, double = FALSE, \n    numeric = FALSE, matrix = FALSE, array = FALSE)), result = list(\n    classes = structure("numeric", previous = c("integer", "numeric"\n    )), labels = list(class = "integer", type = "integer", object = FALSE, \n        inherits = c(integer = TRUE, double = FALSE, numeric = FALSE, \n        matrix = FALSE, array = FALSE))), after = list(class = "integer", \n    type = "integer", object = FALSE, inherits = c(integer = TRUE, \n    double = FALSE, numeric = FALSE, matrix = FALSE, array = FALSE\n    ))), warnings = character(0)))',
  ],
  [
    "public-label-guards: double",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({inspect<-function(x)list(class=class(x),type=typeof(x),object=is.object(x),inherits=c(integer=inherits(x,"integer"),double=inherits(x,"double"),numeric=inherits(x,"numeric"),matrix=inherits(x,"matrix"),array=inherits(x,"array")));g<-function(x)UseMethod("g");g.numeric<-function(x)list(classes=.Class,labels=inspect(x));x<-1;list(before=inspect(x),result=g(x),after=inspect(x))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(before = list(class = "numeric", type = "double", \n    object = FALSE, inherits = c(integer = FALSE, double = FALSE, \n    numeric = TRUE, matrix = FALSE, array = FALSE)), result = list(\n    classes = structure("numeric", previous = c("double", "numeric"\n    )), labels = list(class = "numeric", type = "double", object = FALSE, \n        inherits = c(integer = FALSE, double = FALSE, numeric = TRUE, \n        matrix = FALSE, array = FALSE))), after = list(class = "numeric", \n    type = "double", object = FALSE, inherits = c(integer = FALSE, \n    double = FALSE, numeric = TRUE, matrix = FALSE, array = FALSE\n    ))), warnings = character(0)))',
  ],
  [
    "public-label-guards: integer matrix",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({inspect<-function(x)list(class=class(x),type=typeof(x),object=is.object(x),inherits=c(integer=inherits(x,"integer"),double=inherits(x,"double"),numeric=inherits(x,"numeric"),matrix=inherits(x,"matrix"),array=inherits(x,"array")));g<-function(x)UseMethod("g");g.numeric<-function(x)list(classes=.Class,labels=inspect(x));x<-matrix(1L,1);list(before=inspect(x),result=g(x),after=inspect(x))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(before = list(class = c("matrix", "array"), \n    type = "integer", object = FALSE, inherits = c(integer = FALSE, \n    double = FALSE, numeric = FALSE, matrix = TRUE, array = TRUE\n    )), result = list(classes = structure("numeric", previous = c("matrix", \n"array", "integer", "numeric")), labels = list(class = c("matrix", \n"array"), type = "integer", object = FALSE, inherits = c(integer = FALSE, \ndouble = FALSE, numeric = FALSE, matrix = TRUE, array = TRUE))), \n    after = list(class = c("matrix", "array"), type = "integer", \n        object = FALSE, inherits = c(integer = FALSE, double = FALSE, \n        numeric = FALSE, matrix = TRUE, array = TRUE))), warnings = character(0)))',
  ],
  [
    "public-label-guards: double array",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({inspect<-function(x)list(class=class(x),type=typeof(x),object=is.object(x),inherits=c(integer=inherits(x,"integer"),double=inherits(x,"double"),numeric=inherits(x,"numeric"),matrix=inherits(x,"matrix"),array=inherits(x,"array")));g<-function(x)UseMethod("g");g.numeric<-function(x)list(classes=.Class,labels=inspect(x));x<-array(1,c(1L,1L,1L));list(before=inspect(x),result=g(x),after=inspect(x))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(before = list(class = "array", type = "double", \n    object = FALSE, inherits = c(integer = FALSE, double = FALSE, \n    numeric = FALSE, matrix = FALSE, array = TRUE)), result = list(\n    classes = structure("numeric", previous = c("array", "double", \n    "numeric")), labels = list(class = "array", type = "double", \n        object = FALSE, inherits = c(integer = FALSE, double = FALSE, \n        numeric = FALSE, matrix = FALSE, array = TRUE))), after = list(\n    class = "array", type = "double", object = FALSE, inherits = c(integer = FALSE, \n    double = FALSE, numeric = FALSE, matrix = FALSE, array = TRUE\n    ))), warnings = character(0)))',
  ],
  [
    "explicit-unusual-precedence: list",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({x<-list(a=1);attr(x,"class")<-c("owned","second");g<-function(x)UseMethod("g");g.owned<-function(x)list(first=list(.Class,.Method,typeof(x)),tail=NextMethod());g.second<-function(x)list(.Class,.Method,typeof(x),class(x));g.default<-function(x)stop("unexpected default");g(x)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(c("owned", "second"), "g.owned", \n    "list"), tail = list(structure("second", previous = c("owned", \n"second")), "g.second", "list", c("owned", "second"))), warnings = character(0)))',
  ],
  [
    "explicit-unusual-precedence: pairlist",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({x<-pairlist(a=1);attr(x,"class")<-c("owned","second");g<-function(x)UseMethod("g");g.owned<-function(x)list(first=list(.Class,.Method,typeof(x)),tail=NextMethod());g.second<-function(x)list(.Class,.Method,typeof(x),class(x));g.default<-function(x)stop("unexpected default");g(x)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(first = list(c("owned", "second"), "g.owned", \n    "pairlist"), tail = list(structure("second", previous = c("owned", \n"second")), "g.second", "pairlist", c("owned", "second"))), warnings = character(0)))',
  ],
  [
    "reference-identity: implicit numeric method returns original reference",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({shared<-new.env(parent=emptyenv());shared$marker<-37L;g<-function(x,y)UseMethod("g");g.numeric<-function(x,y)list(returned=y,classes=.Class,method=.Method);a<-g(1L,shared);list(same=identical(shared,a$returned),marker=a$returned$marker,classes=a$classes,method=a$method)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(same = TRUE, marker = 37L, classes = structure("numeric", previous = c("integer", \n"numeric")), method = "g.numeric"), warnings = character(0)))',
  ],
  [
    "implicit-dispatch: integer numeric method",
    'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(1L,tz=stop("tz"))}),17L)})',
  ],
  [
    "implicit-dispatch: integer before numeric",
    "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.integer<-function(x,...)18L;as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(1L)}),18L)})",
  ],
  [
    "implicit-dispatch: integer NextMethod numeric",
    'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({events<-character();as.POSIXct.integer<-function(x,...){events<<-c(events,"integer");NextMethod()};as.POSIXct.numeric<-function(x,...){events<<-c(events,"numeric");17L};list(as.POSIXct(1L),events)}),list(17L,c("integer","numeric")))})',
  ],
  [
    "implicit-dispatch: double method precedence",
    "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.double<-function(x,...)18L;as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(1)}),18L)})",
  ],
  [
    "implicit-dispatch: matrix storage fallback",
    "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(matrix(1L,1))}),17L)})",
  ],
  [
    "implicit-dispatch: classed numeric default method",
    'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.default<-function(x,...)19L;as.POSIXct(structure(1,class="owned_no_method"),tz="UTC")}),19L)})',
  ],
  [
    "implicit-dispatch: classed numeric explicit numeric superclass",
    'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({as.POSIXct.numeric<-function(x,...)17L;as.POSIXct(structure(1,class=c("owned_no_method","numeric")),tz="UTC")}),17L)})',
  ],
  [
    "internal-guards: finite ignores implicit methods",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({is.finite.integer<-function(x)stop("integer dispatched");is.finite.double<-function(x)stop("double dispatched");is.finite.numeric<-function(x)stop("numeric dispatched");is.finite.matrix<-function(x)stop("matrix dispatched");list(is.finite(1L),is.finite(1),is.finite(matrix(1L,1)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(TRUE, TRUE, structure(TRUE, dim = c(1L, 1L))), \n    warnings = character(0)))',
  ],
  [
    "internal-guards: names ignores implicit methods",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({names.integer<-function(x)stop("integer dispatched");names.numeric<-function(x)stop("numeric dispatched");names.matrix<-function(x)stop("matrix dispatched");list(names(1L),names(1),names(matrix(1L,1)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(NULL, NULL, NULL), warnings = character(0)))',
  ],
  [
    "internal-guards: Ops ignores implicit methods",
    'identical(local({warnings<-character();value<-tryCatch(withCallingHandlers(local({Ops.integer<-function(...)stop("integer dispatched");Ops.double<-function(...)stop("double dispatched");Ops.numeric<-function(...)stop("numeric dispatched");Ops.matrix<-function(...)stop("matrix dispatched");list(1L+1L,1+1,matrix(1L,1)+1L)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")}),error=function(e)list(error=conditionMessage(e)));list(value=value,warnings=warnings)}),list(value = list(2L, 2, structure(2L, dim = c(1L, 1L))), warnings = character(0)))',
  ],
] as const;

it.each(cases)("implicit S3 class chain: %s", async (_name, code) => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(code);
    expect(result.value).toBe(true);
    expect(result.warnings).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});

it("bounds absent-method search and preserves source attributes after failure", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 400, maxVectorLength: 2000 },
  });
  try {
    await runtime.assign(
      "ownedClasses",
      Array.from({ length: 1000 }, () => "no_method"),
    );
    await runtime.eval(
      'shared<-new.env();x<-structure(1L,class=ownedClasses,note=shared);g<-function(x)UseMethod("g");g.default<-function(x)17L;g.numeric<-function(x)23L;NULL',
    );
    await expect(runtime.eval("g(x)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await runtime.eval('length(class(x))==1000L&&identical(attr(x,"note"),shared)')).toBe(
      true,
    );
    expect(await runtime.eval("g(1L)")).toBe(23);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("charges repeated method class metadata before copying suffixes", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 100000, maxVectorLength: 1000 },
  });
  try {
    await runtime.assign(
      "ownedClasses",
      Array.from({ length: 1000 }, () => "owned"),
    );
    await runtime.eval(
      'shared<-new.env();x<-structure(1L,class=ownedClasses,note=shared);g<-function(x)UseMethod("g");g.owned<-function(x)17L;g.numeric<-function(x)23L;NULL',
    );
    await expect(runtime.eval("for(i in 1:11)g(x)")).rejects.toMatchObject({ code: "NRL4003" });
    expect(await runtime.eval('length(class(x))==1000L&&identical(attr(x,"note"),shared)')).toBe(
      true,
    );
    expect(await runtime.eval("g(1L)")).toBe(23);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("bounds NextMethod recursion and restores the session call frames", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 100000, maxVectorLength: 1000, maxCallDepth: 12 },
  });
  try {
    await runtime.assign(
      "ownedClasses",
      Array.from({ length: 50 }, () => "owned"),
    );
    await runtime.eval(
      'x<-structure(1L,class=ownedClasses);g<-function(x)UseMethod("g");g.owned<-function(x)NextMethod();g.numeric<-function(x)23L;NULL',
    );
    await expect(runtime.eval("g(x)")).rejects.toMatchObject({ code: "NRL4004" });
    expect(await runtime.eval("length(class(x))")).toBe(50);
    expect(await runtime.eval("g(1L)")).toBe(23);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});
