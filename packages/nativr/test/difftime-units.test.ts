import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession;
beforeAll(async () => {
  runtime = await createR({ execution: "inline", assets });
});
afterAll(async () => runtime.dispose());
// Independently authored GNU R 4.6.1 black-box observations. Success-path errors escape.
const cases = [
  {
    group: "conversion",
    name: "secs to secs",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(604800,"secs"),"secs"),dt(604800,"secs"))})',
  },
  {
    group: "conversion",
    name: "secs to mins",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(604800,"secs"),"mins"),dt(10080,"mins"))})',
  },
  {
    group: "conversion",
    name: "secs to hours",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(604800,"secs"),"hours"),dt(168,"hours"))})',
  },
  {
    group: "conversion",
    name: "secs to days",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(604800,"secs"),"days"),dt(7,"days"))})',
  },
  {
    group: "conversion",
    name: "secs to weeks",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(604800,"secs"),"weeks"),dt(1,"weeks"))})',
  },
  {
    group: "conversion",
    name: "mins to secs",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(10080,"mins"),"secs"),dt(604800,"secs"))})',
  },
  {
    group: "conversion",
    name: "mins to mins",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(10080,"mins"),"mins"),dt(10080,"mins"))})',
  },
  {
    group: "conversion",
    name: "mins to hours",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(10080,"mins"),"hours"),dt(168,"hours"))})',
  },
  {
    group: "conversion",
    name: "mins to days",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(10080,"mins"),"days"),dt(7,"days"))})',
  },
  {
    group: "conversion",
    name: "mins to weeks",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(10080,"mins"),"weeks"),dt(1,"weeks"))})',
  },
  {
    group: "conversion",
    name: "hours to secs",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(168,"hours"),"secs"),dt(604800,"secs"))})',
  },
  {
    group: "conversion",
    name: "hours to mins",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(168,"hours"),"mins"),dt(10080,"mins"))})',
  },
  {
    group: "conversion",
    name: "hours to hours",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(168,"hours"),"hours"),dt(168,"hours"))})',
  },
  {
    group: "conversion",
    name: "hours to days",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(168,"hours"),"days"),dt(7,"days"))})',
  },
  {
    group: "conversion",
    name: "hours to weeks",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(168,"hours"),"weeks"),dt(1,"weeks"))})',
  },
  {
    group: "conversion",
    name: "days to secs",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(7,"days"),"secs"),dt(604800,"secs"))})',
  },
  {
    group: "conversion",
    name: "days to mins",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(7,"days"),"mins"),dt(10080,"mins"))})',
  },
  {
    group: "conversion",
    name: "days to hours",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(7,"days"),"hours"),dt(168,"hours"))})',
  },
  {
    group: "conversion",
    name: "days to days",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(7,"days"),"days"),dt(7,"days"))})',
  },
  {
    group: "conversion",
    name: "days to weeks",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(7,"days"),"weeks"),dt(1,"weeks"))})',
  },
  {
    group: "conversion",
    name: "weeks to secs",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(1,"weeks"),"secs"),dt(604800,"secs"))})',
  },
  {
    group: "conversion",
    name: "weeks to mins",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(1,"weeks"),"mins"),dt(10080,"mins"))})',
  },
  {
    group: "conversion",
    name: "weeks to hours",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(1,"weeks"),"hours"),dt(168,"hours"))})',
  },
  {
    group: "conversion",
    name: "weeks to days",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(1,"weeks"),"days"),dt(7,"days"))})',
  },
  {
    group: "conversion",
    name: "weeks to weeks",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(1,"weeks"),"weeks"),dt(1,"weeks"))})',
  },
  {
    group: "metadata",
    name: "four closure signatures",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(c(typeof(units),typeof(`units<-`),typeof(units.difftime),typeof(`units<-.difftime`)),rep("closure",4))&&identical(list(names(formals(units)),names(formals(`units<-`)),names(formals(units.difftime)),names(formals(`units<-.difftime`))),list("x",c("x","value"),"x",c("x","value")))})',
  },
  {
    group: "getter",
    name: "difftime getter exact",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(units(dt()),"secs")})',
  },
  {
    group: "getter",
    name: "direct getter absent attribute",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);is.null(units.difftime(1))})',
  },
  {
    group: "getter",
    name: "direct getter partial attribute",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(units.difftime(structure(1,units.extra="hours")),"hours")})',
  },
  {
    group: "getter",
    name: "direct getter ambiguous attribute",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);is.null(units.difftime(structure(1,units.one="hours",units.two="days")))})',
  },
  {
    group: "getter",
    name: "direct getter arbitrary attr",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(units.difftime(structure(1,units=list(a=1))),list(a=1))})',
  },
  {
    group: "getter",
    name: "direct getter reference identity",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({e<-new.env();value<-new.env();attr(e,"units")<-value;identical(units.difftime(e),value)})})',
  },
  {
    group: "conversion",
    name: "missing nonfinite negative fractions",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(c(-30,0,90,NA_real_,Inf,-Inf,NaN)),"mins"),dt(c(-0.5,0,1.5,NA_real_,Inf,-Inf,NaN),"mins"))})',
  },
  {
    group: "conversion",
    name: "empty conversion",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(numeric()),"hours"),dt(numeric(),"hours"))})',
  },
  {
    group: "conversion",
    name: "integer converted to double",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({y<-`units<-`(dt(120L),"mins");identical(typeof(y),"double")&&identical(y,dt(2,"mins"))})})',
  },
  {
    group: "conversion",
    name: "converted subclass normalized attributes kept",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-structure(c(a=120,b=NA_real_),class=c("owned","difftime"),units="secs",note="keep");identical(`units<-`(x,"mins"),structure(c(a=2,b=NA_real_),class="difftime",units="mins",note="keep"))})})',
  },
  {
    group: "conversion",
    name: "dimensions names and note kept",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-structure(matrix(c(60,120,180,240),2,dimnames=list(c("a","b"),c("c","d"))),class="difftime",units="secs",note="keep");y<-`units<-`(x,"mins");identical(y,structure(matrix(c(1,2,3,4),2,dimnames=list(c("a","b"),c("c","d"))),class="difftime",units="mins",note="keep"))})})',
  },
  {
    group: "conversion",
    name: "named units replacement kept",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({value<-c(owned="mins");y<-`units<-`(dt(),value);identical(attr(y,"units"),value)&&identical(as.numeric(y),2)})})',
  },
  {
    group: "conversion",
    name: "attributed units replacement kept",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({value<-structure("mins",note="keep");y<-`units<-`(dt(),value);identical(attr(y,"units"),value)&&identical(as.numeric(y),2)})})',
  },
  {
    group: "conversion",
    name: "attribute reference kept",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({e<-new.env();x<-dt();attr(x,"note")<-e;y<-`units<-`(x,"mins");identical(attr(y,"note"),e)})})',
  },
  {
    group: "conversion",
    name: "original alias unchanged",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-dt();old<-x;units(x)<-"mins";identical(x,dt(2,"mins"))&&identical(old,dt())})})',
  },
  {
    group: "conversion",
    name: "valid conversion emits no warning",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({warnings<-character();y<-withCallingHandlers(`units<-`(dt(),"mins"),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(y,dt(2,"mins"))&&length(warnings)==0L})})',
  },
  {
    group: "same-unit",
    name: "same integer unchanged",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-dt(120L);identical(`units<-`(x,"secs"),x)})})',
  },
  {
    group: "same-unit",
    name: "same subclass attributes unchanged",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-structure(c(a=120L,b=NA_integer_),class=c("owned","difftime"),units="secs",note="keep");identical(`units<-`(x,"secs"),x)})})',
  },
  {
    group: "same-unit",
    name: "same unit retains original units attrs",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-dt(120,c(old="secs"));identical(`units<-`(x,c(new="secs")),x)})})',
  },
  {
    group: "diagnostics",
    name: "empty replacement",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),character())),"argument is of length zero")})',
  },
  {
    group: "diagnostics",
    name: "NULL replacement",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),NULL)),"argument is of length zero")})',
  },
  {
    group: "diagnostics",
    name: "multiple replacement",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),c("mins","hours"))),"the condition has length > 1")})',
  },
  {
    group: "diagnostics",
    name: "missing replacement",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),NA_character_)),"missing value where TRUE/FALSE needed")})',
  },
  {
    group: "diagnostics",
    name: "logical replacement",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),TRUE)),"invalid units specified")})',
  },
  {
    group: "diagnostics",
    name: "numeric replacement",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),1)),"invalid units specified")})',
  },
  {
    group: "diagnostics",
    name: "missing input units",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(structure(120,class="difftime"),"mins")),"argument is of length zero")})',
  },
  {
    group: "diagnostics",
    name: "missing value argument",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt())),"argument \\"value\\" is missing, with no default")})',
  },
  {
    group: "diagnostics",
    name: "method getter missing x",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units.difftime()),"argument \\"x\\" is missing, with no default")})',
  },
  {
    group: "diagnostics",
    name: "method setter missing x",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-.difftime`()),"argument \\"x\\" is missing, with no default")})',
  },
  {
    group: "diagnostics",
    name: "generic getter no x",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units()),"no applicable method for \'units\' applied to an object of class \\"NULL\\"")})',
  },
  {
    group: "diagnostics",
    name: "generic setter no x",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`()),"no applicable method for \'units<-\' applied to an object of class \\"NULL\\"")})',
  },
  {
    group: "diagnostics",
    name: "plain getter no applicable",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(1)),"no applicable method for \'units\' applied to an object of class \\"c(\'double\', \'numeric\')\\"")})',
  },
  {
    group: "diagnostics",
    name: "plain setter no applicable",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(1,"mins")),"no applicable method for \'units<-\' applied to an object of class \\"c(\'double\', \'numeric\')\\"")})',
  },
  {
    group: "diagnostics",
    name: "direct setter calls generic getter",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-.difftime`(structure(120,units="secs"),"mins")),"no applicable method for \'units\' applied to an object of class \\"c(\'double\', \'numeric\')\\"")})',
  },
  {
    group: "arguments",
    name: "getter unused",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(1,2)),"unused argument (2)")})',
  },
  {
    group: "arguments",
    name: "setter unused",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),"mins",2)),"unused argument (2)")})',
  },
  {
    group: "arguments",
    name: "getter duplicate x",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(x=1,x=2)),"formal argument \\"x\\" matched by multiple actual arguments")})',
  },
  {
    group: "arguments",
    name: "setter duplicate value",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),value="mins",value="hours")),"formal argument \\"value\\" matched by multiple actual arguments")})',
  },
  {
    group: "arguments",
    name: "setter partial value",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(x=dt(),val="mins"),dt(2,"mins"))})',
  },
  {
    group: "arguments",
    name: "setter reordered actuals",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(value="mins",x=dt()),dt(2,"mins"))})',
  },
  {
    group: "arguments",
    name: "unused actuals before forcing",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();message<-err(`units<-`({events<-c(events,"x");dt()},"mins",2));identical(list(events,message),list(character(),"unused argument (2)"))})})',
  },
  {
    group: "dispatch",
    name: "getter local class",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({units.owned<-function(x)"owned";identical(units(structure(1,class="owned")),"owned")})})',
  },
  {
    group: "dispatch",
    name: "getter default implicit class",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({units.default<-function(x)"default";identical(units(1),"default")})})',
  },
  {
    group: "dispatch",
    name: "setter default implicit class",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.default`<-function(x,value)list(x,value);identical(`units<-`(1,"mins"),list(1,"mins"))})})',
  },
  {
    group: "dispatch",
    name: "setter value stays lazy",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.owned`<-function(x,value)42L;identical(`units<-`(structure(1,class="owned"),stop("value")),42L)})})',
  },
  {
    group: "dispatch",
    name: "getter invisible result retained",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({units.owned<-function(x)invisible("secs");identical(withVisible(units(structure(1,class="owned"))),list(value="secs",visible=FALSE))})})',
  },
  {
    group: "dispatch",
    name: "setter invisible result retained",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.owned`<-function(x,value)invisible(42L);identical(withVisible(`units<-`(structure(1,class="owned"),"mins")),list(value=42L,visible=FALSE))})})',
  },
  {
    group: "dispatch",
    name: "getter NextMethod",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({units.owned<-function(x)NextMethod();identical(units(structure(120,class=c("owned","difftime"),units="secs")),"secs")})})',
  },
  {
    group: "dispatch",
    name: "setter NextMethod",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.owned`<-function(x,value)NextMethod();identical(`units<-`(structure(120,class=c("owned","difftime"),units="secs"),"mins"),dt(2,"mins"))})})',
  },
  {
    group: "dispatch",
    name: "setter NextMethod reassigned",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.owned`<-function(x,value){value<-"hours";NextMethod()};identical(`units<-`(structure(7200,class=c("owned","difftime"),units="secs"),"mins"),dt(2,"hours"))})})',
  },
  {
    group: "dispatch",
    name: "setter owned metadata",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.owned`<-function(x,value)list(substitute(x),substitute(value),match.call(),.Generic,.Method,.Class,.Group);x<-structure(1,class="owned");identical(`units<-`(x,paste0("m","ins")),list(quote(x),quote(paste0("m","ins")),quote(`units<-.owned`(x=x,value=paste0("m","ins"))),"units<-","units<-.owned","owned",""))})})',
  },
  {
    group: "dispatch",
    name: "getter NULL method omitted x",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({units.NULL<-function(x)missing(x);identical(units(),TRUE)})})',
  },
  {
    group: "dispatch",
    name: "setter NULL method omitted formals",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.NULL`<-function(x,value)list(missing(x),missing(value));identical(`units<-`(),list(TRUE,TRUE))})})',
  },
  {
    group: "visibility",
    name: "direct setter visible",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(withVisible(`units<-`(dt(),"mins")),list(value=dt(2,"mins"),visible=TRUE))})',
  },
  {
    group: "visibility",
    name: "assignment invisible RHS",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-dt();identical(withVisible(units(x)<-"mins"),list(value="mins",visible=FALSE))})})',
  },
  {
    group: "forcing",
    name: "input before value generic",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(stop("input"),stop("value"))),"input")})',
  },
  {
    group: "forcing",
    name: "input before value direct method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-.difftime`(stop("input"),stop("value"))),"input")})',
  },
  {
    group: "forcing",
    name: "direct getter input once",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({count<-0L;y<-units.difftime({count<-count+1L;dt()});identical(list(count,y),list(1L,"secs"))})})',
  },
  {
    group: "scope",
    name: "direct setter local getter ignored",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({units.owned<-function(x)"secs";identical(err(`units<-.difftime`(structure(120,class="owned"),"mins")),"no applicable method for \'units\' applied to an object of class \\"owned\\"")})})',
  },
  {
    group: "scope",
    name: "global getter once before value",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();units.owned<-function(x){events<<-c(events,"units");"secs"};assign("units.owned",units.owned,.GlobalEnv);on.exit(rm("units.owned",envir=.GlobalEnv));y<-`units<-.difftime`({events<-c(events,"x");structure(120,class="owned")},{events<-c(events,"value");"mins"});identical(list(events,y),list(c("x","units","value"),dt(2,"mins")))})})',
  },
  {
    group: "scope",
    name: "global getter once same-unit",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({count<-0L;units.owned<-function(x){count<<-count+1L;"secs"};assign("units.owned",units.owned,.GlobalEnv);on.exit(rm("units.owned",envir=.GlobalEnv));x<-structure(120,class="owned");y<-`units<-.difftime`(x,"secs");count==1L&&identical(x,y)})})',
  },
  {
    group: "scope",
    name: "conversion drops custom Ops dispatch",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();Ops.owned<-function(e1,e2){events<<-c(events,"ops");100};x<-structure(120,class=c("owned","difftime"),units="secs");y<-`units<-`(x,"mins");identical(list(events,y),list(character(),dt(2,"mins")))})})',
  },
  {
    group: "same-unit",
    name: "same invalid returns unchanged",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-dt(120,"invalid");identical(`units<-`(x,"invalid"),x)})})',
  },
  {
    group: "same-unit",
    name: "same min returns unchanged",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-dt(120,"min");identical(`units<-`(x,"min"),x)})})',
  },
  {
    group: "same-unit",
    name: "same auto returns unchanged",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-dt(120,"auto");identical(`units<-`(x,"auto"),x)})})',
  },
  {
    group: "diagnostics",
    name: "invalid invalid",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),"invalid")),"invalid units specified")})',
  },
  {
    group: "diagnostics",
    name: "invalid min",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),"min")),"invalid units specified")})',
  },
  {
    group: "diagnostics",
    name: "invalid auto",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),"auto")),"invalid units specified")})',
  },
  {
    group: "diagnostics",
    name: "invalid SECONDS",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),"SECONDS")),"invalid units specified")})',
  },
  {
    group: "diagnostics",
    name: "implicit integer no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(1L)),"no applicable method for \'units\' applied to an object of class \\"c(\'integer\', \'numeric\')\\"")})',
  },
  {
    group: "diagnostics",
    name: "implicit logical no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(TRUE)),"no applicable method for \'units\' applied to an object of class \\"logical\\"")})',
  },
  {
    group: "diagnostics",
    name: "implicit matrix no method",
    code: "local({dt<-function(x=120,units=\"secs\")structure(x,class=\"difftime\",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(matrix(1:4,2))),\"no applicable method for 'units' applied to an object of class \\\"c('matrix', 'array', 'integer', 'numeric')\\\"\")})",
  },
  {
    group: "diagnostics",
    name: "implicit array no method",
    code: "local({dt<-function(x=120,units=\"secs\")structure(x,class=\"difftime\",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(array(1:8,c(2L,2L,2L)))),\"no applicable method for 'units' applied to an object of class \\\"c('array', 'integer', 'numeric')\\\"\")})",
  },
  {
    group: "diagnostics",
    name: "implicit closure no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(function(x)x)),"no applicable method for \'units\' applied to an object of class \\"function\\"")})',
  },
  {
    group: "diagnostics",
    name: "implicit character no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units("owned")),"no applicable method for \'units\' applied to an object of class \\"character\\"")})',
  },
  {
    group: "diagnostics",
    name: "implicit list no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(list(1))),"no applicable method for \'units\' applied to an object of class \\"list\\"")})',
  },
  {
    group: "diagnostics",
    name: "implicit expression no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(expression(1))),"no applicable method for \'units\' applied to an object of class \\"expression\\"")})',
  },
  {
    group: "diagnostics",
    name: "implicit NULL no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(NULL)),"no applicable method for \'units\' applied to an object of class \\"NULL\\"")})',
  },
  {
    group: "diagnostics",
    name: "implicit raw no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(as.raw(1))),"no applicable method for \'units\' applied to an object of class \\"raw\\"")})',
  },
  {
    group: "diagnostics",
    name: "implicit complex no method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(1+2i)),"no applicable method for \'units\' applied to an object of class \\"complex\\"")})',
  },
  {
    group: "conversion",
    name: "direct setter valid result",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-.difftime`(dt(),"mins"),dt(2,"mins"))})',
  },
  {
    group: "numerics",
    name: "complex finite conversion",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(`units<-`(dt(60+120i),"mins"),dt(1+2i,"mins"))})',
  },
  {
    group: "numerics",
    name: "complex nonfinite conversion",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-complex(real=c(60,NA_real_,Inf,NaN,60),imaginary=c(120,2,2,2,Inf));expected<-complex(real=c(1,NA_real_,Inf,NaN,NaN),imaginary=c(2,NA_real_,NaN,NaN,Inf));identical(`units<-`(dt(x),"mins"),dt(expected,"mins"))})})',
  },
  {
    group: "numerics",
    name: "huge days weeks ratio first",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-.Machine$double.xmax/2;y<-as.numeric(`units<-`(dt(x,"days"),"weeks"));identical(y,x*(86400/604800))&&!identical(y,(x*86400)/604800)&&!identical(y,x/7)})})',
  },
  {
    group: "numerics",
    name: "huge weeks days ratio first",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-.Machine$double.xmax/8;y<-as.numeric(`units<-`(dt(x,"weeks"),"days"));identical(y,x*(604800/86400))&&!identical(y,(x*604800)/86400)})})',
  },
  {
    group: "numerics",
    name: "fractional weeks days ratio first",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-1/3;y<-as.numeric(`units<-`(dt(x,"weeks"),"days"));identical(y,x*(604800/86400))&&!identical(y,(x*604800)/86400)})})',
  },
  {
    group: "conversion",
    name: "empty dims survive ordinary attrs drop",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({x<-structure(numeric(),class=c("owned","difftime"),units="secs",dim=c(0L,2L),dimnames=list(NULL,c("a","b")),note="drop");y<-`units<-`(x,"mins");identical(y,structure(numeric(),class="difftime",units="mins",dim=c(0L,2L),dimnames=list(NULL,c("a","b"))))})})',
  },
  {
    group: "scope",
    name: "getter changing label observed once",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({count<-0L;units.owned<-function(x){count<<-count+1L;if(count==1L)"secs" else "hours"};assign("units.owned",units.owned,.GlobalEnv);on.exit(rm("units.owned",envir=.GlobalEnv));y<-`units<-.difftime`(structure(120,class="owned"),"mins");identical(list(count,y),list(1L,dt(2,"mins")))})})',
  },
  {
    group: "scope",
    name: "numeric input global Ops ignored",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();owned<-function(e1,e2){events<<-c(events,.Generic);100};assign("Ops.owned",owned,.GlobalEnv);on.exit(rm("Ops.owned",envir=.GlobalEnv));x<-structure(120,class=c("owned","difftime"),units="secs");y<-`units<-`(x,"mins");identical(list(events,y),list(character(),dt(2,"mins")))})})',
  },
  {
    group: "missing-arguments",
    name: "explicit missing getter class name",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(x=)),"no applicable method for \'units\' applied to an object of class \\"name\\"")})',
  },
  {
    group: "missing-arguments",
    name: "explicit missing setter class name",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(x=,value="mins")),"no applicable method for \'units<-\' applied to an object of class \\"name\\"")})',
  },
  {
    group: "missing-arguments",
    name: "explicit missing replacement argument",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(dt(),value=)),"argument \\"value\\" is missing, with no default")})',
  },
  {
    group: "missing-arguments",
    name: "explicit missing direct getter",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units.difftime(x=)),"argument \\"x\\" is missing, with no default")})',
  },
  {
    group: "missing-arguments",
    name: "explicit missing direct setter",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-.difftime`(x=,value="mins")),"argument \\"x\\" is missing, with no default")})',
  },
  {
    group: "missing-arguments",
    name: "setter value only implicit class",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(value="mins")),"no applicable method for \'units<-\' applied to an object of class \\"character\\"")})',
  },
  {
    group: "missing-arguments",
    name: "getter name method explicit missing",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({units.name<-function(x)list(missing(x),.Class,.Method);identical(units(x=),list(TRUE,"name","units.name"))})})',
  },
  {
    group: "missing-arguments",
    name: "setter name method explicit missing",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.name`<-function(x,value)list(missing(x),missing(value),value,.Class);identical(`units<-`(x=,value="mins"),list(TRUE,FALSE,"mins","name"))})})',
  },
  {
    group: "missing-arguments",
    name: "setter first named actual method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.character`<-function(x,value)list(missing(x),missing(value),value,.Class);identical(`units<-`(value="mins"),list(TRUE,FALSE,"mins","character"))})})',
  },
  {
    group: "missing-arguments",
    name: "setter partial first named actual method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.character`<-function(x,value)list(missing(x),missing(value),value,.Class);identical(`units<-`(val="mins"),list(TRUE,FALSE,"mins","character"))})})',
  },
  {
    group: "missing-arguments",
    name: "setter first actual missing method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.name`<-function(x,value)list(missing(x),missing(value),.Class);identical(`units<-`(value=),list(TRUE,TRUE,"name"))})})',
  },
  {
    group: "missing-arguments",
    name: "setter first actual forces once",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({events<-character();`units<-.character`<-function(x,value){events<<-c(events,"method");list(missing(x),value,events)};identical(`units<-`(value={events<-c(events,"value");"mins"}),list(TRUE,"mins",c("value","method")))})})',
  },
  {
    group: "missing-arguments",
    name: "setter explicit missing x value lazy",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.name`<-function(x,value)42L;identical(`units<-`(x=,value=stop("value")),42L)})})',
  },
  {
    group: "missing-arguments",
    name: "getter unused missing value",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(units(value=)),"unused argument (alist(value = ))")})',
  },
  {
    group: "missing-arguments",
    name: "setter explicit missing x after value",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({`units<-.name`<-function(x,value)list(missing(x),value);identical(`units<-`(value="mins",x=),list(TRUE,"mins"))})})',
  },
  {
    group: "missing-arguments",
    name: "setter supplied x after missing value",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(`units<-`(value=,x=dt())),"argument \\"value\\" is missing, with no default")})',
  },
  {
    group: "arguments",
    name: "partial value warns generic and method",
    code: 'local({dt<-function(x=120,units="secs")structure(x,class="difftime",units=units);err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);local({old<-options(warnPartialMatchArgs=TRUE);on.exit(options(old));messages<-character();y<-withCallingHandlers(`units<-`(dt(),va="mins"),warning=function(w){messages<<-c(messages,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(messages,y),list(rep("partial argument match of \'va\' to \'value\'",2),dt(2,"mins")))})})',
  },
] as const;
it.each(cases)("$name", async ({ code }) => {
  await runtime.reset();
  expect(await runtime.eval(code)).toBe(true);
});

it("bounds unit conversion and recursive methods and recovers without changing the input", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 2000, maxVectorLength: 20000, maxCallDepth: 1000 },
  });
  try {
    await limited.assign("x", new Float64Array(10000).fill(3600));
    await limited.eval('class(x)<-"difftime";attr(x,"units")<-"secs"');
    await expect(limited.eval('units(x)<-"hours"')).rejects.toMatchObject({ code: "NRL4001" });
    expect(await limited.eval("units(x)")).toBe("secs");
    expect(await limited.eval("x[[1]]")).toBe(3600);
    await expect(
      limited.eval('units.owned<-function(x)units(x);units(structure(1,class="owned"))'),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await limited.eval("sys.nframe()")).toBe(0);
    expect(await limited.eval("1+1")).toBe(2);
  } finally {
    await limited.dispose();
  }
});
